import { useState } from 'react';
import { Plus, Split } from 'lucide-react';
import type { BranchingProject, Decision } from '../domain.js';
import { addNarrativeResponse } from '../authoringMutations.js';
import { updateOutcome } from '../projectMutations.js';
import { NarrativeTransitionControl } from './NarrativeTransitionControl.js';
import { NarrativeNameEditor } from './NarrativeNameEditor.js';
import { AuthoringTextField } from './AuthoringTextField.js';
import type { AuthoringMutation } from './AuthoringStudio.js';

export function NarrativeDecisionCard({ project, eventId, decision, selected, selections, onExploreRoute, onSelect, onMutation, onNavigate, es }: { project: BranchingProject; eventId: string; decision: Decision; selected?: string; selections:Record<string,string>; onExploreRoute:(source:string,route:string)=>void; onSelect: (id: string) => void; onMutation: AuthoringMutation; onNavigate: (id:string)=>void; es: boolean }) {
  const [notice, setNotice] = useState<string>(), [busy, setBusy] = useState(false);
  const nodeId = `decision:${eventId}:${decision.id}`;
  const mutate = async (run: (current: BranchingProject) => BranchingProject) => {
    if (busy) return;
    setBusy(true);
    try { await onMutation(run); setNotice(undefined); } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };
  const chosen = decision.outcomes.find(option => option.id === selected);
  const optionNode = chosen ? `outcome:${eventId}:${decision.id}:${chosen.id}` : undefined;
  return <section className="narrative-decision-card" data-authoring-id={nodeId} data-narrative-decision={decision.id} tabIndex={-1}>
    <header><Split size={18} aria-hidden="true" /><strong className="narrative-node-identity"><span>{decision.name}</span><span className="narrative-node-separator" aria-hidden="true">·</span><span className="narrative-node-kind">{es ? 'Decisión' : 'Decision'}</span></strong><NarrativeNameEditor project={project} nodeId={nodeId} onMutation={onMutation}/></header>
    <div className="narrative-decision-options-toolbar">
      <div className="narrative-decision-options" style={{ width: `${Math.min(decision.outcomes.length * 420 + Math.max(0, decision.outcomes.length - 1) * 10, 920)}px` }} role="group" aria-label={es ? 'Opciones de la decisión' : 'Decision options'}>
        {decision.outcomes.map((option,index) => <div className={`narrative-decision-option ${selected === option.id ? 'selected' : ''}`} key={option.id}>
          <button type="button" aria-pressed={selected === option.id} aria-label={`${es ? 'Ver opción' : 'View option'} ${index+1}: ${option.visibleText || option.name}`} onClick={() => onSelect(option.id)}>{String.fromCharCode(65+index)}</button>
          <AuthoringTextField projectId={project.projectId} elementId={option.id} field="response-text" label={`${es ? 'Opción' : 'Option'} ${index+1}`} value={option.visibleText ?? ''} onCommit={visibleText => onMutation(current => updateOutcome(current,eventId,decision.id,option.id,{visibleText}).project)} />
        </div>)}
      </div>
      <button className="narrative-option-add" type="button" aria-label={es ? 'Añadir opción' : 'Add option'} title={es ? 'Añadir opción' : 'Add option'} disabled={busy} onClick={() => { void mutate(current => addNarrativeResponse(current,eventId,decision.id).project); }}><Plus size={16} /></button>
    </div>
    {chosen ? <NarrativeTransitionControl key={optionNode} project={project} eventId={eventId} source={optionNode!} dialogueId={decision.dialogueId} selections={selections} onExploreRoute={route=>onExploreRoute(optionNode!,route)} onMutation={onMutation} onNavigate={onNavigate} es={es}/> : <p className="narrative-muted">{es ? 'Selecciona una opción para ver su continuación.' : 'Select an option to see its continuation.'}</p>}
    {notice ? <p role="alert" className="authoring-field-error">{notice}</p> : null}
  </section>;
}
