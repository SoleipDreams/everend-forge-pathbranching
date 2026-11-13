import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { StoryTestController } from '../lib/storyTestController.js';
import { createAuthoringSession, authoringCommand } from '../lib/authoringEngine.js';
import { defaultInteraction, addInteraction, addInteractionBarrier, deleteInteractionBarrier, deleteInteractionUse, setInteractionResultRoute, createInteractionResultContinuation, convertLegacyInteractionDecision } from '../lib/interactionMutations.js';
import { createDecision, createOutcome, deleteDecision } from '../lib/projectMutations.js';
import { resolveInteraction, interactionDefinitionIssues } from '../lib/interactions.js';
import { validateInteractions } from '../lib/interactionValidation.js';
import { validateProject } from '../lib/validate.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { deleteInteractionResult } from '../lib/interactionLibrary.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { exportSinpoGameData } from '../lib/exportFormats.js';
import { exportTwineHtml } from '../lib/twineFormat.js';
import { exportInkProject } from '../lib/inkExport.js';
import { serializeModularStoryFiles, loadPathBranchingWorkspace, serializePathBranchingManifest, storyPath } from '../lib/pathBranchingWorkspace.js';
import { applyEvpathToEvent, serializeEventEvpath } from '../lib/evpathFormat.js';
import { buildExportPreview } from '../lib/exportPreview.js';
import { buildStoryCanvasModel } from '../lib/canvas/storyCanvasModel.js';

const environment = { random: () => 0.45, now: () => 1000 };
const speech = id => `beat:e:${id}`;
function fixture(moment = 'before', independent = false) {
  const definition = defaultInteraction('dice', 'd');
  definition.results[1].effects = [{ type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'add', value: 1 }];
  return normalizeProject({ specVersion: '0.1', projectId: 'interactions-test', entrySequenceId: 's', canonRefs: [], sequences: [{ id: 's', name: 'Sequence', eventIds: ['e'], entryEventId: 'e' }], branches: [], scripts: [], variables: {}, externalFunctions: [],
    logicVariables: [{ id: 'score', name: 'Score', type: 'number', value: 0, groupId: 'g' }],
    scriptDocuments: [{ id: 'script', name: 'Script', blocks: ['a', 'b', 'c'].map(id => ({ id, kind: 'speech', content: id })) }],
    events: [{ id: 'e', name: 'Event', type: 'normal', dialogueBeats: ['a', 'b', 'c'].map(id => ({ id, kind: 'speech', blockRef: { scriptId: 'script', blockId: id } })), interactionDefinitions: [definition],
      interactionUses: [{ id: 'u', definitionId: 'd', moment, ...(independent ? {} : { ownerNodeId: speech('a') }) }],
      interactionBarriers: moment === 'during' ? [{ id: 'wait', name: 'Wait', useIds: ['u'] }] : [],
      transitions: [{ id: 'entry', from: 'boundary:e:input:entry', to: independent ? 'interaction:e:u' : speech('a') },
        ...(independent ? [{ id: 'i-a', from: 'interaction:e:u', to: speech('a') }] : []),
        { id: 'a-b', from: speech('a'), to: speech('b') },
        { id: 'b-c', from: speech('b'), to: moment === 'during' ? 'barrier:e:wait' : speech('c') },
        ...(moment === 'during' ? [{ id: 'wait-c', from: 'barrier:e:wait', to: speech('c') }] : [])] }] });
}
const cmd = (p, s, command) => authoringCommand(p, s, command, environment);
const finish = (p, s, input = {}) => cmd(p, s, { type: 'resolveInteraction', executionId: s.view.interactions[0].id, ...input });
let cases = 0;
{
  const p = fixture();
  p.events[0].interactionUses.push({ id: 'shared-use', definitionId: 'd', moment: 'before' });
  const next = deleteInteractionResult(p, 'e', 'u', 'd:low');
  const event = next.events[0], use = event.interactionUses.find(item => item.id === 'u');
  const edited = event.interactionDefinitions.find(item => item.id === use.definitionId);
  const shared = event.interactionDefinitions.find(item => item.id === 'd');
  assert.ok(use, 'deleting a result keeps its interaction use');
  assert.deepEqual(edited.results.map(result => result.id), ['d:high']);
  assert.ok(event.interactionUses.some(item => item.id === 'shared-use'));
  assert.deepEqual(shared.results.map(result => result.id), ['d:low', 'd:high']);

  const single = structuredClone(p);
  single.events[0].interactionDefinitions[0].results = [{ id: 'only', name: 'Only outcome' }];
  assert.equal(deleteInteractionResult(single, 'e', 'u', 'only'), single, 'the final result cannot remove its interaction');
  cases++;
}
{
  const p = fixture('before', true);
  const next = createInteractionResultContinuation(p, 'e', 'u', 'd:high');
  const event = next.events[0];
  const route = event.transitions.find(item => item.conditions?.type === 'interactionResult' && item.conditions.resultId === 'd:high');
  assert.ok(route, 'creating a continuation also routes the selected interaction result');
  assert.match(route.to, /^beat:e:/);
  assert.equal(event.dialogueBeats.length, 4, 'the continuation is added to the event script');
  cases++;
}
for (const [moment, independent] of [['before', false], ['before', true], ['after', false]]) {
  const p = fixture(moment, independent);
  let s = createAuthoringSession(p);
  if (moment === 'after') s = cmd(p, s, { type: 'continue' });
  assert.equal(s.status, 'ready'); assert.equal(s.view.waiting, true);
  const pending = structuredClone(s);
  s = finish(p, s);
  assert.equal(s.state.interactionResults.u.total, 10);
  assert.equal(s.state.variables.score, 1);
  assert.equal(s.nodeId, moment === 'after' ? speech('b') : speech('a'));
  const duplicate = cmd(p, s, { type: 'resolveInteraction', executionId: pending.view.interactions[0].id });
  assert.equal(duplicate.state.variables.score, 1);
  const back = cmd(p, s, { type: 'back' });
  assert.deepEqual(back.interactions, pending.interactions);
  assert.equal(back.state.variables.score, 0);
  cases++;
}
{
  const p = fixture('during'); let s = createAuthoringSession(p);
  assert.equal(s.view.waiting, false);
  s = cmd(p, s, { type: 'continue' }); assert.equal(s.nodeId, speech('b'));
  s = cmd(p, s, { type: 'continue' }); assert.equal(s.nodeId, 'barrier:e:wait'); assert.equal(s.view.waiting, true);
  s = finish(p, s); assert.equal(s.nodeId, speech('c')); assert.equal(s.state.variables.score, 1);
  assert.deepEqual(validateInteractions(p), []);
  assert.ok(validateInteractions({ ...p, events: p.events.map(e => ({ ...e, interactionBarriers: [] })) }).length);
  cases++;
}
{
  const p = fixture('during'); p.events[0].interactionDefinitions.push(defaultInteraction('qte', 'q'));
  p.events[0].interactionUses.push({ id: 'v', definitionId: 'q', ownerNodeId: speech('a'), moment: 'during' }); p.events[0].interactionBarriers[0].useIds.push('v');
  let s = createAuthoringSession(p); s = cmd(p, s, { type: 'continue' }); s = cmd(p, s, { type: 'continue' });
  s = finish(p, s); assert.equal(s.view.waiting, true);
  s = cmd(p, s, { type: 'interactionTime', elapsedMs: 2999 }); assert.equal(s.view.waiting, true);
  s = cmd(p, s, { type: 'interactionTime', elapsedMs: 1 }); assert.equal(s.nodeId, speech('c')); assert.equal(s.state.interactionResults.v.resultId, 'q:timeout');
  for (const [key, result] of [['Space', 'q:success'], ['KeyX', 'q:failure']]) {
    const q = defaultInteraction('qte', 'q'); assert.equal(resolveInteraction(p, {}, q, { key }, environment).result.id, result);
  }
  cases++;
}
{
  const p = fixture(); const d = defaultInteraction('skillcheck', 'skill', 'score'); d.mechanic.skill = undefined; d.mechanic.actor = undefined; d.mechanic.dice = { count: 1, sides: 20 }; d.mechanic.difficulty = 9;
  assert.equal(resolveInteraction(p, { variables: { score: 0 } }, d, {}, { ...environment, random: () => 0.45 }).result.key, 'success');
  d.mechanic.difficulty = 11; assert.equal(resolveInteraction(p, { variables: { score: 0 } }, d, {}, { ...environment, random: () => 0.45 }).result.key, 'failure');
  const thresholdOnly = structuredClone(d);
  thresholdOnly.mechanic.difficulty = 10;
  thresholdOnly.results.find(result => result.key === 'success').range = { min: 1, max: 9 };
  thresholdOnly.results.find(result => result.key === 'failure').range = { min: 10, max: 20 };
  const thresholdRoll = resolveInteraction(p, {}, thresholdOnly, {}, { ...environment, random: () => 0.2 });
  assert.equal(thresholdRoll.total, 5);
  assert.equal(thresholdRoll.result.key, 'success', 'configured ranges override the difficulty threshold for a two-outcome skillcheck');
  const missingDice = structuredClone(d); missingDice.mechanic.dice = undefined;
  assert.ok(interactionDefinitionIssues(missingDice).some(message => message.includes('dice pool')));
  assert.throws(() => resolveInteraction(p, {}, missingDice, {}, environment), /dice pool/);
  const dice = defaultInteraction('dice', 'dice');
  assert.equal(resolveInteraction(p, {}, dice, {}, { ...environment, random: () => 0 }).total, 1);
  assert.equal(resolveInteraction(p, {}, dice, {}, { ...environment, random: () => 0.9999 }).total, 20);
  dice.results[0].range.max = 10; assert.ok(interactionDefinitionIssues(dice).some(s => s.includes('overlap')));
  assert.throws(() => resolveInteraction(p, {}, dice, {}, environment));
  const custom = defaultInteraction('custom', 'custom'); assert.throws(() => resolveInteraction(p, {}, custom, {}, environment));
  assert.equal(resolveInteraction(p, {}, custom, { resultId: custom.results[0].id }, environment).forced, true);
  cases++;
}
{
  const p = fixture('during'); p.events[0].transitions.find(t => t.id === 'b-c').to = speech('c');
  let s = createAuthoringSession(p); s = cmd(p, s, { type: 'continue' }); s = cmd(p, s, { type: 'continue' }); s = cmd(p, s, { type: 'continue' });
  assert.equal(s.status, 'blocked'); assert.match(s.message, /barrier/); cases++;
}
{
  const p = fixture(); const exported = exportRuntimePackage(p);
  assert.ok(exported.pathBranching.requiredFeatures.includes('interactions-v1'));
  assert.deepEqual(exported.pathBranching.events[0].interactionDefinitions, p.events[0].interactionDefinitions);
  assert.equal(buildExportPreview(p, 'runtime').mode, 'runtime');
  const yaml = parse(buildExportPreview(p, 'runtimeYaml').content);
  assert.deepEqual(yaml, JSON.parse(buildExportPreview(p, 'runtime').content));
  const rebuilt = normalizeProject({ ...yaml.pathBranching, specVersion: yaml.specVersion, projectId: yaml.packageId, canonRefs: yaml.canonRefs, variables: yaml.variables });
  let originalRun = createAuthoringSession(p), rebuiltRun = createAuthoringSession(rebuilt);
  originalRun = finish(p, originalRun); rebuiltRun = finish(rebuilt, rebuiltRun);
  assert.deepEqual(rebuiltRun.state, originalRun.state);
  assert.deepEqual(rebuiltRun.trace, originalRun.trace);
  assert.throws(() => exportSinpoGameData(p), /interactions-v1/); assert.throws(() => exportTwineHtml(p), /interactions-v1/);
  assert.ok(exportInkProject(p).diagnostics.some(d => d.feature === 'interactions-v1'));
  const story = { id: p.projectId, name: 'Interactions', path: storyPath(p.projectId) };
  const files = [{ relativePath: '.everend/universe.json', content: JSON.stringify({ name: 'Synthetic' }) }, { relativePath: '.everend/.pathbranching/manifest.json', content: serializePathBranchingManifest({ version: '0.2', activeStoryId: story.id, stories: [story] }) }, ...serializeModularStoryFiles(p, story)];
  const loaded = loadPathBranchingWorkspace(files); assert.equal(loaded.saveBlocked, false);
  assert.deepEqual(loaded.activeProject.events[0].interactionDefinitions, p.events[0].interactionDefinitions);
  assert.deepEqual(loaded.activeProject.events[0].interactionUses, p.events[0].interactionUses);
  const text = serializeEventEvpath(p, 'e'); assert.equal(applyEvpathToEvent(p, 'e', text).errors.length, 0);
  assert.ok(applyEvpathToEvent(p, 'e', text + '\nExternal edit').errors.length);
  assert.deepEqual(applyEvpathToEvent(p, 'e', text + '\nExternal edit').project, p);
  cases++;
}
{
  const p = fixture('during', true); const graph = buildStoryCanvasModel(p, { scope: { kind: 'event', id: 'e' } });
  assert.ok(graph.nodes.some(n => n.id === 'interaction:e:u'));
  assert.ok(graph.nodes.some(n => n.id === 'barrier:e:wait'));
  const inserted = addInteraction(fixture(), 'e', 'qte', { afterNodeId: speech('a') });
  assert.equal(inserted.project.events[0].transitions.find(t => t.id === 'a-b').to, inserted.selection.id);
  assert.equal(fixture().events[0].interactionUses.length, 1);
  const barrier = addInteractionBarrier(inserted.project, 'e', { afterNodeId: inserted.selection.id, useIds: ['u'] });
  assert.ok(barrier.project.events[0].interactionBarriers.length); cases++;
}
{
  const p = fixture('after');
  const event = p.events[0];
  event.decisions = [{ id: 'decision', type: 'dialogue', name: 'Choose', outcomes: [
    { id: 'yes', name: 'Yes', conditions: { type: 'interactionResult', useId: 'u', resultId: 'd:high', operator: '==' } },
    { id: 'no', name: 'No', conditions: { type: 'interactionResult', useId: 'u', resultId: 'd:low', operator: '==' } },
  ] }];
  event.interactionUses[0].ownerNodeId = 'decision:e:decision';
  event.interactionUses[0].moment = 'before';
  event.transitions = [
    { id: 'entry-decision', from: 'boundary:e:input:entry', to: 'decision:e:decision' },
    { id: 'yes-next', from: 'outcome:e:decision:yes', to: speech('b') },
    { id: 'no-next', from: 'outcome:e:decision:no', to: speech('c') },
  ];
  const session = createAuthoringSession(p, undefined, undefined, environment);
  assert.equal(session.nodeId, 'decision:e:decision');
  assert.equal(session.view.waiting, false, 'a referenced before-roll must resolve automatically instead of blocking');
  assert.equal(session.state.interactionResults.u.resultId, 'd:high');
  assert.equal(session.view.choices.find(choice => choice.id === 'yes').status, 'satisfied');
  assert.equal(session.view.choices.find(choice => choice.id === 'no').status, 'unsatisfied');
  assert.equal(session.interactions.filter(execution => execution.useId === 'u' && execution.status === 'resolved').length, 1);
  cases++;
}
{
  const p = fixture('before');
  const event = p.events[0];
  event.interactionUses[0].ownerNodeId = speech('a');
  event.transitions = [
    { id: 'entry-a', from: 'boundary:e:input:entry', to: speech('a') },
    { id: 'a-low', from: speech('a'), to: speech('b'), order: 0, conditions: { type: 'interactionResult', useId: 'u', resultId: 'd:low', operator: '==' } },
    { id: 'a-high', from: speech('a'), to: speech('c'), order: 1, conditions: { type: 'interactionResult', useId: 'u', resultId: 'd:high', operator: '==' } },
    { id: 'b-again', from: speech('b'), to: speech('a') },
  ];
  let rolls = 0;
  const random = { random: () => rolls++ === 0 ? 0.1 : 0.9, now: () => 0 };
  let session = createAuthoringSession(p, undefined, undefined, random);
  assert.equal(session.state.interactionResults.u.resultId, 'd:low');
  assert.equal(session.view.waiting, false);
  session = authoringCommand(p, session, { type: 'continue' }, random);
  assert.equal(session.nodeId, speech('b'));
  session = authoringCommand(p, session, { type: 'continue' }, random);
  assert.equal(session.nodeId, speech('a'));
  assert.equal(session.state.interactionResults.u.resultId, 'd:high');
  assert.equal(rolls, 2, 'two route conditions share one roll per visit, and re-entry rolls again');
  session = authoringCommand(p, session, { type: 'continue' }, random);
  assert.equal(session.nodeId, speech('c'));
  cases++;
}
{
  let p = fixture('after');
  const event = p.events[0];
  event.interactionUses = [];
  event.interactionDefinitions = [];
  const outcomeId = 'outcome:e:decision:yes';
  event.decisions = [{ id: 'decision', type: 'dialogue', name: 'Choose', outcomes: [{ id: 'yes', name: 'Yes' }] }];
  event.transitions = [
    { id: 'entry-decision', from: 'boundary:e:input:entry', to: 'decision:e:decision' },
    { id: 'choice-first', from: outcomeId, to: speech('b'), order: 4, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '==', value: 2 }, consequences: [{ type: 'value', subject: { kind: 'variable', variableId: 'score' }, operation: 'add', value: 1 }] },
    { id: 'choice-second', from: outcomeId, to: speech('c'), order: 8, conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '==', value: 3 }, mode: 'fallback' },
  ];
  const added = addInteraction(p, 'e', 'dice', { afterNodeId: outcomeId });
  p = added.project;
  const interactionNodeId = added.selection.id;
  const use = p.events[0].interactionUses.find(candidate => `interaction:e:${candidate.id}` === interactionNodeId);
  assert.ok(use && !use.ownerNodeId, 'a configured option must create an independent Interaction node');
  assert.ok(p.events[0].transitions.some(transition => transition.from === outcomeId && transition.to === interactionNodeId));
  for (const [id, to, order, mode] of [['choice-first', speech('b'), 4, undefined], ['choice-second', speech('c'), 8, 'fallback']]) {
    const route = p.events[0].transitions.find(transition => transition.id === id);
    assert.equal(route.from, interactionNodeId);
    assert.equal(route.to, to);
    assert.equal(route.order, order);
    assert.equal(route.mode, mode);
    assert.ok(route.conditions, 'the prior conditions remain intact after insertion');
  }
  const definition = p.events[0].interactionDefinitions.find(item => item.id === use.definitionId);
  p = setInteractionResultRoute(p, 'e', use.id, definition.results.find(result => result.id.endsWith(':low')).id, speech('b'));
  p = setInteractionResultRoute(p, 'e', use.id, definition.results.find(result => result.id.endsWith(':high')).id, speech('c'));
  const model = buildStoryCanvasModel(p, { scope: { kind: 'event', id: 'e' } });
  const resultEdges = model.edges.filter(edge => edge.source === interactionNodeId && edge.sourceHandle?.startsWith('interaction-result:'));
  assert.equal(resultEdges.length, 2, 'each interaction result keeps its own directly connectable output');
  assert.ok(model.nodes.some(node => node.id === `route-gate:e:${interactionNodeId}`), 'generic continuation routes remain grouped in their own router');
  assert.equal(p.events[0].transitions.find(transition => transition.id === 'choice-first').conditions.operator, '==');
  let session = createAuthoringSession(p, undefined, undefined, environment);
  session = authoringCommand(p, session, { type: 'choose', outcomeId: 'yes' }, environment);
  assert.equal(session.nodeId, interactionNodeId);
  assert.equal(session.view.waiting, true, 'the option interaction starts only after the choice is selected');
  session = authoringCommand(p, session, { type: 'resolveInteraction', executionId: session.view.interactions[0].id }, environment);
  assert.equal(session.nodeId, speech('c'), 'the matching result route wins before preserved generic routes');
  cases++;
}
{
  let p = fixture('after');
  const event = p.events[0];
  event.interactionUses = [];
  event.interactionDefinitions = [];
  const firstOutcome = 'outcome:e:decision:first';
  const secondOutcome = 'outcome:e:decision:second';
  event.decisions = [{ id: 'decision', type: 'dialogue', name: 'Choose', outcomes: [{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }] }];
  event.transitions = [
    { id: 'entry-decision', from: 'boundary:e:input:entry', to: 'decision:e:decision' },
    { id: 'first-next', from: firstOutcome, to: speech('a') },
    { id: 'second-next', from: secondOutcome, to: speech('b') },
  ];
  const first = addInteraction(p, 'e', 'dice', { afterNodeId: firstOutcome });
  assert.ok(first.selection, 'the first option can add its interaction');
  p = first.project;
  const second = addInteraction(p, 'e', 'dice', { afterNodeId: secondOutcome });
  assert.ok(second.selection, 'an interaction on the first option does not block the second option');
  p = second.project;
  assert.equal(p.events[0].interactionUses?.length, 2, 'each option owns its own interaction use');
  const duplicate = addInteraction(p, 'e', 'dice', { afterNodeId: firstOutcome });
  assert.match(duplicate.message ?? '', /already has an interaction/i, 'the same option cannot receive a duplicate interaction');
  cases++;
}
{
  const connected = fixture('before', true);
  const routed = setInteractionResultRoute(connected, 'e', 'u', 'd:low', speech('c'));
  const deleted = deleteInteractionUse(routed, 'e', 'u');
  assert.equal(deleted.events[0].interactionUses.length, 0);
  assert.equal(deleted.events[0].interactionDefinitions.length, 0);
  assert.equal(deleted.events[0].transitions.find(transition => transition.id === 'entry').to, speech('a'));
  assert.ok(!deleted.events[0].transitions.some(transition => transition.from === 'interaction:e:u' || transition.to === 'interaction:e:u'));
  assert.ok(!deleted.events[0].transitions.some(transition => JSON.stringify(transition).includes('"useId":"u"')));
  assert.ok(!buildStoryCanvasModel(deleted, { scope: { kind: 'event', id: 'e' } }).nodes.some(node => node.id === 'interaction:e:u'));

  const story = { id: deleted.projectId, name: 'Interactions', path: storyPath(deleted.projectId) };
  const files = [
    { relativePath: '.everend/universe.json', content: JSON.stringify({ name: 'Synthetic' }) },
    { relativePath: '.everend/.pathbranching/manifest.json', content: serializePathBranchingManifest({ version: '0.2', activeStoryId: story.id, stories: [story] }) },
    ...serializeModularStoryFiles(deleted, story),
  ];
  const reopened = loadPathBranchingWorkspace(files);
  assert.equal(reopened.saveBlocked, false);
  assert.equal(reopened.activeProject.events[0].interactionUses?.length ?? 0, 0);
  assert.equal(reopened.activeProject.events[0].interactionDefinitions?.length ?? 0, 0);
  cases++;
}
{
  const concurrent = setInteractionResultRoute(fixture('during'), 'e', 'u', 'd:high', speech('a'));
  const deleted = deleteInteractionUse(concurrent, 'e', 'u');
  assert.equal(deleted.events[0].interactionUses?.length ?? 0, 0);
  assert.equal(deleted.events[0].interactionBarriers?.length ?? 0, 0);
  assert.equal(deleted.events[0].transitions.find(transition => transition.id === 'b-c')?.to, speech('c'));
  assert.ok(!deleted.events[0].transitions.some(transition => JSON.stringify(transition).includes('"useId":"u"')));
  cases++;
}
{
  const source = fixture();
  source.events[0].dialogues = [{ id: 'conversation', title: 'Conversation', text: { format: 'plain', content: '' }, beats: [], members: [] }];
  const created = createDecision(source, 'e', 'conversation');
  const decisionId = created.project.events[0].decisions[0].id;
  assert.ok(decisionId);
  assert.equal(created.selection?.type === 'node' ? created.selection.id : '', `decision:e:${decisionId}`);
  assert.equal(created.project.events[0].dialogues[0].members[0].id, decisionId);
  const withOutcome = createOutcome(created.project, 'e', decisionId);
  const decision = withOutcome.project.events[0].decisions[0];
  const outcomeId = decision.outcomes[0].id;
  const linked = {
    ...withOutcome.project,
    canvas: { nodes: { [`decision:e:${decisionId}`]: { position: { x: 10, y: 20 } }, [`outcome:e:${decisionId}:${outcomeId}`]: { position: { x: 30, y: 40 } } } },
    events: withOutcome.project.events.map(event => ({ ...event, transitions: [...(event.transitions ?? []),
      { id: 'into-decision', from: speech('a'), to: `decision:e:${decisionId}` },
      { id: 'choice-route', from: `outcome:e:${decisionId}:${outcomeId}`, to: speech('b') },
    ] })),
  };
  const deleted = deleteDecision(linked, 'e', decisionId).project;
  assert.equal(deleted.events[0].decisions?.length ?? 0, 0);
  assert.ok(!deleted.events[0].transitions?.some(transition => transition.id === 'into-decision' || transition.id === 'choice-route'));
  assert.equal(deleted.events[0].dialogues?.[0].members?.length ?? 0, 0);
  assert.ok(!deleted.canvas?.nodes?.[`decision:e:${decisionId}`]);
  assert.ok(!deleted.canvas?.nodes?.[`outcome:e:${decisionId}:${outcomeId}`]);
  assert.equal(normalizeProject(deleted).events[0].decisions?.length ?? 0, 0);
  cases++;
}
{
  let p = fixture('during');
  p = setInteractionResultRoute(p, 'e', 'u', 'd:high', speech('a'));
  assert.equal(p.events[0].transitions.find(t => t.label === '10–20').from, 'barrier:e:wait');
  assert.ok(!validateProject(p).some(f => f.code === 'invalid_scope_transition'));
  let s = createAuthoringSession(p); s = cmd(p, s, { type: 'continue' }); s = cmd(p, s, { type: 'continue' }); s = finish(p, s);
  assert.equal(s.nodeId, speech('a')); assert.equal(s.view.interactions[0].id, 'execution:2');
  assert.equal(s.state.interactionResults.u, undefined);
  assert.equal(s.state.variables.score, 1);
  cases++;
}
{
  const p = fixture('after');
  const e = p.events[0];
  e.decisions = [{ id: 'decision', type: 'dialogue', name: 'Choose', outcomes: [{ id: 'yes', name: 'Yes', conditions: { type: 'value', subject: { kind: 'variable', variableId: 'score' }, operator: '==', value: 0 } }] }];
  e.interactionUses[0].ownerNodeId = 'decision:e:decision';
  e.transitions = [{ id: 'entry', from: 'boundary:e:input:entry', to: 'decision:e:decision' }, { id: 'yes-a', from: 'outcome:e:decision:yes', to: speech('a') }];
  let s = createAuthoringSession(p); assert.equal(s.view.choices[0].status, 'satisfied');
  s = cmd(p, s, { type: 'choose', outcomeId: 'yes' }); assert.equal(s.view.waiting, true);
  s = finish(p, s); assert.equal(s.status, 'ready'); assert.equal(s.nodeId, speech('a')); assert.equal(s.state.variables.score, 1);
  // A response starts its own interaction only once confirmed.
  e.interactionUses[0].ownerNodeId = 'outcome:e:decision:yes'; e.interactionUses[0].moment = 'before';
  s = createAuthoringSession(p); assert.equal(s.view.interactions.length, 0);
  s = cmd(p, s, { type: 'choose', outcomeId: 'yes' }); assert.equal(s.view.interactions.length, 1);
  s = finish(p, s); assert.equal(s.nodeId, speech('a'));
  e.decisions[0].type = 'dice'; const converted = convertLegacyInteractionDecision(p, 'e', 'decision');
  assert.equal(converted.project.events[0].decisions[0].type, 'dialogue'); assert.equal(p.events[0].decisions[0].type, 'dice');
  cases++;
}
{
  const p = fixture('during'); const e = p.events[0];
  p.events.push({ id: 'other', name: 'Called event', type: 'normal', text: { format: 'plain', content: 'Inspect' } });
  p.narrativeActions = [{ id: 'call', name: 'Inspect', targetNodeId: 'other', navigation: 'call' }];
  e.interactionDefinitions[0] = defaultInteraction('qte', 'd');
  let s = createAuthoringSession(p); s = cmd(p, s, { type: 'action', actionId: 'call' });
  assert.equal(s.nodeId, 'other'); assert.equal(s.view.interactions.length, 0);
  s = cmd(p, s, { type: 'interactionTime', elapsedMs: 5000 }); assert.equal(s.interactions[0].elapsedMs, 0);
  s = cmd(p, s, { type: 'continue' }); assert.equal(s.nodeId, speech('a')); assert.equal(s.view.interactions[0].id, 'execution:1');
  s = finish(p, s, { key: 'Space' }); assert.equal(s.state.interactionResults.u.resultId, 'd:success');
  cases++;
}
{
  const p = fixture('after'); const e = p.events[0];
  const beats = e.dialogueBeats; e.dialogueBeats = []; e.dialogues = [{ id: 'conversation', title: 'Conversation', text: { format: 'plain', content: '' }, beats, entryBeatId: 'a' }];
  e.interactionUses[0].ownerNodeId = 'dialogue:e:conversation';
  e.transitions = [{ id: 'entry', from: 'boundary:e:input:entry', to: 'dialogue:e:conversation' }, { id: 'a-out', from: speech('a'), to: 'dialogue-boundary:e:conversation:output' }];
  let s = createAuthoringSession(p); assert.equal(s.nodeId, speech('a')); assert.equal(s.view.interactions.length, 0);
  s = cmd(p, s, { type: 'continue' }); assert.equal(s.view.interactions.length, 1);
  s = finish(p, s); assert.equal(s.status, 'ended'); assert.equal(s.state.variables.score, 1);
  // Inserting ahead of a named beat entry must actually change playback entry.
  const inserted = addInteraction(p, 'e', 'qte', { dialogueId: 'conversation' });
  s = createAuthoringSession(inserted.project); assert.equal(s.nodeId, inserted.selection.id);
  cases++;
}
{
  const p = fixture('during'); p.events[0].interactionDefinitions[0] = defaultInteraction('qte', 'd');
  let time = 0; const clock = { random: () => 0, now: () => time };
  let s = createAuthoringSession(p, undefined, undefined, clock);
  time = 1000; s = authoringCommand(p, s, { type: 'interactionTime' }, clock);
  assert.equal(s.interactions[0].elapsedMs, 1000);
  time = 3000; s = authoringCommand(p, s, { type: 'interactionTime' }, clock);
  assert.equal(s.state.interactionResults.u.resultId, 'd:timeout');
  const withoutWait = deleteInteractionBarrier(p, 'e', 'wait');
  assert.equal(withoutWait.events[0].transitions.find(t => t.id === 'b-c').to, speech('c'));
  assert.ok(validateInteractions(withoutWait).some(f => f.message.includes('barrier')));
  assert.equal(p.events[0].interactionBarriers.length, 1);
  cases++;
}
{
  const p = fixture(); let rolls = 0;
  const random = { random: () => { rolls++; return 0.9; }, now: () => 0 };
  let s = createAuthoringSession(p);
  const id = s.view.interactions[0].id;
  s = authoringCommand(p, s, { type: 'resolveInteraction', executionId: id }, random);
  assert.equal(rolls, 1); const total = s.state.interactionResults.u.total;
  s = authoringCommand(p, s, { type: 'back' }, random);
  s = authoringCommand(p, s, { type: 'resolveInteraction', executionId: id }, random);
  assert.equal(rolls, 1); assert.equal(s.state.interactionResults.u.total, total); assert.equal(s.state.variables.score, 1);
  const d = defaultInteraction('dice', 'd'); d.mechanic = { kind: 'dice', count: 1, sides: 6, modifier: 0.5 };
  d.results = [{ id: 'a', name: 'a', range: { min: 1.5, max: 2.4 } }, { id: 'b', name: 'b', range: { min: 3.4, max: 6.5 } }];
  assert.ok(interactionDefinitionIssues(d).some(m => m.includes('cover')));
  d.results[0].range.max = undefined;
  assert.ok(interactionDefinitionIssues(d).some(m => m.includes('finite lower and upper')));
  cases++;
}
{
  const p = fixture('during'); p.events[0].interactionDefinitions[0] = defaultInteraction('qte', 'd');
  let saved;
  const controller = new StoryTestController(p, { onUpdate: next => { saved = next; } });
  controller.dispatch({ type: 'start' }); controller.dispatch({ type: 'pause' });
  controller.dispatch({ type: 'interactionTime', elapsedMs: 5000 });
  assert.equal(controller.getSnapshot().view.interactions[0].elapsedMs, 0);
  controller.dispatch({ type: 'play' }); controller.dispatch({ type: 'interactionTime', elapsedMs: 500 });
  assert.equal(controller.getSnapshot().view.interactions[0].elapsedMs, 500);
  controller.dispatch({ type: 'resolveInteraction', executionId: controller.getSnapshot().view.interactions[0].id, resultId: 'd:success' });
  assert.ok(controller.getSnapshot().trace.some(t => t.kind === 'interaction' && t.message.includes('forced')));
  controller.dispatch({ type: 'createScenario', fromRun: true });
  assert.equal(saved.authoringScenarios[0].state.interactionResults, undefined);
  const custom = defaultInteraction('custom', 'custom');
  assert.equal(resolveInteraction(p, {}, custom, { resultId: custom.results[0].id, manual: true }).forced, false);
  cases++;
}
console.log(`Interactions: ${cases} regression groups passed`);
