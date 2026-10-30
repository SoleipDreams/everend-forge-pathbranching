import type {
  Branch,
  BranchingProject,
  CanvasNodeAuthoringState,
  CanonEditSuggestion,
  ConditionInput,
  Consequence,
  DataFieldDefinition,
  Decision,
  DialogueBeat,
  DialogueMemberRef,
  DialogueNode,
  DialogueStart,
  EventNode,
  EventType,
  Outcome,
  ProjectDataObject,
  Sequence,
  Transition,
} from "./domain.js";
import {
  conditionInputsFromConsequences,
  inferredTransitionRole,
  migrateLogicMoment,
  walkConditions,
} from "./logic.js";
import { authoringNodeExists } from "./authoringEngine.js";
import { scriptBlockTextKey } from "./localization.js";
import { canvasScopeKey } from "./storySelection.js";
import { automaticEventName, automaticNarrativeName } from "./narrativeNaming.js";

export type MutationSelection =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | { type: "dataObject"; id: string }
  | { type: "canonSuggestion"; id: string }
  | { type: "explorerEntity"; id: string }
  | { type: "explorerType"; id: string; source: "canon" | "local" }
  | { type: "explorerProperty"; id: string; source: "canon" | "local" };

export type MutationResult = {
  project: BranchingProject;
  selection?: MutationSelection;
  message?: string;
};

export type DialogueBeatPreset = {
  characterRef?: string;
  characterVariantId?: string;
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueId(base: string, existingIds: Iterable<string>) {
  const existing = new Set(existingIds);
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function withoutValue(values: string[] | undefined, value: string) {
  return (values ?? []).filter((item) => item !== value);
}

export function withValue(values: string[] | undefined, value: string) {
  return values?.includes(value) ? values : [...(values ?? []), value];
}

export function activeSequenceId(project: BranchingProject) {
  return (
    project.canvas?.activeSequenceId ??
    project.entrySequenceId ??
    project.sequences[0]?.id
  );
}

export function findEvent(
  project: BranchingProject,
  id: string,
): EventNode | undefined {
  return project.events.find((event) => event.id === id);
}

type LogicOwnerShape = {
  logic?: { when?: ConditionInput; then?: Consequence[]; rules?: unknown[] };
  availability?: ConditionInput;
  conditions?: ConditionInput;
  displayCondition?: ConditionInput;
  consequences?: Consequence[];
};

function synchronizeLogicOwner<T extends LogicOwnerShape>(
  current: T,
  updates: Partial<T>,
): T {
  const has = (key: keyof LogicOwnerShape) => Object.prototype.hasOwnProperty.call(updates, key);
  const explicitLogic = updates.logic ?? current.logic;
  const updatesWhen = has("availability") || has("conditions") || has("displayCondition");
  const when = has("availability")
    ? updates.availability
    : has("conditions")
      ? updates.conditions
      : has("displayCondition")
        ? updates.displayCondition
        : explicitLogic?.when;
  const then = has("consequences") ? updates.consequences : explicitLogic?.then;
  const logic = updatesWhen || has("consequences") || updates.logic
    ? {
        ...explicitLogic,
        ...(updatesWhen ? { when } : {}),
        ...(has("consequences") ? { then } : {}),
      }
    : current.logic;
  // Older documents can carry the same condition in more than one legacy
  // field. Clear or update those aliases together so a removed condition
  // cannot reappear through a fallback such as conditions ?? availability.
  const synchronizedConditions: Partial<LogicOwnerShape> = {
    ...(updatesWhen && (has("availability") || current.availability !== undefined) ? { availability: when } : {}),
    ...(updatesWhen && (has("conditions") || current.conditions !== undefined) ? { conditions: when } : {}),
    ...(updatesWhen && (has("displayCondition") || current.displayCondition !== undefined) ? { displayCondition: when } : {}),
  };
  return { ...current, ...synchronizedConditions, ...updates, logic } as T;
}

export function normalizeTransitionRoles(
  transitions: Transition[] | undefined,
  project: Pick<BranchingProject, "logicVariables">,
): Transition[] {
  const sourceGroups = new Map<string, Transition[]>();
  (transitions ?? []).forEach((transition) => {
    sourceGroups.set(transition.from, [
      ...(sourceGroups.get(transition.from) ?? []),
      transition,
    ]);
  });

  const normalized = new Map<string, Transition>();
  sourceGroups.forEach((group) => {
    const ordered = [...group].sort((left, right) => {
      if (left.mode === "fallback" && right.mode !== "fallback") return 1;
      if (right.mode === "fallback" && left.mode !== "fallback") return -1;
      return (left.order ?? 0) - (right.order ?? 0);
    });
    let fallbackSeen = false;
    ordered.forEach((transition, order) => {
      const requestedFallback = transition.mode === "fallback" && !fallbackSeen;
      fallbackSeen ||= requestedFallback;
      const mode = requestedFallback ? "fallback" : "conditional";
      const logic = migrateLogicMoment(
        transition.id,
        mode === "fallback" ? undefined : transition.conditions,
        transition.consequences,
        transition.logic,
        project.logicVariables ?? [],
      );
      const role = inferredTransitionRole(
        {
          ...transition,
          role: undefined,
          mode,
          logic,
        },
        ordered.length,
      );
      normalized.set(
        transition.id,
        role === "flow"
          ? {
              id: transition.id,
              from: transition.from,
              to: transition.to,
              role: "flow",
              order: 0,
              mode: "conditional",
              source: transition.source,
              label: transition.label,
            }
          : {
              ...transition,
              role: "route",
              order,
              mode,
              logic,
              conditions: mode === "fallback" ? undefined : logic?.when,
              consequences: logic?.then,
            },
      );
    });
  });
  return (transitions ?? []).map((transition) => normalized.get(transition.id) ?? transition);
}

export function isTerminalEventType(
  project: BranchingProject,
  type: string | undefined,
) {
  return Boolean(
    type &&
    (type === "final" ||
      project.eventCategories?.some(
        (category) => category.id === type && category.terminal,
      )),
  );
}

export function removeMissingEventReference(
  project: BranchingProject,
  ownerId: string,
  missingEventId: string,
): MutationResult {
  const sequence = project.sequences.find((item) => item.id === ownerId);
  if (sequence) {
    return {
      project: {
        ...project,
        sequences: project.sequences.map((item) =>
          item.id === ownerId
            ? { ...item, eventIds: withoutValue(item.eventIds, missingEventId) }
            : item,
        ),
      },
      selection: undefined,
    };
  }
  const branch = project.branches.find((item) => item.id === ownerId);
  if (branch) {
    return {
      project: {
        ...project,
        branches: project.branches.map((item) =>
          item.id === ownerId
            ? { ...item, eventIds: withoutValue(item.eventIds, missingEventId) }
            : item,
        ),
      },
      selection: undefined,
    };
  }
  const event = findEvent(project, ownerId);
  if (event) {
    return {
      project: {
        ...project,
        events: project.events.map((item) =>
          item.id === ownerId
            ? {
                ...item,
                childEventIds: withoutValue(item.childEventIds, missingEventId),
              }
            : item,
        ),
      },
      selection: undefined,
    };
  }
  return { project, message: "Reference owner not found." };
}

export function findBoundaryBindingOwnerId(
  project: BranchingProject,
  bindingId: string,
): string | undefined {
  return project.events.find((event) =>
    event.boundaryBindings?.some((binding) => binding.id === bindingId),
  )?.id;
}

export function removeBoundaryBinding(
  project: BranchingProject,
  bindingId: string,
): MutationResult {
  return {
    project: {
      ...project,
      events: project.events.map((event) => ({
        ...event,
        boundaryBindings: event.boundaryBindings?.filter(
          (binding) => binding.id !== bindingId,
        ),
        transitions: event.transitions?.filter(
          (transition) => transition.id !== `transition:boundary:${bindingId}`,
        ),
      })),
    },
    selection: undefined,
  };
}

export function updateSequence(
  project: BranchingProject,
  id: string,
  updates: Partial<Sequence>,
): MutationResult {
  return {
    project: {
      ...project,
      sequences: project.sequences.map((sequence) =>
        sequence.id === id ? synchronizeLogicOwner(sequence, updates) : sequence,
      ),
    },
  };
}

export function setEntrySequence(
  project: BranchingProject,
  id: string,
): MutationResult {
  return {
    project: {
      ...project,
      entrySequenceId: id,
      canvas: { ...project.canvas, activeSequenceId: id },
    },
    selection: { type: "node", id },
  };
}

export function createSequence(
  project: BranchingProject,
  name = "New Sequence",
): MutationResult {
  const trimmedName = name.trim() || "New Sequence";
  const sequenceId = uniqueId(
    `sequence:${slugify(trimmedName) || "new-route"}`,
    project.sequences.map((sequence) => sequence.id),
  );
  const eventId = uniqueId(
    `event:${sequenceId}:entry`,
    project.events.map((event) => event.id),
  );
  const newEvent: EventNode = {
    id: eventId,
    name: automaticEventName({ ...project, events: [], sequences: [] }, "normal"),
    type: "normal",
    text: { format: "plain", content: "" },
    canonRefs: [],
    transitions: [],
  };
  const newSequence: Sequence = {
    id: sequenceId,
    name: trimmedName,
    entryEventId: eventId,
    eventIds: [eventId],
    branchIds: [],
  };

  return {
    project: {
      ...project,
      sequences: [...project.sequences, newSequence],
      events: [...project.events, newEvent],
      canvas: { ...project.canvas, activeSequenceId: sequenceId },
    },
    selection: { type: "node", id: sequenceId },
  };
}

export function deleteSequence(
  project: BranchingProject,
  sequenceId: string,
): MutationResult {
  const sequence = project.sequences.find((item) => item.id === sequenceId);
  if (!sequence) return { project, message: "Sequence not found." };
  if (project.sequences.length <= 1) {
    return { project, message: "Cannot delete the only sequence in a story." };
  }

  const deletedEventIds = new Set(sequence.eventIds);
  const deletedBranchIds = new Set([
    ...(sequence.branchIds ?? []),
    ...project.branches
      .filter((branch) =>
        branch.eventIds.some((eventId) => deletedEventIds.has(eventId)) ||
        project.events.some((event) => deletedEventIds.has(event.id) && event.branchRef === branch.id),
      )
      .map((branch) => branch.id),
  ]);
  for (const branch of project.branches) {
    if (deletedBranchIds.has(branch.id)) {
      branch.eventIds.forEach((eventId) => deletedEventIds.add(eventId));
    }
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const event of project.events) {
      const belongsToDeletedContent =
        deletedBranchIds.has(event.branchRef ?? "") ||
        deletedEventIds.has(event.parentEventId ?? "") ||
        event.childEventIds?.some((eventId) => deletedEventIds.has(eventId));
      if (belongsToDeletedContent && !deletedEventIds.has(event.id)) {
        deletedEventIds.add(event.id);
        expanded = true;
      }
    }
  }
  const deletedDialogueIds = new Set(
    project.events
      .filter((event) => deletedEventIds.has(event.id))
      .flatMap((event) => (event.dialogues ?? []).map((dialogue) => dialogue.id)),
  );
  const nextSequences = project.sequences
    .filter((item) => item.id !== sequenceId)
    .map((item) => ({
      ...item,
      eventIds: item.eventIds.filter((eventId) => !deletedEventIds.has(eventId)),
      branchIds: item.branchIds?.filter((branchId) => !deletedBranchIds.has(branchId)),
    }));
  const nextSequenceId = nextSequences[0]?.id;
  const currentEntrySequenceId = project.entrySequenceId ?? project.sequences[0]?.id;
  const removedNodeIds = new Set([
    sequenceId,
    ...deletedEventIds,
    ...deletedBranchIds,
    ...project.events
      .filter((event) => deletedEventIds.has(event.id))
      .flatMap((event) => [
        ...(event.dialogues ?? []).flatMap((dialogue) => [dialogue.id, `dialogue:${event.id}:${dialogue.id}`]),
        ...(event.dialogueBeats ?? []).flatMap((beat) => [beat.id, `beat:${event.id}:${beat.id}`]),
        ...(event.dialogueStarts ?? []).map((start) => `dialogue-start:${event.id}:${start.id}`),
        ...(event.interactionUses ?? []).flatMap((use) => [use.id, `interaction:${event.id}:${use.id}`]),
        ...(event.interactionBarriers ?? []).flatMap((barrier) => [barrier.id, `barrier:${event.id}:${barrier.id}`]),
        ...(event.decisions ?? []).flatMap((decision) => [
          decision.id,
          `decision:${event.id}:${decision.id}`,
          ...decision.outcomes.flatMap((outcome) => [outcome.id, `outcome:${event.id}:${decision.id}:${outcome.id}`]),
        ]),
      ]),
  ]);
  const belongsToDeletedEvent = (nodeId: string) => Array.from(deletedEventIds).some((id) =>
    nodeId.startsWith(`boundary:${id}:`) || nodeId.startsWith(`dialogue-boundary:${id}:`),
  );
  const isRemovedNodeId = (nodeId: string) => removedNodeIds.has(nodeId) || belongsToDeletedEvent(nodeId);
  const deletedDataObjectIds = new Set(
    (project.projectDataObjects ?? [])
      .filter((item) =>
        item.scope?.sequenceId === sequenceId ||
        deletedBranchIds.has(item.scope?.branchId ?? "") ||
        deletedEventIds.has(item.scope?.eventId ?? ""),
      )
      .map((item) => item.id),
  );
  const nextScopes = Object.fromEntries(
    Object.entries(project.canvas?.scopes ?? {}).filter(([scopeKey]) =>
      scopeKey !== canvasScopeKey({ kind: "sequence", id: sequenceId }) &&
      !Array.from(deletedEventIds).some((eventId) => scopeKey === canvasScopeKey({ kind: "event", id: eventId })) &&
      !Array.from(deletedDialogueIds).some((dialogueId) => scopeKey === `dialogue:${dialogueId}`),
    ),
  );

  const nextProjectBeforePruning: BranchingProject = {
    ...project,
    entrySequenceId: currentEntrySequenceId === sequenceId ? nextSequenceId : currentEntrySequenceId,
    sequences: nextSequences,
    branches: project.branches.filter((branch) => !deletedBranchIds.has(branch.id)),
    events: project.events
      .filter((event) => !deletedEventIds.has(event.id))
      .map((event) => ({
        ...event,
        branchRef: deletedBranchIds.has(event.branchRef ?? "") ? undefined : event.branchRef,
        parentEventId: deletedEventIds.has(event.parentEventId ?? "") ? undefined : event.parentEventId,
        childEventIds: event.childEventIds?.filter((eventId) => !deletedEventIds.has(eventId)),
        transitions: event.transitions?.filter((transition) => !isRemovedNodeId(transition.from) && !isRemovedNodeId(transition.to)),
        boundaryBindings: event.boundaryBindings?.filter((binding) => !isRemovedNodeId(binding.nodeId) && !isRemovedNodeId(binding.portId)),
      })),
    projectDataObjects: project.projectDataObjects?.filter((item) => !deletedDataObjectIds.has(item.id)),
    canvas: {
      ...project.canvas,
      activeSequenceId: nextSequenceId,
      activeScope: nextSequenceId ? { kind: "sequence", id: nextSequenceId } : undefined,
      nodes: Object.fromEntries(
        Object.entries(project.canvas?.nodes ?? {}).filter(([id]) => !isRemovedNodeId(id)),
      ),
      scopes: nextScopes,
    },
  };
  const nextProject = pruneDanglingNarrativeMetadata({
    ...nextProjectBeforePruning,
    events: nextProjectBeforePruning.events.map((event) => ({
      ...event,
      transitions: event.transitions?.filter((transition) => !hasMissingNarrativeReference(nextProjectBeforePruning, transition)),
    })),
  });

  return {
    project: nextProject,
    selection: nextSequenceId ? { type: "node", id: nextSequenceId } : undefined,
    message: `Deleted sequence "${sequence.name}" and ${deletedEventIds.size} event${deletedEventIds.size === 1 ? "" : "s"}.`,
  };
}

/**
 * Deletes a branch while keeping events that still belong to a sequence.
 * Event files left outside every sequence are removed with the branch that
 * still owns them, even when branch.eventIds was already lost or cleared.
 */
export function deleteBranch(
  project: BranchingProject,
  branchId: string,
): MutationResult {
  const branch = project.branches.find((item) => item.id === branchId);
  if (!branch) return { project, message: "Branch not found." };

  const sequenceEventIds = new Set(project.sequences.flatMap((sequence) => sequence.eventIds));
  const deletedEventIds = new Set(
    [...branch.eventIds, ...project.events.filter((event) => event.branchRef === branchId).map((event) => event.id)]
      .filter((eventId) => !sequenceEventIds.has(eventId)),
  );
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const event of project.events) {
      if (sequenceEventIds.has(event.id) || deletedEventIds.has(event.id)) continue;
      if (deletedEventIds.has(event.parentEventId ?? "") || event.childEventIds?.some((id) => deletedEventIds.has(id))) {
        deletedEventIds.add(event.id);
        expanded = true;
      }
    }
  }

  const deletedDialogueIds = new Set(
    project.events.filter((event) => deletedEventIds.has(event.id)).flatMap((event) => (event.dialogues ?? []).map((dialogue) => dialogue.id)),
  );
  const removedNodeIds = new Set([
    branchId,
    ...deletedEventIds,
    ...project.events.filter((event) => deletedEventIds.has(event.id)).flatMap((event) => [
      ...(event.dialogues ?? []).flatMap((dialogue) => [dialogue.id, `dialogue:${event.id}:${dialogue.id}`]),
      ...(event.dialogueBeats ?? []).flatMap((beat) => [beat.id, `beat:${event.id}:${beat.id}`]),
      ...(event.dialogues ?? []).flatMap((dialogue) => (dialogue.beats ?? []).flatMap((beat) => [beat.id, `beat:${event.id}:${beat.id}`])),
      ...(event.dialogueStarts ?? []).map((start) => `dialogue-start:${event.id}:${start.id}`),
      ...(event.interactionUses ?? []).flatMap((use) => [use.id, `interaction:${event.id}:${use.id}`]),
      ...(event.interactionBarriers ?? []).flatMap((barrier) => [barrier.id, `barrier:${event.id}:${barrier.id}`]),
      ...(event.decisions ?? []).flatMap((decision) => [
        decision.id,
        `decision:${event.id}:${decision.id}`,
        ...decision.outcomes.flatMap((outcome) => [outcome.id, `outcome:${event.id}:${decision.id}:${outcome.id}`]),
      ]),
    ]),
  ]);
  const belongsToDeletedEvent = (nodeId: string) => Array.from(deletedEventIds).some((id) =>
    nodeId.startsWith(`boundary:${id}:`) || nodeId.startsWith(`dialogue-boundary:${id}:`),
  );
  const isRemovedNodeId = (nodeId: string) => removedNodeIds.has(nodeId) || belongsToDeletedEvent(nodeId);
  const baseProject: BranchingProject = {
    ...project,
    branches: project.branches
      .filter((item) => item.id !== branchId)
      .map((item) => ({ ...item, eventIds: item.eventIds.filter((eventId) => !deletedEventIds.has(eventId)) })),
    sequences: project.sequences.map((sequence) => ({
      ...sequence,
      eventIds: sequence.eventIds.filter((eventId) => !deletedEventIds.has(eventId)),
      branchIds: sequence.branchIds?.filter((id) => id !== branchId),
    })),
    events: project.events
      .filter((event) => !deletedEventIds.has(event.id))
      .map((event) => ({
        ...event,
        branchRef: event.branchRef === branchId ? undefined : event.branchRef,
        parentEventId: deletedEventIds.has(event.parentEventId ?? "") ? undefined : event.parentEventId,
        childEventIds: event.childEventIds?.filter((id) => !deletedEventIds.has(id)),
        transitions: event.transitions?.filter((transition) => !isRemovedNodeId(transition.from) && !isRemovedNodeId(transition.to)),
        boundaryBindings: event.boundaryBindings?.filter((binding) =>
          !isRemovedNodeId(binding.nodeId) && !isRemovedNodeId(binding.portId),
        ),
      })),
    projectDataObjects: project.projectDataObjects?.filter((item) =>
      item.scope?.branchId !== branchId && !deletedEventIds.has(item.scope?.eventId ?? ""),
    ),
    canvas: {
      ...project.canvas,
      nodes: Object.fromEntries(Object.entries(project.canvas?.nodes ?? {}).filter(([id]) => !isRemovedNodeId(id))),
      scopes: Object.fromEntries(Object.entries(project.canvas?.scopes ?? {}).filter(([scopeKey]) =>
        !Array.from(deletedEventIds).some((eventId) => scopeKey === canvasScopeKey({ kind: "event", id: eventId })) &&
        !Array.from(deletedDialogueIds).some((dialogueId) => scopeKey === `dialogue:${dialogueId}`),
      )),
    },
  };
  const nextProjectBeforePruning: BranchingProject = {
    ...baseProject,
    events: baseProject.events.map((event) => ({
      ...event,
      transitions: event.transitions?.filter((transition) => !hasMissingNarrativeReference(baseProject, transition)),
    })),
  };
  const nextProject = pruneDanglingNarrativeMetadata(nextProjectBeforePruning);

  return {
    project: nextProject,
    message: `Deleted branch "${branch.title}" and removed ${deletedEventIds.size} orphaned event${deletedEventIds.size === 1 ? "" : "s"}.`,
  };
}

function hasMissingNarrativeReference(project: BranchingProject, value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasMissingNarrativeReference(project, item));
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const subject = item.subject && typeof item.subject === "object"
    ? item.subject as Record<string, unknown>
    : undefined;
  if (subject?.kind === "variable" && !(project.logicVariables ?? []).some((variable) => variable.id === subject.variableId)) return true;
  if (subject?.kind === "dataObject" && !(project.projectDataObjects ?? []).some((dataObject) => dataObject.id === subject.objectId)) return true;
  if (subject?.kind === "progress") {
    const targets = subject.targetType === "sequence" ? project.sequences
      : subject.targetType === "branch" ? project.branches
        : subject.targetType === "event" ? project.events
          : subject.targetType === "decision" ? project.events.flatMap((event) => event.decisions ?? [])
            : subject.targetType === "outcome" ? project.events.flatMap((event) => (event.decisions ?? []).flatMap((decision) => decision.outcomes))
              : [];
    if (!targets.some((target) => target.id === subject.targetId)) return true;
  }
  if (item.type === "visited" && subject?.kind === "progress") {
    const target = { kind: "progress", targetType: subject.targetType, targetId: subject.targetId };
    if (hasMissingNarrativeReference(project, { subject: target })) return true;
  }
  if (item.type === "interactionResult" && typeof item.useId === "string") {
    const use = project.events.flatMap((event) => (event.interactionUses ?? []).map((entry) => ({ event, entry }))).find(({ entry }) => entry.id === item.useId);
    if (!use || !use.event.interactionDefinitions?.find((definition) => definition.id === use.entry.definitionId)?.results.some((result) => result.id === item.resultId)) return true;
  }
  if (typeof item.targetNodeId === "string" && !authoringNodeExists(project, item.targetNodeId)) return true;
  return Object.values(item).some((child) => hasMissingNarrativeReference(project, child));
}

function narrativeScopeExists(project: BranchingProject, scope: unknown): boolean {
  if (!scope || typeof scope !== "object") return true;
  const value = scope as Record<string, unknown>;
  if (value.kind === "global") return true;
  if (value.kind === "event") return project.events.some((event) => event.id === value.id);
  if (value.kind === "dialogue") return project.events.some((event) => event.dialogues?.some((dialogue) => dialogue.id === value.id));
  if (value.kind === "node" && typeof value.id === "string") return authoringNodeExists(project, value.id);
  return false;
}

export function pruneDanglingNarrativeMetadata(project: BranchingProject): BranchingProject {
  const narrativeActions = project.narrativeActions?.filter((action) => !hasMissingNarrativeReference(project, action));
  const narrativeRules = project.narrativeRules?.filter((rule) =>
    narrativeScopeExists(project, rule.scope) && !hasMissingNarrativeReference(project, rule),
  );
  const authoringScenarios = project.authoringScenarios?.filter((scenario) =>
    (!scenario.startNodeId || authoringNodeExists(project, scenario.startNodeId)) && !hasMissingNarrativeReference(project, scenario),
  ).map((scenario) => scenario.state?.variables
    ? { ...scenario, state: { ...scenario.state, variables: Object.fromEntries(Object.entries(scenario.state.variables).filter(([id]) => (project.logicVariables ?? []).some((variable) => variable.id === id))) } }
    : scenario);
  return {
    ...project,
    ...(narrativeActions ? { narrativeActions } : {}),
    ...(narrativeRules ? { narrativeRules } : {}),
    ...(authoringScenarios ? { authoringScenarios } : {}),
  };
}

export function canSaveAfterRemovingStaleScenarioReferences(
  project: BranchingProject,
  saveBlockReasons: readonly string[] | undefined,
): boolean {
  if (!saveBlockReasons?.length || !saveBlockReasons.every((reason) =>
    reason.includes("has a saved event file and an active scenario reference but is absent from"),
  )) return false;
  if ((project.narrativeActions ?? []).some((action) => hasMissingNarrativeReference(project, action))) return false;
  if ((project.narrativeRules ?? []).some((rule) =>
    !narrativeScopeExists(project, rule.scope) || hasMissingNarrativeReference(project, rule),
  )) return false;
  return !(project.authoringScenarios ?? []).some((scenario) =>
    Boolean(scenario.startNodeId && !authoringNodeExists(project, scenario.startNodeId)) || hasMissingNarrativeReference(project, scenario),
  );
}

export function createBranch(
  project: BranchingProject,
  position?: { x: number; y: number },
): MutationResult {
  const sequenceId = activeSequenceId(project);
  if (!sequenceId) {
    return { project, message: "Create a sequence before adding branches." };
  }

  const branchId = uniqueId(
    `branch:${slugify(sequenceId)}:section`,
    project.branches.map((branch) => branch.id),
  );
  const newBranch: Branch = {
    id: branchId,
    title: "New Branch",
    description: "",
    eventIds: [],
  };
  const canvasNodes = position
    ? {
        ...project.canvas?.nodes,
        [branchId]: {
          ...project.canvas?.nodes?.[branchId],
          position,
        },
      }
    : project.canvas?.nodes;

  return {
    project: {
      ...project,
      branches: [...project.branches, newBranch],
      sequences: project.sequences.map((sequence) =>
        sequence.id === sequenceId
          ? { ...sequence, branchIds: withValue(sequence.branchIds, branchId) }
          : sequence,
      ),
      canvas: {
        ...project.canvas,
        activeSequenceId: sequenceId,
        nodes: canvasNodes,
      },
    },
    selection: { type: "node", id: branchId },
  };
}

export function createEvent(
  project: BranchingProject,
  type: EventType = "normal",
  position?: { x: number; y: number },
  branchId?: string,
): MutationResult {
  const sequenceId = activeSequenceId(project);
  if (!sequenceId) {
    return { project, message: "Create a sequence before adding events." };
  }

  const safeType = type || "normal";
  const eventId = uniqueId(
    `event:${slugify(sequenceId)}:${safeType}`,
    project.events.map((event) => event.id),
  );
  const targetBranch = branchId
    ? project.branches.find((branch) => branch.id === branchId)
    : undefined;
  const newEvent: EventNode = {
    id: eventId,
    name: automaticEventName(project, safeType, undefined, targetBranch?.id),
    type: safeType,
    text: { format: "plain", content: "" },
    branchRef: targetBranch?.id,
    canonRefs: [],
    transitions: [],
  };
  const canvasNodes = position
    ? {
        ...project.canvas?.nodes,
        [eventId]: {
          ...project.canvas?.nodes?.[eventId],
          position,
        },
      }
    : project.canvas?.nodes;

  return {
    project: {
      ...project,
      sequences: project.sequences.map((sequence) =>
        sequence.id === sequenceId
          ? {
              ...sequence,
              entryEventId: sequence.entryEventId || eventId,
              eventIds: withValue(sequence.eventIds, eventId),
              branchIds: targetBranch
                ? withValue(sequence.branchIds, targetBranch.id)
                : sequence.branchIds,
            }
          : sequence,
      ),
      branches: project.branches.map((branch) =>
        branch.id === targetBranch?.id
          ? { ...branch, eventIds: withValue(branch.eventIds, eventId) }
          : branch,
      ),
      events: [...project.events, newEvent],
      canvas: {
        ...project.canvas,
        activeSequenceId: sequenceId,
        nodes: canvasNodes,
      },
    },
    selection: { type: "node", id: eventId },
  };
}

export function createNestedEvent(
  project: BranchingProject,
  parentEventId: string,
  type: EventType = "normal",
  position?: { x: number; y: number },
): MutationResult {
  const parentEvent = findEvent(project, parentEventId);
  if (!parentEvent) {
    return { project, message: "Parent event not found." };
  }

  const safeType = type || "normal";
  const eventId = uniqueId(
    `event:${slugify(parentEvent.name || parentEvent.id)}:${safeType}`,
    project.events.map((event) => event.id),
  );
  const newEvent: EventNode = {
    id: eventId,
    name: automaticEventName(project, safeType, parentEventId, parentEvent.branchRef ?? undefined),
    type: safeType,
    parentEventId,
    childEventIds: [],
    text: { format: "plain", content: "" },
    canonRefs: [],
    decisions: [],
    dialogues: [],
    transitions: [],
    boundaryBindings: [],
  };
  const scopeKey = canvasScopeKey({ kind: "event", id: parentEventId });
  const scopedNodes = position
    ? {
        ...(project.canvas?.scopes?.[scopeKey]?.nodes ?? {}),
        [eventId]: {
          ...project.canvas?.scopes?.[scopeKey]?.nodes?.[eventId],
          position,
        },
      }
    : project.canvas?.scopes?.[scopeKey]?.nodes;

  return {
    project: {
      ...project,
      events: [
        ...project.events.map((event) =>
          event.id === parentEventId
            ? {
                ...event,
                childEventIds: withValue(event.childEventIds, eventId),
              }
            : event,
        ),
        newEvent,
      ],
      canvas: {
        ...project.canvas,
        activeScope: { kind: "event", id: parentEventId },
        scopes: {
          ...(project.canvas?.scopes ?? {}),
          [scopeKey]: {
            ...(project.canvas?.scopes?.[scopeKey] ?? {}),
            nodes: scopedNodes,
          },
        },
      },
    },
    selection: { type: "node", id: eventId },
  };
}

export function updateBranch(
  project: BranchingProject,
  id: string,
  updates: Partial<Branch>,
): MutationResult {
  return {
    project: {
      ...project,
      branches: project.branches.map((branch) =>
        branch.id === id ? synchronizeLogicOwner(branch, updates) : branch,
      ),
    },
  };
}

export function updateEvent(
  project: BranchingProject,
  id: string,
  updates: Partial<EventNode>,
): MutationResult {
  return {
    project: {
      ...project,
      events: project.events.map((event) =>
        event.id === id ? synchronizeLogicOwner(event, updates) : event,
      ),
    },
  };
}

export function createDecision(
  project: BranchingProject,
  eventId: string,
  dialogueId?: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const decisionId = uniqueId(
    `decision:${slugify(event.name || event.id)}`,
    (event.decisions ?? []).map((decision) => decision.id),
  );
  const decision: Decision = {
    id: decisionId,
    name: automaticNarrativeName(project, eventId, "Decision"),
    description: "",
    type: "dialogue",
    optionStyle: "visibleText",
    dialogueId,
    outcomes: [],
  };

  const result = updateEvent(project, eventId, {
    decisions: [...(event.decisions ?? []), decision],
    dialogues: dialogueId
      ? (event.dialogues ?? []).map((dialogue) => dialogue.id === dialogueId
          ? { ...dialogue, members: [...(dialogue.members ?? []), { kind: "decision" as const, id: decision.id }] }
          : dialogue)
      : event.dialogues,
  });
  return {
    ...result,
    selection: { type: "node", id: `decision:${eventId}:${decision.id}` },
  };
}

export function updateDecision(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
  updates: Partial<Decision>,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  return updateEvent(project, eventId, {
    decisions: (event.decisions ?? []).map((decision) =>
      decision.id === decisionId ? synchronizeLogicOwner(decision, updates) : decision,
    ),
  });
}

export function deleteDecision(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const removedNodeIds = new Set([
    `decision:${eventId}:${decisionId}`,
    ...(event.decisions
      ?.find((decision) => decision.id === decisionId)
      ?.outcomes ?? [])
      .map((outcome) => `outcome:${eventId}:${decisionId}:${outcome.id}`),
  ]);
  const removedProgressTargets = new Set([
    decisionId,
    ...(event.decisions?.find((item) => item.id === decisionId)?.outcomes ?? []).map((outcome) => outcome.id),
  ]);
  const updated = updateEvent(project, eventId, {
    decisions: (event.decisions ?? []).filter(
      (decision) => decision.id !== decisionId,
    ),
    boundaryBindings: (event.boundaryBindings ?? []).filter(
      (binding) => !removedNodeIds.has(binding.nodeId),
    ),
    dialogues: (event.dialogues ?? []).map((dialogue) => ({
      ...dialogue,
      members: (dialogue.members ?? []).filter((member) => !(member.kind === "decision" && member.id === decisionId)),
    })),
  });
  const withoutRoutes: BranchingProject = {
    ...updated.project,
    events: updated.project.events.map((item) => ({
      ...item,
      transitions: item.transitions?.filter(
        (transition) =>
          !removedNodeIds.has(transition.from) &&
          !removedNodeIds.has(transition.to) &&
          !referencesProgressTarget(transition, removedProgressTargets),
      ),
    })),
  };
  return {
    ...updated,
    project: pruneDanglingNarrativeMetadata(removeCanvasNodeReferences(withoutRoutes, removedNodeIds)),
  };
}

function referencesProgressTarget(value: unknown, targetIds: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) return value.some((item) => referencesProgressTarget(item, targetIds));
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (
    (item.type === "visited" && (item.targetType === "decision" || item.targetType === "outcome") &&
      typeof item.targetId === "string" && targetIds.has(item.targetId)) ||
    (item.kind === "progress" && (item.targetType === "decision" || item.targetType === "outcome") &&
      typeof item.targetId === "string" && targetIds.has(item.targetId))
  ) return true;
  return Object.values(item).some((child) => referencesProgressTarget(child, targetIds));
}

/** Remove persisted layout and routing hints for nodes that no longer exist. */
export function removeCanvasNodeReferences(project: BranchingProject, nodeIds: ReadonlySet<string>): BranchingProject {
  if (!project.canvas || nodeIds.size === 0) return project;
  const canvas = project.canvas;
  const filterNodes = (nodes: typeof canvas.nodes) => nodes
    ? Object.fromEntries(Object.entries(nodes).filter(([id]) => !nodeIds.has(id)))
    : undefined;
  const scopes = canvas.scopes
    ? Object.fromEntries(Object.entries(canvas.scopes).map(([key, scope]) => [key, {
        ...scope,
        nodes: filterNodes(scope.nodes),
        routeGateSources: scope.routeGateSources?.filter((id) => !nodeIds.has(id)),
      }]))
    : undefined;
  return {
    ...project,
    canvas: {
      ...canvas,
      nodes: filterNodes(canvas.nodes),
      routeGateSources: canvas.routeGateSources?.filter((id) => !nodeIds.has(id)),
      ...(scopes ? { scopes } : {}),
    },
  };
}

export function createOutcome(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  const decision = event?.decisions?.find((item) => item.id === decisionId);
  if (!event || !decision) {
    return { project, message: "Decision not found." };
  }
  const outcomeId = uniqueId(
    `outcome:${slugify(decision.name || decision.id)}`,
    decision.outcomes.map((outcome) => outcome.id),
  );
  const outcome: Outcome = {
    id: outcomeId,
    name: automaticNarrativeName(project, eventId, "Option", { decisionId }),
    visibleText: "",
    description: "",
    requiredCanonRefs: [],
    consequences: [],
    unavailableBehavior: "locked",
  };
  return updateDecision(project, eventId, decisionId, {
    outcomes: [...decision.outcomes, outcome],
  });
}

export function updateOutcome(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
  outcomeId: string,
  updates: Partial<Outcome>,
): MutationResult {
  const event = findEvent(project, eventId);
  const decision = event?.decisions?.find((item) => item.id === decisionId);
  if (!event || !decision) {
    return { project, message: "Decision not found." };
  }
  return updateDecision(project, eventId, decisionId, {
    outcomes: decision.outcomes.map((outcome) =>
      outcome.id === outcomeId ? synchronizeLogicOwner(outcome, updates) : outcome,
    ),
  });
}

export type OutcomeDropPosition = "before" | "after";

/** Reorder decision options while keeping their stable IDs and connected routes intact. */
export function reorderOutcomeList<T extends { id: string }>(
  outcomes: T[],
  outcomeId: string,
  targetOutcomeId: string,
  position: OutcomeDropPosition = "before",
): T[] {
  const sourceIndex = outcomes.findIndex((outcome) => outcome.id === outcomeId);
  const targetIndex = outcomes.findIndex((outcome) => outcome.id === targetOutcomeId);
  if (sourceIndex < 0 || targetIndex < 0 || outcomeId === targetOutcomeId) return outcomes;
  const reordered = [...outcomes];
  const [moved] = reordered.splice(sourceIndex, 1);
  const adjustedTargetIndex = reordered.findIndex((outcome) => outcome.id === targetOutcomeId);
  const insertionIndex = adjustedTargetIndex + (position === "after" ? 1 : 0);
  reordered.splice(insertionIndex, 0, moved);
  return reordered;
}

export function reorderOutcome(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
  outcomeId: string,
  targetOutcomeId: string,
  position: OutcomeDropPosition = "before",
): MutationResult {
  const decision = findEvent(project, eventId)?.decisions?.find((item) => item.id === decisionId);
  if (!decision) return { project, message: "Decision not found." };
  const outcomes = reorderOutcomeList(decision.outcomes, outcomeId, targetOutcomeId, position);
  return outcomes === decision.outcomes ? { project } : updateDecision(project, eventId, decisionId, { outcomes });
}

export function deleteOutcome(
  project: BranchingProject,
  eventId: string,
  decisionId: string,
  outcomeId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  const decision = event?.decisions?.find((item) => item.id === decisionId);
  if (!event || !decision) {
    return { project, message: "Decision not found." };
  }
  const outcome = decision.outcomes.find((item) => item.id === outcomeId);
  if (!outcome) return { project, message: "Outcome not found." };

  const outcomeNodeId = `outcome:${eventId}:${decisionId}:${outcomeId}`;
  const removedUseIds = new Set(
    (event.interactionUses ?? [])
      .filter((use) => use.ownerNodeId === outcomeNodeId)
      .map((use) => use.id),
  );
  const removedDefinitionIds = new Set(
    (event.interactionUses ?? [])
      .filter((use) => removedUseIds.has(use.id))
      .map((use) => use.definitionId),
  );
  const removedBarrierIds = new Set(
    (event.interactionBarriers ?? [])
      .filter((barrier) => barrier.useIds.length > 0 && barrier.useIds.every((id) => removedUseIds.has(id)))
      .map((barrier) => barrier.id),
  );
  const removedNodeIds = new Set([
    outcomeNodeId,
    ...Array.from(removedBarrierIds, (id) => `barrier:${eventId}:${id}`),
  ]);
  const removedProgressTargets = new Set([outcomeId]);
  const updated = updateDecision(project, eventId, decisionId, {
    outcomes: decision.outcomes.filter((outcome) => outcome.id !== outcomeId),
  });
  const withoutReferences: BranchingProject = {
    ...updated.project,
    events: updated.project.events.map((item) => {
      const isOwnerEvent = item.id === eventId;
      const remainingUses = isOwnerEvent
        ? (item.interactionUses ?? []).filter((use) => !removedUseIds.has(use.id))
        : item.interactionUses;
      return {
        ...item,
        ...(isOwnerEvent ? {
          interactionUses: remainingUses,
          interactionDefinitions: item.interactionDefinitions?.filter((definition) =>
            !removedDefinitionIds.has(definition.id) || remainingUses?.some((use) => use.definitionId === definition.id),
          ),
          interactionBarriers: (item.interactionBarriers ?? [])
            .filter((barrier) => !removedBarrierIds.has(barrier.id))
            .map((barrier) => ({ ...barrier, useIds: barrier.useIds.filter((id) => !removedUseIds.has(id)) })),
        } : {}),
        transitions: item.transitions?.filter((transition) =>
          !removedNodeIds.has(transition.from) &&
          !removedNodeIds.has(transition.to) &&
          !referencesProgressTarget(transition, removedProgressTargets) &&
          !referencesInteractionUseReference(transition, removedUseIds),
        ),
        boundaryBindings: item.boundaryBindings?.filter((binding) => !removedNodeIds.has(binding.nodeId)),
      };
    }),
  };
  return {
    ...updated,
    project: pruneDanglingNarrativeMetadata(removeCanvasNodeReferences(withoutReferences, removedNodeIds)),
  };
}

function referencesInteractionUseReference(value: unknown, useIds: ReadonlySet<string>): boolean {
  if (!useIds.size) return false;
  if (Array.isArray(value)) return value.some((item) => referencesInteractionUseReference(item, useIds));
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (item.type === "interactionResult" && typeof item.useId === "string" && useIds.has(item.useId)) return true;
  return Object.values(item).some((child) => referencesInteractionUseReference(child, useIds));
}

export function createDialogue(
  project: BranchingProject,
  eventId: string,
  title?: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const dialogueId = uniqueId(
    `dialogue:${slugify(event.name || event.id)}:${Date.now().toString(36)}`,
    (event.dialogues ?? []).map((dialogue) => dialogue.id),
  );
  const dialogue: DialogueNode = {
    id: dialogueId,
    title: title?.trim() || automaticNarrativeName(project, eventId, "Conversation"),
    text: { format: "plain", content: "" },
    canonRefs: [],
    presentEntityRefs: [],
    beats: [],
    members: [],
  };
  const result = updateEvent(project, eventId, {
    dialogues: [...(event.dialogues ?? []), dialogue],
  });
  return {
    ...result,
    selection: { type: "node", id: `dialogue:${eventId}:${dialogue.id}` },
  };
}

export function groupDialogueMembers(
  project: BranchingProject,
  eventId: string,
  members: DialogueMemberRef[],
  title?: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event || members.length === 0) return { project, message: "Select beats or decisions from one event." };
  const beatIds = new Set(members.filter((member) => member.kind === "beat").map((member) => member.id));
  const decisionIds = new Set(members.filter((member) => member.kind === "decision").map((member) => member.id));
  const selectedBeats = (event.dialogueBeats ?? []).filter((beat) => beatIds.has(beat.id));
  const selectedDecisions = (event.decisions ?? []).filter((decision) => decisionIds.has(decision.id) && !decision.dialogueId);
  if (selectedBeats.length !== beatIds.size || selectedDecisions.length !== decisionIds.size) {
    return { project, message: "Only ungrouped beats and decisions can create a Dialogue." };
  }
  const dialogueId = uniqueId(
    `dialogue:${slugify(event.name || event.id)}:${Date.now().toString(36)}`,
    (event.dialogues ?? []).map((dialogue) => dialogue.id),
  );
  const dialogue: DialogueNode = {
    id: dialogueId,
    title: title?.trim() || automaticNarrativeName(project, eventId, "Conversation"),
    text: { format: "plain", content: "" },
    canonRefs: [],
    beats: selectedBeats,
    members,
    entryBeatId: selectedBeats[0]?.id,
  };
  return {
    project: {
      ...project,
      events: project.events.map((candidate) => candidate.id === eventId ? {
        ...candidate,
        dialogueBeats: (candidate.dialogueBeats ?? []).filter((beat) => !beatIds.has(beat.id)),
        decisions: (candidate.decisions ?? []).map((decision) => decisionIds.has(decision.id)
          ? { ...decision, dialogueId }
          : decision),
        dialogues: [...(candidate.dialogues ?? []), dialogue],
      } : candidate),
    },
    selection: { type: "node", id: `dialogue:${eventId}:${dialogueId}` },
    message: `Created Dialogue from ${members.length} selected nodes.`,
  };
}

export function detachDialogueMembers(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  members?: DialogueMemberRef[],
): MutationResult {
  const event = findEvent(project, eventId);
  const dialogue = event?.dialogues?.find((item) => item.id === dialogueId);
  if (!event || !dialogue) return { project, message: "Dialogue not found." };
  const removing = members?.length ? members : (dialogue.members ?? [
    ...(dialogue.beats ?? []).map((beat) => ({ kind: "beat" as const, id: beat.id })),
    ...(event.decisions ?? []).filter((decision) => decision.dialogueId === dialogueId).map((decision) => ({ kind: "decision" as const, id: decision.id })),
  ]);
  const beatIds = new Set(removing.filter((member) => member.kind === "beat").map((member) => member.id));
  const decisionIds = new Set(removing.filter((member) => member.kind === "decision").map((member) => member.id));
  const detachedBeats = (dialogue.beats ?? []).filter((beat) => beatIds.has(beat.id));
  const remainingMembers = (dialogue.members ?? []).filter((member) =>
    !removing.some((candidate) => candidate.kind === member.kind && candidate.id === member.id),
  );
  const dissolve = remainingMembers.length === 0;
  return {
    project: {
      ...project,
      events: project.events.map((candidate) => candidate.id === eventId ? {
        ...candidate,
        dialogueBeats: [...(candidate.dialogueBeats ?? []), ...detachedBeats],
        decisions: (candidate.decisions ?? []).map((decision) => decisionIds.has(decision.id)
          ? { ...decision, dialogueId: undefined }
          : decision),
        dialogues: dissolve
          ? (candidate.dialogues ?? []).filter((item) => item.id !== dialogueId)
          : (candidate.dialogues ?? []).map((item) => item.id === dialogueId ? {
              ...item,
              members: remainingMembers,
              beats: (item.beats ?? []).filter((beat) => !beatIds.has(beat.id)),
              entryBeatId: beatIds.has(item.entryBeatId ?? "")
                ? (item.beats ?? []).find((beat) => !beatIds.has(beat.id))?.id
                : item.entryBeatId,
            } : item),
        dialogueStarts: dissolve
          ? (candidate.dialogueStarts ?? []).filter((start) => start.dialogueId !== dialogueId)
          : candidate.dialogueStarts,
      } : candidate),
    },
    message: dissolve ? "Dissolved Dialogue." : `Detached ${removing.length} members.`,
  };
}

export function createDialogueStart(
  project: BranchingProject,
  eventId: string,
  source?: DialogueStart["source"],
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) return { project, message: "Event not found." };
  const id = uniqueId("dialogue-trigger", (event.dialogueStarts ?? []).map((start) => start.id));
  const start: DialogueStart = { id, source };
  const updated = updateEvent(project, eventId, { dialogueStarts: [...(event.dialogueStarts ?? []), start] });
  return { ...updated, selection: { type: "node", id: `dialogue-start:${eventId}:${id}` } };
}

export function updateDialogueStart(
  project: BranchingProject,
  eventId: string,
  startId: string,
  updates: Partial<DialogueStart>,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) return { project, message: "Event not found." };
  return updateEvent(project, eventId, {
    dialogueStarts: (event.dialogueStarts ?? []).map((start) => start.id === startId ? synchronizeLogicOwner(start, updates) : start),
  });
}

export function deleteDialogueStart(project: BranchingProject, eventId: string, startId: string): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) return { project, message: "Event not found." };
  const nodeId = `dialogue-start:${eventId}:${startId}`;
  return updateEvent(project, eventId, {
    dialogueStarts: (event.dialogueStarts ?? []).filter((start) => start.id !== startId),
    transitions: (event.transitions ?? []).filter((transition) => transition.from !== nodeId && transition.to !== nodeId),
  });
}

export function updateDialogue(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  updates: Partial<DialogueNode>,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  return updateEvent(project, eventId, {
    dialogues: (event.dialogues ?? []).map((dialogue) =>
      dialogue.id === dialogueId ? synchronizeLogicOwner(dialogue, updates) : dialogue,
    ),
  });
}

export function createScriptDocument(
  project: BranchingProject,
  name = "New Script",
): MutationResult {
  const id = uniqueId(
    `script:${slugify(name) || "script"}`,
    (project.scriptDocuments ?? []).map((document) => document.id),
  );
  return {
    project: {
      ...project,
      scriptDocuments: [
        ...(project.scriptDocuments ?? []),
        { id, name, format: "forge-script", blocks: [] },
      ],
    },
    message: `Created script "${name}".`,
  };
}

export function createDialogueBeat(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  kind: DialogueBeat["kind"] = "speech",
  preset?: DialogueBeatPreset,
  setAsEntry = true,
): MutationResult {
  const event = findEvent(project, eventId);
  const dialogue = event?.dialogues?.find((item) => item.id === dialogueId);
  if (!event || !dialogue) return { project, message: "Dialogue not found." };
  let scriptDocuments = project.scriptDocuments ?? [];
  let scriptId = dialogue.beats?.[0]?.blockRef.scriptId;
  if (!scriptId || !scriptDocuments.some((document) => document.id === scriptId)) {
    scriptId = uniqueId(
      `script:dialogue:${eventId}:${dialogueId}`,
      scriptDocuments.map((document) => document.id),
    );
    scriptDocuments = [
      ...scriptDocuments,
      { id: scriptId, name: dialogue.title, format: "forge-script", blocks: [] },
    ];
  }
  const script = scriptDocuments.find((document) => document.id === scriptId)!;
  const existingEventBeatIds = [
    ...(event.dialogueBeats ?? []),
    ...(event.dialogues ?? []).flatMap((item) => item.beats ?? []),
  ].map((beat) => beat.id);
  const beatId = uniqueId(
    `beat:dialogue:${dialogueId}:${kind}`,
    existingEventBeatIds,
  );
  const blockId = uniqueId(
    `block:${kind}`,
    script.blocks.map((block) => block.id),
  );
  const beat: DialogueBeat = {
    id: beatId,
    kind,
    blockRef: { scriptId, blockId },
  };
  const nextDocuments = scriptDocuments.map((document) =>
    document.id === scriptId
      ? {
          ...document,
          blocks: [
            ...document.blocks,
            {
              id: blockId,
              kind: kind === "speech" ? "speech" as const : "direction" as const,
              textKey: scriptBlockTextKey(scriptId, blockId),
              content: "",
              ...(kind === "speech" && preset?.characterRef
                ? {
                    characterRef: preset.characterRef,
                    ...(preset.characterVariantId && preset.characterVariantId !== "base"
                      ? { characterVariantId: preset.characterVariantId }
                      : {}),
                  }
                : {}),
            },
          ],
        }
      : document,
  );
  const updated = updateDialogue(project, eventId, dialogueId, {
    entryBeatId: dialogue.entryBeatId ?? (setAsEntry ? beatId : undefined),
    beats: [...(dialogue.beats ?? []), beat],
    members: [...(dialogue.members ?? []), { kind: "beat", id: beatId }],
  });
  return {
    ...updated,
    project: { ...updated.project, scriptDocuments: nextDocuments },
    selection: { type: "node", id: `beat:${eventId}:${beatId}` },
  };
}

/** Create a narrative beat directly on an event, without requiring a dialogue container. */
export function createEventDialogueBeat(
  project: BranchingProject,
  eventId: string,
  kind: DialogueBeat["kind"] = "speech",
  preset?: DialogueBeatPreset,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) return { project, message: "Event not found." };
  let scriptDocuments = project.scriptDocuments ?? [];
  let scriptId = `script:event:${eventId}:dialogue`;
  if (!scriptDocuments.some((document) => document.id === scriptId)) {
    scriptId = uniqueId(scriptId, scriptDocuments.map((document) => document.id));
    scriptDocuments = [...scriptDocuments, {
      id: scriptId,
      name: `${event.name} dialogue`,
      format: "forge-script",
      blocks: [],
    }];
  }
  const script = scriptDocuments.find((document) => document.id === scriptId)!;
  const existingEventBeatIds = [
    ...(event.dialogueBeats ?? []),
    ...(event.dialogues ?? []).flatMap((item) => item.beats ?? []),
  ].map((beat) => beat.id);
  const beatId = uniqueId(`beat:event:${eventId}:${kind}`, existingEventBeatIds);
  const blockId = uniqueId(`block:${kind}`, script.blocks.map((block) => block.id));
  const beat: DialogueBeat = { id: beatId, kind, blockRef: { scriptId, blockId } };
  return {
    project: {
      ...project,
      scriptDocuments: scriptDocuments.map((document) => document.id === scriptId
        ? {
            ...document,
            blocks: [
              ...document.blocks,
              {
                id: blockId,
                kind: kind === "speech" ? "speech" as const : "direction" as const,
                textKey: scriptBlockTextKey(scriptId, blockId),
                content: "",
                ...(kind === "speech" && preset?.characterRef
                  ? {
                      characterRef: preset.characterRef,
                      ...(preset.characterVariantId && preset.characterVariantId !== "base"
                        ? { characterVariantId: preset.characterVariantId }
                        : {}),
                    }
                  : {}),
              },
            ],
          }
        : document),
      events: project.events.map((item) => item.id === eventId
        ? { ...item, dialogueBeats: [...(item.dialogueBeats ?? []), beat] }
        : item),
    },
    selection: { type: "node", id: `beat:${eventId}:${beatId}` },
  };
}

export function updateEventDialogueBeat(
  project: BranchingProject,
  eventId: string,
  beatId: string,
  updates: Partial<DialogueBeat>,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event?.dialogueBeats?.some((beat) => beat.id === beatId)) return { project, message: "Dialogue beat not found." };
  return updateEvent(project, eventId, {
    dialogueBeats: event.dialogueBeats.map((beat) => beat.id === beatId ? synchronizeLogicOwner(beat, updates) : beat),
  });
}

export function deleteEventDialogueBeat(
  project: BranchingProject,
  eventId: string,
  beatId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  const beat = event?.dialogueBeats?.find((item) => item.id === beatId);
  if (!event || !beat) return { project, message: "Dialogue beat not found." };
  const nodeId = `beat:${eventId}:${beatId}`;
  return {
    project: {
      ...project,
      events: project.events.map((item) => ({
        ...item,
        dialogueBeats: item.id === eventId ? (item.dialogueBeats ?? []).filter((candidate) => candidate.id !== beatId) : item.dialogueBeats,
        transitions: item.transitions?.filter((transition) => transition.from !== nodeId && transition.to !== nodeId),
        boundaryBindings: (item.boundaryBindings ?? []).filter((binding) => binding.nodeId !== nodeId),
      })),
      scriptDocuments: (project.scriptDocuments ?? []).map((document) => document.id === beat.blockRef.scriptId
        ? { ...document, blocks: document.blocks.filter((block) => block.id !== beat.blockRef.blockId) }
        : document),
    },
  };
}

export function updateDialogueBeat(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  beatId: string,
  updates: Partial<DialogueBeat>,
): MutationResult {
  const event = findEvent(project, eventId);
  const dialogue = event?.dialogues?.find((item) => item.id === dialogueId);
  if (!event || !dialogue) return { project, message: "Dialogue not found." };
  return updateDialogue(project, eventId, dialogueId, {
    beats: (dialogue.beats ?? []).map((beat) => beat.id === beatId ? synchronizeLogicOwner(beat, updates) : beat),
  });
}

export function updateScriptBlock(
  project: BranchingProject,
  scriptId: string,
  blockId: string,
  updates: Partial<NonNullable<BranchingProject["scriptDocuments"]>[number]["blocks"][number]>,
): MutationResult {
  const updatesCharacterRef = Object.prototype.hasOwnProperty.call(updates, "characterRef");
  const updatesSpeakerRef = Object.prototype.hasOwnProperty.call(updates, "speakerRef");
  const normalizedUpdates = updatesCharacterRef
    ? { ...updates, speakerRef: updates.characterRef }
    : updatesSpeakerRef
      ? { ...updates, characterRef: updates.speakerRef }
      : updates;
  return {
    project: {
      ...project,
      scriptDocuments: (project.scriptDocuments ?? []).map((document) =>
        document.id === scriptId
          ? {
              ...document,
              blocks: document.blocks.map((block) => block.id === blockId ? { ...block, ...normalizedUpdates } : block),
            }
          : document,
      ),
    },
  };
}

export function createScriptBlock(
  project: BranchingProject,
  scriptId: string,
  kind: "scene" | "direction" | "speech" | "annotation",
): MutationResult {
  const script = project.scriptDocuments?.find((document) => document.id === scriptId);
  if (!script) return { project, message: "Script not found." };
  const blockId = uniqueId(`block:${kind}`, script.blocks.map((block) => block.id));
  return {
    project: {
      ...project,
      scriptDocuments: (project.scriptDocuments ?? []).map((document) =>
        document.id === scriptId
          ? { ...document, blocks: [...document.blocks, { id: blockId, kind, textKey: scriptBlockTextKey(scriptId, blockId), content: "" }] }
          : document,
      ),
    },
  };
}

export function updateScriptDocument(
  project: BranchingProject,
  scriptId: string,
  updates: { name?: string },
): MutationResult {
  return {
    project: {
      ...project,
      scriptDocuments: (project.scriptDocuments ?? []).map((document) =>
        document.id === scriptId ? { ...document, ...updates } : document,
      ),
    },
  };
}

export function linkScriptBlockToDialogue(
  project: BranchingProject,
  scriptId: string,
  blockId: string,
  eventId: string,
  dialogueId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  const dialogue = event?.dialogues?.find((item) => item.id === dialogueId);
  const block = project.scriptDocuments?.find((script) => script.id === scriptId)?.blocks.find((item) => item.id === blockId);
  if (!event || !dialogue || !block) return { project, message: "Script block or dialogue not found." };
  const existingEventBeatIds = [
    ...(event.dialogueBeats ?? []),
    ...(event.dialogues ?? []).flatMap((item) => item.beats ?? []),
  ].map((beat) => beat.id);
  const beatId = uniqueId(
    `beat:dialogue:${dialogueId}:${block.kind === "speech" ? "speech" : "direction"}`,
    existingEventBeatIds,
  );
  const beat: DialogueBeat = {
    id: beatId,
    kind: block.kind === "speech" ? "speech" : "direction",
    blockRef: { scriptId, blockId },
  };
  const updated = updateDialogue(project, eventId, dialogueId, {
    entryBeatId: dialogue.entryBeatId ?? beatId,
    beats: [...(dialogue.beats ?? []), beat],
    members: [...(dialogue.members ?? []), { kind: "beat", id: beatId }],
  });
  return {
    ...updated,
    selection: { type: "node", id: `beat:${eventId}:${beatId}` },
    message: `Inserted script block into "${dialogue.title}".`,
  };
}

export function deleteDialogueBeat(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  beatId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  const dialogue = event?.dialogues?.find((item) => item.id === dialogueId);
  const beat = dialogue?.beats?.find((item) => item.id === beatId);
  if (!event || !dialogue || !beat) return { project, message: "Dialogue beat not found." };
  const nodeId = `beat:${eventId}:${beatId}`;
  const remainingBeats = (dialogue.beats ?? []).filter((item) => item.id !== beatId);
  const updated = updateDialogue(project, eventId, dialogueId, {
    entryBeatId: dialogue.entryBeatId === beatId ? remainingBeats[0]?.id : dialogue.entryBeatId,
    beats: remainingBeats,
    members: (dialogue.members ?? []).filter((member) => !(member.kind === "beat" && member.id === beatId)),
  });
  return {
    ...updated,
    project: {
      ...updated.project,
      events: updated.project.events.map((item) => ({
        ...item,
        transitions: item.transitions?.filter((transition) => transition.from !== nodeId && transition.to !== nodeId),
        boundaryBindings: (item.boundaryBindings ?? []).filter(
          (binding) => binding.nodeId !== nodeId,
        ),
      })),
      scriptDocuments: (updated.project.scriptDocuments ?? []).map((document) =>
        document.id === beat.blockRef.scriptId
          ? { ...document, blocks: document.blocks.filter((block) => block.id !== beat.blockRef.blockId) }
          : document,
      ),
    },
  };
}

export function deleteDialogue(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const dialogueNodeId = `dialogue:${eventId}:${dialogueId}`;
  const dialogue = event.dialogues?.find((item) => item.id === dialogueId);
  const removedNodeIds = new Set([
    dialogueNodeId,
    `dialogue-boundary:${eventId}:${dialogueId}:input`,
    `dialogue-boundary:${eventId}:${dialogueId}:output`,
    ...(dialogue?.beats ?? []).map((beat) => `beat:${eventId}:${beat.id}`),
  ]);
  return updateEvent(project, eventId, {
    dialogues: (event.dialogues ?? []).filter(
      (dialogue) => dialogue.id !== dialogueId,
    ),
    decisions: (event.decisions ?? []).map((decision) => decision.dialogueId === dialogueId ? { ...decision, dialogueId: undefined } : decision),
    dialogueStarts: (event.dialogueStarts ?? []).filter((start) => start.dialogueId !== dialogueId),
    transitions: (event.transitions ?? []).filter(
      (transition) => !removedNodeIds.has(transition.from) && !removedNodeIds.has(transition.to),
    ),
    boundaryBindings: (event.boundaryBindings ?? []).filter(
      (binding) => !removedNodeIds.has(binding.nodeId),
    ),
  });
}

export function bindBoundaryPort(
  project: BranchingProject,
  eventId: string,
  portId: string,
  nodeId: string,
  direction: "input" | "output",
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const bindingId = uniqueId(
    `boundary-binding:${slugify(portId)}:${slugify(nodeId)}`,
    (event.boundaryBindings ?? []).map((binding) => binding.id),
  );
  return updateEvent(project, eventId, {
    boundaryBindings: [
      ...(event.boundaryBindings ?? []).filter(
        (binding) => !(binding.portId === portId && binding.nodeId === nodeId),
      ),
      { id: bindingId, portId, nodeId, direction },
    ],
  });
}

export function createInternalTransition(
  project: BranchingProject,
  eventId: string,
  from: string,
  to: string,
): MutationResult {
  const event = findEvent(project, eventId);
  if (!event) {
    return { project, message: "Event not found." };
  }
  const existing = event.transitions ?? [];
  const duplicate = existing.find(
    (transition) => transition.from === from && transition.to === to,
  );
  if (duplicate) {
    return {
      project,
      selection: { type: "edge", id: `edge:transition:${duplicate.id}` },
    };
  }
  const transition: Transition = {
    id: uniqueId(
      `transition:${slugify(from)}:${slugify(to)}`,
      existing.map((item) => item.id),
    ),
    from,
    to,
    order: existing.filter((item) => item.from === from).length,
    mode: "conditional",
    role: "flow",
    source: "graph",
  };
  const transitions = normalizeTransitionRoles([...existing, transition], project);
  return {
    project: {
      ...project,
      events: project.events.map((item) =>
        item.id === eventId
          ? { ...item, transitions }
          : item,
      ),
    },
    selection: { type: "edge", id: `edge:transition:${transition.id}` },
  };
}

/**
 * Removes an unfinished Entry/End port and any local connections that were
 * drawn to it. These slots are temporary authoring affordances, so leaving
 * their scope must not leave dangling boundary transitions behind.
 */
export function removeBoundaryPortSlot(
  project: BranchingProject,
  eventId: string,
  direction: "input" | "output",
  slotId: string,
  dialogueId?: string,
): BranchingProject {
  const scopeKey = dialogueId
    ? canvasScopeKey({ kind: "dialogue", id: dialogueId, eventId })
    : canvasScopeKey({ kind: "event", id: eventId });
  const portId = dialogueId
    ? `dialogue-boundary:${eventId}:${dialogueId}:${direction}:${slotId}`
    : `boundary:${eventId}:${direction}:${slotId}`;
  const scope = project.canvas?.scopes?.[scopeKey];
  const slots = direction === "input" ? scope?.entrySlots ?? [] : scope?.exitSlots ?? [];
  const { [portId]: _removedPosition, ...nodes } = scope?.nodes ?? {};
  const remainingSlots = slots.filter((candidate) => candidate !== slotId);
  const nextScope = { ...scope, nodes: Object.keys(nodes).length ? nodes : undefined };
  if (direction === "input") {
    if (remainingSlots.length) nextScope.entrySlots = remainingSlots;
    else delete nextScope.entrySlots;
  } else if (remainingSlots.length) nextScope.exitSlots = remainingSlots;
  else delete nextScope.exitSlots;
  const nextScopes = { ...(project.canvas?.scopes ?? {}) };
  if (!Object.keys(nextScope).some((key) => (nextScope as Record<string, unknown>)[key] !== undefined)) delete nextScopes[scopeKey];
  else nextScopes[scopeKey] = nextScope;
  if (dialogueId) {
    return {
      ...project,
      canvas: {
        ...project.canvas,
        scopes: nextScopes,
      },
    };
  }
  return {
    ...project,
    events: project.events.map((event) => {
      const removedBindingIds = new Set(
        (event.boundaryBindings ?? [])
          .filter((binding) => binding.portId === portId)
          .map((binding) => binding.id),
      );
      return {
        ...event,
        transitions: event.transitions?.filter((transition) =>
          transition.from !== portId &&
          transition.to !== portId &&
          !removedBindingIds.has(transition.id.replace(/^transition:boundary:/, "")),
        ),
        boundaryBindings: event.boundaryBindings?.filter((binding) => binding.portId !== portId),
      };
    }),
    canvas: {
      ...project.canvas,
      scopes: nextScopes,
    },
  };
}

/**
 * Turns a temporary subcanvas port into the stable port for its newly-created
 * external transition, preserving any internal routes already wired to it.
 */
export function resolveBoundaryPortSlot(
  project: BranchingProject,
  eventId: string,
  direction: "input" | "output",
  slotId: string,
  transitionId: string,
): BranchingProject {
  const scopeKey = canvasScopeKey({ kind: "event", id: eventId });
  const previousPortId = `boundary:${eventId}:${direction}:${slotId}`;
  const resolvedPortId = `boundary:${eventId}:${direction}:transition:${transitionId}`;
  const scope = project.canvas?.scopes?.[scopeKey];
  const slots = direction === "input" ? scope?.entrySlots ?? [] : scope?.exitSlots ?? [];
  const { [previousPortId]: _removedPosition, ...nodes } = scope?.nodes ?? {};
  const remainingSlots = slots.filter((candidate) => candidate !== slotId);
  const nextScope = { ...scope, nodes: Object.keys(nodes).length ? nodes : undefined };
  if (direction === "input") {
    if (remainingSlots.length) nextScope.entrySlots = remainingSlots;
    else delete nextScope.entrySlots;
  } else if (remainingSlots.length) nextScope.exitSlots = remainingSlots;
  else delete nextScope.exitSlots;
  const nextScopes = { ...(project.canvas?.scopes ?? {}) };
  if (!Object.keys(nextScope).some((key) => (nextScope as Record<string, unknown>)[key] !== undefined)) delete nextScopes[scopeKey];
  else nextScopes[scopeKey] = nextScope;
  return {
    ...project,
    events: project.events.map((event) => ({
      ...event,
      transitions: event.transitions?.map((transition) => ({
        ...transition,
        from: transition.from === previousPortId ? resolvedPortId : transition.from,
        to: transition.to === previousPortId ? resolvedPortId : transition.to,
      })),
      boundaryBindings: event.boundaryBindings?.map((binding) =>
        binding.portId === previousPortId ? { ...binding, portId: resolvedPortId } : binding,
      ),
    })),
    canvas: {
      ...project.canvas,
      scopes: nextScopes,
    },
  };
}

/**
 * Resolves a temporary conversation Entry/End affordance into a persistent
 * visual port for its route. Incoming routes keep their own entry ports;
 * outgoing routes converge on the conversation's single movable output.
 */
export function resolveDialogueBoundaryPortSlot(
  project: BranchingProject,
  eventId: string,
  dialogueId: string,
  direction: "input" | "output",
  slotId: string,
  transitionId: string,
): BranchingProject {
  const scopeKey = canvasScopeKey({ kind: "dialogue", id: dialogueId, eventId });
  const previousPortId = `dialogue-boundary:${eventId}:${dialogueId}:${direction}:${slotId}`;
  const resolvedPortId = direction === "output"
    ? `dialogue-boundary:${eventId}:${dialogueId}:output`
    : `dialogue-boundary:${eventId}:${dialogueId}:input:transition:${transitionId}`;
  const scope = project.canvas?.scopes?.[scopeKey];
  const slots = direction === "input" ? scope?.entrySlots ?? [] : scope?.exitSlots ?? [];
  const previousPosition = scope?.nodes?.[previousPortId]?.position;
  const resolvedPosition = previousPosition ?? scope?.nodes?.[resolvedPortId]?.position;
  const { [previousPortId]: _removedPosition, ...nodes } = scope?.nodes ?? {};
  if (resolvedPosition) nodes[resolvedPortId] = { ...nodes[resolvedPortId], position: resolvedPosition };
  const remainingSlots = slots.filter((candidate) => candidate !== slotId);
  const nextScope = { ...scope, nodes: Object.keys(nodes).length ? nodes : undefined };
  if (direction === "input") {
    if (remainingSlots.length) nextScope.entrySlots = remainingSlots;
    else delete nextScope.entrySlots;
  } else if (remainingSlots.length) nextScope.exitSlots = remainingSlots;
  else delete nextScope.exitSlots;
  const nextScopes = { ...(project.canvas?.scopes ?? {}) };
  if (!Object.keys(nextScope).some((key) => (nextScope as Record<string, unknown>)[key] !== undefined)) delete nextScopes[scopeKey];
  else nextScopes[scopeKey] = nextScope;
  return {
    ...project,
    canvas: {
      ...project.canvas,
      scopes: nextScopes,
    },
  };
}

export function updateTransition(
  project: BranchingProject,
  transitionId: string,
  updates: Partial<Transition>,
): MutationResult {
  const owner = project.events.find((event) =>
    event.transitions?.some((transition) => transition.id === transitionId),
  );
  const currentTransition = owner?.transitions?.find((transition) => transition.id === transitionId);
  if (!owner || !currentTransition) return { project, message: "Transition not found." };
  const nextMode = updates.mode ?? currentTransition.mode ?? "conditional";
  const updatesConditions = Object.prototype.hasOwnProperty.call(updates, "conditions");
  const updatedTransition = synchronizeLogicOwner(currentTransition, {
    ...currentTransition,
    ...updates,
    mode: nextMode,
    conditions: nextMode === "fallback" ? undefined : updatesConditions ? updates.conditions : currentTransition.conditions,
  });
  let siblings = (owner.transitions ?? [])
    .filter((transition) => transition.from === currentTransition.from && transition.id !== transitionId)
    .map((transition) => ({ ...transition }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (nextMode === "fallback") {
    siblings = siblings.map((transition) =>
      transition.mode === "fallback" ? { ...transition, mode: "conditional" as const } : transition,
    );
  }
  const requestedIndex = Math.max(
    0,
    Math.min(
      nextMode === "fallback" ? siblings.length : Number(updates.order ?? currentTransition.order ?? siblings.length),
      siblings.length,
    ),
  );
  siblings.splice(requestedIndex, 0, updatedTransition);
  const reordered = new Map(
    siblings
      .sort((a, b) => {
        if (a.mode === "fallback" && b.mode !== "fallback") return 1;
        if (b.mode === "fallback" && a.mode !== "fallback") return -1;
        return 0;
      })
      .map((transition, order) => [transition.id, { ...transition, order }]),
  );
  const transitions = normalizeTransitionRoles(
    (owner.transitions ?? []).map((transition) =>
      reordered.get(transition.id) ?? transition,
    ),
    project,
  );
  return {
    project: {
      ...project,
      events: project.events.map((event) => ({
        ...event,
        transitions: event.id === owner.id ? transitions : event.transitions,
      })),
    },
  };
}

export function normalizeTransitionOrder(
  project: BranchingProject,
  sourceId: string,
): MutationResult {
  const owner = project.events.find((event) =>
    event.transitions?.some((transition) => transition.from === sourceId),
  );
  if (!owner) return { project, message: "Transition source not found." };

  const sourceTransitions = (owner.transitions ?? [])
    .filter((transition) => transition.from === sourceId)
    .sort((left, right) => {
      const leftPriority = left.mode === "fallback" ? 2 : left.conditions ? 0 : 1;
      const rightPriority = right.mode === "fallback" ? 2 : right.conditions ? 0 : 1;
      return leftPriority - rightPriority || (left.order ?? 0) - (right.order ?? 0);
    })
    .map((transition, order) => ({ ...transition, order }));
  const normalized = new Map(sourceTransitions.map((transition) => [transition.id, transition]));

  return {
    project: {
      ...project,
      events: project.events.map((event) => ({
        ...event,
        transitions: event.transitions?.map((transition) => normalized.get(transition.id) ?? transition),
      })),
    },
    message: `Normalized transition order for "${sourceId}".`,
  };
}

export function deleteTransition(
  project: BranchingProject,
  transitionId: string,
): MutationResult {
  const owner = project.events.find((event) =>
    event.transitions?.some((transition) => transition.id === transitionId),
  );
  return {
    project: {
      ...project,
      events: project.events.map((event) => ({
        ...event,
        transitions: event.id === owner?.id
          ? normalizeTransitionRoles(
              event.transitions?.filter((transition) => transition.id !== transitionId),
              project,
            )
          : event.transitions,
        boundaryBindings: event.boundaryBindings?.filter(
          (binding) => `transition:boundary:${binding.id}` !== transitionId,
        ),
      })),
    },
  };
}

/** Delete every authored transition owned by one visual route gate and forget its saved placement. */
export function deleteRoutesFromSource(project: BranchingProject, eventId: string, sourceId: string): BranchingProject {
  const gateIds = new Set([`route-gate:${eventId}:${sourceId}`, `route-gate:${sourceId}`]);
  const cleanNodes = (nodes: Record<string, CanvasNodeAuthoringState> | undefined) =>
    nodes ? Object.fromEntries(Object.entries(nodes).filter(([id]) => !gateIds.has(id))) : undefined;
  const canvas = project.canvas ? {
    ...project.canvas,
    nodes: cleanNodes(project.canvas.nodes),
    routeGateSources: project.canvas.routeGateSources?.filter(id => id !== sourceId),
    scopes: project.canvas.scopes ? Object.fromEntries(Object.entries(project.canvas.scopes).map(([key, scope]) => [key, {
      ...scope,
      nodes: cleanNodes(scope.nodes),
      routeGateSources: scope.routeGateSources?.filter(id => id !== sourceId),
    }])) : undefined,
  } : project.canvas;
  return {
    ...project,
    canvas,
    events: project.events.map(event => event.id === eventId
      ? { ...event, transitions: event.transitions?.filter(transition => transition.from !== sourceId) }
      : event),
  };
}

export function deleteScriptBlock(
  project: BranchingProject,
  blockKey: string,
): MutationResult {
  const owner = (project.scriptDocuments ?? []).find((script) =>
    script.blocks.some((block) => `${script.id}:${block.id}` === blockKey),
  );
  if (!owner) return { project, message: "Script block not found." };

  return {
    project: {
      ...project,
      scriptDocuments: (project.scriptDocuments ?? []).map((script) =>
        script.id === owner.id
          ? { ...script, blocks: script.blocks.filter((block) => `${script.id}:${block.id}` !== blockKey) }
          : script,
      ),
    },
    message: `Deleted orphan script block "${blockKey}".`,
  };
}

export function updateDataObject(
  project: BranchingProject,
  id: string,
  updates: Partial<ProjectDataObject>,
): MutationResult {
  return {
    project: {
      ...project,
      projectDataObjects: (project.projectDataObjects ?? []).map(
        (dataObject) =>
          dataObject.id === id ? synchronizeLogicOwner(dataObject, updates) : dataObject,
      ),
    },
  };
}

export function deleteDataObject(
  project: BranchingProject,
  id: string,
): MutationResult {
  let used = false;
  const checkConditions = (input: ConditionInput | undefined) => {
    walkConditions(input, (condition) => {
      if ("objectId" in condition && condition.objectId === id) {
        used = true;
      }
    });
  };
  const checkConsequences = (consequences: Consequence[] | undefined) => {
    conditionInputsFromConsequences(consequences).forEach(checkConditions);
  };

  project.sequences.forEach((sequence) =>
    checkConditions(sequence.availability),
  );
  project.branches.forEach((branch) => checkConditions(branch.availability));
  project.events.forEach((event) => {
    checkConditions(event.availability);
    checkConsequences(event.consequences);
    event.transitions?.forEach((transition) => {
      checkConditions(transition.conditions);
      checkConsequences(transition.consequences);
    });
    event.decisions?.forEach((decision) => {
      checkConditions(decision.availability);
      decision.outcomes.forEach((outcome) => {
        checkConditions(outcome.conditions);
        checkConsequences(outcome.consequences);
      });
    });
  });

  if (used) {
    return {
      project,
      message:
        "Data object deletion is blocked while conditions or consequences reference it.",
    };
  }

  return {
    project: {
      ...project,
      projectDataObjects: (project.projectDataObjects ?? []).filter(
        (dataObject) => dataObject.id !== id,
      ),
    },
  };
}

export function createCanonEditSuggestion(
  project: BranchingProject,
  canonRefId: string,
  source?: { eventId?: string; dataObjectId?: string },
): MutationResult {
  const canonRef = project.canonRefs.find((ref) => ref.id === canonRefId);
  if (!canonRef) {
    return { project, message: "Canon ref not found." };
  }

  const now = new Date().toISOString();
  const suggestionId = uniqueId(
    `suggestion:${slugify(canonRef.id)}`,
    (project.canonEditSuggestions ?? []).map((suggestion) => suggestion.id),
  );
  const suggestion: CanonEditSuggestion = {
    id: suggestionId,
    canonRefId: canonRef.id,
    targetPath: canonRef.canonSourcePath,
    title: `Suggestion for ${canonRef.label ?? canonRef.id}`,
    summary: source?.eventId
      ? `Suggested while authoring event ${source.eventId}.`
      : "Suggested from PathBranching.",
    proposedContent: canonRef.preview ?? "",
    status: "draft",
    sourceEventId: source?.eventId,
    sourceDataObjectId: source?.dataObjectId,
    createdAt: now,
    updatedAt: now,
    safety: "worldnotion-review-required",
  };

  return {
    project: {
      ...project,
      canonEditSuggestions: [
        ...(project.canonEditSuggestions ?? []),
        suggestion,
      ],
    },
    selection: { type: "canonSuggestion", id: suggestionId },
    message: "Created a safe WorldNotion edit suggestion in PathBranching.",
  };
}

export function updateCanonEditSuggestion(
  project: BranchingProject,
  id: string,
  updates: Partial<CanonEditSuggestion>,
): MutationResult {
  return {
    project: {
      ...project,
      canonEditSuggestions: (project.canonEditSuggestions ?? []).map(
        (suggestion) =>
          suggestion.id === id
            ? { ...suggestion, ...updates, updatedAt: new Date().toISOString() }
            : suggestion,
      ),
    },
  };
}

export function deleteCanonEditSuggestion(
  project: BranchingProject,
  id: string,
): MutationResult {
  return {
    project: {
      ...project,
      canonEditSuggestions: (project.canonEditSuggestions ?? []).filter(
        (suggestion) => suggestion.id !== id,
      ),
    },
  };
}

function defaultFieldValue(field: DataFieldDefinition, canonRefId?: string) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.type === "boolean") {
    return false;
  }
  if (field.type === "number") {
    return 0;
  }
  if (field.type === "canonRef") {
    return canonRefId ?? "";
  }
  if (field.type === "canonRefList") {
    return canonRefId ? [canonRefId] : [];
  }
  if (field.type === "multiSelect" || field.type === "dataRefList") {
    return [];
  }
  return "";
}

export function createDataObject(
  project: BranchingProject,
  classId?: string,
  canonRefId?: string,
): MutationResult {
  const dataClass =
    project.dataClasses?.find((definition) => definition.id === classId) ??
    project.dataClasses?.[0];
  if (!dataClass) {
    return {
      project,
      message: "Create a data class before adding project data.",
    };
  }

  const canonRef = canonRefId
    ? project.canonRefs.find((ref) => ref.id === canonRefId)
    : undefined;
  const label = canonRef?.label ?? canonRef?.id ?? dataClass.label;
  const baseId = `data:${slugify(dataClass.label || dataClass.id)}:${slugify(label || "object") || "object"}`;
  const objectId = uniqueId(
    baseId,
    (project.projectDataObjects ?? []).map((object) => object.id),
  );
  const fields = Object.fromEntries(
    dataClass.fields.map((field) => [
      field.name,
      field.name === "title" || field.name === "displayName"
        ? label
        : defaultFieldValue(field, canonRef?.id),
    ]),
  );

  const newObject: ProjectDataObject = {
    id: objectId,
    classId: dataClass.id,
    name: label,
    canonRefs: canonRef ? [canonRef.id] : [],
    fields,
    tags: canonRef ? ["canon-derived"] : ["manual"],
    scope: { global: true },
  };

  return {
    project: {
      ...project,
      projectDataObjects: [...(project.projectDataObjects ?? []), newObject],
    },
    selection: { type: "dataObject", id: objectId },
  };
}

export function createKnowledgeObject(
  project: BranchingProject,
  canonRefId?: string,
): MutationResult {
  if (
    project.dataClasses?.some(
      (dataClass) => dataClass.id === "class:KnowledgeEntry",
    )
  ) {
    return createDataObject(project, "class:KnowledgeEntry", canonRefId);
  }

  const selectedCanonRef = canonRefId
    ? project.canonRefs.find((canonRef) => canonRef.id === canonRefId)
    : undefined;
  const safeBase = (
    selectedCanonRef?.id ??
    `manual-${(project.projectDataObjects?.length ?? 0) + 1}`
  )
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .toLowerCase();
  const objectId = `data:knowledge:${safeBase}`;
  const existingIds = new Set(
    (project.projectDataObjects ?? []).map((dataObject) => dataObject.id),
  );
  const finalId = existingIds.has(objectId)
    ? `${objectId}-${existingIds.size + 1}`
    : objectId;
  const newObject: ProjectDataObject = {
    id: finalId,
    classId: "class:KnowledgeEntry",
    name: selectedCanonRef?.id ?? "Manual Knowledge Entry",
    canonRefs: selectedCanonRef ? [selectedCanonRef.id] : [],
    fields: {
      sourceRef: selectedCanonRef?.id ?? "manual",
      title: selectedCanonRef?.id ?? "Manual Knowledge Entry",
      body: "",
    },
    tags: selectedCanonRef ? ["canon-derived"] : ["manual"],
    scope: { global: true },
  };

  return {
    project: {
      ...project,
      projectDataObjects: [...(project.projectDataObjects ?? []), newObject],
    },
    selection: { type: "dataObject", id: finalId },
  };
}

export function setAvailability<T extends { availability?: ConditionInput }>(
  object: T,
  availability: ConditionInput | undefined,
): T {
  return { ...object, availability };
}

export function appendConsequence(
  consequences: Consequence[] | undefined,
  consequence: Consequence,
) {
  return [...(consequences ?? []), consequence];
}
