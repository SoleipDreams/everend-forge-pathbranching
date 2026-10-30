import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConditionReference, mergeConditionReferenceCreation } from '../lib/conditionReferenceCreation.js';
import { buildConditionCandidates } from '../lib/conditionAuthoring.js';
import { evaluateConditionDetailed } from '../lib/conditionEvaluation.js';
import { normalizeProject, serializeProject } from '../lib/projectSerialization.js';
import { initialAuthoringState } from '../lib/authoringEntities.js';
import { loadPathBranchingWorkspace, serializeModularStoryFiles, storyPath } from '../lib/pathBranchingWorkspace.js';

function fixture() {
  return { specVersion: '0.1', projectId: 'inline-reference-creation', canonRefs: [], scripts: [], variables: {}, externalFunctions: [], sequences: [], branches: [], events: [],
    localExplorerEntities: [], logicPropertyOverrides: [], entityOverrides: [],
    localExplorerProperties: [{ id: 'type:item', label: 'Item', valueType: 'entity-type' }, { id: 'stats', label: 'Stats', valueType: 'group', appliesToTypes: ['item'], children: [{ id: 'durability', label: 'Durability', valueType: 'number' }] }],
  };
}

test('typed variables are created and selected without altering existing rows or input data', () => {
  const base = fixture(), before = JSON.stringify(base);
  const old = { type: 'value', subject: { kind: 'variable', variableId: '' }, operator: '>=', value: 7 };
  const result = createConditionReference(base, { kind: 'value', name: '  reputation  ', variableType: 'number', initialValue: 9, condition: old });
  assert.equal(JSON.stringify(base), before);
  assert.equal(result.project.logicVariables[0].name, 'reputation');
  assert.equal(result.condition.subject.variableId, result.project.logicVariables[0].id);
  assert.equal(result.condition.operator, '>=');
  assert.equal(result.condition.value, 7);
  assert.equal(evaluateConditionDetailed(result.condition, result.project).status, 'satisfied');
  assert.ok(buildConditionCandidates(result.project, 'value').some(candidate => candidate.id === `variable:${result.project.logicVariables[0].id}`));
  for (const [type, initialValue] of [['boolean', true], ['text', 'known'], ['list', ['seen']], ['canonRef', '']]) {
    const created = createConditionReference(base, { kind: 'value', name: type, variableType: type, initialValue, condition: old });
    assert.equal(created.condition.operator, '==');
    assert.equal(created.condition.value, undefined, 'An incompatible numeric operand does not survive a new variable type.');
  }
});

test('state entities and inventory definitions are immediately eligible without configuring unrelated types', () => {
  const base = fixture();
  const result = createConditionReference(base, { kind: 'state', name: 'Key', entityType: 'item', stateId: 'owned', addInventoryCopy: true });
  assert.ok(buildConditionCandidates(result.project, 'state').some(candidate => candidate.entityId === result.condition.subject.entityId));
  assert.ok(buildConditionCandidates(result.project, 'instanceQuery').some(candidate => candidate.entityId === result.condition.subject.entityId));
  assert.equal(result.project.entityOverrides[0].inventoryItem, true, 'A requested initial inventory copy opts in as an inventory item.');
  assert.equal(evaluateConditionDetailed(result.condition, result.project, initialAuthoringState(result.project)).status, 'satisfied');
  const duplicate = createConditionReference(result.project, { kind: 'instanceQuery', name: 'Key', entityType: 'item' });
  assert.notEqual(duplicate.condition.entityId, result.condition.subject.entityId);
  assert.ok(buildConditionCandidates(duplicate.project, 'instanceQuery').some(candidate => candidate.entityId === duplicate.condition.entityId));
  assert.equal(duplicate.project.entityInstances.length, 1, 'Creating a definition does not silently grant copies.');
  assert.equal(base.logicPropertyOverrides.length, 0);
  const profileProject = { ...base, activePlayerProfileId: 'player', playerProfiles: [{ id: 'player', name: 'Player', simulation: { entityInstances: [] } }] };
  const profiled = createConditionReference(profileProject, { kind: 'state', name: 'Coin', entityType: 'item', addInventoryCopy: true });
  assert.equal(evaluateConditionDetailed(profiled.condition, profiled.project, initialAuthoringState(profiled.project)).status, 'satisfied');
  const discovered = createConditionReference(base, { kind: 'state', name: 'Map', entityType: 'item', stateId: 'discovered', addInventoryCopy: true });
  assert.equal(discovered.project.entityOverrides[0].grantable, undefined, 'Other states leave inherited ownership unchanged.');
  assert.equal(discovered.project.entityInstances?.length ?? 0, 0, 'A hidden inventory checkbox does not grant copies after switching state.');
  assert.ok(buildConditionCandidates(discovered.project, 'state').some(candidate => candidate.entityId === discovered.condition.subject.entityId));
});

test('new property entities initialize nested attributes and enable only the created entity', () => {
  const base = fixture();
  const result = createConditionReference(base, { kind: 'property', name: 'Sword', entityType: 'item', propertyId: 'durability', initialValue: 8,
    condition: { type: 'property', subject: { kind: 'entity', entityId: '' }, propertyId: '', operator: '>=', value: 5 } });
  assert.deepEqual(result.project.localExplorerEntities[0].properties, { stats: { durability: 8 } });
  assert.equal(result.project.logicPropertyOverrides.length, 0);
  assert.equal(evaluateConditionDetailed(result.condition, result.project).status, 'satisfied');
  assert.ok(buildConditionCandidates(result.project, 'property').some(candidate => candidate.entityId === result.condition.subject.entityId));
  const created = createConditionReference(base, { kind: 'property', name: 'Bow', entityType: 'item', newProperty: { name: 'Range', valueType: 'number' }, initialValue: 12 });
  assert.equal(created.condition.propertyId, created.project.localExplorerProperties.at(-1).id);
  assert.equal(created.project.localExplorerProperties.at(-1).label, 'Range');
  assert.ok(buildConditionCandidates(created.project, 'property').some(candidate => candidate.entityId === created.condition.subject.entityId));
});

test('invalid submissions leave the document unchanged and reject duplicate variables and incompatible attributes', () => {
  const base = fixture(), before = JSON.stringify(base);
  for (const draft of [{ kind: 'value', name: '' }, { kind: 'value', name: 'Count', variableType: 'number', initialValue: 'oops' },
    { kind: 'property', name: 'Sword', entityType: 'item', propertyId: 'missing', initialValue: 2 },
    { kind: 'property', name: 'Hero', entityType: 'character', propertyId: 'durability', initialValue: 2 }]) assert.throws(() => createConditionReference(base, draft));
  const result = createConditionReference(base, { kind: 'value', name: 'Count', variableType: 'number' });
  assert.throws(() => createConditionReference(result.project, { kind: 'value', name: ' count ', variableType: 'number' }), /existe/);
  assert.equal(JSON.stringify(base), before);
});

test('atomic creation merge retains the resource, all condition siblings and unrelated edits through save/reopen', () => {
  const old = { type: 'value', subject: { kind: 'variable', variableId: '' }, operator: '==', value: 3 };
  const base = { ...fixture(), events: [{ id: 'entry', name: 'Entry', type: 'normal', logic: { when: { all: [old, { type: 'external', subject: { kind: 'external', functionId: 'ready' }, operator: 'has' }] } } }] };
  const created = createConditionReference(base, { kind: 'value', name: 'Count', initialValue: 3, condition: old });
  const edited = { ...base, events: [{ ...base.events[0], logic: { when: { all: [created.condition, base.events[0].logic.when.all[1]] } } }] };
  const merged = mergeConditionReferenceCreation(base, created.project, edited);
  assert.equal(merged.logicVariables[0].id, created.condition.subject.variableId);
  assert.deepEqual(merged.events[0].logic.when, edited.events[0].logic.when);
  assert.deepEqual(base.events[0].logic.when.all[0], old);
  const reopened = normalizeProject(JSON.parse(serializeProject(merged)));
  assert.equal(reopened.logicVariables[0].id, created.condition.subject.variableId);
  assert.deepEqual(reopened.events[0].logic.when, edited.events[0].logic.when);
});

test('created variables, local entities, nested attributes and inventory copies survive modular EVPATH reopening', () => {
  const variable = createConditionReference(fixture(), { kind: 'value', name: 'Count', initialValue: 3,
    condition: { type: 'value', subject: { kind: 'variable', variableId: '' }, operator: '==', value: 3 } });
  const key = createConditionReference(variable.project, { kind: 'state', name: 'Key', entityType: 'item', addInventoryCopy: true });
  const sword = createConditionReference(key.project, { kind: 'property', name: 'Sword', entityType: 'item', propertyId: 'durability', initialValue: 8,
    condition: { type: 'property', subject: { kind: 'entity', entityId: '' }, propertyId: '', operator: '>=', value: 5 } });
  const when = { all: [variable.condition, key.condition, sword.condition, { type: 'instanceQuery', entityId: key.condition.subject.entityId, quantifier: 'some' }] };
  const project = normalizeProject({ ...sword.project, storyId: 'created-references', name: 'Created references',
    events: [{ id: 'entry', name: 'Entry', type: 'normal', logic: { when } }], sequences: [{ id: 'main', name: 'Main', eventIds: ['entry'], entryEventId: 'entry' }] });
  const story = { id: project.storyId, name: project.name, path: storyPath(project.storyId) };
  const files = serializeModularStoryFiles(project, story);
  files.push({ relativePath: '.everend/.pathbranching/manifest.json', content: JSON.stringify({ version: '0.2', activeStoryId: story.id, stories: [story] }) });
  const loaded = loadPathBranchingWorkspace(files);
  assert.equal(loaded.saveBlocked, false);
  const reopened = loaded.activeProject;
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.events[0].logic.when)), when);
  assert.equal(reopened.logicVariables[0].id, variable.condition.subject.variableId);
  assert.deepEqual(reopened.localExplorerEntities.find(entity => entity.id === sword.condition.subject.entityId).properties, { stats: { durability: 8 } });
  assert.equal(reopened.entityInstances[0].entityId, key.condition.subject.entityId);
  assert.equal(evaluateConditionDetailed(reopened.events[0].logic.when, reopened, initialAuthoringState(reopened)).status, 'satisfied');
});
