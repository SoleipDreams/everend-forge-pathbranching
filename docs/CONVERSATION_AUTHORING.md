# Conversation authoring

Implemented and checked in the Windows Tauri WebView2 on 2026-10-09. Conversation
replaces the Event **Path** and Dialogue **Narrative sequence** writing section
inside the existing inspector. The canvas, inspector stack, object metadata,
choices, conditions, consequences and connections remain available. A selected
speech's Content tab uses the same row editor.

## Authoring behavior

- One row is one existing `DialogueBeat` referencing a `ScriptBlock`. Speech uses
  `speech`; a scene action without a speaker uses `direction`. Narrator is speech
  without a character and remains distinct from a scene action or gameplay action.
- Select an existing entity through search, use its portrait and character
  variants, or create a local character. A local character adds presence to the
  event without writing to portable WorldNotion canon.
- Enter in a line commits its text, then inserts another line with that line's
  kind, speaker and variant. Shift+Enter writes a newline. The composer uses Enter
  to add and Shift+Enter for a newline. IME composition does not add a line.
- Use the trailing **…** menu, right-click, Alt+Up/Down, or drag handles to
  reorder inside one safe segment. The same menu provides insertion above/below,
  deletion and the existing advanced inspector sections. Shift+F10 opens it;
  arrow keys navigate it and Escape restores focus. Ctrl/Cmd+Enter opens the line's Connections section.
- Focusing a row highlights its canvas node; ordinary selection of that node also
  highlights the row while keeping the owning Event or Dialogue Conversation
  open. Both directions preserve the canvas viewport. Explicit Inspect still
  opens the individual node's advanced editor. Delete while a Conversation row
  has focus cannot accidentally delete its owning scene.

## Topology and shared content

`conversationModel.ts` projects the existing graph; it does not infer a new
linear story or flatten a branch. Branch points, cycles, routes with logic,
external references, cross-container edges, named entries into the middle of a
chain, and missing blocks protect the affected connections. Safe segments can
still be edited individually. A visible note directs complex connection editing
to the canvas.

Insert, move and delete are immutable, atomic project mutations and therefore
use the existing undo history and autosave queue. Reordering retains route IDs
and metadata, character variants, translations, beat metadata, and stored canvas
positions. Deletion reconnects a certified plain continuation and retains a
script block when another beat references it. Localization keys are retained
because consumers can reference them independently.

A shared block is read-only in Conversation until **Make a copy to edit** is
chosen. That explicit operation copies the block and its localized text for this
beat; other uses remain unchanged. Existing prose stays editable in its legacy
section. **Convert to one line** explicitly converts supported plain/Markdown
prose into one beat and clears the old prose in one undoable operation. Dialogue
prose must be converted before new lines are added, so existing runtime text is
not silently hidden. No storage version or runtime format was introduced.

## Drafts and preferences

Line fields reuse the existing recoverable text drafts and autosave after 500 ms
or blur. Enter waits for a successful text commit before inserting. A protected
shared field cannot commit through an earlier pending timer.

The new-line composer and local-character name are manual drafts in the existing
`pathbranching:authoring-drafts:v1` store. They survive inspector changes,
floating/docked presentation, interface-language changes and reload. Suite and
standalone universe/document guards report unresolved drafts instead of applying
or discarding them. The standalone native close handler uses the same guard;
Suite retains ownership of its coordinated close behavior.

Kind, speaker, variant, selected row and text language are local preferences under
`pathbranching:conversation:[projectId,eventId,dialogueId]`. None of those
preferences or drafts become narrative exports.

## Verification evidence

`npm run typecheck`, `npm run build`, `npm run verify:core` and
`cargo check --manifest-path src-tauri/Cargo.toml` passed. Rust produced no
warnings. Vite retains the existing mixed static/dynamic persistence import and
large-chunk warnings.

`scripts/verify-conversation-model.mjs` adds twelve regressions for topology safety,
atomic edits, immutable undo snapshots, existing geometry, cross-container and
named-entry protection, shared blocks, legacy conversion, local characters,
recoverable composer guards, owner-aware canvas selection, local-speaker presence
validation, save/reopen, EVPATH and Enhanced playback. The
application activity regression also covers a blocked standalone native close.

The real Tauri session on CDP 9222 used a synthetic vault under
`output/playwright/conversation-vault`; no real canon was edited. Native checks
covered composing speech and scene actions, text autosave, Enter/Shift+Enter,
speaker search, keyboard and drag ordering, deletion with undo, disk reload,
recoverable drafts, docked/floating switching and Play Mode. Opening another
universe through the native application menu with a pending composer was blocked
before the folder dialog; the draft stayed intact and the reason was visible.
Play Mode traversed:

1. `A cold wind slips beneath the door.`
2. Alice: `Keep the lantern lit.\nUntil dawn.`
3. Marin: `I will watch the door.`

The complete native matrix covers all sixteen combinations below, using the
current Forge Mono light/dark themes and the same saved fixture. Every combination
retained the three texts, kept Tab navigation inside Conversation, and showed no
horizontal overflow in the app, document or rows. Each theme/language pair was
loaded through a fresh native reload; the console listeners recorded zero errors,
warnings or page errors across the matrix.

| Viewport | Spanish light | Spanish dark | English light | English dark |
| --- | --- | --- | --- | --- |
| 1440x900 | Checked | Checked | Checked | Checked |
| 1280x720 | Checked | Checked | Checked | Checked |
| 1100x720 | Checked | Checked | Checked | Checked |
| 900x700 | Checked | Checked | Checked | Checked |

The captures use `conversation-matrix-{width}x{height}-{es|en}-{light|dark}.png`.
At compact widths the explorer was collapsed through its normal UI to expose the
canvas beside the contextual surface. The first matrix exposed a legacy floating
CSS rule that constrained docked inspector height to 52%, and a compact surface
that overlapped canvas actions. Both were corrected: the legacy rule now applies
only to floating presentation, and compact docked placement reserves the measured
toolbar height. The final captures reset nested scroll positions and verify that
the first line is visible. The 900x700 retest fills the useful dock height, clicks
Validate with the surface open, and confirms unobstructed Play Mode and Export
hit targets. A manually chosen 440px card height survives switching between
floating, docked and focus modes; docked and focus render that requested height,
and Expand height restores available-height mode. Earlier WorldNotion-theme
captures remain available for comparison. Reduced motion produced a `0s` row
transition. Original debug settings
and viewport were restored after the matrix. Portrait/variant selection with a
real media library remains outside these fixture checks.

**Validate** was opened from the same native document at 1440x900 and 900x700.
The initial two warnings incorrectly treated local Alice and Marin as missing
canon references in event presence. Presence validation now accepts an existing
local entity while retaining warnings when that identity is actually absent.
The regression verifies both cases; the final native fixture reports zero errors
and zero warnings, captured in `conversation-native-validation.png` and
`conversation-native-compact-validation.png`. Geometry, focus, console and
validation results are recorded in
`conversation-native-matrix-report.json`.

Enhanced **Review output** was checked in the native app against bytes generated
from the same saved fixture: 15,987 UTF-8 bytes, SHA-256
`2c58593d3362f57e9065b873934ccf6f628f019c8c9ad26152f56ccc32e133fe`.
Compared with the earlier 15,952-byte review, the sole change is the compatible
`speakerRef: "alice"` alias on the first speech script block; its `characterRef`
was already Alice. All executable runtime nodes are identical. The structural
comparison is recorded in `conversation-native-export-difference.json`.
Reopening the final package preserved all three lines and their playback order, without
canvas, layout preferences or drafts. The export UI correctly marked Ink blocked
for this fixture's event boundary bindings and Twine/SINPO as limited. The native
Windows Save dialog was not completed, so GUI file delivery remains a manual
check rather than a claimed full export acceptance.

Local artifacts, excluded from the source delivery, include
`conversation-native-1440.png`, `conversation-native-1440-light-en.png`,
`conversation-native-1280-light-en.png`, `conversation-native-1100-light-en.png`,
`conversation-native-900-light.png`, `conversation-native-playback.png`,
`conversation-native-export-preview.png`, `conversation-native-draft-guard.png`,
`conversation-native-bidirectional-selection.png`, `conversation-native-compact-fixed.png`,
`conversation-native-runtime-package.json`,
`conversation-native-export-proof.json`, `conversation-native-export-difference.json`,
`conversation-build-final.log`,
`conversation-verify-core-final.log` and `conversation-cargo-check.log`, all under
`output/playwright/`.


## Vertical dialogue view

Conversation shows event lines and every dialogue as open vertical sections,
without collapsible dialogue groups. Each begins with its title, spoken
characters and existing event/beat locations; no location is inferred or added.
The controls row follows the summary. Each line places the speaker controls,
editable text and trailing menu in reading order, stacking on very small widths.
A right-hand index jumps to a section or existing line and restores focus without
changing narrative order or viewport of the canvas. Dialogue inspectors use the
same view filtered to their own scope. Shared blocks and graph protections keep
the original mutation rules.

Verified in the real Suite WebView2: three laboratory lines, index navigation,
trailing menu, right-click, Shift+F10, Escape/focus return, and 650px without
horizontal overflow. Existing verify:core and typecheck/build pass. Screenshots
are local output/playwright/conversation-vertical*.png; no narrative mutations
were made during the read-only UI verification.

## Narrative reading surface

The inspector module is now Narrativa/Narrative; section IDs remain `path` and
`narrativeSequence`, preserving saved preferences. Empty event lines do not
precede populated conversation groups. A completely empty surface offers only
a left-hand + menu: Start a conversation creates a dialogue container, and Start
a dialogue creates a standalone speech using the existing authoring mutation.
Empty containers offer a + before showing the line composer. Existing prose
remains accessible for explicit conversion; shared-block and route protections
are unchanged.

The index is visible only in canvas fullscreen. It lists conversation group
titles and standalone lines, with no line numbers or children of named groups.
The entry nearest the reading viewport and its immediate neighbors show names;
other entries show bars, revealing names on hover or keyboard focus. Navigation
continues to target existing document IDs and never changes execution order.

Verified read-only in Suite WebView2 on Sueño Premonitorio (eight groups) and
the empty Despertar event: no empty event header/composer, fullscreen-only index,
scroll-aware neighbors, hover labels, + choices and Escape focus restoration.
Typecheck/build, inspector session verification and verify:authoring passed.
Local captures: narrative-index-simplified.png and narrative-empty-plus.png.

The always-visible New line composer is replaced by a +. It opens an inline
provisional card with type, speaker/variant and text. Text continues to use the
recoverable composer draft key, including drafts from the previous UI. Confirm
(check or Enter) inserts through the existing protected mutation and focuses the
new editable row; discard clears only this composer draft and restores + focus.
Empty lines can be confirmed and completed afterward. No provisional state is
added to the narrative document or runtime exports before confirmation.
Suite WebView2 verification opened/configured/discarded a draft in the 50-line
conversation without adding narrative rows; old composer absent and focus
restored. Local captures: narrative-provisional-line.png/narrative-plus-only.png.

Conversation summaries now expose searchable + controls beside Characters and
singular Place. Adding a character updates the owning event's presence, shared
with Connections and other dialogue summaries. Place edits the event's single
starting location and adds that entity to presence; existing later beat location
overrides remain intact. Search offers existing universe entities and respects
configured location types. An unconfigured universe explains this prerequisite.
No new conversation-specific metadata is added.

Validation: typecheck/build passed; 16 conversation model checks include presence
serialization/reopen and initial-location replacement/clearing while preserving
later overrides. Read-only Suite WebView2 checks covered search filtering,
keyboard result navigation and Escape focus restoration. The open universe had
14 character choices and no enabled locations; no real narrative was modified.

Narrative row speaker controls now show only Name (variant), without a portrait
or a separate variant select. Choosing a character with multiple variants opens
a second menu view with Back and the available variants; only choosing a variant
commits the speaker/variant together through the existing mutation. The same
picker is used for provisional lines. Speaker and text frames stretch to equal
height (64px minimum). Suite WebView2 verified Ridina (Adulta), available Adulta /
Niña / Joven variants, equal measured heights, no inline variant select, and
Escape focus restoration without changing the real universe. Capture:
`output/playwright/narrative-speaker-unified.png`. Typecheck/build passed.

The subsequent visual adjustment restores the selected variant's portrait next
to Name (variant). The character column is fixed at 220px, portraits at 36px,
and long labels truncate with the full name available on hover. All text fields
therefore start at the same horizontal position. Narrow inspectors stack the
fields. Suite WebView2 verified equal widths and matching text/control heights
in ten real lines and the loaded selected-variant portrait, without editing the
universe. Capture: `output/playwright/narrative-speaker-portrait.png`.

Speaker controls have a transparent border/background at rest, revealing their
button frame on hover, keyboard focus or while the picker is open. Direction
labels use the same 14px text, 36px icon slot, padding and 64px minimum height as
speaker controls. Typecheck and read-only Suite WebView2 checks passed for idle /
hover styling and a real direction row. Capture:
`output/playwright/narrative-direction-aligned.png`.

The character column is now 190px (30px more for writing). A single available
variant is omitted from the visible label; multiple variants retain parentheses.
Long names use ellipsis with the full label on hover and in the accessible name.
Typecheck and read-only Suite WebView2 checks passed for twelve controls,
including Aihilie without (Base) and a clipped Ridina name retaining its full
tooltip. Capture: `output/playwright/narrative-speaker-compact.png`.

Decision cards center their heading and a compact option group. Outcomes share
consistent card dimensions, and the add button stays adjacent to the group.
Option text fields show no border at rest; hover and focus reveal the edit frame.
Read-only Suite WebView2 inspection confirmed centered outcomes, add-button
alignment and the idle/hover field states.
