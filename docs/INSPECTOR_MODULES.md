# Optional inspector modules

The narrative inspector keeps the selected object's primary module and Connections
fixed. Events use Overview, decisions use Narrative, and speech and direction use
their existing Content editor. Decisions and their responses are authored as part
of Narrative; they do not have a separate inspector module. Conditions stay in
their own module and describe when the selected element is available. State changes
remain editable in a contextual disclosure beside the condition or route they
affect. Outcome Content remains an optional module. Adding a tab does not create
narrative content.

Right-click an optional tab, or press Shift+F10, to hide it or move it left/right.
Hiding never deletes content or recoverable drafts. Existing content reveals its
module on first inspection; subsequent visibility, order and active-tab choices
are local preferences keyed by project and object under
`pathbranching:inspector-modules:v1`. Explicit section navigation reveals a hidden
module. Fixed tabs cannot be hidden or reordered. Canon and management editors
retain their existing sections.

The tab row scrolls horizontally and stays at the top of the inspector while its
content scrolls. Add remains outside that horizontal scroller. Object cards,
saved groups, floating placement and expansion animations retain their existing
implementation.

## Conversations

An event's Conversation shows its own lines and a collapsible group for each
owned dialogue. Each group has its original context, line count, composer and
row editor; child groups also offer Open dialogue. Add dialogue creates a real
dialogue explicitly through the existing undoable authoring mutation.

Editing or composing from the event updates the same beats and script blocks
shown in the dialogue inspector. Changes in the child immediately appear in the
parent projection. Canvas highlighting can follow a child row without replacing
the event conversation. Routes do not establish ownership: returns, disconnected
nodes and branches are never flattened into a new timeline. Safe-segment editing,
shared-block copy protection, legacy-text conversion and draft guards remain in
the existing conversation model. No narrative schema or runtime format changed.

## Verification — 2026-10-09

Core regressions cover empty/default modules, existing content, hidden-content
preferences, ordering, document/object isolation and absence of UI preferences
from narrative serialization. Conversation regressions cover group ownership,
editing original child blocks, immutable snapshots, save/reopen and unchanged
runtime output, alongside the existing branching/cycle/shared-content checks.

The real Tauri WebView2 used the disposable universe
`output/playwright/modular-inspector-vault`. Native checks exercised add/hide/
restore, composer drafts while hidden, keyboard context menus, module ordering
and active-module restoration after reload. Parent editing and insertion were
visible in the child; child insertion, delete/undo and disk reopen retained all
three original child lines, then showed them in the event's group.

Layout checks exercised normal, expanded and fullscreen at requested widths
1440, 1100 and 900, with two stacked object cards. They verified a single tab row,
an accessible Add button, no document horizontal overflow and keyboard tab
navigation. Captures are `output/playwright/modular-inspector-{width}-{mode}.png`.
The native console reported zero errors and warnings. `npm run verify:core`,
`npm run build` (including typecheck) and Rust checking are recorded separately
under `output/playwright/modular-*-final.log`. This is inspector acceptance,
not a claim of full thesis/export delivery acceptance.

Final build, core and Rust checks passed. A later native restart encountered
Vite `504 Outdated Optimize Dep` cache errors and the window closed during a cache
refresh. The final additional close/reopen check for the remembered-module
navigation adjustment remains pending; the successful earlier native reload,
editing and layout evidence above remains separate from this limitation.
