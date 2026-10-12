import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clapperboard, Copy, ExternalLink, GripVertical, MapPin, MessageCircle, Search, UserRound, Users, X } from 'lucide-react';
import type { BranchingProject } from '../domain.js';
import type { Selection } from '../appTypes.js';
import { barrierNodeId, interactionNodeId } from '../interactions.js';
import { updateDialogue, updateEvent, type MutationResult } from '../projectMutations.js';
import { authoringDraftEntries, authoringDraftKey } from '../authoringDrafts.js';
import { conversationDropOffset, conversationProjection, convertLegacyConversationText, inheritConversationContext, inheritableConversationContext, insertConversationLine, makeConversationLineIndependent, moveConversationLine, removeConversationLine, removeConversationParticipant, updateConversationSpeaker, updateConversationText, type ConversationContext, type ConversationRow } from '../conversationModel.js';
import { scriptBlockTextKey } from '../localization.js';
import { UNKNOWN_SPEAKER_REF } from '../speakerRoles.js';
import { storyTestSpeaker } from '../storyTestMedia.js';
import { canonVariantsForRef } from '../worldnotionVariants.js';
import { resolveUniverseAssetUrl } from '../utils/assetUrl.js';
import { useInterfaceLocale } from '../i18n.js';
import { AuthoringTextField } from './AuthoringTextField.js';
import { useAuthoringDraft } from './useAuthoringDraft.js';
import type { AuthoringMutation } from './AuthoringStudio.js';
import { ConversationLineMenu } from './ConversationLineMenu.js';
import { NarrativeInsertionGap } from './NarrativeInsertionGap.js';
import { ConversationContextPicker } from './ConversationContextPicker.js';
import { addConversationParticipant, setConversationStartingLocation } from '../conversationModel.js';
import { locationEntities, propertyIsEntityPresentable } from '../explorerSchema.js';
import '../conversationEditor.css';

type Props = {
  project: BranchingProject; eventId: string; dialogueId?: string; selectedNodeId?: string;
  propertiesConfig?: Record<string, unknown>; onMutation: AuthoringMutation;
  onHighlight: (id: string) => void; onOpenSection?: (id: string, section: string) => void;
  onOpenReference?: (selection: Selection) => void;
  previousConversationContext?: ConversationContext;
  /** The selected speech's Content tab reuses exactly the same row editor. */
  focusedLine?: boolean;
  visibleRowIds?: string[]; hideSummary?: boolean; hideComposer?: boolean;
  onCreateDecision?: (afterId?: string, beforeId?:string) => void;
};
type Speaker = { id: string; label: string; source: string; portrait?: string };
type Preferences = { kind: 'speech' | 'direction'; speaker?: string; variant?: string; selected?: string; locale?: string };
const readPreferences = (key: string): Preferences => {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '{}'); return { ...value, kind: value.kind === 'direction' ? 'direction' : 'speech' }; }
  catch { return { kind: 'speech' }; }
};

function Portrait({ speaker, action, size = 'normal' }: { speaker?: Speaker; action?: boolean; size?: 'normal' | 'small' }) {
  return <span className={`conversation-portrait ${size}`} aria-hidden="true">{action ? <Clapperboard size={18} /> : speaker?.portrait ? <img src={speaker.portrait} alt="" /> : <UserRound size={18} />}</span>;
}

function SpeakerPicker({ speakers, quickSpeakerIds, value, variantId, portrait, variantsFor, onChange, es, disabled }: { speakers: Speaker[]; quickSpeakerIds: string[]; value?: string; variantId?: string; portrait?: string; variantsFor: (id?: string) => { id: string; label: string }[]; onChange: (id?: string, variantId?: string) => void; es: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [variantSpeaker, setVariantSpeaker] = useState<Speaker>();
  const root = useRef<HTMLDivElement>(null);
  const variantMenu = useRef<HTMLDivElement>(null);
  const selected = speakers.find(item => item.id === (value ?? ''));
  const availableVariants = variantsFor(value);
  const variant = availableVariants.find(item => item.id === (variantId ?? 'base'));
  const displayName = `${selected?.label ?? value ?? (es ? 'Narrador' : 'Narrator')}${value && variant && availableVariants.length > 1 ? ` (${variant.label})` : ''}`;
  const search = query.trim().toLocaleLowerCase();
  const quickIds = [...new Set([value, ...quickSpeakerIds].filter((id): id is string => Boolean(id) && id !== UNKNOWN_SPEAKER_REF))];
  const visible = search
    ? speakers.filter(item => `${item.label} ${item.source}`.toLocaleLowerCase().includes(search))
    : [...speakers.filter(item => !item.id || item.id === UNKNOWN_SPEAKER_REF), ...quickIds.flatMap(id => speakers.filter(item => item.id === id))];
  const close = () => { setOpen(false); setQuery(''); setVariantSpeaker(undefined); root.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); };
  const choose = (id: string, variantId?: string) => { onChange(id || undefined, variantId); close(); };
  useEffect(() => { if (variantSpeaker) variantMenu.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }, [variantSpeaker]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) { setOpen(false); setVariantSpeaker(undefined); } };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="conversation-speaker-picker" ref={root} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <button type="button" disabled={disabled} className="conversation-speaker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`${es ? 'Hablante' : 'Speaker'}: ${displayName}`} title={displayName} onClick={() => { if (open) close(); else { setQuery(''); setVariantSpeaker(undefined); setOpen(true); } }}><Portrait speaker={selected ? { ...selected, portrait: portrait ?? selected.portrait } : undefined} /><span>{displayName}</span></button>
    {open ? <div className="conversation-speaker-menu" role="dialog" aria-label={es ? 'Elegir personaje' : 'Choose character'}>
      {variantSpeaker ? <div ref={variantMenu} className="conversation-speaker-variants">
        <button type="button" className="conversation-variant-back" onClick={() => { setVariantSpeaker(undefined); requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })); }}><ArrowLeft size={14} />{es ? 'Personajes' : 'Characters'}</button>
        <strong>{variantSpeaker.label}</strong>
        <div className="conversation-speaker-options" role="group" aria-label={es ? 'Variantes disponibles' : 'Available variants'}>{variantsFor(variantSpeaker.id).map(item => <button type="button" key={item.id} aria-pressed={variantSpeaker.id === value && item.id === (variantId ?? 'base')} onClick={() => choose(variantSpeaker.id, item.id)}>{item.label}</button>)}</div>
      </div> : <><label><Search size={14} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={es ? 'Buscar personaje…' : 'Find a character…'} aria-label={es ? 'Buscar personaje' : 'Find a character'} /></label><div className="conversation-speaker-options">{visible.map(item => <button type="button" key={item.id} aria-pressed={item.id === (value ?? '')} aria-label={item.label} onClick={() => { if (variantsFor(item.id).length > 1) setVariantSpeaker(item); else choose(item.id); }}><Portrait speaker={item} size="small" /><span>{item.label}<small>{item.source}</small></span>{variantsFor(item.id).length > 1 ? <ChevronRight size={14} aria-hidden="true" /> : null}</button>)}{!search ? <p className="conversation-speaker-hint">{es ? 'Personajes de este evento. Busca para elegir otro.' : 'Characters in this event. Search to choose another.'}</p> : !visible.length ? <p className="conversation-speaker-hint" role="status">{es ? 'No se encontraron personajes.' : 'No characters found.'}</p> : null}</div></>}
    </div> : null}
  </div>;
}

/** A view of existing beats, never a second narrative document or an inferred branch order. */
export function ConversationEditor({ project, eventId, dialogueId, selectedNodeId, propertiesConfig, onMutation, onHighlight, onOpenSection, onOpenReference, previousConversationContext, focusedLine, visibleRowIds, hideSummary, hideComposer, onCreateDecision }: Props) {
  const es = useInterfaceLocale() === 'es';
  const context: ConversationContext = { eventId, dialogueId };
  const preferenceKey = `pathbranching:conversation:${JSON.stringify([project.projectId, eventId, dialogueId ?? ''])}`;
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences(preferenceKey));
  const [notice, setNotice] = useState<string>(), [busy, setBusy] = useState(false), [focusLine, setFocusLine] = useState<string>();
  const [emptyComposer, setEmptyComposer] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ rowId: string; x: number; y: number; serial: number }>();
  const [dragging, setDragging] = useState<string>();
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: 'before' | 'after' }>();
  const applying = useRef(false);
  const surface = useRef<HTMLDivElement>(null), dragId = useRef<string | undefined>(undefined);
  const projection = useMemo(() => conversationProjection(project, context), [project, eventId, dialogueId]);
  const primary = project.localizationCatalog?.primaryLocale ?? 'und';
  const contentLocale = preferences.locale ?? primary;
  const locales = [...new Set([primary, ...(project.localizationCatalog?.locales ?? [])])];
  const composerKey = authoringDraftKey(project.projectId, dialogueId ?? eventId, `conversation-composer:${contentLocale}`);
  const [composer, setComposer, clearComposer] = useAuthoringDraft(composerKey, '');
  useEffect(() => { setPreferences(readPreferences(preferenceKey)); setNotice(undefined); setFocusLine(undefined); }, [preferenceKey]);
  useEffect(() => { try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch { /* Session preferences do not affect narrative saving. */ } }, [preferenceKey, preferences]);
  useEffect(() => {
    if (!focusLine) return;
    const frame = requestAnimationFrame(() => { surface.current?.querySelector<HTMLTextAreaElement>(`[data-conversation-id="${CSS.escape(focusLine)}"] textarea`)?.focus(); setFocusLine(undefined); });
    return () => cancelAnimationFrame(frame);
  }, [focusLine, project]);
  const speakers: Speaker[] = [
    { id: '', label: es ? 'Narrador' : 'Narrator', source: es ? 'Sin personaje' : 'No character' },
    { id: UNKNOWN_SPEAKER_REF, label: '???', source: es ? 'Identidad desconocida' : 'Unknown identity' },
    ...[...project.canonRefs.map(item => ({ id: item.id, label: item.label ?? item.id, source: 'Canon' })), ...(project.localExplorerEntities ?? []).map(item => ({ id: item.id, label: item.name, source: es ? 'Local' : 'Local' }))].map(item => {
      const portrait = storyTestSpeaker(project, propertiesConfig, item.id)?.portraitPath;
      return { ...item, portrait: portrait ? resolveUniverseAssetUrl(project.universeRootPath, portrait) : undefined };
    }),
  ];
  const select = (id: string) => { setPreferences(current => ({ ...current, selected: id })); onHighlight(id); };
  const apply = async (mutate: (current: BranchingProject) => MutationResult, focus = false) => {
    if (applying.current) return false;
    applying.current = true; setBusy(true); let selection: MutationResult['selection']; let applied = false;
    try {
      await onMutation(current => { const result = mutate(current); if (result.project === current) throw new Error(result.message ?? 'The document could not be updated.'); selection = result.selection; applied = true; return result.project; });
      setNotice(undefined);
      if (selection?.type === 'node') { select(selection.id); if (focus) setFocusLine(selection.id); }
      return applied;
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); return false; }
    finally { applying.current = false; setBusy(false); }
  };
  const insert = (afterId?: string, beforeId?: string, useComposer = false) => apply(current => insertConversationLine(current, context, preferences.kind, { afterId, beforeId, text: useComposer ? composer : '', speakerRef: preferences.speaker, variantId: preferences.variant, locale: contentLocale }), true);
  const enterAfter = (row: ConversationRow) => apply(current => insertConversationLine(current, context, row.beat.kind, { afterId: row.id, text: '', speakerRef: row.block?.characterRef ?? row.block?.speakerRef, variantId: row.block?.characterVariantId, locale: contentLocale }), true).then(() => undefined);
  const addComposer = async () => {
    if (busy) return;
    const selected = projection.rows.find(row => row.id === (selectedNodeId ?? preferences.selected)) ?? shownRows.at(-1);
    if (await insert(selected?.canInsertAfter ? selected.id : undefined, undefined, true)) { clearComposer(); setEmptyComposer(false); }
  };
  const textFor = (row: ConversationRow) => row.block ? project.localizationCatalog?.entries[row.block.textKey ?? scriptBlockTextKey(row.beat.blockRef.scriptId, row.block.id)]?.values[contentLocale] ?? (contentLocale === primary ? row.block.content ?? '' : row.block.translations?.[contentLocale] ?? '') : '';
  const speakerForVariant = (ref?: string, variantId?: string) => {
    const base = speakers.find(item => item.id === (ref ?? ''));
    const variantPortrait = ref ? storyTestSpeaker(project, propertiesConfig, ref, variantId)?.portraitPath : undefined;
    return variantPortrait && base ? { ...base, portrait: resolveUniverseAssetUrl(project.universeRootPath, variantPortrait) } : base;
  };
  const rowSpeaker = (row: ConversationRow) => speakerForVariant(row.block?.characterRef ?? row.block?.speakerRef, row.block?.characterVariantId);
  const variants = (ref?: string) => { const entity = project.canonRefs.find(item => item.id === ref); return entity ? canonVariantsForRef(entity) : []; };
  const speakingParticipants = projection.rows.filter(row => row.kind === 'speech').map(row => row.block?.characterRef ?? row.block?.speakerRef).filter((id): id is string => Boolean(id));
  const activeRow = selectedNodeId ?? preferences.selected;
  const shownRows = focusedLine ? projection.rows.filter(row => row.id === selectedNodeId) : visibleRowIds ? visibleRowIds.flatMap(id => projection.rows.filter(row => row.id === id)) : projection.rows;
  const narrativeEvent = project.events.find(e => e.id === eventId);
  const gap = (before?:ConversationRow,after?:ConversationRow) => <NarrativeInsertionGap label={es ? (before ? 'Insertar antes de esta línea' : 'Insertar al final de las líneas') : (before ? 'Insert before this line' : 'Insert at end of lines')} options={[
    ...(['speech','direction'] as const).map(kind=>({label:kind==='speech' ? (es?'Diálogo':'Dialogue') : (es?'Acotación':'Stage direction'),disabled:busy || projection.requiresLegacyConversion || Boolean(before ? after ? !after.canInsertAfter || narrativeEvent?.transitions?.find(route=>route.from===after.id)?.to!==before.id : before.restrictions.length : after ? !after.canInsertAfter : !projection.canStart),run:()=>{void apply(current=>insertConversationLine(current,context,kind,{afterId:after?.id,beforeId:before?.id,text:'',speakerRef:preferences.speaker,variantId:preferences.variant,locale:contentLocale}),true);}})),
    ...(onCreateDecision ? [{label:es?'Decisión':'Decision',disabled:busy || projection.requiresLegacyConversion || Boolean(after ? !after.canInsertAfter : before ? before.restrictions.length : !projection.canStart),run:()=>onCreateDecision(after?.id,before?.id)}] : [])
  ]}/>;
  const placeOptions = locationEntities(project), placeIds = new Set(placeOptions.map(item => item.id));
  const configuredCharacters = new Set([
    ...project.canonRefs.filter(ref => ref.kind && propertyIsEntityPresentable(project, 'canon', `type:${ref.kind}`)).map(ref => ref.id),
    ...(project.localExplorerEntities ?? []).filter(entity => entity.type === 'character' || propertyIsEntityPresentable(project, 'local', `type:${entity.type}`)).map(entity => entity.id),
  ]);
  const characterOptions = speakers.filter(speaker => speaker.id && speaker.id !== UNKNOWN_SPEAKER_REF && !placeIds.has(speaker.id) && (!configuredCharacters.size || configuredCharacters.has(speaker.id) || speakingParticipants.includes(speaker.id)));
  const characterIds = new Set(characterOptions.map(item => item.id));
  const narrativeDialogue = dialogueId ? narrativeEvent?.dialogues?.find(dialogue => dialogue.id === dialogueId) : undefined;
  const useLegacyEventContext = !dialogueId || !previousConversationContext;
  const conversationPresence = dialogueId
    ? narrativeDialogue?.presentEntityRefs ?? (useLegacyEventContext ? narrativeEvent?.presentEntityRefs ?? narrativeEvent?.canonRefs ?? [] : [])
    : narrativeEvent?.presentEntityRefs ?? narrativeEvent?.canonRefs ?? [];
  const participants = [...new Set([...speakingParticipants, ...conversationPresence.filter(id => characterIds.has(id))])];
  const locationId = dialogueId
    ? narrativeDialogue?.locationRef ?? (narrativeDialogue?.presentEntityRefs === undefined && useLegacyEventContext ? narrativeEvent?.locationRef : undefined)
    : narrativeEvent?.locationRef;
  const explicitPresence = new Set(conversationPresence);
  const inheritableContext = dialogueId && previousConversationContext
    ? inheritableConversationContext(project, previousConversationContext, characterIds)
    : undefined;
  const locationName = locationId ? placeOptions.find(item => item.id === locationId)?.label ?? project.canonRefs.find(ref => ref.id === locationId)?.label ?? project.localExplorerEntities?.find(entity => entity.id === locationId)?.name ?? locationId : undefined;
  const openReference = (id: string) => onOpenReference?.(project.canonRefs.some(ref => ref.id === id) ? { type: 'canon', id } : { type: 'explorerEntity', id });
  const removeParticipant = (id: string) => apply(current => removeConversationParticipant(current, eventId, id, dialogueId));
  // Only follow an explicit, single connection. Branches retain their canvas order.
  const interactionRowsAfter = (source: string) => {
    const rows: { id: string; label: string; detail: string }[] = [], seen = new Set<string>();
    while (!seen.has(source)) {
      seen.add(source);
      const routes = narrativeEvent?.transitions?.filter(t => t.from === source) ?? [];
      if (routes.length !== 1) break;
      const target = routes[0].to;
      const use = narrativeEvent?.interactionUses?.find(u => !u.ownerNodeId && interactionNodeId(eventId, u.id) === target);
      const barrier = narrativeEvent?.interactionBarriers?.find(b => barrierNodeId(eventId, b.id) === target);
      if (use) {
        const definition = narrativeEvent?.interactionDefinitions?.find(d => d.id === use.definitionId);
        rows.push({ id: target, label: definition?.name ?? use.id, detail: definition?.mechanic.kind ?? '' });
      } else if (barrier) rows.push({ id: target, label: barrier.name, detail: `${es ? 'Esperar' : 'Wait for'}: ${barrier.useIds.map(id => { const u = narrativeEvent?.interactionUses?.find(u => u.id === id); return narrativeEvent?.interactionDefinitions?.find(d => d.id === u?.definitionId)?.name ?? id; }).join(', ')}` });
      else break;
      source = target;
    }
    return rows.map(item => <button type="button" className="interaction-card" key={item.id} data-authoring-id={item.id} onClick={() => onOpenSection?.(item.id, 'overview')}><strong>{item.label}</strong><span>{item.detail}</span></button>);
  };
  if (!projection.exists) return <p className="authoring-field-error">{es ? 'El contexto ya no existe.' : 'This context no longer exists.'}</p>;
  return <div className="conversation-editor" ref={surface} aria-label={es ? 'Conversación' : 'Conversation'}>

    {!focusedLine && !hideSummary ? <header className="conversation-summary">
      <section className="conversation-summary-group" aria-label={es ? 'Personajes' : 'Characters'}>
        <div className="conversation-summary-group-heading">
          <h3><Users size={15} aria-hidden="true" />{es ? 'Personajes' : 'Characters'}</h3>
          <div className="conversation-context-heading-actions">
            {inheritableContext && (inheritableContext.presentEntityRefs.length || inheritableContext.locationRef) ? <button type="button" className="conversation-context-inherit" disabled={busy} title={es ? 'Añade los personajes de la conversación anterior y usa su lugar si aquí aún no hay uno.' : 'Add characters from the previous conversation and use its place if this conversation has none yet.'} onClick={() => void apply(current => inheritConversationContext(current, context, previousConversationContext!, characterIds))}><Copy size={13} aria-hidden="true" />{inheritableContext.presentEntityRefs.length && inheritableContext.locationRef ? (es ? 'Heredar personajes y lugar' : 'Inherit characters and place') : inheritableContext.presentEntityRefs.length ? (es ? 'Heredar personajes' : 'Inherit characters') : (es ? 'Heredar lugar' : 'Inherit place')}</button> : null}
            <ConversationContextPicker label={es ? 'Añadir personaje a la conversación' : 'Add conversation character'} searchLabel={es ? 'Buscar personajes' : 'Search characters'} disabled={busy} options={characterOptions.map(item => ({ id: item.id, label: item.label, selected: participants.includes(item.id), detail: project.canonRefs.find(ref => ref.id === item.id)?.kind ?? project.localExplorerEntities?.find(entity => entity.id === item.id)?.type }))} onChoose={id => apply(current => addConversationParticipant(current, eventId, id, dialogueId))} />
          </div>
        </div>
        <div className="conversation-participants" aria-label={es ? 'Personajes de la conversación' : 'Conversation characters'}>
          {participants.map(id => {
            const speaker = speakers.find(item => item.id === id);
            const removable = explicitPresence.has(id);
            return <div key={id} className="conversation-participant">
              <button type="button" className="conversation-participant-name" aria-pressed={preferences.kind === 'speech' && preferences.speaker === id} title={es ? 'Usar como hablante' : 'Use as speaker'} onClick={() => setPreferences(current => ({ ...current, kind: 'speech', speaker: id, variant: undefined }))}><Portrait speaker={speaker} size="small" /><span>{speaker?.label ?? id}</span></button>
              <button type="button" className="conversation-reference-open" aria-label={`${es ? 'Abrir' : 'Open'} ${speaker?.label ?? id}`} title={es ? 'Abrir elemento' : 'Open element'} onClick={() => openReference(id)}><ExternalLink size={13} aria-hidden="true" /></button>
              <button type="button" className="conversation-reference-remove" aria-label={`${es ? 'Quitar presencia de' : 'Remove presence of'} ${speaker?.label ?? id}`} title={removable ? (es ? 'Quitar de los elementos presentes' : 'Remove from present elements') : (es ? 'Se conserva porque aparece en una línea de diálogo' : 'Kept because this character appears in a dialogue line')} disabled={busy || !removable} onClick={() => void removeParticipant(id)}><X size={14} aria-hidden="true" /></button>
            </div>;
          })}
          {!participants.length ? <span className="conversation-summary-empty">{projection.rows.some(row => row.kind === 'speech') ? (es ? 'Narrador' : 'Narrator') : (es ? 'Sin personajes en las líneas' : 'No characters in the lines')}</span> : null}
        </div>
      </section>
      <section className="conversation-summary-group" aria-label={es ? 'Lugar' : 'Place'}>
        <div className="conversation-summary-group-heading">
          <h3><MapPin size={15} aria-hidden="true" />{es ? 'Lugar' : 'Place'}</h3>
          <ConversationContextPicker label={es ? (dialogueId ? 'Elegir lugar de la conversación' : 'Elegir lugar inicial del evento') : (dialogueId ? 'Choose conversation place' : 'Choose event starting place')} searchLabel={es ? 'Buscar lugares' : 'Search places'} hint={!placeOptions.length ? (es ? 'Habilita un tipo como lugar en el universo para elegirlo aquí.' : 'Enable a universe type as a location to choose it here.') : undefined} disabled={busy} options={[{ id: '', label: es ? 'Sin lugar definido' : 'No place set', selected: !locationId }, ...placeOptions.map(item => ({ id: item.id, label: item.label, detail: item.typeId, selected: item.id === locationId }))]} onChoose={id => apply(current => setConversationStartingLocation(current, eventId, id || undefined, dialogueId))} />
        </div>
        <div className="conversation-places">
          {locationName ? <div className="conversation-place"><button type="button" className="conversation-place-open" onClick={() => openReference(locationId!)} title={es ? 'Abrir elemento' : 'Open element'}><span>{locationName}</span><ExternalLink size={13} aria-hidden="true" /></button><button type="button" className="conversation-reference-remove" aria-label={`${es ? 'Quitar lugar' : 'Remove place'} ${locationName}`} title={es ? 'Quitar lugar de la conversación' : 'Remove place from conversation'} disabled={busy} onClick={() => void apply(current => setConversationStartingLocation(current, eventId, undefined, dialogueId))}><X size={14} aria-hidden="true" /></button></div> : <span className="conversation-summary-empty">{es ? 'Sin lugar definido' : 'No place set'}</span>}
        </div>
      </section>
    </header> : null}
    {locales.length > 1 ? <label className="conversation-language">{es ? 'Idioma del texto' : 'Text language'}<select value={contentLocale} onChange={event => setPreferences(current => ({ ...current, locale: event.target.value }))}>{locales.map(locale => <option key={locale}>{locale}</option>)}</select></label> : null}
    {notice ? <p role="alert" className="authoring-field-error">{notice}</p> : null}
    {!focusedLine && projection.legacy?.content ? <details className="conversation-legacy"><summary>{es ? 'Texto anterior' : 'Existing prose'}</summary><AuthoringTextField projectId={project.projectId} elementId={dialogueId ?? eventId} field={dialogueId ? 'dialogue-text' : 'event-text'} label={es ? 'Texto anterior' : 'Existing prose'} value={projection.legacy.content} multiline onCommit={content => onMutation(current => { const owner = current.events.find(item => item.id === eventId); const dialogue = owner?.dialogues?.find(item => item.id === dialogueId); return dialogue ? updateDialogue(current, eventId, dialogue.id, { text: { ...dialogue.text, content } }).project : owner ? updateEvent(current, eventId, { text: { format: 'plain', ...owner.text, content } }).project : current; })} /><p className="narrative-muted">{es ? 'Convertir crea una única línea y vacía el texto anterior en una operación que puedes deshacer.' : 'Convert creates one line and clears the existing prose in a single undoable edit.'}</p><button type="button" disabled={busy || projection.rows.length > 0 || !projection.canStart || !['plain', 'markdown'].includes(projection.legacy.format)} onClick={() => { void apply(current => convertLegacyConversationText(current, context), true); }}>{es ? 'Convertir a una línea' : 'Convert to one line'}</button></details> : null}
    <div className="conversation-lines">{!focusedLine ? interactionRowsAfter(dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:input` : `boundary:${eventId}:input:entry`) : null}{shownRows.map((row, index) => {
      const speaker = rowSpeaker(row), ref = row.block?.characterRef ?? row.block?.speakerRef;
      const shared = row.sharedUses > 1, locked = row.restrictions.length > 0;
      const differentSegment = !focusedLine && index > 0 && shownRows[index - 1].segmentId !== row.segmentId;
      return <div key={row.id}>{!focusedLine ? gap(row,shownRows[index-1]) : null}{differentSegment ? <div className="conversation-segment-divider">{es ? 'Otro tramo del recorrido' : 'Another path segment'}</div> : null}<article className={`conversation-line ${row.kind === 'direction' ? 'scene-action' : 'speech'} ${activeRow === row.id ? 'selected' : ''} ${dragging === row.id ? 'dragging' : ''} ${dropTarget?.id === row.id ? `drop-${dropTarget.edge}` : ''}`}  data-conversation-id={row.id} data-authoring-id={row.id} tabIndex={0} aria-label={`${es ? 'Línea' : 'Line'} ${index + 1} · ${row.kind === 'direction' ? (es ? 'Acotación' : 'Stage direction') : speaker?.label ?? ref ?? (es ? 'Narrador' : 'Narrator')}`} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setContextMenu({ rowId: row.id, x: event.clientX, y: event.clientY, serial: Date.now() }); }} onFocus={() => select(row.id)} onDragOver={event => {
        const dragged = projection.rows.find(item => item.id === dragId.current);
        if (!busy && dragged && dragged.id !== row.id && dragged.segmentId && dragged.segmentId === row.segmentId) {
          event.preventDefault(); event.dataTransfer.dropEffect = 'move';
          const rect = event.currentTarget.getBoundingClientRect();
          const edge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
          setDropTarget(current => current?.id === row.id && current.edge === edge ? current : { id: row.id, edge });
        }
      }} onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(current => current?.id === row.id ? undefined : current);
      }} onDrop={event => {
        const from = projection.rows.find(item => item.id === dragId.current);
        dragId.current = undefined; setDragging(undefined); setDropTarget(undefined);
        if (!busy && from && from.segmentId && from.segmentId === row.segmentId) {
          event.preventDefault(); event.stopPropagation();
          const segment = projection.segments.find(segment => segment.id === row.segmentId)!;
          const rect = event.currentTarget.getBoundingClientRect();
          const offset = conversationDropOffset(segment.nodeIds, from.id, row.id, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
          if (offset) void apply(current => moveConversationLine(current, context, from.id, offset));
        }
      }} onKeyDown={event => {
        if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setContextMenu({ rowId: row.id, x: rect.right - 220, y: rect.top + 30, serial: Date.now() }); }
        else if (event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); void apply(current => moveConversationLine(current, context, row.id, event.key === 'ArrowUp' ? -1 : 1)); }
        else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onOpenSection?.(row.id, 'connections'); }
      }}>
        <div className="conversation-line-gutter"><button type="button" className="conversation-drag" draggable={!busy && (row.canMoveUp || row.canMoveDown)} aria-label={es ? 'Arrastrar línea' : 'Drag line'} title={es ? 'Arrastrar · Alt+↑/↓' : 'Drag · Alt+↑/↓'} disabled={busy || (!row.canMoveUp && !row.canMoveDown)} onDragStart={event => { dragId.current = row.id; setDragging(row.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.id); }} onDragEnd={() => { dragId.current = undefined; setDragging(undefined); setDropTarget(undefined); }}><GripVertical size={16} /></button></div>
        <div className="conversation-line-body"><div className="conversation-line-heading">{row.kind === 'speech' ? <SpeakerPicker speakers={speakers} quickSpeakerIds={participants} value={ref} variantId={row.block?.characterVariantId} portrait={rowSpeaker(row)?.portrait} variantsFor={variants} es={es} disabled={shared || busy || !row.block} onChange={(speakerRef, variantId) => { void onMutation(current => updateConversationSpeaker(current, context, row.id, speakerRef, variantId)); }} /> : <strong><Portrait action /><span>{es ? 'Acotación' : 'Stage direction'}</span></strong>}</div>
          {row.block ? <AuthoringTextField projectId={project.projectId} elementId={row.elementId} field={`text:${contentLocale}`} label={es ? 'Texto de la línea' : 'Line text'} value={textFor(row)} multiline rows={2} disabled={shared} commitOnBlurOnly onFocus={() => select(row.id)} onCommit={text => onMutation(current => updateConversationText(current, context, row.id, text, contentLocale))} onSubmitLine={!focusedLine && row.canInsertAfter && !busy ? () => enterAfter(row) : undefined} /> : <p className="authoring-field-error">{es ? 'Falta el bloque de guion.' : 'Script block is missing.'}</p>}
          {shared ? <div className="conversation-protection"><span>{es ? `Bloque compartido en ${row.sharedUses} líneas.` : `Block shared by ${row.sharedUses} lines.`}</span><button type="button" disabled={busy} onClick={() => { void apply(current => makeConversationLineIndependent(current, context, row.id)); }}><Copy size={13} />{es ? 'Crear copia para editar' : 'Make a copy to edit'}</button></div> : null}
          {locked ? <div className="conversation-protection"><span>{es ? 'Conexiones protegidas' : 'Protected connections'} · {row.restrictions.map(reason => ({ branch: es ? 'bifurcación' : 'branch', cycle: es ? 'ciclo' : 'cycle', 'route-logic': es ? 'lógica' : 'logic', 'external-entry': es ? 'referencia externa' : 'external reference', 'missing-block': es ? 'bloque ausente' : 'missing block' }[reason])).join(', ')}</span></div> : null}
          {(project.events.find(e => e.id === eventId)?.interactionUses ?? []).filter(u => u.ownerNodeId === row.id).map(u => <button type="button" className="interaction-card" key={u.id} onClick={() => onOpenSection?.(row.id, 'interactions')}>{({ before: es ? 'Antes' : 'Before', during: es ? 'Durante' : 'During', after: es ? 'Después' : 'After' })[u.moment]} · {project.events.find(e => e.id === eventId)?.interactionDefinitions?.find(d => d.id === u.definitionId)?.name}</button>)}
          <ConversationLineMenu label={`${es ? 'Opciones de línea' : 'Line options'} ${index + 1}`}
            contextPoint={contextMenu?.rowId === row.id ? contextMenu : undefined}
            options={[
              { label: es ? 'Mover arriba' : 'Move up', disabled: busy || !row.canMoveUp, run: () => { void apply(current => moveConversationLine(current, context, row.id, -1)); } },
              { label: es ? 'Mover abajo' : 'Move down', disabled: busy || !row.canMoveDown, run: () => { void apply(current => moveConversationLine(current, context, row.id, 1)); } },
              ...(!focusedLine ? [
                { label: es ? 'Añadir debajo' : 'Add below', disabled: busy || !row.canInsertAfter || projection.requiresLegacyConversion, run: () => { void insert(row.id); } },
                ...(onCreateDecision ? [{ label: es ? 'Añadir decisión debajo' : 'Add decision below', disabled: busy || !row.canInsertAfter, run: () => onCreateDecision(row.id) }] : []),
                { label: es ? 'Insertar arriba' : 'Insert above', disabled: busy || locked || projection.requiresLegacyConversion, run: () => { void insert(undefined, row.id); } },
              ] : []),
              ...['content', 'conditions', 'connections', 'interactions'].map(section => ({ label: ({ content: es ? 'Contenido avanzado' : 'Advanced content', conditions: es ? 'Condiciones' : 'Conditions', connections: es ? 'Conexiones' : 'Connections', interactions: es ? 'Interacción' : 'Interaction' } as Record<string,string>)[section], run: () => onOpenSection?.(row.id, section) })),
              { label: es ? 'Eliminar línea' : 'Delete line', danger: true, disabled: busy || !row.canDelete, run: () => { void apply(current => {
                if (authoringDraftEntries(current.projectId).some(([key]) => { try { const id = JSON.parse(key)[1]; return id === row.elementId || id === row.id || id === row.block?.id; } catch { return false; } })) return { project: current, message: es ? 'Guarda o resuelve primero el borrador de esta línea.' : 'Save or resolve this line’s draft first.' };
                return removeConversationLine(current, context, row.id);
              }); } },
            ]} />
        </div>
      </article>{interactionRowsAfter(row.id)}</div>;
    })}{!focusedLine ? gap(undefined,shownRows.at(-1)) : null}</div>
    {!focusedLine && !hideComposer ? <>
      {emptyComposer || composer ? <article className="conversation-line conversation-provisional-line" aria-label={es ? 'Línea provisional' : 'Provisional line'}>
        <div className="conversation-provisional-body">
          <div className="conversation-provisional-heading"><span>{es ? 'Provisional' : 'Draft'}</span><div className="conversation-kind" role="group" aria-label={es ? 'Tipo de línea provisional' : 'Draft line type'}>
            <button type="button" aria-pressed={preferences.kind === 'speech'} onClick={() => setPreferences(current => ({ ...current, kind: 'speech' }))}><MessageCircle size={14} />{es ? 'Diálogo' : 'Dialogue'}</button>
            <button type="button" aria-pressed={preferences.kind === 'direction'} onClick={() => setPreferences(current => ({ ...current, kind: 'direction' }))}><Clapperboard size={14} />{es ? 'Acotación' : 'Stage direction'}</button>
            {onCreateDecision ? <button type="button" disabled={busy || Boolean(composer.trim())} onClick={() => { const selected = projection.rows.find(row => row.id === (selectedNodeId ?? preferences.selected)); onCreateDecision(selected?.id ?? shownRows.at(-1)?.id); }}>{es ? 'Decisión' : 'Decision'}</button> : null}
          </div></div>
          {preferences.kind === 'speech' ? <div className="conversation-provisional-speaker"><SpeakerPicker speakers={speakers} quickSpeakerIds={participants} value={preferences.speaker} variantId={preferences.variant} portrait={speakerForVariant(preferences.speaker, preferences.variant)?.portrait} variantsFor={variants} es={es} onChange={(speaker, variant) => setPreferences(current => ({ ...current, speaker, variant }))} /></div> : null}
          <textarea autoFocus rows={2} aria-label={es ? 'Texto de la línea provisional' : 'Draft line text'} value={composer} placeholder={preferences.kind === 'speech' ? (es ? '¿Qué dice el personaje?' : 'What does the character say?') : (es ? '¿Qué sucede en la escena?' : 'What happens in the scene?')} onChange={event => setComposer(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.nativeEvent.isComposing) { event.preventDefault(); void addComposer(); } }} />
        </div>
        <div className="conversation-provisional-actions">
          <button type="button" aria-label={es ? 'Crear línea' : 'Create line'} title={es ? 'Crear línea · Enter' : 'Create line · Enter'} disabled={busy || projection.requiresLegacyConversion} onClick={() => { void addComposer(); }}><Check size={16} /></button>
          <button type="button" aria-label={es ? 'Descartar línea provisional' : 'Discard draft line'} title={es ? 'Descartar línea provisional' : 'Discard draft line'} disabled={busy} onClick={() => { clearComposer(); setEmptyComposer(false); requestAnimationFrame(() => surface.current?.querySelector<HTMLButtonElement>('.conversation-add-line')?.focus()); }}><X size={16} /></button>
        </div>
      </article> : null}
    </> : null}
  </div>;
}
