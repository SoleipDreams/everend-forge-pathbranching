import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Search, X, ArrowUpRight, Copy, MoreHorizontal, ChevronRight, RefreshCw } from 'lucide-react';
import type { InteractionDefinition, InteractionMechanicsLibrary, InteractionMechanicPreset, InteractionMechanic } from '../domain.js';
import { diceBounds, diceFormula, dicePoolForMechanic, interactionPresetKind } from '../interactionDice.js';
import { normalizeSearch, readConditionRecents, writeConditionRecent } from '../conditionAuthoring.js';
import { ConditionPickerIcon } from './ConditionReferencePicker.js';
import { useInteractionAuthoringContext } from './InteractionAuthoringContext.js';
import { interactionKindChoices } from './InteractionMechanicFields.js';
import '../interactionMechanicSelector.css';

type InteractionCategory = 'dice' | 'qte' | 'custom';
const mechanicCategory = (kind: InteractionMechanic['kind']): InteractionCategory => kind === 'opposedcheck' || kind === 'skillcheck' ? 'dice' : kind;

export function InteractionMechanicSelector({ projectId, definition, library, locale, onChoose, onSave, onReviewUpdate, placement = 'source', onOpenChange }: {
  projectId: string; definition: InteractionDefinition; library: InteractionMechanicsLibrary; locale: 'es' | 'en';
  onChoose: (preset: InteractionMechanicPreset) => Promise<boolean | void>; onSave: () => void; onReviewUpdate?: () => void;
  placement?: 'source' | 'dice-context';
  onOpenChange?: (open: boolean) => void;
}) {
  const es = locale === 'es', authoring = useInteractionAuthoringContext();
  const mechanic = definition.mechanic, pending = definition.mechanicPending;
  const currentCategory = mechanicCategory(mechanic.kind);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<'types' | 'library'>('types');
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory>(currentCategory);
  const [limit, setLimit] = useState(40);
  const [catalogView, setCatalogView] = useState<'all' | 'recent'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [recents, setRecents] = useState(() => readConditionRecents(projectId, 'mechanic-preset'));
  const trigger = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  useEffect(() => { setOpen(false); onOpenChange?.(false); setQuery(''); setSelectedCategory(currentCategory); setError(undefined); setRecents(readConditionRecents(projectId, 'mechanic-preset')); }, [projectId, definition.id, currentCategory, pending, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const field = stage === 'types' ? panel.current?.querySelector<HTMLButtonElement>('.mechanic-selector-type') : searchOpen ? search.current : searchToggle.current;
    field?.focus({ preventScroll: true });
  }, [open, stage, searchOpen]);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  const choices = interactionKindChoices(es);
  const category = open ? selectedCategory : currentCategory;
  const choice = choices.find(item => item.id === category);
  const sourcePreset = definition.presetOrigin ? library.presets.find(item => item.id === definition.presetOrigin?.presetId) : undefined;
  const dicePool = dicePoolForMechanic(mechanic);
  const dicePreset = library.presets.find(item => item.id === dicePool?.presetId)
    ?? (!dicePool?.presetId && sourcePreset && interactionPresetKind(sourcePreset) === 'dice' ? sourcePreset : undefined);
  const diceName = dicePreset?.name ?? (dicePool ? diceFormula(dicePool.dice) : '1D20');
  const updateAvailable = Boolean(sourcePreset && sourcePreset.revision > (definition.presetOrigin?.revision ?? 0));
  const icon = choice?.icon ?? 'D20';
  const compatible = library.presets.filter(item => selectedCategory === 'dice'
    ? item.mechanic.kind === 'dice' && interactionPresetKind(item) === 'dice'
    : item.mechanic.kind === selectedCategory);
  const visible = compatible.filter(item => normalizeSearch(`${item.name} ${item.description ?? ''} ${item.mechanic.kind === 'dice' ? diceFormula(item.mechanic) : ''}`).includes(normalizeSearch(query)));
  const recentItems = recents.flatMap(id => visible.find(item => item.id === id) ?? []);
  const catalog = catalogView === 'recent' ? recentItems : visible;
  const close = () => { setOpen(false); onOpenChange?.(false); };
  const resetCatalog = () => { setSearchOpen(false); setQuery(''); setCatalogView('all'); setLimit(40); setError(undefined); };
  const showTypes = () => { resetCatalog(); setStage('types'); };
  const chooseType = (type: InteractionCategory) => { setSelectedCategory(type); resetCatalog(); setStage('library'); };
  const openSelector = () => {
    if (open) { close(); return; }
    resetCatalog(); setSelectedCategory(currentCategory); setStage(pending ? 'types' : 'library'); setOpen(true); onOpenChange?.(true);
    setRecents(readConditionRecents(projectId, 'mechanic-preset')); void authoring?.refreshLibrary?.();
  };
  const choose = async (preset: InteractionMechanicPreset) => {
    setBusy(true); setError(undefined);
    try { const applied = await onChoose(preset); if (applied !== false) setRecents(writeConditionRecent(projectId, 'mechanic-preset', preset.id)); close(); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const detail = (preset: InteractionMechanicPreset) => preset.mechanic.kind === 'dice' ? `${diceFormula(preset.mechanic, preset.mechanic.modifier)} · Total ${diceBounds(preset.mechanic, preset.mechanic.modifier).min}–${diceBounds(preset.mechanic, preset.mechanic.modifier).max}` : preset.description;
  const selectionHint = es ? 'Los resultados conservan sus rutas y consecuencias al cambiar la plantilla.' : 'Results keep their routes and consequences when changing the template.';
  const triggerLabel = open ? es ? 'Cerrar selector de plantillas' : 'Close template picker' : pending ? es ? 'Elegir interacción' : 'Choose interaction' : currentCategory === 'dice' ? es ? 'Cambiar set de dados' : 'Change dice set' : es ? 'Cambiar mecánica' : 'Change mechanic';
  const render = (preset: InteractionMechanicPreset) => <button key={preset.id} type="button" className="mechanic-selector-result" title={[preset.name, detail(preset)].filter(Boolean).join(' · ')} aria-pressed={!pending && definition.presetOrigin?.presetId === preset.id} disabled={busy} onClick={() => void choose(preset)}>
    <ConditionPickerIcon name={choice?.icon} size={22} />
    <span><strong>{preset.name}</strong><small>{detail(preset)}</small></span>
  </button>;
  const triggerButton = <button ref={trigger} type="button" className="mechanic-selector-trigger" aria-label={triggerLabel} aria-expanded={open} aria-controls={panelId} title={triggerLabel} disabled={busy} onClick={openSelector}>
      {pending && (!open || stage === 'types') ? <Plus size={36} aria-hidden="true" /> : <ConditionPickerIcon name={icon} size={44} />}
    </button>;
  return <section className={`mechanic-selector${open ? ' open' : ''}${placement === 'dice-context' ? ' mechanic-selector-context' : ''}`} aria-label={es ? 'Mecánica de esta interacción' : 'Interaction mechanic'}>
    {placement === 'dice-context' ? <div className="mechanic-selector-selection">{triggerButton}{currentCategory === 'dice' && !pending ? <strong className="mechanic-selector-dice-name">{diceName}</strong> : null}</div> : triggerButton}
    {open ? <section ref={panel} id={panelId} data-stage={stage} data-placement={placement} className="mechanic-selector-panel" aria-label={stage === 'types' ? es ? 'Tipos de interacción' : 'Interaction types' : es ? 'Plantillas de interacción' : 'Interaction templates'} onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        const actions = event.currentTarget.querySelector<HTMLDetailsElement>('.mechanic-selector-more[open]');
        if (actions) { actions.open = false; actions.querySelector<HTMLElement>('summary')?.focus(); }
        else if (searchOpen) { setSearchOpen(false); setQuery(''); }
        else close();
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (event.target === search.current || (event.target as HTMLElement).closest('.mechanic-selector-result,.mechanic-selector-type'))) {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.mechanic-selector-result:not(:disabled),.mechanic-selector-type:not(:disabled)')];
        if (!buttons.length) return;
        event.preventDefault(); const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
      }
      if (event.key === 'Enter' && event.target === search.current) { event.preventDefault(); const first = catalog[0]; if (first && !busy) void choose(first); }
    }}>
      {stage === 'types' ? <header className="mechanic-selector-type-header"><strong>{es ? 'Tipo de interacción' : 'Interaction type'}</strong><button type="button" className="mechanic-selector-close-types" aria-label={es ? 'Cerrar selector' : 'Close picker'} onClick={close}><X size={16} /></button></header> : null}
      {stage === 'types' ? <div className="mechanic-selector-types">{choices.map(type => <button key={type.id} type="button" className="mechanic-selector-type" title={`${type.label} · ${type.detail}`} aria-label={type.label} onClick={() => chooseType(type.id as InteractionCategory)}>
        <ConditionPickerIcon name={type.icon} size={24} /><span><strong>{type.label}</strong><small>{type.detail}</small></span><ChevronRight size={14} aria-hidden="true" />
      </button>)}</div> : <>
      {placement === 'dice-context' ? <div className="mechanic-selector-type-tabs" role="tablist" aria-label={es ? 'Tipo de interacción' : 'Interaction type'} onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
        if (!tabs.length) return;
        event.preventDefault();
        const index = tabs.indexOf(document.activeElement as HTMLButtonElement), delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(index + delta + tabs.length) % tabs.length];
        next?.focus(); next?.click();
      }}>{choices.map(type => <button key={type.id} type="button" role="tab" aria-selected={selectedCategory === type.id} tabIndex={selectedCategory === type.id ? 0 : -1} title={type.detail} onClick={() => { setSelectedCategory(type.id as InteractionCategory); resetCatalog(); setStage('library'); }}>{type.label}</button>)}</div> : null}
      <header>
      <div className={`mechanic-selector-catalog-controls${searchOpen ? ' search-open' : ''}`}>
      {searchOpen ? <label><input id={`${panelId}-search`} ref={search} type="search" value={query} aria-label={selectedCategory === 'dice' ? es ? 'Buscar sets de dados' : 'Search dice sets' : es ? 'Buscar mecánicas' : 'Search mechanics'} placeholder={selectedCategory === 'dice' ? es ? 'Nombre o fórmula…' : 'Name or formula…' : es ? 'Nombre o fórmula…' : 'Name or formula…'} onChange={event => { setQuery(event.target.value); setLimit(40); }} /></label> : <div className="mechanic-selector-filters" role="group" aria-label={es ? 'Origen de las mecánicas' : 'Mechanic source'}>
        <button type="button" aria-pressed={catalogView === 'all'} onClick={() => { setCatalogView('all'); setLimit(40); }}>{es ? 'Biblioteca' : 'Library'} <span>{visible.length}</span></button>
        <button type="button" aria-pressed={catalogView === 'recent'} onClick={() => { setCatalogView('recent'); setLimit(40); }}>{es ? 'Recientes' : 'Recent'} <span>{recentItems.length}</span></button>
      </div>}
      </div>
      <div className="mechanic-selector-tools">
        <button ref={searchToggle} type="button" aria-label={es ? 'Buscar mecánicas' : 'Search mechanics'} title={es ? 'Buscar mecánicas' : 'Search mechanics'} aria-expanded={searchOpen} aria-controls={`${panelId}-search`} onClick={() => { setSearchOpen(!searchOpen); setQuery(''); setCatalogView('all'); setLimit(40); }}><Search size={16} /></button>
        <button type="button" className="mechanic-selector-create" aria-label={selectedCategory === 'dice' ? es ? 'Crear set de dados' : 'Create dice set' : es ? 'Crear mecánica' : 'Create mechanic'} title={es ? 'Crear en Recursos → Interacciones' : 'Create in Resources → Interactions'} onClick={() => authoring?.openLibrary?.()}><Plus size={16} /><span>{es ? 'Crear' : 'Create'}</span></button>
        {!pending ? <details className="mechanic-selector-more"><summary aria-label={es ? 'Más acciones de la mecánica' : 'More mechanic actions'} title={es ? 'Más acciones' : 'More actions'}><MoreHorizontal size={16} /></summary><div className="mechanic-selector-more-panel">
          <button type="button" disabled={busy} onClick={onSave}><Copy size={14} />{es ? 'Guardar copia en Recursos' : 'Save copy in Resources'}</button>
          {updateAvailable && onReviewUpdate ? <button type="button" onClick={onReviewUpdate}><RefreshCw size={14} />{es ? 'Revisar actualización' : 'Review update'} · v{sourcePreset!.revision}</button> : null}
          {definition.presetOrigin ? <button type="button" onClick={() => authoring?.openLibrary?.(definition.presetOrigin?.presetId)}><ArrowUpRight size={14} />{es ? 'Editar en Recursos' : 'Edit in Resources'}</button> : null}
          <p>{selectionHint}</p>
        </div></details> : null}
        <button type="button" aria-label={es ? 'Cerrar selector' : 'Close picker'} title={es ? 'Cerrar selector' : 'Close picker'} onClick={close}><X size={16} /></button>
      </div>
      </header>
      <div className="mechanic-selector-catalog" aria-label={catalogView === 'recent' ? es ? 'Mecánicas recientes' : 'Recent mechanics' : es ? 'Mecánicas disponibles' : 'Available mechanics'}>
        {catalog.slice(0, limit).map(render)}
        {!catalog.length ? <p>{es ? catalogView === 'recent' ? 'Sin selecciones recientes que coincidan.' : selectedCategory === 'dice' ? 'No hay sets de dados disponibles.' : 'No hay plantillas de este tipo.' : catalogView === 'recent' ? 'No matching recent selections.' : selectedCategory === 'dice' ? 'No dice sets available.' : 'No matching templates of this type.'}</p> : null}
        {catalog.length > limit ? <button type="button" onClick={() => setLimit(limit + 40)}>{es ? 'Mostrar más' : 'Show more'}</button> : null}
      </div>
      </>}
      {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
    </section> : null}
  </section>;
}
