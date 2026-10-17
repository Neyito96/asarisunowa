/**
 * Read-only, one-feed-at-a-time diagnostic for the V2 checkpoint migration.
 * No Sheet writes, property writes, triggers, or cache mutation.
 * Select an index 0..N-1 by calling diagnoseLibraryV2Feed_(index).
 * The public wrapper logs a feed inventory; change its numeric argument to inspect another feed.
 */
function diagnoseLibraryV2Feed0() { return diagnoseLibraryV2Feed_(0); }
function diagnoseLibraryV2Feed1() { return diagnoseLibraryV2Feed_(1); }
function diagnoseLibraryV2Feed2() { return diagnoseLibraryV2Feed_(2); }
function diagnoseLibraryV2Feed3() { return diagnoseLibraryV2Feed_(3); }
function diagnoseLibraryV2Feed4() { return diagnoseLibraryV2Feed_(4); }
function diagnoseLibraryV2Feed5() { return diagnoseLibraryV2Feed_(5); }
function diagnoseLibraryV2Feed6() { return diagnoseLibraryV2Feed_(6); }
function diagnoseLibraryV2Feed7() { return diagnoseLibraryV2Feed_(7); }
function diagnoseLibraryV2Feed8() { return diagnoseLibraryV2Feed_(8); }
function diagnoseLibraryV2Feed9() { return diagnoseLibraryV2Feed_(9); }

function diagnoseLibraryV2Feed_(feedIndex, sampleLimit) {
  const started = Date.now();
  sampleLimit=sampleLimit===undefined?10:sampleLimit;
  if(!Number.isInteger(sampleLimit)||sampleLimit<0||sampleLimit>1000)throw Error('Invalid sample limit');
  const ss = SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh = ss.getSheetByName('エピソード台帳');
  const src = ss.getSheetByName('取得元一覧');
  const excluded = ss.getSheetByName('削除・除外履歴');
  if (!sh || !src || !excluded) throw Error('Required library tab missing');
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  libV2CpCheckHeaders_(headers);
  const feeds = new Map();
  src.getDataRange().getValues().slice(1).forEach(r => {
    const url = String(r[7] || '').trim();
    const show = libV2CpNorm_(r[0]);
    if (/^https:\/\//.test(url) && !/youtube\.com|youtu\.be/i.test(url)) {
      if (feeds.has(url) && feeds.get(url) !== show) throw Error('Conflicting feed show');
      feeds.set(url, show);
    }
  });
  const urls = [...feeds.keys()].sort();
  if (!Number.isInteger(feedIndex) || feedIndex < 0 || feedIndex >= urls.length) {
    throw Error('Invalid feed index: ' + feedIndex + ', feedCount=' + urls.length);
  }
  const url = urls[feedIndex];
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw Error('RSS HTTP ' + response.getResponseCode());
  const items = libV2CpParse_(response.getContentText('UTF-8'));
  const byGuid = new Map(), byClip = new Map(), ids = new Map(), spotifyOwners = new Map();
  function add(map, key, index) {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    if(!map.get(key).includes(index))map.get(key).push(index);
  }
  rows.forEach((r, i) => {
    add(byGuid, libV2CpGuid_(r[6]), i);
    libV2CpRowAnchors_(r).forEach(g=>add(byClip,g,i));
    add(ids, String(r[0] || ''), i);
    add(spotifyOwners, String(r[11] || ''), i);
  });
  const tombGuid = new Set(), tombId = new Set();
  excluded.getDataRange().getValues().slice(1).forEach(r => {
    if (r[0]) tombGuid.add(libV2CpGuid_(r[0]));
    if (r[1]) tombId.add(String(r[1]).trim());
  });
  const counts = new Map();
  items.forEach(it => counts.set(it.guid, (counts.get(it.guid) || 0) + 1));
  const summary = {
    mode: 'READ_ONLY_FEED_DIAGNOSTIC', feedIndex, feedCount: urls.length,
    feed: url, show: feeds.get(url), rssItems: items.length, ledgerRows: rows.length,
    guidMatched: 0, clipMatched: 0, officialItemMatched: 0, noMatch: 0, ambiguous: 0,
    duplicateRssGuid: 0, blockedOrConflicting: 0, metadataMismatch: 0,
    matchedComplete: 0, matchedNoSupportedFill: 0, eligibleEpisodes: 0, eligibleCells: 0,
    missingByField: {guid:0, audio:0, description:0, cast:0, spotify:0},
    unsupportedGaps:{guid:0,audio:0,description:0,cast:0,spotify:0},
    reasons:{}, samples: [], unmatchedSamples: [], heldSamples: [],
    note:'matchedComplete is a legacy alias for matchedNoSupportedFill, not a data-completeness claim; eligible fields still require live prewrite/formula checks.'
  };
  items.forEach(it => {
    const direct = byGuid.get(it.guid) || [], clip = byClip.get(it.guid) || [];
    if (direct.length) summary.guidMatched++;
    else if (clip.length) {
      if(clip.some(i=>libV2CpClip_(rows[i][8])===it.guid||libV2CpClip_(rows[i][32])===it.guid))summary.clipMatched++;
      else summary.officialItemMatched++;
    }
    const matches = libV2CpMatches_(it.guid,byGuid,byClip);
    if (!it.guid || counts.get(it.guid) !== 1) { summary.duplicateRssGuid++; if (summary.heldSamples.length < sampleLimit) summary.heldSamples.push({guid:it.guid, title:it.title, reason:'blank_or_duplicate_rss_guid'}); return; }
    if (!matches.length) { summary.noMatch++; if (summary.unmatchedSamples.length < sampleLimit) summary.unmatchedSamples.push({guid:it.guid, title:it.title, date:it.date}); return; }
    if (matches.length !== 1) { summary.ambiguous++; if (summary.heldSamples.length < sampleLimit) summary.heldSamples.push({guid:it.guid, title:it.title, reason:'multiple_ledger_matches'}); return; }
    const r=rows[matches[0]],id=String(r[0]||'');
    const reasons=libV2CpRowReasons_(it,feeds.get(url),r,ids,{gs:tombGuid,is:tombId});
    if(reasons.length){
      reasons.forEach(reason=>summary.reasons[reason]=(summary.reasons[reason]||0)+1);
      if(reasons.some(reason=>!['show_mismatch','title_mismatch','date_mismatch'].includes(reason)))summary.blockedOrConflicting++;
      else summary.metadataMismatch++;
      if(summary.heldSamples.length<sampleLimit)summary.heldSamples.push({id,reasons});
      return;
    }
    const fields=libV2CpFields_(it,r,spotifyOwners).map(([col,value,name])=>[name,col,value]);
    for(const [name,col] of [['guid',7],['audio',15],['description',22],['cast',24],['spotify',12]]) {
      if(!String(r[col-1]||'').trim()&&!fields.some(f=>f[0]===name))summary.unsupportedGaps[name]++;
    }
    if(!fields.length){summary.matchedNoSupportedFill++;summary.matchedComplete++;return;}
    fields.filter(([,col])=>col===12).forEach(([,col,value])=>spotifyOwners.set(value,[matches[0]]));
    summary.eligibleEpisodes++;
    summary.eligibleCells += fields.length;
    fields.forEach(([name]) => summary.missingByField[name]++);
    if (summary.samples.length < sampleLimit) {
      summary.samples.push({ id, columns: fields.map(([, col]) => col) });
    }
  });
  summary.elapsedMs = Date.now() - started;
  Logger.log(JSON.stringify(summary));
  return summary;
}
