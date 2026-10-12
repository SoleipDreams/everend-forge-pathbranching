# Everend PathBranching

Read `docs/AUTHORING_CLOSURE.md` for the current milestone and acceptance loop.
The graph's `BranchingProject` is the in-memory narrative document. Canvas layout
and panel/session state must not determine runtime exports. Read
`docs/EVPATH_FORMAT.md` before changing `.evpath` reconciliation or storage.

Preserve stable IDs, translations, conditions, consequences and attachments
through editing, saving, reopening and export. Canon is referenced by stable ID;
do not silently overwrite WorldNotion Markdown from PathBranching.

Unity live synchronization is deferred. Keep existing bridge/export behavior
working but do not expand sync, engine adapters or daemon packaging as part of
the authoring milestone. Offline exports remain in scope.

Use `npm run typecheck`, `npm run verify:core` and `npm run build` for the authoring
baseline. For focused changes, choose relevant verification scripts from
`package.json`; avoid repeating the whole suite without a reason. Rust changes
also require `cargo check --manifest-path src-tauri/Cargo.toml`. Record manual
desktop validation separately from automated verification.

## UI debugging and validation

Use Playwright CLI against the real Tauri WebView2 for UI debugging, reproducing
interaction bugs and validating changes to desktop authoring flows. Read
`docs/TAURI_DEBUG.md` for setup and troubleshooting.

- Start with `npm run tauri:debug`, then `npm run pw:attach` in another terminal.
  Reuse an existing debug instance/session when available.
- Inspect `npm run pw -- snapshot` before interacting; use references from the
  latest snapshot and refresh them after navigation or significant UI changes.
- Check `npm run pw -- console` and capture screenshots or traces when they help
  document a reproduction or demonstrate the fix. Store artifacts only under
  `output/playwright/`, excluded from Git.
- Exercise the relevant user flow after a UI change. A browser-only Vite preview
  does not establish that Tauri commands, persistence or native dialogs work.
- UI automation uses Playwright only; do not use Computer Use. Native Windows
  file/folder dialogs are completed manually by the user when needed.
  Use synthetic content or a disposable universe copy when testing file mutations.
- If desktop automation cannot run, report the specific limitation and the checks
  actually completed; do not claim desktop acceptance from static checks alone.

Playwright complements the core verification scripts; choose checks appropriate
to the change rather than repeating the entire authoring acceptance scenario for
every small edit.

Standalone sources are authoritative. For Suite UI development and validation,
use its independent-source debug profile; do not synchronize over dirty vendors.
Release integration copies and adapts standalone sources into vendors; do not
copy Suite-only orchestration into this public repository.
Preserve unrelated work, stage explicit paths and do not publish private canon.
