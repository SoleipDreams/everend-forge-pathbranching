import assert from "node:assert/strict";
import {
  canSaveAfterRemovingStaleScenarioReferences,
  deleteBranch,
  deleteSequence,
} from "../lib/projectMutations.js";
import { normalizeProject } from "../lib/projectSerialization.js";
import { validateProject } from "../lib/validate.js";

const incompleteReasons = [
  "Incomplete story: Test event has a saved event file and an active scenario reference but is absent from sequence.json.",
];

const project = {
  specVersion: "0.1",
  projectId: "pathbranching:sequence-delete-cleanup",
  storyId: "sequence-delete-cleanup",
  canonRefs: [],
  sequences: [
    { id: "sequence:removed", name: "Removed", entryEventId: "event:removed", eventIds: ["event:removed"], branchIds: ["branch:removed"] },
    { id: "sequence:kept", name: "Kept", entryEventId: "event:kept", eventIds: ["event:kept"], branchIds: [], inheritInventoryFromSequenceId: "sequence:removed" },
  ],
  // Reproduce a partially saved branch file: events still point at the branch,
  // but the branch's eventIds list was emptied before the sequence was removed.
  branches: [{ id: "branch:removed", title: "Removed branch", eventIds: [] }],
  events: [
    { id: "event:removed", name: "Removed event", type: "normal", branchRef: "branch:removed", dialogues: [{ id: "dialogue:removed", title: "Removed dialogue", text: { format: "plain", content: "" } }] },
    { id: "event:orphaned", name: "Orphaned event file", type: "normal", branchRef: "branch:removed" },
    {
      id: "event:kept",
      name: "Kept event",
      type: "normal",
      transitions: [{ id: "transition:stale", from: "event:kept", to: "event:removed" }],
    },
  ],
  logicVariables: [{ id: "variable:kept", name: "Kept", type: "boolean", value: false, groupId: "group:main" }],
  narrativeActions: [
    {
      id: "action:stale-target",
      name: "Stale target",
      targetNodeId: "event:orphaned",
    },
    {
      id: "action:stale-progress",
      name: "Stale progress",
      when: { type: "visited", subject: { kind: "progress", targetType: "sequence", targetId: "sequence:removed" }, operator: "has" },
    },
    {
      id: "action:stale-variable",
      name: "Stale variable",
      effects: [{ type: "value", subject: { kind: "variable", variableId: "variable:deleted" }, operation: "set", value: true }],
    },
    {
      id: "action:kept",
      name: "Kept action",
      targetNodeId: "event:kept",
      when: { type: "visited", subject: { kind: "progress", targetType: "sequence", targetId: "sequence:kept" }, operator: "has" },
    },
  ],
  narrativeRules: [
    { id: "rule:stale-scope", name: "Stale scope", trigger: "enter", scope: { kind: "event", id: "event:orphaned" } },
    { id: "rule:stale-variable", name: "Stale variable", trigger: "enter", scope: { kind: "global" }, effects: [{ type: "value", subject: { kind: "variable", variableId: "variable:deleted" }, operation: "set", value: true }] },
    { id: "rule:kept", name: "Kept rule", trigger: "enter", scope: { kind: "event", id: "event:kept" } },
  ],
  authoringScenarios: [
    { id: "scenario:stale", name: "Stale scenario", startNodeId: "event:orphaned" },
    { id: "scenario:kept", name: "Kept scenario", startNodeId: "event:kept", state: { variables: { "variable:deleted": true, "variable:kept": true } } },
  ],
  projectDataObjects: [
    { id: "data:removed", classId: "class:test", name: "Removed", fields: {}, scope: { sequenceId: "sequence:removed" } },
    { id: "data:kept", classId: "class:test", name: "Kept", fields: {}, scope: { global: true } },
  ],
  canvas: { activeSequenceId: "sequence:removed", nodes: { "event:removed": { x: 0, y: 0 }, "event:orphaned": { x: 5, y: 5 }, "event:kept": { x: 10, y: 10 } }, scopes: {} },
  entrySequenceId: "sequence:removed",
  scripts: [],
  externalFunctions: [],
  variables: {},
};

assert.equal(canSaveAfterRemovingStaleScenarioReferences(project, incompleteReasons), false);

const result = deleteSequence(project, "sequence:removed");
const next = result.project;

assert.deepEqual(next.sequences.map((sequence) => sequence.id), ["sequence:kept"]);
assert.equal(next.sequences[0].inheritInventoryFromSequenceId, undefined, "Deleting an inventory source detaches and snapshots its dependent sequence.");
assert.deepEqual(next.sequences[0].initialInventory, []);
assert.equal(next.entrySequenceId, "sequence:kept");
assert.deepEqual(next.events.map((event) => event.id), ["event:kept"]);
assert.deepEqual(next.events[0].transitions, []);
assert.deepEqual(next.branches, []);
assert.deepEqual(next.projectDataObjects.map((item) => item.id), ["data:kept"]);
assert.deepEqual(next.narrativeActions.map((action) => action.id), ["action:kept"]);
assert.deepEqual(next.narrativeRules.map((rule) => rule.id), ["rule:kept"]);
assert.deepEqual(next.authoringScenarios.map((scenario) => scenario.id), ["scenario:kept"]);
assert.deepEqual(next.authoringScenarios[0].state.variables, { "variable:kept": true });
assert.equal(next.logicVariables[0].id, "variable:kept");
assert.equal(canSaveAfterRemovingStaleScenarioReferences(next, incompleteReasons), true);
assert.equal(canSaveAfterRemovingStaleScenarioReferences(next, ["Incomplete story: sequence.json is missing."]), false);

const branchDeletion = deleteBranch(project, "branch:removed").project;
assert.deepEqual(branchDeletion.branches, []);
assert.deepEqual(branchDeletion.events.map((event) => event.id), ["event:removed", "event:kept"]);
assert.equal(branchDeletion.events[0].branchRef, undefined, "Sequence-owned events survive branch deletion and become ungrouped.");
assert.deepEqual(branchDeletion.narrativeActions.map((action) => action.id), ["action:stale-progress", "action:kept"]);
assert.deepEqual(branchDeletion.narrativeRules.map((rule) => rule.id), ["rule:kept"]);
assert.deepEqual(branchDeletion.authoringScenarios.map((scenario) => scenario.id), ["scenario:kept"]);
assert.equal(canSaveAfterRemovingStaleScenarioReferences(branchDeletion, incompleteReasons), true);

const terminalDialogueProject = normalizeProject({
  specVersion: "0.1",
  projectId: "terminal-dialogue-validation",
  storyId: "terminal-dialogue-validation",
  canonRefs: [],
  sequences: [{ id: "sequence:ending", name: "Ending", entryEventId: "event:ending", eventIds: ["event:ending", "event:next"] }],
  branches: [],
  events: [
    {
      id: "event:ending",
      name: "Ending",
      type: "final",
      dialogues: [{ id: "dialogue:ending", title: "Ending", text: { format: "plain", content: "The story ends." } }],
      transitions: [{ id: "transition:into-ending-dialogue", from: "event:ending", to: "dialogue:event:ending:dialogue:ending" }],
    },
    { id: "event:next", name: "Next", type: "normal" },
  ],
  scripts: [],
  externalFunctions: [],
  variables: {},
});
assert.equal(
  validateProject(terminalDialogueProject).some((finding) => finding.code === "invalid_final_transition"),
  false,
  "A final event's internal dialogue transition must not be reported as a route leaving the event.",
);
const terminalWithExternalRoute = {
  ...terminalDialogueProject,
  events: terminalDialogueProject.events.map((event) => event.id === "event:ending"
    ? { ...event, transitions: [{ id: "transition:ending-to-next", from: "event:ending", to: "event:next" }] }
    : event),
};
assert.equal(
  validateProject(terminalWithExternalRoute).some((finding) => finding.code === "invalid_final_transition"),
  true,
  "A final event route to a separate event must remain an error.",
);

console.log("Sequence deletion cleanup verified.");
