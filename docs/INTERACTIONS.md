# Narrative interactions · interactions-v1

Interactions share one event-owned definition across stable uses. A use without
an owner is a canvas node; an attached use belongs to a speech, direction,
dialogue, decision or response. Canvas position has no execution meaning.

Open the dedicated **Interaction** inspector module (available through **+**)
on the event or a narrative element. Use **Attach here**, **Add node**, or
**Add wait** there. Conversation, overview and logic modules do not embed the
interaction editor. A dialogue shows the interactions and waits in its scope. Attached cards show Before/During/After.
Independent nodes and barriers appear as editable rows on explicit single-route
segments. Branches and shared script blocks retain the conversation editor's
existing protections. Inspect the row to edit its parameters, result routes or
wait references. Canvas interaction nodes provide result output ports; connecting
one creates an ordered `interactionResult` condition. The ordinary output is a
shared continuation. Concurrent result routing uses a referenced barrier.

Definitions support dice (1–100 dice, 2–1,000,000 sides, finite modifier and
inclusive nonoverlapping ranges covering the possible totals), skill checks
(numeric variable or property; success at total >= difficulty), one-key QTEs
(KeyboardEvent.code, positive milliseconds, success/failure/timeout), and custom
mechanics (description, JSON parameters and declared results). Result consequences
use the existing narrative effect editor. Prompt translations are edited by
language and retained with the definition. Legacy decisions labelled dice/QTE
remain unchanged until the author explicitly converts and configures them.

Before/after and independent nodes block until resolution. During uses run until
a wait barrier; every referenced use must have started and resolved. Resolution
updates state and consequences once per execution, refreshes available responses,
and leaves navigation to the next connection/barrier. A confirmed response stays
confirmed. Multiple pending interactions are supported within one narrative flow.
Leaving/ending an event with pending interactions blocks. Returning calls suspend
the caller's interactions and QTE clock until the caller resumes.

Play Mode resolves dice/skills normally and custom results manually. Debug/Play
also allow forced results, marked `[forced]` in the trace. QTEs accept one key;
incorrect input fails. Pause or focus loss suspends the clock, including detached
test windows. Back restores the previous executions, rolls, elapsed time, state
and consequences; loops create new execution IDs. The core accepts an injected
random source and clock, or explicit elapsed-time commands for focused UI clocks.

Mutations use the existing document undo/save path and recoverable text drafts.
Event JSON sidecars retain definitions, uses, barriers and prompt translations.
The generated `.evpath` is guarded: unchanged source is accepted; reconciliation
of changed source is blocked while interactions exist, preserving the enriched
JSON. Edit these events in the inspector. Enhanced JSON/YAML declares
`interactions-v1`; consumers must execute `pathBranching.events` and the declared
source model rather than only flattened legacy nodes. Active timers, temporary
resolved results, trace/history and canvas preferences are excluded. Ink, Twine,
SINPO and Legacy cannot preserve this execution and provide blocking diagnostics.
Unity, daemon and synchronization contracts are outside this delivery.

Verification: `npm run typecheck`, `npm run verify:core`, `npm run build`.
`scripts/verify-interactions.mjs` covers 16 regression groups including equivalent
nodes/cards, before/during/after, response confirmation, multiple pending uses,
barriers, QTE outcomes, dice/skill boundaries, cycles, calls, back, single effects,
explicit conversion, save/reopen, guarded source and Enhanced JSON/YAML rebuild.
Native acceptance uses disposable universes with the Playwright CLI attached to
Tauri WebView2, following [TAURI_DEBUG.md](TAURI_DEBUG.md). Suite validation uses
its standalone-sources profile without updating vendor copies.
