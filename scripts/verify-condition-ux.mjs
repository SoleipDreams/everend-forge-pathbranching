import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { fixture, strength } from './condition-fixture.mjs';
import { initialAuthoringState, instanceOwnerIssue, ownerKey, resolveOwner } from '../lib/authoringEntities.js';
import { buildStoryCanvasModel } from '../lib/canvas/storyCanvasModel.js';
import { evaluateConditionDetailed, externalConditionKey, resolveConditionValue } from '../lib/conditionEvaluation.js';
import { conditionExpressionAtPath, conditionFieldIssues, conditionRouteResolution, conditionTestControls, conditionTreeSummary, groupedConditionPresentation, narrativeTargetLabel } from '../lib/conditionPresentation.js';
import { resolveFirstValidTransition } from '../lib/logic.js';

const key = {type: 'state', subject: {kind: 'entity', entityId: 'key'}, stateId: 'owned', operator: 'has'};
const visited = {type: 'visited', subject: {kind: 'progress', targetType: 'event', targetId: 'b'}, operator: 'has'};
const tree = {all: [{any: [key, strength]}, {not: visited}]};

// Compile the component's actual pure reducer without importing React or its CSS.
// Assertions below use the independent condition evaluator and owner validation.
const testerSource = ts.createSourceFile('ConditionTester.tsx', readFileSync(new URL('../src/components/ConditionTester.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const reducer = testerSource.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'updateControlState');
assert.ok(reducer, 'ConditionTester must expose its state reducer to this focused regression check.');
const compiledReducer = ts.transpileModule(reducer.getText(testerSource), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const updateControlState = new Function('externalConditionKey', 'ownerKey', 'resolveOwner', `${compiledReducer}\nreturn updateControlState;`)(externalConditionKey, ownerKey, resolveOwner);
const setOwned = (project, state, value, predicate = key) => updateControlState(state, { predicate }, value, project);

test('owned controls change normalized empty inventories and the selected route without modifying the project', () => {
  const project = fixture();
  const before = JSON.stringify(project);
  const initial = initialAuthoringState(project);
  const initialBefore = JSON.stringify(initial);
  assert.deepEqual(initial.entityInstances, []);
  const routes = [{ id: 'has-key', from: 'a', to: 'b', conditions: key }, { id: 'no-key', from: 'a', to: 'c', mode: 'fallback' }];
  assert.equal(conditionRouteResolution(project, routes, initial).selected.id, 'no-key');
  const owned = setOwned(project, initial, true);
  assert.equal(resolveConditionValue(key, project, owned).value, true);
  assert.equal(conditionRouteResolution(project, routes, owned).selected.id, 'has-key');
  assert.equal(owned.entityInstances.length, 1);
  assert.equal(instanceOwnerIssue(project, owned.entityInstances, owned.entityInstances[0]), undefined);
  assert.equal(evaluateConditionDetailed({ type: 'instanceQuery', entityId: 'key', owner: { kind: 'profile', profileId: 'default' }, quantifier: 'count', operator: '==', value: 1 }, project, owned).status, 'satisfied');
  assert.equal(setOwned(project, owned, true), owned, 'Repeated Yes must not create additional copies.');
  const released = setOwned(project, owned, false);
  assert.equal(resolveConditionValue(key, project, released).value, false);
  assert.equal(conditionRouteResolution(project, routes, released).selected.id, 'no-key');
  assert.equal(released.entityInstances[0].id, owned.entityInstances[0].id, 'No releases ownership without destroying the copy.');
  const reclaimed = setOwned(project, released, true);
  assert.equal(reclaimed.entityInstances.length, 1, 'A released copy is reused on the next Yes.');
  assert.equal(reclaimed.entityInstances[0].id, owned.entityInstances[0].id);
  assert.equal(JSON.stringify(initial), initialBefore);
  assert.equal(JSON.stringify(project), before);
});

test('No releases only the current profile and actor copies, preserving their contents and other owners', () => {
  const project = fixture();
  project.localExplorerEntities.push({ id: 'actor', name: 'Actor', type: 'character' }, { id: 'other-actor', name: 'Other actor', type: 'character' });
  project.playerProfiles = [{ id: 'me', name: 'Me', simulation: {} }, { id: 'other', name: 'Other', simulation: {} }];
  const state = { context: { profileId: 'me', actor: { kind: 'entity', entityId: 'actor' } }, entityInstances: [
    { id: 'mine', entityId: 'key', owner: { kind: 'profile', profileId: 'me' }, properties: { wear: 3 } },
    { id: 'actor-key', entityId: 'key', owner: { kind: 'entity', entityId: 'actor' }, states: { discovered: true } },
    { id: 'other-profile', entityId: 'key', owner: { kind: 'profile', profileId: 'other' } },
    { id: 'other-actor-key', entityId: 'key', owner: { kind: 'entity', entityId: 'other-actor' } },
    { id: 'contents', entityId: 'relic', owner: { kind: 'instance', instanceId: 'mine' } },
    { id: 'other-item', entityId: 'relic', owner: { kind: 'profile', profileId: 'me' } },
  ] };
  const before = JSON.stringify(state);
  assert.equal(setOwned(project, state, true), state, 'An actor-owned copy already satisfies ownership.');
  const released = setOwned(project, state, false);
  assert.equal(resolveConditionValue(key, project, released).value, false);
  assert.equal(released.entityInstances.length, state.entityInstances.length);
  assert.deepEqual(released.entityInstances[0], { ...state.entityInstances[0], owner: undefined });
  assert.deepEqual(released.entityInstances[1], { ...state.entityInstances[1], owner: undefined });
  assert.deepEqual(released.entityInstances.slice(2), state.entityInstances.slice(2));
  assert.equal(JSON.stringify(state), before);
});

test('Yes prepares a current-profile copy without taking the copies of another owner', () => {
  const project = fixture();
  project.playerProfiles = [{ id: 'me', name: 'Me', simulation: {} }, { id: 'other', name: 'Other', simulation: {} }];
  const elsewhere = { id: 'elsewhere', entityId: 'key', owner: { kind: 'profile', profileId: 'other' }, properties: { wear: 4 } };
  const state = { context: { profileId: 'me' }, entityInstances: [elsewhere] };
  const owned = setOwned(project, state, true);
  assert.equal(resolveConditionValue(key, project, owned).value, true);
  assert.equal(owned.entityInstances.length, 2);
  assert.equal(owned.entityInstances[0], elsewhere);
  assert.deepEqual(owned.entityInstances[1].owner, { kind: 'profile', profileId: 'me' });
  assert.equal(instanceOwnerIssue(project, owned.entityInstances, owned.entityInstances[1]), undefined);
  const available = { id: 'available', entityId: 'key', properties: { wear: 7 }, states: { discovered: true } };
  const reused = setOwned(project, { ...state, entityInstances: [elsewhere, available] }, true);
  assert.deepEqual(reused.entityInstances[1], { ...available, owner: { kind: 'profile', profileId: 'me' } });
  assert.equal(reused.entityInstances[0], elsewhere);
});

test('owned controls for a concrete contextual copy change its owner and preserve unrelated copies', () => {
  const project = fixture();
  const selfOwned = { ...key, subject: { kind: 'context', role: 'self' } };
  const untouched = { id: 'other', entityId: 'key', owner: { kind: 'profile', profileId: 'default' } };
  const state = { context: { profileId: 'default', self: { kind: 'instance', instanceId: 'selected' } }, entityInstances: [{ id: 'selected', entityId: 'key', properties: { wear: 5 } }, untouched] };
  const owned = setOwned(project, state, true, selfOwned);
  assert.equal(resolveConditionValue(selfOwned, project, owned).value, true);
  assert.equal(instanceOwnerIssue(project, owned.entityInstances, owned.entityInstances[0]), undefined);
  const released = setOwned(project, owned, false, selfOwned);
  assert.equal(resolveConditionValue(selfOwned, project, released).value, false);
  assert.deepEqual(released.entityInstances[0], { ...state.entityInstances[0], owner: undefined });
  assert.equal(released.entityInstances[1], untouched);
});

test('canvas and inspector summaries retain OR/NOT grouping and label abbreviation honestly', () => {
  const project = fixture();
  const full = conditionTreeSummary(project, tree, 'en', 1000);
  assert.match(full.text, /^\(.+ OR .+\) AND NOT \(.+\)$/);
  assert.equal(full.clauses, 3);
  const short = conditionTreeSummary(project, tree, 'en', 10);
  assert.equal(short.abbreviated, true);
  assert.match(short.text, /^AND · 3 clauses · abbreviated$/);
  assert.equal(groupedConditionPresentation(project, tree).length, 1, 'nested expressions must not appear as unrelated leaf chips');
  project.events[0].logic = {when: tree};
  const canvas = buildStoryCanvasModel(project, {scope: {kind: 'sequence', id: 'main'}, canvasLayerMode: 'logic', interfaceLocale: 'es'});
  const summary = canvas.nodes.find(node => node.id === 'a').data.logicSummary;
  assert.equal(summary.whenItems.length, 1);
  assert.match(summary.when, /OR/);
  assert.match(summary.when, /NOT/);
});

test('the tester lists referenced values once, excludes other variables and preserves source data', () => {
  const project = fixture();
  project.logicVariables.push({id: 'unused', name: 'Unrelated', type: 'text', value: '', groupId: 'default'});
  const before = JSON.stringify(project);
  const controls = conditionTestControls(project, [tree, strength], 'en');
  assert.equal(controls.length, 3);
  assert.ok(controls.some(control => control.label.includes('Strength') && control.valueType === 'number'));
  assert.ok(controls.some(control => control.label.includes('Open')));
  assert.ok(!controls.some(control => control.label.includes('Unrelated')));
  assert.equal(JSON.stringify(project), before);
  assert.deepEqual(conditionExpressionAtPath(project, tree, 'conditions.all[1].not[0]'), visited);
});

test('field diagnostics point to the operand or vanished subject rather than a generic editor error', () => {
  const project = fixture();
  assert.deepEqual(conditionFieldIssues(project, {...strength, value: '5'}).map(issue => issue.field), ['value']);
  assert.ok(conditionFieldIssues(project, {...strength, subject: {kind: 'variable', variableId: 'gone'}}).some(issue => issue.field === 'subject'));
  assert.equal(conditionTreeSummary(project, {all: []}).text, 'Invalid structure · original data preserved');
});

test('route presentation distinguishes selected, failed, blocked and skipped without changing resolution', () => {
  const project = fixture();
  project.externalFunctions = [{name: 'unbound', kind: 'condition'}];
  const routes = [
    {id: 'primary', from: 'a', to: 'b', order: 0, conditions: strength},
    {id: 'external', from: 'a', to: 'c', order: 1, conditions: {type: 'external', subject: {kind: 'external', functionId: 'unbound'}, operator: 'has'}},
    {id: 'fallback', from: 'a', to: 'c', mode: 'fallback', order: 2},
  ];
  const blocked = conditionRouteResolution(project, routes, {variables: {strength: 0}});
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.blocked.id, 'external');
  assert.deepEqual(blocked.routes.map(row => row.reached), [true, true, false]);
  assert.equal(resolveFirstValidTransition(routes, project, {variables: {strength: 0}}), undefined);
  const selected = conditionRouteResolution(project, routes, {variables: {strength: 5}});
  assert.equal(selected.status, 'selected');
  assert.equal(selected.selected.id, resolveFirstValidTransition(routes, project, {variables: {strength: 5}}).id);
  assert.deepEqual(selected.routes.map(row => row.reached), [true, false, false]);
  assert.equal(conditionRouteResolution(project, [...routes, {...routes[2], id: 'second-else'}], {}).status, 'duplicateElse');
});

test('route sources and destinations use narrative names including generated option handles', () => {
  const project = fixture();
  project.events[0].decisions = [{id: 'choice', name: 'Action', outcomes: [{id: 'unlock', name: 'Unlock', visibleText: 'Use the key'}]}];
  assert.equal(narrativeTargetLabel(project, 'outcome:a:choice:unlock'), 'Door · Use the key');
  assert.equal(narrativeTargetLabel(project, 'b'), 'Open');
  assert.equal(narrativeTargetLabel(project, 'missing'), 'missing', 'broken references remain visible');
});

test('malformed imported expressions remain visible without crashing the canvas projection', () => {
  const project = fixture();
  project.events[0].logic = {when: {type: 'property', propertyId: 'bad', operator: '=='}};
  const before = JSON.stringify(project);
  const model = buildStoryCanvasModel(project, {scope: {kind: 'sequence', id: 'main'}, canvasLayerMode: 'logic'});
  const summary = model.nodes.find(node => node.id === 'a').data.logicSummary;
  assert.match(summary.when, /original data preserved/);
  assert.ok(summary.warningCount > 0);
  assert.equal(JSON.stringify(project), before);
});
