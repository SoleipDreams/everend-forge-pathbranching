# Sidebar collapse control — 2026-10-09

The collapse button now lives only in the open explorer's container header.
There is no collapse/expand icon in the management rail, whether open or closed.
When collapsed, the existing management tabs reopen their panels. Closing via the
panel header or drawer Escape returns keyboard focus to the selected tab.

Initial real Tauri WebView2 checks passed in standalone PathBranching and Suite: control
absent when collapsed, present when expanded, reopening with Enter and Space,
and focus restoration after both collapse buttons. Original open/collapsed state
was restored after the check. Captures: output/playwright/sidebar-collapsed-controls.png
in each repository. Typecheck/build and the eight workspace checks passed.

Standalone console reported no errors. Suite's console already contained two
StoryCanvas undefined-map errors before this interaction pass; the sidebar
exercise succeeded. No universe switches, reloads, vendor updates or Rust changes
were needed. Work remains local and uncommitted.

Follow-up: the user requested removing the rail icon entirely. The current
container-only control passed standalone Tauri checks for presence, collapse,
focus restoration and Enter to reopen. See SEQUENCE_ENTRY.md for this pass.
