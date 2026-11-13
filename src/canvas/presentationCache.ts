import type { StoryCanvasNode, StoryCanvasEdge } from "./storyCanvasModel.js";

type RecordValue = Record<string, unknown>;
function shallowEqual(left: RecordValue, right: RecordValue): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && Object.is(left[key], right[key]));
}

/** Keep unchanged React Flow items referentially stable. Event handlers delegate
 * to the latest projection, so reusing an item never retains an old document. */
export function createCanvasPresentationCache<T extends StoryCanvasNode | StoryCanvasEdge>() {
  const items = new Map<string, { item: T; callbacks: Map<string, { current: Function; stable: Function }> }>();
  let previous: T[] = [];
  return (candidates: T[]): T[] => {
    const live = new Set<string>();
    const result = candidates.map(candidate => {
      live.add(candidate.id);
      const cached = items.get(candidate.id);
      const callbacks = cached?.callbacks ?? new Map<string, { current: Function; stable: Function }>();
      const liveCallbacks = new Set<string>();
      const reusedObjectPaths = new Set<string>();
      const stableValue = (value: unknown, previousValue: unknown, path: string, depth: number): unknown => {
        if (typeof value === "function") {
          liveCallbacks.add(path);
          let callback = callbacks.get(path);
          if (!callback) {
            const next = { current: value, stable: (...args: unknown[]) => Reflect.apply(next.current, undefined, args) };
            callback = next;
            callbacks.set(path, callback);
          } else callback.current = value;
          return callback.stable;
        }
        if (Object.is(value, previousValue)) {
          if (value && typeof value === "object") reusedObjectPaths.add(path);
          return value;
        }
        if (depth === 0) return value;
        if (Array.isArray(value)) {
          const previousArray = Array.isArray(previousValue) ? previousValue : [];
          const next = value.map((entry, index) => stableValue(entry, previousArray[index], `${path}.${index}`, depth - 1));
          return Array.isArray(previousValue) && previousArray.length === next.length && next.every((entry, index) => Object.is(entry, previousArray[index])) ? previousValue : next;
        }
        if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
          const previousRecord = previousValue && typeof previousValue === "object" ? previousValue as RecordValue : undefined;
          const next = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stableValue(entry, previousRecord?.[key], `${path}.${key}`, depth - 1)]));
          return previousRecord && shallowEqual(previousRecord, next) ? previousValue : next;
        }
        return value;
      };
      // Editor props contain short arrays and callbacks. Bound recursion so an
      // updated narrative snapshot is never deeply compared in the render path.
      const data = stableValue(candidate.data, cached?.item.data, "data", 4) as T["data"];
      // Reused object prefixes preserve their descendant callbacks. Scan the
      // callback map once per item instead of rescanning it at every shared
      // nested object during a canvas selection update.
      for (const path of callbacks.keys()) {
        if (liveCallbacks.has(path)) continue;
        let parent = path;
        let preserved = false;
        while (parent.includes(".")) {
          parent = parent.slice(0, parent.lastIndexOf("."));
          if (reusedObjectPaths.has(parent)) {
            preserved = true;
            break;
          }
        }
        if (!preserved) callbacks.delete(path);
      }
      const next = { ...candidate, data } as T;
      const item = cached && shallowEqual(cached.item, next) ? cached.item : next;
      items.set(candidate.id, { item, callbacks });
      return item;
    });
    for (const id of items.keys()) if (!live.has(id)) items.delete(id);
    if (previous.length === result.length && result.every((item, index) => item === previous[index])) return previous;
    previous = result;
    return result;
  };
}
