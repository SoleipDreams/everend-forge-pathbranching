import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useInspectorMenuPlacement } from "./useInspectorMenuPlacement.js";

export function InspectorFlowAdd({ label, options }: { label: string; options: { label: string; disabled?: boolean; run: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const placement = useInspectorMenuPlacement(open, anchor, menu);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const dismiss = () => { setOpen(false); anchor.current?.focus(); };
  return <>
    <button ref={anchor} className="inspector-flow-add" type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Plus size={15} aria-hidden="true" /></button>
    {open ? createPortal(<div ref={menu} className="inspector-module-menu" style={placement} role="menu" aria-label={label} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); }
      if (event.key === "Tab") setOpen(false);
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const index = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[index]?.focus();
      }
    }}>{options.map(option => <button key={option.label} type="button" role="menuitem" disabled={option.disabled} onClick={() => { dismiss(); option.run(); }}>{option.label}</button>)}</div>, anchor.current?.closest(".pathbranching-app") ?? document.body) : null}
  </>;
}
