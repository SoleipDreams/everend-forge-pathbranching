import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Box, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CodeXml, Footprints, PackageSearch, Plus, Search, SlidersHorizontal, UserRound, Variable, X } from 'lucide-react';
import { normalizeSearch, rankConditionCandidates, readConditionRecents, writeConditionRecent } from '../conditionAuthoring.js';
import '../conditionPicker.css';

export type ConditionPickerCandidate = {
  id: string;
  label: string;
  /** Optional compact trigger text; the menu keeps the complete name. */
  shortLabel?: string;
  detail?: string;
  icon?: string;
  group?: 'context' | 'nearby' | 'all';
  /** Optional hierarchy section for browsable destination catalogs. */
  section?: string;
  /** Stable ordering within the picker; relevance still takes precedence while searching. */
  priority?: number;
  /** Optional second selection step shown inside the same picker. */
  children?: ConditionPickerCandidate[];
  /** Internal resolved metadata for nested candidates. */
  parentId?: string;
  parentLabel?: string;
  compositeLabel?: string;
};

export type ConditionPickerLeadingAction = { label: string; detail?: string; onChoose: () => void; disabled?: boolean };

export type ConditionReferencePickerProps = {
  label: string;
  value?: string;
  candidates: ConditionPickerCandidate[];
  onChoose: (id: string) => void;
  projectId: string;
  category: string;
  locale?: 'es' | 'en';
  placeholder?: string;
  disabled?: boolean;
  autoOpen?: boolean;
  searchable?: boolean;
  invalid?: boolean;
  multiple?: boolean;
  selectedIds?: string[];
  /** Scalar list entries use the same chip picker, while entity references stay catalog-only. */
  allowCustomValue?: boolean;
  /** Action shown before reference candidates, useful for creating a destination inline. */
  leadingAction?: ConditionPickerLeadingAction;
};

/** Icons are shared by the trigger, type menu and contextual search results. */
export function ConditionPickerIcon({ name, size = 16 }: { name?: string; size?: number }) {
  if (name === 'D20') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2.5 8.3 4.8 1 7.7-5.5 7h-7.6l-5.5-7 1-7.7L12 2.5Z" />
    <path d="m12 2.5-3.5 5.4L12 11l3.5-3.1L12 2.5ZM3.7 7.3l4.8.6-.8 4.1L3 15l.7-7.7ZM20.3 7.3l-4.8.6.8 4.1L21 15l-.7-7.7ZM7.7 12l4.3-1 4.3 1M7.7 12l1.5 6 2.8 4 2.8-4 1.5-6M8.2 21.5 9.2 18h5.6l1.2 3.5" />
    <text x="12" y="15.5" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="700">20</text>
  </svg>;
  const Icon = ({ CircleCheck, SlidersHorizontal, Variable, Footprints, PackageSearch, CodeXml, UserRound, Box, Search } as const)[name as 'Box'] ?? Box;
  return <Icon size={size} aria-hidden="true" />;
}

const rank = { context: 0, nearby: 1, all: 2 };
const PAGE_SIZE = 40;

/** Contextual catalog picker. UI state and recent selections never enter the story document. */
export function ConditionReferencePicker({ label, value, candidates, onChoose, projectId, category, locale = 'es', placeholder, disabled, autoOpen, searchable = true, invalid, multiple, selectedIds = [], allowCustomValue, leadingAction }: ConditionReferencePickerProps) {
  const es = locale === 'es';
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(Boolean(autoOpen && !disabled));
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [subChoiceParentId, setSubChoiceParentId] = useState<string>();
  const [recents, setRecents] = useState<string[]>(() => readConditionRecents(projectId, category));
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320, maxHeight: 400 });
  const previousScope = useRef(`${projectId}\u0000${category}`);
  const autoOpened = useRef(Boolean(autoOpen && !disabled));
  const [portalHost, setPortalHost] = useState<Element>();
  useLayoutEffect(() => { setPortalHost(trigger.current?.closest('.pathbranching-app') ?? document.body); }, []);

  const catalog = useMemo(() => {
    const byId = new Map<string, ConditionPickerCandidate>();
    for (const candidate of candidates) {
      const previous = byId.get(candidate.id);
      if (!previous || rank[candidate.group ?? 'all'] < rank[previous.group ?? 'all']) byId.set(candidate.id, candidate);
    }
    return [...byId.values()];
  }, [candidates]);
  const subChoices = useMemo(() => catalog.flatMap(parent => (parent.children ?? []).map(child => ({
    ...child,
    parentId: parent.id,
    parentLabel: parent.label,
    compositeLabel: `${parent.label} / ${child.label}`,
    group: child.group ?? parent.group,
  }))), [catalog]);
  const byId = useMemo(() => new Map([...catalog, ...subChoices].map(candidate => [candidate.id, candidate])), [catalog, subChoices]);
  const searchCatalog = useMemo(() => catalog.flatMap(candidate => candidate.children?.length
    ? candidate.children.map(child => ({ ...child, label: `${candidate.label} / ${child.label}`, detail: child.detail ?? candidate.detail, group: child.group ?? candidate.group }))
    : [candidate]), [catalog]);
  const selected = value !== undefined ? byId.get(value) : undefined;
  const multiSelection = selectedIds.map(selectedId => byId.get(selectedId) ?? { id: selectedId, label: es ? 'Referencia no disponible' : 'Reference unavailable' });
  const missing = value !== undefined && !selected;
  const emptyLabel = placeholder ?? (es ? 'Seleccionar…' : 'Choose…');
  const selectedLabel = selected?.compositeLabel ?? selected?.label;
  const displayLabel = multiple && selectedIds.length ? multiSelection.map(candidate => candidate.compositeLabel ?? candidate.label).join(', ') : selectedLabel ?? (missing ? (es ? 'Referencia no disponible' : 'Reference unavailable') : emptyLabel);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    setQuery('');
    setShowAll(false);
    setLimit(PAGE_SIZE);
    setSubChoiceParentId(undefined);
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  }, []);
  const openPicker = () => {
    setRecents(readConditionRecents(projectId, category));
    setQuery('');
    setShowAll(false);
    setLimit(PAGE_SIZE);
    setOpen(true);
  };

  useEffect(() => {
    const scope = `${projectId}\u0000${category}`;
    if (previousScope.current !== scope) {
      previousScope.current = scope;
      setRecents(readConditionRecents(projectId, category));
      close();
      autoOpened.current = Boolean(autoOpen);
      return;
    }
    if (autoOpen && !autoOpened.current && !disabled) {
      autoOpened.current = true;
      setOpen(true);
    } else if (!autoOpen) autoOpened.current = false;
    if (disabled) close();
  }, [projectId, category, autoOpen, disabled, close]);

  const updatePosition = useCallback(() => {
    if (!trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0;
    const topEdge = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const margin = 8, gap = 6;
    const width = Math.min(searchable ? Math.max(anchor.width, 340) : Math.max(anchor.width, 260), viewportWidth - margin * 2);
    const below = topEdge + viewportHeight - anchor.bottom - gap - margin;
    const above = anchor.top - topEdge - gap - margin;
    const prefersAbove = below < Math.min(300, above);
    const available = Math.max(80, prefersAbove ? above : below);
    const maxHeight = Math.min(460, available, viewportHeight - margin * 2);
    const renderedHeight = Math.min(panel.current?.scrollHeight ?? maxHeight, maxHeight);
    const top = prefersAbove ? anchor.top - renderedHeight - gap : anchor.bottom + gap;
    setPosition({
      left: Math.max(leftEdge + margin, Math.min(anchor.left, leftEdge + viewportWidth - width - margin)),
      top: Math.max(topEdge + margin, Math.min(top, topEdge + viewportHeight - renderedHeight - margin)),
      width,
      maxHeight,
    });
  }, [searchable]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    if (searchable) input.current?.focus({ preventScroll: true });
    else panel.current?.querySelector<HTMLButtonElement>('[data-condition-candidate]')?.focus({ preventScroll: true });
  }, [open, searchable, updatePosition, portalHost, subChoiceParentId]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) updatePosition();
    };
    const focus = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focus);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updatePosition);
    if (panel.current) resizeObserver?.observe(panel.current);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      resizeObserver?.disconnect();
    };
  }, [open, close, updatePosition]);

  const search = normalizeSearch(query).trim();
  const matches: ConditionPickerCandidate[] = searchable
    ? rankConditionCandidates((search ? searchCatalog : catalog).map(candidate => ({ ...candidate, detail: candidate.detail ?? '', group: candidate.group ?? 'all' })), query, recents)
      .flatMap(candidate => { const full = byId.get(candidate.id); return full ? [{ ...full, label: candidate.label, detail: candidate.detail ?? full.detail, group: candidate.group ?? full.group }] : []; })
    : catalog;
  const seen = new Set<string>();
  const collect = (items: ConditionPickerCandidate[]) => {
    const collected: ConditionPickerCandidate[] = [];
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      collected.push(item);
      if (collected.length === 6) break;
    }
    return collected;
  };
  const contextItems = collect(catalog.filter(candidate => candidate.group === 'context'));
  const nearbyItems = collect(catalog.filter(candidate => candidate.group === 'nearby'));
  const recentItems = collect(recents.flatMap(recentId => {
    const candidate = byId.get(recentId);
    return candidate ? [{ ...candidate, label: candidate.compositeLabel ?? candidate.label }] : [];
  }));
  const hasSuggestions = contextItems.length + nearbyItems.length + recentItems.length > 0;
  const browsingAll = Boolean(subChoiceParentId && !search) || !searchable || search !== '' || showAll || !hasSuggestions;
  const subChoiceParent = subChoiceParentId ? catalog.find(candidate => candidate.id === subChoiceParentId) : undefined;
  const visibleCandidates = subChoiceParent && !search
    ? subChoiceParent.children ?? []
    : browsingAll ? (searchable ? matches.slice(0, limit) : catalog) : [];
  const customValue = allowCustomValue && query.trim() && !catalog.some(candidate => normalizeSearch(candidate.label).trim() === search) ? query.trim() : undefined;

  const choose = (candidateId: string) => {
    if (disabled) return;
    const candidate = byId.get(candidateId);
    if (candidate?.children?.length) {
      setSubChoiceParentId(candidate.id);
      setQuery('');
      setShowAll(false);
      setLimit(PAGE_SIZE);
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
      return;
    }
    writeConditionRecent(projectId, category, candidateId);
    setRecents(readConditionRecents(projectId, category));
    if (!multiple) close(true);
    onChoose(candidateId);
    if (multiple) input.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && subChoiceParentId && !search) {
      event.preventDefault(); event.stopPropagation(); setSubChoiceParentId(undefined);
      requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(true); return;
    }
    const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-condition-candidate]:not(:disabled),[data-condition-action]:not(:disabled)') ?? [])];
    if (event.key === 'Enter' && event.target === input.current) {
      const first = search
        ? panel.current?.querySelector<HTMLButtonElement>('[data-condition-candidate]:not(:disabled)')
        : panel.current?.querySelector<HTMLButtonElement>('[data-condition-action]:not(:disabled),[data-condition-candidate]:not(:disabled)');
      if (first) { event.preventDefault(); event.stopPropagation(); first.click(); return; }
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !items.length) return;
    if (event.target === input.current && (event.key === 'Home' || event.key === 'End')) return;
    event.preventDefault(); event.stopPropagation();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus({ preventScroll: true });
    items[next]?.scrollIntoView({ block: 'nearest' });
  };

  const renderCandidate = (candidate: ConditionPickerCandidate) => {
    const isSelected = multiple ? selectedIds.includes(candidate.id) : candidate.id === value;
    const hasSubChoices = Boolean(candidate.children?.length);
    return <button key={candidate.id} type="button" role={searchable ? 'option' : 'menuitemradio'} aria-selected={searchable ? isSelected : undefined} aria-checked={!searchable ? isSelected : undefined} aria-haspopup={hasSubChoices ? 'menu' : undefined} aria-expanded={hasSubChoices ? subChoiceParentId === candidate.id : undefined} data-condition-candidate={candidate.id} className={`condition-picker-result${isSelected ? ' selected' : ''}`} onClick={() => choose(candidate.id)} title={`${candidate.label}${candidate.detail ? ` · ${candidate.detail}` : ''}`}>
      <span className="condition-picker-result-icon"><ConditionPickerIcon name={candidate.icon} /></span>
      <span className="condition-picker-result-copy"><span>{candidate.label}</span>{candidate.detail ? <small>{candidate.detail}</small> : null}</span>
      {hasSubChoices ? <ChevronRight size={15} className="condition-picker-result-subchoice" aria-hidden="true" /> : isSelected ? <Check size={15} className="condition-picker-result-check" aria-hidden="true" /> : null}
    </button>;
  };
  const renderGroup = (title: string, items: ConditionPickerCandidate[]) => items.length ? <section className="condition-picker-result-group" aria-label={title} key={title}>
    <h4>{title}</h4><div role="group" aria-label={title}>{items.map(renderCandidate)}</div>
  </section> : null;
  const renderSections = (items: ConditionPickerCandidate[]) => {
    if (!items.some(candidate => candidate.section)) return items.map(renderCandidate);
    const sections = new Map<string, ConditionPickerCandidate[]>();
    for (const candidate of items) {
      const title = candidate.section ?? (es ? 'Otros destinos' : 'Other destinations');
      sections.set(title, [...(sections.get(title) ?? []), candidate]);
    }
    return [...sections].map(([title, sectionItems]) => renderGroup(title, sectionItems));
  };

  return <div className={`condition-reference-picker${invalid || missing ? ' invalid' : ''}${open ? ' open' : ''}`}>
    <button ref={trigger} type="button" className="condition-picker-trigger" aria-label={label} aria-haspopup={searchable ? 'dialog' : 'menu'} aria-expanded={open} aria-controls={open ? id : undefined} aria-invalid={invalid || missing || undefined} title={displayLabel} disabled={disabled} onClick={() => open ? close(true) : openPicker()} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); event.stopPropagation();
        if (!open) openPicker();
        else {
          const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[data-condition-candidate],[data-condition-action]') ?? [])];
          (event.key === 'ArrowUp' ? items.at(-1) : items[0])?.focus({ preventScroll: true });
        }
      }
    }}>
      {selected?.icon ? <ConditionPickerIcon name={selected.icon} /> : null}
      {multiple && selectedIds.length ? <span className="condition-picker-selected-chips">{multiSelection.slice(0, 2).map(candidate => <span key={candidate.id}>{candidate.label}</span>)}{multiSelection.length > 2 ? <span>+{multiSelection.length - 2}</span> : null}</span> : <span className={`condition-picker-trigger-text${value === undefined ? ' placeholder' : ''}`}>{selected?.shortLabel ? <><span className="condition-picker-label-full">{displayLabel}</span><span className="condition-picker-label-short">{selected.shortLabel}</span></> : displayLabel}</span>}
      <ChevronDown size={14} className="condition-picker-chevron" aria-hidden="true" />
    </button>
    {open && portalHost ? createPortal(<div ref={panel} id={id} className={`condition-picker-popover${searchable ? '' : ' compact'}`} role={searchable ? 'dialog' : 'menu'} aria-label={label} style={{ position: 'fixed', ...position }} onKeyDown={handleKeyDown}>
      {searchable ? <div className="condition-picker-search"><Search size={16} aria-hidden="true" /><input ref={input} type="text" aria-label={es ? `Buscar ${label.toLocaleLowerCase()}` : `Search ${label.toLocaleLowerCase()}`} placeholder={es ? 'Buscar por nombre o contexto…' : 'Search name or context…'} value={query} autoComplete="off" onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} /><button type="button" aria-label={es ? 'Cerrar selector' : 'Close picker'} onClick={() => close(true)}><X size={16} aria-hidden="true" /></button></div> : null}
      {multiple && multiSelection.length && searchable ? <div className="condition-picker-selection-summary" aria-label={es ? 'Referencias seleccionadas' : 'Selected references'}>{multiSelection.map(candidate => <span key={candidate.id}>{candidate.compositeLabel ?? candidate.label}</span>)}</div> : null}
      {searchable && leadingAction ? <div className="condition-picker-leading-action"><button type="button" data-condition-action="true" disabled={disabled || leadingAction.disabled} onClick={() => { close(true); leadingAction.onChoose(); }}><span className="condition-picker-result-icon"><Plus size={16} aria-hidden="true" /></span><span className="condition-picker-result-copy"><span>{leadingAction.label}</span>{leadingAction.detail ? <small>{leadingAction.detail}</small> : null}</span></button></div> : null}
      {subChoiceParent && !search ? <div className="condition-picker-subchoice-header"><button type="button" data-condition-action="true" aria-label={es ? 'Volver a personajes' : 'Back to characters'} onClick={() => { setSubChoiceParentId(undefined); requestAnimationFrame(() => input.current?.focus({ preventScroll: true })); }}><ChevronLeft size={16} aria-hidden="true" /></button><span><strong>{subChoiceParent.label}</strong><small>{es ? 'Elige una variante' : 'Choose a variant'}</small></span></div> : null}
      <div className="condition-picker-results" role={searchable ? 'listbox' : undefined} aria-label={searchable ? label : undefined} aria-multiselectable={searchable && multiple ? true : undefined}>
        {browsingAll ? <>{searchable && !search && !subChoiceParent ? <h4>{es ? 'Todos los resultados' : 'All results'}</h4> : null}{renderSections(visibleCandidates)}{customValue ? renderCandidate({ id: customValue, label: `${es ? 'Añadir' : 'Add'} «${customValue}»`, detail: es ? 'Nuevo valor de la lista' : 'New list value' }) : null}{!visibleCandidates.length && !customValue ? <p className="condition-picker-empty">{es ? 'Sin resultados compatibles' : 'No compatible results'}</p> : null}</> : <>{renderGroup(es ? 'En este contexto' : 'In this context', contextItems)}{renderGroup(es ? 'Cercanos' : 'Nearby', nearbyItems)}{renderGroup(es ? 'Recientes' : 'Recent', recentItems)}</>}
      </div>
      {searchable ? <div className="condition-picker-footer">{browsingAll ? <>{matches.length > limit && (!subChoiceParent || search) ? <button type="button" onClick={() => setLimit(current => current + PAGE_SIZE)}>{es ? 'Mostrar más' : 'Show more'} <small>({Math.min(limit, matches.length)}/{matches.length})</small></button> : null}{showAll && !search && hasSuggestions ? <button type="button" onClick={() => { setShowAll(false); setLimit(PAGE_SIZE); input.current?.focus({ preventScroll: true }); }}>{es ? 'Volver a sugerencias' : 'Back to suggestions'}</button> : null}</> : <button type="button" onClick={() => { setShowAll(true); setLimit(PAGE_SIZE); input.current?.focus({ preventScroll: true }); }}>{es ? 'Ver todos' : 'Browse all'} <small>({catalog.length})</small></button>}</div> : null}
    </div>, portalHost) : null}
  </div>;
}
