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

  (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
    const episodeId = getThemeV3EpisodeId_(row);
    if (!episodeId) return;

    const decision = getThemeV3Decision_(row);
    const addedAt = getThemeV3AddedAt_(row);
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
    removalReview: removalReview
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
  if (!config) return;
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
  if (!rule) return false;
  const playlistId = String(rule.playlistId || "").trim();
  return Object.keys(THEME_V3_CONFIG_).some(function(name) {
    return THEME_V3_CONFIG_[name].playlistId === playlistId;
  }) && typeof getAutoPlaylistRuleType_ === "function" &&
    getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_THEME_;
}

function getThemeV3SheetNameByPlaylistId_(playlistId) {
  const wanted = String(playlistId || "").trim();
  const names = Object.keys(THEME_V3_CONFIG_);
  for (let i = 0; i < names.length; i += 1) {
    if (THEME_V3_CONFIG_[names[i]].playlistId === wanted) return names[i];
  }
  return "";
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, "サイト公開用");
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error("サイト公開用シートが見つかりません");
  }
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
  const matches = [];
  values.forEach(function(row, index) {
    if (String(row[0] || "").indexOf(String(playlistId || "")) >= 0) matches.push(index + 2);
  });
  if (matches.length !== 1) {
    throw new Error("サイト公開用の対象行が一意ではありません: " + playlistId + " count=" + matches.length);
  }
  sheet.getRange(matches[0], 4).setValue(String(latestDate || "").slice(0, 10));
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

function applyThemeV3SpotifyPlan_(sheet, rule, token, plan) {
  const additions = Array.isArray(plan && plan.additions) ? plan.additions : [];
  const already = Array.isArray(plan && plan.alreadyPresent) ? plan.alreadyPresent : [];
  const now = new Date();

  already.forEach(function(item) {
    const addedCell = sheet.getRange(item.rowNumber, 11);
    if (!addedCell.getValue()) addedCell.setValue(now);
    const confirmedCell = sheet.getRange(item.rowNumber, 10);
    if (!confirmedCell.getValue()) confirmedCell.setValue(now);
  });

  if (!additions.length) {
    return { addedCount: 0, failedCount: 0, addedEpisodes: [] };
  }

  assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  const episodes = fetchThemeReviewEpisodeDetails_(additions.map(function(item) {
    return item.episodeId;
  }), token).sort(function(a, b) {
    return String(a.release_date || "").localeCompare(String(b.release_date || ""));
  });

  const result = addAutoPlaylistEpisodesIndividually_(rule, token, episodes);
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

  return result;
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
  const sheetName = getThemeV3SheetNameByPlaylistId_(rule.playlistId);
  if (!sheetName) throw new Error("テーマV3タブを解決できません: " + rule.playlistId);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("テーマV3タブが見つかりません: " + sheetName);

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
  const latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
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
  const latestDate = getThemeV3LatestPlaylistDate_(playlistItems);
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
