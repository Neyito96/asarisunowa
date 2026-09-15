// 太田匡彦プレイリスト再構築
// V5監査の保存済みデータを使い、false_positive のみを削除候補にする。
// unresolved / review / confirmed は削除対象にしない。
// dryRunOtaMasahikoPlaylistRebuild() は Spotify への書き込みを行わない。

const OTA_REBUILD_EXPECTED_PLAYLIST_ITEMS_ = 68;
const OTA_REBUILD_EXPECTED_REMOVE_COUNT_ = 36;
const OTA_REBUILD_EXPECTED_KEEP_COUNT_ = 22;
const OTA_REBUILD_EXPECTED_PROTECTED_COUNT_ = 10;

function buildOtaMasahikoPlaylistRebuildPlan_() {
  const props = PropertiesService.getUserProperties();
  const state = loadOtaMasahikoAuditV5State_(props);
  if (!state) throw new Error("V5監査データがありません。先にV5監査を完了してください。");
  if (!state.complete) throw new Error("V5監査が未完了です。");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const playlistItems = getAllSpotifyPlaylistItems_(OTA_AUDIT_V5_PLAYLIST_ID_, token);
  const items = playlistItems.map(function(playlistItem, index) {
    const playlistEpisode = playlistItem && playlistItem.item ? playlistItem.item : null;
    const id = String(playlistEpisode && playlistEpisode.id ? playlistEpisode.id : "").trim();
    const detailedEpisode = id ? loadOtaMasahikoAuditV5Episode_(props, id) : null;
    const episodeForAudit = detailedEpisode || playlistEpisode;
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episodeForAudit);

    return {
      position: index + 1,
      id: id,
      uri: String(playlistEpisode && playlistEpisode.uri ? playlistEpisode.uri : episodeForAudit && episodeForAudit.uri ? episodeForAudit.uri : ""),
      name: String(episodeForAudit && episodeForAudit.name ? episodeForAudit.name : ""),
      releaseDate: String(episodeForAudit && episodeForAudit.release_date ? episodeForAudit.release_date : ""),
      classification: classification.classification,
      reasons: classification.reasons || []
    };
  });

  const remove = items.filter(function(item) {
    return item.classification === "false_positive" && item.uri;
  });
  const keep = items.filter(function(item) {
    return item.classification === "confirmed";
  });
  const protectedItems = items.filter(function(item) {
    return item.classification === "review" || item.classification === "unresolved";
  });

  return {
    playlistId: OTA_AUDIT_V5_PLAYLIST_ID_,
    playlistItemCount: items.length,
    remove: remove,
    keep: keep,
    protectedItems: protectedItems,
    items: items,
    token: token
  };
}

function dryRunOtaMasahikoPlaylistRebuild() {
  const plan = buildOtaMasahikoPlaylistRebuildPlan_();

  Logger.log("=== OTA PLAYLIST REBUILD DRY RUN ===");
  Logger.log("既存項目数: " + plan.playlistItemCount);
  Logger.log("削除候補 false_positive: " + plan.remove.length);
  Logger.log("保持 confirmed: " + plan.keep.length);
  Logger.log("保護 review/unresolved: " + plan.protectedItems.length);
  Logger.log("Spotifyへの書き込み: なし");

  plan.remove.forEach(function(item) {
    Logger.log("REMOVE | " + item.releaseDate + " | " + item.name + " | " + item.uri + " | reasons=" + item.reasons.join(","));
  });
  plan.protectedItems.forEach(function(item) {
    Logger.log("PROTECT | " + item.classification + " | " + item.releaseDate + " | " + item.name + " | " + item.uri);
  });

  return {
    dryRun: true,
    playlistId: plan.playlistId,
    playlistItemCount: plan.playlistItemCount,
    removeCount: plan.remove.length,
    keepCount: plan.keep.length,
    protectedCount: plan.protectedItems.length,
    remove: plan.remove,
    protectedItems: plan.protectedItems
  };
}

function assertOtaMasahikoPlaylistRebuildPlanSafe_(plan) {
  if (plan.playlistItemCount !== OTA_REBUILD_EXPECTED_PLAYLIST_ITEMS_) {
    throw new Error("安全停止: 既存項目数が監査時の68件と一致しません: " + plan.playlistItemCount);
  }
  if (plan.remove.length !== OTA_REBUILD_EXPECTED_REMOVE_COUNT_) {
    throw new Error("安全停止: 削除候補が36件ではありません: " + plan.remove.length);
  }
  if (plan.keep.length !== OTA_REBUILD_EXPECTED_KEEP_COUNT_) {
    throw new Error("安全停止: confirmedが22件ではありません: " + plan.keep.length);
  }
  if (plan.protectedItems.length !== OTA_REBUILD_EXPECTED_PROTECTED_COUNT_) {
    throw new Error("安全停止: review/unresolvedが10件ではありません: " + plan.protectedItems.length);
  }
  if (plan.remove.some(function(item) { return item.classification !== "false_positive" || !item.uri; })) {
    throw new Error("安全停止: false_positive以外、またはURIなしの削除候補があります");
  }

  const uniqueUris = Array.from(new Set(plan.remove.map(function(item) { return item.uri; })));
  if (uniqueUris.length !== OTA_REBUILD_EXPECTED_REMOVE_COUNT_) {
    throw new Error("安全停止: 削除候補URIが36件の一意なURIになっていません: " + uniqueUris.length);
  }
}

function deleteOtaMasahikoConfirmedFalsePositives() {
  const plan = buildOtaMasahikoPlaylistRebuildPlan_();
  assertOtaMasahikoPlaylistRebuildPlanSafe_(plan);

  Logger.log("=== OTA PLAYLIST REBUILD WRITE ===");
  Logger.log("削除対象: false_positive 36件のみ");
  Logger.log("保持: confirmed 22件 / review・unresolved 10件");

  const url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(plan.playlistId) + "/items";
  const tracks = plan.remove.map(function(item) {
    return { uri: item.uri };
  });

  const response = UrlFetchApp.fetch(url, {
    method: "delete",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + plan.token,
      Accept: "application/json"
    },
    payload: JSON.stringify({ tracks: tracks })
  });

  const status = response.getResponseCode();
  Logger.log("Spotify delete status: " + status);
  if (status < 200 || status >= 300) {
    Logger.log(response.getContentText());
    throw new Error("Spotify削除に失敗しました。status=" + status);
  }

  const afterItems = getAllSpotifyPlaylistItems_(plan.playlistId, plan.token);
  Logger.log("削除前: " + plan.playlistItemCount);
  Logger.log("削除成功: " + plan.remove.length);
  Logger.log("削除後: " + afterItems.length);

  if (afterItems.length !== 32) {
    throw new Error("削除APIは成功しましたが、削除後件数が想定32件と一致しません: " + afterItems.length);
  }

  Logger.log("=== OTA PLAYLIST REBUILD COMPLETE ===");
  Logger.log("false_positive 36件を削除し、32件を保持しました。");

  return {
    ok: true,
    removed: plan.remove.length,
    remaining: afterItems.length
  };
}
