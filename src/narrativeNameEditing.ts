import type { BranchingProject } from './domain.js';
import { narrativeNameTarget } from './narrativeNaming.js';
import { updateDecision, updateDialogue, updateEvent, updateOutcome } from './projectMutations.js';

export function renameNarrativeNode(project: BranchingProject, nodeId: string, value: string): BranchingProject {
  const target = narrativeNameTarget(project, nodeId), name = value.trim();
  if (!target || !name) throw new Error('A narrative item and a nonempty name are required.');
  if (target.kind === 'event') return updateEvent(project, target.id, { name }).project;
  if (target.kind === 'dialogue') return updateDialogue(project, target.eventId, target.id, { title: name }).project;
  if (target.kind === 'decision') return updateDecision(project, target.eventId, target.id, { name }).project;
  return updateOutcome(project, target.eventId, target.decisionId, target.id, { name }).project;
}
