import { ConditionTester } from "./ConditionTester.js";
import { retargetCondition } from "../conditionEditing.js";
import { conditionValueMatchesType, conditionStructureIssues, evaluateConditionDetailed } from "../conditionEvaluation.js";
import { CircleAlert, GitBranch, Plus, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  BranchingProject,
  ConditionExpression,
  ConditionInput,
  Consequence,
  LogicEffect,
  LogicEffectOperation,
  LogicPredicate,
  LogicSubject,
  LogicMoment,
} from "../domain.js";
import { asConditionExpressions, isConditionSet, migrateConditionInput, migrateConsequence } from "../logic.js";
import { grantableEntities } from "../explorerSchema.js";
import {
  LOGIC_COMPARISON_OPERATORS as comparisonOperators,
  logicEffectFor as effectFor,
  logicEffectOperations as effectOperations,
  logicFieldOptions as fieldOptions,
  logicOperatorsFor as operatorsFor,
  logicPredicateFor as predicateFor,
  resolveLogicField,
  logicSubjectKey as subjectKey,
  logicSubjectOptions as subjectOptions,
  type LogicSubjectOption as SubjectOption,
  type LogicFieldOption,
  type LogicPresentation,
} from "../logicCapabilities.js";

type LogicComposerProps = {
  project: BranchingProject;
  contextEntityIds?: string[];
  compact?: boolean;
};

function valueEditor(value: unknown, valueType: string | undefined, onChange: (value: unknown) => void) {
  if (valueType === "boolean") {
    return <select value={value===undefined?"":String(value)} onChange={(event) => onChange(event.target.value === "true")}><option value="">Choose a boolean value</option><option value="true">true</option><option value="false">false</option></select>;
  }
  if (valueType === "list" || valueType === "multiselect" || valueType === "entity-ref-list") {
    return <input type="text" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />;
  }
  return <input type={valueType === "number" ? "number" : valueType === "date" ? "date" : "text"} value={String(value ?? "")} onChange={(event) => onChange(valueType === "number" ? (event.target.value === "" ? undefined : Number(event.target.value)) : event.target.value)} />;
}

function variableValueEditor(value: unknown, type: string | undefined, operation: string, onChange: (value: unknown) => void) {
  const scalarListOperation = ["list", "multiselect", "entity-ref-list"].includes(type ?? "") && ["contains", "notContains", "append", "remove"].includes(operation);
  if (scalarListOperation) {
    const scalarValue = Array.isArray(value) ? value[0] : value;
    return <input type="text" value={String(scalarValue ?? "")} placeholder="Item" onChange={(event) => onChange(event.target.value)} />;
  }
  return valueEditor(value, type, onChange);
}

function GenericPredicateRow({ project, options, predicate, onChange, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  predicate: LogicPredicate;
  onChange: (predicate: LogicPredicate) => void;
  onRemove: () => void;
}) {
  const enabledFields = fieldOptions(project, predicate.subject, "condition");
  const selectedKey = predicate.type === "state" ? predicate.stateId : predicate.type === "property" ? predicate.propertyId : predicate.type;
  const selectedKind = predicate.type === "state" ? "state" : predicate.type === "property" ? "property" : predicate.type === "visited" ? "visited" : predicate.type === "external" ? "external" : "value";
  const resolvedField = resolveLogicField(project, predicate.subject, "condition", selectedKind, selectedKey);
  const fields = resolvedField.status === "enabled" || enabledFields.some((field) => field.key === resolvedField.key)
    ? enabledFields
    : [resolvedField, ...enabledFields];
  const selectedField = fields.find((field) => field.key === selectedKey) ?? fields[0];
  const operators = selectedField ? operatorsFor(selectedField) : comparisonOperators;
  const operator = predicate.operator;
  const selectedSubjectKey = subjectKey(predicate.subject);
  const selectedSubjectOption = subjectOptions(project).find((option) => option.key === selectedSubjectKey);
  const rowOptions = options.some((option) => option.key === selectedSubjectKey) || !selectedSubjectOption
    ? options
    : [selectedSubjectOption, ...options];
  return <div className="logic-composer-row">
    <select aria-label="Logic subject" value={selectedSubjectKey} onChange={(event) => {
      const subject = rowOptions.find((option) => option.key === event.target.value)?.subject;
      if (!subject) return;
      const field = fieldOptions(project, subject, "condition")[0];
      if (field) onChange(retargetCondition(predicate, subject, project));
    }}>{!rowOptions.some(option=>option.key===selectedSubjectKey) ? <option value={selectedSubjectKey}>Missing · {selectedSubjectKey}</option> : null}{rowOptions.map((option) => <option key={option.key} value={option.key}>{option.contextual ? "● " : ""}{option.label} · {option.detail}</option>)}</select>
    <select aria-label="Logic field" value={selectedField?.key ?? ""} onChange={(event) => {
      const field = fields.find((item) => item.key === event.target.value);
      if (field) {
        const next = predicateFor(predicate.subject, field);
        onChange({ ...next, operator: operatorsFor(field).includes(predicate.operator) ? predicate.operator : next.operator, ...('value' in next ? { value: 'value' in predicate && conditionValueMatchesType(predicate.value,['contains','notContains'].includes(predicate.operator)?'text':field.valueType) ? predicate.value : undefined } : {}) } as LogicPredicate);
      }
    }}>{fields.map((field) => <option key={`${field.kind}:${field.key}`} value={field.key}>{field.status === "enabled" ? field.label : `${field.label} · capability ${field.status}`}</option>)}</select>
    <select aria-label="Logic operator" value={operator} onChange={(event) => onChange({ ...predicate, operator: event.target.value as LogicPredicate["operator"] } as LogicPredicate)}>{operators.map((item) => <option key={item} value={item}>{item==="exists"?"Is defined":item==="missing" && !["state","visited","external"].includes(predicate.type)?"Is undefined":item}</option>)}</select>
    {!['has', 'missing', 'exists'].includes(operator) ? variableValueEditor("value" in predicate ? predicate.value : undefined, selectedField?.valueType, operator, (value) => onChange({ ...predicate, value } as LogicPredicate)) : null}
    {resolvedField.status !== "enabled" ? <span className="logic-row-capability-warning" title="Enable this capability in the Explorer type or property configuration"><CircleAlert size={12} /> Configure capability</span> : null}
    <button type="button" className="icon-only danger" aria-label="Remove condition" onClick={onRemove}><Trash2 size={13} /></button>
  </div>;
}

function GenericEffectRow({ project, options, effect, onChange, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  onChange: (effect: LogicEffect) => void;
  onRemove: () => void;
}) {
  if (effect.type === "external") {
    return <div className="logic-composer-row effect"><code>{effect.subject.functionId}</code><span>call</span><button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button></div>;
  }
  const enabledFields = fieldOptions(project, effect.subject, "effect");
  const selectedKey = effect.type === "state" ? effect.stateId : effect.type === "property" ? effect.propertyId : effect.type;
  const selectedKind = effect.type === "state" ? "state" : effect.type === "property" ? "property" : "value";
  const resolvedField = resolveLogicField(project, effect.subject, "effect", selectedKind, selectedKey);
  const fields = resolvedField.status === "enabled" || enabledFields.some((field) => field.key === resolvedField.key)
    ? enabledFields
    : [resolvedField, ...enabledFields];
  const selectedField = fields.find((field) => field.key === selectedKey) ?? fields[0];
  const operations = selectedField ? effectOperations(selectedField) : ["set" as const];
  const selectedSubjectKey = subjectKey(effect.subject);
  const selectedSubjectOption = subjectOptions(project).find((option) => option.key === selectedSubjectKey);
  const rowOptions = options.some((option) => option.key === selectedSubjectKey) || !selectedSubjectOption
    ? options
    : [selectedSubjectOption, ...options];
  return <div className="logic-composer-row effect">
    <select aria-label="Effect subject" value={selectedSubjectKey} onChange={(event) => {
      const subject = rowOptions.find((option) => option.key === event.target.value)?.subject;
      if (!subject) return;
      const field = fieldOptions(project, subject, "effect")[0];
      if (field) onChange(effectFor(subject, field));
    }}>{rowOptions.filter((option) => option.subject.kind !== "progress").map((option) => <option key={option.key} value={option.key}>{option.contextual ? "● " : ""}{option.label} · {option.detail}</option>)}</select>
    <select aria-label="Effect field" value={selectedField?.key ?? ""} onChange={(event) => {
      const field = fields.find((item) => item.key === event.target.value);
      if (field) onChange(effectFor(effect.subject, field));
    }}>{fields.map((field) => <option key={`${field.kind}:${field.key}`} value={field.key}>{field.status === "enabled" ? field.label : `${field.label} · capability ${field.status}`}</option>)}</select>
    <select aria-label="Effect operation" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation })}>{operations.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    {!['toggle', 'clear', 'grant', 'ungrant', 'unlock', 'lock', 'discover', 'hide', 'enter', 'leave'].includes(effect.operation) ? valueEditor("value" in effect ? effect.value : undefined, selectedField?.valueType, (value) => onChange({ ...effect, value })) : null}
    {resolvedField.status !== "enabled" ? <span className="logic-row-capability-warning" title="Enable this capability in the Explorer type or property configuration"><CircleAlert size={12} /> Configure capability</span> : null}
    <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
  </div>;
}

function grantablePredicate(entityId: string): LogicPredicate {
  return {
    type: "state",
    subject: { kind: "entity", entityId },
    stateId: "owned",
    operator: "has",
  };
}

function defaultVariableValue(type: string | undefined): unknown {
  if (type === "number") return 0;
  if (type === "boolean") return true;
  if (type === "list") return [];
  return "";
}

function variablePredicate(variableId: string, type?: string): LogicPredicate {
  return {
    type: "value",
    subject: { kind: "variable", variableId },
    operator: "==",
    value: defaultVariableValue(type),
  };
}

function grantableEffect(entityId: string): LogicEffect {
  return {
    type: "state",
    subject: { kind: "entity", entityId },
    stateId: "owned",
    operation: "grant",
  };
}

function variableEffect(variableId: string, type?: string): LogicEffect {
  return {
    type: "value",
    subject: { kind: "variable", variableId },
    operation: "set",
    value: defaultVariableValue(type),
  };
}

function isGrantablePredicate(predicate: LogicPredicate): predicate is Extract<LogicPredicate, { type: "state" }> & { subject: Extract<LogicSubject, { kind: "entity" }> } {
  return predicate.type === "state" && predicate.stateId === "owned" && predicate.subject.kind === "entity";
}

function isVariablePredicate(predicate: LogicPredicate): predicate is Extract<LogicPredicate, { type: "value" }> & { subject: Extract<LogicSubject, { kind: "variable" }> } {
  return predicate.type === "value" && predicate.subject.kind === "variable";
}

function isGrantableEffect(effect: LogicEffect): effect is Extract<LogicEffect, { type: "state" }> & { subject: Extract<LogicSubject, { kind: "entity" }> } {
  return effect.type === "state" && effect.stateId === "owned" && effect.subject.kind === "entity";
}

function isVariableEffect(effect: LogicEffect): effect is Extract<LogicEffect, { type: "value" }> & { subject: Extract<LogicSubject, { kind: "variable" }> } {
  return effect.type === "value" && effect.subject.kind === "variable";
}

function variableConditionOperators(type: string | undefined) {
  if (type === "number" || type === "date") return [
    ["==", "Equal"],
    ["!=", "Not equal"],
    [">", "Greater than"],
    [">=", "At least"],
    ["<", "Less than"],
    ["<=", "At most"],
  ] as const;
  if (type === "list") return [["contains", "Contains"], ["notContains", "Does not contain"], ["exists", "Is defined"], ["missing", "Is undefined"]] as const;
  if (type === "text") return [["==", "Is"], ["!=", "Is not"], ["contains", "Contains"], ["notContains", "Does not contain"], ["exists", "Is defined"], ["missing", "Is undefined"]] as const;
  return [["==", "Is"], ["!=", "Is not"], ["exists", "Is defined"], ["missing", "Is undefined"]] as const;
}

function variableEffectOperations(type: string | undefined): LogicEffectOperation[] {
  if (type === "number" || type === "date") return ["set", "add", "subtract", "clear"];
  if (type === "list") return ["set", "append", "remove", "clear"];
  if (type === "boolean") return ["set", "toggle", "clear"];
  return ["set", "clear"];
}

function actionTypeOptions(includeVisited = false) {
  return <>
    <option value="grantable">Grantable</option>
    <option value="variable">Variable</option>
    {includeVisited ? <option value="visited">Visited</option> : null}
  </>;
}

function visitedPredicate(eventId: string): LogicPredicate {
  return {
    type: "visited",
    subject: { kind: "progress", targetType: "event", targetId: eventId },
    operator: "has",
  };
}

function availableEventOptions(project: BranchingProject) {
  return project.events.map((event) => ({ id: event.id, label: event.name }));
}

function PredicateRow({ project, options, predicate, onChange, onChangeMany, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  predicate: LogicPredicate;
  onChange: (predicate: LogicPredicate) => void;
  onChangeMany?: (predicates: LogicPredicate[]) => void;
  onRemove: () => void;
}) {
  return <GenericPredicateRow project={project} options={options} predicate={predicate} onChange={onChange} onRemove={onRemove} />;
}

function EffectRow({ project, options, effect, onChange, onChangeMany, onRemove }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  onChange: (effect: LogicEffect) => void;
  onChangeMany?: (effects: LogicEffect[]) => void;
  onRemove: () => void;
}) {
  const grantables = grantableEntities(project);
  const variables = project.logicVariables ?? [];
  if (isGrantableEffect(effect)) {
    const selectedGrantable = grantables.some((entity) => entity.id === effect.subject.entityId);
    return <div className="logic-composer-row effect simple">
      <select aria-label="Consequence action type" value="grantable" onChange={(event) => {
        if (event.target.value === "grantable") return;
        const variable = variables[0];
        if (event.target.value === "variable") onChange(variableEffect(variable?.id ?? "", variable?.type));
      }}>
        {actionTypeOptions()}
      </select>
      <select aria-label="Grantable consequence action" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as "grant" | "ungrant" })}>
        <option value="grant">Add</option>
        <option value="ungrant">Remove</option>
      </select>
      <select
        aria-label="Grantable entities"
        multiple={grantables.length > 1}
        size={grantables.length > 1 ? Math.min(4, grantables.length) : undefined}
        value={selectedGrantable ? [effect.subject.entityId] : [""]}
        onChange={(event) => {
          const selectedIds = Array.from(event.target.selectedOptions, (option) => option.value);
          if (selectedIds.length > 1 && onChangeMany) {
            onChangeMany(selectedIds.map((entityId) => grantableEffect(entityId)));
            return;
          }
          onChange(grantableEffect(selectedIds[0] ?? ""));
        }}
      >
        {!selectedGrantable ? <option value="" disabled>Not available</option> : null}
        {grantables.map((entity) => <option key={`${entity.source}:${entity.id}`} value={entity.id}>{entity.label}</option>)}
      </select>
      <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  if (isVariableEffect(effect)) {
    const variable = variables.find((item) => item.id === effect.subject.variableId);
    const operations = variableEffectOperations(variable?.type);
    return <div className="logic-composer-row effect simple variable">
      <select aria-label="Consequence action type" value="variable" onChange={(event) => {
        if (event.target.value === "grantable") {
          onChange(grantableEffect(grantables[0]?.id ?? ""));
        }
      }}>
        {actionTypeOptions()}
      </select>
      <select aria-label="Variable consequence action" value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation } as LogicEffect)}>
        {operations.map((operation) => <option key={operation} value={operation}>{operation === "set" ? "Set" : operation === "add" || operation === "append" ? "Add" : operation === "subtract" || operation === "remove" ? "Remove" : operation === "toggle" ? "Toggle" : "Clear"}</option>)}
      </select>
      <select aria-label="Consequence variable" value={effect.subject.variableId} onChange={(event) => {
        const nextVariable = variables.find((item) => item.id === event.target.value);
        if (nextVariable) onChange(variableEffect(nextVariable.id, nextVariable.type));
      }}>
        {!variable ? <option value="" disabled>Not available</option> : null}
        {variables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {effect.operation !== "clear" ? variableValueEditor(effect.value, variable?.type, effect.operation, (value) => onChange({ ...effect, value })) : <span className="logic-composer-empty-value">—</span>}
      <button type="button" className="icon-only danger" aria-label="Remove effect" onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  {
    return <GenericEffectRow project={project} options={options} effect={effect} onChange={onChange} onRemove={onRemove} />;
  }
}

function firstPredicate(project: BranchingProject, options: SubjectOption[]): LogicPredicate | undefined {
  const firstGrantable = grantableEntities(project)[0];
  if (firstGrantable) return grantablePredicate(firstGrantable.id);
  const firstVariable = project.logicVariables?.[0];
  if (firstVariable) return variablePredicate(firstVariable.id, firstVariable.type);
  for (const option of options) {
    const field = fieldOptions(project, option.subject, "condition")[0];
    if (field) return predicateFor(option.subject, field);
  }
  return undefined;
}

function firstEffect(project: BranchingProject, options: SubjectOption[]): LogicEffect | undefined {
  const firstGrantable = grantableEntities(project)[0];
  if (firstGrantable) return grantableEffect(firstGrantable.id);
  const firstVariable = project.logicVariables?.[0];
  if (firstVariable) return variableEffect(firstVariable.id, firstVariable.type);
  for (const option of options) {
    const field = fieldOptions(project, option.subject, "effect")[0];
    if (field) return effectFor(option.subject, field);
  }
  return grantableEffect("");
}

function ConditionTree({ expression, project, options, onChange, onRemove, depth = 0 }: {
  expression: ConditionExpression; project: BranchingProject; options: SubjectOption[];
  onChange: (expression: ConditionExpression) => void; onRemove: () => void; depth?: number;
}) {
  if (!isConditionSet(expression)) return <div className="condition-tree-leaf">
    <PredicateRow project={project} options={options} predicate={expression as LogicPredicate} onChange={onChange}
      onChangeMany={items=>onChange({all:items})} onRemove={onRemove} />
    <button type="button" disabled={depth>=63} onClick={()=>onChange({not:expression})}>NOT</button>
  </div>;
  const kind = 'not' in expression ? 'not' : 'any' in expression ? 'any' : 'all';
  const children = 'not' in expression ? [expression.not] : 'any' in expression ? expression.any : expression.all;
  const replace = (next:ConditionExpression[]) => onChange(kind==='not' ? {not:next[0]} : kind==='any' ? {any:next} : {all:next});
  const add = (group?:'all'|'any') => {const predicate=firstPredicate(project,options); if(predicate) replace([...children,group?{[group]:[predicate]} as ConditionExpression:predicate]);};
  return <fieldset className="condition-tree-group"><legend>{kind.toUpperCase()}</legend>
    <select aria-label="Condition group operator" value={kind} onChange={e=>{if(e.target.value===kind)return;if(e.target.value==='not')onChange({not:expression});else onChange(e.target.value==='any'?{any:children}:{all:children});}}><option value="all">AND</option><option value="any">OR</option><option value="not">NOT</option></select>
    <button type="button" onClick={onRemove}>Remove group</button>
    {kind==='not'?<button type="button" onClick={()=>onChange(children[0])}>Remove NOT</button>:null}
    {children.map((child,index)=><ConditionTree key={index} expression={child} project={project} options={options} depth={depth+1}
      onChange={next=>replace(children.map((item,i)=>i===index?next:item))} onRemove={()=>kind==='not'?onRemove():replace(children.filter((_,i)=>i!==index))} />)}
    {kind!=='not' && depth<63?<div className="logic-composer-actions"><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add()}>+ Condition</button><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add('all')}>+ AND group</button><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add('any')}>+ OR group</button></div>:null}
  </fieldset>;
}

export function LogicConditionEditor({project,contextEntityIds,value,onChange,label='WHEN',compact}:LogicComposerProps & {value?:ConditionInput;onChange:(value:ConditionInput|undefined)=>void;label?:string}) {
  const [message,setMessage]=useState('');
  const [dropChoice,setDropChoice]=useState<{option:SubjectOption;fields:LogicFieldOption[]}>();
  const options=useMemo(()=>subjectOptions(project,contextEntityIds).filter(option=>fieldOptions(project,option.subject,'condition').length>0),[project,contextEntityIds]);
  const migrated=migrateConditionInput(value,project.logicVariables ?? []);
  const expressions=asConditionExpressions(migrated);
  const root=expressions.length===0?undefined:expressions.length===1?expressions[0]:{all:expressions};
  const add=(group?:'all'|'any')=>{const predicate=firstPredicate(project,options);if(!predicate)return;const next=group?{[group]:[predicate]} as ConditionExpression:predicate;onChange(root?{all:[root,next]}:next);};
  const diagnostic=evaluateConditionDetailed(value,project);
  return <section className={`logic-composer ${compact?'compact':''}`}
    onDragOver={event=>{if(event.dataTransfer.types.includes('application/x-pathbranching-canon-ref')||event.dataTransfer.types.includes('application/x-pathbranching-entity')){event.preventDefault();event.dataTransfer.dropEffect='copy';}}}
    onDrop={event=>{const id=event.dataTransfer.getData('application/x-pathbranching-entity')||event.dataTransfer.getData('application/x-pathbranching-canon-ref');if(!id)return;event.preventDefault();const option=options.find(o=>o.subject.kind==='entity'&&o.subject.entityId===id);const fields=option?fieldOptions(project,option.subject,'condition'):[];const field=fields[0];if(!option||!field){setMessage('Enable a condition-readable property or runtime state for this entity.');return;}if(fields.length>1){setDropChoice({option,fields});return;}const predicate=predicateFor(option.subject,field);onChange(root?{all:[root,predicate]}:predicate);setMessage('');}}>
    <header><strong>{label}</strong><span>{root?'Condition tree':'Always'}</span></header>
    {root && !conditionStructureIssues(value).length?<ConditionTree expression={root} project={project} options={options} onChange={onChange} onRemove={()=>onChange(undefined)} />:null}
    <div className="logic-composer-actions"><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add()}><Plus size={13}/> Condition</button><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add('all')}>AND group</button><button type="button" disabled={!firstPredicate(project,options)} onClick={()=>add('any')}>OR group</button></div>
    {diagnostic.status==='invalid'?<p role="alert" className="logic-row-capability-warning">Review references, operators and values. {diagnostic.message}</p>:null}
    {dropChoice?<div role="dialog" aria-label="Choose condition field">{dropChoice.fields.map(field=><button type="button" key={field.key} onClick={()=>{const p=predicateFor(dropChoice.option.subject,field);onChange(root?{all:[root,p]}:p);setDropChoice(undefined);}}>{field.label}</button>)}</div>:null}
    {message?<p role="status">{message}</p>:null}
    {!options.length?<p>No readable conditions. Configure properties, variables or runtime capabilities in Logic.</p>:null}
    <ConditionTester key={project.projectId} project={project} conditions={value}/>
  </section>;
}

export function LogicEffectEditor({ project, contextEntityIds, value, onChange, label = "THEN", compact }: LogicComposerProps & {
  value?: Consequence[];
  onChange: (value: Consequence[] | undefined) => void;
  label?: string;
}) {
  const [dropMessage, setDropMessage] = useState<string>();
  const [dropChoice, setDropChoice] = useState<{ option: SubjectOption; fields: LogicFieldOption[] }>();
  const options = useMemo(
    () => {
      const grantableIds = new Set(grantableEntities(project).map((entity) => entity.id));
      return subjectOptions(project, contextEntityIds).filter((option) => {
      if (option.subject.kind === "entity" && !grantableIds.has(option.subject.entityId)) return false;
      if (!["entity", "variable"].includes(option.subject.kind)) return false;
      if (option.subject.kind === "external") {
        const functionId = option.subject.functionId;
        const kind = project.externalFunctions.find((item) => item.name === functionId)?.kind;
        if (kind !== "consequence" && kind !== "runtimeAction" && kind !== "engineSignal") return false;
      }
      return fieldOptions(project, option.subject, "effect").length > 0;
      });
    },
    [project, contextEntityIds],
  );
  const effects = (value ?? []).map((effect) => migrateConsequence(effect, project.logicVariables ?? []));
  const canAddEffect = Boolean(firstEffect(project, options));
  return <section
    className={`logic-composer effect ${compact ? "compact" : ""}`}
    onDragOver={(event) => {
      if (event.dataTransfer.types.includes("application/x-pathbranching-canon-ref") || event.dataTransfer.types.includes("application/x-pathbranching-entity")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    }}
    onDrop={(event) => {
      const entityId = event.dataTransfer.getData("application/x-pathbranching-entity") || event.dataTransfer.getData("application/x-pathbranching-canon-ref");
      if (!entityId) return;
      event.preventDefault();
      const option = options.find((candidate) => candidate.subject.kind === "entity" && candidate.subject.entityId === entityId);
      const fields = option ? fieldOptions(project, option.subject, "effect") : [];
      if (!option || !fields.length) {
        setDropMessage("This entity has no action-writable property or runtime state. Enable one in its type/property capabilities.");
        setDropChoice(undefined);
        return;
      }
      if (fields.length > 1) {
        setDropChoice({ option, fields });
        setDropMessage(undefined);
        return;
      }
      onChange([...effects, effectFor(option.subject, fields[0])]);
      setDropChoice(undefined);
      setDropMessage(undefined);
    }}
  >
    <header><strong>{label}</strong><span>{effects.length ? `${effects.length} effect${effects.length === 1 ? "" : "s"}` : "No effects"}</span></header>
    <div className="logic-composer-rows">{effects.map((effect, index) => <EffectRow key={`${effect.type}:${index}`} project={project} options={options} effect={effect} onChange={(next) => onChange(effects.map((item, itemIndex) => itemIndex === index ? next : item))} onChangeMany={(nextEffects) => onChange(effects.flatMap((item, itemIndex) => itemIndex === index ? nextEffects : [item]))} onRemove={() => onChange(effects.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
    <div className="logic-composer-actions"><button type="button" disabled={!canAddEffect} title={canAddEffect ? "Add consequence" : "Create a Grantable type or Variable first"} onClick={() => { const effect = firstEffect(project, options); if (effect) onChange([...effects, effect]); }}><Plus size={13} /> Consequence</button></div>
    {!canAddEffect ? <p className="logic-composer-empty-state">Create a Grantable type or Variable in Logic to add consequences.</p> : null}
    {dropChoice ? <div className="logic-composer-drop-choice" role="dialog" aria-label={`Choose effect field for ${dropChoice.option.label}`}>
      <strong>{dropChoice.option.label}</strong><span>Choose a writable property or state</span>
      <div>{dropChoice.fields.map((field) => <button type="button" key={`${field.kind}:${field.key}`} onClick={() => {
        onChange([...effects, effectFor(dropChoice.option.subject, field)]);
        setDropChoice(undefined);
      }}>{field.label}</button>)}</div>
    </div> : null}
    {dropMessage ? <p className="logic-composer-drop-message" role="status">{dropMessage}</p> : null}
  </section>;
}

function LogicPresentationToken({ item }: { item: LogicPresentation }) {
  return <span
    className={`logic-presentation-token${item.status === "enabled" ? "" : " warning"}`}
    title={item.status === "enabled" ? item.text : `${item.text} · capability ${item.status}`}
    style={item.color ? { "--logic-subject-color": item.color } as CSSProperties : undefined}
  >
    <i aria-hidden="true" />
    <span>{item.subjectLabel}</span>
    <b>{item.fieldLabel}</b>
    <em>{item.operatorLabel}{item.valueLabel ? ` ${item.valueLabel}` : ""}</em>
    {item.status !== "enabled" ? <CircleAlert size={10} aria-label={`Capability ${item.status}`} /> : null}
  </span>;
}

export function LogicBands({
  when,
  then,
  whenItems = [],
  thenItems = [],
  expanded,
  warningCount = 0,
  onOpenWhen,
  onOpenThen,
}: {
  when?: string;
  then?: string;
  whenItems?: LogicPresentation[];
  thenItems?: LogicPresentation[];
  expanded?: boolean;
  warningCount?: number;
  onOpenWhen?: () => void;
  onOpenThen?: () => void;
}) {
  return <div className={`node-logic-bands${expanded ? " expanded" : ""}`}>
    {when ? <button type="button" className="node-logic-band when" onClick={onOpenWhen}>
      <GitBranch size={10} /><b>WHEN</b>
      <span className="logic-band-summary">{whenItems.length ? whenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : when}</span>
    </button> : null}
    {then ? <button type="button" className="node-logic-band then" onClick={onOpenThen}>
      <Zap size={10} /><b>THEN</b>
      <span className="logic-band-summary">{thenItems.length ? thenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : then}</span>
    </button> : null}
    {warningCount > 0 ? <span className="node-logic-warning" title={`${warningCount} capability warning${warningCount === 1 ? "" : "s"}`}><CircleAlert size={11} />{warningCount}</span> : null}
  </div>;
}

/** One moment editor shared by availability, choices, dialogues and guarded effects. */
export function LogicMomentEditor({project, value, onChange, hideWhen=false}:{project:BranchingProject;value?:LogicMoment;onChange:(value:LogicMoment)=>void;hideWhen?:boolean}) {
  const rules=value?.rules ?? [];
  return <section className="logic-moment-editor">
    {!hideWhen?<LogicConditionEditor project={project} value={value?.when} onChange={when=>onChange({...value,when})}/>:null}
    <LogicEffectEditor project={project} value={value?.then} onChange={then=>onChange({...value,then})}/>
    {rules.map((rule,index)=><fieldset key={rule.id}><legend>Conditional consequence · {rule.id}</legend>
      <LogicConditionEditor project={project} value={rule.when} onChange={when=>onChange({...value,rules:rules.map((r,i)=>i===index?{...r,when:when ?? []}:r)})}/>
      <LogicEffectEditor project={project} value={rule.then} onChange={then=>onChange({...value,rules:rules.map((r,i)=>i===index?{...r,then:(then ?? []).map(e=>migrateConsequence(e,project.logicVariables ?? []))}:r)})}/>
      <button type="button" onClick={()=>onChange({...value,rules:rules.filter((_,i)=>i!==index)})}>Remove rule</button>
    </fieldset>)}
    <button type="button" onClick={()=>onChange({...value,rules:[...rules,{id:`rule:${crypto.randomUUID()}`,when:[],then:[]}]})}>Add conditional consequence</button>
  </section>;
}
