const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root={contains:()=>true,querySelector:()=>null};
const box={console,AbortController,document:{readyState:'loading',addEventListener(){},getElementById:()=>({shadowRoot:root})},window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'}},marinara:{onCleanup(){},storage:{patch:async()=>({ok:true})}}};
vm.createContext(box);box.toasts=[];box.calls=0;
vm.runInContext(fs.readFileSync('extension.js','utf8').replace(/\}\)\(\);\s*$/,'globalThis.t={state,normalizeState,generateComments,threadLines,identityFor,themeById,renderSettings:c=>renderSettings(c),ctx,commentCap,stub:()=>{render=()=>{};toast=(m)=>globalThis.toasts.push(m);recentContext=async()=>"장면";readParticipantPrompts=readLoreReferences=readLtmReferences=readChatSummary=readMemoryReferences=async()=>"";callModel=async()=>{globalThis.calls++;return JSON.stringify({comments:[{body:"a"},{body:"b"},{body:"c"}]})}}};})();'),box);
const t=box.t;
const comments=n=>Array.from({length:n},(_,i)=>({id:'c'+i,body:'댓글 '+i,createdAt:'2024-10-18T14:20:00Z',a:{k:i}}));
const data=(n,cap)=>({schemaVersion:2,settings:{rpTimeRead:false,resetMode:'none',commentCap:cap},boards:{room:{chatType:'RP',identity:{pov:'world'},posts:[{id:'p',no:1,title:'제목',body:'본문',createdAt:'2024-10-18T14:20:00Z',a:{k:0},comments:comments(n)}]}}});
(async()=>{
  t.state.data=t.normalizeState(data(450,300));t.state.activeChatId='room';t.state.connections=[{id:'x'}];t.stub();
  const post=t.state.data.boards.room.posts[0];
  assert.equal(post.comments.length,450,'reload never drops comments above the old 200 limit');
  assert.equal(t.commentCap(),300);
  assert.equal(t.normalizeState(data(1,777)).settings.commentCap,200,'unknown cap falls back to 200');
  // full: no model call, friendly toast
  await t.generateComments('room',post);assert.equal(box.calls,0);assert(box.toasts.at(-1).includes('댓글 한도(300개)'));
  // room for one more: only one is added
  t.state.data.settings.commentCap=500;post.comments.push(...comments(499).slice(450).map(c=>({...c,id:'x'+c.id,a:post.comments[0].a,parentId:'',toId:''})));await t.generateComments('room',post);
  assert.equal(box.calls,1,JSON.stringify(box.toasts));assert.equal(post.comments.length,500,JSON.stringify(box.toasts));
  // model input window keeps original numbering
  const id=t.identityFor('room',post),lines=t.threadLines(post,'ko',t.themeById(id.themeId),id);
  assert.equal(lines.length,121);assert(lines[0].startsWith('c0 |'));assert(lines[10].includes('생략'));assert(lines.at(-1).startsWith('c499 |'));
  // settings show the choices
  assert(t.renderSettings(t.ctx()).includes('data-act="comment-cap" data-n="2000"'));
  console.log('PASS: adjustable comment limit — no silent loss on reload, blocked when full, trims to room, windowed model input, settings choices');
})().catch(e=>{console.error(e);process.exitCode=1});
