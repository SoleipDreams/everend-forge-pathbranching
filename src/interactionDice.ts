import type { BranchingProject, InteractionDice, InteractionDiceGroup, InteractionMechanic, InteractionMechanicPreset } from './domain.js';

export function diceGroups(dice: InteractionDice): InteractionDiceGroup[] {
  return dice.groups === undefined ? [{ id: 'dice', count: dice.count, sides: dice.sides, ...(dice.minimum !== undefined ? { minimum: dice.minimum } : {}) }]
    : Array.isArray(dice.groups) ? dice.groups.filter(group => group && typeof group === 'object') : [];
}
export function diceBounds(dice: InteractionDice, modifier = 0) {
  return diceGroups(dice).reduce((range, group) => {
    const minimum = group.minimum ?? 1;
    return { min: range.min + group.count * minimum, max: range.max + group.count * (minimum + group.sides - 1) };
  }, { min: modifier, max: modifier });
}
export function diceFaceLabel(group: Pick<InteractionDiceGroup, 'sides' | 'minimum'>) {
  const minimum = group.minimum ?? 1;
  return minimum === 1 ? `D${group.sides}` : `D[${minimum}–${minimum + group.sides - 1}]`;
}
export function diceGroupFormula(group: Pick<InteractionDiceGroup, 'count' | 'sides' | 'minimum'>) {
  return `${group.count}${diceFaceLabel(group)}`;
}
export function diceFormula(dice: InteractionDice, modifier = 0) {
  return diceGroups(dice).map(diceGroupFormula).join(' + ') + (modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : '');
}
export function dicePoolIssues(dice?: InteractionDice): string[] {
  if (!dice) return [];
  if (dice.groups !== undefined && (!Array.isArray(dice.groups) || !dice.groups.length || dice.groups.length > 100)) return ['Dice groups must contain 1–100 groups'];
  if (dice.groups?.some(group => !group || typeof group !== 'object')) return ['Invalid dice group'];
  const groups = diceGroups(dice);
  if (groups.some(group => !group || !Number.isSafeInteger(group.count) || group.count < 1 || !Number.isSafeInteger(group.sides) || group.sides < 2 || group.sides > 1000000 || group.minimum !== undefined && (!Number.isSafeInteger(group.minimum) || group.minimum < 0 || !Number.isSafeInteger(group.minimum + group.sides - 1))) || dice.minimum !== undefined && (!Number.isSafeInteger(dice.minimum) || dice.minimum < 0 || !Number.isSafeInteger(dice.minimum + dice.sides - 1)) || groups.reduce((sum, group) => sum + (group?.count ?? 0), 0) > 100) return ['Dice require 1–100 dice with 2–1000000 sides and a non-negative, safe face range'];
  if (dice.groups && (groups.some(group => !group.id) || new Set(groups.map(group => group.id)).size !== groups.length)) return ['Dice groups require unique stable IDs'];
  return [];
}
export function rollDice(dice: InteractionDice, random: () => number) {
  const issues = dicePoolIssues(dice);
  if (issues.length) throw new Error(issues.join('; '));
  return diceGroups(dice).flatMap(group => Array.from({ length: group.count }, () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random source must return a number in [0, 1)');
    return Math.floor(value * group.sides) + (group.minimum ?? 1);
  }));
}
export function diceUsesZeroBasedFaces(dice?: InteractionDice) {
  return Boolean(dice && (dice.minimum !== undefined && dice.minimum !== 1 || dice.groups?.some(group => group.minimum !== undefined && group.minimum !== 1)));
}
export const hasCompoundDice = (project: BranchingProject) => project.events.some(event => event.interactionUses?.some(use => event.interactionDefinitions?.some(definition => {
  if (definition.id !== use.definitionId) return false;
  const mechanic = definition.mechanic;
  if (mechanic.kind === 'dice') return (mechanic.groups?.length ?? 0) > 1;
  if (mechanic.kind === 'skillcheck') return (mechanic.dice?.groups?.length ?? 0) > 1;
  if (mechanic.kind === 'opposedcheck') return Boolean((mechanic.commonDice?.groups?.length ?? 0) > 1 || [mechanic.actor, ...mechanic.rivals].some(participant => (participant.dice?.groups?.length ?? 0) > 1));
  return false;
})));

/** New dice semantics are advertised only when a saved use needs the contextual runtime contract. */
export function interactionDefinitionUsesContextualDice(definition: import('./domain.js').InteractionDefinition): boolean {
  const mechanic = definition.mechanic;
  const diceBased = mechanic.kind === 'dice' || mechanic.kind === 'skillcheck' || mechanic.kind === 'opposedcheck';
  if (!diceBased) return false;
  const zeroBased = mechanic.kind === 'dice' ? diceUsesZeroBasedFaces(mechanic)
    : mechanic.kind === 'skillcheck' ? diceUsesZeroBasedFaces(mechanic.dice)
      : diceUsesZeroBasedFaces(mechanic.commonDice) || [mechanic.actor, ...mechanic.rivals].some(participant => diceUsesZeroBasedFaces(participant.dice));
  if (zeroBased) return true;
  const openOrExclusive = mechanic.kind !== 'opposedcheck' && definition.results.some(result => result.range && (
    result.range.min === undefined || result.range.max === undefined || result.range.minInclusive === false || result.range.maxInclusive === false
  ));
  if (openOrExclusive) return true;
  if (mechanic.kind === 'dice') return Boolean(mechanic.actor || mechanic.skill || mechanic.modifierRules?.length || mechanic.dicePresetId);
  if (mechanic.kind === 'skillcheck') return Boolean(mechanic.difficultyOperator === '>' || !mechanic.skill || mechanic.actor || mechanic.modifierRules?.length || mechanic.dicePresetId);
  if (mechanic.kind === 'opposedcheck') return Boolean(mechanic.commonDice?.groups || mechanic.commonDicePresetId || [mechanic.actor, ...mechanic.rivals].some(participant => participant.dice?.groups || participant.dicePresetId || participant.modifierRules?.length));
  return false;
}
export const hasContextualDice = (project: BranchingProject) => project.events.some(event => event.interactionUses?.some(use => event.interactionDefinitions?.some(definition => definition.id === use.definitionId && interactionDefinitionUsesContextualDice(definition))));

export function interactionPresetKind(preset: Pick<InteractionMechanicPreset, 'presetKind' | 'mechanic' | 'results'>): 'dice' | 'recipe' {
  if (preset.presetKind) return preset.presetKind;
  const mechanic = preset.mechanic;
  if (mechanic.kind !== 'dice' || mechanic.skill || mechanic.actor || mechanic.modifierRules?.length) return 'recipe';
  const range = preset.results[0]?.range as { min?: number; max?: number } | undefined;
  const bounds = diceBounds(mechanic, 0);
  const pure = (mechanic.modifier ?? 0) === 0 && preset.results.length === 1 && !preset.results[0]?.key && range?.min === bounds.min && range?.max === bounds.max;
  return pure ? 'dice' : 'recipe';
}

export function dicePoolFromPreset(preset: { mechanic: { kind: string; count?: number; sides?: number; minimum?: number; groups?: InteractionDiceGroupLike[] } }): InteractionDice | undefined {
  if (preset.mechanic.kind !== 'dice' || !preset.mechanic.count || !preset.mechanic.sides) return undefined;
  return { count: preset.mechanic.count, sides: preset.mechanic.sides, ...('minimum' in preset.mechanic && preset.mechanic.minimum !== undefined ? { minimum: preset.mechanic.minimum } : {}), ...(preset.mechanic.groups ? { groups: structuredClone(preset.mechanic.groups) } : {}) };
}
type InteractionDiceGroupLike = { id: string; count: number; sides: number; minimum?: number };

/** The reusable set associated with an interaction, without its local resolution settings. */
export function dicePoolForMechanic(mechanic: InteractionMechanic): { dice: InteractionDice; presetId?: string } | undefined {
  if (mechanic.kind === 'dice') return { dice: { count: mechanic.count, sides: mechanic.sides, ...(mechanic.minimum !== undefined ? { minimum: mechanic.minimum } : {}), ...(mechanic.groups ? { groups: structuredClone(mechanic.groups) } : {}) }, presetId: mechanic.dicePresetId };
  if (mechanic.kind === 'skillcheck') return mechanic.dice ? { dice: structuredClone(mechanic.dice), presetId: mechanic.dicePresetId } : undefined;
  if (mechanic.kind === 'opposedcheck') {
    if (mechanic.commonDice) return { dice: structuredClone(mechanic.commonDice), presetId: mechanic.commonDicePresetId };
    const participant = [mechanic.actor, ...mechanic.rivals].find(item => item.dice);
    return participant?.dice ? { dice: structuredClone(participant.dice), presetId: participant.dicePresetId } : undefined;
  }
  return undefined;
}
