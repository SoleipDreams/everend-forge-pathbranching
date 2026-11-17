import type { Edge, Node, Viewport } from "@xyflow/react";
import { speakerLabel } from "../speakerRoles.js";
import type {
  Branch,
  BranchingProject,
  CanvasScope,
  ConditionInput,
  Consequence,
  DialogueNode,
  EventNode,
  Outcome,
  ScriptRef,
  Transition,
  ValidationFinding,
} from "../domain.js";
import { conditionUiCopy, conditionTreeSummary, conditionWarningCount, groupedConditionPresentation, type ConditionUiLocale } from "../conditionPresentation.js";
import { conditionCount, conditionLabels, consequenceLabel, walkConditions } from "../logic.js";
import { presentConditionInput, presentConsequences, type LogicPresentation } from "../logicCapabilities.js";
import { interactionNodeId } from "../interactions.js";
import { blockValues, localizedValue } from "../localization.js";
import { activeCanvasScope, canvasScopeKey } from "../storySelection.js";
import { narrativeLineLabel } from "../narrativeNaming.js";
import type { AuthoringDisplaySettings, CanvasLayerMode } from "../workspaceSettings.js";

export type StoryCanvasNodeKind =
  | "sequence"
  | "start"
  | "boundary"
  | "workspace"
  | "endAdder"
  | "routeGate"
  | "branch"
  | "event"
  | "decision"
  | "dialogue"
  | "dialogueStart"
  | "speechBeat"
  | "directionBeat"
  | "outcome"
  | "inkSection"
  | "knowledge"
  | "runtimeAction"
  | "interaction"
  | "barrier"
  | "missingRef";

export type CanvasInfoBadge = {
  kind: "decisions" | "outcomes" | "dialogues" | "lines" | "characters" | "words";
  count: number;
};

export type StoryCanvasEdgeKind =
  | "entry"
  | "boundary"
  | "contains"
  | "choice"
  | "transition"
  | "condition"
  | "consequence";

export type StoryCanvasNodeData = {
  kind: StoryCanvasNodeKind;
  title: string;
  subtitle?: string;
  storyObjectId: string;
  badges: string[];
  summaryBadges?: string[];
  infoBadges?: CanvasInfoBadge[];
  authoringLogicSummary?: StoryCanvasNodeData["logicSummary"];
  logicSummary?: {
    when: string;
    then: string;
    expanded: boolean;
    whenItems: LogicPresentation[];
    thenItems: LogicPresentation[];
    warningCount: number;
    conditionCount: number;
    consequenceCount: number;
    ruleCount: number;
  };
  canvasLayerMode?: CanvasLayerMode;
  details?: Record<string, unknown>;
  collapsed?: boolean;
  isContainer?: boolean;
} & Record<string, unknown>;

export type StoryCanvasEdgeData = {
  kind: StoryCanvasEdgeKind;
  label: string;
  waypoints?: Array<{ x: number; y: number }>;
  routeRole?: "flow" | "route";
  conditions?: ConditionInput;
  consequences?: Consequence[];
} & Record<string, unknown>;

export type StoryCanvasNode = Node<StoryCanvasNodeData, "story">;
export type StoryCanvasEdge = Edge<StoryCanvasEdgeData>;

export type SubcanvasWorkspaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  manual?: boolean;
};

export type PathBranchingFileItem = {
  id: string;
  label: string;
  detail?: string;
  group: "project" | "runtime" | "scripts" | "sequences" | "events" | "data" | "validation";
};

export type StoryCanvasModel = {
  nodes: StoryCanvasNode[];
  edges: StoryCanvasEdge[];
  files: PathBranchingFileItem[];
  viewport?: Viewport;
  activeSequenceId?: string;
};

type LayoutCursor = {
  sequenceY: number;
  branchY: number;
  eventY: number;
  decisionY: number;
  outcomeY: number;
  supportY: number;
};

const NODE_WIDTH = 230;
const DEFAULT_STORY_NODE_HEIGHT = 108;
// Keep React Flow's selection/interaction box aligned with the beat card's
// CSS layout. Speech beats include the director-note and scene-image rails;
// direction beats only render the stage-direction editor.
// Beat node sizes are intentionally fixed to the default 24 px canvas grid.
// Keep these values independent from the user's grid setting so the authoring
// surface stays visually stable and the default layout lands on whole cells.
export const SPEECH_BEAT_NODE_HEIGHT = 216;
export const DIRECTION_BEAT_NODE_HEIGHT = 144;
const ROUTE_GATE_VISUAL_WIDTH = 34;
const ROUTE_GATE_VISUAL_HEIGHT = 34;
const ROUTE_GATE_LOGIC_WIDTH = 176;
const ROUTE_GATE_LOGIC_HEIGHT = 78;
const ROUTE_GATE_MIN_LOGIC_WIDTH = 120;
const ROUTE_GATE_SOURCE_GAP = 58;
const BRANCH_WIDTH = 390;
const BRANCH_PADDING_TOP = 82;
const BRANCH_PADDING_X = 22;
const BRANCH_EVENT_GAP = 144;
const BRANCH_COLORS = ["#4f8cff", "#2da66f", "#c7832f", "#b062d6", "#d45d78", "#19a7a1", "#8d93ff", "#7ca83a"];
const EVENT_TYPE_COLORS: Record<string, string> = {
  normal: "#4f8cff",
  exploration: "#2da66f",
  final: "#d45d78",
};

export function routeGateVisualAnchorFromLogicPosition(
  position: { x: number; y: number },
  logicWidth = ROUTE_GATE_LOGIC_WIDTH,
  logicHeight = ROUTE_GATE_LOGIC_HEIGHT,
) {
  return {
    x: position.x + (logicWidth - ROUTE_GATE_VISUAL_WIDTH) / 2,
    y: position.y + (logicHeight - ROUTE_GATE_VISUAL_HEIGHT) / 2,
  };
}

export type StoryCanvasNodeColors = Partial<Record<StoryCanvasNodeKind, string>>;

export type StoryCanvasModelOptions = {
  nodeColors?: StoryCanvasNodeColors;
  scope?: CanvasScope;
  gridSize?: number;
  authoringDisplay?: AuthoringDisplaySettings;
  canvasLayerMode?: CanvasLayerMode;
  interfaceLocale?: ConditionUiLocale;
  eventWindowIds?: ReadonlySet<string>;
  pendingEventIds?: ReadonlySet<string>;
};

export type StoryCanvasBounds = { x: number; y: number; width: number; height: number };

type SequenceEventSpatialEntry = { id: string; order: number; x: number; y: number; width: number; height: number };
type SequenceEventSpatialIndex = { byY: SequenceEventSpatialEntry[] };
type CanvasAuthoringNodeMap = NonNullable<BranchingProject["canvas"]>["nodes"];
type CachedSequenceEventSpatialIndex = {
  scopedNodes: CanvasAuthoringNodeMap;
  globalNodes: CanvasAuthoringNodeMap;
  index: SequenceEventSpatialIndex;
};

const sequenceEventSpatialIndexes = new WeakMap<readonly string[], CachedSequenceEventSpatialIndex[]>();

function sequenceEventSpatialIndex(
  project: BranchingProject,
  sequence: BranchingProject["sequences"][number],
  scope: CanvasScope | undefined,
): SequenceEventSpatialIndex {
  const scopedNodes = scope ? project.canvas?.scopes?.[canvasScopeKey(scope)]?.nodes : undefined;
  const globalNodes = project.canvas?.nodes;
  const cached = sequenceEventSpatialIndexes.get(sequence.eventIds)?.find((entry) =>
    entry.scopedNodes === scopedNodes && entry.globalNodes === globalNodes,
  );
  if (cached) return cached.index;

  const byY = sequence.eventIds.map((eventId, order): SequenceEventSpatialEntry => {
    const sequenceEntry = sequence.entryEventId === eventId;
    const fallback = sequenceEntry ? { x: 320, y: 270 } : { x: 360, y: 80 + order * 220 };
    const position = scopedNodes?.[eventId]?.position ?? globalNodes?.[eventId]?.position ?? fallback;
    return { id: eventId, order, x: position.x, y: position.y, width: 460, height: 220 };
  }).sort((left, right) => left.y - right.y || left.order - right.order);
  const index = { byY };
  const entries = sequenceEventSpatialIndexes.get(sequence.eventIds) ?? [];
  entries.push({ scopedNodes, globalNodes, index });
  if (entries.length > 4) entries.shift();
  sequenceEventSpatialIndexes.set(sequence.eventIds, entries);
  return index;
}

function lowerBoundEventY(entries: readonly SequenceEventSpatialEntry[], y: number): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (entries[middle].y < y) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBoundEventY(entries: readonly SequenceEventSpatialEntry[], y: number): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (entries[middle].y <= y) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Returns sequence events intersecting a flow-coordinate viewport plus one viewport of prefetch. */
export function sequenceEventIdsInBounds(
  project: BranchingProject,
  bounds: StoryCanvasBounds,
  scope: CanvasScope | undefined = activeCanvasScope(project),
  overscan = 1,
): string[] {
  if (scope && scope.kind !== "sequence") return [];
  const sequence = scope?.kind === "sequence"
    ? project.sequences.find((candidate) => candidate.id === scope.id) ?? activeSequence(project)
    : activeSequence(project);
  if (!sequence) return [];
  const marginX = Math.max(0, bounds.width * overscan);
  const marginY = Math.max(0, bounds.height * overscan);
  const left = bounds.x - marginX;
  const top = bounds.y - marginY;
  const right = bounds.x + bounds.width + marginX;
  const bottom = bounds.y + bounds.height + marginY;
  const index = sequenceEventSpatialIndex(project, sequence, scope);
  const start = lowerBoundEventY(index.byY, top - 220);
  const end = upperBoundEventY(index.byY, bottom);
  return index.byY.slice(start, end)
    .filter((entry) => entry.x <= right && entry.x + entry.width >= left && entry.y + entry.height >= top)
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.id);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function paletteColor(id: string, palette: string[]) {
  return palette[hashString(id) % palette.length] ?? palette[0];
}

function nodeColor(kind: StoryCanvasNodeKind, options: StoryCanvasModelOptions | undefined) {
  return options?.nodeColors?.[kind];
}

function eventTypeColor(project: BranchingProject, eventNode: EventNode, options?: StoryCanvasModelOptions) {
  const category = project.eventCategories?.find((item) => item.id === eventNode.type);
  return category?.color ?? nodeColor("event", options) ?? EVENT_TYPE_COLORS[eventNode.type] ?? paletteColor(eventNode.type, BRANCH_COLORS);
}

function branchColor(branch: Branch | undefined, branchId: string | undefined | null, options?: StoryCanvasModelOptions) {
  return branch?.color ?? (branchId ? paletteColor(branchId, BRANCH_COLORS) : undefined) ?? nodeColor("branch", options);
}

function positionFor(project: BranchingProject, id: string, x: number, y: number, scope?: CanvasScope) {
  const scoped = scope ? project.canvas?.scopes?.[canvasScopeKey(scope)]?.nodes?.[id]?.position : undefined;
  return scoped ?? project.canvas?.nodes?.[id]?.position ?? { x, y };
}

function pushNode(
  project: BranchingProject,
  nodes: StoryCanvasNode[],
  id: string,
  kind: StoryCanvasNodeKind,
  title: string,
  subtitle: string | undefined,
  x: number,
  y: number,
  badges: string[] = [],
  details: Record<string, unknown> = {},
  options: {
    parentId?: string;
    width?: number;
    height?: number;
    isContainer?: boolean;
    nodeColors?: StoryCanvasNodeColors;
    summaryBadges?: string[];
    infoBadges?: CanvasInfoBadge[];
    scope?: CanvasScope;
    autoPosition?: boolean;
    draggable?: boolean;
    selectable?: boolean;
    zIndex?: number;
  } = {},
) {
  const persisted = project.canvas?.nodes?.[id];
  const scope = options.scope ?? activeCanvasScope(project);
  nodes.push({
    id,
    type: "story",
    position: options.autoPosition ? { x, y } : positionFor(project, id, x, y, scope),
    parentId: options.parentId,
    draggable: options.draggable,
    selectable: options.selectable,
    zIndex: options.zIndex ?? (kind === "workspace" ? 0 : kind === "routeGate" ? 3 : 2),
    data: {
      kind,
      title,
      subtitle,
      storyObjectId: id,
      badges,
      summaryBadges: options.summaryBadges,
      infoBadges: options.infoBadges,
      details,
      accentColor: typeof details.accentColor === "string" ? details.accentColor : nodeColor(kind, { nodeColors: options.nodeColors }),
      branchColor: typeof details.branchColor === "string" ? details.branchColor : undefined,
      minimapColor: typeof details.minimapColor === "string" ? details.minimapColor : undefined,
      collapsed: persisted?.collapsed,
      isContainer: options.isContainer,
    },
    width: options.width ?? NODE_WIDTH,
    height: options.height,
    style: options.width || options.height ? { width: options.width, height: options.height } : undefined,
  });
}

type CanvasLogicOwner = {
  logic?: {
    when?: ConditionInput;
    then?: Consequence[];
    rules?: Array<{ then?: Consequence[] }>;
  };
  availability?: ConditionInput;
  conditions?: ConditionInput;
  displayCondition?: ConditionInput;
  consequences?: Consequence[];
};

const LOGIC_NODE_KINDS = new Set<StoryCanvasNodeKind>([
  "sequence",
  "branch",
  "event",
  "decision",
  "dialogue",
  "dialogueStart",
  "speechBeat",
  "directionBeat",
  "outcome",
]);

function canvasLogicSummary(
  project: BranchingProject,
  kind: StoryCanvasNodeKind,
  details: Record<string, unknown>,
  expanded: boolean,
  locale: ConditionUiLocale = "en",
): StoryCanvasNodeData["logicSummary"] {
  if (!LOGIC_NODE_KINDS.has(kind)) return undefined;
  const owner = [
    details.sequence,
    details.branch,
    details.event,
    details.decision,
    details.dialogue,
    details.start,
    details.beat,
    details.outcome,
  ].find((candidate) => candidate && typeof candidate === "object") as CanvasLogicOwner | undefined;
  const when = owner?.logic?.when ?? owner?.availability ?? owner?.conditions ?? owner?.displayCondition;
  const effects = owner?.logic?.then ?? owner?.consequences ?? [];
  const ruleEffects = owner?.logic?.rules?.reduce((count, rule) => count + (rule.then?.length ?? 0), 0) ?? 0;
  const whenSummary = conditionTreeSummary(project, when, locale, expanded ? 240 : 150);
  const effectLabels = effects.map(consequenceLabel);
  const whenItems = groupedConditionPresentation(project, when, locale, expanded ? 240 : 150);
  const thenItems = presentConsequences(project, effects, expanded ? 3 : 2);
  const effectCount = effects.length + ruleEffects;
  const conditionWarnings = conditionWarningCount(project, when);
  const warningCount = conditionWarnings + thenItems.filter(item => item.status !== "enabled").length;
  return {
    when: whenSummary.clauses || conditionWarnings ? whenSummary.text : "",
    then: effectCount
      ? thenItems.length
        ? `${effectCount} · ${thenItems.map((item) => item.text).join(" · ") || effectLabels.slice(0, 2).join(" · ")}`
        : `${effectCount} ${locale === "es" ? "consecuencia" : "effect"}${effectCount === 1 ? "" : "s"}`
      : "",
    expanded,
    whenItems,
    thenItems,
    warningCount,
    conditionCount: whenSummary.clauses,
    consequenceCount: effectCount,
    ruleCount: owner?.logic?.rules?.length ?? 0,
  };
}

function applyCanvasLogicMode(
  project: BranchingProject,
  model: StoryCanvasModel,
  options: StoryCanvasModelOptions,
): StoryCanvasModel {
  const canvasLayerMode = options.canvasLayerMode ?? "visual";
  const scopeKey = options.scope ? canvasScopeKey(options.scope) : undefined;
  const scopedWaypoints = scopeKey
    ? project.canvas?.scopes?.[scopeKey]?.edgeWaypoints
    : undefined;
  const globalWaypoints = project.canvas?.edgeWaypoints;
  return {
    ...model,
    nodes: model.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        canvasLayerMode,
        authoringLogicSummary: canvasLogicSummary(project, node.data.kind, node.data.details ?? {}, false, options.interfaceLocale),
        logicSummary: canvasLayerMode === "logic"
          ? canvasLogicSummary(project, node.data.kind, node.data.details ?? {}, false, options.interfaceLocale)
          : undefined,
      },
    })),
    edges: model.edges.map((item) => {
      if (!item.data) return item;
      const entryLabel = item.data.label;
      const hideVisualEntryLabel =
        canvasLayerMode === "visual" &&
        item.data.kind === "boundary" &&
        typeof entryLabel === "string" &&
        entryLabel.trim().toLowerCase() === "enters";
      return {
        ...item,
        ...(hideVisualEntryLabel ? { label: undefined } : {}),
        data: {
          ...item.data,
          ...(item.data.kind === "transition"
            ? {
                waypoints: scopedWaypoints && Object.prototype.hasOwnProperty.call(scopedWaypoints, item.id)
                  ? scopedWaypoints[item.id]
                  : globalWaypoints?.[item.id],
              }
            : {}),
          ...(hideVisualEntryLabel ? { label: "" } : {}),
          canvasLayerMode,
        },
        animated: false,
      };
    }),
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  kind: StoryCanvasEdgeKind,
  label: string = kind,
  extra: Partial<StoryCanvasEdgeData> = {},
): StoryCanvasEdge {
  return {
    id,
    source,
    target,
    label,
    data: { kind, label, ...extra },
    animated: false,
  };
}

function transitionCanvasLabel(transition: Transition) {
  return transition.label?.trim() ?? "";
}

type CanvasProjectEventIndex = {
  eventById: Map<string, EventNode>;
  transitionById: Map<string, { event: EventNode; transition: Transition }>;
};

function indexCanvasProjectEvents(project: BranchingProject): CanvasProjectEventIndex {
  const eventById = new Map<string, EventNode>();
  const transitionById = new Map<string, { event: EventNode; transition: Transition }>();
  for (const event of project.events) {
    if (!eventById.has(event.id)) eventById.set(event.id, event);
    for (const transition of event.transitions ?? []) {
      if (!transitionById.has(transition.id)) transitionById.set(transition.id, { event, transition });
    }
  }
  return { eventById, transitionById };
}

function transitionEdgeData(
  project: BranchingProject,
  transition: Transition,
  locale: ConditionUiLocale = "en",
  eventIndex?: CanvasProjectEventIndex,
): Partial<StoryCanvasEdgeData> {
  const role = transition.role ?? (
    transition.mode === "fallback" || transition.conditions || transition.logic?.when || transition.consequences?.length || transition.logic?.then?.length
      ? "route"
      : "flow"
  );
  const conditions = transition.logic?.when ?? transition.conditions;
  const consequences = transition.logic?.then ?? transition.consequences;
  const conditionSummary = conditionTreeSummary(project, conditions, locale, 150);
  const consequenceSummary = (consequences ?? [])
    .map(consequenceLabel)
    .slice(0, 1);
  const conditionItems = groupedConditionPresentation(project, conditions, locale, 150);
  const consequenceItems = presentConsequences(project, consequences, 2);
  const indexedRoute = eventIndex?.transitionById.get(transition.id);
  const owner = indexedRoute?.event ?? (eventIndex ? undefined : project.events.find((event) => event.transitions?.some((route) => route.id === transition.id)));
  const ownerTransition = indexedRoute?.transition ?? (eventIndex ? undefined : owner?.transitions?.find((route) => route.id === transition.id));
  const targetId = ownerTransition?.to ?? transition.to;
  const target = eventIndex?.eventById.get(targetId) ?? (eventIndex ? undefined : project.events.find((event) => event.id === targetId));
  return {
    routeRole: role,
    conditions,
    consequences,
    order: transition.order ?? 0,
    mode: transition.mode ?? "conditional",
    customLabel: transition.label ?? "",
    routeSourceId: transition.from,
    routeTargetId: targetId,
    routeTargetLabel: target?.name ?? targetId,
    returnRoute: targetId === owner?.id || targetId === owner?.parentEventId,
    routePreview: role === "route" || conditionSummary.clauses > 0 || (consequences?.length ?? 0) > 0 || conditionWarningCount(project, conditions) > 0 ? {
      mode: transition.mode ?? "conditional",
      conditions: conditionItems.length ? conditionItems.map((item) => item.text) : conditionSummary.clauses || conditionWarningCount(project, conditions) ? [conditionSummary.text] : [],
      consequences: consequenceItems.length ? consequenceItems.map((item) => item.text) : consequenceSummary,
      conditionItems,
      consequenceItems,
      warningCount: conditionWarningCount(project, conditions) + consequenceItems.filter(item => item.status !== "enabled").length,
    } : undefined,
  };
}

function decisionOutcomeNodeId(eventId: string, decisionId: string, outcomeId: string) {
  return `outcome:${eventId}:${decisionId}:${outcomeId}`;
}

function decisionOptions(project: BranchingProject, eventId: string, decision: NonNullable<EventNode["decisions"]>[number], locale: ConditionUiLocale = "en") {
  return decision.outcomes.map((outcome) => ({
    id: outcome.id,
    name: outcome.visibleText ?? outcome.name,
    visibleText: outcome.visibleText,
    description: outcome.description,
    icon: outcome.icon,
    handleId: decisionOutcomeNodeId(eventId, decision.id, outcome.id),
    logicSummary: canvasLogicSummary(project, "outcome", { outcome }, false, locale),
    unavailableBehavior: outcome.unavailableBehavior ?? "locked",
  }));
}

function visualTransitionSource(
  event: EventNode,
  transition: Transition,
): { nodeId: string; handleId?: string } {
  const decision = event.decisions?.find((candidate) =>
    candidate.outcomes.some(
      (outcome) => decisionOutcomeNodeId(event.id, candidate.id, outcome.id) === transition.from,
    ),
  );
  return decision
    ? { nodeId: `decision:${event.id}:${decision.id}`, handleId: transition.from }
    : { nodeId: transition.from };
}

function transitionEdge(
  project: BranchingProject,
  event: EventNode,
  transition: Transition,
  locale: ConditionUiLocale = "en",
  eventIndex?: CanvasProjectEventIndex,
): StoryCanvasEdge {
  const source = visualTransitionSource(event, transition);
  const resultUse = event.interactionUses?.find(use => interactionNodeId(event.id, use.id) === transition.from);
  const resultIds = new Set<string>();
  walkConditions(transition.logic?.when ?? transition.conditions, condition => {
    if (condition.type === "interactionResult" && condition.useId === resultUse?.id && condition.operator === "==" && typeof condition.resultId === "string") resultIds.add(condition.resultId);
  });
  const resultId = resultIds.size === 1 ? Array.from(resultIds)[0] : undefined;
  return {
    ...edge(
      `edge:transition:${transition.id}`,
      source.nodeId,
      transition.to,
      "transition",
      transitionCanvasLabel(transition),
      transitionEdgeData(project, transition, locale, eventIndex),
    ),
    sourceHandle: resultId ? `interaction-result:${resultId}` : source.handleId,
    animated: transition.role === "route",
  };
}

/**
 * Projects transition edges into their final canvas representation.
 *
 * A route is stored once in the domain model, but a split is displayed as an
 * input edge into a gate plus one gate-to-destination edge per route. Keeping
 * this projection immutable prevents the old decision-style direct edges from
 * surviving beside (or partially overwriting) their gate equivalents.
 */
function projectRouteGates(
  project: BranchingProject,
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  scope: CanvasScope | undefined,
  options: StoryCanvasModelOptions,
  routeEvents: EventNode[] = project.events,
) {
  const nodeById = new Map<string, StoryCanvasNode>();
  for (const node of nodes) {
    if (!nodeById.has(node.id)) nodeById.set(node.id, node);
  }
  const ownerEventIdBySource = new Map<string, string>();
  for (const event of routeEvents) {
    for (const transition of event.transitions ?? []) {
      if (!ownerEventIdBySource.has(transition.from)) ownerEventIdBySource.set(transition.from, event.id);
    }
  }
  const shouldProjectGate = (_routeSourceId: string, routes: StoryCanvasEdge[]) =>
    routes.length >= 2;
  const transitionGroups = new Map<string, StoryCanvasEdge[]>();
  const directInteractionResultEdges: StoryCanvasEdge[] = [];
  edges
    .filter((item) => item.data?.kind === "transition")
    .forEach((item) => {
      if (item.sourceHandle?.startsWith("interaction-result:")) {
        directInteractionResultEdges.push(item);
        return;
      }
      const routeSourceId =
        typeof item.data?.routeSourceId === "string"
          ? item.data.routeSourceId
          : item.source;
      const group = transitionGroups.get(routeSourceId);
      if (group) group.push(item);
      else transitionGroups.set(routeSourceId, [item]);
    });

  const ownerEventIdForSource = (routeSourceId: string) =>
    ownerEventIdBySource.get(routeSourceId) ?? (scope?.kind === "event" ? scope.id : scope?.kind === "dialogue" ? scope.eventId : undefined);

  const finalTransitionEdges: StoryCanvasEdge[] = [];
  const gateInputEdges: StoryCanvasEdge[] = [];

  const projectGate = (routeSourceId: string, routes: StoryCanvasEdge[]) => {
    const sourceId = routes[0]?.source ?? routeSourceId;
    const source = nodeById.get(sourceId);
    if (!source) {
      finalTransitionEdges.push(...routes);
      return;
    }

    const ownerEventId = ownerEventIdForSource(routeSourceId);
    // A source id is not globally unique in older projects (notably legacy
    // dialogue beats). Include its owning event in the projection id so two
    // independent splits can never share one React Flow node or position.
    const gateId = `route-gate:${ownerEventId ?? "unscoped"}:${routeSourceId}`;
    const legacyGateId = `route-gate:${routeSourceId}`;
    const scopeNodes = scope
      ? project.canvas?.scopes?.[canvasScopeKey(scope)]?.nodes
      : project.canvas?.nodes;
    const storedGateState =
      scopeNodes?.[gateId] ??
      project.canvas?.nodes?.[gateId] ??
      // Preserve positions saved before gate ids became owner-qualified.
      scopeNodes?.[legacyGateId] ??
      project.canvas?.nodes?.[legacyGateId];
    const storedGatePosition = storedGateState?.position;
    // Canvas snapshots include route gates when any node is moved. Keep that
    // anchor stable so dragging a source or destination cannot recalculate it.
    const hasStoredGateAnchor = Boolean(
      storedGatePosition &&
      (storedGateState?.manual || storedGateState?.positionPinned),
    );
    const forwardTargets = [...new Set(routes
      .filter((route) => route.data?.returnRoute !== true)
      .map((route) => route.target))]
      .map((targetId) => nodes.find((node) => node.id === targetId))
      .filter((target): target is StoryCanvasNode => Boolean(target && target.position.x > source.position.x));
    const sourceCenter = source.position.y + (source.height ?? source.measured?.height ?? DEFAULT_STORY_NODE_HEIGHT) / 2;
    const visualPosition = hasStoredGateAnchor && storedGatePosition
      ? storedGatePosition
      : { x: source.position.x + (source.width ?? NODE_WIDTH) + ROUTE_GATE_SOURCE_GAP, y: sourceCenter - ROUTE_GATE_VISUAL_HEIGHT / 2 };
    const visualCenter = {
      x: visualPosition.x + ROUTE_GATE_VISUAL_WIDTH / 2,
      y: visualPosition.y + ROUTE_GATE_VISUAL_HEIGHT / 2,
    };
    const logicMode = options.canvasLayerMode === "logic";
    const sourceRight = source.position.x + (source.width ?? NODE_WIDTH);
    const nearestForwardTargetLeft = forwardTargets.length
      ? Math.min(...forwardTargets.map((target) => target.position.x))
      : undefined;
    const availableRouteGap = nearestForwardTargetLeft === undefined
      ? undefined
      : nearestForwardTargetLeft - sourceRight;
    const fitsBetweenNodes = availableRouteGap !== undefined && availableRouteGap >= ROUTE_GATE_MIN_LOGIC_WIDTH + 16;
    const gateWidth = logicMode
      ? fitsBetweenNodes
        ? Math.min(ROUTE_GATE_LOGIC_WIDTH, availableRouteGap - 16)
        : ROUTE_GATE_LOGIC_WIDTH
      : ROUTE_GATE_VISUAL_WIDTH;
    const gateHeight = logicMode ? ROUTE_GATE_LOGIC_HEIGHT : ROUTE_GATE_VISUAL_HEIGHT;
    const gatePosition = logicMode
      ? hasStoredGateAnchor && storedGatePosition
        ? {
            x: visualCenter.x - gateWidth / 2,
            y: visualCenter.y - gateHeight / 2,
          }
        : { x: sourceRight + ROUTE_GATE_SOURCE_GAP, y: sourceCenter - gateHeight / 2 }
      : visualPosition;
    const orderedRoutes = [...routes].sort((left, right) => {
      if (left.data?.mode === "fallback" && right.data?.mode !== "fallback") return 1;
      if (right.data?.mode === "fallback" && left.data?.mode !== "fallback") return -1;
      return Number(left.data?.order ?? 0) - Number(right.data?.order ?? 0);
    });
    const conditionalCount = orderedRoutes.filter((route) => conditionCount(route.data?.conditions) > 0).length;
    const routeInteractionUseIds = new Set<string>();
    orderedRoutes.forEach((route) => walkConditions(route.data?.conditions, (condition) => {
      if (condition.type === "interactionResult" && typeof condition.useId === "string") {
        routeInteractionUseIds.add(condition.useId);
      }
    }));
    const routeOwnerEvent = project.events.find((eventNode) => eventNode.id === ownerEventId);
    const sourceInteractionUseIds = (routeOwnerEvent?.interactionUses ?? [])
      .filter((use) => use.ownerNodeId === routeSourceId || interactionNodeId(ownerEventId ?? "", use.id) === routeSourceId)
      .map((use) => use.id);
    const interactionCount = new Set([...routeInteractionUseIds, ...sourceInteractionUseIds]).size;
    const conditionBadges = Array.from(
      new Set(routes.flatMap((route) => conditionLabels(route.data?.conditions))),
    ).slice(0, 2);
    const consequenceBadges = Array.from(
      new Set(routes.flatMap((route) => (route.data?.consequences ?? []).map(consequenceLabel))),
    ).slice(0, 2);
    pushNode(
      project,
      nodes,
      gateId,
      "routeGate",
      "Conditions",
      orderedRoutes.length ? `${orderedRoutes.length} routes` : "No routes yet",
      gatePosition.x,
      gatePosition.y,
      [
        `${orderedRoutes.length} routes`,
        ...(conditionalCount ? [`${conditionalCount} conditional`] : []),
        ...conditionBadges,
        ...consequenceBadges,
      ],
      {
        routeSourceId,
        conditionCount: conditionalCount,
        interactionCount,
        eventId: ownerEventId,
        transitionIds: orderedRoutes.map((route) => route.id),
        logicWidth: gateWidth,
        routeOptions: orderedRoutes.map((route, index) => {
          const preview = route.data?.routePreview as {
            conditionItems?: LogicPresentation[];
            conditions?: string[];
          } | undefined;
          return {
            id: route.id,
            index,
            mode: route.data?.mode === "fallback" ? "fallback" : "conditional",
            label: `${options.interfaceLocale === "es" ? "Ruta" : "Route"} ${index + 1}`,
            condition: preview?.conditionItems?.[0]?.text ?? preview?.conditions?.[0] ?? conditionUiCopy(options.interfaceLocale).always,
            conditionConfigured: conditionCount(route.data?.conditions) > 0,
            targetId: typeof route.data?.routeTargetId === "string" ? route.data.routeTargetId : route.target,
            targetLabel: typeof route.data?.routeTargetLabel === "string"
              ? route.data.routeTargetLabel
              : nodes.find((node) => node.id === route.target)?.data.title ?? route.target,
          };
        }),
        junctionPresentation: options.canvasLayerMode === "logic" ? "gate" : "split",
      },
      {
        nodeColors: options.nodeColors,
        scope,
        // Visual mode keeps the junction as a compact, draggable knot. Logic
        // mode turns the same junction into a concise informational gate.
        width: gateWidth,
        height: gateHeight,
        autoPosition: true,
      },
    );

    if (!routes.length) return;
    const sourceHandle = routes[0]?.sourceHandle;
    gateInputEdges.push({
      ...edge(`edge:route-gate:${gateId}`, sourceId, gateId, "contains", ""),
      // Interaction nodes have hidden, result-specific handles in the compact
      // Logic view. Point the shared gate input at their stable general output
      // handle so it cannot resolve to a collapsed result handle at (0, 0).
      // Decision outcomes keep their explicit per-option handle.
      sourceHandle: sourceHandle ?? (source.data.kind === "interaction" ? "interaction:output" : undefined),
    });
    finalTransitionEdges.push(
      ...orderedRoutes.map((route, routeIndex) => ({
        ...route,
        source: gateId,
        sourceHandle: "route:output",
        data: route.data
          ? {
              ...route.data,
              routeIndex,
              routeCount: orderedRoutes.length,
              routeGateId: gateId,
            }
          : route.data,
      })),
    );
  };

  transitionGroups.forEach((routes, routeSourceId) => {
    // Gates represent splits. A single route remains a direct connection.
    if (shouldProjectGate(routeSourceId, routes)) {
      projectGate(routeSourceId, routes);
    } else {
      finalTransitionEdges.push(...routes);
    }
  });
  const nonTransitionEdges = edges.filter((item) => item.data?.kind !== "transition");
  edges.splice(0, edges.length, ...nonTransitionEdges, ...directInteractionResultEdges, ...gateInputEdges, ...finalTransitionEdges);
}

function boundaryPortId(eventId: string, direction: "input" | "output", ownerId: string) {
  return `boundary:${eventId}:${direction}:${ownerId}`;
}

function canonLabel(project: BranchingProject, id: string) {
  const ref = project.canonRefs.find((canonRef) => canonRef.id === id);
  return ref?.kind ? `${ref.kind}: ${id}` : id;
}

function scriptSubtitle(script: ScriptRef) {
  return [script.format.toUpperCase(), script.entrySection ? `entry ${script.entrySection}` : undefined]
    .filter(Boolean)
    .join(" - ");
}

function logicBadges(availability: ConditionInput | undefined, consequenceCount = 0) {
  return [
    ...(conditionCount(availability) > 0 ? ["conditional"] : []),
    ...(consequenceCount > 0 ? [`${consequenceCount} effects`] : []),
  ];
}

function dataUseBadges(project: BranchingProject, input: ConditionInput | undefined) {
  const badges = new Set<string>();
  walkConditions(input, (condition) => {
    if (
      (condition.type === "dataObjectExists" || condition.type === "dataObjectField") &&
      project.projectDataObjects?.some((dataObject) => dataObject.id === condition.objectId)
    ) {
      badges.add("uses data");
    }
  });
  return Array.from(badges);
}

function activeSequence(project: BranchingProject) {
  const preferredId = project.canvas?.activeSequenceId ?? project.entrySequenceId ?? project.sequences[0]?.id;
  return project.sequences.find((sequence) => sequence.id === preferredId) ?? project.sequences[0];
}

function branchesForSequence(project: BranchingProject, sequenceId: string | undefined) {
  const sequence = project.sequences.find((item) => item.id === sequenceId);
  if (!sequence) {
    return [];
  }

  if (sequence.branchIds?.length) {
    const branchIds = new Set(sequence.branchIds);
    return project.branches.filter((branch) => branchIds.has(branch.id));
  }

  const sequenceEventIds = new Set(sequence.eventIds);
  return project.branches.filter((branch) =>
    branch.eventIds.some((eventId) => sequenceEventIds.has(eventId)) ||
    project.events.some((eventNode) => eventNode.branchRef === branch.id && sequenceEventIds.has(eventNode.id)),
  );
}

function eventBadges(project: BranchingProject, eventNode: EventNode) {
  const category = project.eventCategories?.find((item) => item.id === eventNode.type);
  const canonRefCount = eventNode.canonRefs?.length ?? 0;
  const categoryLabel = eventNode.type !== "normal"
    ? category?.label ?? eventNode.type
    : undefined;
  return [
    ...(categoryLabel ? [categoryLabel] : []),
    ...(canonRefCount > 0 ? [`${canonRefCount} refs`] : []),
    ...(eventNode.script ? ["ink"] : []),
    ...(eventNode.consequences?.length ? ["unlocks"] : []),
    ...logicBadges(eventNode.availability, eventNode.consequences?.length ?? 0),
    ...dataUseBadges(project, eventNode.availability),
  ];
}

function eventTextCounts(project: BranchingProject, eventNode: EventNode) {
  const primaryLocale = project.localizationCatalog?.primaryLocale ?? "und";
  const beats = [
    ...(eventNode.dialogueBeats ?? []),
    ...(eventNode.dialogues ?? []).flatMap((dialogue) => dialogue.beats ?? []),
  ];
  const seenBlocks = new Set<string>();
  return beats.reduce((counts, beat) => {
    const blockKey = `${beat.blockRef.scriptId}:${beat.blockRef.blockId}`;
    if (seenBlocks.has(blockKey)) return counts;
    seenBlocks.add(blockKey);
    const document = project.scriptDocuments?.find((candidate) => candidate.id === beat.blockRef.scriptId);
    const block = document?.blocks.find((candidate) => candidate.id === beat.blockRef.blockId);
    if (!block) return counts;
    const text = localizedValue(blockValues(project, beat.blockRef.scriptId, block, primaryLocale), primaryLocale, primaryLocale);
    return {
      words: counts.words + (text.trim() ? text.trim().split(/\s+/u).length : 0),
      characters: counts.characters + Array.from(text).length,
    };
  }, { words: 0, characters: 0 });
}

function authoringDisplaySettings(options: StoryCanvasModelOptions) {
  return {
    showDecisionCount: options.authoringDisplay?.showDecisionCount ?? true,
    showOutcomeCount: options.authoringDisplay?.showOutcomeCount ?? true,
    showDialogueCount: options.authoringDisplay?.showDialogueCount ?? true,
    showCharacterCount: options.authoringDisplay?.showCharacterCount ?? true,
    showWordCount: options.authoringDisplay?.showWordCount ?? false,
  };
}

function eventInfoBadges(project: BranchingProject, eventNode: EventNode, options: StoryCanvasModelOptions): CanvasInfoBadge[] {
  const display = authoringDisplaySettings(options);
  const decisionCount = eventNode.decisions?.length ?? 0;
  const outcomeCount = eventNode.decisions?.reduce((count, decision) => count + decision.outcomes.length, 0) ?? 0;
  const dialogueCount = (eventNode.dialogues?.length ?? 0) + (eventNode.dialogueBeats?.length ?? 0);
  const textCounts = eventTextCounts(project, eventNode);
  return [
    ...(display.showDecisionCount && decisionCount > 0 ? [{ kind: "decisions" as const, count: decisionCount }] : []),
    ...(display.showOutcomeCount && outcomeCount > 0 ? [{ kind: "outcomes" as const, count: outcomeCount }] : []),
    ...(display.showDialogueCount && dialogueCount > 0 ? [{ kind: "dialogues" as const, count: dialogueCount }] : []),
    ...(display.showCharacterCount && textCounts.characters > 0 ? [{ kind: "characters" as const, count: textCounts.characters }] : []),
    ...(display.showWordCount && textCounts.words > 0 ? [{ kind: "words" as const, count: textCounts.words }] : []),
  ];
}

function dialogueBadges(project: BranchingProject, dialogue: DialogueNode) {
  return [
    ...(dialogue.speakerRef ? ["speaker"] : []),
    ...(dialogue.canonRefs?.length ? [`${dialogue.canonRefs.length} refs`] : []),
    ...logicBadges(dialogue.availability, dialogue.consequences?.length ?? 0),
    ...dataUseBadges(project, dialogue.availability),
  ];
}

function dialogueInfoBadges(eventNode: EventNode, dialogue: DialogueNode): CanvasInfoBadge[] {
  const members = dialogue.members ?? [];
  const beatCount = members.length
    ? members.filter((member) => member.kind === "beat").length
    : dialogue.beats?.length ?? 0;
  const memberDecisionIds = new Set(
    members.filter((member) => member.kind === "decision").map((member) => member.id),
  );
  const decisionCount = members.filter((member) => member.kind === "decision").length
    + (eventNode.decisions ?? []).filter(
      (decision) => decision.dialogueId === dialogue.id && !memberDecisionIds.has(decision.id),
    ).length;

  return [
    ...(beatCount > 0 ? [{ kind: "lines" as const, count: beatCount }] : []),
    ...(decisionCount > 0 ? [{ kind: "decisions" as const, count: decisionCount }] : []),
  ];
}

function parentLevelInboundTransitions(project: BranchingProject, eventId: string) {
  const parent = project.events.find((eventNode) => eventNode.id === eventId);
  const childIds = new Set([
    ...(parent?.childEventIds ?? []),
    ...project.events.filter((eventNode) => eventNode.parentEventId === eventId).map((eventNode) => eventNode.id),
  ]);
  return project.events.flatMap((eventNode) =>
    (eventNode.transitions ?? [])
      .filter((transition) => transition.to === eventId && !childIds.has(eventNode.id))
      .map((transition) => ({ event: eventNode, transition })),
  );
}

function eventBranchLabel(project: BranchingProject, eventNode: EventNode) {
  const branch = eventNode.branchRef
    ? project.branches.find((candidate) => candidate.id === eventNode.branchRef)
    : undefined;
  return branch?.title ? `Branch · ${branch.title}` : "No branch";
}

function buildEventBoundaryPorts(project: BranchingProject, eventNode: EventNode) {
  const routeSubtitle = (event: EventNode | undefined) => {
    if (!event) return "Unavailable event";
    return eventBranchLabel(project, event);
  };
  const inbound = [
    ...parentLevelInboundTransitions(project, eventNode.id).map(({ event, transition }) => ({
      id: boundaryPortId(eventNode.id, "input", transition.id),
      direction: "input" as const,
      title: event.name,
      subtitle: routeSubtitle(event),
      transitionId: transition.id,
      targetEventId: undefined,
    })),
    ...project.sequences
      .filter((sequence) => sequence.entryEventId === eventNode.id)
      .map((sequence) => ({
        id: boundaryPortId(eventNode.id, "input", `sequence-entry:${sequence.id}`),
        direction: "input" as const,
        title: sequence.name || "Story entry",
        subtitle: "Sequence entry",
        transitionId: undefined,
        targetEventId: undefined,
      })),
  ];
  // Keep legacy Entry bindings addressable. They are still the source nodes
  // for existing Route Gates even when the visible incoming route is supplied
  // by a sequence start or another parent event.
  const preservedBoundInputs = Array.from(
    new Set(
      (eventNode.boundaryBindings ?? [])
        .filter((binding) => binding.direction === "input")
        .map((binding) => binding.portId),
    ),
  )
    .filter((portId) => !inbound.some((port) => port.id === portId))
    .map((portId) => ({
      id: portId,
      direction: "input" as const,
      title: inbound[0]?.title ?? "No incoming route",
      subtitle: inbound[0]?.subtitle ?? "Connect a parent event",
      transitionId: undefined,
      targetEventId: undefined,
    }));
  const allInbound = [...inbound, ...preservedBoundInputs];
  const scopeKey = canvasScopeKey({ kind: "event", id: eventNode.id });
  const entrySlots = project.canvas?.scopes?.[scopeKey]?.entrySlots ?? [];
  const emptyInputs = entrySlots.map((slotId) => ({
    id: boundaryPortId(eventNode.id, "input", slotId),
    slotId,
    direction: "input" as const,
    title: "Add Entry",
    subtitle: "Choose an existing or new source event",
    transitionId: undefined,
    targetEventId: undefined,
  }));
  // Local content routes enter this canvas; only external destinations need
  // End ports. Keep unknown destinations visible so broken routes can be fixed.
  const internalTargets = new Set([
    ...(eventNode.interactionUses ?? []).filter(u => !u.ownerNodeId).map(u => `interaction:${eventNode.id}:${u.id}`),
    ...(eventNode.interactionBarriers ?? []).map(b => `barrier:${eventNode.id}:${b.id}`),
    ...project.events.filter((event) => event.parentEventId === eventNode.id || eventNode.childEventIds?.includes(event.id)).map((event) => event.id),
    ...(eventNode.decisions ?? []).flatMap((decision) => [
      `decision:${eventNode.id}:${decision.id}`,
      ...decision.outcomes.map((outcome) => decisionOutcomeNodeId(eventNode.id, decision.id, outcome.id)),
    ]),
    ...(eventNode.dialogues ?? []).map((dialogue) => `dialogue:${eventNode.id}:${dialogue.id}`),
    ...[...(eventNode.dialogueBeats ?? []), ...(eventNode.dialogues ?? []).flatMap((dialogue) => dialogue.beats ?? [])]
      .map((beat) => `beat:${eventNode.id}:${beat.id}`),
    ...(eventNode.dialogueStarts ?? []).map((start) => `dialogue-start:${eventNode.id}:${start.id}`),
  ]);
  const outbound = (eventNode.transitions ?? [])
    .filter((transition) => transition.from === eventNode.id && !internalTargets.has(transition.to))
    .map((transition) => {
      const target = project.events.find((event) => event.id === transition.to);
      return {
        id: boundaryPortId(eventNode.id, "output", transition.id),
        slotId: undefined,
        direction: "output" as const,
        title: target?.name ?? transition.to,
        subtitle: routeSubtitle(target),
        transitionId: transition.id,
        targetEventId: transition.to,
      };
    });

  // A return is a shared output for authored routes from this event's content
  // or child events back to the event currently being edited.
  const childEventIds = new Set([
    ...(eventNode.childEventIds ?? []),
    ...project.events
      .filter((candidate) => candidate.parentEventId === eventNode.id)
      .map((candidate) => candidate.id),
  ]);
  const restartTransition = [
    ...(eventNode.transitions ?? []).filter((transition) => transition.from !== eventNode.id),
    ...project.events
      .filter((candidate) => childEventIds.has(candidate.id))
      .flatMap((candidate) => candidate.transitions ?? []),
  ].find((transition) => transition.to === eventNode.id);
  const restartOutput = {
    id: boundaryPortId(eventNode.id, "output", "restart"),
    slotId: "restart",
    direction: "output" as const,
    title: eventNode.name,
    subtitle: "Re-enter this event",
    transitionId: restartTransition?.id,
    targetEventId: eventNode.id,
    restart: true,
  };

  const exitSlots = project.canvas?.scopes?.[scopeKey]?.exitSlots ?? [];
  const emptySlotIds = outbound.length === 0
    ? exitSlots.length ? exitSlots : ["exit"]
    : exitSlots;
  const emptyOutputs = emptySlotIds.map((slotId) => ({
    id: boundaryPortId(eventNode.id, "output", slotId),
    slotId,
    direction: "output" as const,
    title: "Add End",
    subtitle: "Choose an existing or new event",
    transitionId: undefined,
    targetEventId: undefined,
  }));

  return {
    inbound: allInbound.length || emptyInputs.length
      ? [...allInbound, ...emptyInputs]
      : [
          {
            id: boundaryPortId(eventNode.id, "input", "entry"),
            direction: "input" as const,
            title: "No incoming route",
            subtitle: "Connect a parent event",
            transitionId: undefined,
            targetEventId: undefined,
          },
        ],
    outbound: [...(restartTransition ? [restartOutput] : []), ...outbound, ...emptyOutputs],
  };
}

function boundaryPortPosition(
  nodes: StoryCanvasNode[],
  direction: "input" | "output",
  index: number,
  count: number,
) {
  const content = nodes.filter((node) => node.data.kind !== "boundary");
  const left = content.length
    ? Math.min(...content.map((node) => node.position.x))
    : 380;
  const right = content.length
    ? Math.max(...content.map((node) => node.position.x + (node.width ?? NODE_WIDTH)))
    : 610;
  const top = content.length
    ? Math.min(...content.map((node) => node.position.y))
    : 90;
  const bottom = content.length
    ? Math.max(...content.map((node) => node.position.y + (node.height ?? 108)))
    : 270;
  const centerY = (top + bottom) / 2;

  return {
    x: direction === "input" ? left - 250 : right + 72,
    y: centerY - 53 + (index - (count - 1) / 2) * 112,
  };
}

const SUBCANVAS_WORKSPACE_MIN_WIDTH = 720;
const SUBCANVAS_WORKSPACE_MIN_HEIGHT = 460;

function subcanvasGridPadding(gridSize = 24) {
  const padding = Math.max(1, gridSize);
  return { x: padding, y: padding };
}

function subcanvasContent(nodes: StoryCanvasNode[]) {
  return nodes.filter(
    (node) =>
      node.data.kind !== "boundary" &&
      node.data.kind !== "workspace" &&
      node.data.kind !== "endAdder",
  );
}

function boundsForNodes(nodes: StoryCanvasNode[], gridSize = 24): SubcanvasWorkspaceBounds {
  if (!nodes.length) {
    return { x: 220, y: 40, width: SUBCANVAS_WORKSPACE_MIN_WIDTH, height: SUBCANVAS_WORKSPACE_MIN_HEIGHT };
  }
  const contentBounds = contentBoundsForNodes(nodes, gridSize);
  return {
    ...contentBounds,
    width: Math.max(SUBCANVAS_WORKSPACE_MIN_WIDTH, contentBounds.width),
    height: Math.max(SUBCANVAS_WORKSPACE_MIN_HEIGHT, contentBounds.height),
  };
}

function contentBoundsForNodes(nodes: StoryCanvasNode[], gridSize = 24): SubcanvasWorkspaceBounds {
  const left = Math.min(...nodes.map((node) => node.position.x));
  const right = Math.max(...nodes.map((node) => node.position.x + (node.width ?? NODE_WIDTH)));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const bottom = Math.max(...nodes.map((node) => node.position.y + (node.height ?? 108)));
  const padding = subcanvasGridPadding(gridSize);
  const x = left - padding.x;
  const y = top - padding.y;
  return {
    x,
    y,
    width: right - left + padding.x * 2,
    height: bottom - top + padding.y * 2,
  };
}

/**
 * Fits a nested working area to its visible content with an explicit amount
 * of grid-based breathing room. Unlike the default workspace projection, this
 * is only used when the author invokes the advanced canvas tool.
 */
export function fitSubcanvasWorkspaceBounds(
  nodes: StoryCanvasNode[],
  paddingGridPoints = 2,
  gridSize = 24,
): SubcanvasWorkspaceBounds {
  const content = subcanvasContent(nodes);
  if (!content.length) {
    return { x: 220, y: 40, width: SUBCANVAS_WORKSPACE_MIN_WIDTH, height: SUBCANVAS_WORKSPACE_MIN_HEIGHT };
  }
  const padding = Math.max(0, Math.round(paddingGridPoints)) * Math.max(1, gridSize);
  const left = Math.min(...content.map((node) => node.position.x));
  const right = Math.max(...content.map((node) => node.position.x + (node.width ?? NODE_WIDTH)));
  const top = Math.min(...content.map((node) => node.position.y));
  const bottom = Math.max(...content.map((node) => node.position.y + (node.height ?? 108)));
  return {
    x: left - padding,
    y: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
  };
}

function expandedWorkspaceBounds(
  workspace: SubcanvasWorkspaceBounds,
  content: StoryCanvasNode[],
  gridSize = 24,
): SubcanvasWorkspaceBounds {
  if (!content.length) return workspace;
  const contentBounds = contentBoundsForNodes(content, gridSize);
  const x = Math.min(workspace.x, contentBounds.x);
  const y = Math.min(workspace.y, contentBounds.y);
  const right = Math.max(workspace.x + workspace.width, contentBounds.x + contentBounds.width);
  const bottom = Math.max(workspace.y + workspace.height, contentBounds.y + contentBounds.height);
  return { x, y, width: right - x, height: bottom - y };
}

export function layoutSubcanvasNodes(
  nodes: StoryCanvasNode[],
  options: { preserveWorkspace?: boolean; gridSize?: number } = {},
): StoryCanvasNode[] {
  const workspaceNode = nodes.find((node) => node.data.kind === "workspace");
  if (!workspaceNode) return nodes;

  const currentWorkspace = {
    x: workspaceNode.position.x,
    y: workspaceNode.position.y,
    width: workspaceNode.width ?? SUBCANVAS_WORKSPACE_MIN_WIDTH,
    height: workspaceNode.height ?? SUBCANVAS_WORKSPACE_MIN_HEIGHT,
  };
  // Default canvas behavior keeps its current dimensions and only grows when
  // content reaches an edge. Authors can use the explicit Fit tool when they
  // want to shrink it back around their nodes.
  const workspace = options.preserveWorkspace
    ? currentWorkspace
    : expandedWorkspaceBounds(currentWorkspace, subcanvasContent(nodes), options.gridSize);
  const boundaryY = (node: StoryCanvasNode) => Math.min(
    workspace.y + workspace.height - (node.height ?? 106),
    Math.max(workspace.y, node.position.y),
  );
  return nodes.map((node) => {
    if (node.id === workspaceNode.id) {
      if (node.position.x === workspace.x && node.position.y === workspace.y && node.width === workspace.width && node.height === workspace.height && node.style?.width === workspace.width && node.style?.height === workspace.height) return node;
      return {
        ...node,
        position: { x: workspace.x, y: workspace.y },
        width: workspace.width,
        height: workspace.height,
        style: { ...node.style, width: workspace.width, height: workspace.height },
      };
    }
    if (node.data.kind === "endAdder") {
      const direction = node.data.details?.direction === "input" ? "input" : "output";
      const width = node.width ?? 48;
      const position = {
        x: direction === "input" ? workspace.x - width : workspace.x + workspace.width,
        y: workspace.y,
      };
      const height = workspace.height;
      if (
        node.position.x === position.x &&
        node.position.y === position.y &&
        node.width === width &&
        node.height === height &&
        node.style?.width === width &&
        node.style?.height === height
      ) return node;
      return {
        ...node,
        position,
        width,
        height,
        style: { ...node.style, width, height },
      };
    }
    if (node.data.kind !== "boundary") return node;
    // Authored return ports are draggable in both axes. Keep their stored
    // position instead of snapping them back to the workspace's outer edge;
    // ordinary entry and exit ports remain attached to the frame.
    if (node.data.details?.restart === true || node.data.details?.returnRoute === true) return node;
    const direction = node.data.details?.direction === "output" ? "output" : "input";
    const position = {
      x: direction === "input"
        ? workspace.x - (node.width ?? 210)
        : workspace.x + workspace.width,
      y: boundaryY(node),
    };
    if (node.position.x === position.x && node.position.y === position.y) return node;
    return {
      ...node,
      position,
    };
  });
}

function addSubcanvasWorkspace(
  project: BranchingProject,
  nodes: StoryCanvasNode[],
  scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>,
  options: StoryCanvasModelOptions,
) {
  const savedBounds = project.canvas?.scopes?.[canvasScopeKey(scope)]?.workspace;
  const bounds = savedBounds?.manual
    ? savedBounds
    : savedBounds
      ? expandedWorkspaceBounds(savedBounds, subcanvasContent(nodes), options.gridSize)
      : boundsForNodes(subcanvasContent(nodes), options.gridSize);
  pushNode(
    project,
    nodes,
    `workspace:${canvasScopeKey(scope)}`,
    "workspace",
    "",
    undefined,
    bounds.x,
    bounds.y,
    [],
    { scope, minimapColor: "var(--wn-editor-bg)", minimapStrokeColor: "var(--wn-accent)" },
    {
      scope,
      autoPosition: true,
      draggable: false,
      // The working area is a visual guide, not a canvas item. Keeping it out
      // of React Flow's selectable set prevents marquee selection from
      // selecting the whole area when the user drags over its contents. The
      // resize handles opt back into pointer events in the node component.
      selectable: false,
      width: bounds.width,
      height: bounds.height,
      zIndex: 0,
    },
  );
  return layoutSubcanvasNodes(nodes, {
    preserveWorkspace: Boolean(savedBounds?.manual),
    gridSize: options.gridSize,
  });
}

function branchHeight(branch: Branch) {
  return Math.max(230, BRANCH_PADDING_TOP + Math.max(1, branch.eventIds.length) * BRANCH_EVENT_GAP + 24);
}

function addOutcomeNodes(
  project: BranchingProject,
  event: EventNode,
  outcome: Outcome,
  decisionId: string,
  outcomeIndex: number,
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  cursor: LayoutCursor,
  options: StoryCanvasModelOptions,
) {
  const outcomeId = `outcome:${event.id}:${decisionId}:${outcome.id}`;
  const availability = outcome.availability ?? outcome.conditions;
  const badges = [
    ...conditionLabels(availability),
    ...(availability
      ? [outcome.unavailableBehavior === "hidden" ? "hidden when unavailable" : "locks when unavailable"]
      : []),
    ...(outcome.consequences ?? []).map(consequenceLabel),
    ...logicBadges(availability, outcome.consequences?.length ?? 0),
    ...dataUseBadges(project, availability),
  ];

  pushNode(
    project,
    nodes,
    outcomeId,
    "outcome",
    outcome.name,
    outcome.description ?? outcome.id,
    1040,
    cursor.outcomeY + outcomeIndex * 150,
    badges,
    { eventId: event.id, decisionId, outcome },
    { nodeColors: options.nodeColors },
  );

  edges.push(
    edge(`edge:choice:${decisionId}:${outcomeId}`, decisionId, outcomeId, "choice", "choice", {
      conditions: availability,
      consequences: outcome.consequences,
    }),
  );

}

function addEventSupportNodes(
  project: BranchingProject,
  eventNode: EventNode,
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  cursor: LayoutCursor,
  options: StoryCanvasModelOptions,
) {
  if (eventNode.script) {
    const scriptNodeId = `ink:${eventNode.script.id}`;
    pushNode(
      project,
      nodes,
      scriptNodeId,
      "inkSection",
      eventNode.script.id,
      scriptSubtitle(eventNode.script),
      820,
      cursor.supportY,
      ["ink", eventNode.script.entrySection ?? "section"],
      { script: eventNode.script, eventId: eventNode.id },
      { nodeColors: options.nodeColors },
    );
    edges.push(edge(`edge:contains:${eventNode.id}:${scriptNodeId}`, eventNode.id, scriptNodeId, "contains", "script"));
    cursor.supportY += 150;
  }

  eventNode.decisions?.forEach((decision, decisionIndex) => {
    const decisionId = `decision:${eventNode.id}:${decision.id}`;
    pushNode(
      project,
      nodes,
      decisionId,
      "decision",
      decision.name,
      decision.description ?? decision.id,
      820,
      cursor.decisionY,
      [
        decision.type,
        `${decision.outcomes.length} outcomes`,
        ...logicBadges(decision.availability),
        ...(decision.availability
          ? [decision.unavailableBehavior === "hidden" ? "hidden when unavailable" : "locks when unavailable"]
          : []),
        ...dataUseBadges(project, decision.availability),
      ],
      { eventId: eventNode.id, decision, options: decisionOptions(project, eventNode.id, decision, options.interfaceLocale) },
      {
        nodeColors: options.nodeColors,
        width: 230,
        infoBadges: authoringDisplaySettings(options).showOutcomeCount && decision.outcomes.length > 0
          ? [{ kind: "outcomes", count: decision.outcomes.length }]
          : [],
      },
    );

    cursor.decisionY += Math.max(220, 108 + decision.outcomes.length * 62);
  });

}

function buildEventScopeModel(
  project: BranchingProject,
  scope: Extract<CanvasScope, { kind: "event" }>,
  options: StoryCanvasModelOptions,
): StoryCanvasModel {
  const nodes: StoryCanvasNode[] = [];
  const edges: StoryCanvasEdge[] = [];
  const eventNode = project.events.find((event) => event.id === scope.id);
  const viewport = project.canvas?.scopes?.[canvasScopeKey(scope)]?.viewport ?? project.canvas?.viewport;

  if (!eventNode) {
    return {
      nodes,
      edges,
      files: buildPathBranchingFiles(project),
      viewport,
      activeSequenceId: project.canvas?.activeSequenceId,
    };
  }

  const childIds = Array.from(
    new Set([
      ...(eventNode.childEventIds ?? []),
      ...project.events.filter((candidate) => candidate.parentEventId === eventNode.id).map((candidate) => candidate.id),
    ]),
  );
  const childEvents = childIds
    .map((eventId) => project.events.find((candidate) => candidate.id === eventId))
    .filter((candidate): candidate is EventNode => Boolean(candidate));
  const missingChildIds = childIds.filter((eventId) => !project.events.some((candidate) => candidate.id === eventId));

  missingChildIds.forEach((missingId, index) => {
    pushNode(
      project,
      nodes,
      missingId,
      "missingRef",
      "Missing Event",
      missingId,
      380 + ((childEvents.length + index) % 2) * 290,
      90 + Math.floor((childEvents.length + index) / 2) * 190,
      ["missing"],
      { ownerId: eventNode.id, missingEventId: missingId },
      { nodeColors: options.nodeColors, scope },
    );
  });

  childEvents.forEach((childEvent, index) => {
    pushNode(
      project,
      nodes,
      childEvent.id,
      "event",
      childEvent.name,
      eventBranchLabel(project, childEvent),
      380 + (index % 2) * 290,
      90 + Math.floor(index / 2) * 190,
      eventBadges(project, childEvent),
      {
        event: childEvent,
        parentEventId: eventNode.id,
        category: project.eventCategories?.find((category) => category.id === childEvent.type),
        terminal: childEvent.type === "final" || Boolean(project.eventCategories?.some((category) => category.id === childEvent.type && category.terminal)),
        accentColor: eventTypeColor(project, childEvent, options),
        minimapColor: eventTypeColor(project, childEvent, options),
      },
      {
        nodeColors: options.nodeColors,
        infoBadges: eventInfoBadges(project, childEvent, options),
        scope,
      },
    );

  });

  // Decisions and narrative beats are peers on the event canvas. `dialogueId`
  // remains readable for old files, but no longer changes where a decision lives.
  eventNode.decisions?.filter((decision) => !decision.dialogueId).forEach((decision, index) => {
    const decisionId = `decision:${eventNode.id}:${decision.id}`;
    pushNode(
      project,
      nodes,
      decisionId,
      "decision",
      decision.name,
      decision.description ?? decision.id,
      380,
      420 + index * 240,
      [
        decision.type,
        `${decision.outcomes.length} outcomes`,
        ...logicBadges(decision.availability),
        ...(decision.availability
          ? [decision.unavailableBehavior === "hidden" ? "hidden when unavailable" : "locks when unavailable"]
          : []),
        ...dataUseBadges(project, decision.availability),
      ],
      { eventId: eventNode.id, decision, options: decisionOptions(project, eventNode.id, decision, options.interfaceLocale) },
      {
        nodeColors: options.nodeColors,
        scope,
        width: 230,
        infoBadges: authoringDisplaySettings(options).showOutcomeCount && decision.outcomes.length > 0
          ? [{ kind: "outcomes", count: decision.outcomes.length }]
          : [],
      },
    );
  });

  const scriptBlocks = new Map(
    (project.scriptDocuments ?? []).flatMap((script) =>
      script.blocks.map((block) => [`${script.id}:${block.id}`, block] as const),
    ),
  );
  const eventBeats = (eventNode.dialogueBeats ?? []).map((beat) => ({ beat, dialogueId: undefined }));
  eventBeats.forEach(({ beat, dialogueId }, index) => {
    const block = scriptBlocks.get(`${beat.blockRef.scriptId}:${beat.blockRef.blockId}`);
    const nodeId = `beat:${eventNode.id}:${beat.id}`;
    const characterRef = block?.characterRef ?? block?.speakerRef;
    const speaker = speakerLabel(characterRef, project.canonRefs.find((ref) => ref.id === characterRef)?.label);
    pushNode(
      project,
      nodes,
      nodeId,
      beat.kind === "speech" ? "speechBeat" : "directionBeat",
      block?.content.trim().slice(0, 80) || narrativeLineLabel(beat.kind),
      beat.kind === "speech" ? speaker : "Stage direction",
      740,
      420 + index * 168,
      logicBadges(beat.displayCondition, beat.consequences?.length ?? 0),
      { eventId: eventNode.id, dialogueId, beat, block, isEventBeat: !dialogueId },
      {
        nodeColors: options.nodeColors,
        scope,
        width: 360,
        height: beat.kind === "speech" ? SPEECH_BEAT_NODE_HEIGHT : DIRECTION_BEAT_NODE_HEIGHT,
      },
    );
  });

  eventNode.dialogues?.forEach((dialogue, index) => {
    const dialogueId = `dialogue:${eventNode.id}:${dialogue.id}`;
    pushNode(
      project,
      nodes,
      dialogueId,
      "dialogue",
      dialogue.title,
      undefined,
      690,
      420 + index * 168,
      dialogueBadges(project, dialogue),
      { eventId: eventNode.id, dialogue },
      {
        nodeColors: options.nodeColors,
        scope,
        infoBadges: dialogueInfoBadges(eventNode, dialogue),
      },
    );
  });

  (eventNode.dialogueStarts ?? []).forEach((start, index) => {
    const sourceLabel = start.source?.kind === "canonRef"
      ? project.canonRefs.find((ref) => ref.id === start.source?.id)?.label ?? start.source.id
      : start.source?.kind === "dataObject"
        ? project.projectDataObjects?.find((item) => item.id === start.source?.id)?.name ?? start.source.id
        : undefined;
    const nodeId = `dialogue-start:${eventNode.id}:${start.id}`;
      pushNode(
      project,
      nodes,
      nodeId,
      "dialogueStart",
      "Trigger",
      sourceLabel ?? "Choose an interactable source",
      410,
      250 + index * 120,
      logicBadges(start.availability, 0),
      { eventId: eventNode.id, start },
      { nodeColors: options.nodeColors, scope, width: 210, height: 88 },
    );
  });


  const ports = buildEventBoundaryPorts(project, eventNode);
  ports.inbound.forEach((port, index) => {
    const position = boundaryPortPosition(nodes, "input", index, ports.inbound.length);
    pushNode(
      project,
      nodes,
      port.id,
      "boundary",
      port.title,
      port.subtitle,
      position.x,
      position.y,
      [],
      { eventId: eventNode.id, direction: "input", transitionId: port.transitionId, slotId: "slotId" in port ? port.slotId : undefined },
      {
        nodeColors: options.nodeColors,
        scope,
        draggable: true,
        width: 210,
        height: 106,
      },
    );
  });
  ports.outbound.forEach((port, index) => {
    const position = boundaryPortPosition(nodes, "output", index, ports.outbound.length);
    pushNode(
      project,
      nodes,
      port.id,
      "boundary",
      port.title,
      port.subtitle,
      position.x,
      position.y,
      [],
      {
        eventId: eventNode.id,
        direction: "output",
        transitionId: port.transitionId,
        targetEventId: port.targetEventId,
        slotId: port.slotId,
        restart: "restart" in port ? port.restart : undefined,
      },
      {
        nodeColors: options.nodeColors,
        scope,
        draggable: true,
        width: 210,
        height: 106,
      },
    );
  });
  (["input", "output"] as const).forEach((direction) => {
    pushNode(
      project,
      nodes,
      direction === "output" ? `end-adder:${eventNode.id}` : `end-adder:input:${eventNode.id}`,
      "endAdder",
      "",
      undefined,
      0,
      0,
      [],
      { eventId: eventNode.id, direction },
      {
        scope,
        autoPosition: true,
        draggable: false,
        selectable: false,
        width: 48,
        height: SUBCANVAS_WORKSPACE_MIN_HEIGHT,
        zIndex: 1,
      },
    );
  });

  // Dialogue members belong to their own subcanvas. At the event level, an
  // *incoming* legacy route to one of those members is represented as an
  // entry into its Dialogue container. Do not apply this projection to a
  // source member: those transitions are internal Dialogue routes and must
  // remain visible only in the Dialogue canvas.
  const dialogueContainerByMember = new Map<string, string>();
  (eventNode.dialogues ?? []).forEach((dialogue) => {
    const containerId = `dialogue:${eventNode.id}:${dialogue.id}`;
    (dialogue.beats ?? []).forEach((beat) => {
      dialogueContainerByMember.set(`beat:${eventNode.id}:${beat.id}`, containerId);
    });
    (eventNode.decisions ?? [])
      .filter((decision) => decision.dialogueId === dialogue.id)
      .forEach((decision) => {
        dialogueContainerByMember.set(`decision:${eventNode.id}:${decision.id}`, containerId);
      });
  });

  addInteractionCanvasNodes(project, nodes, eventNode, scope, options);
  eventNode.boundaryBindings?.forEach((binding) => {
    const memberContainerId = dialogueContainerByMember.get(binding.nodeId);
    // A child-to-output binding is a Dialogue exit, not an event-canvas edge.
    if (binding.direction === "output" && memberContainerId) return;
    const projectedNodeId = memberContainerId ?? binding.nodeId;
    if (!nodes.some((node) => node.id === binding.portId) || !nodes.some((node) => node.id === projectedNodeId)) {
      return;
    }
    const source = binding.direction === "input" ? binding.portId : projectedNodeId;
    const target = binding.direction === "input" ? projectedNodeId : binding.portId;
    const storedSource = binding.direction === "input" ? binding.portId : binding.nodeId;
    const storedTarget = binding.direction === "input" ? binding.nodeId : binding.portId;
    if (
      eventNode.transitions?.some(
        (transition) => transition.from === storedSource && transition.to === storedTarget,
      )
    ) {
      return;
    }
    edges.push(edge(`edge:boundary:${binding.id}`, source, target, "boundary", binding.direction === "input" ? "enters" : "exits"));
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const restartOutputId = boundaryPortId(eventNode.id, "output", "restart");
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  eventNode.transitions?.forEach((transition) => {
    const source = visualTransitionSource(eventNode, transition);
    const sourceMemberContainerId = dialogueContainerByMember.get(source.nodeId);
    const targetMemberContainerId = dialogueContainerByMember.get(transition.to);
    // Never surface a Dialogue-member source in the parent. This includes
    // member-to-member routes, which are handled in the Dialogue subcanvas.
    if (sourceMemberContainerId) return;
    const targetId = transition.to === eventNode.id
      ? restartOutputId
      : targetMemberContainerId ?? transition.to;
    if (!nodeIds.has(source.nodeId) || !nodeIds.has(targetId)) return;
    edges.push(transitionEdge(project, eventNode, { ...transition, to: targetId }, options.interfaceLocale));
  });

  // A child is represented by its event card at this level. Its routes to
  // siblings and back to the parent remain visible here without exposing the
  // child's decisions or creating an external Entry port for every return.
  childEvents.forEach((childEvent) => {
    childEvent.transitions?.forEach((transition) => {
      const targetId = transition.to === eventNode.id ? restartOutputId : transition.to;
      if (!childIds.includes(transition.to) && transition.to !== eventNode.id) return;
      if (!nodeIds.has(targetId)) return;
      edges.push(edge(
        `edge:transition:${transition.id}`,
        childEvent.id,
        targetId,
        "transition",
        transitionCanvasLabel(transition),
        transitionEdgeData(project, transition, options.interfaceLocale),
      ));
    });
  });

  projectRouteGates(project, nodes, edges, scope, options);
  const laidOutNodes = addSubcanvasWorkspace(project, nodes, scope, options);

  return {
    nodes: laidOutNodes,
    edges,
    files: buildPathBranchingFiles(project),
    viewport,
    activeSequenceId: project.canvas?.activeSequenceId,
  };
}

function buildDialogueScopeModel(
  project: BranchingProject,
  scope: Extract<CanvasScope, { kind: "dialogue" }>,
  options: StoryCanvasModelOptions,
): StoryCanvasModel {
  const nodes: StoryCanvasNode[] = [];
  const edges: StoryCanvasEdge[] = [];
  const eventNode = project.events.find((event) => event.id === scope.eventId);
  const dialogue = eventNode?.dialogues?.find((item) => item.id === scope.id);
  const viewport = project.canvas?.scopes?.[canvasScopeKey(scope)]?.viewport ?? project.canvas?.viewport;
  if (!eventNode || !dialogue) {
    return { nodes, edges, files: buildPathBranchingFiles(project), viewport };
  }

  const inputId = `dialogue-boundary:${eventNode.id}:${dialogue.id}:input`;
  const outputId = `dialogue-boundary:${eventNode.id}:${dialogue.id}:output`;
  const dialogueRef = `dialogue:${eventNode.id}:${dialogue.id}`;
  const dialogueRoutes = (eventNode.transitions ?? []).filter(
    (transition) => transition.from === dialogueRef || transition.to === dialogueRef,
  );
  const hierarchyEventIds = new Set<string>([eventNode.id]);
  let hierarchyCursor = eventNode;
  while (hierarchyCursor.parentEventId && !hierarchyEventIds.has(hierarchyCursor.parentEventId)) {
    hierarchyEventIds.add(hierarchyCursor.parentEventId);
    const parentEvent = project.events.find((candidate) => candidate.id === hierarchyCursor.parentEventId);
    if (!parentEvent) break;
    hierarchyCursor = parentEvent;
  }
  const isDialogueOutputPort = (reference: string) =>
    reference === outputId || reference.startsWith(`${outputId}:`);
  // The Dialogue canvas has one opening and one closing boundary. Routes that
  // enter or leave its container belong to the event hierarchy; showing them
  // again as conversation ports duplicates the same transition here.
  const dialogueOutputRoutes = dialogueRoutes.filter(
    (transition) =>
      transition.from === dialogueRef &&
      !isDialogueOutputPort(transition.to) &&
      transition.to !== dialogueRef &&
      !hierarchyEventIds.has(transition.to),
  );
  const primaryOutputRoute = dialogueOutputRoutes.length === 1 ? dialogueOutputRoutes[0] : undefined;
  const scopeKey = canvasScopeKey(scope);
  const authoringScope = project.canvas?.scopes?.[scopeKey];
  const entrySlots = authoringScope?.entrySlots ?? [];
  const exitSlots = authoringScope?.exitSlots ?? [];
  const scriptBlocks = new Map(
    (project.scriptDocuments ?? []).flatMap((script) =>
      script.blocks.map((block) => [`${script.id}:${block.id}`, block] as const),
    ),
  );
  (dialogue.beats ?? []).forEach((beat, index) => {
    const block = scriptBlocks.get(`${beat.blockRef.scriptId}:${beat.blockRef.blockId}`);
    const nodeId = `beat:${eventNode.id}:${beat.id}`;
    const characterRef = block?.characterRef ?? block?.speakerRef;
    const speaker = speakerLabel(characterRef, project.canonRefs.find((ref) => ref.id === characterRef)?.label);
    pushNode(
      project,
      nodes,
      nodeId,
      beat.kind === "speech" ? "speechBeat" : "directionBeat",
      block?.content.trim().slice(0, 80) || narrativeLineLabel(beat.kind),
      beat.kind === "speech" ? speaker : "Stage direction",
      330 + (index % 2) * 310,
      90 + Math.floor(index / 2) * 175,
      logicBadges(beat.displayCondition, beat.consequences?.length ?? 0),
      { eventId: eventNode.id, dialogueId: dialogue.id, beat, block },
      {
        nodeColors: options.nodeColors,
        scope,
        width: 360,
        height: beat.kind === "speech" ? SPEECH_BEAT_NODE_HEIGHT : DIRECTION_BEAT_NODE_HEIGHT,
      },
    );
  });


  (eventNode.decisions ?? []).filter((decision) => decision.dialogueId === dialogue.id).forEach((decision, index) => {
    const decisionId = `decision:${eventNode.id}:${decision.id}`;
    pushNode(
      project,
      nodes,
      decisionId,
      "decision",
      decision.name,
      decision.description ?? decision.id,
      340 + (index % 2) * 320,
      460 + Math.floor(index / 2) * 220,
      [
        decision.type,
        `${decision.outcomes.length} outcomes`,
        ...logicBadges(decision.availability),
        ...(decision.availability
          ? [decision.unavailableBehavior === "hidden" ? "hidden when unavailable" : "locks when unavailable"]
          : []),
      ],
      { eventId: eventNode.id, dialogueId: dialogue.id, decision, options: decisionOptions(project, eventNode.id, decision, options.interfaceLocale) },
      {
        nodeColors: options.nodeColors,
        scope,
        width: 230,
        infoBadges: authoringDisplaySettings(options).showOutcomeCount && decision.outcomes.length > 0
          ? [{ kind: "outcomes", count: decision.outcomes.length }]
          : [],
      },
    );
  });

  const inputPortCount = entrySlots.length + 1;
  const outputPortCount = exitSlots.length + 1;
  const inputPosition = boundaryPortPosition(nodes, "input", 0, inputPortCount);
  pushNode(
    project,
    nodes,
    inputId,
    "boundary",
    dialogue.title,
    "Opening beat",
    inputPosition.x,
    inputPosition.y,
    [],
    {
      eventId: eventNode.id,
      dialogueId: dialogue.id,
      direction: "input",
      returnTarget: false,
    },
    {
      nodeColors: options.nodeColors,
      scope,
      draggable: true,
      width: 210,
      height: 106,
    },
  );
  const outputPosition = boundaryPortPosition(nodes, "output", 0, outputPortCount);
  pushNode(
    project,
    nodes,
    outputId,
    "boundary",
    dialogue.title,
    "Closing route",
    outputPosition.x,
    outputPosition.y,
    [],
    {
      eventId: eventNode.id,
      dialogueId: dialogue.id,
      direction: "output",
      transitionId: primaryOutputRoute?.id,
      targetId: primaryOutputRoute?.to,
      returnRoute: false,
    },
    {
      nodeColors: options.nodeColors,
      scope,
      draggable: true,
      width: 210,
      height: 106,
    },
  );

  entrySlots.forEach((slotId, index) => {
    const nodeId = `dialogue-boundary:${eventNode.id}:${dialogue.id}:input:${slotId}`;
    const position = boundaryPortPosition(nodes, "input", index + 1, inputPortCount);
    pushNode(
      project,
      nodes,
      nodeId,
      "boundary",
      dialogue.title,
      "Additional entry",
      position.x,
      position.y,
      [],
      { eventId: eventNode.id, dialogueId: dialogue.id, direction: "input", slotId },
      { nodeColors: options.nodeColors, scope, draggable: true, width: 210, height: 106 },
    );
  });
  exitSlots.forEach((slotId, index) => {
    const nodeId = `dialogue-boundary:${eventNode.id}:${dialogue.id}:output:${slotId}`;
    const position = boundaryPortPosition(nodes, "output", index + 1, outputPortCount);
    pushNode(
      project,
      nodes,
      nodeId,
      "boundary",
      dialogue.title,
      "Additional continuation",
      position.x,
      position.y,
      [],
      { eventId: eventNode.id, dialogueId: dialogue.id, direction: "output", slotId },
      { nodeColors: options.nodeColors, scope, draggable: true, width: 210, height: 106 },
    );
  });

  (['input', 'output'] as const).forEach((direction) => {
    pushNode(
      project,
      nodes,
      `end-adder:${direction}:${eventNode.id}:${dialogue.id}`,
      "endAdder",
      "",
      undefined,
      0,
      0,
      [],
      { eventId: eventNode.id, dialogueId: dialogue.id, direction },
      {
        scope,
        autoPosition: true,
        draggable: false,
        selectable: false,
        width: 48,
        height: SUBCANVAS_WORKSPACE_MIN_HEIGHT,
        zIndex: 1,
      },
    );
  });

  addInteractionCanvasNodes(project, nodes, eventNode, scope, options);
  const entryBeat = dialogue.entryBeatId
    ? `beat:${eventNode.id}:${dialogue.entryBeatId}`
    : undefined;
  const dialogueInputRefs = new Set([
    inputId,
    ...entrySlots.map((slotId) => `${inputId}:${slotId}`),
  ]);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const hasAuthoredOpeningRoute = (eventNode.transitions ?? []).some(
    (transition) => dialogueInputRefs.has(transition.from) && nodeIds.has(transition.to),
  );
  if (entryBeat && nodeIds.has(entryBeat) && !hasAuthoredOpeningRoute) {
    edges.push(edge(`edge:dialogue-entry:${dialogue.id}`, inputId, entryBeat, "boundary", "enters"));
  }
  (eventNode.transitions ?? []).forEach((transition) => {
    // Dialogue-container routes are represented by their movable edge ports.
    // The event canvas owns transitions to and from the container.
    if (transition.from === dialogueRef || transition.to === dialogueRef) return;
    const source = visualTransitionSource(eventNode, transition);
    const sourceInside = nodeIds.has(source.nodeId);
    const targetInside = nodeIds.has(transition.to);
    if (sourceInside && targetInside) {
      edges.push(transitionEdge(project, eventNode, transition, options.interfaceLocale));
    } else if (sourceInside && !targetInside) {
      const exitEdge = transitionEdge(project, eventNode, { ...transition, to: outputId }, options.interfaceLocale);
      if (hierarchyEventIds.has(transition.to) && exitEdge.data) {
        // The conversation's output boundary already represents an exit to an
        // ancestor event. Keep the line connected, but leave the return marker
        // to the event-level canvas where that hierarchy is visible.
        exitEdge.data = { ...exitEdge.data, returnRoute: false };
      }
      edges.push(exitEdge);
    } else if (!sourceInside && targetInside && transition.to !== entryBeat) {
      edges.push(transitionEdge(project, eventNode, { ...transition, from: inputId }, options.interfaceLocale));
    }
  });

  projectRouteGates(project, nodes, edges, scope, options);
  const laidOutNodes = addSubcanvasWorkspace(project, nodes, scope, options);

  return {
    nodes: laidOutNodes,
    edges,
    files: buildPathBranchingFiles(project),
    viewport,
    activeSequenceId: project.canvas?.activeSequenceId,
  };
}

export function buildStoryCanvasModel(project: BranchingProject, options: StoryCanvasModelOptions = {}): StoryCanvasModel {
  const scope = options.scope ?? activeCanvasScope(project);
  if (scope?.kind === "dialogue") {
    return applyCanvasLogicMode(project, buildDialogueScopeModel(project, scope, options), options);
  }
  if (scope?.kind === "event") {
    return applyCanvasLogicMode(project, buildEventScopeModel(project, scope, options), options);
  }

  const nodes: StoryCanvasNode[] = [];
  const edges: StoryCanvasEdge[] = [];
  const sequence =
    scope?.kind === "sequence"
      ? project.sequences.find((candidate) => candidate.id === scope.id) ?? activeSequence(project)
      : activeSequence(project);
  const activeSequenceId = sequence?.id;
  const activeEventIds = new Set(sequence?.eventIds ?? []);
  const activeBranches = branchesForSequence(project, activeSequenceId);
  const activeEvents = project.events.filter((eventNode) =>
    activeEventIds.has(eventNode.id) && (!options.eventWindowIds || options.eventWindowIds.has(eventNode.id)),
  );
  const eventIndex = indexCanvasProjectEvents({ ...project, events: activeEvents });
  const eventIndexInSequence = new Map((sequence?.eventIds ?? []).map((eventId, index) => [eventId, index]));
  const cursor: LayoutCursor = {
    sequenceY: 80,
    branchY: 80,
    eventY: 80,
    decisionY: 80,
    outcomeY: 80,
    supportY: 320,
  };

  if (sequence) {
    const startNodeId = `start:${sequence.id}`;
    const startNodeSize = Math.max(1, options.gridSize ?? 24) * 3;
    pushNode(
      project,
      nodes,
      startNodeId,
      "start",
      sequence.name || "Start",
      undefined,
      80,
      cursor.sequenceY,
      [],
      {
        sequenceId: sequence.id,
        sequenceEntryEventId:
          sequence.entryEventId && activeEventIds.has(sequence.entryEventId)
            ? sequence.entryEventId
            : undefined,
      },
      { nodeColors: options.nodeColors, scope, width: startNodeSize, height: startNodeSize },
    );
    cursor.sequenceY += 190;
  }

  activeEvents.forEach((eventNode) => {
    const sequenceIndex = eventIndexInSequence.get(eventNode.id) ?? 0;
    const branch = eventNode.branchRef ? activeBranches.find((item) => item.id === eventNode.branchRef) : undefined;
    const sequenceEntry = sequence?.entryEventId === eventNode.id;
    const eventX = sequenceEntry ? 320 : 360;
    const eventY = sequenceEntry ? cursor.sequenceY : cursor.eventY + sequenceIndex * 220;
    pushNode(
      project,
      nodes,
      eventNode.id,
      "event",
      eventNode.name,
      eventBranchLabel(project, eventNode),
      eventX,
      eventY,
      eventBadges(project, eventNode),
      {
        event: eventNode,
        branch,
        category: project.eventCategories?.find((category) => category.id === eventNode.type),
        terminal: eventNode.type === "final" || Boolean(project.eventCategories?.some((category) => category.id === eventNode.type && category.terminal)),
        accentColor: branchColor(branch, eventNode.branchRef, options) ?? "#ffffff",
        branchColor: branchColor(branch, eventNode.branchRef, options),
        typeColor: eventTypeColor(project, eventNode, options),
        minimapColor: branchColor(branch, eventNode.branchRef, options) ?? eventTypeColor(project, eventNode, options),
        sequenceEntry,
        showEventOverview: true,
      },
      {
        nodeColors: options.nodeColors,
        infoBadges: eventInfoBadges(project, eventNode, options),
        scope,
      },
    );

  });

  const canvasNodeIds = new Set(nodes.map((node) => node.id));
  if (sequence?.entryEventId && activeEventIds.has(sequence.entryEventId) && canvasNodeIds.has(sequence.entryEventId)) {
    edges.push(
      edge(
        `edge:entry:start:${sequence.id}:${sequence.entryEventId}`,
        `start:${sequence.id}`,
        sequence.entryEventId,
        "entry",
        sequence.entryLabel?.trim() ?? "",
      ),
    );
  }

  activeEvents.forEach((eventNode) => {
    eventNode.transitions?.forEach((transition) => {
      if (!canvasNodeIds.has(eventNode.id) || !canvasNodeIds.has(transition.to) || !activeEventIds.has(transition.to)) {
        return;
      }
      edges.push({
        ...edge(
          `edge:transition:${transition.id}`,
          eventNode.id,
          transition.to,
          "transition",
          transitionCanvasLabel(transition),
          transitionEdgeData(project, transition, options.interfaceLocale, eventIndex),
        ),
      });
    });
  });

  projectRouteGates(project, nodes, edges, scope, options, activeEvents);

  const projectEventIds = new Set(project.events.map((event) => event.id));
  const missingEventIds = (sequence?.eventIds ?? []).filter((eventId) =>
    !projectEventIds.has(eventId) && !options.pendingEventIds?.has(eventId),
  );
  missingEventIds.forEach((missingId) => {
    const sequenceIndex = eventIndexInSequence.get(missingId) ?? 0;
    pushNode(
      project,
      nodes,
      missingId,
      "missingRef",
      "Missing Event",
      missingId,
      360,
      cursor.eventY + sequenceIndex * 220,
      ["missing"],
      { ownerId: sequence?.id, missingEventId: missingId },
      { nodeColors: options.nodeColors, scope },
    );
  });

  return applyCanvasLogicMode(project, {
    nodes,
    edges,
    files: buildPathBranchingFiles(project),
    viewport: scope ? project.canvas?.scopes?.[canvasScopeKey(scope)]?.viewport ?? project.canvas?.viewport : project.canvas?.viewport,
    activeSequenceId,
  }, options);
}

export function buildPathBranchingFiles(project: BranchingProject): PathBranchingFileItem[] {
  const projectLabel = project.storyId
    ? `${project.storyId}.pathbranching.json`
    : project.projectId
      ? `${project.projectId.replace(/^pathbranching:/, "")}.pathbranching.json`
      : "branching-story.pathbranching.json";

  return [
    {
      id: "file:project",
      label: projectLabel,
      detail: project.projectId,
      group: "project",
    },
    {
      id: "file:runtime",
      label: "runtime-package.json",
      detail: "Generated from validated BranchingProject",
      group: "runtime",
    },
    {
      id: "file:validation",
      label: "validation-report.json",
      detail: "Project and canvas findings",
      group: "validation",
    },
    ...project.sequences.map((sequence) => ({
      id: `file:sequence:${sequence.id}`,
      label: sequence.name,
      detail: sequence.id,
      group: "sequences" as const,
    })),
    ...project.events.map((eventNode) => ({
      id: `file:event:${eventNode.id}`,
      label: eventNode.name,
      detail: eventNode.id,
      group: "events" as const,
    })),
    ...project.scripts.map((script) => ({
      id: `file:script:${script.id}`,
      label: script.sourcePath ?? script.id,
      detail: script.compiledPath ?? script.format,
      group: "scripts" as const,
    })),
    ...(project.scriptDocuments ?? []).map((script) => ({
      id: `file:script-document:${script.id}`,
      label: script.name,
      detail: `${script.blocks.length} structured blocks`,
      group: "scripts" as const,
    })),
    ...(project.dataClasses ?? []).map((dataClass) => ({
      id: `file:data-class:${dataClass.id}`,
      label: dataClass.label,
      detail: dataClass.id,
      group: "data" as const,
    })),
    ...(project.projectDataObjects ?? []).map((dataObject) => ({
      id: `file:data-object:${dataObject.id}`,
      label: dataObject.name,
      detail: dataObject.classId,
      group: "data" as const,
    })),
    ...(project.projectionRules ?? []).map((rule) => ({
      id: `file:projection:${rule.id}`,
      label: rule.label ?? rule.id,
      detail: `${rule.from.layer} to ${rule.to.layer}`,
      group: "data" as const,
    })),
  ];
}

export function validateStoryCanvasEdges(nodes: StoryCanvasNode[], edges: StoryCanvasEdge[]): ValidationFinding[] {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return edges.flatMap((canvasEdge) => {
    const findings: ValidationFinding[] = [];

    if (!nodeIds.has(canvasEdge.source)) {
      findings.push({
        code: "broken_transition",
        severity: "error",
        message: `Canvas edge "${canvasEdge.id}" has missing source node "${canvasEdge.source}".`,
        id: canvasEdge.id,
        ref: canvasEdge.source,
      });
    }

    if (!nodeIds.has(canvasEdge.target)) {
      findings.push({
        code: "broken_transition",
        severity: "error",
        message: `Canvas edge "${canvasEdge.id}" has missing target node "${canvasEdge.target}".`,
        id: canvasEdge.id,
        ref: canvasEdge.target,
      });
    }

    return findings;
  });
}

function addInteractionCanvasNodes(project: BranchingProject, nodes: StoryCanvasNode[], event: EventNode, scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>, options: StoryCanvasModelOptions) {
  const dialogueId = scope.kind === 'dialogue' ? scope.id : undefined;
  const uses = (event.interactionUses ?? []).filter(u => !u.ownerNodeId && u.dialogueId === dialogueId);
  uses.forEach((use, index) => {
    const definition = event.interactionDefinitions?.find(d => d.id === use.definitionId);
    pushNode(project, nodes, `interaction:${event.id}:${use.id}`, 'interaction', definition?.name ?? use.id,
      options.canvasLayerMode === 'logic' ? JSON.stringify(definition?.mechanic) : definition?.prompt?.content ?? definition?.mechanic.kind,
      700, 120 + index * 190, definition?.results.map(r => r.name) ?? [], { eventId: event.id, dialogueId, interactionUse: use, interactionResults: definition?.results.map(r => ({ id: r.id, name: r.name })) }, { scope, nodeColors: options.nodeColors, width: 168 });
  });
  (event.interactionBarriers ?? []).filter(b => b.dialogueId === dialogueId).forEach((barrier, index) => {
    pushNode(project, nodes, `barrier:${event.id}:${barrier.id}`, 'barrier', barrier.name,
      barrier.useIds.map(id => event.interactionDefinitions?.find(d => d.id === event.interactionUses?.find(u => u.id === id)?.definitionId)?.name ?? id).join(' · '),
      1010, 120 + index * 190, ['Wait / Esperar'], { eventId: event.id, dialogueId, interactionBarrier: barrier }, { scope, nodeColors: options.nodeColors });
  });
  // Attached uses are a badge on their authored owner, not additional executable nodes.
  const cards = (ownerId: string) => {
    const optionUses = (event.transitions ?? [])
      .filter(transition => transition.from === ownerId)
      .map(transition => event.interactionUses?.find(use => interactionNodeId(event.id, use.id) === transition.to))
      .filter((use): use is NonNullable<typeof use> => Boolean(use));
    const linkedUseIds = new Set(optionUses.map(use => use.id));
    return (event.interactionUses ?? []).filter(use => use.ownerNodeId === ownerId || linkedUseIds.has(use.id)).map(u => {
    const definition = event.interactionDefinitions?.find(d => d.id === u.definitionId);
    return { id: u.id, name: definition?.name ?? u.id, moment: u.moment, mechanic: definition?.mechanic, results: definition?.results };
    });
  };
  for (const node of nodes) {
    const attached = (event.interactionUses ?? []).filter(u => u.ownerNodeId === node.id);
    node.data.badges.push(...attached.map(u => `${u.moment} · ${event.interactionDefinitions?.find(d => d.id === u.definitionId)?.name ?? u.id}`));
    if (attached.length) {
      node.data.details = { ...node.data.details, interactionCards: cards(node.id) };
      if (node.data.kind === 'speechBeat' || node.data.kind === 'directionBeat') {
        node.height = (node.height ?? (node.data.kind === 'speechBeat' ? SPEECH_BEAT_NODE_HEIGHT : DIRECTION_BEAT_NODE_HEIGHT)) + attached.length * 48;
        node.style = { ...node.style, height: node.height };
      }
    }
    if (node.data.kind === 'decision' && Array.isArray(node.data.details?.options)) node.data.details.options = node.data.details.options.map(option => {
      const value = option as { handleId?: string };
      return { ...value, interactionCards: value.handleId ? cards(value.handleId) : [] };
    });
  }
}
