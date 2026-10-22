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
export {buildLibrarySearchIndex,searchLibrary};
