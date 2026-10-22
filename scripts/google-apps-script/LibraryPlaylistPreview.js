// GENERATED: node scripts/build-library-playlist-gas-preview.mjs
var LibraryPlaylistPreviewCore=(function(){
const {buildLibrarySearchIndex}=(function(){
/** READ_ONLY library-first discovery. Pure functions, no GAS/Sheets/Spotify network.
 * Proposals only: feed identity and editorial assignments must be validated upstream.
 */
const norm=s=>String(s??'').normalize('NFKC').toLocaleLowerCase('ja').trim();
const unique=a=>[...new Set((a||[]).map(x=>String(x||'').trim()).filter(Boolean))];
function buildLibrarySearchIndex({episodes=[],series=[],themes=[],episodeThemes=[]}={}){
 const themeMap=new Map(themes.map(t=>[String(t.themeId),t]));
 const byEpisode=new Map(),seenIds=new Set(),holds=[],idCounts=new Map();
 for(const e of episodes)idCounts.set(String(e.epId||''),(idCounts.get(String(e.epId||''))||0)+1);
 for(const e of episodes){
  const id=String(e.epId||'');
  if(!/^EP-\d+$/.test(id)||idCounts.get(id)!==1){if(!seenIds.has(id))holds.push({id,reason:'MISSING_OR_DUPLICATE_EP_ID'});seenIds.add(id);continue;}
  seenIds.add(id);
  if(e.excluded===true||e.deleted===true)continue;
  byEpisode.set(id,{...e,epId:id,cast:unique(e.cast),seriesIds:unique(e.seriesIds),searchText:norm([e.title,e.cleanDescription,e.show,...(e.cast||[])].join(' ')),themeIds:[]});
 }
 for(const link of episodeThemes){
  const e=byEpisode.get(String(link.epId)),theme=themeMap.get(String(link.themeId));
  if(!e||!theme||theme.active===false){holds.push({id:String(link.epId),reason:'INVALID_EPISODE_THEME_RELATION'});continue;}
  if(link.status!=='VERIFIED'&&link.status!=='EDITOR_APPROVED')continue;
  e.themeIds.push(String(link.themeId));
 }
 for(const e of byEpisode.values())e.themeIds=unique(e.themeIds);
 return {episodes:[...byEpisode.values()],series,themeDefinitions:[...themeMap.values()],holds,writes:0};
}
function searchLibrary(index,{query='',mode='all',limit=50,includeUnverified=false}={}){
 if(!['all','cast','series','theme'].includes(mode))throw Error('INVALID_MODE');
 if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('INVALID_LIMIT');
 const needle=norm(query),bySeries=new Map((index.series||[]).map(x=>[String(x.seriesId),x]));
 const byTheme=new Map((index.themeDefinitions||[]).map(x=>[String(x.themeId),x]));
 const result=(index.episodes||[]).filter(e=>{
  if(!includeUnverified&&e.identityStatus!=='EXACT')return false;
  const casts=(e.cast||[]).map(norm).join(' ');
  const ss=(e.seriesIds||[]).map(id=>norm(bySeries.get(id)?.title)).join(' ');
  const ts=(e.themeIds||[]).map(id=>norm(byTheme.get(id)?.label)).join(' ');
  const hay=mode==='cast'?casts:mode==='series'?ss:mode==='theme'?ts:[e.searchText,ss,ts].join(' ');
  return !needle||hay.includes(needle);
 }).sort((a,b)=>String(b.published||'').localeCompare(String(a.published||''))||a.epId.localeCompare(b.epId));
 return {status:'READ_ONLY_LIBRARY_SEARCH',mode,query,total:result.length,results:result.slice(0,limit).map(e=>({
  epId:e.epId,title:e.title,show:e.show,published:e.published||null,cast:e.cast,seriesIds:e.seriesIds,themeIds:e.themeIds,
  spotifyUrl:e.spotifyUrl||null,audioUrl:e.audioUrl||null,audioUrlPresence:!!e.audioUrl,
  audioReachability:e.audioReachability||'UNVERIFIED',source:e.source||'LIBRARY_LEDGER'
 })),writes:0,spotifyApiCalls:0};
}
return {buildLibrarySearchIndex,searchLibrary};

})();
/** Library-only selection. No network, Sheets writes, ID allocation or RSS scheduler. */
const norm=x=>String(x??'').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim();
const idPattern=/^EP-\d+$/;
const officialKinds=new Set(['OFFICIAL_RSS','OFFICIAL_JSON']);
const roles=new Set(['出演','MC','司会','ゲスト','聞き手','host','guest']);
const sensitive=new Set(['寺下まりか','太田昌彦','佐藤陽','高橋健一郎']);
function verifiedLibraryPeople(people=[]){
 return people.filter(p=>{
  let host;try{host=new URL(p.sourceUrl).hostname;}catch{return false;}
  const official=host==='asahi.com'||host.endsWith('.asahi.com')||['omny.fm','www.omny.fm','www.omnycontent.com','traffic.omny.fm'].includes(host);
  // Evidence is an attributed appearance section, never a whole description/ad mention.
  return official&&officialKinds.has(p.sourceKind)&&p.evidenceStatus==='VERIFIED'&&roles.has(p.role)&&
   p.evidenceSection==='APPEARANCE'&&norm(p.name)&&norm(p.evidenceText).includes(norm(p.name))&&
   (!sensitive.has(p.name)||p.personIdentityVerified===true);
 }).map(p=>({...p,name:String(p.name).trim()}));
}
function searchPlaylistLibrary({episodes=[],decisions=[],query={}}={}){
 const keywords=[...new Set((query.keywords||[]).map(norm).filter(Boolean))];
 if(!['AND','OR'].includes(query.operator||'AND'))throw Error('INVALID_OPERATOR');
 const limit=query.limit??50,offset=query.offset??0;
 if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0)throw Error('INVALID_PAGE');
 const boundary=(d,end)=>{if(!d)return end?Infinity:-Infinity;if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('INVALID_DATE');const n=Date.parse(d+(end?'T23:59:59.999+09:00':'T00:00:00+09:00'));if(!Number.isFinite(n))throw Error('INVALID_DATE');return n;};
 const from=boundary(query.from,false),to=boundary(query.to,true);if(from>to)throw Error('INVALID_PERIOD');
 const counts=new Map(),dm=new Map(),holds=[];
 for(const e of episodes)counts.set(e.epId,(counts.get(e.epId)||0)+1);
 for(const d of decisions){if(!idPattern.test(String(d.epId||'')))continue;dm.set(d.epId,dm.has(d.epId)?null:d);}
 const sanitized=[];
 for(const e of episodes){
  if(!idPattern.test(String(e.epId||''))||counts.get(e.epId)!==1){holds.push({epId:e.epId,reason:'MISSING_OR_DUPLICATE_EP_ID'});continue;}
  const decision=dm.get(e.epId),people=verifiedLibraryPeople(e.people);
  if(e.deleted===true||e.excluded===true||e.humanExcluded===true||decision?.humanExcluded===true||decision?.searchIncluded===false)continue;
  // Explicit verified decisions govern dedup/rebroadcast. Never infer exclusions from a title.
  if(decision?.status==='VERIFIED'&&['DUPLICATE','REBROADCAST'].includes(decision.classification))continue;
  const approved=decision?.status==='VERIFIED'&&decision.searchIncluded===true&&Boolean(decision.evidence);
  sanitized.push({...e,cast:people.map(p=>p.name),people,seriesIds:e.seriesIds||[],
   cleanDescription:[e.cleanDescription,...(e.relatedArticles||[]).map(a=>a.title)].filter(Boolean).join('\n'),
   selectionStatus:approved?'REVIEWED':'SCOPE_PENDING'});
 }
 const idx=buildLibrarySearchIndex({episodes:sanitized}),matches=idx.episodes.filter(e=>{
  if(query.shows?.length&&!query.shows.includes(e.show))return false;
  const t=Date.parse(e.publishedAt||e.published||'');if((query.from||query.to)&&(!Number.isFinite(t)||t<from||t>to))return false;
  if(query.people?.length&&!query.people.every(name=>e.cast.map(norm).includes(norm(name))))return false;
  const hits=keywords.map(k=>e.searchText.includes(k));return !hits.length||(query.operator==='OR'?hits.some(Boolean):hits.every(Boolean));
 }).sort((a,b)=>String(b.publishedAt||b.published||'').localeCompare(String(a.publishedAt||a.published||''))||a.epId.localeCompare(b.epId));
 return {status:'READ_ONLY_LIBRARY_PREVIEW',total:matches.length,results:matches.slice(offset,offset+limit),holds:[...holds,...idx.holds],writes:0,spotifyApiCalls:0};
}
function planLibraryPlaylist({episodes=[],decisions=[],query={},selectedEpIds=[],excludedEpIds=[],playlistId='',newPlaylistName=''}={}){
 if(playlistId&&newPlaylistName)throw Error('CHOOSE_EXISTING_OR_NEW_PLAYLIST');
 const excluded=new Set(excludedEpIds),selected=new Set(selectedEpIds),rows=[];
 // Iterate pages so selection can include results beyond the first page.
 for(let offset=0;;offset+=200){const page=searchPlaylistLibrary({episodes,decisions,query:{...query,limit:200,offset}});rows.push(...page.results);if(offset+200>=page.total)break;}
 const byId=new Map(rows.map(e=>[e.epId,e])),ready=[],holds=[],seenSpotify=new Set(),uriOwners=new Map();
 for(const e of episodes){const id=String(e.spotifyUrl||'').match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/)?.[1];if(id){const owners=uriOwners.get(id)||new Set();owners.add(e.epId);uriOwners.set(id,owners);}}
 for(const epId of selected){
  if(excluded.has(epId))continue;const e=byId.get(epId);
  if(!e){holds.push({epId,reason:'NOT_IN_CURRENT_SEARCH'});continue;}
  if(e.selectionStatus!=='REVIEWED'){holds.push({epId,reason:'SCOPE_PENDING'});continue;}
  if(e.identityStatus!=='EXACT'||!e.guid||!e.sourceUrl){holds.push({epId,reason:'IDENTITY_UNVERIFIED'});continue;}
  const sid=String(e.spotifyUrl||'').match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/)?.[1];
  if(!sid){holds.push({epId,reason:'SPOTIFY_URI_MISSING_OR_INVALID'});continue;}
  if(e.spotifyEvidenceStatus!=='VERIFIED'||!/^[A-Za-z0-9]{22}$/.test(e.spotifyShowId||'')){holds.push({epId,reason:'SPOTIFY_MAPPING_UNVERIFIED'});continue;}
  if(uriOwners.get(sid)?.size!==1||seenSpotify.has(sid)){holds.push({epId,reason:'DUPLICATE_SPOTIFY_MAPPING'});continue;}
  if(!Number.isFinite(Date.parse(e.publishedAt||e.published||''))){holds.push({epId,reason:'PUBLISHED_DATE_UNVERIFIED'});continue;}
  seenSpotify.add(sid);ready.push({...e,spotifyId:sid,uri:'spotify:episode:'+sid});
 }
 return {status:'PREVIEW_REQUIRES_APPROVAL',action:newPlaylistName?'CREATE_PRIVATE':'ADD_EXISTING',newPlaylistName,playlistId,query,ready,holds,writes:0,spotifyApiCalls:0};
}
/** Exact current native tab contract. No row-count target or inferred approval. */
function decisionsFromSheet(values){
 const [h=[],...rows]=values,at=name=>h.indexOf(name);for(const name of ['EP-ID','宇宙検索対象','判定区分','判定根拠','確認状態'])if(at(name)<0)throw Error('DECISION_HEADER_MISMATCH');
 return rows.filter(r=>idPattern.test(String(r[at('EP-ID')]||''))).map(r=>({epId:r[at('EP-ID')],searchIncluded:['対象','含める','採用','true',true].includes(r[at('宇宙検索対象')])?true:['対象外','除外','false',false].includes(r[at('宇宙検索対象')])?false:undefined,
  status:['確認済み','確定','VERIFIED'].includes(r[at('確認状態')])?'VERIFIED':'PENDING',classification:({'重複':'DUPLICATE','再配信':'REBROADCAST','再放送':'REBROADCAST'})[r[at('判定区分')]]||r[at('判定区分')],evidence:r[at('判定根拠')]||'',representativeEpId:r[at('代表EP-ID')]||''}));
}

return {searchPlaylistLibrary,planLibraryPlaylist,decisionsFromSheet};
})();

/** No install, configure, Spotify, mail or sheet writes. Deployment requires approval. */
function previewLibraryPlaylistSelection(options){
 const o=options||{},c=libV3Context_(false),tab=c.ss.getSheetByName('図書館・宇宙 検索対象判定');
 if(!tab)throw Error('Search decision tab missing');
 const values=tab.getRange(1,1,Math.min(tab.getLastRow(),6600),10).getValues();
 const decisions=LibraryPlaylistPreviewCore.decisionsFromSheet(values);
 const episodes=c.rows.map(r=>({epId:String(r[0]),show:String(r[1]),title:String(r[2]),
  publishedAt:r[3] instanceof Date?r[3].toISOString():String(r[3]||''),guid:String(r[6]||''),
  sourceUrl:String(r[32]||r[8]||''),cleanDescription:String(r[22]||''),spotifyUrl:String(r[11]||''),
  humanExcluded:libV2CpBlocked_(r[38]),people:[],identityStatus:'UNVERIFIED',spotifyEvidenceStatus:'UNVERIFIED'}));
 // Nonempty cast/Spotify cells are not upgraded to proof. Exact verification is a separate gate.
 const result=LibraryPlaylistPreviewCore.searchPlaylistLibrary({episodes,decisions,query:o.query||{}});
 const plan=LibraryPlaylistPreviewCore.planLibraryPlaylist({episodes,decisions,query:o.query||{},selectedEpIds:o.selectedEpIds||[],excludedEpIds:o.excludedEpIds||[],playlistId:o.playlistId||'',newPlaylistName:o.newPlaylistName||''});
 Logger.log(JSON.stringify({mode:'READ_ONLY_LIBRARY_PLAYLIST',sourceRows:episodes.length,decisionRows:decisions.length,matches:result.total,ready:plan.ready.length,holds:plan.holds,writes:0,spotifyApiCalls:0}));
 return {search:result,plan,writes:0,spotifyApiCalls:0};
}
