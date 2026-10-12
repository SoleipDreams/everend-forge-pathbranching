import { useContext, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { InspectorIndexHost } from './InspectorIndexHost.js';
import { NarrativeNameEditor } from './NarrativeNameEditor.js';
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { ConversationEditor } from './ConversationEditor.js';
import { ConversationLineMenu } from './ConversationLineMenu.js';
import { NarrativeInsertionGap } from './NarrativeInsertionGap.js';
import { insertReadingDecision, narrativeReadingPath } from '../narrativeReadingPath.js';
import { NarrativeDecisionCard } from './NarrativeDecisionCard.js';
import { ConversationEndControl } from './ConversationEndControl.js';
import { NarrativeTransitionControl } from './NarrativeTransitionControl.js';
import { scrollInspectorContent } from './scrollInspectorContent.js';
import { narrativeNodeReferences } from '../authoringMutations.js';
import { conversationGroups, conversationProjection } from '../conversationModel.js';
import { deleteDialogue } from '../projectMutations.js';
import { authoringDraftEntries } from '../authoringDrafts.js';
import { insertNarrativeBlock } from '../authoringMutations.js';
import { useOverlayFocus } from './useOverlayFocus.js';
import { useInterfaceLocale } from '../i18n.js';
import { isGenericSpeakerRef } from '../speakerRoles.js';
import { scriptBlockTextKey } from '../localization.js';
import '../inspectorModules.css';

type NarrativeIndexEntry = { id: string; title: string; excerpt: string; speaker?: string; kind: 'line' | 'decision' };
type NarrativeIndexSection = { id: string; title: string; kind: string; own: boolean; entries: NarrativeIndexEntry[] };

function decisionSelectionPreferenceKey(project: ComponentProps<typeof ConversationEditor>['project'], eventId: string) {
  return `pathbranching:narrative-decision-selections:${JSON.stringify([project.universeRootPath, project.projectId, eventId])}`;
}

function restoreDecisionSelections(key: string, eventId: string, decisions: NonNullable<ComponentProps<typeof ConversationEditor>['project']['events'][number]['decisions']>) {
  let remembered: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      remembered = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    }
  } catch { /* Start with the first available option if local preferences are unavailable. */ }

  return Object.fromEntries(decisions.flatMap(decision => {
    const nodeId = `decision:${eventId}:${decision.id}`;
    const rememberedOption = remembered[nodeId];
    const selected = decision.outcomes.find(option => option.id === rememberedOption)?.id ?? decision.outcomes[0]?.id;
    return selected ? [[nodeId, selected]] : [];
  }));
}

function rememberDecisionSelection(key: string, nodeId: string, optionId: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    const remembered = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {};
    localStorage.setItem(key, JSON.stringify({ ...remembered, [nodeId]: optionId }));
  } catch { /* Keep the selection for this session when local storage is unavailable. */ }
}

export function GroupedConversationEditor(props: ComponentProps<typeof ConversationEditor>) {
  const es = useInterfaceLocale() === 'es';
  const indexHost = useContext(InspectorIndexHost);
  const activeEvent = props.project.events.find(event=>event.id===props.eventId);
  const eventDecisions = activeEvent?.decisions ?? [];
  const outgoingRouteCounts = new Map<string, number>();
  for (const transition of activeEvent?.transitions ?? []) {
    outgoingRouteCounts.set(transition.from, (outgoingRouteCounts.get(transition.from) ?? 0) + 1);
  }
  const choicePreferenceKey = decisionSelectionPreferenceKey(props.project, props.eventId);
  const [choices, setChoices] = useState<Record<string,string>>(() => restoreDecisionSelections(choicePreferenceKey, props.eventId, eventDecisions));
  useEffect(() => { setChoices(restoreDecisionSelections(choicePreferenceKey, props.eventId, eventDecisions)); }, [choicePreferenceKey]);
  const selectedChoices = useMemo(() => {
    const next = { ...choices };
    for (const decision of eventDecisions) {
      const nodeId = `decision:${props.eventId}:${decision.id}`;
      if (decision.outcomes.some(option => option.id === next[nodeId])) continue;
      const firstOption = decision.outcomes[0]?.id;
      if (firstOption) next[nodeId] = firstOption;
      else delete next[nodeId];
    }
    return next;
  }, [choices, eventDecisions, props.eventId]);
  const selectDecision = (decisionId: string, optionId: string) => {
    const decision = eventDecisions.find(item => `decision:${props.eventId}:${item.id}` === decisionId);
    if (!decision?.outcomes.some(option => option.id === optionId)) return;
    setChoices(current => ({ ...current, [decisionId]: optionId }));
    rememberDecisionSelection(choicePreferenceKey, decisionId, optionId);
  };
  const branching = Boolean(eventDecisions.length || [...outgoingRouteCounts.values()].some(count => count > 1));
  const eventPath = narrativeReadingPath(props.project, { eventId: props.eventId }, selectedChoices);
  const visibleGroups = new Set(eventPath.nodes.filter(node=>node.kind==='dialogue').map(node=>node.id));
  const [notice, setNotice] = useState<string>(), [near, setNear] = useState(0), [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null), applying = useRef(false);
  const indexScroller = useRef<HTMLDivElement>(null);
  const [indexScrollEdges, setIndexScrollEdges] = useState({ up: false, down: false });
  const [indexHoverDirection, setIndexHoverDirection] = useState<'up' | 'down'>();
  const orderKey = `pathbranching:conversation-order:${JSON.stringify([props.project.universeRootPath, props.project.projectId, props.eventId])}`;
  const readOrder = () => { try { const value = JSON.parse(localStorage.getItem(orderKey) ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; } };
  const [order, setOrder] = useState<string[]>(readOrder);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string }>();
  const dialogRef = useRef<HTMLElement>(null);
  useOverlayFocus(dialogRef, Boolean(pendingDelete), () => setPendingDelete(undefined), true, '[data-overlay-focus]');
  useEffect(() => { setOrder(readOrder()); setPendingDelete(undefined); }, [orderKey]);
  const orderedGroups = useMemo(() => conversationGroups(props.project, props.eventId)
    .filter(group => !branching || props.dialogueId || group.own || visibleGroups.has(group.id))
    .filter(group => !group.own || branching && eventPath.nodes.some(node=>node.beat) || conversationProjection(props.project, group.context).rows.length || conversationProjection(props.project, group.context).legacy?.content)
    .sort((a, b) => branching ? (a.own ? -1 : b.own ? 1 : eventPath.nodes.findIndex(node=>node.id===a.id)-eventPath.nodes.findIndex(node=>node.id===b.id)) : a.own ? -1 : b.own ? 1 : (order.indexOf(a.id) < 0 ? order.length : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? order.length : order.indexOf(b.id))), [props.project, props.eventId, props.dialogueId, order, selectedChoices]);
  const groups = orderedGroups.filter(group => !props.dialogueId || group.context.dialogueId === props.dialogueId);
  const indexGroups = useMemo(() => {
    const everyGroup = conversationGroups(props.project, props.eventId);
    if (props.dialogueId) {
      const dialogues = everyGroup.filter(group => !group.own);
      const current = dialogues.filter(group => group.context.dialogueId === props.dialogueId);
      const remaining = dialogues.filter(group => group.context.dialogueId !== props.dialogueId)
        .sort((a, b) => (order.indexOf(a.id) < 0 ? order.length : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? order.length : order.indexOf(b.id)));
      return [...current, ...remaining];
    }
    const visibleIds = new Set(groups.map(group => group.id));
    const remaining = everyGroup.filter(group => !visibleIds.has(group.id))
      .sort((a, b) => (order.indexOf(a.id) < 0 ? order.length : order.indexOf(a.id)) - (order.indexOf(b.id) < 0 ? order.length : order.indexOf(b.id)));
    return [...groups, ...remaining];
  }, [groups, props.dialogueId, props.project, props.eventId, order]);
  const previousContextFor = (groupId: string) => {
    const index = orderedGroups.findIndex(group => group.id === groupId);
    if (index <= 0) return undefined;
    const previous = orderedGroups[index - 1];
    return { ...previous.context, legacyEventContextFallback: previous.own || index === 1 };
  };
  const allGroups = conversationGroups(props.project, props.eventId).filter(group => !group.own);
  const orderedIds = [...new Set([...order.filter(id => allGroups.some(group => group.id === id)), ...allGroups.map(group => group.id)])];
  const moveGroup = (id: string, target: number) => {
    const ids = [...orderedIds], from = ids.indexOf(id);
    if (from < 0 || target < 0 || target >= ids.length || target === from) return;
    ids.splice(from, 1); ids.splice(target, 0, id); setOrder(ids);
    try { localStorage.setItem(orderKey, JSON.stringify(ids)); } catch { /* Keep session order if storage is unavailable. */ }
    requestAnimationFrame(() => targetFor(id)?.querySelector<HTMLButtonElement>('.conversation-group-actions button:not(:disabled)')?.focus({ preventScroll: true }));
  };
  const removeGroup = async (dialogueId: string) => {
    if (applying.current) return;
    applying.current = true; setBusy(true);
    try {
      await props.onMutation(current => {
        const event = current.events.find(event => event.id === props.eventId);
        const dialogue = event?.dialogues?.find(dialogue => dialogue.id === dialogueId);
        if (!dialogue) throw new Error(es ? 'Esta conversación ya no existe.' : 'This conversation no longer exists.');
        const ids = new Set([dialogueId, `dialogue:${props.eventId}:${dialogueId}`, ...(dialogue.beats ?? []).flatMap(beat => [beat.id, `beat:${props.eventId}:${beat.id}`, beat.blockRef.blockId])]);
        const nodeIds = new Set([...ids, `dialogue-boundary:${props.eventId}:${dialogueId}:input`, `dialogue-boundary:${props.eventId}:${dialogueId}:output`]);
        const referenced = current.events.some(owner => owner.id !== props.eventId && owner.transitions?.some(route => nodeIds.has(route.from) || nodeIds.has(route.to)))
          || current.narrativeActions?.some(action => action.targetNodeId && nodeIds.has(action.targetNodeId))
          || current.narrativeRules?.some(rule => rule.targetNodeId && nodeIds.has(rule.targetNodeId))
          || current.authoringScenarios?.some(scenario => scenario.startNodeId && nodeIds.has(scenario.startNodeId))
          || current.events.some(owner => owner.interactionUses?.some(use => owner.id === props.eventId && use.dialogueId === dialogueId || use.ownerNodeId && nodeIds.has(use.ownerNodeId)) || owner.id === props.eventId && owner.interactionBarriers?.some(barrier => barrier.dialogueId === dialogueId));
        if (referenced) throw new Error(es ? 'Esta conversación tiene interacciones o referencias externas. Revisa esos vínculos antes de eliminarla.' : 'This conversation has interactions or external references. Review those links before deleting it.');
        if (authoringDraftEntries(current.projectId).some(([key]) => { try { return ids.has(JSON.parse(key)[1]); } catch { return false; } })) throw new Error(es ? 'Guarda o resuelve los borradores de esta conversación antes de eliminarla.' : 'Save or resolve this conversation’s drafts before deleting it.');
        return deleteDialogue(current, props.eventId, dialogueId).project;
      });
      setNotice(undefined);
      if (props.dialogueId === dialogueId) props.onOpenSection?.(props.eventId, 'path');
      requestAnimationFrame(() => (root.current?.querySelector<HTMLElement>('.conversation-dialogue-title button,.conversation-add-line,.narrative-add button') ?? root.current)?.focus({ preventScroll: true }));
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { applying.current = false; setBusy(false); }
  };
  const indexSections = useMemo<NarrativeIndexSection[]>(() => indexGroups.map(group => {
    const projection = conversationProjection(props.project, group.context);
    const rows = new Map(projection.rows.map(row => [row.id, row]));
    const pathNodes = branching
      ? narrativeReadingPath(props.project, group.context, selectedChoices).nodes
      : projection.rows;
    const entries: NarrativeIndexEntry[] = pathNodes.flatMap<NarrativeIndexEntry>(node => {
      if ('beat' in node && node.beat) {
        const row = rows.get(node.id);
        if (!row) return [];
        const block = row.block;
        const key = block?.textKey ?? (block ? scriptBlockTextKey(row.beat.blockRef.scriptId, block.id) : undefined);
        const primary = props.project.localizationCatalog?.primaryLocale ?? 'und';
        const excerpt = (block && key ? props.project.localizationCatalog?.entries[key]?.values[primary] : undefined) ?? block?.content ?? (es ? 'Diálogo sin texto' : 'Untitled dialogue');
        const speakerRef = block?.characterRef ?? block?.speakerRef;
        const speaker = speakerRef && !isGenericSpeakerRef(speakerRef)
          ? props.project.canonRefs.find(ref => ref.id === speakerRef)?.label
            ?? props.project.localExplorerEntities?.find(entity => entity.id === speakerRef)?.name
            ?? speakerRef
          : undefined;
        const cleanExcerpt = excerpt.trim() || (es ? 'Diálogo sin texto' : 'Untitled dialogue');
        const title = speaker ? `${speaker}: ${cleanExcerpt}` : cleanExcerpt;
        return [{ id: node.id, speaker, excerpt: cleanExcerpt, title, kind: 'line' as const }];
      }
      if (node.kind === 'decision') return [{ id: node.id, excerpt: node.label, title: node.label, kind: 'decision' as const }];
      return [];
    });
    return {
      id: group.id,
      title: group.title || (group.own ? (es ? 'Evento sin nombre' : 'Untitled event') : (es ? 'Conversación sin título' : 'Untitled conversation')),
      kind: group.own ? (es ? 'Evento' : 'Event') : (es ? 'Conversación' : 'Conversation'),
      own: group.own,
      entries,
    };
  }).filter(section => !section.own || section.entries.length > 0), [indexGroups, props.project, branching, selectedChoices, es]);
  const indexEntries = useMemo<Array<{ id: string; title: string }>>(() => indexSections.flatMap(section => [
    { id: section.id, title: section.title },
    ...section.entries.map(entry => ({ id: entry.id, title: entry.title })),
  ]), [indexSections]);
  const currentIndexSectionIndex = useMemo(() => {
    if (!indexSections.length) return -1;
    if (props.dialogueId) return 0;
    let offset = 0;
    for (let index = 0; index < indexSections.length; index += 1) {
      const section = indexSections[index];
      if (near < offset + section.entries.length + 1) return index;
      offset += section.entries.length + 1;
    }
    return indexSections.length - 1;
  }, [indexSections, near, props.dialogueId]);
  const currentIndexSection = currentIndexSectionIndex >= 0 ? indexSections[currentIndexSectionIndex] : undefined;
  const [expandedIndexSectionId, setExpandedIndexSectionId] = useState<string>();
  const targetFor = (id: string) => [...(root.current?.querySelectorAll<HTMLElement>('[data-conversation-section], [data-conversation-id], [data-narrative-decision]') ?? [])].find(el => el.dataset.conversationSection === id || el.dataset.conversationId === id || el.dataset.authoringId === id);
  const jump = (id: string) => { const target = targetFor(id); if(target)scrollInspectorContent(target); target?.focus({ preventScroll: true }); };
  const selectRoute = (source:string,routeId:string) => {
    setChoices(current=>({...current,[`route:${source}`]:routeId}));
    const destination=props.project.events.find(event=>event.id===props.eventId)?.transitions?.find(route=>route.id===routeId && route.from===source)?.to;
    if(destination)requestAnimationFrame(()=>requestAnimationFrame(()=>{const target=targetFor(destination);if(target)scrollInspectorContent(target,'start');}));
  };
  const projectSubevent = (id:string) => props.project.events.some(event=>event.id===id);
  const openSequenceInspector = (id:string) => {
    if (projectSubevent(id)) { props.onOpenSection?.(id,'overview'); return; }
    const target = narrativeNodeReferences(props.project,props.eventId).find(node=>node.id===id);
    if (!target) { jump(id); return; }
    const section = target.kind==='dialogue' ? 'narrativeSequence' : target.kind==='decision' ? 'narrativeDecision' : 'content';
    props.onOpenSection?.(id,section);
  };
  useEffect(() => {
    const scroll = root.current?.closest<HTMLElement>('.inspector-scroll');
    if (!scroll) return;
    let frame = 0;
    const update = () => {
      const viewport = scroll.getBoundingClientRect(), anchor = viewport.top + Math.min(120, viewport.height / 3);
      let closest = 0, distance = Infinity;
      indexEntries.forEach((entry, index) => {
        const target = targetFor(entry.id);
        const sectionHeading = target?.matches('[data-conversation-section]') ? target.querySelector<HTMLElement>('.conversation-dialogue-title') : null;
        const rect = (sectionHeading ?? target)?.getBoundingClientRect();
        if (!rect) return;
        const gap = anchor < rect.top ? rect.top - anchor : anchor > rect.bottom ? anchor - rect.bottom : 0;
        if (gap < distance) { distance = gap; closest = index; }
      });
      setNear(closest);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    scroll.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule); observer.observe(scroll); if (root.current) observer.observe(root.current);
    schedule();
    return () => { cancelAnimationFrame(frame); scroll.removeEventListener('scroll', schedule); observer.disconnect(); };
  }, [indexEntries]);
  useEffect(() => {
    const scroller = indexScroller.current;
    if (!scroller) return;
    const updateEdges = () => {
      const next = {
        up: scroller.scrollTop > 1,
        down: scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1,
      };
      setIndexScrollEdges(current => current.up === next.up && current.down === next.down ? current : next);
      setIndexHoverDirection(current => current === 'up' && !next.up || current === 'down' && !next.down ? undefined : current);
    };
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    scroller.querySelectorAll<HTMLElement>('.conversation-index-section').forEach(section => observer.observe(section));
    const mutations = new MutationObserver(updateEdges);
    mutations.observe(scroller, { childList: true, subtree: true });
    scroller.addEventListener('scroll', updateEdges, { passive: true });
    updateEdges();
    return () => {
      observer.disconnect();
      mutations.disconnect();
      scroller.removeEventListener('scroll', updateEdges);
    };
  }, [indexSections, expandedIndexSectionId]);
  useEffect(() => {
    const scroller = indexScroller.current;
    if (!scroller || !indexHoverDirection) return;
    let frame = 0;
    const step = () => {
      const canScroll = indexHoverDirection === 'up'
        ? scroller.scrollTop > 0
        : scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
      if (!canScroll) {
        setIndexHoverDirection(undefined);
        return;
      }
      scroller.scrollTop += indexHoverDirection === 'up' ? -5 : 5;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [indexHoverDirection]);
  useEffect(() => {
    setExpandedIndexSectionId(undefined);
    setIndexHoverDirection(undefined);
  }, [props.eventId, props.dialogueId]);
  const create = async (kind: 'dialogue' | 'speech') => {
    if (applying.current) return;
    applying.current = true; setBusy(true);
    try {
      let created: string | undefined;
      await props.onMutation(current => {
        const path=narrativeReadingPath(current,{eventId:props.eventId,dialogueId:props.dialogueId},selectedChoices);
        const tail=path.nodes.at(-1);
        let afterNodeId=branching ? tail?.id : undefined;
        if(branching && tail?.kind==='decision') {
          const decision=current.events.find(event=>event.id===props.eventId)?.decisions?.find(decision=>decision.id===tail.elementId);
          const selected=decision?.outcomes.find(option=>option.id===selectedChoices[tail.id]);
          if(!selected)throw new Error(es?'Selecciona una opción para añadir su continuación.':'Select an option to add its continuation.');
          afterNodeId=`outcome:${props.eventId}:${tail.elementId}:${selected.id}`;
        }
        const result = insertNarrativeBlock(current, props.eventId, kind, { dialogueId: props.dialogueId, afterNodeId });
        if (result.project === current) throw new Error(result.message);
        created = result.selection?.id; return result.project;
      });
      setNotice(undefined);
      if (created) requestAnimationFrame(() => {
        const target = targetFor(created!); if(target)scrollInspectorContent(target,'nearest');
        (target?.querySelector<HTMLElement>('textarea, button') ?? target)?.focus({ preventScroll: true });
      });
    } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { applying.current = false; setBusy(false); }
  };
  const createDecision = async (dialogueId?: string, afterId?: string, beforeId?:string) => {
    if (applying.current) return;
    applying.current=true; setBusy(true);
    try {
      await props.onMutation(current => {
        const result=insertReadingDecision(current,{eventId:props.eventId,dialogueId},afterId,beforeId);
        if(result.project===current)throw new Error(result.message);
        return result.project;
      });
      setNotice(undefined);
    } catch(error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { applying.current=false; setBusy(false); }
  };
  const insertAtConversationBoundary = async (kind:'dialogue'|'decision', afterId?:string, beforeId?:string) => {
    if (applying.current) return;
    applying.current=true; setBusy(true);
    let created: string | undefined;
    try {
      await props.onMutation(current => {
        const result=kind==='decision'
          ? insertReadingDecision(current,{eventId:props.eventId},afterId,beforeId)
          : insertNarrativeBlock(current,props.eventId,'dialogue',{afterNodeId:afterId,beforeNodeId:beforeId});
        if(result.project===current)throw new Error(result.message);
        if(result.selection?.type==='node')created=result.selection.id;
        return result.project;
      });
      setNotice(undefined);
      if(!branching && kind==='dialogue' && created) {
        const nextOrder=orderedIds.filter(id=>id!==created);
        const beforeIndex=beforeId ? nextOrder.indexOf(beforeId) : -1;
        const afterIndex=afterId ? nextOrder.indexOf(afterId) : -1;
        nextOrder.splice(beforeIndex>=0 ? beforeIndex : afterIndex>=0 ? afterIndex+1 : nextOrder.length,0,created);
        setOrder(nextOrder);
        try { localStorage.setItem(orderKey,JSON.stringify(nextOrder)); } catch { /* Keep the new order for this session. */ }
      }
      if(created)requestAnimationFrame(()=>targetFor(created!)?.focus({preventScroll:true}));
    } catch(error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { applying.current=false; setBusy(false); }
  };
  const rootInsertionGap = (key:string, afterId?:string, beforeId?:string) => <NarrativeInsertionGap key={key} variant="sequence" label={es?'Añadir en esta posición':'Add at this position'} options={[
    {label:es?'Conversación':'Conversation',disabled:busy,run:()=>{void insertAtConversationBoundary('dialogue',afterId,beforeId);}},
    ...(branching ? [{label:es?'Decisión':'Decision',disabled:busy,run:()=>{void insertAtConversationBoundary('decision',afterId,beforeId);}}] : []),
  ]}/>;
  const decisionCard = (id: string) => {
    const node=narrativeNodeReferences(props.project,props.eventId).find(node=>node.id===id);
    const decision=props.project.events.find(event=>event.id===props.eventId)?.decisions?.find(decision=>decision.id===node?.elementId);
    return decision ? <NarrativeDecisionCard key={id} project={props.project} eventId={props.eventId} decision={decision} selected={selectedChoices[id]} onSelect={option=>selectDecision(id,option)} onMutation={props.onMutation} selections={selectedChoices} onExploreRoute={selectRoute} onNavigate={id=>{if(projectSubevent(id))props.onOpenSection?.(id,'overview');else jump(id);}} es={es}/> : null;
  };
  const transitionControl = (source:string,dialogueId?:string) => <NarrativeTransitionControl key={`transition:${source}`} project={props.project} eventId={props.eventId} source={source} dialogueId={dialogueId} selections={selectedChoices} onMutation={props.onMutation} onNavigate={id=>{if(projectSubevent(id))props.onOpenSection?.(id,'overview');else jump(id);}} onExploreRoute={route=>selectRoute(source,route)} es={es}/>;
  const renderContext = (dialogueId?: string, previousConversationContext?: ComponentProps<typeof ConversationEditor>['previousConversationContext']) => {
    if(!branching)return <ConversationEditor {...props} dialogueId={dialogueId} previousConversationContext={previousConversationContext} onCreateDecision={(id,before)=>{void createDecision(dialogueId,id,before);}}/>;
    const path=narrativeReadingPath(props.project,{eventId:props.eventId,dialogueId},selectedChoices);
    const parts: React.ReactNode[]=[]; let rows:string[]=[]; let first=true;
    const event=props.project.events.find(item=>item.id===props.eventId);
    const shownRouteSources=new Set<string>();
    const appendRouteControl=(source:string)=>{
      if(shownRouteSources.has(source) || (event?.transitions?.filter(route=>route.from===source).length??0)<2)return;
      shownRouteSources.add(source);parts.push(transitionControl(source,dialogueId));
    };
    const entryPrefix=dialogueId ? `dialogue-boundary:${props.eventId}:${dialogueId}:input` : `boundary:${props.eventId}:input:`;
    [...new Set((event?.transitions??[]).filter(route=>route.from.startsWith(entryPrefix)).map(route=>route.from))].forEach(appendRouteControl);
    const flush = () => { if(!rows.length)return; const ids=rows;rows=[];parts.push(<ConversationEditor key={ids[0]} {...props} dialogueId={dialogueId} previousConversationContext={previousConversationContext} visibleRowIds={ids} hideSummary={!first} hideComposer={path.stopped?.reason==='choice' || path.nodes.at(-1)?.id !== ids.at(-1)} onCreateDecision={(id,before)=>{void createDecision(dialogueId,id,before);}}/>);first=false; };
    for(const node of (dialogueId ? path.nodes : path.nodes.slice(0,path.nodes.findIndex(node=>node.kind==='dialogue') < 0 ? undefined : path.nodes.findIndex(node=>node.kind==='dialogue')))){if(node.beat){rows.push(node.id);appendRouteControlAfterFlush(node.id);}else if(node.kind==='decision'){const preceding=rows.at(-1);flush();if(preceding)parts.push(transitionControl(preceding,dialogueId));parts.push(decisionCard(node.id));}}
    function appendRouteControlAfterFlush(source:string){if((event?.transitions?.filter(route=>route.from===source).length??0)>1){flush();appendRouteControl(source);}}
    flush();
    if(dialogueId && !path.nodes.length)parts.push(<ConversationEditor key="empty" {...props} dialogueId={dialogueId} previousConversationContext={previousConversationContext} onCreateDecision={(id,before)=>{void createDecision(dialogueId,id,before);}}/>);
    if(path.stopped?.reason==='routes' && !path.stopped.id.startsWith('outcome:'))appendRouteControl(path.stopped.id);
    if(path.stopped && ['cycle','missing'].includes(path.stopped.reason))parts.push(<p key="stopped" className="narrative-muted">{es ? (path.stopped.reason==='cycle'?'Este recorrido vuelve a un punto anterior.':'El destino no está disponible en este contexto.') : (path.stopped.reason==='cycle'?'This path returns to an earlier point.':'This destination is not available in this context.')}</p>);
    return parts;
  };
  return <div className="conversation-reader" ref={root} tabIndex={-1}>
    <div className="conversation-reader-main">
      {groups.map(group => <section key={group.id} className="conversation-dialogue-section" data-conversation-section={group.id} tabIndex={-1} aria-label={group.own ? (es ? 'Diálogos sueltos' : 'Standalone dialogue') : group.title}>
        {!group.own ? <header className="conversation-dialogue-title">
          <div className="narrative-name-heading"><h2><span>{group.title || (es ? 'Conversación sin título' : 'Untitled conversation')}</span><span className="narrative-node-separator" aria-hidden="true">·</span><span className="narrative-node-kind">{es ? 'Conversación' : 'Conversation'}</span></h2><NarrativeNameEditor project={props.project} nodeId={group.id} onMutation={props.onMutation}/></div>
          <div className="conversation-group-actions" role="group" aria-label={es ? 'Acciones de conversación' : 'Conversation actions'}>
            <button type="button" aria-label={es ? 'Mover conversación arriba' : 'Move conversation up'} title={es ? 'Mover conversación arriba' : 'Move conversation up'} disabled={busy || branching || orderedIds.indexOf(group.id) < 1} onClick={() => moveGroup(group.id, orderedIds.indexOf(group.id) - 1)}><ChevronUp size={17} aria-hidden="true" /></button>
            <button type="button" aria-label={es ? 'Mover conversación abajo' : 'Move conversation down'} title={es ? 'Mover conversación abajo' : 'Move conversation down'} disabled={busy || branching || orderedIds.indexOf(group.id) >= orderedIds.length - 1} onClick={() => moveGroup(group.id, orderedIds.indexOf(group.id) + 1)}><ChevronDown size={17} aria-hidden="true" /></button>
            <button type="button" className="conversation-group-delete" aria-label={es ? 'Eliminar conversación' : 'Delete conversation'} title={es ? 'Eliminar conversación' : 'Delete conversation'} disabled={busy} onClick={() => setPendingDelete({ id: group.context.dialogueId!, title: group.title || (es ? 'Conversación sin título' : 'Untitled conversation') })}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </header> : null}
        {renderContext(group.context.dialogueId, group.context.dialogueId ? previousContextFor(group.id) : undefined)}
        {!group.own ? <ConversationEndControl project={props.project} eventId={props.eventId} dialogueId={group.context.dialogueId!} selections={selectedChoices} onMutation={props.onMutation} onExploreRoute={route=>selectRoute('dialogue:'+props.eventId+':'+group.context.dialogueId!,route)} onOpenParent={props.dialogueId === group.context.dialogueId ? ()=>props.onOpenSection?.(props.eventId,'path') : undefined} onNavigate={openSequenceInspector} es={es}/> : null}
      </section>).flatMap((section,index) => {
        const group=groups[index];
        if(group.own || props.dialogueId)return [section];
        if(!branching) {
          const nextConversation=groups.slice(index+1).some(item=>!item.own);
          return [rootInsertionGap(`sequence-before-${group.id}`,undefined,group.id),section,...(!nextConversation ? [rootInsertionGap(`sequence-after-${group.id}`,group.id)] : [])];
        }
        const at=eventPath.nodes.findIndex(node=>node.id===group.id);
        if(at<0)return [section];
        const event=props.project.events.find(item=>item.id===props.eventId);
        const incoming=(event?.transitions??[]).filter(route=>route.to===group.id);
        const preceding=eventPath.nodes[at-1];
        const previousDecision=preceding?.kind==='decision' ? event?.decisions?.find(item=>item.id===preceding.elementId) : undefined;
        const selectedOutcome=previousDecision?.outcomes.find(item=>item.id===selectedChoices[preceding!.id]);
        const preferredSource=previousDecision && selectedOutcome ? `outcome:${props.eventId}:${previousDecision.id}:${selectedOutcome.id}` : preceding?.id ?? `boundary:${props.eventId}:input:entry`;
        const preferredIncoming=incoming.filter(route=>route.from===preferredSource);
        const beforeSource=incoming.length===1 ? incoming[0].from : preferredIncoming.length===1 ? preferredIncoming[0].from : incoming.length===0 && at===0 ? preferredSource : undefined;
        const before=beforeSource ? rootInsertionGap(`sequence-before-${group.id}`,beforeSource,group.id) : null;
        const internal=narrativeReadingPath(props.project,{eventId:props.eventId,dialogueId:group.context.dialogueId},selectedChoices);
        const nextNode=eventPath.nodes[at+1];
        const outgoing=(event?.transitions??[]).filter(route=>route.from===group.id);
        const selectedRoute=outgoing.length===1 ? outgoing[0] : outgoing.find(route=>route.id===selectedChoices[`route:${group.id}`]);
        const afterAllowed=!internal.stopped && nextNode?.kind!=='dialogue' && !['cycle','missing'].includes(eventPath.stopped?.reason ?? '') && (outgoing.length===0 ? at===eventPath.nodes.length-1 && !eventPath.stopped : Boolean(selectedRoute));
        const after=afterAllowed ? rootInsertionGap(`sequence-after-${group.id}`,group.id,selectedRoute?.to) : null;
        const following=[];
        for(let i=at+1;i<eventPath.nodes.length && eventPath.nodes[i].kind!=='dialogue';i++) {
          const node=eventPath.nodes[i];
          if(node.kind==='decision') {
            const previous=eventPath.nodes[i-1];
            if(previous?.beat)following.push(transitionControl(previous.id));
            following.push(decisionCard(node.id));
          }
          else if(node.beat)following.push(<ConversationEditor key={node.id} {...props} dialogueId={undefined} visibleRowIds={[node.id]} hideSummary hideComposer={i!==eventPath.nodes.length-1} onCreateDecision={(id,before)=>{void createDecision(undefined,id,before);}}/>);
        }
        return [...(before ? [before] : []),section,...(after ? [after] : []),...following];
      })}
      {eventPath.stopped?.reason==='subevent' ? <button type="button" className="narrative-subevent-continuation" onClick={()=>props.onOpenSection?.(eventPath.stopped!.id,'overview')}>{es?'Subevento':'Subevent'} · {props.project.events.find(event=>event.id===eventPath.stopped!.id)?.name}</button> : null}
      {notice ? <p role="alert" className="authoring-field-error">{notice}</p> : null}
      {!props.dialogueId && !groups.length ? <div className="narrative-add empty">
        <ConversationLineMenu label={es ? 'Añadir narrativa' : 'Add narrative'} icon={<Plus size={18} aria-hidden="true" />} options={[
          { label: es ? 'Iniciar conversación' : 'Start a conversation', disabled: busy, run: () => { void create('dialogue'); } },
          { label: es ? 'Añadir decisión' : 'Add decision', disabled: busy, run: () => { const tail=eventPath.nodes.at(-1); void createDecision(undefined,tail?.kind==='dialogue' || tail?.beat ? tail.id : undefined); } },
          { label: es ? 'Iniciar diálogo' : 'Start a dialogue', disabled: busy, run: () => { void create('speech'); } },
        ]} />
      </div> : null}
    </div>
    {pendingDelete ? createPortal(<div className="modal-backdrop conversation-delete-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPendingDelete(undefined); }}>
      <section ref={dialogRef} className="modal-dialog" role="dialog" aria-modal="true" aria-label={es ? 'Eliminar conversación' : 'Delete conversation'}>
        <h2>{es ? '¿Eliminar conversación?' : 'Delete conversation?'}</h2>
        <p>{es ? `Se eliminará «${pendingDelete.title}» junto con sus líneas de diálogo y acotaciones.` : `“${pendingDelete.title}” and its dialogue lines and stage directions will be deleted.`}</p>
        <div className="inspector-actions">
          <button type="button" data-overlay-focus onClick={() => setPendingDelete(undefined)}>{es ? 'Cancelar' : 'Cancel'}</button>
          <button type="button" className="danger" onClick={() => { const id = pendingDelete.id; setPendingDelete(undefined); void removeGroup(id); }}>{es ? 'Eliminar conversación' : 'Delete conversation'}</button>
        </div>
      </section>
    </div>, root.current?.closest('.pathbranching-app') ?? document.body) : null}
    {currentIndexSection && indexHost ? createPortal(<nav className="conversation-index" aria-label={es ? 'Índice de narrativa' : 'Narrative index'}>
      <header className="conversation-index-heading"><strong>{es ? 'Índice' : 'Index'}</strong></header>
      <div className="conversation-index-list-frame">
      {indexScrollEdges.up ? <div className={`conversation-index-scroll-cue top${indexHoverDirection === 'up' ? ' is-active' : ''}`} aria-hidden="true"><ChevronUp size={18} strokeWidth={2.5} /></div> : null}
      <div ref={indexScroller} className="conversation-index-sections" onMouseMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left, y = event.clientY - rect.top;
        const isCenter = x >= rect.width * 0.25 && x <= rect.width * 0.75;
        if (isCenter && y <= 54 && indexScrollEdges.up) setIndexHoverDirection('up');
        else if (isCenter && y >= rect.height - 54 && indexScrollEdges.down) setIndexHoverDirection('down');
        else setIndexHoverDirection(undefined);
      }} onMouseLeave={() => setIndexHoverDirection(undefined)}>
        {(() => {
          let position = 0;
          return indexSections.map(section => {
            const headerIndex = position++;
            const activeSection = section.id === currentIndexSection.id;
            const collapsed = expandedIndexSectionId !== section.id;
            return <section className="conversation-index-section" key={section.id}>
              <button type="button" className="conversation-index-section-toggle" aria-expanded={!collapsed} aria-current={activeSection ? 'location' : undefined} title={section.title} onClick={() => {
                setExpandedIndexSectionId(current => current === section.id ? undefined : section.id);
                if (!activeSection) setNear(headerIndex);
                if (targetFor(section.id)) jump(section.id);
                else openSequenceInspector(section.id);
              }}>
                {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                <span className="conversation-index-section-copy"><strong>{section.title}</strong><small>{section.kind}</small></span>
              </button>
              {!collapsed ? <div className="conversation-index-lines">
                {section.entries.map(entry => {
                  const index = position++;
                  return <button type="button" key={entry.id} className={`narrative-index-entry ${entry.kind}`} aria-current={index === near ? 'location' : undefined} aria-label={entry.title} title={entry.title} onClick={() => {
                    if (targetFor(entry.id)) jump(entry.id);
                    else openSequenceInspector(section.id);
                  }}>
                    {entry.speaker ? <><strong className="narrative-index-speaker">{entry.speaker}:</strong><span className="narrative-index-name">{entry.excerpt}</span></> : <span className="narrative-index-name">{entry.excerpt}</span>}
                  </button>;
                })}
              </div> : (position += section.entries.length, null)}
            </section>;
          });
        })()}
      </div>
      {indexScrollEdges.down ? <div className={`conversation-index-scroll-cue bottom${indexHoverDirection === 'down' ? ' is-active' : ''}`} aria-hidden="true"><ChevronDown size={18} strokeWidth={2.5} /></div> : null}
      </div>
    </nav>, indexHost) : null}
  </div>;
}
