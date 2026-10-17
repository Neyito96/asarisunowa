// One speaker only. Preview is read-only; execution is capped at one verified ID.
const SPEAKER_CANARY_EPISODE_ID_V1_ = "";

function getToyohideSpeakerCanaryRuleV1_() {
  const fixed = getAutoPlaylistRuleByKey_("toyohide");
  if (!fixed || fixed.playlistId !== "4Ri6rxTGFimTm0KkZtKfBZ" ||
      fixed.enabled !== true || getAutoPlaylistRuleType_(fixed) !== "speaker") {
    throw new Error("カナリアspeakerルールが不正です");
  }
  const runtime = loadAutoUpdateRuntimeRulesV1_().filter(function(rule) {
    return rule.playlistId === fixed.playlistId;
  });
  const decisions = Object.assign({}, fixed.manualEpisodeDecisions || {});
  runtime.forEach(function(rule) {
    if (rule.enabled !== true || rule.productionWriteAllowed === false || rule.bootstrapPending === true) {
      throw new Error("カナリア対象に停止中・初回補完中の保存ルールがあります");
    }
    Object.keys(rule.manualEpisodeDecisions || {}).forEach(function(id) {
      if (decisions[id] !== "除外") decisions[id] = rule.manualEpisodeDecisions[id];
    });
  });
  const approved = readApprovedSpeakerHumanDecisions_(fixed.playlistId);
  Object.keys(approved).forEach(function(id) {
    if (decisions[id] !== "除外") decisions[id] = approved[id];
  });
  return Object.assign({}, fixed, { manualEpisodeDecisions: decisions });
}

function previewToyohideSpeakerCanaryV1() {
  const rule = getToyohideSpeakerCanaryRuleV1_();
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザートークンがありません");
  const existing = new Set(getAllSpotifyPlaylistItems_(rule.playlistId, token).map(function(entry) {
    return String(entry && entry.item && entry.item.id || "");
  }));
  const episodes = fetchAutoPlaylistEpisodes_(rule, token);
  const result = { ruleKey: rule.key, playlistId: rule.playlistId, existingCount: existing.size,
    candidates: episodes.filter(function(episode) {
      return episode && episode.id && !existing.has(episode.id) && matchesAutoPlaylistRule_(episode, rule) &&
        !isSpeakerAutoUpdateHumanBlocked_(rule, episode.id);
    }).map(function(episode) {
      return { id: episode.id, name: episode.name, release_date: episode.release_date,
        description: episode.description, html_description: episode.html_description };
    }) };
  Logger.log(JSON.stringify(result));
  return result;
}
