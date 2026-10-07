import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, strength } from './condition-fixture.mjs';
import { buildStoryCanvasModel } from '../lib/canvas/storyCanvasModel.js';
import { conditionExpressionAtPath, conditionFieldIssues, conditionRouteResolution, conditionTestControls, conditionTreeSummary, groupedConditionPresentation, narrativeTargetLabel } from '../lib/conditionPresentation.js';
import { resolveFirstValidTransition } from '../lib/logic.js';

const key = {type: 'state', subject: {kind: 'entity', entityId: 'key'}, stateId: 'owned', operator: 'has'};
const visited = {type: 'visited', subject: {kind: 'progress', targetType: 'event', targetId: 'b'}, operator: 'has'};
const tree = {all: [{any: [key, strength]}, {not: visited}]};

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
