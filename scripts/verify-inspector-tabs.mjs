import assert from "node:assert/strict";
import { normalizeWorkspaceSession } from "../lib/workspaceSettings.js";
import { pruneEventInspectorTabGroups, saveEventInspectorTabGroup } from "../lib/eventInspectorState.js";
import { canvasInspectorTarget, closeInspectorStackTabs, inspectorStackCardHeight, inspectorStackKey, orderedInspectorStack } from "../lib/inspectorNavigation.js";
import { narrativeInspectorModules, resolveInspectorModulePreferences, readInspectorModulePreferences, saveInspectorModulePreferences } from '../lib/inspectorModules.js';
import { normalizeProject, serializeProject } from '../lib/projectSerialization.js';

const moduleDocument = normalizeProject({ specVersion: '0.1', projectId: 'module-check', sequences: [], branches: [], events: [{ id: 'empty', name: 'Empty', type: 'normal' }, { id: 'existing', name: 'Existing', type: 'normal', dialogues: [{ id: 'dialogue', title: 'Dialogue', text: { format: 'plain', content: 'Legacy prose' } }], consequences: [{ type: 'setVariable', name: 'flag', value: true }] }], canonRefs: [], scripts: [], externalFunctions: [], variables: {} });
const beforeModules = serializeProject(moduleDocument);
const portProject = normalizeProject({ ...moduleDocument, events: [
  { id: 'event:previous', name: 'Previous', type: 'normal', transitions: [{ id: 'route:incoming', from: 'dialogue:previous:closing', to: 'event:current' }] },
  { id: 'event:current', name: 'Current', type: 'normal', transitions: [{ id: 'route:outgoing', from: 'event:current', to: 'event:next' }] },
  { id: 'event:next', name: 'Next', type: 'normal' },
] });
const portNodes = [
  { id: 'entry', data: { kind: 'boundary', details: { eventId: 'event:current', direction: 'input', transitionId: 'route:incoming' } } },
  { id: 'exit', data: { kind: 'boundary', details: { eventId: 'event:current', direction: 'output', targetEventId: 'event:next' } } },
  { id: 'restart', data: { kind: 'boundary', details: { eventId: 'event:current', direction: 'output', targetEventId: 'event:current' } } },
  { id: 'sequence-entry', data: { kind: 'boundary', details: { eventId: 'event:current', direction: 'input' } } },
  { id: 'broken', data: { kind: 'boundary', details: { eventId: 'event:current', direction: 'output', targetEventId: 'missing' } } },
  { id: 'start:sequence', data: { kind: 'start' } },
];
for (const [id, eventId] of [['entry', 'event:previous'], ['exit', 'event:next'], ['restart', 'event:current'], ['sequence-entry', 'event:current']]) {
  assert.deepEqual(canvasInspectorTarget(portProject, { type: 'node', id }, portNodes), { type: 'node', id: eventId }, 'Inspect semantic event references even when route source is a nested object.');
}
assert.equal(canvasInspectorTarget(portProject, { type: 'edge', id: 'edge:transition:route:incoming' }, portNodes), undefined, 'Transition lines have no inspector.');
const optionProject = normalizeProject({ ...moduleDocument, events: [{id:'e',name:'E',type:'normal',decisions:[{id:'d',name:'Decisiones 1',type:'dialogue',outcomes:[{id:'a',name:'A',visibleText:'Open the door'},{id:'b',name:'B',visibleText:'Wait'}]}]}] });
const optionTarget = {type:'node',id:'outcome:e:d:a'};
assert.deepEqual(canvasInspectorTarget(optionProject, optionTarget, []), optionTarget, 'Options open their own inspector instead of redirecting to the decision.');
assert.deepEqual(narrativeInspectorModules(optionProject, optionTarget.id).map(module => module.id), ['content','conditions','consequences','interactions','connections']);
assert.deepEqual(narrativeInspectorModules(optionProject, 'decision:e:d').map(module => module.id), ['decisionSettings','narrativeDecision','connections']);
assert.equal(canvasInspectorTarget(portProject, { type: 'node', id: 'start:sequence' }, portNodes), undefined);
assert.equal(canvasInspectorTarget(portProject, { type: 'node', id: 'broken' }, portNodes), undefined, 'An unresolved reference must not silently inspect its owner.');
assert.deepEqual(canvasInspectorTarget(portProject, { type: 'node', id: 'event:current' }, portNodes), { type: 'node', id: 'event:current' });
const emptyModules = narrativeInspectorModules(moduleDocument, 'empty');
assert.equal(emptyModules.find(module => module.id === 'interactions')?.hasContent, false, 'An empty event offers Interaction without inventing document content.');
const interactionDocument = { ...moduleDocument, events: moduleDocument.events.map(event => event.id === 'existing' ? { ...event, interactionUses: [{ id: 'use', definitionId: 'definition', dialogueId: 'dialogue', moment: 'during' }] } : event) };
const interactionModules = narrativeInspectorModules(interactionDocument, 'existing');
assert.equal(interactionModules.find(module => module.id === 'interactions')?.hasContent, true);
assert.ok(resolveInspectorModulePreferences(interactionModules).visible.includes('interactions'), 'Existing interactions expose their dedicated section by default.');
assert.equal(narrativeInspectorModules(interactionDocument, 'dialogue:existing:dialogue').find(module => module.id === 'interactions')?.hasContent, true, 'A dialogue exposes interactions belonging to its scope.');
assert.deepEqual(narrativeInspectorModules(interactionDocument, 'interaction:existing:use').map(module => module.id), ['overview', 'consequences', 'connections'], 'An interaction node keeps configuration, result consequences and connections in separate inspector tabs.');
assert.deepEqual(resolveInspectorModulePreferences(emptyModules), { visible: ['overview', 'connections'], active: 'overview' });
const existingModules = narrativeInspectorModules(moduleDocument, 'existing');
assert.deepEqual(resolveInspectorModulePreferences(existingModules).visible, ['overview', 'connections', 'path']);
assert.equal(existingModules.some(module => module.id === 'decisions' || module.id === 'consequences'), false, 'Decision and consequence capabilities stay in their narrative context instead of becoming standalone sections.');
assert.deepEqual(resolveInspectorModulePreferences(existingModules, { visible: ['path', 'consequences', 'missing', 'path'], active: 'path' }), { visible: ['overview', 'connections', 'path'], active: 'path' }, 'Hidden content stays hidden, stale modules disappear, ordering remains stable.');
assert.deepEqual(resolveInspectorModulePreferences(existingModules, { visible: ['consequences'], active: 'consequences' }), { visible: ['overview', 'connections'], active: 'overview' }, 'Obsolete standalone consequence tabs fall back to the node overview.');
assert.equal(narrativeInspectorModules(moduleDocument, 'canon:unknown'), undefined);
const storageBeforeModules = globalThis.localStorage;
const moduleStorage = new Map();
globalThis.localStorage = { getItem: key => moduleStorage.get(key) ?? null, setItem: (key, value) => moduleStorage.set(key, value) };
saveInspectorModulePreferences('module-check', 'node:existing', { visible: ['overview', 'connections', 'consequences', 'path'], active: 'path' });
assert.deepEqual(readInspectorModulePreferences('module-check', 'node:existing'), { visible: ['overview', 'connections', 'consequences', 'path'], active: 'path' });
assert.equal(readInspectorModulePreferences('different-document', 'node:existing'), undefined);
assert.equal(readInspectorModulePreferences('module-check', 'node:empty'), undefined);
assert.equal(serializeProject(moduleDocument), beforeModules, 'Module preferences never mutate the narrative document or its serialized exports.');
globalThis.localStorage = storageBeforeModules;

assert.equal(inspectorStackCardHeight(900, 3), 440, "Normal cards retain their original height.");
assert.equal(inspectorStackCardHeight(600, 4), 414, "Other collapsed headers and the toolbar remain visible.");
assert.equal(inspectorStackCardHeight(900, 3, 440, true), 760, "Enlarged and fullscreen cards fill the space after reserving other tabs.");
assert.equal(inspectorStackCardHeight(300, 8), 240, "A crowded stack scrolls while keeping the editor usable.");
assert.equal(inspectorStackCardHeight(900, 3, 520), 520, "Manual card sizing remains independent of the collapsed headers.");

const session = normalizeWorkspaceSession({
  eventInspectorOpen: true,
  eventInspectorOpenEventIds: ["event:opening", "event:opening"],
  eventInspectorExpandedEventId: "event:opening",
  inspectorTabs: [
    {
      id: "canon:character:mara",
      title: "Mara",
      selection: { type: "canon", id: "character:mara" },
    },
    {
      id: "debug:active",
      title: "Debug",
      mode: "debug",
      selection: { type: "node", id: "event:opening" },
    },
  ],
  inspectorExpandedTabId: "canon:character:mara",
  inspectorMaximized: true,
  eventInspectorTabGroups: [
    {
      id: "mixed",
      name: "Opening reference",
      eventIds: ["event:opening"],
      inspectorTabs: [
        {
          id: "explorerEntity:item:token",
          title: "Signal Token",
          selection: { type: "explorerEntity", id: "item:token" },
        },
      ],
      inspectorExpandedTabId: "explorerEntity:item:token",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
});

assert.deepEqual(session.eventInspectorOpenEventIds, ["event:opening"]);
assert.equal(session.inspectorTabs?.[0]?.selection.type, "canon");
assert.equal(session.inspectorTabs?.[1]?.mode, "debug");
assert.equal(session.inspectorExpandedTabId, "canon:character:mara");
assert.equal(session.inspectorMaximized, true);
assert.equal(session.eventInspectorTabGroups?.[0]?.inspectorTabs?.[0]?.title, "Signal Token");
assert.equal(
  session.eventInspectorTabGroups?.[0]?.inspectorExpandedTabId,
  "explorerEntity:item:token",
);

const normalizedExclusiveExpansion = normalizeWorkspaceSession({
  eventInspectorOpenEventIds: ["event:opening"],
  eventInspectorExpandedEventId: "event:opening",
  inspectorTabs: [
    {
      id: "canon:character:mara",
      title: "Mara",
      selection: { type: "canon", id: "character:mara" },
    },
  ],
  inspectorExpandedTabId: "canon:character:mara",
});
assert.equal(normalizedExclusiveExpansion.eventInspectorExpandedEventId, undefined);
assert.equal(normalizedExclusiveExpansion.inspectorExpandedTabId, "canon:character:mara");

const genericOnlyGroup = saveEventInspectorTabGroup(
  { open: false, openEventIds: [], expandedEventId: undefined },
  "Canon review",
  [],
  42,
);
assert.ok(genericOnlyGroup.groupId);
assert.deepEqual(genericOnlyGroup.groups[0]?.eventIds, []);

const authoringTargets = [
  { type: "narrativeAction", id: "action:talk" },
  { type: "narrativeRule", id: "rule:discover" },
  { type: "entityInstance", id: "instance:token" },
  { type: "story", id: "story:sinpo" },
  { type: "storyDebug", id: "story:sinpo" },
];
const authoringTabs = authoringTargets.map((selection) => ({
  id: `${selection.type}:${selection.id}`,
  title: selection.type,
  selection,
  ...(selection.type === "storyDebug" ? { mode: "debug" } : {}),
}));

for (const selection of authoringTargets) {
  const restored = normalizeWorkspaceSession({
    selection,
    inspectorTabs: authoringTabs,
    inspectorExpandedTabId: `${selection.type}:${selection.id}`,
  });
  assert.deepEqual(restored.selection, selection, `${selection.type} must survive a workspace reopen.`);
  assert.deepEqual(restored.inspectorTabs.map((tab) => tab.selection), authoringTargets);
  assert.equal(restored.inspectorExpandedTabId, `${selection.type}:${selection.id}`);
}

const completeSession = {
  selection: authoringTargets[0],
  inspectorTabs: [...authoringTabs, authoringTabs[0], {
    id: "unknown:missing", title: "Unknown", selection: { type: "notAnInspectorTarget", id: "missing" },
  }],
  inspectorExpandedTabId: authoringTabs[2].id,
  inspectorSections: {
    [authoringTabs[0].id]: "conditions",
    [authoringTabs[1].id]: "consequences",
    [authoringTabs[2].id]: "overview",
    [authoringTabs[3].id]: "connections",
    [authoringTabs[4].id]: "overview",
    "node:event:opening": "path",
    invalidBoolean: false,
    invalidObject: { section: "conditions" },
  },
  inspectorSize: { width: 640, height: 950 },
  eventInspectorTabGroups: [{
    id: "authoring-review", name: "Authoring review", eventIds: [],
    inspectorTabs: authoringTabs,
    inspectorExpandedTabId: authoringTabs[1].id,
    createdAt: 5, updatedAt: 6,
  }, {
    id: "mixed-authoring", name: "Opening and behavior", eventIds: ["event:opening"],
    expandedEventId: "event:opening",
    inspectorTabs: authoringTabs,
    inspectorExpandedTabId: authoringTabs[0].id,
    createdAt: 7, updatedAt: 8,
  }],
};
const beforeNormalization = structuredClone(completeSession);
const normalizedAuthoring = normalizeWorkspaceSession(completeSession);
assert.deepEqual(completeSession, beforeNormalization, "Restoring inspector settings must not mutate its input or referenced objects.");
assert.equal(normalizedAuthoring.inspectorTabs.length, authoringTabs.length, "Duplicate and invalid tabs must not displace valid authoring objects.");
assert.equal(normalizedAuthoring.inspectorTabs.at(-1).mode, "debug");
assert.deepEqual(normalizedAuthoring.inspectorSize, { width: 640, height: 950 });
assert.deepEqual(normalizedAuthoring.inspectorSections, {
  [authoringTabs[0].id]: "conditions",
  [authoringTabs[1].id]: "consequences",
  [authoringTabs[2].id]: "overview",
  [authoringTabs[3].id]: "connections",
  [authoringTabs[4].id]: "overview",
  "node:event:opening": "path",
});
assert.deepEqual(normalizedAuthoring.eventInspectorTabGroups[0].inspectorTabs.map((tab) => tab.selection), authoringTargets);
assert.equal(normalizedAuthoring.eventInspectorTabGroups[0].inspectorExpandedTabId, authoringTabs[1].id);
assert.equal(normalizedAuthoring.eventInspectorTabGroups[1].inspectorExpandedTabId, authoringTabs[0].id);
assert.deepEqual(normalizeWorkspaceSession(JSON.parse(JSON.stringify(normalizedAuthoring))), normalizedAuthoring, "Serialized workspace settings must restore tabs, sections, dimensions and groups without loss.");

const prunedAuthoringGroups = pruneEventInspectorTabGroups(normalizedAuthoring.eventInspectorTabGroups, []);
assert.equal(prunedAuthoringGroups.length, 2, "Groups containing authoring objects must survive even if their old event disappears.");
assert.deepEqual(prunedAuthoringGroups[1].eventIds, []);
assert.equal(prunedAuthoringGroups[1].inspectorExpandedTabId, authoringTabs[0].id);
const updatedAuthoringGroup = saveEventInspectorTabGroup(
  { open: true, openEventIds: ["event:new"], expandedEventId: "event:new" },
  "Authoring review", normalizedAuthoring.eventInspectorTabGroups, 20,
);
assert.equal(updatedAuthoringGroup.groupId, "authoring-review");
assert.deepEqual(updatedAuthoringGroup.groups[0].inspectorTabs, normalizedAuthoring.eventInspectorTabGroups[0].inspectorTabs, "Updating legacy event membership must preserve pinned authoring objects.");
assert.equal(updatedAuthoringGroup.groups[0].inspectorExpandedTabId, authoringTabs[1].id);

for (const [input, expected] of [
  [{ width: 100, height: 100 }, { width: 360, height: 260 }],
  [{ width: 2000, height: 3000 }, { width: 1100, height: 1800 }],
  [{ width: 360, height: 260 }, { width: 360, height: 260 }],
  [{ width: 1100, height: 1800 }, { width: 1100, height: 1800 }],
  [{ width: 600, height: Number.POSITIVE_INFINITY }, { width: 600, height: undefined }],
  [{ width: 600, height: Number.NaN }, { width: 600, height: undefined }],
  [{ width: Number.POSITIVE_INFINITY, height: 500 }, { width: 640 }],
  [{ width: Number.NaN, height: 500 }, { width: 640 }],
  [{ width: "600", height: 500 }, { width: 640 }],
]) {
  assert.deepEqual(normalizeWorkspaceSession({ inspectorSize: input }).inspectorSize, expected);
}
assert.deepEqual(normalizeWorkspaceSession({}).inspectorSize, { width: 640 });
assert.deepEqual(normalizeWorkspaceSession({}).inspectorSections, {});

// The dock mixes content/entity/action tabs above event tabs. Closing a range
// must follow that one visible order and preserve the protected debug tab.
const mixedTabs = [
  { id: "action:inspect", title: "Inspect", selection: { type: "narrativeAction", id: "action:inspect" } },
  { id: "debug:run", title: "Debug", mode: "debug", selection: { type: "storyDebug", id: "run:1" } },
  { id: "entity:removed", title: "Old entity", selection: { type: "explorerEntity", id: "entity:removed" } },
];
const mixedEvents = ["event:opening", "event:ending"];
const mixedBefore = structuredClone({ inspectorTabs: mixedTabs, eventIds: mixedEvents });
for (const [target, direction, expectedTabIds, expectedEvents] of [
  [{ kind: "event", id: "event:ending" }, "above", ["debug:run"], ["event:ending"]],
  [{ kind: "event", id: "event:opening" }, "below", mixedTabs.map(tab => tab.id), ["event:opening"]],
  [{ kind: "event", id: "event:opening" }, "others", ["debug:run"], ["event:opening"]],
  [{ kind: "inspector", id: "action:inspect" }, "below", ["action:inspect", "debug:run"], []],
  [{ kind: "inspector", id: "entity:removed" }, "above", ["debug:run", "entity:removed"], mixedEvents],
  [{ kind: "inspector", id: "entity:removed" }, "others", ["debug:run", "entity:removed"], []],
  [{ kind: "inspector", id: "debug:run" }, "others", ["debug:run"], []],
  [{ kind: "inspector", id: "missing-tab" }, "others", mixedTabs.map(tab => tab.id), mixedEvents],
]) {
  const closed = closeInspectorStackTabs(mixedTabs, mixedEvents, target, direction);
  assert.deepEqual(closed.inspectorTabs.map(tab => tab.id), expectedTabIds, `${direction} ${target.kind} ${target.id}: visible tab order`);
  assert.deepEqual(closed.eventIds, expectedEvents, `${direction} ${target.kind} ${target.id}: visible event order`);
  assert.deepEqual({ inspectorTabs: mixedTabs, eventIds: mixedEvents }, mixedBefore, "Closing inspector ranges must not mutate saved tabs or group membership.");
}
const sameIdTabs = [{ id: "event:opening", title: "Copy", selection: { type: "entityInstance", id: "instance:opening" } }];
assert.deepEqual(closeInspectorStackTabs(sameIdTabs, mixedEvents, { kind: "event", id: "event:opening" }, "others"), {
  inspectorTabs: [], eventIds: ["event:opening"],
}, "Inspector IDs and event IDs are separate target namespaces.");

// Keep an unresolved generic reference intact through persistence and event
// pruning so the inspector can diagnose it instead of substituting another owner.
const unresolvedGroupSession = normalizeWorkspaceSession({
  eventInspectorTabGroups: [{
    id: "unresolved-owner", name: "Reference review", eventIds: ["event:removed"],
    inspectorTabs: [mixedTabs[2]], inspectorExpandedTabId: mixedTabs[2].id,
    createdAt: 10, updatedAt: 10,
  }],
});
const unresolvedGroups = pruneEventInspectorTabGroups(unresolvedGroupSession.eventInspectorTabGroups, mixedEvents);
assert.equal(unresolvedGroups.length, 1);
assert.deepEqual(unresolvedGroups[0].eventIds, []);
assert.deepEqual(unresolvedGroups[0].inspectorTabs[0].selection, { type: "explorerEntity", id: "entity:removed" });
assert.equal(unresolvedGroups[0].inspectorExpandedTabId, "entity:removed");

console.log("Unified inspector session migration verified.");

const orderTargets = [{kind:'inspector',id:'same'}, {kind:'event',id:'same'}, {kind:'event',id:'new'}];
const order = ['event:same', 'closed:tab', 'event:same', 'inspector:same'];
assert.deepEqual(orderedInspectorStack(orderTargets, order).map(inspectorStackKey), ['event:same','inspector:same','event:new'], 'Mixed tabs retain their order, prune closed/duplicates and append new targets.');
const orderedSession = normalizeWorkspaceSession({inspectorStackOrder:order,eventInspectorTabGroups:[{id:'ordered',name:'Ordered',eventIds:['same'],createdAt:1,updatedAt:1,inspectorStackOrder:order}]});
assert.deepEqual(orderedSession.inspectorStackOrder, ['event:same','closed:tab','inspector:same']);
assert.deepEqual(orderedSession.eventInspectorTabGroups[0].inspectorStackOrder, orderedSession.inspectorStackOrder, 'Saved groups retain mixed visual order.');
