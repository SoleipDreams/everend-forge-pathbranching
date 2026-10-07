# PathBranching authoring UX refinement

Implementation and browser verification: **2026-10-07**. The canvas, Visual/Logic
layers, existing themes, side panels and inspector workflow remain the product
direction. Unity synchronization remains deferred.

## Delivered

- Panel allocation reserves at least 480 px for the canvas. Panels that cannot
  fit use an overlay drawer; windows at or below 960 px use one active drawer.
  Escape closes it, traps release correctly and focus returns to its rail.
  Resetting the layout and opening another document clear temporary overlays
  without rewriting restored panel preferences.
- Selection exposes Inspect and, where applicable, Enter. With no selection,
  Inspect opens the active context. Breadcrumbs identify story, sequence and
  event; creation is primary and rename/delete live in secondary menus.
- Document status follows the existing save queue and revision state. Pending,
  saving, saved and failed states are visible beside the document. Failed saves
  expose their cause and retry. Unapplied inspector/text drafts are separate.
- Conditions adapt to their container. Nested AND/OR/NOT remain a tree, field
  errors stay beside their controls and summaries preserve grouping or explicitly
  identify abbreviation. Missing references remain visible.
- The tester shows referenced values first, with typed controls, then advanced
  state/JSON. It reports clauses, ordered route selection and stopped resolution.
  Test state is temporary and never enters the document or runtime output.
- Both Export & Import entry points open the same panel. Format cards expose
  available, limited and blocked states; causes and resolvable locations remain
  accessible when blocked. Enhanced is primary and Legacy is secondary. Review
  output opens a read-only dialog backed by the existing exporter.
- Interface EN/ES is independent of narrative content language. Authoring
  controls use existing theme tokens, visible focus and readable form sizes.
  Tabs support arrows/Home/End. Dialogs and drawers support Escape and focus
  restoration. Tutorial and guide no longer overlap; settings can reopen them.
  New sessions start with Stories open; restored sessions keep their preferences.

No changes in this UX delivery were made to `BranchingProject`, `.evpath`,
condition evaluation/migration, serialization or runtime export contracts.
Persisted node dimensions are unchanged. The previous conditional implementation
is isolated in commit `60a9efa`.

## Verification

Standalone: `npm run typecheck`, `npm run verify:core`, `npm run build` and
`cargo check --manifest-path src-tauri/Cargo.toml` passed.

Suite: `npm run typecheck:sources`, `npm run build:sources` and
`cargo check --manifest-path apps/suite/src-tauri/Cargo.toml` passed. The source
profile checks 89 standalone files and rejects PathBranching vendor source leaks.
No vendor synchronization or submodule pointer changes were performed.

`verify:core` includes the 15 conditional regressions, six condition presentation
checks and three layout/diagnostic checks, alongside the existing persistence,
runtime, executed Ink and Twine checks. Presentation checks cover honest nested
summaries, malformed JSON preservation, typed test references, stopped routes,
diagnostic owner lookup and unchanged narrative input.

Browser verification used Chromium and an in-memory universe containing Door,
Open and Closed. Open represents the visited room in the rule
**(has Key OR Strength >= 5) AND NOT visited Open**. The following cases passed
in standalone and Suite, including after switching back to the saved story:

| Temporary values | Result |
| --- | --- |
| No key, strength 0, room unvisited | Else → Closed |
| Key owned, strength 0, room unvisited | Open |
| No key, strength 5, room unvisited | Open |
| Strength 5, room visited | Else → Closed |
| Strength undefined, no key | Resolution stops before Else |

| Viewport | Standalone | Suite |
| --- | --- | --- |
| 1440 × 900 | Canvas >= 480 px; no form/page horizontal overflow | Passed |
| 1280 × 720 | Canvas >= 480 px; no form/page horizontal overflow | Passed |
| 1100 × 720 | Canvas >= 480 px; no form/page horizontal overflow | Passed |
| 900 × 700 | Single drawer; accessible controls; no horizontal overflow | Passed |

Additional browser evidence:

- Edited event metadata and a numeric condition, saved, reopened and confirmed
  the description and nested groups. Created a scratch story in Suite, then
  switched back to the original saved story.
- Simulated a failed writable file handle in both apps. Error status, cause,
  retry, persisted description and final Saved status were confirmed.
- Compared stored universe files before/after tester edits and preview/export:
  unchanged. Enhanced preview equals the payload sent to the export boundary.
- Removed a condition reference in the synthetic data. The editor retained its
  ID and associated error; Locate selected its authored owner. Ink was blocked
  with a visible cause. Legacy was blocked; Twine/GameData limitations were shown.
- Checked mouse actions, keyboard tabs, drawer and preview Escape/focus, EN/ES
  switching and all twelve existing light/dark themes. These are interaction and
  visual checks, not a formal accessibility certification.

### Captures

- [Standalone, 1440 × 900](qa/pathbranching-ux/standalone-1440.png)
- [Standalone, 900 × 700](qa/pathbranching-ux/standalone-900.png)
- [Suite, 900 × 700](qa/pathbranching-ux/suite-900.png)
- [Blocked Ink diagnostics](qa/pathbranching-ux/blocked-ink.png)

## Acceptance boundaries

**Manual Tauri acceptance remains pending.** Chromium used in-memory folder
handles and temporary test responses for the Suite native folder picker and file
export boundary. Those checks verify UI integration and export payloads, not
native filesystem dialogs, actual disk exports or a Tauri window. Cargo checks
do not establish desktop usability. Repeat the full open/create/connect/edit/
test/save/reopen/locate/preview/export scenario in both Tauri applications before
claiming desktop or thesis milestone acceptance.

Twine and GameData retain their existing projections and checks; full condition
and consequence equivalence is outside this delivery and their cards say so.
Builds retain existing large-chunk/dynamic-import warnings; Suite Rust retains
unused-import/menu warnings. No engine/player expansion or new format was added.

Suite integration uses the independent source profile documented in its
`docs/standalone-sources.md`. Release vendor pins still require intentional
selection of a reachable upstream commit through the existing vendoring flow.
