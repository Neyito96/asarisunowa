/**
 * LibraryMetadataBackfill — GUID reconciliation preview V1
 * READ ONLY: does not write to any sheet, change triggers or call Spotify.
 * Compares GUID-empty ledger episodes to RSS by exact normalized title + show + JST calendar date.
 * Conservative: only unique one-to-one matches are "highConfidence"; never auto-write them.
 * Run previewLibraryGuidReconciliation() manually.
 */
function previewLibraryGuidReconciliation() {
  const id='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
  const ss=SpreadsheetApp.openById(id);
  const ledger=ss.getSheetByName('エピソード台帳');
  const source=ss.getSheetByName('取得元一覧');
  if(!ledger||!source)throw Error('Required sheet missing');
  const values=ledger.getDataRange().getValues();
  const header=values.shift();
  const required={0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',11:'Spotify個別URL'};
  Object.keys(required).forEach(k=>{if(header[Number(k)]!==required[k])throw Error('Header mismatch at '+k);});
  const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const dateKey=x=>{
    if(x instanceof Date&&!isNaN(x.getTime()))return Utilities.formatDate(x,'Asia/Tokyo','yyyy-MM-dd');
    const s=String(x||'').trim();const m=s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';
  };
  const key=(show,title,date)=>[normalize(show),normalize(title),date].join('\u001f');
  const guid=x=>{const s=String(x||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return(m?m[1]:s).toLowerCase();};
  const rows=new Map(),knownGuids=new Set(),report={mode:'READ_ONLY_GUID_RECONCILIATION',ledgerGuidBlank:0,blankWithSpotify:0,excludedBlank:0,rssFeeds:0,rssItems:0,uniqueHighConfidence:0,ambiguous:0,eligibleWithSpotify:0,alreadyKnownGuid:0,dateMissing:0,feedErrors:[],samples:[],writes:0};
  values.forEach((r,i)=>{
    if(guid(r[6])){knownGuids.add(guid(r[6]));return;}
    if(!String(r[0]||'').startsWith('EP-'))return;
    report.ledgerGuidBlank++;
    if(String(r[11]||'').trim())report.blankWithSpotify++;
    const exclusion=String(r[38]||'').trim().toLowerCase();
    if(exclusion&&!['未指定','なし','false','0','no'].includes(exclusion)){report.excludedBlank++;return;}
    const date=dateKey(r[3]);
    if(!date){report.dateMissing++;return;}
    const k=key(r[1],r[2],date);
    if(!rows.has(k))rows.set(k,[]);
    rows.get(k).push({id:String(r[0]),row:i+2,show:String(r[1]),title:String(r[2]),date,spotify:String(r[11]||'')});
  });
  const feeds=new Map();
  source.getDataRange().getValues().slice(1).forEach(r=>{
    const url=String(r[7]||'').trim();
    if(/^https:\/\//.test(url)&&!/youtube\.com|youtu\.be/i.test(url))feeds.set(url,String(r[0]||''));
  });
  const urls=[...feeds.keys()];report.rssFeeds=urls.length;
  const responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true})));
  const candidates=new Map();
  responses.forEach((res,i)=>{
    const show=feeds.get(urls[i]);
    if(res.getResponseCode()!==200){report.feedErrors.push({show,http:res.getResponseCode()});return;}
    try {
      const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
      if(!channel)throw Error('Missing channel');
      channel.getChildren('item').forEach(item=>{
        report.rssItems++;
        const g=guid(item.getChildText('guid'));
        if(!g||knownGuids.has(g))return;
        const published=String(item.getChildText('pubDate')||'').trim();
        const d=published?new Date(published):null;
        const date=d&&!isNaN(d.getTime())?Utilities.formatDate(d,'Asia/Tokyo','yyyy-MM-dd'):'';
        if(!date)return;
        const k=key(show,item.getChildText('title'),date);
        if(!rows.has(k))return;
        if(!candidates.has(k))candidates.set(k,[]);
        candidates.get(k).push({guid:g,feed:show});
      });
    }catch(e){report.feedErrors.push({show,error:String(e)});}
  });
  const usedGuids=new Set();
  for(const [k,list] of candidates){
    const matches=rows.get(k)||[];
    const uniqueRss=[...new Map(list.map(x=>[x.guid,x])).values()];
    if(matches.length!==1||uniqueRss.length!==1||usedGuids.has(uniqueRss[0].guid)){
      report.ambiguous++;continue;
    }
    usedGuids.add(uniqueRss[0].guid);
    report.uniqueHighConfidence++;\n    if(matches[0].spotify)report.eligibleWithSpotify++;
    if(report.samples.length<30)report.samples.push({id:matches[0].id,row:matches[0].row,show:matches[0].show,date:matches[0].date,guid:uniqueRss[0].guid,spotifyPresent:!!matches[0].spotify});
  }
  report.note='Exact title/show/JST date match only; does not establish Spotify identity; no writes. RSS show labels must match ledger show labels.';
  Logger.log(JSON.stringify(report));
  return report;
}
