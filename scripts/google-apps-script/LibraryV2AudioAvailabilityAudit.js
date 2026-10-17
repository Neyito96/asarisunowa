/**
 * READ-ONLY, bounded audio URL availability probe.
 * Does NOT download media bodies: HEAD only, max 5 URLs, no redirects followed.
 * HTTP 200/206 is a reachable signal, not proof of full playable audio.
 * HTTP 403/405/429/503 and redirect are INCONCLUSIVE, never auto-delete.
 * Uses existing ledger, no checkpoint, properties, triggers or sheet mutations.
 */
function auditLibraryV2MediaTalkPilotAudio5() {
  return libV2AudioAuditByIds_(['EP-05585','EP-05584','EP-05583','EP-05582','EP-05581']);
}
function auditLibraryV2OldNewsAudio5() {
  // Samples first five *oldest* ledger rows of ニュースの現場から
  const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh=ss.getSheetByName('エピソード台帳');
  const rows=sh.getDataRange().getValues().slice(1);
  const found=rows.filter(r=>libV2CpNorm_(r[1])==='ニュースの現場から')
    .sort((a,b)=>String(a[3]||'').localeCompare(String(b[3]||''))).slice(0,5);
  return libV2AudioAuditByIds_(found.map(r=>String(r[0])));
}
function libV2AudioAuditByIds_(ids) {
  if(ids.length>5||new Set(ids).size!==ids.length)throw Error('Up to five unique IDs only');
  const started=Date.now(), ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),
    sh=ss.getSheetByName('エピソード台帳'),rows=sh.getDataRange().getValues().slice(1);
  const byId=new Map();
  rows.forEach(r=>{const id=String(r[0]||'');if(ids.includes(id)){
    if(byId.has(id))throw Error('Duplicate EP-ID '+id);
    byId.set(id,r);
  }});
  const results=[];
  for(const id of ids){
    const r=byId.get(id);
    if(!r){results.push({id,status:'ID_NOT_FOUND'});continue;}
    const url=String(r[14]||'').trim();
    if(!url){results.push({id,status:'NO_AUDIO_URL'});continue;}
    if(!/^https:\/\//i.test(url)){results.push({id,status:'INVALID_AUDIO_URL'});continue;}
    // Limit hosts to official Omny audio delivery; avoid fetching arbitrary ledger URLs.
    const host=url.match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase();
    if(!['traffic.omny.fm','omny.fm','www.omny.fm','www.omnycontent.com','omnycontent.com'].includes(host)){
      results.push({id,status:'UNSUPPORTED_HOST',host});continue;
    }
    try {
      const response=UrlFetchApp.fetch(url,{method:'head',muteHttpExceptions:true,
        followRedirects:false,headers:{'User-Agent':'Asarisu-Library-AudioAudit/1.0'}});
      const http=response.getResponseCode();
      results.push({id,http,status:[200,206].includes(http)?'HEAD_REACHABLE':
        [301,302,303,307,308].includes(http)?'REDIRECT_NOT_FOLLOWED':
        [403,405,429,503].includes(http)?'INCONCLUSIVE_HTTP':'HTTP_'+http});
    }catch(e){results.push({id,status:'FETCH_ERROR',detail:String(e).slice(0,120)});}
  }
  const report={mode:'READ_ONLY_AUDIO_HEAD',sampleCount:ids.length,results,
    writtenCells:0,elapsedMs:Date.now()-started};
  Logger.log(JSON.stringify(report));
  return report;
}
