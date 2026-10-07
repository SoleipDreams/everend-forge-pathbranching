import { orderedMomentEffects } from "../logic.js";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownLeft, GitBranch, Plus, Trash2 } from "lucide-react";
import type { BranchingProject, Decision, DialogueBeat, Outcome } from "../domain.js";
import { addNarrativeResponse, connectNarrativeContinuation, endNarrativeContinuation, insertNarrativeBlock, narrativeConnections, narrativeNodeReferences, narrativeScopeNodes, setNarrativeNodeEffects, setNarrativeRouteEffects, updateNarrativeRoute, updateNarrativeSpeaker, updateNarrativeText, type NarrativeNodeReference, type NarrativeBlockKind } from "../authoringMutations.js";
import { deleteDecision, deleteDialogue, deleteDialogueBeat, deleteEventDialogueBeat, deleteOutcome, updateDecision, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateOutcome, type MutationResult } from "../projectMutations.js";
import { useInterfaceLocale } from "../i18n.js";
import { LogicConditionEditor } from "./LogicComposer.js";
import { NarrativeEffectEditor } from "./NarrativeEffectEditor.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import "../authoringEditor.css";

export type NarrativeEditorProps = {
  project: BranchingProject; eventId: string; dialogueId?: string; selectedNodeId?: string;
  onMutation: (mutate: (current: BranchingProject) => BranchingProject) => void | Promise<void>;
  onSelect: (nodeId: string) => void;
};

const copies = {
  es: { title: "Escribir historia", event: "Evento", dialogue: "Diálogo", eventContent: "Contenido del evento", speech: "Intervención", direction: "Acotación", decision: "Decisión", response: "Respuesta", add: "Añadir", select: "Seleccionar en el canvas", incoming: "Entradas", outgoing: "Salidas", shared: "Contenido compartido", returning: "Retorno", missing: "Referencia desaparecida", unnamed: "Sin nombre", content: "Texto", name: "Nombre", speaker: "Hablante", narrator: "Narrador", noSpeaker: "Sin hablante", continuation: "Continuación", create: "Crear contenido", connect: "Conectar contenido existente", back: "Volver a un punto anterior", end: "Terminar", choose: "Elegir destino", noExit: "Sin continuación", newRoute: "Añadir ruta alternativa", route: "Ruta", fallback: "Si ninguna ruta anterior cumple (Else)", priority: "Orden de prioridad", conditions: "Condiciones", effects: "Consecuencias", removeRoute: "Quitar ruta", insert: "Insertar después", responses: "Respuestas", locked: "Mostrar bloqueada", hidden: "Ocultar si no cumple", unavailable: "Cuando no está disponible", delete: "Eliminar", referenced: "Resuelve las conexiones antes de eliminar este contenido.", noEvent: "Selecciona un evento para escribir.", empty: "Añade la primera intervención, acotación o decisión. Se conectará a la entrada.", noReturn: "No hay contenido anterior en este contexto.", routeHint: "Las rutas se comprueban en orden; Else se usa al final.", sourceHint: "La escritura modifica el documento y conserva los destinos compartidos.", blockedDelete: "No se pudo eliminar el contenido.", requiredName: "Escribe un nombre.", returnPoint: "Punto de regreso", locale: "Idioma del contenido", graphEntry: "Entrada", graphEnd: "Final", replace: "Cambiar destino", autoConnection: "Se conecta después de la selección", addStart: "Añadir al contexto" },
  en: { title: "Write story", event: "Event", dialogue: "Dialogue", eventContent: "Event content", speech: "Speech", direction: "Direction", decision: "Decision", response: "Response", add: "Add", select: "Select on canvas", incoming: "Incoming", outgoing: "Outgoing", shared: "Shared content", returning: "Return", missing: "Missing reference", unnamed: "Untitled", content: "Text", name: "Name", speaker: "Speaker", narrator: "Narrator", noSpeaker: "No speaker", continuation: "Continuation", create: "Create content", connect: "Connect existing content", back: "Return to an earlier point", end: "End", choose: "Choose destination", noExit: "No continuation", newRoute: "Add alternative route", route: "Route", fallback: "If no previous route matches (Else)", priority: "Priority order", conditions: "Conditions", effects: "Consequences", removeRoute: "Remove route", insert: "Insert after", responses: "Responses", locked: "Show locked", hidden: "Hide when unavailable", unavailable: "When unavailable", delete: "Delete", referenced: "Resolve connections before deleting this content.", noEvent: "Select an event to write.", empty: "Add the first speech, direction or decision. It will connect to the entry.", noReturn: "There is no earlier content in this context.", routeHint: "Routes are checked in order; Else runs last.", sourceHint: "Writing updates the document and preserves shared destinations.", blockedDelete: "Could not delete content.", requiredName: "Enter a name.", returnPoint: "Return point", locale: "Content language", graphEntry: "Entry", graphEnd: "End", replace: "Change destination", autoConnection: "Connects after the selection", addStart: "Add to context" },
};
type Copy = typeof copies.es | typeof copies.en;
type SharedProps = NarrativeEditorProps & { c: Copy; applyResult: (mutate: (project: BranchingProject) => MutationResult) => Promise<void> };

function RepeatControl({ value, onChange }: { value?: "once" | "each-entry"; onChange: (value: "once" | "each-entry") => void }) {
  const locale = useInterfaceLocale();
  return <label>{locale === "es" ? "Aplicar consecuencias" : "Apply consequences"}<select value={value ?? "once"} onChange={event => onChange(event.target.value as "once" | "each-entry")}><option value="once">{locale === "es" ? "Una vez por recorrido" : "Once per traversal"}</option><option value="each-entry">{locale === "es" ? "Cada entrada" : "On every entry"}</option></select></label>;
}

function labelForNode(references: NarrativeNodeReference[], id: string, c: Copy) {
  const node = references.find(node => node.id === id);
  return node ? node.block && !node.block.content.trim() ? c[node.kind === "speech" ? "speech" : "direction"] : node.label : (id.includes(":input:") || id.endsWith(":input") ? c.graphEntry : id.includes(":output:") || id.endsWith(":output") ? c.graphEnd : `${c.missing} · ${id}`);
}

function NodeConnections({ project, eventId, node, onSelect, onMutation, c }: Pick<SharedProps, "project" | "eventId" | "onSelect" | "onMutation" | "c"> & { node: NarrativeNodeReference }) {
  const references = narrativeNodeReferences(project, eventId);
  const { incoming, outgoing } = narrativeConnections(project, eventId, node.id);
  return <div className="narrative-connections">
    <span><ArrowDown size={12} aria-hidden="true" /> {c.incoming}: {incoming.length}{incoming.length > 1 ? ` · ${c.shared}` : ""}</span>
    <span><ArrowUp size={12} aria-hidden="true" /> {c.outgoing}: {outgoing.length}</span>
    {incoming.length ? <div>{incoming.map(route => <span className="narrative-incoming-route" key={route.id}><button type="button" onClick={() => onSelect(route.from)} title={route.from}>↳ {labelForNode(references, route.from, c)}</button><button type="button" aria-label={`${c.removeRoute} · ${labelForNode(references, route.from, c)} → ${node.label}`} onClick={() => { void onMutation(current => ({ ...current, events: current.events.map(event => event.id === eventId ? { ...event, transitions: event.transitions?.filter(item => item.id !== route.id) } : event) })); }}><Trash2 size={12} /></button></span>)}</div> : null}
  </div>;
}

function ContinuationEditor({ project, eventId, node, c, onMutation, onSelect, applyResult }: SharedProps & { node: NarrativeNodeReference }) {
  const [mode, setMode] = useState<"create" | "connect" | "return">();
  const [replacingRouteId, setReplacingRouteId] = useState<string>();
  const references = narrativeNodeReferences(project, eventId);
  const scoped = narrativeScopeNodes(project, eventId, node.dialogueId);
  const earlier = scoped.slice(0, Math.max(0, scoped.findIndex(item => item.id === node.id || (node.decisionId && item.elementId === node.decisionId))));
  const outgoing = narrativeConnections(project, eventId, node.id).outgoing;
  const returnTargets = earlier.filter(item => item.id !== node.id);
  const chooseDestination = (to: string) => { void applyResult(current => connectNarrativeContinuation(current, eventId, node.id, to, replacingRouteId)); setMode(undefined); setReplacingRouteId(undefined); };
  return <section className="narrative-continuation" aria-label={`${c.continuation} · ${node.label}`}>
    <h5>{c.continuation}</h5>
    {!outgoing.length ? <p className="narrative-muted">{c.noExit}</p> : null}
    {outgoing.map(route => {
      const target = references.find(item => item.id === route.to);
      const shared = narrativeConnections(project, eventId, route.to).incoming.length > 1;
      const returning = scoped.findIndex(item => item.id === route.to) >= 0 && scoped.findIndex(item => item.id === route.to) <= scoped.findIndex(item => item.id === node.id || item.elementId === node.decisionId);
      return <details className="narrative-route" key={route.id}>
        <summary><GitBranch size={13} aria-hidden="true" /> {labelForNode(references, route.to, c)} {returning ? <span>↶ {c.returning}</span> : shared ? <span>{c.shared}</span> : null}</summary>
        {target ? <button type="button" onClick={() => onSelect(route.to)}>{c.select}</button> : null}
        <label>{c.priority}<input type="number" min={0} value={route.order ?? 0} onChange={event => { const order = Number(event.target.value); if (Number.isInteger(order) && order >= 0) void onMutation(current => updateNarrativeRoute(current, eventId, route.id, { order })); }} /></label>
        <label className="narrative-check"><input type="checkbox" checked={route.mode === "fallback"} onChange={event => { const fallback = event.target.checked; void onMutation(current => updateNarrativeRoute(current, eventId, route.id, { mode: fallback ? "fallback" : "conditional", role: "route", conditions: fallback ? undefined : route.conditions, logic: fallback ? { ...route.logic, when: undefined } : route.logic })); }} /> {c.fallback}</label>
        {route.mode !== "fallback" ? <LogicConditionEditor project={project} draftId={route.id} compact value={route.logic?.when ?? route.conditions} label={c.conditions} onChange={when => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.transitions?.find(item => item.id === route.id); return updateNarrativeRoute(current, eventId, route.id, { role: "route", conditions: when, logic: { ...latest?.logic, when } }); }); }} /> : null}
        <NarrativeEffectEditor project={project} draftId={route.id} value={orderedMomentEffects(route.logic, route.consequences)} onChange={effects => { void onMutation(current => setNarrativeRouteEffects(current, eventId, route.id, effects)); }} />
        <RepeatControl value={route.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.transitions?.find(item => item.id === route.id); return updateNarrativeRoute(current, eventId, route.id, { logic: { ...latest?.logic, repeat } }); }); }} />
        <div className="narrative-actions"><button type="button" onClick={() => { setReplacingRouteId(route.id); setMode("create"); }}>{c.insert}</button><button type="button" onClick={() => { setReplacingRouteId(route.id); setMode("connect"); }}>{c.replace}</button><button type="button" onClick={() => { void onMutation(current => ({ ...current, events: current.events.map(event => event.id === eventId ? { ...event, transitions: event.transitions?.filter(item => item.id !== route.id) } : event) })); }}>{c.removeRoute}</button></div>
      </details>;
    })}
    <div className="narrative-actions">
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("create"); }}><Plus size={13} /> {c.create}</button>
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("connect"); }}>{c.connect}</button>
      <button type="button" onClick={() => { setReplacingRouteId(undefined); setMode("return"); }} disabled={!returnTargets.length}><CornerDownLeft size={13} /> {c.back}</button>
      <button type="button" onClick={() => { void applyResult(current => endNarrativeContinuation(current, eventId, node.id, node.dialogueId)); }}>{c.end}</button>
    </div>
    {mode === "create" ? <div className="narrative-actions" aria-label={c.create}>{(["speech", "direction", "decision"] as const).map(kind => <button key={kind} type="button" onClick={() => { void applyResult(current => insertNarrativeBlock(current, eventId, kind, { dialogueId: node.dialogueId, afterNodeId: node.id, beforeNodeId: outgoing.find(route => route.id === replacingRouteId)?.to, asAlternative: !replacingRouteId && outgoing.length > 0 })); setMode(undefined); }}>{c[kind]}</button>)}</div> : mode ? <label>{mode === "return" ? c.returnPoint : c.choose}<select value="" onChange={event => chooseDestination(event.target.value)}><option value="">{c.choose}</option>{(mode === "return" ? returnTargets : scoped.filter(item => item.id !== node.id)).map(item => <option key={item.id} value={item.id}>{c[item.kind === "outcome" ? "response" : item.kind]} · {item.label}</option>)}</select></label> : null}
    {outgoing.length > 1 ? <p className="narrative-muted">{c.routeHint}</p> : null}
  </section>;
}

function ResponseEditor(props: SharedProps & { decision: Decision; outcome: Outcome }) {
  const { project, eventId, decision, outcome, c, onMutation, onSelect } = props;
  const locale = useInterfaceLocale();
  const node: NarrativeNodeReference = { id: `outcome:${eventId}:${decision.id}:${outcome.id}`, elementId: outcome.id, kind: "outcome", label: outcome.visibleText || outcome.name, decisionId: decision.id, dialogueId: decision.dialogueId };
  const connections = narrativeConnections(project, eventId, node.id);
  const update = (updates: Partial<Outcome>) => onMutation(current => updateOutcome(current, eventId, decision.id, outcome.id, updates).project);
  return <article className={`narrative-response${props.selectedNodeId === node.id ? " selected" : ""}`} data-narrative-node={node.id}>
    <header><button type="button" className="narrative-node-title" onClick={() => onSelect(node.id)}>{c.response} · {outcome.name}</button><button type="button" aria-label={`${c.delete} ${outcome.name}`} disabled={Boolean(connections.incoming.length || connections.outgoing.length)} title={connections.incoming.length || connections.outgoing.length ? c.referenced : c.delete} onClick={() => { void props.applyResult(current => deleteOutcome(current, eventId, decision.id, outcome.id)); }}><Trash2 size={13} /></button></header>
    <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-name" label={c.name} value={outcome.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => update({ name })} />
    <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="response-text" label={c.content} value={outcome.visibleText ?? ""} multiline onCommit={visibleText => update({ visibleText })} />
    <label>{c.unavailable}<select value={outcome.unavailableBehavior ?? "locked"} onChange={event => { void update({ unavailableBehavior: event.target.value as "locked" | "hidden" }); }}><option value="locked">{c.locked}</option><option value="hidden">{c.hidden}</option></select></label>
    {(outcome.unavailableBehavior ?? "locked") === "locked" ? <AuthoringTextField projectId={project.projectId} elementId={outcome.id} field="lock-text" label={locale === "es" ? "Explicación del bloqueo" : "Lock explanation"} value={outcome.lockText?.content ?? ""} onCommit={content => update({ lockText: { format: "plain", content } })} /> : null}
    <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={outcome.logic?.when ?? outcome.conditions ?? outcome.availability} label={c.conditions} onChange={conditions => { void update({ conditions }); }} />
      <NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(outcome.logic, outcome.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} />
      <RepeatControl value={outcome.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = current.events.find(event => event.id === eventId)?.decisions?.find(item => item.id === decision.id)?.outcomes.find(item => item.id === outcome.id); return updateOutcome(current, eventId, decision.id, outcome.id, { logic: { ...latest?.logic, repeat } }).project; }); }} />
    </details>
    <NodeConnections {...props} node={node} />
    <ContinuationEditor {...props} node={node} />
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
    <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={beat.logic?.when ?? beat.displayCondition} label={c.conditions} onChange={displayCondition => { void update({ displayCondition }); }} /><NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(beat.logic, beat.consequences)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} /><RepeatControl value={beat.logic?.repeat} onChange={repeat => { void onMutation(current => { const latest = narrativeNodeReferences(current, eventId).find(item => item.id === node.id)?.beat; return node.dialogueId ? updateDialogueBeat(current, eventId, node.dialogueId, beat.id, { logic: { ...latest?.logic, repeat } }).project : updateEventDialogueBeat(current, eventId, beat.id, { logic: { ...latest?.logic, repeat } }).project; }); }} /></details>
  </>;
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
    {dialogue ? <AuthoringTextField projectId={project.projectId} elementId={dialogue.id} field="dialogue-title" label={c.name} value={dialogue.title} validate={value => value.trim() ? undefined : c.requiredName} onCommit={title => onMutation(current => updateDialogue(current, eventId, dialogue.id, { title }).project)} /> : null}
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
            <AuthoringTextField projectId={project.projectId} elementId={decision.id} field="decision-name" label={c.name} value={decision.name} validate={value => value.trim() ? undefined : c.requiredName} onCommit={name => onMutation(current => updateDecision(current, eventId, decision.id, { name }).project)} />
            <details><summary>{c.conditions} / {c.effects}</summary><LogicConditionEditor project={project} draftId={node.id} compact value={decision.logic?.when ?? decision.availability} label={c.conditions} onChange={availability => { void onMutation(current => updateDecision(current, eventId, decision.id, { availability }).project); }} />
              <NarrativeEffectEditor project={project} draftId={node.id} value={orderedMomentEffects(decision.logic, undefined)} onChange={effects => { void onMutation(current => setNarrativeNodeEffects(current, eventId, node.id, effects)); }} />
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
