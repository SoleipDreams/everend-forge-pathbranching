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

Standalone sources are authoritative. The private Suite copies and adapts them
into vendors; do not copy Suite-only orchestration into this public repository.
Preserve unrelated work, stage explicit paths and do not publish private canon.
