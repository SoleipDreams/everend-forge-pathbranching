import { useApplicationActive, useApplicationEffect } from "./useApplicationActivity.js";
import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { allocateAuthoringWorkspace, isExplorerPanel, type AdaptivePanel, type ExplorerPanelId } from "../adaptiveWorkspace.js";
import { type WorkspacePanelId } from "../workspaceSettings.js";
import { useInterfaceLocale } from "../i18n.js";
import "../workspaceUx.css";
import { ExplorerEmbeddedContext } from "./ExplorerPresentation.js";
import { AccessibleTabs } from "./AccessibleTabs.js";
import { useSurfaceMotion } from "../useSurfaceMotion.js";
import { BookOpen, Library, Workflow, Download, Plug, RotateCcw, PanelLeftClose } from "lucide-react";

type WorkspaceContext = {
  inline: Set<WorkspacePanelId>; active?: WorkspacePanelId;
  panels: AdaptivePanel[]; open: (id: WorkspacePanelId) => void;
  close: (id: WorkspacePanelId) => void; collapse: (id: WorkspacePanelId, collapsed: boolean) => void;
};
const Context = createContext<WorkspaceContext | undefined>(undefined);
const panelOrder: WorkspacePanelId[] = ["outline", "assets", "logic", "player", "export", "connect"];

export function AdaptiveWorkspace({ panels, requestedPanel, onCollapsedChange, resizing, children, explorerTab = "outline", onExplorerTabChange, reservedContextWidth = 0, focus = false, onResetLayout }: {
  panels: AdaptivePanel[]; requestedPanel?: { id?: WorkspacePanelId; revision: number };
  onCollapsedChange: (id: WorkspacePanelId, collapsed: boolean) => void;
  explorerTab?: ExplorerPanelId; onExplorerTabChange?: (id: ExplorerPanelId) => void;
  reservedContextWidth?: number; focus?: boolean; onResetLayout?: () => void;
  resizing?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const explorerSurface = useRef<HTMLDivElement>(null);
  const explorerRail = useRef<HTMLDivElement>(null);
  const locale = useInterfaceLocale();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const measuredWidth = ref.current?.getBoundingClientRect().width ?? 0;
      if (measuredWidth > 0) setWidth(measuredWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  // All management views remain reachable, including views hidden by older layouts.
  const availableExplorer = panels.filter(panel => isExplorerPanel(panel.id)).sort((left, right) => panelOrder.indexOf(left.id) - panelOrder.indexOf(right.id));
  const selectedExplorer = availableExplorer.find(panel => panel.id === explorerTab && panel.visible)
    ?? availableExplorer.find(panel => panel.visible && !panel.collapsed) ?? availableExplorer[0];
  const explorerContent = useSurfaceMotion<HTMLDivElement>(selectedExplorer?.id);
  const explorerOpen = !focus && availableExplorer.some(panel => panel.visible && !panel.collapsed);
  const explorerLayout = allocateAuthoringWorkspace(width, (selectedExplorer?.width ?? 282) + 40, explorerOpen, reservedContextWidth);
  const explorerDrawer = explorerOpen && !explorerLayout.inlineExplorer;
  const open = (id: WorkspacePanelId) => {
    if (isExplorerPanel(id)) onExplorerTabChange?.(id);
    onCollapsedChange(id, false);
  };
  const closeExplorer = () => {
    if (explorerSurface.current?.contains(document.activeElement) || explorerRail.current?.contains(document.activeElement)) {
      explorerRail.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
    availableExplorer.forEach(panel => onCollapsedChange(panel.id, true));
  };
  useEffect(() => {
    if (requestedPanel?.id && isExplorerPanel(requestedPanel.id)) onExplorerTabChange?.(requestedPanel.id);
  }, [requestedPanel]);
  const items = Children.toArray(children);
  const explorerItems = items.filter(child => isValidElement<{ id?: WorkspacePanelId }>(child) && child.props.id && isExplorerPanel(child.props.id));
  const contentItems = items.filter(child => !explorerItems.includes(child));
  const labels: Record<WorkspacePanelId, string> = locale === "es"
    ? { outline: "Historias", assets: "Recursos", logic: "Lógica", export: "Exportar e importar", connect: "Conectar", player: "Jugador" }
    : { outline: "Stories", assets: "Resources", logic: "Logic", export: "Export & Import", connect: "Connect", player: "Player" };
  const icons = { outline: BookOpen, assets: Library, logic: Workflow, export: Download, connect: Plug };
  const inline = new Set(availableExplorer.map(panel => panel.id));
  const contextPanels = panels.map(panel => isExplorerPanel(panel.id) ? { ...panel, collapsed: false } : panel);
  const context = { panels: contextPanels, inline, active: undefined, open, close: closeExplorer, collapse: (id: WorkspacePanelId, collapsed: boolean) => collapsed ? closeExplorer() : open(id) };
  return <Context.Provider value={context}>
    <div ref={ref} className={`workspace adaptive-workspace pb-authoring-workspace ${resizing ? "resizing" : ""} ${focus ? "context-focus" : ""}`} style={{ gridTemplateColumns: `${selectedExplorer ? `${explorerLayout.explorerColumn}px ` : ""}minmax(0, 1fr)` }}>
      {selectedExplorer ? <aside className={`pb-explorer pb-management ${explorerOpen ? "open" : "collapsed"} ${explorerDrawer ? "drawer" : ""}`} aria-label={locale === "es" ? "Central de gestión" : "Management center"}>
        <div ref={explorerRail} className="pb-explorer-rail">
          <AccessibleTabs value={selectedExplorer.id} orientation="vertical" className="pb-management-views" tabs={availableExplorer.map(panel => {
            const Icon = icons[panel.id as ExplorerPanelId];
            return { id: panel.id, title: labels[panel.id], label: <><Icon size={18} aria-hidden="true" /><span className="sr-only">{labels[panel.id]}</span></> };
          })} onChange={id => open(id as ExplorerPanelId)} ariaLabel={locale === "es" ? "Vistas de gestión" : "Management views"} panelId="pb-explorer-content" />
          {onResetLayout ? <button className="pb-management-reset" type="button" title={locale === "es" ? "Restablecer disposición" : "Reset layout"} aria-label={locale === "es" ? "Restablecer disposición" : "Reset layout"} onClick={onResetLayout}><RotateCcw size={17} /></button> : null}
        </div>
        <div ref={explorerSurface} className="pb-explorer-surface" hidden={!explorerOpen} onKeyDown={event => { if (explorerDrawer && event.key === "Escape" && event.target instanceof Element && !event.target.closest('[role="dialog"],[role="menu"]')) { event.preventDefault(); event.stopPropagation(); closeExplorer(); } }}>
          <header className="pb-explorer-tabs"><strong>{labels[selectedExplorer.id]}</strong><button type="button" onClick={closeExplorer} aria-label={locale === "es" ? "Contraer gestión" : "Collapse management"}><PanelLeftClose size={16} /></button></header>
          <ExplorerEmbeddedContext.Provider value={true}><div ref={explorerContent} id="pb-explorer-content" className="pb-explorer-content" role="tabpanel" aria-label={labels[selectedExplorer.id]}>{explorerItems.map(child => {
            const element = child as ReactElement<{ id: WorkspacePanelId }>;
            return <div key={element.props.id} className="pb-explorer-section" hidden={element.props.id !== selectedExplorer.id}>{child}</div>;
          })}</div></ExplorerEmbeddedContext.Provider>
        </div>
      </aside> : null}
      {contentItems}
    </div>
  </Context.Provider>;
}
export function WorkspacePanelSlot({ id, side, title, mode = "collapsed", children }: {
  id: WorkspacePanelId; side: "left" | "right"; title: string; mode?: "collapsed" | "open"; children: ReactElement;
}) {
  const context = useContext(Context)!;
  const locale = useInterfaceLocale();
  const panel = context.panels.find((candidate) => candidate.id === id)!;
  const drawer = !context.inline.has(id);
  const active = drawer && context.active === id;
  const applicationActive = useApplicationActive();
  const applicationActiveRef = useRef(applicationActive);
  applicationActiveRef.current = applicationActive;
  const content = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useApplicationEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current;
    const element = content.current;
    const focusables = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]') ?? []).filter((item) => item.getClientRects().length > 0);
    focusables()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      // Side panels are non-modal: canvas input and keyboard navigation stay available.
      if (!(event.target instanceof Node) || !slot.current?.contains(event.target)) return;
      const nestedDialog = event.target instanceof Element ? event.target.closest('[role="dialog"]') : undefined;
      if (nestedDialog && nestedDialog !== element) return;
      if (event.key === "Escape" && event.target instanceof Element && event.target.closest('[role="menu"]')) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); context.close(id); }
    };
    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      if (!applicationActiveRef.current) return;
      // Do not take focus back after the author has moved to the canvas or another panel.
      if (document.activeElement !== document.body && !element?.contains(document.activeElement)) return;
      if (previous?.isConnected && previous !== document.body && !element?.contains(previous)) previous.focus();
      else slot.current?.querySelector<HTMLButtonElement>(".side-rail button")?.focus();
    };
  }, [active]);
  const collapsed = drawer ? !active : panel.collapsed;
  const toggle = (next: boolean) => {
    if (drawer) { if (next) context.close(id); else context.open(id); }
    else context.collapse(id, next);
  };
  const props = mode === "open" ? { open: !collapsed, onToggle: () => toggle(!collapsed) } : { collapsed, onCollapsedChange: toggle };
  if (isExplorerPanel(id)) return <div ref={slot} className="workspace-explorer-slot" data-panel={id}>{cloneElement(children as ReactElement<Record<string, unknown>>, props)}</div>;
  return <div ref={slot} className={`workspace-panel-slot ${active ? "drawer-active" : ""} slot-${side}`} data-panel={id}>
    {active ? <aside className={`side-rail side-rail-${side}`}><button ref={trigger} type="button" aria-expanded="true" aria-label={locale === "es" ? `Contraer ${title}` : `Collapse ${title}`} onClick={() => context.close(id)}><span>{title}</span></button></aside> : null}
    <div ref={content} className={active ? "workspace-drawer-content" : "workspace-inline-content"} role={active ? "region" : undefined} aria-label={active ? title : undefined}>
      {cloneElement(children as ReactElement<Record<string, unknown>>, props)}
      {active ? <button type="button" className="workspace-drawer-close" aria-label={locale === "es" ? `Contraer ${title}` : `Collapse ${title}`} onClick={() => context.close(id)}>{locale === "es" ? "Contraer" : "Collapse"}</button> : null}
    </div>
  </div>;
}
