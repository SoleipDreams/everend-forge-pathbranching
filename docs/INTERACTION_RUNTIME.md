# Reusable mechanics and local interaction execution

Interaction mechanics are offered by the universe catalog from Resources → Interactions.
Each story use executes its local definition snapshot; opening, previewing or
exporting a story does not consult the live universe catalog. Updating a preset
does not change a local interaction until the author reviews and applies it.

## World and opposed checks

`skillcheck` compares a numeric skill plus optional dice and modifier against a
local difficulty. The numeric skill is captured when the execution starts.

`opposedcheck` contains `actor`, `rivals` and `aggregation: "all" | "any"`.
Every participant has a stable role ID, character/copy subject, optional numeric
skill source, optional dice and a finite modifier. A property skill is read from
that participant's own subject through the shared character-property resolver.
Identities, variants, attributes, dice and modifiers are frozen at start.

The actor rolls once. Each rival rolls independently once; the actor total is
compared to every rival. Higher wins and equality produces a separate tie.
For `all`, a defeat wins precedence over a tie, then success. For `any`, success
wins precedence over a tie, then defeat. Definitions require one result each
with keys `success`, `failure`, and `tie`. Only the aggregate result applies
consequences, once per execution.

Each aggregate consequence can carry an optional condition that reads an
individual rival's result, including changes to concrete copies. The resolved
result is available while these conditions run. If any consequence is invalid
or unresolved, every state change and the provisional result are rolled back;
the captured rolls remain cached so retrying after Back cannot reroll.

Resolved state records `participantTraces` for actor and rivals, plus
`participantResults` keyed only by rival role ID. Internally, interaction routing
reads the aggregate result or an actor-versus-rival outcome; this routing is
configured in the Interactions inspector rather than authored as a generic
condition. Actor and missing rival IDs are invalid.
Undo/replay keeps all frozen values, rolls and results, and never rerolls a
cached execution. Forcing an aggregate debug result does not manufacture
per-rival results.

The replay cache identifies the use, definition, occurrence, resolved context
and frozen operands. Choosing another branch or actor after Back cannot reuse
the former execution's rolls merely because the public execution serial repeats.

Enhanced exports declare `opposed-interactions-v1` only for actual opposed uses.
Unused catalog entries or local definitions do not require interaction execution
support. Canonical property descriptors accompany the independent story model.
Changing these descriptors invalidates a running preview and requires a restart,
as do changes to narrative data; changing canvas placement does not.

## Availability and execution placement

Availability is evaluated before a node's own `before` interaction starts.
An option's interaction starts only after that option is selected. Its own
availability therefore cannot depend on its own interaction result.

To unlock options based on a roll, execute the interaction on the decision
`before` showing options, or at an upstream node, then reference that use in
the option conditions. The decision's own availability must not require the
result of its `before` interaction. A roll made after choosing an option routes
its result through the option's outgoing transitions.

Validation rejects direct self-dependent availability and incoming routes.
Creation and its condition edit are merged as one document change before one
undo entry is recorded. This keeps a newly inserted execution node, its route
rewiring and placement metadata when the condition callback was derived from
the document before creation. Catalog writes remain a separate explicit save.
Complex cycles and cross-event timing still need a scenario preview. Concurrent
`during` interactions require a reachable wait barrier; one opposed execution
completes all participant rolls together before the barrier releases.

## Focused checks

Run `npm run verify:opposed-interactions` for independent rolls, ties,
aggregation, frozen values, numeric canonical variants/copies, replay,
consequence idempotence, before/during/after timing and export requirements.
Tauri authoring acceptance is checked separately from these runtime regressions.

## Authoring panels

Resources contains Entities, Character sheets, Interactions and Files, in that
order. Interactions separates Mechanics and Story uses. Logic contains Properties
and Variables; the Actions and Rules catalog tabs are hidden for now, without
removing their saved definitions, evaluation or export support.
The story-use catalog displays scene, timing, mechanic and participants;
editing opens a wider configuration surface with contextual search fields.
Character sheets expose canonical, initial and current values without changing
the actor when a sheet is selected. Their WorldNotion links open the character,
variant and specific attribute. Explicit note saves, inspector autosaves and
schema saves notify the Suite so the active PathBranching document refreshes its
canon without replacing narrative data or local drafts.

The template catalog offers nine dice presets (D4, D6, D8, D9, D10, D12, D20,
D100 and 2D6), five skill checks (three world checks and two opposed checks),
three QTEs and three manually resolved custom mechanics. World checks leave the
attribute unbound; opposed checks leave independent character and attribute
slots for each participant. Each use must assign these executable references.

New libraries start with all templates. Existing libraries remain unchanged on
load; Resources → Interactions → Mechanics → Templates can explicitly add one
template or all missing templates. Stable IDs prevent duplicate additions and
preserve customized presets with the same ID. Search and category filters apply
to both the library and template catalog. Character sheets retain a shortcut to
Logic → Properties when an attribute needs its logic capabilities configured.

## Inspector flow

Decisions display their options as vertical branches. The selector scrolls with
the inspector content rather than remaining fixed above it.
Conditions and Interactions use a centered shared toolbar for the selected
option. The first option and its Conditions are selected on opening the decision.
Each option also has an independent inspector (Option, Conditions, Interaction,
Connections), opened from its canvas letter in either layer or from the shared
toolbar. Canvas condition/interaction buttons open that option's corresponding
tab. Opening an option does not redirect to the decision. These are local UI
selections and are not part of the story or export.

Transition lines remain selectable for connection operations but do not open
inspectors. Their route labels and return connectors are informational. Router
nodes retain their own inspectors. Previously open edge tabs are removed from
the authoring session without changing any transition data.

Dice uses display their symbol above a total axis. The symbol opens the existing
mechanic configuration. Each result occupies its inclusive interval on the
same horizontal scale, in a separate lane so overlaps remain inspectable.
Uncovered totals are hatched; overlaps are marked separately. Select a result
to edit only its name, bounds, effects and continuation. Dragging a boundary
commits on pointer release; arrow keys, Home/End and the numeric fields offer
keyboard alternatives. The scale covers `count … count * sides`, shifted by
the modifier, rather than probabilities. Fractional modifiers retain the
integer-roll lattice. Coverage is calculated from range boundaries without
enumerating every possible total.

The other mechanics share a vertical result-flow inspector. Their top symbol
opens the existing complete configuration; the middle summarizes operands and
the bottom branches select one result editor for effects and continuation.
World checks display attribute/variable + optional dice + modifier against the
difficulty, with success at total >= difficulty. Opposed checks show the actor,
each rival and the aggregation rule, with the exact victory/defeat/tie rules
on their branches. QTE displays the key and a static deadline bar, not a running
timer. Custom mechanics display their resolution instruction and editable result
branches. Result buttons wrap at three per row and center incomplete rows.
Arrow keys and Home/End change the selected result. Adding selects the new
result; deleting it selects the first remaining result. All of these selections
remain local UI state. The existing mechanic model, execution and exports are
unchanged.

Every opponent in a reusable mechanic has an independent unbound slot. Slots
must be assigned to characters or copies in the story use; they do not consume
the recipient context used by narrative actions. Creation from a condition
checks executable references and preserves its recoverable configuration until
the author completes or cancels it.

See [authoring validation](INTERACTION_AUTHORING_ACCEPTANCE.md) for native
Tauri evidence and existing failures outside this implementation.


## Dice selection and compound pools (2026-10-15)

Resources → Interactions owns the reusable dice composition and base modifier.
The story inspector selects a mechanics copy and owns its prompt, inclusive
result intervals, continuations and consequences. Its compact selector is right
aligned, expands into a left-hand symbol and a searchable catalog on the right,
and keeps project-local recent choices outside the story document. Creating or
editing in Resources preserves the current inspector and does not automatically
update existing uses. A new unconfigured node has `mechanicPending: true`, no
results, and a choose button. Validation and runtime resolution reject that
pending definition; Enhanced export refuses pending uses.

Dice mechanics optionally carry `groups: [{ id, count, sides }]`. When present,
the groups are authoritative; count/sides mirror the first group for the existing
homogeneous representation. Stable group IDs preserve editing identity. Each die
is rolled separately and all rolls plus the modifier form one total. The domain
is `sum(count) + modifier … sum(count * sides) + modifier`, not a probability
scale. Examples: 2D4 + 1D2 spans 3–10; 2D10 + 3D9 spans 5–47. The existing limits
apply to the whole pool: at most 100 dice, each with 2–1000000 sides.

Execution caches retain the complete rolls and pool metadata across replay and
Back. The Play dice notice identifies each die's actual sides. Story JSON,
EVPATH and Enhanced packages preserve groups independently of the source library.
Only packages using grouped dice declare `compound-dice-v1`; unsupported export
profiles report that capability rather than flattening mixed dice. No Unity
adapter changes are included.

Selecting another dice preset preserves local result IDs, routes and effects.
A single result spanning the complete old domain follows the new domain;
multiple/custom intervals remain authored and any coverage problems are reported.
Changing to a different mechanic category requires a new use to keep existing
result references intact.
