import type { BranchingProject } from "./domain.js";
import { validateProject } from "./validate.js";

/** Presentation changes keep the already normalized narrative snapshot. */
export function narrativeContentUnchanged(left: BranchingProject, right: BranchingProject): boolean {
  const keys = Object.keys(left).filter(key => key !== "canvas") as Array<keyof BranchingProject>;
  return keys.length === Object.keys(right).filter(key => key !== "canvas").length &&
    keys.every(key => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}

export function createNarrativeValidationCache(validate = validateProject) {
  let previous: BranchingProject | undefined;
  let findings: ReturnType<typeof validateProject> = [];
  return (project: BranchingProject) => {
    // The active sequence is the only canvas field consulted by validateProject.
    if (previous && narrativeContentUnchanged(previous, project) &&
      previous.canvas?.activeSequenceId === project.canvas?.activeSequenceId) return findings;
    previous = project;
    findings = validate(project);
    return findings;
  };
}
