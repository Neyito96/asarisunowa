/**
 * Read-only ledger inventory. No RSS/API calls, no sheet writes, no properties or triggers.
 * Counts gaps by show; does not imply a gap is safe to auto-fill.
 */
function diagnoseLibraryV2LedgerGaps() {
  const ss = SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh = ss.getSheetByName('エピソード台帳');
  if (!sh) throw Error('Missing エピソード台帳');
  const data = sh.getDataRange().getValues(), h = data.shift();
  const required = {0:'台帳ID',1:'番組名',6:'外部ID',8:'元ページURL',9:'公式個別URL',11:'Spotify個別URL',14:'音声URL',21:'概要原文',23:'出演者・スタッフ',32:'取得元URL',38:'人間除外'};
  Object.keys(required).forEach(k => { if(h[k] !== required[k]) throw Error('Header mismatch '+k); });
  const shows = new Map();
  const total = {rows:0,missingGuid:0,missingGuidWithClip:0,missingGuidWithoutClip:0,missingGuidWithOfficialItem:0,missingGuidWithIdentity:0,missingGuidWithoutIdentity:0,conflictingAnchors:0,
    missingAudio:0,missingDescription:0,missingCast:0,missingSpotify:0,blocked:0};
  const fresh = () => ({rows:0,missingGuid:0,missingGuidWithClip:0,missingGuidWithoutClip:0,missingGuidWithOfficialItem:0,missingGuidWithIdentity:0,missingGuidWithoutIdentity:0,conflictingAnchors:0,
    missingAudio:0,missingDescription:0,missingCast:0,missingSpotify:0,blocked:0});
  data.forEach(r => {
    const name = libV2CpNorm_(r[1]) || '(番組名なし)';
    if (!shows.has(name)) shows.set(name, fresh());
    const s = shows.get(name), clip = libV2CpClip_(r[8]) || libV2CpClip_(r[32]);
    const flags = {
      rows:true,
      missingGuid:!String(r[6]||'').trim(),
      missingAudio:!String(r[14]||'').trim(),
      missingDescription:!String(r[21]||'').trim(),
      missingCast:!String(r[23]||'').trim(),
      missingSpotify:!String(r[11]||'').trim(),
      blocked:libV2CpBlocked_(r[38])
    };
    flags.missingGuidWithClip = flags.missingGuid && !!clip;
    flags.missingGuidWithoutClip = flags.missingGuid && !clip;
    flags.missingGuidWithOfficialItem = flags.missingGuid && !!libV2CpOfficialItem_(r[9]);
    flags.missingGuidWithIdentity = flags.missingGuid && libV2CpRowAnchors_(r).length>0;
    flags.missingGuidWithoutIdentity = flags.missingGuid && !flags.missingGuidWithIdentity;
    flags.conflictingAnchors = libV2CpRowAnchors_(r).length>1;
    for (const key of Object.keys(total)) if (flags[key]) { s[key]++; total[key]++; }
  });
  const result = {mode:'READ_ONLY_LEDGER_GAPS', total,
    byShow:[...shows].map(([show,stats])=>({show,...stats}))
      .sort((a,b)=>b.missingGuidWithClip-a.missingGuidWithClip||b.missingGuid-a.missingGuid)};
  Logger.log(JSON.stringify(result));
  return result;
}
