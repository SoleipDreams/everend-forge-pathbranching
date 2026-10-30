import type { BranchingProject, InteractionDefinition, InteractionUse, InteractionBarrier, InteractionMechanic } from './domain.js';
import { barrierNodeId, interactionNodeId } from './interactions.js';
import { updateEvent, createDialogueBeat, createEventDialogueBeat, createInternalTransition, pruneDanglingNarrativeMetadata, removeCanvasNodeReferences, type MutationResult } from './projectMutations.js';

export function defaultInteraction(kind: InteractionMechanic['kind'], id: string, variableId = ''): InteractionDefinition {
  const results = ['success', 'failure', ...(kind === 'qte' ? ['timeout'] : kind === 'opposedcheck' ? ['tie'] : [])].map(key => ({ id: `${id}:${key}`, name: key, key: key as 'success' | 'failure' | 'timeout' | 'tie' }));
  return { id, name: kind, mechanic: kind === 'dice' ? { kind, count: 1, sides: 20, modifier: 0 }
    : kind === 'skillcheck' ? { kind, actor: { kind: 'context', role: 'actor' }, skill: variableId ? { kind: 'variable', variableId } : undefined, difficulty: 10, difficultyOperator: '>=', modifier: 0, dice: { count: 1, sides: 20 } }
    : kind === 'opposedcheck' ? { kind, actor: { id: 'actor', subject: { kind: 'context', role: 'actor' }, modifier: 0 }, rivals: [], aggregation: 'all', commonDice: { count: 1, sides: 20 } }
    : kind === 'qte' ? { kind, key: 'Space', durationMs: 3000 } : { kind, description: '' },
    results: kind === 'dice' ? [{ id: `${id}:low`, name: '1–9', range: { min: 1, max: 9 } }, { id: `${id}:high`, name: '10–20', range: { min: 10, max: 20 } }] : results };
}
export function convertSkillCheck(mechanic: Extract<InteractionMechanic,{kind:'skillcheck'|'opposedcheck'}>, kind:'skillcheck'|'opposedcheck'): InteractionMechanic {
  if(mechanic.kind===kind)return mechanic;
  if(mechanic.kind==='skillcheck')return {kind:'opposedcheck',actor:{id:'actor',subject:mechanic.actor??(mechanic.skill?.kind==='property'?mechanic.skill.subject:{kind:'context',role:'actor'}),skill:mechanic.skill,modifier:mechanic.modifier,modifierRules:mechanic.modifierRules},rivals:[],aggregation:'all',commonDice:mechanic.dice,commonDicePresetId:mechanic.dicePresetId};
  return {kind:'skillcheck',actor:mechanic.actor.subject,skill:mechanic.actor.skill,dice:mechanic.actor.dice??mechanic.commonDice,dicePresetId:mechanic.actor.dicePresetId??mechanic.commonDicePresetId,modifier:mechanic.actor.modifier,modifierRules:mechanic.actor.modifierRules,difficulty:10,difficultyOperator:'>='};
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
  const transitions = (event.transitions ?? []).filter(t => t.id !== existing?.id);
  if (destination) transitions.push({ id: existing?.id ?? `interaction-route-${crypto.randomUUID()}`, from: from!, to: destination, label: result.name, order: definition!.results.indexOf(result), mode: 'conditional', role: 'route', source: 'graph', conditions: when, logic: { when } });
  return updateEvent(project, eventId, { transitions }).project;
}
/** Create a blank speech continuation in the interaction's narrative scope and route this result to it. */
export function createInteractionResultContinuation(project: BranchingProject, eventId: string, useId: string, resultId: string): BranchingProject {
  const event = project.events.find(item => item.id === eventId), use = event?.interactionUses?.find(item => item.id === useId);
  if (!event || !use) throw new Error('Missing interaction use');
  const created = use.dialogueId
    ? createDialogueBeat(project, eventId, use.dialogueId, 'speech', undefined, false)
    : createEventDialogueBeat(project, eventId, 'speech');
  if (created.selection?.type !== 'node') throw new Error(created.message ?? 'Could not create the continuation.');
  return setInteractionResultRoute(created.project, eventId, useId, resultId, created.selection.id);
}
function insert(project: BranchingProject, eventId: string, nodeId: string, afterNodeId?: string, beforeNodeId?: string, preserveOutgoingRoutesAfterNode = false): BranchingProject {
  const event = project.events.find(e => e.id === eventId)!;
  const source = afterNodeId ?? `boundary:${eventId}:input:entry`;
  const routes = (event.transitions ?? []).filter(t => t.from === source && (!beforeNodeId || t.to === beforeNodeId));
  if (preserveOutgoingRoutesAfterNode) {
    return updateEvent(project, eventId, { transitions: [
      ...(event.transitions ?? []).map(t => routes.some(r => r.id === t.id) ? { ...t, from: nodeId } : t),
      { id: `interaction-insert-${crypto.randomUUID()}`, from: source, to: nodeId, order: 0, mode: 'conditional', role: 'flow', source: 'graph' },
    ] }).project;
  }
  if (routes.length > 1) throw new Error('Choose one connection before inserting an interaction or barrier');
  let next = updateEvent(project, eventId, { transitions: (event.transitions ?? []).map(t => routes.some(r => r.id === t.id) ? { ...t, to: nodeId } : t) }).project;
  if (!routes.length) next = createInternalTransition(next, eventId, source, nodeId).project;
  for (const route of routes) next = createInternalTransition(next, eventId, nodeId, route.to).project;
  return next;
}
export function addInteraction(project: BranchingProject, eventId: string, kind: InteractionMechanic['kind'], options: { ownerNodeId?: string; moment?: InteractionUse['moment']; dialogueId?: string; afterNodeId?: string; beforeNodeId?: string; definitionId?: string; pendingMechanic?: boolean } = {}): MutationResult {
  const event = project.events.find(e => e.id === eventId);
  if (!event) return { project, message: 'Event not found' };
  const contextNodeId = options.afterNodeId ?? options.ownerNodeId;
  const decision = contextNodeId ? event.decisions?.find(item =>
    `decision:${eventId}:${item.id}` === contextNodeId || item.outcomes.some(outcome => `outcome:${eventId}:${item.id}:${outcome.id}` === contextNodeId),
  ) : undefined;
  if (decision) {
    const outcomeNodeIds = new Set(decision.outcomes.map(outcome => `outcome:${eventId}:${decision.id}:${outcome.id}`));
    const decisionNodeId = `decision:${eventId}:${decision.id}`;
    const routerSources = new Set([...outcomeNodeIds].filter(sourceId => (event.transitions ?? []).filter(transition => transition.from === sourceId).length > 1));
    const configuringRouterBranch = Boolean(options.ownerNodeId && routerSources.has(options.ownerNodeId));
    const requestedOutcomeNodeId = [options.afterNodeId, options.ownerNodeId].find(id => id && outcomeNodeIds.has(id));
    if (requestedOutcomeNodeId) {
      // Inserting after an option makes the interaction common to its outgoing
      // routes; ownerNodeId instead represents an interaction on a router branch.
      if (routerSources.has(requestedOutcomeNodeId) && !configuringRouterBranch && !options.afterNodeId) return { project, message: 'This option has a router. Configure its interactions from the router branches.' };
      const alreadyHasOptionInteraction = (event.interactionUses ?? []).some(use =>
        use.ownerNodeId === requestedOutcomeNodeId || (event.transitions ?? []).some(transition => transition.from === requestedOutcomeNodeId && transition.to === interactionNodeId(eventId, use.id)),
      );
      if (!configuringRouterBranch && alreadyHasOptionInteraction) return { project, message: 'This option already has an interaction.' };
    } else if (!configuringRouterBranch) {
      const alreadyHasDecisionInteraction = (event.interactionUses ?? []).some(use =>
        use.ownerNodeId === decisionNodeId || (event.transitions ?? []).some(transition => transition.from === decisionNodeId && transition.to === interactionNodeId(eventId, use.id)),
      );
      if (routerSources.size) return { project, message: 'This decision has a router. Configure its interactions from the router branches.' };
      if (alreadyHasDecisionInteraction) return { project, message: 'This decision already has an interaction.' };
    }
  }
  const id = `interaction-${crypto.randomUUID()}`;
  const definition = options.definitionId ? event.interactionDefinitions?.find(d => d.id === options.definitionId) : defaultInteraction(kind, `definition-${id}`, project.logicVariables?.find(v => v.type === 'number')?.id);
  if (!definition) return { project, message: 'Definition not found' };
  if (options.pendingMechanic && !options.definitionId) { definition.mechanicPending = true; definition.name = 'Interacción'; definition.results = []; }
  const use: InteractionUse = { id, definitionId: definition.id, moment: options.moment ?? 'before', ownerNodeId: options.ownerNodeId, dialogueId: options.dialogueId };
  let next = updateEvent(project, eventId, { interactionDefinitions: options.definitionId ? event.interactionDefinitions : [...(event.interactionDefinitions ?? []), definition], interactionUses: [...(event.interactionUses ?? []), use] }).project;
  if (!use.ownerNodeId) {
    const inputId = options.dialogueId ? `dialogue-boundary:${eventId}:${options.dialogueId}:input` : undefined;
    // Make a named dialogue entry explicit before inserting ahead of it.
    const entry = event.dialogues?.find(d => d.id === options.dialogueId)?.entryBeatId;
    if (inputId && entry && !options.afterNodeId && !event.transitions?.some(t => t.from === inputId)) next = createInternalTransition(next, eventId, inputId, `beat:${eventId}:${entry}`).project;
    next = insert(next, eventId, interactionNodeId(eventId, id), options.afterNodeId ?? inputId, options.beforeNodeId, Boolean(options.afterNodeId?.startsWith('outcome:')));
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
  const use = event.interactionUses?.find(u => u.id === useId);
  if (!use) return project;
  const nodeId = interactionNodeId(eventId, useId);
  const emptiedBarrierIds = new Set((event.interactionBarriers ?? [])
    .filter(barrier => barrier.useIds.includes(useId) && barrier.useIds.every(id => id === useId))
    .map(barrier => barrier.id));
  const removedNodeIds = new Set<string>();
  if (!use.ownerNodeId) removedNodeIds.add(nodeId);
  for (const id of emptiedBarrierIds) removedNodeIds.add(barrierNodeId(eventId, id));

  let next: BranchingProject = {
    ...project,
    events: project.events.map(item => {
      let transitions = (item.transitions ?? []).filter(transition => !referencesInteractionUse(transition, useId));
      if (item.id === eventId) {
        if (!use.ownerNodeId) transitions = removeNodeConnections(transitions, nodeId);
        for (const barrierId of emptiedBarrierIds) transitions = removeNodeConnections(transitions, barrierNodeId(eventId, barrierId));
        const uses = (item.interactionUses ?? []).filter(candidate => candidate.id !== useId);
        return {
          ...item,
          interactionUses: uses,
          interactionDefinitions: item.interactionDefinitions?.filter(definition => definition.id !== use.definitionId || uses.some(candidate => candidate.definitionId === definition.id)),
          interactionBarriers: (item.interactionBarriers ?? [])
            .filter(barrier => !emptiedBarrierIds.has(barrier.id))
            .map(barrier => ({ ...barrier, useIds: barrier.useIds.filter(id => id !== useId) })),
          transitions,
          boundaryBindings: item.boundaryBindings?.filter(binding => !removedNodeIds.has(binding.nodeId)),
        };
      }
      return { ...item, transitions };
    }),
  };
  next = removeCanvasNodeReferences(next, removedNodeIds);
  return pruneDanglingNarrativeMetadata(next);
}

function referencesInteractionUse(value: unknown, useId: string): boolean {
  if (Array.isArray(value)) return value.some(item => referencesInteractionUse(item, useId));
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (item.type === 'interactionResult' && item.useId === useId) return true;
  return Object.values(item).some(child => referencesInteractionUse(child, useId));
}

function removeNodeConnections(transitions: NonNullable<BranchingProject['events'][number]['transitions']>, nodeId: string) {
  const outgoing = transitions.filter(transition => transition.from === nodeId && transition.to !== nodeId);
  const continuation = outgoing.length === 1 && isTransparentContinuation(outgoing[0]) ? outgoing[0].to : undefined;
  return transitions.flatMap(transition => {
    if (transition.from === nodeId || transition.to === nodeId) {
      return continuation && transition.to === nodeId && transition.from !== nodeId
        ? [{ ...transition, to: continuation }]
        : [];
    }
    return [transition];
  });
}

function isTransparentContinuation(transition: NonNullable<BranchingProject['events'][number]['transitions']>[number]) {
  return !transition.conditions && !transition.logic && !transition.consequences?.length &&
    !transition.function && !transition.arguments?.length && !transition.label;
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
