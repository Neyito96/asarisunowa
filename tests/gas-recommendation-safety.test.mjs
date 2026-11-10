import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const base='scripts/google-apps-script/';
const spotifyId='033KOuSUvlldfHUcl3aQXK';
const rss='https://anchor.fm/s/11499d594/podcast/rss';
const title='AIニュースブリーフィング', maker='WINSLAJA';
function env() {
  const properties=new Map(); let handlers=[], calls=0, released=0;
  const ctx=vm.createContext({console:{log(){}},Date,JSON,Set,encodeURIComponent,
    normalizeTitle:s=>String(s||'').trim().toLowerCase(),normalizePodcastGenre_:()=> 'ビジネス',
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
    Utilities:{base64Encode:s=>Buffer.from(s).toString('base64'),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s)=>crypto.createHash('sha256').update(s).digest()},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},
    ScriptApp:{getProjectTriggers:()=>handlers.map(h=>({getHandlerFunction:()=>h}))},
    SPREADSHEET_ID:'mock',SpreadsheetApp:{ProtectionType:{SHEET:'sheet',RANGE:'range'},flush(){}},
    UrlFetchApp:{fetch:()=>{calls++;throw Error('unexpected HTTP');}}});
  vm.runInContext(fs.readFileSync(base+'PodcastPlatformSync.js','utf8')+'\n'+fs.readFileSync(base+'Spotify.js','utf8'),ctx);
  return {ctx,properties,setHandlers:v=>handlers=v,get calls(){return calls;},get released(){return released;}};
}
function spotify(e,item={id:spotifyId,name:title,publisher:maker}) {
  e.properties.set('SPOTIFY_CLIENT_ID','fixture');e.properties.set('SPOTIFY_CLIENT_SECRET','fixture');
  e.ctx.recommendationFetch_=url=>JSON.stringify(url.includes('/api/token')?{access_token:'fixture'}:item);
}
test('title-only route and independent identity required; no HTTP',()=>{
 const e=env();assert.equal(e.ctx.findSpotifyShowByTitle_(title),null);
 assert.equal(e.ctx.findVerifiedRecommendationSpotify_(title,maker,[]).url,'');assert.equal(e.calls,0);
});
test('AIニュースブリーフィング RSS show ID regression, wrong publisher, missing publisher, wrong ID, ambiguity, auth',()=>{
 const e=env();spotify(e);assert.equal(e.ctx.findVerifiedRecommendationSpotify_(title,maker,[spotifyId]).url,'https://open.spotify.com/show/'+spotifyId);
 for(const item of [{id:spotifyId,name:title,publisher:'別人'},{id:spotifyId,name:title},{id:'other',name:title,publisher:maker}]) {
  spotify(e,item);assert.equal(e.ctx.findVerifiedRecommendationSpotify_(title,maker,[spotifyId]).url,'');
 }
 assert.equal(e.ctx.findVerifiedRecommendationSpotify_(title,maker,[spotifyId,'other']).reason,'REVIEW_AMBIGUOUS');
 e.properties.clear();assert.equal(e.ctx.findVerifiedRecommendationSpotify_(title,maker,[spotifyId]).reason,'AUTH_MISSING');
});
test('Apple requires exact publisher and RSS; ambiguity and missing RSS rejected',()=>{
 const e=env();const item={collectionName:title,artistName:maker,feedUrl:rss,collectionId:6788020075};
 const check=items=>{e.ctx.recommendationFetch_=()=>JSON.stringify({results:items});return e.ctx.findExactApplePodcast_(title,maker,rss,'');};
 assert.ok(check([item]));assert.equal(check([item,item]),null);
 for(const change of [{artistName:''},{artistName:'other'},{feedUrl:rss+'other'}])assert.equal(check([{...item,...change}]),null);
 assert.equal(e.ctx.findExactApplePodcast_(title,'',rss,''),null);
 assert.equal(e.ctx.findExactApplePodcast_(title,maker,'',''),null);
});
test('RSS identity verified before using links; API auth failure recorded; raw genre retained',()=>{
 const e=env();spotify(e);e.ctx.findExactApplePodcast_=()=>null;
 e.ctx.readPodcastFeedMetadata_=()=>({title,maker,links:['https://open.spotify.com/show/'+spotifyId],rawGenre:['Business'],genre:'ビジネス'});
 let result=e.ctx.resolveListenerPodcastPlatforms_(title,maker,'',rss);
 assert.equal(result.spotify,'https://open.spotify.com/show/'+spotifyId);assert.equal(result.genre,'ビジネス');
 e.ctx.readPodcastFeedMetadata_=()=>({title,maker:'other',links:['https://open.spotify.com/show/'+spotifyId]});
 result=e.ctx.resolveListenerPodcastPlatforms_(title,maker,'',rss);assert.equal(result.spotify,'');assert.equal(result.reasons.rss,'REVIEW_RSS_IDENTITY');
 e.ctx.findVerifiedRecommendationSpotify_=()=>{throw Error('HTTP_401');};
 assert.equal(e.ctx.resolveListenerPodcastPlatforms_(title,maker,'',rss).reasons.spotify,'HTTP_401');
});
test('manual その他 and F19/Q19 never queued for replacement',()=>{
 const e=env(),updates=[];e.ctx.queuePodcastGenreUpdate_(updates,19,17,'その他','ビジネス');
 e.ctx.queuePodcastGenreUpdate_(updates,19,17,'ビジネス','ニュース');
 e.ctx.queuePodcastCellUpdate_(updates,19,6,'https://open.spotify.com/show/'+spotifyId,'wrong');assert.equal(updates.length,0);
});
test('URL host spoofing, private HTTP, auth and redirects rejected; body bounded',()=>{
 const e=env();for(const url of ['http://anchor.fm/rss','https://127.0.0.1/rss','https://anchor.fm.evil.test/rss','https://user@anchor.fm/rss','https://anchor.fm:443/rss',rss+'?token=secret'])assert.equal(e.ctx.isSafePublicPodcastRss_(url),false,url);
 assert.equal(e.ctx.spotifyRecommendationId_('https://evil.test/open.spotify.com/show/'+spotifyId),'');
 for(const [code,size,reason] of [[302,1,'REDIRECT'],[200,2000001,'OVERSIZE'],[429,1,'HTTP_429']]){
  e.ctx.UrlFetchApp.fetch=(url,options)=>{assert.equal(options.followRedirects,false);return {getResponseCode:()=>code,getContent:()=>({length:size}),getContentText:()=>''};};
  assert.throws(()=>e.ctx.recommendationFetch_(rss),new RegExp(reason));
 }
});
function sheet(e,key,count=1) {
 const schema=vm.runInContext('RECOMMENDATION_SCHEMAS.'+key,e.ctx);
 const headers=Array.from({length:schema.width},(_,i)=>'verified-header-'+i);
 const rows=[headers,...Array.from({length:count},()=>{let r=Array(schema.width).fill('');r[1]=title;r[schema.maker-1]=maker;r[schema.columns.rss-1]=rss;return r;})];
 const formulas=new Map();let writes=0,protectedCell=false;
 const s={getName:()=>schema.name,getLastColumn:()=>schema.width,getLastRow:()=>rows.length,
 getProtections:type=>type==='sheet'&&protectedCell?[{}]:[],getRange:(r,c,n=1,w=1)=>({
 getDisplayValues:()=>rows.slice(r-1,r-1+n).map(x=>x.slice(c-1,c-1+w)),getValue:()=>rows[r-1][c-1],getFormula:()=>formulas.get(r+':'+c)||'',
 setValue:v=>{writes++;rows[r-1][c-1]=v;}})};
 e.properties.set('RECOMMENDATION_HEADERS_'+schema.name,JSON.stringify(headers));
 return {s,schema,rows,formulas,get writes(){return writes;},protect:()=>protectedCell=true};
}
function setup(e,sheets,write=true){
 e.ctx.SpreadsheetApp.openById=()=>({getSheetByName:name=>sheets.find(x=>x.s.getName()===name)?.s});
 if(write){e.properties.set('RECOMMENDATION_WRITE_APPROVED','true');e.properties.set('RECOMMENDATION_WRITER_AUDIT_APPROVED','true');}
 e.ctx.resolveListenerPodcastPlatforms_=()=>({spotify:'https://open.spotify.com/show/'+spotifyId,genre:'ビジネス',reasons:{spotify:'VERIFIED',genre:'VERIFIED'}});
}
test('both column mappings, retry idempotence, READ_ONLY no writes/properties',()=>{
 const e=env(),a=sheet(e,'posusume'),b=sheet(e,'risuoshi');setup(e,[a,b],false);
 const before=JSON.stringify([...e.properties]);e.ctx.runRecommendationPodcastDailySync();assert.equal(a.writes+b.writes,0);assert.equal(JSON.stringify([...e.properties]),before);
 setup(e,[a,b]);e.ctx.runRecommendationPodcastDailySync();assert.equal(a.rows[1][5],'https://open.spotify.com/show/'+spotifyId);assert.equal(b.rows[1][9],a.rows[1][5]);
 const writes=a.writes+b.writes;e.ctx.runRecommendationPodcastDailySync();assert.equal(a.writes+b.writes,writes);
});
test('schema mismatch stops shelf; other shelf succeeds; row failure retries safely',()=>{
 const e=env(),a=sheet(e,'posusume'),b=sheet(e,'risuoshi',2);setup(e,[a,b]);a.rows[0].reverse();
 let n=0;e.ctx.resolveListenerPodcastPlatforms_=()=>{if(n++===0)throw Error('HTTP_503');return {genre:'ビジネス',reasons:{genre:'VERIFIED'}};};
 const out=e.ctx.runRecommendationPodcastDailySync();assert.equal(out.errors[0].reason,'STOP_HEADER_MISMATCH');assert.equal(a.writes,0);assert.equal(b.writes,1);
 e.ctx.runRecommendationPodcastDailySync();assert.equal(b.writes,1);assert.equal(e.released,2);
});
test('legacy direct wrappers and duplicate daily triggers stop; lock and installer guards',()=>{
 for(const handlers of [['syncListenerPodcastPlatforms'],['syncRecommendedPodcastPlatforms'],['RISU_applyAllPlatforms'],['syncAllPodcastPlatforms'],['runRecommendationPodcastDailySync','runRecommendationPodcastDailySync']]) {
  const e=env();e.setHandlers(handlers);assert.throws(()=>e.ctx.runRecommendationPodcastDailySync(),/STOP_TRIGGER_CONFLICT/);assert.equal(e.released,1);
 }
 const e=env();e.ctx.LockService.getScriptLock=()=>({tryLock:()=>false});assert.equal(e.ctx.runRecommendationPodcastDailySync().status,'BUSY');assert.throws(()=>e.ctx.installRecommendationPodcastDailySync(),/HOLD/);
});
test('write rechecks existing value, formula, protections and row identity',()=>{
 const e=env(),a=sheet(e,'posusume');const original=a.rows[1].slice();
 a.rows[1][5]='manual';assert.equal(e.ctx.writeRecommendationCell_(a.s,2,6,'candidate',original,a.schema),false);
 a.rows[1][5]='';a.formulas.set('2:6','=""');assert.equal(e.ctx.writeRecommendationCell_(a.s,2,6,'candidate',original,a.schema),false);
 a.formulas.clear();a.rows[1][1]='changed';assert.equal(e.ctx.writeRecommendationCell_(a.s,2,6,'candidate',original,a.schema),false);
 a.rows[1][1]=title;a.protect();assert.equal(e.ctx.writeRecommendationCell_(a.s,2,6,'candidate',original,a.schema),false);assert.equal(a.writes,0);
});
test('HTTP and deadline budgets stop fetching',()=>{
 const e=env();vm.runInContext('recommendationBudget_={deadline:Date.now()+10000,http:40,maxHttp:40,cache:{}}',e.ctx);assert.throws(()=>e.ctx.recommendationFetch_(rss),/BUDGET/);
 vm.runInContext('recommendationBudget_={deadline:0,http:0,maxHttp:40,cache:{}}',e.ctx);assert.throws(()=>e.ctx.recommendationFetch_(rss),/BUDGET/);assert.equal(e.calls,0);
});

test('Spotify official show metadata fallback; missing or conflicting publishers held',()=>{
 const e=env();spotify(e);const item={id:spotifyId,name:title};
 for(const [html,expected] of [['{"publisherName":"WINSLAJA"}',true],['{}',false],['{"publisherName":"WINSLAJA","creatorName":"other"}',false]]) {
  e.ctx.recommendationFetch_=url=>url.includes('/api/token')?JSON.stringify({access_token:'fixture'}):url.includes('api.spotify.com')?JSON.stringify(item):html;
  assert.equal(!!e.ctx.findVerifiedRecommendationSpotify_(title,maker,[spotifyId]).url,expected);
 }
});
