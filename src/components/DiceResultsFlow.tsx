import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { InteractionMechanic, InteractionResult } from '../domain.js';
import '../diceResultsFlow.css';
import { ConditionPickerIcon } from './ConditionReferencePicker.js';
import { NumericResultIntervals } from './NumericResultIntervals.js';
import { diceBounds, diceFormula, dicePoolIssues, diceGroups, diceGroupFormula } from '../interactionDice.js';

type Dice = Extract<InteractionMechanic, { kind: 'dice' }>;
type Props = { mechanic: Dice; results: InteractionResult[]; configuration: ReactNode; source?: ReactNode; locale: 'es' | 'en'; onChange: (results: InteractionResult[]) => void; onAdd: () => void; renderResult: (result: InteractionResult) => ReactNode };

export function DiceResultsFlow({ mechanic, results, configuration, source, locale, onChange, onAdd, renderResult }: Props) {
  const es = locale === 'es';
  const [selectedId, setSelectedId] = useState(results[0]?.id), [configOpen, setConfigOpen] = useState(false);
  const previousIds = useRef(results.map(result => result.id));
  const identities = JSON.stringify(results.map(result => result.id));
  useEffect(() => {
    const added = results.find(result => !previousIds.current.includes(result.id));
    if (added) setSelectedId(added.id);
    else if (!results.some(result => result.id === selectedId)) setSelectedId(results[0]?.id);
    previousIds.current = results.map(result => result.id);
  }, [identities, selectedId]);
  const selected = results.find(result => result.id === selectedId) ?? results[0];
  const validDice = !dicePoolIssues(mechanic).length;
  const raw = validDice ? diceBounds(mechanic) : { min: NaN, max: NaN };
  const baseMin = validDice ? diceBounds(mechanic, mechanic.modifier).min : NaN;
  const baseMax = validDice ? diceBounds(mechanic, mechanic.modifier).max : NaN;
  const validDomain = validDice && Number.isSafeInteger(baseMin) && Number.isSafeInteger(baseMax) && baseMin <= baseMax;

  return <section className="dice-results-flow" aria-label={es ? 'Flujo de resultados del dado' : 'Dice result flow'}>
    {source ?? <div className="dice-flow-source"><button type="button" className={`dice-flow-symbol${configOpen ? ' active' : ''}`} aria-label={es ? 'Configurar dado' : 'Configure dice'} aria-expanded={configOpen} onClick={() => setConfigOpen(open => !open)}><ConditionPickerIcon name="D20" size={32} /><strong>{diceFormula(mechanic, mechanic.modifier)}</strong></button><small>{es ? 'Configurar dado' : 'Configure dice'}</small></div>}
    {configuration && (source || configOpen) ? <section className="dice-flow-configuration" aria-label={es ? 'Configuración del dado' : 'Dice configuration'}>{configuration}</section> : null}
    {validDomain ? <NumericResultIntervals results={results} min={baseMin} max={baseMax} locale={locale} selectedId={selected?.id} onSelect={setSelectedId} onChange={onChange} /> : <p role="status">{es ? 'Configura un dado válido para visualizar los intervalos.' : 'Configure valid dice to visualize intervals.'}</p>}
    {validDice ? <div className="dice-flow-raw-domain"><strong>{es ? 'Dominio bruto del dado' : 'Raw dice domain'}</strong><span>{diceGroups(mechanic).map(diceGroupFormula).join(' + ')}</span><b>{raw.min}–{raw.max}</b></div> : null}
    <button type="button" className="dice-flow-add" onClick={onAdd}><Plus size={16} />{es ? 'Añadir resultado' : 'Add result'}</button>
    {selected ? <div className="dice-flow-result-editor" key={selected.id}>{renderResult(selected)}</div> : <p>{es ? 'Añade un resultado para configurar su intervalo.' : 'Add a result to configure its interval.'}</p>}
  </section>;
}
