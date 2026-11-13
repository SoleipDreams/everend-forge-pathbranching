import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutGrid, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { InteractionMechanic, InteractionResult } from '../domain.js';
import '../diceResultsFlow.css';
import { ConditionPickerIcon } from './ConditionReferencePicker.js';
import { NumericResultIntervals } from './NumericResultIntervals.js';
import { diceBounds, diceFormula, dicePoolIssues } from '../interactionDice.js';
import '../interactionResultsFlow.css';

type Dice = Extract<InteractionMechanic, { kind: 'dice' }>;
type Props = { mechanic: Dice; results: InteractionResult[]; configuration: ReactNode; source?: ReactNode; locale: 'es' | 'en'; onChange: (results: InteractionResult[]) => void; onAdd: (insertAt?: number) => void; onDelete: (resultId: string) => void; renderResult: (result: InteractionResult) => ReactNode };

export function DiceResultsFlow({ mechanic, results, configuration, source, locale, onChange, onAdd, onDelete, renderResult }: Props) {
  const es = locale === 'es';
  const [selectedId, setSelectedId] = useState(results[0]?.id), [configOpen, setConfigOpen] = useState(false);
  const [rangeEditorMode, setRangeEditorMode] = useState<'slider' | 'cards'>('slider');
  const [boundDrafts, setBoundDrafts] = useState<Record<string, string>>({});
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
  const baseMin = validDice ? diceBounds(mechanic, mechanic.modifier).min : NaN;
  const baseMax = validDice ? diceBounds(mechanic, mechanic.modifier).max : NaN;
  const validDomain = validDice && Number.isSafeInteger(baseMin) && Number.isSafeInteger(baseMax) && baseMin <= baseMax;
  const updateResult = (resultId: string, update: (result: InteractionResult) => InteractionResult) => onChange(results.map(result => result.id === resultId ? update(result) : result));
  const updateBound = (result: InteractionResult, bound: 'min' | 'max', raw: string) => {
    if (raw.trim() === '') return;
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) return;
    const range = { ...result.range };
    const opposite = bound === 'min' ? range.max ?? baseMax : range.min ?? baseMin;
    range[bound] = Number.isFinite(opposite) ? bound === 'min' ? Math.min(value, opposite) : Math.max(value, opposite) : value;
    range[bound === 'min' ? 'minInclusive' : 'maxInclusive'] ??= true;
    updateResult(result.id, current => ({ ...current, range }));
  };
  const updateInclusive = (result: InteractionResult, bound: 'min' | 'max', value: boolean) => {
    const range = { ...result.range, [bound === 'min' ? 'minInclusive' : 'maxInclusive']: value };
    updateResult(result.id, current => ({ ...current, range }));
  };
  const letter = (index: number) => index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
  const rangeLabel = (result: InteractionResult) => {
    const min = result.range?.min ?? baseMin, max = result.range?.max ?? baseMax;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return es ? 'Límites no disponibles' : 'Bounds unavailable';
    const minInclusive = result.range?.minInclusive !== false, maxInclusive = result.range?.maxInclusive !== false;
    return `${minInclusive ? '≥' : '>'} ${min} · ${maxInclusive ? '≤' : '<'} ${max}`;
  };
  const insertSlot = (insertAt: number, key: string) => {
    const previous = results[insertAt - 1], next = results[insertAt];
    const label = previous && next
      ? es ? `Añadir resultado entre ${previous.name} y ${next.name}` : `Add a result between ${previous.name} and ${next.name}`
      : next
        ? es ? `Añadir resultado antes de ${next.name}` : `Add a result before ${next.name}`
        : previous
          ? es ? `Añadir resultado después de ${previous.name}` : `Add a result after ${previous.name}`
          : es ? 'Añadir resultado' : 'Add a result';
    return <div className="interaction-flow-insert-slot" key={key}>
      <button type="button" className="interaction-flow-insert" aria-label={label} title={es ? 'Añadir resultado' : 'Add result'} onClick={() => onAdd(insertAt)}><Plus size={15} /></button>
    </div>;
  };

  return <section className="dice-results-flow" aria-label={es ? 'Flujo de resultados del dado' : 'Dice result flow'}>
    {source ?? <div className="dice-flow-source"><button type="button" className={`dice-flow-symbol${configOpen ? ' active' : ''}`} aria-label={es ? 'Configurar dado' : 'Configure dice'} aria-expanded={configOpen} onClick={() => setConfigOpen(open => !open)}><ConditionPickerIcon name="D20" size={32} /><strong>{diceFormula(mechanic, mechanic.modifier)}</strong></button><small>{es ? 'Configurar dado' : 'Configure dice'}</small></div>}
    {configuration && (source || configOpen) ? <section className="dice-flow-configuration" aria-label={es ? 'Configuración del dado' : 'Dice configuration'}>{configuration}</section> : null}
    <div className="dice-flow-range-editor">
      <div className="interaction-flow-range-mode" role="group" aria-label={es ? 'Modo para editar intervalos' : 'Interval editing mode'}>
        <span>{es ? 'Editar límites con' : 'Edit bounds with'}</span>
        <button type="button" className={rangeEditorMode === 'slider' ? 'selected' : ''} aria-pressed={rangeEditorMode === 'slider'} onClick={() => setRangeEditorMode('slider')}><SlidersHorizontal size={14} />Slider</button>
        <button type="button" className={rangeEditorMode === 'cards' ? 'selected' : ''} aria-pressed={rangeEditorMode === 'cards'} onClick={() => setRangeEditorMode('cards')}><LayoutGrid size={14} />{es ? 'Tarjetas' : 'Cards'}</button>
      </div>
      {rangeEditorMode === 'slider'
        ? validDomain
          ? <NumericResultIntervals results={results} min={baseMin} max={baseMax} locale={locale} selectedId={selected?.id} onSelect={setSelectedId} onChange={onChange} onDelete={onDelete} onRename={(id, name) => updateResult(id, result => ({ ...result, name }))} />
          : <p role="status">{es ? 'Configura un dado válido para visualizar los intervalos.' : 'Configure valid dice to visualize intervals.'}</p>
        : <div className="interaction-flow-result-choices" role="group" aria-label={es ? 'Opciones de resultado' : 'Result options'}>
          {Array.from({ length: Math.max(1, Math.ceil(results.length / 3)) }, (_, rowIndex) => {
            const start = rowIndex * 3;
            const row = results.slice(start, start + 3);
            return <div className="interaction-flow-result-row" key={`dice-result-row-${rowIndex}`}>
              {row.map((result, offset) => {
                const index = start + offset;
                return <Fragment key={result.id}>
                  {insertSlot(index, `dice-insert-before-${result.id}`)}
                  <div className="interaction-flow-result-item">
                    <button type="button" className="interaction-flow-result-choice" aria-pressed={selected?.id === result.id} aria-label={[letter(index), result.name, rangeLabel(result)].join(' · ')} title={[result.name, rangeLabel(result)].join(' · ')} onClick={() => setSelectedId(result.id)}>
                      <span className="interaction-flow-result-letter">{letter(index)}</span><strong className="interaction-flow-result-name-spacer" aria-hidden="true">{result.name}</strong>
                    </button>
                    <input className="interaction-flow-result-name-editor" type="text" aria-label={es ? `Nombre de ${letter(index)}` : `Name of ${letter(index)}`} value={result.name} onFocus={() => setSelectedId(result.id)} onClick={event => event.stopPropagation()} onChange={event => updateResult(result.id, current => ({ ...current, name: event.target.value }))} />
                    <button type="button" className="interaction-flow-result-delete" aria-label={es ? `Eliminar resultado ${result.name}` : `Delete result ${result.name}`} title={es ? 'Eliminar resultado' : 'Delete result'} disabled={results.length <= 1} onClick={event => { event.stopPropagation(); onDelete(result.id); }}><Trash2 size={15} /></button>
                    <div className="interaction-flow-inline-range" aria-label={es ? `Límites de ${result.name}` : `${result.name} bounds`}>
                      {(['min', 'max'] as const).map(bound => {
                        const key = `${result.id}:${bound}`;
                        const fallback = bound === 'min' ? baseMin : baseMax;
                        const currentValue = result.range?.[bound] ?? (Number.isFinite(fallback) ? fallback : '');
                        const inclusive = bound === 'min' ? result.range?.minInclusive !== false : result.range?.maxInclusive !== false;
                        return <label className="interaction-flow-range-bound" key={bound}>
                          <span className="interaction-flow-range-heading"><span>{es ? bound === 'min' ? 'Desde' : 'Hasta' : bound === 'min' ? 'From' : 'To'}</span>
                            <select className="interaction-flow-range-inclusion" aria-label={es ? `Inclusión del límite ${bound === 'min' ? 'inferior' : 'superior'} · ${result.name}` : `${bound} boundary inclusion · ${result.name}`} value={inclusive ? 'inclusive' : 'exclusive'} onChange={event => updateInclusive(result, bound, event.target.value === 'inclusive')}>
                              <option value="inclusive">{bound === 'min' ? '≥' : '≤'}</option><option value="exclusive">{bound === 'min' ? '>' : '<'}</option>
                            </select>
                          </span>
                          <div className="interaction-flow-range-input-wrap">
                            <input type="number" step="1" aria-label={`${bound === 'min' ? es ? 'Límite inferior' : 'Lower bound' : es ? 'Límite superior' : 'Upper bound'} · ${result.name}`} value={boundDrafts[key] ?? String(currentValue)} onFocus={() => setSelectedId(result.id)} onChange={event => {
                              const raw = event.currentTarget.value;
                              setBoundDrafts(drafts => ({ ...drafts, [key]: raw }));
                              updateBound(result, bound, raw);
                            }} onBlur={() => setBoundDrafts(drafts => { const next = { ...drafts }; delete next[key]; return next; })} />
                          </div>
                        </label>;
                      })}
                    </div>
                  </div>
                </Fragment>;
              })}
              {insertSlot(start + row.length, `dice-insert-after-row-${rowIndex}`)}
            </div>;
          })}
        </div>}
      <button type="button" className="dice-flow-add" onClick={() => onAdd()}><Plus size={16} />{es ? 'Añadir resultado' : 'Add result'}</button>
    </div>
    {selected ? <div className="dice-flow-result-editor" key={selected.id}>{renderResult(selected)}</div> : <p>{es ? 'Añade un resultado para configurar su intervalo.' : 'Add a result to configure its interval.'}</p>}
  </section>;
}
