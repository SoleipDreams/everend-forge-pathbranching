import { diceFormula, diceGroups, diceFaceLabel, diceGroupFormula } from '../interactionDice.js';
import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useApplicationEffect } from "./useApplicationActivity.js";
import { Bug, ChevronDown, Crosshair, ExternalLink, Fullscreen, Gift, GripHorizontal, LockKeyhole, Maximize2, MoveDiagonal2, PanelRightClose, PanelRightOpen, Pause, Play, RotateCcw, Shrink, Square, UserRound, X } from "lucide-react";
import type { Locale } from "../i18n.js";
import { storyTestFieldText, storyTestSubjectValue, type StoryTestCopy, type StoryTestField, type StoryTestSnapshot, type StoryTestUiCommand } from "../storyTestController.js";
import type { ConditionEvaluationResult } from "../conditionEvaluation.js";
import { conditionDiagnosticMessage } from "../conditionPresentation.js";
import "../storyTest.css";
import "../interactions.css";

function DraftField({ field, snapshot, dispatch, locale, disabled }: StoryTestViewProps & { field: StoryTestField; disabled?: boolean }) {
  const es = (locale ?? snapshot.locale) === "es";
  const value = snapshot.drafts[field.key] ?? storyTestFieldText(field);
  const error = snapshot.draftErrors[field.key];
  const errorId = useId();
  const common = { value, disabled, "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined, onChange: (event: { target: { value: string } }) => dispatch({ type: "editDraft", key: field.key, value: event.target.value }) };
  const boolean = field.type === "boolean" || field.type === "bool";
  const state = field.type === "state";
  const list = ["list", "multiselect", "multiSelect", "entity-ref-list", "canonRefList", "dataRefList"].includes(field.type);
  const label = state ? ({ unlocked: es ? "Desbloqueo" : "Unlocked", discovered: es ? "Descubrimiento" : "Discovered", present: es ? "Presencia" : "Presence", equipped: es ? "Equipado" : "Equipped" } as Record<string, string>)[field.label] ?? field.label : field.label;
  const emptyLabel = field.type === "owner" ? es ? "Sin poseedor" : "No owner" : field.key === "scenario:actor" ? es ? "Elegir protagonista o personaje" : "Choose protagonist or character" : field.key === "scenario:start" ? es ? "Entrada de la historia" : "Story entry" : es ? "Sin valor" : "No value";
  const groupedOptions = field.options?.reduce((groups, option) => {
    const key = option.group ?? "";
    const group = groups.find(item => item.label === key);
    if (group) group.options.push(option); else groups.push({ label: key, options: [option] });
    return groups;
  }, [] as { label: string; options: NonNullable<typeof field.options> }[]);
  return <label className="field-label inspector-field">{label}
    {field.options ? <select {...common}><option value="">{emptyLabel}</option>{value && !field.options.some(option => option.value === value) ? <option value={value}>{es ? "Referencia no disponible" : "Unavailable reference"} · {value}</option> : null}{groupedOptions?.map(group => group.label ? <optgroup key={group.label} label={group.label}>{group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup> : group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>))}</select> : state ? <select {...common}><option value="inherit">{es ? "Heredado" : "Inherited"}</option><option value="true">{es ? "Activado" : "Enabled"}</option><option value="false">{es ? "Desactivado" : "Disabled"}</option></select> : boolean ? <select {...common}><option value="">{emptyLabel}</option><option value="true">{es ? "Sí" : "Yes"}</option><option value="false">No</option></select> : <input {...common} type={field.type === "date" ? "date" : "text"} inputMode={["number", "integer", "float"].includes(field.type) ? "decimal" : undefined} />}
    {list ? <small>{es ? 'Lista JSON, por ejemplo ["llave", "carta"].' : 'JSON list, for example ["key", "letter"].'}</small> : null}
    {error ? <span id={errorId} className="story-test-field-error">{conditionDiagnosticMessage(error, locale ?? snapshot.locale)}</span> : null}
  </label>;
}

function CopyFields({ copy, scope, snapshot, dispatch, locale = snapshot.locale, disabled }: StoryTestViewProps & { copy: StoryTestCopy; scope: "run" | "scenario"; disabled?: boolean }) {
  const es = locale === "es";
  return <details><summary>{copy.name}</summary><small className="story-test-copy-id">{copy.id}</small>
    <DraftField field={copy.owner} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />
    {copy.properties.map(field => <div className="story-test-copy-field-card" key={field.key}><DraftField field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />{snapshot.drafts[scope + ":copy:" + copy.id + ":inherit:" + field.id] ? <small role="status">{es ? "Pendiente de heredar al aplicar." : "Will inherit when applied."}</small> : <button type="button" disabled={disabled} onClick={() => dispatch({ type: "copyProperty", scope, copyId: copy.id, propertyId: field.id, inherit: true })}>{es ? "Heredar de la entidad" : "Inherit from entity"}</button>}</div>)}
    {copy.availableProperties.length ? <label className="field-label">{es ? "Añadir propiedad propia" : "Add copy property"}<select value="" disabled={disabled} onChange={event => { if (event.target.value) dispatch({ type: "copyProperty", scope, copyId: copy.id, propertyId: event.target.value }); }}><option value="">{es ? "Elegir propiedad" : "Choose property"}</option>{copy.availableProperties.map(property => <option key={property.id} value={property.id}>{property.label}</option>)}</select></label> : null}
    {copy.states.length ? <fieldset><legend>{es ? "Estados propios" : "Copy states"}</legend>{copy.states.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={disabled} />)}</fieldset> : null}
    {scope === "scenario" ? <button type="button" onClick={() => dispatch({ type: "scenarioCopy", operation: "remove", id: copy.id })}>{es ? "Retirar del escenario" : "Remove from scenario"}</button> : null}
  </details>;
}

function ScenarioInventoryFields({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const copies = snapshot.scenarioCopies.filter(copy => copy.inventoryItem);
  const items = snapshot.entities.filter(entity => entity.inventoryItem);
  return <section className="story-test-initial-state-group"><h3 className="inspector-group-title">{es ? "Inventario del escenario" : "Scenario inventory"}</h3>
    <p className="story-test-empty-setting">{es ? "Prepara los ítems y quién los lleva al comenzar. El estado Equipado activa los bonos que lo requieren." : "Set up items and their holder at the start. Equipped activates modifiers that require it."}</p>
    {copies.length ? copies.map(copy => <CopyFields key={copy.id} copy={copy} scope="scenario" snapshot={snapshot} dispatch={dispatch} locale={locale} />) : <p className="story-test-empty-setting">{es ? "No hay ítems en el inventario inicial." : "No items in the starting inventory."}</p>}
    <div className="story-test-initial-state-card"><label className="field-label inspector-field">{es ? "Añadir ítem" : "Add item"}<select value="" onChange={event => { if (event.target.value) dispatch({ type: "scenarioInventoryCopy", id: event.target.value }); }}><option value="">{items.length ? es ? "Elegir ítem de inventario" : "Choose inventory item" : es ? "No hay ítems habilitados" : "No inventory items enabled"}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
  </section>;
}

function OtherScenarioCopiesFields({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const copies = snapshot.scenarioCopies.filter(copy => !copy.inventoryItem);
  const entities = snapshot.entities.filter(entity => !entity.inventoryItem);
  return <details><summary>{es ? "Otras copias y estados iniciales" : "Other initial copies and states"}</summary>
    {copies.length ? copies.map(copy => <CopyFields key={copy.id} copy={copy} scope="scenario" snapshot={snapshot} dispatch={dispatch} locale={locale} />) : <p className="story-test-empty-setting">{es ? "No hay otras copias preparadas." : "No other copies prepared."}</p>}
    <label className="field-label">{es ? "Preparar otra copia" : "Prepare another copy"}<select value="" onChange={event => { if (event.target.value) dispatch({ type: "scenarioCopy", operation: "add", id: event.target.value }); }}><option value="">{es ? "Elegir entidad" : "Choose entity"}</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
  </details>;
}

function RawStateDraft({ scope, snapshot, dispatch, locale = snapshot.locale, disabled }: StoryTestViewProps & { scope: "run" | "scenario"; disabled?: boolean }) {
  const es = locale === "es";
  const key = scope + ":json";
  const errorId = useId();
  const error = snapshot.draftErrors[key];
  return <details><summary>{es ? "Avanzado: estado completo" : "Advanced: complete state"}</summary><label className="field-label">{es ? "Estado temporal en JSON" : "Temporary state as JSON"}<textarea rows={8} spellCheck={false} disabled={disabled} value={snapshot.drafts[key] ?? JSON.stringify(scope === "run" ? snapshot.state : snapshot.scenarioState, null, 2)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => dispatch({ type: "editDraft", key, value: event.target.value })} />{error ? <span id={errorId} className="story-test-field-error">{conditionDiagnosticMessage(error, locale)}</span> : null}</label></details>;
}

export function StoryTestPlaybackSettings({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const scenarioDrafts = Object.keys(snapshot.drafts).some(key => key.startsWith("scenario:"));
  const actor = snapshot.scenario?.actor ?? snapshot.scenarioState.context?.actor;
  const actorValue = storyTestSubjectValue(actor);
  const actorOptions = snapshot.scenarioSubjects;
  const hasActorOption = actorOptions.some(option => option.value === actorValue);
  return <div className="story-test-view story-test-playback-settings">
    <p className="inspector-panel-subtitle">{es ? "Un escenario guarda el actor, el punto de inicio y el estado de partida. Aplicarlo guarda esta plantilla en el documento; jugar crea una simulación temporal." : "A scenario stores the actor, starting point and initial state. Applying saves this setup to the document; playing creates a temporary simulation."}</p>
    <label className="field-label inspector-field">{es ? "Escenario" : "Scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Entrada predeterminada" : "Default entry"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
    <button type="button" className="story-test-scenario-create" onClick={() => dispatch({ type: "createScenario" })}>{es ? "Crear escenario" : "Create scenario"}</button>
    {snapshot.scenario ? <>
      <DraftField field={{ key: "scenario:name", id: "name", label: es ? "Nombre del escenario" : "Scenario name", type: "text", value: snapshot.scenario.name }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
      <DraftField field={{ key: "scenario:actor", id: "actor", label: es ? "Actor" : "Actor", type: "select", value: actorValue, options: hasActorOption ? actorOptions : actor && actorValue ? [...actorOptions, { value: actorValue, label: es ? "Actor actual" : "Current actor", group: es ? "Selección actual" : "Current selection" }] : actorOptions }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
      <DraftField field={{ key: "scenario:start", id: "start", label: es ? "Punto inicial" : "Starting point", type: "select", value: snapshot.drafts["scenario:start"] ?? snapshot.scenario.startNodeId ?? "", options: (snapshot.startNodes ?? []).map(node => ({ value: node.id, label: node.label })) }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
      <details className="story-test-initial-state"><summary className="inspector-panel-title">{es ? "Estado inicial" : "Initial state"}</summary>
        <div className="story-test-initial-state-content">
          <section className="story-test-initial-state-group"><h3 className="inspector-group-title">{es ? "Variables iniciales" : "Initial variables"}</h3>{snapshot.scenarioVariables.length ? snapshot.scenarioVariables.map(field => <div className="story-test-initial-state-card" key={field.key}><DraftField field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} /></div>) : <p className="story-test-empty-setting">{es ? "No hay variables iniciales." : "No initial variables."}</p>}</section>
          <ScenarioInventoryFields snapshot={snapshot} dispatch={dispatch} locale={locale} />
          <section className="story-test-initial-state-group"><OtherScenarioCopiesFields snapshot={snapshot} dispatch={dispatch} locale={locale} /></section>
        </div>
      </details>
      <div className="story-test-scenario-actions"><button type="button" className="story-test-scenario-button primary" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "applyScenarioDrafts" })}>{es ? "Aplicar escenario" : "Apply scenario"}</button><button type="button" className="story-test-scenario-button" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "discardDrafts", scope: "scenario" })}>{es ? "Descartar" : "Discard"}</button><button type="button" className="story-test-scenario-button danger" onClick={() => dispatch({ type: "deleteScenario" })}>{es ? "Eliminar escenario" : "Delete scenario"}</button></div>
    </> : <p>{es ? "Crea un escenario para preparar actor, copias y valores iniciales." : "Create a scenario to prepare actor, copies and initial values."}</p>}
  </div>;
}

/** Debug fields are owner drafts, so closing a presentation loses nothing. */
export function StoryTestDebug({ snapshot, dispatch, locale = snapshot.locale, integrated = false, compact = false, showScenarioSettings = true, showAdvanced = true }: StoryTestViewProps & {integrated?:boolean; compact?:boolean; showScenarioSettings?:boolean; showAdvanced?:boolean}) {
  const es = locale === "es";
  const runDisabled = !snapshot.active || snapshot.changed;
  const runDrafts = Object.keys(snapshot.drafts).some(key => key.startsWith("run:"));
  const scenarioDrafts = Object.keys(snapshot.drafts).some(key => key.startsWith("scenario:"));
  const traceLabels = es ? { enter: "Entrada", condition: "Condición", effect: "Consecuencia", route: "Ruta", rule: "Regla", action: "Acción", interaction: "Interacción", return: "Regreso", error: "Error" } : { enter: "Entry", condition: "Condition", effect: "Effect", route: "Route", rule: "Rule", action: "Action", interaction: "Interaction", return: "Return", error: "Error" };
  return <section className="story-test-view" aria-label={es ? "Debug del recorrido" : "Story run debug"}>
    {!integrated && !snapshot.debugAttached ? <button type="button" className="story-test-debug-attach" onClick={() => dispatch({ type: "debugAttachment", attached: true })}><PanelRightClose size={15} aria-hidden="true" /> {es ? "Acoplar a Play Mode" : "Attach to Play Mode"}</button> : null}
    {!compact ? <><StateStatus snapshot={snapshot} locale={locale} /><RevisionNotice snapshot={snapshot} dispatch={dispatch} locale={locale} /></> : null}
    {snapshot.error ? <p role="alert" className="story-test-message story-test-warning">{snapshot.error}</p> : null}
    {!compact ? <><div className="story-test-row"><button type="button" disabled={!snapshot.historyCount} onClick={() => dispatch({ type: "back" })}>{es ? "Paso anterior" : "Previous step"}</button><button type="button" disabled={!snapshot.active} onClick={() => dispatch({ type: "restart" })}>{es ? "Reiniciar" : "Restart"}</button>{snapshot.nodeId ? <button type="button" onClick={() => dispatch({ type: "locate", nodeId: snapshot.nodeId })}>{es ? "Localizar posición" : "Locate position"}</button> : null}</div>{snapshot.view?.title ? <p><strong>{snapshot.view.title}</strong></p> : null}<InteractionRun snapshot={snapshot} dispatch={dispatch} locale={locale} /></> : null}
    {snapshot.message ? <p role="alert" className="story-test-message">{conditionDiagnosticMessage(snapshot.message, locale)}</p> : null}
    <details open><summary>{es ? "Por qué ocurrió" : "Why it happened"}</summary>{snapshot.trace.length ? <ol className="story-test-trace">{snapshot.trace.map((entry, index) => <li key={index}><strong>{traceLabels[entry.kind]}</strong> · {entry.message}{entry.priority !== undefined ? <small> · {es ? "Prioridad" : "Priority"} {entry.priority}</small> : null}{entry.evaluation ? <EvaluationExplanation result={entry.evaluation} locale={locale} /> : null}{entry.changes.length ? <ul>{entry.changes.map((change, changeIndex) => <li key={changeIndex}>{change.label}: {JSON.stringify(change.before) ?? "∅"} → {JSON.stringify(change.after) ?? "∅"}</li>)}</ul> : null}{entry.nodeId ? <button type="button" onClick={() => dispatch({ type: "locate", nodeId: entry.nodeId })}>{es ? "Localizar" : "Locate"}</button> : null}</li>)}</ol> : <p>{es ? "La traza aparecerá al iniciar el recorrido." : "Start a run to see the trace."}</p>}</details>
    <details><summary>{es ? "Estado temporal e inventarios" : "Temporary state and inventories"}{runDrafts ? " · ✎" : ""}</summary>
      {snapshot.paused ? <p>{es ? "Aplicar ejecutará las reglas inmediatas y conservará la pausa." : "Apply executes immediate rules and keeps the run paused."}</p> : null}
      {snapshot.variables.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} />)}
      {snapshot.copies.map(copy => <CopyFields key={copy.id} copy={copy} scope="run" snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} />)}
      {showAdvanced ? <RawStateDraft scope="run" snapshot={snapshot} dispatch={dispatch} locale={locale} disabled={runDisabled} /> : null}
      <div className="story-test-row"><button type="button" className="story-test-primary" disabled={runDisabled || !runDrafts} onClick={() => dispatch({ type: "applyRunDrafts" })}>{es ? "Aplicar cambios temporales" : "Apply temporary changes"}</button><button type="button" disabled={!runDrafts} onClick={() => dispatch({ type: "discardDrafts", scope: "run" })}>{es ? "Descartar borradores" : "Discard drafts"}</button></div>
      <p><button type="button" disabled={!snapshot.active} onClick={() => dispatch({ type: "createScenario", fromRun: true })}>{es ? "Guardar estado como escenario inicial" : "Save state as initial scenario"}</button></p>
    </details>
    {showScenarioSettings ? <details><summary>{es ? "Preparar escenarios" : "Prepare scenarios"}{scenarioDrafts ? " · ✎" : ""}</summary>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
      <button type="button" onClick={() => dispatch({ type: "createScenario" })}>{es ? "Crear escenario" : "Create scenario"}</button>
      {snapshot.scenario ? <>
        <DraftField field={{ key: "scenario:name", id: "name", label: es ? "Nombre del escenario" : "Scenario name", type: "text", value: snapshot.scenario.name }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <DraftField field={{ key: "scenario:actor", id: "actor", label: "Actor", type: "select", value: storyTestSubjectValue(snapshot.scenario.actor), options: snapshot.scenarioSubjects }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <DraftField field={{ key: "scenario:start", id: "start", label: es ? "Punto inicial" : "Starting point", type: "select", value: snapshot.scenario.startNodeId ?? "", options: snapshot.startNodes.map(node => ({ value: node.id, label: node.label })) }} snapshot={snapshot} dispatch={dispatch} locale={locale} />
        {snapshot.scenarioVariables.map(field => <DraftField key={field.key} field={field} snapshot={snapshot} dispatch={dispatch} locale={locale} />)}
        <details><summary>{es ? "Estado inicial" : "Initial state"}</summary><ScenarioInventoryFields snapshot={snapshot} dispatch={dispatch} locale={locale} /><OtherScenarioCopiesFields snapshot={snapshot} dispatch={dispatch} locale={locale} /></details>
        <RawStateDraft scope="scenario" snapshot={snapshot} dispatch={dispatch} locale={locale} />
        <div className="story-test-row"><button type="button" className="story-test-primary" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "applyScenarioDrafts" })}>{es ? "Aplicar escenario" : "Apply scenario"}</button><button type="button" disabled={!scenarioDrafts} onClick={() => dispatch({ type: "discardDrafts", scope: "scenario" })}>{es ? "Descartar borradores" : "Discard drafts"}</button></div>
        <p><button type="button" className="danger" onClick={() => dispatch({ type: "deleteScenario" })}>{es ? "Eliminar escenario" : "Remove scenario"}</button></p>
      </> : <p>{es ? "Crea un escenario para preparar actor, copias y valores iniciales." : "Create a scenario to prepare the actor, copies and initial values."}</p>}
    </details> : null}
  </section>;
}

type StoryTestViewProps = { snapshot: StoryTestSnapshot; dispatch: (command: StoryTestUiCommand) => void; locale?: Locale };

function StoryTestConsequenceNotice({ snapshot, locale }: { snapshot: StoryTestSnapshot; locale: Locale }) {
  const [dismissed, setDismissed] = useState<string>();
  let index = snapshot.trace.length - 1;
  while (index >= 0 && !(snapshot.trace[index].kind === 'effect' && snapshot.trace[index].consequences?.length)) index--;
  const latest = snapshot.trace[index];
  const key = latest ? JSON.stringify([snapshot.sessionId, snapshot.draftEpochs.run, index, latest.id, latest.consequences]) : '';
  if (!snapshot.active || !latest || dismissed === key) return null;
  const es = locale === 'es';
  return <aside key={key} className="story-test-consequence-notice" role="status" aria-live="polite" aria-atomic="true" aria-label={es ? 'Última consecuencia' : 'Latest consequence'} onClick={event => event.stopPropagation()} onContextMenu={event => event.stopPropagation()}>
    <header><Gift size={16} aria-hidden="true" /><strong>{es ? 'Última consecuencia' : 'Latest consequence'}</strong><button type="button" className="story-test-icon" aria-label={es ? 'Cerrar aviso de consecuencia' : 'Dismiss consequence notice'} onClick={() => setDismissed(key)}><X size={14} aria-hidden="true" /></button></header>
    <ul>{latest.consequences!.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul>
  </aside>;
}

type StoryTestDiceGroup = { id: string; label: string; sides?: number; rollSides?: number[]; rollLabels?: string[]; rolls: number[]; total?: number };
type StoryTestDiceNotice = { id: string; groups: StoryTestDiceGroup[]; rolling: boolean };

function storyTestDiceNotices(snapshot: StoryTestSnapshot, locale: Locale): Omit<StoryTestDiceNotice, "rolling">[] {
  const es = locale === "es";
  return Object.values(snapshot.state.interactionResults ?? {})
    .filter(result => !result.forced)
    .map(result => {
      const traces = result.participantTraces?.filter(trace => Boolean(trace.rolls?.length)) ?? [];
      const groups: StoryTestDiceGroup[] = traces.length
        ? traces.map(trace => ({
            id: trace.participantId,
            label: snapshot.scenarioSubjects.find(option => option.value === storyTestSubjectValue(trace.subject))?.label ?? trace.participantId,
            sides: trace.dice?.sides,
            rollSides: trace.dice ? diceGroups(trace.dice).flatMap(group => Array.from({ length: group.count }, () => group.sides)) : undefined,
            rollLabels: trace.dice ? diceGroups(trace.dice).flatMap(group => Array.from({ length: group.count }, () => diceFaceLabel(group))) : undefined,
            rolls: trace.rolls ?? [],
            total: trace.total,
          }))
        : result.rolls?.length
          ? [{ id: result.executionId, label: result.dice ? diceFormula(result.dice) : es ? "Tirada" : "Roll", sides: result.dice?.sides, rollSides: result.dice ? diceGroups(result.dice).flatMap(group => Array.from({ length: group.count }, () => group.sides)) : undefined, rollLabels: result.dice ? diceGroups(result.dice).flatMap(group => Array.from({ length: group.count }, () => diceFaceLabel(group))) : undefined, rolls: result.rolls, total: result.total }]
          : [];
      return { id: result.executionId, groups };
    })
    .filter(notice => notice.groups.length)
    .sort((a, b) => Number(a.id.split(":").at(-1)) - Number(b.id.split(":").at(-1)));
}

function StoryTestDiceSimulator({ snapshot, locale }: { snapshot: StoryTestSnapshot; locale: Locale }) {
  const es = locale === "es";
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);
  const [notice, setNotice] = useState<StoryTestDiceNotice>();
  const signature = JSON.stringify(storyTestDiceNotices(snapshot, locale));

  useEffect(() => {
    const notices = JSON.parse(signature) as Omit<StoryTestDiceNotice, "rolling">[];
    if (!initialized.current) {
      initialized.current = true;
      notices.forEach(item => seen.current.add(item.id));
      const latest = notices.at(-1);
      if (latest) setNotice({ ...latest, rolling: false });
      return;
    }
    if (!notices.length) {
      seen.current.clear();
      setNotice(undefined);
      return;
    }
    const fresh = notices.filter(item => !seen.current.has(item.id));
    if (!fresh.length) return;
    fresh.forEach(item => seen.current.add(item.id));
    const latest = fresh.at(-1)!;
    setNotice({ ...latest, rolling: true });
  }, [signature]);

  useEffect(() => {
    if (!notice) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      if (notice.rolling) setNotice(current => current?.id === notice.id ? { ...current, rolling: false } : current);
      else setNotice(current => current?.id === notice.id ? undefined : current);
    }, notice.rolling ? reducedMotion ? 120 : 900 : 3600);
    return () => window.clearTimeout(timer);
  }, [notice?.id, notice?.rolling]);

  if (!notice) return null;
  return <div className={`story-test-dice-simulator${notice.rolling ? " is-rolling" : ""}`} role="status" aria-live="polite" aria-label={es ? "Resultado de la tirada de dados" : "Dice roll result"}>
    <strong className="story-test-dice-title">{es ? "Tirada" : "Roll"}</strong>
    {notice.groups.map(group => <div className="story-test-dice-group" key={group.id}>
      {notice.groups.length > 1 ? <strong className="story-test-dice-label">{group.label}</strong> : null}
      <div className="story-test-dice-faces" aria-label={group.rolls.map(value => es ? `resultado ${value}` : `result ${value}`).join(", ")}>
        {group.rolls.slice(0, 6).map((value, index) => <span className="story-test-die" key={`${group.id}-${index}`}><small>{group.rollLabels?.[index] ?? (group.rollSides?.[index] || group.sides ? `D${group.rollSides?.[index] ?? group.sides}` : "D")}</small><b>{notice.rolling ? "?" : value}</b></span>)}
        {group.rolls.length > 6 ? <span className="story-test-dice-more">+{group.rolls.length - 6}</span> : null}
      </div>
      <span className="story-test-dice-total">{notice.rolling ? "…" : `= ${group.total ?? group.rolls.reduce((sum, value) => sum + value, 0)}`}</span>
    </div>)}
  </div>;
}

export function storyTestPlayTitle(snapshot: StoryTestSnapshot, locale: Locale = snapshot.locale): string {
  return `Play Mode [${snapshot.storyName.trim() || (locale === "es" ? "Historia sin título" : "Untitled story")}]`;
}

/** Both the canvas and detached window present the same owner-controlled run. */
export function StoryTestPlayback({ snapshot, dispatch, locale = snapshot.locale }: StoryTestViewProps) {
  const es = locale === "es";
  const attached = snapshot.debugOpen && snapshot.debugAttached;
  return <div className={`story-test-playback${attached ? " with-debug" : ""}`}>
    <div className="story-test-playback-layout">
      <StoryTestPreview snapshot={snapshot} dispatch={dispatch} locale={locale} />
      {attached ? <aside className="story-test-docked-debug" aria-label={es ? "Debug acoplado a Play Mode" : "Debug attached to Play Mode"}>
        <header className="story-test-docked-debug-header"><strong><Bug size={15} aria-hidden="true" /> Debug</strong><div className="story-test-row">
          <button type="button" className="story-test-icon" aria-label={es ? "Separar Debug" : "Undock Debug"} title={es ? "Separar Debug" : "Undock Debug"} onClick={() => dispatch({ type: "debugAttachment", attached: false })}><PanelRightOpen size={15} aria-hidden="true" /></button>
          <button type="button" className="story-test-icon" aria-label={es ? "Cerrar Debug" : "Close Debug"} title={es ? "Cerrar Debug" : "Close Debug"} onClick={() => dispatch({ type: "debug", open: false })}><X size={15} aria-hidden="true" /></button>
        </div></header>
        <div className="story-test-docked-debug-content"><StoryTestDebug snapshot={snapshot} dispatch={dispatch} locale={locale} /></div>
      </aside> : null}
    </div>
  </div>;
}

/** Play Mode surface hosted by the inspector tab. */
export function StoryTestInspectorView({ snapshot, dispatch, locale = snapshot.locale, detachable = false, onDetach, onOpenPlay, fullscreen }: StoryTestViewProps & { detachable?: boolean; onDetach?: () => void; onOpenPlay?: () => void; fullscreen: boolean }) {
  const es = locale === "es";
  if (fullscreen) return <StoryTestGeneralView snapshot={snapshot} dispatch={dispatch} locale={locale} fullscreen detachable={detachable} onDetach={onDetach} onOpenPlay={onOpenPlay} />;
  return <section className="story-test-inspector-play" aria-label={storyTestPlayTitle(snapshot, locale)}>
    <header className="story-test-inspector-play-toolbar">
      <strong>{storyTestPlayTitle(snapshot, locale)}</strong>
      {detachable && onDetach ? <button type="button" className="story-test-icon" aria-label={es ? "Abrir en otra ventana" : "Open in another window"} title={es ? "Abrir en otra ventana" : "Open in another window"} onClick={onDetach}><ExternalLink size={15} aria-hidden="true" /></button> : null}
    </header>
    <div className="story-test-inspector-play-content"><StoryTestGeneralView tabbed snapshot={snapshot} dispatch={dispatch} locale={locale} onOpenPlay={onOpenPlay} /></div>
  </section>;
}

function StateStatus({ snapshot, locale, hideReady = false }: { snapshot: StoryTestSnapshot; locale: Locale; hideReady?: boolean }) {
  const es = locale === "es";
  if (hideReady && !snapshot.active && !snapshot.paused && !snapshot.changed && !snapshot.status) return null;
  const status = snapshot.changed ? es ? "Revisión anterior" : "Previous revision" : snapshot.paused ? es ? "En pausa" : "Paused" : snapshot.status === "ended" ? es ? "Recorrido terminado" : "Run finished" : snapshot.status === "blocked" ? es ? "Recorrido detenido" : "Run stopped" : snapshot.active ? es ? "En curso" : "Running" : es ? "Listo para probar" : "Ready to test";
  const icon = snapshot.changed || snapshot.status === "blocked" ? "!" : snapshot.paused ? "⏸" : snapshot.status === "ended" ? "✓" : "▶";
  return <p className="story-test-status" role="status"><span aria-hidden="true">{icon}</span><strong>{status}</strong></p>;
}

function RevisionNotice({ snapshot, dispatch, locale }: StoryTestViewProps) {
  const es = (locale ?? snapshot.locale) === "es";
  return snapshot.changed ? <div className="story-test-message story-test-warning" role="status"><p>{es ? "La historia cambió. El recorrido conserva la revisión anterior." : "The story changed. This run keeps the previous revision."}</p><button type="button" onClick={() => dispatch({ type: "restart" })}>{es ? "Reiniciar con la nueva revisión" : "Restart with the new revision"}</button></div> : null;
}

function SpeakerPortrait({ url, name, locale }: { url?: string; name: string; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <div className="story-test-character">
    {url && !failed ? <img className="story-test-portrait" src={url} alt={locale === "es" ? `Retrato de ${name}` : `Portrait of ${name}`} onError={() => setFailed(true)} /> : <div className="story-test-portrait-fallback" role="img" aria-label={locale === "es" ? `${name}: sin retrato disponible` : `${name}: no portrait available`}><UserRound size={42} aria-hidden="true" /><span>{locale === "es" ? "Sin retrato" : "No portrait"}</span></div>}
  </div>;
}

/** A simple story screen; choices and actions remain commands to the owner. */
export function StoryTestPreview({ snapshot, dispatch, locale = snapshot.locale, showTopline = true, showActions = true }: StoryTestViewProps & { showTopline?: boolean; showActions?: boolean }) {
  const es = locale === "es";
  const canAdvance = snapshot.active && !snapshot.paused && !snapshot.changed && snapshot.status === "ready";
  const choices = snapshot.view?.choices.filter(choice => !choice.hidden) ?? [];
  const speakerName = snapshot.view?.speakerName ?? snapshot.view?.speakerRef ?? (es ? "Narración" : "Narration");
  const handlePlaybackClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest("button, a, input, select, textarea, summary, details, [role='button'], [contenteditable='true'], .story-test-play-overlays, .story-test-play-topline")) return;
    if (!canAdvance || snapshot.view?.waiting || snapshot.view?.kind === "decision" || Boolean(snapshot.view?.choices.length)) return;
    dispatch({ type: "continue" });
  };
  const handlePlaybackContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (snapshot.historyCount > 0) dispatch({ type: "back" });
  };
  return <section className="story-test-view story-test-play-screen" aria-label={storyTestPlayTitle(snapshot, locale)} onClick={handlePlaybackClick} onContextMenu={handlePlaybackContextMenu}>
    {showTopline ? <div className="story-test-play-topline"><StateStatus snapshot={snapshot} locale={locale} /><div className="story-test-row">
      {snapshot.nodeId ? <button type="button" className="story-test-icon" aria-label={es ? "Localizar posición en el canvas" : "Locate position on canvas"} title={es ? "Localizar posición" : "Locate position"} onClick={() => dispatch({ type: "locate", nodeId: snapshot.nodeId })}><Crosshair size={15} aria-hidden="true" /></button> : null}
      <button type="button" className="story-test-icon" aria-label={es ? "Abrir debug" : "Open debug"} title={es ? "Abrir debug" : "Open debug"} aria-pressed={snapshot.debugOpen} onClick={() => dispatch({ type: "debug", open: true })}><Bug size={15} aria-hidden="true" /></button>
    </div></div> : null}
    <div className="story-test-play-frame">
      {(snapshot.view?.eventName || snapshot.view?.title) ? <h2 className="story-test-scene-title">{snapshot.view.eventName || snapshot.view.title}</h2> : null}
      <div className="story-test-play-scene">
        <StoryTestConsequenceNotice snapshot={snapshot} locale={locale} />
        <StoryTestDiceSimulator snapshot={snapshot} locale={locale} />
        {snapshot.view?.locationName ? <div className="story-test-location-name">{snapshot.view.locationName}</div> : null}
        {!snapshot.active ? <div className="story-test-empty-screen"><Play size={30} aria-hidden="true" /><p>{es ? "Pulsa Play para iniciar la historia." : "Press Play to start the story."}</p><small>{es ? "Las elecciones solo cambian el estado temporal." : "Choices only change temporary state."}</small></div> : null}
        {(snapshot.error || snapshot.changed || snapshot.view?.interactions?.length || snapshot.message || choices.length || snapshot.status === "ended" || showActions && snapshot.view?.actions.length) ? <div className="story-test-play-overlays">
          <RevisionNotice snapshot={snapshot} dispatch={dispatch} locale={locale} />
          {snapshot.error ? <p className="story-test-message story-test-warning" role="alert">{snapshot.error}</p> : null}
          <InteractionRun snapshot={snapshot} dispatch={dispatch} locale={locale} />
          {snapshot.message ? <p className="story-test-message" role="alert">{conditionDiagnosticMessage(snapshot.message, locale)}</p> : null}
          {choices.length ? <div className="story-test-responses" aria-label={es ? "Opciones" : "Options"}>{choices.map((choice, index) => <div key={choice.id}>
            <button type="button" className="story-test-response" disabled={!canAdvance || choice.status !== "satisfied"} onClick={() => dispatch({ type: "choose", outcomeId: choice.id })}>
              <span className="story-test-response-number" aria-hidden="true">{choice.status === "satisfied" ? index + 1 : <LockKeyhole size={14} />}</span><span className="story-test-response-text">{choice.text}{choice.status !== "satisfied" ? <small>{conditionDiagnosticMessage(choice.reason ?? (es ? "No cumple sus requisitos" : "Requirements not met"), locale)}</small> : null}</span>
            </button>
            {choice.status !== "satisfied" && !choice.masked ? <details><summary>{es ? "Ver requisitos" : "View requirements"}</summary>{choice.summary ? <p>{choice.summary}</p> : null}<EvaluationExplanation result={choice.evaluation} locale={locale} /></details> : null}
          </div>)}</div> : null}
          {snapshot.status === "ended" && !snapshot.changed ? <div className="story-test-play-footer"><span>{es ? "Fin de la historia" : "End of story"}</span><button type="button" onClick={() => dispatch({ type: "restart" })}><RotateCcw size={14} aria-hidden="true" /> {es ? "Volver a jugar" : "Play again"}</button></div> : null}
          {showActions && snapshot.view?.actions.length ? <details><summary>{es ? "Acciones disponibles" : "Available actions"}</summary><StoryTestAvailableActions snapshot={snapshot} dispatch={dispatch} locale={locale} canAdvance={canAdvance} /></details> : null}
        </div> : null}
      </div>
      {snapshot.view ? <div className="story-test-dialogue-box" aria-live="polite" aria-atomic="true">
        {snapshot.view.speakerRef || snapshot.view.speakerPortraitUrl ? <div className="story-test-dialogue-portrait"><SpeakerPortrait url={snapshot.view.speakerPortraitUrl} name={speakerName} locale={locale} /></div> : null}
        <div className="story-test-dialogue-copy"><p className="story-test-speaker">{speakerName}</p><div className="story-test-content">{snapshot.view.text || (snapshot.status === "ended" ? es ? "Fin de la historia." : "The story has ended." : es ? "Elige cómo continuar." : "Choose how to continue.")}</div></div>
      </div> : null}
    </div>
  </section>;
}

export function StoryTestAvailableActions({ snapshot, dispatch, locale = snapshot.locale, canAdvance = snapshot.active && !snapshot.paused && !snapshot.changed && snapshot.status === "ready" }: StoryTestViewProps & { canAdvance?: boolean }) {
  const es = locale === "es";
  return <div className="story-test-actions-inline" role="group" aria-label={es ? "Acciones disponibles" : "Available actions"}>
    <label>{es ? "Origen" : "Source"}<select aria-label={es ? "Origen de la acción" : "Action source"} value={snapshot.actionSource} onChange={event => dispatch({ type: "actionContext", source: event.target.value })}><option value="">{es ? "Actor del escenario" : "Scenario actor"}</option>{snapshot.subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}</select></label>
    <label>{es ? "Destino" : "Target"}<select aria-label={es ? "Destinatario" : "Recipient"} value={snapshot.actionTarget} onChange={event => dispatch({ type: "actionContext", target: event.target.value })}><option value="">{es ? "Sin destinatario" : "No recipient"}</option>{snapshot.subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}</select></label>
    {!snapshot.actions.length ? <span className="story-test-actions-empty">{es ? "Sin acciones para este origen" : "No actions for this source"}</span> : snapshot.actions.map(action => {
      const reason = action.reason ? conditionDiagnosticMessage(action.reason, locale) : action.status !== "satisfied" ? conditionDiagnosticMessage(action.evaluation.message, locale) : undefined;
      return <button key={action.id} type="button" disabled={!canAdvance || action.status !== "satisfied" || Boolean(action.reason)} title={reason} aria-label={reason ? `${action.name}: ${reason}` : action.name} onClick={() => dispatch({ type: "action", actionId: action.id })}>{action.name}</button>;
    })}
  </div>;
}

/** Fullscreen, detached and inspector-tab Play share the complete playback tools. */
export function StoryTestGeneralView({ snapshot, dispatch, locale = snapshot.locale, fullscreen = false, tabbed = false, detachable = false, onDetach, onOpenPlay }: StoryTestViewProps & { fullscreen?: boolean; tabbed?: boolean; detachable?: boolean; onDetach?: () => void; onOpenPlay?: () => void }) {
  const es = locale === "es";
  return <section className={`story-test-general${fullscreen ? " fullscreen" : ""}${tabbed ? " tabbed" : ""}`} aria-label={storyTestPlayTitle(snapshot, locale)}>
    <section className="story-test-general-stage" aria-label={es ? "Reproducción" : "Playback"}>
      <StoryTestPreview snapshot={snapshot} dispatch={dispatch} locale={locale} showTopline={false} showActions={false} />
    </section>
    <div className="story-test-general-toolbar" role="toolbar" aria-label={es ? "Controles y acciones de reproducción" : "Playback controls and actions"}>
      <StoryTestControls snapshot={snapshot} dispatch={dispatch} locale={locale} onOpenPlay={onOpenPlay} showOptions={false} />
      <button type="button" disabled={!snapshot.historyCount} onClick={() => dispatch({ type: "back" })}>{es ? "Anterior" : "Back"}</button>
      <button type="button" disabled={!snapshot.active} onClick={() => dispatch({ type: "restart" })}><RotateCcw size={14} aria-hidden="true" /> {es ? "Reiniciar" : "Restart"}</button>
      {snapshot.view?.actions.length ? <StoryTestAvailableActions snapshot={snapshot} dispatch={dispatch} locale={locale} /> : null}
      {detachable && onDetach ? <button type="button" className="story-test-icon" aria-label={es ? "Abrir Play Mode y Debug en otra ventana" : "Open Play Mode and Debug in another window"} title={es ? "Abrir Play Mode y Debug en otra ventana" : "Open Play Mode and Debug in another window"} onClick={onDetach}><ExternalLink size={15} aria-hidden="true" /></button> : null}
    </div>
    <div className="story-test-general-columns">
      <section className="story-test-general-column" aria-labelledby="story-test-general-settings-title"><h2 id="story-test-general-settings-title">{es ? "Configuración de reproducción" : "Playback settings"}</h2><StoryTestPlaybackSettings snapshot={snapshot} dispatch={dispatch} locale={locale} /></section>
      <section className="story-test-general-column" aria-labelledby="story-test-general-debug-title"><h2 id="story-test-general-debug-title">Debug</h2><StoryTestDebug integrated compact showScenarioSettings={false} showAdvanced={false} snapshot={snapshot} dispatch={dispatch} locale={locale} /></section>
    </div>
  </section>;
}

/** Toolbar buttons intentionally have no layer/tab semantics. */
export function StoryTestControls({ snapshot, dispatch, locale = snapshot.locale, compact = false, onOpenPlay, showOptions = true }: StoryTestViewProps & { compact?: boolean; onOpenPlay?: () => void; showOptions?: boolean }) {
  const es = locale === "es";
  const [revealed, setRevealed] = useState(false);
  const expanded = !compact || revealed || snapshot.active || snapshot.debugOpen;
  useEffect(() => { if (!snapshot.active && !snapshot.debugOpen) setRevealed(false); }, [snapshot.active, snapshot.debugOpen]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useApplicationEffect(() => {
    if (!menuOpen) return;
    controls.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !controls.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen]);
  const playbackLabel = !snapshot.active ? storyTestPlayTitle(snapshot, locale) : snapshot.paused ? es ? "Reanudar recorrido" : "Resume run" : es ? "Pausar recorrido" : "Pause run";
  const closeMenu = () => { setMenuOpen(false); menuButton.current?.focus(); };
  return <div ref={controls} className={`story-test-controls nodrag nopan${compact ? " compact" : ""}${expanded ? " expanded" : ""}`} role="group" aria-label={es ? "Controles de Play Mode" : "Play Mode controls"} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape" && menuOpen) { event.preventDefault(); event.stopPropagation(); closeMenu(); } }}>
    <button type="button" className="story-test-icon story-test-play-trigger" aria-label={playbackLabel} title={playbackLabel} aria-expanded={compact ? expanded : undefined} disabled={snapshot.changed || snapshot.status === "ended"} onClick={() => { setRevealed(true); if (!snapshot.active || snapshot.paused) onOpenPlay?.(); dispatch({ type: snapshot.active && !snapshot.paused ? "pause" : "play" }); }}>{snapshot.active && !snapshot.paused ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button>
    <span className="story-test-extra-controls" inert={!expanded} aria-hidden={!expanded}>
    <button type="button" className="story-test-icon" aria-label={es ? "Detener y cerrar recorrido" : "Stop and close run"} title={es ? "Detener y cerrar recorrido" : "Stop and close run"} disabled={!snapshot.active && !snapshot.debugOpen} onClick={() => { setRevealed(false); setMenuOpen(false); dispatch({ type: "stop" }); }}><Square size={14} aria-hidden="true" /></button>
    {showOptions ? <button ref={menuButton} type="button" className="story-test-icon" aria-label={es ? "Opciones de Play Mode" : "Play Mode options"} title={es ? "Opciones de Play Mode" : "Play Mode options"} aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(open => !open)}><ChevronDown size={13} aria-hidden="true" /></button> : null}
    </span>
    {showOptions && menuOpen ? <div id={menuId} className="story-test-settings" role="dialog" aria-label={es ? "Opciones de Play Mode" : "Play Mode options"}>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={snapshot.scenarioId} onChange={event => dispatch({ type: "scenario", id: event.target.value })}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{snapshot.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label>
      <div className="story-test-row"><button type="button" onClick={() => { onOpenPlay?.(); dispatch({ type: "start" }); closeMenu(); }}>{es ? "Desde la entrada" : "From story entry"}</button><button type="button" disabled={!snapshot.selectedNodeId} onClick={() => { onOpenPlay?.(); dispatch({ type: "start", fromSelection: true }); closeMenu(); }}>{es ? "Desde selección" : "From selection"}</button></div>
      {snapshot.active ? <p><button type="button" onClick={() => { onOpenPlay?.(); dispatch({ type: "restart" }); closeMenu(); }}><RotateCcw size={13} aria-hidden="true" /> {snapshot.changed ? es ? "Reiniciar con la nueva revisión" : "Restart with the new revision" : es ? "Reiniciar recorrido" : "Restart run"}</button></p> : null}
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

function constrainGeometry(geometry: PanelGeometry, bounds: PanelBounds, kind: "preview" | "debug"): PanelGeometry {
  const width = Math.min(Math.max(kind === "preview" ? 340 : 260, geometry.width), Math.max(160, bounds.width - 24));
  const height = Math.min(Math.max(kind === "preview" ? 280 : 170, geometry.height), Math.max(150, bounds.height - 116));
  return { width, height, x: Math.max(12, Math.min(geometry.x, bounds.width - width - 12)), y: Math.max(104, Math.min(geometry.y, bounds.height - height - 12)) };
}

function initialGeometry(kind: "preview" | "debug", bounds: PanelBounds, avoidWriter: boolean): PanelGeometry {
  const compact = avoidWriter;
  const width = kind === "preview" ? 540 : Math.min(380, Math.max(260, bounds.width - 576));
  const height = kind === "preview" ? 460 : 420;
  return constrainGeometry({ x: kind === "debug" ? bounds.width - width - 12 : 12, y: kind === "preview" && !compact ? bounds.height - height - 16 : 104, width, height }, bounds, kind);
}

/** Canvas-local presentation only. Geometry never enters the narrative document. */
export function FloatingStoryTestPanel({ kind, title, locale = "en", children, toolbar, onDetach, onClose, detachable = false, avoidWriter = false, reservedInspectorWidth = 520, projectId, sessionId, docked = false }: {
  kind: "preview" | "debug"; title: string; locale?: Locale; children: ReactNode;
  toolbar?: ReactNode;
  onDetach?: () => void; onClose?: () => void; detachable?: boolean; avoidWriter?: boolean; reservedInspectorWidth?:number;
  projectId?: string; sessionId?: string; docked?: boolean;
}) {
  const es = locale === "es";
  const frame = useRef<HTMLElement>(null);
  const geometryRef = useRef<PanelGeometry | undefined>(undefined);
  const boundsRef = useRef<PanelBounds>({ width: 1000, height: 700 });
  const compactWriter = useRef(false);
  const returnFocus = useRef<HTMLElement | undefined>(undefined);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: PanelGeometry } | undefined>(undefined);
  const [geometry, setGeometry] = useState<PanelGeometry>();
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const moveHelp = useId();
  const resizeHelp = useId();
  const titleId = useId();
  const storageKey = `pathbranching:story-test:${projectId ?? "workspace"}:${kind}:geometry`;
  const updateGeometry = (next: PanelGeometry) => {
    const constrained = constrainGeometry(next, boundsRef.current, kind);
    geometryRef.current = constrained;
    setGeometry(constrained);
    try { localStorage.setItem(storageKey, JSON.stringify(constrained)); } catch { /* Geometry is optional UI state. */ }
  };
  useEffect(() => {
    const updateFullscreen = () => {
      setFullscreen(document.fullscreenElement === frame.current);
      setFullscreenError(false);
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);
  useEffect(() => {
    if (docked) return;
    const element = frame.current;
    const parent = element?.offsetParent;
    if (!(parent instanceof HTMLElement) || !element) return;
    if (!returnFocus.current || !returnFocus.current.isConnected) returnFocus.current = document.activeElement instanceof HTMLElement && !element.contains(document.activeElement) ? document.activeElement : undefined;
    const bounds = () => {
      compactWriter.current = avoidWriter && parent.clientWidth < reservedInspectorWidth + 480 + 360 + 36;
      return { width: avoidWriter && !compactWriter.current ? Math.max(360, parent.clientWidth - reservedInspectorWidth - 480 - 36) : parent.clientWidth, height: compactWriter.current ? parent.clientHeight * .48 - 12 : parent.clientHeight };
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
      if (!visible() || document.fullscreenElement === element) return;
      boundsRef.current = bounds();
      updateGeometry(geometryRef.current ?? restored ?? initialGeometry(kind, boundsRef.current, compactWriter.current));
    });
    const frameObserver = new ResizeObserver(() => {
      if (document.fullscreenElement === element) return;
      const current = geometryRef.current;
      if (visible() && current && (Math.abs(element.offsetWidth - current.width) > 1 || Math.abs(element.offsetHeight - current.height) > 1)) updateGeometry({ ...current, width: element.offsetWidth, height: element.offsetHeight });
    });
    parentObserver.observe(parent);
    frameObserver.observe(element);
    return () => {
      parentObserver.disconnect(); frameObserver.disconnect();
      if (returnFocus.current?.isConnected && element.contains(document.activeElement)) returnFocus.current.focus();
    };
  }, [kind, projectId, sessionId, avoidWriter, reservedInspectorWidth, docked]);
  const toggleFullscreen = async () => {
    const element = frame.current;
    if (!element || kind !== "preview") return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      setFullscreenError(true);
    }
  };
  const close = () => {
    if (document.fullscreenElement === frame.current) void document.exitFullscreen().catch(() => undefined);
    if (returnFocus.current?.isConnected) returnFocus.current.focus();
    onClose?.();
  };
  const resize = (horizontal: number, vertical: number) => { if (geometryRef.current) updateGeometry({ ...geometryRef.current, width: geometryRef.current.width + horizontal, height: geometryRef.current.height + vertical }); };
  const style: CSSProperties | undefined = !fullscreen && geometry ? { left: geometry.x, top: geometry.y, width: geometry.width, height: geometry.height } : undefined;
  return <section ref={frame} style={style} className={`story-test-panel story-test-${kind} nodrag nopan nowheel${fullscreen ? " fullscreen" : ""}`} aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === "Escape" && document.fullscreenElement === frame.current) {
      event.preventDefault(); event.stopPropagation();
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (event.key === "Escape" && onClose) { event.preventDefault(); event.stopPropagation(); close(); }
  }} onPointerDown={event => event.stopPropagation()}>
    <header className="story-test-panel-header">
      <div className="story-test-drag-handle" role={docked ? undefined : "button"} tabIndex={docked ? undefined : 0} aria-label={docked ? undefined : es ? `Mover ${title}` : `Move ${title}`} aria-describedby={docked ? undefined : moveHelp} onPointerDown={event => {
        if (docked || event.button !== 0 || !geometryRef.current) return;
        event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: geometryRef.current };
      }} onPointerMove={event => {
        const current = drag.current;
        if (current?.pointerId === event.pointerId) updateGeometry({ ...current.origin, x: current.origin.x + event.clientX - current.x, y: current.origin.y + event.clientY - current.y });
      }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = undefined; event.currentTarget.releasePointerCapture(event.pointerId); } }} onPointerCancel={() => { drag.current = undefined; }} onKeyDown={event => {
        const current = geometryRef.current;
        if (docked || !current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        const horizontal = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
        const vertical = event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
        updateGeometry(event.key === "Home" ? initialGeometry(kind, boundsRef.current, compactWriter.current) : event.ctrlKey ? { ...current, width: current.width + horizontal, height: current.height + vertical } : { ...current, x: current.x + horizontal, y: current.y + vertical });
      }}><GripHorizontal size={15} aria-hidden="true" /><strong id={titleId}>{title}</strong></div>
      {toolbar ? <div className="story-test-panel-toolbar">{toolbar}</div> : null}
      {kind === "preview" ? <button type="button" className="story-test-icon" onClick={() => { void toggleFullscreen(); }} aria-label={fullscreen ? es ? "Salir de pantalla completa" : "Exit fullscreen" : es ? "Pantalla completa" : "Enter fullscreen"} title={fullscreen ? es ? "Salir de pantalla completa" : "Exit fullscreen" : es ? "Pantalla completa" : "Enter fullscreen"} aria-pressed={fullscreen}>{fullscreen ? <Shrink size={15} aria-hidden="true" /> : <Fullscreen size={15} aria-hidden="true" />}</button> : null}
      {detachable && onDetach ? <button type="button" className="story-test-icon" onClick={onDetach} aria-label={es ? `Desacoplar ${title}` : `Detach ${title}`} title={es ? "Abrir en otra ventana" : "Open in another window"}><Maximize2 size={15} aria-hidden="true" /></button> : null}
      {onClose ? <button type="button" className="story-test-icon" onClick={close} aria-label={es ? `Cerrar ${title}` : `Close ${title}`}><X size={15} aria-hidden="true" /></button> : null}
    </header>
    {fullscreenError ? <p className="story-test-fullscreen-error" role="alert">{es ? "No se pudo activar la pantalla completa." : "Could not enter fullscreen."}</p> : null}
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

function InteractionRun({ snapshot, dispatch, locale }: StoryTestViewProps) {
  const es = (locale ?? snapshot.locale) === 'es';
  const interactions = snapshot.view?.interactions ?? [];
  const disabled = !snapshot.active || snapshot.paused || snapshot.changed || snapshot.status !== 'ready';
  const participantName = (trace: import('../domain.js').InteractionParticipantTrace) => {
    const subject = trace.subject;
    const exact = snapshot.scenarioSubjects.find(option => option.value === storyTestSubjectValue(subject))?.label;
    const name = exact ?? (subject.kind === 'entity' ? snapshot.entities.find(entity => entity.id === subject.entityId)?.name
      : subject.kind === 'instance' ? snapshot.copies.find(copy => copy.id === subject.instanceId)?.name : undefined);
    return `${name ?? (trace.participantId === 'actor' ? es ? 'Actor' : 'Actor' : es ? 'Rival' : 'Opponent')}${!exact && trace.variantId && trace.variantId !== 'base' ? ` · ${trace.variantId}` : ''}`;
  };
  const tracesView = (traces: import('../domain.js').InteractionParticipantTrace[], completed = false) => {
    const actor = traces[0];
    const diceBreakdown = (dice: import('../domain.js').InteractionDice | undefined, rolls?: number[]) => {
      if (!dice) return es ? 'Sin dado' : 'No dice';
      let offset = 0;
      return diceGroups(dice).map(group => { const values = rolls?.slice(offset, offset + group.count); offset += group.count; return `${diceGroupFormula(group)}${values?.length ? ` (${values.join(' + ')})` : ''}`; }).join(' + ');
    };
    return <div className="interaction-participant-traces" aria-label={es ? 'Tiradas de los personajes' : 'Character rolls'}>{traces.map((trace, index) => {
      const comparison = completed && index > 0 && actor.total !== undefined && trace.total !== undefined
        ? actor.total > trace.total ? es ? 'Victoria' : 'Victory' : actor.total < trace.total ? es ? 'Derrota' : 'Defeat' : es ? 'Empate' : 'Tie' : undefined;
      const conditionalTotal = (trace.modifierBreakdown ?? []).reduce((sum, item) => sum + item.modifier, 0);
      const fixedModifier = trace.modifier - conditionalTotal;
      return <div key={trace.participantId} className="interaction-participant-trace"><strong>{participantName(trace)}</strong>
        <span>{diceBreakdown(trace.dice, trace.rolls)}{trace.skillSource ? ` + ${trace.skillLabel ?? (trace.skillSource.kind === 'property' ? trace.skillSource.propertyId : trace.skillSource.variableId)} (${trace.skillValue})` : ''}{fixedModifier ? ` ${fixedModifier > 0 ? '+' : '−'} ${Math.abs(fixedModifier)}` : ''}{trace.modifierBreakdown?.map(item => ` ${item.modifier > 0 ? '+' : '−'} ${Math.abs(item.modifier)} · ${item.name}`).join('')}{trace.total !== undefined ? ` = ${trace.total}` : ''}</span>
        {comparison ? <span>{comparison} · {actor.total} {actor.total! > trace.total! ? '>' : actor.total! < trace.total! ? '<' : '='} {trace.total}</span> : null}</div>;
    })}</div>;
  };
  const latestContest = Object.values(snapshot.state.interactionResults ?? []).filter(result => result.participantTraces?.length)
    .sort((left, right) => Number(left.executionId.split(':').at(-1)) - Number(right.executionId.split(':').at(-1))).at(-1);
  const latestRoll = Object.values(snapshot.state.interactionResults ?? []).filter(result => !result.participantTraces?.length && result.rolls?.length)
    .sort((left, right) => Number(left.executionId.split(':').at(-1)) - Number(right.executionId.split(':').at(-1))).at(-1);
  const latestRuleTotal = latestRoll?.modifierBreakdown?.reduce((sum, item) => sum + item.modifier, 0) ?? 0;
  const latestFixedModifier = latestRoll?.modifier === undefined ? 0 : latestRoll.modifier - latestRuleTotal;
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')) return;
      const qte = interactions.find(x => x.mechanic.kind === 'qte');
      if (!qte) return;
      event.preventDefault();
        event.stopImmediatePropagation();
      dispatch({ type: 'resolveInteraction', executionId: qte.id, key: event.code });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, interactions, dispatch]);
  return <div className="interaction-run" aria-label={es ? 'Interacciones activas' : 'Active interactions'}>{interactions.map(x => <section key={x.id} className="interaction-card"><strong>{x.name}</strong>{x.prompt ? <p>{x.prompt.translations?.[locale ?? snapshot.locale] ?? x.prompt.content}</p> : null}{x.participantTraces ? tracesView(x.participantTraces) : null}{x.mechanic.kind === 'qte' ? <p>{es ? 'Pulsa' : 'Press'} {x.mechanic.key} · {Math.max(0, (x.mechanic.durationMs - x.elapsedMs) / 1000).toFixed(1)} s</p> : x.mechanic.kind !== 'custom' ? <button type="button" disabled={disabled} onClick={() => dispatch({ type: 'resolveInteraction', executionId: x.id })}>{x.mechanic.kind === 'opposedcheck' ? es ? 'Tirar por los personajes' : 'Roll for characters' : es ? 'Resolver' : 'Resolve'}</button> : <div><p>{es ? 'Selecciona un resultado manual' : 'Select a manual result'}</p>{x.results.map(r => <button type="button" key={r.id} disabled={disabled} onClick={() => dispatch({ type: 'resolveInteraction', executionId: x.id, resultId: r.id, manual: true })}>{r.name}</button>)}</div>}<details><summary>{es ? 'Forzar resultado' : 'Force result'}</summary>{x.results.map(r => <button type="button" key={r.id} disabled={disabled} onClick={() => dispatch({ type: 'resolveInteraction', executionId: x.id, resultId: r.id })}>{r.name}</button>)}</details></section>)}
    {latestRoll ? <section className="interaction-card interaction-roll-breakdown"><strong>{es ? 'Última tirada' : 'Latest roll'}</strong><p className="interaction-general-result">{latestRoll.resultName ?? (es ? 'Resultado' : 'Result')} · {latestRoll.total}</p><span>{latestRoll.dice ? diceFormula(latestRoll.dice) : es ? 'Sin dado' : 'No dice'}{latestRoll.rolls?.length ? ` (${latestRoll.rolls.join(' + ')})` : ''}{latestRoll.skillSource ? ` + ${latestRoll.skillLabel ?? (latestRoll.skillSource.kind === 'property' ? latestRoll.skillSource.propertyId : latestRoll.skillSource.variableId)} (${latestRoll.skillValue ?? 0})` : ''}</span>{latestFixedModifier ? <small>{es ? 'Modificador fijo' : 'Fixed modifier'}: {latestFixedModifier > 0 ? '+' : '−'}{Math.abs(latestFixedModifier)}</small> : null}{latestRoll.modifierBreakdown?.map(item => <small key={item.ruleId}>{item.modifier > 0 ? '+' : '−'}{Math.abs(item.modifier)} · {item.name}</small>)}{latestRoll.modifier !== undefined && latestRoll.modifierBreakdown?.length ? <small>{es ? 'Modificador total' : 'Total modifier'}: {latestRoll.modifier}</small> : null}</section> : null}
    {latestContest?.participantTraces ? <section className="interaction-card"><strong>{es ? 'Último enfrentamiento' : 'Latest contest'}</strong><p className="interaction-general-result"><strong>{es ? 'Resultado general' : 'Overall result'}:</strong> {latestContest.resultName ?? (latestContest.resultKey === 'success' ? es ? 'Victoria' : 'Victory' : latestContest.resultKey === 'failure' ? es ? 'Derrota' : 'Defeat' : es ? 'Empate' : 'Tie')}</p>{tracesView(latestContest.participantTraces, true)}</section> : null}</div>;
}
