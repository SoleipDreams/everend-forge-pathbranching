import type { BranchingProject, Consequence, LogicMoment, PlayerSimulationState } from "./domain.js";
import { interactionDefinitionUsesContextualDice } from './interactionDice.js';

export type ModularExportDiagnostic = {
  feature: string;
  location: string;
  message: string;
};

/** Execution features that the existing Ink and Legacy profiles cannot preserve. */
export function modularExportDiagnostics(project: BranchingProject): ModularExportDiagnostic[] {
  const diagnostics: ModularExportDiagnostic[] = [];
  const seen = new Set<string>();
  const add = (feature: string, location: string, description: string) => {
    const key = `${feature}:${location}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push({ feature, location, message: `${description} require the Enhanced runtime profile; this export cannot preserve their execution.` });
  };
  // Empty normalized state is inert. False, zero and explicit null are values.
  const hasValues = (value: unknown): boolean => {
    if (value === undefined) return false;
    if (Array.isArray(value)) return value.some(hasValues);
    if (value !== null && typeof value === "object") return Object.values(value).some(hasValues);
    return true;
  };
  const hasState = (state: PlayerSimulationState | undefined, inheritedObjects = project.projectDataObjects): boolean =>
    hasValues(state) || Boolean(state?.dataObjects !== undefined && inheritedObjects?.length);

  for (const action of project.narrativeActions ?? []) add("narrative-actions", action.id, "Narrative actions and their call/return or jump behavior");
  for (const rule of project.narrativeRules ?? []) add("narrative-rules", rule.id, "Triggered narrative rules and their priorities");
  for (const copy of project.entityInstances ?? []) add("entity-instances", copy.id, "Individual copies, their values and ownership");
  for (const override of project.entityOverrides ?? []) {
    if (override.inventoryModifiers?.length) add('inventory-modifiers', override.entityId, 'Current property values derived from carried or equipped items');
    const { entityId, ...capabilities } = override;
    if (hasValues(capabilities)) add("entity-overrides", entityId, "Individual entity capability exceptions");
  }
  for (const capability of project.logicTypeOverrides ?? []) {
    if (capability.container !== undefined) add("container-capabilities", capability.typeId, "Inherited container capabilities");
  }
  for (const capability of project.logicPropertyOverrides ?? []) {
    if (capability.container !== undefined) add("container-capabilities", capability.propertyId, "Inherited container capabilities");
  }
  if (hasState(project.playerSimulation)) add("initial-state", "playerSimulation", "Authored initial simulation values");
  for (const profile of project.playerProfiles ?? []) {
    if (profile.playableCharacterRef || hasState(profile.simulation)) add("player-profiles", profile.id, "Player actors and initial profile values");
  }
  for (const scenario of project.authoringScenarios ?? []) {
    const profileId = scenario.profileId ?? project.activePlayerProfileId ?? project.playerProfiles?.[0]?.id;
    const base = project.playerProfiles?.find(profile => profile.id === profileId)?.simulation ?? project.playerSimulation;
    if (scenario.actor || scenario.profileId || scenario.startNodeId || hasState(scenario.state, base?.dataObjects ?? project.projectDataObjects)) add("authoring-scenarios", scenario.id, "Named initial scenarios, their actors and entry points");
  }
  for (const event of project.events) {
    for (const definition of event.interactionDefinitions ?? []) if (event.interactionUses?.some(use => use.definitionId === definition.id)) {
      add('interactions-v1', definition.id, 'Interaction definitions and mechanics');
      if (definition.mechanic.kind === 'opposedcheck') add('opposed-interactions-v1', definition.id, 'Opposed checks with independent participant rolls and results');
      if (interactionDefinitionUsesContextualDice(definition)) add('contextual-dice-v1', definition.id, 'Contextual dice recipes, result intervals, zero-based faces and conditional modifiers');
      const mechanic = definition.mechanic;
      if (mechanic.kind === 'dice' && (mechanic.groups?.length ?? 0) > 1 || mechanic.kind === 'skillcheck' && (mechanic.dice?.groups?.length ?? 0) > 1 || mechanic.kind === 'opposedcheck' && ((mechanic.commonDice?.groups?.length ?? 0) > 1 || [mechanic.actor, ...mechanic.rivals].some(participant => (participant.dice?.groups?.length ?? 0) > 1))) add('compound-dice-v1', definition.id, 'Mixed dice pools');
    }
    for (const use of event.interactionUses ?? []) add('interactions-v1', use.id, 'Gameplay interactions, results and wait barriers');
    for (const barrier of event.interactionBarriers ?? []) add('interactions-v1', barrier.id, 'Interaction wait barriers');
    if (event.parentEventId || event.childEventIds?.length) add("nested-event-structure", event.id, "Nested event entry and parent/child execution");
    if (event.boundaryBindings?.length || event.transitions?.some(route => /^(boundary|dialogue-boundary):/.test(route.from) || /^(boundary|dialogue-boundary):/.test(route.to))) add("boundary-execution", event.id, "Event or dialogue boundary entry and exit routes");
  }
  if (project.logicFormats && Object.values(project.logicFormats).some(value => value !== undefined)) {
    add("logic-formats-v1", "logicFormats", "Project-wide option availability and decision presentation formats");
  }

  // The authoring engine defaults entry/route effects to once per run. Ink's
  // existing event profile replays them after a return, so a potential cycle
  // needs the modular consumer even when no explicit `repeat` was written.
  const eventIds = new Set(project.events.map(event => event.id));
  const outcomeSources = new Map(project.events.map(event => [event.id, new Set((event.decisions ?? []).flatMap(decision => decision.outcomes.map(outcome => `outcome:${event.id}:${decision.id}:${outcome.id}`)))]));
  const eventRoutes = new Map(project.events.map(event => [event.id, (event.transitions ?? []).filter(route => (route.from === event.id || outcomeSources.get(event.id)!.has(route.from)) && eventIds.has(route.to))]));
  const reaches = (start: string, target: string): boolean => {
    const pending = [start], visited = new Set<string>();
    while (pending.length) {
      const current = pending.pop()!;
      if (current === target) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const route of eventRoutes.get(current) ?? []) pending.push(route.to);
    }
    return false;
  };
  const implicitOnceEffects = (owner: { logic?: LogicMoment; consequences?: Consequence[] }) => owner.logic?.repeat === undefined && Boolean(
    (owner.logic?.then ?? owner.consequences)?.length || owner.logic?.narrativeEffects?.length || owner.logic?.rules?.some(rule => rule.then.length),
  );
  for (const event of project.events) {
    const returningRoutes = (eventRoutes.get(event.id) ?? []).filter(route => reaches(route.to, event.id));
    if (!returningRoutes.length) continue;
    if (implicitOnceEffects(event)) add("cyclic-once-effects", event.id, "Once-per-run effects on an event that can be re-entered");
    for (const route of returningRoutes) if (implicitOnceEffects(route)) add("cyclic-once-effects", route.id, "Once-per-run effects on a route that can be repeated");
    for (const decision of event.decisions ?? []) for (const outcome of decision.outcomes) {
      const source = `outcome:${event.id}:${decision.id}:${outcome.id}`;
      if (returningRoutes.some(route => route.from === source) && implicitOnceEffects(outcome)) add("cyclic-once-effects", outcome.id, "Once-per-run effects on an answer that can be selected again");
    }
  }

  // Walk only authored execution structures. Text, arbitrary property/value data,
  // canvas state and temporary tester state are never interpreted as logic.
  const children = new Set([
    "logic", "when", "then", "rules", "narrativeEffects", "effects",
    "availability", "conditions", "consequences", "displayCondition",
    "all", "any", "not", "filters", "query", "subject", "owner",
    "decisions", "outcomes", "dialogues", "dialogueBeats", "beats",
    "dialogueStarts", "transitions",
  ]);
  const walk = (value: unknown, location: string, logic = false): void => {
    if (Array.isArray(value)) { value.forEach(item => walk(item, location, logic)); return; }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const owner = typeof item.id === "string" ? item.id : location;
    if (logic) {
      if (Array.isArray(item.narrativeEffects) && item.narrativeEffects.length) add("narrative-effects", `${owner}.logic.narrativeEffects`, "Ordered modular narrative effects");
      if (item.repeat !== undefined) add("entry-repeat", `${owner}.logic.repeat`, "Explicit once/repeat entry semantics");
      if (Array.isArray(item.effectOrder) && item.effectOrder.length) add("effect-order", `${owner}.logic.effectOrder`, "Interleaved ordinary and copy effect order");
    }
    if (item.type === "instanceQuery") add("instance-query", owner, "Queries over individual copies");
    if (item.type === "instanceEffect") add("instance-effect", owner, "Copy creation, transfer, modification or removal effects");
    if (item.kind === "instance") add("instance-subject", owner, "References to individual copies");
    if (item.kind === "context") add("context-subject", owner, "Actor, self or recipient context references");
    for (const [key, child] of Object.entries(item)) if (children.has(key)) walk(child, owner, key === "logic");
  };
  for (const owner of [...project.sequences, ...project.branches, ...project.events, ...(project.projectDataObjects ?? [])]) walk(owner, owner.id);
  // Diagnose nested conditions/effects too, even when their containing action or
  // rule has already made the profile unavailable.
  for (const owner of [...(project.narrativeActions ?? []), ...(project.narrativeRules ?? [])]) walk(owner, owner.id);
  return diagnostics;
}
