// テーマごとの候補タブ。既存の「テーマ候補確認」「テーマ候補確認コピー」は変更しない。
// 既存の判定を壊さず移行できるよう、作成・コピーは明示的な関数に分離する。
const THEME_PLAYLIST_TAB_PREFIX_ = "テーマ_";
const THEME_PLAYLIST_APPROVED_DECISIONS_ = ["採用", "自動採用", "手動採用"];
const THEME_PLAYLIST_EXCLUDED_DECISIONS_ = ["除外", "自動除外", "手動除外"];

function getThemePlaylistTabName_(rule) {
  if (!rule || getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error("テーマ型のルールを指定してください");
  }
  const id = String(rule.playlistId || "").trim();
  if (!/^[A-Za-z0-9]+$/.test(id)) throw new Error("テーマのプレイリストIDが不正です");
  // IDを末尾に残し、同名のテーマでも別タブにする。Sheetsのタブ名は最大100文字。
  const name = String(rule.name || rule.key || "テーマ")
    .replace(/[\\/?*\[\]:]/g, "_").replace(/\s+/g, " ").trim();
  const suffix = "_" + id;
  return THEME_PLAYLIST_TAB_PREFIX_ +
    name.slice(0, 100 - THEME_PLAYLIST_TAB_PREFIX_.length - suffix.length) + suffix;
}

// 読み取り専用。専用タブが未作成なら既存の共通キューを参照し、移行途中でも処理対象を見失わない。
function getThemePlaylistReadSheet_(rule) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(getThemePlaylistTabName_(rule)) ||
    ss.getSheetByName(THEME_REVIEW_SHEET_NAME_);
}

function ensureThemePlaylistTab_(rule) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const name = getThemePlaylistTabName_(rule);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  // 既存データは消去・並べ替えしない。ヘッダーが異なる既存タブは上書きしない。
  const headers = THEME_REVIEW_HEADERS_;
  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const nonempty = existing.some(function(value) { return String(value || "").trim() !== ""; });
  if (nonempty && existing.some(function(value, i) { return String(value) !== headers[i]; })) {
    throw new Error("既存タブの列構成が異なります: " + name);
  }
  if (!nonempty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 9, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["未確認", "採用", "除外", "自動採用", "自動除外", "要確認", "手動採用", "手動除外"], true)
      .setAllowInvalid(false).build()
  );
  return sheet;
}

// 移行はコピーのみ。既存キュー・履歴・コピータブを削除しない。
// 同じプレイリストの行が専用タブに存在すれば、その手動判定を優先して上書きしない。
function copyThemeReviewRowsToPlaylistTab_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  const destination = ensureThemePlaylistTab_(rule);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sources = [THEME_REVIEW_SHEET_NAME_, THEME_REVIEW_HISTORY_SHEET_NAME_];
  const existing = new Set(readThemeReviewRows_(destination).map(getThemeReviewRowKey_));
  const toCopy = [];
  sources.forEach(function(sourceName) {
    const source = ss.getSheetByName(sourceName);
    if (!source) return;
    readThemeReviewRows_(source).forEach(function(row) {
      if (String(row[0] || "").trim() !== String(rule.key)) return;
      const key = getThemeReviewRowKey_(row);
      if (key === "::" || existing.has(key)) return;
      existing.add(key);
      toCopy.push(row);
    });
  });
  if (toCopy.length) {
    destination.getRange(destination.getLastRow() + 1, 1, toCopy.length, THEME_REVIEW_HEADERS_.length)
      .setValues(toCopy);
  }
  return { ruleKey: rule.key, sheetName: destination.getName(), copiedCount: toCopy.length };
}

// 判定プレビューは書き込みをしない。専用タブが存在すればその手動判定を優先する。
// 未移行の共通キューには他テーマの行もあるため、必ずルールキーで絞り込む。
function previewThemePlaylistDecisions_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule || getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error("テーマルールが見つかりません: " + ruleKey);
  }
  const sheet = getThemePlaylistReadSheet_(rule);
  const rows = readThemeReviewRows_(sheet).filter(function(row) {
    return String(row[0] || "").trim() === String(rule.key);
  });
  const result = {
    ruleKey: rule.key,
    sheetName: sheet ? sheet.getName() : "",
    approvedIds: [],
    excludedIds: [],
    pendingIds: [],
    alreadyAddedIds: []
  };
  const seen = new Set();
  rows.forEach(function(row) {
    const id = String(row[1] || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const decision = String(row[8] || "").trim();
    // 追加済みでも手動除外の意思を表示する。Spotifyからの自動削除はしない。
    if (decision === "手動除外") {
      result.excludedIds.push(id);
    } else if (row[10]) {
      result.alreadyAddedIds.push(id);
    } else if (THEME_PLAYLIST_EXCLUDED_DECISIONS_.indexOf(decision) !== -1) {
      result.excludedIds.push(id);
    } else if (THEME_PLAYLIST_APPROVED_DECISIONS_.indexOf(decision) !== -1) {
      result.approvedIds.push(id);
    } else {
      result.pendingIds.push(id);
    }
  });
  return result;
}
