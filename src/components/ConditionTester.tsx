import { useId, useState } from 'react';
import { CircleAlert, Check, Minus, Pause, SkipForward } from 'lucide-react';
import type { BranchingProject, ConditionInput, LogicPredicate } from '../domain.js';
import { conditionValueMatchesType, effectiveConditions, evaluateConditionDetailed, externalConditionKey, resolveConditionValue, type ConditionEvaluationResult } from '../conditionEvaluation.js';
import { isConditionSet, type NarrativeEvaluationState } from '../logic.js';
import { grantableEntities } from '../explorerSchema.js';
import { conditionDiagnosticMessage, conditionExpressionAtPath, conditionPredicateLabel, conditionRouteResolution, conditionTestControls, conditionUiCopy, narrativeTargetLabel, type ConditionTestControl, type ConditionUiLocale } from '../conditionPresentation.js';
import { useInterfaceLocale } from '../i18n.js';
import '../conditionUx.css';

function initialState(project: BranchingProject): NarrativeEvaluationState {
  return {variables: {...project.variables, ...Object.fromEntries((project.logicVariables ?? []).map(v => [v.id, v.value]))}, inventory: [], visited: [], entityStates: {}, externalResults: {}};
}

function ResultTree({result, project, input, locale}: {result: ConditionEvaluationResult; project: BranchingProject; input?: ConditionInput; locale: ConditionUiLocale}) {
  const c = conditionUiCopy(locale);
  const expression = conditionExpressionAtPath(project, input, result.path);
  const predicate = expression && !isConditionSet(expression) ? expression as LogicPredicate : undefined;
  const Icon = result.status === 'satisfied' ? Check : result.status === 'unsatisfied' ? Minus : result.status === 'unresolved' ? Pause : CircleAlert;
  return <li className={`condition-result ${result.status}`}>
    <strong><Icon size={13} aria-hidden="true"/> {c[result.status]}</strong>
    <span className="condition-result-label">{predicate ? conditionPredicateLabel(project, predicate, locale) : ['ALL', 'ANY', 'NOT'].includes(result.message) ? result.message === 'ALL' ? 'AND' : result.message === 'ANY' ? 'OR' : 'NOT' : result.message === 'Always' ? c.always : conditionDiagnosticMessage(result.message, locale)}</span>
    {predicate && ['invalid', 'unresolved'].includes(result.status) ? <span className="condition-field-error">{conditionDiagnosticMessage(result.message, locale)}</span> : null}
    {predicate && result.actual !== undefined ? <span className="condition-result-value">{c.actual}: <code>{JSON.stringify(result.actual)}</code></span> : null}
    {result.children?.length ? <ul className="condition-result-list">{result.children.map(child => <ResultTree key={child.path} result={child} project={project} input={input} locale={locale}/>)}</ul> : null}
  </li>;
}

function updateControlState(state: NarrativeEvaluationState, control: ConditionTestControl, value: unknown, project: BranchingProject): NarrativeEvaluationState {
  const predicate = control.predicate, s = predicate.subject;
  if (predicate.type === 'external') {
    const next = {...state.externalResults}, key = externalConditionKey(predicate);
    if (value === undefined) delete next[key]; else next[key] = Boolean(value);
    return {...state, externalResults: next};
  }
  if (s.kind === 'variable') return {...state, variables: {...state.variables, [s.variableId]: value}};
  if (s.kind === 'progress') {
    const visited = new Set(state.visited ?? []);
    visited.delete(s.targetId); visited.delete(`${s.targetType}:${s.targetId}`);
    if (value) visited.add(`${s.targetType}:${s.targetId}`);
    return {...state, visited: [...visited]};
  }
  if (s.kind === 'entity') {
    const old = state.entityStates?.[s.entityId];
    const part = predicate.type === 'state' ? 'states' : 'properties';
    const key = predicate.type === 'state' ? predicate.stateId : predicate.type === 'property' ? predicate.propertyId : '';
    return {...state, entityStates: {...state.entityStates, [s.entityId]: {...old, [part]: {...old?.[part], [key]: value}}}};
  }
  if (s.kind === 'dataObject') {
    const objects = [...(state.dataObjects ?? project.projectDataObjects ?? [])];
    const base = project.projectDataObjects?.find(object => object.id === s.objectId);
    if (predicate.type === 'state') return {...state, dataObjects: value ? objects.some(object => object.id === s.objectId) || !base ? objects : [...objects, {...base, fields: {...base.fields}}] : objects.filter(object => object.id !== s.objectId)};
    if (!base || predicate.type !== 'property') return state;
    const current = objects.find(object => object.id === s.objectId) ?? base;
    const changed = {...current, fields: {...current.fields, [predicate.propertyId]: value}};
    return {...state, dataObjects: [...objects.filter(object => object.id !== s.objectId), changed]};
  }
  return state;
}

function TestValueControl({control, project, state, onChange, locale}: {control: ConditionTestControl; project: BranchingProject; state: NarrativeEvaluationState; onChange: (value: unknown) => void; locale: ConditionUiLocale}) {
  const id = useId();
  const c = conditionUiCopy(locale);
  const resolved = resolveConditionValue(control.predicate, project, state);
  const value = resolved.value;
  const external = control.predicate.type === 'external';
  const boolean = ['state', 'visited', 'external'].includes(control.predicate.type) || ['boolean', 'bool'].includes(control.valueType ?? '');
  const list = ['list', 'multiselect', 'entity-ref-list'].includes(control.valueType ?? '');
  const number = ['number', 'integer', 'float'].includes(control.valueType ?? '');
  const canBeUndefined = !['state', 'visited', 'external'].includes(control.predicate.type);
  const defined = value !== undefined && value !== null;
  const error = resolved.error ?? (value !== undefined && value !== null && !conditionValueMatchesType(value, control.valueType) ? `${c.needsValue} ${control.valueType ?? "text/number/boolean/list"}.` : undefined);
  const descriptionId = error ? `${id}-error` : list ? `${id}-hint` : undefined;
  const defaultValue = boolean ? false : list ? [] : number ? 0 : '';
  return <div className="condition-test-control">
    <strong id={`${id}-label`}>{control.label}</strong>
    <div className="condition-test-input">
      {boolean ? <select id={id} aria-labelledby={`${id}-label`} aria-describedby={descriptionId} disabled={Boolean(resolved.error)} aria-invalid={Boolean(error)} value={defined ? String(value) : ''} onChange={event => onChange(event.target.value === '' ? undefined : event.target.value === 'true')}>
        {!defined || external ? <option value="">{external ? c.unresolved : c.isUndefined}</option> : null}{defined && typeof value !== 'boolean' ? <option value={String(value)}>{String(value)} · {c.invalid}</option> : null}<option value="true">{c.yes}</option><option value="false">{c.no}</option>
      </select> : list ? <div className="condition-list-input" role="group" aria-labelledby={`${id}-label`}>
        {(Array.isArray(value) ? value : []).map((item, index) => <div key={index}><input aria-label={`${control.label} · ${index + 1}`} disabled={Boolean(resolved.error)} value={String(item)} onChange={event => onChange((value as unknown[]).map((old, i) => i === index ? event.target.value : old))}/><button type="button" aria-label={`${c.removeItem} · ${index + 1}`} disabled={Boolean(resolved.error)} onClick={() => onChange((value as unknown[]).filter((_, i) => i !== index))}>×</button></div>)}
        <button type="button" disabled={Boolean(resolved.error)} onClick={() => onChange([...(Array.isArray(value) ? value : []), ''])}>{c.addItem}</button>
      </div> : <input id={id} aria-labelledby={`${id}-label`} aria-describedby={descriptionId} aria-invalid={Boolean(error)} disabled={Boolean(resolved.error)} type={number ? 'number' : control.valueType === 'date' ? 'date' : 'text'} value={String(value ?? '')} onChange={event => onChange(number ? event.target.value === '' ? undefined : Number(event.target.value) : event.target.value)}/>}
    </div>
    {canBeUndefined ? <label className="condition-defined-toggle"><input type="checkbox" disabled={Boolean(resolved.error)} checked={defined} onChange={event => onChange(event.target.checked ? defaultValue : undefined)}/>{c.defined}</label> : null}
    {list ? <span className="condition-result-value" id={`${id}-hint`}>{c.itemHint}</span> : null}
    {error ? <span className="condition-field-error" id={`${id}-error`}>{conditionDiagnosticMessage(error, locale)}</span> : null}
  </div>;
}

function parseAdvancedState(text: string): Pick<NarrativeEvaluationState, 'entityStates' | 'canonStates' | 'dataObjects' | 'unlockedCanonRefs'> {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Expected a JSON object.');
  const allowed = ['entityStates', 'canonStates', 'dataObjects', 'unlockedCanonRefs'];
  if (Object.keys(parsed).some(key => !allowed.includes(key))) throw Error(`Allowed fields: ${allowed.join(', ')}.`);
  const object = parsed as Record<string, unknown>;
  if (object.unlockedCanonRefs !== undefined && (!Array.isArray(object.unlockedCanonRefs) || object.unlockedCanonRefs.some(value => typeof value !== 'string'))) throw Error('unlockedCanonRefs must be a list of IDs.');
  for (const key of ['entityStates', 'canonStates']) {
    const value = object[key];
    if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(item => !item || typeof item !== 'object' || Array.isArray(item)))) throw Error(`${key} must contain objects keyed by entity ID.`);
  }
  if (object.entityStates) for (const entity of Object.values(object.entityStates as Record<string, Record<string, unknown>>)) {
    for (const part of ['states', 'properties']) if (entity[part] !== undefined && (!entity[part] || typeof entity[part] !== 'object' || Array.isArray(entity[part]))) throw Error(`entityStates.${part} must be an object.`);
    if (entity.states && Object.values(entity.states as Record<string, unknown>).some(value => typeof value !== 'boolean')) throw Error('State values must be boolean.');
  }
  if (object.dataObjects !== undefined && (!Array.isArray(object.dataObjects) || object.dataObjects.some(item => !item || typeof item !== 'object' || typeof item.id !== 'string' || !item.fields || typeof item.fields !== 'object' || Array.isArray(item.fields)))) throw Error('dataObjects must contain objects with an ID and fields object.');
  return parsed as ReturnType<typeof parseAdvancedState>;
}

export function ConditionTester({project, conditions, locale: localeOverride}: {project: BranchingProject; conditions?: ConditionInput; locale?: ConditionUiLocale}) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const c = conditionUiCopy(locale);
  const [state, setState] = useState<NarrativeEvaluationState>(() => initialState(project));
  const [advanced, setAdvanced] = useState('{}');
  const [advancedError, setAdvancedError] = useState('');
  const [source, setSource] = useState('');
  const advancedId = useId();
  const groups = new Map<string, NonNullable<BranchingProject['events'][number]['transitions']>>();
  for (const event of project.events) for (const route of event.transitions ?? []) groups.set(route.from, [...(groups.get(route.from) ?? []), route]);
  const routes = groups.get(source) ?? [];
  const resolution = conditionRouteResolution(project, routes, state);
  const used = conditionTestControls(project, [conditions, ...routes.map(effectiveConditions)], locale);
  const allInputs: LogicPredicate[] = [
    ...(project.logicVariables ?? []).map(variable => ({type: 'value' as const, subject: {kind: 'variable' as const, variableId: variable.id}, operator: 'exists' as const})),
    ...grantableEntities(project).map(entity => ({type: 'state' as const, subject: {kind: 'entity' as const, entityId: entity.id}, stateId: 'owned', operator: 'has' as const})),
    ...project.events.map(event => ({type: 'visited' as const, subject: {kind: 'progress' as const, targetType: 'event' as const, targetId: event.id}, operator: 'has' as const})),
  ];
  const remaining = conditionTestControls(project, allInputs, locale).filter(control => !used.some(item => item.key === control.key));
  const renderControl = (control: ConditionTestControl) => <TestValueControl key={control.key} control={control} project={project} state={state} locale={locale} onChange={value => setState(current => updateControlState(current, control, value, project))}/>;
  const selected = resolution.selected, blocked = resolution.blocked;
  const currentResult = evaluateConditionDetailed(conditions, project, state);
  const routeTitle = (route: typeof routes[number]) => `${route.mode === 'fallback' ? c.else : route.label?.trim() || c.route} → ${narrativeTargetLabel(project, route.to)}`;
  return <details className="condition-tester condition-ux"><summary>{c.tester}</summary>
    <p>{c.temporary}</p>
    <label className="condition-field"><span>{c.routeSource}</span><select value={source} onChange={event => setSource(event.target.value)}><option value="">{c.thisCondition}</option>{[...groups.keys()].map(id => <option key={id} value={id}>{narrativeTargetLabel(project, id)}</option>)}</select></label>
    <h4>{c.usedValues}</h4>
    {used.length ? <div className="condition-test-controls">{used.map(renderControl)}</div> : <p className="condition-empty">{c.noUsedValues}</p>}
    <details className="condition-test-advanced"><summary>{c.advanced}</summary>
      <div className="condition-test-controls">{remaining.map(renderControl)}</div>
      <details onToggle={event => {if (event.currentTarget.open) setAdvanced(JSON.stringify({entityStates: state.entityStates ?? {}, canonStates: state.canonStates ?? {}, ...(state.dataObjects ? {dataObjects: state.dataObjects} : {}), unlockedCanonRefs: [...(state.unlockedCanonRefs ?? [])]}, null, 2));}}>
        <summary>{c.json}</summary><p id={`${advancedId}-hint`}>{c.jsonHint}</p>
        <textarea aria-label={c.json} aria-describedby={`${advancedId}-hint${advancedError ? ` ${advancedId}-error` : ''}`} aria-invalid={Boolean(advancedError)} value={advanced} onChange={event => {setAdvanced(event.target.value); try {const parsed = parseAdvancedState(event.target.value); setState(current => {const {entityStates, canonStates, dataObjects, unlockedCanonRefs, ...base} = current; return {...base, ...parsed};}); setAdvancedError('');} catch (error) {setAdvancedError(error instanceof Error ? error.message : String(error));}}}/>
        {advancedError ? <p role="alert" className="condition-field-error" id={`${advancedId}-error`}>{conditionDiagnosticMessage(advancedError, locale)}</p> : null}
      </details>
    </details>
    <h4>{c.results}</h4>
    {!advancedError ? <>
      <span className="visually-hidden" role="status">{c.results}: {c[currentResult.status]}</span>
      <ul className="condition-result-list"><ResultTree result={currentResult} project={project} input={conditions} locale={locale}/></ul>
      {source ? <>
        <p className={`condition-route-summary ${blocked || resolution.status === 'duplicateElse' ? 'blocked' : ''}`} role="status">
          {selected ? `${c.selected}: ${routeTitle(selected)}` : blocked ? `${c.blocked}: ${routeTitle(blocked)}` : resolution.status === 'duplicateElse' ? c.duplicateElse : c.noRoute}
        </p>
        <ol className="condition-route-results">{resolution.routes.map(({route, reached, result}, index) => <li key={route.id} className={route.id === selected?.id ? 'selected' : route.id === blocked?.id ? 'blocked' : !reached ? 'skipped' : ''}>
          <strong>{index + 1}. {routeTitle(route)}</strong><small className="condition-route-id">{route.id}</small>
          {reached && result ? <ul className="condition-result-list"><ResultTree result={result} project={project} input={effectiveConditions(route)} locale={locale}/></ul> : <p><SkipForward size={13} aria-hidden="true"/> {c.notEvaluated}</p>}
        </li>)}</ol>
      </> : null}
    </> : <p className="condition-empty">{locale === 'es' ? 'Corrige el JSON para actualizar los resultados. Se conserva el último estado válido.' : 'Fix the JSON to update the results. The last valid state is preserved.'}</p>}
    <button type="button" onClick={() => {setState(initialState(project)); setAdvanced('{}'); setAdvancedError('');}}>{c.reset}</button>
  </details>;
}
