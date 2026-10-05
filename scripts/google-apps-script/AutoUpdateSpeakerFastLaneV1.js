// Fast lane for submitted speaker playlists that are still in bootstrap.
// Purpose: do not make newly published confirmed speaker episodes wait behind
// long historical backfills. This does not advance or mutate bootstrap cursors.

const AUTO_UPDATE_SPEAKER_FAST_LANE_MAX_ADDITIONS_ = 3;

function syncBootstrapSpeakerLatestFastLaneV1_() {
  if (typeof classifySpeakerSafeV2_ !== "function") {
    throw new Error("speaker fast lane requires classifySpeakerSafeV2_");
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return rule &&
      rule.enabled !== false &&
      rule.productionWriteAllowed === true &&
      rule.bootstrapPending === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  });

  const recentEpisodeCache = {};
  return rules.map(function(rule) {
    try {
      return syncOneBootstrapSpeakerLatestFastLaneV1_(rule, token, recentEpisodeCache);
    } catch (error) {
      Logger.log("speaker fast lane失敗: " + String(rule && rule.playlistId || "") + " | " + String(error));
      notifyAutoUpdateFailureSafely_({
        target: String(rule && (rule.name || rule.key || rule.playlistId) || "speaker fast lane"),
        stage: "新着優先巡回",
        error: error
      });
      return {
        playlistId: String(rule && rule.playlistId || ""),
        ok: false,
        error: String(error)
      };
    }
  });
}

function syncOneBootstrapSpeakerLatestFastLaneV1_(rule, token, episodeCache) {
  const validation = validateAutoPlaylistRule_(rule);
  if (!validation.valid) {
    throw new Error("ルール検証失敗: " + validation.errors.join(" / "));
  }

  assertAutoPlaylistSheetLinkBeforeWrite_(rule);

  const confirmedById = {};
  const review = [];
  getAutoPlaylistShowIds_(rule).forEach(function(showId) {
    const cacheKey = String(showId);
    const page = episodeCache[cacheKey] || fetchAutoUpdateShowFirstPageV1_(showId, token);
    episodeCache[cacheKey] = page;

    (page.items || []).forEach(function(episode) {
      if (!episode || !episode.id) return;
      const result = classifySpeakerSafeV2_(episode, rule);
      const classification = String(result && result.classification || "unresolved");
      if (classification === "confirmed") {
        confirmedById[String(episode.id)] = episode;
      } else if (classification === "review" || classification === "unresolved") {
        review.push({
          id: String(episode.id),
          name: String(episode.name || ""),
          classification: classification,
          reason: String(result && result.reasons && result.reasons[0] || "")
        });
      }
    });
  });

  const existingUris = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(row) {
    return String(row && row.item && row.item.uri ? row.item.uri : "");
  }).filter(Boolean));

  const missing = Object.keys(confirmedById).map(function(id) {
    return confirmedById[id];
  }).filter(function(episode) {
    return !existingUris.has(String(episode.uri || ("spotify:episode:" + episode.id)));
  }).sort(function(a, b) {
    const left = String(a.release_date || "");
    const right = String(b.release_date || "");
    return left === right
      ? String(a.id).localeCompare(String(b.id))
      : left < right ? -1 : 1;
  });

  if (missing.length > AUTO_UPDATE_SPEAKER_FAST_LANE_MAX_ADDITIONS_) {
    throw new Error("speaker fast lane候補が上限を超えました: " + missing.length);
  }

  const result = missing.length
    ? addAutoPlaylistEpisodesIndividually_(rule, token, missing)
    : { addedCount: 0, failedCount: 0, addedEpisodes: [] };

  if (result.failedCount > 0) {
    throw new Error("speaker fast lane Spotify追加に一部失敗しました");
  }

  if (result.addedCount > 0) {
    updatePlaylistLatestDate_(
      rule.playlistId,
      getLatestReleaseDate_(result.addedEpisodes)
    );
  }

  const report = {
    playlistId: rule.playlistId,
    ok: true,
    bootstrapPending: true,
    confirmedRecentCount: Object.keys(confirmedById).length,
    missingConfirmedCount: missing.length,
    addedCount: Number(result.addedCount || 0),
    reviewCount: review.length,
    review: review.slice(0, 10)
  };
  Logger.log(JSON.stringify({ speakerFastLane: report }));
  return report;
}

function diagnoseBootstrapSpeakerLatestFastLaneV1() {
  const rules = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return rule &&
      rule.enabled !== false &&
      rule.productionWriteAllowed === true &&
      rule.bootstrapPending === true &&
      getAutoPlaylistRuleType_(rule) === AUTO_PLAYLIST_RULE_TYPE_SPEAKER_;
  });
  const report = rules.map(function(rule) {
    return {
      playlistId: String(rule.playlistId || ""),
      name: String(rule.name || ""),
      key: String(rule.key || ""),
      bootstrapPending: rule.bootstrapPending === true,
      aliases: typeof getSpeakerSafeV2Config_ === "function"
        ? getSpeakerSafeV2Config_(rule).aliases
        : []
    };
  });
  Logger.log(JSON.stringify({ dryRun:true, spotifyWrite:false, spreadsheetWrite:false, rules:report }));
  return report;
}
