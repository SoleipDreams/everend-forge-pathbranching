# Story testing in the canvas

Story testing belongs beside the canvas layer controls, rather than in a
workspace tab or side panel. The writer and canvas remain operable throughout a
test. Testing uses the existing authoring engine and never writes its temporary
state, trace or window geometry into the narrative document.

## Controls and session

- Play starts a manual run from the configured story entry, selection or named
  scenario. Continue, a response or an action advances it; there is no timer.
- Pause keeps the position, copies, inventory and trace while disabling narrative
  interactions. Explicit debug operations may change temporary state and run the
  existing immediate rules without resuming playback.
- Stop discards the temporary run, closes both presentation surfaces, clears its
  canvas highlights and restores the previous minimap preference.
- Visual and Logic remain canvas layers, not playback states.
- A document edit pauses the fixed-revision run. Its content and trace remain
  inspectable; Back can inspect history, and an explicit restart uses the new
  revision. No live revision patch silently changes a running story.
- Revision tracking includes data schemas, external function definitions, player
  profiles, initial simulation, scenarios and the story entry. The controller
  fingerprints document inputs independently of the engine's revision, excluding
  canvas layout, panel state and authoring preferences. Traversal commands and
  debug validation both read the captured run document; scenario preparation reads
  the current editing document.
- An ended or blocked run remains visible for diagnosis until Restart or Stop.

## Preview and debug

The compact preview begins at the minimap's lower-left position. It shows title,
speaker, content, choices, Continue and the existing parameterized actions.
Unavailable responses retain their configured visible/hidden behavior and
explanations. Locate reveals the current position in the canvas. Long content
scrolls inside the preview; moving or resizing it does not affect node layout.

Debug is a separate floating inspector for the position, diagnostics, trace,
conditions, effects, priorities, copies, inventories and temporary state. It
retains Back, scenario preparation and explicit saving of a temporary state as
an initial scenario. Incomplete debug drafts survive closing or moving a surface
for the lifetime of its session.

Copy property additions and inheritance changes remain drafts until Apply, for
both the running state and scenario preparation. Typed drafts, inherited property
types and temporal references are validated before a state batch can take effect.
An invalid batch preserves the prior state, position, trace and history. Saving
the running state as a scenario retains the actor actually used by that run;
selecting another scenario only configures a subsequent run. A scenario cannot
remove the copy referenced by its actor until that reference is resolved.

Both surfaces can move and resize inside the canvas, without a scrim, or detach
into separate native windows on Tauri. Native windows have no system title bar
and are owned by the main editor window; they do not become globally topmost or
modal. A small themed grip provides dragging and an explicit return to the canvas.
A detached surface presents the same
owner-controlled session; closing its native window returns it to the editor
without restarting. Stop or changing stories ends the session and closes its
windows. Browser use retains the internal floating surfaces.

## Ownership and compatibility

The editor owns the project, engine session and history. Presentation windows
receive a bounded snapshot and send identified commands, rather than owning or
serializing a project or engine history. Session and state sequence checks reject
stale commands; duplicate delivery cannot apply an effect twice, including a
retried Start or Restart after its acknowledgement was lost. Draft epochs are
independent for the run and scenario: a restart or explicit discard invalidates
queued edits only for the discarded scope, so an old window cannot restore them.
Native windows
must be ready before their integrated counterpart is removed. Opening failures
leave the integrated presentation available.

Auxiliary windows load presentation entries with minimal Tauri permissions. They
do not load another universe, editor, updater or save system. UI geometry and
preferences are separate from `BranchingProject` and `.evpath`; document formats,
condition evaluation, runtime contracts and exports remain unchanged.

Standalone is the source of the UI. Suite validation uses its independent-source
profile and preserves dirty vendors. Export completion and Unity synchronization
remain separate work.

## Verification record

On 2026-10-08, `npm run build:core` passed and
`node scripts/verify-story-test-controller.mjs` passed all 24 behavioral cases
with no failures, skips or cancellations.
These cover manual playback and pause gating, scenario/selection entry,
once-per-run copy creation on returns, parameterized transfer and dialogue
return/jump, fixed-revision inspection and restart, UI-only edits, story changes,
duplicate/stale client commands, idempotent Start/Restart acknowledgements,
scope-specific draft epochs, recoverable explicit debug drafts, strict
advanced-state validation, malformed or unresolved temporal subjects, inherited
copy property types without an explicit schema, explicit scenario saving with the
run's effective actor, rejection of a dangling actor copy, typed property addition
and inheritance drafts in both scopes, reference selector equivalence, bounded
transport snapshots, document/export immutability and subscription cleanup.

Fixed-revision regressions also cover a data schema changing from number to text,
changes to external functions, profiles, simulation, active profile, scenarios,
legacy variables and the entry sequence. These edits pause the run while
preserving its previous choice evaluation, content, state and trace until restart.
A captured-document regression verifies that debug validation and command
execution cannot read an owner's modified schema before its update notification.

The regressions reproduced two implementation defects before their corrections:
old trace labels were being recomputed from edited narrative content, and advanced
JSON state could accept incompatible entity property/state values. Fixed-revision
presentation now uses the executed document; debug state is validated before it
can change the run.

Disposable acceptance universes are
`output/playwright/authoring-vault-standalone` and Suite's
`output/playwright/authoring-vault-suite`; no private universe is required.

Required checks are controller regressions, `typecheck`, `verify:core`, `build`
and Rust checks. Real Tauri testing uses Playwright CLI, without Computer Use,
covering each application and both auxiliary windows. Screenshots, traces and
snapshots stay in ignored `output/playwright/`.

Acceptance sizes are 1440×900, 1280×720, 1100×720 and 900×700, in EN/ES and light
and dark themes. Acceptance includes branching, independent key copies, shared
content, action return and jump, explicit stale-revision restart, simultaneous
window commands, opening failure, window closure and minimap restoration.
Packaged-window entry verification is recorded separately from development
source-profile checks.

### Desktop results, 2026-10-08

- `typecheck`, the complete `verify:core` including all 24 controller regressions,
  `build`, and standalone/Suite `cargo check` passed. Suite source and unchanged
  vendor builds passed. Baseline bundle-size and Suite unused-code warnings remain.
- Playwright CLI attached to real WebView2 on 9222 and 9223. Manual playback,
  blocked/enabled choices, Back, pause, explicit temporary Apply, invalid drafts,
  debug close/reopen, revision-edit pause/restart and both minimap preferences passed.
- Simultaneous native preview/debug used one session. Native APIs confirmed no
  decorations; rapid typing followed immediately by close/reattach preserved the
  complete draft. Restart kept both windows; Stop closed them and restored the map.
  Epochs prevent pending edits from reviving a deliberately discarded draft.
- The integrated action form selected the usable key explicitly, obtained it and
  delivered it to the recipient while the worn key stayed in the chest. The
  contextual rule fired; Talk opened its dialogue and returned to the interrupted
  content, and Exit jumped to Hall before Continue finished the run.
- At 1440×900, 1280×720, 1100×720 and 900×700, surfaces stayed within the viewport,
  used internal scrolling, and the preview did not cover the writer. The canvas
  retained at least 480 px width. With all three surfaces open at 900×700 little
  unobstructed graph space remains; moving or detaching debug provides more room.
- EN/ES, light/dark theme controls, keyboard movement/resizing and Escape/focus
  recovery passed. All twelve existing themes were captured through their UI.
- Aborting the auxiliary page load exercised the readiness timeout: an actionable
  error appeared and the integrated preview retained the run.
- The final standalone release build produced the executable, MSI and NSIS.
  Playwright on 9224 verified both presentation entries from `http://tauri.localhost`
  with the same session, frameless state, choices and Stop. Console: zero errors
  and warnings. Every synthetic universe JSON and `.evpath` SHA-256 was unchanged
  across that run. Pure regressions also compare serialized documents/runtime exports.

Local evidence remains in ignored `output/playwright/`: `canvas-story-<size>.png`,
`canvas-story-es-light.png`, `canvas-theme-<theme>.png`,
`canvas-native-redocked-draft.png`, `canvas-window-load-failure.png`,
`canvas-actions-{transfer,finished}.png`,
`packaged-final-{owner,preview,debug}.png`, `packaged-story-hashes-before.json`,
and `checks-*-final.log`. Suite records its source-profile and packaged results
in its own `docs/CANVAS_STORY_TEST_ACCEPTANCE.md`.

For frontend iteration, keep the current Tauri instance and Playwright session:
use Vite HMR or Ctrl+R. Rebuilding/restarting is necessary for Rust or capability
changes; a separate packaged instance is only needed to verify embedded assets.

These checks close this canvas-testing delivery. They do not claim full thesis
authoring acceptance, complete exporter equivalence, or installation/signing QA.
Dirty vendors and the previous local debug-tool/instruction changes remain
separate; the Suite source profile is the verified integration path.
