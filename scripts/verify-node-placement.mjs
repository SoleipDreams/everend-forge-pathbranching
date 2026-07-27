import assert from "node:assert/strict";
import { connectedNarrativeNodePosition } from "../lib/canvas/nodePlacement.js";

const source = {
  id: "beat:source",
  position: { x: 100, y: 203 },
  measured: { width: 360, height: 176 },
  data: { kind: "speechBeat", title: "", storyObjectId: "beat:source", badges: [] },
};

assert.deepEqual(
  connectedNarrativeNodePosition([source], source, { width: 360, height: 176 }, {
    snapToGrid: false,
    gridSize: 24,
  }),
  { x: 532, y: 203 },
  "the first quick-connected beat must appear to the right on the same row",
);

const gate = {
  id: "route-gate:beat:source",
  position: { x: 532, y: 203 },
  width: 168,
  height: 76,
  data: { kind: "routeGate", title: "", storyObjectId: "route-gate:beat:source", badges: [] },
};
assert.deepEqual(
  connectedNarrativeNodePosition([source, gate], source, { width: 360, height: 176 }, {
    snapToGrid: true,
    gridSize: 24,
  }),
  { x: 792, y: 203 },
  "an occupied slot must advance horizontally without changing the source Y",
);

const unrelatedNodeAbove = {
  id: "beat:above",
  position: { x: 532, y: -100 },
  measured: { width: 360, height: 176 },
  data: { kind: "speechBeat", title: "", storyObjectId: "beat:above", badges: [] },
};
assert.deepEqual(
  connectedNarrativeNodePosition([source, unrelatedNodeAbove], source, { width: 300, height: 170 }, {
    snapToGrid: true,
    gridSize: 24,
  }),
  { x: 552, y: 216 },
  "a shorter quick-connected node must remain vertically centered and grid aligned",
);

const fullSpeechBeat = {
  ...source,
  id: "beat:full-speech",
  position: { x: 96, y: 96 },
  measured: { width: 360, height: 264 },
};
assert.deepEqual(
  connectedNarrativeNodePosition([fullSpeechBeat], fullSpeechBeat, { width: 360, height: 168 }, {
    snapToGrid: true,
    gridSize: 24,
  }),
  { x: 528, y: 144 },
  "a director beat must be centered against the speech beat that creates it",
);

assert.deepEqual(
  connectedNarrativeNodePosition([fullSpeechBeat], fullSpeechBeat, { width: 300, height: 170 }, {
    snapToGrid: true,
    gridSize: 24,
  }),
  { x: 528, y: 144 },
  "a decision must be centered against the speech beat that creates it",
);

console.log("Speech beat quick-connector placement verified.");
