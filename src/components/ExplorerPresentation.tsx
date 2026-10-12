import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { useOverlayFocus } from "./useOverlayFocus.js";

/** Only the management explorer supplies chrome; other panel hosts keep theirs. */
export const ExplorerEmbeddedContext = createContext(false);
export const useExplorerEmbedded = () => useContext(ExplorerEmbeddedContext);

/** UI-only preferences: never part of a narrative document or runtime export. */
export function ExplorerGroup({ id, title, children, defaultOpen = false }: {
  id: string; title: ReactNode; children: ReactNode; defaultOpen?: boolean;
}) {
  const key = `pathbranching.explorer.group.${id}`;
  const [open, setOpen] = useState(() => {
    try { const saved = sessionStorage.getItem(key); return saved === null ? defaultOpen : saved === "true"; }
    catch { return defaultOpen; }
  });
  return <details className="pb-explorer-group" open={open} onToggle={event => {
    const next = event.currentTarget.open;
    setOpen(next);
    try { sessionStorage.setItem(key, String(next)); } catch { /* Storage can be unavailable. */ }
  }}><summary>{title}</summary><div className="pb-explorer-group-body">{children}</div></details>;
}

/** Retains drafts and per-view scrolling when a nested explorer tab is hidden. */
export function ExplorerPane({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  useLayoutEffect(() => {
    if (!active) return;
    const scroll = ref.current?.closest<HTMLElement>(".panel-scroll");
    if (!scroll) return;
    scroll.scrollTop = offset.current;
    const remember = () => { offset.current = scroll.scrollTop; };
    scroll.addEventListener("scroll", remember);
    return () => { remember(); scroll.removeEventListener("scroll", remember); };
  }, [active]);
  return <div ref={ref} className="pb-explorer-pane" hidden={!active}>{children}</div>;
}

/** Keyboard behavior for the local-resource actions menu. */
export function ExplorerMenu({ label, style, onClose, children }: {
  label: string; style: CSSProperties; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayFocus(ref, true, onClose, false);
  useExplorerOverlayBounds(ref, true);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, []);
  return <div ref={ref} className="explorer-row-menu" role="menu" aria-label={label} style={style} onKeyDown={event => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : undefined;
    if (next !== undefined && items.length) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === "Tab") onClose();
  }}>{children}</div>;
}

/** Re-clamp floating controls after window resizing or expanded form sections. */
export function useExplorerOverlayBounds(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    const fit = () => {
      const box = element.getBoundingClientRect();
      const top = Math.max(8, Math.min(box.top, window.innerHeight - box.height - 8));
      const left = Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8));
      const next = { top: `${top}px`, left: `${left}px`, right: "auto", maxHeight: `${Math.max(0, window.innerHeight - top - 8)}px` };
      for (const [key, value] of Object.entries(next)) {
        if (element.style[key as "top" | "left" | "right" | "maxHeight"] !== value) element.style[key as "top" | "left" | "right" | "maxHeight"] = value;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    window.addEventListener("resize", fit);
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, [ref, active]);
}
