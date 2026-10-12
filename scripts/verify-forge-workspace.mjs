import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateAuthoringWorkspace, MIN_CANVAS_WIDTH, EXPLORER_PANEL_IDS, isExplorerPanel, managementPanelCollapsedState } from '../lib/adaptiveWorkspace.js';
import { normalizeWorkspaceSession } from '../lib/workspaceSettings.js';
import { guardUniverseSwitch } from '../lib/universeSwitchGuard.js';
import { writingInspectorTarget } from '../lib/inspectorNavigation.js';
import { authoringDraftKey, authoringDraftEntries, getAuthoringDraft, setAuthoringDraft } from '../lib/authoringDrafts.js';
import { normalizeProject } from '../lib/projectSerialization.js';
import { updateDialogue } from '../lib/projectMutations.js';
import { loadPathBranchingWorkspace, serializeModularStoryFiles, serializePathBranchingManifest, storyPath } from '../lib/pathBranchingWorkspace.js';

test('one explorer accounts for Suite rail, contextual dock and gaps without rewriting widths', () => {
  for (const windowWidth of [1440,1280,1100,900]) {
    for (const suiteRail of [0,56,208]) {
      const actualWorkspace = windowWidth-suiteRail-16;
      const layout = allocateAuthoringWorkspace(actualWorkspace,282,true,420);
      if (layout.inlineExplorer) assert.ok(actualWorkspace-layout.explorerColumn-420-10 >= MIN_CANVAS_WIDTH);
      else assert.equal(layout.explorerColumn,40);
    }
  }
  assert.equal(allocateAuthoringWorkspace(1184,282,true,420).inlineExplorer,false,'near the threshold uses a drawer');
  assert.equal(allocateAuthoringWorkspace(1194,282,true,420).inlineExplorer,true,'all three surfaces fit');
});

test('UI preferences restore safely and remain separate from narrative documents', () => {
  const preferences = { explorerTab:'logic',contextPresentation:'floating',contextTab:'test',contextFocus:true };
  const session = normalizeWorkspaceSession(preferences);
  for (const [key,value] of Object.entries(preferences)) assert.equal(session[key],value);
  const invalid = normalizeWorkspaceSession({explorerTab:'invalid',contextPresentation:'invalid',contextTab:'invalid',contextFocus:'yes'});
  assert.equal(invalid.explorerTab,undefined);
  assert.equal(invalid.contextPresentation,'floating');
  assert.equal(normalizeWorkspaceSession({}).contextPresentation, 'floating');
  const legacyDock = normalizeWorkspaceSession({contextPresentation:'docked',inspectorSize:{width:520,height:440},contextFocus:true});
  assert.equal(legacyDock.contextPresentation, 'floating', 'old docked layouts migrate to the single floating presentation');
  assert.deepEqual(legacyDock.inspectorSize, {width:520,height:440}, 'migration retains the previous size');
  assert.equal(legacyDock.contextFocus, true, 'canvas fullscreen remains an independent preference');
  assert.equal(invalid.contextTab,'edit');
  assert.equal(invalid.contextFocus,false);
});

test('all five management views switch in one sidebar and retain the legacy player preference', () => {
  assert.deepEqual(EXPLORER_PANEL_IDS, ['outline', 'assets', 'logic', 'export', 'connect']);
  const initial = { outline: false, assets: false, logic: false, export: false, connect: false, player: true };
  const before = JSON.stringify(initial);
  for (const id of EXPLORER_PANEL_IDS) {
    assert.equal(isExplorerPanel(id), true);
    const opened = managementPanelCollapsedState(initial, id, false);
    assert.deepEqual(EXPLORER_PANEL_IDS.filter(panel => !opened[panel]), [id]);
    assert.equal(opened.player, true);
    const closed = managementPanelCollapsedState(opened, id, true);
    assert.ok(EXPLORER_PANEL_IDS.every(panel => closed[panel]));
    const session = normalizeWorkspaceSession({ explorerTab: id, panelCollapsed: opened });
    assert.equal(session.explorerTab, id, 'Export and Connect selection survives reopening too');
    assert.deepEqual(session.panelCollapsed, opened);
  }
  assert.equal(JSON.stringify(initial), before);
  assert.equal(isExplorerPanel('player'), false);
});

test('management navigation keeps one panel width plus its rail across desktop and narrow layouts', () => {
  for (const width of [1440, 1280, 1100, 900, 700]) {
    for (const panelWidth of [282, 420]) {
      const layout = allocateAuthoringWorkspace(width, panelWidth + 40, true, 420);
      if (layout.inlineExplorer) assert.ok(width - layout.explorerColumn - 420 - 10 >= MIN_CANVAS_WIDTH);
      else assert.equal(layout.explorerColumn, 40);
    }
  }
});

test('Write story follows the entered scene before a stale sequence inspector selection', () => {
  const project = { events:[{id:'scene',dialogues:[{id:'conversation'}]},{id:'other',dialogues:[]} ] };
  const before = JSON.stringify(project);
  assert.deepEqual(writingInspectorTarget(project,{kind:'event',id:'scene'},{type:'node',id:'sequence'}),{selection:{type:'node',id:'scene'},eventId:'scene'});
  assert.deepEqual(writingInspectorTarget(project,{kind:'dialogue',id:'conversation',eventId:'scene'},{type:'node',id:'other'}),{selection:{type:'node',id:'dialogue:scene:conversation'},eventId:'scene'});
  assert.deepEqual(writingInspectorTarget(project,{kind:'sequence',id:'sequence'},{type:'node',id:'other'}),{selection:{type:'node',id:'other'},eventId:'other'});
  assert.equal(writingInspectorTarget(project,{kind:'sequence',id:'sequence'},{type:'node',id:'sequence'}),undefined);
  assert.equal(writingInspectorTarget(project,{kind:'event',id:'removed'}),undefined);
  assert.equal(JSON.stringify(project),before);
});

test('switch guard waits for accepted saves, including edits arriving during an earlier write', async () => {
  let pending=true, flushes=0;
  assert.equal(await guardUniverseSwitch({state:()=>({hasDrafts:false,saveBlocked:false,hasPendingSave:pending}),flush:async()=>{flushes++;pending=flushes<2;},report:()=>assert.fail('unexpected block')}),true);
  assert.equal(flushes,2);
});

test('switch guard preserves manual input, blocks failed writes and incomplete loads', async () => {
  for (const [state,expected] of [[{hasDrafts:true,saveBlocked:false,hasPendingSave:false},'drafts'],[{hasDrafts:false,saveBlocked:true,hasPendingSave:false},'blocked']]) {
    const before=JSON.stringify(state); let reason;
    assert.equal(await guardUniverseSwitch({state:()=>state,flush:async()=>{},report:value=>{reason=value;}}),false);
    assert.equal(reason,expected); assert.equal(JSON.stringify(state),before);
  }
  let reason;
  assert.equal(await guardUniverseSwitch({state:()=>({hasDrafts:false,saveBlocked:false,hasPendingSave:true}),flush:async()=>{throw new Error('disk unavailable');},report:value=>{reason=value;}}),false);
  assert.equal(reason,'error');
  assert.equal(await guardUniverseSwitch({state:()=>({hasDrafts:false,saveBlocked:false,hasPendingSave:true}),flush:async()=>{},report:value=>{reason=value;}}),false);
  assert.equal(reason,'pending');
});

test('context text blocks navigation while pending and survives accepted save and reopen', async () => {
  const story = {id:'context-input-regression',name:'Context input',path:storyPath('context-input-regression')};
  let project = normalizeProject({specVersion:'0.1',projectId:story.id,storyId:story.id,name:story.name,
    sequences:[{id:'sequence',name:'Sequence',eventIds:['room'],entryEventId:'room',branchIds:[]}],branches:[],
    events:[{id:'room',name:'Room',type:'normal',dialogues:[{id:'scene',title:'Chest scene',text:{format:'plain',content:''},beats:[],members:[]}]}],
    canonRefs:[],scripts:[],externalFunctions:[],variables:{}});
  const key = authoringDraftKey(project.projectId,'scene','dialogue-text');
  const typed = 'Pending speech must stay in the writing surface.';
  setAuthoringDraft(key,typed);
  let reason;
  const state = () => ({hasDrafts:authoringDraftEntries(project.projectId).length>0,saveBlocked:false,hasPendingSave:false});
  assert.equal(await guardUniverseSwitch({state,flush:async()=>{},report:value=>{reason=value;}}),false);
  assert.equal(reason,'drafts');
  assert.equal(getAuthoringDraft(key),typed,'navigation cannot apply or discard the input');
  // A field blur/debounce accepts contextual prose into its actual document owner.
  // It does not create the next Speech block, whose text has a separate draft key.
  project = updateDialogue(project,'room','scene',{text:{format:'plain',content:typed}}).project;
  const files = [{relativePath:'.everend/.pathbranching/manifest.json',content:serializePathBranchingManifest({version:'0.2',activeStoryId:story.id,stories:[story]})},...serializeModularStoryFiles(project,story)];
  const reopened = loadPathBranchingWorkspace(files);
  assert.equal(reopened.saveBlocked,false);
  assert.equal(reopened.activeProject.events[0].dialogues[0].text.content,typed);
  setAuthoringDraft(key,undefined);
  assert.equal(await guardUniverseSwitch({state,flush:async()=>{},report:()=>assert.fail('accepted save cannot block')}),true);
  // A new manual edit arriving while another accepted edit is flushing also blocks.
  assert.equal(await guardUniverseSwitch({state,flush:async()=>{setAuthoringDraft(key,'A later recoverable edit');},report:value=>{reason=value;}}),false);
  assert.equal(reason,'drafts');
  assert.equal(getAuthoringDraft(key),'A later recoverable edit');
  setAuthoringDraft(key,undefined);
});
