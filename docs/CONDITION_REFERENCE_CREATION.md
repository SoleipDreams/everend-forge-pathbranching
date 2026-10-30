# Create references from conditions

The reference picker offers **Create variable…** on Variable conditions,
**Create function…** on External function conditions, and **Create entity…** on
Entity state, Property and Inventory/copies conditions. The action stays
available when the picker has no compatible results.
Interaction results are configured from the **Interactions** inspector and are
not a generic condition type.

Creation opens a cancellable dialog. Variables have a name, type, initial value
and an existing variable group. External functions are declared as condition
functions. Entities are local to the current story and use an existing entity
type. Property conditions can choose an applicable attribute
or create a typed local attribute, then set its initial value. Reading is enabled
on the new entity without changing permission defaults for the whole type.

State creation enables the chosen runtime capability on the new entity.
Ownership and inventory creation can optionally add an initial inventory copy
for the active profile; creating the entity definition alone adds no copies.
Changing to another state does not submit a hidden inventory-copy choice.

**Create and use** selects the new resource in the originating row. Compatible
comparison operators and operands survive, as do sibling conditions. Cancelling
creates nothing. Invalid values, duplicate variable names and attributes outside
the entity type are rejected before changing the document.

The application merges resource creation and a completed condition edit into
one structural document action. Incomplete expressions remain recoverable editor
drafts. The flow is shared by condition editors and does not offer creation inside
same-copy filters, whose subject is the already selected inventory copy.

## Verification

- `npm run build:core` and `npm run build` passed.
- 75 focused checks passed across condition creation, authoring, evaluation,
  authoring storage, engine behavior and property permission inheritance.
- The new creation checks exercise typed comparisons, invalid input without
  mutation, nested attributes, profile-specific inventory, atomic merging,
  JSON reopening and modular EVPATH reopening with stable reference IDs.
- Playwright CLI used the existing Suite source-profile Tauri WebView2. A
  temporary synthetic editor exercised creation and automatic selection for all
  four supported condition kinds; sibling rows and operands survived. The actual
  story's variable dialog was cancelled without creating a resource. The
  synthetic editor was removed afterwards.
- Local captures are under the Suite's ignored `output/playwright/` directory,
  including `inline-reference-qa-results.txt` and
  `page-2026-10-30T04-33-43-837Z.png`. The final interaction sequence produced no
  additional console errors after correcting a development-time configuration
  reference.

These checks do not establish full thesis acceptance or a manual native
save/reopen/export cycle for this change. The broader worktree's previously
recorded `verify-dialogue-nodes.mjs:243` failure remains outside this scope.
