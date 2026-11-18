function diagnoseRakuyuraReadOnly() {
  const playlistId = "1u1qT0BxRZT1OeNM0LDA72";
  const rule = loadAutoUpdateRuntimeRulesV1_().find(function(r) {
    return r && r.playlistId === playlistId;
  });

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証トークンを取得できません");

  const items = getAllSpotifyPlaylistItems_(playlistId, token);
  const episodes = items.map(function(row) {
    return row && (row.item || row.track);
  }).filter(function(ep) {
    return ep && ep.id;
  });

  const dated = episodes.filter(function(ep) {
    return /^\d{4}-\d{2}-\d{2}$/.test(ep.release_date || "");
  }).sort(function(a, b) {
    return b.release_date.localeCompare(a.release_date);
  });

  const showStates = rule
    ? getAutoPlaylistShowIds_(rule).map(function(showId) {
        const state = loadAutoPlaylistScopedState_(rule.key, showId);
        return {
          showId: showId,
          progressPresent: Boolean(state),
          complete: state ? state.complete : null,
          pagesFetched: state ? state.pagesFetched : null,
          candidateCount: state ? state.candidateCount : null
        };
      })
    : [];

  Logger.log(JSON.stringify({
    playlistId: playlistId,
    playlistItemCount: items.length,
    validEpisodeCount: episodes.length,
    datedEpisodeCount: dated.length,
    latestKnownEpisodes: dated.slice(0, 3).map(function(ep) {
      return {
        id: ep.id,
        date: ep.release_date,
        title: ep.name
      };
    }),
    ruleExists: Boolean(rule),
    ruleEnabled: rule ? rule.enabled : null,
    bootstrapPending: rule ? rule.bootstrapPending : null,
    showStates: showStates
  }, null, 2));
}
function diagnoseRakuyuraMissingCandidatesReadOnly() {
  const playlistId = "1u1qT0BxRZT1OeNM0LDA72";
  const rule = loadAutoUpdateRuntimeRulesV1_().find(function(r) {
    return r && r.playlistId === playlistId;
  });
  if (!rule) throw new Error("楽屋裏のルールがありません");

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証失敗");

  const items = getAllSpotifyPlaylistItems_(playlistId, token);
  const existingIds = new Set(items.map(function(row) {
    const ep = row && (row.item || row.track);
    return String(ep && ep.id || "");
  }).filter(Boolean));

  const states = getAutoPlaylistShowIds_(rule).map(function(showId) {
    return loadAutoPlaylistScopedState_(rule.key, showId);
  });
  if (states.some(function(s) { return !s || !s.complete; })) {
    throw new Error("補完候補の探索が完了していません");
  }

  const allIds = Array.from(new Set(
    states.reduce(function(a, s) {
      return a.concat(s.candidateIds || []);
    }, []).map(String)
  ));
  const missingIds = allIds.filter(function(id) {
    return !existingIds.has(id);
  });

  // 本番コードと同様に、古い候補側から最大50件だけ照合する。
  const batch = missingIds.slice(-50);
  const url = "https://api.spotify.com/v1/episodes?market=JP&ids=" +
    encodeURIComponent(batch.join(","));

  const response = batch.length ? UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  }) : null;

  const status = response ? response.getResponseCode() : null;
  const data = status === 200
    ? JSON.parse(response.getContentText())
    : {};
  const returned = Array.isArray(data.episodes) ? data.episodes : [];
  const playableIds = new Set(returned.filter(function(ep) {
    return ep && ep.id && ep.is_playable !== false;
  }).map(function(ep) { return ep.id; }));

  const unavailable = batch.filter(function(id) {
    return !playableIds.has(id);
  });

  Logger.log(JSON.stringify({
    playlistItemCount: items.length,
    savedCandidateCount: allIds.length,
    candidatesNotInPlaylist: missingIds.length,
    checkedThisRun: batch.length,
    episodeApiStatus: status,
    playableCount: playableIds.size,
    unavailableIds: unavailable,
    unavailableDetails: unavailable.map(function(id) {
      const ep = returned.find(function(x) {
        return x && x.id === id;
      });
      return {
        id: id,
        returnedByApi: Boolean(ep),
        isPlayable: ep ? ep.is_playable : null,
        title: ep ? ep.name : null
      };
    })
  }, null, 2));
}
function testRakuyuraSingleEpisodeReadOnly() {
  const episodeId = "7Gf4Y2FjoWDQuulIc2PLTy";
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotify認証トークン取得失敗");

  const response = UrlFetchApp.fetch(
    "https://api.spotify.com/v1/episodes/" +
      encodeURIComponent(episodeId) + "?market=JP",
    {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json"
      }
    }
  );

  const status = response.getResponseCode();
  let data = {};
  try {
    data = JSON.parse(response.getContentText());
  } catch (e) {}

  Logger.log(JSON.stringify({
    episodeId: episodeId,
    httpStatus: status,
    retrieved: status === 200 && data.id === episodeId,
    title: status === 200 ? data.name : null,
    releaseDate: status === 200 ? data.release_date : null,
    playable: status === 200 ? data.is_playable : null,
    errorMessage: status !== 200 && data.error
      ? String(data.error.message || "")
      : null
  }, null, 2));
}