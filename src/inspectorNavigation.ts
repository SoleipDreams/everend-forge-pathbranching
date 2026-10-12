import type { InspectorTab, Selection } from "./appTypes.js";
import type { BranchingProject, CanvasScope } from "./domain.js";
import { authoringNodeOptions } from "./authoringMutations.js";

export type InspectorSize = { width: number; height?: number };
export type InspectorStackTarget = { kind: "inspector" | "event"; id: string };

export function inspectorStackKey(target: InspectorStackTarget): string {
  return `${target.kind}:${target.id}`;
}

/** Discard closed/duplicate entries and append newly opened tabs. UI state only. */
export function orderedInspectorStack(targets: readonly InspectorStackTarget[], order: readonly string[]): InspectorStackTarget[] {
  const remaining = new Map(targets.map(target => [inspectorStackKey(target), target]));
  const sorted: InspectorStackTarget[] = [];
  for (const key of order) {
    const target = remaining.get(key);
    if (target) { sorted.push(target); remaining.delete(key); }
  }
  return [...sorted, ...remaining.values()];
}

/** Canvas ports are projections, so inspect their narrative event rather than
 * persisting a tab for the port. Sequence starts have no inspector. */
export function canvasInspectorTarget(project: BranchingProject, target: Selection, nodes: readonly { id: string; data: { kind: string; details?: Record<string, unknown> } }[]): Selection | undefined {
  if (target.type !== "node") return target;
  const node = nodes.find(item => item.id === target.id);
  if (node?.data.kind === "start" || target.id.startsWith("start:")) return undefined;
  if (node?.data.kind !== "boundary") return target;
  const details = node.data.details ?? {};
  const owner = project.events.find(event => event.id === details.eventId);
  const routeOwner = project.events.find(event => event.transitions?.some(item => item.id === details.transitionId));
  const transition = project.events.flatMap(event => event.transitions ?? []).find(item => item.id === details.transitionId);
  const eventId = details.direction === "input"
    ? routeOwner?.id ?? owner?.id
    : details.targetEventId ?? transition?.to ?? owner?.id;
  return typeof eventId === "string" && project.events.some(event => event.id === eventId)
    ? { type: "node", id: eventId }
    : undefined;
}

/** Reserve the toolbar and the other headers before expanding a card. A very
 * small canvas scrolls the stack instead of squeezing the editor below 240 px. */
export function inspectorStackCardHeight(dockHeight: number, cardCount: number, requestedHeight = 440, fill = false) {
  const headers = Math.max(0, cardCount - 1);
  const available = Math.max(240, dockHeight - 42 - 6 - headers * (42 + 4));
  return fill ? available : Math.min(requestedHeight, available);
}

/** Writing follows the entered scene, even when an unrelated inspector tab is selected. */
export function writingInspectorTarget(project: BranchingProject, scope?: CanvasScope, selection?: Selection): { selection: Selection; eventId: string } | undefined {
  if (scope?.kind === "dialogue") {
    const event = project.events.find(item => item.id === scope.eventId);
    if (event?.dialogues?.some(dialogue => dialogue.id === scope.id)) return { selection: { type: "node", id: `dialogue:${event.id}:${scope.id}` }, eventId: event.id };
  }
  if (scope?.kind === "event" && project.events.some(event => event.id === scope.id)) return { selection: { type: "node", id: scope.id }, eventId: scope.id };
  if (selection?.type === "node" && project.events.some(event => event.id === selection.id)) return { selection, eventId: selection.id };
  return undefined;
}

/** Close tabs in the same order in which the vertical dock displays them. */
export function closeInspectorStackTabs(
  inspectorTabs: readonly InspectorTab[],
  eventIds: readonly string[],
  target: InspectorStackTarget,
  direction: "above" | "below" | "others",
): { inspectorTabs: InspectorTab[]; eventIds: string[] } {
  const stack = [
    ...inspectorTabs.map(tab => ({ kind: "inspector" as const, id: tab.id, protected: tab.mode === "debug" })),
    ...eventIds.map(id => ({ kind: "event" as const, id, protected: false })),
  ];
  const targetIndex = stack.findIndex(item => item.kind === target.kind && item.id === target.id);
  if (targetIndex < 0) return { inspectorTabs: [...inspectorTabs], eventIds: [...eventIds] };
  const removed = stack.filter((item, index) => !item.protected && (
    direction === "above" ? index < targetIndex : direction === "below" ? index > targetIndex : index !== targetIndex
  ));
  const removedInspectorIds = new Set(removed.filter(item => item.kind === "inspector").map(item => item.id));
  const removedEventIds = new Set(removed.filter(item => item.kind === "event").map(item => item.id));
  return {
    inspectorTabs: inspectorTabs.filter(tab => !removedInspectorIds.has(tab.id)),
    eventIds: eventIds.filter(id => !removedEventIds.has(id)),
  };
}

export function inspectorTargetTitle(project: BranchingProject, target?: Selection, locale: "en" | "es" = "en") {
  if (!target) return project.name ?? "Story";
  const narrative = authoringNodeOptions(project).find(node => node.id === target.id);
  if (narrative?.label) return narrative.label;
  if (target.id.startsWith("route-gate:")) {
    const event = project.events.find(item => target.id.startsWith(`route-gate:${item.id}:`));
    const sourceId = event ? target.id.slice(`route-gate:${event.id}:`.length) : target.id.slice("route-gate:".length);
    const source = authoringNodeOptions(project).find(item => item.id === sourceId);
    return `${locale === "es" ? "Rutas" : "Routes"} · ${source?.label ?? event?.name ?? sourceId}`;
  }
  const transition = project.events.flatMap(event => event.transitions ?? []).find(route => route.id === target.id || `edge:transition:${route.id}` === target.id);
  return project.sequences.find(item => item.id === target.id)?.name
    ?? project.branches.find(item => item.id === target.id)?.title
    ?? project.canonRefs.find(item => item.id === target.id)?.label
    ?? project.localExplorerEntities?.find(item => item.id === target.id)?.name
    ?? project.localExplorerProperties?.find(item => item.id === target.id)?.label
    ?? project.localExplorerTypes?.find(item => item.id === target.id)?.label
    ?? project.narrativeActions?.find(item => item.id === target.id)?.name
    ?? project.narrativeRules?.find(item => item.id === target.id)?.name
    ?? project.entityInstances?.find(item => item.id === target.id)?.name
    ?? (transition ? transition.label || `${transition.from} → ${transition.to}` : target.type === "story" ? project.name ?? "Story" : target.type === "storyDebug" ? "Debug" : target.type === "storyPlay" ? "Play Mode" : target.id);
}

/** Localized type caption for narrative nodes shown in inspector headings. */
export function inspectorTargetKind(project: BranchingProject, target?: Selection, locale: "en" | "es" = "en") {
  if (target?.type !== "node") return undefined;
  const event = project.events.find(item => item.id === target.id);
  if (event) {
    const isNested = Boolean(event.parentEventId) || project.events.some(parent => parent.childEventIds?.includes(event.id));
    if (isNested) return locale === "es" ? "Subevento" : "Subevent";
    if (event.type === "final") return locale === "es" ? "Evento final" : "Final event";
    if (event.type === "exploration") return locale === "es" ? "Evento de exploración" : "Exploration event";
    return locale === "es" ? "Evento" : "Event";
  }
  const kind = authoringNodeOptions(project).find(item => item.id === target.id)?.kind;
  const labels: Record<string, { es: string; en: string }> = {
    dialogue: { es: "Conversación", en: "Conversation" },
    decision: { es: "Decisión", en: "Decision" },
    speech: { es: "Diálogo", en: "Dialogue" },
    direction: { es: "Acotación", en: "Stage direction" },
    outcome: { es: "Opción", en: "Option" },
    interaction: { es: "Interacción", en: "Interaction" },
    barrier: { es: "Espera", en: "Wait" },
  };
  return kind ? labels[kind]?.[locale] ?? undefined : undefined;
}

