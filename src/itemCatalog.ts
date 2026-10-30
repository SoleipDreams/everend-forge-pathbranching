import type { BranchingProject, EntityInstance, InventoryPropertyModifier, LocalExplorerProperty } from './domain.js';
import { createLocalExplorerEntity } from './explorerEntities.js';
import { entityCapabilities, entityDefinition, instanceOwnerIssue } from './authoringEntities.js';
import { propertyValueAtPath, sourcePropertyDescriptors } from './characterStats.js';
import { characterStoryReferences } from './characterSheets.js';

export const itemCatalogPath = '.everend/.pathbranching/items.json';
export type ItemCatalogEntry = { id: string; name: string; typeId: string; properties: Record<string, unknown>; modifiers: InventoryPropertyModifier[]; localProperties?: LocalExplorerProperty[] };
export type ItemCatalogLibrary = { version: 1; entries: ItemCatalogEntry[] };
export const emptyItemCatalog = (): ItemCatalogLibrary => ({ version: 1, entries: [] });
export function itemNumericProperties(project: Partial<BranchingProject>) {
  const fields = [...sourcePropertyDescriptors(project, 'canon'), ...sourcePropertyDescriptors(project, 'local')];
  return fields.filter((field, index) => ['number', 'integer', 'float'].includes(field.valueType) && fields.findIndex(other => other.id === field.id) === index);
}
export function itemModifierIssues(project: Partial<BranchingProject>, modifiers: InventoryPropertyModifier[]): string[] {
  if (!Array.isArray(modifiers)) return ['Los bonos del ítem deben ser una lista.'];
  const fields = new Set(itemNumericProperties(project).map(field => field.id)), seen = new Set<string>(), issues: string[] = [];
  for (const modifier of modifiers) {
    if (!modifier || typeof modifier.id !== 'string' || !modifier.id || seen.has(modifier.id)) issues.push('Cada bono debe tener un identificador único.');
    if (!modifier || !fields.has(modifier.propertyId)) issues.push(`El bono debe referenciar un atributo numérico existente: ${modifier?.propertyId ?? ''}.`);
    if (!modifier || typeof modifier.amount !== 'number' || !Number.isFinite(modifier.amount)) issues.push('El valor del bono debe ser un número finito.');
    if (!modifier || !['carried', 'equipped'].includes(modifier.activation)) issues.push('Indica si el bono requiere llevar o equipar el ítem.');
    if (modifier) seen.add(modifier.id);
  }
  return issues;
}
export function storyItemEntries(project: BranchingProject) {
  const referenced = characterStoryReferences(project).entityIds;
  const instances = [...(project.entityInstances ?? []), ...(project.playerSimulation?.entityInstances ?? []), ...(project.playerProfiles ?? []).flatMap(profile => profile.simulation.entityInstances ?? []), ...(project.authoringScenarios ?? []).flatMap(scenario => scenario.state?.entityInstances ?? [])];
  instances.forEach(copy => referenced.add(copy.entityId));
  return [...project.canonRefs.map(item => item.id), ...(project.localExplorerEntities ?? []).map(item => item.id)].flatMap(id => {
    const entity = entityDefinition(project, id)!;
    const override = project.entityOverrides?.find(item => item.entityId === id);
    if (!entityCapabilities(project, id).inventoryItem) return [];
    return [{ ...entity, inStory: entity.source === 'local' || referenced.has(id) || Boolean(override?.itemCatalogIncluded || override?.inventoryModifiers?.length), modifiers: override?.inventoryModifiers ?? [] }];
  });
}
export function saveStoryItemModifiers(project: BranchingProject, entityId: string, modifiers: InventoryPropertyModifier[]): BranchingProject {
  if (!entityDefinition(project, entityId)) throw Error('El ítem ya no existe.');
  const issues = itemModifierIssues(project, modifiers);
  if (issues.length) throw Error(issues.join(' '));
  const previous = project.entityOverrides?.find(item => item.entityId === entityId);
  return { ...project, entityOverrides: [...(project.entityOverrides ?? []).filter(item => item.entityId !== entityId), { ...previous, entityId, grantable: true, inventoryItem: true, runtimeRoles: { ...previous?.runtimeRoles, owned: true }, itemCatalogIncluded: true, inventoryModifiers: structuredClone(modifiers) }] };
}
export function createStoryItem(project: BranchingProject, name: string, typeId = 'item'): { project: BranchingProject; entityId: string } {
  if (!name.trim() || !typeId.trim()) throw Error('Escribe un nombre y un tipo de ítem.');
  const entity = createLocalExplorerEntity(typeId, name.trim()), ids = new Set([...project.canonRefs.map(item => item.id), ...(project.localExplorerEntities ?? []).map(item => item.id)]);
  const original = entity.id;
  for (let n = 2; ids.has(entity.id); n++) entity.id = `${original}-${n}`;
  return { entityId: entity.id, project: saveStoryItemModifiers({ ...project, localExplorerEntities: [...(project.localExplorerEntities ?? []), entity] }, entity.id, []) };
}

/** Copies are initial conditions; keep explicit profile inventories consistent with their saved baseline. */
export function updateInitialItemCopy(project: BranchingProject, copy: EntityInstance | undefined, id: string): BranchingProject {
  const pool = project.entityInstances ?? [], previous = pool.find(item => item.id === id), existing = Boolean(previous);
  const replace = (items: EntityInstance[], profile = false) => {
    let updated = copy;
    const stored = items.find(item => item.id === id);
    if (profile && copy && previous && stored) {
      const delta = Object.fromEntries(Object.entries(copy).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key as keyof EntityInstance])));
      updated = { ...stored, ...delta };
      for (const key of ['properties', 'states'] as const) if (key in delta) {
        const values: Record<string, unknown> = { ...stored[key] };
        for (const field of new Set([...Object.keys(previous[key] ?? {}), ...Object.keys(copy[key] ?? {})])) if (JSON.stringify(previous[key]?.[field]) !== JSON.stringify(copy[key]?.[field])) {
          if (Object.prototype.hasOwnProperty.call(copy[key] ?? {}, field)) values[field] = copy[key]?.[field]; else delete values[field];
        }
        updated = { ...updated, [key]: values };
      }
    }
    return [...items.filter(item => item.id !== id), ...(updated ? [updated] : [])];
  };
  const profileId = project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id ?? 'default';
  const next = replace(pool);
  if (copy) {
    const error = instanceOwnerIssue(project, next, copy);
    if (error) throw Error(error);
  }
  return { ...project, entityInstances: next,
    playerSimulation: project.playerSimulation?.entityInstances !== undefined && (project.playerSimulation.entityInstances.some(item => item.id === id) || !existing && profileId === 'default') ? { ...project.playerSimulation, entityInstances: replace(project.playerSimulation.entityInstances, true) } : project.playerSimulation,
    playerProfiles: project.playerProfiles?.map(profile => profile.simulation.entityInstances !== undefined && (profile.simulation.entityInstances.some(item => item.id === id) || !existing && profile.id === profileId) ? { ...profile, simulation: { ...profile.simulation, entityInstances: replace(profile.simulation.entityInstances, true) } } : profile),
  };
}
export function itemCatalogSchema(project: BranchingProject, modifiers: InventoryPropertyModifier[], properties: Record<string, unknown>): LocalExplorerProperty[] {
  const needed = new Set([...modifiers.map(modifier => modifier.propertyId), ...sourcePropertyDescriptors(project, 'local').filter(field => propertyValueAtPath(properties, field.path) !== undefined).map(field => field.id)]);
  const prune = (properties: LocalExplorerProperty[]): LocalExplorerProperty[] => properties.flatMap(property => {
    const children = prune(property.children ?? []);
    return needed.has(property.id) || children.length ? [{ ...property, ...(property.children ? { children } : {}) }] : [];
  });
  return prune(project.localExplorerProperties ?? []);
}
export function itemCatalogEntryFromEntity(project: BranchingProject, entityId: string, id = `item-template:${crypto.randomUUID()}`): ItemCatalogEntry {
  const entity = entityDefinition(project, entityId);
  if (!entity) throw Error('El ítem ya no existe.');
  const modifiers = project.entityOverrides?.find(item => item.entityId === entityId)?.inventoryModifiers ?? [];
  return { id, name: entity.name, typeId: entity.typeId ?? 'item', properties: structuredClone(entity.properties), modifiers: structuredClone(modifiers), localProperties: itemCatalogSchema(project, modifiers, entity.properties) };
}
export function withItemCatalogSchema(project: BranchingProject, properties: LocalExplorerProperty[]): BranchingProject {
  // Merge reusable local schema without replacing another story's field definitions.
  const merge = (current: LocalExplorerProperty[], incoming: LocalExplorerProperty[]): LocalExplorerProperty[] => {
    const result = [...current];
    for (const field of incoming) {
      const index = result.findIndex(item => item.id === field.id), existing = result[index];
      if (existing && existing.valueType !== field.valueType) throw Error(`El atributo ${field.label} tiene otro tipo en esta historia.`);
      if (!existing && sourcePropertyDescriptors(project, 'local').some(item => item.id === field.id)) throw Error(`El atributo ${field.label} pertenece a otro grupo en esta historia.`);
      const merged = existing ? { ...existing, ...(field.children ? { children: merge(existing.children ?? [], field.children) } : {}) } : structuredClone(field);
      if (index < 0) result.push(merged); else result[index] = merged;
    }
    return result;
  };
  return { ...project, localExplorerProperties: merge(project.localExplorerProperties ?? [], properties) };
}
export function useCatalogItem(project: BranchingProject, entry: ItemCatalogEntry): { project: BranchingProject; entityId: string } {
  const linked = project.entityOverrides?.find(item => item.itemCatalogEntryId === entry.id && entityDefinition(project, item.entityId));
  if (linked) return { project, entityId: linked.entityId };
  const base = withItemCatalogSchema(project, entry.localProperties ?? []);
  const created = createStoryItem(base, entry.name, entry.typeId);
  let next: BranchingProject = { ...created.project, localExplorerEntities: created.project.localExplorerEntities?.map(entity => entity.id === created.entityId ? { ...entity, properties: structuredClone(entry.properties) } : entity) };
  next = saveStoryItemModifiers(next, created.entityId, entry.modifiers);
  return { entityId: created.entityId, project: { ...next, entityOverrides: next.entityOverrides?.map(item => item.entityId === created.entityId ? { ...item, itemCatalogEntryId: entry.id } : item) } };
}
export function parseItemCatalog(content?: string): ItemCatalogLibrary {
  if (content === undefined) return emptyItemCatalog();
  const data = JSON.parse(content) as ItemCatalogLibrary;
  if (data?.version !== 1 || !Array.isArray(data.entries)) throw Error('Catálogo de ítems no compatible.');
  const ids = new Set<string>();
  for (const entry of data.entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || typeof entry.typeId !== 'string' || !entry.typeId || !entry.properties || typeof entry.properties !== 'object' || Array.isArray(entry.properties) || !Array.isArray(entry.modifiers)) throw Error('Catálogo de ítems inválido.');
    const walk = (properties: LocalExplorerProperty[], seen = new Set<string>()) => { if (!Array.isArray(properties)) throw Error('Esquema de ítem inválido.'); for (const field of properties) { if (!field || typeof field.id !== 'string' || seen.has(field.id) || typeof field.label !== 'string' || !['group', 'entity-type', 'text', 'number', 'boolean', 'date', 'select', 'multiselect', 'entity-ref', 'entity-ref-list'].includes(field.valueType)) throw Error('Esquema de ítem inválido.'); seen.add(field.id); if (field.children) walk(field.children, seen); } };
    walk(entry.localProperties ?? []);
    const seen = new Set<string>();
    for (const modifier of entry.modifiers) { if (!modifier || typeof modifier.id !== 'string' || !modifier.id || seen.has(modifier.id) || typeof modifier.propertyId !== 'string' || !modifier.propertyId || typeof modifier.amount !== 'number' || !Number.isFinite(modifier.amount) || !['carried', 'equipped'].includes(modifier.activation)) throw Error('Bono de ítem inválido.'); seen.add(modifier.id); }
    ids.add(entry.id);
  }
  return structuredClone(data);
}
export function serializeItemCatalog(library: ItemCatalogLibrary): string { parseItemCatalog(JSON.stringify(library)); return `${JSON.stringify(library, null, 2)}\n`; }
export function itemCatalogFromFiles(files: { relativePath: string; content: string }[]): ItemCatalogLibrary { return parseItemCatalog(files.find(file => file.relativePath === itemCatalogPath)?.content); }
