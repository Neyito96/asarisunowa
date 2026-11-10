import test from 'node:test';import assert from 'node:assert/strict';
import {ingest,isPublishable,runRecord,detect,provisionalId,isEpId,reconcileEpIds,showCadence,recordPatrol,patrolIssues} from '../public/library/daily-ingest.mjs';
import {parseFeedStrict} from '../public/library/rss-parse.mjs';
const FK='omny:asahi-news';
const rss=(items,title='ニュースの現場から')=>`<?xml version="1.0" encoding="UTF-8"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0"><channel><title>${title}</title>${items.map(i=>`<item><guid isPermaLink="false">${i.g}</guid><title><![CDATA[${i.t}]]></title><pubDate>${i.d}</pubDate><link>https://omny.fm/x/${i.g}</link><enclosure url="https://traffic.omny.fm/${i.g}.mp3" type="audio/mpeg"/></item>`).join('')}</channel></rss>`;
const NOWMS=Date.parse('2026-11-04T10:00:00Z');
const feed=items=>parseFeedStrict(rss(items),{feedKey:FK,nowMs:NOWMS}).items;
const seed={episodes:[
  {id:'EP-00001',guid:'g1',feedKey:FK,show:'ニュースの現場から',title:'a',pubDate:'2026-11-01T04:00:00.000Z',spotify:'x',custody:'collected',review:'reviewed',decision:'対象',approval:'approved'},
  {id:'EP-00002',guid:'g2',show:'ニュースの現場から',title:'b',pubDate:'2026-11-02T04:00:00.000Z',spotify:'y',custody:'collected',review:'reviewed',decision:'保留',approval:null}, // feedKey無しの旧レコード
  {id:'EP-06591',guid:'g3',feedKey:FK,show:'ニュースの現場から',title:'c',pubDate:'2026-11-03T04:00:00.000Z',spotify:'z',custody:'collected',review:'reviewed',decision:'対象外',approval:null}],runs:[]};
const day1=[{g:'g1',t:'a',d:'Sun, 01 Nov 2026 04:00:00 GMT'},{g:'g2',t:'b',d:'Mon, 02 Nov 2026 04:00:00 GMT'},{g:'g3',t:'c',d:'Tue, 03 Nov 2026 04:00:00 GMT'}];
const day2=[...day1,{g:'g4',t:'new4',d:'Wed, 04 Nov 2026 04:00:00 GMT'},{g:'g5',t:'new5',d:'Wed, 04 Nov 2026 04:00:00 GMT'}];
const T1='2026-11-03T10:00:00.000Z',T2='2026-11-04T10:00:00.000Z';

test('same-day rerun adds nothing; legacy record without feedKey is adopted by guid+show; human states untouched',()=>{
  const a=ingest(seed,feed(day1),{now:T1}),b=ingest(a.registry,feed(day1),{now:T1});
  assert.equal(a.result.added,0);assert.equal(b.result.added,0);assert.equal(b.registry.episodes.length,3);
  assert.equal(b.registry.episodes[1].feedKey,FK);
  assert.deepEqual(b.registry.episodes.map(e=>[e.review,e.decision,e.approval]),seed.episodes.map(e=>[e.review,e.decision,e.approval]));
});
test('EP ids are NEVER minted: new arrivals get deterministic TMP ids that cannot look like EP ids; production ids untouched',()=>{
  const r=ingest(seed,feed(day2),{now:T2});assert.equal(r.result.added,2);
  for(const id of r.result.addedIds){assert.match(id,/^TMP-[0-9a-f]{16}$/);assert.equal(isEpId(id),false);}
  assert.deepEqual(r.registry.episodes.slice(0,3).map(e=>e.id),['EP-00001','EP-00002','EP-06591']);
  assert.equal(provisionalId(FK,'g4'),provisionalId(FK,'g4'));assert.notEqual(provisionalId(FK,'g4'),provisionalId('other','g4'));
  assert.equal(ingest(r.registry,feed(day2),{now:T2}).result.added,0);
});
test('parallel/resumed runs converge: two writers ingesting the same feed produce identical ids and no duplicates',()=>{
  const a=ingest(seed,feed(day2),{now:T2}),b=ingest(seed,feed([...day2].reverse()),{now:T2});
  assert.deepEqual(a.registry.episodes.map(e=>e.id).sort(),b.registry.episodes.map(e=>e.id).sort());
  const merged=ingest(a.registry,feed(day2),{now:T2});assert.equal(merged.registry.episodes.length,5);
});
test('the same GUID in a different show feed is a different episode (composite key) and is counted as a cross-show collision',()=>{
  const other=parseFeedStrict(rss([{g:'g1',t:'a',d:'Sun, 01 Nov 2026 04:00:00 GMT'}],'別番組'),{feedKey:'omny:other',nowMs:NOWMS}).items;
  const r=ingest(seed,other,{now:T2});assert.equal(r.result.added,1);assert.equal(r.result.crossShowGuidCollisions,1);assert.equal(r.registry.episodes.length,4);
});
test('reconcile maps TMP ids to production EP ids from a READ_ONLY ledger index; never mints; conflicts are HOLD',()=>{
  const r=ingest(seed,feed(day2),{now:T2});const [t4,t5]=r.result.addedIds;
  const idx=new Map([['g4',['EP-06592']],['g5',['EP-06593','EP-06594']]]);
  const x=reconcileEpIds(r.registry,idx);
  assert.equal(x.registry.episodes.find(e=>e.guid==='g4').id,'EP-06592');assert.equal(x.registry.episodes.find(e=>e.guid==='g4').tmpId,t4);
  assert.equal(x.registry.episodes.find(e=>e.guid==='g5').id,t5);assert.equal(x.registry.episodes.find(e=>e.guid==='g5').idConflict,true);assert.equal(x.result.conflicts.length,1);
  assert.equal(reconcileEpIds(r.registry,new Map()).result.pending,2); // 台帳に無い=本番未登録のままTMP
  const clash=reconcileEpIds(r.registry,new Map([['g4',['EP-00001']]]));assert.equal(clash.registry.episodes.find(e=>e.guid==='g4').idConflict,true); // 既存EP-IDを別GUIDに割当てない
});
test('large batch stays linear (no per-item max-id scan)',()=>{
  const items=Array.from({length:20000},(_,i)=>({feedKey:FK,guid:'b'+i,show:'S',title:'t'+i,pubDate:'2026-11-01T00:00:00Z'}));
  const t=Date.now();const r=ingest({episodes:[],runs:[]},items,{now:T1});assert.equal(r.registry.episodes.length,20000);assert.ok(Date.now()-t<5000);
});
test('episodes missing from the feed are never deleted; absence is counted; guid-less items quarantined',()=>{
  const r=ingest(seed,feed(day1.slice(0,1)),{now:T2});assert.equal(r.registry.episodes.length,3);assert.equal(r.registry.episodes[1].absentRuns,1);
  assert.equal(ingest(seed,[{guid:'',title:'x'}],{now:T2}).result.quarantined[0].reason,'NO_STRONG_ID');
});
test('summary keeps states separate; run record logs counts and patrol/cadence',()=>{
  const r=ingest(seed,feed(day2),{now:T2});const rec=runRecord({registry:r.registry,result:r.result,now:T2,runId:'r2'});
  assert.equal(rec.total,5);assert.equal(rec.unreviewed,2);assert.equal(rec.held,1);assert.equal(rec.excluded,1);assert.equal(rec.approved,1);assert.equal(rec.published,1);assert.equal(rec.added,2);assert.equal(rec.lastPatrolAt,T2);assert.ok(rec.shows['ニュースの現場から']);
});
const daily=n=>({episodes:Array.from({length:n},(_,i)=>({id:'E'+i,guid:'x'+i,show:'毎日',pubDate:new Date(Date.parse('2026-10-01T04:00:00Z')+i*86400e3).toISOString()}))});
const weekly=n=>({episodes:Array.from({length:n},(_,i)=>({id:'W'+i,guid:'w'+i,show:'週刊',pubDate:new Date(Date.parse('2026-09-01T04:00:00Z')+i*7*86400e3).toISOString()}))});
test('cadence: a weekly show is not flagged between releases; a daily show missing 3 days is; too little history is never flagged',()=>{
  const eps=[...daily(30).episodes,...weekly(10).episodes];const now=Date.parse('2026-11-03T04:00:00Z'); // 毎日の最終=10/30、週刊の最終=11/3(9週目)
  const c=showCadence(eps,now);assert.equal(c['毎日'].cadence,'daily');assert.equal(c['毎日'].overdue,true);
  const c2=showCadence(eps,Date.parse('2026-11-05T04:00:00Z'));assert.equal(c2['週刊'].cadence,'weekly');assert.equal(c2['週刊'].overdue,false);
  assert.equal(showCadence([{show:'新',pubDate:'2026-11-01T00:00:00Z'}],now)['新'].overdue,false);
});
test('zero new episodes with a successful patrol is NOT an anomaly; failed/stale patrol and shrinking feed ARE',()=>{
  let st=recordPatrol({},FK,{ok:true,http:200,itemCount:2672},'2026-11-04T09:00:00.000Z');
  const reg=ingest(seed,feed(day1),{now:T2});
  const rec=runRecord({registry:reg.registry,result:reg.result,now:T2,runId:'r',patrol:st});assert.deepEqual(rec.anomalies.filter(a=>/PATROL|STALE|SHRANK/.test(a)),[]);
  st=recordPatrol(st,FK,{ok:true,http:200,itemCount:2600},'2026-11-04T10:00:00.000Z');assert.ok(patrolIssues(st,Date.parse(T2)).includes('FEED_ITEMS_SHRANK:'+FK));
  let f={};for(let i=0;i<3;i++)f=recordPatrol(f,FK,{ok:false,http:503},'2026-11-04T0'+i+':00:00.000Z');assert.ok(patrolIssues(f,Date.parse(T2)).includes('PATROL_STALE:'+FK));
  assert.ok(patrolIssues(recordPatrol({},FK,{ok:true,http:200,itemCount:1},'2026-11-01T00:00:00.000Z'),Date.parse(T2)).includes('PATROL_STALE:'+FK)); // 36h超
  assert.equal(runRecord({registry:reg.registry,result:reg.result,now:T2,runId:'r',patrol:f}).status,'STOP');
});
test('anomalies: empty feed, total/published decrease, latest regress, spotify gap',()=>{
  const prev={total:5,published:1,latestPubDate:'2026-11-04T04:00:00.000Z'};
  const a=detect({total:4,published:0,latestPubDate:'2026-11-01T04:00:00.000Z',missingSpotifyOver24h:2},{fetched:0,quarantined:[]},prev,{now:'2026-11-09T00:00:00Z'});
  for(const x of ['FEED_EMPTY','TOTAL_DECREASED','PUBLISHED_DECREASED','LATEST_PUBDATE_REGRESSED','SPOTIFY_LINK_GAP'])assert.ok(a.includes(x),x);
  assert.ok(!a.some(x=>x.startsWith('STALE_LATEST')));
});
