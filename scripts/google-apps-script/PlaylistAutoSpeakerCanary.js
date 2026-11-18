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

function runToyohideSpeakerCanaryV1() {
  const id = SPEAKER_CANARY_EPISODE_ID_V1_;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) throw new Error("実データ確認済みのカナリアIDを指定してください");
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別のAUTO処理が実行中です");
  try {
    const rule = getToyohideSpeakerCanaryRuleV1_();
    if (isSpeakerAutoUpdateHumanBlocked_(rule, id)) throw new Error("人間判定済みです");
    const token = getSpotifyUserAccessToken();
    if (!token) throw new Error("Spotifyユーザートークンがありません");
    const before = getAllSpotifyPlaylistItems_(rule.playlistId, token);
    const existing = before.filter(function(entry) { return entry && entry.item && entry.item.id === id; }).length;
    const episodes = fetchThemeReviewEpisodeDetails_([id], token);
    if (episodes.length !== 1 || episodes[0].id !== id || !matchesAutoPlaylistRule_(episodes[0], rule)) {
      throw new Error("カナリアの出演再判定に失敗しました");
    }
    const episode = episodes[0];
    const text = (String(episode.description || "") + "\n" + String(episode.html_description || ""))
      .replace(/〖/g, "【").replace(/〗/g, "】");
    if (!/【出演・スタッフ】[^【]*豊\s*秀一/.test(text)) {
      throw new Error("カナリアの出演クレジットを確認できません");
    }
    assertAutoPlaylistSheetLinkBeforeWrite_(rule);
    const dateContext = prepareAutoLatestDateReflectionV1_(rule);
    if (PropertiesService.getScriptProperties().getProperty(AUTO_LATEST_DATE_PENDING_PREFIX_V1_ + rule.playlistId)) {
      throw new Error("カナリア対象に未解決の日付反映記録があります");
    }
    const themeGuard = assertThemeReviewSpotifyWriteV1_(rule, [episode]);
    assertAutoLatestDateHumanProofV1_(getToyohideSpeakerCanaryRuleV1_(), id);
    const result = existing ? addAutoPlaylistEpisodesIndividually_(rule, token, [])
      : addAutoPlaylistEpisodesIndividually_(rule, token, [episode]);
    if (result.failedCount) throw new Error("カナリア追加に失敗しました");
    if (result.addedCount) reflectAddedAutoLatestDateV1_(rule, result.addedEpisodes, dateContext, true);
    const after = getAllSpotifyPlaylistItems_(rule.playlistId, token);
    const occurrences = after.filter(function(entry) { return entry && entry.item && entry.item.id === id; }).length;
    if (occurrences !== (existing || 1) || after.length !== before.length + result.addedCount) {
      throw new Error("Spotify反映後の件数確認に失敗しました");
    }
    const report = { ruleKey: rule.key, playlistId: rule.playlistId, episodeId: id, name: episode.name,
      releaseDate: episode.release_date, addedCount: result.addedCount, beforeCount: before.length,
      afterCount: after.length, occurrences: occurrences, verified: true, themeGuard: themeGuard,
      writeTested: result.addedCount === 1,
      dateState: findAutoLatestDateSheetRowV1_(rule.playlistId).latestDate };
    Logger.log(JSON.stringify(report));
    return report;
  } finally { lock.releaseLock(); }
}

function inspectExistingToyohideSpeakerCanaryV1() {
  const rule = getToyohideSpeakerCanaryRuleV1_();
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザートークンがありません");
  const items = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const ids = items.map(function(entry) { return entry && entry.item && entry.item.id; }).filter(Boolean).slice(0, 2);
  const result = { ruleKey: rule.key, existingCount: items.length,
    sample: fetchThemeReviewEpisodeDetails_(ids, token).map(function(episode) {
      return { id: episode.id, name: episode.name, release_date: episode.release_date,
        description: episode.description, matches: matchesAutoPlaylistRule_(episode, rule) };
    }) };
  Logger.log(JSON.stringify(result));
  return result;
}
