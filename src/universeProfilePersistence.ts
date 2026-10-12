/** Preserve unrelated fields in the portable universe profile. Invalid JSON must never be replaced silently. */
export function mergeUniverseProfile(source: string | undefined, patch: object): Record<string, unknown> {
  const current: unknown = source === undefined ? {} : JSON.parse(source);
  if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error("Invalid universe profile.");
  const result = { ...current, ...patch } as Record<string, unknown>;
  const before = (current as Record<string, unknown>).localization, after = result.localization;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) result.localization = { ...before, ...after };
  return result;
}

