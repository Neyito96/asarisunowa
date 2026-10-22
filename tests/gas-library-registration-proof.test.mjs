import test from'node:test';import assert from'node:assert/strict';import{harness,item}from'./library-v3-harness.mjs';
function registered(){const h=harness(1);h.setup();h.enable({allowNew:true});h.ctx.registerLibraryV3BaselineAfterApproval();h.items=[item(1)];h.run(true);assert.equal(h.run(true).newIds.length,1);return h;}
function proof(h){return JSON.parse(h.table['図書館V3・項目状態'].find(r=>r[0]==='EP-00002')[1]).identity;}
test('V3 verified blank fill refreshes row proof and retains original registration timestamp',()=>{const h=registered(),before=proof(h).slice();assert.equal(h.run(true).status,'CHECKPOINTED');const after=proof(h);assert.equal(after[0],'VERIFIED');assert.equal(after[2],h.ctx.libV3Hash_(h.data[2]));assert.equal(after[6],before[6]);assert.equal(after[5],'RSS_registered');assert.notEqual(after[2],before[2]);h.run(true);assert.equal(h.data.length,3);});
test('concurrent human edit after cell write is never adopted into registration proof',()=>{const h=registered(),before=proof(h).slice(),ledger=h.ctx.SpreadsheetApp.openById().getSheetByName('エピソード台帳'),get=ledger.getRange;let injected=false;
 ledger.getRange=(row,col,...args)=>{const range=get(row,col,...args);if(row===3&&range.setValue){const set=range.setValue;range.setValue=v=>{set(v);if(!injected){injected=true;h.data[2][23]='Human edit';}};}return range;};
 assert.equal(h.run(true).status,'FAILED');assert.equal(injected,true);assert.equal(proof(h)[2],before[2]);assert.notEqual(proof(h)[2],h.ctx.libV3Hash_(h.data[2]));
});
