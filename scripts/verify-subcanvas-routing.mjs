import { readFile } from "node:fs/promises";
import { buildStoryCanvasModel, fitSubcanvasWorkspaceBounds, layoutSubcanvasNodes } from "../lib/canvas/storyCanvasModel.js";
import { parseProject } from "../lib/projectSerialization.js";

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
    to: "event:route-b",
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
      exitSlots: ["extra-end"],
      nodes: {
        "event:route-b": { position: { x: 1500, y: 120 } },
      },
    },
  },
};

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
const endAdder = model.nodes.find((node) => node.id === `end-adder:${parent.id}`);
const routeB = model.nodes.find((node) => node.id === "event:route-b");
const dialogueNodeId = `dialogue:${parent.id}:dialogue:signal-response`;
const dialogueNode = model.nodes.find((node) => node.id === dialogueNodeId);
const workspace = model.nodes.find((node) => node.data.kind === "workspace");
if (inputPort?.data.title !== source.sequences[0].name || inputPort.data.subtitle !== "Sequence entry") {
  throw new Error("Expected the input boundary to identify the connected sequence entry.");
}
if (outputPort?.data.title !== "Route B" || outputPort.data.subtitle !== "No branch") {
  throw new Error("Expected the output boundary to identify its destination event and branch.");
}
if (!routeB || !inputPort || !outputPort || inputPort.position.x >= routeB.position.x || outputPort.position.x <= routeB.position.x) {
  throw new Error("Expected automatic boundaries to frame the left and right of the nested canvas.");
}
if (!dialogueNode || !model.edges.some((edge) => edge.source === dialogueNodeId && edge.target === "event:route-a")) {
  throw new Error("Expected Dialogue containers to expose outgoing event routes.");
}
if (inputPort.draggable !== false || outputPort.draggable !== false) {
  throw new Error("Expected automatic boundary ports to stay pinned to the nested canvas edges.");
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
if (workspace.data.title || workspace.data.subtitle) {
  throw new Error("Expected the working-area guide to be free of instructional labels.");
}
if (addedEnd?.data.title !== "Add End") {
  throw new Error("Expected explicitly added End ports to remain available in the subcanvas.");
}
if (!endAdder || !addedEnd || endAdder.position.x <= addedEnd.position.x || endAdder.position.y <= addedEnd.position.y) {
  throw new Error("Expected the End control below and to the right of the End ports.");
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
if (restartOutput?.data.title !== "Restart event" || restartOutput?.data.details?.restart !== true) {
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
