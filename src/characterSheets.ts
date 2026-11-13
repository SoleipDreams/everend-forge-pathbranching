import type { BranchingProject, EntityOwner, LogicSubject, PlayerSimulationState } from './domain.js';
import type { ConditionAuthoringContext } from './conditionAuthoring.js';
import { canonVariantsForRef } from './worldnotionVariants.js';
import { propertyIsEntityPresentable } from './explorerSchema.js';

export type CharacterSheetEntry = { id: string; entityId: string; instanceId?: string; name: string; variantId: string; variantName: string; source: 'canon' | 'local'; context: string[]; contextual: boolean; subject: LogicSubject };

/** Matches the profile used to seed a new authoring run. */
export function defaultPlayerProfileId(project: BranchingProject): string {
  const active = project.activePlayerProfileId;
  if (active && (active === 'default' || project.playerProfiles?.some(profile => profile.id === active))) return active;
  return project.playerProfiles?.[0]?.id ?? 'default';
}

/** Scene membership is a catalog hint; opening a sheet never assigns the runtime actor. */
export function characterSheetEntries(project: BranchingProject, context: ConditionAuthoringContext = {}, state?: PlayerSimulationState): CharacterSheetEntry[] {
  const event = project.events.find(item => item.id === context.eventId);
  const dialogue = event?.dialogues?.find(item => item.id === context.dialogueId);
  const sequences = context.sequenceId ? project.sequences.filter(item => item.id === context.sequenceId) : project.sequences.filter(item => event && item.eventIds.includes(event.id));
  const details = new Map<string, Set<string>>();
  const variants = new Map<string, Set<string>>();
  const add = (id: string | undefined, detail: string, variantId?: string) => {
    if (!id) return;
    const labels = details.get(id) ?? new Set<string>(); labels.add(detail); details.set(id, labels);
    if (variantId) { const ids = variants.get(id) ?? new Set<string>(); ids.add(variantId); variants.set(id, ids); }
  };
  sequences.forEach(sequence => (sequence.characterRefs ?? (sequence.characterRef ? [sequence.characterRef] : [])).forEach(id => add(id, sequence.name)));
  (event?.presentEntityRefs ?? event?.canonRefs ?? []).forEach(id => add(id, event!.name));
  (dialogue?.presentEntityRefs ?? []).forEach(id => add(id, dialogue!.title));
  (context.contextEntityIds ?? []).forEach(id => add(id, dialogue?.title ?? event?.name ?? 'Contexto'));
  const beats = dialogue ? dialogue.beats ?? [] : [...(event?.dialogueBeats ?? []), ...(event?.dialogues ?? []).flatMap(item => item.beats ?? [])];
  beats.forEach(beat => { const block = project.scriptDocuments?.find(script => script.id === beat.blockRef.scriptId)?.blocks.find(item => item.id === beat.blockRef.blockId); add(block?.characterRef ?? block?.speakerRef, dialogue?.title ?? event?.name ?? 'Diálogo', block?.characterVariantId ?? 'base'); });
  if (dialogue?.speakerRef) add(dialogue.speakerRef, dialogue.title);
  const characters = [...project.canonRefs.map(item => ({ id: item.id, name: item.label ?? item.id, type: item.kind, source: 'canon' as const, ref: item })), ...(project.localExplorerEntities ?? []).map(item => ({ id: item.id, name: item.name, type: item.type, source: 'local' as const, ref: undefined }))]
    .filter(item => item.type === 'character' || Boolean(item.type && propertyIsEntityPresentable(project, item.source, `type:${item.type.replace(/^type:/, '')}`)) || variants.has(item.id));
  const output: CharacterSheetEntry[] = [];
  for (const character of characters) {
    const allVariants = character.ref ? canonVariantsForRef(character.ref) : [{ id: 'base', label: 'Base' }];
    for (const variant of allVariants) output.push({ id: JSON.stringify([character.id, variant.id]), entityId: character.id, name: character.name, variantId: variant.id, variantName: variant.label, source: character.source, context: [...(details.get(character.id) ?? [])], contextual: details.has(character.id) && (!variants.has(character.id) || variants.get(character.id)!.has(variant.id)), subject: { kind: 'entity', entityId: character.id, variantId: variant.id, source: character.source } });
    for (const instance of state?.entityInstances ?? project.entityInstances ?? []) if (instance.entityId === character.id) {
      const variantId = instance.variantId ?? 'base';
      output.push({ id: `instance:${instance.id}`, entityId: character.id, instanceId: instance.id, name: instance.name ?? character.name, variantId, variantName: allVariants.find(item => item.id === variantId)?.label ?? variantId, source: character.source, context: [...(details.get(character.id) ?? [])], contextual: details.has(character.id), subject: { kind: 'instance', instanceId: instance.id } });
    }
  }
  return output;
}

/** Every character sheet identity, including each canon variant, can own inventory copies. */
export function characterInventoryOwnerOptions(project: BranchingProject, locale: 'es' | 'en' = 'es', context: ConditionAuthoringContext = {}): { owner: Extract<EntityOwner, { kind: 'entity' }>; label: string; entityId: string; variantId: string; contextual: boolean; context: string[] }[] {
  return characterSheetEntries(project, context).filter(entry => entry.subject.kind === 'entity').map(entry => ({
    owner: { kind: 'entity' as const, entityId: entry.entityId, ...(entry.variantId !== 'base' ? { variantId: entry.variantId } : {}) },
    label: entry.variantId === 'base' ? entry.name : `${entry.name} · ${entry.variantName}`,
    entityId: entry.entityId,
    variantId: entry.variantId,
    contextual: entry.contextual,
    context: entry.context,
  })).sort((left, right) => Number(right.contextual) - Number(left.contextual) || left.label.localeCompare(right.label, locale));
}

export type CharacterStoryReferences = {
  entityIds: Set<string>;
  variantIds: Map<string, Set<string>>;
};

/** Collect character identities and explicitly referenced variants from the active story. */
export function characterStoryReferences(project: BranchingProject): CharacterStoryReferences {
  const knownEntities = new Set([
    ...project.canonRefs.map(ref => ref.id),
    ...(project.localExplorerEntities ?? []).map(entity => entity.id),
  ]);
  const entityIds = new Set<string>();
  const variantIds = new Map<string, Set<string>>();
  const addVariant = (entityId: string, variantId: unknown) => {
    if (!knownEntities.has(entityId)) return;
    entityIds.add(entityId);
    if (typeof variantId !== 'string' || !variantId) return;
    const variants = variantIds.get(entityId) ?? new Set<string>();
    variants.add(variantId);
    variantIds.set(entityId, variants);
  };
  const isReferenceField = (name: string) => /(?:Ref|Refs|entityId|entityIds)$/i.test(name);
  const visit = (value: unknown, field = '', depth = 0) => {
    if (depth > 60 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (knownEntities.has(value) && isReferenceField(field)) entityIds.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, field, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.kind === 'entity' && typeof record.entityId === 'string') {
      addVariant(record.entityId, record.variantId);
    }
    if (typeof record.characterRef === 'string' && knownEntities.has(record.characterRef)) {
      addVariant(record.characterRef, record.characterVariantId);
    }
    if (typeof record.speakerRef === 'string' && knownEntities.has(record.speakerRef)) {
      addVariant(record.speakerRef, record.speakerVariantId);
    }
    Object.entries(record).forEach(([key, child]) => visit(child, key, depth + 1));
  };

  [project.sequences, project.events, project.branches, project.scriptDocuments].forEach(section => visit(section));
  return { entityIds, variantIds };
}
