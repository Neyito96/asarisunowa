import test from 'node:test';import assert from 'node:assert/strict';
import {runDailyDay} from '../public/library/daily-pipeline.mjs';
import {memoryStore} from '../public/library/journal-lease.mjs';
import {routeFromDaily,spotifyEpisodeId} from '../public/library/playlist-router.mjs';
import {parseConfig} from '../public/library/playlist-config.mjs';
import {runEngine,newQueue} from '../public/library/playlist-engine.mjs';
const FK='omny:kino',SHOW='木下君、あの動画みた？',SID='0yhef9ORZkUZs9ZeotdCSY',PL='6'.repeat(22);
const item=(g,t,day)=>`<item><guid>${g}</guid><title>${t}</title><pubDate>Mon, ${String(day).padStart(2,'0')} Nov 2026 04:00:00 GMT</pubDate><enclosure url="https://t.omny.fm/${g}.mp3"/><description>d</description></item>`;
const feed=its=>[{feedKey:FK,expectedShow:SHOW,http:200,xml:`<rss><channel><title>${SHOW}</title>${its.join('')}</channel></rss>`}];
const EPID=n=>String(n).padStart(22,'A');
const fakeSp=()=>{const uris=[],c={add:0};return {uris,c,async listPage(){return {items:[...uris],next:null};},async addItems(p,u){c.add++;uris.push(...u);}};};
const cfg=()=>parseConfig([['k','TRUE',PL,'きのどう','title-text',SID,'動画みた','','name','any','','approved','incremental','LIVE','engine','10','']]).rules;
const HO={k:{readOnlyDiffMatch:true,legacyDisabledConfirmed:true}};
test('Phase26 → playlist: arrival is registered (TMP id), waits for Spotify URL (not declared unpublished), then becomes a candidate once Phase26 fills it; state respected',async()=>{
  const store=memoryStore(),pstore=memoryStore();let pub=null;const persist=s=>{pub=s;};const sp=fakeSp();let es={};
  const f=feed([item('g1','木下君、あの動画みた？#9',10)]);
  let d=await runDailyDay({state:{registry:{episodes:[]}},feeds:f,store,owner:'A',runId:'r1',nowMs:Date.parse('2026-11-10T05:00:00Z'),persist,resolvers:{spotify:async()=>({status:'NOT_FOUND'})}});
  const map={[SHOW]:SID};let r=routeFromDaily({daily:d,showIdByName:map,now:1});
  assert.deepEqual(r.pending.map(p=>p.reason),['AWAITING_SPOTIFY_URL']);assert.equal(Object.keys(r.queue.items).length,0);
  let e1=await runEngine({rules:cfg(),queue:r.queue,spotify:sp,state:{handoff:HO},store:pstore,runId:'p1',now:1,globalMode:'LIVE'});assert.equal(sp.c.add,0);
  // 同日の再巡回でPhase26がSpotify URLを補完
  d=await runDailyDay({state:{...pub,fill:{...pub.fill,tasks:{}}},feeds:f,store,owner:'A',runId:'r2',nowMs:Date.parse('2026-11-10T08:00:00Z'),persist,resolvers:{spotify:async()=>({status:'VERIFIED',url:'https://open.spotify.com/episode/'+EPID(1),evidence:['guid']})}});
  r=routeFromDaily({daily:d,showIdByName:map,now:2});assert.equal(r.routed.length,1);assert.equal(r.pending.length,0);
  // 未レビュー・承認なしでも「DRY候補」になるが、除外/保留は候補にならない
  const dry=await runEngine({rules:cfg(),queue:r.queue,spotify:sp,state:{},store:memoryStore(),runId:'p2',now:2,globalMode:'DRY_RUN',registry:r.registryStates});assert.equal(dry.results[0].candidates.length,1);assert.equal(sp.c.add,0);
  const hold=routeFromDaily({daily:{state:{registry:{episodes:d.state.registry.episodes.map(e=>({...e,decision:'保留'}))},rows:d.state.rows}},showIdByName:map,now:3});
  const h=await runEngine({rules:cfg(),queue:hold.queue,spotify:sp,state:{},store:memoryStore(),runId:'p3',now:3,globalMode:'DRY_RUN',registry:hold.registryStates});assert.equal(h.results[0].candidates.length,0);assert.equal(h.results[0].skipped[0].reason,'EPISODE_HOLD');
});
test('unknown show id never becomes a candidate; spotify id parsing',()=>{
  assert.equal(spotifyEpisodeId('https://open.spotify.com/intl-ja/episode/'+EPID(2)+'?si=x'),EPID(2));assert.equal(spotifyEpisodeId('https://example.com'),null);
  const rows=new Map([['EP-1',Array(55).fill('').map((v,i)=>i===11?'https://open.spotify.com/episode/'+EPID(3):i===21?'x':v)]]);
  const r=routeFromDaily({daily:{state:{registry:{episodes:[{id:'EP-1',show:'謎の番組',title:'t',pubDate:'2026-11-10T00:00:00Z'}]},rows}},showIdByName:{},now:1});
  assert.equal(r.noShowId.length,1);assert.equal(Object.keys(r.queue.items).length,0);
});
