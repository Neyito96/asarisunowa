// Theme V3 single-sheet workflow.
// One theme = one sheet. Human decisions are authoritative.
// Spotify writes are explicit; this file never removes items automatically.

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

function getThemeV3ConfirmedAt_(row) {
  return row && row[9] ? row[9] : "";
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
function previewThemeV3SpotifyPlan_(sheetName, currentSpotifyEpisodeIds) {
  const config = getThemeV3Config_(sheetName);
  if (!config) throw new Error("テーマV3設定が見つかりません: " + sheetName);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("テーマタブが見つかりません: " + sheetName);

  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, 14).getValues()
    : [];

  return buildThemeV3SpotifyPlan_(rows, currentSpotifyEpisodeIds || []);
}


function isThemeV3RuntimeRule_(rule) {
  if (!rule || typeof getAutoPlaylistRuleType_ !== "function") return false;
  const playlistId = String(rule.playlistId || "").trim();
  return /^[A-Za-z0-9]{22}$/.test(playlistId) &&
    getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
}

function getThemeV3SheetNameByPlaylistId_(playlistId) {
  const wanted = String(playlistId || "").trim();
  const names = Object.keys(THEME_V3_CONFIG_);
  for (let i = 0; i < names.length; i += 1) {
    if (THEME_V3_CONFIG_[names[i]].playlistId === wanted) return names[i];
  }

  const rules = typeof loadAutoUpdateRuntimeRulesV1_ === "function"
    ? loadAutoUpdateRuntimeRulesV1_()
    : [];
  const matches = rules.filter(function(rule) {
    return rule &&
      String(rule.playlistId || "").trim() === wanted &&
      isThemeV3RuntimeRule_(rule);
  });
  return matches.length === 1 ? getThemeV3SheetNameForRule_(matches[0]) : "";
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
  let latestDate = getLatestReleaseDate_(addResult.addedEpisodes || []);
  if (!latestDate) {
    latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
  }
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

  // Spotify playlist GET can lag just after POST. Prefer the dates from the
  // episodes that were successfully added in this run so the public latest date
  // is available immediately, then fall back to the playlist/sheet view.
  let latestDate = getLatestReleaseDate_(addResult.addedEpisodes || []);
  if (!latestDate) {
    latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
  }
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
function runNordicThemeV3Production() {
  const playlistId = THEME_V3_CONFIG_["北欧"].playlistId;
  let rule = getThemeV3RuntimeRuleByPlaylistId_(playlistId);
  rule = normalizeThemeV3RuntimeRuleForIncremental_(rule);

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("北欧");
  if (!sheet) throw new Error("北欧タブが見つかりません");

  let playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const plan = buildThemeV3SpotifyPlan_(
    readThemeV3Rows_(sheet),
    themeV3CurrentSpotifyEpisodeIds_(playlistItems)
  );

  const addResult = applyThemeV3SpotifyPlan_(sheet, rule, token, plan);
  if (Number(addResult.failedCount || 0) > 0) {
    throw new Error("北欧Spotify追加に一部失敗しました");
  }

  playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  let latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
  if (!latestDate) {
    latestDate = getThemeV3LatestDateFromCurrentSheet_(
      sheet,
      themeV3CurrentSpotifyEpisodeIds_(playlistItems)
    );
  }
  if (!latestDate) throw new Error("北欧プレイリストの最新日付を取得できません");

  updatePlaylistLatestDate_(playlistId, latestDate);
  updateThemeV3PublicLatestDate_(playlistId, latestDate);

  saveAutoUpdateRuntimeRuleV1_(rule);
  setAutoUpdateRuleSheetStatusV1_(
    rule,
    "増分自動更新",
    "Theme V3本番開始。AUTO初稿→Spotify追加、人間削除は再追加しません"
  );

  SpreadsheetApp.flush();

  const result = {
    playlistId: playlistId,
    sheetName: "北欧",
    addedCount: Number(addResult.addedCount || 0),
    adoptedExistingCount: plan.alreadyPresent.length,
    removalReviewCount: plan.removalReview.length,
    tombstoneCount: plan.manualRemovalTombstones.length,
    latestDate: latestDate,
    autoManagedReady: true
  };
  Logger.log(JSON.stringify({ nordicThemeV3Production: result }));
  return result;
}
