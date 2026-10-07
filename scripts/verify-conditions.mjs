import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateConditionInput, migrateConditionInput, resolveFirstValidTransition } from '../lib/logic.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { exportInkProject } from '../lib/exportFormats.js';
import { exportRuntimePackage } from '../lib/exportRuntime.js';

import { fixture, strength } from './condition-fixture.mjs';
import { evaluateConditionDetailed, externalConditionKey } from '../lib/conditionEvaluation.js';
import { retargetCondition } from '../lib/conditionEditing.js';
import { inkConditionKey } from '../lib/inkExport.js';
import { Compiler, CompilerOptions } from 'inkjs/full';
import { applyConsequence, resolveConsequences } from '../lib/logic.js';
import { conditionInputText, parseConditionText, serializeEventEvpath, applyEvpathToEvent } from '../lib/evpathFormat.js';
import { serializeProject, parseProject } from '../lib/projectSerialization.js';
import { serializeModularStoryFiles, storyPath, loadPathBranchingWorkspace } from '../lib/pathBranchingWorkspace.js';
import { buildExportPreview } from '../lib/exportPreview.js';
import { validateProject } from '../lib/validate.js';

const owned={type:'state',subject:{kind:'entity',entityId:'key'},stateId:'owned',operator:'has'};
const visited={type:'visited',subject:{kind:'progress',targetType:'event',targetId:'b'},operator:'has'};
const rule={all:[{any:[owned,strength]},{not:visited}]};
function compile(p) {
  const exported=exportInkProject(p);
  assert.deepEqual(exported.diagnostics,[]);
  const messages=[];
  let story;
  try { story=new Compiler(exported.files[0].content,new CompilerOptions(null,[],false,(m,t)=>messages.push({m,t}))).Compile(); }
  catch { assert.fail(JSON.stringify(messages)); }
  assert.equal(messages.filter(m=>m.t===2).length,0,JSON.stringify(messages));
  return {story,exported};
}
function run(story) {let output='';let steps=0;while(story.canContinue){assert.ok(++steps<100);output+=story.Continue();}return output;}
test('local fields and ISO dates evaluate against authored values', () => {
  const p = fixture();
  assert.equal(evaluateConditionInput({ type: 'property', subject: { kind:'entity', entityId:'relic' }, propertyId:'durability', operator:'==', value:4 }, p, {}), true);
  assert.equal(evaluateConditionInput({ type: 'property', subject: { kind:'entity', entityId:'relic' }, propertyId:'day', operator:'>', value:'2026-10-05' }, p, {}), true);
});
test('legacy state migration preserves state lookup and is idempotent', () => {
  const p = fixture(), legacy = { type:'canonState', ref:'key', state:'present', operator:'==', value:true };
  const migrated = migrateConditionInput(legacy, []), state = { canonStates:{ key:{ present:true } } };
  assert.equal(evaluateConditionInput(legacy, p, state), true);
  assert.equal(evaluateConditionInput(migrated, p, state), true);
  assert.deepEqual(migrateConditionInput(migrated, []), migrated);
});
test('false is defined and comparisons do not coerce', () => {
  const p = fixture();
  assert.equal(evaluateConditionInput({ ...strength, operator:'missing' }, p, {variables:{strength:false}}), false);
  assert.equal(evaluateConditionInput({ ...strength, operator:'==', value:5 }, p, {variables:{strength:'5'}}), false);
});
test('unknown under NOT and unknown preceding Else never grant a route', () => {
  const p = fixture(), unknown = { type:'external', subject:{kind:'external',functionId:'engineReady'},operator:'has' };
  p.externalFunctions.push({name:'engineReady',kind:'condition'});
  assert.equal(evaluateConditionInput({ not:unknown }, p, {}), false);
  assert.equal(resolveFirstValidTransition([{id:'if',from:'a',to:'b',conditions:unknown,order:0},{id:'else',from:'a',to:'c',mode:'fallback',order:1}],p,{}), undefined);
});
test('runtime choices retain conditional routing instead of selecting the first destination', () => {
  const p = fixture();
  p.events[0].decisions = [{id:'choose',name:'Choose',type:'dialogue',availability:strength,outcomes:[{id:'go',name:'Go'}]}];
  const from = 'outcome:a:choose:go';
  p.events[0].transitions = [{id:'if',from,to:'b',conditions:strength,order:0},{id:'else',from,to:'c',mode:'fallback',order:1}];
  const runtime = exportRuntimePackage(p), choice = runtime.nodes.find(n=>n.id==='a').choices[0];
  const router = runtime.nodes.find(n=>n.id===choice.targetNodeId);
  assert.equal(router?.type, 'route');
  assert.equal(router.automaticTransitions.length, 2);
  assert.deepEqual(choice.conditions, strength);
});
test('Ink emits an executable gate rather than an unconditional divert', () => {
  const p = fixture();
  p.events[0].transitions = [{id:'if',from:'a',to:'b',logic:{when:strength},order:0},{id:'else',from:'a',to:'c',mode:'fallback',order:1}];
  const text = exportInkProject(p).files.map(f=>f.content).join('\n');
  assert.match(text, /\{[^\n]*>=\s*5/);
});

test('nested AND/OR/NOT matrix agrees between evaluator, runtime routing and executed Ink',()=>{
  const p=fixture();
  p.events[0].decisions=[{id:'choose',name:'Choose',outcomes:[{id:'go',name:'Go',unavailableBehavior:'hidden'}]}];
  const from='outcome:a:choose:go';
  p.events[0].transitions=[{id:'if',from,to:'b',logic:{when:rule,then:[{type:'value',subject:{kind:'variable',variableId:'strength'},operation:'add',value:1}]},order:0},{id:'else',from,to:'c',mode:'fallback',order:1}];
  const runtime=exportRuntimePackage(p), router=runtime.nodes.find(n=>n.type==='route');
  assert.ok(runtime.pathBranching.requiredFeatures.includes('dynamic-choice-routing-v1'));
  for(const hasKey of [false,true]) for(const value of [0,5]) for(const sawRoom of [false,true]) {
    const state={variables:{strength:value},inventory:hasKey?['key']:[],visited:sawRoom?['b']:[]};
    const expected=(hasKey||value>=5)&&!sawRoom;
    assert.equal(evaluateConditionInput(rule,p,state),expected);
    const route=resolveFirstValidTransition(router.automaticTransitions,p,state);
    assert.equal(route.to,expected?'b':'c');
    let after=state;for(const effect of resolveConsequences(route.consequences,p,state))after=applyConsequence(effect,after);
    const {story,exported}=compile(p);
    for(const [predicate,val] of [[strength,value],[owned,hasKey],[visited,sawRoom]]) story.variablesState.$(exported.symbols[inkConditionKey(predicate)],val);
    assert.match(run(story),/Door/);assert.equal(story.currentChoices.length,1);
    story.ChooseChoiceIndex(0);
    const output=run(story);assert.match(output,expected?/Open/:/Closed/);
    assert.equal(story.variablesState.$(exported.symbols[inkConditionKey(strength)]),after.variables.strength);
  }
});
test('detailed states, absence and invalid negations remain fail closed',()=>{
  const p=fixture();
  for(const value of [false,0,'',[]])assert.equal(evaluateConditionInput({...strength,operator:'exists'},p,{variables:{strength:value}}),true);
  for(const input of [{all:[]},{any:[]},{not:{...strength,value:'five'}},{type:'unknown'},{all:'bad'}])assert.equal(evaluateConditionDetailed(input,p).status,'invalid');
  assert.equal(evaluateConditionDetailed([],p).status,'satisfied');
  assert.equal(evaluateConditionDetailed(undefined,p).status,'satisfied');
  assert.equal(evaluateConditionDetailed({not:strength},p,{variables:{strength:undefined}}).status,'unresolved');
  p.externalFunctions.push({name:'ready',kind:'condition'});
  const external={type:'external',subject:{kind:'external',functionId:'ready'},operator:'has'};
  assert.equal(evaluateConditionDetailed(external,p).status,'unresolved');
  assert.equal(evaluateConditionDetailed(external,p,{externalResults:{[externalConditionKey(external)]:true}}).status,'satisfied');
});
test('typed lists, invalid dates and explicit overlays',()=>{
  const p=fixture();p.logicVariables.push({id:'list',name:'List',type:'list',value:[],groupId:'default'});
  const list={type:'value',subject:{kind:'variable',variableId:'list'},operator:'contains',value:'key'};
  assert.equal(evaluateConditionInput(list,p,{variables:{list:['key']}}),true);
  assert.equal(evaluateConditionDetailed({...list,value:['key']},p,{variables:{list:['key']}}).status,'invalid');
  const date={type:'property',subject:{kind:'entity',entityId:'relic'},propertyId:'day',operator:'>',value:'2026-02-30'};
  assert.equal(evaluateConditionDetailed(date,p).status,'invalid');
  assert.equal(evaluateConditionInput({...date,value:'2026-10-07'},p,{entityStates:{relic:{properties:{day:'2026-10-08'}}}}),true);
});
test('reference changes preserve compatible operators and require new incompatible operands',()=>{
  const p=fixture();p.logicVariables.push({id:'other',name:'Other',type:'number',value:1},{id:'text',name:'Text',type:'text',value:''});
  const next=retargetCondition(strength,{kind:'variable',variableId:'other'},p);
  assert.equal(next.operator,'>=');assert.equal(next.value,5);
  assert.equal(retargetCondition(strength,{kind:'variable',variableId:'text'},p).value,undefined);
  assert.equal(retargetCondition({...visited,operator:'missing'},{kind:'progress',targetType:'event',targetId:'c'},p).operator,'missing');
});
test('normalization preserves ambiguous values and migrations are repeatable',()=>{
  const p=fixture();p.logicVariables[0].value='not a number';
  const normalized=normalizeProject(p);
  assert.equal(normalized.logicVariables[0].value,'not a number');
  assert.deepEqual(normalizeProject(normalized),normalized);
  assert.ok(validateProject(normalized).some(f=>f.message.includes('ambiguous')));
  assert.deepEqual(migrateConditionInput({all:'bad'},[]),{all:'bad'});
});
test('priority, canonical when and duplicate Else diagnostics share routing policy',()=>{
  const p=fixture();
  const routes=[{id:'last',from:'a',to:'c',mode:'fallback',order:-1},{id:'high',from:'a',to:'b',order:0,conditions:{...strength,value:100},logic:{when:strength}},{id:'low',from:'a',to:'c',order:1}];
  assert.equal(resolveFirstValidTransition(routes,p,{variables:{strength:5}}).id,'high');
  assert.equal(resolveFirstValidTransition([...routes,{...routes[0],id:'duplicate'}],p,{}),undefined);
  p.events[0].transitions=[...routes,{...routes[0],id:'duplicate'}];
  assert.ok(validateProject(p).some(f=>f.code==='duplicate_fallback'));
});
test('JSON and modular evpath save/reopen preserve synthetic nested rule and route IDs',()=>{
  const p=fixture();p.events[0].logic={when:rule};p.events[0].availability=rule;
  const reopened=parseProject(serializeProject(p));assert.deepEqual(reopened.events[0].logic.when,rule);
  const story={id:'main',name:'Synthetic',path:storyPath('main')};
  const files=serializeModularStoryFiles(p,story);
  files.push({relativePath:'.everend/.pathbranching/manifest.json',content:JSON.stringify({version:'0.2',activeStoryId:'main',stories:[story]})},{relativePath:'Items/Key.md',content:'---\nid: key\ntype: item\nname: Key\n---\n'});
  const loaded=loadPathBranchingWorkspace(files);
  assert.deepEqual(loaded.activeProject.events[0].logic.when,rule);
  assert.equal(evaluateConditionInput(rule,loaded.activeProject,{inventory:['key']}),true);
  const text=serializeEventEvpath(p,'a');
  const result=applyEvpathToEvent(p,'a',text);
  assert.deepEqual(result.project.events[0].logic.when,rule);
  assert.equal(serializeEventEvpath(result.project,'a'),text);
});
test('unsupported nested expression is wholly opaque rather than partially rendered',()=>{
  const p=fixture();const opaque={all:[strength,{type:'external',subject:{kind:'external',functionId:'ready'},operator:'has'}]};
  assert.match(conditionInputText(opaque,p),/\{ #/);
  p.events[0].logic={when:opaque};p.events[0].availability=opaque;
  const result=applyEvpathToEvent(p,'a',serializeEventEvpath(p,'a'));
  assert.deepEqual(result.project.events[0].logic.when,opaque);
});
test('unsupported Ink and legacy exports block clearly without blocking enhanced JSON',()=>{
  const p=fixture();p.events[0].logic={when:{type:'external',subject:{kind:'external',functionId:'ready'},operator:'has'}};
  const ink=exportInkProject(p);assert.equal(ink.files.length,0);assert.match(ink.diagnostics[0].message,/External/);
  assert.throws(()=>buildExportPreview(p,'ink'),/a:.*External/s);
  assert.throws(()=>exportRuntimePackage(p,{profile:'legacy'}),/Legacy/);
  assert.ok(buildExportPreview(p,'runtime').content.includes('external'));
});
