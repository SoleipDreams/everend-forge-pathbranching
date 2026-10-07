import { useCallback, useSyncExternalStore } from "react";
import { authoringDraftCount, getAuthoringDraft, setAuthoringDraft, subscribeAuthoringDrafts } from "../authoringDrafts.js";

export function useAuthoringDraft(key: string, fallback: string): readonly [string, (value: string) => void, () => void] {
  const stored = useSyncExternalStore(subscribeAuthoringDrafts, () => getAuthoringDraft(key), () => undefined);
  const set = useCallback((value: string) => setAuthoringDraft(key, value === fallback ? undefined : value), [key, fallback]);
  const clear = useCallback(() => setAuthoringDraft(key, undefined), [key]);
  return [stored ?? fallback, set, clear] as const;
}
export function useAuthoringDraftCount(projectId: string): number {
  return useSyncExternalStore(subscribeAuthoringDrafts, () => authoringDraftCount(projectId), () => 0);
}
