import { createPortal } from "react-dom";
import { useInspectorMenuPlacement } from "./useInspectorMenuPlacement.js";
import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { AccessibleTabs } from './AccessibleTabs.js';
import { useInterfaceLocale } from '../i18n.js';
import { readInspectorModulePreferences, resolveInspectorModulePreferences, saveInspectorModulePreferences, type InspectorModule } from '../inspectorModules.js';
import '../inspectorModules.css';

export function InspectorModuleTabs({ projectId, objectKey, modules, value, onChange }: {
  projectId: string; objectKey: string; modules: InspectorModule[]; value: string; onChange: (id: string) => void;
}) {
  const es = useInterfaceLocale() === 'es';
  const [preferences, setPreferences] = useState(() => resolveInspectorModulePreferences(modules, readInspectorModulePreferences(projectId, objectKey)));
  const [menu, setMenu] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const placement = useInspectorMenuPlacement(Boolean(menu), root, menuRef);
  useEffect(() => { saveInspectorModulePreferences(projectId, objectKey, preferences); }, [preferences, projectId, objectKey]);
  const labels: Record<string, string> = es ? { Wait: 'Espera', Conversation: 'Conversación', Dialogue: 'Diálogo', Decision: 'Decisión', Decisions: 'Decisiones', Option: 'Opción', Response: 'Opción', Speech: 'Diálogo', 'Stage direction': 'Acotación', Direction: 'Acotación', Interaction: 'Interacción', Event: 'Evento', Overview: 'Resumen', Connections: 'Conexiones', Narrative: 'Narrativa', Options: 'Opciones', Responses: 'Opciones', Content: 'Contenido', Conditions: 'Condiciones', Consequences: 'Consecuencias', Settings: 'Configuración' } : {};
  const label = (item: InspectorModule) => labels[item.label] ?? item.label;
  // A direct navigation request reveals its module without changing narrative data.
  const visible = [...new Set([...preferences.visible, ...(modules.some(item => item.id === value) ? [value] : [])])];
  useEffect(() => {
    if (!modules.some(item => item.id === value) || preferences.visible.includes(value)) return;
    const next = { visible, active: value };
    setPreferences(next);
    saveInspectorModulePreferences(projectId, objectKey, next);
  }, [value]);
  useEffect(() => {
    if (!menu) return;
    trigger.current = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setMenu(undefined); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);
  const commit = (ids: string[], active: string) => {
    const next = { visible: ids, active };
    setPreferences(next);
    saveInspectorModulePreferences(projectId, objectKey, next);
    setMenu(undefined);
    onChange(active);
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
  };
  const hidden = modules.filter(item => !visible.includes(item.id));
  const context = modules.find(item => item.id === menu);
  return <div className="inspector-module-bar" ref={root} onKeyDown={event => {
    if (!menu) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setMenu(undefined); trigger.current?.focus(); }
    if (event.key === 'Tab') setMenu(undefined);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && (event.target as HTMLElement).closest('[role="menu"]')) {
      event.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <div className="inspector-module-scroll">
      <AccessibleTabs className="inspector-subtabs inspector-module-tabs" value={value} tabs={visible.flatMap(id => { const item = modules.find(module => module.id === id); return item ? [{ id, label: label(item) }] : []; })} onChange={id => commit(visible, id)} ariaLabel={es ? 'Módulos del inspector' : 'Inspector modules'} onTabContextMenu={id => { if (!modules.find(item => item.id === id)?.fixed) setMenu(id); }} />
    </div>
    {hidden.length ? <button type="button" className="inspector-module-add" aria-label={es ? 'Añadir módulo' : 'Add module'} title={es ? 'Añadir módulo' : 'Add module'} aria-expanded={menu === 'add'} onClick={() => setMenu(menu === 'add' ? undefined : 'add')}><Plus size={16} /></button> : null}
    {menu && (menu !== 'add' || hidden.length > 0) ? createPortal(<div ref={menuRef} style={placement} className="inspector-module-menu" role="menu" aria-label={menu === 'add' ? (es ? 'Añadir módulo' : 'Add module') : label(context!)}>
      {menu === 'add' ? hidden.map(item => <button type="button" role="menuitem" key={item.id} onClick={() => commit([...visible, item.id], item.id)}>{label(item)}</button>) : context ? <>
        <button type="button" role="menuitem" onClick={() => commit(visible.filter(id => id !== context.id), value === context.id ? modules[0].id : value)}>{es ? 'Ocultar pestaña' : 'Hide tab'}</button>
        {visible.indexOf(context.id) > modules.filter(item => item.fixed).length ? <button type="button" role="menuitem" onClick={() => { const ids = [...visible], index = ids.indexOf(context.id); [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; commit(ids, value); }}>{es ? 'Mover a la izquierda' : 'Move left'}</button> : null}
        {visible.indexOf(context.id) < visible.length - 1 ? <button type="button" role="menuitem" onClick={() => { const ids = [...visible], index = ids.indexOf(context.id); [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]]; commit(ids, value); }}>{es ? 'Mover a la derecha' : 'Move right'}</button> : null}
      </> : null}
    </div>, root.current?.closest(".pathbranching-app") ?? document.body) : null}
  </div>;
}
