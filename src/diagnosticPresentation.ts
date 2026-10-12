import type { BranchingProject, ValidationFinding } from "./domain.js";
import type { Selection } from "./appTypes.js";

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
  return { title, message, technical: `${finding.code}: ${finding.message}` };
}
