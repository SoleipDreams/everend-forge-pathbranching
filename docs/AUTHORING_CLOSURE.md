# Authoring cycle closure

Status: active milestone, established 2026-10-06. This is an acceptance plan,
not a claim that every workflow has been manually verified.

## Goal

Complete a reliable authoring cycle from universe selection to a reusable
narrative export. Keep the existing document model and portable files central.
Unity live synchronization is deferred; a running bridge or engine connection
is not required to complete this milestone.

## Acceptance scenario

Use synthetic content in automated checks and a copy of a real universe for
manual acceptance. Preserve the original files.

1. Open a universe shared with WorldNotion and resolve canon references.
2. Create a story and sequence with a start, events, a decision, two outcomes
   and an ending. Exercise speakers, event text and references.
3. Add a variable, condition and consequence. Verify that the graph and text
   describe the intended routes and that preview reflects them where supported.
4. Edit an existing event through the Path text projection and confirm stable
   IDs, translations, attachments and logic survive the reconciliation.
5. Save, close and reopen. Compare narrative data, references and layout;
   check the `.evpath` and JSON sidecars and any reported warnings.
6. Introduce a broken reference or transition, verify a useful diagnostic,
   repair it and validate again.
7. Export runtime JSON/YAML, Ink and the existing SINPO GameData projection
   from the same document. Check IDs, destinations, conditions and consequences
   against the authored story without requiring a Unity connection.
8. Open the same universe in the Suite and verify the PathBranching workflow
   and shared canon still behave consistently.
9. Record the tested commit, environment, inputs, expected/actual results,
   remaining defects and screenshots needed to demonstrate the workflow.

## Verification

Run from this repository:

```sh
npm run typecheck
npm run verify:core
npm run build
```

`verify:core` covers persistence, narrative integration, canvas/inspector models,
canon suggestions, Ink-related sections, Twine and `.evpath` round trips. These
checks do not establish desktop usability or real-project acceptance on their
own. Rust changes require `cargo check --manifest-path src-tauri/Cargo.toml`.

Prioritize data loss, save/reopen failures, incorrect branching logic and invalid
exports before cosmetic changes. Record a reproducible case for every blocker.
Do not mark the milestone complete until the acceptance scenario is evidenced.

## Deferred

- Unity live pairing, inventory/proposal review and bidirectional synchronization.
- Adapter transactions, physical rollback and orphan asset workflows.
- New engine integrations and changes to the sync protocol.

Preserve the existing implementation so this work can resume independently.
Offline authoring and export defects remain within the current milestone.
