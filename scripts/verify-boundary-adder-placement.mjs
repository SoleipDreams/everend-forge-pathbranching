import assert from "node:assert/strict";
import { boundaryAdderPlacement } from "../lib/canvas/boundaryAdderPlacement.js";

const pane = { left: 0, right: 1600, top: 0, bottom: 900 };
const oversizedWorkspace = { left: -168, right: 5092, top: -358, bottom: 1307 };

const inputFallback = boundaryAdderPlacement("input", pane, oversizedWorkspace, 2, 24, 450);
const outputFallback = boundaryAdderPlacement("output", pane, oversizedWorkspace, 2, 1576, 450);
assert.deepEqual(inputFallback, { x: 24, y: 450, size: 36, revealPort: true });
assert.deepEqual(outputFallback, { x: 1576, y: 450, size: 36, revealPort: true });
assert.equal(boundaryAdderPlacement("input", pane, oversizedWorkspace, 2, 800, 450), undefined);
assert.equal(boundaryAdderPlacement("output", pane, oversizedWorkspace, 2, 800, 450), undefined);

const visibleWorkspace = { left: 300, right: 800, top: 100, bottom: 700 };
const inputEdge = boundaryAdderPlacement("input", pane, visibleWorkspace, 1, 320, 450);
const outputEdge = boundaryAdderPlacement("output", pane, visibleWorkspace, 1, 780, 450);
assert.deepEqual(inputEdge, { x: 282, y: 450, size: 36, revealPort: false });
assert.deepEqual(outputEdge, { x: 818, y: 450, size: 36, revealPort: false });
assert.equal(inputEdge.x + inputEdge.size / 2, visibleWorkspace.left);
assert.equal(outputEdge.x - outputEdge.size / 2, visibleWorkspace.right);
assert.equal(boundaryAdderPlacement("input", pane, visibleWorkspace, 1, 100, 450), undefined);
assert.equal(boundaryAdderPlacement("output", pane, visibleWorkspace, 1, 1100, 450), undefined);

const outputNearViewportEdge = { ...visibleWorkspace, right: 1588 };
assert.deepEqual(
  boundaryAdderPlacement("output", pane, outputNearViewportEdge, 1, 1576, 450),
  { x: 1576, y: 450, size: 36, revealPort: true },
);

console.log("Entry/End adders stay reachable at both viewport edges and attach outside visible workspace borders.");
