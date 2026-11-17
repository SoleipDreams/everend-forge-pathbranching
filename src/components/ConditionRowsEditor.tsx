import { Fragment, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, GripVertical, ListFilter, Plus, X } from 'lucide-react';
import type { BranchingProject, Condition, ConditionInput, EntityOwner, InstanceQuery, LogicComparisonOperator, LogicPredicate, LogicSubject } from '../domain.js';
import { buildConditionCandidates, conditionKindCatalog, type ConditionAuthoringContext, type ConditionKind } from '../conditionAuthoring.js';
import { conditionValueMatchesType } from '../conditionEvaluation.js';
import { findLocalExplorerPropertyByReference } from '../explorerSchema.js';
import { conditionFieldIssues, conditionFieldLabel, conditionOperatorLabel, conditionTreeSummary } from '../conditionPresentation.js';
import { logicFieldOptions, logicOperatorsFor, logicSubjectKey, resolveLogicField, type LogicFieldOption } from '../logicCapabilities.js';
import { conditionEditorTree, editConditionNode, emptyConditionGroup, invertConditionNode, findConditionNode, canMoveConditionNode, moveConditionNodeToGroup, moveConditionNode, pendingConditionNode, removeConditionNode, serializeConditionTree, type ConditionEditorNode } from '../conditionTreeEditing.js';
import { entityCapabilities, entityDefinition } from '../authoringEntities.js';
import { characterInventoryOwnerOptions, defaultPlayerProfileId } from '../characterSheets.js';
import { ConditionReferencePicker } from './ConditionReferencePicker.js';
import { ConversationLineMenu } from './ConversationLineMenu.js';
import { useConditionReferenceCreation } from './ConditionReferenceCreationContext.js';
import { ConditionReferenceCreationDialog } from './ConditionReferenceCreationDialog.js';
import type { ConditionReferenceCreationKind } from '../conditionReferenceCreation.js';
import '../conditionRows.css';

type Props = { project: BranchingProject; value?: ConditionInput; onChange: (value: ConditionInput | undefined) => void; context?: ConditionAuthoringContext; locale: 'es' | 'en'; label?: string; emptyMessage?: string; copyFilter?: boolean; draftId?: string };
const comparisonSymbols: Partial<Record<LogicComparisonOperator, string>> = { '==': '=', '!=': '≠', '>=': '≥', '<=': '≤' };
const kinds: ConditionKind[] = ['state', 'property', 'value', 'visited', 'instanceQuery', 'external'];
function conditionHasValue(condition: Condition): boolean {
  if (condition.type === 'instanceQuery') return condition.quantifier === 'count';
  if (condition.type === 'pending') return true;
  return !['has', 'missing', 'exists'].includes((condition as LogicPredicate).operator);
}
const isKind = (value: string): value is ConditionKind => kinds.includes(value as ConditionKind);
const emptySubject = (kind: ConditionKind): LogicSubject => kind === 'value' ? { kind: 'variable', variableId: '' } : kind === 'visited' ? { kind: 'progress', targetType: 'event', targetId: '' } : kind === 'external' ? { kind: 'external', functionId: '' } : { kind: 'entity', entityId: '' };
function freshCondition(kind: ConditionKind, project: BranchingProject): Condition {
  if (kind === 'instanceQuery') return { type: kind, quantifier: 'some', owner: { kind: 'profile', profileId: defaultPlayerProfileId(project) } };
  const subject = emptySubject(kind);
  return { type: kind, subject, operator: kind === 'state' || kind === 'visited' || kind === 'external' ? 'has' : '==', ...(kind === 'state' ? { stateId: '' } : kind === 'property' ? { propertyId: '' } : {}) } as LogicPredicate;
}
function selectedField(project: BranchingProject, condition: LogicPredicate): LogicFieldOption | undefined {
  if (!condition.subject) return undefined;
  const key = condition.type === 'state' ? condition.stateId : condition.type === 'property' ? condition.propertyId : condition.type === 'value' ? 'value' : condition.type === 'visited' ? 'visited' : 'call';
  return key ? resolveLogicField(project, condition.subject, 'condition', condition.type, key) : undefined;
}
function preserveOperands(project: BranchingProject, old: Condition, next: LogicPredicate): LogicPredicate {
  const field = selectedField(project, next);
  if (!field) return next;
  const oldPredicate = old as LogicPredicate;
  const operators = logicOperatorsFor(field);
  const operator = operators.includes(oldPredicate.operator) ? oldPredicate.operator : next.operator;
  const type = ['contains', 'notContains'].includes(operator) && ['list', 'multiselect', 'entity-ref-list'].includes(field.valueType ?? '') ? 'text' : field.valueType;
  return { ...next, operator, ...(!['has', 'missing', 'exists'].includes(operator) && 'value' in old && conditionValueMatchesType(old.value, type) ? { value: old.value } : {}) } as LogicPredicate;
}
function retarget(project: BranchingProject, condition: Condition, kind: ConditionKind, subject: LogicSubject): Condition {
  let next = { ...freshCondition(kind, project), subject } as LogicPredicate;
  if (kind === 'state' || kind === 'property') {
    const fields = logicFieldOptions(project, subject, 'condition').filter(field => field.kind === kind);
    const previousKey = kind === 'state' ? (condition as { stateId?: string }).stateId : (condition as { propertyId?: string }).propertyId;
    const field = fields.find(item => item.key === previousKey);
    next = { ...next, ...(kind === 'state' ? { stateId: field?.key ?? '' } : { propertyId: field?.key ?? '' }) } as LogicPredicate;
  }
  if (kind === 'external' && condition.type === 'external' && (condition as Extract<LogicPredicate, { type: 'external' }>).subject.functionId === (subject as Extract<LogicSubject, { kind: 'external' }>).functionId) next = { ...next, arguments: (condition as Extract<LogicPredicate, { type: 'external' }>).arguments } as LogicPredicate;
  return preserveOperands(project, condition, next);
}

function NumericConditionValue({ value, onChange, label, integer = false }: { value: unknown; onChange: (value: unknown) => void; label: string; integer?: boolean }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const sent = useRef(value);
  useEffect(() => { if (!Object.is(value, sent.current)) { sent.current = value; setText(value === undefined ? '' : String(value)); } }, [value]);
  return <input className="condition-inline-value" aria-label={label} placeholder={`${label}…`} inputMode={integer ? 'numeric' : 'decimal'} value={text} onChange={event => {
    const raw = event.target.value;
    setText(raw);
    sent.current = !raw.trim() ? undefined : Number.isFinite(Number(raw)) ? Number(raw) : raw;
    onChange(sent.current);
  }} onBlur={() => { if (typeof value === 'number') setText(String(value)); }} />;
}

function ConditionValue({ project, condition, field, locale, category, context, onChange }: { project: BranchingProject; condition: LogicPredicate; field?: LogicFieldOption; locale: 'es' | 'en'; category: string; context?: ConditionAuthoringContext; onChange: (condition: Condition) => void }) {
  const es = locale === 'es', value = 'value' in condition ? condition.value : undefined;
  const valueType = field?.valueType ?? 'text';
  const set = (next: unknown) => onChange({ ...condition, value: next } as Condition);
  if (['boolean', 'bool'].includes(valueType)) return <ConditionReferencePicker label={es ? 'Valor' : 'Value'} projectId={project.projectId} category="boolean" locale={locale} searchable={false} value={value === undefined ? undefined : String(value)} candidates={[{ id: 'true', label: es ? 'Verdadero' : 'True' }, { id: 'false', label: es ? 'Falso' : 'False' }]} onChoose={id => set(id === 'true')} />;
  const property = field ? findLocalExplorerPropertyByReference(project.localExplorerProperties, field.key) : undefined;
  const objectId = condition.subject.kind === 'dataObject' ? condition.subject.objectId : undefined;
  const dataObject = objectId ? project.projectDataObjects?.find(item => item.id === objectId) : undefined;
  const dataField = project.dataClasses?.find(item => item.id === dataObject?.classId)?.fields.find(item => item.name === field?.key);
  const options = property?.options?.map(option => ({ id: String(option.value), label: option.label ?? String(option.value) })) ?? dataField?.options?.map(option => ({ id: option, label: option }));
  const refs = ['entity-ref', 'entity-ref-list', 'canonRef', 'canonRefList'].includes(valueType);
  const dataRefs = ['dataRef', 'dataRefList'].includes(valueType);
  const list = ['list', 'multiselect', 'multiSelect', 'entity-ref-list', 'canonRefList', 'dataRefList'].includes(valueType) && !['contains', 'notContains'].includes(condition.operator);
  if (refs || dataRefs || list || valueType === 'select' || valueType === 'scriptRef') {
    const targets = property?.targetTypes ?? dataField?.acceptedCanonKinds;
    const candidates = refs ? [
      ...project.canonRefs.filter(item => !targets?.length || targets.some(type => type.replace(/^type:/, '') === item.kind?.replace(/^type:/, ''))).map(item => ({ id: item.id, label: item.label ?? item.id, detail: es ? 'Canon' : 'Canon', icon: 'Box', group: context?.contextEntityIds?.includes(item.id) ? 'context' as const : 'all' as const })),
      ...(project.localExplorerEntities ?? []).filter(item => !targets?.length || targets.some(type => type.replace(/^type:/, '') === item.type.replace(/^type:/, ''))).map(item => ({ id: item.id, label: item.name, detail: es ? 'Entidad local' : 'Local entity', icon: 'Box', group: 'all' as const })),
    ] : dataRefs ? buildConditionCandidates(project, 'state', { context, locale, includeDataObjects: true }).filter(item => item.subject?.kind === 'dataObject' && (!dataField?.acceptedClasses?.length || dataField.acceptedClasses.includes(project.projectDataObjects?.find(object => item.subject?.kind === 'dataObject' && object.id === item.subject.objectId)?.classId ?? ''))).map(item => ({ ...item, id: item.subject?.kind === 'dataObject' ? item.subject.objectId : item.id })) : valueType === 'scriptRef' ? project.scripts.map(item => ({ id: item.id, label: item.sourcePath ?? item.id, detail: item.format, icon: 'CodeXml' })) : (options?.length ? options : (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(item => ({ id: String(item), label: String(item) })));
    return <ConditionReferencePicker label={es ? 'Valor' : 'Value'} projectId={project.projectId} category={`value:${category}`} locale={locale} value={list ? undefined : value === undefined ? undefined : String(value)} candidates={candidates} multiple={list} selectedIds={list && Array.isArray(value) ? value : undefined} allowCustomValue={!refs && !dataRefs && valueType !== 'scriptRef' && !options?.length} onChoose={id => set(list ? (Array.isArray(value) ? value.includes(id) ? value.filter(item => item !== id) : [...value, id] : [id]) : id)} />;
  }
  const numeric = ['number', 'integer', 'float'].includes(valueType);
  if (numeric) return <NumericConditionValue value={value} label={es ? 'Valor' : 'Value'} onChange={set} />;
  return <input className="condition-inline-value" aria-label={es ? 'Valor' : 'Value'} placeholder={es ? 'Valor…' : 'Value…'} type={valueType === 'date' ? 'date' : 'text'} inputMode={numeric ? 'decimal' : undefined} value={value === undefined ? '' : String(value)} onChange={event => { const text = event.target.value; set(numeric ? !text.trim() ? undefined : Number.isFinite(Number(text)) ? Number(text) : text : text); }} />;
}

function CopyDetails({ project, query, context, locale, onChange, draftId }: { project: BranchingProject; query: InstanceQuery; context?: ConditionAuthoringContext; locale: 'es' | 'en'; onChange: (query: InstanceQuery) => void; draftId: string }) {
  const es = locale === 'es';
  const characterOwners = characterInventoryOwnerOptions(project, locale, context);
  const characterIds = new Set(characterOwners.map(option => option.entityId));
  const protagonistId = defaultPlayerProfileId(project);
  const profiles = project.playerProfiles ?? [];
  const choices: { id: string; label: string; detail?: string; icon?: string; owner?: EntityOwner; group?: 'context' | 'nearby' | 'all' }[] = [
    { id: 'any', label: es ? 'Todos los inventarios y contenedores' : 'All inventories and containers', icon: 'PackageSearch' },
    ...(['actor', 'self', 'target'] as const).map(role => ({ id: `context:${role}`, label: es ? { actor: 'Actor', self: 'Esta entidad / copia', target: 'Destinatario' }[role] : role, owner: { kind: 'context' as const, role }, group: 'context' as const, icon: 'UserRound' })),
    ...(profiles.some(profile => profile.id === protagonistId) ? [] : [{ id: `profile:${protagonistId}`, label: es ? 'Protagonista' : 'Protagonist', owner: { kind: 'profile' as const, profileId: protagonistId }, group: 'context' as const, icon: 'UserRound' }]),
    ...profiles.map(profile => ({ id: `profile:${profile.id}`, label: profile.id === protagonistId ? es ? 'Protagonista' : 'Protagonist' : profile.name, detail: profile.id === protagonistId ? profile.name : undefined, owner: { kind: 'profile' as const, profileId: profile.id }, group: profile.id === protagonistId ? 'context' as const : 'all' as const, icon: 'UserRound' })),
    ...characterOwners.map(option => ({ id: `entity:${option.entityId}${option.variantId !== 'base' ? `:variant:${option.variantId}` : ''}`, label: option.label, detail: option.contextual ? option.context.join(' · ') || (es ? 'Personaje presente aquí' : 'Character present here') : undefined, owner: option.owner, group: option.contextual ? 'context' as const : 'all' as const, icon: 'UserRound' })),
    ...[...project.canonRefs.map(item => item.id), ...(project.localExplorerEntities ?? []).map(item => item.id)].filter(id => entityCapabilities(project, id).container && !characterIds.has(id)).map(id => ({ id: `entity:${id}`, label: entityDefinition(project, id)?.name ?? id, owner: { kind: 'entity' as const, entityId: id }, icon: 'Box' })),
    ...(project.entityInstances ?? []).filter(item => entityCapabilities(project, item.entityId).container).map(item => ({ id: `instance:${item.id}`, label: item.name ?? entityDefinition(project, item.entityId)?.name ?? item.id, detail: es ? 'Copia' : 'Copy', owner: { kind: 'instance' as const, instanceId: item.id }, icon: 'Box' })),
  ];
  const ownerId = query.owner ? query.owner.kind === 'context' ? `context:${query.owner.role}` : query.owner.kind === 'profile' ? `profile:${query.owner.profileId}` : query.owner.kind === 'entity' ? `entity:${query.owner.entityId}${query.owner.variantId && query.owner.variantId !== 'base' ? `:variant:${query.owner.variantId}` : ''}` : `instance:${query.owner.instanceId}` : 'any';
  return <div className="condition-copy-details">
    <div className="condition-copy-owner"><span>{es ? 'Dentro de' : 'Inside'}</span><ConditionReferencePicker label={es ? 'Inventario o contenedor' : 'Inventory or container'} projectId={project.projectId} category="owner" value={ownerId} candidates={choices} locale={locale} onChoose={id => onChange({ ...query, owner: choices.find(item => item.id === id)?.owner })} /></div>
    <h5>{es ? 'Filtros de la misma copia' : 'Filters on the same copy'}</h5>
    <ConditionRowsEditor key={draftId} project={project} value={query.filters} onChange={filters => onChange({ ...query, filters })} context={context} locale={locale} copyFilter draftId={draftId} />
  </div>;
}

function ConditionRow({ node, project, context, locale, copyFilter, onChange, onInvert, onMove, onRemove, first, last, canInvert, dragHandle, onMoveTo }: { node: Extract<ConditionEditorNode, { kind: 'leaf' }>; project: BranchingProject; context?: ConditionAuthoringContext; locale: 'es' | 'en'; copyFilter?: boolean; onChange: (condition: Condition) => void; onInvert: () => void; onMove: (direction: -1 | 1) => void; onRemove: () => void; first: boolean; last: boolean; canInvert: boolean; dragHandle: ReactNode; onMoveTo: () => void }) {
  const referenceCreation = useConditionReferenceCreation();
  const [creatingReference, setCreatingReference] = useState(false);
  const es = locale === 'es', condition = node.condition as Condition & { useId?: string; resultId?: string; entityId?: string; operator?: LogicComparisonOperator };
  const kind = isKind(condition.type) ? condition.type : undefined;
  const [copyExpanded, setCopyExpanded] = useState(false);
  useEffect(() => setCopyExpanded(false), [kind]);
  const catalog = conditionKindCatalog(locale).filter(item => !copyFilter || item.id === 'state' || item.id === 'property');
  const candidates = kind ? buildConditionCandidates(project, kind, { context, locale, copyFilter }) : [];
  const predicate = condition as LogicPredicate;
  const generic = kind && kind !== 'instanceQuery';
  const canCreateReference = !copyFilter && referenceCreation && ['state', 'property', 'value', 'instanceQuery', 'external'].includes(kind ?? '');
  const field = generic ? selectedField(project, predicate) : undefined;
  const fields = generic && predicate.subject ? logicFieldOptions(project, predicate.subject, 'condition').filter(item => item.kind === kind) : [];
  const reference = kind === 'instanceQuery' ? condition.entityId ? `entity:${String(condition.entityId)}` : 'any' : generic && predicate.subject ? logicSubjectKey(predicate.subject) : undefined;
  const hasReference = Boolean(kind && (kind === 'instanceQuery' || candidates.some(item => item.id === reference)));
  const operators: LogicComparisonOperator[] = kind === 'instanceQuery' ? ['==', '!=', '>', '>=', '<', '<='] : field ? logicOperatorsFor(field) : kind === 'visited' || kind === 'external' ? ['has', 'missing'] : [];
  const query = condition as unknown as InstanceQuery;
  const errors = kind && generic && hasReference ? conditionFieldIssues(project, predicate, locale).filter(issue => issue.field !== 'field' || Boolean(field)) : [];
  const negated = node.notLabels.length % 2 === 1;

  const pickKind = (id: string) => {
    const nextKind = id as ConditionKind;
    if (nextKind === kind) return;
    const nextCandidates = buildConditionCandidates(project, nextKind, { context, locale, copyFilter });
    const compatible = nextCandidates.find(item => item.id === reference);
    onChange(compatible?.subject ? retarget(project, condition, nextKind, compatible.subject) : freshCondition(nextKind, project));
  };
  const changeReference = (id: string) => {
    const candidate = candidates.find(item => item.id === id);
    if (kind === 'instanceQuery') onChange({ ...query, entityId: id === 'any' ? undefined : candidate?.entityId });
    else if (kind && candidate?.subject) onChange(retarget(project, condition, kind, candidate.subject));
  };
  const changeField = (id: string) => {
    const selected = fields.find(item => item.key === id);
    if (!selected || !generic) return;
    const next = { ...freshCondition(kind!, project), subject: predicate.subject, ...(kind === 'state' ? { stateId: id } : { propertyId: id }) } as LogicPredicate;
    onChange(preserveOperands(project, condition, next));
  };
  const changeOperator = (id: string) => {
    const next = { ...condition, operator: id } as Condition & { value?: unknown };
    const operandType = ['contains', 'notContains'].includes(id) && ['list', 'multiselect', 'multiSelect', 'entity-ref-list', 'canonRefList', 'dataRefList'].includes(field?.valueType ?? '') ? 'text' : field?.valueType;
    if (['has', 'missing', 'exists'].includes(id) || generic && !conditionValueMatchesType(next.value, operandType)) delete next.value;
    onChange(next);
  };
  const hasValue = conditionHasValue(node.condition);
  const pendingMessage = !kind ? es ? 'Elige el tipo para comenzar.' : 'Choose a type to begin.' : !hasReference ? kind === 'state' || kind === 'property' ? es ? 'Selecciona una entidad disponible.' : 'Choose an available entity.' : es ? 'Selecciona una referencia disponible.' : 'Choose an available reference.' : (kind === 'state' || kind === 'property') && !field ? es ? 'Selecciona el estado o la propiedad.' : 'Choose a state or property.' : '';
  const feedback = [...new Set([pendingMessage, ...errors.map(item => item.message)].filter(Boolean))].join(' ');
  const shortNames: Record<string, string> = es ? { state: 'Estado', property: 'Prop.', value: 'Variable', visited: 'Visitas', instanceQuery: 'Copias', external: 'Función' } : { state: 'State', property: 'Property', value: 'Variable', visited: 'Progress', instanceQuery: 'Inventory', external: 'Function' };
  const referenceLabel = kind === 'value' ? 'Variable' : kind === 'external' ? es ? 'Función' : 'Function' : kind === 'instanceQuery' ? es ? 'Ítem' : 'Item' : kind === 'visited' ? es ? 'Progreso' : 'Progress' : kind === 'state' || kind === 'property' ? es ? 'Entidad' : 'Entity' : es ? 'Referencia' : 'Reference';
  const referencePickerLabel = kind === 'value' ? es ? 'Variable de la condición' : 'Condition variable' : kind === 'external' ? es ? 'Función de la condición' : 'Condition function' : kind === 'instanceQuery' ? es ? 'Ítem de inventario' : 'Inventory item' : kind === 'visited' ? es ? 'Referencia de progreso' : 'Progress reference' : kind === 'state' || kind === 'property' ? es ? 'Entidad de la condición' : 'Condition entity' : es ? 'Referencia de condición' : 'Condition reference';
  if (condition.type === 'interactionResult') {
    const interaction = project.events.flatMap(event => (event.interactionUses ?? []).map(use => ({ use, definition: event.interactionDefinitions?.find(item => item.id === use.definitionId) }))).find(item => item.use.id === condition.useId);
    const result = interaction?.definition?.results.find(item => item.id === condition.resultId);
    return <div className="condition-row-shell condition-managed-interaction" data-condition-row={node.id} role="note">
      <span>{es ? 'Gestionado desde Interacciones' : 'Managed from Interactions'}</span>
      <small>{[interaction?.definition?.name, result?.name].filter(Boolean).join(' · ') || (es ? 'La interacción o su resultado ya no existe' : 'The interaction or its result no longer exists')}</small>
    </div>;
  }
  return <div className={`condition-row-shell${negated ? ' is-negated' : ''}`} data-condition-row={node.id} data-onboarding-target="pathbranching.condition">
    <div className={`condition-inline-row${hasValue ? '' : ' has-no-value'}`}>
      {dragHandle}
      <div className="condition-inline-field"><span>{es ? 'Tipo' : 'Type'}</span><ConditionReferencePicker label={es ? 'Tipo de condición' : 'Condition type'} projectId={project.projectId} category="condition-kind" locale={locale} searchable={false} autoOpen={node.autoOpen && !kind} value={kind} placeholder={es ? 'Elegir tipo…' : 'Choose type…'} candidates={catalog.map(item => ({ id: item.id, label: item.label, shortLabel: shortNames[item.id], detail: item.description, icon: item.icon }))} onChoose={pickKind} /></div>
      <div className="condition-inline-field"><span>{referenceLabel}</span><ConditionReferencePicker key={kind ?? 'pending'} label={referencePickerLabel} projectId={project.projectId} category={kind ?? 'pending'} locale={locale} leadingAction={canCreateReference ? { label: kind === 'value' ? es ? 'Crear variable…' : 'Create variable…' : kind === 'external' ? es ? 'Crear función…' : 'Create function…' : es ? 'Crear entidad…' : 'Create entity…', onChoose: () => setCreatingReference(true) } : undefined} placeholder={kind === 'state' || kind === 'property' ? es ? 'Entidad…' : 'Entity…' : kind === 'value' ? es ? 'Variable…' : 'Variable…' : kind === 'external' ? es ? 'Función…' : 'Function…' : kind === 'instanceQuery' ? es ? 'Ítem…' : 'Item…' : kind === 'visited' ? es ? 'Evento…' : 'Event…' : es ? 'Referencia…' : 'Reference…'} disabled={!kind} value={reference && !reference.endsWith(':') ? reference : undefined} candidates={kind === 'instanceQuery' ? [{ id: 'any', label: es ? 'Cualquier ítem de inventario' : 'Any inventory item', detail: es ? 'Tipos habilitados para inventario/copias' : 'Types enabled for inventory/copies', icon: 'PackageSearch', group: 'context' }, ...candidates] : candidates} onChoose={changeReference} /></div>
      <div className="condition-inline-field"><span>{es ? 'Modificador' : 'Modifier'}</span><div className={`condition-modifier-fields${field && ['number', 'integer', 'float'].includes(field.valueType ?? '') || kind === 'instanceQuery' && query.quantifier === 'count' ? ' has-symbol-operator' : ''}`}>
        {kind === 'state' || kind === 'property' ? <ConditionReferencePicker label={kind === 'state' ? es ? 'Estado' : 'State' : es ? 'Propiedad' : 'Property'} projectId={project.projectId} category={`field:${kind}`} locale={locale} disabled={!hasReference} value={kind === 'state' ? predicate.type === 'state' && predicate.stateId || undefined : predicate.type === 'property' && predicate.propertyId || undefined} placeholder={es ? kind === 'state' ? 'Estado…' : 'Propiedad…' : kind === 'state' ? 'State…' : 'Property…'} candidates={fields.map(item => ({ id: item.key, label: conditionFieldLabel(item, locale), icon: kind === 'state' ? 'CircleCheck' : 'SlidersHorizontal' }))} onChoose={changeField} /> : null}
        {kind === 'instanceQuery' ? <ConditionReferencePicker label={es ? 'Copias que cumplen' : 'Matching copies'} projectId={project.projectId} category="quantifier" locale={locale} searchable={false} value={query.quantifier} candidates={[{ id: 'some', label: es ? 'Alguna copia' : 'Some copy' }, { id: 'all', label: es ? 'Todas las copias' : 'All copies' }, { id: 'count', label: es ? 'Cantidad' : 'Count' }]} onChoose={id => onChange({ ...query, quantifier: id as InstanceQuery['quantifier'], ...(id === 'count' ? { operator: query.operator ?? '>=', value: query.value } : { operator: undefined, value: undefined }) })} /> : null}
        {kind && (kind !== 'instanceQuery' || query.quantifier === 'count') ? <ConditionReferencePicker label={es ? 'Comparación' : 'Comparison'} projectId={project.projectId} category="operator" locale={locale} searchable={false} disabled={!hasReference || !operators.length} placeholder={es ? 'Comparación…' : 'Comparison…'} value={operators.includes(condition.operator as LogicComparisonOperator) ? String(condition.operator) : undefined} candidates={operators.map(operator => ({ id: operator, label: (field?.valueType === 'number' || field?.valueType === 'integer' || field?.valueType === 'float' || kind === 'instanceQuery') ? (comparisonSymbols[operator] ?? operator) : kind === 'visited' ? es ? operator === 'has' ? 'Ha sido visitado' : 'No ha sido visitado' : operator === 'has' ? 'Visited' : 'Not visited' : conditionOperatorLabel({ ...predicate, operator } as LogicPredicate, locale), detail: conditionOperatorLabel({ ...predicate, type: 'value', operator } as LogicPredicate, locale) }))} onChoose={changeOperator} /> : !kind ? <button type="button" disabled>{es ? 'Elegir modificador…' : 'Choose modifier…'}</button> : null}
      </div></div>
      {hasValue ? <div className="condition-inline-field condition-value-field"><span>{es ? 'Valor' : 'Value'}</span>{kind === 'instanceQuery' ? query.quantifier === 'count' ? <NumericConditionValue value={query.value} label={es ? 'Cantidad de copias' : 'Copy count'} integer onChange={value => onChange({ ...query, value: value as number | undefined })} /> : <input className="condition-inline-value" aria-label={es ? 'Valor' : 'Value'} placeholder={es ? 'Valor…' : 'Value…'} disabled /> : generic && !['has', 'missing', 'exists'].includes(predicate.operator) && hasReference && field ? <ConditionValue project={project} condition={predicate} field={field} locale={locale} context={context} category={kind!} onChange={onChange} /> : <input className="condition-inline-value" aria-label={es ? 'Valor' : 'Value'} placeholder={es ? 'Valor…' : 'Value…'} disabled />}</div> : null}
      <div className="condition-row-tools">
        {feedback ? <details className="condition-row-feedback"><summary title={feedback} aria-label={feedback}>{negated ? <span className="condition-negation-mark" aria-label={es ? 'Resultado invertido' : 'Inverted result'}>NO</span> : <CircleAlert size={14} />}</summary><p role="status">{negated ? es ? 'Se cumple cuando esta condición es falsa. ' : 'Matches when this condition is false. ' : ''}{feedback}</p></details> : negated ? <span className="condition-negation-mark" title={es ? 'Se cumple cuando esta condición es falsa.' : 'Matches when this condition is false.'} aria-label={es ? 'Resultado invertido' : 'Inverted result'}>NO</span> : null}
        {kind === 'instanceQuery' ? <button type="button" className="condition-copy-settings" aria-label={es ? 'Inventario y filtros de la misma copia' : 'Inventory and same-copy filters'} title={es ? 'Inventario y filtros de la misma copia' : 'Inventory and same-copy filters'} aria-expanded={copyExpanded} aria-controls={`condition-copy-${node.id}`} onClick={() => setCopyExpanded(current => !current)}><ListFilter size={14} /></button> : null}
        <div className="condition-row-menu"><ConversationLineMenu className="condition-actions-trigger" label={es ? 'Acciones de condición' : 'Condition actions'} options={[
        { label: es ? 'Invertir resultado' : 'Invert result', disabled: !canInvert, run: onInvert },
        { label: es ? 'Mover arriba' : 'Move up', disabled: first, run: () => onMove(-1) },
        { label: es ? 'Mover abajo' : 'Move down', disabled: last, run: () => onMove(1) },
        { label: es ? 'Mover a grupo…' : 'Move to group…', run: onMoveTo },
        { label: es ? 'Eliminar condición' : 'Delete condition', danger: true, run: onRemove },
      ]} /></div>
      </div>
    </div>
    {kind === 'instanceQuery' && copyExpanded ? <div id={`condition-copy-${node.id}`} className="condition-copy-details-panel" role="region" aria-label={es ? 'Inventario y filtros de la misma copia' : 'Inventory and same-copy filters'}><CopyDetails project={project} query={query} locale={locale} context={context} onChange={onChange} draftId={node.id} /></div> : null}
    {creatingReference && canCreateReference ? <ConditionReferenceCreationDialog project={project} kind={kind as ConditionReferenceCreationKind} condition={condition} locale={locale} propertiesConfig={referenceCreation.propertiesConfig}
      onCancel={() => setCreatingReference(false)} onCreate={draft => { referenceCreation.create(draft, onChange); setCreatingReference(false); }} /> : null}
  </div>;
}

type DropPreview = { source: string; parentId: string; index: number };

/** Pointer capture avoids WebView2's native file-drop interception. */
function ConditionDragHandle({ nodeId, name, tree, scope, locale, onPreview, onDrop, onStep }: {
  nodeId: string; name: string; tree: ConditionEditorNode; scope: RefObject<HTMLElement | null>; locale: 'es' | 'en';
  onPreview: (target?: DropPreview) => void; onDrop: (parentId: string, index: number) => void; onStep: (direction: -1 | 1) => void;
}) {
  const es = locale === 'es', currentTree = useRef(tree);
  currentTree.current = tree;
  const gesture = useRef<{ pointerId: number; x: number; y: number; tree: ConditionEditorNode; moved: boolean; target?: DropPreview } | undefined>(undefined);
  const clear = () => { gesture.current = undefined; onPreview(undefined); };
  useEffect(() => () => { gesture.current = undefined; }, []);
  return <button type="button" className="condition-drag-handle" aria-label={`${es ? 'Arrastrar' : 'Drag'} ${name}`} title={es ? 'Arrastra para mover. Flechas arriba/abajo para ordenar.' : 'Drag to move. Up/down arrows reorder.'}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault(); event.stopPropagation();
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tree, moved: false };
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId || active.tree !== currentTree.current) { if (active) clear(); return; }
      event.stopPropagation();
      active.moved ||= Math.hypot(event.clientX - active.x, event.clientY - active.y) >= 6;
      if (!active.moved) return;
      const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      let target: DropPreview | undefined;
      if (hit?.closest('[data-condition-editor-instance]') === scope.current) {
        const slot = hit.closest<HTMLElement>('[data-condition-drop-parent]');
        const header = hit.closest<HTMLElement>('[data-condition-group-header]');
        const wrapper = hit.closest<HTMLElement>('[data-condition-node-id]');
        const group = hit.closest<HTMLElement>('[data-condition-group-id]');
        if (slot) target = { source: nodeId, parentId: slot.dataset.conditionDropParent!, index: Number(slot.dataset.conditionDropIndex) };
        else if (header || !wrapper && group) {
          const parentId = header?.dataset.conditionGroupHeader ?? group!.dataset.conditionGroupId!;
          const parent = findConditionNode(tree, parentId);
          if (parent?.kind === 'group') target = { source: nodeId, parentId, index: parent.children.length };
        } else if (wrapper) {
          const bounds = wrapper.getBoundingClientRect();
          target = { source: nodeId, parentId: wrapper.dataset.conditionParentId!, index: Number(wrapper.dataset.conditionIndex) + (event.clientY >= bounds.top + bounds.height / 2 ? 1 : 0) };
        }
        // Scroll only this inspector's closest scrollable ancestor.
        for (let element: HTMLElement | null = scope.current; element; element = element.parentElement) {
          if (element.scrollHeight <= element.clientHeight || !/(auto|scroll)/.test(getComputedStyle(element).overflowY)) continue;
          const bounds = element.getBoundingClientRect();
          element.scrollBy(0, event.clientY < bounds.top + 32 ? -18 : event.clientY > bounds.bottom - 32 ? 18 : 0);
          break;
        }
      }
      active.target = target && canMoveConditionNode(tree, nodeId, target.parentId) ? target : undefined;
      onPreview(active.target);
    }} onPointerUp={event => {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const target = active.tree === currentTree.current && active.moved ? active.target : undefined;
      clear();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (target) onDrop(target.parentId, target.index);
    }} onPointerCancel={clear} onLostPointerCapture={clear} onClick={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); clear(); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); onStep(event.key === 'ArrowUp' ? -1 : 1); }
    }}><GripVertical size={14} aria-hidden="true" /></button>;
}

export function ConditionRowsEditor({ project, value, onChange, context, locale, label, emptyMessage, copyFilter, draftId }: Props) {
  const es = locale === 'es';
  const instanceId = useId(), scope = useRef<HTMLElement>(null);
  const [dropPreview, setDropPreview] = useState<{ source: string; parentId: string; index: number }>();
  const [movingId, setMovingId] = useState<string>();
  const [root, setRoot] = useState(() => conditionEditorTree(value));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const external = JSON.stringify(value ?? null);
  const lastValue = useRef(external);
  const receivedValue = useRef(external);
  const scopeKey = JSON.stringify([project.projectId, draftId, Boolean(copyFilter)]), receivedScope = useRef(scopeKey);
  useEffect(() => {
    const changedScope = receivedScope.current !== scopeKey;
    if (!changedScope && external === receivedValue.current) return;
    receivedScope.current = scopeKey;
    receivedValue.current = external;
    if (!changedScope && external === lastValue.current) return;
    lastValue.current = external;
    setRoot(conditionEditorTree(value));
    setCollapsed(new Set());
    setDropPreview(undefined);
    setMovingId(undefined);
  }, [external, value, scopeKey]);
  const commit = (next: ConditionEditorNode) => {
    const serialized = serializeConditionTree(next);
    const nextValue = JSON.stringify(serialized ?? null);
    // Empty editor actions can serialize to the current value; do not schedule a no-op document save.
    const changed = nextValue !== external;
    lastValue.current = nextValue;
    setRoot(next);
    if (changed) onChange(serialized);
  };
  const edit = (id: string, transform: (node: ConditionEditorNode) => ConditionEditorNode) => commit(editConditionNode(root, id, transform));
  const leafCount = (node: ConditionEditorNode): number => node.kind === 'leaf' ? 1 : node.children.reduce((count, child) => count + leafCount(child), 0);
  const groupDestinations = (source: string) => {
    const candidates: { id: string; label: string; detail: string }[] = [];
    const walk = (node: ConditionEditorNode, path: string) => {
      if (node.kind !== 'group') return;
      if (canMoveConditionNode(root, source, node.id)) candidates.push({ id: node.id, label: node === root ? label || (es ? 'Se ofrece cuando' : 'When available') : node.label || `${es ? 'Grupo' : 'Group'} ${path}`, detail: path });
      node.children.forEach((child, index) => walk(child, `${path}.${index + 1}`));
    };
    walk(root, '1'); return candidates;
  };
  const moveTo = (source: string, parentId: string, index?: number) => {
    const next = moveConditionNodeToGroup(root, source, parentId, index);
    if (next !== root) {
      commit(next);
      requestAnimationFrame(() => scope.current?.querySelector<HTMLButtonElement>(`[data-condition-node-id="${source}"] .condition-drag-handle`)?.focus({ preventScroll: true }));
    }
    setMovingId(undefined); setDropPreview(undefined);
  };
  const dragHandle = (node: ConditionEditorNode, name: string) => <ConditionDragHandle nodeId={node.id} name={name} tree={root} scope={scope} locale={locale} onPreview={setDropPreview} onDrop={(parentId, index) => moveTo(node.id, parentId, index)} onStep={direction => commit(moveConditionNode(root, node.id, direction))} />;
  const render = (node: ConditionEditorNode, depth: number, path: string, first = true, last = true): React.ReactNode => {
    const nodeDepth = (current: ConditionEditorNode): number => current.notLabels.length + (current.kind === 'group' && current.children.length ? 1 + Math.max(...current.children.map(nodeDepth)) : 0);
    const canAdd = depth + node.notLabels.length + 1 <= 64;
    const canAddGroup = depth + node.notLabels.length + 2 <= 64;
    const canInvert = depth + nodeDepth(node) + 1 <= 64;
    if (node.kind === 'leaf') return <ConditionRow key={node.id} node={node} project={project} context={context} locale={locale} copyFilter={copyFilter} first={first} last={last} dragHandle={dragHandle(node, es ? 'condición' : 'condition')} onMoveTo={() => setMovingId(node.id)} canInvert={canInvert || node.notLabels.length % 2 === 1} onChange={condition => edit(node.id, current => ({ ...current, kind: 'leaf', condition, autoOpen: false }))} onInvert={() => edit(node.id, invertConditionNode)} onMove={direction => commit(moveConditionNode(root, node.id, direction))} onRemove={() => commit(removeConditionNode(root, node.id))} />;
    const negated = node.notLabels.length % 2 === 1, isCollapsed = depth > 0 && collapsed.has(node.id);
    const groupToggleTitle = negated
      ? es ? 'Resultado invertido. Pulsa para volver a SÍ.' : 'Result is inverted. Click to return to YES.'
      : es ? 'Resultado afirmativo. Pulsa para convertirlo en NO.' : 'Affirmative result. Click to change it to NO.';
    const firstLeafIndex = node.children.findIndex(child => child.kind === 'leaf');
    const append = (child: ConditionEditorNode) => edit(node.id, current => current.kind === 'group' ? { ...current, children: [...current.children, child] } : current);
    return <section key={node.id} className={`condition-friendly-group${negated ? ' is-negated' : ''}${depth >= 3 ? ' is-deep' : ''}`} aria-label={depth === 0 ? label || (es ? 'Se ofrece cuando' : 'When available') : node.label || (es ? `Grupo ${path}` : `Group ${path}`)} data-condition-group={path} data-condition-group-id={node.id} data-dragging={dropPreview?.source === node.id || undefined} data-drop-active={dropPreview?.parentId === node.id || undefined}>
      <header className="condition-friendly-group-header" data-condition-group-header={node.id}>
        {depth > 0 ? dragHandle(node, node.label || `${es ? 'grupo' : 'group'} ${path}`) : null}
        {depth > 0 ? <button type="button" className="condition-group-collapse" aria-expanded={!isCollapsed} aria-label={es ? `${isCollapsed ? 'Desplegar' : 'Plegar'} grupo ${path}` : `${isCollapsed ? 'Expand' : 'Collapse'} group ${path}`} onClick={() => setCollapsed(current => { const next = new Set(current); next.has(node.id) ? next.delete(node.id) : next.add(node.id); return next; })}>{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button> : null}
        {depth > 0 ? <span className="condition-group-name">{node.label || `${es ? 'Grupo' : 'Group'} ${path}`}</span> : <strong className="condition-group-root-label" title={label || undefined}>{label || (es ? 'Condiciones' : 'Conditions')}</strong>}
        <button type="button" className={`condition-group-negate${negated ? ' active' : ''}`} disabled={!canInvert && !negated} aria-label={es ? 'Invertir resultado del grupo' : 'Invert group result'} title={groupToggleTitle} aria-pressed={negated} onClick={() => edit(node.id, invertConditionNode)}>{negated ? 'NO' : es ? 'SÍ' : 'YES'}</button>
        {depth === 0 && es ? <span className="condition-group-link-word">se</span> : null}
        <div className="condition-group-mode"><ConditionReferencePicker label={`${es ? 'Modo del grupo' : 'Group mode'} ${path}`} projectId={project.projectId} category="condition-group-mode" locale={locale} searchable={false} value={node.mode} candidates={[{ id: 'all', label: depth === 0 ? es ? 'cumplan todas' : 'all conditions are met' : es ? 'Cumplir todas' : 'Match all', shortLabel: depth === 0 ? es ? 'todas' : 'all' : es ? 'Todas' : 'All', detail: es ? 'Cada condición y grupo debe cumplirse.' : 'Every condition and group must match.' }, { id: 'any', label: depth === 0 ? es ? 'cumpla cualquiera' : 'any condition is met' : es ? 'Cumplir cualquiera' : 'Match any', shortLabel: depth === 0 ? es ? 'cualquiera' : 'any' : es ? 'Cualquiera' : 'Any', detail: es ? 'Basta con que una condición o grupo se cumpla.' : 'At least one condition or group must match.' }]} onChoose={mode => edit(node.id, current => current.kind === 'group' ? { ...current, mode: mode as 'all' | 'any' } : current)} /></div>
        {depth >= 3 ? <small className="condition-group-path">{path}</small> : null}
        {depth > 0 ? <small className="condition-group-count">{leafCount(node)}</small> : <span className="condition-group-header-spacer" aria-hidden="true" />}
        {depth === 0 ? <small className="condition-group-summary" title={summaryText}>{summaryText}</small> : null}
        <div className="condition-row-menu"><ConversationLineMenu className="condition-actions-trigger" label={es ? 'Acciones del grupo' : 'Group actions'} options={[
          ...(depth > 0 ? [
            { label: es ? 'Mover arriba' : 'Move up', disabled: first, run: () => commit(moveConditionNode(root, node.id, -1)) },
            { label: es ? 'Mover abajo' : 'Move down', disabled: last, run: () => commit(moveConditionNode(root, node.id, 1)) },
            { label: es ? 'Mover a grupo…' : 'Move to group…', run: () => setMovingId(node.id) },
          ] : []),
          { label: es ? depth ? 'Eliminar grupo' : 'Quitar todas las condiciones' : depth ? 'Delete group' : 'Clear conditions', disabled: depth === 0 && leafCount(node) === 0, danger: true, run: () => commit(depth ? removeConditionNode(root, node.id) : emptyConditionGroup()) },
        ]} /></div>
      </header>
      {!isCollapsed ? <div className="condition-group-body">

        <div className="condition-group-children">{node.children.map((child, index) => <Fragment key={child.id}>
        {index === firstLeafIndex ? <div className="condition-column-headings" aria-hidden="true"><span /><span>{es ? 'Tipo' : 'Type'}</span><span>{es ? 'Entidad' : 'Entity'}</span><span>{es ? 'Modificador' : 'Modifier'}</span><span>{node.children.some(child => child.kind === 'leaf' && conditionHasValue(child.condition)) ? es ? 'Valor' : 'Value' : ''}</span><span /></div> : null}
          <div className="condition-drop-slot" data-condition-drop-parent={node.id} data-condition-drop-index={index} data-active={dropPreview?.parentId === node.id && dropPreview.index === index || undefined} />
          <div className="condition-node-wrapper" data-condition-node-id={child.id} data-condition-parent-id={node.id} data-condition-index={index} data-dragging={dropPreview?.source === child.id || undefined}>{render(child, depth + 1 + node.notLabels.length, `${path}.${index + 1}`, index === 0, index === node.children.length - 1)}</div>
        </Fragment>)}<div className="condition-drop-slot" data-condition-drop-parent={node.id} data-condition-drop-index={node.children.length} data-active={dropPreview?.parentId === node.id && dropPreview.index === node.children.length || undefined} /></div>
        {!node.children.length ? <p className="condition-empty" role="status">{depth ? es ? 'Añade una condición o elimina este grupo.' : 'Add a condition or remove this group.' : emptyMessage ?? (es ? 'Sin condiciones.' : 'No conditions.')}</p> : null}
        <footer className="condition-group-add"><button type="button" data-onboarding-target={depth === 0 ? 'pathbranching.condition-add' : undefined} disabled={!canAdd} onClick={() => append(pendingConditionNode())}><Plus size={14} />{es ? 'Condición' : 'Condition'}</button><button type="button" disabled={!canAddGroup} onClick={() => append(emptyConditionGroup())}><Plus size={14} />{es ? 'Grupo' : 'Group'}</button></footer>
      </div> : null}
    </section>;
  };
  const summary = conditionTreeSummary(project, value, locale);
  const hasPendingStructure = (node: ConditionEditorNode): boolean => node.kind === 'leaf' ? node.condition.type === 'pending' : Boolean(node !== root && !node.children.length) || node.children.some(hasPendingStructure);
  const summaryText = hasPendingStructure(root) ? es ? 'Condiciones pendientes de completar' : 'Conditions to complete' : summary.text;
  return <section ref={scope} className="logic-composer condition-ux condition-rows-editor" data-condition-editor={draftId} data-condition-editor-instance={instanceId}>
    {movingId ? <div className="condition-move-panel" role="dialog" aria-label={es ? 'Mover a grupo' : 'Move to group'}><ConditionReferencePicker label={es ? 'Grupo de destino' : 'Destination group'} projectId={project.projectId} category="condition-move-group" locale={locale} autoOpen candidates={groupDestinations(movingId)} onChoose={parentId => moveTo(movingId, parentId)} /><button type="button" aria-label={es ? 'Cancelar movimiento' : 'Cancel move'} onClick={() => setMovingId(undefined)}><X size={16} /></button></div> : null}
    {render(root, 0, '1')}
  </section>;
}
