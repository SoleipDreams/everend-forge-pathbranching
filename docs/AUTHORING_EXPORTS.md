# Authoring export preservation

Verified incrementally on 2026-10-08 from PathBranching `9d7a573` plus the local
export-preservation changes. This closes a data-omission defect; it does not
complete the [authoring acceptance scenario](AUTHORING_CLOSURE.md).

## Enhanced runtime

The namespaced `pathBranching` extension now retains the modular execution
model: individual copies and ownership, entity capability exceptions, type and
property capabilities, actions, triggered rules, authored initial state, player
profiles, saved scenarios, assets and the localization catalog. Existing event,
sequence, branch, script, condition and consequence data remain present.

Modular execution declares `requiredFeatures: [..., "modular-authoring-v1"]`
and `authoringModelVersion: "0.5"`. Dialogue/internal-boundary and nested-event
structures also require this feature, even without actions or copies. A consumer
must support this model; flattened event nodes alone are not an equivalent run.
This is a PathBranching extension, not a claim of support in existing engine
plugins or a change to the base spec version.

Canvas layout, panels, authoring preferences and temporary test sessions are not
exported. Saved initial scenarios are authored document data and are included.
Legacy rejects modular execution instead of silently dropping its dependencies.

## Other profiles

Ink preflight reports unsupported modular actions/rules, copies, capability
exceptions, significant initial state, contextual references, nested events,
boundary bindings, modular effects and explicit repetition/order. It also
rejects implicit once-only effects on potential event cycles where Ink would
repeat them. A diagnostic produces no Ink files, and preview/download remain
blocked with readable causes. Existing dialogue/profile restrictions still apply.
Simple supported stories and acyclic effects remain executable Ink exports.

Twine and SINPO/GameData remain partial projections. Their cards identify the
modular execution they do not preserve. They are not equivalent replacements for
the Enhanced model. No new compiler, engine integration or sync behavior was added.

## Evidence and remaining acceptance

- `scripts/verify-runtime-authoring-export.mjs` reconstructs the exported model
  and compares actions, copy creation, triggered rules, both routes and named
  initial scenarios against the authored model. It also checks internal dialogue
  feature requirements and independence from canvas/panels/temporary state.
- `scripts/verify-export-compatibility.mjs` checks unsupported features without
  relying on the existing dialogue blocker. Supported Ink output is compiled
  and executed with the pinned Ink compiler.
- Both scripts run in `verify:core` and `verify:authoring`.
- Final checks passed: standalone `typecheck`, complete `verify:core` (including
  43 compatibility cases and five runtime-preservation cases), standalone build,
  Suite source-profile build, and standalone/Suite `cargo check`. Existing
  bundle-size/dynamic-import and Suite unused-code warnings remain.
- Native WebView2 validation reused the current real universe, with the user's
  direction. Its UI runtime preview reconstructed all six events, 66 runtime
  nodes, the same execution revision and the same initial authoring session.
  The current story's dialogue structure correctly blocked Ink. Canon and
  narrative file hashes matched for all 118 files compared around this read-only
  validation. The final WebView2 console reported no errors or warnings.
- Local evidence is under ignored `output/playwright/`: export check logs,
  `current-export-comparison-20261008.log`, `current-export-preview-20261008.png`
  and the universe hash comparison. Real-universe content remains local.

The current real story still reports two route-priority warnings. Its narrative
was not repaired or rewritten during this verification. Full Ink/SINPO execution
equivalence, YAML output, native save-dialog export, and the complete authoring
acceptance sequence in both Tauri applications remain unverified or incomplete.
Suite source-profile compilation verifies integration without changing vendors;
it is not a new Suite desktop acceptance run.
