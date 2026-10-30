import { useEffect, useMemo, useState } from "react";
import type { BranchingProject, Transition } from "../domain.js";
import { authoringNodeOptions, narrativeNodeReferences, updateNarrativeRoute } from "../authoringMutations.js";
import { createInternalTransition, deleteRoutesFromSource, deleteTransition as deleteTransitionMutation, updateTransition } from "../projectMutations.js";
import { barrierNodeId, interactionNodeId } from "../interactions.js";
import { walkConditions } from "../logic.js";
import { Trash2 } from "lucide-react";
import { useInterfaceLocale } from "../i18n.js";
import { AccessibleTabs } from "./AccessibleTabs.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import { LogicConditionEditor, LogicMomentEditor } from "./LogicComposer.js";
import type { AuthoringMutation } from "./AuthoringStudio.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { InteractionsEditor } from "./InteractionsEditor.js";

type InspectorSection = "connections" | "conditions" | "interactions";

/** A router owns the full set of outgoing routes; line selection only focuses one route here. */
export function RouteInspector({ project, eventId, routeId, sourceId, section, onSectionChange, onMutation, onOpen }: {
  project: BranchingProject;
  eventId: string;
  routeId?: string;
  sourceId?: string;
  section: string;
  onSectionChange: (section: string) => void;
  onMutation: AuthoringMutation;
  onOpen: (id: string, section?: string) => void;
}) {
  const es = useInterfaceLocale() === "es";
  const [chosenRouteId, setChosenRouteId] = useState(routeId);
  const [destination, setDestination] = useState("");
  useEffect(() => setChosenRouteId(routeId), [routeId, sourceId, eventId]);

  const event = project.events.find((item) => item.id === eventId);
  const routes = useMemo(() => (event?.transitions ?? [])
    .filter((item) => sourceId ? item.from === sourceId : routeId ? item.id === routeId : false)
    .sort((a, b) => Number(a.mode === "fallback") - Number(b.mode === "fallback") || (a.order ?? 0) - (b.order ?? 0)),
  [event, routeId, sourceId]);
  const route = routes.find((item) => item.id === chosenRouteId) ?? routes.find((item) => item.id === routeId) ?? routes[0];
  const active: InspectorSection = section === "conditions" || section === "interactions" ? section : "connections";
  const options = authoringNodeOptions(project);
  const conditionContext = { eventId, dialogueId: options.find((item) => item.id === route?.from)?.dialogueId, nodeId: route?.from, routeId: route?.id };
  const destinationLabel = (id: string) => options.find((item) => item.id === id)?.label
    ?? (id.includes(":output:") || id.endsWith(":output")
      ? `${es ? "Salida" : "Exit"} · ${id.split(":output")[1]?.replace(/^:/, "") || event?.name}`
      : id.includes(":input:") || id.endsWith(":input")
        ? `${es ? "Entrada" : "Entry"} · ${event?.name}`
        : id);
  const update = (patch: Partial<Transition>) => {
    if (route) void onMutation((current) => updateNarrativeRoute(current, eventId, route.id, patch));
  };
  const targetOptions = [
    ...options.map((item) => ({ id: item.id, label: item.label })),
    ...[...new Set((event?.transitions ?? []).map((item) => item.to))]
      .filter((id) => !options.some((item) => item.id === id))
      .map((id) => ({ id, label: destinationLabel(id) })),
  ];
  const sourceOutcome = sourceId ? narrativeNodeReferences(project, eventId).find((item) => item.id === sourceId && item.kind === "outcome") : undefined;
  const sourceDecision = sourceOutcome?.decisionId ? event?.decisions?.find((item) => item.id === sourceOutcome.decisionId) : undefined;
  const sourceOutcomeIndex = sourceDecision?.outcomes.findIndex((item) => item.id === sourceOutcome?.elementId) ?? -1;
  const sourceOutcomeValue = sourceDecision?.outcomes.find((item) => item.id === sourceOutcome?.elementId);
  const sourceInteraction = event?.interactionUses?.find((item) => interactionNodeId(eventId, item.id) === sourceId);
  const sourceInteractionName = sourceInteraction
    ? event?.interactionDefinitions?.find((item) => item.id === sourceInteraction.definitionId)?.name
    : undefined;
  const sourceBarrier = event?.interactionBarriers?.find((item) => barrierNodeId(eventId, item.id) === sourceId);
  const interactionResultLabels = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of routes) {
      walkConditions(item.logic?.when ?? item.conditions, (condition) => {
        if (condition.type !== "interactionResult" || typeof condition.useId !== "string" || typeof condition.resultId !== "string") return;
        const use = event?.interactionUses?.find((candidate) => candidate.id === condition.useId);
        const definition = event?.interactionDefinitions?.find((candidate) => candidate.id === use?.definitionId);
        const result = definition?.results.find((candidate) => candidate.id === condition.resultId);
        if (result) labels.set(item.id, result.name);
      });
    }
    return labels;
  }, [event, routes]);
  const decisionLetter = (index: number) => index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
  const sourceOutcomeText = sourceOutcome
    ? (sourceOutcomeValue?.visibleText || sourceOutcome.label).replace(new RegExp(`^${decisionLetter(Math.max(0, sourceOutcomeIndex))}\\s*[·:.)-]\\s*`, "i"), "").trim() || sourceOutcome.label
    : "";

  const interactionUseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const use of event?.interactionUses ?? []) {
      if (!sourceId || use.ownerNodeId === sourceId || interactionNodeId(eventId, use.id) === sourceId) ids.add(use.id);
    }
    for (const item of routes) {
      walkConditions(item.logic?.when ?? item.conditions, (condition) => {
        if (condition.type === "interactionResult" && typeof condition.useId === "string") ids.add(condition.useId);
      });
    }
    return ids;
  }, [event?.interactionUses, eventId, routes, sourceId]);
  const interactionCount = interactionUseIds.size;
  const removeRoute = (id: string) => {
    const nextRouteId = routes.find(item => item.id !== id)?.id;
    setChosenRouteId(nextRouteId);
    void onMutation(current => deleteTransitionMutation(current, id).project);
  };
  const removeRouter = () => {
    const owner = sourceId ?? route?.from;
    if (!owner) return;
    void onMutation(current => deleteRoutesFromSource(current, eventId, owner));
  };

  return <div className="unified-authoring-inspector route-inspector">
    <AccessibleTabs
      className="inspector-subtabs"
      ariaLabel={es ? "Secciones del enrutador" : "Router sections"}
      value={active}
      onChange={onSectionChange}
      tabs={[
        { id: "connections", label: es ? "Bifurcaciones" : "Branches" },
        { id: "conditions", label: es ? "Condiciones" : "Conditions" },
        { id: "interactions", label: es ? "Interacciones" : "Interactions" },
      ]}
    />

    <div className="route-inspector-summary" aria-label={es ? "Resumen del enrutador" : "Router summary"}>
      <button type="button" className={active === "connections" ? "active" : ""} onClick={() => onSectionChange("connections")}>
        <strong>{routes.length}</strong><span>{es ? "Bifurcaciones" : "Branches"}</span>
      </button>
      <button type="button" className={active === "interactions" ? "active" : ""} onClick={() => onSectionChange("interactions")}>
        <strong>{interactionCount}</strong><span>{es ? "Interacciones" : "Interactions"}</span>
      </button>
    </div>

    {sourceId && routes.length > 1 ? <button type="button" className="route-inspector-delete-router danger" onClick={removeRouter}>
      <Trash2 size={14} aria-hidden="true" />{es ? "Eliminar enrutador y todas sus rutas" : "Delete router and all routes"}
    </button> : null}

    {sourceOutcome && sourceDecision ? <div className="route-inspector-context">
      <span className="route-inspector-context-marker">{decisionLetter(Math.max(0, sourceOutcomeIndex))}</span>
      <div><small>{es ? "Rama de la decisión" : "Decision branch"}</small><strong>{sourceOutcomeText}</strong></div>
    </div> : sourceInteraction ? <div className="route-inspector-context">
      <span className="route-inspector-context-marker">{es ? "INT" : "INT"}</span>
      <div><small>{es ? "Resultados de interacción" : "Interaction results"}</small><strong>{sourceInteractionName ?? sourceInteraction.id}</strong></div>
    </div> : sourceBarrier ? <div className="route-inspector-context">
      <span className="route-inspector-context-marker">{es ? "ESP" : "WAIT"}</span>
      <div><small>{es ? "Continuación de espera" : "Wait continuation"}</small><strong>{sourceBarrier.name}</strong></div>
    </div> : null}

    <InspectorPanel title={active === "conditions" ? (es ? "Condiciones de ruta" : "Route conditions") : active === "interactions" ? (es ? "Interacciones del enrutador" : "Router interactions") : (es ? "Rutas" : "Routes")}>
      {routes.length ? <div className="route-inspector-list" role="list" aria-label={es ? "Bifurcaciones del enrutador" : "Router branches"}>
        {routes.map((item, index) => {
          const name = interactionResultLabels.get(item.id) ?? item.label?.trim() ?? `${es ? "Ruta" : "Route"} ${index + 1}`;
          const selected = item.id === route?.id;
          const conditionCount = (() => {
            let count = 0;
            walkConditions(item.logic?.when ?? item.conditions, () => { count += 1; });
            return count;
          })();
          return <div key={item.id} className="route-inspector-route-row" role="listitem">
            <button type="button" aria-pressed={selected} className={`route-inspector-route${selected ? " selected" : ""}`} onClick={() => setChosenRouteId(item.id)}>
              <span className="route-inspector-route-name">{name}</span>
              <span className="route-inspector-route-target">{destinationLabel(item.to)}</span>
              {item.mode === "fallback" ? <small>{es ? "Alternativa" : "Fallback"}</small> : conditionCount ? <small>{conditionCount} {es ? "condiciones" : "conditions"}</small> : <small>{es ? "Sin condición" : "No condition"}</small>}
            </button>
            <button type="button" className="route-inspector-delete-route danger" aria-label={`${es ? "Eliminar ruta" : "Delete route"}: ${name}`} title={es ? "Eliminar esta ruta" : "Delete this route"} onClick={() => removeRoute(item.id)}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>;
        })}
      </div> : <p role="status">{es ? "Este enrutador todavía no tiene bifurcaciones." : "This router has no branches yet."}</p>}

      {active === "interactions" ? <InteractionsEditor
        key={JSON.stringify([project.projectId, eventId, sourceId ?? route?.from])}
        project={project}
        eventId={eventId}
        ownerNodeId={sourceId ?? route?.from}
        onMutation={onMutation}
        onSelect={(id) => onOpen(id, "overview")}
      /> : null}

      {active === "connections" && route ? <div className={`route-gate-route-editor${route.mode === "fallback" ? " fallback" : ""}`}>
        <h3>{es ? "Configurar" : "Configure"} {interactionResultLabels.get(route.id) ?? route.label?.trim() ?? `${es ? "Ruta" : "Route"} ${routes.findIndex((item) => item.id === route.id) + 1}`}</h3>
        <label className="field-label">{es ? "Destino" : "Destination"}
          <select value={route.to} onChange={(event) => update({ to: event.target.value })}>
            {targetOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="field-label">{es ? "Evaluación" : "Evaluation"}
          <select value={route.mode ?? "conditional"} onChange={(event) => update({ mode: event.target.value as Transition["mode"] })}>
            <option value="conditional">{es ? "Comprobar en orden" : "Evaluate in order"}</option>
            <option value="fallback">{es ? "Ruta alternativa (al final)" : "Fallback (last)"}</option>
          </select>
        </label>
        {route.mode !== "fallback" ? <label className="field-label">{es ? "Orden" : "Order"}
          <input type="number" min={1} value={(route.order ?? 0) + 1} onChange={(event) => {
            const order = event.target.valueAsNumber;
            if (Number.isInteger(order) && order >= 1) update({ order: order - 1 });
          }} />
        </label> : <p className="narrative-muted">{es ? "Se evalúa después de las demás rutas." : "Evaluated after the other routes."}</p>}
        <div className="narrative-actions">
          <button type="button" onClick={() => onOpen(route.from, "connections")}>{es ? "Abrir origen" : "Open source"}</button>
          <button type="button" onClick={() => onOpen(route.to)}>{es ? "Ir al destino" : "Go to destination"}</button>
        </div>
        <details open={Boolean(route.logic?.then?.length || route.logic?.narrativeEffects?.length || route.logic?.rules?.length || route.consequences?.length || route.logic?.repeat)}>
          <summary>{es ? "Cambios al tomar esta ruta" : "Changes when taking this route"}</summary>
          <LogicMomentEditor project={project} draftId={route.id} context={conditionContext} hideWhen value={{ ...route.logic, when: route.logic?.when ?? route.conditions, then: route.logic?.then ?? route.consequences }} onChange={(logic) => void onMutation((current) => updateTransition(current, route.id, { logic, conditions: logic.when, consequences: logic.then }).project)} />
        </details>
        <details>
          <summary>{es ? "Más opciones" : "More options"}</summary>
          <code>{route.id}</code>
        </details>
      </div> : null}

      {active === "conditions" && route ? route.mode === "fallback"
        ? <p>{es ? "Esta ruta se usa cuando ninguna bifurcación anterior cumple." : "This route is used when no earlier branch matches."}</p>
        : <>
          <p className="narrative-muted">{es ? "Las bifurcaciones se comprueban en orden; se toma la primera que cumple." : "Branches are checked in order; the first match is taken."}</p>
          <LogicConditionEditor project={project} draftId={route.id} context={conditionContext} compact label={es ? "Seguir esta ruta si" : "Follow this route if"} value={route.logic?.when ?? route.conditions} onChange={(conditions) => update({ conditions })} />
        </>
        : null}

      {active === "connections" && (sourceId || route) ? <details className="route-inspector-add">
        <summary>{es ? "Añadir bifurcación" : "Add branch"}</summary>
        <label className="field-label">{es ? "Destino de la nueva ruta" : "New route destination"}
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="">{es ? "Elegir destino" : "Choose destination"}</option>
            {targetOptions.filter((item) => item.id !== (sourceId ?? route?.from)).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" className="primary" disabled={!destination} onClick={() => {
          const from = sourceId ?? route?.from;
          if (!from) return;
          void onMutation((current) => createInternalTransition(current, eventId, from, destination).project);
          setDestination("");
        }}>{es ? "Añadir bifurcación" : "Add branch"}</button>
      </details> : null}
    </InspectorPanel>
  </div>;
}
