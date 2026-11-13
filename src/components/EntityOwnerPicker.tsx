import type { BranchingProject, EntityInstance, EntityOwner } from "../domain.js";
import { entityCapabilities, entityDefinition } from "../authoringEntities.js";
import { characterInventoryOwnerOptions, defaultPlayerProfileId } from "../characterSheets.js";
import type { ConditionAuthoringContext } from "../conditionAuthoring.js";
import { useInterfaceLocale } from "../i18n.js";

export function EntityOwnerPicker({ project, instances = project.entityInstances ?? [], value, onChange, label, context = false, authoringContext }: {
  project: BranchingProject; instances?: EntityInstance[]; value?: EntityOwner; onChange: (owner: EntityOwner | undefined) => void; label?: string; context?: boolean; authoringContext?: ConditionAuthoringContext;
}) {
  const es = useInterfaceLocale() === "es";
  const protagonistId = defaultPlayerProfileId(project);
  const characterOwners = characterInventoryOwnerOptions(project, es ? 'es' : 'en', authoringContext);
  const characterIds = new Set(characterOwners.map(option => option.entityId));
  const profileChoices: { value: EntityOwner; label: string }[] = [
    ...(project.playerProfiles?.some(profile => profile.id === protagonistId) ? [] : [{ value: { kind: "profile" as const, profileId: protagonistId }, label: es ? "Protagonista" : "Protagonist" }]),
    ...(project.playerProfiles ?? []).map(profile => ({
      value: { kind: "profile" as const, profileId: profile.id },
      label: profile.id === protagonistId
        ? `${es ? "Protagonista" : "Protagonist"}${profile.name && profile.name !== (es ? "Protagonista" : "Protagonist") ? ` · ${profile.name}` : ""}`
        : profile.name,
    })),
  ];
  const contextualCharacters = characterOwners.filter(option => option.contextual).map(option => ({ value: option.owner as EntityOwner, label: option.label }));
  const otherCharacters = characterOwners.filter(option => !option.contextual).map(option => ({ value: option.owner as EntityOwner, label: option.label }));
  const containers = [...project.canonRefs.map(entity => entity.id), ...(project.localExplorerEntities ?? []).map(entity => entity.id)]
    .filter(id => entityCapabilities(project, id).container && !characterIds.has(id))
    .map(id => ({ value: { kind: "entity" as const, entityId: id }, label: entityDefinition(project, id)?.name ?? id }));
  const copies = instances.filter(instance => entityCapabilities(project, instance.entityId).container)
    .map(instance => ({ value: { kind: "instance" as const, instanceId: instance.id }, label: `${instance.name ?? entityDefinition(project, instance.entityId)?.name ?? instance.entityId} · ${es ? "copia" : "copy"}` }));
  const actionContext = context ? (["actor", "self", "target"] as const).map(role => ({
    value: { kind: "context" as const, role },
    label: es ? ({ actor: "Actor", self: "Origen", target: "Destinatario" })[role] : role,
  })) : [];
  const allChoices = [...profileChoices, ...contextualCharacters, ...otherCharacters, ...containers, ...copies, ...actionContext];
  const encoded = value ? JSON.stringify(value) : "";
  const option = (choice: { value: EntityOwner; label: string }) => <option key={JSON.stringify(choice.value)} value={JSON.stringify(choice.value)}>{choice.label}</option>;

  return <label className="field-label">{label ?? (es ? "Pertenece a" : "Owned by")}<select value={encoded} onChange={event => onChange(event.target.value ? JSON.parse(event.target.value) as EntityOwner : undefined)}>
    <option value="">{es ? "Sin poseedor" : "No owner"}</option>
    {value && !allChoices.some(choice => JSON.stringify(choice.value) === encoded) ? <option value={encoded}>{es ? "Referencia no disponible" : "Unavailable reference"}</option> : null}
    {profileChoices.length ? <optgroup label={es ? "Protagonista y perfiles" : "Protagonist and profiles"}>{profileChoices.map(option)}</optgroup> : null}
    {actionContext.length ? <optgroup label={es ? "Contexto de la acción" : "Action context"}>{actionContext.map(option)}</optgroup> : null}
    {contextualCharacters.length ? <optgroup label={es ? "Personajes de esta historia / escena" : "Characters in this story / scene"}>{contextualCharacters.map(option)}</optgroup> : null}
    {otherCharacters.length ? <optgroup label={es ? "Otros personajes" : "Other characters"}>{otherCharacters.map(option)}</optgroup> : null}
    {containers.length ? <optgroup label={es ? "Otros contenedores" : "Other containers"}>{containers.map(option)}</optgroup> : null}
    {copies.length ? <optgroup label={es ? "Contenedores en copia" : "Container copies"}>{copies.map(option)}</optgroup> : null}
  </select></label>;
}
