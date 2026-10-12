import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildStoryCanvasModel, fitSubcanvasWorkspaceBounds, layoutSubcanvasNodes } from "../lib/canvas/storyCanvasModel.js";
import { canvasReturnConnectors } from "../lib/canvas/returnConnectors.js";
import { parseProject } from "../lib/projectSerialization.js";
import { removeBoundaryPortSlot, resolveBoundaryPortSlot } from "../lib/projectMutations.js";
import { validateProject } from "../lib/validate.js";

const fixturePath = new URL("../examples/worldnotion-bridge-demo-project.json", import.meta.url);
const source = JSON.parse(await readFile(fixturePath, "utf8"));
const parent = source.events[0];
const entryPortId = `boundary:${parent.id}:input:entry`;

parent.childEventIds = ["event:route-a", "event:route-b"];
parent.decisions = [
  {
    id: "decision:signal-response",
    name: "Signal response",
    type: "dialogue",
    optionStyle: "visibleText",
    outcomes: [
      { id: "accept", name: "Accept", description: "The signal is answered." },
      { id: "decline", name: "Decline", description: "The signal is ignored." },
    ],
  },
];
parent.dialogues = [
  {
    id: "dialogue:signal-response",
    title: "Signal response dialogue",
    text: { format: "plain", content: "The signal is answered." },
    beats: [],
    members: [],
  },
];
parent.dialogueBeats = [
  {
    id: "beat:event-speech",
    kind: "speech",
    blockRef: { scriptId: "script:fixture", blockId: "block:event-speech" },
  },
];
source.scriptDocuments = [
  ...(source.scriptDocuments ?? []),
  {
    id: "script:fixture",
    name: "Fixture dialogue",
    format: "forge-script",
    blocks: [{ id: "block:event-speech", kind: "speech", content: "A beat on the event canvas." }],
  },
];
parent.transitions = [
  {
    id: "transition:signal-accept",
    from: `outcome:${parent.id}:decision:signal-response:accept`,
    to: "event:route-a",
    source: "graph",
  },
  {
    id: "transition:signal-decline",
    from: `outcome:${parent.id}:decision:signal-response:decline`,
    to: "event:route-b",
    source: "graph",
  },
  {
    id: "transition:parent-route",
    from: parent.id,
    to: "event:external-output",
    source: "graph",
  },
  {
    id: "transition:dialogue-route",
    from: `dialogue:${parent.id}:dialogue:signal-response`,
    to: "event:route-a",
    source: "graph",
  },
];
parent.boundaryBindings = [
  { id: "legacy-entry-a", portId: entryPortId, nodeId: "event:route-a", direction: "input" },
  { id: "legacy-entry-b", portId: entryPortId, nodeId: "event:route-b", direction: "input" },
  { id: "legacy-entry-decision", portId: entryPortId, nodeId: `decision:${parent.id}:decision:signal-response`, direction: "input" },
  { id: "legacy-entry-beat", portId: entryPortId, nodeId: `beat:${parent.id}:beat:event-speech`, direction: "input" },
];
source.events.push(
  { id: "event:external-output", name: "External output", type: "normal" },
  {
    id: "event:route-a",
    name: "Route A",
    type: "normal",
    parentEventId: parent.id,
    childEventIds: [],
    decisions: [
      {
        id: "decision:nested-only",
        name: "Nested-only decision",
        type: "dialogue",
        outcomes: [],
      },
    ],
    dialogues: [],
    transitions: [],
  },
  {
    id: "event:route-b",
    name: "Route B",
    type: "normal",
    parentEventId: parent.id,
    childEventIds: [],
    decisions: [],
    dialogues: [],
    transitions: [],
  },
);
source.sequences[0].eventIds.push("event:route-a", "event:route-b");

const project = parseProject(JSON.stringify(source));
const migratedParent = project.events.find((event) => event.id === parent.id);
const entryRoutes = migratedParent.transitions.filter((transition) => transition.from === entryPortId);
if (entryRoutes.length !== 4) {
  throw new Error(`Expected four migrated Entry routes, got ${entryRoutes.length}.`);
}

project.canvas = {
  ...project.canvas,
  scopes: {
    ...(project.canvas?.scopes ?? {}),
    [`event:${parent.id}`]: {
      entrySlots: ["extra-entry"],
      exitSlots: ["extra-end"],
      nodes: {
        "event:route-b": { position: { x: 1500, y: 120 } },
      },
    },
  },
};

const dialogueId = "dialogue:signal-response";
const dialogueScopeKey = `dialogue:${dialogueId}`;
const dialoguePortIds = {
  input: `dialogue-boundary:${parent.id}:${dialogueId}:input:temporary-entry`,
  output: `dialogue-boundary:${parent.id}:${dialogueId}:output:temporary-exit`,
};
const dialogueProject = structuredClone(project);
dialogueProject.canvas.scopes[dialogueScopeKey] = {
  entrySlots: ["temporary-entry"],
  exitSlots: ["temporary-exit"],
  nodes: {
    [dialoguePortIds.input]: { position: { x: 0, y: 150 } },
    [dialoguePortIds.output]: { position: { x: 0, y: 260 } },
  },
};
const dialogueModel = buildStoryCanvasModel(dialogueProject, {
  scope: { kind: "dialogue", id: dialogueId, eventId: parent.id },
});
const dialogueWorkspace = dialogueModel.nodes.find((node) => node.data.kind === "workspace");
const dialogueEntry = dialogueModel.nodes.find((node) => node.id === dialoguePortIds.input);
const dialogueExit = dialogueModel.nodes.find((node) => node.id === dialoguePortIds.output);
const dialogueAdders = dialogueModel.nodes.filter((node) =>
  node.data.kind === "endAdder" && node.data.details?.dialogueId === dialogueId,
);
if (
  !dialogueWorkspace ||
  !dialogueEntry ||
  !dialogueExit ||
  dialogueAdders.length !== 2 ||
  dialogueEntry.position.x + (dialogueEntry.width ?? 0) !== dialogueWorkspace.position.x ||
  dialogueExit.position.x !== dialogueWorkspace.position.x + (dialogueWorkspace.width ?? 0) ||
  !dialogueAdders.some((node) => node.data.details?.direction === "input") ||
  !dialogueAdders.some((node) => node.data.details?.direction === "output")
) {
  throw new Error("Expected floating Entry and End adders beside the conversation workspace and their ports on its edges.");
}
const dialogueTransitionsBeforeRemoval = dialogueProject.events.map((event) => [event.id, event.transitions]);
const discardedDialogueEntry = removeBoundaryPortSlot(dialogueProject, parent.id, "input", "temporary-entry", dialogueId);
const discardedDialogueExit = removeBoundaryPortSlot(dialogueProject, parent.id, "output", "temporary-exit", dialogueId);
if (
  discardedDialogueEntry.canvas?.scopes?.[dialogueScopeKey]?.entrySlots?.includes("temporary-entry") ||
  discardedDialogueEntry.canvas?.scopes?.[dialogueScopeKey]?.nodes?.[dialoguePortIds.input] ||
  discardedDialogueExit.canvas?.scopes?.[dialogueScopeKey]?.exitSlots?.includes("temporary-exit") ||
  discardedDialogueExit.canvas?.scopes?.[dialogueScopeKey]?.nodes?.[dialoguePortIds.output] ||
  JSON.stringify(discardedDialogueEntry.events.map((event) => [event.id, event.transitions])) !== JSON.stringify(dialogueTransitionsBeforeRemoval)
) {
  throw new Error("Expected unfinished conversation ports to be removable without changing narrative transitions.");
}
const dialogueRef = `dialogue:${parent.id}:${dialogueId}`;
const outputAliasTransitionId = "transition:dialogue-output-alias";
const outputAliasProject = structuredClone(dialogueProject);
outputAliasProject.events.find((event) => event.id === parent.id).decisions[0].dialogueId = dialogueId;
outputAliasProject.events.find((event) => event.id === parent.id).transitions.push({
  id: outputAliasTransitionId,
  from: dialogueRef,
  to: `dialogue-boundary:${parent.id}:${dialogueId}:output`,
  source: "graph",
});
const outputAliasPortId = `dialogue-boundary:${parent.id}:${dialogueId}:output:transition:${outputAliasTransitionId}`;
outputAliasProject.events.find((event) => event.id === parent.id).transitions.push({
  id: "transition:outcome-output-alias",
  from: `outcome:${parent.id}:decision:signal-response:accept`,
  to: outputAliasPortId,
  source: "graph",
});
const outputAliasModel = buildStoryCanvasModel(outputAliasProject, {
  scope: { kind: "dialogue", id: dialogueId, eventId: parent.id },
});
const sharedDialogueOutputId = `dialogue-boundary:${parent.id}:${dialogueId}:output`;
if (
  !outputAliasModel.nodes.some((node) => node.id === sharedDialogueOutputId) ||
  outputAliasModel.nodes.some((node) => node.id.startsWith(`${sharedDialogueOutputId}:transition:`)) ||
  outputAliasModel.edges.filter((edge) => edge.target === sharedDialogueOutputId).length < 2
) {
  throw new Error("Expected all conversation exits and legacy output aliases to converge on one shared conversation output.");
}
const ancestorEventId = "event:ancestor";
const hierarchyProject = structuredClone(dialogueProject);
const hierarchyOwner = hierarchyProject.events.find((event) => event.id === parent.id);
const hierarchyDialogue = hierarchyOwner.dialogues.find((item) => item.id === dialogueId);
hierarchyOwner.parentEventId = ancestorEventId;
hierarchyDialogue.beats = [{
  id: "beat:dialogue-return",
  kind: "speech",
  blockRef: { scriptId: "script:fixture", blockId: "block:event-speech" },
}];
hierarchyDialogue.entryBeatId = "beat:dialogue-return";
hierarchyProject.events.push({
  id: ancestorEventId,
  name: "Ancestor event",
  type: "normal",
  childEventIds: [parent.id],
  transitions: [],
});
hierarchyOwner.transitions.push(
  {
    id: "transition:ancestor-entry",
    from: entryPortId,
    to: dialogueRef,
    source: "graph",
  },
  {
    id: "transition:dialogue-opening-entry",
    from: `dialogue-boundary:${parent.id}:${dialogueId}:input`,
    to: `beat:${parent.id}:beat:dialogue-return`,
    source: "graph",
  },
  {
    id: "transition:container-self-return",
    from: dialogueRef,
    to: dialogueRef,
    source: "graph",
  },
  {
    id: "transition:container-ancestor-return",
    from: dialogueRef,
    to: ancestorEventId,
    source: "graph",
  },
  {
    id: "transition:content-parent-return",
    from: `beat:${parent.id}:beat:dialogue-return`,
    to: parent.id,
    source: "graph",
  },
);
const hierarchyDialogueModel = buildStoryCanvasModel(hierarchyProject, {
  scope: { kind: "dialogue", id: dialogueId, eventId: parent.id },
});
const hierarchyInputId = `dialogue-boundary:${parent.id}:${dialogueId}:input`;
const hierarchyOutputId = `dialogue-boundary:${parent.id}:${dialogueId}:output`;
const hierarchyInput = hierarchyDialogueModel.nodes.find((node) => node.id === hierarchyInputId);
const hierarchyOutput = hierarchyDialogueModel.nodes.find((node) => node.id === hierarchyOutputId);
const openingBeatId = `beat:${parent.id}:beat:dialogue-return`;
const openingEdges = hierarchyDialogueModel.edges.filter((edge) =>
  edge.source === hierarchyInputId && edge.target === openingBeatId,
);
const parentReturnEdge = hierarchyDialogueModel.edges.find((edge) => edge.id === "edge:transition:transition:content-parent-return");
const eventHierarchyModel = buildStoryCanvasModel(hierarchyProject, {
  scope: { kind: "event", id: parent.id },
});
const ancestorEventModel = buildStoryCanvasModel(hierarchyProject, {
  scope: { kind: "event", id: ancestorEventId },
});
const ancestorReturnEdge = ancestorEventModel.edges.find(
  (edge) => edge.id === "edge:transition:transition:container-ancestor-return",
);
const ancestorRestartOutputId = `boundary:${ancestorEventId}:output:restart`;
if (
  !hierarchyInput ||
  !hierarchyOutput ||
  openingEdges.length !== 1 ||
  hierarchyInput.data.details?.returnTarget === true ||
  hierarchyOutput.data.details?.returnRoute === true ||
  hierarchyDialogueModel.nodes.some((node) =>
    node.id === `${hierarchyInputId}:transition:transition:ancestor-entry` ||
    node.id === `${hierarchyOutputId}:transition:transition:container-self-return` ||
    node.id === `${hierarchyOutputId}:transition:transition:container-ancestor-return`,
  ) ||
  hierarchyDialogueModel.edges.some((edge) => edge.source === hierarchyOutputId && edge.target === hierarchyInputId) ||
  !parentReturnEdge ||
  parentReturnEdge.target !== hierarchyOutputId ||
  parentReturnEdge.data?.returnRoute === true ||
  canvasReturnConnectors(hierarchyDialogueModel.nodes, hierarchyDialogueModel.edges).has(parentReturnEdge?.id ?? "") ||
  !eventHierarchyModel.nodes.some((node) => node.id === `boundary:${parent.id}:output:restart`) ||
  !ancestorReturnEdge ||
  ancestorReturnEdge.target !== ancestorRestartOutputId ||
  ancestorReturnEdge.data?.returnRoute !== true
) {
  throw new Error("Expected event-hierarchy entry and return routes to stay on the event canvas while the Dialogue canvas uses only its shared boundaries.");
}

const model = buildStoryCanvasModel(project, { scope: { kind: "event", id: parent.id } });
const inputPort = model.nodes.find(
  (node) => node.data.kind === "boundary" && node.data.details?.direction === "input",
);
const outputPort = model.nodes.find(
  (node) => node.id === `boundary:${parent.id}:output:transition:parent-route`,
);
const addedEnd = model.nodes.find(
  (node) => node.id === `boundary:${parent.id}:output:extra-end`,
);
const addedEntry = model.nodes.find(
  (node) => node.id === `boundary:${parent.id}:input:extra-entry`,
);
const endAdder = model.nodes.find((node) => node.id === `end-adder:${parent.id}`);
const entryAdder = model.nodes.find((node) => node.id === `end-adder:input:${parent.id}`);
const routeB = model.nodes.find((node) => node.id === "event:route-b");
const dialogueNodeId = `dialogue:${parent.id}:dialogue:signal-response`;
const dialogueNode = model.nodes.find((node) => node.id === dialogueNodeId);
const workspace = model.nodes.find((node) => node.data.kind === "workspace");
if (inputPort?.data.title !== source.sequences[0].name || inputPort.data.subtitle !== "Sequence entry") {
  throw new Error("Expected the input boundary to identify the connected sequence entry.");
}
if (outputPort?.data.title !== "External output" || outputPort.data.subtitle !== "No branch") {
  throw new Error("Expected the output boundary to identify its destination event and branch.");
}
if (!routeB || !inputPort || !outputPort || inputPort.position.x >= routeB.position.x || outputPort.position.x <= routeB.position.x) {
  throw new Error("Expected automatic boundaries to frame the left and right of the nested canvas.");
}
if (!dialogueNode || !model.edges.some((edge) => edge.source === dialogueNodeId && edge.target === "event:route-a")) {
  throw new Error("Expected Dialogue containers to expose outgoing event routes.");
}
if (inputPort.draggable !== true || outputPort.draggable !== true) {
  throw new Error("Expected nested canvas boundary ports to be draggable.");
}
if (!workspace) {
  throw new Error("Expected a visible, resizable working area in the nested canvas.");
}
if (workspace.selectable !== false) {
  throw new Error("Expected the working-area guide to stay out of marquee selection.");
}
if (inputPort.position.x + (inputPort.width ?? 0) !== workspace.position.x || outputPort.position.x !== workspace.position.x + (workspace.width ?? 0)) {
  throw new Error("Expected Entry and End ports to meet the working-area edges without a gap.");
}
const desiredPortY = workspace.position.y + 180;
const movedOutputModel = layoutSubcanvasNodes(
  model.nodes.map((node) => node.id === outputPort.id
    ? { ...node, position: { x: node.position.x + 240, y: desiredPortY } }
    : node),
  { preserveWorkspace: true },
);
const movedOutput = movedOutputModel.find((node) => node.id === outputPort.id);
const movedOutputWorkspace = movedOutputModel.find((node) => node.data.kind === "workspace");
if (!movedOutput || !movedOutputWorkspace || movedOutput.position.y !== desiredPortY) {
  throw new Error("Expected a boundary port to keep its manually chosen vertical position.");
}
if (movedOutput.position.x !== movedOutputWorkspace.position.x + (movedOutputWorkspace.width ?? 0)) {
  throw new Error("Expected a moved boundary port to remain attached to the working-area edge.");
}
const savedPortProject = structuredClone(project);
savedPortProject.canvas.scopes[`event:${parent.id}`].nodes[outputPort.id] = {
  position: { x: -240, y: desiredPortY },
};
const reopenedModel = buildStoryCanvasModel(savedPortProject, { scope: { kind: "event", id: parent.id } });
const reopenedOutput = reopenedModel.nodes.find((node) => node.id === outputPort.id);
const reopenedWorkspace = reopenedModel.nodes.find((node) => node.data.kind === "workspace");
if (!reopenedOutput || !reopenedWorkspace || reopenedOutput.position.y !== desiredPortY) {
  throw new Error("Expected a moved boundary port to retain its saved vertical position after reopening.");
}
if (reopenedOutput.position.x !== reopenedWorkspace.position.x + (reopenedWorkspace.width ?? 0)) {
  throw new Error("Expected a reopened boundary port to remain attached to the current working-area edge.");
}
if (workspace.data.title || workspace.data.subtitle) {
  throw new Error("Expected the working-area guide to be free of instructional labels.");
}
if (addedEnd?.data.title !== "Add End") {
  throw new Error("Expected explicitly added End ports to remain available in the subcanvas.");
}
if (addedEntry?.data.title !== "Add Entry" || addedEntry.data.details?.slotId !== "extra-entry") {
  throw new Error("Expected explicitly added Entry ports to offer source-event configuration.");
}
const insertionY = workspace.position.y + 240;
const insertedEndProject = structuredClone(project);
insertedEndProject.canvas.scopes[`event:${parent.id}`].nodes[addedEnd.id] = {
  position: { x: workspace.position.x + (workspace.width ?? 0), y: insertionY },
};
const insertedEnd = buildStoryCanvasModel(insertedEndProject, { scope: { kind: "event", id: parent.id } })
  .nodes.find((node) => node.id === addedEnd.id);
if (!insertedEnd || insertedEnd.position.y !== insertionY || insertedEnd.position.x !== workspace.position.x + (workspace.width ?? 0)) {
  throw new Error("Expected a newly inserted End port to keep its chosen vertical position while staying attached to the working-area edge.");
}
if (
  !endAdder ||
  !entryAdder ||
  !addedEnd ||
  !addedEntry ||
  endAdder.position.x !== reopenedWorkspace.position.x + (reopenedWorkspace.width ?? 0) ||
  endAdder.position.y !== reopenedWorkspace.position.y ||
  endAdder.width !== 48 ||
  endAdder.height !== reopenedWorkspace.height ||
  endAdder.zIndex >= addedEnd.zIndex ||
  endAdder.selectable !== false ||
  endAdder.draggable !== false ||
  entryAdder.position.x + (entryAdder.width ?? 0) !== reopenedWorkspace.position.x ||
  entryAdder.position.y !== reopenedWorkspace.position.y ||
  entryAdder.height !== reopenedWorkspace.height ||
  entryAdder.selectable !== false ||
  entryAdder.draggable !== false
) {
  throw new Error("Expected non-selectable hover insertion zones beside both Entry and End ports.");
}

const temporaryEntryId = `boundary:${parent.id}:input:temporary-entry`;
const temporaryEndId = `boundary:${parent.id}:output:temporary-end`;
const unfinishedProject = structuredClone(project);
unfinishedProject.canvas.scopes[`event:${parent.id}`].entrySlots.push("temporary-entry");
unfinishedProject.canvas.scopes[`event:${parent.id}`].exitSlots.push("temporary-end");
unfinishedProject.canvas.scopes[`event:${parent.id}`].nodes[temporaryEntryId] = { position: { x: 0, y: 0 } };
unfinishedProject.canvas.scopes[`event:${parent.id}`].nodes[temporaryEndId] = { position: { x: 0, y: 0 } };
unfinishedProject.events = unfinishedProject.events.map((event) => event.id === parent.id
  ? { ...event, transitions: [...(event.transitions ?? []), { id: "unfinished-entry-link", from: temporaryEntryId, to: "event:route-a" }] }
  : event.id === "event:route-a"
    ? { ...event, transitions: [...(event.transitions ?? []), { id: "unfinished-end-link", from: event.id, to: temporaryEndId }] }
    : event);
const discardedProject = removeBoundaryPortSlot(unfinishedProject, parent.id, "input", "temporary-entry");
if (
  discardedProject.canvas.scopes[`event:${parent.id}`].entrySlots.includes("temporary-entry") ||
  discardedProject.canvas.scopes[`event:${parent.id}`].nodes[temporaryEntryId] ||
  discardedProject.events.some((event) => event.transitions?.some((transition) => transition.id === "unfinished-entry-link"))
) {
  throw new Error("Expected abandoning an unfinished Entry port to remove its slot, position and local connection.");
}
const discardedEndProject = removeBoundaryPortSlot(unfinishedProject, parent.id, "output", "temporary-end");
if (
  discardedEndProject.canvas.scopes[`event:${parent.id}`].exitSlots.includes("temporary-end") ||
  discardedEndProject.canvas.scopes[`event:${parent.id}`].nodes[temporaryEndId] ||
  discardedEndProject.events.some((event) => event.transitions?.some((transition) => transition.id === "unfinished-end-link"))
) {
  throw new Error("Expected abandoning an unfinished End port to remove its slot, position and local connection.");
}
const routedProject = {
  ...unfinishedProject,
  events: unfinishedProject.events.map((event) => event.id === "event:external-output"
    ? { ...event, transitions: [...(event.transitions ?? []), { id: "configured-input-route", from: event.id, to: parent.id }] }
    : event),
};
const resolvedProject = resolveBoundaryPortSlot(routedProject, parent.id, "input", "temporary-entry", "configured-input-route");
const stableEntryId = `boundary:${parent.id}:input:transition:configured-input-route`;
if (
  resolvedProject.canvas.scopes[`event:${parent.id}`].entrySlots.includes("temporary-entry") ||
  resolvedProject.events.find((event) => event.id === parent.id)?.transitions?.some((transition) => transition.from === stableEntryId && transition.to === "event:route-a") !== true
) {
  throw new Error("Expected configuring an Entry port to promote it to the incoming transition while preserving internal links.");
}
const routedOutputProject = {
  ...unfinishedProject,
  events: unfinishedProject.events.map((event) => event.id === parent.id
    ? { ...event, transitions: [...(event.transitions ?? []), { id: "configured-output-route", from: event.id, to: "event:external-output" }] }
    : event),
};
const resolvedOutputProject = resolveBoundaryPortSlot(routedOutputProject, parent.id, "output", "temporary-end", "configured-output-route");
const stableOutputId = `boundary:${parent.id}:output:transition:configured-output-route`;
if (
  resolvedOutputProject.canvas.scopes[`event:${parent.id}`].exitSlots.includes("temporary-end") ||
  resolvedOutputProject.events.find((event) => event.id === "event:route-a")?.transitions?.some((transition) => transition.to === stableOutputId) !== true
) {
  throw new Error("Expected configuring an End port to promote it to the outgoing transition while preserving internal links.");
}
const gateId = `route-gate:${parent.id}:${entryPortId}`;
if (!model.nodes.some((node) => node.id === gateId && node.data.kind === "routeGate")) {
  throw new Error("Expected a Route Gate for multiple Entry routes.");
}
const gateRouteEdges = model.edges.filter((edge) => edge.source === gateId && edge.data.kind === "transition");
if (gateRouteEdges.length !== entryRoutes.length) {
  throw new Error(`Expected ${entryRoutes.length} route transitions from the Route Gate, got ${gateRouteEdges.length}.`);
}
if (!gateRouteEdges.every((edge) => edge.sourceHandle === "route:output")) {
  throw new Error("Expected every subcanvas route to use the shared Route Gate output.");
}
const gate = model.nodes.find((node) => node.id === gateId);
if (!gate || gate.position.x + (gate.width ?? 0) > workspace.position.x + (workspace.width ?? 0)) {
  throw new Error("Expected the working area to include Route Gates when calculating its bounds.");
}
if (gate.zIndex !== 3) {
  throw new Error("Expected Route Gates to render above the working area.");
}
const singleContentNode = model.nodes.find((node) => node.data.kind === "event");
if (!singleContentNode) {
  throw new Error("Expected a content node for the single-node workspace fit check.");
}
const singleNodeBounds = fitSubcanvasWorkspaceBounds([singleContentNode], 2, 24);
const singleNodeWidth = singleContentNode.width ?? 230;
const singleNodeHeight = singleContentNode.height ?? 108;
if (singleNodeBounds.width !== singleNodeWidth + 96 || singleNodeBounds.height !== singleNodeHeight + 96) {
  throw new Error("Expected fitting a single-node subcanvas to keep only the configured grid padding around the node.");
}
if (singleNodeBounds.width >= 720 || singleNodeBounds.height >= 460) {
  throw new Error("Expected a single-node subcanvas to contract below the empty-workspace minimum size.");
}
const singleNodeWorkspace = {
  ...singleContentNode,
  id: "workspace:single-node-fit",
  data: { ...singleContentNode.data, kind: "workspace" },
  position: { x: singleNodeBounds.x, y: singleNodeBounds.y },
  width: singleNodeBounds.width,
  height: singleNodeBounds.height,
};
const stableSingleNodeWorkspace = layoutSubcanvasNodes([singleContentNode, singleNodeWorkspace])
  .find((node) => node.id === singleNodeWorkspace.id);
if (!stableSingleNodeWorkspace || stableSingleNodeWorkspace.width !== singleNodeBounds.width || stableSingleNodeWorkspace.height !== singleNodeBounds.height) {
  throw new Error("Expected automatic layout updates to preserve a fitted single-node workspace instead of re-expanding it.");
}
const previewedRightMove = layoutSubcanvasNodes(
  model.nodes.map((node) =>
    node.id === "event:route-b"
      ? { ...node, position: { x: 2500, y: node.position.y } }
      : node,
  ),
);
const previewedRightOutput = previewedRightMove.find((node) => node.id === outputPort.id);
if (!previewedRightOutput || previewedRightOutput.position.x <= outputPort.position.x) {
  throw new Error("Expected the output boundary to preview its new position while an internal node moves right.");
}
const previewedLeftMove = layoutSubcanvasNodes(
  model.nodes.map((node) =>
    node.id === "event:route-b"
      ? { ...node, position: { x: -600, y: node.position.y } }
      : node,
  ),
);
const previewedLeftInput = previewedLeftMove.find((node) => node.id === inputPort.id);
if (!previewedLeftInput || previewedLeftInput.position.x >= inputPort.position.x) {
  throw new Error("Expected the input boundary to preview its new position while an internal node moves left.");
}
const expandedNodes = layoutSubcanvasNodes(
  model.nodes.map((node) =>
    node.id === "event:route-b"
      ? { ...node, position: { x: 2500, y: node.position.y } }
      : node,
  ),
);
const expandedWorkspace = expandedNodes.find((node) => node.data.kind === "workspace");
const contractedWorkspace = layoutSubcanvasNodes(
  expandedNodes.map((node) =>
    node.id === "event:route-b"
      ? { ...node, position: { x: 420, y: node.position.y } }
      : node,
  ),
).find((node) => node.data.kind === "workspace");
if (!expandedWorkspace || !contractedWorkspace || contractedWorkspace.width !== expandedWorkspace.width || contractedWorkspace.height !== expandedWorkspace.height) {
  throw new Error("Expected the default working area to preserve its expanded size after a node moves back inside it.");
}

const decisionId = `decision:${parent.id}:decision:signal-response`;
const acceptOutcomeId = `outcome:${parent.id}:decision:signal-response:accept`;
const decision = model.nodes.find((node) => node.id === decisionId);
if (decision?.data.kind !== "decision" || !Array.isArray(decision.data.details?.options)) {
  throw new Error("Expected outcomes to be represented as options inside the Decision node.");
}
if (decision.width !== 230) {
  throw new Error("Expected the Decision selection bounds to match its 230 px visual card width.");
}
if (!model.edges.some((edge) => edge.source === decisionId && edge.sourceHandle === acceptOutcomeId)) {
  throw new Error("Expected an outcome to retain its own Decision output handle.");
}
const eventBeatId = `beat:${parent.id}:beat:event-speech`;
if (!model.nodes.some((node) => node.id === eventBeatId && node.data.kind === "speechBeat")) {
  throw new Error("Expected event-level dialogue beats beside decisions in the event canvas.");
}
const decisionGateId = `route-gate:${parent.id}:${acceptOutcomeId}`;
if (model.nodes.some((node) => node.id === decisionGateId)) {
  throw new Error("A single transition must stay direct; Logic Gates represent splits only.");
}

const declineOutcomeId = `outcome:${parent.id}:decision:signal-response:decline`;
const independentDecisionProject = {
  ...project,
  events: project.events.map((event) => event.id === parent.id
    ? {
        ...event,
        transitions: [
          ...(event.transitions ?? []),
          { id: "transition:signal-accept-restart", from: acceptOutcomeId, to: parent.id, source: "graph" },
          { id: "transition:signal-decline-a", from: declineOutcomeId, to: "event:route-a", source: "graph" },
        ],
      }
    : event),
};
const independentModel = buildStoryCanvasModel(independentDecisionProject, { scope: { kind: "event", id: parent.id } });
const restartOutputId = `boundary:${parent.id}:output:restart`;
const restartOutput = independentModel.nodes.find((node) => node.id === restartOutputId);
if (restartOutput?.data.title !== parent.name || restartOutput?.data.details?.restart !== true) {
  throw new Error("Expected a restart output to be visible only in the event subcanvas.");
}
if (!independentModel.edges.some((edge) => edge.target === restartOutputId && edge.data.kind === "transition")) {
  throw new Error("Expected an outcome transition to resolve to the restart output.");
}
for (const outcomeId of [acceptOutcomeId, declineOutcomeId]) {
  const gateId = `route-gate:${parent.id}:${outcomeId}`;
  const gateEdges = independentModel.edges.filter((edge) => edge.source === gateId && edge.data.kind === "transition");
  if (!independentModel.nodes.some((node) => node.id === gateId && node.data.kind === "routeGate")) {
    throw new Error(`Expected an independent Logic Gate for ${outcomeId}.`);
  }
  if (gateEdges.length !== 2 || !gateEdges.every((edge) => edge.sourceHandle === "route:output")) {
    throw new Error(`Expected the Logic Gate for ${outcomeId} to expose exactly its two routes.`);
  }
}
if (buildStoryCanvasModel(independentDecisionProject).nodes.some((node) => node.id === restartOutputId)) {
  throw new Error("The restart output must remain hidden outside the event subcanvas.");
}
const eventScopeKey = `event:${parent.id}`;
project.canvas = {
  ...project.canvas,
  scopes: {
    ...(project.canvas?.scopes ?? {}),
    [eventScopeKey]: { routeGateSources: [acceptOutcomeId] },
  },
};
const manuallyGatedEventModel = buildStoryCanvasModel(project, { scope: { kind: "event", id: parent.id } });
if (manuallyGatedEventModel.nodes.some((node) => node.id === decisionGateId)) {
  throw new Error("Legacy routeGateSources metadata must not force a Gate for a single route.");
}
const simpleRootModel = buildStoryCanvasModel(project);
if (simpleRootModel.nodes.some((node) => node.data.kind === "decision")) {
  throw new Error("Decisions must only render inside their event canvas.");
}
if (simpleRootModel.nodes.some((node) => node.id === "decision:event:route-a:decision:nested-only")) {
  throw new Error("Nested-event decisions must not appear in the parent canvas.");
}
if (simpleRootModel.nodes.some((node) => node.id === decisionGateId)) {
  throw new Error("A single parent-canvas route must stay direct.");
}
const rootScopeKey = `sequence:${project.sequences[0].id}`;
project.canvas = {
  ...project.canvas,
  scopes: {
    ...(project.canvas?.scopes ?? {}),
    [rootScopeKey]: { routeGateSources: [acceptOutcomeId] },
  },
};
const rootModel = buildStoryCanvasModel(project);
const decisionGate = rootModel.nodes.find((node) => node.id === decisionGateId);
if (decisionGate) {
  throw new Error("Legacy routeGateSources metadata must remain round-trippable without controlling parent-canvas presentation.");
}

console.log(JSON.stringify({ entryRoutes: entryRoutes.length, routeGate: gateId, ignoredLegacyGate: decisionGateId, outputPort: outputPort.id, workspace: workspace.id }, null, 2));

// Child returns and sibling routes are internal to the parent canvas. An
// unrelated event entering the parent must retain its external Entry port.
const chapterId = "event:nested-chapter";
const childA = "event:nested-a", childB = "event:nested-b";
const externalId = "event:external-entry";
const owned = { type: "state", subject: { kind: "entity", entityId: project.canonRefs[0].id }, stateId: "owned", operator: "has" };
const siblingOutcome = `outcome:${childA}:choose:sibling`;
const returnOutcome = `outcome:${childA}:choose:return`;
const nestedProject = {
  ...project,
  canvas: {},
  sequences: [{ id: "sequence:nested", name: "Nested", entryEventId: externalId, eventIds: [externalId, chapterId, childA, childB] }],
  events: [
    { id: chapterId, name: "Chapter", type: "normal", childEventIds: [childA], transitions: [{ id: "route:enter-child", from: chapterId, to: childA }] },
    { id: childA, name: "A", type: "normal", parentEventId: chapterId, decisions: [{ id: "choose", name: "Child-only choice", type: "dialogue", outcomes: [{ id: "sibling", name: "Sibling" }, { id: "return", name: "Return" }] }], transitions: [
      { id: "route:sibling", from: siblingOutcome, to: childB, conditions: owned, label: "Keep condition", order: 4 },
      { id: "route:return-outcome", from: returnOutcome, to: chapterId },
    ] },
    { id: childB, name: "B", type: "normal", parentEventId: chapterId, transitions: [
      { id: "route:b-sibling", from: childB, to: childA, conditions: owned, order: 0 },
      { id: "route:b-return", from: childB, to: chapterId, mode: "fallback", order: 1 },
    ] },
    { id: externalId, name: "External", type: "normal", transitions: [{ id: "route:external-entry", from: externalId, to: chapterId }] },
  ],
};
const nestedBefore = JSON.stringify(nestedProject);
const nestedWithoutReturns = {
  ...nestedProject,
  events: nestedProject.events.map((event) => childA === event.id || childB === event.id
    ? { ...event, transitions: (event.transitions ?? []).filter((transition) => transition.to !== chapterId) }
    : event),
};
for (const canvasLayerMode of ["visual", "logic"]) {
  const model = buildStoryCanvasModel(nestedWithoutReturns, { scope: { kind: "event", id: chapterId }, canvasLayerMode });
  assert.ok(!model.nodes.some((node) => node.id === `boundary:${chapterId}:output:restart`), "A return boundary must not appear until a child has an authored route back to its parent.");
}
for (const canvasLayerMode of ["visual", "logic"]) {
  const nestedModel = buildStoryCanvasModel(nestedProject, { scope: { kind: "event", id: chapterId }, canvasLayerMode });
  const inputs = nestedModel.nodes.filter(node => node.data.kind === "boundary" && node.data.details?.direction === "input");
  assert.deepEqual(inputs.map(node => node.data.details.transitionId), ["route:external-entry"], "Child returns must not become external input ports.");
  assert.equal(nestedModel.nodes.filter(node => node.id === `boundary:${chapterId}:output:restart`).length, 1, "Authored returns share the parent's restart boundary.");
  assert.ok(!nestedModel.nodes.some(node => node.data.kind === "decision"), "The parent must not expose a child's internal decision.");
  const siblingEdge = nestedModel.edges.find(edge => edge.id === "edge:transition:route:sibling");
  assert.equal(siblingEdge.source, childA);
  assert.equal(siblingEdge.target, childB, "A child→child route must be visible between their event cards.");
  assert.deepEqual(siblingEdge.data.conditions, owned);
  assert.equal(siblingEdge.data.routeSourceId, siblingOutcome, "The original outcome identity remains available for route editing.");
  assert.equal(siblingEdge.data.order, 4);
  assert.equal(siblingEdge.label, "Keep condition");
  const returnEdge = nestedModel.edges.find(edge => edge.id === "edge:transition:route:return-outcome");
  assert.equal(returnEdge.source, childA);
  assert.equal(returnEdge.target, `boundary:${chapterId}:output:restart`);
  const childGate = `route-gate:${childB}:${childB}`;
  assert.ok(nestedModel.nodes.some(node => node.id === childGate), "A child with ordered sibling/return routes must retain its own gate.");
  const gated = nestedModel.edges.filter(edge => edge.source === childGate && edge.data.kind === "transition");
  assert.deepEqual(gated.map(edge => edge.id), ["edge:transition:route:b-sibling", "edge:transition:route:b-return"]);
  assert.deepEqual(gated.map(edge => edge.target), [childA, `boundary:${chapterId}:output:restart`]);
  assert.equal(gated[1].data.mode, "fallback");
}
const childModel = buildStoryCanvasModel(nestedProject, { scope: { kind: "event", id: childA } });
assert.ok(childModel.nodes.some(node => node.id === `boundary:${childA}:input:route:b-sibling`), "A sibling route remains an external Entry when editing the child itself.");
assert.equal(JSON.stringify(nestedProject), nestedBefore, "Scoped projection must never change narrative data or existing canvas state.");
console.log("Nested canvas: sibling routes, shared returns, external entries and projection isolation passed in visual and logic modes.");

// An event's initialization routes must not masquerade as unavailable End
// destinations. An unknown external destination still needs a diagnostic port.
const internalEntryTargets = [
  childA,
  `decision:${chapterId}:hub`,
  `outcome:${chapterId}:hub:enter`,
  `dialogue:${chapterId}:conversation`,
  `beat:${chapterId}:event-beat`,
  `beat:${chapterId}:dialogue-beat`,
  `dialogue-start:${chapterId}:trigger`,
];
const entryProject = {
  ...nestedProject,
  events: nestedProject.events.map(event => event.id === chapterId ? {
    ...event,
    decisions: [{ id: "hub", name: "Index", type: "dialogue", outcomes: [{ id: "enter", name: "Enter" }] }],
    dialogues: [{ id: "conversation", title: "Conversation", beats: [{ id: "dialogue-beat", kind: "speech", blockRef: { scriptId: "script:fixture", blockId: "block:event-speech" } }] }],
    dialogueBeats: [{ id: "event-beat", kind: "speech", blockRef: { scriptId: "script:fixture", blockId: "block:event-speech" } }],
    dialogueStarts: [{ id: "trigger" }],
    transitions: [
      ...internalEntryTargets.map((to, index) => ({ id: `route:internal-entry:${index}`, from: chapterId, to })),
      { id: "route:unresolved-output", from: chapterId, to: "event:unresolved-output" },
      { id: "route:known-external-output", from: chapterId, to: externalId },
    ],
  } : event),
};
for (const canvasLayerMode of ["visual", "logic"]) {
  const entryModel = buildStoryCanvasModel(entryProject, { scope: { kind: "event", id: chapterId }, canvasLayerMode });
  const outputs = entryModel.nodes.filter(node => node.data.kind === "boundary" && node.data.details?.direction === "output");
  assert.ok(!outputs.some(node => internalEntryTargets.includes(node.data.details.targetEventId)), "Known local destinations must not generate external End ports.");
  const unresolvedOutput = outputs.find(node => node.data.details.targetEventId === "event:unresolved-output");
  assert.equal(unresolvedOutput?.data.subtitle, "Unavailable event", "An unknown external destination must retain its diagnostic End port.");
  assert.equal(outputs.find(node => node.data.details.targetEventId === externalId)?.data.title, "External", "Known external destinations retain their End port.");
}
console.log("Nested canvas: local initialization routes excluded from End ports; external diagnostics preserved.");

const returnNodes = [
  { id: "start", position: { x: 1600, y: 0 }, data: { kind: "start" } },
  { id: "entry", position: { x: 0, y: 0 } },
  { id: "gate", position: { x: 600, y: 0 }, data: { kind: "routeGate" } },
  { id: "source", position: { x: 400, y: 0 } },
  { id: "next", position: { x: 800, y: 0 } },
  { id: "below", position: { x: 400, y: 200 } },
  { id: "above", position: { x: 400, y: -200 } },
  { id: "left", position: { x: -900, y: 0 } },
  { id: "container", position: { x: 1000, y: 0 } },
  { id: "nested", parentId: "container", position: { x: 20, y: 0 } },
];
const returnEdge = (id, source, target, sourceHandle) => ({ id, source, target, sourceHandle, data: { kind: "transition", label: "" } });
const returnEdges = [
  { ...returnEdge("entry-link", "start", "entry"), data: { kind: "entry" } },
  { ...returnEdge("gate-input", "entry", "gate"), data: { kind: "contains" } },
  returnEdge("entry-source", "gate", "source"),
  returnEdge("return-a", "source", "entry", "a"),
  returnEdge("return-b", "source", "entry", "a"),
  returnEdge("other-outcome", "source", "entry", "b"),
  returnEdge("second-destination", "source", "source", "a"),
  returnEdge("forward", "source", "next"),
  returnEdge("vertical-forward", "source", "below"),
  returnEdge("upward-forward", "source", "above"),
  returnEdge("leftward-forward", "source", "left"),
  returnEdge("vertical-back", "below", "source"),
  returnEdge("nested-forward", "next", "nested"),
  returnEdge("nested-back", "nested", "next"),
  { ...returnEdge("explicit-restart", "source", "next"), data: { kind: "transition", returnRoute: true } },
  { ...returnEdge("condition-link", "next", "entry"), data: { kind: "condition" } },
];
const beforeReturns = JSON.stringify({ returnNodes, returnEdges });
const returnConnectors = canvasReturnConnectors(returnNodes, returnEdges);
assert.deepEqual(returnConnectors.get("return-a"), { visible: true, lane: 0, count: 2, edgeId: "return-a" });
assert.deepEqual(returnConnectors.get("return-b"), { visible: false, lane: 0, count: 2, edgeId: "return-a" });
assert.deepEqual(returnConnectors.get("other-outcome"), { visible: true, lane: 0, count: 1, edgeId: "other-outcome" });
assert.equal(returnConnectors.get("second-destination").lane, 1);
for (const id of ["forward", "vertical-forward", "upward-forward", "leftward-forward", "entry-link", "entry-source", "gate-input", "nested-forward", "condition-link"]) {
  assert.ok(!returnConnectors.has(id), `${id} must retain its ordinary flow presentation regardless of its position.`);
}
assert.ok(returnConnectors.has("vertical-back") && returnConnectors.has("nested-back") && returnConnectors.has("explicit-restart"));
assert.equal(JSON.stringify({ returnNodes, returnEdges }), beforeReturns, "Return connectors must preserve route and layout data.");
const movedNodes = returnNodes.map(node => ({ ...node, position: { x: 1200 - node.position.x, y: -node.position.y } }));
assert.deepEqual([...canvasReturnConnectors(movedNodes, returnEdges)], [...returnConnectors], "Dragging nodes and their parents must never reclassify connections.");
assert.deepEqual([...canvasReturnConnectors([...movedNodes].reverse(), [...returnEdges].reverse()).keys()].sort(), [...returnConnectors.keys()].sort(), "Classification must not depend on canvas array ordering.");

const forkNodes = ["start", "decision", "a", "b", "merge"].map(id => ({ id, position: { x: 0, y: 0 }, data: { kind: id === "start" ? "start" : "event" } }));
const forkEdges = [
  { ...returnEdge("fork-entry", "start", "decision"), data: { kind: "boundary" } },
  ...["a", "b"].map(id => ({ ...returnEdge(`choice-${id}`, "decision", id), data: { kind: "choice" } })),
  returnEdge("merge-a", "a", "merge"), returnEdge("merge-b", "b", "merge"),
];
assert.equal(canvasReturnConnectors(forkNodes, forkEdges).size, 0, "Converging alternatives are not returns to an earlier connected node.");
assert.deepEqual([...canvasReturnConnectors(forkNodes, [...forkEdges, returnEdge("close-loop", "merge", "decision")]).keys()], ["close-loop"], "Only the route closing the choice loop is a return, not every edge in the cycle.");

const detachedNodes = ["a", "b"].map(id => ({ id, position: { x: 0, y: 0 } }));
const detachedEdges = [returnEdge("ab", "a", "b"), returnEdge("ba", "b", "a")];
assert.deepEqual([...canvasReturnConnectors(detachedNodes, detachedEdges).keys()], ["ba"], "Disconnected loops have a stable entry-independent fallback.");

const sequenceId = "sequence:semantic-return";
const semanticProject = {
  ...source,
  sequences: [{ ...source.sequences[0], id: sequenceId, eventIds: ["event:entry", "event:middle", "event:tail"], entryEventId: "event:entry" }],
  events: [
    { ...source.events[0], id: "event:entry", parentEventId: undefined, childEventIds: [], decisions: [], dialogues: [], dialogueBeats: [], transitions: [{ id: "flow-entry", from: "event:entry", to: "event:middle", order: 0 }, { id: "flow-alternative", from: "event:entry", to: "event:tail", mode: "fallback", order: 1 }] },
    { ...source.events[0], id: "event:middle", parentEventId: undefined, childEventIds: [], decisions: [], dialogues: [], dialogueBeats: [], transitions: [{ id: "flow-middle", from: "event:middle", to: "event:tail" }] },
    { ...source.events[0], id: "event:tail", parentEventId: undefined, childEventIds: [], decisions: [], dialogues: [], dialogueBeats: [], transitions: [{ id: "return-tail", from: "event:tail", to: "event:entry" }] },
  ],
};
const beforeSemantic = JSON.stringify(semanticProject);
for (const canvasLayerMode of ["visual", "logic"]) {
  const semanticModel = buildStoryCanvasModel(semanticProject, { scope: { kind: "sequence", id: sequenceId }, canvasLayerMode });
  assert.ok(semanticModel.nodes.some(node => node.data.kind === "routeGate"), "Exercise the actual route-gate projection in both canvas layers.");
  const positioned = semanticModel.nodes.map((node, i) => ({ ...node, position: { x: 1500 - i * 300, y: i * 20 } }));
  const connectors = canvasReturnConnectors(positioned, semanticModel.edges);
  assert.deepEqual([...connectors.keys()], ["edge:transition:return-tail"], `${canvasLayerMode}: the authored sequence, not its reversed layout, determines the return.`);
}
assert.equal(JSON.stringify(semanticProject), beforeSemantic, "Return presentation must not rewrite authored transitions.");
console.log("Return connectors: semantic ancestors, gates, choices, merges, disconnected loops, drag invariance and immutable data verified.");
