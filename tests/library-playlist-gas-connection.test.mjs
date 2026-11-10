import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../scripts/manual/SpotifyApprovedPilotReadOnly.gs',import.meta.url),'utf8');
const pid='4FiVIwysKDtLqEXfkfhu2O',sid='6opJ4Ig4s7CTY9fRqGEHd2';
function probe({codeAt='',http=403,existing=false,changed=false,owner='me',rawLog=false,network=false,invalid=false}={}){
 const calls=[],logs=[];
 const context={Logger:{log:s=>logs.push(s)},ScriptApp:{getScriptId:()=> '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9'},getSpotifyUserAccessToken:rawLog?function(){const s='Spotify refresh error: ';return s;}:()=> 'DO_NOT_LOG_TOKEN',UrlFetchApp:{fetch:(url,options)=>{
  calls.push({url,method:options.method});assert.equal(options.method,'get');assert.equal(options.followRedirects,false);
  if(network)throw Error('DO_NOT_LOG_TOKEN network');
  const path=new URL(url).pathname;const status=codeAt&&path.endsWith(codeAt)?http:200;
  let data;if(path.endsWith('/me'))data={id:'me'};
  else if(path.endsWith('/items'))data={total:existing?1:0,offset:0,items:existing?[{item:invalid?null:{type:'episode',id:sid}}]:[]};
  else if(path.includes('/episodes/'))data={id:sid,name:'題名',show:{id:'392h0MYfvMTndEVzf2cOvC'},release_date:'2026-10-06',release_date_precision:'day',is_playable:true};
  else data={id:pid,name:'リス田｜自動更新テスト',owner:{id:owner},snapshot_id:changed?'v'+calls.length:'same',public:false};
  return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(status===200?data:{error:'DO_NOT_LOG_TOKEN'})};
 }}};
 vm.createContext(context);vm.runInContext(source,context);const report=context.inspectApprovedSpotifyConnection20261022();assert.ok(!JSON.stringify({report,logs}).includes('DO_NOT_LOG_TOKEN'));return {report,calls,logs};
}
test('user connection/owner/full snapshot and target absent verified without writes',()=>{const {report:r,calls}=probe();assert.equal(r.status,'CONNECTED_READ_ONLY_OWNER');assert.equal(r.beforeCount,0);assert.equal(r.targetPresent,false);assert.equal(r.grantedScopes,'UNVERIFIED');assert.equal(r.spotifyPostAttempts,0);assert.ok(calls.every(c=>!c.url.includes('/search')&&c.method==='get'));});
test('existing target is observed, never appended',()=>{const r=probe({existing:true}).report;assert.equal(r.beforeCount,1);assert.equal(r.targetOccurrences,1);assert.equal(r.spotifyPostAttempts,0);});
for(const [suffix,n] of [['/me',1],['/'+pid,2],['/items',3]])test('403 at '+suffix+' stops all subsequent requests',()=>{const x=probe({codeAt:suffix});assert.equal(x.report.status,'STOP_403');assert.equal(x.calls.length,n);assert.equal(x.report.cause,'FORBIDDEN_ROOT_CAUSE_UNCONFIRMED');});
for(const http of [401,429])test(http+' is distinct and never retried',()=>{const x=probe({codeAt:'/me',http});assert.equal(x.report.status,'STOP_'+http);assert.equal(x.calls.length,1);});
test('unpatched raw-error auth helper is not invoked',()=>{const x=probe({rawLog:true});assert.equal(x.report.status,'HOLD_RAW_REFRESH_LOG');assert.equal(x.calls.length,0);});
test('snapshot change holds complete count',()=>{const x=probe({changed:true});assert.equal(x.report.status,'HOLD_PLAYLIST_CHANGED');assert.equal(x.report.beforeCount,null);});
test('network error is sanitized and stops without retry',()=>{const x=probe({network:true});assert.equal(x.report.status,'STOP_NETWORK');assert.equal(x.calls.length,1);});
test('accessible playlist owned by another user keeps writing held',()=>{assert.equal(probe({owner:'other'}).report.status,'CONNECTED_READ_ONLY_WRITE_HELD');});
test('unavailable playlist item is held, not counted as absent',()=>{const x=probe({existing:true,invalid:true});assert.equal(x.report.status,'HOLD_UNAVAILABLE_ITEM');assert.equal(x.report.targetPresent,null);});
