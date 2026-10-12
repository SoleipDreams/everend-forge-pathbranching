import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Compiler, CompilerOptions } from 'inkjs/full';
import { modularExportDiagnostics } from '../lib/exportCompatibility.js';
import { exportInkProject } from '../lib/inkExport.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { buildExportPreview } from '../lib/exportPreview.js';
import { authoringCommand, createAuthoringSession } from '../lib/authoringEngine.js';

function fixture() {
  return {
    specVersion: '0.1', projectId: 'export-compatibility', canonRefs: [],
    scripts: [], externalFunctions: [], variables: {}, branches: [],
    sequences: [{ id: 'sequence', name: 'Story', entryEventId: 'start', eventIds: ['start', 'end'] }],
    events: [
      { id: 'start', name: 'Start', type: 'normal', text: { format: 'plain', content: 'The story begins.' }, transitions: [{ id: 'finish', from: 'start', to: 'end' }] },
      { id: 'end', name: 'End', type: 'final', text: { format: 'plain', content: 'The end.' } },
    ],
    logicVariables: [{ id: 'score', name: 'Score', type: 'number', value: 0 }],
  };
}
const setScore = { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'set', value: 3 };
const contextCondition = { type: 'property', subject: { kind: 'context', role: 'actor' }, propertyId: 'strength', operator: '>=', value: 5 };
const copyQuery = { type: 'instanceQuery', entityId: 'key', quantifier: 'some' };

const cases = [
  ['actions without dialogue', 'narrative-actions', 'take', p => { p.narrativeActions = [{ id: 'take', name: 'Take', effects: [setScore] }]; }],
  ['disabled action exceptions', 'narrative-actions', 'disabled', p => { p.narrativeActions = [{ id: 'disabled', name: 'Disabled', enabled: false, overridesActionId: 'take' }]; }],
  ['global rules without dialogue', 'narrative-rules', 'rule', p => { p.narrativeRules = [{ id: 'rule', name: 'Rule', trigger: 'stateChanged', scope: { kind: 'global' }, effects: [setScore], priority: 2 }]; }],
  ['initial individual copies', 'entity-instances', 'key-copy', p => { p.entityInstances = [{ id: 'key-copy', entityId: 'key' }]; }],
  ['explicitly disabled entity capabilities', 'entity-overrides', 'key', p => { p.entityOverrides = [{ entityId: 'key', container: false, properties: { wear: { conditionReadable: false } } }]; }],
  ['inherited container capabilities', 'container-capabilities', 'chest', p => { p.logicTypeOverrides = [{ source: 'local', typeId: 'chest', container: true }]; }],
  ['legacy property container capabilities', 'container-capabilities', 'type:chest', p => { p.logicPropertyOverrides = [{ source: 'local', propertyId: 'type:chest', container: false }]; }],
  ['zero-valued initial simulation', 'initial-state', 'playerSimulation', p => { p.playerSimulation = { variables: { score: 0 } }; }],
  ['initial player actor', 'player-profiles', 'player', p => { p.playerProfiles = [{ id: 'player', name: 'Player', playableCharacterRef: 'actor', simulation: {} }]; }],
  ['false-valued profile state', 'player-profiles', 'player', p => { p.playerProfiles = [{ id: 'player', name: 'Player', simulation: { entityStates: { key: { states: { owned: false } } } } }]; }],
  ['scenario-specific entry point', 'authoring-scenarios', 'scenario', p => { p.authoringScenarios = [{ id: 'scenario', name: 'Start at end', startNodeId: 'end' }]; }],
  ['scenario actor', 'authoring-scenarios', 'scenario', p => { p.authoringScenarios = [{ id: 'scenario', name: 'Actor', actor: { kind: 'entity', entityId: 'actor' } }]; }],
  ['scenario state', 'authoring-scenarios', 'scenario', p => { p.authoringScenarios = [{ id: 'scenario', name: 'Initial score', state: { variables: { score: 5 } } }]; }],
  ['initial simulation clearing inherited objects', 'initial-state', 'playerSimulation', p => { p.projectDataObjects = [{ id: 'stats', classId: 'class', name: 'Stats', fields: {} }]; p.playerSimulation = { dataObjects: [] }; }],
  ['profile clearing inherited objects', 'player-profiles', 'player', p => { p.projectDataObjects = [{ id: 'stats', classId: 'class', name: 'Stats', fields: {} }]; p.playerProfiles = [{ id: 'player', name: 'Player', simulation: { dataObjects: [] } }]; }],
  ['scenario clearing inherited objects', 'authoring-scenarios', 'scenario', p => { p.projectDataObjects = [{ id: 'stats', classId: 'class', name: 'Stats', fields: {} }]; p.authoringScenarios = [{ id: 'scenario', name: 'No objects', state: { dataObjects: [] } }]; }],
  ['nested child events', 'nested-event-structure', 'start', p => { p.events[0].childEventIds = ['end']; p.events[1].parentEventId = 'start'; }],
  ['native event boundary bindings', 'boundary-execution', 'start', p => { p.events[0].boundaryBindings = [{ id: 'entry', portId: 'boundary:start:input:entry', nodeId: 'decision:start:choose', direction: 'input' }]; }],
  ['boundary routes without a legacy binding', 'boundary-execution', 'start', p => { p.events[0].transitions = [{ id: 'entry', from: 'boundary:start:input:entry', to: 'end' }]; }],
  ['ordinary effects stored in narrativeEffects', 'narrative-effects', 'start.logic.narrativeEffects', p => { p.events[0].logic = { narrativeEffects: [setScore] }; }],
  ['outcome modular effects', 'narrative-effects', 'answer.logic.narrativeEffects', p => { p.events[0].decisions = [{ id: 'choice', name: 'Choice', type: 'dialogue', outcomes: [{ id: 'answer', name: 'Answer', logic: { narrativeEffects: [setScore] } }] }]; }],
  ['transition modular effects', 'narrative-effects', 'finish.logic.narrativeEffects', p => { p.events[0].transitions[0].logic = { narrativeEffects: [setScore] }; }],
  ['explicit once entry policy', 'entry-repeat', 'start.logic.repeat', p => { p.events[0].logic = { repeat: 'once', then: [setScore] }; }],
  ['explicit repeated entry policy', 'entry-repeat', 'start.logic.repeat', p => { p.events[0].logic = { repeat: 'each-entry', then: [setScore] }; }],
  ['sequence entry policy', 'entry-repeat', 'sequence.logic.repeat', p => { p.sequences[0].logic = { repeat: 'once', then: [setScore] }; }],
  ['branch entry policy', 'entry-repeat', 'branch.logic.repeat', p => { p.branches = [{ id: 'branch', title: 'Branch', eventIds: ['start'], logic: { repeat: 'each-entry' } }]; }],
  ['explicit effect order', 'effect-order', 'start.logic.effectOrder', p => { p.events[0].logic = { then: [setScore], effectOrder: ['then'] }; }],
  ['copy query inside a nested condition', 'instance-query', 'start', p => { p.events[0].logic = { when: { all: [{ not: { any: [copyQuery] } }] } }; }],
  ['concrete copy condition subject', 'instance-subject', 'finish', p => { p.events[0].transitions[0].conditions = { type: 'state', subject: { kind: 'instance', instanceId: 'key-copy' }, stateId: 'exists', operator: 'has' }; }],
  ['actor subject inside an effect guard', 'context-subject', 'start', p => { p.events[0].logic = { then: [{ ...setScore, conditions: { not: contextCondition } }] }; }],
  ['copy effects inside a nested logic rule', 'instance-effect', 'nested', p => { p.events[0].logic = { rules: [{ id: 'nested', when: [], then: [{ type: 'instanceEffect', operation: 'create', entityId: 'key' }] }] }; }],
  ['copy query inside a global rule', 'instance-query', 'rule', p => { p.narrativeRules = [{ id: 'rule', name: 'Rule', trigger: 'continue', scope: { kind: 'global' }, when: { not: copyQuery } }]; }],
  ['implicit once effects in an event cycle', 'cyclic-once-effects', 'start', p => { p.events[0].logic = { then: [setScore] }; p.events[1].transitions = [{ id: 'back', from: 'end', to: 'start' }]; }],
  ['implicit once route effects in a cycle', 'cyclic-once-effects', 'finish', p => { p.events[0].transitions[0].logic = { then: [setScore] }; p.events[1].transitions = [{ id: 'back', from: 'end', to: 'start' }]; }],
  ['implicit once answer effects in a cycle', 'cyclic-once-effects', 'again', p => { p.events[0].transitions = [{ id: 'again-route', from: 'outcome:start:choose:again', to: 'start' }]; p.events[0].decisions = [{ id: 'choose', name: 'Choose', type: 'dialogue', outcomes: [{ id: 'again', name: 'Again', consequences: [setScore] }] }]; }],
];

for (const [name, feature, location, change] of cases) test(`Ink and Legacy reject ${name} instead of dropping execution`, () => {
  const project = fixture(); change(project);
  const before = JSON.stringify(project);
  const diagnostics = modularExportDiagnostics(project);
  assert.ok(diagnostics.some(d => d.feature === feature && d.location === location), JSON.stringify(diagnostics));
  const exported = exportInkProject(project);
  assert.deepEqual(exported.files, []);
  assert.ok(exported.diagnostics.some(d => d.feature === feature && d.location === location));
  assert.throws(() => buildExportPreview(project, 'ink'), /Enhanced runtime/);
  assert.throws(() => exportRuntimePackage(project, { profile: 'legacy' }), /Legacy|Enhanced/);
  assert.equal(JSON.stringify(project), before, 'Compatibility checks must not alter the narrative document');
});

test('empty normalization fields and presentation metadata keep the original Ink profile executable', () => {
  const project = normalizeProject({
    ...fixture(), narrativeActions: [], narrativeRules: [], entityInstances: [], entityOverrides: [],
    playerProfiles: [{ id: 'default', name: 'Default', simulation: {} }], activePlayerProfileId: 'default',
    playerSimulation: {}, authoringScenarios: [{ id: 'empty', name: 'Empty', state: {} }],
    canvas: { activeSequenceId: 'sequence' }, panels: { storiesOpen: true },
  });
  // An arbitrary variable value or story description is data, never a predicate.
  project.variables.notes = { type: 'instanceQuery', subject: { kind: 'context' } };
  project.events[0].description = 'narrativeActions and logic.repeat are discussed here.';
  assert.deepEqual(modularExportDiagnostics(project), []);
  assert.doesNotThrow(() => exportRuntimePackage(project, { profile: 'legacy' }));
  const exported = exportInkProject(project);
  assert.deepEqual(exported.diagnostics, []);
  assert.equal(exported.files.length, 1);
  const messages = [];
  const story = new Compiler(exported.files[0].content, new CompilerOptions(null, [], false, (message, type) => messages.push({ message, type }))).Compile();
  assert.equal(messages.filter(m => m.type === 2).length, 0, JSON.stringify(messages));
  let output = '', steps = 0;
  while (story.canContinue) { assert.ok(++steps < 20); output += story.Continue(); }
  assert.match(output, /The story begins\./);
  assert.match(output, /The end\./);
});

test('logic scanning reaches nested dialogue beats and data object guards without scanning property values', () => {
  const project = fixture();
  project.events[0].dialogues = [{ id: 'dialogue', title: 'Dialogue', text: { format: 'plain', content: '' }, beats: [{ id: 'line', kind: 'speech', blockRef: { scriptId: 'script', blockId: 'block' }, logic: { narrativeEffects: [setScore] } }] }];
  project.projectDataObjects = [{ id: 'object', classId: 'class', name: 'Object', fields: { arbitrary: { type: 'instanceQuery' } }, logic: { when: { not: contextCondition } } }];
  const diagnostics = modularExportDiagnostics(project);
  assert.ok(diagnostics.some(d => d.location === 'line.logic.narrativeEffects' && d.feature === 'narrative-effects'));
  assert.ok(diagnostics.some(d => d.location === 'object' && d.feature === 'context-subject'));
  assert.equal(diagnostics.some(d => d.feature === 'instance-query'), false);
});

test('a manual loop keeps implicit entry effects once; Ink refuses the formerly repeated count', () => {
  const project = fixture();
  project.events[0].logic = { then: [{ ...setScore, operation: 'add', value: 1 }] };
  project.events[0].transitions = [{ id: 'again', from: 'outcome:start:choose:again', to: 'start' }, { id: 'done', from: 'outcome:start:choose:done', to: 'end' }];
  project.events[0].decisions = [{ id: 'choose', name: 'Choose', type: 'dialogue', outcomes: [{ id: 'again', name: 'Again' }, { id: 'done', name: 'Done' }] }];
  let run = createAuthoringSession(project);
  assert.equal(run.state.variables.score, 1);
  run = authoringCommand(project, run, { type: 'continue' });
  run = authoringCommand(project, run, { type: 'choose', outcomeId: 'again' });
  assert.equal(run.nodeId, 'start');
  assert.equal(run.state.variables.score, 1, 'Returning to the event must not increment to the old Ink result of 2');
  assert.deepEqual(exportInkProject(project).files, []);
  assert.ok(modularExportDiagnostics(project).some(d => d.feature === 'cyclic-once-effects' && d.location === 'start'));
});

test('acyclic ordinary effects still compile and execute in Ink', () => {
  const project = fixture();
  project.events[0].logic = { then: [setScore] };
  assert.deepEqual(modularExportDiagnostics(project), []);
  const exported = exportInkProject(project);
  assert.deepEqual(exported.diagnostics, []);
  const story = new Compiler(exported.files[0].content).Compile();
  let steps = 0;
  while (story.canContinue) { assert.ok(++steps < 20); story.Continue(); }
  assert.equal(createAuthoringSession(project).state.variables.score, 3);
  assert.equal(Object.entries(exported.symbols).filter(([key]) => key.includes('score')).length, 1);
  const symbol = Object.entries(exported.symbols).find(([key]) => key.includes('score'))[1];
  assert.equal(story.variablesState.$(symbol), 3);
});

test('effects on an acyclic exit of a looping event do not require once guards', () => {
  const project = fixture();
  project.events[0].transitions = [{ id: 'again', from: 'outcome:start:choose:again', to: 'start' }, { id: 'done', from: 'outcome:start:choose:done', to: 'end', consequences: [setScore] }];
  project.events[0].decisions = [{ id: 'choose', name: 'Choose', type: 'dialogue', outcomes: [{ id: 'again', name: 'Again' }, { id: 'done', name: 'Done', consequences: [setScore] }] }];
  assert.deepEqual(modularExportDiagnostics(project), []);
  assert.equal(exportInkProject(project).files.length, 1);
});

test('an explicit empty object overlay changes existence routing and must not be lost in Ink', () => {
  const exists = { type: 'state', subject: { kind: 'dataObject', objectId: 'stats' }, stateId: 'exists', operator: 'has' };
  for (const source of ['simulation', 'profile', 'scenario']) {
    const project = fixture();
    project.projectDataObjects = [{ id: 'stats', classId: 'class', name: 'Stats', fields: { score: 1 } }];
    project.events.push({ id: 'absent', name: 'Absent', type: 'final', text: { format: 'plain', content: 'Object absent.' } });
    project.sequences[0].eventIds.push('absent');
    project.events[0].transitions = [{ id: 'exists', from: 'start', to: 'end', conditions: exists }, { id: 'missing', from: 'start', to: 'absent', mode: 'fallback' }];
    if (source === 'simulation') project.playerSimulation = { dataObjects: [] };
    if (source === 'profile') project.playerProfiles = [{ id: 'player', name: 'Player', simulation: { dataObjects: [] } }];
    if (source === 'scenario') project.authoringScenarios = [{ id: 'empty', name: 'Empty objects', state: { dataObjects: [] } }];
    const run = authoringCommand(project, createAuthoringSession(project, project.authoringScenarios?.[0]), { type: 'continue' });
    assert.equal(run.nodeId, 'absent', source);
    assert.deepEqual(exportInkProject(project).files, [], source);
    assert.ok(modularExportDiagnostics(project).length > 0, source);
  }
});

test('nested text events retain their authored continuation rather than ending Ink at the parent', () => {
  const project = fixture();
  project.events[0].transitions = [];
  project.events[0].childEventIds = ['end']; project.events[1].parentEventId = 'start';
  const run = authoringCommand(project, createAuthoringSession(project), { type: 'continue' });
  assert.equal(run.nodeId, 'end');
  assert.equal(run.view.text, 'The end.');
  assert.deepEqual(exportInkProject(project).files, []);
  assert.ok(modularExportDiagnostics(project).some(d => d.feature === 'nested-event-structure'));
});

test('a boundary-selected decision cannot become two unrelated Ink choices', () => {
  const project = fixture();
  project.events[0].decisions = [
    { id: 'selected', name: 'Selected', type: 'dialogue', outcomes: [{ id: 'answer-a', name: 'Selected answer' }] },
    { id: 'other', name: 'Other', type: 'dialogue', outcomes: [{ id: 'answer-b', name: 'Unrelated answer' }] },
  ];
  project.events[0].boundaryBindings = [{ id: 'entry', portId: 'boundary:start:input:entry', nodeId: 'decision:start:selected', direction: 'input' }];
  project.events[0].transitions = [
    { id: 'entry', from: 'boundary:start:input:entry', to: 'decision:start:selected' },
    { id: 'selected-end', from: 'outcome:start:selected:answer-a', to: 'end' },
    { id: 'other-end', from: 'outcome:start:other:answer-b', to: 'end' },
  ];
  const run = authoringCommand(project, createAuthoringSession(project), { type: 'continue' });
  assert.deepEqual(run.view.choices.map(choice => choice.id), ['answer-a']);
  assert.deepEqual(exportInkProject(project).files, []);
  assert.ok(modularExportDiagnostics(project).some(d => d.feature === 'boundary-execution' && d.location === 'start'));
});
