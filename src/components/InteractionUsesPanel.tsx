import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import type { BranchingProject, LogicSubject } from '../domain.js';
import { entityDefinition } from '../authoringEntities.js';
import { authoringNodeOptions } from '../authoringMutations.js';
import { interactionNodeId } from '../interactions.js';
import { canonVariantsForRef } from '../worldnotionVariants.js';
import { useInterfaceLocale } from '../i18n.js';
import { InteractionsEditor } from './InteractionsEditor.js';
import '../interactionLibrary.css';

/** A compact story catalog; configuration gets room for the participant rows. */
export function InteractionUsesPanel({project,currentEventId,onUpdate,onInspect}: {
  project:BranchingProject; currentEventId?:string; onUpdate:(project:BranchingProject)=>void; onInspect:(id:string)=>void;
}) {
  const es=useInterfaceLocale()==='es', [search,setSearch]=useState('');
  const [editing,setEditing]=useState<{eventId:string;useId?:string}>();
  const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const nodes=authoringNodeOptions(project);
  const name=(subject:LogicSubject):string=>{
    if(subject.kind==='context')return es?{actor:'Actor actual',self:'Este personaje',target:'Destinatario'}[subject.role]:subject.role;
    const copy=subject.kind==='instance'?project.entityInstances?.find(item=>item.id===subject.instanceId):undefined;
    const entityId=subject.kind==='entity'?subject.entityId:copy?.entityId;
    const ref=project.canonRefs.find(item=>item.id===entityId);
    const variantId=subject.kind==='entity'?subject.variantId:copy?.variantId;
    const variant=ref&&variantId&&variantId!=='base'?canonVariantsForRef(ref).find(item=>item.id===variantId)?.label:undefined;
    return [copy?.name??(entityId?entityDefinition(project,entityId)?.name:undefined)??(es?'Referencia no disponible':'Reference unavailable'),variant,copy?(es?'Copia':'Copy'):undefined].filter(Boolean).join(' · ');
  };
  const uses=project.events.flatMap(event=>(event.interactionUses??[]).map(use=>{
    const definition=event.interactionDefinitions?.find(item=>item.id===use.definitionId), m=definition?.mechanic;
    const kind=m?.kind==='opposedcheck'||m?.kind==='skillcheck'?(es?'Prueba de habilidad':'Skill check'):m?.kind==='dice'?(es?'Dados':'Dice'):m?.kind==='qte'?'QTE':es?'Personalizada':'Custom';
    const participants=m?.kind==='opposedcheck'?`${name(m.actor.subject)} → ${m.rivals.map(rival=>name(rival.subject)).join(', ')}`:m?.kind==='skillcheck'?`${m.skill?.kind==='property'?name(m.skill.subject):m.skill?.kind==='variable'?(es?'Variable de la historia':'Story variable'):(es?'Solo dados':'Dice only')} → ${es?'El mundo':'World'}`:'';
    const location=[event.name,event.dialogues?.find(item=>item.id===use.dialogueId)?.title,nodes.find(item=>item.id===use.ownerNodeId)?.label].filter(Boolean).join(' › ');
    return {event,use,definition,kind,participants,location};
  })).filter(item=>normalize([item.definition?.name,item.location,item.kind,item.participants].join(' ')).includes(normalize(search)))
    .sort((a,b)=>Number(b.event.id===currentEventId)-Number(a.event.id===currentEventId));
  return <section className="interaction-uses" aria-label={es?'Usos en la historia':'Story uses'}>
    <label className="explorer-search"><Search size={14}/><input type="search" value={search} aria-label={es?'Buscar usos de interacciones':'Search interaction uses'} placeholder={es?'Nombre, escena o personaje…':'Name, scene or character…'} onChange={event=>setSearch(event.target.value)}/></label>
    {currentEventId?<button type="button" onClick={()=>setEditing({eventId:currentEventId})}>{es?'Administrar interacciones de esta escena':'Manage interactions in this scene'}</button>:null}
    <div className="interaction-use-list">{uses.map(item=><button type="button" key={item.use.id} onClick={()=>setEditing({eventId:item.event.id,useId:item.use.id})}>
      <strong>{item.definition?.name??(es?'Referencia no disponible':'Reference unavailable')}</strong>
      <span>{item.location}</span><span>{item.kind} · {es?{before:'Antes',during:'Durante',after:'Después'}[item.use.moment]:item.use.moment}</span>
      {item.participants?<small>{item.participants}</small>:null}
    </button>)}</div>
    {!uses.length?<p>{es?'No hay interacciones en esta búsqueda. Puedes crearlas desde el canvas o desde una condición.':'No interactions match. Create one from the canvas or from a condition.'}</p>:null}
    {editing?<InteractionUseDialog key={`${project.projectId}:${editing.eventId}:${editing.useId??'scene'}`} project={project} {...editing} onUpdate={onUpdate} onClose={()=>setEditing(undefined)} onInspect={id=>{setEditing(undefined);onInspect(id);}}/>:null}
  </section>;
}

function InteractionUseDialog({project,eventId,useId,onUpdate,onClose,onInspect}:{project:BranchingProject;eventId:string;useId?:string;onUpdate:(project:BranchingProject)=>void;onClose:()=>void;onInspect:(id:string)=>void}) {
  const es=useInterfaceLocale()==='es', dialog=useRef<HTMLDivElement>(null), close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  const host=document.querySelector('.pathbranching-app')??document.body;
  const event=project.events.find(item=>item.id===eventId),use=event?.interactionUses?.find(item=>item.id===useId);
  const definition=event?.interactionDefinitions?.find(item=>item.id===use?.definitionId);
  const title=definition?.name??event?.name??(es?'Interacciones':'Interactions');
  return createPortal(<div className="interaction-creation-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}><div ref={dialog} className="interaction-creation-dialog interaction-use-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab') {const fields=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')??[])].filter(item=>item.getClientRects().length>0);const current=fields.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&current===0){event.preventDefault();fields.at(-1)?.focus();}else if(!event.shiftKey&&current===fields.length-1){event.preventDefault();fields[0]?.focus();}}
  }}><header><h2>{title}</h2><button ref={close} type="button" aria-label={es?'Cerrar configuración de interacción':'Close interaction configuration'} onClick={onClose}><X size={18}/></button></header>
    <InteractionsEditor project={project} eventId={eventId} hideCreation={Boolean(useId)} ownerNodeId={useId?interactionNodeId(eventId,useId):eventId} onMutation={mutate=>onUpdate(mutate(project))} onSelect={onInspect}/>
  </div></div>,host);
}
