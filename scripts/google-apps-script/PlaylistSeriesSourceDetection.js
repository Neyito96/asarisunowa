// 連載プレイリストの既存エピソードから、今後探索する親番組候補を判定する。
// 判定とdry-run確認専用。プレイリスト・スプレッドシートへの書き込みは行わない。

function detectSeriesSourceShows_(playlistItems, options) {
  const settings = options || {};
  const recentLimit = Math.max(1, Number(settings.recentLimit || 12));
  const minimumRecentCount = Math.max(1, Number(settings.minimumRecentCount || 1));

  const episodes = (Array.isArray(playlistItems) ? playlistItems : [])
    .map(function(item, index) {
      const episode = item && item.item ? item.item : item;
      const show = episode && episode.show ? episode.show : null;
      const showId = String(show && show.id ? show.id : "").trim();
      const releaseDate = String(episode && episode.release_date ? episode.release_date : "").trim();

      if (!showId) return null;

      return {
        showId: showId,
        showName: String(show && show.name ? show.name : "").trim(),
        episodeId: String(episode && episode.id ? episode.id : "").trim(),
        episodeName: String(episode && episode.name ? episode.name : "").trim(),
        releaseDate: releaseDate,
        originalIndex: index
      };
    })
    .filter(Boolean)
    .sort(function(a, b) {
      if (a.releaseDate && b.releaseDate && a.releaseDate !== b.releaseDate) {
        return a.releaseDate < b.releaseDate ? 1 : -1;
      }
      return a.originalIndex - b.originalIndex;
    });

  if (!episodes.length) {
    return {
      dryRun: true,
      detected: false,
      reason: "no-show-metadata",
      showIds: [],
      candidates: [],
      inspectedEpisodes: 0
    };
  }

  // 過去の多数決ではなく、最近の配信元を優先する。
  // 番組移行後に古い親番組へ引っ張られないため、直近N件だけで判定する。
  const recentEpisodes = episodes.slice(0, recentLimit);
  const statsByShowId = {};

  recentEpisodes.forEach(function(episode) {
    if (!statsByShowId[episode.showId]) {
      statsByShowId[episode.showId] = {
        showId: episode.showId,
        showName: episode.showName,
        recentCount: 0,
        latestReleaseDate: episode.releaseDate,
        sampleEpisodeNames: []
      };
    }

    const stat = statsByShowId[episode.showId];
    stat.recentCount += 1;
    if (!stat.showName && episode.showName) stat.showName = episode.showName;
    if (!stat.latestReleaseDate || episode.releaseDate > stat.latestReleaseDate) {
      stat.latestReleaseDate = episode.releaseDate;
    }
    if (stat.sampleEpisodeNames.length < 3 && episode.episodeName) {
      stat.sampleEpisodeNames.push(episode.episodeName);
    }
  });

  const candidates = Object.keys(statsByShowId)
    .map(function(showId) {
      return statsByShowId[showId];
    })
    .filter(function(stat) {
      return stat.recentCount >= minimumRecentCount;
    })
    .sort(function(a, b) {
      if (a.latestReleaseDate !== b.latestReleaseDate) {
        return a.latestReleaseDate < b.latestReleaseDate ? 1 : -1;
      }
      return b.recentCount - a.recentCount;
    });

  return {
    dryRun: true,
    detected: candidates.length > 0,
    reason: candidates.length === 0
      ? "no-candidate-meets-threshold"
      : candidates.length > 1
      ? "multiple-recent-source-shows"
      : "recent-source-show",
    showIds: candidates.map(function(candidate) {
      return candidate.showId;
    }),
    candidates: candidates,
    inspectedEpisodes: recentEpisodes.length,
    totalEpisodesWithShowMetadata: episodes.length
  };
}

function extractSpotifyPlaylistId_(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const urlMatch = text.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/i);
  if (urlMatch) return String(urlMatch[1]);

  const uriMatch = text.match(/^spotify:playlist:([A-Za-z0-9]+)$/i);
  if (uriMatch) return String(uriMatch[1]);

  return /^[A-Za-z0-9]+$/.test(text) ? text : "";
}

// 実際のSpotifyプレイリストを「読むだけ」のdry-run。
// 既存のユーザーOAuthと getAllSpotifyPlaylistItems_() を再利用する。
function dryRunSeriesSourceDetectionByPlaylist_(playlistUrlOrId, options) {
  const playlistId = extractSpotifyPlaylistId_(playlistUrlOrId);
  if (!playlistId) {
    throw new Error("SpotifyプレイリストURLまたはIDを確認してください");
  }

  const token = getSpotifyUserAccessToken();
  if (!token) {
    throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  }

  const playlistItems = getAllSpotifyPlaylistItems_(playlistId, token);
  const result = detectSeriesSourceShows_(playlistItems, options);

  result.playlistId = playlistId;
  result.productionWriteAllowed = false;

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// 既知の連載プレイリストでの確認用。どちらも読み取りのみ。
function dryRunIsshoShinbunSourceDetection() {
  return dryRunSeriesSourceDetectionByPlaylist_("4tY0lHoV8IemMBp4iTnKnl");
}

function dryRunKinoDougaSourceDetection() {
  return dryRunSeriesSourceDetectionByPlaylist_("6nDhZQG75F1wU62sdcYJMq");
}

// playlistItems を直接渡す単体確認用。
function logSeriesSourceDetection_(playlistItems, options) {
  const result = detectSeriesSourceShows_(playlistItems, options);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
