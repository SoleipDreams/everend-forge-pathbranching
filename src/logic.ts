import type {
  BranchingProject,
  Condition,
  ConditionExpression,
  ConditionInput,
  ConditionSet,
  Consequence,
  LogicComparisonOperator,
  LogicEffect,
  LogicMoment,
  LogicPredicate,
  LogicSubject,
  LogicVariable,
  PlayerSimulationState,
  ProjectDataObject,
  Transition,
} from "./domain.js";

import { conditionValueMatchesType, conditionValueType, evaluateConditionDetailed, effectiveConditions, type ConditionProject } from './conditionEvaluation.js';
import { entityDefinition, ownerKey, resolveContextSubject } from './authoringEntities.js';
import { resolveLogicField } from './logicCapabilities.js';
export { evaluateConditionDetailed, effectiveConditions, combineConditions } from './conditionEvaluation.js';
export type { ConditionEvaluationResult, ConditionStatus } from './conditionEvaluation.js';

export type NarrativeEvaluationState = {
  externalResults?: Record<string, boolean>;
  variables?: Record<string, unknown>;
  canonStates?: Record<string, Record<string, unknown>>;
  visited?: Set<string> | string[];
  dataObjects?: ProjectDataObject[];
  /** Grantable entity ids the player currently holds (mirrors PlayerSimulationState.inventory). */
  inventory?: Set<string> | string[];
  unlockedCanonRefs?: Set<string> | string[];
  entityStates?: PlayerSimulationState["entityStates"];
  entityInstances?: PlayerSimulationState["entityInstances"];
  context?: PlayerSimulationState["context"];
};

type LogicProject = ConditionProject;
export function evaluateCondition(condition: Condition, project: LogicProject, state: NarrativeEvaluationState): boolean {
  return evaluateConditionDetailed(condition, project, state).status === 'satisfied';
}
export function evaluateConditionInput(input: ConditionInput | undefined, project: LogicProject, state: NarrativeEvaluationState): boolean {
  return evaluateConditionDetailed(input, project, state).status === 'satisfied';
}

export function orderedTransitions(transitions: Transition[]): Transition[] {
  return [...transitions].sort((a, b) => {
    if (a.mode === "fallback" && b.mode !== "fallback") return 1;
    if (b.mode === "fallback" && a.mode !== "fallback") return -1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

export function resolveFirstValidTransition(
  transitions: Transition[],
  project: LogicProject,
  state: NarrativeEvaluationState,
): Transition | undefined {
  if (transitions.filter(t => t.mode === 'fallback').length > 1) return undefined;
  for (const transition of orderedTransitions(transitions)) {
    const result = evaluateConditionDetailed(effectiveConditions(transition), project, state);
    if (result.status === 'invalid' || result.status === 'unresolved') return undefined;
    if (result.status === 'satisfied') return transition;
  }
  return undefined;
}

/** Filters a list of consequences down to the ones whose own (optional) `conditions` gate currently passes. */
export function resolveConsequences(
  consequences: Consequence[] | undefined,
  project: LogicProject,
  state: NarrativeEvaluationState,
): Consequence[] {
  return (consequences ?? []).filter((consequence) =>
    evaluateConditionInput("conditions" in consequence ? consequence.conditions : undefined, project, state),
  );
}

function applyValueOperation(current: unknown, operation: string, value: unknown): unknown {
  if (operation === "toggle") return typeof current === 'boolean' ? !current : current;
  if (operation === "add") return typeof current === 'number' && typeof value === 'number' ? current + value : current;
  if (operation === "subtract") return typeof current === 'number' && typeof value === 'number' ? current - value : current;
  if (operation === "append") {
    const values = Array.isArray(current) ? current : [];
    return values.includes(value) ? values : [...values, value];
  }
  if (operation === "remove") return Array.isArray(current) ? current.filter((item) => item !== value) : current;
  if (operation === "clear") return undefined;
  return value;
}

function stateOperationValue(operation: string, value: unknown): boolean {
  if (["grant", "unlock", "discover", "enter"].includes(operation)) return true;
  if (["ungrant", "lock", "hide", "leave", "clear"].includes(operation)) return false;
  if (operation === "toggle") return !Boolean(value);
  return Boolean(value);
}

export function applyLogicEffect(effect: LogicEffect, state: PlayerSimulationState): PlayerSimulationState {
  if (effect.type === "external") return state;
  if (effect.subject.kind === 'context') {
    const subject = resolveContextSubject(effect.subject, state);
    return subject ? applyLogicEffect({ ...effect, subject } as LogicEffect, state) : state;
  }
  if (effect.subject.kind === 'instance') {
    const id = effect.subject.instanceId;
    return { ...state, entityInstances: (state.entityInstances ?? []).map(instance => {
      if (instance.id !== id) return instance;
      if (effect.type === 'property') return { ...instance, properties: { ...instance.properties, [effect.propertyId]: applyValueOperation(instance.properties?.[effect.propertyId], effect.operation, effect.value) } };
      if (effect.type === 'state') return { ...instance, states: { ...instance.states, [effect.stateId]: effect.operation === 'toggle' ? !instance.states?.[effect.stateId] : stateOperationValue(effect.operation, effect.value) } };
      return instance;
    }) };
  }
  if (effect.subject.kind === 'dataObject' && effect.type === 'property') {
    const id = effect.subject.objectId;
    return { ...state, dataObjects: (state.dataObjects ?? []).map(object => object.id === id ? { ...object, fields: { ...object.fields, [effect.propertyId]: applyValueOperation(object.fields?.[effect.propertyId], effect.operation, effect.value) } } : object) };
  }
  if (effect.type === "value" && effect.subject.kind === "variable") {
    const current = state.variables?.[effect.subject.variableId];
    return {
      ...state,
      variables: {
        ...state.variables,
        [effect.subject.variableId]: applyValueOperation(current, effect.operation, effect.value),
      },
    };
  }
  if (effect.subject.kind !== "entity") return state;
  const entityId = effect.subject.entityId;
  const currentEntity = state.entityStates?.[entityId] ?? {};
  if (effect.type === "state") {
    const currentValue = currentEntity.states?.[effect.stateId];
    const nextValue = effect.operation === "toggle"
      ? !Boolean(currentValue)
      : stateOperationValue(effect.operation, effect.value);
    const next: PlayerSimulationState = {
      ...state,
      entityStates: {
        ...state.entityStates,
        [entityId]: {
          ...currentEntity,
          states: { ...currentEntity.states, [effect.stateId]: nextValue },
        },
      },
    };
    if (effect.stateId === "owned") {
      next.inventory = nextValue
        ? Array.from(new Set([...(state.inventory ?? []), entityId]))
        : (state.inventory ?? []).filter((id) => id !== entityId);
    }
    if (effect.stateId === "unlocked") {
      next.unlockedCanonRefs = nextValue
        ? Array.from(new Set([...(state.unlockedCanonRefs ?? []), entityId]))
        : (state.unlockedCanonRefs ?? []).filter((id) => id !== entityId);
    }
    return next;
  }
  if (effect.type !== "property") return state;
  const current = currentEntity.properties?.[effect.propertyId];
  const value = applyValueOperation(current, effect.operation, effect.value);
  return {
    ...state,
    entityStates: {
      ...state.entityStates,
      [entityId]: {
        ...currentEntity,
        properties: { ...currentEntity.properties, [effect.propertyId]: value },
      },
    },
    grantableProperties: {
      ...state.grantableProperties,
      [entityId]: { ...state.grantableProperties?.[entityId], [effect.propertyId]: value },
    },
  };
}

/** Pure reducer applying a single consequence onto player simulation state. */
export function applyConsequence(consequence: Consequence, state: PlayerSimulationState): PlayerSimulationState {
  if ("subject" in consequence) return applyLogicEffect(consequence as LogicEffect, state);
  if (consequence.type === "addGrantable") {
    const inventory = state.inventory ?? [];
    return inventory.includes(consequence.entityId)
      ? state
      : { ...state, inventory: [...inventory, consequence.entityId] };
  }
  if (consequence.type === "removeGrantable") {
    return { ...state, inventory: (state.inventory ?? []).filter((id) => id !== consequence.entityId) };
  }
  if (consequence.type === "editGrantable") {
    return {
      ...state,
      grantableProperties: {
        ...state.grantableProperties,
        [consequence.entityId]: {
          ...state.grantableProperties?.[consequence.entityId],
          [consequence.propertyId]: consequence.value,
        },
      },
    };
  }
  return { ...state, variables: { ...state.variables, [consequence.name]: consequence.value } };
}

export type EffectApplicationResult = { status: 'applied' | 'invalid' | 'unresolved'; state: PlayerSimulationState; message?: string };
/** Strict authoring reducer. Legacy wrappers remain available for older consumers. */
export function applyConsequenceDetailed(project: BranchingProject, state: PlayerSimulationState, consequence: Consequence): EffectApplicationResult {
  const effect = migrateConsequence(consequence, project.logicVariables ?? []);
  const invalid = (message: string): EffectApplicationResult => ({ status: 'invalid', state, message });
  if (effect.type === 'external') return { status: 'unresolved', state, message: 'External actions require an explicit implementation' };
  const subject = resolveContextSubject(effect.subject, state);
  if (!subject) return { status: 'unresolved', state, message: 'Supply action context' };
  if (subject.kind === 'variable' && !project.logicVariables?.some(v => v.id === subject.variableId)) return invalid(`Missing variable ${subject.variableId}`);
  if (subject.kind === 'entity' && !entityDefinition(project, subject.entityId)) return invalid(`Missing entity ${subject.entityId}`);
  if (subject.kind === 'instance' && !(state.entityInstances ?? []).some(i => i.id === subject.instanceId)) return invalid(`Missing copy ${subject.instanceId}`);
  if (subject.kind === 'dataObject' && !project.projectDataObjects?.some(o => o.id === subject.objectId)) return invalid(`Missing data object ${subject.objectId}`);
  if (subject.kind === 'progress' || subject.kind === 'external') return invalid('Incompatible effect subject');
  if (effect.type === 'value' && subject.kind !== 'variable' || effect.type === 'property' && subject.kind === 'variable' || effect.type === 'state' && !['entity','instance'].includes(subject.kind)) return invalid('Incompatible effect and subject');
  const predicate = { ...effect, subject, operator: '==' } as unknown as LogicPredicate;
  let type = effect.type === 'state' ? 'boolean' : conditionValueType(predicate, project);
  const current = effect.type === 'state' ? false : (() => {
    if (subject.kind === 'variable') return state.variables?.[subject.variableId] ?? project.logicVariables?.find(v => v.id === subject.variableId)?.value;
    if (subject.kind === 'dataObject' && effect.type === 'property') return (state.dataObjects ?? project.projectDataObjects)?.find(o => o.id === subject.objectId)?.fields?.[effect.propertyId];
    if (subject.kind === 'instance' && effect.type === 'property') { const i = state.entityInstances?.find(i => i.id === subject.instanceId); return i?.properties?.[effect.propertyId] ?? (i ? entityDefinition(project, i.entityId)?.properties[effect.propertyId] : undefined); }
    if (subject.kind === 'entity' && effect.type === 'property') return state.entityStates?.[subject.entityId]?.properties?.[effect.propertyId] ?? entityDefinition(project, subject.entityId)?.properties[effect.propertyId];
    return undefined;
  })();
  type ??= Array.isArray(current) ? 'list' : typeof current === 'number' ? 'number' : typeof current === 'boolean' ? 'boolean' : typeof current === 'string' ? 'text' : undefined;
  const capabilitySubject = subject.kind === 'instance' ? { kind: 'entity' as const, entityId: state.entityInstances!.find(i => i.id === subject.instanceId)!.entityId } : subject;
  const fieldId = effect.type === 'state' ? effect.stateId : effect.type === 'property' ? effect.propertyId : 'value';
  const field = resolveLogicField(project, capabilitySubject, 'effect', effect.type, fieldId);
  if (field.status !== 'enabled') return invalid(`Effect field ${fieldId} is ${field.status}`);
  if (!['set','toggle','add','subtract','append','remove','clear','grant','ungrant','unlock','lock','discover','hide','enter','leave'].includes(effect.operation)) return invalid('Unsupported effect operation');
  if (['add','subtract'].includes(effect.operation) && (type !== 'number' || typeof current !== 'number' || !Number.isFinite(current) || typeof effect.value !== 'number' || !Number.isFinite(effect.value) || !Number.isFinite(effect.operation === 'add' ? current + effect.value : current - effect.value))) return invalid('Numeric effect requires finite numeric operands');
  if (effect.operation === 'toggle' && type !== 'boolean') return invalid('Toggle requires a boolean');
  if (['append','remove'].includes(effect.operation) && (!Array.isArray(current) || typeof effect.value !== 'string')) return invalid('List effect requires a list and one text item');
  if (effect.operation === 'set' && !conditionValueMatchesType(effect.value, type)) return invalid(`Effect value does not match ${type ?? 'scalar/list type'}`);
  if (effect.type !== 'state' && ['grant','ungrant','unlock','lock','discover','hide','enter','leave'].includes(effect.operation)) return invalid('State operation applied to a property');
  const hydrated = { ...state, dataObjects: state.dataObjects ?? structuredClone(project.projectDataObjects ?? []) };
  if (effect.type === 'property' && subject.kind === 'entity' && !Object.prototype.hasOwnProperty.call(state.entityStates?.[subject.entityId]?.properties ?? {}, effect.propertyId)) hydrated.entityStates = { ...state.entityStates, [subject.entityId]: { ...state.entityStates?.[subject.entityId], properties: { ...entityDefinition(project, subject.entityId)?.properties, ...state.entityStates?.[subject.entityId]?.properties } } };
  if (effect.type === 'property' && subject.kind === 'instance') hydrated.entityInstances = state.entityInstances?.map(i => i.id === subject.instanceId ? { ...i, properties: { ...entityDefinition(project, i.entityId)?.properties, ...i.properties } } : i);
  let next = applyLogicEffect({ ...effect, subject } as LogicEffect, hydrated);
  if (effect.type === 'state' && effect.stateId === 'owned' && subject.kind === 'entity') {
    const profileId = state.context?.profileId ?? 'default';
    const legacyId = `instance:legacy:${encodeURIComponent(profileId)}:${encodeURIComponent(subject.entityId)}`;
    const instances = (state.entityInstances ?? []).map(i => ({...i}));
    const owned = next.entityStates?.[subject.entityId]?.states?.owned;
    if (owned) {
      const existing = instances.find(i => i.id === legacyId);
      if (existing) existing.owner = { kind:'profile',profileId };
      else instances.push({ id:legacyId,entityId:subject.entityId,owner:{kind:'profile',profileId} });
    }
    next = { ...next, inventory: [], entityInstances: owned ? instances : instances.map(i => i.entityId === subject.entityId && (ownerKey(i.owner) === `profile:${profileId}` || state.context?.actor?.kind === 'entity' && ownerKey(i.owner) === `entity:${state.context.actor.entityId}`) ? { ...i, owner:undefined } : i) };
    if (next.entityStates?.[subject.entityId]?.states) { const { owned: _owned, ...states } = next.entityStates[subject.entityId]!.states!; next.entityStates = { ...next.entityStates,[subject.entityId]:{...next.entityStates[subject.entityId],states} }; }
  }
  return { status: 'applied', state: next };
}

export function isConditionSet(expression: ConditionExpression): expression is ConditionSet {
  return Boolean(expression && typeof expression === "object" && ("all" in expression || "any" in expression || "not" in expression));
}

export function asConditionExpressions(input: ConditionInput | undefined): ConditionExpression[] {
  if (!input) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}

export function walkConditions(
  input: ConditionInput | undefined,
  visit: (condition: Condition, path: string) => void,
  path = "conditions",
) {
  asConditionExpressions(input).forEach((expression, index) => {
    walkConditionExpression(expression, visit, `${path}[${index}]`);
  });
}

function walkConditionExpression(
  expression: ConditionExpression,
  visit: (condition: Condition, path: string) => void,
  path: string,
) {
  if (!expression || typeof expression !== "object") return;
  if (!isConditionSet(expression)) {
    visit(expression, path);
    if (expression.type === 'instanceQuery') walkConditions(expression.filters as ConditionInput | undefined, visit, `${path}.filters`);
    return;
  }

  if ("all" in expression) {
    (Array.isArray(expression.all) ? expression.all : []).forEach((child, index) => walkConditionExpression(child, visit, `${path}.all[${index}]`));
    return;
  }

  if ("any" in expression) {
    (Array.isArray(expression.any) ? expression.any : []).forEach((child, index) => walkConditionExpression(child, visit, `${path}.any[${index}]`));
    return;
  }

  walkConditionExpression(expression.not, visit, `${path}.not`);
}

export function conditionCount(input: ConditionInput | undefined): number {
  let count = 0;
  walkConditions(input, () => {
    count += 1;
  });
  return count;
}

function variableIdForName(name: string, variables: LogicVariable[]): string {
  return variables.find((variable) => variable.id === name || variable.name === name)?.id ?? name;
}

function migrateCondition(condition: Condition, variables: LogicVariable[]): Condition {
  if (!condition || typeof condition !== "object") return condition;
  if ("subject" in condition) return condition;
  const raw = condition as Record<string, unknown>;
  if (condition.type === "canonEntryUnlocked") {
    return {
      type: "state",
      subject: { kind: "entity", entityId: String(raw.ref ?? ""), source: "canon" },
      stateId: "unlocked",
      operator: condition.negate ? "missing" : "has",
    };
  }
  if (condition.type === "canonProperty" || condition.type === "canonState") {
    return {
      type: condition.type === "canonState" ? "state" : "property",
      subject: { kind: "entity", entityId: String(raw.ref ?? ""), source: "canon" },
      ...(condition.type === "canonState" ? {stateId: String(raw.state ?? "")} : {propertyId: String(raw.property ?? "")}),
      operator: String(raw.operator ?? "==") as LogicComparisonOperator,
      value: condition.type === 'canonState' && (raw.value === 'true' || raw.value === 'false') ? raw.value === 'true' : raw.value,
    } as Condition;
  }
  if (condition.type === "variable") {
    const variable = variables.find(v => v.id === raw.name || v.name === raw.name);
    let value = raw.value;
    if (variable?.type === 'number' && typeof value === 'string' && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value))) value = Number(value);
    if (variable?.type === 'boolean' && (value === 'true' || value === 'false')) value = value === 'true';
    return {
      type: "value",
      subject: { kind: "variable", variableId: variableIdForName(String(raw.name ?? ""), variables) },
      operator: String(raw.operator ?? "==") as "==",
      value,
    };
  }
  if (condition.type === "dataObjectExists") {
    return {
      type: "state",
      subject: { kind: "dataObject", objectId: String(raw.objectId ?? "") },
      stateId: "exists",
      operator: "has",
    };
  }
  if (condition.type === "dataObjectField") {
    return {
      type: "property",
      subject: { kind: "dataObject", objectId: String(raw.objectId ?? "") },
      propertyId: String(raw.field ?? ""),
      operator: String(raw.operator ?? "==") as "==",
      value: raw.value,
    };
  }
  if (condition.type === "runtimeItem") {
    return {
      type: "state",
      subject: { kind: "entity", entityId: String(raw.itemId ?? "") },
      stateId: "owned",
      operator: condition.operator === "missing" ? "missing" : "has",
    };
  }
  if (condition.type === "visited") {
    return {
      type: "visited",
      subject: {
        kind: "progress",
        targetType: condition.targetType,
        targetId: condition.targetId,
      },
      operator: condition.negate ? "missing" : "has",
    };
  }
  if (condition.type === "externalFunction") {
    return {
      type: "external",
      subject: { kind: "external", functionId: String(raw.name ?? "") },
      operator: "has",
      arguments: Array.isArray(raw.arguments) ? raw.arguments : undefined,
    };
  }
  return condition;
}

function migrateExpression(expression: ConditionExpression, variables: LogicVariable[]): ConditionExpression {
  if (expression && 'type' in expression && expression.type === 'instanceQuery') return { ...expression, filters: migrateConditionInput(expression.filters as ConditionInput | undefined, variables) };
  if (!isConditionSet(expression)) return migrateCondition(expression, variables);
  if ("all" in expression) return { ...expression, all: Array.isArray(expression.all) ? expression.all.map((child) => migrateExpression(child, variables)) : expression.all };
  if ("any" in expression) return { ...expression, any: Array.isArray(expression.any) ? expression.any.map((child) => migrateExpression(child, variables)) : expression.any };
  return { ...expression, not: migrateExpression(expression.not, variables) };
}

export function migrateConditionInput(
  input: ConditionInput | undefined,
  variables: LogicVariable[] = [],
): ConditionInput | undefined {
  if (!input) return undefined;
  return Array.isArray(input)
    ? input.map((expression) => migrateExpression(expression, variables))
    : migrateExpression(input, variables);
}

export function migrateConsequence(consequence: Consequence, variables: LogicVariable[] = []): LogicEffect {
  if ("subject" in consequence) return consequence as LogicEffect;
  if (consequence.type === "addGrantable" || consequence.type === "removeGrantable") {
    return {
      type: "state",
      subject: { kind: "entity", entityId: consequence.entityId },
      stateId: "owned",
      operation: consequence.type === "addGrantable" ? "grant" : "ungrant",
    };
  }
  if (consequence.type === "editGrantable") {
    return {
      type: "property",
      subject: { kind: "entity", entityId: consequence.entityId },
      propertyId: consequence.propertyId,
      operation: "set",
      value: consequence.value,
    };
  }
  return {
    type: "value",
    subject: { kind: "variable", variableId: variableIdForName(consequence.name, variables) },
    operation: "set",
    value: consequence.value,
  };
}

export function migrateLogicMoment(
  ownerId: string,
  when: ConditionInput | undefined,
  consequences: Consequence[] | undefined,
  existing: LogicMoment | undefined,
  variables: LogicVariable[] = [],
): LogicMoment | undefined {
  const migratedWhen = migrateConditionInput(existing?.when ?? when, variables);
  const sourceEffects = existing?.then ?? consequences ?? [];
  const then: LogicEffect[] = [];
  const rules = [...(existing?.rules ?? [])];
  sourceEffects.forEach((consequence, index) => {
    const guarded = "conditions" in consequence ? consequence.conditions : undefined;
    const effect = migrateConsequence(consequence, variables);
    if (guarded) {
      rules.push({
        id: `rule:legacy:${ownerId}:${index}`,
        when: migrateConditionInput(guarded, variables)!,
        then: [effect],
      });
    } else {
      then.push(effect);
    }
  });
  const migratedRules = rules.map((rule) => ({
    ...rule,
    when: migrateConditionInput(rule.when, variables)!,
    then: rule.then.map((effect) => migrateConsequence(effect, variables)),
  }));
  if (!migratedWhen && !then.length && !migratedRules.length && !existing?.narrativeEffects?.length) return undefined;
  return {
    ...(existing?.repeat ? { repeat: existing.repeat } : {}),
    ...(existing?.narrativeEffects ? { narrativeEffects: existing.narrativeEffects } : {}),
    ...(migratedWhen ? { when: migratedWhen } : {}),
    ...(then.length ? { then } : {}),
    ...(migratedRules.length ? { rules: migratedRules } : {}),
  };
}

export function inferredTransitionRole(transition: Transition, siblingCount = 1): "flow" | "route" {
  if (transition.role) return transition.role;
  return siblingCount > 1 ||
    transition.mode === "fallback" ||
    Boolean(transition.conditions ?? transition.logic?.when) ||
    Boolean((transition.consequences ?? transition.logic?.then)?.length) ||
    Boolean(transition.logic?.narrativeEffects?.length || transition.logic?.rules?.length) ||
    Boolean(transition.function)
    ? "route"
    : "flow";
}

export function conditionLabel(condition: Condition): string {
  if ("subject" in condition) {
    const predicate = condition as LogicPredicate;
    const subject = predicate.subject;
    const subjectId = subject.kind === "entity"
      ? subject.entityId
      : subject.kind === "dataObject"
        ? subject.objectId
        : subject.kind === "variable"
          ? subject.variableId
          : subject.kind === "progress"
            ? subject.targetId
            : subject.kind === 'instance' ? subject.instanceId : subject.kind === 'context' ? subject.role : subject.functionId;
    if (predicate.type === "state") return `${subjectId} ${predicate.operator} ${predicate.stateId}`;
    if (predicate.type === "property") return `${subjectId}.${predicate.propertyId} ${predicate.operator}`;
    if (predicate.type === "value") return `${subjectId} ${predicate.operator}`;
    if (predicate.type === "visited") return `${predicate.operator === "missing" ? "not visited" : "visited"} ${subjectId}`;
    return `call ${subjectId}`;
  }
  if (condition.type === "canonEntryUnlocked") {
    return condition.negate ? "unless canon" : "requires canon";
  }
  if (condition.type === "canonProperty") {
    return `${condition.property} ${condition.operator}`;
  }
  if (condition.type === "canonState") {
    return `${condition.state} ${condition.operator}`;
  }
  if (condition.type === "variable") {
    return `${condition.name} ${condition.operator}`;
  }
  if (condition.type === "dataObjectExists") {
    return "requires data";
  }
  if (condition.type === "dataObjectField") {
    return `${condition.field} ${condition.operator}`;
  }
  if (condition.type === "runtimeItem") {
    return condition.operator === "missing" ? "missing item" : "has item";
  }
  if (condition.type === "visited") {
    return condition.negate ? `not visited ${condition.targetType}` : `visited ${condition.targetType}`;
  }
  return condition.type;
}

export function conditionLabels(input: ConditionInput | undefined): string[] {
  const labels: string[] = [];
  walkConditions(input, (condition) => {
    labels.push(conditionLabel(condition));
  });
  return labels;
}

export function consequenceLabel(consequence: Consequence): string {
  if ("subject" in consequence) {
    const subject = consequence.subject;
    const subjectId = subject.kind === "entity"
      ? subject.entityId
      : subject.kind === "dataObject"
        ? subject.objectId
        : subject.kind === "variable"
          ? subject.variableId
          : subject.kind === "progress"
            ? subject.targetId
            : subject.kind === 'instance' ? subject.instanceId : subject.kind === 'context' ? subject.role : subject.functionId;
    if (consequence.type === "state") return `${consequence.operation} ${subjectId}`;
    if (consequence.type === "property") return `${consequence.operation} ${subjectId}.${consequence.propertyId}`;
    if (consequence.type === "value") return `${consequence.operation} ${subjectId}`;
    return `call ${subjectId}`;
  }
  if (consequence.type === "addGrantable") {
    return "grant item";
  }
  if (consequence.type === "removeGrantable") {
    return "remove item";
  }
  if (consequence.type === "editGrantable") {
    return `edit ${consequence.propertyId}`;
  }
  return "set variable";
}

export function conditionInputsFromConsequences(consequences: Consequence[] | undefined): ConditionInput[] {
  return (consequences ?? []).flatMap((consequence) => {
    if (!("conditions" in consequence)) {
      return [];
    }
    return isConditionInput(consequence.conditions) ? [consequence.conditions] : [];
  });
}

function isConditionInput(value: unknown): value is ConditionInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  return true;
}
