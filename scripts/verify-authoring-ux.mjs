import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateWorkspacePanels, MIN_CANVAS_WIDTH } from '../lib/adaptiveWorkspace.js';
import { diagnosticSelection, findingPresentation } from '../lib/diagnosticPresentation.js';
import { fixture } from './condition-fixture.mjs';

test('expanded panels preserve a usable canvas at each acceptance width without rewriting preferences', () => {
  const ids = ['assets', 'logic', 'outline', 'player', 'export', 'connect'];
  const panels = ids.map(id => ({ id, visible: true, collapsed: false, width: id === 'outline' ? 420 : 282 }));
  const before = JSON.stringify(panels);
  for (const width of [1440, 1280, 1100, 900]) {
    const layout = allocateWorkspacePanels(width, panels, ['outline', ...ids.filter(id => id !== 'outline')]);
    const used = ids.reduce((sum, id) => sum + Number.parseInt(layout.columns(id)), 0);
    assert.ok(width - used >= MIN_CANVAS_WIDTH, `canvas at ${width}px`);
    if (width <= 960) assert.equal(layout.inline.size, 0, 'compact mode uses drawers');
  }
  assert.equal(JSON.stringify(panels), before);
});

test('opening another panel keeps existing inline panels and hidden rails do not consume space', () => {
  const panels = [
    { id: 'outline', visible: true, collapsed: false, width: 282 },
    { id: 'export', visible: true, collapsed: false, width: 282 },
    { id: 'assets', visible: false, collapsed: false, width: 420 },
  ];
  const layout = allocateWorkspacePanels(1000, panels, ['outline', 'export', 'assets']);
  assert.ok(layout.inline.has('outline'));
  assert.equal(layout.inline.has('export'), false);
  assert.equal(layout.columns('assets'), '');
});

test('diagnostics locate authored owners across IDs and export paths without mutating narrative data', () => {
  const project = fixture();
  project.events[0].transitions = [{ id: 'route:a:open', from: 'a', to: 'b' }];
  const before = JSON.stringify(project);
  assert.deepEqual(diagnosticSelection(project, 'a/logic.when'), { type: 'node', id: 'a' });
  assert.deepEqual(diagnosticSelection(project, 'route:a:open.conditions'), { type: 'edge', id: 'route:a:open' });
  assert.deepEqual(diagnosticSelection(project, 'relic.fields.day'), { type: 'explorerEntity', id: 'relic' });
  assert.equal(diagnosticSelection(project, 'removed-entity'), undefined);
  const finding = { code: 'invalid_condition', severity: 'error', id: 'a', message: 'Event "a" has an invalid condition.' };
  const display = findingPresentation(finding, project, 'en');
  assert.match(display.message, /Door/);
  assert.equal(display.message, 'Event "Door" has an invalid condition.');
  assert.equal(display.title, 'Review this condition');
  assert.equal(findingPresentation(finding, project, 'es').title, 'Revisa esta condición');
  assert.equal(JSON.stringify(project), before);
});
