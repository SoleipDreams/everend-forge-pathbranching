import { GitBranch, Plus, Search, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { Selection } from "../appTypes.js";
import type { BranchingProject, NarrativeRule } from "../domain.js";
import { entityDefinition } from "../authoringEntities.js";
import { authoringNodeOptions } from "../authoringMutations.js";
import { canonExplorerTypes } from "../explorerSchema.js";
import { useInterfaceLocale } from "../i18n.js";
import { appendCatalogAction, appendCatalogRule, contextualRuleScope, type RuleCreationContext } from "../logicAuthoringCatalog.js";
import "../logicAuthoringCatalog.css";

export function LogicAuthoringCatalog({
  kind, project, propertiesConfig, selected, currentEventId, currentDialogueId, onUpdate, onOpenInspector,
}: RuleCreationContext & {
  kind: "actions" | "rules";
  project: BranchingProject;
  propertiesConfig?: Record<string, unknown>;
  selected?: Selection;
  onUpdate: (project: BranchingProject) => void;
  onOpenInspector: (selection: Selection) => void;
}) {
  const es = useInterfaceLocale() === "es";
  const [search, setSearch] = useState("");
  const [creationScope, setCreationScope] = useState<"context" | "event" | "global">("context");
  const nodes = useMemo(() => authoringNodeOptions(project), [project]);
  const types = useMemo(() => [
    ...canonExplorerTypes(propertiesConfig), ...(project.localExplorerTypes ?? []),
    ...(project.localExplorerProperties ?? []).filter(property => property.valueType === "entity-type"),
  ], [propertiesConfig, project.localExplorerTypes, project.localExplorerProperties]);
  const event = project.events.find(item => item.id === currentEventId);
  const contextScope = contextualRuleScope(project, { currentEventId, currentDialogueId });
  const scopeChoice = creationScope === "global" || contextScope.kind === "global" ? "global"
    : creationScope === "event" && event && contextScope.kind === "dialogue" ? "event" : "context";
  const scope: NarrativeRule["scope"] = scopeChoice === "global" ? { kind: "global" }
    : scopeChoice === "event" && event ? { kind: "event", id: event.id } : contextScope;
  const scopeLabel = (value: NarrativeRule["scope"]): string => {
    if (value.kind === "global") return es ? "Toda la historia" : "Whole story";
    if (value.kind === "event") return project.events.find(item => item.id === value.id)?.name ?? `${es ? "Evento ausente" : "Missing event"} · ${value.id}`;
    if (value.kind === "dialogue") {
      const owner = project.events.find(item => item.dialogues?.some(dialogue => dialogue.id === value.id));
      const dialogue = owner?.dialogues?.find(item => item.id === value.id);
      return dialogue ? `${owner!.name} / ${dialogue.title}` : `${es ? "Diálogo ausente" : "Missing dialogue"} · ${value.id}`;
    }
    return nodes.find(item => item.id === value.id)?.label ?? `${es ? "Nodo ausente" : "Missing node"} · ${value.id}`;
  };
  const actionOwner = (entityId?: string, typeId?: string): string => entityId
    ? entityDefinition(project, entityId)?.name ?? `${es ? "Entidad ausente" : "Missing entity"} · ${entityId}`
    : typeId ? types.find(type => type.id.replace(/^type:/, "") === typeId.replace(/^type:/, ""))?.label ?? typeId.replace(/^type:/, "")
      : (es ? "Cualquier entidad" : "Any entity");
  const actions = (project.narrativeActions ?? []).map(action => ({
    id: action.id, name: action.name, context: actionOwner(action.entityId, action.typeId),
    detail: action.enabled === false ? (es ? "Deshabilitada" : "Disabled") : action.description ?? "",
    condition: Boolean(action.when), effects: action.effects?.length ?? 0,
  }));
  const rules = [...(project.narrativeRules ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map(rule => ({
    id: rule.id, name: rule.name, context: scopeLabel(rule.scope),
    detail: `${rule.priority ?? 0} · ${rule.trigger === "enter" ? (es ? "Al entrar" : "On entry") : rule.trigger === "continue" ? (es ? "Al continuar" : "On continue") : (es ? "Al cambiar estado" : "On state change")}`,
    condition: Boolean(rule.when), effects: rule.effects?.length ?? 0,
  }));
  const items = kind === "actions" ? actions : rules;
  const needle = search.trim().toLocaleLowerCase();
  const filtered = items.filter(item => !needle || `${item.name} ${item.id} ${item.context} ${item.detail}`.toLocaleLowerCase().includes(needle));
  const title = kind === "actions" ? (es ? "Acciones" : "Actions") : (es ? "Reglas" : "Rules");
  const searchLabel = kind === "actions" ? (es ? "Buscar acciones" : "Search actions") : (es ? "Buscar reglas" : "Search rules");
  const createLabel = kind === "actions" ? (es ? "Nueva acción" : "New action") : (es ? "Nueva regla" : "New rule");
  const targetType = kind === "actions" ? "narrativeAction" : "narrativeRule";
  const create = () => {
    const id = `${kind === "actions" ? "action" : "rule"}:${crypto.randomUUID()}`;
    onUpdate(kind === "actions" ? appendCatalogAction(project, id, createLabel) : appendCatalogRule(project, id, createLabel, scope));
    setSearch("");
    onOpenInspector({ type: targetType, id });
  };

  return <section className="logic-authoring-catalog" aria-label={title}>
    <div className="panel-toolbar">
      <strong>{title} <span className="logic-catalog-count">{items.length}</span></strong>
      <button type="button" className="primary" onClick={create}><Plus size={14} />{createLabel}</button>
    </div>
    <div className="explorer-toolbar">
      <label className="explorer-search"><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label={searchLabel} placeholder={searchLabel} /></label>
    </div>
    {kind === "rules" ? <label className="logic-catalog-scope">
      <span>{es ? "Alcance de la nueva regla" : "Scope for the new rule"}</span>
      <select value={scopeChoice} onChange={event => setCreationScope(event.target.value as typeof creationScope)}>
        {contextScope.kind !== "global" ? <option value="context">{scopeLabel(contextScope)}</option> : null}
        {contextScope.kind === "dialogue" && event ? <option value="event">{event.name}</option> : null}
        <option value="global">{es ? "Toda la historia" : "Whole story"}</option>
      </select>
    </label> : null}
    <div className="logic-catalog-list">
      {filtered.map(item => <button type="button" key={item.id} className={`logic-catalog-item ${selected?.type === targetType && selected.id === item.id ? "active" : ""}`}
        aria-label={`${es ? "Inspeccionar" : "Inspect"} ${item.name}`} onClick={() => onOpenInspector({ type: targetType, id: item.id })}>
        {kind === "actions" ? <Zap size={16} /> : <GitBranch size={16} />}
        <span className="logic-catalog-item-content"><strong>{item.name}</strong><span title={item.context}>{item.context}</span>
          {item.detail ? <small>{item.detail}</small> : null}
          {item.condition || item.effects ? <small className="logic-catalog-indicators">{[item.condition ? (es ? "Condición" : "Condition") : "", item.effects ? `${item.effects} ${es ? "efectos" : "effects"}` : ""].filter(Boolean).join(" · ")}</small> : null}
        </span>
      </button>)}
      {!filtered.length ? <p className="panel-empty" role="status">{needle ? (es ? "No hay resultados para esta búsqueda." : "No results for this search.")
        : kind === "actions" ? (es ? "Crea una acción reutilizable. Su detalle se abrirá en el inspector." : "Create a reusable action. Its details will open in the inspector.")
          : (es ? "Crea una regla para el contexto actual o toda la historia. Su detalle se abrirá en el inspector." : "Create a rule for the current context or the whole story. Its details will open in the inspector.")}</p> : null}
    </div>
  </section>;
}
