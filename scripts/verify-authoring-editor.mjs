import assert from "node:assert/strict";
import { orderedMomentEffects, splitNarrativeEffects } from "../lib/logic.js";
import { createAuthoringSession } from "../lib/authoringEngine.js";
import { normalizeProject } from "../lib/projectSerialization.js";
import { authoringUsagePresentation } from "../lib/diagnosticPresentation.js";
import { createInternalTransition, updateDialogueBeat, updateOutcome, updateTransition } from "../lib/projectMutations.js";
import { addNarrativeResponse, authoringNodeOptions, connectNarrativeContinuation, endNarrativeContinuation, insertNarrativeBlock, narrativeConnections, narrativeNodeReferences, narrativeScopeNodes, setNarrativeNodeEffects, setNarrativeRouteEffects, updateNarrativeRoute, updateNarrativeSpeaker, updateNarrativeText } from "../lib/authoringMutations.js";

const eventId = "event:editing";
const fixture = () => normalizeProject({
  specVersion: "0.1", projectId: "story:editor-tests", name: "Editor tests",
  entrySequenceId: "sequence:main", sequences: [{ id: "sequence:main", name: "Main", entryEventId: eventId, eventIds: [eventId], branchIds: [] }],
  branches: [], events: [{ id: eventId, name: "Editing", type: "normal", dialogueBeats: [] }], canonRefs: [], scripts: [], externalFunctions: [], variables: {},
});
const nodeId = result => { assert.equal(result.selection?.type, "node"); return result.selection.id; };
{
  const project = fixture();
  project.localExplorerEntities = [{ id: "key", name: "Key", type: "item", properties: { wear: 0 } }];
  project.localExplorerProperties = [{ id: "wear", label: "Wear", valueType: "number" }];
  project.logicPropertyOverrides = [{ propertyId: "wear", source: "local", actionWritable: true, conditionReadable: true }];
  const effects = [
    { type: "instanceEffect", operation: "create", instanceId: "generated", entityId: "key", properties: { wear: 1 } },
    { type: "property", subject: { kind: "instance", instanceId: "generated" }, propertyId: "wear", operation: "set", value: 3 },
  ];
  project.events[0].logic = splitNarrativeEffects(effects);
  const reopened = normalizeProject(project);
  assert.deepEqual(orderedMomentEffects(reopened.events[0].logic), effects, "Reopen must preserve interleaved copy and ordinary effect order.");
  const run = createAuthoringSession(reopened);
  assert.notEqual(run.status, "blocked", run.message);
  assert.equal(run.state.entityInstances[0].properties.wear, 3, "The generated copy must exist before its property effect executes.");
}
let checks = 1;

// Direct graph editing must wire an empty scope, then splice content without losing the gate.
let project = fixture();
const first = insertNarrativeBlock(project, eventId, "speech");
project = first.project;
const firstId = nodeId(first);
assert.equal(narrativeConnections(project, eventId, firstId).incoming[0].from, `boundary:${eventId}:input:entry`);
const second = insertNarrativeBlock(project, eventId, "speech", { afterNodeId: firstId });
project = second.project;
const secondId = nodeId(second);
const originalRoute = narrativeConnections(project, eventId, firstId).outgoing[0];
const condition = { type: "variable", name: "strength", operator: ">=", value: 5 };
const consequence = { type: "value", subject: { kind: "variable", variableId: "visited" }, operation: "set", value: true };
project = updateTransition(project, originalRoute.id, { conditions: condition, consequences: [consequence] }).project;
const beforeInsert = structuredClone(project);
const inserted = insertNarrativeBlock(project, eventId, "direction", { afterNodeId: firstId, beforeNodeId: secondId });
project = inserted.project;
const insertedId = nodeId(inserted);
const preservedRoute = narrativeConnections(project, eventId, firstId).outgoing[0];
assert.equal(preservedRoute.id, originalRoute.id);
assert.equal(preservedRoute.to, insertedId);
assert.deepEqual(preservedRoute.conditions, beforeInsert.events[0].transitions.find(route => route.id === originalRoute.id).conditions);
assert.deepEqual(preservedRoute.consequences, [consequence]);
assert.equal(narrativeConnections(project, eventId, insertedId).outgoing[0].to, secondId);
assert.deepEqual(narrativeScopeNodes(project, eventId).map(node => node.id), [firstId, insertedId, secondId]);
assert.equal(beforeInsert.events[0].dialogueBeats.length, 2, "Structural changes must not mutate the snapshot used by Undo.");
checks++;

// Every answer keeps its own identity; converging and returning never clone content.
const decisionResult = insertNarrativeBlock(project, eventId, "decision", { afterNodeId: secondId });
project = decisionResult.project;
const decisionId = project.events[0].decisions[0].id;
const responseA = addNarrativeResponse(project, eventId, decisionId);
project = responseA.project;
const responseB = addNarrativeResponse(project, eventId, decisionId);
project = responseB.project;
project = connectNarrativeContinuation(project, eventId, nodeId(responseA), firstId).project;
project = connectNarrativeContinuation(project, eventId, nodeId(responseB), firstId).project;
assert.equal(project.events[0].dialogueBeats.length, 3);
assert.equal(narrativeConnections(project, eventId, firstId).incoming.length, 3);
assert.equal(new Set(narrativeScopeNodes(project, eventId).map(node => node.id)).size, 4);
assert.equal(project.events[0].decisions[0].outcomes[0].unavailableBehavior, "locked");
checks++;

// Multiple exits require an explicit splice target, while adding a new branch preserves all exits.
project = createInternalTransition(project, eventId, firstId, nodeId(decisionResult)).project;
const branchCount = narrativeConnections(project, eventId, firstId).outgoing.length;
const ambiguousInsert = insertNarrativeBlock(project, eventId, "speech", { afterNodeId: firstId });
assert.equal(ambiguousInsert.project, project);
assert.match(ambiguousInsert.message, /several continuations/);
const alternative = insertNarrativeBlock(project, eventId, "speech", { afterNodeId: firstId, asAlternative: true });
assert.equal(narrativeConnections(alternative.project, eventId, firstId).outgoing.length, branchCount + 1);
project = alternative.project;
checks++;

// A first grouped beat must target the actual dialogue boundary; endings use its output.
const container = insertNarrativeBlock(fixture(), eventId, "dialogue");
const dialogueId = container.project.events[0].dialogues[0].id;
const groupedBeat = insertNarrativeBlock(container.project, eventId, "speech", { dialogueId, speakerRef: "character:ada" });
const groupedBeatRef = narrativeNodeReferences(groupedBeat.project, eventId).find(node => node.id === nodeId(groupedBeat));
assert.equal(groupedBeatRef.block.characterRef, "character:ada");
assert.equal(narrativeConnections(groupedBeat.project, eventId, nodeId(groupedBeat)).incoming[0].from, `dialogue-boundary:${eventId}:${dialogueId}:input`);
const ended = endNarrativeContinuation(groupedBeat.project, eventId, nodeId(groupedBeat), dialogueId);
assert.equal(narrativeConnections(ended.project, eventId, nodeId(groupedBeat)).outgoing[0].to, `dialogue-boundary:${eventId}:${dialogueId}:output`);
const endedEvent = endNarrativeContinuation(project, eventId, nodeId(alternative));
assert.ok(endedEvent.project.canvas.scopes[`event:${eventId}`].exitSlots.includes("exit"));
checks++;

// Continuous edits preserve text keys, other locales, beat attachments and speaker aliases.
let textProject = updateNarrativeText(groupedBeat.project, eventId, groupedBeatRef.elementId, "Hello", "und");
textProject = updateNarrativeText(textProject, eventId, groupedBeatRef.elementId, "Hola", "es");
textProject = updateNarrativeText(textProject, eventId, groupedBeatRef.elementId, "Welcome", "und");
let textRef = narrativeNodeReferences(textProject, eventId).find(node => node.id === nodeId(groupedBeat));
assert.equal(textRef.block.content, "Welcome");
assert.equal(textRef.block.translations.es, "Hola");
assert.equal(textRef.beat.id, groupedBeatRef.beat.id);
assert.equal(textRef.block.id, groupedBeatRef.block.id);
textProject = updateNarrativeSpeaker(textProject, eventId, textRef.elementId, "character:bob");
textRef = narrativeNodeReferences(textProject, eventId).find(node => node.id === nodeId(groupedBeat));
assert.equal(textRef.block.characterRef, "character:bob");
assert.equal(textRef.block.speakerRef, "character:bob");
assert.equal(authoringNodeOptions(textProject).find(node => node.id === textRef.id).dialogueId, dialogueId);
checks++;

// Updating route effects must update authoritative logic.then, not a stale legacy mirror only.
const routeId = narrativeConnections(textProject, eventId, textRef.id).incoming[0].id;
textProject = updateNarrativeRoute(textProject, eventId, routeId, { consequences: [consequence] });
assert.deepEqual(textProject.events[0].transitions.find(route => route.id === routeId).logic.then, [consequence]);
checks++;

// Copy effects and repeat settings survive ordinary text edits and preserve the condition gate.
const gate = { type: "value", subject: { kind: "variable", variableId: "strength" }, operator: ">=", value: 5 };
const copyEffect = { type: "instanceEffect", operation: "create", entityId: "item:key", owner: { kind: "profile", profileId: "player:main" }, properties: { wear: 0 } };
textProject = updateDialogueBeat(textProject, eventId, dialogueId, textRef.elementId, { logic: { when: gate, repeat: "each-entry" } }).project;
textProject = setNarrativeNodeEffects(textProject, eventId, textRef.id, [consequence, copyEffect]);
textProject = updateNarrativeText(textProject, eventId, textRef.elementId, "Safe edit", "und");
const withEffects = narrativeNodeReferences(textProject, eventId).find(node => node.id === textRef.id).beat.logic;
assert.deepEqual(withEffects.when, gate);
assert.equal(withEffects.repeat, "each-entry");
assert.deepEqual(withEffects.then, [consequence]);
assert.deepEqual(withEffects.narrativeEffects, [copyEffect]);
textProject = updateTransition(textProject, routeId, { conditions: gate, logic: { when: gate, repeat: "each-entry" } }).project;
textProject = setNarrativeRouteEffects(textProject, eventId, routeId, [consequence, copyEffect]);
const routeWithEffects = textProject.events[0].transitions.find(route => route.id === routeId);
assert.deepEqual(routeWithEffects.logic.when, gate);
assert.equal(routeWithEffects.logic.repeat, "each-entry");
assert.deepEqual(routeWithEffects.logic.narrativeEffects, [copyEffect]);
const responseId = project.events[0].decisions[0].outcomes[0].id;
project = updateOutcome(project, eventId, decisionId, responseId, { conditions: gate, logic: { when: gate, repeat: "each-entry" } }).project;
project = setNarrativeNodeEffects(project, eventId, `outcome:${eventId}:${decisionId}:${responseId}`, [consequence, copyEffect]);
const responseWithEffects = project.events[0].decisions[0].outcomes[0].logic;
assert.deepEqual(responseWithEffects.when, gate);
assert.equal(responseWithEffects.repeat, "each-entry");
assert.deepEqual(responseWithEffects.narrativeEffects, [copyEffect]);
checks++;

console.log(`Authoring editor: ${checks} regression scenarios passed.`);
const usage = authoringUsagePresentation(project, 'events.0.decisions.0.outcomes.0.conditions.all.0', 'es');
assert.equal(usage.nodeId, `outcome:${eventId}:${decisionId}:${responseId}`);
assert.ok(!usage.label.includes('events.0'), 'Usage navigation must show narrative names rather than object indices.');
const actionUsage = authoringUsagePresentation({...project, narrativeActions:[{id:'take',name:'Obtener',entityId:'item:key'}]}, 'narrativeActions.0.entityId', 'es');
assert.deepEqual(actionUsage.target, {tab:'actions',id:'take'});
const scenarioUsage = authoringUsagePresentation({...project,authoringScenarios:[{id:'prepared',name:'Prepared',state:{entityInstances:[{id:'key-copy',entityId:'item:key',name:'Key copy'}]}}]}, 'authoringScenarios.0.state.entityInstances.0.entityId', 'en');
assert.equal(scenarioUsage.scenarioId,'prepared','A scenario copy reference must locate its scenario rather than the initial project copy.');
console.log('Usage presentation: narrative owners and action navigation passed.');
