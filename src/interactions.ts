import type { BranchingProject, EventNode, InteractionDefinition, InteractionModifierTrace, InteractionParticipant, InteractionParticipantResult, InteractionParticipantTrace, InteractionUse, InteractionValueSource, LogicSubject, PlayerSimulationState } from './domain.js';
import { evaluateConditionDetailed, resolveConditionValue } from './conditionEvaluation.js';
import { characterPropertyDescriptor, resolveCharacterSubject } from './characterStats.js';
import { diceBounds, dicePoolIssues, rollDice } from './interactionDice.js';

export const interactionNodeId = (eventId: string, id: string) => `interaction:${eventId}:${id}`;
export const barrierNodeId = (eventId: string, id: string) => `barrier:${eventId}:${id}`;
export const hasInteractions = (project: BranchingProject) => project.events.some(e => e.interactionUses?.length || e.interactionBarriers?.length);
export const hasOpposedInteractions = (project: BranchingProject) => project.events.some(event => event.interactionUses?.some(use => event.interactionDefinitions?.some(definition => definition.id === use.definitionId && definition.mechanic.kind === 'opposedcheck')));
export type InteractionExecution = {
  id: string; useId: string; definitionId: string; eventId: string; ownerNodeId: string;
  moment: InteractionUse['moment']; status: 'pending' | 'resolved'; elapsedMs: number;
  resultId?: string; total?: number; rolls?: number[]; forced?: boolean;
  participantTraces?: InteractionParticipantTrace[];
  participantResults?: Record<string, InteractionParticipantResult>;
  skillValue?: number;
  modifier?: number;
  modifierBreakdown?: InteractionModifierTrace[];
  /** Stable replay identity frozen at start; public execution IDs remain sequential. */
  cacheKey?: string;
};
export type InteractionEnvironment = { random: () => number; now: () => number };
export const defaultInteractionEnvironment: InteractionEnvironment = { random: Math.random, now: Date.now };

function diceIssues(dice: { count: number; sides: number } | undefined): string[] {
  return dicePoolIssues(dice);
}
function participantSubjectKey(subject: LogicSubject): string {
  return subject.kind === 'entity' ? `entity:${subject.entityId}` : subject.kind === 'instance' ? `instance:${subject.instanceId}` : JSON.stringify(subject);
}

function resolveNumericSource(project: BranchingProject, state: PlayerSimulationState, skill: NonNullable<Extract<InteractionDefinition['mechanic'], { kind: 'skillcheck' | 'dice' }>['skill']>, fallbackSubject?: LogicSubject): number {
  const resolved = resolveConditionValue(skill.kind === 'variable'
    ? { type: 'value', subject: { kind: 'variable', variableId: skill.variableId }, operator: '>=' }
    : { type: 'property', subject: skill.subject.kind === 'context' && skill.subject.role === 'self' && fallbackSubject ? fallbackSubject : skill.subject, propertyId: skill.propertyId, operator: '>=' }, project, state);
  if (resolved.error || resolved.unresolved || typeof resolved.value !== 'number' || !Number.isFinite(resolved.value)) throw new Error(resolved.error ?? resolved.unresolved ?? 'Skill must resolve to a finite number');
  return resolved.value;
}
function interactionSkillLabel(project: BranchingProject, skill: InteractionValueSource): string {
  return skill.kind === 'variable'
    ? project.logicVariables?.find(item => item.id === skill.variableId)?.name ?? skill.variableId
    : characterPropertyDescriptor(project, skill.propertyId)?.label ?? skill.propertyId;
}

function freezeModifierRules(project: BranchingProject, state: PlayerSimulationState, rules: InteractionDefinition['mechanic'] extends infer _ ? import('./domain.js').InteractionModifierRule[] | undefined : never, subject?: LogicSubject): { total: number; breakdown: InteractionModifierTrace[] } {
  const breakdown: InteractionModifierTrace[] = [];
  for (const rule of rules ?? []) {
    if (!rule.id || !Number.isFinite(rule.modifier)) throw new Error('A modifier rule needs a stable ID and finite value');
    if (!rule.conditions) throw new Error(`${rule.name || 'Modifier'}: add a condition before using this bonus`);
    const currentState = subject ? { ...state, context: { ...state.context, self: structuredClone(subject) } } : state;
    const evaluation = evaluateConditionDetailed(rule.conditions, project, currentState);
    if (evaluation.status === 'invalid' || evaluation.status === 'unresolved') throw new Error(`${rule.name || 'Modifier'}: ${evaluation.message}`);
    if (evaluation.status === 'satisfied') breakdown.push({ ruleId: rule.id, name: rule.name, modifier: rule.modifier });
  }
  return { total: breakdown.reduce((sum, item) => sum + item.modifier, 0), breakdown };
}

/** Capture the optional actor attribute and every applicable conditional bonus once at execution start. */
export function freezeInteractionRoll(project: BranchingProject, state: PlayerSimulationState, definition: InteractionDefinition): { skillValue: number; skillLabel?: string; modifier: number; modifierBreakdown: InteractionModifierTrace[] } | undefined {
  const mechanic = definition.mechanic;
  if (mechanic.kind !== 'dice' && mechanic.kind !== 'skillcheck') return undefined;
  const actor = mechanic.actor ?? (mechanic.skill?.kind === 'property' ? mechanic.skill.subject : undefined);
  const skill = mechanic.skill;
  const skillValue = skill ? resolveNumericSource(project, state, skill, actor) : 0;
  const rules = freezeModifierRules(project, state, mechanic.modifierRules, actor);
  return { skillValue, ...(skill ? { skillLabel: interactionSkillLabel(project, skill) } : {}), modifier: mechanic.modifier + rules.total, modifierBreakdown: rules.breakdown };
}
/** Backwards-compatible accessor used by existing integrations. */
export function freezeInteractionSkill(project: BranchingProject, state: PlayerSimulationState, definition: InteractionDefinition): number | undefined {
  return freezeInteractionRoll(project, state, definition)?.skillValue;
}

/** Resolve identities and numeric operands once, before any participant rolls. */
export function freezeInteractionParticipants(project: BranchingProject, state: PlayerSimulationState, definition: InteractionDefinition): InteractionParticipantTrace[] | undefined {
  const mechanic = definition.mechanic;
  if (mechanic.kind !== 'opposedcheck') return undefined;
  const participants = [mechanic.actor, ...mechanic.rivals];
  const seen = new Set<string>();
  return participants.map(participant => {
    const resolvedSubject = resolveCharacterSubject(project, state, participant.subject);
    const subject = resolvedSubject.subject;
    if (!subject) throw new Error(resolvedSubject.error ?? resolvedSubject.unresolved ?? `Supply a character for participant ${participant.id}`);
    const key = participantSubjectKey(subject);
    if (seen.has(key)) throw new Error('A character cannot oppose itself or occupy multiple participant roles');
    seen.add(key);
    let skillValue = 0;
    if (participant.skill) {
      const source = participant.skill;
      skillValue = resolveNumericSource(project, { ...state, context: { ...state.context, self: structuredClone(subject) } }, source, subject);
    }
    const bonuses = freezeModifierRules(project, state, participant.modifierRules, subject);
    const dice = participant.dice ?? mechanic.commonDice;
    if (dice) {
      const diceErrors = diceIssues(dice);
      if (diceErrors.length) throw new Error(`Participant ${participant.id}: ${diceErrors.join('; ')}`);
    }
    return { participantId: participant.id, subject: structuredClone(subject), variantId: resolvedSubject.variantId, ...(participant.skill ? { skillSource: structuredClone(participant.skill), skillLabel: interactionSkillLabel(project, participant.skill) } : {}), skillValue, modifier: participant.modifier + bonuses.total, modifierBreakdown: bonuses.breakdown, ...(dice ? { dice: structuredClone(dice) } : {}) };
  });
}

export function rangeContains(range: NonNullable<InteractionDefinition['results'][number]['range']>, value: number): boolean {
  return (range.min === undefined || (range.minInclusive === false ? value > range.min : value >= range.min)) &&
    (range.max === undefined || (range.maxInclusive === false ? value < range.max : value <= range.max));
}
function intervalOverlaps(a: NonNullable<InteractionDefinition['results'][number]['range']>, b: NonNullable<InteractionDefinition['results'][number]['range']>) {
  const aMax = a.max ?? Infinity, bMin = b.min ?? -Infinity, bMax = b.max ?? Infinity, aMin = a.min ?? -Infinity;
  const left = aMax > bMin || aMax === bMin && a.maxInclusive !== false && b.minInclusive !== false;
  const right = bMax > aMin || bMax === aMin && b.maxInclusive !== false && a.minInclusive !== false;
  return left && right;
}
function rangeIssues(results: InteractionDefinition['results'], label: string): string[] {
  const ranges = results.flatMap(result => result.range ? [{ result, range: result.range }] : []), issues: string[] = [];
  for (const { result, range } of ranges) {
    if (range.min !== undefined && !Number.isFinite(range.min) || range.max !== undefined && !Number.isFinite(range.max)) issues.push(`«${result.name}» has a non-finite ${label} boundary`);
    if (range.min !== undefined && range.max !== undefined && (range.min > range.max || range.min === range.max && (range.minInclusive === false || range.maxInclusive === false))) issues.push(`«${result.name}» has an empty or inverted ${label} range`);
  }
  for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) if (intervalOverlaps(ranges[i].range, ranges[j].range)) issues.push(`«${ranges[i].result.name}» and «${ranges[j].result.name}» ${label} ranges overlap`);
  return issues;
}
function modifierRuleIssues(rules: import('./domain.js').InteractionModifierRule[] | undefined, label: string) {
  const issues: string[] = [];
  if (rules && new Set(rules.map(rule => rule.id)).size !== rules.length) issues.push(`${label} modifier rules need unique IDs`);
  for (const rule of rules ?? []) {
    if (!rule.id || !rule.name.trim() || !Number.isFinite(rule.modifier)) issues.push(`${label} modifier rules need a name and finite value`);
    if (!rule.conditions) issues.push(`${rule.name || label} needs a condition before its modifier can be used`);
  }
  return issues;
}

export function interactionDefinitionIssues(definition: InteractionDefinition): string[] {
  const issues: string[] = [];
  const m = definition.mechanic;
  if (definition.mechanicPending) issues.push('Select an interaction mechanic');
  if (!definition.name.trim()) issues.push('Interaction requires a name');
  if (!definition.results.length) issues.push('Interaction requires results');
  if (new Set(definition.results.map(r => r.id)).size !== definition.results.length || definition.results.some(r => !r.id || !r.name.trim())) issues.push('Results require unique IDs and names');
  const dice = m.kind === 'dice' ? m : m.kind === 'skillcheck' ? m.dice : m.kind === 'opposedcheck' ? m.commonDice : undefined;
  issues.push(...diceIssues(dice));
  if ((m.kind === 'dice' || m.kind === 'skillcheck') && !Number.isFinite(m.modifier)) issues.push('Modifier must be finite');
  if (m.kind === 'dice' || m.kind === 'skillcheck') issues.push(...modifierRuleIssues(m.modifierRules, m.kind));
  if (m.kind === 'skillcheck' && (!Number.isFinite(m.difficulty) || m.skill && !['variable', 'property'].includes(m.skill.kind) || m.difficultyOperator !== undefined && !['>=', '>'].includes(m.difficultyOperator))) issues.push('Skillcheck requires a finite difficulty and supported comparison');
  if (m.kind === 'skillcheck' && !m.dice) issues.push('Skillcheck requires a dice pool');
  if (m.kind === 'qte' && (!m.key.trim() || !Number.isFinite(m.durationMs) || m.durationMs <= 0)) issues.push('QTE requires a key and a positive duration');
  if (!['dice', 'skillcheck', 'opposedcheck', 'qte', 'custom'].includes(m.kind)) issues.push('Unsupported interaction mechanic');
  if (m.kind === 'skillcheck' || m.kind === 'qte') for (const key of m.kind === 'qte' ? ['success', 'failure', 'timeout'] : ['success', 'failure']) {
    if (definition.results.filter(r => r.key === key).length !== 1) issues.push(`Exactly one ${key} result is required`);
  }
  if (m.kind === 'opposedcheck') {
    if (!m.actor || !Array.isArray(m.rivals) || !m.rivals.length) issues.push('Opposed check requires an actor and at least one rival');
    if (!['all', 'any'].includes(m.aggregation)) issues.push('Opposed check requires all or any aggregation');
    const participants = [m.actor, ...(Array.isArray(m.rivals) ? m.rivals : [])].filter((participant): participant is InteractionParticipant => Boolean(participant));
    if (participants.some(participant => !participant.id) || new Set(participants.map(participant => participant.id)).size !== participants.length) issues.push('Participants require unique stable IDs');
    for (const participant of participants) {
      if (!participant.subject || !['entity', 'instance', 'context'].includes(participant.subject.kind)) issues.push(`Participant ${participant.id} requires a character reference`);
      if (!participant.dice && !m.commonDice) issues.push(`Participant ${participant.id} requires common dice or a personal dice pool`);
      if (!Number.isFinite(participant.modifier)) issues.push(`Participant ${participant.id} modifier must be finite`);
      if (participant.skill && !['variable', 'property'].includes(participant.skill.kind)) issues.push(`Participant ${participant.id} requires a numeric skill source`);
      issues.push(...diceIssues(participant.dice ?? m.commonDice), ...modifierRuleIssues(participant.modifierRules, `Participant ${participant.id}`));
    }
    const subjects = participants.filter(participant => participant.subject).map(participant => participantSubjectKey(participant.subject));
    if (new Set(subjects).size !== subjects.length) issues.push('A character cannot oppose itself or occupy multiple participant roles');
    for (const key of ['success', 'failure', 'tie']) if (definition.results.filter(result => result.key === key).length !== 1) issues.push(`Exactly one ${key} result is required`);
  }
  if (m.kind === 'dice') {
    const ranged = definition.results.filter(result => result.range);
    if (ranged.length !== definition.results.length) issues.push('Every dice result needs a total range');
    if (ranged.some(result => result.range?.min === undefined || result.range.max === undefined || !Number.isFinite(result.range.min) || !Number.isFinite(result.range.max))) issues.push('Every dice result needs finite lower and upper bounds');
    issues.push(...rangeIssues(definition.results, 'dice result'));
    const bounds = diceBounds(m, m.modifier);
    const lastIndex = bounds.max - bounds.min;
    let coveredIndex = -1;
    const ranges = definition.results.map(result => result.range).filter((range): range is NonNullable<typeof range> => Boolean(range)).sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
    for (const range of ranges) {
      const first = Math.max(0, range.min === undefined ? 0 : range.minInclusive === false ? Math.floor(range.min - bounds.min) + 1 : Math.ceil(range.min - bounds.min));
      const last = Math.min(lastIndex, range.max === undefined ? lastIndex : range.maxInclusive === false ? Math.ceil(range.max - bounds.min) - 1 : Math.floor(range.max - bounds.min));
      if (last < first) continue;
      if (first > coveredIndex + 1) break;
      coveredIndex = Math.max(coveredIndex, last);
    }
    if (coveredIndex < lastIndex) issues.push('Dice ranges must cover every possible total');
  }
  if (m.kind === 'skillcheck') {
    if (definition.results.some(result => !result.key && !result.range)) issues.push('Extreme results need a total range before this interaction can run');
    issues.push(...rangeIssues(definition.results.filter(result => result.range), 'skillcheck result'));
  }
  return issues;
}

export function resolveInteraction(project: BranchingProject, state: PlayerSimulationState, definition: InteractionDefinition, input: { resultId?: string; key?: string; timeout?: boolean; manual?: boolean }, environment = defaultInteractionEnvironment, frozenParticipants?: InteractionParticipantTrace[], frozenSkillValue?: number, frozenModifier?: number, frozenModifierBreakdown?: InteractionModifierTrace[]) {
  const issues = interactionDefinitionIssues(definition);
  if (issues.length) throw new Error(issues.join('; '));
  const m = definition.mechanic;
  if (input.manual && m.kind !== 'custom') throw new Error('Manual resolution is only available for custom interactions');
  let rolls: number[] | undefined, total: number | undefined;
  let participantTraces: InteractionParticipantTrace[] | undefined;
  let participantResults: Record<string, InteractionParticipantResult> | undefined;
  let frozenRoll: ReturnType<typeof freezeInteractionRoll>;
  let result = input.resultId ? definition.results.find(r => r.id === input.resultId) : undefined;
  if (input.resultId && !result) throw new Error('Unknown interaction result');
  if (!input.resultId) {
    frozenRoll = (m.kind === 'dice' || m.kind === 'skillcheck') && frozenSkillValue === undefined && frozenModifier === undefined
      ? freezeInteractionRoll(project, state, definition)
      : undefined;
    const dice = m.kind === 'dice' ? m : m.kind === 'skillcheck' ? m.dice : undefined;
    if (dice) rolls = rollDice(dice, () => environment.random());
    if (m.kind === 'opposedcheck') {
      const frozen = frozenParticipants ?? freezeInteractionParticipants(project, state, definition)!;
      if (frozen.length !== m.rivals.length + 1 || frozen.some((trace, index) => trace.participantId !== [m.actor, ...m.rivals][index].id)) throw new Error('Frozen opposed participants do not match this execution');
      participantTraces = frozen.map(trace => {
        const participantRolls = trace.rolls ?? (trace.dice ? rollDice(trace.dice, () => environment.random()) : []);
        return { ...structuredClone(trace), rolls: [...participantRolls], total: trace.total ?? participantRolls.reduce((sum, roll) => sum + roll, 0) + trace.skillValue + trace.modifier };
      });
      const actor = participantTraces[0];
      total = actor.total; rolls = actor.rolls;
      const keys: ('success' | 'failure' | 'tie')[] = participantTraces.slice(1).map(trace => {
        return actor.total! > trace.total! ? 'success' : actor.total! < trace.total! ? 'failure' : 'tie';
      });
      participantResults = Object.fromEntries(participantTraces.slice(1).map((trace, index) => [trace.participantId, {
        resultId: definition.results.find(candidate => candidate.key === keys[index])!.id,
        total: trace.total!, rolls: [...trace.rolls!], subject: structuredClone(trace.subject), variantId: trace.variantId, ...(trace.skillSource ? { skillSource: structuredClone(trace.skillSource), skillLabel: trace.skillLabel } : {}), skillValue: trace.skillValue, modifier: trace.modifier,
        ...(trace.dice ? { dice: structuredClone(trace.dice) } : {}), ...(trace.modifierBreakdown ? { modifierBreakdown: structuredClone(trace.modifierBreakdown) } : {}),
      }]));
      const key = m.aggregation === 'all' ? keys.includes('failure') ? 'failure' : keys.includes('tie') ? 'tie' : 'success'
        : keys.includes('success') ? 'success' : keys.includes('tie') ? 'tie' : 'failure';
      result = definition.results.find(candidate => candidate.key === key);
    } else if (m.kind === 'dice' || m.kind === 'skillcheck') {
      const skillValue = frozenSkillValue ?? frozenRoll?.skillValue ?? 0;
      const modifier = frozenModifier ?? frozenRoll?.modifier ?? m.modifier;
      total = (rolls ?? []).reduce((a, b) => a + b, 0) + skillValue + modifier;
      if (m.kind === 'skillcheck') {
        const thresholdResults = definition.results.length === 2 && definition.results.some(item => item.key === 'success') && definition.results.some(item => item.key === 'failure');
        const hasConfiguredRanges = definition.results.some(item => item.range);
        if (thresholdResults && !hasConfiguredRanges) {
          const success = m.difficultyOperator === '>' ? total! > m.difficulty : total! >= m.difficulty;
          result = definition.results.find(item => item.key === (success ? 'success' : 'failure'));
        } else {
          result = definition.results.find(item => item.range && rangeContains(item.range, total!));
          if (!result) { const success = m.difficultyOperator === '>' ? total! > m.difficulty : total! >= m.difficulty; result = definition.results.find(item => item.key === (success ? 'success' : 'failure')); }
        }
      } else result = definition.results.find(item => item.range && rangeContains(item.range, total!));
    } else if (m.kind === 'qte') {
      if (!input.timeout && input.key === undefined) throw new Error('QTE waits for a key or timeout');
      result = definition.results.find(r => r.key === (input.timeout ? 'timeout' : input.key === m.key ? 'success' : 'failure'));
    } else throw new Error('Select a result for a custom interaction');
  }
  if (!result) throw new Error('No interaction result matches');
  const baseModifier = m.kind === 'dice' || m.kind === 'skillcheck' ? m.modifier : 0;
  return { result, total, rolls, forced: Boolean(input.resultId) && !input.manual, participantTraces, participantResults,
    ...((frozenRoll || frozenSkillValue !== undefined || frozenModifier !== undefined) ? { ...(m.kind === 'dice' || m.kind === 'skillcheck' ? m.skill ? { skillSource: structuredClone(m.skill), skillLabel: interactionSkillLabel(project, m.skill) } : {} : {}), skillValue: frozenSkillValue ?? frozenRoll?.skillValue ?? 0, modifier: frozenModifier ?? frozenRoll?.modifier ?? baseModifier, modifierBreakdown: frozenModifierBreakdown ?? frozenRoll?.modifierBreakdown ?? [] } : {}) };
}

export function interactionUsesFor(event: EventNode | undefined, nodeId: string, moment: InteractionUse['moment']) {
  return (event?.interactionUses ?? []).filter(use => use.ownerNodeId === nodeId && use.moment === moment);
}
