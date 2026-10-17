import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {harness,item,guid} from './library-v3-harness.mjs';
function auto(n=2){
 const h=harness(n);vm.runInContext(fs.readFileSync('scripts/google-apps-script/LibraryV3Autonomy.js','utf8'),h.ctx);
 const ss=h.ctx.SpreadsheetApp.openById();ss.getSheets=()=>Object.keys(h.table).map(n=>{const s=ss.getSheetByName(n);s.getName=()=>n;return s;});
 h.ctx.prepareLibraryV3AutonomyAfterApproval();return h;
}
const packed=(h,id,field)=>JSON.parse(h.table['図書館V3・項目状態'].find(r=>r[0]===id)[1])[field];
const apiUrl='https://open.spotify.com/episode/'+'a'.repeat(22);
function evidence(h,rows){
 const ss=h.ctx.SpreadsheetApp.openById(),s=ss.insertSheet('Evidence');
 s.getRange(1,1,rows.length+1,7).setValues([['番組名','タイトル','配信日時','GUID','元ページURL','Spotify個別URL','根拠'],...rows]);
}
const ev=(i,url=apiUrl)=>['Show','Title '+i,'2026/10/17 09:00',guid(i),'',url,'official reviewed mapping'];
test('autonomy is inert without enable; all auxiliary previews leave properties/cache/sheets unchanged',()=>{
 const h=auto();const before=JSON.stringify(h.table),props=JSON.stringify([...h.props]);
 assert.equal(h.ctx.scheduledLibraryV3().status,'DISABLED');h.ctx.previewLibraryV3Autonomy();h.ctx.previewLibraryV3Spotify();h.ctx.previewLibraryV3AudioQueue();
 assert.equal(JSON.stringify(h.table),before);assert.equal(JSON.stringify([...h.props]),props);assert.equal(h.calls,0);assert.equal(h.triggers.length,0);
});
test('scheduler registers 201 original IDs over two ticks, resumes and then runs RSS without installing a trigger',()=>{
 const h=auto(201);h.ctx.startLibraryV3AfterApproval();
 assert.equal(h.ctx.scheduledLibraryV3().status,'BASELINE_PARTIAL');assert.equal(JSON.parse(h.props.get('LIB_V3_BASELINE')).offset,200);
 assert.equal(h.ctx.scheduledLibraryV3().status,'BASELINE_READY');assert.equal(h.ctx.scheduledLibraryV3().status,'SNAPSHOT_READY');
 assert.equal(h.triggers.length,0);assert.equal(h.ctx.libV3Config_().allowNew,false);
});
test('eight-minute lease blocks concurrent scheduler, stop changes only V3 flag',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();const token=h.ctx.libV3AutoLease_();
 assert.equal(h.ctx.scheduledLibraryV3().status,'SKIPPED_ALREADY_RUNNING');h.ctx.libV3AutoLease_(token);
 h.triggers.push('unrelated');h.ctx.stopLibraryV3AfterApproval();assert.equal(h.ctx.scheduledLibraryV3().status,'DISABLED');assert.deepEqual(h.triggers,['unrelated']);
});
test('priority and review passes preserve offsets, complete cycle sleeps, then conditional refresh is bounded',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.ctx.registerLibraryV3BaselineAfterApproval();
 assert.equal(h.run(true).status,'SNAPSHOT_READY');h.run(true);h.run(true);
 const s=JSON.parse(h.props.get('LIB_V3_CURSOR'));assert.ok(s.feeds['https://rss.test/feed'].completedAt);assert.ok(s.feeds['https://rss.test/feed'].nextPollAt>Date.now());
 const calls=h.calls;assert.equal(h.run(true).status,'IDLE_UNTIL_NEXT_POLL');assert.equal(h.calls,calls);
 h.advance=31*60000;assert.equal(h.run(true).status,'SNAPSHOT_READY');assert.equal(h.calls,calls+1);
});
test('RSS parse is sorted newest-first only for autonomy, unchanged inspected fields are skipped',()=>{
 const h=auto(2);h.ctx.startLibraryV3AfterApproval();h.items=[{...item(0),published:'2020-01-01T00:00:00Z'},item(1)];
 h.run(true);const c=h.ctx.libV3Context_(true);const metrics={apiCalls:0,cacheHits:0};
 const snap=h.ctx.libV2CpSnapshot_('https://rss.test/feed',false,{offset:0},metrics,{prefix:'LV3AUTO'});assert.equal(snap.items[0].guid,guid(1));
 h.run(true);const c2=h.ctx.libV3Context_(true);assert.equal(h.ctx.libV3AutoInspectDue_(item(1),c2.feeds[0],c2,'review'),false);
 h.rows[1][14]='';const c3=h.ctx.libV3Context_(true);assert.equal(h.ctx.libV3AutoInspectDue_(item(1),c3.feeds[0],c3,'review'),true);
});
test('Spotify exact GUID/title/show/date evidence fills once; rerun and human clearing cannot refill',()=>{
 const h=auto(1);h.rows[0][6]=guid(0);evidence(h,[ev(0)]);h.ctx.startLibraryV3AfterApproval();
 assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,1);assert.equal(h.rows[0][11],apiUrl);assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,0);
 h.rows[0][11]='';assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,0);assert.equal(h.rows[0][11],'');
});
test('1007 exact page/show/title/JST date is usable; missing identifier and conflicts stay held',()=>{
 const h=auto(1);h.rows[0][8]='https://omny.fm/shows/asahi/old-episode';
 const ss=h.ctx.SpreadsheetApp.openById(),sh=ss.insertSheet('1007 actual title');sh.getRange(1,1,2,7).setValues([['取得元シート','朝リスの田・番組名','元ページURL','配信日時UTC原文','タイトル','再生時間秒','Spotify個別URL'],['old','Show',h.rows[0][8],'Sat, 17 Oct 2026 00:00:00 +0000','Title 0',100,apiUrl]]);
 assert.equal(h.ctx.previewLibraryV3Spotify().proposedCells,1);
 h.rows[0][8]='';assert.equal(h.ctx.previewLibraryV3Spotify().proposedCells,0);
});
test('Spotify formulas/exclusions/duplicate GUID/date/title/show/evidence conflicts all hold',()=>{
 for(const mutate of [h=>h.formulas.set('エピソード台帳:2:12','=IF(TRUE,"","")'),h=>h.rows[0][38]='除外',h=>h.ex.push(['',h.rows[0][0]]),h=>h.rows[1][6]=guid(0),h=>h.rows[0][2]='Other',h=>h.rows[0][1]='Wrong',h=>h.rows[0][3]='2020/01/01',h=>evidence(h,[ev(0),ev(0,'https://open.spotify.com/episode/'+'b'.repeat(22))])]){
  const h=auto(2);h.rows[0][6]=guid(0);evidence(h,[ev(0)]);mutate(h);h.ctx.startLibraryV3AfterApproval();assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,0);assert.equal(h.rows[0][11],'');
 }
});
test('API 403 stops Spotify only; 429/503 persist Retry-After; RSS remains enabled',()=>{
 for(const code of [403,429,503]){
  const h=auto(1);h.rows[0][6]=guid(0);evidence(h,[ev(0)]);h.ctx.startLibraryV3AfterApproval();
  h.ctx.configureLibraryV3SpotifyAfterApproval({api:true,showIds:{Show:'s'.repeat(22)}});h.cache.set('SPOTIFY_USER_ACCESS_TOKEN','mock-only');h.code=code;h.responseHeaders={'Retry-After':'7200'};
  const a=h.ctx.libV3AutoSpotify_(true);assert.equal(a.status,code===403?'SPOTIFY_API_STOPPED':'SPOTIFY_RETRY_WAIT');assert.equal(h.ctx.libV3Config_().enabled,true);assert.ok(a.retry.at-Date.now()>7199000);
  const calls=h.calls;h.ctx.libV3AutoSpotify_(true);assert.equal(h.calls,calls);assert.equal(h.rows[0][11],'');
 }
});
test('API requires exact returned show/title/day; token absence makes no API call',()=>{
 const h=auto(1);h.rows[0][6]=guid(0);evidence(h,[ev(0)]);h.ctx.startLibraryV3AfterApproval();h.ctx.configureLibraryV3SpotifyAfterApproval({api:true,showIds:{Show:'s'.repeat(22)}});
 assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,0);assert.equal(h.calls,0);
 const s=JSON.parse(h.props.get('LIB_V3_AUTO'));s.spotify.offset=0;h.props.set('LIB_V3_AUTO',JSON.stringify(s));h.table['図書館V3・項目状態'].splice(1);h.cache.set('SPOTIFY_USER_ACCESS_TOKEN','mock');
 h.ctx.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getAllHeaders:()=>({}),getContentText:()=>JSON.stringify({id:'a'.repeat(22),type:'episode',external_urls:{spotify:apiUrl},name:'Wrong',release_date:'2026-10-17',release_date_precision:'day',show:{id:'s'.repeat(22)}})});
 assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,0);
});
test('malformed Spotify API responses are isolated auxiliary failures and next tick still runs RSS',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.ctx.registerLibraryV3BaselineAfterApproval();h.props.set('LIB_V3_AUTO',JSON.stringify({tick:1,spotify:{},audio:{offset:0}}));
 h.ctx.libV3AutoSpotify_=()=>{throw Error('bad response');};assert.equal(h.ctx.scheduledLibraryV3().status,'AUXILIARY_FAILED_RSS_CONTINUES');
 assert.equal(h.ctx.libV3Config_().enabled,true);assert.equal(h.ctx.scheduledLibraryV3().job,'RSS');
});
test('audio queue never calls URL Fetch; evidence binds URL, schedules retries and never verifies playback',()=>{
 const h=auto(2);h.rows[0][14]=item(0).audio;h.ctx.startLibraryV3AfterApproval();const q=h.ctx.previewLibraryV3AudioQueue();assert.equal(q.items.length,1);assert.equal(h.calls,0);
 h.ctx.libV3AutoAudio_(true);assert.equal(h.rows[0][18],'');assert.equal(h.calls,0);
 const now=new Date().toISOString(),e={id:h.rows[0][0],url:h.rows[0][14],checkedAt:now,http:429,bytes:0,verdict:'HTTP_RATE_LIMITED',playbackVerified:false,observations:[{method:'HEAD',http:429,retryAfter:'172800'}]};
 h.ctx.recordLibraryV3AudioEvidenceAfterApproval([e]);assert.equal(h.ctx.previewLibraryV3AudioQueue().items.length,0);assert.equal(h.rows[0][18],'');
 assert.throws(()=>h.ctx.recordLibraryV3AudioEvidenceAfterApproval([{...e,nextCheckAt:new Date(Date.now()+60000).toISOString()}]),/shortened/);
 assert.throws(()=>h.ctx.recordLibraryV3AudioEvidenceAfterApproval([{...e,http:403,verdict:'AUDIO_PREFIX_OBSERVED',bytes:1024}]),/Inconsistent/);
});
test('2020-era clean preserves original, cast and URLs, stores recipe; ambiguous announcements hold',()=>{
 const h=auto(1),raw='<p>2020年の取材。出演：記者A</p>\\n【お知らせ】\\nhttps://example.test/info';h.rows[0][21]=raw;
 h.ctx.startLibraryV3AfterApproval();h.run(true);h.run(true);assert.equal(h.rows[0][21],raw);assert.match(h.rows[0][22],/記者A/);assert.match(h.rows[0][22],/https:\/\/example.test\/info/);
 assert.equal(JSON.parse(packed(h,h.rows[0][0],'cleanEvidence')[7]).noticeState,'EXPLICIT_MARKER_PRESERVED');
 const b=auto(1);b.rows[0][21]='本文に混在するお知らせですが境界不明';b.ctx.startLibraryV3AfterApproval();b.run(true);b.run(true);assert.equal(b.rows[0][22],'');assert.equal(packed(b,b.rows[0][0],'clean')[0],'HOLD');
});
test('200-row scan cursors resume sparse Spotify/audio work rather than pinning at the first complete rows',()=>{
 const h=auto(205);for(let i=0;i<204;i++)h.rows[i][11]='https://open.spotify.com/episode/'+String(i).padStart(22,'a');h.rows[204][6]=guid(204);h.rows[204][14]=item(204).audio;evidence(h,[ev(204)]);h.ctx.startLibraryV3AfterApproval();
 assert.equal(h.ctx.libV3AutoSpotify_(true).inspected,0);assert.equal(JSON.parse(h.props.get('LIB_V3_AUTO')).spotify.offset,200);assert.equal(h.ctx.libV3AutoSpotify_(true).writtenCells,1);
 h.ctx.libV3AutoAudio_(true);assert.equal(JSON.parse(h.props.get('LIB_V3_AUTO')).audio.offset,200);assert.equal(h.ctx.previewLibraryV3AudioQueue().items[0].id,h.rows[204][0]);
});
test('auxiliary HTTP retry cannot be shortened by reconfiguration and transport timeout is 15 seconds',()=>{
 const h=auto(1);h.rows[0][6]=guid(0);evidence(h,[ev(0)]);h.ctx.startLibraryV3AfterApproval();h.ctx.configureLibraryV3SpotifyAfterApproval({api:true,showIds:{Show:'s'.repeat(22)}});h.cache.set('SPOTIFY_USER_ACCESS_TOKEN','mock');let opts;
 h.ctx.UrlFetchApp.fetch=(url,o)=>{opts=o;throw Error('network timeout');};const r=h.ctx.libV3AutoSpotify_(true);assert.equal(r.status,'SPOTIFY_RETRY_WAIT');assert.equal(opts.timeoutSeconds,15);const at=r.retry.at;
 h.ctx.configureLibraryV3SpotifyAfterApproval({api:true,showIds:{Show:'s'.repeat(22)}});assert.equal(JSON.parse(h.props.get('LIB_V3_AUTO')).spotify.retry.at,at);
});
test('repeated auxiliary failure pauses only that job; baseline integrity failure stops control after two attempts',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.ctx.registerLibraryV3BaselineAfterApproval();h.props.set('LIB_V3_AUTO',JSON.stringify({tick:1,spotify:{},audio:{offset:0}}));h.ctx.libV3AutoSpotify_=()=>{throw Error('bad');};h.ctx.scheduledLibraryV3();let s=JSON.parse(h.props.get('LIB_V3_AUTO'));s.tick=1;h.props.set('LIB_V3_AUTO',JSON.stringify(s));h.ctx.scheduledLibraryV3();assert.equal(JSON.parse(h.props.get('LIB_V3_AUTO')).pausedJobs.SPOTIFY,true);assert.equal(h.ctx.libV3Config_().enabled,true);
 const b=auto(2);b.rows[1][0]=b.rows[0][0];b.ctx.startLibraryV3AfterApproval();b.ctx.scheduledLibraryV3();b.ctx.scheduledLibraryV3();assert.equal(b.ctx.libV3Config_().enabled,false);
});
test('UTC staging date becomes JST day; same Spotify URL cannot be proposed for two ledger identities',()=>{
 const h=auto(2);assert.equal(h.ctx.libV3AutoSourceDate_('Fri, 16 Oct 2026 19:00:00 +0000'),'2026-10-17');h.rows[0][6]=guid(0);h.rows[1][6]=guid(1);evidence(h,[ev(0),ev(1)]);const p=h.ctx.previewLibraryV3Spotify();assert.equal(p.proposedCells,1);assert.equal(p.holds,1);
});
test('write-ahead reservations survive interruption and an intervening wrong-show hold',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.run(true);h.failAt=1;assert.equal(h.run(true).status,'FAILED');h.failAt=0;
 h.sources[1][0]='Wrong';h.run(true);h.sources[1][0]='Show';h.run(true);assert.equal(h.rows[0][6],'');assert.equal(packed(h,h.rows[0][0],'guid')[0],'HOLD');
 const s=auto(1);s.rows[0][6]=guid(0);evidence(s,[ev(0)]);s.ctx.startLibraryV3AfterApproval();s.failAt=1;assert.throws(()=>s.ctx.libV3AutoSpotify_(true));s.failAt=0;assert.equal(s.ctx.libV3AutoSpotify_(true).writtenCells,0);assert.equal(s.rows[0][11],'');
});
test('all existing read-only previews remain mutation-free with autonomy loaded',()=>{
 const h=auto(1),before=JSON.stringify(h.table),p=JSON.stringify([...h.props]);h.ctx.previewLibraryV3AllColumns();h.ctx.previewLibraryV3Progress();assert.equal(h.run(false).status,'READ_ONLY');assert.equal(JSON.stringify(h.table),before);assert.equal(JSON.stringify([...h.props]),p);assert.equal(h.cache.size,0);
 assert.equal(h.ctx.libV3Clean_('出演：A\\r\\n<https://example.test/info>'),'出演：A https://example.test/info');
});
test('six auxiliary slots give RSS three turns and no job starves',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.ctx.registerLibraryV3BaselineAfterApproval();const called=[];
 h.ctx.libV3Run_=()=>{called.push('RSS');return {status:'OK'};};h.ctx.libV3AutoSpotify_=()=>{called.push('SPOTIFY');return {status:'OK'};};h.ctx.libV3AutoAudio_=()=>{called.push('AUDIO_QUEUE');return {status:'OK'};};h.ctx.refreshLibraryV3ProgressAfterApproval=()=>{called.push('DASHBOARD');return {status:'OK'};};
 for(let i=0;i<6;i++)h.ctx.scheduledLibraryV3();assert.deepEqual(called,['RSS','SPOTIFY','RSS','AUDIO_QUEUE','RSS','DASHBOARD']);
});
test('future additions require a separate enabled baseline-approved operation; no past backfill',()=>{
 const h=auto(1);assert.throws(()=>h.ctx.enableLibraryV3NewEpisodesAfterApproval());h.ctx.startLibraryV3AfterApproval();h.ctx.registerLibraryV3BaselineAfterApproval();assert.throws(()=>h.ctx.enableLibraryV3NewEpisodesAfterApproval('2020-01-01T00:00:00Z'));
 assert.equal(h.ctx.enableLibraryV3NewEpisodesAfterApproval().status,'FUTURE_NEW_ENABLED');assert.equal(h.ctx.libV3Config_().allowNew,true);assert.equal(h.triggers.length,0);
});
test('previously observed unknown RSS identities are reserved rather than resurrected by later enablement',()=>{
 const h=auto(1);h.ctx.startLibraryV3AfterApproval();h.items=[item(9)];h.run(true);h.run(true);const c=h.ctx.libV3Context_(true);
 assert.equal(c.index.registry.has(guid(9)),true);const p=h.ctx.libV3Plan_(item(9),c.feeds[0],c.rows,c.index);assert.equal(p.reasons.includes('previously_seen_identity'),true);assert.equal(h.data.length,2);
});
