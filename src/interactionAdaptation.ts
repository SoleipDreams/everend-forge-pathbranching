import type { BranchingProject, InteractionDefinition, InteractionMechanicPreset, InteractionResult } from './domain.js';
import { diceBounds, interactionPresetKind } from './interactionDice.js';
import { customizeInteractionUse } from './interactionLibrary.js';
import { interactionDefinitionIssues } from './interactions.js';

export type InteractionAdaptationOptions = {
  ranges: 'preserve' | 'proportional';
  /** Target result ID -> existing result ID. Empty means a new result. */
  mapping: Record<string, string>;
  retainUnmatched: boolean;
  discardUnmatched: boolean;
};
export type InteractionResultReference = { resultId: string; participantId?: string; location: string };

function currentDefinition(project: BranchingProject, eventId: string, useId: string) {
  const event = project.events.find(item => item.id === eventId);
  const use = event?.interactionUses?.find(item => item.id === useId);
  const definition = event?.interactionDefinitions?.find(item => item.id === use?.definitionId);
  if (!definition) throw new Error('La interacción ya no está disponible.');
  return definition;
}

/** Visit authored logic only: runtime history, arbitrary property values and preset baselines are not references. */
export function interactionResultReferences(project: BranchingProject, useId: string): InteractionResultReference[] {
  const references: InteractionResultReference[] = [];
  const children = new Set(['events', 'sequences', 'branches', 'narrativeActions', 'narrativeRules', 'projectDataObjects', 'scriptDocuments', 'logic', 'when', 'then', 'rules', 'narrativeEffects', 'effects', 'availability', 'conditions', 'consequences', 'displayCondition', 'all', 'any', 'not', 'query', 'filters', 'decisions', 'outcomes', 'dialogues', 'dialogueBeats', 'beats', 'dialogueStarts', 'transitions', 'interactionDefinitions', 'results']);
  const labels: Record<string, string> = { events: 'Eventos', sequences: 'Secuencias', branches: 'Ramas', narrativeActions: 'Acciones', narrativeRules: 'Reglas', projectDataObjects: 'Objetos de datos', logic: 'Lógica', when: 'Condición', then: 'Consecuencia', rules: 'Reglas', narrativeEffects: 'Consecuencias', effects: 'Consecuencias', availability: 'Disponibilidad', conditions: 'Condiciones', consequences: 'Consecuencias', displayCondition: 'Visibilidad', all: 'Todas', any: 'Cualquiera', not: 'NO', query: 'Consulta', filters: 'Filtros', decisions: 'Decisiones', outcomes: 'Opciones', dialogues: 'Conversaciones', dialogueBeats: 'Diálogos', beats: 'Diálogos', dialogueStarts: 'Entradas', transitions: 'Rutas', interactionDefinitions: 'Interacciones', results: 'Resultados' };
  const walk = (input: unknown, location: string) => {
    if (Array.isArray(input)) { input.forEach((item, index) => walk(item, `${location} · ${index + 1}`)); return; }
    if (!input || typeof input !== 'object') return;
    const value = input as Record<string, unknown>;
    const name = [value.name, value.title, value.label].find(item => typeof item === 'string' && item.trim());
    const owner = typeof name === 'string' ? `${location} / ${name}` : location;
    if (value.type === 'interactionResult' && value.useId === useId && typeof value.resultId === 'string') references.push({ resultId: value.resultId, ...(typeof value.participantId === 'string' ? { participantId: value.participantId } : {}), location: owner });
    for (const [key, child] of Object.entries(value)) if (children.has(key)) walk(child, `${owner} / ${labels[key] ?? key}`);
  };
  walk(project, project.name || 'Historia');
  return references;
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const resultPolarity = (result: InteractionResult): -1 | 0 | 1 | undefined => {
  const semantics = normalize(`${result.key ?? ''} ${result.name}`);
  if (/failure|fail|fallo|derrota|negativ|perdid|lose/.test(semantics)) return -1;
  if (/success|succeed|exito|victoria|positiv|ganad|pass/.test(semantics)) return 1;
  if (/tie|empate|draw/.test(semantics)) return 0;
  return undefined;
};
function distributeDiceResults(results: InteractionResult[], min: number, max: number): InteractionResult[] {
  const size = max - min + 1;
  const ordered = results.map((result, index) => ({ result, index })).sort((left, right) => {
    const leftPolarity = resultPolarity(left.result), rightPolarity = resultPolarity(right.result);
    if (leftPolarity !== undefined && rightPolarity !== undefined && leftPolarity !== rightPolarity) return leftPolarity - rightPolarity;
    const leftMin = left.result.range?.min, rightMin = right.result.range?.min;
    return leftMin !== undefined && rightMin !== undefined && leftMin !== rightMin ? leftMin - rightMin : left.index - right.index;
  });
  const ranges = new Map(ordered.map(({ result }, index) => [result.id, {
    min: min + Math.floor(index * size / ordered.length),
    max: min + Math.floor((index + 1) * size / ordered.length) - 1,
  }]));
  return results.map(result => ({ ...result, range: ranges.get(result.id) }));
}

export function defaultInteractionAdaptation(old: InteractionDefinition, preset: InteractionMechanicPreset): InteractionAdaptationOptions {
  const mapping: Record<string, string> = {}, used = new Set<string>();
  // Prefer stable result semantics and names. If a preset renames its outcomes,
  // carry authored routes/effects over in their existing order as a predictable
  // automatic fallback instead of asking the author to map each one manually.
  for (const target of preset.results) {
    const matches = old.results.filter(result => !used.has(result.id) && target.key && result.key === target.key);
    if (matches.length === 1) { mapping[target.id] = matches[0].id; used.add(matches[0].id); }
  }
  for (const target of preset.results) {
    if (mapping[target.id]) continue;
    const matches = old.results.filter(result => !used.has(result.id) && normalize(result.name) === normalize(target.name));
    if (matches.length === 1) { mapping[target.id] = matches[0].id; used.add(matches[0].id); }
  }
  const rankedTargets = preset.results.map((result, index) => ({ result, index })).sort((left, right) =>
    (left.result.range?.min ?? left.index) - (right.result.range?.min ?? right.index) || left.index - right.index);
  for (const source of old.results) {
    if (used.has(source.id)) continue;
    const rank = resultPolarity(source);
    if (rank === undefined || !rankedTargets.length) continue;
    const targetIndex = rank < 0 ? 0 : rank > 0 ? rankedTargets.length - 1 : Math.floor((rankedTargets.length - 1) / 2);
    const target = rankedTargets[targetIndex]?.result;
    if (target && !mapping[target.id]) { mapping[target.id] = source.id; used.add(source.id); }
  }
  const unmatchedTargets = preset.results.filter(target => !mapping[target.id]);
  const unmatchedSources = old.results.filter(result => !used.has(result.id));
  unmatchedTargets.forEach((target, index) => {
    const source = unmatchedSources[index];
    if (source) { mapping[target.id] = source.id; used.add(source.id); }
  });
  return { ranges: 'proportional', mapping, retainUnmatched: true, discardUnmatched: true };
}

export function previewInteractionAdaptation(project: BranchingProject, eventId: string, useId: string, preset: InteractionMechanicPreset, options: InteractionAdaptationOptions, poolOnly = false) {
  const old = currentDefinition(project, eventId, useId);
  const references = interactionResultReferences(project, useId);
  const errors: string[] = [], warnings: string[] = [];
  const sameDice = old.mechanic.kind === 'dice' && preset.mechanic.kind === 'dice';
  const flexible = preset.mechanic.kind === 'dice' || preset.mechanic.kind === 'custom';
  let mechanic = structuredClone(preset.mechanic);
  // Reusing another preset never replaces story-specific character identities or attributes.
  const oldRollSource = old.mechanic.kind === 'dice' || old.mechanic.kind === 'skillcheck'
    ? { actor: old.mechanic.actor ?? (old.mechanic.skill?.kind === 'property' ? old.mechanic.skill.subject : undefined), skill: old.mechanic.skill }
    : old.mechanic.kind === 'opposedcheck' ? { actor: old.mechanic.actor.subject, skill: old.mechanic.actor.skill } : undefined;
  if (oldRollSource && mechanic.kind === 'skillcheck') {
    const skill = oldRollSource.skill?.kind === 'property' && oldRollSource.actor
      ? { ...oldRollSource.skill, subject: structuredClone(oldRollSource.actor) }
      : oldRollSource.skill ? structuredClone(oldRollSource.skill) : undefined;
    mechanic = { ...mechanic, ...(oldRollSource.actor ? { actor: structuredClone(oldRollSource.actor) } : {}), ...(skill ? { skill } : { skill: undefined }) };
  }
  if (oldRollSource && mechanic.kind === 'dice' && interactionPresetKind(preset) === 'recipe') {
    const skill = oldRollSource.skill?.kind === 'property' && oldRollSource.actor
      ? { ...oldRollSource.skill, subject: structuredClone(oldRollSource.actor) }
      : oldRollSource.skill ? structuredClone(oldRollSource.skill) : undefined;
    mechanic = { ...mechanic, ...(oldRollSource.actor ? { actor: structuredClone(oldRollSource.actor) } : {}), ...(skill ? { skill } : { skill: undefined }) };
  }
  if (!poolOnly && old.mechanic.kind === 'opposedcheck' && mechanic.kind === 'opposedcheck') {
    mechanic = { ...mechanic, actor: structuredClone(old.mechanic.actor), rivals: structuredClone(old.mechanic.rivals) };
    warnings.push('Se conservan los participantes, atributos y dados de cada personaje.');
  }
  const assigned = new Set<string>();
  let results: InteractionResult[];
  if (poolOnly) {
    results = structuredClone(old.results);
    old.results.forEach(result => assigned.add(result.id));
  } else if (sameDice) {
    results = structuredClone(old.results);
    old.results.forEach(result => assigned.add(result.id));
  } else {
    const occupied = new Set(old.results.map(result => result.id));
    results = preset.results.map(target => {
      const sourceId = options.mapping[target.id];
      const source = old.results.find(result => result.id === sourceId);
      if (sourceId && !source) errors.push('Un resultado asociado ya no está disponible.');
      if (source && assigned.has(source.id)) errors.push(`«${source.name}» está asociado más de una vez.`);
      if (source) assigned.add(source.id);
      let id = `${useId}:adapted:${preset.id}:${target.id}`;
      while (occupied.has(id)) id += ':new';
      occupied.add(id);
      return { ...structuredClone(target), id: source?.id ?? id, ...(source ? { name: source.name, effects: structuredClone(source.effects) } : {}) };
    });
    if (flexible && options.retainUnmatched) for (const source of old.results) if (!assigned.has(source.id)) {
      results.push({ ...structuredClone(source), key: undefined, range: undefined });
      assigned.add(source.id);
    }
  }
  const removed = old.results.filter(result => !assigned.has(result.id));
  for (const result of removed) {
    const count = references.filter(ref => ref.resultId === result.id).length;
    if (count || result.effects?.length) errors.push(`Asocia «${result.name}»: tiene ${count} referencias y ${result.effects?.length ?? 0} consecuencias.`);
  }
  if (removed.length && !options.discardUnmatched) errors.push('Confirma la eliminación de los resultados sin asociación.');
  const participants = mechanic.kind === 'opposedcheck' ? new Set(mechanic.rivals.map(rival => rival.id)) : new Set<string>();
  for (const ref of references) if (ref.participantId && !participants.has(ref.participantId)) errors.push(`Revisa la condición contra un rival en ${ref.location}: la nueva mecánica no incluye ese participante.`);
  if (mechanic.kind === 'dice' && (!poolOnly || sameDice)) {
    const after = diceBounds(mechanic, mechanic.modifier), size = after.max - after.min + 1;
    const rangeIssue = (candidate: InteractionDefinition) => interactionDefinitionIssues(candidate).some(issue => issue.includes('dice result') || issue.startsWith('Every dice result') || issue.startsWith('Dice ranges'));
    const validCurrentRanges = old.mechanic.kind === 'dice' && !rangeIssue(old);
    if (sameDice && old.mechanic.kind === 'dice' && options.ranges === 'proportional' && validCurrentRanges) {
      const before = diceBounds(old.mechanic, old.mechanic.modifier), count = before.max - before.min + 1;
      // Inclusive intervals share a boundary on the integer-roll lattice, preventing rounding gaps.
      results = results.map(result => {
        if (!result.range) return { ...result, range: undefined };
        const range = result.range;
        return { ...result, range: {
          ...(range.min === undefined ? {} : { min: after.min + Math.round((Math.ceil(range.min - before.min) / count) * size), minInclusive: true }),
          ...(range.max === undefined ? {} : { max: after.min + Math.round(((Math.floor(range.max - before.min) + 1) / count) * size) - 1, maxInclusive: true }),
        } };
      });
    }
    // Result ranges always cover the base dice domain. Attributes and bonuses
    // can still move the final total, but must not invalidate the underlying pool.
    if (rangeIssue({ ...old, mechanic, results })) {
      results = distributeDiceResults(results, after.min, after.max);
    }
    for (const result of results) if (result.range && result.range.min !== undefined && result.range.max !== undefined && (result.range.max < result.range.min || result.range.max === result.range.min && (result.range.minInclusive === false || result.range.maxInclusive === false))) errors.push(`«${result.name}» tiene un intervalo vacío o invertido.`);
    warnings.push('La proporción de los intervalos no garantiza la misma probabilidad ni dificultad.');
  } else if (!poolOnly && mechanic.kind !== 'skillcheck') results = results.map(result => ({ ...result, range: undefined }));
  const next = { ...old, mechanic, mechanicPending: undefined, results };
  errors.push(...interactionDefinitionIssues(next));
  return { old, next, removed, references, errors: [...new Set(errors)], warnings, sameDice, flexible };
}

/** Recompute against the current document; a reviewed change is one caller-owned undo transaction. */
export function adaptInteractionUse(project: BranchingProject, eventId: string, useId: string, preset: InteractionMechanicPreset, options: InteractionAdaptationOptions, expectedDefinition: string, recordPresetOrigin = true, poolOnly = false): BranchingProject {
  const current = currentDefinition(project, eventId, useId);
  if (JSON.stringify(current) !== expectedDefinition) throw new Error('La interacción cambió mientras revisabas. Cierra la vista previa y vuelve a abrirla.');
  const preview = previewInteractionAdaptation(project, eventId, useId, preset, options, poolOnly);
  if (preview.errors.length) throw new Error(preview.errors.join('\n'));
  const presetOrigin = poolOnly
    ? current.presetOrigin ? { ...current.presetOrigin, customized: true } : undefined
    : recordPresetOrigin ? { presetId: preset.id, revision: preset.revision, customized: true, baseline: structuredClone(preset.mechanic), resultBaseline: structuredClone(preset.results) } : current.presetOrigin ? { ...current.presetOrigin, customized: true } : undefined;
  return customizeInteractionUse(project, eventId, useId, { mechanic: preview.next.mechanic, results: preview.next.results, mechanicPending: undefined, presetOrigin });
}
