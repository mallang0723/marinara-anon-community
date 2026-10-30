const fs=require('fs'),vm=require('vm'),assert=require('assert');
const sandbox={console,URL,Request,Response,AbortController,document:{readyState:'loading',addEventListener(){},getElementById(){return null}},window:{setTimeout,clearTimeout,location:{href:'https://example.test',origin:'https://example.test'}},marinara:{onCleanup(){},apiFetch:async()=>[]}};vm.createContext(sandbox);const s=fs.readFileSync('extension.js','utf8');vm.runInContext(s.replace(/\}\)\(\);\s*$/,'globalThis.t={parseRpTime};})();'),sandbox);const t=sandbox.t;
const time=new Date(2027,3,14,20,50).getTime();
// Status panels that write key=value pairs, e.g. <stat>Date=2027-04-14|Time=20:50|Location=…</stat>
for(const v of ['<stat>Date=2027-04-14|Time=20:50|Location=Hotel lobby|Track=Requiem|Sanity=92</stat>','Date=2027-04-14|Time=20:50','DATE = 2027-04-14 | TIME = 20:50','날짜=2027-04-14 시간=20:50','date=2027.04.14|time=오후 8:50'])assert.equal(t.parseRpTime(v),time,v);
// Existing colon formats still work, and invalid values are still rejected.
for(const v of ['[날짜: 2027.04.14.]\n[시간: 20:50]','2027-04-14 20:50'])assert.equal(t.parseRpTime(v),time,v);
for(const v of ['Date=2027-02-30|Time=20:50','Date=2027-04-14|Time=25:50','Time=20:50'])assert.equal(t.parseRpTime(v),null,v);
console.log('PASS: key=value status panel date/time (Date=…|Time=…, 날짜=… 시간=…) parsed; colon formats unchanged; invalid values rejected');
