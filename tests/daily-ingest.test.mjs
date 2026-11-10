import test from 'node:test';import assert from 'node:assert/strict';
import {parseFeed,ingest,isPublishable,summarize,runRecord,detect,acquireLease,mayCommit,nextEpId} from '../public/library/daily-ingest.mjs';
const rss=items=>`<rss><channel><title>ニュースの現場から</title>${items.map(i=>`<item><guid isPermaLink="false">${i.g}</guid><title><![CDATA[${i.t}]]></title><pubDate>${i.d}</pubDate><link>https://omny.fm/x/${i.g}</link><enclosure url="https://traffic.omny.fm/${i.g}.mp3" type="audio/mpeg"/></item>`).join('')}</channel></rss>`;
const seed={episodes:[
  {id:'EP-00001',guid:'g1',show:'S',title:'a',pubDate:'2026-11-01T04:00:00.000Z',spotify:'x',custody:'collected',review:'reviewed',decision:'対象',approval:'approved',publication:'published'},
  {id:'EP-00002',guid:'g2',show:'S',title:'b',pubDate:'2026-11-02T04:00:00.000Z',spotify:'y',custody:'collected',review:'reviewed',decision:'保留',approval:null,publication:'unpublished'},
  {id:'EP-06591',guid:'g3',show:'S',title:'c',pubDate:'2026-11-03T04:00:00.000Z',spotify:'z',custody:'collected',review:'reviewed',decision:'対象外',approval:null,publication:'unpublished'}],runs:[]};
const day1=[{g:'g1',t:'a',d:'Sun, 01 Nov 2026 04:00:00 GMT'},{g:'g2',t:'b',d:'Mon, 02 Nov 2026 04:00:00 GMT'},{g:'g3',t:'c',d:'Tue, 03 Nov 2026 04:00:00 GMT'}];
const day2=[...day1,{g:'g4',t:'new4',d:'Wed, 04 Nov 2026 04:00:00 GMT'},{g:'g5',t:'new5',d:'Wed, 04 Nov 2026 04:00:00 GMT'}];
const T1='2026-11-03T10:00:00.000Z',T2='2026-11-04T10:00:00.000Z';

test('feed parsing keeps guid/title/audio; items without guid are returned (not dropped)',()=>{
  const items=parseFeed(rss(day2));assert.equal(items.length,5);assert.equal(items[3].guid,'g4');assert.ok(items[3].audio.endsWith('g4.mp3'));
  assert.equal(parseFeed('<rss><channel><title>S</title><item><title>no guid</title></item></channel></rss>')[0].guid,'');
});
test('re-running the same day adds nothing (idempotent) and leaves human states untouched',()=>{
  const a=ingest(seed,parseFeed(rss(day1)),{now:T1}),b=ingest(a.registry,parseFeed(rss(day1)),{now:T1});
  assert.equal(a.result.added,0);assert.equal(b.result.added,0);assert.equal(b.registry.episodes.length,3);
  assert.deepEqual(b.registry.episodes.map(e=>[e.review,e.decision,e.approval]),seed.episodes.map(e=>[e.review,e.decision,e.approval]));
});
test('new episodes are collected as unreviewed with append-only EP ids; count GROWS; they are not published',()=>{
  const r=ingest(seed,parseFeed(rss(day2)),{now:T2});
  assert.equal(r.result.added,2);assert.deepEqual(r.result.addedIds,['EP-06592','EP-06593']);assert.equal(r.registry.episodes.length,5);
  for(const e of r.registry.episodes.slice(3)){assert.equal(e.custody,'collected');assert.equal(e.review,'unreviewed');assert.equal(isPublishable(e),false);}
  assert.equal(r.registry.episodes.filter(isPublishable).length,1); // 既存の公開分は減らない
  const again=ingest(r.registry,parseFeed(rss(day2)),{now:T2});assert.equal(again.result.added,0);assert.equal(again.registry.episodes.length,5);
});
test('any total works: no fixed count - 0 new, 1 new, many new all succeed',()=>{
  let reg=seed;for(let n=0;n<4;n++){const items=[...day1,...Array.from({length:n*3},(_,i)=>({g:'n'+i,t:'t'+i,d:'Thu, 05 Nov 2026 04:00:00 GMT'}))];const r=ingest(reg,parseFeed(rss(items)),{now:T2});assert.equal(r.registry.episodes.length,3+n*3);reg=r.registry;}
});
test('episodes missing from the feed are never deleted; absence is counted',()=>{
  const r=ingest(seed,parseFeed(rss(day1.slice(0,1))),{now:T2});assert.equal(r.registry.episodes.length,3);assert.equal(r.registry.episodes[1].absentRuns,1);
});
test('guid-less items are quarantined and reported, duplicates in feed collapsed',()=>{
  const r=ingest(seed,[{guid:'',title:'x',show:'S'},{guid:'g9',title:'n',show:'S',pubDate:'2026-11-05'},{guid:'g9',title:'n',show:'S',pubDate:'2026-11-05'}],{now:T2});
  assert.equal(r.result.quarantined.length,1);assert.equal(r.result.added,1);assert.equal(r.result.duplicatesInFeed,1);
});
test('summary keeps states separate; run record logs counts, latest pubDate and patrol time',()=>{
  const r=ingest(seed,parseFeed(rss(day2)),{now:T2});const rec=runRecord({registry:r.registry,result:r.result,now:T2,runId:'r2'});
  assert.equal(rec.total,5);assert.equal(rec.unreviewed,2);assert.equal(rec.held,1);assert.equal(rec.excluded,1);assert.equal(rec.approved,1);assert.equal(rec.published,1);
  assert.equal(rec.added,2);assert.equal(rec.lastPatrolAt,T2);assert.ok(rec.latestPubDate.startsWith('2026-11-04'));
});
test('anomalies: empty feed, stale, total/published decrease, latest regress, spotify gap',()=>{
  const prev={total:5,published:1,latestPubDate:'2026-11-04T04:00:00.000Z'};
  const s={total:4,published:0,latestPubDate:'2026-11-01T04:00:00.000Z',missingSpotifyOver24h:2};
  const a=detect(s,{fetched:0,quarantined:[]},prev,{now:'2026-11-09T00:00:00Z'});
  for(const x of ['FEED_EMPTY','STALE_LATEST_EPISODE','TOTAL_DECREASED','PUBLISHED_DECREASED','LATEST_PUBDATE_REGRESSED','SPOTIFY_LINK_GAP'])assert.ok(a.includes(x),x);
  const ok=ingest(seed,parseFeed(rss(day2)),{now:T2});assert.equal(runRecord({registry:ok.registry,result:ok.result,now:T2,runId:'r',prev:{total:3,published:1,latestPubDate:'2026-11-03T04:00:00.000Z'}}).status,'OK');
});
test('single-writer lease: others blocked until expiry; stale token cannot commit; takeover after crash',()=>{
  const a=acquireLease(null,'A',1000);assert.ok(a.ok);assert.equal(acquireLease(a.lease,'B',2000).ok,false);
  assert.ok(mayCommit(a.lease,'A',a.lease.token,2000));
  const b=acquireLease(a.lease,'B',a.lease.expiresAt+1);assert.ok(b.ok);assert.equal(mayCommit(b.lease,'A',a.lease.token,b.lease.expiresAt-1),false);
});
test('nextEpId never renumbers: max+1 even with gaps',()=>{assert.equal(nextEpId(['EP-00001','EP-06591','EP-00300']),'EP-06592');});
