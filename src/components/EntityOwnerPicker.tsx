import type { BranchingProject, EntityInstance, EntityOwner } from "../domain.js";
import { entityCapabilities, entityDefinition } from "../authoringEntities.js";
import { useInterfaceLocale } from "../i18n.js";

export function EntityOwnerPicker({ project, instances = project.entityInstances ?? [], value, onChange, label, context = false }: {
  project: BranchingProject; instances?: EntityInstance[]; value?: EntityOwner; onChange: (owner: EntityOwner | undefined) => void; label?: string; context?: boolean;
}) {
  const es = useInterfaceLocale() === "es";
  const choices: { value: EntityOwner; label: string }[] = [
    ...[...(project.playerProfiles?.some(profile => profile.id === "default") ? [] : [{ id: "default", name: es ? "Protagonista" : "Protagonist" }]), ...(project.playerProfiles ?? [])].map(p => ({ value: { kind: "profile" as const, profileId: p.id }, label: p.name })),
    ...[...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)].filter(id => entityCapabilities(project, id).container).map(id => ({ value: { kind: "entity" as const, entityId: id }, label: entityDefinition(project, id)?.name ?? id })),
    ...instances.filter(i => entityCapabilities(project, i.entityId).container).map(i => ({ value: { kind: "instance" as const, instanceId: i.id }, label: `${i.name ?? entityDefinition(project, i.entityId)?.name ?? i.entityId} · ${es ? "copia" : "copy"}` })),
    ...(context ? (["actor", "self", "target"] as const).map(role => ({ value: { kind: "context" as const, role }, label: es ? ({ actor: "Actor", self: "Origen", target: "Destinatario" })[role] : role })) : []),
  ];
  const encoded = value ? JSON.stringify(value) : "";
  return <label className="field-label">{label ?? (es ? "Pertenece a" : "Owned by")}<select value={encoded} onChange={e => onChange(e.target.value ? JSON.parse(e.target.value) as EntityOwner : undefined)}>
    <option value="">{es ? "Sin poseedor" : "No owner"}</option>
    {value && !choices.some(c => JSON.stringify(c.value) === encoded) ? <option value={encoded}>{es ? "Referencia no disponible" : "Unavailable reference"}</option> : null}
    {choices.map((c, i) => <option key={i} value={JSON.stringify(c.value)}>{c.label}</option>)}
  </select></label>;
}
