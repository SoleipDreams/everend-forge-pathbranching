import { NarrativeNameEditor } from './components/NarrativeNameEditor.js';
import { AuthoringTextField } from "./components/AuthoringTextField.js";
import { InspectorPanel } from "./components/InspectorPanel.js";
import { InteractionsEditor } from './components/InteractionsEditor.js';
import { InteractionConsequencesEditor } from './components/InteractionConsequencesEditor.js';
import { addInteraction, deleteInteractionBarrier, deleteInteractionUse, setInteractionResultRoute } from './interactionMutations.js';
import { useInspectorMenuPlacement } from "./components/useInspectorMenuPlacement.js";
import { InspectorSelect } from "./components/InspectorSelect.js";
import { InspectorWorldLinks } from "./components/InspectorWorldLinks.js";
import { mergeUniverseProfile } from "./universeProfilePersistence.js";
import { readUniverseProfileSource } from "./projectPersistence.js";
import { PathBranchingSettingsModal, type PathBranchingSettingsSection } from "./components/PathBranchingSettingsModal.js";
import { useLearningAdapter, useLearningReporter } from "./learning";
import { pathbranchingIntroduction, pathbranchingLessons } from "./learningCatalog";
import { learningActionsForMutation } from "./learningActions";
import { NotificationProvider, NotificationBell, useNotificationMessage } from "./notifications";
import { SceneChoices } from "./SceneChoices";
import { normalizeBackgroundScene } from "./backgroundScenes";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
  type ReactFlowInstance,
} from "@xyflow/react";
import { listen } from "@tauri-apps/api/event";
import {
  canonMarkdownDraft,
  markdownFormatTemplate,
} from "./canonWorkingCopy.js";
import { changeSetPath, createCanonChangeSet } from "./canonChanges.js";
import { applyEvpathToEvent } from "./evpathFormat.js";
import { EvpathEditor, type EvpathApplyOutcome } from "./components/EvpathEditor.js";
import { CanonWorkingCopyEditor } from "./components/CanonWorkingCopyEditor.js";
import { DataDrawer } from "./components/DataDrawer.js";
import { ReferencePicker } from "./components/ReferencePicker.js";
import { AssetsPanel } from "./components/AssetsPanel.js";
import { LogicPanel } from "./components/LogicPanel.js";
import { PropertyCapabilitiesEditor } from "./components/PropertyCapabilitiesEditor.js";
import { InteractionAuthoringContext } from './components/InteractionAuthoringContext.js';
import { ConditionReferenceCreationContext } from "./components/ConditionReferenceCreationContext.js";
import { ItemCatalogContext } from './components/ItemCatalogContext.js';
import { emptyItemCatalog, itemCatalogFromFiles, itemCatalogPath, serializeItemCatalog, type ItemCatalogLibrary } from './itemCatalog.js';
import { createConditionReference, mergeConditionReferenceCreation } from "./conditionReferenceCreation.js";
import { interactionLibraryFromFiles, defaultInteractionMechanicsLibrary, interactionMechanicsPath, serializeInteractionMechanicsLibrary } from './interactionLibrary.js';
import { saveUniverseBatch, universeBatchFiles } from './projectPersistence.js';
import { updatePropertyCapability, canonicalPropertyDescriptors } from './characterStats.js';
import type { InteractionMechanicsLibrary } from './domain.js';
import { LogicConditionEditor, LogicEffectEditor, LogicMomentEditor } from "./components/LogicComposer.js";
import type { ConditionAuthoringContext } from "./conditionAuthoring.js";
import { StoryTestControls, StoryTestDebug, StoryTestInspectorView, StoryTestPlayback } from "./components/StoryTestViews.js";
import { storyTestSpeaker } from "./storyTestMedia.js";
import { useStoryTestController } from "./useStoryTestController.js";
import { useStoryTestWindows } from "./storyTestWindows.js";
import { ExportPanel } from "./components/ExportPanel.js";
import { ExportPreviewDialog } from "./components/ExportPreviewDialog.js";
import { authoringNodeOptions, narrativeNodeReferences } from "./authoringMutations.js";
import { inspectorDocumentIndex } from "./inspectorDocumentIndex.js";
import { createCanvasPresentationCache } from "./canvas/presentationCache.js";
import { createCanvasValidationCache, requiresSubcanvasLayout } from "./canvas/interactionPerformance.js";
import { createNarrativeValidationCache, narrativeContentUnchanged } from "./narrativeValidation.js";
import { RouteInspector } from "./components/RouteInspector.js";
import { canvasInspectorTarget, closeInspectorStackTabs, inspectorTargetKind, inspectorTargetTitle, inspectorStackCardHeight, inspectorStackKey, orderedInspectorStack, type InspectorSize, type InspectorStackTarget } from "./inspectorNavigation.js";
import { useInspectorLayoutMotion } from "./components/useInspectorLayoutMotion.js";
import { InspectorIndexHost } from "./components/InspectorIndexHost.js";
import "./unifiedInspector.css";
import { UnifiedAuthoringInspector } from "./components/UnifiedAuthoringInspector.js";
import { InspectorModuleTabs } from "./components/InspectorModuleTabs.js";
import { narrativeInspectorModules, readInspectorModulePreferences, resolveInspectorModulePreferences, saveInspectorModulePreferences } from "./inspectorModules.js";
import { ConversationEditor } from "./components/ConversationEditor.js";
import { conversationLineForCanvasSelection } from "./conversationModel.js";
import { inspectorSelectionKey, type InspectorRequest } from "./appTypes.js";
import { useAuthoringDraftCount } from "./components/useAuthoringDraft.js";
import { authoringDraftEntries, authoringDraftKey, getAuthoringDraft, setAuthoringDraft, clearAuthoringRecovery, readAuthoringRecovery, storeAuthoringRecovery, type AuthoringRecovery } from "./authoringDrafts.js";
import { LocaleSettingsFields } from "./components/LocaleSettingsFields.js";
import { DesktopMenuBar } from "./components/DesktopMenuBar.js";
import { WindowTitleControls } from "./components/WindowTitleControls.js";
import { ConnectPanel } from "./components/ConnectPanel.js";
import { EverendBridgePanel } from "./components/EverendBridgePanel.js";
import { MarkdownEditorDock } from "./components/MarkdownEditorDock.js";
import { editableCanvasEdgeTypes } from "./components/EditableCanvasEdge.js";
import { nodeTypes, StoryCanvasNodeIcon, type DialoguePreset } from "./components/StoryNode.js";
import { CanvasMiniMap } from "./components/CanvasMiniMap.js";
import { HomeForgeMenu, Topbar } from "./components/Topbar.js";
import { authoringDiagnosticTarget, diagnosticSelection, findingPresentation, transitionOrderDetails } from "./diagnosticPresentation.js";
import { entityUsages, removeLocalExplorerEntityReferences, removeLocalExplorerPropertyValues } from "./authoringEntities.js";
import { useOverlayFocus } from "./components/useOverlayFocus.js";
import { ApplicationActivity, useApplicationEffect } from "./components/useApplicationActivity.js";
import { ExplorerGroup, ExplorerPane, useExplorerEmbedded } from "./components/ExplorerPresentation.js";
import { AdaptiveWorkspace, WorkspacePanelSlot } from "./components/AdaptiveWorkspace.js";
import { isExplorerPanel, managementPanelCollapsedState, type ExplorerPanelId } from "./adaptiveWorkspace.js";
import { guardUniverseSwitch } from "./universeSwitchGuard.js";
import "./forgeAuthoring.css";
import "./explorerPresentation.css";
import "./forgeMotion.css";
import "./forgeAmbient.css";
import { StoriesPanel, storiesViewCopy } from "./components/StoriesPanel.js";
import { AccessibleTabs } from "./components/AccessibleTabs.js";
import { FeedbackModal } from "./components/FeedbackModal.js";
import { UniverseIconFrame } from "./components/UniverseIconFrame.js";
import {
  createLocalExplorerEntity,
  localEntityPath,
  serializeLocalExplorerEntity,
} from "./explorerEntities.js";
import {
  canonExplorerProperties,
  canonImagePropertiesForRef,
  canonPresentationImageForRef,
  flattenCanonExplorerProperties,
  canonExplorerTypes,
  explorerTypeLabel,
  canonExplorerTypeProperty,
  createLocalExplorerProperty,
  createLocalExplorerType,
  appendLocalExplorerPropertyToTree,
  findLocalExplorerPropertyInTree,
  flattenLocalExplorerPropertyTree,
  isLocalExplorerSubproperty,
  removeLocalExplorerPropertyFromTree,
  updateLocalExplorerPropertyInTree,
  propertyCapability,
  propertyIsEntityPresentable,
  entitySupportsDialogueTrigger,
  DIALOGUE_TRIGGER_ACTIONS,
  typeCapability,
  isLocationType,
  grantableEntities,
  locationEntities,
  entityRefOptions,
  type GrantableEntityOption,
} from "./explorerSchema.js";
import {
  canonVariantsForRef,
  resolveCanonVariantFrontmatter,
  resolveCanonVariantId,
} from "./worldnotionVariants.js";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Castle,
  CircleDot,
  ChevronLeft,
  Database,
  Dices,
  Download,
  Eye,
  EyeOff,
  FilePlus2,
  FileText,
  FolderOpen,
  Focus,
  Globe2,
  GitBranch,
  Home,
  ImagePlus,
  Info,
  Link,
  LayoutGrid,
  MapPin,
  Maximize2,
  Fullscreen,
  Shrink,
  MessageSquare,
  MoreHorizontal,
  MousePointerClick,
  Minimize2,
  Moon,
  MessageSquareText,
  OctagonAlert,
  Play,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Split,
  Sun,
  Sparkles,
  Upload,
  Pencil,
  Power,
  Trash2,
  Tag,
  X,
} from "lucide-react";
import pathbranchingIcon from "./assets/pathbranching-icon.png";
import {
  useCallback,
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import type {
  Branch,
  BranchingProject,
  CanvasScope,
  CanonEditSuggestion,
  CanonWorkingCopy,
  CanonRef,
  ConditionInput,
  Consequence,
  DataFieldDefinition,
  Decision,
  DialogueBeat,
  DialogueMemberRef,
  DialogueNode,
  DialogueStart,
  EventCategoryDefinition,
  EventNode,
  EventType,
  ExplorerPropertyOption,
  LocalExplorerEntity,
  LocalExplorerProperty,
  LocalExplorerType,
  LogicPropertyOverride,
  LogicTypeOverride,
  Outcome,
  ProjectDataObject,
  ScriptBlock,
  SceneImageAttachment,
  Sequence,
  SpeechBeatCounterPreference,
  Transition,
  ValidationFinding,
} from "./domain.js";
import type {
  AppView,
  CanvasMode,
  MarkdownDraftFormat,
  MarkdownEditorTab,
  InspectorTab,
  Selection,
} from "./appTypes.js";
import {
  createBranchingStory,
  deleteBranchingStory,
  renameBranchingStory,
  saveBranchingDocument,
} from "./documentController.js";
import {
  applyEventDraftToProject,
  createEventDraftFromSelection,
  type EventDraft,
} from "./eventDraft.js";
import {
  DEFAULT_EVENT_INSPECTOR_STATE,
  closeAllEventInspectorTabs,
  closeEventInspectorTab,
  collapseEventInspectorTab,
  deleteEventInspectorTabGroup,
  loadEventInspectorTabGroup,
  openEventInspectorTab,
  pruneEventInspectorTabGroups,
  pruneEventInspectorState,
  restoreEventInspectorState,
  saveEventInspectorTabGroup,
  type EventInspectorState,
} from "./eventInspectorState.js";
import { buildExportPreview, type ExportPreviewMode } from "./exportPreview.js";
import { importTwineHtml } from "./twineFormat.js";
import {
  conditionCount,
  conditionLabels,
  consequenceLabel,
  isConditionSet,
} from "./logic.js";
import { canonRefHasRole, mergeIntegrationConfigs } from "./integrationConfig.js";
import {
  blockValues,
  canonicalLocale,
  localeDisplayName,
  machineLocale,
  normalizeLocaleList,
  normalizeLocaleNames,
  normalizeLocalizationCatalog,
  scriptBlockTextKey,
  updateLocalizedEntry,
} from "./localization.js";
import { UNKNOWN_SPEAKER_REF, speakerLabel } from "./speakerRoles.js";
import { automaticNarrativeName } from "./narrativeNaming.js";
import * as mutations from "./projectMutations.js";
import {
  exportRuntimeDialog,
  normalizeProject,
  openDemoUniverse,
  openUniverseDialog,
  openUniversePath,
  openUniverseStory,
  projectFileName,
  revealUniverseFolder,
  exportTextDialog,
  importUniverseAssets,
  importSceneImages,
  indexCanonAssets,
  registerSharedBrowserUniverse,
  saveWorkingCopy,
  saveUniverseTextFile,
  type ProjectFileState,
} from "./projectPersistence.js";
import { DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE } from "./projectSerialization.js";
import {
  workingCopyPathForCanonRef,
  type PathBranchingWorkspace,
  type UniverseProfile,
} from "./pathBranchingWorkspace.js";
import {
  THEMES,
  isDarkTheme,
  normalizeThemeId,
  themeById,
  themeForFamilyAndMode,
  toggledThemeMode,
  type ThemeFamily,
  type ThemeId,
} from "./themes.js";
import {
  activeCanvasScope,
  activeSequenceId,
  canvasScopeKey,
  findBranch,
  findEvent,
  findSequence,
  rootSequenceScope,
} from "./storySelection.js";
import type { SuiteChrome, SuiteSettings } from "./suiteChrome.js";
import { BrandLoadingScreen } from "./components/BrandLoadingScreen.js";
import { StoryCreationEmptyState } from "./components/StoryCreationEmptyState.js";
import { OnboardingGuide } from "./components/OnboardingGuide.js";
import { InteractionTutorial } from "./components/InteractionTutorial.js";
import { SequenceCharacterPicker } from "./components/SequenceCharacterPicker.js";
import {
  buildPathTree,
  assignEventToBranch,
  branchesForSequence,
  eventsForBranch,
  type PathTreeNode,
  type StoryOutlineTab,
} from "./storyOutlineModel.js";
import {
  COLLAPSED_RAIL_WIDTH,
  DEFAULT_WORKSPACE_PANEL_COLLAPSED,
  DEFAULT_WORKSPACE_PANEL_VISIBILITY,
  VISIBLE_WORKSPACE_PANEL_IDS,
  DEFAULT_EXPLORER_WIDTH,
  DEFAULT_PANEL_WIDTH,
  NEW_SEQUENCE_SELECT_VALUE,
  clampPanelWidth,
  clampExplorerWidth,
  loadSettings,
  normalizeCanvasBackgroundSettings,
  normalizeCanvasLayoutMode,
  normalizeAuthoringDisplaySettings,
  normalizeNodeColorSettings,
  normalizeWorkspaceSession,
  rememberRecentProject,
  saveSettings,
  storableMarkdownTabs,
  type AppSettings,
  type AuthoringDisplaySettings,
  type CanvasBackgroundSettings,
  type CanvasLayerMode,
  type CanvasLayoutMode,
  type EventInspectorTabGroup,
  type NodeColorSettings,
  type PathBranchingWorkspaceSession,
  type WorldNotionBridgeSettings,
  type WorkspacePanelId,
  type WorkspacePanelState,
} from "./workspaceSettings.js";
import { applyInterfaceLocale, interfaceLocaleCopy, pathbranchingSettingsCopy, resolveInterfaceLocale, useInterfaceLocale, authoringUiCopy, onboardingUiCopy, homeUiCopy, inspectorUiCopy, panelUiText } from "./i18n.js";
import {
  buildStoryCanvasModel,
  DIRECTION_BEAT_NODE_HEIGHT,
  fitSubcanvasWorkspaceBounds,
  layoutSubcanvasNodes,
  routeGateVisualAnchorFromLogicPosition,
  SPEECH_BEAT_NODE_HEIGHT,
  type PathBranchingFileItem,
  type StoryCanvasEdge,
  type StoryCanvasEdgeData,
  type StoryCanvasNode,
  type StoryCanvasNodeData,
  type SubcanvasWorkspaceBounds,
} from "./canvas/storyCanvasModel.js";
import { connectedNarrativeNodePosition } from "./canvas/nodePlacement.js";
import { canvasReturnConnectors } from "./canvas/returnConnectors.js";
import { isTauriRuntime, shortcutMatches } from "./utils/appEnvironment.js";
import { handleWindowTitlebarMouseDown } from "./utils/windowTitlebar.js";
import { resolveUniverseAssetUrl } from "./utils/assetUrl.js";

function groupCanon(project: BranchingProject) {
  return project.canonRefs.reduce<Record<string, typeof project.canonRefs>>(
    (groups, ref) => {
      const kind = ref.kind ?? "canon";
      groups[kind] ??= [];
      groups[kind].push(ref);
      return groups;
    },
    {},
  );
}

type FloatingBounds = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

function clampFloatingMenuPosition(
  x: number,
  y: number,
  bounds: FloatingBounds,
  width = 220,
  height = 220,
) {
  const gutter = 8;
  const maxX = Math.max(bounds.left + gutter, bounds.right - width - gutter);
  const maxY = Math.max(bounds.top + gutter, bounds.bottom - height - gutter);
  return {
    x: Math.min(Math.max(x, bounds.left + gutter), maxX),
    y: Math.min(Math.max(y, bounds.top + gutter), maxY),
  };
}

function viewportBounds(): FloatingBounds {
  return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
}

const WORKSPACE_PANEL_LABELS: Record<WorkspacePanelId, string> = {
  outline: "Stories",
  assets: "Assets",
  logic: "Logic",
  player: "Player",
  export: "Export",
  connect: "Connect",
};
const PATHBRANCHING_ONBOARDING_KEY = "pathbranching.onboarding.v1";
const PATHBRANCHING_INTERACTION_TUTORIAL_KEY =
  "pathbranching.interactionTutorial.v1";

type CanonTreeNode = {
  kind: "folder" | "ref";
  name: string;
  path: string;
  ref?: CanonRef;
  children: CanonTreeNode[];
};

function pathDirectory(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function pathBasename(path: string) {
  return (
    path.replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/i, "") ?? path
  );
}

function canonRefPath(ref: CanonRef) {
  return ref.canonSourcePath ?? ref.id;
}

function universeAssetUrl(
  project: Pick<BranchingProject, "universeRootPath">,
  relativePath: string,
): string | undefined {
  return resolveUniverseAssetUrl(project.universeRootPath, relativePath);
}

function eventCoverImageForNode(
  project: Pick<BranchingProject, "assets" | "universeRootPath">,
  event: EventNode,
): (SceneImageAttachment & { name: string; url?: string }) | undefined {
  const attachment = event.coverImage;
  const asset = attachment
    ? project.assets?.find((candidate) => candidate.id === attachment.assetId && candidate.kind === "image")
    : undefined;
  return attachment && asset
    ? { ...attachment, name: asset.name, url: universeAssetUrl(project, asset.path) }
    : undefined;
}

/**
 * Scopes the image picker to a location's gallery when one is set. Falls back
 * to every image asset when no location is active or its gallery is empty,
 * preserving today's behavior for location-less events/beats.
 */
function imageAssetsForLocation(
  project: Pick<BranchingProject, "assets" | "localExplorerEntities" | "canonEntityGalleries">,
  locationRef: string | undefined,
): Array<{ id: string; name: string }> {
  const allImages = (project.assets ?? []).filter((asset) => asset.kind === "image");
  const gallery = locationRef
    ? project.localExplorerEntities?.find((entity) => entity.id === locationRef)?.imageGallery
      ?? project.canonEntityGalleries?.[locationRef]
    : undefined;
  const scoped = gallery?.length ? allImages.filter((asset) => gallery.includes(asset.id)) : allImages;
  return scoped.map((asset) => ({ id: asset.id, name: asset.name }));
}

function DialogueBeatDirectionNote({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const latestDraft = useRef(draft);
  const committedValue = useRef(value);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useEffect(() => {
    setDraft(value);
    latestDraft.current = value;
    committedValue.current = value;
  }, [value]);
  useEffect(() => () => {
    if (latestDraft.current !== committedValue.current) onCommitRef.current(latestDraft.current);
  }, []);
  const commit = () => {
    if (draft === committedValue.current) return;
    committedValue.current = draft;
    onCommit(draft);
  };
  return <textarea
    rows={3}
    value={draft}
    onChange={(event) => {
      latestDraft.current = event.target.value;
      setDraft(event.target.value);
    }}
    onBlur={commit}
    placeholder={useInterfaceLocale() === "es" ? "Añade una nota de dirección, tono o ritmo…" : "Add a direction note about mood or timing…"}
  />;
}

function dialogueTriggerPortraitUrl(
  project: Pick<BranchingProject, "canonRefs" | "universeRootPath">,
  propertiesConfig: Record<string, unknown> | undefined,
  start: DialogueStart | undefined,
) {
  if (start?.source?.kind !== "canonRef") return undefined;
  const ref = project.canonRefs.find((candidate) => candidate.id === start.source?.id);
  if (!ref) return undefined;
  const portrait = canonPresentationImageForRef(propertiesConfig, ref, "portrait");
  return portrait ? canonVaultImageUrl(project, portrait.value) : undefined;
}

function canonVaultImageUrl(
  project: Pick<BranchingProject, "universeRootPath">,
  relativePath: string,
): string | undefined {
  return universeAssetUrl(project, relativePath);
}

function searchablePropertyValues(value: unknown): string[] {
  if (value == null) return [];
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap(searchablePropertyValues);
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, nested]) => [key, ...searchablePropertyValues(nested)],
    );
  }
  return [];
}

function canonRefMatches(ref: CanonRef, query: string) {
  if (!query) return true;
  return [
    ref.id,
    ref.label,
    ref.kind,
    ref.status,
    ref.canonSourcePath,
    ref.identityWarning,
    ref.parentId,
    ...(ref.tags ?? []),
    ...(ref.aliases ?? []),
    ...(ref.childrenIds ?? []),
    ...searchablePropertyValues(ref.properties),
    ...searchablePropertyValues(ref.frontmatter),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function canonRefHasProperty(ref: CanonRef, propertyId: string) {
  return [ref.properties, ref.frontmatter].some((record) =>
    Boolean(record && Object.prototype.hasOwnProperty.call(record, propertyId)),
  );
}

function canonRefPropertyValue(ref: CanonRef, propertyId: string): unknown {
  return ref.properties?.[propertyId] ?? ref.frontmatter?.[propertyId];
}

function canonRefIsEntityPresentable(
  project: BranchingProject,
  propertiesConfig: Record<string, unknown> | undefined,
  ref: CanonRef,
): boolean {
  // Check if this canonRef's type has entityPresentable enabled
  if (ref.kind && propertyIsEntityPresentable(project, "canon", `type:${ref.kind}`)) {
    return true;
  }
  
  // Check if this canonRef is referenced as a value in any entityPresentable property
  const presentableProperties = flattenCanonExplorerProperties(canonExplorerProperties(propertiesConfig))
    .filter(property => propertyIsEntityPresentable(project, "canon", property.id));
  
  for (const property of presentableProperties) {
    // Check all canonRefs to see if any reference this entity in the presentable property
    const isReferencedInProperty = project.canonRefs.some(canonRef => {
      const value = canonRefPropertyValue(canonRef, property.id);
      if (Array.isArray(value)) {
        return value.includes(ref.id);
      }
      return value === ref.id;
    });
    
    if (isReferencedInProperty) {
      return true;
    }
  }
  
  return false;
}

function folderPathForFolderDescription(ref: CanonRef) {
  if (!ref.folderDescription) return undefined;
  const sourcePath = canonRefPath(ref).replace(/\\/g, "/");
  const folderPath = pathDirectory(sourcePath);
  if (folderPath) return folderPath;
  const normalized = sourcePath.replace(/\.md$/i, "");
  return normalized.includes("/") ? undefined : normalized;
}

function buildCanonFileTree(refs: CanonRef[]): CanonTreeNode[] {
  const root: CanonTreeNode[] = [];
  const folders = new Map<string, CanonTreeNode>();

  const ensureFolder = (folderPath: string) => {
    const existing = folders.get(folderPath);
    if (existing) return existing;
    const node: CanonTreeNode = {
      kind: "folder",
      name: pathBasename(folderPath),
      path: folderPath,
      children: [],
    };
    folders.set(folderPath, node);
    const parentPath = pathDirectory(folderPath);
    if (parentPath) {
      ensureFolder(parentPath).children.push(node);
    } else {
      root.push(node);
    }
    return node;
  };

  refs.forEach((ref) => {
    const describedFolder = folderPathForFolderDescription(ref);
    if (describedFolder) {
      const folder = ensureFolder(describedFolder);
      folder.ref = ref;
      return;
    }

    const refPath = canonRefPath(ref);
    const folderPath = pathDirectory(refPath);
    const node: CanonTreeNode = {
      kind: "ref",
      name: ref.label ?? pathBasename(refPath),
      path: refPath,
      ref,
      children: [],
    };
    if (folderPath) {
      ensureFolder(folderPath).children.push(node);
    } else {
      root.push(node);
    }
  });

  const sort = (nodes: CanonTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sort(node.children));
  };

  sort(root);
  return root;
}

function groupCanonByTag(refs: CanonRef[]) {
  return refs.reduce<Record<string, CanonRef[]>>((groups, ref) => {
    const tags = ref.tags?.length ? ref.tags : ["_untagged"];
    tags.forEach((tag) => {
      groups[tag] ??= [];
      groups[tag].push(ref);
    });
    return groups;
  }, {});
}

function universeDisplayName(
  project?: BranchingProject,
  fileState?: ProjectFileState,
) {
  return (
    fileState?.universeProfile?.name ??
    project?.name ??
    project?.projectId ??
    "No universe loaded"
  );
}

function universeDisplayPath(fileState?: ProjectFileState) {
  const universePath = projectFileName(
    fileState?.universePath ?? fileState?.path,
  );
  const storyPath = projectFileName(fileState?.storyPath ?? fileState?.path);
  return [universePath, storyPath].filter(Boolean).join(" / ");
}

function workspaceLoadWarningMessage(workspace: PathBranchingWorkspace) {
  return workspace.loadWarnings?.length
    ? workspace.loadWarnings.join(" ")
    : undefined;
}

function updateProjectCanvas(
  project: BranchingProject,
  nodes: StoryCanvasNode[],
  scope = activeCanvasScope(project),
  manuallyPositionedNodeId?: string,
): BranchingProject {
  const scopeKey = scope ? canvasScopeKey(scope) : undefined;
  const persistBoundaryPorts = scope?.kind === "event" || scope?.kind === "dialogue";
  const persistableNodes = nodes.filter(
    (node) =>
      node.data.kind !== "workspace" &&
      node.data.kind !== "endAdder" &&
      (node.data.kind !== "boundary" || persistBoundaryPorts),
  );
  const withoutBoundaryPositions = (
    storedNodes: Record<string, { position?: { x: number; y: number } }> | undefined,
  ) => Object.fromEntries(
    Object.entries(storedNodes ?? {}).filter(
      ([id]) =>
        !id.startsWith("boundary:") &&
        !id.startsWith("dialogue-boundary:") &&
        !id.startsWith("workspace:") &&
        !id.startsWith("end-adder:"),
    ),
  );
  const nextNodes = Object.fromEntries(
    persistableNodes.map((node) => [
      node.id,
      {
        ...(scopeKey
          ? project.canvas?.scopes?.[scopeKey]?.nodes?.[node.id]
          : project.canvas?.nodes?.[node.id]),
        position: node.data.kind === "routeGate" && node.data.canvasLayerMode === "logic"
          ? routeGateVisualAnchorFromLogicPosition(node.position, node.width, node.height)
          : node.position,
        ...(node.data.kind === "routeGate"
          ? {
              positionPinned: true,
              ...(node.id === manuallyPositionedNodeId ? { manual: true } : {}),
            }
          : {}),
      },
    ]),
  );
  const workspaceNode = nodes.find((node) => node.data.kind === "workspace");
  const workspaceBounds = workspaceNode
    ? {
        x: workspaceNode.position.x,
        y: workspaceNode.position.y,
        width: workspaceNode.width ?? 720,
        height: workspaceNode.height ?? 460,
        manual: scopeKey
          ? project.canvas?.scopes?.[scopeKey]?.workspace?.manual
          : undefined,
      }
    : undefined;
  const nextScopeState = scopeKey
    ? {
        ...(project.canvas?.scopes?.[scopeKey] ?? {}),
        nodes: {
          ...withoutBoundaryPositions(project.canvas?.scopes?.[scopeKey]?.nodes),
          ...nextNodes,
        },
        ...(workspaceBounds ? { workspace: workspaceBounds } : {}),
      }
    : undefined;
  return {
    ...project,
    canvas: {
      ...project.canvas,
      nodes:
        scope?.kind === "sequence" || !scope
          ? {
              ...withoutBoundaryPositions(project.canvas?.nodes),
              ...nextNodes,
            }
          : project.canvas?.nodes,
      scopes: scopeKey
        ? {
            ...(project.canvas?.scopes ?? {}),
            [scopeKey]: {
              ...(project.canvas?.scopes?.[scopeKey] ?? {}),
              ...nextScopeState,
            },
          }
        : project.canvas?.scopes,
    },
  };
}

function projectEdgeWaypoints(
  project: BranchingProject,
  edgeId: string,
  scope = activeCanvasScope(project),
) {
  const scopeKey = scope ? canvasScopeKey(scope) : undefined;
  const scoped = scopeKey ? project.canvas?.scopes?.[scopeKey]?.edgeWaypoints : undefined;
  return scoped && Object.prototype.hasOwnProperty.call(scoped, edgeId)
    ? scoped[edgeId] ?? []
    : project.canvas?.edgeWaypoints?.[edgeId] ?? [];
}

function updateProjectEdgeWaypoints(
  project: BranchingProject,
  edgeId: string,
  waypoints: CanvasPoint[],
  scope = activeCanvasScope(project),
): BranchingProject {
  const scopeKey = scope ? canvasScopeKey(scope) : undefined;
  if (scopeKey) {
    const scopeState = project.canvas?.scopes?.[scopeKey];
    return {
      ...project,
      canvas: {
        ...project.canvas,
        scopes: {
          ...(project.canvas?.scopes ?? {}),
          [scopeKey]: {
            ...scopeState,
            edgeWaypoints: {
              ...(scopeState?.edgeWaypoints ?? {}),
              [edgeId]: waypoints,
            },
          },
        },
      },
    };
  }
  return {
    ...project,
    canvas: {
      ...project.canvas,
      edgeWaypoints: { ...(project.canvas?.edgeWaypoints ?? {}), [edgeId]: waypoints },
    },
  };
}

function updateCanvasNodePosition(
  project: BranchingProject,
  nodeId: string,
  position: CanvasPoint,
  scope = activeCanvasScope(project),
): BranchingProject {
  const scopeKey = scope ? canvasScopeKey(scope) : undefined;
  const nodePosition = {
    ...(scopeKey
      ? project.canvas?.scopes?.[scopeKey]?.nodes?.[nodeId]
      : project.canvas?.nodes?.[nodeId]),
    position,
  };

  if (scopeKey && scope?.kind !== "sequence") {
    return {
      ...project,
      canvas: {
        ...project.canvas,
        scopes: {
          ...(project.canvas?.scopes ?? {}),
          [scopeKey]: {
            ...(project.canvas?.scopes?.[scopeKey] ?? {}),
            nodes: {
              ...(project.canvas?.scopes?.[scopeKey]?.nodes ?? {}),
              [nodeId]: nodePosition,
            },
          },
        },
      },
    };
  }

  return {
    ...project,
    canvas: {
      ...project.canvas,
      nodes: {
        ...(project.canvas?.nodes ?? {}),
        [nodeId]: nodePosition,
      },
    },
  };
}

function updateCanvasNodeAuxiliaryPanel(
  project: BranchingProject,
  nodeId: string,
  panel: "directorNote" | "sceneImage" | "coverImage" | "description",
  open: boolean,
  scope = activeCanvasScope(project),
): BranchingProject {
  const scopeKey = scope ? canvasScopeKey(scope) : undefined;
  const currentNode = scopeKey && scope?.kind !== "sequence"
    ? project.canvas?.scopes?.[scopeKey]?.nodes?.[nodeId]
    : project.canvas?.nodes?.[nodeId];
  const nextNode = {
    ...currentNode,
    auxiliaryPanels: { ...currentNode?.auxiliaryPanels, [panel]: open },
  };
  if (scopeKey && scope?.kind !== "sequence") {
    return {
      ...project,
      canvas: {
        ...project.canvas,
        scopes: {
          ...(project.canvas?.scopes ?? {}),
          [scopeKey]: {
            ...(project.canvas?.scopes?.[scopeKey] ?? {}),
            nodes: { ...(project.canvas?.scopes?.[scopeKey]?.nodes ?? {}), [nodeId]: nextNode },
          },
        },
      },
    };
  }
  return {
    ...project,
    canvas: { ...project.canvas, nodes: { ...(project.canvas?.nodes ?? {}), [nodeId]: nextNode } },
  };
}

function positionMutationNode(
  result: mutations.MutationResult,
  position: CanvasPoint | undefined,
  scope: CanvasScope | undefined,
) {
  const nodeId = result.selection?.type === "node" ? result.selection.id : undefined;
  return nodeId && position
    ? { ...result, project: updateCanvasNodePosition(result.project, nodeId, position, scope) }
    : result;
}

type CanvasPoint = { x: number; y: number };

type ConnectedNarrativeNodeKind =
  | "decision"
  | "dialogue"
  | "speechBeat"
  | "directionBeat"
  | "dialogueStart"
  | "interaction";

type DialoguePresetSpeakerOption = {
  id: string;
  label: string;
  portraitUrl?: string;
  kind?: string;
  variants: Array<{ id: string; label: string; portraitUrl?: string }>;
  source?: "canon" | "local" | "published";
};

function localEntityIsSpeaker(project: BranchingProject, entity: LocalExplorerEntity) {
  const normalizedType = entity.type.replace(/^type:/i, "").trim().toLowerCase();
  return normalizedType === "character" || normalizedType === "speaker" ||
    propertyIsEntityPresentable(project, "local", `type:${normalizedType}`);
}

function recentDialoguePresets(
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  sourceNodeId: string,
  canonRefs: CanonRef[],
  speakerOptions: DialoguePresetSpeakerOption[],
): DialoguePreset[] {
  const incoming = new Map<string, string[]>();
  edges.forEach((edgeItem) => {
    const sources = incoming.get(edgeItem.target) ?? [];
    sources.push(edgeItem.source);
    incoming.set(edgeItem.target, sources);
  });

  // Walk backwards from the node whose connector is open. This keeps the
  // order authoring-relevant: the current line first, then connected lines
  // that lead into it, instead of relying on canvas coordinates.
  const orderedNodeIds: string[] = [];
  const visited = new Set<string>();
  const queue = [sourceNodeId];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    orderedNodeIds.push(nodeId);
    (incoming.get(nodeId) ?? []).forEach((sourceId) => {
      if (!visited.has(sourceId)) queue.push(sourceId);
    });
  }

  // If the source is a direction beat or the graph is only partially
  // connected, still offer the other speech beats already authored in this
  // space as a useful fallback.
  nodes.forEach((node) => {
    if (!visited.has(node.id)) orderedNodeIds.push(node.id);
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const presets: DialoguePreset[] = [];
  const seenPresets = new Set<string>();
  orderedNodeIds.forEach((nodeId) => {
    if (presets.length >= 3) return;
    const node = nodeById.get(nodeId);
    if (node?.data.kind !== "speechBeat") return;
    const block = node.data.details?.block as ScriptBlock | undefined;
    // An empty speaker reference is a recently used Narrator beat; the
    // explicit unknown-speaker reference is the recently used `???` option.
    const characterRef = block?.characterRef ?? block?.speakerRef;
    const speaker = characterRef ? speakerOptions.find((option) => option.id === characterRef) : undefined;
    const canonRef = characterRef ? canonRefs.find((ref) => ref.id === characterRef) : undefined;
    const characterVariantId = canonRef
      ? resolveCanonVariantId(canonRef, block?.characterVariantId)
      : "base";
    const presetKey = `${characterRef === UNKNOWN_SPEAKER_REF ? "unknown" : characterRef ?? "narrator"}:${characterVariantId}`;
    if (seenPresets.has(presetKey)) return;
    seenPresets.add(presetKey);
    const variant = speaker?.variants.find((option) => option.id === characterVariantId);
    presets.push({
      characterRef,
      characterVariantId,
      label: speaker?.label ?? speakerLabel(characterRef),
      variantLabel: variant?.label,
      portraitUrl: variant?.portraitUrl ?? speaker?.portraitUrl,
    });
  });
  return presets;
}

function snapCanvasPoint(
  point: CanvasPoint,
  snapToGrid: boolean,
  gridSize: number,
): CanvasPoint {
  if (!snapToGrid) return point;
  const size = Math.max(1, gridSize);
  return {
    x: Math.round(point.x / size) * size,
    y: Math.round(point.y / size) * size,
  };
}

function eventDepthsForSequence(project: BranchingProject, sequence: Sequence) {
  const depths = new Map<string, number>();
  const eventIds = new Set(sequence.eventIds);
  const queue: string[] = [];
  const entryId =
    sequence.entryEventId && eventIds.has(sequence.entryEventId)
      ? sequence.entryEventId
      : sequence.eventIds[0];
  if (entryId) {
    depths.set(entryId, 0);
    queue.push(entryId);
  }

  while (queue.length) {
    const eventId = queue.shift() as string;
    const depth = depths.get(eventId) ?? 0;
    const eventNode = findEvent(project, eventId);
    eventNode?.transitions?.forEach((transition) => {
      if (!eventIds.has(transition.to)) return;
      const nextDepth = depth + 1;
      if (!depths.has(transition.to)) {
        depths.set(transition.to, nextDepth);
        queue.push(transition.to);
      }
    });
  }

  sequence.eventIds.forEach((eventId, index) => {
    if (!depths.has(eventId)) {
      depths.set(eventId, index);
    }
  });

  return depths;
}

function canvasLayoutPositions(
  project: BranchingProject,
  mode: CanvasLayoutMode,
  snapToGrid: boolean,
  gridSize: number,
) {
  const sequenceId = activeSequenceId(project);
  const sequence = sequenceId ? findSequence(project, sequenceId) : undefined;
  if (!sequence) return {};

  const positions: Record<string, CanvasPoint> = {};
  const activeEvents = sequence.eventIds
    .map((eventId) => findEvent(project, eventId))
    .filter((eventNode): eventNode is EventNode => Boolean(eventNode));
  const point = (x: number, y: number) =>
    snapCanvasPoint({ x, y }, snapToGrid, gridSize);
  const startId = `start:${sequence.id}`;
  positions[startId] = point(80, 80);

  if (mode === "timeline") {
    activeEvents.forEach((eventNode, index) => {
      positions[eventNode.id] = point(360, 80 + index * 188);
    });
    return positions;
  }

  if (mode === "branches") {
    const branchIds = Array.from(
      new Set([
        ...(sequence.branchIds ?? []),
        ...activeEvents
          .map((eventNode) => eventNode.branchRef)
          .filter((branchId): branchId is string => Boolean(branchId)),
      ]),
    );
    const lanes = [...branchIds, "__unbranched__"];
    const laneCounts = new Map<string, number>();
    activeEvents.forEach((eventNode, sequenceIndex) => {
      const laneId =
        eventNode.branchRef && branchIds.includes(eventNode.branchRef)
          ? eventNode.branchRef
          : "__unbranched__";
      const laneIndex = lanes.indexOf(laneId);
      const indexInLane = laneCounts.get(laneId) ?? 0;
      laneCounts.set(laneId, indexInLane + 1);
      positions[eventNode.id] = point(
        360 + indexInLane * 292,
        80 + Math.max(0, laneIndex) * 190 + (sequenceIndex % 2) * 10,
      );
    });
    return positions;
  }

  const depths = eventDepthsForSequence(project, sequence);
  const depthCounts = new Map<number, number>();
  activeEvents
    .slice()
    .sort((left, right) => {
      const depthDelta =
        (depths.get(left.id) ?? 0) - (depths.get(right.id) ?? 0);
      if (depthDelta !== 0) return depthDelta;
      return (
        sequence.eventIds.indexOf(left.id) - sequence.eventIds.indexOf(right.id)
      );
    })
    .forEach((eventNode) => {
      const depth = depths.get(eventNode.id) ?? 0;
      const indexInDepth = depthCounts.get(depth) ?? 0;
      depthCounts.set(depth, indexInDepth + 1);
      positions[eventNode.id] = point(
        360 + depth * 292,
        80 + indexInDepth * 176,
      );
    });
  return positions;
}

function applyCanvasLayoutToProject(
  project: BranchingProject,
  mode: CanvasLayoutMode,
  options: { snapToGrid: boolean; gridSize: number },
): BranchingProject {
  const layoutPositions = canvasLayoutPositions(
    project,
    mode,
    options.snapToGrid,
    options.gridSize,
  );
  const nextNodes = {
    ...(project.canvas?.nodes ?? {}),
    ...Object.fromEntries(
      Object.entries(layoutPositions).map(([id, position]) => [
        id,
        {
          ...(project.canvas?.nodes?.[id] ?? {}),
          position,
        },
      ]),
    ),
  };
  return {
    ...project,
    canvas: {
      ...project.canvas,
      activeSequenceId: activeSequenceId(project),
      nodes: nextNodes,
    },
  };
}

function canonDisplay(project: BranchingProject, id: string) {
  const ref = project.canonRefs.find((canonRef) => canonRef.id === id);
  return ref ? `${ref.kind ?? "canon"} - ${ref.id}` : id;
}

function eventIdFromSelection(
  project: BranchingProject,
  nodes: StoryCanvasNode[],
  selection?: Selection,
): string | undefined {
  if (!selection) return undefined;
  if (selection.type === "node") {
    if (findEvent(project, selection.id)) return selection.id;
    const node = nodes.find((candidate) => candidate.id === selection.id);
    const ownerEventId =
      typeof node?.data.details?.eventId === "string"
        ? node.data.details.eventId
        : undefined;
    if (ownerEventId && findEvent(project, ownerEventId)) return ownerEventId;
  }
  if (selection.type === "file" && selection.id.startsWith("file:event:")) {
    const eventId = selection.id.slice("file:event:".length);
    return findEvent(project, eventId) ? eventId : undefined;
  }
  return undefined;
}

function ownerEventIdFromCanvasSelection(
  project: BranchingProject,
  selection: Selection,
) {
  if (selection.type !== "node") return undefined;
  if (findEvent(project, selection.id)) return selection.id;
  const prefixes = ["decision:", "outcome:", "dialogue:", "dialogue-boundary:", "beat:", "dialogue-start:", "boundary:", "route-gate:"];
  return project.events.find((event) =>
    prefixes.some((prefix) => selection.id.startsWith(`${prefix}${event.id}:`)),
  )?.id;
}

function canvasScopeForSelection(
  project: BranchingProject,
  selection: Selection,
  ownerEventId: string,
): CanvasScope | undefined {
  if (selection.type !== "node") return undefined;
  const event = findEvent(project, ownerEventId);
  if (!event) return undefined;

  if (selection.id.startsWith("dialogue-boundary:")) {
    const dialogue = event.dialogues?.find((candidate) =>
      selection.id.startsWith(`dialogue-boundary:${event.id}:${candidate.id}:`),
    );
    return dialogue ? { kind: "dialogue", id: dialogue.id, eventId: event.id } : undefined;
  }

  const decision = event.decisions?.find((candidate) =>
    selection.id === `decision:${event.id}:${candidate.id}` ||
    candidate.outcomes.some((outcome) => selection.id === `outcome:${event.id}:${candidate.id}:${outcome.id}`),
  );
  if (decision?.dialogueId) {
    return { kind: "dialogue", id: decision.dialogueId, eventId: event.id };
  }

  const dialogue = event.dialogues?.find((candidate) =>
    selection.id === `dialogue:${event.id}:${candidate.id}` ||
    candidate.beats?.some((beat) => selection.id === `beat:${event.id}:${beat.id}`),
  );
  if (dialogue && selection.id.startsWith("beat:")) {
    return { kind: "dialogue", id: dialogue.id, eventId: event.id };
  }

  if (
    selection.id.startsWith("decision:") ||
    selection.id.startsWith("outcome:") ||
    selection.id.startsWith("beat:") ||
    selection.id.startsWith("dialogue:") ||
    selection.id.startsWith("dialogue-start:")
  ) {
    return { kind: "event", id: event.id };
  }

  if (event.parentEventId) return { kind: "event", id: event.parentEventId };
  const sequenceId = project.sequences.find((sequence) => sequence.eventIds.includes(event.id))?.id;
  return sequenceId ? { kind: "sequence", id: sequenceId } : undefined;
}

function storyExplorerSelectionId(
  project: BranchingProject,
  selection?: Selection,
) {
  if (selection?.type === "file") return selection.id;
  if (selection?.type === "dataObject")
    return `file:data-object:${selection.id}`;
  if (selection?.type === "node") {
    if (project.sequences.some((sequence) => sequence.id === selection.id))
      return `file:sequence:${selection.id}`;
    if (project.branches.some((branch) => branch.id === selection.id))
      return `file:branch:${selection.id}`;
    if (project.events.some((event) => event.id === selection.id))
      return `file:event:${selection.id}`;
    if (/^(?:decision|outcome|dialogue|dialogue-boundary|beat|dialogue-start):/.test(selection.id))
      return `file:path:${selection.id}`;
  }
  return `file:sequence:${activeSequenceId(project) ?? ""}`;
}

function slugify(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function uniqueId(base: string, existingIds: Iterable<string>) {
  const existing = new Set(existingIds);
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function withoutValue(values: string[] | undefined, value: string) {
  return (values ?? []).filter((item) => item !== value);
}

function withValue(values: string[] | undefined, value: string) {
  return Array.from(new Set([...(values ?? []), value]));
}

function nodeStoryId(node: StoryCanvasNode | undefined) {
  return typeof node?.data.storyObjectId === "string"
    ? node.data.storyObjectId
    : node?.id;
}

function ownerEventIdForNode(node: StoryCanvasNode | undefined) {
  if (!node) {
    return undefined;
  }
  if (node.data.kind === "event") {
    return nodeStoryId(node);
  }
  return typeof node.data.details?.eventId === "string"
    ? node.data.details.eventId
    : undefined;
}

function transitionFrom(
  sourceId: string,
  targetId: string,
  existing: Transition[] | undefined,
) {
  const count =
    (existing ?? []).filter((transition) => transition.to === targetId).length +
    1;
  return uniqueId(
    `transition:${sourceId}:${targetId}:${count}`,
    (existing ?? []).map((transition) => transition.id),
  );
}

function isPointInside(node: StoryCanvasNode, x: number, y: number) {
  const width = Number(
    node.width ?? node.measured?.width ?? node.style?.width ?? 0,
  );
  const height = Number(
    node.height ?? node.measured?.height ?? node.style?.height ?? 0,
  );
  return (
    x >= node.position.x &&
    x <= node.position.x + width &&
    y >= node.position.y &&
    y <= node.position.y + height
  );
}

type CanvasRect = { x: number; y: number; width: number; height: number };
type NestedLayoutMode = "grid" | "linear";

const DEFAULT_CANVAS_NODE_SIZE = { width: 230, height: 126 };
const CANVAS_NODE_GAP = 24;

function canvasNodeSize(node: StoryCanvasNode): { width: number; height: number } {
  return {
    width: Number(node.width ?? node.measured?.width ?? node.style?.width ?? DEFAULT_CANVAS_NODE_SIZE.width),
    height: Number(node.height ?? node.measured?.height ?? node.style?.height ?? DEFAULT_CANVAS_NODE_SIZE.height),
  };
}

function isNestedLayoutMovableNode(node: StoryCanvasNode) {
  return !["workspace", "boundary", "endAdder"].includes(node.data.kind);
}

function canvasReadingOrder(left: StoryCanvasNode, right: StoryCanvasNode) {
  return left.position.y - right.position.y || left.position.x - right.position.x || left.id.localeCompare(right.id);
}

/**
 * Produces a stable narrative order for the subcanvas. The canvas positions
 * are only a fallback: authored transitions are the source of truth, so a
 * director beat reached from a speech beat always follows it in a grid pass.
 */
function narrativeGridOrder(nodes: StoryCanvasNode[], edges: StoryCanvasEdge[]) {
  const movable = nodes
    .filter((node) => !["workspace", "boundary", "endAdder"].includes(node.data.kind))
    .slice();
  const movableIds = new Set(movable.map((node) => node.id));
  const nodeById = new Map(movable.map((node) => [node.id, node]));
  const inboundCounts = new Map(movable.map((node) => [node.id, 0]));
  const outgoing = new Map<string, StoryCanvasEdge[]>();
  const entryTargets = new Set<string>();

  edges.forEach((edge) => {
    if (movableIds.has(edge.target) && !movableIds.has(edge.source)) {
      entryTargets.add(edge.target);
    }
    if (!movableIds.has(edge.source) || !movableIds.has(edge.target) || edge.source === edge.target) {
      return;
    }
    inboundCounts.set(edge.target, (inboundCounts.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  });

  const orderTargets = (left: StoryCanvasEdge, right: StoryCanvasEdge) => {
    const leftOrder = Number(left.data?.order ?? 0);
    const rightOrder = Number(right.data?.order ?? 0);
    const orderDifference = (Number.isFinite(leftOrder) ? leftOrder : 0) - (Number.isFinite(rightOrder) ? rightOrder : 0);
    if (orderDifference) return orderDifference;
    return canvasReadingOrder(nodeById.get(left.target)!, nodeById.get(right.target)!);
  };

  const compareReady = (leftId: string, rightId: string) => {
    const leftIsEntry = entryTargets.has(leftId);
    const rightIsEntry = entryTargets.has(rightId);
    if (leftIsEntry !== rightIsEntry) return leftIsEntry ? -1 : 1;
    return canvasReadingOrder(nodeById.get(leftId)!, nodeById.get(rightId)!);
  };
  const queue = movable
    .filter((node) => inboundCounts.get(node.id) === 0)
    .map((node) => node.id)
    .sort(compareReady);
  const orderedIds: string[] = [];
  const visited = new Set<string>();

  while (queue.length) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    orderedIds.push(currentId);
    const nextReady: string[] = [];
    [...(outgoing.get(currentId) ?? [])].sort(orderTargets).forEach((edge) => {
      const nextInboundCount = (inboundCounts.get(edge.target) ?? 1) - 1;
      inboundCounts.set(edge.target, nextInboundCount);
      if (nextInboundCount === 0) nextReady.push(edge.target);
    });
    // Keep a linear chain contiguous in the grid. Other roots and branches
    // remain queued after the active route, while still respecting all inputs.
    queue.unshift(...nextReady);
  }

  return [
    ...orderedIds.map((id) => nodeById.get(id)!),
    ...movable.filter((node) => !visited.has(node.id)).sort(canvasReadingOrder),
  ];
}

function nestedGridLayoutPositions(
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  columns: number,
  horizontalGapCells: number,
  verticalGapCells: number,
  gridSize: number,
  selectedNodeIds: string[] = [],
) {
  const selectedIds = new Set(selectedNodeIds);
  const movable = narrativeGridOrder(
    nodes.filter((node) => isNestedLayoutMovableNode(node) && (!selectedIds.size || selectedIds.has(node.id))),
    edges,
  );
  if (!movable.length) return new Map<string, CanvasPoint>();

  const safeColumns = Math.max(1, Math.round(columns));
  const safeGrid = Math.max(1, gridSize);
  const horizontalGap = Math.max(0, horizontalGapCells) * safeGrid;
  const verticalGap = Math.max(0, verticalGapCells) * safeGrid;
  const rowCount = Math.ceil(movable.length / safeColumns);
  const columnWidths = Array.from({ length: Math.min(safeColumns, movable.length) }, () => 0);
  const rowHeights = Array.from({ length: rowCount }, () => 0);
  movable.forEach((node, index) => {
    const size = canvasNodeSize(node);
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    columnWidths[column] = Math.max(columnWidths[column], size.width);
    rowHeights[row] = Math.max(rowHeights[row], size.height);
  });
  const workspace = nodes.find((node) => node.data.kind === "workspace");
  const minX = Math.min(...movable.map((node) => node.position.x));
  const minY = Math.min(...movable.map((node) => node.position.y));
  const originX = workspace ? workspace.position.x + safeGrid * 2 : minX;
  const originY = workspace ? workspace.position.y + safeGrid * 2 : minY;
  const columnOffsets = columnWidths.reduce<number[]>((offsets, width, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + columnWidths[index - 1] + horizontalGap);
    return offsets;
  }, []);
  const rowOffsets = rowHeights.reduce<number[]>((offsets, height, index) => {
    offsets.push(index === 0 ? 0 : offsets[index - 1] + rowHeights[index - 1] + verticalGap);
    return offsets;
  }, []);
  return new Map(movable.map((node, index) => {
    const column = index % safeColumns;
    const row = Math.floor(index / safeColumns);
    const size = canvasNodeSize(node);
    // Speech beats define the visual rhythm of a row. A direction beat is
    // deliberately shorter, so center it against that rhythm instead of
    // leaving its top edge aligned with the speech card.
    const directionBeatOffset = node.data.kind === "directionBeat"
      ? Math.max(0, (rowHeights[row] - size.height) / 2)
      : 0;
    return [node.id, snapCanvasPoint({
      x: originX + columnOffsets[column],
      y: originY + rowOffsets[row] + directionBeatOffset,
    }, true, safeGrid)];
  }));
}

function nestedLinearLayoutPositions(
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  horizontalGapCells: number,
  gridSize: number,
  selectedNodeIds: string[] = [],
) {
  const selectedIds = new Set(selectedNodeIds);
  const movable = narrativeGridOrder(
    nodes.filter((node) => isNestedLayoutMovableNode(node) && (!selectedIds.size || selectedIds.has(node.id))),
    edges,
  );
  if (!movable.length) return new Map<string, CanvasPoint>();

  const safeGrid = Math.max(1, gridSize);
  const horizontalGap = Math.max(0, horizontalGapCells) * safeGrid;
  const workspace = nodes.find((node) => node.data.kind === "workspace");
  const minX = Math.min(...movable.map((node) => node.position.x));
  const minY = Math.min(...movable.map((node) => node.position.y));
  const originX = workspace ? workspace.position.x + safeGrid * 2 : minX;
  const originY = workspace ? workspace.position.y + safeGrid * 2 : minY;
  const lineHeight = Math.max(...movable.map((node) => canvasNodeSize(node).height));
  let cursorX = originX;

  return new Map(movable.map((node) => {
    const size = canvasNodeSize(node);
    const directionBeatOffset = node.data.kind === "directionBeat"
      ? Math.max(0, (lineHeight - size.height) / 2)
      : 0;
    const position = snapCanvasPoint({ x: cursorX, y: originY + directionBeatOffset }, true, safeGrid);
    cursorX += size.width + horizontalGap;
    return [node.id, position];
  }));
}

function canvasNodeSizeForKind(kind: StoryCanvasNodeData["kind"]) {
  switch (kind) {
    case "branch":
      return { width: 390, height: 190 };
    case "decision":
      return { width: 230, height: 170 };
    case "speechBeat":
      return { width: 360, height: SPEECH_BEAT_NODE_HEIGHT };
    case "directionBeat":
      return { width: 360, height: DIRECTION_BEAT_NODE_HEIGHT };
    case "dialogue":
      return { width: 230, height: 150 };
    case "dialogueStart":
      return { width: 210, height: 88 };
    default:
      return DEFAULT_CANVAS_NODE_SIZE;
  }
}

type CanvasClipboardKind =
  | "event"
  | "branch"
  | "decision"
  | "dialogue"
  | "dialogueStart"
  | "speechBeat"
  | "directionBeat"
  | "outcome";

type CanvasClipboardItem = {
  kind: CanvasClipboardKind;
  nodeId: string;
  position: { x: number; y: number };
  value: unknown;
  block?: unknown;
  eventId?: string;
  dialogueId?: string;
  decisionId?: string;
};

type CanvasClipboard = {
  scopeKey?: string;
  items: CanvasClipboardItem[];
};

function cloneCanvasValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rectanglesOverlap(left: CanvasRect, right: CanvasRect, gap = 0) {
  return (
    left.x < right.x + right.width + gap &&
    left.x + left.width + gap > right.x &&
    left.y < right.y + right.height + gap &&
    left.y + left.height + gap > right.y
  );
}

function nearestFreeCanvasPosition(
  nodes: StoryCanvasNode[],
  requested: CanvasPoint,
  size: { width: number; height: number },
  options: { snapToGrid: boolean; gridSize: number; constrainToWorkspace: boolean },
) {
  const workspace = nodes.find((node) => node.data.kind === "workspace");
  const workspaceSize = workspace ? canvasNodeSize(workspace) : undefined;
  const workspaceBounds = options.constrainToWorkspace && workspace && workspaceSize
    ? {
        x: workspace.position.x + CANVAS_NODE_GAP,
        y: workspace.position.y + CANVAS_NODE_GAP,
        width: Math.max(0, workspaceSize.width - CANVAS_NODE_GAP * 2),
        height: Math.max(0, workspaceSize.height - CANVAS_NODE_GAP * 2),
      }
    : undefined;
  const obstacles = nodes
    .filter((node) => node.data.kind !== "workspace" && !node.data.isContainer)
    .map((node) => ({
      x: node.position.x,
      y: node.position.y,
      ...canvasNodeSize(node),
    }));
  const step = Math.max(24, options.snapToGrid ? options.gridSize : 32);
  const candidate = (x: number, y: number): CanvasRect => ({
    x,
    y,
    width: size.width,
    height: size.height,
  });
  const fitsWorkspace = (rect: CanvasRect) =>
    !workspaceBounds || (
      rect.x >= workspaceBounds.x &&
      rect.y >= workspaceBounds.y &&
      rect.x + rect.width <= workspaceBounds.x + workspaceBounds.width &&
      rect.y + rect.height <= workspaceBounds.y + workspaceBounds.height
    );
  const isFree = (rect: CanvasRect) =>
    fitsWorkspace(rect) && !obstacles.some((obstacle) => rectanglesOverlap(rect, obstacle, CANVAS_NODE_GAP));

  const candidates: CanvasRect[] = [];
  for (let radius = 0; radius <= 80; radius += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        if (radius > 0 && Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        candidates.push(candidate(requested.x + offsetX * step, requested.y + offsetY * step));
      }
    }
    const free = candidates.filter(isFree);
    if (free.length > 0) {
      free.sort((left, right) => {
        const leftDistance = (left.x - requested.x) ** 2 + (left.y - requested.y) ** 2;
        const rightDistance = (right.x - requested.x) ** 2 + (right.y - requested.y) ** 2;
        return leftDistance - rightDistance;
      });
      return { x: free[0].x, y: free[0].y };
    }
  }

  return requested;
}

function visibleCanvasFlowBounds(reactFlowInstance: ReactFlowInstance<any, any>) {
  const flowElement = document.querySelector<HTMLElement>(".react-flow");
  if (!flowElement) return undefined;
  const rect = flowElement.getBoundingClientRect();
  const viewport = reactFlowInstance.getViewport();
  if (!viewport.zoom || !rect.width || !rect.height) return undefined;
  return {
    elementWidth: rect.width,
    elementHeight: rect.height,
    left: -viewport.x / viewport.zoom,
    top: -viewport.y / viewport.zoom,
    right: (rect.width - viewport.x) / viewport.zoom,
    bottom: (rect.height - viewport.y) / viewport.zoom,
    viewport,
  };
}

function availableCanvasCenterOffset(
  shell: HTMLElement | null,
  zoom: number,
) {
  const flowElement = shell?.querySelector<HTMLElement>(".pb-canvas-stage .react-flow");
  if (!flowElement || !zoom) return { x: 0, y: 0 };
  const canvas = flowElement.getBoundingClientRect();
  if (!canvas.width || !canvas.height) return { x: 0, y: 0 };

  // In canvas focus mode the inspector intentionally covers almost the entire
  // canvas, so there is no useful uncovered region to center into.
  const inspector = shell?.classList.contains("context-focus")
    ? null
    : shell?.querySelector<HTMLElement>(".pb-context-surface:not([hidden])");
  if (!inspector || getComputedStyle(inspector).display === "none") {
    return { x: 0, y: 0 };
  }

  const dock = inspector.getBoundingClientRect();
  const blocked = {
    left: Math.max(canvas.left, dock.left),
    top: Math.max(canvas.top, dock.top),
    right: Math.min(canvas.right, dock.right),
    bottom: Math.min(canvas.bottom, dock.bottom),
  };
  if (blocked.right <= blocked.left || blocked.bottom <= blocked.top) {
    return { x: 0, y: 0 };
  }

  const candidates = [
    { left: canvas.left, top: canvas.top, right: canvas.right, bottom: blocked.top },
    { left: canvas.left, top: blocked.bottom, right: canvas.right, bottom: canvas.bottom },
    { left: canvas.left, top: blocked.top, right: blocked.left, bottom: blocked.bottom },
    { left: blocked.right, top: blocked.top, right: canvas.right, bottom: blocked.bottom },
  ].filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  if (candidates.length === 0) return { x: 0, y: 0 };

  const available = candidates.reduce((largest, rect) =>
    (rect.right - rect.left) * (rect.bottom - rect.top) >
      (largest.right - largest.left) * (largest.bottom - largest.top)
      ? rect
      : largest,
  );
  const canvasCenter = { x: (canvas.left + canvas.right) / 2, y: (canvas.top + canvas.bottom) / 2 };
  const availableCenter = { x: (available.left + available.right) / 2, y: (available.top + available.bottom) / 2 };
  return {
    x: (canvasCenter.x - availableCenter.x) / zoom,
    y: (canvasCenter.y - availableCenter.y) / zoom,
  };
}

function centerCanvasOnNode(
  instance: ReactFlowInstance<any, any>,
  shell: HTMLElement | null,
  node: StoryCanvasNode,
  options: { duration?: number; zoom?: number } = {},
) {
  const zoom = options.zoom ?? instance.getViewport().zoom;
  const offset = availableCanvasCenterOffset(shell, zoom);
  const size = canvasNodeSize(node);
  instance.setCenter(
    node.position.x + size.width / 2 + offset.x,
    node.position.y + size.height / 2 + offset.y,
    { duration: options.duration ?? 220, zoom },
  );
}

function locateCanvasNode(
  instance: ReactFlowInstance<any, any>,
  shell: HTMLElement | null,
  node: StoryCanvasNode,
  enteredScope = false,
) {
  const viewport = instance.getViewport();
  const canvas = shell?.querySelector<HTMLElement>(".pb-canvas-stage .react-flow")?.getBoundingClientRect();
  const size = canvasNodeSize(node);
  const offset = availableCanvasCenterOffset(shell, viewport.zoom);
  const centered = canvas && Math.hypot(
    (node.position.x + size.width / 2 + offset.x) * viewport.zoom + viewport.x - canvas.width / 2,
    (node.position.y + size.height / 2 + offset.y) * viewport.zoom + viewport.y - canvas.height / 2,
  ) <= 40;
  const closeZoom = 1.15;
  const wideZoom = 0.8;
  const zoom = !enteredScope && centered && viewport.zoom >= (closeZoom + wideZoom) / 2
    ? wideZoom
    : closeZoom;
  centerCanvasOnNode(instance, shell, node, { zoom });
}

function ensureCanvasNodeVisible(
  reactFlowInstance: ReactFlowInstance<any, any>,
  node: StoryCanvasNode,
) {
  const bounds = visibleCanvasFlowBounds(reactFlowInstance);
  if (!bounds) return;
  const size = canvasNodeSize(node);
  const nodeBounds: CanvasRect = {
    x: node.position.x,
    y: node.position.y,
    width: size.width,
    height: size.height,
  };
  const flowPadding = 32;
  if (
    nodeBounds.x >= bounds.left + flowPadding &&
    nodeBounds.y >= bounds.top + flowPadding &&
    nodeBounds.x + nodeBounds.width <= bounds.right - flowPadding &&
    nodeBounds.y + nodeBounds.height <= bounds.bottom - flowPadding
  ) {
    return;
  }

  const union = {
    left: Math.min(bounds.left, nodeBounds.x),
    top: Math.min(bounds.top, nodeBounds.y),
    right: Math.max(bounds.right, nodeBounds.x + nodeBounds.width),
    bottom: Math.max(bounds.bottom, nodeBounds.y + nodeBounds.height),
  };
  const unionWidth = union.right - union.left + flowPadding * 2;
  const unionHeight = union.bottom - union.top + flowPadding * 2;
  const nextZoom = Math.min(
    bounds.viewport.zoom,
    bounds.elementWidth / unionWidth,
    bounds.elementHeight / unionHeight,
  );
  const zoom = Math.max(0.05, nextZoom);
  const centerX = (union.left + union.right) / 2;
  const centerY = (union.top + union.bottom) / 2;
  reactFlowInstance.setViewport(
    {
      x: bounds.elementWidth / 2 - centerX * zoom,
      y: bounds.elementHeight / 2 - centerY * zoom,
      zoom,
    },
    { duration: 0 },
  );
}

function canvasGraph(
  nodes: StoryCanvasNode[],
  edges: StoryCanvasEdge[],
  mode: CanvasMode,
  focusNodeId: string | undefined,
) {
  if (mode === "branching") {
    const visibleKinds = new Set<StoryCanvasNodeData["kind"]>([
      "sequence",
      "start",
      "branch",
      "event",
    ]);
    const visibleEdgeKinds = new Set<StoryCanvasEdgeData["kind"]>([
      "entry",
      "transition",
    ]);
    const visibleNodes = nodes.filter((node) =>
      visibleKinds.has(node.data.kind),
    );
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    return {
      nodes: visibleNodes,
      edges: edges.filter((edgeItem) => {
        const kind = edgeItem.data?.kind;
        return Boolean(
          kind &&
          visibleEdgeKinds.has(kind) &&
          visibleIds.has(edgeItem.source) &&
          visibleIds.has(edgeItem.target),
        );
      }),
    };
  }

  if (!focusNodeId || !nodes.some((node) => node.id === focusNodeId)) {
    return { nodes, edges };
  }

  const adjacentIds = new Set<string>();
  edges.forEach((edgeItem) => {
    if (edgeItem.source === focusNodeId) adjacentIds.add(edgeItem.target);
    if (edgeItem.target === focusNodeId) adjacentIds.add(edgeItem.source);
  });

  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        focusState:
          node.id === focusNodeId
            ? "focused"
            : adjacentIds.has(node.id)
              ? "adjacent"
              : "dimmed",
      },
    })),
    edges: edges.map((edgeItem) => {
      const direct =
        edgeItem.source === focusNodeId || edgeItem.target === focusNodeId;
      return {
        ...edgeItem,
        animated: direct || edgeItem.animated,
        style: {
          ...edgeItem.style,
          opacity: direct ? 1 : 0.22,
        },
      };
    }),
  };
}

function canvasBreadcrumb(
  project: BranchingProject,
  scope: CanvasScope | undefined,
): Array<{ scope: CanvasScope; label: string }> {
  const sequenceScope = rootSequenceScope(project);
  const sequence = sequenceScope
    ? findSequence(project, sequenceScope.id)
    : undefined;
  const crumbs: Array<{ scope: CanvasScope; label: string }> = sequenceScope
    ? [{ scope: sequenceScope, label: sequence?.name ?? "Sequence" }]
    : [];
  if (scope?.kind !== "event" && scope?.kind !== "dialogue") {
    return crumbs;
  }

  const eventChain: EventNode[] = [];
  let cursor = findEvent(project, scope.kind === "dialogue" ? scope.eventId : scope.id);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    eventChain.unshift(cursor);
    cursor = cursor.parentEventId
      ? findEvent(project, cursor.parentEventId)
      : undefined;
  }

  eventChain.forEach((eventNode) => {
    crumbs.push({
      scope: { kind: "event", id: eventNode.id },
      label: eventNode.name,
    });
  });
  if (scope.kind === "dialogue") {
    const owner = findEvent(project, scope.eventId);
    const dialogue = owner?.dialogues?.find((item) => item.id === scope.id);
    crumbs.push({ scope, label: dialogue?.title ?? "Conversation" });
  }
  return crumbs;
}

function CanvasBreadcrumbScroller({ children, ariaLabel, es }: { children: ReactNode; ariaLabel: string; es: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<-1 | 0 | 1>(0);
  const frameRef = useRef<number | undefined>(undefined);
  const overflowRef = useRef({ left: false, right: false });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncOverflow = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const left = viewport.scrollLeft > 1;
    const right = viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1;
    if (overflowRef.current.left !== left) {
      overflowRef.current.left = left;
      setCanScrollLeft(left);
    }
    if (overflowRef.current.right !== right) {
      overflowRef.current.right = right;
      setCanScrollRight(right);
    }
  }, []);

  const stopEdgeScroll = useCallback(() => {
    directionRef.current = 0;
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    frameRef.current = undefined;
  }, []);

  const startEdgeScroll = useCallback(() => {
    if (frameRef.current !== undefined) return;
    let previousTime = 0;
    const step = (time: number) => {
      const viewport = viewportRef.current;
      const direction = directionRef.current;
      if (!viewport || direction === 0) {
        frameRef.current = undefined;
        return;
      }
      const elapsed = previousTime === 0 ? 16 : Math.min(time - previousTime, 32);
      previousTime = time;
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const nextScroll = Math.max(0, Math.min(maxScroll, viewport.scrollLeft + direction * elapsed * 0.55));
      viewport.scrollLeft = nextScroll;
      syncOverflow();
      if (nextScroll <= 0 && direction < 0 || nextScroll >= maxScroll && direction > 0) {
        frameRef.current = undefined;
        return;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [syncOverflow]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    syncOverflow();
    let frame: number | undefined;
    const scheduleSyncOverflow = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        syncOverflow();
      });
    };
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleSyncOverflow);
    observer?.observe(viewport);
    if (viewport.firstElementChild) observer?.observe(viewport.firstElementChild);
    return () => {
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [children, syncOverflow]);

  useEffect(() => stopEdgeScroll, [stopEdgeScroll]);

  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const edgeWidth = Math.min(34, bounds.width * 0.2);
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    const nextDirection: -1 | 0 | 1 = event.clientX < bounds.left + edgeWidth && viewport.scrollLeft > 1
      ? -1
      : event.clientX > bounds.right - edgeWidth && viewport.scrollLeft < maxScroll - 1
        ? 1
        : 0;
    directionRef.current = nextDirection;
    if (nextDirection) startEdgeScroll();
    else stopEdgeScroll();
  };

  const scrollByPage = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({ left: direction * Math.max(140, viewport.clientWidth * 0.72), behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="canvas-breadcrumb-scroller" onPointerMove={trackPointer} onPointerLeave={stopEdgeScroll}>
      <div className="canvas-breadcrumb-viewport" ref={viewportRef} onScroll={syncOverflow}>
        <div className="canvas-breadcrumb" aria-label={ariaLabel}>{children}</div>
      </div>
      {canScrollLeft ? <button type="button" className="canvas-breadcrumb-edge left" aria-label={es ? "Ver elementos anteriores de la ruta" : "Show previous path items"} title={es ? "Elementos anteriores" : "Previous path items"} onPointerDown={event => event.stopPropagation()} onClick={() => scrollByPage(-1)}><ChevronLeft size={16} aria-hidden="true" /></button> : null}
      {canScrollRight ? <button type="button" className="canvas-breadcrumb-edge right" aria-label={es ? "Ver elementos siguientes de la ruta" : "Show next path items"} title={es ? "Elementos siguientes" : "Next path items"} onPointerDown={event => event.stopPropagation()} onClick={() => scrollByPage(1)}><ChevronRight size={16} aria-hidden="true" /></button> : null}
    </div>
  );
}

function fieldSummary(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function coerceDataFieldValue(type: string, value: string) {
  if (type === "number") {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }
  if (type === "boolean") {
    return value === "true";
  }
  if (
    type === "multiSelect" ||
    type === "canonRefList" ||
    type === "dataRefList"
  ) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

function conditionSummary(input: ConditionInput | undefined) {
  const labels = conditionLabels(input);
  if (labels.length === 0) {
    return "No conditions.";
  }
  return labels.join(", ");
}

function consequenceSummary(consequences: Consequence[] | undefined) {
  if (!consequences?.length) {
  return "No state changes.";
  }
  return consequences.map(consequenceLabel).join(", ");
}

function LogicSection({
  title,
  availability,
  consequences,
}: {
  title?: string;
  availability?: ConditionInput;
  consequences?: Consequence[];
}) {
  const availabilityCount = conditionCount(availability);

  return (
    <section className="inspector-section">
      <h2>{title ?? "Logic"}</h2>
      <div className="logic-grid">
        <div className="mini-card">
          <strong>Conditions</strong>
          <span>
            {availabilityCount > 0
              ? conditionSummary(availability)
              : "No conditions (always valid)."}
          </span>
        </div>
        <div className="mini-card">
          <strong>State changes</strong>
          <span>{consequenceSummary(consequences)}</span>
        </div>
      </div>
    </section>
  );
}

function firstSimpleCondition(
  input: ConditionInput | undefined,
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  const expression = Array.isArray(input) ? input[0] : input;
  if ("all" in expression || "any" in expression || "not" in expression) {
    return undefined;
  }
  return expression;
}

function firstConditionSetChild(
  input: ConditionInput | undefined,
): ConditionInput | undefined {
  if (!input) {
    return undefined;
  }
  const expression = Array.isArray(input) ? input[0] : input;
  if (!isConditionSet(expression)) {
    return undefined;
  }
  if ("all" in expression) {
    return expression.all[0];
  }
  if ("any" in expression) {
    return expression.any[0];
  }
  if ("not" in expression) {
    return expression.not;
  }
  return undefined;
}

function conditionInputKind(input: ConditionInput | undefined) {
  if (!input) {
    return "none";
  }
  const expression = Array.isArray(input) ? input[0] : input;
  if ("all" in expression) {
    return "all";
  }
  if ("any" in expression) {
    return "any";
  }
  if ("not" in expression) {
    return "not";
  }
  return typeof expression.type === "string" ? expression.type : "none";
}

function defaultCanonCondition(canonRefs: string[]) {
  return { type: "canonEntryUnlocked" as const, ref: canonRefs[0] ?? "" };
}

function LegacyBasicConditionEditor({
  label = "Conditions",
  value,
  canonRefs,
  dataObjects,
  grantableOptions,
  onChange,
  compact = false,
}: {
  label?: string;
  value?: ConditionInput;
  canonRefs: string[];
  dataObjects: ProjectDataObject[];
  grantableOptions: GrantableEntityOption[];
  onChange: (value: ConditionInput | undefined) => void;
  /** Renders as a lightweight sub-block instead of a full inspector section — for embedding inside compact cards like the Conditions route list. */
  compact?: boolean;
}) {
  const condition = firstSimpleCondition(value);
  const type = conditionInputKind(value);
  const Wrapper = compact ? "div" : "section";
  const Heading = compact ? "h3" : "h2";

  return (
    <Wrapper className={compact ? "condition-editor-compact" : "inspector-section"}>
      <Heading>{label}</Heading>
      <label className="field-label">
        Condition Type
        <select
          value={type}
          onChange={(event) => {
            const nextType = event.target.value;
            if (nextType === "none") {
              onChange(undefined);
            } else if (nextType === "canonEntryUnlocked") {
              onChange({ type: "canonEntryUnlocked", ref: canonRefs[0] ?? "" });
            } else if (nextType === "variable") {
              onChange({
                type: "variable",
                name: "flag",
                operator: "==",
                value: true,
              });
            } else if (nextType === "canonProperty") {
              onChange({
                type: "canonProperty",
                ref: canonRefs[0] ?? "",
                property: "affiliation",
                operator: "==",
                value: "",
              });
            } else if (nextType === "canonState") {
              onChange({
                type: "canonState",
                ref: canonRefs[0] ?? "",
                state: "known",
                operator: "==",
                value: true,
              });
            } else if (nextType === "dataObjectExists") {
              onChange({
                type: "dataObjectExists",
                objectId: dataObjects[0]?.id ?? "",
              });
            } else if (nextType === "runtimeItem") {
              onChange({
                type: "runtimeItem",
                itemId: grantableOptions[0]?.id ?? "",
                operator: "has",
              });
            } else if (nextType === "visited") {
              onChange({ type: "visited", targetType: "event", targetId: "" });
            } else if (nextType === "all") {
              onChange({ all: [defaultCanonCondition(canonRefs)] });
            } else if (nextType === "any") {
              onChange({ any: [defaultCanonCondition(canonRefs)] });
            } else if (nextType === "not") {
              onChange({ not: defaultCanonCondition(canonRefs) });
            }
          }}
        >
          <option value="none">always available</option>
          <option value="canonEntryUnlocked">canon unlocked</option>
          <option value="canonProperty">canon property</option>
          <option value="canonState">canon runtime state</option>
          <option value="variable">variable check</option>
          <option value="dataObjectExists">data object exists</option>
          <option value="runtimeItem">has grantable item</option>
          <option value="visited">visited target</option>
          <option value="all">all condition set</option>
          <option value="any">any condition set</option>
          <option value="not">not condition set</option>
        </select>
      </label>

      {type === "all" || type === "any" || type === "not" ? (
        <div className="mini-card">
          <strong>{type.toUpperCase()}</strong>
          <span>
            {type === "not"
              ? "Negates the child condition."
              : `Evaluates the child condition as part of a ${type} set.`}
          </span>
          <LegacyBasicConditionEditor
            label="Child Condition"
            value={firstConditionSetChild(value)}
            canonRefs={canonRefs}
            dataObjects={dataObjects}
            grantableOptions={grantableOptions}
            onChange={(child) => {
              const nextChild = child ?? defaultCanonCondition(canonRefs);
              if (type === "all") {
                onChange({
                  all: Array.isArray(nextChild) ? nextChild : [nextChild],
                });
              } else if (type === "any") {
                onChange({
                  any: Array.isArray(nextChild) ? nextChild : [nextChild],
                });
              } else {
                onChange({
                  not: Array.isArray(nextChild)
                    ? (nextChild[0] ?? defaultCanonCondition(canonRefs))
                    : nextChild,
                });
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (type === "all") {
                onChange({ all: [defaultCanonCondition(canonRefs)] });
              } else if (type === "any") {
                onChange({ any: [defaultCanonCondition(canonRefs)] });
              } else {
                onChange({ not: defaultCanonCondition(canonRefs) });
              }
            }}
          >
            Seed with canon condition
          </button>
        </div>
      ) : null}

      {type === "canonEntryUnlocked" ? (
        <label className="field-label">
          Canon Ref
          <select
            value={String(condition?.ref ?? "")}
            onChange={(event) =>
              onChange({ type: "canonEntryUnlocked", ref: event.target.value })
            }
          >
            <option value="">missing ref</option>
            {canonRefs.map((ref) => (
              <option key={ref} value={ref}>
                {ref}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {type === "canonProperty" ? (
        <div className="logic-grid">
          <label className="field-label">
            Canon Ref
            <select
              value={String(condition?.ref ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonProperty",
                  ref: event.target.value,
                  property: String(condition?.property ?? "affiliation"),
                  operator: "==",
                  value: condition?.value ?? "",
                })
              }
            >
              <option value="">missing ref</option>
              {canonRefs.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
            </select>
          </label>
          <label className="field-label">
            Property
            <input
              value={String(condition?.property ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonProperty",
                  ref: String(condition?.ref ?? ""),
                  property: event.target.value,
                  operator: "==",
                  value: condition?.value ?? "",
                })
              }
            />
          </label>
          <label className="field-label">
            Value
            <input
              value={String(condition?.value ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonProperty",
                  ref: String(condition?.ref ?? ""),
                  property: String(condition?.property ?? "affiliation"),
                  operator: "==",
                  value: event.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}

      {type === "canonState" ? (
        <div className="logic-grid">
          <label className="field-label">
            Canon Ref
            <select
              value={String(condition?.ref ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonState",
                  ref: event.target.value,
                  state: String(condition?.state ?? "known"),
                  operator: "==",
                  value: condition?.value ?? true,
                })
              }
            >
              <option value="">missing ref</option>
              {canonRefs.map((ref) => <option key={ref} value={ref}>{ref}</option>)}
            </select>
          </label>
          <label className="field-label">
            State
            <input
              value={String(condition?.state ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonState",
                  ref: String(condition?.ref ?? ""),
                  state: event.target.value,
                  operator: "==",
                  value: condition?.value ?? true,
                })
              }
            />
          </label>
          <label className="field-label">
            Value
            <input
              value={String(condition?.value ?? "")}
              onChange={(event) =>
                onChange({
                  type: "canonState",
                  ref: String(condition?.ref ?? ""),
                  state: String(condition?.state ?? "known"),
                  operator: "==",
                  value: event.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}

      {type === "variable" ? (
        <div className="logic-grid">
          <label className="field-label">
            Variable
            <input
              value={String(condition?.name ?? "")}
              onChange={(event) =>
                onChange({
                  type: "variable",
                  name: event.target.value,
                  operator: "==",
                  value: condition?.value ?? true,
                })
              }
            />
          </label>
          <label className="field-label">
            Value
            <input
              value={String(condition?.value ?? "")}
              onChange={(event) =>
                onChange({
                  type: "variable",
                  name: String(condition?.name ?? "flag"),
                  operator: "==",
                  value: event.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}

      {type === "dataObjectExists" ? (
        <label className="field-label">
          Data Object
          <select
            value={String(condition?.objectId ?? "")}
            onChange={(event) =>
              onChange({
                type: "dataObjectExists",
                objectId: event.target.value,
              })
            }
          >
            <option value="">missing object</option>
            {dataObjects.map((dataObject) => (
              <option key={dataObject.id} value={dataObject.id}>
                {dataObject.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {type === "runtimeItem" ? (
        <div className="logic-grid">
          <label className="field-label">
            Grantable entity
            <select
              value={String(condition?.itemId ?? "")}
              onChange={(event) =>
                onChange({
                  type: "runtimeItem",
                  itemId: event.target.value,
                  operator: (condition?.operator as "has" | "missing" | undefined) ?? "has",
                })
              }
            >
              <option value="">missing entity</option>
              {grantableOptions.map((option) => (
                <option key={`${option.source}:${option.id}`} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Operator
            <select
              value={String(condition?.operator ?? "has")}
              onChange={(event) =>
                onChange({
                  type: "runtimeItem",
                  itemId: String(condition?.itemId ?? ""),
                  operator: event.target.value as "has" | "missing",
                })
              }
            >
              <option value="has">has</option>
              <option value="missing">missing</option>
            </select>
          </label>
        </div>
      ) : null}

      {type === "visited" ? (
        <div className="logic-grid">
          <label className="field-label">
            Target Type
            <select
              value={String(condition?.targetType ?? "event")}
              onChange={(event) =>
                onChange({
                  type: "visited",
                  targetType: event.target.value as
                    "sequence" | "branch" | "event" | "decision" | "outcome",
                  targetId: String(condition?.targetId ?? ""),
                })
              }
            >
              <option value="sequence">sequence</option>
              <option value="branch">branch</option>
              <option value="event">event</option>
              <option value="decision">decision</option>
              <option value="outcome">outcome</option>
            </select>
          </label>
          <label className="field-label">
            Target ID
            <input
              value={String(condition?.targetId ?? "")}
              onChange={(event) =>
                onChange({
                  type: "visited",
                  targetType:
                    (condition?.targetType as
                      | "sequence"
                      | "branch"
                      | "event"
                      | "decision"
                      | "outcome") ?? "event",
                  targetId: event.target.value,
                })
              }
            />
          </label>
        </div>
      ) : null}
    </Wrapper>
  );
}

function BasicConditionEditor({
  project,
  label = "WHEN",
  value,
  onChange,
  compact = false,
  contextEntityIds,
  context,
}: {
  project: BranchingProject;
  label?: string;
  value?: ConditionInput;
  canonRefs: string[];
  dataObjects: ProjectDataObject[];
  grantableOptions: GrantableEntityOption[];
  onChange: (value: ConditionInput | undefined) => void;
  compact?: boolean;
  contextEntityIds?: string[];
  context?: ConditionAuthoringContext;
}) {
  return <LogicConditionEditor project={project} draftId={context?.nodeId} context={context} label={label} value={value} onChange={onChange} compact={compact} contextEntityIds={contextEntityIds} />;
}

function TransitionConditionEditor({
  project,
  value,
  canonRefs,
  dataObjects,
  grantableOptions,
  onChange,
  context,
}: {
  project: BranchingProject;
  value?: ConditionInput;
  canonRefs: string[];
  dataObjects: ProjectDataObject[];
  grantableOptions: GrantableEntityOption[];
  onChange: (value: ConditionInput | undefined) => void;
  context?: ConditionAuthoringContext;
}) {
  return (
    <BasicConditionEditor
      project={project}
      context={context}
      label="If"
      value={value}
      canonRefs={canonRefs}
      dataObjects={dataObjects}
      grantableOptions={grantableOptions}
      onChange={onChange}
    />
  );
}

function InspectorContentTabs({
  project, selection,
  value,
  tabs,
  onChange,
}: {
  project?: BranchingProject;
  selection?: Selection;
  value: string;
  tabs: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const locale = useInterfaceLocale();
  const copy = authoringUiCopy(locale);
  const labels: Record<string, string> = locale === "es" ? { Overview: "Resumen", Content: "Contenido", Path: "Conversación", Conversation: "Narrativa", Connections: "Conexiones", Conditions: "Condiciones", Choices: "Opciones", Logic: "Lógica", Routes: "Rutas" } : {};
  const modules = project && selection?.type === "node" ? narrativeInspectorModules(project, selection.id) : undefined;
  if (modules && project && selection) return <InspectorModuleTabs key={JSON.stringify([project.projectId, inspectorSelectionKey(selection)])} projectId={project.projectId} objectKey={inspectorSelectionKey(selection)} modules={modules} value={value} onChange={onChange} />;
  return <AccessibleTabs className="inspector-subtabs" value={value} tabs={tabs.map((tab) => ({ ...tab, label: labels[tab.label] ?? tab.label }))} onChange={onChange} ariaLabel={copy.inspectorSections} />;
}

function InDevelopmentPlaceholder({ title }: { title: string }) {
  return (
    <section className="inspector-section in-development-placeholder" aria-label={`${title} in development`}>
      <div className="in-development-mark" aria-hidden="true"><Sparkles size={18} /></div>
      <div>
        <span className="in-development-label">In Development</span>
        <h2>{title}</h2>
        <p>This logic surface will be configured separately from Logic Gates.</p>
      </div>
    </section>
  );
}

function LegacyConsequenceEditor({
  title = "Consequences",
  value,
  grantableOptions,
  onChange,
  compact = false,
}: {
  title?: string;
  value?: Consequence[];
  grantableOptions: GrantableEntityOption[];
  onChange: (value: Consequence[] | undefined) => void;
  /** Renders as a lightweight sub-block instead of a full inspector section — for embedding inside compact cards like the Conditions route list. */
  compact?: boolean;
}) {
  const consequences = value ?? [];
  const update = (index: number, consequence: Consequence) => {
    onChange(
      consequences.map((item, itemIndex) =>
        itemIndex === index ? consequence : item,
      ),
    );
  };
  const Wrapper = compact ? "div" : "section";
  const Heading = compact ? "h3" : "h2";

  return (
    <Wrapper className={compact ? "condition-editor-compact" : "inspector-section"}>
      <Heading>{title}</Heading>
      <div className="stack-list">
        {consequences.map((consequence, index) => (
          <div className="mini-card" key={`${consequence.type}:${index}`}>
            <label className="field-label">
              Type
              <select
                value={consequence.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  if (nextType === "addGrantable") {
                    update(index, {
                      type: "addGrantable",
                      entityId: grantableOptions[0]?.id ?? "",
                    });
                  } else if (nextType === "removeGrantable") {
                    update(index, {
                      type: "removeGrantable",
                      entityId: grantableOptions[0]?.id ?? "",
                    });
                  } else if (nextType === "editGrantable") {
                    update(index, {
                      type: "editGrantable",
                      entityId: grantableOptions[0]?.id ?? "",
                      propertyId: "",
                      value: "",
                    });
                  } else {
                    update(index, { type: "setVariable", name: "flag", value: true });
                  }
                }}
              >
                <option value="addGrantable">grant item</option>
                <option value="removeGrantable">remove item</option>
                <option value="editGrantable">edit item property</option>
                <option value="setVariable">set variable</option>
              </select>
            </label>
            {consequence.type === "addGrantable" || consequence.type === "removeGrantable" || consequence.type === "editGrantable" ? (
              <label className="field-label">
                Grantable entity
                <select
                  value={consequence.entityId}
                  onChange={(event) => update(index, { ...consequence, entityId: event.target.value })}
                >
                  <option value="">missing entity</option>
                  {grantableOptions.map((option) => (
                    <option key={`${option.source}:${option.id}`} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {consequence.type === "editGrantable" ? (
              <div className="logic-grid">
                <label className="field-label">
                  Property
                  <input
                    value={consequence.propertyId}
                    onChange={(event) => update(index, { ...consequence, propertyId: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  Value
                  <input
                    value={String(consequence.value ?? "")}
                    onChange={(event) => update(index, { ...consequence, value: event.target.value })}
                  />
                </label>
              </div>
            ) : null}
            {consequence.type === "setVariable" ? (
              <div className="logic-grid">
                <label className="field-label">
                  Variable
                  <input
                    value={String(consequence.name ?? "")}
                    onChange={(event) =>
                      update(index, {
                        ...consequence,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Value
                  <input
                    value={String(consequence.value ?? "")}
                    onChange={(event) =>
                      update(index, {
                        ...consequence,
                        value: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ) : null}
            <button
              type="button"
              className="danger"
              onClick={() =>
                onChange(
                  consequences.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="inspector-actions">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...consequences,
              { type: "addGrantable", entityId: grantableOptions[0]?.id ?? "" },
            ])
          }
        >
          Add Consequence
        </button>
      </div>
    </Wrapper>
  );
}

function ConsequenceEditor({
  project,
  title = "THEN",
  value,
  onChange,
  compact = false,
  contextEntityIds,
}: {
  project: BranchingProject;
  title?: string;
  value?: Consequence[];
  grantableOptions: GrantableEntityOption[];
  onChange: (value: Consequence[] | undefined) => void;
  compact?: boolean;
  contextEntityIds?: string[];
}) {
  return <LogicEffectEditor project={project} label={title} value={value} onChange={onChange} compact={compact} contextEntityIds={contextEntityIds} />;
}

function CanonRefsPicker({
  title = "Canon Refs",
  description,
  value,
  canonRefs,
  onChange,
}: {
  title?: string;
  description?: string;
  value?: string[];
  canonRefs: CanonRef[];
  onChange: (value: string[] | undefined) => void;
}) {
  const es = useInterfaceLocale() === "es";
  const [query, setQuery] = useState("");
  const refs = value ?? [];
  const refSet = new Set(refs);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? canonRefs
        .filter((ref) =>
          [ref.id, ref.label, ref.kind, ref.canonSourcePath]
            .filter(Boolean)
            .some((candidate) =>
              String(candidate).toLowerCase().includes(normalizedQuery),
            ),
        )
        .slice(0, 24)
    : [];
  const addRef = (id: string) => {
    if (!id || refSet.has(id)) return;
    onChange([...refs, id]);
    setQuery("");
  };
  const removeRef = (id: string) => {
    const nextRefs = refs.filter((ref) => ref !== id);
    onChange(nextRefs.length ? nextRefs : undefined);
  };

  return (
    <div
      className="inspector-section canon-ref-dropzone"
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes(
            "application/x-pathbranching-canon-ref",
          ) ||
          event.dataTransfer.types.includes("text/plain")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const id =
          event.dataTransfer.getData("application/x-pathbranching-canon-ref") ||
          event.dataTransfer.getData("text/plain");
        if (!id) return;
        event.preventDefault();
        addRef(id.trim());
      }}
    >
      {description ? <><h3>{title}</h3><p className="inspector-connection-hint">{description}</p></> : <h2>{title}</h2>}
      <div className="canon-ref-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={es ? "Buscar o arrastrar un elemento" : "Search or drop a world element"}
          aria-label={`${es ? "Buscar" : "Search"} ${title}`}
        />
        {normalizedQuery ? (
          <div className="canon-ref-results">
            {matches.map((ref) => (
              <button
                key={ref.id}
                type="button"
                disabled={refSet.has(ref.id)}
                onClick={() => addRef(ref.id)}
              >
                <strong>{ref.label ?? ref.id}</strong>
                <span>{ref.kind ?? "canon"}</span>
              </button>
            ))}
            {matches.length === 0 ? (
              <span className="empty-line">{es ? "No se encontraron elementos." : "No world elements found."}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="tag-list canon-ref-chips">
        {refs.map((ref) => (
          <button
            key={ref}
            type="button"
            onClick={() => removeRef(ref)}
            title={es ? "Quitar vínculo" : "Remove link"}
          >
            {canonRefs.find((canonRef) => canonRef.id === ref)?.label ?? ref}
          </button>
        ))}
        {refs.length === 0 ? (
          <span className="empty-line">
            {es ? "Busca o arrastra elementos para vincularlos." : "Search or drop elements to link them."}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CanonEntityRefPicker({
  title = "Speaker",
  placeholder = "Search every entity category…",
  emptyLabel = "Narrator",
  value,
  canonRefs,
  presentEntityRefs,
  onChange,
}: {
  title?: string;
  placeholder?: string;
  emptyLabel?: string;
  value?: string;
  canonRefs: CanonRef[];
  presentEntityRefs: string[];
  onChange: (value?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selectedRef = value
    ? canonRefs.find((ref) => ref.id === value)
    : undefined;
  
  // Sort matches: present entities first, then alphabetically
  const matches = normalizedQuery
    ? canonRefs
        .filter((ref) => canonRefMatches(ref, normalizedQuery))
        .sort((a, b) => {
          const aPresent = presentEntityRefs.includes(a.id);
          const bPresent = presentEntityRefs.includes(b.id);
          if (aPresent && !bPresent) return -1;
          if (!aPresent && bPresent) return 1;
          return (a.label ?? a.id).localeCompare(b.label ?? b.id);
        })
        .slice(0, 24)
    : [];

  return (
    <div className="reference-picker canon-entity-ref-picker">
      <strong>{title}</strong>
      <div className="reference-picker-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={title}
        />
      </div>
      {selectedRef ? (
        <div className="reference-picker-values">
          <span className="speaker-tag">
            {selectedRef.label ?? selectedRef.id}
            <small>{selectedRef.kind ?? "canon"}</small>
            <button type="button" onClick={() => onChange(undefined)} title="Clear speaker">×</button>
          </span>
        </div>
      ) : <span className="empty-line">{emptyLabel}</span>}
      {normalizedQuery ? (
        <div className="reference-picker-results">
          {matches.map((ref) => {
            const isPresent = presentEntityRefs.includes(ref.id);
            return (
              <button
                key={ref.id}
                type="button"
                disabled={ref.id === value}
                className={isPresent ? "present-entity" : ""}
                onClick={() => {
                  onChange(ref.id);
                  setQuery("");
                }}
              >
                <strong>{ref.label ?? ref.id}</strong>
                <span>{ref.kind ?? "canon"} · {isPresent ? "✓ present in event" : "add to event"}</span>
              </button>
            );
          })}
          {matches.length === 0 ? <span className="empty-line">No entities found.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function CanonContextList({
  title = "WorldNotion Context",
  embedded = false,
  refs,
  canonRefs,
  onSelectCanon,
  onSuggestEdit,
}: {
  title?: string;
  embedded?: boolean;
  refs?: string[];
  canonRefs: CanonRef[];
  onSelectCanon: (id: string) => void;
  onSuggestEdit: (id: string) => void;
}) {
  const es = useInterfaceLocale() === "es";
  const linkedRefs = (refs ?? [])
    .map((id) => canonRefs.find((ref) => ref.id === id))
    .filter((ref): ref is CanonRef => Boolean(ref));

  return (
    <section className="inspector-section canon-context-list">
      {!embedded ? <h2>{title}</h2> : null}
      <div className="stack-list">
        {linkedRefs.map((ref) => (
          <div className="mini-card canon-context-card" key={ref.id}>
            <strong>{ref.label ?? ref.id}</strong>
            <span>
              {ref.kind ?? "canon"} - {ref.canonSourcePath ?? ref.id}
            </span>
            {ref.missingIdentity ? (
              <span className="warning-text">
                {ref.identityWarning ?? "Missing WorldNotion identity."}
              </span>
            ) : null}
            {ref.preview ? (
              <p>
                {ref.preview.slice(0, 180)}
                {ref.preview.length > 180 ? "..." : ""}
              </p>
            ) : null}
            <div className="inspector-actions wrap">
              <button type="button" onClick={() => onSelectCanon(ref.id)}>
                {es ? "Ver en WorldNotion" : "View in WorldNotion"}
              </button>
              <button type="button" onClick={() => onSuggestEdit(ref.id)}>
                {es ? "Sugerir cambios" : "Suggest changes"}
              </button>
            </div>
          </div>
        ))}
        {linkedRefs.length === 0 ? (
          <span className="empty-line">
            Add canon refs to pull live WorldNotion context into this story
            object.
          </span>
        ) : null}
      </div>
    </section>
  );
}

function HomeDashboard({
  project,
  workspace,
  fileState,
  settings,
  missingRecentProjects,
  findings,
  theme,
  onOpenSettings,
  onToggleTheme,
  onEnterWorkspace,
  onOpenDemoUniverse,
  onOpenProject,
  onOpenRecentProject,
  onRemoveRecentProject,
  onExportRuntime,
  onFeedback,
  desktopMenu,
  windowControlsManaged,
  appSwitcher,
}: {
  project?: BranchingProject;
  workspace?: PathBranchingWorkspace;
  fileState: ProjectFileState;
  settings: AppSettings;
  missingRecentProjects: Set<string>;
  findings: ValidationFinding[];
  theme: ThemeId;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onEnterWorkspace: () => void;
  onOpenDemoUniverse?: () => void;
  onOpenProject: () => void;
  onOpenRecentProject: (path: string) => void;
  onRemoveRecentProject: (path: string) => void;
  onExportRuntime: () => void;
  onFeedback: () => void;
  desktopMenu?: boolean;
  windowControlsManaged?: boolean;
  appSwitcher?: ReactNode;
}) {
  const useLocale = useInterfaceLocale();
  const c = homeUiCopy(useLocale);
  const activeSequence =
    project?.sequences.find(
      (sequence) => sequence.id === activeSequenceId(project),
    ) ?? project?.sequences[0];
  const hasTransientStory = Boolean(workspace?.createdDefaultStory);
  const canEnterWorkspace = Boolean(project);
  const documentStatus = !project
    ? c.noUniverse
    : hasTransientStory
      ? c.noStory
      : c.ready;

  return (
    <main className="home-shell">
      <header className="home-topbar" onMouseDown={handleWindowTitlebarMouseDown}>
        <div className="home-topbar-leading">
        {appSwitcher ?? <HomeForgeMenu onFeedback={onFeedback} />}
        {desktopMenu ? <DesktopMenuBar /> : null}
        <div className="brand">
          <div title={c.tagline}>
            <h1>Pathbranching</h1>
          </div>
        </div>
        </div>
        <div className="home-topbar-actions">
          <NotificationBell locale={useLocale} />
          <button
            type="button"
            className="dock-icon-button"
            onClick={onOpenSettings}
            title={c.settings} aria-label={c.settings}
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="dock-icon-button"
            onClick={onFeedback}
            title={c.feedback}
            aria-label={c.feedback}
          >
            <MessageSquareText size={15} />
          </button>
          <button
            type="button"
            className="dock-icon-button"
            onClick={onToggleTheme}
            title={`${c.theme} (${themeById(theme).label})`}
            aria-label={c.theme}
          >
            {isDarkTheme(theme) ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {!windowControlsManaged ? <WindowTitleControls /> : null}
        </div>
      </header>

      <section className="home-panel">
        <div className="home-hero">
          <div className="home-copy">
            <p className="eyebrow">{c.home}</p>
            <h2>{c.open}</h2>
            <p>{c.description}</p>
          </div>

          {project ? (
            <button
              type="button"
              className="active-project-card"
              onClick={onEnterWorkspace}
            >
              <UniverseIconFrame profile={fileState.universeProfile} size={34} />
              <span>
                <strong>
                  {fileState.universeProfile?.name ??
                    project.name ??
                    project.projectId}
                </strong>
                <small>
                  {projectFileName(fileState.universePath)} - {documentStatus}
                </small>
              </span>
              <Home size={16} />
            </button>
          ) : null}
        </div>

        <div className="home-actions">
          <button
            type="button"
            className="primary-action"
            onClick={onOpenProject}
          >
            <FolderOpen size={16} />
            {c.openUniverse}
          </button>
          {onOpenDemoUniverse ? (
            <button type="button" onClick={onOpenDemoUniverse}>
              <Sparkles size={16} />
              {c.demo}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onEnterWorkspace}
            disabled={!canEnterWorkspace}
          >
            <GitBranch size={16} />
            {c.workspace}
          </button>
          <button
            type="button"
            onClick={onExportRuntime}
            disabled={!canEnterWorkspace}
          >
            <Download size={16} />
            {c.export}
          </button>
        </div>

        <div className="home-metrics">
          <div>
            <strong>{project?.sequences.length ?? 0}</strong>
            <span>{c.sequences}</span>
          </div>
          <div>
            <strong>{project?.branches.length ?? 0}</strong>
            <span>{c.branches}</span>
          </div>
          <div>
            <strong>{project?.events.length ?? 0}</strong>
            <span>{c.events}</span>
          </div>
          <div>
            <strong>{project?.projectDataObjects?.length ?? 0}</strong>
            <span>{c.objects}</span>
          </div>
          <div>
            <strong>{activeSequence?.name ?? c.none}</strong>
            <span>{c.activeSequence}</span>
          </div>
          <div>
            <strong>{documentStatus}</strong>
            <span>{c.document}</span>
          </div>
        </div>

        {findings.length ? (
          <section className="dashboard-findings">
            <h3>{c.validation}</h3>
            <div className="stack-list">
              {findings.slice(0, 5).map((finding) => (
                <div
                  className={`finding ${finding.severity}`}
                  key={`${finding.code}:${finding.id ?? ""}:${finding.ref ?? ""}`}
                >
                  <strong>{project ? findingPresentation(finding, project, useLocale).title : finding.code}</strong>
                  <span>{finding.message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {settings.recentProjects.length ? (
          <section className="recent-section">
            <h3>{c.recents}</h3>
            <div className="recent-list">
              {settings.recentProjects.map((path, itemIndex) => (
                <div
                  key={path}
                  className={`recent-row ${missingRecentProjects.has(path) ? "missing" : ""}`}
                  style={{ animationDelay: `${120 + itemIndex * 45}ms` }}
                >
                  <button
                    type="button"
                    className="recent-open-button"
                    onClick={() =>
                      missingRecentProjects.has(path)
                        ? onRemoveRecentProject(path)
                        : onOpenRecentProject(path)
                    }
                  >
                    <span className="recent-icon">
                      <GitBranch size={16} />
                    </span>
                    <span>
                      <strong>{projectFileName(path)}</strong>
                      <small>
                        {missingRecentProjects.has(path)
                          ? c.missingFolder
                          : path}
                      </small>
                    </span>
                    <FolderOpen size={14} />
                  </button>
                  <button
                    type="button"
                    className="recent-remove-button"
                    onClick={() => onRemoveRecentProject(path)}
                    title={c.removeRecent} aria-label={c.removeRecent}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function NamePromptDialog({
  open,
  title,
  label,
  initialValue,
  confirmLabel = "Save",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const dialogRef = useRef<HTMLFormElement>(null);
  const locale = useInterfaceLocale();
  useOverlayFocus(dialogRef, open, onCancel, true, "input");

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? "");
    }
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={panelUiText(locale, title)}
        className="modal-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (trimmed) {
            onConfirm(trimmed);
          }
        }}
      >
        <h2>{panelUiText(locale, title)}</h2>
        <label className="field-label">
          {panelUiText(locale, label)}
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <div className="inspector-actions">
          <button type="submit" disabled={!value.trim()}>
            {panelUiText(locale, confirmLabel)}
          </button>
          <button type="button" onClick={onCancel}>
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmActionDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const locale = useInterfaceLocale();
  useOverlayFocus(dialogRef, open, onCancel, true);
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <section ref={dialogRef} className="modal-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="inspector-actions">
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel}>
            {locale === "es" ? "Cancelar" : "Cancel"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PanelShell({
  title,
  open,
  railLabel,
  onToggle,
  resizable,
  onResize,
  onResetWidth,
  onResizeStateChange,
  onContextMenu,
  dataOnboardingTarget,
  children,
}: {
  title: string;
  open: boolean;
  railLabel: string;
  onToggle: () => void;
  resizable?: boolean;
  onResize?: (width: number) => void;
  onResetWidth?: () => void;
  onResizeStateChange?: (resizing: boolean) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  dataOnboardingTarget?: string;
  children: ReactNode;
}) {
  const embedded = useExplorerEmbedded();
  const ui = authoringUiCopy(useInterfaceLocale());
  const displayTitle = title === "Stories" ? ui.stories : title;
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizable || !onResize) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth =
      event.currentTarget.closest(".side-panel")?.getBoundingClientRect()
        .width ?? DEFAULT_PANEL_WIDTH;
    onResizeStateChange?.(true);

    const move = (moveEvent: PointerEvent) => {
      onResize(startWidth + moveEvent.clientX - startX);
    };
    const end = () => {
      onResizeStateChange?.(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  if (!open) {
    return (
      <aside className="side-rail" data-onboarding-target={dataOnboardingTarget} onContextMenu={onContextMenu}>
        <button type="button" title={`${ui.stories === "Historias" ? "Abrir" : "Open"} ${displayTitle}`} onClick={onToggle}>
          <span>{railLabel === "Stories" ? ui.stories : railLabel}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={`side-panel ${embedded ? "pb-explorer-embedded" : ""}`} data-onboarding-target={dataOnboardingTarget} onContextMenu={onContextMenu}>
      {!embedded ? <div className="panel-title">
        <div>
          <strong>{displayTitle}</strong>
        </div>
        <button type="button" title={`${ui.stories === "Historias" ? "Contraer" : "Collapse"} ${displayTitle}`} onClick={onToggle}>
          <span aria-hidden="true">&lt;</span>
        </button>
      </div> : null}
      {children}
      {resizable ? (
        <button
          type="button"
          className="resize-handle"
          aria-label={`Resize ${title}`}
          title={`Resize ${title}`}
          onPointerDown={startResize}
          onDoubleClick={onResetWidth}
        />
      ) : null}
    </aside>
  );
}

function CanonPanel({
  project,
  open,
  selectedId,
  onToggle,
  onResize,
  onResetWidth,
  onResizeStateChange,
  onSelect,
}: {
  project: BranchingProject;
  open: boolean;
  selectedId?: string;
  onToggle: () => void;
  onResize: (width: number) => void;
  onResetWidth: () => void;
  onResizeStateChange: (resizing: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRefs = project.canonRefs.filter((ref) => {
    return canonRefMatches(ref, normalizedQuery);
  });
  const fileTree = buildCanonFileTree(filteredRefs);

  const dragProps = (ref: CanonRef) => ({
    draggable: true,
    onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => {
      event.dataTransfer.setData(
        "application/x-pathbranching-canon-ref",
        ref.id,
      );
      event.dataTransfer.setData("text/plain", ref.id);
      event.dataTransfer.effectAllowed = "copy";
    },
  });

  const renderRefButton = (ref: CanonRef) => (
    <button
      className={`list-item explorer-item canon-file-item ${selectedId === ref.id ? "active" : ""}`}
      type="button"
      key={ref.id}
      {...dragProps(ref)}
      onClick={() => onSelect(ref.id)}
      title={canonRefPath(ref)}
    >
      <span className="explorer-item-title">
        <strong>
          {ref.missingIdentity ? (
            <span
              className="canon-warning-mark"
              title={ref.identityWarning ?? "Missing canon identity"}
            >
              !
            </span>
          ) : null}
          {ref.label ?? pathBasename(canonRefPath(ref))}
        </strong>
        {ref.missingIdentity ? <em>no id</em> : null}
        {ref.folderDescription ? <em>folder note</em> : null}
        {ref.workingCopyPath ? <em>draft</em> : null}
      </span>
    </button>
  );

  const renderTreeNodes = (nodes: CanonTreeNode[], depth = 0): ReactNode =>
    nodes.map((node) => {
      if (node.kind === "ref" && node.ref) {
        return (
          <div
            className="canon-tree-row"
            style={{ "--depth": depth } as CSSProperties}
            key={node.path}
          >
            {renderRefButton(node.ref)}
          </div>
        );
      }

      const expanded = expandedFolders[node.path] ?? true;
      const toggleExpanded = () =>
        setExpandedFolders((current) => ({
          ...current,
          [node.path]: !expanded,
        }));
      return (
        <div className="canon-tree-folder" key={node.path}>
          <button
            type="button"
            className={`canon-folder-button ${node.ref && selectedId === node.ref.id ? "active" : ""}`}
            style={{ "--depth": depth } as CSSProperties}
            {...(node.ref ? dragProps(node.ref) : {})}
            onClick={() => {
              if (node.ref) {
                onSelect(node.ref.id);
                return;
              }
              toggleExpanded();
            }}
            title={node.ref ? canonRefPath(node.ref) : node.path}
          >
            <span
              aria-hidden="true"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded();
              }}
            >
              {expanded ? "v" : ">"}
            </span>
            <strong>{node.name}</strong>
            {node.ref?.missingIdentity ? <em>! no id</em> : null}
            {node.ref ? <em>folder note</em> : null}
            {node.ref?.workingCopyPath ? <em>draft</em> : null}
          </button>
          {expanded ? renderTreeNodes(node.children, depth + 1) : null}
        </div>
      );
    });

  return (
    <PanelShell
      title="Canon"
      open={open}
      railLabel="Canon"
      onToggle={onToggle}
      resizable
      onResize={onResize}
      onResetWidth={onResetWidth}
      onResizeStateChange={onResizeStateChange}
    >
      <div className="explorer-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search canon"
          aria-label="Search canon refs"
        />
        <span>
          {filteredRefs.length}/{project.canonRefs.length}
        </span>
      </div>
      <div className="panel-scroll">
        <section className="panel-group canon-file-tree">
          {fileTree.length ? (
            renderTreeNodes(fileTree)
          ) : (
            <span className="empty-line">
              No canon files match this search.
            </span>
          )}
        </section>
      </div>
    </PanelShell>
  );
}

function OutlineBadges({ badges }: { badges: string[] }) {
  const visibleBadges = badges.filter(Boolean);
  if (!visibleBadges.length) return null;
  return (
    <span className="explorer-meta">
      {visibleBadges.map((badge) => (
        <small key={badge}>{badge}</small>
      ))}
    </span>
  );
}

function SequenceOutlinePanel({
  project,
  propertiesConfig,
  sequence,
  selectedId,
  onSelect,
  onUpdateSequence,
  onCreateSequenceCharacter,
}: {
  project: BranchingProject;
  propertiesConfig?: Record<string, unknown>;
  sequence?: Sequence;
  selectedId?: string;
  onSelect: (id: string) => void;
  onUpdateSequence: (id: string, updates: Partial<Sequence>) => void;
  onCreateSequenceCharacter: (sequenceId: string, name: string) => void;
}) {
  const es = useInterfaceLocale() === "es";

  const characterOptions = [
    ...project.canonRefs
      .filter((ref) => canonRefIsEntityPresentable(project, propertiesConfig, ref))
      .map((ref) => ({ id: ref.id, label: ref.label ?? ref.id })),
    ...(project.localExplorerEntities ?? [])
      .filter((entity) => localEntityIsSpeaker(project, entity))
      .map((entity) => ({ id: entity.id, label: entity.name })),
  ].filter((option, index, options) => options.findIndex((candidate) => candidate.id === option.id) === index);

  if (!sequence) {
    return (
      <span className="empty-line">
        {es ? "Crea una secuencia para empezar a organizar esta historia." : "Create a sequence to start outlining this story."}
      </span>
    );
  }

  return (
    <div className="story-outline-map">
      <button
        type="button"
        className={`outline-card primary ${selectedId === `file:sequence:${sequence.id}` ? "active" : ""}`}
        onClick={() => onSelect(`file:sequence:${sequence.id}`)}
      >
        <strong>{sequence.name}</strong>

        <OutlineBadges
          badges={[
            `${sequence.eventIds.length} ${es ? "eventos" : "events"}`,
            `${sequence.branchIds?.length ?? 0} ${es ? "ramas" : "branches"}`,
            conditionCount(sequence.availability)
              ? `${conditionCount(sequence.availability)} conditions`
              : "",
            sequence.consequences?.length
              ? `${sequence.consequences.length} effects`
              : "",
          ]}
        />
      </button>
      <InspectorPanel title={es ? "Configuración de secuencia" : "Sequence settings"}><section className="outline-editor sequence-settings-editor">
        <label className="field-label">
          {es ? "Nombre" : "Name"}
          <input
            value={sequence.name}
            onChange={(event) =>
              onUpdateSequence(sequence.id, { name: event.target.value })
            }
          />
        </label>
        <label className="field-label">
          {es ? "Evento inicial" : "Entry Event"}
          <select
            value={sequence.entryEventId}
            onChange={(event) =>
              onUpdateSequence(sequence.id, {
                entryEventId: event.target.value,
              })
            }
          >
            {sequence.eventIds.map((eventId) => (
              <option key={eventId} value={eventId}>
                {findEvent(project, eventId)?.name ?? eventId}
              </option>
            ))}
          </select>
        </label>
      </section></InspectorPanel>
      <InspectorPanel title={es ? "Actores" : "Actors"}>
        <section className="outline-editor sequence-actors-editor">
          <div className="field-label sequence-character-field">
            <span>{es ? "Personajes principales" : "Main characters"}</span>
            <SequenceCharacterPicker
              options={characterOptions}
              value={sequence.characterRefs ?? (sequence.characterRef ? [sequence.characterRef] : [])}
              locale={es ? "es" : "en"}
              onChange={(characterRefs) =>
                onUpdateSequence(sequence.id, { characterRefs, characterRef: undefined })
              }
              onCreateLocalCharacter={(name) => onCreateSequenceCharacter(sequence.id, name)}
            />
          </div>
        </section>
      </InspectorPanel>
      <InspectorPanel title={es ? "Conexiones de secuencia" : "Sequence connections"}>
        <div className="sequence-coming-soon">
          <details>
            <summary>{es ? "Próximamente" : "Coming soon"}</summary>
            <p>{es ? "La navegación entre secuencias se podrá configurar aquí." : "Navigation between sequences will be configured here."}</p>
          </details>
        </div>
      </InspectorPanel>
    </div>
  );
}

function BranchTagPanel({
  project,
  sequence,
  selectedId,
  onSelect,
  onCreateBranch,
  onUpdateBranch,
  onDeleteBranch,
  onCreateEventInBranch,
  onAssignEventToBranch,
}: {
  project: BranchingProject;
  sequence?: Sequence;
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateBranch: () => void;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => void;
  onDeleteBranch: (id: string) => void;
  onCreateEventInBranch: (branchId: string, type?: EventType) => void;
  onAssignEventToBranch: (eventId: string, branchId?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedBranches, setExpandedBranches] = useState<
    Record<string, boolean>
  >({});
  const normalizedQuery = query.trim().toLowerCase();
  const sequenceBranches = branchesForSequence(project, sequence?.id);
  const sequenceBranchIds = new Set(
    sequenceBranches.map((branch) => branch.id),
  );
  const branches = project.branches.filter((branch) =>
    [branch.id, branch.title, branch.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
  );
  const activeSequenceEventIds = new Set(sequence?.eventIds ?? []);

  return (
    <div className="story-outline-map">
      <div className="outline-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search branches"
          aria-label="Search branches"
        />
        <button type="button" onClick={onCreateBranch}>
          <FilePlus2 size={13} />
          Branch
        </button>
      </div>
      {branches.map((branch) => {
        const activeEvents = eventsForBranch(project, branch.id, sequence?.id);
        const allEvents = eventsForBranch(project, branch.id);
        const branchSelectionId = `file:branch:${branch.id}`;
        const expanded =
          expandedBranches[branch.id] ?? selectedId === branchSelectionId;
        return (
          <section
            className={`branch-capsule ${expanded ? "expanded" : ""}`}
            key={branch.id}
          >
            <button
              type="button"
              className={`branch-capsule-header ${selectedId === branchSelectionId ? "active" : ""}`}
              onClick={() => {
                onSelect(branchSelectionId);
                setExpandedBranches((current) => ({
                  ...current,
                  [branch.id]: !expanded,
                }));
              }}
              aria-expanded={expanded}
            >
              <span className="branch-capsule-caret">
                {expanded ? "v" : ">"}
              </span>
              <strong>{branch.title}</strong>
              <OutlineBadges
                badges={[
                  `${activeEvents.length} here`,
                  `${allEvents.length} total`,
                ]}
              />
            </button>
            {expanded ? (
              <div className="branch-capsule-body">
                <span className="branch-capsule-description">
                  {branch.description || branch.id}
                  {sequenceBranchIds.has(branch.id)
                    ? " / active sequence"
                    : " / story branch"}
                </span>
                <div className="outline-editor compact">
                  <input
                    value={branch.title}
                    aria-label="Branch title"
                    onChange={(event) =>
                      onUpdateBranch(branch.id, { title: event.target.value })
                    }
                  />
                  <label className="color-field branch-color-field">
                    <span>Branch color</span>
                    <input
                      type="color"
                      value={branch.color ?? "#b062d6"}
                      aria-label={`Color for ${branch.title}`}
                      onChange={(event) =>
                        onUpdateBranch(branch.id, { color: event.target.value })
                      }
                    />
                  </label>
                  <textarea
                    value={branch.description ?? ""}
                    rows={2}
                    aria-label="Branch description"
                    placeholder="Branch description"
                    onChange={(event) =>
                      onUpdateBranch(branch.id, {
                        description: event.target.value || undefined,
                      })
                    }
                  />
                  <div className="inspector-actions">
                    <button
                      type="button"
                      onClick={() => onCreateEventInBranch(branch.id)}
                    >
                      New Event
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreateEventInBranch(branch.id, "final")}
                    >
                      New Final
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDeleteBranch(branch.id)}
                      disabled={allEvents.length > 0}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="outline-children branch-capsule-events">
                  {project.events
                    .filter(
                      (event) =>
                        activeSequenceEventIds.has(event.id) &&
                        (event.branchRef === branch.id || !event.branchRef),
                    )
                    .map((event) => (
                      <div className="outline-row" key={event.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(`file:event:${event.id}`)}
                        >
                          {event.name}
                        </button>
                        <select
                          value={event.branchRef ?? ""}
                          aria-label={`Branch for ${event.name}`}
                          onChange={(selectEvent) =>
                            onAssignEventToBranch(
                              event.id,
                              selectEvent.target.value || undefined,
                            )
                          }
                        >
                          <option value="">No branch</option>
                          {project.branches.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
      {!branches.length ? (
        <span className="empty-line">No branches match this search.</span>
      ) : null}
    </div>
  );
}

function pathTreeNodeIcon(kind: PathTreeNode["kind"]) {
  if (kind === "decision") return <Split size={13} />;
  if (kind === "dialogue") return <MessageSquare size={13} />;
  if (kind === "beat") return <FileText size={13} />;
  if (kind === "outcome" || kind === "trigger") return <CircleDot size={13} />;
  return <GitBranch size={13} />;
}

function PathTreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onNavigate,
  isActive,
}: {
  node: PathTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (node: PathTreeNode) => void;
  isActive: (node: PathTreeNode) => boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <div className="path-tree-node">
      <div
        className={`path-tree-row ${isActive(node) ? "active" : ""}`}
        style={{ paddingLeft: 6 + depth * 16 }}
      >
        <button
          type="button"
          className="path-tree-toggle"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          aria-label={
            hasChildren ? (isExpanded ? "Collapse" : "Expand") : undefined
          }
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="path-tree-toggle-spacer" />
          )}
        </button>
        <button
          type="button"
          className="path-tree-label"
          onClick={() => onNavigate(node)}
        >
          {pathTreeNodeIcon(node.kind)}
          <span className="path-tree-title">{node.label}</span>
          {node.subtitle ? (
            <span className="path-tree-subtitle">{node.subtitle}</span>
          ) : null}
          {node.badges.length ? (
            <span className="path-tree-badges">
              {node.badges.map((badge) => (
                <small key={badge}>{badge}</small>
              ))}
            </span>
          ) : null}
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <div className="path-tree-children">
          {node.children.map((child) => (
            <PathTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
              isActive={isActive}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PathOutlinePanel({
  project,
  sequence,
  selectedId,
  onNavigate,
}: {
  project: BranchingProject;
  sequence?: Sequence;
  selectedId?: string;
  onNavigate: (node: PathTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const tree = useMemo(
    () => buildPathTree(project, sequence),
    [project, sequence],
  );

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isActive = (node: PathTreeNode) =>
    selectedId === (node.kind === "event" ? `file:event:${node.selectId}` : `file:path:${node.selectId}`);

  return (
    <div className="story-outline-map">
      <div className="outline-toolbar">
        <span>
          {tree.length} root event{tree.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="path-tree">
        {tree.map((node) => (
          <PathTreeRow
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            onNavigate={onNavigate}
            isActive={isActive}
          />
        ))}
      </div>
      {!tree.length ? (
        <span className="empty-line">No paths yet.</span>
      ) : null}
    </div>
  );
}

function FilesPanel({
  project,
  files,
  stories = [],
  activeStoryId,
  storyName,
  open,
  selectedId,
  onToggle,
  onResize,
  onResetWidth,
  onResizeStateChange,
  onSequenceChange,
  onStoryChange = () => undefined,
  onCreateStory,
  onRenameStory,
  onDeleteStory,
  onCreateSequence,
  onRenameSequence,
  onDeleteSequence,
  onUpdateSequence,
  onCreateSequenceCharacter,
  onCreateBranch,
  onUpdateBranch,
  onDeleteBranch,
  onCreateEventInBranch,
  onAssignEventToBranch,
  onSelect,
  activeOutlineTab,
  onOutlineTabChange,
  onNavigatePathNode,
  onContextMenu,
  propertiesConfig,
}: {
  project: BranchingProject;
  files: PathBranchingFileItem[];
  stories: Array<{ id: string; name: string }>;
  activeStoryId?: string;
  storyName?: string;
  open: boolean;
  selectedId?: string;
  onNavigatePathNode: (node: PathTreeNode) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLElement>) => void;
  propertiesConfig?: Record<string, unknown>;
  onToggle: () => void;
  onResize: (width: number) => void;
  onResetWidth: () => void;
  onResizeStateChange: (resizing: boolean) => void;
  onSequenceChange: (id: string) => void;
  onStoryChange: (id: string) => void;
  onCreateStory: () => void;
  onRenameStory: () => void;
  onDeleteStory: () => void;
  onCreateSequence: () => void;
  onRenameSequence: () => void;
  onDeleteSequence: () => void;
  onUpdateSequence: (id: string, updates: Partial<Sequence>) => void;
  onCreateSequenceCharacter: (sequenceId: string, name: string) => void;
  onCreateBranch: () => void;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => void;
  onDeleteBranch: (id: string) => void;
  onCreateEventInBranch: (branchId: string, type?: EventType) => void;
  onAssignEventToBranch: (eventId: string, branchId?: string) => void;
  onSelect: (id: string) => void;
  activeOutlineTab: StoryOutlineTab;
  onOutlineTabChange: (tab: StoryOutlineTab) => void;
}) {
  const locale = useInterfaceLocale();
  const ui = authoringUiCopy(locale);
  const currentSequenceId = activeSequenceId(project) ?? "";
  const activeSequence = currentSequenceId
    ? findSequence(project, currentSequenceId)
    : undefined;
  const totalItems =
    (activeSequence?.eventIds.length ?? 0) +
    branchesForSequence(project, activeSequence?.id).length +
    1;

  return (
    <PanelShell
      title="Stories"
      dataOnboardingTarget="pathbranching.stories-panel"
      open={open}
      railLabel="Stories"
      onToggle={onToggle}
      resizable
      onResize={onResize}
      onResetWidth={onResetWidth}
      onResizeStateChange={onResizeStateChange}
      onContextMenu={onContextMenu}
    >
      <StoriesPanel stories={stories} activeStoryId={activeStoryId}
        sequences={project.sequences} activeSequenceId={currentSequenceId}
        onStoryChange={onStoryChange} onSequenceChange={onSequenceChange}
        onCreateStory={onCreateStory} onRenameStory={onRenameStory} onDeleteStory={onDeleteStory}
        onCreateSequence={onCreateSequence} onRenameSequence={onRenameSequence} onDeleteSequence={onDeleteSequence} />
      {activeStoryId && activeSequence ? <div className="panel-scroll">
        <AccessibleTabs className="story-outline-tabs" value={activeOutlineTab}
          tabs={[{ id: "sequence", label: storiesViewCopy(locale).sequence }, { id: "branches", label: storiesViewCopy(locale).branches }, { id: "paths", label: storiesViewCopy(locale).paths }]}
          onChange={(tab) => onOutlineTabChange(tab as StoryOutlineTab)} ariaLabel={ui.stories} />
        <ExplorerPane active={activeOutlineTab === "sequence"}>
          <SequenceOutlinePanel
            project={project}
            propertiesConfig={propertiesConfig}
            sequence={activeSequence}
            selectedId={selectedId}
            onSelect={onSelect}
            onUpdateSequence={onUpdateSequence}
            onCreateSequenceCharacter={onCreateSequenceCharacter}
          />
        </ExplorerPane>
        <ExplorerPane active={activeOutlineTab === "branches"}>
          <BranchTagPanel
            project={project}
            sequence={activeSequence}
            selectedId={selectedId}
            onSelect={onSelect}
            onCreateBranch={onCreateBranch}
            onUpdateBranch={onUpdateBranch}
            onDeleteBranch={onDeleteBranch}
            onCreateEventInBranch={onCreateEventInBranch}
            onAssignEventToBranch={onAssignEventToBranch}
          />
        </ExplorerPane>
        <ExplorerPane active={activeOutlineTab === "paths"}>
          <PathOutlinePanel
            project={project}
            sequence={activeSequence}
            selectedId={selectedId}
            onNavigate={onNavigatePathNode}
          />
        </ExplorerPane>
        {totalItems === 0 ? (
          <span className="empty-line">No story objects yet.</span>
        ) : null}
      </div> : null}
    </PanelShell>
  );
}

function explorerInspectorTab(
  selection: Selection,
  project: BranchingProject,
  nodes: StoryCanvasNode[],
): InspectorTab | undefined {
  if (selection.type === "node") {
    if (project.events.some((event) => event.id === selection.id)) return undefined;
    const node = nodes.find((candidate) => candidate.id === selection.id);
    if (!node) return undefined;
    const kind = node.data.kind;
    if (kind === "start" || kind === "boundary") return undefined;
    const details = node.data.details as
      | {
          decision?: { name?: string };
          dialogue?: { title?: string; text?: { content?: string } };
          outcome?: { name?: string };
        }
      | undefined;
    const title =
      kind === "dialogue"
        ? details?.dialogue?.title ||
          details?.dialogue?.text?.content?.slice(0, 48) ||
          "Conversation"
          : kind === "decision"
          ? details?.decision?.name || "Decision"
          : kind === "speechBeat"
            ? "Dialogue"
            : kind === "directionBeat"
              ? "Stage direction"
          : kind === "routeGate"
            ? "Route Gate"
          : kind === "outcome"
            ? details?.outcome?.name || "Option"
            : kind === "branch"
              ? "Branch"
              : kind === "sequence"
                ? "Sequence"
                : "Inspector item";
    return { id: `${kind}:${selection.id}`, selection, title };
  }
  if (selection.type === "edge") {
    return { id: `edge:${selection.id}`, selection, title: "Transition" };
  }
  const title =
    selection.type === "canon"
      ? project.canonRefs.find((item) => item.id === selection.id)?.label ?? selection.id
      : selection.type === "explorerEntity"
        ? project.localExplorerEntities?.find((item) => item.id === selection.id)?.name ?? selection.id
        : selection.type === "explorerType"
          ? selection.id
          : selection.type === "explorerProperty"
            ? selection.id
            : selection.type === "dataObject"
              ? project.projectDataObjects?.find((item) => item.id === selection.id)?.name ?? selection.id
              : selection.id;
  const source = "source" in selection ? `:${selection.source}` : "";
  return { id: `${selection.type}:${selection.id}${source}`, selection, title };
}

type ManualInspectorSelection =
  | { type: "explorerEntity"; id: string }
  | { type: "explorerType"; id: string; source: "local" }
  | { type: "explorerProperty"; id: string; source: "canon" | "local" };

type ManualInspectorDraft = {
  selection: ManualInspectorSelection;
  project: BranchingProject;
  dirty: boolean;
  integrationMappingIds?: string[];
};

function recoverManualInspectorDrafts(projectId: string): Record<string, ManualInspectorDraft> {
  const result: Record<string, ManualInspectorDraft> = {};
  for (const [key, value] of authoringDraftEntries(projectId)) {
    try {
      const [, element, field] = JSON.parse(key);
      const draft = JSON.parse(value) as ManualInspectorDraft;
      if (field === "inspector" && draft.project?.projectId === projectId && draft.selection && draft.dirty) result[element] = draft;
    } catch { /* An invalid recovery entry cannot replace document content. */ }
  }
  return result;
}

function recoverEventDraft(project: BranchingProject, eventId: string): EventDraft | undefined {
  try {
    const value = getAuthoringDraft(authoringDraftKey(project.projectId, eventId, "event-inspector"));
    const draft = value ? JSON.parse(value) as EventDraft : undefined;
    return draft?.eventId === eventId && draft.draftEvent?.id === eventId && draft.baseEvent && draft.dirty ? { ...draft, saving: false } : undefined;
  } catch { return undefined; }
}

function manualInspectorDraftKey(selection?: Selection) {
  if (selection?.type === "explorerEntity") {
    return `explorerEntity:${selection.id}`;
  }
  if (selection?.type === "explorerType" && selection.source === "local") {
    return `explorerType:${selection.id}:local`;
  }
  if (selection?.type === "explorerProperty") {
    return `explorerProperty:${selection.id}:${selection.source}`;
  }
  return undefined;
}

function mergeManualInspectorDraft(
  project: BranchingProject,
  draft: ManualInspectorDraft,
) {
  const { selection, project: draftProject } = draft;
  if (selection.type === "explorerEntity") {
    const entity = draftProject.localExplorerEntities?.find(
      (item) => item.id === selection.id,
    );
    if (!entity) return project;
    return {
      ...project,
      localExplorerEntities: (project.localExplorerEntities ?? []).map((item) =>
        item.id === selection.id ? entity : item,
      ),
    };
  }
  if (selection.type === "explorerType") {
    const type = draftProject.localExplorerTypes?.find(
      (item) => item.id === selection.id,
    );
    if (!type) return project;
    return {
      ...project,
      localExplorerTypes: (project.localExplorerTypes ?? []).map((item) =>
        item.id === selection.id ? type : item,
      ),
    };
  }

  const localProperty =
    selection.source === "local"
      ? findLocalExplorerPropertyInTree(draftProject.localExplorerProperties, selection.id)
      : undefined;
  // Capabilities save immediately. A metadata draft must not overwrite them.
  const mappingIds = draft.integrationMappingIds ?? (selection.source === "canon" ? ["pathbranching:additional-characters"] : []);
  const mappings = mappingIds.length ? [
    ...(project.integrationConfigOverride?.mappings ?? []).filter(mapping => !mappingIds.includes(mapping.id)),
    ...(draftProject.integrationConfigOverride?.mappings ?? []).filter(mapping => mappingIds.includes(mapping.id)),
  ] : undefined;
  return {
    ...project,
    ...(localProperty
      ? {
          localExplorerProperties: updateLocalExplorerPropertyInTree(
            project.localExplorerProperties,
            selection.id,
            localProperty,
            new Date().toISOString(),
          ),
        }
      : {}),
    ...(mappings ? { integrationConfigOverride: { ...project.integrationConfigOverride, specVersion: project.integrationConfigOverride?.specVersion ?? "0.1", mappings } } : {}),
  };
}

function inspectorTabIcon(tab: InspectorTab) {
  if (tab.mode === "play") return Play;
  if (tab.selection.type === "node" && tab.selection.id.startsWith("interaction:")) return Dices;
  if (tab.selection.type === "node" && tab.selection.id.startsWith("barrier:")) return PauseCircle;
  if (tab.id.startsWith("dialogue:")) return MessageSquare;
  if (tab.id.startsWith("routeGate:")) return GitBranch;
  if (tab.id.startsWith("decision:") || tab.id.startsWith("outcome:"))
    return Split;
  if (tab.id.startsWith("edge:")) return GitBranch;
  if (tab.selection.type === "dataObject") return Database;
  if (tab.selection.type === "canon") return BookOpen;
  if (tab.selection.type === "canonSuggestion") return AlertTriangle;
  if (tab.selection.type === "explorerEntity") return Globe2;
  if (
    tab.selection.type === "explorerType" ||
    tab.selection.type === "explorerProperty"
  )
    return Boxes;
  return FilePlus2;
}

function DebugInspector({
  project,
  nodes,
  selection,
}: {
  project: BranchingProject;
  nodes: StoryCanvasNode[];
  selection: Selection;
}) {
  const node = selection.type === "node" ? nodes.find((item) => item.id === selection.id) : undefined;
  const payload = {
    selection,
    node,
    event: selection.type === "node" ? project.events.find((item) => item.id === selection.id) : undefined,
    canon: selection.type === "canon" ? project.canonRefs.find((item) => item.id === selection.id) : undefined,
    localEntity: selection.type === "explorerEntity" ? project.localExplorerEntities?.find((item) => item.id === selection.id) : undefined,
    dataObject: selection.type === "dataObject" ? project.projectDataObjects?.find((item) => item.id === selection.id) : undefined,
    workingCopy: selection.type === "canon" ? project.canonWorkingCopies?.find((item) => item.canonRefId === selection.id) : undefined,
    changeSets: selection.type === "canon" ? project.canonChangeSets?.filter((item) => item.target.entityId === selection.id) : undefined,
  };
  return <section className="inspector-section debug-inspector"><h2>Debug</h2><pre>{JSON.stringify(payload, null, 2)}</pre></section>;
}

function EventInspectorStatistics({ event }: { event: EventNode }) {
  const locale = useInterfaceLocale();
  const c = inspectorUiCopy(locale);
  const statistics = [
    { label: c.decisions, count: event.decisions?.length ?? 0, icon: <CircleDot size={16} aria-hidden="true" /> },
    { label: c.outcomes, count: event.decisions?.reduce((count, decision) => count + decision.outcomes.length, 0) ?? 0, icon: <Split size={16} aria-hidden="true" /> },
    { label: c.dialogues, count: (event.dialogues?.length ?? 0) + (event.dialogueBeats?.length ?? 0), icon: <MessageSquare size={16} aria-hidden="true" /> },
  ];
  return <section className="inspector-field-group inspector-event-statistics" aria-label={locale === "es" ? "Estadísticas" : "Statistics"}>
    <h2 className="inspector-group-title">{locale === "es" ? "Estadísticas" : "Statistics"}</h2>
    <dl>{statistics.map(item => <div key={item.label}><dt>{item.icon}{item.label}</dt><dd>{item.count}</dd></div>)}</dl>
  </section>;
}

function MinimizedInspectorTabTitle({
  title,
  kind,
  Icon,
}: {
  title: string;
  kind?: string;
  Icon: typeof GitBranch;
}) {
  return <strong title={title}>
    <Icon className="event-header-icon" size={14} aria-hidden="true" />
    <span className="event-header-copy event-header-inline">
      <span className="event-header-name">{title}</span>
      {kind ? <><span className="event-header-separator" aria-hidden="true">·</span><span className="event-header-kind">{kind}</span></> : null}
    </span>
  </strong>;
}

function EventInspectorTabHeader({ project, event }: { project: BranchingProject; event: EventNode }) {
  const locale = useInterfaceLocale();
  const c = inspectorUiCopy(locale);
  return <MinimizedInspectorTabTitle
    title={event.name || c.untitled}
    kind={inspectorTargetKind(project, { type: "node", id: event.id }, locale)}
    Icon={GitBranch}
  />;
}

function EventAuthoringDock({
  project,
  nodes,
  selection,
  eventDraft,
  eventInspector,
  tabGroups,
  onOpenEvent,
  onCollapseEvent,
  onCloseEvent,
  onCloseAllEvents,
  onCloseEventsAbove,
  onCloseEventsBelow,
  onCloseOtherEvents,
  onPruneEvents,
  onSaveGroup,
  onLoadGroup,
  onDeleteGroup,
  onSelect,
  onLocateInspectorTab,
  inspectorTabs,
  expandedInspectorTabId,
  inspectorMaximized,
  onOpenInspectorTab,
  onCloseInspectorTab,
  onCloseAllInspectorTabs,
  onCloseInspectorTabsAbove,
  onCloseInspectorTabsBelow,
  onCloseOtherInspectorTabs,
  onDisableInspectorDebug,
  onToggleInspectorMaximized,
  toolbarHost,
  inspectorSize, onInspectorResize, onFold, inspectorStackOrder, onInspectorStackOrderChange,
  fullscreen, onFullscreenChange, onNameMutation,
  children,
}: {
  project: BranchingProject;
  nodes: StoryCanvasNode[];
  selection?: Selection;
  eventDraft?: EventDraft;
  eventInspector: EventInspectorState;
  tabGroups: EventInspectorTabGroup[];
  onOpenEvent: (eventId: string) => void;
  onCollapseEvent: (eventId: string) => void;
  onCloseEvent: (eventId: string) => void;
  onCloseAllEvents: () => void;
  onCloseEventsAbove: (eventId: string) => void;
  onCloseEventsBelow: (eventId: string) => void;
  onCloseOtherEvents: (eventId: string) => void;
  onPruneEvents: (eventIds: readonly string[]) => void;
  onSaveGroup: () => void;
  onLoadGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelect: (selection?: Selection) => void;
  onLocateInspectorTab: (selection: Selection) => void;
  inspectorTabs: InspectorTab[];
  expandedInspectorTabId?: string;
  inspectorMaximized: boolean;
  onOpenInspectorTab: (id: string) => void;
  onCloseInspectorTab: (id: string) => void;
  onCloseAllInspectorTabs: () => void;
  onCloseInspectorTabsAbove: (id: string) => void;
  onCloseInspectorTabsBelow: (id: string) => void;
  onCloseOtherInspectorTabs: (id: string) => void;
  onDisableInspectorDebug: () => void;
  onToggleInspectorMaximized: () => void;
  toolbarHost: HTMLElement | null;
  inspectorSize: InspectorSize;
  inspectorStackOrder: string[];
  onInspectorStackOrderChange: (order: string[]) => void;
  onInspectorResize:(size:InspectorSize)=>void;
  onFold:()=>void;
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  onNameMutation: (mutate: (current: BranchingProject) => BranchingProject) => void | Promise<void>;
  children: ReactNode;
}) {
  const locale = useInterfaceLocale();
  const ui = (text: string) => panelUiText(locale, text);
  const dockRef = useRef<HTMLElement | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement | null>(null);
  const manuallyCollapsedEventIdRef = useRef<string | undefined>(undefined);
  const manuallyClosedEventIdRef = useRef<string | undefined>(undefined);
  const [selectedTabGroupId, setSelectedTabGroupId] = useState("");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [inspectorSearchOpen, setInspectorSearchOpen] = useState(false);
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState("");
  const inspectorSearchRef = useRef<HTMLDivElement>(null);
  const inspectorSearchInputRef = useRef<HTMLInputElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  useApplicationEffect(() => {
    if (!groupMenuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!groupMenuRef.current?.contains(event.target as Node)) setGroupMenuOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [groupMenuOpen]);
  useApplicationEffect(() => {
    if (!inspectorSearchOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!inspectorSearchRef.current?.contains(event.target as Node)) setInspectorSearchOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setInspectorSearchOpen(false);
        setInspectorSearchQuery("");
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
    };
  }, [inspectorSearchOpen]);
  const groupPopoverRef = useRef<HTMLDivElement>(null);
  const [indexHost, setIndexHost] = useState<HTMLDivElement | null>(null);
  const groupPopoverStyle = useInspectorMenuPlacement(groupMenuOpen, groupMenuRef, groupPopoverRef, 300, eventInspector.openEventIds.length + inspectorTabs.length > 0 ? "left-of-anchor" : "auto");
  const [dockHeight, setDockHeight] = useState(0);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    let frame: number | undefined;
    const measureHeight = () => {
      frame = undefined;
      const measuredHeight = Math.round(dock.getBoundingClientRect().height);
      if (measuredHeight > 0) setDockHeight(current => current === measuredHeight ? current : measuredHeight);
    };
    const scheduleMeasure = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(measureHeight);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(dock);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [eventInspector.open, inspectorTabs.length, eventInspector.openEventIds.length]);
  const [tabContextMenu, setTabContextMenu] = useState<
    | { kind: "event"; eventId: string; x: number; y: number }
    | { kind: "inspector"; tabId: string; x: number; y: number }
  >();
  const currentSequence = project.sequences.find(
    (sequence) => sequence.id === activeSequenceId(project),
  );
  const validEventIds = useMemo(
    () => project.events.map(event=>event.id),
    [project.events],
  );
  const selectedEventId = eventIdFromSelection(project, nodes, selection);
  const selectedEvent = selectedEventId
    ? project.events.find((event) => event.id === selectedEventId)
    : undefined;
  const openEvents = eventInspector.openEventIds
    .map((eventId) => project.events.find((event) => event.id === eventId))
    .filter((event): event is EventNode => Boolean(event));
  const selectedTabGroup = tabGroups.find(
    (group) => group.id === selectedTabGroupId,
  );
  const hasInspectorTabs = openEvents.length + inspectorTabs.length > 0;
  const hasExpandedInspector = Boolean(eventInspector.expandedEventId || inspectorTabs.some(tab => tab.id === expandedInspectorTabId));
  const inspectorSearchItems = useMemo(() => {
    const events = project.events.flatMap(event => {
      const parentName = event.parentEventId ? project.events.find(parent => parent.id === event.parentEventId)?.name : undefined;
      return [
        { key: `event:${event.id}`, kind: "event" as const, eventId: event.id, id: event.id, title: event.name || (locale === "es" ? "Evento sin nombre" : "Untitled event"), detail: locale === "es" ? "Evento" : "Event" },
        ...(event.dialogues ?? []).map(dialogue => ({ key: `narrative:dialogue:${event.id}:${dialogue.id}`, kind: "narrative" as const, eventId: event.id, id: `dialogue:${event.id}:${dialogue.id}`, title: dialogue.title || (locale === "es" ? "Conversación sin título" : "Untitled conversation"), detail: [locale === "es" ? "Conversación" : "Conversation", parentName || event.name].filter(Boolean).join(" · ") })),
        ...(event.decisions ?? []).map(decision => ({ key: `narrative:decision:${event.id}:${decision.id}`, kind: "narrative" as const, eventId: event.id, id: `decision:${event.id}:${decision.id}`, title: decision.name || (locale === "es" ? "Decisión sin nombre" : "Untitled decision"), detail: [locale === "es" ? "Decisión" : "Decision", parentName || event.name].filter(Boolean).join(" · ") })),
      ];
    });
    const tabs = inspectorTabs.map(tab => ({ key: `inspector:${tab.id}`, kind: "inspector" as const, id: tab.id, title: inspectorTargetTitle(project, tab.selection, locale), detail: inspectorTargetKind(project, tab.selection, locale) }));
    const query = inspectorSearchQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return [...events, ...tabs].filter(item => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(query)).slice(0, 30);
  }, [project, inspectorTabs, inspectorSearchQuery, locale]);
  const stack = orderedInspectorStack([
    ...inspectorTabs.map(tab => ({kind:"inspector" as const, id:tab.id})),
    ...openEvents.map(event => ({kind:"event" as const, id:event.id})),
  ], inspectorStackOrder);
  useInspectorLayoutMotion(dockRef, fullscreen, JSON.stringify(stack.map(inspectorStackKey)));
  const moveTab = (key: string, destination: number) => {
    const order = stack.map(inspectorStackKey);
    const from = order.indexOf(key);
    if (from < 0 || destination < 0 || destination >= order.length || from === destination) return;
    order.splice(from, 1); order.splice(destination, 0, key);
    onInspectorStackOrderChange(order);
  };
  const availableInspectorHeight = useCallback(() => {
    const measuredHeight = dockHeight || dockRef.current?.getBoundingClientRect().height;
    if (!measuredHeight) return 480;
    if (fullscreen) return measuredHeight;
    return inspectorStackCardHeight(measuredHeight, openEvents.length + inspectorTabs.length, 480, true);
  }, [dockHeight, inspectorMaximized, inspectorTabs.length, openEvents.length, fullscreen]);
  const inspectorCardHeight = useCallback(
    (tabId: string) => {
      const requested = inspectorMaximized || fullscreen ? availableInspectorHeight() : inspectorSize.height ?? 480;
      const available = availableInspectorHeight();
      return Number.isFinite(available) ? Math.min(requested, available) : requested;
    },
    [availableInspectorHeight, inspectorSize.height, inspectorMaximized, fullscreen],
  );
  const canExpandInspector = useCallback(
    () => fullscreen || inspectorMaximized || availableInspectorHeight() >= 240,
    [availableInspectorHeight, inspectorMaximized, fullscreen],
  );
  const resizeInspectorCard = useCallback((event: ReactPointerEvent<HTMLDivElement>, tabId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.parentElement;
    const startY = event.clientY;
    const startHeight = card?.getBoundingClientRect().height ?? 440;
    const maxHeight = availableInspectorHeight();
    const minHeight = Math.min(240, maxHeight);
    const onMove = (moveEvent: PointerEvent) => {
      const requestedHeight = startHeight + startY - moveEvent.clientY;
      onInspectorResize({...inspectorSize,height:Math.min(maxHeight,Math.max(minHeight,requestedHeight))});
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd, { once: true });
  }, [availableInspectorHeight, inspectorSize, onInspectorResize, inspectorMaximized]);
  const renderGroupMenu = useCallback(
    (variant: "stack" | "collapsed") => (
      <div
        ref={groupMenuRef}
        className={`event-inspector-group-menu ${variant} ${groupMenuOpen ? "open" : ""}`}
        aria-label={ui("Inspector tab groups")}
        onKeyDown={event => { if (groupMenuOpen && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setGroupMenuOpen(false); groupMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }}
      >
        <button
          type="button"
          className="event-inspector-group-trigger"
          title={ui("Inspector tab groups")}
          aria-label={ui("Inspector tab groups")}
          aria-expanded={groupMenuOpen}
          aria-haspopup="dialog"
          onClick={(event) => {
            event.stopPropagation();
            setGroupMenuOpen((open) => !open);
          }}
        >
          <FolderOpen size={15} />
        </button>
        {groupMenuOpen ? <div ref={groupPopoverRef} style={fullscreen ? {position:"absolute",visibility:"visible",left:0,right:"auto",top:"calc(100% + 8px)",bottom:"auto",maxHeight:"calc(100vh - 180px)",transform:"none"} : groupPopoverStyle} className="event-inspector-group-popover" role="dialog" aria-label={locale === "es" ? "Grupos de pestañas" : "Tab groups"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setGroupMenuOpen(false); groupMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } }}>
          <div className="event-inspector-group-popover-header">
            <strong>{locale === "es" ? "Grupos de pestañas" : "Tab groups"}</strong>
            <span>{tabGroups.length}</span>
          </div>
          {variant === "stack" ? (
            <button
              type="button"
              disabled={!hasInspectorTabs}
              onClick={onSaveGroup}
            >
              {locale === "es" ? "Guardar grupo actual" : "Save current group"}
            </button>
          ) : null}
          <select
            aria-label={locale === "es" ? "Grupos de pestañas guardados" : "Saved inspector tab groups"}
            disabled={tabGroups.length === 0}
            value={selectedTabGroupId}
            onChange={(event) => setSelectedTabGroupId(event.target.value)}
          >
            {tabGroups.length === 0 ? (
              <option value="">{locale === "es" ? "Sin grupos guardados" : "No saved groups"}</option>
            ) : null}
            {tabGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <div className="event-inspector-group-actions">
            <button
              type="button"
              disabled={!selectedTabGroup}
              onClick={() =>
                selectedTabGroup && onLoadGroup(selectedTabGroup.id)
              }
            >
              {locale === "es" ? "Cargar" : "Load"}
            </button>
            {variant === "stack" ? (
              <button
                type="button"
                disabled={!selectedTabGroup}
                onClick={() =>
                  selectedTabGroup && onDeleteGroup(selectedTabGroup.id)
                }
              >
                {locale === "es" ? "Eliminar" : "Delete"}
              </button>
            ) : null}
          </div>
        </div> : null}
      </div>
    ),
    [
      onDeleteGroup,
      onLoadGroup,
      onSaveGroup,
      hasInspectorTabs,
      groupMenuOpen,
      groupPopoverStyle,
      fullscreen,
      selectedTabGroup,
      selectedTabGroupId,
      tabGroups,
    ],
  );

  useEffect(() => {
    onPruneEvents(validEventIds);
  }, [currentSequence?.id, onPruneEvents, validEventIds]);

  useEffect(() => {
    if (
      selectedTabGroupId &&
      tabGroups.some((group) => group.id === selectedTabGroupId)
    ) {
      return;
    }
    setSelectedTabGroupId(tabGroups[0]?.id ?? "");
  }, [selectedTabGroupId, tabGroups]);

  const toggleInspector = useCallback(
    (eventId: string) => {
      if (eventInspector.expandedEventId !== eventId && !canExpandInspector()) return;
      manuallyCollapsedEventIdRef.current = undefined;
      manuallyClosedEventIdRef.current = undefined;
      onOpenEvent(eventId);
      onSelect({ type: "node", id: eventId });
    },
    [canExpandInspector, eventInspector.expandedEventId, onOpenEvent, onSelect],
  );

  const toggleInspectorTab = useCallback(
    (tabId: string) => {
      if (expandedInspectorTabId !== tabId && !canExpandInspector()) return;
      onOpenInspectorTab(tabId);
    },
    [canExpandInspector, expandedInspectorTabId, onOpenInspectorTab],
  );

  const openInspectorSearchItem = useCallback((item: (typeof inspectorSearchItems)[number]) => {
    if (item.kind === "event") {
      toggleInspector(item.id);
    } else if (item.kind === "narrative") {
      onOpenEvent(item.eventId);
      onSelect({ type: "node", id: item.id });
    } else {
      toggleInspectorTab(item.id);
    }
    setInspectorSearchOpen(false);
    setInspectorSearchQuery("");
  }, [inspectorSearchItems, onOpenEvent, onSelect, toggleInspector, toggleInspectorTab]);

  const closeInspector = useCallback(
    (eventId: string) => {
      manuallyClosedEventIdRef.current = eventId;
      onCloseEvent(eventId);
    },
    [onCloseEvent],
  );

  const minimizeInspector = useCallback(
    (eventId: string) => {
      if (eventInspector.expandedEventId === eventId) {
        manuallyCollapsedEventIdRef.current = eventId;
      }
      onCollapseEvent(eventId);
    },
    [eventInspector.expandedEventId, onCollapseEvent],
  );

  const openTabCloseMenu = useCallback(
    (contextEvent: ReactMouseEvent<HTMLButtonElement>, eventId: string) => {
      contextEvent.preventDefault();
      contextEvent.stopPropagation();
      setTabContextMenu({
        kind: "event",
        eventId,
        ...clampFloatingMenuPosition(
          contextEvent.clientX,
          contextEvent.clientY,
          viewportBounds(),
        ),
      });
    },
    [],
  );

  const openInspectorTabCloseMenu = useCallback(
    (contextEvent: ReactMouseEvent<HTMLButtonElement>, tabId: string) => {
      contextEvent.preventDefault();
      contextEvent.stopPropagation();
      setTabContextMenu({
        kind: "inspector",
        tabId,
        ...clampFloatingMenuPosition(
          contextEvent.clientX,
          contextEvent.clientY,
          viewportBounds(),
        ),
      });
    },
    [],
  );

  const renderInspectorWindowTools = () => (
    <div className="inspector-stack-tools inspector-window-tools" role="toolbar" aria-label={locale === "es" ? "Vista del inspector" : "Inspector view"}>
      {!fullscreen ? renderGroupMenu("stack") : null}
      {!fullscreen ? <button
        type="button"
        className="inspector-maximize-button"
        title={inspectorMaximized ? locale === "es" ? "Restaurar tamaño" : "Restore size" : locale === "es" ? "Ampliar inspector" : "Expand inspector"}
        aria-label={inspectorMaximized ? locale === "es" ? "Restaurar tamaño" : "Restore size" : locale === "es" ? "Ampliar inspector" : "Expand inspector"}
        aria-pressed={inspectorMaximized}
        disabled={fullscreen}
        onClick={onToggleInspectorMaximized}
      >
        {inspectorMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button> : null}
      <button type="button" className="inspector-maximize-button" aria-label={fullscreen ? locale === "es" ? "Salir de pantalla completa" : "Exit fullscreen" : locale === "es" ? "Pantalla completa del canvas" : "Canvas fullscreen"} title={fullscreen ? locale === "es" ? "Salir de pantalla completa" : "Exit fullscreen" : locale === "es" ? "Pantalla completa del canvas" : "Canvas fullscreen"} aria-pressed={fullscreen} onClick={() => onFullscreenChange(!fullscreen)}>{fullscreen ? <Shrink size={15} /> : <Fullscreen size={15} />}</button>
    </div>
  );

  useApplicationEffect(() => {
    if (!tabContextMenu) return;
    function handlePointerDown(event: PointerEvent) {
      if (tabContextMenuRef.current?.contains(event.target as Node)) return;
      setTabContextMenu(undefined);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setTabContextMenu(undefined);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tabContextMenu]);

  useEffect(()=>{const frame=requestAnimationFrame(()=>dockRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"}));return()=>cancelAnimationFrame(frame);},[eventInspector.expandedEventId,expandedInspectorTabId]);

  if (openEvents.length + inspectorTabs.length === 0) {
    if (inspectorTabs.length > 0) {
      return (
        <aside
          className={`event-authoring-dock explorer-inspector-dock ${inspectorMaximized ? "maximized" : ""}`}
          ref={dockRef}
          aria-label="Inspector dock"
        >
          <div className="event-inspector-stack">
            <div className="event-inspector-tab-cluster">
            <div className="inspector-stack-tools">
              {renderGroupMenu("stack")}
              <button
                type="button"
                className="inspector-maximize-button"
                title={inspectorMaximized ? locale === "es" ? "Restaurar ancho" : "Restore width" : locale === "es" ? "Ampliar ancho" : "Expand width"}
                onClick={onToggleInspectorMaximized}
              >
                {inspectorMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
            <div className="event-inspector-cards" role="list">
            {inspectorTabs.map((tab, index) => {
              const expanded = expandedInspectorTabId === tab.id;
              const TabIcon = inspectorTabIcon(tab);
              return (
                <section
                  className={`event-editor-panel event-inspector-card ${expanded ? "expanded" : "minimized"}`}
                  key={tab.id}
                  role="listitem"
                  data-inspector-kind={tab.selection.type}
                  data-active={expanded || undefined}
                  style={{ "--stack-index": index + 1, "--inspector-card-height": `${inspectorCardHeight(tab.id)}px` } as CSSProperties}
                >
                  {expanded ? <div className="event-inspector-card-resize-border" onPointerDown={(event) => resizeInspectorCard(event, tab.id)} title="Drag top border to resize" /> : null}
                  <div className="event-editor-header" onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a, [contenteditable='true'], .event-editor-actions")) return;
                    toggleInspectorTab(tab.id);
                  }}>
                    <button
                      type="button"
                      className={`event-minimized-title${tab.id.startsWith("routeGate:") ? " route-gate-titleless" : ""}`}
                      title={tab.id.startsWith("routeGate:") ? undefined : tab.title}
                      onClick={() => toggleInspectorTab(tab.id)}
                    >
                      <MinimizedInspectorTabTitle title={inspectorTargetTitle(project,tab.selection,locale)} kind={inspectorTargetKind(project,tab.selection,locale)} Icon={TabIcon} />
                    </button>
                    <div className="event-editor-actions">
                      {tab.mode !== "play" ? <button type="button" className="inspector-locate-button" title={ui("Locate on canvas")} aria-label={ui("Locate on canvas")} onClick={() => onLocateInspectorTab(tab.selection)}>
                        <Crosshair size={14} />
                      </button> : null}
                      <button type="button" title={expanded ? ui("Minimize inspector") : ui("Expand inspector")} onClick={() => toggleInspectorTab(tab.id)}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      </button>
                      {tab.mode === "debug" ? (
                        <button type="button" title="Disable Inspector Debug" onClick={onDisableInspectorDebug}><Power size={14} /></button>
                      ) : <button type="button" title={ui("Close inspector")} onClick={() => onCloseInspectorTab(tab.id)} onContextMenu={(e) => openInspectorTabCloseMenu(e, tab.id)}><X size={14} /></button>}
                    </div>
                  </div>
                  {expanded ? <div className="event-inspector-body"><div className="event-inspector-body-scroll">{tab.mode === "debug" ? <DebugInspector project={project} nodes={nodes} selection={tab.selection} /> : isValidElement(children) && children.type !== Fragment ? cloneElement(children as ReactElement<{ selection?: Selection }>, { selection: tab.selection }) : children}</div></div> : null}
                </section>
              );
            })}
            </div>
            </div>
          </div>
        </aside>
      );
    }
    return selectedEvent ||
      eventInspector.openEventIds.length > 0 ||
      tabGroups.length > 0 ? (
      <aside
        className="event-authoring-dock collapsed"
        ref={dockRef}
        aria-label="Event authoring dock"
      >
        <div className="event-inspector-collapsed-controls">
          <button
            type="button"
            className="event-stack-launcher icon-only"
            disabled={
              !selectedEvent && eventInspector.openEventIds.length === 0
            }
            title="Open inspector"
            aria-label="Open inspector"
            onClick={() => {
              if (eventInspector.openEventIds.length > 0) {
                onOpenEvent(eventInspector.openEventIds[0]);
                return;
              }
              if (selectedEvent) {
                toggleInspector(selectedEvent.id);
              }
            }}
          >
            <ChevronUp size={14} />
          </button>
          {renderGroupMenu("collapsed")}
        </div>
      </aside>
    ) : null;
  }

  return (
    <aside
      className={`event-authoring-dock unified-authoring-dock ${inspectorMaximized ? "maximized" : ""} ${fullscreen ? "centered" : ""}`} style={{"--inspector-width":`${inspectorSize.width}px`} as CSSProperties}
      ref={dockRef}
      aria-label="Inspector dock"
      onKeyDown={event => {
        if (event.key !== "Escape" || tabContextMenu) return;
        if (groupMenuOpen) {
          event.preventDefault(); event.stopPropagation();
          setGroupMenuOpen(false);
          groupMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        } else if (event.target instanceof Element && !event.target.closest('[role="dialog"],[role="menu"]')) {
          event.stopPropagation(); onFold();
          requestAnimationFrame(() => dockRef.current?.querySelector<HTMLButtonElement>(".event-minimized-title, .event-stack-launcher")?.focus());
        }
      }}
    >
      <InspectorIndexHost.Provider value={fullscreen ? indexHost : null}>
      <div className="event-inspector-stack">
        <div className="event-inspector-tab-cluster">
          {fullscreen ? <div className="inspector-centered-index-slot" ref={setIndexHost} /> : null}
          {fullscreen ? (
            <div className="inspector-centered-sidebar">
              <div className="inspector-centered-actions">
                {renderGroupMenu("stack")}
                <div className={`inspector-centered-search ${inspectorSearchOpen ? "open" : ""}`} ref={inspectorSearchRef}>
                  <button
                    type="button"
                    className="inspector-centered-search-trigger"
                    title={locale === "es" ? "Buscar inspectores" : "Search inspectors"}
                    aria-label={locale === "es" ? "Buscar inspectores" : "Search inspectors"}
                    aria-expanded={inspectorSearchOpen}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setInspectorSearchOpen(open => !open);
                      if (!inspectorSearchOpen) requestAnimationFrame(() => inspectorSearchInputRef.current?.focus({ preventScroll: true }));
                      else setInspectorSearchQuery("");
                    }}
                  ><Search size={15} aria-hidden="true" /></button>
                  {inspectorSearchOpen ? <div className="inspector-centered-search-popover" role="dialog" aria-label={locale === "es" ? "Buscar inspectores" : "Search inspectors"}>
                    <label className="inspector-centered-search-field">
                      <Search size={15} aria-hidden="true" />
                      <input ref={inspectorSearchInputRef} type="search" value={inspectorSearchQuery} onChange={event => setInspectorSearchQuery(event.target.value)} placeholder={locale === "es" ? "Buscar eventos, conversaciones…" : "Search events, conversations…"} aria-label={locale === "es" ? "Buscar eventos, conversaciones y decisiones" : "Search events, conversations and decisions"} />
                      {inspectorSearchQuery ? <button type="button" aria-label={locale === "es" ? "Limpiar búsqueda" : "Clear search"} onClick={() => { setInspectorSearchQuery(""); inspectorSearchInputRef.current?.focus({ preventScroll: true }); }}><X size={14} aria-hidden="true" /></button> : null}
                    </label>
                    <div className="inspector-centered-search-results" role="listbox" aria-label={locale === "es" ? "Resultados" : "Results"}>
                      {inspectorSearchQuery.trim() ? inspectorSearchItems.length ? inspectorSearchItems.map(item => <button type="button" role="option" aria-selected="false" key={item.key} onClick={() => openInspectorSearchItem(item)}><strong>{item.title}</strong><span>{item.detail}</span></button>) : <p role="status">{locale === "es" ? "No se encontraron inspectores." : "No inspectors found."}</p> : <p>{locale === "es" ? "Busca eventos, conversaciones o decisiones." : "Search events, conversations or decisions."}</p>}
                    </div>
                  </div> : null}
                </div>
              </div>
              <nav className="inspector-centered-tabs" aria-label={locale === "es" ? "Inspectores abiertos" : "Open inspectors"}>
                {stack.map((target, index) => {
                  const key = inspectorStackKey(target);
                  const tab = target.kind === "inspector" ? inspectorTabs.find(tab => tab.id === target.id) : undefined;
                  const event = target.kind === "event" ? openEvents.find(event => event.id === target.id) : undefined;
                  const TabIcon = tab ? inspectorTabIcon(tab) : GitBranch;
                  const active = tab ? expandedInspectorTabId === tab.id : eventInspector.expandedEventId === event?.id;
                  const title = tab ? inspectorTargetTitle(project, tab.selection, locale) : event?.name || (locale === "es" ? "Evento sin nombre" : "Untitled event");
                  return <div className="inspector-centered-tab-row" key={key} data-tab-key={key} draggable
                    onDragStart={drag => { drag.dataTransfer.setData("application/x-forge-inspector-tab", key); drag.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={drag => { if (drag.dataTransfer.types.includes("application/x-forge-inspector-tab")) { drag.preventDefault(); drag.dataTransfer.dropEffect = "move"; } }}
                    onDrop={drag => { drag.preventDefault(); moveTab(drag.dataTransfer.getData("application/x-forge-inspector-tab"), index); }}>
                    <button type="button" className="inspector-centered-tab-open-button" title={title} aria-label={title} aria-current={active ? "page" : undefined} onClick={() => { if (!active) tab ? toggleInspectorTab(tab.id) : event && toggleInspector(event.id); }}><TabIcon size={16} aria-hidden="true" /><span>{title}</span></button>
                    <button type="button" className="inspector-centered-tab-close-button" title={locale === "es" ? `Cerrar ${title}` : `Close ${title}`} aria-label={locale === "es" ? `Cerrar ${title}` : `Close ${title}`} draggable={false} onClick={closeEvent => { closeEvent.stopPropagation(); if (tab?.mode === "debug") onDisableInspectorDebug(); else if (tab) onCloseInspectorTab(tab.id); else if (event) closeInspector(event.id); }}><X size={14} aria-hidden="true" /></button>
                  </div>;
                })}
              </nav>
            </div>
          ) : null}
          <div className="unified-inspector-width-resize" onPointerDown={event=>{event.preventDefault();const x=event.clientX,width=dockRef.current?.getBoundingClientRect().width??inspectorSize.width;const move=(next:PointerEvent)=>onInspectorResize({...inspectorSize,width:Math.min(1100,Math.max(360,width+x-next.clientX))});const end=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",end,{once:true});}} />
          {hasInspectorTabs && !fullscreen && !(inspectorMaximized && hasExpandedInspector) ? renderInspectorWindowTools() : null}
          {hasInspectorTabs && !fullscreen && inspectorMaximized && hasExpandedInspector && toolbarHost ? createPortal(renderInspectorWindowTools(), toolbarHost) : null}
          {hasInspectorTabs && fullscreen ? renderInspectorWindowTools() : null}
          <div className="event-inspector-cards" role="list">
          {stack.map((target, index) => {
            if (target.kind === "inspector") {
            const tab = inspectorTabs.find(tab => tab.id === target.id)!;
            const expanded = expandedInspectorTabId === tab.id;
            if (fullscreen && !expanded) return null;
            const TabIcon = inspectorTabIcon(tab);
            return (
              <section
                className={`event-editor-panel event-inspector-card ${expanded ? "expanded" : "minimized"}`}
                key={tab.id}
                role="listitem"
                data-inspector-kind={tab.selection.type}
                data-active={expanded || undefined}
                data-tab-key={`inspector:${tab.id}`}
                style={{ order: stack.findIndex(target => target.kind === "inspector" && target.id === tab.id), "--stack-index": index + openEvents.length + 1, "--inspector-card-height": `${inspectorCardHeight(tab.id)}px` } as CSSProperties}
              >
                {expanded ? <div className="event-inspector-card-resize-border" onPointerDown={(event) => resizeInspectorCard(event, tab.id)} title="Drag top border to resize" /> : null}
                <div className="event-editor-header" onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a, [contenteditable='true'], .event-editor-actions")) return;
                  if (!fullscreen) toggleInspectorTab(tab.id);
                }}>
                  <div className="event-header-title event-inspector-node-title">
                    <button type="button" className={`event-minimized-title${tab.id.startsWith("routeGate:") ? " route-gate-titleless" : ""}`} title={tab.id.startsWith("routeGate:") ? undefined : tab.title} onClick={() => { if (!fullscreen) toggleInspectorTab(tab.id); }}>
                      <MinimizedInspectorTabTitle title={inspectorTargetTitle(project,tab.selection,locale)} kind={inspectorTargetKind(project,tab.selection,locale)} Icon={TabIcon} />
                    </button>
                    {expanded && tab.selection.type === "node" ? <NarrativeNameEditor project={project} nodeId={tab.selection.id} onMutation={onNameMutation}/> : null}
                  </div>
                  <div className="event-editor-actions">
                    {tab.mode !== "play" ? <button type="button" className="inspector-locate-button" title={ui("Locate on canvas")} aria-label={ui("Locate on canvas")} onClick={() => onLocateInspectorTab(tab.selection)}>
                      <Crosshair size={14} />
                    </button> : null}
                    <button type="button" title={expanded ? ui("Minimize inspector") : ui("Expand inspector")} onClick={() => toggleInspectorTab(tab.id)}>{expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button>
                    {tab.mode === "debug" ? (
                      <button type="button" title="Disable Inspector Debug" onClick={onDisableInspectorDebug}><Power size={14} /></button>
                    ) : <button type="button" title={ui("Close inspector")} onClick={() => onCloseInspectorTab(tab.id)} onContextMenu={(e) => openInspectorTabCloseMenu(e, tab.id)}><X size={14} /></button>}
                  </div>
                </div>
                {expanded ? <div className="event-inspector-body"><div className="event-inspector-body-scroll">{tab.mode === "debug" ? <DebugInspector project={project} nodes={nodes} selection={tab.selection} /> : isValidElement(children) && children.type !== Fragment ? cloneElement(children as ReactElement<{ selection?: Selection }>, { selection: tab.selection }) : children}</div></div> : null}
              </section>
            );
            }
            const event = openEvents.find(event => event.id === target.id)!;
            const isExpanded = eventInspector.expandedEventId === event.id;
            if (fullscreen && !isExpanded) return null;
            const isDraftEvent = eventDraft?.eventId === event.id;
            const cardEvent =
              isExpanded && isDraftEvent
                ? (eventDraft?.draftEvent ?? event)
                : event;
            const eventKind = inspectorTargetKind(project, { type: "node", id: cardEvent.id }, locale);
            return (
              <section
                className={`event-editor-panel event-inspector-card ${isExpanded ? "expanded" : "minimized"}`}
                aria-label={`${event.name} inspector`}
                key={event.id}
                role="listitem"
                data-inspector-kind="event"
                data-active={isExpanded || undefined}
                data-tab-key={`event:${event.id}`}
                style={{ order: stack.findIndex(target => target.kind === "event" && target.id === event.id), "--stack-index": index + inspectorTabs.length + 1, "--inspector-card-height": `${inspectorCardHeight(`event:${event.id}`)}px` } as CSSProperties}
              >
                {isExpanded ? <div className="event-inspector-card-resize-border" onPointerDown={(pointerEvent) => resizeInspectorCard(pointerEvent, `event:${event.id}`)} title="Drag top border to resize" /> : null}
                <div className="event-editor-header" onClick={(clickEvent) => {
                  if (clickEvent.target instanceof Element && clickEvent.target.closest("button, input, select, textarea, a, [contenteditable='true'], .event-editor-actions")) return;
                  if (!fullscreen) toggleInspector(event.id);
                }}>
                  {isExpanded ? (
                    <div className="event-header-title">
                      <strong title={cardEvent.name || "Untitled event"}>
                        <GitBranch
                          className="event-header-icon"
                          size={15}
                          aria-hidden="true"
                        />
                        <span className="event-header-copy event-header-inline">
                          <span className="event-header-name" title={cardEvent.name}>
                            {cardEvent.name || (locale === "es" ? "Evento sin nombre" : "Untitled event")}
                          </span>
                          <span className="event-header-separator" aria-hidden="true">·</span>
                          <span className="event-header-kind">{eventKind}</span>
                        </span>
                      </strong>
                      <NarrativeNameEditor project={project} nodeId={cardEvent.id} onMutation={onNameMutation}/>
                      </div>
                  ) : (
                    <button
                      type="button"
                      className="event-minimized-title"
                      onClick={() => toggleInspector(event.id)}
                      title={`Open ${event.name}`}
                    >
                      <EventInspectorTabHeader project={project} event={event} />
                    </button>
                  )}
                  <div className="event-editor-actions">
                    <button
                      type="button"
                      className="inspector-locate-button"
                      title={ui("Locate on canvas")}
                      aria-label={ui("Locate on canvas")}
                      onClick={() => onLocateInspectorTab({ type: "node", id: event.id })}
                    >
                      <Crosshair size={14} />
                    </button>
                    <button
                      type="button"
                      title={
                        isExpanded ? ui("Minimize inspector") : ui("Expand inspector")
                      }
                      onClick={() =>
                        isExpanded
                          ? minimizeInspector(event.id)
                          : toggleInspector(event.id)
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronUp size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      title={ui("Close inspector")}
                      onClick={() => closeInspector(event.id)}
                      onContextMenu={(contextEvent) =>
                        openTabCloseMenu(contextEvent, event.id)
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="event-inspector-body" aria-hidden={!isExpanded}>
                  {isExpanded ? (
                    <div className="event-inspector-body-scroll">
                      <div className="event-dock-inspector">{children}</div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
          {fullscreen && !eventInspector.expandedEventId && !expandedInspectorTabId ? <div className="inspector-centered-empty">{locale === "es" ? "Elige un inspector a la izquierda." : "Choose an inspector on the left."}</div> : null}
        </div>
      </div>
      </div>
      </InspectorIndexHost.Provider>
      {tabContextMenu ? (
        <div
          ref={tabContextMenuRef}
          className="canvas-menu tab-context-menu"
          style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
        >
          {tabContextMenu.kind === "event" ? <>
          <button
            type="button"
            onClick={() => {
              onCloseEventsAbove(tabContextMenu.eventId);
              setTabContextMenu(undefined);
            }}
          >
            Close tabs above
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseEventsBelow(tabContextMenu.eventId);
              setTabContextMenu(undefined);
            }}
          >
            Close tabs below
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseOtherEvents(tabContextMenu.eventId);
              setTabContextMenu(undefined);
            }}
          >
            Close other tabs
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseAllEvents();
              setTabContextMenu(undefined);
            }}
          >
            Close all tabs
          </button>
          </> : <>
          <button
            type="button"
            onClick={() => {
              onCloseInspectorTabsAbove(tabContextMenu.tabId);
              setTabContextMenu(undefined);
            }}
          >
            Close tabs above
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseInspectorTabsBelow(tabContextMenu.tabId);
              setTabContextMenu(undefined);
            }}
          >
            Close tabs below
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseOtherInspectorTabs(tabContextMenu.tabId);
              setTabContextMenu(undefined);
            }}
          >
            Close other tabs
          </button>
          <button
            type="button"
            onClick={() => {
              onCloseAllInspectorTabs();
              setTabContextMenu(undefined);
            }}
          >
            Close all inspector tabs
          </button>
          </>}
        </div>
      ) : null}
    </aside>
  );
}

function Inspector({
  project,
  localeNames,
  scope,
  propertiesConfig,
  nodes,
  edges,
  files,
  selection,
  findings,
  exportOpen,
  exportPreviewMode,
  canvasLayerMode,
  onCanvasLayerModeChange,
  requestedLogicTab,
  requestedSection,
  onSectionChange,
  onAuthoringMutation,
  onSelectAuthoringNode,
  onHighlightAuthoringNode,
  highlightedAuthoringNodeId,
  onOpenAuthoringSection,
  onOpenReference,
  embedded = false,
  manualDirty = false,
  onSaveManual,
  onExportPreviewModeChange,
  onClose,
  onUpdateSequence,
  onUpdateBranch,
  onCreateEventInBranch,
  onUpdateEvent,
  onApplyEvpath,
  onCreateDecision,
  onUpdateDecision,
  onUpdateDialogue,
  onUpdateDialogueBeat,
  onUpdateEventDialogueBeat,
  onImportSceneImage,
  onUpdateScriptBlock,
  onUpdateLocalizedText,
  onDeleteDialogueBeat,
  onDeleteEventDialogueBeat,
  onDeleteDecision,
  onDeleteDialogue,
  onCreateOutcome,
  onUpdateOutcome,
  onDeleteOutcome,
  onUpdateTransition,
  onDeleteTransition,
  onCreateScriptTransition,
  onCreateCanonSuggestion,
  onUpdateCanonSuggestion,
  onDeleteCanonSuggestion,
  onUpdateDataObject,
  onDeleteDataObject,
  onSelectCanon,
  onSelectSuggestion,
  onEditCanonRef,
  onCreateCanonWorkingCopy,
  onSaveCanonWorkingCopy,
  onExportCanonChangeSet,
  onApplyCanonWorkingCopy,
  onUpdateLocalExplorerEntity,
  onPublishLocalExplorerEntity,
  onUpdateLocalExplorerType,
  onUpdateLocalExplorerProperty,
  onUpdateLogicPropertyOverride,
  onUpdateLogicTypeOverride,
  onUpdateCharacterCategories,
  onUpdateEdgeLabel,
  onDeleteSelection,
  onOpenRule,
}: {
  project: BranchingProject;
  localeNames?: Record<string, string>;
  scope?: CanvasScope;
  propertiesConfig?: Record<string, unknown>;
  nodes: StoryCanvasNode[];
  edges: StoryCanvasEdge[];
  files: PathBranchingFileItem[];
  selection?: Selection;
  findings: ValidationFinding[];
  exportOpen: boolean;
  exportPreviewMode: ExportPreviewMode;
  canvasLayerMode: CanvasLayerMode;
  onCanvasLayerModeChange: (mode: CanvasLayerMode) => void;
  requestedLogicTab?: { selectionKey: string; part: "conditions" | "consequences" };
  requestedSection?: { selectionKey: string; section: string; focusId?: string; requestId?: number };
  onSectionChange?: (selectionKey: string, section: string) => void;
  onAuthoringMutation: (mutate: (current: BranchingProject) => BranchingProject) => void | Promise<void>;
  onSelectAuthoringNode: (nodeId: string) => void;
  onHighlightAuthoringNode?: (nodeId: string) => void;
  highlightedAuthoringNodeId?: string;
  onOpenAuthoringSection?: (nodeId: string, section: string) => void;
  onOpenReference?: (selection: Selection) => void;
  embedded?: boolean;
  manualDirty?: boolean;
  onSaveManual?: () => void;
  onExportPreviewModeChange: (mode: ExportPreviewMode) => void;
  onClose: () => void;
  onUpdateSequence: (id: string, updates: Partial<Sequence>) => void;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => void;
  onCreateEventInBranch: (branchId: string, type?: EventType) => void;
  onUpdateEvent: (id: string, updates: Partial<EventNode>) => void;
  onApplyEvpath: (eventId: string, text: string) => EvpathApplyOutcome;
  onCreateDecision: (eventId: string, dialogueId?: string) => void;
  onUpdateDecision: (
    eventId: string,
    decisionId: string,
    updates: Partial<Decision>,
  ) => void;
  onUpdateDialogue: (
    eventId: string,
    dialogueId: string,
    updates: Partial<DialogueNode>,
  ) => void;
  onUpdateDialogueBeat: (
    eventId: string,
    dialogueId: string,
    beatId: string,
    updates: Partial<DialogueBeat>,
  ) => void;
  onUpdateEventDialogueBeat: (eventId: string, beatId: string, updates: Partial<DialogueBeat>) => void;
  onImportSceneImage?: (eventId: string, dialogueId: string | undefined, beatId: string) => void;
  onUpdateScriptBlock: (
    scriptId: string,
    blockId: string,
    updates: Partial<ScriptBlock>,
  ) => void;
  onUpdateLocalizedText: (textKey: string, locale: string, value: string) => void;
  onDeleteDialogueBeat: (eventId: string, dialogueId: string, beatId: string) => void;
  onDeleteEventDialogueBeat: (eventId: string, beatId: string) => void;
  onDeleteDecision: (eventId: string, decisionId: string) => void;
  onDeleteDialogue: (eventId: string, dialogueId: string) => void;
  onCreateOutcome: (eventId: string, decisionId: string) => void;
  onUpdateOutcome: (
    eventId: string,
    decisionId: string,
    outcomeId: string,
    updates: Partial<Outcome>,
  ) => void;
  onDeleteOutcome: (
    eventId: string,
    decisionId: string,
    outcomeId: string,
  ) => void;
  onUpdateTransition: (
    transitionId: string,
    updates: Partial<Transition>,
  ) => void;
  onDeleteTransition: (transitionId: string) => void;
  onCreateScriptTransition?: (eventId: string, from: string, to: string) => void;
  onCreateCanonSuggestion: (
    canonRefId: string,
    source?: { eventId?: string; dataObjectId?: string },
  ) => void;
  onUpdateCanonSuggestion: (
    id: string,
    updates: Partial<CanonEditSuggestion>,
  ) => void;
  onDeleteCanonSuggestion: (id: string) => void;
  onUpdateDataObject: (id: string, updates: Partial<ProjectDataObject>) => void;
  onDeleteDataObject: (id: string) => void;
  onSelectCanon: (id: string) => void;
  onSelectSuggestion: (id: string) => void;
  onEditCanonRef: (ref: CanonRef) => void;
  onCreateCanonWorkingCopy: (ref: CanonRef) => void;
  onSaveCanonWorkingCopy: (canonRefId: string, content: string) => void;
  onExportCanonChangeSet: (canonRefId: string) => void;
  onApplyCanonWorkingCopy: (canonRefId: string) => void;
  onUpdateLocalExplorerEntity: (
    id: string,
    updates: Partial<LocalExplorerEntity>,
  ) => void;
  onPublishLocalExplorerEntity: (id: string) => void;
  onUpdateLocalExplorerType: (
    id: string,
    updates: Partial<LocalExplorerType>,
  ) => void;
  onUpdateLocalExplorerProperty: (
    id: string,
    updates: Partial<LocalExplorerProperty>,
  ) => void;
  onUpdateLogicPropertyOverride: (propertyId: string, source: "canon" | "local", changes: Partial<LogicPropertyOverride>) => void;
  onUpdateLogicTypeOverride: (typeId: string, source: "canon" | "local", changes: Partial<LogicTypeOverride>) => void;
  onUpdateCharacterCategories: (categories: string[]) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onDeleteSelection: (selection: Selection) => void;
  onOpenRule: (id: string) => void;
}) {
  const interfaceLocale = useInterfaceLocale();
  const c = inspectorUiCopy(interfaceLocale);
  const [routeGateRouteId, setRouteGateRouteId] = useState<string>();
  const [objectInspectorTab, setObjectInspectorTab] = useState("overview");
  const selectionKey = selection ? inspectorSelectionKey(selection) : "";
  const changeInspectorSection = (requestedSection: string) => {
    const modules = selection?.type === "node" ? narrativeInspectorModules(project, selection.id) : undefined;
    let section = requestedSection === "consequences" && !modules?.some(module => module.id === "consequences") ? "conditions" : requestedSection;
    if (modules && !modules.some(module => module.id === section)) {
      if (section === "choices") section = modules.find(module => module.id === "narrativeDecision")?.id ?? modules.find(module => module.id === "narrativeSequence")?.id ?? modules.find(module => module.id === "path")?.id ?? section;
      else if ((section === "conditions" || section === "interactions") && modules.some(module => module.id === "narrativeDecision")) section = "narrativeDecision";
    }
    setObjectInspectorTab(section);
    if (modules) {
      const preferences = resolveInspectorModulePreferences(modules, readInspectorModulePreferences(project.projectId, selectionKey));
      saveInspectorModulePreferences(project.projectId, selectionKey, { visible: [...new Set([...preferences.visible, section])], active: section });
    }
    if (selectionKey) onSectionChange?.(selectionKey, section);
  };
  const [inspectorLocale, setInspectorLocale] = useState(project.localizationCatalog?.primaryLocale ?? "und");
  const [metadataSectionCollapsed, setMetadataSectionCollapsed] = useState(true);
  const selectedNode = useMemo(() => {
    if (selection?.type !== "node") return undefined;
    const visible = nodes.find(node => node.id === selection.id);
    if (visible) return visible;
    if (selection.id.startsWith("route-gate:")) {
      const owner = project.events.filter(event=>selection.id.startsWith(`route-gate:${event.id}:`)).sort((a,b)=>b.id.length-a.id.length)[0];
      const sourceId = owner ? selection.id.slice(`route-gate:${owner.id}:`.length) : selection.id.slice("route-gate:".length);
      const event = owner ?? project.events.find(event=>event.transitions?.some(route=>route.from===sourceId));
      if (event?.transitions?.some(route=>route.from===sourceId)) return {id:selection.id,type:"story",position:{x:0,y:0},data:{kind:"routeGate",title:"Routes",storyObjectId:selection.id,badges:[],details:{eventId:event.id,routeSourceId:sourceId}}} as StoryCanvasNode;
    }
    for (const owner of project.events) {
      const ref = narrativeNodeReferences(project, owner.id).find(item => item.id === selection.id);
      if (!ref) continue;
      const decision = owner.decisions?.find(item => item.id === (ref.kind === "decision" ? ref.elementId : ref.decisionId));
      const kind = ref.kind === "speech" ? "speechBeat" : ref.kind === "direction" ? "directionBeat" : ref.kind;
      return { id:ref.id,type:"story",position:{x:0,y:0},data:{kind,title:ref.label,storyObjectId:ref.elementId,badges:[],details:{eventId:owner.id,dialogueId:ref.dialogueId,decision,decisionId:ref.decisionId,outcome:decision?.outcomes.find(item=>item.id===ref.elementId),dialogue:owner.dialogues?.find(item=>item.id===ref.elementId),beat:ref.beat}} } as StoryCanvasNode;
    }
    return undefined;
  }, [selection, nodes, project]);
  const selectedEdge = useMemo(() => {
    if (selection?.type !== "edge") return undefined;
    const visibleEdge = edges.find((edgeItem) => edgeItem.id === selection.id);
    if (visibleEdge) return visibleEdge;
    if (!selection.id.startsWith("edge:transition:")) return undefined;
    const transitionId = selection.id.slice("edge:transition:".length);
    const transition = project.events.flatMap(event => event.transitions ?? [])
      .find(item => item.id === transitionId);
    if (!transition) return undefined;
    return {
      id: selection.id,
      source: transition.from,
      target: transition.to,
      data: {
        kind: "transition",
        label: transition.label ?? "",
        routeRole: transition.role,
        conditions: transition.logic?.when ?? transition.conditions,
        consequences: transition.logic?.then ?? transition.consequences,
      },
    } as StoryCanvasEdge;
  }, [selection, edges, project]);
  const selectedRouteGateNode =
    selectedNode?.data.kind === "routeGate"
      ? selectedNode
      : selection?.type === "node"
        ? nodes.find((node) => node.id === selection.id && node.data.kind === "routeGate")
        : undefined;
  useEffect(() => {
    if (!requestedLogicTab || !selection) return;
    const selectionKey = inspectorSelectionKey(selection);
    if (selectionKey !== requestedLogicTab.selectionKey) return;
    const routeInspector = selection.type === "edge" || selectedNode?.data.kind === "routeGate";
    const hasConsequences = selection.type === "node" && narrativeInspectorModules(project, selection.id)?.some(module => module.id === "consequences");
    setObjectInspectorTab(requestedLogicTab.part === "consequences" && !hasConsequences ? routeInspector ? "connections" : "conditions" : requestedLogicTab.part);
  }, [requestedLogicTab, selection]);
  const selectedCanon =
    selection?.type === "canon"
      ? project.canonRefs.find((canonRef) => canonRef.id === selection.id)
      : undefined;
  const selectedFile =
    selection?.type === "file"
      ? files.find((file) => file.id === selection.id)
      : undefined;
  const selectedDataObject =
    selection?.type === "dataObject"
      ? project.projectDataObjects?.find(
          (dataObject) => dataObject.id === selection.id,
        )
      : undefined;
  const selectedSuggestion =
    selection?.type === "canonSuggestion"
      ? project.canonEditSuggestions?.find(
          (suggestion) => suggestion.id === selection.id,
        )
      : undefined;
  const selectedExplorerEntity =
    selection?.type === "explorerEntity"
      ? project.localExplorerEntities?.find(
          (entity) => entity.id === selection.id,
        )
      : undefined;
  const selectedExplorerSchemaSource =
    selection?.type === "explorerType" || selection?.type === "explorerProperty"
      ? selection.source
      : undefined;
  const selectedExplorerType =
    selection?.type === "explorerType"
      ? selection.source === "local"
        ? project.localExplorerTypes?.find((type) => type.id === selection.id)
        : canonExplorerTypes(propertiesConfig).find(
            (type) => type.id === selection.id,
          )
      : undefined;
  const selectedExplorerProperty =
    selection?.type === "explorerProperty"
      ? selection.source === "local"
        ? findLocalExplorerPropertyInTree(project.localExplorerProperties, selection.id)
        : [
            ...canonExplorerTypes(propertiesConfig).map(canonExplorerTypeProperty),
            ...flattenCanonExplorerProperties(canonExplorerProperties(propertiesConfig)),
          ].find((property) => property.id === selection.id)
      : undefined;
  const selectedExplorerPropertyIsSubproperty = Boolean(selection?.type === "explorerProperty"
    && selection.source === "local"
    && isLocalExplorerSubproperty(project.localExplorerProperties, selection.id));
  const characterMappingId = "pathbranching:additional-characters";
  const additionalCharacterCategories = project.integrationConfigOverride?.mappings
    .find((mapping) => mapping.id === characterMappingId)?.worldnotionTypes ?? [];
  const canonCategories = Array.from(new Set(project.canonRefs
    .map((ref) => ref.kind)
    .filter((kind): kind is string => Boolean(kind)))).sort();
  const defaultCharacterCategories = mergeIntegrationConfigs(project.integrationConfig, {
    specVersion: "0.1",
    mappings: (project.integrationConfigOverride?.mappings ?? [])
      .filter((mapping) => mapping.id !== characterMappingId),
  }).mappings
    .filter((mapping) => mapping.roles.includes("speaker"))
    .flatMap((mapping) => mapping.worldnotionTypes);

  const sequence =
    selection?.type === "node"
      ? findSequence(project, selection.id)
      : undefined;
  const branch =
    selection?.type === "node" ? findBranch(project, selection.id) : undefined;
  const event =
    selection?.type === "node" ? findEvent(project, selection.id) : undefined;
  const selectedDecisionContext =
    selectedNode?.data.kind === "decision" &&
    typeof selectedNode.data.details?.eventId === "string"
      ? (() => {
          const eventId = selectedNode.data.details!.eventId as string;
          const details = selectedNode.data.details ?? {};
          const decisionId = String((details.decision as { id?: string } | undefined)?.id ?? details.decisionId ?? "")
            .replace(`decision:${eventId}:`, "");
          return { eventId, decision: findEvent(project, eventId)?.decisions?.find(item => item.id === decisionId) };
        })()
      : undefined;
  const selectedDialogueContext =
    selectedNode?.data.kind === "dialogue" &&
    typeof selectedNode.data.details?.eventId === "string"
      ? {
          eventId: selectedNode.data.details.eventId,
          dialogue: findEvent(
            project,
            selectedNode.data.details.eventId,
          )?.dialogues?.find(
            (dialogue) =>
              dialogue.id ===
              (
                selectedNode.data.details?.dialogue as
                  { id?: string } | undefined
              )?.id,
          ),
        }
      : undefined;
  const selectedDialogueStartContext =
    selectedNode?.data.kind === "dialogueStart" &&
    typeof selectedNode.data.details?.eventId === "string"
      ? {
          eventId: selectedNode.data.details.eventId,
          start: selectedNode.data.details.start as DialogueStart | undefined,
        }
      : undefined;
  const selectedOutcomeContext =
    selectedNode?.data.kind === "outcome" &&
    typeof selectedNode.data.details?.eventId === "string"
      ? {
          eventId: selectedNode.data.details.eventId,
          decisionId: String(
            selectedNode.data.details.decisionId ?? "",
          ).replace(`decision:${selectedNode.data.details.eventId}:`, ""),
          outcome: selectedNode.data.details.outcome as Outcome | undefined,
        }
      : undefined;
  const selectedMissingRefContext =
    selectedNode?.data.kind === "missingRef" &&
    typeof selectedNode.data.details?.ownerId === "string" &&
    typeof selectedNode.data.details?.missingEventId === "string"
      ? {
          ownerId: selectedNode.data.details.ownerId,
          missingEventId: selectedNode.data.details.missingEventId,
        }
      : undefined;
  const selectedTransitionId = selectedEdge?.id.startsWith("edge:transition:")
    ? selectedEdge.id.replace("edge:transition:", "")
    : undefined;
  const selectedTransition = selectedTransitionId
    ? project.events
        .flatMap((eventNode) => eventNode.transitions ?? [])
        .find((transition) => transition.id === selectedTransitionId)
    : undefined;
  const selectedTransitionOwner = selectedTransition
    ? project.events.find((eventNode) =>
        eventNode.transitions?.some(
          (transition) => transition.id === selectedTransition.id,
        ),
      )
    : undefined;
  const selectedRouteGateSourceId =
    selectedRouteGateNode?.data.kind === "routeGate" && typeof selectedRouteGateNode.data.details?.routeSourceId === "string"
      ? selectedRouteGateNode.data.details.routeSourceId
      : undefined;
  const selectedRouteGateContext =
    selectedRouteGateSourceId
      ? (() => {
          const sourceId = selectedRouteGateSourceId;
          const eventId = typeof selectedRouteGateNode?.data.details?.eventId === "string"
            ? selectedRouteGateNode.data.details.eventId
            : project.events.find((eventNode) =>
                eventNode.transitions?.some((transition) => transition.from === sourceId),
              )?.id;
          const routes = project.events.filter(event=>!eventId || event.id===eventId)
            .flatMap((eventNode) => eventNode.transitions ?? [])
            .filter((transition) => transition.from === sourceId)
            .sort((left, right) => {
              if (left.mode === "fallback" && right.mode !== "fallback") return 1;
              if (right.mode === "fallback" && left.mode !== "fallback") return -1;
              return (left.order ?? 0) - (right.order ?? 0);
            });
          return { sourceId, eventId, routes };
        })()
      : undefined;
  const selectedRouteGateRoute = selectedRouteGateContext?.routes.find(
    (route) => route.id === (routeGateRouteId ?? selectedTransition?.id),
  ) ?? selectedRouteGateContext?.routes[0];
  const selectedRouteGateRouteIds = selectedRouteGateContext?.routes
    .map((route) => route.id)
    .join("|") ?? "";
  const selectedTransitionTarget = selectedTransition
    ? findEvent(project, selectedTransition.to)
    : undefined;
  const selectedTransitionOutput =
    selectedTransitionOwner && selectedTransition
      ? selectedTransition.from === selectedTransitionOwner.id
        ? "Event output"
        : selectedTransitionOwner.decisions
            ?.flatMap((decision) =>
              decision.outcomes.map((outcome) => ({
                id: `outcome:${selectedTransitionOwner.id}:${decision.id}:${outcome.id}`,
                label: `${decision.name} → ${outcome.name}`,
              })),
            )
            .find((outcome) => outcome.id === selectedTransition.from)?.label ??
          "Nested output"
      : undefined;
  useEffect(() => {
    if (!selectedRouteGateContext?.routes.length) {
      setRouteGateRouteId(undefined);
      return;
    }
    const requestedRouteId = requestedSection?.selectionKey === selectionKey && requestedSection.focusId
      ? requestedSection.focusId
      : undefined;
    const preferredRouteId = requestedRouteId ?? routeGateRouteId ?? selectedTransition?.id;
    if (!selectedRouteGateContext.routes.some((route) => route.id === preferredRouteId)) {
      setRouteGateRouteId(selectedRouteGateContext.routes[0].id);
      return;
    }
    if (routeGateRouteId !== preferredRouteId) {
      setRouteGateRouteId(preferredRouteId);
    }
  }, [routeGateRouteId, requestedSection?.focusId, requestedSection?.requestId, requestedSection?.selectionKey, selectionKey, selectedRouteGateContext?.sourceId, selectedRouteGateRouteIds, selectedTransition?.id]);
  useEffect(() => {
    if (selection?.type === "edge" && selectedTransition && selectedRouteGateContext) {
      setRouteGateRouteId(selectedTransition.id);
    }
  }, [selection?.id, selection?.type, selectedRouteGateContext?.sourceId, selectedTransition?.id]);
  useEffect(() => {
    const isBeat = selectedNode?.data.kind === "speechBeat" || selectedNode?.data.kind === "directionBeat";
    const modules = selection?.type === "node" ? narrativeInspectorModules(project, selection.id) : undefined;
    const saved = modules ? readInspectorModulePreferences(project.projectId, selectionKey)?.active : undefined;
    const matchingRequest = requestedSection?.selectionKey === selectionKey ? requestedSection : undefined;
    const requested = matchingRequest?.requestId ? matchingRequest.section : saved ?? matchingRequest?.section;
    let part = requested === "write" ? "path" : requested === "logic" ? "conditions" : requested === "consequences" && !modules?.some(module => module.id === "consequences") ? "conditions" : requested;
    if (isBeat && (!part || part === "overview" || part === "path")) part = "content";
    if (selectedNode?.data.kind === "dialogue" && (part === "path" || part === "content")) part = "narrativeSequence";
    if (selectedNode?.data.kind === "decision" && (part === "path" || part === "content" || part === "choices" || part === "overview")) part = "narrativeDecision";
    if (selectedNode?.data.kind === "decision" && part === "conditions") part = "narrativeDecision";
    if (selectedNode?.data.kind === "decision" && part === "interactions") part = "narrativeDecision";
    if (selectedNode?.data.kind === "event" && part === "choices") part = "path";
    if (selectedNode?.data.kind === "dialogue" && part === "choices") part = "narrativeSequence";
    if (selectedNode?.data.kind === "outcome" && (!part || ["overview", "path", "choices", "narrativeDecision", "decisionSettings"].includes(part))) part = "content";
    if (selection?.type === "entityInstance" && (!part || part === "overview")) part = "copies";
    const kind = selectedNode?.data.kind ?? (event ? "event" : undefined);
    const allowed = modules ? modules.map(module => module.id) : selection?.type === "edge" || kind === "routeGate" ? ["connections","conditions","interactions"]
      : selection?.type === "narrativeAction" || selection?.type === "narrativeRule" ? ["overview","conditions","connections"]
      : selection?.type === "entityInstance" ? ["copies","connections"]
      : selection?.type === "canon" || selection?.type === "explorerEntity" ? ["overview","uses","copies","connections"]
      : isBeat ? ["content","consequences","connections","conditions"]
      : kind === "outcome" ? ["content","conditions","consequences","interactions","connections"]
      : kind === "decision" ? ["decisionSettings","narrativeDecision","connections"]
      : kind === "dialogue" ? ["overview","consequences","narrativeSequence","connections","conditions"]
      : kind === "event" ? ["overview","path","connections","conditions"] : ["overview"];
    if (part === "route") part = "connections";
    if (!part || !allowed.includes(part)) part=allowed[0];
    setObjectInspectorTab(part);
    if (modules) {
      const preferences = resolveInspectorModulePreferences(modules, readInspectorModulePreferences(project.projectId, selectionKey));
      saveInspectorModulePreferences(project.projectId, selectionKey, { visible: [...new Set([...preferences.visible, part])], active: part });
    }
  }, [project.projectId, selectionKey, selectedNode?.data.kind, event?.id, requestedSection?.selectionKey, requestedSection?.section, requestedSection?.requestId]);
  const selectedDialogueBeatContext =
    (selectedNode?.data.kind === "speechBeat" || selectedNode?.data.kind === "directionBeat") &&
    typeof selectedNode.data.details?.eventId === "string"
      ? (() => {
          const eventId = selectedNode.data.details!.eventId as string;
          const dialogueId = typeof selectedNode.data.details!.dialogueId === "string"
            ? selectedNode.data.details!.dialogueId as string
            : undefined;
          const beatId = (selectedNode.data.details?.beat as { id?: string } | undefined)?.id;
          const event = findEvent(project, eventId);
          const dialogue = dialogueId ? event?.dialogues?.find((item) => item.id === dialogueId) : undefined;
          const beat = dialogueId
            ? dialogue?.beats?.find((item) => item.id === beatId)
            : event?.dialogueBeats?.find((item) => item.id === beatId);
          const block = beat
            ? project.scriptDocuments
                ?.find((script) => script.id === beat.blockRef.scriptId)
                ?.blocks.find((item) => item.id === beat.blockRef.blockId)
            : undefined;
          return beat && block ? { eventId, dialogueId, beat, block } : undefined;
        })()
      : undefined;
  const isParentCanvas = scope?.kind !== "event";
  const selectedDataClass = selectedDataObject
    ? project.dataClasses?.find(
        (dataClass) => dataClass.id === selectedDataObject.classId,
      )
    : undefined;
  const canonRefIds = project.canonRefs
    .filter((canonRef) => canonRefHasRole(project, canonRef, "condition"))
    .map((canonRef) => canonRef.id);
  const eventCategories = project.eventCategories ?? [];
  const dataObjects = project.projectDataObjects ?? [];
  const grantableOptionsList = grantableEntities(project);
  const locationOptionsList = locationEntities(project);
  const eventSequence = event ? findSequence(project, event.id) : undefined;
  const eventBranches = eventSequence
    ? branchesForSequence(project, eventSequence.id)
    : project.branches;
  const selectedBeatEvent = selectedDialogueBeatContext
    ? findEvent(project, selectedDialogueBeatContext.eventId)
    : undefined;
  const selectedBeatImageAssets = selectedDialogueBeatContext
    ? imageAssetsForLocation(
        project,
        selectedDialogueBeatContext.beat.locationRef ?? selectedBeatEvent?.locationRef,
      )
    : [];
  const updateSelectedDialogueBeat = (updates: Partial<DialogueBeat>) => {
    if (!selectedDialogueBeatContext) return;
    const { eventId, dialogueId, beat } = selectedDialogueBeatContext;
    if (dialogueId) onUpdateDialogueBeat(eventId, dialogueId, beat.id, updates);
    else onUpdateEventDialogueBeat(eventId, beat.id, updates);
  };
  const selectedBeatPresentEntityRefs = selectedBeatEvent?.presentEntityRefs ?? selectedBeatEvent?.canonRefs ?? [];
  const selectedDialogueEvent = selectedDialogueContext
    ? findEvent(project, selectedDialogueContext.eventId)
    : undefined;
  const selectedDialogueSequence = selectedDialogueEvent
    ? project.sequences.find((candidate) => candidate.eventIds.includes(selectedDialogueEvent.id))
    : undefined;
  const selectedTriggerEvent = selectedDialogueStartContext
    ? findEvent(project, selectedDialogueStartContext.eventId)
    : undefined;
  const presentEntityIds = selectedTriggerEvent?.presentEntityRefs ?? selectedTriggerEvent?.canonRefs ?? [];
  const presentEntities = presentEntityIds
    .map((id) => project.canonRefs.find((ref) => ref.id === id))
    .filter((ref): ref is CanonRef => Boolean(ref));
  const triggerSource = selectedDialogueStartContext?.start?.source;
  const selectedTriggerEntity = triggerSource?.kind === "canonRef"
    ? presentEntities.find((ref) => ref.id === triggerSource.id)
    : undefined;
  const selectedCanonImages = selectedCanon
    ? canonImagePropertiesForRef(propertiesConfig, selectedCanon)
    : [];
  const outgoingTransitions = event?.transitions ?? [];
  const inspectorIdentity = (() => {
    if (event)
      return {
        label: event.name ?? "Untitled event",
        kind: "Event",
        Icon: GitBranch,
      };
    if (selectedDecisionContext?.decision)
      return {
        label: selectedDecisionContext.decision.name ?? "Untitled decision",
        kind: "Decisions",
        Icon: Split,
      };
    if (selectedDialogueBeatContext)
      return {
        label: selectedDialogueBeatContext.block.content || (selectedDialogueBeatContext.beat.kind === "speech" ? "Dialogue" : "Stage direction"),
        kind: selectedDialogueBeatContext.beat.kind === "speech" ? "Dialogue" : "Stage direction",
        Icon: MessageSquare,
      };
    if (selectedDialogueContext?.dialogue)
      return {
        label:
          selectedDialogueContext.dialogue.title ||
          selectedDialogueContext.dialogue.text.content ||
          "Untitled conversation",
        kind: "Conversation",
        Icon: MessageSquare,
      };
    if (selectedOutcomeContext?.outcome)
      return {
        label: selectedOutcomeContext.outcome.name ?? "Untitled option",
        kind: "Option",
        Icon: Split,
      };
    if (selectedRouteGateContext)
      return {
        label: "Conditions",
        kind: selectedRouteGateContext.routes.length ? `${selectedRouteGateContext.routes.length} routes` : "No routes yet",
        Icon: GitBranch,
      };
    if (selectedTransition)
      return {
        label: isParentCanvas
          ? "Connection"
          : selectedTransition.label ?? "Untitled transition",
        kind: isParentCanvas ? "Canvas connector" : "Transition",
        Icon: GitBranch,
      };
    if (selectedCanon)
      return {
        label: selectedCanon.label ?? selectedCanon.id,
        kind: `Canon · ${selectedCanon.kind ?? "Entity"}`,
        Icon: FilePlus2,
      };
    if (selectedExplorerEntity)
      return {
        label: selectedExplorerEntity.name,
        kind: `Local · ${selectedExplorerEntity.type}`,
        Icon: FilePlus2,
      };
    if (selectedExplorerType)
      return {
        label: selectedExplorerType.label,
        kind:
          selectedExplorerSchemaSource === "canon"
            ? "Canon type"
            : "Local type",
        Icon: CircleDot,
      };
    if (selectedExplorerProperty)
      return {
        label: selectedExplorerProperty.label,
        kind:
          selectedExplorerSchemaSource === "canon"
            ? "Canon property"
            : "Local property",
        Icon: Boxes,
      };
    if (selectedDataObject)
      return {
        label: selectedDataObject.name ?? selectedDataObject.id,
        kind: `Project Data · ${selectedDataObject.classId}`,
        Icon: Database,
      };
    if (sequence)
      return { label: sequence.name, kind: "Sequence", Icon: GitBranch };
    if (branch) return { label: branch.title, kind: "Branch", Icon: GitBranch };
    return { label: "Inspector", kind: "Project", Icon: Database };
  })();
  const InspectorIdentityIcon = inspectorIdentity.Icon;
  const narrativeIdentityKind = selection?.type === "node" ? inspectorTargetKind(project, selection, interfaceLocale) : undefined;
  const interactionSelection = selection?.type === 'node' && /^(interaction|barrier):/.test(selection.id) ? inspectorDocumentIndex(project).node(selection.id) : undefined;
  const authoringEventId = interactionSelection?.eventId ?? (['interaction','barrier'].includes(selectedNode?.data.kind ?? '') && typeof selectedNode?.data.details?.eventId === 'string' ? selectedNode.data.details.eventId : undefined) ?? event?.id ?? selectedDecisionContext?.eventId ?? selectedDialogueBeatContext?.eventId ?? selectedDialogueContext?.eventId ?? selectedOutcomeContext?.eventId;
  const authoringDialogueId = selectedDialogueContext?.dialogue?.id ?? selectedDialogueBeatContext?.dialogueId ?? selectedDecisionContext?.decision?.dialogueId ?? (selectedOutcomeContext ? project.events.find(event => event.id === selectedOutcomeContext.eventId)?.decisions?.find(decision => decision.id === selectedOutcomeContext.decisionId)?.dialogueId : undefined);


  return (
    <aside className={`canvas-inspector ${embedded ? "embedded" : ""}`}>
      {!embedded && !selectedRouteGateContext ? (
        <div className="inspector-header inspector-object-header">
          <div className="inspector-object-identity">
            <span className="inspector-object-icon" aria-hidden="true">
              <InspectorIdentityIcon size={16} />
            </span>
            <div>
              <strong title={inspectorIdentity.label}>
                <span className="inspector-identity-name">{inspectorIdentity.label}</span>
                {narrativeIdentityKind ? <><span className="inspector-identity-separator" aria-hidden="true"> · </span><span className="inspector-identity-kind">{narrativeIdentityKind}</span></> : null}
                {manualDirty ? (
                  <span
                    className="inspector-dirty-star"
                    title="Unsaved inspector changes"
                    aria-label="Unsaved inspector changes"
                  >
                    *
                  </span>
                ) : null}
              </strong>
              {!narrativeIdentityKind ? <span>{({ Event: "Evento", Decision: "Decisiones", Decisions: "Decisiones", Conversation: "Conversación", Dialogue: "Diálogo", "Stage direction": "Acotación", Option: "Opción" } as Record<string, string>)[interfaceLocale === "es" ? inspectorIdentity.kind : ""] ?? inspectorIdentity.kind}</span> : null}
            </div>
          </div>
          {onSaveManual ? (
            <button
              type="button"
              className="inspector-save-button"
              title="Save inspector changes (Ctrl+S)"
              onClick={onSaveManual}
              disabled={!manualDirty}
            >
              Save
            </button>
          ) : null}
          <button type="button" title="Close inspector" onClick={onClose}>
            x
          </button>
        </div>
      ) : null}

      {embedded && onSaveManual ? <div className="inspector-manual-save">
        <span role="status">{manualDirty ? (interfaceLocale === "es" ? "Cambios pendientes" : "Unsaved inspector changes") : (interfaceLocale === "es" ? "Guardado" : "Saved")}</span>
        <button type="button" className="inspector-save-button" title={interfaceLocale === "es" ? "Guardar cambios del inspector (Ctrl+S)" : "Save inspector changes (Ctrl+S)"} onClick={onSaveManual} disabled={!manualDirty}>{interfaceLocale === "es" ? "Guardar" : "Save"}</button>
      </div> : null}
      <div className="inspector-fixed-navigation">
        {interactionSelection ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: 'overview', label: interfaceLocale === 'es' ? 'Interacción' : 'Interaction' }, ...(selection?.type === 'node' && selection.id.startsWith('interaction:') ? [{ id: 'consequences', label: interfaceLocale === 'es' ? 'Consecuencias' : 'Consequences' }] : []), { id: 'connections', label: interfaceLocale === 'es' ? 'Conexiones' : 'Connections' }]} /> : null}
        {selection?.type === "narrativeAction" || selection?.type === "narrativeRule" ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "overview", label: "Overview" }, { id: "conditions", label: "Conditions" }, { id: "connections", label: "Connections" }]} /> : null}
        {selection?.type === "entityInstance" ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab === "overview" ? "copies" : objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "copies", label: interfaceLocale === "es" ? "Copia" : "Copy" }, { id: "connections", label: "Connections" }]} /> : null}
        {selectedCanon || selectedExplorerEntity ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "overview", label: "Overview" }, { id: "uses", label: interfaceLocale === "es" ? "Usos en la historia" : "Uses in story" }, { id: "copies", label: interfaceLocale === "es" ? "Copias" : "Copies" }, { id: "connections", label: "Connections" }]} /> : null}
        {event ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "overview", label: "Event" }, { id: "path", label: "Conversation" }, { id: "connections", label: "Connections" }, { id: "conditions", label: "Conditions" }]} /> : null}
        {selectedDecisionContext?.decision ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "decisionSettings", label: "Decisions" }, { id: "narrativeDecision", label: "Options" }, { id: "connections", label: "Connections" }]} /> : null}
        {selectedOutcomeContext?.outcome ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{id:'content',label:'Option'},{id:'conditions',label:'Conditions'},{id:'consequences',label:'Consequences'},{id:'interactions',label:'Interaction'},{id:'connections',label:'Connections'}]} /> : null}
        {selectedDialogueBeatContext ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "content", label: "Content" }, { id: "connections", label: "Connections" }, { id: "conditions", label: "Conditions" }]} /> : null}
        {selectedDialogueContext?.dialogue ? <InspectorContentTabs project={project} selection={selection} value={objectInspectorTab} onChange={changeInspectorSection} tabs={[{ id: "overview", label: "Overview" }, { id: "narrativeSequence", label: "Conversation" }, { id: "connections", label: "Connections" }, { id: "conditions", label: "Conditions" }]} /> : null}
      </div>
      <div className="inspector-scroll">
        {interactionSelection && selection?.type === 'node' && objectInspectorTab === 'connections' ? <RouteInspector project={project} eventId={interactionSelection.eventId} sourceId={selection.id} section={objectInspectorTab} onSectionChange={changeInspectorSection} onMutation={onAuthoringMutation} onOpen={(id, section) => onOpenAuthoringSection?.(id, section ?? 'overview')} /> : null}

        {selection?.type === "narrativeAction" || selection?.type === "narrativeRule" ? <>
          <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} />
        </> : null}
        {selection?.type === "entityInstance" ? <>

          <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} />
        </> : null}
        {selectedCanon || selectedExplorerEntity ? <>

          {objectInspectorTab !== "overview" ? <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} /> : null}
        </> : null}

        {sequence ? (
          <section className="inspector-section">
            <h2>Sequence</h2>
            <label className="field-label">
              Name
              <input
                value={sequence.name}
                onChange={(event) =>
                  onUpdateSequence(sequence.id, { name: event.target.value })
                }
              />
            </label>
            <label className="field-label">
              Entry Event
              <select
                value={sequence.entryEventId}
                onChange={(event) =>
                  onUpdateSequence(sequence.id, {
                    entryEventId: event.target.value,
                  })
                }
              >
                {sequence.eventIds.map((eventId) => (
                  <option key={eventId} value={eventId}>
                    {findEvent(project, eventId)?.name ?? eventId}
                  </option>
                ))}
              </select>
            </label>
            <dl>
              <div>
                <dt>ID</dt>
                <dd>{sequence.id}</dd>
              </div>
              <div>
                <dt>Events</dt>
                <dd>{sequence.eventIds.length}</dd>
              </div>
              <div>
                <dt>Branches</dt>
                <dd>{sequence.branchIds?.length ?? 0}</dd>
              </div>
            </dl>
            <div className="inspector-actions">
              <button
                type="button"
                className="danger"
                onClick={() =>
                  onDeleteSelection({ type: "node", id: sequence.id })
                }
              >
                Delete
              </button>
            </div>
          </section>
        ) : null}

        {sequence ? (
          <>
            <BasicConditionEditor
              project={project}
              context={{ sequenceId: sequence.id, nodeId: sequence.id, contextEntityIds: sequence.characterRefs ?? (sequence.characterRef ? [sequence.characterRef] : []) }}
              value={sequence.availability}
              canonRefs={canonRefIds}
              dataObjects={dataObjects}
              grantableOptions={grantableOptionsList}
              onChange={(availability) =>
                onUpdateSequence(sequence.id, { availability })
              }
            />
            <ConsequenceEditor project={project} value={sequence.consequences} grantableOptions={grantableOptionsList} onChange={(consequences) => onUpdateSequence(sequence.id, { consequences })} />
            <LogicSection
              availability={sequence.availability}
              consequences={sequence.consequences}
            />
          </>
        ) : null}

        {branch ? (
          <>
            <section className="inspector-section">
              <h2>Branch</h2>
              <label className="field-label">
                Title
                <input
                  value={branch.title}
                  onChange={(event) =>
                    onUpdateBranch(branch.id, { title: event.target.value })
                  }
                />
              </label>
              <label className="field-label">
                Description
                <textarea
                  value={branch.description ?? ""}
                  rows={3}
                  onChange={(event) =>
                    onUpdateBranch(branch.id, {
                      description: event.target.value || undefined,
                    })
                  }
                />
              </label>
              <dl>
                <div>
                  <dt>ID</dt>
                  <dd>{branch.id}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{branch.eventIds.length}</dd>
                </div>
              </dl>
              <div className="inspector-actions">
                <button
                  type="button"
                  onClick={() => onCreateEventInBranch(branch.id)}
                >
                  New Event Inside
                </button>
                <button
                  type="button"
                  onClick={() => onCreateEventInBranch(branch.id, "final")}
                >
                  New Final Inside
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    onDeleteSelection({ type: "node", id: branch.id })
                  }
                >
                  Delete
                </button>
              </div>
            </section>
            <BasicConditionEditor
              project={project}
              context={{ nodeId: branch.id, contextEntityIds: project.sequences.filter(item => item.branchIds?.includes(branch.id)).flatMap(item => item.characterRefs ?? (item.characterRef ? [item.characterRef] : [])) }}
              value={branch.availability}
              canonRefs={canonRefIds}
              dataObjects={dataObjects}
              grantableOptions={grantableOptionsList}
              onChange={(availability) =>
                onUpdateBranch(branch.id, { availability })
              }
            />
            <ConsequenceEditor project={project} value={branch.consequences} grantableOptions={grantableOptionsList} onChange={(consequences) => onUpdateBranch(branch.id, { consequences })} />
            <LogicSection
              availability={branch.availability}
              consequences={branch.consequences}
            />
          </>
        ) : null}

        {event ? (
          <>

            {objectInspectorTab === "overview" ? <>
            <section className="inspector-section inspector-overview">
              <div className="inspector-event-hero">
                <div className="inspector-event-cover">

                <InspectorSelect presentation="cover" label={c.cover} icon={<ImagePlus size={16} aria-hidden="true" />}
                  value={event.coverImage?.assetId ?? ""}
                  options={[
                    { value: "", label: c.noCover, icon: <X size={16} aria-hidden="true" />, menuLabel: event.coverImage ? (interfaceLocale === "es" ? "Quitar portada" : "Remove cover") : c.noCover },
                    ...(project.assets ?? []).filter(asset => asset.kind === "image").map(asset => ({ value: asset.id, label: asset.name, imageUrl: universeAssetUrl(project, asset.path) })),
                  ]}
                  onChange={assetId => onUpdateEvent(event.id, { coverImage: assetId
                    ? { id: event.coverImage?.id ?? `event-cover:${crypto.randomUUID()}`, assetId }
                    : undefined })} />
                </div>
                <div className="inspector-event-details">
                  <div className="inspector-event-description">
                    <h2 className="inspector-group-title">{c.description}</h2>
                    <AuthoringTextField projectId={project.projectId} elementId={event.id} field="description" label={c.description}
                      value={event.description ?? ""} multiline rows={4}
                      placeholder={interfaceLocale === "es" ? "¿Qué ocurre en este evento?" : "What happens in this event?"}
                      onCommit={description => onUpdateEvent(event.id, { description: description || undefined })} />
                  </div>
                  <div className="inspector-event-metadata">
                <InspectorSelect label={c.category} icon={<Tag size={16} aria-hidden="true" />} value={event.type}
                  options={eventCategories.map(category => ({ value: category.id, label: category.label, detail: category.terminal ? (interfaceLocale === "es" ? "Evento terminal" : "Terminal event") : undefined }))}
                  onChange={type => onUpdateEvent(event.id, { type })} />
                <InspectorSelect label={interfaceLocale === "es" ? "Rama de la historia" : "Story branch"} icon={<GitBranch size={16} aria-hidden="true" />}
                  value={event.branchRef ?? ""}
                  options={[{ value: "", label: interfaceLocale === "es" ? "Sin rama" : "No branch" }, ...eventBranches.map(branch => ({ value: branch.id, label: branch.title }))]}
                  onChange={branchRef => onUpdateEvent(event.id, { branchRef: branchRef || null })} />
                  </div>
                </div>
              </div>
              <EventInspectorStatistics event={event} />
            </section>
            </> : null}
            {objectInspectorTab === "connections" ? <div className="inspector-connections">
              <section className="inspector-connection-group" aria-label={interfaceLocale === "es" ? "Recorrido" : "Story flow"}>
                <h2>{interfaceLocale === "es" ? "Recorrido" : "Story flow"}</h2>
              <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} />
              </section>
              <section className="inspector-connection-group" aria-label={interfaceLocale === "es" ? "Vínculos con el mundo" : "World links"}>
                <h2>{interfaceLocale === "es" ? "Vínculos con el mundo" : "World links"}</h2>
                <InspectorWorldLinks grouped title={interfaceLocale === "es" ? "Elementos presentes" : "Present elements"}
                  value={event.presentEntityRefs ?? event.canonRefs}
                  canonRefs={project.canonRefs} propertiesConfig={propertiesConfig} onSelect={onSelectCanon}
                  availableRefs={project.canonRefs.filter(canonRef => canonRefIsEntityPresentable(project, propertiesConfig, canonRef))}
                  onChange={(presentEntityRefs) => onUpdateEvent(event.id, { presentEntityRefs: presentEntityRefs ?? [] })} />
                <InspectorWorldLinks title={interfaceLocale === "es" ? "Referencias del mundo" : "World references"}
                  value={event.canonRefs} canonRefs={project.canonRefs}
                  propertiesConfig={propertiesConfig} onSelect={onSelectCanon}
                  onChange={(canonRefs) => onUpdateEvent(event.id, { canonRefs })} />
              </section>

            </div> : null}

            {["path", "narrativeDecision", "choices", "conditions"].includes(objectInspectorTab) ? <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} navigationRequest={requestedSection?.selectionKey === selectionKey ? requestedSection : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} /> : null}
          </>
        ) : null}

        {selectedDecisionContext?.decision || selectedOutcomeContext?.outcome ? <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab === "overview" ? selectedNode?.data.kind === "outcome" ? "content" : "narrativeDecision" : objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} navigationRequest={requestedSection?.selectionKey === selectionKey ? requestedSection : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} /> : null}

        {selectedDialogueBeatContext ? (
          <>

            {objectInspectorTab === "content" ? (
            <section className="inspector-section">
              <ConversationEditor key={JSON.stringify([project.projectId, selectedDialogueBeatContext.eventId, selectedDialogueBeatContext.dialogueId, selectedDialogueBeatContext.beat.id])} focusedLine project={project} eventId={selectedDialogueBeatContext.eventId} dialogueId={selectedDialogueBeatContext.dialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} propertiesConfig={propertiesConfig} onMutation={onAuthoringMutation} onHighlight={onHighlightAuthoringNode ?? onSelectAuthoringNode} onOpenSection={onOpenAuthoringSection} />
              {selectedDialogueBeatContext.beat.kind === "speech" ? (
                <label className="field-label dialogue-beat-director-note">
                  {interfaceLocale === "es" ? "Nota de dirección" : "Direction note"}
                  <DialogueBeatDirectionNote
                    value={selectedDialogueBeatContext.beat.directorNote ?? ""}
                    onCommit={(value) => updateSelectedDialogueBeat({ directorNote: value || undefined })}
                  />
                </label>
              ) : null}
              {selectedDialogueBeatContext.beat.kind === "speech" ? (
                <details className="metadata-section dialogue-beat-image-section" open={!metadataSectionCollapsed} onToggle={(event) => setMetadataSectionCollapsed(!(event.currentTarget as HTMLDetailsElement).open)}>
                  <summary>
                    {metadataSectionCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {interfaceLocale === "es" ? "Imagen del diálogo" : "Dialogue image"}
                    {selectedDialogueBeatContext.beat.sceneImage ? <span className="dialogue-beat-image-name">{project.assets?.find((asset) => asset.id === selectedDialogueBeatContext.beat.sceneImage?.assetId)?.name}</span> : null}
                  </summary>
                  <div className="metadata-content">
                    <label className="field-label">
                      {interfaceLocale === "es" ? "Imagen" : "Image"}
                      <select
                        value={selectedDialogueBeatContext.beat.sceneImage?.assetId ?? ""}
                        onChange={(event) => {
                          const assetId = event.target.value || undefined;
                          updateSelectedDialogueBeat({
                            sceneImage: assetId
                              ? { id: selectedDialogueBeatContext.beat.sceneImage?.id ?? `scene-image:${crypto.randomUUID()}`, assetId }
                              : undefined,
                          });
                        }}
                      >
                        <option value="">{interfaceLocale === "es" ? "Sin imagen" : "No image"}</option>
                        {selectedBeatImageAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                      </select>
                    </label>
                    <div className="dialogue-beat-image-actions">
                      {onImportSceneImage ? (
                        <button type="button" onClick={() => onImportSceneImage(selectedDialogueBeatContext.eventId, selectedDialogueBeatContext.dialogueId, selectedDialogueBeatContext.beat.id)}>
                          {interfaceLocale === "es" ? "Importar imagen…" : "Import image…"}
                        </button>
                      ) : null}
                      {selectedDialogueBeatContext.beat.sceneImage ? (
                        <button type="button" className="danger-text" onClick={() => updateSelectedDialogueBeat({ sceneImage: undefined })}>
                          {interfaceLocale === "es" ? "Quitar imagen" : "Remove image"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </details>
              ) : null}

              <label className="field-label">
                {interfaceLocale === "es" ? "Lugar" : "Location"}
                <select
                  value={selectedDialogueBeatContext.beat.locationRef ?? ""}
                  onChange={(input) => {
                    const locationRef = input.target.value || undefined;
                    if (selectedDialogueBeatContext.dialogueId) {
                      onUpdateDialogueBeat(selectedDialogueBeatContext.eventId, selectedDialogueBeatContext.dialogueId, selectedDialogueBeatContext.beat.id, { locationRef });
                    } else {
                      onUpdateEventDialogueBeat(selectedDialogueBeatContext.eventId, selectedDialogueBeatContext.beat.id, { locationRef });
                    }
                  }}
                >
                  <option value="">{interfaceLocale === "es" ? "Usar lugar del evento" : "Use event location"}</option>
                  {locationOptionsList.map((option) => (
                    <option key={`${option.source}:${option.id}`} value={option.id}>
                      {option.label} · {option.typeId}
                    </option>
                  ))}
                </select>
              </label>

            </section>
            ) : null}
            {objectInspectorTab !== "content" ? <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} /> : null}
          </>
        ) : null}

        {selectedDialogueStartContext?.start ? (
          <section className="inspector-section">
            <h2>Dialogue Trigger</h2>
            <p className="inspector-help">This node has an output only. It starts from one present entity configured as a Dialogue Trigger and an interaction action.</p>
            <CanonEntityRefPicker
              title="Present entity"
              placeholder="Search Dialogue Trigger entities…"
              emptyLabel="No entity selected"
              value={triggerSource?.kind === "canonRef" ? triggerSource.id : undefined}
              canonRefs={project.canonRefs.filter((ref) => entitySupportsDialogueTrigger(project, ref))}
              presentEntityRefs={presentEntityIds}
              onChange={(entityId) => {
                const triggerEvent = findEvent(project, selectedDialogueStartContext.eventId);
                if (!triggerEvent) return;
                const nextPresentEntityRefs = entityId && !presentEntityIds.includes(entityId)
                  ? [...presentEntityIds, entityId]
                  : presentEntityIds;
                onUpdateEvent(selectedDialogueStartContext.eventId, {
                  presentEntityRefs: nextPresentEntityRefs,
                  dialogueStarts: (triggerEvent.dialogueStarts ?? []).map((start) => start.id === selectedDialogueStartContext.start!.id ? {
                    ...start,
                    source: entityId ? { kind: "canonRef" as const, id: entityId } : undefined,
                  } : start),
                });
              }}
            />
            <label className="field-label">
              Trigger action
              <select
                value={triggerSource?.propertyId ?? ""}
                disabled={!selectedTriggerEntity}
                onChange={(input) => onUpdateEvent(selectedDialogueStartContext.eventId, {
                  dialogueStarts: (findEvent(project, selectedDialogueStartContext.eventId)?.dialogueStarts ?? []).map((start) => start.id === selectedDialogueStartContext.start!.id ? {
                    ...start,
                    source: selectedTriggerEntity
                      ? { kind: "canonRef" as const, id: selectedTriggerEntity.id, propertyId: input.target.value || undefined }
                      : start.source,
                  } : start),
                })}
              >
                <option value="">Choose an action…</option>
                {DIALOGUE_TRIGGER_ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
              </select>
            </label>
            {selectedTriggerEntity && !entitySupportsDialogueTrigger(project, selectedTriggerEntity) ? (
              <p className="warning-text">This entity is not configured as a Dialogue Trigger. Mark one of its properties as Entity presentable and Dialogue Trigger reference.</p>
            ) : null}
          </section>
        ) : null}

        {selectedDialogueContext?.dialogue ? (
          <>

            {objectInspectorTab === "overview" ? (
            <section className="inspector-section">
              <h2>Dialogue</h2>
              <label className="field-label">
                Title
                <input
                  value={selectedDialogueContext.dialogue.title}
                  onChange={(inputEvent) =>
                    onUpdateDialogue(
                      selectedDialogueContext.eventId,
                      selectedDialogueContext.dialogue!.id,
                      {
                        title: inputEvent.target.value,
                      },
                    )
                  }
                />
              </label>
              <p className="inspector-connection-hint">
                Double-click this node to open the full dialogue canvas.
              </p>
            </section>
            ) : null}

            {objectInspectorTab !== "overview" ? <UnifiedAuthoringInspector project={project} selection={selection} section={objectInspectorTab} eventId={authoringEventId} dialogueId={authoringDialogueId} selectedNodeId={selection?.type === "node" ? selection.id : undefined} focusId={requestedSection?.selectionKey === selectionKey ? requestedSection.focusId : undefined} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} onHighlight={onHighlightAuthoringNode} highlightedNodeId={highlightedAuthoringNodeId} propertiesConfig={propertiesConfig} onSectionChange={changeInspectorSection} onOpenSection={onOpenAuthoringSection} onOpenReference={onOpenReference} onApplyEvpath={onApplyEvpath} /> : null}
          </>
        ) : null}

        {selectedMissingRefContext ? (
          <section className="inspector-section">
            <h2>Missing Reference</h2>
            <p className="empty-line">
              "{selectedMissingRefContext.missingEventId}" is referenced by "
              {selectedMissingRefContext.ownerId}" but no event with that id
              exists. Recreate the event with this id to restore it, or remove
              the dangling reference.
            </p>
            <div className="inspector-actions">
              <button
                type="button"
                className="danger"
                onClick={() =>
                  onDeleteSelection({
                    type: "node",
                    id: selectedMissingRefContext.missingEventId,
                  })
                }
              >
                Remove reference
              </button>
            </div>
          </section>
        ) : null}

        {authoringEventId && selection?.type === "node" && (objectInspectorTab === "interactions" || interactionSelection && objectInspectorTab === "overview") ? <div className="unified-authoring-inspector inspector-uniform-content inspector-interactions" data-inspector-section="interactions">
          <InspectorPanel title={interfaceLocale === "es" ? "Interacción" : "Interaction"}>
            <InteractionsEditor key={JSON.stringify([project.projectId, authoringEventId, selection.id])} project={project} eventId={authoringEventId} ownerNodeId={selection.id} dialogueId={interactionSelection?.dialogueId ?? authoringDialogueId} optionContext={selectedNode?.data.kind === "outcome"} onMutation={onAuthoringMutation} onSelect={onSelectAuthoringNode} />
          </InspectorPanel>
        </div> : null}

        {authoringEventId && interactionSelection && selection?.type === 'node' && selection.id.startsWith('interaction:') && objectInspectorTab === 'consequences' ? <div className="unified-authoring-inspector inspector-uniform-content inspector-interaction-consequences" data-inspector-section="consequences">
          <InspectorPanel title={interfaceLocale === 'es' ? 'Consecuencias' : 'Consequences'}>
            <InteractionConsequencesEditor key={`${project.projectId}:${selection.id}`} project={project} eventId={interactionSelection.eventId} nodeId={selection.id} onMutation={onAuthoringMutation} />
          </InspectorPanel>
        </div> : null}

        {selectedNode &&
        !interactionSelection &&
        !sequence &&
        !branch &&
        !event &&
        !selectedDecisionContext?.decision &&
        !selectedDialogueContext?.dialogue &&
        !selectedDialogueBeatContext &&
        !selectedDialogueStartContext &&
        !selectedOutcomeContext?.outcome &&
        !selectedRouteGateContext &&
        !selectedMissingRefContext ? (
          <section className="inspector-section">
            <h2>{selectedNode.data.title}</h2>
            <dl>
              <div>
                <dt>Kind</dt>
                <dd>{selectedNode.data.kind}</dd>
              </div>
              <div>
                <dt>ID</dt>
                <dd>{selectedNode.id}</dd>
              </div>
            </dl>
            <pre>
              {JSON.stringify(selectedNode.data.details ?? {}, null, 2)}
            </pre>
          </section>
        ) : null}

        {selectedRouteGateContext?.eventId || selectedTransitionOwner ? <RouteInspector project={project} eventId={selectedTransitionOwner?.id ?? selectedRouteGateContext!.eventId!} sourceId={selectedRouteGateContext?.sourceId ?? selectedTransition?.from} routeId={selectedRouteGateRoute?.id ?? selectedTransition?.id} section={objectInspectorTab} onSectionChange={changeInspectorSection} onMutation={onAuthoringMutation} onOpen={(id,section)=>onOpenAuthoringSection?.(id,section ?? "overview")} /> : null}
        {selectedEdge && !selectedTransition && !selectedRouteGateContext ? <section className="inspector-section"><h2>{interfaceLocale === "es" ? "Conexión" : "Connection"}</h2><p>{nodes.find(node=>node.id===selectedEdge.source)?.data.title ?? selectedEdge.source} → {nodes.find(node=>node.id===selectedEdge.target)?.data.title ?? selectedEdge.target}</p><LogicSection availability={selectedEdge.data?.conditions} consequences={selectedEdge.data?.consequences} /></section> : null}
        {(selection?.type === "node" && !selectedNode && !sequence && !branch && !event) || (selection?.type === "edge" && !selectedEdge) || (selection?.type === "canon" && !selectedCanon) || (selection?.type === "explorerEntity" && !selectedExplorerEntity) || (selection?.type === "explorerType" && !selectedExplorerType) || (selection?.type === "explorerProperty" && !selectedExplorerProperty) ? <section className="inspector-section" role="status"><h2>{interfaceLocale === "es" ? "Referencia desaparecida" : "Missing reference"}</h2><p>{selection.id}</p></section> : null}

        {selectedCanon && objectInspectorTab === "overview" ? (
          <section className="inspector-section">
            <h2>{selectedCanon.label ?? selectedCanon.kind ?? "Canon"}</h2>
            <div className="inspector-tag-list" aria-label="Canon classification">
              <span>{selectedCanon.kind ?? "canon"}</span>
              {selectedCanon.parentId ? <span>Child of {project.canonRefs.find((ref) => ref.id === selectedCanon.parentId)?.label ?? selectedCanon.parentId}</span> : null}
              {(selectedCanon.tags ?? []).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <dl>
              <div>
                <dt>ID</dt>
                <dd>{selectedCanon.id}</dd>
              </div>
              <div>
                <dt>Kind</dt>
                <dd>{selectedCanon.kind ?? "canon"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selectedCanon.source ?? "unknown"}</dd>
              </div>
              <div>
                <dt>Canon Path</dt>
                <dd>{selectedCanon.canonSourcePath ?? "none"}</dd>
              </div>
              <div>
                <dt>Working Copy</dt>
                <dd>{selectedCanon.workingCopyPath ?? "not created"}</dd>
              </div>
              {selectedCanon.missingIdentity ? (
                <div>
                  <dt>Identity</dt>
                  <dd className="warning-text">
                    {selectedCanon.identityWarning ??
                      "Missing WorldNotion id/frontmatter."}
                  </dd>
                </div>
              ) : null}
            </dl>
            {selectedCanon.properties &&
            Object.keys(selectedCanon.properties).length ? (
              <section className="inspector-section">
                <h2>WorldNotion Properties</h2>
                <div className="readonly-preview-label">
                  Read-only metadata imported from WorldNotion.
                </div>
                <pre>{JSON.stringify(selectedCanon.properties, null, 2)}</pre>
              </section>
            ) : null}
            {selectedCanonImages.length ? (
              <section className="inspector-section">
                <h2>Images</h2>
                <div className="readonly-preview-label">
                  Image properties declared by WorldNotion. Read-only in PathBranching.
                </div>
                <div className="canon-image-list">
                  {selectedCanonImages.map(({ property, value }) => {
                    const imageUrl = canonVaultImageUrl(project, value);
                    return (
                      <div className="canon-image-property" key={property.id}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={`${property.label} for ${selectedCanon.label ?? selectedCanon.id}`} />
                        ) : null}
                        <div>
                          <strong>{property.label}</strong>
                          <code>{value}</code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {selectedCanon.frontmatter &&
            Object.keys(selectedCanon.frontmatter).length ? (
              <section className="inspector-section">
                <h2>WorldNotion Frontmatter</h2>
                <div className="readonly-preview-label">
                  Full YAML frontmatter snapshot. Everend PathBranching does not
                  write it back.
                </div>
                <pre>{JSON.stringify(selectedCanon.frontmatter, null, 2)}</pre>
              </section>
            ) : null}
            <div className="inspector-actions">
              <button
                type="button"
                onClick={() => onCreateCanonSuggestion(selectedCanon.id)}
              >
                Suggest Edit
              </button>
              <button
                type="button"
                onClick={() => onCreateCanonWorkingCopy(selectedCanon)}
              >
                Edit working copy
              </button>
            </div>
            {(project.canonEditSuggestions ?? []).filter(
              (suggestion) => suggestion.canonRefId === selectedCanon.id,
            ).length ? (
              <div className="stack-list">
                {(project.canonEditSuggestions ?? [])
                  .filter(
                    (suggestion) => suggestion.canonRefId === selectedCanon.id,
                  )
                  .map((suggestion) => (
                    <button
                      className={`list-item ${selection?.type === "canonSuggestion" && selection.id === suggestion.id ? "active" : ""}`}
                      type="button"
                      key={suggestion.id}
                      onClick={() => onSelectSuggestion(suggestion.id)}
                    >
                      <strong>{suggestion.title}</strong>
                      <span>{suggestion.status}</span>
                    </button>
                  ))}
              </div>
            ) : null}
            <div className="readonly-preview-label">
              Read-only canon preview
            </div>
            {selectedCanon.preview ? (
              <pre>{selectedCanon.preview}</pre>
            ) : (
              <span className="empty-line">No preview available.</span>
            )}
            <CanonWorkingCopyEditor
              copy={project.canonWorkingCopies?.find(
                (copy) => copy.canonRefId === selectedCanon.id,
              )}
              sourceChanged={Boolean(
                selectedCanon.canonSourceModifiedMs &&
                project.canonWorkingCopies?.find(
                  (copy) => copy.canonRefId === selectedCanon.id,
                )?.sourceModifiedMs !== selectedCanon.canonSourceModifiedMs,
              )}
              onCreate={() => onCreateCanonWorkingCopy(selectedCanon)}
              onSave={(content) =>
                onSaveCanonWorkingCopy(selectedCanon.id, content)
              }
              onExportProposal={() => onExportCanonChangeSet(selectedCanon.id)}
              onApply={() => onApplyCanonWorkingCopy(selectedCanon.id)}
            />
          </section>
        ) : null}

        {selectedExplorerEntity && objectInspectorTab === "overview" ? (
          <section className="inspector-section">
            <h2>Local Entity</h2>
            <label className="field-label">
              Name
              <input
                value={selectedExplorerEntity.name}
                onChange={(event) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label className="field-label">
              Type
              <select
                value={selectedExplorerEntity.type}
                onChange={(event) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    type: event.target.value,
                  })
                }
              >
                {Array.from(new Set([
                  selectedExplorerEntity.type,
                  ...canonExplorerTypes(propertiesConfig).map((type) => type.id),
                  ...project.canonRefs.flatMap((entity) => entity.kind ? [entity.kind] : []),
                  ...(project.localExplorerEntities ?? []).map((entity) => entity.type),
                  ...(project.localExplorerTypes ?? []).map((type) => type.id),
                  ...(project.localExplorerProperties ?? []).filter((property) => property.valueType === "entity-type").map((property) => property.id),
                ])).map((id) => <option key={id} value={id}>{explorerTypeLabel(project, "local", id, propertiesConfig)}</option>)}
              </select>
            </label>
            <label className="field-label">
              Status
              <input
                value={selectedExplorerEntity.status}
                onChange={(event) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    status: event.target.value,
                  })
                }
              />
            </label>
            <label className="field-label">
              Tags
              <input
                value={(selectedExplorerEntity.tags ?? []).join(", ")}
                onChange={(event) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    tags: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            {isLocationType(project, "local", selectedExplorerEntity.type) ? (
              <div className="logic-property-options">
                <div className="logic-property-editor-subheading"><strong>Image gallery</strong><span>{selectedExplorerEntity.imageGallery?.length ?? 0}</span></div>
                <div className="logic-property-options">
                  {(selectedExplorerEntity.imageGallery ?? []).map((assetId) => {
                    const asset = project.assets?.find((candidate) => candidate.id === assetId);
                    return (
                      <div className="logic-property-option" key={assetId}>
                        <span>{asset?.name ?? assetId}</span>
                        <button
                          type="button"
                          className="icon-only"
                          aria-label={`Remove ${asset?.name ?? assetId}`}
                          onClick={() =>
                            onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                              imageGallery: (selectedExplorerEntity.imageGallery ?? []).filter((id) => id !== assetId),
                            })
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(event) => {
                    const assetId = event.target.value;
                    if (!assetId) return;
                    const currentGallery = selectedExplorerEntity.imageGallery ?? [];
                    if (!currentGallery.includes(assetId)) {
                      onUpdateLocalExplorerEntity(selectedExplorerEntity.id, { imageGallery: [...currentGallery, assetId] });
                    }
                  }}
                >
                  <option value="">Attach an existing image…</option>
                  {(project.assets ?? [])
                    .filter((asset) => asset.kind === "image" && !(selectedExplorerEntity.imageGallery ?? []).includes(asset.id))
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                </select>
              </div>
            ) : null}
            {(project.localExplorerProperties ?? [])
              .filter(
                (property) =>
                  !property.appliesToTypes?.length ||
                  property.appliesToTypes.includes(selectedExplorerEntity.type),
              )
              .map((property) => {
                const value = selectedExplorerEntity.properties?.[property.id];
                const setProperty = (nextValue: unknown) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    properties: {
                      ...(selectedExplorerEntity.properties ?? {}),
                      [property.id]: nextValue,
                    },
                  });
                if (property.valueType === "boolean") {
                  return (
                    <label className="field-label" key={property.id}>
                      {property.label}
                      <input type="checkbox" checked={value === true} onChange={(event) => setProperty(event.target.checked)} />
                    </label>
                  );
                }
                if (property.valueType === "select") {
                  return (
                    <label className="field-label" key={property.id}>
                      {property.label}
                      <select value={typeof value === "string" ? value : ""} onChange={(event) => setProperty(event.target.value || undefined)}>
                        <option value="">Not set</option>
                        {(property.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (property.valueType === "multiselect") {
                  const selectedValues = Array.isArray(value) ? value.map(String) : [];
                  return (
                    <div className="field-label" key={property.id}>
                      {property.label}
                      <div className="logic-property-options">
                        {(property.options ?? []).map((option) => (
                          <label key={option.value} className="logic-property-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedValues.includes(option.value)}
                              onChange={(event) =>
                                setProperty(
                                  event.target.checked
                                    ? [...selectedValues, option.value]
                                    : selectedValues.filter((item) => item !== option.value),
                                )
                              }
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (property.valueType === "entity-ref") {
                  const refOptions = entityRefOptions(project, property.targetTypes);
                  return (
                    <label className="field-label" key={property.id}>
                      {property.label}
                      <select value={typeof value === "string" ? value : ""} onChange={(event) => setProperty(event.target.value || undefined)}>
                        <option value="">Not set</option>
                        {refOptions.map((option) => (
                          <option key={`${option.source}:${option.id}`} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (property.valueType === "entity-ref-list") {
                  const refOptions = entityRefOptions(project, property.targetTypes);
                  const selectedIds = Array.isArray(value) ? value.map(String) : [];
                  return (
                    <div className="field-label" key={property.id}>
                      {property.label}
                      <div className="logic-property-options">
                        {selectedIds.map((id) => {
                          const option = refOptions.find((candidate) => candidate.id === id);
                          return (
                            <div className="logic-property-option" key={id}>
                              <span>{option?.label ?? id}</span>
                              <button type="button" className="icon-only" aria-label={`Remove ${option?.label ?? id}`} onClick={() => setProperty(selectedIds.filter((item) => item !== id))}>
                                <X size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <select value="" onChange={(event) => { const id = event.target.value; if (id && !selectedIds.includes(id)) setProperty([...selectedIds, id]); }}>
                        <option value="">Add entity…</option>
                        {refOptions.filter((option) => !selectedIds.includes(option.id)).map((option) => (
                          <option key={`${option.source}:${option.id}`} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return (
                  <label className="field-label" key={property.id}>
                    {property.label}
                    <input
                      value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
                      onChange={(event) => setProperty(event.target.value)}
                      placeholder={property.description}
                    />
                  </label>
                );
              })}
            <label className="field-label">
              Body
              <textarea
                rows={8}
                value={selectedExplorerEntity.body ?? ""}
                onChange={(event) =>
                  onUpdateLocalExplorerEntity(selectedExplorerEntity.id, {
                    body: event.target.value,
                  })
                }
              />
            </label>
            <dl>
              <div>
                <dt>ID</dt>
                <dd>{selectedExplorerEntity.id}</dd>
              </div>
              <div>
                <dt>Publication</dt>
                <dd>{selectedExplorerEntity.publishedPath ?? "local only"}</dd>
              </div>
            </dl>
            <div className="inspector-actions">
              <button
                type="button"
                onClick={() =>
                  onPublishLocalExplorerEntity(selectedExplorerEntity.id)
                }
              >
                {selectedExplorerEntity.publishedPath
                  ? "Export again"
                  : "Publish to WorldNotion"}
              </button>
            </div>
          </section>
        ) : null}

        {selectedExplorerType ? (
          <section className="inspector-section">
            <h2>{selectedExplorerSchemaSource === "canon" ? "Canon type" : "Local type"}</h2>
            {selectedExplorerSchemaSource === "local" ? (
              <>
                <label className="field-label">
                  Name
                  <input
                    value={selectedExplorerType.label}
                    onChange={(event) =>
                      onUpdateLocalExplorerType(selectedExplorerType.id, {
                        label: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Icon hint
                  <input
                    value={selectedExplorerType.icon ?? ""}
                    onChange={(event) =>
                      onUpdateLocalExplorerType(selectedExplorerType.id, {
                        icon: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Color
                  <input
                    value={selectedExplorerType.color ?? ""}
                    onChange={(event) =>
                      onUpdateLocalExplorerType(selectedExplorerType.id, {
                        color: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Suggested folder
                  <input
                    value={selectedExplorerType.suggestedFolder ?? ""}
                    onChange={(event) =>
                      onUpdateLocalExplorerType(selectedExplorerType.id, {
                        suggestedFolder: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="field-label">
                  Description
                  <textarea
                    rows={4}
                    value={selectedExplorerType.description ?? ""}
                    onChange={(event) =>
                      onUpdateLocalExplorerType(selectedExplorerType.id, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
              </>
            ) : (
              <dl>
                <div><dt>ID</dt><dd>{selectedExplorerType.id}</dd></div>
                <div><dt>Folder</dt><dd>{selectedExplorerType.suggestedFolder ?? "not specified"}</dd></div>
                <div><dt>Description</dt><dd>{selectedExplorerType.description ?? "not specified"}</dd></div>
              </dl>
            )}
            {(() => {
              const source = selectedExplorerSchemaSource ?? "local";
              const propertyId = selectedExplorerType.id.startsWith("type:") ? selectedExplorerType.id : `type:${selectedExplorerType.id}`;
              return <PropertyCapabilitiesEditor locale={interfaceLocale} isEntityType project={project} source={source} propertyId={propertyId} propertiesConfig={propertiesConfig}
                property={propertyCapability(project, source, propertyId)}
                entityType={typeCapability(project, source, selectedExplorerType.id)}
                onPropertyChange={changes => onUpdateLogicPropertyOverride(propertyId, source, changes)}
                onTypeChange={changes => onUpdateLogicTypeOverride(selectedExplorerType.id, source, changes)} />;
            })()}
          </section>
        ) : null}

        {selectedExplorerProperty ? (
          <section className="inspector-section">
            <h2>{selectedExplorerSchemaSource === "local"
              ? panelUiText(interfaceLocale, selectedExplorerPropertyIsSubproperty ? "Subproperty" : "Property")
              : selectedExplorerProperty.id.startsWith("type:") || selectedExplorerProperty.valueType === "entity-type"
                ? interfaceLocale === "es" ? "Tipo de entidad" : "Entity type"
                : panelUiText(interfaceLocale, "Property")}</h2>
            <p className="inspector-connection-hint">{selectedExplorerSchemaSource === "canon"
              ? interfaceLocale === "es" ? "Definición importada del canon. Configura sus capacidades para esta historia." : "Definition imported from canon. Configure its capabilities for this story."
              : interfaceLocale === "es" ? "Definición local de esta historia." : "Definition local to this story."}</p>

            {(() => {
              const source = selectedExplorerSchemaSource ?? "local";
              const isEntityType = selectedExplorerProperty.id.startsWith("type:") || selectedExplorerProperty.valueType === "entity-type";
              return <PropertyCapabilitiesEditor locale={interfaceLocale} isEntityType={isEntityType} project={project} source={source} propertyId={selectedExplorerProperty.id} propertiesConfig={propertiesConfig}
                descriptor={source === "canon" ? selectedExplorerProperty as import('./explorerSchema.js').CanonExplorerProperty : undefined}
                valueType={selectedExplorerProperty.valueType}
                property={propertyCapability(project, source, selectedExplorerProperty.id)}
                entityType={isEntityType ? typeCapability(project, source, selectedExplorerProperty.id) : undefined}
                onPropertyChange={changes => onUpdateLogicPropertyOverride(selectedExplorerProperty.id, source, changes)}
                onTypeChange={changes => onUpdateLogicTypeOverride(selectedExplorerProperty.id, source, changes)} />;
            })()}

            {/* Schema Fields (Collapsible) */}
            <details className="logic-property-technical-info">
              <summary><Info size={12} /> {interfaceLocale === "es" ? "Definición" : "Definition"}</summary>
              <div className="logic-property-technical-content">
                {selectedExplorerSchemaSource === "local" ? (
                  (() => {
                    const localProperty = selectedExplorerProperty as LocalExplorerProperty;
                    const update = (changes: Partial<LocalExplorerProperty>) =>
                      onUpdateLocalExplorerProperty(localProperty.id, changes);
                    const options = localProperty.options ?? [];
                    const ui = (text: string) => panelUiText(interfaceLocale, text);
                    return <>
                    <label className="field-label">
                      {ui("Name")}
                      <input
                        value={localProperty.label}
                        onChange={(event) => update({ label: event.target.value })}
                      />
                    </label>
                    <label className="field-label">
                      {ui("Value type")}
                      <select
                        value={localProperty.valueType}
                        disabled={Boolean(localProperty.children?.length)}
                        onChange={(event) => update({ valueType: event.target.value as LocalExplorerProperty["valueType"] })}
                      >
                        {(["entity-type", "text", "number", "boolean", "date", "select", "multiselect", "entity-ref", "entity-ref-list", "group"] as const).map(value => <option key={value} value={value}>{ui(value === "entity-type" ? "Entity type" : value === "entity-ref" ? "Entity reference" : value === "entity-ref-list" ? "Entity reference list" : value === "group" ? "Group (nested properties)" : value)}</option>)}
                      </select>
                    </label>
                    <label className="field-label">
                      {ui("Applies to types")}
                      <input
                        value={(localProperty.appliesToTypes ?? []).join(", ")}
                        placeholder={ui(selectedExplorerPropertyIsSubproperty ? "Inherited from parent property" : "All types")}
                        onChange={(event) => update({ appliesToTypes: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
                      />
                    </label>
                    <label className="field-label">
                      {ui("Description")}
                      <textarea
                        rows={4}
                        value={localProperty.description ?? ""}
                        onChange={(event) => update({ description: event.target.value })}
                      />
                    </label>
                    {(localProperty.valueType === "entity-ref" || localProperty.valueType === "entity-ref-list") ? <label className="field-label">
                      {ui("Target entity types")}
                      <input value={(localProperty.targetTypes ?? []).join(", ")} onChange={event => update({ targetTypes: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} />
                    </label> : null}
                    <label className="logic-property-checkbox">
                      <input type="checkbox" checked={localProperty.required ?? false} onChange={event => update({ required: event.target.checked })} /> {ui("Required")}
                    </label>
                    {(localProperty.valueType === "select" || localProperty.valueType === "multiselect") ? <div className="logic-property-options">
                      <div className="logic-property-editor-subheading"><strong>{ui("Options")}</strong><span>{options.length}</span></div>
                      {options.map((option, index) => <div className="logic-property-option" key={`${option.value}-${index}`}>
                        <input aria-label={`${ui("Value")} ${index + 1}`} value={option.value} onChange={event => update({ options: options.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} />
                        <input aria-label={`${ui("Label")} ${index + 1}`} value={option.label} onChange={event => update({ options: options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} />
                        <button type="button" className="icon-only" aria-label={`${ui("Remove option")} ${index + 1}`} onClick={() => update({ options: options.filter((_, itemIndex) => itemIndex !== index) })}><X size={13} /></button>
                      </div>)}
                      <button type="button" className="logic-property-add-option" onClick={() => update({ options: [...options, { value: `option-${options.length + 1}`, label: `Option ${options.length + 1}` }] })}><Plus size={13} /> {ui("Add option")}</button>
                    </div> : null}
                    {localProperty.valueType === "entity-type" ? <>
                      <label className="field-label">{ui("Icon")}<input value={localProperty.icon ?? ""} onChange={event => update({ icon: event.target.value || undefined })} /></label>
                      <label className="field-label">{ui("Color (optional)")}<input value={localProperty.color ?? ""} onChange={event => update({ color: event.target.value || undefined })} /></label>
                      <label className="field-label">{ui("Suggested folder (optional)")}<input value={localProperty.suggestedFolder ?? ""} onChange={event => update({ suggestedFolder: event.target.value || undefined })} /></label>
                    </> : null}
                    </>;
                  })()
                ) : (
                  <dl>
                    <div><dt>ID</dt><dd>{selectedExplorerProperty.id}</dd></div>
                    <div><dt>Value type</dt><dd>{selectedExplorerProperty.valueType}</dd></div>
                    <div><dt>Applies to</dt><dd>{selectedExplorerProperty.appliesToTypes?.join(", ") || "all types"}</dd></div>
                  </dl>
                )}
              </div>
            </details>
          </section>
        ) : null}

        {selectedSuggestion ? (
          <section className="inspector-section">
            <h2>WorldNotion Edit Suggestion</h2>
            <div className="readonly-preview-label">
              Safe suggestion only. Everend PathBranching stores this proposal;
              WorldNotion remains the source of truth and must apply final
              edits.
            </div>
            <label className="field-label">
              Title
              <input
                value={selectedSuggestion.title}
                onChange={(event) =>
                  onUpdateCanonSuggestion(selectedSuggestion.id, {
                    title: event.target.value,
                  })
                }
              />
            </label>
            <label className="field-label">
              Status
              <select
                value={selectedSuggestion.status}
                onChange={(event) =>
                  onUpdateCanonSuggestion(selectedSuggestion.id, {
                    status: event.target.value,
                  })
                }
              >
                <option value="draft">draft</option>
                <option value="proposed">proposed</option>
                <option value="sent-to-worldnotion">sent to WorldNotion</option>
                <option value="applied-in-worldnotion">
                  applied in WorldNotion
                </option>
                <option value="dismissed">dismissed</option>
              </select>
            </label>
            <label className="field-label">
              Summary
              <textarea
                rows={3}
                value={selectedSuggestion.summary ?? ""}
                onChange={(event) =>
                  onUpdateCanonSuggestion(selectedSuggestion.id, {
                    summary: event.target.value,
                  })
                }
              />
            </label>
            <label className="field-label">
              Proposed Content
              <textarea
                rows={10}
                value={selectedSuggestion.proposedContent}
                onChange={(event) =>
                  onUpdateCanonSuggestion(selectedSuggestion.id, {
                    proposedContent: event.target.value,
                  })
                }
              />
            </label>
            <dl>
              <div>
                <dt>Canon Ref</dt>
                <dd>{selectedSuggestion.canonRefId}</dd>
              </div>
              <div>
                <dt>Target Path</dt>
                <dd>{selectedSuggestion.targetPath ?? "unknown"}</dd>
              </div>
              <div>
                <dt>Safety</dt>
                <dd>{selectedSuggestion.safety}</dd>
              </div>
            </dl>
            <div className="inspector-actions">
              <button
                type="button"
                className="danger"
                onClick={() => onDeleteCanonSuggestion(selectedSuggestion.id)}
              >
                Delete Suggestion
              </button>
            </div>
          </section>
        ) : null}

        {selectedFile ? (
          <section className="inspector-section">
            <h2>{selectedFile.label}</h2>
            <dl>
              <div>
                <dt>Group</dt>
                <dd>{selectedFile.group}</dd>
              </div>
              <div>
                <dt>Detail</dt>
                <dd>{selectedFile.detail ?? "none"}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {selectedDataObject ? (
          <>
            <section className="inspector-section">
              <h2>Project Data Object</h2>
              <label className="field-label">
                Name
                <input
                  value={selectedDataObject.name}
                  onChange={(event) =>
                    onUpdateDataObject(selectedDataObject.id, {
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field-label">
                Class
                <select
                  value={selectedDataObject.classId}
                  onChange={(event) =>
                    onUpdateDataObject(selectedDataObject.id, {
                      classId: event.target.value,
                    })
                  }
                >
                  {(project.dataClasses ?? []).map((dataClass) => (
                    <option key={dataClass.id} value={dataClass.id}>
                      {dataClass.label}
                    </option>
                  ))}
                </select>
              </label>
              <CanonRefsPicker
                value={selectedDataObject.canonRefs}
                canonRefs={project.canonRefs}
                onChange={(canonRefs) =>
                  onUpdateDataObject(selectedDataObject.id, { canonRefs })
                }
              />
              <label className="field-label">
                Tags
                <input
                  value={(selectedDataObject.tags ?? []).join(", ")}
                  onChange={(event) =>
                    onUpdateDataObject(selectedDataObject.id, {
                      tags: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <dl>
                <div>
                  <dt>ID</dt>
                  <dd>{selectedDataObject.id}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>{selectedDataObject.classId}</dd>
                </div>
                <div>
                  <dt>Canon</dt>
                  <dd>
                    {selectedDataObject.canonRefs?.join(", ") || "manual"}
                  </dd>
                </div>
              </dl>
              <div className="inspector-actions">
                <button
                  type="button"
                  className="danger"
                  onClick={() => onDeleteDataObject(selectedDataObject.id)}
                >
                  Delete Data Object
                </button>
              </div>
            </section>
            <section className="inspector-section">
              <h2>Fields</h2>
              <div className="stack-list">
                {(selectedDataClass?.fields.length
                  ? selectedDataClass.fields
                  : Object.keys(selectedDataObject.fields).map(
                      (field): DataFieldDefinition => ({
                        name: field,
                        type: "text",
                      }),
                    )
                ).map((fieldDefinition) => {
                  const value =
                    selectedDataObject.fields[fieldDefinition.name] ??
                    fieldDefinition.defaultValue ??
                    "";
                  return (
                    <div className="mini-card" key={fieldDefinition.name}>
                      <label className="field-label">
                        {fieldDefinition.label ?? fieldDefinition.name}
                        {fieldDefinition.type === "boolean" ? (
                          <select
                            value={String(Boolean(value))}
                            onChange={(event) =>
                              onUpdateDataObject(selectedDataObject.id, {
                                fields: {
                                  ...selectedDataObject.fields,
                                  [fieldDefinition.name]:
                                    event.target.value === "true",
                                },
                              })
                            }
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : fieldDefinition.type === "select" &&
                          fieldDefinition.options?.length ? (
                          <select
                            value={String(value)}
                            onChange={(event) =>
                              onUpdateDataObject(selectedDataObject.id, {
                                fields: {
                                  ...selectedDataObject.fields,
                                  [fieldDefinition.name]: event.target.value,
                                },
                              })
                            }
                          >
                            {fieldDefinition.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={
                              Array.isArray(value)
                                ? value.join(", ")
                                : fieldSummary(value)
                            }
                            onChange={(event) =>
                              onUpdateDataObject(selectedDataObject.id, {
                                fields: {
                                  ...selectedDataObject.fields,
                                  [fieldDefinition.name]: coerceDataFieldValue(
                                    fieldDefinition.type,
                                    event.target.value,
                                  ),
                                },
                              })
                            }
                          />
                        )}
                      </label>
                      {fieldDefinition.description ? (
                        <span>{fieldDefinition.description}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <BasicConditionEditor
              project={project}
              context={{ sequenceId: selectedDataObject.scope?.sequenceId, eventId: selectedDataObject.scope?.eventId, nodeId: selectedDataObject.id, contextEntityIds: selectedDataObject.canonRefs }}
              value={selectedDataObject.availability}
              canonRefs={canonRefIds}
              dataObjects={dataObjects}
              grantableOptions={grantableOptionsList}
              onChange={(availability) =>
                onUpdateDataObject(selectedDataObject.id, { availability })
              }
            />
            <ConsequenceEditor project={project} value={selectedDataObject.consequences} grantableOptions={grantableOptionsList} onChange={(consequences) => onUpdateDataObject(selectedDataObject.id, { consequences })} />
            <LogicSection
              availability={selectedDataObject.availability}
              consequences={selectedDataObject.consequences}
            />
          </>
        ) : null}
      </div>
    </aside>
  );
}

type CanvasContextMenu = {
  kind: "create" | "connect-create" | "selection" | "route-gate";
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  sourceNodeId?: string;
  sourceHandleId?: string;
  routeSourceId?: string;
  edgeId?: string;
  nodeIds?: string[];
  contextNodeId?: string;
};

const DIRECTED_NODE_OPEN_DELAY_MS = 750;
const DIRECTED_NODE_MOVE_THRESHOLD_PX = 5;
const NESTED_EDGE_INSPECTOR_OPEN_DELAY_MS = 640;
const SUBCANVAS_DOUBLE_CLICK_DELAY_MS = 500;

type CanvasDialogueMember = {
  eventId: string;
  member: DialogueMemberRef;
};

function dialogueMemberFromCanvasNode(
  node: StoryCanvasNode,
): CanvasDialogueMember | undefined {
  const eventId = node.data.details?.eventId;
  if (typeof eventId !== "string" || typeof node.data.details?.dialogueId === "string") {
    return undefined;
  }
  if (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") {
    const beat = node.data.details?.beat as { id?: unknown } | undefined;
    return typeof beat?.id === "string"
      ? { eventId, member: { kind: "beat", id: beat.id } }
      : undefined;
  }
  if (node.data.kind === "decision") {
    const decision = node.data.details?.decision as { id?: unknown } | undefined;
    return typeof decision?.id === "string"
      ? { eventId, member: { kind: "decision", id: decision.id } }
      : undefined;
  }
  return undefined;
}

function canvasDialogueMembers(
  nodes: StoryCanvasNode[],
  nodeIds: string[],
): CanvasDialogueMember[] {
  return nodes
    .filter((node) => nodeIds.includes(node.id))
    .map(dialogueMemberFromCanvasNode)
    .filter((value): value is CanvasDialogueMember => Boolean(value));
}

function canCreateDialogueFromSelection(
  nodes: StoryCanvasNode[],
  nodeIds: string[],
) {
  if (nodeIds.length === 0) return false;
  const members = canvasDialogueMembers(nodes, nodeIds);
  if (members.length !== nodeIds.length) return false;
  return new Set(members.map(({ eventId }) => eventId)).size === 1;
}

function EventTypeMenuButton({
  label,
  icon,
  options,
  onSelect,
}: {
  label: string;
  icon: ReactNode;
  options: EventCategoryDefinition[];
  onSelect: (categoryId: string) => void;
}) {
  return (
    <div className="canvas-menu-submenu">
      <button type="button" className="canvas-menu-submenu-trigger canvas-create-menu-item" aria-haspopup="true">
        <span className="canvas-create-menu-icon" aria-hidden="true">{icon}</span>
        <span className="canvas-create-menu-item-label">{label}</span>
        <ChevronRight size={15} className="canvas-create-menu-chevron" aria-hidden="true" />
      </button>
      <div className="canvas-menu-submenu-flyout">
        {options.map((category) => (
          <button
            key={category.id}
            type="button"
            className="canvas-create-menu-item"
            onClick={() => onSelect(category.id)}
          >
            <span className="canvas-create-menu-icon canvas-create-menu-icon--category" aria-hidden="true"><StoryCanvasNodeIcon kind="event" size={15} /></span>
            <span className="canvas-create-menu-item-label">
              {category.label}{category.terminal ? " · final" : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CanvasCreateMenuItem({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className="canvas-create-menu-item" onClick={onClick}>
      <span className="canvas-create-menu-icon" aria-hidden="true">{icon}</span>
      <span className="canvas-create-menu-item-label">{children}</span>
    </button>
  );
}

const FIXABLE_FINDING_CODES = new Set<ValidationFinding["code"]>([
  "missing_event",
  "invalid_boundary_binding",
  "invalid_transition_order",
  "orphan_script_block",
]);

function CanvasFindingsButton({ findings, project, onLocateFinding, onFixFinding }: {
  findings: ValidationFinding[]; project: BranchingProject;
  onLocateFinding: (finding: ValidationFinding) => void;
  onFixFinding: (finding: ValidationFinding) => void;
}) {
  const locale = useInterfaceLocale();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const status = errors ? "error" : warnings ? "warning" : "clean";
  const label = findings.length ? (locale === "es" ? `${errors} errores · ${warnings} avisos` : `${errors} errors · ${warnings} warnings`) : (locale === "es" ? "Sin problemas de validación" : "No validation issues");
  useApplicationEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); }
    function key(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", pointer); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer); document.removeEventListener("keydown", key); };
  }, [open]);
  return <div data-onboarding-target="pathbranching.validation" className="canvas-findings-anchor" ref={wrapperRef}>
    <button ref={trigger} type="button" className={`react-flow__controls-button canvas-findings-button ${status} ${open ? "active" : ""}`} onClick={() => setOpen((current) => !current)} title={label} aria-label={`${locale === "es" ? "Validación" : "Validation status"}: ${label}`} aria-expanded={open}>
      {status === "error" ? <OctagonAlert size={14} /> : status === "warning" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
      <span className="pb-validation-label">{locale === "es" ? "Validar" : "Validate"}</span>
      {findings.length ? <span className="canvas-findings-count">{findings.length}</span> : null}
    </button>
    {open ? <div className="canvas-findings-popup" role="region" aria-label={locale === "es" ? "Hallazgos de validación" : "Validation findings"}>
      <div className="canvas-findings-popup-header"><strong>{label}</strong></div>
      {findings.length ? <div className="stack-list">{[...findings].sort((a,b) => (a.severity === "error" ? 0 : 1) - (b.severity === "error" ? 0 : 1)).map((finding, index) => {
        const presentation = findingPresentation(finding, project, locale);
        const transitionOrderTarget = finding.code === "invalid_transition_order" && finding.id
          ? transitionOrderDetails(project, finding.id, locale)
          : undefined;
        const locatable = Boolean(authoringDiagnosticTarget(project, finding.id) ?? authoringDiagnosticTarget(project, finding.ref) ?? diagnosticSelection(project, finding.id) ?? diagnosticSelection(project, finding.ref) ?? transitionOrderTarget?.event) || finding.code === "orphan_script_block";
        return <div className={`finding ${finding.severity}`} key={`${finding.code}:${finding.id}:${finding.ref}:${index}`}>
          <strong>{finding.severity === "error" ? "⚠" : "ⓘ"} {presentation.title}</strong>
          <span>{presentation.description ?? (locale === "es" ? "Localiza el elemento y revisa su configuración. Los detalles incluyen la causa concreta." : presentation.message)}</span>
          <details><summary>{locale === "es" ? "Detalles" : "Details"}</summary><span className="finding-technical">{presentation.technical}</span></details>
          <div className="finding-actions">
            {locatable ? <button type="button" onClick={() => { setOpen(false); onLocateFinding(finding); }}>{locale === "es" ? "Localizar" : "Locate"}</button> : null}
            {FIXABLE_FINDING_CODES.has(finding.code) && (finding.id || finding.ref) ? <button type="button" className={finding.code === "invalid_transition_order" ? "" : "danger"} onClick={() => onFixFinding(finding)}>{finding.code === "invalid_transition_order" ? (locale === "es" ? "Corregir orden" : "Fix order") : finding.code === "orphan_script_block" ? (locale === "es" ? "Eliminar bloque huérfano" : "Delete orphan") : (locale === "es" ? "Quitar referencia" : "Remove reference")}</button> : null}
          </div>
        </div>;
      })}</div> : <span className="clean">{locale === "es" ? "La historia no tiene hallazgos." : "Story graph is clean."}</span>}
    </div> : null}
  </div>;
}

function useBreadcrumbLongPress(onInspect: () => void) {
  const timerRef = useRef<number | undefined>(undefined);
  const pointerStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const triggeredRef = useRef(false);
  const clearTimer = () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    pointerStartRef.current = undefined;
  };
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.isPrimary === false) return;
      clearTimer();
      triggeredRef.current = false;
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        pointerStartRef.current = undefined;
        triggeredRef.current = true;
        onInspect();
      }, 520);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const start = pointerStartRef.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 9) clearTimer();
    },
    onPointerUp: () => {
      clearTimer();
      if (triggeredRef.current) window.setTimeout(() => { triggeredRef.current = false; }, 0);
    },
    onPointerCancel: clearTimer,
    onPointerLeave: () => { if (!triggeredRef.current) clearTimer(); },
    consumeClick: (event: ReactMouseEvent<HTMLElement>, action: () => void) => {
      if (triggeredRef.current) {
        event.preventDefault();
        event.stopPropagation();
        triggeredRef.current = false;
        return;
      }
      action();
    },
    consumeContextMenu: () => triggeredRef.current,
  };
}

function BreadcrumbCrumb({
  crumb,
  index,
  isLast,
  infoBadges,
  onNavigate,
  onInspect,
}: {
  crumb: { scope: CanvasScope; label: string };
  index: number;
  isLast: boolean;
  infoBadges: string[];
  onNavigate: () => void;
  onInspect: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const longPress = useBreadcrumbLongPress(onInspect);
  const openMenu = (point?: { x: number; y: number }) => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = point?.x ?? rect.left;
      const y = point?.y ?? rect.bottom + 6;
      setMenuPosition({ left: Math.max(8, Math.min(x, window.innerWidth - 198)), top: Math.max(8, Math.min(y, window.innerHeight - 72)) });
    }
    setHoverPosition(undefined);
    setMenuOpen(true);
  };
  const es = useInterfaceLocale() === "es";
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  const [hoverPosition, setHoverPosition] = useState<{
    left: number;
    top: number;
  }>();

  return (
    <span className="breadcrumb-crumb">
      <button
        ref={buttonRef}
        type="button"
        className={isLast ? "active" : ""}
        aria-current={isLast ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onClick={event => longPress.consumeClick(event, onNavigate)}
        onContextMenu={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!longPress.consumeContextMenu()) openMenu({ x: event.clientX, y: event.clientY });
        }}
        onKeyDown={event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); openMenu(); } }}
        onMouseEnter={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setHoverPosition({ left: rect.left, top: rect.bottom + 6 });
        }}
        onMouseLeave={() => setHoverPosition(undefined)}
      >
        {index === 0 ? <Home size={14} /> : <GitBranch size={14} />}
        <span>{crumb.label}</span>
      </button>
      {menuOpen ? createPortal(<div ref={menuRef} className="breadcrumb-inspector-menu" style={menuPosition} role="menu" aria-label={es ? "Opciones del breadcrumb" : "Breadcrumb options"} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setMenuOpen(false); buttonRef.current?.focus(); }
        if (event.key === "Tab") setMenuOpen(false);
       }}><button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onInspect(); }}>{es ? "Abrir inspector" : "Open inspector"}</button></div>, document.querySelector<HTMLElement>(".pathbranching-app") ?? document.body) : null}
      {hoverPosition && infoBadges.length ? (
        <div
          className="breadcrumb-hover-popup"
          role="tooltip"
          style={{ left: hoverPosition.left, top: hoverPosition.top }}
        >
          <strong>{crumb.label}</strong>
          {infoBadges.map((badge) => (
            <span key={badge}>{badge}</span>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function StoryCanvas({
  contextTab, contextFocus, onContextTabChange, onContextFocusChange,
  storyTestActive, inspectorRequest, inspectorSections, inspectorSize, onInspectorResize, inspectorStackOrder, onInspectorStackOrderChange, onInspectorSectionChange, onAuthoringMutation, onOpenInspectorSection, onPinInspectorTarget, onUnpinInspectorTarget, onCollapseInspector, inspectorDebugContent,
  project,
  authoringWorkspace,
  storyTestControls,
  storyTestWorkspace,
  storyTestPlayTab,
  onOpenStoryPlay,
  onAddTransitionWaypoint,
  onMoveTransitionWaypoint,
  onRemoveTransitionWaypoint,
  testingActive = false,
  propertiesConfig,
  files,
  nodes,
  edges,
  selection,
  findings,
  message,
  showStatusMessages,
  activeScope,
  primaryLocale,
  locales,
  localeNames,
  exportOpen,
  exportPreviewMode,
  dataOpen,
  markdownTabs,
  activeMarkdownTabId,
  eventDraft,
  manualInspectorDraft,
  manualInspectorEnabled,
  eventInspector,
  eventInspectorTabGroups,
  inspectorTabs,
  expandedInspectorTabId,
  inspectorMaximized,
  canvasBackground,
  minimapOpen,
  onMinimapOpenChange,
  canvasLayerMode,
  onCanvasLayerModeChange,
  onCanvasBackgroundChange,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStop,
  onSelect,
  onCanvasSelect,
  onOpenCanvasInspector,
  onNavigateScope,
  onOpenEventScript,
  onExportPreviewModeChange,
  onToggleData,
  onCreateEvent,
  onCreateNestedEvent,
  onCreateConnectedNestedEvent,
  onCreateConnectedNarrativeNode,
  onCreateConnectedEvent,
  onUpdateSequence,
  onUpdateBranch,
  onCreateEventInBranch,
  onUpdateEvent,
  onApplyEvpath,
  onCreateDecision,
  onCreateDialogue,
  onCreateDialogueBeat,
  onCreateEventDialogueBeat,
  onUpdateDecision,
  onUpdateDialogue,
  onUpdateDialogueBeat,
  onUpdateEventDialogueBeat,
  onImportSceneImage,
  onUpdateSpeechBeatCounter,
  onImportEventCoverImage,
  onAuxiliaryPanelChange,
  onUpdateScriptBlock,
  onCreateLocalSpeaker,
  onUpdateLocalizedText,
  onDeleteDialogueBeat,
  onDeleteEventDialogueBeat,
  onDeleteDecision,
  onDeleteDialogue,
  onCreateOutcome,
  onUpdateOutcome,
  onDeleteOutcome,
  onUpdateTransition,
  onCreateBoundaryRoute,
  onCreateBoundaryRouteEvent,
  onCreateDialogueBoundaryRoute,
  onCreateBoundaryEnd,
  onDeleteBoundaryEnd,
  onDiscardPendingBoundaryPort,
  onBoundarySelectionChange,
  onWorkspaceBoundsChange,
  onArrangeScopeNodes,
  onDeleteTransition,
  onCreateScriptTransition,
  onRemoveMissingEventReference,
  onRemoveBoundaryBinding,
  onNormalizeTransitionOrder,
  onDeleteScriptBlock,
  onFocusScriptBlock,
  onCreateCanonSuggestion,
  onUpdateCanonSuggestion,
  onDeleteCanonSuggestion,
  onCreateDataObject,
  onCreateKnowledgeObject,
  onUpdateDataObject,
  onDeleteDataObject,
  onEditCanonRef,
  onCreateCanonWorkingCopy,
  onSaveCanonWorkingCopy,
  onExportCanonChangeSet,
  onApplyCanonWorkingCopy,
  onUpdateLocalExplorerEntity,
  onPublishLocalExplorerEntity,
  onUpdateLocalExplorerType,
  onUpdateLocalExplorerProperty,
  onUpdateLogicPropertyOverride,
  onUpdateLogicTypeOverride,
  onUpdateCharacterCategories,
  onUpdateEdgeLabel,
  onDeleteSelection,
  onDeleteNodeSelections,
  onGroupDialogueMembers,
  onDetachDialogueMembers,
  onDissolveDialogue,
  onCreateDialogueStart,
  onCreateInteraction,
  onActivateMarkdownTab,
  onCloseMarkdownTab,
  onChangeMarkdownContent,
  onChangeMarkdownFormat,
  onSaveMarkdownTab,
  onOpenEventInspectorEvent,
  onCollapseEventInspectorEvent,
  onCloseEventInspectorEvent,
  onCloseAllEventInspectorEvents,
  onCloseEventInspectorEventsAbove,
  onCloseEventInspectorEventsBelow,
  onCloseOtherEventInspectorEvents,
  onCloseInspectorStackRange,
  onPruneEventInspectorEvents,
  collapseInspectorTabOnCanvasClick,
  onSaveEventInspectorTabGroup,
  onLoadEventInspectorTabGroup,
  onDeleteEventInspectorTabGroup,
  onOpenInspectorTab,
  onCloseInspectorTab,
  onCloseAllInspectorTabs,
  onDisableInspectorDebug,
  onToggleInspectorMaximized,
  onSaveManualInspector,
  onOpenRule,
}: {
  project: BranchingProject;
  storyTestActive:boolean;
  inspectorRequest?: InspectorRequest;
  inspectorSections: Record<string,string>;
  inspectorSize: InspectorSize;
  inspectorStackOrder: string[];
  onInspectorStackOrderChange: (order: string[]) => void;
  onInspectorResize:(size:InspectorSize)=>void;
  onInspectorSectionChange:(key:string,section:string)=>void;
  onAuthoringMutation:(mutate:(project:BranchingProject)=>BranchingProject)=>void|Promise<void>;
  onOpenInspectorSection:(target:Selection,section?:string,focusId?:string)=>void;
  onPinInspectorTarget:(target:Selection)=>void;
  onUnpinInspectorTarget:(target:Selection)=>void;
  onCollapseInspector:()=>void;
  inspectorDebugContent?:ReactNode;
  authoringWorkspace?: ReactNode;
  storyTestControls?: ReactNode;
  storyTestWorkspace?: ReactNode;
  storyTestPlayTab?: ReactNode;
  onOpenStoryPlay: () => void;
  onAddTransitionWaypoint: (edgeId: string, point: CanvasPoint) => void;
  onMoveTransitionWaypoint: (edgeId: string, index: number, point: CanvasPoint, commit: boolean) => void;
  onRemoveTransitionWaypoint: (edgeId: string, index: number) => void;
  contextTab: "edit" | "test";
  contextFocus: boolean;
  onContextTabChange: (value: "edit" | "test") => void;
  onContextFocusChange: (value: boolean) => void;
  testingActive?: boolean;
  propertiesConfig?: Record<string, unknown>;
  files: PathBranchingFileItem[];
  nodes: StoryCanvasNode[];
  edges: StoryCanvasEdge[];
  selection?: Selection;
  findings: ValidationFinding[];
  message?: string;
  showStatusMessages: boolean;
  activeScope?: CanvasScope;
  primaryLocale: string;
  locales: string[];
  localeNames?: Record<string, string>;
  exportOpen: boolean;
  exportPreviewMode: ExportPreviewMode;
  dataOpen: boolean;
  markdownTabs: MarkdownEditorTab[];
  activeMarkdownTabId?: string;
  eventDraft?: EventDraft;
  manualInspectorDraft?: ManualInspectorDraft;
  manualInspectorEnabled: boolean;
  eventInspector: EventInspectorState;
  eventInspectorTabGroups: EventInspectorTabGroup[];
  inspectorTabs: InspectorTab[];
  expandedInspectorTabId?: string;
  inspectorMaximized: boolean;
  canvasBackground: CanvasBackgroundSettings;
  minimapOpen: boolean;
  onMinimapOpenChange: (open: boolean) => void;
  canvasLayerMode: CanvasLayerMode;
  onCanvasLayerModeChange: (mode: CanvasLayerMode) => void;
  onCanvasBackgroundChange: (updates: Partial<CanvasBackgroundSettings>) => void;
  onNodesChange: (changes: NodeChange<StoryCanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<StoryCanvasEdge>[]) => void;
  onConnect: OnConnect;
  onNodeDragStop: (
    event: MouseEvent | TouchEvent | ReactMouseEvent,
    node: StoryCanvasNode,
  ) => void;
  onSelect: (selection?: Selection) => void;
  onCanvasSelect: (selection?: Selection) => void;
  onOpenCanvasInspector: (selection: Selection) => void;
  onNavigateScope: (scope: CanvasScope, selection?: Selection, options?: { preserveSelection?: boolean }) => void;
  onOpenEventScript: (eventId: string, textKey?: string) => void;
  onExportPreviewModeChange: (mode: ExportPreviewMode) => void;
  onToggleData: () => void;
  onCreateEvent: (
    type?: EventType,
    position?: { x: number; y: number },
    branchId?: string,
  ) => void;
  onCreateNestedEvent: (
    parentEventId: string,
    type?: EventType,
    position?: { x: number; y: number },
  ) => void;
  onCreateConnectedNestedEvent: (
    parentEventId: string,
    sourceNodeId: string,
    type: EventType,
    position: { x: number; y: number },
    sourceHandleId?: string,
  ) => void;
  onCreateConnectedNarrativeNode: (
    scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>,
    sourceNodeId: string,
    kind: ConnectedNarrativeNodeKind,
    position: CanvasPoint,
    sourceHandleId?: string,
    preset?: Pick<DialoguePreset, "characterRef" | "characterVariantId">,
  ) => void;
  onCreateConnectedEvent: (
    sourceNodeId: string,
    type: EventType,
    position: { x: number; y: number },
    sourceHandleId?: string,
  ) => void;
  onUpdateSequence: (id: string, updates: Partial<Sequence>) => void;
  onUpdateBranch: (id: string, updates: Partial<Branch>) => void;
  onCreateEventInBranch: (branchId: string, type?: EventType) => void;
  onUpdateEvent: (id: string, updates: Partial<EventNode>) => void;
  onApplyEvpath: (eventId: string, text: string) => EvpathApplyOutcome;
  onCreateDecision: (eventId: string, dialogueId?: string, position?: CanvasPoint) => void;
  onCreateDialogue: (eventId: string, position?: CanvasPoint) => void;
  onCreateDialogueBeat: (eventId: string, dialogueId: string, kind: DialogueBeat["kind"], position?: CanvasPoint) => void;
  onCreateEventDialogueBeat: (eventId: string, kind: DialogueBeat["kind"], position?: CanvasPoint) => void;
  onUpdateDecision: (
    eventId: string,
    decisionId: string,
    updates: Partial<Decision>,
  ) => void;
  onUpdateDialogue: (
    eventId: string,
    dialogueId: string,
    updates: Partial<DialogueNode>,
  ) => void;
  onUpdateDialogueBeat: (eventId: string, dialogueId: string, beatId: string, updates: Partial<DialogueBeat>) => void;
  onUpdateEventDialogueBeat: (eventId: string, beatId: string, updates: Partial<DialogueBeat>) => void;
  onUpdateSpeechBeatCounter: (updates: Partial<SpeechBeatCounterPreference>) => void;
  onImportSceneImage: (eventId: string, dialogueId: string | undefined, beatId: string) => void;
  onImportEventCoverImage: (eventId: string) => void;
  onAuxiliaryPanelChange: (nodeId: string, panel: "directorNote" | "sceneImage" | "coverImage" | "description", open: boolean) => void;
  onUpdateScriptBlock: (scriptId: string, blockId: string, updates: Partial<ScriptBlock>) => void;
  onCreateLocalSpeaker: (eventId: string, scriptId: string, blockId: string, name: string) => void;
  onUpdateLocalizedText: (textKey: string, locale: string, value: string) => void;
  onDeleteDialogueBeat: (eventId: string, dialogueId: string, beatId: string) => void;
  onDeleteEventDialogueBeat: (eventId: string, beatId: string) => void;
  onDeleteDecision: (eventId: string, decisionId: string) => void;
  onDeleteDialogue: (eventId: string, dialogueId: string) => void;
  onCreateOutcome: (eventId: string, decisionId: string) => void;
  onUpdateOutcome: (
    eventId: string,
    decisionId: string,
    outcomeId: string,
    updates: Partial<Outcome>,
  ) => void;
  onDeleteOutcome: (
    eventId: string,
    decisionId: string,
    outcomeId: string,
  ) => void;
  onUpdateTransition: (
    transitionId: string,
    updates: Partial<Transition>,
  ) => void;
  onCreateBoundaryRoute: (eventId: string, targetEventId: string, direction: "input" | "output", slotId?: string) => void;
  onCreateBoundaryRouteEvent: (eventId: string, direction: "input" | "output", slotId?: string) => void;
  onCreateDialogueBoundaryRoute: (eventId: string, dialogueId: string, direction: "input" | "output", targetId: string, slotId: string) => void;
  onCreateBoundaryEnd: (eventId: string, direction: "input" | "output", position: { x: number; y: number }, dialogueId?: string) => void;
  onDeleteBoundaryEnd: (eventId: string, direction: "input" | "output", slotId: string, dialogueId?: string) => void;
  onDiscardPendingBoundaryPort: (preserveNodeId?: string) => void;
  onBoundarySelectionChange: (selectedNodeIds: string[]) => void;
  onWorkspaceBoundsChange: (
    scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>,
    bounds: SubcanvasWorkspaceBounds,
    persist: boolean,
  ) => void;
  onArrangeScopeNodes: (options: {
    mode: NestedLayoutMode;
    columns: number;
    horizontalGapCells: number;
    verticalGapCells: number;
    selectedNodeIds?: string[];
    automatic?: boolean;
  }) => void;
  onDeleteTransition: (transitionId: string) => void;
  onCreateScriptTransition?: (eventId: string, from: string, to: string) => void;
  onRemoveMissingEventReference: (
    ownerId: string,
    missingEventId: string,
  ) => void;
  onRemoveBoundaryBinding: (bindingId: string) => void;
  onNormalizeTransitionOrder: (sourceId: string) => void;
  onDeleteScriptBlock: (blockKey: string) => void;
  onFocusScriptBlock: (target: { scriptId: string; blockId: string }) => void;
  onCreateCanonSuggestion: (
    canonRefId: string,
    source?: { eventId?: string; dataObjectId?: string },
  ) => void;
  onUpdateCanonSuggestion: (
    id: string,
    updates: Partial<CanonEditSuggestion>,
  ) => void;
  onDeleteCanonSuggestion: (id: string) => void;
  onCreateDataObject: (classId: string) => void;
  onCreateKnowledgeObject: () => void;
  onUpdateDataObject: (id: string, updates: Partial<ProjectDataObject>) => void;
  onDeleteDataObject: (id: string) => void;
  onEditCanonRef: (ref: CanonRef) => void;
  onCreateCanonWorkingCopy: (ref: CanonRef) => void;
  onSaveCanonWorkingCopy: (canonRefId: string, content: string) => void;
  onExportCanonChangeSet: (canonRefId: string) => void;
  onApplyCanonWorkingCopy: (canonRefId: string) => void;
  onUpdateLocalExplorerEntity: (
    id: string,
    updates: Partial<LocalExplorerEntity>,
  ) => void;
  onPublishLocalExplorerEntity: (id: string) => void;
  onUpdateLocalExplorerType: (
    id: string,
    updates: Partial<LocalExplorerType>,
  ) => void;
  onUpdateLocalExplorerProperty: (
    id: string,
    updates: Partial<LocalExplorerProperty>,
  ) => void;
  onUpdateLogicPropertyOverride: (propertyId: string, source: "canon" | "local", changes: Partial<LogicPropertyOverride>) => void;
  onUpdateLogicTypeOverride: (typeId: string, source: "canon" | "local", changes: Partial<LogicTypeOverride>) => void;
  onUpdateCharacterCategories: (categories: string[]) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onDeleteSelection: (selection: Selection) => void;
  onDeleteNodeSelections: (nodeIds: string[]) => void;
  onGroupDialogueMembers: (nodeIds: string[]) => void;
  onDetachDialogueMembers: (nodeIds: string[]) => void;
  onDissolveDialogue: (eventId: string, dialogueId: string) => void;
  onCreateDialogueStart: (eventId: string, position?: CanvasPoint) => void;
  onCreateInteraction: (eventId: string, dialogueId?: string, position?: CanvasPoint) => void;
  onActivateMarkdownTab: (id: string) => void;
  onCloseMarkdownTab: (id: string) => void;
  onChangeMarkdownContent: (id: string, content: string) => void;
  onChangeMarkdownFormat: (id: string, format: MarkdownDraftFormat) => void;
  onSaveMarkdownTab: (id: string) => void;
  onOpenEventInspectorEvent: (eventId: string) => void;
  onCollapseEventInspectorEvent: (eventId: string) => void;
  onCloseEventInspectorEvent: (eventId: string) => void;
  onCloseAllEventInspectorEvents: () => void;
  onCloseEventInspectorEventsAbove: (eventId: string) => void;
  onCloseEventInspectorEventsBelow: (eventId: string) => void;
  onCloseOtherEventInspectorEvents: (eventId: string) => void;
  onCloseInspectorStackRange: (target: InspectorStackTarget, direction: "above" | "below" | "others") => void;
  onPruneEventInspectorEvents: (eventIds: readonly string[]) => void;
  collapseInspectorTabOnCanvasClick: boolean;
  onSaveEventInspectorTabGroup: () => void;
  onLoadEventInspectorTabGroup: (groupId: string) => void;
  onDeleteEventInspectorTabGroup: (groupId: string) => void;
  onOpenInspectorTab: (id: string) => void;
  onCloseInspectorTab: (id: string) => void;
  onCloseAllInspectorTabs: () => void;
  onDisableInspectorDebug: () => void;
  onToggleInspectorMaximized: () => void;
  onSaveManualInspector: () => void;
  onOpenRule: (id: string) => void;
}) {
  const canvasUiLocale = useInterfaceLocale();
  const ui = authoringUiCopy(canvasUiLocale);
  const shellRef = useRef<HTMLElement | null>(null);
  const canvasToolRowRef = useRef<HTMLDivElement | null>(null);
  const [canvasToolRowHeight, setCanvasToolRowHeight] = useState(38);
  const lastCanvasSelection = useRef(selection);
  const [activePinKey, setActivePinKey] = useState<string>();
  // Conversation focus highlights a canvas row without navigating away from its owner inspector.
  const [conversationHighlightedNodeId, setConversationHighlightedNodeId] = useState<string>();
  const [validationHighlight, setValidationHighlight] = useState<{ nodeIds: string[]; transitionIds: string[] }>();
  const validationHighlightTimerRef = useRef<number | undefined>(undefined);
  const validationHighlightRevisionRef = useRef(0);
  const highlightValidationTarget = useCallback((nodeIds: string[], transitionIds: string[]) => {
    const revision = ++validationHighlightRevisionRef.current;
    if (validationHighlightTimerRef.current !== undefined) window.clearTimeout(validationHighlightTimerRef.current);
    setValidationHighlight({ nodeIds, transitionIds });
    validationHighlightTimerRef.current = window.setTimeout(() => {
      if (validationHighlightRevisionRef.current === revision) setValidationHighlight(undefined);
      validationHighlightTimerRef.current = undefined;
    }, 5200);
  }, []);
  useEffect(() => () => {
    if (validationHighlightTimerRef.current !== undefined) window.clearTimeout(validationHighlightTimerRef.current);
  }, []);
  useEffect(() => { setConversationHighlightedNodeId(undefined); }, [selection?.type, selection?.id, project.projectId, project.storyId, activeScope?.kind, activeScope?.id]);
  useEffect(() => {
    if (selection && inspectorSelectionKey(selection) === activePinKey) return;
    setActivePinKey(undefined);
    if (selection) lastCanvasSelection.current = selection;
  }, [selection, activePinKey]);
  // Keep the dock mounted while any ordinary inspector remains open. Closing
  // the final event card must not hide unrelated inspector tabs beside it.
  const contextVisible = eventInspector.open || inspectorTabs.length > 0 || storyTestActive;
  useEffect(() => {
    const element = canvasToolRowRef.current;
    if (!element) return;
    const measureNow = () => {
      const measuredHeight = Math.round(element.getBoundingClientRect().height);
      if (measuredHeight > 0) setCanvasToolRowHeight(current => current === measuredHeight ? current : measuredHeight);
    };
    let frame: number | undefined;
    const scheduleMeasure = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        measureNow();
      });
    };
    measureNow();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(()=>{if(storyTestActive)onContextTabChange("test");},[storyTestActive]);
  useEffect(()=>{if(!storyTestActive && contextTab === "test")onContextTabChange("edit");},[storyTestActive,contextTab]);
  useEffect(()=>{if(inspectorRequest?.requestId)onContextTabChange("edit");},[inspectorRequest?.requestId]);
  const [logicFocus, setLogicFocus] = useState<{
    selectionKey: string;
    part: "conditions" | "consequences";
  }>();
  const pendingEdgeClickRef = useRef<{
    edgeId: string;
    timer?: number;
  } | undefined>(undefined);
  const connectionGestureRef = useRef(false);
  const suppressNodeInspectorUntilRef = useRef(0);
  const pendingSubcanvasInspectorRef = useRef<{ nodeId: string; timer: number } | undefined>(undefined);
  const clearPendingSubcanvasInspector = useCallback(() => {
    const pending = pendingSubcanvasInspectorRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingSubcanvasInspectorRef.current = undefined;
  }, []);
  useEffect(() => () => clearPendingSubcanvasInspector(), [clearPendingSubcanvasInspector]);
  const directedNodeHoldRef = useRef<{
    nodeId: string;
    timer: number;
    pointerId: number;
    clientX: number;
    clientY: number;
  } | undefined>(undefined);
  const pendingLocateNodeRef = useRef<{ id: string; openInspector?: boolean } | undefined>(undefined);
  const pendingLocateFitSkipRef = useRef<string | undefined>(undefined);
  const draggedNodeRef = useRef(false);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<any, any>>();
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu>();
  const contextMenuFocusRef = useRef<HTMLElement | null>(null);
  const contextMenuWasOpenRef = useRef(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string>();
  const [draggingEvent, setDraggingEvent] = useState(false);
  const [directedNodeOpening, setDirectedNodeOpening] = useState(true);
  const [canvasToolsOpen, setCanvasToolsOpen] = useState(false);
  const canvasToolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [canvasToolsPosition, setCanvasToolsPosition] = useState({ left: 0, top: 0 });
  const [autoFitPaddingGridPoints, setAutoFitPaddingGridPoints] = useState(5);
  const [gridLayoutColumns, setGridLayoutColumns] = useState(5);
  const [gridLayoutHorizontalGap, setGridLayoutHorizontalGap] = useState(3);
  const [gridLayoutVerticalGap, setGridLayoutVerticalGap] = useState(3);
  const [nestedLayoutMode, setNestedLayoutMode] = useState<NestedLayoutMode>("grid");
  const arrangedNarrativeNodeIdsRef = useRef<{ scopeKey: string; ids: Set<string> } | undefined>(undefined);
  const [canvasLocale, setCanvasLocale] = useState(primaryLocale);
  const [canvasLocaleMenuOpen, setCanvasLocaleMenuOpen] = useState(false);
  const [inspectorToolbarHost, setInspectorToolbarHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeScope || activeScope.kind !== "dialogue") {
      arrangedNarrativeNodeIdsRef.current = undefined;
      return;
    }

    const scopeKey = canvasScopeKey(activeScope);
    const movableNodeIds = new Set(nodes.filter(isNestedLayoutMovableNode).map((node) => node.id));
    const previous = arrangedNarrativeNodeIdsRef.current;
    arrangedNarrativeNodeIdsRef.current = { scopeKey, ids: movableNodeIds };

    if (!previous || previous.scopeKey !== scopeKey) return;
    const addedNarrativeNode = [...movableNodeIds].some((id) => !previous.ids.has(id));
    if (!addedNarrativeNode) return;

    onArrangeScopeNodes({
      mode: nestedLayoutMode,
      columns: gridLayoutColumns,
      horizontalGapCells: gridLayoutHorizontalGap,
      verticalGapCells: gridLayoutVerticalGap,
      selectedNodeIds: [],
      automatic: true,
    });
  }, [activeScope, gridLayoutColumns, gridLayoutHorizontalGap, gridLayoutVerticalGap, nestedLayoutMode, nodes, onArrangeScopeNodes]);

  useEffect(() => {
    if (!canvasToolsOpen) return;
    const syncCanvasToolsPosition = () => {
      const rect = canvasToolsTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCanvasToolsPosition({ left: rect.right + 8, top: rect.bottom });
    };
    syncCanvasToolsPosition();
    window.addEventListener("resize", syncCanvasToolsPosition);
    window.addEventListener("scroll", syncCanvasToolsPosition, true);
    return () => {
      window.removeEventListener("resize", syncCanvasToolsPosition);
      window.removeEventListener("scroll", syncCanvasToolsPosition, true);
    };
  }, [canvasToolsOpen]);

  useEffect(() => {
    if (contextMenu) {
      contextMenuWasOpenRef.current = true;
      return;
    }
    if (!contextMenuWasOpenRef.current) return;
    contextMenuWasOpenRef.current = false;
    window.requestAnimationFrame(() => {
      const target = contextMenuFocusRef.current ?? shellRef.current;
      target?.focus({ preventScroll: true });
      contextMenuFocusRef.current = null;
    });
  }, [contextMenu]);
  const canvasLocaleOptions = useMemo(
    () => normalizeLocaleList(primaryLocale, locales),
    [locales, primaryLocale],
  );
  useEffect(() => {
    setCanvasLocale((current) => canvasLocaleOptions.includes(current) ? current : primaryLocale);
  }, [canvasLocaleOptions, primaryLocale]);

  const clearPendingEdgeClick = useCallback(() => {
    const pending = pendingEdgeClickRef.current;
    if (pending?.timer !== undefined) {
      window.clearTimeout(pending.timer);
    }
    pendingEdgeClickRef.current = undefined;
  }, []);

  const clearDirectedNodeHold = useCallback(() => {
    const pending = directedNodeHoldRef.current;
    if (pending) window.clearTimeout(pending.timer);
    directedNodeHoldRef.current = undefined;
  }, []);

  useEffect(() => {
    clearDirectedNodeHold();
  }, [activeScope?.kind, activeScope?.id, canvasLayerMode, directedNodeOpening, clearDirectedNodeHold]);

  useEffect(() => {
    return () => {
      clearPendingEdgeClick();
      clearDirectedNodeHold();
    };
  }, [clearDirectedNodeHold, clearPendingEdgeClick]);

  const inspectorNodeStates = useMemo(() => {
    const states = new Map<string, "open" | "expanded">();
    eventInspector.openEventIds.forEach((id) => states.set(id, "open"));
    if (eventInspector.expandedEventId) states.set(eventInspector.expandedEventId, "expanded");
    inspectorTabs.forEach((tab) => {
      if (tab.selection.type !== "node") return;
      states.set(tab.selection.id, expandedInspectorTabId === tab.id ? "expanded" : "open");
    });
    return states;
  }, [eventInspector.expandedEventId, eventInspector.openEventIds, expandedInspectorTabId, inspectorTabs]);
  const inspectorSelectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const activeTab = inspectorTabs.find((tab) => tab.id === expandedInspectorTabId);
    if (activeTab?.selection.type === "node") ids.add(activeTab.selection.id);
    if (eventInspector.expandedEventId) ids.add(eventInspector.expandedEventId);
    return ids;
  }, [eventInspector.expandedEventId, expandedInspectorTabId, inspectorTabs]);
  const inspectorEdgeStates = useMemo(() => {
    const states = new Map<string, "open" | "expanded">();
    inspectorTabs.forEach((tab) => {
      if (tab.selection.type === "edge") {
        states.set(tab.selection.id, expandedInspectorTabId === tab.id ? "expanded" : "open");
      }
    });
    return states;
  }, [expandedInspectorTabId, inspectorTabs]);
  const commitEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      onUpdateEdgeLabel(edgeId, label);
      setEditingEdgeId(undefined);
    },
    [onUpdateEdgeLabel],
  );
  const [returnConnectorWidths, setReturnConnectorWidths] = useState<Record<string, number>>({});
  const measureReturnConnector = useCallback((edgeId: string, width: number) => {
    setReturnConnectorWidths(current => current[edgeId] === width ? current : { ...current, [edgeId]: width });
  }, []);
  const returnConnectors = useMemo(() => {
    const connectors = canvasReturnConnectors(nodes, edges);
    connectors.forEach(connector => { connector.width = returnConnectorWidths[connector.edgeId]; });
    return connectors;
  }, [nodes, edges, returnConnectorWidths]);
  const cachePresentedNodes = useMemo(() => createCanvasPresentationCache<StoryCanvasNode>(), []);
  const cachePresentedEdges = useMemo(() => createCanvasPresentationCache<StoryCanvasEdge>(), []);
  const projectedGraph = useMemo(
    () => ({
      nodes: nodes.map((node) => ({
        ...node,
        selected:
          node.id === conversationHighlightedNodeId ||
          inspectorSelectedNodeIds.has(node.id) ||
          (!inspectorNodeStates.has(node.id) && node.selected),
        data: {
          ...node.data,
          validationHighlight: validationHighlight?.nodeIds.includes(node.id) === true,
          onOpenInspectorSection:(section:string,target?:Selection,focusId?:string)=>onOpenInspectorSection(target ?? {type:"node",id:node.id},section,focusId),
          onOpenLogicPart:(part:"conditions"|"consequences")=>onOpenInspectorSection({type:"node",id:node.id},part),
          inspectorState: inspectorNodeStates.get(node.id),
          details: {
            ...node.data.details,
            coverImage:
              node.data.kind === "event" && node.data.details?.showEventOverview === true
                ? eventCoverImageForNode(project, node.data.details.event as EventNode)
                : undefined,
            dialogueTriggerPortraitUrl:
              node.data.kind === "dialogueStart"
                ? dialogueTriggerPortraitUrl(
                    project,
                    propertiesConfig,
                    node.data.details?.start as DialogueStart | undefined,
                  )
                : undefined,
            dialogueTriggerEditor:
              node.data.kind === "dialogueStart" && typeof node.data.details?.eventId === "string"
                ? (() => {
                    const eventId = node.data.details.eventId as string;
                    const start = node.data.details?.start as DialogueStart | undefined;
                    const triggerEvent = findEvent(project, eventId);
                    const eligibleEntityIds = new Set(
                      project.canonRefs
                        .filter((ref) => entitySupportsDialogueTrigger(project, ref))
                        .map((ref) => ref.id),
                    );
                    const presentEntityIds = (triggerEvent?.presentEntityRefs ?? triggerEvent?.canonRefs ?? [])
                      .filter((id) => eligibleEntityIds.has(id));
                    const speakerOptions = project.canonRefs
                      .filter((canonRef) => eligibleEntityIds.has(canonRef.id))
                      .map((canonRef) => {
                        const variants = canonVariantsForRef(canonRef).map((variant) => {
                          const portrait = canonPresentationImageForRef(
                            propertiesConfig,
                            { ...canonRef, frontmatter: resolveCanonVariantFrontmatter(canonRef, variant.id) },
                            "portrait",
                          );
                          return {
                            ...variant,
                            portraitUrl: portrait ? canonVaultImageUrl(project, portrait.value) : undefined,
                          };
                        });
                        const portrait = variants.find((variant) => variant.id === "base")?.portraitUrl;
                        return {
                          id: canonRef.id,
                          label: canonRef.label ?? canonRef.id,
                          portraitUrl: portrait,
                          variants,
                        };
                      });
                    const selectedCharacterId = start?.source?.kind === "canonRef" ? start.source.id : undefined;
                    const selectedActionId = start?.source?.kind === "canonRef" ? start.source.propertyId : undefined;
                    return {
                      speakerOptions,
                      presentEntityIds,
                      selectedCharacterId,
                      triggerActions: DIALOGUE_TRIGGER_ACTIONS,
                      selectedActionId,
                      onCharacterChange: (characterId?: string) => {
                        const currentTriggerEvent = findEvent(project, eventId);
                        if (!currentTriggerEvent || !start) return;
                        const currentPresentEntityRefs = currentTriggerEvent.presentEntityRefs ?? currentTriggerEvent.canonRefs ?? [];
                        const updatedPresentEntityRefs = characterId && !currentPresentEntityRefs.includes(characterId)
                          ? [...currentPresentEntityRefs, characterId]
                          : currentPresentEntityRefs;
                        const newSource: DialogueStart["source"] | undefined = characterId
                          ? { kind: "canonRef", id: characterId }
                          : undefined;
                        onUpdateEvent(eventId, {
                          presentEntityRefs: updatedPresentEntityRefs,
                          dialogueStarts: (currentTriggerEvent.dialogueStarts ?? []).map((s) =>
                            s.id === start.id ? { ...s, source: newSource } : s,
                          ),
                        });
                      },
                      onActionChange: (actionId?: string) => {
                        const currentTriggerEvent = findEvent(project, eventId);
                        if (!currentTriggerEvent || !start) return;
                        const currentStart = (currentTriggerEvent.dialogueStarts ?? []).find((s) => s.id === start.id);
                        const currentSource = currentStart?.source;
                        if (currentSource?.kind !== "canonRef") return;
                        onUpdateEvent(eventId, {
                          dialogueStarts: (currentTriggerEvent.dialogueStarts ?? []).map((s) =>
                            s.id === start.id
                              ? { ...s, source: { ...currentSource, propertyId: actionId } }
                              : s,
                          ),
                        });
                      },
                    };
                  })()
                : undefined,
            eventEditor:
              node.data.kind === "event" && node.data.details?.showEventOverview === true
                ? (() => {
                    const event = node.data.details.event as EventNode;
                    const scopeKey = activeScope && activeScope.kind !== "sequence" ? canvasScopeKey(activeScope) : undefined;
                    const auxiliaryPanels = scopeKey
                      ? project.canvas?.scopes?.[scopeKey]?.nodes?.[node.id]?.auxiliaryPanels
                      : project.canvas?.nodes?.[node.id]?.auxiliaryPanels;
                    return {
                      description: event.description ?? "",
                      coverImage: eventCoverImageForNode(project, event),
                      imageAssets: imageAssetsForLocation(project, event.locationRef),
                      coverImageOpen: auxiliaryPanels?.coverImage ?? false,
                      descriptionOpen: auxiliaryPanels?.description ?? false,
                      onDescriptionUpdate: (value: string) => onUpdateEvent(event.id, { description: value || undefined }),
                      onCoverImageUpdate: (assetId?: string) => {
                        onUpdateEvent(event.id, {
                          coverImage: assetId
                            ? { id: event.coverImage?.id ?? `event-cover:${crypto.randomUUID()}`, assetId }
                            : undefined,
                        });
                        onAuxiliaryPanelChange(node.id, "coverImage", false);
                      },
                      onImportCoverImage: () => onImportEventCoverImage(event.id),
                      onAuxiliaryPanelChange: (panel: "coverImage" | "description", open: boolean) => onAuxiliaryPanelChange(node.id, panel, open),
                    };
                  })()
                : undefined,
            workspaceEditor:
            node.data.kind === "workspace" &&
            activeScope &&
            activeScope.kind !== "sequence"
              ? {
                  bounds: {
                    x: node.position.x,
                    y: node.position.y,
                    width: node.width ?? 720,
                    height: node.height ?? 460,
                  },
                  minBounds: fitSubcanvasWorkspaceBounds(
                    nodes,
                    autoFitPaddingGridPoints,
                    canvasBackground.gridSize,
                  ),
                  onPreview: (bounds: SubcanvasWorkspaceBounds) =>
                    onWorkspaceBoundsChange(activeScope, bounds, false),
                  onCommit: (bounds: SubcanvasWorkspaceBounds) =>
                    onWorkspaceBoundsChange(activeScope, bounds, true),
                }
              : undefined,
            endAdder:
              node.data.kind === "endAdder" &&
              typeof node.data.details?.eventId === "string"
                ? {
                    onAdd: (direction: "input" | "output", position: { x: number; y: number }, dialogueId?: string) =>
                      onCreateBoundaryEnd(node.data.details?.eventId as string, direction, position, dialogueId),
                  }
                : undefined,
            routeEditor:
            activeScope?.kind === "dialogue" &&
            node.data.kind === "boundary" &&
            (node.data.details?.direction === "input" || node.data.details?.direction === "output") &&
            typeof node.data.details?.eventId === "string" &&
            typeof node.data.details?.dialogueId === "string" &&
            (typeof node.data.details?.slotId === "string" || typeof node.data.details?.transitionId === "string")
              ? (() => {
                  const eventId = node.data.details!.eventId as string;
                  const dialogueId = node.data.details!.dialogueId as string;
                  const direction = node.data.details!.direction as "input" | "output";
                  const slotId = typeof node.data.details!.slotId === "string"
                    ? node.data.details!.slotId as string
                    : undefined;
                  const transitionId = typeof node.data.details!.transitionId === "string"
                    ? node.data.details!.transitionId as string
                    : undefined;
                  const event = project.events.find((candidate) => candidate.id === eventId);
                  const dialogue = event?.dialogues?.find((candidate) => candidate.id === dialogueId);
                  const route = transitionId
                    ? event?.transitions?.find((candidate) => candidate.id === transitionId)
                    : undefined;
                  if (!event || !dialogue || (transitionId && !route) || (!transitionId && !slotId)) return undefined;
                  const returnToDialogue = {
                    id: `dialogue:${eventId}:${dialogueId}`,
                    label: `${canvasUiLocale === "es" ? "Volver a esta conversación" : "Return to this conversation"} · ${dialogue.title}`,
                  };
                  const siblingDialogues = (event.dialogues ?? [])
                    .filter((dialogue) => dialogue.id !== dialogueId)
                    .map((dialogue) => ({
                      id: `dialogue:${eventId}:${dialogue.id}`,
                      label: `${dialogue.title} · ${canvasUiLocale === "es" ? "Conversación" : "Conversation"}`,
                    }));
                  const childEventIds = new Set([
                    ...(event.childEventIds ?? []),
                    ...project.events.filter((candidate) => candidate.parentEventId === eventId).map((child) => child.id),
                  ]);
                  const incomingFromEvents = project.events
                    .filter((sourceEvent) => sourceEvent.id !== eventId && !childEventIds.has(sourceEvent.id))
                    .flatMap((sourceEvent) => (sourceEvent.transitions ?? [])
                      .filter((transition) => transition.to === eventId)
                      .map((transition) => ({
                        id: `boundary:${eventId}:input:${transition.id}`,
                        label: `${sourceEvent.name} · ${canvasUiLocale === "es" ? "Entrada" : "Entry"}`,
                      })));
                  const incomingFromSequences = project.sequences
                    .filter((sequence) => sequence.entryEventId === eventId)
                    .map((sequence) => ({
                      id: `boundary:${eventId}:input:sequence-entry:${sequence.id}`,
                      label: `${sequence.name || (canvasUiLocale === "es" ? "Historia" : "Story")} · ${canvasUiLocale === "es" ? "Entrada" : "Entry"}`,
                    }));
                  const inputSlots = (project.canvas?.scopes?.[`event:${eventId}`]?.entrySlots ?? [])
                    .map((slotId) => ({
                      id: `boundary:${eventId}:input:${slotId}`,
                      label: `${canvasUiLocale === "es" ? "Nueva entrada" : "New entry"} · ${slotId}`,
                    }));
                  const incomingTargets = [...incomingFromEvents, ...incomingFromSequences, ...inputSlots];
                  const entryTargets = incomingTargets.length
                    ? incomingTargets
                    : [{
                        id: `boundary:${eventId}:input:entry`,
                        label: `${canvasUiLocale === "es" ? "Entrada del evento" : "Event entry"} · ${event.name}`,
                      }];
                  const childEvents = project.events
                    .filter((candidate) => childEventIds.has(candidate.id))
                    .map((child) => ({
                      id: child.id,
                      label: `${child.name} · ${canvasUiLocale === "es" ? "Subevento" : "Subevent"}`,
                    }));
                  const targets = direction === "input"
                    ? [...siblingDialogues, ...entryTargets]
                    : [returnToDialogue, ...siblingDialogues, ...childEvents];
                  const selectedTargetId = route
                    ? direction === "output" ? route.to : route.from
                    : undefined;
                  if (transitionId && !targets.some((target) => target.id === selectedTargetId)) return undefined;
                  return {
                    direction,
                    selectedTargetId,
                    targets,
                    onTargetChange: (targetId: string) => {
                      if (transitionId) {
                        onUpdateTransition(transitionId, direction === "input" ? { from: targetId } : { to: targetId });
                      } else if (slotId) {
                        onCreateDialogueBoundaryRoute(eventId, dialogueId, direction, targetId, slotId);
                      }
                    },
                    onDeleteEnd: transitionId
                      ? () => onDeleteTransition(transitionId)
                      : slotId
                        ? () => onDeleteBoundaryEnd(eventId, direction, slotId, dialogueId)
                        : undefined,
                  };
                })()
              :
            activeScope?.kind === "event" &&
            node.data.kind === "boundary" &&
            (node.data.details?.direction === "output" ||
              (node.data.details?.direction === "input" && typeof node.data.details?.slotId === "string")) &&
            node.data.details?.restart !== true &&
            typeof node.data.details?.eventId === "string"
              ? (() => {
                  const eventId = node.data.details.eventId;
                  const direction = node.data.details?.direction === "input" ? "input" as const : "output" as const;
                  const transitionId = typeof node.data.details?.transitionId === "string"
                    ? node.data.details.transitionId
                    : undefined;
                  const slotId = typeof node.data.details?.slotId === "string"
                    ? node.data.details.slotId
                    : undefined;
                  const selectedTargetId = typeof node.data.details?.targetEventId === "string"
                    ? node.data.details.targetEventId
                    : undefined;
                  return {
                    direction,
                    selectedTargetId,
                    targets: project.events
                      .filter((event) => event.id !== eventId && !(direction === "input" && event.parentEventId === eventId))
                      .map((event) => {
                        const branch = event.branchRef
                          ? project.branches.find((candidate) => candidate.id === event.branchRef)
                          : undefined;
                        return {
                          id: event.id,
                          label: `${event.name} · ${branch?.title ?? "No branch"}`,
                        };
                      }),
                    onTargetChange: (targetEventId: string) => {
                      if (transitionId) {
                        onUpdateTransition(transitionId, { to: targetEventId });
                      } else {
                        onCreateBoundaryRoute(eventId, targetEventId, direction, slotId);
                      }
                    },
                    onCreateTarget: () => onCreateBoundaryRouteEvent(eventId, direction, slotId),
                    onDeleteEnd:
                      !transitionId && slotId && (direction === "input" || slotId !== "exit")
                        ? () => onDeleteBoundaryEnd(eventId, direction, slotId)
                        : undefined,
                  };
                })()
              : undefined,
            decisionEditor:
            node.data.kind === "decision" &&
            typeof node.data.details?.eventId === "string" &&
            (node.data.details?.decision as Decision | undefined)?.id
              ? (() => {
                  const eventId = node.data.details!.eventId as string;
                  const decision = node.data.details!.decision as Decision;
                  const optionStyle = project.logicFormats?.decisionOptionStyle ?? (decision.optionStyle === "iconOnly" ? "iconOnly" : "visibleText");
                  return {
                    optionStyle,
                    onOutcomeUpdate: (outcomeId: string, updates: Partial<Pick<Outcome, "visibleText">>) =>
                      onUpdateOutcome(eventId, decision.id, outcomeId, updates),
                    onOutcomeReorder: (outcomeId: string, targetOutcomeId: string, position: "before" | "after") => {
                      const outcomes = mutations.reorderOutcomeList(decision.outcomes, outcomeId, targetOutcomeId, position);
                      if (outcomes !== decision.outcomes) onUpdateDecision(eventId, decision.id, { outcomes });
                    },
                    onCreateOutcome: () => onCreateOutcome(eventId, decision.id),
                    onDeleteOutcome: (outcomeId: string) =>
                      onDeleteOutcome(eventId, decision.id, outcomeId),
                  };
                })()
              : undefined,
            quickEditor:
            (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") &&
            typeof (node.data.details?.beat as { blockRef?: { scriptId?: unknown; blockId?: unknown } } | undefined)?.blockRef?.scriptId === "string" &&
            typeof (node.data.details?.beat as { blockRef?: { scriptId?: unknown; blockId?: unknown } } | undefined)?.blockRef?.blockId === "string"
              ? (() => {
                  const block = node.data.details?.block as ScriptBlock | undefined;
                  const beat = node.data.details!.beat as DialogueBeat;
                  const blockRef = beat.blockRef;
                  const textKey = block?.textKey ?? scriptBlockTextKey(blockRef.scriptId, blockRef.blockId);
                  const beatEventId = typeof node.data.details?.eventId === "string" ? node.data.details.eventId : undefined;
                  const beatEvent = beatEventId ? project.events.find((event) => event.id === beatEventId) : undefined;
                  const presentEntityRefs = beatEvent?.presentEntityRefs ?? beatEvent?.canonRefs ?? [];
                  const currentCharacterRef = block?.characterRef ?? block?.speakerRef;
                  const currentCanonRef = project.canonRefs.find((canonRef) => canonRef.id === currentCharacterRef);
                  const activeText = block
                    ? blockValues(project, blockRef.scriptId, block, primaryLocale)[canvasLocale] ?? ""
                    : "";
                  const universeSpeechCounter = project.authoringPreferences?.speechBeatCounter;
                  const lengthTarget = beat.kind === "speech"
                    ? beatEvent?.speechBeatLengthTarget ?? (universeSpeechCounter?.enabled
                      ? { unit: universeSpeechCounter.unit, target: universeSpeechCounter.target }
                      : undefined)
                    : undefined;
                  const textCount = !lengthTarget
                    ? 0
                    : lengthTarget.unit === "words"
                      ? activeText.trim() ? activeText.trim().split(/\s+/u).length : 0
                      : Array.from(activeText).length;
                  const canonSpeakerOptions: DialoguePresetSpeakerOption[] = project.canonRefs
                    .filter((canonRef) => canonRefIsEntityPresentable(project, propertiesConfig, canonRef))
                    .map((canonRef) => {
                      const variants = canonVariantsForRef(canonRef).map((variant) => {
                        const portrait = canonPresentationImageForRef(
                          propertiesConfig,
                          { ...canonRef, frontmatter: resolveCanonVariantFrontmatter(canonRef, variant.id) },
                          "portrait",
                        );
                        return {
                          ...variant,
                          portraitUrl: portrait ? canonVaultImageUrl(project, portrait.value) : undefined,
                        };
                      });
                      const portrait = variants.find((variant) => variant.id === "base")?.portraitUrl;
                      return {
                        id: canonRef.id,
                        label: canonRef.label ?? canonRef.id,
                        portraitUrl: portrait,
                        variants,
                        source: "canon" as const,
                      };
                    });
                  const localSpeakerOptions: DialoguePresetSpeakerOption[] = (project.localExplorerEntities ?? [])
                    .filter((entity) => localEntityIsSpeaker(project, entity))
                    .map((entity) => ({
                      id: entity.id,
                      label: entity.name,
                      kind: entity.type,
                      variants: [{ id: "base", label: entity.name }],
                      source: entity.publishedPath ? "published" as const : "local" as const,
                    }));
                  const speakerOptions = [...canonSpeakerOptions, ...localSpeakerOptions];
                  const dialoguePresets = recentDialoguePresets(
                    nodes,
                    edges,
                    node.id,
                    project.canonRefs,
                    speakerOptions,
                  );
                  return {
                    values: block ? blockValues(project, blockRef.scriptId, block, primaryLocale) : {},
                    primaryLocale,
                    activeLocale: canvasLocale,
                    languages: normalizeLocaleList(primaryLocale, locales),
                    localeNames,
                    characterRef: currentCharacterRef,
                    characterLabel: project.canonRefs.find((ref) => ref.id === currentCharacterRef)?.label ?? project.localExplorerEntities?.find((entity) => entity.id === currentCharacterRef)?.name,
                    characterVariantId: currentCanonRef
                      ? resolveCanonVariantId(currentCanonRef, block?.characterVariantId)
                      : undefined,
                    textCounter: lengthTarget && lengthTarget.target > 0
                      ? { count: textCount, unit: lengthTarget.unit, target: lengthTarget.target }
                      : undefined,
                    counterPreference: beat.kind === "speech"
                      ? {
                          enabled: universeSpeechCounter?.enabled ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.enabled,
                          unit: universeSpeechCounter?.unit ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.unit,
                          target: universeSpeechCounter?.target ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.target,
                          eventOverride: Boolean(beatEvent?.speechBeatLengthTarget),
                        }
                      : undefined,
                    onCounterPreferenceUpdate: beat.kind === "speech"
                      ? (updates: Partial<SpeechBeatCounterPreference>) => onUpdateSpeechBeatCounter(updates)
                      : undefined,
                    presentEntityIds: presentEntityRefs,
                    speakerOptions,
                    onTextUpdate: (locale: string, value: string) => onUpdateLocalizedText(textKey, locale, value),
                    onCharacterUpdate: (characterRef?: string, characterVariantId?: string) => {
                      onUpdateScriptBlock(blockRef.scriptId, blockRef.blockId, { characterRef, characterVariantId: characterRef && characterVariantId !== "base" ? characterVariantId : undefined });
                      if (characterRef && characterRef !== UNKNOWN_SPEAKER_REF && beatEvent && !presentEntityRefs.includes(characterRef)) {
                        onUpdateEvent(beatEvent.id, { presentEntityRefs: [...presentEntityRefs, characterRef] });
                      }
                    },
                    onCreateSpeaker: beatEventId
                      ? (name: string) => onCreateLocalSpeaker(beatEventId, blockRef.scriptId, blockRef.blockId, name)
                      : undefined,
                    narrativeConnector:
                      (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") &&
                      activeScope &&
                      (activeScope.kind === "event" || activeScope.kind === "dialogue")
                        ? {
                            dialoguePresets,
                            onConnect: (kind: "speechBeat" | "decision" | "directionBeat", preset?: DialoguePreset) => {
                              const position = connectedNarrativeNodePosition(
                                nodes,
                                node,
                                canvasNodeSizeForKind(kind),
                                {
                                  snapToGrid: canvasBackground.snapToGrid,
                                  gridSize: canvasBackground.gridSize,
                                },
                              );
                              onCreateConnectedNarrativeNode(
                                activeScope as Extract<CanvasScope, { kind: "event" | "dialogue" }>,
                                node.id,
                                kind,
                                position,
                                undefined,
                                preset,
                              );
                            },
                            onInsertConditions: undefined,
                          }
                        : undefined,
                  };
                })()
              : undefined,
          },
        },
      })),
      edges: edges.map((edgeItem): StoryCanvasEdge => {
        const edgeData = edgeItem.data ?? { kind: "contains" as const, label: "" };
        const customLabel =
          typeof edgeData.customLabel === "string" ? edgeData.customLabel : undefined;
        const editable =
          edgeData.kind === "transition" || edgeData.kind === "entry";
        return {
          ...edgeItem,
          // The working area is a visual guide only; transitions remain above it.
          zIndex: Math.max(edgeItem.zIndex ?? 0, 1),
          type: editable ? "editable" : edgeItem.type,
          data: {
            ...edgeData,
            validationHighlight: edgeItem.id.startsWith("edge:transition:") && Boolean(validationHighlight?.transitionIds.includes(edgeItem.id.slice("edge:transition:".length))),
            returnRoute: returnConnectors.has(edgeItem.id) || edgeData.returnRoute === true,
            returnConnector: returnConnectors.get(edgeItem.id),
            onMeasureReturnConnector: (width: number) => {
              const connector = returnConnectors.get(edgeItem.id);
              if (connector) measureReturnConnector(connector.edgeId, width);
            },
            connectionPadding: canvasBackground.connectionPadding,
            onMoveWaypoint: edgeData.kind === "transition" ? onMoveTransitionWaypoint : undefined,
            onRemoveWaypoint: edgeData.kind === "transition" ? onRemoveTransitionWaypoint : undefined,
            customLabel:
              edgeData.kind === "entry" ? customLabel ?? "" : customLabel,
            inspectorState: inspectorEdgeStates.get(edgeItem.id),
            editing: editingEdgeId === edgeItem.id,
            onCommitLabel: editable
              ? (label: string) => commitEdgeLabel(edgeItem.id, label)
              : undefined,
            onCancelLabel: editable ? () => setEditingEdgeId(undefined) : undefined,
            onOpenInspectorSection: undefined,
            onOpenLogicPart: undefined,
          },
        };
      }),
    }),
    [measureReturnConnector, returnConnectors, conversationHighlightedNodeId, inspectorSelectedNodeIds, validationHighlight, onOpenInspectorSection, activeScope, canvasLayerMode, canvasBackground.connectionPadding, canvasBackground.gridSize, canvasBackground.snapToGrid, canvasLocale, commitEdgeLabel, editingEdgeId, edges, inspectorEdgeStates, inspectorNodeStates, localeNames, locales, nodes, onAuxiliaryPanelChange, onBoundarySelectionChange, onCanvasSelect, onCreateBoundaryEnd, onCreateBoundaryRoute, onCreateBoundaryRouteEvent, onCreateConnectedNarrativeNode, onCreateLocalSpeaker, onCreateOutcome, onDeleteBoundaryEnd, onDeleteOutcome, onDiscardPendingBoundaryPort, onImportEventCoverImage, onImportSceneImage, onOpenCanvasInspector, onUpdateDecision, onUpdateDialogueBeat, onUpdateEvent, onUpdateEventDialogueBeat, onUpdateLocalizedText, onUpdateOutcome, onUpdateScriptBlock, onUpdateTransition, onWorkspaceBoundsChange, primaryLocale, project, propertiesConfig, onMoveTransitionWaypoint, onRemoveTransitionWaypoint],
  );
  const graph = { nodes: cachePresentedNodes(projectedGraph.nodes), edges: cachePresentedEdges(projectedGraph.edges) };
  const documentIndex = useMemo(() => inspectorDocumentIndex(project), [project]);
  const activeEventScope =
    activeScope?.kind === "event"
      ? documentIndex.events.get(activeScope.id)
      : activeScope?.kind === "dialogue"
        ? documentIndex.events.get(activeScope.eventId)
        : undefined;
  const activeDialogueScope = activeScope?.kind === "dialogue" ? activeScope : undefined;

  useEffect(() => {
    const pendingLocate = pendingLocateNodeRef.current;
    const pendingNodeId = pendingLocate?.id;
    if (!pendingNodeId || !reactFlowInstance) return;
    const target = graph.nodes.find((node) => node.id === pendingNodeId);
    if (!target) return;
    pendingLocateNodeRef.current = undefined;
    if (pendingLocate?.openInspector) onSelect({ type: "node", id: target.id });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (pendingLocateFitSkipRef.current !== pendingNodeId) return;
        if (pendingLocate?.openInspector) centerCanvasOnNode(reactFlowInstance, shellRef.current, target, { duration: 220, zoom: 1 });
        else locateCanvasNode(reactFlowInstance, shellRef.current, target, true);
        pendingLocateFitSkipRef.current = undefined;
      });
    });
  }, [graph.nodes, onSelect, reactFlowInstance]);

  const breadcrumbs = useMemo(
    () => canvasBreadcrumb(project, activeScope),
    [activeScope, project],
  );
  const locateFinding = useCallback(
    (findingItem: ValidationFinding) => {
      const authoring = authoringDiagnosticTarget(project, findingItem.id) ?? authoringDiagnosticTarget(project, findingItem.ref);
      if (authoring) { window.dispatchEvent(new CustomEvent("pathbranching:locate-authoring", { detail: authoring })); return; }
      if (
        findingItem.code === "missing_event" &&
        findingItem.id &&
        findingItem.ref
      ) {
        const ownerId = findingItem.id;
        const missingId = findingItem.ref;
        if (project.sequences.some((candidate) => candidate.id === ownerId)) {
          onNavigateScope(
            { kind: "sequence", id: ownerId },
            { type: "node", id: missingId },
          );
          return;
        }
        if (project.events.some((candidate) => candidate.id === ownerId)) {
          onNavigateScope(
            { kind: "event", id: ownerId },
            { type: "node", id: missingId },
          );
        }
        return;
      }
      if (findingItem.code === "invalid_boundary_binding" && findingItem.id) {
        const ownerEventId = project.events.find((event) =>
          event.boundaryBindings?.some(
            (binding) => binding.id === findingItem.id,
          ),
        )?.id;
        if (ownerEventId) {
          onNavigateScope({ kind: "event", id: ownerEventId });
        }
        return;
      }
      if (findingItem.code === "invalid_transition_order" && findingItem.id) {
        const routeDetails = transitionOrderDetails(project, findingItem.id, canvasUiLocale);
        const ownerEvent = routeDetails?.event ?? project.events.find((event) =>
          event.transitions?.some((transition) => transition.from === findingItem.id),
        );
        if (!ownerEvent) return;
        const transitionIds = routeDetails?.routeIds ?? ownerEvent.transitions
          ?.filter((transition) => transition.from === findingItem.id)
          .map((transition) => transition.id) ?? [];
        highlightValidationTarget([findingItem.id], transitionIds);
        const target = graph.nodes.find((node) => node.id === findingItem.id);
        if (!target) {
          pendingLocateNodeRef.current = { id: findingItem.id, openInspector: true };
          pendingLocateFitSkipRef.current = findingItem.id;
          onNavigateScope(
            { kind: "event", id: ownerEvent.id },
            { type: "node", id: findingItem.id },
          );
        } else {
          onSelect({ type: "node", id: findingItem.id });
          window.requestAnimationFrame(() => {
            const size = canvasNodeSize(target);
            reactFlowInstance?.setCenter(target.position.x + size.width / 2, target.position.y + size.height / 2, { duration: 220, zoom: 1 });
          });
        }
        return;
      }
      if (findingItem.code === "orphan_script_block" && findingItem.ref) {
        const owner = project.scriptDocuments?.find((script) =>
          script.blocks.some((block) => `${script.id}:${block.id}` === findingItem.ref),
        );
        const block = owner?.blocks.find(
          (candidate) => `${owner.id}:${candidate.id}` === findingItem.ref,
        );
        if (owner && block) onFocusScriptBlock({ scriptId: owner.id, blockId: block.id });
      }
      const target = diagnosticSelection(project, findingItem.id) ?? diagnosticSelection(project, findingItem.ref);
      if (target) {
        if (target.type === "edge") {
          highlightValidationTarget([], [target.id]);
          const owner = project.events.find((event) => event.transitions?.some((item) => item.id === target.id));
          if (owner) onNavigateScope({ kind: "event", id: owner.id }, target);
        } else if (target.type === "node") {
          highlightValidationTarget([target.id], []);
          const event = project.events.find((item) => item.id === target.id);
          const sequence = project.sequences.find((item) => item.id === target.id || item.eventIds.includes(target.id));
          if (event) onNavigateScope({ kind: "event", id: event.id }, target);
          else if (sequence) onNavigateScope({ kind: "sequence", id: sequence.id }, target);
          else onOpenCanvasInspector(target);
        } else onOpenCanvasInspector(target);
      }

    },
    [canvasUiLocale, graph.nodes, highlightValidationTarget, onFocusScriptBlock, onNavigateScope, onOpenCanvasInspector, onSelect, project, reactFlowInstance],
  );
  const fixFinding = useCallback(
    (findingItem: ValidationFinding) => {
      if (
        findingItem.code === "missing_event" &&
        findingItem.id &&
        findingItem.ref
      ) {
        onRemoveMissingEventReference(findingItem.id, findingItem.ref);
        return;
      }
      if (findingItem.code === "invalid_boundary_binding" && findingItem.id) {
        onRemoveBoundaryBinding(findingItem.id);
        return;
      }
      if (findingItem.code === "invalid_transition_order" && findingItem.id) {
        onNormalizeTransitionOrder(findingItem.id);
        return;
      }
      if (findingItem.code === "orphan_script_block" && findingItem.ref) {
        onDeleteScriptBlock(findingItem.ref);
      }
    },
    [onDeleteScriptBlock, onNormalizeTransitionOrder, onRemoveBoundaryBinding, onRemoveMissingEventReference],
  );
  const snapGrid: [number, number] = [
    canvasBackground.gridSize,
    canvasBackground.gridSize,
  ];
  const backgroundColor = `color-mix(in srgb, var(--wn-border) ${Math.round(canvasBackground.opacity * 100)}%, transparent)`;
  const dotOpacity = canvasBackground.dotOpacity ?? canvasBackground.opacity;
  const inspectorProject = useMemo(
    () =>
      eventDraft?.dirty
        ? applyEventDraftToProject(project, eventDraft)
        : manualInspectorDraft?.dirty ? mergeManualInspectorDraft(project, manualInspectorDraft) : project,
    [eventDraft, manualInspectorDraft, project],
  );
  const inspectorSelection = selection ?? (activeScope ? {type:"node" as const,id:activeScope.id} : {type:"story" as const,id:project.storyId ?? project.projectId});
  const inspectorPins:Selection[] = [...eventInspector.openEventIds.map(id=>({type:"node" as const,id})),...inspectorTabs.map(tab=>tab.selection)].filter((target,index,all)=>all.findIndex(item=>inspectorSelectionKey(item)===inspectorSelectionKey(target))===index);
  const buildInspectorGraph = useCallback((target: Selection, targetProject: BranchingProject) => {
    if (target.type !== "node" && target.type !== "edge") return { nodes, edges };
    if ((target.type === "node" ? nodes : edges).some(item => item.id === target.id)) return { nodes, edges };
    const index = inspectorDocumentIndex(targetProject);
    const option = index.node(target.id);
    const gateId = target.id.startsWith("edge:route-gate:") ? target.id.slice("edge:route-gate:".length) : target.id;
    const gateOwner = gateId.startsWith("route-gate:") ? index.gateOwner(gateId) : undefined;
    const edgeOwner = target.type === "edge" ? index.edgeOwners.get(target.id) : undefined;
    const owner = option?.eventId ?? gateOwner ?? edgeOwner ?? ownerEventIdFromCanvasSelection(targetProject, target);
    const routeTarget = target.type === "edge" || gateId.startsWith("route-gate:");
    const ownerDialogues = owner && routeTarget ? index.events.get(owner)?.dialogues ?? [] : [];
    const contexts: CanvasScope[] = owner
      ? [
          { kind: "event", id: owner },
          ...(routeTarget
            ? ownerDialogues.map(dialogue => ({ kind: "dialogue" as const, id: dialogue.id, eventId: owner }))
            : option?.dialogueId ? [{ kind: "dialogue" as const, id: option.dialogueId, eventId: owner }] : []),
        ]
      : targetProject.sequences.map(sequence => ({ kind: "sequence" as const, id: sequence.id }));
    const models = contexts.map(scope => buildStoryCanvasModel(targetProject, { scope, canvasLayerMode, interfaceLocale: canvasUiLocale }));
    return { nodes: [...nodes, ...models.flatMap(model => model.nodes)], edges: [...edges, ...models.flatMap(model => model.edges)] };
  }, [nodes, edges, canvasLayerMode, canvasUiLocale]);
  const inspectorGraph = useMemo(
    () => buildInspectorGraph(inspectorSelection, inspectorProject),
    [buildInspectorGraph, inspectorSelection?.id, inspectorSelection?.type, inspectorProject],
  );
  const rememberedModule = inspectorSelection.type === "node" && narrativeInspectorModules(project, inspectorSelection.id) ? readInspectorModulePreferences(project.projectId, inspectorSelectionKey(inspectorSelection))?.active : undefined;
  const rememberedInspectorRequest = inspectorRequest?.selectionKey === inspectorSelectionKey(inspectorSelection) ? inspectorRequest : { selectionKey:inspectorSelectionKey(inspectorSelection),section:rememberedModule ?? inspectorSections[`${project.storyId ?? project.projectId}|${inspectorSelectionKey(inspectorSelection)}`] ?? "overview" };
  const inspectorShowsManualSave =
    manualInspectorEnabled && Boolean(manualInspectorDraftKey(inspectorSelection));
  const closeInspectorTarget = (target: Selection) => {
    if (target.type === "node" && eventInspector.openEventIds.includes(target.id)) {
      onCloseEventInspectorEvent(target.id);
      return;
    }
    const tab = inspectorTabs.find(item => inspectorSelectionKey(item.selection) === inspectorSelectionKey(target));
    if (tab) {
      onCloseInspectorTab(tab.id);
      return;
    }
    onSelect(undefined);
  };
  const renderInspector = (target: Selection, targetGraph: { nodes: StoryCanvasNode[]; edges: StoryCanvasEdge[] }, onClose: () => void) => {
    const targetKey = inspectorSelectionKey(target);
    const targetModule = target.type === "node" && narrativeInspectorModules(project, target.id)
      ? readInspectorModulePreferences(project.projectId, targetKey)?.active
      : undefined;
    const targetRequest = targetKey === inspectorSelectionKey(inspectorSelection)
      ? rememberedInspectorRequest
      : {
          selectionKey: targetKey,
          section: targetModule ?? inspectorSections[`${project.storyId ?? project.projectId}|${targetKey}`] ?? "overview",
        };
    const isCurrentSelection = targetKey === inspectorSelectionKey(inspectorSelection);
    const openInspectorTarget = (nextTarget: Selection, section?: string, focusId?: string) => onOpenInspectorSection(nextTarget, section, focusId);
    return <Inspector
      project={inspectorProject}
      localeNames={localeNames}
      scope={activeScope}
      propertiesConfig={propertiesConfig}
      nodes={targetGraph.nodes}
      edges={targetGraph.edges}
      files={files}
      selection={target}
      findings={findings}
      exportOpen={exportOpen}
      exportPreviewMode={exportPreviewMode}
      canvasLayerMode={canvasLayerMode}
      onCanvasLayerModeChange={onCanvasLayerModeChange}
      requestedLogicTab={logicFocus}
      requestedSection={targetRequest}
      onSectionChange={onInspectorSectionChange}
      onAuthoringMutation={onAuthoringMutation}
      onSelectAuthoringNode={id => openInspectorTarget({ type: id.startsWith("edge:") ? "edge" : "node", id })}
      onHighlightAuthoringNode={setConversationHighlightedNodeId}
      highlightedAuthoringNodeId={conversationHighlightedNodeId}
      onOpenAuthoringSection={(id, section) => openInspectorTarget({ type: id.startsWith("edge:") ? "edge" : "node", id }, section)}
      onOpenReference={openInspectorTarget}
      embedded
      manualDirty={isCurrentSelection ? manualInspectorDraft?.dirty : false}
      onSaveManual={isCurrentSelection && inspectorShowsManualSave ? onSaveManualInspector : undefined}
      onExportPreviewModeChange={onExportPreviewModeChange}
      onClose={onClose}
      onUpdateSequence={onUpdateSequence}
      onUpdateBranch={onUpdateBranch}
      onCreateEventInBranch={onCreateEventInBranch}
      onUpdateEvent={onUpdateEvent}
      onApplyEvpath={onApplyEvpath}
      onCreateDecision={onCreateDecision}
      onUpdateDecision={onUpdateDecision}
      onUpdateDialogue={onUpdateDialogue}
      onUpdateDialogueBeat={onUpdateDialogueBeat}
      onUpdateEventDialogueBeat={onUpdateEventDialogueBeat}
      onImportSceneImage={onImportSceneImage}
      onUpdateScriptBlock={onUpdateScriptBlock}
      onUpdateLocalizedText={onUpdateLocalizedText}
      onDeleteDialogueBeat={onDeleteDialogueBeat}
      onDeleteEventDialogueBeat={onDeleteEventDialogueBeat}
      onDeleteDecision={onDeleteDecision}
      onDeleteDialogue={onDeleteDialogue}
      onCreateOutcome={onCreateOutcome}
      onUpdateOutcome={onUpdateOutcome}
      onDeleteOutcome={onDeleteOutcome}
      onUpdateTransition={onUpdateTransition}
      onDeleteTransition={onDeleteTransition}
      onCreateScriptTransition={onCreateScriptTransition}
      onCreateCanonSuggestion={onCreateCanonSuggestion}
      onUpdateCanonSuggestion={onUpdateCanonSuggestion}
      onDeleteCanonSuggestion={onDeleteCanonSuggestion}
      onUpdateDataObject={onUpdateDataObject}
      onDeleteDataObject={onDeleteDataObject}
      onSelectCanon={id => openInspectorTarget({ type: "canon", id })}
      onSelectSuggestion={id => openInspectorTarget({ type: "canonSuggestion", id })}
      onEditCanonRef={onEditCanonRef}
      onCreateCanonWorkingCopy={onCreateCanonWorkingCopy}
      onSaveCanonWorkingCopy={onSaveCanonWorkingCopy}
      onExportCanonChangeSet={onExportCanonChangeSet}
      onApplyCanonWorkingCopy={onApplyCanonWorkingCopy}
      onUpdateLocalExplorerEntity={onUpdateLocalExplorerEntity}
      onPublishLocalExplorerEntity={onPublishLocalExplorerEntity}
      onUpdateLocalExplorerType={onUpdateLocalExplorerType}
      onUpdateLocalExplorerProperty={onUpdateLocalExplorerProperty}
      onUpdateLogicPropertyOverride={onUpdateLogicPropertyOverride}
      onUpdateLogicTypeOverride={onUpdateLogicTypeOverride}
      onUpdateCharacterCategories={onUpdateCharacterCategories}
      onUpdateEdgeLabel={onUpdateEdgeLabel}
      onDeleteSelection={onDeleteSelection}
      onOpenRule={onOpenRule}
    />;
  };
  const fitViewNodesRef = useRef<StoryCanvasNode[]>([]);
  fitViewNodesRef.current = graph.nodes.filter((node) => {
    if (activeScope?.kind === "sequence") return true;
    return node.data.kind !== "workspace" && node.data.kind !== "boundary" && node.data.kind !== "endAdder";
  });

  const fittedCanvasRef = useRef<{ projectKey: string; scopeKey: string } | undefined>(undefined);
  const hasFitViewNodesRef = useRef(false);
  const canvasScopeKeyValue = activeScope ? canvasScopeKey(activeScope) : "";
  const canvasProjectKey = `${project.projectId}:${project.storyId ?? ""}`;
  const canvasNodeIdSignature = graph.nodes.map((node) => node.id).join("|");
  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }
    const fitNodes = fitViewNodesRef.current;
    const hasFitNodes = fitNodes.length > 0;
    const fittedCanvas = fittedCanvasRef.current;
    const scopeChanged =
      !fittedCanvas ||
      fittedCanvas.projectKey !== canvasProjectKey ||
      fittedCanvas.scopeKey !== canvasScopeKeyValue;
    const nodesBecameAvailable = !hasFitViewNodesRef.current && hasFitNodes;
    hasFitViewNodesRef.current = hasFitNodes;
    if (!hasFitNodes || (!scopeChanged && !nodesBecameAvailable)) {
      return;
    }
    if (pendingLocateFitSkipRef.current && graph.nodes.some((node) => node.id === pendingLocateFitSkipRef.current)) {
      fittedCanvasRef.current = {
        projectKey: canvasProjectKey,
        scopeKey: canvasScopeKeyValue,
      };
      return;
    }
    fittedCanvasRef.current = {
      projectKey: canvasProjectKey,
      scopeKey: canvasScopeKeyValue,
    };
    window.requestAnimationFrame(() => {
      reactFlowInstance.fitView({
        nodes: fitNodes,
        padding: activeScope?.kind === "event" ? 0.3 : 0.24,
        duration: 0,
      });
    });
  }, [activeScope, canvasNodeIdSignature, canvasProjectKey, canvasScopeKeyValue, graph.nodes, reactFlowInstance]);

  const previousCanvasNodeIdsRef = useRef<{ scopeKey: string; ids: Set<string> } | undefined>(undefined);
  useEffect(() => {
    const scopeKey = activeScope ? canvasScopeKey(activeScope) : "";
    const currentIds = new Set(graph.nodes.map((node) => node.id));
    const previous = previousCanvasNodeIdsRef.current;
    previousCanvasNodeIdsRef.current = { scopeKey, ids: currentIds };
    if (!previous || previous.scopeKey !== scopeKey || !reactFlowInstance) return;

    const createdNode = graph.nodes.find((node) => !previous.ids.has(node.id));
    if (!createdNode) return;
    window.requestAnimationFrame(() => {
      ensureCanvasNodeVisible(reactFlowInstance, createdNode);
    });
  }, [activeScope, canvasNodeIdSignature, graph.nodes, reactFlowInstance]);

  const positionForNewNode = useCallback(
    (position: CanvasPoint, kind: StoryCanvasNodeData["kind"]) =>
      nearestFreeCanvasPosition(
        nodes,
        snapCanvasPoint(
          position,
          canvasBackground.snapToGrid,
          canvasBackground.gridSize,
        ),
        canvasNodeSizeForKind(kind),
        {
          snapToGrid: canvasBackground.snapToGrid,
          gridSize: canvasBackground.gridSize,
          constrainToWorkspace: Boolean(
            activeScope &&
            activeScope.kind !== "sequence" &&
            project.canvas?.scopes?.[canvasScopeKey(activeScope)]?.workspace?.manual,
          ),
        },
      ),
    [activeScope, canvasBackground.gridSize, canvasBackground.snapToGrid, nodes, project.canvas?.scopes],
  );

  const locateInspectorSelection = useCallback(
    (nextSelection: Selection) => {
      if (nextSelection.type === "edge") {
        const routeId = nextSelection.id.replace(/^edge:transition:/, "");
        const owner = project.events.find(event => event.transitions?.some(route => route.id === routeId));
        if (owner && !graph.edges.some(edge => edge.id === nextSelection.id)) onNavigateScope({ kind: "event", id: owner.id }, undefined, { preserveSelection: true });
        const edge = graph.edges.find(item => item.id === nextSelection.id);
        const source = graph.nodes.find(node => node.id === edge?.source);
        if (source && reactFlowInstance) {
          window.requestAnimationFrame(() => locateCanvasNode(reactFlowInstance, shellRef.current, source));
        }
        return;
      }
      if (nextSelection.type !== "node") return;
      // Options are embedded in their decision on the canvas. Locating an
      // inspector only moves the viewport; reopening it resets its editor state.
      const option = documentIndex.node(nextSelection.id);
      const ownerDecision = option?.kind === "outcome"
        ? documentIndex.events.get(option.eventId)?.decisions?.find(decision =>
            decision.outcomes.some(outcome => nextSelection.id === `outcome:${option.eventId}:${decision.id}:${outcome.id}`))
        : undefined;
      const targetId = option && ownerDecision ? `decision:${option.eventId}:${ownerDecision.id}` : nextSelection.id;
      const ownerEventId = eventIdFromSelection(project, graph.nodes, nextSelection)
        ?? option?.eventId
        ?? ownerEventIdFromCanvasSelection(project, nextSelection);
      const target = graph.nodes.find((node) => node.id === targetId);
      if (!target) {
        if (ownerEventId) {
          const scope = option && option.kind !== "event"
            ? option.dialogueId ? { kind: "dialogue" as const, id: option.dialogueId, eventId: ownerEventId } : { kind: "event" as const, id: ownerEventId }
            : canvasScopeForSelection(project, nextSelection, ownerEventId);
          if (scope) {
            pendingLocateNodeRef.current = { id: targetId };
            pendingLocateFitSkipRef.current = targetId;
            onNavigateScope(scope, undefined, { preserveSelection: true });
          }
          return;
        }
        return;
      }
      window.requestAnimationFrame(() => {
        if (reactFlowInstance) locateCanvasNode(reactFlowInstance, shellRef.current, target);
      });
    },
    [documentIndex, graph.nodes, graph.edges, onNavigateScope, project, reactFlowInstance],
  );

  const closeExplorerInspectorTabsAbove = useCallback(
    (tabId: string) => onCloseInspectorStackRange({ kind: "inspector", id: tabId }, "above"),
    [onCloseInspectorStackRange],
  );

  const closeExplorerInspectorTabsBelow = useCallback(
    (tabId: string) => onCloseInspectorStackRange({ kind: "inspector", id: tabId }, "below"),
    [onCloseInspectorStackRange],
  );

  const closeOtherExplorerInspectorTabs = useCallback(
    (tabId: string) => onCloseInspectorStackRange({ kind: "inspector", id: tabId }, "others"),
    [onCloseInspectorStackRange],
  );

  const openContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent) => {
      event.preventDefault();
      if (!reactFlowInstance) {
        return;
      }
      const shellRect = shellRef.current?.getBoundingClientRect();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const workspaceNode = activeScope?.kind === "sequence"
        ? undefined
        : nodes.find((node) => node.data.kind === "workspace");
      if (workspaceNode && !isPointInside(workspaceNode, flowPosition.x, flowPosition.y)) {
        return;
      }
      contextMenuFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : shellRef.current;
      const selectedNodeIds = nodes
        .filter((node) => node.selected)
        .map((node) => node.id);
      if (selectedNodeIds.length > 0) {
        setContextMenu({
          kind: "selection",
          ...clampFloatingMenuPosition(
            event.clientX - (shellRect?.left ?? 0),
            event.clientY - (shellRect?.top ?? 0),
            {
              left: 0,
              top: 0,
              right: shellRect?.width ?? window.innerWidth,
              bottom: shellRect?.height ?? window.innerHeight,
            },
            250,
          ),
          flowX: 0,
          flowY: 0,
          nodeIds: selectedNodeIds,
        });
        return;
      }
      setContextMenu({
        kind: "create",
        ...clampFloatingMenuPosition(
          event.clientX - (shellRect?.left ?? 0),
          event.clientY - (shellRect?.top ?? 0),
          {
            left: 0,
            top: 0,
            right: shellRect?.width ?? window.innerWidth,
            bottom: shellRect?.height ?? window.innerHeight,
          },
          410,
        ),
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [activeScope?.kind, nodes, reactFlowInstance],
  );

  const openEdgeContextMenu = useCallback(
    (event: ReactMouseEvent, edgeItem: StoryCanvasEdge) => {
      event.preventDefault();
      event.stopPropagation();
      if (edgeItem.data?.kind === "transition") {
        const point = reactFlowInstance?.screenToFlowPosition({ x: event.clientX, y: event.clientY });
        if (point) onAddTransitionWaypoint(edgeItem.id, point);
        return;
      }
      if (typeof edgeItem.data?.routeSourceId !== "string") return;
      contextMenuFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : shellRef.current;
      const shellRect = shellRef.current?.getBoundingClientRect();
      setContextMenu({
        kind: "route-gate",
        routeSourceId: edgeItem.data.routeSourceId,
        edgeId: edgeItem.id,
        x: event.clientX - (shellRect?.left ?? 0),
        y: event.clientY - (shellRect?.top ?? 0),
        flowX: 0,
        flowY: 0,
      });
    },
    [onAddTransitionWaypoint, reactFlowInstance],
  );

  const openSelectionContextMenu = useCallback(
    (event: ReactMouseEvent, node: StoryCanvasNode) => {
      event.preventDefault();
      event.stopPropagation();
      if (node.data.kind === "workspace") return;
      contextMenuFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : shellRef.current;
      const selectedNodeIds = node.selected
        ? nodes.filter((candidate) => candidate.selected).map((candidate) => candidate.id)
        : [node.id];
      if (!node.selected) {
        onNodesChange([
          ...nodes
            .filter((candidate) => candidate.selected)
            .map((candidate) => ({ type: "select" as const, id: candidate.id, selected: false })),
          { type: "select", id: node.id, selected: true },
        ]);
      }
      const shellRect = shellRef.current?.getBoundingClientRect();
      setContextMenu({
        kind: "selection",
        ...clampFloatingMenuPosition(
          event.clientX - (shellRect?.left ?? 0),
          event.clientY - (shellRect?.top ?? 0),
          {
            left: 0,
            top: 0,
            right: shellRect?.width ?? window.innerWidth,
            bottom: shellRect?.height ?? window.innerHeight,
          },
          250,
        ),
        flowX: 0,
        flowY: 0,
        nodeIds: selectedNodeIds,
        contextNodeId: node.id,
      });
    },
    [nodes, onNodesChange],
  );

  const openConnectionCreateMenu = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (
        connectionState.toNode ||
        !connectionState.fromNode ||
        !reactFlowInstance
      ) {
        return;
      }

      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      if (!point) {
        return;
      }
      contextMenuFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : shellRef.current;

      const shellRect = shellRef.current?.getBoundingClientRect();
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: point.clientX,
        y: point.clientY,
      });
      setContextMenu({
        kind: "connect-create",
        sourceNodeId: connectionState.fromNode.id,
        sourceHandleId: connectionState.fromHandle?.id ?? undefined,
        ...clampFloatingMenuPosition(
          point.clientX - (shellRect?.left ?? 0),
          point.clientY - (shellRect?.top ?? 0),
          {
            left: 0,
            top: 0,
            right: shellRect?.width ?? window.innerWidth,
            bottom: shellRect?.height ?? window.innerHeight,
          },
          410,
        ),
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    [reactFlowInstance],
  );

  const beginConnectionGesture = useCallback(() => {
    connectionGestureRef.current = true;
    // A handle drag is a connection gesture, never a long press on either
    // endpoint. Keep the suppression through the trailing click event too.
    suppressNodeInspectorUntilRef.current = Date.now() + 500;
    clearDirectedNodeHold();
  }, [clearDirectedNodeHold]);

  const finishConnectionGesture = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      connectionGestureRef.current = false;
      suppressNodeInspectorUntilRef.current = Date.now() + 500;
      clearDirectedNodeHold();
      openConnectionCreateMenu(event, connectionState);
    },
    [clearDirectedNodeHold, openConnectionCreateMenu],
  );

  const eventTypeOptions: EventCategoryDefinition[] =
    (project.eventCategories?.length ?? 0) > 0
      ? (project.eventCategories ?? [])
      : [
          { id: "normal", label: "Normal" },
          { id: "final", label: "Final", terminal: true },
        ];
  const isNestedCanvas = activeScope?.kind === "event" || activeScope?.kind === "dialogue";
  const selectedLayoutNodeIds = nodes
    .filter((node) => node.selected && isNestedLayoutMovableNode(node))
    .map((node) => node.id);
  const fitNestedCanvasWorkspace = useCallback(() => {
    if (!activeScope || activeScope.kind === "sequence") return;
    const bounds = fitSubcanvasWorkspaceBounds(
      nodes,
      autoFitPaddingGridPoints,
      canvasBackground.gridSize,
    );
    onWorkspaceBoundsChange(activeScope, bounds, true);
  }, [activeScope, autoFitPaddingGridPoints, canvasBackground.gridSize, nodes, onWorkspaceBoundsChange]);
  const openNodeCanvas = useCallback(
    (node: StoryCanvasNode) => {
      if (node.data.kind === "event") {
        onNavigateScope(
          { kind: "event", id: node.id },
          { type: "node", id: node.id },
        );
        return;
      }
      if (
        node.data.kind === "dialogue" &&
        typeof node.data.details?.eventId === "string" &&
        typeof (node.data.details?.dialogue as { id?: string } | undefined)?.id === "string"
      ) {
        const dialogueId = (node.data.details!.dialogue as { id: string }).id;
        onNavigateScope(
          { kind: "dialogue", id: dialogueId, eventId: node.data.details.eventId as string },
          undefined,
        );
        return;
      }
      if (
        (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") &&
        typeof node.data.details?.eventId === "string"
      ) {
        const block = node.data.details?.block as ScriptBlock | undefined;
        const beat = node.data.details?.beat as DialogueBeat | undefined;
        onOpenEventScript(
          node.data.details.eventId as string,
          block?.textKey ?? (beat ? scriptBlockTextKey(beat.blockRef.scriptId, beat.blockRef.blockId) : undefined),
        );
      }
    },
    [onNavigateScope, onOpenEventScript],
  );
  const startDirectedNodeHold = useCallback(
    (event: PointerEvent, node: StoryCanvasNode) => {
      if (
        !directedNodeOpening ||
        event.button !== 0 ||
        event.shiftKey ||
        node.data.kind === "workspace" ||
        connectionGestureRef.current ||
        (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable=\"true\"], .react-flow__handle"))
      ) {
        return;
      }
      clearDirectedNodeHold();
      clearPendingSubcanvasInspector();
      const nodeSelection = { type: "node" as const, id: node.id };
      const timer = window.setTimeout(() => {
        if (directedNodeHoldRef.current?.nodeId !== node.id) return;
        directedNodeHoldRef.current = undefined;
        onOpenCanvasInspector(nodeSelection);
      }, DIRECTED_NODE_OPEN_DELAY_MS);
      directedNodeHoldRef.current = {
        nodeId: node.id,
        timer,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
    },
    [clearDirectedNodeHold, clearPendingSubcanvasInspector, directedNodeOpening, onOpenCanvasInspector],
  );
  const nodeForPointerTarget = useCallback(
    (target: EventTarget | null) => {
      const nodeElement = target instanceof Element
        ? target.closest<HTMLElement>(".react-flow__node")
        : null;
      const nodeId = nodeElement?.dataset.id;
      return nodeId ? nodes.find((node) => node.id === nodeId) : undefined;
    },
    [nodes],
  );
  useEffect(() => {
    if (!directedNodeOpening || !shellRef.current) return;
    const shell = shellRef.current;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const node = nodeForPointerTarget(event.target);
      if (node) startDirectedNodeHold(event, node);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === directedNodeHoldRef.current?.pointerId) clearDirectedNodeHold();
    };
    const handlePointerMove = (event: PointerEvent) => {
      const pending = directedNodeHoldRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;
      if (!(event.buttons & 1) || Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY) > DIRECTED_NODE_MOVE_THRESHOLD_PX) {
        clearDirectedNodeHold();
      }
    };
    const handleBlur = () => clearDirectedNodeHold();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Shift") clearDirectedNodeHold();
    };
    shell.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      shell.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [clearDirectedNodeHold, directedNodeOpening, nodeForPointerTarget, startDirectedNodeHold]);

  const contextSelection: Selection | undefined = conversationHighlightedNodeId
    ? { type: "node", id: conversationHighlightedNodeId }
    : selection ?? (activeScope ? { type: "node", id: activeScope.id } : undefined);
  return (
    <main
      style={{"--inspector-width": `${inspectorSize.width}px`, "--inspector-height": `${(inspectorSize.height ?? 480) + 44}px`, "--canvas-toolbar-bottom": `${52 + canvasToolRowHeight + 8}px`} as CSSProperties}
      className={`canvas-shell pb-canvas-layout${contextVisible ? " context-visible" : ""}${eventInspector.open ? " has-unified-inspector" : ""}${contextTab === "test" ? " inspector-show-test" : ""}${inspectorMaximized ? " inspector-enlarged" : ""}${contextFocus ? " context-focus" : ""} context-floating canvas-layer-${canvasLayerMode} ${activeScope?.kind === "event" || activeScope?.kind === "dialogue" ? "nested-scope" : ""} ${draggingEvent ? "dragging-event" : ""}`}
      ref={shellRef}
      tabIndex={-1}
      onKeyDownCapture={(event) => { if (contextFocus && event.key === "Escape" && event.target instanceof Element && !event.target.closest('[role="dialog"],[role="menu"],.event-inspector-group-menu.open')) { event.preventDefault(); event.stopPropagation(); onContextFocusChange(false); } }}
    >
      <div className="pb-canvas-stage">


      <div className="canvas-modebar">
        <CanvasBreadcrumbScroller ariaLabel={canvasUiLocale === "es" ? "Ruta del canvas" : "Canvas path"} es={canvasUiLocale === "es"}>
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            const crumbEvent =
              crumb.scope.kind === "event"
                ? project.events.find((event) => event.id === crumb.scope.id)
                : undefined;
            const crumbSequence =
              crumb.scope.kind === "sequence"
                ? project.sequences.find((seq) => seq.id === crumb.scope.id)
                : undefined;
            const infoBadges = crumbEvent
              ? [
                  `${crumbEvent.childEventIds?.length ?? 0} nested events`,
                  `${crumbEvent.decisions?.length ?? 0} decisions`,
                  `${crumbEvent.dialogues?.length ?? 0} dialogues`,
                ]
              : crumbSequence
                ? [
                    `${crumbSequence.eventIds.length} events`,
                    `${crumbSequence.branchIds?.length ?? 0} branches`,
                  ]
                : [];
            return (
              <BreadcrumbCrumb
                key={`${crumb.scope.kind}:${crumb.scope.id}`}
                crumb={crumb}
                index={index}
                isLast={last}
                infoBadges={infoBadges}
                onInspect={() => onOpenInspectorSection({ type: "node", id: crumb.scope.kind === "dialogue" ? `dialogue:${crumb.scope.eventId}:${crumb.scope.id}` : crumb.scope.id })}
                onNavigate={() =>
                  onNavigateScope(crumb.scope, {
                    type: "node",
                    id: crumb.scope.id,
                  })
                }
              />
            );
          })}
        </CanvasBreadcrumbScroller>
      </div>
      <div data-onboarding-target="pathbranching.canvas" className="pb-canvas-tool-row" ref={canvasToolRowRef}>
      <div className="canvas-layer-switch" role="toolbar" aria-label={ui.canvasLayer}>
        <button
          type="button"
          aria-pressed={canvasLayerMode === "visual"}
          className={canvasLayerMode === "visual" ? "active" : ""}
          onClick={() => onCanvasLayerModeChange("visual")}
          title={ui.visualHint}
        >
          <Eye size={13} aria-hidden="true" /> {ui.visual}
        </button>
        <button
          type="button"
          aria-pressed={canvasLayerMode === "logic"}
          className={canvasLayerMode === "logic" ? "active" : ""}
          onClick={() => onCanvasLayerModeChange("logic")}
          title={ui.logicHint}
        >
          <GitBranch size={13} aria-hidden="true" /> {ui.logic}
        </button>
      </div>
      <div data-onboarding-target="pathbranching.preview" className="pb-canvas-primary-actions" role="toolbar" aria-label={canvasUiLocale === "es" ? "Acciones de historia" : "Story actions"}>
        {storyTestControls}
        {storyTestActive && contextTab !== "test" ? <button type="button" onClick={onOpenStoryPlay}><Play size={14} aria-hidden="true" />{canvasUiLocale === "es" ? "Abrir Play Mode" : "Open Play Mode"}</button> : null}
      </div>
      </div>
      <div className="pb-canvas-locale-tools">
      <div className="inspector-toolbar-host" ref={setInspectorToolbarHost} />
      <CanvasFindingsButton findings={findings} project={project} onLocateFinding={locateFinding} onFixFinding={fixFinding} />
      <div className="canvas-locale-control">
        <button
          type="button"
          aria-label={ui.contentLanguage}
          aria-haspopup="listbox"
          aria-expanded={canvasLocaleMenuOpen}
          onClick={() => setCanvasLocaleMenuOpen((open) => !open)}
        >
          <Globe2 size={14} aria-hidden="true" />
          <span>{localeDisplayName(canvasLocale, localeNames)}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {canvasLocaleMenuOpen ? <div className="canvas-locale-menu" role="listbox" aria-label="Canvas language">
          {canvasLocaleOptions.map((locale) => <button
            key={locale}
            type="button"
            role="option"
            aria-selected={locale === canvasLocale}
            onClick={() => {
              setCanvasLocale(locale);
              setCanvasLocaleMenuOpen(false);
            }}
          >
            {localeDisplayName(locale, localeNames)}{locale === primaryLocale ? " · Primary" : ""}
          </button>)}
        </div> : null}
      </div>

      </div>

      <ReactFlowProvider>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={editableCanvasEdgeTypes}
          deleteKeyCode={null}
          onNodesChange={onNodesChange}
          nodeDragThreshold={DIRECTED_NODE_MOVE_THRESHOLD_PX}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={beginConnectionGesture}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          panOnDrag={[1]}
          onConnectEnd={finishConnectionGesture}
          onInit={setReactFlowInstance}
          onSelectionChange={({ nodes: selectedNodes }) =>
            onBoundarySelectionChange(selectedNodes.map((node) => node.id))
          }
          onNodeDrag={(_, node) => {
            clearDirectedNodeHold();
            clearPendingSubcanvasInspector();
            draggedNodeRef.current = true;
            setDraggingEvent(node.data.kind === "event");
          }}
          onNodeDragStop={(event, node) => {
            setDraggingEvent(false);
            onNodeDragStop(event, node);
            window.setTimeout(() => {
              draggedNodeRef.current = false;
            }, 0);
          }}
          onNodeClick={(event, node) => {
            clearPendingSubcanvasInspector();
            onDiscardPendingBoundaryPort(node.id);
            setContextMenu(undefined);
            setEditingEdgeId(undefined);
            if (node.data.kind === "workspace") return;
            if (connectionGestureRef.current || Date.now() < suppressNodeInspectorUntilRef.current) return;
            if (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable=\"true\"], .react-flow__handle")) return;
            if (draggedNodeRef.current || event.shiftKey) return;
            const nodeSelection = { type: "node" as const, id: node.id };
            const clickCount = Math.max(event.detail || 1, 1);
            clearDirectedNodeHold();
            if (clickCount === 2) {
              // A double-click enters the subcanvas without leaving behind an
              // inspector opened by the first click.
              if (node.data.kind !== "speechBeat") {
                openNodeCanvas(node);
              }
              return;
            }
            if (clickCount > 2) {
              return;
            }
            const conversationLine = eventInspector.open && contextTab === "edit" && inspectorSelection.type === "node"
              ? conversationLineForCanvasSelection(project, inspectorSelection.id, rememberedInspectorRequest.section, node.id)
              : undefined;
            if (conversationLine) {
              setConversationHighlightedNodeId(conversationLine);
              return;
            }
            if (directedNodeOpening) {
              onCanvasSelect(nodeSelection);
              return;
            }
            if (node.data.kind === "event" || node.data.kind === "dialogue" || node.data.kind === "directionBeat") {
              const timer = window.setTimeout(() => {
                if (pendingSubcanvasInspectorRef.current?.nodeId !== node.id) return;
                pendingSubcanvasInspectorRef.current = undefined;
                onOpenCanvasInspector(nodeSelection);
              }, SUBCANVAS_DOUBLE_CLICK_DELAY_MS);
              pendingSubcanvasInspectorRef.current = { nodeId: node.id, timer };
              return;
            }
            onOpenCanvasInspector(nodeSelection);
          }}
          onNodeContextMenu={(event, node) => {
            clearPendingSubcanvasInspector();
            openSelectionContextMenu(event, node);
          }}
          onEdgeClick={(event, edgeItem) => {
            clearPendingSubcanvasInspector();
            onDiscardPendingBoundaryPort();
            setContextMenu(undefined);
            setEditingEdgeId(undefined);
            clearPendingEdgeClick();
            if (edgeItem.data?.kind === "transition" && event.ctrlKey) {
              event.preventDefault();
              event.stopPropagation();
              const point = reactFlowInstance?.screenToFlowPosition({ x: event.clientX, y: event.clientY });
              if (point) onAddTransitionWaypoint(edgeItem.id, point);
              return;
            }
            const removable =
              edgeItem.id.startsWith("edge:transition:") ||
              edgeItem.id.startsWith("edge:boundary:") ||
              edgeItem.id.startsWith("edge:dialogue-entry:") ||
              edgeItem.id.startsWith("edge:entry:");
            if (!removable) return;
            event.stopPropagation();
            setActivePinKey(undefined);
            lastCanvasSelection.current = { type: "edge", id: edgeItem.id };
            onCanvasSelect(lastCanvasSelection.current);
          }}
          onEdgeContextMenu={openEdgeContextMenu}
          onPaneClick={() => {
            clearPendingSubcanvasInspector();
            onDiscardPendingBoundaryPort();
            setContextMenu(undefined);
            setEditingEdgeId(undefined);
            clearPendingEdgeClick();
            if (collapseInspectorTabOnCanvasClick && eventInspector.open) onCollapseInspector();
          }}
          onPaneContextMenu={openContextMenu}
          defaultViewport={project.canvas?.viewport}
          proOptions={{ hideAttribution: true }}
          snapToGrid={canvasBackground.snapToGrid}
          snapGrid={snapGrid}
        >
          {minimapOpen && !testingActive ? (
            <CanvasMiniMap locale={canvasUiLocale === "es" ? "es" : "en"} />
          ) : null}
          {isNestedCanvas ? (
            <Panel position="top-left" className="canvas-advanced-tools">
              <div className="canvas-advanced-tool">
                <button type="button" className="canvas-advanced-tools-trigger" title="Adapt canvas size" aria-label="Adapt canvas size">
                  <Maximize2 size={15} aria-hidden="true" />
                </button>
                <div className="canvas-advanced-tools-popover nodrag nopan">
                  <strong>Adapt canvas size</strong>
                  <span>Espacio alrededor de los nodos</span>
                  <label><input type="number" min={0} max={24} step={1} value={autoFitPaddingGridPoints} onChange={(event) => setAutoFitPaddingGridPoints(Math.min(24, Math.max(0, Number(event.target.value) || 0)))} /><em>puntos de grid</em></label>
                  <button type="button" onClick={fitNestedCanvasWorkspace}>Configurar</button>
                </div>
              </div>
              <div className="canvas-advanced-tool">
                <button type="button" className="canvas-advanced-tools-trigger" title="Arrange nodes in grid" aria-label="Arrange nodes in grid">
                  <LayoutGrid size={15} aria-hidden="true" />
                </button>
                <div className="canvas-advanced-tools-popover canvas-grid-layout-popover nodrag nopan">
                  <strong>Ordenar nodos</strong>
                  <span>{selectedLayoutNodeIds.length ? `Ordena solo los ${selectedLayoutNodeIds.length} nodos seleccionados.` : "Respeta la secuencia de transiciones; los nodos sin ruta usan su orden visual actual."}</span>
                  <label><select aria-label="Layout mode" value={nestedLayoutMode} onChange={(event) => setNestedLayoutMode(event.target.value as NestedLayoutMode)}><option value="grid">Grid</option><option value="linear">Lineal</option></select><em>modo</em></label>
                  {nestedLayoutMode === "grid" ? <label><input type="number" min={1} max={24} step={1} value={gridLayoutColumns} onChange={(event) => setGridLayoutColumns(Math.min(24, Math.max(1, Number(event.target.value) || 1)))} /><em>columnas</em></label> : null}
                  <label><input type="number" min={0} max={24} step={1} value={gridLayoutHorizontalGap} onChange={(event) => setGridLayoutHorizontalGap(Math.min(24, Math.max(0, Number(event.target.value) || 0)))} /><em>espacio horizontal · grid</em></label>
                  {nestedLayoutMode === "grid" ? <label><input type="number" min={0} max={24} step={1} value={gridLayoutVerticalGap} onChange={(event) => setGridLayoutVerticalGap(Math.min(24, Math.max(0, Number(event.target.value) || 0)))} /><em>espacio vertical · grid</em></label> : null}
                  <button type="button" onClick={() => onArrangeScopeNodes({ mode: nestedLayoutMode, columns: gridLayoutColumns, horizontalGapCells: gridLayoutHorizontalGap, verticalGapCells: gridLayoutVerticalGap, selectedNodeIds: selectedLayoutNodeIds })}>{nestedLayoutMode === "linear" ? "Ordenar en línea" : "Ordenar en grid"}</button>
                </div>
              </div>
            </Panel>
          ) : null}
          <Controls position="bottom-left">
            <div className="canvas-tools-anchor">
              <button
                type="button"
                ref={canvasToolsTriggerRef}
                className={`react-flow__controls-button canvas-tools-trigger${canvasToolsOpen ? " active" : ""}`}
                onClick={() => setCanvasToolsOpen((open) => !open)}
                title="More canvas tools"
                aria-label="More canvas tools"
                aria-expanded={canvasToolsOpen}
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </button>
              {canvasToolsOpen ? (
                createPortal(
                <div
                  className="canvas-tools-menu"
                  role="group"
                  aria-label="Additional canvas tools"
                  style={{ left: canvasToolsPosition.left, top: canvasToolsPosition.top }}
                >
                  <button
                    type="button"
                    className={`react-flow__controls-button canvas-interaction-toggle${directedNodeOpening ? " active" : ""}`}
                    aria-pressed={directedNodeOpening}
                    onClick={() => setDirectedNodeOpening((enabled) => !enabled)}
                    title={canvasUiLocale === "es"
                      ? directedNodeOpening ? "Clic dirigido: un clic selecciona; mantener 0,75 segundos abre el inspector; doble clic entra al subcanvas" : "Activar clic dirigido"
                      : directedNodeOpening ? "Directed click: click to select; hold for 0.75 seconds to open the inspector; double-click to enter the subcanvas" : "Enable directed opening"}
                    aria-label={canvasUiLocale === "es"
                      ? directedNodeOpening ? "Desactivar clic dirigido" : "Activar clic dirigido"
                      : directedNodeOpening ? "Disable directed opening" : "Enable directed opening"}
                  >
                    <MousePointerClick size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`react-flow__controls-button ${minimapOpen ? "active" : ""}`}
                    disabled={testingActive}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (testingActive) return;
                      onMinimapOpenChange(!minimapOpen);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    title={testingActive ? canvasUiLocale === "es" ? "Detén el recorrido para recuperar el minimapa" : "Stop the run to restore the minimap" : minimapOpen ? "Hide minimap" : "Show minimap"}
                    aria-label={testingActive ? canvasUiLocale === "es" ? "Minimapa sustituido por la previsualización" : "Minimap replaced by story preview" : minimapOpen ? "Hide minimap" : "Show minimap"}
                  >
                    {minimapOpen ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>,
                shellRef.current?.closest(".pathbranching-app") ?? document.body,
                )
              ) : null}
            </div>
          </Controls>
          {canvasBackground.showGrid ? (
            <Background
              id="grid"
              variant={BackgroundVariant.Lines}
              gap={canvasBackground.gridSize}
              size={1}
              color={backgroundColor}
            />
          ) : null}
          {canvasBackground.showDots ? (
            <Background
              id="dots"
              variant={BackgroundVariant.Dots}
              gap={canvasBackground.gridSize}
              size={1.5}
              color={`color-mix(in srgb, var(--ef-star-guide) ${Math.round(dotOpacity * 100)}%, transparent)`}
            />
          ) : null}
        </ReactFlow>
      </ReactFlowProvider>
      {contextMenu ? (
        <div
          className={`canvas-menu ${contextMenu.kind === "create" || contextMenu.kind === "connect-create" ? "canvas-create-menu" : ""}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.kind === "selection" ? (
            <>
              <span className="canvas-menu-label">
                {contextMenu.nodeIds?.length ?? 0} selected node{(contextMenu.nodeIds?.length ?? 0) === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  contextMenu.nodeIds?.forEach((id) =>
                    onSelect({ type: "node", id }),
                  );
                  setContextMenu(undefined);
                }}
              >
                Open inspectors
              </button>
              {(() => {
                const contextNode = contextMenu.contextNodeId
                  ? nodes.find((node) => node.id === contextMenu.contextNodeId)
                  : undefined;
                const canOpenScript =
                  (contextNode?.data.kind === "speechBeat" || contextNode?.data.kind === "directionBeat") &&
                  typeof contextNode.data.details?.eventId === "string";
                if (canOpenScript && contextNode) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        openNodeCanvas(contextNode);
                        setContextMenu(undefined);
                      }}
                    >
                      Open script
                    </button>
                  );
                }
                if (contextNode?.data.kind !== "event") return null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      openNodeCanvas(contextNode);
                      setContextMenu(undefined);
                    }}
                  >
                    Open subcanvas
                  </button>
                );
              })()}
              {activeScope?.kind === "event" && canCreateDialogueFromSelection(nodes, contextMenu.nodeIds ?? []) ? (
                <button
                  type="button"
                  onClick={() => {
                    onGroupDialogueMembers(contextMenu.nodeIds ?? []);
                    setContextMenu(undefined);
                  }}
                >
                  Create Dialogue from selection
                </button>
              ) : null}
              {activeDialogueScope && (contextMenu.nodeIds ?? []).some((id) => {
                const selectedNode = nodes.find((node) => node.id === id);
                return selectedNode?.data.kind === "speechBeat" || selectedNode?.data.kind === "directionBeat" || selectedNode?.data.kind === "decision";
              }) ? (
                <button
                  type="button"
                  onClick={() => {
                    onDetachDialogueMembers(contextMenu.nodeIds ?? []);
                    setContextMenu(undefined);
                  }}
                >
                  Detach selected
                </button>
              ) : null}
              {(contextMenu.nodeIds ?? []).length === 1 && (() => {
                const selectedNode = nodes.find((node) => node.id === contextMenu.nodeIds?.[0]);
                const dialogue = selectedNode?.data.details?.dialogue as { id?: string } | undefined;
                const eventId = selectedNode?.data.details?.eventId;
                if (selectedNode?.data.kind !== "dialogue" || typeof dialogue?.id !== "string" || typeof eventId !== "string") return null;
                return <button type="button" onClick={() => { onDissolveDialogue(eventId, dialogue.id!); setContextMenu(undefined); }}>Dissolve Dialogue</button>;
              })()}
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onDeleteNodeSelections(contextMenu.nodeIds ?? []);
                  setContextMenu(undefined);
                }}
              >
                Delete selected
              </button>
            </>
          ) : contextMenu.kind === "route-gate" ? (
            <>
              <span className="canvas-menu-label">Transition</span>

            </>
          ) : contextMenu.kind === "connect-create" ? (
            <>
              <span className="canvas-menu-label">
                {activeEventScope || activeDialogueScope
                  ? canvasUiLocale === "es" ? "Crear conexión" : "Create connection"
                  : canvasUiLocale === "es" ? "Crear evento conectado" : "Create connected event"}
              </span>
              {activeScope?.kind === "event" || activeDialogueScope ? (() => {
                const scope = activeScope?.kind === "event" ? activeScope : activeDialogueScope;
                const sourceNodeId = contextMenu.sourceNodeId;
                if (!scope || !sourceNodeId) return null;
                const connectNarrativeNode = (
                  kind: ConnectedNarrativeNodeKind,
                  nodeKind: StoryCanvasNodeData["kind"],
                ) => {
                  onCreateConnectedNarrativeNode(
                    scope,
                    sourceNodeId,
                    kind,
                    positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, nodeKind),
                    contextMenu.sourceHandleId,
                  );
                  setContextMenu(undefined);
                };
                return (
                  <>
                    <section className="canvas-menu-group">
                      <span className="canvas-menu-group-label">
                        {canvasUiLocale === "es" ? "Líneas narrativas" : "Narrative lines"}
                      </span>
                      {activeEventScope ? (
                        <>
                          <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="dialogueStart" size={17} />} onClick={() => connectNarrativeNode("dialogueStart", "dialogueStart")}>
                            {canvasUiLocale === "es" ? "Activador" : "Trigger"}
                          </CanvasCreateMenuItem>
                          <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="speechBeat" size={17} />} onClick={() => connectNarrativeNode("speechBeat", "speechBeat")}>
                            {canvasUiLocale === "es" ? "Diálogo" : "Dialogue"}
                          </CanvasCreateMenuItem>
                        </>
                      ) : null}
                      <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="decision" size={17} />} onClick={() => connectNarrativeNode("decision", "decision")}>
                        {canvasUiLocale === "es" ? "Decisión" : "Decision"}
                      </CanvasCreateMenuItem>
                      <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="directionBeat" size={17} />} onClick={() => connectNarrativeNode("directionBeat", "directionBeat")}>
                        {canvasUiLocale === "es" ? "Acotación" : "Stage direction"}
                      </CanvasCreateMenuItem>
                    </section>
                    <div className="canvas-menu-divider" />
                    <section className="canvas-menu-group">
                      <span className="canvas-menu-group-label">
                        {canvasUiLocale === "es" ? "Mecánicas" : "Mechanics"}
                      </span>
                      <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="interaction" size={17} />} onClick={() => connectNarrativeNode("interaction", "interaction")}>
                        {canvasUiLocale === "es" ? "Interacción" : "Interaction"}
                      </CanvasCreateMenuItem>
                    </section>
                    <div className="canvas-menu-divider" />
                    <section className="canvas-menu-group">
                      <span className="canvas-menu-group-label">
                        {canvasUiLocale === "es" ? "Estructura" : "Structure"}
                      </span>
                      {!activeEventScope ? (
                        <EventTypeMenuButton
                          label={activeDialogueScope ? (canvasUiLocale === "es" ? "Subevento" : "Sub-event") : (canvasUiLocale === "es" ? "Evento" : "Event")}
                          icon={<StoryCanvasNodeIcon kind="event" size={17} />}
                          options={eventTypeOptions}
                          onSelect={(categoryId) => {
                            onCreateConnectedEvent(
                              sourceNodeId,
                              categoryId,
                              positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "event"),
                              contextMenu.sourceHandleId,
                            );
                            setContextMenu(undefined);
                          }}
                        />
                      ) : null}
                      <CanvasCreateMenuItem icon={<StoryCanvasNodeIcon kind="dialogue" size={17} />} onClick={() => connectNarrativeNode("dialogue", "dialogue")}>
                        {canvasUiLocale === "es" ? "Conversación" : "Conversation"}
                      </CanvasCreateMenuItem>
                    </section>
                  </>
                );
              })() : (
                <section className="canvas-menu-group">
                  <span className="canvas-menu-group-label">
                    {canvasUiLocale === "es" ? "Eventos" : "Events"}
                  </span>
                  <EventTypeMenuButton
                    label={canvasUiLocale === "es" ? "Evento" : "Event"}
                    icon={<StoryCanvasNodeIcon kind="event" size={17} />}
                    options={eventTypeOptions}
                    onSelect={(categoryId) => {
                      if (contextMenu.sourceNodeId) {
                        onCreateConnectedEvent(
                          contextMenu.sourceNodeId,
                          categoryId,
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "event"),
                          contextMenu.sourceHandleId,
                        );
                      }
                      setContextMenu(undefined);
                    }}
                  />
                </section>
              )}
            </>
          ) : activeDialogueScope ? (
            <>
              <span className="canvas-menu-label">
                {canvasUiLocale === "es" ? "Crear dentro de la conversación" : "Create inside conversation"}
              </span>
              <section className="canvas-menu-group">
                <span className="canvas-menu-group-label">
                  {canvasUiLocale === "es" ? "Líneas" : "Lines"}
                </span>
                <CanvasCreateMenuItem
                  icon={<StoryCanvasNodeIcon kind="speechBeat" size={17} />}
                  onClick={() => {
                    onCreateDialogueBeat(
                      activeDialogueScope.eventId,
                      activeDialogueScope.id,
                      "speech",
                      positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "speechBeat"),
                    );
                    setContextMenu(undefined);
                  }}
                >
                  {canvasUiLocale === "es" ? "Diálogo" : "Dialogue"}
                </CanvasCreateMenuItem>
                <CanvasCreateMenuItem
                  icon={<StoryCanvasNodeIcon kind="directionBeat" size={17} />}
                  onClick={() => {
                    onCreateDialogueBeat(
                      activeDialogueScope.eventId,
                      activeDialogueScope.id,
                      "direction",
                      positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "directionBeat"),
                    );
                    setContextMenu(undefined);
                  }}
                >
                  {canvasUiLocale === "es" ? "Acotación" : "Stage direction"}
                </CanvasCreateMenuItem>
              </section>
              <div className="canvas-menu-divider" />
              <section className="canvas-menu-group">
                <span className="canvas-menu-group-label">
                  {canvasUiLocale === "es" ? "Mecánicas" : "Mechanics"}
                </span>
                <CanvasCreateMenuItem
                  icon={<StoryCanvasNodeIcon kind="interaction" size={17} />}
                  onClick={() => {
                    onCreateInteraction(
                      activeDialogueScope.eventId,
                      activeDialogueScope.id,
                      positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "interaction"),
                    );
                    setContextMenu(undefined);
                  }}
                >
                  {canvasUiLocale === "es" ? "Interacción" : "Interaction"}
                </CanvasCreateMenuItem>
              </section>
              <div className="canvas-menu-divider" />
              <section className="canvas-menu-group">
                <span className="canvas-menu-group-label">
                  {canvasUiLocale === "es" ? "Bifurcación" : "Branching"}
                </span>
                <CanvasCreateMenuItem
                  icon={<StoryCanvasNodeIcon kind="decision" size={17} />}
                  onClick={() => {
                    onCreateDecision(
                      activeDialogueScope.eventId,
                      activeDialogueScope.id,
                      positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "decision"),
                    );
                    setContextMenu(undefined);
                  }}
                >
                  {canvasUiLocale === "es" ? "Decisión" : "Decision"}
                </CanvasCreateMenuItem>
              </section>
            </>
          ) : (
            <>
              <span className="canvas-menu-label">
                {activeEventScope
                  ? canvasUiLocale === "es" ? "Crear dentro del evento" : "Create inside event"
                  : canvasUiLocale === "es" ? "Crear evento" : "Create event"}
              </span>
              {activeEventScope ? (
                <>
                  <section className="canvas-menu-group">
                    <span className="canvas-menu-group-label">
                      {canvasUiLocale === "es" ? "Narrativa" : "Narrative"}
                    </span>
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="dialogueStart" size={17} />}
                      onClick={() => {
                        onCreateDialogueStart(
                          activeEventScope.id,
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "dialogueStart"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Activador" : "Trigger"}
                    </CanvasCreateMenuItem>
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="speechBeat" size={17} />}
                      onClick={() => {
                        onCreateEventDialogueBeat(
                          activeEventScope.id,
                          "speech",
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "speechBeat"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Diálogo" : "Dialogue"}
                    </CanvasCreateMenuItem>
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="decision" size={17} />}
                      onClick={() => {
                        onCreateDecision(
                          activeEventScope.id,
                          undefined,
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "decision"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Decisión" : "Decision"}
                    </CanvasCreateMenuItem>
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="directionBeat" size={17} />}
                      onClick={() => {
                        onCreateEventDialogueBeat(
                          activeEventScope.id,
                          "direction",
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "directionBeat"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Acotación" : "Stage direction"}
                    </CanvasCreateMenuItem>
                  </section>
                  <div className="canvas-menu-divider" />
                  <section className="canvas-menu-group">
                    <span className="canvas-menu-group-label">
                      {canvasUiLocale === "es" ? "Mecánicas" : "Mechanics"}
                    </span>
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="interaction" size={17} />}
                      onClick={() => {
                        onCreateInteraction(
                          activeEventScope.id,
                          undefined,
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "interaction"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Interacción" : "Interaction"}
                    </CanvasCreateMenuItem>
                  </section>
                  <div className="canvas-menu-divider" />
                  <section className="canvas-menu-group">
                    <span className="canvas-menu-group-label">
                      {canvasUiLocale === "es" ? "Estructura" : "Structure"}
                    </span>
                    <EventTypeMenuButton
                      label={canvasUiLocale === "es" ? "Subevento" : "Sub-event"}
                      icon={<StoryCanvasNodeIcon kind="event" size={17} />}
                      options={eventTypeOptions}
                      onSelect={(categoryId) => {
                        onCreateNestedEvent(
                          activeEventScope.id,
                          categoryId,
                          { ...positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "event") },
                        );
                        setContextMenu(undefined);
                      }}
                    />
                    <CanvasCreateMenuItem
                      icon={<StoryCanvasNodeIcon kind="dialogue" size={17} />}
                      onClick={() => {
                        onCreateDialogue(
                          activeEventScope.id,
                          positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "dialogue"),
                        );
                        setContextMenu(undefined);
                      }}
                    >
                      {canvasUiLocale === "es" ? "Conversación" : "Conversation"}
                    </CanvasCreateMenuItem>
                  </section>
                </>
              ) : (
                <section className="canvas-menu-group">
                  <span className="canvas-menu-group-label">
                    {canvasUiLocale === "es" ? "Eventos" : "Events"}
                  </span>
                  <EventTypeMenuButton
                    label={canvasUiLocale === "es" ? "Evento" : "Event"}
                    icon={<StoryCanvasNodeIcon kind="event" size={17} />}
                    options={eventTypeOptions}
                    onSelect={(categoryId) => {
                      onCreateEvent(categoryId, {
                        ...positionForNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }, "event"),
                      });
                      setContextMenu(undefined);
                    }}
                  />
                </section>
              )}
            </>
          )}
        </div>
      ) : null}

      {dataOpen ? (
        <DataDrawer
          project={project}
          selectedId={
            selection?.type === "dataObject" ? selection.id : undefined
          }
          onSelect={(id) => onSelect({ type: "dataObject", id })}
          onCreateDataObject={onCreateDataObject}
          onCreateKnowledgeObject={onCreateKnowledgeObject}
          onClose={onToggleData}
        />
      ) : null}

      </div>
      {contextFocus && contextVisible ? <div className="pb-inspector-backdrop" aria-hidden="true" /> : null}
      <aside className="pb-context-surface" hidden={!contextVisible} aria-label={canvasUiLocale === "es" ? "Panel contextual" : "Context panel"}>
        <div className="pb-context-edit" hidden={contextTab !== "edit"}>
      <EventAuthoringDock onNameMutation={onAuthoringMutation} project={project} nodes={inspectorGraph.nodes} selection={inspectorSelection} eventDraft={eventDraft} eventInspector={eventInspector} tabGroups={eventInspectorTabGroups}
        toolbarHost={inspectorToolbarHost}
        fullscreen={contextFocus} onFullscreenChange={onContextFocusChange}
        inspectorTabs={inspectorTabs} expandedInspectorTabId={expandedInspectorTabId} inspectorMaximized={inspectorMaximized} inspectorSize={inspectorSize} onInspectorResize={onInspectorResize} onFold={onCollapseInspector} inspectorStackOrder={inspectorStackOrder} onInspectorStackOrderChange={onInspectorStackOrderChange}
        onOpenEvent={id=>onOpenCanvasInspector({type:"node",id})} onCollapseEvent={onCollapseEventInspectorEvent} onCloseEvent={onCloseEventInspectorEvent} onCloseAllEvents={onCloseAllEventInspectorEvents} onCloseEventsAbove={onCloseEventInspectorEventsAbove} onCloseEventsBelow={onCloseEventInspectorEventsBelow} onCloseOtherEvents={onCloseOtherEventInspectorEvents} onPruneEvents={onPruneEventInspectorEvents}
        onSaveGroup={onSaveEventInspectorTabGroup} onLoadGroup={onLoadEventInspectorTabGroup} onDeleteGroup={onDeleteEventInspectorTabGroup} onSelect={onSelect} onLocateInspectorTab={locateInspectorSelection}
        onOpenInspectorTab={onOpenInspectorTab} onCloseInspectorTab={onCloseInspectorTab} onCloseAllInspectorTabs={onCloseAllInspectorTabs} onCloseInspectorTabsAbove={closeExplorerInspectorTabsAbove} onCloseInspectorTabsBelow={closeExplorerInspectorTabsBelow} onCloseOtherInspectorTabs={closeOtherExplorerInspectorTabs} onDisableInspectorDebug={onDisableInspectorDebug} onToggleInspectorMaximized={onToggleInspectorMaximized}>
        {inspectorSelection.type === "storyDebug" ? inspectorDebugContent : inspectorSelection.type === "storyPlay" ? contextTab === "edit" ? storyTestPlayTab : null : renderInspector(inspectorSelection, inspectorGraph, () => closeInspectorTarget(inspectorSelection))}
      </EventAuthoringDock>
        </div>
        <div className="pb-context-test" hidden={contextTab !== "test"}>
          <div className="pb-context-test-tools" role="toolbar" aria-label={canvasUiLocale === "es" ? "Vista de prueba" : "Test view"}>
            {eventInspector.open ? <button type="button" onClick={onOpenStoryPlay}><Pencil size={15} />{canvasUiLocale === "es" ? "Volver al inspector" : "Back to inspector"}</button> : null}
            <button type="button" aria-label={contextFocus ? canvasUiLocale === "es" ? "Salir de pantalla completa" : "Exit fullscreen" : canvasUiLocale === "es" ? "Pantalla completa del canvas" : "Canvas fullscreen"} title={contextFocus ? canvasUiLocale === "es" ? "Salir de pantalla completa" : "Exit fullscreen" : canvasUiLocale === "es" ? "Pantalla completa del canvas" : "Canvas fullscreen"} onClick={() => onContextFocusChange(!contextFocus)}>{contextFocus ? <Shrink size={15} /> : <Fullscreen size={15} />}</button>
          </div>
          {contextTab === "test" ? storyTestWorkspace : null}
        </div>
      </aside>
    </main>
  );
}

const STARTUP_LOADER_MIN_MS = 700;

export function App({ suiteChrome }: { suiteChrome?: SuiteChrome } = {}) {
  return <ApplicationActivity.Provider value={suiteChrome?.active ?? true}><NotificationProvider host={suiteChrome?.notifications} source="PathBranching" active={suiteChrome?.active ?? true}><div className="pathbranching-app" data-ambient-background={suiteChrome?.suiteSettings?.ambientBackground ?? loadSettings().ambientBackground !== false} data-background-scene={normalizeBackgroundScene(suiteChrome?.suiteSettings?.backgroundScene ?? loadSettings().backgroundScene)} data-window-chrome={!suiteChrome && isTauriRuntime() ? "true" : undefined} data-theme={suiteChrome?.suiteSettings?.style ?? loadSettings().theme}><PathBranchingApp suiteChrome={suiteChrome} /></div></NotificationProvider></ApplicationActivity.Provider>;
}

function PathBranchingApp({ suiteChrome }: { suiteChrome?: SuiteChrome } = {}) {
  const desktopRuntime = isTauriRuntime();
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  useEffect(() => {
    applyInterfaceLocale(suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference);
  }, [settings.localePreference, suiteChrome?.suiteSettings?.localePreference]);
  const activeTheme = (suiteChrome?.suiteSettings?.style ?? settings.theme) as ThemeId;
  const uiLocale = resolveInterfaceLocale(suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference);
  const uiLocaleRef = useRef(uiLocale);
  uiLocaleRef.current = uiLocale;
  const uiCopy = authoringUiCopy(uiLocale);
  const [view, setView] = useState<AppView>(
    () => loadSettings().lastView ?? "home",
  );
  const settingsRef = useRef(settings);
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<PathBranchingSettingsSection>();
  useEffect(() => suiteChrome?.registerSettingsOpener?.((section) => {
    setSettingsInitialSection(section);
    setShowSettings(true);
  }), [suiteChrome?.registerSettingsOpener]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [workspace, setWorkspace] = useState<PathBranchingWorkspace>();
  const [interactionLibrary, setInteractionLibrary] = useState(defaultInteractionMechanicsLibrary);
  const [itemCatalog, setItemCatalog] = useState(emptyItemCatalog);
  const [itemCatalogError, setItemCatalogError] = useState<string>();
  const [interactionLibraryError, setInteractionLibraryError] = useState<string>();
  const [interactionLibraryEditor, setInteractionLibraryEditor] = useState<{ presetId?: string; revision: number; projectId: string }>();
  const creationCaptureRef = useRef<{ edited?: BranchingProject } | undefined>(undefined);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [showInteractionTutorial, setShowInteractionTutorial] = useState(
    () =>
      !suiteChrome?.learning && window.localStorage.getItem(PATHBRANCHING_INTERACTION_TUTORIAL_KEY) !==
      "dismissed",
  );
  const [project, setProject] = useState<BranchingProject>();
  const recoverableDraftCount = useAuthoringDraftCount(project?.projectId ?? "");
  const [pendingRecovery, setPendingRecovery] = useState<AuthoringRecovery>();
  const [fileState, setFileState] = useState<ProjectFileState>({
    dirty: false,
  });
  const reportLearning = useLearningReporter(suiteChrome?.learning, fileState.universePath);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [requestedPanel, setRequestedPanel] = useState<{ id?: WorkspacePanelId; revision: number }>();
  const [nodes, setNodes] = useState<StoryCanvasNode[]>([]);
  const nodesRef = useRef<StoryCanvasNode[]>([]);
  const [edges, setEdges] = useState<StoryCanvasEdge[]>([]);
  const [files, setFiles] = useState<PathBranchingFileItem[]>([]);
  const [selection, setSelection] = useState<Selection>();
  const deselectCanvasNode = useCallback((nodeId: string) => {
    setNodes((current) => {
      if (!current.some((node) => node.id === nodeId && node.selected)) return current;
      return current.map((node) => node.id === nodeId ? { ...node, selected: false } : node);
    });
  }, []);
  const [canonOpen, setCanonOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [panelVisibility, setPanelVisibility] = useState<WorkspacePanelState>(
    DEFAULT_WORKSPACE_PANEL_VISIBILITY,
  );
  const [panelCollapsed, setPanelCollapsed] = useState<WorkspacePanelState>(
    DEFAULT_WORKSPACE_PANEL_COLLAPSED,
  );
  const [explorerTab, setExplorerTab] = useState<ExplorerPanelId>("outline");
  const [contextTab, setContextTab] = useState<"edit" | "test">("edit");
  const [contextFocus, setContextFocus] = useState(false);
  const playPreferredFullscreenRef = useRef(false);
  const playDetachedPresentationRef = useRef<{ fullscreen: boolean; tabId: string } | undefined>(undefined);
  const playRestoreOnOpenRef = useRef(false);
  const playDetachedWindowActiveRef = useRef(false);
  const playDetachingRef = useRef(false);
  const playWasDetachedRef = useRef(false);
  const [focusedScriptBlock, setFocusedScriptBlock] = useState<{
    scriptId: string;
    blockId: string;
  }>();
  const [inspectorRequest, setInspectorRequest] = useState<InspectorRequest>();
  const [inspectorSections, setInspectorSections] = useState<Record<string,string>>({});
  const [inspectorSize, setInspectorSize] = useState<InspectorSize>({ width:640 });
  const [inspectorStackOrder, setInspectorStackOrder] = useState<string[]>([]);
  const openInspectorRef = useRef<(target:Selection,section?:string,focusId?:string)=>void>(()=>undefined);
  const stopStoryTestRef = useRef<() => void>(() => undefined);
  const [testPosition, setTestPosition] = useState<string>();
  const [testVisited, setTestVisited] = useState<string[]>([]);
  const [selectedLogicRuleId, setSelectedLogicRuleId] = useState<string>();
  const [canonWidth, setCanonWidth] = useState(DEFAULT_EXPLORER_WIDTH);
  const [storiesWidth, setStoriesWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [panelResizing, setPanelResizing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPreviewMode, setExportPreviewMode] =
    useState<ExportPreviewMode>("runtime");
  const [dataOpen, setDataOpen] = useState(false);
  const [eventInspector, setEventInspector] = useState<EventInspectorState>(
    DEFAULT_EVENT_INSPECTOR_STATE,
  );
  const [eventInspectorTabGroups, setEventInspectorTabGroups] = useState<
    EventInspectorTabGroup[]
  >([]);
  const [inspectorTabs, setInspectorTabs] = useState<InspectorTab[]>([]);
  const [expandedInspectorTabId, setExpandedInspectorTabId] = useState<string>();
  const [inspectorMaximized, setInspectorMaximized] = useState(false);
  const [markdownTabs, setMarkdownTabs] = useState<MarkdownEditorTab[]>([]);
  const [activeMarkdownTabId, setActiveMarkdownTabId] = useState<string>();
  const [eventDraft, setEventDraft] = useState<EventDraft>();
  const [manualInspectorDrafts, setManualInspectorDrafts] = useState<
    Record<string, ManualInspectorDraft>
  >({});
  useEffect(() => {
    if (!project || !eventDraft) return;
    setAuthoringDraft(authoringDraftKey(project.projectId, eventDraft.eventId, "event-inspector"), eventDraft.dirty ? JSON.stringify(eventDraft) : undefined);
  }, [project?.projectId, eventDraft]);
  useEffect(() => {
    const configure = (event: Event) => {
      const detail = (event as CustomEvent<{ entityId?: string }>).detail;
      if (detail?.entityId) openInspectorRef.current({ type: projectRef.current?.canonRefs.some(ref=>ref.id===detail.entityId) ? "canon" : "explorerEntity", id: detail.entityId }, "uses");
    };
    window.addEventListener("pathbranching:configure-entity", configure);
    const locate = (event: Event) => {
      const detail = (event as CustomEvent<{ tab: string; id: string; entityId?: string }>).detail;
      if (!detail) return;
      const entityId = detail.entityId ?? detail.id;
      const target:Selection = detail.tab === "actions" ? {type:"narrativeAction",id:detail.id} : detail.tab === "rules" ? {type:"narrativeRule",id:detail.id} : projectRef.current?.entityInstances?.some(copy=>copy.id===detail.id) ? {type:"entityInstance",id:detail.id} : {type:projectRef.current?.canonRefs.some(ref=>ref.id===entityId) ? "canon" : "explorerEntity",id:entityId};
      openInspectorRef.current(target, detail.tab === "entities" ? "copies" : "overview", detail.id);
    };
    window.addEventListener("pathbranching:locate-authoring", locate);
    return () => { window.removeEventListener("pathbranching:configure-entity", configure); window.removeEventListener("pathbranching:locate-authoring", locate); };
  }, []);
  const [storyOutlineTab, setStoryOutlineTab] =
    useState<StoryOutlineTab>("sequence");
  const [activeScope, setActiveScopeState] = useState<CanvasScope>();
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("branching");
  const [canvasLayerMode, setCanvasLayerMode] = useState<CanvasLayerMode>(() =>
    loadSettings().authoringDisplay.logicMode ? "logic" : "visual",
  );
  const [focusNodeId, setFocusNodeId] = useState<string>();
  const [undoStack, setUndoStack] = useState<BranchingProject[]>([]);
  const [redoStack, setRedoStack] = useState<BranchingProject[]>([]);
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const [nameDialog, setNameDialog] = useState<
    | {
        kind: "createStory";
        title: string;
        label: string;
        initialValue?: string;
      }
    | {
        kind: "renameStory";
        title: string;
        label: string;
        initialValue?: string;
      }
    | {
        kind: "createSequence";
        title: string;
        label: string;
        initialValue?: string;
      }
    | {
        kind: "renameSequence";
        title: string;
        label: string;
        initialValue?: string;
      }
    | {
        kind: "saveInspectorTabGroup";
        title: string;
        label: string;
        initialValue?: string;
      }
    | {
        kind: "createDialogue";
        title: string;
        label: string;
        initialValue?: string;
        eventId: string;
        position?: CanvasPoint;
        connected?: {
          scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>;
          sourceNodeId: string;
          sourceHandleId?: string;
        };
      }
    | {
        kind: "createDialogueFromSelection";
        title: string;
        label: string;
        initialValue?: string;
        eventId: string;
        members: DialogueMemberRef[];
      }
  >();
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: "deleteStory"; title: string; message: string }
    | { kind: "deleteSequence"; title: string; message: string }
    | { kind: "deleteLocalExplorerEntity"; entityId: string; title: string; message: string }
  >();
  const [missingRecentProjects, setMissingRecentProjects] = useState<
    Set<string>
  >(new Set());
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  useNotificationMessage(message, "info", { silent: !settings.showStatusMessages });
  useNotificationMessage(error && error !== saveError ? error : undefined, "error");
  useNotificationMessage(saveError, "error", { action: { label: uiLocale === "es" ? "Reintentar guardado" : "Retry save", run: () => persistProjectRef.current?.({ manual: true }) } });
  const [panelContextMenu, setPanelContextMenu] = useState<{
    x: number;
    y: number;
  }>();
  const panelContextMenuRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<BranchingProject | undefined>(undefined);
  const pendingBoundaryPortRef = useRef<{
    eventId: string;
    dialogueId?: string;
    direction: "input" | "output";
    slotId: string;
    nodeId: string;
    selected: boolean;
  } | undefined>(undefined);
  const canvasLayerModeRef = useRef<CanvasLayerMode>(canvasLayerMode);
  const workspaceRef = useRef<PathBranchingWorkspace | undefined>(undefined);
  const fileStateRef = useRef<ProjectFileState>({ dirty: false });
  const selectionRef = useRef<Selection | undefined>(undefined);
  const canvasClipboardRef = useRef<CanvasClipboard | undefined>(undefined);
  const canvasPasteOffsetRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const switchDraftsRef = useRef(false);
  switchDraftsRef.current = Boolean(recoverableDraftCount || eventDraft?.dirty || Object.values(manualInspectorDrafts).some((draft) => draft.dirty) || markdownTabs.some((tab) => tab.dirty) || pendingRecovery);
  const persistProjectRef = useRef<
    ((options?: { manual?: boolean }) => Promise<void>) | undefined
  >(undefined);
  const projectRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const pendingPathSelectionRef = useRef<{
    scopeKey: string;
    selection: Selection;
  } | undefined>(undefined);

  useEffect(() => {
    const universePath = fileState.universePath;
    setOnboardingDismissed(
      universePath
        ? window.localStorage.getItem(`${PATHBRANCHING_ONBOARDING_KEY}:${universePath}`) === "dismissed"
        : false,
    );
  }, [fileState.universePath]);

  useEffect(() => {
    if (!settings.inspectorDebugEnabled || !selection || !project) {
      setInspectorTabs((current) =>
        current.filter((tab) => tab.mode !== "debug"),
      );
      return;
    }
    const debugTab: InspectorTab = {
      id: "debug:active",
      title: "Debug",
      selection,
      mode: "debug",
    };
    setInspectorTabs((current) => [
      ...current.filter((tab) => tab.mode !== "debug"),
      debugTab,
    ]);
    if (!eventInspector.expandedEventId && !expandedInspectorTabId) {
      setExpandedInspectorTabId(debugTab.id);
    }
  }, [
    eventInspector.expandedEventId,
    expandedInspectorTabId,
    project,
    selection,
    settings.inspectorDebugEnabled,
  ]);

  const applyProject = useCallback(
    (
      nextProject: BranchingProject,
      options: {
        dirty?: boolean;
        revision?: boolean;
        path?: string;
        universePath?: string;
        storyPath?: string;
        modifiedMs?: number;
      } = {},
    ) => {
      const currentProject = projectRef.current;
      const normalizedProject = currentProject && narrativeContentUnchanged(currentProject, nextProject)
        ? nextProject : normalizeProject(nextProject);
      const normalizedScope = activeCanvasScope(normalizedProject);
      const model = buildStoryCanvasModel(normalizedProject, {
        nodeColors: settingsRef.current.nodeColors,
        scope: normalizedScope,
        gridSize: settingsRef.current.canvasBackground.gridSize,
        authoringDisplay: settingsRef.current.authoringDisplay,
        canvasLayerMode: canvasLayerModeRef.current,
        interfaceLocale: uiLocaleRef.current,
      });
      if (options.dirty || options.revision) {
        projectRevisionRef.current += 1;
      }
      projectRef.current = normalizedProject;
      if ((options.dirty || options.revision) && fileStateRef.current.universePath && normalizedProject.storyId) {
        storeAuthoringRecovery(fileStateRef.current.universePath, normalizedProject.storyId, { project: normalizedProject, modifiedMs: fileStateRef.current.modifiedMs, savedAt: Date.now() });
      }
      workspaceRef.current = workspaceRef.current
        ? {
            ...workspaceRef.current,
            activeProject: normalizedProject,
          }
        : workspaceRef.current;
      setProject(normalizedProject);
      // Structural undo/redo also restores the event shown by a clean inspector.
      // Keep unapplied text drafts intact; their changes merge when applied.
      setEventDraft((currentDraft) => {
        if (!currentDraft || currentDraft.dirty) return currentDraft;
        const nextEvent = findEvent(normalizedProject, currentDraft.eventId);
        return nextEvent ? {
          ...currentDraft,
          baseEvent: structuredClone(nextEvent),
          draftEvent: structuredClone(nextEvent),
          saving: false,
        } : undefined;
      });
      setActiveScopeState(normalizedScope);
      setNodes(model.nodes);
      setEdges(model.edges);
      setFiles(model.files);
      setFileState((current) => {
        const nextState = {
          path: options.path ?? current.path,
          universePath: options.universePath ?? current.universePath,
          storyPath: options.storyPath ?? current.storyPath,
          dirty: options.revision ? true : options.dirty ?? current.dirty,
          lastSavedAt:
            options.dirty === false && !options.revision ? Date.now() : current.lastSavedAt,
          modifiedMs: options.modifiedMs ?? current.modifiedMs,
          universeProfile: current.universeProfile,
        };
        fileStateRef.current = nextState;
        return nextState;
      });
      if (options.dirty) {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                activeProject: normalizedProject,
              }
            : current,
        );
      }
    },
    [],
  );

  const applyWorkspace = useCallback(
    (nextWorkspace: PathBranchingWorkspace, universePath: string) => {
      const savedSession = normalizeWorkspaceSession(
        settingsRef.current.workspaceSessions?.[universePath],
      );
      const restoredLayerMode: CanvasLayerMode = savedSession.canvasLayerMode ??
        (settingsRef.current.authoringDisplay.logicMode ? "logic" : "visual");
      canvasLayerModeRef.current = restoredLayerMode;
      const activeProject = normalizeProject({
        ...nextWorkspace.activeProject,
        canonPropertyDescriptors: canonicalPropertyDescriptors(nextWorkspace.canonIndex.propertiesConfig),
        universeRootPath: universePath,
      });
      setPendingRecovery(readAuthoringRecovery(universePath, activeProject.storyId ?? ""));
      const restoredScope =
        savedSession.activeScope ??
        activeProject.canvas?.activeScope ??
        activeCanvasScope(activeProject);
      const activeProjectWithScope = normalizeProject({
        ...activeProject,
        canvas: {
          ...activeProject.canvas,
          activeScope: restoredScope,
          activeSequenceId:
            restoredScope?.kind === "sequence"
              ? restoredScope.id
              : activeProject.canvas?.activeSequenceId,
        },
      });
      const normalizedScope = activeCanvasScope(activeProjectWithScope);
      const model = buildStoryCanvasModel(activeProjectWithScope, {
        nodeColors: settingsRef.current.nodeColors,
        scope: normalizedScope,
        gridSize: settingsRef.current.canvasBackground.gridSize,
        authoringDisplay: settingsRef.current.authoringDisplay,
        canvasLayerMode: restoredLayerMode,
        interfaceLocale: uiLocaleRef.current,
      });
      workspaceRef.current = nextWorkspace;
      projectRef.current = activeProjectWithScope;
      projectRevisionRef.current = 0;
      savedRevisionRef.current = 0;
      setWorkspace(nextWorkspace);
      try { setItemCatalog(itemCatalogFromFiles(nextWorkspace.files)); setItemCatalogError(undefined); }
      catch (catalogError) { setItemCatalog(emptyItemCatalog()); setItemCatalogError(catalogError instanceof Error ? catalogError.message : String(catalogError)); }
      try { setInteractionLibrary(interactionLibraryFromFiles(nextWorkspace.files)); setInteractionLibraryError(undefined); }
      catch (libraryError) { setInteractionLibrary({version:1,presets:[]}); setInteractionLibraryError(libraryError instanceof Error ? libraryError.message : String(libraryError)); }
      setProject(activeProjectWithScope);
      setActiveScopeState(normalizedScope);
      setNodes(model.nodes);
      setEdges(model.edges);
      setFiles(model.files);
      const nextFileState = {
        path: nextWorkspace.activeStory?.path,
        storyPath: nextWorkspace.activeStory?.path,
        universePath,
        dirty: false,
        lastSavedAt: nextWorkspace.createdDefaultStory ? undefined : Date.now(),
        modifiedMs: nextWorkspace.storyModifiedMs,
        universeProfile: nextWorkspace.universeProfile,
      };
      fileStateRef.current = nextFileState;
      setFileState(nextFileState);
      setUndoStack([]);
      setRedoStack([]);
      setActionHistory([]);
      setEventDraft(undefined);
      setManualInspectorDrafts(recoverManualInspectorDrafts(activeProjectWithScope.projectId));
      setTestPosition(undefined);
      setTestVisited([]);
      setMarkdownTabs(savedSession.markdownTabs ?? []);
      setActiveMarkdownTabId(savedSession.activeMarkdownTabId);
      setCanonOpen(
        savedSession.canonOpen ?? activeProject.panels?.canonOpen ?? true,
      );
      setFilesOpen(
        savedSession.filesOpen ?? activeProject.panels?.filesOpen ?? true,
      );
      setPanelVisibility({
        ...DEFAULT_WORKSPACE_PANEL_VISIBILITY,
        ...savedSession.panelVisibility,
      });
      setRequestedPanel((current) => ({ revision: (current?.revision ?? 0) + 1 }));
      setExplorerTab(savedSession.explorerTab ?? (savedSession.panelCollapsed?.assets === false ? "assets" : savedSession.panelCollapsed?.logic === false ? "logic" : "outline"));
      setContextTab(savedSession.contextTab ?? "edit");
      setContextFocus(savedSession.contextFocus ?? false);
      const isFirstTutorialRun =
        !settingsRef.current.workspaceSessions?.[universePath];
      setPanelCollapsed(
        isFirstTutorialRun
          ? {
              assets: true,
              logic: true,
              player: true,
              outline: false,
              export: true,
              connect: true,
            }
          : {
              ...DEFAULT_WORKSPACE_PANEL_COLLAPSED,
              assets: savedSession.panelCollapsed?.assets ?? !(savedSession.canonOpen ?? activeProject.panels?.canonOpen ?? true),
              outline: !(savedSession.filesOpen ?? activeProject.panels?.filesOpen ?? true),
              ...savedSession.panelCollapsed,
            },
      );
      setCanonWidth(clampExplorerWidth(savedSession.canonWidth));
      setStoriesWidth(clampPanelWidth(savedSession.storiesWidth));
      setExportOpen(savedSession.exportOpen ?? false);
      setDataOpen(savedSession.dataOpen ?? false);
      setEventInspector(restoreEventInspectorState(savedSession));
      setEventInspectorTabGroups(savedSession.eventInspectorTabGroups ?? []);
      setInspectorTabs(savedSession.inspectorTabs ?? []);
      setExpandedInspectorTabId(savedSession.inspectorExpandedTabId);
      setInspectorMaximized(savedSession.inspectorMaximized ?? false);
      setInspectorSections(savedSession.inspectorSections ?? {});
      setInspectorSize(savedSession.inspectorSize ?? {width:640});
      setInspectorStackOrder(savedSession.inspectorStackOrder ?? []);
      setInspectorRequest(undefined);
      setStoryOutlineTab(savedSession.storyOutlineTab ?? "sequence");
      const initialSelectionId =
        normalizedScope?.kind === "sequence"
          ? normalizedScope.id
          : normalizedScope?.kind === "event"
            ? normalizedScope.id
            : (activeProjectWithScope.canvas?.activeSequenceId ??
              activeProjectWithScope.entrySequenceId ??
              activeProjectWithScope.sequences[0]?.id ??
              model.nodes[0]?.id);
      setSelection(
        savedSession.selection ??
          (initialSelectionId
            ? { type: "node", id: initialSelectionId }
            : undefined),
      );
      setCanvasMode(savedSession.canvasMode ?? "branching");
      setCanvasLayerMode(restoredLayerMode);
      setFocusNodeId(savedSession.focusNodeId);
      setError(undefined);
      setSaveError(undefined);
      setMessage(workspaceLoadWarningMessage(nextWorkspace));
    },
    [],
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    fileStateRef.current = fileState;
  }, [fileState]);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const restoreStructuralSnapshot = useCallback(
    (snapshot: {
      project?: BranchingProject;
      workspace?: PathBranchingWorkspace;
      fileState: ProjectFileState;
      selection?: Selection;
      undoStack: BranchingProject[];
      redoStack: BranchingProject[];
      revision: number;
      savedRevision: number;
    }) => {
      projectRevisionRef.current = snapshot.revision;
      savedRevisionRef.current = snapshot.savedRevision;
      workspaceRef.current = snapshot.workspace;
      fileStateRef.current = snapshot.fileState;
      projectRef.current = snapshot.project;
      setWorkspace(snapshot.workspace);
      setFileState(snapshot.fileState);
      setUndoStack(snapshot.undoStack);
      setRedoStack(snapshot.redoStack);
      setSelection(snapshot.selection);
      if (snapshot.project) {
        const snapshotScope = activeCanvasScope(snapshot.project);
        const model = buildStoryCanvasModel(snapshot.project, {
          nodeColors: settingsRef.current.nodeColors,
          scope: snapshotScope,
          gridSize: settingsRef.current.canvasBackground.gridSize,
          authoringDisplay: settingsRef.current.authoringDisplay,
          canvasLayerMode: canvasLayerModeRef.current,
          interfaceLocale: uiLocaleRef.current,
        });
        setProject(snapshot.project);
        setActiveScopeState(snapshotScope);
        setNodes(model.nodes);
        setEdges(model.edges);
        setFiles(model.files);
      } else {
        setProject(undefined);
        setActiveScopeState(undefined);
        setNodes([]);
        setEdges([]);
        setFiles([]);
      }
    },
    [],
  );

  const commitStructuralAction = useCallback(
    async (
      label: string,
      result: mutations.MutationResult | BranchingProject,
      nextSelection?: Selection,
      commitOptions: { recordUndo?: boolean; recordRedo?: boolean; recordActionHistory?: boolean; showStatus?: boolean } = {},
    ) => {
      const currentProject = projectRef.current;
      const mutationResult = "project" in result ? result : { project: result };
      if (creationCaptureRef.current) { creationCaptureRef.current.edited = mutationResult.project; return true; }
      const showStatus = commitOptions.showStatus !== false;

      if (!currentProject) {
        return false;
      }

      const changed = mutationResult.project !== currentProject;
      if (!changed) {
        if (mutationResult.selection) {
          setSelection(mutationResult.selection as Selection);
        }
        if (showStatus && mutationResult.message) {
          setMessage(mutationResult.message);
        }
        return true;
      }

      if (commitOptions.recordUndo !== false) {
        setUndoStack((current) => [...current.slice(-199), currentProject]);
      }
      if (commitOptions.recordRedo !== false) setRedoStack([]);
      if (commitOptions.recordActionHistory !== false) {
        setActionHistory((current) => [mutationResult.message ?? label, ...current].slice(0, 10));
      }
      applyProject(mutationResult.project, { dirty: true, revision: true });
      if (mutationResult.selection) {
        setSelection(mutationResult.selection as Selection);
      } else if (nextSelection) {
        setSelection(nextSelection);
      }
      if (showStatus) setMessage(mutationResult.message ?? `${label}...`);

      try {
        await persistProjectRef.current?.();
        for (const action of learningActionsForMutation(currentProject, mutationResult.project)) reportLearning(action, mutationResult.project.storyId ?? mutationResult.project.projectId);
        if (showStatus) setMessage(mutationResult.message ?? `${label} saved.`);
        return true;
      } catch (commitError) {
        // A disk error must not erase edits already visible in the document.
        // The save queue retains the latest revision for an explicit retry.
        setError(
          commitError instanceof Error
            ? commitError.message
            : String(commitError),
        );
        return false;
      }
    },
    [applyProject, redoStack, undoStack],
  );

  const updateLogicPropertyOverride = useCallback(
    (
      propertyId: string,
      source: "canon" | "local",
      changes: Partial<LogicPropertyOverride>,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const normalizedChanges = changes.entityPresentable === false
        ? { ...changes, dialogueTrigger: false }
        : changes;
      const updatedProject = updatePropertyCapability(currentProject, source, propertyId, normalizedChanges);
      
      // Commit directly without using drafts for immediate save
      void commitStructuralAction(
        "Updated property capability",
        updatedProject,
      );
    },
    [commitStructuralAction],
  );

  const updateLogicTypeOverride = useCallback(
    (
      typeId: string,
      source: "canon" | "local",
      changes: Partial<LogicTypeOverride>,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const normalizedTypeId = typeId.startsWith("type:") ? typeId.slice("type:".length) : typeId;

      const currentType = (currentProject.logicTypeOverrides ?? []).find(
        (item) => (item.typeId === normalizedTypeId || item.typeId === `type:${normalizedTypeId}`) && item.source === source,
      );
      const propertyId = `type:${normalizedTypeId}`;
      const currentProperty = (currentProject.logicPropertyOverrides ?? []).find(
        (item) => item.propertyId === propertyId && item.source === source,
      );
      const { typeId: _typeId, source: _source, ...typeCapabilities } = currentType ?? {};

      const updatedProject = {
        ...currentProject,
        // Entity types are properties in the current Logic model. Move any
        // legacy type capability data into that property override and keep all
        // capabilities (grantable/location/readable/writable) together.
        logicPropertyOverrides: [
          ...(currentProject.logicPropertyOverrides ?? []).filter(
            (item) => item.propertyId !== propertyId || item.source !== source,
          ),
          {
            ...typeCapabilities,
            ...currentProperty,
            propertyId,
            source,
            ...changes,
          },
        ],
        logicTypeOverrides: (currentProject.logicTypeOverrides ?? []).filter(
            (item) => (item.typeId !== normalizedTypeId && item.typeId !== `type:${normalizedTypeId}`) || item.source !== source,
        ),
      };

      void commitStructuralAction(
        "Updated type capability",
        updatedProject,
      );
    },
    [commitStructuralAction],
  );

  const runMutation = useCallback(
    (result: mutations.MutationResult, label = "Saved structural change") => {
      void commitStructuralAction(label, result);
    },
    [commitStructuralAction],
  );

  const commitCanvasAction = useCallback(
    (
      label: string,
      result: mutations.MutationResult | BranchingProject,
      nextSelection?: Selection,
    ) => {
      void commitStructuralAction(label, result, nextSelection);
    },
    [commitStructuralAction],
  );

  const addTransitionWaypoint = useCallback((edgeId: string, point: CanvasPoint) => {
    if (!edgeId.startsWith("edge:transition:")) return;
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const scope = activeScope ?? activeCanvasScope(currentProject);
    const background = settingsRef.current.canvasBackground;
    const snappedPoint = snapCanvasPoint(point, background.snapToGrid, background.gridSize);
    const waypoints = [...projectEdgeWaypoints(currentProject, edgeId, scope), snappedPoint];
    commitCanvasAction("Added transition waypoint", updateProjectEdgeWaypoints(currentProject, edgeId, waypoints, scope));
  }, [activeScope, commitCanvasAction]);

  const moveTransitionWaypoint = useCallback((edgeId: string, index: number, point: CanvasPoint, commit: boolean) => {
    if (!edgeId.startsWith("edge:transition:")) return;
    const background = settingsRef.current.canvasBackground;
    const snappedPoint = snapCanvasPoint(point, background.snapToGrid, background.gridSize);
    setEdges((current) => current.map((edgeItem) => {
      if (edgeItem.id !== edgeId || edgeItem.data?.kind !== "transition") return edgeItem;
      const waypoints = [...(edgeItem.data.waypoints ?? [])];
      if (index < 0 || index >= waypoints.length) return edgeItem;
      waypoints[index] = snappedPoint;
      return { ...edgeItem, data: { ...edgeItem.data, waypoints } };
    }));
    if (!commit) return;
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const scope = activeScope ?? activeCanvasScope(currentProject);
    const waypoints = [...projectEdgeWaypoints(currentProject, edgeId, scope)];
    if (index < 0 || index >= waypoints.length) return;
    waypoints[index] = snappedPoint;
    commitCanvasAction("Moved transition waypoint", updateProjectEdgeWaypoints(currentProject, edgeId, waypoints, scope));
  }, [activeScope, commitCanvasAction]);

  const removeTransitionWaypoint = useCallback((edgeId: string, index: number) => {
    if (!edgeId.startsWith("edge:transition:")) return;
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const scope = activeScope ?? activeCanvasScope(currentProject);
    const waypoints = [...projectEdgeWaypoints(currentProject, edgeId, scope)];
    if (index < 0 || index >= waypoints.length) return;
    waypoints.splice(index, 1);
    commitCanvasAction("Removed transition waypoint", updateProjectEdgeWaypoints(currentProject, edgeId, waypoints, scope));
  }, [activeScope, commitCanvasAction]);

  const updateProject = useCallback(
    (nextProject: BranchingProject, nextSelection?: Selection) => {
      commitCanvasAction("Canvas updated", nextProject, nextSelection);
    },
    [commitCanvasAction],
  );

  const runCanvasMutation = useCallback(
    (result: mutations.MutationResult, label = "Canvas updated") => {
      commitCanvasAction(label, result);
    },
    [commitCanvasAction],
  );

  const changeAuxiliaryPanel = useCallback(
    (nodeId: string, panel: "directorNote" | "sceneImage" | "coverImage" | "description", open: boolean) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      commitCanvasAction(
        open ? "Expanded beat panel" : "Collapsed beat panel",
        updateCanvasNodeAuxiliaryPanel(currentProject, nodeId, panel, open, activeScope ?? activeCanvasScope(currentProject)),
      );
    },
    [activeScope, commitCanvasAction],
  );

  const updateManualInspectorDraft = useCallback(
    (
      selection: ManualInspectorDraft["selection"],
      update: (project: BranchingProject) => BranchingProject,
      integrationMappingIds: string[] = [],
    ) => {
      const key = manualInspectorDraftKey(selection);
      if (!key) return;
      setManualInspectorDrafts((current) => {
        const latest = projectRef.current;
        if (!latest) return current;
        const base = current[key]?.dirty ? mergeManualInspectorDraft(latest, current[key]) : latest;
        const draft = {
          selection,
          project: update(base),
          dirty: true,
          integrationMappingIds: [...new Set([...(current[key]?.integrationMappingIds ?? []), ...integrationMappingIds])],
        };
        setAuthoringDraft(authoringDraftKey(base.projectId, key, "inspector"), JSON.stringify(draft));
        return {
          ...current,
          [key]: draft,
        };
      });
    },
    [],
  );

  const saveManualInspectorDraft = useCallback(
    async (key: string) => {
      const draft = manualInspectorDrafts[key];
      const currentProject = projectRef.current;
      if (!draft?.dirty || !currentProject) return false;
      const saved = await commitStructuralAction(
        "Saved inspector changes",
        mergeManualInspectorDraft(currentProject, draft),
      );
      if (saved) {
        setAuthoringDraft(authoringDraftKey(currentProject.projectId, key, "inspector"), undefined);
        setManualInspectorDrafts((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
      return saved;
    },
    [commitStructuralAction, manualInspectorDrafts],
  );

  const saveActiveManualInspectorDraft = useCallback(async () => {
    const key = manualInspectorDraftKey(selectionRef.current);
    return key ? saveManualInspectorDraft(key) : false;
  }, [saveManualInspectorDraft]);

  const createCanonWorkingCopy = useCallback(
    async (ref: CanonRef) => {
      const currentProject = projectRef.current;
      const universePath = fileStateRef.current.universePath;
      if (!currentProject || !universePath) {
        setMessage("Open a universe before creating a working copy.");
        return;
      }
      if (
        currentProject.canonWorkingCopies?.some(
          (copy) => copy.canonRefId === ref.id,
        )
      ) {
        setMessage("This Canon entity already has a manual working copy.");
        return;
      }
      const source = workspaceRef.current?.canonIndex.entities.find(
        (entity) => entity.id === ref.id,
      );
      const legacyFile = ref.workingCopyPath
        ? workspaceRef.current?.files.find(
            (file) => file.relativePath === ref.workingCopyPath,
          )
        : undefined;
      const now = new Date().toISOString();
      const content = source?.content ?? canonMarkdownDraft(ref);
      const workingCopy: CanonWorkingCopy = {
        canonRefId: ref.id,
        sourcePath: ref.canonSourcePath ?? source?.path ?? ref.id,
        sourceModifiedMs: ref.canonSourceModifiedMs ?? source?.modifiedMs,
        sourceContent: content,
        draftContent: legacyFile?.content ?? content,
        path: workingCopyPathForCanonRef(ref.id),
        createdAt: now,
        updatedAt: now,
        legacy: Boolean(legacyFile) || !source,
      };
      try {
        if (!legacyFile) {
          const result = await saveWorkingCopy(universePath, ref.id, content);
          if (!result.ok)
            throw new Error(
              result.message ?? "Could not create the working copy.",
            );
        }
        await commitStructuralAction("Created Canon working copy", {
          project: {
            ...currentProject,
            canonRefs: currentProject.canonRefs.map((item) =>
              item.id === ref.id
                ? { ...item, workingCopyPath: workingCopy.path }
                : item,
            ),
            canonWorkingCopies: [
              ...(currentProject.canonWorkingCopies ?? []),
              workingCopy,
            ],
          },
        });
        setMessage(`Created a manual snapshot for ${ref.label ?? ref.id}.`);
      } catch (copyError) {
        setError(
          copyError instanceof Error ? copyError.message : String(copyError),
        );
      }
    },
    [commitStructuralAction],
  );

  const saveCanonWorkingCopy = useCallback(
    async (canonRefId: string, content: string) => {
      const currentProject = projectRef.current;
      const universePath = fileStateRef.current.universePath;
      const copy = currentProject?.canonWorkingCopies?.find(
        (candidate) => candidate.canonRefId === canonRefId,
      );
      if (!currentProject || !universePath || !copy) return;
      try {
        const result = await saveWorkingCopy(universePath, canonRefId, content);
        if (!result.ok)
          throw new Error(result.message ?? "Could not save the working copy.");
        const now = new Date().toISOString();
        await commitStructuralAction("Saved Canon working copy", {
          project: {
            ...currentProject,
            canonWorkingCopies: (currentProject.canonWorkingCopies ?? []).map(
              (candidate) =>
                candidate.canonRefId === canonRefId
                  ? { ...candidate, draftContent: content, updatedAt: now }
                  : candidate,
            ),
          },
        });
        setMessage("Saved working copy.");
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : String(saveError),
        );
      }
    },
    [commitStructuralAction],
  );

  const exportCanonChangeSet = useCallback(
    async (canonRefId: string) => {
      const currentProject = projectRef.current;
      const universePath = fileStateRef.current.universePath;
      const copy = currentProject?.canonWorkingCopies?.find(
        (candidate) => candidate.canonRefId === canonRefId,
      );
      if (!currentProject || !universePath || !copy) return;
      const changeSet = createCanonChangeSet(copy);
      try {
        const result = await saveUniverseTextFile(
          universePath,
          changeSetPath(changeSet.id),
          `${JSON.stringify(changeSet, null, 2)}\n`,
        );
        if (!result.ok)
          throw new Error(
            result.message ?? "Could not export the change proposal.",
          );
        await commitStructuralAction("Exported Canon change set", {
          project: {
            ...currentProject,
            canonChangeSets: [
              ...(currentProject.canonChangeSets ?? []),
              changeSet,
            ],
          },
        });
        setMessage("Exported a reviewable Canon change proposal.");
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : String(exportError),
        );
      }
    },
    [commitStructuralAction],
  );

  const applyCanonWorkingCopy = useCallback(
    async (canonRefId: string) => {
      const currentProject = projectRef.current;
      const universePath = fileStateRef.current.universePath;
      const copy = currentProject?.canonWorkingCopies?.find(
        (candidate) => candidate.canonRefId === canonRefId,
      );
      if (!currentProject || !universePath || !copy) return;
      if (
        !window.confirm(
          `Apply this working copy to ${copy.sourcePath}? A conflict check will run first.`,
        )
      )
        return;
      const changeSet = createCanonChangeSet(copy);
      try {
        const result = await saveUniverseTextFile(
          universePath,
          copy.sourcePath,
          copy.draftContent,
          copy.sourceModifiedMs,
        );
        if (!result.ok) {
          const conflicted = {
            ...changeSet,
            status: "conflicted" as const,
            updatedAt: new Date().toISOString(),
          };
          await saveUniverseTextFile(
            universePath,
            changeSetPath(conflicted.id),
            `${JSON.stringify(conflicted, null, 2)}\n`,
          );
          await commitStructuralAction("Recorded Canon conflict", {
            project: {
              ...currentProject,
              canonChangeSets: [
                ...(currentProject.canonChangeSets ?? []),
                conflicted,
              ],
            },
          });
          setMessage(
            result.message ??
              "Canon changed on disk; exported a conflicted proposal instead.",
          );
          return;
        }
        const appliedAt = new Date().toISOString();
        const applied = {
          ...changeSet,
          status: "applied" as const,
          appliedAt,
          appliedBy: "pathbranching",
          updatedAt: appliedAt,
        };
        await saveUniverseTextFile(
          universePath,
          changeSetPath(applied.id),
          `${JSON.stringify(applied, null, 2)}\n`,
        );
        await commitStructuralAction("Applied Canon working copy", {
          project: {
            ...currentProject,
            canonChangeSets: [
              ...(currentProject.canonChangeSets ?? []),
              applied,
            ],
            canonWorkingCopies: (currentProject.canonWorkingCopies ?? []).map(
              (candidate) =>
                candidate.canonRefId === canonRefId
                  ? {
                      ...candidate,
                      sourceContent: copy.draftContent,
                      draftContent: copy.draftContent,
                      sourceModifiedMs: result.modifiedMs,
                      updatedAt: appliedAt,
                    }
                  : candidate,
            ),
          },
        });
        setMessage("Applied working copy and recorded the change set.");
      } catch (applyError) {
        setError(
          applyError instanceof Error ? applyError.message : String(applyError),
        );
      }
    },
    [commitStructuralAction],
  );

  const updateLocalExplorerEntity = useCallback(
    (id: string, updates: Partial<LocalExplorerEntity>) => {
      updateManualInspectorDraft({ type: "explorerEntity", id }, (project) => ({
        ...project,
        localExplorerEntities: (project.localExplorerEntities ?? []).map(
          (entity) =>
            entity.id === id
              ? { ...entity, ...updates, updatedAt: new Date().toISOString() }
              : entity,
        ),
      }));
    },
    [updateManualInspectorDraft],
  );

  const createExplorerEntity = useCallback(
    (type: string, name = "New Entity") => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      
      // If type is an entity-type property, use its label as the name
      let entityName = name;
      const entityTypeProperty = (currentProject.localExplorerProperties ?? []).find(
        (prop) => prop.valueType === "entity-type" && (prop.id === type || prop.id.slice(5) === type || prop.id === `type:${type}`)
      );
      if (entityTypeProperty && name === "New Entity") {
        entityName = entityTypeProperty.label;
      }
      
      const base = createLocalExplorerEntity(type, entityName);
      const existingIds = new Set([
        ...(currentProject.localExplorerEntities ?? []).map(
          (entity) => entity.id,
        ),
        ...currentProject.canonRefs.map((ref) => ref.id),
      ]);
      const entity = existingIds.has(base.id)
        ? { ...base, id: `${base.id}-${existingIds.size + 1}` }
        : base;
      void commitStructuralAction("Created local Explorer entity", {
        project: {
          ...currentProject,
          localExplorerEntities: [
            ...(currentProject.localExplorerEntities ?? []),
            entity,
          ],
        },
        selection: { type: "explorerEntity", id: entity.id },
      });
    },
    [commitStructuralAction],
  );

  const requestDeleteLocalExplorerEntity = useCallback(
    (id: string) => {
      const currentProject = projectRef.current;
      const entity = currentProject?.localExplorerEntities?.find(
        (candidate) => candidate.id === id,
      );
      if (!currentProject || !entity) return;
      const usages = entityUsages(currentProject, id);
      const isSpanish = uiLocaleRef.current === "es";
      const useList = usages.slice(0, 4).map(usage => usage.path).join(", ");
      const remainingCount = usages.length - Math.min(usages.length, 4);
      setConfirmDialog({
        kind: "deleteLocalExplorerEntity",
        entityId: id,
        title: isSpanish ? "Eliminar entidad local" : "Delete local entity",
        message: usages.length
          ? isSpanish
            ? `¿Eliminar “${entity.name}” y quitar sus ${usages.length} referencias guardadas? ${useList}${remainingCount > 0 ? ` y ${remainingCount} más` : ""}.`
            : `Delete “${entity.name}” and remove its ${usages.length} saved reference${usages.length === 1 ? "" : "s"}? ${useList}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}.`
          : isSpanish
            ? `¿Eliminar “${entity.name}” de este proyecto?`
            : `Delete “${entity.name}” from this project?`,
      });
    },
    [],
  );

  const deleteLocalExplorerEntity = useCallback(
    async (id: string) => {
      const currentProject = projectRef.current;
      const entity = currentProject?.localExplorerEntities?.find(
        (candidate) => candidate.id === id,
      );
      if (!currentProject || !entity) return;
      const cleanedProject = removeLocalExplorerEntityReferences(currentProject, id);
      const remainingUsages = entityUsages(cleanedProject, id);
      if (remainingUsages.length) {
        const es = uiLocaleRef.current === "es";
        setError(`${es ? "No se pudieron quitar todas las referencias antes de eliminar esta entidad" : "Some references could not be removed before deleting this entity"}: ${remainingUsages.map(usage => usage.path).join(", ")}`);
        openInspectorRef.current({type:"explorerEntity",id},"uses");
        return;
      }
      const draftKey = manualInspectorDraftKey({ type: "explorerEntity", id });
      if (draftKey) {
        setManualInspectorDrafts((current) => {
          const next = { ...current };
          delete next[draftKey];
          return next;
        });
      }
      await commitStructuralAction("Deleted local Explorer entity", {
        project: cleanedProject,
      });
      setSelection(undefined);
    },
    [commitStructuralAction, setSelection],
  );

  const createExplorerType = useCallback(() => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    // Create entity-type property instead of separate localExplorerType
    const property = createLocalExplorerProperty("New entity type", "entity-type");
    void commitStructuralAction("Created local entity type", {
      project: {
        ...currentProject,
        localExplorerProperties: [
          ...(currentProject.localExplorerProperties ?? []),
          property,
        ],
      },
      selection: { type: "explorerProperty", id: property.id, source: "local" },
    });
  }, [commitStructuralAction]);

  const createExplorerProperty = useCallback((label = "New local property", valueType: LocalExplorerProperty["valueType"] = "text", options?: {
    description?: string;
    required?: boolean;
    options?: ExplorerPropertyOption[];
    targetTypes?: string[];
    appliesToTypes?: string[];
    icon?: string;
    color?: string;
    suggestedFolder?: string;
  }, parentPropertyId?: string) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const property = createLocalExplorerProperty(label, valueType, options);
    const localExplorerProperties = appendLocalExplorerPropertyToTree(
      currentProject.localExplorerProperties,
      property,
      parentPropertyId,
    );
    if (!localExplorerProperties) return;
    void commitStructuralAction("Created local Explorer property", {
      project: {
        ...currentProject,
        localExplorerProperties,
      },
      selection: {
        type: "explorerProperty",
        id: property.id,
        source: "local",
      },
    });
  }, [commitStructuralAction]);

  const initializePropertiesFromTemplate = useCallback(async () => {
    const universePath = fileStateRef.current.universePath;
    if (!universePath) {
      console.warn("No active workspace to initialize properties");
      return;
    }
    try {
      const { initializePropertiesFile, openUniversePath } = await import("./projectPersistence.js");
      const result = await initializePropertiesFile(universePath);
      if (result.ok) {
        // Reload the workspace to pick up the new properties
        console.log("Properties file created successfully. Reloading workspace...");
        // Trigger a workspace reload by re-indexing using openUniversePath
        const reloadedWorkspaceData = await openUniversePath(universePath);
        if (reloadedWorkspaceData?.workspace) {
          applyWorkspace(reloadedWorkspaceData.workspace, reloadedWorkspaceData.path);
        }
      } else {
        console.error("Failed to create properties file:", result.message);
      }
    } catch (error) {
      console.error("Error initializing properties:", error);
    }
  }, [applyWorkspace]);

  const updateLocalExplorerType = useCallback(
    (id: string, updates: Partial<LocalExplorerType>) => {
      updateManualInspectorDraft(
        { type: "explorerType", id, source: "local" },
        (project) => ({
          ...project,
          localExplorerTypes: (project.localExplorerTypes ?? []).map((type) =>
            type.id === id
              ? { ...type, ...updates, updatedAt: new Date().toISOString() }
              : type,
          ),
        }),
      );
    },
    [updateManualInspectorDraft],
  );

  const updateLocalExplorerProperty = useCallback(
    (id: string, updates: Partial<LocalExplorerProperty>) => {
      updateManualInspectorDraft(
        { type: "explorerProperty", id, source: "local" },
        (project) => ({
          ...project,
          localExplorerProperties: updateLocalExplorerPropertyInTree(
            project.localExplorerProperties,
            id,
            updates,
            new Date().toISOString(),
          ),
        }),
      );
    },
    [updateManualInspectorDraft],
  );

  const deleteLocalExplorerProperty = useCallback(
    (id: string): boolean => {
      const currentProject = projectRef.current;
      if (!currentProject) return false;
      const property = findLocalExplorerPropertyInTree(currentProject.localExplorerProperties, id);
      if (!property) return false;
      const deletedPropertyIds = flattenLocalExplorerPropertyTree([property]).map(item => item.id);
      const usages = deletedPropertyIds.flatMap(propertyId => entityUsages(currentProject, propertyId));
      const cleanedProject = deletedPropertyIds.reduce(
        (current, propertyId) => removeLocalExplorerPropertyValues(current, propertyId),
        currentProject,
      );
      const remainingUsages = deletedPropertyIds.flatMap(propertyId => entityUsages(cleanedProject, propertyId));
      if (remainingUsages.length) {
        const es = uiLocaleRef.current === "es";
        const paths = remainingUsages.slice(0, 3).map(usage => usage.path).join(", ");
        setError(es
          ? `No se pudo eliminar “${property.label}”: aún tiene ${remainingUsages.length} referencias (${paths}${remainingUsages.length > 3 ? ", …" : ""}).`
          : `Could not delete “${property.label}”: ${remainingUsages.length} references remain (${paths}${remainingUsages.length > 3 ? ", …" : ""}).`);
        return false;
      }
      if (usages.length) {
        const es = uiLocaleRef.current === "es";
        const message = es
          ? `“${property.label}” tiene ${usages.length} usos guardados. Si continúas, se quitarán esos valores y ajustes y se eliminará la propiedad. ¿Continuar?`
          : `“${property.label}” has ${usages.length} saved uses. Continuing removes those values and settings, then deletes the property. Continue?`;
        if (!window.confirm(message)) return false;
      }
      const removed = removeLocalExplorerPropertyFromTree(
        cleanedProject.localExplorerProperties,
        id,
      );
      if (!removed) return false;
      void commitStructuralAction("Deleted local Explorer property", {
        project: {
          ...cleanedProject,
          localExplorerProperties: removed.properties,
        },
      });
      return true;
    },
    [commitStructuralAction],
  );

  const publishLocalExplorerEntity = useCallback(
    async (id: string) => {
      const draftKey = manualInspectorDraftKey({ type: "explorerEntity", id });
      if (draftKey && manualInspectorDrafts[draftKey]?.dirty) {
        const saved = await saveManualInspectorDraft(draftKey);
        if (!saved) return;
      }
      const currentProject = projectRef.current;
      const currentWorkspace = workspaceRef.current;
      const universePath = fileStateRef.current.universePath;
      const entity = currentProject?.localExplorerEntities?.find(
        (candidate) => candidate.id === id,
      );
      if (!currentProject || !currentWorkspace || !universePath || !entity)
        return;
      const localType = currentProject.localExplorerTypes?.find(
        (type) => type.id === entity.type,
      );
      const canonType = canonExplorerTypes(
        currentWorkspace.canonIndex.propertiesConfig,
      ).find((type) => type.id === entity.type);
      const path =
        entity.publishedPath ??
        localEntityPath(
          entity,
          localType?.suggestedFolder ?? canonType?.suggestedFolder,
        );
      if (
        currentWorkspace.files.some((file) => file.relativePath === path) ||
        currentWorkspace.canonIndex.entities.some(
          (item) => item.id === entity.id,
        )
      ) {
        setMessage(
          "Publication blocked: the target path or stable ID already exists in WorldNotion.",
        );
        return;
      }
      try {
        const content = serializeLocalExplorerEntity(entity);
        const result = await saveUniverseTextFile(universePath, path, content);
        if (!result.ok)
          throw new Error(result.message ?? "Could not publish the entity.");
        await commitStructuralAction("Published local Explorer entity", {
          project: {
            ...currentProject,
            localExplorerEntities: (
              currentProject.localExplorerEntities ?? []
            ).map((candidate) =>
              candidate.id === id
                ? {
                    ...candidate,
                    publishedPath: path,
                    publishedAt: new Date().toISOString(),
                    exportedPath: path,
                  }
                : candidate,
            ),
          },
        });
        setMessage(
          `Published ${entity.name} in ${path}. Reload the universe to see it as Canon.`,
        );
      } catch (publishError) {
        setError(
          publishError instanceof Error
            ? publishError.message
            : String(publishError),
        );
      }
    },
    [commitStructuralAction, manualInspectorDrafts, saveManualInspectorDraft],
  );

  const editCanonRefInBranch = useCallback((ref: CanonRef) => {
    const tabId = `canon:${ref.id}`;
    setMarkdownTabs((current) => {
      if (current.some((tab) => tab.id === tabId)) {
        return current;
      }
      return [
        ...current,
        {
          id: tabId,
          canonRefId: ref.id,
          title: ref.label ?? ref.id,
          sourcePath: ref.canonSourcePath,
          workingCopyPath: ref.workingCopyPath,
          format: "markdown" as const,
          content: canonMarkdownDraft(ref),
          dirty: false,
        },
      ].slice(-5);
    });
    setActiveMarkdownTabId(tabId);
  }, []);

  const changeMarkdownContent = useCallback((id: string, content: string) => {
    setMarkdownTabs((current) =>
      current.map((tab) =>
        tab.id === id ? { ...tab, content, dirty: true } : tab,
      ),
    );
  }, []);

  const changeMarkdownFormat = useCallback(
    (id: string, format: MarkdownDraftFormat) => {
      setMarkdownTabs((current) =>
        current.map((tab) => {
          if (tab.id !== id) return tab;
          const ref = project?.canonRefs.find(
            (canonRef) => canonRef.id === tab.canonRefId,
          );
          if (!ref) return { ...tab, format };
          const template = markdownFormatTemplate(format, ref);
          return {
            ...tab,
            format,
            content: tab.dirty
              ? `${tab.content.trimEnd()}\n\n---\n\n${template}`
              : template,
            dirty: true,
          };
        }),
      );
    },
    [project],
  );

  const closeMarkdownTab = useCallback((id: string) => {
    setMarkdownTabs((current) => {
      const nextTabs = current.filter((tab) => tab.id !== id);
      setActiveMarkdownTabId((activeId) => {
        if (activeId !== id) return activeId;
        return nextTabs[nextTabs.length - 1]?.id;
      });
      return nextTabs;
    });
  }, []);

  const saveMarkdownTab = useCallback(
    async (id: string) => {
      const tab = markdownTabs.find((item) => item.id === id);
      if (!tab || !fileState.universePath) {
        setMessage("Open a universe before saving a Markdown working copy.");
        return;
      }

      setMarkdownTabs((current) =>
        current.map((item) =>
          item.id === id ? { ...item, saving: true } : item,
        ),
      );
      try {
        const result = await saveWorkingCopy(
          fileState.universePath,
          tab.canonRefId,
          tab.content,
          tab.modifiedMs,
        );
        if (!result.ok) {
          throw new Error(
            result.message ?? "Could not save Markdown working copy.",
          );
        }
        const workingCopyPath = workingCopyPathForCanonRef(tab.canonRefId);
        setMarkdownTabs((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  workingCopyPath,
                  dirty: false,
                  saving: false,
                  lastSavedAt: Date.now(),
                  modifiedMs: result.modifiedMs,
                }
              : item,
          ),
        );
        if (projectRef.current) {
          await commitStructuralAction("Linked Markdown working copy", {
            project: {
              ...projectRef.current,
              canonRefs: projectRef.current.canonRefs.map((ref) =>
                ref.id === tab.canonRefId ? { ...ref, workingCopyPath } : ref,
              ),
            },
            message: `Saved working copy: ${workingCopyPath}.`,
          });
        }
        setMessage(`Saved working copy: ${workingCopyPath}.`);
      } catch (saveError) {
        setMarkdownTabs((current) =>
          current.map((item) =>
            item.id === id ? { ...item, saving: false } : item,
          ),
        );
        setMessage(
          saveError instanceof Error ? saveError.message : String(saveError),
        );
      }
    },
    [commitStructuralAction, fileState.universePath, markdownTabs],
  );

  const confirmDiscardChanges = useCallback(async () => {
    return guardUniverseSwitch({
      state: () => ({ hasDrafts: switchDraftsRef.current || Boolean(projectRef.current && authoringDraftEntries(projectRef.current.projectId).length), saveBlocked: Boolean(workspaceRef.current?.saveBlocked), hasPendingSave: fileStateRef.current.dirty }),
      flush: async () => { if (fileStateRef.current.dirty) await persistProjectRef.current?.(); else await saveQueueRef.current; },
      report: (reason, failure) => setError(reason === 'drafts'
        ? uiLocaleRef.current === 'es' ? 'Resuelve el borrador de Conversación, el inspector o las pestañas de texto antes de cambiar de documento.' : 'Resolve pending Conversation, inspector or text-tab drafts before changing documents.'
        : failure instanceof Error ? failure.message : reason === 'blocked' ? 'Saving is blocked. Review the loading issues.' : 'Changes are still pending. Wait for saving to finish.'),
    });
  }, []);

  const setActiveSequence = useCallback(
    async (sequenceId: string) => {
      if (!project) {
        return;
      }
      if (!(await confirmDiscardChanges())) {
        return;
      }
      setEventDraft(undefined);
      updateProject(
        {
          ...project,
          canvas: {
            ...project.canvas,
            activeSequenceId: sequenceId,
            activeScope: { kind: "sequence", id: sequenceId },
          },
        },
        { type: "node", id: sequenceId },
      );
      setCanvasMode("branching");
      setFocusNodeId(undefined);
    },
    [confirmDiscardChanges, project, updateProject],
  );

  const setActiveStory = useCallback(
    async (storyId: string) => {
      if (
        !storyId ||
        !fileStateRef.current.universePath ||
        workspaceRef.current?.activeStory?.id === storyId
      ) {
        return;
      }
      if (!(await confirmDiscardChanges())) {
        return;
      }
      try {
        const opened = await openUniverseStory(
          fileStateRef.current.universePath,
          storyId,
        );
        applyWorkspace(opened.workspace, opened.path);
        if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
        setSettings((current) => ({
          ...rememberRecentProject(current, opened.path),
          worldnotionBridge: {
            ...current.worldnotionBridge,
            connected: true,
            lastCheckedAt: Date.now(),
            lastStatus: "ok",
            lastMessage:
              "WorldNotion bridge connected through the active story.",
          },
        }));
        setView("workspace");
        setError(undefined);
        setMessage(
          workspaceLoadWarningMessage(opened.workspace) ??
            `Opened story ${opened.workspace.activeStory?.name ?? storyId}.`,
        );
      } catch (openError) {
        setError(
          openError instanceof Error ? openError.message : String(openError),
        );
      }
    },
    [applyWorkspace, confirmDiscardChanges],
  );

  useEffect(() => {
    let disposed = false;
    let readyTimer: number | undefined;
    const startupStartedAt = Date.now();
    const finishInitialLoading = () => {
      const remaining = suiteChrome
        ? 0
        : Math.max(
            0,
            STARTUP_LOADER_MIN_MS - (Date.now() - startupStartedAt),
          );
      readyTimer = window.setTimeout(() => {
        if (!disposed) setInitialLoading(false);
      }, remaining);
    };

    async function loadInitialProject() {
      if (settings.worldnotionBridge.connected && settings.lastOpenedProject) {
        try {
          const opened = await openUniversePath(settings.lastOpenedProject);
          if (disposed) {
            return;
          }
          applyWorkspace(opened.workspace, opened.path);
          if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
          setSettings((current) => ({
            ...rememberRecentProject(current, opened.path),
            worldnotionBridge: {
              ...current.worldnotionBridge,
              connected: true,
              lastCheckedAt: Date.now(),
              lastStatus: "ok",
              lastMessage:
                "WorldNotion bridge connected through the last universe.",
            },
          }));
          setView("workspace");
          finishInitialLoading();
          return;
        } catch {
          setMissingRecentProjects((current) =>
            new Set(current).add(settings.lastOpenedProject as string),
          );
        }
      }
      setProject(undefined);
      setWorkspace(undefined);
      setFileState({ dirty: false });
      setView("home");
      finishInitialLoading();
    }
    void loadInitialProject();
    return () => {
      disposed = true;
      if (readyTimer !== undefined) window.clearTimeout(readyTimer);
    };
    // Initial load only. The settings object is persisted separately after startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    if (!suiteChrome) document.documentElement.dataset.theme = settings.theme;
    document.querySelector<HTMLElement>(".pathbranching-app")?.setAttribute("data-theme", suiteChrome?.suiteSettings?.style ?? settings.theme);
    document.querySelector<HTMLElement>(".pathbranching-app")?.setAttribute("data-ambient-background", String(suiteChrome?.suiteSettings?.ambientBackground ?? settings.ambientBackground !== false));
    document.querySelector<HTMLElement>(".pathbranching-app")?.setAttribute("data-background-scene", normalizeBackgroundScene(suiteChrome?.suiteSettings?.backgroundScene ?? settings.backgroundScene));
    const fontRoot = document.querySelector<HTMLElement>(".pathbranching-app");
    if (fontRoot) { if (suiteChrome?.suiteSettings) fontRoot.style.removeProperty("--ef-primary-font"); else fontRoot.style.setProperty("--ef-primary-font", ({sans:"Inter, system-ui, sans-serif",serif:"Georgia, serif",humanist:"Atkinson Hyperlegible, Trebuchet MS, sans-serif"}[settings.interfaceFont ?? "sans"])); }
    saveSettings({ ...settings, lastView: view });
  }, [settings, suiteChrome?.suiteSettings?.style, suiteChrome?.suiteSettings?.ambientBackground, suiteChrome?.suiteSettings?.backgroundScene, view]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const scope = activeCanvasScope(currentProject);
    const model = buildStoryCanvasModel(currentProject, {
      nodeColors: settings.nodeColors,
      scope,
      gridSize: settings.canvasBackground.gridSize,
      authoringDisplay: settings.authoringDisplay,
      canvasLayerMode,
      interfaceLocale: uiLocale,
    });
    setActiveScopeState(scope);
    // Layer changes are a single graph replacement. Interpolating nodes while
    // installing the new edges leaves React Flow with stale gate-handle bounds.
    nodesRef.current = model.nodes;
    setNodes(model.nodes);
    setEdges(model.edges);
    setFiles(model.files);
  }, [canvasLayerMode, settings.authoringDisplay, settings.nodeColors, uiLocale]);

  const changeTheme = useCallback((theme: ThemeId) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  useEffect(() => {
    if (!fileState.universePath || initialLoading) return;
    const session: PathBranchingWorkspaceSession = {
      explorerTab, contextPresentation: "floating", contextTab, contextFocus,
      view,
      selection,
      canonOpen,
      filesOpen,
      canonWidth,
      storiesWidth,
      exportOpen,
      dataOpen,
      eventInspectorOpen: eventInspector.open,
      eventInspectorOpenEventIds: eventInspector.openEventIds,
      eventInspectorExpandedEventId: eventInspector.expandedEventId,
      eventInspectorTabGroups,
      inspectorTabs,
      inspectorExpandedTabId: expandedInspectorTabId,
      inspectorStackOrder,
      inspectorMaximized,
      inspectorSections,
      inspectorSize,
      activeScope,
      canvasMode,
      canvasLayerMode,
      focusNodeId,
      markdownTabs: storableMarkdownTabs(markdownTabs),
      activeMarkdownTabId,
      storyOutlineTab,
      panelVisibility,
      panelCollapsed,
    };
    setSettings((current) => {
      const currentSession =
        current.workspaceSessions?.[fileState.universePath as string];
      if (JSON.stringify(currentSession ?? {}) === JSON.stringify(session)) {
        return current;
      }
      return {
        ...current,
        workspaceSessions: {
          ...(current.workspaceSessions ?? {}),
          [fileState.universePath as string]: session,
        },
      };
    });
  }, [
    explorerTab, contextTab, contextFocus,
    activeMarkdownTabId,
    activeScope,
    canonOpen,
    canonWidth,
    canvasMode,
    inspectorSections,
    inspectorSize,
    inspectorStackOrder,
    inspectorTabs,
    expandedInspectorTabId,
    inspectorMaximized,
    canvasLayerMode,
    dataOpen,
    eventInspector,
    eventInspectorTabGroups,
    exportOpen,
    fileState.universePath,
    filesOpen,
    focusNodeId,
    initialLoading,
    markdownTabs,
    panelCollapsed,
    panelVisibility,
    selection,
    storyOutlineTab,
    storiesWidth,
    view,
  ]);

  const toggleTheme = useCallback(() => {
    if (suiteChrome?.suiteSettings) {
      suiteChrome.suiteSettings.onToggleStyleMode();
      return;
    }
    setSettings((current) => ({
      ...current,
      theme: toggledThemeMode(current.theme),
    }));
  }, [suiteChrome?.suiteSettings]);

  const changeThemeFamily = useCallback((family: ThemeFamily) => {
    setSettings((current) => ({
      ...current,
      theme: themeForFamilyAndMode(family, themeById(current.theme).mode),
    }));
  }, []);

  const changeCanvasBackground = useCallback(
    (updates: Partial<CanvasBackgroundSettings>) => {
      setSettings((current) => ({
        ...current,
        canvasBackground: normalizeCanvasBackgroundSettings({
          ...current.canvasBackground,
          ...updates,
        }),
      }));
    },
    [],
  );

  const changeCanvasLayerMode = useCallback((mode: CanvasLayerMode) => {
    if (mode === canvasLayerModeRef.current) return;
    canvasLayerModeRef.current = mode;
    setCanvasLayerMode(mode);
    setSettings((current) => {
      if (typeof current.authoringDisplay.logicMode !== "boolean") return current;
      const { logicMode: _legacyLogicMode, ...authoringDisplay } = current.authoringDisplay;
      return { ...current, authoringDisplay };
    });
  }, []);

  const changeInspectorTabCloseSelectsNext = useCallback((value: boolean) => {
    setSettings((current) => ({
      ...current,
      inspectorTabCloseSelectsNext: value,
    }));
  }, []);

  const changeCollapseInspectorTabOnCanvasClick = useCallback(
    (value: boolean) => {
      setSettings((current) => ({
        ...current,
        collapseInspectorTabOnCanvasClick: value,
      }));
    },
    [],
  );

  const changeInspectorDebugEnabled = useCallback((value: boolean) => {
    setSettings((current) => ({ ...current, inspectorDebugEnabled: value }));
  }, []);

  const changeShowStatusMessages = useCallback((value: boolean) => {
    setSettings((current) => ({ ...current, showStatusMessages: value }));
  }, []);

  const changeAuthoringDisplay = useCallback(
    (updates: Partial<AuthoringDisplaySettings>) => {
      setSettings((current) => ({
        ...current,
        authoringDisplay: normalizeAuthoringDisplaySettings({
          ...current.authoringDisplay,
          ...updates,
        }),
      }));
    },
    [],
  );

  const changeNodeColors = useCallback(
    (updates: Partial<NodeColorSettings>) => {
      setSettings((current) => ({
        ...current,
        nodeColors: normalizeNodeColorSettings({
          ...current.nodeColors,
          ...updates,
        }),
      }));
    },
    [],
  );

  const openProject = useCallback(async () => {
    if (!(await confirmDiscardChanges())) {
      return;
    }
    try {
      const opened = await openUniverseDialog();
      if (!opened) {
        return;
      }
      applyWorkspace(opened.workspace, opened.path);
      if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
      setSettings((current) => ({
        ...rememberRecentProject(current, opened.path),
        worldnotionBridge: {
          ...current.worldnotionBridge,
          connected: true,
          lastCheckedAt: Date.now(),
          lastStatus: "ok",
          lastMessage:
            "WorldNotion bridge connected through the selected universe folder.",
        },
      }));
      setView("workspace");
      setError(undefined);
      const loadWarning = workspaceLoadWarningMessage(opened.workspace);
      setMessage(
        loadWarning ??
          (opened.workspace.createdDefaultStory
            ? `Opened ${projectFileName(opened.path)}. Create a story to write Everend PathBranching metadata.`
            : `Opened ${projectFileName(opened.path)}.`),
      );
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : String(openError),
      );
    }
  }, [applyWorkspace, confirmDiscardChanges]);

  const openDemoProject = useCallback(async () => {
    if (!(await confirmDiscardChanges())) return;
    try {
      const opened = await openDemoUniverse();
      applyWorkspace(opened.workspace, opened.path);
      if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
      setSettings((current) => ({
        ...current,
        worldnotionBridge: {
          ...current.worldnotionBridge,
          connected: true,
          lastCheckedAt: Date.now(),
          lastStatus: "ok",
          lastMessage: "Loaded the writable browser demo universe in memory.",
        },
      }));
      setView("workspace");
      setError(undefined);
      setMessage("Opened the writable PathBranching browser demo. Changes last for this session only.");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : String(openError));
    }
  }, [applyWorkspace, confirmDiscardChanges]);

  useEffect(() => {
    const path = suiteChrome?.sharedUniversePath;
    const browserDirectory = suiteChrome?.sharedUniverseDirectory;
    if (!path) return;
    if (browserDirectory) registerSharedBrowserUniverse(path, browserDirectory);
    if (fileStateRef.current.universePath === path && !browserDirectory) return;

    let disposed = false;
    void openUniversePath(path)
      .then((opened) => {
        if (disposed) return;
        applyWorkspace(opened.workspace, opened.path);
        if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
        setSettings((current) => ({
          ...rememberRecentProject(current, opened.path),
          worldnotionBridge: {
            ...current.worldnotionBridge,
            connected: true,
            lastCheckedAt: Date.now(),
            lastStatus: "ok",
            lastMessage: "Loaded shared suite universe.",
          },
        }));
        setView("workspace");
        setError(undefined);
        setMessage(workspaceLoadWarningMessage(opened.workspace) ?? `Opened ${projectFileName(opened.path)}.`);
        suiteChrome?.onReady?.();
      })
      .catch((openError) => {
        if (!disposed) {
          setError(openError instanceof Error ? openError.message : String(openError));
          suiteChrome?.onReady?.();
        }
      });

    return () => {
      disposed = true;
    };
  }, [applyWorkspace, suiteChrome?.sharedUniverseDirectory, suiteChrome?.sharedUniversePath]);

  const revealUniverse = useCallback(async () => {
    const universePath = fileStateRef.current.universePath;
    if (!universePath) {
      setMessage("Open a universe before revealing its folder.");
      return;
    }
    try {
      const result = await revealUniverseFolder(universePath);
      if (!result.ok) {
        throw new Error(result.message ?? "Could not reveal universe folder.");
      }
      setMessage(
        `Opened ${projectFileName(universePath)} in the system file explorer.`,
      );
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : String(revealError),
      );
    }
  }, []);

  useEffect(() => {
    if (!suiteChrome?.settingsHost || !fileState.universePath) return;
    const root = fileState.universePath;
    const refresh = (event: Event) => { if ((event as CustomEvent<{path:string}>).detail?.path !== root) return;
      void readUniverseProfileSource(root).then(source => {
        if (fileStateRef.current.universePath !== root) return;
        const profile = source ? JSON.parse(source) as UniverseProfile : undefined;
        setFileState(current => { if (current.universePath !== root) return current; const next={...current,universeProfile:profile}; fileStateRef.current=next; return next; });
        setWorkspace(current => { if (!current || fileStateRef.current.universePath !== root) return current; const next={...current,universeProfile:profile}; workspaceRef.current=next; return next; });
      }).catch(error => console.warn("Could not refresh universe profile.",error));
    };
    window.addEventListener("everend-forge:profile-saved",refresh); return () => window.removeEventListener("everend-forge:profile-saved",refresh);
  }, [suiteChrome?.settingsHost !== undefined, fileState.universePath]);
  const saveUniverseProfile = useCallback(async (profile: UniverseProfile) => {
    const universePath = fileStateRef.current.universePath;
    if (!universePath) {
      throw new Error("Open a universe before saving its customization.");
    }
    if (suiteChrome?.sharedUniversePath && universePath.replace(/\\/g, "/") !== suiteChrome.sharedUniversePath.replace(/\\/g, "/")) throw new Error("The selected universe is still loading.");
    const primaryLocale = canonicalLocale(profile.localization?.primaryLocale ?? machineLocale());
    const locales = normalizeLocaleList(
      profile.localization?.primaryLocale ?? machineLocale(),
      profile.localization?.locales ?? [],
    );
    const patch = {
      name: profile.name?.trim() || undefined,
      icon: profile.icon,
      ...(JSON.stringify(profile.localization) !== JSON.stringify(fileStateRef.current.universeProfile?.localization) ? { localization: {
        primaryLocale,
        locales,
        localeNames: normalizeLocaleNames(profile.localization?.localeNames, locales),
      } } : {}),
    };
    const normalizedProfile = mergeUniverseProfile(await readUniverseProfileSource(universePath), patch) as UniverseProfile;
    const result = await saveUniverseTextFile(
      universePath,
      ".everend/universe.json",
      `${JSON.stringify(normalizedProfile, null, 2)}\n`,
    );
    if (!result.ok) {
      throw new Error(result.message ?? "Could not save universe profile.");
    }
    setFileState((current) => {
      const next = { ...current, universeProfile: normalizedProfile };
      fileStateRef.current = next;
      return next;
    });
    setWorkspace((current) => {
      if (!current) return current;
      const next = { ...current, universeProfile: normalizedProfile };
      workspaceRef.current = next;
      return next;
    });
    const currentProject = projectRef.current;
    if (currentProject) {
      updateProject(normalizeLocalizationCatalog(currentProject, normalizedProfile.localization!.primaryLocale));
    }
    setMessage("Universe customization saved.");
    suiteChrome?.settingsHost?.profileSaved(universePath);
  }, [updateProject, suiteChrome?.sharedUniversePath, suiteChrome?.settingsHost?.profileSaved]);

  const persistProject = useCallback((options: { manual?: boolean } = {}) => {
    const run = async () => {
      setSaveInProgress(true);
      setSaveError(undefined);
      try {
      const currentProject = projectRef.current;
      const currentWorkspace = workspaceRef.current;
      const currentFileState = fileStateRef.current;
      const saveRevision = projectRevisionRef.current;

      if (!currentProject) {
        return;
      }
      if (!currentWorkspace || !currentFileState.universePath) {
        throw new Error(
          "Open a universe before saving an Everend PathBranching story.",
        );
      }

      const snapshot = await saveBranchingDocument({
        project: currentProject,
        workspace: currentWorkspace,
        fileState: currentFileState,
        revision: saveRevision,
      });
      const isStillCurrentRevision =
        projectRevisionRef.current === saveRevision;
      const nextFileState: ProjectFileState = {
        ...snapshot.nextFileState,
        dirty: isStillCurrentRevision ? false : true,
      };
      fileStateRef.current = {
        ...nextFileState,
        dirty: isStillCurrentRevision ? false : true,
      };
      setFileState(fileStateRef.current);
      setSettings((current) =>
        rememberRecentProject(current, currentFileState.universePath as string),
      );
      const nextWorkspace = workspaceRef.current
          ? {
              ...snapshot.nextWorkspace,
              activeProject: isStillCurrentRevision
                ? snapshot.savedProject
                : (projectRef.current ?? workspaceRef.current.activeProject),
              createdDefaultStory: false,
            }
          : workspaceRef.current;
      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      if (isStillCurrentRevision) {
        savedRevisionRef.current = saveRevision;
        if (currentProject.storyId) clearAuthoringRecovery(currentFileState.universePath, currentProject.storyId);
        setPendingRecovery(undefined);
      }
      setError(undefined);
      if (options.manual) {
        if (isStillCurrentRevision) reportLearning("document-saved", currentProject.storyId ?? currentProject.projectId, currentFileState.universePath);
        setMessage(
          isStillCurrentRevision
            ? `Saved branching story in ${projectFileName(currentFileState.universePath)}.`
            : "Saved current snapshot. Newer changes are still pending.",
        );
      }
      if (!isStillCurrentRevision && isTauriRuntime()) {
        window.setTimeout(() => {
          if (fileStateRef.current.dirty) {
            void persistProject();
          }
        }, 0);
      }
      } catch (failure) {
        setSaveError(failure instanceof Error ? failure.message : String(failure));
        throw failure;
      } finally {
        setSaveInProgress(false);
      }
    };

    const queuedSave = saveQueueRef.current.catch(() => undefined).then(run);
    saveQueueRef.current = queuedSave;
    return queuedSave;
  }, []);

  useEffect(() => {
    persistProjectRef.current = persistProject;
  }, [persistProject]);

  useEffect(() => suiteChrome?.registerUniverseSwitchGuard?.(() => guardUniverseSwitch({
    state: () => ({ hasDrafts: switchDraftsRef.current || Boolean(projectRef.current && authoringDraftEntries(projectRef.current.projectId).length), saveBlocked: Boolean(workspaceRef.current?.saveBlocked), hasPendingSave: fileStateRef.current.dirty }),
    flush: async () => { if (fileStateRef.current.dirty) await persistProjectRef.current?.(); else await saveQueueRef.current; },
    report: (reason, failure) => {
      const es = uiLocaleRef.current === "es";
      const message = reason === "drafts" ? es ? "PathBranching: aplica o conserva los borradores pendientes en el inspector, el editor de texto o las pestañas Markdown antes de cambiar de universo." : "PathBranching: resolve pending drafts in the inspector, text editor or Markdown tabs before switching universe."
        : reason === "blocked" ? es ? "PathBranching: el guardado está bloqueado. Revisa las causas de carga antes de cambiar de universo." : "PathBranching: saving is blocked. Review the loading issues before switching universe."
        : reason === "pending" ? es ? "PathBranching: aún hay cambios pendientes. Espera a que finalice el guardado." : "PathBranching: changes are still pending. Wait for saving to finish."
        : `${es ? "PathBranching: no se pudo guardar." : "PathBranching: saving failed."} ${failure instanceof Error ? failure.message : String(failure)}`;
      setError(message);
      // Also visible when another mounted application owns the active screen.
      window.dispatchEvent(new CustomEvent("everend-forge:universe-switch-blocked", { detail: { app: "pathbranching", message } }));
    },
  })), [suiteChrome?.registerUniverseSwitchGuard]);

  useEffect(() => {
    if (!isTauriRuntime() || suiteChrome) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let closing = false;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      if (disposed) return;
      const nativeWindow = getCurrentWindow();
      unlisten = await nativeWindow.onCloseRequested(event => {
        if (closing) return;
        event.preventDefault();
        void (async () => {
          try {
            if (!(await confirmDiscardChanges())) return;
            closing = true;
            await nativeWindow.close();
          } catch (failure) {
            closing = false;
            setError(failure instanceof Error ? failure.message : String(failure));
          }
        })();
      });
      if (disposed) unlisten();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, [suiteChrome, confirmDiscardChanges]);

  const saveDocumentManually = useCallback(() => {
    void saveActiveManualInspectorDraft().then(async (saved) => {
      if (!saved) await persistProjectRef.current?.({ manual: true });
      else {
        const current = projectRef.current;
        if (current) reportLearning("document-saved", current.storyId ?? current.projectId, fileStateRef.current.universePath);
      }
    }).catch(() => undefined);
  }, [reportLearning, saveActiveManualInspectorDraft]);

  const openEventInspectorForEvent = useCallback((eventId: string) => {
    setExpandedInspectorTabId(undefined);
    setEventInspector((current) => openEventInspectorTab(current, eventId));
    setSelection({ type: "node", id: eventId });
  }, []);

  const collapseEventInspectorForEvent = useCallback((eventId: string) => {
    setEventInspector((current) => collapseEventInspectorTab(current, eventId));
    deselectCanvasNode(eventId);
    setSelection((current) => current?.type === "node" && current.id === eventId ? undefined : current);
  }, [deselectCanvasNode]);

  const pruneEventInspectorEvents = useCallback(
    (eventIds: readonly string[]) => {
      setEventInspector((current) => {
        const next = pruneEventInspectorState(current, eventIds);
        return current.open && inspectorTabs.length > 0 && !next.open
          ? { ...next, open: true }
          : next;
      });
      setEventInspectorTabGroups((current) =>
        pruneEventInspectorTabGroups(current, eventIds),
      );
    },
    [inspectorTabs.length],
  );

  const requestCloseEventInspectorForEvent = useCallback(
    (eventId: string) => {
      const next = closeEventInspectorTab(eventInspector, eventId, {
        selectNextOnClose: settings.inspectorTabCloseSelectsNext,
      });
      const closingActive = eventInspector.expandedEventId === eventId;
      setEventInspector({
        ...next,
        open: next.open || Boolean(expandedInspectorTabId),
      });
      deselectCanvasNode(eventId);
      if (closingActive) {
        setSelection((current) => current?.type === "node" && current.id === eventId ? undefined : current);
      }
      if (closingActive && next.expandedEventId) {
        setExpandedInspectorTabId(undefined);
        setSelection({ type: "node", id: next.expandedEventId });
      }
      if (
        settings.inspectorTabCloseSelectsNext &&
        closingActive &&
        !next.expandedEventId &&
        inspectorTabs.length > 0
      ) {
        setEventInspector({ ...next, open: true, expandedEventId: undefined });
        setExpandedInspectorTabId(inspectorTabs[0].id);
        setSelection(inspectorTabs[0].selection);
      }
    },
    [
      eventInspector,
      expandedInspectorTabId,
      inspectorTabs,
      settings.inspectorTabCloseSelectsNext,
      deselectCanvasNode,
    ],
  );

  const prepareClosedStoryPlay = useCallback(() => {
    if (!playDetachedPresentationRef.current && !playDetachingRef.current
      && inspectorTabs.some(tab => tab.id === expandedInspectorTabId && tab.selection.type === "storyPlay")) {
      playPreferredFullscreenRef.current = contextFocus;
    }
    playRestoreOnOpenRef.current = true;
    playDetachedPresentationRef.current = undefined;
    playDetachingRef.current = false;
  }, [contextFocus, expandedInspectorTabId, inspectorTabs]);

  const closeAllInspectorTabs = useCallback(() => {
    if (inspectorTabs.some(tab => tab.selection.type === "storyPlay")) {
      prepareClosedStoryPlay();
      stopStoryTestRef.current();
    }
    setEventInspector((current) => closeAllEventInspectorTabs(current));
    setInspectorTabs((current) => current.filter((tab) => tab.mode === "debug"));
    setExpandedInspectorTabId(undefined);
    setSelection(current => current?.type === "storyPlay" ? undefined : current);
  }, [inspectorTabs, prepareClosedStoryPlay]);

  const closeInspectorStackRange = useCallback(
    (target: InspectorStackTarget, direction: "above" | "below" | "others") => {
      const next = closeInspectorStackTabs(
        inspectorTabs,
        eventInspector.openEventIds,
        target,
        direction,
        inspectorStackOrder,
      );
      const nextInspectorIds = new Set(next.inspectorTabs.map(tab => tab.id));
      const nextEventIds = new Set(next.eventIds);
      const removedInspectorTabs = inspectorTabs.filter(tab => !nextInspectorIds.has(tab.id));
      const removedEventIds = eventInspector.openEventIds.filter(id => !nextEventIds.has(id));
      if (removedInspectorTabs.length === 0 && removedEventIds.length === 0) return;

      const removedInspectorIds = new Set(removedInspectorTabs.map(tab => tab.id));
      const activeInspectorRemoved = Boolean(expandedInspectorTabId && removedInspectorIds.has(expandedInspectorTabId));
      const activeEventRemoved = Boolean(eventInspector.expandedEventId && !nextEventIds.has(eventInspector.expandedEventId));
      const activeRemoved = activeInspectorRemoved || activeEventRemoved;
      const targetInspector = target.kind === "inspector"
        ? next.inspectorTabs.find(tab => tab.id === target.id)
        : undefined;
      const targetEventExists = target.kind === "event" && nextEventIds.has(target.id);

      if (removedInspectorTabs.some(tab => tab.selection.type === "storyPlay")) {
        prepareClosedStoryPlay();
        stopStoryTestRef.current();
      }
      removedInspectorTabs.forEach(tab => {
        if (tab.selection.type === "node") deselectCanvasNode(tab.selection.id);
      });
      removedEventIds.forEach(deselectCanvasNode);

      const nextExpandedInspectorTabId = activeRemoved
        ? targetInspector?.id
        : expandedInspectorTabId && nextInspectorIds.has(expandedInspectorTabId)
          ? expandedInspectorTabId
          : undefined;
      const nextExpandedEventId = activeRemoved
        ? targetEventExists ? target.id : undefined
        : eventInspector.expandedEventId && nextEventIds.has(eventInspector.expandedEventId)
          ? eventInspector.expandedEventId
          : undefined;

      setInspectorTabs(next.inspectorTabs);
      setEventInspector({
        ...eventInspector,
        open: activeRemoved ? true : eventInspector.open,
        openEventIds: next.eventIds,
        expandedEventId: nextExpandedEventId,
      });
      setExpandedInspectorTabId(nextExpandedInspectorTabId);
      setInspectorStackOrder(orderedInspectorStack([
        ...next.inspectorTabs.map(tab => ({ kind: "inspector" as const, id: tab.id })),
        ...next.eventIds.map(id => ({ kind: "event" as const, id })),
      ], inspectorStackOrder).map(inspectorStackKey));

      const removedSelectionKeys = new Set(removedInspectorTabs.map(tab => inspectorSelectionKey(tab.selection)));
      setSelection(current => {
        if (current && removedSelectionKeys.has(inspectorSelectionKey(current))) return undefined;
        if (activeEventRemoved && current?.type === "node" && current.id === eventInspector.expandedEventId) return undefined;
        return current;
      });
      if (activeRemoved) {
        if (targetInspector) setSelection(targetInspector.selection);
        else if (targetEventExists) setSelection({ type: "node", id: target.id });
      }
    },
    [deselectCanvasNode, eventInspector, expandedInspectorTabId, inspectorStackOrder, inspectorTabs, prepareClosedStoryPlay],
  );

  const closeInspectorTabsAbove = useCallback(
    (eventId: string) => closeInspectorStackRange({ kind: "event", id: eventId }, "above"),
    [closeInspectorStackRange],
  );

  const closeInspectorTabsBelow = useCallback(
    (eventId: string) => closeInspectorStackRange({ kind: "event", id: eventId }, "below"),
    [closeInspectorStackRange],
  );

  const closeOtherInspectorTabs = useCallback(
    (eventId: string) => closeInspectorStackRange({ kind: "event", id: eventId }, "others"),
    [closeInspectorStackRange],
  );

  const loadInspectorTabGroup = useCallback(
    (groupId: string) => {
      const group = eventInspectorTabGroups.find(
        (candidate) => candidate.id === groupId,
      );
      if (!group) {
        return;
      }
      const nextInspector = loadEventInspectorTabGroup(group);
      const nextInspectorTabs = group.inspectorTabs ?? [];
      if (inspectorTabs.some(tab => tab.selection.type === "storyPlay") && !nextInspectorTabs.some(tab => tab.selection.type === "storyPlay")) {
        prepareClosedStoryPlay();
        stopStoryTestRef.current();
      }
      const nextExpandedInspectorTabId =
        group.inspectorExpandedTabId &&
        nextInspectorTabs.some(
          (tab) => tab.id === group.inspectorExpandedTabId,
        )
          ? group.inspectorExpandedTabId
          : nextInspector.expandedEventId
            ? undefined
            : nextInspectorTabs[0]?.id;
      setEventInspector(
        nextExpandedInspectorTabId
          ? { ...nextInspector, open: true, expandedEventId: undefined }
          : nextInspector,
      );
      setInspectorTabs(nextInspectorTabs);
      setInspectorStackOrder(group.inspectorStackOrder ?? []);
      setExpandedInspectorTabId(nextExpandedInspectorTabId);
      setSelection(
        nextExpandedInspectorTabId
          ? nextInspectorTabs.find(
              (tab) => tab.id === nextExpandedInspectorTabId,
            )?.selection
          : nextInspector.expandedEventId
          ? { type: "node", id: nextInspector.expandedEventId }
          : undefined,
      );
    },
    [eventInspectorTabGroups, inspectorTabs, prepareClosedStoryPlay],
  );

  const requestLoadInspectorTabGroup = useCallback(
    (groupId: string) => {
      if (!eventInspectorTabGroups.some((group) => group.id === groupId)) {
        return;
      }
      loadInspectorTabGroup(groupId);
    },
    [eventInspectorTabGroups, loadInspectorTabGroup],
  );

  const requestSaveInspectorTabGroup = useCallback(() => {
    if (eventInspector.openEventIds.length === 0 && inspectorTabs.length === 0) {
      setMessage("Open inspector tabs before saving a group.");
      return;
    }
    setNameDialog({
      kind: "saveInspectorTabGroup",
      title: "Save Inspector Tab Group",
      label: "Group name",
      initialValue: `Inspector group ${eventInspectorTabGroups.length + 1}`,
    });
  }, [eventInspector.openEventIds.length, eventInspectorTabGroups.length, inspectorTabs.length]);

  const deleteInspectorTabGroup = useCallback((groupId: string) => {
    setEventInspectorTabGroups((current) =>
      deleteEventInspectorTabGroup(groupId, current),
    );
  }, []);

  const openInspector = useCallback((target: Selection, section?: string, focusId?: string) => {
    const current = projectRef.current;
    if (!current) return;
    const selectedOutcomeId = target.type === "node" && current.events.some(event => narrativeNodeReferences(current, event.id).some(item => item.id === target.id && item.kind === "outcome")) ? target.id : undefined;
    const selectedDecisionNode = target.type === "node" && current.events.some(event => narrativeNodeReferences(current, event.id).some(item => item.id === target.id && item.kind === "decision"));
    const resolved = canvasInspectorTarget(current, target, nodesRef.current);
    if (!resolved) return;
    target = resolved;
    const key = inspectorSelectionKey(target);
    if (target.type === "storyPlay") {
      const playTabKey = inspectorStackKey({ kind: "inspector", id: key });
      setInspectorStackOrder(order => [playTabKey, ...order.filter(item => item !== playTabKey)]);
    }
    const storyKey = current.storyId ?? current.projectId;
    const isEvent = target.type === "node" && current.events.some(event=>event.id===target.id);
    setSelection(target);
    setEventInspector(state=>({...state,open:true,openEventIds:isEvent?[...new Set([...state.openEventIds,target.id])]:state.openEventIds,expandedEventId:isEvent?target.id:undefined}));
    if (isEvent) setExpandedInspectorTabId(undefined);
    else {
      const existing = inspectorTabs.find(item=>inspectorSelectionKey(item.selection)===key);
      const tab: InspectorTab = existing ?? (target.type === "storyPlay"
        ? { id: key, selection: target, title: "Play Mode", mode: "play" }
        : explorerInspectorTab(target,current,nodesRef.current) ?? {id:key,selection:target,title:inspectorTargetTitle(current,target)});
      setInspectorTabs(tabs=>{
        const existing = tabs.find(item=>inspectorSelectionKey(item.selection)===key);
        if (!existing) return [...tabs,tab];
        return target.type === "storyPlay" && existing.mode !== "play"
          ? tabs.map(item => item.id === existing.id ? { ...item, mode: "play", title: "Play Mode" } : item)
          : tabs;
      });
      setExpandedInspectorTabId(tab.id);
    }
    const rememberedModule = target.type === "node" && narrativeInspectorModules(current, target.id) ? readInspectorModulePreferences(current.projectId, key)?.active : undefined;
    setInspectorRequest({selectionKey:key,section:section === "write" ? "path" : section ?? (selectedOutcomeId ? "content" : selectedDecisionNode ? "narrativeDecision" : rememberedModule ?? inspectorSections[`${storyKey}|${key}`] ?? "overview"),focusId:focusId ?? selectedOutcomeId,requestId:Date.now()});
  },[inspectorSections, inspectorTabs]);
  useEffect(() => {
    if (inspectorTabs.some(tab => tab.selection.type === 'edge')) setInspectorTabs(tabs => tabs.filter(tab => tab.selection.type !== 'edge'));
  }, [inspectorTabs]);
  openInspectorRef.current = openInspector;
  const openStoryPlay = useCallback(() => {
    if (playDetachedWindowActiveRef.current || playDetachingRef.current) return;
    setContextTab("edit");
    if (playRestoreOnOpenRef.current) {
      setContextFocus(playPreferredFullscreenRef.current);
      playRestoreOnOpenRef.current = false;
    }
    openInspector({ type: "storyPlay", id: "active" }, "play");
  }, [openInspector]);
  useEffect(()=>{setInspectorRequest(request=>request && (!selection || request.selectionKey!==inspectorSelectionKey(selection)) ? undefined : request);},[selection]);


  const selectWithEventDraftGuard = useCallback((target?:Selection) => {
    if (target) openInspector(target);
    else setSelection(undefined);
  }, [openInspector]);
  const pinInspectorTarget = useCallback((target:Selection) => {
    if (target.type === "edge") return;
    const current = projectRef.current;
    if (!current) return;
    if (target.type === "node" && current.events.some(event => event.id === target.id)) {
      setEventInspector(state => ({...state,openEventIds:[...new Set([...state.openEventIds,target.id])]}));
    } else {
      const tab = explorerInspectorTab(target,current,nodes) ?? {id:inspectorSelectionKey(target),selection:target,title:target.id};
      setInspectorTabs(tabs => tabs.some(item=>inspectorSelectionKey(item.selection)===inspectorSelectionKey(target)) ? tabs : [...tabs,tab]);
    }
  }, [nodes]);
  const unpinInspectorTarget = useCallback((target:Selection) => {
    setEventInspector(state => ({...state,openEventIds:state.openEventIds.filter(id=>!(target.type === "node" && id === target.id))}));
    if (target.type === "node") {
      deselectCanvasNode(target.id);
      setSelection(current => current?.type === "node" && current.id === target.id ? undefined : current);
    }
    if (target.type === "storyPlay") prepareClosedStoryPlay();
    setInspectorTabs(tabs => tabs.filter(tab=>inspectorSelectionKey(tab.selection)!==inspectorSelectionKey(target)));
  }, [deselectCanvasNode, prepareClosedStoryPlay]);
  const rememberInspectorSection = useCallback((key:string,section:string) => {
    const current = projectRef.current;
    if (!current) return;
    const scoped = `${current.storyId ?? current.projectId}|${key}`;
    setInspectorSections(sections=>sections[scoped]===section ? sections : {...sections,[scoped]:section});
    setInspectorRequest(request=>request?.selectionKey===key && request.section!==section ? {...request,section} : request);
  }, []);
  const openAuthoringSection = useCallback((id:string,section:string) => openInspector({type:id.startsWith("edge:") ? "edge" : "node",id},section),[openInspector]);

  useEffect(() => {
    const pending = pendingPathSelectionRef.current;
    if (!pending || !activeScope || canvasScopeKey(activeScope) !== pending.scopeKey) {
      return;
    }
    if (!nodes.some((node) => node.id === pending.selection.id)) {
      return;
    }
    pendingPathSelectionRef.current = undefined;
    selectWithEventDraftGuard(pending.selection);
  }, [activeScope, nodes, selectWithEventDraftGuard]);

  const openInspectorTab = useCallback(
    (id: string) => {
      const expanding = expandedInspectorTabId !== id;
      const target = inspectorTabs.find((tab) => tab.id === id);
      setExpandedInspectorTabId(expanding ? id : undefined);
      if (expanding) {
        setEventInspector((current) => ({
          ...current,
          open: true,
          expandedEventId: undefined,
        }));
        if (target) setSelection(target.selection);
      } else if (target?.selection.type === "node") {
        deselectCanvasNode(target.selection.id);
        setSelection((current) => current && inspectorSelectionKey(current) === inspectorSelectionKey(target.selection) ? undefined : current);
      }
    },
    [deselectCanvasNode, expandedInspectorTabId, inspectorTabs],
  );

  const closeInspectorTab = useCallback(
    (id: string) => {
      const closedIndex = inspectorTabs.findIndex((tab) => tab.id === id);
      const closedTab = inspectorTabs[closedIndex];
      if (closedTab?.selection.type === "node") {
        deselectCanvasNode(closedTab.selection.id);
        setSelection((current) => current && inspectorSelectionKey(current) === inspectorSelectionKey(closedTab.selection) ? undefined : current);
      }
      if (closedTab?.selection.type === "storyPlay") {
        prepareClosedStoryPlay();
        stopStoryTestRef.current();
        setSelection(current => current?.type === "storyPlay" && inspectorSelectionKey(current) === inspectorSelectionKey(closedTab.selection) ? undefined : current);
      }
      const nextTabs = inspectorTabs.filter((tab) => tab.id !== id);
      setInspectorTabs(nextTabs);
      if (expandedInspectorTabId !== id) return;
      const nextTab = settings.inspectorTabCloseSelectsNext
        ? nextTabs[closedIndex] ?? nextTabs[closedIndex - 1]
        : undefined;
      setExpandedInspectorTabId(nextTab?.id);
      if (nextTab) {
        setSelection(nextTab.selection);
      } else if (
        settings.inspectorTabCloseSelectsNext &&
        eventInspector.openEventIds.length > 0
      ) {
        setEventInspector((current) => ({
          ...current,
          open: true,
          expandedEventId: current.openEventIds[0],
        }));
        setSelection({ type: "node", id: eventInspector.openEventIds[0] });
      } else {
        setSelection((current) => current && closedTab && inspectorSelectionKey(current) === inspectorSelectionKey(closedTab.selection) ? undefined : current);
      }
    },
    [
      eventInspector.openEventIds,
      expandedInspectorTabId,
      inspectorTabs,
      settings.inspectorTabCloseSelectsNext,
      prepareClosedStoryPlay,
      deselectCanvasNode,
    ],
  );

  const closeDeletedInspectorSelection = useCallback(
    (target: Selection) => {
      const targetKey = inspectorSelectionKey(target);
      const removedTabIds = new Set(
        inspectorTabs
          .filter((tab) => inspectorSelectionKey(tab.selection) === targetKey)
          .map((tab) => tab.id),
      );
      setInspectorTabs((current) =>
        current.filter((tab) => inspectorSelectionKey(tab.selection) !== targetKey),
      );
      setExpandedInspectorTabId((current) =>
        current && removedTabIds.has(current) ? undefined : current,
      );
      setSelection((current) =>
        current && inspectorSelectionKey(current) === targetKey ? undefined : current,
      );
    },
    [inspectorTabs],
  );
  const closeDeletedNodeInspector = useCallback(
    (nodeId: string) => closeDeletedInspectorSelection({ type: "node", id: nodeId }),
    [closeDeletedInspectorSelection],
  );

  useEffect(() => {
    if (!project) {
      setEventDraft(undefined);
      return;
    }
    const ownerEventId = eventIdFromSelection(project, nodes, selection);
    if (!ownerEventId) {
      return;
    }
    const draftSelection = { type: "node" as const, id: ownerEventId };
    const nextDraft = recoverEventDraft(project, ownerEventId) ?? createEventDraftFromSelection(
      project,
      draftSelection,
      eventDraft?.mode ?? "components",
    );
    if (
      eventDraft?.eventId === nextDraft?.eventId &&
      eventDraft?.mode === nextDraft?.mode
    ) {
      return;
    }
    setEventDraft(nextDraft);
  }, [
    eventDraft?.eventId,
    eventDraft?.mode,
    nodes,
    project,
    selection,
  ]);

  const mutateEventDraft = useCallback(
    (
      factory: (projectWithDraft: BranchingProject) => mutations.MutationResult,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      // Canvas edits made while an event inspector is open are document edits,
      // so they must use the same undo, redo and save transaction as other edits.
      void commitStructuralAction("Updated event", factory(currentProject));
    },
    [commitStructuralAction],
  );

  const importAssets = useCallback(async () => {
    if (!fileState.universePath) {
      setMessage("Open a universe before importing assets.");
      return;
    }
    try {
      const imported = await importUniverseAssets(fileState.universePath);
      if (imported.length === 0) return;
      const current = projectRef.current;
      if (!current) return;
      await commitStructuralAction("Imported UnCanon assets", {
        project: {
          ...current,
          assets: [
            ...(current.assets ?? []).filter((asset) => asset.origin === "canon"),
            ...(current.assets ?? []).filter((asset) => asset.origin === "uncanon"),
            ...imported.map((asset) => ({
              ...asset,
              id: `asset:${crypto.randomUUID()}`,
              origin: "uncanon" as const,
              importedAt: new Date().toISOString(),
            })),
          ],
        },
        message: `Imported ${imported.length} UnCanon asset${imported.length === 1 ? "" : "s"}.`,
      });
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : String(assetError));
    }
  }, [commitStructuralAction, fileState.universePath]);

  const importInteractionPreviewImage = useCallback(async () => {
    if (!fileState.universePath) {
      setMessage(uiLocale === 'es' ? 'Abre un universo antes de cargar una imagen.' : 'Open a universe before uploading an image.');
      return [];
    }
    try {
      const imported = await importSceneImages(fileState.universePath);
      if (!imported.length) return [];
      const current = projectRef.current;
      if (!current) return [];
      const importedAt = new Date().toISOString();
      const registered = imported.map((asset) => ({
        ...asset,
        id: `asset:${crypto.randomUUID()}`,
        origin: 'uncanon' as const,
        importedAt,
      }));
      await commitStructuralAction('Imported interaction preset image', {
        project: { ...current, assets: [...(current.assets ?? []), ...registered] },
        message: `Imported ${registered.length} interaction preset image${registered.length === 1 ? '' : 's'}.`,
      });
      return registered;
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : String(assetError));
      return [];
    }
  }, [commitStructuralAction, fileState.universePath, uiLocale]);

  const importSceneImageForBeat = useCallback(async (
    eventId: string,
    dialogueId: string | undefined,
    beatId: string,
  ) => {
    if (!fileState.universePath) {
      setMessage("Open a universe before importing scene images.");
      return;
    }
    try {
      const imported = await importSceneImages(fileState.universePath);
      if (imported.length === 0) return;
      const current = projectRef.current;
      if (!current) return;
      const event = current.events.find((candidate) => candidate.id === eventId);
      const beat = dialogueId
        ? event?.dialogues?.find((dialogue) => dialogue.id === dialogueId)?.beats?.find((candidate) => candidate.id === beatId)
        : event?.dialogueBeats?.find((candidate) => candidate.id === beatId);
      if (!beat || beat.kind !== "speech") {
        setError("Scene images can only be added to an existing speech beat.");
        return;
      }
      const importedAt = new Date().toISOString();
      const registered = imported.map((asset) => ({
        ...asset,
        id: `asset:${crypto.randomUUID()}`,
        origin: "uncanon" as const,
        importedAt,
      }));
      const sceneImage = { id: beat.sceneImage?.id ?? `scene-image:${crypto.randomUUID()}`, assetId: registered[0].id };
      const withAssets: BranchingProject = {
        ...current,
        assets: [...(current.assets ?? []), ...registered],
      };
      const result = dialogueId
        ? mutations.updateDialogueBeat(withAssets, eventId, dialogueId, beatId, { sceneImage })
        : mutations.updateEventDialogueBeat(withAssets, eventId, beatId, { sceneImage });
      await commitStructuralAction("Set scene image", {
        project: result.project,
        message: "Set scene image.",
      });
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : String(assetError));
    }
  }, [commitStructuralAction, fileState.universePath]);

  const importEventCoverImage = useCallback(async (eventId: string) => {
    if (!fileState.universePath) {
      setMessage("Open a universe before importing event cover images.");
      return;
    }
    try {
      const imported = await importSceneImages(fileState.universePath);
      if (imported.length === 0) return;
      const current = projectRef.current;
      if (!current) return;
      const event = current.events.find((candidate) => candidate.id === eventId);
      if (!event) {
        setError("Event not found while importing the cover image.");
        return;
      }
      const importedAt = new Date().toISOString();
      const registered = imported.map((asset) => ({
        ...asset,
        id: `asset:${crypto.randomUUID()}`,
        origin: "uncanon" as const,
        importedAt,
      }));
      const withAssets: BranchingProject = {
        ...current,
        assets: [...(current.assets ?? []), ...registered],
      };
      const result = mutations.updateEvent(withAssets, eventId, {
        coverImage: {
          id: event.coverImage?.id ?? `event-cover:${crypto.randomUUID()}`,
          assetId: registered[0].id,
        },
      });
      await commitStructuralAction("Set event cover image", {
        project: result.project,
        message: "Set event cover image.",
      });
    } catch (assetError) {
      setError(assetError instanceof Error ? assetError.message : String(assetError));
    }
  }, [commitStructuralAction, fileState.universePath]);

  useEffect(() => {
    if (!desktopRuntime || !fileState.universePath) return;
    let cancelled = false;
    void indexCanonAssets(fileState.universePath).then((canonAssets) => {
      if (cancelled || !projectRef.current) return;
      const current = projectRef.current;
      const nextAssets = [
        ...canonAssets.map((asset) => ({
          ...asset,
          id: `canon-asset:${asset.path}`,
          origin: "canon" as const,
        })),
        ...(current.assets ?? []).filter((asset) => asset.origin === "uncanon"),
      ];
      const next = normalizeProject({ ...current, assets: nextAssets });
      projectRef.current = next;
      setProject(next);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [desktopRuntime, fileState.universePath]);

  const exportRuntime = useCallback(
    async (mode: ExportPreviewMode = exportPreviewMode) => {
      if (!project) {
        return;
      }
      try {
        const preview = buildExportPreview(project, mode);
        const result =
          mode === "ink"
            ? await exportTextDialog(preview.content, preview.defaultName)
            : mode === "gameData" || mode === "twine" || mode === 'runtimeYaml'
              ? await exportTextDialog(preview.content, preview.defaultName)
              : await exportRuntimeDialog(preview.runtimePackage);
        if (!result) {
          return;
        }
        if (!result.ok) {
          throw new Error(
            result.message ?? "Could not export runtime package.",
          );
        }
        reportLearning("document-exported", project.storyId ?? project.projectId);
        setMessage(`Exported ${projectFileName(result.path)}.`);
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : String(exportError),
        );
      }
    },
    [exportPreviewMode, project],
  );

  const importTwine = useCallback(
    (source: string, fileName: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      if (!window.confirm(`Import ${fileName} as a new sequence? Your existing sequences, branches, canon, assets, and project settings will be kept.`)) return;
      try {
        const imported = importTwineHtml(source, currentProject);
        const sequenceId = imported.canvas?.activeSequenceId;
        const entryEventId = imported.sequences.find((sequence) => sequence.id === sequenceId)?.entryEventId;
        void commitStructuralAction(`Imported Twine story ${fileName}`, imported, entryEventId ? { type: "node", id: entryEventId } : undefined);
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : String(importError));
      }
    },
    [commitStructuralAction],
  );

  const openRecentProject = useCallback(
    async (path: string) => {
      if (fileState.universePath === path) {
        setView("workspace");
        return;
      }
      if (!(await confirmDiscardChanges())) {
        return;
      }
      try {
        const opened = await openUniversePath(path);
        applyWorkspace(opened.workspace, opened.path);
        if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
        setSettings((current) => ({
          ...rememberRecentProject(current, opened.path),
          worldnotionBridge: {
            ...current.worldnotionBridge,
            connected: true,
            lastCheckedAt: Date.now(),
            lastStatus: "ok",
            lastMessage:
              "WorldNotion bridge connected through the selected recent universe.",
          },
        }));
        setView("workspace");
        setError(undefined);
        setMessage(
          workspaceLoadWarningMessage(opened.workspace) ??
            `Opened ${projectFileName(opened.path)}.`,
        );
      } catch (openError) {
        setMissingRecentProjects((current) => new Set(current).add(path));
        setError(
          openError instanceof Error ? openError.message : String(openError),
        );
      }
    },
    [applyWorkspace, confirmDiscardChanges, fileState.universePath],
  );

  const removeRecentProject = useCallback((path: string) => {
    setSettings((current) => ({
      ...current,
      recentProjects: current.recentProjects.filter(
        (candidate) => candidate !== path,
      ),
      lastOpenedProject:
        current.lastOpenedProject === path
          ? undefined
          : current.lastOpenedProject,
    }));
    setMissingRecentProjects((current) => {
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  }, []);

  const undoProject = useCallback(() => {
    if (!project || undoStack.length === 0) {
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current.slice(-199), project]);
    setActionHistory((current) => ["Undo", ...current].slice(0, 10));
    applyProject(previous, { dirty: true, revision: true });
    setMessage("Undo...");
    void persistProjectRef
      .current?.()
      .then(() => setMessage("Undo saved."))
      .catch((undoError) => {
        setError(
          undoError instanceof Error ? undoError.message : String(undoError),
        );
      });
  }, [applyProject, project, redoStack, undoStack]);

  const redoProject = useCallback(() => {
    if (!project || redoStack.length === 0) {
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current.slice(-199), project]);
    setActionHistory((current) => ["Redo", ...current].slice(0, 10));
    applyProject(next, { dirty: true, revision: true });
    setMessage("Redo...");
    void persistProjectRef
      .current?.()
      .then(() => setMessage("Redo saved."))
      .catch((redoError) => {
        setError(
          redoError instanceof Error ? redoError.message : String(redoError),
        );
      });
  }, [applyProject, project, redoStack, undoStack]);

  useEffect(() => {
    if (suiteChrome && !suiteChrome.active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editingText = target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (editingText && (shortcutMatches(event, "Mod+Z") || shortcutMatches(event, "Mod+Shift+Z"))) {
        return;
      }
      if (shortcutMatches(event, "Mod+Z")) {
        event.preventDefault();
        undoProject();
      }
      if (shortcutMatches(event, "Mod+Shift+Z")) {
        event.preventDefault();
        redoProject();
      }
      if (shortcutMatches(event, "Mod+S")) {
        event.preventDefault();
        saveDocumentManually();
      }
      if (shortcutMatches(event, "Mod+R")) {
        event.preventDefault();
        if (suiteChrome?.onReload) suiteChrome.onReload();
        else window.location.reload();
        return;
      }
      if (shortcutMatches(event, "Mod+O")) {
        event.preventDefault();
        void openProject();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    saveDocumentManually,
    openProject,
    redoProject,
    saveActiveManualInspectorDraft,
    suiteChrome,
    undoProject,
  ]);

  const navigateCanvasScope = useCallback(
    (scope: CanvasScope, nextSelection?: Selection, options?: { preserveSelection?: boolean }) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const nextProject = {
        ...currentProject,
        canvas: {
          ...currentProject.canvas,
          activeScope: scope,
          activeSequenceId:
            scope.kind === "sequence"
              ? scope.id
              : currentProject.canvas?.activeSequenceId,
        },
      };
      const normalizedScope = activeCanvasScope(nextProject);
      const model = buildStoryCanvasModel(nextProject, {
        nodeColors: settingsRef.current.nodeColors,
        scope: normalizedScope,
        gridSize: settingsRef.current.canvasBackground.gridSize,
        authoringDisplay: settingsRef.current.authoringDisplay,
        canvasLayerMode: canvasLayerModeRef.current,
        interfaceLocale: uiLocaleRef.current,
      });
      projectRef.current = nextProject;
      setProject(nextProject);
      setActiveScopeState(normalizedScope);
      setNodes(model.nodes);
      setEdges(model.edges);
      setFiles(model.files);
      setCanvasMode("branching");
      setFocusNodeId(undefined);
      if (!options?.preserveSelection) setSelection(nextSelection ?? { type: "node", id: scope.id });
    },
    [],
  );

  const navigatePathTreeNode = useCallback(
    (node: PathTreeNode) => {
      const nextSelection = { type: "node" as const, id: node.selectId };
      pendingPathSelectionRef.current = {
        scopeKey: canvasScopeKey(node.scope),
        selection: nextSelection,
      };
      navigateCanvasScope(node.scope, nextSelection);
    },
    [navigateCanvasScope],
  );

  const enterEventScope = useCallback(
    (eventId: string) => {
      navigateCanvasScope(
        { kind: "event", id: eventId },
        { type: "node", id: eventId },
      );
    },
    [navigateCanvasScope],
  );

  const exitToRootScope = useCallback(() => {
    const currentProject = projectRef.current;
    const scope = currentProject
      ? rootSequenceScope(currentProject)
      : undefined;
    if (scope) {
      navigateCanvasScope(scope, { type: "node", id: scope.id });
    }
  }, [navigateCanvasScope]);

  const validateNarrative = useMemo(() => createNarrativeValidationCache(), []);
  const narrativeFindings = project ? validateNarrative(project) : [];
  const validateCanvasTopology = useMemo(() => createCanvasValidationCache(), []);
  const canvasFindings = validateCanvasTopology(nodes, edges);
  const findings = useMemo(() => project ? [...narrativeFindings, ...canvasFindings] : [], [project, narrativeFindings, canvasFindings]);
  const testCanvasNodes = useMemo(() => nodes.map(node => {
    const className = [node.className, node.id === testPosition ? "authoring-position-active" : testVisited.includes(node.id) ? "authoring-route-active" : ""].filter(Boolean).join(" ");
    return className === (node.className ?? "") ? node : { ...node, className };
  }), [nodes, testPosition, testVisited]);
  const testCanvasEdges = useMemo(() => edges.map(edge => {
    const className = [edge.className, testVisited.some((id, index) => id === edge.source && testVisited[index + 1] === edge.target) ? "authoring-route-active" : ""].filter(Boolean).join(" ");
    return className === (edge.className ?? "") ? edge : { ...edge, className };
  }), [edges, testVisited]);
  const webPreviewBanner = desktopRuntime ? null : (
    <div className="persistence-warning" role="status">
      {uiLocale === "es" ? "Vista web: selecciona una carpeta de universo para comprobar y guardar metadatos de PathBranching durante esta sesión." : "Web preview: select a universe folder to review and save PathBranching metadata during this session."}
    </div>
  );

  const createStory = useCallback(
    async (name?: string) => {
      const currentWorkspace = workspaceRef.current;
      const currentFileState = fileStateRef.current;
      if (!currentWorkspace || !currentFileState.universePath) {
        setMessage("Open a universe before creating a story.");
        return;
      }

      try {
        setMessage("Creating Everend PathBranching story...");
        const revision = projectRevisionRef.current + 1;
        const snapshot = await createBranchingStory({
          workspace: workspaceRef.current ?? currentWorkspace,
          fileState: fileStateRef.current,
          name,
          revision,
        });
        applyWorkspace(snapshot.nextWorkspace, currentFileState.universePath);
        projectRevisionRef.current = revision;
        savedRevisionRef.current = revision;
        fileStateRef.current = snapshot.nextFileState;
        setFileState(snapshot.nextFileState);
        setSettings((current) =>
          rememberRecentProject(
            current,
            currentFileState.universePath as string,
          ),
        );
        setView("workspace");
        reportLearning("story-created", snapshot.savedProject.storyId ?? snapshot.savedProject.projectId, currentFileState.universePath);
        setMessage(
          `Created story ${snapshot.nextWorkspace.activeStory?.name ?? snapshot.savedProject.name}.`,
        );
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : String(createError),
        );
      }
    },
    [applyWorkspace],
  );

  const createSequence = useCallback(
    (name?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setNameDialog({
          kind: "createStory",
          title: "Create Story",
          label: "Story name",
          initialValue: "Branching Story",
        });
        setMessage(
          "Create an Everend PathBranching story before adding sequences.",
        );
        return;
      }
      runCanvasMutation(mutations.createSequence(currentProject, name), "Created sequence");
    },
    [runCanvasMutation],
  );

  const requestCreateStory = useCallback(() => {
    setNameDialog({
      kind: "createStory",
      title: "Create Story",
      label: "Story name",
      initialValue: "Branching Story",
    });
  }, []);

  const requestRenameStory = useCallback(() => {
    const activeStory = workspaceRef.current?.activeStory;
    if (!activeStory || workspaceRef.current?.createdDefaultStory) {
      setNameDialog({
        kind: "createStory",
        title: "Create Story",
        label: "Story name",
        initialValue: activeStory?.name ?? "Branching Story",
      });
      return;
    }
    setNameDialog({
      kind: "renameStory",
      title: "Rename Story",
      label: "Story name",
      initialValue: activeStory.name,
    });
  }, []);

  const requestDeleteStory = useCallback(() => {
    const currentWorkspace = workspaceRef.current;
    const activeStory = currentWorkspace?.activeStory;
    if (
      !activeStory ||
      !currentWorkspace ||
      currentWorkspace.manifest.stories.length <= 1
    ) {
      setMessage("Cannot delete the only story in this universe.");
      return;
    }
    setConfirmDialog({
      kind: "deleteStory",
      title: "Delete Story",
      message: `Remove "${activeStory.name}" from this universe? The story file will remain on disk for safety.`,
    });
  }, []);

  const requestCreateSequence = useCallback(() => {
    if (workspaceRef.current?.createdDefaultStory) {
      setNameDialog({
        kind: "createStory",
        title: "Create Story",
        label: "Story name",
        initialValue: "Branching Story",
      });
      return;
    }
    setNameDialog({
      kind: "createSequence",
      title: "Create Sequence",
      label: "Sequence name",
      initialValue: "New Sequence",
    });
  }, []);

  const requestRenameSequence = useCallback(() => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const sequenceId = activeSequenceId(currentProject);
    const sequence = sequenceId
      ? findSequence(currentProject, sequenceId)
      : undefined;
    if (!sequence) {
      setMessage("No sequence is selected.");
      return;
    }
    setNameDialog({
      kind: "renameSequence",
      title: "Rename Sequence",
      label: "Sequence name",
      initialValue: sequence.name,
    });
  }, []);

  const requestDeleteSequence = useCallback(() => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const sequenceId = activeSequenceId(currentProject);
    const sequence = sequenceId
      ? findSequence(currentProject, sequenceId)
      : undefined;
    if (!sequence) {
      setMessage("No sequence is selected.");
      return;
    }
    setConfirmDialog({
      kind: "deleteSequence",
      title: "Delete Sequence",
      message: `Delete "${sequence.name}" and its ${sequence.eventIds.length} event${sequence.eventIds.length === 1 ? "" : "s"}? Links to those events will be removed.`,
    });
  }, []);

  const confirmNameDialog = useCallback(
    async (value: string) => {
      const dialog = nameDialog;
      if (!dialog) return;
      setNameDialog(undefined);
      if (dialog.kind === "createStory") {
        await createStory(value);
        return;
      }
      if (dialog.kind === "renameStory") {
        const currentProject = projectRef.current;
        const currentWorkspace = workspaceRef.current;
        const currentFileState = fileStateRef.current;
        if (!currentProject || !currentWorkspace) return;
        try {
          const revision = projectRevisionRef.current + 1;
          const snapshot = await renameBranchingStory({
            project: currentProject,
            workspace: currentWorkspace,
            fileState: currentFileState,
            name: value,
            revision,
          });
          applyWorkspace(
            snapshot.nextWorkspace,
            currentFileState.universePath as string,
          );
          projectRevisionRef.current = revision;
          savedRevisionRef.current = revision;
          fileStateRef.current = snapshot.nextFileState;
          setFileState(snapshot.nextFileState);
          setMessage(`Renamed story to ${value}.`);
        } catch (renameError) {
          setError(
            renameError instanceof Error
              ? renameError.message
              : String(renameError),
          );
        }
        return;
      }
      if (dialog.kind === "createSequence") {
        createSequence(value);
        return;
      }
      if (dialog.kind === "renameSequence") {
        const currentProject = projectRef.current;
        const sequenceId = currentProject
          ? activeSequenceId(currentProject)
          : undefined;
        if (currentProject && sequenceId) {
          runMutation(
            mutations.updateSequence(currentProject, sequenceId, {
              name: value,
            }),
          );
        }
        return;
      }
      if (dialog.kind === "createDialogue") {
        const currentProject = projectRef.current;
        if (!currentProject) return;
        const sourceProject =
          eventDraft?.eventId === dialog.eventId
            ? applyEventDraftToProject(currentProject, eventDraft)
            : currentProject;
        if (eventDraft?.eventId === dialog.eventId) setEventDraft(undefined);
        if (dialog.connected) {
          const positioned = positionMutationNode(
            mutations.createDialogue(sourceProject, dialog.eventId, value),
            snapCanvasPoint(
              dialog.position ?? { x: 0, y: 0 },
              settingsRef.current.canvasBackground.snapToGrid,
              settingsRef.current.canvasBackground.gridSize,
            ),
            dialog.connected.scope,
          );
          const targetNodeId =
            positioned.selection?.type === "node" ? positioned.selection.id : undefined;
          if (!targetNodeId || positioned.project === currentProject) {
            setMessage(positioned.message ?? "Could not create the connected dialogue.");
            return;
          }
          runCanvasMutation(
            mutations.createInternalTransition(
              positioned.project,
              dialog.eventId,
              dialog.connected.sourceHandleId ?? dialog.connected.sourceNodeId,
              targetNodeId,
            ),
            "Created connected dialogue",
          );
          return;
        }
        runCanvasMutation(
          positionMutationNode(
            mutations.createDialogue(sourceProject, dialog.eventId, value),
            dialog.position,
            activeScope,
          ),
          "Created dialogue",
        );
        return;
      }
      if (dialog.kind === "createDialogueFromSelection") {
        const currentProject = projectRef.current;
        if (!currentProject) return;
        runCanvasMutation(
          mutations.groupDialogueMembers(
            currentProject,
            dialog.eventId,
            dialog.members,
            value,
          ),
          "Created dialogue",
        );
        return;
      }
      if (dialog.kind === "saveInspectorTabGroup") {
        const result = saveEventInspectorTabGroup(
          eventInspector,
          value,
          eventInspectorTabGroups,
        );
        const groups = result.groupId
          ? result.groups.map((group) =>
              group.id === result.groupId
                ? {
                    ...group,
                    inspectorTabs: [...inspectorTabs],
                    inspectorExpandedTabId: expandedInspectorTabId,
                    inspectorStackOrder,
                    expandedEventId: expandedInspectorTabId
                      ? undefined
                      : group.expandedEventId,
                  }
                : group,
            )
          : [
              ...result.groups,
              {
                id: `inspector-tabs-${Date.now().toString(36)}`,
                name: value,
                eventIds: [],
                inspectorTabs: [...inspectorTabs],
                inspectorExpandedTabId: expandedInspectorTabId,
                inspectorStackOrder,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ];
        setEventInspectorTabGroups(groups);
        setMessage(
          result.groupId || inspectorTabs.length > 0
            ? `Saved inspector tab group "${value}".`
            : "Open inspector tabs before saving a group.",
        );
      }
    },
    [
      applyWorkspace,
      createSequence,
      createStory,
      eventInspector,
      eventInspectorTabGroups,
      eventDraft,
      expandedInspectorTabId,
      inspectorTabs,
      inspectorStackOrder,
      nameDialog,
      runCanvasMutation,
      runMutation,
      activeScope,
      settingsRef,
    ],
  );

  const confirmActionDialog = useCallback(async () => {
    const dialog = confirmDialog;
    if (!dialog) return;
    setConfirmDialog(undefined);
    if (dialog.kind === "deleteLocalExplorerEntity") {
      await deleteLocalExplorerEntity(dialog.entityId);
      return;
    }
    if (dialog.kind === "deleteSequence") {
      const currentProject = projectRef.current;
      const sequenceId = currentProject
        ? activeSequenceId(currentProject)
        : undefined;
      if (currentProject && sequenceId) {
        runCanvasMutation(
          mutations.deleteSequence(currentProject, sequenceId),
          "Deleted sequence",
        );
      }
      return;
    }
    if (dialog.kind === "deleteStory") {
      const currentWorkspace = workspaceRef.current;
      const currentFileState = fileStateRef.current;
      const activeStory = currentWorkspace?.activeStory;
      if (!currentWorkspace || !activeStory) return;
      if (!(await confirmDiscardChanges())) return;
      try {
        const snapshot = await deleteBranchingStory({
          workspace: currentWorkspace,
          fileState: currentFileState,
          storyId: activeStory.id,
        });
        const opened = await openUniverseStory(
          currentFileState.universePath as string,
          snapshot.nextWorkspace.activeStory?.id ?? "",
        );
        applyWorkspace(opened.workspace, opened.path);
        if (opened.workspace.activeProject && !opened.workspace.createdDefaultStory) reportLearning("document-reopened", opened.workspace.activeProject.storyId ?? opened.workspace.activeProject.projectId, opened.path);
        setFileState((current) => {
          const nextState = { ...current, dirty: false };
          fileStateRef.current = nextState;
          return nextState;
        });
        setMessage(`Deleted story ${activeStory.name} from the manifest.`);
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : String(deleteError),
        );
      }
    }
  }, [applyWorkspace, confirmDialog, confirmDiscardChanges, deleteLocalExplorerEntity, updateProject]);

  const createBranch = useCallback(
    (position?: { x: number; y: number }) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding branches.",
        );
        return;
      }

      const snap = settingsRef.current.canvasBackground;
      const snappedPosition = position
        ? snapCanvasPoint(position, snap.snapToGrid, snap.gridSize)
        : undefined;
      runCanvasMutation(mutations.createBranch(currentProject, snappedPosition), "Created branch");
    },
    [runCanvasMutation],
  );

  const createEvent = useCallback(
    (
      type: EventType = "normal",
      position?: { x: number; y: number },
      branchId?: string,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding events.",
        );
        return;
      }

      const snap = settingsRef.current.canvasBackground;
      const snappedPosition = position
        ? snapCanvasPoint(position, snap.snapToGrid, snap.gridSize)
        : undefined;
      runCanvasMutation(
        mutations.createEvent(currentProject, type, snappedPosition, branchId),
        "Created event",
      );
    },
    [runCanvasMutation],
  );

  const createNestedEvent = useCallback(
    (
      parentEventId: string,
      type: EventType = "normal",
      position?: { x: number; y: number },
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding nested events.",
        );
        return;
      }
      const snap = settingsRef.current.canvasBackground;
      const snappedPosition = position
        ? snapCanvasPoint(position, snap.snapToGrid, snap.gridSize)
        : undefined;
      runCanvasMutation(
        mutations.createNestedEvent(
          currentProject,
          parentEventId,
          type,
          snappedPosition,
        ),
        "Created nested event",
      );
    },
    [runCanvasMutation],
  );

  const createConnectedNestedEvent = useCallback(
    (
      parentEventId: string,
      sourceNodeId: string,
      type: EventType = "normal",
      position?: { x: number; y: number },
      sourceHandleId?: string,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding nested events.",
        );
        return;
      }
      const snap = settingsRef.current.canvasBackground;
      const snappedPosition = position
        ? snapCanvasPoint(position, snap.snapToGrid, snap.gridSize)
        : undefined;
      const created = mutations.createNestedEvent(
        currentProject,
        parentEventId,
        type,
        snappedPosition,
      );
      const targetEventId =
        created.selection?.type === "node" ? created.selection.id : undefined;
      if (!targetEventId || created.project === currentProject) {
        setMessage(created.message ?? "Could not create a connected nested event.");
        return;
      }
      const route = mutations.createInternalTransition(
        created.project,
        parentEventId,
        sourceHandleId ?? sourceNodeId,
        targetEventId,
      );
      runCanvasMutation(route, "Created connected nested event");
    },
    [runCanvasMutation],
  );

  const createConnectedNarrativeNode = useCallback(
    (
      scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>,
      sourceNodeId: string,
      kind: ConnectedNarrativeNodeKind,
      position: CanvasPoint,
      sourceHandleId?: string,
      preset?: Pick<DialoguePreset, "characterRef" | "characterVariantId">,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding narrative nodes.",
        );
        return;
      }

      const eventId = scope.kind === "event" ? scope.id : scope.eventId;
      const sourceProject =
        eventDraft?.eventId === eventId
          ? applyEventDraftToProject(currentProject, eventDraft)
          : currentProject;
      if (kind === "dialogue") {
        const event = findEvent(sourceProject, eventId);
        if (!event) return;
        setNameDialog({
          kind: "createDialogue",
          title: uiLocaleRef.current === "es" ? "Crear conversación" : "Create conversation",
          label: uiLocaleRef.current === "es" ? "Nombre de la conversación" : "Conversation name",
          initialValue: automaticNarrativeName(
            sourceProject,
            eventId,
            "Conversation",
                      ),
          eventId,
          position,
          connected: { scope, sourceNodeId, sourceHandleId },
        });
        return;
      }
      if (kind === "interaction") {
        if (eventDraft?.eventId === eventId) {
          setEventDraft(undefined);
        }
        const created = addInteraction(sourceProject, eventId, "dice", {
          pendingMechanic: true,
          dialogueId: scope.kind === "dialogue" ? scope.id : undefined,
          afterNodeId: sourceHandleId ?? sourceNodeId,
        });
        const positioned = positionMutationNode(
          created,
          snapCanvasPoint(
            position,
            settingsRef.current.canvasBackground.snapToGrid,
            settingsRef.current.canvasBackground.gridSize,
          ),
          scope,
        );
        if (positioned.project === sourceProject) {
          setMessage(positioned.message ?? "Could not create the connected interaction.");
          return;
        }
        runCanvasMutation(positioned, "Created connected interaction");
        return;
      }
      if (eventDraft?.eventId === eventId) {
        setEventDraft(undefined);
      }

      const created = (() => {
        switch (kind) {
          case "decision":
            return mutations.createDecision(
              sourceProject,
              eventId,
              scope.kind === "dialogue" ? scope.id : undefined,
            );
          case "speechBeat":
          case "directionBeat":
            return scope.kind === "dialogue"
              ? mutations.createDialogueBeat(
                  sourceProject,
                  eventId,
                  scope.id,
                  kind === "speechBeat" ? "speech" : "direction",
                  preset,
                  sourceNodeId === `dialogue-boundary:${eventId}:${scope.id}:input`,
                )
              : mutations.createEventDialogueBeat(
                  sourceProject,
                  eventId,
                  kind === "speechBeat" ? "speech" : "direction",
                  preset,
                );
          case "dialogueStart":
            return mutations.createDialogueStart(sourceProject, eventId);
        }
      })();
      const positioned = positionMutationNode(
        created,
        snapCanvasPoint(
          position,
          settingsRef.current.canvasBackground.snapToGrid,
          settingsRef.current.canvasBackground.gridSize,
        ),
        scope,
      );
      const targetNodeId =
        positioned.selection?.type === "node" ? positioned.selection.id : undefined;
      if (!targetNodeId || positioned.project === currentProject) {
        setMessage(positioned.message ?? "Could not create the connected narrative node.");
        return;
      }
      runCanvasMutation(
        mutations.createInternalTransition(
          positioned.project,
          eventId,
          sourceHandleId ?? sourceNodeId,
          targetNodeId,
        ),
        "Created connected narrative node",
      );
    },
    [eventDraft, runCanvasMutation],
  );

  const discardPendingBoundaryPort = useCallback(
    (preserveNodeId?: string) => {
      const pending = pendingBoundaryPortRef.current;
      if (!pending || pending.nodeId === preserveNodeId) return;
      pendingBoundaryPortRef.current = undefined;
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const scopeKey = pending.dialogueId
        ? canvasScopeKey({ kind: "dialogue", id: pending.dialogueId, eventId: pending.eventId })
        : canvasScopeKey({ kind: "event", id: pending.eventId });
      const slots = pending.direction === "input"
        ? currentProject.canvas?.scopes?.[scopeKey]?.entrySlots ?? []
        : currentProject.canvas?.scopes?.[scopeKey]?.exitSlots ?? [];
      if (!slots.includes(pending.slotId)) return;
      commitCanvasAction(
        "Discarded unfinished boundary port",
        mutations.removeBoundaryPortSlot(
          currentProject,
          pending.eventId,
          pending.direction,
          pending.slotId,
          pending.dialogueId,
        ),
      );
    },
    [commitCanvasAction],
  );

  const onBoundarySelectionChange = useCallback(
    (selectedNodeIds: string[]) => {
      const pending = pendingBoundaryPortRef.current;
      if (!pending) return;
      if (selectedNodeIds.includes(pending.nodeId)) {
        pending.selected = true;
        return;
      }
      if (pending.selected) discardPendingBoundaryPort();
    },
    [discardPendingBoundaryPort],
  );

  const createBoundaryRoute = useCallback(
    (
      eventId: string,
      targetEventId: string,
      direction: "input" | "output" = "output",
      slotId?: string,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const sourceProject = eventDraft?.eventId === eventId
        ? applyEventDraftToProject(currentProject, eventDraft)
        : currentProject;
      const sourceEventId = direction === "input" ? targetEventId : eventId;
      const destinationEventId = direction === "input" ? eventId : targetEventId;
      const route = mutations.createInternalTransition(
        sourceProject,
        sourceEventId,
        sourceEventId,
        destinationEventId,
      );
      const createdTransition = route.project.events
        .find((event) => event.id === sourceEventId)
        ?.transitions?.find((transition) =>
          transition.from === sourceEventId && transition.to === destinationEventId,
        );
      const nextProject = slotId && createdTransition
        ? mutations.resolveBoundaryPortSlot(
            route.project,
            eventId,
            direction,
            slotId,
            createdTransition.id,
          )
        : route.project;
      if (eventDraft?.eventId === eventId) setEventDraft(undefined);
      if (pendingBoundaryPortRef.current?.eventId === eventId && pendingBoundaryPortRef.current.slotId === slotId) {
        pendingBoundaryPortRef.current = undefined;
      }
      runCanvasMutation(
        { ...route, project: nextProject },
        direction === "input" ? "Linked route source" : "Linked route destination",
      );
    },
    [eventDraft, runCanvasMutation],
  );

  const createScriptTransition = useCallback(
    (eventId: string, from: string, to: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.createInternalTransition(draftProject, eventId, from, to),
        );
        return;
      }
      runCanvasMutation(
        mutations.createInternalTransition(currentProject, eventId, from, to),
        "Created script transition",
      );
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const createDialogueBoundaryRoute = useCallback(
    (eventId: string, dialogueId: string, direction: "input" | "output", targetId: string, slotId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const sourceProject = eventDraft?.eventId === eventId
        ? applyEventDraftToProject(currentProject, eventDraft)
        : currentProject;
      const dialogueRef = `dialogue:${eventId}:${dialogueId}`;
      const from = direction === "input" ? targetId : dialogueRef;
      const to = direction === "input" ? dialogueRef : targetId;
      const result = mutations.createInternalTransition(sourceProject, eventId, from, to);
      const createdTransition = result.project.events
        .find((event) => event.id === eventId)
        ?.transitions?.find((transition) => transition.from === from && transition.to === to);
      const nextProject = createdTransition
        ? mutations.resolveDialogueBoundaryPortSlot(
            result.project,
            eventId,
            dialogueId,
            direction,
            slotId,
            createdTransition.id,
          )
        : result.project;
      if (
        pendingBoundaryPortRef.current?.eventId === eventId &&
        pendingBoundaryPortRef.current.dialogueId === dialogueId &&
        pendingBoundaryPortRef.current.slotId === slotId
      ) pendingBoundaryPortRef.current = undefined;
      if (eventDraft?.eventId === eventId) setEventDraft(undefined);
      runCanvasMutation(
        { ...result, project: nextProject },
        direction === "input" ? "Connected conversation input" : "Connected conversation output",
      );
    },
    [eventDraft, runCanvasMutation],
  );

  const createBoundaryRouteEvent = useCallback(
    (eventId: string, direction: "input" | "output" = "output", slotId?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage("Create an Everend PathBranching story before adding route events.");
        return;
      }
      const sourceProject = eventDraft?.eventId === eventId
        ? applyEventDraftToProject(currentProject, eventDraft)
        : currentProject;
      if (eventDraft?.eventId === eventId) setEventDraft(undefined);
      const created = mutations.createEvent(sourceProject);
      const newEventId = created.selection?.type === "node"
        ? created.selection.id
        : undefined;
      if (!newEventId) {
        setMessage(created.message ?? "Could not create a route event.");
        return;
      }
      const sourceEventId = direction === "input" ? newEventId : eventId;
      const destinationEventId = direction === "input" ? eventId : newEventId;
      const route = mutations.createInternalTransition(
        created.project,
        sourceEventId,
        sourceEventId,
        destinationEventId,
      );
      const createdTransition = route.project.events
        .find((event) => event.id === sourceEventId)
        ?.transitions?.find((transition) =>
          transition.from === sourceEventId && transition.to === destinationEventId,
        );
      const nextProject = slotId && createdTransition
        ? mutations.resolveBoundaryPortSlot(
            route.project,
            eventId,
            direction,
            slotId,
            createdTransition.id,
          )
        : route.project;
      if (pendingBoundaryPortRef.current?.eventId === eventId && pendingBoundaryPortRef.current.slotId === slotId) {
        pendingBoundaryPortRef.current = undefined;
      }
      runCanvasMutation(
        { ...route, project: nextProject },
        direction === "input" ? "Created linked route source" : "Created linked route destination",
      );
    },
    [eventDraft, runCanvasMutation],
  );

  const createBoundaryEnd = useCallback(
    (eventId: string, direction: "input" | "output", position: { x: number; y: number }, dialogueId?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const scope: CanvasScope = dialogueId
        ? { kind: "dialogue", id: dialogueId, eventId }
        : { kind: "event", id: eventId };
      const scopeKey = canvasScopeKey(scope);
      const currentSlots = direction === "input"
        ? currentProject.canvas?.scopes?.[scopeKey]?.entrySlots ?? []
        : currentProject.canvas?.scopes?.[scopeKey]?.exitSlots ?? [];
      const slotId = `${direction === "input" ? "entry" : "exit"}-${Date.now().toString(36)}-${currentSlots.length + 1}`;
      const boundaryNodeId = dialogueId
        ? `dialogue-boundary:${eventId}:${dialogueId}:${direction}:${slotId}`
        : `boundary:${eventId}:${direction}:${slotId}`;
      pendingBoundaryPortRef.current = { eventId, dialogueId, direction, slotId, nodeId: boundaryNodeId, selected: false };
      commitCanvasAction(
        dialogueId
          ? `Added conversation ${direction === "input" ? "entry" : "continuation"} port`
          : `Added subcanvas ${direction === "input" ? "Entry" : "End"} port`,
        {
        ...currentProject,
        canvas: {
          ...currentProject.canvas,
          scopes: {
            ...(currentProject.canvas?.scopes ?? {}),
            [scopeKey]: {
              ...(currentProject.canvas?.scopes?.[scopeKey] ?? {}),
              ...(direction === "input"
                ? { entrySlots: [...currentSlots, slotId] }
                : { exitSlots: [...currentSlots, slotId] }),
              nodes: {
                ...(currentProject.canvas?.scopes?.[scopeKey]?.nodes ?? {}),
                [boundaryNodeId]: { position },
              },
            },
          },
        },
        },
      );
      window.requestAnimationFrame(() => {
        setNodes((currentNodes) => currentNodes.map((node) => ({
          ...node,
          selected: node.id === boundaryNodeId,
        })));
      });
    },
    [commitCanvasAction],
  );

  const deleteBoundaryEnd = useCallback(
    (eventId: string, direction: "input" | "output", slotId: string, dialogueId?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const scopeKey = dialogueId
        ? canvasScopeKey({ kind: "dialogue", id: dialogueId, eventId })
        : canvasScopeKey({ kind: "event", id: eventId });
      const currentSlots = direction === "input"
        ? currentProject.canvas?.scopes?.[scopeKey]?.entrySlots ?? []
        : currentProject.canvas?.scopes?.[scopeKey]?.exitSlots ?? [];
      if (!currentSlots.includes(slotId)) return;
      if (
        pendingBoundaryPortRef.current?.eventId === eventId &&
        pendingBoundaryPortRef.current.dialogueId === dialogueId &&
        pendingBoundaryPortRef.current.slotId === slotId
      ) pendingBoundaryPortRef.current = undefined;
      commitCanvasAction(
        dialogueId
          ? `Removed conversation ${direction === "input" ? "entry" : "continuation"} port`
          : `Removed subcanvas ${direction === "input" ? "Entry" : "End"} port`,
        mutations.removeBoundaryPortSlot(currentProject, eventId, direction, slotId, dialogueId),
      );
    },
    [commitCanvasAction],
  );

  useEffect(() => {
    const pending = pendingBoundaryPortRef.current;
    const pendingScopeStillActive = pending && (
      pending.dialogueId
        ? activeScope?.kind === "dialogue" && activeScope.id === pending.dialogueId && activeScope.eventId === pending.eventId
        : activeScope?.kind === "event" && activeScope.id === pending.eventId
    );
    if (pending && !pendingScopeStillActive) {
      discardPendingBoundaryPort();
    }
  }, [activeScope, discardPendingBoundaryPort]);

  const createEventInBranch = useCallback(
    (branchId: string, type: EventType = "normal") => {
      createEvent(type, undefined, branchId);
    },
    [createEvent],
  );

  const createConnectedEvent = useCallback(
    (
      sourceNodeId: string,
      type: EventType,
      position: { x: number; y: number },
      sourceHandleId?: string,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject || workspaceRef.current?.createdDefaultStory) {
        setMessage(
          "Create an Everend PathBranching story before adding events.",
        );
        return;
      }

      const sourceNode = nodes.find((node) => node.id === sourceNodeId);
      if (!sourceNode) {
        setMessage("Connection source could not be resolved.");
        return;
      }

      const sourceKind = sourceNode.data.kind;
      if (sourceKind === "decision" && !sourceHandleId) {
        setMessage("Create the connection from a decision option port (A, B, C…).");
        return;
      }
      const branchId =
        sourceKind === "branch" ? nodeStoryId(sourceNode) : undefined;
      const snap = settingsRef.current.canvasBackground;
      const snappedPosition = snapCanvasPoint(
        position,
        snap.snapToGrid,
        snap.gridSize,
      );
      const created = mutations.createEvent(
        currentProject,
        type,
        snappedPosition,
        branchId,
      );
      const targetEventId =
        created.selection?.type === "node"
          ? created.selection.id
          : created.project.events.find(
              (event) =>
                !currentProject.events.some(
                  (previousEvent) => previousEvent.id === event.id,
                ),
            )?.id;

      if (!targetEventId || created.project === currentProject) {
        setMessage(created.message ?? "Could not create a connected event.");
        return;
      }

      let nextProject = created.project;
      const sequenceId = activeSequenceId(nextProject);

      if (sourceKind === "start") {
        const sourceSequenceId =
          typeof sourceNode.data.details?.sequenceId === "string"
            ? sourceNode.data.details.sequenceId
            : nodeStoryId(sourceNode);
        if (!sourceSequenceId) {
          setMessage("Start node source could not be resolved.");
          return;
        }
        nextProject = {
          ...nextProject,
          sequences: nextProject.sequences.map((sequence) =>
            sequence.id === sourceSequenceId
              ? {
                  ...sequence,
                  entryEventId: targetEventId,
                  eventIds: withValue(sequence.eventIds, targetEventId),
                }
              : sequence,
          ),
        };
        commitCanvasAction("Created connected event", {
          project: nextProject,
          selection: {
            type: "edge",
            id: `edge:entry:${sourceNode.id}:${targetEventId}`,
          },
          message: "Created connected event.",
        });
        return;
      }

      if (sourceKind === "branch") {
        if (!branchId || !sequenceId) {
          setMessage("Branch connection could not be resolved.");
          return;
        }
        nextProject = {
          ...nextProject,
          sequences: nextProject.sequences.map((sequence) =>
            sequence.id === sequenceId
              ? {
                  ...sequence,
                  eventIds: withValue(sequence.eventIds, targetEventId),
                  branchIds: withValue(sequence.branchIds, branchId),
                }
              : sequence,
          ),
          branches: nextProject.branches.map((branch) =>
            branch.id === branchId
              ? {
                  ...branch,
                  eventIds: withValue(branch.eventIds, targetEventId),
                }
              : branch,
          ),
          events: nextProject.events.map((event) =>
            event.id === targetEventId
              ? { ...event, branchRef: branchId }
              : event,
          ),
        };
        commitCanvasAction("Created event in branch", {
          project: nextProject,
          selection: { type: "node", id: targetEventId },
          message: "Created event in branch.",
        });
        return;
      }

      const sourceEventId = ownerEventIdForNode(sourceNode);
      const sourceEvent = sourceEventId
        ? findEvent(nextProject, sourceEventId)
        : undefined;
      if (!sourceEventId || !sourceEvent) {
        setMessage("Only events and outcomes can create runtime transitions.");
        return;
      }

      if (mutations.isTerminalEventType(nextProject, sourceEvent.type)) {
        setMessage("Terminal events cannot create outgoing transitions.");
        return;
      }

      const routeSourceId =
        sourceKind === "routeGate" &&
        typeof sourceNode.data.details?.routeSourceId === "string"
          ? sourceNode.data.details.routeSourceId
          : sourceHandleId ?? sourceNode.id;
      const transitionId = transitionFrom(routeSourceId, targetEventId, sourceEvent.transitions);
      const transition: Transition = {
        id: transitionId,
        from: routeSourceId === sourceNode.id ? sourceEventId : routeSourceId,
        to: targetEventId,
        role: "flow",
        source: "graph",
      };

      nextProject = {
        ...nextProject,
        sequences: sequenceId
          ? nextProject.sequences.map((sequence) =>
              sequence.id === sequenceId
                ? {
                    ...sequence,
                    eventIds: withValue(sequence.eventIds, targetEventId),
                  }
                : sequence,
            )
          : nextProject.sequences,
        events: nextProject.events.map((event) =>
          event.id === sourceEventId
            ? {
                ...event,
                transitions: mutations.normalizeTransitionRoles(
                  [...(event.transitions ?? []), transition],
                  nextProject,
                ),
              }
            : event,
        ),
      };

      commitCanvasAction("Created connected event", {
        project: nextProject,
        selection: { type: "edge", id: `edge:transition:${transitionId}` },
        message: "Created connected event.",
      });
    },
    [commitCanvasAction, nodes],
  );

  const createSequenceCharacter = useCallback(
    (sequenceId: string, name: string) => {
      const currentProject = projectRef.current;
      const trimmedName = name.trim();
      const sequence = currentProject?.sequences.find((candidate) => candidate.id === sequenceId);
      if (!currentProject || !sequence || !trimmedName) return;

      const existingIds = new Set([
        ...currentProject.canonRefs.map((ref) => ref.id),
        ...(currentProject.localExplorerEntities ?? []).map((entity) => entity.id),
      ]);
      const baseEntity = createLocalExplorerEntity("character", trimmedName);
      let entity = baseEntity;
      let suffix = 2;
      while (existingIds.has(entity.id)) {
        entity = { ...baseEntity, id: `${baseEntity.id}-${suffix}` };
        suffix += 1;
      }

      const characterRefs = sequence.characterRefs ?? (sequence.characterRef ? [sequence.characterRef] : []);
      const updatedProject = mutations.updateSequence(currentProject, sequenceId, {
        characterRefs: [...characterRefs, entity.id],
        characterRef: undefined,
      }).project;
      const es = uiLocaleRef.current === "es";
      void commitStructuralAction(es ? "Creado personaje local para la secuencia" : "Created local sequence character", {
        project: {
          ...updatedProject,
          localExplorerEntities: [...(currentProject.localExplorerEntities ?? []), entity],
        },
        message: es ? "Personaje creado y añadido a Actores." : "Character created and added to Actors.",
      });
    },
    [commitStructuralAction],
  );

  const updateSequence = useCallback(
    (id: string, updates: Partial<Sequence>) => {
      if (!project) {
        return;
      }
      runCanvasMutation(mutations.updateSequence(project, id, updates));
    },
    [project, runCanvasMutation],
  );

  const updateBranch = useCallback(
    (id: string, updates: Partial<Branch>) => {
      if (!project) {
        return;
      }
      runCanvasMutation(mutations.updateBranch(project, id, updates));
    },
    [project, runCanvasMutation],
  );

  const assignEventBranch = useCallback(
    (eventId: string, branchId?: string) => {
      if (!project) {
        return;
      }
      runCanvasMutation(
        { project: assignEventToBranch(project, eventId, branchId) },
        "Updated event branch",
      );
    },
    [project, runCanvasMutation],
  );

  const updateEvent = useCallback(
    (id: string, updates: Partial<EventNode>) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === id) {
        mutateEventDraft((draftProject) =>
          mutations.updateEvent(draftProject, id, updates),
        );
        return;
      }
      runCanvasMutation(mutations.updateEvent(currentProject, id, updates));
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const applyEvpath = useCallback(
    (eventId: string, text: string): EvpathApplyOutcome => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return { errors: [{ line: 1, message: "No hay un proyecto abierto." }], warnings: [] };
      }
      const result = applyEvpathToEvent(currentProject, eventId, text);
      if (!result.errors.length && result.changed) {
        runCanvasMutation(
          { project: result.project, message: result.message },
          "Applied Path edit",
        );
      }
      return { errors: result.errors, warnings: result.warnings };
    },
    [runCanvasMutation],
  );

  const createDecision = useCallback(
    (eventId: string, dialogueId?: string, position?: CanvasPoint) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        const draftProject = applyEventDraftToProject(currentProject, eventDraft);
        setEventDraft(undefined);
        runCanvasMutation(
          positionMutationNode(
            mutations.createDecision(draftProject, eventId, dialogueId),
            position,
            activeScope,
          ),
          "Created decision",
        );
        return;
      }
      runCanvasMutation(
        positionMutationNode(
          mutations.createDecision(currentProject, eventId, dialogueId),
          position,
          activeScope,
        ),
        "Created decision",
      );
    },
    [activeScope, eventDraft, runCanvasMutation],
  );

  const createDialogue = useCallback(
    (eventId: string, position?: CanvasPoint) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      const sourceProject =
        eventDraft?.eventId === eventId
          ? applyEventDraftToProject(currentProject, eventDraft)
          : currentProject;
      const event = findEvent(sourceProject, eventId);
      if (!event) return;
      setNameDialog({
        kind: "createDialogue",
        title: uiLocaleRef.current === "es" ? "Crear conversación" : "Create conversation",
        label: uiLocaleRef.current === "es" ? "Nombre de la conversación" : "Conversation name",
        initialValue: automaticNarrativeName(
          sourceProject,
          eventId,
          "Conversation",
                  ),
        eventId,
        position,
      });
    },
    [eventDraft],
  );

  const updateDecision = useCallback(
    (eventId: string, decisionId: string, updates: Partial<Decision>) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.updateDecision(draftProject, eventId, decisionId, updates),
        );
        return;
      }
      runCanvasMutation(
        mutations.updateDecision(currentProject, eventId, decisionId, updates),
      );
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const updateDialogue = useCallback(
    (eventId: string, dialogueId: string, updates: Partial<DialogueNode>) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.updateDialogue(draftProject, eventId, dialogueId, updates),
        );
        return;
      }
      runCanvasMutation(
        mutations.updateDialogue(currentProject, eventId, dialogueId, updates),
      );
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const createDialogueBeat = useCallback(
    (eventId: string, dialogueId: string, kind: DialogueBeat["kind"], position?: CanvasPoint) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const sourceProject =
        eventDraft?.eventId === eventId
          ? applyEventDraftToProject(currentProject, eventDraft)
          : currentProject;
      if (eventDraft?.eventId === eventId) setEventDraft(undefined);
      runCanvasMutation(
        positionMutationNode(
          mutations.createDialogueBeat(sourceProject, eventId, dialogueId, kind),
          position,
          activeScope,
        ),
        "Created dialogue beat",
      );
    },
    [activeScope, eventDraft, runCanvasMutation],
  );

  const createEventDialogueBeat = useCallback(
    (eventId: string, kind: DialogueBeat["kind"], position?: CanvasPoint) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const sourceProject = eventDraft?.eventId === eventId
        ? applyEventDraftToProject(currentProject, eventDraft)
        : currentProject;
      if (eventDraft?.eventId === eventId) setEventDraft(undefined);
      runCanvasMutation(
        positionMutationNode(
          mutations.createEventDialogueBeat(sourceProject, eventId, kind),
          position,
          activeScope,
        ),
        "Created dialogue beat",
      );
    },
    [activeScope, eventDraft, runCanvasMutation],
  );

  const updateDialogueBeat = useCallback(
    (eventId: string, dialogueId: string, beatId: string, updates: Partial<DialogueBeat>) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      runCanvasMutation(mutations.updateDialogueBeat(currentProject, eventId, dialogueId, beatId, updates));
    },
    [runCanvasMutation],
  );

  const updateEventDialogueBeat = useCallback(
    (eventId: string, beatId: string, updates: Partial<DialogueBeat>) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      runCanvasMutation(mutations.updateEventDialogueBeat(currentProject, eventId, beatId, updates));
    },
    [runCanvasMutation],
  );

  const updateScriptBlock = useCallback(
    (scriptId: string, blockId: string, updates: Partial<ScriptBlock>) => {
      if (!project) return;
      runMutation(mutations.updateScriptBlock(project, scriptId, blockId, updates));
    },
    [project, runMutation],
  );

  const updateCharacterCategories = useCallback((categories: string[]) => {
    const mappingId = "pathbranching:additional-characters";
    const selection = selectionRef.current;
    if (selection?.type !== "explorerProperty") return;
    updateManualInspectorDraft(selection, (project) => {
      const mappings = project.integrationConfigOverride?.mappings ?? [];
      const nextMappings = categories.length
        ? [
            ...mappings.filter((mapping) => mapping.id !== mappingId),
            {
              id: mappingId,
              classId: "class:Speaker",
              worldnotionTypes: categories,
              roles: ["speaker", "presentation"],
            },
          ]
        : mappings.filter((mapping) => mapping.id !== mappingId);
      return {
        ...project,
        integrationConfigOverride: { ...project.integrationConfigOverride, specVersion: project.integrationConfigOverride?.specVersion ?? "0.1", mappings: nextMappings },
      };
    }, [mappingId]);
  }, [updateManualInspectorDraft]);

  // Script blocks edited through Assets are content assets and save immediately.
  // The same blocks edited from a canvas Speech Beat belong to that canvas edit
  // session and wait for the explicit Save Canvas action.
  const updateCanvasScriptBlock = useCallback(
    (scriptId: string, blockId: string, updates: Partial<ScriptBlock>) => {
      if (!project) return;
      runCanvasMutation(
        mutations.updateScriptBlock(project, scriptId, blockId, updates),
        "Updated speech beat",
      );
    },
    [project, runCanvasMutation],
  );

  const createCanvasLocalSpeaker = useCallback(
    (eventId: string, scriptId: string, blockId: string, name: string) => {
      const currentProject = projectRef.current;
      const trimmedName = name.trim();
      const event = currentProject?.events.find((candidate) => candidate.id === eventId);
      if (!currentProject || !event || !trimmedName) return;

      const existingIds = new Set([
        ...currentProject.canonRefs.map((ref) => ref.id),
        ...(currentProject.localExplorerEntities ?? []).map((entity) => entity.id),
      ]);
      const baseEntity = createLocalExplorerEntity("character", trimmedName);
      let entity = baseEntity;
      let suffix = 2;
      while (existingIds.has(entity.id)) {
        entity = { ...baseEntity, id: `${baseEntity.id}-${suffix}` };
        suffix += 1;
      }

      const presentEntityRefs = event.presentEntityRefs ?? event.canonRefs ?? [];
      void commitStructuralAction("Created local character from speech beat", {
        project: {
          ...currentProject,
          localExplorerEntities: [
            ...(currentProject.localExplorerEntities ?? []),
            entity,
          ],
          scriptDocuments: (currentProject.scriptDocuments ?? []).map((document) =>
            document.id === scriptId
              ? {
                  ...document,
                  blocks: document.blocks.map((block) =>
                    block.id === blockId
                      ? { ...block, characterRef: entity.id, characterVariantId: undefined }
                      : block,
                  ),
                }
              : document,
          ),
          events: currentProject.events.map((candidate) =>
            candidate.id === eventId
              ? {
                  ...candidate,
                  presentEntityRefs: presentEntityRefs.includes(entity.id)
                    ? presentEntityRefs
                    : [...presentEntityRefs, entity.id],
                }
              : candidate,
          ),
        },
      });
    },
    [commitStructuralAction],
  );

  const updateCanvasLocalizedText = useCallback(
    (textKey: string, locale: string, value: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const primaryLocale = fileStateRef.current.universeProfile?.localization?.primaryLocale ?? machineLocale();
      runCanvasMutation({
        project: updateLocalizedEntry(currentProject, textKey, locale, value, primaryLocale),
      });
    },
    [runCanvasMutation],
  );

  const createScriptDocument = useCallback(() => {
    if (!project) return;
    runMutation(mutations.createScriptDocument(project));
  }, [project, runMutation]);

  const updateScriptDocument = useCallback((scriptId: string, updates: { name?: string }) => {
    if (!project) return;
    runMutation(mutations.updateScriptDocument(project, scriptId, updates));
  }, [project, runMutation]);

  const createScriptBlock = useCallback((scriptId: string, kind: ScriptBlock["kind"]) => {
    if (!project) return;
    runMutation(mutations.createScriptBlock(project, scriptId, kind));
  }, [project, runMutation]);

  const insertScriptBlock = useCallback((scriptId: string, blockId: string, eventId: string, dialogueId: string) => {
    if (!project) return;
    runMutation(mutations.linkScriptBlockToDialogue(project, scriptId, blockId, eventId, dialogueId));
  }, [project, runMutation]);

  const deleteDialogueBeat = useCallback(
    (eventId: string, dialogueId: string, beatId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      closeDeletedNodeInspector(`beat:${eventId}:${beatId}`);
      runCanvasMutation(mutations.deleteDialogueBeat(currentProject, eventId, dialogueId, beatId));
    },
    [closeDeletedNodeInspector, runCanvasMutation],
  );

  const deleteEventDialogueBeat = useCallback(
    (eventId: string, beatId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      closeDeletedNodeInspector(`beat:${eventId}:${beatId}`);
      runCanvasMutation(mutations.deleteEventDialogueBeat(currentProject, eventId, beatId));
    },
    [closeDeletedNodeInspector, runCanvasMutation],
  );

  const deleteDecision = useCallback(
    (eventId: string, decisionId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        closeDeletedNodeInspector(`decision:${eventId}:${decisionId}`);
        mutateEventDraft((draftProject) =>
          mutations.deleteDecision(draftProject, eventId, decisionId),
        );
        return;
      }
      closeDeletedNodeInspector(`decision:${eventId}:${decisionId}`);
      runCanvasMutation(mutations.deleteDecision(currentProject, eventId, decisionId));
    },
    [closeDeletedNodeInspector, eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const deleteDialogue = useCallback(
    (eventId: string, dialogueId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        closeDeletedNodeInspector(`dialogue:${eventId}:${dialogueId}`);
        mutateEventDraft((draftProject) =>
          mutations.deleteDialogue(draftProject, eventId, dialogueId),
        );
        return;
      }
      closeDeletedNodeInspector(`dialogue:${eventId}:${dialogueId}`);
      runCanvasMutation(mutations.deleteDialogue(currentProject, eventId, dialogueId));
    },
    [closeDeletedNodeInspector, eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const createOutcome = useCallback(
    (eventId: string, decisionId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.createOutcome(draftProject, eventId, decisionId),
        );
        return;
      }
      runCanvasMutation(mutations.createOutcome(currentProject, eventId, decisionId));
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const updateOutcome = useCallback(
    (
      eventId: string,
      decisionId: string,
      outcomeId: string,
      updates: Partial<Outcome>,
    ) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.updateOutcome(
            draftProject,
            eventId,
            decisionId,
            outcomeId,
            updates,
          ),
        );
        return;
      }
      runCanvasMutation(
        mutations.updateOutcome(
          currentProject,
          eventId,
          decisionId,
          outcomeId,
          updates,
        ),
      );
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const deleteOutcome = useCallback(
    (eventId: string, decisionId: string, outcomeId: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }
      if (eventDraft?.eventId === eventId) {
        mutateEventDraft((draftProject) =>
          mutations.deleteOutcome(draftProject, eventId, decisionId, outcomeId),
        );
        return;
      }
      runCanvasMutation(
        mutations.deleteOutcome(currentProject, eventId, decisionId, outcomeId),
      );
    },
    [eventDraft?.eventId, mutateEventDraft, runCanvasMutation],
  );

  const updateTransition = useCallback(
    (transitionId: string, updates: Partial<Transition>) => {
      if (!project) {
        return;
      }
      if (
        eventDraft?.draftEvent.transitions?.some(
          (transition) => transition.id === transitionId,
        )
      ) {
        mutateEventDraft((draftProject) =>
          mutations.updateTransition(draftProject, transitionId, updates),
        );
        return;
      }
      runCanvasMutation(mutations.updateTransition(project, transitionId, updates));
    },
    [
      eventDraft?.draftEvent.transitions,
      mutateEventDraft,
      project,
      runCanvasMutation,
    ],
  );

  const deleteTransition = useCallback(
    (transitionId: string) => {
      if (!project) {
        return;
      }
      if (
        eventDraft?.draftEvent.transitions?.some(
          (transition) => transition.id === transitionId,
        )
      ) {
        mutateEventDraft((draftProject) =>
          mutations.deleteTransition(draftProject, transitionId),
        );
        closeDeletedInspectorSelection({ type: "edge", id: `edge:transition:${transitionId}` });
        return;
      }
      runCanvasMutation(mutations.deleteTransition(project, transitionId));
      closeDeletedInspectorSelection({ type: "edge", id: `edge:transition:${transitionId}` });
    },
    [
      closeDeletedInspectorSelection,
      eventDraft?.draftEvent.transitions,
      mutateEventDraft,
      project,
      runCanvasMutation,
    ],
  );

  const removeMissingEventReference = useCallback(
    (ownerId: string, missingEventId: string) => {
      if (!project) {
        return;
      }
      runCanvasMutation(
        mutations.removeMissingEventReference(project, ownerId, missingEventId),
      );
    },
    [project, runCanvasMutation],
  );

  const removeBoundaryBinding = useCallback(
    (bindingId: string) => {
      if (!project) {
        return;
      }
      runCanvasMutation(mutations.removeBoundaryBinding(project, bindingId));
    },
    [project, runCanvasMutation],
  );

  const normalizeTransitionOrder = useCallback(
    (sourceId: string) => {
      if (!project) return;
      runCanvasMutation(mutations.normalizeTransitionOrder(project, sourceId));
    },
    [project, runCanvasMutation],
  );

  const deleteScriptBlock = useCallback(
    (blockKey: string) => {
      if (!project) return;
      runMutation(mutations.deleteScriptBlock(project, blockKey));
    },
    [project, runMutation],
  );

  const deleteBoundaryEdge = useCallback(
    (edgeId: string) => {
      if (edgeId.startsWith("edge:entry:")) {
        const entryParts = edgeId.replace("edge:entry:start:", "").split(":");
        const sequenceId = entryParts.shift();
        const eventId = entryParts.join(":");
        const currentProject = projectRef.current;
        if (!currentProject || !sequenceId || !eventId) return;
        const sequence = currentProject.sequences.find((item) => item.id === sequenceId);
        if (!sequence || sequence.entryEventId !== eventId) return;
        const fallbackEntry = sequence.eventIds.find((candidate) => candidate !== eventId) ?? "";
        runCanvasMutation({
          project: {
            ...currentProject,
            sequences: currentProject.sequences.map((item) =>
              item.id === sequenceId ? { ...item, entryEventId: fallbackEntry } : item,
            ),
          },
        });
        closeDeletedInspectorSelection({ type: "edge", id: edgeId });
        return;
      }
      if (edgeId.startsWith("edge:boundary:")) {
        removeBoundaryBinding(edgeId.replace("edge:boundary:", ""));
        closeDeletedInspectorSelection({ type: "edge", id: edgeId });
        return;
      }
      if (!edgeId.startsWith("edge:dialogue-entry:") || activeScope?.kind !== "dialogue") {
        return;
      }
      const dialogueId = edgeId.replace("edge:dialogue-entry:", "");
      updateDialogue(activeScope.eventId, dialogueId, { entryBeatId: undefined });
      closeDeletedInspectorSelection({ type: "edge", id: edgeId });
    },
    [activeScope, closeDeletedInspectorSelection, removeBoundaryBinding, runCanvasMutation, updateDialogue],
  );

  const createCanonSuggestion = useCallback(
    (
      canonRefId: string,
      source?: { eventId?: string; dataObjectId?: string },
    ) => {
      if (!project) {
        return;
      }
      runMutation(
        mutations.createCanonEditSuggestion(project, canonRefId, source),
      );
    },
    [project, runMutation],
  );

  const updateCanonSuggestion = useCallback(
    (id: string, updates: Partial<CanonEditSuggestion>) => {
      if (!project) {
        return;
      }
      runMutation(mutations.updateCanonEditSuggestion(project, id, updates));
    },
    [project, runMutation],
  );

  const deleteCanonSuggestion = useCallback(
    (id: string) => {
      if (!project) {
        return;
      }
      runMutation(mutations.deleteCanonEditSuggestion(project, id));
      setSelection(undefined);
    },
    [project, runMutation],
  );

  const updateDataObject = useCallback(
    (id: string, updates: Partial<ProjectDataObject>) => {
      if (!project) {
        return;
      }
      runMutation(mutations.updateDataObject(project, id, updates));
    },
    [project, runMutation],
  );

  const updateEventCategories = useCallback(
    (eventCategories: EventCategoryDefinition[]) => {
      if (!project) {
        return;
      }
      void commitStructuralAction("Updated event categories", {
        ...project,
        eventCategories,
      });
    },
    [commitStructuralAction, project],
  );

  const updateSpeechBeatCounter = useCallback(
    (updates: Partial<SpeechBeatCounterPreference>) => {
      if (!project) {
        return;
      }
      const current =
        project.authoringPreferences?.speechBeatCounter ??
        DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE;
      const next: SpeechBeatCounterPreference = {
        enabled: updates.enabled ?? current.enabled,
        unit: updates.unit ?? current.unit,
        target:
          typeof updates.target === "number" && Number.isFinite(updates.target)
            ? Math.min(2000, Math.max(1, Math.round(updates.target)))
            : current.target,
      };
      void commitStructuralAction("Updated speech beat counter", {
        ...project,
        authoringPreferences: {
          ...project.authoringPreferences,
          speechBeatCounter: next,
        },
      });
    },
    [commitStructuralAction, project],
  );


  const deleteDataObject = useCallback(
    (id: string) => {
      if (!project) {
        return;
      }
      runMutation(mutations.deleteDataObject(project, id));
    },
    [project, runMutation],
  );

  const changeSubcanvasWorkspace = useCallback(
    (
      scope: Extract<CanvasScope, { kind: "event" | "dialogue" }>,
      bounds: SubcanvasWorkspaceBounds,
      persist: boolean,
    ) => {
      setNodes((currentNodes) =>
        layoutSubcanvasNodes(
          currentNodes.map((node) =>
            node.data.kind === "workspace"
              ? {
                  ...node,
                  position: { x: bounds.x, y: bounds.y },
                  width: bounds.width,
                  height: bounds.height,
                  style: { ...node.style, width: bounds.width, height: bounds.height },
                }
              : node,
          ),
          { preserveWorkspace: true, gridSize: settingsRef.current.canvasBackground.gridSize },
        ),
      );
      if (!persist) return;

      const currentProject = projectRef.current;
      if (!currentProject) return;
      const scopeKey = canvasScopeKey(scope);
      commitCanvasAction("Resized subcanvas working area", {
        ...currentProject,
        canvas: {
          ...currentProject.canvas,
          scopes: {
            ...(currentProject.canvas?.scopes ?? {}),
            [scopeKey]: {
              ...(currentProject.canvas?.scopes?.[scopeKey] ?? {}),
              workspace: { ...bounds, manual: true },
            },
          },
        },
      });
    },
    [commitCanvasAction],
  );

  const arrangeScopeNodes = useCallback(
    (options: {
      mode: NestedLayoutMode;
      columns: number;
      horizontalGapCells: number;
      verticalGapCells: number;
      selectedNodeIds?: string[];
      automatic?: boolean;
    }) => {
      if (!activeScope || activeScope.kind === "sequence") return;
      const currentProject = projectRef.current;
      if (!currentProject) return;
      const gridSize = settingsRef.current.canvasBackground.gridSize;
      const positions = options.mode === "linear"
        ? nestedLinearLayoutPositions(
          nodes,
          edges,
          options.horizontalGapCells,
          gridSize,
          options.selectedNodeIds,
        )
        : nestedGridLayoutPositions(
          nodes,
          edges,
          options.columns,
          options.horizontalGapCells,
          options.verticalGapCells,
          gridSize,
          options.selectedNodeIds,
        );
      if (!positions.size) return;
      const positionedNodes = nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      });
      const bounds = fitSubcanvasWorkspaceBounds(positionedNodes, 2, gridSize);
      const nextNodes = positionedNodes.map((node) =>
        node.data.kind === "workspace"
          ? {
              ...node,
              position: { x: bounds.x, y: bounds.y },
              width: bounds.width,
              height: bounds.height,
              style: { ...node.style, width: bounds.width, height: bounds.height },
            }
          : node,
      );
      const positionedProject = updateProjectCanvas(currentProject, nextNodes, activeScope);
      const scopeKey = canvasScopeKey(activeScope);
      const arrangedProject = {
        ...positionedProject,
        canvas: {
          ...positionedProject.canvas,
          scopes: {
            ...(positionedProject.canvas?.scopes ?? {}),
            [scopeKey]: {
              ...(positionedProject.canvas?.scopes?.[scopeKey] ?? {}),
              workspace: { ...bounds, manual: true },
            },
          },
        },
      };
      const actionLabel = options.mode === "linear" ? "Organized nodes in a line" : "Organized nodes in grid";
      if (options.automatic) {
        void commitStructuralAction(actionLabel, arrangedProject, undefined, {
          recordUndo: false,
          recordRedo: false,
          recordActionHistory: false,
          showStatus: false,
        });
      } else {
        commitCanvasAction(actionLabel, arrangedProject);
      }
    },
    [activeScope, commitCanvasAction, commitStructuralAction, edges, nodes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<StoryCanvasNode>[]) => {
      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes);
        if (!requiresSubcanvasLayout(changes)) return nextNodes;
        return layoutSubcanvasNodes(nextNodes, {
          gridSize: settingsRef.current.canvasBackground.gridSize,
        });
      });
    },
    [],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<StoryCanvasEdge>[]) => {
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
    },
    [],
  );

  const handleConnect = useCallback<OnConnect>(
    (connection: Connection) => {
      if (!project || !connection.source || !connection.target) {
        return;
      }

      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const targetEventId =
        targetNode?.data.kind === "event" ? nodeStoryId(targetNode) : undefined;

      if (!sourceNode || !targetNode) {
        setMessage("Connection source or target could not be resolved.");
        return;
      }
      if (sourceNode.data.kind === 'interaction' && connection.sourceHandle?.startsWith('interaction-result:')) {
        const eventId = sourceNode.data.details?.eventId;
        const use = sourceNode.data.details?.interactionUse as { id: string } | undefined;
        if (typeof eventId !== 'string' || !use) return;
        try {
          updateProject(setInteractionResultRoute(project, eventId, use.id, connection.sourceHandle.slice('interaction-result:'.length), targetNode.data.details?.restart === true ? eventId : targetNode.id));
        } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
        return;
      }
      const decisionOutcomeSourceId =
        sourceNode.data.kind === "decision" && typeof connection.sourceHandle === "string"
          ? connection.sourceHandle
          : undefined;
      const routeSourceId =
        sourceNode.data.kind === "routeGate" &&
        typeof sourceNode.data.details?.routeSourceId === "string"
          ? sourceNode.data.details.routeSourceId
          : decisionOutcomeSourceId ?? sourceNode.id;

      const boundaryNode =
        sourceNode.data.kind === "boundary"
          ? sourceNode
          : targetNode.data.kind === "boundary"
            ? targetNode
            : undefined;
      if (activeScope?.kind === "dialogue" && boundaryNode) {
        const dialogue = project.events
          .find((event) => event.id === activeScope.eventId)
          ?.dialogues?.find((item) => item.id === activeScope.id);
        if (!dialogue) return;
        const direction = boundaryNode.data.details?.direction === "output" ? "output" : "input";
        const internalNode = boundaryNode.id === sourceNode.id ? targetNode : sourceNode;
        if (direction === "input") {
          const beat = internalNode.data.details?.beat as { id?: string } | undefined;
          if (boundaryNode.id !== sourceNode.id || !beat?.id) {
            setMessage("Dialogue entry must connect from Entry into a speech or direction beat.");
            return;
          }
          updateDialogue(activeScope.eventId, activeScope.id, { entryBeatId: beat.id });
          return;
        }
        if (boundaryNode.id !== targetNode.id) {
          setMessage("Dialogue exits connect from an internal node into Exit.");
          return;
        }
      }
      if (activeScope?.kind === "event" && boundaryNode) {
        const internalNode =
          boundaryNode.id === sourceNode.id ? targetNode : sourceNode;
        const direction =
          boundaryNode.data.details?.direction === "output"
            ? "output"
            : "input";
        if (direction === "input" && boundaryNode.id !== sourceNode.id) {
          setMessage(
            "Input ports connect from the boundary into an internal node.",
          );
          return;
        }
        if (direction === "output" && boundaryNode.id !== targetNode.id) {
          setMessage(
            "Output ports connect from an internal node into the boundary.",
          );
          return;
        }
        const route = mutations.createInternalTransition(
          project,
          activeScope.id,
          decisionOutcomeSourceId ??
            (sourceNode.data.kind === "routeGate" ? routeSourceId : sourceNode.id),
          targetNode.data.details?.restart === true ? activeScope.id : targetNode.id,
        );
        updateProject(route.project, route.selection);
        return;
      }

      if (activeScope?.kind === "event" || activeScope?.kind === "dialogue") {
        if (sourceNode.data.kind === "decision" && !decisionOutcomeSourceId) {
          setMessage("Connect from an outcome port (A, B, C…) on the Decision.");
          return;
        }
        const ownerEventId =
          activeScope.kind === "dialogue"
            ? activeScope.eventId
            : activeScope.id;
        const ownerEvent = findEvent(project, ownerEventId);
        if (!ownerEvent) return;
        const transitionId = transitionFrom(routeSourceId, targetNode.id, ownerEvent.transitions);
        const siblingCount = (ownerEvent.transitions ?? []).filter((item) => item.from === routeSourceId).length;
        const transition: Transition = {
          id: transitionId,
          from: routeSourceId,
          to: targetNode.id,
          order: siblingCount,
          mode: "conditional",
          role: "flow",
          source: "graph",
        };
        updateProject(
          {
            ...project,
            events: project.events.map((event) =>
              event.id === ownerEventId
                ? {
                    ...event,
                    transitions: mutations.normalizeTransitionRoles(
                      [...(event.transitions ?? []), transition],
                      project,
                    ),
                  }
                : event,
            ),
          },
          { type: "edge", id: `edge:transition:${transitionId}` },
        );
        return;
      }

      if (!targetEventId) {
        setMessage("Connections must target an event in this MVP.");
        return;
      }

      const sequenceId = activeSequenceId(project);
      const sourceKind = sourceNode.data.kind;

      if (sourceKind === "start") {
        const sourceSequenceId =
          typeof sourceNode.data.details?.sequenceId === "string"
            ? sourceNode.data.details.sequenceId
            : nodeStoryId(sourceNode);
        if (!sourceSequenceId) {
          setMessage("Start node source could not be resolved.");
          return;
        }
        updateProject(
          {
            ...project,
            sequences: project.sequences.map((sequence) =>
              sequence.id === sourceSequenceId
                ? {
                    ...sequence,
                    entryEventId: targetEventId,
                    eventIds: withValue(sequence.eventIds, targetEventId),
                  }
                : sequence,
            ),
          },
          { type: "node", id: targetEventId },
        );
        return;
      }

      if (sourceKind === "branch") {
        const branchId = nodeStoryId(sourceNode);
        if (!branchId || !sequenceId) {
          setMessage("Branch connection could not be resolved.");
          return;
        }
        updateProject(
          {
            ...project,
            sequences: project.sequences.map((sequence) =>
              sequence.id === sequenceId
                ? {
                    ...sequence,
                    eventIds: withValue(sequence.eventIds, targetEventId),
                    branchIds: withValue(sequence.branchIds, branchId),
                  }
                : sequence,
            ),
            branches: project.branches.map((branch) =>
              branch.id === branchId
                ? {
                    ...branch,
                    eventIds: withValue(branch.eventIds, targetEventId),
                  }
                : branch,
            ),
            events: project.events.map((event) =>
              event.id === targetEventId
                ? { ...event, branchRef: branchId }
                : event,
            ),
          },
          { type: "node", id: targetEventId },
        );
        return;
      }

      const sourceEventId = ownerEventIdForNode(sourceNode);
      const sourceEvent = sourceEventId
        ? findEvent(project, sourceEventId)
        : undefined;
      if (!sourceEventId || !sourceEvent) {
        setMessage("Only events and outcomes can create runtime transitions.");
        return;
      }

      if (mutations.isTerminalEventType(project, sourceEvent.type)) {
        setMessage("Terminal events cannot create outgoing transitions.");
        return;
      }

      const transitionId = transitionFrom(routeSourceId, targetEventId, sourceEvent.transitions);
      const transition: Transition = {
        id: transitionId,
        from: decisionOutcomeSourceId ?? (sourceNode.data.kind === "outcome" ? sourceNode.id : sourceEventId),
        to: targetEventId,
        role: "flow",
        source: "graph",
      };

      updateProject(
        {
          ...project,
          sequences: sequenceId
            ? project.sequences.map((sequence) =>
                sequence.id === sequenceId
                  ? {
                      ...sequence,
                      eventIds: withValue(sequence.eventIds, targetEventId),
                    }
                  : sequence,
              )
            : project.sequences,
          events: project.events.map((event) =>
            event.id === sourceEventId
              ? {
                  ...event,
                  transitions: mutations.normalizeTransitionRoles(
                    [...(event.transitions ?? []), transition],
                    project,
                  ),
                }
              : event,
          ),
        },
        { type: "edge", id: `edge:transition:${transitionId}` },
      );
    },
    [activeScope, nodes, project, updateDialogue, updateProject],
  );

  const handleNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent | ReactMouseEvent, node: StoryCanvasNode) => {
      const currentProject = projectRef.current;
      if (!currentProject) {
        return;
      }

      if (node.data.kind === "boundary") {
        if (activeScope?.kind !== "event" && activeScope?.kind !== "dialogue") return;
        const workspace = nodes.find((item) => item.data.kind === "workspace");
        if (!workspace) return;
        const snap = settingsRef.current.canvasBackground;
        const nextNode = {
          ...node,
          position: snapCanvasPoint(
            node.position,
            snap.snapToGrid,
            snap.gridSize,
          ),
        };
        const nextNodes = layoutSubcanvasNodes(
          nodes.map((item) => item.id === node.id ? nextNode : item),
          { gridSize: snap.gridSize },
        );
        const canvasProject = updateProjectCanvas(
          currentProject,
          nextNodes,
          activeScope,
        );
        commitCanvasAction("Moved subcanvas port", canvasProject, {
          type: "node",
          id: node.id,
        });
        return;
      }

      const storyId = nodeStoryId(node);
      if (!storyId) {
        return;
      }
      const snap = settingsRef.current.canvasBackground;
      const nextNode = {
        ...node,
        position: snapCanvasPoint(
          node.position,
          snap.snapToGrid,
          snap.gridSize,
        ),
      };
      const nextNodes = nodes.map((item) =>
        item.id === node.id ? nextNode : item,
      );
      const canvasProject = updateProjectCanvas(
        currentProject,
        nextNodes,
        activeScope,
        node.data.kind === "routeGate" ? node.id : undefined,
      );
      commitCanvasAction("Moved node", canvasProject, {
        type: "node",
        id: node.id,
      });
    },
    [activeScope, commitCanvasAction, nodes],
  );

  const updateEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      if (!project) {
        return;
      }
      const entryEdge = edges.find(
        (edgeItem) => edgeItem.id === edgeId && edgeItem.data?.kind === "entry",
      );
      if (entryEdge) {
        const sequenceId = entryEdge.source.startsWith("start:")
          ? entryEdge.source.slice("start:".length)
          : undefined;
        if (sequenceId && project.sequences.some((sequence) => sequence.id === sequenceId)) {
          updateProject({
            ...project,
            sequences: project.sequences.map((sequence) =>
              sequence.id === sequenceId ? { ...sequence, entryLabel: label } : sequence,
            ),
          });
          return;
        }
      }
      const transitionId = edgeId.startsWith("edge:transition:")
        ? edgeId.replace("edge:transition:", "")
        : undefined;
      if (!transitionId) {
        setEdges((currentEdges) =>
          currentEdges.map((edgeItem) =>
            edgeItem.id === edgeId
              ? {
                  ...edgeItem,
                  label,
                  data: edgeItem.data
                    ? { ...edgeItem.data, label }
                    : edgeItem.data,
                }
              : edgeItem,
          ),
        );
        return;
      }
      if (
        eventDraft?.draftEvent.transitions?.some(
          (transition) => transition.id === transitionId,
        )
      ) {
        mutateEventDraft((draftProject) =>
          mutations.updateTransition(draftProject, transitionId, { label }),
        );
        return;
      }
      updateProject({
        ...project,
        events: project.events.map((event) => ({
          ...event,
          transitions: event.transitions?.map((transition) =>
            transition.id === transitionId
              ? { ...transition, label }
              : transition,
          ),
        })),
      });
    },
    [
      edges,
      eventDraft?.draftEvent.transitions,
      mutateEventDraft,
      project,
      updateProject,
    ],
  );

  const resetLayout = useCallback(() => {
    if (!project) {
      return;
    }
    const layoutProject = applyCanvasLayoutToProject(
      project,
      settings.canvasLayout,
      {
        snapToGrid: settings.canvasBackground.snapToGrid,
        gridSize: settings.canvasBackground.gridSize,
      },
    );
    commitCanvasAction(
      `Applied ${settings.canvasLayout} layout`,
      layoutProject,
    );
  }, [
    commitCanvasAction,
    project,
    settings.canvasBackground.gridSize,
    settings.canvasBackground.snapToGrid,
    settings.canvasLayout,
  ]);

  const applyCanvasLayout = useCallback(
    (mode: CanvasLayoutMode) => {
      const normalizedMode = normalizeCanvasLayoutMode(mode);
      setSettings((current) => ({ ...current, canvasLayout: normalizedMode }));
      if (!project) {
        return;
      }
      const layoutProject = applyCanvasLayoutToProject(
        project,
        normalizedMode,
        {
          snapToGrid: settings.canvasBackground.snapToGrid,
          gridSize: settings.canvasBackground.gridSize,
        },
      );
      commitCanvasAction(
        `Applied ${normalizedMode} layout`,
        layoutProject,
      );
    },
    [
      commitCanvasAction,
      project,
      settings.canvasBackground.gridSize,
      settings.canvasBackground.snapToGrid,
    ],
  );

  const deleteSelection = useCallback(
    (targetSelection: Selection) => {
      const currentProject = projectRef.current;
      if (!project || !currentProject || targetSelection.type !== "node") {
        return;
      }

      const id = targetSelection.id;
      const selectedNode = nodes.find((node) => node.id === id);
      if (selectedNode?.data.kind === "start" || selectedNode?.data.kind === "sequence" || selectedNode?.data.kind === "workspace") {
        setMessage("This canvas anchor is structural and cannot be deleted.");
        return;
      }
      if (selectedNode?.data.kind === "endAdder") {
        setMessage("Add End is an action control, not a stored node.");
        return;
      }
      if (selectedNode?.data.kind === "boundary") {
        const eventId = selectedNode.data.details?.eventId;
        const transitionId = selectedNode.data.details?.transitionId;
        if (typeof transitionId === "string") {
          deleteTransition(transitionId);
          return;
        }
        if (typeof eventId === "string") {
          const sequence = currentProject.sequences.find((item) => item.entryEventId === eventId);
          if (sequence) {
            const fallbackEntry = sequence.eventIds.find((candidate) => candidate !== eventId) ?? "";
            runCanvasMutation({
              project: {
                ...currentProject,
                sequences: currentProject.sequences.map((item) => item.id === sequence.id ? { ...item, entryEventId: fallbackEntry } : item),
              },
            });
            return;
          }
        }
        setMessage("This boundary has no stored dependency to delete.");
        return;
      }
      if (selectedNode?.data.kind === "routeGate") {
        const routeSourceId = selectedNode.data.details?.routeSourceId;
        const eventId = selectedNode.data.details?.eventId;
        if (typeof routeSourceId === "string" && typeof eventId === "string") {
          runCanvasMutation({ project: mutations.deleteRoutesFromSource(currentProject, eventId, routeSourceId) });
          closeDeletedNodeInspector(id);
          return;
        }
      }
      if (selectedNode?.data.kind === "inkSection" && typeof selectedNode.data.details?.eventId === "string") {
        const eventId = selectedNode.data.details.eventId;
        runCanvasMutation({
          project: {
            ...currentProject,
            events: currentProject.events.map((event) => event.id === eventId ? { ...event, script: undefined } : event),
          },
        });
        closeDeletedNodeInspector(id);
        return;
      }
      if (selectedNode?.data.kind === "runtimeAction") {
        const ownerId = selectedNode.data.details?.ownerId;
        const consequenceIndex = selectedNode.data.details?.consequenceIndex;
        if (typeof ownerId === "string" && typeof consequenceIndex === "number") {
          const ownerEvent = currentProject.events.find((event) => event.id === ownerId);
          if (ownerEvent) {
            runCanvasMutation({
              project: {
                ...currentProject,
                events: currentProject.events.map((event) => event.id === ownerId
                  ? { ...event, consequences: (event.consequences ?? []).filter((_, index) => index !== consequenceIndex) }
                  : event),
              },
            });
            closeDeletedNodeInspector(id);
            return;
          }
          const ownerOutcome = currentProject.events.flatMap((event) =>
            (event.decisions ?? []).flatMap((decision) => decision.outcomes.map((outcome) => ({ event, decision, outcome }))),
          ).find(({ event, decision, outcome }) => `outcome:${event.id}:${decision.id}:${outcome.id}` === ownerId);
          if (ownerOutcome) {
            runCanvasMutation({
              project: {
                ...currentProject,
                events: currentProject.events.map((event) => event.id === ownerOutcome.event.id
                  ? {
                      ...event,
                      decisions: (event.decisions ?? []).map((decision) => decision.id === ownerOutcome.decision.id
                        ? {
                            ...decision,
                            outcomes: decision.outcomes.map((outcome) => outcome.id === ownerOutcome.outcome.id
                              ? { ...outcome, consequences: (outcome.consequences ?? []).filter((_, index) => index !== consequenceIndex) }
                              : outcome),
                          }
                        : decision),
                    }
                  : event),
              },
            });
            closeDeletedNodeInspector(id);
            return;
          }
          const ownerBeat = currentProject.events.flatMap((event) => [
            ...(event.dialogueBeats ?? []).map((beat) => ({ event, dialogueId: undefined as string | undefined, beat })),
            ...(event.dialogues ?? []).flatMap((dialogue) =>
              (dialogue.beats ?? []).map((beat) => ({ event, dialogueId: dialogue.id, beat }))),
          ]).find(({ event, beat }) => `beat:${event.id}:${beat.id}` === ownerId);
          if (ownerBeat) {
            const filterBeat = (beat: DialogueBeat) =>
              beat.id === ownerBeat.beat.id
                ? { ...beat, consequences: (beat.consequences ?? []).filter((_, index) => index !== consequenceIndex) }
                : beat;
            runCanvasMutation({
              project: {
                ...currentProject,
                events: currentProject.events.map((event) => {
                  if (event.id !== ownerBeat.event.id) return event;
                  return ownerBeat.dialogueId === undefined
                    ? { ...event, dialogueBeats: (event.dialogueBeats ?? []).map(filterBeat) }
                    : {
                        ...event,
                        dialogues: (event.dialogues ?? []).map((dialogue) =>
                          dialogue.id === ownerBeat.dialogueId
                            ? { ...dialogue, beats: (dialogue.beats ?? []).map(filterBeat) }
                            : dialogue),
                      };
                }),
              },
            });
            closeDeletedNodeInspector(id);
            return;
          }
          const ownerDialogue = currentProject.events.flatMap((event) =>
            (event.dialogues ?? []).map((dialogue) => ({ event, dialogue })),
          ).find(({ event, dialogue }) => `dialogue:${event.id}:${dialogue.id}` === ownerId);
          if (ownerDialogue) {
            runCanvasMutation({
              project: {
                ...currentProject,
                events: currentProject.events.map((event) => event.id === ownerDialogue.event.id
                  ? {
                      ...event,
                      dialogues: (event.dialogues ?? []).map((dialogue) => dialogue.id === ownerDialogue.dialogue.id
                        ? { ...dialogue, consequences: (dialogue.consequences ?? []).filter((_, index) => index !== consequenceIndex) }
                        : dialogue),
                    }
                  : event),
              },
            });
            closeDeletedNodeInspector(id);
            return;
          }
        }
      }
      if (selectedNode?.data.kind === "interaction" && typeof selectedNode.data.details?.eventId === "string") {
        const eventId = selectedNode.data.details.eventId;
        const use = selectedNode.data.details.interactionUse as { id?: string } | undefined;
        if (use?.id) {
          try {
            const sourceProject = eventDraft?.eventId === eventId
              ? applyEventDraftToProject(currentProject, eventDraft)
              : currentProject;
            if (eventDraft?.eventId === eventId) setEventDraft(undefined);
            const nextProject = deleteInteractionUse(sourceProject, eventId, use.id);
            runCanvasMutation({ project: nextProject }, "Deleted interaction");
            closeDeletedNodeInspector(id);
            setSelection(undefined);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
          }
        }
        return;
      }
      if (selectedNode?.data.kind === "barrier" && typeof selectedNode.data.details?.eventId === "string") {
        const barrier = selectedNode.data.details.interactionBarrier as { id?: string } | undefined;
        if (barrier?.id) {
          try {
            const nextProject = deleteInteractionBarrier(currentProject, selectedNode.data.details.eventId, barrier.id);
            runCanvasMutation({ project: nextProject }, "Deleted interaction barrier");
            closeDeletedNodeInspector(id);
            setSelection(undefined);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
          }
        }
        return;
      }
      if (
        (selectedNode?.data.kind === "speechBeat" || selectedNode?.data.kind === "directionBeat") &&
        typeof selectedNode.data.details?.eventId === "string"
      ) {
        const beat = selectedNode.data.details.beat as { id?: string } | undefined;
        const dialogueId = selectedNode.data.details?.dialogueId;
        if (beat?.id) {
          const eventId = selectedNode.data.details.eventId;
          runCanvasMutation(typeof dialogueId === "string"
            ? mutations.deleteDialogueBeat(currentProject, eventId, dialogueId, beat.id)
            : mutations.deleteEventDialogueBeat(currentProject, eventId, beat.id));
          closeDeletedNodeInspector(id);
          setSelection(undefined);
        }
        return;
      }
      if (selectedNode?.data.kind === "dialogueStart" && typeof selectedNode.data.details?.eventId === "string") {
        const start = selectedNode.data.details.start as { id?: string } | undefined;
        if (start?.id) {
          runCanvasMutation(mutations.deleteDialogueStart(currentProject, selectedNode.data.details.eventId, start.id));
          closeDeletedNodeInspector(id);
          setSelection(undefined);
        }
        return;
      }
      if (
        selectedNode?.data.kind === "dialogue" &&
        typeof selectedNode.data.details?.eventId === "string"
      ) {
        const dialogue = selectedNode.data.details.dialogue as
          { id?: string } | undefined;
        if (dialogue?.id) {
          runCanvasMutation(
            mutations.deleteDialogue(
              currentProject,
              selectedNode.data.details.eventId,
              dialogue.id,
            ),
          );
          closeDeletedNodeInspector(id);
          setSelection(undefined);
        }
        return;
      }
      if (
        selectedNode?.data.kind === "decision" &&
        typeof selectedNode.data.details?.eventId === "string"
      ) {
        const decision = selectedNode.data.details.decision as
          { id?: string } | undefined;
        if (decision?.id) {
          deleteDecision(selectedNode.data.details.eventId, decision.id);
          setSelection(undefined);
        }
        return;
      }
      if (
        selectedNode?.data.kind === "outcome" &&
        typeof selectedNode.data.details?.eventId === "string" &&
        typeof selectedNode.data.details?.decisionId === "string"
      ) {
        const outcome = selectedNode.data.details.outcome as { id?: string } | undefined;
        if (outcome?.id) {
          runCanvasMutation(mutations.deleteOutcome(
            currentProject,
            selectedNode.data.details.eventId,
            selectedNode.data.details.decisionId,
            outcome.id,
          ));
        }
        return;
      }
      if (selectedNode?.data.kind === "missingRef") {
        const ownerId = selectedNode.data.details?.ownerId;
        const missingEventId = selectedNode.data.details?.missingEventId;
        if (typeof ownerId === "string" && typeof missingEventId === "string") {
          runCanvasMutation(
            mutations.removeMissingEventReference(
              currentProject,
              ownerId,
              missingEventId,
            ),
          );
          closeDeletedNodeInspector(id);
          setSelection(undefined);
        }
        return;
      }
      if (selectedNode?.data.kind === "knowledge") {
        setMessage("Reference nodes are derived from story conditions and consequences.");
        return;
      }

      const sequence = findSequence(project, id);
      if (sequence) {
        if (
          project.entrySequenceId === sequence.id ||
          sequence.eventIds.length > 0
        ) {
          setMessage(
            "Sequence deletion is blocked while it is entry or still contains events.",
          );
          return;
        }
        const nextSequences = project.sequences.filter(
          (item) => item.id !== sequence.id,
        );
        updateProject(
          mutations.pruneDanglingNarrativeMetadata({
            ...project,
            sequences: nextSequences,
            canvas: {
              ...project.canvas,
              activeSequenceId:
                project.canvas?.activeSequenceId === sequence.id
                  ? nextSequences[0]?.id
                  : project.canvas?.activeSequenceId,
            },
          }),
          nextSequences[0]
            ? { type: "node", id: nextSequences[0].id }
            : undefined,
        );
        closeDeletedNodeInspector(id);
        return;
      }

      const branch = findBranch(project, id);
      if (branch) {
        updateProject(mutations.deleteBranch(project, branch.id).project, undefined);
        closeDeletedNodeInspector(id);
        setSelection(undefined);
        return;
      }

      const event = findEvent(project, id);
      if (event) {
        const entryOwner = project.sequences.find(
          (item) => item.entryEventId === event.id,
        );

        const removedTransitionIds = new Set(
          project.events.flatMap((item) =>
            (item.transitions ?? [])
              .filter(
                (transition) =>
                  transition.to === event.id || transition.from === event.id,
              )
              .map((transition) => transition.id),
          ),
        );

        updateProject(
          mutations.pruneDanglingNarrativeMetadata({
            ...project,
            sequences: project.sequences.map((item) => ({
              ...item,
              eventIds: withoutValue(item.eventIds, event.id),
              ...(item.id === entryOwner?.id
                ? { entryEventId: item.eventIds.find((candidate) => candidate !== event.id) ?? "" }
                : {}),
            })),
            branches: project.branches.map((item) => ({
              ...item,
              eventIds: withoutValue(item.eventIds, event.id),
            })),
            events: project.events
              .filter((item) => item.id !== event.id)
              .map((item) => {
                const withoutParentLink =
                  item.id === event.parentEventId
                    ? {
                        ...item,
                        childEventIds: withoutValue(
                          item.childEventIds,
                          event.id,
                        ),
                      }
                    : item.parentEventId === event.id
                      ? { ...item, parentEventId: undefined }
                      : item;
                return {
                  ...withoutParentLink,
                  transitions: (withoutParentLink.transitions ?? []).filter(
                    (transition) =>
                      transition.to !== event.id &&
                      transition.from !== event.id,
                  ),
                  boundaryBindings: (
                    withoutParentLink.boundaryBindings ?? []
                  ).filter(
                    (binding) =>
                      binding.nodeId !== event.id &&
                      !Array.from(removedTransitionIds).some((transitionId) =>
                        binding.portId.endsWith(`:${transitionId}`),
                      ),
                  ),
                };
              }),
          }),
          undefined,
        );
        closeDeletedNodeInspector(id);
        pruneEventInspectorEvents(currentProject.events.filter((item) => item.id !== event.id).map((item) => item.id));
        setSelection(undefined);
      }
    },
    [activeScope, closeDeletedNodeInspector, deleteDecision, deleteTransition, eventDraft, nodes, project, pruneEventInspectorEvents, runCanvasMutation, updateProject],
  );

  const deleteNodeSelections = useCallback(
    (nodeIds: string[]) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;

      const selectedIds = new Set(nodeIds);
      const selectedNodes = nodes.filter((node) => selectedIds.has(node.id));
      const draft = eventDraft && selectedNodes.some(
        (node) => node.data.details?.eventId === eventDraft.eventId,
      ) ? eventDraft : undefined;
      let nextProject = draft
        ? applyEventDraftToProject(currentProject, draft)
        : currentProject;
      if (draft) setEventDraft(undefined);
      let deletedCount = 0;
      let interactionDeletionError: unknown;
      const deletedInspectorNodeIds: string[] = [];

      for (const node of selectedNodes) {
        const eventId = node.data.details?.eventId;
        const dialogueId = node.data.details?.dialogueId;
        if (node.data.kind === "interaction" && typeof eventId === "string") {
          const use = node.data.details?.interactionUse as { id?: string } | undefined;
          if (use?.id) {
            try {
              nextProject = deleteInteractionUse(nextProject, eventId, use.id);
              deletedInspectorNodeIds.push(node.id);
              deletedCount += 1;
            } catch (error) {
              interactionDeletionError = error;
              break;
            }
          }
        } else if (node.data.kind === "barrier" && typeof eventId === "string") {
          const barrier = node.data.details?.interactionBarrier as { id?: string } | undefined;
          if (barrier?.id) {
            try {
              nextProject = deleteInteractionBarrier(nextProject, eventId, barrier.id);
              deletedInspectorNodeIds.push(node.id);
              deletedCount += 1;
            } catch (error) {
              interactionDeletionError = error;
              break;
            }
          }
        } else if (
          (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") &&
          typeof eventId === "string"
        ) {
          const beat = node.data.details?.beat as { id?: string } | undefined;
          if (beat?.id) {
            nextProject = (typeof dialogueId === "string"
              ? mutations.deleteDialogueBeat(nextProject, eventId, dialogueId, beat.id)
              : mutations.deleteEventDialogueBeat(nextProject, eventId, beat.id)).project;
            deletedInspectorNodeIds.push(node.id);
            deletedCount += 1;
          }
        } else if (node.data.kind === "dialogueStart" && typeof eventId === "string") {
          const start = node.data.details?.start as { id?: string } | undefined;
          if (start?.id) {
            nextProject = mutations.deleteDialogueStart(nextProject, eventId, start.id).project;
            deletedInspectorNodeIds.push(node.id);
            deletedCount += 1;
          }
        } else if (node.data.kind === "dialogue" && typeof eventId === "string") {
          const dialogue = node.data.details?.dialogue as { id?: string } | undefined;
          if (dialogue?.id) {
            nextProject = mutations.deleteDialogue(nextProject, eventId, dialogue.id).project;
            deletedInspectorNodeIds.push(node.id);
            deletedCount += 1;
          }
        } else if (node.data.kind === "decision" && typeof eventId === "string") {
          const decision = node.data.details?.decision as { id?: string } | undefined;
          if (decision?.id) {
            nextProject = mutations.deleteDecision(nextProject, eventId, decision.id).project;
            deletedInspectorNodeIds.push(node.id);
            deletedCount += 1;
          }
        } else if (node.data.kind === "missingRef") {
          const ownerId = node.data.details?.ownerId;
          const missingEventId = node.data.details?.missingEventId;
          if (typeof ownerId === "string" && typeof missingEventId === "string") {
            nextProject = mutations.removeMissingEventReference(nextProject, ownerId, missingEventId).project;
            deletedInspectorNodeIds.push(node.id);
            deletedCount += 1;
          }
        } else if (node.data.kind === "outcome" && typeof eventId === "string" && typeof node.data.details?.decisionId === "string") {
          const outcome = node.data.details.outcome as { id?: string } | undefined;
          if (outcome?.id) {
            nextProject = mutations.deleteOutcome(nextProject, eventId, node.data.details.decisionId, outcome.id).project;
            deletedCount += 1;
          }
        }
      }

      if (interactionDeletionError) {
        setMessage(interactionDeletionError instanceof Error ? interactionDeletionError.message : String(interactionDeletionError));
        return;
      }

      const branchIds = selectedNodes
        .filter((node) => node.data.kind === "branch")
        .map((node) => node.id)
        .filter((id) => nextProject.branches.some((branch) => branch.id === id));
      if (branchIds.length > 0) {
        const removedBranches = new Set(branchIds);
        nextProject = {
          ...nextProject,
          branches: nextProject.branches.filter((branch) => !removedBranches.has(branch.id)),
          sequences: nextProject.sequences.map((sequence) => ({
            ...sequence,
            branchIds: sequence.branchIds?.filter((id) => !removedBranches.has(id)),
          })),
          events: nextProject.events.map((event) => removedBranches.has(event.branchRef ?? "") ? { ...event, branchRef: undefined } : event),
        };
        deletedInspectorNodeIds.push(...branchIds);
        deletedCount += branchIds.length;
      }

      const eventIds = selectedNodes
        .filter((node) => node.data.kind === "event")
        .map((node) => node.id)
        .filter((id) => {
          const event = findEvent(nextProject, id);
          return Boolean(event) &&
            Boolean(event);
        });
      if (eventIds.length > 0) {
        const removedEventIds = new Set(eventIds);
        const removedTransitionIds = new Set(
          nextProject.events.flatMap((event) =>
            (event.transitions ?? [])
              .filter((transition) => removedEventIds.has(transition.from) || removedEventIds.has(transition.to))
              .map((transition) => transition.id),
          ),
        );
        nextProject = {
          ...nextProject,
          sequences: nextProject.sequences.map((sequence) => ({
            ...sequence,
            eventIds: sequence.eventIds.filter((id) => !removedEventIds.has(id)),
            entryEventId: removedEventIds.has(sequence.entryEventId)
              ? sequence.eventIds.find((id) => !removedEventIds.has(id)) ?? ""
              : sequence.entryEventId,
          })),
          branches: nextProject.branches.map((branch) => ({
            ...branch,
            eventIds: branch.eventIds.filter((id) => !removedEventIds.has(id)),
          })),
          events: nextProject.events
            .filter((event) => !removedEventIds.has(event.id))
            .map((event) => ({
              ...event,
              parentEventId: removedEventIds.has(event.parentEventId ?? "") ? undefined : event.parentEventId,
              childEventIds: event.childEventIds?.filter((id) => !removedEventIds.has(id)),
              transitions: (event.transitions ?? []).filter(
                (transition) => !removedEventIds.has(transition.from) && !removedEventIds.has(transition.to),
              ),
              boundaryBindings: (event.boundaryBindings ?? []).filter(
                (binding) => !removedEventIds.has(binding.nodeId) &&
                  !removedTransitionIds.has(binding.portId.split(":").at(-1) ?? ""),
              ),
            })),
        };
        deletedCount += eventIds.length;
      }

      if (deletedCount > 0) {
        nextProject = mutations.pruneDanglingNarrativeMetadata(nextProject);
      }

      if (deletedCount === 0) {
        setMessage("The selected nodes cannot be deleted in their current state.");
        return;
      }
      setSelection(undefined);
      deletedInspectorNodeIds.forEach(closeDeletedNodeInspector);
      eventIds.forEach(closeDeletedNodeInspector);
      if (eventIds.length > 0) {
        pruneEventInspectorEvents(nextProject.events.map((event) => event.id));
      }
      commitCanvasAction(
        `Deleted ${deletedCount} selected node${deletedCount === 1 ? "" : "s"}`,
        nextProject,
      );
    },
    [closeDeletedNodeInspector, commitCanvasAction, eventDraft, nodes, pruneEventInspectorEvents],
  );

  const canvasSelectionNodeIds = useCallback(() => {
    const ids = nodes.filter((node) => node.selected).map((node) => node.id);
    // An open inspector updates the active selection, but it does not make
    // that node part of an explicit canvas/marquee selection. Once the user
    // has selected nodes on the canvas, keep that set authoritative for
    // copy/cut/delete actions.
    if (ids.length > 0) return ids;

    const currentSelection = selectionRef.current;
    return currentSelection?.type === "node" ? [currentSelection.id] : [];
  }, [nodes]);

  const copyCanvasSelection = useCallback(() => {
    const selectedIds = canvasSelectionNodeIds();
    const items: CanvasClipboardItem[] = [];
    selectedIds.forEach((nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      const details = node.data.details ?? {};
      const value =
        node.data.kind === "event" ? details.event
          : node.data.kind === "decision" ? details.decision
            : node.data.kind === "dialogue" ? details.dialogue
              : node.data.kind === "dialogueStart" ? details.start
                : node.data.kind === "outcome" ? details.outcome
                  : (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") ? details.beat
                    : undefined;
      if (!value) return;
      if (![
        "event",
        "decision",
        "dialogue",
        "dialogueStart",
        "outcome",
        "speechBeat",
        "directionBeat",
      ].includes(node.data.kind)) return;
      items.push({
        kind: node.data.kind as CanvasClipboardKind,
        nodeId,
        position: { x: node.position.x, y: node.position.y },
        value: cloneCanvasValue(value),
        block:
          (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") && details.block
            ? cloneCanvasValue(details.block)
            : undefined,
        eventId: typeof details.eventId === "string" ? details.eventId : undefined,
        dialogueId: typeof details.dialogueId === "string" ? details.dialogueId : undefined,
        decisionId: typeof details.decisionId === "string" ? details.decisionId : undefined,
      });
    });
    if (items.length === 0) {
      setMessage("Select a story node to copy.");
      return [];
    }
    canvasClipboardRef.current = {
      scopeKey: activeScope ? canvasScopeKey(activeScope) : undefined,
      items,
    };
    canvasPasteOffsetRef.current = 0;
    setMessage(`Copied ${items.length} node${items.length === 1 ? "" : "s"}.`);
    return selectedIds;
  }, [activeScope, canvasSelectionNodeIds, nodes]);

  const cutCanvasSelection = useCallback(() => {
    const selectedIds = copyCanvasSelection();
    if (selectedIds.length > 0) {
      deleteNodeSelections(selectedIds);
    }
  }, [copyCanvasSelection, deleteNodeSelections]);

  const pasteCanvasSelection = useCallback(() => {
    const currentProject = projectRef.current;
    const clipboard = canvasClipboardRef.current;
    if (!currentProject || !clipboard?.items.length) {
      setMessage("Nothing to paste.");
      return;
    }

    const eventIdMap = new Map<string, string>();
    const decisionIdMap = new Map<string, string>();
    const dialogueIdMap = new Map<string, string>();
    const beatIdMap = new Map<string, string>();
    const outcomeIdMap = new Map<string, string>();
    let nextEvents = [...currentProject.events];
    let nextScriptDocuments = cloneCanvasValue(currentProject.scriptDocuments ?? []);
    const nextLocalizationEntries = {
      ...(currentProject.localizationCatalog?.entries ?? {}),
    };
    let pastedNodeIds: string[] = [];

    const eventItems = clipboard.items.filter((item) => item.kind === "event");
    eventItems.forEach((item) => {
      const source = cloneCanvasValue(item.value) as EventNode;
      const id = mutations.uniqueId(`${source.id}-copy`, nextEvents.map((event) => event.id));
      eventIdMap.set(source.id, id);
      const event: EventNode = {
        ...source,
        id,
        parentEventId: activeScope?.kind === "event" ? activeScope.id : undefined,
        childEventIds: [],
        decisions: [],
        dialogues: [],
        dialogueStarts: [],
        dialogueBeats: [],
        transitions: (source.transitions ?? []).map((transition) => ({
          ...transition,
          id: mutations.uniqueId(`${transition.id}-copy`, nextEvents.flatMap((candidate) => candidate.transitions ?? []).map((candidate) => candidate.id)),
          from: eventIdMap.get(transition.from) ?? id,
          to: eventIdMap.get(transition.to) ?? transition.to,
        })),
      };
      nextEvents.push(event);
      pastedNodeIds.push(id);
    });

    const eventTargetId = (sourceEventId?: string) =>
      sourceEventId ? eventIdMap.get(sourceEventId) ?? sourceEventId : undefined;

    const updateEvent = (eventId: string, update: (event: EventNode) => EventNode) => {
      nextEvents = nextEvents.map((event) => event.id === eventId ? update(event) : event);
    };

    clipboard.items.filter((item) => item.kind === "decision").forEach((item) => {
      const targetEventId = eventTargetId(item.eventId);
      const source = cloneCanvasValue(item.value) as Decision;
      const target = nextEvents.find((event) => event.id === targetEventId);
      if (!target || !targetEventId) return;
      const id = mutations.uniqueId(`${source.id}-copy`, (target.decisions ?? []).map((decision) => decision.id));
      decisionIdMap.set(`${item.eventId}:${source.id}`, id);
      updateEvent(targetEventId, (event) => ({
        ...event,
        decisions: [...(event.decisions ?? []), { ...source, id, outcomes: [], dialogueId: undefined }],
      }));
      pastedNodeIds.push(`decision:${targetEventId}:${id}`);
    });

    clipboard.items.filter((item) => item.kind === "dialogue").forEach((item) => {
      const targetEventId = eventTargetId(item.eventId);
      const source = cloneCanvasValue(item.value) as DialogueNode;
      const target = nextEvents.find((event) => event.id === targetEventId);
      if (!target || !targetEventId) return;
      const id = mutations.uniqueId(`${source.id}-copy`, (target.dialogues ?? []).map((dialogue) => dialogue.id));
      dialogueIdMap.set(`${item.eventId}:${source.id}`, id);
      updateEvent(targetEventId, (event) => ({
        ...event,
        dialogues: [...(event.dialogues ?? []), { ...source, id, beats: [], members: [], entryBeatId: undefined }],
      }));
      pastedNodeIds.push(`dialogue:${targetEventId}:${id}`);
    });

    clipboard.items.filter((item) => item.kind === "dialogueStart").forEach((item) => {
      const targetEventId = eventTargetId(item.eventId);
      const source = cloneCanvasValue(item.value) as DialogueStart;
      const target = nextEvents.find((event) => event.id === targetEventId);
      if (!target || !targetEventId) return;
      const id = mutations.uniqueId(`${source.id}-copy`, (target.dialogueStarts ?? []).map((start) => start.id));
      updateEvent(targetEventId, (event) => ({ ...event, dialogueStarts: [...(event.dialogueStarts ?? []), { ...source, id }] }));
      pastedNodeIds.push(`dialogue-start:${targetEventId}:${id}`);
    });

    clipboard.items.filter((item) => item.kind === "speechBeat" || item.kind === "directionBeat").forEach((item) => {
      const targetEventId = eventTargetId(item.eventId);
      const source = cloneCanvasValue(item.value) as DialogueBeat;
      const target = nextEvents.find((event) => event.id === targetEventId);
      if (!target || !targetEventId) return;
      const targetDialogueId = item.dialogueId ? dialogueIdMap.get(`${item.eventId}:${item.dialogueId}`) ?? item.dialogueId : undefined;
      let blockRef = source.blockRef;
      const sourceDocument = currentProject.scriptDocuments?.find((document) => document.id === source.blockRef.scriptId);
      const sourceBlock = sourceDocument?.blocks.find((block) => block.id === source.blockRef.blockId)
        ?? (item.block as ScriptBlock | undefined);
      let targetDocument = nextScriptDocuments.find((document) => document.id === source.blockRef.scriptId);
      if (!targetDocument && sourceBlock) {
        const scriptId = mutations.uniqueId(`script:clipboard`, nextScriptDocuments.map((document) => document.id));
        targetDocument = {
          id: scriptId,
          name: "Pasted Beats",
          format: "forge-script",
          blocks: [],
        };
        nextScriptDocuments = [...nextScriptDocuments, targetDocument];
      }
      if (sourceBlock && targetDocument) {
        const blockId = mutations.uniqueId(`${sourceBlock.id}-copy`, targetDocument.blocks.map((block) => block.id));
        const textKey = scriptBlockTextKey(targetDocument.id, blockId);
        const sourceTextKey = sourceBlock.textKey ?? scriptBlockTextKey(sourceDocument?.id ?? source.blockRef.scriptId, sourceBlock.id);
        const sourceValues = currentProject.localizationCatalog?.entries[sourceTextKey]?.values;
        const values = sourceValues ?? {
          ...(currentProject.localizationCatalog?.primaryLocale
            ? { [currentProject.localizationCatalog.primaryLocale]: sourceBlock.content }
            : {}),
          ...(sourceBlock.translations ?? {}),
        };
        nextScriptDocuments = nextScriptDocuments.map((document) => document.id === targetDocument.id
          ? { ...document, blocks: [...document.blocks, { ...cloneCanvasValue(sourceBlock), id: blockId, textKey }] }
          : document);
        nextLocalizationEntries[textKey] = { values: cloneCanvasValue(values) };
        blockRef = { scriptId: targetDocument.id, blockId };
      }
      const id = mutations.uniqueId(`${source.id}-copy`, [
        ...(target.dialogueBeats ?? []).map((beat) => beat.id),
        ...(target.dialogues ?? []).flatMap((dialogue) => (dialogue.beats ?? []).map((beat) => beat.id)),
      ]);
      beatIdMap.set(`${item.eventId}:${item.dialogueId ?? "event"}:${source.id}`, id);
      if (targetDialogueId && target.dialogues?.some((dialogue) => dialogue.id === targetDialogueId)) {
        updateEvent(targetEventId, (event) => ({
          ...event,
          dialogues: (event.dialogues ?? []).map((dialogue) => dialogue.id === targetDialogueId
          ? {
                ...dialogue,
                beats: [...(dialogue.beats ?? []), { ...source, id, blockRef }],
                members: [...(dialogue.members ?? []), { kind: "beat", id }],
                entryBeatId: dialogue.entryBeatId ?? id,
              }
            : dialogue),
        }));
      } else {
        updateEvent(targetEventId, (event) => ({ ...event, dialogueBeats: [...(event.dialogueBeats ?? []), { ...source, id, blockRef }] }));
      }
      pastedNodeIds.push(`beat:${targetEventId}:${id}`);
    });

    clipboard.items.filter((item) => item.kind === "outcome").forEach((item) => {
      const targetEventId = eventTargetId(item.eventId);
      const source = cloneCanvasValue(item.value) as Outcome;
      const sourceDecisionId = item.decisionId;
      const targetDecisionId = decisionIdMap.get(`${item.eventId}:${sourceDecisionId}`) ?? sourceDecisionId;
      const target = nextEvents.find((event) => event.id === targetEventId);
      const decision = target?.decisions?.find((candidate) => candidate.id === targetDecisionId);
      if (!target || !targetEventId || !decision) return;
      const id = mutations.uniqueId(`${source.id}-copy`, decision.outcomes.map((outcome) => outcome.id));
      outcomeIdMap.set(`${item.eventId}:${sourceDecisionId}:${source.id}`, id);
      updateEvent(targetEventId, (event) => ({
        ...event,
        decisions: (event.decisions ?? []).map((candidate) => candidate.id === targetDecisionId
          ? { ...candidate, outcomes: [...candidate.outcomes, { ...source, id }] }
          : candidate),
      }));
      pastedNodeIds.push(`outcome:${targetEventId}:${targetDecisionId}:${id}`);
    });

    const activeSequenceId = activeScope?.kind === "sequence" ? activeScope.id : mutations.activeSequenceId(currentProject);
    const activeSequence = nextEvents.length > currentProject.events.length
      ? currentProject.sequences.find((sequence) => sequence.id === activeSequenceId)
      : undefined;
    let nextSequences = currentProject.sequences;
    if (activeSequence && eventIdMap.size > 0) {
      const pastedEventIds = Array.from(eventIdMap.values());
      nextSequences = currentProject.sequences.map((sequence) => sequence.id === activeSequence.id
        ? { ...sequence, eventIds: [...sequence.eventIds, ...pastedEventIds] }
        : sequence);
    }
    if (activeScope?.kind === "event" && eventIdMap.size > 0) {
      const childIds = Array.from(eventIdMap.values());
      nextEvents = nextEvents.map((event) => event.id === activeScope.id
        ? { ...event, childEventIds: [...(event.childEventIds ?? []), ...childIds] }
        : event);
    }

    const pasteOffset = (canvasPasteOffsetRef.current + 1) * 32;
    canvasPasteOffsetRef.current += 1;
    const positionEntries: Record<string, { position: { x: number; y: number } }> = {};
    const occupiedNodes = [...nodes];
    clipboard.items.forEach((item) => {
      const pastedId = item.kind === "event" ? eventIdMap.get((item.value as EventNode).id)
        : item.kind === "decision" ? (() => {
            const source = item.value as Decision;
            const targetEventId = eventTargetId(item.eventId);
            return targetEventId ? `decision:${targetEventId}:${decisionIdMap.get(`${item.eventId}:${source.id}`)}` : undefined;
          })()
          : item.kind === "dialogue" ? (() => {
              const source = item.value as DialogueNode;
              const targetEventId = eventTargetId(item.eventId);
              return targetEventId ? `dialogue:${targetEventId}:${dialogueIdMap.get(`${item.eventId}:${source.id}`)}` : undefined;
            })()
            : item.kind === "dialogueStart" ? undefined
              : item.kind === "outcome" ? undefined
                : (() => {
                    const source = item.value as DialogueBeat;
                    const targetEventId = eventTargetId(item.eventId);
                    return targetEventId ? `beat:${targetEventId}:${beatIdMap.get(`${item.eventId}:${item.dialogueId ?? "event"}:${source.id}`)}` : undefined;
                  })();
      if (!pastedId || pastedId.endsWith(":undefined")) return;
      const position = nearestFreeCanvasPosition(
        occupiedNodes,
        { x: item.position.x + pasteOffset, y: item.position.y + pasteOffset },
        canvasNodeSizeForKind(item.kind),
        {
          snapToGrid: settings.canvasBackground.snapToGrid,
          gridSize: settings.canvasBackground.gridSize,
          constrainToWorkspace: Boolean(activeScope && activeScope.kind !== "sequence" && currentProject.canvas?.scopes?.[canvasScopeKey(activeScope)]?.workspace?.manual),
        },
      );
      positionEntries[pastedId] = { position };
      occupiedNodes.push({ id: pastedId, type: "story", position, data: { kind: item.kind, title: "", storyObjectId: pastedId, badges: [] } } as StoryCanvasNode);
    });

    const scopeKey = activeScope ? canvasScopeKey(activeScope) : undefined;
    const nextCanvas = scopeKey
      ? {
          ...currentProject.canvas,
          scopes: {
            ...(currentProject.canvas?.scopes ?? {}),
            [scopeKey]: {
              ...(currentProject.canvas?.scopes?.[scopeKey] ?? {}),
              nodes: { ...(currentProject.canvas?.scopes?.[scopeKey]?.nodes ?? {}), ...positionEntries },
            },
          },
        }
      : { ...currentProject.canvas, nodes: { ...(currentProject.canvas?.nodes ?? {}), ...positionEntries } };
    nextEvents = nextEvents.map((event) => event);
    if (pastedNodeIds.length === 0) {
      setMessage("The selected nodes could not be pasted here.");
      return;
    }
    commitCanvasAction(`Pasted ${pastedNodeIds.length} node${pastedNodeIds.length === 1 ? "" : "s"}`, {
      ...currentProject,
      events: nextEvents,
      sequences: nextSequences,
      scriptDocuments: nextScriptDocuments,
      ...(currentProject.localizationCatalog
        ? {
            localizationCatalog: {
              ...currentProject.localizationCatalog,
              entries: nextLocalizationEntries,
            },
          }
        : {}),
      canvas: nextCanvas,
    }, { type: "node", id: pastedNodeIds[0] });
  }, [activeScope, commitCanvasAction, nodes, project, settings.canvasBackground.gridSize, settings.canvasBackground.snapToGrid]);

  useEffect(() => {
    if (suiteChrome && !suiteChrome.active) return;
    const handleCanvasClipboardKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;
      if (shortcutMatches(event, "Mod+C")) {
        event.preventDefault();
        copyCanvasSelection();
      } else if (shortcutMatches(event, "Mod+X")) {
        event.preventDefault();
        cutCanvasSelection();
      } else if (shortcutMatches(event, "Mod+V")) {
        event.preventDefault();
        pasteCanvasSelection();
      }
    };
    window.addEventListener("keydown", handleCanvasClipboardKey, true);
    return () => window.removeEventListener("keydown", handleCanvasClipboardKey, true);
  }, [copyCanvasSelection, cutCanvasSelection, pasteCanvasSelection, suiteChrome]);

  const groupDialogueMembers = useCallback((nodeIds: string[]) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const selectedNodes = nodes.filter((node) => nodeIds.includes(node.id));
    const selectedMembers = canvasDialogueMembers(nodes, nodeIds);
    const eventIds = new Set(selectedMembers.map(({ eventId }) => eventId));
    if (selectedMembers.length !== nodeIds.length || selectedMembers.length !== selectedNodes.length || eventIds.size !== 1) {
      setMessage("Dialogue members must belong to the same event.");
      return;
    }
    const eventId = Array.from(eventIds)[0];
    const event = findEvent(currentProject, eventId);
    if (!event) return;
    setNameDialog({
      kind: "createDialogueFromSelection",
      title: uiLocaleRef.current === "es" ? "Crear conversación" : "Create conversation",
      label: uiLocaleRef.current === "es" ? "Nombre de la conversación" : "Conversation name",
      initialValue: automaticNarrativeName(
        currentProject,
        eventId,
        "Conversation",
              ),
      eventId,
      members: selectedMembers.map(({ member }) => member),
    });
  }, [nodes]);

  const detachDialogueMembers = useCallback((nodeIds: string[]) => {
    const currentProject = projectRef.current;
    if (!currentProject || activeScope?.kind !== "dialogue") return;
    const members: DialogueMemberRef[] = [];
    nodes.filter((node) => nodeIds.includes(node.id)).forEach((node) => {
      if (node.data.kind === "speechBeat" || node.data.kind === "directionBeat") {
        const beat = node.data.details?.beat as { id?: string } | undefined;
        if (beat?.id) members.push({ kind: "beat", id: beat.id });
        return;
      }
      if (node.data.kind === "decision") {
        const decision = node.data.details?.decision as { id?: string } | undefined;
        if (decision?.id) members.push({ kind: "decision", id: decision.id });
      }
    });
    runCanvasMutation(mutations.detachDialogueMembers(currentProject, activeScope.eventId, activeScope.id, members));
  }, [activeScope, nodes, runCanvasMutation]);

  const dissolveDialogue = useCallback((eventId: string, dialogueId: string) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    runCanvasMutation(mutations.detachDialogueMembers(currentProject, eventId, dialogueId));
    if (activeScope?.kind === "dialogue" && activeScope.id === dialogueId) {
      navigateCanvasScope({ kind: "event", id: eventId });
    }
  }, [activeScope, navigateCanvasScope, runCanvasMutation]);

  const createDialogueStart = useCallback((eventId: string, position?: CanvasPoint, source?: DialogueStart["source"]) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    runCanvasMutation(
      positionMutationNode(
        mutations.createDialogueStart(currentProject, eventId, source),
        position,
        activeScope,
      ),
    );
  }, [activeScope, runCanvasMutation]);

  const createInteractionNode = useCallback((eventId: string, dialogueId?: string, position?: CanvasPoint) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    const sourceProject = eventDraft?.eventId === eventId
      ? applyEventDraftToProject(currentProject, eventDraft)
      : currentProject;
    const created = addInteraction(sourceProject, eventId, "dice", { dialogueId, pendingMechanic: true });
    if (eventDraft?.eventId === eventId) setEventDraft(undefined);
    const scope: CanvasScope = dialogueId
      ? { kind: "dialogue", id: dialogueId, eventId }
      : { kind: "event", id: eventId };
    const placement = position
      ? snapCanvasPoint(
          position,
          settingsRef.current.canvasBackground.snapToGrid,
          settingsRef.current.canvasBackground.gridSize,
        )
      : undefined;
    runCanvasMutation(positionMutationNode(created, placement, scope), "Created interaction");
  }, [eventDraft, runCanvasMutation]);

  const updateDialogueStart = useCallback((eventId: string, startId: string, updates: Partial<DialogueStart>) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    runCanvasMutation(mutations.updateDialogueStart(currentProject, eventId, startId, updates));
  }, [runCanvasMutation]);

  const deleteDialogueStart = useCallback((eventId: string, startId: string) => {
    const currentProject = projectRef.current;
    if (!currentProject) return;
    runCanvasMutation(mutations.deleteDialogueStart(currentProject, eventId, startId));
  }, [runCanvasMutation]);

  const eventScriptPortraitUrl = useCallback((refId: string) => {
    if (!project) return undefined;
    const ref = project.canonRefs.find((candidate) => candidate.id === refId);
    if (!ref) return undefined;
    const portrait = canonPresentationImageForRef(
      workspace?.canonIndex.propertiesConfig,
      ref,
      "portrait",
    );
    return portrait ? canonVaultImageUrl(project, portrait.value) : undefined;
  }, [project, workspace?.canonIndex.propertiesConfig]);

  useEffect(() => {
    if (suiteChrome && !suiteChrome.active) return;

    const handleDeleteKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest(".canvas-edge-waypoint")) return;
      const currentSelection = selectionRef.current;
      const selectedNode = currentSelection?.type === "node"
        ? nodes.find((node) => node.id === currentSelection.id)
        : undefined;
      if (
        target instanceof Element &&
        target.closest(".conversation-editor") &&
        selectedNode?.data.kind !== "decision" &&
        selectedNode?.data.kind !== "interaction" &&
        selectedNode?.data.kind !== "barrier"
      ) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const currentProject = projectRef.current;
      if (!currentProject || !currentSelection) {
        return;
      }

      if (currentSelection.type === "node") {
        event.preventDefault();
        event.stopPropagation();
        const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
        if (selectedNodeIds.length > 1) {
          deleteNodeSelections(selectedNodeIds);
        } else {
          deleteSelection(selectedNodeIds[0]
            ? { type: "node", id: selectedNodeIds[0] }
            : currentSelection);
        }
        return;
      }

      if (
        currentSelection.type === "edge" &&
        currentSelection.id.startsWith("edge:transition:")
      ) {
        event.preventDefault();
        event.stopPropagation();
        deleteTransition(currentSelection.id.replace("edge:transition:", ""));
        setSelection(undefined);
        return;
      }

      if (
        currentSelection.type === "edge" &&
        (currentSelection.id.startsWith("edge:boundary:") ||
          currentSelection.id.startsWith("edge:dialogue-entry:") ||
          currentSelection.id.startsWith("edge:entry:"))
      ) {
        event.preventDefault();
        event.stopPropagation();
        deleteBoundaryEdge(currentSelection.id);
        setSelection(undefined);
      }
    };

    window.addEventListener("keydown", handleDeleteKey, true);
    return () => window.removeEventListener("keydown", handleDeleteKey, true);
  }, [deleteBoundaryEdge, deleteNodeSelections, deleteSelection, deleteTransition, nodes, suiteChrome]);

  const createKnowledgeObject = useCallback(() => {
    if (!project) {
      return;
    }

    const canonRefId = selection?.type === "canon" ? selection.id : undefined;
    const result = mutations.createKnowledgeObject(project, canonRefId);
    setDataOpen(true);
    runMutation(result, "Created knowledge object");
  }, [project, runMutation, selection]);

  const createDataObject = useCallback(
    (classId: string) => {
      if (!project) {
        return;
      }

      const canonRefId = selection?.type === "canon" ? selection.id : undefined;
      const result = mutations.createDataObject(project, classId, canonRefId);
      setDataOpen(true);
      runMutation(result, "Created data object");
    },
    [project, runMutation, selection],
  );

  const setPanelCollapsedState = useCallback(
    (panel: WorkspacePanelId, collapsed: boolean) => {
      setPanelCollapsed((current) => managementPanelCollapsedState(current, panel, collapsed));
      if (isExplorerPanel(panel) && !collapsed) {
        setExplorerTab(panel);
        setPanelVisibility(current => ({ ...current, [panel]: true }));
      }
      if (panel === "outline") setFilesOpen(!collapsed);
      if (!collapsed) setRequestedPanel((current) => ({ id: panel, revision: (current?.revision ?? 0) + 1 }));
    },
    [],
  );

  const toggleCanon = useCallback(() => {
    const collapsed = explorerTab === "assets" && !panelCollapsed.assets;
    setCanonOpen(!collapsed);
    setPanelCollapsedState("assets", collapsed);
  }, [explorerTab, panelCollapsed.assets, setPanelCollapsedState]);

  const toggleFiles = useCallback(() => {
    setPanelCollapsedState("outline", explorerTab === "outline" && !panelCollapsed.outline);
  }, [explorerTab, panelCollapsed.outline, setPanelCollapsedState]);

  const locateTestNode = useCallback((id: string) => {
    const current = projectRef.current;
    const target = current && authoringNodeOptions(current).find(node => node.id === id);
    if (target) navigateCanvasScope(target.dialogueId ? { kind: "dialogue", id: target.dialogueId, eventId: target.eventId } : { kind: "event", id: target.eventId }, { type: "node", id });
    else setSelection({ type: "node", id });
  }, [navigateCanvasScope]);
  const resolveTestSpeaker = useCallback((document: BranchingProject, ref: string, variantId?: string) => {
    const speaker = storyTestSpeaker(document, workspace?.canonIndex.propertiesConfig, ref, variantId);
    return speaker ? { name: speaker.name, portraitUrl: speaker.portraitPath ? universeAssetUrl(document, speaker.portraitPath) : undefined } : undefined;
  }, [workspace?.canonIndex.propertiesConfig]);
  const { controller: storyTestController, snapshot: storyTest, dispatch: dispatchStoryTest } = useStoryTestController(project, {
    onUpdate: updateProject, onLocate: locateTestNode, locale: uiLocale, theme: activeTheme,
    resolveSpeakerPresentation: resolveTestSpeaker,
    selectedNodeId: selection?.type === "node" ? selection.id : undefined,
    documentKey: `${fileState.universePath ?? ""}:${project?.storyId ?? project?.projectId ?? ""}`,
  });
  stopStoryTestRef.current = () => { dispatchStoryTest({ type: "stop" }); };
  const storyTestWindows = useStoryTestWindows(storyTest, storyTestController.request);
  useEffect(() => {
    playDetachedWindowActiveRef.current = storyTestWindows.detached.preview;
    if (storyTestWindows.detached.preview || playDetachingRef.current) return;
    if (inspectorTabs.some(tab => tab.id === expandedInspectorTabId && tab.selection.type === "storyPlay")) {
      playPreferredFullscreenRef.current = contextFocus;
    }
  }, [contextFocus, expandedInspectorTabId, inspectorTabs, storyTestWindows.detached.preview]);
  const restorePlayAfterDetach = useCallback(() => {
    const presentation = playDetachedPresentationRef.current;
    if (!presentation) return;
    playDetachedPresentationRef.current = undefined;
    playDetachingRef.current = false;
    const playTab = inspectorTabs.find(tab => tab.id === presentation.tabId && tab.selection.type === "storyPlay")
      ?? inspectorTabs.find(tab => tab.selection.type === "storyPlay");
    if (!playTab) {
      playRestoreOnOpenRef.current = true;
      return;
    }
    playRestoreOnOpenRef.current = false;
    setContextTab("edit");
    setContextFocus(presentation.fullscreen);
    setExpandedInspectorTabId(playTab.id);
    setEventInspector(current => ({ ...current, open: true, expandedEventId: undefined }));
    setSelection(playTab.selection);
  }, [inspectorTabs]);
  useEffect(() => {
    if (storyTestWindows.detached.preview) {
      playDetachingRef.current = false;
      playWasDetachedRef.current = true;
      return;
    }
    if (!playWasDetachedRef.current) return;
    playWasDetachedRef.current = false;
    restorePlayAfterDetach();
  }, [storyTestWindows.detached.preview, restorePlayAfterDetach]);
  useEffect(() => {
    if (!storyTestWindows.error || storyTestWindows.detached.preview || !playDetachedPresentationRef.current) return;
    playWasDetachedRef.current = false;
    restorePlayAfterDetach();
  }, [storyTestWindows.error, storyTestWindows.detached.preview, restorePlayAfterDetach]);
  const detachStoryPlay = useCallback(() => {
    const playTab = inspectorTabs.find(tab => tab.selection.type === "storyPlay");
    if (!playTab) return;
    playPreferredFullscreenRef.current = contextFocus;
    playDetachedPresentationRef.current = { fullscreen: contextFocus, tabId: playTab.id };
    playDetachingRef.current = true;
    playRestoreOnOpenRef.current = false;
    setExpandedInspectorTabId(current => current === playTab.id ? undefined : current);
    setContextFocus(false);
    void storyTestWindows.detach("preview");
  }, [contextFocus, inspectorTabs, storyTestWindows.detach]);
  useEffect(() => {
    if (!storyTest.active || storyTest.debugOpen || storyTestWindows.detached.preview || playDetachingRef.current
      || inspectorTabs.some(tab => tab.selection.type === "storyPlay")) return;
    openStoryPlay();
  }, [storyTest.active, storyTest.debugOpen, storyTest.sessionId, storyTestWindows.detached.preview, inspectorTabs, openStoryPlay]);
  const lastLearningTest = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (storyTest.active && storyTest.sessionId !== lastLearningTest.current) {
      lastLearningTest.current = storyTest.sessionId;
      reportLearning("story-tested", project?.storyId ?? project?.projectId);
    }
  }, [storyTest.active, storyTest.sessionId, reportLearning, project?.storyId, project?.projectId]);
  switchDraftsRef.current ||= Object.keys(storyTest.drafts).length > 0;
  const inspectorBeforeDebugRef = useRef<Selection | undefined>(undefined);
  useEffect(() => {
    if (storyTest.debugOpen && !storyTestWindows.detached.preview && !contextFocus && !playDetachingRef.current) {
      if (storyTest.debugAttached) dispatchStoryTest({type:"debugAttachment",attached:false});
      if (selection?.type !== "storyDebug") inspectorBeforeDebugRef.current = selection;
      openInspectorRef.current({ type: "storyDebug", id: storyTest.sessionId }, "debug");
    }
  }, [storyTest.debugOpen, storyTest.debugAttached, storyTest.debugFocusRevision, storyTest.sessionId, storyTestWindows.detached.preview, contextFocus]);
  useEffect(() => {
    if (playDetachingRef.current && !storyTestWindows.detached.preview) return;
    if (storyTest.debugOpen && !storyTestWindows.detached.preview && !contextFocus) return;
    const remainingTabs = inspectorTabs.filter(tab => tab.selection.type !== "storyDebug");
    const activeDebugTab = inspectorTabs.some(tab => tab.id === expandedInspectorTabId && tab.selection.type === "storyDebug");
    if (remainingTabs.length !== inspectorTabs.length) setInspectorTabs(remainingTabs);
    if (!activeDebugTab && selection?.type !== "storyDebug") return;
    const previous = inspectorBeforeDebugRef.current;
    const previousTab = previous
      ? remainingTabs.find(tab => inspectorSelectionKey(tab.selection) === inspectorSelectionKey(previous))
      : undefined;
    const previousEventId = previous?.type === "node" && eventInspector.openEventIds.includes(previous.id)
      ? previous.id
      : undefined;
    const nextTab = previousTab ?? (previousEventId ? undefined : remainingTabs.at(-1));
    const nextEventId = previousEventId ?? (!nextTab ? eventInspector.openEventIds.at(-1) : undefined);
    const nextSelection: Selection | undefined = nextTab?.selection ?? (nextEventId ? { type: "node", id: nextEventId } : undefined);
    const folded = !eventInspector.open && !expandedInspectorTabId && !eventInspector.expandedEventId;
    setExpandedInspectorTabId(folded ? undefined : nextTab?.id);
    setEventInspector(state => ({
      ...state,
      open: !folded && Boolean(nextTab || nextEventId),
      expandedEventId: folded ? undefined : nextEventId,
    }));
    setSelection(nextSelection);
    inspectorBeforeDebugRef.current = undefined;
  }, [storyTest.debugOpen, storyTest.debugAttached, storyTestWindows.detached.preview, contextFocus, selection, inspectorTabs, expandedInspectorTabId, eventInspector.open, eventInspector.openEventIds, eventInspector.expandedEventId]);
  useEffect(() => { setTestPosition(storyTest.nodeId); setTestVisited(storyTest.visitedNodeIds); }, [storyTest.nodeId, storyTest.visitedNodeIds]);

  useEffect(() => {
    const locate = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id || !projectRef.current?.authoringScenarios?.some(scenario => scenario.id === id)) return;
      dispatchStoryTest({ type: "scenario", id });
      dispatchStoryTest({ type: "debug", open: true });
    };
    window.addEventListener("pathbranching:locate-scenario", locate);
    const locateNarrative = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      const current = projectRef.current;
      const target = current && authoringNodeOptions(current).find(node => node.id === id);
      if (target && id) navigateCanvasScope(target.dialogueId ? { kind: "dialogue", id: target.dialogueId, eventId: target.eventId } : { kind: "event", id: target.eventId }, { type: "node", id });
    };
    window.addEventListener("pathbranching:locate-narrative", locateNarrative);
    return () => { window.removeEventListener("pathbranching:locate-scenario", locate); window.removeEventListener("pathbranching:locate-narrative", locateNarrative); };
  }, [dispatchStoryTest, navigateCanvasScope]);

  const focusScriptBlock = useCallback(
    (target: { scriptId: string; blockId: string }) => {
      setPanelVisibility((current) => ({ ...current, assets: true }));
      setPanelCollapsedState("assets", false);
      setFocusedScriptBlock(undefined);
      window.requestAnimationFrame(() => setFocusedScriptBlock(target));
    },
    [setPanelCollapsedState],
  );

  const togglePanelVisibility = useCallback((panel: WorkspacePanelId) => {
    setPanelVisibility((current) => {
      const visible = !current[panel];
      if (visible) {
        setPanelCollapsed((collapsed) => managementPanelCollapsedState(collapsed, panel, false));
        if (isExplorerPanel(panel)) setExplorerTab(panel);
      }
      return { ...current, [panel]: visible };
    });
  }, []);

  const openPanelContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    const bounds = appShellRef.current?.getBoundingClientRect() ?? viewportBounds();
    setPanelContextMenu(
      clampFloatingMenuPosition(event.clientX, event.clientY, bounds, 205, 250),
    );
  }, []);

  const openLogicRule = useCallback((id: string) => {
    setSelectedLogicRuleId(id);
    setPanelVisibility((current) => ({ ...current, logic: true }));
    setPanelCollapsedState("logic", false);
  }, [setPanelCollapsedState]);

  useApplicationEffect(() => {
    if (!panelContextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (panelContextMenuRef.current?.contains(event.target as Node)) return;
      setPanelContextMenu(undefined);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelContextMenu(undefined);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [panelContextMenu]);

  useEffect(() => {
    if (suiteChrome && !suiteChrome.active) return;

    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<string>("pathbranching-menu", (event) => {
      switch (event.payload) {
        case "pb:file:open":
          void openProject();
          break;
        case "pb:file:save":
        case "pb:file:save-as":
          saveDocumentManually();
          break;
        case "pb:file:export-runtime":
          void exportRuntime("runtime");
          break;
        case "pb:file:export-ink":
          void exportRuntime("ink");
          break;
        case "pb:file:export-game-data":
          void exportRuntime("gameData");
          break;
        case "pb:edit:undo":
          undoProject();
          break;
        case "pb:edit:redo":
          redoProject();
          break;
        case "pb:view:home":
          setView("home");
          break;
        case "pb:view:reload":
          if (suiteChrome?.onReload) suiteChrome.onReload();
          else window.location.reload();
          break;
        case "pb:view:workspace":
          setView("workspace");
          break;
        case "pb:view:toggle-canon":
        case "pb:view:toggle-explorer":
          togglePanelVisibility("assets");
          break;
        case "pb:view:toggle-files":
        case "pb:view:toggle-outline":
          togglePanelVisibility("outline");
          break;
        case "pb:view:toggle-data":
        case "pb:view:toggle-assets":
          togglePanelVisibility("assets");
          break;
        case "pb:view:toggle-logic":
          togglePanelVisibility("logic");
          break;
        case "pb:view:toggle-export":
          togglePanelVisibility("export");
          break;
        case "pb:view:toggle-connect":
          togglePanelVisibility("connect");
          break;
        case "pb:view:reset-layout":
          resetLayout();
          break;
        case "pb:style:worldnotion":
          changeThemeFamily("worldnotion");
          break;
        case "pb:style:github":
          changeThemeFamily("github");
          break;
        case "pb:style:one":
          changeThemeFamily("one");
          break;
        case "pb:style:dracula":
          changeThemeFamily("dracula");
          break;
        case "pb:style:owl":
          changeThemeFamily("owl");
          break;
        case "pb:style:material":
          changeThemeFamily("material");
          break;
        case "pb:style:forge-mono":
          changeThemeFamily("forge-mono");
          break;
        case "pb:style:toggle-mode":
          toggleTheme();
          break;
        case "pb:help:about":
          setMessage(
            "Everend PathBranching 0.1.0 - branching narrative editor.",
          );
          break;
        case "pb:help:docs":
          setMessage(
            "Docs live in the Everend PathBranching README and docs folder for now.",
          );
          break;
      }
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      })
      .catch((listenError) => {
        if (!disposed) {
          setSettings((current) => ({
            ...current,
            worldnotionBridge: {
              ...current.worldnotionBridge,
              connected: false,
              lastCheckedAt: Date.now(),
              lastStatus: "error",
              lastMessage:
                listenError instanceof Error
                  ? listenError.message
                  : String(listenError),
            },
          }));
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [
    changeThemeFamily,
    exportRuntime,
    openProject,
    redoProject,
    resetLayout,
    saveDocumentManually,
    saveActiveManualInspectorDraft,
    settings.worldnotionBridge.connected,
    suiteChrome,
    toggleCanon,
    toggleFiles,
    togglePanelVisibility,
    toggleTheme,
    undoProject,
  ]);

  const handleFileSelect = useCallback(
    (id: string) => {
      const sequencePrefix = "file:sequence:";
      if (id.startsWith(sequencePrefix)) {
        setActiveSequence(id.slice(sequencePrefix.length));
        return;
      }

      const eventPrefix = "file:event:";
      if (id.startsWith(eventPrefix)) {
        selectWithEventDraftGuard({
          type: "node",
          id: id.slice(eventPrefix.length),
        });
        return;
      }

      const branchPrefix = "file:branch:";
      if (id.startsWith(branchPrefix)) {
        selectWithEventDraftGuard({
          type: "node",
          id: id.slice(branchPrefix.length),
        });
        return;
      }

      const dataPrefix = "file:data-object:";
      if (id.startsWith(dataPrefix)) {
        selectWithEventDraftGuard({
          type: "dataObject",
          id: id.slice(dataPrefix.length),
        });
        setDataOpen(true);
        return;
      }

      const suggestionPrefix = "file:canon-suggestion:";
      if (id.startsWith(suggestionPrefix)) {
        selectWithEventDraftGuard({
          type: "canonSuggestion",
          id: id.slice(suggestionPrefix.length),
        });
        return;
      }

      selectWithEventDraftGuard({ type: "file", id });
    },
    [selectWithEventDraftGuard, setActiveSequence],
  );

  const resizeCanon = useCallback((width: number) => {
    setCanonWidth(clampExplorerWidth(width));
  }, []);

  const resizeStories = useCallback((width: number) => {
    setStoriesWidth(clampPanelWidth(width));
  }, []);

  const settingsModal = (
    <PathBranchingSettingsModal
      initialSection={settingsInitialSection}
      hidden={!showSettings}
      settingsHost={suiteChrome?.settingsHost}
      project={project}
      fileState={fileState}
      settings={settings}
      findings={findings}
      theme={activeTheme}
      onUpdateEventCategories={updateEventCategories}
      onAuthoringDisplayChange={changeAuthoringDisplay}
      onUpdateSpeechBeatCounter={updateSpeechBeatCounter}
      onCanvasBackgroundChange={changeCanvasBackground}
      onNodeColorChange={changeNodeColors}
      onInterfaceFontChange={interfaceFont => setSettings(current => ({...current, interfaceFont}))}
      onThemeChange={suiteChrome?.suiteSettings?.onStyleChange ?? changeTheme}
      onToggleTheme={suiteChrome?.suiteSettings?.onToggleStyleMode ?? toggleTheme}
      onAmbientBackgroundChange={suiteChrome?.suiteSettings?.onAmbientBackgroundChange ?? (ambientBackground => setSettings(current => ({ ...current, ambientBackground })))}
      onBackgroundSceneChange={suiteChrome?.suiteSettings?.onBackgroundSceneChange ?? (backgroundScene => setSettings(current => ({ ...current, backgroundScene })))}
      onInspectorTabCloseSelectsNextChange={changeInspectorTabCloseSelectsNext}
      onCollapseInspectorTabOnCanvasClickChange={
        changeCollapseInspectorTabOnCanvasClick
      }
      onInspectorDebugEnabledChange={changeInspectorDebugEnabled}
      onShowStatusMessagesChange={changeShowStatusMessages}
      onLocalePreferenceChange={suiteChrome?.suiteSettings?.onLocalePreferenceChange ?? ((localePreference) => setSettings((current) => ({ ...current, localePreference })))}
      onOpenUniverse={openProject}
      onOpenRecentUniverse={openRecentProject}
      onRemoveRecentUniverse={removeRecentProject}
      onSaveUniverseProfile={saveUniverseProfile}
      onResetOnboarding={() => {
        if (fileState.universePath) window.localStorage.removeItem(`${PATHBRANCHING_ONBOARDING_KEY}:${fileState.universePath}`);
        setOnboardingDismissed(false);
        window.localStorage.removeItem(PATHBRANCHING_INTERACTION_TUTORIAL_KEY);
        setShowInteractionTutorial(true);
        setShowSettings(false);
      }}
      onClose={() => { setShowSettings(false); setSettingsInitialSection(undefined); }}
      suiteSettings={suiteChrome?.suiteSettings}
    />
  );

  const appDialogs = (
    <>
      <NamePromptDialog
        open={Boolean(nameDialog)}
        title={nameDialog?.title ?? ""}
        label={nameDialog?.label ?? "Name"}
        initialValue={nameDialog?.initialValue}
        confirmLabel={
          nameDialog?.kind === "saveInspectorTabGroup"
            ? "Save"
            : nameDialog?.kind?.startsWith("rename")
              ? "Rename"
              : "Create"
        }
        onConfirm={confirmNameDialog}
        onCancel={() => setNameDialog(undefined)}
      />
      <ConfirmActionDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.kind === "deleteLocalExplorerEntity" ? (uiLocale === "es" ? "Eliminar" : "Delete") : undefined}
        onConfirm={confirmActionDialog}
        onCancel={() => setConfirmDialog(undefined)}
      />
    </>
  );

  const locateExportDiagnostic = (location: string) => {
    if (!project) return;
    const authoring = authoringDiagnosticTarget(project, location);
    if (authoring) { window.dispatchEvent(new CustomEvent("pathbranching:locate-authoring", { detail: authoring })); return; }
    const target = diagnosticSelection(project, location);
    setRequestedPanel((current) => ({ revision: (current?.revision ?? 0) + 1 }));
    if (!target) return;
    if (target.type === "edge") {
      const owner = project.events.find((event) => event.transitions?.some((route) => route.id === target.id));
      if (owner) navigateCanvasScope({ kind: "event", id: owner.id }, target);
    } else if (target.type === "node" && project.events.some((event) => event.id === target.id)) {
      navigateCanvasScope({ kind: "event", id: target.id }, target);
    }
    selectWithEventDraftGuard(target);
  };
  const activeManualInspectorDraft = (() => {
    const key = manualInspectorDraftKey(selection);
    return key ? manualInspectorDrafts[key] : undefined;
  })();

  // Selection and inspector state do not change export compatibility. Stable
  // delegates let the memoized panel keep its diagnostics and import session.
  const exportPanelActions = {
    onCollapsedChange: (collapsed: boolean) => setPanelCollapsedState("export", collapsed),
    onContextMenu: openPanelContextMenu,
    onPreview: (mode: ExportPreviewMode) => { setExportPreviewMode(mode); setExportOpen(true); },
    onLocateDiagnostic: locateExportDiagnostic,
    onExport: (mode: ExportPreviewMode) => { void exportRuntime(mode); },
    onImportTwine: importTwine,
  };
  const exportPanelActionsRef = useRef(exportPanelActions);
  exportPanelActionsRef.current = exportPanelActions;
  const stableExportPanelActions = useMemo(() => ({
    onCollapsedChange: (collapsed: boolean) => exportPanelActionsRef.current.onCollapsedChange(collapsed),
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => exportPanelActionsRef.current.onContextMenu(event),
    onPreview: (mode: ExportPreviewMode) => exportPanelActionsRef.current.onPreview(mode),
    onLocateDiagnostic: (location: string) => exportPanelActionsRef.current.onLocateDiagnostic(location),
    onExport: (mode: ExportPreviewMode) => exportPanelActionsRef.current.onExport(mode),
    onImportTwine: (...args: Parameters<typeof importTwine>) => exportPanelActionsRef.current.onImportTwine(...args),
  }), []);

  const onboardingCompletion: Record<string, boolean> = {
    "open-stories": Boolean(panelVisibility.outline && !panelCollapsed.outline),
    "create-story": Boolean(workspace?.activeStory?.id),
    "create-sequence": Boolean(project && activeSequenceId(project)),
    "show-canvas": Boolean(project && activeSequenceId(project)),
  };
  const pathBranchingOnboardingSteps = onboardingUiCopy(uiLocale).steps.map((step) => ({ ...step, complete: onboardingCompletion[step.id] }));
  const openStoriesForOnboarding = () => {
    setPanelVisibility((current) => ({ ...current, outline: true }));
    setPanelCollapsedState("outline", false);
  };
  const dismissPathBranchingOnboarding = () => {
    if (fileState.universePath) window.localStorage.setItem(`${PATHBRANCHING_ONBOARDING_KEY}:${fileState.universePath}`, "dismissed");
    setOnboardingDismissed(true);
  };
  const restartPathBranchingOnboarding = () => {
    if (fileState.universePath) window.localStorage.removeItem(`${PATHBRANCHING_ONBOARDING_KEY}:${fileState.universePath}`);
    setOnboardingDismissed(false);
  };
  const dismissInteractionTutorial = () => {
    window.localStorage.setItem(
      PATHBRANCHING_INTERACTION_TUTORIAL_KEY,
      "dismissed",
    );
    setShowInteractionTutorial(false);
  };
  useLearningAdapter(suiteChrome?.learning, {
    introduction: pathbranchingIntroduction, lessons: pathbranchingLessons,
    available: Boolean(fileState.universePath && !initialLoading),
    busy: showSettings || showFeedback || exportOpen || Boolean(nameDialog),
    subjectId: project?.storyId ?? project?.projectId,
    section: !panelCollapsed.export || exportOpen ? "export" : contextTab === "test" ? "preview" : explorerTab === "logic" ? "logic" : explorerTab === "outline" ? "outline" : "canvas",
    openSection: (section, userInitiated) => {
      if (!fileStateRef.current.universePath) return;
      setView("workspace");
      if (section === "outline" || section === "logic" || section === "export") setPanelCollapsedState(section, false);
      if (section === "validation") {
        const button = appShellRef.current?.querySelector<HTMLButtonElement>('[data-onboarding-target="pathbranching.validation"] button');
        if (button?.getAttribute("aria-expanded") === "false") button.click();
        if (userInitiated && projectRef.current && !findings.some(finding => finding.severity === "error")) reportLearning("document-validated", projectRef.current.storyId ?? projectRef.current.projectId);
      }
    },
  });
  const interactionTutorialLocale = resolveInterfaceLocale(
    suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference,
  );

  const saveMechanicsLibrary = async (next: InteractionMechanicsLibrary) => {
    if (interactionLibraryError) throw new Error(interactionLibraryError);
    const current = workspaceRef.current;
    const universePath = fileStateRef.current.universePath;
    if (!current || !universePath) throw new Error(uiLocale === 'es' ? 'Abre un universo para guardar mecánicas.' : 'Open a universe to save mechanics.');
    const content = serializeInteractionMechanicsLibrary(next);
    const result = await saveUniverseBatch(universePath, universeBatchFiles(current.files, [{relativePath:interactionMechanicsPath,content}]));
    if (!result.ok) throw new Error(result.message ?? 'Cannot save mechanics library');
    if (fileStateRef.current.universePath !== universePath) return;
    setInteractionLibrary(next);
    setWorkspace(previous => {
      if (!previous) return previous;
      const updated = {...previous,files:[...previous.files.filter(file=>file.relativePath !== interactionMechanicsPath),{relativePath:interactionMechanicsPath,content,modifiedMs:result.files.find(file=>file.relativePath === interactionMechanicsPath)?.modifiedMs}]};
      workspaceRef.current = updated;
      return updated;
    });
  };
  const saveItemCatalog = async (next: ItemCatalogLibrary) => {
    if (itemCatalogError) throw new Error(itemCatalogError);
    const current = workspaceRef.current, universePath = fileStateRef.current.universePath;
    if (!current || !universePath) throw new Error(uiLocale === 'es' ? 'Abre un universo para guardar ítems globales.' : 'Open a universe to save global items.');
    const content = serializeItemCatalog(next);
    const result = await saveUniverseBatch(universePath, universeBatchFiles(current.files, [{ relativePath: itemCatalogPath, content }]));
    if (!result.ok) throw new Error(result.message ?? 'Cannot save item catalog');
    if (fileStateRef.current.universePath !== universePath) throw new Error('El universo cambió durante el guardado del catálogo.');
    setItemCatalog(next);
    setWorkspace(previous => {
      if (!previous) return previous;
      const updated = { ...previous, files: [...previous.files.filter(file => file.relativePath !== itemCatalogPath), { relativePath: itemCatalogPath, content, modifiedMs: result.files.find(file => file.relativePath === itemCatalogPath)?.modifiedMs }] };
      workspaceRef.current = updated;
      return updated;
    });
  };
  const refreshItemCatalog = async () => {
    const universePath = fileStateRef.current.universePath;
    if (!universePath) return;
    try {
      const opened = await openUniversePath(universePath);
      if (!opened.workspace || fileStateRef.current.universePath !== universePath) return;
      const next = itemCatalogFromFiles(opened.workspace.files), file = opened.workspace.files.find(item => item.relativePath === itemCatalogPath);
      setItemCatalog(next); setItemCatalogError(undefined);
      setWorkspace(previous => { if (!previous) return previous; const updated = { ...previous, files: [...previous.files.filter(item => item.relativePath !== itemCatalogPath), ...(file ? [file] : [])] }; workspaceRef.current = updated; return updated; });
    } catch (catalogError) { setItemCatalogError(catalogError instanceof Error ? catalogError.message : String(catalogError)); }
  };
  const refreshMechanicsLibrary = async () => {
    const universePath=fileStateRef.current.universePath;
    if (!universePath) return;
    try {
      const opened=await openUniversePath(universePath);
      if (!opened.workspace || fileStateRef.current.universePath !== universePath) return;
      const next=interactionLibraryFromFiles(opened.workspace.files);
      setInteractionLibrary(next); setInteractionLibraryError(undefined);
      const file=opened.workspace.files.find(item=>item.relativePath === interactionMechanicsPath);
      setWorkspace(previous=>{if (!previous) return previous; const updated={...previous,files:[...previous.files.filter(item=>item.relativePath !== interactionMechanicsPath),...(file?[file]:[])]};workspaceRef.current=updated;return updated;});
    } catch (libraryError) { setInteractionLibraryError(libraryError instanceof Error ? libraryError.message : String(libraryError)); }
  };
  const canonRefreshRevision = useRef<{ universePath: string; revision: number } | undefined>(undefined);
  useEffect(() => {
    if (!suiteChrome?.active || suiteChrome.canonRevision === undefined) return;
    const revision = suiteChrome.canonRevision;
    const universePath = fileStateRef.current.universePath;
    if (!universePath || !workspaceRef.current || initialLoading) return;
    if (canonRefreshRevision.current?.universePath === universePath && canonRefreshRevision.current.revision === revision) return;
    let cancelled = false;
    void openUniversePath(universePath).then(opened => {
      if (cancelled || fileStateRef.current.universePath !== universePath || !projectRef.current || !opened.workspace) return;
      const canonIndex = opened.workspace.canonIndex;
      const current = projectRef.current;
      const refs = [...canonIndex.canonRefs.map(ref=>({...ref,workingCopyPath:current.canonRefs.find(item=>item.id === ref.id)?.workingCopyPath})),...current.canonRefs.filter(ref=>!canonIndex.canonRefs.some(item=>item.id === ref.id))];
      applyProject({...current,canonRefs:refs,canonPropertyDescriptors:canonicalPropertyDescriptors(canonIndex.propertiesConfig)});
      setWorkspace(previous=>{ if (!previous) return previous; const next={...previous,canonIndex,activeProject:projectRef.current!}; workspaceRef.current=next; return next; });
      canonRefreshRevision.current={universePath,revision};
    }).catch(refreshError=>{if (!cancelled) setError(String(refreshError));});
    return ()=>{cancelled=true;};
  }, [suiteChrome?.active,suiteChrome?.canonRevision,fileState.universePath,initialLoading,applyProject]);
  if (error && !project) {
    return (
      <>
        <div className="app-shell">
          <Topbar
            fileState={fileState}
            exportOpen={exportOpen}
            theme={activeTheme}
            onOpenSettings={() => setShowSettings(true)}
            onRevealUniverse={revealUniverse}
            onToggleTheme={toggleTheme}
            onExportRuntime={exportRuntime}
            onHome={() => setView("home")}
            onFeedback={() => setShowFeedback(true)}
            onUndo={undoProject}
            onRedo={redoProject}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            suiteChrome={suiteChrome}
          />
          {webPreviewBanner}
          <div className="error-state">{error}</div>
        </div>
        {settingsModal}
        {appDialogs}
      </>
    );
  }

  if (initialLoading) {
    return (
      <>
        <div className="app-shell">
          <Topbar
            fileState={fileState}
            exportOpen={exportOpen}
            theme={activeTheme}
            onOpenSettings={() => setShowSettings(true)}
            onRevealUniverse={revealUniverse}
            onToggleTheme={toggleTheme}
            onExportRuntime={exportRuntime}
            onHome={() => setView("home")}
            onFeedback={() => setShowFeedback(true)}
            onUndo={undoProject}
            onRedo={redoProject}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
          suiteChrome={suiteChrome}
          />
          {webPreviewBanner}
          <BrandLoadingScreen message={settings.lastOpenedProject ? uiLocale === "es" ? "Abriendo tu universo…" : "Opening your universe…" : uiLocale === "es" ? "Preparando tu biblioteca…" : "Preparing your dashboard…"} />
        </div>
        {settingsModal}
        {appDialogs}
      </>
    );
  }

  if (view === "home" || !project) {
    return (
      <>
        <HomeDashboard
          project={project}
          workspace={workspace}
          fileState={fileState}
          settings={settings}
          missingRecentProjects={missingRecentProjects}
          findings={findings}
          theme={activeTheme}
          onOpenSettings={() => setShowSettings(true)}
          onToggleTheme={toggleTheme}
          onEnterWorkspace={() => setView("workspace")}
          onOpenDemoUniverse={isTauriRuntime() ? undefined : openDemoProject}
          onOpenProject={openProject}
          onOpenRecentProject={openRecentProject}
          onRemoveRecentProject={removeRecentProject}
          onExportRuntime={exportRuntime}
          onFeedback={() => setShowFeedback(true)}
          desktopMenu={isTauriRuntime() && !suiteChrome}
          windowControlsManaged={suiteChrome?.windowControlsManaged}
          appSwitcher={suiteChrome?.renderAppSwitcher()}
        />
        {webPreviewBanner}
        {settingsModal}
        {appDialogs}
      </>
    );
  }

  return (
    <ItemCatalogContext.Provider value={{ library: itemCatalog, error: itemCatalogError, refresh: refreshItemCatalog, save: saveItemCatalog }}>
    <ConditionReferenceCreationContext.Provider value={{ propertiesConfig: workspace?.canonIndex.propertiesConfig, create: (draft, onCreated) => {
      const base = projectRef.current;
      if (!base || base.projectId !== project.projectId || base.storyId !== project.storyId) throw new Error('La historia cambió. Vuelve a abrir la condición.');
      const created = createConditionReference(base, draft);
      const capture: { edited?: BranchingProject } = {};
      creationCaptureRef.current = capture;
      try { onCreated(created.condition); } finally { creationCaptureRef.current = undefined; }
      const next = mergeConditionReferenceCreation(base, created.project, capture.edited ?? base);
      void commitStructuralAction(draft.kind === 'value' ? 'Created and linked variable' : draft.kind === 'external' ? 'Created and linked external condition function' : 'Created and linked local entity', next);
    } }}>
    <InteractionAuthoringContext.Provider value={{library:interactionLibrary,libraryError:interactionLibraryError,refreshLibrary:refreshMechanicsLibrary,onLibraryChange:saveMechanicsLibrary,libraryEditor:interactionLibraryEditor,openLibrary:(presetId)=>{setInteractionLibraryEditor(current=>({presetId,revision:(current?.revision??0)+1,projectId:project.projectId}));setPanelVisibility(current=>({...current,assets:true}));setPanelCollapsedState('assets',false);setExplorerTab('assets');setRequestedPanel(current=>({id:'assets',revision:(current?.revision??0)+1}));}}}>
      <div className="app-shell" ref={appShellRef}>
        <Topbar
          project={project}
          managementInSidebar
          fileState={fileState}
          exportOpen={exportOpen}
          theme={activeTheme}
          onOpenSettings={() => setShowSettings(true)}
          onRevealUniverse={revealUniverse}
          onToggleTheme={toggleTheme}
          onExportRuntime={exportRuntime}
          onHome={() => setView("home")}
          onFeedback={() => setShowFeedback(true)}
          onUndo={undoProject}
          onRedo={redoProject}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          recentActions={actionHistory}
          suiteChrome={suiteChrome}
          locale={uiLocale}
          saveState={saveError ? "error" : saveInProgress ? "saving" : fileState.dirty ? "pending" : fileState.lastSavedAt ? "saved" : undefined}
          saveError={saveError}
          loadWarnings={workspace?.loadWarnings}
          hasUnappliedDraft={Boolean(recoverableDraftCount || eventDraft?.dirty || Object.values(manualInspectorDrafts).some((draft) => draft.dirty) || markdownTabs.some((tab) => tab.dirty))}
          onRetrySave={() => { void persistProject({ manual: true }).catch(() => undefined); }}
          onOpenExportPanel={() => { setPanelVisibility((current) => ({ ...current, export: true })); setPanelCollapsedState("export", false); }}
          onResetLayout={() => { setPanelVisibility(DEFAULT_WORKSPACE_PANEL_VISIBILITY); setPanelCollapsed(DEFAULT_WORKSPACE_PANEL_COLLAPSED); setStoriesWidth(DEFAULT_PANEL_WIDTH); setRequestedPanel((current) => ({ revision: (current?.revision ?? 0) + 1 })); }}
          panelVisibility={panelVisibility}
          onTogglePanelVisibility={togglePanelVisibility}
        />
        {webPreviewBanner}

        {workspace?.saveBlocked ? <div className="workspace-error-banner" role="alert"><span>{uiLocale === "es" ? "La carga está incompleta. El guardado se ha bloqueado para conservar los archivos." : "Loading is incomplete. Saving is blocked to preserve the files."}<details><summary>{uiLocale === "es" ? "Ver causas" : "View reasons"}</summary><ul>{workspace.saveBlockReasons?.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details></span></div> : null}

        {pendingRecovery ? <div className="workspace-error-banner" role="status"><span>{uiLocale === "es" ? "Hay una edición recuperable que no llegó a guardarse en disco." : "An unsaved editing session can be recovered."}</span><button type="button" onClick={() => { void commitStructuralAction("Recovered editing session", pendingRecovery.project); setPendingRecovery(undefined); }}>{uiLocale === "es" ? "Recuperar edición" : "Recover edits"}</button><button type="button" onClick={() => { if (fileState.universePath && project.storyId) clearAuthoringRecovery(fileState.universePath, project.storyId); setPendingRecovery(undefined); }}>{uiLocale === "es" ? "Descartar recuperación" : "Discard recovery"}</button></div> : null}
        <AdaptiveWorkspace resizing={panelResizing} requestedPanel={requestedPanel}
          explorerWidth={canonWidth}
          onExplorerResize={resizeCanon}
          onExplorerResizeStateChange={setPanelResizing}
          onResetExplorerWidth={() => setCanonWidth(DEFAULT_EXPLORER_WIDTH)}
          explorerTab={explorerTab} onExplorerTabChange={setExplorerTab}
          onCollapsedChange={setPanelCollapsedState}
          panels={VISIBLE_WORKSPACE_PANEL_IDS.map((id) => ({ id, visible: panelVisibility[id], collapsed: panelCollapsed[id], width: id === "outline" ? storiesWidth : DEFAULT_PANEL_WIDTH }))}>
          {panelVisibility.assets ? <WorkspacePanelSlot id="assets" side="left" title={uiCopy.assets}><AssetsPanel
            project={project}
            propertiesConfig={workspace?.canonIndex.propertiesConfig}
            collapsed={panelCollapsed.assets}
            onCollapsedChange={(collapsed) => setPanelCollapsedState("assets", collapsed)}
            onContextMenu={openPanelContextMenu}
            onImport={() => void importAssets()}
            onImportInteractionImage={importInteractionPreviewImage}
            selected={selection}
            onSelect={target=>{if(target && eventInspector.open)openInspector(target);else setSelection(target);}}
            onOpenInspector={selectWithEventDraftGuard}
            onCreateEntity={createExplorerEntity}
            onDeleteEntity={requestDeleteLocalExplorerEntity}
            onInitializeProperties={initializePropertiesFromTemplate}
            currentEventId={activeScope?.kind === "event" ? activeScope.id : activeScope?.kind === "dialogue" ? activeScope.eventId : undefined}
            currentDialogueId={activeScope?.kind === "dialogue" ? activeScope.id : undefined}
            characterSheets={{initialOwnerLabel:storyTest.scenario?.name,initialState:storyTest.scenarioState,currentState:storyTest.active?storyTest.state:undefined,onOpenCanonEntity:suiteChrome?.onOpenCanonEntity ?? (target=>{const ref=project.canonRefs.find(item=>item.id === target.entityId);setMessage(`${uiLocale === 'es'?'Edita la ficha y vuelve a abrir el universo':'Edit the sheet and reopen the universe'}: ${ref?.canonSourcePath ?? target.entityId}`);})}}
            onUpdateProject={updateProject}
          /></WorkspacePanelSlot> : null}
          {panelVisibility.logic ? <WorkspacePanelSlot id="logic" side="left" title={uiCopy.logic}><LogicPanel
            project={project}
            propertiesConfig={workspace?.canonIndex.propertiesConfig}
            collapsed={panelCollapsed.logic}
            onCollapsedChange={(collapsed) => setPanelCollapsedState("logic", collapsed)}
            onContextMenu={openPanelContextMenu}
            onUpdate={(nextProject) => updateProject(nextProject)}
            selected={selection}
            onSelect={target=>{if(target && eventInspector.open)openInspector(target);else setSelection(target);}}
            onOpenInspector={selectWithEventDraftGuard}
            onCreateProperty={createExplorerProperty}
            onInitializeProperties={initializePropertiesFromTemplate}
            onUpdateLocalExplorerProperty={updateLocalExplorerProperty}
            onUpdateLogicPropertyOverride={updateLogicPropertyOverride}
            onUpdateLogicTypeOverride={updateLogicTypeOverride}
            onDeleteLocalExplorerProperty={deleteLocalExplorerProperty}
            onCreateType={createExplorerType}
          /></WorkspacePanelSlot> : null}
          {panelVisibility.outline ? <WorkspacePanelSlot id="outline" side="left" title={uiCopy.stories} mode="open"><FilesPanel
            project={project}
            files={files}
            stories={workspace?.manifest.stories ?? []}
            activeStoryId={workspace?.activeStory?.id}
            storyName={workspace?.activeStory?.name}
            open={!panelCollapsed.outline}
            selectedId={storyExplorerSelectionId(project, selection)}
            onToggle={() => setPanelCollapsedState("outline", !panelCollapsed.outline)}
            onResize={resizeStories}
            onResetWidth={() => setStoriesWidth(DEFAULT_PANEL_WIDTH)}
            onResizeStateChange={setPanelResizing}
            onSequenceChange={setActiveSequence}
            onStoryChange={setActiveStory}
            onCreateStory={requestCreateStory}
            onRenameStory={requestRenameStory}
            onDeleteStory={requestDeleteStory}
            onCreateSequence={requestCreateSequence}
            onRenameSequence={requestRenameSequence}
            onDeleteSequence={requestDeleteSequence}
            onUpdateSequence={updateSequence}
            onCreateSequenceCharacter={createSequenceCharacter}
            onCreateBranch={() => createBranch()}
            onUpdateBranch={updateBranch}
            onDeleteBranch={(id) => deleteSelection({ type: "node", id })}
            onCreateEventInBranch={createEventInBranch}
            onAssignEventToBranch={assignEventBranch}
            onSelect={handleFileSelect}
            activeOutlineTab={storyOutlineTab}
            onOutlineTabChange={setStoryOutlineTab}
            onNavigatePathNode={navigatePathTreeNode}
            onContextMenu={openPanelContextMenu}
            propertiesConfig={workspace?.canonIndex.propertiesConfig}
          /></WorkspacePanelSlot> : null}
          {!workspace?.activeStory?.id ? (
            <StoryCreationEmptyState kind="story" onOpenStories={openStoriesForOnboarding} />
          ) : !activeSequenceId(project) ? (
            <StoryCreationEmptyState kind="sequence" />
          ) : <StoryCanvas
            contextTab={contextTab} contextFocus={contextFocus && (eventInspector.open || storyTest.active)} onContextTabChange={setContextTab} onContextFocusChange={setContextFocus}
            project={project}
            storyTestActive={storyTest.active} inspectorRequest={inspectorRequest} inspectorSections={inspectorSections} inspectorSize={inspectorSize} onInspectorResize={setInspectorSize} inspectorStackOrder={inspectorStackOrder} onInspectorStackOrderChange={setInspectorStackOrder} onInspectorSectionChange={rememberInspectorSection}
            onAuthoringMutation={async mutate=>{if(projectRef.current) await commitStructuralAction("Updated story",mutate(projectRef.current));}}
            onOpenInspectorSection={openInspector} onOpenStoryPlay={openStoryPlay} onPinInspectorTarget={pinInspectorTarget} onUnpinInspectorTarget={unpinInspectorTarget}
            onCollapseInspector={()=>{setEventInspector(state=>({...state,open:true,expandedEventId:undefined}));setExpandedInspectorTabId(undefined);if(selection?.type==="node"){deselectCanvasNode(selection.id);setSelection(undefined);}if(selection?.type==="storyDebug")dispatchStoryTest({type:"debug",open:false});}}
            inspectorDebugContent={<div className="inspector-debug-content"><button type="button" onClick={()=>dispatchStoryTest({type:"debug",open:false})}>{uiLocale === "es" ? "Cerrar depuración" : "Close debug"}</button>{storyTestWindows.canDetach ? <button type="button" onClick={()=>{void storyTestWindows.detach("preview");}}>{uiLocale === "es" ? "Abrir Play Mode completo" : "Open full Play Mode"}</button> : null}<StoryTestDebug integrated snapshot={storyTest} dispatch={dispatchStoryTest}/></div>}
            propertiesConfig={workspace?.canonIndex.propertiesConfig}
            files={files}
            nodes={testCanvasNodes}
            edges={testCanvasEdges}
            selection={selection}
            findings={findings}
            message={message}
            showStatusMessages={settings.showStatusMessages}
            activeScope={activeScope}
            primaryLocale={fileState.universeProfile?.localization?.primaryLocale ?? machineLocale()}
            locales={fileState.universeProfile?.localization?.locales ?? [machineLocale()]}
            localeNames={fileState.universeProfile?.localization?.localeNames}
            exportOpen={exportOpen}
            exportPreviewMode={exportPreviewMode}
            dataOpen={dataOpen}
            markdownTabs={markdownTabs}
            activeMarkdownTabId={activeMarkdownTabId}
            eventDraft={eventDraft}
            manualInspectorDraft={activeManualInspectorDraft}
            manualInspectorEnabled={Boolean(manualInspectorDraftKey(selection))}
            eventInspector={eventInspector}
            eventInspectorTabGroups={eventInspectorTabGroups}
            inspectorTabs={inspectorTabs}
            expandedInspectorTabId={expandedInspectorTabId}
            inspectorMaximized={inspectorMaximized}
            canvasBackground={settings.canvasBackground}
            storyTestControls={<StoryTestControls compact snapshot={storyTest} dispatch={dispatchStoryTest} onOpenPlay={openStoryPlay} showScenarioManager />}
            testingActive={storyTest.active}
            storyTestWorkspace={storyTestWindows.detached.preview ? <div className="pb-context-empty"><strong>{uiLocale === "es" ? "La prueba está en otra ventana" : "Testing is in another window"}</strong><p>{uiLocale === "es" ? "El recorrido y sus valores se mantienen en este documento." : "The run and its values remain in this document."}</p><button type="button" onClick={() => { void storyTestWindows.redock("preview"); }}>{uiLocale === "es" ? "Volver a acoplar" : "Redock"}</button></div> : <StoryTestPlayback snapshot={storyTest} dispatch={dispatchStoryTest} locale={uiLocale} />}
            storyTestPlayTab={<>
              {storyTestWindows.detached.preview
                ? <div className="pb-context-empty"><strong>{uiLocale === "es" ? "Play Mode y Debug están en otra ventana" : "Play Mode and Debug are in another window"}</strong><p>{uiLocale === "es" ? "La reproducción, configuración y traza siguen vinculadas a este documento." : "Playback, settings and trace remain connected to this document."}</p><button type="button" onClick={() => { void storyTestWindows.redock("preview"); }}>{uiLocale === "es" ? "Volver al inspector" : "Return to inspector"}</button></div>
                : <StoryTestInspectorView snapshot={storyTest} dispatch={dispatchStoryTest} locale={uiLocale} fullscreen={contextFocus} detachable={storyTestWindows.canDetach} onDetach={detachStoryPlay} onOpenPlay={openStoryPlay} />}
              {storyTestWindows.error ? <div className="story-test-window-error" role="alert"><span>{uiLocale === "es" ? "No se pudo desacoplar. El recorrido sigue disponible aquí." : "Could not detach. The run remains available here."} {storyTestWindows.error}</span><button type="button" onClick={storyTestWindows.clearError}>{uiLocale === "es" ? "Cerrar" : "Dismiss"}</button></div> : null}
            </>}
            minimapOpen={settings.minimapOpen}
            onMinimapOpenChange={(open) => setSettings((current) => ({ ...current, minimapOpen: open }))}
            canvasLayerMode={canvasLayerMode}
            onCanvasLayerModeChange={changeCanvasLayerMode}
            onCanvasBackgroundChange={changeCanvasBackground}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onAddTransitionWaypoint={addTransitionWaypoint}
            onMoveTransitionWaypoint={moveTransitionWaypoint}
            onRemoveTransitionWaypoint={removeTransitionWaypoint}
            onNodeDragStop={handleNodeDragStop}
            onSelect={selectWithEventDraftGuard}
            onCanvasSelect={setSelection}
            onOpenCanvasInspector={selectWithEventDraftGuard}
            onNavigateScope={navigateCanvasScope}
            onOpenEventScript={(eventId,textKey)=>openInspector({type:"node",id:eventId},"path",textKey)}
            onExportPreviewModeChange={setExportPreviewMode}
            onToggleData={() => setDataOpen((open) => !open)}
            onCreateEvent={createEvent}
            onCreateNestedEvent={createNestedEvent}
            onCreateConnectedNestedEvent={createConnectedNestedEvent}
            onCreateConnectedNarrativeNode={createConnectedNarrativeNode}
            onCreateConnectedEvent={createConnectedEvent}
            onUpdateSequence={updateSequence}
            onUpdateBranch={updateBranch}
            onCreateEventInBranch={createEventInBranch}
            onUpdateEvent={updateEvent}
            onApplyEvpath={applyEvpath}
            onCreateDecision={createDecision}
            onCreateDialogue={createDialogue}
            onCreateDialogueBeat={createDialogueBeat}
            onCreateEventDialogueBeat={createEventDialogueBeat}
            onUpdateDecision={updateDecision}
            onUpdateDialogue={updateDialogue}
            onUpdateDialogueBeat={updateDialogueBeat}
            onUpdateEventDialogueBeat={updateEventDialogueBeat}
            onUpdateSpeechBeatCounter={updateSpeechBeatCounter}
            onImportSceneImage={importSceneImageForBeat}
            onImportEventCoverImage={importEventCoverImage}
            onAuxiliaryPanelChange={changeAuxiliaryPanel}
            onUpdateScriptBlock={updateCanvasScriptBlock}
            onCreateLocalSpeaker={createCanvasLocalSpeaker}
            onUpdateLocalizedText={updateCanvasLocalizedText}
            onDeleteDialogueBeat={deleteDialogueBeat}
            onDeleteEventDialogueBeat={deleteEventDialogueBeat}
            onDeleteDecision={deleteDecision}
            onDeleteDialogue={deleteDialogue}
            onCreateOutcome={createOutcome}
            onUpdateOutcome={updateOutcome}
            onDeleteOutcome={deleteOutcome}
            onUpdateTransition={updateTransition}
            onCreateBoundaryRoute={createBoundaryRoute}
            onCreateBoundaryRouteEvent={createBoundaryRouteEvent}
            onCreateDialogueBoundaryRoute={createDialogueBoundaryRoute}
            onCreateBoundaryEnd={createBoundaryEnd}
            onDeleteBoundaryEnd={deleteBoundaryEnd}
            onDiscardPendingBoundaryPort={discardPendingBoundaryPort}
            onBoundarySelectionChange={onBoundarySelectionChange}
            onWorkspaceBoundsChange={changeSubcanvasWorkspace}
            onArrangeScopeNodes={arrangeScopeNodes}
            onRemoveMissingEventReference={removeMissingEventReference}
            onRemoveBoundaryBinding={removeBoundaryBinding}
            onNormalizeTransitionOrder={normalizeTransitionOrder}
            onDeleteScriptBlock={deleteScriptBlock}
            onFocusScriptBlock={focusScriptBlock}
            onDeleteTransition={deleteTransition}
            onCreateScriptTransition={createScriptTransition}
            onCreateCanonSuggestion={createCanonSuggestion}
            onUpdateCanonSuggestion={updateCanonSuggestion}
            onDeleteCanonSuggestion={deleteCanonSuggestion}
            onCreateDataObject={createDataObject}
            onCreateKnowledgeObject={createKnowledgeObject}
            onUpdateDataObject={updateDataObject}
            onDeleteDataObject={deleteDataObject}
            onEditCanonRef={editCanonRefInBranch}
            onCreateCanonWorkingCopy={createCanonWorkingCopy}
            onSaveCanonWorkingCopy={saveCanonWorkingCopy}
            onExportCanonChangeSet={exportCanonChangeSet}
            onApplyCanonWorkingCopy={applyCanonWorkingCopy}
            onUpdateLocalExplorerEntity={updateLocalExplorerEntity}
            onPublishLocalExplorerEntity={publishLocalExplorerEntity}
            onUpdateLocalExplorerType={updateLocalExplorerType}
            onUpdateLocalExplorerProperty={updateLocalExplorerProperty}
            onUpdateLogicPropertyOverride={updateLogicPropertyOverride}
            onUpdateLogicTypeOverride={updateLogicTypeOverride}
            onUpdateCharacterCategories={updateCharacterCategories}
            onUpdateEdgeLabel={updateEdgeLabel}
            onDeleteSelection={deleteSelection}
            onDeleteNodeSelections={deleteNodeSelections}
            onGroupDialogueMembers={groupDialogueMembers}
            onDetachDialogueMembers={detachDialogueMembers}
            onDissolveDialogue={dissolveDialogue}
            onCreateDialogueStart={createDialogueStart}
            onCreateInteraction={createInteractionNode}
            onOpenRule={openLogicRule}
            onActivateMarkdownTab={setActiveMarkdownTabId}
            onCloseMarkdownTab={closeMarkdownTab}
            onChangeMarkdownContent={changeMarkdownContent}
            onChangeMarkdownFormat={changeMarkdownFormat}
            onSaveMarkdownTab={saveMarkdownTab}
            onOpenEventInspectorEvent={openEventInspectorForEvent}
            onCollapseEventInspectorEvent={collapseEventInspectorForEvent}
            collapseInspectorTabOnCanvasClick={
              settings.collapseInspectorTabOnCanvasClick
            }
            onCloseEventInspectorEvent={requestCloseEventInspectorForEvent}
            onCloseAllEventInspectorEvents={closeAllInspectorTabs}
            onCloseEventInspectorEventsAbove={closeInspectorTabsAbove}
            onCloseEventInspectorEventsBelow={closeInspectorTabsBelow}
            onCloseOtherEventInspectorEvents={closeOtherInspectorTabs}
            onPruneEventInspectorEvents={pruneEventInspectorEvents}
            onSaveEventInspectorTabGroup={requestSaveInspectorTabGroup}
            onLoadEventInspectorTabGroup={requestLoadInspectorTabGroup}
            onDeleteEventInspectorTabGroup={deleteInspectorTabGroup}
            onOpenInspectorTab={openInspectorTab}
            onCloseInspectorTab={closeInspectorTab}
            onCloseAllInspectorTabs={closeAllInspectorTabs}
            onCloseInspectorStackRange={closeInspectorStackRange}
            onDisableInspectorDebug={() => changeInspectorDebugEnabled(false)}
            onToggleInspectorMaximized={() => setInspectorMaximized((current) => !current)}
            onSaveManualInspector={() => {
              void saveActiveManualInspectorDraft();
            }}
          />}
          {panelVisibility.export ? <WorkspacePanelSlot id="export" side="left" title={uiCopy.exportImport}><ExportPanel
            project={project}
            collapsed={panelCollapsed.export}
            {...stableExportPanelActions}
            locale={uiLocale}
          /></WorkspacePanelSlot> : null}
          {panelVisibility.connect ? <WorkspacePanelSlot id="connect" side="left" title={uiCopy.connect}><ConnectPanel
            collapsed={panelCollapsed.connect}
            onCollapsedChange={(collapsed) => setPanelCollapsedState("connect", collapsed)}
            onContextMenu={openPanelContextMenu}
          /></WorkspacePanelSlot> : null}
        </AdaptiveWorkspace>
        {panelContextMenu ? (
          <div
            ref={panelContextMenuRef}
            className="panel-picker panel-context-menu"
            role="menu"
            style={{ left: panelContextMenu.x, top: panelContextMenu.y }}
          >
            <strong>Panels</strong>
            {VISIBLE_WORKSPACE_PANEL_IDS.map((panel) => (
              <button
                key={panel}
                type="button"
                role="menuitemcheckbox"
                aria-checked={panelVisibility[panel]}
                onClick={() => {
                  togglePanelVisibility(panel);
                }}
              >
                {panelVisibility[panel] ? "✓" : ""} {WORKSPACE_PANEL_LABELS[panel]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {project ? <ExportPreviewDialog project={project} mode={exportPreviewMode} open={exportOpen} onClose={() => setExportOpen(false)} onExport={(mode) => void exportRuntime(mode)} /> : null}
      {!suiteChrome?.learning && !onboardingDismissed && !showInteractionTutorial && !showSettings && !exportOpen ? (
        <OnboardingGuide
          locale={uiLocale}
          steps={pathBranchingOnboardingSteps}
          onDismiss={dismissPathBranchingOnboarding}
          onRestart={restartPathBranchingOnboarding}
          onOpenStories={openStoriesForOnboarding}
        />
      ) : null}
      {!suiteChrome?.learning && showInteractionTutorial ? (
        <InteractionTutorial
          locale={interactionTutorialLocale}
          onDismiss={dismissInteractionTutorial}
        />
      ) : null}
      {settingsModal}
      {appDialogs}
      {showFeedback ? <FeedbackModal screen="workspace" onClose={() => setShowFeedback(false)} onOpenExternal={(url) => { window.open(url, "_blank", "noopener,noreferrer"); }} /> : null}
    </InteractionAuthoringContext.Provider>
    </ConditionReferenceCreationContext.Provider>
    </ItemCatalogContext.Provider>
  );
}
