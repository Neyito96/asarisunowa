// 自動更新プレイリストと作業台シートの連携確認。
// Spotifyへ書き込む前に、更新日を書き戻せる行が一意に存在することを保証する。

function classifyAutoPlaylistSheetRows_(rows, playlistId) {
  const wantedId = String(playlistId || "").trim();
  const matches = [];

  (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
    const url = String(row && row[0] ? row[0] : "").trim();
    if (wantedId && url.indexOf(wantedId) >= 0) {
      matches.push({
        row: index + 2,
        url: url,
        title: String(row && row[1] ? row[1] : "").trim(),
        maker: String(row && row[2] ? row[2] : "").trim(),
        latestDate: String(row && row[5] ? row[5] : "").trim()
      });
    }
  });

  return {
    found: matches.length === 1,
    duplicate: matches.length > 1,
    count: matches.length,
    match: matches.length === 1 ? matches[0] : null
  };
}

function validateAutoPlaylistSheetHeaders_(headers) {
  const values = (Array.isArray(headers) ? headers : []).map(function(value) {
    return String(value || "").trim();
  });
  const required = [
    { column: 1, name: "Spotifyプレイリストのリンク" },
    { column: 6, name: "最終更新日" }
  ];
  const missing = required.filter(function(item) {
    return values[item.column - 1] !== item.name;
  }).map(function(item) { return item.name; });
  return { valid: missing.length === 0, missing: missing };
}

function inspectAutoPlaylistSheetLink_(playlistId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, WORK_SHEET_NAME);
  if (!sheet) throw new Error("作業台シートが見つかりません");

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(6, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rows = lastRow < 2
    ? []
    : sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  const result = classifyAutoPlaylistSheetRows_(rows, playlistId);
  result.headerCheck = validateAutoPlaylistSheetHeaders_(headers);
  return result;
}

function assertAutoPlaylistSheetLinkBeforeWrite_(rule) {
  const playlistId = String(rule && rule.playlistId ? rule.playlistId : "").trim();
  const result = inspectAutoPlaylistSheetLink_(playlistId);

  if (!result.headerCheck || !result.headerCheck.valid) {
    throw new Error(
      "作業台の列見出しが想定と異なるためSpotify追加前に停止しました: " +
      String(result.headerCheck && result.headerCheck.missing ? result.headerCheck.missing.join(", ") : "確認不能")
    );
  }
  if (result.duplicate) {
    throw new Error(
      String(rule && rule.name ? rule.name : playlistId) +
      " の作業台行が複数あるためSpotify追加前に停止しました"
    );
  }
  if (!result.found) {
    throw new Error(
      String(rule && rule.name ? rule.name : playlistId) +
      " が作業台にないためSpotify追加前に停止しました"
    );
  }
  return result.match;
}

function auditSatoYoAutoPlaylistReadiness() {
  const rule = getAutoPlaylistRuleByKey_("sato-yo");
  if (!rule) throw new Error("佐藤陽ルールが見つかりません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const existingUris = new Set(playlistItems.map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const counts = { confirmed: 0, review: 0, false_positive: 0, unresolved: 0 };
  const newConfirmed = [];
  const reviewCandidates = [];
  let mentionedEpisodeCount = 0;

  episodes.forEach(function(episode) {
    const searchableText = getAutoPlaylistEpisodeText_(episode, rule);
    if (!/佐藤[\s　]*陽/.test(searchableText)) return;
    mentionedEpisodeCount += 1;
    const result = classifySatoYoAutoPlaylistEpisode_(episode);
    const classification = String(result && result.classification ? result.classification : "unresolved");
    if (!Object.prototype.hasOwnProperty.call(counts, classification)) {
      counts.unresolved += 1;
      return;
    }
    counts[classification] += 1;
    if (classification === "confirmed" && !existingUris.has(String(episode && episode.uri ? episode.uri : ""))) {
      newConfirmed.push({
        name: String(episode && episode.name ? episode.name : ""),
        uri: String(episode && episode.uri ? episode.uri : ""),
        reason: String(result && result.reasons && result.reasons[0] ? result.reasons[0] : "")
      });
    }
    if (classification === "review" || classification === "unresolved") {
      reviewCandidates.push({
        name: String(episode && episode.name ? episode.name : ""),
        classification: classification,
        reason: String(result && result.reasons && result.reasons[0] ? result.reasons[0] : ""),
        excerpt: String(result && result.excerpt ? result.excerpt : "")
      });
    }
  });

  const sheetLink = inspectAutoPlaylistSheetLink_(rule.playlistId);
  const report = {
    dryRun: true,
    spotifyWrite: false,
    spreadsheetWrite: false,
    ruleEnabled: rule.enabled !== false,
    productionWriteAllowed: rule.productionWriteAllowed === true,
    sheetLink: sheetLink,
    fetchedEpisodeCount: episodes.length,
    mentionedEpisodeCount: mentionedEpisodeCount,
    counts: counts,
    newConfirmed: newConfirmed,
    reviewCandidates: reviewCandidates
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
