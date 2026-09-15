// 初回構築（bootstrap）の実行計画を作る純粋関数。
// Spotify APIは呼ばず、実際のプレイリスト変更もしない。

function buildAutoPlaylistBootstrapPlan_(rule) {
  const source = rule || {};
  const validation = validateAutoPlaylistRule_(source);
  const showIds = getAutoPlaylistShowIds_(source);

  return {
    dryRun: true,
    mode: AUTO_PLAYLIST_LIFECYCLE_.BOOTSTRAP,
    ruleKey: String(source.key || "").trim(),
    ruleType: getAutoPlaylistRuleType_(source),
    showIds: showIds,
    pagesPerRun: 1,
    resumable: true,
    checkpointScope: "per-show",
    stopOnRateLimit: true,
    productionWriteAllowed: false,
    valid: validation.valid,
    validation: validation
  };
}

function buildAutoPlaylistIncrementalPlan_(rule, boundaries) {
  const source = rule || {};
  const validation = validateAutoPlaylistRule_(source);
  const showIds = getAutoPlaylistShowIds_(source);
  const knownBoundaries = boundaries || {};
  const missingBoundaries = showIds.filter(function(showId) {
    return !String(knownBoundaries[showId] || "").trim();
  });

  return {
    dryRun: true,
    mode: AUTO_PLAYLIST_LIFECYCLE_.INCREMENTAL,
    ruleKey: String(source.key || "").trim(),
    ruleType: getAutoPlaylistRuleType_(source),
    showIds: showIds,
    pagesPerRun: 1,
    checkpointScope: "per-show",
    stopAtPreviousBoundary: true,
    missingBoundaries: missingBoundaries,
    productionWriteAllowed: false,
    readyForIncrementalFetch: validation.valid && missingBoundaries.length === 0,
    validation: validation
  };
}
