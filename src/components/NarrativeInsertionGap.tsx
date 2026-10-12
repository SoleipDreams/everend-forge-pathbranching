import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Plus } from 'lucide-react';
import { ConversationLineMenu } from './ConversationLineMenu.js';

/** A short stationary hover reveals insertion and expands its gap together. */
export function NarrativeInsertionGap({ label, options, variant }: {label:string; options:{label:string;disabled?:boolean;run:()=>void}[]; variant?:'sequence' }) {
  const [visible,setVisible]=useState(false);
  const resting=useRef<{x:number;y:number} | undefined>(undefined);
  const timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel=()=>{clearTimeout(timer.current);timer.current=undefined;};
  const intend=(event:PointerEvent<HTMLDivElement>)=>{
    if(visible)return;
    const point={x:event.clientX,y:event.clientY};
    if(timer.current && resting.current && Math.hypot(point.x-resting.current.x,point.y-resting.current.y)<4)return;
    cancel();resting.current=point;
    timer.current=setTimeout(()=>{timer.current=undefined;setVisible(true);},300);
  };
  useEffect(()=>()=>cancel(),[]);
  return <div className={`narrative-insertion-gap ${variant==='sequence'?'narrative-insertion-gap-sequence':''} ${visible?'revealed':''}`} data-insertion-gap onPointerEnter={intend} onPointerMove={intend} onPointerLeave={event=>{cancel();resting.current=undefined;if(event.currentTarget.querySelector('[aria-expanded="true"]'))return;setVisible(false);}} onFocus={()=>{cancel();setVisible(true);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null))setVisible(false);}}>
    <ConversationLineMenu label={label} icon={<Plus size={16} aria-hidden="true"/>} options={options}/>
  </div>;
}
