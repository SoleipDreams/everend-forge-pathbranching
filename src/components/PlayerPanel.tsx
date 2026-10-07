import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { AuthoringScenario, BranchingProject, LogicSubject, PlayerSimulationState } from "../domain.js";
import { authoringCommand, authoringRevision, createAuthoringSession, type AuthoringCommand, type AuthoringSession } from "../authoringEngine.js";
import { entityDefinition, initialAuthoringState, instanceOwnerIssue, resolveContextSubject } from "../authoringEntities.js";
import { evaluateConditionDetailed } from "../conditionEvaluation.js";
import { conditionDiagnosticMessage, conditionTreeSummary } from "../conditionPresentation.js";
import { authoringNodeOptions as narrativeTargets } from "../authoringMutations.js";
import { useInterfaceLocale } from "../i18n.js";
import { WorkspaceSidePanel } from "./WorkspaceSidePanel.js";
import { EntityOwnerPicker } from "./EntityOwnerPicker.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import { AuthoringValueField } from "./AuthoringValueField.js";
import { InstancePropertyFields } from "./NarrativeEffectEditor.js";
import "../authoringWorkspace.css";

export function PlayerPanel({ project, collapsed, onCollapsedChange, onContextMenu, onUpdate, selectedNodeId, requestedScenario, onPosition, onLocate }: {
  project: BranchingProject; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void; onUpdate: (project: BranchingProject) => void;
  selectedNodeId?: string; onPosition?: (nodeId: string | undefined, visited: string[]) => void; onLocate?: (nodeId: string) => void;
  requestedScenario?: { id: string; revision: number };
}) {
  const es = useInterfaceLocale() === "es";
  const [scenarioId, setScenarioId] = useState(project.authoringScenarios?.[0]?.id ?? "");
  const [session, setSession] = useState<AuthoringSession>();
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [stateError, setStateError] = useState("");
  const scenarioDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!requestedScenario) return;
    setSession(undefined);
    setScenarioId(requestedScenario.id);
    if (scenarioDetails.current) { scenarioDetails.current.open = true; scenarioDetails.current.querySelector<HTMLElement>("summary")?.focus(); }
  }, [requestedScenario]);
  const scenario = project.authoringScenarios?.find(s => s.id === scenarioId);
  const changed = Boolean(session && session.revision !== authoringRevision(project));
  const start = (selected = false) => { const next = createAuthoringSession(project, scenario, selected ? selectedNodeId : undefined); setSession(next); setStateError(""); };
  const command = (cmd: AuthoringCommand) => { if (session) setSession(authoringCommand(project, session, cmd)); };
  useEffect(() => { onPosition?.(session?.nodeId, session?.visitedNodeIds ?? []); }, [session?.nodeId, session?.visitedNodeIds]);
  useEffect(() => { setSession(undefined); setScenarioId(requestedScenario?.id ?? project.authoringScenarios?.[0]?.id ?? ""); }, [project.projectId]);
  const entities = [...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)];
  const state = session?.state ?? initialAuthoringState(project, scenario);
  const subjects = [...entities.map(id => ({ value: JSON.stringify({ kind: "entity", entityId: id }), label: entityDefinition(project, id)?.name ?? id })), ...(state.entityInstances ?? []).map(i => ({ value: JSON.stringify({ kind: "instance", instanceId: i.id }), label: `${i.name ?? entityDefinition(project, i.entityId)?.name ?? i.id} · ${es ? "copia" : "copy"}` }))];
  const updateScenario = (patch: Partial<AuthoringScenario>) => {
    if (!scenario) return;
    onUpdate({ ...project, authoringScenarios: project.authoringScenarios?.map(s => s.id === scenario.id ? { ...s, ...patch } : s) });
  };
  const makeScenario = (fromRun = false) => {
    const id = `scenario:${crypto.randomUUID()}`;
    onUpdate({ ...project, authoringScenarios: [...(project.authoringScenarios ?? []), { id, name: `${es ? "Escenario" : "Scenario"} ${(project.authoringScenarios?.length ?? 0) + 1}`, state: structuredClone(fromRun && session ? session.state : initialAuthoringState(project)), actor: scenario?.actor, profileId: scenario?.profileId }] });
    setScenarioId(id);
  };
  const changeState = (patch: Partial<PlayerSimulationState>) => { if (session) command({ type: "setState", state: patch }); };
  const view = session?.view;
  const self = source ? JSON.parse(source) as LogicSubject : state.context?.actor;
  const recipient = target ? JSON.parse(target) as LogicSubject : undefined;
  const resolvedSelf = self ? resolveContextSubject(self, state) : undefined;
  const entityId = resolvedSelf?.kind === "entity" ? resolvedSelf.entityId : resolvedSelf?.kind === "instance" ? state.entityInstances?.find(copy => copy.id === resolvedSelf.instanceId)?.entityId : undefined;
  const sourceEntity = entityId ? entityDefinition(project, entityId) : undefined;
  const actions = view?.actions.filter(option => {
    const definition = project.narrativeActions?.find(action => action.id === option.id);
    if (!definition || definition.enabled === false) return false;
    if (definition.entityId && definition.entityId !== entityId) return false;
    if (definition.typeId && definition.typeId.replace(/^type:/, "") !== sourceEntity?.typeId?.replace(/^type:/, "")) return false;
    return !project.narrativeActions?.some(override => override.entityId === entityId && override.overridesActionId === definition.id);
  }) ?? [];
  const patchScenarioState = (patch: Partial<PlayerSimulationState>) => updateScenario({ state: { ...initialAuthoringState(project, scenario), ...patch } });
  return <WorkspaceSidePanel title={es ? "Probar historia" : "Test story"} side="right" collapsed={collapsed} onCollapsedChange={onCollapsedChange} onContextMenu={onContextMenu}>
    <section className="authoring-player" aria-label={es ? "Recorrido de prueba" : "Story test run"}>
      <label className="field-label">{es ? "Escenario inicial" : "Initial scenario"}<select value={scenarioId} onChange={e => setScenarioId(e.target.value)}><option value="">{es ? "Valores del proyecto" : "Project values"}</option>{(project.authoringScenarios ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="player-controls"><button type="button" onClick={() => start()}>{es ? "Iniciar historia" : "Start story"}</button><button type="button" disabled={!selectedNodeId} onClick={() => start(true)}>{es ? "Desde selección" : "From selection"}</button><button type="button" disabled={!session} onClick={() => start()}>{es ? "Reiniciar" : "Restart"}</button><button type="button" disabled={!session?.history.length || changed} onClick={() => command({ type: "back" })}>{es ? "Paso anterior" : "Previous step"}</button></div>
      {changed ? <p role="status" className="condition-field-error">{es ? "La historia cambió. Reinicia para probar la nueva revisión." : "The story changed. Restart to test the new revision."}</p> : null}
      {session ? <>
        <p role="status">{session.status === "ended" ? es ? "Recorrido terminado" : "Run finished" : session.status === "blocked" ? es ? "Recorrido detenido" : "Run stopped" : es ? "En curso" : "Running"}</p>
        <strong>{view?.title}</strong>
        {session.nodeId ? <button type="button" onClick={() => onLocate?.(session.nodeId!)}>{es ? "Ver posición en el canvas" : "Show position on canvas"}</button> : null}
        {view?.speakerRef ? <p>{entityDefinition(project, view.speakerRef)?.name ?? view.speakerRef}</p> : null}
        {view?.text ? <div className="player-content">{view.text}</div> : null}
        {session.message ? <p role="alert" className="condition-field-error">{session.message}</p> : null}
        <div className="player-responses">{view?.choices.filter(c => !c.hidden).map(c => <div key={c.id}><button className="player-response" type="button" disabled={changed || session.status !== "ready" || c.status !== "satisfied"} onClick={() => command({ type: "choose", outcomeId: c.id })}>{c.status === "satisfied" ? "→ " : "🔒 "}{c.text}{c.status !== "satisfied" ? <small> · {conditionDiagnosticMessage(c.reason ?? (es ? "No cumple sus requisitos" : "Requirements not met"), es ? "es" : "en")}</small> : null}</button>{c.status !== "satisfied" ? <details><summary>{es ? "Ver requisitos" : "View requirements"}</summary><p>{conditionTreeSummary(project, project.events.flatMap(event => event.decisions ?? []).flatMap(decision => decision.outcomes).find(outcome => outcome.id === c.id)?.logic?.when, es ? "es" : "en", 1000).text}</p><EvaluationExplanation result={c.evaluation} es={es} /></details> : null}</div>)}</div>
        {!view?.choices.length && session.status === "ready" ? <button type="button" disabled={changed} onClick={() => command({ type: "continue" })}>{es ? "Continuar" : "Continue"}</button> : null}
        {view?.actions.length ? <fieldset><legend>{es ? "Acciones disponibles" : "Available actions"}</legend><label className="field-label">{es ? "Origen de la acción" : "Action source"}<select value={source} onChange={e => setSource(e.target.value)}><option value="">{es ? "Actor del escenario" : "Scenario actor"}</option>{subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label><label className="field-label">{es ? "Destinatario" : "Recipient"}<select value={target} onChange={e => setTarget(e.target.value)}><option value="">{es ? "Sin destinatario" : "No recipient"}</option>{subjects.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label><div className="player-controls">{actions.map(a => {
          const definition = project.narrativeActions?.find(x => x.id === a.id);
          const evaluation = evaluateConditionDetailed(definition?.when, project, { ...state, context: { ...state.context, self, target: recipient } });
          const needsCopy = definition?.effects?.some(effect => effect.type === "instanceEffect" && effect.instanceId === "@self") && resolvedSelf?.kind !== "instance";
          const reason = needsCopy ? es ? "Elige una copia como origen de la acción." : "Choose a copy as the action source." : a.requiresTarget && !recipient ? es ? "Elige un destinatario." : "Choose a recipient." : evaluation.status !== "satisfied" ? conditionDiagnosticMessage(evaluation.message, es ? "es" : "en") : undefined;
          return <div key={a.id}><button type="button" disabled={changed || session.status !== "ready" || Boolean(reason)} title={reason} onClick={() => command({ type: "action", actionId: a.id, self, target: recipient })}>{a.name}</button>{reason ? <small>{reason}</small> : null}</div>;
        })}</div></fieldset> : null}
        <details><summary>{es ? "Por qué ocurrió" : "Why it happened"}</summary><ol className="player-trace">{session.trace.map((t, i) => <li key={i}><strong>{es ? ({ enter: "Entrada", condition: "Condición", effect: "Consecuencia", route: "Ruta", rule: "Regla", action: "Acción", return: "Regreso", error: "Error" })[t.kind] : t.kind}</strong> · {traceMessage(project, t.message, es)}{t.kind === "rule" ? <small> · {es ? "Prioridad" : "Priority"} {project.narrativeRules?.find(rule => rule.id === t.id)?.priority ?? 0}</small> : null}{t.evaluation ? <EvaluationExplanation result={t.evaluation} es={es} /> : null}{t.before && t.after ? <StateChanges project={project} before={t.before} after={t.after} es={es} /> : null}{t.nodeId ? <button type="button" onClick={() => onLocate?.(t.nodeId!)}>{es ? "Localizar" : "Locate"}</button> : null}</li>)}</ol></details>
        <details><summary>{es ? "Estado temporal e inventarios" : "Temporary state and inventories"}</summary>
          {(project.logicVariables ?? []).map(variable => <AuthoringValueField key={variable.id} project={project} elementId={`run:${scenarioId}:${variable.id}`} field="value" label={variable.name} type={variable.type} value={state.variables?.[variable.id] ?? variable.value} temporary onCommit={value => changeState({ variables: { ...state.variables, [variable.id]: value } })} />)}
          {(state.entityInstances ?? []).map(copy => <details key={copy.id}><summary>{copy.name ?? entityDefinition(project, copy.entityId)?.name ?? copy.id}</summary><EntityOwnerPicker project={project} instances={state.entityInstances} value={copy.owner} onChange={owner => { const instances = state.entityInstances!.map(i => i.id === copy.id ? { ...i, owner } : i); const issue = instanceOwnerIssue(project, instances, instances.find(i => i.id === copy.id)!); if (issue) setStateError(issue); else { setStateError(""); changeState({ entityInstances: instances }); } }} /><InstancePropertyFields project={project} temporary instance={copy} onChange={patch => changeState({ entityInstances: state.entityInstances!.map(i => i.id === copy.id ? { ...i, ...patch } : i) })} /></details>)}
          {stateError ? <p role="alert">{conditionDiagnosticMessage(stateError, es ? "es" : "en")}</p> : null}
          <button type="button" onClick={() => makeScenario(true)}>{es ? "Guardar estado como escenario inicial" : "Save state as initial scenario"}</button>
        </details>
      </> : <p>{es ? "Elige un escenario e inicia un recorrido. Las elecciones y consecuencias solo cambian el estado temporal." : "Choose a scenario and start a run. Choices and effects only change temporary state."}</p>}
      <details ref={scenarioDetails}><summary>{es ? "Preparar escenarios" : "Prepare scenarios"}</summary>
        <button type="button" onClick={() => makeScenario()}>{es ? "Crear escenario" : "Create scenario"}</button>
        {scenario ? <>
          <AuthoringTextField projectId={project.projectId} elementId={scenario.id} field="name" label={es ? "Nombre del escenario" : "Scenario name"} value={scenario.name} validate={value => value.trim() ? undefined : es ? "El nombre es obligatorio." : "A name is required."} onCommit={name => updateScenario({ name })} />
          <label className="field-label">{es ? "Actor" : "Actor"}<select value={scenario.actor ? JSON.stringify(scenario.actor) : ""} onChange={event => updateScenario({ actor: event.target.value ? JSON.parse(event.target.value) as LogicSubject : undefined })}><option value="">{es ? "Protagonista del perfil" : "Profile protagonist"}</option>{subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}</select></label>
          <label className="field-label">{es ? "Punto inicial" : "Starting point"}<select value={scenario.startNodeId ?? ""} onChange={event => updateScenario({ startNodeId: event.target.value || undefined })}><option value="">{es ? "Entrada de la historia" : "Story entry"}</option>{narrativeTargets(project).map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
          {(project.logicVariables ?? []).map(variable => <AuthoringValueField key={variable.id} project={project} elementId={scenario.id} field={`variable:${variable.id}`} label={variable.name} type={variable.type} value={scenario.state?.variables?.[variable.id] ?? variable.value} onCommit={value => patchScenarioState({ variables: { ...initialAuthoringState(project, scenario).variables, [variable.id]: value } })} />)}
          <details><summary>{es ? "Copias, pertenencias y estados iniciales" : "Initial copies, ownership and states"}</summary>
            {(initialAuthoringState(project, scenario).entityInstances ?? []).map(copy => <details key={copy.id}><summary>{copy.name ?? entityDefinition(project, copy.entityId)?.name ?? copy.id}</summary>
              <EntityOwnerPicker project={project} instances={initialAuthoringState(project, scenario).entityInstances} value={copy.owner} onChange={owner => {
                const instances = initialAuthoringState(project, scenario).entityInstances!.map(item => item.id === copy.id ? { ...item, owner } : item);
                const issue = instanceOwnerIssue(project, instances, instances.find(item => item.id === copy.id)!);
                if (issue) setStateError(issue); else { setStateError(""); patchScenarioState({ entityInstances: instances }); }
              }} />
              <InstancePropertyFields project={project} instance={copy} onChange={patch => patchScenarioState({ entityInstances: initialAuthoringState(project, scenario).entityInstances!.map(item => item.id === copy.id ? { ...item, ...patch } : item) })} />
              <button type="button" onClick={() => patchScenarioState({ entityInstances: initialAuthoringState(project, scenario).entityInstances?.filter(item => item.id !== copy.id) })}>{es ? "Retirar del escenario" : "Remove from scenario"}</button>
            </details>)}
            <label className="field-label">{es ? "Preparar una copia" : "Prepare a copy"}<select value="" onChange={event => { if (event.target.value) patchScenarioState({ entityInstances: [...(initialAuthoringState(project, scenario).entityInstances ?? []), { id: `instance:${crypto.randomUUID()}`, entityId: event.target.value, properties: {}, states: {} }] }); }}><option value="">{es ? "Elegir entidad" : "Choose entity"}</option>{entities.map(id => <option key={id} value={id}>{entityDefinition(project, id)?.name ?? id}</option>)}</select></label>
          </details>
          {stateError ? <p role="alert" className="condition-field-error">{conditionDiagnosticMessage(stateError, es ? "es" : "en")}</p> : null}
          <button type="button" className="danger" onClick={() => { onUpdate({ ...project, authoringScenarios: project.authoringScenarios?.filter(item => item.id !== scenario.id) }); setScenarioId(""); }}>{es ? "Eliminar escenario" : "Remove scenario"}</button>
        </> : null}
      </details>
    </section>
  </WorkspaceSidePanel>;
}
function EvaluationExplanation({ result, es }: { result: ReturnType<typeof evaluateConditionDetailed>; es: boolean }) {
  const labels = es ? { satisfied: "✓ Cumple", unsatisfied: "✗ No cumple", unresolved: "? Sin resolver", invalid: "! Inválido" } : { satisfied: "✓ Satisfied", unsatisfied: "✗ Not satisfied", unresolved: "? Unresolved", invalid: "! Invalid" };
  return <ul><li>{labels[result.status]} · {conditionDiagnosticMessage(result.message, es ? "es" : "en")}{result.actual !== undefined ? <span> · {JSON.stringify(result.actual)}</span> : null}{result.children?.map((child, index) => <EvaluationExplanation key={index} result={child} es={es} />)}</li></ul>;
}

function traceMessage(project: BranchingProject, message: string, es: boolean) {
  if (es && message === "Returned to the interrupted content") return "Regreso al contenido interrumpido";
  if (es && /^\d+ effects applied$/.test(message)) return message.replace("effects applied", "consecuencias aplicadas");
  const route = message.split(" → ");
  if (route.length === 2) { const targets = narrativeTargets(project); return route.map(id => targets.find(target => target.id === id)?.label ?? id).join(" → "); }
  return conditionDiagnosticMessage(message, es ? "es" : "en");
}

function StateChanges({ project, before, after, es }: { project: BranchingProject; before: PlayerSimulationState; after: PlayerSimulationState; es: boolean }) {
  const changes: string[] = [];
  for (const variable of project.logicVariables ?? []) if (before.variables?.[variable.id] !== after.variables?.[variable.id]) changes.push(`${variable.name}: ${JSON.stringify(before.variables?.[variable.id])} → ${JSON.stringify(after.variables?.[variable.id])}`);
  const ownerName = (owner: NonNullable<PlayerSimulationState["entityInstances"]>[number]["owner"]): string => !owner ? es ? "Sin poseedor" : "No owner" : owner.kind === "entity" ? entityDefinition(project, owner.entityId)?.name ?? owner.entityId : owner.kind === "instance" ? after.entityInstances?.find(copy => copy.id === owner.instanceId)?.name ?? owner.instanceId : owner.kind === "profile" ? project.playerProfiles?.find(profile => profile.id === owner.profileId)?.name ?? owner.profileId : owner.role;
  for (const copy of after.entityInstances ?? []) {
    const old = before.entityInstances?.find(item => item.id === copy.id);
    if (JSON.stringify(old) === JSON.stringify(copy)) continue;
    const name = copy.name ?? entityDefinition(project, copy.entityId)?.name ?? copy.id;
    changes.push(`${name}: ${old ? ownerName(old.owner) : es ? "Creada" : "Created"} → ${ownerName(copy.owner)}`);
    if (old) for (const key of new Set([...Object.keys(old.properties ?? {}), ...Object.keys(copy.properties ?? {}), ...Object.keys(old.states ?? {}), ...Object.keys(copy.states ?? {})])) {
      const a = old.properties?.[key] ?? old.states?.[key]; const b = copy.properties?.[key] ?? copy.states?.[key];
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push(`${name} · ${key}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  }
  for (const copy of before.entityInstances ?? []) if (!after.entityInstances?.some(item => item.id === copy.id)) changes.push(`${copy.name ?? copy.id}: ${es ? "Retirada" : "Removed"}`);
  return changes.length ? <ul>{changes.map((change, index) => <li key={index}>{change}</li>)}</ul> : null;
}
