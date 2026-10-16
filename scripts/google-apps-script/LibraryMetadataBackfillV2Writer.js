/**
 * V2 controlled metadata writer — manual invocation only.
 * Requires all V1 scheduler triggers to be removed before writing.
 * IMPORTANT: also confirm no V1 execution is currently running before invoking.
 * Does not create/delete triggers and does not modify episode IDs.
 * Deploy alongside LibraryMetadataBackfillV2.js.
 */
/** Hourly trigger entrypoint. Keep V1 triggers disabled. */
function scheduledLibraryMetadataBackfillV2Hourly() {
  return writeLibraryMetadataV2Batch_(80);
}
/** Read-only audit: inspect title mismatches without changing the ledger. */
function auditLibraryMetadataV2TitleMismatch() {
  const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh=ss.getSheetByName('エピソード台帳');
  const src=ss.getSheetByName('取得元一覧');
  const rows=sh.getDataRange().getValues(); rows.shift();
  const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const guid=x=>{const s=String(x||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return(m?m[1]:s).toLowerCase();};
  const byGuid=new Map();
  rows.forEach((r,i)=>{const g=guid(r[6]);if(g){if(!byGuid.has(g))byGuid.set(g,[]);byGuid.get(g).push({row:i+2,id:r[0],title:r[2]});}});
  const urls=[...new Set(src.getDataRange().getValues().slice(1).map(r=>String(r[7]||'').trim()).filter(x=>x.startsWith('https://')&&!x.includes('youtube.com')&&!x.includes('youtu.be')))];
  const responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true})));
  const mismatches=[],feedErrors=[];const seen=new Set();
  responses.forEach((res,i)=>{
    if(res.getResponseCode()!==200){feedErrors.push({feed:urls[i],http:res.getResponseCode()});return;}
    try {
      const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
      if(!channel){feedErrors.push({feed:urls[i],reason:'no channel'});return;}
      channel.getChildren('item').forEach(item=>{
        const matches=byGuid.get(guid(item.getChildText('guid')))||[];
        if(matches.length!==1)return;
        const r=matches[0],rssTitle=item.getChildText('title')||'';
        if(norm(r.title)===norm(rssTitle)||seen.has(r.id))return;
        seen.add(r.id);
        mismatches.push({id:r.id,row:r.row,ledgerTitle:r.title,rssTitle,feed:urls[i]});
      });
    } catch(e){feedErrors.push({feed:urls[i],reason:String(e)});}
  });
  const result={mode:'READ_ONLY_TITLE_AUDIT',count:mismatches.length,mismatches,feedErrors};
  Logger.log(JSON.stringify(result));return result;
}
/** Read-only, targeted verification of EP-00061 RSS description. */
function previewLibraryMetadataV2EP00061() {
  const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh=ss.getSheetByName('エピソード台帳');
  const src=ss.getSheetByName('取得元一覧');
  const row=sh.getRange(62,1,1,23).getValues()[0];
  if(String(row[0])!=='EP-00061')throw Error('EP-00061 row moved: stop');
  const guid=x=>{const s=String(x||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return(m?m[1]:s).toLowerCase();};
  const key=guid(row[6]);
  if(!key||String(row[21]||'').trim())throw Error('Missing GUID or description already populated; stop');
  const sources=src.getDataRange().getValues().slice(1);
  const source=sources.find(r=>String(r[0]||'').trim()==='スポンジ');
  if(!source||!String(source[7]||'').startsWith('https://'))throw Error('Sponge RSS source missing');
  const response=UrlFetchApp.fetch(source[7],{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('RSS HTTP '+response.getResponseCode());
  const channel=XmlService.parse(response.getContentText('UTF-8')).getRootElement().getChild('channel');
  if(!channel)throw Error('Missing RSS channel');
  const matches=channel.getChildren('item').filter(item=>guid(item.getChildText('guid'))===key);
  if(matches.length!==1)throw Error('Expected one GUID match; found '+matches.length);
  const item=matches[0];
  const description=String(item.getChildText('description')||'').trim();
  const result={mode:'READ_ONLY_EP00061',id:row[0],row:62,guidMatch:true,ledgerTitle:row[2],rssTitle:item.getChildText('title'),descriptionLength:description.length,descriptionPreview:description.slice(0,800),descriptionPresent:description.length>0,writePerformed:false};
  Logger.log(JSON.stringify(result));return result;
}
function writeLibraryMetadataV2Pilot10() { return writeLibraryMetadataV2Batch_(10); }
function writeLibraryMetadataV2Pilot80() { return writeLibraryMetadataV2Batch_(80); }
function writeLibraryMetadataV2Batch_(limit) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw Error('Another library writer holds the script lock');
  try {
    const v1Names = ['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10'];
    const activeV1 = ScriptApp.getProjectTriggers().filter(t => v1Names.includes(t.getHandlerFunction()));
    if (activeV1.length) throw Error('V1 trigger still installed; STOP V1 and wait for running executions to finish before V2 write');
    const started=Date.now();
    const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
    const sh=ss.getSheetByName('エピソード台帳');
    const src=ss.getSheetByName('取得元一覧');
    if(!sh||!src) throw Error('Missing required tabs');
    const history=ss.getSheetByName('自動補完・実行履歴');
    if(!history) throw Error('V2 write completed but history tab is missing; inspect ledger before retry');
    const expectedHistory=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
    const actualHistory=history.getRange(1,1,1,10).getValues()[0];
    if(expectedHistory.some((h,i)=>h!==actualHistory[i])) throw Error('V2 write completed but history header changed; inspect ledger before retry');
    const all=sh.getDataRange().getValues();
    const headers=all.shift();
    const required={0:'台帳ID',2:'タイトル',6:'外部ID',13:'画像URL',14:'音声URL',15:'再生時間（秒）',19:'音源不在の根拠',21:'概要原文',38:'人間除外'};
    // The exclusion header may have a longer descriptive label; its column position is checked by row contents.
    Object.keys(required).filter(k=>k!=='38').forEach(k=>{
      if(headers[+k]!==required[k]) throw Error('Unexpected header at '+(+k+1));
    });
    if(headers.length<39) throw Error('Missing AM exclusion column');
    const urls=[...new Set(src.getDataRange().getValues().slice(1).map(r=>String(r[7]||'').trim()).filter(x=>/^https:\/\//.test(x)&&!/youtube\.com|youtu\.be/i.test(x)))];
    if(!urls.length) throw Error('No RSS URLs');
    const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
    const guid=x=>{const s=String(x||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return (m?m[1]:s).toLowerCase();};
    const excluded=x=>{const s=String(x||'').trim().toLowerCase();return s!==''&&!['未指定','なし','false','0','no'].includes(s);};
    const byGuid=new Map();
    all.forEach((r,i)=>{const k=guid(r[6]);if(k){if(!byGuid.has(k))byGuid.set(k,[]);byGuid.get(k).push({row:i+2,data:r});}});
    const responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}})));
    // Fail closed: no partial writes if any feed is unavailable.
    const feeds=responses.map((res,i)=>{
      if(res.getResponseCode()!==200)throw Error('RSS HTTP '+res.getResponseCode()+' '+urls[i]);
      const channel=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');
      if(!channel)throw Error('No RSS channel '+urls[i]);
      return {url:urls[i],items:channel.getChildren('item')};
    });
    const plan=[],seen=new Set(),holds={title:0,duplicateGuid:0,excluded:0};
    for(const feed of feeds) for(const item of feed.items){
      const matches=byGuid.get(guid(item.getChildText('guid')))||[];
      if(matches.length>1){holds.duplicateGuid++;continue;}
      if(matches.length!==1)continue;
      const e=matches[0],r=e.data,id=String(r[0]);
      if(seen.has(id))continue;
      seen.add(id);
      if(excluded(r[38])){holds.excluded++;continue;}
      if(norm(item.getChildText('title'))!==norm(r[2])){holds.title++;continue;}
      const audio=item.getChild('enclosure')?.getAttribute('url')?.getValue()||'';
      const description=String(item.getChildText('description')||'').trim().replace(/\r\n?|\n/g,'\\n');
      const dnode=item.getChildren().find(n=>n.getName()==='duration'&&n.getNamespace().getPrefix()==='itunes');
      const dt=dnode?String(dnode.getText()||'').trim():'';
      const duration=/^\d+$/.test(dt)?Number(dt):(/^\d+:\d{2}(?::\d{2})?$/.test(dt)?dt.split(':').map(Number).reduce((a,b)=>a*60+b,0):null);
      const imageNode=item.getChildren().find(n=>n.getName()==='image'&&n.getNamespace().getPrefix()==='itunes');
      const image=imageNode?.getAttribute('href')?.getValue()||'';
      const fields=[];
      [[14,image],[15,audio],[16,duration],[22,description]].forEach(([col,value])=>{
        if(value!==null&&value!==''&&!String(r[col-1]||'').trim())fields.push({col,value});
      });
      if(fields.length)plan.push({row:e.row,id,guid:guid(r[6]),title:norm(r[2]),fields});
    }
    plan.sort((a,b)=>a.row-b.row);
    if (![10,80].includes(limit)) throw Error('Unsupported V2 pilot limit');
    const selected=plan.slice(0,limit);
    // Re-read ALL protected fields and target values immediately before writing.
    const latest=sh.getDataRange().getValues();
    const writes=[];
    for(const p of selected){
      const row=latest[p.row-1];
      if(!row||String(row[0])!==p.id||guid(row[6])!==p.guid||norm(row[2])!==p.title||excluded(row[38]))throw Error('Row changed/excluded; no writes: '+p.id);
      for(const f of p.fields) if(!String(row[f.col-1]||'').trim())writes.push({row:p.row,col:f.col,value:f.value,id:p.id});
    }
    // Fail closed on a changed row, and keep the first pilot deliberately small.
    // Partial writes are possible if Apps Script fails mid-operation: rerun only after inspection.
    // Group adjacent rows with same column into one setValues operation.
    const byColumn=new Map();
    writes.forEach(w=>{if(!byColumn.has(w.col))byColumn.set(w.col,[]);byColumn.get(w.col).push(w);});
    let written=0;
    for(const [col,items] of byColumn){
      items.sort((a,b)=>a.row-b.row);
      let group=[];
      const flush=()=>{
        if(!group.length)return;
        sh.getRange(group[0].row,col,group.length,1).setValues(group.map(w=>[w.value]));
        written+=group.length;group=[];
      };
      for(const w of items){
        if(group.length&&w.row!==group[group.length-1].row+1)flush();
        group.push(w);
      }
      flush();
    }
    SpreadsheetApp.flush();
    const result={mode:'WRITE_PILOT',candidateEpisodes:plan.length,selectedEpisodes:selected.length,plannedCells:writes.length,writtenCells:written,holds,seconds:Math.round((Date.now()-started)/1000),updatedIds:[...new Set(writes.map(w=>w.id))]};
    // History is append-only. Failure to log is reported as an error, not silent success.
    const tz=ss.getSpreadsheetTimeZone();
    history.appendRow([Utilities.formatDate(new Date(),tz,'yyyy/MM/dd HH:mm:ss'),'V2_SUCCESS',result.selectedEpisodes,result.writtenCells,holds.title+holds.duplicateGuid+holds.excluded,result.updatedIds.join(', '),'ALL_10_RSS','—',result.seconds,'V2 manual pilot '+limit+'; candidate='+result.candidateEpisodes+'; no overwrite; holds title='+holds.title+', duplicate='+holds.duplicateGuid+', excluded='+holds.excluded]);
    result.history='APPENDED';
    Logger.log(JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
