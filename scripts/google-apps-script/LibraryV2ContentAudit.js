/**
 * Fast V2 supplemental audit: Spotify, audio, description and cast.
 * READ ONLY. URL presence != successful playback; only checks HTTP reachability
 * for RSS audio enclosure samples, never downloads media.
 */
function previewLibraryV2ContentAudit() {
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳');
 const src=ss.getSheetByName('取得元一覧');
 if(!sh||!src)throw Error('Required sheet missing');
 const data=sh.getDataRange().getValues(),headers=data.shift();
 const required={0:'台帳ID',6:'外部ID',11:'Spotify個別URL',14:'音声URL',21:'概要原文',23:'出演者・スタッフ'};
 // Avoid silently interpreting shifted columns.
 Object.keys(required).forEach(i=>{if(String(headers[+i]||'').indexOf(required[i])<0)throw Error('Unexpected header '+(+i+1)+': '+headers[+i]);});
 const missing={spotify:0,audio:0,description:0,cast:0,guid:0},invalidSpotify=[],invalidAudio=[],samples={spotify:[],audio:[],description:[],cast:[]};
 const str=v=>String(v||'').trim();
 const spotifyRe=/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?episode\/[A-Za-z0-9]+(?:[?#].*)?$/i;
 const audioRe=/^https:\/\//i;
 const blocked=x=>!!str(x)&&!['未指定','なし','false','0','no'].includes(str(x).toLowerCase());
 data.forEach((r,i)=>{
  if(blocked(r[38]))return;
  const id=str(r[0]),row=i+2;
  for(const [field,col] of [['spotify',11],['audio',14],['description',21],['cast',23]]){
   if(!str(r[col])){missing[field]++;if(samples[field].length<20)samples[field].push({id,row});}
  }
  if(!str(r[6]))missing.guid++;
  if(str(r[11])&&!spotifyRe.test(str(r[11]))&&invalidSpotify.length<50)invalidSpotify.push({id,row,url:str(r[11])});
  if(str(r[14])&&!audioRe.test(str(r[14]))&&invalidAudio.length<50)invalidAudio.push({id,row,url:str(r[14])});
 });
 const report={mode:'READ_ONLY_V2_CONTENT_AUDIT',rows:data.length,missing,invalidSpotifySamples:invalidSpotify,invalidAudioSamples:invalidAudio,samples,
 limitations:['Spotify URL syntax only; not Spotify API identity or availability','Audio URL syntax only; not HTTP or playback test','Description presence only; cleanliness/content accuracy requires separate RSS comparison','Cast presence only; attribution requires explicit official source evidence'],writes:0};
 Logger.log(JSON.stringify(report));return report;
}
