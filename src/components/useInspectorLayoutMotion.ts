import { useLayoutEffect, useRef, type RefObject } from "react";

/** Follow the same tabs between the floating stack and the centered sidebar. */
export function useInspectorLayoutMotion(ref: RefObject<HTMLElement | null>, centered: boolean, order: string) {
  const previous = useRef<{ centered: boolean; rects: Map<string, DOMRect> } | undefined>(undefined);
  useLayoutEffect(() => {
    const dock = ref.current;
    if (!dock) return;
    const selector = centered ? '.inspector-centered-tab-row' : '.event-inspector-card';
    const elements = Array.from(dock.querySelectorAll<HTMLElement>(selector));
    const measure = () => new Map(elements.filter(el => el.getClientRects().length).map(el => [el.dataset.tabKey!, el.getBoundingClientRect()]));
    const rects = measure();
    const before = previous.current;
    previous.current = { centered, rects };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations: Animation[] = [];
    if (before && !preference.matches) {
      for (const el of elements) {
        const from = before.rects.get(el.dataset.tabKey!);
        const to = rects.get(el.dataset.tabKey!);
        if (!from || !to) continue;
        const activeCard = !centered && el.classList.contains('expanded') && before.centered !== centered;
        const changedMode = before.centered !== centered;
        const x = activeCard ? 0 : changedMode ? Math.max(-48, Math.min(48, from.x - to.x)) : from.x - to.x;
        const y = activeCard ? 8 : changedMode ? Math.max(-24, Math.min(24, from.y - to.y)) : from.y - to.y;
        if (Math.abs(x) < 1 && Math.abs(y) < 1) continue;
        animations.push(el.animate([
          { translate: `${x}px ${y}px`, opacity: before.centered === centered ? 1 : .4 },
          { translate: '0px 0px', opacity: 1 },
        ], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }));
      }
    }
    const cancel = () => animations.forEach(animation => animation.cancel());
    const update = () => { previous.current = { centered, rects: measure() }; };
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    window.addEventListener('resize', update);
    preference.addEventListener('change', cancel);
    return () => { cancel(); observer.disconnect(); window.removeEventListener('resize', update); preference.removeEventListener('change', cancel); };
  }, [ref, centered, order]);
}
