import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const ID='1N0T7tMxPMKxXy77C0RPMw',EP='2bQehZDGaWmylhP7x6iyeR';
function ctx(extra={}){const c=vm.createContext({console:{log(){}},...extra});vm.runInContext(fs.readFileSync('scripts/google-apps-script/P25CopyPlaylistCheck.js','utf8'),c);return c;}
const norm=o=>JSON.parse(JSON.stringify(o)); // cross-realm safe
const T={playlistId:ID,episodeId:EP};
function fake(over={}){
  const s={me:{code:200,body:{id:'u1'}},meta:{code:200,body:{id:ID,public:false,collaborative:false,owner:{id:'u1'},snapshot_id:'s1'}},
    items:{code:200,body:{items:[],next:null}},snap:{code:200,body:{snapshot_id:'s1'}},...over};
  const calls=[];
  const get=p=>{calls.push(p);if(p==='me')return s.me;if(p.includes('/items'))return s.items;if(p.endsWith('snapshot_id')&&!p.includes('owner'))return s.snap;return s.meta;};
  return {get,calls};
}
const run=(over,ids=[ID])=>norm(ctx().p25CopyPlaylistCheckRun_(T,ids,fake(over).get));
test('PASS: owner derived from /me, private, non-collaborative, stable snapshot, counts only',()=>{
  const r=run();assert.equal(r.status,'PASS');assert.equal(r.memberCount,0);assert.equal(r.targetPresent,false);assert.equal(r.spotifyWrite,false);
});
test('membership counted and target detection',()=>{
  const r=run({items:{code:200,body:{items:[{item:{id:EP}},{track:{id:'z'}}],next:null}}});assert.equal(r.memberCount,2);assert.equal(r.targetPresent,true);
});
test('STOP cases',()=>{
  const p=r=>r.problems.join();
  assert.match(p(run({meta:{code:200,body:{id:ID,public:false,collaborative:false,owner:{id:'other'},snapshot_id:'s1'}}})),/OWNER_NOT_AUTHORIZED_ACCOUNT/);
  assert.match(p(run({meta:{code:200,body:{id:ID,public:true,collaborative:false,owner:{id:'u1'},snapshot_id:'s1'}}})),/NOT_PRIVATE/);
  assert.match(p(run({meta:{code:200,body:{id:ID,public:false,owner:{id:'u1'},snapshot_id:'s1'}}})),/COLLABORATIVE_OR_UNKNOWN/);
  assert.match(p(run({meta:{code:200,body:{id:'x',public:false,collaborative:false,owner:{id:'u1'},snapshot_id:'s1'}}})),/ID_MISMATCH/);
  assert.match(p(run({snap:{code:200,body:{snapshot_id:'s2'}}})),/SNAPSHOT_CHANGED/);
  assert.match(p(run({me:{code:200,body:{}}})),/ME_UNAVAILABLE/);
  assert.match(p(run({items:{code:200,body:{items:[{item:null}],next:null}}})),/MEMBERSHIP_UNAVAILABLE/);
  assert.match(p(run({},[])),/ALLOWLIST_MISMATCH/);
  assert.match(p(run({},[ID,'y'.repeat(22)])),/ALLOWLIST_MISMATCH/);
  for(const code of [401,403,429,500]){assert.equal(run({me:{code,body:null}}).problems.join(),'HTTP_'+code);assert.equal(run({meta:{code,body:null}}).problems.join(),'HTTP_'+code);}
});
test('pagination follows next and only GET paths are used',()=>{
  let n=0;const calls=[];
  const get=p=>{calls.push(p);if(p==='me')return{code:200,body:{id:'u1'}};if(p.includes('/items')){n++;return{code:200,body:{items:[{item:{id:'a'+n}}],next:n<2?'x':null}};}
    if(p.includes('fields=id,'))return{code:200,body:{id:ID,public:false,collaborative:false,owner:{id:'u1'},snapshot_id:'s1'}};return{code:200,body:{snapshot_id:'s1'}};};
  const r=norm(ctx().p25CopyPlaylistCheckRun_(T,[ID],get));assert.equal(r.memberCount,2);assert.equal(r.status,'PASS');
});
function entry(code,props={P25_COPY_SPOTIFY_ACCESS_TOKEN:'SECRETTOKEN'}){
  const methods=[],logs=[];
  const c=ctx({console:{log:m=>logs.push(m)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null})},
    UrlFetchApp:{fetch:(u,o)=>{methods.push(o.method);return{getResponseCode:()=>code,getContentText:()=>'{}'};}},
    p25CopySessionConfig20261107_:()=>({copyPlaylistIds:[ID]}),p25CopyIo_:()=>({})});
  return {c,methods,logs};
}
test('entry: GET only, no token leak, stops on HTTP failure and missing token',()=>{
  const e=entry(401);const r=norm(e.c.P25_COPY_VERIFY_PLAYLIST_20261107());
  assert.equal(r.status,'STOP');assert.ok(e.methods.every(m=>m==='get'));
  assert.ok(!JSON.stringify(r).includes('SECRETTOKEN')&&!e.logs.join('').includes('SECRETTOKEN'));
  assert.throws(()=>entry(200,{}).c.P25_COPY_VERIFY_PLAYLIST_20261107(),/COPY_TOKEN_REQUIRED/);
});
