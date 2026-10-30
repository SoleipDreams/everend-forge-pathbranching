import { useId, type ReactNode } from 'react';
import { CheckCircle2, Circle, Eye, MapPin, MessageSquare, Package, PackageSearch, Pencil, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import type { BranchingProject, CanonPropertyDescriptor, EntityRuntimeStateRole, LogicPropertyOverride, LogicTypeOverride } from '../domain.js';
import { propertyReadPermission } from '../characterStats.js';
import { explorerTypeLabel } from '../explorerSchema.js';
import './propertyCapabilities.css';

type Props = {
  locale: 'es' | 'en';
  project: BranchingProject;
  source: 'canon' | 'local';
  propertyId: string;
  descriptor?: Pick<CanonPropertyDescriptor, 'path' | 'groupPath' | 'appliesToTypes'>;
  propertiesConfig?: Record<string, unknown>;
  isEntityType: boolean;
  valueType?: string;
  property?: LogicPropertyOverride;
  entityType?: LogicTypeOverride;
  onPropertyChange: (changes: Partial<LogicPropertyOverride>) => void;
  onTypeChange: (changes: Partial<LogicTypeOverride>) => void;
};

function CapabilityGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = useId();
  return <section className="property-capability-group" aria-labelledby={id}>
    <header><h3 id={id}>{title}</h3><p>{description}</p></header>
    <div className="property-capability-cards">{children}</div>
  </section>;
}

function CapabilityCard({ title, description, icon: Icon, checked, nested, onClick }: {
  title: string; description: string; icon: LucideIcon; checked: boolean; nested?: boolean; onClick: () => void;
}) {
  const descriptionId = useId();
  return <button type="button" className={`logic-capability-card${checked ? ' active' : ''}${nested ? ' nested' : ''}`}
    aria-label={title} aria-describedby={descriptionId} aria-pressed={checked} onClick={onClick}>
    <span className="logic-capability-icon"><Icon size={16} aria-hidden="true" /></span>
    <span className="logic-capability-content"><strong>{title}</strong><span id={descriptionId}>{description}</span></span>
    <span className="logic-capability-toggle" aria-hidden="true">{checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span>
  </button>;
}

/** The inspector and its popover share the same capability groups and saved flags. */
export function PropertyCapabilitiesEditor({ locale, project, source, propertyId, descriptor, propertiesConfig, isEntityType, valueType, property, entityType, onPropertyChange, onTypeChange }: Props) {
  const es = locale === 'es';
  const readPermission = propertyReadPermission(project, source, propertyId, { descriptor });
  const inheritedRead = propertyReadPermission(project, source, propertyId, { descriptor, ignoreOwn: true });
  const parent = readPermission.inheritedFrom;
  const parentLabel = parent?.propertyId.startsWith('type:') ? explorerTypeLabel(project, source, parent.propertyId, propertiesConfig) : parent?.label;
  const manualRead = typeof property?.conditionReadable === 'boolean';
  const group = valueType === 'group';
  const entityPresentable = property?.entityPresentable === true;
  const dialogueTrigger = entityPresentable && property?.dialogueTrigger === true;
  const enabledRoles = new Set<EntityRuntimeStateRole>([
    ...(entityType?.runtimeRoles ?? []), ...(entityType?.grantable ? ['owned' as const] : []),
  ]);
  const toggleRole = (role: EntityRuntimeStateRole) => {
    const enabled = enabledRoles.has(role);
    onTypeChange({
      runtimeRoles: enabled ? [...enabledRoles].filter(item => item !== role) : [...enabledRoles, role],
      ...(role === 'owned' ? { grantable: !enabled } : {}),
    });
  };
  const referencesEntities = ['entity-ref', 'entity-ref-list', 'canonRef', 'canonRefList'].includes(valueType ?? '');
  const showEntityUses = isEntityType || referencesEntities || entityPresentable || property?.dialogueTrigger === true;
  return <div className="property-capability-groups">
    {showEntityUses ? <CapabilityGroup title={es ? 'Usos de las entidades' : 'Entity uses'} description={isEntityType
      ? es ? 'Se aplican a todas las entidades de este tipo.' : 'These capabilities apply to every entity of this type.'
      : es ? 'Se aplican a las entidades referenciadas en el valor de este atributo.' : 'These capabilities apply to the entities referenced by this attribute.'}>
      <CapabilityCard icon={UserRound} title={es ? 'Como personaje' : 'As a character'} description={isEntityType
        ? es ? 'Permite seleccionar estas entidades como personajes en eventos y diálogos.' : 'Allow these entities to be selected as characters in events and dialogue.'
        : es ? 'Permite seleccionar las entidades referenciadas como personajes en eventos y diálogos.' : 'Allow referenced entities to be selected as characters in events and dialogue.'}
        checked={entityPresentable} onClick={() => onPropertyChange({ entityPresentable: !entityPresentable, dialogueTrigger: false })} />
      {entityPresentable ? <CapabilityCard icon={MessageSquare} title={es ? 'Origen de diálogo' : 'Dialogue trigger source'}
        description={es ? 'Permite elegir una entidad como origen de un nodo de inicio de diálogo.' : 'Allow an entity to be selected as the source of a dialogue trigger node.'}
        checked={dialogueTrigger} nested onClick={() => onPropertyChange({ dialogueTrigger: !dialogueTrigger })} /> : null}
      {isEntityType ? <>
        <CapabilityCard icon={MapPin} title={es ? 'Como ubicación' : 'As a location'}
          description={es ? 'Permite elegir estas entidades como lugar de un evento o una línea de diálogo.' : 'Allow these entities to be selected as the location of an event or dialogue line.'}
          checked={entityType?.location === true} onClick={() => onTypeChange({ location: entityType?.location !== true })} />
        <CapabilityCard icon={Package} title={es ? 'Poseíble' : 'Ownable'}
          description={es ? 'Permite entregar, retirar y comprobar la posesión de estas entidades.' : 'Allow these entities to be granted, removed and checked for ownership.'}
          checked={enabledRoles.has('owned')} onClick={() => toggleRole('owned')} />
        {enabledRoles.has('owned') ? <CapabilityCard icon={PackageSearch} title={es ? 'Como ítem de inventario' : 'As an inventory item'}
          description={es ? 'Permite elegirlas en condiciones de inventario/copias y crear copias iniciales en el catálogo de ítems.' : 'Allow these entities in inventory/copy conditions and as initial copies in the item catalog.'}
          checked={entityType?.inventoryItem === true} nested onClick={() => onTypeChange({ inventoryItem: entityType?.inventoryItem !== true })} /> : null}
      </> : null}
    </CapabilityGroup> : null}
    {isEntityType ? <CapabilityGroup title={es ? 'Estados disponibles' : 'Available states'}
      description={es ? 'Habilitan comprobaciones y consecuencias. Los valores se establecen durante la historia.' : 'Enable conditions and consequences. State values are set during the story.'}>
      <CapabilityCard icon={ShieldCheck} title={es ? 'Desbloqueado' : 'Unlocked'}
        description={es ? 'Permite comprobar y cambiar si una entidad está desbloqueada.' : 'Allow checking and changing whether an entity is unlocked.'}
        checked={enabledRoles.has('unlocked')} onClick={() => toggleRole('unlocked')} />
      <CapabilityCard icon={Eye} title={es ? 'Descubierto' : 'Discovered'}
        description={es ? 'Permite comprobar y cambiar si una entidad ha sido descubierta.' : 'Allow checking and changing whether an entity has been discovered.'}
        checked={enabledRoles.has('discovered')} onClick={() => toggleRole('discovered')} />
      <CapabilityCard icon={UserRound} title={es ? 'Presente' : 'Present'}
        description={es ? 'Permite comprobar y cambiar si una entidad está presente en la escena.' : 'Allow checking and changing whether an entity is present in the scene.'}
        checked={enabledRoles.has('present')} onClick={() => toggleRole('present')} />
    </CapabilityGroup> : null}
    <CapabilityGroup title={isEntityType || group ? es ? 'Permisos de sus atributos' : 'Permissions for child attributes' : es ? 'Permisos de un atributo' : 'Attribute permissions'}
      description={isEntityType || group
        ? es ? 'Los atributos heredan este permiso. Las excepciones manuales de cada atributo tienen prioridad.' : 'Attributes inherit this permission. Manual exceptions on each attribute take precedence.'
        : es ? 'Hereda el permiso del grupo o tipo de entidad; puedes establecer una excepción manual.' : 'Inherit from the parent group or entity type, or set a manual exception.'}>
      <div className="property-read-permission">
      <CapabilityCard icon={ShieldCheck} title={es ? 'Consultar en condiciones' : 'Read in conditions'}
        description={isEntityType || group
          ? es ? 'Habilita las comparaciones de los atributos de esta propiedad y sus subpropiedades.' : 'Enable comparisons for the attributes of this property and its descendants.'
          : es ? 'Permite comparar este valor en condiciones, por ejemplo Fuerza ≥ 5.' : 'Allow comparing this value in conditions, for example Strength ≥ 5.'}
        checked={readPermission.enabled} onClick={() => onPropertyChange({ conditionReadable: !readPermission.enabled })} />
      <div className="property-permission-origin">
        <span role="status">{manualRead ? es ? `Manual · ${readPermission.enabled ? 'activado' : 'desactivado'}` : `Manual · ${readPermission.enabled ? 'enabled' : 'disabled'}`
          : readPermission.mixed ? es ? 'Heredado · depende del tipo de entidad' : 'Inherited · depends on the entity type'
          : parentLabel ? es ? `Heredado de ${parentLabel} · ${readPermission.enabled ? 'activado' : 'desactivado'}` : `Inherited from ${parentLabel} · ${readPermission.enabled ? 'enabled' : 'disabled'}`
          : es ? 'Sin permiso heredado · desactivado' : 'No inherited permission · disabled'}</span>
        {manualRead ? <button type="button" onClick={() => onPropertyChange({ conditionReadable: undefined })}
          title={inheritedRead.mixed ? es ? 'El permiso dependerá del tipo de entidad.' : 'Permission will depend on the entity type.' : es ? `Valor heredado: ${inheritedRead.enabled ? 'activado' : 'desactivado'}` : `Inherited value: ${inheritedRead.enabled ? 'enabled' : 'disabled'}`}>
          {es ? 'Volver a heredar' : 'Restore inheritance'}</button> : null}
      </div>
      </div>
      {!isEntityType && !group ? <CapabilityCard icon={Pencil} title={es ? 'Modificar con consecuencias' : 'Change through consequences'}
        description={es ? 'Permite que las acciones y consecuencias cambien este valor durante la historia.' : 'Allow actions and consequences to change this value during the story.'}
        checked={property?.actionWritable === true} onClick={() => onPropertyChange({ actionWritable: property?.actionWritable !== true })} /> : null}
    </CapabilityGroup>
  </div>;
}
