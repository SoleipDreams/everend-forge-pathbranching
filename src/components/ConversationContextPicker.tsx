import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import { useInterfaceLocale } from '../i18n.js';

export function ConversationContextPicker({ label, searchLabel, options, hint, disabled, onChoose }: {
  label: string; searchLabel: string; options: { id: string; label: string; detail?: string; selected?: boolean }[];
  hint?: string; disabled?: boolean; onChoose: (id: string) => Promise<unknown>;
}) {
  const es = useInterfaceLocale() === 'es';
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 280, maxHeight: 300 });
  const close = () => { setOpen(false); setQuery(''); trigger.current?.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect(), width = Math.min(300, window.innerWidth - 16);
    const height = Math.min(300, window.innerHeight - 16);
    setPosition({ left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)), top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - height - 8)), width, maxHeight: height });
    input.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(); };
    const dismiss = () => close();
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', dismiss);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); };
  }, [open]);
  const matches = options.filter(item => `${item.label} ${item.detail ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <button ref={trigger} className="conversation-context-add" type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={() => open ? close() : setOpen(true)}><Plus size={14} aria-hidden="true" /></button>
    {open ? createPortal(<div ref={menu} className="conversation-context-menu" role="dialog" aria-label={label} style={{ position: 'fixed', ...position }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        if (event.target === input.current && event.key !== 'ArrowDown') return;
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('.conversation-context-results button:not(:disabled)') ?? [])];
        if (!items.length) return;
        event.preventDefault(); const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus({ preventScroll: true }); items[next]?.scrollIntoView({ block: 'nearest' });
      }
    }}>
      <div className="conversation-context-search"><Search size={14} aria-hidden="true" /><input ref={input} aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={event => setQuery(event.target.value)} /><button type="button" aria-label={es ? 'Cerrar búsqueda' : 'Close search'} onClick={close}><X size={14} /></button></div>
      {hint ? <small>{hint}</small> : null}
      <div className="conversation-context-results">{matches.map(item => <button type="button" key={item.id} disabled={disabled || item.selected} onClick={async () => { await onChoose(item.id); close(); }}><span>{item.label}</span>{item.detail ? <small>{item.detail}</small> : null}</button>)}{!matches.length ? <span>{es ? 'Sin resultados' : 'No results'}</span> : null}</div>
    </div>, trigger.current?.closest('.pathbranching-app') ?? document.body) : null}
  </>;
}
