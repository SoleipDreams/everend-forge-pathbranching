import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { BranchingProject } from './domain.js';
import { StoryTestController, type StoryTestControllerOptions } from './storyTestController.js';

export function useStoryTestController(project: BranchingProject | undefined, options: StoryTestControllerOptions) {
  const ref = useRef<StoryTestController | undefined>(undefined);
  if (!ref.current) ref.current = new StoryTestController(project, options);
  const controller = ref.current;
  const callbacks = useRef(options);
  callbacks.current = options;
  useEffect(() => {
    controller.updateProject(project, {
      locale: options.locale, theme: options.theme, selectedNodeId: options.selectedNodeId, documentKey: options.documentKey,
      onUpdate: next => callbacks.current.onUpdate?.(next), onLocate: id => callbacks.current.onLocate?.(id),
    });
  }, [controller, project, options.locale, options.theme, options.selectedNodeId, options.documentKey]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, snapshot, dispatch: controller.dispatch };
}
