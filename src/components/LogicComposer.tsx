import { ConditionRowsEditor } from "./ConditionRowsEditor.js";
import type { ConditionAuthoringContext } from "../conditionAuthoring.js";
import { isConditionEditorTreeRenderable } from "../conditionTreeEditing.js";
import { retargetCondition } from "../conditionEditing.js";
import { conditionValueMatchesType, conditionStructureIssues, evaluateConditionDetailed } from "../conditionEvaluation.js";
import { CircleAlert, GitBranch, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { useInterfaceLocale } from "../i18n.js";
import { conditionDiagnosticMessage, conditionFieldIssues, conditionFieldKey, conditionFieldLabel, conditionOperatorLabel, conditionTreeSummary, conditionUiCopy, effectOperationLabel, type ConditionUiLocale } from "../conditionPresentation.js";
import "../conditionUx.css";
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
  InstanceQuery,
  InstanceEffect,
} from "../domain.js";
import { authoringDraftKey, getAuthoringDraft, setAuthoringDraft } from "../authoringDrafts.js";
import { useAuthoringDraft } from "./useAuthoringDraft.js";
import { EntityOwnerPicker } from "./EntityOwnerPicker.js";
import { NarrativeEffectEditor } from "./NarrativeEffectEditor.js";
import { entityDefinition } from "../authoringEntities.js";
import { asConditionExpressions, isConditionSet, migrateConditionInput, migrateConsequence, orderedMomentEffects, splitNarrativeEffects } from "../logic.js";
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
  context?: ConditionAuthoringContext;
  compact?: boolean;
  locale?: ConditionUiLocale;
  draftId?: string;
};

function configureEntity(entityId?: string) {
  window.dispatchEvent(new CustomEvent("pathbranching:configure-entity", { detail: { entityId } }));
}

function incompleteCondition(value: ConditionInput | undefined, project: BranchingProject): boolean {
  if (conditionStructureIssues(value).length) return true;
  const visit = (input: ConditionInput | undefined): boolean => {
    if (!input) return false;
    if (Array.isArray(input)) return input.some(visit);
    if (isConditionSet(input)) return "not" in input ? visit(input.not) : ("all" in input ? input.all : input.any).some(visit);
    if (input.type === 'interactionResult') return !input.useId || !input.resultId || !['==','!='].includes(String(input.operator));
    if (input.type === "instanceQuery") { const query = input as InstanceQuery; return query.quantifier === "count" && (typeof query.value !== "number" || !Number.isFinite(query.value) || query.value < 0) || visit(query.filters); }
    return conditionFieldIssues(project, input as LogicPredicate).length > 0;
  };
  return visit(value);
}

function useConditionDraft(project: BranchingProject, draftId: string | undefined, saved: ConditionInput | undefined, onChange: (value: ConditionInput | undefined) => void) {
  const temporaryId = useId();
  const key = authoringDraftKey(project.projectId, draftId ?? `temporary:${temporaryId}`, "condition");
  const fallback = JSON.stringify(saved ?? null);
  const [serialized, setSerialized, clear] = useAuthoringDraft(key, fallback);
  let value = saved;
  try { value = JSON.parse(serialized) ?? undefined; } catch { /* Keep original condition if recovery data is malformed. */ }
  const change = (next: ConditionInput | undefined) => {
    if (incompleteCondition(next, project)) setSerialized(JSON.stringify(next ?? null));
    else { onChange(next); clear(); }
  };
  return { value, change, draft: serialized !== fallback, clear };
}

function valueEditor(value: unknown, valueType: string | undefined, onChange: (value: unknown) => void, attributes: InputHTMLAttributes<HTMLInputElement> = {}, locale: ConditionUiLocale = "en") {
  const c = conditionUiCopy(locale);
  if (valueType === "boolean" || valueType === "bool") {
    return <select id={attributes.id} aria-label={attributes["aria-label"]} aria-invalid={attributes["aria-invalid"]} aria-describedby={attributes["aria-describedby"]} value={value===undefined?"":String(value)} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")}><option value="">{c.chooseBoolean}</option><option value="true">{c.yes}</option><option value="false">{c.no}</option></select>;
  }
  if (valueType === "list" || valueType === "multiselect" || valueType === "entity-ref-list") {
    return <input {...attributes} type="text" value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />;
  }
  const numeric = ["number", "integer", "float"].includes(valueType ?? "");
  // Keep incomplete numeric text in the recovery draft instead of letting the
  // native number input discard it (including values retained after retargeting).
  return <input {...attributes} type={valueType === "date" ? "date" : "text"} inputMode={numeric ? "decimal" : undefined} value={String(value ?? "")} onChange={(event) => {
    const text = event.target.value;
    onChange(numeric ? !text.trim() ? undefined : Number.isFinite(Number(text)) ? Number(text) : text : text);
  }} />;
}

function variableValueEditor(value: unknown, type: string | undefined, operation: string, onChange: (value: unknown) => void, attributes: InputHTMLAttributes<HTMLInputElement> = {}, locale: ConditionUiLocale = "en") {
  const scalarListOperation = ["list", "multiselect", "entity-ref-list"].includes(type ?? "") && ["contains", "notContains", "append", "remove"].includes(operation);
  if (scalarListOperation) {
    const scalarValue = Array.isArray(value) ? value[0] : value;
    return <input {...attributes} type="text" value={String(scalarValue ?? "")} placeholder="Item" onChange={(event) => onChange(event.target.value)} />;
  }
  return valueEditor(value, type, onChange, attributes, locale);
}

function GenericEffectRow({ project, options, effect, onChange, onRemove, locale = "en", rowActions }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  locale?: ConditionUiLocale;
  onChange: (effect: LogicEffect) => void;
  onRemove: () => void;
  rowActions?: ReactNode;
}) {
  const c = conditionUiCopy(locale);
  if (effect.type === "external") {
    return <div className="logic-composer-row effect external"><code>{effect.subject.functionId}</code><span>{effectOperationLabel("call", locale)}</span><div className="logic-effect-row-tools">{rowActions}<button type="button" className="icon-only danger" aria-label={`${c.remove} · ${c.consequence}`} onClick={onRemove}><Trash2 size={13} /></button></div></div>;
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
  const omitsValue = ['toggle', 'clear', 'grant', 'ungrant', 'unlock', 'lock', 'discover', 'hide', 'enter', 'leave'].includes(effect.operation);
  return <div className={`logic-composer-row effect${omitsValue ? ' no-value' : ' has-value'}`}>
    <select aria-label={`${c.subject} · ${c.consequence}`} value={selectedSubjectKey} onChange={(event) => {
      const subject = rowOptions.find((option) => option.key === event.target.value)?.subject;
      if (!subject) return;
      const field = fieldOptions(project, subject, "effect")[0];
      if (field) onChange(effectFor(subject, field));
    }}>{rowOptions.filter((option) => option.subject.kind !== "progress").map((option) => <option key={option.key} value={option.key}>{option.contextual ? "● " : ""}{option.label} · {option.detail}</option>)}</select>
    <select aria-label={`${c.field} · ${c.consequence}`} value={selectedField?.key ?? ""} onChange={(event) => {
      const field = fields.find((item) => item.key === event.target.value);
      if (field) onChange(effectFor(effect.subject, field));
    }}>{fields.map((field) => <option key={`${field.kind}:${field.key}`} value={field.key}>{field.status === "enabled" ? conditionFieldLabel(field, locale) : `${conditionFieldLabel(field, locale)} · ${c.incompatible}`}</option>)}</select>
    <select aria-label={`${c.action} · ${c.consequence}`} value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation })}>{operations.map((item) => <option key={item} value={item}>{effectOperationLabel(item, locale)}</option>)}</select>
    {!omitsValue ? valueEditor("value" in effect ? effect.value : undefined, selectedField?.valueType, (value) => onChange({ ...effect, value }), {"aria-label": c.effectValue}, locale) : null}
    <div className="logic-effect-row-tools">
      {resolvedField.status !== "enabled" ? <button type="button" className="logic-row-capability-warning" onClick={() => configureEntity(effect.subject.kind === "entity" ? effect.subject.entityId : undefined)}><CircleAlert size={12} /> {locale === "es" ? "Configurar uso" : "Configure use"}</button> : null}
      {rowActions}
      <button type="button" className="icon-only danger" aria-label={`${c.remove} · ${c.consequence}`} onClick={onRemove}><Trash2 size={13} /></button>
    </div>
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

function actionTypeOptions(includeVisited = false, locale: ConditionUiLocale = "en") {
  const c = conditionUiCopy(locale);
  return <>
    <option value="grantable">{c.grantable}</option>
    <option value="variable">{c.variable}</option>
    {includeVisited ? <option value="visited">{c.visited}</option> : null}
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

function EffectRow(props: { project: BranchingProject; options: SubjectOption[]; effect: LogicEffect; locale?: ConditionUiLocale; onChange: (effect: LogicEffect) => void; onChangeMany?: (effects: LogicEffect[]) => void; onRemove: () => void; rowActions?: ReactNode }) {
  return <GenericEffectRow {...props} />;
}

function LegacyEffectRow({ project, options, effect, onChange, onChangeMany, onRemove, locale = "en" }: {
  project: BranchingProject;
  options: SubjectOption[];
  effect: LogicEffect;
  locale?: ConditionUiLocale;
  onChange: (effect: LogicEffect) => void;
  onChangeMany?: (effects: LogicEffect[]) => void;
  onRemove: () => void;
}) {
  const c = conditionUiCopy(locale);
  const grantables = grantableEntities(project);
  const variables = project.logicVariables ?? [];
  if (isGrantableEffect(effect)) {
    const selectedGrantable = grantables.some((entity) => entity.id === effect.subject.entityId);
    return <div className="logic-composer-row effect simple">
      <select aria-label={c.actionType} value="grantable" onChange={(event) => {
        if (event.target.value === "grantable") return;
        const variable = variables[0];
        if (event.target.value === "variable") onChange(variableEffect(variable?.id ?? "", variable?.type));
      }}>
        {actionTypeOptions(false, locale)}
      </select>
      <select aria-label={`${c.action} · ${c.grantable}`} value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as "grant" | "ungrant" })}>
        <option value="grant">{effectOperationLabel("grant", locale)}</option>
        <option value="ungrant">{effectOperationLabel("ungrant", locale)}</option>
      </select>
      <select
        aria-label={c.grantable}
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
        {!selectedGrantable ? <option value="" disabled>{c.missing}</option> : null}
        {grantables.map((entity) => <option key={`${entity.source}:${entity.id}`} value={entity.id}>{entity.label}</option>)}
      </select>
      <button type="button" className="icon-only danger" aria-label={`${c.remove} · ${c.consequence}`} onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  if (isVariableEffect(effect)) {
    const variable = variables.find((item) => item.id === effect.subject.variableId);
    const operations = variableEffectOperations(variable?.type);
    return <div className="logic-composer-row effect simple variable">
      <select aria-label={c.actionType} value="variable" onChange={(event) => {
        if (event.target.value === "grantable") {
          onChange(grantableEffect(grantables[0]?.id ?? ""));
        }
      }}>
        {actionTypeOptions(false, locale)}
      </select>
      <select aria-label={`${c.action} · ${c.variable}`} value={effect.operation} onChange={(event) => onChange({ ...effect, operation: event.target.value as LogicEffectOperation } as LogicEffect)}>
        {operations.map((operation) => <option key={operation} value={operation}>{effectOperationLabel(operation, locale)}</option>)}
      </select>
      <select aria-label={c.variable} value={effect.subject.variableId} onChange={(event) => {
        const nextVariable = variables.find((item) => item.id === event.target.value);
        if (nextVariable) onChange(variableEffect(nextVariable.id, nextVariable.type));
      }}>
        {!variable ? <option value="" disabled>{c.missing}</option> : null}
        {variables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {effect.operation !== "clear" ? variableValueEditor(effect.value, variable?.type, effect.operation, (value) => onChange({ ...effect, value }), {"aria-label": c.effectValue}, locale) : <span className="logic-composer-empty-value">—</span>}
      <button type="button" className="icon-only danger" aria-label={`${c.remove} · ${c.consequence}`} onClick={onRemove}><Trash2 size={13} /></button>
    </div>;
  }

  {
    return <GenericEffectRow project={project} options={options} effect={effect} onChange={onChange} onRemove={onRemove} locale={locale}/>;
  }
}

function firstPredicate(project: BranchingProject, options: SubjectOption[]): LogicPredicate | undefined {
  if (options.length === 1 && options[0].subject.kind === "context" && options[0].subject.role === "self") {
    const field = fieldOptions(project, options[0].subject, "condition")[0];
    return field ? predicateFor(options[0].subject, field) : undefined;
  }
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
  return undefined;
}

function isEditableConditionTree(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.every(isEditableConditionTree);
  const object = value as Record<string, unknown>;
  if ('all' in object || 'any' in object) {const children = object.all ?? object.any; return Array.isArray(children) && children.every(isEditableConditionTree);}
  if ('not' in object) return object.not !== undefined && isEditableConditionTree(object.not);
  if (object.type === "instanceQuery") return isEditableConditionTree(object.filters);
  return conditionStructureIssues(value).length === 0;
}

type ConditionEditorProps = LogicComposerProps & { value?: ConditionInput; onChange: (value: ConditionInput | undefined) => void; label?: string; emptyMessage?: string; copyFilter?: boolean };
export function LogicConditionEditor(props: ConditionEditorProps) {
  const id = useId();
  return <ConditionEditorSession key={`${props.project.projectId}:${props.draftId ?? id}`} {...props} />;
}
function ConditionEditorSession(props: ConditionEditorProps) {
  const draft = useConditionDraft(props.project, props.draftId, props.value, props.onChange);
  const interfaceLocale = useInterfaceLocale();
  const locale = props.locale ?? interfaceLocale;
  if (!isConditionEditorTreeRenderable(draft.value)) return <section className="condition-ux"><p className="condition-field-error" role="status">{locale === 'es' ? 'Esta estructura de condiciones no se puede editar. Los datos originales se conservan.' : 'This condition structure cannot be edited. Original data is preserved.'}</p><details><summary>{locale === 'es' ? 'Ver datos originales' : 'View original data'}</summary><pre>{JSON.stringify(draft.value, null, 2)}</pre></details><button type="button" onClick={() => draft.change(undefined)}>{locale === 'es' ? 'Quitar condiciones' : 'Remove conditions'}</button></section>;
  return <><ConditionRowsEditor project={props.project} value={migrateConditionInput(draft.value, props.project.logicVariables ?? [])} onChange={draft.change} context={{...props.context, contextEntityIds: props.context?.contextEntityIds ?? props.contextEntityIds}} locale={locale} label={props.label ?? (locale === 'es' ? 'Condiciones' : 'Conditions')} emptyMessage={props.emptyMessage} copyFilter={props.copyFilter} draftId={props.draftId} />{draft.draft ? <p className="condition-field-error" role="status">{locale === 'es' ? 'Borrador recuperable: completa los campos para incorporarlo a la historia.' : 'Recoverable draft: complete the fields to update the story.'} <button type="button" onClick={draft.clear}>{locale === 'es' ? 'Descartar borrador' : 'Discard draft'}</button></p> : null}</>;
}
type EffectEditorProps = LogicComposerProps & {
  value?: Consequence[];
  onChange: (value: Consequence[] | undefined) => void;
  label?: string;
  inlineRow?: boolean;
  hideHeader?: boolean;
  hideAddAction?: boolean;
  addLabel?: string;
  rowActions?: ReactNode;
};
export function LogicEffectEditor(props: EffectEditorProps) {
  const id = useId();
  const key = authoringDraftKey(props.project.projectId, props.draftId ?? `temporary:${id}`, "effects");
  const fallback = JSON.stringify(props.value ?? []);
  const [serialized, setSerialized, clear] = useAuthoringDraft(key, fallback);
  let value = props.value;
  try { value = JSON.parse(serialized); } catch { /* Preserve the saved expression. */ }
  const onChange = (next: Consequence[] | undefined) => {
    const incomplete = (next ?? []).some(item => {
      const effect = migrateConsequence(item, props.project.logicVariables ?? []);
      if (["toggle", "clear", "grant", "ungrant", "unlock", "lock", "discover", "hide", "enter", "leave", "call"].includes(effect.operation)) return false;
      const kind = effect.type === "property" ? "property" : effect.type === "state" ? "state" : "value";
      const fieldId = effect.type === "property" ? effect.propertyId : effect.type === "state" ? effect.stateId : "value";
      const field = resolveLogicField(props.project, effect.subject, "effect", kind, fieldId);
      return !conditionValueMatchesType("value" in effect ? effect.value : undefined, ["append", "remove"].includes(effect.operation) ? "text" : field.valueType);
    });
    if (incomplete) setSerialized(JSON.stringify(next ?? []));
    else { props.onChange(next); clear(); }
  };
  const es = useInterfaceLocale() === "es";
  return <><EffectEditorContent {...props} value={value} onChange={onChange} />{serialized !== fallback ? <p role="status" className="condition-field-error">{es ? "Borrador recuperable: introduce un valor válido." : "Recoverable draft: enter a valid value."} <button type="button" onClick={clear}>{es ? "Descartar borrador" : "Discard draft"}</button></p> : null}</>;
}
function EffectEditorContent({ project, contextEntityIds, value, onChange, label = "THEN", compact, locale: localeOverride, inlineRow = false, hideHeader = false, hideAddAction = false, addLabel, rowActions }: LogicComposerProps & {
  value?: Consequence[];
  onChange: (value: Consequence[] | undefined) => void;
  label?: string;
  inlineRow?: boolean;
  hideHeader?: boolean;
  hideAddAction?: boolean;
  addLabel?: string;
  rowActions?: ReactNode;
}) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const c = conditionUiCopy(locale);
  const effectSectionRef = useRef<HTMLElement>(null);
  const firstEffectDropButton = useRef<HTMLButtonElement>(null);
  const [dropMessage, setDropMessage] = useState<string>();
  const [dropChoice, setDropChoice] = useState<{ option: SubjectOption; fields: LogicFieldOption[] }>();
  useEffect(() => {if (dropChoice) firstEffectDropButton.current?.focus();}, [dropChoice]);
  const closeEffectDrop = () => {setDropChoice(undefined); effectSectionRef.current?.focus();};
  const options = useMemo(
    () => {
      return subjectOptions(project, contextEntityIds).filter((option) => {
      if (option.subject.kind === "progress") return false;
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
  return <section ref={effectSectionRef} tabIndex={-1}
    className={`logic-composer effect condition-ux ${compact ? "compact" : ""}${inlineRow ? " horizontal-effect-editor" : ""}`}
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
        setDropMessage(c.noEffectFields);
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
    {!hideHeader ? <header><strong>{label}</strong><span>{effects.length ? `${effects.length} ${c.consequence.toLowerCase()}${effects.length === 1 ? "" : "s"}` : c.noEffects}</span></header> : null}
    <div className="logic-composer-rows">{effects.map((effect, index) => <EffectRow key={`${effect.type}:${index}`} locale={locale} project={project} options={options} effect={effect} rowActions={rowActions} onChange={(next) => onChange(effects.map((item, itemIndex) => itemIndex === index ? next : item))} onChangeMany={(nextEffects) => onChange(effects.flatMap((item, itemIndex) => itemIndex === index ? nextEffects : [item]))} onRemove={() => onChange(effects.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
    {!hideAddAction ? <div className="logic-composer-actions"><button type="button" disabled={!canAddEffect} title={canAddEffect ? c.addConsequence : locale === "es" ? "Crea un tipo otorgable o una variable primero" : "Create a Grantable type or Variable first"} onClick={() => { const effect = firstEffect(project, options); if (effect) onChange([...effects, effect]); }}><Plus size={13} /> {addLabel ?? c.addConsequence}</button></div> : null}
    {!canAddEffect ? <p className="logic-composer-empty-state">{c.noEffectFields} <button type="button" onClick={() => configureEntity()}>{locale === "es" ? "Configurar usos en esta historia" : "Configure uses in this story"}</button></p> : null}
    {dropChoice ? <div className="logic-composer-drop-choice" role="group" aria-label={`${c.chooseField} · ${dropChoice.option.label}`} onKeyDown={event => {if (event.key === "Escape") {event.preventDefault(); closeEffectDrop();}}}>
      <strong>{dropChoice.option.label}</strong><span>{c.chooseWritable}</span>
      <div>{dropChoice.fields.map((field, index) => <button ref={index === 0 ? firstEffectDropButton : undefined} type="button" key={`${field.kind}:${field.key}`} onClick={() => {
        onChange([...effects, effectFor(dropChoice.option.subject, field)]);
        closeEffectDrop();
      }}>{conditionFieldLabel(field, locale)}</button>)}<button type="button" onClick={closeEffectDrop}>{c.cancel}</button></div>
    </div> : null}
    {dropMessage ? <p className="logic-composer-drop-message" role="status">{dropMessage}</p> : null}
  </section>;
}

function LogicPresentationToken({ item }: { item: LogicPresentation }) {
  const c = conditionUiCopy(useInterfaceLocale());
  const warning = item.status === "enabled" ? "" : c[item.status];
  return <span
    className={`logic-presentation-token${item.status === "enabled" ? "" : " warning"}`}
    title={item.status === "enabled" ? item.text : `${item.text} · ${warning}`}
    style={item.color ? { "--logic-subject-color": item.color } as CSSProperties : undefined}
  >
    <i aria-hidden="true" />
    <span>{item.subjectLabel}</span>
    <b>{item.fieldLabel}</b>
    <em>{item.operatorLabel}{item.valueLabel ? ` ${item.valueLabel}` : ""}</em>
    {item.status !== "enabled" ? <CircleAlert size={10} aria-label={warning} /> : null}
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
  const locale = useInterfaceLocale();
  return <div className={`node-logic-bands${expanded ? " expanded" : ""}`}>
    {when ? <button type="button" className="node-logic-band when" onClick={onOpenWhen}>
      <GitBranch size={10} /><b>WHEN</b>
      <span className="logic-band-summary">{whenItems.length ? whenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : when}</span>
    </button> : null}
    {then ? <button type="button" className="node-logic-band then" onClick={onOpenThen}>
      <Zap size={10} /><b>THEN</b>
      <span className="logic-band-summary">{thenItems.length ? thenItems.map((item) => <LogicPresentationToken key={item.id} item={item} />) : then}</span>
    </button> : null}
    {warningCount > 0 ? <span className="node-logic-warning" title={locale === "es" ? `${warningCount} ${warningCount === 1 ? "advertencia de capacidad" : "advertencias de capacidad"}` : `${warningCount} capability warning${warningCount === 1 ? "" : "s"}`}><CircleAlert size={11} />{warningCount}</span> : null}
  </div>;
}

/** One moment editor shared by availability, choices, dialogues and guarded effects. */
export function LogicMomentEditor({project, value, onChange, hideWhen = false, locale: localeOverride, draftId, context}: {project: BranchingProject; value?: LogicMoment; onChange: (value: LogicMoment) => void; hideWhen?: boolean; locale?: ConditionUiLocale; draftId?: string; context?: ConditionAuthoringContext}) {
  const interfaceLocale = useInterfaceLocale();
  const locale = localeOverride ?? interfaceLocale;
  const c = conditionUiCopy(locale);
  const rules = value?.rules ?? [];
  return <section className="logic-moment-editor condition-ux">
    {!hideWhen ? <LogicConditionEditor project={project} context={context} draftId={draftId} value={value?.when} locale={locale} onChange={when => onChange({...value, when})}/> : null}
    <NarrativeEffectEditor project={project} context={context} draftId={draftId} value={orderedMomentEffects(value)} onChange={effects => onChange({ ...value, ...splitNarrativeEffects(effects) })} />
    <label className="condition-field">{locale === "es" ? "Aplicar cambios" : "Apply changes"}<select value={value?.repeat ?? "once"} onChange={event => onChange({ ...value, repeat: event.target.value as "once" | "each-entry" })}><option value="once">{locale === "es" ? "Una vez por recorrido" : "Once per traversal"}</option><option value="each-entry">{locale === "es" ? "Cada entrada" : "Each entry"}</option></select></label>
    {rules.map((rule, index) => <fieldset key={rule.id}><legend>{c.conditionalConsequence} · {index + 1}</legend>
      <LogicConditionEditor project={project} context={context} draftId={`${draftId ?? "moment"}:${rule.id}`} value={rule.when} locale={locale} onChange={when => onChange({...value, rules: rules.map((r, i) => i === index ? {...r, when: when ?? []} : r)})}/>
      <LogicEffectEditor project={project} draftId={`${draftId ?? "moment"}:${rule.id}`} value={rule.then} locale={locale} onChange={then => onChange({...value, rules: rules.map((r, i) => i === index ? {...r, then: (then ?? []).map(e => migrateConsequence(e, project.logicVariables ?? []))} : r)})}/>
      <button type="button" className="danger" onClick={() => onChange({...value, rules: rules.filter((_, i) => i !== index)})}>{c.removeRule}</button>
    </fieldset>)}
    <button type="button" onClick={() => onChange({...value, rules: [...rules, {id: `rule:${crypto.randomUUID()}`, when: [], then: []}]})}>{c.addRule}</button>
  </section>;
}
