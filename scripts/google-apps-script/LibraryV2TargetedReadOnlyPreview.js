/**
 * Targeted, side-effect-free checkpoint preview. Requires LibraryV2CheckpointEngine.js.
 * No state/cache/property writes, no sheet writes, no triggers.
 * One named feed, first 10 eligible episodes; bounded 200 RSS items inspected.
 */
function previewLibraryV2MediaTalk() { return libV2TargetedReadOnlyPreview_('MEDIA TALK'); }
function previewLibraryV2NewsScene() { return libV2TargetedReadOnlyPreview_('ニュースの現場から'); }
function previewLibraryV2Kids() { return libV2TargetedReadOnlyPreview_('こどもそうだんしつ'); }

function libV2TargetedReadOnlyPreview_(show) {
  const started=Date.now(), deadline=started+110000;
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(1000)) return {status:'SKIPPED_ALREADY_RUNNING',writtenCells:0};
  try {
    const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
    const sh=ss.getSheetByName('エピソード台帳');
    const src=ss.getSheetByName('取得元一覧');
    const ex=ss.getSheetByName('削除・除外履歴');
    if (!sh||!src||!ex) throw Error('Required sheet missing');
    const all=sh.getDataRange().getValues(), headers=all.shift();
    libV2CpCheckHeaders_(headers);
    const feedRows=src.getDataRange().getValues().slice(1)
      .filter(r=>libV2CpNorm_(r[0])===show && /^https:\/\//.test(String(r[7]||'')));
    if (feedRows.length!==1) throw Error('Expected exactly one feed for '+show+'; got '+feedRows.length);
    const url=String(feedRows[0][7]).trim();
    const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
    if (response.getResponseCode()!==200) throw Error('RSS HTTP '+response.getResponseCode());
    const items=libV2CpParse_(response.getContentText('UTF-8'));
    const idx=new Map(),clips=new Map(),ids=new Map(),spotifyOwners=new Map();
    all.forEach((r,i)=>{
      for (const [map,k] of [[idx,libV2CpGuid_(r[6])],...libV2CpRowAnchors_(r).map(g=>[clips,g]),[ids,String(r[0])],[spotifyOwners,String(r[11]||'')]]) {
        if(k){if(!map.has(k))map.set(k,[]);if(!map.get(k).includes(i))map.get(k).push(i);}
      }
    });
    const tomb={gs:new Set(),is:new Set()};
    ex.getDataRange().getValues().slice(1).forEach(r=>{tomb.gs.add(libV2CpGuid_(r[0]));tomb.is.add(String(r[1]||'').trim());});
    const counts=new Map();
    items.forEach(it=>counts.set(it.guid,(counts.get(it.guid)||0)+1));
    const result={status:'READ_ONLY_TARGETED',show,feed:url,rssItems:items.length,inspected:0,
      eligibleEpisodes:0,proposedCells:0,formulaProtected:0,nonblankProtected:0,
      holds:0,holdReasons:{},samples:[],writtenCells:0,propertiesChanged:false};
    const hold=reason=>{result.holds++;result.holdReasons[reason]=(result.holdReasons[reason]||0)+1;};
    for(let j=0;j<items.length && result.inspected<200 && result.eligibleEpisodes<10 && Date.now()<deadline;j++){
      const it=items[j];result.inspected++;
      if(!it.guid||counts.get(it.guid)!==1){hold('missing_or_duplicate_rss_guid');continue;}
      const matches=libV2CpMatches_(it.guid,idx,clips);
      if(matches.length!==1){hold(matches.length?'multiple_ledger_matches':'no_ledger_match');continue;}
      const i=matches[0],r=all[i],id=String(r[0]);
      const reasons=libV2CpRowReasons_(it,show,r,ids,tomb);
      if(reasons.length){reasons.forEach(hold);continue;}
      const fields=libV2CpFields_(it,r,spotifyOwners);
      if(!fields.length)continue;
      const selected=[];
      for(const [col,value,kind] of fields){
        const cell=sh.getRange(i+2,col);
        if(cell.getFormula()){result.formulaProtected++;continue;}
        if(String(cell.getValue()||'').trim()){result.nonblankProtected++;continue;}
        selected.push({column:col,field:kind});
      }
      if(selected.length){
        result.eligibleEpisodes++;result.proposedCells+=selected.length;
        result.samples.push({id,columns:selected.map(x=>x.column),fields:selected.map(x=>x.field)});
      }
    }
    result.elapsedMs=Date.now()-started;
    Logger.log(JSON.stringify(result));
    return result;
  } finally {lock.releaseLock();}
}
