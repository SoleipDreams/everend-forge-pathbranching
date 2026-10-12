import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CanonRef } from "../domain.js";
import { canonExplorerTypes } from "../explorerSchema.js";
import { useInterfaceLocale } from "../i18n.js";

export function InspectorWorldLinks({ title, grouped, value, canonRefs, availableRefs = canonRefs, propertiesConfig, onChange, onSelect }: {
  title: string; grouped?: boolean; value?: string[]; canonRefs: CanonRef[]; availableRefs?: CanonRef[];
  propertiesConfig?: Record<string, unknown>; onChange: (ids: string[] | undefined) => void; onSelect: (id: string) => void;
}) {
  const es = useInterfaceLocale() === "es";
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const types = canonExplorerTypes(propertiesConfig);
  const ids = value ?? [];
  const category = (kind?: string) => types.find(type => type.id === kind)?.label ?? kind ?? (es ? "Sin categoría" : "Uncategorized");
  const selected = ids.map(id => ({ id, ref: canonRefs.find(ref => ref.id === id) }));
  const groups = new Map<string, typeof selected>();
  for (const item of selected) {
    const key = item.ref?.kind ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const matches = availableRefs.filter(ref => [ref.label, ref.id, category(ref.kind)].some(value => value?.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 24);
  const close = () => { setSearching(false); setQuery(""); trigger.current?.focus(); };
  const add = (id: string) => { if (availableRefs.some(ref => ref.id === id) && !ids.includes(id)) onChange([...ids, id]); };
  const renderItem = ({ id, ref }: typeof selected[number]) => <div className="inspector-world-item" key={id}>
    <button type="button" className="inspector-world-name" disabled={!ref} onClick={() => onSelect(id)}>{ref?.label ?? id}</button>
    {!grouped ? <span className="inspector-world-category">{category(ref?.kind)}</span> : null}
    <button type="button" className="inspector-world-remove" aria-label={`${es ? "Quitar" : "Remove"} ${ref?.label ?? id}`} onClick={() => { const next = ids.filter(item => item !== id); onChange(next.length ? next : undefined); }}><X size={13} aria-hidden="true" /></button>
  </div>;
  return <section className="inspector-world-links" aria-label={title} onDragOver={event => { if (event.dataTransfer.types.includes("application/x-pathbranching-canon-ref") || event.dataTransfer.types.includes("text/plain")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDrop={event => { const id = event.dataTransfer.getData("application/x-pathbranching-canon-ref") || event.dataTransfer.getData("text/plain"); if (id) { event.preventDefault(); add(id.trim()); } }}>
    <h3>{title}<button ref={trigger} type="button" className="inspector-flow-add" aria-label={`${es ? "Añadir" : "Add"} ${title}`} aria-expanded={searching} onClick={() => searching ? close() : setSearching(true)}><Plus size={15} aria-hidden="true" /></button></h3>
    {searching ? <div className="inspector-world-search" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <div><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={es ? "Buscar en el universo…" : "Search the universe…"} aria-label={`${es ? "Buscar" : "Search"} ${title}`} /><button type="button" aria-label={es ? "Cerrar búsqueda" : "Close search"} onClick={close}><X size={14} /></button></div>
      <div className="inspector-world-results">{matches.map(ref => <button key={ref.id} type="button" disabled={ids.includes(ref.id)} onClick={() => add(ref.id)}><span>{ref.label ?? ref.id}</span><small>{category(ref.kind)}</small></button>)}{!matches.length ? <span>{es ? "Sin resultados" : "No results"}</span> : null}</div>
    </div> : null}
    {grouped ? Array.from(groups).sort(([a], [b]) => category(a).localeCompare(category(b))).map(([kind, items]) => <div className="inspector-world-group" key={kind}><h4>{category(kind || undefined)}<span>{items.length}</span></h4><div>{items.map(renderItem)}</div></div>) : <div className="inspector-world-reference-list">{selected.map(renderItem)}</div>}
    {!ids.length ? <span className="inspector-world-empty">{es ? "Sin elementos vinculados" : "No linked elements"}</span> : null}
  </section>;
}
