import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BranchingProject, InteractionDefinition, InteractionDice, InteractionMechanic, InteractionMechanicPreset } from '../domain.js';
import { defaultInteractionAdaptation, previewInteractionAdaptation, type InteractionAdaptationOptions } from '../interactionAdaptation.js';
import { diceBounds, diceFormula } from '../interactionDice.js';
import { ConditionReferencePicker } from './ConditionReferencePicker.js';
import '../interactionAdaptation.css';

export function InteractionAdaptationDialog({ project, eventId, useId, preset, definition, locale, poolOnly = false, onCancel, onApply }: {
  project: BranchingProject; eventId: string; useId: string; preset: InteractionMechanicPreset; definition: InteractionDefinition; locale: 'es' | 'en'; poolOnly?: boolean;
  onCancel: () => void; onApply: (options: InteractionAdaptationOptions, fingerprint: string) => Promise<void>;
}) {
  const es = locale === 'es';
  const [options, setOptions] = useState(() => defaultInteractionAdaptation(definition, preset));
  const [fingerprint] = useState(() => JSON.stringify(definition));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const dialog = useRef<HTMLDivElement>(null), cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; cancel.current?.focus(); return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); }; }, []);
  // The owner closes this dialog if the use disappears or the project changes.
  const preview = previewInteractionAdaptation(project, eventId, useId, preset, options, poolOnly);
  const changed = JSON.stringify(preview.old) !== fingerprint;
  const oldDescription = definition.mechanic.kind === 'dice' ? diceFormula(definition.mechanic, definition.mechanic.modifier) : definition.name;
  const incomingDescription = preset.mechanic.kind === 'dice' ? diceFormula(preset.mechanic, preset.mechanic.modifier) : preset.name;
  const describeMechanic = (mechanic: InteractionMechanic) => {
    const dice = (value?: InteractionDice) => value ? diceFormula(value) : es ? 'Sin dado' : 'No dice';
    if (mechanic.kind === 'dice') return diceFormula(mechanic, mechanic.modifier);
    if (mechanic.kind === 'skillcheck') return `${es ? 'Atributo' : 'Attribute'} + ${dice(mechanic.dice)} ${mechanic.modifier < 0 ? '−' : '+'} ${Math.abs(mechanic.modifier)} ≥ ${mechanic.difficulty}`;
    if (mechanic.kind === 'qte') return `${mechanic.key} · ${mechanic.durationMs / 1000} s`;
    if (mechanic.kind === 'opposedcheck') return `${dice(mechanic.actor.dice)} · ${mechanic.rivals.length} ${es ? 'rivales' : 'rivals'} · ${mechanic.aggregation === 'all' ? es ? 'Vencer a todos' : 'Beat all' : es ? 'Vencer a cualquiera' : 'Beat any'}`;
    return mechanic.description || (es ? 'Resolución personalizada' : 'Custom resolution');
  };
  const resultKey = (key: string | undefined) => key && es ? ({ success: 'Éxito / Victoria', failure: 'Fallo / Derrota', timeout: 'Tiempo agotado', tie: 'Empate' }[key] ?? key) : key;
  const apply = async () => { setBusy(true); setError(undefined); try { await onApply(options, fingerprint); onCancel(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return createPortal(<div className="interaction-creation-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}><div ref={dialog} className="interaction-creation-dialog interaction-adaptation-dialog" role="dialog" aria-modal="true" aria-label={es ? 'Adaptar interacción' : 'Adapt interaction'} onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); onCancel(); }
    if (event.key === 'Tab') { const fields = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]') ?? [])]; if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0]?.focus(); } }
  }}>
    <h2>{es ? 'Adaptar interacción' : 'Adapt interaction'}</h2>
    <p><strong>{oldDescription}</strong> → <strong>{incomingDescription}</strong></p>
    <p>{es ? 'Los resultados asociados conservan su nombre, sus rutas y sus consecuencias. El cambio completo se puede deshacer con Ctrl+Z.' : 'Matched results keep their name, routes and consequences. Undo the complete change with Ctrl+Z.'}</p>
    <div className="interaction-adaptation-settings"><div><small>{es ? 'Configuración actual' : 'Current settings'}</small><p>{describeMechanic(definition.mechanic)}</p></div><div><small>{es ? 'Configuración propuesta' : 'Proposed settings'}</small><p>{describeMechanic(preview.next.mechanic)}</p></div></div>
    {preview.sameDice ? <div className="interaction-adaptation-modes" role="group" aria-label={es ? 'Adaptación de intervalos' : 'Range adaptation'}>{(['preserve', 'proportional'] as const).map(mode => <button key={mode} type="button" disabled={busy} aria-pressed={options.ranges === mode} onClick={() => setOptions({ ...options, ranges: mode })}>{mode === 'preserve' ? es ? 'Conservar intervalos' : 'Keep ranges' : es ? 'Redistribuir proporcionalmente' : 'Redistribute proportionally'}</button>)}</div> : <section aria-label={es ? 'Asociar resultados' : 'Match results'}>
      <h3>{es ? 'Asociar resultados' : 'Match results'}</h3>
      <p>{es ? 'Cada resultado nuevo puede heredar uno existente. Las coincidencias ambiguas requieren tu elección.' : 'Each new result can inherit an existing one. Ambiguous matches need your choice.'}</p>
      {preset.results.map(target => <div key={target.id} className="interaction-adaptation-match"><strong>{target.name}</strong><span aria-hidden="true">←</span><ConditionReferencePicker projectId={project.projectId} category="interaction-adaptation" locale={locale} label={`${es ? 'Asociar' : 'Match'}: ${target.name}`} value={options.mapping[target.id] ?? ''} disabled={busy} candidates={[{ id: '', label: es ? 'Crear resultado nuevo' : 'Create new result' }, ...definition.results.filter(source => source.id === options.mapping[target.id] || !Object.values(options.mapping).includes(source.id)).map(source => ({ id: source.id, label: source.name, detail: `${preview.references.filter(ref => ref.resultId === source.id).length} ${es ? 'referencias' : 'references'} · ${source.effects?.length ?? 0} ${es ? 'consecuencias' : 'consequences'}` }))]} onChoose={id => setOptions({ ...options, mapping: { ...options.mapping, [target.id]: id } })} /></div>)}
      {preview.flexible ? <label className="interaction-check"><input type="checkbox" disabled={busy} checked={options.retainUnmatched} onChange={event => setOptions({ ...options, retainUnmatched: event.target.checked, discardUnmatched: false })} />{es ? 'Conservar también los resultados sin asociación' : 'Also keep unmatched results'}</label> : null}
    </section>}
    {preview.next.mechanic.kind === 'dice' ? <p>{es ? 'Totales posibles' : 'Possible totals'}: {diceBounds(preview.next.mechanic, preview.next.mechanic.modifier).min}–{diceBounds(preview.next.mechanic, preview.next.mechanic.modifier).max}</p> : null}
    <section aria-label={es ? 'Vista previa de resultados' : 'Result preview'}><h3>{es ? 'Vista previa' : 'Preview'}</h3><div className="interaction-adaptation-table"><table><thead><tr><th>{es ? 'Resultado' : 'Result'}</th><th>{es ? 'Antes' : 'Before'}</th><th>{es ? 'Después' : 'After'}</th><th>{es ? 'Se conserva' : 'Preserved'}</th></tr></thead><tbody>{preview.next.results.map(result => {
      const before = definition.results.find(item => item.id === result.id);
      const describe = (value: typeof result | undefined) => value?.range ? `${value.range.min}–${value.range.max}` : resultKey(value?.key) ?? '—';
      return <tr key={result.id}><th>{result.name}{!before ? <small> · {es ? 'Nuevo' : 'New'}</small> : null}</th><td>{describe(before)}</td><td>{describe(result)}</td><td>{before ? `${preview.references.filter(ref => ref.resultId === result.id).length} ${es ? 'referencias' : 'references'} · ${result.effects?.length ?? 0} ${es ? 'consecuencias' : 'consequences'}` : '—'}</td></tr>;
    })}</tbody></table></div></section>
    {preview.removed.length ? <section><h3>{es ? 'Resultados sin asociación' : 'Unmatched results'}</h3><ul>{preview.removed.map(result => <li key={result.id}>{result.name}</li>)}</ul><label className="interaction-check"><input type="checkbox" disabled={busy} checked={options.discardUnmatched} onChange={event => setOptions({ ...options, discardUnmatched: event.target.checked })} />{es ? 'Eliminar los resultados sin referencias ni consecuencias' : 'Remove results without references or consequences'}</label></section> : null}
    {preview.warnings.map(message => <p key={message} className="narrative-muted">{message}</p>)}
    {preview.references.length ? <details><summary>{es ? 'Condiciones y rutas que utilizan estos resultados' : 'Conditions and routes using these results'} ({preview.references.length})</summary><ul>{preview.references.map((reference, index) => <li key={index}>{definition.results.find(result => result.id === reference.resultId)?.name ?? (es ? 'Resultado no disponible' : 'Unavailable result')} · {reference.location}{reference.participantId ? ` · ${es ? 'Rival' : 'Rival'}: ${definition.mechanic.kind === 'opposedcheck' ? definition.mechanic.rivals.find(rival => rival.id === reference.participantId)?.id ?? reference.participantId : reference.participantId}` : ''}</li>)}</ul></details> : null}
    {changed ? <p role="alert">{es ? 'La interacción cambió. Cierra esta vista previa y vuelve a abrirla.' : 'The interaction changed. Close and reopen this preview.'}</p> : null}
    {preview.errors.length ? <div role="status" className="authoring-field-error"><strong>{es ? 'Pendiente de resolver' : 'Needs review'}</strong><ul>{preview.errors.map(message => <li key={message}>{message}</li>)}</ul></div> : null}
    {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
    <footer><button ref={cancel} type="button" disabled={busy} onClick={onCancel}>{es ? 'Cancelar' : 'Cancel'}</button><button type="button" disabled={busy || changed || Boolean(preview.errors.length)} onClick={() => void apply()}>{busy ? es ? 'Aplicando…' : 'Applying…' : es ? 'Aplicar cambio' : 'Apply change'}</button></footer>
  </div></div>, document.querySelector('.pathbranching-app') ?? document.body);
}
