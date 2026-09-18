// テーマ型プレイリストの候補確認キュー。
// 候補抽出と人の確認をSpotify本番書き込みから分離する。

const THEME_REVIEW_SHEET_NAME_ = "テーマ候補確認";
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
const THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ = false;

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
  const episodes = [];

  for (let offset = 0; offset < ids.length; offset += 50) {
    const chunk = ids.slice(offset, offset + 50);
    const response = UrlFetchApp.fetch(
      "https://api.spotify.com/v1/episodes?market=JP&ids=" +
        encodeURIComponent(chunk.join(",")),
      {
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      }
    );
    const status = response.getResponseCode();
    if (status !== 200) {
      throw new Error("テーマ候補詳細取得に失敗しました: status=" + status);
    }
    const data = JSON.parse(response.getContentText());
    (Array.isArray(data.episodes) ? data.episodes : []).forEach(function(episode) {
      if (episode && episode.id) episodes.push(episode);
    });
  }
  return episodes;
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

function readThemeReviewExistingRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const values = sheet.getRange(2, 1, lastRow - 1, THEME_REVIEW_HEADERS_.length).getValues();
  return values.reduce(function(map, row) {
    const key = String(row[0] || "").trim() + "::" + String(row[1] || "").trim();
    if (key !== "::") map[key] = row;
    return map;
  }, {});
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
  const sheet = ensureThemeReviewSheet_();
  const existing = readThemeReviewExistingRows_(sheet);

  const rows = episodes.map(function(episode) {
    const key = rule.key + "::" + episode.id;
    const old = existing[key] || [];
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
      String(old[8] || "未確認"),
      old[9] || "",
      old[10] || "",
      old[11] || ""
    ];
  }).sort(function(a, b) {
    return String(b[2]).localeCompare(String(a[2]));
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, THEME_REVIEW_HEADERS_.length).setValues(rows);
  }
  const oldLastRow = sheet.getLastRow();
  if (oldLastRow > rows.length + 1) {
    sheet.getRange(rows.length + 2, 1, oldLastRow - rows.length - 1, THEME_REVIEW_HEADERS_.length).clearContent();
  }
  sheet.autoResizeColumns(1, THEME_REVIEW_HEADERS_.length);
  sheet.setColumnWidth(5, 320);
  sheet.setColumnWidth(7, 420);
  sheet.getRange(2, 1, Math.max(1, rows.length), THEME_REVIEW_HEADERS_.length).setVerticalAlignment("top");
  SpreadsheetApp.flush();

  Logger.log("テーマ候補確認シート更新: rule=" + rule.key + " | candidates=" + rows.length);
  return { ruleKey: rule.key, candidateCount: rows.length, sheetName: THEME_REVIEW_SHEET_NAME_ };
}

function exportSouthAmericaThemeCandidatesToReviewSheet() {
  return exportThemeRuleCandidatesToReviewSheet_("south-america");
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
  if (THEME_REVIEW_SPOTIFY_WRITE_ENABLED_ !== true) {
    throw new Error("テーマ候補のSpotify本番追加は安全スイッチで停止中です");
  }
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("テーマルールが見つかりません: " + ruleKey);
  assertAutoPlaylistSheetLinkBeforeWrite_(rule);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(THEME_REVIEW_SHEET_NAME_);
  if (!sheet || sheet.getLastRow() < 2) return { addedCount: 0, skippedCount: 0 };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, THEME_REVIEW_HEADERS_.length).getValues();
  const approved = rows.map(function(row, index) { return { row: row, rowNumber: index + 2 }; })
    .filter(function(item) {
      return String(item.row[0] || "") === rule.key &&
        String(item.row[8] || "") === "採用" && !item.row[10];
    });
  if (!approved.length) return { addedCount: 0, skippedCount: 0 };

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
  return { addedCount: addedCount, skippedCount: skippedCount };
}

function addApprovedSouthAmericaThemeCandidatesToSpotify() {
  return addApprovedThemeCandidatesToSpotify_("south-america");
}
