function diagnoseManabibaReadOnly() {
  const playlistId = "7aKDEfAdCjTxiqiv19Grar";
  const episodeId = "4UBOKsmshxwNIGqjSyPdtB";

  const rules = loadAutoUpdateRuntimeRulesV1_();
  const rule = rules.find(function(r) {
    return r && r.playlistId === playlistId;
  });

  if (!rule) {
    Logger.log(JSON.stringify({
      error: "保存済みルールが見つかりません"
    }));
    return;
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証トークン取得失敗");

  const items = getAllSpotifyPlaylistItems_(playlistId, token);
  const episode = fetchAutoUpdateEpisodeDetailV1_(episodeId, token);

  const boundaries = getAutoPlaylistShowIds_(rule).map(function(showId) {
    const boundary = loadAutoUpdateBoundaryV1_(playlistId, showId);
    const recent = fetchAutoUpdateShowFirstPageV1_(showId, token).items || [];

    return {
      showId: showId,
      boundaryPresent: Boolean(boundary),
      boundaryInLatest20: recent.some(function(ep) {
        return ep && ep.id === boundary;
      }),
      targetInLatest20: recent.some(function(ep) {
        return ep && ep.id === episodeId;
      })
    };
  });

  Logger.log(JSON.stringify({
    playlistId: playlistId,
    playlistItemCount: items.length,
    targetAlreadyAdded: items.some(function(row) {
      const item = row && (row.item || row.track);
      return item && item.id === episodeId;
    }),
    ruleEnabled: rule.enabled,
    bootstrapPending: rule.bootstrapPending,
    seriesTitleCode: rule.seriesTitleCode,
    targetFetched: Boolean(episode),
    targetTitle: episode ? episode.name : null,
    targetReleaseDate: episode ? episode.release_date : null,
    targetMatchesRule: episode
      ? matchesAutoPlaylistRule_(episode, rule)
      : null,
    boundaries: boundaries
  }, null, 2));
}