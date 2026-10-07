import type { BranchingProject, EntityInstance, EntityOwner, LogicSubject, PlayerSimulationState } from './domain.js';
import { typeCapability } from './explorerSchema.js';

export function entityDefinition(project: Partial<BranchingProject>, id: string) {
  const canon = project.canonRefs?.find(e => e.id === id);
  const local = project.localExplorerEntities?.find(e => e.id === id);
  return canon ? { id, name: canon.label ?? id, source: 'canon' as const, typeId: canon.kind, properties: { ...canon.frontmatter, ...canon.properties } }
    : local ? { id, name: local.name, source: 'local' as const, typeId: local.type, properties: { ...(local as unknown as { fields?: Record<string, unknown> }).fields, ...local.properties } } : undefined;
}
export function entityCapabilities(project: BranchingProject, id: string) {
  const entity = entityDefinition(project, id);
  const inherited = entity?.typeId ? typeCapability(project, entity.source, entity.typeId) : undefined;
  const override = project.entityOverrides?.find(e => e.entityId === id);
  const roles: Record<string, boolean> = Object.fromEntries((inherited?.runtimeRoles ?? []).map(r => [r, true]));
  Object.assign(roles, override?.runtimeRoles);
  return { grantable: override?.grantable ?? inherited?.grantable ?? roles.owned ?? false,
    location: override?.location ?? inherited?.location ?? false,
    container: override?.container ?? inherited?.container ?? false, runtimeRoles: roles,
    properties: override?.properties ?? {} };
}
export function resolveContextSubject(subject: LogicSubject, state: PlayerSimulationState, depth = 0): LogicSubject | undefined {
  if (depth > 3) return undefined;
  return subject.kind === 'context' ? state.context?.[subject.role] ? resolveContextSubject(state.context[subject.role]!, state, depth + 1) : undefined : subject;
}
export function resolveOwner(owner: EntityOwner | undefined | null, state: PlayerSimulationState): EntityOwner | undefined {
  if (!owner) return undefined;
  if (owner.kind !== 'context') return owner;
  const resolved = resolveContextSubject({ kind: 'context', role: owner.role }, state);
  if (resolved?.kind === 'entity') return { kind: 'entity', entityId: resolved.entityId };
  if (resolved?.kind === 'instance') return { kind: 'instance', instanceId: resolved.instanceId };
  if (owner.role === 'actor' && state.context?.profileId) return { kind: 'profile', profileId: state.context.profileId };
  return undefined;
}
export function ownerKey(owner: EntityOwner | undefined) {
  return !owner ? '' : owner.kind === 'entity' ? `entity:${owner.entityId}` : owner.kind === 'instance' ? `instance:${owner.instanceId}` : owner.kind === 'profile' ? `profile:${owner.profileId}` : `context:${owner.role}`;
}
export function instanceOwnerIssue(project: BranchingProject, instances: EntityInstance[], instance: EntityInstance): string | undefined {
  if (!entityDefinition(project, instance.entityId)) return `Missing entity ${instance.entityId}`;
  const owner = instance.owner;
  if (!owner) return undefined;
  if (owner.kind === 'context') return 'Unresolved owner context';
  if (owner.kind === 'profile') return project.playerProfiles?.some(p => p.id === owner.profileId) || project.authoringScenarios?.some(s => s.profileId === owner.profileId) || owner.profileId === 'default' ? undefined : `Missing profile ${owner.profileId}`;
  const parent = owner.kind === 'instance' ? instances.find(i => i.id === owner.instanceId) : undefined;
  if (owner.kind === 'instance' && !parent) return `Missing container copy ${owner.instanceId}`;
  const entityId = owner.kind === 'entity' ? owner.entityId : parent!.entityId;
  if (!entityDefinition(project, entityId)) return `Missing container ${entityId}`;
  if (!entityCapabilities(project, entityId).container) return `Entity ${entityId} cannot contain copies`;
  const seen = new Set([instance.id]);
  let current = parent;
  while (current) {
    if (seen.has(current.id)) return 'Containment cycle';
    seen.add(current.id);
    current = current.owner?.kind === 'instance' ? instances.find(i => i.id === (current!.owner as { instanceId: string }).instanceId) : undefined;
  }
  return undefined;
}
export function migrateLegacyInstances(project: BranchingProject, state: PlayerSimulationState, profileId = 'default'): PlayerSimulationState {
  const instances = [...(state.entityInstances ?? project.entityInstances ?? [])];
  for (const entityId of state.entityInstances === undefined ? state.inventory ?? [] : []) {
    const id = `instance:legacy:${encodeURIComponent(profileId)}:${encodeURIComponent(entityId)}`;
    if (!instances.some(i => i.id === id) && !instances.some(i => i.entityId === entityId && ownerKey(i.owner) === `profile:${profileId}`)) {
      instances.push({ id, entityId, owner: { kind: 'profile', profileId }, properties: { ...state.grantableProperties?.[entityId], ...state.entityStates?.[entityId]?.properties }, states: Object.fromEntries(Object.entries(state.entityStates?.[entityId]?.states ?? {}).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) });
    }
  }
  return { ...state, inventory: [], entityInstances: instances };
}
export function normalizeAuthoringEntities(project: BranchingProject): BranchingProject {
  return { ...project,
    ...(project.playerSimulation ? { playerSimulation: migrateLegacyInstances(project, project.playerSimulation) } : {}),
    ...(project.playerProfiles ? { playerProfiles: project.playerProfiles.map(p => ({ ...p, simulation: migrateLegacyInstances(project, p.simulation, p.id) })) } : {}),
    ...(project.authoringScenarios ? { authoringScenarios: project.authoringScenarios.map(s => ({ ...s, state: migrateLegacyInstances(project, s.state ?? {}, s.profileId ?? 'default') })) } : {}) };
}
export function initialAuthoringState(project: BranchingProject, scenario?: import('./domain.js').AuthoringScenario): PlayerSimulationState {
  const profileId = scenario?.profileId ?? project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id ?? 'default';
  const base = project.playerProfiles?.find(p => p.id === profileId)?.simulation ?? project.playerSimulation ?? {};
  const state: PlayerSimulationState = {
    ...base, ...scenario?.state,
    variables: { ...Object.fromEntries((project.logicVariables ?? []).map(v => [v.id, v.value])), ...base.variables, ...scenario?.state?.variables },
    dataObjects: scenario?.state?.dataObjects ?? base.dataObjects ?? project.projectDataObjects,
    entityInstances: scenario?.state?.entityInstances ?? base.entityInstances,
    context: { ...base.context, ...scenario?.state?.context, profileId, actor: scenario?.actor ?? scenario?.state?.context?.actor ?? base.context?.actor ?? (project.playerProfiles?.find(p => p.id === profileId)?.playableCharacterRef ? { kind: 'entity', entityId: project.playerProfiles.find(p => p.id === profileId)!.playableCharacterRef! } : undefined) },
  };
  // Player v0.4 keyed some values by their display name. IDs are authoritative.
  for (const v of project.logicVariables ?? []) if (!(v.id in (scenario?.state?.variables ?? {})) && Object.prototype.hasOwnProperty.call(base.variables ?? {}, v.name)) state.variables![v.id] = base.variables![v.name];
  return structuredClone(migrateLegacyInstances(project, state, profileId));
}
export function entityUsages(project: BranchingProject, id: string): { path: string; value: unknown }[] {
  const found: { path: string; value: unknown }[] = [];
  const seen = new Set<object>();
  const visit = (v: unknown, path: string) => {
    if (typeof v === 'string' && v === id) { found.push({ path, value: v }); return; }
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    Object.entries(v).forEach(([key, value]) => {
      if (key === 'id') return;
      const nextPath = path ? `${path}.${key}` : key;
      if (key === id) found.push({ path: nextPath, value });
      visit(value, nextPath);
    });
  };
  visit({ events: project.events, sequences: project.sequences, branches: project.branches, localExplorerEntities: project.localExplorerEntities, localExplorerProperties: project.localExplorerProperties, entityOverrides: project.entityOverrides, logicTypeOverrides: project.logicTypeOverrides, logicPropertyOverrides: project.logicPropertyOverrides, entityInstances: project.entityInstances, narrativeActions: project.narrativeActions, narrativeRules: project.narrativeRules, authoringScenarios: project.authoringScenarios, playerProfiles: project.playerProfiles, playerSimulation: project.playerSimulation }, '');
  return found;
}
