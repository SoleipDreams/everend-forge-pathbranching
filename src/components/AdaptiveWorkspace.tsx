import { cloneElement, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { allocateWorkspacePanels, type AdaptivePanel } from "../adaptiveWorkspace.js";
import { type WorkspacePanelId } from "../workspaceSettings.js";
import { useInterfaceLocale } from "../i18n.js";
import "../workspaceUx.css";

type WorkspaceContext = {
  inline: Set<WorkspacePanelId>; active?: WorkspacePanelId;
  panels: AdaptivePanel[]; open: (id: WorkspacePanelId) => void;
  close: (id: WorkspacePanelId) => void; collapse: (id: WorkspacePanelId, collapsed: boolean) => void;
};
const Context = createContext<WorkspaceContext | undefined>(undefined);
const panelOrder: WorkspacePanelId[] = ["outline", "assets", "logic", "player", "export", "connect"];

export function AdaptiveWorkspace({ panels, requestedPanel, onCollapsedChange, resizing, children }: {
  panels: AdaptivePanel[]; requestedPanel?: { id?: WorkspacePanelId; revision: number };
  onCollapsedChange: (id: WorkspacePanelId, collapsed: boolean) => void;
  resizing?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [active, setActive] = useState<WorkspacePanelId>();
  const [order, setOrder] = useState(panelOrder);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(() => allocateWorkspacePanels(width, panels, order), [width, panels, order]);
  const open = (id: WorkspacePanelId) => { onCollapsedChange(id, false); setActive(id); };
  const collapse = (id: WorkspacePanelId, collapsed: boolean) => {
    onCollapsedChange(id, collapsed);
    if (collapsed) setActive((current) => current === id ? undefined : current);
  };
  // Append newly expanded panels, keeping already open panels in their existing places.
  const previousExpanded = useRef(new Set(panels.filter((panel) => !panel.collapsed).map((panel) => panel.id)));
  useEffect(() => {
    const expanded = panels.filter((panel) => panel.visible && !panel.collapsed).map((panel) => panel.id);
    const newlyOpened = expanded.filter((id) => !previousExpanded.current.has(id));
    if (newlyOpened.length) {
      setOrder((current) => [...current.filter((id) => !newlyOpened.includes(id)), ...newlyOpened]);
      setActive(newlyOpened[newlyOpened.length - 1]);
    }
    previousExpanded.current = new Set(expanded);
  }, [panels]);
  // Explicit open/close requests win over restored panel preferences.
  useEffect(() => {
    if (requestedPanel) setActive(requestedPanel.id);
  }, [requestedPanel]);
  const drawer = active && panels.some((panel) => panel.id === active && panel.visible && !panel.collapsed) && !layout.inline.has(active) ? active : undefined;
  const columnIds: Array<WorkspacePanelId | "canvas"> = ["assets", "logic", "outline", "canvas", "player", "export", "connect"];
  const columns = columnIds.map((id) => id === "canvas" ? "minmax(0, 1fr)" : layout.columns(id)).filter(Boolean).join(" ");
  return <Context.Provider value={{ panels, inline: layout.inline, active: drawer, open, close: (id) => collapse(id, true), collapse }}>
    <div ref={ref} className={`workspace adaptive-workspace ${resizing ? "resizing" : ""}`} style={{ gridTemplateColumns: columns }}>
      {children}
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
  const content = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
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
  return <div ref={slot} className={`workspace-panel-slot ${active ? "drawer-active" : ""} slot-${side}`} data-panel={id}>
    {active ? <aside className={`side-rail side-rail-${side}`}><button ref={trigger} type="button" aria-expanded="true" aria-label={locale === "es" ? `Contraer ${title}` : `Collapse ${title}`} onClick={() => context.close(id)}><span>{title}</span></button></aside> : null}
    <div ref={content} className={active ? "workspace-drawer-content" : "workspace-inline-content"} role={active ? "region" : undefined} aria-label={active ? title : undefined}>
      {cloneElement(children as ReactElement<Record<string, unknown>>, props)}
      {active ? <button type="button" className="workspace-drawer-close" aria-label={locale === "es" ? `Contraer ${title}` : `Collapse ${title}`} onClick={() => context.close(id)}>{locale === "es" ? "Contraer" : "Collapse"}</button> : null}
    </div>
  </div>;
}
