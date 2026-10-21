const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('extension.js', 'utf8');
const box = {console, document: {readyState:'loading', addEventListener(){}, getElementById(){return null}}, window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'}}, marinara:{onCleanup(){}}};
vm.createContext(box);
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.t={state,normalizeState,systemPrompt};})();'), box);
const t=box.t;
for(const theme of ['reddit','ch4','ch2','gall','work']) {
  t.state.data=t.normalizeState({schemaVersion:2,settings:{theme,tone:true},boards:{room:{chatType:'RP',identity:{theme},posts:[]}}});
  t.state.activeChatId='room';
  const prompt=t.systemPrompt('room');
  assert.equal(prompt.includes('번역투'), ['reddit','ch4'].includes(theme), theme);
  if(['reddit','ch4'].includes(theme)) {
    assert(prompt.includes('출력은 한국어로 유지'));
    assert(prompt.includes('RP의 국가·인물·문화·사실 설정을 영미권으로 바꾸지 않는다'));
    t.state.data.settings.tone=false;
    assert(!t.systemPrompt('room').includes('번역투'));
    assert(!t.systemPrompt('room').includes('[게시판 말투]'));
  }
}
console.log('PASS: translated-English tone limited to Reddit/4ch, Korean and RP guards, tone toggle');
