import { useEffect, useState } from "react";
import type { BranchingProject, EntityCapabilityOverride, EntityInstance, EntityRuntimeStateRole, NarrativeAction, NarrativeRule } from "../domain.js";
import { entityCapabilities, entityDefinition, entityUsages, instanceOwnerIssue } from "../authoringEntities.js";
import { authoringUsagePresentation } from "../diagnosticPresentation.js";
import { conditionDiagnosticMessage } from "../conditionPresentation.js";
import { useInterfaceLocale } from "../i18n.js";
import { LogicConditionEditor } from "./LogicComposer.js";
import { NarrativeEffectEditor, InstancePropertyFields } from "./NarrativeEffectEditor.js";
import { EntityOwnerPicker } from "./EntityOwnerPicker.js";
import { AuthoringTextField } from './AuthoringTextField.js';
import { AuthoringValueField } from './AuthoringValueField.js';
import { typeCapability } from '../explorerSchema.js';

export type AuthoringMutation = (mutate: (project: BranchingProject) => BranchingProject) => void | Promise<void>;

export type AuthoringTarget = { id: string; label: string; eventId?: string; dialogueId?: string; kind?: string };

function UsageReferences({ project, id, onLocate }: { project: BranchingProject; id: string; onLocate?: (id: string) => void }) {
  const es = useInterfaceLocale() === "es";
  const usages = entityUsages(project, id);
  if (!usages.length) return null;
  return <details><summary>{es ? "Dónde se utiliza" : "Where it is used"} · {usages.length}</summary>
    <p>{es ? "Resuelve estas referencias antes de eliminarlo." : "Resolve these references before removing it."}</p>
    <ul>{usages.map((usage, index) => {
      const presentation = authoringUsagePresentation(project, usage.path, es ? "es" : "en");
      return <li key={index}>{presentation.label}{presentation.target || presentation.nodeId || presentation.scenarioId ? <button type="button" onClick={() => {
        if (presentation.scenarioId) window.dispatchEvent(new CustomEvent("pathbranching:locate-scenario", { detail: { id: presentation.scenarioId } }));
        else if (presentation.target) window.dispatchEvent(new CustomEvent("pathbranching:locate-authoring", { detail: presentation.target }));
        else if (presentation.nodeId) {
          if (onLocate) onLocate(presentation.nodeId);
          else window.dispatchEvent(new CustomEvent("pathbranching:locate-narrative", { detail: { id: presentation.nodeId } }));
        }
      }}>{es ? "Localizar" : "Locate"}</button> : null}<details><summary>{es ? "Referencia técnica" : "Technical reference"}</summary><code>{usage.path}</code></details></li>;
    })}</ul>
  </details>;
}

const roles: EntityRuntimeStateRole[] = ["owned", "unlocked", "discovered", "present"];

function OverrideSelect({ label, value, inherited, onChange }: { label: string; value?: boolean; inherited: boolean; onChange: (v: boolean | undefined) => void }) {

  const es = useInterfaceLocale() === "es";

  return <label className="field-label">{label}<select value={value === undefined ? "inherit" : String(value)} onChange={e => onChange(e.target.value === "inherit" ? undefined : e.target.value === "true")}><option value="inherit">{es ? "Heredado" : "Inherited"} · {inherited ? es ? "activado" : "enabled" : es ? "desactivado" : "disabled"}</option><option value="true">{es ? "Activado para esta entidad" : "Enabled for this entity"}</option><option value="false">{es ? "Desactivado para esta entidad" : "Disabled for this entity"}</option></select></label>;

}

export function EntityUsesEditor({ project, onMutation, initialEntityId, onLocate }: { project: BranchingProject; onMutation: AuthoringMutation; initialEntityId?: string; onLocate?: (id:string)=>void }) {

  const es = useInterfaceLocale() === "es";

  const all = [...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)];

  const [chosen, setChosen] = useState(initialEntityId ?? "");

  useEffect(()=>{ if(initialEntityId)setChosen(initialEntityId); },[initialEntityId]);

  const entityId = all.includes(chosen) ? chosen : all[0];

  const [error, setError] = useState("");

  const entity = entityId ? entityDefinition(project, entityId) : undefined;

  if (!entity || !entityId) return <p>{es ? "Crea o importa una entidad desde Recursos para configurar sus usos." : "Create or import an entity from Resources to configure its uses."}</p>;

  const override = project.entityOverrides?.find(o => o.entityId === entityId);

  const inherited = entityCapabilities({ ...project, entityOverrides: project.entityOverrides?.filter(o => o.entityId !== entityId) }, entityId);

  const capability = entityCapabilities(project, entityId);

  const update = (patch: Partial<EntityCapabilityOverride>) => onMutation(current => ({ ...current, entityOverrides: [...(current.entityOverrides ?? []).filter(o => o.entityId !== entityId), { ...current.entityOverrides?.find(o => o.entityId === entityId), entityId, ...patch }] }));

  const typeId = entity.typeId?.replace(/^type:/, "");

  const type = typeId?typeCapability(project,entity.source,typeId):undefined;

  const configureType = (patch: Partial<NonNullable<BranchingProject['logicTypeOverrides']>[number]>) => onMutation(current => ({ ...current,

    logicTypeOverrides: [...(current.logicTypeOverrides ?? []).filter(o => !(o.source === entity.source && o.typeId.replace(/^type:/, "") === typeId)), { ...type, typeId: typeId ?? entityId, source: entity.source, ...patch }],

    logicPropertyOverrides:(current.logicPropertyOverrides ?? []).map(o=>o.source===entity.source&&o.propertyId===`type:${typeId}`?{...o,...patch}:o),

  }));

  const configureProperty = (propertyId:string,flag:'conditionReadable'|'actionWritable',value:boolean) => onMutation(current=>({ ...current,logicPropertyOverrides:[...(current.logicPropertyOverrides ?? []).filter(p=>!(p.source===entity.source&&p.propertyId===propertyId)),{...current.logicPropertyOverrides?.find(p=>p.source===entity.source&&p.propertyId===propertyId),propertyId,source:entity.source,[flag]:value}] }));

  const copies = project.entityInstances?.filter(i => i.entityId === entityId) ?? [];


  const keys = new Set([...Object.keys(entity.properties).filter(k => !["id", "name", "type", "kind", "aliases"].includes(k)), ...(project.localExplorerProperties ?? []).filter(p => p.valueType !== "entity-type").map(p => p.id.replace(/^property:/, ""))]);

  const editCopy = (id: string, patch: Partial<EntityInstance>) => {

    const next = (project.entityInstances ?? []).map(i => i.id === id ? { ...i, ...patch } : i);

    const issue = instanceOwnerIssue(project, next, next.find(i => i.id === id)!);

    if (issue) { setError(issue); return; }

    setError(""); void onMutation(current => ({ ...current, entityInstances: (current.entityInstances ?? []).map(i => i.id === id ? { ...i, ...patch } : i) }));

  };

  return <section className="authoring-studio" data-authoring-id={entityId} tabIndex={-1} aria-label={es ? "Usos en esta historia" : "Uses in this story"}>

    <label className="field-label">{es ? "Entidad" : "Entity"}<select value={entityId} onChange={e => { setChosen(e.target.value); setError(""); }}>{all.map(id => <option key={id} value={id}>{entityDefinition(project, id)?.name ?? id}</option>)}</select></label>

    <p className="authoring-origin">{es ? "Origen" : "Origin"}: {entity.source === "canon" ? "Canon" : es ? "Local de esta historia" : "Local to this story"} · {typeId ?? (es ? "Sin tipo" : "No type")}</p>

    <details><summary>{es ? "Configurar el tipo reutilizable" : "Configure reusable type"}</summary><p>{es ? "Afecta a las entidades de este tipo en esta historia; las excepciones individuales prevalecen." : "Applies to this type in this story; individual exceptions take precedence."}</p>

      {(["grantable", "container", "location"] as const).map(key => <label className="field-label" key={key}><input type="checkbox" checked={type?.[key] ?? false} onChange={e => void configureType({[key]:e.target.checked})} />{es ? ({ grantable: "Puede poseerse", container: "Puede contener copias", location: "Puede ser ubicación" })[key] : key}</label>)}

      <fieldset><legend>{es?'Estados disponibles para el tipo':'States available for this type'}</legend>{roles.map(role=><label className="field-label" key={role}><input type="checkbox" checked={type?.runtimeRoles?.includes(role) ?? false} onChange={e=>void configureType({runtimeRoles:e.target.checked?[...(type?.runtimeRoles ?? []),role]:(type?.runtimeRoles ?? []).filter(r=>r!==role)})}/>{es?({owned:'Posesión',unlocked:'Desbloqueo',discovered:'Descubrimiento',present:'Presencia'})[role]:role}</label>)}</fieldset>

    </details>

    <fieldset><legend>{es ? "Excepciones de esta entidad" : "Entity exceptions"}</legend>

      {(["grantable", "container", "location"] as const).map(key => <OverrideSelect key={key} label={es ? ({ grantable: "Puede poseerse", container: "Puede contener copias", location: "Puede ser ubicación" })[key] : key} value={override?.[key]} inherited={inherited[key]} onChange={value => void update({ [key]: value })} />)}

      {roles.map(role => <OverrideSelect key={role} label={es ? ({ owned: "Posesión", unlocked: "Desbloqueo", discovered: "Descubrimiento", present: "Estado de presencia" })[role] : role} value={override?.runtimeRoles?.[role]} inherited={inherited.runtimeRoles[role] ?? false} onChange={value => void update({ runtimeRoles: { ...override?.runtimeRoles, [role]: value } })} />)}

      <p>{es ? "El estado de presencia es una regla de la historia. Los participantes de una escena y su ubicación se eligen en el evento." : "Presence is a story state. Scene participants and location are selected on the event."}</p>

    </fieldset>

    <details><summary>{es ? "Propiedades consultables y modificables" : "Readable and writable properties"}</summary>{[...keys].map(key => {

      const propertyId = project.localExplorerProperties?.find(p => p.id === key || p.id === `property:${key}`)?.id ?? key;

      const base = project.logicPropertyOverrides?.find(p => p.source === entity.source && [key, propertyId].includes(p.propertyId));

      const own = override?.properties?.[propertyId];

      return <fieldset key={propertyId}><legend>{project.localExplorerProperties?.find(p => p.id === propertyId)?.label ?? key}</legend>{(["conditionReadable", "actionWritable"] as const).map(flag => <div key={flag}><label className="field-label"><input type="checkbox" checked={base?.[flag] ?? false} onChange={e=>void configureProperty(propertyId,flag,e.target.checked)}/>{flag==='conditionReadable'?es?'Habilitar consulta compartida':'Enable shared reading':es?'Habilitar modificación compartida':'Enable shared writing'}</label><OverrideSelect label={flag === "conditionReadable" ? es ? "Consultar en condiciones" : "Read in conditions" : es ? "Cambiar con consecuencias" : "Write in effects"} value={own?.[flag]} inherited={base?.[flag] === true} onChange={value => void update({ properties: { ...override?.properties, [propertyId]: { ...own, [flag]: value } } })} /></div>)}</fieldset>;

    })}</details>

    <fieldset><legend>{es ? "Copias iniciales" : "Initial copies"}</legend>

      {copies.map(copy => <details key={copy.id} data-authoring-id={copy.id} tabIndex={-1} open={copy.id===initialEntityId}><summary>{copy.name ?? entity.name}</summary><AuthoringTextField projectId={project.projectId} elementId={copy.id} field="name" label={es?'Nombre de la copia':'Copy name'} value={copy.name ?? ''} onCommit={name=>editCopy(copy.id,{name})}/><EntityOwnerPicker project={project} value={copy.owner} onChange={owner => editCopy(copy.id, { owner })} /><InstancePropertyFields project={project} instance={copy} draftId={copy.id} onChange={patch => editCopy(copy.id, patch)} />

        <UsageReferences project={project} id={copy.id} onLocate={onLocate} />

        <button type="button" className="danger" disabled={entityUsages({ ...project, entityInstances: project.entityInstances?.filter(i => i.id !== copy.id) }, copy.id).length > 0} onClick={() => void onMutation(current => ({ ...current, entityInstances: current.entityInstances?.filter(i => i.id !== copy.id) }))}>{es ? "Retirar copia inicial" : "Remove initial copy"}</button>

      </details>)}

      <button type="button" onClick={() => void onMutation(current => ({ ...current, entityInstances: [...(current.entityInstances ?? []), { id: `instance:${crypto.randomUUID()}`, entityId, name: `${entity.name} ${copies.length + 1}` }] }))}>{es ? "Crear copia inicial" : "Create initial copy"}</button>

    </fieldset>

    {error ? <p className="condition-field-error" role="alert">{conditionDiagnosticMessage(error, es ? "es" : "en")}</p> : null}

    <UsageReferences project={project} id={entityId} onLocate={onLocate} />

  </section>;

}

export function ActionsEditor({ project, onMutation, targets, initialId }: { project: BranchingProject; onMutation: AuthoringMutation; targets: AuthoringTarget[]; initialId?: string }) {

  const es = useInterfaceLocale() === "es";

  const [active, setActive] = useState(initialId ?? "");

  useEffect(() => { if (initialId) setActive(initialId); }, [initialId]);

  const actions = project.narrativeActions ?? [];

  const action = actions.find(a => a.id === active) ?? actions[0];

  const update = (patch: Partial<NarrativeAction>) => { if (action) void onMutation(current => ({ ...current, narrativeActions: current.narrativeActions?.map(a => a.id === action.id ? { ...a, ...patch } : a) })); };

  const create = (name: string) => { const id = `action:${crypto.randomUUID()}`; void onMutation(current => ({ ...current, narrativeActions: [...(current.narrativeActions ?? []), { id, name, navigation: "call", repeat: "once", ...(name === "Entregar" || name === "Give" ? { requiresTarget: true, effects: [{ type: "instanceEffect" as const, operation: "move" as const, instanceId: "@self", owner: { kind: "context" as const, role: "target" as const } }] } : {}) }] })); setActive(id); };

  const entities = [...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)];

  const types = [...new Set(entities.map(id => entityDefinition(project, id)?.typeId).filter((id): id is string => Boolean(id)))];

  return <section className="authoring-studio" data-authoring-id={action?.id} tabIndex={-1}><div className="authoring-action-templates">{(es ? ["Hablar", "Examinar", "Usar", "Entregar"] : ["Talk", "Examine", "Use", "Give"]).map(name => <button type="button" key={name} onClick={() => create(name)}>{name} +</button>)}<button type="button" onClick={() => create(es ? "Nueva acción" : "New action")}>{es ? "Acción propia +" : "Custom action +"}</button></div>

    {action ? <><label className="field-label">{es ? "Acción" : "Action"}<select value={action.id} onChange={e => setActive(e.target.value)}>{actions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><AuthoringTextField projectId={project.projectId} elementId={action.id} field="name" label={es ? "Nombre de la acción" : "Action name"} value={action.name} validate={value => value.trim() ? undefined : es ? "El nombre es obligatorio." : "A name is required."} onCommit={name => update({ name })} />

      <label className="field-label">{es ? "Disponible para" : "Available for"}<select value={action.entityId ? `entity:${action.entityId}` : action.typeId ? `type:${action.typeId}` : ""} onChange={e => update(e.target.value.startsWith("entity:") ? { entityId: e.target.value.slice(7), typeId: undefined } : { entityId: undefined, typeId: e.target.value.slice(5) || undefined })}><option value="">{es ? "Cualquier entidad" : "Any entity"}</option><optgroup label={es ? "Tipos" : "Types"}>{types.map(id => <option key={id} value={`type:${id}`}>{id.replace(/^type:/, "")}</option>)}</optgroup><optgroup label={es ? "Entidad concreta" : "Specific entity"}>{entities.map(id => <option key={id} value={`entity:${id}`}>{entityDefinition(project, id)?.name ?? id}</option>)}</optgroup></select></label>

      <label className="field-label"><input type="checkbox" checked={action.enabled !== false} onChange={event => update({ enabled: event.target.checked })} />{es ? "Acción habilitada" : "Action enabled"}</label>

      {action.entityId ? <label className="field-label">{es ? "Excepción de una acción del tipo" : "Override a type action"}<select value={action.overridesActionId ?? ""} onChange={event => update({ overridesActionId: event.target.value || undefined })}><option value="">{es ? "Acción adicional" : "Additional action"}</option>{actions.filter(base => base.id !== action.id && !base.entityId && (!base.typeId || base.typeId.replace(/^type:/, "") === entityDefinition(project, action.entityId!)?.typeId?.replace(/^type:/, ""))).map(base => <option key={base.id} value={base.id}>{base.name}</option>)}</select></label> : null}

      <label className="field-label"><input type="checkbox" checked={action.requiresTarget ?? false} onChange={e => update({ requiresTarget: e.target.checked })} />{es ? "Elegir destinatario al ejecutarla" : "Choose recipient when running"}</label>

      <LogicConditionEditor project={project} draftId={action.id} value={action.when} onChange={when => update({ when })} label={es ? "Cuándo está disponible" : "Availability"} />

      <NarrativeEffectEditor project={project} draftId={action.id} contextEntityId={action.entityId ?? entities.find(id => entityDefinition(project, id)?.typeId?.replace(/^type:/, "") === action.typeId?.replace(/^type:/, ""))} value={action.effects} onChange={effects => update({ effects })} />

      <TargetPicker targets={targets} value={action.targetNodeId} onChange={targetNodeId => update({ targetNodeId })} />

      {action.targetNodeId ? <label className="field-label">{es ? "Al terminar" : "On completion"}<select value={action.navigation ?? "call"} onChange={e => update({ navigation: e.target.value as "call" | "jump" })}><option value="call">{es ? "Volver al punto interrumpido" : "Return to interrupted point"}</option><option value="jump">{es ? "Continuar por el nuevo camino" : "Continue on the new path"}</option></select></label> : null}

      <RepeatPicker value={action.repeat} onChange={repeat => update({ repeat })} />

      <UsageReferences project={project} id={action.id} />
      <button type="button" className="danger" disabled={entityUsages(project, action.id).length > 0} onClick={() => void onMutation(current => ({ ...current, narrativeActions: current.narrativeActions?.filter(a => a.id !== action.id) }))}>{es ? "Eliminar acción" : "Remove action"}</button>

    </> : <p>{es ? "Crea una acción para dar comportamientos reutilizables a tus entidades." : "Create an action to give entities reusable behavior."}</p>}

  </section>;

}

export function TargetPicker({ targets, value, onChange }: { targets: AuthoringTarget[]; value?: string; onChange: (value: string | undefined) => void }) {

  const es = useInterfaceLocale() === "es";

  return <label className="field-label">{es ? "Diálogo o destino" : "Dialogue or destination"}<select value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}><option value="">{es ? "Mantener el camino actual" : "Keep current path"}</option>{value && !targets.some(t => t.id === value) ? <option value={value}>{es ? "Destino desaparecido" : "Missing destination"} · {value}</option> : null}{targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>;

}

export function RepeatPicker({ value, onChange }: { value?: "once" | "each-entry"; onChange: (value: "once" | "each-entry") => void }) {

  const es = useInterfaceLocale() === "es";

  return <label className="field-label">{es ? "Repetición" : "Repeat"}<select value={value ?? "once"} onChange={e => onChange(e.target.value as "once" | "each-entry")}><option value="once">{es ? "Una vez por recorrido" : "Once per run"}</option><option value="each-entry">{es ? "Cada entrada o nueva activación" : "Each entry or new activation"}</option></select></label>;

}

export function RulesEditor({ project, eventId, dialogueId, targets, onMutation, initialId }: { project: BranchingProject; eventId?: string; dialogueId?: string; targets: AuthoringTarget[]; onMutation: AuthoringMutation; initialId?: string }) {

  const es = useInterfaceLocale() === "es";

  const [active, setActive] = useState(initialId ?? "");

  useEffect(() => { if (initialId) setActive(initialId); }, [initialId]);

  const rules = [...(project.narrativeRules ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const rule = rules.find(r => r.id === active) ?? rules[0];

  const update = (patch: Partial<NarrativeRule>) => { if (rule) void onMutation(current => ({ ...current, narrativeRules: current.narrativeRules?.map(r => r.id === rule.id ? { ...r, ...patch } : r) })); };

  return <section className="authoring-studio" data-authoring-id={rule?.id} tabIndex={-1}><button type="button" onClick={() => { const id = `rule:${crypto.randomUUID()}`; void onMutation(current => ({ ...current, narrativeRules: [...(current.narrativeRules ?? []), { id, name: es ? "Nueva regla" : "New rule", trigger: "enter", scope: dialogueId ? { kind: "dialogue", id: dialogueId } : eventId ? { kind: "event", id: eventId } : { kind: "global" }, priority: rules.length, repeat: "once" }] })); setActive(id); }}>{es ? "Añadir regla" : "Add rule"}</button>

    {rule ? <><label className="field-label">{es ? "Regla · prioridad" : "Rule · priority"}<select value={rule.id} onChange={e => setActive(e.target.value)}>{rules.map(r => <option key={r.id} value={r.id}>{r.priority ?? 0} · {r.name}</option>)}</select></label><AuthoringTextField projectId={project.projectId} elementId={rule.id} field="name" label={es ? "Nombre de la regla" : "Rule name"} value={rule.name} validate={value => value.trim() ? undefined : es ? "El nombre es obligatorio." : "A name is required."} onCommit={name => update({ name })} />

      <label className="field-label">{es ? "Momento" : "Trigger"}<select value={rule.trigger} onChange={e => update({ trigger: e.target.value as NarrativeRule["trigger"] })}><option value="enter">{es ? "Al entrar" : "On entry"}</option><option value="continue">{es ? "Al continuar" : "On continue"}</option><option value="stateChanged">{es ? "Al cambiar inventario o estado" : "On inventory or state change"}</option></select></label>

      <label className="field-label">{es ? "Alcance" : "Scope"}<select value={JSON.stringify(rule.scope)} onChange={e => update({ scope: JSON.parse(e.target.value) as NarrativeRule["scope"] })}><option value={JSON.stringify({ kind: "global" })}>{es ? "Toda la historia · global explícita" : "Whole story · explicit global"}</option>{project.events.map(e => <option key={e.id} value={JSON.stringify({ kind: "event", id: e.id })}>{e.name}</option>)}{targets.filter(target => target.kind !== "event" && target.kind !== "dialogue").map(target => <option key={target.id} value={JSON.stringify({kind:"node",id:target.id})}>{target.label}</option>)}{project.events.flatMap(e => (e.dialogues ?? []).map(d => <option key={`${e.id}:${d.id}`} value={JSON.stringify({ kind: "dialogue", id: d.id })}>{e.name} / {d.title}</option>))}</select></label>

      <AuthoringValueField project={project} elementId={rule.id} field="priority" label={es ? "Prioridad · menor primero" : "Priority · lowest first"} type="number" value={rule.priority ?? 0} onCommit={priority => update({ priority: priority as number })} /><RepeatPicker value={rule.repeat} onChange={repeat => update({ repeat })} />

      <LogicConditionEditor project={project} draftId={rule.id} value={rule.when} onChange={when => update({ when })} label={es ? "Si se cumple" : "When satisfied"} /><NarrativeEffectEditor project={project} draftId={rule.id} value={rule.effects} onChange={effects => update({ effects })} /><TargetPicker targets={targets} value={rule.targetNodeId} onChange={targetNodeId => update({ targetNodeId })} />

      <UsageReferences project={project} id={rule.id} />
      <button type="button" className="danger" disabled={entityUsages(project, rule.id).length > 0} onClick={() => void onMutation(current => ({ ...current, narrativeRules: current.narrativeRules?.filter(r => r.id !== rule.id) }))}>{es ? "Eliminar regla" : "Remove rule"}</button>

    </> : <p>{es ? "Las reglas cambian estados y caminos en momentos explícitos." : "Rules change states and routes at explicit moments."}</p>}

  </section>;

}
