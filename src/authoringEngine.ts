import type { AuthoringScenario, BranchingProject, ConditionInput, DialogueNode, EntityInstance, EventNode, InstanceEffect, LogicMoment, LogicSubject, NarrativeAction, NarrativeEffect, NarrativeRule, PlayerSimulationState, Transition } from './domain.js';
import { conditionValueMatchesType, evaluateConditionDetailed, type ConditionEvaluationResult } from './conditionEvaluation.js';
import { applyConsequenceDetailed, combineConditions, effectiveConditions, orderedTransitions } from './logic.js';
import { entityCapabilities, entityDefinition, initialAuthoringState, instanceOwnerIssue, ownerKey, resolveContextSubject, resolveOwner } from './authoringEntities.js';
import { resolveLogicField } from './logicCapabilities.js';

export type AuthoringTrace = { kind: 'enter' | 'condition' | 'effect' | 'route' | 'rule' | 'action' | 'return' | 'error'; nodeId?: string; id?: string; message: string; evaluation?: ConditionEvaluationResult; before?: PlayerSimulationState; after?: PlayerSimulationState };
export type AuthoringChoice = { id: string; nodeId: string; text: string; status: ConditionEvaluationResult['status']; hidden: boolean; reason?: string; evaluation: ConditionEvaluationResult };
export type AuthoringActionOption = { id: string; name: string; status: ConditionEvaluationResult['status']; requiresTarget: boolean; reason?: string };
export type AuthoringView = { nodeId?: string; eventId?: string; dialogueId?: string; kind?: string; title?: string; text?: string; speakerRef?: string; choices: AuthoringChoice[]; actions: AuthoringActionOption[] };
type Frame = { nodeId: string; context?: PlayerSimulationState['context'] };
type Snapshot = Omit<AuthoringSession, 'history'>;
export type AuthoringSession = {
  revision: string;
  scenarioId?: string;
  startNodeId?: string;
  entryTransitionId?: string;
  status: 'ready' | 'blocked' | 'ended';
  state: PlayerSimulationState;
  nodeId?: string;
  view: AuthoringView;
  trace: AuthoringTrace[];
  applied: string[];
  ruleTruth: Record<string, boolean>;
  returns: Frame[];
  history: Snapshot[];
  visitedNodeIds: string[];
  message?: string;
};
export type AuthoringCommand =
  | { type: 'continue' }
  | { type: 'choose'; outcomeId: string }
  | { type: 'action'; actionId: string; self?: LogicSubject; target?: LogicSubject; actor?: LogicSubject }
  | { type: 'setState'; state: Partial<PlayerSimulationState> }
  | { type: 'back' }
  | { type: 'restart'; scenario?: AuthoringScenario; startNodeId?: string };
type ContentNode = { id: string; rawId: string; kind: string; event?: EventNode; dialogue?: DialogueNode; title?: string; text?: string; speakerRef?: string; logic?: LogicMoment; when?: ConditionInput; automatic: boolean; decision?: NonNullable<EventNode['decisions']>[number] };

/** Only narrative data participates in the fixed revision; panels/layout never invalidate a run. */
export function authoringRevision(project: BranchingProject): string {
  return JSON.stringify({ sequences: project.sequences, branches: project.branches, events: project.events, scriptDocuments: project.scriptDocuments, variables: project.logicVariables, canon: project.canonRefs, local: project.localExplorerEntities, properties: project.localExplorerProperties, instances: project.entityInstances, overrides: project.entityOverrides, actions: project.narrativeActions, rules: project.narrativeRules, typeOverrides: project.logicTypeOverrides, propertyOverrides: project.logicPropertyOverrides, data: project.projectDataObjects });
}
export function authoringNodeOptions(project: BranchingProject) {
  return Array.from(nodeIndex(project).values()).filter((n, i, all) => all.findIndex(x => x.id === n.id) === i && !['outcome','boundary','dialogueStart'].includes(n.kind)).map(n => ({ id: n.id, label: [n.event?.name, n.dialogue?.title, n.title || n.kind].filter(Boolean).join(' / '), eventId: n.event?.id, dialogueId: n.dialogue?.id }));
}
export function authoringNodeExists(project: BranchingProject, id: string): boolean { return nodeIndex(project).has(id); }
function nodeIndex(project: BranchingProject): Map<string, ContentNode> {
  const nodes = new Map<string, ContentNode>();
  const add = (node: ContentNode) => { nodes.set(node.id, node); if (!nodes.has(node.rawId)) nodes.set(node.rawId, node); };
  project.sequences.forEach(s => { add({ id: `start:${s.id}`, rawId: s.id, kind: 'sequence', title: s.name, logic: s.logic, when: effectiveConditions(s), automatic: true }); });
  for (const event of project.events) {
    add({ id: event.id, rawId: event.id, kind: 'event', event, title: event.name, text: event.text?.content, logic: event.logic ?? { then: event.consequences }, when: effectiveConditions(event), automatic: !event.text?.content });
    const beat = (b: NonNullable<EventNode['dialogueBeats']>[number], dialogue?: DialogueNode) => {
      const block = project.scriptDocuments?.find(s => s.id === b.blockRef.scriptId)?.blocks.find(block => block.id === b.blockRef.blockId);
      add({ id: `beat:${event.id}:${b.id}`, rawId: b.id, kind: b.kind, event, dialogue, title: dialogue?.title ?? event.name, text: block?.content, speakerRef: block?.characterRef ?? block?.speakerRef, logic: b.logic ?? { then: b.consequences }, when: effectiveConditions(b), automatic: false });
    };
    (event.dialogueBeats ?? []).forEach(b => beat(b));
    for (const dialogue of event.dialogues ?? []) {
      add({ id: `dialogue:${event.id}:${dialogue.id}`, rawId: dialogue.id, kind: 'dialogue', event, dialogue, title: dialogue.title, text: dialogue.beats?.length ? undefined : dialogue.text?.content, speakerRef: dialogue.speakerRef, logic: dialogue.logic ?? { then: dialogue.consequences }, when: effectiveConditions(dialogue), automatic: Boolean(dialogue.beats?.length || dialogue.members?.length) || !dialogue.text?.content });
      (dialogue.beats ?? []).forEach(b => beat(b, dialogue));
    }
    for (const decision of event.decisions ?? []) {
      const dialogue = event.dialogues?.find(d => d.id === decision.dialogueId || d.members?.some(m => m.kind === 'decision' && m.id === decision.id));
      add({ id: `decision:${event.id}:${decision.id}`, rawId: decision.id, kind: 'decision', event, dialogue, title: decision.name, text: decision.description, decision, logic: decision.logic, when: effectiveConditions(decision), automatic: false });
      decision.outcomes.forEach(outcome => add({ id: `outcome:${event.id}:${decision.id}:${outcome.id}`, rawId: outcome.id, kind: 'outcome', event, dialogue, title: outcome.name, logic: outcome.logic ?? { then: outcome.consequences }, when: combineConditions(effectiveConditions(decision), effectiveConditions(outcome)), automatic: true }));
    }
    (event.dialogueStarts ?? []).forEach(start => add({ id: `dialogue-start:${event.id}:${start.id}`, rawId: start.id, kind: 'dialogueStart', event, when: effectiveConditions(start), logic: start.logic, automatic: true }));
    const boundaries = new Set((event.transitions ?? []).flatMap(t => [t.from, t.to]).concat((event.boundaryBindings ?? []).map(b => b.portId)));
    for (const id of boundaries) if (id.startsWith(`boundary:${event.id}:`) || id.startsWith(`dialogue-boundary:${event.id}:`)) add({ id, rawId: id, kind: 'boundary', event, dialogue: event.dialogues?.find(d => id.startsWith(`dialogue-boundary:${event.id}:${d.id}:`)), automatic: true });
  }
  return nodes;
}
function evaluationState(state: PlayerSimulationState) { return { ...state, inventory: state.inventory, visited: state.visited }; }
function evaluate(project: BranchingProject, state: PlayerSimulationState, when?: ConditionInput) { return evaluateConditionDetailed(when, project, evaluationState(state)); }
function stop(session: AuthoringSession, message: string, id?: string) { session.status = 'blocked'; session.message = message; session.trace.push({ kind: 'error', nodeId: session.nodeId, id, message }); }
function blocked(session: AuthoringSession) { return session.status === 'blocked'; }
function scoped(rule: NarrativeRule, node: ContentNode | undefined) {
  return rule.scope.kind === 'global' || rule.scope.kind === 'event' && node?.event?.id === rule.scope.id || rule.scope.kind === 'dialogue' && node?.dialogue?.id === rule.scope.id || rule.scope.kind === 'node' && (node?.id === rule.scope.id || node?.rawId === rule.scope.id);
}
function rules(project: BranchingProject) { return (project.narrativeRules ?? []).map((r, index) => ({ r, index })).sort((a, b) => (a.r.priority ?? 0) - (b.r.priority ?? 0) || a.index - b.index); }
function selectInstances(project: BranchingProject, state: PlayerSimulationState, effect: InstanceEffect) {
  const instances = state.entityInstances ?? [];
  if (effect.instanceId === '@self' || effect.instanceId === '@target') {
    const subject = resolveContextSubject({ kind: 'context', role: effect.instanceId === '@self' ? 'self' : 'target' }, state);
    if (subject?.kind !== 'instance') return { copies: [], error: 'Choose a concrete copy for this action' };
    return selectInstances(project, state, { ...effect, instanceId: subject.instanceId });
  }
  if (effect.instanceId) return { copies: instances.filter(i => i.id === effect.instanceId), error: instances.some(i => i.id === effect.instanceId) ? undefined : `Missing copy ${effect.instanceId}` };
  if (effect.instanceIds) {
    if (effect.instanceIds.some(id => !instances.some(i => i.id === id))) return { copies: [], error: 'A selected copy no longer exists' };
    return { copies: instances.filter(i => effect.instanceIds!.includes(i.id)) };
  }
  if (effect.selection !== 'all') return { copies: [], error: 'Choose copies explicitly or select all matching copies' };
  const owner = resolveOwner(effect.query?.owner, state);
  if (effect.query?.owner && !owner) return { copies: [], error: 'Supply copy owner context' };
  const copies: EntityInstance[] = [];
  for (const i of instances) {
    if (effect.query?.entityId && i.entityId !== effect.query.entityId || effect.query?.owner && ownerKey(i.owner) !== ownerKey(owner)) continue;
    const result = evaluate(project, { ...state, context: { ...state.context, self: { kind: 'instance', instanceId: i.id } } }, effect.query?.filters);
    if (result.status === 'invalid' || result.status === 'unresolved') return { copies: [], error: result.message };
    if (result.status === 'satisfied') copies.push(i);
  }
  return { copies };
}
export function applyInstanceEffect(project: BranchingProject, state: PlayerSimulationState, effect: InstanceEffect, stableKey = 'copy'): { state: PlayerSimulationState; error?: string } {
  let instances = structuredClone(state.entityInstances ?? []);
  const original = state;
  const fail = (error: string) => ({ state: original, error });
  const owner = resolveOwner(effect.owner, state);
  if (effect.owner && !owner) return fail('Supply copy owner context');
  const validProperties = (entityId: string) => {
    for (const [id, value] of Object.entries(effect.properties ?? {})) {
      const property = project.localExplorerProperties?.find(p => p.id === id || p.id === `property:${id}`);
      const base = entityDefinition(project, entityId)?.properties;
      if (!property && !Object.prototype.hasOwnProperty.call(base ?? {}, id)) return `Missing property ${id}`;
      if (!conditionValueMatchesType(value, property?.valueType)) return `Copy property ${id} has an incompatible value`;
      if (resolveLogicField(project,{kind:'entity',entityId},'effect','property',id).status !== 'enabled') return `Copy property ${id} is not writable`;
    }
    return Object.values(effect.states ?? {}).some(v => typeof v !== 'boolean') ? 'Copy states must be boolean' : undefined;
  };
  if (effect.operation === 'create') {
    if (!effect.entityId || !entityDefinition(project, effect.entityId)) return fail('Choose an existing entity to copy');
    const error = validProperties(effect.entityId); if (error) return fail(error);
    const baseId = effect.instanceId ?? `instance:${stableKey}`;
    let id = baseId; let suffix = 2;
    if (effect.instanceId && instances.some(i => i.id === id)) return fail(`Duplicate copy ${id}`);
    while (instances.some(i => i.id === id)) id = `${baseId}:${suffix++}`;
    instances.push({ id, entityId: effect.entityId, name: effect.name, owner, properties: effect.properties, states: effect.states });
  } else {
    const selection = selectInstances(project, { ...state, entityInstances: instances }, effect);
    if (selection.error) return fail(selection.error);
    const ids = new Set(selection.copies.map(i => i.id));
    if (effect.operation === 'remove') {
      if (instances.some(i => i.owner?.kind === 'instance' && ids.has(i.owner.instanceId) && !ids.has(i.id))) return fail('Move or remove contained copies before removing their container');
      instances = instances.filter(i => !ids.has(i.id));
    } else if (effect.operation === 'move') instances = instances.map(i => ids.has(i.id) ? { ...i, owner } : i);
    else if (effect.operation === 'modify') {
      for (const i of selection.copies) { const error = validProperties(i.entityId); if (error) return fail(error); }
      instances = instances.map(i => ids.has(i.id) ? { ...i, ...(effect.name === undefined ? {} : { name: effect.name }), properties: { ...i.properties, ...effect.properties }, states: { ...i.states, ...effect.states } } : i);
    } else return fail('Unsupported copy operation');
  }
  for (const i of instances) { const error = instanceOwnerIssue(project, instances, i); if (error) return fail(error); }
  return { state: { ...state, entityInstances: instances } };
}
function effects(project: BranchingProject, session: AuthoringSession, effects: NarrativeEffect[] | undefined, key: string, repeat: 'once' | 'each-entry' = 'once'): boolean {
  if (repeat === 'once' && session.applied.includes(key)) return true;
  const before = structuredClone(session.state);
  let next = session.state;
  for (const [index, effect] of (effects ?? []).entries()) {
    if (effect.type === 'instanceEffect') {
      const result = applyInstanceEffect(project, next, effect as InstanceEffect, `${key}:${index}`);
      if (result.error) { stop(session, result.error, key); return false; }
      next = result.state;
    } else {
      const guarded = 'conditions' in effect ? effect.conditions : undefined;
      const gate = evaluate(project, next, guarded as ConditionInput | undefined);
      if (gate.status === 'invalid' || gate.status === 'unresolved') { stop(session, gate.message, key); return false; }
      if (gate.status === 'unsatisfied') continue;
      const result = applyConsequenceDetailed(project, next, effect as import('./domain.js').Consequence);
      if (result.status !== 'applied') { stop(session, result.message ?? 'Invalid consequence', key); return false; }
      next = result.state;
    }
  }
  session.state = next;
  if (repeat === 'once') session.applied.push(key);
  if (JSON.stringify(before) !== JSON.stringify(next)) session.trace.push({ kind: 'effect', nodeId: session.nodeId, id: key, message: `${effects?.length ?? 0} effects applied`, before, after: structuredClone(next) });
  return true;
}
function moment(project: BranchingProject, session: AuthoringSession, node: ContentNode) {
  const logic = node.logic;
  if (!effects(project, session, [...(logic?.then ?? []), ...(logic?.narrativeEffects ?? [])], `enter:${node.id}`, logic?.repeat)) return false;
  for (const rule of logic?.rules ?? []) {
    const result = evaluate(project, session.state, rule.when);
    session.trace.push({ kind: 'condition', id: rule.id, nodeId: node.id, message: result.message, evaluation: result });
    if (result.status === 'invalid' || result.status === 'unresolved') { stop(session, result.message, rule.id); return false; }
    if (result.status === 'satisfied' && !effects(project, session, rule.then, `legacy-rule:${node.id}:${rule.id}`, logic?.repeat)) return false;
  }
  return true;
}
function runRules(project: BranchingProject, session: AuthoringSession, trigger: NarrativeRule['trigger'], node: ContentNode | undefined, budget: { value: number }): string | undefined {
  let destination: string | undefined;
  for (const { r } of rules(project)) {
    if (r.trigger !== trigger || !scoped(r, node)) continue;
    const result = evaluate(project, session.state, r.when);
    if (result.status === 'invalid' || result.status === 'unresolved') { stop(session, `Rule ${r.name}: ${result.message}`, r.id); return undefined; }
    const was = session.ruleTruth[r.id] ?? false;
    session.ruleTruth[r.id] = result.status === 'satisfied';
    if (result.status !== 'satisfied' || trigger === 'stateChanged' && was || r.repeat !== 'each-entry' && session.applied.includes(`rule:${r.id}`)) continue;
    if (++budget.value > 100) { stop(session, 'Automatic chain exceeds 100 operations', r.id); return undefined; }
    session.trace.push({ kind: 'rule', id: r.id, nodeId: session.nodeId, message: r.name, evaluation: result });
    if (!effects(project, session, r.effects, `rule:${r.id}`, r.repeat)) return undefined;
    if (r.targetNodeId && destination === undefined) {
      destination = r.targetNodeId;
      // Consume the simultaneous edge for lower-priority rules as well. Moving
      // to a new node must not fire the losing branch on the same state change.
      if (trigger === 'stateChanged') for (const { r: other } of rules(project)) if (other.trigger === 'stateChanged' && scoped(other, node)) session.ruleTruth[other.id] = evaluate(project, session.state, other.when).status === 'satisfied';
      break;
    }
  }
  return destination;
}
function immediate(project: BranchingProject, session: AuthoringSession, node: ContentNode | undefined, budget: { value: number }) {
  // Each rule sees the updated state. Re-scan until effects stop changing it.
  let destination: string | undefined;
  for (;;) {
    const before = JSON.stringify(session.state);
    const next = runRules(project, session, 'stateChanged', node, budget);
    if (session.status === 'blocked') return undefined;
    destination ??= next;
    if (next || before === JSON.stringify(session.state)) return destination;
  }
}
function routes(project: BranchingProject, from: string): Transition[] {
  const list = project.events.flatMap(e => e.transitions ?? []).filter(t => t.from === from);
  for (const e of project.events) for (const b of e.boundaryBindings ?? []) {
    const source = b.direction === 'input' ? b.portId : b.nodeId;
    const target = b.direction === 'input' ? b.nodeId : b.portId;
    if (source === from && !list.some(t => t.from === source && t.to === target)) list.push({ id: `binding:${b.id}`, from: source, to: target });
  }
  return orderedTransitions(list);
}
function route(project: BranchingProject, session: AuthoringSession, from: string, budget: { value: number }): string | undefined {
  const candidates = routes(project, from);
  if (candidates.filter(t => t.mode === 'fallback').length > 1) { stop(session, 'More than one Else route', from); return undefined; }
  for (const t of candidates) {
    const result = evaluate(project, session.state, effectiveConditions(t));
    session.trace.push({ kind: 'condition', nodeId: from, id: t.id, message: result.message, evaluation: result });
    if (result.status === 'invalid' || result.status === 'unresolved') { stop(session, result.message, t.id); return undefined; }
    if (result.status !== 'satisfied') continue;
    if (t.function) { stop(session, `External route ${t.function} needs a result`, t.id); return undefined; }
    if (!effects(project, session, [...(t.logic?.then ?? t.consequences ?? []), ...(t.logic?.narrativeEffects ?? [])], `route:${t.id}`, t.logic?.repeat)) return undefined;
    session.entryTransitionId = t.id;
    session.trace.push({ kind: 'route', nodeId: from, id: t.id, message: `${from} → ${t.to}` });
    return immediate(project, session, nodeIndex(project).get(from), budget) ?? t.to;
  }
  if (candidates.length) stop(session, 'No route is satisfied', from);
  return undefined;
}
function structuralNext(project: BranchingProject, session: AuthoringSession, node: ContentNode, budget: { value: number }): string | undefined {
  if (node.kind === 'sequence') {
    const sequence = project.sequences.find(s => s.id === node.rawId);
    if (!sequence?.entryEventId) { stop(session, 'Sequence has no entry event', node.rawId); return undefined; }
    return sequence.entryEventId;
  }
  if (node.kind === 'boundary' && node.event) {
    if (node.id.startsWith(`dialogue-boundary:${node.event.id}:`) && node.id.endsWith(':output')) return route(project, session, `dialogue:${node.event.id}:${node.dialogue?.id}`, budget);
    if (node.id.startsWith(`boundary:${node.event.id}:output:`)) {
      const suffix = node.id.slice(`boundary:${node.event.id}:output:`.length);
      if (suffix === 'restart') return node.event.id;
      const t = node.event.transitions?.find(t => t.id === suffix && t.from === node.event!.id);
      if (t) return route(project, session, node.event.id, budget);
      const direct = route(project, session, node.id, budget);
      return direct;
    }
    return route(project, session, node.id, budget);
  }
  if (node.kind === 'dialogue' && node.dialogue) {
    if (node.dialogue.entryBeatId) return `beat:${node.event!.id}:${node.dialogue.entryBeatId}`;
    const input = `dialogue-boundary:${node.event!.id}:${node.dialogue.id}:input`;
    if (routes(project, input).length) return route(project, session, input, budget);
    const members = node.dialogue.members ?? (node.dialogue.beats ?? []).map(b => ({ kind: 'beat' as const, id: b.id }));
    const starts = members.map(m => `${m.kind === 'beat' ? 'beat' : 'decision'}:${node.event!.id}:${m.id}`).filter(id => !node.event!.transitions?.some(t => t.to === id && members.some(m => t.from.endsWith(`:${m.id}`))));
    if (starts.length > 1) { stop(session, 'Choose the dialogue entry; several blocks are possible', node.id); return undefined; }
    if (starts.length === 1) return starts[0];
  }
  if (node.kind === 'event' && node.event) {
    const inputPrefix = `boundary:${node.event.id}:input:`;
    const inputs = [...new Set((node.event.transitions ?? []).filter(t => t.from.startsWith(inputPrefix)).map(t => t.from))];
    const preferred = inputs.find(i => i === `${inputPrefix}${session.entryTransitionId}`) ?? inputs.find(i => i === `${inputPrefix}entry` || i === `${inputPrefix}sequence-entry:${project.entrySequenceId}`);
    if (preferred) return route(project, session, preferred, budget);
    if (inputs.length > 1) { stop(session, 'Choose the event input; several entries are possible', node.id); return undefined; }
    if (inputs.length === 1) return route(project, session, inputs[0], budget);
    if (routes(project, node.id).length) return route(project, session, node.id, budget);
    const children = [...(node.event.dialogueBeats ?? []).map(b => `beat:${node.event!.id}:${b.id}`), ...(node.event.dialogues ?? []).map(d => `dialogue:${node.event!.id}:${d.id}`), ...(node.event.decisions ?? []).filter(d => !d.dialogueId).map(d => `decision:${node.event!.id}:${d.id}`), ...(node.event.childEventIds ?? [])];
    const starts = children.filter(id => !node.event!.transitions?.some(t => t.to === id));
    if (starts.length > 1) { stop(session, 'Choose the event entry; several blocks are possible', node.id); return undefined; }
    if (starts.length === 1) return starts[0];
  }
  return route(project, session, node.id, budget);
}
function refreshView(project: BranchingProject, session: AuthoringSession) {
  const node = nodeIndex(project).get(session.nodeId ?? '');
  const choices: AuthoringChoice[] = (node?.decision?.outcomes ?? []).map(o => {
    const result = evaluate(project, session.state, combineConditions(node?.when, effectiveConditions(o)));
    return { id: o.id, nodeId: `outcome:${node!.event!.id}:${node!.decision!.id}:${o.id}`, text: o.visibleText ?? o.name, status: result.status, hidden: o.unavailableBehavior === 'hidden' && result.status !== 'satisfied', reason: result.status === 'satisfied' ? undefined : o.lockText?.content ?? result.message, evaluation: result };
  });
  const actions = (project.narrativeActions ?? []).filter(a => a.enabled !== false).map(a => {
    const result = evaluate(project, session.state, a.when);
    return { id: a.id, name: a.name, status: result.status, requiresTarget: a.requiresTarget ?? false, reason: result.status === 'satisfied' ? undefined : result.message };
  });
  session.view = { nodeId: node?.id, eventId: node?.event?.id, dialogueId: node?.dialogue?.id, kind: node?.kind, title: node?.title, text: node?.text, speakerRef: node?.speakerRef, choices, actions };
}
function advance(project: BranchingProject, session: AuthoringSession, destination: string | undefined, budget: { value: number }) {
  const index = nodeIndex(project);
  const seen = new Set<string>();
  while (destination && session.status !== 'blocked') {
    if (++budget.value > 100) { stop(session, 'Automatic chain exceeds 100 operations', destination); break; }
    const fingerprint = `${destination}:${JSON.stringify(session.state)}`;
    if (seen.has(fingerprint)) { stop(session, 'Automatic cycle detected', destination); break; }
    seen.add(fingerprint);
    const node = index.get(destination);
    if (!node) { stop(session, `Missing narrative node ${destination}`, destination); break; }
    const previousEvent = index.get(session.nodeId ?? '')?.event;
    session.nodeId = node.id;
    const inherited = node.event ? combineConditions(...project.sequences.filter(s => s.eventIds.includes(node.event!.id)).map(effectiveConditions), ...project.branches.filter(b => b.eventIds.includes(node.event!.id)).map(effectiveConditions), effectiveConditions(node.event), node.dialogue ? effectiveConditions(node.dialogue) : undefined, node.when) : node.when;
    const gate = evaluate(project, session.state, inherited);
    session.trace.push({ kind: 'condition', nodeId: node.id, message: gate.message, evaluation: gate });
    if (gate.status !== 'satisfied') { stop(session, gate.status === 'unsatisfied' ? 'This content is unavailable' : gate.message, node.id); break; }
    if (!session.visitedNodeIds.includes(node.id)) session.visitedNodeIds.push(node.id);
    const visited = new Set(session.state.visited ?? []); visited.add(node.id);
    if (['event','decision','outcome','sequence'].includes(node.kind)) visited.add(`${node.kind}:${node.rawId}`);
    session.state = { ...session.state, visited: [...visited], activeNodeId: node.event?.id, activeDecisionId: node.decision?.id };
    session.trace.push({ kind: 'enter', nodeId: node.id, message: node.title ?? node.kind });
    if (node.kind === 'event' && node.event) {
      for (const sequence of project.sequences.filter(s => s.eventIds.includes(node.event!.id))) if (!moment(project, session, { id: `sequence:${sequence.id}`, rawId: sequence.id, kind: 'sequence', automatic: true, logic: sequence.logic ?? { then: sequence.consequences } })) break;
      for (const branch of project.branches.filter(s => s.eventIds.includes(node.event!.id))) if (!moment(project, session, { id: `branch:${branch.id}`, rawId: branch.id, kind: 'branch', automatic: true, logic: branch.logic ?? { then: branch.consequences } })) break;
      const entityStates = { ...session.state.entityStates };
      if (previousEvent?.id !== node.event.id) for (const entityId of previousEvent?.presentEntityRefs ?? previousEvent?.canonRefs ?? []) entityStates[entityId] = { ...entityStates[entityId], states: { ...entityStates[entityId]?.states, present: false } };
      for (const entityId of node.event.presentEntityRefs ?? node.event.canonRefs ?? []) entityStates[entityId] = { ...entityStates[entityId], states: { ...entityStates[entityId]?.states, present: true } };
      session.state.entityStates = entityStates;
    }
    if (blocked(session) || !moment(project, session, node)) break;
    const triggered = runRules(project, session, 'enter', node, budget);
    const changed = immediate(project, session, node, budget);
    if (blocked(session)) break;
    if (triggered || changed) { destination = triggered ?? changed; continue; }
    if (!node.automatic) { session.status = 'ready'; refreshView(project, session); return; }
    destination = structuralNext(project, session, node, budget);
    if (!destination && !blocked(session) && session.returns.length) {
      const frame = session.returns.pop()!; session.nodeId = frame.nodeId; session.state.context = frame.context;
      session.trace.push({ kind: 'return', nodeId: frame.nodeId, message: 'Returned to the interrupted content' });
      session.status = 'ready'; refreshView(project, session); return;
    }
  }
  if (session.status !== 'blocked') session.status = 'ended';
  refreshView(project, session);
}
export function createAuthoringSession(project: BranchingProject, scenario?: AuthoringScenario, startNodeId?: string): AuthoringSession {
  const state = initialAuthoringState(project, scenario);
  const session: AuthoringSession = { revision: authoringRevision(project), scenarioId: scenario?.id, startNodeId: startNodeId ?? scenario?.startNodeId, status: 'ready', state, view: { choices: [], actions: [] }, trace: [], applied: [], returns: [], ruleTruth: {}, history: [], visitedNodeIds: [] };
  if (new Set(state.entityInstances?.map(i => i.id)).size !== state.entityInstances?.length) { stop(session, 'Duplicate copy IDs'); return session; }
  for (const i of state.entityInstances ?? []) { const error = instanceOwnerIssue(project, state.entityInstances ?? [], i); if (error) { stop(session, error, i.id); return session; } }
  for (const { r } of rules(project)) if (r.trigger === 'stateChanged') session.ruleTruth[r.id] = evaluate(project, state, r.when).status === 'satisfied';
  const sequence = project.sequences.find(s => s.id === project.entrySequenceId) ?? (project.sequences.length === 1 ? project.sequences[0] : undefined);
  const start = session.startNodeId ?? (sequence ? `start:${sequence.id}` : project.events.length === 1 ? project.events[0].id : undefined);
  if (!start) { stop(session, 'Choose a story entry; several sequences are possible'); return session; }
  advance(project, session, start, { value: 0 });
  return session;
}
export function authoringCommand(project: BranchingProject, source: AuthoringSession, command: AuthoringCommand): AuthoringSession {
  if (command.type === 'restart') return createAuthoringSession(project, command.scenario, command.startNodeId ?? source.startNodeId);
  if (command.type === 'back') {
    const previous = source.history.at(-1);
    return previous ? { ...structuredClone(previous), history: source.history.slice(0, -1) } : source;
  }
  const session = structuredClone(source);
  if (source.revision !== authoringRevision(project)) { stop(session, 'The story changed. Restart to use the new revision.'); return session; }
  if (session.status === 'blocked' && command.type !== 'setState') return session;
  const { history, ...snapshot } = structuredClone(source);
  session.history = [...history.slice(-99), snapshot];
  session.message = undefined; session.status = 'ready';
  const node = nodeIndex(project).get(session.nodeId ?? '');
  const budget = { value: 0 };
  let next: string | undefined;
  if (command.type === 'setState') {
    const nextState = { ...session.state, ...command.state, context: { ...session.state.context, ...command.state.context } };
    for (const v of project.logicVariables ?? []) if (Object.prototype.hasOwnProperty.call(nextState.variables, v.id) && !conditionValueMatchesType(nextState.variables![v.id], v.type)) { stop(session, `Variable ${v.name} has an incompatible value`, v.id); return session; }
    for (const i of nextState.entityInstances ?? []) { const error = instanceOwnerIssue(project, nextState.entityInstances ?? [], i); if (error) { stop(session, error, i.id); return session; } }
    session.state = nextState;
    next = immediate(project, session, node, budget);
    if (!next) { refreshView(project, session); return session; }
  } else if (command.type === 'choose') {
    refreshView(project, session);
    const choice = session.view.choices.find(c => c.id === command.outcomeId);
    if (!choice || choice.status !== 'satisfied') { stop(session, choice?.reason ?? 'This response is not available', command.outcomeId); return session; }
    next = choice.nodeId;
  } else if (command.type === 'action') {
    const action = project.narrativeActions?.find(a => a.id === command.actionId && a.enabled !== false);
    if (!action) { stop(session, 'Missing action', command.actionId); return session; }
    const oldContext = structuredClone(session.state.context);
    session.state.context = { ...oldContext, ...(command.actor ? { actor: command.actor } : {}), ...(command.self ? { self: command.self } : {}), ...(command.target ? { target: command.target } : {}) };
    const self = session.state.context?.self && resolveContextSubject(session.state.context.self, session.state);
    const entityId = self?.kind === 'entity' ? self.entityId : self?.kind === 'instance' ? session.state.entityInstances?.find(i => i.id === self.instanceId)?.entityId : undefined;
    const entity = entityId ? entityDefinition(project, entityId) : undefined;
    if (action.entityId && action.entityId !== entityId || action.typeId && action.typeId !== entity?.typeId || action.source && action.source !== entity?.source) { stop(session, 'Action does not apply to the selected entity', action.id); return session; }
    if (action.requiresTarget && !session.state.context.target) { stop(session, 'Choose the action recipient', action.id); return session; }
    const result = evaluate(project, session.state, action.when);
    session.trace.push({ kind: 'action', id: action.id, nodeId: session.nodeId, message: action.name, evaluation: result });
    if (result.status !== 'satisfied') { stop(session, result.message, action.id); return session; }
    const subjectKey = self?.kind === 'entity' ? self.entityId : self?.kind === 'instance' ? self.instanceId : 'global';
    const disabledOrOverride = project.narrativeActions?.find(a => a.entityId === entityId && a.overridesActionId === action.id);
    if (disabledOrOverride) { stop(session, disabledOrOverride.enabled === false ? 'Action disabled for this entity' : 'Use the configured entity action instead', action.id); return session; }
    if (!effects(project, session, action.effects, `action:${action.id}:${subjectKey}`, action.repeat)) return session;
    next = immediate(project, session, node, budget) ?? action.targetNodeId;
    if (next && action.navigation !== 'jump' && action.targetNodeId === next && session.nodeId) session.returns.push({ nodeId: session.nodeId, context: oldContext });
    if (action.navigation === 'jump') session.returns = [];
    if (!next) { session.state.context = oldContext; refreshView(project, session); return session; }
  } else {
    if (node?.kind === 'decision') { stop(session, 'Choose a response before continuing', node.id); return session; }
    next = runRules(project, session, 'continue', node, budget) ?? immediate(project, session, node, budget);
    if (!next && node && !blocked(session)) next = structuralNext(project, session, node, budget);
    if (!next && !blocked(session) && session.returns.length) {
      const frame = session.returns.pop()!; session.nodeId = frame.nodeId; session.state.context = frame.context;
      session.trace.push({ kind: 'return', nodeId: frame.nodeId, message: 'Returned to the interrupted content' }); refreshView(project, session); return session;
    }
  }
  if (!blocked(session)) advance(project, session, next, budget);
  return session;
}

// Short aliases for embedding clients.
export const createSession = createAuthoringSession;
export const commandSession = authoringCommand;
