'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(__dirname+'/LiteLatestThreeGas.gs','utf8');
const ctx=vm.createContext({});vm.runInContext(src,ctx);
const names=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ニュースの学校','ドーナツ','報談'];
const source=[['番組・取得先','','','','','','','RSS・取得URL'],...names.map((s,i)=>[s,'','','','','','',i===4||i===6?'https://feeds.megaphone.fm/TASC123':'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/x'])];
const ledger=[['台帳ID','','','','','','外部ID','','元ページURL','公式個別URL'],['EP-06632','','','','','','g-1','','https://link/1','']];
function fake(opts={}){
 const calls=[],logs=[],rest={};
 return {calls,logs,deps:{ScriptApp:{getOAuthToken:()=>{calls.push('TOKEN');return 'SECRET'}},
 UrlFetchApp:{fetch:(url,arg)=>{calls.push([url,arg]);if(!url.startsWith('https://sheets.googleapis.com/v4/'))throw Error('UNEXPECTED_URL');
  assert.equal(arg.method,'get');assert.equal(arg.followRedirects,false);assert.equal(arg.headers.Authorization,'Bearer SECRET');
  return {getResponseCode:()=>opts.status||200,getContentText:()=>JSON.stringify({values:url.includes('%E5%8F%96%E5%BE%97')?(opts.badSchema?[['bad']]:source):ledger})};}},
 latestScan:({sources,ledgerRows,fetchFeed})=>{assert.equal(sources.length,7);assert.equal(ledgerRows[0].id,'EP-06632');return {mode:'LATEST3',sourceCompleteness:'OBSERVED_RSS_ONLY',totals:{selected:0},rows:[]};},
 fetchRss:()=>[],console:{log:x=>logs.push(x)} }};
}
let done=0;function test(name,fn){fn();done++;console.log('PASS',name)}
test('only two REST GETs with readonly result',()=>{const f=fake(),r=ctx.phase15LiteLatestThreeWithDeps(f.deps);assert.equal(r.mode,'LATEST3');assert.equal(f.calls.filter(x=>Array.isArray(x)).length,2)});
test('bearer auth only, no token logged',()=>{const f=fake();ctx.phase15LiteLatestThreeWithDeps(f.deps);assert.ok(f.logs.every(x=>!x.includes('SECRET')))});
test('forbidden SpreadsheetApp and write API absent',()=>{const f=fake();ctx.phase15LiteLatestThreeWithDeps(f.deps);assert.ok(f.calls.every(x=>x==='TOKEN'||Array.isArray(x)))});
test('HTTP 403 stops, no scope escalation',()=>assert.throws(()=>ctx.phase15LiteLatestThreeWithDeps(fake({status:403}).deps),/STOP_SHEETS_READ_HTTP_403/));
test('source header fails closed',()=>assert.throws(()=>ctx.phase15LiteLatestThreeWithDeps(fake({badSchema:true}).deps),/STOP_SCHEMA_UNVERIFIED/));
test('no setting/trigger or cell mutation',()=>{const f=fake();ctx.phase15LiteLatestThreeWithDeps(f.deps);assert.equal(f.calls.length,3)});
console.log(JSON.stringify({total:done,passed:done,failed:0}));
