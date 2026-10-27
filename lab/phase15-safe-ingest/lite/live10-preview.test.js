'use strict';
const assert=require('node:assert/strict'),{GUIDS,prepareLive10}=require('./live10-preview');
let n=0;function t(name,fn){fn();n++;console.log('PASS',name)}
const base={ledger:[{id:'EP-06632',guid:'a07f0210-b98d-4e6d-9d21-b4c9005ccdfc'}]};
t('exactly ten candidates',()=>assert.equal(prepareLive10(base).rows.length,10));
t('production EP-06632 never reused',()=>assert.ok(prepareLive10(base).rows.every(x=>x.proposedEpId===null)));
t('no writer available even all booleans true',()=>{const r=prepareLive10({...base,sourceVerified:true,writerExclusive:true,snapshotVerified:true});assert.equal(r.productionGo,false);assert.equal(r.writeEnabled,false)});
t('same GUID ledger forces existing',()=>{const r=prepareLive10({ledger:[...base.ledger,{id:'EP-06633',guid:GUIDS[0][2]}]});assert.equal(r.rows[0].status,'EXISTING_OR_RESERVED')});
t('reserved history forces existing',()=>assert.equal(prepareLive10({history:[{id:'EP-06633',guid:GUIDS[0][2],state:'RESERVED'}]}).rows[0].status,'EXISTING_OR_RESERVED'));
t('excluded candidate never ready',()=>assert.equal(prepareLive10({exclusions:[GUIDS[0][2]]}).rows[0].status,'EXCLUDED'));
t('held candidate stays held',()=>assert.equal(prepareLive10({holds:[GUIDS[1][2]]}).rows[1].status,'HOLD'));
t('school missing official link remains hold',()=>assert.equal(prepareLive10(base).rows[7].reason,'OFFICIAL_ITEM_LINK_MISSING'));
t('URL identity conflict holds',()=>{const g=GUIDS[0][2];assert.equal(prepareLive10({ledger:[{id:'EP-00010',guid:'other',officialUrl:'https://url'}],urlByGuid:{[g]:'https://url'}}).rows[0].status,'HOLD')});
t('history id conflict blocks',()=>assert.ok(prepareLive10({ledger:base.ledger,history:[{id:'EP-06632',guid:'other'}]}).warnings.includes('HISTORY_ID_CONFLICT')));
t('idempotent preview no mutations',()=>{const r=prepareLive10(base);assert.deepEqual(r,prepareLive10(base))});
console.log(JSON.stringify({total:n,passed:n,failed:0}));
