import assert from "node:assert/strict";
import { applyLogicEffect, evaluateConditionInput } from "../lib/logic.js";
import { buildStoryCanvasModel } from "../lib/canvas/storyCanvasModel.js";
import { connectedNarrativeNodePosition } from "../lib/canvas/nodePlacement.js";
import { logicFieldOptions, presentConsequences } from "../lib/logicCapabilities.js";
import { createInternalTransition, deleteTransition, updateTransition } from "../lib/projectMutations.js";
import { normalizeProject } from "../lib/projectSerialization.js";
import { validateProject } from "../lib/validate.js";
import { normalizeWorkspaceSession } from "../lib/workspaceSettings.js";

const source = {
  specVersion: "0.1",
  projectId: "unified-logic",
  canonRefs: [],
  sequences: [{ id: "sequence:main", name: "Main", entryEventId: "event:a", eventIds: ["event:a", "event:b", "event:c"] }],
  branches: [],
  events: [
    { id: "event:a", name: "A", type: "normal", transitions: [] },
    { id: "event:b", name: "B", type: "normal", transitions: [] },
    { id: "event:c", name: "C", type: "final", transitions: [] },
  ],
  scripts: [],
  externalFunctions: [],
  variables: {},
  localExplorerTypes: [{ id: "item", label: "Item", createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  localExplorerProperties: [{ id: "durability", label: "Durability", valueType: "number", appliesToTypes: ["item"], createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  localExplorerEntities: [{ id: "item:relic", name: "Relic", type: "item", fields: { durability: 4 }, createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
  logicTypeOverrides: [{ typeId: "item", source: "local", runtimeRoles: ["owned"] }],
  logicPropertyOverrides: [{ propertyId: "durability", source: "local", conditionReadable: true, actionWritable: true }],
};

const project = normalizeProject(source);
const owned = { type: "state", subject: { kind: "entity", entityId: "item:relic", source: "local" }, stateId: "owned", operator: "has" };
const granted = applyLogicEffect({ type: "state", subject: owned.subject, stateId: "owned", operation: "grant" }, {});
assert.equal(evaluateConditionInput(owned, project, granted), true);
const visited = { type: "visited", subject: { kind: "progress", targetType: "event", targetId: "event:a" }, operator: "has" };
const visitedState = { ...granted, visited: ["event:a"] };
assert.equal(evaluateConditionInput(visited, project, visitedState), true, "Visited Has must match the event name/id");
assert.equal(evaluateConditionInput({ ...visited, operator: "missing" }, project, visitedState), false, "Visited Has not must invert the event check");
const damaged = applyLogicEffect({ type: "property", subject: owned.subject, propertyId: "durability", operation: "subtract", value: 1 }, {
  ...granted,
  entityStates: { ...granted.entityStates, "item:relic": { ...granted.entityStates?.["item:relic"], properties: { durability: 4 } } },
});
assert.equal(damaged.entityStates["item:relic"].properties.durability, 3);
assert.equal(project.localExplorerEntities[0].fields.durability, 4, "runtime effects must not mutate authored data");

const first = createInternalTransition(project, "event:a", "event:a", "event:b").project;
assert.equal(first.events[0].transitions[0].role, "flow");
const split = createInternalTransition(first, "event:a", "event:a", "event:c").project;
assert.deepEqual(split.events[0].transitions.map((transition) => transition.role), ["route", "route"]);
const degraded = deleteTransition(split, split.events[0].transitions[1].id).project;
assert.equal(degraded.events[0].transitions[0].role, "flow");
const transitionId = degraded.events[0].transitions[0].id;
const promoted = updateTransition(degraded, transitionId, { conditions: owned }).project;
assert.equal(promoted.events[0].transitions[0].role, "route");
const clean = updateTransition(promoted, transitionId, { conditions: undefined }).project;
assert.equal(clean.events[0].transitions[0].role, "flow");
assert.equal(clean.events[0].transitions[0].logic, undefined);

const conditionFields = logicFieldOptions(project, owned.subject, "condition").map((field) => field.key);
const effectFields = logicFieldOptions(project, owned.subject, "effect").map((field) => field.key);
assert.deepEqual(conditionFields, ["owned", "durability"]);
assert.deepEqual(effectFields, ["owned", "durability"]);

const persistedCapabilityProject = normalizeProject({
  ...source,
  localExplorerTypes: [],
  localExplorerProperties: [{ id: "type:item", label: "Item", valueType: "entity-type", appliesToTypes: [] }],
  logicTypeOverrides: [{ typeId: "item", source: "local", grantable: false, location: false }],
  logicPropertyOverrides: [{
    propertyId: "type:item",
    source: "local",
    conditionReadable: true,
    actionWritable: true,
    grantable: true,
    location: true,
  }],
});
const persistedCapability = persistedCapabilityProject.logicPropertyOverrides.find(
  (override) => override.propertyId === "type:item" && override.source === "local",
);
assert.equal(persistedCapability?.conditionReadable, true);
assert.equal(persistedCapability?.actionWritable, true);
assert.equal(persistedCapability?.grantable, true, "grantable must stay with the entity-type property override");
assert.equal(persistedCapability?.location, true, "location must stay with the entity-type property override");
assert.equal(normalizeProject(persistedCapabilityProject).logicPropertyOverrides.find(
  (override) => override.propertyId === "type:item" && override.source === "local",
)?.grantable, true, "grantable must survive a second serialization normalization");

const conditionalSplit = updateTransition(split, split.events[0].transitions[0].id, { conditions: owned }).project;
conditionalSplit.events[0].transitions[1].mode = "fallback";
const visualModel = buildStoryCanvasModel(conditionalSplit, { canvasLayerMode: "visual" });
const logicModel = buildStoryCanvasModel(conditionalSplit, { canvasLayerMode: "logic" });
const splitGateId = "route-gate:event:a:event:a";
const visualGate = visualModel.nodes.find((node) => node.id === splitGateId);
const logicGate = logicModel.nodes.find((node) => node.id === splitGateId);
assert.equal(visualGate?.data.details?.junctionPresentation, "split");
assert.equal(logicGate?.data.details?.junctionPresentation, "gate");
const visualGateCenter = {
  x: (visualGate?.position.x ?? 0) + (visualGate?.width ?? 0) / 2,
  y: (visualGate?.position.y ?? 0) + (visualGate?.height ?? 0) / 2,
};
const logicGateCenter = {
  x: (logicGate?.position.x ?? 0) + (logicGate?.width ?? 0) / 2,
  y: (logicGate?.position.y ?? 0) + (logicGate?.height ?? 0) / 2,
};
assert.deepEqual(visualGateCenter, logicGateCenter, "layer toggles must preserve the route-gate center");
assert.equal(visualGate?.width, 34, "Visual gates must use a square selectable knot footprint");
assert.equal(visualGate?.height, 34, "Visual gates must use a square selectable knot footprint");
assert.ok((logicGate?.width ?? 0) >= 160, "Logic gates must have room for an informational summary");
assert.ok((logicGate?.height ?? 0) > (visualGate?.height ?? 0), "Logic gates must expand beyond the visual knot");
const visualSource = visualModel.nodes.find((node) => node.id === "event:a");
const logicSource = logicModel.nodes.find((node) => node.id === "event:a");
assert.deepEqual(logicSource?.position, visualSource?.position, "Layer switches must not reflow surrounding nodes when a gate expands.");
assert.equal(visualModel.nodes.find((node) => node.id === "event:a")?.data.logicSummary, undefined);
assert.ok(logicModel.nodes.find((node) => node.id === "event:a")?.data.logicSummary);
const visualRoute = visualModel.edges.find((edge) => edge.data?.kind === "transition" && edge.data?.conditions);
const logicRoute = logicModel.edges.find((edge) => edge.data?.kind === "transition" && edge.data?.conditions);
assert.equal(visualRoute?.data?.canvasLayerMode, "visual");
assert.equal(visualRoute?.animated, false);
assert.equal(logicRoute?.data?.canvasLayerMode, "logic");
assert.equal(logicRoute?.animated, true);
assert.equal(logicRoute?.data?.routePreview?.conditionItems?.[0]?.subjectLabel, "Relic");
const gateRouteEdges = logicModel.edges.filter((edge) => edge.source === splitGateId);
assert.equal(gateRouteEdges.length, 2, "a Logic Gate must expose every outgoing route");
assert.ok(gateRouteEdges.every((edge) => edge.sourceHandle === "route:output"), "every route must leave through the shared gate output");
const visualGateRouteEdges = visualModel.edges.filter((edge) => edge.source === splitGateId);
assert.ok(visualGateRouteEdges.every((edge) => edge.sourceHandle === "route:output"), "every Visual knot route must resolve through the shared output");
const gateOptions = logicGate?.data.details?.routeOptions;
assert.equal(Array.isArray(gateOptions) ? gateOptions.length : 0, 2, "a Logic Gate must summarize every outgoing route");

const ordinaryStorySplit = normalizeProject({
  ...source,
  events: [
    { id: "event:a", name: "A", type: "normal", transitions: [
      { id: "flow:a-b", from: "event:a", to: "event:b" },
      { id: "flow:a-c", from: "event:a", to: "event:c" },
    ] },
    { id: "event:b", name: "B", type: "normal", transitions: [] },
    { id: "event:c", name: "C", type: "final", transitions: [] },
  ],
});
const ordinaryStoryLogic = buildStoryCanvasModel(ordinaryStorySplit, { canvasLayerMode: "logic" });
assert.equal(
  ordinaryStoryLogic.nodes.some((node) => node.id === "route-gate:event:a:event:a"),
  false,
  "A story-level event with ordinary exits must keep direct Logic-mode lines.",
);
assert.equal(
  ordinaryStoryLogic.edges.filter((edge) => edge.source === "event:a" && edge.data?.kind === "transition").length,
  2,
  "Ordinary story-level exits must remain attached to their event.",
);

const outcomeSource = "outcome:event:a:decision:choose:continue";
const outcomeStorySplit = normalizeProject({
  ...source,
  events: [
    {
      id: "event:a",
      name: "A",
      type: "normal",
      decisions: [{ id: "decision:choose", name: "Choose", type: "dialogue", outcomes: [{ id: "continue", name: "Continue" }] }],
      transitions: [
        { id: "outcome:a-b", from: outcomeSource, to: "event:b" },
        { id: "outcome:a-c", from: outcomeSource, to: "event:c" },
      ],
    },
    { id: "event:b", name: "B", type: "normal", transitions: [] },
    { id: "event:c", name: "C", type: "final", transitions: [] },
  ],
});
const outcomeStoryLogic = buildStoryCanvasModel(outcomeStorySplit, { canvasLayerMode: "logic" });
assert.ok(
  outcomeStoryLogic.nodes.some((node) => node.id === `route-gate:event:a:${outcomeSource}`),
  "A single outcome with multiple exits must own its Logic Gate.",
);
const outcomeStoryEvent = outcomeStoryLogic.nodes.find((node) => node.id === "event:a");
assert.deepEqual(
  outcomeStoryEvent?.data.details?.logicOutcomePorts,
  [{ id: outcomeSource, label: "Continue", decisionLabel: "Choose" }],
  "Logic mode must retain a visible output port for each outcome.",
);
assert.equal(
  outcomeStoryLogic.edges.find((edge) => edge.target === `route-gate:event:a:${outcomeSource}`)?.sourceHandle,
  outcomeSource,
  "An outcome route must leave through its own Logic-mode output port.",
);

const independentOutcomeProject = normalizeProject({
  ...source,
  events: [
    {
      id: "event:a",
      name: "A",
      type: "normal",
      decisions: [{
        id: "decision:choose",
        name: "Choose",
        type: "dialogue",
        outcomes: [{ id: "continue", name: "Continue" }, { id: "leave", name: "Leave" }],
      }],
      transitions: [
        { id: "outcome:continue", from: outcomeSource, to: "event:b" },
        { id: "outcome:leave", from: "outcome:event:a:decision:choose:leave", to: "event:c" },
      ],
    },
    { id: "event:b", name: "B", type: "normal", transitions: [] },
    { id: "event:c", name: "C", type: "final", transitions: [] },
  ],
});
const independentOutcomeLogic = buildStoryCanvasModel(independentOutcomeProject, { canvasLayerMode: "logic" });
assert.equal(
  independentOutcomeLogic.nodes.some((node) => node.data.kind === "routeGate"),
  false,
  "Outcomes with one exit each must remain continuous Logic-mode lines.",
);
assert.deepEqual(
  independentOutcomeLogic.edges
    .filter((edge) => edge.source === "event:a" && edge.data?.kind === "transition")
    .map((edge) => edge.sourceHandle)
    .sort(),
  [outcomeSource, "outcome:event:a:decision:choose:leave"].sort(),
  "Independent outcomes must retain independent output handles.",
);

const disabledProject = normalizeProject({
  ...source,
  logicPropertyOverrides: [{ propertyId: "durability", source: "local", conditionReadable: true, actionWritable: false }],
});
assert.deepEqual(logicFieldOptions(disabledProject, owned.subject, "effect").map((field) => field.key), ["owned"]);
const disabledEffectPresentation = presentConsequences(disabledProject, [{ type: "property", subject: owned.subject, propertyId: "durability", operation: "subtract", value: 1 }]);
assert.equal(disabledEffectPresentation[0].status, "disabled", "existing logic must remain visible as a repairable capability warning");
assert.equal(normalizeWorkspaceSession({ canvasLayerMode: "logic" }).canvasLayerMode, "logic");
assert.equal(normalizeWorkspaceSession({ canvasLayerMode: "unknown" }).canvasLayerMode, undefined);

const sourceBeatNode = {
  id: "beat:source",
  type: "story",
  position: { x: 120, y: 205 },
  measured: { width: 360, height: 176 },
  data: { kind: "speechBeat", title: "Source", storyObjectId: "beat:source", badges: [] },
};
const firstConnectedPosition = connectedNarrativeNodePosition(
  [sourceBeatNode],
  sourceBeatNode,
  { width: 360, height: 176 },
  { snapToGrid: true, gridSize: 24 },
);
assert.equal(firstConnectedPosition.y, sourceBeatNode.position.y, "quick connections must preserve the source row exactly");
assert.ok(firstConnectedPosition.x >= sourceBeatNode.position.x + 360 + 72);
const occupiedSlot = {
  id: "route-gate:beat:source",
  type: "story",
  position: { x: firstConnectedPosition.x, y: sourceBeatNode.position.y },
  width: 168,
  height: 76,
  data: { kind: "routeGate", title: "Gate", storyObjectId: "route-gate:beat:source", badges: [] },
};
const nextConnectedPosition = connectedNarrativeNodePosition(
  [sourceBeatNode, occupiedSlot],
  sourceBeatNode,
  { width: 360, height: 176 },
  { snapToGrid: true, gridSize: 24 },
);
assert.equal(nextConnectedPosition.y, sourceBeatNode.position.y, "occupied slots must move right, never above the source");
assert.ok(nextConnectedPosition.x > occupiedSlot.position.x + 168);

assert.deepEqual(validateProject(project).filter((finding) => finding.severity === "error"), []);
assert.deepEqual(normalizeProject(normalizeProject(source)), normalizeProject(source), "normalization must be idempotent");
console.log(JSON.stringify({ owned: true, durability: 3, promoted: true, degraded: true, visualLogicLayers: true, capabilityWarnings: true, alignedQuickConnections: true, idempotent: true }, null, 2));
