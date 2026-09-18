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

function rebuildPolirebiPlaylistInReleaseOrder() {
  const rule = getAutoPlaylistRuleByKey_("polirebi-rebuild-audit");
  const report = reportAutoPlaylistV2Rule_(rule.key);
  if (report.completeShowCount !== report.showCount) {
    throw new Error("安全停止: ポリレビ全期間検索が未完了です");
  }

  const token = getSpotifyUserAccessToken();
  if (!token) throw new Error("Spotifyユーザー認証トークンを取得できませんでした");

  const episodes = fetchAutoPlaylistV2EpisodeDetails_(report.candidateIds, token);
  const playlistItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const audit = buildPolirebiRebuildAudit_(episodes, playlistItems);
  const isInitialState = playlistItems.length === 6 && audit.missingFromPlaylist.length === 4;
  const isAlreadyCompleteState = playlistItems.length === 10 && audit.missingFromPlaylist.length === 0;
  if (audit.candidateCount !== 10 || (!isInitialState && !isAlreadyCompleteState)) {
    throw new Error(
      "安全停止: 監査時の件数と一致しません candidates=" + audit.candidateCount +
      " playlist=" + playlistItems.length + " missing=" + audit.missingFromPlaylist.length
    );
  }

  const candidateUris = new Set(episodes.map(function(episode) { return String(episode.uri || ""); }));
  const currentUris = playlistItems.map(function(row) {
    const item = row && (row.item || row.track) ? (row.item || row.track) : null;
    return String(item && item.uri ? item.uri : "");
  });
  if (currentUris.some(function(uri) { return !uri || !candidateUris.has(uri); })) {
    throw new Error("安全停止: ポリレビ候補以外の既存項目があります");
  }

  const orderedEpisodes = episodes.slice().sort(function(a, b) {
    const dateOrder = String(a.release_date || "").localeCompare(String(b.release_date || ""));
    return dateOrder || String(a.id || "").localeCompare(String(b.id || ""));
  });
  const orderedUris = orderedEpisodes.map(function(episode) { return String(episode.uri || ""); });
  if (orderedUris.length !== 10 || new Set(orderedUris).size !== 10 || orderedUris.some(function(uri) { return !uri; })) {
    throw new Error("安全停止: 並べ替え対象が一意な10件ではありません");
  }

  const url = "https://api.spotify.com/v1/playlists/" + encodeURIComponent(rule.playlistId) + "/items";
  const response = UrlFetchApp.fetch(url, {
    method: "put",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
    payload: JSON.stringify({ uris: orderedUris })
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    Logger.log(response.getContentText());
    throw new Error("Spotifyプレイリスト再構築に失敗しました。status=" + status);
  }

  const afterItems = getAllSpotifyPlaylistItems_(rule.playlistId, token);
  const afterUris = afterItems.map(function(row) {
    const item = row && (row.item || row.track) ? (row.item || row.track) : null;
    return String(item && item.uri ? item.uri : "");
  });
  if (afterUris.length !== 10 || afterUris.join("\n") !== orderedUris.join("\n")) {
    throw new Error("Spotify更新後の件数または順番が一致しません");
  }

  const result = {
    ok: true,
    playlistId: rule.playlistId,
    itemCount: afterItems.length,
    addedCount: audit.missingFromPlaylist.length,
    order: orderedEpisodes.map(function(episode, index) {
      return { position: index + 1, releaseDate: episode.release_date, name: episode.name, uri: episode.uri };
    })
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
