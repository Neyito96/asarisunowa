// 読み取り専用の専用タブ判定テスト。本番シート・Spotifyには接続しない。
// GASエディタで testThemePlaylistDecisionPreview_ を明示的に実行するまで動作しない。
function testThemePlaylistDecisionPreview_() {
  const originalSpreadsheetApp = SpreadsheetApp;
  const originalRuleLookup = getAutoPlaylistRuleByKey_;
  const originalRuleType = getAutoPlaylistRuleType_;
  const originalReadRows = readThemeReviewRows_;
  const originalSpreadsheetId = SPREADSHEET_ID;
  const rule = { key: "test-theme", playlistId: "0123456789abcdefABCDEF", name: "テスト" };
  const dedicatedName = "テーマ_テスト_" + rule.playlistId;
  const dedicatedRows = [
    [rule.key, "approved", "", "", "", "", "", "", "手動採用", "", "", ""],
    [rule.key, "excluded", "", "", "", "", "", "", "手動除外", "", "", ""],
    [rule.key, "added", "", "", "", "", "", "", "自動採用", "", "2026-09-20", ""],
    [rule.key, "pending", "", "", "", "", "", "", "要確認", "", "", ""],
    ["another-theme", "foreign", "", "", "", "", "", "", "採用", "", "", ""]
  ];
  const dedicatedSheet = { getName: function() { return dedicatedName; } };
  const sharedSheet = { getName: function() { return THEME_REVIEW_SHEET_NAME_; } };
  let dedicatedExists = true;
  try {
    SpreadsheetApp = {
      openById: function(id) {
        if (id !== originalSpreadsheetId) throw new Error("Unexpected spreadsheet ID");
        return { getSheetByName: function(name) {
          if (name === dedicatedName) return dedicatedExists ? dedicatedSheet : null;
          if (name === THEME_REVIEW_SHEET_NAME_) return sharedSheet;
          return null;
        } };
      }
    };
    getAutoPlaylistRuleByKey_ = function(key) { return key === rule.key ? rule : null; };
    getAutoPlaylistRuleType_ = function() { return AUTO_PLAYLIST_RULE_TYPE_THEME_; };
    readThemeReviewRows_ = function(sheet) {
      return sheet === dedicatedSheet ? dedicatedRows : dedicatedRows.slice(0, 1);
    };
    const actual = previewThemePlaylistDecisions_(rule.key);
    function check(condition, label) { if (!condition) throw new Error("Theme preview test failed: " + label); }
    check(actual.sheetName === dedicatedName, "dedicated tab precedence");
    check(actual.approvedIds.join() === "approved", "manual approval");
    check(actual.excludedIds.join() === "excluded", "manual exclusion");
    check(actual.alreadyAddedIds.join() === "added", "already added");
    check(actual.pendingIds.join() === "pending", "pending and cross-rule isolation");
    dedicatedExists = false;
    const fallback = previewThemePlaylistDecisions_(rule.key);
    check(fallback.sheetName === THEME_REVIEW_SHEET_NAME_, "shared queue fallback");
    check(fallback.approvedIds.join() === "approved", "fallback decision");
    return { passed: 7, productionWrites: 0 };
  } finally {
    SpreadsheetApp = originalSpreadsheetApp;
    getAutoPlaylistRuleByKey_ = originalRuleLookup;
    getAutoPlaylistRuleType_ = originalRuleType;
    readThemeReviewRows_ = originalReadRows;
  }
}
