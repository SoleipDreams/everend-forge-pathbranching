import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** Place inspector menus in free space above the dock, beside its left edge, or left-aligned to their trigger. */
export function useInspectorMenuPlacement(open: boolean, anchor: RefObject<HTMLElement | null>, menu: RefObject<HTMLElement | null>, preferredWidth = 240, preferredSide: "auto" | "left-of-anchor" = "auto") {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });
  useLayoutEffect(() => {
    if (!open) return;
    const target = anchor.current;
    const popup = menu.current;
    if (!target || !popup) return;
    const dock = target.closest('.unified-authoring-dock');
    const position = () => {
      const origin = target.getBoundingClientRect();
      const cards = Array.from(dock?.querySelectorAll('.event-inspector-card') ?? []).map(el => el.getBoundingClientRect());
      const toolbar = dock?.querySelector('.inspector-window-tools')?.getBoundingClientRect();
      const leftEdge = cards.length ? Math.min(...cards.map(rect => rect.left)) : origin.left;
      const topEdge = Math.min(origin.top, toolbar?.top ?? origin.top, ...cards.map(rect => rect.top));
      const bottomEdge = cards.length ? Math.max(...cards.map(rect => rect.bottom)) : origin.bottom;
      const width = Math.min(preferredWidth, window.innerWidth - 16);
      const height = Math.min(popup.scrollHeight, window.innerHeight - 16);
      if (preferredSide === "left-of-anchor") {
        const actualWidth = Math.min(width, origin.left - 16);
        if (actualWidth >= Math.min(190, width)) {
          const top = Math.max(8, Math.min(origin.top + (origin.height - height) / 2, window.innerHeight - height - 8));
          setStyle({ position:'fixed', visibility:'visible', left:origin.left - actualWidth - 8, top, width:actualWidth, maxHeight:window.innerHeight - 16, bottom:'auto', right:'auto', transform:'none' });
          return;
        }
      }
      const above = Math.max(0, topEdge - 14);
      const left = Math.max(0, leftEdge - 14);
      if (above >= height || left < 190) {
        setStyle({ position:'fixed', visibility:'visible', left:Math.max(8, Math.min(origin.right - width, window.innerWidth - width - 8)), top:Math.max(8, topEdge - 6 - Math.min(height, above)), width, maxHeight:above, bottom:'auto', right:'auto', transform:'none' });
      } else {
        const actualWidth = Math.min(width, left);
        setStyle({ position:'fixed', visibility:'visible', left:leftEdge - 6 - actualWidth, top:Math.max(8, Math.min(origin.top, bottomEdge - height, window.innerHeight - height - 8)), width:actualWidth, maxHeight:window.innerHeight - 16, bottom:'auto', right:'auto', transform:'none' });
      }
    };
    position();
    const observer = new ResizeObserver(position);
    if (dock) observer.observe(dock);
    observer.observe(target);
    const scroll = (event: Event) => { if (!popup.contains(event.target as Node)) position(); };
    window.addEventListener('resize', position);
    document.addEventListener('scroll', scroll, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); document.removeEventListener('scroll', scroll, true); };
  }, [open, anchor, menu, preferredWidth, preferredSide]);
  return style;
}
