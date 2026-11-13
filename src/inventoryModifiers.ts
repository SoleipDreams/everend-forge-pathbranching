import type { BranchingProject, EntityInstance, EntityOwner, LogicSubject, PlayerSimulationState } from './domain.js';

export type InventoryModifierContribution = { instanceId: string; entityId: string; name: string; modifierId: string; amount: number };
type Subject = Extract<LogicSubject, { kind: 'entity' | 'instance' }>;

function concrete(subject: LogicSubject | undefined, state: PlayerSimulationState, seen = new Set<string>()): Subject | undefined {
  if (!subject) return undefined;
  if (subject.kind === 'entity') return { ...subject, variantId: subject.variantId ?? 'base' };
  if (subject.kind === 'instance') return subject;
  if (subject.kind !== 'context' || seen.has(subject.role)) return undefined;
  seen.add(subject.role);
  return concrete(state.context?.[subject.role], state, seen);
}
function sameSubject(left: Subject | undefined, right: Subject): boolean {
  return left?.kind === 'instance' ? right.kind === 'instance' && left.instanceId === right.instanceId
    : left?.kind === 'entity' && right.kind === 'entity' && left.entityId === right.entityId && (left.variantId ?? 'base') === (right.variantId ?? 'base');
}
function ownerSubject(project: Partial<BranchingProject>, state: PlayerSimulationState, owner: EntityOwner | undefined): Subject | undefined {
  if (!owner) return undefined;
  if (owner.kind === 'entity' || owner.kind === 'instance') return owner;
  if (owner.kind === 'context') return concrete(state.context?.[owner.role], state);
  const activeProfile = state.context?.profileId ?? project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id ?? 'default';
  if (owner.profileId === activeProfile && state.context?.actor) return concrete(state.context.actor, state);
  const profile = project.playerProfiles?.find(item => item.id === owner.profileId);
  return profile?.playableCharacterRef ? { kind: 'entity', entityId: profile.playableCharacterRef, variantId: profile.playableVariantId ?? 'base' } : undefined;
}

/** Follow containment without combining inventories of different character copies. */
function belongsTo(project: Partial<BranchingProject>, state: PlayerSimulationState, copies: EntityInstance[], copy: EntityInstance, subject: Subject): boolean {
  const seen = new Set([copy.id]);
  let owner = copy.owner;
  while (owner) {
    if (owner.kind === 'instance' && seen.has(owner.instanceId)) return false;
    if (sameSubject(ownerSubject(project, state, owner), subject)) return true;
    if (owner.kind !== 'instance' || seen.has(owner.instanceId)) return false;
    seen.add(owner.instanceId);
    owner = copies.find(item => item.id === (owner as Extract<EntityOwner, { kind: 'instance' }>).instanceId)?.owner;
  }
  return false;
}

export function inventoryPropertyModifiers(project: Partial<BranchingProject>, state: PlayerSimulationState, subject: Subject, propertyId: string): { modifiers: InventoryModifierContribution[]; error?: string } {
  const copies = [...(state.entityInstances ?? project.entityInstances ?? [])];
  // An explicit empty copy array means empty inventory, including after dropping the last item.
  if (state.entityInstances === undefined) for (const entityId of new Set(state.inventory ?? [])) {
    const profileId = state.context?.profileId ?? project.activePlayerProfileId ?? 'default';
    if (!copies.some(copy => copy.entityId === entityId && copy.owner?.kind === 'profile' && copy.owner.profileId === profileId)) copies.push({ id: `legacy:${entityId}`, entityId, owner: { kind: 'profile', profileId } });
  }
  const modifiers: InventoryModifierContribution[] = [], seen = new Set<string>();
  for (const copy of copies) {
    if (seen.has(copy.id)) return { modifiers: [], error: `Duplicate inventory copy ${copy.id}` };
    seen.add(copy.id);
    if (!belongsTo(project, state, copies, copy, subject)) continue;
    const canon = project.canonRefs?.find(item => item.id === copy.entityId), local = project.localExplorerEntities?.find(item => item.id === copy.entityId);
    if (!canon && !local) continue;
    const rules = project.entityOverrides?.find(item => item.entityId === copy.entityId)?.inventoryModifiers ?? [];
    if (!Array.isArray(rules)) return { modifiers: [], error: `Invalid inventory modifiers for ${copy.entityId}` };
    for (const modifier of rules) {
      if (!modifier) return { modifiers: [], error: `Invalid inventory modifier for ${copy.entityId}` };
      if (modifier.propertyId !== propertyId) continue;
      if (!Number.isFinite(modifier.amount) || !['carried', 'equipped'].includes(modifier.activation)) return { modifiers: [], error: `Invalid inventory modifier ${modifier.id}` };
      if (modifier.activation === 'equipped' && copy.states?.equipped !== true) continue;
      modifiers.push({ instanceId: copy.id, entityId: copy.entityId, name: copy.name ?? canon?.label ?? local?.name ?? copy.entityId, modifierId: modifier.id, amount: modifier.amount });
    }
  }
  return { modifiers };
}
