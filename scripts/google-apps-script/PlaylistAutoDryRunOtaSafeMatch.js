// 太田匡彦プレイリスト：安全な新規候補判定 dry-run
// 既存V2監査で実績のある分類器を流用し、confirmed の未登録回だけを追加候補にする。
// Spotify・スプレッドシートへの書き込みは行わない。

function dryRunOtaMasahikoSafeAutoUpdate() {
  const rule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (!rule) throw new Error("太田匡彦の自動更新ルールが見つかりません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const existingUris = {};

  playlistItems.forEach(function(playlistItem) {
    const item = playlistItem && playlistItem.item ? playlistItem.item : null;
    const uri = String(item && item.uri ? item.uri : "");
    if (uri) existingUris[uri] = true;
  });

  const candidates = [];
  const rejected = [];
  const review = [];
  const unresolved = [];
  const alreadyRegistered = [];

  episodes.forEach(function(episode) {
    const classification = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    const uri = String(episode && episode.uri ? episode.uri : "");
    const row = {
      id: String(episode && episode.id ? episode.id : ""),
      name: String(episode && episode.name ? episode.name : ""),
      uri: uri,
      releaseDate: String(episode && episode.release_date ? episode.release_date : ""),
      classification: classification.classification,
      reasons: classification.reasons,
      matchedField: classification.matchedField,
      matchedSection: classification.matchedSection,
      excerpt: classification.excerpt
    };

    if (uri && existingUris[uri]) {
      alreadyRegistered.push(row);
      return;
    }

    if (classification.classification === "confirmed") {
      candidates.push(row);
    } else if (classification.classification === "false_positive") {
      rejected.push(row);
    } else if (classification.classification === "unresolved") {
      unresolved.push(row);
    } else {
      review.push(row);
    }
  });

  Logger.log("=== OTA SAFE AUTO UPDATE DRY RUN ===");
  Logger.log("ルール enabled: " + rule.enabled + "（falseのままが正常）");
  Logger.log("一次ソース数: " + getAutoPlaylistShowIds_(rule).length);
  Logger.log("取得エピソード数: " + episodes.length);
  Logger.log("現在のプレイリスト項目数: " + playlistItems.length);
  Logger.log("既存登録: " + alreadyRegistered.length);
  Logger.log("ADD候補 confirmed: " + candidates.length);
  Logger.log("除外 false_positive: " + rejected.length);
  Logger.log("要確認 review: " + review.length);
  Logger.log("保留 unresolved: " + unresolved.length);
  Logger.log("Spotify書き込み: なし");

  candidates.forEach(function(item) {
    Logger.log("ADD | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : ""));
  });
  rejected.forEach(function(item) {
    Logger.log("REJECT | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(","));
  });
  review.forEach(function(item) {
    Logger.log("REVIEW | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : ""));
  });

  return {
    dryRun: true,
    playlistId: rule.playlistId,
    ruleEnabled: rule.enabled,
    fetchedEpisodeCount: episodes.length,
    playlistItemCount: playlistItems.length,
    alreadyRegisteredCount: alreadyRegistered.length,
    addCandidateCount: candidates.length,
    falsePositiveCount: rejected.length,
    reviewCount: review.length,
    unresolvedCount: unresolved.length,
    candidates: candidates,
    review: review
  };
}
