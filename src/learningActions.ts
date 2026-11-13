import type { BranchingProject } from "./domain";

const different = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);
function logicParts(value: unknown): { conditions: unknown[]; consequences: unknown[] } {
  if (!value || typeof value !== "object") return { conditions: [], consequences: [] };
  const conditions: unknown[] = [], consequences: unknown[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (["conditions", "availability", "displayCondition", "when"].includes(key) && child && (Array.isArray(child) ? child.length : Object.keys(child).length)) conditions.push(child);
    if (["consequences", "actions", "then"].includes(key) && child && (Array.isArray(child) ? child.length : Object.keys(child).length)) consequences.push(child);
    const nested = logicParts(child); conditions.push(...nested.conditions); consequences.push(...nested.consequences);
  }
  return { conditions, consequences };
}

/** Inspect applied mutations, never the initial document or a selected canvas. */
export function learningActionsForMutation(before: BranchingProject, after: BranchingProject): string[] {
  if (before.projectId !== after.projectId) return [];
  const actions: string[] = [];
  if (after.sequences.some(item => !before.sequences.some(previous => previous.id === item.id))) actions.push("sequence-created");
  if (after.events.some(item => !before.events.some(previous => previous.id === item.id))) actions.push("event-created");
  if (after.events.some(event => {
    const previous = before.events.find(item => item.id === event.id);
    const previousIds = new Set((previous?.dialogues ?? []).map(dialogue => dialogue.id));
    return (event.dialogues ?? []).some(dialogue => !previousIds.has(dialogue.id));
  })) actions.push("dialogue-created");
  if (after.events.some(event => {
    const previous = before.events.find(item => item.id === event.id);
    const previousIds = new Set((previous?.interactionUses ?? []).map(use => use.id));
    return (event.interactionUses ?? []).some(use => !previousIds.has(use.id));
  })) actions.push("interaction-created");
  const textById = (document: BranchingProject) => new Map([
    ...document.events.flatMap(event => [
      [event.id, event.text?.content ?? ""] as const,
      ...(event.dialogues ?? []).map(dialogue => [dialogue.id, dialogue.text?.content ?? ""] as const),
    ]),
    ...(document.scriptDocuments ?? []).flatMap(script => script.blocks.map(block => [block.id, block.content] as const)),
  ]);
  const oldText = textById(before), nextText = textById(after);
  if ([...nextText].some(([id, text]) => text.trim().length > 0 && text !== oldText.get(id))) actions.push("event-written");
  const scriptTextByBlock = (document: BranchingProject): Map<string, string> => new Map<string, string>((document.scriptDocuments ?? []).flatMap(script => script.blocks.map(block => [`${script.id}:${block.id}`, block.content] as const)));
  const dialogueTextByBlock = (document: BranchingProject): Map<string, string> => {
    const blocks = scriptTextByBlock(document);
    const references = document.events.flatMap(event => [
      ...(event.dialogueBeats ?? []),
      ...(event.dialogues ?? []).flatMap(dialogue => dialogue.beats ?? []),
    ].map(beat => `${beat.blockRef.scriptId}:${beat.blockRef.blockId}`));
    const dialogueText = new Map<string, string>();
    for (const key of references) {
      const text = blocks.get(key);
      if (text !== undefined) dialogueText.set(key, text);
    }
    return dialogueText;
  };
  const oldScriptText = scriptTextByBlock(before), nextDialogueText = dialogueTextByBlock(after);
  if ([...nextDialogueText].some(([id, text]) => text.trim().length > 0 && text !== oldScriptText.get(id))) actions.push("dialogue-written");
  if (Object.keys(after.variables).some(key => !(key in before.variables))) actions.push("variable-created");
  const oldLogic = logicParts(before), nextLogic = logicParts(after);
  if (nextLogic.conditions.length > 0 && different(oldLogic.conditions, nextLogic.conditions)) actions.push("condition-added");
  if (nextLogic.conditions.length > 0 && nextLogic.consequences.length > 0 && different(oldLogic, nextLogic)) actions.push("logic-applied");
  const routes = (project: BranchingProject) => [
    ...project.events.flatMap(event => event.transitions ?? []),
  ];
  const oldRoutes = routes(before), nextRoutes = routes(after);
  if (different(oldRoutes, nextRoutes) && after.events.some(event => event.decisions?.some(decision => {
    const sourcesFor = (outcomeId: string) => [
      outcomeId,
      `outcome:${event.id}:${decision.id}:${outcomeId}`,
    ];
    const destinations = new Set(decision.outcomes.flatMap(outcome => {
      const sources = sourcesFor(outcome.id);
      return nextRoutes.filter(route => sources.includes(route.from)).map(route => route.to);
    }));
    return decision.outcomes.filter(outcome => {
      const sources = sourcesFor(outcome.id);
      return nextRoutes.some(route => sources.includes(route.from) && route.to);
    }).length >= 2 && destinations.size >= 2;
  }))) actions.push("branch-connected");
  return actions;
}
