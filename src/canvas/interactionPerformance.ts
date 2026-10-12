import type { NodeChange } from "@xyflow/react";
import { validateStoryCanvasEdges, type StoryCanvasNode, type StoryCanvasEdge } from "./storyCanvasModel.js";

export const requiresSubcanvasLayout = (changes: readonly NodeChange<StoryCanvasNode>[]) => changes.some(change => change.type !== "select");

/** Validation concerns identity and endpoints, never selection or geometry. */
export function createCanvasValidationCache(validate = validateStoryCanvasEdges) {
  let nodeIds: string[] | undefined;
  let endpoints: Array<readonly [string, string, string]> = [];
  let findings: ReturnType<typeof validateStoryCanvasEdges> = [];
  return (nodes: StoryCanvasNode[], edges: StoryCanvasEdge[]) => {
    if (nodeIds?.length === nodes.length && endpoints.length === edges.length &&
      nodes.every((node, index) => node.id === nodeIds![index]) &&
      edges.every((edge, index) => edge.id === endpoints[index][0] && edge.source === endpoints[index][1] && edge.target === endpoints[index][2])) return findings;
    nodeIds = nodes.map(node => node.id);
    endpoints = edges.map(edge => [edge.id, edge.source, edge.target]);
    findings = validate(nodes, edges);
    return findings;
  };
}
