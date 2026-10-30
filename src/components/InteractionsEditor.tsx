import '../interactions.css';
import '../interactionLibrary.css';
import { useState } from 'react';
import type { BranchingProject, InteractionDefinition, InteractionMechanic, InteractionMechanicsLibrary, InteractionUse } from '../domain.js';
import { authoringNodeOptions } from '../authoringMutations.js';
import { addInteraction, addInteractionBarrier, defaultInteraction, updateInteraction, updateInteractionBarrier, updateInteractionUse, interactionResultRoute, setInteractionResultRoute, createInteractionResultContinuation, deleteInteractionBarrier } from '../interactionMutations.js';
import { barrierNodeId, interactionDefinitionIssues, interactionNodeId } from '../interactions.js';
import { createInternalTransition, updateEvent } from '../projectMutations.js';
import { applyInteractionPresetUpdates, createInteractionFromPreset, customizeInteractionUse, deleteInteractionResult, defaultInteractionMechanicsLibrary, diceSetPresetFromDefinition, presetFromDefinition, saveInteractionPreset } from '../interactionLibrary.js';
import { useInterfaceLocale } from '../i18n.js';
import { AuthoringTextField } from './AuthoringTextField.js';
import { ConditionReferencePicker } from './ConditionReferencePicker.js';
import { defaultInteractionActor, InteractionMechanicFields, interactionKindChoices, resultsForMechanic, type DiceContextSelectorOptions } from './InteractionMechanicFields.js';
import { useInteractionAuthoringContext } from './InteractionAuthoringContext.js';
import { InteractionPresetUpdateDialog } from './InteractionPresetUpdateDialog.js';
import { DiceResultsFlow } from './DiceResultsFlow.js';
import { InteractionResultsFlow } from './InteractionResultsFlow.js';
import { InteractionMechanicSelector } from './InteractionMechanicSelector.js';
import { chooseInteractionPreset } from '../interactionLibrary.js';
import { diceBounds, dicePoolFromPreset, interactionPresetKind } from '../interactionDice.js';
import { adaptInteractionUse, defaultInteractionAdaptation } from '../interactionAdaptation.js';
import type { InteractionMechanicPreset } from '../domain.js';
import { writeConditionRecent } from '../conditionAuthoring.js';

export type InteractionsEditorProps = { project: BranchingProject; eventId: string; hideCreation?:boolean; ownerNodeId?: string; dialogueId?: string; optionContext?: boolean; onMutation: (mutate: (project: BranchingProject) => BranchingProject) => void | Promise<void>; onSelect?: (id: string) => void; library?: InteractionMechanicsLibrary; onLibraryChange?: (next: InteractionMechanicsLibrary) => void | Promise<void> };
export function InteractionsEditor({ project, eventId, hideCreation=false, ownerNodeId, dialogueId, optionContext = false, onMutation, onSelect, library: override, onLibraryChange: saveOverride }: InteractionsEditorProps) {
  const locale = useInterfaceLocale(), es = locale === 'es';
  const authoring = useInteractionAuthoringContext();
  const library = override ?? authoring?.library ?? defaultInteractionMechanicsLibrary(), onLibraryChange = saveOverride ?? authoring?.onLibraryChange;
  const event = project.events.find(event => event.id === eventId);
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<InteractionMechanic['kind']>('dice');
  const [presetId, setPresetId] = useState<string>();
  const [updateUseId, setUpdateUseId] = useState<string>();
  if (!event) return null;
  const mutate = async (fn: (project: BranchingProject) => BranchingProject) => { try { setError(undefined); await onMutation(fn); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } };
  const attachedOwner = ownerNodeId && ownerNodeId !== eventId && !/^(interaction|barrier):/.test(ownerNodeId) ? ownerNodeId : undefined;
  const add = (attached: boolean) => mutate(current => {
    const insertAfterOption = optionContext && Boolean(attachedOwner);
    const options = insertAfterOption
      ? { dialogueId, afterNodeId: attachedOwner }
      : { ownerNodeId: attached ? attachedOwner : undefined, dialogueId, afterNodeId: attached ? undefined : ownerNodeId && ownerNodeId !== eventId ? ownerNodeId : undefined };
    const preset = library.presets.find(item => item.id === presetId);
    const result = preset ? createInteractionFromPreset(current, eventId, preset, options) : addInteraction(current, eventId, kind, { ...options, pendingMechanic: kind === 'dice' });
    if (result.message) throw new Error(result.message);
    const beforeIds = new Set(current.events.find(item => item.id === eventId)?.interactionUses?.map(use => use.id) ?? []);
    const createdUse = result.project.events.find(item => item.id === eventId)?.interactionUses?.find(use => !beforeIds.has(use.id));
    const createdDefinition = createdUse && result.project.events.find(item => item.id === eventId)?.interactionDefinitions?.find(definition => definition.id === createdUse.definitionId);
    const defaultActor = createdDefinition?.mechanic.kind === 'dice' ? defaultInteractionActor(current, { eventId, dialogueId, nodeId: attachedOwner }) : undefined;
    return createdDefinition?.mechanic.kind === 'dice' && !createdDefinition.mechanic.actor && defaultActor
      ? updateInteraction(result.project, eventId, createdDefinition.id, { mechanic: { ...createdDefinition.mechanic, actor: defaultActor } })
      : result.project;
  });
  const dialogueScope = dialogueId && ownerNodeId === `dialogue:${eventId}:${dialogueId}`;
  const optionInteractionUseIds = new Set(optionContext && ownerNodeId
    ? (event.transitions ?? [])
      .filter(transition => transition.from === ownerNodeId)
      .map(transition => event.interactionUses?.find(use => interactionNodeId(eventId, use.id) === transition.to)?.id)
      .filter((id): id is string => Boolean(id))
    : []);
  const uses = (event.interactionUses ?? []).filter(use => !ownerNodeId || ownerNodeId === eventId || use.ownerNodeId === ownerNodeId || interactionNodeId(eventId, use.id) === ownerNodeId || optionInteractionUseIds.has(use.id) || dialogueScope && use.dialogueId === dialogueId);
  const ownerDecision = attachedOwner ? event.decisions?.find(decision => decision.outcomes.some(outcome => `outcome:${eventId}:${decision.id}:${outcome.id}` === attachedOwner)) : undefined;
  const optionRoutes = attachedOwner ? (event.transitions ?? []).filter(transition => transition.from === attachedOwner) : [];
  const routerContext = !optionContext && Boolean(ownerDecision && optionRoutes.length > 1);
  const targets = authoringNodeOptions(project).filter(target => target.id !== ownerNodeId).map(target => ({ ...target, detail: target.id, icon: 'Footprints' }));
  const setDefinition = (useId: string, patch: Partial<InteractionDefinition>) => mutate(current => customizeInteractionUse(current, eventId, useId, patch));
  const applyAutomaticAdaptation = async (useId: string, preset: InteractionMechanicPreset, options: { local?: boolean; poolOnly?: boolean; sourcePreset?: InteractionMechanicPreset } = {}) => {
    setError(undefined);
    await onMutation(current => {
      const currentEvent = current.events.find(item => item.id === eventId);
      const use = currentEvent?.interactionUses?.find(item => item.id === useId);
      const definition = currentEvent?.interactionDefinitions?.find(item => item.id === use?.definitionId);
      if (!definition) throw new Error(es ? 'La interacción ya no está disponible.' : 'The interaction is no longer available.');
      const matching = defaultInteractionAdaptation(definition, preset);
      let next = adaptInteractionUse(current, eventId, useId, preset, matching, JSON.stringify(definition), !options.local, Boolean(options.poolOnly));
      if (options.sourcePreset) next = customizeInteractionUse(next, eventId, useId, { presetOrigin: {
        presetId: options.sourcePreset.id,
        revision: options.sourcePreset.revision,
        customized: true,
        baseline: structuredClone(options.sourcePreset.mechanic),
        resultBaseline: structuredClone(options.sourcePreset.results),
      } });
      return next;
    });
    if (!options.local) writeConditionRecent(project.projectId, 'mechanic-preset', preset.id);
  };
  const poolSelection = (before: InteractionMechanic, after: InteractionMechanic): { changed: boolean; presetId?: string } => {
    if (before.kind !== after.kind) return { changed: false };
    if ((before.kind === 'dice' || before.kind === 'skillcheck') && after.kind === before.kind) {
      const beforePoolPresent = before.kind === 'dice' || Boolean(before.dice), afterPoolPresent = after.kind === 'dice' || Boolean(after.dice);
      return { changed: before.dicePresetId !== after.dicePresetId || beforePoolPresent !== afterPoolPresent, presetId: after.dicePresetId };
    }
    if (before.kind === 'opposedcheck' && after.kind === 'opposedcheck') {
      if (before.commonDicePresetId !== after.commonDicePresetId) return { changed: true, presetId: after.commonDicePresetId };
      if (Boolean(before.commonDice) !== Boolean(after.commonDice)) return { changed: true, presetId: after.commonDicePresetId };
      const oldParticipants = [before.actor, ...before.rivals], nextParticipants = [after.actor, ...after.rivals];
      for (const next of nextParticipants) {
        const old = oldParticipants.find(item => item.id === next.id);
        if (!old) continue;
        if (old.dicePresetId !== next.dicePresetId) return { changed: true, presetId: next.dice ? next.dicePresetId : after.commonDicePresetId };
        if (Boolean(old.dice) !== Boolean(next.dice)) return { changed: true, presetId: next.dice ? next.dicePresetId : after.commonDicePresetId };
      }
    }
    return { changed: false };
  };
  const applyPoolAdaptation = async (useId: string, definition: InteractionDefinition, before: InteractionMechanic, after: InteractionMechanic) => {
    const selection = poolSelection(before, after);
    if (!selection.changed) return false;
    const source = selection.presetId ? library.presets.find(item => item.id === selection.presetId) : undefined;
    const preset: InteractionMechanicPreset = source
      ? { ...structuredClone(source), mechanic: structuredClone(after), results: structuredClone(definition.results), presetKind: 'dice' }
      : { id: `local-pool-${useId}-${crypto.randomUUID()}`, revision: 1, name: es ? 'Nueva combinación de dados' : 'New dice pool', mechanic: structuredClone(after), results: structuredClone(definition.results), presetKind: 'dice' };
    await applyAutomaticAdaptation(useId, preset, { local: true, poolOnly: true, sourcePreset: source });
    return true;
  };
  const savePreset = async (definition: InteractionDefinition) => { try { if (!onLibraryChange) throw new Error(es ? 'Abre un universo para guardar mecánicas.' : 'Open a universe to save mechanics.'); const diceBased = ['dice', 'skillcheck', 'opposedcheck'].includes(definition.mechanic.kind); const saved = diceBased ? diceSetPresetFromDefinition(definition) : presetFromDefinition(definition); await onLibraryChange(saveInteractionPreset(library, saved)); authoring?.openLibrary?.(saved.id); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } };
  const updateUse = event.interactionUses?.find(use => use.id === updateUseId);
  const updateDefinition = event.interactionDefinitions?.find(definition => definition.id === updateUse?.definitionId);
  const updatePreset = library.presets.find(preset => preset.id === updateDefinition?.presetOrigin?.presetId);
  return <section className="interactions-editor" data-hide-creation={hideCreation || Boolean(ownerNodeId?.startsWith('interaction:'))} aria-label={es ? 'Interacciones' : 'Interactions'}>
    {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
    {updateUse && updatePreset ? <InteractionPresetUpdateDialog project={project} preset={updatePreset} eventId={eventId} useId={updateUse.id} locale={locale} onCancel={() => setUpdateUseId(undefined)} onRepair={(ownerEventId,useId) => { const selected = project.events.find(owner => owner.id === ownerEventId)?.interactionUses?.find(use => use.id === useId); onSelect?.(selected?.ownerNodeId ?? interactionNodeId(ownerEventId,useId)); }} onApply={async selected => { await onMutation(current => applyInteractionPresetUpdates(current,updatePreset,selected)); }} /> : null}
    {optionContext && attachedOwner ? uses.length ? null : <InteractionMechanicSelector
      key={`new-option-interaction:${attachedOwner}`}
      projectId={project.projectId}
      definition={{ ...defaultInteraction('dice', `pending-option:${attachedOwner}`), name: es ? 'Nueva interacción' : 'New interaction', results: [], mechanicPending: true }}
      library={library}
      locale={locale}
      onSave={() => {}}
      onChoose={async preset => {
        await onMutation(current => {
          const added = createInteractionFromPreset(current, eventId, preset, { dialogueId, afterNodeId: attachedOwner });
          if (added.message) throw new Error(added.message);
          return added.project;
        });
        return true;
      }}
    /> : routerContext && attachedOwner ? <div className="interaction-router-creation">
      <p className="narrative-muted">{es ? 'Añade aquí las interacciones que resolverá este enrutador. Usa sus resultados en las bifurcaciones.' : 'Add interactions resolved by this router. Use their results on its branches.'}</p>
      <InteractionMechanicSelector
        key={`new-router-interaction:${attachedOwner}`}
        projectId={project.projectId}
        definition={{ ...defaultInteraction('dice', `pending-router:${attachedOwner}`), name: es ? 'Nueva interacción' : 'New interaction', results: [], mechanicPending: true }}
        library={library}
        locale={locale}
        onSave={() => {}}
        onChoose={async preset => {
          await onMutation(current => {
            const added = createInteractionFromPreset(current, eventId, preset, { ownerNodeId: attachedOwner, dialogueId, moment: 'before' });
            if (added.message) throw new Error(added.message);
            return added.project;
          });
          return true;
        }}
      />
    </div> : !optionContext ? <>
      <div className="interaction-fields-row"><label><span>{es ? 'Nueva mecánica' : 'New mechanic'}</span><ConditionReferencePicker label={es ? 'Mecánica nueva' : 'New mechanic'} projectId={project.projectId} category="new-mechanic" locale={locale} searchable={false} value={kind} candidates={interactionKindChoices(es)} onChoose={id => { setKind(id as typeof kind); setPresetId(undefined); }} /></label><label><span>{es ? 'Biblioteca del universo' : 'Universe library'}</span><ConditionReferencePicker label={es ? 'Mecánica de la biblioteca' : 'Library mechanic'} projectId={project.projectId} category="mechanic-preset" locale={locale} value={presetId} candidates={library.presets.filter(preset => kind === 'dice' ? preset.mechanic.kind === 'dice' && interactionPresetKind(preset) === 'dice' : preset.mechanic.kind === kind).map(preset => ({ id: preset.id, label: preset.name, detail: `${preset.description ?? preset.mechanic.kind} · v${preset.revision}`, icon: 'D20' }))} onChoose={setPresetId} /></label></div>
      <div className="narrative-actions"><button type="button" onClick={() => void add(false)}>{es ? 'Añadir nodo' : 'Add node'}</button>{attachedOwner ? <button type="button" onClick={() => void add(true)}>{es ? 'Vincular aquí' : 'Attach here'}</button> : null}<button type="button" onClick={() => void mutate(current => { const added = addInteractionBarrier(current, eventId, { dialogueId, afterNodeId: ownerNodeId && ownerNodeId !== eventId ? ownerNodeId : undefined }); if (added.message) throw new Error(added.message); return added.project; })}>{es ? 'Añadir espera' : 'Add wait'}</button></div>
    </> : null}
    {uses.map(use => {
      const definition = event.interactionDefinitions?.find(item => item.id === use.definitionId);
      if (!definition) return <p key={use.id} role="alert">{es ? 'Definición ausente' : 'Missing definition'}</p>;
      const mechanic = definition.mechanic, nodeId = use.ownerNodeId ?? interactionNodeId(eventId, use.id);
      const usesDiceContext = !definition.mechanicPending && ['dice', 'skillcheck', 'opposedcheck'].includes(mechanic.kind);
      const localContext = { eventId, dialogueId: use.dialogueId, nodeId };
      const numericRange = (resultId: string, bound: 'min' | 'max', finite = false) => {
        const current = definition.results.find(item => item.id === resultId)?.range, inclusiveKey = bound === 'min' ? 'minInclusive' : 'maxInclusive';
        const fallback = finite && mechanic.kind === 'dice' ? diceBounds(mechanic, mechanic.modifier)[bound] : undefined;
        const update = (value: number | undefined) => { if (finite && value === undefined) return; return setDefinition(use.id, { results: definition.results.map(item => item.id === resultId ? { ...item, range: { ...item.range, [bound]: value, [inclusiveKey]: value === undefined ? undefined : item.range?.[inclusiveKey] ?? true } } : item) }); };
        return <div className="interaction-range-bound"><AuthoringTextField projectId={project.projectId} elementId={resultId} field={`range:${bound}`} label={es ? bound === 'min' ? 'Límite inferior' : 'Límite superior' : bound === 'min' ? 'Lower bound' : 'Upper bound'} placeholder={finite ? String(fallback ?? '') : bound === 'min' ? '−∞' : '+∞'} value={String(current?.[bound] ?? (finite ? fallback : ''))} validate={text => (finite && !text.trim()) || text.trim() && !Number.isFinite(Number(text)) ? es ? 'Introduce un número válido' : 'Enter a valid number' : undefined} onCommit={text => update(text.trim() ? Number(text) : undefined)} />{current?.[bound] !== undefined ? <ConditionReferencePicker label={es ? `Límite ${bound === 'min' ? 'inferior' : 'superior'} inclusivo` : `${bound} bound inclusive`} projectId={project.projectId} category={`range-${bound}-inclusion`} locale={locale} searchable={false} value={current[inclusiveKey] === false ? 'exclusive' : 'inclusive'} candidates={[{ id: 'inclusive', label: es ? 'Incluye el límite' : 'Include boundary' }, { id: 'exclusive', label: es ? 'Excluye el límite' : 'Exclude boundary' }]} onChoose={value => setDefinition(use.id, { results: definition.results.map(item => item.id === resultId && item.range ? { ...item, range: { ...item.range, [inclusiveKey]: value === 'inclusive' } } : item) })} /> : finite ? <small>{fallback}</small> : <small>{bound === 'min' ? '−∞' : '+∞'}</small>}</div>;
      };
      const nameField = <AuthoringTextField projectId={project.projectId} elementId={use.id} field="interaction:name" label={es ? 'Nombre' : 'Name'} value={definition.name} validate={name => name.trim() ? undefined : 'Required'} onCommit={name => setDefinition(use.id, { name })} />;
      const createSelector = (options?: DiceContextSelectorOptions) => <InteractionMechanicSelector {...options} projectId={project.projectId} definition={definition} library={library} locale={locale} placement={usesDiceContext ? 'dice-context' : 'source'} onSave={() => void savePreset(definition)} onReviewUpdate={() => setUpdateUseId(use.id)} onChoose={async preset => {
        if (!definition.mechanicPending && preset.mechanic.kind === 'dice' && interactionPresetKind(preset) === 'dice' && ['dice', 'skillcheck', 'opposedcheck'].includes(mechanic.kind)) {
          const dice = dicePoolFromPreset(preset);
          if (!dice) throw new Error(es ? 'El set de dados no tiene una composición válida.' : 'The dice set has no valid composition.');
          const next: InteractionMechanic | undefined = mechanic.kind === 'dice'
            ? { ...mechanic, ...dice, dicePresetId: preset.id }
            : mechanic.kind === 'skillcheck'
              ? { ...mechanic, dice, dicePresetId: preset.id }
              : mechanic.kind === 'opposedcheck'
                ? { ...mechanic, commonDice: dice, commonDicePresetId: preset.id }
                : undefined;
          if (!next) throw new Error(es ? 'El set de dados no corresponde a esta mecánica.' : 'This dice set does not apply to this mechanic.');
          if (await applyPoolAdaptation(use.id, definition, mechanic, next)) return true;
          await setDefinition(use.id, { mechanic: next });
          return true;
        }
        if (!definition.mechanicPending) { await applyAutomaticAdaptation(use.id, preset); return true; }
        await onMutation(current => {
          const chosen = chooseInteractionPreset(current, eventId, use.id, preset);
          const latest = chosen.events.find(item => item.id === eventId)?.interactionDefinitions?.find(item => item.id === definition.id);
          const defaultActor = defaultInteractionActor(project, localContext);
          return latest?.mechanic.kind === 'dice' && !latest.mechanic.actor && defaultActor
            ? updateInteraction(chosen, eventId, definition.id, { mechanic: { ...latest.mechanic, actor: defaultActor } })
            : chosen;
        }); return true;
      }} />;
      const selector = createSelector();
      const source = <div className={`${mechanic.kind === 'dice' ? 'dice' : 'interaction'}-flow-source-layout${usesDiceContext ? ' dice-flow-source-context' : ''}`}>
        {!usesDiceContext ? <div className={`${mechanic.kind === 'dice' ? 'dice' : 'interaction'}-flow-source-mechanic`}>{selector}</div> : null}
        <div className={`${mechanic.kind === 'dice' ? 'dice' : 'interaction'}-flow-source-name`}>{nameField}</div>
      </div>;
      const configuration = <>
        {use.ownerNodeId ? <div className="interaction-fields-row"><label><span>{es ? 'Momento' : 'Moment'}</span><ConditionReferencePicker label={es ? 'Momento de la interacción' : 'Interaction moment'} projectId={project.projectId} category="interaction-moment" locale={locale} searchable={false} value={use.moment} candidates={(['before','during','after'] as const).map(id => ({ id, label: es ? {before:'Antes',during:'Durante',after:'Después'}[id] : id }))} onChoose={moment => void mutate(current => updateInteractionUse(current, eventId, use.id, { moment: moment as InteractionUse['moment'] }))} /></label></div> : null}
        <InteractionMechanicFields project={project} mechanic={mechanic} identity={use.id} locale={locale} context={localContext} dicePresets={library.presets} mechanicSelector={usesDiceContext ? createSelector : undefined} onChange={next => { if (next.kind !== mechanic.kind) { const defaults = defaultInteraction(next.kind, use.id); const proposed = { ...next, ...(next.kind === 'opposedcheck' && !next.rivals.length ? { rivals: [{ id: 'rival-1', subject: { kind: 'entity' as const, entityId: '' }, modifier: 0 }] } : {}) }; const preset: InteractionMechanicPreset = { id: `local-${use.id}-${next.kind}`, name: es ? 'Cambio de tipo de prueba' : 'Change check type', revision: 1, updatedAt: new Date().toISOString(), mechanic: proposed, results: defaults.results }; void applyAutomaticAdaptation(use.id, preset, { local: true }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); } else { void (async () => { if (!await applyPoolAdaptation(use.id, definition, mechanic, next)) await setDefinition(use.id, { mechanic: next, results: resultsForMechanic(next, definition.results, definition.id) }); })().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); } }} />
      </>;
      const resultEditor = (result: InteractionDefinition['results'][number]) => {
        const route = interactionResultRoute(project, eventId, use.id, result.id);
        const continuationTargets = targets.filter(target => target.id !== nodeId).map((target, index) => {
          const section = target.kind === 'event' ? es ? 'Conversaciones' : 'Conversations'
            : ['dialogue', 'speech', 'direction'].includes(target.kind) ? es ? 'Diálogos' : 'Dialogues'
              : ['decision', 'outcome'].includes(target.kind) ? es ? 'Decisiones' : 'Decisions'
                : target.kind === 'interaction' ? es ? 'Interacciones' : 'Interactions'
                  : es ? 'Otros destinos' : 'Other destinations';
          const sectionOrder = target.kind === 'event' ? 0
            : ['dialogue', 'speech', 'direction'].includes(target.kind) ? 1
              : ['decision', 'outcome'].includes(target.kind) ? 2
                : target.kind === 'interaction' ? 3 : 4;
          return {
            ...target,
            label: target.label === 'Dialogue' ? es ? 'Nueva continuación' : 'New continuation' : target.label,
            group: 'all' as const,
            section,
            priority: sectionOrder * 100_000 + (target.eventId === eventId ? 0 : 1) * 10_000 + index,
          };
        });
        const routeNeedsBarrier = use.moment === 'during' && Boolean(use.ownerNodeId) && !(event.interactionBarriers ?? []).some(barrier => barrier.useIds.includes(use.id));
        const createContinuation = () => void mutate(current => createInteractionResultContinuation(current, eventId, use.id, result.id));
         return <fieldset key={result.id}><legend>{result.name}</legend>{(mechanic.kind === 'dice' || mechanic.kind === 'skillcheck' && !result.key && definition.results.length < 3) ? <div className="interaction-fields-row">{numericRange(result.id,'min',mechanic.kind === 'dice')}{numericRange(result.id,'max',mechanic.kind === 'dice')}</div> : null}
          <div className="interaction-result-continuation-controls" aria-label={es ? 'Continuación del resultado' : 'Result continuation'}>
            <ConditionReferencePicker label={es ? 'Seleccionar continuación' : 'Select continuation'} placeholder={es ? 'Seleccionar continuación existente…' : 'Select existing continuation…'} projectId={project.projectId} category="interaction-target" locale={locale} value={route?.to} disabled={routeNeedsBarrier} candidates={continuationTargets} leadingAction={{ label: es ? 'Crear continuación' : 'Create continuation', detail: es ? 'Añade un destino nuevo al flujo' : 'Add a new destination to the flow', onChoose: createContinuation, disabled: routeNeedsBarrier }} onChoose={destination => void mutate(current => setInteractionResultRoute(current,eventId,use.id,result.id,destination))} />
          </div>
          {mechanic.kind === 'dice' || mechanic.kind === 'custom' ? <button type="button" disabled={definition.results.length <= 1} onClick={event => { event.stopPropagation(); void mutate(current => deleteInteractionResult(current, eventId, use.id, result.id)); }}>{es?'Eliminar resultado':'Delete result'}</button> : null}
        </fieldset>;
      };
      const addResult = (nextResults?: InteractionDefinition['results']) => setDefinition(use.id, { results: nextResults ?? [...definition.results, { id: `result-${crypto.randomUUID()}`, name: es ? mechanic.kind === 'skillcheck' ? 'Super suerte / secreto' : 'Resultado' : mechanic.kind === 'skillcheck' ? 'Super luck / secret' : 'Result' }] });
      const inline = ownerNodeId === interactionNodeId(eventId, use.id) || uses.length === 1;
      const UseContainer = inline ? 'div' : 'details';
      return <UseContainer key={use.id} className={`interaction-card${inline ? ' interaction-card-inline' : ''}`} {...(inline ? {} : { open: true })} data-authoring-id={use.id}>
        {!inline ? <summary>{definition.name} · {use.ownerNodeId ? ({ before: es ? 'Antes' : 'Before', during: es ? 'Durante' : 'During', after: es ? 'Después' : 'After' })[use.moment] : es ? 'Nodo' : 'Node'}</summary> : null}
        {definition.mechanicPending ? <>{source}<p className="narrative-muted">{es ? 'Elige un tipo y una plantilla para configurar sus resultados.' : 'Choose a type and a template to configure its results.'}</p></> : mechanic.kind === 'dice' ? <><DiceResultsFlow key={use.id} mechanic={mechanic} results={definition.results} source={source} configuration={configuration} locale={locale} onChange={results => { void setDefinition(use.id, { results }); }} onAdd={() => { void addResult(); }} renderResult={resultEditor} /></> : <InteractionResultsFlow key={use.id} project={project} mechanic={mechanic} source={source} results={definition.results} configuration={configuration} locale={locale} onAdd={results => { void addResult(results); }} onChange={results => { void setDefinition(use.id, { results }); }} onDelete={resultId => { void mutate(current => deleteInteractionResult(current, eventId, use.id, resultId)); }} renderResult={resultEditor} />}
        {!definition.mechanicPending ? interactionDefinitionIssues(definition).map(issue => <p key={issue} role="status" className="authoring-field-error">{issue}</p>) : null}
      </UseContainer>;
    })}
    {!optionContext ? (event.interactionBarriers ?? []).filter(barrier=>!ownerNodeId||ownerNodeId===eventId||barrierNodeId(eventId,barrier.id)===ownerNodeId||dialogueScope&&barrier.dialogueId===dialogueId).map(barrier=><fieldset key={barrier.id} className="interaction-card"><legend>{es?'Barrera de espera':'Wait barrier'}</legend><AuthoringTextField projectId={project.projectId} elementId={barrier.id} field="barrier:name" label={es?'Nombre':'Name'} value={barrier.name} onCommit={name=>mutate(current=>updateInteractionBarrier(current,eventId,barrier.id,{name}))}/>{event.interactionUses?.map(use=><label className="interaction-check" key={use.id}><input type="checkbox" checked={barrier.useIds.includes(use.id)} onChange={change=>void mutate(current=>updateInteractionBarrier(current,eventId,barrier.id,{useIds:change.target.checked?[...barrier.useIds,use.id]:barrier.useIds.filter(id=>id!==use.id)}))}/>{event.interactionDefinitions?.find(definition=>definition.id===use.definitionId)?.name??use.id}</label>)}<button type="button" onClick={()=>onSelect?.(barrierNodeId(eventId,barrier.id))}>{es?'Seleccionar en canvas':'Select on canvas'}</button><button type="button" onClick={()=>void mutate(current=>deleteInteractionBarrier(current,eventId,barrier.id))}>{es?'Eliminar barrera':'Delete barrier'}</button></fieldset>):null}
  </section>;
}
