import type { BranchingProject, NarrativeAction, NarrativeRule } from "./domain.js";

export type RuleCreationContext = { currentEventId?: string; currentDialogueId?: string };

/** Use a real document context, never a stale selection or the first event. */
export function contextualRuleScope(project: BranchingProject, context: RuleCreationContext): NarrativeRule["scope"] {
  const event = project.events.find(item => item.id === context.currentEventId);
  const dialogueEvent = event ?? (!context.currentEventId
    ? project.events.find(item => item.dialogues?.some(dialogue => dialogue.id === context.currentDialogueId))
    : undefined);
  const dialogue = dialogueEvent?.dialogues?.find(item => item.id === context.currentDialogueId);
  if (dialogue) return { kind: "dialogue", id: dialogue.id };
  if (event) return { kind: "event", id: event.id };
  return { kind: "global" };
}

export function appendCatalogAction(project: BranchingProject, id: string, name: string): BranchingProject {
  const action: NarrativeAction = { id, name, navigation: "call", repeat: "once" };
  return { ...project, narrativeActions: [...(project.narrativeActions ?? []), action] };
}

export function appendCatalogRule(project: BranchingProject, id: string, name: string, scope: NarrativeRule["scope"]): BranchingProject {
  const rules = project.narrativeRules ?? [];
  const priorities = rules.map(rule => rule.priority ?? 0).filter(Number.isFinite);
  const priority = priorities.length ? Math.max(...priorities) + 1 : 0;
  const rule: NarrativeRule = { id, name, trigger: "enter", scope, priority, repeat: "once" };
  return { ...project, narrativeRules: [...rules, rule] };
}
