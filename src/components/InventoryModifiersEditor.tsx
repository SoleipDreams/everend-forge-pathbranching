import type { BranchingProject, InventoryPropertyModifier } from '../domain.js';
import { itemNumericProperties } from '../itemCatalog.js';
import { AuthoringValueField } from './AuthoringValueField.js';

export function InventoryModifiersEditor({ project, value, onChange, locale = 'es', draftId }: { project: BranchingProject; value: InventoryPropertyModifier[]; onChange: (value: InventoryPropertyModifier[]) => void; locale?: 'es' | 'en'; draftId: string }) {
  const es = locale === 'es', fields = itemNumericProperties(project);
  const update = (id: string, patch: Partial<InventoryPropertyModifier>) => onChange(value.map(modifier => modifier.id === id ? { ...modifier, ...patch } : modifier));
  return <fieldset className="item-modifiers"><legend>{es ? 'Bonos al portador' : 'Bearer modifiers'}</legend>
    <p>{es ? 'Se suman al valor actual del atributo. Cada copia aporta sus bonos mientras cumpla su activación.' : 'Add to the current attribute value. Each copy contributes while its activation applies.'}</p>
    {value.map(modifier => <div key={modifier.id} className="item-modifier-row">
      <label className="field-label">{es ? 'Atributo' : 'Attribute'}<select value={modifier.propertyId} onChange={event => update(modifier.id, { propertyId: event.target.value })}>
        {!fields.some(field => field.id === modifier.propertyId) ? <option value={modifier.propertyId}>{es ? 'Atributo no disponible' : 'Unavailable attribute'} · {modifier.propertyId}</option> : null}
        {fields.map(field => <option key={field.id} value={field.id}>{[...(field.groupPath ?? []), field.label].join(' › ')}</option>)}
      </select></label>
      <AuthoringValueField project={project} elementId={draftId} field={`modifier:${modifier.id}`} label={es ? 'Cantidad (+ / −)' : 'Amount (+ / −)'} type="number" value={modifier.amount} onCommit={amount => update(modifier.id, { amount: Number(amount) })} />
      <label className="field-label">{es ? 'Se aplica' : 'Activation'}<select value={modifier.activation} onChange={event => update(modifier.id, { activation: event.target.value as InventoryPropertyModifier['activation'] })}><option value="carried">{es ? 'Al llevarlo en el inventario' : 'While carried in inventory'}</option><option value="equipped">{es ? 'Solo al equiparlo' : 'Only while equipped'}</option></select></label>
      <button type="button" onClick={() => onChange(value.filter(item => item.id !== modifier.id))}>{es ? 'Quitar bono' : 'Remove modifier'}</button>
    </div>)}
    {!fields.length ? <p>{es ? 'Crea un atributo numérico en Lógica → Propiedades para añadir bonos.' : 'Create a numeric attribute in Logic → Properties to add modifiers.'}</p> : null}
    <button type="button" disabled={!fields.length} onClick={() => onChange([...value, { id: `bonus:${crypto.randomUUID()}`, propertyId: fields[0].id, amount: 0, activation: 'equipped' }])}>{es ? 'Añadir bono' : 'Add modifier'}</button>
  </fieldset>;
}
