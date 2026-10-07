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

import { evaluateConditionDetailed, effectiveConditions, type ConditionProject } from './conditionEvaluation.js';
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
  if (operation === "toggle") return !Boolean(current);
  if (operation === "add") return Number(current ?? 0) + Number(value ?? 0);
  if (operation === "subtract") return Number(current ?? 0) - Number(value ?? 0);
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
  if (!migratedWhen && !then.length && !migratedRules.length) return undefined;
  return {
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
            : subject.functionId;
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
            : subject.functionId;
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
