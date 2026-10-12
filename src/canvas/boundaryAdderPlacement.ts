export type BoundaryAdderDirection = "input" | "output";

export interface BoundaryAdderRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BoundaryAdderPlacement {
  x: number;
  y: number;
  size: number;
  revealPort: boolean;
}

const BUTTON_SIZE = 36;
const EDGE_HOVER_ZONE = 72;
const EDGE_INSET = 24;

/**
 * Place the Entry/End affordance just outside the working-area border, with
 * its inner edge touching the border. When a large working area has pushed
 * that border outside the viewport, keep the affordance reachable at the
 * corresponding canvas edge and reveal the port after activation.
 */
export function boundaryAdderPlacement(
  direction: BoundaryAdderDirection,
  pane: BoundaryAdderRect,
  workspace: BoundaryAdderRect,
  zoom: number,
  pointerX: number,
  pointerY: number,
): BoundaryAdderPlacement | undefined {
  if (
    pointerX < pane.left || pointerX > pane.right ||
    pointerY < pane.top || pointerY > pane.bottom
  ) return undefined;

  const yStart = Math.max(pane.top + 20, workspace.top + 53 * zoom);
  const yEnd = Math.min(pane.bottom - 20, workspace.bottom - 53 * zoom);
  if (pointerY < yStart || pointerY > yEnd) return undefined;

  const edgeX = direction === "output" ? workspace.right : workspace.left;
  const halfSize = BUTTON_SIZE / 2;
  const edgeVisible = direction === "output"
    ? edgeX >= pane.left && edgeX + BUTTON_SIZE <= pane.right
    : edgeX - BUTTON_SIZE >= pane.left && edgeX <= pane.right;

  if (edgeVisible) {
    const nearWorkspaceEdge = pointerX >= edgeX - EDGE_HOVER_ZONE && pointerX <= edgeX + EDGE_HOVER_ZONE;
    if (!nearWorkspaceEdge) return undefined;
    return {
      x: direction === "output" ? edgeX + halfSize : edgeX - halfSize,
      y: Math.max(pane.top + 20, Math.min(pane.bottom - 20, pointerY)),
      size: BUTTON_SIZE,
      revealPort: false,
    };
  }

  const nearCanvasEdge = direction === "output"
    ? pointerX >= pane.right - EDGE_HOVER_ZONE
    : pointerX <= pane.left + EDGE_HOVER_ZONE;
  if (!nearCanvasEdge) return undefined;

  return {
    x: direction === "output" ? pane.right - EDGE_INSET : pane.left + EDGE_INSET,
    y: Math.max(pane.top + 20, Math.min(pane.bottom - 20, pointerY)),
    size: BUTTON_SIZE,
    revealPort: true,
  };
}
