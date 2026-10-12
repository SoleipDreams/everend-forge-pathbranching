import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/logicAuthoringCatalog.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { contextualRuleScope, appendCatalogAction, appendCatalogRule } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const fixture = () => ({
  projectId: 'story', events: [{ id: 'first', name: 'First', dialogues: [{ id: 'first-dialogue', title: 'First dialogue' }] }, { id: 'other', name: 'Other', dialogues: [{ id: 'other-dialogue', title: 'Other dialogue' }] }],
  narrativeRules: [{ id: 'early', name: 'Early', scope: { kind: 'event', id: 'first' }, trigger: 'enter', priority: -3 }, { id: 'late', name: 'Late', scope: { kind: 'global' }, trigger: 'enter', priority: 10 }],
  narrativeActions: [{ id: 'existing', name: 'Existing', effects: [{ type: 'instanceEffect', operation: 'remove', instanceId: 'old-copy' }] }],
});

test('rule creation follows the valid dialogue context and cannot inherit a stale or unrelated selection', () => {
  const project = fixture();
  assert.deepEqual(contextualRuleScope(project, { currentEventId: 'first', currentDialogueId: 'first-dialogue' }), { kind: 'dialogue', id: 'first-dialogue' });
  assert.deepEqual(contextualRuleScope(project, { currentEventId: 'first', currentDialogueId: 'other-dialogue' }), { kind: 'event', id: 'first' });
  assert.deepEqual(contextualRuleScope(project, { currentEventId: 'missing', currentDialogueId: 'first-dialogue' }), { kind: 'global' });
  assert.deepEqual(contextualRuleScope(project, { currentDialogueId: 'other-dialogue' }), { kind: 'dialogue', id: 'other-dialogue' });
  assert.deepEqual(contextualRuleScope(project, {}), { kind: 'global' });
});

test('new rules run after existing priorities and preserve existing document structures', () => {
  const project = fixture();
  const before = structuredClone(project);
  const result = appendCatalogRule(project, 'new-rule', 'New rule', contextualRuleScope(project, { currentEventId: 'other' }));
  assert.deepEqual(project, before);
  assert.deepEqual(result.narrativeRules.slice(0, -1), project.narrativeRules);
  assert.equal(result.narrativeRules.at(-1).priority, 11);
  assert.deepEqual(result.narrativeRules.at(-1).scope, { kind: 'event', id: 'other' });
  assert.equal(result.narrativeRules.at(-1).trigger, 'enter');
  assert.equal(result.narrativeRules.at(-1).repeat, 'once');
  assert.equal(result.events, project.events);
  assert.equal(result.narrativeActions, project.narrativeActions);
});

test('new actions preserve existing effects and use returning, once-per-run behavior', () => {
  const project = fixture();
  const before = structuredClone(project);
  const result = appendCatalogAction(project, 'new-action', 'New action');
  assert.deepEqual(project, before);
  assert.equal(result.narrativeActions[0], project.narrativeActions[0]);
  assert.deepEqual(result.narrativeActions.at(-1), { id: 'new-action', name: 'New action', navigation: 'call', repeat: 'once' });
  assert.equal(result.narrativeRules, project.narrativeRules);
});
