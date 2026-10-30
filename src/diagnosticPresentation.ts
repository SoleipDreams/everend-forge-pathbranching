import type { BranchingProject, EventNode, ValidationFinding } from "./domain.js";
import type { Selection } from "./appTypes.js";
import { effectiveConditions, orderedTransitions } from "./logic.js";
import { blockValues, localizedValue } from "./localization.js";

function compactDiagnosticText(value: string, limit = 88) {
  const text = value.replace(/\s+/gu, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function scopedNarrativeNodeLabel(project: BranchingProject, event: EventNode, nodeId: string, locale: "en" | "es") {
  const dialoguePrefix = `dialogue:${event.id}:`;
  if (nodeId.startsWith(dialoguePrefix)) {
    const dialogueId = nodeId.slice(dialoguePrefix.length);
    return event.dialogues?.find((dialogue) => dialogue.id === dialogueId)?.title ?? (locale === "es" ? "Conversación" : "Conversation");
  }

  const decisionPrefix = `decision:${event.id}:`;
  if (nodeId.startsWith(decisionPrefix)) {
    const decisionId = nodeId.slice(decisionPrefix.length);
    return event.decisions?.find((decision) => decision.id === decisionId)?.name ?? (locale === "es" ? "Decisión" : "Decision");
  }

  const outcomePrefix = `outcome:${event.id}:`;
  if (nodeId.startsWith(outcomePrefix)) {
    const outcome = (event.decisions ?? []).flatMap((decision) => decision.outcomes.map((candidate) => ({ decision, outcome: candidate })))
      .find(({ decision, outcome: candidate }) => `outcome:${event.id}:${decision.id}:${candidate.id}` === nodeId);
    return outcome ? `${outcome.decision.name} · ${outcome.outcome.visibleText || outcome.outcome.id}` : (locale === "es" ? "Opción" : "Outcome");
  }

  const beatPrefix = `beat:${event.id}:`;
  if (nodeId.startsWith(beatPrefix)) {
    const beatId = nodeId.slice(beatPrefix.length);
    const dialogue = event.dialogues?.find((candidate) => candidate.beats?.some((beat) => beat.id === beatId));
    const beat = (event.dialogueBeats ?? []).find((candidate) => candidate.id === beatId)
      ?? dialogue?.beats?.find((candidate) => candidate.id === beatId);
    if (!beat) return dialogue?.title ?? (locale === "es" ? "Línea de diálogo" : "Dialogue line");
    const block = project.scriptDocuments?.find((script) => script.id === beat.blockRef.scriptId)?.blocks.find((candidate) => candidate.id === beat.blockRef.blockId);
    const text = block
      ? localizedValue(blockValues(project, beat.blockRef.scriptId, block, project.localizationCatalog?.primaryLocale ?? "es-419"), locale, project.localizationCatalog?.primaryLocale ?? "es-419")
      : "";
    const speakerId = block?.characterRef ?? block?.speakerRef;
    const speaker = speakerId
      ? project.canonRefs.find((ref) => ref.id === speakerId)?.label ?? project.localExplorerEntities?.find((entity) => entity.id === speakerId)?.name
      : undefined;
    const kind = beat.kind === "direction" ? (locale === "es" ? "acotación" : "stage direction") : (locale === "es" ? "línea" : "line");
    const preview = compactDiagnosticText(text, 64);
    return `${dialogue?.title ?? (locale === "es" ? "Conversación" : "Conversation")} · ${kind}${preview ? ` · ${speaker ? `${speaker}: ` : ""}“${preview}”` : ""}`;
  }

  return nodeId;
}

function narrativeNodeLabel(project: BranchingProject, ownerEvent: EventNode, nodeId: string, locale: "en" | "es") {
  const targetEvent = project.events.find((candidate) => candidate.id === nodeId);
  if (targetEvent) return targetEvent.name;
  const scopedEvent = project.events.find((candidate) =>
    nodeId.startsWith(`dialogue:${candidate.id}:`) ||
    nodeId.startsWith(`beat:${candidate.id}:`) ||
    nodeId.startsWith(`decision:${candidate.id}:`) ||
    nodeId.startsWith(`outcome:${candidate.id}:`),
  );
  if (scopedEvent) return scopedNarrativeNodeLabel(project, scopedEvent, nodeId, locale);

  for (const event of project.events) {
    const interactionPrefix = `interaction:${event.id}:`;
    if (nodeId.startsWith(interactionPrefix)) {
      const useId = nodeId.slice(interactionPrefix.length);
      const use = event.interactionUses?.find((candidate) => candidate.id === useId);
      return event.interactionDefinitions?.find((definition) => definition.id === use?.definitionId)?.name ?? (locale === "es" ? "Interacción" : "Interaction");
    }
    const barrierPrefix = `barrier:${event.id}:`;
    if (nodeId.startsWith(barrierPrefix)) {
      const barrierId = nodeId.slice(barrierPrefix.length);
      return event.interactionBarriers?.find((candidate) => candidate.id === barrierId)?.name ?? (locale === "es" ? "Barrera" : "Barrier");
    }
  }

  const sequence = project.sequences.find((candidate) => candidate.id === nodeId);
  if (sequence) return sequence.name;
  const branch = project.branches.find((candidate) => candidate.id === nodeId);
  if (branch) return branch.title;
  if (nodeId.startsWith(`boundary:${ownerEvent.id}:`) || nodeId.startsWith(`dialogue-boundary:${ownerEvent.id}:`)) {
    const isInput = nodeId.includes(":input:");
    return `${isInput ? (locale === "es" ? "Entrada" : "Entry") : (locale === "es" ? "Continuación" : "Continuation")} · ${ownerEvent.name}`;
  }
  return nodeId;
}

export function transitionOrderDetails(project: BranchingProject, sourceId: string, locale: "en" | "es") {
  const event = project.events.find((candidate) => candidate.transitions?.some((transition) => transition.from === sourceId));
  if (!event) return undefined;
  const routes = orderedTransitions((event.transitions ?? []).filter((transition) => transition.from === sourceId));
  const sourceLabel = narrativeNodeLabel(project, event, sourceId, locale);
  const routeIds = routes.map((route) => route.id);
  const unconditionalIndex = routes.findIndex((route) => route.mode !== "fallback" && !effectiveConditions(route));
  const blockedRoutes = unconditionalIndex >= 0 ? routes.slice(unconditionalIndex + 1) : [];
  if (!blockedRoutes.length) return { event, sourceLabel, routeIds };

  const blocker = routes[unconditionalIndex];
  const blockerTarget = narrativeNodeLabel(project, event, blocker.to, locale);
  const sourceContext = sourceLabel === event.name
    ? (locale === "es" ? `En «${event.name}»` : `In “${event.name}”`)
    : `${event.name} → ${sourceLabel}`;
  const message = locale === "es"
    ? `${sourceContext}: la ruta ${unconditionalIndex + 1} hacia «${blockerTarget}» no tiene condición y aparece antes de ${blockedRoutes.length} ${blockedRoutes.length === 1 ? "ruta posterior" : "rutas posteriores"}. Como coincide siempre, esas rutas no se alcanzan. Define las condiciones de las ramas y deja, como máximo, una ruta incondicional al final.`
    : `${sourceContext}: route ${unconditionalIndex + 1} to “${blockerTarget}” has no condition and comes before ${blockedRoutes.length} later route${blockedRoutes.length === 1 ? "" : "s"}. It always matches first, so those routes cannot be reached. Add conditions to the branches and keep at most one unconditional route at the end.`;
  const technical = [
    `${locale === "es" ? "Origen" : "Source"}: ${sourceLabel} [${sourceId}]`,
    `${locale === "es" ? "Ruta incondicional" : "Unconditional route"}: #${unconditionalIndex + 1} → ${blockerTarget} [${blocker.id}]`,
    `${locale === "es" ? "Rutas posteriores inalcanzables" : "Unreachable later routes"}:`,
    ...blockedRoutes.map((route, index) => `  #${unconditionalIndex + index + 2} ${route.mode === "fallback" ? "Else" : effectiveConditions(route) ? (locale === "es" ? "Con condición" : "Conditional") : (locale === "es" ? "Sin condición" : "No condition")} → ${narrativeNodeLabel(project, event, route.to, locale)} [${route.id}]`),
  ].join("\n");
  return { event, sourceLabel, routeIds, message, technical };
}

/** Turn a reference scan path into its authored owner, keeping indices as technical detail. */
export function authoringUsagePresentation(project: BranchingProject, path: string, locale: "en" | "es") {
  let value: unknown = project;
  const objects: Record<string, unknown>[] = [];
  for (const segment of path.split(".")) {
    if (!value || typeof value !== "object") break;
    value = (value as Record<string, unknown>)[segment];
    if (value && typeof value === "object" && !Array.isArray(value)) objects.push(value as Record<string, unknown>);
  }
  const owner = [...objects].reverse().find(item => typeof item.id === "string");
  const scenario = objects.find(item => project.authoringScenarios?.includes(item as never));
  const event = objects.find(item => project.events.includes(item as never));
  const dialogue = event && objects.find(item => (event.dialogues as unknown[] | undefined)?.includes(item));
  let nodeId = event ? String(event.id) : undefined;
  if (event && owner && owner !== event) {
    const beat = objects.find(item => "blockRef" in item);
    const decision = objects.find(item => "outcomes" in item);
    if (beat) nodeId = `beat:${event.id}:${beat.id}`;
    else if (decision && owner !== decision && (decision.outcomes as unknown[]).includes(owner)) nodeId = `outcome:${event.id}:${decision.id}:${owner.id}`;
    else if (decision) nodeId = `decision:${event.id}:${decision.id}`;
    else if (dialogue) nodeId = `dialogue:${event.id}:${dialogue.id}`;
    else nodeId = String(event.id);
  }
  const labels = objects.map(item => item.visibleText ?? item.name ?? item.title).filter((label): label is string => typeof label === "string" && Boolean(label));
  const category = ({ entityInstances: ["Initial copy", "Copia inicial"], authoringScenarios: ["Scenario", "Escenario"], narrativeActions: ["Action", "Acción"], narrativeRules: ["Rule", "Regla"], entityOverrides: ["Entity exception", "Excepción de entidad"], playerProfiles: ["Player profile", "Perfil"], localExplorerEntities: ["Entity", "Entidad"] } as Record<string, string[]>)[path.split(".")[0]]?.[locale === "es" ? 1 : 0];
  return { label: [category, ...labels].filter(Boolean).join(" → ") || (locale === "es" ? "Configuración de la historia" : "Story configuration"), nodeId, scenarioId: scenario ? String(scenario.id) : undefined, target: scenario ? undefined : authoringDiagnosticTarget(project, String(owner?.id ?? "")) };
}

export function authoringDiagnosticTarget(project: BranchingProject, location?: string): { tab: "entities" | "actions" | "rules"; id: string; entityId?: string } | undefined {
  if (!location) return;
  const candidates = [
    ...(project.narrativeActions ?? []).map(action => ({ tab: "actions" as const, id: action.id })),
    ...(project.narrativeRules ?? []).map(rule => ({ tab: "rules" as const, id: rule.id })),
    ...(project.entityInstances ?? []).map(copy => ({ tab: "entities" as const, id: copy.id, entityId: copy.entityId })),
    ...(project.entityOverrides ?? []).map(override => ({ tab: "entities" as const, id: override.entityId, entityId: override.entityId })),
  ];
  return candidates.sort((a, b) => b.id.length - a.id.length).find(candidate => location === candidate.id || location.startsWith(`${candidate.id}.`) || location.startsWith(`${candidate.id}:`));
}

/** Resolve the owning authored object, including IDs embedded in a diagnostic path. */
const diagnosticCandidates = new WeakMap<BranchingProject, Selection[]>();
export function diagnosticSelection(project: BranchingProject, location?: string): Selection | undefined {
  if (!location) return;
  for (const event of project.events) {
    const use = event.interactionUses?.find(u => location === u.id || location === u.definitionId || event.interactionDefinitions?.find(d => d.id === u.definitionId)?.results.some(r => r.id === location));
    if (use) return { type: 'node', id: use.ownerNodeId ?? `interaction:${event.id}:${use.id}` };
    const barrier = event.interactionBarriers?.find(b => location === b.id);
    if (barrier) return { type: 'node', id: `barrier:${event.id}:${barrier.id}` };
    if (event.interactionDefinitions?.some(d => d.id === location)) return { type: 'node', id: event.id };
  }
  let candidates = diagnosticCandidates.get(project);
  if (!candidates) {
    const next: Selection[] = [];
    for (const event of project.events) {
      next.push({ type: "node", id: event.id });
      for (const item of [...(event.decisions ?? []), ...(event.dialogues ?? []), ...(event.decisions ?? []).flatMap((decision) => decision.outcomes ?? [])]) next.push({ type: "node", id: item.id });
      for (const transition of event.transitions ?? []) next.push({ type: "edge", id: transition.id });
    }
    project.sequences.forEach((item) => next.push({ type: "node", id: item.id }));
    project.branches.forEach((item) => next.push({ type: "node", id: item.id }));
    project.canonRefs.forEach((item) => next.push({ type: "canon", id: item.id }));
    project.localExplorerEntities?.forEach((item) => next.push({ type: "explorerEntity", id: item.id }));
    project.projectDataObjects?.forEach((item) => next.push({ type: "dataObject", id: item.id }));
    candidates = next.sort((a, b) => b.id.length - a.id.length);
    diagnosticCandidates.set(project, candidates);
  }
  return candidates.find((item) => location === item.id || location.startsWith(`${item.id}.`) || location.startsWith(`${item.id}:`) || location.startsWith(`${item.id}/`) || location.includes(`"${item.id}"`));
}

const findingTitles: Partial<Record<ValidationFinding["code"], [string, string]>> = {
  missing_entry_sequence: ["Choose an entry sequence", "Selecciona una secuencia inicial"],
  missing_entry_event: ["Choose an entry event", "Selecciona un evento inicial"],
  missing_event: ["Event reference is missing", "Falta un evento referenciado"],
  missing_dialogue: ["Dialogue reference is missing", "Falta un diálogo referenciado"],
  missing_script: ["Script reference is missing", "Falta un guion referenciado"],
  missing_branch: ["Branch reference is missing", "Falta una rama referenciada"],
  missing_canon_ref: ["Entity reference is missing", "Falta una entidad referenciada"],
  missing_canon_identity: ["Canon identity is missing", "Falta la identidad de canon"],
  duplicate_id: ["An identifier is repeated", "Hay un identificador repetido"],
  broken_transition: ["Route destination is missing", "Falta el destino de una ruta"],
  invalid_branch_membership: ["Review branch membership", "Revisa los eventos de la rama"],
  invalid_nested_event: ["Review the nested event", "Revisa el evento anidado"],
  invalid_boundary_binding: ["Review the event connection", "Revisa la conexión del evento"],
  invalid_final_transition: ["Review routes from this ending", "Revisa las rutas de este final"],
  invalid_projection: ["Review the text projection", "Revisa la proyección de texto"],
  missing_data_class: ["Data class is missing", "Falta una clase de datos"],
  missing_data_object: ["Data object is missing", "Falta un objeto de datos"],
  missing_required_field: ["A required value is missing", "Falta un valor obligatorio"],
  invalid_condition: ["Review this condition", "Revisa esta condición"],
  invalid_interaction: ["Review this interaction", "Revisa esta interacción"],
  invalid_consequence: ["Review this consequence", "Revisa esta consecuencia"],
  missing_grantable_entity: ["Inventory entity is missing", "Falta una entidad de inventario"],
  invalid_transition_order: ["Review route priority", "Revisa la prioridad de las rutas"],
  duplicate_fallback: ["Keep one Else route", "Mantén una sola ruta Else"],
  no_valid_transition: ["Add a route for the remaining cases", "Añade una ruta para los casos restantes"],
  missing_script_block: ["Script block is missing", "Falta un bloque de guion"],
  orphan_script_block: ["Script block has no owner", "El bloque de guion no tiene propietario"],
  duplicate_script_binding: ["Script block is linked twice", "El bloque de guion está enlazado dos veces"],
  invalid_speaker_role: ["Review the speaker", "Revisa el hablante"],
  invalid_speaker_presence: ["Review speaker presence", "Revisa la presencia del hablante"],
  invalid_character_variant: ["Character variant is missing", "Falta una variante del personaje"],
  missing_scene_image: ["Scene image is missing", "Falta una imagen de escena"],
  invalid_scene_image: ["Review the scene image", "Revisa la imagen de escena"],
  missing_event_cover_image: ["Event cover is missing", "Falta la portada del evento"],
  invalid_event_cover_image: ["Review the event cover", "Revisa la portada del evento"],
  invalid_dialogue_trigger: ["Review the dialogue trigger", "Revisa el disparador del diálogo"],
  invalid_scope_transition: ["Route leaves its narrative scope", "La ruta sale de su contexto narrativo"],
  invalid_frontmatter: ["Review the document metadata", "Revisa los metadatos del documento"],
  invalid_worldnotion_properties: ["Review the entity properties", "Revisa las propiedades de la entidad"],
};

export function findingPresentation(finding: ValidationFinding, project: BranchingProject, locale: "en" | "es") {
  let message = finding.message;
  const labels = [...project.events, ...project.sequences, ...(project.localExplorerEntities ?? [])].map((item) => [item.id, item.name]);
  labels.push(...project.branches.map((item) => [item.id, item.title]));
  labels.push(...project.canonRefs.map((item) => [item.id, item.label ?? item.id]));
  labels.push(...(project.narrativeActions ?? []).map(item => [item.id, item.name]));
  labels.push(...(project.narrativeRules ?? []).map(item => [item.id, item.name]));
  labels.push(...(project.entityInstances ?? []).map(item => [item.id, item.name ?? item.entityId]));
  for (const [id, label] of labels.sort((a, b) => b[0].length - a[0].length)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    message = message.replace(new RegExp(`(?<![\\p{L}\\p{N}_:-])${escaped}(?![\\p{L}\\p{N}_:-])`, "gu"), () => label);
  }
  const title = findingTitles[finding.code]?.[locale === "es" ? 1 : 0] ?? finding.code.replaceAll("_", " ");
  const routeOrder = finding.code === "invalid_transition_order" && finding.id
    ? transitionOrderDetails(project, finding.id, locale)
    : undefined;
  return {
    title,
    message: routeOrder?.message ?? message,
    description: routeOrder?.message,
    technical: routeOrder?.technical ?? `${finding.code}: ${finding.message}`,
  };
}
