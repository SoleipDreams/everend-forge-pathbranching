import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCharacterProperty } from '../lib/characterStats.js';
import { evaluateConditionDetailed } from '../lib/conditionEvaluation.js';
import { initialAuthoringState, removeLocalExplorerPropertyValues } from '../lib/authoringEntities.js';
import { applyConsequenceDetailed } from '../lib/logic.js';
import { freezeInteractionRoll } from '../lib/interactions.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { validateProject } from '../lib/validate.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { modularExportDiagnostics } from '../lib/exportCompatibility.js';
import { loadPathBranchingWorkspace, serializeModularStoryFiles, storyPath } from '../lib/pathBranchingWorkspace.js';
import { createStoryItem, itemCatalogEntryFromEntity, itemCatalogFromFiles, itemCatalogPath, parseItemCatalog, saveStoryItemModifiers, serializeItemCatalog, storyItemEntries, updateInitialItemCopy, useCatalogItem, withItemCatalogSchema, itemCatalogSchema } from '../lib/itemCatalog.js';

const hero = { kind: 'entity', entityId: 'hero' }, npc = { kind: 'entity', entityId: 'npc' };
const condition = { type: 'property', subject: hero, propertyId: 'agility', operator: '>=', value: 5 };
const bonus = (amount = 2, activation = 'equipped', id = 'quick') => ({ id, propertyId: 'agility', amount, activation });
const sword = (id = 'sword-1', equipped = true, owner = { kind: 'entity', entityId: 'hero' }) => ({ id, entityId: 'sword', owner, states: { equipped } });
function fixture() {
  return { specVersion: '0.1', projectId: 'item-test', canonRefs: [], scripts: [], variables: {}, externalFunctions: [], events: [], sequences: [], branches: [],
    localExplorerEntities: [{ id: 'hero', type: 'character', name: 'Hero', properties: { stats: { agility: 3 } } }, { id: 'npc', type: 'character', name: 'NPC', properties: { stats: { agility: 4 } } }, { id: 'sword', type: 'item', name: 'Quick sword', properties: {} }],
    localExplorerProperties: [{ id: 'stats', label: 'Stats', valueType: 'group', appliesToTypes: ['character'], children: [{ id: 'agility', label: 'Agility', valueType: 'number' }] }],
    logicTypeOverrides: [{ source: 'local', typeId: 'character', container: true }],
    logicPropertyOverrides: [{ source: 'local', propertyId: 'type:character', conditionReadable: true }, { source: 'local', propertyId: 'agility', actionWritable: true }],
    entityOverrides: [{ entityId: 'sword', grantable: true, inventoryModifiers: [bonus()] }], entityInstances: [sword()],
  };
}
const value = (project, state = {}, subject = hero, options) => resolveCharacterProperty(project, state, subject, 'agility', options);

test('conditions read current values with equipped modifiers, without changing original or mutable properties', () => {
  const project = fixture(), before = JSON.stringify(project);
  assert.equal(value(project).value, 5);
  assert.equal(value(project).unmodifiedValue, 3);
  assert.deepEqual(value(project).modifiers.map(item => [item.name, item.amount]), [['Quick sword', 2]]);
  assert.equal(evaluateConditionDetailed(condition, project, {}).status, 'satisfied');
  assert.equal(value(project, {}, hero, { baseOnly: true }).value, 3);
  assert.equal(value(project, {}, hero, { purpose: 'effect' }).value, 3);
  const state = { entityStates: { hero: { properties: { agility: 7 } } } };
  assert.equal(value(project, state).value, 9);
  assert.equal(value(project, { ...state, entityInstances: [] }).value, 7);
  assert.equal(value(project, { entityInstances: [sword('sword-1', false)] }).value, 3);
  assert.equal(JSON.stringify(project), before);
});

test('carried and equipped rules stack once per copy and follow ownership changes immediately', () => {
  let project = fixture();
  project = saveStoryItemModifiers(project, 'sword', [bonus(2, 'carried'), bonus(-1, 'equipped', 'heavy')]);
  assert.equal(value(project, { entityInstances: [sword('a', false), sword('b', true)] }).value, 6);
  assert.equal(value(project, { entityInstances: [sword('a', true, { kind: 'entity', entityId: 'npc' })] }).value, 3);
  assert.equal(value(project, { entityInstances: [sword('a', true, { kind: 'entity', entityId: 'npc' })] }, npc).value, 5);
  assert.equal(value(project, { entityInstances: [] }).value, 3);
  assert.match(value(project, { entityInstances: [sword(), sword()] }).error, /Duplicate/);
});

test('profile inventories apply to the bound playable character and copy inventories stay isolated', () => {
  const project = { ...fixture(), activePlayerProfileId: 'player', playerProfiles: [{ id: 'player', name: 'Player', playableCharacterRef: 'hero', simulation: {} }] };
  const state = { entityInstances: [sword('a', true, { kind: 'profile', profileId: 'player' })] };
  assert.equal(value(project, state).value, 5);
  assert.equal(value(project, state, npc).value, 4);
  assert.equal(value(project, { ...state, context: { profileId: 'player', actor: npc } }, npc).value, 6);
  const copies = [{ id: 'hero-a', entityId: 'hero' }, { id: 'hero-b', entityId: 'hero' }, sword('blade', true, { kind: 'instance', instanceId: 'hero-a' })];
  assert.equal(value(project, { entityInstances: copies }, { kind: 'instance', instanceId: 'hero-a' }).value, 5);
  assert.equal(value(project, { entityInstances: copies }, { kind: 'instance', instanceId: 'hero-b' }).value, 3);
  assert.equal(value(project, { entityInstances: copies }).value, 3);
});

test('nested inventory follows its container without looping on invalid cycles', () => {
  const project = saveStoryItemModifiers(fixture(), 'sword', [bonus(2, 'carried')]);
  const bag = { id: 'bag', entityId: 'npc', owner: { kind: 'entity', entityId: 'hero' } };
  const blade = sword('blade', false, { kind: 'instance', instanceId: 'bag' });
  assert.equal(value(project, { entityInstances: [bag, blade] }).value, 5);
  assert.equal(value(project, { entityInstances: [{ ...bag, owner: { kind: 'instance', instanceId: 'blade' } }, blade] }).value, 3);
});

test('permanent attribute changes never absorb temporary bonuses and interactions use the same current value', () => {
  const project = fixture(), state = initialAuthoringState(project);
  const changed = applyConsequenceDetailed(project, state, { type: 'property', subject: hero, propertyId: 'agility', operation: 'add', value: 1 });
  assert.equal(changed.status, 'applied');
  assert.equal(changed.state.entityStates.hero.properties.agility, 4);
  assert.equal(value(project, changed.state).value, 6);
  assert.equal(value(project, { ...changed.state, entityInstances: [] }).value, 4);
  const definition = { id: 'check', name: 'Check', mechanic: { kind: 'skillcheck', skill: { kind: 'property', subject: hero, propertyId: 'agility' }, modifier: 0, difficulty: 5 }, results: [] };
  assert.equal(freezeInteractionRoll(project, state, definition).skillValue, 5);
  assert.equal(freezeInteractionRoll(project, { ...state, entityInstances: [] }, definition).skillValue, 3);
});

test('global definitions import local schema into another story and remain independent after reuse', () => {
  const project = fixture(), entry = itemCatalogEntryFromEntity(project, 'sword', 'global-sword');
  const library = parseItemCatalog(serializeItemCatalog({ version: 1, entries: [entry] }));
  const editorProject = withItemCatalogSchema(project, entry.localProperties);
  const edited = { ...entry, modifiers: [bonus(3)], localProperties: itemCatalogSchema(editorProject, [bonus(3)], entry.properties) };
  assert.equal(parseItemCatalog(serializeItemCatalog({ version: 1, entries: [edited] })).entries[0].localProperties.length, 1, 'Editing a global definition in its original story does not duplicate the attribute schema.');
  const other = { ...fixture(), projectId: 'other', localExplorerEntities: [], localExplorerProperties: [], entityOverrides: [], entityInstances: [] };
  const imported = useCatalogItem(other, library.entries[0]);
  assert.equal(imported.project.localExplorerProperties[0].children[0].id, 'agility');
  assert.equal(imported.project.entityOverrides[0].inventoryModifiers[0].amount, 2);
  const usedAgain = useCatalogItem(imported.project, library.entries[0]);
  assert.equal(usedAgain.entityId, imported.entityId);
  assert.equal(usedAgain.project.localExplorerEntities.length, 1);
  library.entries[0].modifiers[0].amount = 99;
  assert.equal(imported.project.entityOverrides[0].inventoryModifiers[0].amount, 2);
  const conflict = { ...other, localExplorerProperties: [{ id: 'stats', label: 'Stats', valueType: 'group', children: [{ id: 'agility', label: 'Agility', valueType: 'text' }] }] };
  assert.throws(() => useCatalogItem(conflict, entry), /otro tipo/);
  assert.equal(conflict.localExplorerEntities.length, 0);
});

test('invalid modifiers and malformed global files are rejected without changing authored data', () => {
  const project = fixture(), before = JSON.stringify(project);
  for (const modifiers of [[bonus(NaN)], [{ ...bonus(), propertyId: 'missing' }], [{ ...bonus(), activation: 'unknown' }], [bonus(), bonus()]]) assert.throws(() => saveStoryItemModifiers(project, 'sword', modifiers));
  const broken = { ...project, entityOverrides: [{ entityId: 'sword', inventoryModifiers: [{ ...bonus(), amount: '2' }] }] };
  assert.equal(evaluateConditionDetailed(condition, broken, {}).status, 'invalid');
  assert.ok(validateProject(broken).some(finding => finding.id === 'sword' && finding.severity === 'error'));
  assert.throws(() => parseItemCatalog('{broken'));
  assert.throws(() => parseItemCatalog(JSON.stringify({ version: 1, entries: [{ ...itemCatalogEntryFromEntity(project, 'sword'), modifiers: [bonus(), bonus()] }] })));
  assert.equal(JSON.stringify(project), before);
});

test('initial copies honor explicit active-profile inventories, equipment changes and removal', () => {
  let project = { ...fixture(), entityInstances: [], activePlayerProfileId: 'player', playerProfiles: [{ id: 'player', name: 'Player', playableCharacterRef: 'hero', simulation: { entityInstances: [] } }] };
  const copy = sword('initial', false, { kind: 'profile', profileId: 'player' });
  project = updateInitialItemCopy(project, copy, copy.id);
  assert.equal(value(project, initialAuthoringState(project)).value, 3);
  project.playerProfiles[0].simulation.entityInstances[0] = { ...project.playerProfiles[0].simulation.entityInstances[0], properties: { wear: 7 }, states: { equipped: false, discovered: true } };
  project = updateInitialItemCopy(project, { ...copy, states: { equipped: true } }, copy.id);
  assert.equal(value(project, initialAuthoringState(project)).value, 5);
  assert.equal(project.playerProfiles[0].simulation.entityInstances[0].properties.wear, 7);
  assert.equal(project.playerProfiles[0].simulation.entityInstances[0].states.discovered, true);
  project = updateInitialItemCopy(project, undefined, copy.id);
  assert.equal(value(project, initialAuthoringState(project)).value, 3);
});

test('modular EVPATH, global catalog and Enhanced export retain activation, ownership and current behavior', () => {
  const project = normalizeProject({ ...fixture(), storyId: 'items', name: 'Items', events: [{ id: 'entry', name: 'Entry', type: 'normal', logic: { when: condition } }], sequences: [{ id: 'main', name: 'Main', eventIds: ['entry'], entryEventId: 'entry' }] });
  const story = { id: 'items', name: 'Items', path: storyPath('items') }, entry = itemCatalogEntryFromEntity(project, 'sword');
  const files = [...serializeModularStoryFiles(project, story), { relativePath: '.everend/.pathbranching/manifest.json', content: JSON.stringify({ version: '0.2', activeStoryId: 'items', stories: [story] }) }, { relativePath: itemCatalogPath, content: serializeItemCatalog({ version: 1, entries: [entry] }) }];
  const loaded = loadPathBranchingWorkspace(files);
  assert.equal(loaded.saveBlocked, false);
  assert.equal(value(loaded.activeProject, initialAuthoringState(loaded.activeProject)).value, 5);
  assert.equal(itemCatalogFromFiles(files).entries[0].modifiers[0].activation, 'equipped');
  const runtime = exportRuntimePackage(project, { profile: 'enhanced' });
  assert.equal(runtime.pathBranching.entityOverrides.find(item => item.entityId === 'sword').inventoryModifiers[0].amount, 2);
  assert.ok(modularExportDiagnostics(project).some(diagnostic => diagnostic.feature === 'inventory-modifiers'));
});

test('catalog story scope recognizes local items and deleting an attribute removes its item bonuses', () => {
  const created = createStoryItem(fixture(), 'Sword');
  assert.notEqual(created.entityId, 'sword');
  assert.ok(storyItemEntries(created.project).some(item => item.id === created.entityId && item.inStory));
  const cleaned = removeLocalExplorerPropertyValues(created.project, 'agility');
  assert.deepEqual(cleaned.entityOverrides.find(item => item.entityId === 'sword').inventoryModifiers, []);
});

test('catalog includes entities only when their ownable type or entity exception enables inventory use', () => {
  const project = fixture();
  project.localExplorerEntities.push({ id: 'coin-purse', name: 'Coin purse', type: 'container-item', properties: {} });
  project.logicTypeOverrides.push({ source: 'local', typeId: 'container-item', grantable: true });
  assert.ok(!storyItemEntries(project).some(item => item.id === 'coin-purse'), 'Ownable alone is not enough.');
  project.entityOverrides.push({ entityId: 'coin-purse', inventoryItem: true });
  assert.ok(storyItemEntries(project).some(item => item.id === 'coin-purse'), 'An individual entity can opt in.');
  project.entityOverrides[0] = { ...project.entityOverrides[0], inventoryItem: false };
  assert.ok(!storyItemEntries(project).some(item => item.id === 'sword'), 'A manual false overrides the item-type default.');
});
