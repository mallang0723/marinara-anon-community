const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const requests=[];let saved;
const root={contains:()=>true,querySelector:()=>null};
const box={console,AbortController,document:{readyState:'loading',addEventListener(){},getElementById:()=>({shadowRoot:root})},window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'}},marinara:{onCleanup(){},storage:{patch:async value=>{saved=value;return {ok:true}}}}};
vm.createContext(box);
vm.runInContext(fs.readFileSync('extension.js','utf8').replace(/\}\)\(\);\s*$/,
  'globalThis.t={state,normalizeState,identityFor,systemPrompt,sourceBlock,DEFAULT_PROMPT,NUANCES,handleClick,handleChange,handleSubmit,generateBatch,generateComments,ctx,povTabs,generationProfileFor,stub:(model)=>{callModel=model;loadChats=async()=>{};recentContext=async()=>"화면에서 두 사람이 눈을 맞추고 대화한다.";readParticipantPrompts=readChatSummary=readLoreReferences=readLtmReferences=async()=>"";render=()=>{};}};})();'),box);
const t=box.t;
t.state.data=t.normalizeState({schemaVersion:2,settings:{theme:'gall',rpTimeRead:false,resetMode:'none',prompt:t.DEFAULT_PROMPT+'\nWORLD_CUSTOM_PROMPT',identity:{boardName:'WORLD_SITE',rules:'WORLD_GLOBAL_RULE',nickBase:'WORLD_NICK',regulars:['WORLD_REGULAR']},nuanceText:'WORLD_NUANCE'},boards:{room:{chatType:'RP',identity:{boardName:'할로우넷',rules:'WORLD_ROOM_RULE'},posts:[]},other:{posts:[]}}});
t.state.activeChatId='room';t.state.chats=[{id:'room',mode:'roleplay',name:'작품'}];t.state.connections=[{id:'test'}];
t.stub(async(system,user)=>{requests.push({system,user});return JSON.stringify(system.includes('"posts"')?{posts:[{title:'생성 글',body:'생성 본문',comments:[]}]}:{comments:[{body:'새로운 댓글'}]})});
const click=async(act,id,extra={})=>{const el={dataset:{act,id,...extra},closest(){return this}};await t.handleClick({target:el,preventDefault(){}})};
const change=async(dataset,value)=>t.handleChange({target:{dataset,value,classList:{contains:()=>false}}});
const legacyMarkers=['할로우넷','WORLD_SITE','WORLD_GLOBAL_RULE','WORLD_NICK','WORLD_REGULAR','WORLD_ROOM_RULE','WORLD_CUSTOM_PROMPT','WORLD_NUANCE'];
(async()=>{
  const worldPrompt=t.systemPrompt('room');for(const marker of legacyMarkers.filter(x=>x!=='WORLD_SITE'))assert(worldPrompt.includes(marker),marker);
  const themes={world:'gall',reader:'reddit',drama:'cafe'};
  for(const mode of ['world','reader','drama']) {
    await click('pov-tab',mode);
    if(mode!=='world') for(const marker of legacyMarkers) assert(!t.systemPrompt('room').includes(marker),'legacy leak: '+marker);
    await change({povTheme:''},themes[mode]);
    assert.equal(t.identityFor('room').themeId,themes[mode]);
    await change({tabProfile:'boardName'},mode+'_BOARD');
    await change({tabProfile:'rules'},mode+'_RULES');
    await change({set:'prompt'},t.DEFAULT_PROMPT+'\n'+mode+'_PROMPT');
    await change({set:'nuanceText'},mode+'_NUANCE');
    await t.generateBatch();assert(requests.length>0);
    const request=requests.at(-1);
    for(const field of ['BOARD','RULES','PROMPT','NUANCE'])assert(request.system.includes(mode+'_'+field),mode+field);
    for(const other of ['world','reader','drama'].filter(x=>x!==mode))for(const field of ['BOARD','RULES','PROMPT','NUANCE'])assert(!request.system.includes(other+'_'+field),'cross-tab profile leak');
    const post=t.state.data.boards.room.posts[0];assert.equal(post.pov,mode);
    await t.generateComments('room',post);
    assert(requests.at(-1).system.includes(mode+'_RULES'),'comments use original tab rules');
    if(mode==='drama') {
      assert(request.system.includes('영상으로 본 최신 방영 회차'));
      assert(request.system.includes('일반 내면 서술과 비공개 설정은 시청자가 직접 볼 수 없다'));
      assert(request.system.includes('소설의 글쓰기 기법을 평가하지 않는다'));
      assert(request.user.includes('이미 시청한 영상'));
    }
  }
  t.state.data=t.normalizeState(JSON.parse(JSON.stringify(t.state.data)));
  for(const mode of ['reader','world','drama']) {await click('pov-tab',mode);assert.equal(t.identityFor('room').themeId,themes[mode]);assert(t.systemPrompt('room').includes(mode+'_RULES'))}
  assert.equal(t.identityFor('other').themeId,'gall','other room theme unchanged');
  await click('identity',undefined,{scope:'room'});
  assert.equal(t.state.identityEdit.rules,'drama_RULES');t.state.identityEdit.rules='DRAMA_EDITOR_RULE';
  const form={dataset:{form:'identity'},closest(){return this}};
  await t.handleSubmit({target:form,preventDefault(){}});
  assert(t.systemPrompt('room').includes('DRAMA_EDITOR_RULE'));
  await click('pov-tab','world');assert(!t.systemPrompt('room').includes('DRAMA_EDITOR_RULE'));
  assert(saved,'host storage used');
  await click('tab-theme-reset');assert.equal(t.identityFor('room').themeId,'gall');
  await click('pov-tab','drama');assert.equal(t.identityFor('room').themeId,'cafe');
  const firstPost=t.state.data.boards.room.posts.find(p=>p.pov==='world');
  assert(t.systemPrompt('room','',t.identityFor('room',firstPost)).includes('world_RULES'),'old world thread remains world while current view differs');
  console.log('PASS: per-tab themes and rules via real controls, independent rooms/reload/editor, isolated actual batch/comment prompts, visual drama guard');
})().catch(e=>{console.error(e);process.exitCode=1});
