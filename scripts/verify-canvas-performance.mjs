import assert from "node:assert/strict";
import { createCanvasValidationCache, requiresSubcanvasLayout } from "../lib/canvas/interactionPerformance.js";
import { createCanvasPresentationCache } from "../lib/canvas/presentationCache.js";
import { layoutMinimapMarkers, minimapMarkerGeometryKey } from "../lib/canvas/minimapMarkerLayout.js";
import { inspectorDocumentIndex } from "../lib/inspectorDocumentIndex.js";
import { diagnosticSelection } from "../lib/diagnosticPresentation.js";
import { createNarrativeValidationCache, narrativeContentUnchanged } from "../lib/narrativeValidation.js";
import { normalizeProject } from "../lib/projectSerialization.js";
import { buildStoryCanvasModel, layoutSubcanvasNodes } from "../lib/canvas/storyCanvasModel.js";

const project = normalizeProject({ specVersion: "0.1", projectId: "performance-test", name: "Performance", canonRefs: [], branches: [], events: [
  { id: "e", name: "Event", type: "normal", transitions: [{ id: "route", from: "e", to: "e-long" }] },
  { id: "e-long", name: "Second event", type: "ending" },
], sequences: [{ id: "s", name: "Sequence", eventIds: ["e", "e-long"], entryEventId: "e" }], scripts: [], externalFunctions: [], variables: {} });
const model = buildStoryCanvasModel(project, { scope: { kind: "sequence", id: "s" } });

function referenceMinimapMarkers(items, scale, viewBox, markerSize) {
  const mapWidth = 210;
  const mapHeight = 138;
  if (items.length < 2 || scale <= 0) return items.map(item => ({ x: item.centerX, y: item.centerY }));
  const contentWidth = viewBox.width * scale;
  const contentHeight = viewBox.height * scale;
  const offsetX = (mapWidth - contentWidth) / 2;
  const offsetY = (mapHeight - contentHeight) / 2;
  const inset = markerSize / 2 + 2;
  const clampX = x => Math.max(inset, Math.min(mapWidth - inset, x));
  const clampY = y => Math.max(inset, Math.min(mapHeight - inset, y));
  const anchors = items.map(item => ({
    x: clampX((item.centerX - viewBox.x) * scale + offsetX),
    y: clampY((item.centerY - viewBox.y) * scale + offsetY),
  }));
  const positions = anchors.map(point => ({ ...point }));
  const minDistance = markerSize + 2;
  for (let iteration = 0; iteration < 36; iteration += 1) {
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const first = positions[left];
        const second = positions[right];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.001) {
          const angle = ((left * 37 + right * 17) % 16) * Math.PI / 8;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - distance) * 0.52;
        const pushX = dx / distance * push;
        const pushY = dy / distance * push;
        first.x = clampX(first.x - pushX);
        first.y = clampY(first.y - pushY);
        second.x = clampX(second.x + pushX);
        second.y = clampY(second.y + pushY);
      }
    }
    positions.forEach((point, index) => {
      point.x = clampX(point.x + (anchors[index].x - point.x) * 0.035);
      point.y = clampY(point.y + (anchors[index].y - point.y) * 0.035);
    });
  }
  return items.map((_item, index) => ({
    x: viewBox.x + (positions[index].x - offsetX) / scale,
    y: viewBox.y + (positions[index].y - offsetY) / scale,
  }));
}

const minimapCases = [
  Array.from({ length: 48 }, (_item, index) => ({ centerX: 120 + index % 8 * 24, centerY: 90 + Math.floor(index / 8) * 30 })),
  Array.from({ length: 48 }, () => ({ centerX: 300, centerY: 220 })),
];
let randomSeed = 341987;
minimapCases.push(Array.from({ length: 100 }, () => {
  randomSeed = (randomSeed * 48271) % 2147483647;
  const centerX = randomSeed / 2147483647 * 7200;
  randomSeed = (randomSeed * 48271) % 2147483647;
  const centerY = randomSeed / 2147483647 * 3400;
  return { centerX, centerY };
}));
for (const items of minimapCases) {
  const viewBox = { x: 0, y: 0, width: 7600, height: 3600 };
  const scale = Math.min((210 - 16) / viewBox.width, (138 - 16) / viewBox.height);
  const optimized = layoutMinimapMarkers(items, scale, viewBox, 13).map(({ x, y }) => ({ x, y }));
  assert.deepEqual(optimized, referenceMinimapMarkers(items, scale, viewBox, 13), "cached minimap layout preserves the previous marker positions");
}
assert.equal(
  minimapMarkerGeometryKey(minimapCases[0]),
  minimapMarkerGeometryKey(minimapCases[0].map(item => ({ ...item, selected: true }))),
  "selection-only node changes keep the marker geometry cache key stable",
);

const globalWaypointProject = {
  ...project,
  canvas: { ...project.canvas, edgeWaypoints: { "edge:transition:route": [{ x: 420, y: 175 }] } },
};
assert.deepEqual(
  normalizeProject(globalWaypointProject).canvas.edgeWaypoints["edge:transition:route"],
  [{ x: 420, y: 175 }],
  "global transition route waypoints survive project normalization for save and reopen",
);
assert.deepEqual(
  buildStoryCanvasModel(globalWaypointProject, { scope: { kind: "sequence", id: "s" } }).edges.find(edge => edge.id === "edge:transition:route").data.waypoints,
  [{ x: 420, y: 175 }],
  "transition route waypoints survive canvas model reconstruction",
);
const scopedWaypointProject = {
  ...globalWaypointProject,
  canvas: {
    ...globalWaypointProject.canvas,
    scopes: { "sequence:s": { edgeWaypoints: { "edge:transition:route": [{ x: 610, y: 220 }] } } },
  },
};
assert.deepEqual(
  normalizeProject(scopedWaypointProject).canvas.scopes["sequence:s"].edgeWaypoints["edge:transition:route"],
  [{ x: 610, y: 220 }],
  "scope-specific transition route waypoints survive project normalization for save and reopen",
);
assert.deepEqual(
  buildStoryCanvasModel(scopedWaypointProject, { scope: { kind: "sequence", id: "s" } }).edges.find(edge => edge.id === "edge:transition:route").data.waypoints,
  [{ x: 610, y: 220 }],
  "scope-specific route waypoints take precedence over the project fallback",
);
let narrativeCalls = 0;
const narrativeValidation = createNarrativeValidationCache(() => { narrativeCalls++; return []; });
const narrativeFindings = narrativeValidation(project);
const presentationProject = { ...project, canvas: { ...project.canvas, activeScope: { kind: "event", id: "e" }, nodes: { e: { position: { x: 42, y: 90 } } } } };
assert.ok(narrativeContentUnchanged(project, presentationProject));
assert.equal(narrativeValidation(presentationProject), narrativeFindings);
assert.equal(narrativeCalls, 1, "scope, selection, position and dimensions do not rerun narrative validation");
narrativeValidation({ ...presentationProject, canvas: { ...presentationProject.canvas, activeSequenceId: "missing" } });
assert.equal(narrativeCalls, 2, "active sequence diagnostics still invalidate");
narrativeValidation({ ...project, events: project.events.map(event => ({ ...event, transitions: [] })) });
assert.equal(narrativeCalls, 3, "narrative and connection edits invalidate");
narrativeValidation({ ...project, variables: { changed: true } });
assert.equal(narrativeCalls, 4, "logic edits invalidate");
if (typeof globalThis.gc === "function") {
  function makeWeaklyCachedSnapshot() {
    const cache = createNarrativeValidationCache(() => []);
    let snapshot = { ...project, events: [{ ...project.events[0], text: { format: "plain", content: "x".repeat(2_000_000) } }] };
    cache(snapshot);
    const snapshotRef = new WeakRef(snapshot);
    snapshot = undefined;
    return { cache, snapshotRef };
  }
  const weaklyCachedSnapshot = makeWeaklyCachedSnapshot();
  weaklyCachedSnapshot.cache(project);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    globalThis.gc();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  assert.equal(weaklyCachedSnapshot.snapshotRef.deref(), undefined, "the validation cache must not retain a previous full event payload snapshot");
}
const previousWindow = globalThis.window;
try {
  globalThis.window = { __PATHBRANCHING_PERF_CAPTURE__: true };
  createNarrativeValidationCache(() => [{ code: "fixture" }])(project);
  const validationSpan = globalThis.window.__PATHBRANCHING_PERF_METRICS__?.spans.find(span => span.name === "narrative.validation");
  assert.equal(validationSpan?.details?.events, project.events.length, "opt-in validation metrics include the resident event count");
  assert.equal(validationSpan?.details?.findings, 1, "opt-in validation metrics include the finding count");
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}
let validations = 0;
const validation = createCanvasValidationCache((nodes, edges) => { validations++; return edges.filter(edge => !nodes.some(node => node.id === edge.target)); });
const findings = validation(model.nodes, model.edges);
const moved = model.nodes.map(node => ({ ...node, selected: true, position: { x: 100, y: 200 }, measured: { width: 300, height: 200 } }));
assert.equal(validation(moved, model.edges.map(edge => ({ ...edge, selected: true }))), findings);
assert.equal(validations, 1, "selection, dimensions and position do not invalidate topology");
const broken = [{ id: "new-route", source: "e", target: "missing" }];
assert.equal(validation(moved, broken).length, 1);
assert.equal(validations, 2);
assert.equal(validation([...moved, { ...model.nodes[0], id: "missing" }], broken).length, 0);
assert.equal(validations, 3, "adding a missing node repairs the cached finding");
assert.equal(requiresSubcanvasLayout([{ type: "select", id: "e", selected: true }]), false);
for (const change of [{ type: "position", id: "e", position: { x: 1, y: 2 } }, { type: "dimensions", id: "e", dimensions: { width: 1, height: 2 } }, { type: "remove", id: "e" }]) assert.equal(requiresSubcanvasLayout([change]), true);

const present = createCanvasPresentationCache();
const node = model.nodes.find(node => node.id === "e");
let value = 0;
const first = present([{ ...node, data: { ...node.data, onOpen: () => ++value } }]);
const second = present([{ ...node, data: { ...node.data, onOpen: () => value += 10 } }]);
assert.equal(second, first, "unchanged items and arrays retain identity");
first[0].data.onOpen();
assert.equal(value, 10, "reused handlers call the current closure");
const changed = present([{ ...node, selected: true, data: { ...node.data, onOpen: () => ++value } }]);
assert.notEqual(changed[0], first[0]);
assert.equal(changed[0].data, first[0].data, "selection does not replace data");
const editors = createCanvasPresentationCache();
const editorFirst = editors([{ ...node, data: { ...node.data, details: { eventEditor: { imageAssets: [], onDescriptionUpdate: () => value = 1 } } } }]);
const editorNext = editors([{ ...node, data: { ...node.data, details: { eventEditor: { imageAssets: [], onDescriptionUpdate: () => value = 2 } } } }]);
assert.equal(editorFirst, editorNext, "equivalent nested editor props preserve node identity");
assert.deepEqual(editorFirst[0].data.details.eventEditor.imageAssets, [], "empty arrays keep their value");
editorFirst[0].data.details.eventEditor.onDescriptionUpdate();
assert.equal(value, 2);
const editorHandler = editorFirst[0].data.details.eventEditor.onDescriptionUpdate;
editors([{ ...node, data: { ...node.data, details: { eventEditor: { imageAssets: [] } } } }]);
const editorRestored = editors([{ ...node, data: { ...node.data, details: { eventEditor: { imageAssets: [], onDescriptionUpdate: () => value = 3 } } } }]);
assert.notEqual(editorRestored[0].data.details.eventEditor.onDescriptionUpdate, editorHandler, "removed nested callbacks are released before the path is reused");
assert.equal(present([]).length, 0);
assert.notEqual(present([node])[0], changed[0], "removed IDs cannot keep stale selection or callbacks");
const index = inspectorDocumentIndex(project);
assert.equal(inspectorDocumentIndex(project), index);
assert.equal(index.events.get("e").name, "Event");
assert.equal(index.edgeOwners.get("edge:transition:route"), "e");
assert.equal(index.gateOwner("route-gate:e-long:entry"), "e-long");
assert.equal(index.node("e").eventId, "e");
assert.equal(inspectorDocumentIndex({ ...project, events: [...project.events, { ...project.events[0], name: "Duplicate" }] }).events.get("e").name, "Event", "invalid duplicate IDs retain the previous first-match lookup behavior");
const renamed = { ...project, events: project.events.map(event => event.id === "e" ? { ...event, name: "Renamed" } : event) };
assert.notEqual(inspectorDocumentIndex(renamed), index);
assert.equal(inspectorDocumentIndex(renamed).node("e").label, "Renamed");
assert.deepEqual(diagnosticSelection(project, "e-long/dialogue"), { type: "node", id: "e-long" });
assert.deepEqual(diagnosticSelection(project, 'Missing "route"'), { type: "edge", id: "route" });
assert.equal(diagnosticSelection(project, "new-event"), undefined);
assert.deepEqual(diagnosticSelection({ ...project, events: [...project.events, { id: "new-event", name: "New", type: "normal" }] }, "new-event"), { type: "node", id: "new-event" });

const nested = buildStoryCanvasModel(project, { scope: { kind: "event", id: "e" } });
const laidOut = layoutSubcanvasNodes(nested.nodes);
const stable = layoutSubcanvasNodes(laidOut);
assert.ok(stable.every((node, i) => node === laidOut[i]), "settled layout preserves unchanged item identities");
console.log("Canvas performance: topology invalidation, layout, presentation callbacks and document indexes passed.");
