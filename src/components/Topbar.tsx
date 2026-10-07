import {
  ArrowLeft,
  Download,
  FolderOpen,
  Home,
  History,
  Moon,
  MessageSquareText,
  Settings,
  Sun,
  CheckCircle2,
  LoaderCircle,
  OctagonAlert,
  RotateCcw,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Check, Eye } from "lucide-react";
import forgeLogoOnDark from "../assets/everend-forge-logo-on-dark.png";
import forgeLogoOnLight from "../assets/everend-forge-logo-on-light.png";
import type { BranchingProject } from "../domain.js";
import { feedbackUrl } from "../feedback.js";
import { projectFileName, type ProjectFileState } from "../projectPersistence.js";
import type { SuiteChrome } from "../suiteChrome.js";
import { isDarkTheme, themeById, type ThemeId } from "../themes.js";
import { UniverseIconFrame } from "./UniverseIconFrame.js";
import type { WorkspacePanelId, WorkspacePanelState } from "../workspaceSettings.js";
import { authoringUiCopy, useInterfaceLocale } from "../i18n.js";
import "../authoringControls.css";

export type DocumentSaveState = "pending" | "saving" | "saved" | "error";

const controlsCopy = {
  en: { workspace: "Workspace controls", noUniverse: "No universe", openUniverse: "Open a universe", universeSettings: "Universe settings", settings: "Application settings", reveal: "Reveal universe folder", openFirst: "Open a universe first", home: "Home", history: "History", undo: "Undo", redo: "Redo", recent: "Recent actions", noActions: "No actions yet.", view: "View", panels: "Panels", reset: "Reset layout", export: "Export & Import", feedback: "Send feedback", theme: "Toggle theme", everend: "Everend menu", buy: "Buy Suite", pending: "Changes pending", saving: "Saving…", saved: "Saved", error: "Save failed", retry: "Retry save", draft: "Draft not applied", draftHint: "Apply inspector changes to add them to the document.", errorHint: "The latest document changes have not been saved.", panelLabels: { assets: "Assets", logic: "Logic", player: "Player", outline: "Stories", export: "Export & Import", connect: "Connect" } },
  es: { workspace: "Controles del espacio de trabajo", noUniverse: "Sin universo", openUniverse: "Abrir un universo", universeSettings: "Ajustes del universo", settings: "Ajustes de la aplicación", reveal: "Mostrar carpeta del universo", openFirst: "Abre un universo primero", home: "Inicio", history: "Historial", undo: "Deshacer", redo: "Rehacer", recent: "Acciones recientes", noActions: "Aún no hay acciones.", view: "Vista", panels: "Paneles", reset: "Restablecer disposición", export: "Exportar e importar", feedback: "Enviar comentarios", theme: "Cambiar tema", everend: "Menú de Everend", buy: "Comprar Suite", pending: "Cambios pendientes", saving: "Guardando…", saved: "Guardado", error: "Error de guardado", retry: "Reintentar guardado", draft: "Borrador sin aplicar", draftHint: "Aplica los cambios del inspector para incorporarlos al documento.", errorHint: "Los últimos cambios del documento no se han guardado.", panelLabels: { assets: "Recursos", logic: "Lógica", player: "Jugador", outline: "Historias", export: "Exportar e importar", connect: "Conectar" } },
} as const;

function menuItems(element: HTMLElement) { return Array.from(element.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]:not(:disabled)')); }
function focusMenu(ref: RefObject<HTMLDivElement | null>, last = false) {
  window.requestAnimationFrame(() => { const element = ref.current?.querySelector<HTMLElement>('[role="menu"]'); const items = element ? menuItems(element) : []; (last ? items[items.length - 1] : items[0])?.focus(); });
}
function menuKey(event: KeyboardEvent<HTMLDivElement>, close: () => void, trigger: HTMLButtonElement | null) {
  const items = menuItems(event.currentTarget); const active = items.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (active + 1) % items.length : event.key === "ArrowUp" ? (active - 1 + items.length) % items.length : undefined;
  if (next !== undefined && items.length) { event.preventDefault(); items[next]?.focus(); }
  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); trigger?.focus(); }
  if (event.key === "Tab") {
    event.preventDefault();
    const focusable = Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"],summary'))
      .filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0 && !event.currentTarget.contains(item));
    const index = trigger ? focusable.indexOf(trigger) : -1;
    const target = event.shiftKey ? trigger : focusable[index + 1];
    close(); (target ?? trigger)?.focus();
  }
}

const EVEREND_FORGE_GITHUB_URL = "https://github.com/SoleipDreams/everend-forge";
const BUY_SUITE_URL = "https://everendforge.com/buy-suite";

function ForgeLogoMark() {
  return (
    <>
      <img className="forge-logo forge-logo-on-light" src={forgeLogoOnLight} alt="" aria-hidden="true" />
      <img className="forge-logo forge-logo-on-dark" src={forgeLogoOnDark} alt="" aria-hidden="true" />
    </>
  );
}

function universeDisplayName(project?: BranchingProject, fileState?: ProjectFileState, fallback = "No universe") {
  return fileState?.universeProfile?.name ?? project?.name ?? project?.projectId ?? fallback;
}

function universeDisplayPath(fileState?: ProjectFileState) {
  const universePath = projectFileName(fileState?.universePath ?? fileState?.path);
  const storyPath = projectFileName(fileState?.storyPath ?? fileState?.path);
  return [universePath, storyPath].filter(Boolean).join(" / ");
}

export function Topbar({
  project,
  fileState,
  exportOpen,
  theme,
  onOpenSettings,
  onRevealUniverse,
  onToggleTheme,
  onExportRuntime,
  onHome,
  onFeedback,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  recentActions = [],
  suiteChrome,
  panelVisibility,
  onTogglePanelVisibility,
  onOpenExportPanel,
  onResetLayout,
  locale: localeOverride,
  saveState,
  saveError,
  hasUnappliedDraft = false,
  onRetrySave,
}: {
  project?: BranchingProject;
  fileState?: ProjectFileState;
  exportOpen: boolean;
  theme: ThemeId;
  onOpenSettings: () => void;
  onRevealUniverse: () => void;
  onToggleTheme: () => void;
  onExportRuntime: () => void;
  onHome: () => void;
  onFeedback?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  recentActions?: string[];
  suiteChrome?: SuiteChrome;
  panelVisibility?: WorkspacePanelState;
  onTogglePanelVisibility?: (panel: WorkspacePanelId) => void;
  onOpenExportPanel?: () => void;
  onResetLayout?: () => void;
  locale?: "en" | "es";
  saveState?: DocumentSaveState;
  saveError?: string;
  hasUnappliedDraft?: boolean;
  onRetrySave?: () => void;
}) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const c = controlsCopy[locale];
  const compactStatus = locale === "es" ? { pending: "Pendiente", saving: "Guardando…", saved: "Guardado", error: "Error al guardar", draft: "Borrador" } : { pending: "Pending", saving: "Saving…", saved: "Saved", error: "Save failed", draft: "Draft" };
  const sharedCopy = authoringUiCopy(locale);
  const panelLabels: Record<WorkspacePanelId, string> = { assets: sharedCopy.assets, logic: sharedCopy.logic, player: sharedCopy.player, outline: sharedCopy.stories, export: sharedCopy.exportImport, connect: sharedCopy.connect };
  const id = useId();
  const universeName = universeDisplayName(project, fileState, c.noUniverse);
  const universePath = universeDisplayPath(fileState);
  const currentSaveState = saveState ?? (fileState?.dirty ? "pending" : fileState?.lastSavedAt ? "saved" : undefined);
  const [forgeMenuOpen, setForgeMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const forgeMenuRef = useRef<HTMLDivElement | null>(null);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);
  const historyMenuRef = useRef<HTMLDivElement | null>(null);
  const forgeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeMenus = () => { setForgeMenuOpen(false); setViewMenuOpen(false); setHistoryMenuOpen(false); };
  const triggerKey = (event: KeyboardEvent<HTMLButtonElement>, open: () => void, ref: RefObject<HTMLDivElement | null>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); closeMenus(); open(); focusMenu(ref, event.key === "ArrowUp"); }
  };

  const openExternalUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setForgeMenuOpen(false);
  };

  useEffect(() => {
    if (!forgeMenuOpen && !viewMenuOpen && !historyMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        forgeMenuRef.current?.contains(event.target as Node) ||
        viewMenuRef.current?.contains(event.target as Node) ||
        historyMenuRef.current?.contains(event.target as Node)
      ) return;
      setForgeMenuOpen(false);
      setViewMenuOpen(false);
      setHistoryMenuOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        (forgeMenuOpen ? forgeTriggerRef : viewMenuOpen ? viewTriggerRef : historyTriggerRef).current?.focus();
        setForgeMenuOpen(false);
        setViewMenuOpen(false);
        setHistoryMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [forgeMenuOpen, historyMenuOpen, viewMenuOpen]);

  const toggleHistoryMenu = () => {
    setForgeMenuOpen(false);
    setViewMenuOpen(false);
    setHistoryMenuOpen((open) => !open);
    if (!historyMenuOpen) focusMenu(historyMenuRef);
  };

  const toggleViewMenu = () => {
    setForgeMenuOpen(false);
    setHistoryMenuOpen(false);
    setViewMenuOpen((open) => !open);
    if (!viewMenuOpen) focusMenu(viewMenuRef);
  };

  return (
    <header className="topbar dock-top-bar pathbranching-topbar pb-authoring-topbar" aria-label={c.workspace}>
      <div className="dock-top-left">
        {suiteChrome ? (
          suiteChrome.renderAppSwitcher()
        ) : (
          <div ref={forgeMenuRef} className={`forge-corner-menu ${forgeMenuOpen ? "open" : ""}`}>
            {forgeMenuOpen ? <div id={`${id}-forge`} className="forge-orbit-panel" role="menu" aria-label={c.everend} onKeyDown={(event) => menuKey(event, closeMenus, forgeTriggerRef.current)}>
              <button type="button" role="menuitem" onClick={() => openExternalUrl(EVEREND_FORGE_GITHUB_URL)}>
                Github
              </button>
              <button type="button" role="menuitem" onClick={() => openExternalUrl(BUY_SUITE_URL)}>
                {c.buy}
              </button>
              <button type="button" role="menuitem" onClick={() => { if (onFeedback) { onFeedback(); closeMenus(); } else openExternalUrl(feedbackUrl("workspace")); }}>
                {c.feedback}
              </button>
            </div> : null}
            <button
              type="button"
              className="forge-corner-button"
              ref={forgeTriggerRef}
              onClick={() => { setViewMenuOpen(false); setHistoryMenuOpen(false); setForgeMenuOpen((open) => !open); if (!forgeMenuOpen) focusMenu(forgeMenuRef); }}
              onKeyDown={(event) => triggerKey(event, () => setForgeMenuOpen(true), forgeMenuRef)}
              aria-haspopup="menu"
              aria-controls={`${id}-forge`}
              aria-expanded={forgeMenuOpen}
              aria-label={c.everend}
              title={c.everend}
            >
              <ForgeLogoMark />
            </button>
          </div>
        )}

        <button type="button" className="dock-icon-button" title={c.home} aria-label={c.home} onClick={suiteChrome?.onHome ?? onHome}>
          <Home size={15} />
        </button>

        <div className="dock-top-divider" />

        <button type="button" className="dock-universe-button" onClick={onOpenSettings} title={c.universeSettings}>
          <UniverseIconFrame profile={fileState?.universeProfile} />
          <span className="dock-universe-copy">
            <strong>{universeName}</strong>
            <span>{universePath || c.openUniverse}</span>
          </span>
        </button>
        <button type="button" className="dock-icon-button dock-settings-button" onClick={onOpenSettings} title={c.settings} aria-label={c.settings}>
          <Settings size={14} />
        </button>
        <button
          type="button"
          className="dock-icon-button"
          onClick={onRevealUniverse}
          disabled={!fileState?.universePath}
          title={fileState?.universePath ? c.reveal : c.openFirst}
          aria-label={c.reveal}
        >
          <FolderOpen size={14} />
        </button>
      <div className="pb-document-status" aria-label={locale === "es" ? "Estado del documento" : "Document status"}>
        {currentSaveState === "error" ? <details className="pb-save-details" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector<HTMLElement>("summary")?.focus(); } }}>
          <summary className="pb-save-state error" title={c.error}><OctagonAlert size={14} aria-hidden="true" /><span role="status" aria-label={c.error}><span className="pb-status-full">{c.error}</span><span className="pb-status-compact" aria-hidden="true">{compactStatus.error}</span></span></summary>
          <div className="pb-save-error-popover"><p>{saveError || c.errorHint}</p>{onRetrySave ? <button type="button" onClick={onRetrySave}><RotateCcw size={14} />{c.retry}</button> : null}</div>
        </details> : currentSaveState ? <span className={`pb-save-state ${currentSaveState}`} role="status" aria-label={c[currentSaveState]} title={c[currentSaveState]}>
          {currentSaveState === "saving" ? <LoaderCircle size={14} className="pb-save-spinner" aria-hidden="true" /> : currentSaveState === "saved" ? <CheckCircle2 size={14} aria-hidden="true" /> : <span className="pb-status-dot" aria-hidden="true" />}<span className="pb-status-full">{c[currentSaveState]}</span><span className="pb-status-compact" aria-hidden="true">{compactStatus[currentSaveState]}</span>
        </span> : null}
        {hasUnappliedDraft ? <span className="pb-draft-state" title={c.draftHint} aria-label={`${c.draft}. ${c.draftHint}`}><span className="pb-status-full">{c.draft}</span><span className="pb-status-compact" aria-hidden="true">{compactStatus.draft}</span></span> : null}
      </div>
      </div>
      <div className="dock-top-right">
        <div ref={historyMenuRef} className="topbar-view-menu">
          <button
            type="button"
            className={`topbar-menu-trigger ${historyMenuOpen ? "active" : ""}`}
            ref={historyTriggerRef}
            title={c.history}
            aria-haspopup="menu"
            aria-controls={`${id}-history`}
            onClick={toggleHistoryMenu}
            onKeyDown={(event) => triggerKey(event, () => setHistoryMenuOpen(true), historyMenuRef)}
            aria-expanded={historyMenuOpen}
          >
            <History size={14} /><span>{c.history}</span>
          </button>
          {historyMenuOpen ? <div id={`${id}-history`} className="topbar-menu-popover panel-picker" role="menu" aria-label={c.history} onKeyDown={(event) => menuKey(event, closeMenus, historyTriggerRef.current)}>
            <strong>{c.history}</strong>
            <button className="topbar-menu-option" type="button" role="menuitem" onClick={() => { onUndo(); setHistoryMenuOpen(false); historyTriggerRef.current?.focus(); }} disabled={!canUndo}><ArrowLeft size={14} />{c.undo}</button>
            <button className="topbar-menu-option" type="button" role="menuitem" onClick={() => { onRedo(); setHistoryMenuOpen(false); historyTriggerRef.current?.focus(); }} disabled={!canRedo}><ArrowLeft size={14} style={{ transform: "scaleX(-1)" }} />{c.redo}</button>
            {recentActions.length ? <>
              <span className="topbar-history-label">{c.recent}</span>
              <div className="topbar-history-actions">
                {recentActions.map((action, index) => <span key={`${action}-${index}`}>{action}</span>)}
              </div>
            </> : <span className="topbar-history-empty">{c.noActions}</span>}
          </div> : null}
        </div>

        <div className="dock-command-group" aria-label={c.panels}>
          {panelVisibility && onTogglePanelVisibility ? <div ref={viewMenuRef} className="topbar-view-menu">
            <button
              type="button"
              className={`topbar-menu-trigger ${viewMenuOpen ? "active" : ""}`}
              ref={viewTriggerRef}
              title={c.panels}
              aria-haspopup="menu"
              aria-controls={`${id}-view`}
              onClick={toggleViewMenu}
              onKeyDown={(event) => triggerKey(event, () => setViewMenuOpen(true), viewMenuRef)}
              aria-expanded={viewMenuOpen}
            >
              <Eye size={14} /><span>{c.view}</span>
            </button>
            {viewMenuOpen ? <div id={`${id}-view`} className="topbar-menu-popover panel-picker" role="menu" aria-label={c.panels} onKeyDown={(event) => menuKey(event, closeMenus, viewTriggerRef.current)}>
              <strong>{c.panels}</strong>
              {(Object.keys(panelLabels) as WorkspacePanelId[]).map((panel) => <button className="topbar-menu-option" key={panel} type="button" role="menuitemcheckbox" aria-checked={panelVisibility[panel]} onClick={() => onTogglePanelVisibility(panel)}>
                <Check size={14} aria-hidden="true" className={panelVisibility[panel] ? "visible" : "hidden"} /> {panelLabels[panel]}
              </button>)}
              {onResetLayout ? <button type="button" role="menuitem" className="topbar-menu-option pb-menu-separated" onClick={() => { onResetLayout(); closeMenus(); viewTriggerRef.current?.focus(); }}><RotateCcw size={14} />{c.reset}</button> : null}
            </div> : null}
          </div> : null}
          <button type="button" title={c.export} className={exportOpen ? "active" : ""} aria-pressed={exportOpen} onClick={onOpenExportPanel ?? onExportRuntime}>
            <Download size={14} />
            <span>{c.export}</span>
          </button>
        </div>

        {onFeedback ? (
          <button type="button" className="dock-icon-button" onClick={onFeedback} title={c.feedback} aria-label={c.feedback}>
            <MessageSquareText size={15} />
          </button>
        ) : null}
        <button type="button" className="dock-icon-button" onClick={onToggleTheme} title={`${c.theme} (${themeById(theme).label})`} aria-label={c.theme}>
          {isDarkTheme(theme) ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
