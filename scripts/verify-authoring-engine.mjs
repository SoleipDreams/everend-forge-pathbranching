import assert from 'node:assert/strict';
import { test } from 'node:test';
const base = process.env.AUTHORING_TEST_LIB ?? '../lib';
const { createAuthoringSession, authoringCommand, applyInstanceEffect, authoringRevision } = await import(`${base}/authoringEngine.js`);
const { initialAuthoringState, entityCapabilities, instanceOwnerIssue, normalizeAuthoringEntities, entityUsages } = await import(`${base}/authoringEntities.js`);
const { evaluateConditionDetailed } = await import(`${base}/conditionEvaluation.js`);
const { applyConsequenceDetailed } = await import(`${base}/logic.js`);
const { normalizeProject, parseProject, serializeProject } = await import(`${base}/projectSerialization.js`);
const { resolveLogicField } = await import(`${base}/logicCapabilities.js`);
const { validateProject } = await import(`${base}/validate.js`);
const { serializeModularStoryFiles, storyPath, loadPathBranchingWorkspace } = await import(`${base}/pathBranchingWorkspace.js`);

function fixture() {
  return {
    specVersion:'0.1',projectId:'authoring-acceptance',name:'The two keys',canonRefs:[],scripts:[],externalFunctions:[],variables:{},branches:[],
    entrySequenceId:'seq',sequences:[{id:'seq',name:'Sequence',entryEventId:'room',eventIds:['room','hall']}],
    localExplorerEntities:[{id:'key',name:'Key',type:'item',properties:{wear:0,usable:true},status:'draft',createdAt:'',updatedAt:''},{id:'chest',name:'Chest',type:'container',properties:{},status:'draft',createdAt:'',updatedAt:''},{id:'actor',name:'Actor',type:'person',properties:{strength:0},status:'draft',createdAt:'',updatedAt:''},{id:'npc',name:'Recipient',type:'person',properties:{strength:0},status:'draft',createdAt:'',updatedAt:''}],
    localExplorerProperties:[{id:'wear',label:'Wear',valueType:'number',createdAt:'',updatedAt:''},{id:'usable',label:'Usable',valueType:'boolean',createdAt:'',updatedAt:''},{id:'strength',label:'Strength',valueType:'number',createdAt:'',updatedAt:''}],
    logicPropertyOverrides:[{source:'local',propertyId:'wear',conditionReadable:true,actionWritable:true},{source:'local',propertyId:'usable',conditionReadable:true,actionWritable:true},{source:'local',propertyId:'strength',conditionReadable:true,actionWritable:true}],
    logicTypeOverrides:[{source:'local',typeId:'item',grantable:true,inventoryItem:true,runtimeRoles:['owned']},{source:'local',typeId:'container',container:true},{source:'local',typeId:'person',container:true,runtimeRoles:['present']}],
    logicVariables:[{id:'strength',name:'Strength',type:'number',value:0,groupId:'ungrouped'},{id:'visits',name:'Visits',type:'number',value:0,groupId:'ungrouped'},{id:'flag',name:'Flag',type:'boolean',value:false,groupId:'ungrouped'}],
    playerProfiles:[{id:'default',name:'Player',playableCharacterRef:'actor',simulation:{}}],
    entityInstances:[{id:'key-a',entityId:'key',name:'Worn key',properties:{wear:8,usable:false},owner:{kind:'entity',entityId:'chest'}},{id:'key-b',entityId:'key',name:'Good key',properties:{wear:1,usable:true},owner:{kind:'entity',entityId:'chest'}}],
    scriptDocuments:[{id:'script',name:'Scene',format:'forge-script',blocks:[{id:'intro',kind:'speech',content:'The chest has two keys.',characterRef:'npc'},{id:'reward',kind:'speech',content:'A new key.'},{id:'shared',kind:'direction',content:'The paths meet.'},{id:'chat',kind:'speech',content:'Hello, traveller.',characterRef:'npc'}]}],
    events:[{id:'room',name:'Room',type:'normal',dialogues:[{id:'scene',title:'Chest scene',entryBeatId:'intro',text:{format:'plain',content:''},beats:[{id:'intro',kind:'speech',blockRef:{scriptId:'script',blockId:'intro'}},{id:'reward',kind:'speech',blockRef:{scriptId:'script',blockId:'reward'},logic:{narrativeEffects:[{type:'instanceEffect',operation:'create',entityId:'key',properties:{wear:0,usable:true},owner:{kind:'profile',profileId:'default'}}]}},{id:'shared',kind:'direction',blockRef:{scriptId:'script',blockId:'shared'}}],members:[{kind:'beat',id:'intro'},{kind:'decision',id:'choose'},{kind:'beat',id:'reward'},{kind:'beat',id:'shared'}]},{id:'talk',title:'Talk',entryBeatId:'chat',text:{format:'plain',content:''},beats:[{id:'chat',kind:'speech',blockRef:{scriptId:'script',blockId:'chat'}}]}],decisions:[{id:'choose',name:'Open the door?',type:'dialogue',dialogueId:'scene',outcomes:[{id:'open',name:'Open',conditions:{all:[{any:[ownedKey(),strength(5)]},{not:{type:'visited',subject:{kind:'progress',targetType:'event',targetId:'hall'},operator:'has'}}]}},{id:'wait',name:'Wait'}]}],transitions:[{id:'entry',from:'boundary:room:input:entry',to:'dialogue:room:scene'},{id:'intro-choice',from:'beat:room:intro',to:'decision:room:choose'},{id:'open-reward',from:'outcome:room:choose:open',to:'beat:room:reward'},{id:'wait-shared',from:'outcome:room:choose:wait',to:'beat:room:shared'},{id:'reward-shared',from:'beat:room:reward',to:'beat:room:shared'},{id:'shared-choice',from:'beat:room:shared',to:'decision:room:choose'},{id:'talk-exit',from:'beat:room:chat',to:'dialogue-boundary:room:talk:output'}]},{id:'hall',name:'Hall',type:'final',text:{format:'plain',content:'The end.'}}],
  };
}
function strength(value) { return {type:'value',subject:{kind:'variable',variableId:'strength'},operator:'>=',value}; }
function ownedKey() { return {type:'instanceQuery',entityId:'key',owner:{kind:'profile',profileId:'default'},quantifier:'some',filters:{all:[{type:'property',subject:{kind:'context',role:'self'},propertyId:'usable',operator:'==',value:true},{type:'property',subject:{kind:'context',role:'self'},propertyId:'wear',operator:'<',value:5}]}}; }
/** Synthetic public fixture for Playwright/Tauri authoring acceptance. */
export function authoringAcceptanceFixture() {
  const p=fixture();
  const copyForActor={...ownedKey(),owner:{kind:'context',role:'actor'}};
  p.events[0].decisions[0].outcomes[0].conditions.all[0].any[0]=copyForActor;
  p.events[0].dialogues[0].beats.find(b=>b.id==='shared').logic={repeat:'each-entry',then:[{type:'value',subject:{kind:'variable',variableId:'visits'},operation:'add',value:1}]};
  p.entityInstances.push({id:'travel-box',entityId:'chest',name:'Travel box',owner:{kind:'entity',entityId:'actor'}},{id:'inner-box',entityId:'chest',name:'Inner box',owner:{kind:'instance',instanceId:'travel-box'}});
  p.narrativeActions=[
    {id:'take',name:'Obtener',typeId:'item',source:'local',repeat:'each-entry',effects:[{type:'instanceEffect',operation:'move',instanceId:'@self',owner:{kind:'context',role:'actor'}}]},
    {id:'give',name:'Entregar',typeId:'item',source:'local',requiresTarget:true,repeat:'each-entry',effects:[{type:'instanceEffect',operation:'move',instanceId:'@self',owner:{kind:'context',role:'target'}}]},
    {id:'talk',name:'Hablar',entityId:'npc',targetNodeId:'dialogue:room:talk',navigation:'call',repeat:'each-entry'},
    {id:'make-key',name:'Crear copia',entityId:'chest',effects:[{type:'instanceEffect',operation:'create',entityId:'key',name:'Generated key',properties:{wear:0,usable:true},owner:{kind:'context',role:'actor'}}]},
    {id:'leave',name:'Salir',targetNodeId:'hall',navigation:'jump'},
  ];
  p.narrativeRules=[
    {id:'key-acquired',name:'Llave utilizable obtenida',trigger:'stateChanged',scope:{kind:'dialogue',id:'scene'},when:copyForActor,repeat:'each-entry',effects:[{type:'value',subject:{kind:'variable',variableId:'visits'},operation:'add',value:1}],priority:0},
    {id:'ready-global',name:'Avance global',trigger:'stateChanged',scope:{kind:'global'},when:strength(7),targetNodeId:'hall',priority:1},
    {id:'shared-return',name:'Contar al continuar',trigger:'continue',scope:{kind:'node',id:'beat:room:shared'},repeat:'each-entry',effects:[{type:'value',subject:{kind:'variable',variableId:'visits'},operation:'add',value:1}]},
  ];
  p.authoringScenarios=[{id:'initial',name:'Dos llaves en el cofre',actor:{kind:'entity',entityId:'actor'},profileId:'default',state:{entityInstances:structuredClone(p.entityInstances),variables:{strength:0,visits:0,flag:false}}},{id:'strong',name:'Fuerza cinco',actor:{kind:'entity',entityId:'actor'},profileId:'default',state:{entityInstances:structuredClone(p.entityInstances),variables:{strength:5,visits:0,flag:false}}}];
  return normalizeProject(p);
}
function doCommand(p,s,type,extra={}) { return authoringCommand(p,s,{type,...extra}); }
test('copies are independent; same-copy filters and typed some/all/count work',()=>{
  const p=fixture(),state=initialAuthoringState(p);
  assert.equal(evaluateConditionDetailed({...ownedKey(),owner:{kind:'entity',entityId:'chest'}},p,state).status,'satisfied');
  const impossible={type:'instanceQuery',entityId:'key',owner:{kind:'entity',entityId:'chest'},quantifier:'some',filters:{all:[{type:'property',subject:{kind:'context',role:'self'},propertyId:'usable',operator:'==',value:true},{type:'property',subject:{kind:'context',role:'self'},propertyId:'wear',operator:'>',value:5}]}};
  assert.equal(evaluateConditionDetailed(impossible,p,state).status,'unsatisfied');
  assert.equal(evaluateConditionDetailed({...impossible,quantifier:'all'},p,state).status,'unsatisfied');
  assert.equal(evaluateConditionDetailed({...impossible,filters:undefined,quantifier:'count',operator:'==',value:2},p,state).status,'satisfied');
  assert.equal(evaluateConditionDetailed({...impossible,filters:undefined,owner:{kind:'entity',entityId:'npc'},quantifier:'all'},p,state).status,'unsatisfied');
  const moved=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'move',instanceId:'key-b',owner:{kind:'entity',entityId:'npc'}});
  assert.equal(moved.error,undefined);assert.equal(moved.state.entityInstances.find(i=>i.id==='key-a').owner.entityId,'chest');
  assert.equal(state.entityInstances.find(i=>i.id==='key-b').owner.entityId,'chest');
  assert.equal(moved.state.entityInstances.find(i=>i.id==='key-b').properties.wear,1);
});
test('copy effect selection, missing references, types and containment are atomic',()=>{
  const p=fixture(),state=initialAuthoringState(p);
  assert.match(applyInstanceEffect(p,state,{type:'instanceEffect',operation:'remove',entityId:'key'}).error,/explicitly/);
  assert.match(applyInstanceEffect(p,state,{type:'instanceEffect',operation:'modify',instanceId:'key-b',properties:{wear:'one'}}).error,/incompatible/);
  assert.match(applyInstanceEffect(p,state,{type:'instanceEffect',operation:'create',entityId:'missing'}).error,/existing/);
  const added=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'create',entityId:'chest',instanceId:'box',owner:{kind:'entity',entityId:'actor'}});
  assert.equal(added.error,undefined);
  const child=applyInstanceEffect(p,added.state,{type:'instanceEffect',operation:'create',entityId:'chest',instanceId:'inner',owner:{kind:'instance',instanceId:'box'}});
  assert.equal(child.error,undefined);
  const cycle=applyInstanceEffect(p,child.state,{type:'instanceEffect',operation:'move',instanceId:'box',owner:{kind:'instance',instanceId:'inner'}});
  assert.match(cycle.error,/cycle/);assert.deepEqual(cycle.state,child.state);
  assert.match(applyInstanceEffect(p,child.state,{type:'instanceEffect',operation:'remove',instanceId:'box'}).error,/contained/);
  assert.equal(applyInstanceEffect(p,child.state,{type:'instanceEffect',operation:'remove',instanceIds:['box','inner'],selection:'selected'}).error,undefined);
});
test('entity overrides can explicitly disable inherited capabilities without inventory gating',()=>{
  const p=fixture();p.entityOverrides=[{entityId:'actor',container:false,properties:{strength:{actionWritable:false,conditionReadable:true}},runtimeRoles:{present:false}}];
  assert.equal(entityCapabilities(p,'actor').container,false);
  assert.equal(entityCapabilities(p,'npc').container,true);
  assert.equal(resolveLogicField(p,{kind:'entity',entityId:'actor'},'effect','property','strength').status,'disabled');
  assert.equal(resolveLogicField(p,{kind:'entity',entityId:'npc'},'effect','property','strength').status,'enabled');
  assert.equal(resolveLogicField(p,{kind:'entity',entityId:'actor'},'condition','state','present').status,'disabled');
});
test('inventory item capability is inherited from an ownable type and can be overridden per entity',()=>{
  const p=fixture();
  assert.equal(entityCapabilities(p,'key').inventoryItem,true);
  assert.equal(entityCapabilities(p,'chest').inventoryItem,false);
  assert.equal(entityCapabilities({...p,entityOverrides:[{entityId:'key',inventoryItem:false}]},'key').inventoryItem,false);
  assert.equal(entityCapabilities({...p,entityOverrides:[{entityId:'chest',grantable:true,inventoryItem:true}]},'chest').inventoryItem,true);
  const legacy={...p,logicTypeOverrides:p.logicTypeOverrides.map(({inventoryItem,...override})=>override)};
  assert.equal(entityCapabilities(legacy,'key').inventoryItem,true,'Legacy owned `item` types keep their established inventory behavior.');
  assert.equal(entityCapabilities(normalizeProject(JSON.parse(serializeProject(p))),'key').inventoryItem,true,'The type capability survives story round-trips.');
});
test('inventory copy queries count only inventoryable copies, including the any-item query',()=>{
  const p=fixture(), query={type:'instanceQuery',owner:{kind:'profile',profileId:'default'},quantifier:'count',operator:'==',value:1};
  const state={entityInstances:[{id:'key-copy',entityId:'key',owner:{kind:'profile',profileId:'default'}},{id:'chest-copy',entityId:'chest',owner:{kind:'profile',profileId:'default'}}]};
  const any=evaluateConditionDetailed(query,p,state);
  assert.equal(any.status,'satisfied');assert.equal(any.actual,1);
  const explicit=evaluateConditionDetailed({...query,entityId:'chest'},p,state);
  assert.equal(explicit.status,'satisfied');assert.equal(explicit.actual,1,'Saved explicit copy queries retain their behavior.');
});
test('character variants own separate copy inventories and actor context retains its variant',()=>{
  const p=fixture();
  p.canonRefs=[{id:'hero',kind:'character',label:'Hero',frontmatter:{variants:{winter:{label:'Winter'}}}}];
  p.authoringScenarios=[{id:'winter-run',name:'Winter run',actor:{kind:'entity',entityId:'hero',variantId:'winter'},profileId:'default',state:{entityInstances:[
    {id:'winter-key-a',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'winter'}},
    {id:'winter-key-b',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'winter'}},
    {id:'base-key',entityId:'key',owner:{kind:'entity',entityId:'hero'}},
  ]}}];
  const scenario=p.authoringScenarios[0], state=initialAuthoringState(p,scenario);
  const count={type:'instanceQuery',entityId:'key',owner:{kind:'context',role:'actor'},quantifier:'count',operator:'==',value:2};
  const result=evaluateConditionDetailed(count,p,state);
  assert.equal(result.status,'satisfied');assert.equal(result.actual,2,'A count condition only sees copies owned by the actor variant.');
  assert.equal(evaluateConditionDetailed({...count,owner:{kind:'entity',entityId:'hero'},value:1},p,state).status,'satisfied','Base inventory remains independent from the winter variant.');
  const created=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'create',entityId:'key',instanceId:'new-winter-key',owner:{kind:'context',role:'actor'}});
  assert.equal(created.error,undefined);
  assert.deepEqual(created.state.entityInstances.find(copy=>copy.id==='new-winter-key').owner,{kind:'entity',entityId:'hero',variantId:'winter'});
  const moved=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'move',instanceId:'base-key',owner:{kind:'context',role:'actor'}});
  assert.deepEqual(moved.state.entityInstances.find(copy=>copy.id==='base-key').owner,{kind:'entity',entityId:'hero',variantId:'winter'});
  assert.match(instanceOwnerIssue(p,[{id:'invalid',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'summer'}}],{id:'invalid',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'summer'}}),/Missing variant summer/);
  const reopened=parseProject(serializeProject(p));
  assert.deepEqual(reopened.authoringScenarios[0].actor,scenario.actor);
  assert.deepEqual(reopened.authoringScenarios[0].state.entityInstances,scenario.state.entityInstances);
});
test('sequence inventories stay isolated unless a sequence explicitly inherits them',()=>{
  const p=fixture();
  p.canonRefs=[{id:'hero',kind:'character',label:'Hero',frontmatter:{variants:{winter:{label:'Winter'}}}}];
  p.sequences[0].initialInventory=[
    {id:'winter-key-a',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'winter'}},
    {id:'winter-key-b',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'winter'}},
  ];
  p.sequences.push({id:'isolated',name:'Isolated',entryEventId:'hall',eventIds:['hall'],initialInventory:[]});
  const count={type:'instanceQuery',entityId:'key',owner:{kind:'entity',entityId:'hero',variantId:'winter'},quantifier:'count',operator:'==',value:2};
  const scenario={id:'isolated-run',name:'Isolated run',startNodeId:'start:isolated',actor:{kind:'entity',entityId:'hero',variantId:'winter'},state:{}};
  const session=createAuthoringSession(p,scenario);
  assert.deepEqual(session.state.context.actor,scenario.actor,'The actor keeps its selected variant at the new sequence entry.');
  const firstState=initialAuthoringState(p,undefined,'seq');
  assert.equal(evaluateConditionDetailed(count,p,firstState).actual,2,'Individual copies count in their owning sequence.');
  assert.equal(evaluateConditionDetailed(count,p,session.state).actual,0,'Another sequence starts without implicitly copying those items.');
  assert.equal(evaluateConditionDetailed(count,p,session.state).status,'unsatisfied');
  const shared={...p,sequences:p.sequences.map(sequence=>sequence.id==='isolated'?{...sequence,inheritInventoryFromSequenceId:'seq'}:sequence)};
  assert.equal(evaluateConditionDetailed(count,shared,initialAuthoringState(shared,undefined,'isolated')).actual,2,'Explicit inheritance shares the source sequence inventory.');

  const legacy=normalizeProject({...fixture(),sequences:[...fixture().sequences,{id:'later',name:'Later',entryEventId:'hall',eventIds:['hall']} ]});
  const chestCount={type:'instanceQuery',entityId:'key',owner:{kind:'entity',entityId:'chest'},quantifier:'count',operator:'=='};
  assert.equal(evaluateConditionDetailed({...chestCount,value:2},legacy,initialAuthoringState(legacy,undefined,'seq')).actual,2,'Older shared inventory stays at the legacy entry sequence.');
  assert.equal(evaluateConditionDetailed({...chestCount,value:0},legacy,initialAuthoringState(legacy,undefined,'later')).actual,0,'Legacy inventory is not extrapolated to another sequence.');
});
test('strict consequences reject coercion and actually update data objects',()=>{
  const p=fixture(),state=initialAuthoringState(p);
  const invalid=applyConsequenceDetailed(p,state,{type:'value',subject:{kind:'variable',variableId:'strength'},operation:'set',value:'five'});
  assert.equal(invalid.status,'invalid');assert.deepEqual(invalid.state,state);
  p.dataClasses=[{id:'Stats',label:'Stats',fields:[{name:'score',type:'number'}]}];p.projectDataObjects=[{id:'stats',classId:'Stats',name:'Stats',fields:{score:4}}];
  const result=applyConsequenceDetailed(p,state,{type:'property',subject:{kind:'dataObject',objectId:'stats'},propertyId:'score',operation:'add',value:2});
  assert.equal(result.status,'applied');assert.equal(result.state.dataObjects[0].fields.score,6);assert.equal(p.projectDataObjects[0].fields.score,4);
  assert.equal(applyConsequenceDetailed(p,state,{type:'property',subject:{kind:'entity',entityId:'actor'},propertyId:'strength',operation:'set',value:5}).state.entityStates.actor.properties.strength,5);
});
test('legacy inventory migration is stable, name-keyed player values resolve to IDs',()=>{
  const p=fixture();p.playerProfiles[0].simulation={inventory:['key'],variables:{Strength:7},grantableProperties:{key:{wear:2}}};
  const migrated=normalizeAuthoringEntities(p);assert.deepEqual(normalizeAuthoringEntities(migrated),migrated);
  const state=initialAuthoringState(migrated);assert.equal(state.variables.strength,7);
  assert.equal(state.entityInstances.filter(i=>i.id.startsWith('instance:legacy:')).length,1);
  assert.equal(evaluateConditionDetailed(strength(5),p,state).status,'satisfied');
});
test('story branching, shared paths and once-per-run entry effects survive returns',()=>{
  const p=fixture();let s=createAuthoringSession(p);assert.equal(s.nodeId,'beat:room:intro');
  s=doCommand(p,s,'setState',{state:{variables:{...s.state.variables,strength:5}}});
  s=doCommand(p,s,'continue');assert.equal(s.nodeId,'decision:room:choose');assert.equal(s.view.choices.find(c=>c.id==='open').status,'satisfied');
  s=doCommand(p,s,'choose',{outcomeId:'open'});assert.equal(s.nodeId,'beat:room:reward');assert.equal(s.state.entityInstances.length,3);
  s=doCommand(p,s,'continue');assert.equal(s.nodeId,'beat:room:shared');
  s=doCommand(p,s,'continue');s=doCommand(p,s,'choose',{outcomeId:'open'});assert.equal(s.state.entityInstances.length,3);
  const p2=fixture();p2.events[0].dialogues[0].beats.find(b=>b.id==='reward').logic.repeat='each-entry';
  let r=createAuthoringSession(p2);r=doCommand(p2,r,'setState',{state:{variables:{...r.state.variables,strength:5}}});r=doCommand(p2,r,'continue');r=doCommand(p2,r,'choose',{outcomeId:'open'});r=doCommand(p2,r,'continue');r=doCommand(p2,r,'continue');r=doCommand(p2,r,'choose',{outcomeId:'open'});assert.equal(r.state.entityInstances.length,4);
});
test('an unavailable dialogue is skipped through its ordered outgoing route and Play traces the choice',()=>{
  const p=fixture(),dialogue=p.events[0].dialogues.find(item=>item.id==='scene');
  dialogue.availability=strength(5);
  p.events[0].transitions.push({id:'scene-exit',from:'dialogue:room:scene',to:'hall',mode:'fallback'});
  const skipped=createAuthoringSession(p);
  assert.equal(skipped.nodeId,'hall');
  assert.equal(skipped.status,'ready');
  assert.equal(skipped.trace.some(item=>item.kind==='enter'&&item.nodeId==='beat:room:intro'),false,'Unavailable dialogue content must not be entered.');
  assert.ok(skipped.trace.some(item=>item.kind==='condition'&&item.nodeId==='dialogue:room:scene'&&item.message.includes('Content skipped')));
  assert.ok(skipped.trace.some(item=>item.kind==='route'&&item.id==='scene-exit'));

  const shown=createAuthoringSession(p,{id:'strong',name:'Strong',state:{variables:{strength:5}}});
  assert.equal(shown.nodeId,'beat:room:intro','A satisfied dialogue condition keeps its authored entry.');
});
test('an unavailable dialogue without an outgoing route stops with an actionable Play diagnostic',()=>{
  const p=fixture();
  p.events[0].dialogues.find(item=>item.id==='scene').availability=strength(5);
  const session=createAuthoringSession(p);
  assert.equal(session.status,'blocked');
  assert.match(session.message,/Dialogue condition failed and no outgoing route/);
});
test('Play traces worldbuilding properties and local visit variables on dialogue availability',()=>{
  const p=fixture(),dialogue=p.events[0].dialogues.find(item=>item.id==='scene');
  p.canonRefs.push({id:'canon:aahir',label:'Aahir',properties:{origin:'Aahir'}});
  dialogue.availability={all:[
    {type:'canonProperty',ref:'canon:aahir',property:'origin',operator:'==',value:'Aahir'},
    {type:'variable',name:'visits',operator:'>=',value:2},
  ]};
  p.events[0].transitions.push({id:'scene-exit',from:'dialogue:room:scene',to:'hall',mode:'fallback'});

  const returned=createAuthoringSession(p,{id:'returned-to-aahir',name:'Returned to Aahir',state:{variables:{visits:2}}});
  assert.equal(returned.nodeId,'beat:room:intro','Matching worldbuilding data and a satisfied local visit count enter the dialogue.');

  for(const [id,values,reason] of [
    ['unknown-world', {variables:{visits:2},entityStates:{'canon:aahir':{properties:{origin:'Elsewhere'}}}}, 'Aahir worldbuilding property'],
    ['first-visit', {variables:{visits:1}}, 'local visit variable'],
  ]){
    const session=createAuthoringSession(p,{id,name:id,state:values});
    assert.equal(session.nodeId,'hall',`${reason} routes around the unavailable dialogue.`);
    assert.equal(session.trace.some(item=>item.kind==='enter'&&item.nodeId==='beat:room:intro'),false,`${reason} does not enter dialogue content.`);
    assert.ok(session.trace.some(item=>item.kind==='condition'&&item.nodeId==='dialogue:room:scene'&&item.message.includes('Content skipped')));
    assert.ok(session.trace.some(item=>item.kind==='route'&&item.id==='scene-exit'));
  }
});
test('blocked responses stay visible by default and can be hidden per response',()=>{
  const p=fixture();let s=createAuthoringSession(p);s=doCommand(p,s,'continue');const open=s.view.choices.find(c=>c.id==='open');assert.equal(open.status,'unsatisfied');assert.equal(open.hidden,false);
  assert.equal(doCommand(p,s,'choose',{outcomeId:'open'}).status,'blocked');
  p.events[0].decisions[0].outcomes[0].unavailableBehavior='hidden';s=createAuthoringSession(p);s=doCommand(p,s,'continue');assert.equal(s.view.choices.find(c=>c.id==='open').hidden,true);
});

test('masked responses reveal their real text only after conditions pass and mask again on return',()=>{
  const p=fixture(),outcome=p.events[0].decisions[0].outcomes[0];
  outcome.visibleText='Return to the village';outcome.unavailableText={format:'plain',content:'????'};
  let s=doCommand(p,createAuthoringSession(p),'continue');
  let choice=s.view.choices.find(c=>c.id==='open');
  assert.equal(choice.text,'????');assert.equal(choice.masked,true);assert.equal(choice.hidden,false);assert.equal(choice.reason,undefined);
  const denied=doCommand(p,s,'choose',{outcomeId:'open'});assert.equal(denied.status,'blocked');assert.deepEqual(denied.state,s.state);
  s=doCommand(p,s,'setState',{state:{variables:{...s.state.variables,strength:5}}});
  choice=s.view.choices.find(c=>c.id==='open');assert.equal(choice.text,'Return to the village');assert.equal(choice.masked,false);assert.equal(choice.status,'satisfied');
  s=doCommand(p,s,'setState',{state:{variables:{...s.state.variables,strength:0}}});
  choice=s.view.choices.find(c=>c.id==='open');assert.equal(choice.text,'????');assert.equal(choice.masked,true);
  s=doCommand(p,s,'back');assert.equal(s.view.choices.find(c=>c.id==='open').text,'Return to the village');
  assert.equal(outcome.visibleText,'Return to the village','Preview must never overwrite the authored response.');
});

test('mask keeps authored explanations separate and never treats unresolved or invalid conditions as available',()=>{
  for(const status of ['unsatisfied','unresolved','invalid']){
    const p=fixture(),outcome=p.events[0].decisions[0].outcomes[0];
    outcome.unavailableText={format:'plain',content:'????'};outcome.lockText={format:'plain',content:'Discover more before choosing.'};
    if(status==='unresolved'){p.externalFunctions=[{name:'ready',kind:'condition'}];outcome.conditions={type:'external',subject:{kind:'external',functionId:'ready'},operator:'has'};}
    if(status==='invalid')outcome.conditions={type:'value',subject:{kind:'variable',variableId:'missing'},operator:'==',value:1};
    const s=doCommand(p,createAuthoringSession(p),'continue'),choice=s.view.choices.find(c=>c.id==='open');
    assert.equal(choice.status,status);assert.equal(choice.text,'????');assert.equal(choice.masked,true);assert.equal(choice.reason,outcome.lockText.content);
    assert.equal(doCommand(p,s,'choose',{outcomeId:'open'}).status,'blocked');
  }
  const p=fixture(),outcome=p.events[0].decisions[0].outcomes[0];outcome.unavailableText={format:'plain',content:'  '};
  const choice=doCommand(p,createAuthoringSession(p),'continue').view.choices.find(c=>c.id==='open');assert.equal(choice.text,'Open');assert.equal(choice.masked,false);
});

test('edited masked responses survive JSON and modular .evpath save/reopen with stable condition and identity',()=>{
  const p=normalizeProject(fixture()),outcome=p.events[0].decisions[0].outcomes[0];
  outcome.visibleText='Return to the village';outcome.unavailableText={format:'plain',content:'????'};outcome.lockText={format:'plain',content:'Discover more before choosing.'};
  const json=parseProject(serializeProject(p));assert.deepEqual(json.events[0].decisions[0].outcomes[0],outcome);
  const story={id:'masked-responses',name:p.name,path:storyPath('masked-responses')};
  const files=serializeModularStoryFiles(json,story);files.push({relativePath:'.everend/.pathbranching/manifest.json',content:JSON.stringify({version:'0.2',activeStoryId:story.id,stories:[story]})});
  const loaded=loadPathBranchingWorkspace(files);assert.equal(loaded.saveBlocked,false,JSON.stringify(loaded.loadWarnings));
  const reopened=loaded.activeProject;assert.deepEqual(reopened.events[0].decisions[0].outcomes[0],outcome);
  let s=doCommand(reopened,createAuthoringSession(reopened),'continue');assert.equal(s.view.choices.find(c=>c.id==='open').text,'????');
  s=doCommand(reopened,s,'setState',{state:{variables:{...s.state.variables,strength:5}}});assert.equal(s.view.choices.find(c=>c.id==='open').text,outcome.visibleText);
});
test('explicit stateChanged rules use rising edges, context scope and stable priority',()=>{
  const p=fixture();p.narrativeRules=[{id:'first',name:'First',trigger:'stateChanged',scope:{kind:'global'},when:strength(5),targetNodeId:'hall',priority:0},{id:'second',name:'Second',trigger:'stateChanged',scope:{kind:'global'},when:strength(5),targetNodeId:'beat:room:reward',priority:1}];
  let s=createAuthoringSession(p);assert.equal(s.nodeId,'beat:room:intro');s=doCommand(p,s,'setState',{state:{variables:{...s.state.variables,strength:5}}});assert.equal(s.nodeId,'hall');assert.equal(s.trace.filter(t=>t.kind==='rule').length,1);
  const p2=fixture();p2.narrativeRules=[{id:'repeat',name:'Repeat',trigger:'stateChanged',scope:{kind:'dialogue',id:'scene'},when:strength(5),repeat:'each-entry',effects:[{type:'value',subject:{kind:'variable',variableId:'visits'},operation:'add',value:1}]}];
  let r=createAuthoringSession(p2);r=doCommand(p2,r,'setState',{state:{variables:{...r.state.variables,strength:5}}});assert.equal(r.state.variables.visits,1);
  r=doCommand(p2,r,'setState',{state:{variables:{...r.state.variables,strength:6}}});assert.equal(r.state.variables.visits,1);
  r=doCommand(p2,r,'setState',{state:{variables:{...r.state.variables,strength:0}}});r=doCommand(p2,r,'setState',{state:{variables:{...r.state.variables,strength:5}}});assert.equal(r.state.variables.visits,2);
});
test('actions accept a concrete copy, transfer it, call and return without re-entry effects',()=>{
  const p=fixture();p.narrativeActions=[{id:'talk',name:'Talk',entityId:'npc',targetNodeId:'dialogue:room:talk',navigation:'call'},{id:'deliver',name:'Deliver',typeId:'item',requiresTarget:true,effects:[{type:'instanceEffect',operation:'move',instanceId:'@self',owner:{kind:'context',role:'target'}}]},{id:'jump',name:'Leave',targetNodeId:'hall',navigation:'jump'}];
  let s=createAuthoringSession(p);const before=s.state.entityInstances.length;
  s=doCommand(p,s,'action',{actionId:'talk',self:{kind:'entity',entityId:'npc'}});assert.equal(s.nodeId,'beat:room:chat');assert.equal(s.returns.length,1);
  s=doCommand(p,s,'continue');assert.equal(s.nodeId,'beat:room:intro');assert.equal(s.returns.length,0);assert.equal(s.state.entityInstances.length,before);
  s=doCommand(p,s,'action',{actionId:'deliver',self:{kind:'instance',instanceId:'key-b'},target:{kind:'entity',entityId:'npc'}});assert.equal(s.state.entityInstances.find(i=>i.id==='key-b').owner.entityId,'npc');assert.equal(s.state.entityInstances.find(i=>i.id==='key-a').owner.entityId,'chest');
  s=doCommand(p,s,'action',{actionId:'jump'});assert.equal(s.nodeId,'hall');assert.equal(s.returns.length,0);
});
test('unresolved conditions stop routing before Else and are never true under NOT',()=>{
  const p=fixture();p.externalFunctions=[{name:'ready',kind:'condition'}];const external={type:'external',subject:{kind:'external',functionId:'ready'},operator:'has'};
  p.events[0].transitions=p.events[0].transitions.filter(t=>t.from!=='beat:room:intro').concat([{id:'pending',from:'beat:room:intro',to:'hall',conditions:external},{id:'else',from:'beat:room:intro',to:'beat:room:shared',mode:'fallback'}]);
  let s=createAuthoringSession(p);s=doCommand(p,s,'continue');assert.equal(s.status,'blocked');assert.equal(s.nodeId,'beat:room:intro');assert.equal(s.trace.some(t=>t.kind==='route'&&t.id==='else'),false);
  assert.equal(evaluateConditionDetailed({not:external},p,s.state).status,'unresolved');
});
test('automatic cycles stop; user-paced loops remain valid',()=>{
  const p=fixture();p.events[0].dialogues[0].entryBeatId=undefined;p.events[0].dialogues[0].members=[];p.events[0].dialogues[0].beats=[];
  p.events[0].transitions=[{id:'entry',from:'boundary:room:input:entry',to:'dialogue:room:scene'},{id:'cycle',from:'dialogue:room:scene',to:'dialogue:room:scene'}];
  const s=createAuthoringSession(p);assert.equal(s.status,'blocked');assert.match(s.message,/cycle|100/);
});
test('several entries produce a useful diagnostic; nested event boundaries use authored paths',()=>{
  const p=fixture();p.events[0].transitions=p.events[0].transitions.filter(t=>t.from!=='boundary:room:input:entry');
  const s=createAuthoringSession(p);assert.equal(s.status,'blocked');assert.match(s.message,/entry/);
  const p2=fixture();p2.events[0].text={format:'plain',content:'Parent'};p2.events[0].childEventIds=['child'];p2.events.push({id:'child',name:'Child',type:'normal',parentEventId:'room',dialogueBeats:[{id:'child-line',kind:'speech',blockRef:{scriptId:'script',blockId:'intro'}}],transitions:[{id:'child-entry',from:'boundary:child:input:entry',to:'beat:child:child-line'},{id:'child-exit',from:'beat:child:child-line',to:'hall'}]});p2.events[0].transitions=[{id:'to-child',from:'room',to:'child'}];
  let r=createAuthoringSession(p2);assert.equal(r.nodeId,'room');r=doCommand(p2,r,'continue');assert.equal(r.nodeId,'beat:child:child-line');r=doCommand(p2,r,'continue');assert.equal(r.nodeId,'hall');
});
test('back restores simulation; fixed revisions and save/reopen preserve definitions',()=>{
  const p=fixture();let s=createAuthoringSession(p);const initial=structuredClone(s.state);s=doCommand(p,s,'setState',{state:{variables:{...s.state.variables,strength:5}}});s=doCommand(p,s,'back');assert.deepEqual(s.state,initial);
  const changed=structuredClone(p);changed.events[0].name='Changed';assert.equal(doCommand(changed,s,'continue').status,'blocked');
  const layout=structuredClone(p);layout.canvas={activeScope:{kind:'event',id:'room'},positions:{x:{x:1,y:2}}};assert.equal(authoringRevision(p),authoringRevision(layout));
  p.entityOverrides=[{entityId:'chest',container:true}];p.narrativeActions=[{id:'talk',name:'Talk',targetNodeId:'dialogue:room:talk'}];p.narrativeRules=[{id:'rule',name:'Rule',trigger:'continue',scope:{kind:'event',id:'room'},when:strength(5)}];p.authoringScenarios=[{id:'strong',name:'Strong',state:{variables:{strength:7},entityInstances:p.entityInstances}}];
  const reopened=parseProject(serializeProject(normalizeProject(p)));
  for(const key of ['entityOverrides','entityInstances','narrativeActions','narrativeRules','authoringScenarios']) assert.deepEqual(reopened[key],normalizeProject(p)[key]);
  assert.deepEqual(reopened.events[0].dialogues[0].beats.find(b=>b.id==='reward').logic.narrativeEffects,p.events[0].dialogues[0].beats.find(b=>b.id==='reward').logic.narrativeEffects);
});
test('validation catches authoring references and strict effects without rejecting deferred action contexts',()=>{
  const p=fixture();p.narrativeActions=[{id:'give',name:'Give',typeId:'item',requiresTarget:true,effects:[{type:'instanceEffect',operation:'move',instanceId:'@self',owner:{kind:'context',role:'target'}}]}];
  const initial=validateProject(p);assert.equal(initial.some(f=>f.id==='give'&&f.severity==='error'),false,JSON.stringify(initial));
  p.narrativeRules=[{id:'bad',name:'Bad',trigger:'continue',scope:{kind:'event',id:'missing'},effects:[{type:'value',subject:{kind:'variable',variableId:'strength'},operation:'set',value:'five'}],targetNodeId:'not-a-node'}];
  const bad=validateProject(p);assert.ok(bad.some(f=>f.id==='bad'&&f.code==='invalid_consequence'));assert.ok(bad.some(f=>f.id==='bad'&&f.code==='broken_transition'));assert.ok(bad.some(f=>f.id==='bad'&&f.code==='invalid_condition'));
});
test('complete synthetic acceptance lifecycle configures actions, resolves inventory rules, branches and reopens',()=>{
  const p=authoringAcceptanceFixture();let s=createAuthoringSession(p,p.authoringScenarios[0]);assert.equal(s.status,'ready');
  assert.ok(s.view.actions.some(a=>a.id==='take'),'item actions must be visible even when the actor is a person');
  s=doCommand(p,s,'action',{actionId:'take',self:{kind:'instance',instanceId:'key-b'}});assert.equal(s.state.entityInstances.find(i=>i.id==='key-b').owner.entityId,'actor');assert.equal(s.state.variables.visits,1);
  s=doCommand(p,s,'continue');assert.equal(s.view.choices.find(c=>c.id==='open').status,'satisfied');s=doCommand(p,s,'choose',{outcomeId:'open'});assert.equal(s.nodeId,'beat:room:reward');
  const copyCount=s.state.entityInstances.length;s=doCommand(p,s,'continue');s=doCommand(p,s,'continue');s=doCommand(p,s,'choose',{outcomeId:'open'});assert.equal(s.state.entityInstances.length,copyCount);
  s=doCommand(p,s,'action',{actionId:'talk',self:{kind:'entity',entityId:'npc'}});assert.equal(s.nodeId,'beat:room:chat');s=doCommand(p,s,'continue');assert.equal(s.nodeId,'beat:room:reward');
  s=doCommand(p,s,'action',{actionId:'give',self:{kind:'instance',instanceId:'key-b'},target:{kind:'entity',entityId:'npc'}});assert.equal(s.state.entityInstances.find(i=>i.id==='key-b').owner.entityId,'npc');assert.equal(s.state.entityInstances.find(i=>i.id==='key-a').owner.entityId,'chest');
  const reopened=parseProject(serializeProject(p));assert.deepEqual(reopened.entityInstances,p.entityInstances);assert.deepEqual(reopened.narrativeActions,p.narrativeActions);
  const replay=createAuthoringSession(reopened,reopened.authoringScenarios[0]);assert.equal(replay.nodeId,'beat:room:intro');assert.equal(replay.state.variables.visits,0);
  assert.equal(p.entityInstances.find(i=>i.id==='key-b').owner.entityId,'chest','traversal must not mutate authoring scenarios');
  assert.equal(validateProject(p).filter(f=>f.severity==='error'&&['invalid_condition','invalid_consequence','broken_transition'].includes(f.code)).length,0);
});
test('migrated legacy copies remain authoritative after transfer, removal and reopen',()=>{
  const p=fixture();p.playerProfiles[0].simulation={inventory:['key'],entityStates:{key:{states:{owned:true},properties:{wear:2}}}};
  const normalized=normalizeAuthoringEntities(p);let state=initialAuthoringState(normalized);const legacy=state.entityInstances.find(i=>i.id.startsWith('instance:legacy:'));
  const owns={type:'state',subject:{kind:'entity',entityId:'key'},stateId:'owned',operator:'has'};
  assert.equal(evaluateConditionDetailed(owns,p,state).status,'satisfied');
  state=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'move',instanceId:legacy.id,owner:{kind:'entity',entityId:'npc'}}).state;
  assert.equal(evaluateConditionDetailed(owns,p,state).status,'unsatisfied');
  state=applyInstanceEffect(p,state,{type:'instanceEffect',operation:'remove',instanceId:legacy.id}).state;
  normalized.playerProfiles[0].simulation=state;const reopened=normalizeAuthoringEntities(normalized);
  assert.equal(reopened.playerProfiles[0].simulation.entityInstances.some(i=>i.id===legacy.id),false);assert.deepEqual(reopened.playerProfiles[0].simulation.inventory,[]);
  assert.equal(evaluateConditionDetailed(owns,p,reopened.playerProfiles[0].simulation).status,'unsatisfied');
  state=applyConsequenceDetailed(p,state,{type:'state',subject:{kind:'entity',entityId:'key'},stateId:'owned',operation:'grant'}).state;assert.equal(evaluateConditionDetailed(owns,p,state).status,'satisfied');
  state=applyConsequenceDetailed(p,state,{type:'state',subject:{kind:'entity',entityId:'key'},stateId:'owned',operation:'ungrant'}).state;assert.equal(evaluateConditionDetailed(owns,p,state).status,'unsatisfied');
});
test('usage guards find property keys, type references, nested owners and action exceptions',()=>{
  const p=fixture();p.entityOverrides=[{entityId:'actor',properties:{strength:{conditionReadable:true}}}];p.narrativeActions=[{id:'base-action',name:'Use',typeId:'item'},{id:'exception',name:'Use exception',entityId:'key',overridesActionId:'base-action'}];
  assert.ok(entityUsages(p,'strength').some(u=>u.path.includes('entityOverrides')&&u.path.includes('properties.strength')));
  assert.ok(entityUsages(p,'item').some(u=>u.path.includes('localExplorerEntities')));
  assert.ok(entityUsages(p,'base-action').some(u=>u.path.includes('overridesActionId')));
  assert.ok(entityUsages(p,'chest').some(u=>u.path.includes('owner.entityId')));
});
test('complete acceptance fixture round-trips modular .evpath storage without losing authoring data',()=>{
  const p=authoringAcceptanceFixture();p.canvas={activeSequenceId:'seq',activeScope:{kind:'event',id:'room'},scopes:{'event:room':{positions:{'beat:room:intro':{x:80,y:120}}}}};
  const story={id:'authoring',name:p.name,path:storyPath('authoring')};
  const files=serializeModularStoryFiles(p,story);files.push({relativePath:'.everend/.pathbranching/manifest.json',content:JSON.stringify({version:'0.2',activeStoryId:'authoring',stories:[story]})});
  const loaded=loadPathBranchingWorkspace(files);
  assert.equal(loaded.saveBlocked,false,JSON.stringify(loaded.loadWarnings));assert.equal(loaded.activeProject.events.length,2);
  for(const key of ['entityInstances','entityOverrides','narrativeActions','narrativeRules','authoringScenarios','canvas']) assert.deepEqual(loaded.activeProject[key],p[key],key);
  const owner=loaded.activeProject.events[0].dialogues.find(d=>d.id==='scene');assert.deepEqual(owner.beats.find(b=>b.id==='reward').logic.narrativeEffects,p.events[0].dialogues[0].beats.find(b=>b.id==='reward').logic.narrativeEffects);
  assert.equal(owner.beats.find(b=>b.id==='shared').logic.repeat,'each-entry');
  assert.deepEqual(loaded.activeProject.events[0].decisions[0].outcomes[0].logic.when,p.events[0].decisions[0].outcomes[0].logic.when);
});

test('self-generated text never rewrites richer JSON with colliding scoped identifiers',()=>{
  const p=authoringAcceptanceFixture();
  const dialogue=p.events[0].dialogues.find(d=>d.id==='talk');
  const beat=dialogue.beats[0];const previous=beat.id;beat.id=dialogue.id;
  dialogue.entryBeatId=beat.id;dialogue.members=dialogue.members.map(id=>id===previous?beat.id:id);
  for(const route of p.events[0].transitions){
    if(route.from===`beat:room:${previous}`)route.from=`beat:room:${beat.id}`;
    if(route.to===`beat:room:${previous}`)route.to=`beat:room:${beat.id}`;
  }
  const story={id:'scoped-ids',name:p.name,path:storyPath('scoped-ids')};
  const files=serializeModularStoryFiles(p,story);
  files.push({relativePath:'.everend/.pathbranching/manifest.json',content:JSON.stringify({version:'0.2',activeStoryId:story.id,stories:[story]})});
  const loaded=loadPathBranchingWorkspace(files);
  assert.equal(loaded.saveBlocked,false,JSON.stringify(loaded.loadWarnings));
  assert.deepEqual(loaded.activeProject.events,p.events,'A lossy text projection must leave all original owners, IDs, rules and logic intact.');
  assert.deepEqual(loaded.activeProject.scripts,p.scripts);
});
