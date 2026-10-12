import type { BranchingProject, EventType } from './domain.js';
export type NamingLocale = 'es' | 'en';
export type NarrativeNameKind = 'Decision' | 'Conversation' | 'Option';
// Only new or explicitly reset names follow the interface language.
let namingLocale: NamingLocale = 'en';
export function setNarrativeNamingLocale(locale: NamingLocale) { namingLocale = locale; }
export function narrativeLineLabel(kind: 'speech' | 'direction') {
  return kind === 'speech' ? (namingLocale === 'es' ? 'Diálogo sin texto' : 'Dialogue without text') : (namingLocale === 'es' ? 'Acotación sin texto' : 'Stage direction without text');
}
export function firstAvailableNarrativeName(label: string, names: string[]) {
  const used = new Set(names.map(name => name.trim().toLocaleLowerCase()));
  let number = 1;
  while (used.has(`${label} ${number}`.toLocaleLowerCase())) number++;
  return `${label} ${number}`;
}
export function automaticNarrativeName(project: BranchingProject, eventId: string | undefined, kind: NarrativeNameKind, options: { excludeId?: string; decisionId?: string; locale?: NamingLocale } = {}) {
  const event = project.events.find(event => event.id === eventId);
  const es = (options.locale ?? namingLocale) === 'es';
  const label = kind === 'Decision' ? (es ? 'Decisión' : 'Decision') : kind === 'Conversation' ? (es ? 'Conversación' : 'Conversation') : (es ? 'Opción' : 'Option');
  const items = kind === 'Decision' ? event?.decisions?.map(item => ({ id: item.id, name: item.name })) : kind === 'Conversation' ? event?.dialogues?.map(item => ({ id: item.id, name: item.title })) : event?.decisions?.find(item => item.id === options.decisionId)?.outcomes.map(item => ({ id: item.id, name: item.name }));
  return firstAvailableNarrativeName(label, (items ?? []).filter(item => item.id !== options.excludeId).map(item => item.name));
}
export function automaticEventName(project: BranchingProject, type: EventType, parentEventId?: string, _branchId?: string, options: { excludeId?: string; sequenceId?: string; locale?: NamingLocale } = {}) {
  const es = (options.locale ?? namingLocale) === 'es';
  const sequence = project.sequences.find(item => item.id === options.sequenceId || (!options.sequenceId && item.id === (project.canvas?.activeSequenceId ?? project.entrySequenceId))) ?? project.sequences[0];
  const label = parentEventId ? (es ? 'Subevento' : 'Subevent') : type === 'final' ? (es ? 'Evento final' : 'Final event') : type === 'exploration' ? (es ? 'Evento de exploración' : 'Exploration event') : (es ? 'Evento' : 'Event');
  const parent = project.events.find(event => event.id === parentEventId);
  const siblings = project.events.filter(event => event.id !== options.excludeId && (parentEventId ? event.parentEventId === parentEventId || parent?.childEventIds?.includes(event.id) : !event.parentEventId && event.type === type && (sequence?.eventIds.includes(event.id) || sequence?.entryEventId === event.id)));
  return firstAvailableNarrativeName(label, siblings.map(event => event.name));
}
export function narrativeNameTarget(project: BranchingProject, nodeId: string) {
  for (const event of project.events) {
    if (event.id === nodeId) return { kind: 'event' as const, eventId: event.id, id: event.id, name: event.name };
    for (const dialogue of event.dialogues ?? []) if (`dialogue:${event.id}:${dialogue.id}` === nodeId) return { kind: 'dialogue' as const, eventId: event.id, id: dialogue.id, name: dialogue.title };
    for (const decision of event.decisions ?? []) {
      if (`decision:${event.id}:${decision.id}` === nodeId) return { kind: 'decision' as const, eventId: event.id, id: decision.id, name: decision.name, dialogueId: decision.dialogueId };
      for (const option of decision.outcomes) if (`outcome:${event.id}:${decision.id}:${option.id}` === nodeId) return { kind: 'option' as const, eventId: event.id, id: option.id, decisionId: decision.id, name: option.name };
    }
  }
}
export function automaticNameForNode(project: BranchingProject, nodeId: string, locale?: NamingLocale) {
  const target = narrativeNameTarget(project, nodeId);
  if (!target) return undefined;
  if (target.kind === 'event') {
    const event = project.events.find(event => event.id === target.id)!;
    const sequence = project.sequences.find(item => item.eventIds.includes(event.id) || item.entryEventId === event.id);
    const parentId = event.parentEventId ?? project.events.find(parent => parent.childEventIds?.includes(event.id))?.id;
    return automaticEventName(project, event.type, parentId, undefined, { excludeId: target.id, sequenceId: sequence?.id, locale });
  }
  return automaticNarrativeName(project, target.eventId, target.kind === 'dialogue' ? 'Conversation' : target.kind === 'decision' ? 'Decision' : 'Option', { excludeId: target.id, decisionId: target.kind === 'option' ? target.decisionId : undefined, locale });
}
/** Owner context is presentation only and is added exclusively to repeated names. */
export function narrativeDestinationLabels(project: BranchingProject, items: { id: string; label: string }[], locale: NamingLocale) {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item.label, (counts.get(item.label) ?? 0) + 1));
  const labels = items.map(item => {
    if (counts.get(item.label) === 1) return item.label;
    const target = narrativeNameTarget(project, item.id);
    const event = project.events.find(event => event.id === target?.eventId);
    const dialogue = target?.kind === 'decision' ? event?.dialogues?.find(item => item.id === target.dialogueId) : undefined;
    const owner = target?.kind === 'event' ? project.events.find(parent => parent.id === event?.parentEventId || parent.childEventIds?.includes(target.id))?.name ?? project.sequences.find(sequence => sequence.eventIds.includes(target.id))?.name : target?.kind === 'option' ? event?.decisions?.find(decision => decision.id === target.decisionId)?.name : dialogue?.title ?? event?.name;
    return `${item.label} · ${owner ?? (locale === 'es' ? 'Elemento' : 'Item')}`;
  });
  return new Map(items.map((item, index) => [item.id, labels.filter(label => label === labels[index]).length > 1 ? `${labels[index]} · ${index + 1}` : labels[index]]));
}
