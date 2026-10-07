import { normalizeProject } from '../lib/projectSerialization.js';
export function fixture() {
  return normalizeProject({ specVersion: '0.1', projectId: 'conditional-regression', canonRefs: [
    { id: 'key', kind: 'item', label: 'Key', properties: {} },
  ], sequences: [{ id: 'main', name: 'Main', entryEventId: 'a', eventIds: ['a','b','c'] }], branches: [],
  events: [{ id: 'a', name: 'Door', type: 'normal', transitions: [] }, { id: 'b', name: 'Open', type: 'final', transitions: [] }, { id: 'c', name: 'Closed', type: 'final', transitions: [] }],
  scripts: [], externalFunctions: [], variables: { strength: 0 },
  logicVariables: [{ id: 'strength', name: 'Strength', type: 'number', value: 0, groupId: 'default' }],
  localExplorerEntities: [{ id: 'relic', name: 'Relic', type: 'item', fields: { durability: 4, day: '2026-10-06' } }],
  localExplorerProperties: [{ id: 'durability', label: 'Durability', valueType: 'number' }, { id: 'day', label: 'Day', valueType: 'date' }],
  logicTypeOverrides: [{ source: 'canon', typeId: 'item', runtimeRoles: ['owned'] }],
  logicPropertyOverrides: [{ source: 'local', propertyId: 'durability', conditionReadable: true }, { source: 'local', propertyId: 'day', conditionReadable: true }],
  });
}
export const strength = { type: 'value', subject: { kind: 'variable', variableId: 'strength' }, operator: '>=', value: 5 };
