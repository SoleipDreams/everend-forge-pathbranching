import { invoke } from "@tauri-apps/api/core";
import type { BranchingProject, ProjectAsset, RuntimePackage } from "./domain.js";
import {
  hydratePathBranchingEvents,
  loadPathBranchingWorkspace,
  eventEvpathPath,
  eventPath,
  pathBranchingMetadataPaths,
  serializeModularStoryFiles,
  serializePathBranchingManifest,
  storyPath,
  STORAGE_VERSION,
  workingCopyPathForCanonRef,
  type PathBranchingWorkspace,
  type UniverseFile,
  type UniverseFileIndexEntry,
  type UniverseProfile,
} from "./pathBranchingWorkspace.js";
import { normalizeProject, parseProject, projectFileName, serializeProject } from "./projectSerialization.js";
import { serializeIntegrationConfigYaml } from "./integrationConfig.js";
import { isTauriRuntime } from "./utils/appEnvironment.js";
import {
  browserUniversePath,
  deleteBrowserUniverseFile,
  ensureBrowserUniverseWritePermission,
  indexBrowserUniverse,
  pickBrowserUniverse,
  readBrowserUniverse,
  readBrowserUniverseFiles,
  type BrowserDirectoryHandle,
  writeBrowserUniverseFile,
} from "./utils/browserUniverse.js";
import { createDemoBrowserUniverse } from "./utils/demoBrowserUniverse.js";
import { ProgressiveStoryEventLoader, type StoryEventFileBatch, type StoryEventFileReadError } from "./progressiveStoryLoader.js";

export { normalizeProject, parseProject, projectFileName, serializeProject } from "./projectSerialization.js";

export type ProjectFileState = {
  path?: string;
  universePath?: string;
  storyPath?: string;
  dirty: boolean;
  lastSavedAt?: number;
  modifiedMs?: number;
  universeProfile?: UniverseProfile;
};

export type ProjectFilePayload = {
  path: string;
  content: string;
  modifiedMs?: number;
};

export type WriteResult = {
  ok: boolean;
  path: string;
  modifiedMs?: number;
  message?: string;
};

export type SaveUniverseStoryResult = WriteResult & {
  storyPath?: string;
  storyModifiedMs?: number;
  manifest?: PathBranchingWorkspace["manifest"];
  manifestModifiedMs?: number;
  savedFiles?: UniverseFile[];
};

export type UniverseBatchFile = {
  relativePath: string;
  content: string;
  delete?: boolean;
  expectedExists: boolean;
  expectedContent?: string;
  expectedModifiedMs?: number;
};

export type UniverseBatchResult = WriteResult & { files: Array<{ relativePath: string; modifiedMs?: number }> };

export type UniverseReadResult = {
  rootPath: string;
  files: Array<UniverseFile & { absolutePath?: string }>;
  directories: string[];
  errors: Array<{ relativePath: string; message: string }>;
};

export type UniverseIndexResult = {
  rootPath: string;
  files: UniverseFileIndexEntry[];
  directories: string[];
  errors: Array<{ relativePath: string; message: string }>;
};

export type OpenedUniverse = {
  workspace: PathBranchingWorkspace;
  path: string;
  files: UniverseReadResult["files"];
  eventLoader?: ProgressiveStoryEventLoader;
};

function workspaceFromReadResult(payload: UniverseReadResult): PathBranchingWorkspace {
  const workspace = loadPathBranchingWorkspace(payload.files);
  const failures = payload.errors.filter((error) => error.relativePath === "." || error.relativePath === ".everend" || error.relativePath.startsWith(pathBranchingMetadataPaths.root))
    .map((error) => `Incomplete story: could not read ${error.relativePath}: ${error.message}`);
  return failures.length ? {
    ...workspace,
    loadingIncomplete: true,
    saveBlocked: true,
    loadWarnings: [...(workspace.loadWarnings ?? []), ...failures],
    saveBlockReasons: [...(workspace.saveBlockReasons ?? []), ...failures],
  } : workspace;
}

function workspaceFromIndexedFiles(
  files: UniverseReadResult["files"],
  fileIndex: UniverseFileIndexEntry[],
  errors: Array<{ relativePath: string; message: string }>,
  activeStoryId?: string,
  deferEventSidecars = false,
): PathBranchingWorkspace {
  const preparedFiles = activeStoryId ? files.map((file) => {
    if (file.relativePath !== pathBranchingMetadataPaths.manifest) return file;
    try {
      const manifest = JSON.parse(file.content) as { activeStoryId?: string; stories?: unknown[] };
      return { ...file, content: `${JSON.stringify({ ...manifest, activeStoryId }, null, 2)}\n` };
    } catch {
      return file;
    }
  }) : files;
  const workspace = loadPathBranchingWorkspace(preparedFiles, { fileIndex, deferEventSidecars });
  const failures = errors.filter((error) => error.relativePath === "." || error.relativePath === ".everend" || error.relativePath.startsWith(pathBranchingMetadataPaths.root))
    .map((error) => `Incomplete story: could not read ${error.relativePath}: ${error.message}`);
  return failures.length ? {
    ...workspace,
    loadingIncomplete: true,
    saveBlocked: true,
    eventLoad: workspace.eventLoad ? { ...workspace.eventLoad, status: "incomplete" } : undefined,
    loadWarnings: [...(workspace.loadWarnings ?? []), ...failures],
    saveBlockReasons: [...(workspace.saveBlockReasons ?? []), ...failures],
  } : workspace;
}

function isSaveBlockingWorkspaceWarning(warning: string): boolean {
  return warning.startsWith("Incomplete story:")
    || warning.startsWith("Could not parse ")
    || warning.startsWith("Ignored ")
    || warning.startsWith("Could not load ")
    || warning.startsWith("No se pudo leer el texto")
    || warning.startsWith("El texto editado");
}

export function mergeProgressiveEventBatch(
  workspace: PathBranchingWorkspace,
  batch: StoryEventFileBatch,
): { workspace: PathBranchingWorkspace; project: BranchingProject } {
  if (!workspace.activeStory) return { workspace, project: workspace.activeProject };
  const hydrated = hydratePathBranchingEvents(
    workspace.activeProject,
    workspace.activeStory,
    workspace.storageVersion,
    batch.files,
    batch.eventIds,
  );
  const readWarnings = batch.errors.map((error) => `Incomplete story: could not read ${error.relativePath}: ${error.message}`);
  const addedWarnings = [...hydrated.warnings, ...readWarnings];
  const loadWarnings = [...(workspace.loadWarnings ?? []), ...addedWarnings];
  const newBlockReasons = addedWarnings.filter(isSaveBlockingWorkspaceWarning);
  const saveBlockReasons = [...(workspace.saveBlockReasons ?? []), ...newBlockReasons];
  const pendingEventIds = new Set(workspace.eventLoad?.pendingEventIds ?? []);
  batch.eventIds.forEach((id) => pendingEventIds.delete(id));
  const loadedEventIds = new Set(hydrated.loadedEventIds);
  const eventLoad = workspace.eventLoad ? {
    ...workspace.eventLoad,
    status: saveBlockReasons.length ? "incomplete" as const : pendingEventIds.size ? "loading" as const : "ready" as const,
    loadedEvents: Math.min(workspace.eventLoad.totalEvents, workspace.eventLoad.loadedEvents + loadedEventIds.size),
    failedEvents: workspace.eventLoad.failedEvents + hydrated.failedEventIds.length,
    pendingEventIds,
  } : undefined;
  const nextWorkspace: PathBranchingWorkspace = {
    ...workspace,
    activeProject: hydrated.project,
    // The loader requests each sidecar once. Append the new files directly to
    // avoid rebuilding a path Map for every incremental batch while retaining
    // the contents needed for conflict checks and partial saves.
    files: [...workspace.files, ...batch.files],
    eventLoad,
    loadWarnings: loadWarnings.length ? loadWarnings : undefined,
    loadingIncomplete: Boolean(workspace.loadingIncomplete || newBlockReasons.length),
    saveBlocked: Boolean(workspace.saveBlocked || newBlockReasons.length),
    saveBlockReasons: saveBlockReasons.length ? saveBlockReasons : undefined,
  };
  return { workspace: nextWorkspace, project: hydrated.project };
}

export type BridgeStatus = {
  ok: boolean;
  runtime: string;
  message: string;
};

export type ImportedAsset = Omit<ProjectAsset, "id" | "origin" | "importedAt">;

let selectedBrowserUniverse: BrowserDirectoryHandle | undefined;
const sharedBrowserUniverses = new Map<string, BrowserDirectoryHandle>();

/** Register a folder selected by an integrated browser shell before loading its shared path. */
export function registerSharedBrowserUniverse(path: string, root: BrowserDirectoryHandle): void {
  sharedBrowserUniverses.set(path, root);
  selectedBrowserUniverse = root;
}

function currentBrowserUniverse(path: string): BrowserDirectoryHandle | undefined {
  const shared = sharedBrowserUniverses.get(path);
  if (shared) return shared;
  if (!selectedBrowserUniverse || path !== browserUniversePath(selectedBrowserUniverse)) return undefined;
  return selectedBrowserUniverse;
}

function isEventSidecarPath(relativePath: string): boolean {
  return relativePath.startsWith(`${pathBranchingMetadataPaths.stories}/`)
    && relativePath.includes("/sequences/")
    && relativePath.includes("/events/")
    && /\.(?:json|evpath)$/i.test(relativePath);
}

function isPathBranchingEventsDirectory(relativePath: string): boolean {
  if (!relativePath.startsWith(`${pathBranchingMetadataPaths.stories}/`)) return false;
  const segments = relativePath.split("/");
  return segments.some((segment, index) => segment === "sequences" && segments[index + 2] === "events" && index + 3 === segments.length);
}

function omitEventSidecars(index: UniverseIndexResult): UniverseIndexResult {
  return {
    ...index,
    files: index.files.filter((file) => !isEventSidecarPath(file.relativePath)),
    directories: index.directories.filter((directory) => !isPathBranchingEventsDirectory(directory)),
  };
}

async function readUniverseIndex(path: string, includeEventSidecars = false): Promise<UniverseIndexResult> {
  const browserUniverse = currentBrowserUniverse(path);
  if (browserUniverse) {
    const index = await indexBrowserUniverse(browserUniverse);
    return includeEventSidecars ? index : omitEventSidecars(index);
  }
  assertDesktopRuntime("Indexing a universe");
  const index = await invoke<UniverseIndexResult>("read_universe_index", { path, includeEventSidecars });
  return includeEventSidecars ? index : omitEventSidecars(index);
}

async function readUniverseFileBatch(path: string, relativePaths: readonly string[]): Promise<{ files: UniverseReadResult["files"]; errors: StoryEventFileReadError[] }> {
  const browserUniverse = currentBrowserUniverse(path);
  if (browserUniverse) return readBrowserUniverseFiles(browserUniverse, relativePaths);
  assertDesktopRuntime("Reading universe files");
  const result = await invoke<UniverseReadResult>("read_universe_files", { path, relativePaths: [...relativePaths] });
  return { files: result.files, errors: result.errors };
}

async function openIndexedUniverse(
  path: string,
  index: UniverseIndexResult,
  activeStoryId?: string,
): Promise<OpenedUniverse> {
  const basePaths = index.files.filter((file) => !isEventSidecarPath(file.relativePath)).map((file) => file.relativePath);
  const baseRead = await readUniverseFileBatch(path, basePaths);
  const errors = [...index.errors, ...baseRead.errors];
  const workspace = workspaceFromIndexedFiles(baseRead.files, index.files, errors, activeStoryId, true);
  const activeStory = workspace.activeStory;
  const filePathsByEventId = new Map<string, string[]>();
  if (activeStory && !activeStory.path.endsWith(".pathbranching.json")) {
    for (const sequence of workspace.activeProject.sequences) {
      for (const eventId of sequence.eventIds) {
        const paths = [eventPath(activeStory.id, sequence.id, eventId), eventEvpathPath(activeStory.id, sequence.id, eventId)];
        if (workspace.eventLoad?.pendingEventIds.has(eventId)) filePathsByEventId.set(eventId, paths);
      }
    }
  }
  const eventLoader = filePathsByEventId.size
    ? new ProgressiveStoryEventLoader(
        filePathsByEventId,
        async (relativePaths) => {
          const result = await readUniverseFileBatch(path, relativePaths);
          return workspace.storageVersion === STORAGE_VERSION
            ? result
            : { ...result, errors: result.errors.filter((error) => !/\.evpath$/i.test(error.relativePath)) };
        },
        // Keep the first visible window small; larger background batches amortize native bridge reads.
        16,
        128,
      )
    : undefined;
  return { workspace, path: index.rootPath || path, files: workspace.files, eventLoader };
}

export async function importUniverseAssets(universePath: string): Promise<ImportedAsset[]> {
  assertDesktopRuntime("Importing assets");
  return invoke<ImportedAsset[]>("import_universe_assets", { universePath });
}

export async function importSceneImages(universePath: string): Promise<ImportedAsset[]> {
  assertDesktopRuntime("Importing scene images");
  return invoke<ImportedAsset[]>("import_scene_images", { universePath });
}

export async function indexCanonAssets(universePath: string): Promise<ImportedAsset[]> {
  assertDesktopRuntime("Indexing Canon assets");
  return invoke<ImportedAsset[]>("index_canon_assets", { universePath });
}

function assertDesktopRuntime(action: string) {
  if (!isTauriRuntime()) {
    throw new Error(`${action} requires the Everend PathBranching desktop app.`);
  }
}

export async function openProjectDialog(): Promise<{ project: BranchingProject; path: string; modifiedMs?: number } | undefined> {
  assertDesktopRuntime("Opening a local project");
  const payload = await invoke<ProjectFilePayload | null>("open_project_dialog");
  if (!payload) {
    return undefined;
  }
  return {
    project: parseProject(payload.content),
    path: payload.path,
    modifiedMs: payload.modifiedMs,
  };
}

export async function openUniverseDialog(options: { progressive?: boolean } = {}): Promise<OpenedUniverse | undefined> {
  const progressive = options.progressive ?? true;
  if (!isTauriRuntime()) {
    const picked = await pickBrowserUniverse();
    if (picked.status === "cancelled") return undefined;
    const root = picked.root;
    await ensureBrowserUniverseWritePermission(root);
    if (progressive) {
      selectedBrowserUniverse = root;
      const path = browserUniversePath(root);
      const index = await readUniverseIndex(path);
      return openIndexedUniverse(path, index);
    }
    const files = await readBrowserUniverse(root);
    selectedBrowserUniverse = root;
    const path = browserUniversePath(root);
    return { workspace: loadPathBranchingWorkspace(files), path, files };
  }
  if (progressive) {
    const payload = await invoke<UniverseIndexResult | null>("open_universe_index_dialog");
    return payload ? openIndexedUniverse(payload.rootPath, payload) : undefined;
  }
  const payload = await invoke<UniverseReadResult | null>("open_universe_dialog");
  if (!payload) return undefined;
  return {
    workspace: workspaceFromReadResult(payload),
    path: payload.rootPath,
    files: payload.files,
  };
}

export async function openDemoUniverse(): Promise<{
  workspace: PathBranchingWorkspace;
  path: string;
  files: UniverseReadResult["files"];
}> {
  const root = createDemoBrowserUniverse();
  const files = await readBrowserUniverse(root);
  selectedBrowserUniverse = root;
  const path = browserUniversePath(root);
  return { workspace: loadPathBranchingWorkspace(files), path, files };
}

export async function verifyDesktopBridge(): Promise<BridgeStatus> {
  assertDesktopRuntime("Checking the WorldNotion bridge");
  return invoke<BridgeStatus>("bridge_status");
}

export async function openUniversePath(path: string, options: { progressive?: boolean; activeStoryId?: string } = {}): Promise<OpenedUniverse> {
  if (options.progressive) {
    const index = await readUniverseIndex(path);
    return openIndexedUniverse(path, index, options.activeStoryId);
  }
  const browserUniverse = currentBrowserUniverse(path);
  if (browserUniverse) {
    const files = await readBrowserUniverse(browserUniverse);
    return { workspace: loadPathBranchingWorkspace(files), path, files };
  }
  if (!isTauriRuntime()) {
    throw new Error("This browser session no longer has access to that folder. Select the universe folder again.");
  }
  assertDesktopRuntime("Opening a recent universe");
  const payload = await invoke<UniverseReadResult>("read_universe_folder", { path });
  return {
    workspace: workspaceFromReadResult(payload),
    path: payload.rootPath,
    files: payload.files,
  };
}

export async function openUniverseStory(path: string, storyId: string, options: { progressive?: boolean } = {}): Promise<OpenedUniverse> {
  if (options.progressive) return openUniversePath(path, { progressive: true, activeStoryId: storyId });
  const opened = await openUniversePath(path);
  const files = opened.files.map((file) => {
    if (file.relativePath !== pathBranchingMetadataPaths.manifest) {
      return file;
    }
    try {
      const manifest = JSON.parse(file.content) as { activeStoryId?: string; stories?: unknown[] };
      return {
        ...file,
        content: `${JSON.stringify({ ...manifest, activeStoryId: storyId }, null, 2)}\n`,
      };
    } catch {
      return file;
    }
  });
  return {
    workspace: loadPathBranchingWorkspace(files),
    path: opened.path,
    files,
  };
}

export async function openProjectPath(path: string): Promise<{ project: BranchingProject; path: string; modifiedMs?: number }> {
  assertDesktopRuntime("Opening a recent local project");
  const payload = await invoke<ProjectFilePayload>("read_project_file", { path });
  return {
    project: parseProject(payload.content),
    path: payload.path,
    modifiedMs: payload.modifiedMs,
  };
}

export async function saveProjectFile(path: string, project: BranchingProject, expectedModifiedMs?: number): Promise<WriteResult> {
  assertDesktopRuntime("Saving a local project");
  return invoke<WriteResult>("save_project_file", {
    path,
    content: serializeProject(project),
    expectedModifiedMs,
  });
}

export async function saveUniverseTextFile(
  universePath: string,
  relativePath: string,
  content: string,
  expectedModifiedMs?: number,
): Promise<WriteResult> {
  const browserUniverse = currentBrowserUniverse(universePath);
  if (browserUniverse) {
    if (expectedModifiedMs !== undefined) {
      const current = (await readBrowserUniverse(browserUniverse)).find((file) => file.relativePath === relativePath);
      if (current?.modifiedMs !== expectedModifiedMs) return { ok: false, path: relativePath, modifiedMs: current?.modifiedMs, message: "Universe file changed on disk. Reopen before overwriting." };
    }
    const modifiedMs = await writeBrowserUniverseFile(browserUniverse, relativePath, content);
    return { ok: true, path: relativePath, modifiedMs };
  }
  assertDesktopRuntime("Saving universe app data");
  return invoke<WriteResult>("save_universe_text_file", {
    universePath,
    relativePath,
    content,
    expectedModifiedMs,
  });
}

/** Compare both exact bytes and timestamps: millisecond timestamps alone miss rapid external edits. */
export function universeBatchFiles(
  files: UniverseFile[],
  output: Array<{ relativePath: string; content: string }>,
  deletePaths: string[] = [],
): UniverseBatchFile[] {
  const previousByPath = new Map(files.map((file) => [file.relativePath, file]));
  const writes = output.flatMap((file) => {
    const previous = previousByPath.get(file.relativePath);
    if (previous?.content === file.content) return [];
    return [{ ...file, expectedExists: Boolean(previous), expectedContent: previous?.content, expectedModifiedMs: previous?.modifiedMs }];
  });
  const deletions = deletePaths.flatMap((relativePath) => {
    const previous = previousByPath.get(relativePath);
    return previous ? [{
      relativePath,
      content: "",
      delete: true,
      expectedExists: true,
      expectedContent: previous.content,
      expectedModifiedMs: previous.modifiedMs,
    }] : [];
  });
  return [...writes, ...deletions];
}

/** Shared compare-and-swap writer for universe app catalogs as well as story sidecars. */
export async function saveUniverseBatch(universePath: string, files: UniverseBatchFile[]): Promise<UniverseBatchResult> {
  const browserUniverse = currentBrowserUniverse(universePath);
  if (!browserUniverse) {
    assertDesktopRuntime('Saving universe app data');
    return invoke<UniverseBatchResult>('save_universe_story_batch', { universePath, files });
  }
  const before = await readBrowserUniverse(browserUniverse);
  const conflict = files.find(file => {
    const current = before.find(item => item.relativePath === file.relativePath);
    return Boolean(current) !== file.expectedExists || current && (current.content !== file.expectedContent || file.expectedModifiedMs !== undefined && current.modifiedMs !== file.expectedModifiedMs);
  });
  if (conflict) return { ok: false, path: conflict.relativePath, files: [], message: 'Universe file changed on disk. Reopen before overwriting.' };
  const changed: UniverseBatchFile[] = [];
  try {
    for (const file of files) {
      if (file.delete) await deleteBrowserUniverseFile(browserUniverse, file.relativePath);
      else await writeBrowserUniverseFile(browserUniverse, file.relativePath, file.content);
      changed.push(file);
    }
    const after = await readBrowserUniverse(browserUniverse);
    return { ok: true, path: universePath, files: files.map(file => ({ relativePath: file.relativePath, modifiedMs: after.find(item => item.relativePath === file.relativePath)?.modifiedMs })) };
  } catch (error) {
    const latest = await readBrowserUniverse(browserUniverse);
    for (const file of changed.reverse()) {
      const previous = before.find(item => item.relativePath === file.relativePath), current = latest.find(item => item.relativePath === file.relativePath);
      if (file.delete && previous && !current || !file.delete && previous && current?.content === file.content) await writeBrowserUniverseFile(browserUniverse, file.relativePath, previous!.content);
      else if (!file.delete && !previous && current?.content === file.content) await deleteBrowserUniverseFile(browserUniverse, file.relativePath);
    }
    return { ok: false, path: universePath, files: [], message: error instanceof Error ? error.message : String(error) };
  }
}

export function obsoleteSequenceSidecarPaths(
  files: ReadonlyArray<Pick<UniverseFile, "relativePath">>,
  output: Array<{ relativePath: string }>,
  storyId: string,
): string[] {
  const prefix = `${pathBranchingMetadataPaths.stories}/${storyId}/sequences/`;
  const outputPaths = new Set(output.map((file) => file.relativePath));
  return files.flatMap((file) => {
    if (!file.relativePath.startsWith(prefix) || outputPaths.has(file.relativePath)) return [];
    const segments = file.relativePath.slice(prefix.length).split("/");
    const [, category, name, ...extra] = segments;
    const isSequenceFile = segments.length === 2 && segments[1] === "sequence.json";
    const isEventSidecar = segments.length === 3 && category === "events" && /\.(?:json|evpath)$/i.test(name ?? "");
    const isBranchSidecar = segments.length === 3 && category === "branches" && name?.endsWith(".json");
    return extra.length === 0 && (isSequenceFile || isEventSidecar || isBranchSidecar)
      ? [file.relativePath]
      : [];
  });
}

export async function saveUniverseStory(
  universePath: string,
  workspace: PathBranchingWorkspace,
  project: BranchingProject,
  expectedModifiedMs?: number,
): Promise<SaveUniverseStoryResult> {
  if (workspace.saveBlocked || workspace.loadingIncomplete) {
    return { ok: false, path: universePath, message: `This story was loaded incompletely. Repair the listed files and reopen before saving. ${workspace.saveBlockReasons?.join(" ") ?? ""}` };
  }
  const story = workspace.activeStory;
  if (!story) throw new Error("No active Everend PathBranching story is available for this universe.");
  const normalizedStory = { ...story, path: storyPath(story.id) };
  const output = serializeModularStoryFiles(
    { ...project, storyId: story.id, universeRootPath: universePath, name: project.name ?? story.name },
    normalizedStory,
    { preserveUnloadedEventReferences: Boolean(workspace.eventLoad && workspace.eventLoad.status !== "ready") },
  );
  if (project.integrationConfig && !workspace.files.some((file) => file.relativePath === pathBranchingMetadataPaths.config)) {
    output.push({ relativePath: pathBranchingMetadataPaths.config, content: serializeIntegrationConfigYaml(project.integrationConfig) });
  }
  const manifest = {
    ...workspace.manifest,
    version: "0.2" as const,
    activeStoryId: normalizedStory.id,
    stories: workspace.manifest.stories.map((item) => item.id === story.id ? { ...item, path: normalizedStory.path, updatedAt: new Date().toISOString() } : item),
  };
  output.push({ relativePath: pathBranchingMetadataPaths.manifest, content: serializePathBranchingManifest(manifest) });
  const deletePaths = obsoleteSequenceSidecarPaths(workspace.files, output, story.id);
  const batch = universeBatchFiles(workspace.files, output, deletePaths);
  const storyBatch = batch.find((file) => file.relativePath === normalizedStory.path);
  if (storyBatch?.expectedExists && expectedModifiedMs !== undefined) storyBatch.expectedModifiedMs = expectedModifiedMs;
  const browserUniverse = currentBrowserUniverse(universePath);
  let result: UniverseBatchResult;
  if (browserUniverse) {
    // Desktop guarantees crash recovery. The browser fallback checks every file
    // before writing, retains old contents for compensation and writes the index last.
    const current = await readBrowserUniverse(browserUniverse);
    const conflict = batch.find((file) => {
      const disk = current.find((candidate) => candidate.relativePath === file.relativePath);
      return Boolean(disk) !== file.expectedExists || (disk && (disk.content !== file.expectedContent || (file.expectedModifiedMs !== undefined && disk.modifiedMs !== file.expectedModifiedMs)));
    });
    if (conflict) return { ok: false, path: conflict.relativePath, message: "Universe file changed on disk. Reopen before overwriting." };
    const changed: UniverseBatchFile[] = [];
    try {
      const ordered = [...batch].sort((left, right) => Number(left.relativePath === pathBranchingMetadataPaths.manifest || left.relativePath === normalizedStory.path) - Number(right.relativePath === pathBranchingMetadataPaths.manifest || right.relativePath === normalizedStory.path));
      for (const file of ordered) {
        if (file.delete) {
          await deleteBrowserUniverseFile(browserUniverse, file.relativePath);
        } else {
          await writeBrowserUniverseFile(browserUniverse, file.relativePath, file.content);
        }
        changed.push(file);
      }
      const after = await readBrowserUniverse(browserUniverse);
      result = { ok: true, path: universePath, files: batch.map((file) => ({ relativePath: file.relativePath, modifiedMs: after.find((candidate) => candidate.relativePath === file.relativePath)?.modifiedMs })) };
    } catch (error) {
      const latest = await readBrowserUniverse(browserUniverse);
      for (const file of changed.reverse()) {
        const old = current.find((candidate) => candidate.relativePath === file.relativePath);
        const disk = latest.find((candidate) => candidate.relativePath === file.relativePath);
        if (file.delete) {
          if (old && !disk) await writeBrowserUniverseFile(browserUniverse, file.relativePath, old.content);
        } else if (old && disk?.content === file.content) {
          await writeBrowserUniverseFile(browserUniverse, file.relativePath, old.content);
        } else if (!old && disk?.content === file.content) {
          await deleteBrowserUniverseFile(browserUniverse, file.relativePath);
        }
      }
      return { ok: false, path: universePath, message: error instanceof Error ? error.message : String(error) };
    }
  } else {
    assertDesktopRuntime("Saving universe app data");
    result = await invoke<UniverseBatchResult>("save_universe_story_batch", { universePath, files: batch });
  }
  if (!result.ok) return result;
  const savedFiles = batch.filter((file) => !file.delete).map((file) => ({ relativePath: file.relativePath, content: file.content, modifiedMs: result.files.find((entry) => entry.relativePath === file.relativePath)?.modifiedMs }));
  const storyModifiedMs = savedFiles.find((file) => file.relativePath === normalizedStory.path)?.modifiedMs ?? workspace.storyModifiedMs;
  return { ...result, path: normalizedStory.path, modifiedMs: storyModifiedMs, storyPath: normalizedStory.path, storyModifiedMs, manifest, manifestModifiedMs: savedFiles.find((file) => file.relativePath === pathBranchingMetadataPaths.manifest)?.modifiedMs, savedFiles };
}

export async function saveUniverseManifest(
  universePath: string,
  manifest: PathBranchingWorkspace["manifest"],
  baseline?: UniverseFile,
): Promise<WriteResult> {
  const content = serializePathBranchingManifest(manifest);
  const path = pathBranchingMetadataPaths.manifest;
  if (currentBrowserUniverse(universePath)) {
    const current = (await readBrowserUniverse(currentBrowserUniverse(universePath)!)).find((file) => file.relativePath === path);
    if (current?.content !== baseline?.content || current?.modifiedMs !== baseline?.modifiedMs) return { ok: false, path, message: "Universe manifest changed on disk. Reopen before overwriting." };
    return saveUniverseTextFile(universePath, path, content, baseline?.modifiedMs);
  }
  assertDesktopRuntime("Saving universe app data");
  const result = await invoke<UniverseBatchResult>("save_universe_story_batch", { universePath, files: universeBatchFiles(baseline ? [baseline] : [], [{ relativePath: path, content }]) });
  return { ...result, path, modifiedMs: result.files.find((file) => file.relativePath === path)?.modifiedMs };
}

export async function saveWorkingCopy(
  universePath: string,
  canonRefId: string,
  content: string,
  expectedModifiedMs?: number,
): Promise<WriteResult> {
  return saveUniverseTextFile(universePath, workingCopyPathForCanonRef(canonRefId), content, expectedModifiedMs);
}

export async function revealUniverseFolder(path: string): Promise<WriteResult> {
  assertDesktopRuntime("Revealing a universe folder");
  return invoke<WriteResult>("reveal_universe", { path });
}

export async function saveProjectAsDialog(project: BranchingProject): Promise<WriteResult | undefined> {
  assertDesktopRuntime("Saving a local project");
  const result = await invoke<WriteResult | null>("save_project_as_dialog", {
    content: serializeProject(project),
    defaultName: `${project.projectId || "pathbranching-project"}.pathbranching.json`,
  });
  return result ?? undefined;
}

/**
 * Initializes a properties.json file in the .everend directory using a standard template.
 * Based on the ESTRELLAS CORRUPTAS universe structure.
 */
export async function initializePropertiesFile(universePath: string): Promise<WriteResult> {
  // Template based on ESTRELLAS CORRUPTAS structure
  const propertiesTemplate = {
    "version": "3.0",
    "baseProperties": {
      "definitions": [
        { "id": "id", "label": "ID", "description": "Unique identifier", "type": "text", "immutable": true, "readOnly": true, "required": true, "order": 0 },
        { "id": "name", "label": "Name", "description": "Entity name", "type": "text", "immutable": true, "required": true, "order": 1 },
        { "id": "type", "label": "Type", "description": "Entity type", "type": "select", "immutable": true, "required": true, "order": 2, "options": [{ "value": "character", "label": "Character", "color": "#3b82f6" }, { "value": "location", "label": "Location", "color": "#10b981" }, { "value": "organization", "label": "Organization", "color": "#f59e0b" }, { "value": "concept", "label": "Concept", "color": "#8b5cf6" }, { "value": "item", "label": "Item", "color": "#ec4899" }, { "value": "cycle", "label": "Cycle", "color": "#14b8a6" }, { "value": "universe", "label": "Universe", "color": "#a855f7" }, { "value": "scene", "label": "Scene", "color": "#f97316" }, { "value": "world", "label": "World" }, { "value": "chronology", "label": "Chronology" }] },
        { "id": "status", "label": "Status", "description": "Canon or editorial state", "type": "select", "immutable": true, "required": true, "order": 3, "options": [{ "value": "draft", "label": "Draft", "color": "#6b7280" }, { "value": "in-progress", "label": "In Progress", "color": "#f59e0b" }, { "value": "review", "label": "Review", "color": "#3b82f6" }, { "value": "published", "label": "Published", "color": "#10b981" }, { "value": "archived", "label": "Archived", "color": "#6b7280" }] },
        { "id": "tags", "label": "Tags", "description": "Search and grouping labels", "type": "text", "immutable": true, "order": 4 },
        { "id": "aliases", "label": "Aliases", "description": "Alternate display names or wikilink candidates", "type": "text", "immutable": true, "order": 5 },
        { "id": "parentId", "label": "Parent", "description": "Stable ID of a parent entity", "type": "entity-ref", "immutable": true, "targetTypes": ["character", "location", "organization", "event", "concept", "item", "world", "cycle", "universe", "story", "arc", "scene", "quest"], "order": 6 },
        { "id": "childrenIds", "label": "Children", "description": "Stable IDs of explicit child entities", "type": "entity-ref-list", "immutable": true, "targetTypes": ["character", "location", "organization", "event", "concept", "item", "world", "cycle", "universe", "story", "arc", "scene", "quest"], "order": 7 }
      ],
      "visibleByDefault": ["type", "status", "aliases", "parentId", "childrenIds"],
      "order": ["id", "name", "type", "status", "tags", "aliases", "parentId", "childrenIds"]
    },
    "tags": { "rootNodes": [], "allowCustomTags": true, "autoDetectSlashNotation": true },
    "contentTypes": { "definitions": [{ "id": "folder-description", "label": "Folder Note", "description": "Special note that describes a folder", "icon": "folder", "color": "#64748b", "immutable": true }] },
    "entityTypes": { "definitions": [{ "id": "character", "label": "Character", "description": "Person, creature, or viewpoint actor", "icon": "user", "color": "#3b82f6", "customFields": ["lore-level", "identity", "narrative", "portrait"], "visibleProperties": ["type", "status", "aliases"], "propertyOrder": ["type", "status", "aliases", "lore-level", "identity", "narrative", "portrait"], "presentation": { "portraitPropertyId": "portrait" } }, { "id": "location", "label": "Location", "description": "Place, region, settlement, or site", "icon": "map-pin", "color": "#10b981", "customFields": ["lore-level", "place"], "visibleProperties": ["type", "status", "aliases", "parentId", "childrenIds"], "propertyOrder": ["type", "status", "aliases", "parentId", "childrenIds", "lore-level", "place"], "hiddenProperties": ["status"] }, { "id": "organization", "label": "Organization", "description": "Faction, institution, house, or guild", "icon": "users", "color": "#f59e0b", "customFields": ["lore-level", "identity"], "visibleProperties": ["type", "status", "aliases", "parentId", "childrenIds"], "propertyOrder": ["type", "status", "aliases", "parentId", "childrenIds", "lore-level", "identity"] }, { "id": "concept", "label": "Concept", "description": "Idea, law, magic rule, or abstract note", "icon": "lightbulb", "color": "#8b5cf6", "customFields": ["lore-level"], "visibleProperties": ["type", "status", "parentId", "childrenIds", "lore-level"], "propertyOrder": ["type", "status", "parentId", "childrenIds", "lore-level"], "hiddenProperties": ["aliases", "lore-level", "status"] }, { "id": "item", "label": "Item", "description": "Object, relic, tool, or artifact", "icon": "package", "color": "#ec4899", "customFields": ["lore-level", "identity", "place", "item-details"], "visibleProperties": ["type", "status", "aliases", "parentId", "childrenIds"], "propertyOrder": ["type", "status", "aliases", "parentId", "childrenIds", "lore-level", "identity", "place", "item-details"] }, { "id": "cycle", "label": "Cycle", "description": "Era, cycle, age, or large continuity span", "icon": "refresh-cw", "color": "#14b8a6", "customFields": ["lore-level"], "visibleProperties": ["type", "status", "aliases", "parentId", "childrenIds"], "propertyOrder": ["type", "status", "aliases", "parentId", "childrenIds", "lore-level"] }, { "id": "universe", "label": "Universe", "description": "Top-level canon container or cosmology", "icon": "sparkles", "color": "#a855f7", "customFields": ["lore-level"], "visibleProperties": ["type", "status", "aliases", "parentId", "childrenIds"], "propertyOrder": ["type", "status", "aliases", "parentId", "childrenIds", "lore-level"] }, { "id": "scene", "customFields": [], "label": "Scene", "color": "#f97316", "hiddenProperties": ["aliases"] }, { "id": "world", "customFields": [], "label": "World", "hiddenProperties": ["status"] }, { "id": "chronology", "customFields": [], "label": "Chronology", "hiddenProperties": ["aliases"] }], "defaultType": "concept", "allowCustomTypes": true },
    "statuses": { "definitions": [{ "id": "draft", "label": "Draft", "description": "Work in progress", "color": "#6b7280", "order": 0 }, { "id": "in-progress", "label": "In Progress", "description": "Actively being worked on", "color": "#f59e0b", "order": 1 }, { "id": "review", "label": "Review", "description": "Ready for review", "color": "#3b82f6", "order": 2 }, { "id": "published", "label": "Published", "description": "Finalized and approved", "color": "#10b981", "order": 3 }, { "id": "archived", "label": "Archived", "description": "No longer active", "color": "#6b7280", "order": 4 }], "defaultStatus": "draft", "allowCustomStatuses": true },
    "customFields": { "definitions": [{ "id": "lore-level", "label": "Lore Level", "type": "select", "description": "Level of detail or canonicity for this entity", "required": false, "options": [{ "value": "canon", "label": "Canon", "color": "#10b981" }, { "value": "semi-canon", "label": "Semi-canon", "color": "#f59e0b" }, { "value": "draft", "label": "Draft", "color": "#64748b" }, { "value": "idea", "label": "Idea", "color": "#94a3b8" }], "children": [], "appliesTo": ["character", "location", "organization", "item", "cycle", "universe"] }], "globalFields": ["lore-level"] }
  };
  
  return saveUniverseTextFile(
    universePath,
    ".everend/properties.json",
    JSON.stringify(propertiesTemplate, null, 2),
  );
}

export async function exportRuntimeDialog(runtimePackage: RuntimePackage): Promise<WriteResult | undefined> {
  return exportTextDialog(`${JSON.stringify(runtimePackage, null, 2)}\n`, "runtime-package.json");
}

export async function exportBridgeBundleDialog(files: Array<{ path: string; content: string }>): Promise<WriteResult | undefined> {
  assertDesktopRuntime("Exporting an Everend Forge offline bundle");
  const result = await invoke<WriteResult | null>("export_bridge_bundle_dialog", { files });
  return result ?? undefined;
}

export async function exportTextDialog(content: string, defaultName: string): Promise<WriteResult | undefined> {
  assertDesktopRuntime("Exporting local files");
  const result = await invoke<WriteResult | null>("export_runtime_dialog", {
    content,
    defaultName,
  });
  return result ?? undefined;
}

/** Read profile metadata without reconciling or replacing the open narrative document. */
export async function readUniverseProfileSource(path: string): Promise<string | undefined> {
  const browser = currentBrowserUniverse(path);
  const files = browser ? await readBrowserUniverse(browser) : (await invoke<UniverseReadResult>("read_universe_folder", {path})).files;
  return files.find(file => file.relativePath.replaceAll("\\", "/") === ".everend/universe.json")?.content;
}
