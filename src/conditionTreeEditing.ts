import type { Condition, ConditionExpression, ConditionInput } from './domain.js';
import { isConditionSet } from './logic.js';

/** Stable editor identities never become narrative/export data. */
type Common = { id: string; notLabels: (string | undefined)[] };
export type ConditionEditorNode = Common & (
  | { kind: 'leaf'; condition: Condition; autoOpen?: boolean }
  | { kind: 'group'; mode: 'all' | 'any'; label?: string; children: ConditionEditorNode[] }
);
let identity = 0;
export const conditionEditorId = () => `condition-editor-${++identity}`;
export function isConditionEditorTreeRenderable(input: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (input === undefined || input === null) return true;
  if (Array.isArray(input)) return input.every(item => isConditionEditorTreeRenderable(item, depth + 1));
  if (typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  const groups = ['all', 'any', 'not'].filter(key => key in value);
  if (!groups.length) return typeof value.type === 'string' && (value.type !== 'instanceQuery' || isConditionEditorTreeRenderable(value.filters, depth + 1));
  if (groups.length !== 1 || 'type' in value) return false;
  const key = groups[0];
  if (key === 'not') return value.not !== undefined && value.not !== null && !Array.isArray(value.not) && isConditionEditorTreeRenderable(value.not, depth + 1);
  return Array.isArray(value[key]) && (value[key] as unknown[]).every(item => item !== null && item !== undefined && !Array.isArray(item) && isConditionEditorTreeRenderable(item, depth + 1));
}
export function pendingConditionNode(): ConditionEditorNode {
  return { id: conditionEditorId(), kind: 'leaf', notLabels: [], condition: { type: 'pending' }, autoOpen: true };
}
export function emptyConditionGroup(): ConditionEditorNode {
  return { id: conditionEditorId(), kind: 'group', mode: 'all', notLabels: [], children: [] };
}
export function conditionEditorTree(input: ConditionInput | undefined): ConditionEditorNode {
  const decode = (expression: ConditionExpression): ConditionEditorNode => {
    const notLabels: (string | undefined)[] = [];
    while (isConditionSet(expression) && 'not' in expression) { notLabels.push(expression.label); expression = expression.not; }
    if (isConditionSet(expression)) return { id: conditionEditorId(), kind: 'group', notLabels, label: expression.label, mode: 'any' in expression ? 'any' : 'all', children: ('any' in expression ? expression.any : 'all' in expression ? expression.all : []).map(decode) };
    return { id: conditionEditorId(), kind: 'leaf', notLabels, condition: expression };
  };
  if (!input) return emptyConditionGroup();
  const node = decode(Array.isArray(input) ? { all: input } : input);
  return node.kind === 'group' ? node : { ...emptyConditionGroup(), kind: 'group', mode: 'all', children: [node] };
}
export function serializeConditionNode(node: ConditionEditorNode): ConditionExpression {
  let expression: ConditionExpression = node.kind === 'leaf' ? node.condition : { [node.mode]: node.children.map(serializeConditionNode), ...(node.label !== undefined ? { label: node.label } : {}) } as ConditionExpression;
  for (let index = node.notLabels.length - 1; index >= 0; index--) expression = { not: expression, ...(node.notLabels[index] !== undefined ? { label: node.notLabels[index] } : {}) };
  return expression;
}
export function serializeConditionTree(root: ConditionEditorNode): ConditionInput | undefined {
  return root.kind === 'group' && !root.children.length ? undefined : serializeConditionNode(root);
}
export function editConditionNode(root: ConditionEditorNode, id: string, transform: (node: ConditionEditorNode) => ConditionEditorNode): ConditionEditorNode {
  if (root.id === id) return transform(root);
  return root.kind === 'group' ? { ...root, children: root.children.map(child => editConditionNode(child, id, transform)) } : root;
}
export function removeConditionNode(root: ConditionEditorNode, id: string): ConditionEditorNode {
  return root.kind === 'group' ? { ...root, children: root.children.filter(child => child.id !== id).map(child => removeConditionNode(child, id)) } : root;
}
export function moveConditionNode(root: ConditionEditorNode, id: string, direction: -1 | 1): ConditionEditorNode {
  if (root.kind !== 'group') return root;
  const index = root.children.findIndex(child => child.id === id);
  if (index < 0) return { ...root, children: root.children.map(child => moveConditionNode(child, id, direction)) };
  const next = index + direction;
  if (next < 0 || next >= root.children.length) return root;
  const children = [...root.children];
  [children[index], children[next]] = [children[next], children[index]];
  return { ...root, children };
}
export function invertConditionNode(node: ConditionEditorNode): ConditionEditorNode {
  return { ...node, notLabels: node.notLabels.length % 2 ? node.notLabels.slice(1) : [undefined, ...node.notLabels] };
}

export function findConditionNode(root: ConditionEditorNode, id: string): ConditionEditorNode | undefined {
  if (root.id === id) return root;
  return root.kind === 'group' ? root.children.map(child => findConditionNode(child, id)).find(Boolean) : undefined;
}

function editorNodeDepth(node: ConditionEditorNode): number {
  return node.notLabels.length + (node.kind === 'group' && node.children.length ? 1 + Math.max(...node.children.map(editorNodeDepth)) : 0);
}

/** Validate against this tree only: root moves, cycles and excess runtime depth are rejected. */
export function canMoveConditionNode(root: ConditionEditorNode, id: string, parentId: string): boolean {
  const source = findConditionNode(root, id), parent = findConditionNode(root, parentId);
  if (!source || id === root.id || parent?.kind !== 'group' || findConditionNode(source, parentId)) return false;
  const depth = (node: ConditionEditorNode, current: number): number | undefined => {
    if (node.id === parentId) return current + 1 + node.notLabels.length;
    if (node.kind !== 'group') return undefined;
    return node.children.map(child => depth(child, current + 1 + node.notLabels.length)).find(value => value !== undefined);
  };
  return (depth(root, 0) ?? 65) + editorNodeDepth(source) <= 64;
}

/** index refers to the destination before removal, so pointer insertion slots remain stable. */
export function moveConditionNodeToGroup(root: ConditionEditorNode, id: string, parentId: string, index = Number.MAX_SAFE_INTEGER): ConditionEditorNode {
  if (!canMoveConditionNode(root, id, parentId)) return root;
  const source = findConditionNode(root, id)!, parent = findConditionNode(root, parentId)!;
  if (parent.kind !== 'group') return root;
  const oldIndex = parent.children.findIndex(child => child.id === id);
  const requested = Math.max(0, Math.min(parent.children.length, Math.trunc(index)));
  const insertion = oldIndex >= 0 && oldIndex < requested ? requested - 1 : requested;
  if (oldIndex === insertion) return root;
  const detached = removeConditionNode(root, id);
  return editConditionNode(detached, parentId, node => {
    if (node.kind !== 'group') return node;
    const children = [...node.children];
    children.splice(insertion, 0, source);
    return { ...node, children };
  });
}
