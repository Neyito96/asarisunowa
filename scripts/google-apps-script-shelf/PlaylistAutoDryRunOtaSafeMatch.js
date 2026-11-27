// 太田匡彦プレイリスト：安全な新規候補判定 dry-run
// 既存V2監査で実績のある分類器を流用し、confirmed の未登録回だけを追加候補にする。
// dry-run は Spotify・スプレッドシートへの書き込みを行わない。

function buildOtaMasahikoSafeAutoUpdatePlan_() {
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

  return {
    rule: rule,
    token: token,
    episodes: episodes,
    playlistItems: playlistItems,
    alreadyRegistered: alreadyRegistered,
    candidates: candidates,
    rejected: rejected,
    review: review,
    unresolved: unresolved
  };
}

function dryRunOtaMasahikoSafeAutoUpdate() {
  const plan = buildOtaMasahikoSafeAutoUpdatePlan_();
  const rule = plan.rule;

  Logger.log("=== OTA SAFE AUTO UPDATE DRY RUN ===");
  Logger.log("ルール enabled: " + rule.enabled + "（falseのままが正常）");
  Logger.log("一次ソース数: " + getAutoPlaylistShowIds_(rule).length);
  Logger.log("取得エピソード数: " + plan.episodes.length);
  Logger.log("現在のプレイリスト項目数: " + plan.playlistItems.length);
  Logger.log("既存登録: " + plan.alreadyRegistered.length);
  Logger.log("ADD候補 confirmed: " + plan.candidates.length);
  Logger.log("除外 false_positive: " + plan.rejected.length);
  Logger.log("要確認 review: " + plan.review.length);
  Logger.log("保留 unresolved: " + plan.unresolved.length);
  Logger.log("Spotify書き込み: なし");

  plan.candidates.forEach(function(item) {
    Logger.log("ADD | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : ""));
  });
  plan.rejected.forEach(function(item) {
    Logger.log("REJECT | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(","));
  });
  plan.review.forEach(function(item) {
    Logger.log("REVIEW | " + item.releaseDate + " | " + item.name + " | " + item.uri +
      " | reasons=" + item.reasons.join(",") +
      (item.excerpt ? " | excerpt=" + item.excerpt : ""));
  });

  return {
    dryRun: true,
    playlistId: rule.playlistId,
    ruleEnabled: rule.enabled,
    fetchedEpisodeCount: plan.episodes.length,
    playlistItemCount: plan.playlistItems.length,
    alreadyRegisteredCount: plan.alreadyRegistered.length,
    addCandidateCount: plan.candidates.length,
    falsePositiveCount: plan.rejected.length,
    reviewCount: plan.review.length,
    unresolvedCount: plan.unresolved.length,
    candidates: plan.candidates,
    review: plan.review
  };
}

function addOtaMasahikoConfirmedCandidates() {
  const plan = buildOtaMasahikoSafeAutoUpdatePlan_();

  // 今回確認済みの状態からずれたら、Spotifyへ書き込む前に必ず停止する。
  if (plan.rule.enabled !== false) {
    throw new Error("安全停止: ota-masahiko が enabled:false ではありません");
  }
  if (plan.playlistItems.length !== 32) {
    throw new Error("安全停止: 現在のプレイリスト件数が想定32件と一致しません: " + plan.playlistItems.length);
  }
  if (plan.candidates.length !== 2) {
    throw new Error("安全停止: confirmed の未登録候補が想定2件と一致しません: " + plan.candidates.length);
  }

  const candidateUris = plan.candidates.map(function(item) { return String(item.uri); });
  const uniqueUris = {};
  candidateUris.forEach(function(uri) {
    if (!uri) throw new Error("安全停止: ADD候補にURIなしがあります");
    if (uniqueUris[uri]) throw new Error("安全停止: ADD候補URIが重複しています: " + uri);
    uniqueUris[uri] = true;
  });

  Logger.log("=== OTA SAFE AUTO UPDATE WRITE ===");
  Logger.log("追加対象: confirmed 2件のみ");
  plan.candidates.forEach(function(item) {
    Logger.log("ADD | " + item.releaseDate + " | " + item.name + " | " + item.uri);
  });

  addAutoPlaylistEpisodesBatch_(plan.rule, plan.token, plan.candidates);

  const afterItems = getAllSpotifyPlaylistItems_(plan.rule.playlistId, plan.token);
  Logger.log("追加前: " + plan.playlistItems.length);
  Logger.log("追加成功: " + plan.candidates.length);
  Logger.log("追加後: " + afterItems.length);

  if (afterItems.length !== 34) {
    throw new Error("追加APIは成功しましたが、追加後件数が想定34件と一致しません: " + afterItems.length);
  }

  Logger.log("=== OTA SAFE AUTO UPDATE COMPLETE ===");
  Logger.log("confirmed 2件を追加し、34件になりました。");

  return {
    ok: true,
    added: plan.candidates.length,
    remaining: afterItems.length
  };
}
