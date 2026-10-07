import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BranchingProject } from "../domain.js";
import { parseEvpath, serializeEventEvpath, type EvpathParseError } from "../evpathFormat.js";
import { EvpathVisualBuilder } from "./EvpathVisualBuilder.js";
import { authoringDraftKey } from "../authoringDrafts.js";
import { useAuthoringDraft } from "./useAuthoringDraft.js";
import { useInterfaceLocale } from "../i18n.js";

export type EvpathApplyOutcome = { errors: EvpathParseError[]; warnings: string[] };
export type EvpathEditorMode = "visual" | "source";

/** Highlights one evpath line as backdrop spans behind the transparent textarea. */
function highlightLine(line: string, key: number): ReactNode {
  const anchorMatch = line.match(/^(.*?)(\s#\^\S+)(\s*)$/);
  const body = anchorMatch ? anchorMatch[1] : line;
  const anchor = anchorMatch ? anchorMatch[2] + (anchorMatch[3] ?? "") : undefined;
  const trimmed = body.trimStart();
  const indent = body.slice(0, body.length - trimmed.length);
  let bodyClass = "";
  if (trimmed.startsWith("=== ")) bodyClass = "evpath-hl-header";
  else if (/^=\s*(dialogue|trigger)\s*:/i.test(trimmed)) bodyClass = "evpath-hl-section";
  else if (trimmed.startsWith("? ")) bodyClass = "evpath-hl-decision";
  else if (trimmed.startsWith("* ")) bodyClass = "evpath-hl-option";
  else if (trimmed.startsWith("->")) bodyClass = "evpath-hl-divert";
  else if (trimmed.startsWith("~")) bodyClass = "evpath-hl-consequence";
  else if (/^\[.*\]$/s.test(trimmed)) bodyClass = "evpath-hl-direction";
  else if (/^\(.*\)$/s.test(trimmed)) bodyClass = "evpath-hl-note";
  else if (/^#/.test(trimmed)) bodyClass = "evpath-hl-meta";
  const parts: ReactNode[] = [indent];
  if (!bodyClass) {
    const speakerMatch = trimmed.match(/^((?:\?\?\?|[^:[\](){}~#*?=\\][^:]*?)(?:\s*\([^)]+\))?\s*):(\s.*)$/s);
    if (speakerMatch && !trimmed.startsWith("\\")) {
      parts.push(<span key="speaker" className="evpath-hl-speaker">{speakerMatch[1]}:</span>, speakerMatch[2]);
    } else parts.push(trimmed);
  } else {
    const segments = trimmed.split(/(\{[^{}]*\})/g);
    parts.push(<span key="body" className={bodyClass}>{segments.map((segment, index) => segment.startsWith("{") ? <span key={index} className="evpath-hl-cond">{segment}</span> : segment)}</span>);
  }
  if (anchor) parts.push(<span key="anchor" className="evpath-hl-anchor">{anchor}</span>);
  return <span key={key}>{parts}{"\n"}</span>;
}

function EvpathSourceEditor({ serialized, projectId, eventId, onApply, onDirtyChange }: {
  serialized: string;
  projectId: string;
  eventId: string;
  onApply: (eventId: string, text: string) => EvpathApplyOutcome;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const locale = useInterfaceLocale();
  const [value, setDraft, clearDraft] = useAuthoringDraft(authoringDraftKey(projectId, eventId, "evpath-source"), serialized);
  const [applyOutcome, setApplyOutcome] = useState<EvpathApplyOutcome>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLPreElement>(null);
  const dirty = value !== serialized;
  const parseErrors = useMemo(() => parseEvpath(value).errors, [value]);
  useEffect(() => { if (!dirty) clearDraft(); }, [dirty, clearDraft]);
  useEffect(() => { setApplyOutcome(undefined); }, [eventId]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const syncScroll = () => {
    if (!backdropRef.current || !textareaRef.current) return;
    backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
  };
  const errors = parseErrors.length ? parseErrors : applyOutcome?.errors ?? [];
  return <>
    <div className="evpath-editor-toolbar">
      <span className={`evpath-editor-status${dirty ? " dirty" : ""}`}>{dirty ? locale === "es" ? "Borrador recuperable sin aplicar" : "Recoverable unapplied draft" : locale === "es" ? "Sincronizado con el canvas" : "Synchronized with the canvas"}</span>
      <div className="evpath-editor-actions">
        <button type="button" onClick={() => { clearDraft(); setApplyOutcome(undefined); }} disabled={!dirty}>{locale === "es" ? "Revertir" : "Revert"}</button>
        <button type="button" className="primary" onClick={() => {
          if (parseErrors.length) return;
          try {
            const outcome = onApply(eventId, value);
            setApplyOutcome(outcome);
            if (!outcome.errors.length) clearDraft();
          } catch (error) {
            setApplyOutcome({ errors: [{ line: 1, message: error instanceof Error ? error.message : String(error) }], warnings: [] });
          }
        }} disabled={!dirty || parseErrors.length > 0}>{locale === "es" ? "Aplicar" : "Apply"}</button>
      </div>
    </div>
    <div className="evpath-editor-surface">
      <pre ref={backdropRef} className="evpath-editor-backdrop" aria-hidden="true">{value.split("\n").map((line, index) => highlightLine(line, index))}</pre>
      <textarea ref={textareaRef} className="evpath-editor-input" value={value} wrap="off" spellCheck={false} aria-label="Path script" onScroll={syncScroll} onChange={(event) => { setDraft(event.target.value); setApplyOutcome(undefined); }} />
    </div>
    {errors.length > 0 ? <ul className="evpath-editor-errors">{errors.map((error, index) => <li key={index}><b>L{error.line}</b> {error.message}</li>)}</ul> : null}
    {applyOutcome && !applyOutcome.errors.length && applyOutcome.warnings.length > 0 ? <ul className="evpath-editor-warnings">{applyOutcome.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
  </>;
}

export function EvpathEditor({ project, eventId, onApply, sourceOnly = false }: { project: BranchingProject; eventId: string; onApply: (eventId: string, text: string) => EvpathApplyOutcome; sourceOnly?: boolean }) {
  const locale = useInterfaceLocale();
  const serialized = useMemo(() => serializeEventEvpath(project, eventId), [project, eventId]);
  const [mode, setMode] = useState<EvpathEditorMode>("visual");
  const [sourceDirty, setSourceDirty] = useState(false);
  const [modeNotice, setModeNotice] = useState<string>();
  useEffect(() => { setMode("visual"); setSourceDirty(false); setModeNotice(undefined); }, [eventId]);
  const selectMode = (next: EvpathEditorMode) => {
    if (next === "visual" && sourceDirty) {
      setModeNotice(locale === "es" ? "Aplica o revierte el borrador de Source antes de volver al Visual Builder. El borrador se conserva al cerrar el panel." : "Apply or revert the Source draft before returning to Visual Builder. Closing the panel preserves your draft.");
      return;
    }
    setModeNotice(undefined);
    setMode(next);
  };
  const handleModeKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: EvpathEditorMode = event.key === "Home" ? "visual" : event.key === "End" ? "source" : mode === "visual" ? "source" : "visual";
    if (next === "visual" && sourceDirty) { selectMode(next); return; }
    selectMode(next);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[next === "visual" ? 0 : 1]?.focus();
  };
  if (sourceOnly) return <div className="evpath-editor"><EvpathSourceEditor serialized={serialized} projectId={project.projectId} eventId={eventId} onApply={onApply} onDirtyChange={setSourceDirty} /></div>;
  return <div className="evpath-editor">
    <div className="evpath-editor-mode-toggle" role="tablist" aria-label={locale === "es" ? "Modo del editor EVPATH" : "EVPATH editor mode"}>
      <button type="button" role="tab" aria-selected={mode === "visual"} tabIndex={mode === "visual" ? 0 : -1} className={mode === "visual" ? "active" : ""} onKeyDown={handleModeKey} onClick={() => selectMode("visual")}>Visual Builder</button>
      <button type="button" role="tab" aria-selected={mode === "source"} tabIndex={mode === "source" ? 0 : -1} className={mode === "source" ? "active" : ""} onKeyDown={handleModeKey} onClick={() => selectMode("source")}>Source</button>
    </div>
    {modeNotice ? <p className="evpath-editor-mode-notice">{modeNotice}</p> : null}
    {mode === "visual" ? <EvpathVisualBuilder source={serialized} onApply={(text) => onApply(eventId, text)} /> : <EvpathSourceEditor serialized={serialized} projectId={project.projectId} eventId={eventId} onApply={onApply} onDirtyChange={setSourceDirty} />}
  </div>;
}
