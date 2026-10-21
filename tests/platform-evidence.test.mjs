import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as E from '../lib/podcast-platform-evidence.mjs';
const gasPath='scripts/google-apps-script/';
function gas(extra={}){const ctx=vm.createContext({console:{log(){}},...extra});for(const file of ['PlatformEvidence.js','PlatformEvidenceAdapter.js','PodcastPlatformSync.js'])vm.runInContext(fs.readFileSync(gasPath+file,'utf8'),ctx);return ctx;}
const rss='https://feeds.example.com/Show.xml?region=JP';
const apple={collectionId:123,collectionViewUrl:'https://podcasts.apple.com/jp/podcast/id123',feedUrl:rss,artworkUrl600:'https://images.example.com/123.jpg',primaryGenreName:'News',artistName:'Host'};
for(const [url,provider,level] of [
  ['https://open.spotify.com/show/Ab1','spotify','programme'],
  ['https://open.spotify.com/episode/Ab1','spotify','episode'],
  ['https://podcasts.apple.com/jp/podcast/name/id123?i=456','apple','episode'],
  [apple.collectionViewUrl,'apple','programme'],
  ['https://music.amazon.co.jp/podcasts/abc/name','amazon','programme'],
  ['https://music.amazon.com/podcasts/abc/episodes/def','amazon','episode'],
  ['https://listen.style/p/news','listen','programme'],
  ['https://listen.style/p/news/abc','listen','episode'],
  ['https://stand.fm/channels/abc','standfm','programme'],
  ['https://stand.fm/episodes/abc','standfm','episode'],
  ['https://www.youtube.com/playlist?list=PLabc','youtube','programme'],
  ['https://www.youtube.com/watch?v=abc','youtube','episode'],
  ['https://www.youtube.com/@news','youtube','programme'],
  ['https://pocketcasts.com/follow/'+encodeURIComponent(rss),'pocketcasts','import'],
  ['https://pca.st/abcd','pocketcasts','unknown'],
  ['https://pody.jp/channel/abc','pody','unknown'],
  ['https://open.spotify.com.evil.example/show/abc','website','website'],
  ['https://secret@example.com/rss','', 'invalid'],
])test(`URL level: ${url}`,()=>{const x=E.classifyPlatformUrl(url);assert.equal(x.provider,provider);assert.equal(x.level,level);});
test('feed path case, query and protocol remain identity-bearing',()=>{for(const other of [rss.toLowerCase(),rss.replace('JP','US'),rss.replace('https:','http:')])assert.notEqual(E.publicUrl(rss),E.publicUrl(other));assert.equal(E.publicUrl('https://FEEDS.example.com/Show.xml?region=JP#top'),rss);});
test('YouTube list and Apple episode IDs are preserved',()=>{const x='https://www.youtube.com/playlist?list=PLabc';assert.equal(E.confirmedProgrammeLinks([x]).links.youtube,x);assert.match(E.classifyPlatformUrl(apple.collectionViewUrl+'?i=456').url,/i=456/);});
test('same title alone, wrong feed, ambiguous or conflicting IDs stay held',()=>{
  assert.equal(E.matchAppleProgramme({title:'same'},[apple]).state,'HOLD');
  assert.equal(E.matchAppleProgramme({rss:rss.toLowerCase()},[apple]).state,'HOLD');
  assert.equal(E.matchAppleProgramme({rss},[apple,apple]).reason,'MULTIPLE_CANDIDATES');
  assert.equal(E.matchAppleProgramme({rss},[{...apple,collectionId:999}]).state,'HOLD');
  assert.equal(E.matchAppleProgramme({rss,url:apple.collectionViewUrl.replace('123','999')},[apple]).state,'HOLD');
  assert.equal(E.matchAppleProgramme({rss},[apple]).state,'MATCH');
});
test('links hold multiple programme destinations and episode/import/unknown paths',()=>{const r=E.confirmedProgrammeLinks(['https://open.spotify.com/show/abc','https://open.spotify.com/show/def','https://open.spotify.com/episode/ghi','https://pca.st/abc']);assert.equal(r.links.spotify,undefined);assert.equal(r.held.length,3);});
const anchor={rss,guid:'guid-a',audioUrl:'https://audio.example.com/a.mp3',title:'Episode',publishedAt:'2026-10-21T00:00:00Z'};
const episode={...anchor,url:'https://open.spotify.com/episode/abc'};
test('episode match needs feed + strong identity + metadata; human exclusion wins',()=>{
 assert.equal(E.matchEpisode(anchor,[episode]).state,'MATCH');
 assert.equal(E.matchEpisode({...anchor,excluded:true},[episode]).reason,'HUMAN_EXCLUDED');
 for(const candidate of [{...episode,rss:'https://other.example/rss'},{...episode,guid:'other'},{...episode,title:'other'},{...episode,url:'https://open.spotify.com/show/abc'},{...episode,guid:'',audioUrl:''}])assert.equal(E.matchEpisode(anchor,[candidate]).state,'HOLD');
 assert.equal(E.matchEpisode(anchor,[episode,episode]).state,'HOLD');
});
test('old browser link order is preserved',()=>assert.deepEqual(E.orderPlatformLinks([{label:'Apple Podcasts'},{label:'YouTube'},{label:'Spotify'},{label:'Spotify'}]).map(x=>x.label),['YouTube','Spotify','Apple Podcasts']));
test('GAS generated copy is current and has no URL constructor dependency',()=>{execFileSync(process.execPath,['scripts/generate-platform-evidence.mjs','--check']);const ctx=gas();assert.equal(ctx.PodcastPlatformEvidence.matchAppleProgramme({rss},[apple]).state,'MATCH');assert.equal(vm.runInContext('typeof URL',ctx),'undefined');});
test('old programme sync delegates to same safe adapter without Spotify title search',()=>{
 const ctx=gas({readPodcastFeedLinks_:()=>[],readPodcastFeedMetadata_:()=>null});
 // Declarations in the existing file override mocks; replace them after load.
 ctx.readPodcastFeedLinks_=()=>['https://www.youtube.com/playlist?list=PLabc','https://open.spotify.com/episode/ad'];
 ctx.readPodcastFeedMetadata_=()=>({artwork:'https://images.example.com/rss.jpg',maker:'Publisher',genre:'News'});
 const r=ctx.resolvePodcastPlatformsByEvidence_('same','',rss,()=>({results:[apple]}));
 assert.equal(r.resolved.youtube,'https://www.youtube.com/playlist?list=PLabc');assert.equal(r.resolved.spotify,undefined);assert.equal(r.resolved.artwork,'https://images.example.com/rss.jpg');assert.equal(r.evidence.state,'MATCH');
 ctx.findSpotifyShowByTitle_=()=>{throw Error('must not search Spotify');};
 assert.equal(ctx.resolveListenerPodcastPlatforms_('same','','','').apple,undefined);
});
test('RSS-only metadata survives an unavailable Apple API with explicit failure state',()=>{const ctx=gas();ctx.readPodcastFeedLinks_=()=>[];ctx.readPodcastFeedMetadata_=()=>({artwork:'https://images.example.com/rss.jpg'});const r=ctx.resolvePodcastPlatformsByEvidence_('same','',rss,()=>{throw Error('APPLE_HTTP_429');});assert.equal(r.evidence.reason,'RATE_LIMIT');assert.equal(r.resolved.artwork,'https://images.example.com/rss.jpg');});

const headers=['番組URL','番組名','おすすめ朝リス','受付日時','ひとこと','アートワーク','配信者 / Host','RSS','YouTube','Spotify','Amazon Music','Apple Podcasts','Pocket Casts','LISTEN','stand.fm','Pody','番組HP','ジャンル'];
function daily(count=1,options={}){
 const rows=[headers,...Array.from({length:count},(_,i)=>['https://example.com/show'+i,'Show '+i,'','','','','',rss,'','','','','','','','','',''])];
 let writes=0,requests=0,locks=0;const properties={};const formulas=new Map();
 const sh={getDataRange:()=>({getValues:()=>structuredClone(rows)}),getRange:(r,c,n,w)=>({getValues:()=>[rows[r-1].slice(c-1,c-1+w)],getValue:()=>options.badReadback&&writes?'wrong':rows[r-1][c-1],getFormula:()=>options.conflict?'=FORMULA()':formulas.get(r+':'+c)||'',setValue:v=>{rows[r-1][c-1]=v;writes++;}})};
 const ctx=gas({PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>{properties[k]=v;}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sh})},LockService:{getScriptLock:()=>({tryLock:()=>{locks++;return true;},releaseLock:()=>{locks--;}})},Utilities:{sleep(){}},UrlFetchApp:{fetch:()=>{requests++;return {getResponseCode:()=>options.status||200,getContentText:()=>JSON.stringify({results:[apple]})};}}});
 ctx.readPodcastFeedLinks_=()=>[];ctx.readPodcastFeedMetadata_=()=>null;
 vm.runInContext(fs.readFileSync('scripts/google-apps-script-risu-apple-enrichment.gs','utf8'),ctx);
 return {ctx,rows,formulas,properties,stats:()=>({writes,requests,locks})};
}
test('preview never writes, all 105 rows included and newly submitted row is included next run',()=>{const d=daily(105);let r=d.ctx.RISU_previewAllPlatforms();assert.equal(r.inspected,105);assert.equal(d.stats().writes,0);assert.equal(d.stats().requests,105);d.rows.push([...d.rows[1]]);r=d.ctx.RISU_previewAllPlatforms();assert.equal(r.inspected,106);});
test('daily preserves nonblank values, persists artwork and verifies each write',()=>{const d=daily();d.rows[1][5]='https://images.example.com/human.jpg';const r=d.ctx.RISU_applyAllPlatforms();assert.equal(d.rows[1][5],'https://images.example.com/human.jpg');assert.equal(d.rows[1][11],apple.collectionViewUrl);assert.equal(r.writes,4);assert.equal(r.verifiedCells.length,4);assert.deepEqual(Array.from(r.verifiedCells,x=>headers[x.column-1]).sort(),['Apple Podcasts','ジャンル','番組HP','配信者 / Host'].sort());assert.equal(d.stats().locks,0);});
test('formula conflict stops before overwriting and lock is released',()=>{const d=daily(1,{conflict:true});assert.throws(()=>d.ctx.RISU_applyAllPlatforms(),/CELL_CONFLICT/);assert.equal(d.stats().writes,0);assert.equal(d.stats().locks,0);});
test('failed readback stops remaining cells and releases lock',()=>{const d=daily(1,{badReadback:true});assert.throws(()=>d.ctx.RISU_applyAllPlatforms(),/READBACK_FAILED/);assert.equal(d.stats().writes,1);assert.equal(d.stats().locks,0);});
test('429 halts Apple requests for remaining rows; later rows explicitly deferred',()=>{const d=daily(3,{status:429});const r=d.ctx.RISU_previewAllPlatforms();assert.equal(d.stats().requests,1);assert.equal(r.requestsFailed,1);assert.equal(r.deferred,2);assert.equal(r.inspected,3);});
test('daily installer refuses old handler conflicts and does not duplicate current trigger',()=>{const d=daily();let creates=0;d.ctx.ScriptApp={getProjectTriggers:()=>[{getHandlerFunction:()=> 'RISU_applyAppleEnrichment'}],newTrigger:()=>{creates++;throw Error('must not create');}};assert.throws(()=>d.ctx.RISU_installDailyEnrichment(),/競合/);assert.equal(creates,0);d.ctx.ScriptApp.getProjectTriggers=()=>[{getHandlerFunction:()=> 'RISU_applyAllPlatforms'}];assert.equal(d.ctx.RISU_installDailyEnrichment().triggers,1);assert.equal(creates,0);});
test('Apple explicit programme identity can fill missing RSS; episode URL cannot',()=>{const d=daily();d.rows[1][0]=apple.collectionViewUrl;d.rows[1][7]='';const r=d.ctx.RISU_applyAllPlatforms();assert.equal(r.matched,1);assert.equal(d.rows[1][7],rss);const e=daily();e.rows[1][0]=apple.collectionViewUrl+'?i=456';e.rows[1][7]='';assert.equal(e.ctx.RISU_previewAllPlatforms().withoutRss,1);assert.equal(e.stats().requests,0);});
test('explicit inactive row is not fetched and blank genre never overwrites human value',()=>{const d=daily();d.rows[0].push('巡回状態');d.rows[1].push('除外');assert.equal(d.ctx.RISU_previewAllPlatforms().excluded,1);assert.equal(d.stats().requests,0);const a=daily();a.rows[1][17]='人間の分類';a.ctx.RISU_applyAllPlatforms();assert.equal(a.rows[1][17],'人間の分類');});
test('channel metadata beginning with formula syntax is never written as a formula',()=>{const d=daily();d.ctx.readPodcastFeedMetadata_=()=>({maker:'=IMPORTDATA("x")',genre:'=1+1'});d.ctx.RISU_applyAllPlatforms();assert.equal(d.rows[1][6],'');assert.equal(d.rows[1][17],'');});
test('RISU discovery reuses structural RSS links; does not scan HTML or episode text',()=>{const d=daily();d.ctx.readPodcastFeedLinks_=()=>['https://open.spotify.com/show/real'];const result=d.ctx.RISU_discoverRssPlatformLinks_(rss);assert.equal(result.spotify,'https://open.spotify.com/show/real');assert.equal(d.stats().requests,0);});
test('cursor is untouched in preview; budget/rate-limited apply resumes after last attempted row',()=>{const d=daily(3,{status:429});d.ctx.RISU_previewAllPlatforms();assert.deepEqual(d.properties,{});const r=d.ctx.RISU_applyAllPlatforms();assert.equal(r.deferred,2);assert.equal(d.properties.RISU_ENRICH_NEXT_ROW,'3');const next=d.ctx.RISU_applyAllPlatforms();assert.equal(next.proposals[0].row,3);});
test('existing submission contracts retain 17/18 columns and accept posts when enrichment fails',()=>{
 const d=daily();vm.runInContext(fs.readFileSync(gasPath+'PostWrite.js','utf8'),d.ctx);d.ctx.ensurePodcastMetadataHeaders_=()=>{};d.ctx.resolveListenerPodcastPlatforms_=()=>{throw Error('directory unavailable');};
 const saved=[];const sheet={appendRow:x=>saved.push(x)};
 d.ctx.appendPostRow_(sheet,'podcast','https://open.spotify.com/show/abc','My title','Listener','Host',rss,'','Comment','https://images.example.com/a.jpg','');
 assert.equal(saved[0].length,18);assert.equal(saved[0][1],'My title');assert.equal(saved[0][2],'Listener');assert.equal(saved[0][4],'Comment');assert.equal(saved[0][5],'https://images.example.com/a.jpg');assert.equal(saved[0][7],rss);
 d.ctx.appendPostRow_(sheet,'listenerPodcast','https://open.spotify.com/show/abc','Other title','Maker','',rss,'2026-10-21','Other comment','','');
 assert.equal(saved[1].length,17);assert.equal(saved[1][5],'https://open.spotify.com/show/abc');assert.equal(saved[1][3],'2026-10-21');assert.equal(saved[1][4],'Other comment');
});
test('a request deferred before execution does not advance its continuation position',()=>{const d=daily(3);d.ctx.resolvePodcastPlatformsByEvidence_=()=>({resolved:{},evidence:{state:'DEFERRED',reason:'RUN_BUDGET'}});const r=d.ctx.RISU_applyAllPlatforms();assert.equal(r.deferred,3);assert.equal(d.properties.RISU_ENRICH_NEXT_ROW,'2');assert.equal(d.stats().requests,0);});
