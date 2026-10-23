/**
 * Fast V2 quality gate, READ ONLY.
 * Never confuses missing audio URL with a proven dead audio file.
 * Use previewLibraryV2ContentAudit() for the entire ledger.
 * Use previewLibraryV2AudioProbe(20) for a small, bounded HTTP check.
 * No Spotify API calls, no episode writes, no trigger creation.
 */
function libV2QualityData_(){
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳');
 if(!sh)throw Error('Episode ledger missing');
 const rows=sh.getDataRange().getValues(),headers=rows.shift();
 const cols={id:0,guid:6,spotify:11,audio:14,description:21,cast:23,excluded:38};
 const labels={id:'台帳ID',guid:'外部ID',spotify:'Spotify個別URL',audio:'音声URL',description:'概要原文',cast:'出演者',excluded:'人間除外'};
 Object.keys(cols).forEach(k=>{if(!String(headers[cols[k]]||'').includes(labels[k]))throw Error('Header mismatch '+k+' '+headers[cols[k]]);});
 return {rows,cols};
}
function libV2QualityClassify_(r,c){
 const s=v=>String(v==null?'':v).trim();
 const excluded=!!s(r[c.excluded])&&!['未指定','なし','false','0','no'].includes(s(r[c.excluded]).toLowerCase());
 const spotify=s(r[c.spotify]),audio=s(r[c.audio]),description=s(r[c.description]),cast=s(r[c.cast]);
 const spotifyId=(spotify.match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?episode\/([A-Za-z0-9]+)(?:[?#].*)?$/i)||[])[1]||'';
 const audioSyntax=/^https:\/\/[^\s]+$/i.test(audio);
 const quality={
  spotify:!spotify?'MISSING':spotifyId?'URL_FORMAT_OK_UNVERIFIED':'INVALID_URL',
  audio:!audio?'MISSING':audioSyntax?'URL_FORMAT_OK_UNVERIFIED':'INVALID_URL',
  description:!description?'MISSING':'PRESENT_UNCLEANED_OR_UNVERIFIED',
  cast:!cast?'MISSING':'PRESENT_UNVERIFIED',
  guid:s(r[c.guid])?'PRESENT_UNVERIFIED':'MISSING'
 };
 // Eligibility is provisional until Spotify identity/availability has been verified.
 const playlist='HOLD_SPOTIFY_IDENTITY_UNVERIFIED';
 return {excluded,quality,playlist,spotifyId};
}
function previewLibraryV2ContentAudit(){
 const {rows,cols}=libV2QualityData_(),counts={},samples=[],holds={};
 rows.forEach((r,i)=>{
  const q=libV2QualityClassify_(r,cols);
  if(q.excluded){holds.HUMAN_EXCLUDED=(holds.HUMAN_EXCLUDED||0)+1;return;}
  for(const [field,status] of Object.entries(q.quality)){
   const key=field+':'+status;counts[key]=(counts[key]||0)+1;
  }
  if(samples.length<30&&Object.values(q.quality).some(v=>v==='MISSING'||v==='INVALID_URL'))
   samples.push({id:String(r[cols.id]),row:i+2,quality:q.quality});
 });
 const result={mode:'READ_ONLY_V2_QUALITY',rows:rows.length,counts,holds,samples,
 playlistGate:'HOLD until Spotify episode identity and availability verified',
 limitations:['Audio URL format does not establish media availability','Cast and description contents not yet verified against source','RSS GUID is not Spotify episode ID'],writes:0};
 Logger.log(JSON.stringify(result));return result;
}
/**
 * Optional small sample only: request 1 byte of audio.
 * Some hosts reject Range or HEAD, so 403/405/416 is INCONCLUSIVE,
 * not evidence that the media does not exist.
 * Never probes more than 20 URLs in one invocation.
 */
function previewLibraryV2AudioProbe(limit){
 limit=limit==null?10:Number(limit);
 if(!Number.isInteger(limit)||limit<1||limit>20)throw Error('limit must be 1..20');
 const {rows,cols}=libV2QualityData_(),selected=[];
 rows.forEach((r,i)=>{
  if(selected.length>=limit)return;
  const q=libV2QualityClassify_(r,cols);
  if(q.excluded||q.quality.audio!=='URL_FORMAT_OK_UNVERIFIED')return;
  selected.push({id:String(r[cols.id]),row:i+2,url:String(r[cols.audio]).trim()});
 });
 const responses=UrlFetchApp.fetchAll(selected.map(p=>({url:p.url,method:'get',headers:{Range:'bytes=0-0'},followRedirects:true,muteHttpExceptions:true})));
 const results=responses.map((res,i)=>{
  const status=res.getResponseCode();
  const verdict=(status===200||status===206)?'HTTP_REACHABLE_NOT_PLAYBACK_VERIFIED':
   (status===404||status===410)?'HTTP_NOT_FOUND_AT_CHECK_TIME':'INCONCLUSIVE_HTTP_'+status;
  return {id:selected[i].id,row:selected[i].row,http:status,verdict};
 });
 const report={mode:'READ_ONLY_V2_AUDIO_PROBE',tested:results.length,results,writes:0};
 Logger.log(JSON.stringify(report));return report;
}
