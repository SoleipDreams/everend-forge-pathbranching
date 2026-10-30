import assert from "node:assert/strict";
import { applyLogicEffect, evaluateConditionInput } from "../lib/logic.js";
import { buildStoryCanvasModel, routeGateVisualAnchorFromLogicPosition } from "../lib/canvas/storyCanvasModel.js";
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

const alignedGateScope = { kind: "sequence", id: "sequence:main" };
const alignedGateScopeKey = "sequence:sequence:main";
const storedGateProject = {
  ...conditionalSplit,
  canvas: {
    ...conditionalSplit.canvas,
    activeScope: alignedGateScope,
    scopes: {
      ...conditionalSplit.canvas?.scopes,
      [alignedGateScopeKey]: {
        ...conditionalSplit.canvas?.scopes?.[alignedGateScopeKey],
        nodes: {
          "event:a": { position: { x: 0, y: 0 } },
          "event:b": { position: { x: 500, y: 100 } },
          "event:c": { position: { x: 500, y: 300 } },
          [splitGateId]: { position: { x: 333, y: 700 } },
        },
      },
    },
  },
};
const autoAlignedGate = buildStoryCanvasModel(storedGateProject, {
  scope: alignedGateScope,
  canvasLayerMode: "visual",
}).nodes.find((node) => node.id === splitGateId);
assert.equal(autoAlignedGate?.position.x, 288, "an automatic gate should start to the right of its source");
assert.equal(autoAlignedGate?.position.y, 37, "an automatic gate should stay centered on its source rather than its destinations");
const manuallyPositionedGate = buildStoryCanvasModel({
  ...storedGateProject,
  canvas: {
    ...storedGateProject.canvas,
    scopes: {
      ...storedGateProject.canvas.scopes,
      [alignedGateScopeKey]: {
        ...storedGateProject.canvas.scopes[alignedGateScopeKey],
        nodes: {
          ...storedGateProject.canvas.scopes[alignedGateScopeKey].nodes,
          [splitGateId]: { position: { x: 333, y: 401 }, manual: true },
        },
      },
    },
  },
}, {
  scope: alignedGateScope,
  canvasLayerMode: "visual",
}).nodes.find((node) => node.id === splitGateId);
assert.equal(manuallyPositionedGate?.position.y, 401, "a gate deliberately dragged by the author must retain its vertical placement");
const pinnedGateProject = structuredClone(storedGateProject);
pinnedGateProject.canvas.scopes[alignedGateScopeKey].nodes[splitGateId] = {
  position: { x: 333, y: 401 },
  positionPinned: true,
};
assert.equal(
  normalizeProject(pinnedGateProject).canvas.scopes[alignedGateScopeKey].nodes[splitGateId].positionPinned,
  true,
  "a pinned route-gate anchor must survive project normalization for save/reopen",
);
const movedPinnedGateProject = structuredClone(pinnedGateProject);
movedPinnedGateProject.canvas.scopes[alignedGateScopeKey].nodes["event:a"] = { position: { x: 180, y: 720 } };
movedPinnedGateProject.canvas.scopes[alignedGateScopeKey].nodes["event:b"] = { position: { x: 1200, y: -200 } };
movedPinnedGateProject.canvas.scopes[alignedGateScopeKey].nodes["event:c"] = { position: { x: 1200, y: 900 } };
const movedPinnedVisualGate = buildStoryCanvasModel(movedPinnedGateProject, {
  scope: alignedGateScope,
  canvasLayerMode: "visual",
}).nodes.find((node) => node.id === splitGateId);
const movedPinnedLogicGate = buildStoryCanvasModel(movedPinnedGateProject, {
  scope: alignedGateScope,
  canvasLayerMode: "logic",
}).nodes.find((node) => node.id === splitGateId);
assert.deepEqual(movedPinnedVisualGate?.position, { x: 333, y: 401 }, "a persisted route-gate anchor must not move when the source or destinations move");
assert.deepEqual(
  routeGateVisualAnchorFromLogicPosition(movedPinnedLogicGate.position, movedPinnedLogicGate.width, movedPinnedLogicGate.height),
  { x: 333, y: 401 },
  "the Logic router must keep its persisted center as nearby canvas nodes move",
);
const visualGate = visualModel.nodes.find((node) => node.id === splitGateId);
const logicGate = logicModel.nodes.find((node) => node.id === splitGateId);
assert.equal(visualGate?.data.details?.junctionPresentation, "split");
assert.equal(logicGate?.data.details?.junctionPresentation, "gate");
assert.equal(visualGate?.width, 34, "Visual gates must use a square selectable knot footprint");
assert.equal(visualGate?.height, 34, "Visual gates must use a square selectable knot footprint");
assert.ok((logicGate?.width ?? 0) >= 160, "Logic gates must have room for an informational summary");
assert.ok((logicGate?.height ?? 0) > (visualGate?.height ?? 0), "Logic gates must expand beyond the visual knot");
const visualSource = visualModel.nodes.find((node) => node.id === "event:a");
const logicSource = logicModel.nodes.find((node) => node.id === "event:a");
assert.deepEqual(logicSource?.position, visualSource?.position, "Layer switches must not reflow surrounding nodes when a gate expands.");
assert.ok((logicGate?.position.x ?? 0) >= (logicSource?.position.x ?? 0) + (logicSource?.width ?? 0), "an automatically placed Logic router must sit outside its source card");
const wideGapLogicModel = buildStoryCanvasModel(storedGateProject, {
  scope: alignedGateScope,
  canvasLayerMode: "logic",
});
const wideGapGate = wideGapLogicModel.nodes.find((node) => node.id === splitGateId);
const wideGapSource = wideGapLogicModel.nodes.find((node) => node.id === "event:a");
const wideGapTarget = wideGapLogicModel.nodes.find((node) => node.id === "event:b");
assert.ok(wideGapGate && wideGapSource && wideGapTarget);
assert.ok(wideGapGate.position.x >= wideGapSource.position.x + (wideGapSource.width ?? 0), "a Logic router must leave breathing room after its source");
assert.ok(wideGapGate.position.x + (wideGapGate.width ?? 0) <= wideGapTarget.position.x, "a Logic router must fit inside the lane before the first destination");
const manualLogicGate = buildStoryCanvasModel({
  ...storedGateProject,
  canvas: {
    ...storedGateProject.canvas,
    scopes: {
      ...storedGateProject.canvas.scopes,
      [alignedGateScopeKey]: {
        ...storedGateProject.canvas.scopes[alignedGateScopeKey],
        nodes: {
          ...storedGateProject.canvas.scopes[alignedGateScopeKey].nodes,
          [splitGateId]: { position: { x: 333, y: 401 }, manual: true },
        },
      },
    },
  },
}, { scope: alignedGateScope, canvasLayerMode: "logic" }).nodes.find((node) => node.id === splitGateId);
assert.deepEqual(
  routeGateVisualAnchorFromLogicPosition(manualLogicGate.position, manualLogicGate.width, manualLogicGate.height),
  { x: 333, y: 401 },
  "dragging a Logic router must persist its visual anchor using its rendered dimensions",
);
assert.equal(visualModel.nodes.find((node) => node.id === "event:a")?.data.logicSummary, undefined);
assert.ok(logicModel.nodes.find((node) => node.id === "event:a")?.data.logicSummary);

const visualRoute = visualModel.edges.find((edge) => edge.data?.kind === "transition" && edge.data?.conditions);
const logicRoute = logicModel.edges.find((edge) => edge.data?.kind === "transition" && edge.data?.conditions);
assert.equal(visualRoute?.data?.canvasLayerMode, "visual");
assert.equal(visualRoute?.animated, false);
assert.equal(logicRoute?.data?.canvasLayerMode, "logic");
assert.equal(logicRoute?.animated, false, "authored routes should not animate continuously outside a running test");
assert.equal(logicRoute?.data?.routePreview?.conditionItems?.[0]?.subjectLabel, "Relic");
const gateRouteEdges = logicModel.edges.filter((edge) => edge.source === splitGateId);
assert.equal(gateRouteEdges.length, 2, "a Logic Gate must expose every outgoing route");
assert.ok(gateRouteEdges.every((edge) => edge.sourceHandle === "route:output"), "every route must leave through the shared gate output");
assert.ok(gateRouteEdges.every((edge) => edge.data.routeGateId === splitGateId), "route edges must point back to their shared router inspector");
assert.deepEqual(gateRouteEdges.map((edge) => edge.data.routeIndex), [0, 1], "router routes need stable generic ordinals");
const visualGateRouteEdges = visualModel.edges.filter((edge) => edge.source === splitGateId);
assert.ok(visualGateRouteEdges.every((edge) => edge.sourceHandle === "route:output"), "every Visual knot route must resolve through the shared output");
const gateOptions = logicGate?.data.details?.routeOptions;
assert.equal(Array.isArray(gateOptions) ? gateOptions.length : 0, 2, "a Logic Gate must summarize every outgoing route");
assert.deepEqual(gateOptions.map((route) => route.targetLabel), ["B", "C"], "ordered routes need readable destinations, including Else");
assert.equal(gateOptions[1].mode, "fallback");
assert.deepEqual(gateOptions.map((route) => route.label), ["Route 1", "Route 2"], "router rows use generic route names instead of condition labels");
const interactionRouteProject = structuredClone(conditionalSplit);
interactionRouteProject.events[0].interactionUses = [{ id: "interaction:split", definitionId: "definition:split", ownerNodeId: "event:a", moment: "before" }];
const interactionRouter = buildStoryCanvasModel(interactionRouteProject, { canvasLayerMode: "logic" }).nodes.find((node) => node.id === splitGateId);
assert.equal(interactionRouter?.data.details?.interactionCount, 1, "router summaries count interactions attached to their source");
assert.equal(logicModel.nodes.find((node) => node.id === "event:a").data.logicSummary.when, "", "nodes with no own conditions must not repeat Always");
assert.equal(logicModel.nodes.find((node) => node.id === "event:a").data.logicSummary.then, "", "nodes with no effects must not repeat No effects");

const authoringCanvasProject = normalizeProject({
  ...source,
  events: [
    { ...source.events[0], decisions: [{ id: "decision:test", name: "Choose a path", logic: { when: owned }, outcomes: [
      { id: "response:one", name: "Guarded answer", availability: visited, unavailableBehavior: "hidden" },
      { id: "response:two", name: "Apply a change", logic: { then: [{ type: "property", subject: owned.subject, propertyId: "durability", operation: "add", value: 1 }] } },
    ] }], transitions: [{ id: "route:effects", from: "event:a", to: "event:b", role: "route", consequences: [{ type: "state", subject: owned.subject, stateId: "owned", operation: "grant" }] }] },
    source.events[1],
    { ...source.events[2], parentEventId: "event:a", transitions: [{ id: "route:return", from: "event:c", to: "event:a" }] },
  ],
});
const beforeCanvas = JSON.stringify(authoringCanvasProject);
for (const canvasLayerMode of ["visual", "logic"]) {
  const model = buildStoryCanvasModel(authoringCanvasProject, { scope: { kind: "event", id: "event:a" }, canvasLayerMode, interfaceLocale: "es" });
  const decision = model.nodes.find((node) => node.id === "decision:event:a:decision:test");
  assert.equal(decision.data.title, "Choose a path");
  assert.deepEqual(decision.data.infoBadges, [{ kind: "outcomes", count: 2 }], "decision cards preview the number of options inside");
  assert.equal(decision.data.authoringLogicSummary.conditionCount, 1, "a decision's availability belongs to its own card in both layers");
  const responses = decision.data.details.options;
  assert.equal(responses[0].logicSummary.conditionCount, 1, "each response retains its independent restriction");
  assert.equal(responses[0].unavailableBehavior, "hidden");
  assert.equal(responses[1].logicSummary.consequenceCount, 1, "response effects must be distinct from decision availability");
  assert.equal(responses[0].handleId, "outcome:event:a:decision:test:response:one");
  const sequenceModel = buildStoryCanvasModel(authoringCanvasProject, { scope: { kind: "sequence", id: "sequence:main" }, canvasLayerMode, interfaceLocale: "es" });
  const effectsRoute = sequenceModel.edges.find((edge) => edge.id === "edge:transition:route:effects");
  assert.deepEqual(effectsRoute.data.routePreview.conditions, [], "an effects-only route must not invent an Always condition");
  assert.equal(effectsRoute.data.routePreview.consequences.length, 1);
  assert.equal(effectsRoute.data.routeTargetLabel, "B");
  const returnRoute = model.edges.find((edge) => edge.id === "edge:transition:route:return");
  assert.equal(returnRoute.data.returnRoute, true, "child-to-parent returns need a visible return role");
  const returnPort = model.nodes.find((node) => node.data.details?.restart);
  assert.equal(returnPort.data.title, "A", "return boundaries must identify the destination event");
}
assert.equal(JSON.stringify(authoringCanvasProject), beforeCanvas, "canvas presentation must not mutate authored logic, routes or positions");

const dialogueStatsProject = structuredClone(authoringCanvasProject);
dialogueStatsProject.events[0].dialogues = [{
  id: "dialogue:stats",
  title: "A short conversation",
  beats: [
    { id: "beat:one", kind: "speech", blockRef: { scriptId: "script:fixture", blockId: "block:one" } },
    { id: "beat:two", kind: "direction", blockRef: { scriptId: "script:fixture", blockId: "block:two" } },
    { id: "beat:three", kind: "speech", blockRef: { scriptId: "script:fixture", blockId: "block:three" } },
  ],
  text: "",
}];
const dialogueStatsNode = buildStoryCanvasModel(dialogueStatsProject, {
  scope: { kind: "event", id: "event:a" },
  canvasLayerMode: "logic",
}).nodes.find((node) => node.id === "dialogue:event:a:dialogue:stats");
assert.deepEqual(dialogueStatsNode?.data.infoBadges, [{ kind: "lines", count: 3 }], "conversation cards preview their line count");

const dialogueEntryProject = structuredClone(authoringCanvasProject);
dialogueEntryProject.events[0].dialogues = [{
  id: "dialogue:entry-label",
  title: "Entry label",
  entryBeatId: "beat:entry-label",
  beats: [{ id: "beat:entry-label", kind: "speech", blockRef: { scriptId: "script:fixture", blockId: "block:entry-label" } }],
}];
const dialogueEntryScope = { kind: "dialogue", id: "dialogue:entry-label", eventId: "event:a" };
const visualDialogueEntry = buildStoryCanvasModel(dialogueEntryProject, {
  scope: dialogueEntryScope,
  canvasLayerMode: "visual",
}).edges.find((edge) => edge.id === "edge:dialogue-entry:dialogue:entry-label");
const logicDialogueEntry = buildStoryCanvasModel(dialogueEntryProject, {
  scope: dialogueEntryScope,
  canvasLayerMode: "logic",
}).edges.find((edge) => edge.id === "edge:dialogue-entry:dialogue:entry-label");
assert.equal(visualDialogueEntry?.label, undefined, "Visual mode should hide the structural enters label from conversation entry edges");
assert.equal(visualDialogueEntry?.data?.label, "", "Visual mode should not pass the entry label to the default edge renderer");
assert.equal(logicDialogueEntry?.label, "enters", "Logic mode should retain the structural enters label");

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
  true,
  "A story-level event with multiple exits must expose one shared Logic Gate.",
);
assert.equal(
  ordinaryStoryLogic.edges.filter((edge) => edge.source === "route-gate:event:a:event:a" && edge.data?.kind === "transition").length,
  2,
  "Every ordinary route must leave through the shared Logic Gate.",
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
  undefined,
  "Sequence-level event nodes must not expose decision outcome ports; decisions live in the event subcanvas.",
);
assert.equal(
  outcomeStoryLogic.edges.find((edge) => edge.target === `route-gate:event:a:${outcomeSource}`)?.sourceHandle,
  undefined,
  "A route leaving a decision outcome in the sequence overview must use the event's single output.",
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
    .map((edge) => edge.sourceHandle),
  [undefined, undefined],
  "Independent decision outcomes must still leave the sequence-level event through its single output.",
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
