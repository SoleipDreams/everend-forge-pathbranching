import assert from "node:assert/strict";
import { normalizeProject } from "../lib/projectSerialization.js";
import {
  eventEvpathPath,
  eventPath,
  loadPathBranchingWorkspace,
  pathBranchingMetadataPaths,
  serializeModularStoryFiles,
  serializePathBranchingManifest,
  sequencePath,
  storyPath,
} from "../lib/pathBranchingWorkspace.js";
import { mergeProgressiveEventBatch, obsoleteSequenceSidecarPaths, registerSharedBrowserUniverse, saveUniverseStory, universeBatchFiles } from "../lib/projectPersistence.js";
import { browserUniversePath, readBrowserUniverse } from "../lib/utils/browserUniverse.js";
import { sequenceEventIdsInBounds, buildStoryCanvasModel } from "../lib/canvas/storyCanvasModel.js";
import { ProgressiveStoryEventLoader } from "../lib/progressiveStoryLoader.js";

const storyId = "progressive-check";
const sequenceId = "sequence:progressive";
const events = Array.from({ length: 160 }, (_, index) => ({
  id: `event:progressive-${index}`,
  name: `Progressive event ${index}`,
  type: index === 159 ? "ending" : "normal",
  description: `Event description ${index}`,
  text: { format: "plain", content: `Story text for event ${index}.` },
  transitions: index < 159 ? [{ id: `route:progressive-${index}`, from: `event:progressive-${index}`, to: `event:progressive-${index + 1}` }] : [],
}));
const project = normalizeProject({
  specVersion: "0.1",
  projectId: storyId,
  storyId,
  name: "Progressive load check",
  entrySequenceId: sequenceId,
  sequences: [{ id: sequenceId, name: "Progressive sequence", eventIds: events.map((event) => event.id), entryEventId: events[0].id }],
  branches: [],
  events,
  scripts: [],
  externalFunctions: [],
  variables: {},
  canonRefs: [],
  canvas: { activeSequenceId: sequenceId },
});
const story = { id: storyId, name: project.name, path: storyPath(storyId) };
const eventFiles = serializeModularStoryFiles(project, story);
const commonFiles = [
  { relativePath: ".everend/universe.json", content: JSON.stringify({ id: "universe:progressive-check", name: "Progressive load check" }) },
  { relativePath: pathBranchingMetadataPaths.manifest, content: serializePathBranchingManifest({ version: "0.2", activeStoryId: storyId, stories: [story] }) },
  ...eventFiles.filter((file) => !file.relativePath.includes("/events/")),
];
const completeFiles = [...commonFiles, ...eventFiles.filter((file) => file.relativePath.includes("/events/"))];
const indexedPaths = completeFiles.map((file) => ({ relativePath: file.relativePath, sizeBytes: file.content.length, modifiedMs: 1 }));
const progressiveWorkspace = loadPathBranchingWorkspace(commonFiles, { fileIndex: indexedPaths });

assert.equal(progressiveWorkspace.saveBlocked, false, "indexed but unread event sidecars must not block a partial workspace");
assert.equal(progressiveWorkspace.eventLoad?.status, "loading");
assert.equal(progressiveWorkspace.activeProject.events.length, 0, "opening the story metadata must not eagerly parse event files");
assert.equal(progressiveWorkspace.eventLoad?.pendingEventIds.size, events.length);
assert.equal(progressiveWorkspace.activeProject.sequences[0].eventIds.length, events.length);

const visibleIds = sequenceEventIdsInBounds(project, { x: 300, y: 240, width: 900, height: 500 }, { kind: "sequence", id: sequenceId }, 0);
assert(visibleIds.length > 0 && visibleIds.length < events.length, "viewport lookup should produce a bounded event window");
const visibleModel = buildStoryCanvasModel(project, { scope: { kind: "sequence", id: sequenceId }, eventWindowIds: new Set(visibleIds) });
const visibleNodes = visibleModel.nodes.filter((node) => node.data.kind === "event");
assert.deepEqual(visibleNodes.map((node) => node.id), visibleIds, "the canvas model should only build event nodes in its render window");
const visibleNodeIds = new Set(visibleModel.nodes.map((node) => node.id));
assert(visibleModel.edges.every((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)), "windowed edges must not dangle");

const hydratedIds = events.slice(0, 4).map((event) => event.id);
const hydratedPaths = new Set(hydratedIds.flatMap((id) => [eventPath(storyId, sequenceId, id), eventEvpathPath(storyId, sequenceId, id)]));
const firstBatchFiles = completeFiles.filter((file) => hydratedPaths.has(file.relativePath));
const merged = mergeProgressiveEventBatch(progressiveWorkspace, { eventIds: hydratedIds, files: firstBatchFiles, errors: [] });
assert.equal(merged.project.events.length, hydratedIds.length);
assert.deepEqual(merged.project.events.map((event) => event.id), hydratedIds, "hydration must preserve sequence order");
assert.equal(merged.workspace.eventLoad?.loadedEvents, hydratedIds.length);
assert.equal(merged.workspace.eventLoad?.pendingEventIds.size, events.length - hydratedIds.length);
assert.equal(merged.workspace.saveBlocked, false);

const partialOutput = serializeModularStoryFiles(merged.project, story, { preserveUnloadedEventReferences: true });
const partialSequence = JSON.parse(partialOutput.find((file) => file.relativePath === sequencePath(storyId, sequenceId)).content).sequence;
assert.equal(partialSequence.eventIds.length, events.length, "partial saves must retain every indexed sequence reference");
const partialDeletes = obsoleteSequenceSidecarPaths(merged.workspace.files, partialOutput, storyId);
const partialWriteBatch = universeBatchFiles(merged.workspace.files, partialOutput, partialDeletes);
assert(!partialWriteBatch.some((file) => file.delete && file.relativePath.includes("/events/")), "a partial save must not delete an unhydrated event sidecar");

let modifiedMs = 1;
const createMemoryDirectory = (name) => {
  const children = new Map();
  return {
    name,
    _children: children,
    entries() { return (async function* () { yield* children.entries(); })(); },
    async getDirectoryHandle(childName, options = {}) {
      let child = children.get(childName);
      if (!child && options.create) { child = createMemoryDirectory(childName); children.set(childName, child); }
      if (!child?._children) throw new Error(`Directory not found: ${childName}`);
      return child;
    },
    async getFileHandle(childName, options = {}) {
      let child = children.get(childName);
      if (!child && options.create) {
        let content = "";
        child = {
          async getFile() { const snapshot = content; return { lastModified: modifiedMs, size: snapshot.length, async text() { return snapshot; } }; },
          async createWritable() {
            let nextContent = "";
            return { async write(value) { nextContent = String(value); }, async close() { content = nextContent; modifiedMs += 1; } };
          },
        };
        children.set(childName, child);
      }
      if (!child || child._children) throw new Error(`File not found: ${childName}`);
      return child;
    },
    async removeEntry(childName) { if (!children.delete(childName)) throw new Error(`Entry not found: ${childName}`); },
  };
};
const memoryUniverse = createMemoryDirectory("progressive-check");
for (const file of completeFiles) {
  const parts = file.relativePath.split("/");
  const name = parts.pop();
  let directory = memoryUniverse;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  let content = file.content;
  directory._children.set(name, {
    async getFile() { const snapshot = content; return { lastModified: modifiedMs, size: snapshot.length, async text() { return snapshot; } }; },
    async createWritable() { let nextContent = ""; return { async write(value) { nextContent = String(value); }, async close() { content = nextContent; modifiedMs += 1; } }; },
  });
}
const memoryUniversePath = browserUniversePath(memoryUniverse);
registerSharedBrowserUniverse(memoryUniversePath, memoryUniverse);
const partialSave = await saveUniverseStory(memoryUniversePath, merged.workspace, merged.project);
assert.equal(partialSave.ok, true, partialSave.message);
const savedFiles = await readBrowserUniverse(memoryUniverse);
assert.equal(savedFiles.filter((file) => file.relativePath.includes("/events/") && file.relativePath.endsWith(".json")).length, events.length);
assert.equal(savedFiles.filter((file) => file.relativePath.includes("/events/") && file.relativePath.endsWith(".evpath")).length, events.length);
const savedSequence = JSON.parse(savedFiles.find((file) => file.relativePath === sequencePath(storyId, sequenceId)).content).sequence;
assert.equal(savedSequence.eventIds.length, events.length, "a partial save must leave all unloaded event IDs in the sequence index");
const reopenedWorkspace = loadPathBranchingWorkspace(savedFiles);
assert.equal(reopenedWorkspace.activeProject.events.length, events.length, "a story saved during progressive loading must reopen with every event");
assert.equal(reopenedWorkspace.saveBlocked, false);

let releaseFirstRead;
const firstReadGate = new Promise((resolve) => { releaseFirstRead = resolve; });
const pathMap = new Map(events.map((event) => [event.id, [eventPath(storyId, sequenceId, event.id), eventEvpathPath(storyId, sequenceId, event.id)]]));
const readCalls = [];
const loader = new ProgressiveStoryEventLoader(pathMap, async (relativePaths) => {
  readCalls.push([...relativePaths]);
  if (readCalls.length === 1) await firstReadGate;
  const files = completeFiles.filter((file) => relativePaths.includes(file.relativePath));
  return { files, errors: [] };
}, 4);
const allEventIds = events.map((event) => event.id);
const backgroundLoad = loader.loadRemaining(allEventIds);
await new Promise((resolve) => setTimeout(resolve, 0));
const viewportEventId = allEventIds[10];
const viewportLoad = loader.request([viewportEventId], "viewport");
releaseFirstRead();
await Promise.all([backgroundLoad, viewportLoad]);
assert(readCalls[1].includes(eventPath(storyId, sequenceId, viewportEventId)), "a newly visible event should jump ahead of queued background events");
assert.deepEqual(readCalls[1], [eventPath(storyId, sequenceId, viewportEventId), eventEvpathPath(storyId, sequenceId, viewportEventId)], "viewport reads should not be mixed with lower-priority background files");
assert.equal(new Set(readCalls.flat()).size, events.length * 2, "each event file should be read once despite priority upgrades");
assert(readCalls.every((paths) => paths.length <= 8), "the loader must respect its bounded batch size");
loader.cancel();

const pausedReadCalls = [];
const pausedLoader = new ProgressiveStoryEventLoader(pathMap, async (relativePaths) => {
  pausedReadCalls.push([...relativePaths]);
  const files = completeFiles.filter((file) => relativePaths.includes(file.relativePath));
  return { files, errors: [] };
}, 4);
pausedLoader.pauseBackground();
const pausedBackgroundLoad = pausedLoader.loadRemaining(allEventIds);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(pausedReadCalls.length, 0, "pausing should hold queued background reads");
const visibleDuringPause = allEventIds[20];
await pausedLoader.request([visibleDuringPause], "viewport");
assert(pausedReadCalls[0].includes(eventPath(storyId, sequenceId, visibleDuringPause)), "viewport requests should stay responsive while background work is paused");
assert.equal(pausedReadCalls.length, 1, "a viewport request must not drain unrelated background batches");
pausedLoader.resumeBackground();
await pausedBackgroundLoad;
assert.equal(new Set(pausedReadCalls.flat()).size, events.length * 2, "resuming should finish all queued background event files");
pausedLoader.cancel();

assert(sequencePath(storyId, sequenceId).endsWith(`/sequences/sequence-progressive/sequence.json`));
console.log("Progressive loading: indexed open, viewport windowing, priority batches, pause/resume, hydration order, and partial-save sidecar safety passed.");
