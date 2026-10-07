import { useEffect, useRef, useState } from "react";
import type { BranchingProject } from "../domain.js";
import { authoringNodeOptions } from "../authoringMutations.js";
import { useInterfaceLocale } from "../i18n.js";
import { NarrativeEditor } from "./NarrativeEditor.js";
import { AccessibleTabs } from "./AccessibleTabs.js";
import { ActionsEditor, EntityUsesEditor, RulesEditor, type AuthoringMutation } from "./AuthoringStudio.js";
import "../authoringWorkspace.css";

export function AuthoringWorkspace({ project, eventId, dialogueId, selectedNodeId, initialTab, initialEntityId, initialFocusId, onMutation, onSelect, onClose, onTest }: {
  project: BranchingProject; eventId?: string; dialogueId?: string; selectedNodeId?: string;
  onMutation: AuthoringMutation; onSelect: (nodeId: string) => void; onClose: () => void; onTest: () => void;
  initialTab?: string; initialEntityId?: string; initialFocusId?: string;
}) {
  const es = useInterfaceLocale() === "es";
  const [tab, setTab] = useState(initialTab ?? "write");
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab, initialEntityId]);
  const [compact, setCompact] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!initialFocusId) return;
    const frame = requestAnimationFrame(() => {
      const target = ref.current?.querySelector<HTMLElement>(`[data-authoring-id="${CSS.escape(initialFocusId)}"]`);
      target?.scrollIntoView({ block: "nearest" }); target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, initialEntityId, initialFocusId]);
  useEffect(() => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const canvas = ref.current?.parentElement;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 940));
    observer.observe(canvas);
    return () => { observer.disconnect(); if (trigger.current?.isConnected) trigger.current.focus(); };
  }, []);
  const targets = authoringNodeOptions(project);
  const resolvedEvent = eventId && project.events.some(e => e.id === eventId) ? eventId : project.events[0]?.id;
  return <aside ref={ref} className={`authoring-workspace${compact ? " compact" : ""}`} aria-label={es ? "Autoría de historia" : "Story authoring"} onKeyDown={e => { if (e.key === "Escape" && e.target instanceof Element && !e.target.closest('[role="dialog"], [role="menu"]')) { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
    <header className="authoring-workspace-header"><strong>{es ? "Autoría de historia" : "Story authoring"}</strong><button type="button" onClick={onTest}>{es ? "Probar historia" : "Test story"}</button><button type="button" onClick={onClose} aria-label={es ? "Plegar editor de historia" : "Collapse story editor"}>×</button></header>
    <AccessibleTabs value={tab} tabs={[{ id: "write", label: es ? "Escribir" : "Write" }, { id: "entities", label: es ? "Entidades" : "Entities" }, { id: "actions", label: es ? "Acciones" : "Actions" }, { id: "rules", label: es ? "Reglas" : "Rules" }]} ariaLabel={es ? "Herramientas de autoría" : "Authoring tools"} onChange={setTab} panelId="authoring-workspace-content" />
    <div className="authoring-workspace-content" id="authoring-workspace-content" role="tabpanel">
      {tab === "write" ? resolvedEvent ? <NarrativeEditor project={project} eventId={resolvedEvent} dialogueId={dialogueId} selectedNodeId={selectedNodeId} onMutation={onMutation} onSelect={onSelect} /> : <p>{es ? "Crea un evento desde el canvas o Historias para empezar." : "Create an event from the canvas or Stories to begin."}</p> : null}
      {tab === "entities" ? <EntityUsesEditor project={project} initialEntityId={initialEntityId} onMutation={onMutation} onLocate={onSelect} /> : null}
      {tab === "actions" ? <ActionsEditor project={project} initialId={initialFocusId} targets={targets} onMutation={onMutation} /> : null}
      {tab === "rules" ? <RulesEditor project={project} initialId={initialFocusId} eventId={resolvedEvent} dialogueId={dialogueId} targets={targets} onMutation={onMutation} /> : null}
    </div>
  </aside>;
}
