import { orderedMomentEffects } from "../logic.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, GitBranch, Plus, Split, Trash2, Zap } from "lucide-react";
import type { BranchingProject, Decision, DialogueBeat, Outcome, LogicMoment } from "../domain.js";
import { addNarrativeResponse, authoringNodeOptions, connectNarrativeContinuation, endNarrativeContinuation, insertNarrativeBlock, narrativeConnections, narrativeNodeReferences, narrativeScopeNodes, setNarrativeNodeEffects, setNarrativeRouteEffects, updateNarrativeRoute, updateNarrativeSpeaker, updateNarrativeText, type NarrativeNodeReference, type NarrativeBlockKind } from "../authoringMutations.js";
import { deleteDecision, deleteDialogue, deleteDialogueBeat, deleteEventDialogueBeat, deleteOutcome, reorderOutcome, updateDecision, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateOutcome, type MutationResult } from "../projectMutations.js";
import { useInterfaceLocale } from "../i18n.js";
import { LogicConditionEditor, LogicMomentEditor } from "./LogicComposer.js";
import { NarrativeEffectEditor } from "./NarrativeEffectEditor.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import { NarrativeNameEditor } from './NarrativeNameEditor.js';
import "../authoringEditor.css";
import { createInternalTransition, updateSequence } from "../projectMutations.js";
import { inspectorFlowContext } from "../inspectorFlow.js";
import { InspectorFlowAdd } from "./InspectorFlowAdd.js";
import { InteractionsEditor } from "./InteractionsEditor.js";

export type NarrativeEditorProps = {
  project: BranchingProject; eventId: string; dialogueId?: string; selectedNodeId?: string; focusId?: string;
  navigationRequest?: { section: string; requestId?: number };
  onMutation: (mutate: (current: BranchingProject) => BranchingProject) => void | Promise<void>;
  onSelect: (nodeId: string) => void;
  section?: "path" | "content" | "choices" | "decisionSettings" | "connections" | "conditions" | "consequences";
  onSectionChange?: (section: string) => void;
  onOpenSection?: (nodeId: string, section: string) => void;
};

const copies = {
  es: { title: "Escribir historia", event: "Evento", dialogue: "Conversación", eventContent: "Contenido del evento", speech: "Diálogo", direction: "Acotación", decision: "Decisión", decisionSettings: "Ajustes de esta decisión", response: "Opción", add: "Añadir", select: "Seleccionar en el canvas", incoming: "Entradas", outgoing: "Salidas", shared: "Contenido compartido", returning: "Retorno", missing: "Referencia desaparecida", unnamed: "Sin nombre", content: "Texto", name: "Nombre", speaker: "Hablante", narrator: "Narrador", noSpeaker: "Sin hablante", continuation: "Continuación", create: "Crear contenido", connect: "Conectar contenido existente", back: "Volver a un punto anterior", end: "Terminar", choose: "Elegir destino", noExit: "Sin continuación", newRoute: "Añadir ruta alternativa", route: "Ruta", fallback: "Si ninguna ruta anterior cumple (Else)", priority: "Orden de prioridad", conditions: "Condiciones", effects: "Cambios de estado", removeRoute: "Quitar ruta", insert: "Insertar después", responses: "Opciones", locked: "Mostrar bloqueada", hidden: "Ocultar si no cumple", unavailable: "Cuando no está disponible", delete: "Eliminar", referenced: "Resuelve las conexiones antes de eliminar este contenido.", noEvent: "Selecciona un evento para escribir.", empty: "Añade la primer diálogo, acotación o decisión. Se conectará a la entrada.", noReturn: "No hay contenido anterior en este contexto.", routeHint: "Las rutas se comprueban en orden; Else se usa al final.", sourceHint: "La escritura modifica el documento y conserva los destinos compartidos.", blockedDelete: "No se pudo eliminar el contenido.", requiredName: "Escribe un nombre.", returnPoint: "Punto de regreso", locale: "Idioma del contenido", graphEntry: "Entrada", graphEnd: "Final", replace: "Cambiar destino", autoConnection: "Se conecta después de la selección", addStart: "Añadir al contexto" },
  en: { title: "Write story", event: "Event", dialogue: "Conversation", eventContent: "Event content", speech: "Dialogue", direction: "Stage direction", decision: "Decision", decisionSettings: "Decision settings", response: "Option", add: "Add", select: "Select on canvas", incoming: "Incoming", outgoing: "Outgoing", shared: "Shared content", returning: "Return", missing: "Missing reference", unnamed: "Untitled", content: "Text", name: "Name", speaker: "Speaker", narrator: "Narrator", noSpeaker: "No speaker", continuation: "Continuation", create: "Create content", connect: "Connect existing content", back: "Return to an earlier point", end: "End", choose: "Choose destination", noExit: "No continuation", newRoute: "Add alternative route", route: "Route", fallback: "If no previous route matches (Else)", priority: "Priority order", conditions: "Conditions", effects: "State changes", removeRoute: "Remove route", insert: "Insert after", responses: "Options", locked: "Show locked", hidden: "Hide when unavailable", unavailable: "When unavailable", delete: "Delete", referenced: "Resolve connections before deleting this content.", noEvent: "Select an event to write.", empty: "Add the first dialogue line, stage direction or decision. It will connect to the entry.", noReturn: "There is no earlier content in this context.", routeHint: "Routes are checked in order; Else runs last.", sourceHint: "Writing updates the document and preserves shared destinations.", blockedDelete: "Could not delete content.", requiredName: "Enter a name.", returnPoint: "Return point", locale: "Content language", graphEntry: "Entry", graphEnd: "End", replace: "Change destination", autoConnection: "Connects after the selection", addStart: "Add to context" },
};
type Copy = typeof copies.es | typeof copies.en;
type SharedProps = NarrativeEditorProps & { c: Copy; applyResult: (mutate: (project: BranchingProject) => MutationResult) => Promise<void> };

function RepeatControl({ value, onChange }: { value?: "once" | "each-entry"; onChange: (value: "once" | "each-entry") => void }) {
  const locale = useInterfaceLocale();
  return <label>{locale === "es" ? "Aplicar cambios" : "Apply changes"}<select value={value ?? "once"} onChange={event => onChange(event.target.value as "once" | "each-entry")}><option value="once">{locale === "es" ? "Una vez por recorrido" : "Once per traversal"}</option><option value="each-entry">{locale === "es" ? "Cada entrada" : "On every entry"}</option></select></label>;
}

function D20Mark({ size = 15 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2.5 8.3 4.8 1 7.7-5.5 7h-7.6l-5.5-7 1-7.7L12 2.5Z" />
    <path d="m12 2.5-3.5 5.4L12 11l3.5-3.1L12 2.5ZM3.7 7.3l4.8.6-.8 4.1L3 15l.7-7.7ZM20.3 7.3l-4.8.6.8 4.1L21 15l-.7-7.7ZM7.7 12l4.3-1 4.3 1M7.7 12l1.5 6 2.8 4 2.8-4 1.5-6M8.2 21.5 9.2 18h5.6l1.2 3.5" />
    <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="700">20</text>
  </svg>;
}

function labelForNode(references: (Pick<NarrativeNodeReference, "id" | "label"> & Partial<Pick<NarrativeNodeReference, "block" | "kind">>)[], id: string, c: Copy) {
  const node = references.find(node => node.id === id);
  return node ? node.block && !node.block.content.trim() ? c[node.kind === "speech" ? "speech" : "direction"] : node.label : (id.includes(":input:") || id.endsWith(":input") ? c.graphEntry : id.includes(":output:") || id.endsWith(":output") ? c.graphEnd : `${c.missing} · ${id}`);
}

function narrativeConnectionReferences(project: BranchingProject, eventId: string) {
  const references = new Map<string, { id: string; label: string; kind?: NarrativeNodeReference["kind"]; block?: NarrativeNodeReference["block"] }>();
  authoringNodeOptions(project, eventId).forEach(node => references.set(node.id, { id: node.id, label: node.label }));
  narrativeNodeReferences(project, eventId).forEach(node => {
    const decision = node.decisionId ? project.events.find(item => item.id === eventId)?.decisions?.find(item => item.id === node.decisionId) : undefined;
    const outcome = node.kind === "outcome" ? decision?.outcomes.find(item => item.id === node.elementId) : undefined;
    references.set(node.id, outcome && decision ? { ...node, label: decisionOptionText(decision, outcome) } : node);
  });
  return [...references.values()];
}

function decisionOptionLetter(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function revealOptionSection(surface: HTMLElement | null, section: "conditions" | "consequences" | "interactions") {
  const target = surface?.querySelector<HTMLElement>(`[data-option-section="${section}"]`);
  if (!target) return;
  const viewport = target.closest<HTMLElement>(".inspector-scroll, .inspector-connections, .inspector-debug-content");
  if (!viewport) return;
  const tabs = surface?.querySelector<HTMLElement>(".narrative-option-shared-actions");
  const fixedNavigation = viewport?.closest<HTMLElement>(".canvas-inspector")?.querySelector<HTMLElement>(".inspector-fixed-navigation");
  const fixedNavigationOffset = fixedNavigation && getComputedStyle(fixedNavigation).position === "absolute" ? fixedNavigation.offsetHeight : 0;
  const offset = fixedNavigationOffset + (tabs?.offsetHeight ?? 0) + 10;
  const bounds = viewport.getBoundingClientRect();
  const top = target.getBoundingClientRect().top - bounds.top - offset;
  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  viewport.scrollTo({ top: viewport.scrollTop + top, behavior });
}

function decisionOptionText(decision: Decision, outcome: Outcome) {
  const index = decision.outcomes.findIndex(item => item.id === outcome.id);
  const letter = decisionOptionLetter(Math.max(0, index));
  const text = outcome.visibleText || outcome.name;
  return text.replace(new RegExp(`^${letter}\\s*[·:.)-]\\s*`, "i"), "").trim() || text;
}

function NodeConnections({ project, eventId, node, onSelect, onMutation, c, section }: Pick<SharedProps, "project" | "eventId" | "onSelect" | "onMutation" | "c" | "section"> & { node: NarrativeNodeReference }) {
  const locale = useInterfaceLocale();
  const references = narrativeConnectionReferences(project, eventId);
  const { incoming, outgoing } = narrativeConnections(project, eventId, node.id);
  const flow = useMemo(() => section === "connections" ? inspectorFlowContext(project, eventId, node.id) : { sequences: [], starts: [], returns: new Set<string>() }, [project, eventId, node.id, section]);
  const [adding, setAdding] = useState(false);
  const eventNode = node.id === eventId;
  const predecessors = eventNode ? project.events.filter(event => flow.sequences.some(sequence => sequence.eventIds.includes(event.id)) && event.id !== eventId) : narrativeNodeReferences(project, eventId).filter(item => item.id !== node.id);
  return <div className="narrative-connections">
    {section === "connections" ? <h3>{c.incoming}<span className="inspector-flow-heading-tools"><span>{incoming.length + flow.starts.length}</span><InspectorFlowAdd label={locale === "es" ? "Añadir antes" : "Add before"} options={[
      { label: locale === "es" ? "Conectar un elemento anterior" : "Connect a previous element", disabled: !predecessors.length, run: () => setAdding(true) },
      ...(eventNode ? flow.sequences.map(sequence => ({ label: `${locale === "es" ? "Marcar como inicio" : "Set as start"} · ${sequence.name}`, disabled: sequence.entryEventId === eventId, run: () => { void onMutation(current => updateSequence(current, sequence.id, { entryEventId: eventId }).project); } })) : []),
    ]} /></span></h3> : <>
      <span><ArrowDown size={12} aria-hidden="true" /> {c.incoming}: {incoming.length}{incoming.length > 1 ? ` · ${c.shared}` : ""}</span>
      <span><ArrowUp size={12} aria-hidden="true" /> {c.outgoing}: {outgoing.length}</span>
    </>}
    {section === "connections" ? flow.starts.map(sequence => <div key={sequence.id} className="inspector-flow-start"><ArrowDown size={14} aria-hidden="true" /><strong>{locale === "es" ? "Inicio" : "Start"}</strong><span>{sequence.entryLabel || sequence.name}</span></div>) : null}
    {section === "connections" && !incoming.length && !flow.starts.length ? <p className="inspector-route-empty">{locale === "es" ? "No hay conexiones anteriores en este contexto." : "No earlier connections in this context."}</p> : null}
    {incoming.length ? <div>{incoming.map(route => <span className="narrative-incoming-route" key={route.id}><button type="button" onClick={() => onSelect(route.from)} title={route.from}>↳ {labelForNode(references, route.from, c)}{flow.returns.has(route.id) ? <span className="inspector-flow-return"> · ↶ {c.returning}</span> : null}</button><button type="button" aria-label={`${c.removeRoute} · ${labelForNode(references, route.from, c)} → ${node.label}`} onClick={() => { void onMutation(current => ({ ...current, events: current.events.map(event => event.transitions?.some(item => item.id === route.id) ? { ...event, transitions: event.transitions.filter(item => item.id !== route.id) } : event) })); }}><Trash2 size={12} /></button></span>)}</div> : null}
    {adding ? <label className="field-label">{locale === "es" ? "Elemento anterior" : "Previous element"}<select value="" onChange={event => { const from = event.target.value; if (!from) return; void onMutation(current => createInternalTransition(current, eventNode ? from : eventId, from, node.id).project); setAdding(false); }}><option value="">{c.choose}</option>{predecessors.map(item => <option key={item.id} value={item.id}>{"name" in item ? item.name : item.label}</option>)}</select><button type="button" onClick={() => setAdding(false)}>{locale === "es" ? "Cancelar" : "Cancel"}</button></label> : null}
  </div>;
}

function ContinuationEditor({ project, eventId, node, c, onMutation, onSelect, applyResult, section, onSectionChange, onOpenSection }: SharedProps & { node: NarrativeNodeReference }) {
  const locale = useInterfaceLocale();
  const [mode, setMode] = useState<"create" | "connect" | "return">();
  const [replacingRouteId, setReplacingRouteId] = useState<string>();
  const references = narrativeConnectionReferences(project, eventId);
  const scoped = narrativeScopeNodes(project, eventId, node.dialogueId);
  const earlier = scoped.slice(0, Math.max(0, scoped.findIndex(item => item.id === node.id || (node.decisionId && item.elementId === node.decisionId))));
  const outgoing = narrativeConnections(project, eventId, node.id).outgoing;
  const returnTargets = earlier.filter(item => item.id !== node.id);
  const chooseDestination = (to: string) => { void applyResult(current => connectNarrativeContinuation(current, eventId, node.id, to, replacingRouteId)); setMode(undefined); setReplacingRouteId(undefined); };
  return <section className="narrative-continuation" aria-label={`${c.continuation} · ${node.label}`}>
    {section === "connections" ? <h3>{c.continuation}<span className="inspector-flow-heading-tools"><span>{outgoing.length}</span><InspectorFlowAdd label={locale === "es" ? "Añadir después" : "Add after"} options={[
      { label: c.create, run: () => { setReplacingRouteId(undefined); setMode("create"); } },
      { label: c.connect, run: () => { setReplacingRouteId(undefined); setMode("connect"); } },
      { label: c.back, disabled: !returnTargets.length, run: () => { setReplacingRouteId(undefined); setMode("return"); } },
      { label: c.end, run: () => { void applyResult(current => endNarrativeContinuation(current, eventId, node.id, node.dialogueId)); } },
    ]} /></span></h3> : <h5>{c.continuation}</h5>}
    {!outgoing.length ? <p className={`narrative-muted${section === "connections" ? " inspector-route-empty" : ""}`}>{c.noExit}</p> : null}
    {outgoing.map(route => {
      const target = references.find(item => item.id === route.to);
      const destinationLabel = labelForNode(references, route.to, c);
      if (section === "connections") {
        const navigationLabel = `${locale === "es" ? "Ir a" : "Go to"} ${destinationLabel}`;
        return <div className="inspector-route-destination" key={route.id}>
          <span>{destinationLabel}</span>
          <button className="inspector-route-navigate" type="button" disabled={!target} aria-label={navigationLabel} title={navigationLabel} onClick={() => onSelect(route.to)}><ArrowRight size={16} aria-hidden="true" /></button>
        </div>;
      }
      const shared = narrativeConnections(project, eventId, route.to).incoming.length > 1;
      const returning = scoped.findIndex(item => item.id === route.to) >= 0 && scoped.findIndex(item => item.id === route.to) <= scoped.findIndex(item => item.id === node.id || item.elementId === node.decisionId);
      return <details className="narrative-route" key={route.id}>
        <summary><GitBranch size={13} aria-hidden="true" /> {destinationLabel} {returning ? <span>↶ {c.returning}</span> : shared ? <span>{c.shared}</span> : null}</summary>
        {target ? <button type="button" onClick={() => onSelect(route.to)}>{c.select}</button> : null}
        <label>{c.priority}<input type="number" min={0} value={route.order ?? 0} onChange={event => { const order = Number(event.target.value); if (Number.isInteger(order) && order >= 0) void onMutation(current => updateNarrativeRoute(current, eventId, route.id, { order })); }} /></label>
        <label className="narrative-check"><input type="checkbox" checked={route.mode === "fallback"} onChange={event => { const fallback = event.target.checked; void onMutation(current => updateNarrativeRoute(current, eventId, route.id, { mode: fallback ? "fallback" : "conditional", role: "route", conditions: fallback ? undefined : route.conditions, logic: fallback ? { ...route.logic, when: undefined } : route.logic })); }} /> {c.fallback}</label>
        {!section ? <>
          {route.mode !== "fallback" ? <LogicConditionEditor project={project} draftId={route.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: route.from, routeId: route.id }} compact value={route.logic?.when ?? route.conditions} label={locale === "es" ? "Seguir esta ruta si" : "Follow this route if"} onChange={when => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.transitions?.find(item => item.id === route.id); return updateNarrativeRoute(current, eventId, route.id, { role: "route", conditions: when, logic: { ...latest?.logic, when } }); }); }} /> : null}
          <NarrativeEffectEditor project={project} draftId={route.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: route.from, routeId: route.id }} value={orderedMomentEffects(route.logic, route.consequences)} onChange={effects => { void onMutation(current => setNarrativeRouteEffects(current, eventId, route.id, effects)); }} />
          <RepeatControl value={route.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.transitions?.find(item => item.id === route.id); return updateNarrativeRoute(current, eventId, route.id, { logic: { ...latest?.logic, repeat } }); }); }} />
        </> : <div className="narrative-actions">{["conditions", "connections"].map(part => <button key={part} type="button" onClick={() => { const id = `edge:transition:${route.id}`; if (onOpenSection) onOpenSection(id, part); else { onSelect(id); onSectionChange?.(part); } }}>{part === "conditions" ? c.conditions : c.continuation}</button>)}</div>}
        <div className="narrative-actions"><button type="button" onClick={() => { setReplacingRouteId(route.id); setMode("create"); }}>{c.insert}</button><button type="button" onClick={() => { setReplacingRouteId(route.id); setMode("connect"); }}>{c.replace}</button><button type="button" onClick={() => { void onMutation(current => ({ ...current, events: current.events.map(event => event.transitions?.some(item => item.id === route.id) ? { ...event, transitions: event.transitions.filter(item => item.id !== route.id) } : event) })); }}>{c.removeRoute}</button></div>
      </details>;
    })}
    {section !== "connections" ? <div className="narrative-actions">
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("create"); }}><Plus size={13} /> {c.create}</button>
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("connect"); }}>{c.connect}</button>
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("return"); }} disabled={!returnTargets.length}><CornerDownLeft size={13} /> {c.back}</button>
      <button type="button" onClick={() => { void applyResult(current => endNarrativeContinuation(current, eventId, node.id, node.dialogueId)); }}>{c.end}</button>
    </div> : null}
    {mode === "create" ? <div className="narrative-actions" aria-label={c.create}>{(["speech", "direction", "decision"] as const).map(kind => <button key={kind} type="button" onClick={() => { void applyResult(current => insertNarrativeBlock(current, eventId, kind, { dialogueId: node.dialogueId, afterNodeId: node.id, beforeNodeId: outgoing.find(route => route.id === replacingRouteId)?.to, asAlternative: !replacingRouteId && outgoing.length > 0 })); setMode(undefined); }}>{c[kind]}</button>)}</div> : mode ? <label>{mode === "return" ? c.returnPoint : c.choose}<select value="" onChange={event => chooseDestination(event.target.value)}><option value="">{c.choose}</option>{(mode === "return" ? returnTargets : references.filter(item => item.id !== node.id)).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
    {section !== "connections" && outgoing.length > 1 ? <p className="narrative-muted">{c.routeHint}</p> : null}
  </section>;
}

function DecisionOptionConnectionContext({ decision, outcome }: { decision: Decision; outcome: Outcome }) {
  const locale = useInterfaceLocale();
  const index = decision.outcomes.findIndex(item => item.id === outcome.id);
  return <div className="narrative-decision-option-context">
    <span className="narrative-decision-option-marker">{decisionOptionLetter(Math.max(0, index))}</span>
    <span>{locale === "es" ? "Opción de la decisión" : "Decision option"}</span>
    <strong>{decisionOptionText(decision, outcome)}</strong>
  </div>;
}

function DecisionConnectionOptions({ project, eventId, decision, shared }: {
  project: BranchingProject;
  eventId: string;
  decision: Decision;
  shared: SharedProps;
}) {
  const locale = useInterfaceLocale();
  const references = narrativeNodeReferences(project, eventId);
  return <section className="narrative-decision-connections" aria-label={locale === "es" ? "Destinos por opción" : "Destinations by option"}>
    <h3>{locale === "es" ? "Continuación por opción" : "Continuation by option"}</h3>
    <div className="narrative-decision-connection-list">
      {decision.outcomes.map((outcome, index) => {
        const id = `outcome:${eventId}:${decision.id}:${outcome.id}`;
        const node = references.find(reference => reference.id === id) ?? {
          id,
          elementId: outcome.id,
          kind: "outcome" as const,
          label: decisionOptionText(decision, outcome),
          decisionId: decision.id,
          dialogueId: decision.dialogueId,
        };
        return <article key={outcome.id} className="narrative-decision-connection-option">
          <header className="narrative-decision-connection-heading">
            <span className="narrative-decision-option-marker">{decisionOptionLetter(index)}</span>
            <div><small>{locale === "es" ? "Opción" : "Option"} {decisionOptionLetter(index)}</small><strong>{decisionOptionText(decision, outcome)}</strong></div>
          </header>
          <ContinuationEditor {...shared} node={node} />
        </article>;
      })}
    </div>
  </section>;
}

function OutcomeConditionsEditor({ project, eventId, decision, outcome, onMutation }: Pick<SharedProps, "project" | "eventId" | "onMutation"> & { decision: Decision; outcome: Outcome }) {
  const locale = useInterfaceLocale();
  const nodeId = `outcome:${eventId}:${decision.id}:${outcome.id}`;
  const updateCondition = (conditions: Parameters<typeof LogicConditionEditor>[0]["value"]) => onMutation(current => {
    const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id);
    return updateOutcome(current, eventId, decision.id, outcome.id, { conditions, logic: { ...latest?.logic, when: conditions } }).project;
  });
  return <LogicConditionEditor project={project} draftId={nodeId} context={{ eventId, dialogueId: decision.dialogueId, nodeId }} compact value={outcome.logic?.when ?? outcome.conditions ?? outcome.availability} label={locale === "es" ? "Se ofrece cuando" : "Offered when"} emptyMessage={locale === "es" ? "Se mostrará siempre. Añade condiciones para definir cuándo debe mostrarse." : "Always shown. Add conditions to define when it should appear."} onChange={conditions => { void updateCondition(conditions); }} />;
}

function OutcomeConsequencesEditor({ project, eventId, decision, outcome, onMutation }: Pick<SharedProps, "project" | "eventId" | "onMutation"> & { decision: Decision; outcome: Outcome }) {
  const locale = useInterfaceLocale(), es = locale === "es";
  const nodeId = `outcome:${eventId}:${decision.id}:${outcome.id}`;
  const setRepeat = (repeat: "once" | "each-entry") => onMutation(current => {
    const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id);
    return updateOutcome(current, eventId, decision.id, outcome.id, { logic: { ...latest?.logic, repeat } }).project;
  });
  return <section className="narrative-outcome-consequences-view" aria-label={es ? "Consecuencias de la opción" : "Option consequences"}>
    <div className="logic-composer condition-ux condition-rows-editor narrative-consequence-editor">
      <section className="condition-friendly-group">
        <header className="condition-friendly-group-header narrative-consequence-header">
          <strong className="condition-group-root-label">{es ? "Después de" : "After"}</strong>
          <label className="narrative-consequence-repeat">
            <select aria-label={es ? "Frecuencia de los cambios" : "Change frequency"} value={outcome.logic?.repeat ?? "once"} onChange={event => { void setRepeat(event.target.value as "once" | "each-entry"); }}>
              <option value="once">{es ? "Una vez por recorrido" : "Once per traversal"}</option>
              <option value="each-entry">{es ? "Cada entrada" : "On every entry"}</option>
            </select>
          </label>
          <span className="narrative-consequence-tail">{es ? "pasan los siguientes cambios:" : "the following changes happen:"}</span>
        </header>
        <div className="condition-group-body">
          <NarrativeEffectEditor project={project} draftId={nodeId} context={{ eventId, dialogueId: decision.dialogueId, nodeId }} value={orderedMomentEffects(outcome.logic, outcome.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, nodeId, effects)); }} />
        </div>
      </section>
    </div>
  </section>;
}

function ResponseEditor(props: SharedProps & { decision: Decision; outcome: Outcome; managedByDecision?: boolean; optionTextInHeader?: boolean; conditionEditorOpen?: boolean; consequenceEditorOpen?: boolean; interactionEditorOpen?: boolean }) {
  const { project, eventId, decision, outcome, c, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const managedByDecision = Boolean(props.managedByDecision);
  const node: NarrativeNodeReference = { id: `outcome:${eventId}:${decision.id}:${outcome.id}`, elementId: outcome.id, kind: "outcome", label: outcome.visibleText || outcome.name, decisionId: decision.id, dialogueId: decision.dialogueId };
  const position = decision.outcomes.findIndex(item => item.id === outcome.id);
  const update = (updates: Partial<Outcome>) => onMutation(current => updateOutcome(current, eventId, decision.id, outcome.id, updates).project);
  const move = (direction: -1 | 1) => onMutation(current => {
    const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id);
    const index = latest?.outcomes.findIndex(item => item.id === outcome.id) ?? -1;
    const target = latest?.outcomes[index + direction];
    if (!latest || !target) return current;
    return reorderOutcome(current, eventId, decision.id, outcome.id, target.id, direction < 0 ? "before" : "after").project;
  });
  return <article className={`narrative-response${props.selectedNodeId === node.id || managedByDecision ? " selected" : ""}${managedByDecision ? " managed" : ""}`} data-narrative-node={node.id} data-authoring-id={node.id}>
    {!managedByDecision ? <>
      <header><button type="button" className="narrative-node-title" onClick={() => onSelect(node.id)}>{position + 1}. {c.response} · {outcome.name}</button><div className="narrative-actions"><button type="button" aria-label={`${locale === "es" ? "Subir respuesta" : "Move response up"} · ${outcome.name}`} disabled={position <= 0} onClick={() => { void move(-1); }}><ArrowUp size={13} /></button><button type="button" aria-label={`${locale === "es" ? "Bajar respuesta" : "Move response down"} · ${outcome.name}`} disabled={position < 0 || position >= decision.outcomes.length - 1} onClick={() => { void move(1); }}><ArrowDown size={13} /></button><details><summary aria-label={`${locale === "es" ? "Más opciones" : "More options"} · ${outcome.name}`}>⋯</summary><button type="button" className="danger" aria-label={`${c.delete} ${outcome.name}`} title={c.delete} onClick={() => { void props.applyResult(current => deleteOutcome(current, eventId, decision.id, outcome.id)); }}><Trash2 size={13} /> {c.delete}</button></details></div></header>
      <div className="narrative-name-heading narrative-option-identity"><span className="narrative-option-name">{outcome.name}</span><span className="narrative-node-separator" aria-hidden="true">·</span><span className="narrative-node-kind">{c.response}</span><NarrativeNameEditor project={project} nodeId={node.id} onMutation={onMutation}/></div>
    </> : null}
    {!props.optionTextInHeader ? <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-text" label={locale === "es" ? "Texto de la opción" : "Option text"} value={outcome.visibleText ?? ""} onCommit={visibleText => update({ visibleText })} /> : null}
    {managedByDecision ? props.conditionEditorOpen ? <div className="narrative-option-section-anchor" data-option-section="conditions"><OutcomeConditionsEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /></div> : null : <section className="narrative-option-section"><details className="narrative-option-conditions"><summary>{locale === "es" ? "Condiciones" : "Conditions"}</summary><OutcomeConditionsEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /></details></section>}
    {managedByDecision ? props.consequenceEditorOpen ? <div className="narrative-option-section-anchor" data-option-section="consequences"><OutcomeConsequencesEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /></div> : null : <section className="narrative-option-section"><details className="narrative-option-consequences"><summary>{locale === "es" ? "Consecuencias" : "Consequences"}</summary><OutcomeConsequencesEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /></details></section>}
    {managedByDecision && props.interactionEditorOpen ? <div className="narrative-option-section-anchor" data-option-section="interactions"><InteractionsEditor project={project} eventId={eventId} ownerNodeId={node.id} dialogueId={decision.dialogueId} optionContext onMutation={onMutation} onSelect={onSelect} /></div> : null}
    {!managedByDecision && (!props.section || props.section === "choices") ? <><NodeConnections {...props} node={node} /><ContinuationEditor {...props} node={node} /></> : null}
  </article>;
}

function BeatEditor(props: SharedProps & { node: NarrativeNodeReference; contentLocale: string }) {
  const { node, project, eventId, c, onMutation, contentLocale } = props;
  if (!node.beat) return null;
  if (!node.block) return <p className="authoring-field-error" role="alert">{c.missing} · {node.beat.blockRef.scriptId} / {node.beat.blockRef.blockId}</p>;
  const beat = node.beat;
  const primary = project.localizationCatalog?.primaryLocale ?? "und";
  const text = project.localizationCatalog?.entries[node.block?.textKey ?? ""]?.values[contentLocale] ?? (contentLocale === primary ? node.block?.content ?? "" : node.block?.translations?.[contentLocale] ?? "");
  const update = (updates: Partial<DialogueBeat>) => onMutation(current => node.dialogueId ? updateDialogueBeat(current, eventId, node.dialogueId, beat.id, updates).project : updateEventDialogueBeat(current, eventId, beat.id, updates).project);
  const speakers = [...project.canonRefs.map(ref => ({ id: ref.id, label: ref.label ?? ref.id })), ...(project.localExplorerEntities ?? []).map(entity => ({ id: entity.id, label: entity.name ?? entity.id }))];
  const selectedSpeaker = node.block?.characterRef ?? node.block?.speakerRef ?? "";
  return <>
    {node.kind === "speech" ? <label>{c.speaker}<select value={selectedSpeaker} onChange={event => { void onMutation(current => updateNarrativeSpeaker(current, eventId, beat.id, event.target.value || undefined)); }}><option value="">{c.noSpeaker}</option>{selectedSpeaker && !speakers.some(speaker => speaker.id === selectedSpeaker) ? <option value={selectedSpeaker}>{c.missing} · {selectedSpeaker}</option> : null}{speakers.map(speaker => <option value={speaker.id} key={speaker.id}>{speaker.label}</option>)}</select></label> : null}
    <AuthoringTextField projectId={project.projectId} elementId={beat.id} field={`text:${contentLocale}`} label={c.content} value={text} multiline rows={4} onCommit={content => onMutation(current => updateNarrativeText(current, eventId, beat.id, content, contentLocale))} />
    {!props.section ? <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} compact value={beat.logic?.when ?? beat.displayCondition} label={c.conditions} onChange={displayCondition => { void update({ displayCondition }); }} /><NarrativeEffectEditor project={project} draftId={node.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} value={orderedMomentEffects(beat.logic, beat.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} /><RepeatControl value={beat.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = narrativeNodeReferences(current, eventId).find(item => item.id === node.id)?.beat; return node.dialogueId ? updateDialogueBeat(current, eventId, node.dialogueId, beat.id, { logic: { ...latest?.logic, repeat } }).project : updateEventDialogueBeat(current, eventId, beat.id, { logic: { ...latest?.logic, repeat } }).project; }); }} /></details> : null}
  </>;
}

/** Focused inspector views use the modular document directly, sharing the same draft keys. */
export function NarrativeInspectorSection(props: NarrativeEditorProps & { section: NonNullable<NarrativeEditorProps["section"]> }) {
  const { project, eventId, section, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const c: Copy = section === "connections" ? { ...copies[locale], ...(locale === "es"
    ? { title: "Recorrido", incoming: "Antes", outgoing: "Destinos", continuation: "Después", create: "Crear continuación", connect: "Elegir destino existente", end: "Finalizar aquí", noExit: "Todavía no hay un destino conectado." }
    : { title: "Story flow", incoming: "Before", outgoing: "Destinations", continuation: "After", create: "Create continuation", connect: "Choose existing destination", end: "End here", noExit: "No destination is connected yet." }) } : section === "choices" ? { ...copies[locale], title: copies[locale].responses } : copies[locale];
  const event = project.events.find(item => item.id === eventId);
  const refs = narrativeNodeReferences(project, eventId);
  const selected = refs.find(item => item.id === props.selectedNodeId);
  const dialogueId = props.dialogueId ?? selected?.dialogueId ?? (selected?.kind === "dialogue" ? selected.elementId : undefined);
  const dialogue = event?.dialogues?.find(item => item.id === dialogueId);
  const nodes = narrativeScopeNodes(project, eventId, dialogueId);
  const selectedDecision = selected?.kind === "decision" ? event?.decisions?.find(item => item.id === selected.elementId) : selected?.decisionId ? event?.decisions?.find(item => item.id === selected.decisionId) : undefined;
  const selectedOutcome = selected?.kind === "outcome" ? selectedDecision?.outcomes.find(item => item.id === selected.elementId) : undefined;
  const selectedDecisionId = selectedDecision?.id;
  const focusedOutcomeId = selectedOutcome?.id ?? refs.find(item => item.id === props.focusId && item.kind === "outcome")?.elementId;
  const [activeOutcomeId, setActiveOutcomeId] = useState<string | undefined>(() => focusedOutcomeId ?? selectedDecision?.outcomes[0]?.id);
  const [optionEditorSection, setOptionEditorSection] = useState<"conditions" | "consequences" | "interactions">("conditions");
  const [optionScrollRequest, setOptionScrollRequest] = useState(0);
  const pendingOptionSectionScroll = useRef<"conditions" | "consequences" | "interactions" | undefined>(undefined);
  const [outcomeDrag, setOutcomeDrag] = useState<{ sourceId: string; targetId?: string; position?: "before" | "after" }>();
  const optionSurface = useRef<HTMLDivElement>(null);
  const optionActionsRef = useRef<HTMLDivElement>(null);
  const optionStickySentinelRef = useRef<HTMLDivElement>(null);
  const [optionActionsSticky, setOptionActionsSticky] = useState(false);
  const optionPickerRef = useRef<HTMLDivElement>(null);
  const optionPickerEdgeScrollFrame = useRef<number | undefined>(undefined);
  const [optionPickerEdges, setOptionPickerEdges] = useState({ overflow: false, left: false, right: false });
  const decisionFlowRef = useRef<HTMLDivElement>(null);
  const [decisionFlowPaths, setDecisionFlowPaths] = useState<{ id: string; d: string; active?: boolean }[]>([]);
  const decision = selectedDecision;
  const outcome = decision?.outcomes.find(item => item.id === activeOutcomeId) ?? selectedOutcome;
  const requestOptionSection = (next: "conditions" | "consequences" | "interactions") => {
    pendingOptionSectionScroll.current = next;
    setOptionEditorSection(next);
    setOptionScrollRequest(current => current + 1);
  };
  const activeOutcomeIds = JSON.stringify(decision?.outcomes.map(item => item.id) ?? []);
  const renderOutcomeButton = (item: Outcome, index: number, compact = false) => {
    const letter = decisionOptionLetter(index);
    const label = item.visibleText || item.name || `${c.response} ${letter}`;
    const active = outcome?.id === item.id;
    const button = <button key={item.id} type="button" className={`narrative-option-picker-select${active ? " active" : ""}`} data-outcome-id={item.id} aria-label={`${c.response} ${letter}: ${label}`} aria-pressed={active} aria-current={active ? "true" : undefined} title={`${label} · ${locale === "es" ? "Arrastra para reordenar; usa Alt + flechas para mover" : "Drag to reorder; use Alt + arrow keys to move"}`} onClick={() => { if (!active) { setActiveOutcomeId(item.id); setOptionEditorSection("conditions"); } }} onKeyDown={event => { if (!event.altKey || !["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) return; const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1; const currentIndex = decision?.outcomes.findIndex(option => option.id === item.id) ?? -1; const target = decision?.outcomes[currentIndex + direction]; if (!target || !decision) return; event.preventDefault(); void applyResult(current => reorderOutcome(current, eventId, decision.id, item.id, target.id, direction < 0 ? "before" : "after")); }}><span className="narrative-decision-index">{letter}</span></button>;
    if (compact || !decision) return button;
    return <div className={`narrative-option-item narrative-option-branch${active ? " active is-selected" : ""}`} key={item.id} data-dragging={outcomeDrag?.sourceId === item.id || undefined} data-drop-position={outcomeDrag?.targetId === item.id ? outcomeDrag.position : undefined} draggable
      onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); setOutcomeDrag({ sourceId: item.id }); }}
      onDragOver={event => { const sourceId = outcomeDrag?.sourceId ?? event.dataTransfer.getData("text/plain"); if (!sourceId || sourceId === item.id) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; const rect = event.currentTarget.getBoundingClientRect(); const position = event.clientX < rect.left + rect.width / 2 ? "before" : "after"; setOutcomeDrag(current => current?.sourceId === sourceId && current.targetId === item.id && current.position === position ? current : { sourceId, targetId: item.id, position }); }}
      onDragLeave={event => { if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return; setOutcomeDrag(current => current ? { sourceId: current.sourceId } : undefined); }}
      onDrop={event => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain") || outcomeDrag?.sourceId; const rect = event.currentTarget.getBoundingClientRect(); const position = event.clientX < rect.left + rect.width / 2 ? "before" : "after"; if (sourceId && sourceId !== item.id) void applyResult(current => reorderOutcome(current, eventId, decision.id, sourceId, item.id, position)); setOutcomeDrag(undefined); }}
      onDragEnd={() => setOutcomeDrag(undefined)}>{button}</div>;
  };
  const stopOptionPickerEdgeScroll = () => {
    if (optionPickerEdgeScrollFrame.current !== undefined) cancelAnimationFrame(optionPickerEdgeScrollFrame.current);
    optionPickerEdgeScrollFrame.current = undefined;
  };
  const startOptionPickerEdgeScroll = (direction: -1 | 1) => {
    stopOptionPickerEdgeScroll();
    const picker = optionPickerRef.current;
    if (!picker) return;
    let previousTime = 0;
    const step = (time: number) => {
      const maxScroll = picker.scrollWidth - picker.clientWidth;
      if ((direction < 0 && picker.scrollLeft <= 0) || (direction > 0 && picker.scrollLeft >= maxScroll - 1)) {
        optionPickerEdgeScrollFrame.current = undefined;
        return;
      }
      const elapsed = previousTime ? Math.min(32, time - previousTime) : 16;
      previousTime = time;
      picker.scrollLeft += direction * elapsed * 0.55;
      optionPickerEdgeScrollFrame.current = requestAnimationFrame(step);
    };
    optionPickerEdgeScrollFrame.current = requestAnimationFrame(step);
  };
  useEffect(() => () => stopOptionPickerEdgeScroll(), []);
  useEffect(() => {
    const picker = optionPickerRef.current;
    if (!picker || !optionActionsSticky || section !== "choices" || !decision) {
      setOptionPickerEdges({ overflow: false, left: false, right: false });
      return;
    }
    const updateEdges = () => {
      const maxScroll = Math.max(0, picker.scrollWidth - picker.clientWidth);
      const next = { overflow: maxScroll > 1, left: picker.scrollLeft > 1, right: picker.scrollLeft < maxScroll - 1 };
      setOptionPickerEdges(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right ? current : next);
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(picker);
    if (picker.firstElementChild) observer.observe(picker.firstElementChild);
    window.addEventListener("resize", updateEdges);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateEdges); };
  }, [section, decision?.id, activeOutcomeIds, optionActionsSticky]);
  useEffect(() => {
    const actions = optionActionsRef.current;
    const sentinel = optionStickySentinelRef.current;
    if (!actions || !sentinel || section !== "choices" || !decision || !outcome) {
      setOptionActionsSticky(false);
      return;
    }
    const viewport = actions.closest<HTMLElement>(".inspector-scroll, .inspector-connections, .inspector-debug-content");
    const updateStickyStateNow = () => {
      const sentinelBounds = sentinel.getBoundingClientRect();
      const actionsBounds = actions.getBoundingClientRect();
      const viewportBounds = viewport?.getBoundingClientRect();
      const viewportPaddingTop = viewport ? Number.parseFloat(getComputedStyle(viewport).paddingTop) || 0 : 0;
      const top = (viewportBounds?.top ?? 0) + viewportPaddingTop + (Number.parseFloat(getComputedStyle(actions).top) || 0);
      const hasPassed = sentinelBounds.bottom <= top + 1;
      const isStuck = hasPassed && Math.abs(actionsBounds.top - top) <= 2;
      setOptionActionsSticky(current => current === isStuck ? current : isStuck);
    };
    let frame: number | undefined;
    const updateStickyState = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        updateStickyStateNow();
      });
    };
    updateStickyStateNow();
    viewport?.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("scroll", updateStickyState, true);
    window.addEventListener("resize", updateStickyState);
    const viewportPaddingTop = viewport ? Number.parseFloat(getComputedStyle(viewport).paddingTop) || 0 : 0;
    const stickyTop = Number.parseFloat(getComputedStyle(actions).top) || 0;
    const intersectionObserver = new IntersectionObserver(updateStickyState, {
      root: viewport,
      rootMargin: `-${viewportPaddingTop + stickyTop}px 0px 0px 0px`,
      threshold: 0,
    });
    intersectionObserver.observe(sentinel);
    const observer = new ResizeObserver(updateStickyState);
    observer.observe(actions);
    if (viewport) observer.observe(viewport);
    return () => {
      viewport?.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("scroll", updateStickyState, true);
      window.removeEventListener("resize", updateStickyState);
      intersectionObserver.disconnect();
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [section, decision?.id, outcome?.id]);
  useEffect(() => {
    if (section !== "choices" || !decision || optionActionsSticky) {
      setDecisionFlowPaths([]);
      return;
    }
    const surface = decisionFlowRef.current;
    if (!surface) return;

    const updatePaths = () => {
      const bounds = surface.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const point = (element: Element | null, edge: "top" | "bottom") => {
        if (!(element instanceof HTMLElement)) return undefined;
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - bounds.left, y: (edge === "top" ? rect.top : rect.bottom) - bounds.top };
      };
      const actionBar = surface.querySelector(".narrative-option-shared-actions");
      const activeButton = surface.querySelector(".narrative-option-branch.is-selected .narrative-option-picker-select");
      const activeBottom = point(activeButton, "bottom");
      const actionTabs = [...(actionBar?.querySelectorAll<HTMLElement>(".narrative-option-configure-condition, .narrative-option-configure-interaction, .narrative-option-configure-consequence") ?? [])];
      const actionTabTops = actionTabs.map(tab => point(tab, "top")).filter((value): value is NonNullable<typeof value> => Boolean(value));
      const selectedActionTab = actionTabs.find(tab => tab.classList.contains("active")) ?? actionTabs[0];
      const selectedActionTabTop = point(selectedActionTab ?? null, "top");
      const paths: { id: string; d: string; active?: boolean }[] = [];
      const add = (id: string, d: string, active = false) => { if (d.trim()) paths.push({ id, d, active }); };
      if (actionTabTops.length) {
        // Keep enough vertical run for the highlighted route to read clearly
        // from the selected option, across the shared bus, and into its tab.
        const tabBusY = Math.min(...actionTabTops.map(item => item.y)) - 42;
        const tabCenters = actionTabTops.map(item => item.x);
        add("option-settings-bus", `M ${Math.min(...tabCenters)} ${tabBusY} H ${Math.max(...tabCenters)}`);
        actionTabTops.forEach((item, index) => add(`option-setting-${index}`, `M ${item.x} ${tabBusY} V ${item.y}`));
        if (activeBottom && selectedActionTabTop) {
          add("selected-option-settings-route", `M ${activeBottom.x} ${activeBottom.y} V ${tabBusY} H ${selectedActionTabTop.x} V ${selectedActionTabTop.y}`, true);
        }
      }
      setDecisionFlowPaths(current => current.length === paths.length && current.every((path, index) => {
        const next = paths[index];
        return path.id === next.id && path.d === next.d && path.active === next.active;
      }) ? current : paths);
    };

    updatePaths();
    let frame: number | undefined;
    const schedulePathsUpdate = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        updatePaths();
      });
    };
    const observer = new ResizeObserver(schedulePathsUpdate);
    observer.observe(surface);
    surface.querySelectorAll(".narrative-option-picker-select, .narrative-option-shared-actions").forEach(element => observer.observe(element));
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [section, decision?.id, decision?.outcomes.length, activeOutcomeIds, outcome?.id, optionEditorSection, optionActionsSticky]);
  useEffect(() => {
    const next = focusedOutcomeId ?? decision?.outcomes[0]?.id;
    setActiveOutcomeId(next);
    setOptionEditorSection("conditions");
  }, [selectedDecisionId, focusedOutcomeId, section]);
  useEffect(() => {
    const requested = props.navigationRequest?.section;
    if (section !== "choices" || !focusedOutcomeId || (requested !== "conditions" && requested !== "consequences" && requested !== "interactions")) return;
    setActiveOutcomeId(focusedOutcomeId);
    requestOptionSection(requested);
  }, [section, selectedDecisionId, focusedOutcomeId, props.navigationRequest?.section, props.navigationRequest?.requestId]);
  useEffect(() => {
    const requested = pendingOptionSectionScroll.current;
    if (section !== "choices" || !requested || requested !== optionEditorSection) return;
    pendingOptionSectionScroll.current = undefined;
    const frame = requestAnimationFrame(() => revealOptionSection(optionSurface.current, requested));
    return () => cancelAnimationFrame(frame);
  }, [section, optionEditorSection, optionScrollRequest, outcome?.id]);
  useEffect(() => {
    const ids = JSON.parse(activeOutcomeIds) as string[];
    if (activeOutcomeId && ids.includes(activeOutcomeId)) return;
    setActiveOutcomeId(ids[0]);
    setOptionEditorSection("conditions");
  }, [decision?.id, activeOutcomeIds]);
  const [contentLocale, setContentLocale] = useState(project.localizationCatalog?.primaryLocale ?? "und");
  const [notice, setNotice] = useState<string>();
  const applyResult = async (mutate: (current: BranchingProject) => MutationResult) => {
    let selection: MutationResult["selection"];
    try {
      await onMutation(current => { const result = mutate(current); if (result.project === current && result.message) throw new Error(result.message); selection = result.selection; return result.project; });
      setNotice(undefined);
      if (selection?.type === "node") onSelect(selection.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  if (!event) return <p>{c.noEvent}</p>;
  const shared: SharedProps = { ...props, c, applyResult };
  const node: NarrativeNodeReference = selected ?? { id: dialogue ? `dialogue:${eventId}:${dialogue.id}` : eventId, elementId: dialogue?.id ?? eventId, kind: "dialogue", label: dialogue?.title ?? event.name, dialogueId };
  const owner = selected?.beat ?? outcome ?? decision ?? dialogue ?? event;
  const when = owner.logic?.when ?? ("conditions" in owner ? owner.conditions : undefined) ?? ("displayCondition" in owner ? owner.displayCondition : undefined) ?? ("availability" in owner ? owner.availability : undefined);
  const conditionLabel = outcome ? (locale === "es" ? "Ofrecer esta opción si" : "Offer this option if")
    : decision ? (locale === "es" ? "Llegar a esta decisión si" : "Reach this decision if")
    : selected?.beat ? (locale === "es" ? "Mostrar esta línea si" : "Show this line if")
    : dialogue ? (locale === "es" ? "Abrir esta conversación si" : "Open this conversation if")
    : (locale === "es" ? "Entrar a este evento si" : "Enter this event if");
  const updateWhen = (conditions: Parameters<typeof LogicConditionEditor>[0]["value"]) => onMutation(current => {
    if (selected?.beat) return selected.dialogueId ? updateDialogueBeat(current, eventId, selected.dialogueId, selected.elementId, { displayCondition: conditions }).project : updateEventDialogueBeat(current, eventId, selected.elementId, { displayCondition: conditions }).project;
    if (outcome && decision) {
      const latest = current.events.find(item => item.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id);
      return updateOutcome(current, eventId, decision.id, outcome.id, { conditions, logic: { ...latest?.logic, when: conditions } }).project;
    }
    if (decision) return updateDecision(current, eventId, decision.id, { availability: conditions }).project;
    if (dialogue) return updateDialogue(current, eventId, dialogue.id, { availability: conditions }).project;
    return updateEvent(current, eventId, { availability: conditions }).project;
  });
  const updateMoment = (logic: LogicMoment) => onMutation(current => {
    if (selected?.beat) return selected.dialogueId ? updateDialogueBeat(current,eventId,selected.dialogueId,selected.elementId,{logic,consequences:logic.then}).project : updateEventDialogueBeat(current,eventId,selected.elementId,{logic,consequences:logic.then}).project;
    if (outcome && decision) return updateOutcome(current,eventId,decision.id,outcome.id,{logic,consequences:logic.then}).project;
    if (decision) return updateDecision(current,eventId,decision.id,{logic}).project;
    if (dialogue) return updateDialogue(current,eventId,dialogue.id,{logic,consequences:logic.then}).project;
    return updateEvent(current,eventId,{logic,consequences:logic.then}).project;
  });
  const open = (id: string, part: string) => { if (props.onOpenSection) props.onOpenSection(id, part); else { onSelect(id); props.onSectionChange?.(part); } };
  const locales = [...new Set([project.localizationCatalog?.primaryLocale ?? "und", ...(project.localizationCatalog?.locales ?? [])])];
  const textFields = <>
    {locales.length > 1 ? <label>{c.locale}<select value={contentLocale} onChange={change => setContentLocale(change.target.value)}>{locales.map(code => <option key={code} value={code}>{code}</option>)}</select></label> : null}
    {selected?.beat ? <BeatEditor {...shared} node={selected} contentLocale={contentLocale} /> : outcome && decision ? <ResponseEditor {...shared} decision={decision} outcome={outcome} managedByDecision /> : decision ? <AuthoringTextField projectId={project.projectId} elementId={decision.id} field="decision-name" label={c.name} value={decision.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, decision.id, { name: name.trim() }).project)} /> : <>
      <AuthoringTextField projectId={project.projectId} elementId={dialogue?.id ?? eventId} field={dialogue ? "dialogue-text" : "event-text"} label={c.content} value={dialogue?.text.content ?? event.text?.content ?? ""} multiline onCommit={content => onMutation(current => dialogue ? updateDialogue(current, eventId, dialogue.id, { text: { ...dialogue.text, content } }).project : updateEvent(current, eventId, { text: { format: "plain", ...event.text, content } }).project)} />
    </>}
  </>;
  return <div ref={optionSurface} className="narrative-editor narrative-inspector-section" aria-label={`${c.title} · ${node.label}`}>
    {notice ? <p className="authoring-field-error" role="alert">{notice}</p> : null}
    {section === "consequences" ? outcome && decision ? <OutcomeConsequencesEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /> : <section className="narrative-node-consequences" aria-label={locale === "es" ? "Consecuencias del diálogo" : "Dialogue consequences"}>
      <p className="narrative-muted">{locale === "es" ? "Estos cambios se aplican cuando el recorrido pasa por este diálogo. Puedes otorgar conocimientos o ítems y modificar estados o propiedades." : "These changes apply when the story reaches this dialogue. Grant knowledge or items and change states or properties."}</p>
      <LogicMomentEditor project={project} draftId={selected?.id ?? dialogue?.id ?? eventId} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} hideWhen value={{ ...owner.logic, then: owner.logic?.then ?? ("consequences" in owner ? owner.consequences : undefined) }} onChange={logic => { void updateMoment(logic); }} />
    </section> : null}
    {section === "conditions" ? outcome && decision ? <OutcomeConditionsEditor project={project} eventId={eventId} decision={decision} outcome={outcome} onMutation={onMutation} /> : <>
      <p className="narrative-muted">{locale === "es" ? "Se evalúa al llegar a este punto. Si no se cumple, este elemento no estará disponible." : "Checked when the story reaches this point. If it does not match, this element is unavailable."}</p>
      <LogicConditionEditor project={project} draftId={selected?.id ?? dialogue?.id ?? eventId} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} compact value={when} label={conditionLabel} onChange={conditions => { void updateWhen(conditions); }} />
      {!selected?.beat && !dialogue ? <details className="narrative-logic-changes" open={Boolean(owner.logic?.then?.length || owner.logic?.narrativeEffects?.length || owner.logic?.rules?.length || ("consequences" in owner && owner.consequences?.length))}><summary>{locale === "es" ? "Cambios al llegar a este elemento" : "Changes on reaching this element"}</summary>
        <p className="narrative-muted">{locale === "es" ? "Estos cambios se aplican cuando el recorrido entra aquí." : "These changes apply when the story enters this point."}</p>
        <LogicMomentEditor project={project} draftId={selected?.id ?? eventId} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} hideWhen value={{...owner.logic,when,then:owner.logic?.then ?? ("consequences" in owner ? owner.consequences : undefined)}} onChange={logic=>{void updateMoment(logic);}} />
      </details> : null}
    </> : null}
    {section === "connections" ? decision && selected?.kind === "decision" ? <div className="inspector-decision-connections-layout">
      <NodeConnections {...shared} node={node} />
      <DecisionConnectionOptions project={project} eventId={eventId} decision={decision} shared={shared} />
    </div> : <>
      {decision && selected?.kind === "outcome" && outcome ? <DecisionOptionConnectionContext decision={decision} outcome={outcome} /> : null}
      <div className="inspector-route-columns"><NodeConnections {...shared} node={node} /><ContinuationEditor {...shared} node={node} /></div>
    </> : null}
    {section === "content" ? textFields : null}
    {section === "choices" ? decision ? <section className="narrative-decision-detail" ref={decisionFlowRef}>
      <svg className="narrative-decision-flow-connectors" aria-hidden="true" focusable="false" viewBox={`0 0 ${Math.max(1, decisionFlowRef.current?.clientWidth ?? 1)} ${Math.max(1, decisionFlowRef.current?.clientHeight ?? 1)}`} preserveAspectRatio="none">
        {decisionFlowPaths.map(path => <path key={path.id} className={path.active ? "is-active" : ""} d={path.d} />)}
      </svg>
      <div className="narrative-decision-flow-canvas">
      <div className="narrative-option-toolbar narrative-decision-flow">
        <div className="narrative-decision-flow-source"><Split size={22} aria-hidden="true" /><strong>{decision.name}</strong></div>
        {outcome ? <section className="narrative-selected-option-card" key={outcome.id} aria-label={locale === "es" ? `Opción seleccionada ${decisionOptionLetter(decision.outcomes.findIndex(item => item.id === outcome.id))}` : `Selected option ${decisionOptionLetter(decision.outcomes.findIndex(item => item.id === outcome.id))}`}>
          <span className="narrative-selected-option-index narrative-decision-index">{decisionOptionLetter(decision.outcomes.findIndex(item => item.id === outcome.id))}</span>
          <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-text" label={locale === "es" ? "Texto de la opción" : "Option text"} value={outcome.visibleText ?? ""} onCommit={visibleText => onMutation(current => updateOutcome(current, eventId, decision.id, outcome.id, { visibleText }).project)} />
          <button type="button" className="narrative-selected-option-action" aria-label={locale === "es" ? "Abrir inspector de la opción" : "Open option inspector"} title={locale === "es" ? "Abrir inspector" : "Open inspector"} onClick={() => open(`outcome:${eventId}:${decision.id}:${outcome.id}`, "content")}><ArrowRight size={16} /></button>
          <button type="button" className="narrative-selected-option-action danger" aria-label={locale === "es" ? "Eliminar opción" : "Delete option"} title={locale === "es" ? "Eliminar opción" : "Delete option"} onClick={() => { void applyResult(current => deleteOutcome(current, eventId, decision.id, outcome.id)); }}><Trash2 size={15} /></button>
        </section> : null}
        <div className="narrative-option-picker-normal" role="toolbar" aria-label={c.responses}>
          {Array.from({ length: Math.ceil((decision.outcomes.length + 1) / 3) }, (_, row) => <div className="narrative-option-row narrative-branch-row" key={row}>
            {decision.outcomes.slice(row * 3, row * 3 + 3).map((item, column) => renderOutcomeButton(item, row * 3 + column))}
            {Math.floor(decision.outcomes.length / 3) === row ? <button type="button" className="narrative-option-add" aria-label={locale === "es" ? "Añadir opción" : "Add option"} title={locale === "es" ? "Añadir opción" : "Add option"} onClick={() => { void applyResult(current => addNarrativeResponse(current, eventId, decision.id)); }}><Plus size={17} /></button> : null}
          </div>)}
        </div>
      </div>
      </div>
      {outcome ? <div className="narrative-option-sticky-sentinel" ref={optionStickySentinelRef} aria-hidden="true" /> : null}
      {outcome ? <div ref={optionActionsRef} className="narrative-option-actions narrative-option-shared-actions" data-sticky={optionActionsSticky} role="group" aria-label={locale === "es" ? "Configuración de la opción seleccionada" : "Selected option settings"}>
        <div className={`narrative-option-picker-sticky-shell${optionPickerEdges.overflow ? " is-overflowing" : ""}`} aria-hidden={!optionActionsSticky}>
          {optionPickerEdges.left ? <button type="button" className="narrative-option-picker-edge left" aria-label={locale === "es" ? "Desplazar opciones a la izquierda" : "Scroll options left"} onClick={() => optionPickerRef.current?.scrollBy({ left: -160, behavior: "smooth" })} onPointerEnter={event => { if (event.pointerType === "mouse") startOptionPickerEdgeScroll(-1); }} onPointerLeave={stopOptionPickerEdgeScroll}><ArrowLeft size={14} aria-hidden="true" /></button> : null}
          <div className="narrative-option-picker-sticky" ref={optionPickerRef} role="toolbar" aria-label={c.responses} onScroll={() => {
            const picker = optionPickerRef.current;
            if (!picker) return;
            const maxScroll = Math.max(0, picker.scrollWidth - picker.clientWidth);
            const next = { overflow: maxScroll > 1, left: picker.scrollLeft > 1, right: picker.scrollLeft < maxScroll - 1 };
            setOptionPickerEdges(current => current.overflow === next.overflow && current.left === next.left && current.right === next.right ? current : next);
          }}>{decision.outcomes.map((item, index) => renderOutcomeButton(item, index, true))}</div>
          {optionPickerEdges.right ? <button type="button" className="narrative-option-picker-edge right" aria-label={locale === "es" ? "Desplazar opciones a la derecha" : "Scroll options right"} onClick={() => optionPickerRef.current?.scrollBy({ left: 160, behavior: "smooth" })} onPointerEnter={event => { if (event.pointerType === "mouse") startOptionPickerEdgeScroll(1); }} onPointerLeave={stopOptionPickerEdgeScroll}><ArrowRight size={14} aria-hidden="true" /></button> : null}
        </div>
        <span className="narrative-option-shared-spacer left" aria-hidden="true" />
        <div className="narrative-option-section-actions">
          <button type="button" className={`narrative-option-configure-condition${optionEditorSection === "conditions" ? " active" : ""}`} aria-pressed={optionEditorSection === "conditions"} aria-label={locale === "es" ? "Configurar condiciones de la opción seleccionada" : "Configure selected option conditions"} onClick={() => requestOptionSection("conditions")}><GitBranch size={16} aria-hidden="true" /><span>{c.conditions}</span></button>
          <button type="button" className={`narrative-option-configure-interaction${optionEditorSection === "interactions" ? " active" : ""}`} aria-pressed={optionEditorSection === "interactions"} aria-label={locale === "es" ? "Configurar interacción de la opción seleccionada" : "Configure selected option interaction"} onClick={() => requestOptionSection("interactions")}><D20Mark /><span>{locale === "es" ? "Interacciones" : "Interactions"}</span></button>
          <button type="button" className={`narrative-option-configure-consequence${optionEditorSection === "consequences" ? " active" : ""}`} aria-pressed={optionEditorSection === "consequences"} aria-label={locale === "es" ? "Configurar consecuencias de la opción seleccionada" : "Configure selected option consequences"} onClick={() => requestOptionSection("consequences")}><Zap size={16} aria-hidden="true" /><span>{locale === "es" ? "Consecuencias" : "Consequences"}</span></button>
        </div>
        <span className="narrative-option-shared-spacer right" aria-hidden="true" />
      </div> : null}
      {outcome ? <ResponseEditor {...shared} key={outcome.id} decision={decision} outcome={outcome} managedByDecision optionTextInHeader conditionEditorOpen={optionEditorSection === "conditions"} consequenceEditorOpen={optionEditorSection === "consequences"} interactionEditorOpen={optionEditorSection === "interactions"} /> : <p className="narrative-muted">{locale === "es" ? "Añade una opción para configurar sus condiciones, consecuencias e interacciones." : "Add an option to configure its conditions, consequences and interactions."}</p>}
    </section> : null : null}
    {section === "decisionSettings" ? decision ? <section className="narrative-decision-settings-view" aria-label={locale === "es" ? "Configuración de decisiones" : "Decision settings"}>
      <section className="narrative-decision-settings-card">
        <header className="narrative-decision-settings-heading">
          <h3>{locale === "es" ? "Configuración" : "Configuration"}</h3>
          <p className="narrative-muted">{locale === "es" ? "Define el nombre y el contexto de la decisión." : "Set the decision name and context."}</p>
        </header>
        <div className="narrative-decision-settings-fields">
          <AuthoringTextField projectId={project.projectId} elementId={decision.id} field="decision-name" label={c.name} value={decision.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, decision.id, { name: name.trim() }).project)} />
        </div>
      </section>

      <section className="narrative-decision-settings-card">
        <header className="narrative-decision-settings-heading">
          <h3>{locale === "es" ? "Contexto" : "Context"}</h3>
          <p className="narrative-muted">{locale === "es" ? "Añade contexto para identificar esta decisión." : "Add context to help identify this decision."}</p>
        </header>
        <label className="narrative-decision-description-field">
          <span>{locale === "es" ? "Descripción" : "Description"}</span>
          <textarea rows={4} value={decision.description ?? ""} onChange={event => { void onMutation(current => updateDecision(current, eventId, decision.id, { description: event.target.value || undefined }).project); }} />
        </label>
      </section>

    </section> : null : null}
    {section === "path" ? <>
      {textFields}
      <div className="narrative-add-block"><span>{c.addStart}</span><div className="narrative-actions">{(["speech", "direction", "decision", ...(!dialogueId ? ["dialogue" as const] : [])] as NarrativeBlockKind[]).map(kind => <button key={kind} type="button" onClick={() => { void applyResult(current => insertNarrativeBlock(current, eventId, kind, { dialogueId: kind === "dialogue" ? undefined : dialogueId, afterNodeId: selected && selected.kind !== "dialogue" && selected.kind !== "decision" ? selected.id : undefined })); }}><Plus size={13} />{c[kind]}</button>)}</div></div>
      {!nodes.length ? <p className="narrative-muted">{c.empty}</p> : <div className="narrative-block-list">{nodes.map(item => <article key={item.id} className="narrative-block"><div className="narrative-block-body"><h4>{c[item.kind === "outcome" ? "response" : item.kind]}</h4><p>{labelForNode(refs, item.id, c)}</p><div className="narrative-actions"><button type="button" onClick={() => open(item.id, item.kind === "decision" ? "narrativeDecision" : item.kind === "dialogue" ? "narrativeSequence" : "content")}>{locale === "es" ? "Editar" : "Edit"}</button><button type="button" onClick={() => open(item.id, "connections")}>{c.continuation}</button></div></div></article>)}</div>}
    </> : null}
  </div>;
}

export function NarrativeEditor(props: NarrativeEditorProps) {
  const { project, eventId, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const c = copies[locale];
  const references = narrativeNodeReferences(project, eventId);
  const selected = references.find(node => node.id === props.selectedNodeId);
  const [chosenDialogueId, setChosenDialogueId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [contentLocale, setContentLocale] = useState(project.localizationCatalog?.primaryLocale ?? "und");
  const surface = useRef<HTMLDivElement>(null);
  const event = project.events.find(item => item.id === eventId);
  const activeDialogueId = chosenDialogueId === "" ? undefined : chosenDialogueId ?? props.dialogueId ?? selected?.dialogueId ?? (selected?.kind === "dialogue" ? selected.elementId : undefined);
  const dialogue = event?.dialogues?.find(item => item.id === activeDialogueId);
  const nodes = narrativeScopeNodes(project, eventId, activeDialogueId);
  useEffect(() => { setChosenDialogueId(undefined); setNotice(undefined); }, [eventId, props.dialogueId, props.selectedNodeId]);
  useEffect(() => { const element = [...(surface.current?.querySelectorAll<HTMLElement>("[data-narrative-node]") ?? [])].find(item => item.dataset.narrativeNode === props.selectedNodeId); element?.scrollIntoView({ block: "nearest" }); }, [props.selectedNodeId]);
  const applyResult = async (mutate: (current: BranchingProject) => MutationResult) => {
    let selection: MutationResult["selection"];
    try {
      await onMutation(current => { const result = mutate(current); if (result.project === current && result.message) throw new Error(result.message); selection = result.selection; return result.project; });
      setNotice(undefined);
      if (selection?.type === "node") onSelect(selection.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };
  const shared: SharedProps = { ...props, c, applyResult };
  if (!event) return <p>{c.noEvent}</p>;
  const insertionSource = selected && selected.dialogueId === activeDialogueId && selected.kind !== "dialogue" && selected.kind !== "decision" ? selected.id : undefined;
  const add = (kind: NarrativeBlockKind) => { void applyResult(current => insertNarrativeBlock(current, eventId, kind, { dialogueId: kind === "dialogue" ? undefined : activeDialogueId, afterNodeId: kind === "dialogue" ? undefined : insertionSource })); };
  const deleteNode = (node: NarrativeNodeReference) => {
    void applyResult(current => node.kind === "dialogue" ? deleteDialogue(current, eventId, node.elementId) : node.kind === "decision" ? deleteDecision(current, eventId, node.elementId) : node.dialogueId ? deleteDialogueBeat(current, eventId, node.dialogueId, node.elementId) : deleteEventDialogueBeat(current, eventId, node.elementId));
  };
  const contentLocales = [...new Set([project.localizationCatalog?.primaryLocale ?? "und", ...(project.localizationCatalog?.locales ?? [])])];
  return <div ref={surface} className="narrative-editor" aria-label={c.title}>
    <header className="narrative-editor-header"><h3>{c.title}</h3><p>{event.name}{dialogue ? ` → ${dialogue.title}` : ""}</p></header>
    <label>{c.dialogue}<select value={activeDialogueId ?? ""} onChange={change => { setChosenDialogueId(change.target.value || ""); onSelect(change.target.value ? `dialogue:${eventId}:${change.target.value}` : eventId); }}><option value="">{c.eventContent}</option>{event.dialogues?.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    {contentLocales.length > 1 ? <label>{c.locale}<select value={contentLocale} onChange={change => setContentLocale(change.target.value)}>{contentLocales.map(code => <option key={code} value={code}>{code}</option>)}</select></label> : null}
    {dialogue ? <AuthoringTextField projectId={project.projectId} elementId={dialogue.id} field="dialogue-title" label={c.name} value={dialogue.title} validate={value => value.trim() ? undefined : c.requiredName} onCommit={title => onMutation(current => updateDialogue(current, eventId, dialogue.id, { title: title.trim() }).project)} /> : null}
    {dialogue?.text.content ? <AuthoringTextField projectId={project.projectId} elementId={dialogue.id} field="dialogue-text" label={c.content} value={dialogue.text.content} multiline onCommit={content => onMutation(current => updateDialogue(current, eventId, dialogue.id, { text: { ...dialogue.text, content } }).project)} /> : !dialogue && event.text?.content ? <AuthoringTextField projectId={project.projectId} elementId={event.id} field="event-text" label={c.content} value={event.text.content} multiline onCommit={content => onMutation(current => updateEvent(current, eventId, { text: { ...event.text!, content } }).project)} /> : null}
    <details className="narrative-context-logic"><summary>{c.conditions} / {c.effects} · {dialogue?.title ?? event.name}</summary>
      <LogicConditionEditor project={project} draftId={dialogue?.id ?? eventId} context={{ eventId, dialogueId: dialogue?.id, nodeId: dialogue ? `dialogue:${eventId}:${dialogue.id}` : eventId }} compact value={dialogue ? dialogue.logic?.when ?? dialogue.availability : event.logic?.when ?? event.availability} label={c.conditions} onChange={availability => { void onMutation(current => dialogue ? updateDialogue(current, eventId, dialogue.id, { availability }).project : updateEvent(current, eventId, { availability }).project); }} />
      <NarrativeEffectEditor project={project} draftId={dialogue?.id ?? eventId} context={{ eventId, dialogueId: dialogue?.id, nodeId: dialogue ? `dialogue:${eventId}:${dialogue.id}` : eventId }} value={dialogue ? orderedMomentEffects(dialogue.logic, dialogue.consequences) : orderedMomentEffects(event.logic, event.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, dialogue ? `dialogue:${eventId}:${dialogue.id}` : eventId, effects)); }} />
      <RepeatControl value={dialogue ? dialogue.logic?.repeat : event.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(item => item.id === eventId); return dialogue ? updateDialogue(current, eventId, dialogue.id, { logic: { ...latest?.dialogues?.find(item => item.id === dialogue.id)?.logic, repeat } }).project : updateEvent(current, eventId, { logic: { ...latest?.logic, repeat } }).project; }); }} />
    </details>
    <div className="narrative-add-block" aria-label={c.add}><span>{insertionSource ? c.autoConnection : c.addStart}</span><div className="narrative-actions">{(["speech", "direction", "decision"] as const).map(kind => <button key={kind} type="button" onClick={() => add(kind)}><Plus size={13} />{c[kind]}</button>)}{!activeDialogueId ? <button type="button" onClick={() => add("dialogue")}><Plus size={13} />{c.dialogue}</button> : null}</div></div>
    {notice ? <p className="authoring-field-error" role="alert">{notice}</p> : null}
    {!nodes.length ? <p className="narrative-muted">{c.empty}</p> : null}
    <div className="narrative-block-list">{nodes.map(node => {
      const decision = node.kind === "decision" ? event.decisions?.find(item => item.id === node.elementId) : undefined;
      const connections = narrativeConnections(project, eventId, node.id);
      const active = node.id === props.selectedNodeId || decision?.outcomes.some(outcome => `outcome:${eventId}:${decision.id}:${outcome.id}` === props.selectedNodeId);
      const referenced = connections.incoming.length > 0 || connections.outgoing.length > 0 || (decision?.outcomes.some(outcome => { const links = narrativeConnections(project, eventId, `outcome:${eventId}:${decision.id}:${outcome.id}`); return links.incoming.length || links.outgoing.length; }) ?? false);
      return <details key={node.id} className={`narrative-block${active ? " selected" : ""}`} open={active || undefined} data-narrative-node={node.id}>
        <summary onClick={event => { event.preventDefault(); onSelect(node.id); }}>{c[node.kind === "outcome" ? "response" : node.kind]} · {labelForNode(references, node.id, c)}</summary>
        <div className="narrative-block-body"><NodeConnections {...shared} node={node} />
          {node.beat ? <BeatEditor {...shared} node={node} contentLocale={contentLocale} /> : decision ? <>
            <AuthoringTextField projectId={project.projectId} elementId={decision.id} field="decision-name" label={c.name} value={decision.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, decision.id, { name: name.trim() }).project)} />
            <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} compact value={decision.logic?.when ?? decision.availability} label={c.conditions} onChange={availability => { void onMutation(current => updateDecision(current, eventId, decision.id, { availability }).project); }} />
              <NarrativeEffectEditor project={project} draftId={node.id} context={{ eventId, dialogueId: node.dialogueId, nodeId: node.id }} value={orderedMomentEffects(decision.logic, undefined)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} />
              <RepeatControl value={decision.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(item => item.id === eventId)?.decisions?.find(item => item.id === decision.id); return updateDecision(current, eventId, decision.id, { logic: { ...latest?.logic, repeat } }).project; }); }} />
            </details>
            <h4>{c.responses} · {decision.outcomes.length}</h4>{decision.outcomes.map(outcome => <ResponseEditor {...shared} key={outcome.id} decision={decision} outcome={outcome} />)}
            <button type="button" onClick={() => { void applyResult(current => addNarrativeResponse(current, eventId, decision.id)); }}><Plus size={13} /> {c.response}</button>
          </> : node.kind === "dialogue" ? <button type="button" onClick={() => { setChosenDialogueId(node.elementId); onSelect(node.id); }}>{c.dialogue} →</button> : null}
          {!decision ? <ContinuationEditor {...shared} node={node} /> : null}
          <div className="narrative-secondary"><button type="button" disabled={referenced} title={referenced ? c.referenced : c.delete} onClick={() => deleteNode(node)}><Trash2 size={13} /> {c.delete}</button></div>
        </div>
      </details>;
    })}</div>
    <p className="narrative-muted">{c.sourceHint}</p>
  </div>;
}
