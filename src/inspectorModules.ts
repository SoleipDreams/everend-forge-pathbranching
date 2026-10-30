import type { BranchingProject } from './domain.js';
import { narrativeNodeReferences } from './authoringMutations.js';

export type InspectorModule = { id: string; label: string; fixed?: boolean; hasContent: boolean };
export type InspectorModulePreferences = { visible: string[]; active: string };
export const inspectorModulesKey = (projectId: string, objectKey: string) => `pathbranching:inspector-modules:v1:${JSON.stringify([projectId, objectKey])}`;
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : Boolean(value);

/** Capabilities and content come from the document, never canvas geometry. */
export function narrativeInspectorModules(project: BranchingProject, nodeId: string): InspectorModule[] | undefined {
  for (const event of project.events) {
    if (event.interactionUses?.some(u => `interaction:${event.id}:${u.id}` === nodeId)) return [
      { id: 'overview', label: 'Interaction', fixed: true, hasContent: true },
      { id: 'consequences', label: 'Consequences', fixed: true, hasContent: true },
      { id: 'connections', label: 'Connections', fixed: true, hasContent: true },
    ];
    if (event.interactionBarriers?.some(b => `barrier:${event.id}:${b.id}` === nodeId)) return [{ id: 'overview', label: 'Wait', fixed: true, hasContent: true }, { id: 'connections', label: 'Connections', fixed: true, hasContent: true }];
    const ref = event.id === nodeId ? undefined : narrativeNodeReferences(project, event.id).find(node => node.id === nodeId);
    if (event.id !== nodeId && !ref) continue;
    const dialogueId = ref?.kind === 'dialogue' ? ref.elementId : ref?.dialogueId;
    const dialogue = dialogueId ? event.dialogues?.find(item => item.id === dialogueId) : undefined;
    const decision = ref?.kind === 'decision' || ref?.kind === 'outcome' ? event.decisions?.find(item => item.id === (ref.decisionId ?? ref.elementId)) : undefined;
    const outcome = ref?.kind === 'outcome' ? decision?.outcomes.find(item => item.id === ref.elementId) : undefined;
    if (outcome) return [
      { id: 'content', label: 'Option', fixed: true, hasContent: true },
      { id: 'conditions', label: 'Conditions', fixed: true, hasContent: true },
      { id: 'consequences', label: 'Consequences', fixed: true, hasContent: true },
      { id: 'interactions', label: 'Interaction', fixed: true, hasContent: true },
      { id: 'connections', label: 'Connections', fixed: true, hasContent: true },
    ];
    const owner = ref?.beat ?? outcome ?? decision ?? dialogue ?? event;
    const focusedDecision = Boolean(decision);
    const modules: InspectorModule[] = [
      ...(focusedDecision ? [{ id: 'decisionSettings', label: 'Decisions', fixed: true, hasContent: true }] : []),
      { id: ref?.beat ? 'content' : focusedDecision ? 'narrativeDecision' : 'overview', label: focusedDecision ? 'Options' : !ref ? 'Event' : ({ dialogue: 'Conversation', decision: 'Decisions', outcome: 'Decisions', speech: 'Dialogue', direction: 'Stage direction' } as const)[ref.kind], fixed: true, hasContent: true },
      ...(dialogue || ref?.beat ? [{ id: 'consequences', label: 'Consequences', fixed: true, hasContent: true }] : []),
      { id: 'connections', label: 'Connections', fixed: true, hasContent: true },
    ];
    if (!focusedDecision) modules.push({ id: 'interactions', label: 'Interaction', hasContent: Boolean(
      event.interactionUses?.some(use => !ref || use.ownerNodeId === nodeId || dialogue && use.dialogueId === dialogue.id)
      || event.interactionBarriers?.some(barrier => !ref || dialogue && barrier.dialogueId === dialogue.id)
      || event.decisions?.some(item => ['dice', 'qte'].includes(item.type) && (!ref || item.id === decision?.id))
    ) });
    if (!ref || dialogue) {
      modules.push({ id: dialogue ? 'narrativeSequence' : 'path', label: 'Narrative', hasContent: dialogue
        ? Boolean(dialogue.beats?.length || dialogue.text.content)
        : Boolean(event.dialogueBeats?.length || event.text?.content || event.dialogues?.length) });
    }
    if (!focusedDecision) modules.push({ id: 'conditions', label: 'Conditions', hasContent: hasValue(owner.logic?.when) || ('availability' in owner && hasValue(owner.availability)) || ('displayCondition' in owner && hasValue(owner.displayCondition)) || ('conditions' in owner && hasValue(owner.conditions)) });
    return modules;
  }
  return undefined;
}

export function readInspectorModulePreferences(projectId: string, objectKey: string): InspectorModulePreferences | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(inspectorModulesKey(projectId, objectKey)) ?? 'null');
    if (value && Array.isArray(value.visible) && value.visible.every((id: unknown) => typeof id === 'string') && typeof value.active === 'string') return value;
  } catch { /* Missing or inaccessible local preferences do not block editing. */ }
  return undefined;
}

export function resolveInspectorModulePreferences(modules: InspectorModule[], saved?: InspectorModulePreferences): InspectorModulePreferences {
  const fixed = modules.filter(item => item.fixed).map(item => item.id);
  const optional = saved ? saved.visible : modules.filter(item => !item.fixed && item.hasContent).map(item => item.id);
  const visible = [...new Set([...fixed, ...optional.filter(id => modules.some(item => item.id === id))])];
  return { visible, active: saved && visible.includes(saved.active) ? saved.active : fixed[0] };
}

export function saveInspectorModulePreferences(projectId: string, objectKey: string, value: InspectorModulePreferences) {
  try { localStorage.setItem(inspectorModulesKey(projectId, objectKey), JSON.stringify(value)); } catch { /* In-memory editing remains available. */ }
}
