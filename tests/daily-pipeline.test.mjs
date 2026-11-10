import test from 'node:test';import assert from 'node:assert/strict';
import {runDailyDay} from '../public/library/daily-pipeline.mjs';
import {memoryStore} from '../public/library/journal-lease.mjs';
import {ApiError} from '../public/library/fill-queue.mjs';
import {isPublishable} from '../public/library/daily-ingest.mjs';
const FK='omny:news',D=n=>Date.parse(`2026-11-${String(n).padStart(2,'0')}T10:00:00Z`);
const item=(g,t,day)=>`<item><guid>${g}</guid><title>${t}</title><pubDate>Mon, ${String(day).padStart(2,'0')} Nov 2026 04:00:00 GMT</pubDate><enclosure url="https://t.omny.fm/${g}.mp3"/><description>【出演・スタッフ】山田太郎（部） https://x.co 【おねがい】</description></item>`;
const xml=items=>`<rss><channel><title>ニュースの現場から</title>${items.join('')}</channel></rss>`;
const feed=items=>[{feedKey:FK,expectedShow:'ニュースの現場から',http:200,xml:xml(items)}];
const seed={registry:{episodes:[{id:'EP-00001',guid:'g1',feedKey:FK,show:'ニュースの現場から',title:'old',pubDate:'2026-11-01T04:00:00.000Z',spotify:'S',custody:'collected',review:'reviewed',decision:'対象',approval:'approved'}],runs:[]},rows:new Map([['EP-00001',(()=>{const r=new Array(55).fill('');r[0]='EP-00001';r[6]='g1';r[11]='https://open.spotify.com/episode/OLD';return r;})()]]),patrol:{}};
let published=null;const persist=s=>{published=s;};
const spotifyAfter=(hours)=>async({guid,publishedAt})=>Date.parse(publishedAt)+hours*3600e3<=D(4)?{status:'VERIFIED',url:'https://open.spotify.com/episode/'+guid,evidence:['guid']}:{status:'NOT_FOUND'};
test('three-day flow: arrival → same-day retry → next day; no duplicates, existing/human state untouched, unreviewed stays private',async()=>{
  const store=memoryStore();let st=seed;
  const day2=feed([item('g1','old',1),item('g2','new2',4),item('g3','new3',4)]);
  const r1=await runDailyDay({state:st,feeds:day2,store,owner:'A',runId:'d4-1',nowMs:D(4),persist,resolvers:{spotify:async()=>({status:'NOT_FOUND'})}});
  assert.equal(r1.run.added,2);assert.equal(r1.state.registry.episodes.length,3);assert.ok(r1.state.registry.episodes.slice(1).every(e=>/^TMP-/.test(e.id)&&!isPublishable(e)));
  assert.ok(r1.previewPatch.filter(p=>p.id.startsWith('TMP-')).every(p=>p.visibility==='private_preview')&&r1.previewPatch.some(p=>p.id.startsWith('TMP-')));assert.ok(r1.previewPatch.filter(p=>p.id==='EP-00001').every(p=>p.visibility==='public_update_candidate'));
  st=published;
  // 同日の再巡回: Spotifyが現れる。新着は増えず、空欄だけが補完される
  const r2=await runDailyDay({state:{...st,fill:{...st.fill,tasks:{}}},feeds:day2,store,owner:'A',runId:'d4-2',nowMs:D(4)+3*3600e3,persist,resolvers:{spotify:async({guid})=>({status:'VERIFIED',url:'https://open.spotify.com/episode/'+guid,evidence:['guid']})}});
  assert.equal(r2.run.added,0);assert.equal(r2.state.registry.episodes.length,3);
  const filled=[...r2.state.rows.values()].filter(r=>r[11].includes('/g'));assert.equal(filled.length,2);
  assert.equal(r2.state.rows.get('EP-00001')[11],'https://open.spotify.com/episode/OLD'); // 既存値は不変
  assert.equal(r2.state.registry.episodes[0].approval,'approved');
  st=published;
  // 翌日: 新着ゼロでも巡回成功なら異常ではない
  const r3=await runDailyDay({state:st,feeds:day2,store,owner:'A',runId:'d5-1',nowMs:D(5),persist,resolvers:{}});
  assert.equal(r3.run.added,0);assert.ok(!r3.run.anomalies.some(a=>/PATROL|STALE/.test(a)));assert.equal(r3.state.registry.episodes.length,3);
});
test('crash before COMMIT leaves nothing behind; the rerun converges without duplicates',async()=>{
  const store=memoryStore();published=null;
  // COMMIT直前に別writerへ奪われた状況: ownerAの実行はFENCEDで何も永続化しない
  const feeds=feed([item('g1','old',1),item('g9','n9',4)]);
  store.append({type:'LEASE',owner:'B',token:99,expiresAt:D(4)+3600e3*100,at:0}); // Bが長期保持
  const blocked=await runDailyDay({state:seed,feeds,store,owner:'A',runId:'x',nowMs:D(4),persist});assert.equal(blocked.status,'SKIPPED');assert.equal(published,null);
  const s2=memoryStore();const ok=await runDailyDay({state:seed,feeds,store:s2,owner:'A',runId:'y',nowMs:D(4),persist});assert.equal(ok.run.added,1);
  const again=await runDailyDay({state:published,feeds,store:s2,owner:'A',runId:'y2',nowMs:D(4)+1000,persist});assert.equal(again.run.added,0);assert.equal(again.state.registry.episodes.length,2);
});
test('duplicate COMMIT of the same run id is refused and not persisted',async()=>{
  const store=memoryStore();published=null;const feeds=feed([item('g1','old',1)]);
  await runDailyDay({state:seed,feeds,store,owner:'A',runId:'same',nowMs:D(4),persist});const first=published;published=null;
  const dup=await runDailyDay({state:first,feeds,store,owner:'A',runId:'same',nowMs:D(4)+1000,persist});assert.equal(dup.status,'NOT_COMMITTED');assert.equal(dup.reason,'DUPLICATE_RUN_ID');assert.equal(published,null);
});
test('feed failure / bad XML / wrong show are recorded as patrol failures (not as "no new episodes") and never register anything',async()=>{
  const store=memoryStore();let st=seed;
  for(let i=0;i<3;i++){const r=await runDailyDay({state:st,feeds:[{feedKey:FK,http:503}],store,owner:'A',runId:'f'+i,nowMs:D(4)+i*3600e3,persist});st=published??r.state??st;
    if(i===2){assert.ok(r.run.anomalies.includes('PATROL_STALE:'+FK));assert.equal(r.status,'STOP');}}
  const bad=await runDailyDay({state:seed,feeds:[{feedKey:FK,http:200,xml:'<rss><channel><title>x</title>'}],store:memoryStore(),owner:'A',runId:'b',nowMs:D(4),persist});assert.equal(bad.state.patrol[FK].lastError,'XML_UNCLOSED');assert.equal(bad.state.registry.episodes.length,1);
  const wrong=await runDailyDay({state:seed,feeds:[{feedKey:FK,expectedShow:'別番組',http:200,xml:xml([item('gx','t',4)])}],store:memoryStore(),owner:'A',runId:'w',nowMs:D(4),persist});assert.equal(wrong.run.added,0);assert.ok(wrong.run.quarantined>0);
});
test('429 on the platform API stops that platform safely; ingestion and other work still complete',async()=>{
  const store=memoryStore();const r=await runDailyDay({state:seed,feeds:feed([item('g1','old',1),item('g2','n2',4),item('g3','n3',4)]),store,owner:'A',runId:'r',nowMs:D(4),persist,resolvers:{spotify:async()=>{throw new ApiError('429',429,3600);}}});
  assert.equal(r.run.added,2);assert.equal(r.state.fill.cooldown.spotify,D(4)+3600e3);assert.equal(r.run.fill.calls,1);
});
test('ledger reconcile maps TMP to the production EP id (never minted) and keeps the filled row',async()=>{
  const store=memoryStore();const feeds=feed([item('g1','old',1),item('g2','n2',4)]);
  const a=await runDailyDay({state:seed,feeds,store,owner:'A',runId:'1',nowMs:D(4),persist});const tmp=a.state.registry.episodes[1].id;
  const b=await runDailyDay({state:published,feeds,store,owner:'A',runId:'2',nowMs:D(4)+1000,persist,ledgerIndex:new Map([['g2',['EP-06592']]])});
  assert.equal(b.state.registry.episodes[1].id,'EP-06592');assert.equal(b.state.registry.episodes[1].tmpId,tmp);assert.ok(b.state.rows.has('EP-06592'));assert.equal(b.state.registry.episodes.length,2);
});
