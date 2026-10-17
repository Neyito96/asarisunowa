/**
 * ONE-SHOT explicitly scoped pilot for MEDIA TALK only.
 * Does not alter checkpoint properties, cache, triggers, or other show rows.
 * REQUIRES: LibraryV2CheckpointEngine.js helpers.
 * Run previewMediaTalkPilot10Preflight() first. Run writeMediaTalkPilot10Once()
 * only after reviewing preflight and authorizing the 20-cell maximum.
 */
const LIB_V2_MT_PILOT_IDS_ = [
  'EP-05585','EP-05584','EP-05583','EP-05582','EP-05581',
  'EP-05580','EP-05579','EP-05578','EP-05577','EP-05576'
];
const LIB_V2_MT_PILOT_SHOW_ = 'MEDIA TALK';
const LIB_V2_MT_PILOT_URL_ =
  'https://www.omnycontent.com/d/playlist/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/07a1de49-67cf-4714-8581-ac1000059302/podcast.rss';
function previewMediaTalkPilot10Preflight() { return libV2MediaTalkPilot10_(false); }
function writeMediaTalkPilot10Once() { return libV2MediaTalkPilot10_(true); }

function libV2MediaTalkPilot10_(write) {
  const started=Date.now(), lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return {status:'SKIPPED_ALREADY_RUNNING',writtenCells:0};
  const result={mode:write?'WRITE_PILOT':'READ_ONLY_PREFLIGHT',show:LIB_V2_MT_PILOT_SHOW_,
    expectedIds:LIB_V2_MT_PILOT_IDS_,proposedCells:0,writtenCells:0,updatedIds:[],
    checkpointChanged:false,triggerChanged:false};
  try {
    const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),
      sh=ss.getSheetByName('エピソード台帳'),
      src=ss.getSheetByName('取得元一覧'),
      ex=ss.getSheetByName('削除・除外履歴'),
      history=ss.getSheetByName('自動補完・実行履歴');
    if(!sh||!src||!ex||!history)throw Error('Required tabs missing');
    const all=sh.getDataRange().getValues(), headers=all.shift();
    libV2CpCheckHeaders_(headers);
    const expected=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
    const historyHeaders=history.getRange(1,1,1,10).getValues()[0];
    if(expected.some((v,i)=>historyHeaders[i]!==v))throw Error('History header mismatch');
    const feedRows=src.getDataRange().getValues().slice(1).filter(r=>
      libV2CpNorm_(r[0])===LIB_V2_MT_PILOT_SHOW_ &&
      String(r[7]||'').trim()===LIB_V2_MT_PILOT_URL_);
    if(feedRows.length!==1)throw Error('Expected one exact MEDIA TALK feed');
    // Prevent writing concurrently with known legacy/background writers.
    if(write) {
      const forbidden=['scheduledLibraryMetadataBackfill5min','scheduledLibraryMetadataBackfill10',
        'scheduledLibraryMetadataBackfillV2Hourly','scheduledLibraryV2FastAutomation',
        'writeLibraryV2OmnyClipGuidPilot10','writeLibraryV2CheckpointPilot10'];
      const active=ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction());
      const conflict=active.filter(name=>forbidden.includes(name));
      if(conflict.length)throw Error('Conflicting writer triggers: '+conflict.join(','));
    }
    // Fetch once; fail before any write if RSS is incomplete/unavailable.
    const response=UrlFetchApp.fetch(LIB_V2_MT_PILOT_URL_,{
      muteHttpExceptions:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
    if(response.getResponseCode()!==200)throw Error('RSS HTTP '+response.getResponseCode());
    const items=libV2CpParse_(response.getContentText('UTF-8'));
    const guidCount=new Map();
    items.forEach(it=>guidCount.set(it.guid,(guidCount.get(it.guid)||0)+1));
    const byGuid=new Map(),byClip=new Map(),byId=new Map(),spotifyOwners=new Map();
    all.forEach((r,i)=>{
      for(const [map,key] of [[byGuid,libV2CpGuid_(r[6])],
        ...libV2CpRowAnchors_(r).map(k=>[byClip,k]),
        [byId,String(r[0])],[spotifyOwners,String(r[11]||'')]]) {
        if(key){if(!map.has(key))map.set(key,[]);if(!map.get(key).includes(i))map.get(key).push(i);}
      }
    });
    const tomb={gs:new Set(),is:new Set()};
    ex.getDataRange().getValues().slice(1).forEach(r=>{
      tomb.gs.add(libV2CpGuid_(r[0]));tomb.is.add(String(r[1]||'').trim());
    });
    // Compute exact same first-ten selection as read-only preview, not any arbitrary ten.
    const selected=[],seen=new Set();
    for(const it of items) {
      if(selected.length===10)break;
      if(!it.guid||guidCount.get(it.guid)!==1)continue;
      const matches=libV2CpMatches_(it.guid,byGuid,byClip);
      if(matches.length!==1)continue;
      const i=matches[0],r=all[i],id=String(r[0]);
      if(libV2CpRowReasons_(it,LIB_V2_MT_PILOT_SHOW_,r,byId,tomb).length)continue;
      const fields=libV2CpFields_(it,r,spotifyOwners);
      if(!fields.length)continue;
      const allowed=fields.filter(([col])=>col===7||col===15);
      if(allowed.length!==2 || fields.length!==2)throw Error('Unexpected field set '+id);
      if(!LIB_V2_MT_PILOT_IDS_.includes(id)||seen.has(id))throw Error('Pilot selection drift '+id);
      selected.push({id,i,it,fields:allowed,row:r});
      seen.add(id);
    }
    if(selected.length!==10||LIB_V2_MT_PILOT_IDS_.some(id=>!seen.has(id)))
      throw Error('Pilot target set changed; abort without writing');
    // Whole-batch preflight before any write: row identity, excluded state,
    // every destination cell empty and not a formula.
    const planned=[];
    for(const s of selected) {
      const latest=sh.getRange(s.i+2,1,1,39).getValues()[0];
      if([0,1,2,3,6,8,9,11,14,21,23,32,38].some(c=>String(latest[c])!==String(s.row[c])))
        throw Error('Row changed '+s.id);
      if(libV2CpRowReasons_(s.it,LIB_V2_MT_PILOT_SHOW_,latest,byId,tomb).length)
        throw Error('Identity changed '+s.id);
      for(const [col,value,kind] of s.fields) {
        if(col!==7&&col!==15)throw Error('Forbidden column');
        if(!value||String(value).startsWith('='))throw Error('Invalid value '+s.id);
        const cell=sh.getRange(s.i+2,col);
        if(cell.getFormula()||String(cell.getValue()||'').trim())
          throw Error('Nonblank or formula '+s.id+' col '+col);
        planned.push({s,col,value,kind});
      }
    }
    if(planned.length!==20)throw Error('Expected exactly 20 cells');
    result.proposedCells=planned.length;
    result.samples=selected.map(s=>({id:s.id,columns:[7,15]}));
    if(!write){result.status='PREFLIGHT_PASS';return result;}
    // Never continue a partially written pilot. Abort on the first anomaly.
    // Use per-cell rechecks because another human editor is not protected by script lock.
    for(const p of planned) {
      const s=p.s, latest=sh.getRange(s.i+2,1,1,39).getValues()[0];
      if([0,1,2,3,6,8,9,11,14,21,23,32,38].some(c=>String(latest[c])!==String(s.row[c])))
        throw Error('Row changed during write '+s.id);
      const dt={gs:new Set(),is:new Set()};
      ex.getDataRange().getValues().slice(1).forEach(r=>{
        dt.gs.add(libV2CpGuid_(r[0]));dt.is.add(String(r[1]||'').trim());
      });
      if(libV2CpRowReasons_(s.it,LIB_V2_MT_PILOT_SHOW_,latest,byId,dt).length)
        throw Error('Hold appeared during write '+s.id);
      const cell=sh.getRange(s.i+2,p.col);
      if(cell.getFormula()||String(cell.getValue()||'').trim())
        throw Error('Destination changed during write '+s.id);
      cell.setValue(p.value);
      SpreadsheetApp.flush();
      if(String(cell.getValue())!==String(p.value))
        throw Error('Postwrite mismatch '+s.id);
      result.writtenCells++;
      if(!result.updatedIds.includes(s.id))result.updatedIds.push(s.id);
    }
    history.appendRow([new Date(),'V2_MT_PILOT10',result.updatedIds.length,
      result.writtenCells,0,result.updatedIds.join(','),LIB_V2_MT_PILOT_URL_,'',
      Math.round((Date.now()-started)/1000),'Strict allowlist: G/O only; no checkpoint changes']);
    result.status='PILOT_WRITTEN';
    return result;
  } catch(err) {
    result.status=result.writtenCells?'PARTIAL_WRITE_STOPPED':'ABORTED_NO_WRITE';
    result.error=String(err);
    return result;
  } finally {
    result.elapsedMs=Date.now()-started;
    Logger.log(JSON.stringify(result));
    lock.releaseLock();
  }
}
