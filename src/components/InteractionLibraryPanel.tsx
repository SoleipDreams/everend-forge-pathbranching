import { useEffect, useRef, useState } from 'react';
import type { BranchingProject, InteractionMechanicPreset, InteractionMechanicsLibrary, ProjectAsset } from '../domain.js';
import { defaultInteraction } from '../interactionMutations.js';
import { addInteractionTemplates, defaultInteractionMechanicsLibrary, duplicateInteractionPreset, saveInteractionPreset, plainDiceResults } from '../interactionLibrary.js';
import { normalizeSearch } from '../conditionAuthoring.js';
import { InteractionMechanicFields, interactionKindChoices, resultsForMechanic } from './InteractionMechanicFields.js';
import { ConditionReferencePicker } from './ConditionReferencePicker.js';
import { useInterfaceLocale } from '../i18n.js';
import { AccessibleTabs } from './AccessibleTabs.js';
import '../interactionLibrary.css';
import { diceBounds, diceFormula, interactionPresetKind } from '../interactionDice.js';
import { resolveUniverseAssetUrl } from '../utils/assetUrl.js';

export type InteractionLibraryPanelProps = { library: InteractionMechanicsLibrary; onChange: (next: InteractionMechanicsLibrary) => void | Promise<void>; onImportImage?: () => Promise<ProjectAsset[]>; project: BranchingProject; locale?: 'es' | 'en'; request?: { presetId?: string; revision: number } };
export function InteractionLibraryPanel({ library, onChange, onImportImage, project, locale: override, request }: InteractionLibraryPanelProps) {
  const interfaceLocale = useInterfaceLocale(), locale = override ?? interfaceLocale, es = locale === 'es';
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<InteractionMechanicPreset>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'library' | 'templates'>('library');
  const [kind, setKind] = useState('dice');
  const templates = defaultInteractionMechanicsLibrary().presets;
  const missingTemplates = templates.filter(template => !library.presets.some(preset => preset.id === template.id));
  const imageAssets = (project.assets ?? []).filter(asset => asset.kind === 'image');
  const choices = interactionKindChoices(es);
  const category = (preset: InteractionMechanicPreset): 'dice' | 'recipe' | 'qte' | 'custom' => {
    if (['dice', 'skillcheck', 'opposedcheck'].includes(preset.mechanic.kind)) return interactionPresetKind(preset);
    return preset.mechanic.kind === 'qte' ? 'qte' : 'custom';
  };
  const categoryName = (preset: InteractionMechanicPreset) => ({ dice: es ? 'Dados' : 'Dice', recipe: es ? 'Anterior' : 'Legacy', qte: 'QTE', custom: es ? 'Personalizada' : 'Custom' }[category(preset)] ?? category(preset));
  const makeDraft = () => {
    const definition = defaultInteraction('dice', `mechanic-${crypto.randomUUID()}`);
    return { ...definition, presetKind: 'dice', results: plainDiceResults(definition.id), revision: 1, name: es ? 'Nuevo set de dados' : 'New dice set' } as InteractionMechanicPreset;
  };
  const hasLegacyRecipes = [...library.presets, ...templates].some(preset => category(preset) === 'recipe');
  const visible = (view === 'library' ? library.presets : templates).filter(preset => (kind === 'all' || category(preset) === kind)
    && normalizeSearch(`${preset.name} ${preset.description ?? ''} ${categoryName(preset)}`).includes(normalizeSearch(query)));
  const apply = async (next: InteractionMechanicsLibrary) => { setBusy(true); setError(undefined); try { await onChange(next); setDraft(undefined); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } };
  const edit = (preset: InteractionMechanicPreset) => { setSelected(preset.id); setDraft(structuredClone(preset)); setError(undefined); };
  const selectedPreset = library.presets.find(preset => preset.id === selected);
  const draftImageAsset = draft?.previewImageAssetId ? imageAssets.find(asset => asset.id === draft.previewImageAssetId) : undefined;
  const draftImageUrl = draftImageAsset ? resolveUniverseAssetUrl(project.universeRootPath, draftImageAsset.path) : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!request) return;
    setView('library'); setQuery(''); setKind(request.presetId ? 'all' : 'dice'); setError(undefined);
    const preset = library.presets.find(item => item.id === request.presetId);
    if (request.presetId && !preset) { setError(es ? 'La mecánica ya no está en Recursos. Puedes guardar una copia desde el inspector.' : 'This mechanic is no longer in Resources. Save a copy from the inspector.'); return; }
    if (preset) edit(preset);
    else { setSelected(undefined); setDraft(makeDraft()); }
  }, [request?.revision]);
  useEffect(() => { if (draft) formRef.current?.scrollIntoView({ block: 'nearest' }); }, [draft?.id]);
  const importPreviewImage = async () => {
    if (!onImportImage) return;
    setBusy(true); setError(undefined);
    try {
      const imported = await onImportImage();
      if (imported.length) setDraft(current => current ? { ...current, previewImageAssetId: imported[0].id } : current);
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <section className="interaction-library" aria-label={es ? 'Biblioteca de mecánicas' : 'Mechanics library'}>
    <header><div><h2>{es ? 'Biblioteca de interacciones' : 'Interaction library'}</h2><p>{es ? 'Guarda sets de dados reutilizables. La resolución, los participantes y sus resultados se configuran en cada interacción. Cada uso narrativo conserva su copia independiente.' : 'Save reusable dice sets. Resolution, participants, and results are configured on each interaction.'}</p></div><div className="interaction-library-create-actions"><button type="button" disabled={busy} onClick={() => { setView('library'); setKind('dice'); setDraft(makeDraft()); setSelected(undefined); }}>{es ? 'Crear set de dados' : 'Create dice set'}</button></div></header>
    <AccessibleTabs className="interaction-library-tabs" ariaLabel={es ? 'Catálogo de mecánicas' : 'Mechanics catalogue'} value={view} onChange={value => { setView(value as typeof view); setDraft(undefined); setError(undefined); }} tabs={[
      { id: 'library', label: es ? 'Biblioteca' : 'Library' },
      { id: 'templates', label: es ? 'Plantillas' : 'Templates' },
    ]} />
    <AccessibleTabs className="interaction-library-tabs interaction-library-filters" ariaLabel={es ? 'Contenido de Recursos' : 'Resource content'} value={kind} onChange={setKind} tabs={[
      { id: 'all', label: es ? 'Todo' : 'All' }, { id: 'dice', label: es ? 'Dados' : 'Dice' }, ...(hasLegacyRecipes ? [{ id: 'recipe', label: es ? 'Anteriores' : 'Legacy' }] : []), { id: 'qte', label: 'QTE' }, { id: 'custom', label: es ? 'Personalizadas' : 'Custom' },
    ]} />
    {view === 'templates' ? <div className="interaction-template-summary"><p>{es ? 'Puntos de partida editables. Asigna personajes y atributos en cada uso. Añadir plantillas conserva tus mecánicas actuales.' : 'Editable starting points. Assign characters and attributes in each use. Adding templates preserves your existing mechanics.'}</p><button type="button" disabled={busy || !missingTemplates.length} onClick={() => void apply(addInteractionTemplates(library, missingTemplates.map(template => template.id)))}>{es ? `Añadir las que faltan (${missingTemplates.length})` : `Add missing templates (${missingTemplates.length})`}</button></div> : null}
    {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
    <label><span>{es ? 'Buscar sets o plantillas' : 'Search sets or templates'}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={es ? 'Nombre o descripción…' : 'Name or description…'} /></label>
    <div className="interaction-library-cards">{visible.map(preset => <article key={preset.id} className={view === 'library' && selected === preset.id ? 'selected' : undefined}>
      <small className="interaction-template-category">{categoryName(preset)}</small>
      {view === 'templates' ? <strong>{preset.name}</strong> : <button type="button" className="interaction-library-select" onClick={() => edit(preset)}><strong>{preset.name}</strong></button>}
      <small>{preset.mechanic.kind === 'dice' ? `${diceFormula(preset.mechanic, preset.mechanic.modifier)} · ${diceBounds(preset.mechanic, preset.mechanic.modifier).min}–${diceBounds(preset.mechanic, preset.mechanic.modifier).max}` : preset.description ?? categoryName(preset)} · v{preset.revision}</small>
      <div>{view === 'templates' ? <button type="button" disabled={busy || library.presets.some(item => item.id === preset.id)} onClick={() => void apply(addInteractionTemplates(library, [preset.id]))}>{library.presets.some(item => item.id === preset.id) ? es ? 'En biblioteca' : 'In library' : es ? 'Añadir a biblioteca' : 'Add to library'}</button> : <>
        <button type="button" disabled={busy} onClick={() => edit(preset)}>{es ? 'Editar' : 'Edit'}</button>
        <button type="button" disabled={busy} onClick={() => { const next = duplicateInteractionPreset(library, preset.id); void apply(next); setSelected(next.presets.at(-1)?.id); }}>{es ? 'Duplicar' : 'Duplicate'}</button>
        <button type="button" disabled={busy} onClick={() => void apply({ ...library, presets: library.presets.filter(item => item.id !== preset.id) })}>{es ? 'Eliminar' : 'Delete'}</button>
      </>}</div>
    </article>)}</div>
    {!visible.length ? <p role="status">{es ? 'No hay elementos que coincidan.' : 'No matching items.'}</p> : null}
    {draft ? <form ref={formRef} className="interaction-library-edit" onSubmit={event => { event.preventDefault(); try { void apply(saveInteractionPreset(library, draft)); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } }}>
      <h3>{selectedPreset ? `${es ? 'Editar' : 'Edit'} · ${selectedPreset.name}` : es ? 'Nuevo set de dados' : 'New dice set'}</h3>
      <label><span>{es ? 'Nombre' : 'Name'}</span><input value={draft.name} required onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label><span>{es ? 'Descripción' : 'Description'}</span><input value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      {draft.mechanic.kind === 'dice' ? <>
        <label><span>{es ? 'Imagen del preset' : 'Preset image'}</span><select value={draft.previewImageAssetId ?? ''} onChange={event => setDraft({ ...draft, previewImageAssetId: event.target.value || undefined })}>
          <option value="">{es ? 'Dados con caras' : 'Dice with faces'}</option>
          {imageAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
        </select></label>
        <div className="interaction-library-image-control">
          {draftImageUrl ? <img src={draftImageUrl} alt={draftImageAsset?.name ?? ''} /> : <span>{draftImageAsset?.name ?? (es ? 'Vista de dados con caras' : 'Dice face preview')}</span>}
          {onImportImage ? <button type="button" disabled={busy} onClick={() => void importPreviewImage()}>{es ? 'Cargar imagen personalizada' : 'Upload custom image'}</button> : null}
        </div>
      </> : null}
      {!(draft.mechanic.kind === 'dice' && interactionPresetKind(draft) === 'dice') ? <label><span>{es ? 'Mecánica anterior' : 'Legacy mechanic'}</span><ConditionReferencePicker label={es ? 'Tipo de mecánica' : 'Mechanic type'} projectId={project.projectId} category="mechanic-kind" locale={locale} searchable={false} value={draft.mechanic.kind === 'opposedcheck' ? 'skillcheck' : draft.mechanic.kind} candidates={interactionKindChoices(es)} onChoose={kind => { const definition = defaultInteraction(kind as typeof draft.mechanic.kind, draft.id); setDraft({ ...draft, mechanic: definition.mechanic, results: kind === 'dice' ? plainDiceResults(definition.id) : definition.results }); }} /></label> : null}
      <InteractionMechanicFields project={project} mechanic={draft.mechanic} identity={`preset:${draft.id}`} locale={locale} dicePresets={library.presets} diceSetOnly={draft.mechanic.kind === 'dice' && interactionPresetKind(draft) === 'dice'} onChange={mechanic => setDraft(current => current ? { ...current, mechanic, results: mechanic.kind === 'dice' && mechanic.kind === current.mechanic.kind && current.results.length === 1 ? current.results.map(result => ({ ...result, range: mechanic.skill || mechanic.modifierRules?.length ? {} : diceBounds(mechanic, mechanic.modifier) })) : resultsForMechanic(mechanic, current.results, current.id, current.mechanic.kind) } : current)} />
      {!(draft.mechanic.kind === 'dice' && interactionPresetKind(draft) === 'dice') ? <><h4>{es ? 'Resultados' : 'Results'}</h4>{draft.results.map((result, index) => {
        const ranged = draft.mechanic.kind === 'dice' || draft.mechanic.kind === 'skillcheck' && !result.key;
        const patchResult = (patch: Partial<typeof result>) => setDraft(current => current ? { ...current, results: current.results.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) } : current);
        const patchRange = (key: 'min' | 'max', raw: string) => patchResult({ range: { ...result.range, [key]: raw.trim() === '' ? undefined : Number(raw), [key === 'min' ? 'minInclusive' : 'maxInclusive']: raw.trim() === '' ? undefined : result.range?.[key === 'min' ? 'minInclusive' : 'maxInclusive'] ?? true } });
        const inclusion = (key: 'minInclusive' | 'maxInclusive') => <ConditionReferencePicker label={key} projectId={project.projectId} category={`preset-range:${result.id}:${key}`} locale={locale} searchable={false} value={result.range?.[key] === false ? 'exclusive' : 'inclusive'} candidates={[{ id: 'inclusive', label: es ? 'Incluye límite' : 'Inclusive' }, { id: 'exclusive', label: es ? 'Excluye límite' : 'Exclusive' }]} onChoose={value => patchResult({ range: { ...result.range, [key]: value === 'inclusive' } })} />;
        return <div className="interaction-library-result" key={result.id}><div className="interaction-fields-row"><label><span>{es ? 'Resultado' : 'Result'}</span><input value={result.name} onChange={event => patchResult({ name: event.target.value })} /></label>{result.key ? <small>{result.key}</small> : null}<button type="button" disabled={draft.mechanic.kind === 'skillcheck' && Boolean(result.key)} onClick={() => setDraft({ ...draft, results: draft.results.filter(item => item.id !== result.id) })}>{es ? 'Quitar' : 'Remove'}</button></div>{ranged ? <div className="interaction-fields-row interaction-range-boundaries"><label><span>{es ? 'Desde (−∞ si está vacío)' : 'From (−∞ if empty)'}</span><input type="number" value={result.range?.min ?? ''} onChange={event => patchRange('min',event.target.value)} placeholder="−∞" /></label>{result.range?.min !== undefined ? inclusion('minInclusive') : null}<label><span>{es ? 'Hasta (+∞ si está vacío)' : 'To (+∞ if empty)'}</span><input type="number" value={result.range?.max ?? ''} onChange={event => patchRange('max',event.target.value)} placeholder="+∞" /></label>{result.range?.max !== undefined ? inclusion('maxInclusive') : null}</div> : null}</div>;
      })}
      {draft.mechanic.kind === 'dice' || draft.mechanic.kind === 'custom' || draft.mechanic.kind === 'skillcheck' ? <button type="button" onClick={() => setDraft({ ...draft, results: [...draft.results, { id: `result-${crypto.randomUUID()}`, name: es ? draft.mechanic.kind === 'skillcheck' ? 'Super suerte / secreto' : 'Resultado' : draft.mechanic.kind === 'skillcheck' ? 'Super luck / secret' : 'Result' }] })}>{draft.mechanic.kind === 'skillcheck' ? es ? 'Añadir resultado extremo' : 'Add extreme result' : es ? 'Añadir resultado' : 'Add result'}</button> : null}</> : null}
      <footer><button type="button" disabled={busy} onClick={() => setDraft(undefined)}>{es ? 'Cancelar' : 'Cancel'}</button><button type="submit" disabled={busy}>{busy ? es ? 'Guardando…' : 'Saving…' : es ? 'Guardar en el universo' : 'Save to universe'}</button></footer>
    </form> : null}
  </section>;
}
