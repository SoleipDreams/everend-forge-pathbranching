import type { BranchingProject, EntityInstance, EntityOwner, LogicSubject, PlayerSimulationState } from './domain.js';
import { typeCapability } from './explorerSchema.js';
import { characterInventoryOwnerOptions } from './characterSheets.js';
import { canonVariantsForRef } from './worldnotionVariants.js';

export function entityDefinition(project: Partial<BranchingProject>, id: string) {
  const canon = project.canonRefs?.find(e => e.id === id);
  const local = project.localExplorerEntities?.find(e => e.id === id);
  return canon ? { id, name: canon.label ?? id, source: 'canon' as const, typeId: canon.kind, properties: { ...canon.frontmatter, ...canon.properties } }
    : local ? { id, name: local.name, source: 'local' as const, typeId: local.type, properties: { ...(local as unknown as { fields?: Record<string, unknown> }).fields, ...local.properties } } : undefined;
}
type EntityCapabilityProject = Pick<BranchingProject, 'canonRefs' | 'localExplorerEntities'>
  & Partial<Pick<BranchingProject, 'logicTypeOverrides' | 'logicPropertyOverrides' | 'entityOverrides'>>;
export function entityCapabilities(project: EntityCapabilityProject, id: string) {
  const entity = entityDefinition(project, id);
  const inherited = entity?.typeId ? typeCapability(project, entity.source, entity.typeId) : undefined;
  const override = project.entityOverrides?.find(e => e.entityId === id);
  const roles: Record<string, boolean> = Object.fromEntries((inherited?.runtimeRoles ?? []).map(r => [r, true]));
  Object.assign(roles, override?.runtimeRoles);
  const grantable = override?.grantable ?? inherited?.grantable ?? roles.owned ?? false;
  const legacyInventoryItem = entity?.typeId?.replace(/^type:/, '') === 'item'
    || override?.itemCatalogIncluded === true || Boolean(override?.inventoryModifiers?.length);
  return { grantable,
    inventoryItem: grantable && (override?.inventoryItem ?? inherited?.inventoryItem ?? legacyInventoryItem),
    location: override?.location ?? inherited?.location ?? false,
    container: override?.container ?? inherited?.container ?? false, runtimeRoles: roles,
    properties: override?.properties ?? {} };
}
export function resolveContextSubject(subject: LogicSubject, state: Pick<PlayerSimulationState, 'context'>, depth = 0): LogicSubject | undefined {
  if (depth > 3) return undefined;
  return subject.kind === 'context' ? state.context?.[subject.role] ? resolveContextSubject(state.context[subject.role]!, state, depth + 1) : undefined : subject;
}
export function resolveOwner(owner: EntityOwner | undefined | null, state: Pick<PlayerSimulationState, 'context'>): EntityOwner | undefined {
  if (!owner) return undefined;
  if (owner.kind !== 'context') return owner;
  const resolved = resolveContextSubject({ kind: 'context', role: owner.role }, state);
  if (resolved?.kind === 'entity') return { kind: 'entity', entityId: resolved.entityId, ...(resolved.variantId && resolved.variantId !== 'base' ? { variantId: resolved.variantId } : {}) };
  if (resolved?.kind === 'instance') return { kind: 'instance', instanceId: resolved.instanceId };
  if (owner.role === 'actor' && state.context?.profileId) return { kind: 'profile', profileId: state.context.profileId };
  return undefined;
}
export function ownerKey(owner: EntityOwner | undefined) {
  return !owner ? '' : owner.kind === 'entity' ? `entity:${owner.entityId}${owner.variantId && owner.variantId !== 'base' ? `:variant:${owner.variantId}` : ''}` : owner.kind === 'instance' ? `instance:${owner.instanceId}` : owner.kind === 'profile' ? `profile:${owner.profileId}` : `context:${owner.role}`;
}
export function canOwnInventory(project: BranchingProject, entityId: string, variantId = 'base') {
  return entityCapabilities(project, entityId).container || characterInventoryOwnerOptions(project).some(option => option.entityId === entityId && option.variantId === (variantId || 'base'));
}
export function inventoryOwnerIssue(project: BranchingProject, instances: EntityInstance[], owner: EntityOwner | undefined | null): string | undefined {
  if (!owner) return undefined;
  if (owner.kind === 'context') return 'Unresolved owner context';
  if (owner.kind === 'profile') return project.playerProfiles?.some(p => p.id === owner.profileId) || project.authoringScenarios?.some(s => s.profileId === owner.profileId) || owner.profileId === 'default' ? undefined : `Missing profile ${owner.profileId}`;
  const parent = owner.kind === 'instance' ? instances.find(i => i.id === owner.instanceId) : undefined;
  if (owner.kind === 'instance' && !parent) return `Missing container copy ${owner.instanceId}`;
  const entityId = owner.kind === 'entity' ? owner.entityId : parent!.entityId;
  if (!entityDefinition(project, entityId)) return `Missing container ${entityId}`;
  const variantId = owner.kind === 'entity' ? owner.variantId ?? 'base' : owner.kind === 'instance' ? parent?.variantId ?? 'base' : 'base';
  if (variantId !== 'base') {
    const ref = project.canonRefs.find(item => item.id === entityId);
    if (!ref || !canonVariantsForRef(ref).some(variant => variant.id === variantId)) return `Missing variant ${variantId} for inventory owner ${entityId}`;
  }
  if (!canOwnInventory(project, entityId, variantId)) return `Entity ${entityId} cannot contain copies`;
  return undefined;
}
export function instanceOwnerIssue(project: BranchingProject, instances: EntityInstance[], instance: EntityInstance): string | undefined {
  if (!entityDefinition(project, instance.entityId)) return `Missing entity ${instance.entityId}`;
  const owner = instance.owner;
  const ownerIssue = inventoryOwnerIssue(project, instances, owner);
  if (ownerIssue) return ownerIssue;
  if (!owner || owner.kind !== 'instance') return undefined;
  const parent = instances.find(i => i.id === owner.instanceId);
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
export function sequenceForStartingPoint(project: BranchingProject, startNodeId?: string): string | undefined {
  if (startNodeId?.startsWith('start:')) {
    const id = startNodeId.slice('start:'.length);
    if (project.sequences.some(sequence => sequence.id === id)) return id;
  }
  const event = project.events.find(candidate => {
    if (!startNodeId || candidate.id === startNodeId) return Boolean(startNodeId);
    const ids = [
      ...(candidate.dialogues ?? []).flatMap(dialogue => [
        `dialogue:${candidate.id}:${dialogue.id}`,
        ...(dialogue.beats ?? []).map(beat => `beat:${candidate.id}:${beat.id}`),
      ]),
      ...(candidate.dialogueBeats ?? []).map(beat => `beat:${candidate.id}:${beat.id}`),
      ...(candidate.decisions ?? []).flatMap(decision => [
        `decision:${candidate.id}:${decision.id}`,
        ...decision.outcomes.map(outcome => `outcome:${candidate.id}:${decision.id}:${outcome.id}`),
      ]),
      ...(candidate.interactionUses ?? []).filter(use => !use.ownerNodeId).map(use => `interaction:${candidate.id}:${use.id}`),
      ...(candidate.interactionBarriers ?? []).map(barrier => `barrier:${candidate.id}:${barrier.id}`),
    ];
    return ids.includes(startNodeId);
  });
  const sequence = event && project.sequences.find(candidate => candidate.entryEventId === event.id || candidate.eventIds.includes(event.id));
  return sequence?.id ?? project.entrySequenceId ?? (project.sequences.length === 1 ? project.sequences[0].id : undefined);
}
function inventoryInstances(project: BranchingProject, instances: EntityInstance[] | undefined) {
  return (instances ?? []).filter(instance => entityCapabilities(project, instance.entityId).inventoryItem);
}
export function normalizeAuthoringEntities(project: BranchingProject): BranchingProject {
  const entrySequenceId = project.entrySequenceId ?? project.sequences[0]?.id;
  const normalized: BranchingProject = { ...project,
    sequences: project.sequences.map(sequence => sequence.initialInventory !== undefined || sequence.inheritInventoryFromSequenceId || sequence.id === entrySequenceId
      ? sequence : { ...sequence, initialInventory: [] }),
    ...(project.playerSimulation ? { playerSimulation: migrateLegacyInstances(project, project.playerSimulation) } : {}),
    ...(project.playerProfiles ? { playerProfiles: project.playerProfiles.map(p => ({ ...p, simulation: migrateLegacyInstances(project, p.simulation, p.id) })) } : {}),
  };
  if (project.authoringScenarios) normalized.authoringScenarios = project.authoringScenarios.map(scenario => {
    const scenarioProject = scenario.state?.entityInstances === undefined ? { ...project, entityInstances: [] } : project;
    const state = migrateLegacyInstances(scenarioProject, scenario.state ?? {}, scenario.profileId ?? 'default');
    const hasInventory = inventoryInstances(project, scenario.state?.entityInstances).length > 0 || (scenario.state?.inventory?.length ?? 0) > 0;
    return { ...scenario, state, ...(scenario.inventorySequenceId || !hasInventory ? {} : { inventorySequenceId: sequenceForStartingPoint(normalized, scenario.startNodeId) }) };
  });
  return normalized;
}
function startingInventory(project: BranchingProject, sequenceId: string | undefined, fallback: EntityInstance[], seen = new Set<string>()): EntityInstance[] {
  const sequence = project.sequences.find(candidate => candidate.id === sequenceId);
  if (!sequence) return inventoryInstances(project, fallback);
  if (seen.has(sequence.id)) return [];
  const nextSeen = new Set(seen).add(sequence.id);
  if (sequence.inheritInventoryFromSequenceId) return startingInventory(project, sequence.inheritInventoryFromSequenceId, fallback, nextSeen);
  if (sequence.initialInventory !== undefined) return structuredClone(sequence.initialInventory);
  return sequence.id === (project.entrySequenceId ?? project.sequences[0]?.id) ? inventoryInstances(project, fallback) : [];
}
export function initialAuthoringState(project: BranchingProject, scenario?: import('./domain.js').AuthoringScenario, startingSequenceId?: string): PlayerSimulationState {
  const profileId = scenario?.profileId ?? project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id ?? 'default';
  const profile = project.playerProfiles?.find(p => p.id === profileId);
  const base = profile?.simulation ?? (profileId === 'default' ? project.playerSimulation : undefined) ?? {};
  const sequenceId = startingSequenceId ?? sequenceForStartingPoint(project, scenario?.startNodeId);
  const baseState = migrateLegacyInstances(project, base, profileId);
  const scenarioProject = scenario?.state?.entityInstances === undefined ? { ...project, entityInstances: [] } : project;
  const scenarioState = scenario ? migrateLegacyInstances(scenarioProject, scenario.state ?? {}, scenario.profileId ?? profileId) : undefined;
  const scenarioHasInventory = Boolean(scenario?.inventorySequenceId || inventoryInstances(project, scenarioState?.entityInstances).length || scenario?.state?.inventory?.length);
  const scenarioInventorySequenceId = scenario?.inventorySequenceId ?? (scenarioHasInventory ? sequenceForStartingPoint(project, scenario?.startNodeId) : undefined);
  const selectedSequenceInventory = scenarioHasInventory && scenarioInventorySequenceId === sequenceId
    ? inventoryInstances(project, scenarioState?.entityInstances)
    : startingInventory(project, sequenceId, baseState.entityInstances ?? []);
  const stateInstancesById = new Map<string, EntityInstance>();
  for (const instance of [...(baseState.entityInstances ?? []), ...(scenarioState?.entityInstances ?? [])]) {
    if (!entityCapabilities(project, instance.entityId).inventoryItem) stateInstancesById.set(instance.id, structuredClone(instance));
  }
  for (const instance of selectedSequenceInventory) stateInstancesById.set(instance.id, structuredClone(instance));
  const mergeStates = <T extends { properties?: Record<string, unknown>; states?: Partial<Record<string, boolean>> }>(left: Record<string, T> | undefined, right: Record<string, T> | undefined) => {
    const merged = { ...left, ...right };
    for (const id of Object.keys(right ?? {})) merged[id] = { ...left?.[id], ...right![id], properties: { ...left?.[id]?.properties, ...right![id].properties }, states: { ...left?.[id]?.states, ...right![id].states } };
    return merged;
  };
  const variantStates = { ...base.entityVariantStates, ...scenario?.state?.entityVariantStates };
  for (const entityId of Object.keys(scenario?.state?.entityVariantStates ?? {})) variantStates[entityId] = mergeStates(base.entityVariantStates?.[entityId], scenario!.state!.entityVariantStates![entityId]);
  const state: PlayerSimulationState = {
    ...base, ...scenario?.state,
    variables: { ...Object.fromEntries((project.logicVariables ?? []).map(v => [v.id, v.value])), ...base.variables, ...scenario?.state?.variables },
    dataObjects: scenario?.state?.dataObjects ?? base.dataObjects ?? project.projectDataObjects,
    entityInstances: [...stateInstancesById.values()],
    entityStates: mergeStates(base.entityStates, scenario?.state?.entityStates),
    entityVariantStates: variantStates,
    context: { ...base.context, ...scenario?.state?.context, profileId, actor: scenario?.actor ?? scenario?.state?.context?.actor ?? base.context?.actor ?? (profile?.playableCharacterRef ? { kind: 'entity', entityId: profile.playableCharacterRef, ...(profile.playableVariantId ? { variantId: profile.playableVariantId } : {}) } : undefined) },
  };
  // Player v0.4 keyed some values by their display name. IDs are authoritative.
  for (const v of project.logicVariables ?? []) if (!(v.id in (scenario?.state?.variables ?? {})) && Object.prototype.hasOwnProperty.call(base.variables ?? {}, v.name)) state.variables![v.id] = base.variables![v.name];
  delete state.interactionResults;
  return structuredClone(migrateLegacyInstances(project, { ...state, inventory: [] }, profileId));
}
/** Removes saved values and capability metadata before a local property is deleted. */
export function removeLocalExplorerPropertyValues(
  project: BranchingProject,
  propertyId: string,
): BranchingProject {
  const withoutValue = <T extends Record<string, unknown>>(values: T | undefined): T | undefined => {
    if (!values || !Object.prototype.hasOwnProperty.call(values, propertyId)) return values;
    const next = { ...values };
    delete next[propertyId];
    return next;
  };
  const cleanInstances = (instances: EntityInstance[] | undefined) =>
    instances?.map(instance => ({
      ...instance,
      ...(instance.properties ? { properties: withoutValue(instance.properties) } : {}),
    }));
  const cleanState = (state: PlayerSimulationState | undefined) => {
    if (!state) return state;
    return {
      ...state,
      ...(state.entityInstances ? { entityInstances: cleanInstances(state.entityInstances) } : {}),
      ...(state.grantableProperties ? {
        grantableProperties: Object.fromEntries(
          Object.entries(state.grantableProperties).map(([entityId, values]) => [entityId, withoutValue(values)!]),
        ),
      } : {}),
      ...(state.entityStates ? {
        entityStates: Object.fromEntries(
          Object.entries(state.entityStates).map(([entityId, value]) => [entityId, {
            ...value,
            ...(value.properties ? { properties: withoutValue(value.properties) } : {}),
          }]),
        ),
      } : {}),
    };
  };

  return {
    ...project,
    ...(project.localExplorerEntities ? {
      localExplorerEntities: project.localExplorerEntities.map(entity => {
        const legacyFields = (entity as typeof entity & { fields?: Record<string, unknown> }).fields;
        return {
          ...entity,
          ...(entity.properties ? { properties: withoutValue(entity.properties) } : {}),
          ...(legacyFields ? { fields: withoutValue(legacyFields) } : {}),
        };
      }),
    } : {}),
    ...(project.logicPropertyOverrides ? {
      logicPropertyOverrides: project.logicPropertyOverrides.filter(override =>
        !(override.source === 'local' && override.propertyId === propertyId),
      ),
    } : {}),
    ...(project.entityOverrides ? {
      entityOverrides: project.entityOverrides.map(override => ({
        ...override,
        ...(override.properties ? { properties: withoutValue(override.properties) } : {}),
        ...(override.inventoryModifiers ? { inventoryModifiers: override.inventoryModifiers.filter(modifier => modifier.propertyId !== propertyId) } : {}),
      })),
    } : {}),
    ...(project.entityInstances ? { entityInstances: cleanInstances(project.entityInstances) } : {}),
    ...(project.playerSimulation ? { playerSimulation: cleanState(project.playerSimulation) } : {}),
    ...(project.playerProfiles ? {
      playerProfiles: project.playerProfiles.map(profile => ({
        ...profile,
        simulation: cleanState(profile.simulation)!,
      })),
    } : {}),
    ...(project.authoringScenarios ? {
      authoringScenarios: project.authoringScenarios.map(scenario => ({
        ...scenario,
        ...(scenario.state ? { state: cleanState(scenario.state) } : {}),
      })),
    } : {}),
  };
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
  visit({ events: project.events, sequences: project.sequences, branches: project.branches, scriptDocuments: project.scriptDocuments, localExplorerEntities: project.localExplorerEntities, localExplorerProperties: project.localExplorerProperties, entityOverrides: project.entityOverrides, logicTypeOverrides: project.logicTypeOverrides, logicPropertyOverrides: project.logicPropertyOverrides, entityInstances: project.entityInstances, narrativeActions: project.narrativeActions, narrativeRules: project.narrativeRules, authoringScenarios: project.authoringScenarios, playerProfiles: project.playerProfiles, playerSimulation: project.playerSimulation }, '');
  return found;
}

const REMOVED_ENTITY_REFERENCE = Symbol("removed-entity-reference");

function removeEntityReferenceValue(
  value: unknown,
  id: string,
  removedInstanceIds: ReadonlySet<string>,
): unknown | typeof REMOVED_ENTITY_REFERENCE {
  if (typeof value === "string" && (value === id || removedInstanceIds.has(value))) {
    return REMOVED_ENTITY_REFERENCE;
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      const cleaned = removeEntityReferenceValue(item, id, removedInstanceIds);
      return cleaned === REMOVED_ENTITY_REFERENCE ? [] : [cleaned];
    });
  }
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  // These objects point to an entity rather than defining an entity themselves.
  if (record.entityId === id) return REMOVED_ENTITY_REFERENCE;
  if (typeof record.instanceId === "string" && removedInstanceIds.has(record.instanceId)) {
    return REMOVED_ENTITY_REFERENCE;
  }
  if (
    typeof record.id === "string" &&
    removedInstanceIds.has(record.id) &&
    "entityId" in record
  ) {
    return REMOVED_ENTITY_REFERENCE;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    // `id` identifies this authored object; it is not a foreign-key reference.
    if (key === "id") {
      cleaned[key] = child;
      continue;
    }
    if (key === id || removedInstanceIds.has(key)) continue;

    const next = removeEntityReferenceValue(child, id, removedInstanceIds);
    if (next === REMOVED_ENTITY_REFERENCE) {
      // A predicate/effect cannot work without its subject or query.
      if (key === "subject" || key === "query") return REMOVED_ENTITY_REFERENCE;
      continue;
    }
    cleaned[key] = next;
  }
  return cleaned;
}

/** Removes references to a local entity before deleting its definition. */
export function removeLocalExplorerEntityReferences(
  project: BranchingProject,
  entityId: string,
): BranchingProject {
  const instanceCollections = [
    project.entityInstances ?? [],
    project.playerSimulation?.entityInstances ?? [],
    ...(project.playerProfiles ?? []).map(profile => profile.simulation.entityInstances ?? []),
    ...(project.authoringScenarios ?? []).map(scenario => scenario.state?.entityInstances ?? []),
  ];
  const removedInstanceIds = new Set(
    instanceCollections.flat()
      .filter(instance => instance.entityId === entityId)
      .map(instance => instance.id),
  );
  const references = {
    events: project.events,
    sequences: project.sequences,
    branches: project.branches,
    scriptDocuments: project.scriptDocuments,
    localExplorerEntities: project.localExplorerEntities,
    localExplorerProperties: project.localExplorerProperties,
    entityOverrides: project.entityOverrides,
    logicTypeOverrides: project.logicTypeOverrides,
    logicPropertyOverrides: project.logicPropertyOverrides,
    entityInstances: project.entityInstances,
    narrativeActions: project.narrativeActions,
    narrativeRules: project.narrativeRules,
    authoringScenarios: project.authoringScenarios,
    playerProfiles: project.playerProfiles,
    playerSimulation: project.playerSimulation,
  };
  const cleaned = removeEntityReferenceValue(references, entityId, removedInstanceIds) as typeof references;
  return {
    ...project,
    ...cleaned,
    localExplorerEntities: (cleaned.localExplorerEntities ?? []).filter(
      entity => entity.id !== entityId,
    ),
  };
}
