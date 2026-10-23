/**
 * V2 GUID-gap reconciliation adapter (2026-10-16).
 * READ ONLY by default. Reuses V2 RSS bulk fetch and ledger indexing principles.
 * No Spotify API, sheet writes, triggers, or EP-ID allocation.
 * IMPORTANT: a Spotify episode URL alone cannot prove Omny GUID identity.
 */
function previewLibraryV2GuidGapBatch() {
  const started = Date.now();
  const ss = SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh = ss.getSheetByName('エピソード台帳');
  const src = ss.getSheetByName('取得元一覧');
  const exclusions = ss.getSheetByName('削除・除外履歴');
  if (!sh || !src || !exclusions) throw Error('Required tabs missing');
  const data = sh.getDataRange().getValues(), headers = data.shift();
  const expected = {0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',11:'Spotify個別URL',38:'人間除外'};
  Object.keys(expected).forEach(k => {if(headers[+k] !== expected[k]) throw Error('Header mismatch '+k);});
  const norm = v => String(v || '').normalize('NFKC').replace(/\s+/g,' ').trim();
  const guid = v => {const s=String(v||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return (m?m[1]:s).toLowerCase();};
  const blocked = v => {const s=norm(v).toLowerCase();return !!s&&!['未指定','なし','false','0','no'].includes(s);};
  const dateKey = v => {
    if(v instanceof Date&&!isNaN(v.getTime()))return Utilities.formatDate(v,'Asia/Tokyo','yyyy-MM-dd');
    const m=String(v||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';
  };
  const key=(show,title,date)=>[norm(show),norm(title),date].join('\u001f');
  const byKey=new Map(), known=new Set(), spotifyIds=new Map();
  data.forEach((r,i)=>{
    const g=guid(r[6]);if(g)known.add(g);
    const sm=String(r[11]||'').match(/(?:open\.spotify\.com\/episode\/|spotify:episode:)([A-Za-z0-9]+)/);
    if(sm){if(!spotifyIds.has(sm[1]))spotifyIds.set(sm[1],[]);spotifyIds.get(sm[1]).push(i);}
    if(g||!String(r[0]||'').startsWith('EP-')||blocked(r[38]))return;
    const d=dateKey(r[3]);if(!d)return;
    const k=key(r[1],r[2],d);
    if(!byKey.has(k))byKey.set(k,[]);
    byKey.get(k).push({index:i,id:r[0],row:i+2,spotify:sm?sm[1]:'',data:r});
  });
  const deleted=new Set(), deletedIds=new Set();
  exclusions.getDataRange().getValues().slice(1).forEach(r=>{
    if(guid(r[0]))deleted.add(guid(r[0]));
    if(String(r[1]||'').trim())deletedIds.add(String(r[1]).trim());
  });
  const feeds=new Map();
  src.getDataRange().getValues().slice(1).forEach(r=>{
    const u=String(r[7]||'').trim();
    if(/^https:\/\//.test(u)&&!/youtube\.com|youtu\.be/i.test(u)) {
      if(feeds.has(u)&&feeds.get(u)!==String(r[0]||''))throw Error('Conflicting feed show labels '+u);
      feeds.set(u,String(r[0]||''));
    }
  });
  if(!feeds.size)throw Error('No RSS feeds');
  const urls=[...feeds.keys()];
  const responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true})));
  const candidates=new Map(), rssGuidKeys=new Map();
  let items=0;
  responses.forEach((res,i)=>{
    if(res.getResponseCode()!==200)throw Error('RSS HTTP '+res.getResponseCode()+' '+urls[i]);
    const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
    if(!channel)throw Error('Missing RSS channel '+urls[i]);
    channel.getChildren('item').forEach(item=>{
      items++;
      const g=guid(item.getChildText('guid'));if(!g)return;
      const published=new Date(String(item.getChildText('pubDate')||''));
      if(isNaN(published.getTime()))return;
      const k=key(feeds.get(urls[i]),item.getChildText('title'),Utilities.formatDate(published,'Asia/Tokyo','yyyy-MM-dd'));
      if(!rssGuidKeys.has(g))rssGuidKeys.set(g,new Set());
      rssGuidKeys.get(g).add(k);
      if(known.has(g)||!byKey.has(k))return;
      if(!candidates.has(k))candidates.set(k,new Map());
      candidates.get(k).set(g,{guid:g,feed:feeds.get(urls[i])});
    });
  });
  const result={mode:'READ_ONLY_V2_GUID_GAP',feeds:urls.length,rssItems:items,strictCandidates:0,blocked:0,blockedReasons:{},identityPending:0,writeEligible:0,writes:0,samples:[],seconds:0};
  const hold=reason=>{result.blocked++;result.blockedReasons[reason]=(result.blockedReasons[reason]||0)+1;};
  candidates.forEach((rss,k)=>{
    const rows=byKey.get(k);
    if(rows.length!==1||rss.size!==1){hold('ambiguousKey');return;}
    const p=rows[0], g=[...rss.keys()][0];
    if(rssGuidKeys.get(g).size!==1){hold('guidCrossFeedConflict');return;}
    if(deleted.has(g)||deletedIds.has(String(p.id))){hold('humanDeletion');return;}
    if(!p.spotify||spotifyIds.get(p.spotify).length!==1){hold('spotifyMissingOrDuplicate');return;}
    if(guid(p.data[6])||blocked(p.data[38])){hold('protectedRow');return;}
    result.strictCandidates++;
    // Matching title/show/date plus Spotify URL presence is not identity proof.
    // Only an independently verified mapping may graduate to the V2 writer.
    result.identityPending++;
    if(result.samples.length<20)result.samples.push({id:p.id,row:p.row,guid:g,reason:'SPOTIFY_IDENTITY_UNVERIFIED'});
  });
  result.seconds=Math.round((Date.now()-started)/1000);
  Logger.log(JSON.stringify(result));
  return result;
}
