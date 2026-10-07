import { useEffect, useId, useRef, useState } from "react";
import { authoringDraftKey, getAuthoringDraft } from "../authoringDrafts.js";
import { useInterfaceLocale } from "../i18n.js";
import { useAuthoringDraft } from "./useAuthoringDraft.js";

export type AuthoringTextFieldProps = {
  projectId: string; elementId: string; field: string; label: string; value: string;
  onCommit: (value: string) => void | Promise<void>;
  validate?: (value: string) => string | undefined;
  multiline?: boolean; rows?: number; placeholder?: string; inputType?: "text" | "date";
};

/** Incomplete input survives panel unmounts; successful edits commit after 500 ms or blur. */
export function AuthoringTextField({ projectId, elementId, field, label, value: saved, onCommit, validate, multiline, rows = 3, placeholder, inputType = "text" }: AuthoringTextFieldProps) {
  const locale = useInterfaceLocale();
  const key = authoringDraftKey(projectId, elementId, field);
  const [value, setValue, clearDraft] = useAuthoringDraft(key, saved);
  const [commitError, setCommitError] = useState<string>();
  const id = useId();
  const latest = useRef({ value, saved, onCommit, validate, clearDraft, key });
  latest.current = { value, saved, onCommit, validate, clearDraft, key };
  const committing = useRef<string | undefined>(undefined);
  const commit = async () => {
    const current = latest.current;
    if (current.value === current.saved || current.validate?.(current.value) || committing.current === current.value) return;
    const written = current.value;
    committing.current = written;
    try {
      await current.onCommit(written);
      if (getAuthoringDraft(current.key) === written) current.clearDraft();
      setCommitError(undefined);
    } catch (error) { setCommitError(error instanceof Error ? error.message : String(error)); }
    finally { if (committing.current === written) committing.current = undefined; }
  };
  useEffect(() => {
    if (value === saved) { clearDraft(); return; }
    const timer = setTimeout(() => { void commit(); }, 500);
    return () => clearTimeout(timer);
  }, [key, value, saved]);
  const error = validate?.(value) ?? commitError;
  const attributes = { id, value, placeholder, "aria-labelledby": `${id}-label`, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValue(event.target.value); setCommitError(undefined); }, onBlur: () => { void commit(); } };
  return <label className="authoring-text-field" htmlFor={id}><span id={`${id}-label`}>{label}</span>
    {multiline ? <textarea {...attributes} rows={rows} /> : <input {...attributes} type={inputType} />}
    {error ? <span id={`${id}-error`} className="authoring-field-error" role="alert">{error}</span> : value !== saved ? <small>{locale === "es" ? "Borrador recuperable" : "Recoverable draft"}</small> : null}
  </label>;
}
