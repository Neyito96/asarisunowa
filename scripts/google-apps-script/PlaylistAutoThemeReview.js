// テーマ型プレイリストの候補確認キュー。
// 候補抽出と人の確認をSpotify本番書き込みから分離する。

const THEME_REVIEW_SHEET_NAME_ = "テーマ候補確認";
const THEME_REVIEW_HISTORY_SHEET_NAME_ = "テーマ判定履歴";
const THEME_REVIEW_HEADERS_ = [
  "ルールキー",
  "エピソードID",
  "公開日",
  "番組名",
  "エピソード名",
  "一致キーワード",
  "概要抜粋",
  "Spotify URL",
  "判定",
  "確認日時",
  "追加日時",
  "エラー"
];
const THEME_REVIEW_DECISIONS_ = ["未確認", "採用", "除外"];
// 南米・中南米はユーザー承認済みのAUTO対象。
// キーワード一致だけではSpotifyへ追加せず、候補確認シートで「採用」された回だけを書き込む。
const THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ = false;
const THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_ = "THEME_REVIEW_AUTOMATION_ENABLED";
const THEME_REVIEW_AUTOMATION_HANDLER_ = "runThemeReviewAutomation";

function getThemeReviewCandidateIds_(rule) {
  const report = reportAutoPlaylistV2Rule_(rule.key);
  if (report.completeShowCount !== report.showCount) {
    throw new Error(
      "候補検索が未完了です: " + report.completeShowCount + "/" + report.showCount + " show"
    );
  }
  return Array.isArray(report.candidateIds) ? report.candidateIds.slice() : [];
}

function fetchThemeReviewEpisodeDetails_(episodeIds, token) {
  const ids = Array.isArray(episodeIds) ? episodeIds.filter(Boolean) : [];
  return ids.map(function(episodeId) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes/" + encodeURIComponent(episodeId) + "?market=JP",
      {
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      }
    );
    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error("テーマ候補詳細取得に失敗しました: " + episodeId + " | status=" + status);
    }
    const episode = JSON.parse(response.getContentText());
    return episode && episode.id ? episode : null;
  }).filter(Boolean);
}

function getThemeReviewMatchedKeywords_(episode, rule) {
  const text = getAutoPlaylistEpisodeText_(episode, rule);
  const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
  return keywords.filter(function(keyword) {
    return text.indexOf(String(keyword)) >= 0;
  });
}

function buildThemeReviewExcerpt_(episode, matchedKeywords) {
  const source = String(
    (episode && (episode.description || episode.html_description)) || ""
  ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!source) return "";

  let index = -1;
  (matchedKeywords || []).some(function(keyword) {
    index = source.indexOf(String(keyword));
    return index >= 0;
  });
  const start = Math.max(0, index >= 0 ? index - 70 : 0);
  const excerpt = source.slice(start, start + 220);
  return (start > 0 ? "…" : "") + excerpt + (start + 220 < source.length ? "…" : "");
}

function ensureThemeReviewSheet_() {
  throw new Error("旧共通候補タブへのアクセスは禁止です");
}

function ensureThemeReviewHistorySheet_() {
  // 既存の64件とヘッダーを変更しない。履歴タブがなければ停止する。
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID)
    .getSheetByName(THEME_REVIEW_HISTORY_SHEET_NAME_);
  if (!sheet) throw new Error("既存のテーマ判定履歴がありません");
  const headers = sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length).getValues()[0];
  if (headers.some(function(value, index) { return value !== THEME_REVIEW_HEADERS_[index]; })) {
    throw new Error("テーマ判定履歴のヘッダーが想定と異なります");
  }
  return sheet;
}

function getThemeReviewRowKey_(row) {
  return String(row && row[0] ? row[0] : "").trim() + "::" +
    String(row && row[1] ? row[1] : "").trim();
}

function readThemeReviewRows_(sheet) {
  const lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, THEME_REVIEW_HEADERS_.length).getValues();
}

function readThemeReviewExistingRows_(sheet) {
  return readThemeReviewRows_(sheet).reduce(function(map, row) {
    const key = getThemeReviewRowKey_(row);
    if (key !== "::") map[key] = row;
    return map;
  }, {});
}

function writeThemeReviewQueueRows_(sheet, rows) {
  // 既存行の上書き・削除は行わない。追加専用。
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, THEME_REVIEW_HEADERS_.length)
    .setValues(rows);
}

function isThemeReviewSpotifyWriteEnabled_() {
  // 自動化フラグだけではSpotifyへの書き込みを許可しない。
  return THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ === true;
}

// 除外済み、またはSpotify追加済みの採用行だけを履歴へ移す。
// 「採用」でも追加前・追加失敗中の行は確認シートに残し、取りこぼしを防ぐ。
function archiveCompletedThemeReviewRows_(ruleKey) {
  // 履歴追記だけ行う。候補行の削除はしない（追記失敗時も安全）。
  const queueSheet = getExistingThemeReviewSheet_(ruleKey);
  const queueRows = readThemeReviewRows_(queueSheet);
  assertThemeReviewQueueRows_(queueRows, ruleKey);
  const historySheet = ensureThemeReviewHistorySheet_();
  const historyKeys = new Set(readThemeReviewRows_(historySheet).map(getThemeReviewRowKey_));
  const archived = [];
  queueRows.forEach(function(row) {
    const decision = String(row[8] || "").trim();
    const completed = decision === "除外" || (decision === "採用" && Boolean(row[10]));
    if (!completed) return;
    const key = getThemeReviewRowKey_(row);
    if (historyKeys.has(key)) return;
    const historyRow = row.slice();
    if (!historyRow[9]) historyRow[9] = new Date();
    archived.push(historyRow);
    historyKeys.add(key);
  });
  if (archived.length > 0) {
    historySheet.getRange(historySheet.getLastRow() + 1, 1,
      archived.length, THEME_REVIEW_HEADERS_.length).setValues(archived);
    SpreadsheetApp.flush();
  }
  return { archivedCount: archived.length, remainingCount: queueRows.length };
}

function appendThemeReviewEpisodesToQueue_(rule, episodes) {
  if (!rule || !rule.key) throw new Error("テーマキーがありません");
  const sheet = ensureThemeSpecificReviewSheet_(rule.key);
  const current = readThemeReviewRows_(sheet);
  assertThemeReviewQueueRows_(current, rule.key);
  const historySheet = ensureThemeReviewHistorySheet_();
  const existing = new Set(current.map(getThemeReviewRowKey_));
  const history = new Set(readThemeReviewRows_(historySheet).map(getThemeReviewRowKey_));
  const newRows = [];
  (episodes || []).forEach(function(episode) {
    if (!episode || !episode.id) return;
    const key = rule.key + "::" + String(episode.id);
    if (history.has(key) || existing.has(key)) return;
    existing.add(key); // 同一バッチ内の重複も防ぐ。
    const matchedKeywords = getThemeReviewMatchedKeywords_(episode, rule);
    newRows.push([
      rule.key, String(episode.id), String(episode.release_date || ""),
      String(episode.show && episode.show.name ? episode.show.name : ""),
      String(episode.name || ""), matchedKeywords.join(" / "),
      buildThemeReviewExcerpt_(episode, matchedKeywords),
      String(episode.external_urls && episode.external_urls.spotify
        ? episode.external_urls.spotify : "https://open.spotify.com/episode/" + episode.id),
      "未確認", "", "", ""
    ]);
  });
  newRows.sort(function(a, b) { return String(b[2]).localeCompare(String(a[2])); });
  writeThemeReviewQueueRows_(sheet, newRows);
  if (newRows.length) SpreadsheetApp.flush();
  return { newCandidateCount: newRows.length, queueCount: current.length + newRows.length };
}

function exportThemeRuleCandidatesToReviewSheet_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) {
    throw new Error("テーマ型以外のルールは候補確認シートへ出力できません");
  }

  const candidateIds = getThemeReviewCandidateIds_(rule);
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const episodes = fetchThemeReviewEpisodeDetails_(candidateIds, token);
  const appended = appendThemeReviewEpisodesToQueue_(rule, episodes);

  Logger.log("テーマ候補確認シート更新: rule=" + rule.key + " | new=" + appended.newCandidateCount);
  return {
    ruleKey: rule.key,
    candidateCount: candidateIds.length,
    newCandidateCount: appended.newCandidateCount,
    queueCount: appended.queueCount,
    sheetName: getThemeReviewSheetName_(rule.key)
  };
}

function exportSouthAmericaThemeCandidatesToReviewSheet() {
  return exportThemeRuleCandidatesToReviewSheet_("south-america");
}

// 日次運用では各番組の最新50件だけを確認する。
// 初回の全件調査はV2 dry-runで行い、その後はこの軽量差分取得を使う。
function fetchRecentThemeReviewEpisodes_(rule, token) {
  const byId = {};
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/shows/" + encodeURIComponent(showId) +
        "/episodes?market=JP&limit=50",
      {
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      }
    );
    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error("テーマ新着確認に失敗しました: " + showId + " | status=" + status);
    }
    const data = JSON.parse(response.getContentText());
    (Array.isArray(data.items) ? data.items : []).forEach(function(episode) {
      if (episode && episode.id && matchesAutoPlaylistRule_(episode, rule)) {
        byId[String(episode.id)] = episode;
      }
    });
  });
  return Object.keys(byId).map(function(id) { return byId[id]; });
}

function exportRecentThemeRuleCandidatesToReviewSheet_(rule, token) {
  const episodes = fetchRecentThemeReviewEpisodes_(rule, token);
  return appendThemeReviewEpisodesToQueue_(rule, episodes);
}

function getThemeReviewAutomationRules_() {
  return AUTO_PLAYLIST_RULES.filter(function(rule) {
    return rule && rule.enabled !== false && rule.reviewRequired === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
  });
}

// 時間主導トリガー用。未確認候補の追記と、採用済み候補のSpotify反映を1回で行う。
function runThemeReviewAutomation() {
  // 候補取得は可能。Spotifyへの追加はこの関数から絶対に呼び出さない。
  if (PropertiesService.getScriptProperties()
      .getProperty(THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_) !== "true") {
    throw new Error("テーマ候補の自動巡回は停止中です");
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別のテーマ候補処理が実行中です");
  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
    const results = getThemeReviewAutomationRules_().map(function(rule) {
      return { ruleKey: rule.key,
        queue: exportRecentThemeRuleCandidatesToReviewSheet_(rule, token) };
    });
    Logger.log(JSON.stringify({ results: results }));
    return { results: results };
  } catch (error) {
    notifyAutoUpdateFailureSafely_({ target: "テーマ候補", stage: "テーマ候補の毎朝巡回", error: error });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function enableThemeReviewAutomation() {
  throw new Error("トリガー作成は未承認です");
}

function enableThemeReviewAutomationFlagOnly() {
  throw new Error("自動化設定の変更は未承認です");
}

function disableThemeReviewAutomation() {
  throw new Error("トリガー変更は未承認です");
}

// 人間の過去判断をSpotify候補判定より優先する。
// 「除外」履歴がある回、または過去にSpotify反映済みの回は再登録しない。
function isThemeReviewSpotifyCandidateAllowed_(row, historyRows) {
  if (String(row && row[8] || "").trim() !== "採用") return false;
  if (row && row[10]) return false;

  const key = getThemeReviewRowKey_(row);
  const blocked = (historyRows || []).some(function(historyRow) {
    if (getThemeReviewRowKey_(historyRow) !== key) return false;

    const decision = String(historyRow && historyRow[8] || "").trim();

    if (decision === "除外") return true;
    if (decision === "採用" && Boolean(historyRow && historyRow[10])) {
      return true;
    }

    return false;
  });

  return !blocked;
}

function previewApprovedThemeCandidates_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  const sheet = getExistingThemeReviewSheet_(rule.key);
  const rows = readThemeReviewRows_(sheet);
  assertThemeReviewQueueRows_(rows, rule.key);
  const episodeIds = rows.filter(function(row) {
    return String(row[8] || "") === "採用" && !row[10];
  }).map(function(row) { return String(row[1]).trim(); });
  return { ruleKey: rule.key, approvedCount: episodeIds.length, episodeIds: episodeIds };
}

function previewApprovedSouthAmericaThemeCandidates() {
  return previewApprovedThemeCandidates_("south-america");
}

function addApprovedThemeCandidatesToSpotify_(ruleKey) {
  // 本番追加は別途承認・実装する。候補抽出や自動化フラグでは解除できない。
  throw new Error("Spotify追加は未承認のため無効です: " + ruleKey);
}

function addApprovedSouthAmericaThemeCandidatesToSpotify() {
  return addApprovedThemeCandidatesToSpotify_("south-america");
}

// テーマキーから専用候補確認タブ名を取得する（シートへのアクセスなし）
function assertThemeReviewQueueRows_(rows, ruleKey) {
  getThemeReviewSheetName_(ruleKey);
  const seen = new Set();
  (rows || []).forEach(function(row) {
    if (row.every(function(cell) { return cell === ""; })) return;
    if (String(row[0] || "") !== ruleKey || !String(row[1] || "").trim()) {
      throw new Error("候補タブに別テーマまたは不正な行があります: " + ruleKey);
    }
    const key = getThemeReviewRowKey_(row);
    if (seen.has(key)) throw new Error("候補タブ内でエピソードが重複しています: " + key);
    seen.add(key);
  });
}

function getThemeReviewSheetName_(ruleKey) {
  if (typeof ruleKey !== "string" ||
      !/^[a-z0-9-]+$/.test(ruleKey)) {
    throw new Error("不正なテーマキーです");
  }

  const sheetName = "テーマ候補_" + ruleKey;

  if (sheetName.length > 100) {
    throw new Error("シート名が長すぎます");
  }

  return sheetName;
}

// 既存の共通候補タブには戻さない。
// 読み取り時に専用タブが存在しなければ、作成せず停止する。
function getExistingThemeReviewSheet_(ruleKey) {
  const sheetName = getThemeReviewSheetName_(ruleKey);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("テーマ専用候補タブがありません: " + sheetName);
  }
  const headers = sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length).getValues()[0];
  if (headers.some(function(value, index) { return value !== THEME_REVIEW_HEADERS_[index]; })) {
    throw new Error("テーマ専用タブのヘッダーが想定と異なります: " + sheetName);
  }
  return sheet;
}

// 専用タブを新規作成する処理。
// 既存の共通候補タブ・コピータブにはアクセスしない。
function ensureThemeSpecificReviewSheet_(ruleKey) {
  const sheetName = getThemeReviewSheetName_(ruleKey);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  if (sheet) {
    const headers = sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length).getValues()[0];
    if (headers.some(function(value, index) { return value !== THEME_REVIEW_HEADERS_[index]; })) {
      throw new Error("テーマ専用タブのヘッダーが想定と異なります: " + sheetName);
    }
    return sheet;
  }

  sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length)
    .setValues([THEME_REVIEW_HEADERS_]);
  sheet.setFrozenRows(1);

  sheet.getRange(
    2, 9, Math.max(1, sheet.getMaxRows() - 1), 1
  ).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(THEME_REVIEW_DECISIONS_, true)
      .setAllowInvalid(false)
      .build()
  );

  return sheet;
}
