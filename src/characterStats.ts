import type { BranchingProject, CanonPropertyDescriptor, LogicSubject, PlayerSimulationState } from './domain.js';
import { canonVariantsForRef, resolveCanonVariantFrontmatter } from './worldnotionVariants.js';
import { inventoryPropertyModifiers, type InventoryModifierContribution } from './inventoryModifiers.js';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
const own = (value: RecordValue | undefined, key: string) => Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
const normalized = (id: string | undefined) => id?.replace(/^type:/, '');

/** Snapshot canonical schema once on import/refresh; runtime needs no WorldNotion UI state. */
export function canonicalPropertyDescriptors(config: RecordValue | undefined): CanonPropertyDescriptor[] {
  const output: CanonPropertyDescriptor[] = [];
  const visit = (definitions: unknown, path: string[], groups: string[], parentScope?: string[]) => {
    if (!Array.isArray(definitions)) return;
    for (const raw of definitions) {
      const field = record(raw);
      if (!field || typeof field.id !== 'string') continue;
      const scope = strings(field.appliesTo) ?? strings(field.appliesToTypes);
      const appliesToTypes = parentScope && scope ? parentScope.filter(id => scope.some(child => normalized(child) === normalized(id))) : scope ?? parentScope;
      const label = typeof field.label === 'string' ? field.label : field.id;
      const valueType = typeof field.type === 'string' ? field.type : 'text';
      const nextPath = [...path, field.id];
      if (valueType !== 'group') output.push({ id: field.id, label, valueType, path: nextPath, groupPath: groups,
        ...(appliesToTypes ? { appliesToTypes } : {}), ...(typeof field.min === 'number' ? { min: field.min } : {}), ...(typeof field.max === 'number' ? { max: field.max } : {}),
        ...(Object.prototype.hasOwnProperty.call(field, 'defaultValue') ? { defaultValue: field.defaultValue } : {}) });
      visit(field.children, nextPath, [...groups, label], appliesToTypes);
    }
  };
  visit(record(config?.baseProperties)?.definitions, [], []);
  visit(record(config?.customFields)?.definitions, [], []);
  return output;
}

export function characterPropertyDescriptor(project: Partial<BranchingProject>, propertyId: string): CanonPropertyDescriptor | undefined {
  const canon = project.canonPropertyDescriptors?.find(field => field.id === propertyId);
  if (canon) return canon;
  const find = (fields: BranchingProject['localExplorerProperties'], path: string[] = [], groups: string[] = [], parentScope?: string[]): CanonPropertyDescriptor | undefined => {
    for (const field of fields ?? []) {
      const nextPath = [...path, field.id];
      const scope = field.appliesToTypes?.length ? field.appliesToTypes : undefined;
      const appliesToTypes = parentScope && scope ? parentScope.filter(id => scope.some(child => normalized(child) === normalized(id))) : scope ?? parentScope;
      if (field.id === propertyId || field.id === `property:${propertyId}`) return { id: field.id, label: field.label, valueType: field.valueType, path: nextPath, groupPath: groups, appliesToTypes };
      const nested = find(field.children, nextPath, [...groups, field.label], appliesToTypes);
      if (nested) return nested;
    }
    return undefined;
  };
  return find(project.localExplorerProperties);
}

export function propertyValueAtPath(values: unknown, path: readonly string[]): unknown {
  let current = values;
  for (const key of path) { const value = record(current); if (!value || !own(value, key)) return undefined; current = value[key]; }
  return current;
}

/** Include every declared leaf, not only fields with an individual capability override. */
export function sourcePropertyDescriptors(project: Partial<BranchingProject>, source: 'canon' | 'local'): CanonPropertyDescriptor[] {
  if (source === 'canon') {
    const fields = project.canonPropertyDescriptors ?? [];
    const groups = new Map<string, CanonPropertyDescriptor>();
    for (const field of fields) for (let index = 0; index < field.path.length - 1; index++) {
      const id = field.path[index], existing = groups.get(id);
      groups.set(id, { id, label: field.groupPath?.[index] ?? id, valueType: 'group', path: field.path.slice(0, index + 1), groupPath: field.groupPath?.slice(0, index),
        appliesToTypes: existing ? existing.appliesToTypes && field.appliesToTypes ? [...new Set([...existing.appliesToTypes, ...field.appliesToTypes])] : undefined : field.appliesToTypes });
    }
    return [...groups.values(), ...fields];
  }
  const output: CanonPropertyDescriptor[] = [];
  const visit = (fields: BranchingProject['localExplorerProperties'], path: string[] = [], groups: string[] = [], parentScope?: string[]) => {
    for (const field of fields ?? []) {
      const scope = field.appliesToTypes?.length ? field.appliesToTypes : undefined;
      const appliesToTypes = parentScope && scope ? parentScope.filter(id => scope.some(child => normalized(child) === normalized(id))) : scope ?? parentScope;
      const nextPath = [...path, field.id];
      output.push({ id: field.id, label: field.label, valueType: field.valueType, path: nextPath, groupPath: groups, appliesToTypes });
      visit(field.children, nextPath, [...groups, field.label], appliesToTypes);
    }
  };
  visit(project.localExplorerProperties);
  return output;
}

type ReadDescriptor = Pick<CanonPropertyDescriptor, 'path' | 'groupPath' | 'appliesToTypes'>;
export type PropertyReadPermission = {
  value?: boolean;
  enabled: boolean;
  inheritedFrom?: { propertyId: string; label: string };
  mixed?: boolean;
  /** A saved choice to inherit must survive legacy capability migration. */
  managed?: boolean;
};

/** Nearest explicit field/group flag wins, followed by the concrete entity type. */
export function propertyReadPermission(project: Partial<BranchingProject>, source: 'canon' | 'local', propertyId: string,
  options: { typeId?: string; descriptor?: ReadDescriptor; ignoreOwn?: boolean } = {}): PropertyReadPermission {
  const fields = sourcePropertyDescriptors(project, source);
  const field = fields.find(item => item.id === propertyId || source === 'local' && item.id === `property:${propertyId}`);
  const descendant = field ? undefined : fields.find(item => item.path.slice(0, -1).includes(propertyId));
  const parentIndex = descendant?.path.indexOf(propertyId);
  const descriptor = options.descriptor ?? field ?? (descendant && parentIndex !== undefined ? {
    path: descendant.path.slice(0, parentIndex + 1), groupPath: descendant.groupPath?.slice(0, parentIndex), appliesToTypes: descendant.appliesToTypes,
  } : undefined);
  const explicit = (id: string) => project.logicPropertyOverrides?.find(item => item.source === source && item.propertyId === id)?.conditionReadable;
  const followsParent = (id: string) => project.logicPropertyOverrides?.some(item => item.source === source && item.propertyId === id && item.conditionReadableInherited === true);
  let managed = followsParent(field?.id ?? propertyId);
  const ownValue = options.ignoreOwn ? undefined : explicit(field?.id ?? propertyId);
  if (typeof ownValue === 'boolean') return { value: ownValue, enabled: ownValue };
  const parents = descriptor?.path.slice(0, -1) ?? [];
  for (let index = parents.length - 1; index >= 0; index--) {
    managed ||= followsParent(parents[index]);
    const value = explicit(parents[index]);
    if (typeof value === 'boolean') return { value, enabled: value, inheritedFrom: { propertyId: parents[index], label: descriptor?.groupPath?.[index] ?? fields.find(item => item.id === parents[index])?.label ?? parents[index] } };
  }
  if (propertyId.startsWith('type:') || field?.valueType === 'entity-type') return { enabled: false, managed };
  const typeIds = options.typeId ? [normalized(options.typeId)!] : descriptor?.appliesToTypes?.length ? descriptor.appliesToTypes.map(id => normalized(id)!) : [...new Set([
    ...(source === 'canon' ? project.canonRefs?.map(item => item.kind) ?? [] : project.localExplorerEntities?.map(item => item.type) ?? []),
    ...fields.flatMap(item => item.appliesToTypes ?? []),
    ...(project.logicPropertyOverrides ?? []).filter(item => item.source === source && item.propertyId.startsWith('type:')).map(item => item.propertyId.slice(5)),
  ].filter((id): id is string => Boolean(id)).map(id => normalized(id)!))];
  const inherited = typeIds.map(id => ({ id, value: explicit(`type:${id}`) }));
  managed ||= typeIds.some(id => followsParent(`type:${id}`));
  if (!inherited.length) return { enabled: false, managed };
  const first = inherited[0];
  if (inherited.some(item => item.value !== first.value)) return { enabled: false, mixed: true, managed };
  return { value: first.value, enabled: first.value === true, managed, ...(first.value !== undefined ? { inheritedFrom: { propertyId: `type:${first.id}`, label: first.id } } : {}) };
}

/** Undefined deletes only the read exception so JSON save/reopen restores live inheritance. */
export function updatePropertyCapability(project: BranchingProject, source: 'canon' | 'local', propertyId: string,
  changes: Partial<NonNullable<BranchingProject['logicPropertyOverrides']>[number]>): BranchingProject {
  const existing = project.logicPropertyOverrides?.find(item => item.source === source && item.propertyId === propertyId);
  const next = { ...existing, propertyId, source, ...changes };
  if (Object.prototype.hasOwnProperty.call(changes, 'conditionReadable')) {
    if (changes.conditionReadable === undefined) { delete next.conditionReadable; next.conditionReadableInherited = true; }
    else delete next.conditionReadableInherited;
  }
  return { ...project, logicPropertyOverrides: [...(project.logicPropertyOverrides ?? []).filter(item => !(item.source === source && item.propertyId === propertyId)), next] };
}

export type CharacterSubject = Extract<LogicSubject, { kind: 'entity' | 'instance' }>;
export function resolveCharacterSubject(project: Partial<BranchingProject>, state: PlayerSimulationState, subject: LogicSubject): { subject?: CharacterSubject; entityId?: string; variantId?: string; error?: string; unresolved?: string } {
  let current = subject;
  for (let depth = 0; current.kind === 'context'; depth++) {
    if (depth > 3 || !state.context?.[current.role]) return { unresolved: `Supply ${current.role} context` };
    current = state.context[current.role]!;
  }
  if (current.kind !== 'entity' && current.kind !== 'instance') return { error: 'Expected a character or copy' };
  const instance = current.kind === 'instance' ? (state.entityInstances ?? project.entityInstances ?? []).find(item => item.id === current.instanceId) : undefined;
  if (current.kind === 'instance' && !instance) return { error: `Missing copy ${current.instanceId}` };
  const entityId = current.kind === 'entity' ? current.entityId : instance!.entityId;
  const variantId = current.kind === 'entity' ? current.variantId ?? 'base' : instance?.variantId ?? 'base';
  const canon = project.canonRefs?.find(item => item.id === entityId);
  const local = project.localExplorerEntities?.find(item => item.id === entityId);
  if (!canon && !local) return { error: `Missing entity ${entityId}` };
  if (variantId !== 'base' && (!canon || !canonVariantsForRef(canon).some(variant => variant.id === variantId))) return { error: `Missing variant ${variantId}` };
  return { subject: current, entityId, variantId };
}

export function characterVariantOverlay(state: PlayerSimulationState, entityId: string, variantId = 'base') {
  return variantId === 'base' ? state.entityStates?.[entityId] : state.entityVariantStates?.[entityId]?.[variantId];
}

export function characterPropertyPermissions(project: Partial<BranchingProject>, entityId: string, propertyId: string) {
  const source = project.canonRefs?.some(item => item.id === entityId) ? 'canon' : 'local';
  const individual = project.entityOverrides?.find(item => item.entityId === entityId)?.properties?.[propertyId];
  const shared = project.logicPropertyOverrides?.find(item => item.source === source && item.propertyId === propertyId);
  const typeId = project.canonRefs?.find(item => item.id === entityId)?.kind ?? project.localExplorerEntities?.find(item => item.id === entityId)?.type;
  return { readable: (individual?.conditionReadable ?? propertyReadPermission(project, source, propertyId, { typeId }).value) === true, writable: (individual?.actionWritable ?? shared?.actionWritable) === true };
}

/** Numeric drafts remain strings until a whole, finite value can be committed. */
export function parseCharacterStatDraft(text: string, field: Pick<CanonPropertyDescriptor, 'min' | 'max'>): { value?: number; valid: boolean; error?: 'number' | 'range' } {
  if (!text.trim()) return { valid: true, value: undefined };
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) return { valid: false, error: 'number' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { valid: false, error: 'number' };
  if (field.min !== undefined && value < field.min || field.max !== undefined && value > field.max) return { valid: false, error: 'range' };
  return { valid: true, value };
}

/** One resolver shared by conditions, consequences, interaction snapshots and sheets. */
function resolveUnmodifiedCharacterProperty(project: Partial<BranchingProject>, state: PlayerSimulationState, subject: LogicSubject, propertyId: string, options: { purpose?: 'condition' | 'effect' | 'display'; baseOnly?: boolean } = {}): { value?: unknown; error?: string; unresolved?: string } {
  const resolved = resolveCharacterSubject(project, state, subject);
  if (!resolved.subject || !resolved.entityId) return resolved;
  const { entityId, variantId } = resolved;
  const canon = project.canonRefs?.find(item => item.id === entityId);
  const local = project.localExplorerEntities?.find(item => item.id === entityId);
  const source = canon ? 'canon' : 'local';
  const descriptor = characterPropertyDescriptor(project, propertyId);
  const typeId = normalized(canon?.kind ?? local?.type);
  if (descriptor?.appliesToTypes && (!descriptor.appliesToTypes.length || !descriptor.appliesToTypes.some(id => normalized(id) === typeId))) return { error: `Property ${propertyId} does not apply to this character` };
  const individual = project.entityOverrides?.find(item => item.entityId === entityId)?.properties?.[propertyId];
  const shared = project.logicPropertyOverrides?.find(item => item.source === source && item.propertyId === propertyId);
  const flag = options.purpose === 'effect' ? 'actionWritable' : 'conditionReadable';
  const inheritedRead = propertyReadPermission(project, source, propertyId, { typeId });
  const permission = options.purpose === 'effect' ? individual?.actionWritable ?? shared?.actionWritable
    : individual?.conditionReadable ?? inheritedRead.value ?? (inheritedRead.managed ? false : undefined);
  if (options.purpose !== 'display' && permission === false) return { error: `Property ${propertyId} is not ${flag === 'actionWritable' ? 'writable' : 'readable'}` };
  if (!options.baseOnly) {
    if (resolved.subject.kind === 'instance') {
      const copy = (state.entityInstances ?? project.entityInstances ?? []).find(item => resolved.subject?.kind === 'instance' && item.id === resolved.subject.instanceId);
      if (own(copy?.properties, propertyId)) return { value: copy!.properties![propertyId] };
    }
    const overlay = characterVariantOverlay(state, entityId, variantId);
    if (own(overlay?.properties, propertyId)) return { value: overlay!.properties![propertyId] };
  }
  const localValues = { ...record((local as unknown as { fields?: RecordValue } | undefined)?.fields), ...local?.properties };
  const values = canon ? resolveCanonVariantFrontmatter(canon, variantId) : localValues;
  const path = descriptor?.path ?? [propertyId];
  const value = propertyValueAtPath(values, path);
  if (value !== undefined) return { value };
  // Imported manual canon can have a properties snapshot without frontmatter.
  if (variantId === 'base' && own(canon?.properties, propertyId)) return { value: canon!.properties![propertyId] };
  if (own(localValues, propertyId)) return { value: localValues[propertyId] };
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'defaultValue') ? { value: descriptor.defaultValue } : { value: undefined };
}

/** Reads use the current effective value. Writes operate on the mutable value so bonuses never become permanent. */
export function resolveCharacterProperty(project: Partial<BranchingProject>, state: PlayerSimulationState, subject: LogicSubject, propertyId: string, options: { purpose?: 'condition' | 'effect' | 'display'; baseOnly?: boolean } = {}): { value?: unknown; error?: string; unresolved?: string; unmodifiedValue?: number; modifiers?: InventoryModifierContribution[] } {
  const result = resolveUnmodifiedCharacterProperty(project, state, subject, propertyId, options);
  if (result.error || result.unresolved || options.baseOnly || options.purpose === 'effect' || typeof result.value !== 'number' || !Number.isFinite(result.value)) return result;
  const resolved = resolveCharacterSubject(project, state, subject);
  if (!resolved.subject) return result;
  const inventory = inventoryPropertyModifiers(project, state, resolved.subject, propertyId);
  if (inventory.error) return { error: inventory.error };
  if (!inventory.modifiers.length) return result;
  const value = inventory.modifiers.reduce((total, modifier) => total + modifier.amount, result.value);
  return Number.isFinite(value) ? { value, unmodifiedValue: result.value, modifiers: inventory.modifiers } : { error: `Inventory modifiers overflow ${propertyId}` };
}

export function characterNumericFields(project: BranchingProject, subject: LogicSubject, state: PlayerSimulationState = {}): CanonPropertyDescriptor[] {
  const resolved = resolveCharacterSubject(project, state, subject);
  if (!resolved.entityId) return [];
  const fields = [...(project.canonPropertyDescriptors ?? [])];
  const visit = (items: BranchingProject['localExplorerProperties']) => { for (const item of items ?? []) { const descriptor = characterPropertyDescriptor(project, item.id); if (descriptor && !fields.some(field => field.id === descriptor.id)) fields.push(descriptor); visit(item.children); } };
  visit(project.localExplorerProperties);
  const entity = project.canonRefs.find(item => item.id === resolved.entityId);
  const local = project.localExplorerEntities?.find(item => item.id === resolved.entityId);
  return fields.filter(field => ['number', 'integer', 'float'].includes(field.valueType) && (!field.appliesToTypes || field.appliesToTypes.some(id => normalized(id) === normalized(entity?.kind ?? local?.type))));
}
