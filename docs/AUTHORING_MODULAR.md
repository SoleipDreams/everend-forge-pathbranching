# Modular story authoring

Implemented and verified on Windows on 2026-10-07. This delivery covers writing,
branching, configuring entities/actions/rules, traversing, and saving/reopening
inside PathBranching. Export compilation and Unity synchronization remain a
separate milestone. The wider [authoring closure](AUTHORING_CLOSURE.md) checklist
must not be marked complete from this delivery alone.

## Use the editor

Open a universe and select an event or dialogue on the canvas, then choose
**Write story / Escribir historia**. The editor follows canvas selection and
shows incoming connections, outgoing routes, shared content and returns.

- Add dialogue, speech, direction or a decision directly to the document.
  Adding an answer creates its outcome and connection. Inserting content into
  an existing route preserves the route's restrictions and consequences.
- Each answer has text, conditions, ordered consequences and a continuation:
  create content, connect existing content, return, or end. Converging branches
  reference a shared destination rather than copying its text.
- Conditions keep the recursive AND/OR/NOT tree. Copy queries support some,
  all and count, with combined filters evaluated on the same copy.
- Locked answers remain visible by default. A per-answer setting can hide them
  or supply their unavailable message.
- Text commits after 500 ms or on blur. Structural changes are atomic undo
  entries. Incomplete input remains a recoverable draft across folding, tab
  changes, selection changes and reload. Source remains an advanced tool with
  explicit application; it is not the visual editor's intermediate model.

The canvas remains mounted and operable. The editor occupies the right side
when the canvas has enough width, or the lower 52% when it is narrow. Opening
the test run folds the writer; reopening the writer folds the test panel. There
is no scrim. Escape folds the editor and returns focus to its trigger; tabs
support arrow keys, Home and End.

## Configure the story's entities

**Entities / Entidades** brings canon/local origin, type defaults, individual
exceptions, readable/writable properties, presence/location/ownership roles,
container capability and initial copies together. Property access does not
require inventory capability. Exceptions support explicit enabling and
disabling, or inheritance.

Copies have stable IDs, optional names and their own properties/states. A copy
has at most one owner: an entity, another copy, or a player profile. Container
cycles are rejected. Inventory quantities are derived from copies. Ownership
is edited through the owner control, not a separate contradictory `owned` flag.

Where-used lists show narrative names with technical paths available separately.
Referenced entities, properties, copies, actions and rules cannot be removed
until their references are resolved. Locate opens the owning canvas content,
configuration, or initial scenario.

## Actions, rules and traversal

Actions may apply to an entity, a type or all configured entities. Entity actions
can override/disable a type action. Editable Talk, Examine, Use and Give templates
are starting points, not a fixed verb catalog. Their contextual references are
the acted-on entity/copy, actor and recipient. A copy action requires an explicit
copy; effects over several copies require explicit selection or an all scope.

Actions may open a dialogue and return to the interrupted position, or jump to
replace that continuation. Returning does not reapply the interrupted block's
entry effects. Ordinary and copy consequences preserve the order displayed in
the editor, including creating a copy before modifying it.

Rules explicitly select entry, continue or state change; a contextual scope or
global scope; priority; and once/repeat behavior. Existing conditions are not
converted to global listeners. Immediate rules fire on a false-to-true change;
repeatable rules can fire again after becoming false. Priorities are stable,
lowest first. Routes use authored order and Else last. Unresolved/invalid
conditions stop resolution instead of silently selecting another route.

**Test story / Probar historia** uses a React-independent domain engine, not
ReactFlow edges. It offers named scenarios, story/selection starts, restart,
previous step, choices, parameterized actions, temporary state/inventories and
Why it happened. The trace includes clauses, effects, priority, route and returns;
the current position/path are highlighted on the canvas. Automatic chains stop
at cycles or 100 operations. Loops waiting for a user command remain valid.

Runs use a fixed document revision and a separate undo history. Document edits
offer restarting with the new revision. Run state and trace never become the
document automatically. Saving a named initial scenario is an explicit document
change; existing named scenarios retain their own initial copies/values when
project defaults change. The condition tester shares value resolution and
initial state with traversal.

## Storage and recovery

Modular storage is version 0.5 and reads earlier versions. It preserves actions,
rules, capabilities, copies, scenarios, canvas layout and previously omitted
project metadata. Legacy inventories migrate idempotently to stable copies;
those copies become authoritative so removing one does not recreate it from
the old inventory list.

Tauri writes a recoverable batch with synchronized temporary files, backups,
transaction journal, process/universe locks and recovery before reads. Every
affected file participates in content/existence/mtime conflict checking,
including `.evpath`. Interrupted writes roll back without overwriting later
external changes. Conflicts keep the journal available for repair. Browser
fallback does not offer the native journal's crash-recovery guarantee.

The document status derives from the save queue and drafts. A disk error keeps
the edited document in memory and local recovery, with Retry. Closing Tauri
drains the queue; a failed save keeps the window open. Corrupt/missing story,
sequence, event, manifest or required text files produce an incomplete-load
banner and block saving that would consolidate the loss.

`.evpath` represents supported content; the JSON sidecar retains modular and
opaque data. A generated text projection never reconciles over its richer JSON.
Load notes make limited projections visible. Unsupported external text edits
can block saving and require repair; the current grammar is not a complete
text-only editor for the new modular model.

## Verification record

The synthetic fixture in `scripts/verify-authoring-engine.mjs` contains two keys
with different wear/usability inside a chest, nested containers, actor/recipient,
conditional answers, shared routes, returns, copy creation, contextual/global
rules, dialogue actions and named scenarios. Its gate is:

`(owns a usable key OR strength >= 5) AND NOT visited the destination room`.

Completed checks:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run verify:core` | Passed, including drafts/storage/conditions and authoring |
| Authoring engine | 19 scenarios passed, including strict effects, missing references, unresolved NOT/Else, cycles, revisions, legacy migration and round trips |
| Authoring editor | 8 regression scenarios plus usage navigation passed |
| `npm run build` | Passed |
| Standalone `cargo test story_storage --lib` and `cargo check` | 8 native storage tests passed; check passed |
| Suite source build and equivalent native checks | Passed; 8 native storage tests passed |

Real Tauri WebView2 sessions were attached with Playwright CLI on ports 9222
and 9223. Both used disposable synthetic universes and real native file writes.
No Computer Use was used. Both completed:

1. Obtain one usable key, unlock the conditional answer, create a runtime copy,
   call a dialogue and return, then give the selected key without changing the
   worn key.
2. Create a dialogue, speech with a local speaker, decision, two responses and
   a shared continuation from the UI; create an action that opens this dialogue;
   traverse both the shared continuation and action return.
3. Create a global repeatable state-change rule in forms; false/true activation
   changes Visits from 0 to 1 to 2; Previous step restores 1 and the trace shows
   the rule and priority 9.
4. Create/configure a new initial key copy and a named scenario in forms, reload
   and verify their IDs, properties, owner, name and usable branch.
5. Recover incomplete property and condition drafts; retype a consequence while
   retaining its invalid value and visible controls; correct and save it.
6. Reject a nested containment cycle; explain a blocked removal and Locate the
   referencing named scenario.
7. Inject a real read-only-file write failure, retain the edited text and recovery,
   clear the failure, retry and reload the corrected text.
8. Corrupt a disposable event JSON, show its incomplete-load/save-block banner,
   restore the exact backup and reopen without loss.

The viewport matrix was 1440x900, 1280x720, 1100x720 and 900x700, each in EN/ES
and WorldNotion light/dark (16 cases per app). The canvas remained operable,
with no clipped form fields, horizontal form overflow or scrims. A separate
visual tour covered the other ten themes in both apps. These are logical
viewports inside real Tauri; physical Windows resizing, alternate DPI and native
file-dialog operation were not part of this automation.

Local evidence is under ignored `output/playwright/` in each repository:
`authoring-<variant>-<locale>-<theme>-<width>.png`,
`authoring-theme-<variant>-<theme>.png`, `authoring-theme-tour.png`, snapshots,
console logs and CLI flow scripts. The synthetic vaults are
`authoring-vault-standalone` and `authoring-vault-suite`. These artifacts contain
no production universe edits and are kept local rather than committed.

## Remaining boundaries

- New modular authoring logic has no promised equivalence in existing exports.
  Export/flag compilation and Unity are deferred. Existing export tests remain
  regression checks for their previous scope.
- Missing-reference, invalid-effect and automatic-cycle negatives have engine
  and validation coverage; not every negative was reconstructed through forms.
- An externally edited legacy universe encountered a text parse error during
  read-only inspection. Its original files were preserved; this delivery's
  incomplete-load guard diagnoses the issue but does not repair that text.
- Suite source-profile console checks found no errors. Existing development
  warnings include dialog-provider fallbacks/ReactFlow HMR; native Suite checks
  retain unused menu/import warnings. Builds warn about chunk size and imports.
- Graphify was refreshed against canonical sources. SQL extraction lacks the
  optional parser and some Compendium Astro sources are partially extracted;
  diagnostics report 120 self-loop edges and no missing graph endpoints.
  Source/tests remain authoritative.
- The Suite validation uses independent standalone sources. Vendor pointers and
  release packaging were not synchronized as part of this delivery.
