export type UniverseSwitchState = {
  hasDrafts: boolean;
  saveBlocked: boolean;
  hasPendingSave: boolean;
};

/** Flush accepted document changes. Manual input is never applied or discarded here. */
export async function guardUniverseSwitch({ state, flush, report }: {
  state: () => UniverseSwitchState;
  flush: () => Promise<void>;
  report: (reason: "drafts" | "blocked" | "pending" | "error", failure?: unknown) => void;
}): Promise<boolean> {
  try {
    // New edits can arrive while an earlier write is finishing.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (state().saveBlocked) { report("blocked"); return false; }
      await flush();
      if (!state().hasPendingSave) break;
    }
    const current = state();
    if (current.hasPendingSave) { report("pending"); return false; }
    if (current.hasDrafts) { report("drafts"); return false; }
    return true;
  } catch (failure) { report("error", failure); return false; }
}
