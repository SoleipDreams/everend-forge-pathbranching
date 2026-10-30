import { useMemo } from 'react';
import { Calculator, SlidersHorizontal } from 'lucide-react';
import type { InteractionDice } from '../domain.js';
import { buildDiceDistribution, difficultyProbability, suggestDifficulty, type DifficultyRoll, type ProbabilityBounds } from '../interactionDifficulty.js';
import '../interactionDifficulty.css';

function probabilityLabel(value: number, locale: 'es' | 'en') {
  const format = (number: number) => number.toLocaleString(locale, { maximumFractionDigits: 1 });
  return value > 0 && value < 0.001 ? `< ${format(0.1)} %` : value < 1 && value > 0.999 ? `> ${format(99.9)} %` : `${format(value * 100)} %`;
}
function probabilityText(probability: ProbabilityBounds, locale: 'es' | 'en', exact: boolean) {
  return exact || probability.lower === probability.upper ? probabilityLabel(probability.estimate, locale)
    : `${probabilityLabel(probability.lower, locale)} – ${probabilityLabel(probability.upper, locale)}`;
}
export function InteractionDifficultyGuide({ dice, difficulty, operator, roll, locale, onChoose }: {
  dice?: InteractionDice; difficulty: number; operator: '>=' | '>'; roll: DifficultyRoll; locale: 'es' | 'en'; onChoose: (difficulty: number) => void;
}) {
  const es = locale === 'es', key = JSON.stringify(dice);
  const distribution = useMemo(() => { try { return dice ? buildDiceDistribution(dice) : undefined; } catch { return undefined; } }, [key]);
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const signed = (value: number) => `${value >= 0 ? '+' : '−'}${number(Math.abs(value))}`;
  const symbol = operator === '>' ? '>' : '≥';
  const probability = distribution && roll.ready && Number.isFinite(difficulty) ? difficultyProbability(distribution, difficulty, roll.bonus, operator) : undefined;
  const required = roll.ready ? operator === '>' ? Math.floor(difficulty - roll.bonus) + 1 : Math.ceil(difficulty - roll.bonus) : undefined;
  const guaranteed = distribution && required !== undefined && required <= distribution.min;
  const impossible = distribution && required !== undefined && required > distribution.max;
  const chanceText = probability ? !guaranteed && probability.estimate === 1 ? `> ${probabilityLabel(0.999, locale)}` : !impossible && probability.estimate === 0 ? `< ${probabilityLabel(0.001, locale)}` : probabilityText(probability, locale, distribution?.exact ?? false) : '';
  const level = !probability ? '' : impossible ? es ? 'Imposible' : 'Impossible' : guaranteed ? es ? 'Garantizada' : 'Guaranteed'
    : probability.estimate >= 0.9 ? es ? 'Muy fácil' : 'Very easy' : probability.estimate >= 0.7 ? es ? 'Fácil' : 'Easy'
      : probability.estimate >= 0.4 ? es ? 'Equilibrada' : 'Balanced' : probability.estimate >= 0.2 ? es ? 'Difícil' : 'Hard' : es ? 'Muy difícil' : 'Very hard';
  return <section className="interaction-difficulty-guide" aria-label={es ? 'Calculador de dificultad' : 'Difficulty calculator'}>
    <header><Calculator size={17} aria-hidden="true" /><div><strong>{es ? 'Calculador de dificultad' : 'Difficulty calculator'}</strong><small>{es ? 'Orientación para el perfil de prueba actual' : 'Guidance for the current test profile'}</small></div></header>
    {probability && distribution && roll.ready ? <>
      <div className="interaction-difficulty-chance" aria-live="polite"><strong>{chanceText}</strong><span>{level}</span><small>{es ? 'Probabilidad de cumplir el umbral' : 'Probability of meeting the threshold'}</small></div>
      <div className="interaction-difficulty-meter" role="meter" aria-label={es ? 'Probabilidad de cumplir el umbral' : 'Probability of meeting the threshold'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={probability.estimate * 100} aria-valuetext={chanceText}><span style={{ width: `${probability.estimate * 100}%` }} /></div>
      <dl className="interaction-difficulty-summary"><div><dt>{es ? 'Total posible' : 'Possible total'}</dt><dd>{number(distribution.min + roll.bonus)}–{number(distribution.max + roll.bonus)}</dd></div><div><dt>{es ? 'Media esperada' : 'Expected average'}</dt><dd>{number(distribution.mean + roll.bonus)}</dd></div></dl>
      <div className="interaction-difficulty-bonuses"><span>{es ? 'Atributo' : 'Attribute'} <b>{signed(roll.skillValue)}</b></span><span>{es ? 'Fijo' : 'Fixed'} <b>{signed(roll.fixedModifier)}</b></span><span title={roll.modifierBreakdown.map(item => `${item.name}: ${signed(item.modifier)}`).join(' · ')}>{es ? 'Condicionales' : 'Conditional'} <b>{signed(roll.conditionalModifier)}</b></span></div>
      <p className="interaction-difficulty-explanation">{impossible ? es ? 'Ni el máximo total cumple la comparación. Reduce la dificultad o revisa los bonos.' : 'Even the maximum total cannot meet the comparison. Lower the difficulty or review the bonuses.' : guaranteed ? es ? 'Incluso el mínimo total cumple la comparación.' : 'Even the minimum total meets the comparison.' : es ? `Los dados deben sumar ${number(Math.max(distribution.min, operator === '>' ? Math.floor(difficulty - roll.bonus) + 1 : Math.ceil(difficulty - roll.bonus)))} o más antes de los bonos.` : `The dice must total at least ${number(Math.max(distribution.min, operator === '>' ? Math.floor(difficulty - roll.bonus) + 1 : Math.ceil(difficulty - roll.bonus)))} before bonuses.`}</p>
      {!distribution.exact ? <small className="interaction-difficulty-note">{es ? 'Estimación acotada para este rango de dados.' : 'Bounded estimate for this dice range.'}</small> : null}
      <div className="interaction-difficulty-suggestions"><strong><SlidersHorizontal size={14} aria-hidden="true" />{es ? 'Dificultades orientativas' : 'Suggested difficulties'}</strong><div>{[
        { chance: 0.75, label: es ? 'Fácil' : 'Easy' }, { chance: 0.5, label: es ? 'Equilibrada' : 'Balanced' }, { chance: 0.25, label: es ? 'Difícil' : 'Hard' },
      ].map(item => {
        const value = suggestDifficulty(distribution, item.chance, roll.bonus, operator);
        const chance = difficultyProbability(distribution, value, roll.bonus, operator);
        return <button key={item.chance} type="button" aria-label={`${es ? 'Usar dificultad' : 'Use difficulty'} ${symbol} ${number(value)} · ${item.label}`} title={es ? 'Aplicar esta dificultad' : 'Apply this difficulty'} onClick={() => onChoose(value)}><span>{item.label}</span><b>{symbol} {number(value)}</b><small>{probabilityText(chance, locale, distribution.exact)}</small></button>;
      })}</div></div>
      <small className="interaction-difficulty-note">{es ? 'Los atributos y las condiciones pueden cambiar durante la historia.' : 'Attributes and conditions may change during the story.'}</small>
    </> : <p className="interaction-difficulty-explanation">{!distribution ? es ? 'Elige un perfil de dados válido para calcular la dificultad.' : 'Choose a valid dice profile to calculate difficulty.' : es ? 'Completa el atributo y las condiciones de los modificadores para calcular con el perfil de prueba actual.' : 'Complete the attribute and modifier conditions to calculate with the current test profile.'}</p>}
  </section>;
}
