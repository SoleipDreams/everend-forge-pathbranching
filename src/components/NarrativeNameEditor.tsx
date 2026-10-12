import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import type { BranchingProject } from '../domain.js';
import { automaticNameForNode, narrativeNameTarget } from '../narrativeNaming.js';
import { renameNarrativeNode } from '../narrativeNameEditing.js';
import { useInterfaceLocale } from '../i18n.js';
import type { AuthoringMutation } from './AuthoringStudio.js';
import { useOverlayFocus } from './useOverlayFocus.js';

export function NarrativeNameEditor({ project, nodeId, onMutation }: { project: BranchingProject; nodeId: string; onMutation: AuthoringMutation }) {
  const locale = useInterfaceLocale(), es = locale === 'es';
  const target = narrativeNameTarget(project, nodeId);
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false), [value, setValue] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const close = () => { if (busy) return; setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  useOverlayFocus(dialog, open, close, true, 'input');
  if (!target) return null;
  const save = async () => {
    if (busy) return;
    if (!value.trim()) { setError(es ? 'Escribe un nombre.' : 'Enter a name.'); return; }
    setBusy(true);
    try {
      await onMutation(current => renameNarrativeNode(current, nodeId, value));
      setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <>
    <button ref={trigger} type="button" className="narrative-name-pencil" aria-label={`${es ? 'Renombrar' : 'Rename'} ${target.name}`} title={es ? 'Cambiar nombre' : 'Change name'} onClick={() => { setValue(target.name); setError(undefined); setOpen(true); }}><Pencil size={14} aria-hidden="true" /></button>
    {open ? createPortal(<div className="modal-backdrop narrative-name-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} className="modal-dialog narrative-name-dialog" role="dialog" aria-modal="true" aria-label={es ? 'Cambiar nombre narrativo' : 'Change narrative name'} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.target instanceof HTMLInputElement) { event.preventDefault(); event.stopPropagation(); void save(); } if (event.key === 'Escape') event.stopPropagation(); }}>
        <h2>{es ? 'Cambiar nombre' : 'Change name'}</h2>
        <label>{es ? 'Nombre' : 'Name'}<input value={value} disabled={busy} aria-invalid={Boolean(error)} onChange={event => { setValue(event.target.value); setError(undefined); }} /></label>
        {error ? <p role="alert" className="authoring-field-error">{error}</p> : null}
        <button type="button" disabled={busy} onClick={() => { setValue(automaticNameForNode(project, nodeId, locale) ?? target.name); setError(undefined); }}>{es ? 'Usar nombre automático' : 'Use automatic name'}</button>
        <div className="inspector-actions"><button type="button" disabled={busy} onClick={close}>{es ? 'Cancelar' : 'Cancel'}</button><button type="button" disabled={busy} onClick={() => { void save(); }}>{es ? 'Guardar' : 'Save'}</button></div>
      </section>
    </div>, trigger.current?.closest('.pathbranching-app') ?? document.body) : null}
  </>;
}
