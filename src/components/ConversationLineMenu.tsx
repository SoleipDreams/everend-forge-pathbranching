import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

type Option = { label: string; disabled?: boolean; run: () => void; danger?: boolean };
/** One keyboard-accessible menu shared by the trailing button and row context menu. */
export function ConversationLineMenu({ label, options, contextPoint, icon, className = 'conversation-line-more' }: { label: string; options: Option[]; icon?: ReactNode; className?: string; contextPoint?: { x: number; y: number; serial: number } }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number }>();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => { if (contextPoint) { setPoint(contextPoint); setOpen(true); } }, [contextPoint]);
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect(), rect = menu.current.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(point?.x ?? anchor.right - rect.width, window.innerWidth - rect.width - 8)), top: Math.max(8, Math.min(point?.y ?? anchor.bottom + 4, window.innerHeight - rect.height - 8)) });
    menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [open, point]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const dismiss = () => close();
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', dismiss); };
  }, [open]);
  return <>
    <button ref={trigger} className={className} type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { setPoint(undefined); setOpen(!open); }}>{icon ?? <MoreHorizontal size={17} aria-hidden="true" />}</button>
    {open ? createPortal(<div ref={menu} id={id} className="conversation-line-menu" role="menu" aria-label={label} style={{ position: 'fixed', ...position }} onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') close();
      else if (['ArrowUp','ArrowDown','Home','End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])], index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    }}>{options.map(option => <button type="button" role="menuitem" key={option.label} disabled={option.disabled} className={option.danger ? 'danger' : undefined} onClick={() => { close(true); option.run(); }}>{option.label}</button>)}</div>, trigger.current?.closest('.pathbranching-app') ?? document.body) : null}
  </>;
}
