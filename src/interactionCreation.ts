import type { BranchingProject } from './domain.js';
import type { ConditionAuthoringContext } from './conditionAuthoring.js';
import { narrativeNodeReferences } from './authoringMutations.js';
import { effectiveConditions } from './conditionEvaluation.js';

export type InteractionCreationPlacement = { id: string; label: string; detail: string; eventId: string; ownerNodeId?: string; dialogueId?: string; afterNodeId?: string; beforeNodeId?: string };
/** Every offered placement executes before its guard; never attach to the option being guarded. */
export function interactionCreationPlacements(project: BranchingProject, context: ConditionAuthoringContext | undefined, eventId: string, es = true): InteractionCreationPlacement[] {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return [];
  const nodes = narrativeNodeReferences(project, eventId);
  const isEventGate = context?.eventId === eventId && (!context.nodeId || context.nodeId === eventId);
  const sequenceGate = project.sequences.find(item => item.id === context?.nodeId);
  const branchGate = project.branches.find(item => item.id === context?.nodeId);
  if (isEventGate || sequenceGate?.eventIds.includes(eventId) || branchGate?.eventIds.includes(eventId)) return [];
  const node = nodes.find(item => item.id === context?.nodeId || item.elementId === context?.nodeId);
  const decision = node?.kind === 'outcome' ? event.decisions?.find(item => item.id === node.decisionId) : undefined;
  const guardedRoute = context?.routeId ? event.transitions?.find(item => item.id === context.routeId) : undefined;
  const sourceNode = guardedRoute ? nodes.find(item => item.id === guardedRoute.from) : node;
  if (guardedRoute && !sourceNode) return [];
  if (decision && !effectiveConditions(decision)) return [{ id: 'decision-before', label: `${es ? 'Antes de' : 'Before'} ${decision.name}`, detail: es ? 'Resolver antes de evaluar las opciones.' : 'Resolve before evaluating choices.', eventId, ownerNodeId: `decision:${eventId}:${decision.id}`, dialogueId: decision.dialogueId }];
  const target = decision ? `decision:${eventId}:${decision.id}` : sourceNode?.id;
  const before = (event.transitions ?? []).filter(route => route.to === target && route.id !== guardedRoute?.id);
  if (before.length) return before.map(route => ({ id: route.id, label: `${es ? 'Antes de' : 'Before'} ${decision?.name ?? sourceNode?.label}`, detail: nodes.find(item => item.id === route.from)?.label ?? route.from, eventId, afterNodeId: route.from, beforeNodeId: route.to, ...(sourceNode?.kind !== 'dialogue' && context?.eventId === eventId ? { dialogueId: sourceNode?.dialogueId ?? context?.dialogueId } : {}) }));
  // A named conversation's availability is evaluated outside its canvas. Its gate cannot own this interaction.
  if (sourceNode?.kind === 'dialogue') return [];
  if (guardedRoute && sourceNode && sourceNode.kind !== 'outcome') {
    const owner = sourceNode.beat ?? (sourceNode.kind === 'decision' ? event.decisions?.find(item => item.id === sourceNode.elementId) : undefined);
    if (!owner || !effectiveConditions(owner)) return [{ id: 'source-before', label: `${es ? 'Antes de' : 'Before'} ${sourceNode.label}`, detail: es ? 'Resuelve antes de comprobar la ruta.' : 'Resolve before checking the route.', eventId, ownerNodeId: sourceNode.id, dialogueId: sourceNode.dialogueId }];
  }
  const dialogueId = sourceNode?.dialogueId ?? (context?.eventId === eventId ? context.dialogueId : undefined);
  return [{ id: 'event-start', label: `${es ? 'Entrada de' : 'Entry of'} ${dialogueId ? event.dialogues?.find(item => item.id === dialogueId)?.title ?? event.name : event.name}`, detail: es ? 'Nodo independiente antes del primer contenido.' : 'Independent node before the first content.', eventId, ...(dialogueId ? { dialogueId } : {}) }];
}

/** Merge a condition edit and its created interaction before recording one undo entry. */
export function mergeInteractionCreation(base: BranchingProject, created: BranchingProject, edited: BranchingProject): BranchingProject {
  const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const combine = (before: unknown, added: unknown, changed: unknown): unknown => {
    if (equal(before, changed)) return added;
    if (equal(before, added)) return changed;
    if (record(added) && record(changed)) {
      const old = record(before) ? before : {};
      return Object.fromEntries([...new Set([...Object.keys(added), ...Object.keys(changed)])]
        .map(key => [key, combine(old[key], added[key], changed[key])]));
    }
    if (Array.isArray(added) && Array.isArray(changed) && [...added, ...changed].every(value=>record(value) && typeof value.id === 'string')) {
      const old = Array.isArray(before) ? before : [];
      return added.map(value=>{
        const original=old.find(item=>item.id === value.id), update=changed.find(item=>item.id === value.id);
        return update ? combine(original,value,update) : old.some(item=>item.id===value.id) ? undefined : value;
      }).filter(Boolean).concat(changed.filter(value=>!added.some(item=>item.id===value.id) && !old.some(item=>item.id===value.id)));
    }
    return changed;
  };
  return combine(base, created, edited) as BranchingProject;
}
