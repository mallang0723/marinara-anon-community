const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let saved, sent=[];
const root={contains:()=>true,querySelector:()=>null};
const box={console,URL,Request,Response,AbortController,
  document:{readyState:'loading',addEventListener(){},getElementById:()=>({shadowRoot:root})},
  window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'},fetch:async(input,init)=>{sent.push(JSON.parse(init.body));return new Response('{}')}},
  marinara:{onCleanup(){},storage:{patch:async value=>{saved=JSON.parse(JSON.stringify(value));return {ok:true}}}}};
vm.createContext(box);
vm.runInContext(fs.readFileSync('extension.js','utf8').replace(/\}\)\(\);\s*$/,'globalThis.t={state,normalizeState,identityFor,ctx,povTabs,renderList,renderRpMaterials,renderBookmarks,systemPrompt,boardFlowBlock,selectedRpPosts,optionalRpMaterial,installRpMaterialHook,handleClick,freshPostFromRaw,loreReadCache,readLoreReferences,applyReset};})();'),box);
const t=box.t;
const post=(mode,notice=false)=>({id:mode+(notice?'-notice':''),no:notice?4:1,title:mode+' TITLE',body:mode+' BODY',pov:mode,notice,rpPinned:!notice,rpTimed:true,createdAt:'2026-10-21T00:00:00Z',comments:[{body:mode+' COMMENT',a:{k:1}}]});
t.state.data=t.normalizeState({schemaVersion:2,settings:{rpTimeRead:false,rpInject:false,loreRead:true,resetCap:15},boards:{room:{chatType:'RP',identity:{pov:'world'},posts:['world','reader','drama'].flatMap(m=>[post(m),post(m,true)])},other:{identity:{pov:'drama'},posts:[]}},bookmarks:['world','reader','drama'].map(m=>({chatId:'room',postId:m,post:post(m)}))});
t.state.activeChatId='room';
const click=async mode=>{const el={dataset:{act:'pov-tab',id:mode},closest(){return this}};await t.handleClick({target:el,preventDefault(){}})};
t.installRpMaterialHook();
(async()=>{
  for(const mode of ['world','reader','drama','world']) {
    await click(mode);
    assert.equal(t.identityFor('room').povMode,mode);
    assert.equal(t.state.data.boards.other.identity.pov,'drama','room selection must remain independent');
    const c=t.ctx();
    assert(t.povTabs(c).includes('aria-pressed="true"'));
    const list=t.renderList(c), material=t.renderRpMaterials(c), bookmarks=t.renderBookmarks(c);
    const prompt=t.systemPrompt('room')+'\n'+t.boardFlowBlock(c.board,c.t,c.id);
    t.loreReadCache.set('room',{mode:'full',at:Date.now(),books:[],bookCount:1,rows:[
      {id:'world-summary',content:'WORLD_ARCHIVE',enabled:true,dynamicState:{anonymousCommunity:{chatId:'room',postId:'world',pov:'world'}}},
      {id:'shared',content:'SHARED_WORLD_SETTING',enabled:true}
    ]});
    const lore=await t.readLoreReferences('room','context');
    assert(lore.includes('SHARED_WORLD_SETTING'));
    assert.equal(lore.includes('WORLD_ARCHIVE'),mode==='world');
    for(const m of ['world','reader','drama']) {
      for(const text of [list,material,bookmarks,prompt]) assert.equal(text.includes(m+' TITLE'),m===mode,`${mode}: ${m} leaks`);
    }
    assert.equal(t.selectedRpPosts('room').length,1);
    await box.window.fetch('/api/generate',{method:'POST',body:JSON.stringify({chatId:'room',generationGuide:'KEEP',userMessage:'UNCHANGED'})});
    const req=sent.at(-1);
    assert.equal(req.userMessage,'UNCHANGED');assert(req.generationGuide.startsWith('KEEP'));
    for(const m of ['world','reader','drama']) assert.equal(req.generationGuide.includes(m+' BODY'),m===mode,'material request crosses POV');
    const created=t.freshPostFromRaw({title:'new',body:'new body'},{board:c.board,id:c.id,lang:'ko',time:Date.now()});
    assert.equal(created.pov,mode);
    t.state.data=t.normalizeState(JSON.parse(JSON.stringify(t.state.data)));
    assert.equal(t.identityFor('room').povMode,mode,'reload preserves active POV');
  }
  assert(saved,'tab changes persist through host storage');
  assert.equal(t.state.data.boards.room.audienceMode,'drama','returning from world remembers audience subtype');
  for(const p of t.state.data.boards.room.posts)p.rpPinned=false;
  assert(!t.optionalRpMaterial('room',Date.parse('2026-10-21T00:01:00Z')).text.includes('reader BODY'));
  const legacy=t.normalizeState({schemaVersion:2,settings:{pov:{mode:'reader'}},boards:{a:{posts:[{title:'legacy',body:'legacy content'}]},b:{identity:{pov:'drama'},posts:[{title:'legacy drama',body:'content'}]}}});
  assert.equal(legacy.boards.a.posts[0].pov,'reader');assert.equal(legacy.boards.b.posts[0].pov,'drama');
  const board=t.state.data.boards.room;
  board.posts.push(...Array.from({length:20},(_,i)=>({...post('reader'),id:'r'+i,no:30+i,rpPinned:false})));
  t.applyReset(board);
  assert.equal(board.posts.filter(p=>p.pov==='reader'&&!p.notice).length,21,'world reset must not trim audience records');
  console.log('PASS: real tab actions/persistence, isolated list/bookmarks/flow/notices/archives/material requests, automatic world-only material, new post tags and legacy migration');
})().catch(e=>{console.error(e);process.exitCode=1});
