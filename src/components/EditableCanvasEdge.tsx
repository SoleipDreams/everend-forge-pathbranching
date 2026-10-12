import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  useStore,
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
};

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
  const edgeData = data as EditableCanvasEdgeData | undefined;
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
  const connectorRef = useRef<HTMLButtonElement | null>(null);
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
  const [edgePath, labelX, labelY] = (isEntryEdge ? getStraightPath : getBezierPath)({
    sourceX: isReturn && connector ? connectorX + (connector.width ?? 320) : sourceX,
    sourceY: isReturn && connector ? connectorY : sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    ...(isEntryEdge ? {} : { curvature: Math.min(0.85, 0.25 + connectionPadding / 128) }),
  });
  const editing = !isGatedRoute && edgeData?.editing === true;
  const label =
    typeof edgeData?.customLabel === "string"
      ? edgeData.customLabel
      : typeof edgeData?.label === "string"
        ? edgeData.label
        : "";
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement | null>(null);
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
  const openRouteInspector = (section: "connections" | "conditions" | "consequences" | "interactions") => {
    edgeData?.onOpenInspectorSection?.(
      section,
      routeGateId ? { type: "node", id: routeGateId } : { type: "edge", id },
      routeId,
    );
  };
  const openPart = (part: "conditions" | "consequences") => edgeData?.onOpenInspectorSection
    ? openRouteInspector(part)
    : edgeData?.onOpenLogicPart?.(part);
  const hasPreview = isGatedRoute || Boolean(label || previewLabel || routeConditionAccess || preview?.consequences?.length || preview?.warningCount || isReturn);
  const returnOpacity = selected || edgeData?.inspectorState
    ? 0.7
    : connector && !connector.visible ? 0 : 0.14;

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={`${logicMode && edgeData?.routeRole === "route" ? "canvas-route-edge" : edgeData?.kind === "transition" ? "canvas-flow-edge" : ""}${isReturn ? " canvas-return-edge" : ""}`}
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
            <button
              ref={connectorRef}
              type="button"
              className={`canvas-return-connector nodrag nopan${selected ? " highlighted" : ""}`}
              data-return-edge-id={connector.edgeId}
              style={{ transform: `translate(0, -50%) translate(${connectorX}px,${connectorY}px)` }}
              title={`${es ? "Retorno" : "Return"} → ${destination}${connector.count > 1 ? ` · ${connector.count} ${es ? "rutas" : "routes"}` : ""}`}
              aria-label={`${es ? "Inspeccionar retorno a" : "Inspect return to"} ${destination}`}
              onClick={(event) => {
                event.stopPropagation();
                openRouteInspector("connections");
              }}
            >
              <CornerDownLeft size={13} aria-hidden="true" />
              <span className="canvas-return-copy">
                <span className="canvas-return-kind">{es ? "Retorno" : "Return"}</span>
                <b className="canvas-return-destination">{destination}</b>
              </span>
              {connector.count > 1 ? <small>×{connector.count}</small> : null}
            </button>
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
                : `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
                {isGatedRoute ? <button type="button" className="canvas-route-pill" title={`${es ? "Abrir enrutador · Ruta" : "Open router · Route"} ${routeIndex + 1}`} aria-label={`${es ? "Abrir enrutador, ruta" : "Open router, route"} ${routeIndex + 1}`} onClick={(event) => { event.stopPropagation(); openRouteInspector("connections"); }}><span>{es ? "Ruta" : "Route"} {routeIndex + 1}</span></button> : null}
                {!isGatedRoute ? <>
                {label ? <strong>{label}</strong> : null}
                {isReturn ? <span className="canvas-return-label">{es ? "Retorno" : "Return"}{detailed && typeof edgeData?.routeTargetLabel === "string" ? ` → ${edgeData.routeTargetLabel}` : ""}</span> : null}
                {previewLabel || routeConditionAccess ? <button type="button" className="route-logic-chip condition" title={fallbackRoute ? (es ? "Editar ruta alternativa" : "Edit fallback route") : hasCondition ? (es ? "Editar condición de ruta" : "Edit route condition") : (es ? "Añadir condición a la ruta" : "Add a route condition")} aria-label={fallbackRoute ? (es ? "Editar ruta Else" : "Edit Else route") : hasCondition ? `${es ? "Editar condición de ruta" : "Edit route condition"} ${routeCount > 1 ? routeIndex + 1 : ""}` : `${es ? "Añadir condición a ruta" : "Add condition to route"} ${routeCount > 1 ? routeIndex + 1 : ""}`} onClick={(event) => { event.stopPropagation(); if (fallbackRoute) edgeData?.onOpenInspectorSection?.("connections", { type: "edge", id }); else openPart("conditions"); }}>
                  {fallbackRoute ? <GitBranch size={11} /> : hasCondition ? <GitBranch size={11} /> : <Plus size={11} />}
                  <span>{fallbackRoute ? "Else" : `${es ? "IF" : "IF"}${routeCount > 1 ? ` ${routeIndex + 1}` : ""}${hasCondition ? "" : " +"}`}</span>
                </button> : null}
                {preview?.consequences?.length ? <button type="button" className="route-logic-chip consequence" title={preview.consequences.join(" · ")} aria-label={es ? "Cambios de esta ruta" : "This route's changes"} onClick={(event) => { event.stopPropagation(); openPart("consequences"); }}>
                  <Zap size={11} /><span>{es ? "Cambios" : "Changes"}</span>{detailed ? <b>{preview?.consequenceItems?.[0]?.text ?? preview?.consequences?.join(" · ")}</b> : null}
                </button> : null}
                {preview?.warningCount ? <button type="button" className="route-logic-warning" title={`${preview.warningCount} ${es ? "advertencias de referencia o capacidad" : "reference or capability warnings"}`} onClick={(event) => { event.stopPropagation(); openPart("conditions"); }}><CircleAlert size={11} />{preview.warningCount}</button> : null}
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
