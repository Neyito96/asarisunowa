import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const playlist='P'.repeat(22), candidate='Z'.repeat(22);
const id=i=>String(i).padStart(22,'0');
class Sheet {
  constructor(rows){this.rows=structuredClone(rows);this.capacity=1000;}
  getLastRow(){return this.rows.length;}
  getMaxRows(){return this.capacity;}
  getLastColumn(){return Math.max(...this.rows.map(r=>r.length),0);}
  insertRowsAfter(_,n){this.capacity+=n;}
  getRange(r,c,n,m){const self=this;return {
    getValues(){return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.rows[r+i-1]?.[c+j-1]??''));},
    getDisplayValues(){return this.getValues().map(row=>row.map(String));},
    setValues(rows){for(let i=0;i<n;i++){self.rows[r+i-1]??=[];for(let j=0;j<m;j++)self.rows[r+i-1][c+j-1]=rows[i][j];}}
  };}
}
function fixture(count=0){
  const headers=Array(39).fill('');Object.entries({0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時',6:'外部ID',11:'Spotify個別URL',22:'概要清掃済み',23:'出演者・スタッフ',38:'人間除外'}).forEach(([i,v])=>headers[i]=v);
  const row=Array(39).fill('');Object.entries({0:'EP-00001',1:'テスト番組',2:'COPY連載 #1',3:'2026/11/6 4:00',6:'copy-guid-1',11:'https://open.spotify.com/episode/'+candidate}).forEach(([i,v])=>row[i]=v);
  const state=new Sheet([['key','version','part','json']]);
  const requests=new Sheet([Array(9).fill('header'),['2026/11/6','https://open.spotify.com/playlist/'+playlist,'COPY','TEST','DO_NOT_PERSIST','COPY連載','','確認待ち','方式: series / test']]);
  const ledger=new Sheet([headers,row]);
  const books={'copy-state':{P25_STATE:state},'copy-requests':{'自動更新申請':requests},'copy-ledger':{'エピソード台帳':ledger,'削除・除外履歴':new Sheet([['GUID','EP-ID']])}};
  const f={playlistName:'[P25-COPY] test',members:Array.from({length:count},(_,i)=>id(i)),calls:[],posts:0,snapshot:1,failOffset:null,changeSnapshot:false,emptyPage:false};let serial=0,locked=false;
  const context=vm.createContext({
    ScriptApp:{getScriptId:()=> 'copy-script'},
    SpreadsheetApp:{openById:key=>{assert.ok(books[key],'must never access production');return {getSheetByName:name=>books[key][name]};},flush(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>{assert.equal(key,'P25_COPY_SPOTIFY_ACCESS_TOKEN');return 'fixture-only';}})},
    Utilities:{getUuid:()=>String(++serial)},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    UrlFetchApp:{fetch:(url,options)=>{
      const u=new URL(url);assert.equal(u.origin,'https://api.spotify.com');
      if(u.pathname==='/v1/episodes'){f.calls.push({method:options.method,path:u.pathname,query:u.search});const eids=u.searchParams.get('ids').split(',');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({episodes:eids.map(i=>i===candidate?{id:i,is_playable:true}:null)}),getAllHeaders:()=>({})};}
      assert.ok(u.pathname.startsWith('/v1/playlists/'+playlist));
      f.calls.push({method:options.method,path:u.pathname,query:u.search});
      const response=(code,value)=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(value),getAllHeaders:()=>({'Retry-After':'120'})});
      if(options.method==='post') {const ids=JSON.parse(options.payload).uris.map(x=>x.split(':').at(-1));assert.equal(ids.length,1);assert.equal(ids[0],candidate);f.posts++;f.members.push(...ids);f.snapshot++;return response(201,{snapshot_id:String(f.snapshot)});}
      if(u.pathname.endsWith('/'+playlist)&&u.searchParams.get('fields')==='name')return response(200,{name:f.playlistName});
      if(u.searchParams.has('fields'))return response(200,{snapshot_id:String(f.changeSnapshot?++f.snapshot:f.snapshot)});
      const limit=Number(u.searchParams.get('limit')),offset=Number(u.searchParams.get('offset'));assert.equal(limit,50,'Spotify maximum page size');
      if(offset===f.failOffset)return response(429,{});
      const items=f.emptyPage?[]:f.members.slice(offset,offset+limit).map(id=>({item:{id,type:'episode'}}));
      return response(200,{items,next:offset+items.length<f.members.length?'/next':null});
    }}
  });
  for(const name of ['P25LibraryPipeline.js','P25CopyAdapter.js'])vm.runInContext(fs.readFileSync('scripts/google-apps-script/'+name,'utf8'),context);
  f.config={environment:'COPY',copyScriptId:'copy-script',stateSheetId:'copy-state',requestSheetId:'copy-requests',ledgerSheetId:'copy-ledger',copyPlaylistIds:[playlist],legacyWriterDisabled:true,write:true,maxAdditions:1};
  f.context=context;f.io=()=>context.p25CopyIo_(f.config);f.run=()=>context.P25_RUN_COPY(f.config);f.inspect=()=>context.P25_INSPECT_COPY(f.config,playlist);f.stateSheet=state;f.requests=requests;return f;
}
for(const count of [51,101])test(`real COPY readMembership code fetches all ${count} episodes`,()=>{
 const f=fixture(count),actual=Array.from(f.io().readMembership(playlist));assert.deepEqual(actual,f.members);
 const pages=f.calls.filter(c=>c.path.endsWith('/items'));assert.deepEqual(pages.map(p=>Number(new URLSearchParams(p.query).get('offset'))),count===51?[0,50]:[0,50,100]);
 assert.equal(f.calls.filter(c=>c.query.includes('snapshot_id')).length,2);assert.equal(f.posts,0);
});
test('COPY adapter E2E: nine-column receipt, ledger, 51 existing, one add, journal readback, rerun zero',()=>{
 const f=fixture(51);f.run();let s=f.inspect();assert.equal(s.receipt,'ACCEPTED');assert.equal(s.plan.candidates.length,1);assert.equal(s.plan.holds[0].reason,'REVIEW_REQUIRED');assert.equal(f.posts,0);
 f.context.P25_APPROVE_COPY(f.config,playlist,s.plan.candidates.map(c=>({...c,revision:s.rule.revision})));
 f.run();s=f.inspect();assert.equal(f.posts,1);assert.equal(f.members.length,52);assert.equal(s.spotify,'VERIFIED');assert.equal(s.pending.length,0);
 f.run();assert.equal(f.posts,1);assert.equal(f.members.filter(x=>x===candidate).length,1);assert.equal(f.inspect().spotify,'VERIFIED');assert.equal(f.inspect().publication,'PENDING');
 assert.ok(!JSON.stringify(f.stateSheet.rows).includes('DO_NOT_PERSIST'));
});
test('page two 429 never returns a partial membership',()=>{const f=fixture(51);f.failOffset=50;assert.throws(()=>f.io().readMembership(playlist),e=>e.status===429);assert.equal(f.posts,0);});
test('snapshot drift rejects complete but inconsistent pagination',()=>{const f=fixture(51);f.changeSnapshot=true;assert.throws(()=>f.io().readMembership(playlist),/MEMBERSHIP_CHANGED/);});
test('empty page with next cannot loop',()=>{const f=fixture(51);f.emptyPage=true;assert.throws(()=>f.io().readMembership(playlist),/MEMBERSHIP_PAGINATION/);});
test('latest human-deleted request prevents older active request resurrection',()=>{const f=fixture();const last=[...f.requests.rows[1]];last[7]='人間削除';f.requests.rows.push(last);f.run();assert.equal(f.calls.length,0);assert.equal(f.posts,0);});

// ---- COPY completion trials: read-only ledger search / ID check / preview, markers and write scope ----
test('COPY refuses a playlist whose name lacks the COPY marker (production ID pasted by mistake)',()=>{
 const f=fixture(1);f.playlistName='朝リスの本番プレイリスト';
 assert.throws(()=>f.io().readMembership(playlist),/COPY_PLAYLIST_NAME_MARKER_REQUIRED/);
 assert.equal(f.posts,0);
});
test('a writing COPY config must be one playlist, legacy writer disabled, one episode per run',()=>{
 for(const patch of [{copyPlaylistIds:[playlist,'Q'.repeat(22)]},{legacyWriterDisabled:false},{maxAdditions:2}]){
  const f=fixture(1);Object.assign(f.config,patch);
  assert.throws(()=>f.io(),/COPY_WRITE_SCOPE_REQUIRED/);
 }
});
test('COPY add refuses more than one episode',()=>{
 const f=fixture(1);assert.throws(()=>f.io().add(playlist,[candidate,'Y'.repeat(22)]),/COPY_SINGLE_EPISODE_ONLY/);assert.equal(f.posts,0);
});
test('COPY search and ID check are read-only; AM exclusion and the exclusion sheet are honoured',()=>{
 const f=fixture(0);f.config.write=false;
 const found=JSON.parse(JSON.stringify(f.context.P25_SEARCH_COPY(f.config,{type:'series',keywords:'COPY連載'})));
 assert.equal(found.episodes[0].status,'READY');
 const ids=JSON.parse(JSON.stringify(f.context.P25_VERIFY_IDS_COPY(f.config,['EP-00001','EP-99999'])));
 assert.deepEqual(ids.notVerifiable,['EP-99999']);
 assert.equal(f.posts,0);
 assert.equal(f.calls.every(c=>c.method!=='post'),true);
 assert.deepEqual(ids.ok,['EP-00001']);
});
test('COPY preview shows the revision to approve and writes nothing',()=>{
 const f=fixture(0);f.config.write=false;f.config.autoAdd={since:'2026-11-05',revision:'x',shows:['テスト番組']};
 const r=JSON.parse(JSON.stringify(f.context.P25_PREVIEW_COPY(f.config,playlist)));
 assert.equal(typeof r.ruleRevision,'string');
 assert.equal(f.posts,0);assert.equal(f.stateSheet.rows.length,1);   // journal untouched
});
test('COPY auto-add (config.autoAdd) adds at most one new episode of the approved show',()=>{
 const f=fixture(0);
 const rev=f.context.P25_PREVIEW_COPY(Object.assign({},f.config,{write:false}),playlist).ruleRevision;
 f.config.autoAdd={since:'2026-11-05',revision:rev,shows:['テスト番組']};
 const r=f.run();
 assert.equal(f.posts,1);assert.equal(r.results[0].addedVerified,1);
 assert.equal(f.run().results[0].spotify,'VERIFIED');assert.equal(f.posts,1);
});
test('COPY with AM 人間除外 set never adds the episode',()=>{
 const f=fixture(0);
 const sheet=f.context.SpreadsheetApp.openById('copy-ledger').getSheetByName('エピソード台帳');
 sheet.rows[1][38]='除外';
 const rev=f.context.P25_PREVIEW_COPY(Object.assign({},f.config,{write:false}),playlist).ruleRevision;
 f.config.autoAdd={since:'2026-11-05',revision:rev,shows:['テスト番組']};
 f.run();
 assert.equal(f.posts,0);
});
test('COPY session: the one-add entry is unarmed by default and the config ships with write off',()=>{
 const src=fs.readFileSync('scripts/google-apps-script/P25CopySession20261107.js','utf8');
 assert.match(src,/write:false,legacyWriterDisabled:false,maxAdditions:1/);
 assert.match(src,/copyPlaylistIds:\[\]/);
 assert.match(src,/autoAdd:null/);
 assert.match(src,/COPY_ONE_ADD_NOT_ARMED/);
 assert.doesNotMatch(src,/write:true/);
});
