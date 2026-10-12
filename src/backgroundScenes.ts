export const BACKGROUND_SCENES = ["original", "amber", "violet", "jade", "copper"] as const;
export type BackgroundScene = typeof BACKGROUND_SCENES[number];
/** A local visual preference; never part of universe or runtime formats. */
export function normalizeBackgroundScene(value: unknown): BackgroundScene {
  return typeof value === "string" && BACKGROUND_SCENES.some(scene => scene === value)
    ? value as BackgroundScene : "original";
}
