import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalPropertyDescriptors, characterPropertyPermissions, propertyReadPermission, resolveCharacterProperty, updatePropertyCapability } from '../lib/characterStats.js';
import { logicFieldOptions } from '../lib/logicCapabilities.js';
import { buildConditionCandidates } from '../lib/conditionAuthoring.js';
import { evaluateConditionDetailed } from '../lib/conditionEvaluation.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';
import { serializeProject } from '../lib/projectPersistence.js';
import { loadPathBranchingWorkspace, serializeModularStoryFiles, storyPath } from '../lib/pathBranchingWorkspace.js';

function fixture() {
  return {
    specVersion: '0.1', projectId: 'property-inheritance', canonRefs: [
      { id: 'hero', label: 'Hero', kind: 'character', frontmatter: { stats: { strength: 8, mind: { wit: 4 } } } },
      { id: 'sword', label: 'Sword', kind: 'item', frontmatter: { durability: 9 } },
    ], scripts: [], externalFunctions: [], variables: {}, sequences: [], branches: [], events: [],
    canonPropertyDescriptors: canonicalPropertyDescriptors({ customFields: { definitions: [
      { id: 'stats', label: 'Attributes', type: 'group', appliesTo: ['character'], children: [
        { id: 'strength', label: 'Strength', type: 'number' },
        { id: 'mind', label: 'Mind', type: 'group', children: [{ id: 'wit', label: 'Wit', type: 'number' }] },
      ] }, { id: 'durability', label: 'Durability', type: 'number', appliesTo: ['item'] },
    ] } }),
    localExplorerProperties: [{ id: 'local-stats', label: 'Local attributes', valueType: 'group', appliesToTypes: ['character'], children: [
      { id: 'local-strength', label: 'Local strength', valueType: 'number', appliesToTypes: [] },
    ] }],
    localExplorerEntities: [{ id: 'local-hero', name: 'Local hero', type: 'character', properties: { 'local-stats': { 'local-strength': 6 } } }],
    entityInstances: [{ id: 'hero-copy', entityId: 'hero', properties: { strength: 11 } }],
    logicPropertyOverrides: [],
  };
}
const fields = (project, entityId) => logicFieldOptions(project, { kind: 'entity', entityId }, 'condition').filter(field => field.kind === 'property').map(field => field.key).sort();
const set = (project, id, value, source = 'canon') => updatePropertyCapability(project, source, id, { conditionReadable: value });
const condition = { type: 'property', subject: { kind: 'entity', entityId: 'hero' }, propertyId: 'strength', operator: '>=', value: 7 };

test('type permission exposes all applicable attributes without copying flags or leaking across types/sources', () => {
  const initial = fixture(), before = JSON.stringify(initial), project = set(initial, 'type:character', true);
  assert.deepEqual(fields(project, 'hero'), ['strength', 'wit']);
  assert.deepEqual(fields(project, 'sword'), []);
  assert.deepEqual(fields(project, 'local-hero'), []);
  assert.deepEqual(project.logicPropertyOverrides.map(item => item.propertyId), ['type:character']);
  const candidates = buildConditionCandidates(project, 'property');
  assert.ok(candidates.some(item => item.id === 'entity:hero'));
  assert.ok(candidates.some(item => item.id === 'instance:hero-copy'));
  assert.ok(!candidates.some(item => item.id === 'entity:sword'));
  assert.equal(evaluateConditionDetailed(condition, project).status, 'satisfied');
  assert.deepEqual(characterPropertyPermissions(project, 'hero', 'strength'), { readable: true, writable: false });
  assert.equal(JSON.stringify(initial), before);
});

test('nearest group and explicit leaf overrides win in both authoring and evaluation; reset follows parent changes', () => {
  let project = set(set(fixture(), 'type:character', true), 'stats', false);
  assert.deepEqual(fields(project, 'hero'), []);
  assert.equal(evaluateConditionDetailed(condition, project).status, 'invalid');
  project = set(project, 'mind', true);
  assert.deepEqual(fields(project, 'hero'), ['wit']);
  project = set(project, 'strength', true);
  assert.deepEqual(fields(project, 'hero'), ['strength', 'wit']);
  project = set(project, 'stats', true);
  project = set(project, 'strength', false);
  assert.deepEqual(fields(project, 'hero'), ['wit']);
  project = set(project, 'strength', undefined);
  assert.deepEqual(fields(project, 'hero'), ['strength', 'wit']);
  assert.deepEqual(propertyReadPermission(project, 'canon', 'strength').inheritedFrom, { propertyId: 'stats', label: 'Attributes' });
  project = set(project, 'stats', false);
  assert.deepEqual(fields(project, 'hero'), ['wit']);
  assert.equal(evaluateConditionDetailed(condition, project).status, 'invalid');
});

test('entity exceptions keep precedence; concrete copies use the same inherited permission', () => {
  const project = set(fixture(), 'type:character', true);
  assert.equal(evaluateConditionDetailed({ ...condition, subject: { kind: 'instance', instanceId: 'hero-copy' } }, project).actual, 11);
  const blocked = { ...project, entityOverrides: [{ entityId: 'hero', properties: { strength: { conditionReadable: false } } }] };
  assert.deepEqual(fields(blocked, 'hero'), ['wit']);
  assert.equal(evaluateConditionDetailed(condition, blocked).status, 'invalid');
  assert.equal(evaluateConditionDetailed({ ...condition, subject: { kind: 'instance', instanceId: 'hero-copy' } }, blocked).status, 'invalid');
  const allowed = { ...set(project, 'type:character', false), entityOverrides: [{ entityId: 'hero', properties: { strength: { conditionReadable: true } } }] };
  assert.deepEqual(fields(allowed, 'hero'), ['strength']);
});

test('local nested properties inherit groups and type defaults including unconstrained child scopes', () => {
  let project = set(fixture(), 'type:character', true, 'local');
  assert.deepEqual(fields(project, 'local-hero'), ['local-strength']);
  assert.equal(resolveCharacterProperty(project, {}, { kind: 'entity', entityId: 'local-hero' }, 'local-strength', { purpose: 'condition' }).value, 6);
  project = set(project, 'local-stats', false, 'local');
  assert.deepEqual(fields(project, 'local-hero'), []);
  project = set(project, 'local-strength', true, 'local');
  assert.deepEqual(fields(project, 'local-hero'), ['local-strength']);
});

test('save/reopen and enhanced export retain live inheritance and explicit false without legacy auto-enabling', () => {
  let project = set(set(fixture(), 'type:character', true), 'strength', false);
  project.events = [{ id: 'entry', name: 'Entry', type: 'normal', logic: { when: condition } }];
  project.sequences = [{ id: 'main', name: 'Main', eventIds: ['entry'], entryEventId: 'entry' }];
  project = set(project, 'strength', undefined);
  for (const reopened of [normalizeProject(JSON.parse(serializeProject(project))), normalizeProject(JSON.parse(JSON.stringify(project)))]) {
    assert.deepEqual(fields(reopened, 'hero'), ['strength', 'wit']);
    assert.equal(reopened.logicPropertyOverrides.find(item => item.propertyId === 'strength').conditionReadable, undefined);
    assert.deepEqual(fields(set(reopened, 'type:character', false), 'hero'), []);
    const runtime = exportRuntimePackage(reopened).pathBranching;
    assert.deepEqual(runtime.logicPropertyOverrides, reopened.logicPropertyOverrides);
    assert.deepEqual(fields({ ...reopened, ...runtime }, 'hero'), ['strength', 'wit']);
  }
  project = set(project, 'type:character', undefined);
  const reopened = normalizeProject(JSON.parse(serializeProject(project)));
  assert.deepEqual(fields(reopened, 'hero'), []);
  assert.equal(evaluateConditionDetailed(condition, reopened).status, 'invalid');
  assert.equal(reopened.logicPropertyOverrides.find(item => item.propertyId === 'strength').conditionReadable, undefined);
  const disabled = normalizeProject(set(project, 'stats', false));
  assert.deepEqual(fields(disabled, 'hero'), []);
  assert.equal(disabled.logicPropertyOverrides.find(item => item.propertyId === 'strength').conditionReadable, undefined);
});

test('existing leaf flags retain their meaning and schema without inheritance still supports legacy evaluation', () => {
  const project = set(set(fixture(), 'type:character', false), 'strength', true);
  assert.deepEqual(fields(project, 'hero'), ['strength']);
  assert.equal(evaluateConditionDetailed(condition, project).status, 'satisfied');
  assert.equal(evaluateConditionDetailed(condition, fixture()).status, 'satisfied');
  assert.deepEqual(fields(fixture(), 'hero'), []);
});

test('modular EVPATH and JSON sidecars preserve inherited permission after reopening a universe', () => {
  let project = set(set(fixture(), 'type:character', true), 'strength', undefined);
  project.events = [{ id: 'entry', name: 'Entry', type: 'normal', logic: { when: condition } }];
  project.sequences = [{ id: 'main', name: 'Main', eventIds: ['entry'], entryEventId: 'entry' }];
  const story = { id: 'inheritance', name: 'Inheritance', path: storyPath('inheritance') };
  const files = serializeModularStoryFiles(project, story);
  assert.ok(files.some(file => file.relativePath.endsWith('.evpath')));
  files.push({ relativePath: '.everend/.pathbranching/manifest.json', content: JSON.stringify({ version: '0.2', activeStoryId: story.id, stories: [story] }) },
    { relativePath: '.everend/properties.json', content: JSON.stringify({ entityTypes: { definitions: [{ id: 'character', label: 'Character' }, { id: 'item', label: 'Item' }] }, customFields: { definitions: [
      { id: 'stats', label: 'Attributes', type: 'group', appliesTo: ['character'], children: [
        { id: 'strength', label: 'Strength', type: 'number' },
        { id: 'mind', label: 'Mind', type: 'group', children: [{ id: 'wit', label: 'Wit', type: 'number' }] },
      ] }, { id: 'durability', type: 'number', appliesTo: ['item'] },
    ] } }) });
  const reopened = loadPathBranchingWorkspace(files).activeProject;
  assert.deepEqual(fields(reopened, 'hero'), ['strength', 'wit']);
  assert.equal(evaluateConditionDetailed(condition, reopened).status, 'satisfied');
  assert.equal(reopened.logicPropertyOverrides.find(item => item.propertyId === 'strength').conditionReadable, undefined);
  assert.deepEqual(fields(set(reopened, 'type:character', false), 'hero'), []);
});

test('scope remains enforced even when type or group reading is enabled', () => {
  let project = set(set(fixture(), 'stats', true), 'type:item', true);
  assert.deepEqual(fields(project, 'sword'), ['durability']);
  project.canonPropertyDescriptors.push({ id: 'excluded', label: 'Excluded', valueType: 'number', path: ['stats', 'excluded'], appliesToTypes: [] });
  assert.ok(!fields(project, 'hero').includes('excluded'));
  assert.ok(!fields(project, 'sword').includes('excluded'));
  project = set(project, 'local-stats', true, 'local');
  project.localExplorerEntities.push({ id: 'local-sword', name: 'Local sword', type: 'item' });
  assert.deepEqual(fields(project, 'local-sword'), []);
});
