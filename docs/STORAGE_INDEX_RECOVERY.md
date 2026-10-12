# Sequence membership and textual sidecar protection

On 2026-10-09, the Ridina document reported 55 findings and omitted previously
authored dialogue. Read-only inspection found the saved Sueño Premonitorio event
and its 50 dialogue beats intact on disk, but its ID was absent from the sequence's
eventIds. Script blocks and scenario entries still referenced that excluded event.
The inspector module change itself does not write sequence membership; the
operation that removed the membership was not established by this investigation.

Recovery restored only that event ID to the sequence index, preserving the current
entryEventId. Its textual projection was regenerated from the full JSON document.
The original index and source were backed up under the local, non-delivery
`output/playwright/ridina-recovery/` directory. Other excluded files were left alone
because sidecars can legitimately remain after deletion.

The loader now diagnoses an excluded event sidecar that still has a scenario
reference and blocks implicit saving. It also preserves JSON when a divergent
textual sidecar would remove existing narrative nodes; intentional deletion must
be explicitly applied in Source rather than adopted silently during load. Existing
non-destructive external text edits remain supported.

Storage regressions verify both protections. `verify:core` and `build` (including
typecheck) passed. Actual Tauri inspection used a disposable metadata copy of
Ridina: 50 original dialogue rows, three decisions and six outcomes were available,
and validation showed zero errors and three warnings. Missing cover-image requests
in this copy were expected because the media directory was not copied. Native
snapshots and check logs remain under `output/playwright/ridina-recovery/` and
contain private local material, not repository delivery content.
