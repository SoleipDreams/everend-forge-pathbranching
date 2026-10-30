# Condition rows and group layout — 2026-10-15

The shared condition editor now uses one compact line per condition and complete
group cards, including the root. Column labels appear once per group, before its
first direct condition. Fields retain the contextual pickers; unary conditions
reuse the value column for their modifier. Inventory filters open from an icon
in the condition row. Group headers provide mode, independent NOT, rename,
collapse/count and actions.

Pointer capture supports moving rows and groups within an editor, including
between groups. The menu provides the same move operation through a contextual
group picker. Moves preserve editor identities and authored operands/labels,
reject root moves, cycles, foreign editors and excessive depth, and submit one
document change for undo. Visual state stays outside saved condition expressions.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run build:core` | Passed |
| `node scripts/verify-condition-authoring.mjs` | 17 passed, including two new move/roundtrip regression cases |
| `node scripts/verify-conditions.mjs` | 15 passed |
| `node scripts/verify-condition-ux.mjs` | 10 passed |
| `node scripts/verify-authoring-editor.mjs` | Passed |
| `node scripts/run-vite.mjs build` | Passed; existing chunk/dynamic import warnings |

## Suite Tauri source-profile check

Reused the real Suite WebView2 at CDP 9223 with Playwright CLI and the synthetic
`QA Interacciones` universe. Authored conditions on the `Esperar y también` option.

- Configured progress and numeric character-property conditions and an inventory query.
- Dragged a condition into a child group and reordered the entire group.
- Used search, ArrowDown and Enter in Move to group; Ctrl+Z restored the previous parent.
- Renamed the child group, selected Any, toggled NOT and collapsed/expanded it with its count preserved.
- Opened inventory owner/filters from the row and rejected a drop into its separate filter editor.
- Measured 36 px control rows without horizontal overflow at 779 px and 386 px content widths.
- The collapsed inventory row has the same 45 px shell height as other rows.
- Saved the synthetic universe, reopened the real test universe, then reopened
  `QA Interacciones`; the three root rows, the two rows in `QA Requisitos`, its
  `Any` mode and NOT state all survived the save/reopen roundtrip.
- Console reported zero errors and warnings during these interactions.

Capture: Suite `output/playwright/conditions-inline-groups-qa.png`; ignored local evidence.

## Existing or unrelated worktree failures

- `npm run typecheck` and therefore `npm run build`: `src/App.tsx:18279` passes
  `onResetLayout` to `AdaptiveWorkspace`, whose current props do not declare it.
  Neither file was changed for this layout work.
- `npm run verify:core`: existing `verify-dialogue-nodes.mjs:243` assertion about
  triggers rendering independently of dialogue containers.
- `npm run verify:authoring`: existing naming expectations require `Decisión 1`
  while the current implementation returns `Decisiones 1`. Drafts, storage,
  engine, editor and conversation checks before that failure passed.
