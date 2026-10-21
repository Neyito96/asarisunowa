/**
 * GUID-gap guarded writer: ONLY independently anchored matches.
 * Proof: exact existing audio enclosure URL in ledger O matches RSS enclosure URL.
 * Title/show/JST date alone or Spotify URL presence NEVER authorize a write.
 * Run previewLibraryV2GuidAnchoredPilot() before writeLibraryV2GuidAnchoredPilot10().
 * Does not create triggers, new EP IDs, or write anything except blank G (GUID).
 */
function libraryV2GuidAnchoredPlan_() {
  const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh=ss.getSheetByName('エピソード台帳');
  const src=ss.getSheetByName('取得元一覧');
  const deleted=ss.getSheetByName('削除・除外履歴');
  const history=ss.getSheetByName('自動補完・実行履歴');
  if(!sh||!src||!deleted||!history)throw Error('Required sheet missing');
  const rows=sh.getDataRange().getValues(),h=rows.shift();
  const required={0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',14:'音声URL',38:'人間除外'};
  Object.keys(required).forEach(k=>{if(h[+k]!==required[k])throw Error('Header mismatch '+k+': '+h[+k]);});
  const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const guid=v=>{const s=String(v||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return(m?m[1]:s).toLowerCase();};
  const excluded=v=>{const s=norm(v).toLowerCase();return !!s&&!['未指定','なし','false','0','no'].includes(s);};
  const date=v=>{if(v instanceof Date&&!isNaN(v.getTime()))return Utilities.formatDate(v,'Asia/Tokyo','yyyy-MM-dd');const m=String(v||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';};
  const key=(a,b,c)=>[norm(a),norm(b),c].join('\u001f');
  const index=new Map(),allGuids=new Map(),audioCount=new Map();
  rows.forEach((r,i)=>{
    const g=guid(r[6]);if(g)allGuids.set(g,(allGuids.get(g)||0)+1);
    const a=String(r[14]||'').trim();if(a)audioCount.set(a,(audioCount.get(a)||0)+1);
    if(g||excluded(r[38])||!a||!date(r[3]))return;
    const k=key(r[1],r[2],date(r[3]));
    if(!index.has(k))index.set(k,[]);
    index.get(k).push({row:i+2,id:String(r[0]),title:norm(r[2]),audio:a});
  });
  const deletedGuids=new Set(),deletedIds=new Set();
  deleted.getDataRange().getValues().slice(1).forEach(r=>{if(guid(r[0]))deletedGuids.add(guid(r[0]));if(String(r[1]||'').trim())deletedIds.add(String(r[1]).trim());});
  const feeds=new Map();
  src.getDataRange().getValues().slice(1).forEach(r=>{
    const u=String(r[7]||'').trim();if(!/^https:\/\//.test(u)||/youtube\.com|youtu\.be/i.test(u))return;
    const show=String(r[0]||'');
    if(feeds.has(u)&&feeds.get(u)!==show)throw Error('Conflicting show labels: '+u);
    feeds.set(u,show);
  });
  if(!feeds.size)throw Error('No RSS feeds');
  const urls=[...feeds.keys()],responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true})));
  const candidates=new Map(),guidKeys=new Map();
  responses.forEach((res,i)=>{
    if(res.getResponseCode()!==200)throw Error('RSS HTTP '+res.getResponseCode()+' '+urls[i]);
    const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
    if(!channel)throw Error('RSS channel missing '+urls[i]);
    channel.getChildren('item').forEach(item=>{
      const g=guid(item.getChildText('guid'));if(!g)return;
      const d=new Date(String(item.getChildText('pubDate')||''));if(isNaN(d.getTime()))return;
      const k=key(feeds.get(urls[i]),item.getChildText('title'),Utilities.formatDate(d,'Asia/Tokyo','yyyy-MM-dd'));
      if(!guidKeys.has(g))guidKeys.set(g,new Set());guidKeys.get(g).add(k);
      if(!index.has(k))return;
      const a=item.getChild('enclosure')?.getAttribute('url')?.getValue()||'';
      if(!candidates.has(k))candidates.set(k,new Map());
      candidates.get(k).set(g,{guid:g,audio:a});
    });
  });
  const plan=[],holds={ambiguous:0,audioMismatch:0,excludedHistory:0,guidCollision:0,duplicateAudio:0};
  candidates.forEach((matches,k)=>{
    const ledger=index.get(k);
    if(ledger.length!==1||matches.size!==1){holds.ambiguous++;return;}
    const p=ledger[0],rss=[...matches.values()][0];
    if(guidKeys.get(rss.guid).size!==1){holds.ambiguous++;return;}
    if(allGuids.has(rss.guid)){holds.guidCollision++;return;}
    if(deletedGuids.has(rss.guid)||deletedIds.has(p.id)){holds.excludedHistory++;return;}
    if(audioCount.get(p.audio)!==1){holds.duplicateAudio++;return;}
    if(!rss.audio||rss.audio!==p.audio){holds.audioMismatch++;return;}
    plan.push({row:p.row,id:p.id,guid:rss.guid,title:p.title,audio:p.audio});
  });
  plan.sort((a,b)=>a.row-b.row);
  return {ss,sh,history,plan,holds,ledgerCount:rows.length,feeds:urls.length,guid,excluded,norm};
}
function previewLibraryV2GuidAnchoredPilot() {
  const p=libraryV2GuidAnchoredPlan_();
  const result={mode:'READ_ONLY_GUID_AUDIO_ANCHORED',eligible:p.plan.length,holds:p.holds,feeds:p.feeds,ledgerCount:p.ledgerCount,samples:p.plan.slice(0,10).map(x=>({id:x.id,row:x.row,guid:x.guid})),writes:0};
  Logger.log(JSON.stringify(result));return result;
}
function writeLibraryV2GuidAnchoredPilot10() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('Writer lock busy');
  try {
    const conflicts=ScriptApp.getProjectTriggers().filter(t=>['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10','scheduledLibraryMetadataBackfillV2Hourly','scheduledLibraryV2FastAutomation'].includes(t.getHandlerFunction()));
    if(conflicts.length)throw Error('Scheduled writer trigger exists; stop it before GUID pilot');
    const started=Date.now(),p=libraryV2GuidAnchoredPlan_(),selected=p.plan.slice(0,10);
    const expected=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
    const actual=p.history.getRange(1,1,1,10).getValues()[0];
    if(expected.some((v,i)=>v!==actual[i]))throw Error('History headers changed');
    if(!selected.length){const r={mode:'GUID_AUDIO_ANCHORED_NO_ELIGIBLE',written:0,holds:p.holds};Logger.log(JSON.stringify(r));return r;}
    const ids=new Set(),gs=new Set();
    selected.forEach(x=>{if(ids.has(x.id)||gs.has(x.guid))throw Error('Duplicate selected identity');ids.add(x.id);gs.add(x.guid);});
    // Recheck entire GUID column to detect newly introduced collisions.
    const currentGuids=p.sh.getRange(2,7,p.sh.getLastRow()-1,1).getValues().map(r=>p.guid(r[0]));
    selected.forEach(x=>{if(currentGuids.includes(x.guid))throw Error('GUID collision on recheck '+x.id);});
    // Recheck all protected identity fields and the exact independent audio anchor.
    for(const x of selected) {
      const r=p.sh.getRange(x.row,1,1,39).getValues()[0];
      if(String(r[0])!==x.id||p.norm(r[2])!==x.title||p.guid(r[6])||String(r[14]||'').trim()!==x.audio||p.excluded(r[38]))throw Error('Protected row changed; no writes '+x.id);
    }
    let written=0;
    for(const x of selected) {
      const r=p.sh.getRange(x.row,1,1,39).getValues()[0];
      if(String(r[0])!==x.id||p.guid(r[6])||String(r[14]||'').trim()!==x.audio||p.excluded(r[38]))throw Error('Row changed mid-pilot; inspect partial writes');
      p.sh.getRange(x.row,7).setValue(x.guid);
      written++;
    }
    SpreadsheetApp.flush();
    for(const x of selected)if(p.guid(p.sh.getRange(x.row,7).getValue())!==x.guid)throw Error('Post-write GUID mismatch; inspect ledger');
    const seconds=Math.round((Date.now()-started)/1000);
    p.history.appendRow([Utilities.formatDate(new Date(),p.ss.getSpreadsheetTimeZone(),'yyyy/MM/dd HH:mm:ss'),'V2_GUID_ANCHORED_SUCCESS',selected.length,written,Object.values(p.holds).reduce((a,b)=>a+b,0),selected.map(x=>x.id).join(', '),'ALL_RSS','—',seconds,'Audio enclosure exact match + show/title/JST date; blank G only; post-verified']);
    const result={mode:'GUID_AUDIO_ANCHORED_WRITE',written,ids:selected.map(x=>x.id),verified:true,history:'APPENDED',seconds};
    Logger.log(JSON.stringify(result));return result;
  } finally {lock.releaseLock();}
}
