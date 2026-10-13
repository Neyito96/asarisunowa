/** Manual, read-only preview for the episode-library-bound Apps Script project.
 * Requires OfficialRssDeltaPreview.js. No writes, triggers, or Spotify calls.
 */
function runHoudanRssPreview() {
  return previewLibraryRssForShow_('報談');
}
/** Second migrated feed; independent read-only preview. */
function runNewsSchoolRssPreview() {
  return previewLibraryRssForShow_('ニュースの学校');
}
/** Execute both previews independently, without changing Sheets or Spotify. */
function runMigratedRssPreviews() {
  const results = ['報談', 'ニュースの学校'].map(function(show) {
    try {
      return previewLibraryRssForShow_(show);
    } catch (error) {
      const failure = { mode: 'READ_ONLY', show: show, ok: false,
        error: String(error && error.message || error) };
      Logger.log(JSON.stringify(failure));
      return failure;
    }
  });
  return rssLibrarySummarizePreviews_(results);
}
/** Explicitly distinguish a partial RSS result from a complete two-show scan. */
function rssLibrarySummarizePreviews_(results) {
  const summary = { mode: 'READ_ONLY', complete: false, successfulShows: 0, inspected: 0, newCandidates: 0,
    matched: 0, ambiguous: 0, excluded: 0, errors: 0 };
  results.forEach(function(result) {
    if (result.ok === false) { summary.errors += 1; return; }
    summary.successfulShows += 1;
    summary.inspected += result.inspected;
    summary.newCandidates += result.counts.new;
    summary.matched += result.counts.matched;
    summary.ambiguous += result.counts.ambiguous;
    summary.excluded += result.counts.excluded;
  });
  summary.complete = summary.successfulShows === results.length && summary.errors === 0;
  return { summary: summary, shows: results };
}
/** History columns: A GUID, B fixed ID, C show, D title. */
function rssLibraryExcludedHistory_(historyRows, showName) {
  return (historyRows || []).filter(function(row) {
    return String(row[2]).trim() === showName;
  }).map(function(row) {
    return { guid: row[0], externalId: row[1], title: row[3], excluded: true };
  });
}
/** Inspect up to 500 latest items for historical gaps; still strictly read-only. */
function runNewsSchoolBackfillPreview() {
  return previewLibraryRssForShow_('ニュースの学校', 500, true);
}
function previewLibraryRssForShow_(showName, limit, onlyUnmatched) {
  const name = String(showName || '報談').trim();
  const book = SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  if (!book) throw new Error('Test episode library spreadsheet not accessible');
  const source = book.getSheetByName('取得元一覧');
  const ledger = book.getSheetByName('エピソード台帳');
  if (!source || !ledger) throw new Error('Episode library tabs missing');
  const sourceRows = source.getRange(2, 1, Math.max(1, source.getLastRow() - 1), 8).getValues();
  const allowedShows = ['報談', 'ニュースの学校'];
  if (allowedShows.indexOf(name) === -1) throw new Error('Show not allowlisted for migration preview: ' + name);
  const selected = sourceRows.filter(function(row) { return String(row[0]).trim() === name; });
  if (selected.length !== 1) throw new Error('Expected exactly one RSS source for ' + name);
  const feedUrl = String(selected[0][7] || '').trim();
  const expectedFeed = { '報談': 'https://feeds.megaphone.fm/TASC9421488254', 'ニュースの学校': 'https://feeds.megaphone.fm/TASC5851398719' }[name];
  if (feedUrl !== expectedFeed) throw new Error('RSS source mismatch for ' + name + '; review 取得元一覧 H column');
  if (!/^https:\/\//.test(feedUrl)) throw new Error('RSS URL missing for ' + name);
  const exclusions = book.getSheetByName('削除・除外履歴');
  if (!exclusions) throw new Error('Exclusion history tab missing');
  const historyRows = exclusions.getLastRow() > 1
    ? exclusions.getRange(2, 1, exclusions.getLastRow() - 1, 9).getValues() : [];
  const blocked = rssLibraryExcludedHistory_(historyRows, name);
  const last = ledger.getLastRow();
  if (last < 2) throw new Error('Ledger has no rows; manual review required');
  const values = ledger.getRange(2, 1, last - 1, 45).getValues();
  const known = values.filter(function(row) { return String(row[1]).trim() === name; })
    .map(function(row) {
      const flag = String(row[38] || '').trim().toLowerCase();
      return { externalId: row[6], link: row[8], enclosureUrl: row[14], title: row[2], pubDate: row[3],
        excluded: flag !== '' && flag !== 'false' && flag !== '0' && flag !== '未指定' };
    });
  const result = previewOfficialRssDelta_(feedUrl, known.concat(blocked), limit || 20);
  const safe = { mode: result.mode, show: name, feed: feedUrl,
    ledgerRows: known.length, exclusionHistoryRows: blocked.length, inspected: result.inspected, counts: result.counts,
    candidates: result.items.filter(function(item) {
      return !onlyUnmatched || item.status !== 'matched';
    }).map(function(item) {
      return { title: item.title, pubDate: item.pubDate, status: item.status,
        guid: item.guid, link: item.link };
    }) };
  Logger.log(JSON.stringify(safe));
  return safe;
}
