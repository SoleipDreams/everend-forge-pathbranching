import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDiceDistribution, difficultyProbability, previewDifficultyRoll, suggestDifficulty } from '../lib/interactionDifficulty.js';
import { resolveInteraction } from '../lib/interactions.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const d9 = { count: 1, sides: 2, groups: [{ id: 'binary', count: 1, sides: 2, minimum: 0 }, { id: 'quinary', count: 2, sides: 5, minimum: 0 }] };
function enumerate(groups) {
  let totals = [0];
  for (const group of groups) for (let count = 0; count < group.count; count++) totals = totals.flatMap(total => Array.from({ length: group.sides }, (_, face) => total + (group.minimum ?? 1) + face));
  return totals;
}
test('exact probabilities match exhaustive outcomes for mixed, shifted, zero-based and homogeneous dice', () => {
  const pools = [d9, { count: 2, sides: 6 }, { count: 1, sides: 20 }, { count: 1, sides: 100 }, { count: 1, sides: 4, minimum: 5 },
    { count: 1, sides: 3, groups: [{ id: 'a', count: 2, sides: 3, minimum: 2 }, { id: 'b', count: 1, sides: 4, minimum: 0 }] }];
  for (const pool of pools) {
    const groups = pool.groups ?? [pool], totals = enumerate(groups), distribution = buildDiceDistribution(pool);
    assert.equal(distribution.exact, true);
    close(distribution.mean, totals.reduce((sum, total) => sum + total, 0) / totals.length);
    for (let difficulty = distribution.min - 2; difficulty <= distribution.max + 2; difficulty += 0.5) for (const bonus of [-3, 0, 2.5]) for (const operator of ['>=', '>']) {
      const expected = totals.filter(raw => operator === '>' ? raw + bonus > difficulty : raw + bonus >= difficulty).length / totals.length;
      const probability = difficultyProbability(distribution, difficulty, bonus, operator);
      close(probability.lower, expected); close(probability.upper, expected);
    }
  }
  close(buildDiceDistribution(d9).atLeast(5).estimate, 0.5);
  close(buildDiceDistribution({ count: 2, sides: 6 }).atLeast(7).estimate, 21 / 36);
  assert.deepEqual([0.75, 0.5, 0.25].map(chance => suggestDifficulty(buildDiceDistribution(d9), chance, 0, '>=')), [3, 5, 6]);
});
test('single large dice are exact, comparisons retain decimal bonuses and suggestions use the active operator', () => {
  const distribution = buildDiceDistribution({ count: 1, sides: 1000000, minimum: 0 });
  assert.equal(distribution.exact, true);
  close(distribution.atLeast(500000).estimate, 0.5);
  assert.throws(() => difficultyProbability(distribution, Infinity, 0, '>='));
  assert.throws(() => difficultyProbability(distribution, 10, NaN, '>='));
  const d20 = buildDiceDistribution({ count: 1, sides: 20 });
  for (const chance of [0.75, 0.5, 0.25]) for (const bonus of [-2, 0, 2.5]) {
    const inclusive = suggestDifficulty(d20, chance, bonus, '>='), strict = suggestDifficulty(d20, chance, bonus, '>');
    assert.equal(strict, inclusive - 1);
    close(difficultyProbability(d20, inclusive, bonus, '>=').estimate, chance);
    close(difficultyProbability(d20, strict, bonus, '>').estimate, chance);
  }
});
test('large mixed pools produce bounds containing the exact triangular probability', () => {
  const sides = 40000, distribution = buildDiceDistribution({ count: 2, sides });
  assert.equal(distribution.exact, false);
  const cdf = total => total < 2 ? 0 : total >= sides * 2 ? 1 : total <= sides + 1 ? total * (total - 1) / (2 * sides * sides) : 1 - (2 * sides - total) * (2 * sides - total + 1) / (2 * sides * sides);
  for (const threshold of [2, 3, 12345, 30000, 40000, 40001, 65000, 79999, 80000, 80001]) {
    const exact = 1 - cdf(threshold - 1), probability = distribution.atLeast(threshold);
    assert.ok(probability.lower <= exact + 1e-10 && probability.upper >= exact - 1e-10);
    assert.ok(probability.upper - probability.lower < 0.0001);
  }
  const huge = buildDiceDistribution({ count: 100, sides: 1000000 });
  assert.equal(huge.exact, false);
  assert.deepEqual(huge.atLeast(100), { lower: 1, upper: 1, estimate: 1 });
  assert.deepEqual(huge.atLeast(100000001), { lower: 0, upper: 0, estimate: 0 });
  const middle = huge.atLeast(huge.mean);
  assert.ok(middle.lower < 0.5 && middle.upper > 0.5);
  assert.ok(middle.upper - middle.lower < 0.03);
});
test('invalid pools do not create a plausible difficulty estimate', () => {
  for (const pool of [{ count: 0, sides: 20 }, { count: 101, sides: 20 }, { count: 1, sides: 1 }, { count: 1, sides: 20, groups: [] }, { count: 2, sides: 20, minimum: Number.MAX_SAFE_INTEGER - 20 }]) assert.throws(() => buildDiceDistribution(pool));
});
test('attribute and conditional bonuses match runtime, and unresolved context never silently becomes zero', () => {
  const project = { projectId: 'difficulty', events: [], canonRefs: [], localExplorerEntities: [{ id: 'hero', name: 'Hero', typeId: 'character', properties: { strength: 3 } }],
    localExplorerProperties: [{ id: 'strength', label: 'Strength', valueType: 'number' }], logicPropertyOverrides: [{ source: 'local', propertyId: 'strength', conditionReadable: true }],
    logicVariables: [{ id: 'bonus-active', name: 'Bonus active', type: 'number', value: 0 }] };
  const mechanic = { kind: 'skillcheck', actor: { kind: 'entity', entityId: 'hero' }, skill: { kind: 'property', subject: { kind: 'context', role: 'actor' }, propertyId: 'strength' }, dice: { count: 1, sides: 20 }, modifier: -1, difficulty: 14,
    modifierRules: [{ id: 'bonus', name: 'Bonus', modifier: 2, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'bonus-active' }, operator: '>=', value: 1 } }] };
  for (const active of [0, 1]) {
    const state = { context: { actor: mechanic.actor }, variables: { 'bonus-active': active } }, before = JSON.stringify([project, state]);
    const preview = previewDifficultyRoll(project, state, mechanic);
    assert.equal(preview.ready, true);
    assert.equal(preview.skillValue, 3); assert.equal(preview.fixedModifier, -1); assert.equal(preview.conditionalModifier, active ? 2 : 0);
    const definition = { id: 'test', name: 'Test', mechanic, results: [{ id: 'success', key: 'success', name: 'Success' }, { id: 'failure', key: 'failure', name: 'Failure' }] };
    let successes = 0;
    for (let face = 1; face <= 20; face++) successes += resolveInteraction(project, state, definition, {}, { random: () => (face - 0.5) / 20, now: () => 0 }).result.key === 'success' ? 1 : 0;
    close(difficultyProbability(buildDiceDistribution(mechanic.dice), mechanic.difficulty, preview.bonus, '>=').estimate, successes / 20);
    assert.equal(JSON.stringify([project, state]), before);
  }
  assert.equal(previewDifficultyRoll(project, {}, mechanic).ready, false);
  assert.equal(previewDifficultyRoll(project, {}, { ...mechanic, skill: undefined, modifierRules: [{ id: 'missing-condition', name: 'Incomplete', modifier: 2 }] }).ready, false);
});
