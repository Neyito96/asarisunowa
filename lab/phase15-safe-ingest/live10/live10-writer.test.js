'use strict';const assert=require('node:assert/strict');const {prepare,ingest}=require('./live10-writer');
const items=[{guid:'g1',show:'MEDIA TALK',title:'t1',pubDate:'2026-10-28',url:'https://omny.fm/1'},{guid:'g2',show:'スポンジ',title:'t2',pubDate:'2026-10-28',url:'https://omny.fm/2'}];
const s={schemaVerified:true,exclusionVerified:true,historyComplete:true,ledger:[{id:'EP-06632',guid:'old'}],history:[{id:'EP-06632',guid:'old'}]};
let n=0;function test(name,f){f();n++;console.log('PASS',name)}
test('preview IDs',()=>assert.deepEqual(prepare(s,items).rows.map(x=>x.id),['EP-06633','EP-06634']));
test('preview writes zero',()=>assert.equal(prepare(s,items).writes,0));
test('history max',()=>assert.equal(prepare({...s,history:[...s.history,{id:'EP-06650',guid:'reserved'}]},items).rows[0].id,'EP-06651'));
test('GUID duplicate',()=>assert.throws(()=>prepare({...s,ledger:[...s.ledger,{id:'EP-00001',guid:'g1'}]},items),/STOP_DUPLICATE/));
test('URL duplicate',()=>assert.throws(()=>prepare({...s,ledger:[...s.ledger,{id:'EP-00001',guid:'x',url:items[0].url}]},items),/STOP_DUPLICATE/));
test('excluded',()=>assert.throws(()=>prepare({...s,excluded:[{guid:'g1'}]},items),/STOP_POLICY/));
test('missing URL',()=>assert.throws(()=>prepare(s,[{...items[0],url:''}]),/STOP_METADATA/));
test('history incomplete',()=>assert.throws(()=>prepare({...s,historyComplete:false},items),/STOP_PREFLIGHT/));
test('ID collision',()=>assert.throws(()=>prepare({...s,reservations:[{id:'EP-06632',guid:'x'}]},items),/STOP_ID_COLLISION/));
(async()=>{let calls=0;await assert.rejects(()=>ingest({lock:()=>{calls++}},items),/STOP_NOT_APPROVED/);assert.equal(calls,0);n++;console.log('PASS approval gate');
const ledger=[...s.ledger],history=[...s.history];const b={lock:async f=>f(),snapshot:async()=>({...s,ledger,history}),reserve:async r=>history.push(r),append:async r=>ledger.push(r),findByGuid:async g=>ledger.find(r=>r.guid===g),markComplete:async()=>{}};
assert.equal((await ingest(b,items,{approved:true})).inserted,2);n++;console.log('PASS mock append');
await assert.rejects(()=>ingest(b,items,{approved:true}),/STOP_DUPLICATE/);assert.equal(ledger.length,3);n++;console.log('PASS idempotent retry');
console.log(JSON.stringify({passed:n,failed:0}))})().catch(e=>{console.error(e);process.exitCode=1});
