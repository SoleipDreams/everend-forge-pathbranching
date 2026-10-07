import type { BranchingProject, Consequence, EntityInstance, InstanceEffect, NarrativeEffect } from '../domain.js';
import { entityCapabilities, entityDefinition } from '../authoringEntities.js';
import { useInterfaceLocale } from '../i18n.js';
import { LogicConditionEditor, LogicEffectEditor } from './LogicComposer.js';
import { EntityOwnerPicker } from './EntityOwnerPicker.js';
import { AuthoringTextField } from './AuthoringTextField.js';
import { AuthoringValueField } from './AuthoringValueField.js';

/** Each row retains its position: mixed ordinary/copy effects execute in this exact order. */
export function NarrativeEffectEditor({ project, value = [], onChange, draftId, contextEntityId }: { project: BranchingProject; value?: NarrativeEffect[]; onChange: (value: NarrativeEffect[]) => void; draftId?: string; contextEntityId?: string }) {
  const es = useInterfaceLocale() === 'es';
  const entities = [...project.canonRefs.map(e => e.id), ...(project.localExplorerEntities ?? []).map(e => e.id)];
  const replace = (index: number, next: NarrativeEffect[]) => onChange([...value.slice(0,index),...next,...value.slice(index+1)]);
  const update = (index: number, patch: Partial<InstanceEffect>) => replace(index,[{ ...value[index], ...patch } as InstanceEffect]);
  const reorder = (index: number, direction: number) => { const next=[...value];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next); };
  return <section className="authoring-effects" aria-label={es?'Consecuencias en orden':'Ordered effects'}>
    {value.map((raw,index) => <div className="authoring-effect-row" role="group" aria-label={`${es?'Consecuencia':'Effect'} ${index+1}`} key={`${draftId ?? 'effects'}:${index}`}><strong>{es?'Consecuencia':'Effect'} {index+1}</strong>
      <div className="authoring-row-actions"><button type="button" disabled={index===0} aria-label={es?'Subir consecuencia':'Move effect up'} onClick={()=>reorder(index,-1)}>↑</button><button type="button" disabled={index===value.length-1} aria-label={es?'Bajar consecuencia':'Move effect down'} onClick={()=>reorder(index,1)}>↓</button></div>
      {raw.type !== 'instanceEffect' ? <LogicEffectEditor project={project} draftId={draftId ? `${draftId}:effect:${index}`:undefined} value={[raw as Consequence]} onChange={next=>replace(index,next ?? [])} /> : (()=>{
        const effect=raw as InstanceEffect;
        const scope=effect.selection==='all'?'all':effect.instanceIds?'selected':'one';
        const selected=project.entityInstances?.find(i=>i.id===effect.instanceId);
        const templateId=effect.entityId ?? selected?.entityId ?? contextEntityId;
        return <>
          <label className="field-label">{es?'Operación':'Operation'}<select value={effect.operation} onChange={e=>update(index,{operation:e.target.value as InstanceEffect['operation']})}>{(['create','move','modify','remove'] as const).map(op=><option key={op} value={op}>{es?({create:'Crear copia',move:'Trasladar copia',modify:'Modificar copia',remove:'Retirar copia'})[op]:op}</option>)}</select></label>
          {effect.operation==='create'?<label className="field-label">{es?'Entidad de origen':'Entity definition'}<select value={effect.entityId ?? ''} onChange={e=>update(index,{entityId:e.target.value || undefined})}><option value="">{es?'Seleccionar entidad':'Choose entity'}</option>{entities.map(id=><option key={id} value={id}>{entityDefinition(project,id)?.name ?? id}</option>)}</select></label>:<>
            <label className="field-label">{es?'Copias afectadas':'Affected copies'}<select value={scope} onChange={e=>update(index,e.target.value==='all'?{selection:'all',instanceId:undefined,instanceIds:undefined,query:{entityId:templateId}}:e.target.value==='selected'?{selection:'selected',instanceId:undefined,instanceIds:[],query:undefined}:{selection:'selected',instanceId:'@self',instanceIds:undefined,query:undefined})}><option value="one">{es?'Una copia concreta o contextual':'One concrete or contextual copy'}</option><option value="selected">{es?'Copias seleccionadas explícitamente':'Explicitly selected copies'}</option><option value="all">{es?'Todas las que cumplan el filtro':'All matching copies'}</option></select></label>
            {scope==='one'?<label className="field-label">{es?'Copia sobre la que actúa':'Copy to affect'}<select value={effect.instanceId ?? ''} onChange={e=>update(index,{instanceId:e.target.value || undefined})}><option value="">{es?'Elegir copia':'Choose copy'}</option><option value="@self">{es?'Copia elegida como origen de la acción':'Copy selected as action source'}</option><option value="@target">{es?'Copia elegida como destinatario':'Copy selected as recipient'}</option>{effect.instanceId&&!['@self','@target'].includes(effect.instanceId)&&!project.entityInstances?.some(i=>i.id===effect.instanceId)?<option value={effect.instanceId}>{es?'Copia desaparecida':'Missing copy'} · {effect.instanceId}</option>:null}{(project.entityInstances ?? []).map(i=><option key={i.id} value={i.id}>{i.name ?? entityDefinition(project,i.entityId)?.name ?? i.id}</option>)}</select></label>:null}
            {scope==='selected'?<fieldset><legend>{es?'Selección':'Selection'}</legend>{(project.entityInstances ?? []).map(i=><label className="field-label" key={i.id}><input type="checkbox" checked={effect.instanceIds?.includes(i.id) ?? false} onChange={e=>update(index,{instanceIds:e.target.checked?[...(effect.instanceIds ?? []),i.id]:(effect.instanceIds ?? []).filter(id=>id!==i.id)})}/>{i.name ?? entityDefinition(project,i.entityId)?.name ?? i.id}</label>)}</fieldset>:null}
            {scope==='all'?<fieldset><legend>{es?'Filtro de copias':'Copy filter'}</legend><label className="field-label">{es?'Entidad de origen':'Entity definition'}<select value={effect.query?.entityId ?? ''} onChange={e=>update(index,{query:{...effect.query,entityId:e.target.value || undefined}})}><option value="">{es?'Cualquier entidad':'Any entity'}</option>{entities.map(id=><option key={id} value={id}>{entityDefinition(project,id)?.name ?? id}</option>)}</select></label><EntityOwnerPicker project={project} value={effect.query?.owner} context onChange={owner=>update(index,{query:{...effect.query,owner}})} label={es?'Poseedor que debe coincidir':'Matching owner'}/><LogicConditionEditor project={project} draftId={draftId?`${draftId}:effect:${index}:filter`:undefined} value={effect.query?.filters} onChange={filters=>update(index,{query:{...effect.query,filters}})} copyFilter hideTester label={es?'Filtros sobre la misma copia':'Filters on the same copy'}/></fieldset>:null}
          </>}
          {effect.operation==='create'||effect.operation==='move'?<EntityOwnerPicker project={project} value={effect.owner ?? undefined} context onChange={owner=>update(index,{owner:owner ?? null})}/>:null}
          {effect.operation==='create'?<AuthoringTextField projectId={project.projectId} elementId={draftId ?? `effect:${index}`} field="copy-name" label={es?'Nombre de la nueva copia':'New copy name'} value={effect.name ?? ''} onCommit={name=>update(index,{name})}/>:null}
          {effect.operation==='create'||effect.operation==='modify'?<InstancePropertyFields project={project} draftId={`${draftId ?? 'effect'}:${index}`} instance={{id:effect.instanceId ?? '',entityId:templateId ?? effect.query?.entityId ?? '',properties:effect.properties,states:effect.states}} onChange={patch=>update(index,patch)} />:null}
          <button type="button" className="danger" onClick={()=>replace(index,[])}>{es?'Eliminar consecuencia':'Remove effect'}</button>
        </>;
      })()}
    </div>)}
    <LogicEffectEditor project={project} draftId={draftId ? `${draftId}:new`:undefined} value={[]} label={es?'Añadir consecuencia de estado o propiedad':'Add state or property effect'} onChange={next=>{if(next?.length)onChange([...value,...next]);}}/>
    <button type="button" onClick={()=>onChange([...value,{type:'instanceEffect',operation:'create',entityId:entities[0],owner:{kind:'context',role:'actor'}}])}>{es?'Añadir consecuencia de copia':'Add copy effect'}</button>
  </section>;
}

export function InstancePropertyFields({ project, instance, onChange, draftId, temporary }: { project: BranchingProject; instance: EntityInstance; onChange: (patch: Partial<EntityInstance>) => void; draftId?: string; temporary?: boolean }) {
  const es=useInterfaceLocale()==='es';
  const definition=entityDefinition(project,instance.entityId);
  const keys=new Set([...Object.keys(definition?.properties ?? {}).filter(k=>!['id','name','type','kind','aliases','tags','status'].includes(k)),...Object.keys(instance.properties ?? {})]);
  const configuredProperties=(project.localExplorerProperties ?? []).filter(p=>!['group','entity-type'].includes(p.valueType) && (!p.appliesToTypes?.length || p.appliesToTypes.some(t=>t.replace(/^type:/,'')===definition?.typeId?.replace(/^type:/,''))));
  const roles=Object.entries(definition?entityCapabilities(project,instance.entityId).runtimeRoles:{}).filter(([,enabled])=>enabled).map(([role])=>role);
  const availableStates=[...new Set([...roles,...Object.keys(instance.states ?? {})])].filter(state => state !== 'owned');
  return <div className="authoring-property-fields">
    {[...keys].map(key=>{
      const raw=instance.properties&&Object.prototype.hasOwnProperty.call(instance.properties,key)?instance.properties[key]:definition?.properties[key];
      const property=project.localExplorerProperties?.find(p=>p.id===key||p.id===`property:${key}`);
      const type=property?.valueType ?? (Array.isArray(raw)?'list':typeof raw==='number'?'number':typeof raw==='boolean'?'boolean':'text');
      return <div key={key}><AuthoringValueField project={project} elementId={draftId ?? instance.id} field={`property:${key}`} label={property?.label ?? key} temporary={temporary} type={type} value={raw} onCommit={next=>onChange({properties:{...instance.properties,[key]:next}})}/>{Object.prototype.hasOwnProperty.call(instance.properties ?? {},key)?<button type="button" onClick={()=>{const next={...instance.properties};delete next[key];onChange({properties:next});}}>{es?'Heredar de la entidad':'Inherit from entity'}</button>:null}</div>;
    })}
    <label className="field-label">{es?'Añadir propiedad propia':'Add copy property'}<select value="" onChange={e=>{const p=configuredProperties.find(p=>p.id===e.target.value);if(p)onChange({properties:{...instance.properties,[p.id]:p.valueType==='number'?0:p.valueType==='boolean'?false:['multiselect','entity-ref-list'].includes(p.valueType)?[]:''}});}}><option value="">{es?'Elegir propiedad':'Choose property'}</option>{configuredProperties.filter(p=>!keys.has(p.id)).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    {availableStates.length?<fieldset><legend>{es?'Estados propios de esta copia':'Copy states'}</legend>{availableStates.map(state=><label className="field-label" key={state}>{({owned:es?'Posesión':'Ownership',unlocked:es?'Desbloqueo':'Unlocked',discovered:es?'Descubrimiento':'Discovered',present:es?'Presencia':'Presence'} as Record<string,string>)[state] ?? state}<select value={instance.states?.[state]===undefined?'inherit':String(instance.states[state])} onChange={e=>{const next={...instance.states};if(e.target.value==='inherit')delete next[state];else next[state]=e.target.value==='true';onChange({states:next});}}><option value="inherit">{es?'Heredado':'Inherited'}</option><option value="true">{es?'Activado':'Enabled'}</option><option value="false">{es?'Desactivado':'Disabled'}</option></select></label>)}</fieldset>:null}
  </div>;
}
