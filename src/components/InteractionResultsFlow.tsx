import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { LayoutGrid, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { BranchingProject, InteractionMechanic, InteractionParticipant, InteractionResult, InteractionValueSource, LogicSubject } from '../domain.js';
import { characterSheetEntries } from '../characterSheets.js';
import { characterPropertyDescriptor } from '../characterStats.js';
import { diceBounds, diceFormula, dicePoolIssues } from '../interactionDice.js';
import { freezeInteractionRoll } from '../interactions.js';
import { ConditionPickerIcon } from './ConditionReferencePicker.js';
import { AccessibleTabs } from './AccessibleTabs.js';
import { NumericResultIntervals } from './NumericResultIntervals.js';
import '../interactionResultsFlow.css';

type Mechanic = Exclude<InteractionMechanic, { kind: 'dice' }>;
type Props = {
  project: BranchingProject;
  mechanic: Mechanic;
  results: InteractionResult[];
  configuration: ReactNode;
  source?: ReactNode;
  locale: 'es' | 'en';
  onAdd: (results?: InteractionResult[]) => void;
  onChange: (results: InteractionResult[]) => void;
  onDelete: (resultId: string) => void;
  renderResult: (result: InteractionResult) => ReactNode;
};

function worldDiceDomain(project: BranchingProject, mechanic: Extract<Mechanic, { kind: 'skillcheck' }>) {
  const dice = mechanic.dice;
  if (!dice || dicePoolIssues(dice).length) return undefined;
  const profile = project.playerProfiles?.find(item => item.id === project.activePlayerProfileId) ?? project.playerProfiles?.[0];
  const state = profile?.simulation ?? project.playerSimulation ?? {};
  let skillValue = 0, modifier = mechanic.modifier;
  try {
    const frozen = freezeInteractionRoll(project, state, { id: 'interval-preview', name: 'Interval preview', mechanic, results: [] });
    skillValue = frozen?.skillValue ?? 0;
    modifier = frozen?.modifier ?? modifier;
  } catch { /* An unresolved authoring value should not prevent editing the raw dice domain. */ }
  const bounds = diceBounds(dice, modifier);
  const min = bounds.min + skillValue, max = bounds.max + skillValue;
  return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min <= max ? { min, max } : undefined;
}

function worldIntervalResults(mechanic: Extract<Mechanic, { kind: 'skillcheck' }>, results: InteractionResult[], domain: { min: number; max: number }) {
  const successMin = mechanic.difficultyOperator === '>' ? Math.floor(mechanic.difficulty) + 1 : Math.ceil(mechanic.difficulty);
  const failureMax = successMin - 1;
  const thresholdOnly = results.length === 2 && results.some(result => result.key === 'success') && results.some(result => result.key === 'failure');
  return results.flatMap(result => {
    if (result.range) return [{ ...result, range: { ...result.range } }];
    if (thresholdOnly && result.key === 'failure') return [{ ...result, range: { max: failureMax, maxInclusive: true } }];
    if (thresholdOnly && result.key === 'success') return [{ ...result, range: { min: successMin, minInclusive: true } }];
    if (result.key === 'success') return [{ ...result, range: { min: successMin, ...(successMin <= domain.max ? { max: domain.max } : {}) } }];
    if (result.key === 'failure') return [{ ...result, range: { ...(failureMax >= domain.min ? { min: domain.min } : {}), max: failureMax } }];
    return [];
  }).sort((left, right) => (left.range?.min ?? -Infinity) - (right.range?.min ?? -Infinity));
}

/** Authoring summaries describe operands, never invent resolved attributes or rolls. */
function MechanicSummary({ project, mechanic, es }: { project: BranchingProject; mechanic: Mechanic; es: boolean }) {
  const sheets = characterSheetEntries(project);
  const subjectLabel = (subject: LogicSubject) => {
    if (subject.kind === 'context') return es ? { actor: 'Actor actual', self: 'Esta entidad', target: 'Destinatario' }[subject.role] : { actor: 'Current actor', self: 'This entity', target: 'Recipient' }[subject.role];
    if (subject.kind === 'entity') {
      if (!subject.entityId || subject.entityId.startsWith('$slot:')) return es ? 'Elegir personaje' : 'Choose character';
      const entry = sheets.find(item => !item.instanceId && item.entityId === subject.entityId && item.variantId === (subject.variantId ?? 'base'));
      return entry ? [entry.name, entry.variantId !== 'base' ? entry.variantName : undefined].filter(Boolean).join(' · ') : es ? 'Referencia no disponible' : 'Reference unavailable';
    }
    if (subject.kind === 'instance') return sheets.find(item => item.instanceId === subject.instanceId)?.name ?? (es ? 'Referencia no disponible' : 'Reference unavailable');
    return es ? 'Elegir personaje' : 'Choose character';
  };
  const skillLabel = (skill?: InteractionValueSource) => {
    if (!skill) return undefined;
    if (skill.kind === 'variable') return project.logicVariables?.find(item => item.id === skill.variableId)?.name ?? (es ? 'Elegir variable' : 'Choose variable');
    return characterPropertyDescriptor(project, skill.propertyId)?.label ?? (skill.propertyId ? es ? 'Atributo no disponible' : 'Attribute unavailable' : es ? 'Elegir atributo' : 'Choose attribute');
  };
  const roll = (dice?: { count: number; sides: number; groups?: { id: string; count: number; sides: number }[] }) => dice ? diceFormula(dice) : undefined;
  const expression = (skill: InteractionValueSource | undefined, dice: { count: number; sides: number; groups?: { id: string; count: number; sides: number }[] } | undefined, modifier: number) => {
    const terms = [skillLabel(skill), roll(dice)].filter(Boolean);
    const base = terms.join(' + ') || '0';
    return `${base}${modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : ''}`;
  };
  const participant = (value: InteractionParticipant, role: string) => <article key={value.id} className="interaction-flow-participant"><small>{role}</small><strong>{subjectLabel(value.subject)}</strong><span>{expression(value.skill, value.dice, value.modifier)}</span></article>;
  if (mechanic.kind === 'skillcheck') return <div className="interaction-flow-world" aria-label={es ? 'Prueba contra el mundo' : 'World check'}>
    <strong>{mechanic.skill?.kind === 'property' ? subjectLabel(mechanic.skill.subject) : mechanic.skill?.kind === 'variable' ? es ? 'Variable de la historia' : 'Story variable' : es ? 'Solo dados' : 'Dice only'}</strong>
    <div className="interaction-flow-comparison"><span>{expression(mechanic.skill, mechanic.dice, mechanic.modifier)}</span><b aria-label={mechanic.difficultyOperator === '>' ? es ? 'Mayor que' : 'Greater than' : es ? 'Mayor o igual que' : 'Greater than or equal to'}>{mechanic.difficultyOperator === '>' ? '>' : '≥'}</b><span className="interaction-flow-difficulty"><small>{es ? 'Dificultad' : 'Difficulty'}</small><strong>{mechanic.difficulty}</strong></span></div>
    <p>{mechanic.skill?.kind === 'variable' ? es ? 'El total incluye el valor de la variable al iniciar la prueba.' : 'The total includes the variable value captured when the check starts.' : mechanic.skill?.kind === 'property' ? es ? 'El total incluye el valor del atributo al iniciar la prueba.' : 'The total includes the attribute value captured when the check starts.' : es ? 'Se compara el total del dado y sus modificadores.' : 'The dice total and modifiers are compared.'}</p>
  </div>;
  if (mechanic.kind === 'opposedcheck') return <div className="interaction-flow-opposed" aria-label={es ? 'Comparación entre personajes' : 'Character comparisons'}>
    {participant({ ...mechanic.actor, dice: mechanic.actor.dice ?? mechanic.commonDice }, `Actor · ${(mechanic.actor.dice ?? mechanic.commonDice) ? es ? 'una tirada' : 'one roll' : es ? 'sin dado' : 'no dice'}`)}
    <span className="interaction-flow-versus">{es ? 'Frente a cada rival' : 'Against each rival'}</span>
    <div className="interaction-flow-rivals">{mechanic.rivals.map((rival, index) => participant({ ...rival, dice: rival.dice ?? mechanic.commonDice }, `Rival ${index + 1} · ${(rival.dice ?? mechanic.commonDice) ? es ? 'una tirada' : 'one roll' : es ? 'sin dado' : 'no dice'}`))}{!mechanic.rivals.length ? <p>{es ? 'Selecciona al menos un rival en la configuración.' : 'Choose at least one rival in the configuration.'}</p> : null}</div>
    <p>{es ? 'Se compara el mismo total del actor con cada rival: mayor gana, menor pierde e igual empata.' : 'The same actor total is compared with each rival: higher wins, lower loses and equal ties.'}</p>
    <div className="interaction-flow-aggregation"><small>{es ? 'Resultado general' : 'Overall result'}</small><strong>{mechanic.aggregation === 'all' ? es ? 'Vencer a todos' : 'Beat all rivals' : es ? 'Vencer a cualquiera' : 'Beat any rival'}</strong></div>
  </div>;
  if (mechanic.kind === 'qte') {
    const key = mechanic.key === 'Space' ? es ? 'Espacio' : 'Space' : mechanic.key.replace(/^Key(?=[A-Z]$)|^Digit(?=\d$)/, '');
    const seconds = `${mechanic.durationMs / 1000} s`;
    return <div className="interaction-flow-qte" aria-label={es ? 'Plazo del QTE' : 'QTE deadline'}><strong>{es ? 'Pulsa' : 'Press'} <kbd>{key || '—'}</kbd></strong><div className="interaction-flow-time-labels"><span>0 s</span><span>{seconds}</span></div><div className="interaction-flow-time-track" role="img" aria-label={`${es ? 'Plazo de respuesta' : 'Response deadline'}: ${seconds}`} /><p>{es ? 'Tecla correcta antes de terminar el plazo. La barra representa el tiempo disponible, no una ejecución en curso.' : 'Press the correct key before the deadline. The bar represents the available time, not a running interaction.'}</p></div>;
  }
  return <div className="interaction-flow-custom" aria-label={es ? 'Resolución personalizada' : 'Custom resolution'}><small>{es ? 'Resultado elegido explícitamente' : 'Explicitly selected result'}</small><p>{mechanic.description || (es ? 'Configura la instrucción que explica cómo elegir un resultado.' : 'Configure the instruction explaining how to choose a result.')}</p></div>;
}

export function InteractionResultsFlow({ project, mechanic, results, configuration, source, locale, onAdd, onChange, onDelete, renderResult }: Props) {
  const es = locale === 'es';
  const thresholdResultPair = mechanic.kind === 'skillcheck' && results.length === 2 && results.some(result => result.key === 'success') && results.some(result => result.key === 'failure');
  const [selectedId, setSelectedId] = useState(results[0]?.id);
  const [configOpen, setConfigOpen] = useState(false);
  const [rangeEditorModeOverride, setRangeEditorModeOverride] = useState<'slider' | 'cards'>();
  const rangeEditorMode = rangeEditorModeOverride ?? (thresholdResultPair ? 'cards' : 'slider');
  const [rangeDrafts, setRangeDrafts] = useState<Record<string, string>>({});
  const previousIds = useRef(results.map(result => result.id));
  const identities = JSON.stringify(results.map(result => result.id));
  const panelId = useId();
  useEffect(() => {
    const added = results.find(result => !previousIds.current.includes(result.id));
    if (added) setSelectedId(added.id);
    else if (!results.some(result => result.id === selectedId)) setSelectedId(results[0]?.id);
    previousIds.current = results.map(result => result.id);
  }, [identities, selectedId]);
  const selected = results.find(result => result.id === selectedId) ?? results[0];
  const label = mechanic.kind === 'skillcheck' ? es ? 'Prueba contra el mundo' : 'World check' : mechanic.kind === 'opposedcheck' ? es ? 'Enfrentamiento' : 'Opposed check' : mechanic.kind === 'qte' ? 'QTE' : es ? 'Personalizada' : 'Custom';
  const worldDomain = mechanic.kind === 'skillcheck' ? worldDiceDomain(project, mechanic) : undefined;
  const intervalDomain = mechanic.kind === 'skillcheck'
    ? worldDomain ?? (() => {
      const firstSuccess = mechanic.difficultyOperator === '>' ? Math.floor(mechanic.difficulty) + 1 : Math.ceil(mechanic.difficulty);
      return { min: Math.min(0, firstSuccess - 3), max: Math.max(0, firstSuccess + 3) };
    })()
    : undefined;
  const worldIntervals = mechanic.kind === 'skillcheck' && intervalDomain ? worldIntervalResults(mechanic, results, intervalDomain) : [];
  const showWorldIntervals = mechanic.kind === 'skillcheck' && (results.length >= 3 || thresholdResultPair);
  const intervalSelection = worldIntervals.some(result => result.id === selectedId) ? selectedId : worldIntervals[0]?.id;
  const intervalById = new Map(worldIntervals.map(result => [result.id, result]));
  const orderedResults = mechanic.kind === 'skillcheck'
    ? [...results].sort((left, right) => {
      const lower = (result: InteractionResult) => {
        const range = intervalById.get(result.id)?.range ?? result.range;
        if (range) return range.min ?? -Infinity;
        if (result.key === 'failure') return -Infinity;
        if (result.key === 'success') return mechanic.difficultyOperator === '>' ? Math.floor(mechanic.difficulty) + 1 : Math.ceil(mechanic.difficulty);
        return Infinity;
      };
      return lower(left) - lower(right);
    })
    : results;
  const name = (result: InteractionResult) => result.key && result.name === result.key ? (es ? { success: mechanic.kind === 'opposedcheck' ? 'Victoria' : 'Éxito', failure: mechanic.kind === 'opposedcheck' ? 'Derrota' : 'Fallo', tie: 'Empate', timeout: 'Tiempo agotado' } : { success: mechanic.kind === 'opposedcheck' ? 'Victory' : 'Success', failure: mechanic.kind === 'opposedcheck' ? 'Defeat' : 'Failure', tie: 'Tie', timeout: 'Timeout' })[result.key] : result.name;
  const rule = (result: InteractionResult) => {
    if (mechanic.kind === 'skillcheck') {
      const effectiveRange = results.length === 2 && result.key && intervalById.get(result.id)?.range
        ? intervalById.get(result.id)!.range
        : result.range;
      if (effectiveRange) return `${effectiveRange.min === undefined ? '−∞' : `${effectiveRange.minInclusive === false ? '>' : '≥'} ${effectiveRange.min}`} · ${effectiveRange.max === undefined ? '+∞' : `${effectiveRange.maxInclusive === false ? '<' : '≤'} ${effectiveRange.max}`}`;
      if (result.key === 'success') return `Total ${mechanic.difficultyOperator === '>' ? '>' : '≥'} ${mechanic.difficulty}`;
      if (result.key === 'failure') return `Total ${mechanic.difficultyOperator === '>' ? '≤' : '<'} ${mechanic.difficulty}`;
      return '';
    }
    if (mechanic.kind === 'qte') return result.key === 'success' ? es ? 'Tecla correcta a tiempo' : 'Correct key in time' : result.key === 'failure' ? es ? 'Tecla distinta' : 'Different key' : result.key === 'timeout' ? es ? 'Plazo terminado' : 'Deadline reached' : '';
    if (mechanic.kind === 'opposedcheck') {
      if (result.key === 'success') return mechanic.aggregation === 'all' ? es ? 'Victoria contra todos' : 'Victory against all' : es ? 'Victoria contra alguno' : 'Victory against any';
      if (result.key === 'failure') return mechanic.aggregation === 'all' ? es ? 'Derrota contra alguno' : 'Defeat against any' : es ? 'Derrota contra todos' : 'Defeat against all';
      if (result.key === 'tie') return mechanic.aggregation === 'all' ? es ? 'Sin derrotas y algún empate' : 'No defeats and a tie' : es ? 'Sin victorias y algún empate' : 'No victories and a tie';
    }
    return '';
  };
  const rangeFor = (result: InteractionResult) => intervalById.get(result.id)?.range ?? result.range ?? {};
  const editRangeBound = (resultId: string, bound: 'min' | 'max', value: number | undefined) => {
    const index = orderedResults.findIndex(result => result.id === resultId);
    onChange(results.map(result => {
      const range = { ...rangeFor(result) };
      if (result.id === resultId) {
        range[bound] = value;
        range[`${bound}Inclusive`] = true;
        if (bound === 'min') range.max ??= index === orderedResults.length - 1 ? undefined : intervalDomain?.max;
        else range.min ??= index === 0 ? undefined : intervalDomain?.min;
      }
      return { ...result, range };
    }));
  };
  const editRangeInclusivity = (resultId: string, inclusive: boolean) => {
    onChange(results.map(result => ({ ...result, range: { ...rangeFor(result), ...(result.id === resultId ? { minInclusive: inclusive, maxInclusive: inclusive } : {}) } })));
  };
  const inlineRangeInclusivity = (result: InteractionResult) => {
    const range = rangeFor(result);
    const inclusive = range.minInclusive !== false && range.maxInclusive !== false;
    return <button type="button" className="interaction-flow-bound-operator" aria-label={es ? `Inclusión de los límites · ${name(result)}` : `Bound inclusion · ${name(result)}`} title={inclusive ? es ? 'Excluir ambos límites' : 'Exclude both bounds' : es ? 'Incluir ambos límites' : 'Include both bounds'} aria-pressed={inclusive} onClick={() => editRangeInclusivity(result.id, !inclusive)}>{inclusive ? '≤' : '<'}</button>;
  };
  const inlineRangeBound = (result: InteractionResult, index: number, bound: 'min' | 'max') => {
    if (!intervalDomain) return null;
    const range = rangeFor(result);
    const edge = bound === 'min' ? index === 0 : index === orderedResults.length - 1;
    const open = edge && range[bound] === undefined;
    const infinity = bound === 'min' ? '−∞' : '+∞';
    const fallback = bound === 'min' ? intervalDomain.min : intervalDomain.max;
    const draftKey = `${result.id}:${bound}`;
    const value = range[bound] ?? fallback;
    const label = bound === 'min' ? es ? 'Desde' : 'From' : es ? 'Hasta' : 'To';
    const infinityLabel = bound === 'min' ? '−∞' : '+∞';
    return <div className={`interaction-flow-range-bound${open ? ' is-infinite' : ''}`} key={bound}>
      <span className="interaction-flow-range-label">{label}</span>
      <div className={`interaction-flow-range-control ${bound}`}>
      {open
        ? <span className="interaction-flow-range-input-wrap"><button type="button" className="interaction-flow-infinity-bound" aria-label={es ? `Establecer límite ${bound === 'min' ? 'inferior' : 'superior'} finito para ${name(result)}` : `Set ${bound} bound finite for ${name(result)}`} title={es ? `Convertir ${infinity} en un límite fijo` : `Change ${infinity} to a fixed bound`} onClick={() => { setRangeDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; }); editRangeBound(result.id, bound, fallback); }}>{infinityLabel}</button></span>
        : <span className="interaction-flow-range-input-wrap"><input type="number" step="1" aria-label={`${label} · ${name(result)}`} value={rangeDrafts[draftKey] ?? String(value)} onFocus={() => setSelectedId(result.id)} onChange={event => {
          const text = event.currentTarget.value;
          setRangeDrafts(current => ({ ...current, [draftKey]: text }));
          if (text.trim() && Number.isSafeInteger(Number(text))) editRangeBound(result.id, bound, Number(text));
        }} onBlur={event => {
          const text = event.currentTarget.value.trim();
          if (!text || !Number.isSafeInteger(Number(text))) setRangeDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; });
          else setRangeDrafts(current => ({ ...current, [draftKey]: String(Number(text)) }));
        }} />{edge ? <button type="button" className="interaction-flow-infinity-toggle" aria-label={es ? `Extender ${name(result)} hasta ${infinity}` : `Extend ${name(result)} to ${infinity}`} title={es ? `Extender hasta ${infinity}` : `Extend to ${infinity}`} onClick={() => { setRangeDrafts(current => { const next = { ...current }; delete next[draftKey]; return next; }); editRangeBound(result.id, bound, undefined); }}>{infinity}</button> : null}</span>}
      </div>
    </div>;
  };
  const addWorldResult = (insertAt: number) => {
    if (mechanic.kind !== 'skillcheck' || !intervalDomain || !worldIntervals.length) { onAdd(); return; }
    const finiteBounds = worldIntervals.flatMap(result => [result.range?.min, result.range?.max].filter((value): value is number => Number.isFinite(value)));
    const scaleMin = Math.min(intervalDomain.min, ...finiteBounds), scaleMax = Math.max(intervalDomain.max, ...finiteBounds);
    const startOf = (range: NonNullable<InteractionResult['range']>) => range.min === undefined ? Math.ceil(scaleMin) : range.minInclusive === false ? Math.floor(range.min) + 1 : Math.ceil(range.min);
    const endOf = (range: NonNullable<InteractionResult['range']>) => range.max === undefined ? Math.floor(scaleMax) : range.maxInclusive === false ? Math.ceil(range.max) - 1 : Math.floor(range.max);
    const normalized = results.map(result => {
      const interval = intervalById.get(result.id);
      return interval ? { ...result, range: { ...interval.range } } : result;
    });
    const updateRange = (id: string, transform: (range: NonNullable<InteractionResult['range']>) => NonNullable<InteractionResult['range']>) => {
      const index = normalized.findIndex(result => result.id === id);
      if (index >= 0) normalized[index] = { ...normalized[index], range: transform(normalized[index].range ?? {}) };
    };
    const shiftRange = (id: string, amount: number) => updateRange(id, range => ({
      ...range,
      ...(range.min === undefined ? {} : { min: range.min + amount }),
      ...(range.max === undefined ? {} : { max: range.max + amount }),
    }));
    const slot = Math.max(0, Math.min(insertAt, orderedResults.length));
    const right = orderedResults.slice(slot).find(result => intervalById.has(result.id));
    const left = [...orderedResults.slice(0, slot)].reverse().find(result => intervalById.has(result.id));
    const rightIndex = right ? orderedResults.findIndex(result => result.id === right.id) : -1;
    const added: InteractionResult = { id: `result-${crypto.randomUUID()}`, name: es ? 'Resultado' : 'Result' };
    let min: number;
    if (!left && right) {
      const range = intervalById.get(right.id)!.range!;
      const first = startOf(range);
      if (range.min === undefined) {
        // Keep the open lower edge by transferring it to the new first result.
        min = first;
        updateRange(right.id, current => ({
          ...current,
          min: first + 3,
          minInclusive: true,
          ...(current.max === undefined ? {} : { max: current.max + 3, maxInclusive: true }),
        }));
        for (const interval of orderedResults.slice(rightIndex + 1).filter(result => intervalById.has(result.id))) shiftRange(interval.id, 3);
        added.range = { max: first + 2, maxInclusive: true };
      } else {
        min = first;
        const last = endOf(range);
        const hasRoom = range.max === undefined || last - first + 1 > 3;
        if (hasRoom) updateRange(right.id, current => ({ ...current, min: first + 3, minInclusive: true }));
        else for (const interval of orderedResults.slice(rightIndex).filter(result => intervalById.has(result.id))) shiftRange(interval.id, 3);
        added.range = { min, max: min + 2 };
      }
    } else if (left && !right) {
      const range = intervalById.get(left.id)!.range!;
      const first = startOf(range);
      if (range.max === undefined) {
        // Split an open final band so the previous result gets a three-value band
        // and the new final result keeps the +∞ endpoint.
        min = first + 3;
        updateRange(left.id, current => ({ ...current, min: first, max: first + 2, minInclusive: true, maxInclusive: true }));
        added.range = { min, minInclusive: true };
      } else {
        const last = endOf(range);
        min = last + 1;
        added.range = { min, max: min + 2 };
      }
    } else if (left && right) {
      const leftRange = intervalById.get(left.id)!.range!;
      const rightRange = intervalById.get(right.id)!.range!;
      const leftEnd = endOf(leftRange);
      min = leftEnd + 1;
      if (leftRange.max === undefined) updateRange(left.id, current => ({ ...current, max: leftEnd, maxInclusive: true }));
      const max = min + 2;
      const rightStart = startOf(rightRange);
      const displacement = Math.max(0, max - rightStart + 1);
      if (displacement) {
        const rightEnd = endOf(rightRange);
        const rightWidth = rightEnd - rightStart + 1;
        if (rightWidth > displacement) updateRange(right.id, current => ({ ...current, min: max + 1, minInclusive: true }));
        else {
          const following = orderedResults.slice(slot).filter(result => intervalById.has(result.id));
          for (const interval of following) shiftRange(interval.id, displacement);
        }
      }
    } else {
      onAdd();
      return;
    }
    added.range ??= { min, max: min + 2 };
    onAdd([...normalized, added]);
  };
  const addWorldResultAt = (insertAt: number, placementKey = `insert-slot-${insertAt}`) => {
    const next = orderedResults[insertAt];
    const previous = orderedResults[insertAt - 1];
    const label = previous && next
      ? es ? `Añadir opción entre ${name(previous)} y ${name(next)}` : `Add an option between ${name(previous)} and ${name(next)}`
      : next
        ? es ? `Añadir opción antes de ${name(next)}` : `Add an option before ${name(next)}`
        : previous
          ? es ? `Añadir opción después de ${name(previous)}` : `Add an option after ${name(previous)}`
          : es ? 'Añadir opción' : 'Add an option';
    return <div className="interaction-flow-insert-slot" key={placementKey}>
      <button type="button" className="interaction-flow-insert" aria-label={label} title={es ? 'Añadir opción' : 'Add an option'} disabled={!worldIntervals.length} onClick={() => addWorldResult(insertAt)}><Plus size={15} /></button>
    </div>;
  };
  return <section className="interaction-results-flow" data-mechanic={mechanic.kind} aria-label={es ? 'Flujo de resultados de interacción' : 'Interaction result flow'}>
    {source ?? <div className="interaction-flow-source"><button type="button" className="interaction-flow-source-button" aria-label={es ? 'Configurar interacción' : 'Configure interaction'} aria-expanded={configOpen} onClick={() => setConfigOpen(open => !open)}><ConditionPickerIcon name={mechanic.kind === 'qte' ? 'Footprints' : mechanic.kind === 'custom' ? 'CodeXml' : 'CircleCheck'} size={30} /><strong>{label}</strong></button><small>{es ? 'Configurar interacción' : 'Configure interaction'}</small></div>}
    {source && configuration ? <section className="interaction-flow-configuration" aria-label={es ? 'Configuración de interacción' : 'Interaction configuration'}>{configuration}</section> : null}
    {!source && configOpen ? <section className="interaction-flow-configuration" aria-label={es ? 'Configuración de interacción' : 'Interaction configuration'}>{configuration}</section> : null}
    {!(mechanic.kind === 'skillcheck' && !mechanic.skill) ? <div className="interaction-flow-summary"><MechanicSummary project={project} mechanic={mechanic} es={es} /></div> : null}
    {mechanic.kind === 'skillcheck' ? <>
      {showWorldIntervals ? <div className="interaction-flow-range-mode" role="group" aria-label={es ? 'Modo para editar intervalos' : 'Interval editing mode'}>
        <span>{es ? 'Editar límites con' : 'Edit bounds with'}</span>
        <button type="button" className={rangeEditorMode === 'slider' ? 'selected' : ''} aria-pressed={rangeEditorMode === 'slider'} onClick={() => setRangeEditorModeOverride('slider')}><SlidersHorizontal size={14} />Slider</button>
        <button type="button" className={rangeEditorMode === 'cards' ? 'selected' : ''} aria-pressed={rangeEditorMode === 'cards'} onClick={() => setRangeEditorModeOverride('cards')}><LayoutGrid size={14} />{es ? 'Tarjetas' : 'Cards'}</button>
      </div> : null}
      {showWorldIntervals && rangeEditorMode === 'slider' ? worldDomain ? <div className="interaction-flow-slider-layout">
        <NumericResultIntervals results={worldIntervals} min={worldDomain.min} max={worldDomain.max} locale={locale} selectedId={intervalSelection} allowUnbounded onSelect={setSelectedId} onDelete={onDelete} onRename={(id, nextName) => onChange(results.map(result => result.id === id ? { ...result, name: nextName } : result))} onInsertBefore={() => addWorldResult(0)} onInsertAfter={id => {
          const index = orderedResults.findIndex(result => result.id === id);
          if (index >= 0) addWorldResult(index + 1);
        }} onChange={changed => {
          const byId = new Map(changed.map(result => [result.id, result]));
          onChange(results.map(result => { const next = byId.get(result.id); return next ? { ...result, range: next.range } : result; }));
        }} />
      </div> : <p className="interaction-flow-interval-status" role="status">{es ? 'Configura dados y valores numéricos válidos para ajustar los intervalos.' : 'Configure valid dice and numeric values to adjust the ranges.'}</p> : null}
    </> : null}
    {mechanic.kind === 'skillcheck' ? (!showWorldIntervals || rangeEditorMode === 'cards') ? <div className="interaction-flow-result-choices" role="group" aria-label={es ? 'Opciones de resultado' : 'Result options'}>
      {Array.from({ length: Math.max(1, Math.ceil(orderedResults.length / 3)) }, (_, rowIndex) => {
        const start = rowIndex * 3;
        const row = orderedResults.slice(start, start + 3);
        return <div className={`interaction-flow-result-row${row.length === 1 ? ' is-single' : ''}`} key={`result-row-${rowIndex}`}>
          {row.map((result, offset) => {
            const index = start + offset;
            return <Fragment key={result.id}>
              {addWorldResultAt(index, `insert-before-${result.id}`)}
              <div className="interaction-flow-result-item">
                <button type="button" className="interaction-flow-result-choice" aria-pressed={selected?.id === result.id} aria-label={[String.fromCharCode(65 + index), name(result), rule(result)].filter(Boolean).join(' · ')} title={[name(result), rule(result)].filter(Boolean).join(' · ')} onClick={() => setSelectedId(result.id)}>
                  <span className="interaction-flow-result-letter">{index < 26 ? String.fromCharCode(65 + index) : index + 1}</span><strong className="interaction-flow-result-name-spacer" aria-hidden="true">{name(result)}</strong>{(!(showWorldIntervals && intervalById.has(result.id)) || rangeEditorMode === 'slider') && rule(result) ? <small className="interaction-flow-result-rule">{rule(result)}</small> : null}
                </button>
                <input className="interaction-flow-result-name-editor" type="text" aria-label={es ? `Nombre de ${String.fromCharCode(65 + index)}` : `Name of ${String.fromCharCode(65 + index)}`} value={name(result)} onFocus={() => setSelectedId(result.id)} onClick={event => event.stopPropagation()} onChange={event => onChange(results.map(item => item.id === result.id ? { ...item, name: event.target.value } : item))} />
                <button type="button" className="interaction-flow-result-delete" aria-label={es ? `Eliminar resultado ${name(result)}` : `Delete result ${name(result)}`} title={es ? 'Eliminar resultado' : 'Delete result'} disabled={results.length <= 1} onClick={event => { event.stopPropagation(); onDelete(result.id); }}><Trash2 size={15} /></button>
                {showWorldIntervals && rangeEditorMode === 'cards' && intervalById.has(result.id) ? <div className="interaction-flow-inline-range" aria-label={es ? `Límites de ${name(result)}` : `${name(result)} bounds`}>
                  {inlineRangeBound(result, index, 'min')}{inlineRangeInclusivity(result)}{inlineRangeBound(result, index, 'max')}
                </div> : null}
              </div>
            </Fragment>;
          })}
          {addWorldResultAt(start + row.length, `insert-after-row-${rowIndex}`)}
        </div>;
      })}
    </div> : null : <AccessibleTabs className="interaction-flow-results" ariaLabel={es ? 'Resultados de interacción' : 'Interaction results'} value={selected?.id ?? ''} panelId={panelId} onChange={setSelectedId} tabs={results.map((result, index) => ({ id: result.id, title: [name(result), rule(result)].filter(Boolean).join(' · '), label: <><span className="interaction-flow-result-letter">{index < 26 ? String.fromCharCode(65 + index) : index + 1}</span><strong>{name(result)}</strong>{rule(result) ? <small>{rule(result)}</small> : null}</> }))} />}
    {mechanic.kind === 'custom' ? <button type="button" className="interaction-flow-add" onClick={() => onAdd()}><Plus size={16} />{es ? 'Añadir resultado' : 'Add result'}</button> : null}
    <div className="interaction-flow-selected" role={mechanic.kind === 'skillcheck' ? 'region' : 'tabpanel'} id={panelId} aria-label={es ? `Resultado: ${selected ? name(selected) : 'Sin resultados'}` : `Result: ${selected ? name(selected) : 'No results'}`}>
      {selected ? <div key={selected.id}>{renderResult(selected)}</div> : <p>{es ? 'Añade un resultado para configurar sus consecuencias y destino.' : 'Add a result to configure its consequences and destination.'}</p>}
    </div>
  </section>;
}
