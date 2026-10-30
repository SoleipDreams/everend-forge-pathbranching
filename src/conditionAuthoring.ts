import type { BranchingProject, LogicSubject, ProjectDataObject } from './domain.js';
import { narrativeNodeReferences } from './authoringMutations.js';
import { logicFieldOptions, logicSubjectKey, logicSubjectOptions } from './logicCapabilities.js';
import { entityCapabilities } from './authoringEntities.js';

export type ConditionKind = 'state' | 'property' | 'value' | 'visited' | 'instanceQuery' | 'external';
export type ConditionAuthoringContext = {
  sequenceId?: string;
  eventId?: string;
  dialogueId?: string;
  nodeId?: string;
  /** Guarded edge identity distinguishes route checks from source-node availability. */
  routeId?: string;
  contextEntityIds?: string[];
};
export type ConditionCandidate = {
  id: string;
  label: string;
  detail: string;
  icon?: string;
  subject?: LogicSubject;
  entityId?: string;
  useId?: string;
  group: 'context' | 'nearby' | 'all';
  priority?: number;
};
export type ConditionKindDescription = { id: ConditionKind; label: string; description: string; icon: string };
type Locale = 'es' | 'en';

const kinds: Record<Locale, ConditionKindDescription[]> = {
  es: [
    { id: 'state', label: 'Estado de entidad', description: 'Comprueba el estado de una entidad o copia.', icon: 'CircleCheck' },
    { id: 'property', label: 'Propiedad', description: 'Compara una propiedad de una entidad, copia u objeto de datos.', icon: 'SlidersHorizontal' },
    { id: 'value', label: 'Variable', description: 'Compara el valor registrado de una variable.', icon: 'Variable' },
    { id: 'visited', label: 'Progreso', description: 'Comprueba si se visitó un punto de la historia.', icon: 'Footprints' },
    { id: 'instanceQuery', label: 'Inventario / copias', description: 'Busca copias, aplica filtros o compara su cantidad.', icon: 'PackageSearch' },
    { id: 'external', label: 'Función externa', description: 'Comprueba un resultado booleano del entorno.', icon: 'CodeXml' },
  ],
  en: [
    { id: 'state', label: 'Entity state', description: 'Check the state of an entity or copy.', icon: 'CircleCheck' },
    { id: 'property', label: 'Property', description: 'Compare an entity, copy or data object property.', icon: 'SlidersHorizontal' },
    { id: 'value', label: 'Variable', description: 'Compare the recorded value of a variable.', icon: 'Variable' },
    { id: 'visited', label: 'Progress', description: 'Check whether a story point was visited.', icon: 'Footprints' },
    { id: 'instanceQuery', label: 'Inventory / copies', description: 'Find copies, filter them or compare their count.', icon: 'PackageSearch' },
    { id: 'external', label: 'External function', description: 'Check a boolean result supplied by the environment.', icon: 'CodeXml' },
  ],
};

export function conditionKindCatalog(locale: Locale = 'es'): ConditionKindDescription[] {
  return kinds[locale].map(item => ({ ...item }));
}

/** Accent-insensitive matching, including words in reference paths and IDs. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function referenceDetail(project: BranchingProject, subject: LogicSubject, locale: Locale, fallback: string): string {
  const es = locale === 'es';
  if (subject.kind === 'instance') {
    const instance = project.entityInstances?.find(item => item.id === subject.instanceId);
    const entityName = project.canonRefs.find(item => item.id === instance?.entityId)?.label ?? project.localExplorerEntities?.find(item => item.id === instance?.entityId)?.name ?? instance?.entityId;
    return [es ? 'Copia' : 'Copy', entityName, subject.instanceId].filter(Boolean).join(' · ');
  }
  return fallback;
}

function contextFacts(project: BranchingProject, context: ConditionAuthoringContext) {
  const references = project.events.flatMap(event => narrativeNodeReferences(project, event.id).map(node => ({ event, node })));
  const current = references.find(item => item.node.id === context.nodeId || item.node.elementId === context.nodeId);
  const routeOwner = project.events.find(item => item.transitions?.some(route => route.id === context.nodeId));
  const interactionOwner = project.events.find(item => item.interactionUses?.some(use => use.id === context.nodeId || `interaction:${item.id}:${use.id}` === context.nodeId));
  const event = context.eventId ? project.events.find(item => item.id === context.eventId)
    : current?.event ?? routeOwner ?? interactionOwner ?? project.events.find(item => item.id === context.nodeId || item.dialogues?.some(dialogue => dialogue.id === context.dialogueId));
  const node = current?.event.id === event?.id ? current?.node : undefined;
  const dialogueId = context.dialogueId ?? node?.dialogueId ?? (node?.kind === 'dialogue' ? node.elementId : undefined);
  const dialogue = event?.dialogues?.find(item => item.id === dialogueId);
  const branch = project.branches.find(item => item.id === context.nodeId);
  const sequence = context.sequenceId ? project.sequences.find(item => item.id === context.sequenceId)
    : project.sequences.find(item => item.id === context.nodeId || event && item.eventIds.includes(event.id)
      || branch && (item.branchIds?.includes(branch.id) || branch.eventIds.some(id => item.eventIds.includes(id))));
  const branchIds = new Set(project.branches.filter(item => item.id === branch?.id || event && (item.eventIds.includes(event.id) || event.branchRef === item.id)).map(item => item.id));
  const contextIds = new Set<string>([context.nodeId, node?.id, node?.elementId, event?.id, dialogue?.id, sequence?.id].filter((id): id is string => Boolean(id)));
  const nearbyIds = new Set<string>();
  const connectedRoutes = project.events.flatMap(item => item.transitions ?? []).filter(route => contextIds.has(route.from) || contextIds.has(route.to));
  const currentRoute = event?.transitions?.find(route => route.id === context.nodeId);
  if (currentRoute && !connectedRoutes.includes(currentRoute)) connectedRoutes.push(currentRoute);
  connectedRoutes.forEach(route => { if (!contextIds.has(route.from)) nearbyIds.add(route.from); if (!contextIds.has(route.to)) nearbyIds.add(route.to); });
  // Sequence entry edges are document links too, although not stored as transitions.
  if (sequence && contextIds.has(sequence.id) && !contextIds.has(sequence.entryEventId)) nearbyIds.add(sequence.entryEventId);
  if (branch) branch.eventIds.forEach(id => { if (!contextIds.has(id)) nearbyIds.add(id); });
  for (const reference of references) if (nearbyIds.has(reference.node.id)) nearbyIds.add(reference.node.elementId);

  const contextSubjects = new Set<string>(['context:actor', 'context:self', 'context:target']);
  const nearbySubjects = new Set<string>();
  (context.contextEntityIds ?? []).forEach(id => contextSubjects.add(`entity:${id}`));
  const collect = (input: unknown, target: Set<string>, depth = 0) => {
    if (!input || typeof input !== 'object' || depth > 70) return;
    if (Array.isArray(input)) { input.forEach(item => collect(item, target, depth + 1)); return; }
    const record = input as Record<string, unknown>;
    if (record.subject && typeof record.subject === 'object' && 'kind' in record.subject) target.add(logicSubjectKey(record.subject as LogicSubject));
    if (typeof record.entityId === 'string') target.add(`entity:${record.entityId}`);
    if (typeof record.instanceId === 'string') target.add(`instance:${record.instanceId}`);
    if (typeof record.variableId === 'string') target.add(`variable:${record.variableId}`);
    if (typeof record.useId === 'string') target.add(`interaction:${record.useId}`);
    for (const name of ['canonRefs', 'presentEntityRefs', 'requiredCanonRefs', 'characterRefs']) {
      if (Array.isArray(record[name])) (record[name] as unknown[]).forEach(id => { if (typeof id === 'string') target.add(`entity:${id}`); });
    }
    for (const name of ['characterRef', 'speakerRef', 'locationRef']) if (typeof record[name] === 'string') target.add(`entity:${record[name]}`);
    // Read authored logic and mechanic operands, not arbitrary data-object values or nested siblings.
    for (const name of ['logic', 'availability', 'conditions', 'displayCondition', 'consequences', 'when', 'then', 'rules', 'narrativeEffects', 'all', 'any', 'not', 'filters', 'owner', 'query', 'skill', 'mechanic', 'results', 'effects']) collect(record[name], target, depth + 1);
  };
  const collectNode = (reference: typeof references[number], target: Set<string>) => {
    const { event: owner, node: item } = reference;
    collect(item.beat, target); collect(item.block, target);
    if (item.kind === 'dialogue') collect(owner.dialogues?.find(candidate => candidate.id === item.elementId), target);
    if (item.decisionId || item.kind === 'decision') {
      const decision = owner.decisions?.find(candidate => candidate.id === (item.decisionId ?? item.elementId));
      collect(decision, target);
      if (item.kind === 'outcome') collect(decision?.outcomes.find(candidate => candidate.id === item.elementId), target);
    }
  };
  collect(event, contextSubjects); collect(dialogue, contextSubjects); collect(sequence, contextSubjects); collect(branch, contextSubjects);
  if (node && event) collectNode({ event, node }, contextSubjects);
  for (const use of event?.interactionUses ?? []) {
    if (factsOwnUse(use.ownerNodeId, use.dialogueId, use.id, event?.id, contextIds)) {
      contextSubjects.add(`interaction:${use.id}`);
      collect(event?.interactionDefinitions?.find(definition => definition.id === use.definitionId), contextSubjects);
    } else if (use.ownerNodeId && nearbyIds.has(use.ownerNodeId)) {
      nearbySubjects.add(`interaction:${use.id}`);
      collect(event?.interactionDefinitions?.find(definition => definition.id === use.definitionId), nearbySubjects);
    }
  }
  connectedRoutes.forEach(route => collect(route, contextSubjects));
  references.filter(reference => nearbyIds.has(reference.node.id) || nearbyIds.has(reference.node.elementId)).forEach(reference => collectNode(reference, nearbySubjects));
  project.events.filter(item => nearbyIds.has(item.id)).forEach(item => collect(item, nearbySubjects));
  for (const instance of project.entityInstances ?? []) {
    if (contextSubjects.has(`entity:${instance.entityId}`)) contextSubjects.add(`instance:${instance.id}`);
    else if (nearbySubjects.has(`entity:${instance.entityId}`)) nearbySubjects.add(`instance:${instance.id}`);
  }
  const groupFor = (id: string, ownerEventId?: string): ConditionCandidate['group'] => contextSubjects.has(id) || contextIds.has(id) ? 'context'
    : nearbySubjects.has(id) || nearbyIds.has(id) || Boolean(ownerEventId && ownerEventId === event?.id) ? 'nearby' : 'all';
  return { event, node, dialogue, sequence, branchIds, contextIds, nearbyIds, contextSubjects, nearbySubjects, groupFor };
}

function factsOwnUse(ownerNodeId: string | undefined, dialogueId: string | undefined, useId: string, eventId: string | undefined, ids: Set<string>): boolean {
  return Boolean(ownerNodeId && ids.has(ownerNodeId) || dialogueId && ids.has(dialogueId) || ids.has(useId) || eventId && ids.has(`interaction:${eventId}:${useId}`));
}

function objectInScope(object: ProjectDataObject, facts: ReturnType<typeof contextFacts>): boolean {
  const scope = object.scope;
  if (!scope || scope.global) return true;
  return (!scope.sequenceId || scope.sequenceId === facts.sequence?.id)
    && (!scope.eventId || scope.eventId === facts.event?.id)
    && (!scope.branchId || facts.branchIds.has(scope.branchId));
}

/** Eligible references only. Missing current selections remain a UI fallback, not a new candidate. */
export function buildConditionCandidates(project: BranchingProject, kind: ConditionKind, options: {
  context?: ConditionAuthoringContext; locale?: Locale; copyFilter?: boolean;
  /** Data-reference value pickers also reuse the scoped object-existence catalog. */
  includeDataObjects?: boolean;
} = {}): ConditionCandidate[] {
  const locale = options.locale ?? 'es', es = locale === 'es';
  const facts = contextFacts(project, options.context ?? {});
  const candidates: ConditionCandidate[] = [];
  const add = (candidate: ConditionCandidate) => { if (!candidates.some(item => item.id === candidate.id)) candidates.push(candidate); };
  if (kind === 'visited' && !options.copyFilter) {
    const addProgress = (targetType: Extract<LogicSubject, { kind: 'progress' }>['targetType'], targetId: string, label: string, detail: string, ownerEventId?: string) => {
      const subject: LogicSubject = { kind: 'progress', targetType, targetId }, id = logicSubjectKey(subject);
      const group = facts.contextIds.has(targetId) || facts.contextSubjects.has(id) ? 'context'
        : facts.nearbyIds.has(targetId) ? 'nearby' : facts.groupFor(id, ownerEventId);
      const isCurrentEvent = targetType === 'event' && facts.event?.id === targetId;
      add({ id, label: isCurrentEvent ? `${es ? 'Este evento' : 'This event'} · ${label}` : label,
        detail: isCurrentEvent ? (es ? 'Evento actual' : 'Current event') : detail,
        icon: 'Footprints', subject, group, priority: isCurrentEvent ? -100 : undefined });
    };
    project.sequences.forEach(sequence => addProgress('sequence', sequence.id, sequence.name, es ? 'Secuencia' : 'Sequence'));
    project.branches.forEach(branch => addProgress('branch', branch.id, branch.title, es ? 'Rama' : 'Branch'));
    project.events.forEach(event => {
      const sequenceNames = project.sequences.filter(sequence => sequence.eventIds.includes(event.id)).map(sequence => sequence.name);
      addProgress('event', event.id, event.name, [...sequenceNames, es ? 'Evento' : 'Event'].join(' › '), event.id);
      for (const decision of event.decisions ?? []) {
        addProgress('decision', decision.id, decision.name, [event.name, es ? 'Decisiones' : 'Decisions'].join(' › '), event.id);
        decision.outcomes.forEach(outcome => addProgress('outcome', outcome.id, outcome.visibleText || outcome.name, [event.name, decision.name, es ? 'Opción' : 'Option'].join(' › '), event.id));
      }
    });
  } else if (kind === 'instanceQuery' && !options.copyFilter) {
    for (const option of logicSubjectOptions(project)) if (option.subject.kind === 'entity' && entityCapabilities(project, option.subject.entityId).inventoryItem) {
      add({ id: option.key, label: option.label, detail: [referenceDetail(project, option.subject, locale, option.detail), es ? 'Copias de esta entidad' : 'Copies of this entity'].join(' · '), icon: option.icon ?? 'PackageSearch', entityId: option.subject.entityId, subject: option.subject, group: facts.groupFor(option.key) });
    }
  } else if (kind === 'state' || kind === 'property' || kind === 'value' || kind === 'external') {
    for (const option of logicSubjectOptions(project)) {
      if (options.copyFilter && !(option.subject.kind === 'context' && option.subject.role === 'self')) continue;
      if (kind === 'property' && !options.copyFilter && option.subject.kind === 'context') continue;
      // A story state check names its entity explicitly; action roles are not narrative entities.
      if (kind === 'state' && !options.copyFilter && !['entity', 'instance'].includes(option.subject.kind)
        && !(options.includeDataObjects && option.subject.kind === 'dataObject')) continue;
      if (option.subject.kind === 'dataObject') {
        // Keep scope matching separate from capability matching: a readable field in another event is not a candidate here.
        const dataObject = project.projectDataObjects?.find(item => option.subject.kind === 'dataObject' && item.id === option.subject.objectId);
        if (!dataObject || !objectInScope(dataObject, facts)) continue;
      }
      const fields = logicFieldOptions(project, option.subject, 'condition').filter(field => field.kind === kind && field.status === 'enabled');
      if (!fields.length) continue;
      const label = option.subject.kind === 'context' ? (es ? { actor: 'Actor', self: 'Esta entidad / copia', target: 'Destinatario' } : { actor: 'Actor', self: 'This entity / copy', target: 'Recipient' })[option.subject.role] : option.label;
      const detail = option.subject.kind === 'context' ? es ? 'Contexto de la acción' : 'Action context'
        : option.subject.kind === 'dataObject' ? [es ? 'Objeto de datos' : 'Data object', project.projectDataObjects?.find(item => option.subject.kind === 'dataObject' && item.id === option.subject.objectId)?.classId].filter(Boolean).join(' · ')
        : option.subject.kind === 'variable' ? [es ? 'Variable' : 'Variable', project.logicVariables?.find(item => option.subject.kind === 'variable' && item.id === option.subject.variableId)?.type].filter(Boolean).join(' · ')
        : referenceDetail(project, option.subject, locale, option.detail);
      add({ id: option.key, label, detail, icon: option.icon ?? kinds[locale].find(item => item.id === kind)?.icon, subject: option.subject,
        entityId: option.subject.kind === 'entity' ? option.subject.entityId : undefined, group: facts.groupFor(option.key) });
    }
  }
  return rankConditionCandidates(candidates);
}

/** Search score first; context/nearby, recency and the stable ID break ties. */
export function rankConditionCandidates(candidates: readonly ConditionCandidate[], query = '', recentIds: readonly string[] = []): ConditionCandidate[] {
  const normalized = normalizeSearch(query), tokens = normalized.split(' ').filter(Boolean);
  const groupRank = { context: 0, nearby: 1, all: 2 };
  const recentRank = (id: string) => { const index = recentIds.indexOf(id); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const score = (candidate: ConditionCandidate) => {
    if (!normalized) return 0;
    const label = normalizeSearch(candidate.label), detail = normalizeSearch(candidate.detail), id = normalizeSearch(candidate.id);
    if (!tokens.every(token => `${label} ${detail} ${id}`.includes(token))) return Number.MAX_SAFE_INTEGER;
    return label === normalized ? 0 : label.startsWith(normalized) ? 1 : label.includes(normalized) ? 2 : tokens.every(token => label.includes(token)) ? 3 : 4;
  };
  const seen = new Set<string>();
  return candidates.filter(candidate => { if (seen.has(candidate.id) || score(candidate) === Number.MAX_SAFE_INTEGER) return false; seen.add(candidate.id); return true; })
    .sort((left, right) => score(left) - score(right) || groupRank[left.group] - groupRank[right.group] || (left.priority ?? 0) - (right.priority ?? 0) || recentRank(left.id) - recentRank(right.id)
      || left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
}

const recentMemory = new Map<string, string[]>();
const recentKey = (projectId: string, category: string) => `pathbranching:condition-recents:v1:${JSON.stringify([projectId, category])}`;
function validRecents(input: unknown): string[] {
  return Array.isArray(input) ? [...new Set(input.filter((value): value is string => typeof value === 'string' && Boolean(value)))].slice(0, 12) : [];
}
export function readConditionRecents(projectId: string, category: string): string[] {
  const key = recentKey(projectId, category);
  const memory = recentMemory.get(key);
  if (memory) return [...memory];
  try {
    const saved = globalThis.localStorage?.getItem(key);
    if (saved !== undefined && saved !== null) { const values = validRecents(JSON.parse(saved)); recentMemory.set(key, values); return [...values]; }
  } catch { /* Unavailable or malformed browser storage cannot block selecting references. */ }
  return [...(recentMemory.get(key) ?? [])];
}
/** Personal picker history lives outside the story, isolated by project and category. */
export function writeConditionRecent(projectId: string, category: string, candidateId: string): string[] {
  const key = recentKey(projectId, category);
  const values = validRecents([candidateId, ...readConditionRecents(projectId, category)]);
  recentMemory.set(key, values);
  try { globalThis.localStorage?.setItem(key, JSON.stringify(values)); } catch { /* In-memory recents remain available. */ }
  return [...values];
}
