import type { BranchingProject, InteractionDefinition, InteractionUse, InteractionBarrier, InteractionMechanic } from './domain.js';
import { barrierNodeId, interactionNodeId } from './interactions.js';
import { updateEvent, createInternalTransition, type MutationResult } from './projectMutations.js';

export function defaultInteraction(kind: InteractionMechanic['kind'], id: string, variableId = ''): InteractionDefinition {
  const results = ['success', 'failure', ...(kind === 'qte' ? ['timeout'] : [])].map(key => ({ id: `${id}:${key}`, name: key, key: key as 'success' | 'failure' | 'timeout' }));
  return { id, name: kind, mechanic: kind === 'dice' ? { kind, count: 1, sides: 20, modifier: 0 }
    : kind === 'skillcheck' ? { kind, skill: { kind: 'variable', variableId }, difficulty: 10, modifier: 0, dice: { count: 1, sides: 20 } }
    : kind === 'qte' ? { kind, key: 'Space', durationMs: 3000 } : { kind, description: '' },
    results: kind === 'dice' ? [{ id: `${id}:low`, name: '1–9', range: { min: 1, max: 9 } }, { id: `${id}:high`, name: '10–20', range: { min: 10, max: 20 } }] : results };
}
export function updateInteraction(project: BranchingProject, eventId: string, id: string, patch: Partial<InteractionDefinition>): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  return event ? updateEvent(project, eventId, { interactionDefinitions: event.interactionDefinitions?.map(d => d.id === id ? { ...d, ...patch } : d) }).project : project;
}
export function updateInteractionUse(project: BranchingProject, eventId: string, id: string, patch: Partial<InteractionUse>): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  return event ? updateEvent(project, eventId, { interactionUses: event.interactionUses?.map(u => u.id === id ? { ...u, ...patch } : u) }).project : project;
}
export function updateInteractionBarrier(project: BranchingProject, eventId: string, id: string, patch: Partial<InteractionBarrier>): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  return event ? updateEvent(project, eventId, { interactionBarriers: event.interactionBarriers?.map(b => b.id === id ? { ...b, ...patch } : b) }).project : project;
}
export function interactionResultRoute(project: BranchingProject, eventId: string, useId: string, resultId: string) {
  return project.events.find(e => e.id === eventId)?.transitions?.find(t => {
    const when = t.logic?.when ?? t.conditions;
    return when && !Array.isArray(when) && 'type' in when && when.type === 'interactionResult' && when.useId === useId && when.resultId === resultId;
  });
}
export function setInteractionResultRoute(project: BranchingProject, eventId: string, useId: string, resultId: string, destination: string, sourceId?: string): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  const use = event?.interactionUses?.find(u => u.id === useId);
  if (!event || !use) throw new Error('Missing interaction use');
  const definition = event.interactionDefinitions?.find(d => d.id === use.definitionId);
  const result = definition?.results.find(r => r.id === resultId);
  if (!result) throw new Error('Missing interaction result');
  const existing = interactionResultRoute(project, eventId, useId, resultId);
  const barrier = event.interactionBarriers?.find(b => b.useIds.includes(useId));
  const from = sourceId ?? (use.moment === 'during' && use.ownerNodeId ? (barrier ? barrierNodeId(eventId, barrier.id) : undefined) : use.ownerNodeId ?? interactionNodeId(eventId, useId));
  if (destination && !from) throw new Error('Add a wait barrier before routing a concurrent result');
  const when = { type: 'interactionResult' as const, useId, resultId, operator: '==' as const };
  const transitions = (event.transitions ?? []).filter(t => t.id !== existing?.id).map(t => t.from === from && !t.conditions && !t.logic?.when ? { ...t, mode: 'fallback' as const, role: 'route' as const } : t);
  if (destination) transitions.push({ id: existing?.id ?? `interaction-route-${crypto.randomUUID()}`, from: from!, to: destination, label: result.name, order: definition!.results.indexOf(result), mode: 'conditional', role: 'route', source: 'graph', conditions: when, logic: { when } });
  return updateEvent(project, eventId, { transitions }).project;
}
function insert(project: BranchingProject, eventId: string, nodeId: string, afterNodeId?: string, beforeNodeId?: string): BranchingProject {
  const event = project.events.find(e => e.id === eventId)!;
  const source = afterNodeId ?? `boundary:${eventId}:input:entry`;
  const routes = (event.transitions ?? []).filter(t => t.from === source && (!beforeNodeId || t.to === beforeNodeId));
  if (routes.length > 1) throw new Error('Choose one connection before inserting an interaction or barrier');
  let next = updateEvent(project, eventId, { transitions: (event.transitions ?? []).map(t => routes.some(r => r.id === t.id) ? { ...t, to: nodeId } : t) }).project;
  if (!routes.length) next = createInternalTransition(next, eventId, source, nodeId).project;
  for (const route of routes) next = createInternalTransition(next, eventId, nodeId, route.to).project;
  return next;
}
export function addInteraction(project: BranchingProject, eventId: string, kind: InteractionMechanic['kind'], options: { ownerNodeId?: string; moment?: InteractionUse['moment']; dialogueId?: string; afterNodeId?: string; definitionId?: string } = {}): MutationResult {
  const event = project.events.find(e => e.id === eventId);
  if (!event) return { project, message: 'Event not found' };
  const id = `interaction-${crypto.randomUUID()}`;
  const definition = options.definitionId ? event.interactionDefinitions?.find(d => d.id === options.definitionId) : defaultInteraction(kind, `definition-${id}`, project.logicVariables?.find(v => v.type === 'number')?.id);
  if (!definition) return { project, message: 'Definition not found' };
  const use: InteractionUse = { id, definitionId: definition.id, moment: options.moment ?? 'before', ownerNodeId: options.ownerNodeId, dialogueId: options.dialogueId };
  let next = updateEvent(project, eventId, { interactionDefinitions: options.definitionId ? event.interactionDefinitions : [...(event.interactionDefinitions ?? []), definition], interactionUses: [...(event.interactionUses ?? []), use] }).project;
  if (!use.ownerNodeId) {
    const inputId = options.dialogueId ? `dialogue-boundary:${eventId}:${options.dialogueId}:input` : undefined;
    // Make a named dialogue entry explicit before inserting ahead of it.
    const entry = event.dialogues?.find(d => d.id === options.dialogueId)?.entryBeatId;
    if (inputId && entry && !options.afterNodeId && !event.transitions?.some(t => t.from === inputId)) next = createInternalTransition(next, eventId, inputId, `beat:${eventId}:${entry}`).project;
    next = insert(next, eventId, interactionNodeId(eventId, id), options.afterNodeId ?? inputId);
    if (inputId && !options.afterNodeId) next = updateEvent(next, eventId, { dialogues: next.events.find(e => e.id === eventId)?.dialogues?.map(d => d.id === options.dialogueId ? { ...d, entryBeatId: undefined } : d) }).project;
  }
  return { project: next, selection: { type: 'node', id: use.ownerNodeId ?? interactionNodeId(eventId, id) } };
}
export function addInteractionBarrier(project: BranchingProject, eventId: string, options: { afterNodeId?: string; beforeNodeId?: string; dialogueId?: string; useIds?: string[] } = {}): MutationResult {
  const event = project.events.find(e => e.id === eventId);
  if (!event) return { project, message: 'Event not found' };
  const id = `barrier-${crypto.randomUUID()}`;
  const barrier: InteractionBarrier = { id, name: 'Wait / Esperar', dialogueId: options.dialogueId, useIds: options.useIds ?? (event.interactionUses ?? []).filter(u => u.moment === 'during' && u.ownerNodeId).map(u => u.id) };
  const next = updateEvent(project, eventId, { interactionBarriers: [...(event.interactionBarriers ?? []), barrier] }).project;
  return { project: insert(next, eventId, barrierNodeId(eventId, id), options.afterNodeId ?? (options.dialogueId ? `dialogue-boundary:${eventId}:${options.dialogueId}:input` : undefined), options.beforeNodeId), selection: { type: 'node', id: barrierNodeId(eventId, id) } };
}
export function deleteInteractionUse(project: BranchingProject, eventId: string, useId: string): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  if (!event) return project;
  // References must be repaired explicitly; never destroy a branch with deletion.
  if (event.interactionBarriers?.some(b => b.useIds.includes(useId)) || JSON.stringify(project.events).includes(`"useId":"${useId}"`)) throw new Error('Resolve result conditions and barrier references before deleting this interaction');
  const nodeId = interactionNodeId(eventId, useId);
  if (event.transitions?.some(t => t.from === nodeId || t.to === nodeId)) throw new Error('Disconnect this interaction before deleting it');
  const use = event.interactionUses?.find(u => u.id === useId);
  const uses = event.interactionUses?.filter(u => u.id !== useId);
  return updateEvent(project, eventId, { interactionUses: uses, interactionDefinitions: event.interactionDefinitions?.filter(d => d.id !== use?.definitionId || uses?.some(u => u.definitionId === d.id)) }).project;
}
export function deleteInteractionBarrier(project: BranchingProject, eventId: string, barrierId: string): BranchingProject {
  const event = project.events.find(e => e.id === eventId);
  if (!event) return project;
  const nodeId = barrierNodeId(eventId, barrierId);
  const routes = event.transitions ?? [], outgoing = routes.filter(t => t.from === nodeId);
  if (project.events.some(e => e.boundaryBindings?.some(b => b.nodeId === nodeId)) || project.authoringScenarios?.some(s => s.startNodeId === nodeId)) throw new Error('Remove entry references before deleting this barrier');
  if (routes.some(t => t.to === nodeId) || outgoing.length) {
    const route = outgoing[0];
    if (outgoing.length !== 1 || route.to === nodeId || route.conditions || route.logic?.when || route.logic?.then?.length || route.logic?.narrativeEffects?.length || route.consequences?.length || route.function || route.arguments?.length) throw new Error('Disconnect branched or configured routes before deleting this barrier');
    // Preserve incoming guards and IDs. Removing a wait can produce validation
    // diagnostics until the author supplies another barrier.
    return updateEvent(project, eventId, { interactionBarriers: event.interactionBarriers?.filter(b => b.id !== barrierId), transitions: routes.filter(t => t.id !== route.id).map(t => t.to === nodeId ? { ...t, to: route.to } : t) }).project;
  }
  return updateEvent(project, eventId, { interactionBarriers: event.interactionBarriers?.filter(b => b.id !== barrierId) }).project;
}
/** Explicitly converts the old label; result routes are reviewed in the editor. */
export function convertLegacyInteractionDecision(project: BranchingProject, eventId: string, decisionId: string): MutationResult {
  const event = project.events.find(e => e.id === eventId);
  const decision = event?.decisions?.find(d => d.id === decisionId);
  if (!decision || !['dice', 'qte'].includes(decision.type)) return { project, message: 'Select a legacy dice/QTE decision' };
  const added = addInteraction(project, eventId, decision.type as 'dice' | 'qte', { ownerNodeId: `decision:${eventId}:${decisionId}`, moment: 'before' });
  return { ...added, project: updateEvent(added.project, eventId, { decisions: event!.decisions!.map(d => d.id === decisionId ? { ...d, type: 'dialogue' } : d) }).project };
}
