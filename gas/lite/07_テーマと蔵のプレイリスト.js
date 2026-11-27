// 07_テーマと蔵のプレイリスト（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）
// もとのファイル: PlaylistAutoThemeReview.js, ThemeV3SingleSheet.js, LibraryTheme.js, LibraryPlaylist.js, ShelfSpotify.js

// ---- PlaylistAutoThemeReview.js ----
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
function fetchThemeReviewEpisodeDetails_(episodeIds, token) {
  const ids = Array.isArray(episodeIds) ? episodeIds.filter(Boolean) : [];
  return ids.map(function(episodeId) {
    const response = spotifyLegacyFetchV2_(
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

// Shared writer gate: non-theme rules do not use theme review. Theme writes
// require the saved production rule and an unadded, adopted queue row.
// Read both sheets so a recorded exclusion always wins. Never provision here.
function assertThemeReviewSpotifyWriteV1_(rule, episodes) {
  if (!rule) throw new Error("Spotify追加ルールがありません");
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_THEME_) return false;
  if (!isThemeReviewSpotifyWriteEnabled_()) {
    throw new Error("テーマ候補のSpotify本番追加は安全スイッチで停止中です");
  }
  const saved = getThemeReviewRuleByKeyV1_(rule.key);
  if (!saved || saved.enabled !== true || saved.productionWriteAllowed !== true ||
      saved.reviewRequired !== true || getAutoPlaylistRuleType_(saved) !== AUTO_PLAYLIST_RULE_TYPE_THEME_ ||
      String(saved.playlistId || "") !== String(rule.playlistId || "") ||
      ["requested", "audit", "paused"].indexOf(String(saved.lifecycleStatus || "").toLowerCase()) >= 0) {
    throw new Error("テーマの本番承認条件を確認できません");
  }
  const pair = getThemeReviewSheetPairV1_(saved, SpreadsheetApp.openById(SPREADSHEET_ID));
  if (!pair) throw new Error("テーマの候補・履歴タブが不足しています");
  const queue = readThemeReviewRows_(pair.queue);
  const history = readThemeReviewRows_(pair.history);
  if (!Array.isArray(episodes)) throw new Error("テーマ追加対象が不正です");
  episodes.forEach(function(episode) {
    const id = String(episode && episode.id || "").trim();
    if (!/^[A-Za-z0-9]{22}$/.test(id) || String(episode.uri || "") !== "spotify:episode:" + id) {
      throw new Error("テーマepisode ID・URIの対応が不正です");
    }
    const relevant = function(row) {
      return String(row[0] || "") === saved.key && String(row[1] || "").trim() === id;
    };
    const queued = queue.filter(relevant);
    const past = history.filter(relevant);
    if (queued.length !== 1 || String(queued[0][8] || "").trim() !== "採用" || queued[0][10] ||
        past.concat(queued).some(function(row) { return String(row[8] || "").trim() === "除外"; })) {
      throw new Error("未採用・除外済み・追加済みのテーマepisodeは追加できません: " + id);
    }
  });
  return true;
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
function fetchRecentThemeReviewEpisodes_(rule, token) {
  const byId = {};
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const response = spotifyLegacyFetchV2_(
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
    return rule && rule.themeEngineVersion !== 2 &&
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
function findSubmittedThemeReviewRuleV1_(rules, ruleKey) {
  const key = String(ruleKey || "").trim();
  if (!key.startsWith("request-")) {
    throw new Error("新規投稿テーマのruleKeyを指定してください");
  }

  const matches = (Array.isArray(rules) ? rules : []).filter(function(rule) {
    return rule && String(rule.key || "").trim() === key;
  });

  if (!matches.length) {
    throw new Error("申請テーマが見つかりません: " + key);
  }
  if (matches.length > 1) {
    throw new Error("申請テーマが複数存在します: " + key + " count=" + matches.length);
  }
  return matches[0];
}
function buildApprovedSubmittedThemeReviewRuleV1_(rule, ruleKey) {
  const key = String(ruleKey || "").trim();
  const source = Object.assign({}, rule || {});
  const id = String(source.playlistId || "").trim();

  if (
    getAutoPlaylistRuleType_(source) !== AUTO_PLAYLIST_RULE_TYPE_THEME_ ||
    source.enabled !== false ||
    source.productionWriteAllowed !== false ||
    source.reviewRequired !== true ||
    source.lifecycleStatus !== "requested"
  ) {
    throw new Error("未承認テーマの安全条件を満たしていません");
  }
  if (!/^[A-Za-z0-9]{22}$/.test(id) ||
      key !== "request-" + id ||
      Number(source.requestSheetRow) < 2 ||
      getAutoPlaylistRuleByKey_(key)) {
    throw new Error("テーマID・申請行・固定ルールとの対応が不正です");
  }

  source.enabled = true;
  source.productionWriteAllowed = true;
  source.reviewRequired = true;
  source.lifecycleStatus = AUTO_PLAYLIST_LIFECYCLE_.REVIEW;
  return source;
}

// Administrator-only approval. This only enables candidate review;
// it never fetches episodes or writes to Spotify.
function approveSubmittedThemeReviewV1(ruleKey) {
  const key = String(ruleKey || "").trim();
  const rule = findSubmittedThemeReviewRuleV1_(
    loadAutoUpdateRuntimeRulesV1_(), key
  );
  const approved = buildApprovedSubmittedThemeReviewRuleV1_(rule, key);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (!getThemeReviewSheetPairV1_(approved, ss)) {
    throw new Error("テーマ専用の候補・履歴タブが不足しています");
  }

  saveAutoUpdateRuntimeRuleV1_(approved);
  setAutoUpdateRuleSheetStatusV1_(
    approved,
    "候補確認中",
    "管理者承認済み。候補を確認し、採用した回だけSpotifyへ反映します"
  );
  return {
    ok: true,
    ruleKey: approved.key,
    playlistId: approved.playlistId,
    lifecycleStatus: approved.lifecycleStatus,
    spotifyWritten: false
  };
}

// GASエディタの実行ボタン用。選択中の1セルへruleKeyを入力して実行する。
function approveSubmittedThemeReviewFromActiveCellV1() {
  const range = SpreadsheetApp.getActiveRange();
  if (!range || range.getNumRows() !== 1 || range.getNumColumns() !== 1) {
    throw new Error("ruleKeyを入力した1セルだけを選択してください");
  }
  return approveSubmittedThemeReviewV1(String(range.getDisplayValue() || "").trim());
}

// Administrator-only preparation. Never call from a timed trigger.
function selectThemeReviewAutomationRulesV1_(fixedRules, runtimeRules) {
  const fixed = (Array.isArray(fixedRules) ? fixedRules : []).filter(function(rule) {
    return rule && rule.enabled !== false && rule.reviewRequired === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
  });
  const fixedKeys = new Set(fixed.map(function(rule) { return String(rule.key || ""); }));
  const submitted = (Array.isArray(runtimeRules) ? runtimeRules : []).filter(function(rule) {
    return rule && rule.themeEngineVersion !== 2 && !fixedKeys.has(String(rule.key || "")) &&
      String(rule.key || "").startsWith("request-") &&
      rule.enabled === true &&
      rule.productionWriteAllowed === true &&
      rule.reviewRequired === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_ &&
      String(rule.lifecycleStatus || "") === AUTO_PLAYLIST_LIFECYCLE_.REVIEW;
  });
  return fixed.concat(submitted);
}
function getThemeReviewAutomationRules_() {
  return selectThemeReviewAutomationRulesV1_(
    AUTO_PLAYLIST_RULES,
    loadAutoUpdateRuntimeRulesV1_()
  );
}

// 時間主導トリガー用。未確認候補の追記と、採用済み候補のSpotify反映を1回で行う。
function runThemeReviewAutomation() {
  if (spotifyCooldownV2_() > Date.now()) return spotifyWaitingReportV2_();
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

// ---- ThemeV3SingleSheet.js ----
const THEME_V3_CONFIG_ = {
  "中南米": {
    playlistId: "2Org6cCBgVas4d9OwzzxAv"
  },
  "北欧": {
    playlistId: "5OwJ6qphlx7kSlpdnk3AXJ"
  }
};
const THEME_V3_HEADERS_ = [
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
  "エラー",
  "判定元",
  "AI理由"
];
function sanitizeThemeV3SheetName_(value) {
  const base = String(value || "テーマ")
    .replace(/[\\\/\?\*\[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return base || "テーマ";
}
function getThemeV3SheetNameForRule_(rule) {
  if (!rule) return "";
  const playlistId = String(rule.playlistId || "").trim();

  const known = Object.keys(THEME_V3_CONFIG_).find(function(name) {
    return THEME_V3_CONFIG_[name].playlistId === playlistId;
  });
  if (known) return known;

  if (rule.themeSheetName) return sanitizeThemeV3SheetName_(rule.themeSheetName);
  return sanitizeThemeV3SheetName_(rule.name || rule.title || "テーマ");
}
function findThemeV3RuntimeRuleBySheetName_(sheetName) {
  const wanted = String(sheetName || "").trim();
  if (!wanted) return null;
  const rules = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_()
    : [];
  const matches = rules.filter(function(rule) {
    return rule &&
      typeof getAutoPlaylistRuleType_ === "function" &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_ &&
      getThemeV3SheetNameForRule_(rule) === wanted;
  });
  return matches.length === 1 ? matches[0] : null;
}
function ensureThemeV3SheetForRule_(rule) {
  if (!rule) throw new Error("Theme V3 ruleがありません");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheetName = getThemeV3SheetNameForRule_(rule);
  let sheet = ss.getSheetByName(sheetName);

  if (sheet && sheet.getLastRow() > 0) {
    const existingHeader = sheet
      .getRange(1, 1, 1, Math.min(14, sheet.getMaxColumns()))
      .getDisplayValues()[0]
      .slice(0, 14);
    const compatible = existingHeader.join("|") === THEME_V3_HEADERS_.join("|");
    if (!compatible) {
      sheetName = sanitizeThemeV3SheetName_(
        sheetName + "_" + String(rule.playlistId || "").slice(-6)
      );
      sheet = ss.getSheetByName(sheetName);
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, THEME_V3_HEADERS_.length).setValues([THEME_V3_HEADERS_]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, THEME_V3_HEADERS_.length)
      .setFontWeight("bold")
      .setBackground("#eeeeee");
    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(["未確認", "採用", "除外"], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, 9, Math.max(1, sheet.getMaxRows() - 1), 1)
      .setDataValidation(validation);
    sheet.autoResizeColumns(1, THEME_V3_HEADERS_.length);
  }

  rule.themeSheetName = sheetName;
  return sheet;
}
function fetchInitialThemeV3Episodes_(rule, token) {
  const byId = {};
  const maxPages = 5;

  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    let url =
      "https://api.spotify.com/v1/shows/" +
      encodeURIComponent(showId) +
      "/episodes?market=JP&limit=50";
    let page = 0;

    while (url && page < maxPages) {
      const response = fetchSpotifyReadWithRetry_(
        url,
        {
          muteHttpExceptions: true,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json"
          }
        },
        "Theme V3 bootstrap " + showId
      );
      const status = response.getResponseCode();
      if (status !== 200) {
        throw new Error(
          "Theme V3初回候補取得に失敗しました: " +
          showId +
          " status=" +
          status
        );
      }

      const data = JSON.parse(response.getContentText());
      (Array.isArray(data.items) ? data.items : []).forEach(function(episode) {
        if (
          episode &&
          episode.id &&
          matchesAutoPlaylistRule_(episode, rule)
        ) {
          byId[String(episode.id)] = episode;
        }
      });

      url = String(data.next || "");
      page += 1;
    }
  });

  return Object.keys(byId).map(function(id) {
    return byId[id];
  });
}
function getThemeV3Config_(sheetName) {
  return THEME_V3_CONFIG_[String(sheetName || "").trim()] || null;
}
function getThemeV3EpisodeId_(row) {
  return String(row && row[1] ? row[1] : "").trim();
}
function getThemeV3Decision_(row) {
  return String(row && row[8] ? row[8] : "").trim();
}
function getThemeV3AddedAt_(row) {
  return row && row[10] ? row[10] : "";
}

// Build a safe plan from the current sheet and current Spotify membership.
// - 採用 + not on Spotify + never previously added => add
// - 採用 + previously added + now missing => interpret as human Spotify removal;
//   do NOT re-add automatically (tombstone candidate)
// - 除外 + still on Spotify => removal candidate only; never auto-remove
function buildThemeV3SpotifyPlan_(rows, currentSpotifyEpisodeIds) {
  const current = new Set((currentSpotifyEpisodeIds || []).map(String));
  const additions = [];
  const alreadyPresent = [];
  const manualRemovalTombstones = [];
  const removalReview = [];
  const unavailable = [];

  (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
    const episodeId = getThemeV3EpisodeId_(row);
    if (!episodeId) return;

    const decision = getThemeV3Decision_(row);
    const addedAt = getThemeV3AddedAt_(row);
    const errorText = String(row && row[11] ? row[11] : "").trim();
    const present = current.has(episodeId);

    if (decision === "採用") {
      if (present) {
        alreadyPresent.push({ rowNumber: index + 2, episodeId: episodeId });
      } else if (addedAt) {
        manualRemovalTombstones.push({
          rowNumber: index + 2,
          episodeId: episodeId,
          reason: "spotify_manual_removal"
        });
      } else if (/^Spotify取得不可/.test(errorText)) {
        unavailable.push({
          rowNumber: index + 2,
          episodeId: episodeId,
          reason: errorText
        });
      } else {
        additions.push({ rowNumber: index + 2, episodeId: episodeId });
      }
      return;
    }

    if (decision === "除外" && present) {
      removalReview.push({
        rowNumber: index + 2,
        episodeId: episodeId,
        action: "REVIEW_REMOVAL"
      });
    }
  });

  return {
    additions: additions,
    alreadyPresent: alreadyPresent,
    manualRemovalTombstones: manualRemovalTombstones,
    removalReview: removalReview,
    unavailable: unavailable
  };
}
function applyThemeV3DecisionTimestamp_(sheet, rowNumber, decision, sourceLabel) {
  if (!sheet || rowNumber < 2) return;
  const confirmedCell = sheet.getRange(rowNumber, 10);
  const sourceCell = sheet.getRange(rowNumber, 13);

  if (decision === "採用" || decision === "除外") {
    if (!confirmedCell.getValue()) confirmedCell.setValue(new Date());
    if (sourceLabel && !sourceCell.getValue()) sourceCell.setValue(sourceLabel);
  } else if (decision === "未確認") {
    confirmedCell.clearContent();
    if (sourceLabel === "人間") sourceCell.clearContent();
  }
}

// Simple trigger. Human edits always override prior automatic draft decisions.
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const config = getThemeV3Config_(sheet.getName());
  const runtimeRule = config ? null : findThemeV3RuntimeRuleBySheetName_(sheet.getName());
  if (!config && !runtimeRule) return;
  if (e.range.getRow() < 2 || e.range.getColumn() !== 9 || e.range.getNumRows() !== 1) return;

  const decision = String(e.range.getDisplayValue() || "").trim();
  if (["未確認", "採用", "除外"].indexOf(decision) < 0) return;
  applyThemeV3DecisionTimestamp_(sheet, e.range.getRow(), decision, "人間");
}

// Read-only preview. No Spotify or Sheet writes.
function isThemeV3RuntimeRule_(rule) {
  if (!rule || typeof getAutoPlaylistRuleType_ !== "function") return false;
  const playlistId = String(rule.playlistId || "").trim();
  return /^[A-Za-z0-9]{22}$/.test(playlistId) &&
    getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
}
function getThemeV3RuntimeRuleByPlaylistId_(playlistId) {
  const wanted = String(playlistId || "").trim();
  const rules = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_()
    : [];
  const matches = rules.filter(function(rule) {
    return rule && String(rule.playlistId || "").trim() === wanted;
  });
  if (matches.length !== 1) {
    throw new Error("テーマV3 runtime ruleが一意ではありません: " + wanted + " count=" + matches.length);
  }
  return matches[0];
}
function normalizeThemeV3RuntimeRuleForIncremental_(rule) {
  const next = Object.assign({}, rule || {});
  next.enabled = true;
  next.productionWriteAllowed = true;
  next.reviewRequired = true;
  next.lifecycleStatus = "incremental";
  next.bootstrapPending = false;
  return next;
}
function readThemeV3Rows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
}
function themeV3CurrentSpotifyEpisodeIds_(playlistItems) {
  return (Array.isArray(playlistItems) ? playlistItems : []).map(function(row) {
    const item = row && (row.item || row.track) ? (row.item || row.track) : null;
    if (!item) return "";
    return String(item.id || String(item.uri || "").split(":").pop() || "").trim();
  }).filter(Boolean);
}
function updateThemeV3PublicLatestDate_(playlistId, latestDate) {
  // サイト公開用はA1のQUERY出力。直接書き込むと#REF!になるため、
  // 作業台F列だけを更新元にする。
  return {
    skipped: true,
    reason: "site-public-is-query-output",
    playlistId: String(playlistId || ""),
    latestDate: String(latestDate || "").slice(0, 10)
  };
}
function normalizeThemeV3Date_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy-MM-dd");
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone() || "Asia/Tokyo", "yyyy-MM-dd");
  }
  return "";
}
function getThemeV3LatestDateFromCurrentSheet_(sheet, currentSpotifyEpisodeIds) {
  const current = new Set((currentSpotifyEpisodeIds || []).map(String));
  let latest = "";
  readThemeV3Rows_(sheet).forEach(function(row) {
    const id = getThemeV3EpisodeId_(row);
    if (!id || !current.has(id)) return;
    const date = normalizeThemeV3Date_(row[2]);
    if (date && (!latest || date > latest)) latest = date;
  });
  return latest;
}
function getThemeV3LatestPlaylistDate_(playlistItems) {
  let latest = "";
  (Array.isArray(playlistItems) ? playlistItems : []).forEach(function(row) {
    const item = row && (row.item || row.track) ? (row.item || row.track) : null;
    const date = String(item && item.release_date ? item.release_date : "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && (!latest || date > latest)) latest = date;
  });
  return latest;
}
function fetchThemeV3PlayableEpisodesTolerant_(episodeIds, token) {
  const ids = Array.from(new Set((episodeIds || []).map(function(id) {
    return String(id || "").trim();
  }).filter(Boolean)));
  const episodes = [];
  const unavailableIds = [];

  ids.forEach(function(id) {
    const response = fetchSpotifyReadWithRetry_(
      "https://api.spotify.com/v1/episodes/" + encodeURIComponent(id) + "?market=JP",
      {
        muteHttpExceptions: true,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json"
        }
      },
      "Theme V3 episode " + id
    );

    const status = response.getResponseCode();

    if (status === 404) {
      unavailableIds.push(id);
      return;
    }

    if (status !== 200) {
      throw new Error("Theme V3 Episode取得失敗: id=" + id + " status=" + status);
    }

    const episode = JSON.parse(response.getContentText());
    if (!episode || !episode.id || episode.is_playable === false) {
      unavailableIds.push(id);
      return;
    }

    episodes.push({
      id: String(episode.id || ""),
      uri: String(episode.uri || ("spotify:episode:" + episode.id)),
      name: String(episode.name || episode.id),
      release_date: String(episode.release_date || "")
    });
  });

  return {
    episodes: episodes,
    unavailableIds: unavailableIds
  };
}
function assertThemeV3SpotifyWrite_(rule) {
  if (!rule) throw new Error("Theme V3 ruleがありません");
  const sheetName = getThemeV3SheetNameForRule_(rule);
  if (!sheetName) throw new Error("Theme V3対象プレイリストではありません: " + String(rule.playlistId || ""));
  if (rule.enabled === false) throw new Error("Theme V3 ruleが無効です");
  if (rule.productionWriteAllowed !== true) throw new Error("Theme V3本番書き込みが許可されていません");
  if (rule.reviewRequired !== true) throw new Error("Theme V3は人間レビュー有効である必要があります");
  if (String(rule.lifecycleStatus || "").trim().toLowerCase() !== "incremental") {
    throw new Error("Theme V3 lifecycleStatusがincrementalではありません");
  }
}
function addThemeV3EpisodesIndividually_(rule, token, episodes) {
  assertThemeV3SpotifyWrite_(rule);

  let addedCount = 0;
  let failedCount = 0;
  const addedEpisodes = [];

  (Array.isArray(episodes) ? episodes : []).forEach(function(ep) {
    const addRes = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/playlists/" +
        encodeURIComponent(rule.playlistId) +
        "/items",
      {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + token
        },
        payload: JSON.stringify({
          uris: [String(ep.uri)]
        })
      }
    );

    const status = addRes.getResponseCode();
    if (status === 200 || status === 201) {
      addedCount++;
      addedEpisodes.push(ep);
      Logger.log("Theme V3追加成功 ✅ " + ep.name);
    } else {
      failedCount++;
      Logger.log(
        "Theme V3追加不可 ⚠️ " +
        ep.name +
        " | status=" +
        status +
        " | " +
        addRes.getContentText()
      );
    }
  });

  return {
    addedCount: addedCount,
    failedCount: failedCount,
    addedEpisodes: addedEpisodes
  };
}
function applyThemeV3SpotifyPlan_(sheet, rule, token, plan) {
  const allAdditions = Array.isArray(plan && plan.additions) ? plan.additions : [];
  const additions = allAdditions.slice(0, 50);
  const already = Array.isArray(plan && plan.alreadyPresent) ? plan.alreadyPresent : [];
  const now = new Date();

  already.forEach(function(item) {
    const addedCell = sheet.getRange(item.rowNumber, 11);
    if (!addedCell.getValue()) addedCell.setValue(now);
    const confirmedCell = sheet.getRange(item.rowNumber, 10);
    if (!confirmedCell.getValue()) confirmedCell.setValue(now);
    sheet.getRange(item.rowNumber, 12).clearContent();
  });

  if (!additions.length) {
    return {
      addedCount: 0,
      failedCount: 0,
      addedEpisodes: [],
      unavailableCount: 0,
      pendingAdditionCount: Math.max(0, allAdditions.length - additions.length)
    };
  }

  assertAutoPlaylistSheetLinkBeforeWrite_(rule);

  // Batch endpoint is tolerant of removed/unavailable historical episodes.
  // A single 404 must not abort the whole theme playlist update.
  const fetched = fetchThemeV3PlayableEpisodesTolerant_(
    additions.map(function(item) { return item.episodeId; }),
    token
  );

  const episodes = fetched.episodes.sort(function(a, b) {
    return String(a.release_date || "").localeCompare(String(b.release_date || ""));
  });

  const unavailableSet = new Set(fetched.unavailableIds || []);
  const unavailable = additions.filter(function(item) {
    return unavailableSet.has(item.episodeId);
  });

  unavailable.forEach(function(item) {
    sheet.getRange(item.rowNumber, 12).setValue(
      "Spotify取得不可（配信停止・地域制限・旧IDの可能性）"
    );
  });

  const result = episodes.length
    ? addThemeV3EpisodesIndividually_(rule, token, episodes)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };

  const addedIds = new Set((result.addedEpisodes || []).map(function(ep) {
    return String(ep && ep.id ? ep.id : "");
  }));

  additions.forEach(function(item) {
    if (!addedIds.has(item.episodeId)) return;
    const confirmedCell = sheet.getRange(item.rowNumber, 10);
    if (!confirmedCell.getValue()) confirmedCell.setValue(now);
    sheet.getRange(item.rowNumber, 11).setValue(now);
    sheet.getRange(item.rowNumber, 12).clearContent();
  });

  return Object.assign({}, result, {
    unavailableCount: unavailable.length,
    unavailableIds: unavailable.map(function(item) { return item.episodeId; }),
    pendingAdditionCount: Math.max(0, allAdditions.length - additions.length)
  });
}
function appendThemeV3AutoDraftCandidates_(sheet, rule, episodes) {
  const rows = readThemeV3Rows_(sheet);
  const known = new Set(rows.map(getThemeV3EpisodeId_).filter(Boolean));
  const now = new Date();
  const newRows = [];

  (Array.isArray(episodes) ? episodes : []).forEach(function(episode) {
    const id = String(episode && episode.id ? episode.id : "").trim();
    if (!id || known.has(id)) return;
    const matchedKeywords = typeof getThemeReviewMatchedKeywords_ === "function"
      ? getThemeReviewMatchedKeywords_(episode, rule)
      : [];
    newRows.push([
      String(rule.key || ""),
      id,
      String(episode.release_date || ""),
      String(episode.show && episode.show.name ? episode.show.name : ""),
      String(episode.name || ""),
      matchedKeywords.join(" / "),
      typeof buildThemeReviewExcerpt_ === "function"
        ? buildThemeReviewExcerpt_(episode, matchedKeywords)
        : "",
      String(episode.external_urls && episode.external_urls.spotify
        ? episode.external_urls.spotify
        : "https://open.spotify.com/episode/" + id),
      "採用",
      now,
      "",
      "",
      "AUTO",
      "AUTO初稿: テーマキーワード一致。不要なら人間が除外/Spotify削除"
    ]);
    known.add(id);
  });

  if (newRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 14).setValues(newRows);
  }
  return { newCandidateCount: newRows.length };
}
function syncThemeV3Rule_(rule, token) {
  const sheet = ensureThemeV3SheetForRule_(rule);
  const sheetName = sheet.getName();

  const recent = typeof fetchRecentThemeReviewEpisodes_ === "function"
    ? fetchRecentThemeReviewEpisodes_(rule, token)
    : [];
  const drafted = appendThemeV3AutoDraftCandidates_(sheet, rule, recent);

  let playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const rows = readThemeV3Rows_(sheet);
  const plan = buildThemeV3SpotifyPlan_(
    rows,
    themeV3CurrentSpotifyEpisodeIds_(playlistItems)
  );
  const addResult = applyThemeV3SpotifyPlan_(sheet, rule, token, plan);

  playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  let latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
  if (!latestDate) {
    latestDate = getThemeV3LatestDateFromCurrentSheet_(
      sheet,
      themeV3CurrentSpotifyEpisodeIds_(playlistItems)
    );
  }
  if (latestDate) {
    updatePlaylistLatestDate_(rule.playlistId, latestDate);
    updateThemeV3PublicLatestDate_(rule.playlistId, latestDate);
  }

  setAutoUpdateRuleSheetStatusV1_(
    rule,
    "増分自動更新",
    "Theme V3 AUTO: 新規候補 " + drafted.newCandidateCount +
      " / 追加 " + Number(addResult.addedCount || 0) +
      " / 削除レビュー " + plan.removalReview.length +
      " / 手動削除保持 " + plan.manualRemovalTombstones.length
  );

  return {
    playlistId: rule.playlistId,
    sheetName: sheetName,
    newCandidateCount: drafted.newCandidateCount,
    addedCount: Number(addResult.addedCount || 0),
    failedCount: Number(addResult.failedCount || 0),
    removalReviewCount: plan.removalReview.length,
    tombstoneCount: plan.manualRemovalTombstones.length,
    latestDate: latestDate
  };
}
function activateSubmittedThemeV3Request_(rule, token) {
  if (!rule) throw new Error("テーマ申請ruleがありません");
  if (!isThemeV3RuntimeRule_(rule)) {
    throw new Error("Theme V3対象ではありません");
  }

  const activeRule = normalizeThemeV3RuntimeRuleForIncremental_(rule);
  const sheet = ensureThemeV3SheetForRule_(activeRule);

  const initialEpisodes = fetchInitialThemeV3Episodes_(activeRule, token);
  const drafted = appendThemeV3AutoDraftCandidates_(
    sheet,
    activeRule,
    initialEpisodes
  );

  let playlistItems = getAllSpotifyPlaylistItems_(activeRule.playlistId, token);
  const plan = buildThemeV3SpotifyPlan_(
    readThemeV3Rows_(sheet),
    themeV3CurrentSpotifyEpisodeIds_(playlistItems)
  );
  const addResult = applyThemeV3SpotifyPlan_(
    sheet,
    activeRule,
    token,
    plan
  );

  playlistItems = getAllSpotifyPlaylistItems_(activeRule.playlistId, token);
  let latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
  if (!latestDate) {
    latestDate = getThemeV3LatestDateFromCurrentSheet_(
      sheet,
      themeV3CurrentSpotifyEpisodeIds_(playlistItems)
    );
  }
  if (latestDate) {
    updatePlaylistLatestDate_(activeRule.playlistId, latestDate);
  }

  saveAutoUpdateRuntimeRuleV1_(activeRule);
  setAutoUpdateRuleSheetStatusV1_(
    activeRule,
    "増分自動更新",
    "Theme V3自動開始。初稿 " +
      drafted.newCandidateCount +
      "件 / Spotify追加 " +
      Number(addResult.addedCount || 0) +
      "件。人間削除は再追加しません"
  );

  SpreadsheetApp.flush();

  return {
    playlistId: activeRule.playlistId,
    sheetName: sheet.getName(),
    initialCandidateCount: drafted.newCandidateCount,
    addedCount: Number(addResult.addedCount || 0),
    failedCount: Number(addResult.failedCount || 0),
    latestDate: latestDate,
    autoManagedReady: true
  };
}
function runThemeV3Automation() {
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const rules = (typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_()
    : []).filter(function(rule) {
      return isThemeV3RuntimeRule_(rule) &&
        rule.enabled !== false &&
        rule.productionWriteAllowed === true &&
        String(rule.lifecycleStatus || "").trim().toLowerCase() === "incremental";
    });

  return rules.map(function(rule) {
    return syncThemeV3Rule_(rule, token);
  });
}

// One-time production cutover for 北欧.
// Adds current sheet rows marked 採用, stamps dates, enables incremental AUTO,
// updates latest-date public display, and leaves removals as human-reviewed only.

// ---- LibraryTheme.js ----
var LIBRARY_THEME_SINCE_ = '2026-11-24';
var LIBRARY_THEME_MAX_VERIFY_ = 40;   // 1回の実行で Spotify に確かめる回数の上限（多い時は次の時間に続き）
// SDGsを話そう の過去回は Spotify では「SDGsを話そう アーカイブ」番組にある（#395）
var LIBRARY_THEME_EXTRA_SHOW_IDS_ = { 'SDGsを話そう': '7vuSolzvNiNwu7UR4lVIwU' };
function libraryThemeNz_(s) { return String(s || '').normalize('NFKC').toLowerCase(); }
function libraryThemeSplitKeywords_(value) {
  return String(value || '').split(/[\n,、，]+/).map(function (k) { return k.trim(); }).filter(Boolean);
}

// 純粋: 自動更新申請の行 [受付日時, URL, 題名, 朝リスネーム, 招待URL, キーワード, 補足, 状態, メモ] → テーマ規則
function libraryThemeRuleFromRequestRow_(row, extraIds) {
  var memo = String(row[8] || ''), status = String(row[7] || '').trim();
  if (!/方式:\s*theme/.test(memo) || status !== '増分自動更新') return null;
  var m = String(row[1] || '').match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/);
  if (!m) return null;
  var d = String(row[0] || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  var received = d ? d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2) : '';
  if (!(received >= LIBRARY_THEME_SINCE_) && (extraIds || []).indexOf(m[1]) < 0) return null;
  var keywords = libraryThemeSplitKeywords_(row[5]);
  if (!keywords.length) return null;
  return { key: 'request-' + m[1], playlistId: m[1], name: String(row[2] || '').trim() || m[1], keywords: keywords };
}
function libraryThemeCount_(hay, needle) {
  var n = 0, i = hay.indexOf(needle);
  while (i >= 0) { n += 1; i = hay.indexOf(needle, i + needle.length); }
  return n;
}
// 純粋: 蔵の索引から、キーワードが題名か概要に入っている回を古い順に
//   liteRows: [id, 番組番号, 日時, 題名, …] / shows: 番組名の配列 / textById: { id: 概要 }
//   strong: 題名に一致、または概要に合計2回以上 → 採用。それ以外（概要に1回だけ）→ 未確認
function libraryThemePick_(rule, shows, liteRows, textById) {
  var kws = rule.keywords.map(function (k) { return { raw: k, nz: libraryThemeNz_(k) }; }).filter(function (k) { return k.nz.length >= 2; });
  var out = [];
  liteRows.forEach(function (r) {
    var title = libraryThemeNz_(r[3]), desc = libraryThemeNz_(textById[r[0]]);
    var titleHit = false, descCount = 0, matched = [];
    kws.forEach(function (k) {
      var t = title.indexOf(k.nz) >= 0, c = libraryThemeCount_(desc, k.nz);
      if (t || c) matched.push(k.raw);
      if (t) titleHit = true;
      descCount += c;
    });
    if (matched.length) out.push({ ep: r[0], show: shows[r[1]], date: String(r[2]).slice(0, 10), title: String(r[3] || ''), matched: matched, strong: titleHit || descCount >= 2 });
  });
  return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.ep.localeCompare(b.ep); });
}

// 純粋: その回の番組の Spotify 番組ID
function libraryThemeExpectedShowId_(show) {
  return (typeof LIBRARY_PLAYLIST_SHOW_IDS_ !== 'undefined' && LIBRARY_PLAYLIST_SHOW_IDS_[show]) || LIBRARY_THEME_EXTRA_SHOW_IDS_[show] || '';
}

// 純粋: タブに書き足す行を決める
//   known: タブにある Spotify エピソードID / lookup: 蔵ID→{spotifyId} / verified: spotifyId→{name, showId}
//   knownTitles: タブにある題名（正規化）→ true（同じ題名は重ねない）
function libraryThemePlan_(rule, picked, lookup, verified, known, knownTitles) {
  var out = { rows: [], already: 0, sameTitle: 0, missing: [], hold: [], unverified: [] }, seen = {}, seenTitle = {};
  knownTitles = knownTitles || {};
  picked.forEach(function (p) {
    var x = lookup[p.ep];
    if (!x || !x.spotifyId) { out.missing.push(p.ep); return; }
    var id = x.spotifyId, tk = libraryThemeNz_(p.title).replace(/\s+/g, '');
    if (known[id] || seen[id]) { out.already += 1; return; }
    if (tk && (knownTitles[tk] || seenTitle[tk])) { out.sameTitle += 1; return; }
    var v = verified[id];
    if (v === undefined) { out.unverified.push(p.ep); return; }   // 今回は確かめていない（次の時間に）
    var want = libraryThemeExpectedShowId_(p.show);
    if (!v || !want || v.showId !== want || libraryPlaylistNz_(v.name) !== libraryPlaylistNz_(p.title)) {
      out.hold.push({ ep: p.ep, reason: !v ? 'Spotifyで回を確認できない' : !want || v.showId !== want ? 'Spotify上の番組が違う' : 'Spotify上の題名が違う' });
      return;
    }
    seen[id] = true;
    if (tk) seenTitle[tk] = true;
    out.rows.push({ ep: p.ep, id: id, date: p.date, show: p.show, title: p.title, matched: p.matched, strong: !rule.strict || p.strong !== false });
  });
  return out;
}
function libraryThemeRules_() {
  var P = PropertiesService.getScriptProperties();
  var extra = String(P.getProperty('LIBRARY_THEME_EXTRA') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), AUTO_UPDATE_REQUEST_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var seen = {};
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getDisplayValues().map(function (row) { return libraryThemeRuleFromRequestRow_(row, extra); })
    .filter(function (r) { if (!r || seen[r.playlistId]) return false; seen[r.playlistId] = true; return true; });
}
function libraryThemeTextIndex_(si) {
  var out = {};
  (si.text || []).forEach(function (path) {
    (libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + path) || []).forEach(function (r) { if (r && r[0]) out[r[0]] = String(r[1] || ''); });
  });
  return out;
}
function libraryThemeSyncOne_(rule, data, write) {
  rule.strict = PropertiesService.getScriptProperties().getProperty('LIBRARY_THEME_STRICT') === 'ON';
  var runtime = getThemeV3RuntimeRuleByPlaylistId_(rule.playlistId);   // 一意でなければ例外（触らない）
  if (!isThemeV3RuntimeRule_(runtime) || String(runtime.lifecycleStatus || '') !== 'incremental') return { rule: rule.key, status: 'NOT_V3_INCREMENTAL' };
  var sheet = ensureThemeV3SheetForRule_(runtime);
  var known = {}, knownTitles = {};
  readThemeV3Rows_(sheet).forEach(function (row) {
    var id = getThemeV3EpisodeId_(row); if (id) known[id] = true;
    var tk = libraryThemeNz_(row[4]).replace(/\s+/g, ''); if (tk) knownTitles[tk] = true;
  });
  var picked = libraryThemePick_(rule, data.shows, data.lite, data.text);
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var toVerify = [];
  picked.forEach(function (p) { var x = lookup[p.ep]; if (x && x.spotifyId && !known[x.spotifyId] && toVerify.indexOf(x.spotifyId) < 0) toVerify.push(x.spotifyId); });
  var verified = {};
  toVerify.slice(0, LIBRARY_THEME_MAX_VERIFY_).forEach(function (id) {
    var e = fetchSpotifyEpisodeFromWebApi(id);
    verified[id] = e && e.showId ? { name: e.episodeTitle, showId: e.showId } : null;
  });
  var plan = libraryThemePlan_(rule, picked, lookup, verified, known, knownTitles);
  var report = { rule: rule.key, playlist: rule.name, write: !!write, found: picked.length,
    adopt: plan.rows.filter(function (r) { return r.strong; }).map(function (r) { return r.ep + ' ' + r.date + ' ' + r.title; }),
    candidates: plan.rows.filter(function (r) { return !r.strong; }).map(function (r) { return r.ep + ' ' + r.date + ' ' + r.title; }),
    already: plan.already, sameTitle: plan.sameTitle, missing: plan.missing, hold: plan.hold, later: plan.unverified.length };
  if (!write) { report.status = 'DRY_RUN'; return report; }
  if (plan.rows.length) {
    var now = new Date();
    sheet.getRange(sheet.getLastRow() + 1, 1, plan.rows.length, 14).setValues(plan.rows.map(function (r) {
      return [runtime.key || rule.key, r.id, r.date, r.show, r.title, r.matched.join(' / '), '', 'https://open.spotify.com/episode/' + r.id,
        r.strong ? '採用' : '未確認', now, '', '', '蔵',
        r.strong ? '蔵で一致（題名か、概要に2回以上）: ' + r.matched.join(' / ') + ' ／ 不要ならSpotifyから削除（入れ直しません）'
                 : '候補（概要に1回だけ）: ' + r.matched.join(' / ') + ' ／ Spotifyには入れていません。入れるなら判定を「採用」に'];
    }));
    SpreadsheetApp.flush();
    var token = getSpotifyUserAccessToken();
    if (!token) { report.status = 'ROWS_ADDED_NO_TOKEN'; return report; }
    if (plan.rows.some(function (r) { return r.strong; })) report.spotify = syncThemeV3Rule_(runtime, token);   // 既存の Theme V3 の仕組みで Spotify へ追加（人の除外・手動削除を尊重）
  }
  report.status = 'OK';
  return report;
}
var LIBRARY_THEME_INTERVAL_MS_ = 6 * 3600 * 1000;   // 蔵は1日数回しか変わらないので6時間おき（新しいテーマが来た時はすぐ）
function libraryThemeSyncAll_(write) {
  var rules = libraryThemeRules_();
  if (!rules.length) return { status: 'NO_THEME' };
  var P = PropertiesService.getScriptProperties(), sig = rules.map(function (r) { return r.playlistId + ':' + r.keywords.join('|'); }).join(',');
  var last = Number(P.getProperty('LIBRARY_THEME_LAST_RUN') || 0), lastSig = P.getProperty('LIBRARY_THEME_LAST_SIG') || '';
  if (write && sig === lastSig && Date.now() - last < LIBRARY_THEME_INTERVAL_MS_) return { status: 'WAIT', next: new Date(last + LIBRARY_THEME_INTERVAL_MS_).toISOString() };
  var manifest = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json'), si = manifest.searchIndex || {};
  var data = { shows: si.shows || [], lite: libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite), text: libraryThemeTextIndex_(si) };
  var results = rules.map(function (rule) {
    try { return libraryThemeSyncOne_(rule, data, write); } catch (e) { return { rule: rule.key, status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }; }
  });
  if (write && !results.some(function (r) { return r.later; })) {   // 確かめ残しがある時は次の時間に続きをやる
    P.setProperty('LIBRARY_THEME_LAST_RUN', String(Date.now()));
    P.setProperty('LIBRARY_THEME_LAST_SIG', sig);
  }
  return results;
}

// 管理人が手で動かす用（確認だけ・書き込まない）
function LIBRARY_THEME_DRY_RUN() { var r = libraryThemeSyncAll_(false); Logger.log(JSON.stringify(r, null, 1)); return r; }

// ---- LibraryPlaylist.js ----
var LIBRARY_PLAYLIST_RULES_ = [
  { key: 'posusume', name: 'ポすすめ', playlistId: '20eSUPkdsSN56eEC8dg2Lq', show: 'ドーナツ', showId: '0341I5UOUrJgm7KEvNGInZ', titleIncludes: '（ポすすめ）' }
];
// 作業台の J列（自動育成: 番組）・K列（自動育成: 題名の語）からも規則を作る。投稿フォームで指定でき、管理人がシートで直せる。
var LIBRARY_PLAYLIST_SHOW_IDS_ = {
  'ニュースの現場から': '392h0MYfvMTndEVzf2cOvC', 'ニュースの学校': '2uG9W6CnsaNi87AfSuGe8r', '報談': '5Dt1uyQaJpM6hPV8aEMP3R', 'スポンジ': '7euH6hzudIdp61JRSi9E8w',
  'MEDIA TALK': '0yhef9ORZkUZs9ZeotdCSY', 'こどもそうだんしつ': '1KExdSsjQnatS4TdseGoC0', 'ドーナツ': '0341I5UOUrJgm7KEvNGInZ'
};
// 純粋: 作業台の行 [URL, 題名, …, J番組, K語] → 規則
function libraryPlaylistRuleFromRow_(row) {
  var m = String(row[0] || '').match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})/), show = String(row[9] || '').trim(), word = String(row[10] || '').trim();
  if (!m || !LIBRARY_PLAYLIST_SHOW_IDS_[show] || libraryPlaylistNz_(word).length < 2) return null;
  return { key: 'sheet-' + m[1], name: String(row[1] || '').trim() || m[1], playlistId: m[1], show: show, showId: LIBRARY_PLAYLIST_SHOW_IDS_[show], titleIncludes: word };
}
function libraryPlaylistRules_() {
  var rules = LIBRARY_PLAYLIST_RULES_.slice(), seen = {};
  rules.forEach(function (r) { seen[r.playlistId] = true; });
  try {
    var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), WORK_SHEET_NAME);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 11).getDisplayValues().forEach(function (row) {
      var r = libraryPlaylistRuleFromRow_(row); if (r && !seen[r.playlistId]) { seen[r.playlistId] = true; rules.push(r); }
    });
  } catch (e) {}
  return rules;
}
// 直近の同期で「育っている」と確認できたプレイリスト（楽育ち表示用）
function libraryPlaylistGrowingIds_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_GROWING') || '{}'); } catch (e) { return {}; }
}
function libraryPlaylistMarkGrowing_(rule, ok) {
  var P = PropertiesService.getScriptProperties(), m = libraryPlaylistGrowingIds_();
  if (ok) m[rule.playlistId] = new Date().toISOString().slice(0, 16); else delete m[rule.playlistId];
  P.setProperty('LIBRARY_PLAYLIST_GROWING', JSON.stringify(m));
}
var LIBRARY_PLAYLIST_DATA_ = 'https://neyito96.github.io/asarisunowa/library/data/';
var LIBRARY_PLAYLIST_MAX_ADD_ = 20;
function libraryPlaylistNz_(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').trim(); }

// 純粋: 蔵の索引（lite 行 [id, 番組番号, 日時, 題名, 出演者, 音声]）から規則に合う回を古い順に
function libraryPlaylistPick_(rule, shows, liteRows) {
  var want = libraryPlaylistNz_(rule.titleIncludes);
  return liteRows.filter(function (r) { return shows[r[1]] === rule.show && libraryPlaylistNz_(r[3]).indexOf(want) >= 0; })
    .sort(function (a, b) { return String(a[2]).localeCompare(String(b[2])) || String(a[0]).localeCompare(String(b[0])); })
    .map(function (r) { return { ep: r[0], date: String(r[2]).slice(0, 10), title: r[3] }; });
}

// 純粋: 追加計画。蔵のID→Spotify ID、Spotify側の確認結果、プレイリストの既存URIから
//   add: 追加する回（古い順） / already: 既にある / missing: 蔵にSpotify URLが無い / hold: Spotify側の番組・題名が蔵と違う
function libraryPlaylistPlan_(rule, picked, lookup, verified, existingUris) {
  var out = { add: [], already: [], missing: [], hold: [] }, seen = {};
  picked.forEach(function (p) {
    var x = lookup[p.ep];
    if (!x || !x.spotifyId) { out.missing.push(p.ep); return; }
    var uri = 'spotify:episode:' + x.spotifyId, v = verified[x.spotifyId];
    if (!v || v.showId !== rule.showId || libraryPlaylistNz_(v.name) !== libraryPlaylistNz_(p.title)) {
      out.hold.push({ ep: p.ep, reason: !v ? 'Spotifyで回を確認できない' : v.showId !== rule.showId ? 'Spotify上の番組が違う' : 'Spotify上の題名が違う' }); return;
    }
    if (existingUris[uri] || seen[uri]) { out.already.push(p.ep); return; }
    seen[uri] = true;
    out.add.push({ id: x.spotifyId, uri: uri, name: p.title, ep: p.ep, date: p.date });
  });
  return out;
}
function libraryPlaylistFetchJson_(url) {
  var res = UrlFetchApp.fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('蔵データ取得失敗 ' + res.getResponseCode() + ' ' + url.replace(LIBRARY_PLAYLIST_DATA_, ''));
  return JSON.parse(res.getContentText());
}

// Spotify API でエピソードの番組IDと題名を読む（1件ずつ。まとめ取り /v1/episodes?ids= は 403 になるため既存の1件取得を使う）
function libraryPlaylistVerify_(ids) {
  var out = {};
  ids.forEach(function (id) { var e = fetchSpotifyEpisodeFromWebApi(id); if (e && e.showId) out[id] = { name: e.episodeTitle, showId: e.showId }; });
  return out;
}
function libraryPlaylistExisting_(playlistId, token) {
  var m = {};
  getAllSpotifyPlaylistItems_(playlistId, token).forEach(function (it) { var u = it && (it.item || it.track) && (it.item || it.track).uri; if (u) m[String(u)] = true; });
  return m;
}
function libraryPlaylistSyncOne_(rule, write) {
  var P = PropertiesService.getScriptProperties(), stopKey = 'LIBRARY_PLAYLIST_STOP_' + rule.key;
  if (write && P.getProperty(stopKey)) return { rule: rule.key, status: 'STOPPED', reason: P.getProperty(stopKey) };
  var manifest = libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + 'manifest.json'), si = manifest.searchIndex || {};
  var picked = libraryPlaylistPick_(rule, si.shows || [], libraryPlaylistFetchJson_(LIBRARY_PLAYLIST_DATA_ + si.lite));
  var lookup = shelfLibraryLookup_(picked.map(function (p) { return p.ep; }), function (u) { return libraryPlaylistFetchJson_(u); });
  var token = getSpotifyUserAccessToken();
  if (!token) return { rule: rule.key, status: 'NO_TOKEN' };
  var access = inspectAutoUpdatePlaylistAccessV1_(rule.playlistId, token);
  var ids = picked.map(function (p) { return lookup[p.ep] && lookup[p.ep].spotifyId; }).filter(Boolean);
  var verified = libraryPlaylistVerify_(ids), existing = libraryPlaylistExisting_(rule.playlistId, token);
  var plan = libraryPlaylistPlan_(rule, picked, lookup, verified, existing);
  var report = { rule: rule.key, playlist: rule.name, write: !!write, access: access, targets: picked.length, withSpotify: ids.length,
    add: plan.add.map(function (a) { return a.ep + ' ' + a.date + ' ' + a.name; }), already: plan.already.length, missing: plan.missing, hold: plan.hold };
  if (!write) { report.status = 'DRY_RUN'; return report; }
  if (!access || !access.editable) { report.status = 'NO_EDIT_PERMISSION'; libraryPlaylistMarkGrowing_(rule, false); return report; }
  var inList = picked.filter(function (p) { return plan.already.indexOf(p.ep) >= 0; }).map(function (p) { return p.date; }).sort();
  libraryPlaylistMarkGrowing_(rule, true);
  if (!plan.add.length) { report.status = 'OK_NO_CHANGE'; report.latest = libraryPlaylistTouchLatest_(rule, inList[inList.length - 1]); return report; }
  var batch = plan.add.slice(0, LIBRARY_PLAYLIST_MAX_ADD_), added = addAutoPlaylistEpisodesBatch_({ playlistId: rule.playlistId, name: rule.name }, token, batch);
  // 読み戻し: 追加したはずの回が全部プレイリストにあるか
  var after = libraryPlaylistExisting_(rule.playlistId, token), lost = batch.filter(function (a) { return !after[a.uri]; }).map(function (a) { return a.ep; });
  if (lost.length) { P.setProperty(stopKey, new Date().toISOString() + ' 読み戻し不一致 ' + lost.join(' ')); report.status = 'READBACK_MISMATCH_STOPPED'; report.lost = lost; return report; }
  var dates = inList.concat(batch.map(function (a) { return a.date; })).sort();
  report.latest = libraryPlaylistTouchLatest_(rule, dates[dates.length - 1]);
  report.status = 'OK'; report.added = added && added.addedCount; report.more = plan.add.length > batch.length; return report;
}

// 作業台のこのプレイリストの行の「最終更新日」（F列）を、プレイリストに入っている一番新しい回の日付にする（空か古い時だけ）
function libraryPlaylistTouchLatest_(rule, newestDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(newestDate || ''))) return '';
  var sh = getSheetLoose(SpreadsheetApp.openById(SPREADSHEET_ID), WORK_SHEET_NAME); if (!sh || sh.getLastRow() < 2) return '';
  var urls = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < urls.length; i++) {
    if (String(urls[i][0]).indexOf('/playlist/' + rule.playlistId) < 0) continue;
    var cell = sh.getRange(i + 2, 6), cur = String(cell.getDisplayValue() || '');
    if (!cur || cur < newestDate) cell.setValue(newestDate);
    return newestDate;
  }
  return '';
}
function libraryPlaylistSyncAll_() {
  var write = PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_WRITE') === 'ON';
  if (!write) return { status: 'WRITE_OFF' };   // 承認前は毎時の処理では何もしない（確認は LIBRARY_PLAYLIST_DRY_RUN で）
  var results = libraryPlaylistRules_().map(function (rule) {
    try { return libraryPlaylistSyncOne_(rule, true); } catch (e) { return { rule: rule.key, status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }; }
  });
  // テーマ別も蔵で探して育てる（LibraryTheme.js・#524）
  if (typeof libraryThemeSyncAll_ === 'function') {
    try { results.push({ rule: 'themes', status: 'THEMES', themes: libraryThemeSyncAll_(true) }); } catch (e) { results.push({ rule: 'themes', status: 'ERROR', error: String(e && e.message || e).slice(0, 300) }); }
  }
  return results;
}

// 管理人が手で動かす用
// 投稿直後に、その1件だけすぐ育てる（投稿で番組・題名の語が指定された時）
function libraryPlaylistSyncByUrl_(url) {
  if (PropertiesService.getScriptProperties().getProperty('LIBRARY_PLAYLIST_WRITE') !== 'ON') return { status: 'WRITE_OFF' };
  var m = String(url || '').match(/playlist\/([A-Za-z0-9]{22})/); if (!m) return { status: 'NO_PLAYLIST' };
  var rule = libraryPlaylistRules_().filter(function (r) { return r.playlistId === m[1]; })[0];
  return rule ? libraryPlaylistSyncOne_(rule, true) : { status: 'NO_RULE' };
}
function LIBRARY_PLAYLIST_DRY_RUN() { var r = libraryPlaylistRules_().map(function (rule) { return libraryPlaylistSyncOne_(rule, false); }); Logger.log(JSON.stringify(r, null, 1)); return r; }
function LIBRARY_PLAYLIST_WRITE_ON() { PropertiesService.getScriptProperties().setProperty('LIBRARY_PLAYLIST_WRITE', 'ON'); Logger.log('ON'); }
function LIBRARY_PLAYLIST_WRITE_OFF() { PropertiesService.getScriptProperties().deleteProperty('LIBRARY_PLAYLIST_WRITE'); Logger.log('OFF'); }
function LIBRARY_PLAYLIST_RUN_NOW() { var r = libraryPlaylistSyncAll_(); Logger.log(JSON.stringify(r, null, 1)); return r; }

// ---- ShelfSpotify.js ----
var SHELF_SPOTIFY_OK_ = 'Spotify追加OK';
var SHELF_SPOTIFY_DONE_ = 'Spotify追加済';
var SHELF_SPOTIFY_ERR_ = 'Spotify追加エラー';
var SHELF_LIBRARY_DETAILS_ = 'https://neyito96.github.io/asarisunowa/library/data/details/';
var SHELF_SPOTIFY_MAX_ROWS_ = 3;
function shelfPlaylistId_(url) {
  var m = String(url || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]{22})/);
  return m ? m[1] : '';
}
function shelfSpotifyEpisodeId_(links) {
  for (var i = 0; i < (links || []).length; i++) {
    var m = String(links[i] || '').match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
    if (m) return m[1];
  }
  return '';
}
// 蔵の公開データから EP-ID → {spotifyId, title}。バケットは EP番号/50 の切り捨て。
function shelfLibraryLookup_(ids, fetchJson) {
  var buckets = {}, out = {};
  ids.forEach(function (id) { var b = Math.floor(Number(id.slice(3)) / 50); (buckets[b] = buckets[b] || []).push(id); });
  Object.keys(buckets).forEach(function (b) {
    var rows = fetchJson(SHELF_LIBRARY_DETAILS_ + b + '.json') || [];
    rows.forEach(function (e) { if (e && buckets[b].indexOf(e.id) >= 0) out[e.id] = { spotifyId: shelfSpotifyEpisodeId_(e.links), title: String(e.title || '') }; });
  });
  return out;
}
// 純粋な計画: 並び順を保ち、Spotifyにない回と既にリストにある回を分ける。
function shelfSpotifyPlan_(ids, lookup, existingUris) {
  var add = [], missing = [], already = 0, seen = {};
  ids.forEach(function (id) {
    var x = lookup[id];
    if (!x || !x.spotifyId) { missing.push(id); return; }
    var uri = 'spotify:episode:' + x.spotifyId;
    if (existingUris[uri] || seen[uri]) { already++; return; }
    seen[uri] = true;
    add.push({ id: x.spotifyId, uri: uri, name: x.title, ep: id });
  });
  return { add: add, missing: missing, already: already };
}
function shelfSpotifySync_() {
  var c = posuCfg(), ss = SpreadsheetApp.openById(c.spreadsheetId), sh = ss.getSheetByName(SHELF_SHEET_);
  if (!sh || sh.getLastRow() < 2) return { rows: 0 };
  var W = SHELF_H_.length, data = sh.getRange(1, 1, sh.getLastRow(), W).getDisplayValues(), h = data[0];
  if (h[2] !== '状態' || h[3] !== 'EP-ID（並び順）' || h[12] !== '追加先プレイリストURL' || h[13] !== 'Spotify結果') return { error: '見出しが想定と違うため停止' };
  var targets = [];
  for (var r = 1; r < data.length && targets.length < SHELF_SPOTIFY_MAX_ROWS_; r++) if (String(data[r][2]).trim() === SHELF_SPOTIFY_OK_) targets.push(r);
  if (!targets.length) return { rows: 0 };
  var token = getSpotifyUserAccessToken();
  if (!token) return { error: 'Spotify認証トークンなし' };
  var fetchJson = function (url) { var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null; };
  var results = [];
  targets.forEach(function (r) {
    var row = data[r], rowNo = r + 1, receipt = row[0];
    var setResult = function (status, text) {
      // 書く直前に同じ受付IDの行か確かめる（並べ替え対策）
      if (sh.getRange(rowNo, 1).getDisplayValue() !== receipt) throw new Error('行がずれたため停止: ' + receipt);
      sh.getRange(rowNo, 3).setValue(status);
      sh.getRange(rowNo, 14).setValue(text);
    };
    try {
      var pid = shelfPlaylistId_(row[12]);
      if (!pid) { setResult(SHELF_SPOTIFY_ERR_, '追加先プレイリストURLがありません'); results.push({ receipt: receipt, error: 'NO_PLAYLIST' }); return; }
      var ids = String(row[3]).split(/\s+/).filter(function (x) { return /^EP-\d{5}$/.test(x); });
      var lookup = shelfLibraryLookup_(ids, fetchJson);
      var existing = {};
      getAllSpotifyPlaylistItems_(pid, token).forEach(function (it) { var u = it && it.item && it.item.uri; if (u) existing[String(u)] = true; });
      var plan = shelfSpotifyPlan_(ids, lookup, existing), added = 0;
      for (var i = 0; i < plan.add.length; i += 100) added += addAutoPlaylistEpisodesBatch_({ playlistId: pid, name: '蔵書 ' + receipt }, token, plan.add.slice(i, i + 100)).addedCount;
      var text = new Date().toISOString().slice(0, 16) + ' 追加' + added + '・既にあり' + plan.already + '・Spotifyなし' + plan.missing.length + (plan.missing.length ? '（' + plan.missing.join(' ') + '）' : '');
      setResult(SHELF_SPOTIFY_DONE_, text);
      results.push({ receipt: receipt, added: added, already: plan.already, missing: plan.missing.length });
    } catch (err) {
      try { setResult(SHELF_SPOTIFY_ERR_, String(err && err.message || err).slice(0, 200)); } catch (e2) {}
      results.push({ receipt: receipt, error: String(err && err.message || err) });
    }
  });
  SpreadsheetApp.flush();
  return { rows: results.length, results: results };
}

// 管理人が手で1回動かす用
function SHELF_SPOTIFY_RUN_NOW() { var r = shelfSpotifySync_(); Logger.log(JSON.stringify(r)); return r; }
