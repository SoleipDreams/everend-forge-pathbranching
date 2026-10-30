import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, UserRound } from 'lucide-react';
import type { BranchingProject, CanonPropertyDescriptor, LogicSubject, PlayerSimulationState } from '../domain.js';
import type { ConditionAuthoringContext } from '../conditionAuthoring.js';
import { readConditionRecents, writeConditionRecent } from '../conditionAuthoring.js';
import { characterNumericFields, resolveCharacterProperty } from '../characterStats.js';
import { characterSheetEntries, characterStoryReferences, type CharacterSheetEntry } from '../characterSheets.js';
import { useInterfaceLocale } from '../i18n.js';
import '../characterSheets.css';

export type CanonEntityTarget = { entityId: string; variantId?: string; propertyId?: string };

export type CharacterSheetsPanelProps = {
  project: BranchingProject;
  context?: ConditionAuthoringContext;
  initialState?: PlayerSimulationState;
  currentState?: PlayerSimulationState;
  initialOwnerLabel?: string;
  onOpenCanonEntity?: (target: CanonEntityTarget) => void | Promise<void>;
};

type CharacterGroup = {
  entityId: string;
  name: string;
  source: 'canon' | 'local';
  variants: CharacterSheetEntry[];
  instances: CharacterSheetEntry[];
  entries: CharacterSheetEntry[];
  context: string[];
  inStory: boolean;
  recognizedVariantIds: Set<string>;
  recentIndex: number;
};

function preferredEntry(group: CharacterGroup) {
  return group.variants.find(entry => group.recognizedVariantIds.has(entry.variantId))
    ?? group.variants.find(entry => entry.contextual)
    ?? group.variants.find(entry => entry.variantId === 'base')
    ?? group.variants[0]
    ?? group.instances[0];
}

function fieldGroup(field: CanonPropertyDescriptor, es: boolean) {
  return field.groupPath?.join(' › ') || (es ? 'Atributos' : 'Attributes');
}

export function CharacterSheetsPanel({ project, context, initialState = {}, currentState, initialOwnerLabel, onOpenCanonEntity }: CharacterSheetsPanelProps) {
  const es = useInterfaceLocale() === 'es';
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'story' | 'all'>('story');
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [limit, setLimit] = useState(40);
  const [recentIds, setRecentIds] = useState(() => readConditionRecents(project.projectId, 'character-sheets'));

  useEffect(() => { setLimit(40); }, [scope, search]);
  useEffect(() => {
    setRecentIds(readConditionRecents(project.projectId, 'character-sheets'));
    setSelectedEntityId(undefined);
    setSelectedEntryId(undefined);
  }, [project.projectId]);

  const entries = useMemo(
    () => characterSheetEntries(project, context, currentState ?? initialState),
    [project, context, currentState, initialState],
  );
  const storyReferences = useMemo(() => characterStoryReferences(project), [project]);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

  const groups = useMemo(() => {
    const byEntity = new Map<string, CharacterSheetEntry[]>();
    entries.forEach(entry => byEntity.set(entry.entityId, [...(byEntity.get(entry.entityId) ?? []), entry]));
    return [...byEntity.entries()].map(([entityId, entityEntries]): CharacterGroup => {
      const variants = entityEntries.filter(entry => !entry.instanceId);
      const instances = entityEntries.filter(entry => Boolean(entry.instanceId));
      const recentIndex = Math.min(
        ...[entityId, ...entityEntries.map(entry => entry.id)]
          .map(id => recentIds.indexOf(id))
          .filter(index => index >= 0),
        99,
      );
      return {
        entityId,
        name: entityEntries[0].name,
        source: entityEntries[0].source,
        variants,
        instances,
        entries: entityEntries,
        context: [...new Set(entityEntries.flatMap(entry => entry.context))],
        inStory: storyReferences.entityIds.has(entityId),
        recognizedVariantIds: storyReferences.variantIds.get(entityId) ?? new Set<string>(),
        recentIndex,
      };
    });
  }, [entries, recentIds, storyReferences]);

  const query = normalize(search);
  const matches = groups
    .filter(group => scope === 'all' || group.inStory)
    .filter(group => normalize([
      group.name,
      ...group.variants.map(entry => entry.variantName),
      ...group.instances.map(entry => entry.name),
      ...group.context,
    ].join(' ')).includes(query))
    .sort((a, b) => a.recentIndex - b.recentIndex || a.name.localeCompare(b.name));
  const shown = matches.slice(0, limit);
  const selectedGroup = shown.find(group => group.entityId === selectedEntityId) ?? shown[0];
  const selectedEntry = selectedGroup
    ? selectedGroup.entries.find(entry => entry.id === selectedEntryId) ?? preferredEntry(selectedGroup)
    : undefined;

  const fields = selectedEntry
    ? characterNumericFields(project, selectedEntry.subject, currentState ?? initialState)
    : [];
  const attributeGroups = [...new Set(fields.map(field => fieldGroup(field, es)))];
  const actor = currentState?.context?.actor ?? initialState.context?.actor;
  const actorIdentity = actor?.kind === 'entity'
    ? JSON.stringify([actor.entityId, actor.variantId ?? 'base'])
    : actor?.kind === 'instance'
      ? `instance:${actor.instanceId}`
      : undefined;
  const rivalIdentities = new Set((project.events.find(event => event.id === context?.eventId)?.interactionDefinitions ?? [])
    .flatMap(definition => definition.mechanic.kind === 'opposedcheck'
      ? definition.mechanic.rivals.map(rival => rival.subject.kind === 'entity'
        ? JSON.stringify([rival.subject.entityId, rival.subject.variantId ?? 'base'])
        : rival.subject.kind === 'instance' ? `instance:${rival.subject.instanceId}` : '')
      : []));

  const selectEntry = (group: CharacterGroup, entry: CharacterSheetEntry | undefined) => {
    setSelectedEntityId(group.entityId);
    setSelectedEntryId(entry?.id);
    writeConditionRecent(project.projectId, 'character-sheets', group.entityId);
    setRecentIds(readConditionRecents(project.projectId, 'character-sheets'));
  };
  const resolvedValue = (state: PlayerSimulationState, propertyId: string, baseOnly = false) => {
    if (!selectedEntry) return {};
    const subjectState = baseOnly
      ? { ...state, entityInstances: currentState?.entityInstances ?? initialState.entityInstances ?? project.entityInstances }
      : state;
    return resolveCharacterProperty(project, subjectState, selectedEntry.subject, propertyId, {
      baseOnly,
      purpose: 'display',
    });
  };
  const displayValue = (resolved: { value?: unknown }) =>
    typeof resolved.value === 'number' && Number.isFinite(resolved.value) ? resolved.value : '-';
  const breakdown = (value: ReturnType<typeof resolveCharacterProperty> | undefined) => value?.modifiers?.length
    ? `${value.unmodifiedValue} ${value.modifiers.map(modifier => `${modifier.amount >= 0 ? '+' : '−'} ${Math.abs(modifier.amount)} (${modifier.name})`).join(' ')} = ${value.value}` : undefined;

  return <section className="character-sheets" data-current-state={Boolean(currentState)} aria-label={es ? 'Fichas de personajes' : 'Character sheets'}>
    <div className="character-sheets-toolbar">
      <strong><UserRound size={16} />{es ? 'Fichas de personajes' : 'Character sheets'}</strong>
      <div className="character-sheet-scope" role="group" aria-label={es ? 'Ámbito de personajes' : 'Character scope'}>
        <button type="button" aria-pressed={scope === 'story'} onClick={() => setScope('story')}>{es ? 'En esta historia' : 'In this story'}</button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{es ? 'Todo el universo' : 'Whole universe'}</button>
      </div>
    </div>

    {initialOwnerLabel ? <p className="character-sheet-state-context">{es ? 'Valores iniciales de' : 'Initial values for'}: {initialOwnerLabel}</p> : null}

    <label className="character-sheets-search">
      <Search size={15} />
      <input type="search" aria-label={es ? 'Buscar fichas' : 'Search sheets'} placeholder={es ? 'Buscar personaje o variante…' : 'Search character or variant…'} value={search} onChange={event => setSearch(event.target.value)} />
    </label>

    <ul className="character-sheet-catalog" aria-label={es ? 'Personajes y variantes' : 'Characters and variants'}>
      {shown.map(group => {
        const recognized = group.variants.filter(entry => group.recognizedVariantIds.has(entry.variantId));
        const contextLabel = recognized.length === 1
          ? `${es ? 'Reconocida' : 'Recognized'} · ${recognized[0].variantName}`
          : group.context.join(' · ') || (group.inStory ? (es ? 'Esta historia' : 'This story') : (es ? 'Universo' : 'Universe'));
        const variantsLabel = group.variants.map(entry => entry.variantName).join(' · ');
        const isActor = group.entries.some(entry => entry.id === actorIdentity);
        const isRival = group.entries.some(entry => rivalIdentities.has(entry.id));
        return <li key={group.entityId}>
          <button
            type="button"
            className={group.entityId === selectedGroup?.entityId ? 'active' : ''}
            aria-pressed={group.entityId === selectedGroup?.entityId}
            onClick={() => selectEntry(group, preferredEntry(group))}
          >
            <UserRound size={19} />
            <span>
              <strong>{group.name}</strong>
              <small>{group.source === 'canon' ? 'Canon' : 'Local'} · {variantsLabel}{group.instances.length ? ` · ${group.instances.length} ${es ? 'copias' : 'copies'}` : ''}</small>
              <small>{contextLabel}{isActor ? ` · ${es ? 'Personaje actual' : 'Current actor'}` : ''}{isRival ? ` · ${es ? 'Rival' : 'Opponent'}` : ''}</small>
            </span>
          </button>
        </li>;
      })}
    </ul>

    {matches.length > shown.length ? <button type="button" className="character-sheet-more" onClick={() => setLimit(current => current + 40)}>{es ? 'Mostrar más' : 'Show more'}</button> : null}
    {!shown.length ? <p className="character-sheet-empty-message">{es ? 'No hay personajes en esta historia. Puedes consultar todo el universo.' : 'No characters in this story. You can browse the whole universe.'}</p> : null}

    {selectedGroup && selectedEntry ? <article className="character-sheet-detail" data-character-sheet={selectedGroup.entityId}>
      <header>
        <div>
          <h3>{selectedGroup.name}</h3>
          <p>{selectedGroup.source === 'canon' ? (es ? 'Canon' : 'Canon') : (es ? 'Local' : 'Local')}{selectedEntry.instanceId ? ` · ${es ? 'Copia individual' : 'Individual copy'}` : ''}</p>
        </div>
        {selectedEntry.source === 'canon' && onOpenCanonEntity ? <button type="button" onClick={() => { void onOpenCanonEntity({ entityId: selectedEntry.entityId, variantId: selectedEntry.variantId }); }}><BookOpen size={15} />{es ? 'Editar en WorldNotion' : 'Edit in WorldNotion'}</button> : null}
      </header>

      {selectedGroup.variants.length ? <section className="character-sheet-variant-picker" aria-label={es ? 'Variantes del personaje' : 'Character variants'}>
        <h4>{es ? 'Variantes' : 'Variants'}</h4>
        <div>
          {selectedGroup.variants.map(entry => {
            const recognized = selectedGroup.recognizedVariantIds.has(entry.variantId);
            return <button key={entry.id} type="button" aria-pressed={entry.id === selectedEntry.id} onClick={() => selectEntry(selectedGroup, entry)}>
              <span>{entry.variantName}</span>
              {recognized ? <small>{es ? 'Reconocida en esta historia' : 'Recognized in this story'}</small> : null}
            </button>;
          })}
        </div>
      </section> : null}

      {selectedGroup.instances.length ? <section className="character-sheet-instance-picker" aria-label={es ? 'Copias del personaje' : 'Character copies'}>
        <h4>{es ? 'Copias' : 'Copies'}</h4>
        <div>
          {selectedGroup.instances.map(entry => <button key={entry.id} type="button" aria-pressed={entry.id === selectedEntry.id} onClick={() => selectEntry(selectedGroup, entry)}>
            {entry.name}{entry.variantName ? ` · ${entry.variantName}` : ''}
          </button>)}
        </div>
      </section> : null}

      {attributeGroups.map(group => <section className="character-sheet-stat-group" key={group}>
        <h4>{group}</h4>
        <div className="character-sheet-stat-columns"><span>{es ? 'Atributo' : 'Attribute'}</span><span>{es ? 'Base' : 'Base'}</span><span>{es ? 'Inicial' : 'Initial'}</span>{currentState ? <span>{es ? 'Actual' : 'Current'}</span> : null}</div>
        {fields.filter(field => fieldGroup(field, es) === group).map(field => {
          const base = resolvedValue({}, field.id, true);
          const initial = resolvedValue(initialState, field.id);
          const current = currentState ? resolvedValue(currentState, field.id) : undefined;
          return <div className="character-sheet-stat" key={field.id}>
            <span title={field.path.join(' › ')}>{field.label}</span>
            <output>{displayValue(base)}</output>
            <output title={breakdown(initial)}>{displayValue(initial)}</output>
            {current ? <output title={breakdown(current)}>{displayValue(current)}</output> : null}
          </div>;
        })}
      </section>)}

      {!fields.length ? <section className="character-sheet-stat-group character-sheet-no-attributes">
        <h4>{es ? 'Atributos' : 'Attributes'}</h4>
        <span>-</span>
      </section> : null}
    </article> : null}
  </section>;
}
