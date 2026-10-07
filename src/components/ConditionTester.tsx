import { useState } from 'react';
import type { BranchingProject, ConditionInput, LogicPredicate } from '../domain.js';
import { evaluateConditionDetailed, effectiveConditions, externalConditionKey, type ConditionEvaluationResult } from '../conditionEvaluation.js';
import { orderedTransitions, resolveFirstValidTransition, walkConditions, type NarrativeEvaluationState } from '../logic.js';
import { grantableEntities } from '../explorerSchema.js';

function initialState(project: BranchingProject): NarrativeEvaluationState {
  return { variables: {...project.variables, ...Object.fromEntries((project.logicVariables ?? []).map(v => [v.id,v.value]))}, inventory:[], visited:[], entityStates:{}, externalResults:{} };
}
const labels = {satisfied:'Cumple',unsatisfied:'No cumple',unresolved:'Sin resolver',invalid:'Inválido'};
function ResultTree({result}:{result:ConditionEvaluationResult}) {
  return <li className={`condition-result ${result.status}`}><strong>{labels[result.status]}</strong> · {result.message}
    {result.actual !== undefined ? <code> {JSON.stringify(result.actual)}</code> : null}
    {result.children?.length ? <ul>{result.children.map(child=><ResultTree key={child.path} result={child} />)}</ul> : null}
  </li>;
}
export function ConditionTester({project,conditions}:{project:BranchingProject;conditions?:ConditionInput}) {
  const [state,setState] = useState<NarrativeEvaluationState>(()=>initialState(project));
  const [advanced,setAdvanced] = useState('{}');
  const [advancedError,setAdvancedError] = useState('');
  const [source,setSource] = useState('');
  const groups = new Map<string, NonNullable<BranchingProject['events'][number]['transitions']>>();
  for (const event of project.events) for (const route of event.transitions ?? []) groups.set(route.from,[...(groups.get(route.from) ?? []),route]);
  const routes = groups.get(source) ?? [];
  const selected = resolveFirstValidTransition(routes,project,state);
  const external = new Map<string,Extract<LogicPredicate,{type:'external'}>>();
  for (const input of [conditions,...routes.map(effectiveConditions)]) walkConditions(input,p=>{if ('subject' in p && p.type==='external') external.set(externalConditionKey(p as Extract<LogicPredicate,{type:'external'}>),p as Extract<LogicPredicate,{type:'external'}>);});
  const toggle = (field:'inventory'|'visited',id:string,checked:boolean) => setState(current=>({...current,[field]:checked?[...new Set([...(current[field] ?? []),id])]:[...(current[field] ?? [])].filter(x=>x!==id)}));
  return <details className="condition-tester"><summary>Probar condiciones</summary>
    <p>Estado temporal. No se guarda en la historia ni se exporta.</p>
    {(project.logicVariables ?? []).map(variable=><label key={variable.id}>{variable.name}
      {variable.type === 'boolean' ? <select aria-label={`Test ${variable.name}`} value={String(state.variables?.[variable.id])} onChange={e=>setState({...state,variables:{...state.variables,[variable.id]:e.target.value==='true'}})}><option>true</option><option>false</option></select> :
      <input aria-label={`Test ${variable.name}`} type={variable.type==='number'?'number':'text'} value={Array.isArray(state.variables?.[variable.id])?(state.variables![variable.id] as string[]).join(', '):String(state.variables?.[variable.id] ?? '')} onChange={e=>setState({...state,variables:{...state.variables,[variable.id]:variable.type==='number'?(e.target.value===''?undefined:Number(e.target.value)):variable.type==='list'?e.target.value.split(',').map(v=>v.trim()).filter(Boolean):e.target.value}})} />}
    </label>)}
    <fieldset><legend>Inventario</legend>{grantableEntities(project).map(entity=><label key={entity.id}><input type="checkbox" checked={new Set(state.inventory ?? []).has(entity.id)} onChange={e=>toggle('inventory',entity.id,e.target.checked)} />{entity.label}</label>)}</fieldset>
    <fieldset><legend>Eventos visitados</legend>{project.events.map(event=><label key={event.id}><input type="checkbox" checked={new Set(state.visited ?? []).has(event.id)} onChange={e=>toggle('visited',event.id,e.target.checked)} />{event.name}</label>)}</fieldset>
    <label>Rutas desde<select aria-label="Test route source" value={source} onChange={e=>setSource(e.target.value)}><option value="">Solo esta condición</option>{[...groups.keys()].map(id=><option key={id} value={id}>{project.events.find(e=>e.id===id)?.name ?? id}</option>)}</select></label>
    {[...external.keys()].map(key=><label key={key}>{key}<select aria-label={`External result ${key}`} value={state.externalResults?.[key]===undefined?'':String(state.externalResults[key])} onChange={e=>{const next={...state.externalResults}; if(e.target.value==='') delete next[key]; else next[key]=e.target.value==='true'; setState({...state,externalResults:next});}}><option value="">Sin resolver</option><option>true</option><option>false</option></select></label>)}
    <details><summary>Estados y propiedades temporales (JSON)</summary><p>Objeto con entityStates, canonStates, dataObjects o unlockedCanonRefs. Las propiedades se toman del documento si no se sobrescriben.</p>
      <textarea aria-label="Temporary condition state JSON" value={advanced} onChange={e=>{setAdvanced(e.target.value);try{const parsed:unknown=JSON.parse(e.target.value);if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) throw Error('Debe ser un objeto JSON');const allowed=['entityStates','canonStates','dataObjects','unlockedCanonRefs'];if(Object.keys(parsed).some(k=>!allowed.includes(k))) throw Error(`Campos permitidos: ${allowed.join(', ')}`);if ('dataObjects' in parsed && !Array.isArray(parsed.dataObjects)) throw Error('dataObjects debe ser una lista');if ('unlockedCanonRefs' in parsed && (!Array.isArray(parsed.unlockedCanonRefs) || parsed.unlockedCanonRefs.some((x:unknown)=>typeof x!=='string'))) throw Error('unlockedCanonRefs debe ser una lista de IDs');for (const key of ['entityStates','canonStates']) {const value=(parsed as Record<string,unknown>)[key];if(value!==undefined && (!value || typeof value!=='object' || Array.isArray(value))) throw Error(`${key} debe ser un objeto`);}setState(current=>{const {entityStates,canonStates,dataObjects,unlockedCanonRefs,...base}=current;return {...base,...parsed} as NarrativeEvaluationState;});setAdvancedError('');}catch(error){setAdvancedError(String(error));}}} />
    </details>
    {advancedError ? <p role="alert">{advancedError}</p> : <><ul aria-live="polite"><ResultTree result={evaluateConditionDetailed(conditions,project,state)} /></ul>
      {source ? <><p role="status">Ruta: {selected ? `${selected.id} → ${selected.to}` : 'Ninguna ruta resuelta'}</p><ul>{orderedTransitions(routes).map(route=><li key={route.id}>{route.mode==='fallback'?'Else':route.id}<ul><ResultTree result={evaluateConditionDetailed(effectiveConditions(route),project,state)} /></ul></li>)}</ul></> : null}</>}
    <button type="button" onClick={()=>{setState(initialState(project));setAdvanced('{}');setAdvancedError('');}}>Restablecer prueba</button>
  </details>;
}
