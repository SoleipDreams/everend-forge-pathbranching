import { orderedMomentEffects } from "../logic.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CornerDownLeft, GitBranch, Plus, Trash2 } from "lucide-react";
import type { BranchingProject, Decision, DialogueBeat, Outcome, LogicMoment } from "../domain.js";
import { addNarrativeResponse, connectNarrativeContinuation, endNarrativeContinuation, insertNarrativeBlock, narrativeConnections, narrativeNodeReferences, narrativeScopeNodes, setNarrativeNodeEffects, setNarrativeRouteEffects, updateNarrativeRoute, updateNarrativeSpeaker, updateNarrativeText, type NarrativeNodeReference, type NarrativeBlockKind } from "../authoringMutations.js";
import { deleteDecision, deleteDialogue, deleteDialogueBeat, deleteEventDialogueBeat, deleteOutcome, updateDecision, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateOutcome, type MutationResult } from "../projectMutations.js";
import { useInterfaceLocale } from "../i18n.js";
import { LogicConditionEditor, LogicMomentEditor } from "./LogicComposer.js";
import { NarrativeEffectEditor } from "./NarrativeEffectEditor.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import { NarrativeNameEditor } from './NarrativeNameEditor.js';
import "../authoringEditor.css";
import { createInternalTransition, updateSequence } from "../projectMutations.js";
import { inspectorFlowContext } from "../inspectorFlow.js";
import { InspectorFlowAdd } from "./InspectorFlowAdd.js";

export type NarrativeEditorProps = {
  project: BranchingProject; eventId: string; dialogueId?: string; selectedNodeId?: string;
  onMutation: (mutate: (current: BranchingProject) => BranchingProject) => void | Promise<void>;
  onSelect: (nodeId: string) => void;
  section?: "path" | "content" | "choices" | "connections" | "conditions" | "consequences";
  onSectionChange?: (section: string) => void;
  onOpenSection?: (nodeId: string, section: string) => void;
};

const copies = {
  es: { title: "Escribir historia", event: "Evento", dialogue: "Conversación", eventContent: "Contenido del evento", speech: "Diálogo", direction: "Acotación", decision: "Decisión", response: "Opción", add: "Añadir", select: "Seleccionar en el canvas", incoming: "Entradas", outgoing: "Salidas", shared: "Contenido compartido", returning: "Retorno", missing: "Referencia desaparecida", unnamed: "Sin nombre", content: "Texto", name: "Nombre", speaker: "Hablante", narrator: "Narrador", noSpeaker: "Sin hablante", continuation: "Continuación", create: "Crear contenido", connect: "Conectar contenido existente", back: "Volver a un punto anterior", end: "Terminar", choose: "Elegir destino", noExit: "Sin continuación", newRoute: "Añadir ruta alternativa", route: "Ruta", fallback: "Si ninguna ruta anterior cumple (Else)", priority: "Orden de prioridad", conditions: "Condiciones", effects: "Cambios de estado", removeRoute: "Quitar ruta", insert: "Insertar después", responses: "Opciones", locked: "Mostrar bloqueada", hidden: "Ocultar si no cumple", unavailable: "Cuando no está disponible", delete: "Eliminar", referenced: "Resuelve las conexiones antes de eliminar este contenido.", noEvent: "Selecciona un evento para escribir.", empty: "Añade la primer diálogo, acotación o decisión. Se conectará a la entrada.", noReturn: "No hay contenido anterior en este contexto.", routeHint: "Las rutas se comprueban en orden; Else se usa al final.", sourceHint: "La escritura modifica el documento y conserva los destinos compartidos.", blockedDelete: "No se pudo eliminar el contenido.", requiredName: "Escribe un nombre.", returnPoint: "Punto de regreso", locale: "Idioma del contenido", graphEntry: "Entrada", graphEnd: "Final", replace: "Cambiar destino", autoConnection: "Se conecta después de la selección", addStart: "Añadir al contexto" },
  en: { title: "Write story", event: "Event", dialogue: "Conversation", eventContent: "Event content", speech: "Dialogue", direction: "Stage direction", decision: "Decision", response: "Option", add: "Add", select: "Select on canvas", incoming: "Incoming", outgoing: "Outgoing", shared: "Shared content", returning: "Return", missing: "Missing reference", unnamed: "Untitled", content: "Text", name: "Name", speaker: "Speaker", narrator: "Narrator", noSpeaker: "No speaker", continuation: "Continuation", create: "Create content", connect: "Connect existing content", back: "Return to an earlier point", end: "End", choose: "Choose destination", noExit: "No continuation", newRoute: "Add alternative route", route: "Route", fallback: "If no previous route matches (Else)", priority: "Priority order", conditions: "Conditions", effects: "State changes", removeRoute: "Remove route", insert: "Insert after", responses: "Options", locked: "Show locked", hidden: "Hide when unavailable", unavailable: "When unavailable", delete: "Delete", referenced: "Resolve connections before deleting this content.", noEvent: "Select an event to write.", empty: "Add the first dialogue line, stage direction or decision. It will connect to the entry.", noReturn: "There is no earlier content in this context.", routeHint: "Routes are checked in order; Else runs last.", sourceHint: "Writing updates the document and preserves shared destinations.", blockedDelete: "Could not delete content.", requiredName: "Enter a name.", returnPoint: "Return point", locale: "Content language", graphEntry: "Entry", graphEnd: "End", replace: "Change destination", autoConnection: "Connects after the selection", addStart: "Add to context" },
};
type Copy = typeof copies.es | typeof copies.en;
type SharedProps = NarrativeEditorProps & { c: Copy; applyResult: (mutate: (project: BranchingProject) => MutationResult) => Promise<void> };

function RepeatControl({ value, onChange }: { value?: "once" | "each-entry"; onChange: (value: "once" | "each-entry") => void }) {
  const locale = useInterfaceLocale();
  return <label>{locale === "es" ? "Aplicar cambios" : "Apply changes"}<select value={value ?? "once"} onChange={event => onChange(event.target.value as "once" | "each-entry")}><option value="once">{locale === "es" ? "Una vez por recorrido" : "Once per traversal"}</option><option value="each-entry">{locale === "es" ? "Cada entrada" : "On every entry"}</option></select></label>;
}

function labelForNode(references: (Pick<NarrativeNodeReference, "id" | "label"> & Partial<Pick<NarrativeNodeReference, "block" | "kind">>)[], id: string, c: Copy) {
  const node = references.find(node => node.id === id);
  return node ? node.block && !node.block.content.trim() ? c[node.kind === "speech" ? "speech" : "direction"] : node.label : (id.includes(":input:") || id.endsWith(":input") ? c.graphEntry : id.includes(":output:") || id.endsWith(":output") ? c.graphEnd : `${c.missing} · ${id}`);
}

function NodeConnections({ project, eventId, node, onSelect, onMutation, c, section }: Pick<SharedProps, "project" | "eventId" | "onSelect" | "onMutation" | "c" | "section"> & { node: NarrativeNodeReference }) {
  const locale = useInterfaceLocale();
  const references = [...project.events.map(event => ({ id: event.id, label: event.name })), ...narrativeNodeReferences(project, eventId)];
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
  const references = narrativeNodeReferences(project, eventId);
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
      const target = references.find(item => item.id === route.to) ?? project.events.find(item => item.id === route.to);
      const destinationLabel = labelForNode([...project.events.map(event => ({ id: event.id, label: event.name })), ...references], route.to, c);
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
          {route.mode !== "fallback" ? <LogicConditionEditor project={project} draftId={route.id} compact value={route.logic?.when ?? route.conditions} label={locale === "es" ? "Seguir esta ruta si" : "Follow this route if"} onChange={when => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.transitions?.find(item => item.id === route.id); return updateNarrativeRoute(current, eventId, route.id, { role: "route", conditions: when, logic: { ...latest?.logic, when } }); }); }} /> : null}
          <NarrativeEffectEditor project={project} draftId={route.id} value={orderedMomentEffects(route.logic, route.consequences)} onChange={effects => { void onMutation(current => setNarrativeRouteEffects(current, eventId, route.id, effects)); }} />
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
    {mode === "create" ? <div className="narrative-actions" aria-label={c.create}>{(["speech", "direction", "decision"] as const).map(kind => <button key={kind} type="button" onClick={() => { void applyResult(current => insertNarrativeBlock(current, eventId, kind, { dialogueId: node.dialogueId, afterNodeId: node.id, beforeNodeId: outgoing.find(route => route.id === replacingRouteId)?.to, asAlternative: !replacingRouteId && outgoing.length > 0 })); setMode(undefined); }}>{c[kind]}</button>)}</div> : mode ? <label>{mode === "return" ? c.returnPoint : c.choose}<select value="" onChange={event => chooseDestination(event.target.value)}><option value="">{c.choose}</option>{(mode === "return" ? returnTargets : scoped.filter(item => item.id !== node.id)).map(item => <option key={item.id} value={item.id}>{c[item.kind === "outcome" ? "response" : item.kind]} · {item.label}</option>)}</select></label> : null}
    {section !== "connections" && outgoing.length > 1 ? <p className="narrative-muted">{c.routeHint}</p> : null}
  </section>;
}

function DecisionPresentation({ project, eventId, decision, onMutation }: Pick<SharedProps, "project" | "eventId" | "onMutation"> & { decision: Decision }) {
  const es = useInterfaceLocale() === "es";
  return <label>{es ? "Presentación de respuestas" : "Response presentation"}<select value={decision.optionStyle ?? "visibleText"} onChange={event => { const optionStyle = event.target.value as NonNullable<Decision["optionStyle"]>; void onMutation(current => updateDecision(current, eventId, decision.id, { optionStyle }).project); }}><option value="visibleText">{es ? "Texto · TEXT" : "Text · TEXT"}</option><option value="iconOnly">{es ? "Icono · ICON" : "Icon · ICON"}</option></select></label>;
}

function ResponseEditor(props: SharedProps & { decision: Decision; outcome: Outcome }) {
  const { project, eventId, decision, outcome, c, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const node: NarrativeNodeReference = { id: `outcome:${eventId}:${decision.id}:${outcome.id}`, elementId: outcome.id, kind: "outcome", label: outcome.visibleText || outcome.name, decisionId: decision.id, dialogueId: decision.dialogueId };
  const connections = narrativeConnections(project, eventId, node.id);
  const position = decision.outcomes.findIndex(item => item.id === outcome.id);
  const update = (updates: Partial<Outcome>) => onMutation(current => updateOutcome(current, eventId, decision.id, outcome.id, updates).project);
  const move = (direction: -1 | 1) => onMutation(current => {
    const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id);
    const index = latest?.outcomes.findIndex(item => item.id === outcome.id) ?? -1;
    if (!latest || index < 0 || index + direction < 0 || index + direction >= latest.outcomes.length) return current;
    const outcomes = [...latest.outcomes];
    [outcomes[index], outcomes[index + direction]] = [outcomes[index + direction], outcomes[index]];
    return updateDecision(current, eventId, decision.id, { outcomes }).project;
  });
  const updateTextBlock = (field: "unavailableText" | "lockText", content: string) => onMutation(current => {
    const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id);
    return updateOutcome(current, eventId, decision.id, outcome.id, { [field]: { format: "plain", ...latest?.[field], content } }).project;
  });
  return <article className={`narrative-response${props.selectedNodeId === node.id ? " selected" : ""}`} data-narrative-node={node.id}>
    <header><button type="button" className="narrative-node-title" onClick={() => onSelect(node.id)}>{position + 1}. {c.response} · {outcome.name}</button><div className="narrative-actions"><button type="button" aria-label={`${locale === "es" ? "Subir respuesta" : "Move response up"} · ${outcome.name}`} disabled={position <= 0} onClick={() => { void move(-1); }}><ArrowUp size={13} /></button><button type="button" aria-label={`${locale === "es" ? "Bajar respuesta" : "Move response down"} · ${outcome.name}`} disabled={position < 0 || position >= decision.outcomes.length - 1} onClick={() => { void move(1); }}><ArrowDown size={13} /></button><details><summary aria-label={`${locale === "es" ? "Más opciones" : "More options"} · ${outcome.name}`}>⋯</summary><button type="button" className="danger" aria-label={`${c.delete} ${outcome.name}`} disabled={Boolean(connections.incoming.length || connections.outgoing.length)} title={connections.incoming.length || connections.outgoing.length ? c.referenced : c.delete} onClick={() => { void props.applyResult(current => deleteOutcome(current, eventId, decision.id, outcome.id)); }}><Trash2 size={13} /> {c.delete}</button></details></div></header>
    <div className="narrative-name-heading narrative-option-identity"><span className="narrative-option-name">{outcome.name}</span><span className="narrative-node-separator" aria-hidden="true">·</span><span className="narrative-node-kind">{c.response}</span><NarrativeNameEditor project={project} nodeId={node.id} onMutation={onMutation}/></div>
    <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-text" label={c.content} value={outcome.visibleText ?? ""} multiline onCommit={visibleText => update({ visibleText })} />
    <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-icon" label={locale === "es" ? "Icono" : "Icon"} placeholder="◇" value={outcome.icon ?? ""} onCommit={icon => update({ icon: icon || undefined })} />
    <label>{c.unavailable}<select value={outcome.unavailableBehavior ?? "locked"} onChange={event => { void update({ unavailableBehavior: event.target.value as "locked" | "hidden" }); }}><option value="locked">{c.locked}</option><option value="hidden">{c.hidden}</option></select></label>
    {(outcome.unavailableBehavior ?? "locked") === "locked" ? <>
      <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="unavailable-text" label={locale === "es" ? "Texto de la respuesta bloqueada" : "Locked response text"} placeholder="????" value={outcome.unavailableText?.content ?? ""} onCommit={content => updateTextBlock("unavailableText", content)} />
      <p className="narrative-muted">{locale === "es" ? "Vacío conserva el texto normal. Un texto como ???? lo reemplaza hasta cumplir las condiciones; los requisitos detallados se consultan en Debug." : "Leave blank to keep the normal text. Text such as ???? replaces it until conditions are met; detailed requirements remain in Debug."}</p>
      <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="lock-text" label={locale === "es" ? "Explicación del bloqueo" : "Lock explanation"} value={outcome.lockText?.content ?? ""} onCommit={content => updateTextBlock("lockText", content)} />
    </> : null}
    {!props.section ? <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={outcome.logic?.when ?? outcome.conditions ?? outcome.availability} label={c.conditions} onChange={conditions => { void update({ conditions }); }} />
      <NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(outcome.logic, outcome.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} />
      <RepeatControl value={outcome.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id); return updateOutcome(current, eventId, decision.id, outcome.id, { logic: { ...latest?.logic, repeat } }).project; }); }} />
    </details> : <div className="narrative-actions">{["conditions", "connections"].map(section => <button key={section} type="button" onClick={() => { if (props.onOpenSection) props.onOpenSection(node.id, section); else { onSelect(node.id); props.onSectionChange?.(section); } }}>{section === "conditions" ? c.conditions : c.continuation}</button>)}</div>}
    {!props.section ? <><NodeConnections {...props} node={node} /><ContinuationEditor {...props} node={node} /></> : null}
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
    {!props.section ? <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={beat.logic?.when ?? beat.displayCondition} label={c.conditions} onChange={displayCondition => { void update({ displayCondition }); }} /><NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(beat.logic, beat.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} /><RepeatControl value={beat.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = narrativeNodeReferences(current, eventId).find(item => item.id === node.id)?.beat; return node.dialogueId ? updateDialogueBeat(current, eventId, node.dialogueId, beat.id, { logic: { ...latest?.logic, repeat } }).project : updateEventDialogueBeat(current, eventId, beat.id, { logic: { ...latest?.logic, repeat } }).project; }); }} /></details> : null}
  </>;
}

/** Focused inspector views use the modular document directly, sharing the same draft keys. */
export function NarrativeInspectorSection(props: NarrativeEditorProps & { section: NonNullable<NarrativeEditorProps["section"]> }) {
  const { project, eventId, section, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const c: Copy = section === "connections" ? { ...copies[locale], ...(locale === "es"
    ? { title: "Recorrido", incoming: "Antes", outgoing: "Destinos", continuation: "Después", create: "Crear continuación", connect: "Elegir destino existente", end: "Finalizar aquí", noExit: "Todavía no hay un destino conectado." }
    : { title: "Story flow", incoming: "Before", outgoing: "Destinations", continuation: "After", create: "Create continuation", connect: "Choose existing destination", end: "End here", noExit: "No destination is connected yet." }) } : copies[locale];
  const event = project.events.find(item => item.id === eventId);
  const refs = narrativeNodeReferences(project, eventId);
  const selected = refs.find(item => item.id === props.selectedNodeId);
  const dialogueId = props.dialogueId ?? selected?.dialogueId ?? (selected?.kind === "dialogue" ? selected.elementId : undefined);
  const dialogue = event?.dialogues?.find(item => item.id === dialogueId);
  const nodes = narrativeScopeNodes(project, eventId, dialogueId);
  const decision = selected?.kind === "decision" ? event?.decisions?.find(item => item.id === selected.elementId) : selected?.decisionId ? event?.decisions?.find(item => item.id === selected.decisionId) : undefined;
  const outcome = selected?.kind === "outcome" ? decision?.outcomes.find(item => item.id === selected.elementId) : undefined;
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
  const conditionLabel = selected?.kind === "outcome" ? (locale === "es" ? "Ofrecer esta opción si" : "Offer this option if")
    : selected?.kind === "decision" ? (locale === "es" ? "Llegar a esta decisión si" : "Reach this decision if")
    : selected?.beat ? (locale === "es" ? "Mostrar esta línea si" : "Show this line if")
    : dialogue ? (locale === "es" ? "Abrir esta conversación si" : "Open this conversation if")
    : (locale === "es" ? "Entrar a este evento si" : "Enter this event if");
  const updateWhen = (conditions: Parameters<typeof LogicConditionEditor>[0]["value"]) => onMutation(current => {
    if (selected?.beat) return selected.dialogueId ? updateDialogueBeat(current, eventId, selected.dialogueId, selected.elementId, { displayCondition: conditions }).project : updateEventDialogueBeat(current, eventId, selected.elementId, { displayCondition: conditions }).project;
    if (outcome && decision) return updateOutcome(current, eventId, decision.id, outcome.id, { conditions }).project;
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
    {selected?.beat ? <BeatEditor {...shared} node={selected} contentLocale={contentLocale} /> : outcome && decision ? <ResponseEditor {...shared} decision={decision} outcome={outcome} /> : decision ? <AuthoringTextField projectId={project.projectId} elementId={decision.id} field="decision-name" label={c.name} value={decision.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, decision.id, { name: name.trim() }).project)} /> : <>
      <AuthoringTextField projectId={project.projectId} elementId={dialogue?.id ?? eventId} field={dialogue ? "dialogue-text" : "event-text"} label={c.content} value={dialogue?.text.content ?? event.text?.content ?? ""} multiline onCommit={content => onMutation(current => dialogue ? updateDialogue(current, eventId, dialogue.id, { text: { ...dialogue.text, content } }).project : updateEvent(current, eventId, { text: { format: "plain", ...event.text, content } }).project)} />
    </>}
  </>;
  return <div className="narrative-editor narrative-inspector-section" aria-label={`${c.title} · ${node.label}`}>
    {notice ? <p className="authoring-field-error" role="alert">{notice}</p> : null}
    {section === "conditions" ? <>
      <p className="narrative-muted">{locale === "es" ? "Se evalúa al llegar a este punto. Si no se cumple, este elemento no estará disponible." : "Checked when the story reaches this point. If it does not match, this element is unavailable."}</p>
      <LogicConditionEditor project={project} draftId={selected?.id ?? dialogue?.id ?? eventId} compact value={when} label={conditionLabel} onChange={conditions => { void updateWhen(conditions); }} />
      <details className="narrative-logic-changes" open={Boolean(owner.logic?.then?.length || owner.logic?.narrativeEffects?.length || owner.logic?.rules?.length || ("consequences" in owner && owner.consequences?.length))}><summary>{locale === "es" ? "Cambios al llegar a este elemento" : "Changes on reaching this element"}</summary>
        <p className="narrative-muted">{locale === "es" ? "Estos cambios se aplican cuando el recorrido entra aquí." : "These changes apply when the story enters this point."}</p>
        <LogicMomentEditor project={project} draftId={selected?.id ?? dialogue?.id ?? eventId} hideWhen value={{...owner.logic,when,then:owner.logic?.then ?? ("consequences" in owner ? owner.consequences : undefined)}} onChange={logic=>{void updateMoment(logic);}} />
      </details>
    </> : null}
    {section === "connections" ? <div className="inspector-route-columns"><NodeConnections {...shared} node={node} /><ContinuationEditor {...shared} node={node} /></div> : null}
    {section === "content" ? textFields : null}
    {section === "choices" ? <>
      {(decision ? [decision] : event.decisions?.filter(item => item.dialogueId === dialogueId) ?? []).map(item => <section key={item.id} className="narrative-block-body"><AuthoringTextField projectId={project.projectId} elementId={item.id} field="decision-name" label={c.name} value={item.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, item.id, { name: name.trim() }).project)} /><DecisionPresentation {...shared} decision={item} />{item.outcomes.map(response => <ResponseEditor {...shared} key={response.id} decision={item} outcome={response} />)}<button type="button" onClick={() => { void applyResult(current => addNarrativeResponse(current, eventId, item.id)); }}><Plus size={13} />{c.response}</button></section>)}
      {!decision ? <button type="button" onClick={() => { void applyResult(current => insertNarrativeBlock(current, eventId, "decision", { dialogueId })); }}><Plus size={13} />{c.decision}</button> : null}
    </> : null}
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
      <LogicConditionEditor project={project} draftId={dialogue?.id ?? eventId} compact value={dialogue ? dialogue.logic?.when ?? dialogue.availability : event.logic?.when ?? event.availability} label={c.conditions} onChange={availability => { void onMutation(current => dialogue ? updateDialogue(current, eventId, dialogue.id, { availability }).project : updateEvent(current, eventId, { availability }).project); }} />
      <NarrativeEffectEditor project={project} draftId={dialogue?.id ?? eventId} value={dialogue ? orderedMomentEffects(dialogue.logic, dialogue.consequences) : orderedMomentEffects(event.logic, event.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, dialogue ? `dialogue:${eventId}:${dialogue.id}` : eventId, effects)); }} />
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
            <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={decision.logic?.when ?? decision.availability} label={c.conditions} onChange={availability => { void onMutation(current => updateDecision(current, eventId, decision.id, { availability }).project); }} />
              <NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(decision.logic, undefined)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} />
              <RepeatControl value={decision.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(item => item.id === eventId)?.decisions?.find(item => item.id === decision.id); return updateDecision(current, eventId, decision.id, { logic: { ...latest?.logic, repeat } }).project; }); }} />
            </details>
            <h4>{c.responses} · {decision.outcomes.length}</h4><DecisionPresentation {...shared} decision={decision} />{decision.outcomes.map(outcome => <ResponseEditor {...shared} key={outcome.id} decision={decision} outcome={outcome} />)}
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
