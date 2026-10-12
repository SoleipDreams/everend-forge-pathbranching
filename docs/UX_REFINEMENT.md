# PathBranching authoring UX refinement

Implementation and browser verification: **2026-10-07**. The canvas, Visual/Logic
layers, existing themes, side panels and inspector workflow remain the product
direction. Unity synchronization remains deferred.

## Inspector integration — 2026-10-08

The current PathBranching iteration brings story authoring into the existing
inspector. It preserves the original vertical stack of object tabs, saved
groups and close-above/below/others menus. One object expands at a time; opening
another object does not split the editor into shorter panes. Height expansion
is separate from width expansion. The active object's identity, context and
section tabs remain above its scrolling content.

Authoring is distributed across the existing object sections: Overview for
identity/configuration; Path, Content or Narrative sequence for writing;
Choices for responses, presentation, ordering and unavailable text such as
`????`; Connections for destinations and routes; Conditions and Consequences
for logic in either canvas mode. Source is an advanced narrative subview with
explicit Apply/Revert. The separate Story authoring surface is removed.

Assets remains the entity entry point. Logic now offers searchable Actions and
Rules catalogs with creation, while their complete forms open in the same
inspector. Shared inspector navigation resolves targets from the document,
including objects outside the visible canvas, and reports missing references
instead of opening an unrelated event. Per-object sections, groups, dimensions
and open objects are local workspace state.

Visual and Logic retain recognizable node identities. Logic adds brief summaries
of actual conditions/effects without repeated empty bands. Gates show numbered
routes and destinations, including routes with effects only, with Else last.
Returns are distinct, and selection highlights relevant connections. Mode
changes preserve authored positions, IDs and handles.

Focused evidence in the real standalone Tauri WebView2, attached through
Playwright CLI:

- An invalid action-name draft survived section changes, object changes and
  reload; restoring the saved value cleared the draft.
- Two objects remained in the original vertical stack with one expanded editor.
  Returning to an object restored its section without changing canvas zoom.
- Native read-only loading of the current SINPO universe ran its 23 saved
  scenarios with 125 assertions passing.
- TypeScript checking passed after the Choices and missing-rule diagnostic
  changes.

This is focused evidence, not full acceptance of this iteration. The complete
Tauri interaction pass and the 1440 × 900, 1280 × 720 and 900 × 700 matrix in
EN/ES and light/dark remain pending. That pass must cover authoring, groups,
height/width restoration, routes/returns, undo, save/reopen and coexistence with
the test panel. Local captures and scripts remain under ignored
`output/playwright/`; they may contain the currently open private universe.
Export features, runtime format changes and Unity are outside this iteration.

The dated verification below records the previous UX delivery and does not
establish acceptance of the inspector integration above.

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

**Full desktop authoring acceptance remains pending.** Chromium used in-memory folder
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

## Focused Tauri panel regression — 2026-10-07

Side panels are non-modal. They do not shade the canvas or trap Tab. Collapse
from the header, rail, footer or scoped Escape updates the saved panel preference,
so increasing the window width cannot silently reopen a collapsed panel. Compact
panels retain their vertical header/form layout. Panel stacking allows their
controls to remain accessible when the onboarding guide is present.

Playwright CLI attached to the actual standalone and Suite WebView2 endpoints
(9222 and 9223), using the independent-source Suite profile. Both passed:

- Opening and collapsing all six panels at a 900 × 700 viewport, with one
  floating panel and a canvas layout width of at least 480 px.
- Middle-button canvas pan and wheel zoom while a panel remained open, without
  a backdrop or modal input interception.
- Tab leaving the panel; Escape collapsing it and restoring focus to its rail;
  header collapse; compact panel headers remaining above their forms.
- Collapse surviving 900 → 1440 → 900 viewport changes and WebView reload.

Read-only native version calls returned 0.3.0 for standalone and 0.2.0 for Suite.
Captures are local under each repository's ignored `output/playwright/` folder;
they contain the currently open universe and are not published. No narrative
editing or native file-dialog automation was part of these focused checks.
TypeScript, `verify:core`, standalone build and the Suite source build passed.
This closes the panel regression, not the full authoring acceptance listed above.
