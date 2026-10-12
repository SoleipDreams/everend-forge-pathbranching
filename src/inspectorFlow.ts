import type { BranchingProject } from "./domain.js";
import { buildStoryCanvasModel } from "./canvas/storyCanvasModel.js";
import { canvasReturnConnectors } from "./canvas/returnConnectors.js";

/** Use the canvas's semantic return classification, never event order or position. */
export function inspectorFlowContext(project: BranchingProject, eventId: string, nodeId: string) {
  const sequences = project.sequences.filter(sequence => sequence.eventIds.includes(eventId));
  const scopes = nodeId === eventId
    ? sequences.map(sequence => ({ kind: "sequence" as const, id: sequence.id }))
    : [{ kind: "event" as const, id: eventId }];
  const returns = new Set<string>();
  for (const scope of scopes) {
    const graph = buildStoryCanvasModel(project, { scope });
    const connectors = canvasReturnConnectors(graph.nodes, graph.edges);
    for (const edge of graph.edges) {
      if (connectors.has(edge.id) && edge.id.startsWith("edge:transition:")) returns.add(edge.id.slice("edge:transition:".length));
    }
  }
  return { sequences, starts: nodeId === eventId ? sequences.filter(sequence => sequence.entryEventId === eventId) : [], returns };
}
