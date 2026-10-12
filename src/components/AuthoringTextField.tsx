import { useEffect, useId, useRef, useState } from "react";
import { authoringDraftKey, getAuthoringDraft } from "../authoringDrafts.js";
import { useInterfaceLocale } from "../i18n.js";
import { useAuthoringDraft } from "./useAuthoringDraft.js";

export type AuthoringTextFieldProps = {
  projectId: string; elementId: string; field: string; label: string; value: string;
  onCommit: (value: string) => void | Promise<void>;
  validate?: (value: string) => string | undefined;
  multiline?: boolean; rows?: number; placeholder?: string; inputType?: "text" | "date";
  disabled?: boolean; onFocus?: () => void;
  /** Keep the recoverable draft local while editing; write it only after the field loses focus. */
  commitOnBlurOnly?: boolean;
  /** Opt-in conversation behavior; every other multiline authoring field keeps Enter as a newline. */
  onSubmitLine?: () => void | Promise<void>;
};

/** Incomplete input survives panel unmounts; fields can commit after 500 ms or opt into blur-only saving. */
export function AuthoringTextField({ projectId, elementId, field, label, value: saved, onCommit, validate, multiline, rows = 3, placeholder, inputType = "text", disabled, onFocus, onSubmitLine, commitOnBlurOnly = false }: AuthoringTextFieldProps) {
  const locale = useInterfaceLocale();
  const key = authoringDraftKey(projectId, elementId, field);
  const [value, setValue, clearDraft] = useAuthoringDraft(key, saved);
  const [commitError, setCommitError] = useState<string>();
  const id = useId();
  const latest = useRef({ value, saved, onCommit, validate, clearDraft, key, disabled });
  latest.current = { value, saved, onCommit, validate, clearDraft, key, disabled };
  const committing = useRef<{value: string; promise: Promise<boolean>} | undefined>(undefined);
  const commit = async () => {
    const current = latest.current;
    if (current.disabled || current.validate?.(current.value)) return false;
    if (committing.current?.value === current.value) return committing.current.promise;
    if (current.value === current.saved) return true;
    const written = current.value;
    const promise = (async () => { try {
      await current.onCommit(written);
      if (getAuthoringDraft(current.key) === written) current.clearDraft();
      setCommitError(undefined);
      return true;
    } catch (error) { setCommitError(error instanceof Error ? error.message : String(error)); return false; }
    finally { if (committing.current?.value === written) committing.current = undefined; } })();
    committing.current = {value: written, promise};
    return promise;
  };
  useEffect(() => {
    if (value === saved) { clearDraft(); return; }
    if (disabled || commitOnBlurOnly) return;
    const timer = setTimeout(() => { void commit(); }, 500);
    return () => clearTimeout(timer);
  }, [key, value, saved, disabled, commitOnBlurOnly]);
  const error = validate?.(value) ?? commitError;
  const attributes = { id, value, placeholder, disabled, onFocus, "aria-labelledby": `${id}-label`, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValue(event.target.value); setCommitError(undefined); }, onBlur: () => { void commit(); }, onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (onSubmitLine && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.nativeEvent.isComposing) { event.preventDefault(); void commit().then(ok => { if (ok) return onSubmitLine(); }); } } };
  return <label className="authoring-text-field" htmlFor={id}><span id={`${id}-label`}>{label}</span>
    {multiline ? <textarea {...attributes} rows={rows} /> : <input {...attributes} type={inputType} />}
    {error ? <span id={`${id}-error`} className="authoring-field-error" role="alert">{error}</span> : value !== saved ? <small>{locale === "es" ? "Borrador recuperable" : "Recoverable draft"}</small> : null}
  </label>;
}
