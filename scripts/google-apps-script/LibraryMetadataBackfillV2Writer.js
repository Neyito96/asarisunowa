/**
 * V2 controlled metadata writer — manual invocation only.
 * Requires all V1 scheduler triggers to be removed before writing.
 * IMPORTANT: also confirm no V1 execution is currently running before invoking.
 * Does not create/delete triggers and does not modify episode IDs.
 * Deploy alongside LibraryMetadataBackfillV2.js.
 */
function writeLibraryMetadataV2Pilot10() {
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
    const selected=plan.slice(0,10);
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
    const result={mode:'WRITE_PILOT',candidateEpisodes:plan.length,selectedEpisodes:selected.length,plannedCells:writes.length,writtenCells:written,holds,seconds:Math.round((Date.now()-started)/1000)};
    Logger.log(JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
