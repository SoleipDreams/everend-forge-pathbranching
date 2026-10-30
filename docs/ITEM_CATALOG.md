# Item catalog and current property values

Resources now includes **Item catalog**, with **In this story** and **Universe
global** scopes. Story items are local or canon entities that can be owned and
marked **As an inventory item** on their entity type (or on an individual
entity). That child capability appears under **Ownable**. It controls which
entities can be chosen for copy conditions and initial inventory copies.
The global scope includes canon items and reusable item definitions saved in
`.everend/.pathbranching/items.json`. Global definitions are shared by stories
within that universe.

Create an item, add its bearer modifiers and save them. Each modifier selects
an existing numeric attribute, a signed amount and its activation:

- **While carried in inventory:** contributes while the copy belongs to the
  character, including while equipped or inside an owned container.
- **Only while equipped:** also requires `copy.states.equipped === true`.

Modifiers add once per copy. Two qualifying copies contribute twice. A copy
without an owner contributes nothing. Transferring or removing it changes the
result immediately. Copies owned by a profile apply to its playable character
or the active scenario's actor. Separate character copies keep separate
inventories.

The story catalog edits initial copies, their owners and equipment state.
During a story, copy consequences can modify **Equipped**, and temporary copy
controls expose the same state. Creating an item definition does not grant an
inventory copy.

Play scenarios have an **Initial inventory** section to prepare the items,
their holders and whether they start equipped. It only offers entities enabled
as inventory items. Other initial entity copies remain available separately.

Property conditions, character sheets and interaction attribute sources share
the current-value resolver. For example, agility 3 with an active sword bonus
of +2 is checked as 5. Sheets show the contribution in the value's tooltip; the
condition tester shows the current value and permits changing the value before
item bonuses. Permanent consequences edit the underlying mutable property, so
item bonuses never become permanent through repeated additions or removals.

**Save to global catalog** snapshots an item's definition and the local attribute
schema it needs. **Use in this story** imports an independent local definition
without inventory copies; reusing an already linked definition selects it.
Editing a global definition does not overwrite existing story customizations.
Malformed catalog data and incompatible attribute schemas are rejected without
replacing saved values. Canon Markdown is unchanged.

## Persistence and export

Story metadata retains item modifiers, references and initial copies through
JSON and modular EVPATH save/reopen. The global catalog is saved separately with
the existing universe compare-and-swap writer. Enhanced runtime exports retain
the item configuration; Ink and Legacy report an unsupported execution feature
rather than silently dropping the derived property behavior.

## Verification

- `npm run verify:items` covers current values, equipment activation, stacking,
  ownership, containment, copy isolation, permanent changes, interaction inputs,
  global reuse, invalid data, profile-specific state and modular reopening.
- 114 focused checks passed across this feature, condition authoring/evaluation,
  character stats, permission inheritance, authoring engine/storage and interaction
  behavior. Typecheck and production build passed.
- Playwright CLI exercised the actual Suite source-profile Tauri WebView2.
  The real Resources tab was inspected; mutations used a synthetic universe
  under the Suite's ignored `output/playwright/item-catalog-qa-universe`.
- Native checks created a sword, configured agility +2, created its initial
  copy, equipped/unequipped it and switched between carried/equipped activation.
  The sheet showed `3 + 2 = 5`, matching the condition result.
- A global definition was saved through native commands, read back and reused
  in a second synthetic story. That story's independent carried bonus and
  unequipped copy survived native save/reopen across six story files. Its
  condition still resolved to 5 while the global definition retained its
  original equipped activation.
- Editing that global definition from +2 to +3 saved successfully without
  duplicating its local attribute schema; the previously saved story retained
  its own +2 modifier and current value 5.
- Evidence: Suite `output/playwright/item-catalog-qa-native-roundtrip-result.txt`,
  `item-catalog-qa-story-b-result.txt`, `item-catalog-qa-console.txt` and
  `item-catalog-qa-global-edit-result.txt` and
  `page-2026-10-30T05-15-14-822Z.png`. The final console check had no errors;
  nine Tauri callback warnings followed a development reload during asynchronous
  work. The temporary mounted editor was removed after testing.

The full `verify:core` run still stops at the pre-existing
`verify-dialogue-nodes.mjs:243` trigger-rendering assertion. These feature checks
do not establish completion of the wider thesis authoring milestone.
