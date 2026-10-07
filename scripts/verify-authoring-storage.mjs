import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const core = path.resolve(process.env.EVEREND_CORE_OUTPUT ?? "lib");
const { STORAGE_VERSION, loadPathBranchingWorkspace, serializeModularStoryFiles, serializePathBranchingManifest, storyPath, sequencePath, eventPath, eventEvpathPath } = await import(pathToFileURL(path.join(core, "pathBranchingWorkspace.js")));
const { normalizeProject } = await import(pathToFileURL(path.join(core, "projectSerialization.js")));
const { universeBatchFiles, saveUniverseStory } = await import(pathToFileURL(path.join(core, "projectPersistence.js")));

const story = { id: "storage-test", name: "Authoring Storage", path: storyPath("storage-test") };
const canon = { relativePath: "Canon/key.md", content: "---\nid: key\ntype: item\nname: Key\n---\n# Key\n" };
const universe = { relativePath: ".everend/universe.json", content: JSON.stringify({ name: "Storage test", localization: { primaryLocale: "en", locales: ["en", "es"] } }) };
const manifest = { relativePath: ".everend/.pathbranching/manifest.json", content: serializePathBranchingManifest({ version: "0.2", activeStoryId: story.id, stories: [story] }) };
const project = normalizeProject({
  specVersion: "0.1", projectId: "storage-test", storyId: story.id, name: story.name,
  canonRefs: [{ id: "key", kind: "item", label: "Key" }],
  sequences: [{ id: "s", name: "Sequence", eventIds: ["e"], entryEventId: "e" }], branches: [],
  events: [{ id: "e", name: "Event", type: "normal", text: { format: "plain", content: "Hello" } }],
  scripts: [], externalFunctions: [], variables: {},
  canonWorkingCopies: [{ canonRefId: "key", sourcePath: canon.relativePath, sourceContent: canon.content, sourceModifiedMs: 17, draftContent: "Draft", path: "working/key.md", createdAt: "2026-10-07", updatedAt: "2026-10-07" }],
  canonChangeSets: [{ specVersion: "0.1", id: "cs", kind: "canon-change-set", sourceApp: "pathbranching", target: { entityId: "key", path: canon.relativePath }, base: { content: canon.content, contentHash: "test-hash", capturedAt: "2026-10-07" }, proposed: { content: "Proposal" }, status: "proposed", revision: 2, createdAt: "2026-10-07", updatedAt: "2026-10-07" }],
  canonEntityGalleries: { key: ["key.png", "other.png"] },
  localizationCatalog: { primaryLocale: "en", locales: ["en", "es"], entries: { custom: { values: { en: "Custom", es: "Propio" } } } },
  playerProfiles: [{ id: "hero", name: "Hero", simulation: { variables: { strength: 5 }, inventory: ["key"] } }],
  playerSimulation: { variables: { strength: 5 }, visited: ["e"] }, activePlayerProfileId: "hero",
  entityInstances: [{ id: "key-a", entityId: "key", properties: { wear: 1 }, owner: { kind: "profile", profileId: "hero" } }, { id: "key-b", entityId: "key", properties: { wear: 8 } }],
  entityOverrides: [{ entityId: "key", container: false, grantable: true }],
  narrativeActions: [{ id: "examine", name: "Examine", entityId: "key", effects: [] }],
  narrativeRules: [{ id: "rule", name: "When entering", trigger: "enter", scope: { kind: "event", id: "e" }, repeat: "once", effects: [] }],
  authoringScenarios: [{ id: "scenario", name: "Keys", profileId: "hero", startNodeId: "e", state: { variables: { strength: 5 } } }],
});

const root = await mkdtemp(path.join(os.tmpdir(), "pb-authoring-storage-"));
try {
  const files = [universe, canon, manifest, ...serializeModularStoryFiles(project, story)].map((file, index) => ({ ...file, modifiedMs: index + 1 }));
  for (const file of files) {
    const target = path.join(root, file.relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
  const fromDisk = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else fromDisk.push({ relativePath: path.relative(root, target).replaceAll("\\", "/"), content: await readFile(target, "utf8") });
    }
  }
  await walk(root);
  const loaded = loadPathBranchingWorkspace(fromDisk);
  assert.equal(STORAGE_VERSION, "0.5");
  assert.equal(loaded.saveBlocked, false);
  assert.deepEqual(loaded.loadWarnings ?? [], []);
  for (const field of ["canonWorkingCopies", "canonChangeSets", "canonEntityGalleries", "playerProfiles", "playerSimulation", "activePlayerProfileId", "entityInstances", "entityOverrides", "narrativeActions", "narrativeRules", "authoringScenarios"]) {
    assert.deepEqual(loaded.activeProject[field], project[field], `${field} must survive modular disk storage`);
  }
  assert.deepEqual(loaded.activeProject.localizationCatalog.entries.custom, project.localizationCatalog.entries.custom);
  const again = loadPathBranchingWorkspace([universe, canon, manifest, ...serializeModularStoryFiles(loaded.activeProject, story)]);
  assert.deepEqual(again.activeProject.entityInstances, loaded.activeProject.entityInstances, "migration must be idempotent");

  for (const target of [story.path, sequencePath(story.id, "s"), eventPath(story.id, "s", "e")]) {
    const corrupt = files.map((file) => file.relativePath === target ? { ...file, content: "{broken-json" } : file);
    const broken = loadPathBranchingWorkspace(corrupt);
    assert.equal(broken.saveBlocked, true, `${target} corruption must block saving`);
    assert.ok(broken.loadWarnings.some((warning) => warning.includes(target)), "diagnostic must identify the file");
    const result = await saveUniverseStory("not-an-actual-universe", broken, broken.activeProject);
    assert.equal(result.ok, false, "incomplete save must stop before native/browser writes");
  }
  const missing = loadPathBranchingWorkspace(files.filter((file) => file.relativePath !== eventPath(story.id, "s", "e")));
  assert.equal(missing.saveBlocked, true, "a surviving evpath does not conceal a missing JSON sidecar");
  const missingText = loadPathBranchingWorkspace(files.filter((file) => file.relativePath !== eventEvpathPath(story.id, "s", "e")));
  assert.equal(missingText.saveBlocked, true, "0.5 missing canonical text must be diagnosed");
  const noManifest = loadPathBranchingWorkspace(files.filter((file) => file.relativePath !== manifest.relativePath));
  assert.equal(noManifest.saveBlocked, true, "existing stories cannot silently become a new empty universe");
  const malformedManifest = loadPathBranchingWorkspace(files.map((file) => file.relativePath === manifest.relativePath ? { ...file, content: '{"stories":null}' } : file));
  assert.equal(malformedManifest.saveBlocked, true);
  const opaqueText = files.map((file) => file.relativePath === eventEvpathPath(story.id, "s", "e") ? { ...file, content: file.content + "\n* broken option without brackets\n" } : file);
  const failedText = loadPathBranchingWorkspace(opaqueText);
  assert.equal(failedText.saveBlocked, true, "unreadable external canonical edits must not be overwritten");

  for (const version of ["0.2", "0.3", "0.4"]) {
    const legacy = loadPathBranchingWorkspace(files.filter((file) => !file.relativePath.endsWith(".evpath")).map((file) => file.relativePath.endsWith(".json") ? { ...file, content: file.content.replaceAll('"storageVersion": "0.5"', `"storageVersion": "${version}"`) } : file));
    assert.equal(legacy.saveBlocked, false, `legacy ${version} remains readable without evpath`);
    assert.equal(legacy.activeProject.events.length, 1);
  }
  const baselines = universeBatchFiles(files, serializeModularStoryFiles(project, story));
  assert.ok(baselines.every((file) => file.expectedExists && file.expectedContent !== undefined && file.expectedModifiedMs !== undefined));
  const textBaseline = baselines.find((file) => file.relativePath.endsWith(".evpath"));
  assert.equal(textBaseline.expectedContent, files.find((file) => file.relativePath === textBaseline.relativePath).content, "canonical text participates in exact conflict detection");
  const newBaseline = universeBatchFiles([], [{ relativePath: "new.json", content: "{}" }]);
  assert.equal(newBaseline[0].expectedExists, false);
  const withoutCanon = loadPathBranchingWorkspace(files.filter((file) => file.relativePath !== canon.relativePath));
  assert.ok(withoutCanon.activeProject.canonRefs.some((ref) => ref.id === "key"), "missing canon must remain diagnosable");
  console.log("Authoring storage 0.5: metadata, disk reopen, compatibility, corruption guards and all-file conflict baselines passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
