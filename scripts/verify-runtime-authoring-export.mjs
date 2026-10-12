import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { buildExportPreview } from '../lib/exportPreview.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { authoringCommand, createAuthoringSession } from '../lib/authoringEngine.js';

function fixture() {
  const effect = (id, value) => ({ type: 'value', subject: { kind: 'variable', variableId: id }, operation: 'add', value });
  const strong = { type: 'value', subject: { kind: 'variable', variableId: 'strength' }, operator: '>=', value: 5 };
  return normalizeProject({
    specVersion: '0.1', projectId: 'export-acceptance', storyId: 'story', name: 'The training key',
    canonRefs: [], scripts: [], externalFunctions: [], variables: {}, branches: [], entrySequenceId: 'seq',
    sequences: [{ id: 'seq', name: 'Training', entryEventId: 'room', eventIds: ['room', 'hall', 'wait'] }],
    logicVariables: [{ id: 'strength', name: 'Strength', type: 'number', value: 0, groupId: 'default' }, { id: 'visits', name: 'Visits', type: 'number', value: 0, groupId: 'default' }],
    localExplorerEntities: [{ id: 'key', name: 'Key', type: 'item', properties: { wear: 0 }, status: 'draft', createdAt: '', updatedAt: '' }],
    localExplorerTypes: [{ id: 'item', name: 'Item' }],
    localExplorerProperties: [{ id: 'wear', label: 'Wear', valueType: 'number', createdAt: '', updatedAt: '' }],
    logicTypeOverrides: [{ source: 'local', typeId: 'item', grantable: true, runtimeRoles: ['owned'] }],
    logicPropertyOverrides: [{ source: 'local', propertyId: 'wear', conditionReadable: true, actionWritable: true }],
    entityOverrides: [{ entityId: 'key', grantable: true }],
    entityInstances: [{ id: 'key-a', entityId: 'key', name: 'Initial key', properties: { wear: 1 }, owner: { kind: 'profile', profileId: 'player' } }],
    playerProfiles: [{ id: 'player', name: 'Player', simulation: { variables: { strength: 0, visits: 0 } } }],
    activePlayerProfileId: 'player', playerSimulation: { variables: { strength: 1 } },
    authoringScenarios: [{ id: 'strong', name: 'Already strong', profileId: 'player', state: { variables: { strength: 5, visits: 0 }, entityInstances: [] } }],
    narrativeActions: [{ id: 'train', name: 'Train', repeat: 'each-entry', effects: [effect('strength', 5), { type: 'instanceEffect', operation: 'create', entityId: 'key', instanceId: 'new-key', properties: { wear: 0 }, owner: { kind: 'profile', profileId: 'player' } }] }],
    narrativeRules: [{ id: 'ready', name: 'Ready', trigger: 'stateChanged', scope: { kind: 'global' }, when: strong, priority: 2, effects: [effect('visits', 1)] }],
    assets: [{ id: 'cover', kind: 'image', path: '.everend/assets/image/key.png', name: 'key.png', origin: 'uncanon' }],
    events: [
      { id: 'room', name: 'Room', type: 'normal', text: { format: 'plain', content: 'Train or wait.' }, transitions: [{ id: 'open', from: 'room', to: 'hall', conditions: strong }, { id: 'stay', from: 'room', to: 'wait', mode: 'fallback' }] },
      { id: 'hall', name: 'Hall', type: 'final', text: { format: 'plain', content: 'The door opens.' }, logic: { repeat: 'each-entry', narrativeEffects: [effect('visits', 2)] } },
      { id: 'wait', name: 'Wait', type: 'final', text: { format: 'plain', content: 'The door stays closed.' } },
    ],
    canvas: { viewport: { x: 10, y: 20, zoom: 1 } }, panels: { canonOpen: true }, authoringPreferences: { marker: 'editor-only' },
  });
}

// A consumer reconstructs the authored model from the namespaced extension,
// never from editor memory or a running test session.
function exportedDocument(project) {
  const runtime = JSON.parse(buildExportPreview(project, 'runtime').content);
  return normalizeProject({ ...runtime.pathBranching, specVersion: runtime.specVersion, projectId: runtime.packageId, canonRefs: runtime.canonRefs, variables: runtime.variables, engineTargets: runtime.engineTargets });
}

test('enhanced export keeps modular execution dependencies and named scenarios', () => {
  const project = fixture(), runtime = exportRuntimePackage(project), source = runtime.pathBranching;
  assert.ok(source.requiredFeatures.includes('modular-authoring-v1'));
  assert.equal(source.authoringModelVersion, '0.5');
  for (const key of ['storyId', 'name', 'localExplorerTypes', 'logicTypeOverrides', 'logicPropertyOverrides', 'entityInstances', 'entityOverrides', 'narrativeActions', 'narrativeRules', 'playerProfiles', 'activePlayerProfileId', 'playerSimulation', 'authoringScenarios', 'assets', 'localizationCatalog']) {
    assert.deepEqual(source[key], project[key], key);
  }
  assert.throws(() => exportRuntimePackage(project, { profile: 'legacy' }), /Legacy.*modular/);
  assert.deepEqual(JSON.parse(buildExportPreview(project, 'runtime').content), JSON.parse(JSON.stringify(runtime)));
});

test('reopened export executes the same actions, copy creation, rules and both routes', () => {
  const original = fixture(), exported = exportedDocument(original);
  for (const project of [original, exported]) {
    let run = createAuthoringSession(project);
    assert.equal(run.status, 'ready', run.message);
    const closed = authoringCommand(project, run, { type: 'continue' });
    assert.equal(closed.nodeId, 'wait');
    run = authoringCommand(project, run, { type: 'action', actionId: 'train' });
    assert.equal(run.status, 'ready', run.message);
    assert.equal(run.state.variables.visits, 1);
    assert.equal(run.state.entityInstances.length, 2);
    run = authoringCommand(project, run, { type: 'continue' });
    assert.equal(run.nodeId, 'hall');
    assert.equal(run.state.variables.visits, 3);
  }
  let a = createAuthoringSession(original), b = createAuthoringSession(exported);
  assert.deepEqual(b, a);
  for (const command of [{ type: 'action', actionId: 'train' }, { type: 'continue' }]) {
    a = authoringCommand(original, a, command); b = authoringCommand(exported, b, command);
    assert.deepEqual(b, a);
  }
  assert.deepEqual(createAuthoringSession(exported, exported.authoringScenarios[0]), createAuthoringSession(original, original.authoringScenarios[0]));
});

test('canvas, panels and temporary run edits never alter runtime output', () => {
  const project = fixture(), before = buildExportPreview(project, 'runtime').content;
  const source = JSON.parse(before).pathBranching;
  for (const key of ['canvas', 'panels', 'authoringPreferences', 'session', 'trace', 'history']) assert.equal(key in source, false, key);
  project.canvas = { viewport: { x: 900, y: -20, zoom: 0.5 } };
  project.panels = { canonOpen: false }; project.authoringPreferences = {};
  const run = createAuthoringSession(project);
  authoringCommand(project, run, { type: 'setState', state: { variables: { strength: 99, visits: 42 } } });
  assert.equal(buildExportPreview(project, 'runtime').content, before);
});

test('internal dialogue execution is declared even without actions, copies or effects', () => {
  const project = {
    specVersion: '0.1', projectId: 'dialogue-export', canonRefs: [], scripts: [], externalFunctions: [], variables: {}, branches: [],
    sequences: [{ id: 'seq', name: 'Scene', entryEventId: 'room', eventIds: ['room'] }], entrySequenceId: 'seq',
    scriptDocuments: [{ id: 'script', name: 'Scene', format: 'forge-script', blocks: [{ id: 'line', kind: 'speech', content: 'Hello.' }] }],
    events: [{ id: 'room', name: 'Room', type: 'normal', dialogues: [{ id: 'chat', title: 'Chat', entryBeatId: 'line', text: { format: 'plain', content: '' }, members: [{ kind: 'beat', id: 'line' }], beats: [{ id: 'line', kind: 'speech', blockRef: { scriptId: 'script', blockId: 'line' } }] }], transitions: [{ id: 'entry', from: 'boundary:room:input:entry', to: 'dialogue:room:chat' }] }],
  };
  assert.ok(exportRuntimePackage(project).pathBranching.requiredFeatures.includes('modular-authoring-v1'));
  assert.throws(() => exportRuntimePackage(project, { profile: 'legacy' }), /modular/);
  assert.deepEqual(createAuthoringSession(exportedDocument(project)), createAuthoringSession(normalizeProject(project)));
});

test('a simple event choice remains available to existing runtime profiles', () => {
  const project = {
    specVersion: '0.1', projectId: 'simple-export', canonRefs: [], scripts: [], externalFunctions: [], variables: {}, branches: [],
    sequences: [{ id: 'seq', name: 'Scene', entryEventId: 'room', eventIds: ['room', 'end'] }], entrySequenceId: 'seq',
    events: [{ id: 'room', name: 'Room', type: 'normal', decisions: [{ id: 'choose', name: 'Leave?', type: 'dialogue', outcomes: [{ id: 'leave', name: 'Leave' }] }], transitions: [{ id: 'leave-end', from: 'outcome:room:choose:leave', to: 'end' }] }, { id: 'end', name: 'End', type: 'final' }],
  };
  assert.equal(exportRuntimePackage(project).pathBranching.requiredFeatures.includes('modular-authoring-v1'), false);
  assert.equal(exportRuntimePackage(project, { profile: 'legacy' }).nodes[0].choices[0].targetNodeId, 'end');
});
