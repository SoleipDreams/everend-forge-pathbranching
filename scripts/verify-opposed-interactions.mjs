import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const core = process.env.OPPOSED_INTERACTIONS_CORE
  ? pathToFileURL(`${resolve(process.env.OPPOSED_INTERACTIONS_CORE)}/`).href
  : new URL('../lib/', import.meta.url).href;
const { resolveInteraction, freezeInteractionParticipants, interactionDefinitionIssues, hasInteractions, hasOpposedInteractions } = await import(new URL('interactions.js', core));
const { createAuthoringSession, authoringCommand } = await import(new URL('authoringEngine.js', core));
const { validateInteractions } = await import(new URL('interactionValidation.js', core));
const { exportRuntimePackage } = await import(new URL('exportRuntime.js', core));
const { modularExportDiagnostics } = await import(new URL('exportCompatibility.js', core));
const { evaluateConditionDetailed } = await import(new URL('conditionEvaluation.js', core));
const { validateProject } = await import(new URL('validate.js', core));
const { mergeInteractionCreation } = await import(new URL('interactionCreation.js', core));
const { createInteractionFromPreset } = await import(new URL('interactionLibrary.js', core));
const { updateOutcome } = await import(new URL('projectMutations.js', core));

function fixture(moment = 'before', aggregation = 'all') {
  const participant = (id, entityId, variableId) => ({ id, subject: { kind: 'entity', entityId }, skill: { kind: 'variable', variableId }, dice: { count: 1, sides: 20 }, modifier: 0 });
  const definition = {
    id: 'contest', name: 'Frente a los guardias',
    mechanic: { kind: 'opposedcheck', actor: participant('actor', 'ridina', 'actor-skill'), rivals: [participant('rival-a', 'guard-a', 'rival-a-skill'), participant('rival-b', 'guard-b', 'rival-b-skill')], aggregation },
    results: ['success', 'failure', 'tie'].map(key => ({ id: `contest:${key}`, name: key, key, effects: [{ type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'add', value: 1 }] })),
  };
  return {
    specVersion: '0.1', projectId: 'opposed-regression', entrySequenceId: 'main',
    canonRefs: ['ridina', 'guard-a', 'guard-b'].map(id => ({ id, label: id, kind: 'character' })),
    sequences: [{ id: 'main', name: 'Main', entryEventId: 'event', eventIds: ['event'] }], branches: [], scripts: [], externalFunctions: [], variables: {},
    logicVariables: ['actor-skill', 'rival-a-skill', 'rival-b-skill', 'score'].map(id => ({ id, name: id, type: 'number', value: 0, groupId: 'default' })),
    playerSimulation: { context: { actor: { kind: 'entity', entityId: 'ridina' } } },
    scriptDocuments: [{ id: 'script', name: 'Script', blocks: ['a', 'b'].map(id => ({ id, kind: 'speech', content: id })) }],
    events: [{ id: 'event', name: 'Scene', type: 'normal', dialogueBeats: ['a', 'b'].map(id => ({ id, kind: 'speech', blockRef: { scriptId: 'script', blockId: id } })), interactionDefinitions: [definition],
      interactionUses: [{ id: 'use', definitionId: 'contest', ownerNodeId: 'beat:event:a', moment }],
      interactionBarriers: moment === 'during' ? [{ id: 'wait', name: 'Wait', useIds: ['use'] }] : [],
      transitions: [{ id: 'entry', from: 'boundary:event:input:entry', to: 'beat:event:a' }, { id: 'next', from: 'beat:event:a', to: moment === 'during' ? 'barrier:event:wait' : 'beat:event:b' }, ...(moment === 'during' ? [{ id: 'wait-next', from: 'barrier:event:wait', to: 'beat:event:b' }] : [])] }],
  };
}

function rolls(values) {
  let calls = 0;
  return { random: () => { const value = values[calls++]; assert.notEqual(value, undefined, 'Unexpected extra die roll'); return (value - 0.5) / 20; }, now: () => 1000, count: () => calls };
}

test('one actor roll is reused against independent rivals and individual outcomes remain available', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0], environment = rolls([10, 5, 15]);
  assert.deepEqual(interactionDefinitionIssues(definition), []);
  const result = resolveInteraction(project, {}, definition, {}, environment);
  assert.equal(environment.count(), 3);
  assert.equal(result.result.key, 'failure');
  assert.equal(result.participantResults['rival-a'].resultId, 'contest:success');
  assert.equal(result.participantResults['rival-b'].resultId, 'contest:failure');
  assert.equal(result.participantResults.actor, undefined);
  assert.deepEqual(result.participantTraces.map(trace => trace.total), [10, 5, 15]);
  assert.deepEqual(result.rolls, [10]);
});

test('all and any aggregate success, defeat and genuine ties deterministically', () => {
  for (const [aggregation, totals, expected] of [
    ['all', [10, 5, 15], 'failure'], ['any', [10, 5, 15], 'success'],
    ['all', [10, 5, 10], 'tie'], ['any', [10, 10, 15], 'tie'],
    ['all', [20, 1, 5], 'success'], ['any', [1, 5, 20], 'failure'],
  ]) {
    const project = fixture('before', aggregation);
    const result = resolveInteraction(project, {}, project.events[0].interactionDefinitions[0], {}, rolls(totals));
    assert.equal(result.result.key, expected);
  }
});

test('identical subjects, duplicate participant IDs, missing rivals and malformed dice are invalid', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0];
  const duplicate = structuredClone(definition);
  duplicate.mechanic.rivals[0].subject = { ...duplicate.mechanic.actor.subject };
  assert.ok(interactionDefinitionIssues(duplicate).some(message => message.includes('oppose itself')));
  assert.throws(() => resolveInteraction(project, {}, duplicate, {}, rolls([])), /oppose itself/);
  duplicate.mechanic.rivals[0] = { ...definition.mechanic.rivals[0], id: 'actor' };
  assert.ok(interactionDefinitionIssues(duplicate).some(message => message.includes('unique stable IDs')));
  assert.ok(interactionDefinitionIssues({ ...definition, mechanic: { ...definition.mechanic, rivals: [] } }).some(message => message.includes('at least one rival')));
  duplicate.mechanic.rivals[0] = { ...definition.mechanic.rivals[0], dice: { count: 1, sides: 1 } };
  assert.ok(interactionDefinitionIssues(duplicate).some(message => message.includes('Dice require')));
  const contextual = structuredClone(definition);
  contextual.mechanic.actor.subject = { kind: 'context', role: 'actor' };
  assert.throws(() => freezeInteractionParticipants(project, { context: { actor: { kind: 'entity', entityId: 'guard-a' } } }, contextual), /oppose itself/);
  contextual.mechanic.rivals[0].subject = { kind: 'entity', entityId: 'deleted' };
  delete contextual.mechanic.rivals[0].skill;
  project.events[0].interactionDefinitions = [contextual];
  delete project.playerSimulation.context.actor;
  assert.ok(validateInteractions(project).some(finding => finding.message.includes('Missing entity deleted')));
});

test('execution freezes character identity, numeric skill, dice and modifiers before resolving', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0];
  definition.mechanic.actor.subject = { kind: 'context', role: 'actor' };
  const environment = rolls([10, 5, 15]);
  let session = createAuthoringSession(project, undefined, undefined, environment);
  assert.equal(session.view.waiting, true);
  assert.equal(session.interactions[0].participantTraces[0].subject.entityId, 'ridina');
  assert.equal(environment.count(), 0, 'Starting freezes input but does not roll.');
  session = authoringCommand(project, session, { type: 'setState', state: { variables: { ...session.state.variables, 'actor-skill': 100 }, context: { actor: { kind: 'entity', entityId: 'guard-a' } } } }, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
  const result = session.state.interactionResults.use;
  assert.equal(result.total, 10);
  assert.equal(result.participantTraces[0].skillValue, 0);
  assert.equal(result.participantTraces[0].subject.entityId, 'ridina');
  assert.equal(result.resultId, 'contest:failure');
  assert.equal(session.state.variables.score, 1);
});

test('back, replay, and repeated resolve retain every roll and apply aggregate consequences once', () => {
  const project = fixture(), environment = rolls([10, 5, 15]);
  let session = createAuthoringSession(project, undefined, undefined, environment);
  const executionId = session.interactions[0].id;
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  const original = structuredClone(session.state.interactionResults.use);
  assert.equal(session.state.variables.score, 1);
  const traceCount = session.trace.length;
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.state.variables.score, 1);
  assert.equal(session.trace.length, traceCount);
  // The duplicate command adds a history snapshot, so undo it before undoing resolution.
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  assert.equal(session.view.waiting, true);
  assert.equal(session.state.variables.score, 0);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.deepEqual(session.state.interactionResults.use, original);
  assert.equal(environment.count(), 3);
  assert.equal(session.state.variables.score, 1);
  assert.equal(session.trace.filter(trace => trace.message.startsWith('Participant ')).length, 3);
});

test('aggregate consequences can inspect fresh rival outcomes and execute once through replay', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0], environment = rolls([10, 5, 15]);
  const guarded = (participantId, value) => ({ type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'add', value,
    conditions: { type: 'interactionResult', useId: 'use', participantId, resultId: 'contest:success', operator: '==' } });
  definition.results.find(result => result.key === 'failure').effects.push(guarded('rival-a', 2), guarded('rival-b', 100));
  let session = createAuthoringSession(project, undefined, undefined, environment);
  const executionId = session.interactions[0].id;
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.status, 'ready');
  assert.equal(session.state.variables.score, 3, 'Apply the aggregate change and winning-rival change only.');
  const completed = structuredClone(session.state.interactionResults.use);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.state.variables.score, 3);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  assert.equal(session.state.variables.score, 0);
  assert.equal(session.state.interactionResults?.use, undefined);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.state.variables.score, 3);
  assert.deepEqual(session.state.interactionResults.use, completed);
  assert.equal(environment.count(), 3);
  assert.equal(session.applied.filter(key => key === `interaction:${executionId}`).length, 1);
});

test('Back followed by another branch never reuses rolls belonging to a different interaction use', () => {
  const project=fixture(),event=project.events[0],environment=rolls([10,5,15,18,10,5]);
  event.decisions=[{id:'d',name:'Decisiones',type:'dialogue',outcomes:[{id:'a',name:'A'},{id:'b',name:'B'}]}];
  event.interactionUses=[{id:'use-a',definitionId:'contest',ownerNodeId:'beat:event:a',moment:'before'},{id:'use-b',definitionId:'contest',ownerNodeId:'beat:event:b',moment:'before'}];
  event.transitions=[{id:'entry',from:'boundary:event:input:entry',to:'decision:event:d'},{id:'a',from:'outcome:event:d:a',to:'beat:event:a'},{id:'b',from:'outcome:event:d:b',to:'beat:event:b'}];
  let session=createAuthoringSession(project,undefined,undefined,environment);
  session=authoringCommand(project,session,{type:'choose',outcomeId:'a'},environment);
  session=authoringCommand(project,session,{type:'resolveInteraction',executionId:session.interactions[0].id},environment);
  assert.equal(session.state.interactionResults['use-a'].total,10);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'choose',outcomeId:'b'},environment);
  assert.equal(session.interactions[0].id,'execution:1','Both branches reuse the public serial after Back.');
  session=authoringCommand(project,session,{type:'resolveInteraction',executionId:session.interactions[0].id},environment);
  assert.equal(session.state.interactionResults['use-b'].total,18);
  assert.equal(environment.count(),6);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'choose',outcomeId:'a'},environment);
  session=authoringCommand(project,session,{type:'resolveInteraction',executionId:session.interactions[0].id},environment);
  assert.equal(session.state.interactionResults['use-a'].total,10);
  assert.equal(environment.count(),6,'Returning to the original execution replays its original rolls.');
});

test('the same use reached again after Back distinguishes a different resolved actor', () => {
  const project=fixture(),event=project.events[0],environment=rolls([10,5,15,18,10,5]);
  project.canonRefs.push({id:'other-actor',kind:'character',label:'Otra persona'});
  event.interactionDefinitions[0].mechanic.actor.subject={kind:'context',role:'actor'};
  event.decisions=[{id:'d',name:'Decisiones',type:'dialogue',outcomes:[{id:'a',name:'A'}]}];
  event.transitions=[{id:'entry',from:'boundary:event:input:entry',to:'decision:event:d'},{id:'a',from:'outcome:event:d:a',to:'beat:event:a'}];
  let session=createAuthoringSession(project,undefined,undefined,environment);
  session=authoringCommand(project,session,{type:'choose',outcomeId:'a'},environment);
  session=authoringCommand(project,session,{type:'resolveInteraction',executionId:session.interactions[0].id},environment);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'back'},environment);
  session=authoringCommand(project,session,{type:'setState',state:{context:{...session.state.context,actor:{kind:'entity',entityId:'other-actor'}}}},environment);
  session=authoringCommand(project,session,{type:'choose',outcomeId:'a'},environment);
  session=authoringCommand(project,session,{type:'resolveInteraction',executionId:session.interactions[0].id},environment);
  assert.equal(session.state.interactionResults.use.participantTraces[0].subject.entityId,'other-actor');
  assert.equal(session.state.interactionResults.use.total,18);
  assert.equal(environment.count(),6);
});

test('failed result consequences roll back provisional outcomes and partial changes while caching all rolls', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0], environment = rolls([10, 5, 15]);
  project.canonPropertyDescriptors = [{ id: 'strength', label: 'Fuerza', valueType: 'number', path: ['stats', 'strength'], appliesToTypes: ['character'] }];
  project.logicPropertyOverrides = [{ source: 'canon', propertyId: 'strength', conditionReadable: true, actionWritable: true }];
  project.canonRefs[0].frontmatter = { stats: { strength: 4 }, variants: { adult: { label: 'Adulta', overrides: { stats: { strength: 12 } } } } };
  project.canonRefs[1].frontmatter = { stats: { strength: 8 } };
  project.entityInstances = [{ id: 'guard-copy', entityId: 'guard-a', properties: { strength: 7 } }];
  project.playerSimulation.entityVariantStates = { ridina: { adult: { properties: { strength: 11 } } } };
  definition.results.find(result => result.key === 'failure').effects.push(
    { type: 'property', subject: { kind: 'entity', entityId: 'ridina', variantId: 'adult' }, propertyId: 'strength', operation: 'subtract', value: 3 },
    { type: 'property', subject: { kind: 'instance', instanceId: 'guard-copy' }, propertyId: 'strength', operation: 'subtract', value: 2 },
  );
  definition.results.find(result => result.key === 'failure').effects.push({ type: 'value', subject: { kind: 'variable', variableId: 'missing' }, operation: 'add', value: 5,
    conditions: { type: 'interactionResult', useId: 'use', participantId: 'rival-a', resultId: 'contest:success', operator: '==' } });
  let session = createAuthoringSession(project, undefined, undefined, environment);
  const executionId = session.interactions[0].id, before = structuredClone(session.state);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.status, 'blocked');
  assert.match(session.message, /Missing variable missing/);
  assert.deepEqual(session.state, before, 'Neither partial effects nor the provisional result can leak.');
  assert.equal(session.state.entityVariantStates.ridina.adult.properties.strength, 11);
  assert.equal(session.state.entityInstances.find(instance => instance.id === 'guard-copy').properties.strength, 7);
  assert.equal(session.interactions[0].status, 'pending');
  assert.ok(!session.applied.includes(`interaction:${executionId}`));
  assert.equal(session.interactionResolutions[session.interactions[0].cacheKey].participantResults['rival-a'].resultId, 'contest:success');
  assert.equal(session.interactionResolutions[session.interactions[0].cacheKey].participantTraces.length, 3);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.status, 'blocked');
  assert.deepEqual(session.state, before);
  assert.equal(environment.count(), 3, 'Retry uses the cached actor and rival rolls.');
});

test('copy consequences honor individual rival conditions and remain atomic and idempotent', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0], environment = rolls([10, 5, 15]);
  const guardedCopy = (participantId, instanceId) => ({ type: 'instanceEffect', operation: 'create', entityId: 'guard-a', instanceId,
    conditions: { type: 'interactionResult', useId: 'use', participantId, resultId: 'contest:success', operator: '==' } });
  definition.results.find(result => result.key === 'failure').effects.push(guardedCopy('rival-a', 'captured-a'), guardedCopy('rival-b', 'captured-b'));
  let session = createAuthoringSession(project, undefined, undefined, environment);
  const executionId = session.interactions[0].id;
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.equal(session.status, 'ready');
  assert.deepEqual(session.state.entityInstances.map(instance => instance.id), ['captured-a']);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.deepEqual(session.state.entityInstances.map(instance => instance.id), ['captured-a']);
  assert.equal(environment.count(), 3);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId }, environment);
  assert.deepEqual(session.state.entityInstances.map(instance => instance.id), ['captured-a']);
  assert.equal(environment.count(), 3);
  const invalidProject = fixture(), invalidDefinition = invalidProject.events[0].interactionDefinitions[0];
  invalidDefinition.results.find(result => result.key === 'failure').effects.push(guardedCopy('absent', 'never-created'));
  let invalid = createAuthoringSession(invalidProject, undefined, undefined, rolls([]));
  const invalidBefore = structuredClone(invalid.state);
  invalid = authoringCommand(invalidProject, invalid, { type: 'resolveInteraction', executionId: invalid.interactions[0].id }, rolls([10, 5, 15]));
  assert.equal(invalid.status, 'blocked');
  assert.deepEqual(invalid.state, invalidBefore);
});

test('during waits at its barrier until the whole contest resolves, while after waits on exit', () => {
  for (const moment of ['during', 'after']) {
    const project = fixture(moment), environment = rolls([10, 5, 15]);
    let session = createAuthoringSession(project, undefined, undefined, environment);
    assert.equal(session.view.waiting, false);
    session = authoringCommand(project, session, { type: 'continue' }, environment);
    assert.equal(session.view.waiting, true);
    if (moment === 'during') assert.equal(session.nodeId, 'barrier:event:wait');
    session = authoringCommand(project, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
    assert.equal(session.nodeId, 'beat:event:b');
    assert.equal(session.view.waiting, false);
    assert.equal(session.state.variables.score, 1);
  }
});

test('participant skills require finite numbers and invalid source identities block without rolling', () => {
  const project = fixture();
  project.logicVariables[0].type = 'text'; project.logicVariables[0].value = 'invalid';
  const environment = rolls([]);
  assert.ok(validateInteractions(project).some(finding => finding.message.includes('finite number')));
  const session = createAuthoringSession(project, undefined, undefined, environment);
  assert.equal(session.status, 'blocked');
  assert.equal(environment.count(), 0);
});

test('only actual opposed uses require runtime capability and exported snapshots contain no execution rolls', () => {
  const project = fixture();
  assert.equal(hasInteractions(project), true);
  assert.equal(hasOpposedInteractions(project), true);
  const exported = exportRuntimePackage(project, { profile: 'enhanced' });
  assert.ok(exported.pathBranching.requiredFeatures.includes('opposed-interactions-v1'));
  assert.deepEqual(exported.pathBranching.events[0].interactionDefinitions, project.events[0].interactionDefinitions);
  project.events[0].interactionUses = [];
  assert.equal(hasInteractions(project), false);
  assert.equal(hasOpposedInteractions(project), false);
  assert.ok(!modularExportDiagnostics(project).some(diagnostic => diagnostic.feature === 'interactions-v1' || diagnostic.feature === 'opposed-interactions-v1'));
  assert.ok(!exportRuntimePackage(project, { profile: 'enhanced' }).pathBranching.requiredFeatures.includes('opposed-interactions-v1'));
});

test('conditions select aggregate or per-rival outcomes and reject the actor or missing rival', () => {
  const project = fixture(), environment = rolls([10, 5, 15]);
  let session = createAuthoringSession(project, undefined, undefined, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
  const condition = { type: 'interactionResult', useId: 'use', resultId: 'contest:success', operator: '==' };
  assert.equal(evaluateConditionDetailed(condition, project, session.state).status, 'unsatisfied');
  assert.equal(evaluateConditionDetailed({ ...condition, participantId: 'rival-a' }, project, session.state).status, 'satisfied');
  assert.equal(evaluateConditionDetailed({ ...condition, participantId: 'rival-b' }, project, session.state).status, 'unsatisfied');
  assert.equal(evaluateConditionDetailed({ ...condition, participantId: 'actor' }, project, session.state).status, 'invalid');
  assert.equal(evaluateConditionDetailed({ ...condition, participantId: 'absent' }, project, session.state).status, 'invalid');
  assert.equal(evaluateConditionDetailed({ ...condition, participantId: 'absent' }, project, {}).status, 'invalid');
  project.events[0].transitions[1].conditions = { ...condition, participantId: 'actor' };
  assert.ok(validateProject(project).some(finding => finding.code === 'invalid_condition' && finding.message.includes('invalid interaction result')));
});

test('canonical nested attributes, non-base variants and concrete copies freeze through the shared resolver', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0];
  project.canonPropertyDescriptors = [{ id: 'strength', label: 'Fuerza', valueType: 'number', path: ['stats', 'strength'], groupPath: ['Estadísticas'], appliesToTypes: ['character'] }];
  project.canonRefs[0].frontmatter = { stats: { strength: 4 }, variants: { adult: { label: 'Adulta', overrides: { stats: { strength: 12 } } } } };
  project.canonRefs[1].frontmatter = { stats: { strength: 8 } };
  project.canonRefs[2].frontmatter = { stats: { strength: 9 } };
  project.entityInstances = [{ id: 'guard-copy', entityId: 'guard-a', properties: { strength: 7 } }];
  definition.mechanic.actor.subject = { kind: 'entity', entityId: 'ridina', variantId: 'adult' };
  definition.mechanic.rivals[0].subject = { kind: 'instance', instanceId: 'guard-copy' };
  for (const participant of [definition.mechanic.actor, ...definition.mechanic.rivals]) {
    participant.skill = { kind: 'property', subject: participant.subject, propertyId: 'strength' };
    delete participant.dice;
  }
  definition.mechanic.commonDice = { count: 1, sides: 2 };
  const state = { entityStates: { ridina: { properties: { strength: 99 } } }, entityVariantStates: { ridina: { adult: { properties: { strength: 11 } } } } };
  const frozen = freezeInteractionParticipants(project, state, definition);
  assert.deepEqual(frozen.map(trace => trace.skillValue), [11, 7, 9]);
  assert.equal(frozen[0].variantId, 'adult');
  const result = resolveInteraction(project, { entityVariantStates: { ridina: { adult: { properties: { strength: 0 } } } } }, definition, {}, rolls([1, 1, 1]), frozen);
  assert.equal(result.result.key, 'success');
  assert.equal(result.total, 12);
  assert.equal(result.participantResults['rival-a'].subject.instanceId, 'guard-copy');
  definition.mechanic.actor.subject.variantId = 'missing';
  assert.throws(() => freezeInteractionParticipants(project, state, definition), /Missing variant/);
  assert.equal(project.canonRefs[0].frontmatter.stats.strength, 4);
});

test('world skill checks freeze numeric operands before the pending roll is resolved', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0], environment = rolls([10]);
  definition.mechanic = { kind: 'skillcheck', skill: { kind: 'variable', variableId: 'actor-skill' }, dice: { count: 1, sides: 20 }, difficulty: 15, modifier: 0 };
  definition.results = definition.results.filter(result => result.key !== 'tie');
  let session = createAuthoringSession(project, undefined, undefined, environment);
  assert.equal(session.interactions[0].skillValue, 0);
  session = authoringCommand(project, session, { type: 'setState', state: { variables: { ...session.state.variables, 'actor-skill': 100 } } }, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
  assert.equal(session.state.interactionResults.use.total, 10);
  assert.equal(session.state.interactionResults.use.resultId, 'contest:failure');
  assert.equal(session.state.variables.score, 1);
  assert.ok(session.trace.some(trace => trace.message === 'Roll: 10 + 0 + 0 = 10; difficulty 15'));
  session = authoringCommand(project, session, { type: 'back' }, environment);
  session = authoringCommand(project, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
  assert.equal(environment.count(), 1);
  assert.equal(session.trace.filter(trace => trace.message.startsWith('Roll:')).length, 1);
});

test('canonical descriptor changes invalidate a running interaction while layout changes remain harmless', () => {
  const project = fixture(), environment = rolls([10, 5, 15]);
  const session = createAuthoringSession(project, undefined, undefined, environment);
  const changedLayout = { ...project, canvas: { activeScope: { kind: 'event', id: 'event' }, scopes: { 'event:event': { nodePositions: { 'beat:event:a': { x: 400, y: 300 } } } } } };
  const resolved = authoringCommand(changedLayout, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, environment);
  assert.equal(resolved.status, 'ready');
  const changedSchema = { ...project, canonPropertyDescriptors: [{ id: 'strength', label: 'Strength', valueType: 'number', path: ['stats', 'strength'], appliesToTypes: ['character'] }] };
  const rejected = authoringCommand(changedSchema, session, { type: 'resolveInteraction', executionId: session.interactions[0].id }, rolls([]));
  assert.equal(rejected.status, 'blocked');
  assert.match(rejected.message, /story changed.*Restart/i);
});

test('world checks resolve D9, D20 and D100 against the exact threshold including their modifier', () => {
  for(const sides of [9,20,100]) {
    const project=fixture(),definition=project.events[0].interactionDefinitions[0];
    project.logicVariables.find(variable=>variable.id==='actor-skill').value=5;
    definition.mechanic={kind:'skillcheck',skill:{kind:'variable',variableId:'actor-skill'},dice:{count:1,sides},modifier:2,difficulty:sides+7};
    definition.results=definition.results.filter(result=>result.key!=='tie');
    let calls=0;
    const success=resolveInteraction(project,{},definition,{}, {random:()=>{calls++;return (sides-.5)/sides;}});
    assert.equal(success.result.key,'success');assert.equal(success.total,sides+7);assert.deepEqual(success.rolls,[sides]);assert.equal(calls,1);
    const failure=resolveInteraction(project,{},definition,{}, {random:()=>0});
    assert.equal(failure.result.key,'failure');assert.equal(failure.total,8);assert.deepEqual(failure.rolls,[1]);
  }
});

test('composite world checks combine open extreme intervals, strict difficulty and frozen conditional modifiers', () => {
  const project = fixture(), definition = project.events[0].interactionDefinitions[0];
  project.logicVariables.find(variable => variable.id === 'actor-skill').value = 4;
  project.logicVariables.find(variable => variable.id === 'score').value = 1;
  definition.mechanic = {
    kind: 'skillcheck', skill: { kind: 'variable', variableId: 'actor-skill' },
    dice: { count: 1, sides: 4, groups: [{ id: 'd4s', count: 2, sides: 4 }, { id: 'd2', count: 1, sides: 2 }] },
    difficulty: 7, difficultyOperator: '>=', modifier: -1,
    modifierRules: [
      { id: 'visited', name: 'Lugar visitado', modifier: 2, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '>=', value: 1 } },
      { id: 'cost', name: 'Costo', modifier: -1, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '==', value: 1 } },
      { id: 'inactive', name: 'Inactivo', modifier: 50, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '==', value: 2 } },
    ],
  };
  definition.results = definition.results.filter(result => ['success', 'failure'].includes(result.key));
  definition.results.push({ id: 'contest:secret', name: 'Secreto', range: { min: 7, minInclusive: false } });
  const rollsForComposite = () => { let calls = 0; return { random: () => { calls++; return 0; }, now: () => 1, count: () => calls }; };
  const inclusive = resolveInteraction(project, { variables: { 'actor-skill': 4, score: 1 } }, definition, {}, rollsForComposite());
  assert.equal(inclusive.total, 7);
  assert.equal(inclusive.result.key, 'success');
  assert.deepEqual(inclusive.rolls, [1, 1, 1]);
  assert.equal(inclusive.modifier, 0);
  assert.deepEqual(inclusive.modifierBreakdown.map(rule => [rule.name, rule.modifier]), [['Lugar visitado', 2], ['Costo', -1]]);
  const pending = structuredClone(definition);
  pending.mechanic.modifierRules[0].conditions = undefined;
  let randomCalls = 0;
  assert.throws(() => resolveInteraction(project, { variables: { 'actor-skill': 4, score: 1 } }, pending, {}, { random: () => { randomCalls++; return 0; } }), /condition before its modifier/);
  assert.equal(randomCalls, 0, 'A pending modifier condition blocks the roll before consuming dice.');

  definition.mechanic.difficultyOperator = '>';
  assert.equal(resolveInteraction(project, { variables: { 'actor-skill': 4, score: 1 } }, definition, {}, rollsForComposite()).result.key, 'failure');
  definition.mechanic.modifierRules[0].modifier = 3;
  const extreme = resolveInteraction(project, { variables: { 'actor-skill': 4, score: 1 } }, definition, {}, rollsForComposite());
  assert.equal(extreme.total, 8);
  assert.equal(extreme.result.id, 'contest:secret');
  assert.ok(interactionDefinitionIssues(definition).length === 0);

  definition.results.push({ id: 'contest:overlap', name: 'Solapado', range: { min: 7 } });
  assert.ok(interactionDefinitionIssues(definition).some(message => message.includes('overlap')));
});

test('option availability can depend on decision-before execution but never its own future interaction', () => {
  const project = fixture(), event = project.events[0], definition = event.interactionDefinitions[0];
  definition.mechanic = { kind: 'skillcheck', skill: { kind: 'variable', variableId: 'actor-skill' }, dice: { count: 1, sides: 20 }, difficulty: 5, modifier: 0 };
  definition.results = definition.results.filter(result => result.key !== 'tie');
  const condition = { type: 'interactionResult', useId: 'use', resultId: 'contest:success', operator: '==' };
  event.decisions = [{ id: 'decision', name: 'Decisiones', type: 'dialogue', outcomes: [{ id: 'yes', name: 'Entrar', conditions: condition }] }];
  event.interactionUses[0].ownerNodeId = 'decision:event:decision';
  event.transitions = [{ id: 'entry', from: 'boundary:event:input:entry', to: 'decision:event:decision' }, { id: 'next', from: 'outcome:event:decision:yes', to: 'beat:event:b' }];
  assert.ok(!validateInteractions(project).some(finding => finding.message.includes('before this interaction')));
  const environment = rolls([10]);
  const session = createAuthoringSession(project, undefined, undefined, environment);
  assert.equal(session.view.waiting, false, 'a passive before roll resolves automatically before choices are shown');
  assert.equal(session.interactions[0].status, 'resolved');
  assert.equal(environment.count(), 1, 'the passive interaction rolls exactly once on decision entry');
  assert.equal(session.view.choices[0].status, 'satisfied');
  event.interactionUses[0].ownerNodeId = 'outcome:event:decision:yes';
  assert.ok(validateInteractions(project).some(finding => finding.message.includes('before this interaction')));
  event.interactionUses[0].ownerNodeId = 'decision:event:decision';
  event.decisions[0].availability = condition;
  assert.ok(validateInteractions(project).some(finding => finding.message.includes('before this interaction')));
  const availabilityEnvironment = rolls([10]);
  const availabilitySession = createAuthoringSession(project, undefined, undefined, availabilityEnvironment);
  assert.equal(availabilitySession.status, 'blocked', 'decision availability is checked before its own before interaction');
  assert.equal(availabilityEnvironment.count(), 0, 'the decision gate cannot trigger the roll it references');
});

test('atomic interaction creation merges its use and definition with an option condition derived from the original document', () => {
  const base = fixture(), event = base.events[0];
  event.interactionDefinitions = []; event.interactionUses = [];
  event.decisions = [{ id: 'decision', name: 'Decisiones', type: 'dialogue', outcomes: [{ id: 'yes', name: 'Entrar', logic: { then: [{ type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'add', value: 2 }] } }] }];
  event.transitions = [{ id: 'entry', from: 'boundary:event:input:entry', to: 'decision:event:decision' }, { id: 'next', from: 'outcome:event:decision:yes', to: 'beat:event:b' }];
  base.canvas = { activeScope: { kind: 'event', id: 'event' }, scopes: { 'event:event': { nodePositions: { 'decision:event:decision': { x: 100, y: 50 } }, custom: 'preserve' } } };
  const preset = { id: 'd20', name: 'D20', revision: 3, mechanic: { kind: 'dice', count: 1, sides: 20, modifier: 0 }, results: [{ id: 'completed', name: 'Completada', range: { min: 1, max: 20 } }] };
  const creation = createInteractionFromPreset(base, 'event', preset, { ownerNodeId: 'decision:event:decision', moment: 'before' });
  const condition = { type: 'interactionResult', useId: creation.useId, resultId: `${creation.definitionId}:completed`, operator: '==' };
  const edited = updateOutcome(base, 'event', 'decision', 'yes', { conditions: condition, logic: { ...event.decisions[0].outcomes[0].logic, when: condition } }).project;
  const merged = mergeInteractionCreation(base, creation.project, edited);
  assert.equal(merged.events[0].interactionUses[0].id, creation.useId);
  assert.equal(merged.events[0].interactionDefinitions[0].id, creation.definitionId);
  assert.equal(merged.events[0].interactionDefinitions[0].presetOrigin.revision, 3);
  assert.deepEqual(merged.events[0].decisions[0].outcomes[0].logic.when, condition);
  assert.equal(merged.events[0].decisions[0].outcomes[0].logic.then[0].value, 2);
  assert.deepEqual(merged.canvas, base.canvas);
  assert.equal(base.events[0].interactionUses.length, 0);
  assert.equal(base.events[0].decisions[0].outcomes[0].conditions, undefined);
  assert.ok(!validateInteractions(merged).some(finding => finding.message.includes('before this interaction')));
});

test('atomic creation preserves newly inserted graph structure and nested placement metadata while applying existing row edits', () => {
  const base = fixture(), event = base.events[0];
  event.interactionDefinitions = []; event.interactionUses = [];
  base.canvas = { activeScope: { kind: 'event', id: 'event' }, scopes: { 'event:event': { nodePositions: { 'beat:event:a': { x: 0, y: 0 } } } } };
  const preset = { id: 'd9', name: 'D9', revision: 1, mechanic: { kind: 'dice', count: 1, sides: 9, modifier: 0 }, results: [{ id: 'completed', name: 'Completada', range: { min: 1, max: 9 } }] };
  const creation = createInteractionFromPreset(base, 'event', preset, { afterNodeId: 'beat:event:a', beforeNodeId: 'beat:event:b' });
  const nodeId = `interaction:event:${creation.useId}`;
  creation.project.canvas = structuredClone(creation.project.canvas);
  creation.project.canvas.scopes['event:event'].nodePositions = { ...creation.project.canvas.scopes['event:event'].nodePositions, [nodeId]: { x: 75, y: 25 } };
  const edited = structuredClone(base);
  edited.events[0].dialogueBeats[1].logic = { when: { type: 'interactionResult', useId: creation.useId, resultId: `${creation.definitionId}:completed`, operator: '==' } };
  const merged = mergeInteractionCreation(base, creation.project, edited);
  assert.equal(merged.events[0].transitions.find(route => route.id === 'next').to, nodeId);
  assert.ok(merged.events[0].transitions.some(route => route.from === nodeId && route.to === 'beat:event:b'));
  assert.deepEqual(merged.canvas.scopes['event:event'].nodePositions[nodeId], { x: 75, y: 25 });
  assert.equal(merged.events[0].dialogueBeats[1].logic.when.useId, creation.useId);
  assert.equal(merged.events[0].interactionUses[0].ownerNodeId, undefined);
  assert.equal(base.canvas.scopes['event:event'].nodePositions[nodeId], undefined);
});

test('inherited sequence, branch and conversation gates cannot depend on an interaction inside that scope', () => {
  const condition = { type: 'interactionResult', useId: 'use', resultId: 'contest:success', operator: '==' };
  for (const owner of ['sequence', 'branch', 'dialogue']) {
    const project = fixture();
    if (owner === 'sequence') project.sequences[0].availability = condition;
    if (owner === 'branch') project.branches = [{ id: 'branch', title: 'Branch', eventIds: ['event'], availability: condition }];
    if (owner === 'dialogue') {
      project.events[0].dialogues = [{ id: 'dialogue', title: 'Dialogue', text: { format: 'plain', content: '' }, availability: condition }];
      project.events[0].interactionUses[0].dialogueId = 'dialogue';
    }
    assert.ok(validateInteractions(project).some(finding => finding.message.includes('before this interaction')), `${owner} must diagnose the inherited self-dependency.`);
  }
});
