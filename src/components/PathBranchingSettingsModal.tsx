import { SettingsFrame, settingsContent } from "../SettingsFrame";
import type { SettingsHost, SettingsDraft } from "../settingsIntegration";
import { pathbranchingSettingsPages, pathbranchingSettingsPage } from "../settingsCatalog";
import { SceneChoices } from "../SceneChoices";
import { LocaleSettingsFields } from "./LocaleSettingsFields.js";
import { EverendBridgePanel } from "./EverendBridgePanel.js";
import { UniverseIconFrame } from "./UniverseIconFrame.js";
import { BookOpen, Castle, FolderOpen, Globe2, GitBranch, RefreshCw, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Branch, BranchingProject, Decision, EventCategoryDefinition, Outcome, Sequence, SpeechBeatCounterPreference, ValidationFinding } from "../domain.js";
import { machineLocale } from "../localization.js";
import { projectFileName, type ProjectFileState } from "../projectPersistence.js";
import { DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE } from "../projectSerialization.js";
import { type UniverseProfile } from "../pathBranchingWorkspace.js";
import { THEMES, isDarkTheme, normalizeThemeId, type ThemeId } from "../themes.js";
import type { SuiteSettings } from "../suiteChrome.js";
import { type AppSettings, type AuthoringDisplaySettings, type CanvasBackgroundSettings, type NodeColorSettings } from "../workspaceSettings.js";
import { interfaceLocaleCopy, pathbranchingSettingsCopy, resolveInterfaceLocale, useInterfaceLocale } from "../i18n.js";

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

export type PathBranchingSettingsSection =
  | "suite"
  | "update"
  | "overview"
  | "authoring"
  | "markdown"
  | "bridge"
  | "workspace"
  | "recents"
  | "tutorials";

const primaryFontOptions = [
  ["sans", "Sans serif"],
  ["serif", "Serif editorial"],
  ["humanist", "Humanist"],
] as const;

const NODE_COLOR_FIELDS: Array<{
  key: keyof NodeColorSettings;
  label: string;
}> = [
  { key: "sequence", label: "Sequence" },
  { key: "start", label: "Start" },
  { key: "branch", label: "Branch" },
  { key: "event", label: "Event" },
  { key: "decision", label: "Decision" },
  { key: "outcome", label: "Outcome" },
  { key: "inkSection", label: "Ink" },
  { key: "knowledge", label: "Knowledge" },
  { key: "runtimeAction", label: "Runtime action" },
];

function EventCategoriesSettings({
  categories,
  usedCategoryIds,
  onChange,
}: {
  categories: EventCategoryDefinition[];
  usedCategoryIds: Set<string>;
  onChange: (categories: EventCategoryDefinition[]) => void;
}) {
  const locale = useInterfaceLocale();
  const fixedCategoryIds = new Set(["normal", "final"]);
  const updateCategory = (
    id: string,
    updates: Partial<EventCategoryDefinition>,
  ) => {
    onChange(
      categories.map((category) =>
        category.id === id
          ? {
              ...category,
              ...updates,
              terminal:
                category.id === "final"
                  ? true
                  : category.id === "normal"
                    ? false
                    : (updates.terminal ?? category.terminal),
            }
          : category,
      ),
    );
  };
  const addCategory = () => {
    const id = uniqueId(
      "custom",
      categories.map((category) => category.id),
    );
    onChange([...categories, { id, label: "Custom" }]);
  };
  const deleteCategory = (id: string) => {
    if (fixedCategoryIds.has(id) || usedCategoryIds.has(id)) return;
    onChange(categories.filter((category) => category.id !== id));
  };

  return settingsContent((
    <section className="settings-subsection">
      <div className="settings-page-title compact">
        <h3>Event categories</h3>
        <p>
          Project-level categories used by event nodes. Terminal categories
          cannot create outgoing transitions.
        </p>
      </div>
      <div className="settings-category-list">
        {categories.map((category) => {
          const isFixed = fixedCategoryIds.has(category.id);
          const isUsed = usedCategoryIds.has(category.id);
          return (
            <div className="mini-card category-editor" key={category.id}>
              <label className="field-label">
                Label
                <input
                  value={category.label}
                  onChange={(event) =>
                    updateCategory(category.id, { label: event.target.value })
                  }
                />
              </label>
              <label className="field-label color-field">
                Color
                <input
                  type="color"
                  value={category.color ?? "#4f8cff"}
                  onChange={(event) =>
                    updateCategory(category.id, { color: event.target.value })
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(category.terminal)}
                  disabled={category.id === "final" || category.id === "normal"}
                  onChange={(event) =>
                    updateCategory(category.id, {
                      terminal: event.target.checked,
                    })
                  }
                />
                Terminal
              </label>
              <span>
                {category.id}
                {isUsed ? " - in use" : ""}
              </span>
              <button
                type="button"
                className="danger"
                disabled={isFixed || isUsed}
                title={
                  isFixed
                    ? "Default categories cannot be deleted."
                    : isUsed
                      ? "Category is used by one or more events."
                      : "Delete category"
                }
                onClick={() => deleteCategory(category.id)}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
      <div className="inspector-actions">
        <button type="button" onClick={addCategory}>
          Add Category
        </button>
      </div>
    </section>
  ), locale);
}

const integratedSettingsPages = pathbranchingSettingsPages.filter(item => !["pathbranching.general","pathbranching.overview","pathbranching.recents","pathbranching.tutorials"].includes(item.id));
const legacyHostPages = [...pathbranchingSettingsPages, ...["language","update"].map(id => ({ id: "suite."+id, owner: "suite", group: {en:"General",es:"General"}, title: id === "language" ? {en:"Suite preferences",es:"Preferencias de la Suite"} : id === "update" ? {en:"Updates",es:"Actualizaciones"} : {en:"License",es:"Licencia"}, controls: [] }))];

export function PathBranchingSettingsModal({
  project,
  fileState,
  settings,
  findings,
  theme,
  onUpdateEventCategories,
  onAuthoringDisplayChange,
  onUpdateSpeechBeatCounter,
  onCanvasBackgroundChange,
  onNodeColorChange,
  onInterfaceFontChange,
  onThemeChange,
  onToggleTheme,
  onAmbientBackgroundChange,
  onBackgroundSceneChange,
  onInspectorTabCloseSelectsNextChange,
  onCollapseInspectorTabOnCanvasClickChange,
  onInspectorDebugEnabledChange,
  onShowStatusMessagesChange,
  onLocalePreferenceChange,
  onOpenUniverse,
  onOpenRecentUniverse,
  onRemoveRecentUniverse,
  onSaveUniverseProfile,
  onResetOnboarding,
  onClose,
  suiteSettings,
  initialSection,
  settingsHost,
  hidden = false,
}: {
  project?: BranchingProject;
  fileState: ProjectFileState;
  settings: AppSettings;
  findings: ValidationFinding[];
  theme: ThemeId;
  onUpdateEventCategories: (categories: EventCategoryDefinition[]) => void;
  onAuthoringDisplayChange: (updates: Partial<AuthoringDisplaySettings>) => void;
  onUpdateSpeechBeatCounter: (updates: Partial<SpeechBeatCounterPreference>) => void;
  onCanvasBackgroundChange: (
    updates: Partial<CanvasBackgroundSettings>,
  ) => void;
  onNodeColorChange: (updates: Partial<NodeColorSettings>) => void;
  onInterfaceFontChange?: (font: NonNullable<AppSettings["interfaceFont"]>) => void;
  onThemeChange: (theme: ThemeId) => void;
  onToggleTheme: () => void;
  onAmbientBackgroundChange: (enabled: boolean) => void;
  onBackgroundSceneChange: (scene: string) => void;
  onInspectorTabCloseSelectsNextChange: (value: boolean) => void;
  onCollapseInspectorTabOnCanvasClickChange: (value: boolean) => void;
  onInspectorDebugEnabledChange: (value: boolean) => void;
  onShowStatusMessagesChange: (value: boolean) => void;
  onLocalePreferenceChange: (value: AppSettings["localePreference"]) => void;
  onOpenUniverse: () => void;
  onOpenRecentUniverse: (path: string) => void;
  onRemoveRecentUniverse: (path: string) => void;
  onSaveUniverseProfile: (profile: UniverseProfile) => Promise<void>;
  onResetOnboarding: () => void;
  onClose: () => void;
  suiteSettings?: SuiteSettings;
  initialSection?: PathBranchingSettingsSection;
  settingsHost?: SettingsHost;
  hidden?: boolean;
}) {
  const [bridgePairingCode, setBridgePairingCode] = useState("");
  const [localPage, setLocalPage] = useState(() => pathbranchingSettingsPage(initialSection ?? "authoring"));
  const page = settingsHost?.page ?? localPage;
  useEffect(() => { if (!hidden && !settingsHost) setLocalPage(pathbranchingSettingsPage(initialSection)); }, [hidden, initialSection, settingsHost?.open]);
  const activeSection = page === "suite.language" ? "suite" : page.split(".").at(-1)!;
  useEffect(() => { if (!hidden && settingsHost) settingsHost.open(pathbranchingSettingsPage(initialSection)); }, [hidden, initialSection, settingsHost?.open]);
  const wasHostVisible = useRef(false);
  useEffect(() => { if (wasHostVisible.current && !settingsHost?.visible) onClose(); wasHostVisible.current = Boolean(settingsHost?.visible); }, [settingsHost?.visible]);
  const interfaceCopy = interfaceLocaleCopy(
    resolveInterfaceLocale(suiteSettings?.localePreference ?? settings.localePreference),
  );
  const settingsText = pathbranchingSettingsCopy(
    resolveInterfaceLocale(suiteSettings?.localePreference ?? settings.localePreference),
  );
  const locale = useInterfaceLocale();
  const overlayRef = useRef<HTMLDivElement>(null);

  const errorCount = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const warningCount = findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const universeName = universeDisplayName(project, fileState);
  const universePath = universeDisplayPath(fileState);
  const profileValue = () => ({ ...fileState.universeProfile, name: fileState.universeProfile?.name ?? universeName, icon: fileState.universeProfile?.icon ?? { type: "preset" as const, value: "book" }, localization: fileState.universeProfile?.localization ?? { primaryLocale: machineLocale(), locales: [machineLocale()] } });
  const [profileDraft, setProfileDraft] = useState<UniverseProfile>(profileValue);
  const [baseline, setBaseline] = useState<UniverseProfile>(profileValue);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const dirty = JSON.stringify(profileDraft) !== JSON.stringify(baseline);
  const draftRef = useRef(profileDraft); draftRef.current = profileDraft;
  const draftPath = useRef(fileState.universePath);
  useEffect(() => {
    if (draftPath.current !== fileState.universePath || !dirty) { const value = profileValue(); setProfileDraft(value); setBaseline(value); }
    draftPath.current = fileState.universePath;
  }, [fileState.universePath, fileState.universeProfile, universeName]);
  const saveProfile = async () => {
    const snapshot = draftRef.current; setProfileSaving(true); setProfileError("");
    try { await onSaveUniverseProfile(snapshot); setBaseline(snapshot); }
    catch (error) { setProfileError(String(error)); throw error; }
    finally { setProfileSaving(false); }
  };
  const draft: SettingsDraft = { dirty, busy: profileSaving, save: saveProfile, discard: () => { const value = profileValue(); setProfileDraft(value); setBaseline(value); setProfileError(""); } };
  return <SettingsFrame title={locale === "es" ? "Ajustes de PathBranching" : "PathBranching settings"} locale={locale} pages={settingsHost ? integratedSettingsPages : suiteSettings ? legacyHostPages : pathbranchingSettingsPages} page={page} onPage={setLocalPage} visible={!hidden} onClose={onClose} host={settingsHost} hasUniverse={Boolean(fileState.universePath)} draft={draft} helpPage="pathbranching.tutorials" onHelp={() => {}} contentClassName="pathbranching-settings-content">
            {activeSection === "suite" && suiteSettings ? (
              <div className="settings-panel">
                <div className="settings-page-title">
                  <h3>{settingsText.suiteTitle}</h3>
                  <p>{settingsText.suiteDescription}</p>
                </div>
                <div className="settings-grid">
                  <label>
                    <span>{interfaceCopy.interfaceLanguage}</span>
                    <select
                      value={suiteSettings.localePreference}
                      onChange={(event) => suiteSettings.onLocalePreferenceChange(event.target.value as "system" | "en" | "es")}
                    >
                      <option value="system">{interfaceCopy.system}</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  </label>
                  <label>
                    <span>{settingsText.style}</span>
                    <select
                      value={suiteSettings.style}
                      onChange={(event) => suiteSettings.onStyleChange(event.target.value)}
                    >
                      {THEMES.map((themeOption) => (
                        <option key={themeOption.id} value={themeOption.id}>
                          {themeOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{settingsText.typeface}</span>
                    <select
                      value={suiteSettings.primaryFont}
                      onChange={(event) => suiteSettings.onPrimaryFontChange(event.target.value)}
                    >
                      {primaryFontOptions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
            {activeSection === "update" && suiteSettings ? (
              <div className="settings-panel forge-update-panel">
                <div className="settings-page-title">
                  <h3>{settingsText.updateTitle}</h3>
                  <p>{settingsText.updateDescription}</p>
                </div>
                <div className="settings-grid">
                  <label><span>{settingsText.installedVersion}</span><input value={suiteSettings.update.currentVersion} readOnly /></label>
                  <label><span>{settingsText.platform}</span><input value={suiteSettings.update.platform} readOnly /></label>
                  <label><span>{settingsText.applicationId}</span><input value={suiteSettings.update.identifier} readOnly /></label>
                </div>
                <div className={`forge-update-status ${suiteSettings.update.status}`} role="status">
                  <RefreshCw size={18} className={suiteSettings.update.status === "checking" || suiteSettings.update.status === "downloading" ? "spinning" : ""} />
                  <div>
                    <strong>{suiteSettings.update.status === "checking" ? settingsText.checking : suiteSettings.update.status === "available" ? settingsText.available.replace("{{version}}", suiteSettings.update.availableVersion ?? "") : suiteSettings.update.status === "downloading" ? settingsText.downloading.replace("{{version}}", suiteSettings.update.availableVersion ?? "") : suiteSettings.update.status === "up-to-date" ? settingsText.upToDate : suiteSettings.update.status === "error" ? settingsText.failed : settingsText.ready}</strong>
                    <p>{suiteSettings.update.error ?? settingsText.updaterReady}</p>
                  </div>
                </div>
                <div className="settings-action-list forge-update-actions">
                  <button type="button" onClick={suiteSettings.update.onCheck} disabled={suiteSettings.update.status === "checking" || suiteSettings.update.status === "downloading"}><RefreshCw size={14} /> {settingsText.check}</button>
                  {suiteSettings.update.status === "available" ? <button type="button" onClick={suiteSettings.update.onInstall}>{settingsText.install}</button> : null}
                </div>
              </div>
            ) : null}
            {activeSection === "overview" && !settingsHost ? (
              <div className="settings-panel">
                <div className="settings-page-title universe-profile-summary">
                  <UniverseIconFrame
                    profile={fileState.universeProfile}
                    size={42}
                  />
                  <div>
                    <h3>{universeName}</h3>
                    <p>
                      {fileState.universePath ??
                        "Open a universe folder to begin."}
                    </p>
                  </div>
                </div>
                <div className="universe-profile-editor">
                  <UniverseIconFrame profile={profileDraft} size={48} />
                  <div className="universe-profile-fields">
                    <label>
                      <span>Universe name</span>
                      <input value={profileDraft.name ?? ""} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder={universeName} />
                    </label>
                    <LocaleSettingsFields
                      locale={locale}
                      value={profileDraft.localization}
                      fallbackLocale={machineLocale()}
                      onChange={(localization) => setProfileDraft((current) => ({ ...current, localization }))}
                    />
                    <div className="icon-preset-row">
                      {[["book", BookOpen], ["globe", Globe2], ["castle", Castle], ["sparkles", Sparkles]].map(([value, Icon]) => (
                        <button key={value as string} type="button" className={profileDraft.icon?.type === "preset" && profileDraft.icon.value === value ? "active" : ""} onClick={() => setProfileDraft((current) => ({ ...current, icon: { type: "preset", value: value as string } }))} title={`Use ${value} icon`}><Icon size={16} /></button>
                      ))}
                      <label className="image-upload-button" title="Use PNG or JPG"><Upload size={16} /><input type="file" accept="image/png,image/jpeg" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setProfileDraft((current) => ({ ...current, icon: { type: "image", value: String(reader.result ?? "") } })); reader.readAsDataURL(file); }} /></label>
                    </div>
                    {profileError && <p role="alert">{profileError}</p>}
                  </div>
                </div>
                <div className="universe-stats">
                  <div>
                    <strong>{project?.sequences.length ?? 0}</strong>
                    <span>Sequences</span>
                  </div>
                  <div>
                    <strong>{project?.branches.length ?? 0}</strong>
                    <span>Branches</span>
                  </div>
                  <div>
                    <strong>{project?.events.length ?? 0}</strong>
                    <span>Events</span>
                  </div>
                  <div>
                    <strong>
                      {errorCount}/{warningCount}
                    </strong>
                    <span>Errors / warnings</span>
                  </div>
                </div>
                <div className="settings-action-list">
                  <button type="button" onClick={onOpenUniverse}>
                    <FolderOpen size={15} />
                    Open universe folder
                  </button>

                </div>
              </div>
            ) : null}

            {activeSection === "authoring" ? (
              <div className="settings-panel">
                <div className="settings-page-title">
                  <h3>Branching authoring</h3>
                  <p>
                    {universePath ||
                      "Everend PathBranching stores story graph data inside `.everend/.pathbranching`."}
                  </p>
                </div>
                <div className="settings-grid">
                  <label>
                    <span>Story file</span>
                    <input
                      value={fileState.storyPath ?? "Not created yet"}
                      readOnly
                    />
                  </label>
                  <label>
                    <span>Runtime validation</span>
                    <input
                      value={
                        findings.length
                          ? `${findings.length} finding(s)`
                          : "Clean"
                      }
                      readOnly
                    />
                  </label>
                </div>
                {project ? (
                  <EventCategoriesSettings
                    categories={project.eventCategories ?? []}
                    usedCategoryIds={
                      new Set(project.events.map((event) => event.type))
                    }
                    onChange={onUpdateEventCategories}
                  />
                ) : null}
                <section className="settings-subsection">
                  <div className="settings-page-title compact">
                    <h3>Canvas information</h3>
                    <p>Choose which icon-and-number metrics appear on event and decision nodes.</p>
                  </div>
                  <div className="settings-grid">
                    <label>
                      <span>Decisions</span>
                      <input type="checkbox" checked={settings.authoringDisplay.showDecisionCount} onChange={(event) => onAuthoringDisplayChange({ showDecisionCount: event.target.checked })} />
                    </label>
                    <label>
                      <span>Outcomes</span>
                      <input type="checkbox" checked={settings.authoringDisplay.showOutcomeCount} onChange={(event) => onAuthoringDisplayChange({ showOutcomeCount: event.target.checked })} />
                    </label>
                    <label>
                      <span>Dialogue elements</span>
                      <input type="checkbox" checked={settings.authoringDisplay.showDialogueCount} onChange={(event) => onAuthoringDisplayChange({ showDialogueCount: event.target.checked })} />
                    </label>
                    <label>
                      <span>Character count</span>
                      <input type="checkbox" checked={settings.authoringDisplay.showCharacterCount} onChange={(event) => onAuthoringDisplayChange({ showCharacterCount: event.target.checked })} />
                    </label>
                    <label>
                      <span>Word count</span>
                      <input type="checkbox" checked={settings.authoringDisplay.showWordCount} onChange={(event) => onAuthoringDisplayChange({ showWordCount: event.target.checked })} />
                    </label>
                  </div>
                  <div className="settings-page-title compact">
                    <h3>Dialogue line counter</h3>
                    <p>The default maximum per dialogue line is saved with the universe. You can also right-click a dialogue line counter on the canvas to edit it; individual events can still override it from the event editor.</p>
                  </div>
                  <div className="settings-grid">
                    <label>
                      <span>Show counter</span>
                      <input
                        type="checkbox"
                        disabled={!project}
                        checked={project?.authoringPreferences?.speechBeatCounter?.enabled ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.enabled}
                        onChange={(event) => onUpdateSpeechBeatCounter({ enabled: event.target.checked })}
                      />
                    </label>
                    <label>
                      <span>Measure</span>
                      <select
                        disabled={!project}
                        value={project?.authoringPreferences?.speechBeatCounter?.unit ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.unit}
                        onChange={(event) => onUpdateSpeechBeatCounter({ unit: event.target.value as "words" | "characters" })}
                      >
                        <option value="characters">Characters</option>
                        <option value="words">Words</option>
                      </select>
                    </label>
                    <label>
                      <span>Maximum</span>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        step={1}
                        disabled={!project}
                        value={project?.authoringPreferences?.speechBeatCounter?.target ?? DEFAULT_SPEECH_BEAT_COUNTER_PREFERENCE.target}
                        onChange={(event) => onUpdateSpeechBeatCounter({ target: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </section>
              </div>
            ) : null}

            {activeSection === "markdown" ? (
              <div className="settings-panel">
                <div className="settings-page-title">
                  <h3>Markdown working copies</h3>
                  <p>
                    Canon Markdown remains owned by WorldNotion. Editable
                    variants are saved as working copies.
                  </p>
                </div>
                <div className="settings-grid">
                  <label>
                    <span>Working copy folder</span>
                    <input
                      value=".everend/.pathbranching/working-copies"
                      readOnly
                    />
                  </label>
                  <label>
                    <span>Supported draft formats</span>
                    <input
                      value="Markdown, Ink Beat, GameData, Frontmatter"
                      readOnly
                    />
                  </label>
                  <label>
                    <span>Canon editing</span>
                    <input
                      value="Read-only from Everend PathBranching"
                      readOnly
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {activeSection === "bridge" ? (
              <div className="settings-panel">
                <EverendBridgePanel project={project} fileState={fileState} flat pairingCode={bridgePairingCode} onPairingCodeChange={setBridgePairingCode} />
              </div>
            ) : null}

{activeSection === "general" ? <div className="settings-grid">{!suiteSettings && <label><span>{locale === "es" ? "Fuente de interfaz" : "Interface typeface"}</span><select value={settings.interfaceFont ?? "sans"} onChange={event => onInterfaceFontChange?.(event.target.value as NonNullable<AppSettings["interfaceFont"]>)}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="humanist">Humanist</option></select></label>}
                  <label>
                    <span>{interfaceCopy.interfaceLanguage}</span>
                    <select
                      value={suiteSettings?.localePreference ?? settings.localePreference}
                      onChange={(event) => onLocalePreferenceChange(event.target.value as "system" | "en" | "es")}
                    >
                      <option value="system">{interfaceCopy.system}</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  </label>
                  <label>
                    <span>Active style</span>
                    <select
                      value={theme}
                      onChange={(event) =>
                        onThemeChange(normalizeThemeId(event.target.value))
                      }
                    >
                      {THEMES.map((themeOption) => (
                        <option key={themeOption.id} value={themeOption.id}>
                          {themeOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-checkbox">
                    <span>{locale === "es" ? "Fondo difuminado" : "Soft background"}</span>
                    <input type="checkbox" checked={suiteSettings?.ambientBackground ?? settings.ambientBackground !== false} onChange={event => onAmbientBackgroundChange(event.target.checked)} />
                  </label>
                  <SceneChoices locale={locale} scene={suiteSettings?.backgroundScene ?? settings.backgroundScene} onScene={onBackgroundSceneChange} />
                  <label>
                    <span>Theme mode</span>
                    <button type="button" onClick={onToggleTheme}>
                      {isDarkTheme(theme)
                        ? "Switch to light"
                        : "Switch to dark"}
                    </button>
                  </label>
</div> : null}
{activeSection === "inspector" ? <div className="settings-grid">
                  <label>
                    <span>Open next tab on close</span>
                    <input
                      type="checkbox"
                      checked={settings.inspectorTabCloseSelectsNext}
                      onChange={(event) =>
                        onInspectorTabCloseSelectsNextChange(
                          event.target.checked,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Collapse tab on canvas click</span>
                    <input
                      type="checkbox"
                      checked={settings.collapseInspectorTabOnCanvasClick}
                      onChange={(event) =>
                        onCollapseInspectorTabOnCanvasClickChange(
                          event.target.checked,
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Inspector Debug</span>
                    <input
                      type="checkbox"
                      checked={settings.inspectorDebugEnabled}
                      onChange={(event) =>
                        onInspectorDebugEnabledChange(event.target.checked)
                      }
                    />
                  </label>
                  <label>
                    <span>Status messages</span>
                    <input
                      type="checkbox"
                      checked={settings.showStatusMessages}
                      onChange={(event) =>
                        onShowStatusMessagesChange(event.target.checked)
                      }
                    />
                  </label>
</div> : null}
{activeSection === "canvas" ? <><div className="settings-grid">
                  <label>
                    <span>Canvas circles</span>
                    <input
                      type="checkbox"
                      checked={settings.canvasBackground.showDots}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          showDots: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Canvas grid</span>
                    <input
                      type="checkbox"
                      checked={settings.canvasBackground.showGrid}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          showGrid: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Align to grid</span>
                    <input
                      type="checkbox"
                      checked={settings.canvasBackground.snapToGrid}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          snapToGrid: event.target.checked,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Grid size</span>
                    <input
                      type="number"
                      min={8}
                      max={80}
                      step={2}
                      value={settings.canvasBackground.gridSize}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          gridSize: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Grid opacity</span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={settings.canvasBackground.opacity}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          opacity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Canvas dot opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.canvasBackground.dotOpacity ?? settings.canvasBackground.opacity}
                      onChange={(event) =>
                        onCanvasBackgroundChange({
                          dotOpacity: Number(event.target.value),
                        })
                      }
                    />
                  </label>
</div>                <div className="settings-subsection">
                  <div className="settings-page-title compact">
                    <h3>Node colors</h3>
                    <p>
                      Canvas node types use these colors as their left outline.
                    </p>
                  </div>
                  <div className="settings-grid node-color-grid">
                    {NODE_COLOR_FIELDS.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input
                          type="color"
                          value={settings.nodeColors[field.key]}
                          onChange={(event) =>
                            onNodeColorChange({
                              [field.key]: event.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
</> : null}
            {activeSection === "recents" ? (
              <div className="settings-panel">
                <div className="settings-page-title">
                  <h3>Recent universes</h3>
                  <p>
                    Everend PathBranching opens the latest valid universe
                    automatically on startup.
                  </p>
                </div>
                <div className="space-list">
                  {settings.recentProjects.map((path) => (
                    <button
                      type="button"
                      key={path}
                      onClick={() => onOpenRecentUniverse(path)}
                    >
                      <GitBranch size={15} />
                      <span>{path}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveRecentUniverse(path);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            onRemoveRecentUniverse(path);
                          }
                        }}
                      >
                        remove
                      </span>
                    </button>
                  ))}
                  {settings.recentProjects.length === 0 ? (
                    <span className="empty-line">No recent universes yet.</span>
                  ) : null}
                </div>
              </div>
            ) : null}
            {activeSection === "tutorials" ? (
              <div className="settings-panel">
                <div className="settings-page-title">
                  <h3>{settingsText.tutorials}</h3>
                  <p>{locale === "es" ? "Vuelve a mostrar la guía básica de PathBranching para este universo." : "Show the introductory guide again for this universe."}</p>
                </div>
                <button type="button" onClick={onResetOnboarding}>
                  <RefreshCw size={15} />
                  {locale === "es" ? "Reiniciar tutorial" : "Restart tutorial"}
                </button>
              </div>
            ) : null}

</SettingsFrame>;
}
