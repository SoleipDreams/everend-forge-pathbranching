import { BookOpen, FilePlus2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useInterfaceLocale } from "../i18n.js";
import "../authoringControls.css";

export function storiesViewCopy(locale: "en" | "es") {
  return locale === "es" ? {
    sequence: "Secuencia", branches: "Ramas", paths: "Rutas",
    sequenceHint: "Configura el inicio y las conexiones de esta secuencia.",
    branchesHint: "Organiza los eventos en ramas narrativas.",
    pathsHint: "Explora cómo se conectan los eventos de esta secuencia.",
  } : {
    sequence: "Sequence", branches: "Branches", paths: "Paths",
    sequenceHint: "Set the entry and connections for this sequence.",
    branchesHint: "Organize events into narrative branches.",
    pathsHint: "Explore how the events in this sequence connect.",
  };
}

function StoryActions({ label, renameLabel, deleteLabel, canRename, canDelete, onRename, onDelete }: {
  label: string; renameLabel: string; deleteLabel: string; canRename: boolean; canDelete: boolean;
  onRename: () => void; onDelete: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = (restore = false) => { setOpen(false); if (restore) triggerRef.current?.focus(); };
  const focusMenu = (last = false) => window.requestAnimationFrame(() => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    (last ? items[items.length - 1] : items[0])?.focus();
  });
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const menuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const active = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (active + 1) % items.length : event.key === "ArrowUp" ? (active - 1 + items.length) % items.length : undefined;
    if (next !== undefined && items.length) { event.preventDefault(); items[next]?.focus(); }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    if (event.key === "Tab") {
      event.preventDefault();
      const items = Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"],summary'))
        .filter((item) => item.tabIndex >= 0 && item.getClientRects().length > 0 && !event.currentTarget.contains(item));
      const index = triggerRef.current ? items.indexOf(triggerRef.current) : -1;
      const target = event.shiftKey ? triggerRef.current : items[index + 1];
      close(); (target ?? triggerRef.current)?.focus();
    }
  };
  return <div className="pb-story-actions" ref={ref}>
    <button type="button" ref={triggerRef} className="pb-story-menu-trigger" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => { setOpen((value) => !value); if (!open) focusMenu(); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); focusMenu(event.key === "ArrowUp"); }
      if (event.key === "Escape") close(true);
    }}><MoreHorizontal size={16} aria-hidden="true" /></button>
    {open ? <div id={id} role="menu" aria-label={label} className="pb-story-menu" onKeyDown={menuKey}>
      <button type="button" role="menuitem" disabled={!canRename} onClick={() => { close(true); onRename(); }}><Pencil size={14} />{renameLabel}</button>
      <button type="button" role="menuitem" className="danger" disabled={!canDelete} onClick={() => { close(true); onDelete(); }}><Trash2 size={14} />{deleteLabel}</button>
    </div> : null}
  </div>;
}

export type StoriesPanelProps = {
  stories: Array<{ id: string; name: string }>;
  activeStoryId?: string;
  sequences: Array<{ id: string; name: string }>;
  activeSequenceId?: string;
  eventCount?: number;
  fileCount?: number;
  locale?: "en" | "es";
  onStoryChange: (id: string) => void;
  onSequenceChange: (id: string) => void;
  onCreateStory: () => void; onRenameStory: () => void; onDeleteStory: () => void;
  onCreateSequence: () => void; onRenameSequence: () => void; onDeleteSequence: () => void;
};

/** Hierarchical story controls. Outline tabs and canvas navigation remain owned by the workspace. */
export function StoriesPanel({ stories, activeStoryId, sequences, activeSequenceId, eventCount = 0, locale: localeOverride, onStoryChange, onSequenceChange, onCreateStory, onRenameStory, onDeleteStory, onCreateSequence, onRenameSequence, onDeleteSequence }: StoriesPanelProps) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const id = useId();
  const es = locale === "es";
  const hasSequence = sequences.some((sequence) => sequence.id === activeSequenceId);
  return <div className="pb-stories-controls">
    <section className="pb-story-level" aria-labelledby={`${id}-story-label`}>
      <label id={`${id}-story-label`} htmlFor={`${id}-story`}><BookOpen size={14} aria-hidden="true" />{es ? "Historia" : "Story"}</label>
      <div className="pb-story-select-row">
        <select id={`${id}-story`} data-onboarding-target="pathbranching.story-selector" value={activeStoryId ?? ""} onChange={(event) => onStoryChange(event.target.value)}>
          <option value="">{es ? "Selecciona una historia" : "Select a story"}</option>
          {stories.map((story) => <option key={story.id} value={story.id}>{story.name}</option>)}
        </select>
        <StoryActions label={es ? "Acciones de la historia" : "Story actions"} renameLabel={es ? "Renombrar historia" : "Rename story"} deleteLabel={es ? "Eliminar historia" : "Delete story"} canRename={Boolean(activeStoryId)} canDelete={Boolean(activeStoryId) && stories.length > 1} onRename={onRenameStory} onDelete={onDeleteStory} />
      </div>
      <button type="button" className="pb-story-create" data-onboarding-target="pathbranching.create-story" onClick={onCreateStory}><Plus size={14} aria-hidden="true" />{es ? "Nueva historia" : "New story"}</button>
    </section>
    {activeStoryId ? <section className="pb-story-level pb-sequence-level" aria-labelledby={`${id}-sequence-label`}>
      <label id={`${id}-sequence-label`} htmlFor={`${id}-sequence`}><FilePlus2 size={14} aria-hidden="true" />{es ? "Secuencia de la historia" : "Story sequence"}</label>
      <div className="pb-story-select-row">
        <select id={`${id}-sequence`} data-onboarding-target="pathbranching.sequence-selector" value={activeSequenceId ?? ""} onChange={(event) => onSequenceChange(event.target.value)}>
          <option value="" disabled={sequences.length > 0}>{es ? "Selecciona una secuencia" : "Select a sequence"}</option>
          {sequences.map((sequence) => <option key={sequence.id} value={sequence.id}>{sequence.name}</option>)}
        </select>
        <StoryActions label={es ? "Acciones de la secuencia" : "Sequence actions"} renameLabel={es ? "Renombrar secuencia" : "Rename sequence"} deleteLabel={es ? "Eliminar secuencia" : "Delete sequence"} canRename={hasSequence} canDelete={hasSequence} onRename={onRenameSequence} onDelete={onDeleteSequence} />
      </div>
      <div className="pb-sequence-footer"><button type="button" className="pb-story-create" data-onboarding-target="pathbranching.create-sequence" onClick={onCreateSequence}><Plus size={14} aria-hidden="true" />{es ? "Nueva secuencia" : "New sequence"}</button><span>{hasSequence ? `${eventCount} ${es ? "eventos" : "events"}` : es ? "Sin secuencia" : "No sequence"}</span></div>
    </section> : null}
  </div>;
}
