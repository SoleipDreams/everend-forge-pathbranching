import type { BranchingProject, ConditionInput, LogicPredicate, LogicMoment, Consequence, Transition } from './domain.js';
import type { InkProjectExport } from './exportFormats.js';
import { combineConditions, conditionStructureIssues, conditionValueMatchesType, conditionValueType, effectiveConditions, resolveConditionValue } from './conditionEvaluation.js';
import { migrateConditionInput, migrateConsequence, orderedTransitions } from './logic.js';

/** Injective symbols: punctuation and Unicode IDs cannot alias each other. */
export const inkSymbol = (id: string) => `pb_${Array.from(id).map(c=>c.codePointAt(0)!.toString(16)).join('_')}`;
export const inkConditionKey = (p: LogicPredicate) => {
  const s=p.subject;
  const id=s.kind==='entity'?s.entityId:s.kind==='variable'?s.variableId:s.kind==='dataObject'?s.objectId:s.kind==='progress'?`${s.targetType}:${s.targetId}`:s.kind==='instance'?s.instanceId:s.kind==='context'?s.role:s.functionId;
  return JSON.stringify([s.kind,id,p.type,p.type==='property'?p.propertyId:p.type==='state'?p.stateId:'']);
};
const literal = (v: unknown, type?: string): string => type==='date' ? String(Number(String(v).replaceAll('-',''))) : JSON.stringify(v);
const text = (s: string) => s.replace(/[\\{}\[\]#*+~<>|]/g,'\\$&').replace(/^(\s*)[-=]/gm,'$1\\$&');

export function exportInkProject(project: BranchingProject): InkProjectExport {
  const diagnostics: NonNullable<InkProjectExport['diagnostics']> = [];
  const declarations = new Map<string,string>(), symbols: Record<string,string> = {};
  const block = (location:string,message:string): never => { throw new Error(`${location}\n${message}`); };
  const capture = (location:string, fn:()=>string[]): string[] => {
    try { return fn(); } catch(error) { diagnostics.push({location,message:error instanceof Error?error.message:String(error)}); return []; }
  };
  function variable(p: LogicPredicate, location:string) {
    if(p.subject.kind==='progress' && p.subject.targetType!=='event') block(location,'Only event visits are supported in this Ink profile.');
    if(p.type==='external') block(location,'External conditions require an Ink binding; export blocked.');
    const resolved=resolveConditionValue(p,project,{}), type=conditionValueType(p,project);
    if(resolved.error || resolved.unresolved) block(location,resolved.error ?? resolved.unresolved!);
    const value=resolved.value;
    if(Array.isArray(value) || ['list','multiselect','entity-ref-list'].includes(type ?? '')) block(location,'List conditions/effects have no faithful Ink representation in this profile.');
    if(value!==undefined && value!==null && !conditionValueMatchesType(value,type)) block(location,'Authored value does not match its declared type.');
    const key=inkConditionKey(p), name=inkSymbol(key), defined=`${name}_defined`;
    symbols[key]=name;
    declarations.set(name,`VAR ${name} = ${value===undefined || value===null ? (type==='boolean'?'false':type==='text' || type==='canonRef'?'""':'0') : literal(value,type)}`);
    declarations.set(defined,`VAR ${defined} = ${value!==undefined && value!==null}`);
    return {name,defined,type,value};
  }
  function condition(input:ConditionInput|undefined, location:string):string {
    const issues=conditionStructureIssues(input); if(issues.length) block(location,issues.map(i=>i.message).join('; '));
    const root=migrateConditionInput(input,project.logicVariables ?? []);
    function render(x:typeof root):string {
      if(x===undefined || Array.isArray(x) && !x.length) return '1 == 1';
      if(Array.isArray(x)) return `(${x.map(render).join(' && ')})`;
      if('all' in x) return `(${(x.all as ConditionInput[]).map(render).join(' && ')})`;
      if('any' in x) return `(${(x.any as ConditionInput[]).map(render).join(' || ')})`;
      if('not' in x) return `(!${render(x.not as ConditionInput)})`;
      if(!('subject' in x)) block(location,'Unrecognized legacy condition.');
      const p=x as LogicPredicate, {name,defined,type,value}=variable(p,location), op=p.operator;
      if(op==='exists') return defined;
      if(op==='missing' && !['state','visited','external'].includes(p.type)) return `(!${defined})`;
      if(op==='has' || op==='missing') {
        if(typeof value!=='boolean') block(location,'Boolean state required.');
        return `(${name} == ${op==='has'?'true':'false'})`;
      }
      const right='value' in p?p.value:undefined;
      if(value===undefined || value===null) block(location,'Comparison reads an undefined value; Ink cannot preserve unresolved routing.');
      if(!conditionValueMatchesType(right,type) || typeof value!==typeof right) block(location,'Comparison operands have incompatible types.');
      if(['contains','notContains'].includes(op)) block(location,'Text/list containment is unsupported by this Ink profile.');
      if(!['==','!=','>','>=','<','<='].includes(op)) block(location,`Unsupported operator ${op}`);
      if(['>','>=','<','<='].includes(op) && type!=='date' && typeof value!=='number') block(location,'Ordered comparisons require numbers or ISO dates.');
      return `(${name} ${op} ${literal(right,type)})`;
    }
    return render(root);
  }
  function effects(items:Consequence[]|undefined, location:string):string[] {
    // Guards are captured before effects, matching resolveConsequences' snapshot.
    const gates=(items ?? []).map((item,i)=>'conditions' in item && item.conditions ? {id:inkSymbol(`${location}:gate:${i}`),condition:condition(item.conditions,location)}:undefined);
    const lines:string[]=[];
    gates.forEach(g=>{if(g){declarations.set(g.id,`VAR ${g.id} = false`);lines.push(`~ ${g.id} = ${g.condition}`);}});
    (items ?? []).forEach((item,i)=>{
      const e=migrateConsequence(item,project.logicVariables ?? []);
      if(e.type==='external' || e.subject.kind==='dataObject') block(location,'External/object effects require an unsupported Ink binding.');
      const p={...e,operator:'=='} as unknown as LogicPredicate;
      const {name,defined,type,value}=variable(p,location);
      let rhs:string;
      if(['grant','unlock','discover','enter'].includes(e.operation)) rhs='true';
      else if(['ungrant','lock','hide','leave'].includes(e.operation)) rhs='false';
      else if(e.operation==='toggle' && typeof value==='boolean') rhs=`!${name}`;
      else if(e.operation==='clear') block(location,'Clear effects can make subsequent routing unresolved; Ink export blocked.');
      else if(e.operation==='set' && 'value' in e && conditionValueMatchesType(e.value,type)) rhs=literal(e.value,type);
      else if(['add','subtract'].includes(e.operation) && 'value' in e && typeof value==='number' && typeof e.value==='number' && Number.isFinite(e.value)) rhs=`${name} ${e.operation==='add'?'+':'-'} ${e.value}`;
      else block(location,`Unsupported or incompatible effect ${e.operation}`);
      const assignment=[`~ ${name} = ${rhs!}`,`~ ${defined} = true`];
      lines.push(...(gates[i]?[`{ ${gates[i]!.id}:`,...assignment,'}']:assignment));
    });
    return lines;
  }
  function moment(owner:{logic?:LogicMoment;consequences?:Consequence[]},location:string):string[] {
    const rules=owner.logic?.rules ?? [];
    const gates=rules.map((rule,i)=>({id:inkSymbol(`${location}:rule:${i}`),condition:condition(rule.when,location)}));
    gates.forEach(g=>declarations.set(g.id,`VAR ${g.id} = false`));
    return [...gates.map(g=>`~ ${g.id} = ${g.condition}`),...effects(owner.logic?.then ?? owner.consequences,location),...rules.flatMap((rule,i)=>[`{ ${gates[i].id}:`,...effects(rule.then,location),'}'])];
  }
  const targets = new Set(project.events.map(e=>e.id));
  function routes(input:Transition[],location:string):string[] {
    if(input.filter(t=>t.mode==='fallback').length>1) block(location,'Duplicate Else routes.');
    const lines:string[]=[];
    for(const route of orderedTransitions(input)) {
      if(!targets.has(route.to)) block(location,`Destination ${route.to} requires unsupported internal-node execution.`);
      const guard=condition(effectiveConditions(route),`${location}/${route.id}`);
      lines.push(`{ ${guard}:`,...moment(route,`${location}/${route.id}`),`-> ${inkSymbol(route.to)}`,'}');
    }
    return [...lines,'-> DONE'];
  }
  const knots=project.events.flatMap(event=>capture(event.id,()=>{
    if(event.dialogues?.length || event.dialogueBeats?.length || event.dialogueStarts?.length || event.script?.entrySection) block(event.id,'Dialogue/script execution is unsupported by this Ink profile.');
    const inherited=combineConditions(...project.sequences.filter(s=>s.eventIds.includes(event.id)).map(effectiveConditions),...project.branches.filter(b=>b.eventIds.includes(event.id)).map(effectiveConditions),effectiveConditions(event));
    const visit=variable({type:'visited',subject:{kind:'progress',targetType:'event',targetId:event.id},operator:'has'},event.id).name;
    const lines=[`=== ${inkSymbol(event.id)} ===`,`{ (!(${condition(inherited,event.id)})): -> DONE }`,...moment(event,event.id),`~ ${visit} = true`,text(event.text?.content || event.name)];
    const decisions=event.decisions ?? [];
    if(decisions.length && (event.transitions ?? []).some(t=>t.from===event.id)) block(event.id,'Competing automatic routes and choices need an explicit execution policy.');
    for(const decision of decisions) for(const outcome of decision.outcomes) {
      const location=`${event.id}/${decision.id}/${outcome.id}`;
      if(decision.logic?.then?.length || decision.logic?.rules?.length) block(location,'Decision container effects require unsupported execution semantics.');
      const guard=condition(combineConditions(effectiveConditions(decision),effectiveConditions(outcome)),location);
      if(guard!=='1 == 1' && outcome.unavailableBehavior!=='hidden') block(location,'Ink cannot display locked choices; choose hidden availability or another export.');
      lines.push(`* { ${guard} } [${text(outcome.visibleText?.trim() || outcome.name)}]`,...moment(outcome,location).map(l=>`  ${l}`),...routes((event.transitions ?? []).filter(t=>t.from===`outcome:${event.id}:${decision.id}:${outcome.id}`),location).map(l=>`  ${l}`));
    }
    if(!decisions.length) lines.push(...routes((event.transitions ?? []).filter(t=>t.from===event.id),event.id));
    else lines.push('* -> DONE');
    return [...lines,''];
  }));
  // Sequence/branch entry consequences have no executable counterpart yet.
  for(const owner of [...project.sequences,...project.branches]) if(owner.logic?.then?.length || owner.logic?.rules?.length || owner.consequences?.length) diagnostics.push({location:owner.id,message:'Container entry effects are unsupported in Ink.'});
  const sequence=project.sequences.find(s=>s.id===project.entrySequenceId) ?? project.sequences[0];
  const entry=sequence?.entryEventId ?? project.events[0]?.id;
  if(!entry || !targets.has(entry)) diagnostics.push({location:'entry',message:'Missing entry event.'});
  return {format:'ink',diagnostics,symbols,files:diagnostics.length?[]:[{path:'story.ink',content:['// Generated by Everend PathBranching',...declarations.values(),`-> ${inkSymbol(entry!)}`,'',...knots].join('\n')+'\n'}]};
}

