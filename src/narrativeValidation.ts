import type { BranchingProject } from "./domain.js";
import { measureProgressivePerformance } from "./progressivePerformance.js";
import { validateProject } from "./validate.js";

type NarrativeSignatureEntry = readonly [key: string, value: unknown];

function weakObjectIdentity(object: object, objectIds: WeakMap<object, symbol>): symbol {
  let identity = objectIds.get(object);
  if (!identity) {
    identity = Symbol();
    objectIds.set(object, identity);
  }
  return identity;
}

function createNarrativeSignature(project: BranchingProject, objectIds: WeakMap<object, symbol>): NarrativeSignatureEntry[] {
  return Object.keys(project)
    .filter(key => key !== "canvas")
    .sort()
    .map(key => {
      const value = project[key as keyof BranchingProject];
      if ((typeof value === "object" && value !== null) || typeof value === "function") {
        return [key, weakObjectIdentity(value as object, objectIds)] as const;
      }
      return [key, value] as const;
    });
}

function sameNarrativeSignature(left: NarrativeSignatureEntry[], right: NarrativeSignatureEntry[]): boolean {
  return left.length === right.length && left.every(([key, value], index) =>
    key === right[index][0] && Object.is(value, right[index][1]),
  );
}

/** Presentation changes keep the already normalized narrative snapshot. */
export function narrativeContentUnchanged(left: BranchingProject, right: BranchingProject): boolean {
  const keys = Object.keys(left).filter(key => key !== "canvas") as Array<keyof BranchingProject>;
  return keys.length === Object.keys(right).filter(key => key !== "canvas").length &&
    keys.every(key => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}

export function createNarrativeValidationCache(validate = validateProject) {
  const objectIds = new WeakMap<object, symbol>();
  let previousSignature: NarrativeSignatureEntry[] | undefined;
  let previousProjectIdentity: symbol | undefined;
  let previousActiveSequenceId: string | undefined;
  let findings: ReturnType<typeof validateProject> = [];
  return (project: BranchingProject) => {
    // Keep only weak identities in the cache key so a validated, full project
    // snapshot cannot retain event payloads after the residency cache evicts them.
    const projectIdentity = weakObjectIdentity(project, objectIds);
    const activeSequenceId = project.canvas?.activeSequenceId;
    // The active sequence is the only canvas field consulted by validateProject.
    if (previousProjectIdentity === projectIdentity && previousActiveSequenceId === activeSequenceId) return findings;
    const signature = createNarrativeSignature(project, objectIds);
    if (previousSignature && sameNarrativeSignature(previousSignature, signature) &&
      previousActiveSequenceId === activeSequenceId) {
      previousProjectIdentity = projectIdentity;
      return findings;
    }
    previousSignature = signature;
    previousProjectIdentity = projectIdentity;
    previousActiveSequenceId = activeSequenceId;
    findings = measureProgressivePerformance("narrative.validation", () => validate(project), result => ({
      events: project.events.length,
      findings: result.length,
    }));
    return findings;
  };
}
