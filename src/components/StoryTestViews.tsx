import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Bug, ChevronDown, Crosshair, GripHorizontal, Maximize2, MoveDiagonal2, Pause, Play, RotateCcw, Square, X } from "lucide-react";
import type { Locale } from "../i18n.js";
import { storyTestFieldText, storyTestSubjectValue, type StoryTestCopy, type StoryTestField, type StoryTestSnapshot, type StoryTestUiCommand } from "../storyTestController.js";
import type { ConditionEvaluationResult } from "../conditionEvaluation.js";
import { conditionDiagnosticMessage } from "../conditionPresentation.js";
import "../storyTest.css";

function DraftField({ field, snapshot, dispatch, locale, disabled }: StoryTestViewProps & { field: StoryTestField; disabled?: boolean }) {
  const es = (locale ?? snapshot.locale) === "es";
  const value = snapshot.drafts[field.key] ?? storyTestFieldText(field);
  const error = snapshot.draftErrors[field.key];
  const errorId = useId();
  const common = { value, disabled, "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined, onChange: (event: { target: { value: string } }) => dispatch({ type: "editDraft", key: field.key, value: event.target.value }) };
  const boolean = field.type === "boolean" || field.type === "bool";
  const state = field.type === "state";
  const list = ["list", "multiselect", "multiSelect", "entity-ref-list", "canonRefList", "dataRefList"].includes(field.type);
  const label = state ? ({ unlocked: es ? "Desbloqueo" : "Unlocked", discovered: es ? "Descubrimiento" : "Discovered", present: es ? "Presencia" : "Presence" } as Record<string, string>)[field.label] ?? field.label : field.label;
  const emptyLabel = field.type === "owner" ? es ? "Sin poseedor" : "No owner" : field.key === "scenario:actor" ? es ? "Protagonista del perfil" : "Profile protagonist" : field.key === "scenario:start" ? es ? "Entrada de la historia" : "Story entry" : es ? "Sin valor" : "No value";
  return <label className="field-label">{label}
    {field.options ? <select {...common}><option value="">{emptyLabel}</option>{value && !field.options.some(option => option.value === value) ? <option value={value}>{es ? "Referencia no disponible" : "Unavailable reference"} · {value}</option> : null}{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : state ? <select {...common}><option value="inherit">{es ? "Heredado" : "Inherited"}</option><option value="true">{es ? "Activado" : "Enabled"}</option><option value="false">{es ? "Desactivado" : "Disabled"}</option></select> : boolean ? <select {...common}><option value="">{emptyLabel}</option><option value="true">{es ? "Sí" : "Yes"}</option><option value="false">No</option></select> : <input {...common} type={field.type === "date" ? "date" : "text"} inputMode={["number", "integer", "float"].includes(field.type) ? "decimal" : undefined} />}
    {list ? <small>{es ? 'Lista JSON, por ejemplo ["llave", "carta"].' : 'JSON list, for example ["key", "letter"].'}</small> : null}
    {error ? <span id={errorId} className="story-test-field-error">{conditionDiagnosticMessage(error, locale ?? snapshot.locale)}</span> : null}
  </label>;
}

function CopyFields({ copy, scope, snapshot, dispatch, locale = snapshot.locale, disabled }: StoryTestViewProps & { copy: StoryTestCopy; scope: "run" | "scenario"; disabled?: boolean }) {
  const es = locale === "es";
  return <details><summary>{copy.name}</summary><small className="story-test-copy-id">{copy.id}</small>
    <DraftField field={copy.owner} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />
    {copy.properties.map(field => <div key={field.key}><DraftField field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />{snapshot.drafts[scope + ":copy:" + copy.id + ":inherit:" + field.id] ? <small role="status">{es ? "Pendiente de heredar al aplicar." : "Will inherit when applied."}</small> : <button type="button" disabled={disabled} onClick={() => dispatch({ type: "copyProperty", scope, copyId: copy.id, propertyId: field.id, inherit: true })}>{es ? "Heredar de la entidad" : "Inherit from entity"}</button>}</div>)}
    {copy.availableProperties.length ? <label className="field-label">{es ? "Añadir propiedad propia" : "Add copy property"}<select value="" disabled={disabled} onChange={event => { if (event.target.value) dispatch({ type: "copyProperty", scope, copyId: copy.id, propertyId: event.target.value }); }}><option value="">{es ? "Elegir propiedad" : "Choose property"}</option>{copy.availableProperties.map(property => <option key={property.id} value={property.id}>{property.label}</option>)}</select></label> : null}
    {copy.states.length ? <fieldset><legend>{es ? "Estados propios" : "Copy states"}</legend>{copy.states.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />)}</fieldset> : null}
    {scope === "scenario" ? <button type="button" onClick={() => dispatch({ type: "scenarioCopy", operation: "remove", id: copy.id })}>{es ? "Retirar del escenario" : "Remove from scenario"}</button> : null}
  </details>;
}

function RawStateDraft({ scope, snapshot, dispatch, locale = snapshot.locale, disabled }: StoryTestViewProps & { scope: "run" | "scenario"; disabled?: boolean }) {
  const es = locale === "es";
  const key = scope + ":json";
  const errorId = useId();
  const error = snapshot.draftErrors[key];
  return <details><summary>{es ? "Avanzado: estado completo" : "Advanced: complete state"}</summary><label className="field-label">{es ? "Estado temporal en JSON" : "Temporary state as JSON"}<textarea rows={8} spellCheck={false} disabled={disabled} value={snapshot.drafts[key] ?? JSON.stringify(scope === "run" ? snapshot.state : snapshot.scenarioState, null, 2)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => dispatch({ type: "editDraft", key, value: event.target.value })} />{error ? <span id={errorId} className="story-test-field-error">{conditionDiagnosticMessage(error, locale)}</span> : null}</label></details>;
}

/** Debug fields are owner drafts, so closing a presentation loses nothing. */
export function StoryTestDebug({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const runDisabled = !snapshot.active || snapshot.changed;
  const runDrafts = Object.keys(snapshot.drafts).some(key => key.startsWith("run:"));
  const scenarioDrafts = Object.keys(snapshot.drafts).some(key => key.startsWith("scenario:"));
  const traceLabels = es ? { enter: "Entrada", condition: "Condición", effect: "Consecuencia", route: "Ruta", rule: "Regla", action: "Acción", return: "Regreso", error: "Error" } : { enter: "Entry", condition: "Condition", effect: "Effect", route: "Route", rule: "Rule", action: "Action", return: "Return", error: "Error" };
  return <section className="story-test-view" aria-label={es ? "Debug del recorrido" : "Story run debug"}>
    <StateStatus snapshot={snapshot} locale={locale} />
    <RevisionNotice snapshot={snapshot} dispatch={dispatch} locale={locale} />
    {snapshot.error ? <p role="alert" className="story-test-message story-test-warning">{snapshot.error}</p> : null}
    <div className="story-test-row"><button type="button" disabled={!snapshot.historyCount} onClick={() => dispatch({ type: "back" })}>{es ? "Paso anterior" : "Previous step"}</button><button type="button" disabled={!snapshot.active} onClick={() => dispatch({ type: "restart" })}>{es ? "Reiniciar" : "Restart"}</button>{snapshot.nodeId ? <button type="button" onClick={() => dispatch({ type: "locate", nodeId: snapshot.nodeId })}>{es ? "Localizar posición" : "Locate position"}</button> : null}</div>
    {snapshot.view?.title ? <p><strong>{snapshot.view.title}</strong></p> : null}
    {snapshot.message ? <p role="alert" className="story-test-message">{conditionDiagnosticMessage(snapshot.message, locale)}</p> : null}
    <details open><summary>{es ? "Por qué ocurrió" : "Why it happened"}</summary>{snapshot.trace.length ? <ol className="story-test-trace">{snapshot.trace.map((entry, index) => <li key={index}><strong>{traceLabels[entry.kind]}</strong> · {entry.message}{entry.priority !== undefined ? <small> · {es ? "Prioridad" : "Priority"} {entry.priority}</small> : null}{entry.evaluation ? <EvaluationExplanation result={entry.evaluation} locale={locale} /> : null}{entry.changes.length ? <ul>{entry.changes.map((change, changeIndex) => <li key={changeIndex}>{change.label}: {JSON.stringify(change.before) ?? "∅"} → {JSON.stringify(change.after) ?? "∅"}</li>)}</ul> : null}{entry.nodeId ? <button type="button" onClick={() => dispatch({ type: "locate", nodeId: entry.nodeId })}>{es ? "Localizar" : "Locate"}</button> : null}</li>)}</ol> : <p>{es ? "La traza aparecerá al iniciar el recorrido." : "Start a run to see the trace."}</p>}</details>
    <details><summary>{es ? "Estado temporal e inventarios" : "Temporary state and inventories"}{runDrafts ? " · ✎" : ""}</summary>
      {snapshot.paused ? <p>{es ? "Aplicar ejecutará las reglas inmediatas y conservará la pausa." : "Apply executes immediate rules and keeps the run paused."}</p> : null}
      {snapshot.variables.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} />)}
      {snapshot.copies.map(copy => <CopyFields key={copy.id} copy={copy} scope="run" snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} />)}
      <RawStateDraft scope="run" snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} />
      <div className="story-test-row"><button type="button" className="story-test-primary" disabled={runDisabled || !runDrafts} onClick={() => dispatch({ type: "applyRunDrafts" })}>{es ? "Aplicar cambios temporales" : "Apply temporary changes"}</button><button type="button" disabled={!runDrafts} onClick={() => dispatch({ type: "discardDrafts", scope: "run" })}>{es ? "Descartar borradores" : "Discard drafts"}</button></div>
      <p><button type="button" disabled={!snapshot.active} onClick={() => dispatch({ type: "createScenario", fromRun: true })}>{es ? "Guardar estado como escenario inicial" : "Save state as initial scenario"}</button></p>
    </details>
    <details><summary>{es ? "Preparar escenarios" : "Prepare scenarios"}{scenarioDrafts ? " · ✎" : ""}</summary>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
      <button type="button" onClick={() => dispatch({ type: "createScenario" })}>{es ? "Crear escenario" : "Create scenario"}</button>
      {snapshot.scenario ? <>
        <DraftField field={{ key: "scenario:name", id: "name", label: es ? "Nombre del escenario" : "Scenario name", type: "text", value: snapshot.scenario.name }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <DraftField field={{ key: "scenario:actor", id: "actor", label: "Actor", type: "select", value: storyTestSubjectValue(snapshot.scenario.actor), options: snapshot.scenarioSubjects }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <DraftField field={{ key: "scenario:start", id: "start", label: es ? "Punto inicial" : "Starting point", type: "select", value: snapshot.scenario.startNodeId ?? "", options: snapshot.nodes.map(node => ({ value: node.id, label: node.label })) }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        {snapshot.scenarioVariables.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} />)}
        <details><summary>{es ? "Copias, pertenencias y estados iniciales" : "Initial copies, ownership and states"}</summary>{snapshot.scenarioCopies.map(copy => <CopyFields key={copy.id} copy={copy} scope="scenario" snapshot={snapshot} dispatch={dispatch} locale={locale} />)}<label className="field-label">{es ? "Preparar una copia" : "Prepare a copy"}<select value="" onChange={event => { if (event.target.value) dispatch({ type: "scenarioCopy", operation: "add", id: event.target.value }); }}><option value="">{es ? "Elegir entidad" : "Choose entity"}</option>{snapshot.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label></details>
        <RawStateDraft scope="scenario" snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <div className="story-test-row"><button type="button" className="story-test-primary" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "applyScenarioDrafts" })}>{es ? "Aplicar escenario" : "Apply scenario"}</button><button type="button" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "discardDrafts", scope: "scenario" })}>{es ? "Descartar borradores" : "Discard drafts"}</button></div>
        <p><button type="button" className="danger" onClick={() => dispatch({ type: "deleteScenario" })}>{es ? "Eliminar escenario" : "Remove scenario"}</button></p>
      </> : <p>{es ? "Crea un escenario para preparar actor, copias y valores iniciales." : "Create a scenario to prepare the actor, copies and initial values."}</p>}
    </details>
  </section>;
}

type StoryTestViewProps = { snapshot: StoryTestSnapshot; dispatch: (command: StoryTestUiCommand) => void; locale?: Locale };

function StateStatus({ snapshot, locale }: { snapshot: StoryTestSnapshot; locale: Locale }) {
  const es = locale === "es";
  const status = snapshot.changed ? es ? "Revisión anterior" : "Previous revision" : snapshot.paused ? es ? "En pausa" : "Paused" : snapshot.status === "ended" ? es ? "Recorrido terminado" : "Run finished" : snapshot.status === "blocked" ? es ? "Recorrido detenido" : "Run stopped" : snapshot.active ? es ? "En curso" : "Running" : es ? "Listo para probar" : "Ready to test";
  const icon = snapshot.changed || snapshot.status === "blocked" ? "!" : snapshot.paused ? "⏸" : snapshot.status === "ended" ? "✓" : "▶";
  return <p className="story-test-status" role="status"><span aria-hidden="true">{icon}</span><strong>{status}</strong></p>;
}

function RevisionNotice({ snapshot, dispatch, locale }: StoryTestViewProps) {
  const es = (locale ?? snapshot.locale) === "es";
  return snapshot.changed ? <div className="story-test-message story-test-warning" role="status"><p>{es ? "La historia cambió. El recorrido conserva la revisión anterior." : "The story changed. This run keeps the previous revision."}</p><button type="button" onClick={() => dispatch({ type: "restart" })}>{es ? "Reiniciar con la nueva revisión" : "Restart with the new revision"}</button></div> : null;
}

/** The compact narrative surface; all mutations are requests to the owner. */
export function StoryTestPreview({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const canAdvance = snapshot.active && !snapshot.paused && !snapshot.changed && snapshot.status === "ready";
  const choices = snapshot.view?.choices.filter(choice => !choice.hidden) ?? [];
  return <section className="story-test-view" aria-label={es ? "Previsualización de la historia" : "Story preview"}>
    <StateStatus snapshot={snapshot} locale={locale} />
    <RevisionNotice snapshot={snapshot} dispatch={dispatch} locale={locale} />
    {snapshot.error ? <p className="story-test-message story-test-warning" role="alert">{snapshot.error}</p> : null}
    <div className="story-test-row">
      {snapshot.view?.title ? <strong>{snapshot.view.title}</strong> : null}
      {snapshot.nodeId ? <button type="button" className="story-test-icon" aria-label={es ? "Localizar posición en el canvas" : "Locate position on canvas"} title={es ? "Localizar posición" : "Locate position"} onClick={() => dispatch({ type: "locate", nodeId: snapshot.nodeId })}><Crosshair size={15} aria-hidden="true" /></button> : null}
      <button type="button" className="story-test-icon" aria-label={es ? "Abrir debug" : "Open debug"} title={es ? "Abrir debug" : "Open debug"} onClick={() => dispatch({ type: "debug", open: true })}><Bug size={15} aria-hidden="true" /></button>
    </div>
    {snapshot.view?.speakerRef ? <p className="story-test-speaker">{snapshot.view.speakerName ?? snapshot.view.speakerRef}</p> : null}
    {snapshot.view?.text ? <div className="story-test-content">{snapshot.view.text}</div> : null}
    {snapshot.message ? <p className="story-test-message" role="alert">{conditionDiagnosticMessage(snapshot.message, locale)}</p> : null}
    {!snapshot.active ? <p>{es ? "Pulsa Play para iniciar. Las elecciones solo cambian el estado temporal." : "Press Play to start. Choices only change temporary state."}</p> : null}
    <div className="story-test-responses">{choices.map(choice => <div key={choice.id}>
      <button type="button" className="story-test-response" disabled={!canAdvance || choice.status !== "satisfied"} onClick={() => dispatch({ type: "choose", outcomeId: choice.id })}>
        <span aria-hidden="true">{choice.status === "satisfied" ? "→ " : "🔒 "}</span>{choice.text}
        {choice.status !== "satisfied" ? <small>{conditionDiagnosticMessage(choice.reason ?? (es ? "No cumple sus requisitos" : "Requirements not met"), locale)}</small> : null}
      </button>
      {choice.status !== "satisfied" ? <details><summary>{es ? "Ver requisitos" : "View requirements"}</summary>{choice.summary ? <p>{choice.summary}</p> : null}<EvaluationExplanation result={choice.evaluation} locale={locale} /></details> : null}
    </div>)}</div>
    {!snapshot.view?.choices.length && snapshot.status === "ready" ? <button type="button" className="story-test-primary" disabled={!canAdvance} onClick={() => dispatch({ type: "continue" })}>{es ? "Continuar" : "Continue"}</button> : null}
    {snapshot.status === "ended" && !snapshot.changed ? <button type="button" onClick={() => dispatch({ type: "restart" })}>{es ? "Reiniciar recorrido" : "Restart run"}</button> : null}
    {snapshot.view?.actions.length ? <details><summary>{es ? "Acciones disponibles" : "Available actions"}</summary>
      <label className="field-label">{es ? "Origen de la acción" : "Action source"}<select value={snapshot.actionSource} onChange={event => dispatch({ type: "actionContext", source: event.target.value })}><option value="">{es ? "Actor del escenario" : "Scenario actor"}</option>{snapshot.subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}</select></label>
      <label className="field-label">{es ? "Destinatario" : "Recipient"}<select value={snapshot.actionTarget} onChange={event => dispatch({ type: "actionContext", target: event.target.value })}><option value="">{es ? "Sin destinatario" : "No recipient"}</option>{snapshot.subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}</select></label>
      {!snapshot.actions.length ? <p>{es ? "Elige un origen con acciones configuradas." : "Choose a source with configured actions."}</p> : null}
      <div className="story-test-actions">{snapshot.actions.map(action => <div key={action.id}><button type="button" disabled={!canAdvance || action.status !== "satisfied" || Boolean(action.reason)} onClick={() => dispatch({ type: "action", actionId: action.id })}>{action.name}</button>{action.reason ? <small>{conditionDiagnosticMessage(action.reason, locale)}</small> : null}{action.status !== "satisfied" ? <EvaluationExplanation result={action.evaluation} locale={locale} /> : null}</div>)}</div>
    </details> : null}
  </section>;
}

/** Toolbar buttons intentionally have no layer/tab semantics. */
export function StoryTestControls({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    controls.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !controls.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen]);
  const playbackLabel = !snapshot.active ? es ? "Probar historia" : "Test story" : snapshot.paused ? es ? "Reanudar recorrido" : "Resume run" : es ? "Pausar recorrido" : "Pause run";
  const closeMenu = () => { setMenuOpen(false); menuButton.current?.focus(); };
  return <div ref={controls} className="story-test-controls nodrag nopan" role="group" aria-label={es ? "Controles de prueba" : "Story test controls"} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape" && menuOpen) { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}>
    <button type="button" className="story-test-icon" aria-label={playbackLabel} title={playbackLabel} disabled={snapshot.changed || snapshot.status === "ended"} onClick={() => dispatch({ type: snapshot.active && !snapshot.paused ? "pause" : "play" })}>{snapshot.active && !snapshot.paused ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
    <button type="button" className="story-test-icon" aria-label={es ? "Detener y cerrar recorrido" : "Stop and close run"} title={es ? "Detener y cerrar recorrido" : "Stop and close run"} disabled={!snapshot.active && !snapshot.debugOpen} onClick={() => dispatch({ type: "stop" })}><Square size={14} aria-hidden="true" /></button>
    <button ref={menuButton} type="button" className="story-test-icon" aria-label={es ? "Opciones de prueba" : "Test options"} title={es ? "Opciones de prueba" : "Test options"} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}><ChevronDown size={13} aria-hidden="true" /></button>
    {menuOpen ? <div id={menuId} className="story-test-settings" role="dialog" aria-label={es ? "Opciones de prueba" : "Test options"}>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
      <div className="story-test-row"><button type="button" onClick={() => { dispatch({ type: "start" }); closeMenu(); }}>{es ? "Desde la entrada" : "From story entry"}</button><button type="button" disabled={!snapshot.selectedNodeId} onClick={() => { dispatch({ type: "start", fromSelection: true }); closeMenu(); }}>{es ? "Desde selección" : "From selection"}</button></div>
      {snapshot.active ? <p><button type="button" onClick={() => { dispatch({ type: "restart" }); closeMenu(); }}><RotateCcw size={13} aria-hidden="true" /> {snapshot.changed ? es ? "Reiniciar con la nueva revisión" : "Restart with the new revision" : es ? "Reiniciar recorrido" : "Restart run"}</button></p> : null}
      <p><button type="button" onClick={() => { dispatch({ type: "debug", open: true }); closeMenu(); }}><Bug size={13} aria-hidden="true" /> {es ? "Debug y escenarios" : "Debug and scenarios"}</button></p>
      <small>{es ? "El recorrido avanza con Continuar, respuestas y acciones." : "Advance using Continue, responses and actions."}</small>
    </div> : null}
  </div>;
}

function EvaluationExplanation({ result, locale }: { result: ConditionEvaluationResult; locale: Locale }) {
  const labels = locale === "es" ? { satisfied: "✓ Cumple", unsatisfied: "✗ No cumple", unresolved: "? Sin resolver", invalid: "! Inválido" } : { satisfied: "✓ Satisfied", unsatisfied: "✗ Not satisfied", unresolved: "? Unresolved", invalid: "! Invalid" };
  return <ul className="story-test-evaluation"><li><strong>{labels[result.status]}</strong> · {conditionDiagnosticMessage(result.message, locale)}{result.actual !== undefined ? <span> · {JSON.stringify(result.actual)}</span> : null}{result.children?.map((child, index) => <EvaluationExplanation key={index} result={child} locale={locale} />)}</li></ul>;
}

type PanelGeometry = { x: number; y: number; width: number; height: number };
type PanelBounds = { width: number; height: number };

function constrainGeometry(geometry: PanelGeometry, bounds: PanelBounds): PanelGeometry {
  const width = Math.min(Math.max(260, geometry.width), Math.max(160, bounds.width - 24));
  const height = Math.min(Math.max(170, geometry.height), Math.max(150, bounds.height - 116));
  return { width, height, x: Math.max(12, Math.min(geometry.x, bounds.width - width - 12)), y: Math.max(104, Math.min(geometry.y, bounds.height - height - 12)) };
}

function initialGeometry(kind: "preview" | "debug", bounds: PanelBounds, avoidWriter: boolean): PanelGeometry {
  const compact = avoidWriter;
  const width = kind === "preview" ? 340 : Math.min(380, Math.max(260, bounds.width - 376));
  const height = kind === "preview" ? 280 : 420;
  return constrainGeometry({ x: kind === "debug" ? bounds.width - width - 12 : 12, y: kind === "preview" && !compact ? bounds.height - height - 16 : 104, width, height }, bounds);
}

/** Canvas-local presentation only. Geometry never enters the narrative document. */
export function FloatingStoryTestPanel({ kind, title, locale = "en", children, onDetach, onClose, detachable = false, avoidWriter = false, projectId, sessionId }: {
  kind: "preview" | "debug"; title: string; locale?: Locale; children: ReactNode;
  onDetach?: () => void; onClose?: () => void; detachable?: boolean; avoidWriter?: boolean;
  projectId?: string; sessionId?: string;
}) {
  const es = locale === "es";
  const frame = useRef<HTMLElement>(null);
  const geometryRef = useRef<PanelGeometry | undefined>(undefined);
  const boundsRef = useRef<PanelBounds>({ width: 1000, height: 700 });
  const compactWriter = useRef(false);
  const returnFocus = useRef<HTMLElement | undefined>(undefined);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: PanelGeometry } | undefined>(undefined);
  const [geometry, setGeometry] = useState<PanelGeometry>();
  const moveHelp = useId();
  const resizeHelp = useId();
  const titleId = useId();
  const storageKey = `pathbranching:story-test:${projectId ?? "workspace"}:${kind}:geometry`;
  const updateGeometry = (next: PanelGeometry) => {
    const constrained = constrainGeometry(next, boundsRef.current);
    geometryRef.current = constrained;
    setGeometry(constrained);
    try { localStorage.setItem(storageKey, JSON.stringify(constrained)); } catch { /* Geometry is optional UI state. */ }
  };
  useEffect(() => {
    const element = frame.current;
    const parent = element?.offsetParent;
    if (!(parent instanceof HTMLElement) || !element) return;
    if (!returnFocus.current || !returnFocus.current.isConnected) returnFocus.current = document.activeElement instanceof HTMLElement && !element.contains(document.activeElement) ? document.activeElement : undefined;
    const bounds = () => {
      compactWriter.current = avoidWriter && parent.clientWidth < 940;
      return { width: avoidWriter && !compactWriter.current ? Math.max(260, parent.clientWidth - 464) : parent.clientWidth, height: compactWriter.current ? parent.clientHeight * .48 - 12 : parent.clientHeight };
    };
    const visible = () => parent.clientWidth >= 200 && parent.clientHeight >= 200;
    boundsRef.current = visible() ? bounds() : boundsRef.current;
    let restored: PanelGeometry | undefined;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (stored && typeof stored === "object" && ["x", "y", "width", "height"].every(key => Number.isFinite((stored as Record<string, unknown>)[key]))) restored = stored as PanelGeometry;
    } catch { /* Ignore invalid geometry and use the visible canvas bounds. */ }
    if (visible()) updateGeometry(restored ?? initialGeometry(kind, boundsRef.current, compactWriter.current));
    const parentObserver = new ResizeObserver(() => {
      if (!visible()) return;
      boundsRef.current = bounds();
      updateGeometry(geometryRef.current ?? restored ?? initialGeometry(kind, boundsRef.current, compactWriter.current));
    });
    const frameObserver = new ResizeObserver(() => {
      const current = geometryRef.current;
      if (visible() && current && (Math.abs(element.offsetWidth - current.width) > 1 || Math.abs(element.offsetHeight - current.height) > 1)) updateGeometry({ ...current, width: element.offsetWidth, height: element.offsetHeight });
    });
    parentObserver.observe(parent);
    frameObserver.observe(element);
    return () => {
      parentObserver.disconnect(); frameObserver.disconnect();
      if (returnFocus.current?.isConnected && element.contains(document.activeElement)) returnFocus.current.focus();
    };
  }, [kind, projectId, sessionId, avoidWriter]);
  const close = () => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); onClose?.(); };
  const resize = (horizontal: number, vertical: number) => { if (geometryRef.current) updateGeometry({ ...geometryRef.current, width: geometryRef.current.width + horizontal, height: geometryRef.current.height + vertical }); };
  const style: CSSProperties = geometry ? { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height } : {};
  return <section ref={frame} style={style} className={`story-test-panel story-test-${kind} nodrag nopan nowheel`} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === "Escape" && onClose) { event.preventDefault(); event.stopPropagation(); close(); }
  }} onPointerDown={event => event.stopPropagation()}>
    <header className="story-test-panel-header">
      <div className="story-test-drag-handle" role="button" tabIndex={0} aria-label={es ? `Mover ${title}` : `Move ${title}`} aria-describedby={moveHelp} onPointerDown={event => {
        if (event.button !== 0 || !geometryRef.current) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: geometryRef.current };
      }} onPointerMove={event => {
        const current = drag.current;
        if (current?.pointerId === event.pointerId) updateGeometry({ ...current.origin, x: current.origin.x + event.clientX - current.x, y: current.origin.y + event.clientY - current.y });
      }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = undefined; event.currentTarget.releasePointerCapture(event.pointerId); } }} onPointerCancel={() => { drag.current = undefined; }} onKeyDown={event => {
        const current = geometryRef.current;
        if (!current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        const horizontal = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
        const vertical = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
        updateGeometry(event.key === "Home" ? initialGeometry(kind, boundsRef.current, compactWriter.current) : event.ctrlKey ? { ...current, width: current.width + horizontal, height: current.height + vertical } : { ...current, x: current.x + horizontal, y: current.y + vertical });
      }}><GripHorizontal size={15} aria-hidden="true" /><strong id={titleId}>{title}</strong></div>
      {detachable && onDetach ? <button type="button" className="story-test-icon" onClick={onDetach} aria-label={es ? `Desacoplar ${title}` : `Detach ${title}`} title={es ? "Abrir en otra ventana" : "Open in another window"}><Maximize2 size={15} aria-hidden="true" /></button> : null}
      {onClose ? <button type="button" className="story-test-icon" onClick={close} aria-label={es ? `Cerrar ${title}` : `Close ${title}`}><X size={15} aria-hidden="true" /></button> : null}
    </header>
    <span id={moveHelp} className="story-test-sr-only">{es ? "Arrastra o usa las flechas para mover. Control y flechas cambia el tamaño. Mayúsculas cambia diez píxeles. Inicio restaura la posición." : "Drag or use arrow keys to move. Control and arrows resize. Shift changes ten pixels. Home restores the position."}</span>
    <div className="story-test-panel-content">{children}</div>
    <button type="button" className="story-test-keyboard-resize story-test-icon" aria-label={(es ? "Ajustar tamaño de " : "Resize ") + title} aria-describedby={resizeHelp} title={es ? "Usa las flechas para ajustar el tamaño" : "Use arrow keys to resize"} onClick={() => resize(10, 10)} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const step = event.shiftKey ? 10 : 1;
      resize(event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0, event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0);
    }}><MoveDiagonal2 size={12} aria-hidden="true" /></button>
    <span id={resizeHelp} className="story-test-sr-only">{es ? "Flechas cambia ancho y alto. Mayúsculas cambia diez píxeles. Enter aumenta el tamaño." : "Arrow keys change width and height. Shift changes ten pixels. Enter increases the size."}</span>
  </section>;
}
