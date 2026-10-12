import type { BranchingProject } from "./domain.js";
import { authoringNodeOptions } from "./authoringMutations.js";

const indexes = new WeakMap<BranchingProject, ReturnType<typeof createIndex>>();
function createIndex(project: BranchingProject) {
  const events = new Map<string, BranchingProject["events"][number]>();
  for (const event of project.events) if (!events.has(event.id)) events.set(event.id, event);
  const edgeOwners = new Map<string, string>();
  for (const event of project.events) {
    for (const route of event.transitions ?? []) {
      if (!edgeOwners.has(route.id)) edgeOwners.set(route.id, event.id);
      if (!edgeOwners.has(`edge:transition:${route.id}`)) edgeOwners.set(`edge:transition:${route.id}`, event.id);
    }
    for (const binding of event.boundaryBindings ?? []) if (!edgeOwners.has(`edge:boundary:${binding.id}`)) edgeOwners.set(`edge:boundary:${binding.id}`, event.id);
    for (const dialogue of event.dialogues ?? []) if (!edgeOwners.has(`edge:dialogue-entry:${dialogue.id}`)) edgeOwners.set(`edge:dialogue-entry:${dialogue.id}`, event.id);
  }
  let options: Map<string, ReturnType<typeof authoringNodeOptions>[number]> | undefined;
  const eventIds = [...events.keys()].sort((left, right) => right.length - left.length);
  return {
    events, edgeOwners,
    node(id: string) {
      if (!options) {
        options = new Map();
        for (const option of authoringNodeOptions(project)) if (!options.has(option.id)) options.set(option.id, option);
      }
      return options.get(id);
    },
    gateOwner(id: string) { return eventIds.find(eventId => id.startsWith(`route-gate:${eventId}:`)); },
  };
}

/** Projects and inspector drafts are immutable snapshots; a new snapshot gets a
 * new index. Old indexes can be collected together with their documents. */
export function inspectorDocumentIndex(project: BranchingProject) {
  let index = indexes.get(project);
  if (!index) { index = createIndex(project); indexes.set(project, index); }
  return index;
}
