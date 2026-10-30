import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  Position,
  useStore,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { CircleAlert, CornerDownLeft, GitBranch, Plus, Zap } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StoryCanvasEdge, StoryCanvasEdgeData } from "../canvas/storyCanvasModel.js";
import type { LogicPresentation } from "../logicCapabilities.js";
import type { ReturnConnector } from "../canvas/returnConnectors.js";
import { useInterfaceLocale } from "../i18n.js";

type EditableCanvasEdgeData = StoryCanvasEdgeData & {
  editing?: boolean;
  inspectorState?: "open" | "expanded";
  onCommitLabel?: (label: string) => void;
  onCancelLabel?: () => void;
  onOpenLogicPart?: (part: "conditions" | "consequences") => void;
  onOpenInspectorSection?: (section: "connections" | "conditions" | "consequences" | "interactions", target?: { type: "edge" | "node"; id: string }, focusId?: string) => void;
  connectionPadding?: number;
  returnConnector?: ReturnConnector;
  onMeasureReturnConnector?: (width: number) => void;
  waypoints?: Array<{ x: number; y: number }>;
  onMoveWaypoint?: (edgeId: string, index: number, point: { x: number; y: number }, commit: boolean) => void;
  onRemoveWaypoint?: (edgeId: string, index: number) => void;
};

type CanvasPoint = { x: number; y: number };

function positionToward(from: CanvasPoint, to: CanvasPoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left;
  return dy >= 0 ? Position.Bottom : Position.Top;
}

function pathThroughWaypoints(
  points: CanvasPoint[],
  sourcePosition: Position,
  targetPosition: Position,
  curvature: number,
): { path: string; labelX: number; labelY: number } | undefined {
  if (points.length < 2) return undefined;
  const segments: Array<{ path: string; labelX: number; labelY: number; length: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const [segmentPath, labelX, labelY] = getBezierPath({
      sourceX: start.x,
      sourceY: start.y,
      sourcePosition: index === 0 ? sourcePosition : positionToward(start, end),
      targetX: end.x,
      targetY: end.y,
      targetPosition: index === points.length - 2 ? targetPosition : positionToward(end, start),
      curvature,
    });
    segments.push({
      path: index === 0 ? segmentPath : segmentPath.slice(segmentPath.indexOf("C")),
      labelX,
      labelY,
      length: Math.hypot(end.x - start.x, end.y - start.y),
    });
  }
  const halfLength = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let traversed = 0;
  const labelSegment = segments.find((segment) => {
    traversed += segment.length;
    return traversed >= halfLength;
  }) ?? segments[segments.length - 1];
  return {
    path: segments.map((segment) => segment.path).join(" "),
    labelX: labelSegment.labelX,
    labelY: labelSegment.labelY,
  };
}

type RoutePreview = {
  mode?: "conditional" | "fallback";
  conditions?: string[];
  consequences?: string[];
  conditionItems?: LogicPresentation[];
  consequenceItems?: LogicPresentation[];
  warningCount?: number;
};

function routePreview(value: unknown): RoutePreview | undefined {
  return value && typeof value === "object" ? value as RoutePreview : undefined;
}

export function EditableCanvasEdge({
  id,
  selected,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<StoryCanvasEdge>) {
  const es = useInterfaceLocale() === "es";
  const zoom = useStore(state => state.transform[2]);
  const { screenToFlowPosition } = useReactFlow();
  const edgeData = data as EditableCanvasEdgeData | undefined;
  const validationHighlight = edgeData?.validationHighlight === true;
  const logicMode = edgeData?.canvasLayerMode === "logic";
  const routeGateId = typeof edgeData?.routeGateId === "string" ? edgeData.routeGateId : undefined;
  const routeId = routeGateId && id.startsWith("edge:transition:") ? id.slice("edge:transition:".length) : undefined;
  const isGatedRoute = Boolean(routeGateId);
  const connectionPadding = Number(edgeData?.connectionPadding ?? 0);
  const isEntryEdge = edgeData?.kind === "entry";
  const isReturn = edgeData?.returnRoute === true;
  const connector = edgeData?.returnConnector;
  const connectorX = sourceX + 52;
  const connectorY = sourceY + (connector?.lane ?? 0) * 56;
  const destination = typeof edgeData?.routeTargetLabel === "string" ? edgeData.routeTargetLabel : "";
  const connectorRef = useRef<HTMLSpanElement | null>(null);
  const measureConnector = edgeData?.onMeasureReturnConnector;
  useLayoutEffect(() => {
    const element = connectorRef.current;
    if (!element || !connector?.visible) return;
    const measure = () => measureConnector?.(element.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [connector?.visible, measureConnector]);
  const pathSourceX = isReturn && connector ? connectorX + (connector.width ?? 320) : sourceX;
  const pathSourceY = isReturn && connector ? connectorY : sourceY;
  const curvature = Math.min(0.85, 0.25 + connectionPadding / 128);
  const [defaultEdgePath, labelX, labelY] = (isEntryEdge ? getStraightPath : getBezierPath)({
    sourceX: pathSourceX,
    sourceY: pathSourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...(isEntryEdge ? {} : { curvature }),
  });
  const waypoints = edgeData?.kind === "transition" ? edgeData.waypoints ?? [] : [];
  const waypointPath = waypoints.length
    ? pathThroughWaypoints([
        { x: pathSourceX, y: pathSourceY },
        ...waypoints,
        { x: targetX, y: targetY },
      ], sourcePosition, targetPosition, curvature)
    : undefined;
  const edgePath = waypointPath?.path ?? defaultEdgePath;
  const edgeLabelX = waypointPath?.labelX ?? labelX;
  const edgeLabelY = waypointPath?.labelY ?? labelY;
  const editing = !isGatedRoute && edgeData?.editing === true;
  const label =
    typeof edgeData?.customLabel === "string"
      ? edgeData.customLabel
      : typeof edgeData?.label === "string"
        ? edgeData.label
        : "";
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number>();
  const waypointDragRef = useRef<{
    index: number;
    pointerId: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | undefined>(undefined);
  const moveWaypointRef = useRef(edgeData?.onMoveWaypoint);
  moveWaypointRef.current = edgeData?.onMoveWaypoint;
  const preview = logicMode ? routePreview(edgeData?.routePreview) : undefined;
  const routeIndex = Number(edgeData?.routeIndex ?? 0);
  const routeCount = Number(edgeData?.routeCount ?? 0);
  const fallbackRoute = preview?.mode === "fallback" || edgeData?.mode === "fallback";
  const hasCondition = Boolean(preview?.conditionItems?.length || preview?.conditions?.length);
  const routeConditionAccess = logicMode && (routeCount > 1 || hasCondition || fallbackRoute);
  const previewLabel = preview
    ? preview.mode === "fallback"
      ? "Else"
      : routeConditionAccess
        ? `${es ? "Si" : "If"}${routeCount > 1 ? ` ${routeIndex + 1}` : ""}${hasCondition ? "" : " +"}`
        : undefined
    : undefined;

  useEffect(() => {
    if (!editing) return;
    setValue(label);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [editing, label]);

  const commit = () => edgeData?.onCommitLabel?.(value.trim());
  const detailed = Boolean(selected || edgeData?.inspectorState) && zoom >= 0.65;
  const hasPreview = isGatedRoute || Boolean(label || previewLabel || routeConditionAccess || preview?.consequences?.length || preview?.warningCount || isReturn);
  const returnOpacity = selected || edgeData?.inspectorState
    ? 0.7
    : connector && !connector.visible ? 0 : 0.14;
  const removeWaypoint = (index: number) => {
    edgeData?.onRemoveWaypoint?.(id, index);
    setSelectedWaypointIndex((current) =>
      current === index ? undefined : current !== undefined && current > index ? current - 1 : current,
    );
  };

  useEffect(() => {
    if (!waypoints.length) return;
    const onPointerMove = (event: PointerEvent) => {
      const drag = waypointDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 2) return;
      drag.moved = true;
      moveWaypointRef.current?.(id, drag.index, screenToFlowPosition({ x: event.clientX, y: event.clientY }), false);
    };
    const finishPointer = (event: PointerEvent) => {
      const drag = waypointDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (drag.moved) {
        moveWaypointRef.current?.(id, drag.index, screenToFlowPosition({ x: event.clientX, y: event.clientY }), true);
      }
      waypointDragRef.current = undefined;
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", finishPointer, true);
    window.addEventListener("pointercancel", finishPointer, true);
    return () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishPointer, true);
      window.removeEventListener("pointercancel", finishPointer, true);
    };
  }, [id, screenToFlowPosition, waypoints.length]);

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={`${logicMode && edgeData?.routeRole === "route" ? "canvas-route-edge" : edgeData?.kind === "transition" ? "canvas-flow-edge" : ""}${isReturn ? " canvas-return-edge" : ""}${validationHighlight ? " validation-find-highlight" : ""}`}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isEntryEdge ? "var(--pb-start)" : style?.stroke,
          strokeLinecap: "round",
          strokeWidth: style?.strokeWidth,
          strokeDasharray: isReturn ? "5 4" : style?.strokeDasharray,
          // Coincident routes share one faint trace; stacking their opacity
          // would make a busy return look solid again.
          opacity: isReturn ? returnOpacity : style?.opacity,
        }}
      />
      {waypoints.length ? (
        <EdgeLabelRenderer>
          <div className="canvas-edge-waypoints nodrag nopan">
            {waypoints.map((point, index) => (
              <button
                key={index}
                type="button"
                className={`canvas-edge-waypoint${selectedWaypointIndex === index ? " selected" : ""}`}
                style={{ transform: `translate(-50%, -50%) translate(${point.x}px,${point.y}px)` }}
                title={es ? "Arrastrar para ajustar · clic derecho o Supr para quitar" : "Drag to adjust · right-click or Delete to remove"}
                aria-label={es ? `Punto de ruta ${index + 1}. Pulsa Supr o Backspace para quitarlo.` : `Route point ${index + 1}. Press Delete or Backspace to remove it.`}
                aria-keyshortcuts="Delete Backspace"
                aria-pressed={selectedWaypointIndex === index}
                onFocus={() => setSelectedWaypointIndex(index)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedWaypointIndex(index);
                  event.currentTarget.focus({ preventScroll: true });
                  event.currentTarget.setPointerCapture(event.pointerId);
                  waypointDragRef.current = { index, pointerId: event.pointerId, moved: false, startX: event.clientX, startY: event.clientY };
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeWaypoint(index);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Delete" && event.key !== "Backspace") return;
                  event.preventDefault();
                  event.stopPropagation();
                  removeWaypoint(index);
                }}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {isReturn && connector?.visible ? (
        <>
          <path
            className="canvas-return-stub"
            d={`M ${sourceX},${sourceY} C ${sourceX + 26},${sourceY} ${connectorX - 26},${connectorY} ${connectorX},${connectorY}`}
            fill="none"
            stroke={style?.stroke ?? "var(--pb-decision)"}
            strokeWidth={style?.strokeWidth ?? 1.5}
            strokeLinecap="round"
          />
          <EdgeLabelRenderer>
            <span
              ref={connectorRef}
              className={`canvas-return-connector nodrag nopan${selected ? " highlighted" : ""}`}
              data-return-edge-id={connector.edgeId}
              style={{ transform: `translate(0, -50%) translate(${connectorX}px,${connectorY}px)` }}
              title={`${es ? "Retorno" : "Return"} → ${destination}${connector.count > 1 ? ` · ${connector.count} ${es ? "rutas" : "routes"}` : ""}`}
              aria-label={`${es ? "Retorno a" : "Return to"} ${destination}`}
            >
              <CornerDownLeft size={13} aria-hidden="true" />
              <span className="canvas-return-copy">
                <span className="canvas-return-kind">{es ? "Retorno" : "Return"}</span>
                <b className="canvas-return-destination">{destination}</b>
              </span>
              {connector.count > 1 ? <small>×{connector.count}</small> : null}
            </span>
          </EdgeLabelRenderer>
        </>
      ) : null}
      {editing || (logicMode && hasPreview && (!isReturn || detailed)) || (isReturn && selected) ? (
        <EdgeLabelRenderer>
          <div
            className={`canvas-edge-label canvas-authoring-edge-label nodrag nopan ${editing ? "editing" : ""} ${detailed ? "detail" : "compact"}${isGatedRoute ? " route-label" : ""}`}
            style={{
              transform: isReturn
                ? `translate(0, 0) translate(${connectorX}px,${connectorY + 28}px)`
                : `translate(-50%, -50%) translate(${edgeLabelX}px,${edgeLabelY}px)`,
            }}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={value}
                aria-label={es ? "Etiqueta de la ruta" : "Route label"}
                onChange={(event) => setValue(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    edgeData?.onCancelLabel?.();
                  }
                }}
              />
            ) : (
              <span className={`canvas-edge-preview${preview?.warningCount ? " warning" : ""}`}>
                {isGatedRoute ? <span className="canvas-route-pill" title={`${es ? "Ruta" : "Route"} ${routeIndex + 1}`} aria-label={`${es ? "Ruta" : "Route"} ${routeIndex + 1}`}><span>{es ? "Ruta" : "Route"} {routeIndex + 1}</span></span> : null}
                {!isGatedRoute ? <>
                {label ? <strong>{label}</strong> : null}
                {isReturn ? <span className="canvas-return-label">{es ? "Retorno" : "Return"}{detailed && typeof edgeData?.routeTargetLabel === "string" ? ` → ${edgeData.routeTargetLabel}` : ""}</span> : null}
                {previewLabel || routeConditionAccess ? <span className="route-logic-chip condition" title={fallbackRoute ? (es ? "Ruta alternativa" : "Fallback route") : hasCondition ? (es ? "Condición de ruta" : "Route condition") : (es ? "Sin condición de ruta" : "No route condition")} aria-label={fallbackRoute ? (es ? "Ruta Else" : "Else route") : hasCondition ? `${es ? "Condición de ruta" : "Route condition"} ${routeCount > 1 ? routeIndex + 1 : ""}` : `${es ? "Sin condición de ruta" : "No route condition"} ${routeCount > 1 ? routeIndex + 1 : ""}`}>
                  {fallbackRoute ? <GitBranch size={11} /> : hasCondition ? <GitBranch size={11} /> : <Plus size={11} />}
                  <span>{fallbackRoute ? "Else" : `${es ? "IF" : "IF"}${routeCount > 1 ? ` ${routeIndex + 1}` : ""}${hasCondition ? "" : " +"}`}</span>
                </span> : null}
                {preview?.consequences?.length ? <span className="route-logic-chip consequence" title={preview.consequences.join(" · ")} aria-label={es ? "Cambios de esta ruta" : "This route's changes"}>
                  <Zap size={11} /><span>{es ? "Cambios" : "Changes"}</span>{detailed ? <b>{preview?.consequenceItems?.[0]?.text ?? preview?.consequences?.join(" · ")}</b> : null}
                </span> : null}
                {preview?.warningCount ? <span className="route-logic-warning" title={`${preview.warningCount} ${es ? "advertencias de referencia o capacidad" : "reference or capability warnings"}`}><CircleAlert size={11} />{preview.warningCount}</span> : null}
                </> : null}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const editableCanvasEdgeTypes = {
  editable: memo(EditableCanvasEdge),
};
