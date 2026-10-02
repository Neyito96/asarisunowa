// 読取専用: 既存の候補・履歴を専用タブへ移す前に件数と衝突を確認する。
// 実行してもタブ作成・セル変更・Spotify追加は行わない。
function previewThemePlaylistTabMigration_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  const tabName = getThemePlaylistTabName_(rule);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const destination = ss.getSheetByName(tabName);
  const existingRows = destination ? readThemeReviewRows_(destination) : [];
  const existingKeys = new Set(existingRows.map(getThemeReviewRowKey_));
  const seen = new Set(existingKeys);
  const sources = [THEME_REVIEW_SHEET_NAME_, THEME_REVIEW_HISTORY_SHEET_NAME_];
  const report = {
    ruleKey: rule.key,
    playlistId: rule.playlistId,
    tabName: tabName,
    tabExists: Boolean(destination),
    existingCount: existingRows.length,
    copyCount: 0,
    alreadyPresentCount: 0,
    duplicateSourceCount: 0,
    sourceCounts: {}
  };
  sources.forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    const rows = sheet ? readThemeReviewRows_(sheet) : [];
    let count = 0;
    rows.forEach(function(row) {
      if (String(row[0] || "").trim() !== String(rule.key)) return;
      const key = getThemeReviewRowKey_(row);
      if (key === "::") return;
      count++;
      if (existingKeys.has(key)) report.alreadyPresentCount++;
      else if (seen.has(key)) report.duplicateSourceCount++;
      else { seen.add(key); report.copyCount++; }
    });
    report.sourceCounts[name] = count;
  });
  Logger.log(JSON.stringify(report));
  return report;
}
