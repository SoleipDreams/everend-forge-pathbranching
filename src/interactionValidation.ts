import type { BranchingProject, ConditionInput, ValidationFinding } from './domain.js';
import { barrierNodeId, freezeInteractionParticipants, interactionDefinitionIssues, interactionNodeId } from './interactions.js';
import { createAuthoringNodeLookup, type AuthoringNodeLookup } from './authoringEngine.js';
import { resolveConditionValue } from './conditionEvaluation.js';
import { initialAuthoringState } from './authoringEntities.js';
import { resolveCharacterSubject } from './characterStats.js';
import { effectiveConditions, walkConditions } from './logic.js';

export function validateInteractions(
  project: BranchingProject,
  getAuthoringNodeLookup?: () => AuthoringNodeLookup,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const issue = (id: string, message: string) => findings.push({ code: 'invalid_interaction', severity: 'error', id, message });
  const ids = new Set<string>();
  let conditionMembershipIndexes: {
    sequenceConditionsByEventId: Map<string, Array<ConditionInput | undefined>>;
    branchConditionsByEventId: Map<string, Array<ConditionInput | undefined>>;
  } | undefined;
  const getConditionMembershipIndexes = () => {
    if (conditionMembershipIndexes) return conditionMembershipIndexes;
    const sequenceConditionsByEventId = new Map<string, Array<ConditionInput | undefined>>();
    const branchConditionsByEventId = new Map<string, Array<ConditionInput | undefined>>();
    const addConditionMembership = (membership: Map<string, Array<ConditionInput | undefined>>, eventIds: readonly string[], conditions: ConditionInput | undefined) => {
      for (const eventId of eventIds) {
        const values = membership.get(eventId);
        if (values) values.push(conditions);
        else membership.set(eventId, [conditions]);
      }
    };
    for (const sequence of project.sequences) addConditionMembership(sequenceConditionsByEventId, sequence.eventIds, effectiveConditions(sequence));
    for (const branch of project.branches) addConditionMembership(branchConditionsByEventId, branch.eventIds, effectiveConditions(branch));
    conditionMembershipIndexes = { sequenceConditionsByEventId, branchConditionsByEventId };
    return conditionMembershipIndexes;
  };
  let authoringNodeLookup: AuthoringNodeLookup | undefined;
  const getNodes = () => authoringNodeLookup ??= getAuthoringNodeLookup?.() ?? createAuthoringNodeLookup(project);
  for (const event of project.events) {
    for (const item of [...(event.interactionDefinitions ?? []), ...(event.interactionUses ?? []), ...(event.interactionBarriers ?? [])]) {
      if (!item.id || ids.has(item.id)) issue(item.id, 'Interaction definitions, uses and barriers require unique stable IDs');
      ids.add(item.id);
    }
    for (const d of event.interactionDefinitions ?? []) {
      for (const message of interactionDefinitionIssues(d)) issue(d.id, message);
      if (d.mechanic.kind === 'skillcheck') {
        const skill = d.mechanic.skill;
        if (skill) {
          const resolved = resolveConditionValue(skill.kind === 'variable' ? { type: 'value', subject: { kind: 'variable', variableId: skill.variableId }, operator: '>=' } : { type: 'property', subject: skill.subject, propertyId: skill.propertyId, operator: '>=' }, project, initialAuthoringState(project));
          if (resolved.error || (!resolved.unresolved && (typeof resolved.value !== 'number' || !Number.isFinite(resolved.value)))) issue(d.id, resolved.error ?? 'Skill source must be numeric');
        }
      }
      if (d.mechanic.kind === 'opposedcheck' && d.mechanic.actor && Array.isArray(d.mechanic.rivals)) {
        const state = initialAuthoringState(project);
        const participants = [d.mechanic.actor, ...d.mechanic.rivals];
        // Missing dynamic actor context may be supplied by a scenario. Concrete
        // identities and values must still be checked before executing a use.
        const allResolved = participants.every(participant => participant.subject && resolveCharacterSubject(project, state, participant.subject).subject);
        if (allResolved) {
          try { freezeInteractionParticipants(project, state, d); }
          catch (error) { issue(d.id, error instanceof Error ? error.message : String(error)); }
        } else for (const participant of participants) {
          if (!participant.subject) continue;
          const resolvedSubject = resolveCharacterSubject(project, state, participant.subject);
          if (resolvedSubject.error) { issue(d.id, resolvedSubject.error); continue; }
          const subject = resolvedSubject.subject;
          if (!subject || !participant.skill) continue;
          const skill = participant.skill;
          const resolved = resolveConditionValue(skill.kind === 'variable' ? { type: 'value', subject: { kind: 'variable', variableId: skill.variableId }, operator: '>=' }
            : { type: 'property', subject, propertyId: skill.propertyId, operator: '>=' }, project, state);
          if (resolved.error || !resolved.unresolved && (typeof resolved.value !== 'number' || !Number.isFinite(resolved.value))) issue(d.id, resolved.error ?? `Participant ${participant.id} skill must be numeric`);
        }
      }
    }
    const outgoing = (id: string) => (event.transitions ?? []).filter(t => t.from === id);
    const successors = (id: string): string[] => {
      const dialogue = event.dialogues?.find(d => `dialogue:${event.id}:${d.id}` === id);
      if (dialogue) {
        if (dialogue.entryBeatId) return [`beat:${event.id}:${dialogue.entryBeatId}`];
        const input = `dialogue-boundary:${event.id}:${dialogue.id}:input`;
        if (outgoing(input).length) return [input];
        const members = dialogue.members ?? (dialogue.beats ?? []).map(b => ({ kind: 'beat' as const, id: b.id }));
        return members.map(m => `${m.kind}:${event.id}:${m.id}`).filter(target => !event.transitions?.some(t => t.to === target && members.some(m => t.from === `${m.kind}:${event.id}:${m.id}`)));
      }
      const outputDialogue = event.dialogues?.find(d => `dialogue-boundary:${event.id}:${d.id}:output` === id);
      if (outputDialogue) return outgoing(`dialogue:${event.id}:${outputDialogue.id}`).map(t => t.to);
      const decision = event.decisions?.find(d => `decision:${event.id}:${d.id}` === id);
      return [...outgoing(id).map(t => t.to), ...(decision?.outcomes.map(o => `outcome:${event.id}:${decision.id}:${o.id}`) ?? [])];
    };
    const reachable = (from: string, target: string) => {
      const pending = [from], seen = new Set<string>();
      while (pending.length) { const id = pending.pop()!; if (id === target) return true; if (seen.has(id)) continue; seen.add(id); pending.push(...successors(id)); }
      return false;
    };
    for (const use of event.interactionUses ?? []) {
      const definition = event.interactionDefinitions?.find(d => d.id === use.definitionId);
      if (!definition) issue(use.id, 'Missing interaction definition');
      if (!['before', 'during', 'after'].includes(use.moment)) issue(use.id, 'Invalid interaction moment');
      if (use.dialogueId && !event.dialogues?.some(d => d.id === use.dialogueId)) issue(use.id, 'Missing interaction dialogue');
      if (use.ownerNodeId && !getNodes().has(use.ownerNodeId)) issue(use.id, 'Missing interaction owner');
      if (use.ownerNodeId && getNodes().eventId(use.ownerNodeId) !== event.id) issue(use.id, 'Interaction owner belongs to another event');
      const nodeId = use.ownerNodeId ?? interactionNodeId(event.id, use.id);
      const decision = event.decisions?.find(item => `decision:${event.id}:${item.id}` === nodeId || item.outcomes.some(outcome => `outcome:${event.id}:${item.id}:${outcome.id}` === nodeId));
      const outcome = decision?.outcomes.find(item => `outcome:${event.id}:${decision.id}:${item.id}` === nodeId);
      const dialogue = event.dialogues?.find(item => item.id === use.dialogueId || `dialogue:${event.id}:${item.id}` === nodeId || item.beats?.some(beat => `beat:${event.id}:${beat.id}` === nodeId) || decision && (decision.dialogueId === item.id || item.members?.some(member => member.kind === 'decision' && member.id === decision.id)));
      const beat = [...(event.dialogueBeats ?? []), ...(dialogue?.beats ?? [])].find(item => `beat:${event.id}:${item.id}` === nodeId);
      const dependsOnUse = (conditions: ConditionInput | undefined) => {
        let found = false;
        walkConditions(conditions, condition => { if (condition.type === 'interactionResult' && condition.useId === use.id) found = true; });
        return found;
      };
      const membership = getConditionMembershipIndexes();
      const gates = [
        ...(membership.sequenceConditionsByEventId.get(event.id) ?? []),
        ...(membership.branchConditionsByEventId.get(event.id) ?? []),
        effectiveConditions(event), dialogue ? effectiveConditions(dialogue) : undefined, decision ? effectiveConditions(decision) : undefined,
        outcome ? effectiveConditions(outcome) : undefined, beat ? effectiveConditions(beat) : undefined,
      ];
      if (gates.some(dependsOnUse)) issue(use.id, 'Interaction result is required before this interaction can start. Execute it before the availability gate or use a result route.');
      for (const route of event.transitions ?? []) if (route.to === nodeId && dependsOnUse(effectiveConditions(route))) issue(use.id, 'An incoming route requires this interaction result before the interaction can start.');
      if (!use.ownerNodeId && !outgoing(nodeId).length) issue(use.id, 'Interaction node requires a continuation');
      if (use.moment === 'during' && use.ownerNodeId) {
        const barriers = event.interactionBarriers?.filter(b => b.useIds.includes(use.id)) ?? [];
        if (!barriers.some(b => reachable(nodeId, barrierNodeId(event.id, b.id)))) issue(use.id, 'Concurrent interaction requires a reachable wait barrier');
        // Detect paths to event exit that bypass every declared barrier.
        const stops = new Set(barriers.map(b => barrierNodeId(event.id, b.id)));
        const pending = [nodeId], seen = new Set<string>();
        while (pending.length) {
          const id = pending.pop()!; if (seen.has(id) || stops.has(id)) continue; seen.add(id);
          const routes = successors(id);
          if ((id !== nodeId && (!getNodes().has(id) || id.startsWith(`boundary:${event.id}:output:`))) || (!routes.length && id !== nodeId && !id.startsWith('decision:'))) { issue(use.id, 'A continuation can leave the event without waiting for this interaction'); break; }
          pending.push(...routes);
          const decision = event.decisions?.find(d => `decision:${event.id}:${d.id}` === id);
          decision?.outcomes.forEach(o => pending.push(`outcome:${event.id}:${decision.id}:${o.id}`));
        }
      }
      if (definition && !use.ownerNodeId) for (const result of definition.results) {
        const routes = outgoing(nodeId);
        if (!routes.some(t => !t.conditions && !t.logic?.when || JSON.stringify(t.logic?.when ?? t.conditions).includes(result.id))) issue(use.id, `Result ${result.name} has no route or shared continuation`);
      }
    }
    for (const barrier of event.interactionBarriers ?? []) {
      if (!barrier.useIds.length) issue(barrier.id, 'Wait barrier requires at least one interaction');
      for (const id of barrier.useIds) {
        const use = event.interactionUses?.find(u => u.id === id);
        if (!use) issue(barrier.id, `Missing interaction use ${id}`);
        else if (!reachable(use.ownerNodeId ?? interactionNodeId(event.id, use.id), barrierNodeId(event.id, barrier.id))) issue(barrier.id, `Wait barrier is unreachable from ${id}`);
      }
      if (!outgoing(barrierNodeId(event.id, barrier.id)).length) issue(barrier.id, 'Wait barrier requires a continuation');
    }
  }
  return findings;
}
