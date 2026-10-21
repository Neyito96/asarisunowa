import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
test('Phase8 diagnostic only reads both ledgers and current-account triggers',async()=>{
 const source=await readFile(new URL('../scripts/google-apps-script/LibraryPhase8ReadOnlyStatus.js',import.meta.url),'utf8');
 const headers=Array(15).fill('');headers[0]='台帳ID';headers[14]='音声URL';
 const row=(id,audio)=>{const r=Array(15).fill('');r[0]=id;r[14]=audio;return r;};
 const sourceRows=[headers,row('EP-00001',''),row('EP-00002','https://example.com/a.mp3')];
 const copyRows=[headers,row('EP-00001','https://example.com/b.mp3'),row('EP-00002','https://example.com/a.mp3')];
 const context=vm.createContext({console:{log:()=>{}},SpreadsheetApp:{openById:id=>({getSheetByName:()=>({getLastRow:()=>3,getRange:()=>({getValues:()=>(id.startsWith('1lLg')?sourceRows:copyRows).map(r=>[...r])})})})},ScriptApp:{getProjectTriggers:()=>[{getHandlerFunction:()=> 'ALIB_AUTO_tick'}]},ALIB_AUTO_tick:()=>{throw Error('Must never execute tick');}});
 vm.runInContext(source,context);const r=vm.runInContext('inspectPhase8LibraryTransferReadOnly()',context);
 assert.equal(r.sourceRows,2);assert.equal(r.copyAudioMissingInSource,1);assert.equal(r.audioDifferences,1);assert.equal(r.alibTriggersVisibleToCurrentAccount,1);assert.equal(r.writes,0);assert.equal(r.propertyWrites,0);assert.equal(r.triggerChanges,0);
});
