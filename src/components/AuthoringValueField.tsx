import type { BranchingProject } from "../domain.js";
import { useInterfaceLocale } from "../i18n.js";
import { AuthoringTextField } from "./AuthoringTextField.js";
import { conditionValueMatchesType } from "../conditionEvaluation.js";

export function AuthoringValueField({ project, elementId, field, label, type, value, temporary, onCommit }: {
  project: BranchingProject; elementId: string; field: string; label: string; type: string;
  value: unknown; temporary?: boolean; onCommit: (value: unknown) => void | Promise<void>;
}) {
  const es = useInterfaceLocale() === "es";
  if (type === "boolean" || type === "bool") return <label className="field-label">{label}<select value={value === undefined ? "" : String(value)} onChange={event => { if (event.target.value) void onCommit(event.target.value === "true"); }}><option value="">{es ? "Elegir valor" : "Choose value"}</option><option value="true">{es ? "Sí" : "Yes"}</option><option value="false">No</option></select></label>;
  if (type === "canonRef" || type === "entity-ref") {
    const references = [...project.canonRefs.map(entity => ({ id: entity.id, label: entity.label })), ...(project.localExplorerEntities ?? []).map(entity => ({ id: entity.id, label: entity.name }))];
    return <label className="field-label">{label}<select value={String(value ?? "")} onChange={event => { void onCommit(event.target.value); }}><option value="">{es ? "Sin referencia" : "No reference"}</option>{value && !references.some(reference => reference.id === value) ? <option value={String(value)}>{es ? "Referencia desaparecida" : "Missing reference"} · {String(value)}</option> : null}{references.map(reference => <option key={reference.id} value={reference.id}>{reference.label}</option>)}</select></label>;
  }
  const numeric = ["number", "integer", "float"].includes(type);
  const list = ["list", "multiselect", "entity-ref-list"].includes(type);
  return <AuthoringTextField projectId={temporary ? `run:${project.projectId}` : project.projectId} elementId={elementId} field={field} label={label} inputType={type === "date" ? "date" : "text"} value={list && Array.isArray(value) ? value.join(", ") : String(value ?? "")} validate={text => numeric && (!text.trim() || !Number.isFinite(Number(text))) ? es ? "Introduce un número finito." : "Enter a finite number." : type === "date" && !conditionValueMatchesType(text, "date") ? es ? "Introduce una fecha válida." : "Enter a valid date." : undefined} onCommit={text => onCommit(numeric ? Number(text) : list ? text.split(",").map(item => item.trim()).filter(Boolean) : text)} />;
}
