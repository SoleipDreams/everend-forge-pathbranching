import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { InteractionResult } from '../domain.js';

type Bound = 'min' | 'max';
type IntervalDrag = { id: string; bound: Bound; value: number; start: number; end: number; left: number; width: number; scaleMin: number; scaleMax: number; extend: boolean };
type Props = {
  results: InteractionResult[];
  min: number;
  max: number;
  locale: 'es' | 'en';
  onChange: (results: InteractionResult[]) => void;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onInsertAfter?: (id: string) => void;
  selectedId?: string;
  handleOnly?: { id: string; bound: Bound };
  extendHandle?: { id: string; bound: Bound };
  extendAllHandles?: boolean;
  allowUnbounded?: boolean;
  axisLabel?: string;
  expandRanges?: boolean;
};

function boundaryText(min: number, max: number, minInclusive = true, maxInclusive = true, unboundedMin = false, unboundedMax = false) {
  if (min === max && !unboundedMin && !unboundedMax) return String(min);
  return `${unboundedMin ? '−∞' : `${minInclusive ? '≥' : '>'} ${min}`} · ${unboundedMax ? '+∞' : `${maxInclusive ? '≤' : '<'} ${max}`}`;
}

function rangeLattice(result: InteractionResult, domainMin: number, domainMax: number) {
  const range = result.range;
  const min = range?.min ?? domainMin, max = range?.max ?? domainMax;
  return {
    min: range?.minInclusive === false ? Math.floor(min) + 1 : Math.ceil(min),
    max: range?.maxInclusive === false ? Math.ceil(max) - 1 : Math.floor(max),
  };
}

export function NumericResultIntervals({ results, min: baseMin, max: baseMax, locale, onChange, onSelect, onDelete, onRename, onInsertAfter, selectedId, handleOnly, extendHandle, extendAllHandles = false, allowUnbounded = false, axisLabel, expandRanges = true }: Props) {
  const es = locale === 'es';
  const [internalSelectedId, setInternalSelectedId] = useState(results[0]?.id);
  const [drag, setDrag] = useState<IntervalDrag>();
  const [settingsResultId, setSettingsResultId] = useState<string>();
  const [trackWidth, setTrackWidth] = useState(0);
  const [boundDrafts, setBoundDrafts] = useState<Record<string, string>>({});
  const branchesRef = useRef<HTMLDivElement>(null);
  const selected = selectedId ?? internalSelectedId;
  useEffect(() => {
    const branches = branchesRef.current;
    if (!branches) return;
    const updateWidth = () => setTrackWidth(branches.querySelector<HTMLElement>('.dice-flow-track')?.getBoundingClientRect().width ?? 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(branches);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (settingsResultId && !results.some(result => result.id === settingsResultId)) setSettingsResultId(undefined);
  }, [results, settingsResultId]);
  const preview = drag ? results.map(result => result.id === drag.id ? { ...result, range: { ...result.range, [drag.bound]: drag.value } } : result) : results;
  const finiteBounds = preview.flatMap(result => [result.range?.min, result.range?.max].filter((value): value is number => Number.isFinite(value)));
  const min = Math.min(baseMin, ...(expandRanges ? finiteBounds : []), ...(drag ? [drag.value] : []));
  const max = Math.max(baseMax, ...(expandRanges ? finiteBounds : []), ...(drag ? [drag.value] : []));
  const size = Math.max(1, max - min + 1);
  const bands = (() => {
    const ranges = preview.map(result => rangeLattice(result, min, max)).filter(range => range.min <= range.max);
    const breaks = [...new Set([min, max + 1, ...ranges.flatMap(range => [Math.max(min, range.min), Math.min(max + 1, range.max + 1)])])].filter(value => value >= min && value <= max + 1).sort((a, b) => a - b);
    return breaks.slice(0, -1).map((start, index) => ({ min: start, max: breaks[index + 1] - 1, count: ranges.filter(range => range.min <= start && range.max >= start).length }));
  })();
  const gaps = bands.filter(band => band.count === 0), overlaps = bands.filter(band => band.count > 1);
  const label = (start: number, end: number) => start === end ? String(start) : `${start}–${end}`;
  const select = (id: string) => { setInternalSelectedId(id); onSelect?.(id); };
  const commitBound = (id: string, bound: Bound, value: number) => {
    const current = results.find(result => result.id === id);
    if (!current) return;
    const currentMin = current.range?.min ?? min;
    const currentMax = current.range?.max ?? max;
    // Expansion may go outside the dice domain, but never across the other
    // endpoint of this same interval.
    const nextValue = bound === 'min' ? Math.min(value, currentMax) : Math.max(value, currentMin);
    onChange(results.map(result => result.id === id ? {
      ...result,
      range: {
        ...result.range,
        min: bound === 'min' ? nextValue : currentMin,
        max: bound === 'max' ? nextValue : currentMax,
        minInclusive: result.range?.minInclusive ?? true,
        maxInclusive: result.range?.maxInclusive ?? true,
      },
    } : result));
  };
  const toggleUnbounded = (id: string, bound: Bound) => {
    const current = results.find(result => result.id === id);
    if (!current) return;
    const isUnbounded = current.range?.[bound] === undefined;
    const inclusiveKey = bound === 'min' ? 'minInclusive' : 'maxInclusive';
    onChange(results.map(result => result.id === id ? {
      ...result,
      range: {
        ...result.range,
        [bound]: isUnbounded ? bound === 'min' ? min : max : undefined,
        [inclusiveKey]: true,
      },
    } : result));
  };
  const setEditableBound = (id: string, bound: Bound, value: number) => {
    if (!Number.isSafeInteger(value)) return;
    const current = results.find(result => result.id === id);
    if (!current) return;
    const oppositeBound = bound === 'min' ? 'max' : 'min';
    const opposite = current.range?.[oppositeBound] ?? (oppositeBound === 'min' ? min : max);
    const nextValue = bound === 'min' ? Math.min(value, opposite) : Math.max(value, opposite);
    const inclusiveKey = bound === 'min' ? 'minInclusive' : 'maxInclusive';
    onChange(results.map(result => result.id === id ? {
      ...result,
      range: { ...result.range, [bound]: nextValue, [inclusiveKey]: true },
    } : result));
  };
  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, result: InteractionResult, bound: Bound, value: number, start: number, end: number, extend: boolean) => {
    event.preventDefault();
    const track = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!track) return;
    setDrag({ id: result.id, bound, value, start, end, left: track.left, width: track.width, scaleMin: min, scaleMax: max, extend });
    event.currentTarget.setPointerCapture(event.pointerId);
    select(result.id);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const scale = Math.max(1, drag.scaleMax - drag.scaleMin + 1);
    const raw = Math.floor((event.clientX - drag.left) / Math.max(1, drag.width) * scale) + drag.scaleMin;
    const constrained = drag.extend
      ? drag.bound === 'min' ? Math.min(raw, drag.end) : Math.max(raw, drag.start)
      : Math.max(drag.start, Math.min(drag.end, raw));
    const value = Math.max(-1_000_000_000, Math.min(1_000_000_000, constrained));
    setDrag({ ...drag, value });
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag) commitBound(drag.id, drag.bound, drag.value);
    setDrag(undefined);
  };
  const handleKey = (event: ReactKeyboardEvent<HTMLButtonElement>, result: InteractionResult, bound: Bound, value: number, start: number, end: number, extend: boolean) => {
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0;
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const raw = event.key === 'Home' ? start : event.key === 'End' ? end : value + step;
    const next = extend
      ? bound === 'min' ? Math.min(raw, end) : Math.max(raw, start)
      : Math.max(start, Math.min(end, raw));
    commitBound(result.id, bound, next);
    select(result.id);
  };

  return <div className="dice-flow-interval-editor" aria-label={es ? 'Ajuste de intervalos' : 'Interval adjustment'}>
    <div className="dice-flow-axis"><span>{min}</span><span>{axisLabel ?? (es ? 'Totales posibles · arrastra los límites' : 'Possible totals · drag the boundaries')}</span><span>{max}</span></div>
    <div className="dice-flow-coverage" aria-label={es ? 'Cobertura de resultados' : 'Result coverage'}>{bands.map(band => <span key={band.min} className={band.count === 0 ? 'uncovered' : band.count > 1 ? 'overlap' : 'covered'} style={{ flex: Math.max(1, band.max - band.min + 1) }} title={`${label(band.min, band.max)} · ${band.count === 0 ? es ? 'Sin resultado' : 'Unassigned' : band.count > 1 ? es ? 'Solapado' : 'Overlapping' : es ? 'Cubierto' : 'Covered'}`} />)}</div>
    <div className="dice-flow-branches" role="group" aria-label={es ? 'Intervalos por resultado' : 'Result intervals'} ref={branchesRef}>
      {preview.map((result, index) => {
        const lattice = rangeLattice(result, min, max), start = lattice.min, end = lattice.max;
        const valid = start <= end, visibleStart = Math.max(min, start), visibleEnd = Math.min(max, end), visible = valid && visibleStart <= visibleEnd;
        const active = selected === result.id;
        const effectiveMin = result.range?.min ?? min, effectiveMax = result.range?.max ?? max;
        const shouldShow = (bound: Bound) => handleOnly ? handleOnly.id === result.id && handleOnly.bound === bound : true;
        const canExtend = (bound: Bound) => extendAllHandles || extendHandle?.id === result.id && extendHandle.bound === bound;
        const minInclusive = result.range?.minInclusive !== false, maxInclusive = result.range?.maxInclusive !== false;
        // Open ends belong to the outer edges of the ordered result list only.
        // This keeps a selected middle interval from offering irrelevant infinities.
        const unboundedMin = allowUnbounded && index === 0 && result.range?.min === undefined;
        const unboundedMax = allowUnbounded && index === preview.length - 1 && result.range?.max === undefined;
        const rangeLabel = boundaryText(effectiveMin, effectiveMax, minInclusive, maxInclusive, unboundedMin, unboundedMax);
        const intervalWidth = visible ? (visibleEnd - visibleStart + 1) / size * trackWidth : 0;
        const isNarrow = trackWidth > 0 && intervalWidth < 124;
        const editing = settingsResultId === result.id;
        const letter = index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
        const boundInput = (bound: Bound) => {
          const isOuter = bound === 'min' ? index === 0 : index === preview.length - 1;
          const unbounded = bound === 'min' ? unboundedMin : unboundedMax;
          const currentValue = result.range?.[bound];
          const inputKey = `${result.id}:${bound}`;
          return <label className={`dice-flow-setting-bound${unbounded ? ' is-infinite' : ''}`} key={bound}>
            <span>{es ? bound === 'min' ? 'Desde' : 'Hasta' : bound === 'min' ? 'From' : 'To'}</span>
            <div>
              <input type="number" step="1" value={boundDrafts[inputKey] ?? (currentValue === undefined && isOuter ? '' : String(currentValue ?? (bound === 'min' ? min : max)))} placeholder={unbounded ? bound === 'min' ? '−∞' : '+∞' : undefined} disabled={unbounded} aria-label={`${bound === 'min' ? es ? 'Límite inferior' : 'Lower bound' : es ? 'Límite superior' : 'Upper bound'} · ${result.name}`} onChange={event => {
                const raw = event.target.value;
                setBoundDrafts(drafts => ({ ...drafts, [inputKey]: raw }));
                if (raw.trim() !== '') setEditableBound(result.id, bound, Number(raw));
              }} onBlur={() => setBoundDrafts(drafts => { const next = { ...drafts }; delete next[inputKey]; return next; })} />
              {allowUnbounded && isOuter ? <button type="button" className={unbounded ? 'selected' : ''} aria-label={unbounded ? es ? 'Usar límite fijo' : 'Use a fixed bound' : es ? `Extender hasta ${bound === 'min' ? 'menos' : 'más'} infinito` : `Extend to ${bound === 'min' ? 'negative' : 'positive'} infinity`} onClick={() => { setBoundDrafts(drafts => { const next = { ...drafts }; delete next[inputKey]; return next; }); toggleUnbounded(result.id, bound); }}>{unbounded ? bound === 'min' ? '−∞' : '+∞' : es ? '∞' : '∞'}</button> : null}
            </div>
          </label>;
        };
        return <div key={result.id} className={`dice-flow-lane${active ? ' selected' : ''}`}>
          <div className="dice-flow-track" style={{ '--interval-left': `${visible ? (visibleStart - min) / size * 100 : 0}%`, '--interval-width': `${visible ? (visibleEnd - visibleStart + 1) / size * 100 : 0}%` } as CSSProperties}>
            <button type="button" className={`dice-flow-interval${visible ? '' : ' invalid'}${isNarrow ? ' is-narrow' : ''}`} aria-pressed={active} title={`${letter} · ${result.name} · ${rangeLabel}`} onClick={() => { select(result.id); setSettingsResultId(current => current === result.id ? undefined : result.id); }}><span className="dice-flow-result-letter">{letter}</span><span>{result.name}</span><small>{rangeLabel}</small></button>
            {visible && active && (['min', 'max'] as const).filter(shouldShow).filter(bound => !allowUnbounded || result.range?.[bound] !== undefined).map(bound => {
              const value = bound === 'min' ? effectiveMin : effectiveMax;
              const low = bound === 'min' ? min : visibleStart, high = bound === 'max' ? max : visibleEnd;
              const extend = canExtend(bound);
              return <button key={bound} type="button" role="slider" className={`dice-flow-handle ${bound}`} aria-label={`${es ? bound === 'min' ? 'Límite inferior' : 'Límite superior' : bound === 'min' ? 'Lower bound' : 'Upper bound'} · ${result.name}`} aria-valuemin={low} aria-valuemax={high} aria-valuenow={value} title={es ? 'Arrastra para ajustar el intervalo' : 'Drag to adjust interval'} onPointerDown={event => beginDrag(event, result, bound, value, low, high, extend)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => setDrag(undefined)} onKeyDown={event => handleKey(event, result, bound, value, low, high, extend)} />;
            })}
            {visible && active && unboundedMin ? <button type="button" className="dice-flow-infinity-marker min" aria-label={es ? `Hacer finito el límite inferior de ${result.name}` : `Make ${result.name} lower bound finite`} title={es ? 'Convertir −∞ en un límite fijo' : 'Change −∞ to a fixed bound'} onClick={() => toggleUnbounded(result.id, 'min')}>← −∞</button> : null}
            {visible && active && unboundedMax ? <button type="button" className="dice-flow-infinity-marker max" aria-label={es ? `Hacer finito el límite superior de ${result.name}` : `Make ${result.name} upper bound finite`} title={es ? 'Convertir +∞ en un límite fijo' : 'Change +∞ to a fixed bound'} onClick={() => toggleUnbounded(result.id, 'max')}>+∞ →</button> : null}
            {editing ? <div className="dice-flow-interval-settings" role="group" aria-label={es ? `Editar resultado ${result.name}` : `Edit ${result.name} result`}>
              <button type="button" className="dice-flow-settings-close" aria-label={es ? 'Cerrar edición' : 'Close editor'} onClick={() => setSettingsResultId(undefined)}><X size={15} /></button>
              <label className="dice-flow-setting-name"><span>{es ? 'Nombre' : 'Name'}</span><input type="text" value={result.name} onChange={event => onRename?.(result.id, event.target.value)} /></label>
              <div className="dice-flow-setting-bounds">{boundInput('min')}{boundInput('max')}</div>
            </div> : null}
          </div>
          {allowUnbounded && active && (index === 0 && !unboundedMin || index === preview.length - 1 && !unboundedMax) ? <div className="dice-flow-infinity-actions" aria-label={es ? `Extremos de ${result.name}` : `${result.name} endpoints`}>
            {index === 0 && !unboundedMin ? <button type="button" aria-label={es ? `Extender ${result.name} por el límite inferior hasta menos infinito` : `Extend ${result.name} at the lower bound to negative infinity`} title={es ? 'Extender hasta −∞' : 'Extend to −∞'} onClick={() => toggleUnbounded(result.id, 'min')}>← −∞</button> : null}
            {index === preview.length - 1 && !unboundedMax ? <button type="button" aria-label={es ? `Extender ${result.name} por el límite superior hasta más infinito` : `Extend ${result.name} at the upper bound to positive infinity`} title={es ? 'Extender hasta +∞' : 'Extend to +∞'} onClick={() => toggleUnbounded(result.id, 'max')}>+∞ →</button> : null}
          </div> : null}
          {onInsertAfter && index < results.length - 1 ? <button type="button" className="dice-flow-insert-after" aria-label={es ? `Añadir resultado después de ${result.name}` : `Add result after ${result.name}`} title={es ? 'Añadir resultado después' : 'Add result after'} onClick={() => onInsertAfter(result.id)}><Plus size={16} /></button> : null}
          {onDelete ? <button type="button" className="dice-flow-delete" aria-label={es ? `Eliminar resultado ${result.name}` : `Delete result ${result.name}`} title={es ? 'Eliminar resultado' : 'Delete result'} disabled={results.length <= 1} onClick={() => onDelete(result.id)}><Trash2 size={15} /></button> : null}
        </div>;
      })}
    </div>
    {gaps.length || overlaps.length ? <div className="dice-flow-diagnostics" role="status">{gaps.length ? <p>{es ? 'Sin resultado' : 'Unassigned'}: {gaps.map(band => label(band.min, band.max)).join(', ')}</p> : null}{overlaps.length ? <p>{es ? 'Intervalos solapados' : 'Overlapping intervals'}: {overlaps.map(band => label(band.min, band.max)).join(', ')}</p> : null}</div> : <p className="dice-flow-complete">{es ? 'Todos los valores del dominio tienen un resultado.' : 'Every value in the domain has a result.'}</p>}
  </div>;
}
