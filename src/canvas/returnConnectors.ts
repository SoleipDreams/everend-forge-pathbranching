import type { StoryCanvasEdge, StoryCanvasNode } from "./storyCanvasModel.js";

export type ReturnConnector = { visible: boolean; lane: number; count: number; edgeId: string; width?: number };

/** Follow the authored flow, including projected gates and decision outcomes.
 * Only an edge to an ancestor closes a path; a merge into another branch does
 * not. Canvas coordinates and parent-container offsets have no role here. */
function returnEdgesInFlow(nodes: StoryCanvasNode[], edges: StoryCanvasEdge[]) {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const returns = new Set<string>();
  const outgoing = new Map<string, StoryCanvasEdge[]>();
  const incoming = new Set<string>();
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (edge.data?.kind === "transition" && edge.data.returnRoute === true) {
      returns.add(edge.id); // Explicit restart/parent exits may end at a boundary port.
      continue;
    }
    if (!["entry", "boundary", "contains", "choice", "transition"].includes(edge.data?.kind ?? "")) continue;
    const routes = outgoing.get(edge.source) ?? [];
    routes.push(edge);
    outgoing.set(edge.source, routes);
    incoming.add(edge.target);
  }
  // Authored route order breaks ties, never visual position or dragging order.
  for (const routes of outgoing.values()) routes.sort((a, b) =>
    (Number(a.data?.order) || 0) - (Number(b.data?.order) || 0) || a.id.localeCompare(b.id));
  const orderedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const roots = orderedNodes.filter(node => node.data?.kind === "start" ||
    (node.data?.kind === "boundary" && node.data.details?.direction === "input"));
  const states = new Map<string, "active" | "done">();
  // Iterative DFS also handles large stories without recursive stack overflow.
  for (const root of [...roots, ...orderedNodes.filter(node => !incoming.has(node.id)), ...orderedNodes]) {
    if (states.has(root.id)) continue;
    states.set(root.id, "active");
    const stack = [{ id: root.id, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const edge = outgoing.get(frame.id)?.[frame.next++];
      if (!edge) {
        states.set(frame.id, "done");
        stack.pop();
      } else if (states.get(edge.target) === "active") {
        if (edge.data?.kind === "transition") returns.add(edge.id);
      } else if (!states.has(edge.target)) {
        states.set(edge.target, "active");
        stack.push({ id: edge.target, next: 0 });
      }
    }
  }
  return returns;
}

/** Presentation only: retain every route and its original destination. */
export function canvasReturnConnectors(nodes: StoryCanvasNode[], edges: StoryCanvasEdge[]) {
  const returns = returnEdgesInFlow(nodes, edges);
  const groups = new Map<string, { lane: number; edges: StoryCanvasEdge[] }>();
  const lanes = new Map<string, number>();
  for (const edge of edges) {
    if (!returns.has(edge.id)) continue;
    const outlet = JSON.stringify([edge.source, edge.sourceHandle ?? ""]);
    const key = JSON.stringify([edge.source, edge.sourceHandle ?? "", edge.target]);
    let group = groups.get(key);
    if (!group) {
      const lane = lanes.get(outlet) ?? 0;
      group = { lane, edges: [] };
      groups.set(key, group);
      lanes.set(outlet, lane + 1);
    }
    group.edges.push(edge);
  }
  const connectors = new Map<string, ReturnConnector>();
  for (const group of groups.values()) {
    group.edges.forEach((edge, index) => connectors.set(edge.id, {
      visible: index === 0,
      lane: group.lane,
      count: group.edges.length,
      edgeId: group.edges[0].id,
    }));
  }
  return connectors;
}
