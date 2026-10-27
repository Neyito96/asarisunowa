'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const core=require('./LiteCore');
const code=fs.readFileSync(__dirname+'/LiteGas.gs','utf8');
const context=vm.createContext({});vm.runInContext(code,context);
const names=core.LITE_SHOWS,official=names.map((show,i)=>({show,url:i===4||i===6?'https://feeds.megaphone.fm/TASC5851398719':'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/x/podcast.rss'}));
const header=['番組・取得先','配信元','RSS等の確認件数','公式索引表示件数','取得可能な情報','遡及・欠損','配信ページURL','RSS・取得URL'];
const forbidden=['setValue','setValues','appendRow','insertRow','insertRows','deleteRow','deleteRows','clear','clearContent','setProperty','newTrigger','create','deleteTrigger','setFormula','setFormulas'];
function setup({badHeader=false,invalidXml=false,http=200,badGuid=false,redirect=false}={}){
 const calls=[],logs=[];const guard=new Proxy({}, {get(_,k){if(forbidden.includes(k))return()=>{throw Error('WRITE_API_USED:'+k)};return undefined}});
 const sourceRows=official.map(x=>[x.show,'','','','','','',x.url]);
 const sheet=(rows)=>new Proxy({
  getLastRow:()=>rows.length,getRange:(r,c,n,w)=>({getValues:()=>Array.from({length:n},(_,i)=>rows[r+i-1].slice(c-1,c-1+w))})
 },{get(t,k){if(forbidden.includes(k))return()=>{throw Error('WRITE_API_USED:'+k)};return t[k]}});
 const source=sheet([[...header],...sourceRows]);if(badHeader)sourceRows[0][0]='bad';
 const ledger=sheet([['台帳ID','番組','タイトル','配信日','媒体','取得元','外部ID'],['EP-1','','','','','','existing-guid']]);
 const deps={SpreadsheetApp:{openById:id=>{calls.push('openById:'+id);return new Proxy({getSheetByName:name=>name==='取得元一覧'?source:name==='エピソード台帳'?ledger:null},{get(t,k){if(forbidden.includes(k))return()=>{throw Error('WRITE_API_USED:'+k)};return t[k]}})}},UrlFetchApp:{fetch:(url,opts)=>{calls.push('GET:'+url);assert.equal(opts.followRedirects,false);return {getResponseCode:()=>redirect?302:http,getContentText:()=>invalidXml?'<html>oops</html>':'<rss><channel><item><guid>x</guid></item></channel></rss>'}}},XmlService:{parse:xml=>({getRootElement:()=>({getName:()=> 'rss',getChild:()=>({getChildren:()=>[({getChildText:k=>k==='guid'?(badGuid?'':'new-guid'):k==='title'?'safe title':''})]})})})},console:{log:x=>logs.push(x)},liteScan:core.liteScan};
 return {deps,calls,logs};
}
let count=0;function test(n,fn){fn();console.log('PASS',n);count++}
test('seven real configured sources are allowlisted',()=>{assert.equal(official.length,7);assert.ok(official.every(x=>core.validFeedUrl(x.url)))});
test('live-shaped A/H and ledger G are read only',()=>{const s=setup();const r=context.phase15LiteRunWithDeps(s.deps);assert.equal(r.rows.length,7);assert.equal(r.totals.unregisteredObserved,1);assert.equal(r.totals.duplicatesObserved,6);assert.equal(s.calls.filter(x=>x.startsWith('GET:')).length,7);assert.equal(s.logs.length,1);assert.ok(!s.logs[0].includes('safe title'))});
test('schema mismatch STOP',()=>{const s=setup();const original=s.deps.SpreadsheetApp.openById;s.deps.SpreadsheetApp.openById=id=>{const ss=original(id);return {getSheetByName:n=>{const sh=ss.getSheetByName(n);if(n!=='取得元一覧')return sh;return {getLastRow:sh.getLastRow,getRange:(r,c,count,width)=>({getValues:()=>r===1?[['changed','','','','','','','bad']]:sh.getRange(r,c,count,width).getValues()})}}}};assert.throws(()=>context.phase15LiteRunWithDeps(s.deps),/STOP_SOURCE_SCHEMA_UNVERIFIED/);assert.equal(s.calls.filter(x=>x.startsWith('GET:')).length,0)});
test('HTTP non200 status SOURCE_PENDING not zero',()=>{const r=context.phase15LiteRunWithDeps(setup({http:503}).deps);assert.equal(r.rows[0].status,'SOURCE_PENDING');assert.equal(r.rows[0].fetched,null)});
test('redirect is held and not followed',()=>{const r=context.phase15LiteRunWithDeps(setup({redirect:true}).deps);assert.equal(r.rows[0].status,'SOURCE_PENDING')});
test('HTML response SOURCE_PENDING',()=>{const r=context.phase15LiteRunWithDeps(setup({invalidXml:true}).deps);assert.equal(r.rows[0].status,'SOURCE_PENDING')});
test('missing guid SOURCE_PENDING',()=>{const r=context.phase15LiteRunWithDeps(setup({badGuid:true}).deps);assert.equal(r.rows[0].status,'SOURCE_PENDING')});
test('no write or trigger api exposed during adapter calls',()=>{const s=setup();context.phase15LiteRunWithDeps(s.deps);assert.ok(s.calls.every(c=>c.startsWith('GET:')||c.startsWith('openById:')))});
console.log(JSON.stringify({total:count,passed:count,failed:0}));
