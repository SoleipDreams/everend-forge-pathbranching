import type { BranchingProject, Consequence, DialogueBeat, InstanceEffect, NarrativeEffect, ScriptBlock, Transition } from "./domain.js";
import { createDecision, createDialogue, createDialogueBeat, createEventDialogueBeat, createInternalTransition, createOutcome, updateDecision, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateOutcome, updateScriptBlock, updateTransition, type MutationResult } from "./projectMutations.js";
import { splitNarrativeEffects } from "./logic.js";
import { scriptBlockTextKey, updateLocalizedEntry } from "./localization.js";

export type NarrativeBlockKind = "speech" | "direction" | "decision" | "dialogue";
export type NarrativeNodeReference = { id: string; elementId: string; kind: NarrativeBlockKind | "outcome"; label: string; dialogueId?: string; decisionId?: string; beat?: DialogueBeat; block?: ScriptBlock };
export type NarrativeInsertOptions = { dialogueId?: string; afterNodeId?: string; beforeNodeId?: string; speakerRef?: string; asAlternative?: boolean };

export function authoringNodeOptions(project: BranchingProject, eventId?: string) {
  return project.events.filter(event => !eventId || event.id === eventId).flatMap(event => [
    { id: event.id, label: event.name, eventId: event.id, dialogueId: undefined as string | undefined, kind: "event" as string },
    ...narrativeNodeReferences(project, event.id).map(node => ({ id: node.id, label: node.label, eventId: event.id, dialogueId: node.kind === "dialogue" ? node.elementId : node.dialogueId, kind: node.kind as string })),
  ]);
}

/** These are document IDs, including their canvas-compatible wrappers, never ReactFlow edges. */
export function narrativeNodeReferences(project: BranchingProject, eventId: string): NarrativeNodeReference[] {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return [];
  const references: NarrativeNodeReference[] = [];
  const addBeat = (beat: DialogueBeat, dialogueId?: string) => {
    const block = project.scriptDocuments?.find(script => script.id === beat.blockRef.scriptId)?.blocks.find(item => item.id === beat.blockRef.blockId);
    references.push({ id: `beat:${eventId}:${beat.id}`, elementId: beat.id, kind: beat.kind, label: block ? block.content.trim().slice(0, 80) || (beat.kind === "speech" ? "Speech" : "Direction") : beat.id, dialogueId, beat, block });
  };
  (event.dialogueBeats ?? []).forEach(beat => addBeat(beat));
  (event.dialogues ?? []).forEach(dialogue => {
    references.push({ id: `dialogue:${eventId}:${dialogue.id}`, elementId: dialogue.id, kind: "dialogue", label: dialogue.title });
    (dialogue.beats ?? []).forEach(beat => addBeat(beat, dialogue.id));
  });
  (event.decisions ?? []).forEach(decision => {
    references.push({ id: `decision:${eventId}:${decision.id}`, elementId: decision.id, kind: "decision", label: decision.name, dialogueId: decision.dialogueId });
    decision.outcomes.forEach(outcome => references.push({ id: `outcome:${eventId}:${decision.id}:${outcome.id}`, elementId: outcome.id, kind: "outcome", label: outcome.visibleText || outcome.name, dialogueId: decision.dialogueId, decisionId: decision.id }));
  });
  return references;
}

export function narrativeConnections(project: BranchingProject, eventId: string, nodeId: string) {
  const event = project.events.find(item => item.id === eventId);
  return {
    incoming: (event?.transitions ?? []).filter(route => route.to === nodeId),
    outgoing: (event?.transitions ?? []).filter(route => route.from === nodeId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  };
}

/** Present graph order without duplicating a destination shared by several answers. */
export function narrativeScopeNodes(project: BranchingProject, eventId: string, dialogueId?: string) {
  const event = project.events.find(item => item.id === eventId);
  const all = narrativeNodeReferences(project, eventId);
  const scope = all.filter(node => node.dialogueId === dialogueId && node.kind !== "outcome");
  const byId = new Map(scope.map(node => [node.id, node]));
  const visited = new Set<string>();
  const ordered: NarrativeNodeReference[] = [];
  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    if (node?.kind === "decision") {
      event?.decisions?.find(decision => decision.id === node.elementId)?.outcomes.forEach(outcome => walk(`outcome:${eventId}:${node.elementId}:${outcome.id}`));
    }
    narrativeConnections(project, eventId, id).outgoing.forEach(route => walk(route.to));
  };
  const inputPrefix = dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:input` : `boundary:${eventId}:input:`;
  (event?.transitions ?? []).filter(route => route.from.startsWith(inputPrefix)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(route => walk(route.to));
  if (dialogueId) {
    const beatId = event?.dialogues?.find(dialogue => dialogue.id === dialogueId)?.entryBeatId;
    if (beatId) walk(`beat:${eventId}:${beatId}`);
  }
  scope.forEach(node => walk(node.id));
  return ordered;
}

function entryId(eventId: string, dialogueId?: string) {
  return dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:input` : `boundary:${eventId}:input:entry`;
}

/** Insert atomically; keep the incoming route's ID, conditions and effects before the new block. */
export function insertNarrativeBlock(project: BranchingProject, eventId: string, kind: NarrativeBlockKind, options: NarrativeInsertOptions = {}): MutationResult {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return { project, message: "Event not found." };
  const scopeNodes = narrativeScopeNodes(project, eventId, options.dialogueId);
  const sourceId = options.afterNodeId ?? (scopeNodes.length === 0 ? entryId(eventId, options.dialogueId) : undefined);
  const previousRoutes = options.asAlternative ? [] : (event.transitions ?? []).filter(route => route.from === sourceId && (!options.beforeNodeId || route.to === options.beforeNodeId));
  if (previousRoutes.length > 1 && !options.beforeNodeId) return { project, message: "Choose the route to insert into; this block has several continuations." };
  const result = kind === "dialogue" ? createDialogue(project, eventId)
    : kind === "decision" ? createDecision(project, eventId, options.dialogueId)
    : options.dialogueId ? createDialogueBeat(project, eventId, options.dialogueId, kind, options.speakerRef ? { characterRef: options.speakerRef } : undefined, !options.afterNodeId)
    : createEventDialogueBeat(project, eventId, kind, options.speakerRef ? { characterRef: options.speakerRef } : undefined);
  if (!result.selection || result.selection.type !== "node") return result;
  const nodeId = result.selection.id;
  let next = result.project;
  if (sourceId) {
    next = updateEvent(next, eventId, {
      transitions: (next.events.find(item => item.id === eventId)?.transitions ?? []).map(route => previousRoutes.some(previous => previous.id === route.id) ? { ...route, to: nodeId } : route),
    }).project;
    if (previousRoutes.length === 0) next = createInternalTransition(next, eventId, sourceId, nodeId).project;
    previousRoutes.forEach(route => { next = createInternalTransition(next, eventId, nodeId, route.to).project; });
    if (options.beforeNodeId && previousRoutes.length === 0) next = createInternalTransition(next, eventId, nodeId, options.beforeNodeId).project;
    if (options.dialogueId && sourceId === entryId(eventId, options.dialogueId) && (kind === "speech" || kind === "direction")) {
      const createdBeat = narrativeNodeReferences(next, eventId).find(node => node.id === nodeId)?.elementId;
      next = updateDialogue(next, eventId, options.dialogueId, { entryBeatId: createdBeat }).project;
    }
  }
  return { ...result, project: next };
}

export function addNarrativeResponse(project: BranchingProject, eventId: string, decisionId: string): MutationResult {
  const result = createOutcome(project, eventId, decisionId);
  const outcome = result.project.events.find(event => event.id === eventId)?.decisions?.find(decision => decision.id === decisionId)?.outcomes.at(-1);
  return outcome ? { ...result, selection: { type: "node", id: `outcome:${eventId}:${decisionId}:${outcome.id}` } } : result;
}

/** Replace one explicitly selected continuation; other conditional paths remain intact. */
export function connectNarrativeContinuation(project: BranchingProject, eventId: string, from: string, to: string, routeId?: string): MutationResult {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return { project, message: "Event not found." };
  if (routeId) {
    const route = event.transitions?.find(item => item.id === routeId && item.from === from);
    if (!route) return { project, message: "Route not found." };
    return updateTransition(project, routeId, { to });
  }
  return createInternalTransition(project, eventId, from, to);
}

export function endNarrativeContinuation(project: BranchingProject, eventId: string, from: string, dialogueId?: string, routeId?: string): MutationResult {
  const outputId = dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:output` : `boundary:${eventId}:output:exit`;
  const next = dialogueId ? project : {
    ...project,
    canvas: { ...project.canvas, scopes: { ...project.canvas?.scopes, [`event:${eventId}`]: { ...project.canvas?.scopes?.[`event:${eventId}`], exitSlots: [...new Set([...(project.canvas?.scopes?.[`event:${eventId}`]?.exitSlots ?? []), "exit"])] } } },
  };
  return connectNarrativeContinuation(next, eventId, from, outputId, routeId);
}

export function updateNarrativeText(project: BranchingProject, eventId: string, beatId: string, text: string, locale?: string): BranchingProject {
  const node = narrativeNodeReferences(project, eventId).find(item => item.elementId === beatId && item.beat);
  if (!node?.beat || !node.block) return project;
  const primaryLocale = project.localizationCatalog?.primaryLocale ?? "und";
  const textKey = node.block.textKey ?? scriptBlockTextKey(node.beat.blockRef.scriptId, node.block.id);
  return updateLocalizedEntry(project, textKey, locale ?? primaryLocale, text, primaryLocale);
}

export function updateNarrativeSpeaker(project: BranchingProject, eventId: string, beatId: string, speakerRef: string | undefined): BranchingProject {
  const node = narrativeNodeReferences(project, eventId).find(item => item.elementId === beatId && item.beat);
  return node?.beat ? updateScriptBlock(project, node.beat.blockRef.scriptId, node.beat.blockRef.blockId, { characterRef: speakerRef, characterVariantId: undefined }).project : project;
}

export function updateNarrativeRoute(project: BranchingProject, eventId: string, routeId: string, updates: Partial<Transition>): BranchingProject {
  const event = project.events.find(item => item.id === eventId);
  return event?.transitions?.some(route => route.id === routeId) ? updateTransition(project, routeId, updates).project : project;
}


export function setNarrativeNodeEffects(project: BranchingProject, eventId: string, nodeId: string, effects: NarrativeEffect[]): BranchingProject {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return project;
  const split = splitNarrativeEffects(effects);
  if (nodeId === eventId) return updateEvent(project, eventId, { consequences: split.then, logic: { ...event.logic, ...split } }).project;
  const node = narrativeNodeReferences(project, eventId).find(item => item.id === nodeId);
  if (!node) return project;
  if (node.kind === "dialogue") {
    const dialogue = event.dialogues?.find(item => item.id === node.elementId);
    return updateDialogue(project, eventId, node.elementId, { consequences: split.then, logic: { ...dialogue?.logic, ...split } }).project;
  }
  if (node.beat) {
    const updates = { consequences: split.then, logic: { ...node.beat.logic, ...split } };
    return node.dialogueId ? updateDialogueBeat(project, eventId, node.dialogueId, node.elementId, updates).project : updateEventDialogueBeat(project, eventId, node.elementId, updates).project;
  }
  const decisionId = node.kind === "decision" ? node.elementId : node.decisionId;
  const decision = event.decisions?.find(item => item.id === decisionId);
  if (!decision) return project;
  if (node.kind === "decision") return updateDecision(project, eventId, decision.id, { logic: { ...decision.logic, ...split } }).project;
  const outcome = decision.outcomes.find(item => item.id === node.elementId);
  return updateOutcome(project, eventId, decision.id, node.elementId, { consequences: split.then, logic: { ...outcome?.logic, ...split } }).project;
}

export function setNarrativeRouteEffects(project: BranchingProject, eventId: string, routeId: string, effects: NarrativeEffect[]): BranchingProject {
  const route = project.events.find(item => item.id === eventId)?.transitions?.find(item => item.id === routeId);
  if (!route) return project;
  const split = splitNarrativeEffects(effects);
  return updateTransition(project, routeId, { role: "route", consequences: split.then, logic: { ...route.logic, ...split } }).project;
}
