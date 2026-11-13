import type { BranchingProject, EntityOwner, PlayerSimulationState } from './domain.js';
import type { AuthoringTrace } from './authoringEngine.js';
import { entityDefinition } from './authoringEntities.js';
import { resolveLogicField } from './logicCapabilities.js';
import { canonVariantsForRef } from './worldnotionVariants.js';
import { findLocalExplorerPropertyByReference } from './explorerSchema.js';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keys = (a: object | undefined, b: object | undefined) => new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);

/** Describe actual execution changes, never planned effects or Debug edits. */
export function storyTestConsequenceSummary(project: BranchingProject, trace: AuthoringTrace, locale: 'en' | 'es'): string[] {
  if (trace.kind !== 'effect' || !trace.before || !trace.after) return [];
  const before = trace.before, after = trace.after, es = locale === 'es';
  const lines: string[] = [];
  const entityName = (id: string) => entityDefinition(project, id)?.name ?? (es ? 'Entidad no disponible' : 'Unavailable entity');
  const valueText = (value: unknown): string => value === undefined || value === null ? (es ? 'Sin valor' : 'Unset')
    : typeof value === 'boolean' ? (value ? es ? 'Sí' : 'Yes' : 'No')
    : typeof value === 'string' ? entityDefinition(project, value)?.name ?? value
    : Array.isArray(value) ? value.map(valueText).join(', ') || (es ? 'Vacío' : 'Empty') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const changedValue = (label: string, oldValue: unknown, newValue: unknown) => {
    if (!same(oldValue, newValue)) lines.push(`${label}: ${oldValue === undefined ? '' : `${valueText(oldValue)} → `}${valueText(newValue)}`);
  };
  const propertyLabel = (entityId: string | undefined, id: string) => entityId
    ? resolveLogicField(project, { kind: 'entity', entityId }, 'effect', 'property', id).label
    : findLocalExplorerPropertyByReference(project.localExplorerProperties, id)?.label ?? id;
  const properties = (name: string, entityId: string | undefined, oldProperties: unknown, newProperties: unknown, path = '') => {
    const oldRecord = record(oldProperties), newRecord = record(newProperties);
    for (const id of keys(oldRecord, newRecord)) {
      const propertyId = path ? `${path}.${id}` : id;
      const oldValue = oldRecord[id], newValue = newRecord[id];
      if (same(oldValue, newValue)) continue;
      if (Object.keys(record(oldValue)).length || Object.keys(record(newValue)).length) properties(name, entityId, oldValue, newValue, propertyId);
      else changedValue(`${name} · ${propertyLabel(entityId, propertyId)}`, oldValue, newValue);
    }
  };
  const states = (name: string, oldStates: Record<string, boolean | undefined> = {}, newStates: Record<string, boolean | undefined> = {}) => {
    for (const id of keys(oldStates, newStates)) {
      if (same(oldStates[id], newStates[id])) continue;
      const enabled = newStates[id] === true;
      const verbs: Record<string, [string, string]> = es
        ? { owned: ['Otorgado', 'Retirado'], unlocked: ['Desbloqueado', 'Bloqueado'], discovered: ['Descubierto', 'Ocultado'], present: ['Presente', 'Ausente'] }
        : { owned: ['Granted', 'Removed'], unlocked: ['Unlocked', 'Locked'], discovered: ['Discovered', 'Hidden'], present: ['Present', 'Absent'] };
      if (verbs[id]) lines.push(`${verbs[id][enabled ? 0 : 1]}: ${name}`);
      else changedValue(`${name} · ${id}`, oldStates[id], newStates[id]);
    }
  };
  for (const id of keys(before.variables, after.variables)) changedValue(project.logicVariables?.find(variable => variable.id === id || variable.name === id)?.name ?? id, before.variables?.[id], after.variables?.[id]);
  for (const id of keys(before.entityStates, after.entityStates)) {
    states(entityName(id), before.entityStates?.[id]?.states, after.entityStates?.[id]?.states);
    properties(entityName(id), id, before.entityStates?.[id]?.properties, after.entityStates?.[id]?.properties);
  }
  for (const id of keys(before.entityVariantStates, after.entityVariantStates)) {
    for (const variantId of keys(before.entityVariantStates?.[id], after.entityVariantStates?.[id])) {
      const ref = project.canonRefs.find(ref => ref.id === id);
      const variantName = ref ? canonVariantsForRef(ref).find(variant => variant.id === variantId)?.label : undefined;
      const name = `${entityName(id)} · ${variantName ?? variantId}`;
      states(name, before.entityVariantStates?.[id]?.[variantId]?.states, after.entityVariantStates?.[id]?.[variantId]?.states);
      properties(name, id, before.entityVariantStates?.[id]?.[variantId]?.properties, after.entityVariantStates?.[id]?.[variantId]?.properties);
    }
  }
  // Compatibility mirrors are included only when no unified overlay describes
  // the same change, avoiding duplicate grant and property announcements.
  for (const [field, stateId] of [['inventory', 'owned'], ['unlockedCanonRefs', 'unlocked']] as const) {
    const oldIds = new Set(before[field]), newIds = new Set(after[field]);
    for (const id of new Set([...oldIds, ...newIds])) {
      if (oldIds.has(id) === newIds.has(id) || !same(before.entityStates?.[id]?.states?.[stateId], after.entityStates?.[id]?.states?.[stateId])) continue;
      states(entityName(id), { [stateId]: oldIds.has(id) }, { [stateId]: newIds.has(id) });
    }
  }
  for (const id of keys(before.grantableProperties, after.grantableProperties)) {
    if (same(before.entityStates?.[id]?.properties, after.entityStates?.[id]?.properties)) properties(entityName(id), id, before.grantableProperties?.[id], after.grantableProperties?.[id]);
  }
  const ownerName = (owner: EntityOwner | undefined, state: PlayerSimulationState): string => {
    if (!owner) return es ? 'Sin propietario' : 'No owner';
    if (owner.kind === 'entity') {
      const name = entityName(owner.entityId);
      const ref = owner.variantId && owner.variantId !== 'base' ? project.canonRefs.find(item => item.id === owner.entityId) : undefined;
      const variant = ref ? canonVariantsForRef(ref).find(item => item.id === owner.variantId) : undefined;
      return `${name}${owner.variantId && owner.variantId !== 'base' ? ` · ${variant?.label ?? owner.variantId}` : ''}`;
    }
    if (owner.kind === 'instance') return state.entityInstances?.find(copy => copy.id === owner.instanceId)?.name ?? (es ? 'Contenedor' : 'Container');
    if (owner.kind === 'profile') return project.playerProfiles?.find(profile => profile.id === owner.profileId)?.name ?? (es ? 'Perfil actual' : 'Current profile');
    return owner.role === 'actor' ? 'Actor' : owner.role === 'target' ? es ? 'Destinatario' : 'Recipient' : es ? 'Origen' : 'Source';
  };
  for (const copy of after.entityInstances ?? []) {
    const old = before.entityInstances?.find(item => item.id === copy.id);
    const name = copy.name ?? entityName(copy.entityId);
    if (!old) { lines.push(`${es ? 'Añadido' : 'Added'}: ${name}${copy.owner ? ` → ${ownerName(copy.owner, after)}` : ''}`); continue; }
    if (!same(old.owner, copy.owner)) lines.push(`${name} → ${ownerName(copy.owner, after)}`);
    states(name, old.states, copy.states);
    properties(name, copy.entityId, old.properties, copy.properties);
  }
  for (const copy of before.entityInstances ?? []) if (!after.entityInstances?.some(item => item.id === copy.id)) lines.push(`${es ? 'Retirado' : 'Removed'}: ${copy.name ?? entityName(copy.entityId)}`);
  for (const id of new Set([...(before.dataObjects ?? []).map(item => item.id), ...(after.dataObjects ?? []).map(item => item.id)])) {
    const old = before.dataObjects?.find(item => item.id === id), next = after.dataObjects?.find(item => item.id === id);
    if (!old || !next) lines.push(`${next ? es ? 'Añadido' : 'Added' : es ? 'Retirado' : 'Removed'}: ${(next ?? old)!.name}`);
    else properties(next.name, undefined, old.fields, next.fields);
  }
  for (const id of keys(before.externalResults, after.externalResults)) changedValue(project.externalFunctions.find(fn => fn.name === id)?.name ?? (es ? 'Función externa' : 'External function'), before.externalResults?.[id], after.externalResults?.[id]);
  return [...new Set(lines)];
}
