# Settings

Settings uses a local SettingsFrame with a fixed header, a 240 px section list, independent scrolling and a 1120 px maximum width. Below 760 px the section list becomes a selector. The catalog indexes English and Spanish labels, descriptions and keywords; search ignores case and accents and focuses the selected control.

Standalone exposes General, Universe and this application's pages. In a compatible Suite, the optional SuiteChrome.settingsHost registers app-owned pages and drafts, opens contextual pages and renders the panel through a portal. The Suite displays common settings and only the current tool. Older hosts keep the local settings dialog. There is no dependency on the private Suite and no new shared package.

Immediate preferences keep their existing persistence. Manual profile forms retain drafts across sections and search; closing offers save, discard or continued editing. A failed save retains the draft. Profile updates merge the current universe.json, preserving unrelated fields and languages when identity alone changes.

Visual evidence from the real Tauri WebView2 is local under output/playwright/settings-*.png: EN/ES, Forge Mono light/dark at 1440×900, 1280×720 and 900×700, plus the compact selector. Do not publish private-universe snapshots. The Suite integration record is maintained in its docs/SETTINGS_REDESIGN.md.
