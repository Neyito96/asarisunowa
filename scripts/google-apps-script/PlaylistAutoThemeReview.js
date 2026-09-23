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
const THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ = true;
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(THEME_REVIEW_SHEET_NAME_);
  if (!sheet) sheet = ss.insertSheet(THEME_REVIEW_SHEET_NAME_);

  const headerRange = sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length);
  headerRange.setValues([THEME_REVIEW_HEADERS_]);
  headerRange.setFontWeight("bold").setBackground("#eeeeee");
  sheet.setFrozenRows(1);
  sheet.getRange(2, 9, Math.max(1, sheet.getMaxRows() - 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(THEME_REVIEW_DECISIONS_, true)
      .setAllowInvalid(false)
      .build()
  );
  return sheet;
}

function ensureThemeReviewHistorySheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(THEME_REVIEW_HISTORY_SHEET_NAME_);
  if (!sheet) sheet = ss.insertSheet(THEME_REVIEW_HISTORY_SHEET_NAME_);

  const headerRange = sheet.getRange(1, 1, 1, THEME_REVIEW_HEADERS_.length);
  headerRange.setValues([THEME_REVIEW_HEADERS_]);
  headerRange.setFontWeight("bold").setBackground("#eeeeee");
  sheet.setFrozenRows(1);
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
  const oldLastRow = sheet.getLastRow();
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, THEME_REVIEW_HEADERS_.length).setValues(rows);
  }
  if (oldLastRow > rows.length + 1) {
    sheet.getRange(rows.length + 2, 1, oldLastRow - rows.length - 1, THEME_REVIEW_HEADERS_.length)
      .clearContent();
  }
}

function isThemeReviewSpotifyWriteEnabled_() {
  if (THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ === true) return true;
  return PropertiesService.getScriptProperties()
    .getProperty(THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_) === "true";
}

// 除外済み、またはSpotify追加済みの採用行だけを履歴へ移す。
// 「採用」でも追加前・追加失敗中の行は確認シートに残し、取りこぼしを防ぐ。
function archiveCompletedThemeReviewRows_(rule) {
  let queueSheet;
  let historySheet;

  if (rule && !getAutoPlaylistRuleByKey_(rule.key)) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const pair = getThemeReviewSheetPairV1_(rule, ss);
    if (!pair) {
      throw new Error("テーマ専用の候補・履歴タブが不足しています");
    }
    queueSheet = pair.queue;
    historySheet = pair.history;
  } else {
    queueSheet = ensureThemeReviewSheet_();
    historySheet = ensureThemeReviewHistorySheet_();
  }
  const queueRows = readThemeReviewRows_(queueSheet);
  const historyRows = readThemeReviewRows_(historySheet);
  const historyKeys = new Set(historyRows.map(getThemeReviewRowKey_));
  const remaining = [];
  const archived = [];

  queueRows.forEach(function(row) {
    const decision = String(row[8] || "").trim();
    const completed = decision === "除外" || (decision === "採用" && Boolean(row[10]));
    if (!completed) {
      remaining.push(row);
      return;
    }
    const key = getThemeReviewRowKey_(row);
    if (!row[9]) row[9] = new Date();
    if (key !== "::" && !historyKeys.has(key)) {
      archived.push(row);
      historyKeys.add(key);
    }
  });

  if (archived.length) {
    historySheet.getRange(
      historySheet.getLastRow() + 1,
      1,
      archived.length,
      THEME_REVIEW_HEADERS_.length
    ).setValues(archived);
  }
  writeThemeReviewQueueRows_(queueSheet, remaining);
  SpreadsheetApp.flush();
  return { archivedCount: archived.length, remainingCount: remaining.length };
}

function appendThemeReviewEpisodesToQueue_(rule, episodes) {
  // Both sheets must exist before archiving or appending candidates.
  let sheet;
  let historySheet;

  if (rule && !getAutoPlaylistRuleByKey_(rule.key)) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const pair = getThemeReviewSheetPairV1_(rule, ss);
    if (!pair) {
      throw new Error("テーマ専用の候補・履歴タブが不足しています");
    }
    sheet = pair.queue;
    historySheet = pair.history;
  } else {
    sheet = ensureThemeReviewSheet_();
    historySheet = ensureThemeReviewHistorySheet_();
  }

  archiveCompletedThemeReviewRows_(rule);
  const existing = readThemeReviewExistingRows_(sheet);
  const history = readThemeReviewExistingRows_(historySheet);
  const newRows = (episodes || []).map(function(episode) {
    const key = rule.key + "::" + String(episode && episode.id ? episode.id : "");
    if (!episode || !episode.id || history[key] || existing[key]) return null;
    const matchedKeywords = getThemeReviewMatchedKeywords_(episode, rule);
    return [
      rule.key,
      String(episode.id || ""),
      String(episode.release_date || ""),
      String(episode.show && episode.show.name ? episode.show.name : ""),
      String(episode.name || ""),
      matchedKeywords.join(" / "),
      buildThemeReviewExcerpt_(episode, matchedKeywords),
      String(episode.external_urls && episode.external_urls.spotify
        ? episode.external_urls.spotify
        : "https://open.spotify.com/episode/" + episode.id),
      "未確認",
      "",
      "",
      ""
    ];
  }).filter(Boolean);

  const rows = readThemeReviewRows_(sheet).concat(newRows).sort(function(a, b) {
    const ruleCompare = String(a[0]).localeCompare(String(b[0]));
    return ruleCompare || String(b[2]).localeCompare(String(a[2]));
  });
  writeThemeReviewQueueRows_(sheet, rows);
  sheet.autoResizeColumns(1, THEME_REVIEW_HEADERS_.length);
  sheet.setColumnWidth(5, 320);
  sheet.setColumnWidth(7, 420);
  sheet.getRange(2, 1, Math.max(1, rows.length), THEME_REVIEW_HEADERS_.length)
    .setVerticalAlignment("top");
  SpreadsheetApp.flush();
  return { newCandidateCount: newRows.length, queueCount: rows.length };
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
    sheetName: THEME_REVIEW_SHEET_NAME_
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

// Fixed rules take precedence. Submitted theme rules are resolved
// only when explicitly approved for production.
function getThemeReviewRuleByKeyV1_(key) {
  const wanted = String(key || "").trim();
  if (!wanted) return null;

  const fixed = getAutoPlaylistRuleByKey_(wanted);
  if (fixed) return fixed;

  const runtime = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_()
    : [];

  const matches = runtime.filter(function(rule) {
    return rule &&
      String(rule.key || "").trim() === wanted &&
      rule.enabled === true &&
      rule.productionWriteAllowed === true &&
      rule.reviewRequired === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_ &&
      ["requested", "audit", "paused"].indexOf(
        String(rule.lifecycleStatus || "").trim().toLowerCase()
      ) < 0;
  });

  return matches.length === 1 ? matches[0] : null;
}

// Resolve a review-sheet name without creating or modifying sheets.
// Existing fixed themes retain their legacy shared queue.
function getThemeReviewSheetNameV1_(rule) {
  if (!rule || !rule.key || !rule.playlistId) return "";

  const fixed = getAutoPlaylistRuleByKey_(rule.key);
  if (fixed) {
    return String(fixed.playlistId || "") ===
      String(rule.playlistId || "")
      ? THEME_REVIEW_SHEET_NAME_
      : "";
  }

  if (!String(rule.key).startsWith("request-")) return "";

  const id = String(rule.playlistId || "").trim();
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return "";

  return "テーマ候補_" + id;
}

// Resolve an existing review sheet without creating or editing it.
// New theme sheets are provisioned in a separate, reviewed step.
function getThemeReviewSheetForRuleV1_(rule, ss) {
  const name = getThemeReviewSheetNameV1_(rule);
  if (!name || !ss) return null;

  const sheet = ss.getSheetByName(name);
  if (!sheet) return null;

  return sheet;
}

// Return queue and history names together.
// This function does not access or modify a spreadsheet.
function getThemeReviewSheetNamesV1_(rule) {
  const queueName = getThemeReviewSheetNameV1_(rule);
  if (!queueName) return null;

  const fixed = getAutoPlaylistRuleByKey_(rule.key);

  if (fixed) {
    return {
      queue: THEME_REVIEW_SHEET_NAME_,
      history: THEME_REVIEW_HISTORY_SHEET_NAME_
    };
  }

  const id = String(rule.playlistId || "").trim();

  return {
    queue: queueName,
    history: "テーマ履歴_" + id
  };
}

// Resolve both sheets before processing a theme.
// Never fall back to the shared queue for a submitted theme.
function getThemeReviewSheetPairV1_(rule, ss) {
  const names = getThemeReviewSheetNamesV1_(rule);
  if (!names || !ss) return null;

  const queue = ss.getSheetByName(names.queue);
  const history = ss.getSheetByName(names.history);

  if (!queue || !history || queue === history) return null;

  return {
    queue: queue,
    history: history
  };
}

// Administrator-only preparation. Never call from a timed trigger.
function prepareThemeReviewSheetsV1_(ruleKey) {
  const key = String(ruleKey || "").trim();

  if (!key.startsWith("request-")) {
    throw new Error("新規投稿テーマのみ準備できます");
  }

  const matches = loadAutoUpdateRuntimeRulesV1_()
    .filter(function(rule) {
      return rule && rule.key === key;
    });

  if (matches.length !== 1) {
    throw new Error("対象ルールが一意に見つかりません");
  }

  const rule = matches[0];

  if (
    getAutoPlaylistRuleType_(rule) !==
      AUTO_PLAYLIST_RULE_TYPE_THEME_ ||
    rule.enabled !== false ||
    rule.productionWriteAllowed !== false ||
    rule.reviewRequired !== true ||
    rule.lifecycleStatus !== "requested"
  ) {
    throw new Error("未承認テーマの安全条件を満たしていません");
  }

  const id = String(rule.playlistId || "").trim();

  if (!/^[A-Za-z0-9]{22}$/.test(id) ||
      key !== "request-" + id ||
      getAutoPlaylistRuleByKey_(key)) {
    throw new Error("テーマIDまたは固定ルールとの対応が不正です");
  }

  const names = getThemeReviewSheetNamesV1_(rule);

  if (
    !names ||
    names.queue !== "テーマ候補_" + id ||
    names.history !== "テーマ履歴_" + id
  ) {
    throw new Error("専用タブ名が不正です");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const queue = ss.getSheetByName(names.queue);
  const history = ss.getSheetByName(names.history);

  if (queue && history) {
    return {
      ok: true,
      created: false,
      queue: names.queue,
      history: names.history
    };
  }

  if (queue || history) {
    throw new Error(
      "専用タブが片方だけ存在します。管理者確認が必要です"
    );
  }

  // Only initialize newly created sheets.
  const newQueue = ss.insertSheet(names.queue);
  const newHistory = ss.insertSheet(names.history);

  [newQueue, newHistory].forEach(function(sheet) {
    sheet.getRange(
      1, 1, 1, THEME_REVIEW_HEADERS_.length
    ).setValues([THEME_REVIEW_HEADERS_]);

    sheet.setFrozenRows(1);
  });

  newQueue.getRange(
    2, 9, Math.max(1, newQueue.getMaxRows() - 1), 1
  ).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(THEME_REVIEW_DECISIONS_, true)
      .setAllowInvalid(false)
      .build()
  );

  return {
    ok: true,
    created: true,
    queue: names.queue,
    history: names.history
  };
}

function getThemeReviewAutomationRules_() {
  return AUTO_PLAYLIST_RULES.filter(function(rule) {
    return rule && rule.enabled !== false && rule.reviewRequired === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
  });
}

// 時間主導トリガー用。未確認候補の追記と、採用済み候補のSpotify反映を1回で行う。
function runThemeReviewAutomation() {
  if (!isThemeReviewSpotifyWriteEnabled_()) {
    throw new Error("テーマ候補の自動運用は停止中です");
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別のテーマ候補処理が実行中です");

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
    const results = getThemeReviewAutomationRules_().map(function(rule) {
      const queue = exportRecentThemeRuleCandidatesToReviewSheet_(rule, token);
      const spotify = addApprovedThemeCandidatesToSpotify_(rule.key);
      return { ruleKey: rule.key, queue: queue, spotify: spotify };
    });
    const archive = archiveCompletedThemeReviewRows_();
    Logger.log(JSON.stringify({ results: results, archive: archive }));
    return { results: results, archive: archive };
  } catch (error) {
    notifyAutoUpdateFailureSafely_({ target: "南米 中南米", stage: "テーマ候補の毎朝巡回", error: error });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

// 初回のみ管理者が実行する。毎朝5時台のトリガーを重複なしで作る。
function enableThemeReviewAutomation() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_, "true");
  const exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === THEME_REVIEW_AUTOMATION_HANDLER_;
  });
  if (!exists) {
    ScriptApp.newTrigger(THEME_REVIEW_AUTOMATION_HANDLER_)
      .timeBased()
      .everyDays(1)
      .atHour(5)
      .create();
  }
  return { enabled: true, triggerCreated: !exists };
}

// ScriptApp権限を追加せず、管理画面から手動作成したトリガーを有効にする。
function enableThemeReviewAutomationFlagOnly() {
  PropertiesService.getScriptProperties()
    .setProperty(THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_, "true");
  return { enabled: true, triggerCreated: false };
}

function disableThemeReviewAutomation() {
  PropertiesService.getScriptProperties()
    .deleteProperty(THEME_REVIEW_AUTOMATION_ENABLED_PROPERTY_);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === THEME_REVIEW_AUTOMATION_HANDLER_) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  return { enabled: false };
}

function previewApprovedThemeCandidates_(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(THEME_REVIEW_SHEET_NAME_);
  if (!sheet || sheet.getLastRow() < 2) return { ruleKey: ruleKey, approvedCount: 0, episodeIds: [] };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, THEME_REVIEW_HEADERS_.length).getValues();
  const episodeIds = rows.filter(function(row) {
    return String(row[0] || "") === rule.key &&
      String(row[8] || "") === "採用" && !row[10];
  }).map(function(row) { return String(row[1] || "").trim(); }).filter(Boolean);
  const result = { ruleKey: rule.key, approvedCount: episodeIds.length, episodeIds: episodeIds };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function previewApprovedSouthAmericaThemeCandidates() {
  return previewApprovedThemeCandidates_("south-america");
}

function addApprovedThemeCandidatesToSpotify_(ruleKey) {
  if (!isThemeReviewSpotifyWriteEnabled_()) {
    throw new Error("テーマ候補のSpotify本番追加は安全スイッチで停止中です");
  }
  const rule = getThemeReviewRuleByKeyV1_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  assertAutoPlaylistSheetLinkBeforeWrite_(rule);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const pair = getThemeReviewSheetPairV1_(rule, ss);
  if (!pair) {
    throw new Error("テーマの候補・履歴タブが不足しています");
  }
  const sheet = pair.queue;
  if (!sheet || sheet.getLastRow() < 2) return { addedCount: 0, skippedCount: 0 };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, THEME_REVIEW_HEADERS_.length).getValues();
  const approved = rows.map(function(row, index) { return { row: row, rowNumber: index + 2 }; })
    .filter(function(item) {
      return String(item.row[0] || "") === rule.key &&
        String(item.row[8] || "") === "採用" && !item.row[10];
    });
  if (!approved.length) {
    const archiveOnly = archiveCompletedThemeReviewRows_(rule);
    return {
      addedCount: 0,
      skippedCount: 0,
      archivedCount: archiveOnly.archivedCount
    };
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const existingUris = new Set(playlistItems.map(function(item) {
    return item && item.item && item.item.uri ? String(item.item.uri) : "";
  }).filter(Boolean));
  const episodes = fetchThemeReviewEpisodeDetails_(approved.map(function(item) {
    return String(item.row[1] || "");
  }), token).sort(function(a, b) {
    return String(a.release_date || "").localeCompare(String(b.release_date || ""));
  });
  const byId = approved.reduce(function(map, item) {
    map[String(item.row[1] || "")] = item;
    return map;
  }, {});
  let addedCount = 0;
  let skippedCount = 0;
  const addedEpisodes = [];

  episodes.forEach(function(episode) {
    const item = byId[String(episode.id || "")];
    if (!item) return;
    if (existingUris.has(String(episode.uri || ""))) {
      skippedCount += 1;
      sheet.getRange(item.rowNumber, 11).setValue(new Date());
      sheet.getRange(item.rowNumber, 12).clearContent();
      return;
    }
    const result = addAutoPlaylistEpisodesIndividually_(rule, token, [episode]);
    if (result.failedCount > 0) {
      sheet.getRange(item.rowNumber, 12).setValue("Spotify追加失敗");
      return;
    }
    addedCount += 1;
    addedEpisodes.push(episode);
    sheet.getRange(item.rowNumber, 10).setValue(item.row[9] || new Date());
    sheet.getRange(item.rowNumber, 11).setValue(new Date());
    sheet.getRange(item.rowNumber, 12).clearContent();
  });

  if (addedEpisodes.length && rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(rule.playlistId, getLatestReleaseDate_(addedEpisodes));
  }
  SpreadsheetApp.flush();
  const archive = archiveCompletedThemeReviewRows_(rule);
  return {
    addedCount: addedCount,
    skippedCount: skippedCount,
    archivedCount: archive.archivedCount
  };
}

function addApprovedSouthAmericaThemeCandidatesToSpotify() {
  return addApprovedThemeCandidatesToSpotify_("south-america");
}

// Read-only removal planning. Never calls Spotify or writes to Sheets.
// rows: current queue/history rows.
// existingIds: episode IDs currently found in the target playlist.
function planThemeSpotifyRemovalV1_(rule, rows, existingIds) {
  if (!rule || !/^[A-Za-z0-9]{22}$/.test(
    String(rule.playlistId || "")
  )) {
    throw new Error("対象プレイリストIDが不正です");
  }

  if (!rule.key || !Array.isArray(rows) ||
      !Array.isArray(existingIds)) {
    throw new Error("照合情報が不足しています");
  }

  const existing = new Set(existingIds);
  const decisions = new Map();

  rows.forEach(function(row) {
    if (!row || row[0] !== rule.key) return;

    const id = String(row[1] || "").trim();
    if (!/^[A-Za-z0-9]{22}$/.test(id)) {
      throw new Error("エピソードIDが不正です");
    }

    const decision = String(row[8] || "").trim();

    if (!["未確認", "採用", "除外"].includes(decision)) {
      throw new Error("判定が不正です");
    }

    const previous = decisions.get(id);

    if (previous && previous.decision !== decision) {
      throw new Error("同じエピソードの判定が衝突しています");
    }

    decisions.set(id, {
      decision: decision,
      added: Boolean(row[10]) ||
        Boolean(previous && previous.added)
    });
  });

  const candidates = [];

  decisions.forEach(function(state, id) {
    if (
      state.decision === "除外" &&
      state.added &&
      existing.has(id)
    ) {
      candidates.push({
        playlistId: rule.playlistId,
        episodeId: id,
        action: "REVIEW_REMOVAL"
      });
    }
  });

  return {
    dryRun: true,
    candidateCount: candidates.length,
    candidates: candidates
  };
}
