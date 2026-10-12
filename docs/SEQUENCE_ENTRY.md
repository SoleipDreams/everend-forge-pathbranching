# Sequence start symbol — 2026-10-09

The general sequence canvas now renders its start as a 44 px circular play
symbol, with the sequence name above it. The former card, kind row and info icon
are removed from this entry marker. Its connection to the entry event is still
a direct straight line; repeated arrowhead polygons and their unused CSS are
removed. Node selection retains its halo. Positions, node IDs, entry targets,
custom connection labels and runtime exports are preserved.

The explorer collapse button now appears only in the container header, never
in the icon rail. Existing management tabs reopen the container; collapsing
returns keyboard focus to the selected tab.

Playwright CLI attached to standalone Tauri WebView2 verified 44×44 geometry,
circle shape, symbol and sequence name, the absence of the former identity/card
contents and arrowhead polygons, a straight entry path, container-only collapse,
focus restoration and Enter to reopen. Screenshot:
output/playwright/sequence-symbol-direct-entry.png. Browser console: zero errors,
two existing warnings. Typecheck/build and verify:core passed.

Suite's shared window was on WorldNotion during the follow-up check, so the
hidden PathBranching root had no measurable geometry. No tool/universe switch
or reload was forced; desktop visual acceptance here is standalone only.
Suite source typecheck/build checks the integration. No Rust changes, vendor
synchronization or release integration were performed. Work is uncommitted.
