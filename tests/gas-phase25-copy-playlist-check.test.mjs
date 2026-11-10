import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const ID='1N0T7tMxPMKxXy77C0RPMw',OWNER='owner-x';
function ctx(extra={}){const c=vm.createContext({console:{log(){}},...extra});vm.runInContext(fs.readFileSync('scripts/google-apps-script/P25CopyPlaylistCheck.js','utf8'),c);return c;}
const exp={playlistId:ID,ownerId:OWNER,name:'n'};
const ok={id:ID,name:'n',public:false,collaborative:false,owner:{id:OWNER}};
test('PASS only on exact id/owner/private/allowlist',()=>{
  const c=ctx();assert.equal(c.p25CopyPlaylistVerify_(exp,ok,[ID]).status,'PASS');
});
test('every mismatch or unreadable value stops',()=>{
  const c=ctx();const v=(m,a=[ID],e=exp)=>c.p25CopyPlaylistVerify_(e,m,a);
  assert.equal(v({...ok,id:'x'.repeat(22)}).status,'STOP');
  assert.equal(v({...ok,owner:{id:'other'}}).status,'STOP');
  assert.equal(v({...ok,public:true}).status,'STOP');
  assert.equal(v({...ok,public:null}).status,'STOP');
  assert.equal(v({...ok,collaborative:true}).status,'STOP');
  assert.equal(v(null).status,'STOP');
  assert.equal(v(ok,[]).status,'STOP');
  assert.equal(v(ok,[ID,'y'.repeat(22)]).status,'STOP');
  assert.equal(v(ok,[ID],{...exp,ownerId:''}).status,'STOP');
});
test('name difference is informational only',()=>{
  const r=ctx().p25CopyPlaylistVerify_(exp,{...ok,name:'renamed'},[ID]);assert.equal(r.status,'PASS');assert.ok(r.problems.includes('NAME_DIFFERS_INFO'));
});
function entry(code,body,props={P25_COPY_SPOTIFY_ACCESS_TOKEN:'SECRETTOKEN'}){
  const calls=[],logs=[];
  const c=ctx({console:{log:m=>logs.push(m)},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null})},
    UrlFetchApp:{fetch:(u,o)=>{calls.push({u,o});return{getResponseCode:()=>code,getContentText:()=>JSON.stringify(body)};}},
    p25CopySessionConfig20261107_:()=>({copyPlaylistIds:[ID],expectedOwnerId:OWNER}),p25CopyIo_:()=>({})});
  return {c,calls,logs};
}
test('entry uses GET only, no token in logs/result, stops on HTTP errors and missing token',()=>{
  const e=entry(200,ok);const r=e.c.P25_COPY_VERIFY_PLAYLIST_20261107();
  assert.equal(r.status,'PASS');assert.equal(e.calls.length,1);assert.equal(e.calls[0].o.method,'get');
  assert.ok(!JSON.stringify(r).includes('SECRETTOKEN'));assert.ok(!e.logs.join('').includes('SECRETTOKEN'));
  for(const code of [401,403,429,500]){const x=entry(code,{});assert.equal(x.c.P25_COPY_VERIFY_PLAYLIST_20261107().problems.join(),'HTTP_'+code);}
  assert.throws(()=>entry(200,ok,{}).c.P25_COPY_VERIFY_PLAYLIST_20261107(),/COPY_TOKEN_REQUIRED/);
  assert.equal(entry(200,{...ok,public:true}).c.P25_COPY_VERIFY_PLAYLIST_20261107().status,'STOP');
});
