import assert from 'node:assert/strict';
import { test } from 'node:test';

const { entityUsages, removeLocalExplorerPropertyValues } = await import('../lib/authoringEntities.js');

function fixture() {
  return {
    specVersion: '0.1', projectId: 'property-deletion', canonRefs: [], sequences: [], branches: [],
    events: [], scripts: [], externalFunctions: [], variables: {},
    localExplorerProperties: [{ id: 'lab-wear', label: 'Wear', valueType: 'number' }],
    localExplorerEntities: [{ id: 'key', type: 'item', name: 'Key', status: 'active', properties: { 'lab-wear': 8, 'lab-usable': true }, createdAt: '', updatedAt: '' }],
    logicPropertyOverrides: [
      { propertyId: 'lab-wear', source: 'local', actionWritable: true },
      { propertyId: 'lab-usable', source: 'local', actionWritable: true },
    ],
    entityOverrides: [{ entityId: 'key', properties: { 'lab-wear': { actionWritable: true }, 'lab-usable': { actionWritable: true } } }],
    entityInstances: [{ id: 'key-copy', entityId: 'key', properties: { 'lab-wear': 5, 'lab-usable': true } }],
    playerSimulation: {
      entityInstances: [{ id: 'run-copy', entityId: 'key', properties: { 'lab-wear': 4, 'lab-usable': true } }],
      grantableProperties: { key: { 'lab-wear': 3, 'lab-usable': true } },
      entityStates: { key: { properties: { 'lab-wear': 2, 'lab-usable': true } } },
    },
    playerProfiles: [{ id: 'profile', name: 'Profile', simulation: { entityInstances: [{ id: 'profile-copy', entityId: 'key', properties: { 'lab-wear': 1, 'lab-usable': true } }] } }],
    authoringScenarios: [{ id: 'scenario', name: 'Scenario', state: { entityInstances: [{ id: 'scenario-copy', entityId: 'key', properties: { 'lab-wear': 6, 'lab-usable': true } }] } }],
  };
}

test('deleting a local property clears its stored values and capability settings everywhere', () => {
  const before = fixture();
  const cleaned = removeLocalExplorerPropertyValues(before, 'lab-wear');

  assert.deepEqual(entityUsages(cleaned, 'lab-wear'), []);
  assert.equal(cleaned.localExplorerEntities[0].properties['lab-wear'], undefined);
  assert.equal(cleaned.localExplorerEntities[0].properties['lab-usable'], true);
  assert.deepEqual(cleaned.logicPropertyOverrides.map(item => item.propertyId), ['lab-usable']);
  assert.equal(cleaned.entityOverrides[0].properties['lab-wear'], undefined);
  assert.equal(cleaned.entityInstances[0].properties['lab-wear'], undefined);
  assert.equal(cleaned.playerSimulation.entityInstances[0].properties['lab-wear'], undefined);
  assert.equal(cleaned.playerSimulation.grantableProperties.key['lab-wear'], undefined);
  assert.equal(cleaned.playerSimulation.entityStates.key.properties['lab-wear'], undefined);
  assert.equal(cleaned.playerProfiles[0].simulation.entityInstances[0].properties['lab-wear'], undefined);
  assert.equal(cleaned.authoringScenarios[0].state.entityInstances[0].properties['lab-wear'], undefined);
  assert.equal(before.localExplorerEntities[0].properties['lab-wear'], 8, 'The input project remains untouched.');
});

test('property references outside value maps remain visible for a safe refusal', () => {
  const project = fixture();
  project.events = [{ id: 'event', condition: { type: 'property', propertyId: 'lab-wear' } }];

  const cleaned = removeLocalExplorerPropertyValues(project, 'lab-wear');
  assert.deepEqual(entityUsages(cleaned, 'lab-wear').map(use => use.path), ['events.0.condition.propertyId']);
});
