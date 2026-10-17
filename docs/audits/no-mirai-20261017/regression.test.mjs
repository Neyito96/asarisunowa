// Local VM only. No live API, credentials, GAS runtime, or production writes.
// Run at repository root: node --test docs/audits/no-mirai-20261017/regression.test.mjs
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const temporaryRoot=fs.mkdtempSync(path.join(os.tmpdir(),'no-mirai-proposal-'));
const proposalDir=path.join(temporaryRoot,'scripts/google-apps-script/');
fs.mkdirSync(proposalDir,{recursive:true});
for(const file of ['PlaylistAutoRules.js','AutoUpdateAutomationV1.js','PlaylistAutoWrite.js']) {
  fs.copyFileSync('scripts/google-apps-script/'+file,path.join(proposalDir,file));
}
execFileSync('git',['apply',path.resolve('docs/audits/no-mirai-20261017/proposed-only.patch')],{cwd:temporaryRoot});
after(()=>fs.rmSync(temporaryRoot,{recursive:true,force:true}));
const dir = 'scripts/google-apps-script/';
const sources = ['PlaylistAutoRules.js', 'AutoUpdateAutomationV1.js', 'PlaylistAutoWrite.js'];
const title9 = '（ノーミライ #9）ひとりでやっとるチキンレースにライバル登場？というお話';
const id9 = '13zpJygdFNMMi6WtHbkocV';
const show = '0341I5UOUrJgm7KEvNGInZ';
function setup({items=[],existing=[],status=200,writeStatus=201,proposed=false,proposedRuntime=false}={}) {
  const calls = {gets:[],posts:[],sheetChecks:0,dateUpdates:[],logs:[]};
  const forbidden = new Proxy({}, {get(){throw Error('Forbidden live GAS access');}});
  const c = vm.createContext({
    Logger:{log(value){calls.logs.push(value);}}, ScriptApp:forbidden, PropertiesService:forbidden, SpreadsheetApp:forbidden,
    UrlFetchApp:{fetch(url, options={}) {
      if (options.method === 'post') {
        calls.posts.push({url,uris:JSON.parse(options.payload).uris});
        return {getResponseCode:()=>writeStatus,getContentText:()=>JSON.stringify({snapshot_id:'fixture'})};
      }
      calls.gets.push(url);
      return {getResponseCode:()=>status,getContentText:()=>JSON.stringify({items})};
    }},
    getAllSpotifyPlaylistItems_:()=>existing,
    assertAutoPlaylistSheetLinkBeforeWrite_:()=>{calls.sheetChecks++;},
    updatePlaylistLatestDate_:(playlist,date)=>{calls.dateUpdates.push({playlist,date});},
    getLatestReleaseDate_:episodes=>episodes.map(x=>x.release_date).sort().at(-1)
  });
  for (const f of sources) vm.runInContext(fs.readFileSync((proposedRuntime ? proposalDir : dir)+f,'utf8'),c,{filename:f});
  if(proposed) {
    const s=fs.readFileSync(proposalDir+'PlaylistAutoRules.js','utf8');
    const p=vm.createContext({}); vm.runInContext(s,p);
    c.matchesAutoPlaylistRule_=p.matchesAutoPlaylistRule_;
    c.getAutoPlaylistRuleByKey_=p.getAutoPlaylistRuleByKey_;
  }
  return {c,calls,rule:c.getAutoPlaylistRuleByKey_('no-mirai')};
}
const ep9={id:id9,uri:'spotify:episode:'+id9,name:title9,release_date:'2026-10-16'};
const run=x=>x.c.syncRecentManagedAutoPlaylistV1_(x.rule,'fixture-token-not-a-credential',{});
test('observed #7, #8, #9 titles pass existing numbered strategy',()=>{
 const {c,rule}=setup();for(const n of [7,8,9])assert.equal(c.matchesAutoPlaylistRule_({name:n===9?title9:`（ノーミライ #${n}）fixture`},rule),true);
});
for (const [title,expected] of [[title9,true],['ノーミライ 番外編',true],['農MUSICを語る',true],['猟LIFE の日常',true],['今夜は農music',true],['特集：猟ｌｉｆｅ',true],['ドーナツ通常回',false],['ノー ミライ',false],['',false]]) {
 test('proposed OR: '+(title||'<empty>'),()=>{const {c,rule}=setup({proposed:true});assert.equal(c.matchesAutoPlaylistRule_({name:title},rule),expected);});
}
test('description-only keyword cannot match proposed title rule',()=>{
 const {c,rule}=setup({proposed:true});assert.equal(c.matchesAutoPlaylistRule_({name:'別の回',description:'ノーミライ'},rule),false);
});
test('unchanged daily path sees zero candidates before #9 is returned',()=>{
 const x=setup();assert.equal(run(x).addedCount,0);assert.equal(x.calls.posts.length,0);
});
test('actual daily + actual addition helper POST exactly #9 once when returned',()=>{
 const x=setup({items:[ep9]});assert.equal(run(x).addedCount,1);
 assert.deepEqual(x.calls.posts[0].uris,[ep9.uri]);assert.equal(x.calls.posts.length,1);
 assert.equal(x.calls.sheetChecks,1);assert.equal(x.calls.dateUpdates.length,1);
 assert.equal(x.calls.gets[0],`https://api.spotify.com/v1/shows/${show}/episodes?market=JP&limit=20`);
});
test('existing #9 URI produces zero POSTs and no date update',()=>{
 const x=setup({items:[ep9],existing:[{item:{uri:ep9.uri}}]});assert.equal(run(x).addedCount,0);assert.equal(x.calls.posts.length,0);assert.equal(x.calls.dateUpdates.length,0);
});
test('show HTTP failure raises rather than successful zero',()=>{
 const x=setup({status:403});assert.throws(()=>run(x),/status=403/);assert.equal(x.calls.posts.length,0);
});
test('HTTP 200 without items is silently classified as successful zero (diagnostic gap)',()=>{
 const x=setup();x.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>'{}'});assert.equal(run(x).addedCount,0);
});
test('addition failure raises and cannot update latestDate',()=>{
 const x=setup({items:[ep9],writeStatus:403});assert.throws(()=>run(x),/一部失敗/);assert.equal(x.calls.dateUpdates.length,0);
});
test('proposed matching preserves original show scope; response embedded show is not a scope guard',()=>{
 const x=setup({proposed:true,items:[{...ep9,name:'番外編 農MUSIC'}]});assert.equal(run(x).addedCount,1);
 assert.equal(x.calls.gets.length,1);assert.ok(x.calls.gets[0].includes('/shows/'+show+'/'));
});
test('unrelated episode returned by same show is excluded',()=>{
 const x=setup({proposed:true,items:[{...ep9,name:'別の通常回'}]});assert.equal(run(x).addedCount,0);assert.equal(x.calls.posts.length,0);
});
test('daily fixed path does not fetch a second page even when rule.fetchAllPages is true',()=>{
 const x=setup({items:Array.from({length:20},(_,i)=>({id:'other'+i,name:'通常回'}))});assert.equal(x.rule.fetchAllPages,true);assert.equal(run(x).addedCount,0);assert.equal(x.calls.gets.length,1);
});
test('shared show cache is fetched once within one managed pass',()=>{
 const x=setup();const cache={};x.c.syncRecentManagedAutoPlaylistV1_(x.rule,'fixture',cache);x.c.syncRecentManagedAutoPlaylistV1_(x.rule,'fixture',cache);assert.equal(x.calls.gets.length,1);
});
test('kino existing matcher misses observed 見た title spelling (separate risk)',()=>{
 const x=setup();assert.equal(x.c.matchesAutoPlaylistRule_({name:'（動画見た？#50）ひたすらお便りに答えます'},x.c.getAutoPlaylistRuleByKey_('kino-douga')),false);
});
test('publication cutoff explains #7/#8 vs #9; UTC date alone loses scheduling detail',()=>{
 const cutoff=new Date('2026-10-17T04:38:52+09:00');
 assert.ok(new Date('2026-10-16T21:35:00Z')>cutoff);
 assert.equal(new Date('2026-10-09T19:00:00Z').toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}),'2026-10-10 04:00:00');
 assert.equal(new Date('2026-10-16T21:35:00Z').toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}),'2026-10-17 06:35:00');
});

test('actual proposed diagnostics identify fetch, diff and addition without token logging',()=>{
 const x=setup({proposedRuntime:true,items:[ep9]});assert.equal(run(x).addedCount,1);
 const structured=x.calls.logs.filter(s=>s.startsWith('{')).map(s=>JSON.parse(s));
 assert.deepEqual(structured.map(x=>x.event),['show_first_page_http','managed_show_fetch','managed_diff','managed_add_result']);
 assert.deepEqual(structured.find(x=>x.event==='managed_diff').missingIds,[id9]);
 assert.ok(x.calls.logs.every(s=>!s.includes('fixture-token-not-a-credential')));
});
test('actual proposed code rejects malformed 200 rather than silently succeeding',()=>{
 const x=setup({proposedRuntime:true});x.c.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>'{}'});assert.throws(()=>run(x),/items配列/);assert.equal(x.calls.posts.length,0);
});
