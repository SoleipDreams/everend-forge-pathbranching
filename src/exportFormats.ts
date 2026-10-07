import type { BranchingProject, ConditionInput, Consequence, Decision, EventNode, Outcome, Transition } from "./domain.js";
import { asConditionExpressions, conditionLabel, consequenceLabel } from "./logic.js";

export type InkExportFile = {
  path: string;
  content: string;
};

export type InkProjectExport = {
  format: "ink";
  files: InkExportFile[];
  diagnostics?: { location: string; message: string }[];
  symbols?: Record<string,string>;
};

export type SinpoGameDataExport = {
  format: "sinpo-game-data";
  specVersion: "0.1";
  projectId: string;
  sequences: Array<{
    id: string;
    name: string;
    entryEventId: string;
    eventIds: string[];
    branchIds: string[];
    conditions?: ConditionInput;
  }>;
  branches: Array<{
    id: string;
    title: string;
    description?: string;
    eventIds: string[];
    conditions?: ConditionInput;
  }>;
  events: Array<{
    id: string;
    name: string;
    type: string;
    text?: EventNode["text"];
    branchRef?: string | null;
    inkKnot: string;
    canonRefs: string[];
    canonRefDetails: Array<{
      id: string;
      kind?: string;
      label?: string;
      canonSourcePath?: string;
      missingIdentity?: boolean;
      identityWarning?: string;
    }>;
    script?: EventNode["script"];
    decisions: Decision[];
    transitions: Transition[];
    conditions?: ConditionInput;
    consequences?: Consequence[];
  }>;
  dataObjects: BranchingProject["projectDataObjects"];
  canonEditSuggestions: BranchingProject["canonEditSuggestions"];
  variables: BranchingProject["variables"];
  canonRefs: BranchingProject["canonRefs"];
  pathBranching: {
    source: "PathBranching";
    exportTarget: "SINPO";
    entrySequenceId?: string;
    eventCategories?: BranchingProject["eventCategories"];
    nested?: Array<{
      eventId: string;
      parentEventId?: string;
      childEventIds: string[];
      dialogues: NonNullable<EventNode["dialogues"]>;
      boundaryBindings: NonNullable<EventNode["boundaryBindings"]>;
    }>;
  };
};

function inkSafeId(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
  return safe || "node";
}

export { exportInkProject } from "./inkExport.js";

export function exportSinpoGameData(project: BranchingProject): SinpoGameDataExport {
  const canonRefDetails = (ids: string[] | undefined) =>
    (ids ?? [])
      .map((id) => project.canonRefs.find((ref) => ref.id === id))
      .filter(Boolean)
      .map((ref) => ({
        id: ref!.id,
        kind: ref!.kind,
        label: ref!.label,
        canonSourcePath: ref!.canonSourcePath,
        missingIdentity: ref!.missingIdentity,
        identityWarning: ref!.identityWarning,
      }));

  return {
    format: "sinpo-game-data",
    specVersion: "0.1",
    projectId: project.projectId,
    sequences: project.sequences.map((sequence) => ({
      id: sequence.id,
      name: sequence.name,
      entryEventId: sequence.entryEventId,
      eventIds: sequence.eventIds,
      branchIds: sequence.branchIds ?? [],
      conditions: sequence.availability,
    })),
    branches: project.branches.map((branch) => ({
      id: branch.id,
      title: branch.title,
      description: branch.description,
      eventIds: branch.eventIds,
      conditions: branch.availability,
    })),
    events: project.events.filter((event) => !event.parentEventId).map((event) => ({
      id: event.id,
      name: event.name,
      type: event.type,
      text: event.text,
      branchRef: event.branchRef,
      inkKnot: inkSafeId(event.id),
      canonRefs: event.canonRefs ?? [],
      canonRefDetails: canonRefDetails(event.canonRefs),
      script: event.script,
      decisions: event.decisions ?? [],
      transitions: event.transitions ?? [],
      conditions: event.availability,
      consequences: event.consequences,
    })),
    dataObjects: project.projectDataObjects ?? [],
    canonEditSuggestions: project.canonEditSuggestions ?? [],
    variables: project.variables,
    canonRefs: project.canonRefs,
    pathBranching: {
      source: "PathBranching",
      exportTarget: "SINPO",
      entrySequenceId: project.entrySequenceId,
      eventCategories: project.eventCategories,
      nested: project.events
        .filter((event) => event.parentEventId || event.childEventIds?.length || event.dialogues?.length || event.boundaryBindings?.length)
        .map((event) => ({
          eventId: event.id,
          parentEventId: event.parentEventId,
          childEventIds: event.childEventIds ?? [],
          dialogues: event.dialogues ?? [],
          boundaryBindings: event.boundaryBindings ?? [],
        })),
    },
  };
}
