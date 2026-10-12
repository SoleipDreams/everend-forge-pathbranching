import type { BranchingProject } from './domain.js';
import { addNarrativeResponse, connectNarrativeContinuation, endNarrativeContinuation, insertNarrativeBlock, narrativeNodeReferences } from './authoringMutations.js';
import { createNestedEvent, deleteTransition, updateDialogue, updateEvent, type MutationResult } from './projectMutations.js';
import type { ConversationContext } from './conversationModel.js';

/** An author-selected reading path. Never evaluate logic or alter execution data. */
export function narrativeReadingPath(project: BranchingProject, context: ConversationContext, selections: Record<string, string>) {
  const event = project.events.find(event => event.id === context.eventId);
  const refs = narrativeNodeReferences(project, context.eventId);
  const scope = refs.filter(ref => ref.dialogueId === context.dialogueId && ref.kind !== 'outcome');
  const byId = new Map(refs.map(ref => [ref.id, ref]));
  const nodes: typeof refs = [];
  const visited = new Set<string>();
  let stopped: { id: string; reason: 'cycle' | 'missing' | 'routes' | 'choice' | 'subevent'; destinations?: { id: string; label: string }[] } | undefined;
  const routes = (id: string) => (event?.transitions ?? []).filter(route => route.from === id).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  const next = (id: string): string | undefined => {
    const outgoing = routes(id);
    if (outgoing.length < 2) return outgoing[0]?.to;
    const selected = outgoing.find(route => route.id === selections[`route:${id}`]);
    if (selected) return selected.to;
    stopped = { id, reason: 'routes', destinations: outgoing.map(route => ({ id: route.id, label: byId.get(route.to)?.label ?? route.to })) };
    return undefined;
  };
  const prefix = context.dialogueId ? `dialogue-boundary:${context.eventId}:${context.dialogueId}:input` : `boundary:${context.eventId}:input:`;
  const entries = (event?.transitions ?? []).filter(route => route.from.startsWith(prefix));
  const entryBeat = context.dialogueId ? event?.dialogues?.find(dialogue => dialogue.id === context.dialogueId)?.entryBeatId : undefined;
  let id: string | undefined = entries[0]?.from ?? (entryBeat ? `beat:${context.eventId}:${entryBeat}` : scope.find(node => !(event?.transitions ?? []).some(route => route.to === node.id))?.id);
  while (id) {
    if (visited.has(id)) { stopped = { id, reason: 'cycle' }; break; }
    visited.add(id);
    const node = byId.get(id);
    if (node) {
      if (node.dialogueId !== context.dialogueId && node.kind !== 'outcome') break;
      if (node.kind !== 'outcome') nodes.push(node);
      if(node.kind==='dialogue') {
        const inside=narrativeReadingPath(project,{eventId:context.eventId,dialogueId:node.elementId},selections);
        if(inside.stopped){stopped=inside.stopped;break;}
      }
      if (node.kind === 'decision') {
        const decision = event?.decisions?.find(decision => decision.id === node.elementId);
        const option = decision?.outcomes.find(option => option.id === selections[node.id]);
        if (!option) { stopped = { id, reason: 'choice' }; break; }
        id = `outcome:${context.eventId}:${node.elementId}:${option.id}`;
        continue;
      }
    } else if(project.events.some(child=>child.id===id && (child.parentEventId===context.eventId || event?.childEventIds?.includes(child.id)))) {
      stopped={id,reason:'subevent'};break;
    } else if (!id.startsWith('boundary:') && !id.startsWith('dialogue-boundary:') && !id.startsWith('dialogue-start:') && !id.startsWith('route-gate:')) {
      stopped = { id, reason: 'missing' }; break;
    }
    id = next(id);
  }
  return { nodes, stopped };
}


/** Insert a decision and two choices atomically; preserve continuation on option A. */
export function insertReadingDecision(project: BranchingProject, context: ConversationContext, afterId?: string, beforeId?:string): MutationResult {
  const event=project.events.find(event=>event.id===context.eventId);
  if(!event)return {project,message:'Event not found.'};
  if(beforeId && !afterId) {
    const incoming=(event.transitions??[]).filter(route=>route.to===beforeId);
    if(incoming.length!==1)return {project,message:'Choose one incoming route in the canvas before inserting.'};
    afterId=incoming[0].from;
  }
  const scope=narrativeNodeReferences(project,context.eventId).filter(node=>node.dialogueId===context.dialogueId && node.kind!=='outcome');
  if(!afterId && scope.length)return {project,message:'Selecciona la línea o conversación después de la cual añadir la decisión.'};
  let result=insertNarrativeBlock(project,context.eventId,'decision',{dialogueId:context.dialogueId,afterNodeId:afterId,beforeNodeId:beforeId});
  if(result.project===project || result.selection?.type!=='node')return result;
  const node=narrativeNodeReferences(result.project,context.eventId).find(node=>node.id===result.selection!.id)!;
  for(let i=0;i<2;i++)result={...result,project:addNarrativeResponse(result.project,context.eventId,node.elementId).project};
  const nextEvent=result.project.events.find(event=>event.id===context.eventId)!;
  const decision=nextEvent.decisions!.find(decision=>decision.id===node.elementId)!;
  const first=`outcome:${context.eventId}:${decision.id}:${decision.outcomes[0].id}`;
  let next=updateEvent(result.project,context.eventId,{transitions:nextEvent.transitions?.map(route=>route.from===node.id?{...route,from:first}:route)}).project;
  // The input route becomes authoritative when a decision precedes the first beat.
  if(context.dialogueId && (!afterId || afterId===`dialogue-boundary:${context.eventId}:${context.dialogueId}:input`))next=updateDialogue(next,context.eventId,context.dialogueId,{entryBeatId:undefined}).project;
  return {...result,project:next};
}

export type ConversationContinuation = {kind:'dialogue'|'decision'|'subevent';id?:string};
export type ReadingContinuation = {kind:ConversationContinuation['kind']|'speech'|'direction';id?:string};

/** Use the same continuation operations for lines, selected options and containers. */
export function changeReadingContinuation(project:BranchingProject,eventId:string,source:string,dialogueId:string|undefined,target:ReadingContinuation):MutationResult {
  const event=project.events.find(event=>event.id===eventId);
  if(!event || !narrativeNodeReferences(project,eventId).some(ref=>ref.id===source))return {project,message:'Narrative source not found.'};
  const routes=event.transitions?.filter(route=>route.from===source)??[];
  if(routes.length>1)return {project,message:'Choose one continuation in the canvas before changing this transition.'};
  if(target.id) {
    const valid=target.kind==='subevent' ? !dialogueId && project.events.some(child=>child.id===target.id && (child.parentEventId===eventId || event.childEventIds?.includes(child.id))) : narrativeNodeReferences(project,eventId).some(ref=>ref.id===target.id && ref.id!==source && ref.kind===target.kind && ref.dialogueId===dialogueId);
    return valid ? connectNarrativeContinuation(project,eventId,source,target.id,routes[0]?.id) : {project,message:'This destination is not available in the narrative context.'};
  }
  if(target.kind==='decision')return insertReadingDecision(project,{eventId,dialogueId},source);
  if(target.kind==='subevent') {
    if(dialogueId)return {project,message:'Subevents belong to the parent event sequence.'};
    const created=createNestedEvent(project,eventId);
    if(created.selection?.type!=='node')return {project,message:created.message};
    const connected=connectNarrativeContinuation(created.project,eventId,source,created.selection.id,routes[0]?.id);
    return routes[0] ? {...connected,selection:created.selection,project:connectNarrativeContinuation(connected.project,eventId,created.selection.id,routes[0].to).project} : {...connected,selection:created.selection};
  }
  if(dialogueId && target.kind==='dialogue')return {project,message:'Choose a dialogue line inside this conversation.'};
  return insertNarrativeBlock(project,eventId,target.kind,{dialogueId,afterNodeId:source});
}

export function clearReadingContinuation(project:BranchingProject,eventId:string,source:string):MutationResult {
  const routes=project.events.find(event=>event.id===eventId)?.transitions?.filter(route=>route.from===source)??[];
  return routes.length===1 ? deleteTransition(project,routes[0].id) : {project,message:'Choose one continuation in the canvas before removing it.'};
}

/** Remove only the parent continuation; retain every narrative item and line. */
export function clearConversationContinuation(project:BranchingProject,eventId:string,dialogueId:string):MutationResult {
  const event=project.events.find(event=>event.id===eventId);
  const routes=event?.transitions?.filter(route=>route.from===`dialogue:${eventId}:${dialogueId}`)??[];
  if(routes.length!==1)return {project,message:'Choose one continuation in the canvas before removing it.'};
  return deleteTransition(project,routes[0].id);
}

/** Close the internal line path and connect the container in its parent's sequence. */
export function finishReadingConversation(project:BranchingProject,eventId:string,dialogueId:string,target:ReadingContinuation,selections:Record<string,string>={}):MutationResult {
  const event=project.events.find(event=>event.id===eventId);
  if(!event?.dialogues?.some(dialogue=>dialogue.id===dialogueId))return {project,message:'Conversation not found.'};
  const path=narrativeReadingPath(project,{eventId,dialogueId},selections);
  if(path.stopped)return {project,message:'Complete the selected conversation path before closing it.'};
  const source=`dialogue:${eventId}:${dialogueId}`;
  const outgoing=(event.transitions??[]).filter(route=>route.from===source);
  if(outgoing.length>1)return {project,message:'Choose one continuation in the canvas before changing the end.'};
  if(target.id) {
    const valid=target.kind==='subevent' ? project.events.some(child=>child.id===target.id && (child.parentEventId===eventId || event.childEventIds?.includes(child.id))) : narrativeNodeReferences(project,eventId).some(ref=>ref.id===target.id && ref.kind===target.kind && !ref.dialogueId && ref.id!==source);
    if(!valid)return {project,message:'This continuation is not available in the parent sequence.'};
  }
  let next=project;
  const last=path.nodes.at(-1);
  if(last) {
    const lastSource=last.kind==='decision' ? `outcome:${eventId}:${last.elementId}:${selections[last.id]}` : last.id;
    const routes=(event.transitions??[]).filter(route=>route.from===lastSource);
    if(routes.length>1)return {project,message:'This line has multiple continuations.'};
    const output=`dialogue-boundary:${eventId}:${dialogueId}:output`;
    if(routes[0]?.to!==output)next=endNarrativeContinuation(next,eventId,lastSource,dialogueId,routes[0]?.id).project;
  }
  if(target.id)return connectNarrativeContinuation(next,eventId,source,target.id,outgoing[0]?.id);
  if(target.kind==='decision')return insertReadingDecision(next,{eventId},source);
  if(target.kind!=='subevent')return insertNarrativeBlock(next,eventId,target.kind,{afterNodeId:source});
  const created=createNestedEvent(next,eventId);
  if(created.selection?.type!=='node')return {project,message:created.message};
  const connected=connectNarrativeContinuation(created.project,eventId,source,created.selection.id,outgoing[0]?.id);
  // Preserve the former parent continuation beyond the new subevent.
  if(outgoing[0])return {...connected,project:connectNarrativeContinuation(connected.project,eventId,created.selection.id,outgoing[0].to).project,selection:created.selection};
  return {...connected,selection:created.selection};
}
