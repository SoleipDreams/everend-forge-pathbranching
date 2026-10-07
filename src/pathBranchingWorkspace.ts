import type { BranchingProject } from "./domain.js";
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
import { applyEvpathToEvent, serializeEventEvpath } from "./evpathFormat.js";

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
    if (!parsed || typeof parsed !== "object") return undefined;
    const icon: UniverseIcon | undefined =
      parsed.icon?.type && parsed.icon.value
        ? {
            type: parsed.icon.type === "image" ? "image" : "preset",
            value: String(parsed.icon.value),
          }
        : undefined;
    return {
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

function parseJsonFile<T>(file: UniverseFile | undefined): T | undefined {
  if (!file) return undefined;
  try {
    return JSON.parse(file.content) as T;
  } catch {
    return undefined;
  }
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
): { project: BranchingProject; modifiedMs?: number } | undefined {
  const modularPath = story.path.endsWith("/story.json")
    ? story.path
    : storyPath(storyId);
  const storyFile = files.find((file) => file.relativePath === modularPath);
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
    const file = files.find((candidate) => candidate.relativePath === relativePath);
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
  for (const sequence of sequences) {
    if (!Array.isArray(sequence.eventIds) || (sequence.branchIds !== undefined && !Array.isArray(sequence.branchIds))) {
      loadWarnings?.push(`Incomplete story: ${sequencePath(storyId, sequence.id)} has invalid member lists.`);
      continue;
    }
    for (const id of sequence.eventIds) {
      if (events.some((candidate) => candidate.id === id)) continue;
      const event = readRequired(eventPath(storyId, sequence.id, id), unwrapEvent, id);
      if (event && !events.some((candidate) => candidate.id === id)) events.push(event);
      if (parsedStory.storageVersion === STORAGE_VERSION && !files.some((file) => file.relativePath === eventEvpathPath(storyId, sequence.id, id))) {
        loadWarnings?.push(`Incomplete story: ${eventEvpathPath(storyId, sequence.id, id)} is missing.`);
      }
    }
    for (const id of sequence.branchIds ?? []) {
      if (branches.some((candidate) => candidate.id === id)) continue;
      const branch = readRequired(branchPath(storyId, sequence.id, id), unwrapBranch, id);
      if (branch && !branches.some((candidate) => candidate.id === id)) branches.push(branch);
    }
  }
  const authoringFile = files.find((file) => file.relativePath === authoringCanvasPath(storyId));
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
  });

  return {
    modifiedMs: storyFile.modifiedMs,
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
): BranchingProject {
  let current = project;
  for (const event of project.events) {
    const sequenceId = ownerSequenceIdForEvent(current, event.id);
    if (!sequenceId) continue;
    const evpathFile = files.find(
      (file) => file.relativePath === eventEvpathPath(storyId, sequenceId, event.id),
    );
    if (!evpathFile) continue;
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
    // The `.evpath` diverged from the JSON (an external edit). Adopt it only if
    // re-serializing the applied event reaches a fixed point.
    const reserialized = serializeEventEvpath(applied.project, event.id);
    const settle = applyEvpathToEvent(applied.project, event.id, reserialized);
    if (settle.errors.length || settle.changed) {
      loadWarnings?.push(
        `El texto editado de "${event.name}" no se pudo aplicar de forma estable; se conserva la versión guardada.`,
      );
      continue;
    }
    current = applied.project;
  }
  return current;
}

function parseLegacyStoryProject(
  files: UniverseFile[],
  story: PathBranchingStoryManifestEntry,
  storyId: string,
): { project: BranchingProject; modifiedMs?: number } | undefined {
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
  try {
    loadedStory = activeStory
      ? (parseModularStoryProject(files, activeStory, activeStory.id, loadWarnings) ?? parseLegacyStoryProject(files, activeStory, activeStory.id))
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

  return {
    manifest: {
      ...manifest,
      activeStoryId: activeStory?.id,
    },
    universeProfile,
    canonIndex,
    files: [...files],
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
    }), universeProfile?.localization?.primaryLocale ?? machineLocale()),
    storyModifiedMs: loadedStory?.modifiedMs,
    createdDefaultStory: !activeStory,
    loadWarnings: loadWarnings.length ? loadWarnings : undefined,
    loadingIncomplete: saveBlockReasons.length > 0,
    saveBlocked: saveBlockReasons.length > 0,
    saveBlockReasons: saveBlockReasons.length ? saveBlockReasons : undefined,
  };
}

export function serializePathBranchingManifest(
  manifest: PathBranchingManifest,
): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function serializePathBranchingStory(project: BranchingProject): string {
  return serializeProject(project);
}

function ownerSequenceIdForEvent(
  project: BranchingProject,
  eventId: string,
): string | undefined {
  return (
    project.sequences.find((sequence) => sequence.eventIds.includes(eventId))
      ?.id ??
    project.canvas?.activeSequenceId ??
    project.entrySequenceId ??
    project.sequences[0]?.id
  );
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
): Array<{ relativePath: string; content: string }> {
  const project = normalizeProject({
    ...projectInput,
    storyId: story.id,
    name: projectInput.name ?? story.name,
  });
  // Keep all project metadata, including future modular authoring extensions.
  // Only split graph/layout collections and integration YAML out of story.json.
  const { sequences, branches, events, canvas, panels, integrationConfig, integrationConfigOverride, ...metadata } = project;
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
    const sequenceId = ownerSequenceIdForEvent(project, event.id);
    if (!sequenceId) return;
    files.push({
      relativePath: eventPath(story.id, sequenceId, event.id),
      content: `${JSON.stringify({ storageVersion: STORAGE_VERSION, storyId: story.id, sequenceId, event }, null, 2)}\n`,
    });
    // Canonical narrative projection alongside the JSON sidecar.
    files.push({
      relativePath: eventEvpathPath(story.id, sequenceId, event.id),
      content: serializeEventEvpath(project, event.id),
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
