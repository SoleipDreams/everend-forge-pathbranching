import assert from 'node:assert/strict';
import { test } from 'node:test';

const base = process.env.STORY_TEST_LIB ?? '../lib';
const { StoryTestController, storyTestFieldText, storyTestSubjectValue } = await import(`${base}/storyTestController.js`);
const { normalizeProject, serializeProject } = await import(`${base}/projectSerialization.js`);
const { exportRuntimePackage } = await import(`${base}/exportRuntime.js`);

// Public synthetic acceptance content, using the same copies, branch gate and
// parameterized actions as verify-authoring-engine; no private canon is needed.
function fixture() {
  const ownedKey = {
    type: 'instanceQuery', entityId: 'key', owner: { kind: 'context', role: 'actor' }, quantifier: 'some',
    filters: { all: [
      { type: 'property', subject: { kind: 'context', role: 'self' }, propertyId: 'usable', operator: '==', value: true },
      { type: 'property', subject: { kind: 'context', role: 'self' }, propertyId: 'wear', operator: '<', value: 5 },
    ] },
  };
  const strength = value => ({ type: 'value', subject: { kind: 'variable', variableId: 'strength' }, operator: '>=', value });
  const p = {
    specVersion: '0.1', projectId: 'canvas-test', name: 'The two keys', canonRefs: [], scripts: [], externalFunctions: [], variables: {}, branches: [],
    entrySequenceId: 'seq', sequences: [{ id: 'seq', name: 'Sequence', entryEventId: 'room', eventIds: ['room', 'hall'] }],
    localExplorerEntities: [
      { id: 'key', name: 'Key', type: 'item', properties: { wear: 0, usable: true }, status: 'draft', createdAt: '', updatedAt: '' },
      { id: 'chest', name: 'Chest', type: 'container', properties: {}, status: 'draft', createdAt: '', updatedAt: '' },
      { id: 'actor', name: 'Actor', type: 'person', properties: {}, status: 'draft', createdAt: '', updatedAt: '' },
      { id: 'npc', name: 'Recipient', type: 'person', properties: {}, status: 'draft', createdAt: '', updatedAt: '' },
    ],
    localExplorerProperties: [
      { id: 'wear', label: 'Wear', valueType: 'number', createdAt: '', updatedAt: '' },
      { id: 'usable', label: 'Usable', valueType: 'boolean', createdAt: '', updatedAt: '' },
    ],
    logicPropertyOverrides: [{ source: 'local', propertyId: 'wear', conditionReadable: true, actionWritable: true }, { source: 'local', propertyId: 'usable', conditionReadable: true, actionWritable: true }],
    logicTypeOverrides: [{ source: 'local', typeId: 'item', grantable: true, runtimeRoles: ['owned'] }, { source: 'local', typeId: 'container', container: true }, { source: 'local', typeId: 'person', container: true }],
    logicVariables: [{ id: 'strength', name: 'Strength', type: 'number', value: 0, groupId: 'ungrouped' }, { id: 'visits', name: 'Visits', type: 'number', value: 0, groupId: 'ungrouped' }],
    playerProfiles: [{ id: 'default', name: 'Player', playableCharacterRef: 'actor', simulation: {} }],
    entityInstances: [
      { id: 'key-a', entityId: 'key', name: 'Worn key', properties: { wear: 8, usable: false }, owner: { kind: 'entity', entityId: 'chest' } },
      { id: 'key-b', entityId: 'key', name: 'Good key', properties: { wear: 1, usable: true }, owner: { kind: 'entity', entityId: 'chest' } },
      { id: 'travel-box', entityId: 'chest', name: 'Travel box', owner: { kind: 'entity', entityId: 'actor' } },
      { id: 'inner-box', entityId: 'chest', name: 'Inner box', owner: { kind: 'instance', instanceId: 'travel-box' } },
    ],
    scriptDocuments: [{ id: 'script', name: 'Scene', format: 'forge-script', blocks: [
      { id: 'intro', kind: 'speech', content: 'The chest has two keys.', characterRef: 'npc' },
      { id: 'reward', kind: 'speech', content: 'A new key.' },
      { id: 'shared', kind: 'direction', content: 'The paths meet.' },
      { id: 'chat', kind: 'speech', content: 'Hello, traveller.', characterRef: 'npc' },
    ] }],
    events: [{
      id: 'room', name: 'Room', type: 'normal',
      dialogues: [
        { id: 'scene', title: 'Chest scene', entryBeatId: 'intro', text: { format: 'plain', content: '' }, beats: [
          { id: 'intro', kind: 'speech', blockRef: { scriptId: 'script', blockId: 'intro' } },
          { id: 'reward', kind: 'speech', blockRef: { scriptId: 'script', blockId: 'reward' }, logic: { narrativeEffects: [{ type: 'instanceEffect', operation: 'create', entityId: 'key', properties: { wear: 0, usable: true }, owner: { kind: 'context', role: 'actor' } }] } },
          { id: 'shared', kind: 'direction', blockRef: { scriptId: 'script', blockId: 'shared' } },
        ], members: [{ kind: 'beat', id: 'intro' }, { kind: 'decision', id: 'choose' }, { kind: 'beat', id: 'reward' }, { kind: 'beat', id: 'shared' }] },
        { id: 'talk', title: 'Talk', entryBeatId: 'chat', text: { format: 'plain', content: '' }, beats: [{ id: 'chat', kind: 'speech', blockRef: { scriptId: 'script', blockId: 'chat' } }] },
      ],
      decisions: [{ id: 'choose', name: 'Open the door?', type: 'dialogue', dialogueId: 'scene', outcomes: [
        { id: 'open', name: 'Open', conditions: { all: [{ any: [ownedKey, strength(5)] }, { not: { type: 'visited', subject: { kind: 'progress', targetType: 'event', targetId: 'hall' }, operator: 'has' } }] } },
        { id: 'wait', name: 'Wait' },
      ] }],
      transitions: [
        { id: 'entry', from: 'boundary:room:input:entry', to: 'dialogue:room:scene' },
        { id: 'intro-choice', from: 'beat:room:intro', to: 'decision:room:choose' },
        { id: 'open-reward', from: 'outcome:room:choose:open', to: 'beat:room:reward' },
        { id: 'wait-shared', from: 'outcome:room:choose:wait', to: 'beat:room:shared' },
        { id: 'reward-shared', from: 'beat:room:reward', to: 'beat:room:shared' },
        { id: 'shared-choice', from: 'beat:room:shared', to: 'decision:room:choose' },
        { id: 'talk-exit', from: 'beat:room:chat', to: 'dialogue-boundary:room:talk:output' },
      ],
    }, { id: 'hall', name: 'Hall', type: 'final', text: { format: 'plain', content: 'The end.' } }],
    narrativeActions: [
      { id: 'take', name: 'Obtener', typeId: 'item', source: 'local', repeat: 'each-entry', effects: [{ type: 'instanceEffect', operation: 'move', instanceId: '@self', owner: { kind: 'context', role: 'actor' } }] },
      { id: 'give', name: 'Entregar', typeId: 'item', source: 'local', requiresTarget: true, repeat: 'each-entry', effects: [{ type: 'instanceEffect', operation: 'move', instanceId: '@self', owner: { kind: 'context', role: 'target' } }] },
      { id: 'talk', name: 'Hablar', entityId: 'npc', targetNodeId: 'dialogue:room:talk', navigation: 'call', repeat: 'each-entry' },
      { id: 'make-key', name: 'Crear copia', entityId: 'chest', effects: [{ type: 'instanceEffect', operation: 'create', entityId: 'key', name: 'Generated key', properties: { wear: 0, usable: true }, owner: { kind: 'context', role: 'actor' } }] },
      { id: 'leave', name: 'Salir', targetNodeId: 'hall', navigation: 'jump' },
    ],
    narrativeRules: [
      { id: 'key-acquired', name: 'Usable key obtained', trigger: 'stateChanged', scope: { kind: 'dialogue', id: 'scene' }, when: ownedKey, repeat: 'each-entry', effects: [{ type: 'value', subject: { kind: 'variable', variableId: 'visits' }, operation: 'add', value: 1 }], priority: 0 },
      { id: 'ready-global', name: 'Global advance', trigger: 'stateChanged', scope: { kind: 'global' }, when: strength(7), targetNodeId: 'hall', priority: 1 },
    ],
  };
  p.authoringScenarios = [
    { id: 'initial', name: 'Two keys in the chest', actor: { kind: 'entity', entityId: 'actor' }, profileId: 'default', state: { entityInstances: structuredClone(p.entityInstances), variables: { strength: 0, visits: 0 } } },
    { id: 'strong', name: 'Strength five', actor: { kind: 'entity', entityId: 'actor' }, profileId: 'default', state: { entityInstances: structuredClone(p.entityInstances), variables: { strength: 5, visits: 0 } } },
  ];
  return normalizeProject(p);
}
const subject = (kind, id) => JSON.stringify(kind === 'instance' ? { kind, instanceId: id } : { kind, entityId: id });
const snap = controller => controller.getSnapshot();
const run = (controller, command) => { controller.dispatch(command); return snap(controller); };
const request = (controller, command, commandId, overrides = {}) => {
  const s = snap(controller);
  return { version: 1, sessionId: s.sessionId, expectedSequence: s.sequence, commandId, command, ...overrides };
};

test('Play is manual, Pause freezes narrative commands, Stop discards temporary state', () => {
  const p = fixture(), c = new StoryTestController(p);
  assert.equal(snap(c).active, false);
  let s = run(c, { type: 'play' });
  assert.equal(s.active, true); assert.equal(s.paused, false); assert.equal(s.nodeId, 'beat:room:intro');
  assert.equal(s.view.text, 'The chest has two keys.');
  s = run(c, { type: 'pause' });
  const paused = structuredClone(s);
  assert.equal(c.dispatch({ type: 'continue' }), false);
  assert.equal(c.dispatch({ type: 'choose', outcomeId: 'wait' }), false);
  assert.equal(c.dispatch({ type: 'action', actionId: 'leave' }), false);
  assert.deepEqual(snap(c).state, paused.state); assert.equal(snap(c).nodeId, paused.nodeId);
  s = run(c, { type: 'play' });
  assert.equal(s.nodeId, paused.nodeId); assert.equal(s.paused, false);
  s = run(c, { type: 'continue' }); assert.equal(s.nodeId, 'decision:room:choose');
  s = run(c, { type: 'debug', open: true }); assert.equal(s.debugOpen, true);
  const previousId = s.sessionId;
  s = run(c, { type: 'stop' });
  assert.equal(s.active, false); assert.equal(s.debugOpen, false); assert.equal(s.nodeId, undefined);
  assert.deepEqual(s.trace, []); assert.deepEqual(s.visitedNodeIds, []); assert.equal(s.historyCount, 0);
  assert.notEqual(s.sessionId, previousId);
  s = run(c, { type: 'play' }); assert.equal(s.nodeId, 'beat:room:intro');
});

test('scenario and selection entry preserve engine gates and once-per-run effects', () => {
  const p = fixture(), c = new StoryTestController(p, { selectedNodeId: 'beat:room:shared' });
  run(c, { type: 'scenario', id: 'strong' });
  let s = run(c, { type: 'play' }); assert.equal(s.state.variables.strength, 5);
  s = run(c, { type: 'continue' }); assert.equal(s.view.choices.find(choice => choice.id === 'open').status, 'satisfied');
  s = run(c, { type: 'choose', outcomeId: 'open' }); assert.equal(s.nodeId, 'beat:room:reward');
  const count = s.state.entityInstances.length;
  run(c, { type: 'continue' }); run(c, { type: 'continue' });
  s = run(c, { type: 'choose', outcomeId: 'open' });
  assert.equal(s.state.entityInstances.length, count, 'Returning to a reward cannot grant the copy again.');
  s = run(c, { type: 'restart', fromSelection: true }); assert.equal(s.nodeId, 'beat:room:shared');
  assert.equal(s.state.entityInstances.length, p.entityInstances.length);
});

test('parameterized actions transfer one copy and action dialogue returns to interrupted content', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'scenario', id: 'initial' }); run(c, { type: 'play' });
  let s = run(c, { type: 'actionContext', source: subject('instance', 'key-b') });
  assert.ok(s.actions.some(action => action.id === 'take' && action.status === 'satisfied'));
  s = run(c, { type: 'action', actionId: 'take' });
  assert.equal(s.state.entityInstances.find(copy => copy.id === 'key-b').owner.entityId, 'actor');
  assert.equal(s.state.entityInstances.find(copy => copy.id === 'key-a').owner.entityId, 'chest');
  assert.equal(s.state.variables.visits, 1, 'Explicit action state changes use contextual immediate rules.');
  s = run(c, { type: 'actionContext', target: subject('entity', 'npc') });
  assert.ok(s.actions.some(action => action.id === 'give' && action.status === 'satisfied'));
  s = run(c, { type: 'action', actionId: 'give' });
  assert.equal(s.state.entityInstances.find(copy => copy.id === 'key-b').owner.entityId, 'npc');
  assert.equal(s.state.entityInstances.find(copy => copy.id === 'key-b').properties.wear, 1);
  run(c, { type: 'actionContext', source: subject('entity', 'npc'), target: '' });
  s = run(c, { type: 'action', actionId: 'talk' }); assert.equal(s.nodeId, 'beat:room:chat');
  s = run(c, { type: 'continue' }); assert.equal(s.nodeId, 'beat:room:intro');
  assert.ok(s.trace.some(entry => entry.kind === 'return'));
  s = run(c, { type: 'action', actionId: 'leave' }); assert.equal(s.nodeId, 'hall');
  s = run(c, { type: 'continue' }); assert.equal(s.status, 'ended'); assert.equal(s.active, true);
});

test('fixed revision pauses after edits; history remains inspectable and explicit restart uses new content', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); let s = run(c, { type: 'continue' });
  const originalTrace = structuredClone(s.trace), originalState = structuredClone(s.state);
  const changed = structuredClone(p); changed.scriptDocuments[0].blocks[0].content = 'Edited while testing.';
  c.updateProject(changed);
  s = snap(c); assert.equal(s.changed, true); assert.equal(s.paused, true);
  assert.deepEqual(s.trace, originalTrace); assert.deepEqual(s.state, originalState);
  assert.equal(c.dispatch({ type: 'play' }), false); assert.equal(c.dispatch({ type: 'choose', outcomeId: 'wait' }), false);
  s = run(c, { type: 'back' }); assert.equal(s.nodeId, 'beat:room:intro');
  assert.equal(s.view.text, 'The chest has two keys.'); assert.equal(s.changed, true);
  s = run(c, { type: 'restart' }); assert.equal(s.changed, false); assert.equal(s.view.text, 'Edited while testing.');
  assert.equal(s.state.entityInstances.length, p.entityInstances.length);
});

test('data schema edits pause the run and preserve its prior choice evaluation until restart', () => {
  const p = fixture();
  p.dataClasses = [{ id: 'stats', name: 'Stats', fields: [{ name: 'strength', type: 'number' }] }];
  p.projectDataObjects = [{ id: 'hero-stats', classId: 'stats', fields: { strength: 6 } }];
  p.events[0].decisions[0].outcomes[0].logic = { when: { type: 'property', subject: { kind: 'dataObject', objectId: 'hero-stats' }, propertyId: 'strength', operator: '>=', value: 5 } };
  const c = new StoryTestController(p); run(c, { type: 'play' }); run(c, { type: 'continue' });
  const before = structuredClone(snap(c));
  assert.equal(before.view.choices.find(choice => choice.id === 'open').status, 'satisfied');
  const edited = structuredClone(p); edited.dataClasses[0].fields[0].type = 'text';
  c.updateProject(edited);
  let s = snap(c); assert.equal(s.changed, true); assert.equal(s.paused, true);
  assert.deepEqual(s.state, before.state); assert.deepEqual(s.trace, before.trace);
  assert.deepEqual(s.view, before.view);
  assert.equal(c.dispatch({ type: 'choose', outcomeId: 'open' }), false);
  assert.equal(snap(c).nodeId, before.nodeId); assert.equal(snap(c).historyCount, before.historyCount);
  s = run(c, { type: 'back' }); assert.equal(s.nodeId, 'beat:room:intro'); assert.equal(s.changed, true);
  run(c, { type: 'restart' }); s = run(c, { type: 'continue' });
  assert.equal(s.changed, false); assert.equal(s.view.choices.find(choice => choice.id === 'open').status, 'invalid');
});

test('external functions, profiles, simulation, scenarios, variables and entry all invalidate the captured revision', () => {
  const changes = {
    externalFunctions: p => { p.externalFunctions = [{ name: 'gate', kind: 'condition' }]; },
    playerProfiles: p => { p.playerProfiles[0].playableCharacterRef = 'npc'; },
    playerSimulation: p => { p.playerSimulation = { variables: { strength: 9 } }; },
    activePlayerProfileId: p => { p.activePlayerProfileId = 'other-profile'; },
    authoringScenarios: p => { p.authoringScenarios[0].actor = { kind: 'entity', entityId: 'npc' }; },
    variables: p => { p.variables.legacyGate = true; },
    entrySequenceId: p => { p.entrySequenceId = 'hall-sequence'; },
  };
  for (const [name, change] of Object.entries(changes)) {
    const p = fixture();
    if (name === 'playerProfiles') delete p.authoringScenarios[0].actor;
    p.sequences.push({ id: 'hall-sequence', name: 'Other entry', entryEventId: 'hall', eventIds: ['hall'] });
    const c = new StoryTestController(p); run(c, { type: 'play' }); run(c, { type: 'continue' });
    const before = structuredClone(snap(c)); const edited = structuredClone(p); change(edited);
    c.updateProject(edited);
    let s = snap(c); assert.equal(s.changed, true, name); assert.equal(s.paused, true, name);
    assert.deepEqual(s.state, before.state, name); assert.deepEqual(s.trace, before.trace, name);
    assert.deepEqual(s.view, before.view, name);
    assert.equal(c.dispatch({ type: 'continue' }), false, name);
    assert.equal(c.dispatch({ type: 'applyRunDrafts' }), false, name);
    s = run(c, { type: 'back' }); assert.equal(s.changed, true, name); assert.equal(s.nodeId, 'beat:room:intro', name);
    s = run(c, { type: 'restart' }); assert.equal(s.changed, false, name); assert.equal(s.paused, false, name);
    assert.equal(s.nodeId, name === 'entrySequenceId' ? 'hall' : 'beat:room:intro', name);
    if (name === 'playerProfiles' || name === 'authoringScenarios') assert.deepEqual(s.state.context.actor, { kind: 'entity', entityId: 'npc' }, name);
  }
});

test('commands and debug validation use the captured document, including before an owner update notification', () => {
  const p = fixture();
  p.dataClasses = [{ id: 'stats', name: 'Stats', fields: [{ name: 'strength', type: 'number' }] }];
  p.projectDataObjects = [{ id: 'hero-stats', classId: 'stats', fields: { strength: 6 } }];
  p.events[0].decisions[0].outcomes[0].logic = { when: { type: 'property', subject: { kind: 'dataObject', objectId: 'hero-stats' }, propertyId: 'strength', operator: '>=', value: 5 } };
  const c = new StoryTestController(p); run(c, { type: 'play' }); run(c, { type: 'continue' }); run(c, { type: 'pause' });
  p.dataClasses[0].fields[0].type = 'text';
  run(c, { type: 'editDraft', key: 'run:json', value: JSON.stringify({ dataObjects: [{ id: 'hero-stats', classId: 'stats', fields: { strength: 8 } }] }) });
  assert.equal(c.dispatch({ type: 'applyRunDrafts' }), true, 'Run validation reads the captured numeric schema.');
  run(c, { type: 'play' });
  assert.equal(c.dispatch({ type: 'choose', outcomeId: 'open' }), true);
  assert.equal(snap(c).nodeId, 'beat:room:reward', 'Choice execution uses the same captured schema as its displayed evaluation.');
  c.updateProject(p);
  assert.equal(snap(c).changed, true, 'Even a same-identity update detects changes to narrative inputs.');
  assert.equal(snap(c).paused, true);
});

test('UI-only project changes preserve the session; changing or unloading the story ends it', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); const initial = snap(c);
  const ui = { ...p, canvas: { activeScope: { kind: 'event', id: 'room' }, positions: { intro: { x: 2, y: 8 } } }, panels: { canonOpen: true }, authoringPreferences: { speechBeatCounter: { enabled: true, unit: 'words', target: 42 } } };
  c.updateProject(ui, { locale: 'es', theme: 'worldnotion-dark', selectedNodeId: 'beat:room:shared' });
  let s = snap(c); assert.equal(s.changed, false); assert.equal(s.active, true); assert.equal(s.sessionId, initial.sessionId);
  assert.equal(s.locale, 'es'); assert.equal(s.theme, 'worldnotion-dark');
  c.updateProject({ ...p, projectId: 'another-story' }); s = snap(c);
  assert.equal(s.active, false); assert.equal(s.debugOpen, false); assert.deepEqual(s.trace, []);
  run(c, { type: 'play' }); c.updateProject(undefined); assert.equal(snap(c).active, false);
});

test('duplicate and concurrent remote commands cannot apply a consequence twice', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); run(c, { type: 'actionContext', source: subject('entity', 'chest') });
  const before = snap(c), create = request(c, { type: 'action', actionId: 'make-key' }, 'preview-create');
  const competing = request(c, { type: 'continue' }, 'debug-continue');
  assert.equal(c.request(create), true);
  const accepted = snap(c); assert.equal(accepted.state.entityInstances.length, before.state.entityInstances.length + 1);
  assert.equal(c.request(create), true, 'A retried command is acknowledged without reapplying it.');
  assert.equal(snap(c).sequence, accepted.sequence); assert.deepEqual(snap(c).state, accepted.state);
  assert.equal(c.request(competing), false, 'Two clients cannot both execute from the same state sequence.');
  assert.equal(snap(c).nodeId, before.nodeId);
  const oldSession = request(c, { type: 'continue' }, 'old-preview');
  run(c, { type: 'restart' });
  assert.equal(c.request(oldSession), false);
  assert.equal(c.request(request(c, { type: 'continue' }, 'wrong-version', { version: 2 })), false);
});

test('retrying a remote start or restart acknowledges the original command without restarting twice', () => {
  for (const type of ['start', 'restart']) {
    const c = new StoryTestController(fixture()); run(c, { type: 'play' }); run(c, { type: 'continue' });
    const restart = request(c, { type }, `remote-${type}`);
    assert.equal(c.request(restart), true);
    const accepted = structuredClone(snap(c));
    assert.equal(accepted.nodeId, 'beat:room:intro'); assert.equal(accepted.historyCount, 0);
    assert.equal(c.request(restart), true, 'A lost ACK can be retried with its original state sequence.');
    assert.equal(snap(c).sequence, accepted.sequence); assert.deepEqual(snap(c).state, accepted.state);
    run(c, { type: 'continue' }); const advanced = structuredClone(snap(c));
    assert.equal(c.request(restart), true);
    assert.equal(snap(c).sequence, advanced.sequence); assert.equal(snap(c).nodeId, advanced.nodeId);
    assert.deepEqual(snap(c).trace, advanced.trace);
  }
});

test('debug drafts survive closing and reopening, apply explicitly while paused and reject invalid types atomically', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); run(c, { type: 'pause' }); run(c, { type: 'debug', open: true });
  const key = snap(c).variables.find(field => field.id === 'strength').key;
  run(c, { type: 'editDraft', key, value: '7' });
  assert.equal(snap(c).state.variables.strength, 0, 'Typing never commits state or immediate rules.');
  run(c, { type: 'debug', open: false }); run(c, { type: 'debug', open: true });
  assert.equal(snap(c).drafts[key], '7');
  let s = run(c, { type: 'applyRunDrafts' });
  assert.equal(s.state.variables.strength, 7); assert.equal(s.nodeId, 'hall'); assert.equal(s.paused, true);
  const original = structuredClone(s.state);
  run(c, { type: 'editDraft', key, value: 'seven' });
  s = run(c, { type: 'applyRunDrafts' }); assert.deepEqual(s.state, original); assert.ok(s.draftErrors[key]);
  const changed = structuredClone(p); changed.events[0].name = 'Changed room'; c.updateProject(changed);
  run(c, { type: 'editDraft', key, value: '3' });
  assert.equal(c.dispatch({ type: 'applyRunDrafts' }), false); assert.deepEqual(snap(c).state, original);
  run(c, { type: 'stop' }); assert.deepEqual(snap(c).drafts, {});
});

test('draft epochs reject old remote edits after restart or discard without invalidating the other scope', () => {
  const c = new StoryTestController(fixture()); run(c, { type: 'play' });
  const key = snap(c).variables.find(field => field.id === 'strength').key;
  const initialEpochs = structuredClone(snap(c).draftEpochs);
  assert.equal(c.dispatch({ type: 'editDraft', key, value: '7', draftEpoch: initialEpochs.run }), true);
  assert.equal(c.dispatch({ type: 'editDraft', key: 'scenario:name', value: 'Unapplied name', draftEpoch: initialEpochs.scenario }), true);
  run(c, { type: 'restart' });
  let s = snap(c); assert.equal(s.draftEpochs.run, initialEpochs.run + 1);
  assert.equal(s.draftEpochs.scenario, initialEpochs.scenario); assert.equal(s.drafts[key], undefined);
  assert.equal(s.drafts['scenario:name'], 'Unapplied name');
  const beforeRejected = structuredClone(s);
  assert.equal(c.dispatch({ type: 'editDraft', key, value: '7', draftEpoch: initialEpochs.run }), false);
  assert.deepEqual(snap(c), beforeRejected, 'An obsolete edit cannot publish or resurrect discarded drafts.');
  assert.equal(c.dispatch({ type: 'editDraft', key: 'scenario:name', value: 'Still current', draftEpoch: initialEpochs.scenario }), true);
  const runEpoch = snap(c).draftEpochs.run;
  run(c, { type: 'discardDrafts', scope: 'scenario' });
  assert.equal(c.dispatch({ type: 'editDraft', key: 'scenario:name', value: 'Old name', draftEpoch: initialEpochs.scenario }), false);
  assert.equal(snap(c).drafts['scenario:name'], undefined); assert.equal(snap(c).draftEpochs.run, runEpoch);
  assert.equal(c.dispatch({ type: 'editDraft', key, value: '2', draftEpoch: runEpoch }), true);
  assert.equal(snap(c).drafts[key], '2');
  const beforeStop = structuredClone(snap(c).draftEpochs);
  s = run(c, { type: 'stop' });
  assert.equal(s.draftEpochs.run, beforeStop.run + 1); assert.equal(s.draftEpochs.scenario, beforeStop.scenario + 1);
  assert.equal(c.dispatch({ type: 'editDraft', key, value: '2', draftEpoch: beforeStop.run }), false);
  assert.deepEqual(snap(c).drafts, {});
});

test('advanced state drafts reject incompatible entity properties and states before changing the run', () => {
  for (const patch of [
    { entityStates: { key: { properties: { wear: 'worn' } } } },
    { entityStates: { actor: { states: { present: 'yes' } } } },
    { variables: { strength: 'many' } },
    { visited: [3] },
  ]) {
    const p = fixture(), c = new StoryTestController(p);
    run(c, { type: 'play' }); run(c, { type: 'pause' });
    const before = structuredClone(snap(c).state);
    run(c, { type: 'editDraft', key: 'run:json', value: JSON.stringify(patch) });
    assert.equal(c.dispatch({ type: 'applyRunDrafts' }), false, JSON.stringify(patch));
    assert.deepEqual(snap(c).state, before, 'Invalid debug state must leave the session unchanged.');
    assert.equal(snap(c).paused, true); assert.ok(snap(c).error || snap(c).draftErrors['run:json']);
  }
});

test('malformed or unresolved temporal subjects reject the whole debug change atomically', () => {
  for (const context of [
    { actor: { kind: 'entity', entityId: 'deleted-actor' } },
    { actor: { kind: 'instance', instanceId: 'deleted-copy' } },
    { actor: { kind: 'entity' } },
    { actor: { kind: 'context', role: 'unknown' } },
    { actor: { kind: 'context', role: 'actor' } },
    { self: { kind: 'unrecognized', entityId: 'actor' } },
    { target: [] },
    { target: 'actor' },
  ]) {
    const c = new StoryTestController(fixture());
    run(c, { type: 'play' }); run(c, { type: 'pause' });
    const before = structuredClone(snap(c));
    const patch = { variables: { strength: 7 }, context };
    run(c, { type: 'editDraft', key: 'run:json', value: JSON.stringify(patch) });
    assert.equal(c.dispatch({ type: 'applyRunDrafts' }), false, JSON.stringify(context));
    const after = snap(c);
    assert.deepEqual(after.state, before.state, 'A valid variable change cannot leak from an invalid subject batch.');
    assert.deepEqual(after.trace, before.trace); assert.equal(after.nodeId, before.nodeId);
    assert.equal(after.historyCount, before.historyCount); assert.equal(after.paused, true);
    assert.ok(after.error); assert.equal(after.drafts['run:json'], JSON.stringify(patch));
  }
});

test('copy values retain the inherited property type when no explicit property schema exists', () => {
  const p = fixture();
  p.localExplorerProperties = p.localExplorerProperties.filter(property => property.id !== 'wear');
  const c = new StoryTestController(p); run(c, { type: 'play' }); run(c, { type: 'pause' });
  const before = structuredClone(snap(c).state);
  const copies = structuredClone(before.entityInstances);
  copies.find(copy => copy.id === 'key-a').properties.wear = 'very worn';
  run(c, { type: 'editDraft', key: 'run:json', value: JSON.stringify({ entityInstances: copies, variables: { strength: 7 } }) });
  assert.equal(c.dispatch({ type: 'applyRunDrafts' }), false);
  assert.deepEqual(snap(c).state, before, 'Inherited types are checked before state changes and immediate rules.');
  assert.ok(snap(c).error); assert.equal(snap(c).nodeId, 'beat:room:intro');
});

test('saving and preparing a named scenario is explicit and does not rewrite the running state', () => {
  const p = fixture(), writes = [];
  const c = new StoryTestController(p, { onUpdate: changed => writes.push(changed) });
  run(c, { type: 'play' }); run(c, { type: 'pause' });
  const runKey = snap(c).variables.find(field => field.id === 'strength').key;
  run(c, { type: 'editDraft', key: runKey, value: '5' }); run(c, { type: 'applyRunDrafts' });
  assert.equal(writes.length, 0);
  let s = run(c, { type: 'createScenario', fromRun: true });
  assert.equal(writes.length, 1); assert.equal(s.scenarioState.variables.strength, 5);
  assert.equal(writes[0].authoringScenarios.length, p.authoringScenarios.length + 1);
  const scenarioKey = s.scenarioVariables.find(field => field.id === 'strength').key;
  run(c, { type: 'editDraft', key: 'scenario:name', value: 'Prepared through debug' });
  run(c, { type: 'editDraft', key: scenarioKey, value: '2' });
  assert.equal(writes.length, 1, 'Typing scenario fields remains a presentation draft.');
  run(c, { type: 'debug', open: false }); run(c, { type: 'debug', open: true });
  s = run(c, { type: 'applyScenarioDrafts' });
  assert.equal(writes.length, 2); assert.equal(s.scenario.name, 'Prepared through debug');
  assert.equal(s.scenarioState.variables.strength, 2); assert.equal(s.state.variables.strength, 5);
  assert.equal(p.authoringScenarios.length, 2, 'The editor callback receives a new immutable document.');
  s = run(c, { type: 'restart' }); assert.equal(s.state.variables.strength, 2);
});

test('saving a run uses its actual actor even after selecting another scenario for the next run', () => {
  const p = fixture(), writes = [];
  p.authoringScenarios.find(scenario => scenario.id === 'strong').actor = { kind: 'entity', entityId: 'npc' };
  const c = new StoryTestController(p, { onUpdate: project => writes.push(project) });
  run(c, { type: 'scenario', id: 'initial' }); run(c, { type: 'play' });
  const actor = structuredClone(snap(c).state.context.actor);
  run(c, { type: 'scenario', id: 'strong' });
  assert.deepEqual(snap(c).scenario.actor, { kind: 'entity', entityId: 'npc' });
  assert.deepEqual(snap(c).state.context.actor, actor);
  assert.equal(c.dispatch({ type: 'createScenario', fromRun: true }), true);
  assert.equal(writes.length, 1);
  const saved = snap(c).scenario;
  assert.deepEqual(saved.actor, actor); assert.deepEqual(saved.state.context.actor, actor);
  run(c, { type: 'restart' }); assert.deepEqual(snap(c).state.context.actor, actor);
});

test('removing a scenario actor copy is rejected without persisting a dangling reference', () => {
  const p = fixture(), writes = [];
  p.authoringScenarios[0].actor = { kind: 'instance', instanceId: 'key-a' };
  const c = new StoryTestController(p, { onUpdate: project => writes.push(project) });
  const before = structuredClone(snap(c).scenarioState);
  assert.equal(c.dispatch({ type: 'scenarioCopy', operation: 'remove', id: 'key-a' }), false);
  assert.equal(writes.length, 0); assert.deepEqual(snap(c).scenarioState, before);
  assert.deepEqual(snap(c).scenario.actor, { kind: 'instance', instanceId: 'key-a' });
  assert.ok(snap(c).error);
});

test('copy property overrides and inheritance remain drafts until explicitly applied', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); run(c, { type: 'pause' });
  const before = structuredClone(snap(c).state);
  let s = run(c, { type: 'copyProperty', scope: 'run', copyId: 'key-a', propertyId: 'wear', inherit: true });
  assert.deepEqual(s.state, before, 'Inheritance controls must not execute state changes before Apply.');
  assert.ok(Object.keys(s.drafts).some(key => key.includes('key-a') && key.includes('wear')));
  run(c, { type: 'debug', open: false }); run(c, { type: 'debug', open: true });
  s = run(c, { type: 'applyRunDrafts' });
  assert.equal(Object.hasOwn(s.state.entityInstances.find(copy => copy.id === 'key-a').properties, 'wear'), false);
  assert.equal(s.paused, true);
  const chestBefore = structuredClone(s.state.entityInstances.find(copy => copy.id === 'travel-box'));
  s = run(c, { type: 'copyProperty', scope: 'run', copyId: 'travel-box', propertyId: 'wear' });
  assert.deepEqual(s.state.entityInstances.find(copy => copy.id === 'travel-box'), chestBefore);
  assert.ok(s.copies.find(copy => copy.id === 'travel-box').properties.some(field => field.id === 'wear'), 'New property draft must be editable before it is applied.');
  s = run(c, { type: 'applyRunDrafts' });
  assert.equal(s.state.entityInstances.find(copy => copy.id === 'travel-box').properties.wear, 0);
});

test('scenario copy property additions and inheritance require Apply and validate typed drafts', () => {
  const p = fixture(), writes = [];
  const c = new StoryTestController(p, { onUpdate: project => writes.push(project) });
  const before = structuredClone(snap(c).scenarioState);
  run(c, { type: 'copyProperty', scope: 'scenario', copyId: 'key-a', propertyId: 'wear', inherit: true });
  let s = run(c, { type: 'copyProperty', scope: 'scenario', copyId: 'travel-box', propertyId: 'wear' });
  assert.equal(writes.length, 0); assert.deepEqual(s.scenarioState, before);
  const addedField = s.scenarioCopies.find(copy => copy.id === 'travel-box').properties.find(field => field.id === 'wear');
  assert.equal(addedField.type, 'number');
  run(c, { type: 'editDraft', key: addedField.key, value: 'worn' });
  run(c, { type: 'debug', open: false }); run(c, { type: 'debug', open: true });
  assert.equal(snap(c).drafts[addedField.key], 'worn');
  assert.equal(c.dispatch({ type: 'applyScenarioDrafts' }), false);
  assert.equal(writes.length, 0); assert.deepEqual(snap(c).scenarioState, before);
  assert.ok(snap(c).draftErrors[addedField.key]);
  run(c, { type: 'editDraft', key: addedField.key, value: '2' });
  assert.equal(c.dispatch({ type: 'applyScenarioDrafts' }), true);
  s = snap(c); assert.equal(writes.length, 1);
  assert.equal(Object.hasOwn(s.scenarioState.entityInstances.find(copy => copy.id === 'key-a').properties, 'wear'), false);
  assert.equal(s.scenarioState.entityInstances.find(copy => copy.id === 'travel-box').properties.wear, 2);
  assert.deepEqual(s.drafts, {});
});

test('reference selectors recognize equivalent owners and actors regardless of JSON key order', () => {
  const p = fixture();
  p.entityInstances[0].owner = { entityId: 'chest', kind: 'entity' };
  p.authoringScenarios[0].state.entityInstances[0].owner = { entityId: 'chest', kind: 'entity' };
  p.authoringScenarios[0].actor = { entityId: 'actor', kind: 'entity' };
  const c = new StoryTestController(p); run(c, { type: 'play' });
  const s = snap(c), owner = s.copies.find(copy => copy.id === 'key-a').owner;
  assert.ok(owner.options.some(option => option.value === storyTestFieldText(owner)));
  const actorValue = storyTestSubjectValue(s.scenario.actor);
  assert.ok(s.subjects.some(option => option.value === actorValue));
  assert.equal(storyTestSubjectValue({ instanceId: 'inner-box', kind: 'instance' }), storyTestSubjectValue({ kind: 'instance', instanceId: 'inner-box' }));
});

test('transport snapshots omit the project, narrative revision and engine history, and cannot mutate their owner', () => {
  const p = fixture(), c = new StoryTestController(p);
  run(c, { type: 'play' }); run(c, { type: 'continue' });
  const s = snap(c), wire = JSON.parse(JSON.stringify(s));
  assert.equal(wire.version, 1); assert.ok(wire.historyCount > 0);
  for (const key of ['project', 'revision', 'history', 'returns', 'applied', 'ruleTruth', 'session']) assert.equal(Object.hasOwn(wire, key), false, key);
  assert.equal(Object.hasOwn(wire, 'events'), false); assert.equal(Object.hasOwn(wire, 'scriptDocuments'), false);
  for (const entry of wire.trace) {
    assert.equal(Object.hasOwn(entry, 'before'), false, 'Trace transport uses readable changes rather than complete before states.');
    assert.equal(Object.hasOwn(entry, 'after'), false, 'Trace transport uses readable changes rather than complete after states.');
  }
  wire.state.entityInstances[0].properties.wear = 99; wire.trace.length = 0;
  assert.equal(snap(c).state.entityInstances[0].properties.wear, 8); assert.ok(snap(c).trace.length > 0);
});

test('a complete temporary run and presentation changes leave the narrative and runtime export unchanged', () => {
  const p = fixture(), serialized = serializeProject(p), runtime = JSON.stringify(exportRuntimePackage(p));
  let writes = 0; const c = new StoryTestController(p, { onUpdate: () => writes++ });
  run(c, { type: 'scenario', id: 'strong' }); run(c, { type: 'play' });
  run(c, { type: 'debug', open: true }); run(c, { type: 'continue' }); run(c, { type: 'choose', outcomeId: 'open' });
  run(c, { type: 'pause' }); run(c, { type: 'play' }); run(c, { type: 'back' }); run(c, { type: 'stop' });
  assert.equal(writes, 0); assert.equal(serializeProject(p), serialized); assert.equal(JSON.stringify(exportRuntimePackage(p)), runtime);
});

test('controller subscriptions deliver accepted changes and unsubscribe cleanly', () => {
  const c = new StoryTestController(fixture()); let notifications = 0;
  const unsubscribe = c.subscribe(() => notifications++);
  run(c, { type: 'play' }); run(c, { type: 'pause' }); assert.equal(notifications, 2);
  unsubscribe(); run(c, { type: 'stop' }); assert.equal(notifications, 2);
});
