# Reading attributes in conditions

`Consultar en condiciones` can be configured on an entity-type property, a
property group or a leaf attribute. A leaf follows the nearest explicitly
configured ancestor group, then its concrete entity type. An explicit leaf
setting wins over a group; an individual entity exception wins over both.
Canon and local schemas have independent permissions. Applicability restrictions
continue to determine which entity types can use an attribute.

The inspector and property popover show the effective value and its origin.
Clicking the card creates an explicit true/false exception. `Volver a heredar`
removes that exception, so subsequent changes to the parent take effect.
Parent changes never copy flags into children or erase their exceptions.
Existing explicit permissions retain their behavior. Write permissions remain
independent and do not inherit from this reading capability.

Conditions still compare a selected attribute, such as `Strength >= 5`; enabling
the type makes all its applicable leaf attributes available to the authoring
catalog. It does not compare an entire character object as one value. Groups
and entity-type properties are never offered as scalar comparison fields.

The document stores `conditionReadable` only for explicit values. An explicit
return to inheritance stores `conditionReadableInherited: true` instead. This
marker prevents legacy save/load compatibility from silently re-enabling a
leaf already used by a condition. Unconfigured legacy documents keep their
existing compatibility behavior. JSON, modular EVPATH sidecars and Enhanced
exports preserve the schema paths, parent permissions and exceptions.

Verification: `node scripts/verify-property-inheritance.mjs` after `npm run
build:core`, also included in `verify:core`. It covers nested canon/local groups,
type scope, copy and entity exceptions, live parent changes, legacy migration,
save/reopen and Enhanced export. Desktop verification uses Playwright attached
to the real Tauri WebView; temporary synthetic editor data does not mutate the
open story.
