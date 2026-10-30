import type { BranchingProject, Condition, EntityRuntimeStateRole, LogicVariableType, LogicPredicate, LocalExplorerPropertyValueType } from './domain.js';
import { createLocalExplorerEntity } from './explorerEntities.js';
import { conditionValueMatchesType } from './conditionEvaluation.js';
import { characterPropertyDescriptor, sourcePropertyDescriptors } from './characterStats.js';
import { logicFieldOptions, logicOperatorsFor } from './logicCapabilities.js';
export { mergeInteractionCreation as mergeConditionReferenceCreation } from './interactionCreation.js';

export type ConditionReferenceCreationKind = 'state' | 'property' | 'value' | 'instanceQuery' | 'external';
export type ConditionReferenceDraft = {
  kind: ConditionReferenceCreationKind;
  name: string;
  condition?: Condition;
  variableType?: LogicVariableType;
  initialValue?: string | number | boolean | string[];
  groupId?: string;
  entityType?: string;
  stateId?: EntityRuntimeStateRole;
  propertyId?: string;
  newProperty?: { name: string; valueType: LocalExplorerPropertyValueType };
  addInventoryCopy?: boolean;
};

/** Reuse typed schema fields for a new local entity, without enabling an entire type. */
export function conditionCreationPropertyOptions(project: BranchingProject, typeId: string) {
  const normalized = typeId.replace(/^type:/, '');
  const fields = [...sourcePropertyDescriptors(project, 'local'), ...sourcePropertyDescriptors(project, 'canon')];
  return fields.filter((field, index) => fields.findIndex(other => other.id === field.id) === index
    && !['group', 'entity-type', 'entity type', 'image', 'scriptRef'].includes(field.valueType)
    && (field.appliesToTypes === undefined || field.appliesToTypes.some(id => id.replace(/^type:/, '') === normalized)));
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base, serial = 2;
  while (used.has(id)) id = `${base}-${serial++}`;
  return id;
}
function setNestedValue(path: string[], value: unknown): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>((child, key, index) => ({ [key]: index === path.length - 1 ? value : child }), {});
}
function comparison(project: BranchingProject, subject: LogicPredicate['subject'], kind: 'value' | 'state' | 'property', fieldId: string, previous?: Condition): Condition {
  const field = logicFieldOptions(project, subject, 'condition').find(item => item.kind === kind && item.key === fieldId);
  if (!field) throw Error('La referencia creada no está disponible para esta condición.');
  const old = previous as LogicPredicate | undefined;
  const operator = old && logicOperatorsFor(field).includes(old.operator) ? old.operator : kind === 'state' ? 'has' : '==';
  const valueType = ['contains', 'notContains'].includes(operator) ? 'text' : field.valueType;
  return { type: kind, subject, operator, ...(kind === 'state' ? { stateId: fieldId } : kind === 'property' ? { propertyId: fieldId } : {}),
    ...(!['has', 'missing', 'exists'].includes(operator) && previous && 'value' in previous && conditionValueMatchesType(previous.value, valueType) ? { value: previous.value } : {}) } as Condition;
}

/** Creation is pure; the caller commits the resource and its condition together. */
export function createConditionReference(project: BranchingProject, draft: ConditionReferenceDraft): { project: BranchingProject; condition: Condition } {
  if (!['state', 'property', 'value', 'instanceQuery', 'external'].includes(draft.kind)) throw Error('Este tipo de condición no admite crear esa referencia.');
  const name = draft.name.trim();
  if (!name) throw Error('Escribe un nombre.');
  if (draft.kind === 'external') {
    if (project.externalFunctions?.some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('Ya existe una función con ese nombre.');
    const next = { ...project, externalFunctions: [...(project.externalFunctions ?? []), { name, kind: 'condition' as const }] };
    const operator = draft.condition?.type === 'external' && draft.condition.operator === 'missing' ? 'missing' : 'has';
    return { project: next, condition: { type: 'external', subject: { kind: 'external', functionId: name }, operator, ...(draft.condition?.type === 'external' && draft.condition.arguments ? { arguments: draft.condition.arguments } : {}) } };
  }
  if (draft.kind === 'value') {
    const type = draft.variableType ?? 'number';
    if (!['text', 'number', 'boolean', 'list', 'canonRef'].includes(type)) throw Error('Elige un tipo de variable válido.');
    if (project.logicVariables?.some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) throw Error('Ya existe una variable con ese nombre.');
    const value = draft.initialValue ?? (type === 'number' ? 0 : type === 'boolean' ? false : type === 'list' ? [] : '');
    if (!conditionValueMatchesType(value, type)) throw Error('El valor inicial no corresponde al tipo de variable.');
    if (type === 'canonRef' && value && ![...project.canonRefs.map(item => item.id), ...(project.localExplorerEntities ?? []).map(item => item.id)].includes(String(value))) throw Error('Elige una entidad existente como valor inicial.');
    const id = uniqueId(`variable:${crypto.randomUUID()}`, new Set(project.logicVariables?.map(item => item.id)));
    const groups = project.logicVariableGroups?.length ? project.logicVariableGroups : [{ id: 'default', name: 'General', order: 0 }];
    const groupId = draft.groupId ?? groups[0].id;
    if (!groups.some(item => item.id === groupId)) throw Error('El grupo de variables ya no existe.');
    const next = { ...project, logicVariableGroups: groups, logicVariables: [...(project.logicVariables ?? []), { id, name, type, value, groupId }] };
    return { project: next, condition: comparison(next, { kind: 'variable', variableId: id }, 'value', 'value', draft.condition) };
  }
  const type = draft.entityType?.trim().replace(/^type:/, '');
  if (!type) throw Error('Elige un tipo de entidad.');
  const base = createLocalExplorerEntity(type, name);
  const id = uniqueId(base.id, new Set([...project.canonRefs.map(item => item.id), ...(project.localExplorerEntities ?? []).map(item => item.id)]));
  const entity = { ...base, id };
  let next: BranchingProject = { ...project, localExplorerEntities: [...(project.localExplorerEntities ?? []), entity] };
  if (draft.kind === 'property') {
    let propertyId = draft.propertyId;
    if (draft.newProperty) {
      const label = draft.newProperty.name.trim();
      if (!label) throw Error('Escribe el nombre del atributo.');
      if (!['text', 'number', 'boolean', 'date', 'select', 'multiselect', 'entity-ref', 'entity-ref-list'].includes(draft.newProperty.valueType)) throw Error('Elige un tipo de atributo comparable.');
      propertyId = uniqueId(`property:${crypto.randomUUID()}`, new Set([...sourcePropertyDescriptors(project, 'local'), ...sourcePropertyDescriptors(project, 'canon')].map(item => item.id)));
      next = { ...next, localExplorerProperties: [...(next.localExplorerProperties ?? []), { id: propertyId, label, valueType: draft.newProperty.valueType, appliesToTypes: [type], createdAt: base.createdAt, updatedAt: base.updatedAt }] };
    }
    const field = conditionCreationPropertyOptions(next, type).find(item => item.id === propertyId);
    if (!field || !propertyId) throw Error('Elige un atributo que corresponda al tipo de entidad.');
    if (!conditionValueMatchesType(draft.initialValue, field.valueType)) throw Error('El valor inicial no corresponde al atributo.');
    entity.properties = setNestedValue(characterPropertyDescriptor(next, propertyId)?.path ?? [propertyId], draft.initialValue);
    next = { ...next, entityOverrides: [...(next.entityOverrides ?? []), { entityId: id, properties: { [propertyId]: { conditionReadable: true } } }] };
    return { project: next, condition: comparison(next, { kind: 'entity', entityId: id, source: 'local' }, 'property', propertyId, draft.condition) };
  }
  const stateId = draft.stateId ?? 'owned';
  if (!['owned', 'unlocked', 'discovered', 'present'].includes(stateId)) throw Error('Elige un estado válido.');
  const ownable = draft.kind === 'instanceQuery' || stateId === 'owned';
  next = { ...next, entityOverrides: [...(next.entityOverrides ?? []), { entityId: id, ...(ownable ? { grantable: true } : {}), ...(draft.kind === 'instanceQuery' || draft.addInventoryCopy && ownable ? { inventoryItem: true } : {}), runtimeRoles: { [draft.kind === 'instanceQuery' ? 'owned' : stateId]: true } }] };
  if (draft.addInventoryCopy && ownable) {
    const profileId = next.activePlayerProfileId ?? next.playerProfiles?.[0]?.id ?? 'default';
    const instanceId = uniqueId(`instance:${crypto.randomUUID()}`, new Set(next.entityInstances?.map(item => item.id)));
    const copy = { id: instanceId, entityId: id, properties: {}, owner: { kind: 'profile' as const, profileId } };
    next = { ...next, entityInstances: [...(next.entityInstances ?? []), copy],
      playerProfiles: next.playerProfiles?.map(profile => profile.id === profileId && profile.simulation.entityInstances !== undefined ? { ...profile, simulation: { ...profile.simulation, entityInstances: [...profile.simulation.entityInstances, copy] } } : profile),
      ...(profileId === 'default' && next.playerSimulation?.entityInstances !== undefined ? { playerSimulation: { ...next.playerSimulation, entityInstances: [...next.playerSimulation.entityInstances, copy] } } : {}) };
  }
  return { project: next, condition: draft.kind === 'instanceQuery'
    ? { ...(draft.condition?.type === 'instanceQuery' ? draft.condition : { type: 'instanceQuery' as const, quantifier: 'some' as const }), entityId: id }
    : comparison(next, { kind: 'entity', entityId: id, source: 'local' }, 'state', stateId, draft.condition) };
}
