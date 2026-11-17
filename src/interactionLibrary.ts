import type { BranchingProject, InteractionDefinition, InteractionDice, InteractionMechanicPreset, InteractionMechanicsLibrary, InteractionResult, InteractionUse } from './domain.js';
import type { UniverseFile } from './pathBranchingWorkspace.js';
import { addInteraction } from './interactionMutations.js';
import { updateEvent, type MutationResult } from './projectMutations.js';
import { interactionDefinitionIssues } from './interactions.js';
import { narrativeNodeReferences } from './authoringMutations.js';
import { diceBounds, diceFormula, dicePoolForMechanic, interactionPresetKind } from './interactionDice.js';

export const interactionMechanicsPath = '.everend/.pathbranching/interaction-mechanics.json';
/** New authoring starts with the entire roll domain, without an invented success threshold. */
export function plainDiceResults(id: string, count = 1, sides = 20, modifier = 0): InteractionResult[] {
  return [{ id: `${id}:completed`, name: 'Completada', range: { min: count + modifier, max: count * sides + modifier } }];
}
export function defaultInteractionMechanicsLibrary(): InteractionMechanicsLibrary {
  const results = (opposed = false): InteractionResult[] => opposed
    ? [{ id: 'success', name: 'Victoria', key: 'success' }, { id: 'failure', name: 'Derrota', key: 'failure' }, { id: 'tie', name: 'Empate', key: 'tie' }]
    : [{ id: 'success', name: 'Éxito', key: 'success' }, { id: 'failure', name: 'Fallo', key: 'failure' }];
  const preset = (id: string, name: string, description: string, mechanic: InteractionDefinition['mechanic'], outcomes: InteractionResult[]): InteractionMechanicPreset =>
    ({ id: `builtin-${id}`, revision: 1, name, description, builtIn: true, mechanic, results: outcomes });
  return { version: 1, presets: [
    ...[9, 20, 100, 4, 6, 8, 10, 12].map(sides => preset(`d${sides}`, `D${sides}`, `1D${sides} · tirada libre`,
      { kind: 'dice', count: 1, sides, modifier: 0 }, [{ id: 'completed', name: 'Completada', range: { min: 1, max: sides } }])),
    preset('d0-1', 'Dado 0–1', 'Dado binario con resultados posibles 0 o 1.', { kind: 'dice', count: 1, sides: 2, minimum: 0, modifier: 0 }, [{ id: 'completed', name: 'Completada', range: { min: 0, max: 1 } }]),
    preset('2d6', '2D6', 'Dos dados de seis caras; suma de 2 a 12.', { kind: 'dice', count: 2, sides: 6, modifier: 0 }, [{ id: 'completed', name: 'Completada', range: { min: 2, max: 12 } }]),
    preset('2d4-1d2', '2D4 + 1D2', 'Tres dados; suma de 3 a 10.', { kind: 'dice', count: 2, sides: 4, groups: [{ id: 'd4', count: 2, sides: 4 }, { id: 'd2', count: 1, sides: 2 }], modifier: 0 }, [{ id: 'completed', name: 'Completada', range: { min: 3, max: 10 } }]),
    preset('2d10-3d9', '2D10 + 3D9', 'Cinco dados; suma de 5 a 47.', { kind: 'dice', count: 2, sides: 10, groups: [{ id: 'd10', count: 2, sides: 10 }, { id: 'd9', count: 3, sides: 9 }], modifier: 0 }, [{ id: 'completed', name: 'Completada', range: { min: 5, max: 47 } }]),
    ...[{ id: 'skill-easy', name: 'Prueba de habilidad · Fácil', difficulty: 8 }, { id: 'skill-standard', name: 'Prueba de habilidad · Estándar', difficulty: 12 }, { id: 'skill-hard', name: 'Prueba de habilidad · Difícil', difficulty: 16 }].map(item => preset(item.id, item.name, `Prueba D20 con dificultad ${item.difficulty}; asigna el atributo en cada uso.`,
      { kind: 'skillcheck', actor: { kind: 'context', role: 'actor' }, difficulty: item.difficulty, difficultyOperator: '>=', modifier: 0, dice: { count: 1, sides: 20 } }, results())),
    ...[{ id: 'qte-space', name: 'QTE · Reacción', key: 'Space', durationMs: 3000 },
      { id: 'qte-e', name: 'QTE · Activar', key: 'KeyE', durationMs: 5000 },
      { id: 'qte-enter', name: 'QTE · Confirmar', key: 'Enter', durationMs: 1500 }].map(item => preset(item.id, item.name, `${item.key} en ${item.durationMs / 1000} segundos.`,
        { kind: 'qte', key: item.key, durationMs: item.durationMs }, [...results(), { id: 'timeout', name: 'Tiempo agotado', key: 'timeout' }])),
    preset('custom-agreement', 'Personalizada · Acuerdo', 'Resolución manual: aceptar, rechazar o posponer.', { kind: 'custom', description: 'Selecciona el resultado del acuerdo.' },
      [{ id: 'accept', name: 'Aceptado' }, { id: 'reject', name: 'Rechazado' }, { id: 'defer', name: 'Pospuesto' }]),
    preset('custom-riddle', 'Personalizada · Enigma', 'Resolución manual: respuesta correcta, parcial o incorrecta.', { kind: 'custom', description: 'Evalúa la respuesta al enigma y selecciona el resultado.' },
      [{ id: 'correct', name: 'Correcta' }, { id: 'partial', name: 'Parcial' }, { id: 'incorrect', name: 'Incorrecta' }]),
    preset('custom-assessment', 'Personalizada · Evaluación', 'Resolución manual: éxito, fallo o empate.', { kind: 'custom', description: 'Selecciona el resultado de la evaluación.' }, results(true)),
  ] };
}
/** Explicitly adds missing templates; never replaces an edited preset or restores deletions on load. */
export function addInteractionTemplates(library: InteractionMechanicsLibrary, templateIds: readonly string[]): InteractionMechanicsLibrary {
  const existing = new Set(library.presets.map(preset => preset.id));
  const requested = new Set(templateIds);
  const additions = defaultInteractionMechanicsLibrary().presets.filter(preset => requested.has(preset.id) && !existing.has(preset.id));
  return { ...library, presets: [...library.presets, ...additions] };
}
export function parseInteractionMechanicsLibrary(content?: string): InteractionMechanicsLibrary {
  if (content === undefined) return defaultInteractionMechanicsLibrary();
  const value = JSON.parse(content) as InteractionMechanicsLibrary;
  if (value?.version !== 1 || !Array.isArray(value.presets)) throw new Error('Biblioteca de mecánicas no compatible.');
  const ids = new Set<string>();
  for (const preset of value.presets) {
    if (!preset || typeof preset.id !== 'string' || !preset.id || ids.has(preset.id) || typeof preset.name !== 'string' || !preset.name.trim() || !Number.isSafeInteger(preset.revision) || preset.revision < 1 || !preset.mechanic || !Array.isArray(preset.results)) throw new Error('Biblioteca de mecánicas inválida.');
    const issues = interactionPresetIssues(preset);
    if (issues.length) throw new Error(`Mecánica «${preset.name}» inválida: ${issues.join(' ')}`);
    ids.add(preset.id);
  }
  return structuredClone(value);
}
/** Strict catalog validation permits unbound character slots but never malformed mechanics or effects. */
export function interactionPresetIssues(preset: InteractionMechanicPreset): string[] {
  const issues: string[] = [];
  if (preset.previewImageAssetId !== undefined && (typeof preset.previewImageAssetId !== 'string' || !preset.previewImageAssetId.trim())) return ['La imagen de vista previa debe referenciar un recurso válido.'];
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const m = preset.mechanic as unknown;
  if (!record(m) || !['dice','skillcheck','opposedcheck','qte','custom'].includes(String(m.kind))) return ['Tipo de mecánica no compatible.'];
  if (!Array.isArray(preset.results) || preset.results.some(result => !record(result) || typeof result.id !== 'string' || typeof result.name !== 'string')) return ['Resultados inválidos.'];
  if (preset.results.some(result => result.effects?.length)) issues.push('Los efectos pertenecen a cada interacción y no a la biblioteca.');
  const contextSubject = (value: unknown): boolean => record(value) && value.kind === 'context' && ['actor','self','target'].includes(String(value.role));
  const slotSubject = (value: unknown): boolean => record(value) && value.kind === 'entity' && typeof value.entityId==='string' && /^\$slot:.+/.test(value.entityId);
  const skill = (value: unknown): boolean => record(value) && (value.kind === 'variable' ? typeof value.variableId === 'string' : value.kind === 'property' && typeof value.propertyId === 'string' && record(value.subject));
  const reusableSkill = (value: unknown) => {
    if (!record(value)) return false;
    return value.kind === 'variable' ? value.variableId === '' : contextSubject(value.subject)||slotSubject(value.subject);
  };
  if (m.kind === 'skillcheck' && m.skill !== undefined && !skill(m.skill)) return [...issues, 'Fuente de atributo inválida.'];
  if (m.kind === 'skillcheck' && m.skill !== undefined && !reusableSkill(m.skill)) issues.push('Asigna el personaje o variable en cada uso, no en la biblioteca.');
  if (m.kind === 'qte' && typeof m.key !== 'string') return [...issues, 'Tecla de QTE inválida.'];
  if (m.kind === 'custom' && (typeof m.description !== 'string' || m.parameters !== undefined && !record(m.parameters))) return [...issues, 'Configuración personalizada inválida.'];
  if (m.kind === 'opposedcheck') {
    if (!record(m.actor) || !Array.isArray(m.rivals) || m.rivals.some(rival => !record(rival))) return [...issues, 'Participantes de prueba enfrentada inválidos.'];
    for (const participant of [m.actor, ...m.rivals]) if (typeof participant.id !== 'string' || !record(participant.subject) || participant.skill !== undefined && !skill(participant.skill)) return [...issues, 'Referencia de participante inválida.'];
    for (const participant of [m.actor,...m.rivals]) {
      const subject = record(participant.subject) ? participant.subject : {};
      if (!contextSubject(subject) && !(subject.kind === 'entity' && typeof subject.entityId === 'string' && /^\$slot:.+/.test(subject.entityId))) issues.push('Los personajes concretos pertenecen a cada uso.');
      if (participant.skill && !reusableSkill(participant.skill)) issues.push('Los atributos se vinculan al participante de cada uso.');
    }
  }
  try { issues.push(...interactionDefinitionIssues({ id: preset.id, name: preset.name, mechanic: preset.mechanic, results: preset.results })); }
  catch { issues.push('La configuración de la mecánica está incompleta.'); }
  return issues;
}
export function interactionLibraryFromFiles(files: Pick<UniverseFile, 'relativePath' | 'content'>[]): InteractionMechanicsLibrary {
  return parseInteractionMechanicsLibrary(files.find(file => file.relativePath === interactionMechanicsPath)?.content);
}
export function serializeInteractionMechanicsLibrary(library: InteractionMechanicsLibrary): string {
  parseInteractionMechanicsLibrary(JSON.stringify(library));
  return `${JSON.stringify(library, null, 2)}\n`;
}
export function presetFromDefinition(definition: InteractionDefinition, id = `mechanic-${crypto.randomUUID()}`): InteractionMechanicPreset {
  const mechanic = reusableInteractionMechanic(definition.mechanic);
  const results = definition.results.map(result => { const { effects, ...template } = structuredClone(result); return template; });
  const candidate = { mechanic, results };
  return { id, revision: 1, name: definition.name, presetKind: interactionPresetKind(candidate), mechanic, results, updatedAt: new Date().toISOString() };
}
/** Save only the reusable dice composition; resolution and participants stay on the story interaction. */
export function diceSetPresetFromDefinition(definition: InteractionDefinition, id = `mechanic-${crypto.randomUUID()}`): InteractionMechanicPreset {
  const selected = dicePoolForMechanic(definition.mechanic);
  if (!selected) throw new Error('Configura un set de dados antes de guardarlo en Recursos.');
  const mechanic = { kind: 'dice' as const, ...selected.dice, modifier: 0 };
  const range = diceBounds(mechanic);
  return {
    id,
    revision: 1,
    name: definition.name,
    description: `Set de dados · ${diceFormula(mechanic)}`,
    presetKind: 'dice',
    mechanic,
    results: [{ id: `${id}:completed`, name: 'Completada', range }],
    updatedAt: new Date().toISOString(),
  };
}
export function reusableInteractionMechanic(mechanic: InteractionDefinition['mechanic']): InteractionDefinition['mechanic'] {
  const next = structuredClone(mechanic);
  if (next.kind === 'skillcheck' && next.skill) next.skill = next.skill.kind === 'property' ? { ...next.skill, subject: { kind: 'context', role: 'actor' } } : { kind: 'variable', variableId: '' };
  if (next.kind === 'opposedcheck') {
    next.actor.subject = { kind: 'context', role: 'actor' };
    next.rivals.forEach(rival => { rival.subject = {kind:'entity',entityId:`$slot:${rival.id}`}; });
    for (const participant of [next.actor, ...next.rivals]) if (participant.skill) participant.skill = participant.skill.kind === 'property' ? { ...participant.skill, subject: structuredClone(participant.subject) } : { kind: 'variable', variableId: '' };
  }
  return next;
}
export function saveInteractionPreset(library: InteractionMechanicsLibrary, preset: InteractionMechanicPreset): InteractionMechanicsLibrary {
  if (!preset.name.trim()) throw new Error('Escribe el nombre de la mecánica.');
  const template = presetFromDefinition({ id: preset.id, name: preset.name, mechanic: preset.mechanic, results: preset.results }, preset.id);
  const issues = interactionPresetIssues(template);
  if (issues.length) throw new Error(issues.join(' '));
  const previous = library.presets.find(item => item.id === preset.id);
  const next = { ...structuredClone(preset), mechanic: template.mechanic, results: template.results, presetKind: interactionPresetKind({ ...preset, mechanic: template.mechanic, results: template.results }), revision: previous ? previous.revision + 1 : 1, builtIn: false, updatedAt: new Date().toISOString() };
  return { version: 1, presets: previous ? library.presets.map(item => item.id === next.id ? next : item) : [...library.presets, next] };
}

export type InteractionPresetUpdatePreview = {
  eventId: string;
  useId: string;
  name: string;
  location: string;
  revision: number;
  changes: { label: string; before: string; after: string }[];
  preserved: string[];
  error?: string;
};
function mechanicDisplay(mechanic: InteractionDefinition['mechanic'], es: boolean): Record<string, { label: string; value: string }> {
  const dice = (value: Parameters<typeof diceFormula>[0] | undefined) => value ? diceFormula(value) : es ? 'Sin tirada' : 'No dice roll';
  const output: Record<string, { label: string; value: string }> = {};
  const add = (key: string, label: string, value: string | number) => { output[key] = { label, value: String(value) }; };
  if (mechanic.kind === 'dice') { add('dice',es?'Dados':'Dice',dice(mechanic));add('modifier',es?'Modificador':'Modifier',mechanic.modifier); }
  if (mechanic.kind === 'qte') { add('key',es?'Tecla':'Key',mechanic.key);add('duration',es?'Duración':'Duration',`${mechanic.durationMs} ms`); }
  if (mechanic.kind === 'skillcheck') { add('dice',es?'Tirada':'Roll',dice(mechanic.dice));add('difficulty',es?'Dificultad':'Difficulty',mechanic.difficulty);add('modifier',es?'Modificador':'Modifier',mechanic.modifier); }
  if (mechanic.kind === 'opposedcheck') { add('actor-roll',es?'Tirada del actor':'Actor roll',dice(mechanic.actor.dice ?? mechanic.commonDice));mechanic.rivals.forEach((rival,index)=>add(`rival-${index}`,`${es?'Tirada del rival':'Rival roll'} ${index+1}`,dice(rival.dice ?? mechanic.commonDice))); }
  return output;
}
/** Produces the review without changing any story or use. Invalid updates remain visible for repair. */
export function previewInteractionPresetUpdates(project: BranchingProject, preset: InteractionMechanicPreset, es = true): InteractionPresetUpdatePreview[] {
  return project.events.flatMap(event => (event.interactionUses ?? []).flatMap(use => {
    const definition = event.interactionDefinitions?.find(item=>item.id===use.definitionId);
    if (!definition || definition.presetOrigin?.presetId !== preset.id || definition.presetOrigin.revision >= preset.revision) return [];
    const owner = narrativeNodeReferences(project,event.id).find(item=>item.id===use.ownerNodeId);
    const location = [event.name,owner?.label,event.dialogues?.find(dialogue=>dialogue.id===use.dialogueId)?.title,es?{before:'Antes',during:'Durante',after:'Después'}[use.moment]:use.moment].filter(Boolean).join(' › ');
    const preserved = [es?'Nombre e instrucciones':'Name and prompt',es?'Efectos, destinos y condiciones':'Effects, destinations and conditions',...(definition.mechanic.kind==='skillcheck'?[es?'Atributo y dificultad locales':'Local skill and difficulty']:[]),...(definition.mechanic.kind==='opposedcheck'?[es?'Personajes, variantes y atributos locales':'Local characters, variants and attributes']:[]),...(definition.presetOrigin.customized?[es?'Valores personalizados en esta interacción':'Values customized in this interaction']:[])];
    const preview: InteractionPresetUpdatePreview = {eventId:event.id,useId:use.id,name:definition.name,location,revision:definition.presetOrigin.revision,changes:[],preserved};
    try {
      const next=applyInteractionPreset(project,event.id,use.id,preset), updatedUse=next.events.find(item=>item.id===event.id)?.interactionUses?.find(item=>item.id===use.id);
      const updated=next.events.find(item=>item.id===event.id)?.interactionDefinitions?.find(item=>item.id===updatedUse?.definitionId)!;
      const before=mechanicDisplay(definition.mechanic,es),after=mechanicDisplay(updated.mechanic,es);
      for(const [key,value] of Object.entries(after)) if(value.value!==before[key]?.value)preview.changes.push({label:value.label,before:before[key]?.value??'—',after:value.value});
      for(const result of updated.results){const old=definition.results.find(item=>item.id===result.id);const format=(item:typeof result|undefined)=>item?`${item.name}${item.range?` · ${item.range.min}–${item.range.max}`:''}`:es?'Nuevo resultado':'New result';if(format(old)!==format(result))preview.changes.push({label:es?'Resultado':'Result',before:old?format(old):'—',after:format(result)});}
    } catch(error){preview.error=error instanceof Error?error.message:String(error);}
    return [preview];
  }));
}
export function applyInteractionPresetUpdates(project: BranchingProject, preset: InteractionMechanicPreset, uses: Pick<InteractionPresetUpdatePreview,'eventId'|'useId'>[]): BranchingProject {
  return uses.reduce((next,use)=>applyInteractionPreset(next,use.eventId,use.useId,preset),project);
}
export function duplicateInteractionPreset(library: InteractionMechanicsLibrary, id: string): InteractionMechanicsLibrary {
  const source = library.presets.find(item => item.id === id);
  if (!source) throw new Error('Mecánica no disponible.');
  return { version: 1, presets: [...library.presets, { ...structuredClone(source), id: `mechanic-${crypto.randomUUID()}`, name: `${source.name} · copia`, revision: 1, builtIn: false, updatedAt: new Date().toISOString() }] };
}
function definitionFromPreset(preset: InteractionMechanicPreset, id: string, source: InteractionMechanicPreset = preset): InteractionDefinition {
  const customized = preset.name !== source.name || JSON.stringify(preset.mechanic) !== JSON.stringify(source.mechanic) || JSON.stringify(preset.results) !== JSON.stringify(source.results);
  return { id, name: preset.name, mechanic: structuredClone(preset.mechanic), results: preset.results.map(result => ({ ...structuredClone(result), id: `${id}:${result.id}` })), presetOrigin: { presetId: source.id, revision: source.revision, ...(customized ? { customized: true } : {}), baseline: structuredClone(source.mechanic), resultBaseline: structuredClone(source.results) } };
}
export function createInteractionFromPreset(project: BranchingProject, eventId: string, preset: InteractionMechanicPreset, options: { ownerNodeId?: string; dialogueId?: string; afterNodeId?: string; beforeNodeId?: string; moment?: InteractionUse['moment']; sourcePreset?: InteractionMechanicPreset } = {}): MutationResult & { useId?: string; definitionId?: string } {
  const added = addInteraction(project, eventId, preset.mechanic.kind, options);
  if (added.message) return added;
  const before = new Set(project.events.find(event => event.id === eventId)?.interactionUses?.map(use => use.id));
  const event = added.project.events.find(event => event.id === eventId)!;
  const use = event.interactionUses!.find(item => !before.has(item.id))!;
  const definition = definitionFromPreset(preset, use.definitionId, options.sourcePreset);
  return { ...added, project: updateEvent(added.project, eventId, { interactionDefinitions: event.interactionDefinitions?.map(item => item.id === definition.id ? definition : item) }).project, useId: use.id, definitionId: definition.id };
}
/** Customizing a shared old definition detaches this use while preserving stable result IDs. */
export function customizeInteractionUse(project: BranchingProject, eventId: string, useId: string, patch: Partial<InteractionDefinition>): BranchingProject {
  const event = project.events.find(item => item.id === eventId), use = event?.interactionUses?.find(item => item.id === useId);
  const definition = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  if (!event || !use || !definition) return project;
  const shared = (event.interactionUses ?? []).filter(item => item.definitionId === definition.id).length > 1;
  const id = shared ? `definition-${crypto.randomUUID()}` : definition.id;
  const next = { ...structuredClone(definition), ...patch, id, presetOrigin: patch.presetOrigin ?? (definition.presetOrigin ? { ...definition.presetOrigin, customized: true } : undefined) };
  return updateEvent(project, eventId, { interactionDefinitions: shared ? [...(event.interactionDefinitions ?? []), next] : event.interactionDefinitions?.map(item => item.id === id ? next : item), interactionUses: event.interactionUses?.map(item => item.id === useId ? { ...item, definitionId: id } : item) }).project;
}
/** Remove one authored outcome while keeping its interaction use and definition intact. */
export function deleteInteractionResult(project: BranchingProject, eventId: string, useId: string, resultId: string): BranchingProject {
  const event = project.events.find(item => item.id === eventId), use = event?.interactionUses?.find(item => item.id === useId);
  const definition = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  if (!definition || definition.results.length <= 1 || !definition.results.some(result => result.id === resultId)) return project;
  const customized = customizeInteractionUse(project, eventId, useId, { results: definition.results.filter(result => result.id !== resultId) });
  const updatedEvent = customized.events.find(item => item.id === eventId);
  const updatedUse = updatedEvent?.interactionUses?.find(item => item.id === useId);
  const updatedDefinition = updatedEvent?.interactionDefinitions?.find(item => item.id === updatedUse?.definitionId);
  const transitions = (updatedEvent?.transitions ?? []).flatMap(transition => {
    const when = transition.logic?.when ?? transition.conditions;
    if (!when || Array.isArray(when) || !('type' in when) || when.type !== 'interactionResult' || when.useId !== useId) return [transition];
    if (when.resultId === resultId) return [];
    const order = updatedDefinition?.results.findIndex(result => result.id === when.resultId);
    return order === undefined || order < 0 ? [transition] : [{ ...transition, order }];
  });
  return updateEvent(customized, eventId, { transitions }).project;
}
/** Explicit preset update only; match semantic result keys first and preserve referenced IDs. */
export function chooseInteractionPreset(project: BranchingProject, eventId: string, useId: string, preset: InteractionMechanicPreset): BranchingProject {
  const event = project.events.find(item => item.id === eventId);
  const use = event?.interactionUses?.find(item => item.id === useId);
  const old = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  if (!old) throw new Error('Missing interaction use');
  const issues = interactionPresetIssues(preset);
  if (issues.length) throw new Error(issues.join('; '));
  if (!old.mechanicPending && old.mechanic.kind !== preset.mechanic.kind) throw new Error('Crea otra interacción para cambiar de tipo y conservar los resultados referenciados.');
  let results = old.mechanicPending ? definitionFromPreset(preset, old.id).results : structuredClone(old.results);
  if (!old.mechanicPending && old.mechanic.kind === 'dice' && preset.mechanic.kind === 'dice' && results.length === 1) {
    const before = diceBounds(old.mechanic, old.mechanic.modifier);
    if (results[0].range?.min === before.min && results[0].range?.max === before.max) results[0].range = diceBounds(preset.mechanic, preset.mechanic.modifier);
  }
  return customizeInteractionUse(project, eventId, useId, {
    mechanic: structuredClone(preset.mechanic), mechanicPending: undefined, results,
    ...(old.mechanicPending ? { name: preset.name } : {}),
    presetOrigin: { presetId: preset.id, revision: preset.revision, baseline: structuredClone(preset.mechanic), resultBaseline: structuredClone(preset.results) },
  });
}

export function applyInteractionPreset(project: BranchingProject, eventId: string, useId: string, preset: InteractionMechanicPreset): BranchingProject {
  const event = project.events.find(item => item.id === eventId), use = event?.interactionUses?.find(item => item.id === useId), old = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  if (!old) return project;
  const current = old.mechanic;
  const incomingPool = preset.mechanic.kind === 'dice' && interactionPresetKind(preset) === 'dice' ? dicePoolForMechanic(preset.mechanic)?.dice : undefined;
  if (incomingPool && ['dice', 'skillcheck', 'opposedcheck'].includes(current.kind)) {
    const baselinePool = old.presetOrigin?.baseline ? dicePoolForMechanic(old.presetOrigin.baseline)?.dice : undefined;
    const currentPool = dicePoolForMechanic(current)?.dice;
  const samePool = (left: InteractionDice, right: InteractionDice) => JSON.stringify([left.count, left.sides, left.minimum ?? 1, left.groups ?? []]) === JSON.stringify([right.count, right.sides, right.minimum ?? 1, right.groups ?? []]);
    const followsPreviousSet = !currentPool || Boolean(baselinePool && samePool(currentPool, baselinePool));
    let mechanic: InteractionDefinition['mechanic'] = current;
    if (followsPreviousSet) {
      if (current.kind === 'dice') mechanic = { ...current, ...incomingPool, minimum: incomingPool.minimum, groups: incomingPool.groups, dicePresetId: preset.id };
      if (current.kind === 'skillcheck') mechanic = { ...current, dice: incomingPool, dicePresetId: preset.id };
      if (current.kind === 'opposedcheck') mechanic = { ...current, commonDice: incomingPool, commonDicePresetId: preset.id };
    }
    const results = structuredClone(old.results);
    if (followsPreviousSet && current.kind === 'dice' && mechanic.kind === 'dice' && results.length === 1 && results[0].range?.min === diceBounds(current, current.modifier).min && results[0].range?.max === diceBounds(current, current.modifier).max) results[0] = { ...results[0], range: diceBounds(mechanic, mechanic.modifier) };
    const issues = interactionDefinitionIssues({ ...old, mechanic, results });
    if (issues.length) throw new Error(`La actualización necesita revisión de los intervalos locales: ${issues.join(' ')}`);
    return customizeInteractionUse(project, eventId, useId, { mechanic, results, presetOrigin: { presetId: preset.id, revision: preset.revision, customized: old.presetOrigin?.customized, baseline: structuredClone(preset.mechanic), resultBaseline: structuredClone(preset.results) } });
  }
  const matched = new Set<string>();
  const results = preset.results.map((result, index) => {
    const previous = old.results.find(item => !matched.has(item.id) && (result.key && item.key === result.key || item.id === result.id || item.id === `${old.id}:${result.id}` || item.name === result.name));
    if (previous) matched.add(previous.id);
    const before = old.presetOrigin?.resultBaseline?.find(item => item.id === result.id || item.key && item.key === result.key);
    const customizedRange = previous && before && JSON.stringify(previous.range) !== JSON.stringify(before.range);
    return { ...structuredClone(result), id: previous?.id ?? `${old.id}:${result.id}`, ...(previous && before && previous.name !== before.name ? { name: previous.name } : {}), ...(customizedRange ? { range: structuredClone(previous.range) } : {}), ...(previous?.effects ? { effects: structuredClone(previous.effects) } : {}) };
  });
  const removed = new Set(old.results.filter(item => !results.some(result => result.id === item.id)).map(item => item.id));
  const references = (input: unknown): boolean => Array.isArray(input) ? input.some(references) : Boolean(input && typeof input === 'object' && ((input as Record<string, unknown>).type === 'interactionResult' && (input as Record<string, unknown>).useId === useId && removed.has(String((input as Record<string, unknown>).resultId)) || Object.values(input ?? {}).some(references)));
  if (removed.size && references(project)) throw new Error('La actualización elimina resultados usados por condiciones. Revisa sus referencias antes de actualizar.');
  const incoming = structuredClone(preset.mechanic), baseline = old.presetOrigin?.baseline;
  // Template updates only change shared geometry/timing; story operands and customized values stay local.
  let mechanic = current;
  if (current.kind === incoming.kind) {
    const update = <T>(now: T, before: T | undefined, next: T): T => before !== undefined && JSON.stringify(now) === JSON.stringify(before) ? next : now;
    const updateOptional = <T>(now: T | undefined, before: T | undefined, next: T | undefined): T | undefined => before === undefined && now === undefined ? next : update(now, before, next);
    if (current.kind === 'dice' && incoming.kind === 'dice') {
      const previous = baseline?.kind === 'dice' ? baseline : undefined;
      const pool = previous && JSON.stringify([current.count, current.sides, current.minimum ?? 1, current.groups]) === JSON.stringify([previous.count, previous.sides, previous.minimum ?? 1, previous.groups]) ? incoming : current;
      mechanic = { ...current, count: pool.count, sides: pool.sides, minimum: pool.minimum, groups: pool.groups, dicePresetId: updateOptional(current.dicePresetId, previous?.dicePresetId, incoming.dicePresetId), modifier: update(current.modifier, previous?.modifier, incoming.modifier), modifierRules: updateOptional(current.modifierRules, previous?.modifierRules, incoming.modifierRules), actor: updateOptional(current.actor, previous?.actor, incoming.actor), skill: updateOptional(current.skill, previous?.skill, incoming.skill) };
    }
    if (current.kind === 'qte' && incoming.kind === 'qte') mechanic = { ...current, key: update(current.key, baseline?.kind === 'qte' ? baseline.key : undefined, incoming.key), durationMs: update(current.durationMs, baseline?.kind === 'qte' ? baseline.durationMs : undefined, incoming.durationMs) };
    if (current.kind === 'skillcheck' && incoming.kind === 'skillcheck') {
      const previous = baseline?.kind === 'skillcheck' ? baseline : undefined;
      mechanic = { ...current, dice: update(current.dice, previous?.dice, incoming.dice), dicePresetId: updateOptional(current.dicePresetId, previous?.dicePresetId, incoming.dicePresetId), difficulty: update(current.difficulty, previous?.difficulty, incoming.difficulty), difficultyOperator: updateOptional(current.difficultyOperator, previous?.difficultyOperator, incoming.difficultyOperator), modifier: update(current.modifier, previous?.modifier, incoming.modifier), modifierRules: updateOptional(current.modifierRules, previous?.modifierRules, incoming.modifierRules), actor: updateOptional(current.actor, previous?.actor, incoming.actor), skill: updateOptional(current.skill, previous?.skill, incoming.skill) };
    }
    if (current.kind === 'opposedcheck' && incoming.kind === 'opposedcheck') {
      const previous = baseline?.kind === 'opposedcheck' ? baseline : undefined, participants = incoming.rivals;
      mechanic = { ...current, commonDice: updateOptional(current.commonDice, previous?.commonDice, incoming.commonDice), commonDicePresetId: updateOptional(current.commonDicePresetId, previous?.commonDicePresetId, incoming.commonDicePresetId), aggregation: update(current.aggregation, previous?.aggregation, incoming.aggregation), actor: { ...current.actor, dice: updateOptional(current.actor.dice, previous?.actor.dice, incoming.actor.dice), dicePresetId: updateOptional(current.actor.dicePresetId, previous?.actor.dicePresetId, incoming.actor.dicePresetId), modifier: update(current.actor.modifier, previous?.actor.modifier, incoming.actor.modifier), modifierRules: updateOptional(current.actor.modifierRules, previous?.actor.modifierRules, incoming.actor.modifierRules), skill: updateOptional(current.actor.skill, previous?.actor.skill, incoming.actor.skill) }, rivals: current.rivals.map(rival => { const next = participants.find(item => item.id === rival.id); const before = previous?.rivals.find(item => item.id === rival.id); return next ? { ...rival, dice: updateOptional(rival.dice, before?.dice, next.dice), dicePresetId: updateOptional(rival.dicePresetId, before?.dicePresetId, next.dicePresetId), modifier: update(rival.modifier, before?.modifier, next.modifier), modifierRules: updateOptional(rival.modifierRules, before?.modifierRules, next.modifierRules), skill: updateOptional(rival.skill, before?.skill, next.skill) } : rival; }) };
    }
  } else throw new Error('La plantilla cambió de tipo. Crea otra interacción para conservar los ajustes y referencias actuales.');
  if (current.kind === 'dice' && mechanic.kind === 'dice' && old.results.length === 1 && results.length === 1 && old.results[0].range?.min === diceBounds(current, current.modifier).min && old.results[0].range?.max === diceBounds(current, current.modifier).max) results[0] = { ...results[0], range: diceBounds(mechanic, mechanic.modifier) };
  const issues = interactionDefinitionIssues({ ...old, mechanic, results });
  if (issues.length) throw new Error(`La actualización necesita revisión de los ajustes locales: ${issues.join(' ')}`);
  return customizeInteractionUse(project, eventId, useId, { mechanic, results, presetOrigin: { presetId: preset.id, revision: preset.revision, customized: old.presetOrigin?.customized, baseline: structuredClone(preset.mechanic), resultBaseline: structuredClone(preset.results) } });
}
