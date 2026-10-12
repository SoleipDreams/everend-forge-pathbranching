import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, GitBranch, Plus, Trash2, X } from 'lucide-react';
import type { BranchingProject } from '../domain.js';
import { narrativeDestinationLabels } from '../narrativeNaming.js';
import { NarrativeNameEditor } from './NarrativeNameEditor.js';
import { narrativeNodeReferences } from '../authoringMutations.js';
import { changeReadingContinuation, clearReadingContinuation, finishReadingConversation, type ReadingContinuation } from '../narrativeReadingPath.js';
import type { AuthoringMutation } from './AuthoringStudio.js';

export function NarrativeTransitionControl({project,eventId,source,dialogueId,closingDialogueId,selections={},onMutation,onNavigate,onOpenParent,onExploreRoute,es}:{project:BranchingProject;eventId:string;source:string;dialogueId?:string;closingDialogueId?:string;selections?:Record<string,string>;onMutation:AuthoringMutation;onNavigate:(id:string)=>void;onOpenParent?:()=>void;onExploreRoute?:(id:string)=>void;es:boolean}) {
  const [open,setOpen]=useState(false),[kind,setKind]=useState<ReadingContinuation['kind']>(dialogueId?'speech':'dialogue'),[target,setTarget]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState<string>();
  const trigger=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));};
  const event=project.events.find(event=>event.id===eventId)!;
  const refs=narrativeNodeReferences(project,eventId);
  const options=kind==='subevent' ? project.events.filter(child=>child.parentEventId===eventId || event.childEventIds?.includes(child.id)).map(child=>({id:child.id,label:child.name})) : refs.filter(ref=>ref.kind===kind && ref.dialogueId===dialogueId && ref.id!==source);
  const routes=event.transitions?.filter(route=>route.from===source)??[];
  const optionLabels=narrativeDestinationLabels(project,options,es?'es':'en');
  const destination=routes.length===1 ? routes[0].to : undefined;
  const endsScene=destination===`dialogue-boundary:${eventId}:${dialogueId}:output` || destination===`boundary:${eventId}:output:exit`;
  const destinationName=refs.find(ref=>ref.id===destination)?.label ?? project.events.find(child=>child.id===destination)?.name;
  const selectedRouteId=selections[`route:${source}`];
  const routeOptions=routes.map((route,index)=>{
    const destinationLabel=refs.find(ref=>ref.id===route.to)?.label ?? project.events.find(child=>child.id===route.to)?.name;
    return { route, index, label:route.label?.trim() || destinationLabel || (es?`Ruta ${index+1}`:`Route ${index+1}`) };
  });
  const refKind=refs.find(ref=>ref.id===destination)?.kind;
  const destinationKind:ReadingContinuation['kind']=refKind && refKind!=='outcome' ? refKind : project.events.some(child=>child.id===destination) ? 'subevent' : dialogueId?'speech':'dialogue';
  const labels={dialogue:es?'Conversación':'Conversation',subevent:es?'Subevento':'Subevent',decision:es?'Decisión':'Decision',speech:es?'Diálogo':'Dialogue',direction:es?'Acotación':'Stage direction'};
  const kinds:ReadingContinuation['kind'][]=dialogueId ? ['speech','direction','decision'] : ['dialogue','subevent','decision'];
  if(destinationName && !kinds.includes(destinationKind))kinds.push(destinationKind);
  const remove=async()=>{
    if(busy)return;setBusy(true);
    try {await onMutation(current=>{const result=clearReadingContinuation(current,eventId,source);if(result.project===current)throw new Error(result.message);return result.project;});setTarget('');setNotice(undefined);}
    catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  };
  const finish=async (create=false)=>{
    if(busy || (!create && !target))return;
    setBusy(true);
    try {
      await onMutation(current=>{const result=closingDialogueId ? finishReadingConversation(current,eventId,closingDialogueId,{kind,id:create?undefined:target},selections) : changeReadingContinuation(current,eventId,source,dialogueId,{kind,id:create?undefined:target});if(result.project===current)throw new Error(result.message);return result.project;});
      close();setNotice(undefined);
    }catch(error){setNotice(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  };
  return <footer className="conversation-end-control narrative-transition-control" data-transition-source={source}>
    {closingDialogueId && routes.length ? <div className="narrative-scene-end"><span>{es?'Fin de la escena':'End of scene'}</span></div> : null}
    {routes.length>1 ? <section className="narrative-route-choice-card" aria-label={es?'Ruta narrativa':'Narrative route'}>
      <header><GitBranch size={17} aria-hidden="true"/><strong>{es?'Ruta':'Route'}</strong></header>
      <div className="narrative-route-choice-options" role="group" aria-label={es?'Opciones de ruta':'Route options'}>
        {routeOptions.map(({route,index,label})=><button key={route.id} type="button" className={selectedRouteId===route.id?'selected':''} aria-pressed={selectedRouteId===route.id} onClick={()=>onExploreRoute?.(route.id)}>
          <span className="narrative-route-choice-key">{String.fromCharCode(65+index)}</span><span>{label}</span>
        </button>)}
      </div>
    </section> : <button ref={trigger} type="button" disabled={busy} aria-label={es?'Elegir transición narrativa':'Choose narrative transition'} aria-expanded={open} onClick={()=>{if(!open){setKind(destinationKind);setTarget(destinationName?destination??'':'');}setOpen(!open);}}>{destinationName ? labels[destinationKind] : endsScene ? (es?'Fin de la escena':'End of scene') : (es?'Añadir transición':'Add transition')}<ChevronDown size={14}/></button>}
    {open && routes.length<=1 ? <div className="conversation-end-picker" role="group" aria-label={es?'Continuar la secuencia narrativa':'Continue narrative sequence'} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
      <div className="conversation-kind" role="group" aria-label={es?'Tipo de continuación':'Continuation type'}>{kinds.map(type=><button type="button" key={type} aria-pressed={kind===type} onClick={()=>{setKind(type);setTarget('');}}>{labels[type]}</button>)}</div>
      <div className="narrative-destination-name"><label>{es?'Continuar con un elemento existente':'Continue with an existing item'}<select aria-label={es?'Elemento de continuación':'Continuation item'} value={target} disabled={busy} onChange={event=>setTarget(event.target.value)}><option value="">{es?'Seleccionar…':'Select…'}</option>{options.map(item=><option key={item.id} value={item.id}>{optionLabels.get(item.id)}</option>)}</select></label>{target ? <NarrativeNameEditor key={target} project={project} nodeId={target} onMutation={onMutation}/> : null}</div>
      <div className="conversation-end-actions"><button type="button" disabled={busy || routes.length>1 || !options.some(option=>option.id===target)} onClick={()=>{void finish();}}><ArrowRight size={14}/>{es?'Aplicar transición':'Apply transition'}</button><button type="button" disabled={busy || routes.length>1} onClick={()=>{void finish(true);}}><Plus size={14}/>{es?'Crear y continuar':'Create and continue'}</button>{destination ? <button type="button" disabled={busy} onClick={()=>{void remove();}}><Trash2 size={14}/>{es?'Quitar transición':'Remove transition'}</button> : null}{destinationName ? <button type="button" onClick={()=>onNavigate(destination!)}>{es?'Ir al destino':'Go to destination'}</button> : null}<button type="button" aria-label={es?'Cerrar selector de transición':'Close transition selector'} disabled={busy} onClick={close}><X size={14}/></button></div>
    </div> : null}
    {closingDialogueId && destination && destinationName && onOpenParent ? <div className="conversation-sequence-navigation" role="group" aria-label={es?'Navegar por la conversación':'Navigate the conversation'}>
      <button type="button" onClick={onOpenParent}><ArrowUp size={14} aria-hidden="true"/>{es?'Ver conversación completa':'View full conversation'}</button>
      <button type="button" title={(es?'Siguiente inspector':'Next inspector')+' · '+destinationName} onClick={()=>onNavigate(destination)}><ArrowRight size={14} aria-hidden="true"/>{es?'Siguiente inspector':'Next inspector'}<span aria-hidden="true"> · {destinationName}</span></button>
    </div> : null}
    {notice ? <p role="alert" className="authoring-field-error">{notice}</p> : null}
    {destinationName || routes.some(route=>route.id===selectedRouteId) ? <ArrowDown size={26} aria-hidden="true"/> : null}
  </footer>;
}
