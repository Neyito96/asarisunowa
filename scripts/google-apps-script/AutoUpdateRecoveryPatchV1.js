// 楽屋裏・まなび場天声人語の初回補完を安全に復旧して1回進める。
function repairAndSyncAsahiRequestedSeriesV1() {
  const targetIds = new Set([
    "1u1qT0BxRZT1OeNM0LDA72",
    "7aKDEfAdCjTxiqiv19Grar"
  ]);
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return targetIds.has(String(rule && rule.playlistId ? rule.playlistId : ""));
  });
  const repaired = [];

  rules.forEach(function(savedRule) {
    const rule = Object.assign({}, savedRule || {});
    rule.showIds = [AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_];

    if (rule.bootstrapPending === true) {
      const seedDate = String(rule.bootstrapSeedDate || rule.seedDateOverride || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) {
        throw new Error("初回補完の起点日を復旧できません: " + rule.playlistId);
      }

      getAutoPlaylistShowIds_(rule).forEach(function(showId) {
        if (loadAutoPlaylistScopedState_(rule.key, showId)) return;
        const state = createAutoPlaylistScopedShowState_(rule, showId, "seed-bootstrap", "");
        state.bootstrapSeedDate = seedDate;
        saveAutoPlaylistScopedState_(state);
        repaired.push({ playlistId: rule.playlistId, showId: showId });
      });
    }

    saveAutoUpdateRuntimeRuleV1_(rule);
  });

  const sync = syncAsahiRequestedSeriesV1();
  const result = { repaired: repaired, sync: sync };
  Logger.log(JSON.stringify(result));
  return result;
}
// 楽屋裏・まなび場天声人語の初回補完を安全に復旧して1回進める。
function repairAndSyncAsahiRequestedSeriesV1() {
  const targetIds = new Set([
    "1u1qT0BxRZT1OeNM0LDA72",
    "7aKDEfAdCjTxiqiv19Grar"
  ]);
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return targetIds.has(String(rule && rule.playlistId ? rule.playlistId : ""));
  });
  const repaired = [];

  rules.forEach(function(savedRule) {
    const rule = Object.assign({}, savedRule || {});
    rule.showIds = [AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_];

    if (rule.bootstrapPending === true) {
      const seedDate = String(rule.bootstrapSeedDate || rule.seedDateOverride || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(seedDate)) {
        throw new Error("初回補完の起点日を復旧できません: " + rule.playlistId);
      }

      getAutoPlaylistShowIds_(rule).forEach(function(showId) {
        if (loadAutoPlaylistScopedState_(rule.key, showId)) return;
        const state = createAutoPlaylistScopedShowState_(rule, showId, "seed-bootstrap", "");
        state.bootstrapSeedDate = seedDate;
        saveAutoPlaylistScopedState_(state);
        repaired.push({ playlistId: rule.playlistId, showId: showId });
      });
    }

    saveAutoUpdateRuntimeRuleV1_(rule);
  });

  const sync = syncAsahiRequestedSeriesV1();
  const result = { repaired: repaired, sync: sync };
  Logger.log(JSON.stringify(result));
  return result;
}


// まなび場天声人語の欠番 #42-60 を、重複確認後に1件だけ補完する。
function addMissingTensei4260V1() {
  const playlistId = "7aKDEfAdCjTxiqiv19Grar";
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  let url = buildAutoPlaylistV2InitialUrl_(AUTO_UPDATE_V1_MEDIA_TALK_SHOW_ID_);
  let pages = 0;
  const matches = [];

  while (url && pages < 50) {
    const response = fetchSpotifyReadWithRetry_(
      url,
      {
        muteHttpExceptions: true,
        headers: { Authorization: "Bearer " + token, Accept: "application/json" }
      },
      "Find #42-60"
    );
    const status = response.getResponseCode();
    if (status !== 200) throw new Error("MEDIA TALK取得に失敗しました: status=" + status);
    const data = JSON.parse(response.getContentText());
    (Array.isArray(data.items) ? data.items : []).forEach(function(ep) {
      const name = String(ep && ep.name ? ep.name : "").normalize("NFKC");
      if (/#42-60(?!\d)/.test(name)) matches.push(ep);
    });
    url = String(data.next || "");
    pages += 1;
  }

  if (matches.length !== 1) {
    throw new Error("#42-60 の一致件数が1件ではありません: " + matches.length);
  }

  const episode = matches[0];
  const existingUris = new Set(getAllSpotifyPlaylistItems_(playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));
  if (existingUris.has(String(episode.uri))) {
    return { ok: true, alreadyPresent: true, episodeId: episode.id, name: episode.name };
  }

  const rule = loadAutoUpdateRuntimeRulesV1_().filter(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === playlistId;
  })[0];
  if (!rule) throw new Error("まなび場天声人語の実行ルールが見つかりません");

  const result = addAutoPlaylistEpisodesIndividually_(rule, token, [episode]);
  if (result.addedCount !== 1 || result.failedCount !== 0) {
    throw new Error("#42-60 の追加に失敗しました");
  }

  setAutoUpdateRuleSheetStatusV1_(rule, "増分自動更新", "欠番 #42-60 を1件補完しました");
  return { ok: true, addedCount: 1, episodeId: episode.id, name: episode.name };
}
