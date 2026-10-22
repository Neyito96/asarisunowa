import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,guid,item} from './library-v3-harness.mjs';

const copyId='copy_sheet_for_approved_pilot_123456';
function fixture(){
 const h=harness(1),copy=harness(1);h.setup();copy.setup();h.ctx.registerLibraryV3BaselineAfterApproval();copy.ctx.registerLibraryV3BaselineAfterApproval();
 vm.runInContext(fs.readFileSync('scripts/google-apps-script/LibraryV3Morning.js','utf8'),h.ctx);
 const sourceSs=h.ctx.SpreadsheetApp.openById(),copySs=copy.ctx.SpreadsheetApp.openById(),opened=[];
 h.ctx.SpreadsheetApp.openById=id=>{opened.push(id);if(id==='test')return sourceSs;if(id===copyId)return copySs;throw Error('Unexpected sheet');};
 h.ctx.PropertiesService.getScriptProperties=()=>({getProperty:k=>h.props.get(k)||null,setProperty:()=>{throw Error('PROPERTIES_WRITE_FORBIDDEN');},deleteProperty:()=>{throw Error('PROPERTIES_DELETE_FORBIDDEN');}});
 const getCache=h.ctx.CacheService.getScriptCache;h.ctx.CacheService.getScriptCache=()=>({...getCache(),put:()=>{throw Error('READ_ONLY_CACHE_WRITE');}});
 h.ctx.ScriptApp.newTrigger=()=>{throw Error('TRIGGER_WRITE_FORBIDDEN');};h.ctx.ScriptApp.deleteTrigger=()=>{throw Error('TRIGGER_DELETE_FORBIDDEN');};
 h.items=[item(1)];const options={copySheetId:copyId,guid:guid(1),feedUrl:'https://rss.test/feed'};
 return {h,copy,sourceSs,copySs,opened,options};
}
test('copy preview performs no writes, preserves source Properties and pins the only Spotify test list',()=>{
 const f=fixture(),before=JSON.stringify([f.h.table,f.copy.table,[...f.h.props],[...f.copy.props]]);
 const r=f.h.ctx.previewLibraryV3CopyPilot(f.options);
 assert.equal(r.proposedRows,1);assert.equal(r.writes,0);assert.equal(r.spotifyTestPlaylistId,'4FiVIwysKDtLqEXfkfhu2O');
 assert.equal(JSON.stringify([f.h.table,f.copy.table,[...f.h.props],[...f.copy.props]]),before);
});
test('save appends exactly one row and sidecars in copy, then replay is zero; original Properties and data unchanged',()=>{
 const f=fixture(),original=JSON.stringify(f.h.table),props=[...f.h.props],copyProps=[...f.copy.props];
 const p=f.h.ctx.previewLibraryV3CopyPilot(f.options),options={...f.options,approvedPlanHash:p.planHash};
 const r=f.h.ctx.saveLibraryV3CopyPilotAfterApproval(options);
 assert.equal(r.writtenRows,1);assert.equal(r.spotifyPosts,0);assert.equal(f.copy.data.length,3);
 assert.equal(f.copy.data.at(-1)[6],guid(1));assert.equal(JSON.stringify(f.h.table),original);
 assert.deepEqual([...f.h.props],props);assert.deepEqual([...f.copy.props],copyProps);
 assert.equal(f.opened.at(-1),copyId);assert.equal(f.h.ctx.saveLibraryV3CopyPilotAfterApproval(options).writtenRows,0);
 assert.equal(f.copy.data.length,3);assert.equal(f.copy.history.length,2);
});
test('production counter is read but never advanced by copy pilot',()=>{
 const f=fixture();f.h.props.set('LIB_V3_LAST_ID','8000');const p=f.h.ctx.previewLibraryV3CopyPilot(f.options);
 assert.equal(f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:p.planHash}).id,'EP-08001');
 assert.equal(f.h.props.get('LIB_V3_LAST_ID'),'8000');
});
test('missing explicit approval hash cannot fetch or save',()=>{const f=fixture();assert.throws(()=>f.h.ctx.saveLibraryV3CopyPilotAfterApproval(f.options),/approval plan hash/);assert.equal(f.h.calls,0);assert.equal(f.copy.data.length,2);});
test('production and backup IDs are rejected before any network or sheet access',()=>{
 const f=fixture();for(const id of ['test','1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4','1CPHnvQd9JAYLACZqeSOJAy6IQ5ZLMbd8-FU6G6ugvaI'])assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot({...f.options,copySheetId:id}));
 assert.equal(f.opened.length,0);assert.equal(f.h.calls,0);
});
test('incomplete baseline and divergent copy block the pilot without modification',()=>{
 const f=fixture();f.h.props.set('LIB_V3_BASELINE','{"offset":1,"complete":false}');assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/baseline/);
 f.h.props.set('LIB_V3_BASELINE','{"offset":1,"complete":true}');f.copy.rows[0][2]='human edit';assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/diverged/);
 assert.equal(f.copy.data.length,2);
});
test('changed RSS after preview invalidates approval before reservation',()=>{
 const f=fixture(),p=f.h.ctx.previewLibraryV3CopyPilot(f.options);f.h.items=[{...item(1),title:'changed'}];
 assert.throws(()=>f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:p.planHash}),/Plan changed/);assert.equal(f.copy.data.length,2);
});
test('human exclusion, duplicate RSS GUID and RSS failure fail closed without clearing baseline',()=>{
 const f=fixture(),base=f.h.props.get('LIB_V3_BASELINE');f.h.ex.push([guid(1),'']);assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/excluded/);f.h.ex.pop();
 f.h.items=[item(1),item(1)];assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/duplicated/);f.h.items=[item(1)];f.h.code=503;assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/RSS unavailable/);
 assert.equal(f.h.props.get('LIB_V3_BASELINE'),base);assert.equal(f.copy.data.length,2);
});
test('failure after copy reservation cannot retry append or modify production counter',()=>{
 const f=fixture(),p=f.h.ctx.previewLibraryV3CopyPilot(f.options),sh=f.copySs.getSheetByName('エピソード台帳'),get=sh.getRange;
 sh.getRange=(r,...a)=>{const cell=get(r,...a);if(r===3)cell.setValues=()=>{throw Error('simulated append interruption');};return cell;};
 assert.throws(()=>f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:p.planHash}),/interruption/);sh.getRange=get;
 assert.equal(f.copy.data.length,2);assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/reserved/);
 assert.equal(f.h.props.has('LIB_V3_LAST_ID'),false);assert.equal(f.h.data.length,2);
});
test('copy guard cannot be applied to a caller context pointing to the original',()=>{
 const f=fixture(),c=f.h.ctx.libV3Context_(true);assert.throws(()=>f.h.ctx.libV3Append_(c,item(1),{url:f.options.feedUrl,show:'Show'},{allowNew:true,newAfter:'2026-10-16Z'},{complete:true},f.options),/scope changed/);assert.equal(f.h.data.length,2);
});
test('another writer holding lock prevents copy access and POST',()=>{const f=fixture();f.h.locked=true;assert.equal(f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:'reviewed'}).status,'BUSY');assert.equal(f.opened.length,0);assert.equal(f.h.calls,0);});

test('ambiguous cleaning evidence is rejected in preview before identity reservation',()=>{const f=fixture(),before=JSON.stringify(f.copy.table);f.h.ctx.libV3AutoCleanEvidence_=()=>({hold:true});assert.throws(()=>f.h.ctx.previewLibraryV3CopyPilot(f.options),/description requires review/);assert.equal(JSON.stringify(f.copy.table),before);});
test('history failure after append holds replay without a second row or hidden repair',()=>{const f=fixture(),p=f.h.ctx.previewLibraryV3CopyPilot(f.options);f.copySs.getSheetByName('自動補完・実行履歴').appendRow=()=>{throw Error('history unavailable');};assert.throws(()=>f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:p.planHash}),/history unavailable/);assert.equal(f.copy.data.length,3);assert.throws(()=>f.h.ctx.saveLibraryV3CopyPilotAfterApproval({...f.options,approvedPlanHash:p.planHash}),/history requires review/);assert.equal(f.copy.data.length,3);});

test('a live 55-column ledger preserves archive extensions and replays with zero rows',()=>{
 const f=fixture();for(const table of [f.h.data,f.copy.data])for(const row of table)while(row.length<55)row.push(row.length===51?'archive extension':'');
 const before=f.copy.data[1].slice(51),get=f.copySs.getSheetByName('エピソード台帳').getDataRange;
 f.copySs.getSheetByName('エピソード台帳').getDataRange=()=>({getValues:()=>get().getValues().map(r=>Array.from({length:55},(_,i)=>r[i]??''))});
 const p=f.h.ctx.previewLibraryV3CopyPilot(f.options),o={...f.options,approvedPlanHash:p.planHash};
 assert.equal(f.h.ctx.saveLibraryV3CopyPilotAfterApproval(o).writtenRows,1);assert.equal(f.h.ctx.saveLibraryV3CopyPilotAfterApproval(o).writtenRows,0);
 assert.deepEqual(f.copy.data[1].slice(51),before);assert.equal(f.copy.data.length,3);
});
