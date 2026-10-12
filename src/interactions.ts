import type { BranchingProject, EventNode, InteractionDefinition, InteractionUse, PlayerSimulationState } from './domain.js';
import { resolveConditionValue } from './conditionEvaluation.js';

export const interactionNodeId = (eventId: string, id: string) => `interaction:${eventId}:${id}`;
export const barrierNodeId = (eventId: string, id: string) => `barrier:${eventId}:${id}`;
export const hasInteractions = (project: BranchingProject) => project.events.some(e => e.interactionDefinitions?.length || e.interactionUses?.length || e.interactionBarriers?.length);
export type InteractionExecution = {
  id: string; useId: string; definitionId: string; eventId: string; ownerNodeId: string;
  moment: InteractionUse['moment']; status: 'pending' | 'resolved'; elapsedMs: number;
  resultId?: string; total?: number; rolls?: number[]; forced?: boolean;
};
export type InteractionEnvironment = { random: () => number; now: () => number };
export const defaultInteractionEnvironment: InteractionEnvironment = { random: Math.random, now: Date.now };

export function interactionDefinitionIssues(definition: InteractionDefinition): string[] {
  const issues: string[] = [];
  const m = definition.mechanic;
  if (!definition.name.trim()) issues.push('Interaction requires a name');
  if (!definition.results.length) issues.push('Interaction requires results');
  if (new Set(definition.results.map(r => r.id)).size !== definition.results.length || definition.results.some(r => !r.id || !r.name.trim())) issues.push('Results require unique IDs and names');
  const dice = m.kind === 'dice' ? m : m.kind === 'skillcheck' ? m.dice : undefined;
  if (dice && (!Number.isSafeInteger(dice.count) || dice.count < 1 || dice.count > 100 || !Number.isSafeInteger(dice.sides) || dice.sides < 2 || dice.sides > 1000000)) issues.push('Dice require 1–100 dice with 2–1000000 sides');
  if ((m.kind === 'dice' || m.kind === 'skillcheck') && !Number.isFinite(m.modifier)) issues.push('Modifier must be finite');
  if (m.kind === 'skillcheck' && (!Number.isFinite(m.difficulty) || !m.skill || !['variable', 'property'].includes(m.skill.kind))) issues.push('Skillcheck requires a numeric skill source and finite difficulty');
  if (m.kind === 'qte' && (!m.key.trim() || !Number.isFinite(m.durationMs) || m.durationMs <= 0)) issues.push('QTE requires a key and a positive duration');
  if (!['dice', 'skillcheck', 'qte', 'custom'].includes(m.kind)) issues.push('Unsupported interaction mechanic');
  if (m.kind === 'skillcheck' || m.kind === 'qte') for (const key of m.kind === 'qte' ? ['success', 'failure', 'timeout'] : ['success', 'failure']) {
    if (definition.results.filter(r => r.key === key).length !== 1) issues.push(`Exactly one ${key} result is required`);
  }
  if (m.kind === 'dice') {
    const ranges = definition.results.map(r => r.range).filter((r): r is NonNullable<typeof r> => Boolean(r)).sort((a, b) => a.min - b.min);
    if (ranges.length !== definition.results.length || ranges.some(r => !Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min > r.max)) issues.push('Every dice result needs a finite inclusive range');
    if (ranges.some((r, i) => i > 0 && r.min <= ranges[i - 1].max)) issues.push('Dice result ranges overlap');
    // Cover the actual integer-roll lattice, including fractional modifiers.
    let covered = m.count - 1;
    for (const range of ranges) {
      const first = Math.max(m.count, Math.ceil(range.min - m.modifier));
      const last = Math.min(m.count * m.sides, Math.floor(range.max - m.modifier));
      if (last < first) continue;
      if (first > covered + 1) break;
      covered = Math.max(covered, last);
    }
    if (covered < m.count * m.sides) issues.push('Dice ranges must cover every possible total');
  }
  return issues;
}

export function resolveInteraction(project: BranchingProject, state: PlayerSimulationState, definition: InteractionDefinition, input: { resultId?: string; key?: string; timeout?: boolean; manual?: boolean }, environment = defaultInteractionEnvironment) {
  const issues = interactionDefinitionIssues(definition);
  if (issues.length) throw new Error(issues.join('; '));
  const m = definition.mechanic;
  if (input.manual && m.kind !== 'custom') throw new Error('Manual resolution is only available for custom interactions');
  let rolls: number[] | undefined, total: number | undefined;
  let result = input.resultId ? definition.results.find(r => r.id === input.resultId) : undefined;
  if (input.resultId && !result) throw new Error('Unknown interaction result');
  if (!input.resultId) {
    const dice = m.kind === 'dice' ? m : m.kind === 'skillcheck' ? m.dice : undefined;
    if (dice) rolls = Array.from({ length: dice.count }, () => {
      const random = environment.random();
      if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('Random source must return a number in [0, 1)');
      return Math.floor(random * dice.sides) + 1;
    });
    if (m.kind === 'dice' || m.kind === 'skillcheck') {
      total = (rolls ?? []).reduce((a, b) => a + b, 0) + m.modifier;
      if (m.kind === 'skillcheck') {
        const resolved = resolveConditionValue(m.skill.kind === 'variable'
          ? { type: 'value', subject: { kind: 'variable', variableId: m.skill.variableId }, operator: '>=' }
          : { type: 'property', subject: m.skill.subject, propertyId: m.skill.propertyId, operator: '>=' }, project, state);
        if (resolved.error || resolved.unresolved || typeof resolved.value !== 'number' || !Number.isFinite(resolved.value)) throw new Error(resolved.error ?? resolved.unresolved ?? 'Skill must resolve to a finite number');
        total += resolved.value;
        result = definition.results.find(r => r.key === (total! >= m.difficulty ? 'success' : 'failure'));
      } else result = definition.results.find(r => r.range && total! >= r.range.min && total! <= r.range.max);
    } else if (m.kind === 'qte') {
      if (!input.timeout && input.key === undefined) throw new Error('QTE waits for a key or timeout');
      result = definition.results.find(r => r.key === (input.timeout ? 'timeout' : input.key === m.key ? 'success' : 'failure'));
    } else throw new Error('Select a result for a custom interaction');
  }
  if (!result) throw new Error('No interaction result matches');
  return { result, total, rolls, forced: Boolean(input.resultId) && !input.manual };
}

export function interactionUsesFor(event: EventNode | undefined, nodeId: string, moment: InteractionUse['moment']) {
  return (event?.interactionUses ?? []).filter(use => use.ownerNodeId === nodeId && use.moment === moment);
}
