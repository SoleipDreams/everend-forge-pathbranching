import type { BranchingProject, ConditionInput, LogicPredicate, LogicSubject } from './domain.js';
import type { NarrativeEvaluationState } from './logic.js';
import { migrateConditionInput } from './logic.js';

export type ConditionProject = Pick<BranchingProject, 'canonRefs' | 'localExplorerEntities'> & Partial<BranchingProject>;
export type ConditionStatus = 'satisfied' | 'unsatisfied' | 'unresolved' | 'invalid';
export type ConditionEvaluationResult = {
  status: ConditionStatus; path: string; message: string; actual?: unknown;
  children?: ConditionEvaluationResult[];
};
export type ConditionOwner = { logic?: { when?: ConditionInput }; availability?: ConditionInput; conditions?: ConditionInput; displayCondition?: ConditionInput };
export function effectiveConditions(owner: ConditionOwner): ConditionInput | undefined {
  return owner.logic?.when ?? owner.availability ?? owner.conditions ?? owner.displayCondition;
}
export function combineConditions(...inputs: (ConditionInput | undefined)[]): ConditionInput | undefined {
  const parts = inputs.flatMap(input => input === undefined ? [] : Array.isArray(input) ? input : [input]);
  return parts.length > 1 ? { all: parts } : parts[0];
}
const own = (object: object | undefined, key: string) => object !== undefined && Object.prototype.hasOwnProperty.call(object, key);
const absent = (value: unknown) => value === undefined || value === null;
export function isValidConditionDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function conditionValueMatchesType(value: unknown, type: string | undefined): boolean {
  if (type === 'number' || type === 'integer' || type === 'float') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean' || type === 'bool') return typeof value === 'boolean';
  if (type === 'date') return isValidConditionDate(value);
  if (['list','multiselect','entity-ref-list'].includes(type ?? '')) return Array.isArray(value) && value.every(item => typeof item === 'string');
  if (['text','string','select','canonRef','entity-ref','entity-type'].includes(type ?? '')) return typeof value === 'string';
  return typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) || Array.isArray(value) && value.every(item => typeof item === 'string');
}
export function conditionValueType(predicate: LogicPredicate, project: ConditionProject): string | undefined {
  const s = predicate.subject;
  if (predicate.type === 'state' || predicate.type === 'visited' || predicate.type === 'external') return 'boolean';
  if (s.kind === 'variable') return project.logicVariables?.find(v => v.id === s.variableId)?.type;
  if (s.kind === 'dataObject' && predicate.type === 'property') {
    const object = project.projectDataObjects?.find(o => o.id === s.objectId);
    return project.dataClasses?.find(c => c.id === object?.classId)?.fields.find(f => f.name === predicate.propertyId)?.type;
  }
  if (predicate.type === 'property') return project.localExplorerProperties?.find(p => p.id === predicate.propertyId || p.id === `property:${predicate.propertyId}`)?.valueType;
  return undefined;
}
type Resolved = { value?: unknown; error?: string; unresolved?: string };
export function resolveConditionValue(predicate: LogicPredicate, project: ConditionProject, state: NarrativeEvaluationState): Resolved {
  const s = predicate.subject;
  if (!s || typeof s !== 'object') return { error: 'Missing condition subject' };
  if (predicate.type === 'external') {
    if (s.kind !== 'external' || !project.externalFunctions?.some(f => f.name === s.functionId && ['condition','transition'].includes(f.kind))) return { error: 'Missing or incompatible external function' };
    const key = externalConditionKey(predicate);
    return own(state.externalResults, key) ? { value: state.externalResults![key] } : { unresolved: `Supply a result for ${key}` };
  }
  if (s.kind === 'variable') {
    const variable = project.logicVariables?.find(v => v.id === s.variableId);
    if (own(state.variables, s.variableId)) return { value: state.variables![s.variableId] };
    if (variable) return { value: variable.value };
    if (own(project.variables, s.variableId)) return { value: project.variables![s.variableId] };
    return { error: `Missing variable ${s.variableId}` };
  }
  if (s.kind === 'progress') {
    const collections = { event: project.events, sequence: project.sequences, branch: project.branches,
      decision: project.events?.flatMap(e => e.decisions ?? []), outcome: project.events?.flatMap(e => (e.decisions ?? []).flatMap(d => d.outcomes)) };
    const targets = collections[s.targetType];
    if (!targets) return {error:'Unsupported progress target type'};
    if (targets && !targets.some(t => t.id === s.targetId)) return { error: `Missing ${s.targetType} ${s.targetId}` };
    const visited = new Set(state.visited ?? []);
    return { value: visited.has(`${s.targetType}:${s.targetId}`) || visited.has(s.targetId) };
  }
  if (s.kind === 'dataObject') {
    const object = (state.dataObjects ?? project.projectDataObjects)?.find(o => o.id === s.objectId);
    if (!object && !project.projectDataObjects?.some(o => o.id === s.objectId)) return { error: `Missing data object ${s.objectId}` };
    if (predicate.type === 'state') return predicate.stateId === 'exists' ? { value: Boolean(object) } : { error: 'Unsupported object state' };
    if (predicate.type !== 'property') return { error: 'Expected an object property' };
    const base = project.projectDataObjects?.find(o => o.id === s.objectId);
    return { value: own(object?.fields, predicate.propertyId) ? object?.fields[predicate.propertyId] : base?.fields[predicate.propertyId] };
  }
  if (s.kind !== 'entity') return { error: 'Incompatible subject' };
  const canon = project.canonRefs.find(e => e.id === s.entityId);
  const local = project.localExplorerEntities?.find(e => e.id === s.entityId);
  if (!canon && !local) return { error: `Missing entity ${s.entityId}` };
  if (predicate.type === 'state') {
    const key = predicate.stateId, overlay = state.entityStates?.[s.entityId]?.states;
    if (own(overlay, key)) return { value: overlay![key] };
    if (own(state.canonStates?.[s.entityId], key)) return { value: state.canonStates![s.entityId][key] };
    if (key === 'owned') return { value: new Set(state.inventory ?? []).has(s.entityId) };
    if (key === 'unlocked') return { value: new Set(state.unlockedCanonRefs ?? []).has(s.entityId) };
    if (['discovered','present'].includes(key)) return { value: false };
    return { unresolved: `Supply state ${s.entityId}.${key}` };
  }
  if (predicate.type !== 'property') return { error: 'Expected an entity property' };
  const key = predicate.propertyId, overlay = state.entityStates?.[s.entityId]?.properties;
  if (own(overlay, key)) return { value: overlay![key] };
  if (own(canon?.properties, key)) return { value: canon!.properties![key] };
  if (own(canon?.frontmatter, key)) return { value: canon!.frontmatter![key] };
  if (own(local?.properties, key)) return { value: local!.properties![key] };
  // Older local documents used fields; current Explorer documents use properties.
  const fields = (local as unknown as { fields?: Record<string, unknown> } | undefined)?.fields;
  return { value: fields?.[key] };
}
export function externalConditionKey(predicate: Extract<LogicPredicate, {type:'external'}>): string {
  return `${predicate.subject.functionId}:${JSON.stringify(predicate.arguments ?? [])}`;
}
function evaluatePredicate(predicate: LogicPredicate, project: ConditionProject, state: NarrativeEvaluationState, path: string): ConditionEvaluationResult {
  const fail = (status: ConditionStatus, message: string): ConditionEvaluationResult => ({status, path, message});
  if (!predicate || typeof predicate !== 'object' || !['state','value','property','visited','external'].includes(predicate.type)) return fail('invalid', 'Unsupported predicate');
  const subject = predicate.subject;
  if (!subject || typeof subject !== 'object') return fail('invalid','Missing condition subject');
  if (predicate.type==='value' && subject.kind!=='variable' || predicate.type==='property' && !['entity','dataObject'].includes(subject.kind) || predicate.type==='visited' && subject.kind!=='progress' || predicate.type==='state' && !['entity','dataObject'].includes(subject.kind)) return fail('invalid','Predicate and subject are incompatible');
  if (predicate.type==='property' && (typeof predicate.propertyId!=='string' || !predicate.propertyId) || predicate.type==='state' && (typeof predicate.stateId!=='string' || !predicate.stateId)) return fail('invalid','Missing property/state ID');
  const resolved = resolveConditionValue(predicate, project, state);
  if (resolved.error) return fail('invalid', resolved.error);
  if (resolved.unresolved) return fail('unresolved', resolved.unresolved);
  const left = resolved.value, op = predicate.operator, right = 'value' in predicate ? predicate.value : true;
  const statePredicate = ['state','visited','external'].includes(predicate.type);
  let matches: boolean;
  if (op === 'exists' || op === 'missing' && !statePredicate) matches = op === 'exists' ? !absent(left) : absent(left);
  else if (statePredicate && ['has','missing'].includes(op)) {
    if (typeof left !== 'boolean') return fail('invalid', 'State value must be boolean');
    matches = op === 'has' ? left : !left;
  } else {
    if (absent(left)) return fail('unresolved', 'Value is not defined');
    const type = conditionValueType(predicate, project);
    if (!conditionValueMatchesType(left, type)) return fail('invalid', `Actual value does not match ${type ?? 'scalar/list type'}`);
    if (['contains','notContains'].includes(op)) {
      if (Array.isArray(left)) {
        if (typeof right !== 'string') return fail('invalid', 'List membership requires a single text item');
        matches = left.includes(right);
      } else if (typeof left === 'string' && typeof right === 'string') matches = left.includes(right);
      else return fail('invalid', 'Contains requires text or list');
      if (op === 'notContains') matches = !matches;
    } else {
      if (!conditionValueMatchesType(right, type) || typeof left !== typeof right || Array.isArray(left) !== Array.isArray(right)) return fail('invalid', 'Comparison operands have incompatible types');
      if (op === '==' || op === '!=') {
        matches = Array.isArray(left) ? JSON.stringify(left) === JSON.stringify(right) : left === right;
        if (op === '!=') matches = !matches;
      } else if (['>','>=','<','<='].includes(op)) {
        if (!(typeof left === 'number' && typeof right === 'number') && !(type === 'date' && isValidConditionDate(left) && isValidConditionDate(right))) return fail('invalid', 'Ordered comparison requires numbers or ISO dates');
        matches = op === '>' ? left! > right! : op === '>=' ? left! >= right! : op === '<' ? left! < right! : left! <= right!;
      } else return fail('invalid', `Unsupported operator ${op}`);
    }
  }
  return { status: matches ? 'satisfied' : 'unsatisfied', path, message: `${op}: ${matches ? 'matches' : 'does not match'}`, actual: left };
}
export function conditionStructureIssues(input: unknown, path = 'conditions', depth = 0): {path:string; message:string}[] {
  if (input === undefined) return [];
  if (depth > 64) return [{path,message:'Condition nesting exceeds 64 levels'}];
  if (Array.isArray(input)) return input.flatMap((x,i) => conditionStructureIssues(x,`${path}[${i}]`,depth+1));
  if (!input || typeof input !== 'object') return [{path,message:'Condition must be an object'}];
  const value = input as Record<string, unknown>, groups = ['all','any','not'].filter(k=>own(value,k));
  if (groups.length > 1 || groups.length && own(value,'type')) return [{path,message:'Condition must have exactly one expression kind'}];
  if (!groups.length && ['state','value','property','external'].includes(String(value.type)) && (!value.subject || typeof value.subject!=='object' || !('kind' in value.subject))) return [{path,message:'Missing condition subject'}];
  if (!groups.length) return typeof value.type === 'string' && ['state','value','property','visited','external','variable','canonState','canonProperty','canonUnlocked','runtimeItem','dataObjectField','dataObjectExists','externalFunction'].includes(value.type) ? [] : [{path,message:'Unsupported predicate type; original JSON preserved'}];
  const key = groups[0], children = key === 'not' ? [value.not] : value[key];
  if (!Array.isArray(children) || !children.length || children.some(x=>x === undefined)) return [{path,message:'Condition group must not be empty'}];
  return children.flatMap((x,i)=>conditionStructureIssues(x,`${path}.${key}${key === 'not' ? '' : `[${i}]`}`,depth+1));
}
function evaluateTree(input: unknown, project: ConditionProject, state: NarrativeEvaluationState, path: string): ConditionEvaluationResult {
  if (input === undefined || Array.isArray(input) && !input.length) return {status:'satisfied',path,message:'Always'};
  const value = input as Record<string, unknown>;
  const key = Array.isArray(input) ? 'all' : own(value,'all') ? 'all' : own(value,'any') ? 'any' : own(value,'not') ? 'not' : undefined;
  if (!key) return evaluatePredicate(input as LogicPredicate,project,state,path);
  const source = Array.isArray(input) ? input : key === 'not' ? [value.not] : value[key] as unknown[];
  const children = source.map((x,i)=>evaluateTree(x,project,state,`${path}.${key}[${i}]`));
  // Errors are never hidden by another branch or inverted by NOT.
  let status: ConditionStatus = children.some(c=>c.status==='invalid') ? 'invalid' : children.some(c=>c.status==='unresolved') ? 'unresolved' :
    (key === 'any' ? children.some(c=>c.status==='satisfied') : key === 'not' ? children[0].status==='unsatisfied' : children.every(c=>c.status==='satisfied')) ? 'satisfied' : 'unsatisfied';
  return {status,path,message:key.toUpperCase(),children};
}
export function evaluateConditionDetailed(input: ConditionInput | undefined, project: ConditionProject, state: NarrativeEvaluationState = {}): ConditionEvaluationResult {
  const issues = conditionStructureIssues(input);
  if (issues.length) return {status:'invalid',path:'conditions',message:'Invalid condition structure',children:issues.map(i=>({...i,status:'invalid'}))};
  return evaluateTree(migrateConditionInput(input,project.logicVariables ?? []),project,state,'conditions');
}
