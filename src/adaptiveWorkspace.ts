import { COLLAPSED_RAIL_WIDTH, type WorkspacePanelId } from "./workspaceSettings.js";

export const MIN_CANVAS_WIDTH = 480;
export const DRAWER_BREAKPOINT = 960;
export type AdaptivePanel = { id: WorkspacePanelId; visible: boolean; collapsed: boolean; width: number };

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
