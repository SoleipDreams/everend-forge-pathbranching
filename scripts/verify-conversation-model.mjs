import { changeReadingContinuation, clearReadingContinuation, clearConversationContinuation, finishReadingConversation, insertReadingDecision, narrativeReadingPath } from '../lib/narrativeReadingPath.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeProject, parseProject, serializeProject } from '../lib/projectSerialization.js';
import { addConversationParticipant, inheritConversationContext, inheritableConversationContext, setConversationStartingLocation, conversationDropOffset, conversationGroups, conversationLineForCanvasSelection, conversationProjection, convertLegacyConversationText, createConversationSpeaker, insertConversationLine, makeConversationLineIndependent, moveConversationLine, removeConversationLine, updateConversationSpeaker, updateConversationText } from '../lib/conversationModel.js';
import { endNarrativeContinuation, insertNarrativeBlock, narrativeConnections } from '../lib/authoringMutations.js';
import { deleteDialogue, createInternalTransition, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateTransition } from '../lib/projectMutations.js';
import { createAuthoringSession, authoringCommand } from '../lib/authoringEngine.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { applyEvpathToEvent, serializeEventEvpath } from '../lib/evpathFormat.js';
import { authoringDraftCount, authoringDraftKey, getAuthoringDraft, setAuthoringDraft } from '../lib/authoringDrafts.js';
import { guardUniverseSwitch } from '../lib/universeSwitchGuard.js';
import { validateProject } from '../lib/validate.js';

test('selected option transitions share create, replace and remove without losing route metadata or text', () => {
  for(const nested of [false,true]) {
    let project=fixture(),dialogueId;
    if(nested) {project=insertNarrativeBlock(project,eventId,'dialogue').project;dialogueId=project.events[0].dialogues[0].id;}
    let first;[project,first]=add(project,'speech','Original line',{eventId,dialogueId});
    project=insertReadingDecision(project,{eventId,dialogueId},first).project;
    const decision=project.events[0].decisions[0];
    const source=`outcome:${eventId}:${decision.id}:${decision.outcomes[1].id}`;
    const kind=nested?'speech':'dialogue';
    const created=changeReadingContinuation(project,eventId,source,dialogueId,{kind});
    assert.notEqual(created.project,project);
    const route=created.project.events[0].transitions.find(route=>route.from===source);
    assert.ok(route);
    project=updateTransition(created.project,route.id,{label:'Keep route label'}).project;
    const target=insertNarrativeBlock(project,eventId,kind,{dialogueId});
    const prepared=updateTransition(target.project,route.id,{label:'Keep route label'}).project;
    const replaced=changeReadingContinuation(prepared,eventId,source,dialogueId,{kind,id:target.selection.id}).project;
    assert.equal(replaced.events[0].transitions.find(item=>item.from===source).id,route.id);
    assert.equal(replaced.events[0].transitions.find(item=>item.from===source).label,'Keep route label');
    const removed=clearReadingContinuation(replaced,eventId,source).project;
    assert.ok(!removed.events[0].transitions.some(route=>route.from===source));
    assert.deepEqual(removed.events[0].decisions,replaced.events[0].decisions);
    assert.deepEqual(removed.scriptDocuments,replaced.scriptDocuments);
    const reopened=parseProject(serializeProject(removed));
    assert.ok(conversationProjection(reopened,{eventId,dialogueId}).rows.some(row=>row.block.content==='Original line'));
    if(nested)assert.equal(changeReadingContinuation(removed,eventId,source,dialogueId,{kind:'subevent'}).project,removed);
  }
});

const eventId = 'conversation-scene', context = { eventId };

test('a dialogue inserted after a scene end becomes its continuation, with or without an existing destination', () => {
  const original = fixture();
  const firstResult = insertNarrativeBlock(original, eventId, 'dialogue');
  const firstId = firstResult.selection.id;

  const withoutExistingEnd = insertNarrativeBlock(firstResult.project, eventId, 'dialogue', { afterNodeId: firstId });
  const firstToNew = withoutExistingEnd.project.events[0].transitions.find(route => route.from === firstId && route.to === withoutExistingEnd.selection.id);
  assert.ok(firstToNew, 'The newly created dialogue must become the current scene transition when no destination exists yet.');

  const outputId = `boundary:${eventId}:output:exit`;
  const ended = endNarrativeContinuation(firstResult.project, eventId, firstId);
  const insertedBetweenDialogueAndEnd = insertNarrativeBlock(ended.project, eventId, 'dialogue', { afterNodeId: firstId, beforeNodeId: outputId });
  assert.ok(
    insertedBetweenDialogueAndEnd.project.events[0].transitions.some(route => route.from === firstId && route.to === insertedBetweenDialogueAndEnd.selection.id),
    'The newly created dialogue must take over the existing scene transition.',
  );
  assert.ok(
    insertedBetweenDialogueAndEnd.project.events[0].transitions.some(route => route.from === insertedBetweenDialogueAndEnd.selection.id && route.to === outputId),
    'The existing end-of-scene destination must remain after the inserted dialogue.',
  );
});

test('context header participants share event presence without changing spoken lines', () => {
  const base = fixture();
  const project = {...base, canonRefs: [...base.canonRefs, {id:'new-character',kind:'character',label:'New character'}]};
  const result = addConversationParticipant(project,eventId,'new-character');
  assert.ok(result.project.events[0].presentEntityRefs.includes('new-character'));
  assert.deepEqual(result.project.events[0].dialogueBeats,project.events[0].dialogueBeats);
  const reopened = parseProject(serializeProject(result.project));
  assert.ok(reopened.events[0].presentEntityRefs.includes('new-character'));
  assert.equal(addConversationParticipant(project,eventId,'missing-character').project,project);
});

test('starting place is singular, shared with event presence and preserves later overrides', () => {
  const base = fixture();
  let project = {...base, canonRefs: [...base.canonRefs,{id:'place-a',kind:'place',label:'A'},{id:'place-b',kind:'place',label:'B'}],logicTypeOverrides:[{source:'canon',typeId:'place',location:true}]};
  const inserted=insertConversationLine(project,context,'speech',{text:'Later scene'});
  const beat=inserted.project.events[0].dialogueBeats[0];
  project=updateEventDialogueBeat(inserted.project,eventId,beat.id,{locationRef:'place-b'}).project;
  const selected=setConversationStartingLocation(project,eventId,'place-a').project;
  assert.equal(selected.events[0].locationRef,'place-a');
  assert.ok(selected.events[0].presentEntityRefs.includes('place-a'));
  assert.equal(selected.events[0].dialogueBeats[0].locationRef,'place-b');
  const changed=setConversationStartingLocation(selected,eventId,'place-b').project;
  assert.equal(changed.events[0].locationRef,'place-b');
  assert.equal(parseProject(serializeProject(changed)).events[0].locationRef,'place-b');
  const cleared=setConversationStartingLocation(changed,eventId).project;
  assert.equal(cleared.events[0].locationRef,undefined);
  assert.equal(cleared.events[0].dialogueBeats[0].locationRef,'place-b');
  assert.equal(setConversationStartingLocation(project,eventId,'speaker').project,project);
});

test('new conversations have independent context and can explicitly inherit the previous conversation', () => {
  const base = fixture();
  let project = {
    ...base,
    canonRefs: [...base.canonRefs, { id: 'bob', kind: 'character', label: 'Bob' }, { id: 'place-a', kind: 'place', label: 'A' }, { id: 'place-b', kind: 'place', label: 'B' }],
    logicTypeOverrides: [{ source: 'canon', typeId: 'place', location: true }],
    events: [{ ...base.events[0], presentEntityRefs: ['alice'], locationRef: 'place-b' }],
  };
  const sourceResult = insertNarrativeBlock(project, eventId, 'dialogue');
  const sourceId = sourceResult.selection.id.slice(`dialogue:${eventId}:`.length);
  project = sourceResult.project;
  const targetResult = insertNarrativeBlock(project, eventId, 'dialogue');
  const targetId = targetResult.selection.id.slice(`dialogue:${eventId}:`.length);
  project = targetResult.project;
  const event = project.events[0];
  assert.deepEqual(event.dialogues.find(item => item.id === targetId).presentEntityRefs, [], 'A new conversation must not copy event characters by default.');
  assert.equal(event.dialogues.find(item => item.id === targetId).locationRef, undefined, 'A new conversation must not copy the event place by default.');

  const targetContext = { eventId, dialogueId: targetId }, sourceContext = { eventId, dialogueId: sourceId };
  project = insertConversationLine(project, sourceContext, 'speech', { text: 'Bob speaks.', speakerRef: 'bob' }).project;
  const added = addConversationParticipant(project, eventId, 'bob', targetId);
  assert.deepEqual(added.project.events[0].dialogues.find(item => item.id === targetId).presentEntityRefs, ['bob']);
  assert.deepEqual(added.project.events[0].presentEntityRefs, ['alice'], 'Editing a conversation must not change event-level presence.');
  project = setConversationStartingLocation(added.project, eventId, 'place-a', targetId).project;
  assert.equal(project.events[0].locationRef, 'place-b', 'Setting a conversation place must not change the event place.');

  project = updateDialogue(project, eventId, sourceId, { presentEntityRefs: ['alice'], locationRef: 'place-a' }).project;
  project = setConversationStartingLocation(project, eventId, undefined, targetId).project;
  const inherited = inheritConversationContext(project, targetContext, sourceContext, new Set(['alice', 'bob']));
  assert.notEqual(inherited.project, project);
  assert.deepEqual(inherited.project.events[0].dialogues.find(item => item.id === targetId).presentEntityRefs, ['bob', 'alice']);
  assert.equal(inherited.project.events[0].dialogues.find(item => item.id === targetId).locationRef, 'place-a');
  assert.deepEqual(inherited.project.events[0].presentEntityRefs, ['alice']);
  const reopened = parseProject(serializeProject(inherited.project));
  assert.deepEqual(reopened.events[0].dialogues.find(item => item.id === targetId).presentEntityRefs, ['bob', 'alice']);
  assert.equal(reopened.events[0].dialogues.find(item => item.id === targetId).locationRef, 'place-a');
});

test('legacy event context is available to the first conversation but not inherited by later ones automatically', () => {
  let project = {
    ...fixture(),
    events: [{ ...fixture().events[0], presentEntityRefs: ['alice'], locationRef: 'place-a' }],
    canonRefs: [...fixture().canonRefs, { id: 'place-a', kind: 'place', label: 'A' }],
    logicTypeOverrides: [{ source: 'canon', typeId: 'place', location: true }],
  };
  const firstResult = insertNarrativeBlock(project, eventId, 'dialogue');
  const firstId = firstResult.selection.id.slice(`dialogue:${eventId}:`.length);
  project = firstResult.project;
  const secondResult = insertNarrativeBlock(project, eventId, 'dialogue');
  const secondId = secondResult.selection.id.slice(`dialogue:${eventId}:`.length);
  project = secondResult.project;
  project = updateDialogue(project, eventId, firstId, { presentEntityRefs: undefined }).project;

  const characterIds = new Set(['alice']);
  assert.deepEqual(inheritableConversationContext(project, { eventId, dialogueId: firstId, legacyEventContextFallback: true }, characterIds), { presentEntityRefs: ['alice'], locationRef: 'place-a' });
  assert.deepEqual(inheritableConversationContext(project, { eventId, dialogueId: secondId, legacyEventContextFallback: false }, characterIds), { presentEntityRefs: [], locationRef: undefined });
});

const fixture = () => normalizeProject({ specVersion: '0.1', projectId: 'conversation-fixture', storyId: 'conversation-fixture', name: 'Conversation', entrySequenceId: 'main', sequences: [{ id: 'main', name: 'Main', entryEventId: eventId, eventIds: [eventId] }], branches: [], events: [{ id: eventId, name: 'Scene', type: 'normal' }], canonRefs: [{ id: 'alice', kind: 'character', label: 'Alice', frontmatter: { variants: { rain: { label: 'In the rain' } } } }], scripts: [], externalFunctions: [], variables: { signal: false } });

test('ordinary canvas line selection stays in its exact owner conversation while advanced sections remain independent', () => {
  let project = fixture(), direct, nested;
  [project, direct] = add(project, 'speech', 'Direct');
  const container = insertNarrativeBlock(project, eventId, 'dialogue', { afterNodeId: direct }); project = container.project;
  const dialogueId = project.events[0].dialogues[0].id, scope = { eventId, dialogueId };
  [project, nested] = add(project, 'speech', 'Nested', scope);
  assert.equal(conversationLineForCanvasSelection(project,eventId,'path',direct),direct);
  assert.equal(conversationLineForCanvasSelection(project,eventId,'path',nested),nested);
  assert.equal(conversationLineForCanvasSelection(project,`dialogue:${eventId}:${dialogueId}`,'narrativeSequence',nested),nested);
  assert.equal(conversationLineForCanvasSelection(project,`dialogue:${eventId}:${dialogueId}`,'path',direct),undefined);
  for(const section of ['overview','content','conditions','connections'])assert.equal(conversationLineForCanvasSelection(project,eventId,section,direct),undefined);
  assert.equal(conversationLineForCanvasSelection(project,'missing','path',direct),undefined);
  assert.equal(conversationLineForCanvasSelection(project,eventId,'path',container.selection.id),undefined);
});

test('event presence accepts an existing local conversation speaker but still diagnoses a missing identity', () => {
  const scope = {eventId};
  const created = createConversationSpeaker(fixture(),scope,'Local speaker');
  const ref = created.selection.id;
  const [project] = add(created.project,'speech','A local line.',scope,{speakerRef:ref});
  assert.ok(!validateProject(project).some(item=>item.code==='missing_canon_ref'&&item.ref===ref));
  const missing={...project,localExplorerEntities:[]};
  const findings=validateProject(missing);
  assert.ok(findings.some(item=>item.code==='missing_canon_ref'&&item.ref===ref),JSON.stringify(findings));
  assert.ok(findings.some(item=>item.message.includes('present entity')&&item.message.includes(ref)));
  assert.ok(findings.some(item=>item.message.includes('character')&&item.message.includes(ref)));
});
function add(project, kind, text, scope = context, options = {}) {
  const result = insertConversationLine(project, scope, kind, { text, ...options });
  assert.notEqual(result.project, project, result.message); assert.equal(result.selection?.type, 'node');
  return [result.project, result.selection.id];
}
test('inspector groups reference original dialogue owners through edits, reopen and export', () => {
  let project = fixture(), direct, nested;
  [project, direct] = add(project, 'direction', 'Own line');
  project = insertNarrativeBlock(project, eventId, 'dialogue', { afterNodeId: direct }).project;
  const dialogueId = project.events[0].dialogues[0].id;
  const context = { eventId, dialogueId };
  [project, nested] = add(project, 'speech', 'Child line', context);
  const snapshot = structuredClone(project);
  const groups = conversationGroups(project, eventId);
  assert.deepEqual(groups.map(group => group.count), [1, 1]);
  assert.equal(groups[1].context.dialogueId, dialogueId);
  assert.equal(conversationProjection(project, groups[0].context).rows.length, 1);
  assert.equal(conversationProjection(project, groups[1].context).rows[0].id, nested);
  const updated = updateConversationText(project, groups[1].context, nested, 'Edited from parent', 'und');
  assert.equal(conversationProjection(updated, context).rows[0].block.content, 'Edited from parent');
  assert.equal(conversationProjection(snapshot, context).rows[0].block.content, 'Child line');
  assert.equal(updated.events[0].dialogueBeats.length, 1);
  assert.equal(updated.events[0].dialogues[0].beats.length, 1);
  const reopened = parseProject(serializeProject(updated));
  assert.deepEqual(conversationGroups(reopened, eventId), conversationGroups(updated, eventId));
  const exportedBefore = JSON.stringify(exportRuntimePackage(updated));
  conversationGroups(updated, eventId);
  assert.equal(JSON.stringify(exportRuntimePackage(updated)), exportedBefore);
  assert.deepEqual(conversationGroups(updated, 'missing'), []);
});
function playback(project) {
  const output = [], visited = [];
  let run = createAuthoringSession(project);
  for (let i = 0; i < 30 && run.status === 'ready'; i++) { if (run.view.text !== undefined) output.push(run.view.text); visited.push(run.nodeId); run = authoringCommand(project, run, { type: 'continue' }); }
  assert.equal(run.status, 'ended', run.message);
  return { output, visited };
}

test('one row is one node, splice/reorder/delete preserve identities, metadata and existing canvas geometry', () => {
  let project = fixture(), a, b, c, inserted;
  [project, a] = add(project, 'speech', 'Hello', context, { speakerRef: 'alice', variantId: 'rain' });
  [project, b] = add(project, 'direction', 'The lantern falls.');
  [project, c] = add(project, 'speech', 'Stay here.');
  const rows = conversationProjection(project, context).rows;
  project = updateEventDialogueBeat(project, eventId, rows[1].elementId, { directorNote: 'Quietly', sceneImage: { id: 'cue', assetId: 'lantern' }, locationRef: 'hall', consequences: [{ type: 'setVariable', name: 'signal', value: true }] }).project;
  project = updateConversationText(project, context, b, 'La linterna cae.', 'es');
  project.canvas = { scopes: { [`event:${eventId}`]: { positions: { [a]: { x: 200, y: 300 }, [b]: { x: 650, y: 300 } }, exitSlots: ['exit'] } } };
  const snapshot = structuredClone(project), originalRoutes = project.events[0].transitions.map(route => route.id);
  const moved = moveConversationLine(project, context, b, -1);
  assert.notEqual(moved.project, project); project = moved.project;
  assert.deepEqual(conversationProjection(project, context).rows.map(row => row.id), [b, a, c]);
  assert.deepEqual(project.canvas, snapshot.canvas);
  assert.deepEqual(project.events[0].transitions.map(route => route.id), originalRoutes);
  assert.deepEqual(playback(project).output, ['The lantern falls.', 'Hello', 'Stay here.']);
  assert.deepEqual(conversationProjection(project, context).rows[0].beat, snapshot.events[0].dialogueBeats[1]);
  assert.deepEqual(snapshot.events[0].dialogueBeats.map(beat => beat.id), rows.map(row => row.elementId), 'Undo snapshots remain unchanged.');
  [project, inserted] = add(project, 'direction', 'Thunder.', context, { beforeId: a });
  assert.deepEqual(playback(project).output, ['The lantern falls.', 'Thunder.', 'Hello', 'Stay here.']);
  const removed = removeConversationLine(project, context, inserted); project = removed.project;
  assert.deepEqual(playback(project).output, ['The lantern falls.', 'Hello', 'Stay here.']);
  assert.ok(!project.events[0].transitions.some(route => route.from === inserted || route.to === inserted));
  assert.equal(conversationProjection(project, context).rows.find(row => row.id === a).block.characterVariantId, 'rain');
  assert.ok(project.events[0].presentEntityRefs.includes('alice'));
});

test('save/reopen, EVPATH and enhanced runtime export execute the authored line order', () => {
  let project = fixture(), first, action, last;
  [project, first] = add(project, 'speech', 'One\nTwo', context, { speakerRef: 'alice' });
  [project, action] = add(project, 'direction', 'Rain.'); [project, last] = add(project, 'speech', 'Goodbye.');
  project = moveConversationLine(project, context, last, -1).project;
  const expected = playback(project).output;
  const reopened = parseProject(serializeProject(project));
  assert.deepEqual(playback(reopened).output, expected);
  const evpath = serializeEventEvpath(project, eventId), applied = applyEvpathToEvent(project, eventId, evpath);
  assert.equal(applied.errors.length, 0); assert.deepEqual(playback(applied.project).output, expected);
  const runtime = exportRuntimePackage(project);
  const exported = normalizeProject({ ...runtime.pathBranching, specVersion: runtime.specVersion, projectId: runtime.packageId, canonRefs: runtime.canonRefs, variables: runtime.variables });
  assert.deepEqual(playback(exported).output, expected);
  assert.deepEqual(conversationProjection(reopened, context).rows.map(row => row.id), [first, last, action]);
  for (const key of ['conversation', 'conversationPreferences', 'drafts', 'panels', 'canvas']) assert.equal(key in runtime.pathBranching, false);
});

test('Dialogue container entry and members survive moving and deleting its first line', () => {
  const container = insertNarrativeBlock(fixture(), eventId, 'dialogue');
  const scope = { eventId, dialogueId: container.project.events[0].dialogues[0].id };
  let project = container.project, a, b, c;
  [project, a] = add(project, 'speech', 'A', scope); [project, b] = add(project, 'direction', 'B', scope); [project, c] = add(project, 'speech', 'C', scope);
  const snapshot = structuredClone(project);
  project = moveConversationLine(project, scope, c, -2).project;
  assert.deepEqual(playback(project).output, ['C', 'A', 'B']);
  const rows = conversationProjection(project, scope).rows;
  assert.equal(project.events[0].dialogues[0].entryBeatId, rows[0].elementId);
  assert.deepEqual(project.events[0].dialogues[0].members.map(member => member.id), rows.map(row => row.elementId));
  project = removeConversationLine(project, scope, c).project;
  assert.deepEqual(playback(project).output, ['A', 'B']);
  assert.equal(project.events[0].dialogues[0].entryBeatId, conversationProjection(project, scope).rows[0].elementId);
  assert.equal(snapshot.events[0].dialogues[0].entryBeatId, conversationProjection(snapshot, scope).rows[0].elementId);
  project = removeConversationLine(project, scope, a).project; project = removeConversationLine(project, scope, b).project;
  assert.equal(project.events[0].dialogues[0].beats.length, 0);
  assert.equal(project.events[0].dialogues[0].entryBeatId, undefined);
});

test('branch, cycle, route logic and external target protection cannot flatten existing topology', () => {
  let base = fixture(), a, b, c;
  [base, a] = add(base, 'speech', 'A'); [base, b] = add(base, 'speech', 'B'); [base, c] = add(base, 'speech', 'C');
  for (const [reason, change] of [
    ['branch', project => createInternalTransition(project, eventId, a, c).project],
    ['cycle', project => createInternalTransition(project, eventId, c, a).project],
    ['route-logic', project => updateTransition(project, narrativeConnections(project, eventId, a).outgoing[0].id, { conditions: { type: 'variable', name: 'key', operator: '==', value: true } }).project],
    ['external-entry', project => ({ ...project, authoringScenarios: [{ id: 'start-at-b', name: 'B', startNodeId: b }] })],
    ['external-entry', project => ({ ...project, narrativeActions: [{ id: 'jump', name: 'Jump', effects: [], targetNodeId: b }] })],
  ]) {
    const project = change(structuredClone(base)), protectedRow = conversationProjection(project, context).rows.find(row => row.id === (reason === 'external-entry' ? b : a));
    assert.ok(protectedRow.restrictions.includes(reason), reason);
    assert.equal(removeConversationLine(project, context, protectedRow.id).project, project, reason);
    assert.equal(moveConversationLine(project, context, protectedRow.id, 1).project, project, reason);
    assert.equal(insertConversationLine(project, context, 'speech', { beforeId: protectedRow.id }).project, project, reason);
  }
  const branch = createInternalTransition(structuredClone(base), eventId, a, c).project;
  assert.equal(insertConversationLine(branch, context, 'speech', { afterId: a }).project, branch);
  assert.equal(insertConversationLine(branch, context, 'speech').project, branch);
  assert.deepEqual(playback(base).output, ['A', 'B', 'C']);
});

test('a safe segment after a decision can be reordered without changing the decision or other branch', () => {
  let project = fixture(), a, b, c;
  [project, a] = add(project, 'speech', 'A'); [project, b] = add(project, 'speech', 'B'); [project, c] = add(project, 'speech', 'C');
  const decision = insertNarrativeBlock(project, eventId, 'decision', { afterNodeId: a }); project = decision.project;
  const snapshot = structuredClone(project), rows = conversationProjection(project, context).rows;
  assert.equal(rows.find(row => row.id === b).canMoveDown, true);
  project = moveConversationLine(project, context, c, -1).project;
  assert.deepEqual(project.events[0].decisions, snapshot.events[0].decisions);
  assert.equal(project.events[0].transitions.find(route => route.from === a).to, decision.selection.id);
  assert.equal(project.events[0].transitions.find(route => route.from === decision.selection.id).to, c);
});

test('cross-container continuations protect both endpoints instead of silently changing their scope', () => {
  let project = fixture(), direct;
  [project, direct] = add(project, 'speech', 'Direct');
  const container = insertNarrativeBlock(project, eventId, 'dialogue', { afterNodeId: direct }); project = container.project;
  const scope = { eventId, dialogueId: project.events[0].dialogues[0].id };
  let grouped; [project, grouped] = add(project, 'speech', 'Grouped', scope);
  project = createInternalTransition(project, eventId, direct, grouped).project;
  const row = conversationProjection(project, scope).rows[0];
  assert.ok(row.restrictions.includes('external-entry'));
  assert.equal(removeConversationLine(project, scope, grouped).project, project);
  assert.equal(insertConversationLine(project, scope, 'speech', { beforeId: grouped }).project, project);
});

test('an implicit named dialogue entry into the middle of a chain remains protected', () => {
  const container = insertNarrativeBlock(fixture(), eventId, 'dialogue'), scope = { eventId, dialogueId: container.project.events[0].dialogues[0].id };
  let project = container.project, a, b, c;
  [project, a] = add(project, 'speech', 'A', scope); [project, b] = add(project, 'speech', 'B', scope); [project, c] = add(project, 'speech', 'C', scope);
  project = updateDialogue(project, eventId, scope.dialogueId, { entryBeatId: conversationProjection(project, scope).rows.find(row => row.id === b).elementId }).project;
  assert.deepEqual(playback(project).output, ['B', 'C']);
  assert.ok(conversationProjection(project, scope).rows.find(row => row.id === b).restrictions.includes('external-entry'));
  assert.equal(moveConversationLine(project, scope, b, -1).project, project);
  assert.equal(removeConversationLine(project, scope, b).project, project);
});

test('shared blocks require explicit independence and preserve every locale and unaffected use', () => {
  let project = fixture(), a, b;
  [project, a] = add(project, 'speech', 'Shared', context, { speakerRef: 'alice' }); [project, b] = add(project, 'speech', 'Other');
  let rows = conversationProjection(project, context).rows;
  project = updateConversationText(project, context, a, 'Compartido', 'es');
  project = updateEventDialogueBeat(project, eventId, rows[1].elementId, { blockRef: rows[0].beat.blockRef }).project;
  assert.equal(updateConversationText(project, context, b, 'Wrong', 'und'), project);
  assert.equal(updateConversationSpeaker(project, context, b, undefined), project);
  const original = structuredClone(project), independent = makeConversationLineIndependent(project, context, b); project = independent.project;
  rows = conversationProjection(project, context).rows;
  assert.notEqual(rows[0].beat.blockRef.blockId, rows[1].beat.blockRef.blockId);
  assert.deepEqual(project.localizationCatalog.entries[rows[0].block.textKey], project.localizationCatalog.entries[rows[1].block.textKey]);
  project = updateConversationText(project, context, b, 'Independent', 'und');
  assert.equal(conversationProjection(project, context).rows[0].block.content, 'Shared');
  assert.equal(conversationProjection(project, context).rows[1].block.content, 'Independent');
  assert.deepEqual(playback(original).output, ['Shared', 'Shared']);
  project = removeConversationLine(original, context, b).project;
  assert.equal(conversationProjection(project, context).rows[0].block.content, 'Shared');
});

test('legacy conversion is explicit, lossless and undoable; local speakers never mutate canon', () => {
  const container = insertNarrativeBlock(fixture(), eventId, 'dialogue'), dialogueId = container.project.events[0].dialogues[0].id, scope = { eventId, dialogueId };
  let project = updateDialogue(container.project, eventId, dialogueId, { text: { format: 'markdown', content: '**Listen.**\nWait.' }, speakerRef: 'alice' }).project;
  const original = structuredClone(project), sourceProse = project.events[0].dialogues[0].text;
  assert.equal(insertConversationLine(project, scope, 'speech', { text: 'New' }).project, project);
  project = convertLegacyConversationText(project, scope).project;
  assert.equal(project.events[0].dialogues[0].text.content, '');
  assert.equal(conversationProjection(project, scope).rows[0].block.content, sourceProse.content);
  assert.equal(conversationProjection(project, scope).rows[0].block.characterRef, 'alice');
  assert.deepEqual(playback(project).output, playback(original).output);
  assert.equal(original.events[0].dialogues[0].text.content, sourceProse.content, 'Undo restores the exact previous prose.');
  const canon = structuredClone(project.canonRefs), created = createConversationSpeaker(project, scope, 'New character'); project = created.project;
  assert.deepEqual(project.canonRefs, canon);
  assert.ok(project.events[0].dialogues[0].presentEntityRefs.includes(created.selection.id));
  const row = conversationProjection(project, scope).rows[0];
  project = updateConversationSpeaker(project, scope, row.id, undefined);
  assert.equal(conversationProjection(project, scope).rows[0].block.characterRef, undefined, 'Narrator remains distinct from a direction.');
  assert.equal(conversationProjection(project, scope).rows[0].kind, 'speech');
});

test('pending composer is a recoverable manual draft and blocks universe switching without committing or discarding', async () => {
  const key = authoringDraftKey('conversation-fixture', eventId, 'conversation-composer:und'), original = fixture();
  setAuthoringDraft(key, 'A line still being written');
  let writes = 0, reason;
  const allowed = await guardUniverseSwitch({ state: () => ({ hasDrafts: authoringDraftCount('conversation-fixture') > 0, hasPendingSave: false, saveBlocked: false }), flush: async () => { writes++; }, report: value => { reason = value; } });
  assert.equal(allowed, false); assert.equal(reason, 'drafts'); assert.equal(writes, 1);
  assert.equal(getAuthoringDraft(key), 'A line still being written'); assert.equal(original.events[0].dialogueBeats?.length ?? 0, 0);
  setAuthoringDraft(key, undefined);
  assert.equal(await guardUniverseSwitch({ state: () => ({ hasDrafts: false, hasPendingSave: false, saveBlocked: false }), flush: async () => {}, report: () => {} }), true);
});


test('drag edges insert before or after the target without losing dialogue text or routes', () => {
  let original = fixture();
  for (const text of ['First', 'Second', 'Third', 'Fourth']) [original] = add(original, 'speech', text);
  const ids = conversationProjection(original, context).rows.map(row => row.id);
  const routes = original.events[0].transitions.map(route => route.id).sort();
  for (const from of ids) for (const target of ids) for (const edge of ['before', 'after']) {
    const expected = [...ids];
    if (from !== target) {
      expected.splice(expected.indexOf(from), 1);
      expected.splice(expected.indexOf(target) + (edge === 'after' ? 1 : 0), 0, from);
    }
    const offset = conversationDropOffset(ids, from, target, edge);
    const moved = offset ? moveConversationLine(original, context, from, offset).project : original;
    assert.deepEqual(conversationProjection(moved, context).rows.map(row => row.id), expected);
    assert.deepEqual(moved.events[0].transitions.map(route => route.id).sort(), routes);
    assert.deepEqual(moved.scriptDocuments, original.scriptDocuments);
  }
  assert.equal(conversationDropOffset(ids, 'missing', ids[0], 'before'), 0);
});


test('deleting a conversation removes its lines and input/output routes while retaining unrelated content and shared scripts', () => {
  let project = fixture(), loose;
  [project, loose] = add(project, 'speech', 'Keep this line');
  project = insertNarrativeBlock(project, eventId, 'dialogue', { afterNodeId: loose }).project;
  const dialogueId = project.events[0].dialogues[0].id;
  const scope = { eventId, dialogueId };
  let first, second;
  [project, first] = add(project, 'speech', 'First conversation line', scope);
  [project, second] = add(project, 'speech', 'Second conversation line', scope);
  const scripts = project.scriptDocuments;
  const deleted = deleteDialogue(project, eventId, dialogueId).project;
  assert.equal(deleted.events[0].dialogues.length, 0);
  assert.deepEqual(conversationProjection(deleted, context).rows.map(row => row.id), [loose]);
  assert.ok(!deleted.events[0].transitions.some(route => [route.from, route.to].some(id => id === first || id === second || id.includes(`:${dialogueId}:`) || id === `dialogue:${eventId}:${dialogueId}`)));
  assert.deepEqual(deleted.scriptDocuments, scripts);
});


test('selected narrative options follow actual graph destinations without changing the document', () => {
  let project=fixture(), first;
  [project,first]=add(project,'speech','Before choice');
  project=insertReadingDecision(project,context,first).project;
  const decision=project.events[0].decisions[0], key=`decision:${eventId}:${decision.id}`;
  assert.equal(decision.outcomes.length,2);
  const destinations=[];
  for(const option of decision.outcomes){
    const result=insertNarrativeBlock(project,eventId,'dialogue',{afterNodeId:`outcome:${eventId}:${decision.id}:${option.id}`});
    project=result.project;destinations.push(result.selection.id);
  }
  const before=serializeProject(project);
  assert.deepEqual(narrativeReadingPath(project,context,{}).nodes.map(node=>node.id),[first,key]);
  for(let i=0;i<2;i++)assert.deepEqual(narrativeReadingPath(project,context,{[key]:decision.outcomes[i].id}).nodes.map(node=>node.id),[first,key,destinations[i]]);
  assert.equal(serializeProject(project),before);
  const reopened=parseProject(before);
  assert.deepEqual(narrativeReadingPath(reopened,context,{[key]:decision.outcomes[1].id}).nodes.map(node=>node.id),[first,key,destinations[1]]);
});

test('decision insertion retains prior continuation and route metadata on its first option', () => {
  let project=fixture(), first,second;
  [project,first]=add(project,'speech','Before');[project,second]=add(project,'speech','After');
  const original=project.events[0].transitions.find(route=>route.from===first && route.to===second);
  const result=insertReadingDecision(project,context,first);project=result.project;
  const decision=project.events[0].decisions[0], key=`decision:${eventId}:${decision.id}`;
  assert.ok(project.events[0].transitions.some(route=>route.id===original.id && route.from===first && route.to===key));
  assert.deepEqual(narrativeReadingPath(project,context,{[key]:decision.outcomes[0].id}).nodes.map(node=>node.id),[first,key,second]);
  assert.deepEqual(narrativeReadingPath(project,context,{[key]:decision.outcomes[1].id}).nodes.map(node=>node.id),[first,key]);
  assert.equal(insertReadingDecision(project,context).project,project);
});

test('a selected narrative route reveals its matching next conversation', () => {
  let project=fixture();
  const current=insertNarrativeBlock(project,eventId,'dialogue');project=current.project;
  const first=insertNarrativeBlock(project,eventId,'dialogue');project=first.project;
  const second=insertNarrativeBlock(project,eventId,'dialogue');project=second.project;
  project=createInternalTransition(project,eventId,current.selection.id,first.selection.id).project;
  project=createInternalTransition(project,eventId,current.selection.id,second.selection.id).project;
  const pending=narrativeReadingPath(project,context,{});
  assert.equal(pending.stopped?.reason,'routes');
  const outgoing=project.events[0].transitions.filter(item=>item.from===current.selection.id);
  assert.deepEqual(pending.stopped?.destinations?.map(item=>item.id),outgoing.map(item=>item.id));
  const route=outgoing.find(item=>item.to===second.selection.id);
  assert.ok(route);
  assert.deepEqual(narrativeReadingPath(project,context,{[`route:${current.selection.id}`]:route.id}).nodes.map(node=>node.id),[current.selection.id,second.selection.id]);
});

test('a choice within a conversation pauses its parent continuation and displays only the selected dialogue branch', () => {
  let project=fixture();
  const group=insertNarrativeBlock(project,eventId,'dialogue');project=group.project;
  const dialogueId=project.events[0].dialogues[0].id, scope={eventId,dialogueId};
  let first;
  [project,first]=add(project,'speech','Before the choice',scope);
  project=insertReadingDecision(project,scope,first).project;
  const decision=project.events[0].decisions[0],key=`decision:${eventId}:${decision.id}`;
  const branch=insertNarrativeBlock(project,eventId,'speech',{dialogueId,afterNodeId:`outcome:${eventId}:${decision.id}:${decision.outcomes[1].id}`});project=branch.project;
  const next=insertNarrativeBlock(project,eventId,'dialogue',{afterNodeId:group.selection.id});project=next.project;
  assert.equal(narrativeReadingPath(project,context,{}).stopped.reason,'choice');
  assert.deepEqual(narrativeReadingPath(project,context,{}).nodes.map(node=>node.id),[group.selection.id]);
  assert.deepEqual(narrativeReadingPath(project,scope,{[key]:decision.outcomes[1].id}).nodes.map(node=>node.id),[first,key,branch.selection.id]);
  assert.deepEqual(narrativeReadingPath(project,context,{[key]:decision.outcomes[1].id}).nodes.map(node=>node.id),[group.selection.id,next.selection.id]);
});

test('timeline insertion at the beginning and between lines retains the explicit route and text', () => {
  let project=fixture(),first,second;
  [project,first]=add(project,'speech','First');[project,second]=add(project,'speech','Second');
  const ahead=insertConversationLine(project,context,'direction',{beforeId:first,text:'Ahead'});project=ahead.project;
  const middle=insertConversationLine(project,context,'direction',{afterId:first,beforeId:second,text:'Between'});project=middle.project;
  assert.deepEqual(narrativeReadingPath(project,context,{}).nodes.map(node=>node.id),[ahead.selection.id,first,middle.selection.id,second]);
  const decision=insertReadingDecision(project,context,undefined,ahead.selection.id);
  assert.equal(narrativeReadingPath(decision.project,context,{}).nodes[0].kind,'decision');
  assert.deepEqual(conversationProjection(project,context).rows.map(row=>row.block.content),['Ahead','First','Between','Second']);
});

test('finishing a conversation connects existing or new parent narrative items and survives reopen', () => {
  let base=fixture();const group=insertNarrativeBlock(base,eventId,'dialogue');base=group.project;
  const dialogueId=base.events[0].dialogues[0].id;let first;
  [base,first]=add(base,'speech','Keep this text',{eventId,dialogueId});
  for(const kind of ['dialogue','decision','subevent']) {
    const created=finishReadingConversation(base,eventId,dialogueId,{kind});
    assert.notEqual(created.project,base);
    const route=created.project.events[0].transitions.find(route=>route.from===group.selection.id);
    assert.ok(route);
    if(kind==='subevent')assert.ok(created.project.events.some(child=>child.id===route.to && child.parentEventId===eventId));
    const reopened=parseProject(serializeProject(created.project));
    assert.equal(conversationProjection(reopened,{eventId,dialogueId}).rows[0].block.content,'Keep this text');
    // Reconnecting the existing destination preserves its route identity.
    const reconnected=finishReadingConversation(reopened,eventId,dialogueId,{kind,id:route.to});
    assert.equal(reconnected.project.events[0].transitions.find(item=>item.from===group.selection.id).id,route.id);
  }
  const external=finishReadingConversation(base,eventId,dialogueId,{kind:'subevent',id:'missing'});
  assert.equal(external.project,base);
});

test('finishing cannot bypass a pending internal decision', () => {
  let project=fixture();const group=insertNarrativeBlock(project,eventId,'dialogue');project=group.project;
  const dialogueId=project.events[0].dialogues[0].id;let first;
  [project,first]=add(project,'speech','Choice follows',{eventId,dialogueId});
  project=insertReadingDecision(project,{eventId,dialogueId},first).project;
  assert.equal(finishReadingConversation(project,eventId,dialogueId,{kind:'dialogue'}).project,project);
});

test('a decision inserted before the first conversation line also becomes its execution entry', () => {
  let project=fixture();const group=insertNarrativeBlock(project,eventId,'dialogue');project=group.project;
  const dialogueId=project.events[0].dialogues[0].id;let first;
  [project,first]=add(project,'speech','First dialogue line',{eventId,dialogueId});
  project=insertReadingDecision(project,{eventId,dialogueId},undefined,first).project;
  assert.equal(project.events[0].dialogues[0].entryBeatId,undefined);
  let session=createAuthoringSession(project,undefined,group.selection.id);
  for(let i=0;i<5 && session.status==='ready' && !session.view.choices.length;i++)session=authoringCommand(project,session,{type:'continue'});
  assert.equal(session.view.choices.length,2);
  assert.equal(session.nodeId,narrativeReadingPath(project,{eventId,dialogueId},{}).nodes[0].id);
});

test('removing and replacing a declared conversation transition keeps the decision and all dialogue content', () => {
  let project=fixture();const group=insertNarrativeBlock(project,eventId,'dialogue');project=group.project;
  const dialogueId=project.events[0].dialogues[0].id;let first;
  [project,first]=add(project,'speech','Preserve this line',{eventId,dialogueId});
  project=finishReadingConversation(project,eventId,dialogueId,{kind:'decision'}).project;
  const scripts=project.scriptDocuments,decisions=project.events[0].decisions;
  const removed=clearConversationContinuation(project,eventId,dialogueId).project;
  assert.ok(!removed.events[0].transitions.some(route=>route.from===group.selection.id));
  assert.deepEqual(removed.events[0].decisions,decisions);
  assert.deepEqual(removed.scriptDocuments,scripts);
  const replaced=finishReadingConversation(removed,eventId,dialogueId,{kind:'dialogue'}).project;
  const route=replaced.events[0].transitions.find(route=>route.from===group.selection.id);
  assert.ok(route.to.startsWith(`dialogue:${eventId}:`));
  assert.deepEqual(replaced.events[0].decisions,decisions);
  assert.equal(conversationProjection(parseProject(serializeProject(replaced)),{eventId,dialogueId}).rows[0].block.content,'Preserve this line');
});
