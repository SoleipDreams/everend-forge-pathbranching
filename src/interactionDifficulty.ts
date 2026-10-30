import type { BranchingProject, InteractionDice, InteractionMechanic, PlayerSimulationState } from './domain.js';
import { diceBounds, diceGroups, dicePoolIssues } from './interactionDice.js';
import { freezeInteractionRoll } from './interactions.js';

export type ProbabilityBounds = { lower: number; upper: number; estimate: number };
export type DiceDistribution = {
  min: number; max: number; mean: number; exact: boolean;
  atLeast: (rawTotal: number) => ProbabilityBounds;
  threshold: (successProbability: number) => number;
};
const MAX_BINS = 65536;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const point = (value: number): ProbabilityBounds => ({ lower: value, upper: value, estimate: value });

/** Convolve independent uniform dice, including mixed groups and shifted face ranges.
 * Large pools use weighted integer buckets. Each omitted remainder is bounded,
 * giving deterministic probability bounds rather than assuming a normal curve.
 * This never rolls dice or consumes the runtime random source.
 */
export function buildDiceDistribution(dice: InteractionDice): DiceDistribution {
  const issues = dicePoolIssues(dice);
  if (issues.length) throw new Error(issues.join('; '));
  const groups = diceGroups(dice), { min, max } = diceBounds(dice);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) throw new Error('Dice total exceeds the safe integer range');
  const widths = groups.flatMap(group => Array.from({ length: group.count }, () => group.sides - 1)).sort((a, b) => a - b);
  const width = max - min, mean = min + width / 2;
  if (widths.length === 1) return {
    min, max, mean, exact: true,
    atLeast: raw => point(clamp((max - Math.ceil(raw) + 1) / (width + 1))),
    threshold: probability => min + Math.floor((1 - clamp(probability)) * (width + 1)),
  };
  const step = Math.max(1, Math.ceil(width / MAX_BINS));
  let probabilities = new Float64Array([1]), remainderMax = 0, remainderMean = 0;
  for (const dieWidth of widths) {
    const sides = dieWidth + 1, lastBucket = Math.floor(dieWidth / step), lastWeight = sides - lastBucket * step;
    remainderMax += Math.min(dieWidth, step - 1);
    const bucketMean = (step * lastBucket * (lastBucket - 1) / 2 + lastBucket * lastWeight) / sides;
    remainderMean += dieWidth / 2 - step * bucketMean;
    if (!lastBucket) continue;
    const next = new Float64Array(probabilities.length + lastBucket);
    let window = 0, mass = 0;
    for (let total = 0; total < next.length; total++) {
      window += probabilities[total] ?? 0;
      const last = probabilities[total - lastBucket] ?? 0;
      window -= last;
      next[total] = Math.max(0, window * step / sides + last * lastWeight / sides);
      mass += next[total];
    }
    for (let total = 0; total < next.length; total++) next[total] /= mass;
    probabilities = next;
  }
  const tails = new Float64Array(probabilities.length + 1);
  for (let i = probabilities.length - 1; i >= 0; i--) tails[i] = clamp(tails[i + 1] + probabilities[i]);
  const tail = (bucket: number) => bucket <= 0 ? 1 : bucket >= tails.length ? 0 : tails[bucket];
  return {
    min, max, mean, exact: step === 1,
    atLeast: raw => {
      const required = Math.ceil(raw) - min;
      if (required <= 0) return point(1);
      if (required > width) return point(0);
      const lower = tail(Math.ceil(required / step));
      const upper = tail(Math.ceil((required - remainderMax) / step));
      return { lower, upper, estimate: (lower + upper) / 2 };
    },
    threshold: probability => {
      const target = clamp(probability);
      if (target === 1) return min;
      if (target === 0) return max + 1;
      let low = 0, high = probabilities.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (tail(middle + 1) > target) low = middle + 1;
        else high = middle;
      }
      return min + Math.round(low * step + remainderMean) + 1;
    },
  };
}

export type DifficultyRoll = ReturnType<typeof previewDifficultyRoll>;
/** Use the same attribute and conditional-modifier resolver as actual execution. */
export function previewDifficultyRoll(project: BranchingProject, state: PlayerSimulationState, mechanic: Extract<InteractionMechanic, { kind: 'skillcheck' }>) {
  try {
    if (!Number.isFinite(mechanic.modifier)) throw new Error('Invalid modifier');
    const roll = freezeInteractionRoll(project, state, { id: 'difficulty-preview', name: '', mechanic, results: [] })!;
    const bonus = roll.skillValue + roll.modifier;
    if (!Number.isFinite(bonus)) throw new Error('Invalid roll bonus');
    return { ready: true as const, ...roll, bonus, fixedModifier: mechanic.modifier, conditionalModifier: roll.modifier - mechanic.modifier };
  } catch {
    return { ready: false as const };
  }
}

export function difficultyProbability(distribution: DiceDistribution, difficulty: number, bonus: number, operator: '>=' | '>'): ProbabilityBounds {
  if (!Number.isFinite(difficulty) || !Number.isFinite(bonus)) throw new Error('Difficulty and bonus must be finite');
  const raw = difficulty - bonus;
  return distribution.atLeast(operator === '>' ? Math.floor(raw) + 1 : Math.ceil(raw));
}
export function suggestDifficulty(distribution: DiceDistribution, probability: number, bonus: number, operator: '>=' | '>') {
  const candidate = distribution.threshold(probability);
  const previous = Math.max(distribution.min, candidate - 1);
  const threshold = Math.abs(distribution.atLeast(previous).estimate - probability) <= Math.abs(distribution.atLeast(candidate).estimate - probability) + 1e-12 ? previous : candidate;
  return threshold + bonus - (operator === '>' ? 1 : 0);
}
