import type { BranchingProject, ConditionExpression, ConditionInput, EntityOwner, InstanceQuery, LogicPredicate, Transition } from './domain.js';
import { entityDefinition } from './authoringEntities.js';
import { conditionStructureIssues, conditionValueMatchesType, conditionValueType, effectiveConditions, evaluateConditionDetailed, externalConditionKey, type ConditionEvaluationResult } from './conditionEvaluation.js';
import { asConditionExpressions, isConditionSet, migrateConditionInput, orderedTransitions, type NarrativeEvaluationState } from './logic.js';
import { logicOperatorsFor, logicSubjectKey, logicSubjectOptions, presentConditionInput, resolveLogicField, type LogicPresentation } from './logicCapabilities.js';

export type ConditionUiLocale = 'en' | 'es';

const copy = {
  en: {
    subject: 'Subject', field: 'Property or state', operator: 'Comparison', value: 'Expected value',
    remove: 'Remove condition', condition: 'Condition', addCondition: 'Add condition', addGroup: 'Add group',
    all: 'All must match', any: 'Any may match', not: 'Must not match', removeGroup: 'Remove group', removeNot: 'Remove NOT',
    always: 'Always', abbreviated: 'abbreviated', clauses: 'clauses', invalidStructure: 'Invalid structure · original data preserved',
    missing: 'Missing reference', disabled: 'Not readable', incompatible: 'Incompatible reference',
    chooseBoolean: 'Choose a boolean value', yes: 'True', no: 'False', isDefined: 'Is defined', isUndefined: 'Is undefined',
    contains: 'Contains', notContains: 'Does not contain', has: 'Is true', hasNot: 'Is false', equal: 'Equals', notEqual: 'Does not equal',
    needsValue: 'Enter a valid value of type', unsupportedOperator: 'Choose a compatible comparison',
    missingSubject: 'This reference no longer exists. Select another subject.', missingField: 'This property or state is unavailable. Select another field.',
    readCapability: 'Enable a readable property or state in Logic.', noConditions: 'No readable conditions. Configure properties, variables or runtime capabilities in Logic.',
    chooseField: 'Choose a property or state', cancel: 'Cancel', edit: 'Edit condition tree',
    tester: 'Test conditions', temporary: 'Temporary values. They are not saved with the story or exported.',
    usedValues: 'Values used here', noUsedValues: 'No values are needed for this condition.', defined: 'Defined', itemHint: 'Each item is kept as a separate value.', addItem: 'Add item', removeItem: 'Remove item',
    advanced: 'Advanced · other project values and JSON', otherVariables: 'Other variables', inventory: 'Inventory', visited: 'Visited events',
    json: 'Temporary states and properties (JSON)', jsonHint: 'Advanced overrides: entityStates, canonStates, dataObjects and unlockedCanonRefs.',
    reset: 'Reset test', routeSource: 'Routes from', thisCondition: 'This condition only', results: 'Condition result',
    satisfied: 'Matches', unsatisfied: 'Does not match', unresolved: 'Unresolved', invalid: 'Invalid',
    actual: 'Actual value', expected: 'Expected', selected: 'Selected route', blocked: 'Resolution stopped at', noRoute: 'No route matches',
    notEvaluated: 'Not evaluated · an earlier route selected or stopped resolution', duplicateElse: 'Resolution stopped: more than one Else route.',
    else: 'Else', route: 'Route', externalResult: 'Temporary function result',
    review: 'Review the marked fields.', consequence: 'Consequence', addConsequence: 'Add consequence', noEffects: 'No effects',
    conditionalConsequence: 'Conditional consequence', addRule: 'Add conditional consequence', removeRule: 'Remove rule',
    actionType: 'Action type', action: 'Action', grantable: 'Grantable', variable: 'Variable', effectValue: 'New value',
    noEffectFields: 'This entity has no writable property or state. Enable one in Logic.', chooseWritable: 'Choose a writable property or state',
    createEffectValues: 'Create a Grantable type or Variable in Logic to add consequences.',
  },
  es: {
    subject: 'Referencia', field: 'Propiedad o estado', operator: 'Comparación', value: 'Valor esperado',
    remove: 'Eliminar condición', condition: 'Condición', addCondition: 'Añadir condición', addGroup: 'Añadir grupo',
    all: 'Deben cumplirse todas', any: 'Debe cumplirse alguna', not: 'No debe cumplirse', removeGroup: 'Eliminar grupo', removeNot: 'Quitar NOT',
    always: 'Siempre', abbreviated: 'abreviado', clauses: 'cláusulas', invalidStructure: 'Estructura inválida · datos originales conservados',
    missing: 'Referencia ausente', disabled: 'No legible', incompatible: 'Referencia incompatible',
    chooseBoolean: 'Elige un valor booleano', yes: 'Verdadero', no: 'Falso', isDefined: 'Está definido', isUndefined: 'No está definido',
    contains: 'Contiene', notContains: 'No contiene', has: 'Es verdadero', hasNot: 'Es falso', equal: 'Es igual a', notEqual: 'No es igual a',
    needsValue: 'Introduce un valor válido de tipo', unsupportedOperator: 'Elige una comparación compatible',
    missingSubject: 'Esta referencia ya no existe. Elige otra referencia.', missingField: 'Esta propiedad o estado no está disponible. Elige otro campo.',
    readCapability: 'Habilita una propiedad o estado legible en Logic.', noConditions: 'No hay condiciones legibles. Configura propiedades, variables o capacidades en Logic.',
    chooseField: 'Elige una propiedad o estado', cancel: 'Cancelar', edit: 'Editar árbol de condiciones',
    tester: 'Probar condiciones', temporary: 'Valores temporales. No se guardan en la historia ni se exportan.',
    usedValues: 'Valores utilizados aquí', noUsedValues: 'Esta condición no necesita valores.', defined: 'Definido', itemHint: 'Cada elemento se conserva como un valor independiente.', addItem: 'Añadir elemento', removeItem: 'Eliminar elemento',
    advanced: 'Avanzado · otros valores del proyecto y JSON', otherVariables: 'Otras variables', inventory: 'Inventario', visited: 'Eventos visitados',
    json: 'Estados y propiedades temporales (JSON)', jsonHint: 'Sobrescrituras avanzadas: entityStates, canonStates, dataObjects y unlockedCanonRefs.',
    reset: 'Restablecer prueba', routeSource: 'Rutas desde', thisCondition: 'Solo esta condición', results: 'Resultado de la condición',
    satisfied: 'Cumple', unsatisfied: 'No cumple', unresolved: 'Sin resolver', invalid: 'Inválido',
    actual: 'Valor utilizado', expected: 'Esperado', selected: 'Ruta seleccionada', blocked: 'Resolución detenida en', noRoute: 'Ninguna ruta cumple',
    notEvaluated: 'Sin evaluar · una ruta anterior seleccionó o detuvo la resolución', duplicateElse: 'Resolución detenida: hay más de una ruta Else.',
    else: 'Else', route: 'Ruta', externalResult: 'Resultado temporal de la función',
    review: 'Revisa los campos señalados.', consequence: 'Consecuencia', addConsequence: 'Añadir consecuencia', noEffects: 'Sin consecuencias',
    conditionalConsequence: 'Consecuencia condicionada', addRule: 'Añadir consecuencia condicionada', removeRule: 'Eliminar regla',
    actionType: 'Tipo de acción', action: 'Acción', grantable: 'Otorgable', variable: 'Variable', effectValue: 'Nuevo valor',
    noEffectFields: 'Esta entidad no tiene propiedades o estados editables. Habilita alguno en Logic.', chooseWritable: 'Elige una propiedad o estado editable',
    createEffectValues: 'Crea un tipo otorgable o una variable en Logic para añadir consecuencias.',
  },
} as const;

export function conditionUiCopy(locale: ConditionUiLocale = 'en') { return copy[locale]; }

export function effectOperationLabel(operation: string, locale: ConditionUiLocale = 'en'): string {
  const operations = {
    en: {set: 'Set', toggle: 'Toggle', add: 'Add', subtract: 'Subtract', append: 'Add item', remove: 'Remove item', clear: 'Clear', grant: 'Grant', ungrant: 'Remove', unlock: 'Unlock', lock: 'Lock', discover: 'Discover', hide: 'Hide', enter: 'Enter', leave: 'Leave', call: 'Call'},
    es: {set: 'Fijar', toggle: 'Alternar', add: 'Añadir', subtract: 'Restar', append: 'Añadir elemento', remove: 'Quitar elemento', clear: 'Borrar', grant: 'Otorgar', ungrant: 'Retirar', unlock: 'Desbloquear', lock: 'Bloquear', discover: 'Descubrir', hide: 'Ocultar', enter: 'Entrar', leave: 'Salir', call: 'Llamar'},
  };
  return (operations[locale] as Record<string, string>)[operation] ?? operation;
}

export function conditionFieldLabel(field: {kind: string; key: string; label: string}, locale: ConditionUiLocale = 'en'): string {
  if (locale === 'en') return field.label;
  if (field.kind === 'value') return 'Valor';
  if (field.kind === 'visited') return 'Visitado';
  if (field.kind !== 'state') return field.label;
  return ({owned: 'Poseído', unlocked: 'Desbloqueado', discovered: 'Descubierto', present: 'Presente', exists: 'Existe'} as Record<string, string>)[field.key] ?? field.label;
}

export function conditionDiagnosticMessage(message: string, locale: ConditionUiLocale = 'en'): string {
  if (locale === 'en') return message;
  const replacements: Record<string, string> = {
    'Always': 'Sin restricciones', 'ALL': 'Deben cumplirse todas las cláusulas', 'ANY': 'Debe cumplirse alguna cláusula', 'NOT': 'La cláusula no debe cumplirse',
    'Containment cycle': 'Una copia no puede contenerse a sí misma, directa o indirectamente.', 'Unresolved owner context': 'El poseedor contextual todavía no está definido.',
    'Value is not defined': 'El valor no está definido', 'Comparison operands have incompatible types': 'Los valores comparados tienen tipos incompatibles',
    'State value must be boolean': 'El valor del estado debe ser booleano', 'Invalid condition structure': 'Estructura de condición inválida',
    'Condition group must not be empty': 'El grupo de condiciones no puede estar vacío', 'Missing condition subject': 'Falta la referencia de la condición',
    'Missing or incompatible external function': 'Función externa ausente o incompatible', 'List membership requires a single text item': 'La pertenencia a una lista requiere un elemento de texto',
    'Contains requires text or list': 'Contiene requiere texto o una lista', 'Ordered comparison requires numbers or ISO dates': 'La comparación ordenada requiere números o fechas ISO',
    'Expected a JSON object.': 'Se esperaba un objeto JSON.', 'State values must be boolean.': 'Los valores de los estados deben ser booleanos.',
    'unlockedCanonRefs must be a list of IDs.': 'unlockedCanonRefs debe ser una lista de IDs.', 'dataObjects must contain objects with an ID and fields object.': 'dataObjects debe contener objetos con ID y un objeto fields.',
    'Unsupported predicate type; original JSON preserved': 'Tipo de condición no compatible; JSON original conservado', 'Condition must be an object': 'La condición debe ser un objeto',
    'Condition nesting exceeds 64 levels': 'La condición supera 64 niveles anidados', 'Condition must have exactly one expression kind': 'La condición debe tener un solo tipo de expresión',
  };
  return replacements[message] ?? message.replace(/^Missing (variable|entity|data object|event|sequence|branch|decision|outcome) /, 'Referencia ausente: ')
    .replace(/^(some|all|count): (\d+)\/(\d+) copies match$/, '$2 de $3 copias cumplen el filtro')
    .replace(/: does not match$/, ': no cumple').replace(/: matches$/, ': cumple')
    .replace(/^Supply a result for /, 'Introduce un resultado temporal para ')
    .replace(/^Supply state /, 'Introduce un estado temporal para ')
    .replace(/^Actual value does not match /, 'El valor utilizado no corresponde al tipo ')
    .replace(/^Unsupported operator /, 'Operador no compatible: ');
}

export function narrativeTargetLabel(project: BranchingProject, id: string): string {
  const direct = [...project.events, ...project.sequences, ...project.branches].find(item => item.id === id);
  if (direct) return 'name' in direct ? direct.name : direct.title;
  for (const event of project.events) for (const decision of event.decisions ?? []) {
    if (decision.id === id || `decision:${event.id}:${decision.id}` === id) return `${event.name} · ${decision.name}`;
    const outcome = decision.outcomes.find(item => item.id === id || `outcome:${event.id}:${decision.id}:${item.id}` === id);
    if (outcome) return `${event.name} · ${outcome.visibleText ?? outcome.name}`;
  }
  return id;
}

export function conditionFieldKey(predicate: LogicPredicate): string {
  return predicate.type === 'state' ? typeof predicate.stateId === 'string' ? predicate.stateId : '?' : predicate.type === 'property' ? typeof predicate.propertyId === 'string' ? predicate.propertyId : '?' : predicate.type === 'external' ? 'call' : predicate.type === 'visited' ? 'visited' : 'value';
}

export function conditionOperatorLabel(predicate: LogicPredicate, locale: ConditionUiLocale = 'en'): string {
  const c = copy[locale];
  const op = predicate.operator;
  if (op === 'exists') return c.isDefined;
  if (op === 'missing') return ['state', 'visited', 'external'].includes(predicate.type) ? c.hasNot : c.isUndefined;
  if (op === 'has') return c.has;
  if (op === 'contains') return c.contains;
  if (op === 'notContains') return c.notContains;
  if (op === '==') return c.equal;
  if (op === '!=') return c.notEqual;
  return op;
}

export function conditionSubjectLabel(project: BranchingProject, predicate: LogicPredicate): string {
  const s = predicate.subject;
  if (!s || typeof s !== 'object') return '?';
  if (s.kind === 'progress') return narrativeTargetLabel(project, s.targetId);
  return logicSubjectOptions(project).find(item => item.key === logicSubjectKey(s))?.label ??
    (s.kind === 'entity' ? s.entityId : s.kind === 'variable' ? s.variableId : s.kind === 'dataObject' ? s.objectId : s.kind === 'instance' ? s.instanceId : s.kind === 'context' ? s.role : s.functionId);
}

export function conditionPredicateLabel(project: BranchingProject, predicate: LogicPredicate, locale: ConditionUiLocale = 'en'): string {
  if (!predicate.subject) return copy[locale].invalid;
  const field = resolveLogicField(project, predicate.subject, 'condition', predicate.type === 'value' ? 'value' : predicate.type, conditionFieldKey(predicate));
  const title = `${conditionSubjectLabel(project, predicate)}${predicate.type === 'external' && predicate.arguments?.length ? `(${predicate.arguments.map(value => JSON.stringify(value)).join(', ')})` : ''}`;
  const label = conditionFieldLabel(field, locale);
  const expected = 'value' in predicate && !['has', 'missing', 'exists'].includes(predicate.operator) ? ` ${JSON.stringify(predicate.value) ?? '?'}` : '';
  return `${title}${predicate.type === 'external' ? '' : ` · ${label}`} ${conditionOperatorLabel(predicate, locale)}${expected}`;
}

function normalizedInput(project: BranchingProject, input: ConditionInput | undefined) {
  return conditionStructureIssues(input).length ? undefined : migrateConditionInput(input, project.logicVariables ?? []);
}

export function conditionTreeSummary(project: BranchingProject, input: ConditionInput | undefined, locale: ConditionUiLocale = 'en', maxCharacters = 180): {text: string; abbreviated: boolean; clauses: number} {
  const c = copy[locale];
  if (conditionStructureIssues(input).length) return {text: c.invalidStructure, abbreviated: false, clauses: 0};
  const expression = normalizedInput(project, input);
  let clauses = 0;
  const render = (value: ConditionInput | undefined, nested = false): string => {
    if (!value || Array.isArray(value) && !value.length) return c.always;
    if (Array.isArray(value)) return render({all: value} as ConditionExpression, nested);
    if (!isConditionSet(value)) { clauses++;
      if (value.type === 'instanceQuery') {
        const query = value as InstanceQuery;
        const title = query.entityId ? project.canonRefs.find(e => e.id === query.entityId)?.label ?? project.localExplorerEntities?.find(e => e.id === query.entityId)?.name ?? query.entityId : locale === 'es' ? 'copias' : 'copies';
        const count = query.quantifier === 'count' ? ` ${query.operator ?? '>='} ${query.value ?? 1}` : '';
        const owner = query.owner ? ` ${locale === 'es' ? 'en' : 'inside'} ${conditionOwnerLabel(project, query.owner, locale)}` : ` · ${locale === 'es' ? 'cualquier poseedor' : 'any owner'}`;
        return `${locale === 'es' ? ({some:'Alguna',all:'Todas',count:'Cantidad de'})[query.quantifier] : ({some:'Some',all:'All',count:'Count of'})[query.quantifier]} ${title}${owner}${count}${query.filters ? ` (${render(query.filters)})` : ''}`;
      }
      return conditionPredicateLabel(project, value as LogicPredicate, locale);
    }
    if ('not' in value) return `NOT (${render(value.not)})`;
    const children = 'any' in value ? value.any : value.all;
    const body = children.map(child => render(child, true)).join('any' in value ? ' OR ' : ' AND ');
    return nested && children.length > 1 ? `(${body})` : body;
  };
  const text = render(expression);
  if (text.length <= maxCharacters) return {text, abbreviated: false, clauses};
  const root = Array.isArray(expression) ? 'AND' : expression && isConditionSet(expression) ? 'not' in expression ? 'NOT' : 'any' in expression ? 'OR' : 'AND' : c.condition;
  return {text: `${root} · ${clauses} ${c.clauses} · ${c.abbreviated}`, abbreviated: true, clauses};
}

export function conditionOwnerLabel(project: BranchingProject, owner: EntityOwner, locale: ConditionUiLocale = "en"): string {
  if (owner.kind === "context") return locale === "es" ? ({ actor: "Actor", self: "Origen", target: "Destinatario" })[owner.role] : ({ actor: "Actor", self: "Self", target: "Recipient" })[owner.role];
  if (owner.kind === "entity") return entityDefinition(project, owner.entityId)?.name ?? owner.entityId;
  if (owner.kind === "profile") return project.playerProfiles?.find(profile => profile.id === owner.profileId)?.name ?? (owner.profileId === "default" ? locale === "es" ? "Protagonista" : "Protagonist" : owner.profileId);
  const instance = project.entityInstances?.find(copy => copy.id === owner.instanceId);
  return instance?.name ?? (instance ? `${entityDefinition(project, instance.entityId)?.name ?? instance.entityId} · ${locale === "es" ? "copia" : "copy"}` : owner.instanceId);
}

/** A grouped expression is a single presentation token: flattening its leaves would misstate AND/OR/NOT. */
export function groupedConditionPresentation(project: BranchingProject, input: ConditionInput | undefined, locale: ConditionUiLocale = 'en', maxCharacters = 180): LogicPresentation[] {
  const normalized = normalizedInput(project, input);
  const expressions = asConditionExpressions(normalized);
  if (!input || !expressions.length && !conditionStructureIssues(input).length) return [];
  const summary = conditionTreeSummary(project, input, locale, maxCharacters);
  const leaves = conditionStructureIssues(input).length ? [] : presentConditionInput(project, normalized, Number.MAX_SAFE_INTEGER);
  if (expressions.length === 1 && !isConditionSet(expressions[0]) && expressions[0].type !== 'instanceQuery' && !summary.abbreviated && locale === 'en') return leaves;
  return [{id: 'condition-tree', text: summary.text, subjectLabel: summary.text, fieldLabel: '', operatorLabel: '', status: conditionStructureIssues(input).length ? 'incompatible' : leaves.find(item => item.status !== 'enabled')?.status ?? 'enabled'}];
}

export function conditionWarningCount(project: BranchingProject, input: ConditionInput | undefined): number {
  const issues = conditionStructureIssues(input);
  return issues.length || presentConditionInput(project, normalizedInput(project, input), Number.MAX_SAFE_INTEGER).filter(item => item.status !== 'enabled').length;
}

export type ConditionFieldIssue = {field: 'subject' | 'field' | 'operator' | 'value'; message: string};
export function conditionFieldIssues(project: BranchingProject, predicate: LogicPredicate, locale: ConditionUiLocale = 'en'): ConditionFieldIssue[] {
  const c = copy[locale], issues: ConditionFieldIssue[] = [];
  const subject = predicate.subject;
  const known = subject?.kind === 'progress'
    ? [...project.events, ...project.sequences, ...project.branches, ...project.events.flatMap(event => (event.decisions ?? []).flatMap(decision => [decision, ...decision.outcomes]))].some(item => item.id === subject.targetId)
    : subject && logicSubjectOptions(project).some(item => item.key === logicSubjectKey(subject));
  if (!known) issues.push({field: 'subject', message: c.missingSubject});
  if (!predicate.subject) return issues;
  const field = resolveLogicField(project, predicate.subject, 'condition', predicate.type === 'value' ? 'value' : predicate.type, conditionFieldKey(predicate));
  if (field.status !== 'enabled' && known) issues.push({field: 'field', message: field.status === 'disabled' ? c.readCapability : c.missingField});
  if (!logicOperatorsFor(field).includes(predicate.operator)) issues.push({field: 'operator', message: c.unsupportedOperator});
  if (!['has', 'missing', 'exists'].includes(predicate.operator)) {
    const type = ['contains', 'notContains'].includes(predicate.operator) ? 'text' : field.valueType ?? conditionValueType(predicate, project);
    if (!conditionValueMatchesType('value' in predicate ? predicate.value : undefined, type)) issues.push({field: 'value', message: `${c.needsValue} ${type ?? 'text/number/boolean/list'}.`});
  }
  return issues;
}

export type ConditionTestControl = {key: string; predicate: LogicPredicate; label: string; valueType?: string};
export function conditionTestControls(project: BranchingProject, inputs: (ConditionInput | undefined)[], locale: ConditionUiLocale = 'en'): ConditionTestControl[] {
  const controls = new Map<string, ConditionTestControl>();
  const visit = (value: ConditionInput | undefined, queryEntityId?: string) => {
    if (!value) return;
    if (Array.isArray(value)) { value.forEach(child => visit(child, queryEntityId)); return; }
    if (isConditionSet(value)) { if ('not' in value) visit(value.not, queryEntityId); else ('all' in value ? value.all : value.any).forEach(child => visit(child, queryEntityId)); return; }
    if (value.type === 'instanceQuery') {
      const query = value as InstanceQuery;
      visit(query.filters, query.entityId);
      return;
    }
    const predicate = value as LogicPredicate;
    if (!predicate.subject) return;
    if (predicate.subject.kind === 'context' && predicate.subject.role === 'self' && queryEntityId) {
      (project.entityInstances ?? []).filter(instance => instance.entityId === queryEntityId).forEach(instance => visit({ ...predicate, subject: { kind: 'instance', instanceId: instance.id } }));
      return;
    }
    const key = predicate.type === 'external' ? `external:${externalConditionKey(predicate)}` : `${logicSubjectKey(predicate.subject)}:${predicate.type}:${conditionFieldKey(predicate)}`;
    const field = resolveLogicField(project, predicate.subject, 'condition', predicate.type === 'value' ? 'value' : predicate.type, conditionFieldKey(predicate));
    const fieldLabel = predicate.type === 'external' ? copy[locale].externalResult : conditionFieldLabel(field, locale);
    const argumentsLabel = predicate.type === 'external' && predicate.arguments?.length ? `(${predicate.arguments.map(value => JSON.stringify(value)).join(', ')})` : '';
    controls.set(key, {key, predicate, label: `${conditionSubjectLabel(project, predicate)}${argumentsLabel} · ${fieldLabel}`, valueType: field.valueType ?? conditionValueType(predicate, project)});
  };
  inputs.forEach(input => visit(normalizedInput(project, input)));
  return [...controls.values()];
}

export function conditionExpressionAtPath(project: BranchingProject, input: ConditionInput | undefined, path: string): ConditionExpression | undefined {
  if (path.includes('.copy[')) return undefined;
  let value: unknown = normalizedInput(project, input);
  for (const match of path.slice('conditions'.length).matchAll(/\.(all|any|not)\[(\d+)\]/g)) {
    const key = match[1], index = Number(match[2]);
    if (Array.isArray(value) && key === 'all') value = value[index];
    else if (value && typeof value === 'object') value = key === 'not' ? (value as {not?: unknown}).not : (value as Record<string, unknown[]>)[key]?.[index];
    else return undefined;
  }
  return value && !Array.isArray(value) ? value as ConditionExpression : undefined;
}

export function conditionRouteResolution(project: BranchingProject, transitions: Transition[], state: NarrativeEvaluationState): {
  status: 'selected' | 'blocked' | 'none' | 'duplicateElse'; selected?: Transition; blocked?: Transition;
  routes: {route: Transition; reached: boolean; result?: ConditionEvaluationResult}[];
} {
  const ordered = orderedTransitions(transitions);
  if (transitions.filter(route => route.mode === 'fallback').length > 1) return {status: 'duplicateElse', routes: ordered.map(route => ({route, reached: false}))};
  let selected: Transition | undefined, blocked: Transition | undefined;
  const routes = ordered.map(route => {
    if (selected || blocked) return {route, reached: false};
    const result = evaluateConditionDetailed(effectiveConditions(route), project, state);
    if (result.status === 'invalid' || result.status === 'unresolved') blocked = route;
    else if (result.status === 'satisfied') selected = route;
    return {route, reached: true, result};
  });
  return {status: selected ? 'selected' : blocked ? 'blocked' : 'none', selected, blocked, routes};
}
