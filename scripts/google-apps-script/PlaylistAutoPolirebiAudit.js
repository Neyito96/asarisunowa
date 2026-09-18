// ポリレビ完全再構築前の読み取り専用監査。
// Spotify playlistへの追加・削除・並べ替えは行わない。

function extractPolirebiEpisodeNumber_(title) {
  const normalized = String(title || "").normalize("NFKC");
  if (normalized.indexOf("ポリレビ") < 0) return null;
  const match = normalized.match(/ポリレビ\s*[#＃]?\s*(\d{1,3})/i);
  return match ? Number(match[1]) : null;
}

function buildPolirebiRebuildAudit_(candidateEpisodes, playlistItems) {
  const candidates = (Array.isArray(candidateEpisodes) ? candidateEpisodes : []).map(function(episode) {
    return {
      id: String(episode && episode.id ? episode.id : ""),
      uri: String(episode && episode.uri ? episode.uri : ""),
      name: String(episode && episode.name ? episode.name : ""),
      releaseDate: String(episode && episode.release_date ? episode.release_date : ""),
      number: extractPolirebiEpisodeNumber_(episode && episode.name)
    };
  }).filter(function(episode) { return episode.id; });

  const playlistUris = new Set((Array.isArray(playlistItems) ? playlistItems : []).map(function(row) {
    const item = row && (row.item || row.track) ? (row.item || row.track) : null;
    return item && item.uri ? String(item.uri) : "";
  }).filter(Boolean));

  const numbered = candidates.filter(function(episode) { return episode.number !== null; })
    .sort(function(a, b) {
      if (a.number !== b.number) return a.number - b.number;
      return a.releaseDate.localeCompare(b.releaseDate);
    });
  const specials = candidates.filter(function(episode) { return episode.number === null; })
    .sort(function(a, b) { return a.releaseDate.localeCompare(b.releaseDate); });
  const numbers = numbered.map(function(episode) { return episode.number; });
  const maxNumber = numbers.length ? Math.max.apply(null, numbers) : 0;
  const missingNumbers = [];
  for (let number = 1; number <= maxNumber; number += 1) {
    if (numbers.indexOf(number) < 0) missingNumbers.push(number);
  }

  function withPlaylistStatus(episode) {
    return Object.assign({}, episode, { inPlaylist: playlistUris.has(episode.uri) });
  }

  return {
    dryRun: true,
    candidateCount: candidates.length,
    numberedCount: numbered.length,
    specialCount: specials.length,
    maxNumber: maxNumber,
    missingNumbers: missingNumbers,
    numberedEpisodes: numbered.map(withPlaylistStatus),
    specialEpisodes: specials.map(withPlaylistStatus),
    missingFromPlaylist: candidates.filter(function(episode) {
      return !playlistUris.has(episode.uri);
    }).map(withPlaylistStatus),
    productionWriteAllowed: false
  };
}

function reportPolirebiRebuildCandidates() {
  const rule = getAutoPlaylistRuleByKey_("polirebi-rebuild-audit");
  const report = reportAutoPlaylistV2Rule_(rule.key);
  if (report.completeShowCount !== report.showCount) {
    throw new Error("ポリレビ全期間検索が未完了です: " + report.completeShowCount + "/" + report.showCount);
  }
  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");
  const episodes = fetchAutoPlaylistV2EpisodeDetails_(report.candidateIds, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const audit = buildPolirebiRebuildAudit_(episodes, playlistItems);
  Logger.log(JSON.stringify(audit, null, 2));
  return audit;
}
