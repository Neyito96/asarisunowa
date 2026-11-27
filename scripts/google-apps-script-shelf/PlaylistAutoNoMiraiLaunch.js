// ノーミライ初回登録専用。
// previewNoMiraiEpisodes234Launch() は読み取りのみ。
// launchNoMiraiEpisodes234() は #2・#3・#4 がすべて揃う場合だけSpotifyと作業台を更新する。

const NO_MIRAI_LAUNCH_ = {
  ruleKey: "no-mirai",
  playlistId: "4FBXSFf2nLjLb3qaRoSdoD",
  playlistUrl: "https://open.spotify.com/playlist/4FBXSFf2nLjLb3qaRoSdoD",
  title: "農MUSIC 猟ライフ（ノーミライ）",
  maker: "朝日新聞ポッドキャスト",
  expectedEpisodeNumbers: [2, 3, 4]
};

function previewNoMiraiEpisodes234Launch() {
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const plan = buildNoMiraiEpisodes234LaunchPlan_(token);
  Logger.log(JSON.stringify(plan, null, 2));
  return plan;
}

function launchNoMiraiEpisodes234() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("別の更新処理が実行中です。少し待って再実行してください");
  }

  try {
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

    const plan = buildNoMiraiEpisodes234LaunchPlan_(token);
    if (!plan.safeToRun) {
      throw new Error("安全条件を満たさないため停止しました: " + plan.reason);
    }

    if (plan.spotifyState === "none") {
      addAutoPlaylistEpisodesBatch_(plan.rule, token, plan.episodes);
      assertNoMiraiEpisodes234Present_(token, plan.episodes);
    }

    if (!plan.workSheetRow) {
      registerNoMiraiPlaylistInWorkSheet_();
    }

    updatePlaylistLatestDate_(NO_MIRAI_LAUNCH_.playlistId);

    const result = {
      ok: true,
      spotifyAddedCount: plan.spotifyState === "none" ? 3 : 0,
      sheetRegistered: !plan.workSheetRow,
      episodeNumbers: NO_MIRAI_LAUNCH_.expectedEpisodeNumbers.slice()
    };
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function buildNoMiraiEpisodes234LaunchPlan_(token) {
  const rule = getAutoPlaylistRuleByKey_(NO_MIRAI_LAUNCH_.ruleKey);
  if (!rule) throw new Error("ノーミライのルールが見つかりません");
  if (String(rule.playlistId || "") !== NO_MIRAI_LAUNCH_.playlistId) {
    throw new Error("ノーミライのPlaylist IDが想定と異なります");
  }

  const allEpisodes = fetchAutoPlaylistEpisodes_(rule, token);
  const episodes = selectExactNoMiraiEpisodes_(
    allEpisodes,
    NO_MIRAI_LAUNCH_.expectedEpisodeNumbers
  );
  const playlistItems = getAllSpotifyPlaylistItems_(NO_MIRAI_LAUNCH_.playlistId, token);
  const existingUris = new Set(playlistItems.map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  const presentCount = episodes.filter(function(episode) {
    return existingUris.has(String(episode.uri || ""));
  }).length;

  const spotifyState = presentCount === 0
    ? "none"
    : presentCount === episodes.length
    ? "all"
    : "partial";
  const workSheetRow = findNoMiraiWorkSheetRow_();

  return {
    safeToRun: spotifyState !== "partial",
    reason: spotifyState === "partial"
      ? "#2・#3・#4の一部だけがプレイリストに登録済みです"
      : "",
    spotifyState: spotifyState,
    workSheetRow: workSheetRow,
    episodeNumbers: episodes.map(function(episode) {
      return extractNoMiraiEpisodeNumber_(episode.name);
    }),
    episodeNames: episodes.map(function(episode) { return String(episode.name || ""); }),
    episodes: episodes,
    rule: rule
  };
}

function selectExactNoMiraiEpisodes_(episodes, expectedNumbers) {
  const expected = Array.isArray(expectedNumbers) ? expectedNumbers : [];
  const byNumber = {};

  (Array.isArray(episodes) ? episodes : []).forEach(function(episode) {
    const number = extractNoMiraiEpisodeNumber_(episode && episode.name);
    if (expected.indexOf(number) < 0) return;
    if (!byNumber[number]) byNumber[number] = [];
    byNumber[number].push(episode);
  });

  const selected = expected.map(function(number) {
    const matches = byNumber[number] || [];
    if (matches.length !== 1) {
      throw new Error(
        "ノーミライ #" + number + " の候補が" + matches.length + "件のため停止しました"
      );
    }
    if (!String(matches[0].uri || "")) {
      throw new Error("ノーミライ #" + number + " のURIがありません");
    }
    return matches[0];
  });

  if (selected.length !== 3) {
    throw new Error("追加対象が3件ではないため停止しました");
  }
  return selected;
}

function assertNoMiraiEpisodes234Present_(token, episodes) {
  const expectedUris = episodes.map(function(episode) { return String(episode.uri || ""); });
  const actualUris = new Set(
    getAllSpotifyPlaylistItems_(NO_MIRAI_LAUNCH_.playlistId, token).map(function(row) {
      return String(row && row.item && row.item.uri ? row.item.uri : "");
    }).filter(Boolean)
  );
  const missing = expectedUris.filter(function(uri) { return !actualUris.has(uri); });
  if (missing.length) {
    throw new Error("Spotify追加後の確認で" + missing.length + "件不足しています");
  }
}

function findNoMiraiWorkSheetRow_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, WORK_SHEET_NAME);
  if (!sheet) throw new Error("作業台シートが見つかりません");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const matches = [];
  rows.forEach(function(row, index) {
    const url = String(row[0] || "");
    const title = String(row[1] || "").trim();
    if (url.indexOf(NO_MIRAI_LAUNCH_.playlistId) >= 0 || title === NO_MIRAI_LAUNCH_.title) {
      matches.push(index + 2);
    }
  });
  if (matches.length > 1) {
    throw new Error("作業台にノーミライ候補が複数あるため停止しました");
  }
  return matches.length ? matches[0] : 0;
}

function registerNoMiraiPlaylistInWorkSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getSheetLoose(ss, WORK_SHEET_NAME);
  if (!sheet) throw new Error("作業台シートが見つかりません");
  if (findNoMiraiWorkSheetRow_()) return false;

  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 3).setValues([[
    NO_MIRAI_LAUNCH_.playlistUrl,
    NO_MIRAI_LAUNCH_.title,
    NO_MIRAI_LAUNCH_.maker
  ]]);
  // H列は新規登録日。更新処理では変更しない。
  sheet.getRange(row, 8).setValue(new Date());
  SpreadsheetApp.flush();
  return true;
}
