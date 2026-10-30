import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BranchingProject, InteractionMechanicPreset } from '../domain.js';
import { previewInteractionPresetUpdates, type InteractionPresetUpdatePreview } from '../interactionLibrary.js';

export function InteractionPresetUpdateDialog({ project, preset, eventId, useId, locale, onCancel, onRepair, onApply }: {
  project: BranchingProject;
  preset: InteractionMechanicPreset;
  eventId: string;
  useId: string;
  locale: 'es'|'en';
  onCancel:()=>void;
  onRepair: (eventId:string,useId:string)=>void;
  onApply:(uses:Pick<InteractionPresetUpdatePreview,'eventId'|'useId'>[])=>Promise<void>;
}) {
  const es=locale==='es',previews=previewInteractionPresetUpdates(project,preset,es);
  const current=previews.find(item=>item.eventId===eventId&&item.useId===useId),eligible=previews.filter(item=>!item.error);
  const [scope,setScope]=useState<'current'|'all'>('current'),[busy,setBusy]=useState(false),[error,setError]=useState<string>();
  const dialog=useRef<HTMLDivElement>(null),cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;cancel.current?.focus({preventScroll:true});return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  const selected=scope==='current'?(current&&!current.error?[current]:[]):eligible;
  const apply=async()=>{if(!selected.length)return;setBusy(true);setError(undefined);try{await onApply(selected);onCancel();}catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);}};
  return createPortal(<div className="interaction-creation-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel();}}><div ref={dialog} className="interaction-creation-dialog interaction-update-dialog" role="dialog" aria-modal="true" aria-label={es?'Revisar actualización de mecánica':'Review mechanic update'} onKeyDown={event=>{
    if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();onCancel();}
    if(event.key==='Tab'){const fields=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')??[])];const index=fields.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&index===0){event.preventDefault();fields.at(-1)?.focus();}else if(!event.shiftKey&&index===fields.length-1){event.preventDefault();fields[0]?.focus();}}
  }}>
    <h2>{es?'Revisar actualización':'Review update'} · {preset.name}</h2>
    <p>{es?'Revisa los cambios antes de aplicarlos. Los usos conservan sus personajes, variantes, instrucciones, condiciones, efectos y ajustes locales.':'Review changes before applying. Uses keep their characters, variants, prompts, conditions, effects and local settings.'}</p>
    <div className="interaction-update-scope" role="group" aria-label={es?'Interacciones que se actualizarán':'Interactions to update'}><button type="button" disabled={busy||!current||Boolean(current.error)} aria-pressed={scope==='current'} className={scope==='current'?'active':undefined} onClick={()=>setScope('current')}>{es?'Solo esta interacción':'Only this interaction'}</button><button type="button" disabled={busy||!eligible.length} aria-pressed={scope==='all'} className={scope==='all'?'active':undefined} onClick={()=>setScope('all')}>{es?'Todos los usos compatibles de esta historia':'All compatible uses in this story'} ({eligible.length})</button></div>
    {error?<p role="alert" className="authoring-field-error">{error}</p>:null}
    <div className="interaction-update-uses">{previews.map(preview=><section key={`${preview.eventId}:${preview.useId}`} className={`interaction-update-use${preview.error?' blocked':''}`}><header><strong>{preview.name}</strong><small>v{preview.revision} → v{preset.revision}</small></header><p>{preview.location}</p>{preview.error?<><p role="status" className="authoring-field-error">{preview.error}</p><button type="button" disabled={busy} onClick={()=>{onCancel();onRepair(preview.eventId,preview.useId);}}>{es?'Revisar ajustes de esta interacción':'Review this interaction settings'}</button></>:<>{preview.changes.length?<table><thead><tr><th>{es?'Campo':'Field'}</th><th>{es?'Actual':'Current'}</th><th>{es?'Después':'After'}</th></tr></thead><tbody>{preview.changes.map((change,index)=><tr key={index}><th>{change.label}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table>:<p>{es?'La configuración se mantiene; se registra la nueva versión.':'Configuration stays the same; the new version is recorded.'}</p>}<small>{es?'Se conservan':'Preserved'}: {preview.preserved.join(' · ')}</small></>}</section>)}</div>
    {!previews.length?<p role="status">{es?'No hay usos pendientes de actualización.':'No uses await this update.'}</p>:null}
    {previews.some(item=>item.error)?<p>{es?'Los usos con ajustes incompatibles quedan fuera de la actualización hasta que los revises.':'Uses with incompatible settings are excluded until you review them.'}</p>:null}
    <footer><button type="button" ref={cancel} disabled={busy} onClick={onCancel}>{es?'Cancelar':'Cancel'}</button><button type="button" disabled={busy||!selected.length} onClick={()=>void apply()}>{busy?es?'Aplicando…':'Applying…':es?`Aplicar a ${selected.length} ${selected.length===1?'interacción':'interacciones'}`:`Apply to ${selected.length} ${selected.length===1?'interaction':'interactions'}`}</button></footer>
  </div></div>,document.querySelector('.pathbranching-app')??document.body);
}
