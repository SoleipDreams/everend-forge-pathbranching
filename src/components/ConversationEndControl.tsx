import type { BranchingProject } from '../domain.js';
import type { AuthoringMutation } from './AuthoringStudio.js';
import { NarrativeTransitionControl } from './NarrativeTransitionControl.js';

export function ConversationEndControl({project,eventId,dialogueId,selections,onMutation,onNavigate,onExploreRoute,onOpenParent,es}:{project:BranchingProject;eventId:string;dialogueId:string;selections:Record<string,string>;onMutation:AuthoringMutation;onNavigate:(id:string)=>void;onExploreRoute?:(routeId:string)=>void;onOpenParent?:()=>void;es:boolean}) {
  return <NarrativeTransitionControl project={project} eventId={eventId} source={'dialogue:' + eventId + ':' + dialogueId} closingDialogueId={dialogueId} selections={selections} onMutation={onMutation} onNavigate={onNavigate} onExploreRoute={onExploreRoute} onOpenParent={onOpenParent} es={es}/>;
}
