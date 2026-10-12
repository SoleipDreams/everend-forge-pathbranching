import type { BranchingProject, DialogueBeat, DialogueMemberRef, ScriptBlock, Transition } from './domain.js';
import { insertNarrativeBlock, narrativeNodeReferences, narrativeScopeNodes, updateNarrativeText, type NarrativeNodeReference } from './authoringMutations.js';
import { createInternalTransition, updateDialogue, updateDialogueBeat, updateEvent, updateEventDialogueBeat, updateScriptBlock, type MutationResult } from './projectMutations.js';
import { scriptBlockTextKey, updateLocalizedEntry } from './localization.js';
import { createLocalExplorerEntity } from './explorerEntities.js';
import { isGenericSpeakerRef } from './speakerRoles.js';
import { locationEntities } from './explorerSchema.js';

export type ConversationContext = { eventId: string; dialogueId?: string; legacyEventContextFallback?: boolean };
/** Inspector groups retain the real owner; no flattened execution sequence. */
export function conversationGroups(project: BranchingProject, eventId: string) {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return [];
  return [
    { id: event.id, title: event.name, context: { eventId } as ConversationContext, own: true, count: event.dialogueBeats?.length ?? 0 },
    ...(event.dialogues ?? []).map(dialogue => ({ id: `dialogue:${eventId}:${dialogue.id}`, title: dialogue.title, context: { eventId, dialogueId: dialogue.id } as ConversationContext, own: false, count: dialogue.beats?.length ?? 0 })),
  ];
}
export type ConversationRestriction = 'branch' | 'cycle' | 'route-logic' | 'external-entry' | 'missing-block';
export type ConversationRow = NarrativeNodeReference & {
  beat: DialogueBeat; sharedUses: number; segmentId?: string; restrictions: ConversationRestriction[];
  canMoveUp: boolean; canMoveDown: boolean; canDelete: boolean; canInsertAfter: boolean;
};
export type ConversationSegment = { id: string; nodeIds: string[]; incoming?: Transition; outgoing?: Transition };
const nodeId = (event: string, beat: string) => `beat:${event}:${beat}`;
const entryId = ({ eventId, dialogueId }: ConversationContext) => dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:input` : `boundary:${eventId}:input:entry`;
const outputId = ({ eventId, dialogueId }: ConversationContext) => dialogueId ? `dialogue-boundary:${eventId}:${dialogueId}:output` : `boundary:${eventId}:output:exit`;
const owned = (project: BranchingProject, context: ConversationContext) => {
  const event = project.events.find(item => item.id === context.eventId);
  const dialogue = context.dialogueId ? event?.dialogues?.find(item => item.id === context.dialogueId) : undefined;
  return { event, dialogue };
};
const fail = (project: BranchingProject, message: string): MutationResult => ({ project, message });
const usesOf = (project: BranchingProject, ref: DialogueBeat['blockRef']) => project.events.flatMap(event => [...(event.dialogueBeats ?? []), ...(event.dialogues ?? []).flatMap(dialogue => dialogue.beats ?? [])]).filter(beat => beat.blockRef.scriptId === ref.scriptId && beat.blockRef.blockId === ref.blockId).length;
/** Only plain flow edges may be rewired. Conditions, effects and returns stay in the graph. */
const plain = (route: Transition) => (!route.source || route.source === 'graph') && route.mode !== 'fallback' && !route.conditions && !route.consequences?.length && !route.function && !route.arguments?.length && (!route.logic || Object.keys(route.logic).length === 0);

/** The projection never invents execution order or flattens branch/return topology. */
export function conversationProjection(project: BranchingProject, context: ConversationContext) {
  const { event, dialogue } = owned(project, context);
  const nodes = narrativeScopeNodes(project, context.eventId, context.dialogueId);
  const beatNodes = nodes.filter((node): node is NarrativeNodeReference & { beat: DialogueBeat } => Boolean(node.beat));
  const ids = new Set(beatNodes.map(node => node.id));
  const routes = project.events.flatMap(owner => (owner.transitions ?? []).map(route => ({ owner: owner.id, route })));
  const ins = new Map<string, Transition[]>(), outs = new Map<string, Transition[]>();
  for (const { route } of routes) { ins.set(route.to, [...(ins.get(route.to) ?? []), route]); outs.set(route.from, [...(outs.get(route.from) ?? []), route]); }
  const incoming = (id: string) => ins.get(id) ?? [];
  const outgoing = (id: string) => outs.get(id) ?? [];
  const references = new Map(narrativeNodeReferences(project, context.eventId).map(node => [node.id, node]));
  const external = new Set<string>((event?.interactionUses ?? []).flatMap(u => u.ownerNodeId ? [u.ownerNodeId] : []));
  for (const owner of project.events) {
    for (const binding of owner.boundaryBindings ?? []) external.add(binding.nodeId);
    for (const trigger of owner.dialogueStarts ?? []) if (trigger.dialogueId === context.dialogueId) external.add(`dialogue:${owner.id}:${trigger.dialogueId}`);
  }
  for (const action of project.narrativeActions ?? []) if (action.targetNodeId) external.add(action.targetNodeId);
  for (const rule of project.narrativeRules ?? []) if (rule.targetNodeId) external.add(rule.targetNodeId);
  for (const scenario of project.authoringScenarios ?? []) if (scenario.startNodeId) external.add(scenario.startNodeId);
  // Strongly cyclic paths are pinned, including cycles through non-beat nodes.
  const cyclic = new Set<string>();
  for (const id of ids) {
    const pending = outgoing(id).map(route => route.to), visited = new Set<string>();
    while (pending.length) {
      const target = pending.pop()!;
      if (target === id) { cyclic.add(id); break; }
      if (visited.has(target)) continue;
      visited.add(target); pending.push(...outgoing(target).map(route => route.to));
    }
  }
  const rows: ConversationRow[] = beatNodes.map(node => {
    const ins = incoming(node.id), outs = outgoing(node.id), restrictions: ConversationRestriction[] = [];
    if (!node.block) restrictions.push('missing-block');
    if (ins.length > 1 || outs.length > 1) restrictions.push('branch');
    if (cyclic.has(node.id)) restrictions.push('cycle');
    if ([...ins, ...outs].some(route => !plain(route))) restrictions.push('route-logic');
    // A named entry is another incoming execution path when it points into the middle of a chain.
    if (dialogue?.entryBeatId === node.elementId && ins.some(route => route.from !== entryId(context))) restrictions.push('external-entry');
    if (external.has(node.id) || external.has(node.elementId) || routes.some(item => item.owner !== context.eventId && (item.route.from === node.id || item.route.to === node.id)) || [...ins, ...outs].some(route => { const other = references.get(route.from === node.id ? route.to : route.from); return other && other.dialogueId !== context.dialogueId; })) restrictions.push('external-entry');
    return { ...node, sharedUses: usesOf(project, node.beat.blockRef), restrictions, canMoveUp: false, canMoveDown: false, canDelete: restrictions.length === 0, canInsertAfter: Boolean(node.block) && !cyclic.has(node.id) && outs.length <= 1 && outs.every(plain) };
  });
  const byId = new Map(rows.map(row => [row.id, row]));
  const safe = new Set(rows.filter(row => !row.restrictions.length).map(row => row.id));
  const visited = new Set<string>(), segments: ConversationSegment[] = [];
  const walk = (start: string) => {
    if (!safe.has(start) || visited.has(start)) return;
    const chain: string[] = []; let id: string | undefined = start;
    while (id && safe.has(id) && !visited.has(id)) {
      visited.add(id); chain.push(id);
      const next: string | undefined = outgoing(id)[0]?.to;
      id = next && incoming(next).length === 1 ? next : undefined;
    }
    const segment = { id: chain[0], nodeIds: chain, incoming: incoming(chain[0])[0], outgoing: outgoing(chain.at(-1)!)[0] };
    segments.push(segment);
    chain.forEach((id, index) => { const row = byId.get(id)!; row.segmentId = segment.id; row.canMoveUp = index > 0; row.canMoveDown = index < chain.length - 1; });
  };
  rows.filter(row => !safe.has(incoming(row.id)[0]?.from)).forEach(row => walk(row.id));
  rows.forEach(row => walk(row.id));
  const legacy = dialogue?.text ?? event?.text;
  const emptyEntry = (event?.transitions ?? []).filter(route => route.from === entryId(context));
  return { rows, segments, nodes, exists: Boolean(event && (!context.dialogueId || dialogue)), legacy,
    canStart: rows.length === 0 && nodes.length === 0 && emptyEntry.length <= 1 && emptyEntry.every(plain),
    requiresLegacyConversion: Boolean(context.dialogueId && !rows.length && legacy?.content),
  };
}

/** Ordinary canvas selection stays in the owner conversation; explicit Inspect still opens the beat. */
export function conversationLineForCanvasSelection(project: BranchingProject, ownerId: string, section: string, targetId: string): string | undefined {
  if (section !== 'path' && section !== 'narrativeSequence') return undefined;
  const event = project.events.find(event => event.id === ownerId);
  const dialogueOwner = event ? undefined : project.events.flatMap(event => (event.dialogues ?? []).map(dialogue => ({ eventId: event.id, dialogueId: dialogue.id, id: `dialogue:${event.id}:${dialogue.id}` }))).find(item => item.id === ownerId);
  const context = event ? { eventId: event.id } : dialogueOwner;
  if (!context) return undefined;
  const contexts = event ? conversationGroups(project, event.id).map(group => group.context) : [context];
  return contexts.flatMap(scope => conversationProjection(project, scope).rows).find(row => row.id === targetId)?.id;
}

function replaceBeats(project: BranchingProject, context: ConversationContext, beats: DialogueBeat[], entryBeatId?: string): BranchingProject {
  const { event, dialogue } = owned(project, context);
  if (!event) return project;
  if (context.dialogueId && dialogue) {
    let cursor = 0;
    const retained = new Set(beats.map(beat => beat.id));
    const members: DialogueMemberRef[] = (dialogue.members ?? []).filter(member => member.kind !== 'beat' || retained.has(member.id)).flatMap<DialogueMemberRef>(member => member.kind !== 'beat' ? [member] : cursor < beats.length ? [{ kind: 'beat' as const, id: beats[cursor++].id }] : []);
    while (cursor < beats.length) members.push({ kind: 'beat', id: beats[cursor++].id });
    return updateDialogue(project, context.eventId, context.dialogueId, { beats, members, ...(entryBeatId !== undefined || dialogue.entryBeatId ? { entryBeatId } : {}) }).project;
  }
  return updateEvent(project, context.eventId, { dialogueBeats: beats }).project;
}
function ensurePresence(project: BranchingProject, context: ConversationContext, ref?: string): BranchingProject {
  const event = project.events.find(item => item.id === context.eventId);
  if (!event || !ref || isGenericSpeakerRef(ref)) return project;
  if (context.dialogueId) {
    const dialogue = event.dialogues?.find(item => item.id === context.dialogueId);
    if (!dialogue) return project;
    const present = dialogue.presentEntityRefs ?? event.presentEntityRefs ?? event.canonRefs ?? [];
    const locationRef = dialogue.locationRef ?? event.locationRef;
    return present.includes(ref) && dialogue.presentEntityRefs !== undefined ? project : updateDialogue(project, event.id, dialogue.id, { presentEntityRefs: present.includes(ref) ? present : [...present, ref], ...(locationRef ? { locationRef } : {}) }).project;
  }
  const present = event.presentEntityRefs ?? event.canonRefs ?? [];
  return present.includes(ref) ? project : updateEvent(project, event.id, { presentEntityRefs: [...present, ref] }).project;
}

export function insertConversationLine(project: BranchingProject, context: ConversationContext, kind: 'speech' | 'direction', options: { afterId?: string; beforeId?: string; text?: string; speakerRef?: string; variantId?: string; locale?: string; convertingLegacy?: boolean } = {}): MutationResult {
  const projection = conversationProjection(project, context);
  if (!projection.exists) return fail(project, 'Conversation context no longer exists.');
  if (projection.requiresLegacyConversion && !options.convertingLegacy) return fail(project, 'Convert the existing dialogue text explicitly before adding lines.');
  let sourceId: string | undefined, beforeId = options.beforeId;
  const event = project.events.find(item => item.id === context.eventId)!;
  if (options.afterId) {
    const row = projection.rows.find(row => row.id === options.afterId);
    if (!row?.canInsertAfter) return fail(project, 'Choose a single plain continuation in the canvas before inserting a line.');
    sourceId = row.id;
  } else if (beforeId) {
    const row = projection.rows.find(row => row.id === beforeId);
    if (!row || row.restrictions.length) return fail(project, 'This line has protected connections. Insert from the canvas.');
    sourceId = event.transitions?.find(route => route.to === row.id)?.from;
    if (!sourceId) return fail(project, 'This line has no explicit incoming connection. Connect it in the canvas before inserting ahead of it.');
  } else if (projection.rows.length) {
    if (projection.segments.length !== 1 || projection.segments[0].nodeIds.length !== projection.rows.length || projection.nodes.some(node => !node.beat)) return fail(project, 'Select the line after which to insert; this context has several paths.');
    sourceId = projection.segments[0].nodeIds.at(-1);
  } else {
    if (!projection.canStart) return fail(project, 'Choose an entry in the canvas; the context already contains other narrative nodes.');
    sourceId = entryId(context);
  }
  const result = insertNarrativeBlock(project, context.eventId, kind, { dialogueId: context.dialogueId, afterNodeId: sourceId, beforeNodeId: beforeId, speakerRef: kind === 'speech' ? options.speakerRef : undefined });
  if (result.selection?.type !== 'node') return result;
  const created = narrativeNodeReferences(result.project, context.eventId).find(node => node.id === result.selection!.id)!;
  let next = updateNarrativeText(result.project, context.eventId, created.elementId, options.text ?? '', options.locale);
  if (kind === 'speech' && options.variantId && options.variantId !== 'base') next = updateScriptBlock(next, created.beat!.blockRef.scriptId, created.beat!.blockRef.blockId, { characterVariantId: options.variantId }).project;
  next = ensurePresence(next, context, kind === 'speech' ? options.speakerRef : undefined);
  if (!next.events.find(owner => owner.id === context.eventId)?.transitions?.some(route => route.from === created.id)) next = createInternalTransition(next, context.eventId, created.id, outputId(context)).project;
  if (context.dialogueId && sourceId === entryId(context)) next = updateDialogue(next, context.eventId, context.dialogueId, { entryBeatId: created.elementId }).project;
  if (!context.dialogueId) next = { ...next, canvas: { ...next.canvas, scopes: { ...next.canvas?.scopes, [`event:${context.eventId}`]: { ...next.canvas?.scopes?.[`event:${context.eventId}`], exitSlots: [...new Set([...(next.canvas?.scopes?.[`event:${context.eventId}`]?.exitSlots ?? []), 'exit'])] } } } };
  return { project: next, selection: result.selection, message: kind === 'speech' ? 'Added conversation speech.' : 'Added scene action.' };
}

/** Translate a drop edge into the final index after removing the dragged line. */
export function conversationDropOffset(order: readonly string[], fromId: string, targetId: string, edge: 'before' | 'after'): number {
  const from = order.indexOf(fromId), target = order.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return 0;
  const insertion = target + (edge === 'after' ? 1 : 0);
  return insertion - (from < insertion ? 1 : 0) - from;
}

/** Rewire one safe segment atomically. Keep every route's identity and metadata. */
export function moveConversationLine(project: BranchingProject, context: ConversationContext, id: string, offset: number): MutationResult {
  const projection = conversationProjection(project, context), row = projection.rows.find(row => row.id === id || row.elementId === id);
  const segment = projection.segments.find(segment => segment.id === row?.segmentId);
  if (!row || !segment || !Number.isInteger(offset)) return fail(project, 'This line has protected connections and cannot be reordered here.');
  const order = [...segment.nodeIds], index = order.indexOf(row.id), target = index + offset;
  if (target < 0 || target >= order.length || offset === 0) return fail(project, 'Move within the same linear segment.');
  order.splice(index, 1); order.splice(target, 0, row.id);
  const event = project.events.find(item => item.id === context.eventId)!;
  const replacements = new Map<string, Transition>();
  if (segment.incoming) replacements.set(segment.incoming.id, { ...segment.incoming, to: order[0] });
  segment.nodeIds.slice(0, -1).forEach((oldId, index) => {
    const route = event.transitions!.find(route => route.from === oldId && route.to === segment.nodeIds[index + 1])!;
    replacements.set(route.id, { ...route, from: order[index], to: order[index + 1] });
  });
  if (segment.outgoing) replacements.set(segment.outgoing.id, { ...segment.outgoing, from: order.at(-1)! });
  let next = updateEvent(project, context.eventId, { transitions: event.transitions?.map(route => replacements.get(route.id) ?? route) }).project;
  const { dialogue } = owned(next, context), beats = context.dialogueId ? dialogue?.beats ?? [] : event.dialogueBeats ?? [];
  const ordered = new Map(order.map((id, index) => [id, index]));
  const segmentBeats = beats.filter(beat => ordered.has(nodeId(context.eventId, beat.id))).sort((a, b) => ordered.get(nodeId(context.eventId, a.id))! - ordered.get(nodeId(context.eventId, b.id))!);
  let cursor = 0;
  next = replaceBeats(next, context, beats.map(beat => ordered.has(nodeId(context.eventId, beat.id)) ? segmentBeats[cursor++] : beat), dialogue?.entryBeatId === projection.rows.find(row => row.id === segment.nodeIds[0])?.elementId ? projection.rows.find(row => row.id === order[0])?.elementId : dialogue?.entryBeatId);
  return { project: next, selection: { type: 'node', id: row.id }, message: 'Reordered conversation line.' };
}

export function removeConversationLine(project: BranchingProject, context: ConversationContext, id: string): MutationResult {
  const projection = conversationProjection(project, context), row = projection.rows.find(row => row.id === id || row.elementId === id);
  if (!row?.canDelete) return fail(project, 'This line has protected connections. Resolve them in the canvas before deleting.');
  const { event, dialogue } = owned(project, context);
  const incoming = event!.transitions?.find(route => route.to === row.id), outgoing = event!.transitions?.find(route => route.from === row.id);
  const removed = new Set([incoming?.id, outgoing?.id].filter((id): id is string => Boolean(id)));
  let transitions = event!.transitions?.filter(route => !removed.has(route.id)) ?? [];
  if (incoming && outgoing) transitions.push({ ...incoming, to: outgoing.to });
  let next = updateEvent(project, context.eventId, { transitions }).project;
  const beats = (dialogue?.beats ?? event!.dialogueBeats ?? []).filter(beat => beat.id !== row.elementId);
  const nextEntry = dialogue?.entryBeatId === row.elementId ? projection.rows.find(candidate => candidate.id === outgoing?.to)?.elementId : dialogue?.entryBeatId;
  next = replaceBeats(next, context, beats, nextEntry);
  if (row.sharedUses <= 1) {
    const ref = row.beat.blockRef;
    next = { ...next, scriptDocuments: next.scriptDocuments?.map(script => script.id === ref.scriptId ? { ...script, blocks: script.blocks.filter(block => block.id !== ref.blockId) } : script) };
    // Localization keys are retained: external/localization consumers may still reference them.
  }
  return { project: next, selection: outgoing && projection.rows.some(candidate => candidate.id === outgoing.to) ? { type: 'node', id: outgoing.to } : undefined, message: 'Removed conversation line.' };
}

export function makeConversationLineIndependent(project: BranchingProject, context: ConversationContext, id: string): MutationResult {
  const row = conversationProjection(project, context).rows.find(row => row.id === id || row.elementId === id);
  if (!row?.block || row.sharedUses < 2) return fail(project, 'This line is already independent.');
  const ref = row.beat.blockRef, script = project.scriptDocuments!.find(script => script.id === ref.scriptId)!;
  let blockId = `${ref.blockId}:copy`, suffix = 2;
  while (script.blocks.some(block => block.id === blockId)) blockId = `${ref.blockId}:copy-${suffix++}`;
  const oldKey = row.block.textKey ?? scriptBlockTextKey(script.id, row.block.id), textKey = scriptBlockTextKey(script.id, blockId);
  const block: ScriptBlock = { ...row.block, id: blockId, textKey };
  let next: BranchingProject = { ...project, scriptDocuments: project.scriptDocuments!.map(owner => owner.id === script.id ? { ...owner, blocks: [...owner.blocks, block] } : owner) };
  const entry = project.localizationCatalog?.entries[oldKey];
  if (entry) next = { ...next, localizationCatalog: { ...project.localizationCatalog!, entries: { ...project.localizationCatalog!.entries, [textKey]: structuredClone(entry) } } };
  const patch = { blockRef: { scriptId: script.id, blockId } };
  next = context.dialogueId ? updateDialogueBeat(next, context.eventId, context.dialogueId, row.elementId, patch).project : updateEventDialogueBeat(next, context.eventId, row.elementId, patch).project;
  return { project: next, selection: { type: 'node', id: row.id }, message: 'Made conversation line independent.' };
}

export function updateConversationSpeaker(project: BranchingProject, context: ConversationContext, id: string, ref?: string, variantId?: string): BranchingProject {
  const row = conversationProjection(project, context).rows.find(row => row.id === id || row.elementId === id);
  if (!row?.block || row.beat.kind !== 'speech' || row.sharedUses > 1) return project;
  return ensurePresence(updateScriptBlock(project, row.beat.blockRef.scriptId, row.beat.blockRef.blockId, { characterRef: ref, speakerRef: undefined, characterVariantId: variantId && variantId !== 'base' ? variantId : undefined }).project, context, ref);
}
export function updateConversationText(project: BranchingProject, context: ConversationContext, id: string, text: string, locale: string): BranchingProject {
  const row = conversationProjection(project, context).rows.find(row => row.id === id || row.elementId === id);
  if (!row?.block || row.sharedUses > 1) return project;
  const primary = project.localizationCatalog?.primaryLocale ?? 'und';
  const saved = project.localizationCatalog?.entries[row.block.textKey ?? scriptBlockTextKey(row.beat.blockRef.scriptId, row.block.id)]?.values[locale] ?? (locale === primary ? row.block.content ?? '' : row.block.translations?.[locale] ?? '');
  return saved === text ? project : updateNarrativeText(project, context.eventId, row.elementId, text, locale);
}
export function createConversationSpeaker(project: BranchingProject, context: ConversationContext, name: string): MutationResult {
  if (!name.trim()) return fail(project, 'Enter a character name.');
  const entity = createLocalExplorerEntity('character', name.trim()), used = new Set([...project.canonRefs.map(ref => ref.id), ...(project.localExplorerEntities ?? []).map(item => item.id)]);
  const base = entity.id; let suffix = 2; while (used.has(entity.id)) entity.id = `${base}-${suffix++}`;
  return { project: ensurePresence({ ...project, localExplorerEntities: [...(project.localExplorerEntities ?? []), entity] }, context, entity.id), message: 'Created local conversation character.', selection: { type: 'explorerEntity', id: entity.id } };
}

/** Add a character to this conversation, or to the event's own conversation. */
export function addConversationParticipant(project: BranchingProject, eventId: string, ref: string, dialogueId?: string): MutationResult {
  const event = project.events.find(item => item.id === eventId);
  if (!event || ![...project.canonRefs, ...(project.localExplorerEntities ?? [])].some(item => item.id === ref)) return fail(project, 'The event or entity no longer exists.');
  if (dialogueId && !event.dialogues?.some(item => item.id === dialogueId)) return fail(project, 'The conversation no longer exists.');
  return { project: ensurePresence(project, { eventId, dialogueId }, ref) };
}

export function removeConversationParticipant(project: BranchingProject, eventId: string, ref: string, dialogueId?: string): MutationResult {
  const event = project.events.find(item => item.id === eventId);
  if (!event) return fail(project, 'The event no longer exists.');
  if (dialogueId) {
    const dialogue = event.dialogues?.find(item => item.id === dialogueId);
    if (!dialogue) return fail(project, 'The conversation no longer exists.');
    const present = dialogue.presentEntityRefs ?? event.presentEntityRefs ?? event.canonRefs ?? [];
    const locationRef = dialogue.locationRef ?? event.locationRef;
    return { project: updateDialogue(project, eventId, dialogueId, { presentEntityRefs: present.filter(id => id !== ref), ...(locationRef ? { locationRef } : {}) }).project };
  }
  const present = event.presentEntityRefs ?? event.canonRefs ?? [];
  return { project: updateEvent(project, eventId, { presentEntityRefs: present.filter(id => id !== ref) }).project };
}

/** One starting location per conversation; later beat overrides remain separate. */
export function setConversationStartingLocation(project: BranchingProject, eventId: string, ref?: string, dialogueId?: string): MutationResult {
  const event = project.events.find(item => item.id === eventId);
  if (!event || ref && !locationEntities(project).some(item => item.id === ref)) return fail(project, 'Choose an entity whose type is configured as a location.');
  if (dialogueId) {
    const dialogue = event.dialogues?.find(item => item.id === dialogueId);
    if (!dialogue) return fail(project, 'The conversation no longer exists.');
    // Snapshot legacy event context on first edit so it stops following later event changes.
    const presentEntityRefs = dialogue.presentEntityRefs ?? event.presentEntityRefs ?? event.canonRefs ?? [];
    return { project: updateDialogue(project, eventId, dialogueId, { presentEntityRefs, locationRef: ref }).project };
  }
  const next = updateEvent(project, eventId, { locationRef: ref }).project;
  return { project: ref ? ensurePresence(next, { eventId }, ref) : next };
}

/** Resolve the characters and place that the user can inherit from a conversation. */
export function inheritableConversationContext(project: BranchingProject, source: ConversationContext, characterIds: ReadonlySet<string>) {
  const sourceEvent = project.events.find(item => item.id === source.eventId);
  const sourceDialogue = sourceEvent?.dialogues?.find(item => item.id === source.dialogueId);
  if (!sourceEvent || source.dialogueId && !sourceDialogue) return { presentEntityRefs: [], locationRef: undefined };
  const useLegacyEventContext = sourceDialogue ? source.legacyEventContextFallback === true : true;
  const sourcePresence = sourceDialogue?.presentEntityRefs ?? (useLegacyEventContext ? sourceEvent.presentEntityRefs ?? sourceEvent.canonRefs ?? [] : []);
  const spokenCharacters = conversationProjection(project, source).rows
    .filter(row => row.kind === 'speech')
    .map(row => row.block?.characterRef ?? row.block?.speakerRef)
    .filter((id): id is string => Boolean(id));
  const inheritedCharacters = [...new Set([...sourcePresence, ...spokenCharacters])].filter(id => characterIds.has(id));
  const sourceLocation = sourceDialogue
    ? sourceDialogue.locationRef ?? (sourceDialogue.presentEntityRefs === undefined && useLegacyEventContext ? sourceEvent.locationRef : undefined)
    : sourceEvent.locationRef;
  return { presentEntityRefs: inheritedCharacters, locationRef: sourceLocation };
}

/** Copy available characters and the place from an earlier conversation into this one. */
export function inheritConversationContext(
  project: BranchingProject,
  target: ConversationContext,
  source: ConversationContext,
  characterIds: ReadonlySet<string>,
): MutationResult {
  const targetEvent = project.events.find(item => item.id === target.eventId);
  const targetDialogue = targetEvent?.dialogues?.find(item => item.id === target.dialogueId);
  if (!targetEvent || !target.dialogueId || !targetDialogue) return fail(project, 'The conversation context is no longer available.');
  const inherited = inheritableConversationContext(project, source, characterIds);
  if (!inherited.presentEntityRefs.length && !inherited.locationRef) return fail(project, 'The previous conversation has no characters or place to inherit.');

  // Merge characters and keep an already chosen place, so inheritance never erases local choices.
  const presentEntityRefs = [...new Set([...(targetDialogue.presentEntityRefs ?? []), ...inherited.presentEntityRefs])];
  const targetLocation = targetDialogue.locationRef
    ?? (targetDialogue.presentEntityRefs === undefined ? targetEvent.locationRef : undefined);
  return {
    project: updateDialogue(project, target.eventId, targetDialogue.id, {
      presentEntityRefs,
      locationRef: targetLocation ?? inherited.locationRef,
    }).project,
  };
}

/** Explicit content edit, not an automatic migration. The caller supplies one undo entry. */
export function convertLegacyConversationText(project: BranchingProject, context: ConversationContext): MutationResult {
  const projection = conversationProjection(project, context), { event, dialogue } = owned(project, context);
  const text = projection.legacy;
  if (!text?.content || (text.format !== 'plain' && text.format !== 'markdown')) return fail(project, 'Only existing plain or Markdown prose can be converted here.');
  if (projection.rows.length || !projection.canStart) return fail(project, 'Convert before creating beats, or edit the existing prose in Content.');
  const result = insertConversationLine(project, context, dialogue?.speakerRef ? 'speech' : 'direction', { text: text.content, speakerRef: dialogue?.speakerRef, convertingLegacy: true });
  if (result.project === project || result.selection?.type !== 'node') return result;
  const created = narrativeNodeReferences(result.project, context.eventId).find(row => row.id === result.selection!.id)!;
  const primary = project.localizationCatalog?.primaryLocale ?? 'und';
  let next = result.project;
  const legacyKey = dialogue ? `dialogue.${dialogue.id}.text` : `event.${event!.id}.text`;
  for (const [locale, value] of Object.entries(project.localizationCatalog?.entries[legacyKey]?.values ?? {})) next = updateLocalizedEntry(next, created.block!.textKey!, locale, value, primary);
  next = dialogue ? updateDialogue(next, context.eventId, dialogue.id, { text: { ...text, content: '' } }).project : updateEvent(next, event!.id, { text: { ...text, content: '' } }).project;
  return { ...result, project: next, message: 'Converted legacy prose to a conversation line.' };
}
