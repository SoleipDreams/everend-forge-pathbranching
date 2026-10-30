import { Panel, useEdges, useNodes, useReactFlow, useStore } from "@xyflow/react";
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { StoryCanvasEdge, StoryCanvasNode } from "../canvas/storyCanvasModel.js";
import { StoryCanvasNodeIcon } from "./StoryNode.js";

type MapNode = {
  node: StoryCanvasNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

type MapBounds = { x: number; y: number; width: number; height: number };
type MapMarkerPosition = { item: MapNode; x: number; y: number };

const MAP_WIDTH = 210;
const MAP_HEIGHT = 138;

function nodeDimensions(node: StoryCanvasNode) {
  const styledWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
  const styledHeight = typeof node.style?.height === "number" ? node.style.height : undefined;
  return {
    width: Math.max(1, node.measured?.width ?? node.width ?? styledWidth ?? 220),
    height: Math.max(1, node.measured?.height ?? node.height ?? styledHeight ?? 112),
  };
}

function nodeColor(node: StoryCanvasNode) {
  const data = node.data;
  if (typeof data.minimapColor === "string") return data.minimapColor;
  if (typeof data.accentColor === "string") return data.accentColor;
  if (data.kind === "start") return "var(--pb-start)";
  if (data.kind === "boundary" || data.kind === "sequence" || data.kind === "branch") return "var(--pb-sequence)";
  if (data.kind === "decision" || data.kind === "routeGate") return "var(--pb-decision)";
  if (data.kind === "outcome") return "var(--pb-outcome)";
  if (data.kind === "dialogue" || data.kind === "dialogueStart" || data.kind === "speechBeat" || data.kind === "directionBeat") return "var(--pb-ink)";
  if (data.kind === "event") return "var(--pb-event)";
  return "var(--wn-accent)";
}

function edgeColor(edge: StoryCanvasEdge) {
  switch (edge.data?.kind) {
    case "entry": return "var(--pb-start)";
    case "choice": return "var(--pb-decision)";
    case "boundary": return "var(--pb-sequence)";
    case "condition": return "var(--wn-warning)";
    case "consequence": return "var(--pb-outcome)";
    default: return "var(--wn-muted)";
  }
}

function edgePath(source: MapNode, target: MapNode) {
  const dx = target.centerX - source.centerX;
  const dy = target.centerY - source.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const direction = dx >= 0 ? 1 : -1;
    const sourceX = source.centerX + direction * source.width / 2;
    const targetX = target.centerX - direction * target.width / 2;
    const bend = Math.max(24, Math.abs(targetX - sourceX) * 0.42);
    return `M ${sourceX} ${source.centerY} C ${sourceX + direction * bend} ${source.centerY}, ${targetX - direction * bend} ${target.centerY}, ${targetX} ${target.centerY}`;
  }
  const direction = dy >= 0 ? 1 : -1;
  const sourceY = source.centerY + direction * source.height / 2;
  const targetY = target.centerY - direction * target.height / 2;
  const bend = Math.max(24, Math.abs(targetY - sourceY) * 0.42);
  return `M ${source.centerX} ${sourceY} C ${source.centerX} ${sourceY + direction * bend}, ${target.centerX} ${targetY - direction * bend}, ${target.centerX} ${targetY}`;
}

function separateMarkerPositions(items: MapNode[], scale: number, viewBox: MapBounds, markerSize: number): MapMarkerPosition[] {
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

  // Repel colliding markers in minimap pixels and gently pull them back toward
  // their true locations. This keeps dense branches legible without changing
  // any canvas positions or exported layout.
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

function MiniMapMarker({ item, x, y, size, scale }: { item: MapNode; x: number; y: number; size: number; scale: number }) {
  const kind = item.node.data.kind;
  const radius = size / (2 * scale);
  const strokeWidth = 1;
  const iconSize = Math.max(1, (size - 4) / scale);
  const color = nodeColor(item.node);
  const isDialogue = kind === "dialogue" || kind === "speechBeat";
  const isDocument = kind === "event" || kind === "inkSection";
  const isAction = kind === "interaction" || kind === "runtimeAction" || kind === "dialogueStart";
  return (
    <g transform={`translate(${x} ${y})`} style={{ color: "#ffffff" }}>
      <title>{item.node.data.title || kind}</title>
      {kind === "start" ? (
        <circle r={radius} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      ) : kind === "decision" || kind === "routeGate" ? (
        <rect x={-radius * 0.72} y={-radius * 0.72} width={radius * 1.44} height={radius * 1.44} transform="rotate(45)" rx={radius * 0.12} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      ) : kind === "outcome" ? (
        <path d={`M 0 ${-radius} L ${radius * 0.82} ${-radius * 0.52} L ${radius * 0.82} ${radius * 0.52} L 0 ${radius} L ${-radius * 0.82} ${radius * 0.52} L ${-radius * 0.82} ${-radius * 0.52} Z`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      ) : kind === "boundary" ? (
        <path d={`M ${-radius} ${-radius * 0.62} L ${radius * 0.72} ${-radius * 0.62} L ${radius} 0 L ${radius * 0.72} ${radius * 0.62} L ${-radius} ${radius * 0.62} Z`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      ) : isDialogue ? (
        <path d={`M ${-radius * 0.72} ${-radius * 0.68} Q ${-radius} ${-radius * 0.68} ${-radius} ${-radius * 0.38} L ${-radius} ${radius * 0.32} Q ${-radius} ${radius * 0.62} ${-radius * 0.72} ${radius * 0.62} L ${-radius * 0.18} ${radius * 0.62} L ${-radius * 0.42} ${radius} L ${radius * 0.04} ${radius * 0.62} L ${radius * 0.72} ${radius * 0.62} Q ${radius} ${radius * 0.62} ${radius} ${radius * 0.32} L ${radius} ${-radius * 0.38} Q ${radius} ${-radius * 0.68} ${radius * 0.72} ${-radius * 0.68} Z`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : isDocument ? (
        <path d={`M ${-radius * 0.68} ${-radius} L ${radius * 0.22} ${-radius} L ${radius * 0.68} ${-radius * 0.54} L ${radius * 0.68} ${radius} L ${-radius * 0.68} ${radius} Z M ${radius * 0.22} ${-radius} L ${radius * 0.22} ${-radius * 0.54} L ${radius * 0.68} ${-radius * 0.54}`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : isAction ? (
        <path d={`M ${-radius * 0.52} ${-radius} L ${radius * 0.52} ${-radius} L ${radius} 0 L ${radius * 0.52} ${radius} L ${-radius * 0.52} ${radius} L ${-radius} 0 Z`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : kind === "barrier" ? (
        <path d={`M ${-radius * 0.42} ${-radius} L ${radius * 0.42} ${-radius} L ${radius} ${-radius * 0.42} L ${radius} ${radius * 0.42} L ${radius * 0.42} ${radius} L ${-radius * 0.42} ${radius} L ${-radius} ${radius * 0.42} L ${-radius} ${-radius * 0.42} Z`} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ) : kind === "knowledge" ? (
        <circle r={radius * 0.9} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      ) : (
        <rect x={-radius} y={-radius * 0.74} width={radius * 2} height={radius * 1.48} rx={radius * 0.38} fill={color} stroke="var(--wn-panel)" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      )}
      {item.node.selected ? <circle className="canvas-minimap-selection" r={radius * 1.35} /> : null}
      <g transform={`translate(${-iconSize / 2} ${-iconSize / 2})`}>
        <StoryCanvasNodeIcon kind={kind} details={item.node.data.details} size={iconSize} className="canvas-minimap-node-icon" />
      </g>
    </g>
  );
}

export function CanvasMiniMap({ locale = "en" }: { locale?: "en" | "es" }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<number | undefined>(undefined);
  const nodes = useNodes<StoryCanvasNode>();
  const edges = useEdges<StoryCanvasEdge>();
  const transform = useStore((state) => state.transform);
  const flowWidth = useStore((state) => state.width);
  const flowHeight = useStore((state) => state.height);
  const flow = useReactFlow<StoryCanvasNode, StoryCanvasEdge>();
  const [viewportX, viewportY, zoom] = transform;
  const viewport = zoom > 0
    ? { x: -viewportX / zoom, y: -viewportY / zoom, width: flowWidth / zoom, height: flowHeight / zoom }
    : undefined;

  const mapNodes = useMemo(() => nodes
    .filter((node) => !node.hidden && node.data.kind !== "workspace" && node.data.kind !== "endAdder")
    .map((node): MapNode => {
      const { width, height } = nodeDimensions(node);
      return {
        node,
        x: node.position.x,
        y: node.position.y,
        width,
        height,
        centerX: node.position.x + width / 2,
        centerY: node.position.y + height / 2,
      };
    }), [nodes]);
  const mapNodeById = useMemo(() => new Map(mapNodes.map((item) => [item.node.id, item])), [mapNodes]);
  const bounds = useMemo<MapBounds>(() => {
    if (!mapNodes.length && !viewport) return { x: 0, y: 0, width: 800, height: 460 };
    const left = Math.min(...mapNodes.map((item) => item.x), viewport?.x ?? Number.POSITIVE_INFINITY);
    const top = Math.min(...mapNodes.map((item) => item.y), viewport?.y ?? Number.POSITIVE_INFINITY);
    const right = Math.max(...mapNodes.map((item) => item.x + item.width), viewport ? viewport.x + viewport.width : Number.NEGATIVE_INFINITY);
    const bottom = Math.max(...mapNodes.map((item) => item.y + item.height), viewport ? viewport.y + viewport.height : Number.NEGATIVE_INFINITY);
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }, [mapNodes, viewport]);
  const padding = Math.max(18, Math.min(bounds.width, bounds.height) * 0.08);
  const viewBox = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
  const scale = Math.min((MAP_WIDTH - 16) / viewBox.width, (MAP_HEIGHT - 16) / viewBox.height);
  const iconPixels = mapNodes.length > 48 ? 9 : mapNodes.length > 24 ? 12 : 15;
  const markerSize = iconPixels + 4;
  const markerPositions = useMemo(
    () => separateMarkerPositions(mapNodes, scale, viewBox, markerSize),
    [mapNodes, scale, viewBox.x, viewBox.y, viewBox.width, viewBox.height, markerSize],
  );
  const visibleEdges = edges.filter((edge) => !edge.hidden && mapNodeById.has(edge.source) && mapNodeById.has(edge.target));

  const pointFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return undefined;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(matrix.inverse());
    return { x: mapped.x, y: mapped.y };
  };

  const centerOnPoint = (x: number, y: number) => {
    flow.setCenter(x, y, { zoom: flow.getZoom(), duration: 0 });
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromPointer(event);
    if (!point) return;
    const marker = markerPositions.find(({ x, y }) => Math.hypot((point.x - x) * scale, (point.y - y) * scale) <= markerSize / 2);
    if (marker) centerOnPoint(marker.item.centerX, marker.item.centerY);
    else centerOnPoint(point.x, point.y);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointFromPointer(event);
    if (point) centerOnPoint(point.x, point.y);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointerRef.current === event.pointerId) pointerRef.current = undefined;
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.deltaY < 0) flow.zoomIn({ duration: 0 });
      else flow.zoomOut({ duration: 0 });
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [flow]);

  const handleKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const visibleWidth = flowWidth / Math.max(zoom, 0.01);
    const visibleHeight = flowHeight / Math.max(zoom, 0.01);
    const stepX = Math.max(60, visibleWidth * 0.2);
    const stepY = Math.max(60, visibleHeight * 0.2);
    const currentCenter = { x: -viewportX / zoom + visibleWidth / 2, y: -viewportY / zoom + visibleHeight / 2 };
    const target = { ...currentCenter };
    if (event.key === "ArrowLeft") target.x -= stepX;
    else if (event.key === "ArrowRight") target.x += stepX;
    else if (event.key === "ArrowUp") target.y -= stepY;
    else if (event.key === "ArrowDown") target.y += stepY;
    else if (event.key === "Home" || event.key === "Enter") {
      event.preventDefault();
      centerOnPoint(centerX, centerY);
      return;
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      flow.zoomIn({ duration: 0 });
      return;
    } else if (event.key === "-") {
      event.preventDefault();
      flow.zoomOut({ duration: 0 });
      return;
    } else return;
    event.preventDefault();
    flow.setCenter(target.x, target.y, { zoom, duration: 0 });
  };

  return (
    <Panel position="bottom-left" className="canvas-minimap nodrag nopan">
      <svg
        ref={svgRef}
        className="canvas-minimap-svg"
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="button"
        tabIndex={0}
        aria-label={locale === "es" ? "Minimapa narrativo. Arrastra para navegar; usa las flechas para desplazarte." : "Narrative minimap. Drag to navigate; use arrow keys to move."}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {visibleEdges.map((edge) => {
          const source = mapNodeById.get(edge.source);
          const target = mapNodeById.get(edge.target);
          if (!source || !target) return null;
          return <path
            key={edge.id}
            className={`canvas-minimap-edge${edge.selected ? " selected" : ""}`}
            d={edgePath(source, target)}
            stroke={edgeColor(edge)}
            strokeDasharray={edge.data?.kind === "condition" ? "3 3" : undefined}
          />;
        })}
        {markerPositions.map(({ item, x, y }) => {
          if (Math.hypot((x - item.centerX) * scale, (y - item.centerY) * scale) < 1.5) return null;
          return <path
            key={`${item.node.id}:leader`}
            className="canvas-minimap-marker-leader"
            d={`M ${item.centerX} ${item.centerY} L ${x} ${y}`}
            stroke={nodeColor(item.node)}
          />;
        })}
        {markerPositions.map(({ item, x, y }) => (
          <MiniMapMarker key={item.node.id} item={item} x={x} y={y} size={markerSize} scale={scale} />
        ))}
        {viewport ? (
          <rect
            className="canvas-minimap-viewport"
            x={viewport.x}
            y={viewport.y}
            width={viewport.width}
            height={viewport.height}
          />
        ) : null}
      </svg>
    </Panel>
  );
}
