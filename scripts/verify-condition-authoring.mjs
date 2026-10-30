import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const moduleUrl = process.env.CONDITION_AUTHORING_MODULE
  ? pathToFileURL(resolve(process.env.CONDITION_AUTHORING_MODULE)).href
  : new URL('../lib/conditionAuthoring.js', import.meta.url).href;
const { buildConditionCandidates, conditionKindCatalog, normalizeSearch, rankConditionCandidates, readConditionRecents, writeConditionRecent } = await import(moduleUrl);
const {
  conditionEditorTree, editConditionNode, emptyConditionGroup, invertConditionNode,
  moveConditionNode, canMoveConditionNode, moveConditionNodeToGroup, findConditionNode, pendingConditionNode, removeConditionNode, serializeConditionTree,
  isConditionEditorTreeRenderable,
} = await import(new URL('./conditionTreeEditing.js', moduleUrl));

test('malformed structures remain opaque while pending rows and empty groups remain repairable', () => {
  assert.equal(isConditionEditorTreeRenderable({ all: 'invalid' }), false);
  assert.equal(isConditionEditorTreeRenderable({ not: null }), false);
  assert.equal(isConditionEditorTreeRenderable({ all: [], any: [] }), false);
  assert.equal(isConditionEditorTreeRenderable({ type: 'instanceQuery', filters: { all: 'invalid' } }), false);
  assert.equal(isConditionEditorTreeRenderable({ all: [{ type: 'pending' }, { any: [] }] }), true);
});

function fixture() {
  return {
    specVersion: '0.1', projectId: 'condition-authoring', canonRefs: [
      { id: 'key', kind: 'item', label: 'Llave', properties: {} },
      { id: 'near-key', kind: 'item', label: 'Llave vecina', properties: {} },
      { id: 'far-key', kind: 'item', label: 'Llave lejana', properties: {} },
    ],
    sequences: [{ id: 'main', name: 'Principal', entryEventId: 'a', eventIds: ['a', 'b'], characterRefs: ['key'] }, { id: 'other', name: 'Otra', entryEventId: 'c', eventIds: ['c'] }],
    branches: [{ id: 'branch-a', title: 'Bosque', eventIds: ['a'] }, { id: 'branch-c', title: 'Pueblo', eventIds: ['c'] }],
    events: [
      { id: 'a', name: 'Puerta', type: 'normal', branchRef: 'branch-a', decisions: [{ id: 'decision', name: 'Decisiones 1', type: 'dialogue', outcomes: [{ id: 'choice', name: 'Opción 1', visibleText: 'Ir al bosque', logic: { when: { type: 'value', subject: { kind: 'variable', variableId: 'strength' }, operator: '>=', value: 3 }, then: [{ type: 'external', subject: { kind: 'external', functionId: 'ready' }, operation: 'call' }] } }] }],
        transitions: [{ id: 'next', from: 'outcome:a:decision:choice', to: 'b' }],
        interactionDefinitions: [{ id: 'roll', name: 'Examinar la puerta', mechanic: { kind: 'dice', count: 1, sides: 20, modifier: 0 }, results: [{ id: 'success', name: 'Éxito' }] }],
        interactionUses: [{ id: 'use-local', definitionId: 'roll', ownerNodeId: 'outcome:a:decision:choice', moment: 'before' }],
      },
      { id: 'b', name: 'Bosque', type: 'normal', canonRefs: ['near-key'], logic: { when: { type: 'value', subject: { kind: 'variable', variableId: 'near-value' }, operator: '==', value: true } } },
      { id: 'c', name: 'Pueblo', type: 'normal', decisions: [{ id: 'other-decision', name: 'Decisiones 2', type: 'dialogue', outcomes: [{ id: 'other-choice', name: 'Quedarse' }] }] },
    ],
    scripts: [], externalFunctions: [{ name: 'ready', kind: 'condition' }, { name: 'transition-check', kind: 'transition' }, { name: 'give-item', kind: 'consequence' }], variables: {},
    logicVariables: [{ id: 'strength', name: 'Fuerza', type: 'number', value: 0, groupId: 'default' }, { id: 'near-value', name: 'Visitó bosque', type: 'boolean', value: false, groupId: 'default' }, { id: 'far-value', name: 'Lejana', type: 'text', value: '', groupId: 'default' }],
    localExplorerEntities: [{ id: 'relic', name: 'Reliquia', type: 'item', properties: { durability: 4 } }],
    localExplorerProperties: [{ id: 'durability', label: 'Durabilidad', valueType: 'number' }],
    logicTypeOverrides: [{ source: 'canon', typeId: 'item', runtimeRoles: ['owned'], inventoryItem: true }],
    logicPropertyOverrides: [{ source: 'local', propertyId: 'durability', conditionReadable: true }],
    dataClasses: [{ id: 'stats', name: 'Estadísticas', fields: [{ name: 'score', label: 'Puntuación', type: 'number' }] }],
    projectDataObjects: [
      { id: 'global', classId: 'stats', name: 'Global', fields: {}, scope: { global: true } },
      { id: 'sequence', classId: 'stats', name: 'Secuencia', fields: {}, scope: { sequenceId: 'main' } },
      { id: 'event', classId: 'stats', name: 'Evento', fields: {}, scope: { eventId: 'a' } },
      { id: 'branch', classId: 'stats', name: 'Rama', fields: {}, scope: { branchId: 'branch-a' } },
      { id: 'outside', classId: 'stats', name: 'Fuera', fields: {}, scope: { eventId: 'c' } },
      { id: 'empty-class', classId: 'missing', name: 'Sin campos', fields: {} },
    ],
    entityInstances: [{ id: 'copy-key', entityId: 'key', name: 'Llave de Ridina', properties: {} }],
  };
}

const context = { eventId: 'a', nodeId: 'outcome:a:decision:choice' };

test('catalog exposes only the six generic condition kinds and localized descriptions', () => {
  const es = conditionKindCatalog('es'), en = conditionKindCatalog('en');
  assert.deepEqual(es.map(item => item.id), ['state', 'property', 'value', 'visited', 'instanceQuery', 'external']);
  assert.equal(es.length, en.length);
  assert.equal(es.find(item => item.id === 'external').icon, 'CodeXml');
  assert.ok(es.every(item => item.label && item.description && item.icon));
  es[0].label = 'Mutated';
  assert.equal(conditionKindCatalog('es')[0].label, 'Estado de entidad');
  assert.equal(conditionKindCatalog('en')[0].label, 'Entity state');
  assert.ok(!conditionKindCatalog('es').some(item => item.id === 'interactionResult'));
  assert.ok(!conditionKindCatalog('en').some(item => item.id === 'interactionResult'));
});

test('current option, its enclosing sequence, and direct neighbors provide real context', () => {
  const project = fixture(), before = JSON.stringify(project);
  const variables = buildConditionCandidates(project, 'value', { context });
  assert.equal(variables.find(item => item.id === 'variable:strength').group, 'context');
  assert.equal(variables.find(item => item.id === 'variable:near-value').group, 'nearby');
  assert.equal(variables.find(item => item.id === 'variable:far-value').group, 'all');
  const entities = buildConditionCandidates(project, 'state', { context });
  assert.equal(entities.find(item => item.id === 'entity:key').group, 'context');
  assert.equal(entities.find(item => item.id === 'entity:near-key').group, 'nearby');
  assert.equal(entities.find(item => item.id === 'entity:far-key').group, 'all');
  assert.equal(JSON.stringify(project), before, 'Candidate building never changes the document.');
});

test('capability and scope filters do not expose incompatible subjects', () => {
  const project = fixture();
  const properties = buildConditionCandidates(project, 'property', { context });
  assert.ok(properties.some(item => item.id === 'entity:relic'));
  assert.ok(!properties.some(item => item.id === 'entity:key'));
  assert.ok(!properties.some(item => item.id === 'variable:strength'));
  assert.deepEqual(properties.filter(item => item.subject.kind === 'dataObject').map(item => item.subject.objectId).sort(), ['branch', 'event', 'global', 'sequence']);
  assert.ok(!properties.some(item => item.id === 'data:empty-class'), 'Property checks require readable class fields.');
  const globalOnly = buildConditionCandidates(project, 'property').filter(item => item.subject.kind === 'dataObject');
  assert.deepEqual(globalOnly.map(item => item.subject.objectId).sort(), ['global']);
  const external = buildConditionCandidates(project, 'external', { context });
  assert.deepEqual(external.map(item => item.subject.functionId).sort(), ['ready', 'transition-check']);
  assert.equal(external.find(item => item.subject.functionId === 'ready').group, 'context');
});

test('story state checks name concrete entities and copies independently of the action roles', () => {
  const project = fixture();
  project.playerSimulation = { context: { actor: { kind: 'entity', entityId: 'key' }, self: { kind: 'instance', instanceId: 'copy-key' }, target: { kind: 'entity', entityId: 'near-key' } } };
  const before = JSON.stringify(project);
  const candidates = buildConditionCandidates(project, 'state', { context });
  assert.deepEqual(candidates.map(item => item.id).sort(), ['entity:key', 'entity:near-key', 'entity:far-key', 'instance:copy-key'].sort());
  assert.equal(JSON.stringify(project), before, 'Filtering the authoring selector preserves saved actors and conditions.');
});

test('story property checks exclude action roles while preserving concrete subjects and saved conditions', () => {
  const project = fixture();
  project.playerSimulation = { context: { actor: { kind: 'entity', entityId: 'relic' }, self: { kind: 'entity', entityId: 'relic' }, target: { kind: 'entity', entityId: 'relic' } } };
  project.events[0].availability = { type: 'property', subject: { kind: 'context', role: 'actor' }, propertyId: 'durability', operator: '>=', value: 3 };
  const before = JSON.stringify(project);
  const candidates = buildConditionCandidates(project, 'property', { context });
  assert.ok(candidates.some(item => item.id === 'entity:relic'));
  assert.ok(candidates.some(item => item.subject.kind === 'dataObject'));
  assert.ok(candidates.every(item => item.subject.kind !== 'context'));
  assert.equal(JSON.stringify(project), before, 'The selector does not rewrite saved context references.');
});

test('data-reference values retain scoped objects even when they have no class fields', () => {
  const project = fixture();
  const objects = options => buildConditionCandidates(project, 'state', { ...options, includeDataObjects: true }).filter(item => item.subject.kind === 'dataObject').map(item => item.subject.objectId).sort();
  assert.deepEqual(objects({ context }), ['branch', 'empty-class', 'event', 'global', 'sequence']);
  assert.deepEqual(objects({}), ['empty-class', 'global']);
});

test('node or route IDs infer their actual event, while stale explicit event IDs do not select the first event', () => {
  const project = fixture();
  const option = buildConditionCandidates(project, 'value', { context: { nodeId: 'choice' } });
  assert.equal(option.find(item => item.id === 'variable:strength').group, 'context');
  const route = buildConditionCandidates(project, 'value', { context: { nodeId: 'next' } });
  assert.equal(route.find(item => item.id === 'variable:strength').group, 'nearby');
  const stale = buildConditionCandidates(project, 'value', { context: { eventId: 'deleted', nodeId: 'choice' } });
  assert.ok(stale.every(item => item.group === 'all'));
});

test('branch-node context includes objects scoped to that branch without borrowing its first event', () => {
  const candidates = buildConditionCandidates(fixture(), 'property', { context: { nodeId: 'branch-a' } });
  const dataIds = candidates.filter(item => item.subject.kind === 'dataObject').map(item => item.subject.objectId);
  assert.ok(dataIds.includes('branch'));
  assert.ok(dataIds.includes('sequence'));
  assert.ok(!dataIds.includes('event'));
  assert.ok(!dataIds.includes('outside'));
});

test('copy filters offer only Self and prohibit recursive copy queries', () => {
  const project = fixture();
  for (const kind of ['state', 'property']) {
    assert.deepEqual(buildConditionCandidates(project, kind, { context, copyFilter: true }).map(item => item.id), ['context:self']);
  }
  for (const kind of ['value', 'external', 'visited', 'instanceQuery']) assert.deepEqual(buildConditionCandidates(project, kind, { copyFilter: true }), []);
});

test('inventory copy references include only ownable types enabled as inventory items', () => {
  const project = fixture();
  project.canonRefs.push({ id: 'coin', kind: 'currency', label: 'Moneda', properties: {} });
  project.logicTypeOverrides.push({ source: 'canon', typeId: 'currency', grantable: true, runtimeRoles: ['owned'] });
  const candidates = buildConditionCandidates(project, 'instanceQuery', { context });
  assert.deepEqual(candidates.map(item => item.entityId).sort(), ['far-key', 'key', 'near-key']);
  assert.ok(!candidates.some(item => item.entityId === 'coin'), 'Ownable alone does not make a type an inventory item.');
  assert.ok(!candidates.some(item => item.entityId === 'relic'), 'An entity without the ownable parent capability cannot enter inventory.');
});

test('progress includes every model target with stable IDs and meaningful paths', () => {
  const candidates = buildConditionCandidates(fixture(), 'visited', { context });
  assert.deepEqual([...new Set(candidates.map(item => item.subject.targetType))].sort(), ['branch', 'decision', 'event', 'outcome', 'sequence']);
  const currentEvent = candidates.find(item => item.id === 'progress:event:a');
  assert.equal(currentEvent.label, 'Este evento · Puerta');
  assert.equal(currentEvent.detail, 'Evento actual');
  assert.equal(currentEvent.group, 'context');
  assert.equal(candidates[0].id, currentEvent.id, 'The current event appears first in progress references.');
  assert.equal(currentEvent.subject.targetId, 'a', 'The persisted event reference remains its stable ID.');
  const option = candidates.find(item => item.id === 'progress:outcome:choice');
  assert.equal(option.label, 'Ir al bosque');
  assert.match(option.detail, /Puerta.*Decisiones 1.*Opción/);
  assert.equal(option.group, 'context');
  assert.equal(candidates.length, new Set(candidates.map(item => item.id)).size);
  const english = buildConditionCandidates(fixture(), 'visited', { context, locale: 'en' }).find(item => item.id === currentEvent.id);
  assert.equal(english.label, 'This event · Puerta');
  assert.equal(english.detail, 'Current event');
});

test('search handles accents, paths, IDs, token order, and ranks exact names first', () => {
  assert.equal(normalizeSearch('  ÁRBOL   recién  '), 'arbol recien');
  const candidates = [
    { id: 'far', label: 'Árbol', detail: 'Pueblo', group: 'all' },
    { id: 'near', label: 'Árbol antiguo', detail: 'Bosque', group: 'context' },
    { id: 'path:door', label: 'Llave', detail: 'Capítulo 2 › Puerta antigua', group: 'nearby' },
  ];
  assert.deepEqual(rankConditionCandidates(candidates, 'arbol').map(item => item.id), ['far', 'near']);
  assert.deepEqual(rankConditionCandidates(candidates, 'antigua capitulo').map(item => item.id), ['path:door']);
  assert.deepEqual(rankConditionCandidates(candidates, 'path:door').map(item => item.id), ['path:door']);
  assert.deepEqual(rankConditionCandidates(candidates, 'missing'), []);
  assert.deepEqual(rankConditionCandidates(candidates).map(item => item.id), ['near', 'path:door', 'far']);
  assert.equal(rankConditionCandidates([...candidates, candidates[0]]).length, 3);
  assert.deepEqual(rankConditionCandidates(candidates.map(item => ({ ...item, group: 'all' })), '', ['path:door']).map(item => item.id), ['path:door', 'far', 'near']);
});

test('recents isolate project and category, cap at 12 and work without browser storage', () => {
  const projectId = 'memory-recents';
  for (let index = 0; index < 15; index++) writeConditionRecent(projectId, 'state', `entity:${index}`);
  assert.equal(readConditionRecents(projectId, 'state').length, 12);
  assert.equal(readConditionRecents(projectId, 'state')[0], 'entity:14');
  writeConditionRecent(projectId, 'state', 'entity:4');
  const recent = readConditionRecents(projectId, 'state');
  assert.equal(recent[0], 'entity:4');
  assert.equal(recent.filter(id => id === 'entity:4').length, 1);
  assert.deepEqual(readConditionRecents(projectId, 'property'), []);
  assert.deepEqual(readConditionRecents('other-project', 'state'), []);
  recent.push('should-not-mutate');
  assert.ok(!readConditionRecents(projectId, 'state').includes('should-not-mutate'));
});

test('persisted recents reject malformed values and survive denied storage writes', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } });
  try {
    writeConditionRecent('stored', 'variable', 'variable:first');
    assert.equal(storage.size, 1);
    const [key, value] = [...storage.entries()][0];
    assert.equal(key, 'pathbranching:condition-recents:v1:["stored","variable"]');
    assert.deepEqual(JSON.parse(value), ['variable:first']);
    storage.set('pathbranching:condition-recents:v1:["corrupt","state"]', '{broken');
    assert.deepEqual(readConditionRecents('corrupt', 'state'), []);
    storage.set('pathbranching:condition-recents:v1:["validated","state"]', '[null,"",2,"entity:a","entity:a"]');
    assert.deepEqual(readConditionRecents('validated', 'state'), ['entity:a']);
    globalThis.localStorage.setItem = () => { throw Error('Denied'); };
    writeConditionRecent('stored', 'variable', 'variable:new');
    assert.deepEqual(readConditionRecents('stored', 'variable'), ['variable:new', 'variable:first']);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

const firstCondition = { type: 'value', subject: { kind: 'variable', variableId: 'strength' }, operator: '>=', value: 3 };
const secondCondition = { type: 'visited', subject: { kind: 'progress', targetType: 'event', targetId: 'b' }, operator: 'has' };

test('tree edits and sibling moves preserve editor identities and authored group labels', () => {
  const root = conditionEditorTree({ all: [firstCondition, { any: [secondCondition], label: 'Otra vía' }], label: 'Requisitos' });
  const leafId = root.children[0].id, groupId = root.children[1].id, nestedLeafId = root.children[1].children[0].id;
  const moved = moveConditionNode(root, groupId, -1);
  assert.equal(moved.id, root.id);
  assert.deepEqual(moved.children.map(item => item.id), [groupId, leafId]);
  assert.equal(moved.children[0].children[0].id, nestedLeafId);
  const edited = editConditionNode(moved, groupId, node => ({ ...node, mode: 'all' }));
  assert.equal(edited.children[0].id, groupId);
  assert.equal(edited.children[0].label, 'Otra vía');
  assert.deepEqual(serializeConditionTree(edited), { all: [{ all: [secondCondition], label: 'Otra vía' }, firstCondition], label: 'Requisitos' });
  assert.deepEqual(root.children.map(item => item.id), [leafId, groupId], 'Moves do not mutate the original tree.');
});

test('nested negation and its labels round-trip without logical rewrites or editor fields', () => {
  const input = { not: { not: { any: [firstCondition, secondCondition], label: 'Cualquiera' }, label: 'Interior' }, label: 'Exterior' };
  const root = conditionEditorTree(input);
  assert.deepEqual(serializeConditionTree(root), input);
  const inverted = invertConditionNode(root);
  assert.equal(inverted.id, root.id);
  assert.equal(inverted.notLabels.length % 2, 1);
  assert.deepEqual(inverted.notLabels.slice(1), ['Exterior', 'Interior']);
  assert.deepEqual(serializeConditionTree(invertConditionNode(inverted)), input);
  const serialized = JSON.stringify(serializeConditionTree(root));
  for (const field of ['condition-editor-', 'notLabels', 'autoOpen', 'children', '"kind":"leaf"', '"kind":"group"']) assert.ok(!serialized.includes(field));
  const walk = node => [node.id, ...(node.kind === 'group' ? node.children.flatMap(walk) : [])];
  const ids = walk(root);
  assert.equal(ids.length, new Set(ids).size);
});

test('empty root serializes as no conditions while an empty child group stays an explicit draft', () => {
  const root = conditionEditorTree({ all: [{ any: [firstCondition], label: 'Opcional' }], label: 'Raíz' });
  const childId = root.children[0].id, leafId = root.children[0].children[0].id;
  const emptyChild = removeConditionNode(root, leafId);
  assert.deepEqual(serializeConditionTree(emptyChild), { all: [{ any: [], label: 'Opcional' }], label: 'Raíz' });
  assert.equal(serializeConditionTree(removeConditionNode(emptyChild, childId)), undefined);
  assert.equal(serializeConditionTree(emptyConditionGroup()), undefined);
  const pending = pendingConditionNode();
  const draft = { ...emptyConditionGroup(), children: [pending] };
  assert.deepEqual(serializeConditionTree(draft), { all: [{ type: 'pending' }] });
  assert.ok(!JSON.stringify(serializeConditionTree(draft)).includes(pending.id));
});

test('cross-group moves preserve identities, NOT labels and pending group drafts without mutating the undo snapshot', () => {
  const input = { all: [{ not: firstCondition, label: 'Excepto' }, { any: [secondCondition], label: 'Alternativas' }] };
  const root = conditionEditorTree(input), source = root.children[0], destination = root.children[1];
  const moved = moveConditionNodeToGroup(root, source.id, destination.id, 0);
  assert.equal(moved.id, root.id);
  assert.equal(findConditionNode(moved, source.id), source);
  assert.deepEqual(findConditionNode(moved, source.id).notLabels, ['Excepto']);
  assert.deepEqual(moved.children[0].children.map(node => node.id), [source.id, destination.children[0].id]);
  assert.deepEqual(serializeConditionTree(root), input, 'The original tree remains a complete undo snapshot.');
  const returned = moveConditionNodeToGroup(moved, source.id, moved.id, 0);
  assert.deepEqual(serializeConditionTree(returned), input);
  const empty = moveConditionNodeToGroup(returned, destination.children[0].id, returned.id);
  assert.deepEqual(findConditionNode(empty, destination.id).children, [], 'An emptied child remains a repairable group.');
  const saved = JSON.stringify(serializeConditionTree(empty));
  assert.ok(!saved.includes('condition-editor-'));
  assert.deepEqual(serializeConditionTree(conditionEditorTree(JSON.parse(saved))), JSON.parse(saved));
});

test('insertion indices are stable for sibling moves; invalid destinations, cycles and excess depth are rejected', () => {
  const root = conditionEditorTree({ all: [firstCondition, secondCondition, { all: [{ any: [firstCondition] }] }] });
  const [first, second, group] = root.children, descendant = group.children[0];
  const down = moveConditionNodeToGroup(root, first.id, root.id, 2);
  assert.deepEqual(down.children.map(node => node.id), [second.id, first.id, group.id]);
  assert.equal(moveConditionNodeToGroup(root, first.id, root.id, 1), root, 'Dropping directly after itself is a no-op.');
  for (const [source, parent] of [[root.id, group.id], [group.id, group.id], [group.id, descendant.id], [first.id, second.id], [first.id, 'foreign-editor-group']]) {
    assert.equal(canMoveConditionNode(root, source, parent), false);
    assert.equal(moveConditionNodeToGroup(root, source, parent), root);
  }
  let deep = emptyConditionGroup();
  const deepest = deep.id;
  for (let index = 0; index < 63; index++) deep = { ...emptyConditionGroup(), children: [deep] };
  const movingGroup = { ...emptyConditionGroup(), children: [pendingConditionNode()] };
  deep = { ...deep, children: [...deep.children, movingGroup] };
  assert.equal(canMoveConditionNode(deep, movingGroup.id, deepest), false);
});
