# Forge authoring workspace

The standalone editor owns its presentation. Suite can provide palette, locale,
shared-universe navigation and native window controls without becoming a dependency
of the public package.

## Surfaces and session preferences

- The left management sidebar owns Stories, Canon, Logic, Export & Import and
  Connect. Its vertical navigation stays available when the surface is collapsed.
  One view opens at a time; hidden sections stay mounted so switching views does
  not reset search, tree expansion, import state or incomplete fields. Older
  visibility preferences cannot make a view unreachable from the navigation.
- Layout reset lives at the foot of that sidebar. The workspace topbar no longer
  presents a separate View menu or Export & Import entry. Canvas export shortcuts
  open the same left management view.
- Canvas controls float over the graph: the guarded story selector sits at the
  top left, Visual/Logic stays centered, compact Play sits immediately to its
  right, and validation and narrative language sit at the top right. Nested
  breadcrumbs remain available alongside the story selector. Narrow canvases
  move Visual/Logic and Play to a second row without shifting the toggle's center.
  Play reveals its pause/stop/options controls when started and collapses again
  on stop. Inspect, Write story, Enter and Export are removed from this toolbar;
  node gestures, inspector sections and the management Export view remain available.
  Canvas and inspector tool buttons use rounded corners.
- Return connectors follow narrative adjacency from sequence/input roots,
  including route gates and decision outcomes. Only transitions closing a path
  to an ancestor, self-loops and explicit restart/parent exits are returns;
  ordinary converging branches remain ordinary flow. Dragging nodes or their
  containers never changes this classification. Entry-free disconnected loops
  use stable IDs as a deterministic fallback. Labels, grouping and faint traces
  remain presentation only and do not rewrite destinations or exports.
- The inspector currently
  supports Floating only, anchored 12 px from the canvas bottom and right edges.
  Open inspectors form a vertical stack of cards, with 42 px collapsed headers
  and one expanded editor at a time. The stack grows upward from that corner;
  its 440 px default editor height and numeric flex-basis animation are preserved.
  The available dock area is transparent and allows canvas interaction outside
  the visible cards. The inspector's single control row above the stack contains
  tab groups, combined width/height expansion
  and canvas fullscreen. The presentation selector and its Options menu are gone;
  older Docked preferences migrate to Floating without rewriting the saved size.
  Expansion stays anchored to the same corner. Test starts from the canvas and offers
  Back to inspector when an editing target is open, without an Edit/Test tab bar.
- Canvas fullscreen preserves the management sidebar and keeps the canvas behind
  a centered inspector. Escape closes a local menu before leaving fullscreen.
  Inspector sections and tab-group menus adapt to reduced and expanded widths.
  Groups open above or below their trigger according to the available canvas space.
- `explorerTab`, `contextPresentation`, `contextTab` and `contextFocus` belong to
  `PathBranchingWorkspaceSession`. They are not branching-document/runtime fields.
- Allocation uses the observed application width after Suite navigation. The
  management surface becomes a drawer when it cannot fit alongside a 480 px canvas and the
  contextual surface; the contextual surface becomes compact when necessary.

## Theme and embedding contract

PathBranching CSS is scoped to `.pathbranching-app`. Palette definitions are local
to that root's `data-theme`; the canvas tools portal stays inside the root.
`forgeTheme.css` provides the standalone `--ef-*` semantic surface, text,
spacing, radius and motion variables. UI typography is sans serif; authored text
can still use the configured primary font.

`StoryTestDetached` owns its `.pathbranching-app` root and eagerly includes palette,
semantic tokens, playback and native-window styles. Hosts can mount that entry
directly without importing the main editor. Its session snapshot supplies the
root theme and its writing font remains scoped to that window.

`SuiteChrome.windowControlsManaged` suppresses standalone native controls when
Suite owns them. There is still only one upper bar: `.pb-authoring-topbar` in the
workspace and `.home-topbar` at standalone Home. Both use the existing drag handler
and interactive-target exclusions.

`SuiteChrome.active` also suspends global keyboard, pointer-menu and modal focus
listeners through the standalone activity context. Tool switches, Suite Home and
Suite preferences retain local panel state without allowing an invisible overlay
to intercept Escape/Tab or restore focus. A standalone window defaults to active.
Embedded reload actions delegate to `SuiteChrome.onReload`; only standalone owns
the native close-request listener, while Suite coordinates its mounted guards.

`SuiteChrome.registerUniverseSwitchGuard` registers an async guard for accepted
document changes. It drains the persistence queue and catches edits arriving during
a write. Manual event/inspector/text/Markdown/test drafts and recovery sessions
block navigation; the guard never applies or discards them. A blocked switch emits
`everend-forge:universe-switch-blocked` with `{ app: "pathbranching", message }`
so Suite can report the reason even when another tool is active.

Write story follows the entered event or dialogue before a stale canvas selection.
Its contextual Text field edits the event/dialogue's existing prose; it does not
compose the next Speech block. Valid text fields keep their existing 500 ms/blur
autosave. Input remains recoverable until accepted, and invalid names or unapplied
Path script input continue to block a universe switch. Contextual prose is retained
in the modular JSON sidecar when a dialogue already contains individual beats.

## Verification

`verify:core` includes `verify-forge-workspace.mjs` for allocation, session migration,
save catch-up, draft retention and write/load failures. `verify-application-activity.mjs`
executes the production hooks with a deterministic lifecycle to check suspension,
reactivation, Escape/Tab, focus restoration and cleanup. It also executes the native
close effect with a stub native module to ensure that Suite has no competing listener.
`verify-story-test-detached-entry.mjs` builds the detached entry alone in memory,
checks its stylesheet and renders both presentations directly without App.tsx.
These checks do not establish real keyboard or native-window acceptance. Desktop acceptance remains
a separate check using Playwright attached to real WebView2 and disposable content;
static checks do not certify native-window behavior or thesis acceptance.

2026-10-09 inspector presentation check: real Tauri WebView2 via the existing
Playwright CLI session, on local changes over `9d7a573`. Verified centered reduced
and expanded floating sizes, one control row, Options keyboard navigation, tab
group reflow without horizontal overflow at a 700 px viewport, both canvas
fullscreen presentations, and management navigation while fullscreen stays open.
Play Mode and return-to-inspector navigation remained usable. A clean reload
restored the inspector selection and presentation with zero console errors or
warnings. Typecheck, core verification, build and cargo check passed. Local
captures and logs remain under ignored `output/playwright/`; this is a focused
presentation check, not full authoring-cycle or Suite acceptance.

Later on 2026-10-09, the reduced and enlarged floating inspector returned to the
bottom-right corner at the user's request. Docked and its presentation menu were
removed. Checked both sizes and their right/bottom margins in Tauri at desktop
and 700 px widths, clean-reload restoration, and fullscreen/restore with the
management sidebar visible. Session verification covers legacy Docked migration
without losing width, height or fullscreen preferences. Typecheck, core, build and
cargo check passed again; the final desktop console reported no errors.

The vertical card stack was subsequently restored after the fixed-height window
had overridden its sizing and transitions. Real WebView2 checks covered four
open event tabs, switching the expanded card, all-collapsed headers, a 440 px
reduced editor, 900 px expansion and canvas-only fullscreen with the sidebar
visible. Frame sampling confirmed both 42→440 px growth and 440→42 px collapse
with intermediate sizes and a fixed bottom edge. Groups remained within the
canvas with a single collapsed tab and at a 700 px viewport. Clean reload retained
the original open inspector with no console errors or warnings. Typecheck, core
verification, build and cargo check passed. Build still reports the existing
large-chunk and mixed static/dynamic import warnings. This validates the inspector
presentation, not the complete thesis authoring cycle.

The floating canvas toolbar was checked in real Tauri WebView2 on 2026-10-09:
switching to another story and back through the selector, Visual/Logic toggling,
Play revealing its controls and Stop collapsing them, options and language menus,
and nested-event entry/return through node gestures and breadcrumbs. At 700 px,
the toggle remained centered, controls did not overlap, the story selector retained
its readable width in nested scopes, and Play options stayed inside the canvas.
Reload retained the active story with zero console errors or warnings. Typecheck,
core verification, build and cargo check passed; existing build bundle warnings
remain. No narrative data or runtime export format changed.

Semantic return checks on 2026-10-09 passed for reversed node positions, container
offsets, reordered canvas arrays, self-loops, choices, convergent branches,
disconnected cycles and real route-gate projections in both layers. Core tests
also assert that classification leaves the authored project untouched. Tauri
retained the laboratory's ten return connectors in Visual and Logic; clean reload
reported no console errors or warnings. Typecheck, core, build and cargo check
passed. Coordinate invariance was verified with synthetic fixtures, without
dragging or rewriting nodes in the user's universe.
