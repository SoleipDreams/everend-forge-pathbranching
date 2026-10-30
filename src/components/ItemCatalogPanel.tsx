import { useEffect, useRef, useState } from 'react';
import type { BranchingProject, EntityInstance, InventoryPropertyModifier } from '../domain.js';
import { createStoryItem, itemCatalogEntryFromEntity, itemCatalogSchema, itemModifierIssues, saveStoryItemModifiers, storyItemEntries, updateInitialItemCopy, useCatalogItem, withItemCatalogSchema, type ItemCatalogEntry } from '../itemCatalog.js';
import { entityUsages } from '../authoringEntities.js';
import { useInterfaceLocale } from '../i18n.js';
import { AccessibleTabs } from './AccessibleTabs.js';
import { useItemCatalog } from './ItemCatalogContext.js';
import { InventoryModifiersEditor } from './InventoryModifiersEditor.js';
import { EntityOwnerPicker } from './EntityOwnerPicker.js';
import '../itemCatalog.css';

export function ItemCatalogPanel({ project, onUpdate: commitProject }: { project: BranchingProject; onUpdate: (project: BranchingProject) => void }) {
  const es = useInterfaceLocale() === 'es', catalog = useItemCatalog();
  const currentProject = useRef(project);
  currentProject.current = project;
  const onUpdate = (next: BranchingProject) => {
    if (next.projectId !== currentProject.current.projectId || next.storyId !== currentProject.current.storyId) throw Error(es ? 'La historia cambió. Vuelve a seleccionar el ítem.' : 'The story changed. Select the item again.');
    commitProject(next);
  };
  const [scope, setScope] = useState<'story' | 'global'>('story'), [query, setQuery] = useState(''), [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState<string>(), [draft, setDraft] = useState<ItemCatalogEntry>(), [modifiers, setModifiers] = useState<InventoryPropertyModifier[]>([]);
  const [error, setError] = useState<string>(), [busy, setBusy] = useState(false);
  const entities = storyItemEntries(project), selected = entities.find(item => `entity:${item.id}` === selectedId);
  const copies = project.entityInstances?.filter(copy => copy.entityId === selected?.id) ?? [];
  useEffect(() => { setSelectedId(undefined); setDraft(undefined); setModifiers([]); setError(undefined); }, [project.projectId, project.storyId]);
  const run = async (work: () => void | Promise<void>) => { setError(undefined); setBusy(true); try { await work(); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); } };
  const pickEntity = (id: string) => { setSelectedId(`entity:${id}`); setDraft(undefined); setModifiers(structuredClone(entities.find(item => item.id === id)?.modifiers ?? [])); setError(undefined); };
  const pickTemplate = (entry: ItemCatalogEntry) => { setSelectedId(`template:${entry.id}`); setDraft(structuredClone(entry)); setModifiers(structuredClone(entry.modifiers)); setError(undefined); };
  const useTemplate = (entry: ItemCatalogEntry) => { const result = useCatalogItem(project, entry); onUpdate(result.project); setScope('story'); setSelectedId(`entity:${result.entityId}`); setDraft(undefined); setModifiers(structuredClone(entry.modifiers)); };
  const create = () => run(async () => {
    if (scope === 'story') { const result = createStoryItem(project, newName); onUpdate(result.project); setSelectedId(`entity:${result.entityId}`); setDraft(undefined); setModifiers([]); }
    else { if (!catalog || catalog.error) throw Error(catalog?.error ?? 'Abre un universo para usar el catálogo global.'); const entry: ItemCatalogEntry = { id: `item-template:${crypto.randomUUID()}`, name: newName.trim(), typeId: 'item', properties: {}, modifiers: [] }; await catalog.save({ version: 1, entries: [...catalog.library.entries, entry] }); pickTemplate(entry); }
    setNewName('');
  });
  const changeCopy = (copy: EntityInstance | undefined, id: string) => run(() => onUpdate(updateInitialItemCopy(project, copy, id)));
  const matches = (name: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const visibleEntities = entities.filter(item => (scope === 'global' ? item.source === 'canon' : item.inStory) && matches(item.name));
  const visibleTemplates = scope === 'global' ? (catalog?.library.entries ?? []).filter(entry => matches(entry.name)) : [];
  let fieldProject = project, schemaError: string | undefined;
  try { if (draft?.localProperties?.length) fieldProject = withItemCatalogSchema(project, draft.localProperties); }
  catch (err) { schemaError = err instanceof Error ? err.message : String(err); }
  return <section className="item-catalog" aria-label={es ? 'Catálogo de ítems' : 'Item catalog'}>
    <AccessibleTabs className="explorer-view-tabs" ariaLabel={es ? 'Ámbito del catálogo de ítems' : 'Item catalog scope'} value={scope} onChange={value => { setScope(value as typeof scope); setSelectedId(undefined); setDraft(undefined); }} tabs={[{ id: 'story', label: es ? 'En esta historia' : 'In this story' }, { id: 'global', label: es ? 'Global del universo' : 'Universe global' }]} />
    <p>{scope === 'global' ? es ? 'Definiciones reutilizables entre historias del universo. Cada historia conserva su propia configuración y sus copias.' : 'Reusable universe definitions. Each story keeps its own configuration and copies.' : es ? 'Configura los bonos y las copias de los ítems que utiliza esta historia.' : 'Configure modifiers and copies for items used by this story.'}</p>
    <label className="field-label">{es ? 'Buscar ítems' : 'Search items'}<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="item-catalog-create"><label className="field-label">{es ? 'Nombre del nuevo ítem' : 'New item name'}<input value={newName} onChange={event => setNewName(event.target.value)} /></label><button type="button" disabled={busy || !newName.trim() || scope === 'global' && (!catalog || Boolean(catalog.error))} onClick={() => void create()}>{es ? 'Crear ítem' : 'Create item'}</button></div>
    {scope === 'global' ? <button type="button" disabled={busy || !catalog} onClick={() => void run(async () => { await catalog?.refresh(); })}>{es ? 'Actualizar catálogo global' : 'Refresh global catalog'}</button> : null}
    {error || schemaError || scope === 'global' && catalog?.error ? <p role="alert">{error ?? schemaError ?? catalog?.error}</p> : null}
    <ul className="item-catalog-list">{visibleEntities.map(item => <li key={item.id}><button type="button" aria-pressed={selectedId === `entity:${item.id}`} onClick={() => pickEntity(item.id)}><strong>{item.name}</strong><small>{item.source === 'canon' ? 'Canon' : es ? 'Local' : 'Local'} · {item.modifiers.length} {es ? 'bonos' : 'modifiers'}</small></button></li>)}{visibleTemplates.map(entry => <li key={entry.id}><button type="button" aria-pressed={selectedId === `template:${entry.id}`} onClick={() => pickTemplate(entry)}><strong>{entry.name}</strong><small>{es ? 'Definición global' : 'Global definition'} · {entry.modifiers.length} {es ? 'bonos' : 'modifiers'}</small></button></li>)}</ul>
    {!visibleEntities.length && !visibleTemplates.length ? <p>{es ? 'No hay ítems en este ámbito.' : 'No items in this scope.'}</p> : null}
    {selected && scope === 'global' ? <article><h3>{selected.name}</h3><button type="button" disabled={busy} onClick={() => void run(() => { onUpdate(saveStoryItemModifiers(project, selected.id, selected.modifiers)); setScope('story'); })}>{es ? 'Usar en esta historia' : 'Use in this story'}</button></article> : null}
    {selected && scope === 'story' || draft ? <article className="item-catalog-detail"><h3>{selected?.name ?? draft?.name}</h3>
      {draft ? <label className="field-label">{es ? 'Nombre' : 'Name'}<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label> : null}
      <InventoryModifiersEditor key={selectedId} project={fieldProject} draftId={selectedId!} value={modifiers} onChange={setModifiers} locale={es ? 'es' : 'en'} />
      <button type="button" disabled={busy || Boolean(schemaError || draft && catalog?.error)} onClick={() => void run(async () => {
        if (draft && catalog) { const issues = itemModifierIssues(fieldProject, modifiers); if (issues.length) throw Error(issues.join(' ')); const entry = { ...draft, modifiers, localProperties: itemCatalogSchema(fieldProject, modifiers, draft.properties) }; await catalog.save({ ...catalog.library, entries: catalog.library.entries.map(item => item.id === draft.id ? entry : item) }); setDraft(entry); }
        else if (selected) onUpdate(saveStoryItemModifiers(project, selected.id, modifiers));
      })}>{es ? 'Guardar bonos' : 'Save modifiers'}</button>
      {draft ? <button type="button" disabled={busy || Boolean(schemaError)} onClick={() => void run(() => useTemplate({ ...draft, modifiers }))}>{es ? 'Usar en esta historia' : 'Use in this story'}</button> : selected && catalog && !catalog.error ? <button type="button" disabled={busy || JSON.stringify(modifiers) !== JSON.stringify(selected.modifiers)} onClick={() => void run(async () => { const previousId = project.entityOverrides?.find(item => item.entityId === selected.id)?.itemCatalogEntryId; const entry = itemCatalogEntryFromEntity(project, selected.id, previousId); await catalog.save({ version: 1, entries: [...catalog.library.entries.filter(item => item.id !== entry.id), entry] }); const current = currentProject.current; if (current.projectId !== project.projectId || current.storyId !== project.storyId) return; onUpdate({ ...current, entityOverrides: current.entityOverrides?.map(item => item.entityId === selected.id ? { ...item, itemCatalogEntryId: entry.id } : item) }); })}>{es ? 'Guardar en catálogo global' : 'Save to global catalog'}</button> : null}
      {selected ? <fieldset><legend>{es ? 'Copias iniciales de esta historia' : 'Initial story copies'}</legend>
        {copies.map(copy => <div key={copy.id} className="item-catalog-copy"><strong>{copy.name ?? selected.name}</strong><EntityOwnerPicker project={project} value={copy.owner} onChange={owner => void changeCopy({ ...copy, owner }, copy.id)} /><label><input type="checkbox" checked={copy.states?.equipped === true} onChange={event => void changeCopy({ ...copy, states: { ...copy.states, equipped: event.target.checked } }, copy.id)} />{es ? 'Equipado' : 'Equipped'}</label><button type="button" disabled={busy || entityUsages({ ...project, entityInstances: project.entityInstances?.filter(item => item.id !== copy.id) }, copy.id).length > 0} onClick={() => void changeCopy(undefined, copy.id)}>{es ? 'Retirar copia' : 'Remove copy'}</button></div>)}
        <button type="button" disabled={busy} onClick={() => { const id = `instance:${crypto.randomUUID()}`; void changeCopy({ id, entityId: selected.id, properties: {}, states: { equipped: false }, owner: { kind: 'profile', profileId: project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id ?? 'default' } }, id); }}>{es ? 'Añadir copia inicial' : 'Add initial copy'}</button>
      </fieldset> : null}
    </article> : null}
  </section>;
}
