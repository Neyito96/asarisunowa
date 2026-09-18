function syncAllAutoPlaylists() {
  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const episodeCache = {};

  getEnabledAutoPlaylistRules_().forEach(function(rule) {
    syncOneAutoPlaylist_(rule, token, episodeCache);
  });
}

function syncAutoPlaylistByKey_(key) {
  const rule = getAutoPlaylistRuleByKey_(key);

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + String(key || ""));
  }

  return syncConfiguredAutoPlaylist_(rule);
}

function syncAutoPlaylistByPlaylistId_(playlistId) {
  const wantedId = String(playlistId || "").trim();
  const rule = AUTO_PLAYLIST_RULES.find(function(item) {
    return String(item && item.playlistId ? item.playlistId : "") === wantedId;
  });

  if (!rule) {
    throw new Error("自動更新ルールが見つかりません: " + wantedId);
  }

  return syncConfiguredAutoPlaylist_(rule);
}

function syncConfiguredAutoPlaylist_(rule) {
  if (rule && rule.enabled === false) {
    throw new Error("自動更新を停止中です: " + String(rule.name || rule.key || "unknown"));
  }

  const token = getSpotifyUserAccessToken();

  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  return syncOneAutoPlaylist_(rule, token);
}

function getLatestReleaseDate_(episodes) {
  return (episodes || [])
    .map(function(ep) {
      return String(ep && ep.release_date ? ep.release_date : "").trim();
    })
    .filter(Boolean)
    .sort()
    .pop() || "";
}

function syncOneAutoPlaylist_(rule, token, episodeCache) {
  Logger.log("=== " + rule.name + " ===");

  const episodes = episodeCache
    ? fetchAutoPlaylistEpisodesCached_(rule, token, episodeCache)
    : fetchAutoPlaylistEpisodes_(rule, token);

  const playlistItems =
    getAllSpotifyPlaylistItems_(rule.playlistId, token);

  const existingUris = new Set(
    playlistItems
      .map(function(item) {
        return item && item.item && item.item.uri
          ? String(item.item.uri)
          : "";
      })
      .filter(Boolean)
  );

  const candidates = episodes.filter(function(ep) {
    return matchesAutoPlaylistRule_(ep, rule);
  });

  const newEpisodes = candidates.filter(function(ep) {
    const uri = String(ep && ep.uri ? ep.uri : "");
    return uri && !existingUris.has(uri);
  }).sort(function(a, b) {
    const leftDate = String(a && a.release_date ? a.release_date : "");
    const rightDate = String(b && b.release_date ? b.release_date : "");
    if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
    const leftNumber = extractNoMiraiEpisodeNumber_(a && a.name);
    const rightNumber = extractNoMiraiEpisodeNumber_(b && b.name);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return String(a && a.id ? a.id : "").localeCompare(String(b && b.id ? b.id : ""));
  });

  Logger.log("判定通過件数: " + candidates.length);
  Logger.log("新規追加対象: " + newEpisodes.length);

  if (!newEpisodes.length) {
    Logger.log(
      candidates.length
        ? "判定通過候補はすべて登録済みです ✅"
        : "追加対象なし ✅"
    );
    return { addedCount: 0, failedCount: 0, candidateCount: candidates.length };
  }

  if (rule.requireSheetLinkBeforeWrite === true) {
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
  }

  if (rule.addIndividually === true) {
    const result =
      addAutoPlaylistEpisodesIndividually_(rule, token, newEpisodes);

    if (
      result.addedCount > 0 &&
      rule.updateLatestDateOnAdd === true
    ) {
      updatePlaylistLatestDate_(
        rule.playlistId,
        getLatestReleaseDate_(result.addedEpisodes)
      );
    }

    return {
      addedCount: result.addedCount,
      failedCount: result.failedCount,
      candidateCount: candidates.length
    };
  }

  addAutoPlaylistEpisodesBatch_(rule, token, newEpisodes);

  if (rule.updateLatestDateOnAdd === true) {
    updatePlaylistLatestDate_(
      rule.playlistId,
      getLatestReleaseDate_(newEpisodes)
    );
  }
  return { addedCount: newEpisodes.length, failedCount: 0, candidateCount: candidates.length };
}

// 初回登録済みのノーミライを、新着差分だけ手動確認・再実行する公開関数。
function syncNoMiraiIncremental() {
  return syncAutoPlaylistByKey_("no-mirai");
}
