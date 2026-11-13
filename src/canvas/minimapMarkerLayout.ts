export type MinimapBounds = { x: number; y: number; width: number; height: number };
export type MinimapMarkerCenter = { centerX: number; centerY: number };
export type MinimapMarkerPosition<T> = { item: T; x: number; y: number };

const MAP_WIDTH = 210;
const MAP_HEIGHT = 138;

/**
 * A cheap geometry key lets the minimap keep marker coordinates when React
 * Flow replaces node objects for selection or other non-geometric updates.
 */
export function minimapMarkerGeometryKey(items: readonly MinimapMarkerCenter[]) {
  return items.map(({ centerX, centerY }) => `${centerX},${centerY}`).join(";");
}

export function layoutMinimapMarkers<T extends MinimapMarkerCenter>(
  items: T[],
  scale: number,
  viewBox: MinimapBounds,
  markerSize: number,
): MinimapMarkerPosition<T>[] {
  if (items.length < 2 || scale <= 0) {
    return items.map((item) => ({ item, x: item.centerX, y: item.centerY }));
  }

  const contentWidth = viewBox.width * scale;
  const contentHeight = viewBox.height * scale;
  const offsetX = (MAP_WIDTH - contentWidth) / 2;
  const offsetY = (MAP_HEIGHT - contentHeight) / 2;
  const inset = markerSize / 2 + 2;
  const clampX = (x: number) => Math.max(inset, Math.min(MAP_WIDTH - inset, x));
  const clampY = (y: number) => Math.max(inset, Math.min(MAP_HEIGHT - inset, y));
  const anchors = items.map((item) => ({
    x: clampX((item.centerX - viewBox.x) * scale + offsetX),
    y: clampY((item.centerY - viewBox.y) * scale + offsetY),
  }));
  const positions = anchors.map((point) => ({ ...point }));
  const minDistance = markerSize + 2;

  // Keep the current marker positions stable while leaving canvas coordinates
  // and exported layout untouched.
  for (let iteration = 0; iteration < 36; iteration += 1) {
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const first = positions[left];
        const second = positions[right];
        let dx = second.x - first.x;
        let dy = second.y - first.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.001) {
          const angle = ((left * 37 + right * 17) % 16) * Math.PI / 8;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - distance) * 0.52;
        const pushX = dx / distance * push;
        const pushY = dy / distance * push;
        first.x = clampX(first.x - pushX);
        first.y = clampY(first.y - pushY);
        second.x = clampX(second.x + pushX);
        second.y = clampY(second.y + pushY);
      }
    }
    positions.forEach((point, index) => {
      point.x = clampX(point.x + (anchors[index].x - point.x) * 0.035);
      point.y = clampY(point.y + (anchors[index].y - point.y) * 0.035);
    });
  }

  return items.map((item, index) => ({
    item,
    x: viewBox.x + (positions[index].x - offsetX) / scale,
    y: viewBox.y + (positions[index].y - offsetY) / scale,
  }));
}
