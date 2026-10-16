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

function diagnoseLibraryV2Feed_(feedIndex) {
  const started = Date.now();
  const ss = SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh = ss.getSheetByName('エピソード台帳');
  const src = ss.getSheetByName('取得元一覧');
  const excluded = ss.getSheetByName('削除・除外履歴');
  if (!sh || !src || !excluded) throw Error('Required library tab missing');
  const rows = sh.getDataRange().getValues();
  const headers = rows.shift();
  if (headers[23] !== '出演者・スタッフ') throw Error('Unexpected cast column');
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
    map.get(key).push(index);
  }
  rows.forEach((r, i) => {
    add(byGuid, libV2CpGuid_(r[6]), i);
    add(byClip, libV2CpClip_(r[8]) || libV2CpClip_(r[32]), i);
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
    guidMatched: 0, clipMatched: 0, noMatch: 0, ambiguous: 0,
    duplicateRssGuid: 0, blockedOrConflicting: 0, metadataMismatch: 0,
    matchedComplete: 0, eligibleEpisodes: 0, eligibleCells: 0,
    missingByField: {guid:0, audio:0, description:0, cast:0, spotify:0},
    samples: [], unmatchedSamples: [], heldSamples: []
  };
  items.forEach(it => {
    const direct = byGuid.get(it.guid) || [], clip = byClip.get(it.guid) || [];
    if (direct.length) summary.guidMatched++;
    else if (clip.length) summary.clipMatched++;
    const matches = direct.length ? direct : clip;
    if (!it.guid || counts.get(it.guid) !== 1) { summary.duplicateRssGuid++; if (summary.heldSamples.length < 10) summary.heldSamples.push({guid:it.guid, title:it.title, reason:'blank_or_duplicate_rss_guid'}); return; }
    if (!matches.length) { summary.noMatch++; if (summary.unmatchedSamples.length < 10) summary.unmatchedSamples.push({guid:it.guid, title:it.title, date:it.date}); return; }
    if (matches.length !== 1) { summary.ambiguous++; if (summary.heldSamples.length < 10) summary.heldSamples.push({guid:it.guid, title:it.title, reason:'multiple_ledger_matches'}); return; }
    const r = rows[matches[0]], id = String(r[0] || '');
    const a = libV2CpClip_(r[8]), b = libV2CpClip_(r[32]);
    if ((r[14] && it.audio && String(r[14]) !== it.audio) ||
        (r[11] && it.spotify && String(r[11]) !== it.spotify) ||
        !/^EP-\d+$/.test(id) || (ids.get(id) || []).length !== 1 ||
        libV2CpBlocked_(r[38]) || tombGuid.has(it.guid) || tombId.has(id) ||
        (a && b && a !== b) || (r[6] && libV2CpGuid_(r[6]) !== it.guid)) {
      summary.blockedOrConflicting++; if (summary.heldSamples.length < 10) summary.heldSamples.push({id, reason:'blocked_or_conflicting'}); return;
    }
    if (libV2CpNorm_(r[1]) !== feeds.get(url) ||
        libV2CpNorm_(r[2]) !== it.title ||
        !it.date || libV2CpDate_(r[3]) !== it.date) {
      summary.metadataMismatch++; if (summary.heldSamples.length < 10) summary.heldSamples.push({id, reason:'metadata_mismatch'}); return;
    }
    const fields = [
      ['guid', 7, it.guid], ['audio', 15, /^https:\/\//.test(it.audio) ? it.audio : ''],
      ['description', 22, it.description], ['cast', 24, it.cast],
      ['spotify', 12, it.spotify]
    ].filter(([name, col, value]) =>
      value && !String(r[col-1] || '').trim() &&
      (col !== 12 || !spotifyOwners.has(value))
    );
    if (!fields.length) { summary.matchedComplete++; return; }
    summary.eligibleEpisodes++;
    summary.eligibleCells += fields.length;
    fields.forEach(([name]) => summary.missingByField[name]++);
    if (summary.samples.length < 10) {
      summary.samples.push({ id, columns: fields.map(([, col]) => col) });
    }
  });
  summary.elapsedMs = Date.now() - started;
  Logger.log(JSON.stringify(summary));
  return summary;
}
