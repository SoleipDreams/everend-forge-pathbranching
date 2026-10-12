import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type InspectorSelectOption = { value: string; label: string; menuLabel?: string; imageUrl?: string; detail?: string; icon?: ReactNode };

/** Select-only combobox: keyboard navigation previews options without changing the document. */
export function InspectorSelect({ label, icon, value, options, onChange, presentation = "field" }: {
  label: string; icon: ReactNode; value: string; options: InspectorSelectOption[]; onChange: (value: string) => void;
  presentation?: "field" | "cover";
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 240 });
  const selected = options.find(option => option.value === value);
  const reveal = (last = false) => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const height = Math.min(240, Math.max(below, above));
    const upwards = below < Math.min(240, options.length * 56 + 12) && above > below;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), top: upwards ? rect.top - 6 : rect.bottom + 6, width: rect.width, maxHeight: height });
    setActive(last ? options.length - 1 : Math.max(0, options.findIndex(option => option.value === value)));
    setOpen(true);
  };
  const choose = (index: number) => {
    if (options[index]) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const scroll = (event: Event) => { if (!menu.current?.contains(event.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", close); document.removeEventListener("scroll", scroll, true); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, active]);
  const below = trigger.current ? window.innerHeight - trigger.current.getBoundingClientRect().bottom - 12 : 240;
  const above = trigger.current ? trigger.current.getBoundingClientRect().top - 12 : 0;
  const upwards = below < Math.min(240, options.length * 56 + 12) && above > below;
  return <div className={`inspector-select${presentation === "cover" ? " inspector-select-cover" : ""}`}>
    <span id={`${id}-label`} className="inspector-field-title">{icon}{label}</span>
    <button ref={trigger} type="button" role="combobox" className="inspector-select-trigger" aria-labelledby={presentation === "cover" ? `${id}-label` : `${id}-label ${id}-value`}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => open ? setOpen(false) : reveal()}
      onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          if (event.key === "Escape") { setOpen(false); return; }
          if (!open) { reveal(event.key === "End"); if (event.key === "Home") setActive(0); return; }
          if (event.key === "Enter" || event.key === " ") choose(active);
          else if (event.key === "Home") setActive(0);
          else if (event.key === "End") setActive(options.length - 1);
          else setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          search.current = { text: (now - search.current.time < 700 ? search.current.text : "") + event.key.toLocaleLowerCase(), time: now };
          if (!open) reveal();
          const index = options.findIndex(option => (option.menuLabel ?? option.label).toLocaleLowerCase().startsWith(search.current.text));
          if (index >= 0) setActive(index);
        }
      }}>
      {presentation === "cover" ? <>
        {selected?.imageUrl ? <img className="inspector-event-cover-image" src={selected.imageUrl} alt="" /> : <span className="inspector-event-cover-empty">{icon}<span>{selected?.label ?? value}</span></span>}
        <span className="inspector-cover-caption">{icon}<span id={`${id}-value`}>{label}</span><ChevronDown size={16} aria-hidden="true" /></span>
      </> : <>
        {selected?.imageUrl ? <img className="inspector-select-thumb" src={selected.imageUrl} alt="" /> : <span className="inspector-select-symbol" aria-hidden="true">{icon}</span>}
        <span className="inspector-select-value" id={`${id}-value`} title={selected?.label}>{selected?.label ?? value}</span>
        <ChevronDown size={16} className="inspector-select-chevron" aria-hidden="true" />
      </>}
    </button>
    {open && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="inspector-select-menu"
      style={{ position: "fixed", ...position, transform: upwards ? "translateY(-100%)" : undefined }}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
        data-option-index={index} data-active={index === active || undefined} className="inspector-select-option"
        onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        {option.imageUrl ? <img className="inspector-select-thumb" src={option.imageUrl} alt="" /> : <span className="inspector-select-symbol" aria-hidden="true">{option.icon ?? icon}</span>}
        <span className="inspector-select-option-copy"><span>{option.menuLabel ?? option.label}</span>{option.detail ? <small>{option.detail}</small> : null}</span>
        {option.value === value ? <Check size={16} aria-hidden="true" /> : null}
      </div>)}
    </div>, trigger.current?.closest(".pathbranching-app") ?? document.body)}
  </div>;
}
