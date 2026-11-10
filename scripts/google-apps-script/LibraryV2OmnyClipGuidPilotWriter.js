/**
 * Guarded 10-row pilot for independently RSS-verified Omny GUIDs.
 * Requires previewLibraryV2OmnyClipGuidVerified() installed.
 * Writes ONLY G (外部ID) after fresh preview and locked row rechecks.
 */
function writeLibraryV2OmnyClipGuidPilot10() {
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(30000))throw Error('Writer lock busy: no writes');
 try {
  const report=previewLibraryV2OmnyClipGuidVerified();
  if(report.mode!=='READ_ONLY_OMNY_CLIP_RSS_GUID_VERIFIED'||!report.eligible)throw Error('No verified candidates');
  const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh=ss.getSheetByName('エピソード台帳');
  const ex=ss.getSheetByName('削除・除外履歴');
  const history=ss.getSheetByName('自動補完・実行履歴');
  const rows=sh.getDataRange().getValues();
  if(rows[0][0]!=='台帳ID'||rows[0][6]!=='外部ID'||rows[0][8]!=='元ページURL'||rows[0][32]!=='取得元URL')throw Error('Unexpected headers');
  const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const excluded=x=>{const s=norm(x).toLowerCase();return !!s&&!['未指定','なし','false','0','no'].includes(s);};
  const re=/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i;
  const guidSet=new Set(rows.slice(1).map(r=>norm(r[6]).toLowerCase()).filter(Boolean));
  const blockedIds=new Set(),blockedGuids=new Set();
  ex.getDataRange().getValues().slice(1).forEach(r=>{if(norm(r[1]))blockedIds.add(norm(r[1]));const m=norm(r[0]).match(re);if(m)blockedGuids.add(m[0].toLowerCase());});
  const getClip=s=>{const m=String(s||'').match(/^https?:\/\/(?:omny\.fm|traffic\.omny\.fm|omnycontent\.com)\/shows\/[^/?#]+\/([0-9a-f-]{36})(?:[/?#]|$)/i);return m?m[1].toLowerCase():'';};
  const chosen=report.samples.slice(0,10);
  const updates=[];
  for(const p of chosen){
   const r=rows[p.row-1];
   if(!r||norm(r[0])!==p.id||norm(r[6])||excluded(r[38])||blockedIds.has(p.id)||blockedGuids.has(p.guid)||guidSet.has(p.guid))throw Error('Prewrite recheck failed '+p.id);
   const a=getClip(r[8]),b=getClip(r[32]);
   if(!((a===p.guid)||(b===p.guid))||(a&&b&&a!==b))throw Error('Omny URL changed '+p.id);
   updates.push(p);guidSet.add(p.guid);
  }
  // Individual writes, all rechecked immediately beforehand; never overwrite.
  const written=[];
  for(const p of updates){
   const cell=sh.getRange(p.row,7);
   if(String(cell.getValue()||'').trim())throw Error('GUID no longer blank '+p.id);
   cell.setValue(p.guid);
   written.push(p);
  }
  SpreadsheetApp.flush();
  const failed=written.filter(p=>String(sh.getRange(p.row,7).getValue()||'').toLowerCase()!==p.guid);
  if(failed.length)throw Error('POSTWRITE_VERIFY_FAILED '+failed.map(p=>p.id).join(','));
  if(history)history.appendRow([new Date(),'V2_GUID_OMNY_VERIFIED_PILOT',written.length,written.length,0,written.map(p=>p.id).join(','),'','','','RSS + Omny URL + show/title/JST date verified; 10-row pilot']);
  const result={status:'VERIFIED_WRITTEN',written:written.length,ids:written.map(p=>p.id),first:written[0]?.id||'',last:written[written.length-1]?.id||'',postwriteVerified:true};
  Logger.log(JSON.stringify(result));return result;
 } finally {lock.releaseLock();}
}
