import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { BranchingProject, Condition, EntityRuntimeStateRole, LogicVariableType, LocalExplorerPropertyValueType } from '../domain.js';
import { conditionCreationPropertyOptions, type ConditionReferenceCreationKind, type ConditionReferenceDraft } from '../conditionReferenceCreation.js';
import { canonExplorerTypes, explorerTypeLabel } from '../explorerSchema.js';
import { useOverlayFocus } from './useOverlayFocus.js';
import './conditionReferenceCreation.css';

const numericType = (type: string) => ['number', 'integer', 'float'].includes(type);

export function ConditionReferenceCreationDialog({ project, kind, condition, locale, propertiesConfig, onCancel, onCreate }: {
  project: BranchingProject; kind: ConditionReferenceCreationKind; condition: Condition; locale: 'es' | 'en';
  propertiesConfig?: Record<string, unknown>; onCancel: () => void; onCreate: (draft: ConditionReferenceDraft) => void;
}) {
  const es = locale === 'es', variable = kind === 'value', external = kind === 'external';
  const dialog = useRef<HTMLDivElement>(null);
  useOverlayFocus(dialog, true, onCancel, true, '[data-reference-name]');
  const [name, setName] = useState('');
  const [variableType, setVariableType] = useState<LogicVariableType>('number');
  const typeIds = [...new Set([
    ...canonExplorerTypes(propertiesConfig).map(type => type.id),
    ...(project.localExplorerProperties ?? []).filter(item => item.valueType === 'entity-type').map(item => item.id.replace(/^type:/, '')),
    ...(project.localExplorerTypes ?? []).map(item => item.id.replace(/^type:/, '')),
    ...project.canonRefs.map(item => item.kind).filter((type): type is string => Boolean(type)),
    ...(project.localExplorerEntities ?? []).map(item => item.type.replace(/^type:/, '')),
  ])];
  const [entityType, setEntityType] = useState(typeIds[0] ?? 'concept');
  const [stateId, setStateId] = useState<EntityRuntimeStateRole>(condition.type === 'state' && typeof condition.stateId === 'string' && ['owned', 'unlocked', 'discovered', 'present'].includes(condition.stateId) ? condition.stateId as EntityRuntimeStateRole : 'owned');
  const fields = conditionCreationPropertyOptions(project, entityType);
  const [propertyId, setPropertyId] = useState<string>(condition.type === 'property' && typeof condition.propertyId === 'string' && fields.some(field => field.id === condition.propertyId) ? condition.propertyId : fields[0]?.id ?? '@new');
  const [propertyName, setPropertyName] = useState('');
  const [newPropertyType, setNewPropertyType] = useState<LocalExplorerPropertyValueType>('number');
  const [value, setValue] = useState(() => variable || numericType(propertyId === '@new' ? newPropertyType : fields.find(field => field.id === propertyId)?.valueType ?? 'text') ? '0' : '');
  const [bool, setBool] = useState(false);
  const [copy, setCopy] = useState(false);
  const [groupId, setGroupId] = useState(project.logicVariableGroups?.[0]?.id ?? 'default');
  const [error, setError] = useState<string>();
  const valueType = variable ? variableType : propertyId === '@new' ? newPropertyType : fields.find(field => field.id === propertyId)?.valueType ?? 'text';
  const changeValueType = (type: string) => { setValue(numericType(type) ? '0' : ''); setBool(false); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const initialValue = ['boolean', 'bool'].includes(valueType) ? bool : numericType(valueType) ? value.trim() ? Number(value) : NaN
        : ['list', 'multiselect', 'entity-ref-list', 'canonRefList'].includes(valueType) ? value.split('\n').map(item => item.trim()).filter(Boolean) : value;
      onCreate({ kind, name, condition, ...(variable ? { variableType, initialValue, groupId } : external ? {} : {
        entityType, stateId, ...(kind === 'property' ? { propertyId: propertyId === '@new' ? undefined : propertyId, initialValue,
          ...(propertyId === '@new' ? { newProperty: { name: propertyName, valueType: newPropertyType } } : {}) } : { addInventoryCopy: copy }),
      }) });
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  };
  const title = variable ? es ? 'Crear variable' : 'Create variable' : external ? es ? 'Crear función' : 'Create function' : es ? 'Crear entidad' : 'Create entity';
  const initialField = <label className="field-label">{es ? 'Valor inicial' : 'Initial value'}
    {['boolean', 'bool'].includes(valueType) ? <select value={String(bool)} onChange={e => setBool(e.target.value === 'true')}><option value="false">{es ? 'Falso' : 'False'}</option><option value="true">{es ? 'Verdadero' : 'True'}</option></select>
      : ['list', 'multiselect', 'entity-ref-list', 'canonRefList'].includes(valueType) ? <textarea value={value} placeholder={es ? 'Un valor por línea' : 'One value per line'} onChange={e => setValue(e.target.value)} />
      : ['canonRef', 'entity-ref'].includes(valueType) ? <select value={value} onChange={e => setValue(e.target.value)}><option value="">{es ? 'Sin entidad inicial' : 'No initial entity'}</option>{[...project.canonRefs.map(item => ({ id: item.id, label: item.label ?? item.id })), ...(project.localExplorerEntities ?? []).map(item => ({ id: item.id, label: item.name }))].map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      : <input type={valueType === 'date' ? 'date' : 'text'} inputMode={numericType(valueType) ? 'decimal' : undefined} value={value} onChange={e => setValue(e.target.value)} />}
  </label>;
  return createPortal(<div className="condition-reference-create-backdrop"><div className="condition-reference-create-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button type="button" aria-label={es ? 'Cerrar creación' : 'Close creation'} onClick={onCancel}><X size={18} /></button></header>
    <p>{variable ? es ? 'Se añadirá a las variables de esta historia y quedará seleccionada en la condición.' : 'Add it to this story and select it in the condition.'
      : external ? es ? 'Se declarará como función externa de condición y quedará seleccionada en esta condición.' : 'Declare it as an external condition function and select it here.'
      : es ? 'Se creará como entidad local de esta historia y quedará seleccionada en la condición.' : 'Create a local entity for this story and select it in the condition.'}</p>
    <form onSubmit={submit}>
      <label className="field-label">{es ? 'Nombre' : 'Name'}<input data-reference-name value={name} onChange={e => setName(e.target.value)} required /></label>
      {variable ? <>
        <label className="field-label">{es ? 'Tipo de variable' : 'Variable type'}<select value={variableType} onChange={e => { setVariableType(e.target.value as LogicVariableType); changeValueType(e.target.value); }}>
          <option value="number">{es ? 'Número' : 'Number'}</option><option value="text">{es ? 'Texto' : 'Text'}</option><option value="boolean">{es ? 'Verdadero / falso' : 'Boolean'}</option><option value="list">{es ? 'Lista de textos' : 'Text list'}</option><option value="canonRef">{es ? 'Referencia a entidad' : 'Entity reference'}</option>
        </select></label>
        {(project.logicVariableGroups?.length ?? 0) > 1 ? <label className="field-label">{es ? 'Grupo' : 'Group'}<select value={groupId} onChange={e => setGroupId(e.target.value)}>{project.logicVariableGroups!.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label> : null}
        {initialField}
      </> : external ? null : <>
        <label className="field-label">{es ? 'Tipo de entidad' : 'Entity type'}{typeIds.length ? <select value={entityType} onChange={e => { setEntityType(e.target.value); const field = conditionCreationPropertyOptions(project, e.target.value)[0]; setPropertyId(field?.id ?? '@new'); changeValueType(field?.valueType ?? newPropertyType); }}>{typeIds.map(type => <option key={type} value={type}>{explorerTypeLabel(project, 'local', type, propertiesConfig)}</option>)}</select> : <input value={entityType} onChange={e => setEntityType(e.target.value)} required />}</label>
        {kind === 'state' ? <label className="field-label">{es ? 'Estado que se comprobará' : 'State to check'}<select value={stateId} onChange={e => setStateId(e.target.value as EntityRuntimeStateRole)}>{(['owned', 'unlocked', 'discovered', 'present'] as const).map(state => <option key={state} value={state}>{es ? { owned: 'Poseído', unlocked: 'Desbloqueado', discovered: 'Descubierto', present: 'Presente' }[state] : state}</option>)}</select></label> : null}
        {kind === 'property' ? <>
          <label className="field-label">{es ? 'Atributo que se comprobará' : 'Attribute to check'}<select value={propertyId} onChange={e => { setPropertyId(e.target.value); changeValueType(e.target.value === '@new' ? newPropertyType : fields.find(field => field.id === e.target.value)?.valueType ?? 'text'); }}>{fields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}<option value="@new">{es ? 'Crear atributo…' : 'Create attribute…'}</option></select></label>
          {propertyId === '@new' ? <><label className="field-label">{es ? 'Nombre del atributo' : 'Attribute name'}<input required value={propertyName} onChange={e => setPropertyName(e.target.value)} /></label><label className="field-label">{es ? 'Tipo del atributo' : 'Attribute type'}<select value={newPropertyType} onChange={e => { setNewPropertyType(e.target.value as LocalExplorerPropertyValueType); changeValueType(e.target.value); }}><option value="number">{es ? 'Número' : 'Number'}</option><option value="text">{es ? 'Texto' : 'Text'}</option><option value="boolean">{es ? 'Verdadero / falso' : 'Boolean'}</option><option value="date">{es ? 'Fecha' : 'Date'}</option></select></label></> : null}
          {initialField}<p>{es ? 'El atributo quedará habilitado para consulta en esta entidad.' : 'Enable reading this attribute on the new entity.'}</p>
        </> : kind === 'instanceQuery' || stateId === 'owned' ? <label className="condition-reference-create-checkbox"><input type="checkbox" checked={copy} onChange={e => setCopy(e.target.checked)} />{es ? 'Añadir una copia inicial al inventario del perfil activo' : 'Add an initial copy to the active profile inventory'}</label> : null}
      </>}
      {error ? <p role="alert">{error}</p> : null}
      <footer><button type="button" onClick={onCancel}>{es ? 'Cancelar' : 'Cancel'}</button><button type="submit" className="primary" disabled={!name.trim()}>{es ? 'Crear y usar' : 'Create and use'}</button></footer>
    </form>
  </div></div>, document.querySelector('.pathbranching-app') ?? document.body);
}
