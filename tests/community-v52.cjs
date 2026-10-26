const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root={contains:()=>true,querySelector:()=>null};
const box={console,AbortController,document:{readyState:'loading',addEventListener(){},getElementById:()=>({shadowRoot:root})},window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'}},marinara:{onCleanup(){},storage:{patch:async()=>({ok:true})}}};
vm.createContext(box);
let requests=[];box.calls=0;
vm.runInContext(fs.readFileSync('extension.js','utf8').replace(/\}\)\(\);\s*$/,'globalThis.t={state,normalizeState,readMemoryReferences,fitMemory,memoryStatusHtml,generateBatch,clear:()=>memoryReadCache.clear(),stub:()=>{render=()=>{};loadChats=async()=>{};recentContext=async()=>"장면";readParticipantPrompts=readLoreReferences=readLtmReferences=readChatSummary=async()=>"";api=async(path)=>{globalThis.calls++;const r=globalThis.reply;if(r&&r.stack&&r.message)throw r;return r;};callModel=async(system,user)=>{globalThis.capture(user);return JSON.stringify({posts:[{title:"t",body:"b"}]})}}};})();'),box);
box.capture=u=>requests.push(u);
const setReply=v=>{box.reply=v};
const callCount=()=>box.calls;
const t=box.t;
t.state.data=t.normalizeState({schemaVersion:2,settings:{rpTimeRead:false,resetMode:'none'},boards:{room:{chatType:'RP',identity:{pov:'world'},posts:[]}}});
t.state.activeChatId='room';t.state.connections=[{id:'test'}];t.stub();
const rendered='[Memory: guidance for replies]\n\n[지난 이야기 흐름]\nC1 축제에서 첫 만남\n\n[떠오른 장면]\n그때 {{char}}가 웃었다\n\n[아직 끝나지 않은 일]\n- 약속: 토요일 영화\n\n[End of memory. Write the next reply]';
(async()=>{
  assert.equal(t.state.data.settings.memoryRead,true,'on by default');
  setReply({enabled:true,rendered});
  let out=await t.readMemoryReferences('room','world');
  assert(out.includes('C1 축제에서 첫 만남'));assert(out.includes('약속: 토요일 영화'));
  assert(!out.includes('[Memory: guidance'));assert(!out.includes('End of memory'));
  assert(out.includes('{​{char}​}'),'macros neutralized');assert(out.includes('게시판 주민은'));
  t.clear();out=await t.readMemoryReferences('room','reader');assert(out.includes('독자·시청자는'));
  // cache: no second call within 30s
  const before=callCount();await t.readMemoryReferences('room','world');assert.equal(callCount(),before);
  t.clear();setReply({enabled:false,rendered:''});assert.equal(await t.readMemoryReferences('room','world'),'');assert(t.memoryStatusHtml('room').includes('꺼져 있어'));
  t.clear();setReply(Object.assign(new Error('요청 실패 (404)'),{status:404}));assert.equal(await t.readMemoryReferences('room','world'),'');assert.equal(t.memoryStatusHtml('room'),'','no notice when the module is not installed');
  t.clear();setReply('<!doctype html>');assert.equal(await t.readMemoryReferences('room','world'),'');assert.equal(t.memoryStatusHtml('room'),'','no notice when the module is not installed');
  // fit keeps the story flow and open items when too long
  const long='[지난 이야기 흐름]\nC1\n\n[떠오른 장면]\n'+'가'.repeat(5000)+'\n\n[아직 끝나지 않은 일]\n- 약속';
  const fit=t.fitMemory(long,1000);assert(fit.includes('[지난 이야기 흐름]'));assert(fit.includes('- 약속'));assert(fit.length<=1000);
  // off → nothing
  t.state.data.settings.memoryRead=false;t.clear();assert.equal(await t.readMemoryReferences('room','world'),'');t.state.data.settings.memoryRead=true;
  // goes into the actual batch request
  t.clear();setReply({enabled:true,rendered});await t.generateBatch();
  assert(requests.at(-1).includes('[현재 RP의 장기 기억'));assert(requests.at(-1).includes('약속: 토요일 영화'));
  console.log('PASS: 기억 서재 memory reference — fetch, strip RP guidance, POV-aware rules, cache, quiet fallbacks, length fit, batch prompt');
})().catch(e=>{console.error(e);process.exitCode=1});
