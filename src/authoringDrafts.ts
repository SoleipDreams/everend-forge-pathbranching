/** Recoverable editor input. It is session data, never part of BranchingProject. */
const storageKey = "pathbranching:authoring-drafts:v1";
let drafts: Record<string, string> | undefined;
const listeners = new Set<() => void>();
function readDrafts(): Record<string, string> {
  if (!drafts) {
    drafts = {};
    try {
      const saved: unknown = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        Object.entries(saved).forEach(([key, value]) => { if (typeof value === "string") drafts![key] = value; });
      }
    } catch { /* Malformed session data cannot prevent opening the narrative. */ }
  }
  return drafts;
}
export function authoringDraftKey(projectId: string, elementId: string, field: string): string {
  return JSON.stringify([projectId, elementId, field]);
}
export function getAuthoringDraft(key: string): string | undefined { return readDrafts()[key]; }
export function authoringDraftEntries(projectId: string): [string, string][] {
  return Object.entries(readDrafts()).filter(([key]) => {
    try { return JSON.parse(key)[0] === projectId; } catch { return false; }
  });
}
export function setAuthoringDraft(key: string, value: string | undefined): void {
  const current = readDrafts();
  if (current[key] === value) return;
  if (value === undefined) delete current[key]; else current[key] = value;
  try { globalThis.localStorage?.setItem(storageKey, JSON.stringify(current)); } catch { /* Keep recovery in memory when storage is unavailable. */ }
  listeners.forEach(listener => listener());
}
export function subscribeAuthoringDrafts(listener: () => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
export function authoringDraftCount(projectId: string): number {
  return Object.keys(readDrafts()).filter(key => {
    try { return JSON.parse(key)[0] === projectId; } catch { return false; }
  }).length;
}

export type AuthoringRecovery = { project: import("./domain.js").BranchingProject; modifiedMs?: number; savedAt: number };
const recoveryKey = (universe: string, story: string) => `pathbranching:unsaved-document:${JSON.stringify([universe, story])}`;
export function storeAuthoringRecovery(universe: string, story: string, recovery: AuthoringRecovery): void {
  try { globalThis.localStorage?.setItem(recoveryKey(universe, story), JSON.stringify(recovery)); } catch { /* The document remains pending in memory. */ }
}
export function readAuthoringRecovery(universe: string, story: string): AuthoringRecovery | undefined {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(recoveryKey(universe, story)) ?? "null") as AuthoringRecovery | null;
    return value?.project?.projectId && typeof value.savedAt === "number" ? value : undefined;
  } catch { return undefined; }
}
export function clearAuthoringRecovery(universe: string, story: string): void {
  try { globalThis.localStorage?.removeItem(recoveryKey(universe, story)); } catch { /* Removing an old recovery entry is best effort. */ }
}
