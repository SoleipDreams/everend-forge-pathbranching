# Object-only canvas selection — 2026-10-09

Selecting a node now marks only that node. The render graph no longer derives
neighbour-node classes, connected-edge classes or return-connector highlights
from the selected node or the expanded inspector. Selection retains the original
exterior halo on the selected node only. Moving selection clears the old contour
and halo.

An open or expanded inspector no longer adds selection-like borders to an
unselected node or ordinary edge. Inspector contents and controls remain available.
Direct edge selection and keyboard focus indicators remain available, including
return connectors. Conversation's row-to-node selection continues using the
existing node selection state. No narrative, position or export data changed.

Real standalone Tauri WebView2 checks through Playwright CLI passed for selecting
Sueño Premonitorio, changing selection to Ridina and back, comparing unselected
node styles and all edge styles, and checking absence of connected highlights
and exterior selection glow in the initial iteration. Capture:
output/playwright/node-selection-only.png. The user subsequently requested that
the original node halo be restored; it now applies only to the selected node.
The final pass also selected a visible node in both standalone and Suite Tauri,
comparing all other node and edge styles before and after: unchanged, with no
selection glow. Captures in each repo: output/playwright/node-selection-final.png.
The original named-node repeat was unavailable after viewport/document changes
in the shared session; the final pass used visible nodes without forcing a
reload or universe switch. Both browser consoles reported zero errors.

PathBranching typecheck/build and verify:core passed; Suite source typecheck/build
passed. Existing chunk-size/dynamic-import build warnings remain. No Rust changes
or vendor synchronization were needed. Changes remain local and uncommitted.
