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
      resolveSpeakerPresentation: options.resolveSpeakerPresentation,
      onUpdate: next => callbacks.current.onUpdate?.(next), onLocate: id => callbacks.current.onLocate?.(id),
    });
  }, [controller, project, options.locale, options.theme, options.selectedNodeId, options.documentKey, options.resolveSpeakerPresentation]);
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsedMs = now - last; last = now;
      const snap = controller.getSnapshot();
      if (document.hasFocus() && document.visibilityState === 'visible' && snap.active && !snap.paused && !snap.changed && snap.status === 'ready' && snap.view?.interactions?.some(x => x.mechanic.kind === 'qte')) controller.dispatch({ type: 'interactionTime', elapsedMs });
    }, 50);
    const resetClock = () => { last = performance.now(); };
    window.addEventListener('focus', resetClock); window.addEventListener('blur', resetClock);
    return () => { clearInterval(timer); window.removeEventListener('focus', resetClock); window.removeEventListener('blur', resetClock); };
  }, [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { controller, snapshot, dispatch: controller.dispatch };
}
