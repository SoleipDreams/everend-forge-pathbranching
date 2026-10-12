import { COLLAPSED_RAIL_WIDTH, type WorkspacePanelId, type WorkspacePanelState } from "./workspaceSettings.js";

export const MIN_CANVAS_WIDTH = 480;
export const DRAWER_BREAKPOINT = 960;
export type AdaptivePanel = { id: WorkspacePanelId; visible: boolean; collapsed: boolean; width: number };
export const EXPLORER_PANEL_IDS = ["outline", "assets", "logic", "export", "connect"] as const;
export type ExplorerPanelId = (typeof EXPLORER_PANEL_IDS)[number];
export const isExplorerPanel = (id: WorkspacePanelId): id is ExplorerPanelId => EXPLORER_PANEL_IDS.includes(id as ExplorerPanelId);

/** Management views share one sidebar; switching views retains their local content. */
export function managementPanelCollapsedState(current: WorkspacePanelState, panel: WorkspacePanelId, collapsed: boolean): WorkspacePanelState {
  if (!isExplorerPanel(panel) || collapsed) return { ...current, [panel]: collapsed };
  return { ...current, ...Object.fromEntries(EXPLORER_PANEL_IDS.map(id => [id, id !== panel])) };
}

/** The explorer is one surface; inactive sections must never consume canvas width. */
export function allocateAuthoringWorkspace(width: number, explorerWidth: number, explorerOpen: boolean, contextWidth = 0, utilityWidth = 0) {
  const rail = COLLAPSED_RAIL_WIDTH + 4;
  const inlineExplorer = explorerOpen && width - explorerWidth - contextWidth - utilityWidth - 10 >= MIN_CANVAS_WIDTH;
  return { inlineExplorer, explorerColumn: inlineExplorer ? explorerWidth : rail };
}

/** Presentation only: never changes the saved panel preferences or canvas layout. */
export function allocateWorkspacePanels(width: number, panels: AdaptivePanel[], order: WorkspacePanelId[]) {
  const visible = panels.filter((panel) => panel.visible);
  let remaining = Math.max(0, width - MIN_CANVAS_WIDTH - visible.length * COLLAPSED_RAIL_WIDTH);
  const inline = new Set<WorkspacePanelId>();
  if (width > DRAWER_BREAKPOINT) {
    for (const id of order) {
      const panel = visible.find((candidate) => candidate.id === id);
      if (!panel || panel.collapsed) continue;
      const extra = Math.max(0, panel.width - COLLAPSED_RAIL_WIDTH);
      if (extra <= remaining) { inline.add(id); remaining -= extra; }
    }
  }
  return {
    inline,
    columns: (id: WorkspacePanelId) => {
      const panel = visible.find((candidate) => candidate.id === id);
      return panel ? `${inline.has(id) ? panel.width : COLLAPSED_RAIL_WIDTH}px` : "";
    },
  };
}
