import { useApplicationEffect } from "./useApplicationActivity.js";
import { Handle, NodeToolbar, Position, useReactFlow, useUpdateNodeInternals, useStore, type NodeProps, type NodeTypes } from "@xyflow/react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, BookOpen, ChevronRight, CircleAlert, CircleDot, CircleHelp, Clapperboard, CornerDownLeft, FileText, GitBranch, GripVertical, ImagePlus, Info, MessageSquare, Plus, Route, Split, Trash2, UserRound, X, Zap } from "lucide-react";
import type { CanvasInfoBadge, StoryCanvasNode, StoryCanvasNodeData } from "../canvas/storyCanvasModel.js";
import type { Outcome, SceneImageAttachment } from "../domain.js";
import type { LocaleNames } from "../localization.js";
import { UNKNOWN_SPEAKER_REF, speakerLabel } from "../speakerRoles.js";
import { boundaryAdderPlacement } from "../canvas/boundaryAdderPlacement.js";
import { SpeakerSelector } from "./SpeakerSelector.js";
import { useInterfaceLocale } from "../i18n.js";
import "../canvasAuthoringUx.css";

type InspectorSection = "overview" | "write" | "conditions" | "consequences" | "connections" | "choices" | "interactions";
type InspectorTarget = { type: "node" | "edge"; id: string };
type OpenInspectorSection = (section: InspectorSection, target?: InspectorTarget, focusId?: string) => void;

function D20Icon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2.5 8.3 4.8 1 7.7-5.5 7h-7.6l-5.5-7 1-7.7L12 2.5Z" />
    <path d="m12 2.5-3.5 5.4L12 11l3.5-3.1L12 2.5ZM3.7 7.3l4.8.6-.8 4.1L3 15l.7-7.7ZM20.3 7.3l-4.8.6.8 4.1L21 15l-.7-7.7ZM7.7 12l4.3-1 4.3 1M7.7 12l1.5 6 2.8 4 2.8-4 1.5-6M8.2 21.5 9.2 18h5.6l1.2 3.5" />
    <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="700">20</text>
  </svg>;
}

function nodeKindLabel(data: StoryCanvasNodeData, es: boolean) {
  const labels = es ? {
    sequence: "Capítulo", branch: "Rama", event: "Evento", decision: "Decisiones", dialogue: "Conversación",
    dialogueStart: "Inicio de conversación", speechBeat: "Diálogo", directionBeat: "Acotación", outcome: "Opción", interaction: "Interacción", barrier: "Espera",
    start: "Inicio", boundary: data.details?.restart ? "Retorno" : data.details?.direction === "input" ? "Entrada" : "Salida",
    routeGate: "Rutas", workspace: "Área", endAdder: data.details?.direction === "input" ? "Añadir entrada" : "Añadir salida", inkSection: "Guion", knowledge: "Concepto", runtimeAction: "Acción", missingRef: "Referencia ausente",
  } : {
    sequence: "Chapter", branch: "Branch", event: "Event", decision: "Decisions", dialogue: "Conversation",
    dialogueStart: "Conversation start", speechBeat: "Dialogue", directionBeat: "Stage direction", outcome: "Option", interaction: "Interaction", barrier: "Wait",
    start: "Start", boundary: data.details?.restart ? "Return" : data.details?.direction === "input" ? "Entry" : "Exit",
    routeGate: "Routes", workspace: "Area", endAdder: data.details?.direction === "input" ? "Add entry" : "Add exit", inkSection: "Script", knowledge: "Concept", runtimeAction: "Action", missingRef: "Missing reference",
  };
  return labels[data.kind];
}

function CanvasIdentity({ data, es, title = data.title, onOpen }: { data: StoryCanvasNodeData; es: boolean; title?: string; onOpen: OpenInspectorSection }) {
  const emptyTitles: Record<string, string> = es ? { "No incoming route": "Sin ruta de entrada", "Add Entry": "Añadir entrada", "Add End": "Añadir salida", "Story entry": "Inicio de historia" } : { "Add Entry": "Add entry", "Add End": "Add exit" };
  const shownTitle = title ? emptyTitles[title] ?? title : nodeKindLabel(data, es);
  const Icon = data.details?.restart ? CornerDownLeft : data.kind === "decision" ? Split : data.kind === "speechBeat" || data.kind === "dialogue" ? MessageSquare : data.kind === "directionBeat" ? Clapperboard : data.kind === "outcome" ? CircleDot : BookOpen;
  return <div className="node-identity" title={shownTitle}>
    <span className="node-identity-kind"><Icon size={12} aria-hidden="true" />{nodeKindLabel(data, es)}</span>
    <strong className="node-identity-title">{shownTitle}</strong>
    <button type="button" className="node-identity-inspect nodrag nopan" title={es ? "Abrir inspector" : "Open inspector"} aria-label={`${es ? "Inspeccionar" : "Inspect"} ${shownTitle}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen("overview"); }}><Info size={13} aria-hidden="true" /></button>
  </div>;
}

function CanvasNodeActions({ logicMode, conditionEditable, interactionEditable, conditionConfigured, interactionConfigured, interactionIsNode, es, onOpen }: {
  logicMode: boolean;
  conditionEditable: boolean;
  interactionEditable: boolean;
  conditionConfigured: boolean;
  interactionConfigured: boolean;
  interactionIsNode: boolean;
  es: boolean;
  onOpen: OpenInspectorSection;
}) {
  const addCondition = conditionEditable && !conditionConfigured;
  const addInteraction = interactionEditable && !interactionConfigured;
  if (!logicMode || !addCondition && !addInteraction) return null;
  const conditionLabel = es ? "Añadir condición" : "Add condition";
  const interactionLabel = es ? "Añadir interacción" : "Add interaction";
  return <div className="node-canvas-actions nodrag nopan" role="toolbar" aria-label={es ? "Accesos de lógica" : "Logic actions"}>
    {addCondition ? <button type="button" className="node-canvas-action node-canvas-condition" title={conditionLabel} aria-label={conditionLabel} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen("conditions"); }}>
      <GitBranch size={16} aria-hidden="true" />
    </button> : null}
    {addInteraction ? <button type="button" className="node-canvas-action node-canvas-interaction" title={interactionLabel} aria-label={interactionLabel} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen(interactionIsNode ? "overview" : "interactions"); }}>
      <D20Icon size={16} />
    </button> : null}
  </div>;
}

function CanvasLogicSummary({ summary, logicMode, conditionEditable, conditionConfigured, es, onOpen }: { summary?: StoryCanvasNodeData["logicSummary"]; logicMode: boolean; conditionEditable: boolean; conditionConfigured: boolean; es: boolean; onOpen: OpenInspectorSection }) {
  const showCondition = logicMode && conditionEditable && conditionConfigured;
  const showEffects = Boolean(summary?.then || summary?.ruleCount);
  const showWarnings = logicMode && Boolean(summary?.warningCount);
  if (!showCondition && !showEffects && !showWarnings) return null;
  return <div className={`node-authoring-logic ${logicMode ? "logic-detail" : "logic-counts"}`} aria-label={es ? "Lógica de este nodo" : "This node's logic"}>
    {showCondition ? <button type="button" className="node-authoring-condition node-authoring-condition-status nodrag nopan" title={es ? "Editar condición" : "Edit condition"} aria-label={es ? "Editar condición" : "Edit condition"} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen("conditions"); }}><GitBranch size={12} aria-hidden="true" /><b>IF</b></button> : null}
    {showEffects ? <button type="button" className="node-authoring-effects nodrag nopan" title={summary?.then || `${summary?.ruleCount ?? 0} ${es ? "reglas" : "rules"}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen("consequences"); }}><Zap size={12} /><b>{es ? "Cambios" : "Changes"}</b><span className="node-authoring-summary">{logicMode ? summary?.then || `${summary?.ruleCount ?? 0} ${es ? "reglas" : "rules"}` : summary?.consequenceCount || summary?.ruleCount}</span></button> : null}
    {showWarnings ? <button type="button" className="node-authoring-warning nodrag nopan" title={es ? "Revisar referencias y capacidades" : "Review references and capabilities"} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); onOpen("conditions"); }}><CircleAlert size={12} />{summary?.warningCount}</button> : null}
  </div>;
}

function badgeText(value: string) {
  return value.length > 22 ? `${value.slice(0, 19)}...` : value;
}

const BEAT_FONT_MIN_PX = 12;
const BEAT_FONT_MAX_PX = 38;

/**
 * Builds a representative filler string of the requested size so the baseline
 * dialogue font can be sized against the counter maximum instead of the
 * current content. Uses average-width lowercase characters and typical word
 * lengths so the baseline reflects realistic text density rather than the
 * widest possible glyphs (which left the box looking half-empty).
 */
function buildBeatFillerString(count: number, unit: "words" | "characters") {
  const safeCount = Math.max(1, Math.min(4000, Math.round(count)));
  if (unit === "words") {
    return Array.from({ length: safeCount }, () => "men").join(" ");
  }
  let filler = "";
  while (filler.length < safeCount) {
    filler += "men ";
  }
  return filler.slice(0, safeCount);
}

function countBeatText(text: string, unit: "words" | "characters") {
  return unit === "words"
    ? text.trim()
      ? text.trim().split(/\s+/u).length
      : 0
    : Array.from(text).length;
}

/**
 * Binary-searches the largest font size (within bounds) at which `text` fits
 * inside a detached clone of the beat content element, so measuring never
 * disturbs the live contentEditable selection.
 */
function measureBeatFontFit(reference: HTMLDivElement, text: string) {
  const clone = reference.cloneNode(false) as HTMLDivElement;
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("role");
  clone.style.position = "absolute";
  clone.style.left = "-99999px";
  clone.style.top = "0";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  clone.style.width = `${reference.clientWidth}px`;
  clone.style.height = `${reference.clientHeight}px`;
  clone.style.overflow = "hidden";
  clone.textContent = text;
  reference.parentElement?.appendChild(clone);
  const fitsAt = (px: number) => {
    clone.style.fontSize = `${px}px`;
    return clone.scrollHeight <= clone.clientHeight;
  };
  let result = BEAT_FONT_MIN_PX;
  if (fitsAt(BEAT_FONT_MAX_PX)) {
    result = BEAT_FONT_MAX_PX;
  } else {
    let low = BEAT_FONT_MIN_PX;
    let high = BEAT_FONT_MAX_PX;
    while (high - low > 0.5) {
      const mid = (low + high) / 2;
      if (fitsAt(mid)) {
        low = mid;
      } else {
        high = mid;
      }
    }
    result = low;
  }
  clone.remove();
  return result;
}

const infoBadgeLabels: Record<CanvasInfoBadge["kind"], string> = {
  decisions: "Decisions",
  outcomes: "Options",
  dialogues: "Conversations",
  lines: "Lines",
  characters: "Characters",
  words: "Words",
};

function CanvasInfoBadges({ badges }: { badges: CanvasInfoBadge[] }) {
  const es = useInterfaceLocale() === "es";
  const labels = es ? { decisions: "Decisiones", outcomes: "Opciones", dialogues: "Conversaciones", lines: "Líneas", characters: "Caracteres", words: "Palabras" } : infoBadgeLabels;
  if (badges.length === 0) return null;
  return (
    <div className="node-info-badges" aria-label={es ? "Contenido del nodo" : "Node contents"}>
      {badges.map((badge) => {
        const Icon = badge.kind === "decisions"
          ? Split
          : badge.kind === "outcomes"
            ? CircleDot
            : badge.kind === "dialogues" || badge.kind === "lines"
              ? MessageSquare
              : badge.kind === "characters"
                ? AlignLeft
                : FileText;
        return (
          <span key={badge.kind} title={`${labels[badge.kind]}: ${badge.count}`}>
            <Icon size={11} aria-hidden="true" />
            <b>{badge.count}</b>
          </span>
        );
      })}
    </div>
  );
}

type DecisionOption = {
  id: string;
  name: string;
  visibleText?: string;
  description?: string;
  icon?: string;
  handleId: string;
  logicSummary?: StoryCanvasNodeData["logicSummary"];
  interactionCards?: InteractionCard[];
  unavailableBehavior?: "hidden" | "locked";
};

type InteractionCard = { id: string; name: string; moment: 'before' | 'during' | 'after'; mechanic?: { kind: string }; results?: unknown[] };
type DecisionQuickEditor = {
  optionStyle: "visibleText" | "iconOnly";
  onOptionStyleUpdate: (style: "visibleText" | "iconOnly") => void;
  onOutcomeUpdate: (outcomeId: string, updates: Partial<Pick<Outcome, "visibleText">>) => void;
  onCreateOutcome: () => void;
  onDeleteOutcome: (outcomeId: string) => void;
};

const DECISION_OPTION_SAVE_DELAY_MS = 250;

function DecisionOptionTextEditor({
  value,
  onCommit,
  onEscape,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  onEscape: () => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);
  const latestDraftRef = useRef(value);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    if (dirtyRef.current) return;
    latestDraftRef.current = value;
    setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    onCommitRef.current(latestDraftRef.current);
  }, []);

  useEffect(() => () => flush(), [flush]);

  return (
    <textarea
      className="decision-option-input nodrag nopan"
      rows={3}
      autoFocus
      value={draft}
      placeholder="Texto escrito..."
      aria-label={label}
      onPointerDown={stopCanvasInteraction}
      onClick={stopCanvasInteraction}
      onBlur={flush}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          flush();
          onEscape();
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        latestDraftRef.current = nextValue;
        dirtyRef.current = true;
        setDraft(nextValue);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, DECISION_OPTION_SAVE_DELAY_MS);
      }}
    />
  );
}

function isDecisionQuickEditor(value: unknown): value is DecisionQuickEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      ((value as DecisionQuickEditor).optionStyle === "visibleText" ||
        (value as DecisionQuickEditor).optionStyle === "iconOnly") &&
      typeof (value as DecisionQuickEditor).onOptionStyleUpdate === "function" &&
      typeof (value as DecisionQuickEditor).onOutcomeUpdate === "function" &&
      typeof (value as DecisionQuickEditor).onCreateOutcome === "function" &&
      typeof (value as DecisionQuickEditor).onDeleteOutcome === "function",
  );
}

function isDecisionOption(value: unknown): value is DecisionOption {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as DecisionOption).id === "string" &&
      typeof (value as DecisionOption).handleId === "string",
  );
}

export type DialoguePreset = {
  characterRef?: string;
  characterVariantId?: string;
  label: string;
  variantLabel?: string;
  portraitUrl?: string;
};

type NarrativeConnector = {
  onConnect: (kind: "speechBeat" | "decision" | "directionBeat", preset?: DialoguePreset) => void;
  dialoguePresets?: DialoguePreset[];
  onInsertConditions?: () => void;
};

type BeatQuickEditor = {
  values: Record<string, string>;
  primaryLocale: string;
  activeLocale?: string;
  languages: string[];
  localeNames?: LocaleNames;
  characterRef?: string;
  characterLabel?: string;
  characterVariantId?: string;
  textCounter?: { count: number; unit: "words" | "characters"; target: number };
  counterPreference?: {
    enabled: boolean;
    unit: "words" | "characters";
    target: number;
    eventOverride?: boolean;
  };
  onCounterPreferenceUpdate?: (updates: {
    enabled?: boolean;
    unit?: "words" | "characters";
    target?: number;
  }) => void;
  presentEntityIds?: string[];
  speakerOptions: Array<{
    id: string;
    label: string;
    portraitUrl?: string;
    source?: "canon" | "local" | "published";
    variants: Array<{ id: string; label: string; portraitUrl?: string }>;
  }>;
  onTextUpdate: (locale: string, value: string) => void;
  onCharacterUpdate: (characterRef?: string) => void;
  onCreateSpeaker?: (name: string) => void;
  onCharacterVariantUpdate?: (variantId: string) => void;
  narrativeConnector?: NarrativeConnector;
};

type EventCoverImage = {
  assetId: string;
  name: string;
  url?: string;
};

type EventQuickEditor = {
  description: string;
  coverImage?: EventCoverImage;
  imageAssets: Array<{ id: string; name: string }>;
  coverImageOpen?: boolean;
  descriptionOpen?: boolean;
  onDescriptionUpdate: (value: string) => void;
  onCoverImageUpdate: (assetId?: string) => void;
  onImportCoverImage?: () => void;
  onAuxiliaryPanelChange: (panel: "coverImage" | "description", open: boolean) => void;
};

function isEventQuickEditor(value: unknown): value is EventQuickEditor {
  return Boolean(
    value && typeof value === "object" &&
    typeof (value as EventQuickEditor).description === "string" &&
    Array.isArray((value as EventQuickEditor).imageAssets) &&
    typeof (value as EventQuickEditor).onDescriptionUpdate === "function" &&
    typeof (value as EventQuickEditor).onCoverImageUpdate === "function" &&
    typeof (value as EventQuickEditor).onAuxiliaryPanelChange === "function",
  );
}

function isBeatQuickEditor(value: unknown): value is BeatQuickEditor {
  return Boolean(
    value && typeof value === "object" &&
    typeof (value as BeatQuickEditor).primaryLocale === "string" &&
    Array.isArray((value as BeatQuickEditor).languages) &&
    Array.isArray((value as BeatQuickEditor).speakerOptions) &&
    typeof (value as BeatQuickEditor).onTextUpdate === "function",
  );
}

type DialogueTriggerEditor = {
  speakerOptions: Array<{
    id: string;
    label: string;
    portraitUrl?: string;
    variants: Array<{ id: string; label: string; portraitUrl?: string }>;
  }>;
  presentEntityIds: string[];
  selectedCharacterId?: string;
  triggerActions: Array<{ id: string; label: string }>;
  selectedActionId?: string;
  onCharacterChange: (characterId?: string) => void;
  onActionChange: (actionId?: string) => void;
};

function isDialogueTriggerEditor(value: unknown): value is DialogueTriggerEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as DialogueTriggerEditor).speakerOptions) &&
      Array.isArray((value as DialogueTriggerEditor).presentEntityIds) &&
      Array.isArray((value as DialogueTriggerEditor).triggerActions) &&
      typeof (value as DialogueTriggerEditor).onCharacterChange === "function" &&
      typeof (value as DialogueTriggerEditor).onActionChange === "function",
  );
}

type BoundaryRouteEditor = {
  direction: "input" | "output";
  selectedTargetId?: string;
  targets: Array<{ id: string; label: string }>;
  onTargetChange: (eventId: string) => void;
  onCreateTarget?: () => void;
  onDeleteEnd?: () => void;
};

function isBoundaryRouteEditor(value: unknown): value is BoundaryRouteEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      ((value as BoundaryRouteEditor).direction === "input" || (value as BoundaryRouteEditor).direction === "output") &&
      Array.isArray((value as BoundaryRouteEditor).targets) &&
      typeof (value as BoundaryRouteEditor).onTargetChange === "function" &&
      ((value as BoundaryRouteEditor).onCreateTarget === undefined || typeof (value as BoundaryRouteEditor).onCreateTarget === "function"),
  );
}

type WorkspaceEditor = {
  bounds: { x: number; y: number; width: number; height: number };
  minBounds?: { x: number; y: number; width: number; height: number };
  onPreview: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onCommit: (bounds: { x: number; y: number; width: number; height: number }) => void;
};

type WorkspaceResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const WORKSPACE_RESIZE_DIRECTIONS: WorkspaceResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];

function isWorkspaceEditor(value: unknown): value is WorkspaceEditor {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkspaceEditor).bounds === "object" &&
      typeof (value as WorkspaceEditor).onPreview === "function" &&
      typeof (value as WorkspaceEditor).onCommit === "function",
  );
}

type EndAdder = {
  onAdd: (direction: "input" | "output", position: { x: number; y: number }, dialogueId?: string) => void;
};

function isEndAdder(value: unknown): value is EndAdder {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EndAdder).onAdd === "function",
  );
}

function stopCanvasInteraction(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

function EndAdderControl({
  data,
  positionAbsoluteX,
  es,
}: {
  data: StoryCanvasNodeData;
  positionAbsoluteX: number;
  es: boolean;
}) {
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  // A floating inspector can leave several React Flow instances mounted at
  // once. Keep hover detection inside this node's own canvas instead of
  // accidentally measuring the first canvas in the document.
  const flowRoot = useStore((state) => state.domNode);
  const direction = data.details?.direction === "input" ? "input" : "output";
  const [pointer, setPointer] = useState<{ x: number; y: number; size: number; revealPort: boolean }>();
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const endAdder = isEndAdder(data.details?.endAdder)
    ? data.details.endAdder
    : undefined;

  useEffect(() => {
    setPortalHost(document.querySelector<HTMLElement>(".pathbranching-app") ?? document.body);
  }, []);

  useEffect(() => {
    const updatePointer = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") return;
      const pane = flowRoot?.querySelector<HTMLElement>(".react-flow__pane");
      if (!pane) {
        setPointer(undefined);
        return;
      }
      const bounds = pane.getBoundingClientRect();
      if (
        event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom
      ) {
        setPointer(undefined);
        return;
      }

      const workspace = flowRoot?.querySelector<HTMLElement>(".story-node.workspace-node");
      const workspaceBounds = workspace?.getBoundingClientRect();
      if (!workspaceBounds) {
        setPointer(undefined);
        return;
      }
      const placement = boundaryAdderPlacement(
        direction,
        bounds,
        workspaceBounds,
        zoom,
        event.clientX,
        event.clientY,
      );
      if (!placement) {
        setPointer(undefined);
        return;
      }
      const chrome = flowRoot?.querySelectorAll<HTMLElement>(
        ".canvas-modebar, .pb-canvas-tool-row, .pb-canvas-locale-tools, .react-flow__controls, .react-flow__minimap, .workspace-resize-handle",
      ) ?? [];
      if (Array.from(chrome).some((element) => {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
      })) {
        setPointer(undefined);
        return;
      }

      const underlying = document.elementsFromPoint(event.clientX, event.clientY)
        .find((element) => !element.closest(".end-adder-floating-button"));
      if (!underlying || !pane.contains(underlying)) {
        setPointer(undefined);
        return;
      }

      // Keep the affordance just outside the workspace and out of boundary
      // cards or other canvas content that may touch the border.
      const buttonUnderlying = document.elementsFromPoint(placement.x, placement.y)
        .find((element) => !element.closest(".end-adder-floating-button"));
      const buttonNode = buttonUnderlying?.closest<HTMLElement>(".react-flow__node");
      if (
        !buttonUnderlying || !pane.contains(buttonUnderlying) ||
        (buttonNode && !buttonNode.querySelector(".story-node.workspace-node")) ||
        buttonUnderlying.closest(".react-flow__edge")
      ) {
        setPointer(undefined);
        return;
      }

      const node = underlying.closest<HTMLElement>(".react-flow__node");
      if (
        (node && !node.querySelector(".story-node.workspace-node")) ||
        underlying.closest(".react-flow__edge, .react-flow__controls, .react-flow__minimap")
      ) {
        setPointer(undefined);
        return;
      }

      setPointer((current) => current?.x === placement.x && current.y === placement.y && current.size === placement.size && current.revealPort === placement.revealPort ? current : placement);
    };
    const clearPointer = () => setPointer(undefined);
    document.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("blur", clearPointer);
    return () => {
      document.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("blur", clearPointer);
    };
  }, [direction, flowRoot, zoom]);

  if (!portalHost) return null;
  return createPortal(
    <button
      ref={buttonRef}
      type="button"
      className={`end-adder-floating-button${pointer ? " is-visible" : ""}`}
      style={{
        left: pointer?.x ?? -10000,
        top: pointer?.y ?? -10000,
        width: pointer?.size ?? 36,
        height: pointer?.size ?? 36,
      }}
      aria-label={es ? `Añadir una ${direction === "input" ? "entrada" : "salida"} aquí` : `Add an ${direction === "input" ? "entry" : "exit"} here`}
      title={es ? `Añadir una ${direction === "input" ? "entrada" : "salida"} aquí` : `Add an ${direction === "input" ? "entry" : "exit"} here`}
      onPointerDown={(event) => event.stopPropagation()}
      onFocus={() => {
        if (pointer) return;
        const pane = flowRoot?.querySelector<HTMLElement>(".react-flow__pane");
        const workspace = flowRoot?.querySelector<HTMLElement>(".story-node.workspace-node");
        const bounds = pane?.getBoundingClientRect();
        const workspaceBounds = workspace?.getBoundingClientRect();
        if (!bounds || !workspaceBounds) return;
        const edgeX = direction === "output" ? workspaceBounds.right : workspaceBounds.left;
        const edgeVisible = direction === "output"
          ? edgeX >= bounds.left && edgeX + 36 <= bounds.right
          : edgeX - 36 >= bounds.left && edgeX <= bounds.right;
        const scanX = edgeVisible
          ? edgeX + (direction === "output" ? 18 : -18)
          : direction === "output" ? bounds.right - 24 : bounds.left + 24;
        for (
          let y = Math.max(bounds.top + 20, workspaceBounds.top + 53 * zoom);
          y <= Math.min(bounds.bottom - 20, workspaceBounds.bottom - 53 * zoom);
          y += 12
        ) {
          const placement = boundaryAdderPlacement(direction, bounds, workspaceBounds, zoom, scanX, y);
          if (!placement) continue;
          const target = document.elementsFromPoint(scanX, y)
            .find((element) => !element.closest(".end-adder-floating-button"));
          const targetNode = target?.closest<HTMLElement>(".react-flow__node");
          if (
            target && pane && pane.contains(target) &&
            (!targetNode || targetNode.querySelector(".story-node.workspace-node")) &&
            !target.closest(".react-flow__edge, .react-flow__controls, .react-flow__minimap")
          ) {
            setPointer(placement);
            return;
          }
        }
      }}
      onBlur={() => setPointer(undefined)}
      onClick={(event) => {
        event.stopPropagation();
        const point = pointer;
        if (!point || !endAdder) return;
        const flowPoint = screenToFlowPosition(point);
        endAdder.onAdd(
          direction,
          { x: positionAbsoluteX, y: flowPoint.y - 53 },
          typeof data.details?.dialogueId === "string" ? data.details.dialogueId : undefined,
        );
        if (point.revealPort) {
          const boundaryCenterX = positionAbsoluteX + (direction === "input" ? -57 : 105);
          window.requestAnimationFrame(() => setCenter(boundaryCenterX, flowPoint.y, { duration: 220, zoom }));
        }
        setPointer(undefined);
        buttonRef.current?.blur();
      }}
    >
      <Plus size={Math.min(18, Math.max(12, (pointer?.size ?? 36) * 0.5))} aria-hidden="true" />
    </button>,
    portalHost,
  );
}

function StoryNode({ id, data, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<StoryCanvasNode>) {
  const interfaceLocale = useInterfaceLocale();
  const zoom = useStore(state => state.transform[2]);
  const es = interfaceLocale === "es";
  const nodeData = data as StoryCanvasNodeData;
  const updateNodeInternals = useUpdateNodeInternals();
  const routeGateHandleSignature = [
    nodeData.kind === "routeGate"
      ? `${nodeData.details?.junctionPresentation ?? "split"}:${Array.isArray(nodeData.details?.routeOptions) ? nodeData.details.routeOptions.length : 0}`
      : "",
    nodeData.kind === "boundary"
      ? `${nodeData.details?.returnRoute === true}:${nodeData.details?.returnTarget === true}`
      : "",
  ].join("|");
  // Decision nodes keep the Visual option rows (and their handles) as the
  // single source of truth in both layers. Refresh their cached geometry when
  // the layer or option set changes so React Flow follows the live DOM handles.
  const outcomePortHandleSignature = nodeData.kind === "decision" && Array.isArray(nodeData.details?.options)
      ? nodeData.details.options.filter(isDecisionOption).map((option) => option.handleId).join(":")
      : "";
  const interactionHandleSignature = nodeData.kind === 'interaction' ? JSON.stringify(nodeData.details?.interactionResults) : '';
  useLayoutEffect(() => {
    if (
      nodeData.kind === "routeGate" ||
      nodeData.kind === "decision" || nodeData.kind === 'interaction' ||
      (nodeData.kind === "boundary" && (nodeData.details?.returnRoute === true || nodeData.details?.returnTarget === true))
    ) {
      updateNodeInternals(id);
    }
  }, [id, outcomePortHandleSignature, interactionHandleSignature, nodeData.canvasLayerMode, nodeData.kind, routeGateHandleSignature, updateNodeInternals]);

  const [openBeatMenu, setOpenBeatMenu] = useState(false);
  const [dialoguePresetMenuOpen, setDialoguePresetMenuOpen] = useState(false);
  const [editingDecisionOptionId, setEditingDecisionOptionId] = useState<string>();
  const [connectorMenuOpen, setConnectorMenuOpen] = useState(false);
  const connectorRef = useRef<HTMLDivElement>(null);
  const decisionEditorRef = useRef<HTMLDivElement>(null);
  const quickEditor = isBeatQuickEditor(nodeData.details?.quickEditor)
    ? nodeData.details.quickEditor
    : undefined;
  const decisionEditor = isDecisionQuickEditor(nodeData.details?.decisionEditor)
    ? nodeData.details.decisionEditor
    : undefined;
  useApplicationEffect(() => {
    if (!editingDecisionOptionId) return;
    const closeOnOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && decisionEditorRef.current?.contains(target)) return;
      setEditingDecisionOptionId(undefined);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setEditingDecisionOptionId(undefined);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingDecisionOptionId]);
  const draftLocale = quickEditor?.activeLocale ?? quickEditor?.primaryLocale ?? "und";
  const draftExternalText = quickEditor?.values[draftLocale] ?? "";
  const beatContentRef = useRef<HTMLDivElement>(null);
  const counterEditorRef = useRef<HTMLDivElement>(null);
  const [counterEditorOpen, setCounterEditorOpen] = useState(false);
  const [draftText, setDraftText] = useState(draftExternalText);
  const beatCounterTarget = quickEditor?.textCounter?.target;
  const beatCounterUnit = quickEditor?.textCounter?.unit;
  const draftTextCount = quickEditor?.textCounter
    ? countBeatText(draftText, quickEditor.textCounter.unit)
    : 0;
  // Size the dialogue text against the counter maximum (worst-case filler) so
  // the baseline stays stable no matter how much has been typed. The font only
  // shrinks below that baseline once the actual content exceeds the maximum. If
  // even the minimum size cannot contain the content, fall back to internal
  // scrolling (the counter remains the only overflow cue).
  const fitBeatText = useCallback(() => {
    const element = beatContentRef.current;
    if (!element || element.clientHeight <= 0) return;
    // Direction beats are stage directions, not dialogue cards: their type
    // must remain readable and stable instead of auto-growing with short text.
    if (nodeData.kind === "directionBeat") {
      element.style.fontSize = "16px";
      return;
    }
    const baselineFont = beatCounterTarget && beatCounterTarget > 0
      ? measureBeatFontFit(element, buildBeatFillerString(beatCounterTarget, beatCounterUnit ?? "characters"))
      : BEAT_FONT_MAX_PX;
    const actualText = element.textContent ?? "";
    const contentFont = actualText.trim()
      ? measureBeatFontFit(element, actualText)
      : BEAT_FONT_MAX_PX;
    const size = Math.max(
      BEAT_FONT_MIN_PX,
      Math.min(baselineFont, contentFont),
    );
    element.style.fontSize = `${size}px`;
    element.style.overflowY =
      element.scrollHeight > element.clientHeight ? "auto" : "hidden";
  }, [beatCounterTarget, beatCounterUnit]);
  const fitBeatTextFrameRef = useRef<number | undefined>(undefined);
  const scheduleFitBeatText = useCallback(() => {
    if (fitBeatTextFrameRef.current !== undefined) {
      cancelAnimationFrame(fitBeatTextFrameRef.current);
    }
    fitBeatTextFrameRef.current = requestAnimationFrame(() => {
      fitBeatTextFrameRef.current = undefined;
      fitBeatText();
    });
  }, [fitBeatText]);
  useEffect(() => {
    const element = beatContentRef.current;
    if (!element) return;
    if (document.activeElement !== element && element.textContent !== draftExternalText) {
      element.textContent = draftExternalText;
      setDraftText(draftExternalText);
    }
    fitBeatText();
  }, [draftExternalText, draftLocale, fitBeatText]);
  useLayoutEffect(() => {
    const element = beatContentRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fitBeatText());
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitBeatText]);
  useEffect(() => () => {
    if (fitBeatTextFrameRef.current !== undefined) {
      cancelAnimationFrame(fitBeatTextFrameRef.current);
    }
  }, []);
  useApplicationEffect(() => {
    if (!counterEditorOpen) return;
    const closeOnOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && counterEditorRef.current?.contains(target)) return;
      setCounterEditorOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setCounterEditorOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [counterEditorOpen]);
  useApplicationEffect(() => {
    if (!connectorMenuOpen) return;
    setDialoguePresetMenuOpen(false);
    const closeOnOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && connectorRef.current?.contains(target)) return;
      setConnectorMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setConnectorMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [connectorMenuOpen]);
  const isEvent = nodeData.kind === "event";
  const showEventOverview = isEvent && nodeData.details?.showEventOverview === true;
  const eventDetails = showEventOverview
    ? nodeData.details?.event as { type?: string } | undefined
    : undefined;
  const eventEditor = isEventQuickEditor(nodeData.details?.eventEditor)
    ? nodeData.details.eventEditor
    : undefined;
  const eventCoverImage = showEventOverview
    ? eventEditor?.coverImage ?? nodeData.details?.coverImage as EventCoverImage | undefined
    : undefined;
  const eventTypeBadgeCandidate = showEventOverview && eventDetails?.type && eventDetails.type !== "normal"
    ? nodeData.badges.find((badge) => !/^\d+ decisions?$/.test(badge))
    : undefined;
  const eventTypeBadge = eventTypeBadgeCandidate && nodeData.details?.terminal !== true
    ? eventTypeBadgeCandidate
    : undefined;
  const eventBranchTag = showEventOverview
    ? nodeData.subtitle?.replace(/^Branch\s*·\s*/, "").trim()
    : undefined;
  const isFinalEvent = nodeData.kind === "event" && (nodeData.details?.terminal === true || nodeData.badges.includes("terminal"));
  const boundaryDirection =
    nodeData.kind === "boundary" && nodeData.details?.direction === "input"
      ? "input"
      : nodeData.kind === "boundary" && nodeData.details?.direction === "output"
        ? "output"
        : undefined;
  const focusClass = `${typeof nodeData.focusState === "string" ? ` focus-${nodeData.focusState}` : ""}${zoom < 0.65 && !selected ? " canvas-node-overview" : ""}`;
  const inspectorFocusClass =
    typeof nodeData.inspectorState === "string"
      ? ` inspector-${nodeData.inspectorState}`
      : "";
  const canReceive = boundaryDirection
    ? boundaryDirection === "output"
    : nodeData.kind !== "start" && nodeData.kind !== "sequence" && nodeData.kind !== "missingRef" && nodeData.kind !== "dialogueStart";
  const canSource = boundaryDirection
    ? boundaryDirection === "input"
    : nodeData.kind !== "missingRef" && (nodeData.kind === "start" || (nodeData.kind !== "sequence" && !isFinalEvent));
  const narrativeConnector = quickEditor?.narrativeConnector;
  const supportsNarrativeConnector =
    nodeData.kind === "speechBeat" || nodeData.kind === "directionBeat";
  const renderNarrativeConnector = () => {
    if (!supportsNarrativeConnector || !canSource || !narrativeConnector) return null;
    return (
      <div
        ref={connectorRef}
        className={`speech-beat-connector nodrag nopan${connectorMenuOpen ? " open" : ""}`}
        onMouseLeave={() => setConnectorMenuOpen(false)}
      >
        <button
          type="button"
          className="speech-beat-connector-toggle"
          aria-label={es ? "Añadir nodo conectado" : "Add connected node"}
          aria-expanded={connectorMenuOpen}
          title={es ? "Añadir nodo conectado" : "Add connected node"}
          onPointerDown={stopCanvasInteraction}
          onClick={(event) => {
            stopCanvasInteraction(event);
            setConnectorMenuOpen((open) => !open);
          }}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
        <div className="speech-beat-connector-menu">
          <div
            className={`speech-beat-connector-submenu${dialoguePresetMenuOpen ? " open" : ""}`}
            onMouseEnter={() => setDialoguePresetMenuOpen(true)}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={dialoguePresetMenuOpen}
              onPointerDown={stopCanvasInteraction}
              onClick={(event) => {
                stopCanvasInteraction(event);
                setDialoguePresetMenuOpen((open) => !open);
              }}
            >
              <MessageSquare size={13} aria-hidden="true" />
              <span>{es ? "Diálogo" : "Dialogue"}</span>
              <ChevronRight className="speech-beat-connector-submenu-chevron" size={13} aria-hidden="true" />
            </button>
            {dialoguePresetMenuOpen ? (
              <div className="speech-beat-connector-submenu-panel" role="menu" aria-label={es ? "Personajes recientes" : "Recent characters"}>
                <div className="speech-beat-connector-submenu-label">{es ? "Personajes recientes" : "Recent characters"}</div>
                {narrativeConnector.dialoguePresets?.length ? (
                  narrativeConnector.dialoguePresets.map((preset) => (
                    <button
                      key={`${preset.characterRef}:${preset.characterVariantId ?? "base"}`}
                      type="button"
                      role="menuitem"
                      className="speech-beat-connector-preset"
                      onPointerDown={stopCanvasInteraction}
                      onClick={(event) => {
                        stopCanvasInteraction(event);
                        narrativeConnector.onConnect("speechBeat", preset);
                        setDialoguePresetMenuOpen(false);
                        setConnectorMenuOpen(false);
                      }}
                    >
                      {preset.portraitUrl ? <img src={preset.portraitUrl} alt="" /> : <UserRound size={13} aria-hidden="true" />}
                      <span>
                        <strong>{preset.label}</strong>
                        {preset.variantLabel && preset.characterVariantId !== "base" ? <small>{preset.variantLabel}</small> : null}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="speech-beat-connector-submenu-empty">{es ? "Todavía no hay personajes conectados." : "No connected characters yet."}</div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="speech-beat-connector-new"
                  onPointerDown={stopCanvasInteraction}
                  onClick={(event) => {
                    stopCanvasInteraction(event);
                    narrativeConnector.onConnect("speechBeat");
                    setDialoguePresetMenuOpen(false);
                    setConnectorMenuOpen(false);
                  }}
                >
                  <Plus size={13} aria-hidden="true" /> {es ? "Nuevo parlamento" : "New speech"}
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); narrativeConnector.onConnect("decision"); setConnectorMenuOpen(false); }}>
            <Split size={13} aria-hidden="true" /> {es ? "Decisión" : "Decision"}
          </button>
          <button type="button" onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); narrativeConnector.onConnect("directionBeat"); setConnectorMenuOpen(false); }}>
            <Clapperboard size={13} aria-hidden="true" /> {es ? "Acotación" : "Stage direction"}
          </button>
          {narrativeConnector.onInsertConditions ? (
            <button type="button" onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); narrativeConnector.onInsertConditions?.(); setConnectorMenuOpen(false); }}>
              <GitBranch size={13} aria-hidden="true" /> {es ? "Condiciones" : "Conditions"}
            </button>
          ) : null}
        </div>
      </div>
    );
  };
  const summaryBadges = Array.isArray(nodeData.summaryBadges)
    ? nodeData.summaryBadges.filter((badge): badge is string => typeof badge === "string" && badge.length > 0)
    : [];
  const detailBadges = nodeData.badges.filter((badge) => !/^\d+ decisions?$/.test(badge));
  const infoBadges = Array.isArray(nodeData.infoBadges) ? nodeData.infoBadges : [];
  const logicSummary = nodeData.authoringLogicSummary ?? nodeData.logicSummary;
  const openLogicPart = typeof nodeData.onOpenLogicPart === "function"
    ? nodeData.onOpenLogicPart as (part: "conditions" | "consequences") => void
    : undefined;
  const openInspectorSection: OpenInspectorSection = (section, target) => {
    if (typeof nodeData.onOpenInspectorSection === "function") {
      (nodeData.onOpenInspectorSection as OpenInspectorSection)(section, target);
    } else if (section === "conditions" || section === "consequences") openLogicPart?.(section);
  };
  const showDecisionNodeTitle = nodeData.kind !== "decision" || nodeData.canvasLayerMode !== "logic";
  const identityTitle = showDecisionNodeTitle ? nodeData.title : nodeKindLabel(nodeData, es);
  const identity = <CanvasIdentity data={nodeData} es={es} title={identityTitle} onOpen={openInspectorSection} />;
  const conditionEditable = ["event", "dialogue", "dialogueStart", "speechBeat", "directionBeat", "outcome"].includes(nodeData.kind);
  const interactionEditable = conditionEditable || nodeData.kind === "interaction" || nodeData.kind === "barrier";
  const interactionConfigured = nodeData.kind === "interaction" || nodeData.kind === "barrier" || Array.isArray(nodeData.details?.interactionCards) && nodeData.details.interactionCards.length > 0;
  const nodeActions = <CanvasNodeActions logicMode={nodeData.canvasLayerMode === "logic"} conditionEditable={conditionEditable} interactionEditable={interactionEditable} conditionConfigured={Boolean(logicSummary?.when || logicSummary?.conditionCount)} interactionConfigured={interactionConfigured} interactionIsNode={nodeData.kind === "interaction" || nodeData.kind === "barrier"} es={es} onOpen={openInspectorSection} />;
  const logicBands = <>{nodeActions}<CanvasLogicSummary summary={logicSummary} logicMode={nodeData.canvasLayerMode === "logic"} conditionEditable={conditionEditable} conditionConfigured={Boolean(logicSummary?.when || logicSummary?.conditionCount)} es={es} onOpen={openInspectorSection} /></>;
  const renderInteractionCards = (cards: InteractionCard[], ownerId = id) => <div className="canvas-interaction-cards">{cards.map(card => <button key={card.id} type="button" className="nodrag nopan" title={nodeData.canvasLayerMode === 'logic' ? JSON.stringify({ mechanic: card.mechanic, results: card.results }) : card.name} onPointerDown={stopCanvasInteraction} onClick={event => { stopCanvasInteraction(event); openInspectorSection('overview', { type: 'node', id: ownerId }); }}><strong>{({ before: es ? 'Antes' : 'Before', during: es ? 'Durante' : 'During', after: es ? 'Después' : 'After' })[card.moment]}</strong>{nodeData.canvasLayerMode === 'logic' ? <D20Icon size={12} /> : null}<span>{card.name} · {card.mechanic?.kind}</span></button>)}</div>;
  const interactionCards = Array.isArray(nodeData.details?.interactionCards) ? renderInteractionCards(nodeData.details.interactionCards as InteractionCard[]) : null;
  const eventOtherBadges = detailBadges.filter((badge) =>
    badge !== eventTypeBadge && badge !== eventTypeBadgeCandidate,
  );
  const colorStyle = {
    "--node-accent": typeof nodeData.accentColor === "string" ? nodeData.accentColor : undefined,
    "--node-branch": typeof nodeData.branchColor === "string" ? nodeData.branchColor : undefined,
    "--node-type": typeof nodeData.details?.typeColor === "string" ? nodeData.details.typeColor : undefined,
    "--canvas-title-size": `${zoom < 0.65 && !selected ? Math.min(20, 13 / Math.max(0.4, zoom)) : 13}px`,
  } as CSSProperties;

  if (nodeData.kind === "routeGate") {
    const split = nodeData.details?.junctionPresentation === "split";
    const routeOptions = Array.isArray(nodeData.details?.routeOptions)
      ? nodeData.details.routeOptions.filter((option): option is {
        id: string;
        index: number;
        mode: "conditional" | "fallback";
        label: string;
        condition: string;
        conditionConfigured?: boolean;
        targetId?: string;
        targetLabel?: string;
      } => Boolean(option) && typeof option === "object" && typeof (option as { id?: unknown }).id === "string")
      : [];
    const interactionCount = Math.max(0, Number(nodeData.details?.interactionCount ?? 0));
    const conditionCount = Math.max(0, Number(nodeData.details?.conditionCount ?? 0));
    const routeSummaryLabel = `${routeOptions.length} ${es
      ? routeOptions.length === 1 ? "ruta" : "rutas"
      : routeOptions.length === 1 ? "route" : "routes"}`;
    return <div
      className={`story-node route-junction ${split ? "split" : "gate"}${focusClass}${selected ? " selected" : ""}`}
      aria-label={`${es ? "Rutas" : "Routes"} · ${routeOptions.length}`}
      style={{
        ...colorStyle,
        width: typeof nodeData.details?.logicWidth === "number" ? `${nodeData.details.logicWidth}px` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      {split ? <>
        <span className="route-junction-dot" aria-hidden="true" />
        {routeOptions.length ? <Handle
          id="route:output"
          className="route-junction-output"
          type="source"
          position={Position.Right}
        /> : null}
      </> : <>
        <div className="route-gate-heading">
          <div className="route-gate-kicker"><Split size={12} />{es ? "Enrutador" : "Router"}</div>
        </div>
        <div className="route-gate-metrics" aria-label={es ? "Resumen del enrutador" : "Router summary"}>
          <button type="button" className="route-gate-route-summary" title={es ? "Abrir las rutas del enrutador" : "Open router routes"} aria-label={`${es ? "Rutas del enrutador" : "Router routes"}: ${routeSummaryLabel}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); openInspectorSection("connections"); }}>
            <Route size={13} aria-hidden="true" /><strong>{routeOptions.length}</strong>
          </button>
          <button type="button" className="route-gate-metric condition" title={es ? "Editar las condiciones de este enrutador" : "Edit this router's conditions"} aria-label={`${es ? "Condiciones de ruta" : "Route conditions"}: ${conditionCount}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); openInspectorSection("conditions"); }}>
            <GitBranch size={13} aria-hidden="true" /><strong>{conditionCount}</strong>
          </button>
          <button type="button" className="route-gate-metric interaction" title={es ? "Editar las interacciones de este enrutador" : "Edit this router's interactions"} aria-label={`${es ? "Interacciones" : "Interactions"}: ${interactionCount}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); openInspectorSection("interactions"); }}>
            <D20Icon size={14} /><strong>{interactionCount}</strong>
          </button>
        </div>
        {routeOptions.length ? <Handle
          id="route:output"
          className="route-gate-output"
          type="source"
          position={Position.Right}
        /> : null}
      </>}
      {split && routeOptions.length === 0 ? <Handle type="source" position={Position.Right} /> : null}
    </div>;
  }

  if (nodeData.isContainer) {
    return (
      <div className={`story-node branch-container${focusClass}${inspectorFocusClass} ${selected ? "selected" : ""}`} style={colorStyle}>
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        {identity}
        {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        {logicBands}{interactionCards}
        {nodeData.badges.length > 0 ? (
          <div className="node-badges">
            {nodeData.badges.slice(0, 5).map((badge) => (
              <span key={badge}>{badgeText(badge)}</span>
            ))}
          </div>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "start") {
    return (
      <div className={`story-node start sequence-start${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`} style={colorStyle} title={`${es ? "Inicio de" : "Start of"} ${nodeData.title}`}>
        <span className="node-start-icon" aria-hidden="true" />
        <strong className="node-start-title">START</strong>
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "workspace") {
    const workspaceEditor = isWorkspaceEditor(nodeData.details?.workspaceEditor)
      ? nodeData.details.workspaceEditor
      : undefined;
    const startResize = (
      direction: WorkspaceResizeDirection,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (!workspaceEditor) return;
      event.preventDefault();
      stopCanvasInteraction(event);
      const origin = workspaceEditor.bounds;
      const startX = event.clientX;
      const startY = event.clientY;
      let latest = origin;
      const resize = (moveEvent: globalThis.PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const minimum = workspaceEditor.minBounds;
        const minimumWidth = minimum?.width ?? 720;
        const minimumHeight = minimum?.height ?? 460;
        let x = origin.x;
        let y = origin.y;
        let width = origin.width;
        let height = origin.height;
        if (direction.includes("w")) {
          x = Math.min(
            origin.x + deltaX,
            origin.x + origin.width - minimumWidth,
            minimum?.x ?? Number.POSITIVE_INFINITY,
          );
          width = origin.width + origin.x - x;
        } else if (direction.includes("e")) {
          width = Math.max(
            minimumWidth,
            origin.width + deltaX,
            minimum ? minimum.x + minimum.width - origin.x : 0,
          );
        }
        if (direction.includes("n")) {
          y = Math.min(
            origin.y + deltaY,
            origin.y + origin.height - minimumHeight,
            minimum?.y ?? Number.POSITIVE_INFINITY,
          );
          height = origin.height + origin.y - y;
        } else if (direction.includes("s")) {
          height = Math.max(
            minimumHeight,
            origin.height + deltaY,
            minimum ? minimum.y + minimum.height - origin.y : 0,
          );
        }
        latest = { x, y, width, height };
        workspaceEditor.onPreview(latest);
      };
      const finish = () => {
        workspaceEditor.onCommit(latest);
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finish, { once: true });
      window.addEventListener("pointercancel", finish, { once: true });
    };
    return (
      <div className="story-node workspace-node" style={colorStyle}>
        {workspaceEditor ? (
          WORKSPACE_RESIZE_DIRECTIONS.map((direction) => (
            <button
              key={direction}
              type="button"
              className={`workspace-resize-handle workspace-resize-${direction} nodrag nopan`}
              aria-label={`Resize working area ${direction}`}
              onPointerDown={(event) => startResize(direction, event)}
            />
          ))
        ) : null}
      </div>
    );
  }

  if (nodeData.kind === "endAdder") {
    return <EndAdderControl data={nodeData} positionAbsoluteX={positionAbsoluteX} es={es} />;
  }

  if (boundaryDirection) {
    const routeEditor = isBoundaryRouteEditor(nodeData.details?.routeEditor)
      ? nodeData.details.routeEditor
      : undefined;
    return (
      <div
        className={`story-node boundary boundary-${boundaryDirection}${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        {nodeData.details?.returnRoute === true ? (
          <Handle
            id="boundary-return"
            type="source"
            position={Position.Right}
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: "none" }}
          />
        ) : null}
        {nodeData.details?.returnTarget === true ? (
          <Handle
            id="boundary-return-target"
            type="target"
            position={Position.Left}
            isConnectable={false}
            style={{ opacity: 0, pointerEvents: "none" }}
          />
        ) : null}
        <span className="node-boundary-icon" aria-hidden="true" />
        {identity}
        {routeEditor ? (
          <NodeToolbar nodeId={id} isVisible={selected} position={Position.Bottom} offset={14}>
            <div className="canvas-node-toolbar node-boundary-actions nodrag nopan">
              <select
                aria-label={es ? routeEditor.direction === "input" ? "Evento de origen" : "Destino de la ruta" : routeEditor.direction === "input" ? "Source event" : "Route destination"}
                value={routeEditor.selectedTargetId ?? ""}
                onPointerDown={stopCanvasInteraction}
                onMouseDown={stopCanvasInteraction}
                onChange={(event) => {
                  stopCanvasInteraction(event);
                  if (event.target.value) routeEditor.onTargetChange(event.target.value);
                }}
              >
                <option value="">{es
                  ? routeEditor.direction === "input" ? "Elegir origen…" : "Elegir destino…"
                  : routeEditor.direction === "input" ? "Choose a source…" : "Choose a destination…"}</option>
                {routeEditor.targets.map((target) => (
                  <option key={target.id} value={target.id}>{target.label}</option>
                ))}
              </select>
              {routeEditor.onCreateTarget ? (
                <button
                  type="button"
                  onPointerDown={stopCanvasInteraction}
                  onMouseDown={stopCanvasInteraction}
                  onClick={(event) => {
                    stopCanvasInteraction(event);
                    routeEditor.onCreateTarget?.();
                  }}
                >
                  {es ? routeEditor.direction === "input" ? "Nuevo evento de origen" : "Nuevo destino" : routeEditor.direction === "input" ? "New source event" : "New destination"}
                </button>
              ) : null}
              {routeEditor.onDeleteEnd ? (
                <button
                  type="button"
                  className="boundary-delete-end"
                  aria-label={es ? routeEditor.direction === "input" ? "Eliminar entrada" : "Eliminar salida" : routeEditor.direction === "input" ? "Delete entry" : "Delete exit"}
                  title={es ? routeEditor.direction === "input" ? "Eliminar entrada" : "Eliminar salida" : routeEditor.direction === "input" ? "Delete entry" : "Delete exit"}
                  onPointerDown={stopCanvasInteraction}
                  onMouseDown={stopCanvasInteraction}
                  onClick={(event) => {
                    stopCanvasInteraction(event);
                    routeEditor.onDeleteEnd?.();
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          </NodeToolbar>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "decision") {
    const decision = nodeData.details?.decision as { optionStyle?: string } | undefined;
    const optionStyle = decisionEditor?.optionStyle ?? (decision?.optionStyle === "iconOnly" ? "iconOnly" : "visibleText");
    const options = Array.isArray(nodeData.details?.options)
      ? nodeData.details.options.filter(isDecisionOption)
      : [];

    return (
      <div
        ref={decisionEditorRef}
        className={`story-node decision decision-container${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        <Handle type="target" position={Position.Left} />
        {identity}
        <CanvasInfoBadges badges={infoBadges} />
        {decisionEditor ? (
          <div className="decision-style-toggle nodrag nopan" role="group" aria-label="Decision option display">
              <button
                type="button"
                className={optionStyle === "iconOnly" ? "active" : ""}
                aria-pressed={optionStyle === "iconOnly"}
                onPointerDown={stopCanvasInteraction}
                onClick={(event) => {
                  stopCanvasInteraction(event);
                  decisionEditor.onOptionStyleUpdate("iconOnly");
                }}
              >
                {es ? "Iconos" : "Icons"}
              </button>
              <button
                type="button"
                className={optionStyle === "visibleText" ? "active" : ""}
                aria-pressed={optionStyle === "visibleText"}
                onPointerDown={stopCanvasInteraction}
                onClick={(event) => {
                  stopCanvasInteraction(event);
                  decisionEditor.onOptionStyleUpdate("visibleText");
                }}
              >
                {es ? "Texto" : "Text"}
              </button>
          </div>
        ) : (
          <span className="decision-style">{optionStyle === "iconOnly" ? (es ? "Iconos" : "Icons") : (es ? "Texto" : "Text")}</span>
        )}
        {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
        <div className="decision-options">
          {options.map((option, index) => {
            const optionLetter = String.fromCharCode(65 + index);
            return (
              <div className={`decision-option${optionStyle === "iconOnly" ? " icon-mode" : ""}`} key={option.id}>
                {decisionEditor ? (
                  <button
                    type="button"
                    className="decision-option-delete nodrag nopan"
                    aria-label={`${es ? "Eliminar opción" : "Delete option"} ${optionLetter}`}
                    title={`${es ? "Eliminar opción" : "Delete option"} ${optionLetter}`}
                    onPointerDown={stopCanvasInteraction}
                    onClick={(event) => {
                      stopCanvasInteraction(event);
                      decisionEditor.onDeleteOutcome(option.id);
                    }}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                ) : null}
                {optionStyle === "iconOnly" ? (
                  <span className="decision-option-icon">{optionLetter}</span>
                ) : (
                  <>
                    <span className="decision-option-key">{optionLetter}</span>
                    {nodeData.canvasLayerMode === "logic" ? null : decisionEditor ? (
                      <button
                        type="button"
                        className={`decision-option-edit-trigger nodrag nopan${(option.visibleText ?? option.name) ? "" : " empty"}`}
                        title={(option.visibleText ?? option.name) || "Texto escrito..."}
                        aria-label={`${es ? "Editar texto de respuesta" : "Edit response text"} ${optionLetter}`}
                        onPointerDown={stopCanvasInteraction}
                        onClick={(event) => {
                          stopCanvasInteraction(event);
                          setEditingDecisionOptionId(option.id);
                        }}
                      >
                        <span>{(option.visibleText ?? option.name) || "Texto escrito..."}</span>
                      </button>
                    ) : (
                      <span className="decision-option-label">{option.visibleText ?? option.name}</span>
                    )}
                  </>
                )}
                {nodeData.canvasLayerMode === "logic" ? <>
                  <button type="button" className={`decision-option-condition nodrag nopan${option.logicSummary?.when ? " configured" : ""}${option.logicSummary?.warningCount ? " has-warning" : ""}`} aria-label={option.logicSummary?.warningCount ? `${es ? "Revisar condición de opción" : "Review option condition"} ${optionLetter}` : option.logicSummary?.when ? `${es ? "Editar condición de opción" : "Edit option condition"} ${optionLetter}` : `${es ? "Añadir condición a opción" : "Add option condition"} ${optionLetter}`} title={option.logicSummary?.warningCount ? (es ? "Revisar la condición de esta opción" : "Review this option's condition") : option.logicSummary?.when ? (es ? "Editar condición de esta opción" : "Edit this option's condition") : (es ? "Añadir condición a esta opción" : "Add a condition to this option")} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); openInspectorSection("conditions", { type: "node", id: option.handleId }); }}><GitBranch size={12} aria-hidden="true" /></button>
                  <button type="button" className={`decision-option-interaction nodrag nopan${option.interactionCards?.length ? " configured" : ""}`} aria-label={option.interactionCards?.length ? `${es ? "Editar interacción de opción" : "Edit option interaction"} ${optionLetter}` : `${es ? "Añadir interacción a opción" : "Add interaction to option"} ${optionLetter}`} title={option.interactionCards?.length ? `${es ? "Interacciones de opción" : "Option interactions"} ${optionLetter}: ${option.interactionCards.map(card => `${({ before: es ? "Antes" : "Before", during: es ? "Durante" : "During", after: es ? "Después" : "After" })[card.moment]} · ${card.name} · ${card.mechanic?.kind ?? ""}`).join("; ")}` : `${es ? "Añadir interacción a opción" : "Add interaction to option"} ${optionLetter}`} onPointerDown={stopCanvasInteraction} onClick={(event) => { stopCanvasInteraction(event); openInspectorSection("interactions", { type: "node", id: option.handleId }); }}><D20Icon size={13} />{(option.interactionCards?.length ?? 0) > 1 ? <span className="decision-option-interaction-count" aria-hidden="true">{option.interactionCards!.length}</span> : null}</button>
                </> : null}
                {decisionEditor && editingDecisionOptionId === option.id ? (
                  <div className="decision-option-editor-popover nodrag nopan">
                    <div className="decision-option-editor-header">
                      <strong>{es ? "Opción" : "Option"} {optionLetter}</strong>
                      <button
                        type="button"
                        aria-label={es ? "Cerrar editor de respuesta" : "Close response editor"}
                        title={es ? "Cerrar" : "Close"}
                        onPointerDown={stopCanvasInteraction}
                        onClick={(event) => {
                          stopCanvasInteraction(event);
                          setEditingDecisionOptionId(undefined);
                        }}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                    <DecisionOptionTextEditor
                      value={option.visibleText ?? option.name}
                      label={`${es ? "Texto de opción" : "Option text"} ${optionLetter}`}
                      onCommit={(value) => decisionEditor.onOutcomeUpdate(option.id, { visibleText: value })}
                      onEscape={() => setEditingDecisionOptionId(undefined)}
                    />
                  </div>
                ) : null}
                <Handle id={option.handleId} type="source" position={Position.Right} />
              </div>
            );
          })}
          {options.length === 0 ? <span className="decision-empty">{es ? "Añade una respuesta para crear una opción." : "Add a response to create an option."}</span> : null}
          {decisionEditor ? (
            <button
              type="button"
              className="decision-add-option nodrag nopan"
              onPointerDown={stopCanvasInteraction}
              onClick={(event) => {
                stopCanvasInteraction(event);
                decisionEditor.onCreateOutcome();
              }}
            >
              + {es ? "Añadir opción" : "Add option"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (nodeData.kind === "speechBeat" || nodeData.kind === "directionBeat") {
    const block = nodeData.details?.block as {
      content?: string;
      translations?: Record<string, string>;
      speakerRef?: string;
    } | undefined;
    const primaryLocale = quickEditor?.primaryLocale ?? "und";
    const selectedLocale = quickEditor?.activeLocale ?? primaryLocale;
    const speakerRef = quickEditor?.characterRef ?? block?.speakerRef;
    const speakerOptions = quickEditor?.speakerOptions ?? [];
    const selectedSpeaker = speakerOptions.find((speaker) => speaker.id === speakerRef);
    const selectedVariantId = selectedSpeaker?.variants.some(
      (variant) => variant.id === quickEditor?.characterVariantId,
    )
      ? quickEditor?.characterVariantId
      : "base";
    const selectedVariant = selectedSpeaker?.variants.find(
      (variant) => variant.id === selectedVariantId,
    );
    const speakerPortraitUrl = selectedVariant?.portraitUrl ?? selectedSpeaker?.portraitUrl;
    const speakerDisplayName = speakerLabel(speakerRef, selectedSpeaker?.label ?? quickEditor?.characterLabel);
    const isSpeech = nodeData.kind === "speechBeat";
    const textCounter = isSpeech ? quickEditor?.textCounter : undefined;
    const portraitFallback = !speakerRef
      ? <BookOpen size={25} aria-hidden="true" />
      : speakerRef === UNKNOWN_SPEAKER_REF
        ? <CircleHelp size={25} aria-hidden="true" />
        : <UserRound size={25} aria-hidden="true" />;
    return (
      <div
        className={`story-node speech-beat-node inline-editor${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        {identity}
        <div className={`speech-beat-inline${isSpeech ? "" : " direction"}`}>
          {!isSpeech ? <div className="direction-beat-drag-handle" title="Drag to move" aria-label="Drag stage direction">
            <GripVertical size={17} aria-hidden="true" />
          </div> : null}
          {isSpeech ? <div className="speech-beat-character">
            <div className="speech-beat-drag-surface" title="Drag to move">
              {speakerPortraitUrl ? <img className="speech-beat-avatar" src={speakerPortraitUrl} alt="" /> : <span className="speech-beat-avatar-fallback">{portraitFallback}</span>}
            </div>
            <div className="speech-beat-menu-anchor nodrag nopan" onPointerDown={stopCanvasInteraction}>
              <SpeakerSelector
                value={speakerRef}
                displayLabel={speakerDisplayName}
                options={speakerOptions}
                presentEntityIds={quickEditor?.presentEntityIds ?? []}
                onChange={(characterId) => {
                  quickEditor?.onCharacterUpdate(characterId);
                }}
                onCreateSpeaker={quickEditor?.onCreateSpeaker}
                onClose={() => setOpenBeatMenu(false)}
                onCanvasInteraction={stopCanvasInteraction}
              />
            </div>
            {selectedSpeaker && selectedSpeaker.variants.length > 1 ? (
              <label className="speech-beat-variant nodrag nopan">
                <select
                  value={selectedVariantId}
                  onPointerDown={stopCanvasInteraction}
                  onChange={(event) => quickEditor?.onCharacterVariantUpdate?.(event.target.value)}
                >
                  {selectedSpeaker.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div> : null}
          <div
            className={`speech-beat-dialogue nodrag nopan${textCounter ? " has-counter" : ""}`}
            onPointerDown={stopCanvasInteraction}
            onClick={stopCanvasInteraction}
            onDoubleClick={stopCanvasInteraction}
          >
            <div
              ref={beatContentRef}
              className="speech-beat-content"
              role="textbox"
              aria-label={isSpeech ? "Dialogue text" : "Stage direction text"}
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              data-placeholder={isSpeech ? "Write dialogue…" : "Write stage direction…"}
              onFocus={() => setOpenBeatMenu(false)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.currentTarget.blur();
                  setOpenBeatMenu(false);
                }
              }}
              onInput={(event) => {
                stopCanvasInteraction(event);
                const nextText = event.currentTarget.textContent ?? "";
                setDraftText(nextText);
                scheduleFitBeatText();
              }}
              onBlur={(event) => {
                const nextText = event.currentTarget.textContent ?? "";
                if (nextText !== draftExternalText) {
                  quickEditor?.onTextUpdate(selectedLocale, nextText);
                }
              }}
            />
            {textCounter ? (
              <div
                ref={counterEditorRef}
                className={`speech-beat-counter-tools nodrag nopan${counterEditorOpen ? " open" : ""}`}
              >
                <output
                className={`speech-beat-text-counter${draftTextCount > textCounter.target ? " over" : ""}`}
                  title="Right-click to edit the maximum for this universe"
                  onPointerDown={stopCanvasInteraction}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    stopCanvasInteraction(event);
                    if (quickEditor?.onCounterPreferenceUpdate) setCounterEditorOpen((open) => !open);
                  }}
                >
                  {countBeatText(draftText, textCounter.unit)} / {textCounter.target} {textCounter.unit === "words" ? "words" : "characters"}
                </output>
                {counterEditorOpen && quickEditor?.onCounterPreferenceUpdate ? (
                  <div
                    className="speech-beat-counter-popover"
                    onPointerDown={stopCanvasInteraction}
                    onClick={stopCanvasInteraction}
                  >
                    <div className="speech-beat-counter-popover-header">
                      <strong>Dialogue line maximum</strong>
                      <button
                        type="button"
                        aria-label="Close counter editor"
                        title="Close"
                        onPointerDown={stopCanvasInteraction}
                        onClick={(event) => {
                          stopCanvasInteraction(event);
                          setCounterEditorOpen(false);
                        }}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                    <label className="speech-beat-counter-field">
                      <span>Measure</span>
                      <select
                        value={quickEditor.counterPreference?.unit ?? textCounter.unit}
                        onPointerDown={stopCanvasInteraction}
                        onChange={(event) =>
                          quickEditor.onCounterPreferenceUpdate?.({
                            unit: event.target.value as "words" | "characters",
                          })
                        }
                      >
                        <option value="characters">Characters</option>
                        <option value="words">Words</option>
                      </select>
                    </label>
                    <label className="speech-beat-counter-field">
                      <span>Maximum</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        step={1}
                        value={quickEditor.counterPreference?.target ?? textCounter.target}
                        onPointerDown={stopCanvasInteraction}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Escape") setCounterEditorOpen(false);
                        }}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next) && next > 0) {
                            quickEditor.onCounterPreferenceUpdate?.({ target: next });
                          }
                        }}
                      />
                    </label>
                    <p className="speech-beat-counter-note">
                      {quickEditor.counterPreference?.eventOverride
                        ? "This event overrides the universe maximum; edit the event to change it."
                        : "Saved with the universe and shared by every speech beat."}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {renderNarrativeConnector()}
        {logicBands}{interactionCards}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (showEventOverview) {
    return (
      <div
        className={`story-node event event-overview${eventCoverImage ? " has-cover" : ""}${isFinalEvent ? " terminal" : ""}${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {canReceive ? <Handle type="target" position={Position.Left} /> : null}
        {eventCoverImage ? (
          <div className="event-cover-image">
            {eventCoverImage.url ? (
              <img src={eventCoverImage.url} alt={eventCoverImage.name} />
            ) : (
              <ImagePlus size={22} aria-hidden="true" />
            )}
          </div>
        ) : null}
        {identity}
        {eventTypeBadge ? (
          <div className="node-badges event-type-tag">
            <span>{badgeText(eventTypeBadge)}</span>
          </div>
        ) : null}
        {eventBranchTag ? (
          <div className="event-branch-tag" title={eventBranchTag}>
            <GitBranch size={13} aria-hidden="true" />
            <span>{eventBranchTag}</span>
          </div>
        ) : null}
        {eventOtherBadges.length > 0 ? (
          <div className="node-summary-badges">
            {eventOtherBadges.slice(0, 4).map((badge) => (
              <span key={badge}>{badgeText(badge)}</span>
            ))}
          </div>
        ) : null}
        {logicBands}{interactionCards}
        {summaryBadges.length > 0 ? (
          <div className="node-badges">
            {summaryBadges.slice(0, 3).map((badge) => (
              <span key={badge}>{badgeText(badge)}</span>
            ))}
          </div>
        ) : null}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  if (nodeData.kind === "dialogueStart") {
    const portraitUrl = typeof nodeData.details?.dialogueTriggerPortraitUrl === "string"
      ? nodeData.details.dialogueTriggerPortraitUrl
      : undefined;
    const dialogueTriggerEditor = nodeData.details?.dialogueTriggerEditor;
    const hasEditor = isDialogueTriggerEditor(dialogueTriggerEditor);
    return (
      <div
        className={`story-node dialogueStart dialogue-trigger-node${focusClass}${inspectorFocusClass}${selected ? " selected" : ""}`}
        style={colorStyle}
      >
        {identity}
        <div className="dialogue-trigger-portrait">
          {portraitUrl ? (
            <img src={portraitUrl} alt="" />
          ) : (
            <UserRound size={19} aria-hidden="true" />
          )}
        </div>
        <div className="dialogue-trigger-copy">
          {hasEditor ? (
            <>
              <div className="dialogue-trigger-heading">{es ? "Activación" : "Trigger"}</div>
              <div className="speech-beat-menu-anchor nodrag nopan" onPointerDown={stopCanvasInteraction}>
                <SpeakerSelector
                  value={dialogueTriggerEditor.selectedCharacterId}
                  options={dialogueTriggerEditor.speakerOptions}
                  presentEntityIds={dialogueTriggerEditor.presentEntityIds}
                  onChange={(characterId) => {
                    dialogueTriggerEditor.onCharacterChange(characterId);
                  }}
                  onClose={() => {}}
                  onCanvasInteraction={stopCanvasInteraction}
                />
              </div>
              <select
                className="dialogue-trigger-property nodrag nopan"
                value={dialogueTriggerEditor.selectedActionId ?? ""}
                disabled={!dialogueTriggerEditor.selectedCharacterId}
                onPointerDown={stopCanvasInteraction}
                onChange={(event) => {
                  stopCanvasInteraction(event);
                  dialogueTriggerEditor.onActionChange(event.target.value || undefined);
                }}
              >
                <option value="">{es ? "Elegir una acción…" : "Choose an action…"}</option>
                {dialogueTriggerEditor.triggerActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="dialogue-trigger-heading">{nodeData.subtitle}</span>
          )}
        </div>
        {logicBands}{interactionCards}
        {canSource ? <Handle type="source" position={Position.Right} /> : null}
      </div>
    );
  }

  return (
    <div
      className={`story-node ${nodeData.kind}${focusClass}${inspectorFocusClass}${isFinalEvent ? " terminal" : ""}${selected ? " selected" : ""}`}
      style={colorStyle}
    >
      {canReceive ? <Handle type="target" position={Position.Left} /> : null}
      {identity}
      {summaryBadges.length > 0 ? (
        <div className="node-summary-badges">
          {summaryBadges.slice(0, 3).map((badge) => (
            <span key={badge}>{badgeText(badge)}</span>
          ))}
        </div>
      ) : null}
      <CanvasInfoBadges badges={infoBadges} />
      {logicBands}{interactionCards}
      {nodeData.subtitle ? <div className="node-subtitle">{nodeData.subtitle}</div> : null}
      {detailBadges.length > 0 ? (
        <div className="node-badges">
          {detailBadges.slice(0, 4).map((badge) => (
            <span key={badge}>{badgeText(badge)}</span>
          ))}
        </div>
      ) : null}
      {nodeData.kind === 'interaction' && Array.isArray(nodeData.details?.interactionResults) ? <div className="interaction-node-results">{(nodeData.details.interactionResults as { id: string; name: string }[]).map(result => <div key={result.id} className="interaction-node-result"><span>{result.name}</span><Handle id={`interaction-result:${result.id}`} type="source" position={Position.Right} aria-label={result.name} /></div>)}</div> : null}
      {canSource ? <Handle id={nodeData.kind === "interaction" ? "interaction:output" : undefined} type="source" position={boundaryDirection === "input" ? Position.Right : Position.Right} /> : null}
    </div>
  );
}

export const nodeTypes = {
  story: memo(StoryNode),
} satisfies NodeTypes;
