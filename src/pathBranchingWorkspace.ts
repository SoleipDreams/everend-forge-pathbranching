import type { BranchingProject } from "./domain.js";
import { canonicalPropertyDescriptors } from './characterStats.js';
import {
  createEmptyBranchingProjectFromWorldNotionIndex,
  indexWorldNotionVaultFiles,
  type WorldNotionBridgeIndex,
  type WorldNotionVaultFile,
} from "./worldnotionBridge.js";
import {
  normalizeProject,
  parseProject,
  serializeProject,
} from "./projectSerialization.js";
import { machineLocale, normalizeLocaleList, normalizeLocaleNames, normalizeLocalizationCatalog } from "./localization.js";
import {
  DEFAULT_INTEGRATION_CONFIG,
  parseIntegrationConfigYaml,
  serializeIntegrationConfigYaml,
} from "./integrationConfig.js";
import { applyEvpathToEvent, parseEvpath, serializeEventEvpath } from "./evpathFormat.js";
import { narrativeNodeReferences } from './authoringMutations.js';

/**
 * 0.5 preserves the complete project metadata and modular authoring state.
 * Older stories are normalized on load and upgraded on the next safe save.
 */
export const STORAGE_VERSION = "0.5";

export const pathBranchingMetadataPaths = {
  root: ".everend/.pathbranching",
  manifest: ".everend/.pathbranching/manifest.json",
  config: ".everend/.pathbranching/config.yaml",
  stories: ".everend/.pathbranching/stories",
  workingCopies: ".everend/.pathbranching/working-copies",
  changeSets: ".everend/changes",
} as const;

export type UniverseFile = WorldNotionVaultFile & {
  modifiedMs?: number;
};

export type UniverseFileIndexEntry = {
  relativePath: string;
  absolutePath?: string;
  modifiedMs?: number;
  sizeBytes?: number;
};

export type StoryEventLoadState = {
  status: "loading" | "ready" | "incomplete";
  /** Whether the active read is filling the viewport or a full-story operation. */
  mode?: "viewport" | "complete";
  totalEvents: number;
  loadedEvents: number;
  failedEvents: number;
  pendingEventIds: ReadonlySet<string>;
};

export type UniverseIcon = {
  type: "preset" | "image";
  value: string;
};

export type UniverseProfile = {
  name?: string;
  icon?: UniverseIcon;
  taxonomyVersion?: string;
  localization?: {
    primaryLocale: string;
    locales: string[];
    localeNames?: Record<string, string>;
  };
};

export type PathBranchingStoryManifestEntry = {
  id: string;
  name: string;
  path: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PathBranchingManifest = {
  version: "0.1" | "0.2";
  activeStoryId?: string;
  stories: PathBranchingStoryManifestEntry[];
};

export type PathBranchingWorkspace = {
  manifest: PathBranchingManifest;
  universeProfile?: UniverseProfile;
  canonIndex: WorldNotionBridgeIndex;
  files: UniverseFile[];
  fileIndex?: UniverseFileIndexEntry[];
  storageVersion?: string;
  eventLoad?: StoryEventLoadState;
  activeStory?: PathBranchingStoryManifestEntry;
  activeProject: BranchingProject;
  storyModifiedMs?: number;
  createdDefaultStory: boolean;
  loadWarnings?: string[];
  loadingIncomplete?: boolean;
  saveBlocked?: boolean;
  saveBlockReasons?: string[];
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function defaultStoryId(files: UniverseFile[]): string {
  const universeFile = files.find(
    (file) => file.relativePath === ".everend/universe.json",
  );
  if (universeFile) {
    try {
      const parsed = JSON.parse(universeFile.content) as { name?: unknown };
      if (typeof parsed.name === "string") {
        const slug = slugify(parsed.name);
        if (slug) return slug;
      }
    } catch {
      // Fall back to the generic story id.
    }
  }
  return "main";
}

export function storyPath(storyId: string): string {
  return `${storyDirectory(storyId)}/story.json`;
}

export function legacyStoryPath(storyId: string): string {
  return `${pathBranchingMetadataPaths.stories}/${storyId}.pathbranching.json`;
}

export function workingCopyPathForCanonRef(canonRefId: string): string {
  const slug = slugify(canonRefId) || "canon-ref";
  return `${pathBranchingMetadataPaths.workingCopies}/${slug}.md`;
}

export function storyDirectory(storyId: string): string {
  return `${pathBranchingMetadataPaths.stories}/${storyId}`;
}

export function sequenceDirectory(storyId: string, sequenceId: string): string {
  return `${storyDirectory(storyId)}/sequences/${slugify(sequenceId) || sequenceId}`;
}

export function sequencePath(storyId: string, sequenceId: string): string {
  return `${sequenceDirectory(storyId, sequenceId)}/sequence.json`;
}

export function eventPath(
  storyId: string,
  sequenceId: string,
  eventId: string,
): string {
  return `${sequenceDirectory(storyId, sequenceId)}/events/${slugify(eventId) || eventId}.json`;
}

/**
 * Canonical `.evpath` narrative file for an event, written next to its JSON
 * sidecar. The text is authoritative for the narrative it can express; the
 * JSON preserves everything evpath omits (complex logic, layout, bindings).
 */
export function eventEvpathPath(
  storyId: string,
  sequenceId: string,
  eventId: string,
): string {
  return `${sequenceDirectory(storyId, sequenceId)}/events/${slugify(eventId) || eventId}.evpath`;
}

export function branchPath(
  storyId: string,
  sequenceId: string,
  branchId: string,
): string {
  return `${sequenceDirectory(storyId, sequenceId)}/branches/${slugify(branchId) || branchId}.json`;
}

export function authoringCanvasPath(storyId: string): string {
  return `${storyDirectory(storyId)}/authoring/canvas.json`;
}

export function storyIntegrationConfigPath(storyId: string): string {
  return `${storyDirectory(storyId)}/config.yaml`;
}

function parseIntegrationConfigFile(files: UniverseFile[], relativePath: string) {
  const file = files.find((candidate) => candidate.relativePath === relativePath);
  if (!file) return undefined;
  try {
    return parseIntegrationConfigYaml(file.content);
  } catch {
    return undefined;
  }
}

function parseManifest(
  files: UniverseFile[],
  loadWarnings: string[],
): PathBranchingManifest | undefined {
  const manifestFile = files.find(
    (file) => file.relativePath === pathBranchingMetadataPaths.manifest,
  );
  if (!manifestFile) return undefined;

  let parsed: { version?: unknown; activeStoryId?: unknown; stories?: unknown };
  try {
    parsed = JSON.parse(manifestFile.content) as {
      version?: unknown;
      activeStoryId?: unknown;
      stories?: unknown;
    };
  } catch (error) {
    loadWarnings.push(
      `Could not parse ${pathBranchingMetadataPaths.manifest}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") {
    loadWarnings.push("Incomplete story: manifest must be a JSON object.");
    return undefined;
  }
  const stories = Array.isArray(parsed.stories) ? parsed.stories : [];
  if (!Array.isArray(parsed.stories)) loadWarnings.push("Incomplete story: manifest has an invalid story list.");
  const normalizedStories = stories
    .filter((story): story is PathBranchingStoryManifestEntry => {
      return (
        typeof story === "object" &&
        story !== null &&
        "id" in story &&
        "name" in story &&
        "path" in story &&
        typeof story.id === "string" &&
        typeof story.name === "string" &&
        typeof story.path === "string"
      );
    })
    .map((story) => ({ ...story }));
  if (stories.length && normalizedStories.length !== stories.length) {
    loadWarnings.push(
      `Ignored ${stories.length - normalizedStories.length} invalid PathBranching manifest story entries.`,
    );
  }
  return {
    version: parsed.version === "0.2" ? "0.2" : "0.1",
    activeStoryId:
      typeof parsed.activeStoryId === "string"
        ? parsed.activeStoryId
        : undefined,
    stories: normalizedStories,
  };
}

function parseUniverseProfile(
  files: UniverseFile[],
): UniverseProfile | undefined {
  const profileFile = files.find(
    (file) => file.relativePath === ".everend/universe.json",
  );
  if (!profileFile) return undefined;

  try {
    const parsed = JSON.parse(profileFile.content) as UniverseProfile | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const icon: UniverseIcon | undefined =
      parsed.icon?.type && parsed.icon.value
        ? {
            type: parsed.icon.type === "image" ? "image" : "preset",
            value: String(parsed.icon.value),
          }
        : undefined;
    return {
      ...parsed,
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : undefined,
      icon,
      taxonomyVersion:
        typeof parsed.taxonomyVersion === "string"
          ? parsed.taxonomyVersion
          : undefined,
      localization: (() => {
        const primaryLocale = parsed.localization?.primaryLocale || machineLocale();
        const locales = normalizeLocaleList(primaryLocale, parsed.localization?.locales ?? []);
        return {
          primaryLocale,
          locales,
          localeNames: normalizeLocaleNames(parsed.localization?.localeNames, locales),
        };
      })(),
    };
  } catch {
    return undefined;
  }
}

function createDefaultProject(
  files: UniverseFile[],
  canonIndex: WorldNotionBridgeIndex,
  storyId: string,
  name = "Branching Story",
): BranchingProject {
  return normalizeProject(
    createEmptyBranchingProjectFromWorldNotionIndex(canonIndex, {
      projectId: `pathbranching:${storyId}`,
      name,
      vaultRelativePath: ".",
    }),
  );
}

type ModularStoryFile = Omit<Partial<BranchingProject>, "sequences" | "branches" | "events" | "canvas" | "panels"> & {
  storageVersion?: string;
  sequenceIds?: string[];
};

type LoadedPathBranchingStory = {
  project: BranchingProject;
  modifiedMs?: number;
  storageVersion?: string;
  pendingEventIds?: Set<string>;
};

function parseJsonFile<T>(file: UniverseFile | undefined): T | undefined {
  if (!file) return undefined;
  try {
    return JSON.parse(file.content) as T;
  } catch {
    return undefined;
  }
}

function indexUniverseFilesByPath(files: UniverseFile[]): Map<string, UniverseFile> {
  const filesByPath = new Map<string, UniverseFile>();
  for (const file of files) {
    if (!filesByPath.has(file.relativePath)) filesByPath.set(file.relativePath, file);
  }
  return filesByPath;
}

function unwrapSequence(
  parsed: unknown,
): BranchingProject["sequences"][number] | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const value =
    "sequence" in parsed ? (parsed as { sequence?: unknown }).sequence : parsed;
  if (!value || typeof value !== "object") return undefined;
  const sequence = value as BranchingProject["sequences"][number];
  return typeof sequence.id === "string" && typeof sequence.name === "string"
    ? sequence
    : undefined;
}

function unwrapEvent(
  parsed: unknown,
): BranchingProject["events"][number] | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const value =
    "event" in parsed ? (parsed as { event?: unknown }).event : parsed;
  if (!value || typeof value !== "object") return undefined;
  const event = value as BranchingProject["events"][number];
  return typeof event.id === "string" && typeof event.name === "string"
    ? event
    : undefined;
}

function unwrapBranch(
  parsed: unknown,
): BranchingProject["branches"][number] | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const value =
    "branch" in parsed ? (parsed as { branch?: unknown }).branch : parsed;
  if (!value || typeof value !== "object") return undefined;
  const branch = value as BranchingProject["branches"][number];
  return typeof branch.id === "string" && typeof branch.title === "string"
    ? branch
    : undefined;
}

function parseModularStoryProject(
  files: UniverseFile[],
  story: PathBranchingStoryManifestEntry,
  storyId: string,
  loadWarnings?: string[],
  indexedPaths?: ReadonlySet<string>,
  deferEventSidecars = false,
): LoadedPathBranchingStory | undefined {
  const filesByPath = indexUniverseFilesByPath(files);
  const modularPath = story.path.endsWith("/story.json")
    ? story.path
    : storyPath(storyId);
  const storyFile = filesByPath.get(modularPath);
  const parsedStory = parseJsonFile<ModularStoryFile>(storyFile);
  if (!storyFile || !parsedStory || typeof parsedStory !== "object") {
    if (storyFile || story.path.endsWith("/story.json")) loadWarnings?.push(`Incomplete story: ${modularPath} is missing or invalid.`);
    return undefined;
  }
  if (!Array.isArray(parsedStory.sequenceIds) || parsedStory.sequenceIds.some((id) => typeof id !== "string")) {
    loadWarnings?.push(`Incomplete story: ${modularPath} has an invalid sequence list.`);
    return undefined;
  }
  if (parsedStory.storageVersion && !["0.2", "0.3", "0.4", STORAGE_VERSION].includes(parsedStory.storageVersion)) {
    loadWarnings?.push(`Incomplete story: unsupported storage version ${parsedStory.storageVersion} in ${modularPath}.`);
    return undefined;
  }

  const readRequired = <T>(relativePath: string, unwrap: (value: unknown) => T | undefined, expectedId?: string): T | undefined => {
    const file = filesByPath.get(relativePath);
    const value = unwrap(parseJsonFile<unknown>(file));
    if (!value || (expectedId && (value as { id?: string }).id !== expectedId)) {
      loadWarnings?.push(`Incomplete story: ${relativePath} is ${file ? "invalid or has a mismatched identifier" : "missing"}. Reopen after repairing the file before saving.`);
      return undefined;
    }
    return value;
  };
  const sequenceIds = Array.isArray(parsedStory.sequenceIds) ? parsedStory.sequenceIds : [];
  const sequences = sequenceIds.map((id) => readRequired(sequencePath(storyId, id), unwrapSequence, id))
    .filter((value): value is BranchingProject["sequences"][number] => Boolean(value));
  const events: BranchingProject["events"] = [];
  const branches: BranchingProject["branches"] = [];
  const pendingEventIds = new Set<string>();
  const loadedEventIds = new Set<string>();
  const loadedBranchIds = new Set<string>();
  const eventJsonFilesByDirectory = new Map<string, UniverseFile[]>();
  for (const file of files) {
    if (!file.relativePath.endsWith(".json")) continue;
    const eventsDirectoryIndex = file.relativePath.lastIndexOf("/events/");
    if (eventsDirectoryIndex < 0) continue;
    const directory = file.relativePath.slice(0, eventsDirectoryIndex + "/events/".length);
    const directoryFiles = eventJsonFilesByDirectory.get(directory);
    if (directoryFiles) directoryFiles.push(file);
    else eventJsonFilesByDirectory.set(directory, [file]);
  }
  for (const sequence of sequences) {
    if (!Array.isArray(sequence.eventIds) || (sequence.branchIds !== undefined && !Array.isArray(sequence.branchIds))) {
      loadWarnings?.push(`Incomplete story: ${sequencePath(storyId, sequence.id)} has invalid member lists.`);
      continue;
    }
    const sequenceEventIds = new Set(sequence.eventIds);
    for (const id of sequence.eventIds) {
      if (loadedEventIds.has(id)) continue;
      const eventFilePath = eventPath(storyId, sequence.id, id);
      const eventFile = filesByPath.get(eventFilePath);
      const eventFileIsDeferred = !eventFile && (deferEventSidecars || indexedPaths?.has(eventFilePath));
      const event = eventFileIsDeferred ? undefined : readRequired(eventFilePath, unwrapEvent, id);
      if (eventFileIsDeferred) pendingEventIds.add(id);
      if (event && !loadedEventIds.has(id)) {
        events.push(event);
        loadedEventIds.add(id);
      }
      const eventEvpathFilePath = eventEvpathPath(storyId, sequence.id, id);
      if (!deferEventSidecars && parsedStory.storageVersion === STORAGE_VERSION && !filesByPath.has(eventEvpathFilePath) && !indexedPaths?.has(eventEvpathFilePath)) {
        loadWarnings?.push(`Incomplete story: ${eventEvpathFilePath} is missing.`);
      }
    }
    // Sidecars left after a deletion are not automatically resurrected. A
    // still-referenced missing event, however, must not be silently ignored.
    const prefix = `${sequenceDirectory(storyId, sequence.id)}/events/`;
    for (const file of eventJsonFilesByDirectory.get(prefix) ?? []) {
      const excluded = unwrapEvent(parseJsonFile<unknown>(file));
      if (!excluded || sequenceEventIds.has(excluded.id)) continue;
      const prefixId = `:${excluded.id}:`;
      const scenarios = parsedStory.authoringScenarios ?? [];
      if (scenarios.some(scenario => scenario.startNodeId === excluded.id || scenario.startNodeId?.includes(prefixId))) {
        loadWarnings?.push(`Incomplete story: ${excluded.name} has a saved event file and an active scenario reference but is absent from ${sequencePath(storyId, sequence.id)}. Repair the sequence membership before saving.`);
      }
    }
    for (const id of sequence.branchIds ?? []) {
      if (loadedBranchIds.has(id)) continue;
      const branch = readRequired(branchPath(storyId, sequence.id, id), unwrapBranch, id);
      if (branch && !loadedBranchIds.has(id)) {
        branches.push(branch);
        loadedBranchIds.add(id);
      }
    }
  }
  const authoringFile = filesByPath.get(authoringCanvasPath(storyId));
  const authoring = parseJsonFile<{ canvas?: BranchingProject["canvas"]; panels?: BranchingProject["panels"] }>(authoringFile);
  if ((authoringFile || parsedStory.storageVersion === STORAGE_VERSION) && (!authoring || typeof authoring !== "object")) {
    loadWarnings?.push(`Incomplete story: ${authoringCanvasPath(storyId)} is missing or invalid.`);
  }
  for (const path of [pathBranchingMetadataPaths.config, storyIntegrationConfigPath(storyId)]) {
    if (files.some((file) => file.relativePath === path) && !parseIntegrationConfigFile(files, path)) {
      loadWarnings?.push(`Incomplete story: ${path} cannot be parsed.`);
    }
  }
  const { storageVersion: _storageVersion, sequenceIds: _sequenceIds, ...projectMetadata } = parsedStory;
  const baseProject = normalizeProject({
    ...projectMetadata,
    specVersion: parsedStory.specVersion ?? "0.1",
    projectId: parsedStory.projectId ?? `pathbranching:${storyId}`,
    storyId,
    universeRootPath: parsedStory.universeRootPath,
    name: parsedStory.name ?? story.name,
    sourceVault: parsedStory.sourceVault,
    dataClasses: parsedStory.dataClasses,
    projectDataObjects: parsedStory.projectDataObjects,
    assets: parsedStory.assets ?? [],
    canonEditSuggestions: parsedStory.canonEditSuggestions,
    projectionRules: parsedStory.projectionRules,
    graphModules: parsedStory.graphModules,
    canvas: authoring?.canvas,
    panels: authoring?.panels,
    authoringPreferences: parsedStory.authoringPreferences,
    entrySequenceId: parsedStory.entrySequenceId,
    eventCategories: parsedStory.eventCategories,
    canonRefs: parsedStory.canonRefs ?? [],
    sequences,
    branches,
    events,
    scripts: parsedStory.scripts ?? [],
    scriptDocuments: parsedStory.scriptDocuments ?? [],
    integrationConfig:
      parseIntegrationConfigFile(files, pathBranchingMetadataPaths.config) ??
      DEFAULT_INTEGRATION_CONFIG,
    integrationConfigOverride: parseIntegrationConfigFile(
      files,
      storyIntegrationConfigPath(storyId),
    ),
    externalFunctions: parsedStory.externalFunctions ?? [],
    variables: parsedStory.variables ?? {},
    engineTargets: parsedStory.engineTargets,
    logicVariables: parsedStory.logicVariables,
    logicVariableGroups: parsedStory.logicVariableGroups,
    logicTypeOverrides: parsedStory.logicTypeOverrides,
    logicPropertyOverrides: parsedStory.logicPropertyOverrides ?? [],
    localExplorerEntities: parsedStory.localExplorerEntities ?? [],
    localExplorerTypes: parsedStory.localExplorerTypes ?? [],
    localExplorerProperties: parsedStory.localExplorerProperties ?? [],
  }, { preserveUnloadedEventReferences: Boolean(indexedPaths) });

  return {
    modifiedMs: storyFile.modifiedMs,
    storageVersion: parsedStory.storageVersion,
    pendingEventIds,
    project: reconcileEventEvpathFiles(baseProject, files, storyId, loadWarnings),
  };
}

/**
 * Honors the canonical `.evpath` narrative for each event over its JSON
 * sidecar. Applying is strictly non-destructive: an event's text is adopted
 * only when it parses cleanly and reconciles to a stable fixed point (so a
 * reconciler edge case can never silently drift a story on load). When the
 * `.evpath` matches the JSON (the common case, right after a save) it is a
 * no-op; when it can't be applied safely the JSON is kept and a warning is
 * recorded.
 */
function reconcileEventEvpathFiles(
  project: BranchingProject,
  files: UniverseFile[],
  storyId: string,
  loadWarnings?: string[],
  eventIds?: ReadonlySet<string>,
): BranchingProject {
  let current = project;
  const eventById = new Map(project.events.map((event) => [event.id, event]));
  const filesByPath = indexUniverseFilesByPath(files);
  const sequenceIdByEventId = new Map<string, string>();
  for (const sequence of project.sequences) {
    for (const eventId of sequence.eventIds) {
      if (!sequenceIdByEventId.has(eventId)) sequenceIdByEventId.set(eventId, sequence.id);
    }
  }
  const fallbackSequenceId =
    project.canvas?.activeSequenceId ??
    project.entrySequenceId ??
    project.sequences[0]?.id;
  for (const event of project.events) {
    if (eventIds && !eventIds.has(event.id)) continue;
    const sequenceId = sequenceIdByEventId.get(event.id) ?? fallbackSequenceId;
    if (!sequenceId) continue;
    const evpathFile = filesByPath.get(eventEvpathPath(storyId, sequenceId, event.id));
    if (!evpathFile) continue;
    // A generated projection must never rewrite its richer JSON sidecar.
    // Scoped IDs and modular rules can exceed the text grammar's vocabulary.
    if (evpathFile.content.trim() === serializeEventEvpath(current, event.id, eventById).trim()) {
      const syntax = parseEvpath(evpathFile.content);
      if (syntax.errors.length) loadWarnings?.push(`${event.name}: representación textual limitada; se conserva el documento JSON completo (${syntax.errors[0].message}).`);
      if (evpathFile.content.includes('{ #')) loadWarnings?.push(`${event.name}: lógica opaca; se conserva el JSON original.`);
      continue;
    }
    const applied = applyEvpathToEvent(current, event.id, evpathFile.content);
    if (applied.errors.length) {
      loadWarnings?.push(
        `No se pudo leer el texto de "${event.name}"; se conserva la versión guardada (${applied.errors[0].message}).`,
      );
      continue;
    }
    for (const warning of applied.warnings) loadWarnings?.push(`${event.name}: ${warning}`);
    if (evpathFile.content.includes('{ #')) loadWarnings?.push(`${event.name}: lógica opaca; se conserva el JSON original.`);
    if (!applied.changed) continue;
    const retained = new Set(narrativeNodeReferences(applied.project, event.id).map(node => node.id));
    if (narrativeNodeReferences(current, event.id).some(node => !retained.has(node.id))) {
      loadWarnings?.push(`El texto editado de "${event.name}" omite contenido guardado; se conserva el JSON completo. Aplica la eliminación explícitamente desde Source si es intencional.`);
      continue;
    }
    // The `.evpath` diverged from the JSON (an external edit). Adopt it only if
    // re-serializing the applied event reaches a fixed point.
    const appliedEvent = applied.project.events.find((candidate) => candidate.id === event.id);
    const appliedEventById = new Map(eventById);
    if (appliedEvent) appliedEventById.set(event.id, appliedEvent);
    const reserialized = serializeEventEvpath(applied.project, event.id, appliedEventById);
    const settle = applyEvpathToEvent(applied.project, event.id, reserialized);
    if (settle.errors.length || settle.changed) {
      loadWarnings?.push(
        `El texto editado de "${event.name}" no se pudo aplicar de forma estable; se conserva la versión guardada.`,
      );
      continue;
    }
    current = applied.project;
    if (appliedEvent) eventById.set(event.id, appliedEvent);
  }
  return current;
}

/** Reconcile event text projections after every referenced event is available. */
export function reconcilePathBranchingEventFiles(
  project: BranchingProject,
  files: UniverseFile[],
  storyId: string,
  loadWarnings?: string[],
): BranchingProject {
  return reconcileEventEvpathFiles(project, files, storyId, loadWarnings);
}

function parseLegacyStoryProject(
  files: UniverseFile[],
  story: PathBranchingStoryManifestEntry,
  storyId: string,
): LoadedPathBranchingStory | undefined {
  const legacyPath = story.path.endsWith(".pathbranching.json")
    ? story.path
    : legacyStoryPath(storyId);
  const storyFile = files.find((file) => file.relativePath === legacyPath);
  if (!storyFile) return undefined;
  return {
    project: normalizeProject({
      ...parseProject(storyFile.content),
      storyId,
    }),
    modifiedMs: storyFile.modifiedMs,
  };
}

function mergeCanonRefs(
  canonIndex: WorldNotionBridgeIndex,
  storyProject: BranchingProject,
) {
  const storyRefs = new Map(storyProject.canonRefs.map((ref) => [ref.id, ref]));
  const currentRefs = canonIndex.canonRefs.map((ref) => {
    const storyRef = storyRefs.get(ref.id);
    return {
      ...ref,
      workingCopyPath: storyRef?.workingCopyPath,
    };
  });
  // Missing canon remains a diagnosable reference, never a silent deletion.
  return [...currentRefs, ...storyProject.canonRefs.filter((ref) => !currentRefs.some((current) => current.id === ref.id))];
}

export function loadPathBranchingWorkspace(
  files: UniverseFile[],
  options: { fileIndex?: UniverseFileIndexEntry[]; deferEventSidecars?: boolean } = {},
): PathBranchingWorkspace {
  const canonIndex = indexWorldNotionVaultFiles(files);
  const universeProfile = parseUniverseProfile(files);
  const loadWarnings: string[] = [];
  const parsedManifest = parseManifest(files, loadWarnings);
  if (!files.some((file) => file.relativePath === pathBranchingMetadataPaths.manifest) && files.some((file) => file.relativePath.startsWith(`${pathBranchingMetadataPaths.stories}/`))) {
    loadWarnings.push("Incomplete story: manifest is missing while story files exist.");
  }
  const fallbackStoryId = defaultStoryId(files);
  const manifest = parsedManifest ?? {
    version: "0.1" as const,
    activeStoryId: undefined,
    stories: [],
  };

  const activeStory =
    manifest.stories.find((story) => story.id === manifest.activeStoryId) ??
    manifest.stories[0];
  if (manifest.activeStoryId && !manifest.stories.some((story) => story.id === manifest.activeStoryId)) {
    loadWarnings.push("Incomplete story: the active story is not present in the manifest.");
  }
  let loadedStory: ReturnType<typeof parseModularStoryProject>;
  const indexedPaths = options.fileIndex
    ? new Set(options.fileIndex.map((file) => file.relativePath))
    : undefined;
  try {
    loadedStory = activeStory
      ? (parseModularStoryProject(files, activeStory, activeStory.id, loadWarnings, indexedPaths, options.deferEventSidecars) ?? parseLegacyStoryProject(files, activeStory, activeStory.id))
      : undefined;
  } catch (error) {
    loadWarnings.push(`Incomplete story: ${activeStory?.path ?? "manifest"}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsedManifest && activeStory && !loadedStory) {
    loadWarnings.push(
      `Could not load PathBranching story "${activeStory.name}" from ${activeStory.path}.`,
    );
  }
  const saveBlockReasons = loadWarnings.filter((warning) => warning.startsWith("Incomplete story:") || warning.startsWith("Could not parse ") || warning.startsWith("Ignored ") || warning.startsWith("Could not load ") || warning.startsWith("No se pudo leer el texto") || warning.startsWith("El texto editado"));
  const activeProject =
    loadedStory?.project ??
    createDefaultProject(
      files,
      canonIndex,
      activeStory?.id ?? fallbackStoryId,
      activeStory?.name,
    );
  const pendingEventIds = loadedStory?.pendingEventIds ?? new Set<string>();
  const totalEvents = new Set(activeProject.sequences.flatMap((sequence) => sequence.eventIds)).size;
  const eventLoad: StoryEventLoadState | undefined = (options.fileIndex || options.deferEventSidecars) && activeStory
    ? {
        status: saveBlockReasons.length ? "incomplete" : pendingEventIds.size ? "loading" : "ready",
        totalEvents,
        loadedEvents: activeProject.events.length,
        failedEvents: 0,
        pendingEventIds,
      }
    : undefined;

  return {
    manifest: {
      ...manifest,
      activeStoryId: activeStory?.id,
    },
    universeProfile,
    canonIndex,
    files: [...files],
    fileIndex: options.fileIndex ? [...options.fileIndex] : undefined,
    storageVersion: loadedStory?.storageVersion,
    eventLoad,
    activeStory,
    activeProject: normalizeLocalizationCatalog(normalizeProject({
      ...activeProject,
      storyId: activeStory?.id,
      integrationConfig:
        parseIntegrationConfigFile(files, pathBranchingMetadataPaths.config) ??
        activeProject.integrationConfig ??
        DEFAULT_INTEGRATION_CONFIG,
      integrationConfigOverride:
        (activeStory
          ? parseIntegrationConfigFile(files, storyIntegrationConfigPath(activeStory.id))
          : undefined) ?? activeProject.integrationConfigOverride,
      canonRefs: mergeCanonRefs(canonIndex, activeProject),
      canonPropertyDescriptors: canonicalPropertyDescriptors(canonIndex.propertiesConfig as Record<string, unknown> | undefined),
    }, { preserveUnloadedEventReferences: Boolean((options.fileIndex || options.deferEventSidecars) && activeStory) }), universeProfile?.localization?.primaryLocale ?? machineLocale()),
    storyModifiedMs: loadedStory?.modifiedMs,
    createdDefaultStory: !activeStory,
    loadWarnings: loadWarnings.length ? loadWarnings : undefined,
    loadingIncomplete: saveBlockReasons.length > 0,
    saveBlocked: saveBlockReasons.length > 0,
    saveBlockReasons: saveBlockReasons.length ? saveBlockReasons : undefined,
  };
}

export type HydratedStoryEvents = {
  project: BranchingProject;
  attemptedEventIds: string[];
  loadedEventIds: string[];
  failedEventIds: string[];
  warnings: string[];
};

/** Parse and safely reconcile a batch of modular event sidecars into an open story. */
export function hydratePathBranchingEvents(
  project: BranchingProject,
  story: PathBranchingStoryManifestEntry,
  storageVersion: string | undefined,
  files: UniverseFile[],
  requestedEventIds: readonly string[],
  options: { deferEvpathReconciliation?: boolean } = {},
): HydratedStoryEvents {
  const warnings: string[] = [];
  const filesByPath = indexUniverseFilesByPath(files);
  const sequenceIdByEventId = new Map<string, string>();
  for (const sequence of project.sequences) {
    sequence.eventIds.forEach((eventId) => {
      if (!sequenceIdByEventId.has(eventId)) {
        sequenceIdByEventId.set(eventId, sequence.id);
      }
    });
  }
  const existingIds = new Set(project.events.map((event) => event.id));
  const attemptedEventIds = [...new Set(requestedEventIds)].filter((id) => !existingIds.has(id));
  const loadedEventIds: string[] = [];
  const failedEventIds: string[] = [];
  const newEvents: BranchingProject["events"] = [];

  for (const eventId of attemptedEventIds) {
    const sequenceId = sequenceIdByEventId.get(eventId);
    if (!sequenceId) {
      failedEventIds.push(eventId);
      warnings.push(`Incomplete story: event ${eventId} is not referenced by a sequence.`);
      continue;
    }
    const jsonPath = eventPath(story.id, sequenceId, eventId);
    const parsed = unwrapEvent(parseJsonFile<unknown>(filesByPath.get(jsonPath)));
    if (!parsed || parsed.id !== eventId) {
      failedEventIds.push(eventId);
      warnings.push(`Incomplete story: ${jsonPath} is missing, invalid, or has a mismatched identifier. Reopen after repairing the file before saving.`);
      continue;
    }
    newEvents.push(parsed);
    loadedEventIds.push(eventId);

    const evpathPath = eventEvpathPath(story.id, sequenceId, eventId);
    if (storageVersion === STORAGE_VERSION && !filesByPath.has(evpathPath)) {
      failedEventIds.push(eventId);
      warnings.push(`Incomplete story: ${evpathPath} is missing.`);
    }
  }

  const eventOrder = new Map<string, number>();
  for (const sequence of project.sequences) {
    sequence.eventIds.forEach((eventId) => {
      if (!eventOrder.has(eventId)) eventOrder.set(eventId, eventOrder.size);
    });
  }
  const normalizedNewEvents = newEvents.length
    ? normalizeProject({ ...project, events: newEvents }, { preserveUnloadedEventReferences: true }).events
    : [];
  const orderedNewEvents = normalizedNewEvents.sort((left, right) =>
    (eventOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (eventOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
  const mergedEvents: BranchingProject["events"] = [];
  let existingIndex = 0;
  let newIndex = 0;
  while (existingIndex < project.events.length && newIndex < orderedNewEvents.length) {
    const existingEvent = project.events[existingIndex];
    const newEvent = orderedNewEvents[newIndex];
    if ((eventOrder.get(existingEvent.id) ?? Number.MAX_SAFE_INTEGER) <= (eventOrder.get(newEvent.id) ?? Number.MAX_SAFE_INTEGER)) {
      mergedEvents.push(existingEvent);
      existingIndex += 1;
    } else {
      mergedEvents.push(newEvent);
      newIndex += 1;
    }
  }
  mergedEvents.push(...project.events.slice(existingIndex), ...orderedNewEvents.slice(newIndex));
  const mergedProject: BranchingProject = { ...project, events: mergedEvents };
  const reconciledProject = options.deferEvpathReconciliation
    ? mergedProject
    : reconcileEventEvpathFiles(mergedProject, files, story.id, warnings, new Set(loadedEventIds));

  return { project: reconciledProject, attemptedEventIds, loadedEventIds, failedEventIds, warnings };
}

export function serializePathBranchingManifest(
  manifest: PathBranchingManifest,
): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function serializePathBranchingStory(project: BranchingProject): string {
  return serializeProject(project);
}

function ownerSequenceIdForBranch(
  project: BranchingProject,
  branchId: string,
): string | undefined {
  return (
    project.sequences.find((sequence) => sequence.branchIds?.includes(branchId))
      ?.id ??
    project.sequences.find((sequence) =>
      project.branches
        .find((branch) => branch.id === branchId)
        ?.eventIds.some((eventId) => sequence.eventIds.includes(eventId)),
    )?.id ??
    project.canvas?.activeSequenceId ??
    project.entrySequenceId ??
    project.sequences[0]?.id
  );
}

export function serializeModularStoryFiles(
  projectInput: BranchingProject,
  story: PathBranchingStoryManifestEntry,
  options: { preserveUnloadedEventReferences?: boolean } = {},
): Array<{ relativePath: string; content: string }> {
  const project = normalizeProject({
    ...projectInput,
    storyId: story.id,
    name: projectInput.name ?? story.name,
  }, options);
  // Keep all project metadata, including future modular authoring extensions.
  // Only split graph/layout collections and integration YAML out of story.json.
  const { sequences, branches, events, canvas, panels, integrationConfig, integrationConfigOverride, ...metadata } = project;
  const eventSequenceIdById = new Map<string, string>();
  const eventById = new Map(events.map((event) => [event.id, event]));
  for (const sequence of sequences) {
    for (const eventId of sequence.eventIds) {
      if (!eventSequenceIdById.has(eventId)) eventSequenceIdById.set(eventId, sequence.id);
    }
  }
  const fallbackEventSequenceId = project.canvas?.activeSequenceId ?? project.entrySequenceId ?? sequences[0]?.id;
  const storyMetadata: ModularStoryFile = {
    ...metadata,
    storageVersion: STORAGE_VERSION,
    storyId: story.id,
    name: project.name ?? story.name,
    sequenceIds: sequences.map((sequence) => sequence.id),
  };

  const files: Array<{ relativePath: string; content: string }> = [
    {
      relativePath: storyPath(story.id),
      content: `${JSON.stringify(storyMetadata, null, 2)}\n`,
    },
    {
      relativePath: authoringCanvasPath(story.id),
      content: `${JSON.stringify({ storageVersion: STORAGE_VERSION, storyId: story.id, canvas: project.canvas, panels: project.panels }, null, 2)}\n`,
    },
  ];

  if (project.integrationConfigOverride) {
    files.push({
      relativePath: storyIntegrationConfigPath(story.id),
      content: serializeIntegrationConfigYaml(project.integrationConfigOverride),
    });
  }

  project.sequences.forEach((sequence) => {
    files.push({
      relativePath: sequencePath(story.id, sequence.id),
      content: `${JSON.stringify({ storageVersion: STORAGE_VERSION, storyId: story.id, sequence }, null, 2)}\n`,
    });
  });

  project.events.forEach((event) => {
    const sequenceId = eventSequenceIdById.get(event.id) ?? fallbackEventSequenceId;
    if (!sequenceId) return;
    files.push({
      relativePath: eventPath(story.id, sequenceId, event.id),
      content: `${JSON.stringify({ storageVersion: STORAGE_VERSION, storyId: story.id, sequenceId, event }, null, 2)}\n`,
    });
    // Canonical narrative projection alongside the JSON sidecar.
    files.push({
      relativePath: eventEvpathPath(story.id, sequenceId, event.id),
      content: serializeEventEvpath(project, event.id, eventById),
    });
  });

  project.branches.forEach((branch) => {
    const sequenceId = ownerSequenceIdForBranch(project, branch.id);
    if (!sequenceId) return;
    files.push({
      relativePath: branchPath(story.id, sequenceId, branch.id),
      content: `${JSON.stringify({ storageVersion: STORAGE_VERSION, storyId: story.id, sequenceId, branch }, null, 2)}\n`,
    });
  });

  return files;
}
