import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
async function source(path) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}
const { mergeUniverseProfile } = await source("../src/universeProfilePersistence.ts");
const { findSettings } = await source("../src/settingsIntegration.ts");
const { pathbranchingSettingsPages } = await source("../src/settingsCatalog.ts");
const settingsSource = readFileSync(new URL("../src/workspaceSettings.ts", import.meta.url), "utf8");
const settingsModule = { exports: {} };
const compiledSettings = ts.transpileModule(settingsSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(compiledSettings, {
  module: settingsModule,
  exports: settingsModule.exports,
  localStorage: { getItem: () => null },
  require: name => {
    if (name === "./backgroundScenes.js") return { normalizeBackgroundScene: value => value === "amber" ? value : "original" };
    if (name === "./themes.js") return { normalizeThemeId: value => value === "worldnotion-dark" ? value : "worldnotion-light" };
    if (name === "./localePreference.js") return { normalizeLocalePreference: value => value === "es" || value === "en" ? value : "system" };
    throw new Error(`Unexpected workspaceSettings dependency: ${name}`);
  },
});
const { DEFAULT_CANVAS_BACKGROUND_SETTINGS, loadSettings, normalizeCanvasBackgroundSettings } = settingsModule.exports;
assert.deepEqual({ ...DEFAULT_CANVAS_BACKGROUND_SETTINGS }, { showDots: true, showGrid: false, snapToGrid: true, gridSize: 24, dotOpacity: 0.3, opacity: 0.5, connectionPadding: 18 });
assert.equal(loadSettings().canvasBackground.dotOpacity, 0.3, "fresh settings should use the Suite's current dot transparency");
assert.equal(loadSettings().canvasBackground.showGrid, false, "fresh settings should use the current canvas background pattern");
assert.equal(normalizeCanvasBackgroundSettings({ showDots: true, showGrid: false, snapToGrid: true, gridSize: 24, opacity: 0.5 }).dotOpacity, 0.5, "legacy settings should preserve the prior dot appearance");
const original = { name: "Before", schemaVersion: 7, localization: { primaryLocale: "es", locales: ["es", "en", "x-stellar"], extension: { preserved: true } }, extension: { portable: true } };
assert.deepEqual(mergeUniverseProfile(JSON.stringify(original), { name: "After" }), { ...original, name: "After" });
assert.deepEqual(mergeUniverseProfile(JSON.stringify(original), { localization: { primaryLocale: "en" } }).localization, { ...original.localization, primaryLocale: "en" });
for (const invalid of ["null", "[]", "5", "{"]) assert.throws(() => mergeUniverseProfile(invalid, { name: "After" }));
assert.ok(findSettings(pathbranchingSettingsPages, "IDIOMA INTERFÁZ").length);
assert.ok(findSettings(pathbranchingSettingsPages, "universe name").every(result => result.page.requiresUniverse));
assert.equal(findSettings(pathbranchingSettingsPages, "no-such-setting").length, 0);
console.log("Settings profile preservation, malformed-file protection and bilingual search passed.");
