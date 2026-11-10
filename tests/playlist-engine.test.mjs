import test from 'node:test';import assert from 'node:assert/strict';
import {parseConfig,writePermission,CONFIG_HEADERS} from '../public/library/playlist-config.mjs';
import {matchEpisode,enqueue,newQueue,planRule,reconcile,newLedger,readPlaylist,runEngine,intakeFormPost,reinstate,SKIP} from '../public/library/playlist-engine.mjs';
import {memoryStore} from '../public/library/journal-lease.mjs';
import {ApiError} from '../public/library/fill-queue.mjs';
const PL1='a'.repeat(22),PL2='b'.repeat(22),SHOW='S1';
const row=(o={})=>[o.key??'k1','TRUE',o.pl??PL1,'名',o.type??'title-text',o.show??SHOW,o.kw??'動画みた',o.ex??'',o.scope??'name','any',o.strat??'',o.appr??'approved',o.stage??'incremental',o.mode??'LIVE',o.writer??'engine',o.cap??'10',o.rev??''];
const cfg=(...rows)=>parseConfig(rows,{strategies:{safe:e=>e.name.includes('確')}});
const ep=(id,name,date='2026-11-01',extra={})=>({id,uri:'spotify:episode:'+id,name,release_date:date,showId:SHOW,...extra});
const fakeSpotify=(uris=[],pages=1)=>{const calls={add:[],list:0};return {calls,async listPage(pl,cur){calls.list++;const n=Number(cur||0);const per=Math.ceil(uris.length/pages)||1;return {items:uris.slice(n*per,(n+1)*per),next:n+1<pages?String(n+1):null};},async addItems(pl,u){calls.add.push([pl,u]);uris.push(...u);}};};
const items=(...eps)=>{const q=newQueue();eps.forEach(e=>enqueue(q,{episode:e,origin:'rss',at:1}));return q;};
const HO={k1:{readOnlyDiffMatch:true,legacyDisabledConfirmedBy:'admin',legacyDisabledConfirmed:true}};

test('adding ONE config row creates a working playlist rule (no code, no new trigger)',async()=>{
  const {rules,errors}=cfg(row(),row({key:'k2',pl:PL2,kw:'ポリレビ'}));
  assert.equal(errors.length,0);assert.equal(rules.length,2);
  const sp=fakeSpotify([]);const store=memoryStore();
  const q=items(ep('e1','木下君、あの動画みた？#1'),ep('e2','ポリレビ#3'),ep('e3','無関係'));
  const r=await runEngine({rules,queue:q,spotify:sp,state:{handoff:{...HO,k2:HO.k1}},store,runId:'r1',now:1e9,globalMode:'LIVE'});
  assert.equal(r.status,'OK');const by=Object.fromEntries(r.results.map(x=>[x.key,x]));
  assert.deepEqual(by.k1.candidates,['spotify:episode:e1']);assert.deepEqual(by.k2.candidates,['spotify:episode:e2']);assert.equal(sp.calls.add.length,2);
});
test('invalid rows are blocked individually; duplicate playlist targets are both blocked; no-condition rows rejected',()=>{
  const {rules,errors}=cfg(row(),row({key:'dup',pl:PL1}),row({key:'bad',pl:'x',kw:''}),row({key:'th',type:'theme',rev:'FALSE',pl:PL2}));
  const by=Object.fromEntries(rules.map(r=>[r.key,r.blocked]));
  assert.ok(by.k1.includes('PLAYLIST_DUPLICATE_ENABLED')&&by.dup.includes('PLAYLIST_DUPLICATE_ENABLED'));
  assert.ok(by.bad.includes('PLAYLIST_ID_INVALID')&&by.bad.includes('NO_MATCH_CONDITION'));assert.ok(by.th.includes('THEME_REQUIRES_REVIEW'));
  assert.ok(errors.length>=3);
});
test('DRY_RUN never writes; permission explains why (legacy writer / not approved / handoff)',async()=>{
  const {rules}=cfg(row({writer:'legacy'}),row({key:'k2',pl:PL2,appr:'requested'}),row({key:'k3',pl:'c'.repeat(22)}));
  assert.deepEqual(writePermission(rules[0],{globalMode:'LIVE'}).why,['WRITER_IS_LEGACY']);
  assert.ok(writePermission(rules[1],{globalMode:'LIVE'}).why.includes('NOT_APPROVED'));
  assert.deepEqual(writePermission(rules[2],{globalMode:'LIVE'}).why,['HANDOFF_NOT_CONFIRMED']);
  const sp=fakeSpotify([]);const r=await runEngine({rules,queue:items(ep('e1','動画みた')),spotify:sp,store:memoryStore(),runId:'r',now:1,globalMode:'LIVE'});
  assert.equal(sp.calls.add.length,0);assert.ok(r.results.every(x=>x.status==='DRY_RUN'));
  const d=await runEngine({rules:cfg(row()).rules,queue:items(ep('e1','動画みた')),spotify:sp,state:{handoff:HO},store:memoryStore(),runId:'r',now:1,globalMode:'DRY_RUN'});
  assert.equal(sp.calls.add.length,0);assert.equal(d.results[0].candidates.length,1);
});
test('human-removed episodes are never re-added (needs 2 complete snapshots) and reinstate is explicit only',async()=>{
  const {rules}=cfg(row());const rule=rules[0];let led=newLedger();
  const q=items(ep('e1','動画みた1'),ep('e2','動画みた2'));
  let p=planRule(rule,{items:q?Object.values(q.items):[],playlist:{complete:true,uris:['spotify:episode:e1','spotify:episode:e2']},ledger:led,now:1});led=p.ledger;assert.equal(p.adds.length,0);
  p=planRule(rule,{items:Object.values(q.items),playlist:{complete:true,uris:['spotify:episode:e1']},ledger:led,now:2});led=p.ledger;
  assert.equal(p.adds.length,0);assert.ok(p.skipped.some(s=>s.reason===SKIP.SUSPECT)); // 1回目は疑いのみ→それでも戻さない
  p=planRule(rule,{items:Object.values(q.items),playlist:{complete:true,uris:['spotify:episode:e1']},ledger:led,now:3});led=p.ledger;
  assert.ok(p.skipped.some(s=>s.reason===SKIP.TOMBSTONE));assert.equal(p.adds.length,0);assert.deepEqual(p.newlyRemoved,['spotify:episode:e2']);
  for(let i=0;i<3;i++){p=planRule(rule,{items:Object.values(q.items),playlist:{complete:true,uris:['spotify:episode:e1']},ledger:led,now:4+i});led=p.ledger;assert.equal(p.adds.length,0);}
  const back=reinstate(led,'spotify:episode:e2');p=planRule(rule,{items:Object.values(q.items),playlist:{complete:true,uris:['spotify:episode:e1']},ledger:back,now:9});assert.equal(p.adds.length,1);
});
test('incomplete snapshot never writes nor marks removals; paging resumes from cursor across runs',async()=>{
  const sp=fakeSpotify(Array.from({length:10},(_,i)=>'spotify:episode:p'+i),5);
  let snap=await readPlaylist(sp,PL1,undefined,{maxPages:2});assert.equal(snap.complete,false);assert.equal(snap.uris.length,4);
  snap=await readPlaylist(sp,PL1,snap,{maxPages:5});assert.equal(snap.complete,true);assert.equal(snap.uris.length,10);
  const {rules}=cfg(row());assert.equal(planRule(rules[0],{items:[],playlist:{complete:false,uris:[]},ledger:newLedger(),now:1}).blocked,'PLAYLIST_SNAPSHOT_INCOMPLETE');
  const r=reconcile({seen:{u:1},absent:{},tombstones:{}},[],5,{complete:false});assert.equal(r.skipped,true);assert.deepEqual(r.ledger.tombstones,{});
});
test('excluded/hold/unreviewed episodes and unapproved form posts are not added',async()=>{
  const {rules}=cfg(row(),row({key:'th',type:'theme',pl:PL2,rev:'TRUE'}));
  const q=newQueue();enqueue(q,{episode:ep('e1','動画みた1'),origin:'rss',at:1});enqueue(q,{episode:ep('e2','動画みた2'),origin:'rss',at:1});enqueue(q,{episode:ep('e3','動画みた3'),origin:'form',approved:false,at:1});enqueue(q,{episode:ep('e4','動画みた4'),origin:'rss',at:1});
  const reg={'spotify:episode:e1':{decision:'除外'},'spotify:episode:e2':{decision:'保留'}};
  const p=planRule(rules[0],{items:Object.values(q.items),playlist:{complete:true,uris:[]},ledger:newLedger(),registry:reg,now:1});
  assert.deepEqual(p.adds.map(a=>a.id),['e4']);assert.deepEqual(new Set(p.skipped.map(s=>s.reason)),new Set([SKIP.EXCLUDED,SKIP.HOLD,SKIP.APPROVAL]));
  const t=planRule(rules[1],{items:Object.values(q.items),playlist:{complete:true,uris:[]},ledger:newLedger(),registry:{},now:1});assert.equal(t.adds.length,0); // theme: 未レビューは追加しない
});
test('queue dedupes the same episode from RSS/form/recovery; approval carries over; cap defers rest',()=>{
  const q=newQueue();assert.equal(enqueue(q,{episode:ep('e1','x'),origin:'form',approved:false,at:1}).added,true);
  assert.equal(enqueue(q,{episode:ep('e1','x'),origin:'rss',at:2}).added,false);assert.equal(Object.keys(q.items).length,1);
  const {rules}=cfg(row({cap:'2',kw:'動画'}));const many=Array.from({length:5},(_,i)=>({episode:ep('m'+i,'動画'+i,'2026-11-0'+(i+1)),origin:'rss',approved:true}));
  const p=planRule(rules[0],{items:many,playlist:{complete:true,uris:[]},ledger:newLedger(),now:1});assert.deepEqual(p.adds.map(a=>a.id),['m0','m1']);assert.equal(p.skipped.filter(s=>s.reason===SKIP.CAP).length,3);
});
test('429 sets a shared cooldown, stops, and the rerun after cooldown adds exactly once (idempotent)',async()=>{
  const {rules}=cfg(row(),row({key:'k2',pl:PL2,kw:'ポリレビ'}));const uris=[];const sp=fakeSpotify(uris);const store=memoryStore();
  let first=true;const orig=sp.addItems;sp.addItems=async(...a)=>{if(first){first=false;throw new ApiError('429',429,60);}return orig(...a);};
  const q=items(ep('e1','動画みた'),ep('e2','ポリレビ'));const ho={k1:HO.k1,k2:HO.k1};
  let r=await runEngine({rules,queue:q,spotify:sp,state:{handoff:ho},store,runId:'a',now:1000,globalMode:'LIVE'});assert.equal(r.status,'STOPPED:RATE_LIMITED');
  const r2=await runEngine({rules,queue:q,spotify:sp,state:r.state,store,runId:'b',now:1000+30e3,globalMode:'LIVE'});assert.ok(r2.results.every(x=>x.status==='COOLDOWN'));
  const r3=await runEngine({rules,queue:q,spotify:sp,state:r2.state,store,runId:'c',now:1000+90e3,globalMode:'LIVE'});assert.equal(r3.status,'OK');
  const r4=await runEngine({rules,queue:q,spotify:sp,state:r3.state,store,runId:'d',now:1000+95e3,globalMode:'LIVE'});assert.equal(r4.results.reduce((s,x)=>s+x.wrote,0),0);
  assert.equal(uris.length,2);assert.equal(new Set(uris).size,2);
});
test('single writer: a second runner is refused while the lease is held; same runId commit twice rejected',async()=>{
  const {rules}=cfg(row());const store=memoryStore();const sp=fakeSpotify([]);
  store.lockHeld=true;const busy=await runEngine({rules,queue:items(ep('e1','動画みた')),spotify:sp,store,runId:'x',now:1,globalMode:'LIVE',state:{handoff:HO}});assert.equal(busy.status,'SKIPPED');assert.equal(sp.calls.add.length,0);
  store.lockHeld=false;const ok=await runEngine({rules,queue:items(ep('e1','動画みた')),spotify:sp,store,runId:'x',now:1,globalMode:'LIVE',state:{handoff:HO}});assert.equal(ok.status,'OK');
  const dup=await runEngine({rules,queue:items(ep('e2','動画みた')),spotify:sp,store,runId:'x',now:2,globalMode:'LIVE',state:ok.state});assert.equal(dup.status,'COMMIT_REJECTED');
});
test('only affected playlists are read on a normal run; sweep reads all enabled (recovery of missed posts)',async()=>{
  const {rules}=cfg(row(),row({key:'k2',pl:PL2,kw:'ポリレビ'}));const sp=fakeSpotify([]);
  await runEngine({rules,queue:items(ep('e1','動画みた')),spotify:sp,store:memoryStore(),runId:'a',now:1});assert.equal(sp.calls.list,1);
  sp.calls.list=0;await runEngine({rules,queue:newQueue(),spotify:sp,store:memoryStore(),runId:'b',now:1,sweep:true});assert.equal(sp.calls.list,2);
});
test('form intake: registered → fill only + respect state; new → provisional candidate; never writes',()=>{
  const queue=newQueue();const byKey={g1:{epId:'EP-1',guid:'g1',show:'S',decision:'対象'},g2:{epId:'EP-2',guid:'g2',decision:'除外'}};
  const a=intakeFormPost({guid:'g1',show:'S',uri:'spotify:episode:z',episode:ep('z','動画みた')},{byKey,queue,now:1});assert.equal(a.kind,'ALREADY_REGISTERED');assert.ok(a.fillOnly.includes('spotifyUri'));
  assert.equal(intakeFormPost({guid:'g2',episode:ep('y','動画みた')},{byKey,queue,now:1}).kind,'REGISTERED_RESPECT_STATE');
  const n=intakeFormPost({guid:'new',uri:'spotify:episode:n',episode:ep('n','動画みた')},{byKey,queue,now:1});assert.equal(n.kind,'NEW_CANDIDATE');assert.equal(n.registryCandidate.review,'unreviewed');
  assert.equal(Object.values(queue.items).every(i=>i.approved===false),true);
});
test('matchEpisode mirrors legacy semantics: exclude words, all/any, name-only vs description',()=>{
  const {rules}=cfg(row({kw:'A,B',ex:'NG'}),row({key:'d',pl:PL2,kw:'隠し',scope:'name+description'}));
  assert.equal(matchEpisode(ep('1','A'),rules[0]),true);assert.equal(matchEpisode(ep('1','A NG'),rules[0]),false);
  assert.equal(matchEpisode(ep('1','x',undefined,{description:'隠し'}),rules[0]),false);assert.equal(matchEpisode(ep('1','x',undefined,{description:'隠し'}),rules[1]),true);
  assert.equal(CONFIG_HEADERS.length,17);
});
test('series-code strategy is built in (legacy seriesTitleCode) and needs no injected code',()=>{
  const {rules,errors}=parseConfig([row({kw:'',strat:'series-code:#52-'})]);assert.equal(errors.length,0);
  assert.equal(matchEpisode(ep('1','（楽屋裏 #52-12）'),rules[0]),true);assert.equal(matchEpisode(ep('1','#52-x'),rules[0]),false);
});
