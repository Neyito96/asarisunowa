// 太田匡彦プレイリスト再構築
// V5監査の保存済みデータを使い、false_positive のみを削除候補にする。
// unresolved / review / confirmed は削除対象にしない。
// dryRunOtaMasahikoPlaylistRebuild() は Spotify への書き込みを行わない。

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
    items: items
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
