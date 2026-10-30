import type { BranchingProject, ConditionInput, InteractionDice, InteractionMechanic, InteractionMechanicPreset, InteractionModifierRule, InteractionParticipant, InteractionResult, InteractionValueSource, LogicSubject } from '../domain.js';
import { useState, type ReactNode } from 'react';
import type { ConditionAuthoringContext } from '../conditionAuthoring.js';
import { buildConditionCandidates } from '../conditionAuthoring.js';
import { characterNumericFields, characterPropertyDescriptor, propertyValueAtPath, resolveCharacterProperty } from '../characterStats.js';
import { flattenLocalExplorerPropertyTree } from '../explorerSchema.js';
import { logicSubjectKey } from '../logicCapabilities.js';
import { resolveCanonVariantFrontmatter } from '../worldnotionVariants.js';
import { ConditionPickerIcon, ConditionReferencePicker } from './ConditionReferencePicker.js';
import { AuthoringTextField } from './AuthoringTextField.js';
import { convertSkillCheck, defaultInteraction } from '../interactionMutations.js';
import { characterSheetEntries } from '../characterSheets.js';
import { diceBounds, diceFaceLabel, diceFormula, diceGroups, dicePoolFromPreset, interactionPresetKind } from '../interactionDice.js';
import { ConditionRowsEditor } from './ConditionRowsEditor.js';
import { readConditionRecents, writeConditionRecent } from '../conditionAuthoring.js';
import { resolveUniverseAssetUrl } from '../utils/assetUrl.js';
import { Target, UserRound } from 'lucide-react';
import { previewDifficultyRoll } from '../interactionDifficulty.js';
import { InteractionDifficultyGuide } from './InteractionDifficultyGuide.js';

export type DiceContextSelectorOptions = { onOpenChange: (open: boolean) => void };
type Props = { project: BranchingProject; mechanic: InteractionMechanic; identity: string; locale: 'es' | 'en'; context?: ConditionAuthoringContext; dicePresets?: InteractionMechanicPreset[]; diceSetOnly?: boolean; mechanicSelector?: (options: DiceContextSelectorOptions) => ReactNode; onChange: (mechanic: InteractionMechanic) => void };
function interactionCharacterEntries(project: BranchingProject, context?: ConditionAuthoringContext) {
  const profile = project.playerProfiles?.find(item => item.id === project.activePlayerProfileId) ?? project.playerProfiles?.[0];
  const simulation = profile?.simulation ?? (project.playerProfiles?.length ? undefined : project.playerSimulation);
  return characterSheetEntries(project, context, simulation);
}
export function resultsForMechanic(mechanic: InteractionMechanic, previous: InteractionResult[], identity: string, previousKind: InteractionMechanic['kind'] = mechanic.kind): InteractionResult[] {
  if (mechanic.kind === 'dice') {
    if (previousKind !== 'dice') return defaultInteraction('dice', identity).results;
    const ranges = previous.filter(item => !item.key && item.range);
    return ranges.length ? ranges : defaultInteraction('dice', identity).results;
  }
  if (mechanic.kind !== 'skillcheck' && mechanic.kind !== 'opposedcheck') return previous;
  if (previousKind !== mechanic.kind) return defaultInteraction(mechanic.kind, identity).results;
  const base = defaultInteraction(mechanic.kind, identity).results.map(result => previous.find(item => item.key === result.key) ?? result);
  return mechanic.kind === 'skillcheck' ? [...base, ...previous.filter(item => !item.key && item.range)] : base;
}
export const interactionKindChoices = (es: boolean) => [
  { id: 'dice', label: es ? 'Dados' : 'Dice', detail: es ? 'Elige un set; configura la resolución en la interacción.' : 'Choose a set; configure resolution in the interaction.', icon: 'D20' },
  { id: 'qte', label: 'QTE', detail: es ? 'Una tecla dentro de un tiempo límite.' : 'Press a key within a time limit.', icon: 'Footprints' },
  { id: 'custom', label: es ? 'Personalizada' : 'Custom', detail: es ? 'Resultado externo elegido explícitamente.' : 'An explicitly supplied external result.', icon: 'CodeXml' },
];

function NumberField({ project, identity, field, label, value, integer, min, minError, max, maxError, onChange }: { project: BranchingProject; identity: string; field: string; label: string; value: number; integer?: boolean; min?: number; minError?: string; max?: number; maxError?: string; onChange: (value: number) => void }) {
  return <AuthoringTextField projectId={project.projectId} elementId={identity} field={field} label={label} value={String(value)} validate={text => !text.trim() || !Number.isFinite(Number(text)) || integer && !Number.isSafeInteger(Number(text)) ? 'Introduce un número válido' : min !== undefined && Number(text) < min ? minError ?? 'Introduce un número válido' : max !== undefined && Number(text) > max ? maxError ?? 'Introduce un número válido' : undefined} onCommit={text => onChange(Number(text))} />;
}
function DiceFields({ project, identity, dice, locale, onChange }: { project: BranchingProject; identity: string; dice: InteractionDice; locale: 'es' | 'en'; onChange: (dice: InteractionDice) => void }) {
  const es = locale === 'es';
  const groups = diceGroups(dice), bounds = diceBounds(dice);
  const change = (next: typeof groups) => {
    const grouped = next.length > 1 || dice.groups !== undefined;
    onChange({ count: next[0].count, sides: next[0].sides, ...(!grouped && next[0].minimum !== undefined ? { minimum: next[0].minimum } : {}), ...(grouped ? { groups: next } : {}) });
  };
  return <section className="interaction-dice-pool" aria-label={es ? 'Composición de la tirada' : 'Dice pool'}>
    {groups.map((group, index) => <div className="interaction-dice-group" key={group.id}>
      <strong>{index ? '+' : 'Σ'}</strong>
      <NumberField project={project} identity={`${identity}:${group.id}`} field="dice:count" label={es ? 'Cantidad' : 'Count'} value={group.count} integer min={1} onChange={count => change(groups.map(item => item.id === group.id ? { ...item, count } : item))} />
      <NumberField project={project} identity={`${identity}:${group.id}`} field="dice:maximum" label={es ? 'Límite final' : 'Upper limit'} value={(group.minimum ?? 1) + group.sides - 1} integer min={(group.minimum ?? 1) + 1} minError={es ? 'El límite final debe ser mayor que el inicio.' : 'The upper limit must be greater than the start.'} max={(group.minimum ?? 1) + 999999} maxError={es ? 'El rango no puede superar 1 000 000 caras.' : 'The range cannot exceed 1,000,000 faces.'} onChange={maximum => change(groups.map(item => item.id === group.id ? { ...item, sides: maximum - (item.minimum ?? 1) + 1 } : item))} />
      <button type="button" className="interaction-dice-zero-toggle" aria-pressed={(group.minimum ?? 1) === 0} title={es ? 'Alternar si el rango incluye el 0' : 'Toggle whether the range includes 0'} onClick={() => change(groups.map(item => {
        if (item.id !== group.id) return item;
        const currentMinimum = item.minimum ?? 1;
        const currentMaximum = currentMinimum + item.sides - 1;
        const nextMinimum = currentMinimum === 0 ? 1 : 0;
        return { ...item, minimum: nextMinimum === 1 ? undefined : 0, sides: currentMaximum - nextMinimum + 1 };
      }))}>{es ? 'Desde 0' : 'Start at 0'}</button>
      <button type="button" aria-label={`${es ? 'Quitar grupo' : 'Remove group'} ${index + 1}`} disabled={groups.length === 1} onClick={() => change(groups.filter(item => item.id !== group.id))}>×</button>
    </div>)}
    <button type="button" onClick={() => change([...groups, { id: `dice-${crypto.randomUUID()}`, count: 1, sides: 6 }])}>{es ? 'Añadir grupo de dados' : 'Add dice group'}</button>
    <output>{diceFormula(dice)} · {es ? 'Total posible' : 'Possible total'}: {bounds.min}–{bounds.max}</output>
  </section>;
}

function DicePoolPicker({ project, identity, dice, presetId, presets = [], locale, allowCommon, common, onChange }: { project: BranchingProject; identity: string; dice?: InteractionDice; presetId?: string; presets?: InteractionMechanicPreset[]; locale: 'es' | 'en'; allowCommon?: boolean; common?: boolean; onChange: (dice?: InteractionDice, presetId?: string) => void }) {
  const es = locale === 'es';
  const pureDice = presets.filter(item => interactionPresetKind(item) === 'dice' && item.mechanic.kind === 'dice');
  const value = common ? 'common' : presetId ?? (dice ? 'custom' : 'none');
  const candidates = [
    ...(allowCommon ? [{ id: 'common', label: es ? 'Usar dado común' : 'Use common dice', detail: es ? 'Hereda la configuración compartida' : 'Inherit the shared pool', icon: 'D20' }] : []),
    { id: 'custom', label: es ? 'Combinación personalizada' : 'Custom pool', detail: dice ? diceFormula(dice) : es ? 'Configura sus grupos abajo' : 'Configure groups below', icon: 'D20' },
    ...pureDice.map(item => ({ id: item.id, label: item.name, detail: item.description ?? (item.mechanic.kind === 'dice' ? diceFormula(item.mechanic) : ''), icon: 'D20' })),
  ];
  return <section className="interaction-dice-choice">
    <label><span>{es ? 'Plantilla de dados' : 'Dice template'}</span><ConditionReferencePicker label={es ? 'Dados para esta tirada' : 'Dice for this roll'} projectId={project.projectId} category="dice-pool" locale={locale} value={value} candidates={candidates} onChoose={id => {
      if (id === 'common' || id === 'none') { onChange(undefined); return; }
      if (id === 'custom') { onChange(dice ?? { count: 1, sides: 20 }, undefined); return; }
      const preset = pureDice.find(item => item.id === id), pool = preset ? dicePoolFromPreset(preset) : undefined;
      if (pool) onChange(pool, id);
    }} /></label>
    {!common && dice ? <DiceFields project={project} identity={identity} dice={dice} locale={locale} onChange={next => onChange(next, presetId)} /> : null}
  </section>;
}

function ModifierRulesFields({ project, identity, rules = [], locale, context, onChange }: { project: BranchingProject; identity: string; rules?: InteractionModifierRule[]; locale: 'es' | 'en'; context?: ConditionAuthoringContext; onChange: (rules: InteractionModifierRule[]) => void }) {
  const es = locale === 'es';
  const update = (id: string, patch: Partial<InteractionModifierRule>) => onChange(rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
  return <section className="interaction-modifier-rules" aria-label={es ? 'Bonificaciones condicionales' : 'Conditional modifiers'}>
    <header><h4>{es ? 'Bonificaciones y penalizaciones' : 'Bonuses and penalties'}</h4><small>{es ? 'Se suman una vez al iniciar la tirada.' : 'Added once when the roll starts.'}</small></header>
    {rules.map((rule, index) => <fieldset key={rule.id} className="interaction-modifier-rule"><legend>{rule.name || `${es ? 'Regla' : 'Rule'} ${index + 1}`}</legend>
      <div className="interaction-fields-row"><AuthoringTextField projectId={project.projectId} elementId={rule.id} field="modifier-rule:name" label={es ? 'Nombre' : 'Name'} value={rule.name} onCommit={name => update(rule.id, { name })} /><NumberField project={project} identity={rule.id} field="modifier-rule:value" label={es ? 'Bonificación / penalización' : 'Bonus / penalty'} value={rule.modifier} onChange={modifier => update(rule.id, { modifier })} /><button type="button" aria-label={es ? `Eliminar ${rule.name || 'regla'}` : `Delete ${rule.name || 'rule'}`} onClick={() => onChange(rules.filter(item => item.id !== rule.id))}>×</button></div>
      <ConditionRowsEditor project={project} value={rule.conditions} onChange={(conditions: ConditionInput | undefined) => update(rule.id, { conditions })} context={context} locale={locale} label={es ? 'Aplicar cuando' : 'Apply when'} draftId={`${identity}:modifier:${rule.id}`} />
    </fieldset>)}
    <button type="button" onClick={() => onChange([...rules, { id: `modifier-${crypto.randomUUID()}`, name: es ? 'Nueva regla' : 'New rule', modifier: 1 }])}>{es ? 'Añadir regla de modificador' : 'Add modifier rule'}</button>
  </section>;
}

function subjectRecentId(subject: LogicSubject) {
  return subject.kind === 'instance' ? `instance:${subject.instanceId}` : subject.kind === 'entity' ? JSON.stringify([subject.entityId, subject.variantId ?? 'base']) : subject.kind === 'context' ? `context:${subject.role}` : undefined;
}
function subjectVariantOptionId(entityId: string, variantId = 'base') {
  return `character-variant:${JSON.stringify([entityId, variantId])}`;
}
function SubjectFields({ project, subject, locale, context, disabled, allowCurrentActor=true, allowContextTarget=false, optional=false, recentCategory='interaction-character', className, onChange }: { project: BranchingProject; subject?: LogicSubject; locale: 'es' | 'en'; context?: ConditionAuthoringContext; disabled?:boolean; allowCurrentActor?:boolean; allowContextTarget?:boolean; optional?:boolean; recentCategory?: string; className?: string; onChange: (subject?: LogicSubject) => void }) {
  const es = locale === 'es';
  const selectedSubject = subject ?? { kind: 'context', role: 'actor' } as LogicSubject;
  const contextual = new Map(buildConditionCandidates(project, 'property', { context, locale }).map(item => [item.id, item]));
  const characters = interactionCharacterEntries(project, context);
  const choices = [...new Map(characters.filter(item=>item.instanceId || item.variantId==='base').map(item=>[item.instanceId?`instance:${item.instanceId}`:`entity:${item.entityId}`,item])).values()];
  const subjectsByCandidateId = new Map<string, LogicSubject>();
  const candidates = [
    ...(optional?[{id:'none',label:es?'Sin personaje asignado':'No character assigned',detail:es?'La tirada no depende de un personaje':'The roll is not tied to a character',icon:'CircleHelp',group:'context' as const}]:[]),
    ...(allowCurrentActor?[{id:'context:actor',label:es?'Actor actual':'Current actor',detail:es?'Personaje que actúa en este momento':'Character acting at this moment',icon:'UserRound',group:'context' as const}]:[]),
    ...(allowContextTarget?[{id:'context:target',label:es?'Heredar objetivo del contexto':'Inherit context target',detail:es?'Usa el personaje objetivo definido al jugar':'Use the target character supplied at play time',icon:'UserRound',group:'context' as const}]:[]),
    ...choices.map(item=>{
      const id=item.instanceId?`instance:${item.instanceId}`:`entity:${item.entityId}`;
      const baseSubject=item.subject.kind==='entity'?{...item.subject,variantId:undefined}:item.subject;
      const characterVariants=item.source==='canon'&&!item.instanceId?characters.filter(variant=>!variant.instanceId&&variant.entityId===item.entityId):[];
      const children=characterVariants.map(variant=>{
        const variantId=subjectVariantOptionId(item.entityId,variant.variantId);
        subjectsByCandidateId.set(variantId,{kind:'entity',entityId:item.entityId,...(variant.variantId!=='base'?{variantId:variant.variantId}:{}),source:item.source});
        return {id:variantId,label:variant.variantName,detail:variant.variantId==='base'?(es?'Variante principal':'Base variant'):undefined,icon:'UserRound'};
      });
      if(!children.length)subjectsByCandidateId.set(id,baseSubject);
      return {id,label:item.name,detail:[item.instanceId?(es?'Copia':'Copy'):item.source==='canon'?(es?'Personaje del universo':'Universe character'):(es?'Personaje local':'Local character'),...item.context,...(item.instanceId?[item.variantName]:[])].filter(Boolean).join(' › '),icon:'UserRound',group:item.contextual?'context' as const:contextual.get(id)?.group??'all' as const,...(children.length?{children}:{})};
    }),
  ];
  if(allowCurrentActor)subjectsByCandidateId.set('context:actor',{kind:'context',role:'actor'});
  if(allowContextTarget)subjectsByCandidateId.set('context:target',{kind:'context',role:'target'});
  const remember = (value?: LogicSubject) => { const recentId = value && subjectRecentId(value); if (recentId) writeConditionRecent(project.projectId, recentCategory, recentId); };
  const valueId = selectedSubject.kind==='entity'
    ? subjectsByCandidateId.has(subjectVariantOptionId(selectedSubject.entityId,selectedSubject.variantId??'base')) ? subjectVariantOptionId(selectedSubject.entityId,selectedSubject.variantId??'base') : logicSubjectKey({...selectedSubject,variantId:undefined})
    : logicSubjectKey(selectedSubject);
  const value = optional && !subject ? undefined : selectedSubject.kind==='entity' && (!selectedSubject.entityId || selectedSubject.entityId.startsWith('$slot:')) || selectedSubject.kind==='instance' && !selectedSubject.instanceId ? undefined : valueId;
  return <div className={`interaction-subject-fields${className ? ` ${className}` : ''}`}><label><span>{es ? 'Personaje y variante' : 'Character and variant'}</span><ConditionReferencePicker label={es ? 'Personaje participante y variante' : 'Participant character and variant'} projectId={project.projectId} category={recentCategory} locale={locale} disabled={disabled} value={value} candidates={candidates} onChoose={id => { if (id === 'none') { onChange(undefined); return; } const next = subjectsByCandidateId.get(id); if (next) { remember(next); onChange(next); } }} /></label></div>;
}

function ActorSubjectPicker({ project, subject, locale, context, onChange }: { project: BranchingProject; subject?: LogicSubject; locale: 'es' | 'en'; context?: ConditionAuthoringContext; onChange: (subject?: LogicSubject) => void }) {
  const es = locale === 'es', overview = characterOverview(project, subject, locale, context);
  return <div className="interaction-actor-selection-row">
    <div className="interaction-character-portrait interaction-actor-portrait" role="img" aria-label={overview?.portrait ? (es ? `Retrato de ${overview.name}` : `Portrait of ${overview.name}`) : es ? 'Sin retrato' : 'No portrait'}>{overview?.portrait ? <img src={overview.portrait} alt="" /> : <UserRound size={38} aria-hidden="true" />}</div>
    <SubjectFields project={project} subject={subject} locale={locale} context={context} optional recentCategory="interaction-actor" className="interaction-actor-subject-fields" onChange={onChange} />
  </div>;
}

function ActorAttributePicker({ project, subject, skill, locale, context, onChange }: { project: BranchingProject; subject?: LogicSubject; skill?: InteractionValueSource; locale: 'es' | 'en'; context?: ConditionAuthoringContext; onChange: (skill?: InteractionValueSource) => void }) {
  const es = locale === 'es', overview = characterOverview(project, subject, locale, context), stats = overview?.stats ?? [];
  const variableSubject = subject ?? { kind: 'context', role: 'actor' } as LogicSubject;
  const variables = (project.logicVariables ?? []).filter(item => item.type === 'number');
  const candidates = [
    { id: 'none', label: es ? 'Sin atributo' : 'No attribute', shortLabel: es ? 'Sin atributo' : 'No attribute', detail: es ? 'Solo dados' : 'Dice only', icon: 'D20' },
    ...stats.map(stat => ({ id: `property:${stat.id}`, label: stat.label, shortLabel: `${stat.short} · ${stat.value}`, detail: `${stat.short} · ${stat.value}`, icon: 'SlidersHorizontal' })),
    ...variables.map(variable => ({ id: `variable:${variable.id}`, label: variable.name, detail: es ? 'Variable numérica de la historia' : 'Story numeric variable', icon: 'Variable' })),
  ];
  const value = skill?.kind === 'property' ? `property:${skill.propertyId}` : skill?.kind === 'variable' ? `variable:${skill.variableId}` : 'none';
  return <section className="interaction-actor-attributes" aria-label={es ? 'Atributo que se enfrenta' : 'Attribute used in the roll'}>
    <header><span>{es ? 'Atributo' : 'Attribute'}</span></header>
    <ConditionReferencePicker label={es ? 'Atributo de la tirada' : 'Roll attribute'} projectId={project.projectId} category="interaction-skill" locale={locale} searchable={false} value={value} candidates={candidates} onChoose={id => {
      if (id === 'none') { onChange(undefined); return; }
      if (id.startsWith('property:')) { onChange({ kind: 'property', subject: variableSubject, propertyId: id.slice('property:'.length) }); return; }
      const variableId = id.startsWith('variable:') ? id.slice('variable:'.length) : undefined;
      if (variableId) onChange({ kind: 'variable', variableId });
    }} />
    {!stats.length && subject && subject.kind !== 'context' ? <p className="interaction-character-no-stats">{es ? 'Este personaje no tiene atributos numéricos.' : 'This character has no numeric attributes.'}</p> : null}
  </section>;
}

export function defaultInteractionActor(project: BranchingProject, context?: ConditionAuthoringContext): LogicSubject | undefined {
  const recentId = readConditionRecents(project.projectId, 'interaction-actor')[0];
  if (recentId) {
    if (recentId === 'context:actor') return { kind: 'context', role: 'actor' };
    const recent = interactionCharacterEntries(project, context).find(item => item.id === recentId || item.instanceId && recentId === `instance:${item.instanceId}` || item.entityId && recentId === `entity:${item.entityId}` && item.variantId === 'base');
    if (recent) return recent.subject;
  }
  const profile = project.playerProfiles?.find(item => item.id === project.activePlayerProfileId) ?? project.playerProfiles?.[0];
  const simulation = profile?.simulation ?? (project.playerProfiles?.length ? undefined : project.playerSimulation);
  const profileActor = simulation?.context?.actor;
  if (profileActor && profileActor.kind !== 'context') return profileActor;
  if (profile?.playableCharacterRef) return { kind: 'entity', entityId: profile.playableCharacterRef, ...(profile.playableVariantId ? { variantId: profile.playableVariantId } : {}) };
  return undefined;
}

function characterOverview(project: BranchingProject, subject: LogicSubject | undefined, locale: 'es' | 'en', context?: ConditionAuthoringContext) {
  if (!subject || subject.kind === 'context') return undefined;
  const profile = project.playerProfiles?.find(item => item.id === project.activePlayerProfileId) ?? project.playerProfiles?.[0];
  const state = profile?.simulation ?? project.playerSimulation ?? {};
  const instance = subject.kind === 'instance' ? (state.entityInstances ?? project.entityInstances ?? []).find(item => item.id === subject.instanceId) : undefined;
  const entityId = subject.kind === 'entity' ? subject.entityId : instance?.entityId;
  if (!entityId) return undefined;
  const variantId = subject.kind === 'entity' ? subject.variantId ?? 'base' : instance?.variantId ?? 'base';
  const entry = interactionCharacterEntries(project, context).find(item => item.id === subjectRecentId(subject) || item.entityId === entityId && item.variantId === variantId);
  const canon = project.canonRefs.find(item => item.id === entityId), local = project.localExplorerEntities?.find(item => item.id === entityId);
  const name = instance?.name ?? entry?.name ?? canon?.label ?? local?.name ?? entityId;
  const frontmatter = canon ? resolveCanonVariantFrontmatter(canon, variantId) : local?.properties ?? {};
  const imageFields = (project.canonPropertyDescriptors ?? []).filter(field => field.valueType === 'image');
  const portraitField = imageFields.find(field => /portrait|retrato|avatar|photo|foto|headshot/i.test(`${field.id} ${field.label}`)) ?? (imageFields.length === 1 ? imageFields[0] : undefined);
  let portraitValue = portraitField ? propertyValueAtPath(frontmatter, portraitField.path) : undefined;
  if (typeof portraitValue !== 'string') portraitValue = (frontmatter as Record<string, unknown>).portrait ?? (frontmatter as Record<string, unknown>).avatar;
  const asset = typeof portraitValue === 'string' ? project.assets?.find(item => item.kind === 'image' && item.id === portraitValue) : undefined;
  const portrait = typeof portraitValue === 'string' ? resolveUniverseAssetUrl(project.universeRootPath, asset?.path ?? portraitValue) : undefined;
  const fields = characterNumericFields(project, subject, state);
  const baseHeaders = fields.map(field => field.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
  const stats = fields.map((field, index) => {
    const base = baseHeaders[index] || `A${index + 1}`;
    let width = 3, short = base.slice(0, width);
    while (width < 4 && baseHeaders.some((other, otherIndex) => otherIndex !== index && other.slice(0, width) === short)) short = base.slice(0, ++width);
    if (baseHeaders.some((other, otherIndex) => otherIndex !== index && other.slice(0, width) === short)) {
      const words = field.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-zA-Z0-9]+/g) ?? [];
      short = words.map(word => word[0]).join('').slice(0, 4).toUpperCase() || base.slice(0, 4);
    }
    const value = resolveCharacterProperty(project, state, subject, field.id, { purpose: 'condition' });
    return { id: field.id, short, label: field.label, value: typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : '—' };
  });
  return { name, variant: entry?.variantName ?? variantId, portrait, stats, fallbackLabel: locale === 'es' ? 'Sin retrato' : 'No portrait' };
}

function CharacterOverview({ project, subject, locale, context }: { project: BranchingProject; subject?: LogicSubject; locale: 'es' | 'en'; context?: ConditionAuthoringContext }) {
  const es = locale === 'es';
  if (subject?.kind === 'context') return <div className="interaction-character-empty"><UserRound size={28} aria-hidden="true" /><span>{subject.role === 'target' ? (es ? 'Objetivo del contexto' : 'Context target') : (es ? 'Actor del contexto' : 'Context actor')}</span></div>;
  const overview = characterOverview(project, subject, locale, context);
  if (!overview) return <div className="interaction-character-empty"><UserRound size={28} aria-hidden="true" /><span>{es ? 'Tirada sin personaje' : 'Roll without a character'}</span></div>;
  return <div className="interaction-character-overview">
    <div className="interaction-character-identity">
      <div className="interaction-character-portrait" role="img" aria-label={overview.portrait ? (es ? `Retrato de ${overview.name}` : `Portrait of ${overview.name}`) : `${overview.name}: ${overview.fallbackLabel}`}>{overview.portrait ? <img src={overview.portrait} alt="" /> : <UserRound size={30} aria-hidden="true" />}</div>
      <div><strong title={overview.name}>{overview.name}</strong><small>{overview.variant}</small></div>
    </div>
    {overview.stats.length ? <div className="interaction-character-stats" aria-label={es ? 'Atributos del personaje' : 'Character attributes'}><small>{es ? 'Atributo' : 'Attribute'}</small><div tabIndex={0} aria-label={es ? 'Fila de atributos; desplázate horizontalmente para verlos todos' : 'Attribute row; scroll horizontally to view all'}>{overview.stats.map(stat => <span key={stat.id} title={stat.label}><b>{stat.short}</b><strong>{stat.value}</strong></span>)}</div></div> : <small className="interaction-character-no-stats">{es ? 'Sin atributos numéricos' : 'No numeric attributes'}</small>}
  </div>;
}

function numericFields(project:BranchingProject,subject:LogicSubject) {
  const localNumeric = flattenLocalExplorerPropertyTree(project.localExplorerProperties).filter(item => item.valueType === 'number').map(item => {
    const descriptor = characterPropertyDescriptor(project, item.id);
    return { ...item, path: descriptor?.path ?? [item.id], groupPath: descriptor?.groupPath ?? [] };
  });
  const numeric = subject.kind === 'context' ? [...(project.canonPropertyDescriptors ?? []).filter(item => item.valueType === 'number'), ...localNumeric] : characterNumericFields(project, subject);
  return [...new Map(numeric.map(item => [item.id, item])).values()];
}
function SkillFields({ project, skill, subject, locale, context, optional, variablesOnly = false, onChange }: { project: BranchingProject; skill?: InteractionValueSource; subject: LogicSubject; locale: 'es' | 'en'; context?: ConditionAuthoringContext; optional?: boolean; variablesOnly?: boolean; onChange: (skill?: InteractionValueSource) => void }) {
  const es=locale==='es',fields=numericFields(project,subject);
  const variables=buildConditionCandidates(project,'value',{context,locale}).filter(item=>item.subject?.kind==='variable'&&project.logicVariables?.some(variable=>item.subject?.kind==='variable'&&variable.id===item.subject.variableId&&variable.type==='number'));
  const candidates=[...(optional?[{id:'none',label:es?'Sin atributo':'No attribute',detail:es?'Solo dados y modificador':'Dice and modifier only',icon:'D20',group:'context' as const}]:[]),...(!variablesOnly?fields.map(item=>({id:`property:${item.id}`,label:item.label,detail:[es?'Atributo del personaje':'Character attribute',...(item.groupPath??[])].join(' › '),icon:'SlidersHorizontal',group:'context' as const})):[]),...variables.map(item=>({...item,detail:es?'Variable numérica de la historia':'Story numeric variable',icon:'Variable'}))];
  const value=variablesOnly?(skill?.kind==='variable'?(skill.variableId?`variable:${skill.variableId}`:undefined):undefined):skill?.kind==='property'?(skill.propertyId?`property:${skill.propertyId}`:undefined):skill?.kind==='variable'?(skill.variableId?`variable:${skill.variableId}`:undefined):optional?'none':undefined;
  return <label className="interaction-skill-field"><span>{variablesOnly?(es?'Variable numérica':'Numeric variable'):(es?'Atributo':'Attribute')}</span><ConditionReferencePicker label={variablesOnly?(es?'Variable numérica de la historia':'Story numeric variable'):(es?'Atributo numérico':'Numeric attribute')} projectId={project.projectId} category="interaction-skill" locale={locale} value={value} candidates={candidates} onChoose={id=>{if(id==='none')onChange(undefined);else if(id.startsWith('property:'))onChange({kind:'property',subject,propertyId:id.slice('property:'.length)});else{const selected=variables.find(item=>item.id===id)?.subject;if(selected?.kind==='variable')onChange({kind:'variable',variableId:selected.variableId});}}}/></label>;
}
function RollField({project,identity,dice,locale,onChange}:{project:BranchingProject;identity:string;dice?:InteractionDice;locale:'es'|'en';onChange:(dice?:InteractionDice)=>void}) {
  const es=locale==='es', minimum=dice?.minimum??1, maximum=dice?minimum+dice.sides-1:undefined;
  const rangeId=dice&&minimum!==1&&!(minimum===0&&maximum===1)?`range:${minimum}:${maximum}`:undefined;
  const value=dice?(rangeId??(minimum===0?'0-1':String(dice.sides))):'none';
  const candidates=[{id:'none',label:es?'Sin dado':'No dice'},...(rangeId&&dice?[{id:rangeId,label:diceFaceLabel({minimum:dice.minimum,sides:dice.sides}),icon:'D20'}]:[]),{id:'0-1',label:es?'Dado 0–1':'0–1 die',icon:'D20'},...[4,6,8,9,10,12,20,100,...(dice&&minimum===1&&![4,6,8,9,10,12,20,100].includes(dice.sides)?[dice.sides]:[])].map(sides=>({id:String(sides),label:`D${sides}`,icon:'D20'}))];
  return <div className="interaction-roll-field"><label><span>{es?'Dado':'Dice'}</span><ConditionReferencePicker label={es?'Dado de la prueba':'Check dice'} projectId={project.projectId} category="check-dice" locale={locale} searchable={false} value={value} candidates={candidates} onChoose={id=>onChange(id==='none'?undefined:id===rangeId&&dice?dice:id==='0-1'?{count:dice?.count??1,sides:2,minimum:0}:{count:dice?.count??1,sides:Number(id)})}/></label>{dice?<NumberField project={project} identity={identity} field="dice:count" label={es?'Cantidad':'Count'} value={dice.count} integer min={1} onChange={count=>onChange({...dice,count})}/>:null}</div>;
}
function ParticipantFields({ project, participant, identity, locale, context, presets, commonDice, actor=false, showSubject = true, showSkill = true, showDice = true, onChange }: { project: BranchingProject; participant: InteractionParticipant; identity: string; locale: 'es' | 'en'; context?: ConditionAuthoringContext; presets?: InteractionMechanicPreset[]; commonDice?: InteractionDice; actor?:boolean; showSubject?: boolean; showSkill?: boolean; showDice?: boolean; onChange: (participant: InteractionParticipant) => void }) {
  const es=locale==='es';
  const fallbackActor = actor && participant.subject.kind === 'context' && participant.subject.role === 'actor' ? defaultInteractionActor(project, context) : undefined;
  const effectiveParticipant = fallbackActor ? { ...participant, subject: fallbackActor } : participant;
  return <div className="interaction-participant-fields">
    {showSubject || showSkill ? <div className="interaction-participant-line">
      {showSubject ? <SubjectFields project={project} subject={effectiveParticipant.subject} locale={locale} context={context} allowCurrentActor={actor} allowContextTarget={!actor} recentCategory={actor ? 'interaction-actor' : 'interaction-character'} onChange={subject=>{if(subject)onChange({...effectiveParticipant,subject,skill:effectiveParticipant.skill?.kind==='property'?{...effectiveParticipant.skill,subject,propertyId:numericFields(project,subject).some(item=>item.id===(effectiveParticipant.skill as {propertyId:string}).propertyId)?effectiveParticipant.skill.propertyId:''}:effectiveParticipant.skill});}}/> : null}
      {showSkill ? <SkillFields project={project} skill={effectiveParticipant.skill} subject={effectiveParticipant.subject} locale={locale} context={context} optional onChange={skill=>onChange({...effectiveParticipant,skill})}/> : null}
    </div> : null}
    {showDice ? <DicePoolPicker project={project} identity={identity} dice={effectiveParticipant.dice} presetId={effectiveParticipant.dicePresetId} presets={presets} locale={locale} allowCommon common={!effectiveParticipant.dice} onChange={(dice,dicePresetId)=>onChange({...effectiveParticipant,dice,dicePresetId})}/> : null}
    <div className="interaction-fields-row"><NumberField project={project} identity={identity} field="modifier" label={es?'Modificador':'Modifier'} value={effectiveParticipant.modifier} onChange={modifier=>onChange({...effectiveParticipant,modifier})}/></div>
    <ModifierRulesFields project={project} identity={identity} rules={effectiveParticipant.modifierRules} locale={locale} context={context} onChange={modifierRules=>onChange({...effectiveParticipant,modifierRules})}/>
  </div>;
}

type DiceContextMode = 'solo' | 'world' | 'characters';
function diceContextMode(mechanic: InteractionMechanic): DiceContextMode { return mechanic.kind === 'skillcheck' ? 'world' : mechanic.kind === 'opposedcheck' ? 'characters' : 'solo'; }
function dicePoolOf(mechanic: Extract<InteractionMechanic, { kind: 'dice' | 'skillcheck' }>): InteractionDice {
  return mechanic.kind === 'dice' ? { count: mechanic.count, sides: mechanic.sides, ...(mechanic.minimum !== undefined ? { minimum: mechanic.minimum } : {}), ...(mechanic.groups ? { groups: mechanic.groups } : {}) } : mechanic.dice ?? { count: 1, sides: 20 };
}
function DiceContextFields({ project, mechanic, identity, locale, context, dicePresets, mechanicSelector, onChange }: Props & { mechanic: Extract<InteractionMechanic, { kind: 'dice' | 'skillcheck' | 'opposedcheck' }> }) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const es = locale === 'es', mode = diceContextMode(mechanic);
  const changeContext = (nextMode: DiceContextMode) => {
    if (nextMode === mode) return;
    const defaultActor = defaultInteractionActor(project, context);
    if (nextMode === 'world') {
      if (mechanic.kind === 'opposedcheck') { onChange(convertSkillCheck(mechanic, 'skillcheck')); return; }
      if (mechanic.kind === 'dice') {
        const defaults = defaultInteraction('skillcheck', identity).mechanic as Extract<InteractionMechanic, { kind: 'skillcheck' }>;
        onChange({ ...defaults, actor: mechanic.actor ?? defaultActor, skill: mechanic.skill, dice: dicePoolOf(mechanic), dicePresetId: mechanic.dicePresetId, modifier: mechanic.modifier, modifierRules: mechanic.modifierRules });
      }
      return;
    }
    if (nextMode === 'characters') {
      if (mechanic.kind === 'skillcheck') { onChange(convertSkillCheck(mechanic, 'opposedcheck')); return; }
      if (mechanic.kind === 'dice') {
        const defaults = defaultInteraction('opposedcheck', identity).mechanic as Extract<InteractionMechanic, { kind: 'opposedcheck' }>;
        onChange({ ...defaults, commonDice: dicePoolOf(mechanic), commonDicePresetId: mechanic.dicePresetId, actor: { ...defaults.actor, subject: mechanic.actor ?? defaultActor ?? { kind: 'context', role: 'actor' }, skill: mechanic.skill, modifier: mechanic.modifier, modifierRules: mechanic.modifierRules }, rivals: [] });
      }
      return;
    }
    if (mechanic.kind === 'skillcheck') {
      const defaults = defaultInteraction('dice', identity).mechanic as Extract<InteractionMechanic, { kind: 'dice' }>;
      const pool = dicePoolOf(mechanic);
      onChange({ ...defaults, ...pool, actor: mechanic.actor ?? (mechanic.skill?.kind === 'property' ? mechanic.skill.subject : defaultActor), skill: mechanic.skill, dicePresetId: mechanic.dicePresetId, modifier: mechanic.modifier, modifierRules: mechanic.modifierRules });
    } else if (mechanic.kind === 'opposedcheck') {
      const defaults = defaultInteraction('dice', identity).mechanic as Extract<InteractionMechanic, { kind: 'dice' }>;
      const pool = mechanic.actor.dice ?? mechanic.commonDice ?? { count: 1, sides: 20 };
      onChange({ ...defaults, ...pool, actor: mechanic.actor.subject, skill: mechanic.actor.skill, dicePresetId: mechanic.actor.dicePresetId ?? mechanic.commonDicePresetId, modifier: mechanic.actor.modifier, modifierRules: mechanic.actor.modifierRules });
    }
  };

  const actorSubject: LogicSubject | undefined = mechanic.kind === 'opposedcheck'
    ? mechanic.actor.subject.kind === 'context' && mechanic.actor.subject.role === 'actor'
      ? defaultInteractionActor(project, context) ?? mechanic.actor.subject
      : mechanic.actor.subject
    : mechanic.skill?.kind === 'property' ? mechanic.skill.subject : mechanic.actor;
  const actorSkill = mechanic.kind === 'opposedcheck' ? mechanic.actor.skill : mechanic.skill;
  const actorModifier = mechanic.kind === 'opposedcheck' ? mechanic.actor.modifier : mechanic.modifier;
  const actorRules = mechanic.kind === 'opposedcheck' ? mechanic.actor.modifierRules : mechanic.modifierRules;
  const actorId = mechanic.kind === 'opposedcheck' ? mechanic.actor.id : 'actor';
  const actorDice = mechanic.kind === 'opposedcheck' ? mechanic.actor.dice : undefined;
  const actorDicePreset = mechanic.kind === 'opposedcheck' ? mechanic.actor.dicePresetId : undefined;
  const commonDice = mechanic.kind === 'opposedcheck' ? mechanic.commonDice : undefined;
  const commonDicePreset = mechanic.kind === 'opposedcheck' ? mechanic.commonDicePresetId : undefined;
  const pool = mechanic.kind === 'opposedcheck' ? actorDice ?? commonDice ?? { count: 1, sides: 20 } : dicePoolOf(mechanic);
  const difficulty = mechanic.kind === 'skillcheck' ? mechanic.difficulty : 10;
  const operator = mechanic.kind === 'skillcheck' ? mechanic.difficultyOperator ?? '>=' : '>=';
  const actorName = characterOverview(project, actorSubject, locale, context)?.name ?? (es ? 'Actor actual' : 'Current actor');
  const activeProfile = project.playerProfiles?.find(item => item.id === project.activePlayerProfileId) ?? project.playerProfiles?.[0];
  const simulation = activeProfile?.simulation ?? (project.playerProfiles?.length ? {} : project.playerSimulation ?? {});
  const previewState = { ...simulation, context: { ...simulation.context, ...(actorSubject && actorSubject.kind !== 'context' ? { actor: actorSubject, self: actorSubject } : {}) } };
  const difficultyRoll = mechanic.kind === 'skillcheck' ? previewDifficultyRoll(project, previewState, mechanic) : undefined;
  const expressionFor = (dice: InteractionDice, skill?: InteractionValueSource, subject?: LogicSubject, modifier = 0) => {
    const sourceSubject = skill?.kind === 'property' && skill.subject.kind === 'context' && subject && subject.kind !== 'context' ? subject : skill?.kind === 'property' ? skill.subject : subject;
    const property = skill?.kind === 'property' ? numericFields(project, sourceSubject ?? { kind: 'context', role: 'actor' }).find(field => field.id === skill.propertyId) : undefined;
    const variable = skill?.kind === 'variable' ? project.logicVariables?.find(item => item.id === skill.variableId) : undefined;
    const attribute = skill?.kind === 'property' ? property?.label ?? skill.propertyId : variable?.name;
    const rawValue = skill?.kind === 'property' ? resolveCharacterProperty(project, simulation, sourceSubject ?? { kind: 'context', role: 'actor' }, skill.propertyId, { purpose: 'condition' }).value : skill?.kind === 'variable' ? simulation.variables?.[skill.variableId] : undefined;
    const value = typeof rawValue === 'number' && Number.isFinite(rawValue) ? ` (${rawValue})` : '';
    return `${diceFormula(dice)}${attribute ? ` + ${attribute}${value}` : ''}${modifier ? ` ${modifier > 0 ? '+' : '−'} ${Math.abs(modifier)}` : ''}`;
  };
  const signedModifier = (value: number) => value ? ` ${value > 0 ? '+' : '−'} ${Math.abs(value)}` : '';
  const previewExpression = difficultyRoll?.ready
    ? `${diceFormula(pool)}${actorSkill ? ` + ${difficultyRoll.skillLabel ?? (es ? 'Atributo' : 'Attribute')} (${difficultyRoll.skillValue})` : ''}${signedModifier(difficultyRoll.modifier)}`
    : expressionFor(pool, actorSkill, actorSubject, actorModifier);
  const rivalPreviews = mechanic.kind === 'opposedcheck' ? mechanic.rivals.map((rival, index) => {
    const subject = rival.subject.kind === 'context' ? undefined : rival.subject;
    const name = characterOverview(project, subject, locale, context)?.name ?? `${es ? 'Rival' : 'Rival'} ${index + 1}`;
    const dice = rival.dice ?? mechanic.commonDice ?? { count: 1, sides: 20 };
    return `${name}: ${expressionFor(dice, rival.skill, subject, rival.modifier)}`;
  }) : [];
  const actorUpdate = (subject: LogicSubject | undefined) => {
    const recentId = subject ? subjectRecentId(subject) : undefined;
    if (recentId) writeConditionRecent(project.projectId, 'interaction-actor', recentId);
    const skill = actorSkill?.kind === 'property' && subject ? { ...actorSkill, subject, propertyId: numericFields(project, subject).some(field => field.id === actorSkill.propertyId) ? actorSkill.propertyId : '' } : undefined;
    if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, actor: { ...mechanic.actor, subject: subject ?? { kind: 'context', role: 'actor' }, skill, modifier: subject ? actorModifier : 0, modifierRules: subject ? actorRules : undefined } });
    else if (mechanic.kind === 'skillcheck') onChange({ ...mechanic, actor: subject, skill, modifier: subject ? actorModifier : 0, modifierRules: subject ? actorRules : undefined });
    else onChange({ ...mechanic, actor: subject, skill, modifier: subject ? actorModifier : 0, modifierRules: subject ? actorRules : undefined });
  };
  const updateSkill = (skill?: InteractionValueSource) => {
    if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, actor: { ...mechanic.actor, skill } });
    else if (mechanic.kind === 'skillcheck' && !skill) {
      const defaults = defaultInteraction('dice', identity).mechanic as Extract<InteractionMechanic, { kind: 'dice' }>;
      const pool = dicePoolOf(mechanic);
      onChange({ ...defaults, ...pool, actor: mechanic.actor ?? actorSubject, dicePresetId: mechanic.dicePresetId, modifier: mechanic.modifier, modifierRules: mechanic.modifierRules });
    } else if (mechanic.kind === 'dice' && skill) {
      const defaults = defaultInteraction('skillcheck', identity).mechanic as Extract<InteractionMechanic, { kind: 'skillcheck' }>;
      onChange({ ...defaults, actor: mechanic.actor ?? (skill.kind === 'property' ? skill.subject : actorSubject) ?? defaultInteractionActor(project, context), skill, dice: dicePoolOf(mechanic), dicePresetId: mechanic.dicePresetId, modifier: mechanic.modifier, modifierRules: mechanic.modifierRules });
    } else onChange({ ...mechanic, skill });
  };
  const updateModifier = (modifier: number) => {
    if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, actor: { ...mechanic.actor, modifier } }); else onChange({ ...mechanic, modifier });
  };
  const updateRules = (modifierRules: InteractionModifierRule[]) => {
    if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, actor: { ...mechanic.actor, modifierRules } }); else onChange({ ...mechanic, modifierRules });
  };
  const setDifficulty = (value: number) => { if (mechanic.kind === 'skillcheck') onChange({ ...mechanic, difficulty: value }); };
  const setOperator = (value: string) => { if (mechanic.kind === 'skillcheck') onChange({ ...mechanic, difficultyOperator: value as '>=' | '>' }); };
  const updateActorParticipant = (participant: InteractionParticipant) => { if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, actor: participant }); };
  const updateRival = (id: string, participant: InteractionParticipant) => { if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, rivals: mechanic.rivals.map(rival => rival.id === id ? participant : rival) }); };
  const changeAggregation = (value: string) => { if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, aggregation: value as 'all' | 'any' }); };
  const addRival = (subject: LogicSubject) => { if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, rivals: [...mechanic.rivals, { id: `rival-${crypto.randomUUID()}`, subject, modifier: 0 }] }); };
  const removeRival = (id: string) => { if (mechanic.kind === 'opposedcheck') onChange({ ...mechanic, rivals: mechanic.rivals.filter(rival => rival.id !== id) }); };
  const selectorView = mechanicSelector ? mechanicSelector({ onOpenChange: setSelectorOpen }) : <div className="mechanic-selector-dice-settings">
    {mechanic.kind === 'opposedcheck' ? <>
      <section className="interaction-dice-settings-section"><header><strong>{es ? 'Dado común' : 'Common dice'}</strong><small>{es ? 'Lo usan el actor y los rivales sin una excepción.' : 'Used by the actor and rivals without an exception.'}</small></header><DiceFields project={project} identity={`${identity}:common-dice`} dice={mechanic.commonDice ?? { count: 1, sides: 20 }} locale={locale} onChange={commonDice => onChange({ ...mechanic, commonDice })} /></section>
      <section className="interaction-dice-settings-section"><header><strong>{es ? 'Dado del actor' : 'Actor dice'}</strong><small>{es ? 'Puedes usar el dado común o definir una excepción.' : 'Use the common dice or define an exception.'}</small></header><DicePoolPicker project={project} identity={`${identity}:actor`} dice={mechanic.actor.dice} presetId={mechanic.actor.dicePresetId} presets={dicePresets} locale={locale} allowCommon common={!mechanic.actor.dice} onChange={(dice, dicePresetId) => onChange({ ...mechanic, actor: { ...mechanic.actor, dice, dicePresetId } })} /></section>
    </> : <section className="interaction-dice-settings-section"><header><strong>{es ? 'Composición de dados' : 'Dice composition'}</strong><small>{es ? 'Ajusta el set seleccionado o crea una combinación.' : 'Adjust the selected set or create a combination.'}</small></header><DiceFields project={project} identity={identity} dice={pool} locale={locale} onChange={dice => mechanic.kind === 'dice' ? onChange({ ...mechanic, ...dice, minimum: dice.minimum, groups: dice.groups }) : onChange({ ...mechanic, dice })} /></section>}
  </div>;

  return <section className="interaction-dice-context" aria-label={es ? 'Contexto de la tirada' : 'Roll context'}>
    <div className={`interaction-dice-context-grid${selectorOpen ? ' is-selector-open' : ''}`}>
      <fieldset className="interaction-dice-actor-card">
        <legend>{es ? 'Personaje que actúa' : 'Acting character'}</legend>
        <ActorSubjectPicker project={project} subject={actorSubject} locale={locale} context={context} onChange={actorUpdate} />
        <ActorAttributePicker project={project} subject={actorSubject} skill={actorSkill} locale={locale} context={context} onChange={updateSkill} />
        {mechanic.kind === 'opposedcheck' ? <ParticipantFields project={project} participant={mechanic.actor} identity={`${identity}:actor`} actor locale={locale} context={context} presets={dicePresets} commonDice={commonDice} showSubject={false} showSkill={false} showDice={false} onChange={updateActorParticipant} /> : actorSubject ? <><NumberField project={project} identity={identity} field="modifier" label={es ? 'Modificador fijo' : 'Fixed modifier'} value={actorModifier} onChange={updateModifier} /><ModifierRulesFields project={project} identity={identity} rules={actorRules} locale={locale} context={context} onChange={updateRules} /></> : null}
      </fieldset>
      <div className={`interaction-dice-versus${mode === 'solo' ? ' is-solo' : ''}`}>
        {mode !== 'solo' || !mechanicSelector ? <b aria-hidden="true">{mode === 'world' ? (es ? 'CONTRA' : 'VS') : mode === 'characters' ? 'VS' : <ConditionPickerIcon name="D20" size={25} />}</b> : null}
        {selectorView}
        {mode === 'world' ? <div className="interaction-dice-check-preview"><small>{es ? 'Cálculo de la tirada' : 'Roll calculation'}</small><strong>{previewExpression}</strong></div> : mode === 'characters' ? <div className="interaction-dice-check-preview"><small>{es ? 'Cálculo del enfrentamiento' : 'Opposed calculation'}</small><strong>{actorName}: {previewExpression}</strong><span>{rivalPreviews.length ? `${es ? 'VS' : 'VS'} ${rivalPreviews.slice(0, 2).join(' · ')}${rivalPreviews.length > 2 ? ` · +${rivalPreviews.length - 2}` : ''}` : (es ? 'Añade o hereda personajes rivales' : 'Add or inherit opposing characters')}</span></div> : <div className="interaction-dice-check-preview"><small>{es ? 'Cálculo de la tirada' : 'Roll calculation'}</small><strong>{previewExpression}</strong><span>{es ? 'El total decide el resultado' : 'The total selects the outcome'}</span></div>}
      </div>
      <section className="interaction-dice-target-card" aria-label={es ? 'Objetivo de la tirada' : 'Roll target'}>
        <div className="interaction-dice-target-modes" role="group" aria-label={es ? 'Contexto de la tirada' : 'Roll context'}>
          <button type="button" aria-pressed={mode === 'world'} onClick={() => changeContext('world')}>{es ? 'Mundo' : 'World'}</button>
          <button type="button" aria-pressed={mode === 'characters'} onClick={() => changeContext('characters')}>{es ? 'Personajes' : 'Characters'}</button>
        </div>
        {mode === 'solo' ? <div className="interaction-dice-target-empty"><strong>{es ? 'Sin atributo · solo dados' : 'No attribute · dice only'}</strong><span>{es ? 'La tirada usa únicamente los dados y decide el resultado por sus intervalos.' : 'The roll uses only the dice and resolves by its result ranges.'}</span></div> : null}
        {mode === 'world' && mechanic.kind === 'skillcheck' && difficultyRoll ? <div className="interaction-dice-world-target">
          <section className="interaction-difficulty-threshold" aria-label={es ? 'Umbral de dificultad' : 'Difficulty threshold'}><header><Target size={16} aria-hidden="true" /><strong>{es ? 'Umbral de dificultad' : 'Difficulty threshold'}</strong></header><div className="interaction-fields-row"><label><span>{es ? 'Comparación' : 'Comparison'}</span><ConditionReferencePicker label={es ? 'Operador de dificultad' : 'Difficulty operator'} projectId={project.projectId} category="difficulty-operator" locale={locale} searchable={false} value={operator} candidates={[{ id: '>=', label: '≥', detail: es ? 'Igualar o superar la dificultad' : 'Meet or exceed the difficulty' }, { id: '>', label: '>', detail: es ? 'Superar la dificultad' : 'Exceed the difficulty' }]} onChoose={setOperator} /></label><NumberField project={project} identity={identity} field="difficulty" label={es ? 'Dificultad' : 'Difficulty'} value={difficulty} onChange={setDifficulty} /></div></section>
          <InteractionDifficultyGuide dice={mechanic.dice} difficulty={difficulty} operator={operator} roll={difficultyRoll} locale={locale} onChoose={setDifficulty} />
        </div> : null}
        {mode === 'characters' && mechanic.kind === 'opposedcheck' ? <div className="interaction-dice-rivals"><header><div><strong>{es ? 'Personajes rivales' : 'Opposing characters'}</strong><small>{es ? 'Cada rival puede usar el dado común o una excepción.' : 'Each rival can use the common dice or an exception.'}</small></div><label><span>{es ? 'Resultado' : 'Outcome'}</span><ConditionReferencePicker label={es ? 'Regla de victoria' : 'Victory rule'} projectId={project.projectId} category="opposed-aggregation" locale={locale} searchable={false} value={mechanic.aggregation} candidates={[{ id: 'all', label: es ? 'Vencer a todos' : 'Beat all' }, { id: 'any', label: es ? 'Vencer a cualquiera' : 'Beat any' }]} onChoose={changeAggregation} /></label></header>
          {mechanic.rivals.map((rival, index) => <fieldset className="interaction-opposed-rival-card" key={rival.id}><legend>{es ? `Rival ${index + 1}` : `Rival ${index + 1}`}</legend><CharacterOverview project={project} subject={rival.subject.kind === 'context' ? undefined : rival.subject} locale={locale} context={context} /><ParticipantFields project={project} participant={rival} identity={`${identity}:${rival.id}`} locale={locale} context={context} presets={dicePresets} commonDice={mechanic.commonDice} onChange={next => updateRival(rival.id, next)} /><button type="button" onClick={() => removeRival(rival.id)}>{es ? 'Quitar rival' : 'Remove rival'}</button></fieldset>)}
          <div className="interaction-dice-rival-actions"><button type="button" onClick={() => addRival({ kind: 'context', role: 'target' })}>{es ? 'Heredar objetivo del contexto' : 'Inherit context target'}</button><button type="button" onClick={() => addRival({ kind: 'entity', entityId: '' })}>{es ? 'Añadir personaje rival' : 'Add rival character'}</button></div>
        </div> : null}
      </section>
    </div>
  </section>;
}

export function InteractionMechanicFields(props: Props) {
  const { project, identity, locale, onChange, mechanic } = props;
  if (props.diceSetOnly && mechanic.kind === 'dice') return <DiceFields project={project} identity={identity} dice={mechanic} locale={locale} onChange={dice => onChange({ ...mechanic, ...dice, minimum: dice.minimum, modifier: 0, actor: undefined, skill: undefined, modifierRules: undefined, dicePresetId: undefined })} />;
  if (mechanic.kind === 'dice' || mechanic.kind === 'skillcheck' || mechanic.kind === 'opposedcheck') return <DiceContextFields {...props} mechanic={mechanic} />;
  return <MechanicFields {...props} />;
}
function MechanicFields({ project, mechanic: m, identity, locale, context, dicePresets, onChange }: Props) {
  const es = locale === 'es';
  if (m.kind === 'dice') {
    const actor = m.actor, subject = m.skill?.kind === 'property' ? m.skill.subject : actor ?? { kind: 'context', role: 'actor' } as LogicSubject;
    return <><DicePoolPicker project={project} identity={identity} dice={m} presetId={m.dicePresetId} presets={dicePresets} locale={locale} onChange={(dice,dicePresetId)=>{if(dice)onChange({...m,...dice,minimum:dice.minimum,groups:dice.groups,dicePresetId});}} /><div className="interaction-participant-line interaction-world-line"><SubjectFields project={project} subject={actor} locale={locale} context={context} optional onChange={next=>onChange({...m,actor:next,skill:m.skill?.kind==='property'&&next?{...m.skill,subject:next}:m.skill?.kind==='property'?undefined:m.skill})}/><SkillFields project={project} skill={m.skill} subject={subject} locale={locale} context={context} optional onChange={skill=>onChange({...m,skill,actor:skill?.kind==='property'?skill.subject:actor})}/><NumberField project={project} identity={identity} field="modifier" label={es ? 'Modificador fijo' : 'Fixed modifier'} value={m.modifier} onChange={modifier => onChange({ ...m, modifier })} /></div><ModifierRulesFields project={project} identity={identity} rules={m.modifierRules} locale={locale} context={context} onChange={modifierRules=>onChange({...m,modifierRules})}/></>;
  }
  if (m.kind === 'skillcheck') {
    const subject:LogicSubject=m.skill?.kind==='property'?m.skill.subject:m.actor??{kind:'context',role:'actor'};
    return <><div className="interaction-participant-line interaction-world-line"><SubjectFields project={project} subject={m.actor} locale={locale} context={context} optional onChange={actor=>onChange({...m,actor,skill:m.skill?.kind==='property'&&actor?{...m.skill,subject:actor}:m.skill?.kind==='property'?undefined:m.skill})}/><SkillFields project={project} skill={m.skill} subject={subject} locale={locale} context={context} optional onChange={skill=>onChange({...m,skill,actor:skill?.kind==='property'?skill.subject:m.actor})}/><DicePoolPicker project={project} identity={identity} dice={m.dice} presetId={m.dicePresetId} presets={dicePresets} locale={locale} onChange={(dice,dicePresetId)=>onChange({...m,dice,dicePresetId})}/><NumberField project={project} identity={identity} field="modifier" label={es?'Modificador fijo':'Fixed modifier'} value={m.modifier} onChange={modifier=>onChange({...m,modifier})}/><label><span>{es?'Comparación':'Comparison'}</span><ConditionReferencePicker label={es?'Operador de dificultad':'Difficulty operator'} projectId={project.projectId} category="difficulty-operator" locale={locale} searchable={false} value={m.difficultyOperator??'>='} candidates={[{id:'>=',label:'≥',detail:es?'El total iguala o supera la dificultad':'Total equals or exceeds the difficulty'},{id:'>',label:'>',detail:es?'El total debe superar la dificultad':'Total must exceed the difficulty'}]} onChoose={operator=>onChange({...m,difficultyOperator:operator as '>='|'>'})}/></label><NumberField project={project} identity={identity} field="difficulty" label={es?'Dificultad':'Difficulty'} value={m.difficulty} onChange={difficulty=>onChange({...m,difficulty})}/></div><ModifierRulesFields project={project} identity={identity} rules={m.modifierRules} locale={locale} context={context} onChange={modifierRules=>onChange({...m,modifierRules})}/></>;
  }
  if (m.kind === 'opposedcheck') return <><section className="interaction-common-dice"><h4>{es?'Dado común':'Common dice'}</h4><DicePoolPicker project={project} identity={`${identity}:common-dice`} dice={m.commonDice} presetId={m.commonDicePresetId} presets={dicePresets} locale={locale} onChange={(commonDice,commonDicePresetId)=>onChange({...m,commonDice,commonDicePresetId})}/></section><div className="interaction-opposed-layout"><fieldset className="interaction-opposed-actor-card"><legend>{es?'Actor':'Actor'}</legend><ParticipantFields project={project} participant={m.actor} actor identity={`${identity}:actor`} locale={locale} context={context} presets={dicePresets} commonDice={m.commonDice} onChange={actor => onChange({ ...m, actor })} /></fieldset><section className="interaction-opposed-rivals"><header><h4>{es?'Rivales':'Rivals'}</h4><label><span>{es ? 'Resultado global' : 'Overall result'}</span><ConditionReferencePicker label={es ? 'Comparar rivales' : 'Compare rivals'} projectId={project.projectId} category="opposed-aggregation" locale={locale} searchable={false} value={m.aggregation} candidates={[{ id: 'all', label: es ? 'Vencer a todos' : 'Beat all rivals' }, { id: 'any', label: es ? 'Vencer a cualquiera' : 'Beat any rival' }]} onChoose={aggregation => onChange({ ...m, aggregation: aggregation as 'all' | 'any' })} /></label></header><div className="interaction-opposed-rivals-grid">{m.rivals.map((rival, index) => <fieldset className="interaction-opposed-rival-card" key={rival.id}><legend>{es ? 'Rival' : 'Rival'} {index + 1}</legend><ParticipantFields project={project} participant={rival} identity={`${identity}:${rival.id}`} locale={locale} context={context} presets={dicePresets} commonDice={m.commonDice} onChange={next => onChange({ ...m, rivals: m.rivals.map(item => item.id === rival.id ? next : item) })} /><button type="button" onClick={() => onChange({ ...m, rivals: m.rivals.filter(item => item.id !== rival.id) })}>{es ? 'Quitar rival' : 'Remove rival'}</button></fieldset>)}</div><button type="button" className="interaction-add-rival" onClick={() => onChange({ ...m, rivals: [...m.rivals, { id: `rival-${crypto.randomUUID()}`, subject: { kind: 'entity', entityId: '' }, modifier: 0 }] })}>{es ? 'Añadir rival' : 'Add rival'}</button></section></div></>;
  if (m.kind === 'qte') return <div className="interaction-fields-row"><AuthoringTextField projectId={project.projectId} elementId={identity} field="qte:key" label={es ? 'Tecla' : 'Key'} value={m.key} onCommit={key => onChange({ ...m, key })} /><NumberField project={project} identity={identity} field="qte:duration" label={es ? 'Duración (ms)' : 'Duration (ms)'} value={m.durationMs} min={1} onChange={durationMs => onChange({ ...m, durationMs })} /></div>;
  return <><AuthoringTextField projectId={project.projectId} elementId={identity} field="custom:description" label={es ? 'Descripción' : 'Description'} multiline value={m.description} onCommit={description => onChange({ ...m, description })} /><AuthoringTextField projectId={project.projectId} elementId={identity} field="custom:parameters" label={es ? 'Parámetros (JSON)' : 'Parameters (JSON)'} multiline value={JSON.stringify(m.parameters ?? {}, null, 2)} validate={text => { try { const value = JSON.parse(text); return value && !Array.isArray(value) && typeof value === 'object' ? undefined : 'Objeto requerido'; } catch { return 'JSON inválido'; } }} onCommit={text => onChange({ ...m, parameters: JSON.parse(text) })} /></>;
}
