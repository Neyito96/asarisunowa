'use strict';
const assert=require('node:assert/strict');
const {EXPECTED,preview}=require('./live10-preview');
const candidates=EXPECTED.map(([show,guid,title],i)=>({show,guid,title,url:i===7||i===8?'':'https://example.org/'+i,pubDate:'2026-10-28T00:00:00Z'}));
const base={candidates,ledger:[{id:'EP-06632',guid:'old-guid'}],schemaVerified:true};
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name)}
test('ten candidates, no allocation or writes',()=>{const r=preview(base);assert.equal(r.items.length,10);assert.equal(r.writes,0);assert.equal(r.allocations,0);assert.equal(r.canWrite,false);assert.ok(r.items.every(x=>x.epId===null))});
test('two missing URLs held',()=>assert.equal(preview(base).items.filter(x=>x.decision==='HOLD_METADATA').length,2));
test('duplicate guid rejected',()=>assert.throws(()=>preview({...base,candidates:[...candidates.slice(0,9),candidates[0]]}),/STOP_LIVE10_IDENTITY/));
test('ledger guid match stops',()=>assert.equal(preview({...base,ledger:[...base.ledger,{id:'EP-1',guid:candidates[0].guid}]}).items[0].decision,'STOP_EXISTING_OR_COLLISION'));
test('title match stops',()=>assert.equal(preview({...base,ledger:[...base.ledger,{id:'EP-2',show:candidates[1].show,title:candidates[1].title}]}).items[1].decision,'STOP_EXISTING_OR_COLLISION'));
test('excluded blocks',()=>assert.equal(preview({...base,excluded:[{guid:candidates[0].guid}]}).items[0].decision,'EXCLUDED'));
test('held blocks',()=>assert.equal(preview({...base,held:[{guid:candidates[0].guid}]}).items[0].decision,'HOLD_POLICY'));
test('schema gate',()=>assert.throws(()=>preview({...base,schemaVerified:false}),/STOP_SCHEMA_UNVERIFIED/));
test('production anchor gate',()=>assert.throws(()=>preview({...base,ledger:[]}),/STOP_PRODUCTION_ANCHOR_UNVERIFIED/));
test('ID collision gate',()=>assert.throws(()=>preview({...base,reservedIds:['EP-06632']}),/STOP_ID_COLLISION/));
console.log(JSON.stringify({passed,total:10}));
