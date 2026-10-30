import { COLLAPSED_RAIL_WIDTH, type WorkspacePanelId, type WorkspacePanelState } from "./workspaceSettings.js";

export const MIN_CANVAS_WIDTH = 480;
const MIN_COMPACT_CANVAS_WIDTH = 160;
export const DRAWER_BREAKPOINT = 960;
export type AdaptivePanel = { id: WorkspacePanelId; visible: boolean; collapsed: boolean; width: number };
export const EXPLORER_PANEL_IDS = ["outline", "assets", "logic", "export", "connect"] as const;
export type ExplorerPanelId = (typeof EXPLORER_PANEL_IDS)[number];
export const isExplorerPanel = (id: WorkspacePanelId): id is ExplorerPanelId => EXPLORER_PANEL_IDS.includes(id as ExplorerPanelId);

/** Management views share one sidebar; switching views retains their local content. */
export function managementPanelCollapsedState(current: WorkspacePanelState, panel: WorkspacePanelId, collapsed: boolean): WorkspacePanelState {
  if (!isExplorerPanel(panel)) return { ...current, [panel]: collapsed };
  return { ...current, ...Object.fromEntries(EXPLORER_PANEL_IDS.map(id => [id, collapsed || id !== panel])) };
}

/** The management view shares the workspace with the canvas instead of covering it. */
export function allocateAuthoringWorkspace(width: number, explorerWidth: number, explorerOpen: boolean, contextWidth = 0, utilityWidth = 0) {
  const rail = COLLAPSED_RAIL_WIDTH + 4;
  const availableWidth = Math.max(rail, width - contextWidth - utilityWidth - 24);
  const inlineExplorer = explorerOpen;
  const canvasMinimum = Math.min(MIN_CANVAS_WIDTH, Math.max(MIN_COMPACT_CANVAS_WIDTH, availableWidth * 0.42));
  const maxExplorerColumn = Math.max(rail, availableWidth - canvasMinimum);
  return { inlineExplorer, explorerColumn: inlineExplorer ? Math.min(explorerWidth, maxExplorerColumn) : rail };
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
