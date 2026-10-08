import type { AuthoringScenario, BranchingProject, EntityInstance, EntityOwner, LogicSubject, PlayerSimulationState } from './domain.js';
import { authoringCommand, createAuthoringSession, type AuthoringSession, type AuthoringView, type AuthoringTrace } from './authoringEngine.js';
import { conditionValueMatchesType, evaluateConditionDetailed, type ConditionEvaluationResult } from './conditionEvaluation.js';
import { entityCapabilities, entityDefinition, initialAuthoringState, instanceOwnerIssue, resolveContextSubject } from './authoringEntities.js';
import { authoringNodeOptions } from './authoringMutations.js';
import { conditionDiagnosticMessage, conditionTreeSummary } from './conditionPresentation.js';

export type StoryTestKind = 'preview' | 'debug';
export type StoryTestField = { key: string; id: string; label: string; type: string; value: unknown; options?: { value: string; label: string }[] };
export type StoryTestCopy = { id: string; entityId: string; name: string; owner: StoryTestField; properties: StoryTestField[]; states: StoryTestField[]; availableProperties: { id: string; label: string; type: string }[] };
export type StoryTestTrace = Pick<AuthoringTrace, 'kind' | 'nodeId' | 'id' | 'evaluation'> & { message: string; priority?: number; changes: { label: string; before: unknown; after: unknown }[] };
export type StoryTestSnapshot = {
  version: 1; sessionId: string; sequence: number; projectId?: string; locale: 'en' | 'es'; theme: string;
  active: boolean; paused: boolean; changed: boolean; debugOpen: boolean; status?: AuthoringSession['status'];
  nodeId?: string; visitedNodeIds: string[]; historyCount: number; message?: string; error?: string;
  view?: Omit<AuthoringView, 'choices'> & { speakerName?: string; choices: (AuthoringView['choices'][number] & { summary: string })[] };
  actions: (AuthoringView['actions'][number] & { evaluation: ConditionEvaluationResult })[];
  actionSource: string; actionTarget: string; subjects: { value: string; label: string }[]; scenarioSubjects: { value: string; label: string }[];
  state: PlayerSimulationState; variables: StoryTestField[]; copies: StoryTestCopy[]; trace: StoryTestTrace[];
  scenarioId: string; scenarios: { id: string; name: string }[]; scenario?: AuthoringScenario;
  scenarioState: PlayerSimulationState; scenarioVariables: StoryTestField[]; scenarioCopies: StoryTestCopy[];
  nodes: { id: string; label: string }[]; entities: { id: string; name: string }[];
  selectedNodeId?: string; drafts: Record<string, string>; draftErrors: Record<string, string>; draftEpochs: { run: number; scenario: number };
};
export type StoryTestUiCommand =
  | { type: 'play' | 'pause' | 'stop' | 'continue' | 'back' | 'applyRunDrafts' | 'applyScenarioDrafts' | 'deleteScenario' }
  | { type: 'start' | 'restart'; fromSelection?: boolean }
  | { type: 'choose'; outcomeId: string }
  | { type: 'action'; actionId: string }
  | { type: 'actionContext'; source?: string; target?: string }
  | { type: 'debug'; open: boolean }
  | { type: 'scenario'; id: string }
  | { type: 'createScenario'; fromRun?: boolean }
  | { type: 'updateScenario'; patch: Partial<AuthoringScenario> }
  | { type: 'editDraft'; key: string; value: string; draftEpoch?: number }
  | { type: 'discardDrafts'; scope: 'run' | 'scenario' }
  | { type: 'scenarioCopy'; operation: 'add' | 'remove'; id: string }
  | { type: 'copyProperty'; scope: 'run' | 'scenario'; copyId: string; propertyId: string; inherit?: boolean }
  | { type: 'locate'; nodeId?: string };
export type StoryTestRequest = { version: 1; sessionId: string; expectedSequence: number; commandId: string; command: StoryTestUiCommand };
export type StoryTestControllerOptions = { onUpdate?: (project: BranchingProject) => void; onLocate?: (nodeId: string) => void; locale?: 'en' | 'es'; theme?: string; selectedNodeId?: string; documentKey?: string };

export function storyTestSubjectValue(subject: LogicSubject | EntityOwner | undefined): string {
  if (!subject) return '';
  const keys = Object.keys(subject).filter(key => key !== 'kind').sort();
  return JSON.stringify(Object.fromEntries([['kind', subject.kind], ...keys.map(key => [key, (subject as unknown as Record<string, unknown>)[key]])]));
}
const encode = (value: unknown, type: string) => value === undefined ? '' : type === 'owner' ? storyTestSubjectValue(value as EntityOwner) : ['text', 'string', 'date', 'select', 'canonRef', 'entity-ref'].includes(type) ? String(value) : JSON.stringify(value);
function decode(text: string, type: string): unknown {
  if (type === 'owner') return text ? JSON.parse(text) : undefined;
  if (type === 'state') return text === 'inherit' || !text ? undefined : JSON.parse(text);
  if (['number', 'integer', 'float'].includes(type)) { if (!text.trim()) throw new Error('Enter a finite number'); return Number(text); }
  if (['boolean', 'bool', 'list', 'multiselect', 'multiSelect', 'entity-ref-list', 'canonRefList', 'dataRefList'].includes(type)) return JSON.parse(text);
  return text;
}

/** Track all document inputs; authoring layout and presentation preferences do not change a run. */
function storyTestRevision(project: BranchingProject | undefined): string {
  if (!project) return '';
  const narrative = { ...project };
  delete narrative.canvas; delete narrative.panels; delete narrative.authoringPreferences;
  return JSON.stringify(narrative, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
}

/** The editor owns this controller. Views and auxiliary windows receive only its projection. */
export class StoryTestController {
  private project?: BranchingProject;
  private documentRevision: string;
  private options: StoryTestControllerOptions;
  private session?: AuthoringSession;
  private runProject?: BranchingProject;
  private runRevision?: string;
  private sessionId = crypto.randomUUID();
  private sequence = 0;
  private paused = false;
  private debugOpen = false;
  private scenarioId = '';
  private source = '';
  private target = '';
  private fromSelection = false;
  private drafts: Record<string, string> = {};
  private draftErrors: Record<string, string> = {};
  private draftEpochs = { run: 0, scenario: 0 };
  private error?: string;
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot!: StoryTestSnapshot;
  constructor(project?: BranchingProject, options: StoryTestControllerOptions = {}) {
    this.project = project; this.documentRevision = storyTestRevision(project); this.options = options;
    this.scenarioId = project?.authoringScenarios?.[0]?.id ?? '';
    this.refresh();
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  updateProject(project?: BranchingProject, options: Partial<StoryTestControllerOptions> = {}) {
    const reset = this.project?.projectId !== project?.projectId || ('documentKey' in options && this.options.documentKey !== options.documentKey);
    const revision = storyTestRevision(project);
    const changed = this.project !== project || revision !== this.documentRevision || Object.entries(options).some(([k,v]) => this.options[k as keyof StoryTestControllerOptions] !== v);
    this.project = project; this.documentRevision = revision; this.options = { ...this.options, ...options };
    if (reset) { this.clear(); this.scenarioId = project?.authoringScenarios?.[0]?.id ?? ''; }
    if (this.isChanged()) this.paused = true;
    if (changed) this.publish();
  }
  request = (request: StoryTestRequest): boolean => {
    if (request.version !== 1 || request.sessionId !== this.sessionId || !request.commandId) return false;
    if (this.seen.has(request.commandId)) return true;
    if (request.expectedSequence !== this.sequence) return false;
    this.seen.add(request.commandId);
    if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!);
    return this.dispatch(request.command);
  };
  dispatch = (command: StoryTestUiCommand): boolean => {
    if (command.type === 'editDraft' && command.draftEpoch !== undefined) {
      const scope = command.key.startsWith('run:') ? 'run' : command.key.startsWith('scenario:') ? 'scenario' : undefined;
      if (!scope || command.draftEpoch !== this.draftEpochs[scope]) return false;
    }
    try {
      this.error = undefined;
      const project = this.project;
      if (command.type === 'stop') this.clear();
      else if (command.type === 'debug') this.debugOpen = command.open;
      else if (command.type === 'locate') { const id = command.nodeId ?? this.session?.nodeId; if (id) this.options.onLocate?.(id); }
      else if (command.type === 'editDraft') { this.drafts[command.key] = command.value; delete this.draftErrors[command.key]; }
      else if (command.type === 'discardDrafts') this.discard(command.scope);
      else if (command.type === 'actionContext') { if (command.source !== undefined) this.source = command.source; if (command.target !== undefined) this.target = command.target; }
      else if (command.type === 'pause') this.paused = Boolean(this.session);
      else if (command.type === 'scenario') { this.scenarioId = command.id; this.discard('scenario'); }
      else if (!project) throw new Error(this.es ? 'Abre una historia para probarla.' : 'Open a story to test it.');
      else if (command.type === 'play') {
        if (!this.session) this.start(false);
        else if (this.isChanged()) throw new Error(this.es ? 'Reinicia para probar la nueva revisión.' : 'Restart to test the new revision.');
        else this.paused = false;
      } else if (command.type === 'start' || command.type === 'restart') this.start(command.fromSelection ?? (command.type === 'restart' && this.fromSelection));
      else if (command.type === 'back') { if (this.session) this.session = authoringCommand(this.runProject!, this.session, { type: 'back' }); }
      else if (command.type === 'createScenario') {
        const id = `scenario:${crypto.randomUUID()}`;
        const state = structuredClone(command.fromRun && this.session ? this.session.state : initialAuthoringState(project));
        const scenario: AuthoringScenario = { id, name: `${this.es ? 'Escenario' : 'Scenario'} ${(project.authoringScenarios?.length ?? 0) + 1}`, actor: command.fromRun ? state.context?.actor : this.scenario?.actor, profileId: command.fromRun ? state.context?.profileId : this.scenario?.profileId, state };
        this.commit({ ...project, authoringScenarios: [...(project.authoringScenarios ?? []), scenario] }); this.scenarioId = id; this.debugOpen = true; this.discard('scenario');
      } else if (command.type === 'deleteScenario') { this.commit({ ...project, authoringScenarios: project.authoringScenarios?.filter(s => s.id !== this.scenarioId) }); this.scenarioId = ''; this.discard('scenario'); }
      else if (command.type === 'updateScenario') this.updateScenario(command.patch);
      else if (command.type === 'applyRunDrafts' || command.type === 'applyScenarioDrafts') this.applyDrafts(command.type === 'applyRunDrafts' ? 'run' : 'scenario');
      else if (command.type === 'scenarioCopy') {
        const state = initialAuthoringState(project, this.scenario);
        if (command.operation === 'add') { if (!entityDefinition(project, command.id)) throw new Error('Missing entity'); state.entityInstances = [...(state.entityInstances ?? []), { id: `instance:${crypto.randomUUID()}`, entityId: command.id, properties: {}, states: {} }]; }
        else state.entityInstances = state.entityInstances?.filter(c => c.id !== command.id);
        this.validateState(state); this.updateScenario({ state });
      } else if (command.type === 'copyProperty') {
        if (command.scope === 'run') this.assertCurrent();
        const definitionProject = command.scope === 'run' ? this.runProject! : project;
        const state = command.scope === 'run' ? this.session?.state : initialAuthoringState(project, this.scenario);
        if (!state) throw new Error('Start a run first');
        const copy = state.entityInstances?.find(c => c.id === command.copyId);
        if (!copy) throw new Error('Missing copy');
        const prop = definitionProject.localExplorerProperties?.find(p => p.id === command.propertyId);
        const prefix = `${command.scope}:copy:${copy.id}`;
        const key = `${prefix}:property:${command.propertyId}`;
        const inheritKey = `${prefix}:inherit:${command.propertyId}`;
        if (command.inherit) { this.drafts[inheritKey] = 'true'; delete this.drafts[key]; }
        else if (prop) {
          const value = prop.valueType === 'number' ? 0 : prop.valueType === 'boolean' ? false : ['multiselect', 'entity-ref-list', 'list'].includes(prop.valueType) ? [] : '';
          this.drafts[key] = encode(value, prop.valueType); delete this.drafts[inheritKey];
        } else throw new Error('Missing property');
      } else {
        this.assertCurrent();
        if (this.paused || this.session!.status !== 'ready') throw new Error(this.es ? 'Reanuda el recorrido para continuar.' : 'Resume the run to continue.');
        if (command.type === 'action') {
          const action = this.snapshot.actions.find(a => a.id === command.actionId);
          if (!action || action.reason || action.evaluation.status !== 'satisfied') throw new Error(action?.reason ?? 'Action unavailable');
          this.session = authoringCommand(this.runProject!, this.session!, { type: 'action', actionId: command.actionId, self: this.self(), target: this.target ? JSON.parse(this.target) : undefined });
        } else if (command.type === 'continue') this.session = authoringCommand(this.runProject!, this.session!, { type: 'continue' });
        else if (command.type === 'choose') this.session = authoringCommand(this.runProject!, this.session!, command);
      }
      this.publish(); return true;
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); this.publish(); return false; }
  };
  private get es() { return this.options.locale === 'es'; }
  private get scenario() { return this.project?.authoringScenarios?.find(s => s.id === this.scenarioId); }
  private isChanged() { return Boolean(this.session && this.runRevision !== this.documentRevision); }
  private self(): LogicSubject | undefined { return this.source ? JSON.parse(this.source) : this.session?.state.context?.actor; }
  private assertCurrent() { if (!this.session) throw new Error(this.es ? 'Inicia un recorrido.' : 'Start a run.'); if (this.isChanged()) throw new Error(this.es ? 'La historia cambió. Reinicia para probar la nueva revisión.' : 'The story changed. Restart to test the new revision.'); }
  private start(selected: boolean) {
    if (selected && !this.options.selectedNodeId) throw new Error(this.es ? 'Selecciona un bloque inicial.' : 'Select a starting block.');
    this.fromSelection = selected;
    this.runProject = structuredClone(this.project!);
    this.runRevision = this.documentRevision;
    this.session = createAuthoringSession(this.runProject, this.runProject.authoringScenarios?.find(s => s.id === this.scenarioId), selected ? this.options.selectedNodeId : undefined);
    this.paused = false; this.discard('run');
  }
  private clear() { this.session = undefined; this.runProject = undefined; this.runRevision = undefined; this.paused = false; this.debugOpen = false; this.source = ''; this.target = ''; this.drafts = {}; this.draftErrors = {}; this.draftEpochs = { run: this.draftEpochs.run + 1, scenario: this.draftEpochs.scenario + 1 }; this.error = undefined; this.sessionId = crypto.randomUUID(); this.seen.clear(); }
  private discard(scope: 'run' | 'scenario') { this.draftEpochs[scope]++; for (const key of Object.keys(this.drafts)) if (key.startsWith(`${scope}:`)) { delete this.drafts[key]; delete this.draftErrors[key]; } }
  private commit(project: BranchingProject) { this.options.onUpdate?.(project); this.project = project; this.documentRevision = storyTestRevision(project); if (this.isChanged()) this.paused = true; }
  private updateScenario(patch: Partial<AuthoringScenario>) {
    if (!this.scenario) throw new Error(this.es ? 'Elige o crea un escenario.' : 'Choose or create a scenario.');
    if (patch.name !== undefined && !patch.name.trim()) throw new Error(this.es ? 'El nombre es obligatorio.' : 'A name is required.');
    const next = { ...this.scenario, ...patch, id: this.scenario.id };
    const state = initialAuthoringState(this.project!, next);
    this.validateState(state);
    if (next.actor) this.validateSubject(next.actor, state);
    if (next.startNodeId && !authoringNodeOptions(this.project!).some(n => n.id === next.startNodeId)) throw new Error(this.es ? 'El punto inicial ya no existe.' : 'The starting point no longer exists.');
    this.commit({ ...this.project!, authoringScenarios: this.project!.authoringScenarios?.map(s => s.id === this.scenarioId ? next : s) });
  }
  private validateSubject(subject: LogicSubject, state: PlayerSimulationState, project = this.project!) {
    if (!subject || typeof subject !== 'object' || Array.isArray(subject)) throw new Error('Invalid subject');
    let found = false;
    switch (subject.kind) {
      case 'entity': found = typeof subject.entityId === 'string' && Boolean(entityDefinition(project, subject.entityId)); break;
      case 'instance': found = typeof subject.instanceId === 'string' && Boolean(state.entityInstances?.some(c => c.id === subject.instanceId)); break;
      case 'variable': found = Boolean(project.logicVariables?.some(v => v.id === subject.variableId)); break;
      case 'dataObject': found = Boolean(state.dataObjects?.some(d => d.id === subject.objectId)); break;
      case 'external': found = project.externalFunctions.some(f => f.name === subject.functionId); break;
      case 'progress': {
        const targets = subject.targetType === 'event' ? project.events : subject.targetType === 'sequence' ? project.sequences : subject.targetType === 'branch' ? project.branches : subject.targetType === 'decision' ? project.events.flatMap(e => e.decisions ?? []) : subject.targetType === 'outcome' ? project.events.flatMap(e => (e.decisions ?? []).flatMap(d => d.outcomes)) : [];
        found = targets.some(t => t.id === subject.targetId); break;
      }
      case 'context': {
        if (!['actor','self','target'].includes(subject.role)) break;
        const resolved = resolveContextSubject(subject, state);
        if (resolved) { this.validateSubject(resolved, state, project); found = true; } break;
      }
    }
    if (!found) throw new Error(this.es ? 'La referencia temporal no existe o no puede resolverse.' : 'The temporary reference is missing or cannot be resolved.');
  }
  private validateState(state: PlayerSimulationState, project = this.project!) {
    const object = (value: unknown) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
    if (!object(state)) throw new Error('Expected state object');
    for (const key of ['variables','entityStates','grantableProperties','externalResults','context'] as const) if (state[key] !== undefined && !object(state[key])) throw new Error(`${key}: expected object`);
    for (const key of ['visited','inventory','unlockedCanonRefs'] as const) if (state[key] !== undefined && (!Array.isArray(state[key]) || !state[key]!.every(v => typeof v === 'string'))) throw new Error(`${key}: expected list of references`);
    if (state.entityInstances !== undefined && !Array.isArray(state.entityInstances)) throw new Error('Expected copies list');
    for (const role of ['actor','self','target'] as const) if (state.context?.[role] !== undefined) this.validateSubject(state.context[role]!, state, project);
    for (const [id,overlay] of Object.entries(state.entityStates ?? {})) {
      if (!entityDefinition(project,id)) throw new Error(`Missing entity ${id}`);
      if (!object(overlay) || overlay.states !== undefined && !object(overlay.states) || overlay.properties !== undefined && !object(overlay.properties)) throw new Error(`${id}: invalid state overlay`);
      for (const [key,value] of Object.entries(overlay.states ?? {})) if (typeof value !== 'boolean') throw new Error(`${key}: expected boolean`);
      for (const [key,value] of Object.entries(overlay.properties ?? {})) {
        const property=project.localExplorerProperties?.find(p=>p.id===key||p.id===`property:${key}`);
        const original=entityDefinition(project,id)?.properties[key];
        const type=property?.valueType ?? (Array.isArray(original)?'list':typeof original==='number'?'number':typeof original==='boolean'?'boolean':'text');
        if (!conditionValueMatchesType(value,type)) throw new Error(`${key}: incompatible value`);
      }
    }
    for (const [id,value] of Object.entries(state.externalResults ?? {})) if (typeof value !== 'boolean' || !project.externalFunctions.some(f=>f.name===id)) throw new Error(`${id}: invalid external result`);
    if (state.dataObjects !== undefined && !Array.isArray(state.dataObjects)) throw new Error('Expected data objects list');
    for (const item of state.dataObjects ?? []) {
      const definition=project.dataClasses?.find(c=>c.id===item.classId);
      if (!definition || !object(item.fields)) throw new Error(`${item.id}: invalid data object`);
      for (const [id,value] of Object.entries(item.fields)) { const field=definition.fields.find(f=>f.name===id); if (!field || !conditionValueMatchesType(value,field.type)) throw new Error(`${id}: incompatible data field`); }
    }
    for (const v of project.logicVariables ?? []) if (state.variables && Object.prototype.hasOwnProperty.call(state.variables,v.id) && !conditionValueMatchesType(state.variables[v.id],v.type)) throw new Error(`${v.name}: ${this.es ? 'valor incompatible' : 'incompatible value'}`);
    const copies = state.entityInstances ?? [];
    const ids = new Set<string>();
    for (const copy of copies) {
      if (!object(copy) || typeof copy.id !== 'string' || typeof copy.entityId !== 'string' || copy.owner !== undefined && !object(copy.owner) || copy.properties !== undefined && !object(copy.properties) || copy.states !== undefined && !object(copy.states)) throw new Error('Invalid copy');
      if (ids.has(copy.id)) throw new Error(`Duplicate copy ${copy.id}`); ids.add(copy.id);
      if (copy.owner && !['entity','instance','profile'].includes(copy.owner.kind)) throw new Error('Invalid copy owner');
      const issue = instanceOwnerIssue(project, copies, copy); if (issue) throw new Error(conditionDiagnosticMessage(issue, this.es ? 'es' : 'en'));
      for (const [key,value] of Object.entries(copy.properties ?? {})) {
        const property = project.localExplorerProperties?.find(p => p.id === key || p.id === `property:${key}`);
        const original = entityDefinition(project, copy.entityId)?.properties[key];
        const type = property?.valueType ?? (Array.isArray(original) ? 'list' : typeof original === 'number' ? 'number' : typeof original === 'boolean' ? 'boolean' : original === undefined ? undefined : 'text');
        if (!conditionValueMatchesType(value,type)) throw new Error(`${property?.label ?? key}: incompatible value`);
      }
      for (const [key,value] of Object.entries(copy.states ?? {})) if (typeof value !== 'boolean') throw new Error(`${key}: expected boolean`);
    }
  }
  private applyDrafts(scope: 'run' | 'scenario') {
    if (scope === 'run') this.assertCurrent();
    const project = scope === 'run' ? this.runProject! : this.project!;
    const state = structuredClone(scope === 'run' ? this.session!.state : initialAuthoringState(project, this.scenario));
    const raw = this.drafts[`${scope}:json`];
    if (raw !== undefined) {
      try { const parsed = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected state object'); Object.assign(state,parsed); }
      catch(error) { this.draftErrors[`${scope}:json`] = String(error); throw error; }
    }
    const variables = this.variableFields(state,scope,project);
    const copies = this.copyFields(state,scope,project);
    const fields = [...variables, ...copies.flatMap(c => [c.owner,...c.properties,...c.states])];
    for (const field of fields) {
      const text = this.drafts[field.key]; if (text === undefined) continue;
      try {
        const value = decode(text,field.type);
        if (!['owner','state'].includes(field.type) && !conditionValueMatchesType(value,field.type)) throw new Error(this.es ? 'Valor incompatible.' : 'Incompatible value.');
        const variable = variables.find(v => v.key === field.key);
        if (variable) state.variables = { ...state.variables, [variable.id]: value };
        else {
          const copy = copies.find(c => [c.owner,...c.properties,...c.states].some(f => f.key === field.key))!;
          const instance = state.entityInstances!.find(c => c.id === copy.id)!;
          if (field.type === 'owner') instance.owner = value as EntityOwner | undefined;
          else { const bag = copy.states.some(f => f.key === field.key) ? 'states' : 'properties'; const next = { ...instance[bag] } as Record<string, unknown>; if (value === undefined) delete next[field.id]; else next[field.id] = value; (instance as unknown as Record<string, unknown>)[bag] = next; }
        }
      } catch(error) { this.draftErrors[field.key] = error instanceof Error ? error.message : String(error); throw error; }
    }
    for (const copy of state.entityInstances ?? []) {
      const prefix = `${scope}:copy:${copy.id}:inherit:`;
      for (const key of Object.keys(this.drafts)) if (key.startsWith(prefix)) {
        copy.properties = { ...copy.properties }; delete copy.properties[key.slice(prefix.length)];
      }
    }
    this.validateState(state,project);
    if (scope === 'run') this.session = authoringCommand(project, this.session!, { type: 'setState', state });
    else {
      const name = this.drafts['scenario:name'] ?? this.scenario?.name;
      const actor = this.drafts['scenario:actor']; const startNodeId = this.drafts['scenario:start'];
      const patch: Partial<AuthoringScenario> = { state, ...(name !== undefined ? { name } : {}), ...(actor !== undefined ? { actor: actor ? JSON.parse(actor) : undefined } : {}), ...(startNodeId !== undefined ? { startNodeId: startNodeId || undefined } : {}) };
      this.updateScenario(patch);
    }
    this.discard(scope);
  }
  private variableFields(state: PlayerSimulationState, scope: string, project = this.project): StoryTestField[] { return (project?.logicVariables ?? []).map(v => ({ id:v.id,key:`${scope}:variable:${v.id}`,label:v.name,type:v.type,value:state.variables?.[v.id] ?? v.value })); }
  private copyFields(state: PlayerSimulationState, scope: string, project = this.project): StoryTestCopy[] {
    if (!project) return [];
    const entityIds = [...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)];
    const owners = [{ value: JSON.stringify({ kind:'profile',profileId:'default' }),label:this.es?'Protagonista':'Protagonist' }, ...(project.playerProfiles ?? []).filter(p=>p.id!=='default').map(p=>({value:JSON.stringify({kind:'profile',profileId:p.id}),label:p.name})), ...entityIds.filter(id=>entityCapabilities(project,id).container).map(id=>({value:JSON.stringify({kind:'entity',entityId:id}),label:entityDefinition(project,id)?.name ?? id})), ...(state.entityInstances ?? []).filter(c=>entityCapabilities(project,c.entityId).container).map(c=>({value:JSON.stringify({kind:'instance',instanceId:c.id}),label:c.name ?? entityDefinition(project,c.entityId)?.name ?? c.id}))];
    return (state.entityInstances ?? []).map(copy => {
      const definition=entityDefinition(project,copy.entityId); const prefix=`${scope}:copy:${copy.id}`;
      const keys=new Set([...Object.keys(definition?.properties ?? {}).filter(k=>!['id','name','type','kind','aliases','tags','status'].includes(k)),...Object.keys(copy.properties ?? {})]);
      const draftPrefix = `${prefix}:property:`;
      for (const key of Object.keys(this.drafts)) if (key.startsWith(draftPrefix)) keys.add(key.slice(draftPrefix.length));
      const properties=[...keys].map(id=>{ const value=Object.prototype.hasOwnProperty.call(copy.properties ?? {},id)?copy.properties![id]:definition?.properties[id]; const p=project.localExplorerProperties?.find(p=>p.id===id || p.id===`property:${id}`); return { id,key:`${prefix}:property:${id}`,label:p?.label ?? id,type:p?.valueType ?? (Array.isArray(value)?'list':typeof value==='number'?'number':typeof value==='boolean'?'boolean':'text'),value }; });
      const roles=Object.entries(entityCapabilities(project,copy.entityId).runtimeRoles).filter(([,on])=>on).map(([id])=>id);
      return {id:copy.id,entityId:copy.entityId,name:copy.name ?? definition?.name ?? copy.id,owner:{id:'owner',key:`${prefix}:owner`,label:this.es?'Pertenece a':'Owned by',type:'owner',value:copy.owner,options:owners},properties,states:[...new Set([...roles,...Object.keys(copy.states ?? {})])].filter(id=>id!=='owned').map(id=>({id,key:`${prefix}:state:${id}`,label:id,type:'state',value:copy.states?.[id]})),availableProperties:(project.localExplorerProperties ?? []).filter(p=>!['group','entity-type'].includes(p.valueType)&&(!p.appliesToTypes?.length||p.appliesToTypes.some(t=>t.replace(/^type:/,'')===definition?.typeId?.replace(/^type:/,'')))).filter(p=>!keys.has(p.id)).map(p=>({id:p.id,label:p.label,type:p.valueType}))};
    });
  }
  private publish() { this.sequence++; this.refresh(); for (const listener of this.listeners) listener(); }
  private refresh() {
    const editingProject=this.project; const project=this.runProject ?? editingProject; const scenarioState=editingProject?initialAuthoringState(editingProject,this.scenario):{};
    const state=this.session?.state ?? scenarioState; const nodes=project?authoringNodeOptions(project):[];
    const entities=project?[...project.canonRefs.map(e=>e.id),...(project.localExplorerEntities ?? []).map(e=>e.id)].map(id=>({id,name:entityDefinition(project,id)?.name ?? id})):[];
    let self: LogicSubject | undefined; let recipient: LogicSubject | undefined;
    try { self=this.self(); recipient=this.target?JSON.parse(this.target):undefined; } catch { /* Invalid draft stays visible; execution validates below. */ }
    const resolved= self?resolveContextSubject(self,state):undefined;
    const entityId=resolved?.kind==='entity'?resolved.entityId:resolved?.kind==='instance'?state.entityInstances?.find(c=>c.id===resolved.instanceId)?.entityId:undefined;
    const definition=project&&entityId?entityDefinition(project,entityId):undefined;
    const actions=(this.session?.view.actions ?? []).filter(a=>{ const d=project?.narrativeActions?.find(d=>d.id===a.id); return d&&d.enabled!==false&&(!d.entityId||d.entityId===entityId)&&(!d.typeId||d.typeId.replace(/^type:/,'')===definition?.typeId?.replace(/^type:/,''))&&(!d.source||d.source===definition?.source)&&!project?.narrativeActions?.some(o=>o.entityId===entityId&&o.overridesActionId===d.id); }).map(a=>{
      const d=project!.narrativeActions!.find(d=>d.id===a.id)!; const evaluation=evaluateConditionDetailed(d.when,project!,{...state,context:{...state.context,self,target:recipient}});
      const needsCopy=d.effects?.some(e=>e.type==='instanceEffect'&&e.instanceId==='@self')&&resolved?.kind!=='instance';
      const reason=needsCopy?(this.es?'Elige una copia como origen de la acción.':'Choose a copy as the action source.'):a.requiresTarget&&!recipient?(this.es?'Elige un destinatario.':'Choose a recipient.'):evaluation.status!=='satisfied'?conditionDiagnosticMessage(evaluation.message,this.es?'es':'en'):undefined;
      return {...a,reason,status:evaluation.status,evaluation};
    });
    const trace=(this.session?.trace ?? []).map(t=>{
      const names=new Map(nodes.map(n=>[n.id,n.label]));
      let message=t.message.split(' → ').map(id=>names.get(id) ?? id).join(' → ');
      if(this.es&&message==='Returned to the interrupted content')message='Regreso al contenido interrumpido';
      if(this.es&&/^\d+ effects applied$/.test(message))message=message.replace('effects applied','consecuencias aplicadas');
      const changes: StoryTestTrace['changes']=[];
      if(t.before&&t.after){for(const key of new Set([...Object.keys(t.before.variables ?? {}),...Object.keys(t.after.variables ?? {})]))if(JSON.stringify(t.before.variables?.[key])!==JSON.stringify(t.after.variables?.[key]))changes.push({label:project?.logicVariables?.find(v=>v.id===key)?.name ?? key,before:t.before.variables?.[key],after:t.after.variables?.[key]});
        for(const copy of t.after.entityInstances ?? []){const old=t.before.entityInstances?.find(c=>c.id===copy.id);if(JSON.stringify(old)!==JSON.stringify(copy))changes.push({label:copy.name ?? (project?entityDefinition(project,copy.entityId)?.name:undefined) ?? copy.id,before:old,after:copy});}for(const copy of t.before.entityInstances ?? [])if(!t.after.entityInstances?.some(c=>c.id===copy.id))changes.push({label:copy.name ?? copy.id,before:copy,after:undefined});
        for(const key of ['entityStates','visited','dataObjects','externalResults'] as const)if(JSON.stringify(t.before[key])!==JSON.stringify(t.after[key]))changes.push({label:key,before:t.before[key],after:t.after[key]});
      }
      return {kind:t.kind,id:t.id,nodeId:t.nodeId,evaluation:t.evaluation,message,priority:t.kind==='rule'?project?.narrativeRules?.find(r=>r.id===t.id)?.priority ?? 0:undefined,changes};
    });
    const subjectOptions = (source: PlayerSimulationState) => [
      ...entities.map(e => ({ value: JSON.stringify({ kind: 'entity', entityId: e.id }), label: e.name })),
      ...(source.entityInstances ?? []).map(c => ({
        value: JSON.stringify({ kind: 'instance', instanceId: c.id }),
        label: `${c.name ?? entities.find(e => e.id === c.entityId)?.name ?? c.id} · ${this.es ? 'copia' : 'copy'}`,
      })),
    ];
    this.snapshot = {
      version: 1, sessionId: this.sessionId, sequence: this.sequence, projectId: project?.projectId,
      locale: this.options.locale ?? 'en', theme: this.options.theme ?? 'worldnotion-dark',
      active: Boolean(this.session), paused: this.paused, changed: this.isChanged(), debugOpen: this.debugOpen,
      status: this.session?.status, nodeId: this.session?.nodeId, visitedNodeIds: this.session?.visitedNodeIds ?? [],
      historyCount: this.session?.history.length ?? 0, message: this.session?.message, error: this.error,
      view: this.session ? {
        ...this.session.view,
        speakerName: project && this.session.view.speakerRef ? entityDefinition(project, this.session.view.speakerRef)?.name ?? this.session.view.speakerRef : undefined,
        choices: this.session.view.choices.map(c => ({
          ...c,
          summary: project ? conditionTreeSummary(project, project.events.flatMap(e => e.decisions ?? []).flatMap(d => d.outcomes).find(o => o.id === c.id)?.logic?.when, this.es ? 'es' : 'en', 1000).text : '',
        })),
      } : undefined,
      actions, actionSource: this.source, actionTarget: this.target, subjects: subjectOptions(state),
      scenarioSubjects: subjectOptions(scenarioState), state: structuredClone(state),
      variables: this.variableFields(state, 'run', project), copies: this.copyFields(state, 'run', project), trace,
      scenarioId: this.scenarioId, scenarios: (editingProject?.authoringScenarios ?? []).map(s => ({ id: s.id, name: s.name })),
      scenario: this.scenario ? structuredClone(this.scenario) : undefined,
      scenarioState, scenarioVariables: this.variableFields(scenarioState, 'scenario'), scenarioCopies: this.copyFields(scenarioState, 'scenario'),
      nodes: (editingProject ? authoringNodeOptions(editingProject) : []).map(n => ({ id: n.id, label: n.label })), entities,
      selectedNodeId: this.options.selectedNodeId, drafts: { ...this.drafts }, draftErrors: { ...this.draftErrors }, draftEpochs: { ...this.draftEpochs },
    };
  }
}

export const storyTestFieldText = (field: StoryTestField) => field.type === 'state' ? field.value === undefined ? 'inherit' : String(field.value) : encode(field.value,field.type);
