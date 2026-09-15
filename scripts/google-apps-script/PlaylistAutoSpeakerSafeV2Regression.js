// speaker-safe-v2 回帰確認用。Spotifyへの書き込みは行わない。

function dryRunSpeakerSafeV2(ruleKey) {
  const rule = getAutoPlaylistRuleByKey_(ruleKey);
  if (!rule) throw new Error("自動更新ルールが見つかりません: " + ruleKey);
  if (getAutoPlaylistRuleType_(rule) !== AUTO_PLAYLIST_RULE_TYPE_SPEAKER_) {
    throw new Error("speakerルールではありません: " + ruleKey);
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const existingUris = new Set(playlistItems.map(function(item) {
    return item && item.item && item.item.uri ? String(item.item.uri) : "";
  }).filter(Boolean));

  const counts = { confirmed: 0, false_positive: 0, review: 0, unresolved: 0 };
  const items = episodes.map(function(episode) {
    const result = classifySpeakerSafeV2_(episode, rule);
    if (Object.prototype.hasOwnProperty.call(counts, result.classification)) counts[result.classification]++;
    return {
      id: String(episode && episode.id ? episode.id : ""),
      uri: String(episode && episode.uri ? episode.uri : ""),
      name: String(episode && episode.name ? episode.name : ""),
      releaseDate: String(episode && episode.release_date ? episode.release_date : ""),
      alreadyRegistered: !!(episode && episode.uri && existingUris.has(String(episode.uri))),
      classification: result.classification,
      reasons: result.reasons,
      excerpt: result.excerpt
    };
  });

  const confirmedNew = items.filter(function(item) {
    return item.classification === "confirmed" && item.uri && !item.alreadyRegistered;
  });

  const result = {
    dryRun: true,
    productionWriteAllowed: false,
    ruleKey: rule.key,
    name: rule.name,
    playlistId: rule.playlistId,
    fetchedEpisodeCount: episodes.length,
    playlistItemCount: playlistItems.length,
    counts: counts,
    confirmedNewCount: confirmedNew.length,
    confirmedNew: confirmedNew,
    review: items.filter(function(item) { return item.classification === "review"; }),
    unresolved: items.filter(function(item) { return item.classification === "unresolved"; })
  };

  Logger.log("=== SPEAKER SAFE V2 DRY RUN: " + rule.name + " ===");
  Logger.log("取得エピソード数: " + result.fetchedEpisodeCount);
  Logger.log("既存プレイリスト: " + result.playlistItemCount);
  Logger.log("confirmed: " + counts.confirmed);
  Logger.log("false_positive: " + counts.false_positive);
  Logger.log("review: " + counts.review);
  Logger.log("unresolved: " + counts.unresolved);
  Logger.log("ADD confirmed: " + result.confirmedNewCount);
  return result;
}

function compareOtaLegacyAndSpeakerSafeV2() {
  const rule = getAutoPlaylistRuleByKey_("ota-masahiko");
  if (!rule) throw new Error("太田匡彦ルールが見つかりません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const episodes = fetchAutoPlaylistEpisodes_(rule, token);

  const mismatches = [];
  const counts = { same: 0, different: 0 };
  episodes.forEach(function(episode) {
    const legacy = classifyOtaMasahikoExistingPlaylistAuditEpisodeV2_(episode);
    const v2 = classifySpeakerSafeV2_(episode, rule);
    const legacyClass = legacy && legacy.classification ? legacy.classification : "unresolved";
    const v2Class = v2 && v2.classification ? v2.classification : "unresolved";
    if (legacyClass === v2Class) {
      counts.same++;
    } else {
      counts.different++;
      mismatches.push({
        id: String(episode && episode.id ? episode.id : ""),
        name: String(episode && episode.name ? episode.name : ""),
        legacy: legacyClass,
        speakerSafeV2: v2Class,
        legacyReasons: legacy && legacy.reasons ? legacy.reasons : [],
        v2Reasons: v2 && v2.reasons ? v2.reasons : []
      });
    }
  });

  Logger.log("=== OTA LEGACY vs SPEAKER SAFE V2 ===");
  Logger.log("same: " + counts.same);
  Logger.log("different: " + counts.different);
  mismatches.forEach(function(item) {
    Logger.log(item.legacy + " -> " + item.speakerSafeV2 + " | " + item.name);
  });

  return {
    dryRun: true,
    productionWriteAllowed: false,
    fetchedEpisodeCount: episodes.length,
    counts: counts,
    exactMatch: counts.different === 0,
    mismatches: mismatches
  };
}

function dryRunOtaSpeakerSafeV2() {
  return dryRunSpeakerSafeV2("ota-masahiko");
}

function dryRunToyohideSpeakerSafeV2() {
  return dryRunSpeakerSafeV2("toyohide");
}
