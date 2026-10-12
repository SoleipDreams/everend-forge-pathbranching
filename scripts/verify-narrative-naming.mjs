import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeProject, parseProject, serializeProject } from '../lib/projectSerialization.js';
import { createEvent, createNestedEvent, createDecision, createDialogue, createOutcome } from '../lib/projectMutations.js';
import { automaticNameForNode, narrativeDestinationLabels, setNarrativeNamingLocale } from '../lib/narrativeNaming.js';
import { renameNarrativeNode } from '../lib/narrativeNameEditing.js';
import { insertReadingDecision, finishReadingConversation } from '../lib/narrativeReadingPath.js';
import { insertConversationLine } from '../lib/conversationModel.js';

const fixture = () => normalizeProject({ specVersion:'0.1', projectId:'naming-qa', name:'Naming QA', storyId:'naming-qa', entrySequenceId:'main', sequences:[{id:'main',name:'Main',entryEventId:'scene',eventIds:['scene']}], events:[{id:'scene',name:'Old · Long · Event',type:'normal'}], branches:[],canonRefs:[],variables:{},scripts:[],externalFunctions:[] });
test('localized creation finds gaps and numbers within each owner, never translating existing names', () => {
  for (const locale of ['es','en']) {
    setNarrativeNamingLocale(locale);
    let p=fixture();
    p=createEvent(p).project; p=createEvent(p,'final').project;p=createEvent(p,'exploration').project;
    assert.deepEqual(p.events.slice(1).map(item=>item.name),locale==='es'?['Evento 1','Evento final 1','Evento de exploración 1']:['Event 1','Final event 1','Exploration event 1']);
    p=createNestedEvent(p,'scene').project;p=createNestedEvent(p,'scene','final').project;
    assert.deepEqual(p.events.slice(-2).map(item=>item.name),locale==='es'?['Subevento 1','Subevento 2']:['Subevent 1','Subevent 2']);
    p=createDialogue(p,'scene').project; const group=p.events[0].dialogues[0];
    p=createDecision(p,'scene').project;p=createDecision(p,'scene',group.id).project;
    const [a,b]=p.events[0].decisions;
    assert.equal(a.name,locale==='es'?'Decisión 1':'Decision 1');assert.equal(b.name,locale==='es'?'Decisión 2':'Decision 2');
    p=createOutcome(p,'scene',a.id).project;p=createOutcome(p,'scene',b.id).project;
    assert.equal(p.events[0].decisions[0].outcomes[0].name,locale==='es'?'Opción 1':'Option 1');
    assert.equal(p.events[0].decisions[1].outcomes[0].name,p.events[0].decisions[0].outcomes[0].name);
    p={...p,events:p.events.map(item=>item.id==='scene'?{...item,decisions:item.decisions.filter(item=>item.id!==a.id)}:item)};
    p=createDecision(p,'scene').project;
    assert.equal(p.events[0].decisions.at(-1).name,a.name);
    const snapshot=serializeProject(p);setNarrativeNamingLocale(locale==='es'?'en':'es');
    assert.equal(serializeProject(p),snapshot);
  }
});
test('rename and reset preserve IDs, graph, text and reopen, including IDs containing colons', () => {
  setNarrativeNamingLocale('es');
  let p=fixture(); const group=createDialogue(p,'scene');p=group.project;
  const dialogueId=p.events[0].dialogues[0].id;
  const line=insertConversationLine(p,{eventId:'scene',dialogueId},'speech',{text:'Texto que debe conservarse'});p=line.project;
  p=finishReadingConversation(p,'scene',dialogueId,{kind:'decision'}).project;
  const decision=p.events[0].decisions[0];p=createOutcome(p,'scene',decision.id).project;
  const option=p.events[0].decisions[0].outcomes[0];
  const sources=['scene',group.selection.id,`decision:scene:${decision.id}`,`outcome:scene:${decision.id}:${option.id}`];
  const transitions=p.events.flatMap(item=>item.transitions??[]),scripts=p.scriptDocuments;
  for(const id of sources) {
    const proposal=automaticNameForNode(p,id,'es');assert.ok(proposal);
    const previous=serializeProject(p);assert.throws(()=>renameNarrativeNode(p,id,'   '));assert.equal(serializeProject(p),previous);
    p=renameNarrativeNode(p,id,'  Nombre elegido  ');
    assert.ok(serializeProject(p).includes('Nombre elegido'));
    p=renameNarrativeNode(p,id,proposal);
  }
  assert.deepEqual(p.events.flatMap(item=>item.transitions??[]),transitions);assert.deepEqual(p.scriptDocuments,scripts);
  const reopened=parseProject(serializeProject(p));
  assert.deepEqual(JSON.parse(JSON.stringify(reopened.events)),JSON.parse(JSON.stringify(normalizeProject(p).events)));
  assert.ok(serializeProject(reopened).includes('Texto que debe conservarse'));
  assert.equal(automaticNameForNode(p,`decision:scene:${decision.id}`,'es'),decision.name);
});
test('all narrative creation paths share short defaults and repeated selector names receive owner context', () => {
  setNarrativeNamingLocale('es');let p=fixture();
  p=insertReadingDecision(p,{eventId:'scene'}).project;
  assert.equal(p.events[0].decisions[0].name,'Decisión 1');
  const a=createDialogue(p,'scene','Tema');p=a.project;const b=createDialogue(p,'scene','Tema');p=b.project;
  const labels=narrativeDestinationLabels(p,[{id:a.selection.id,label:'Tema'},{id:b.selection.id,label:'Tema'},{id:'scene',label:'Un nombre único'}],'es');
  assert.notEqual(labels.get(a.selection.id),labels.get(b.selection.id));assert.equal(labels.get('scene'),'Un nombre único');
});
