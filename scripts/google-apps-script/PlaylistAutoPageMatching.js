// Spotifyから取得した1ページ分を、その場でルール判定する純粋関数。
// エピソード本文を状態へ溜め込まず、候補IDだけを返す。
// Spotify API・Properties・プレイリスト・スプレッドシートへのアクセスは行わない。

const AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_ = 500;

function matchAutoPlaylistEpisodePage_(episodes, rule, previousBoundaryId) {
  const source = Array.isArray(episodes) ? episodes : [];
  const boundary = String(previousBoundaryId || "").trim();
  const candidateIds = [];
  let reachedBoundary = false;
  let inspectedCount = 0;

  source.forEach(function(episode) {
    if (reachedBoundary) return;

    const episodeId = String(episode && episode.id ? episode.id : "").trim();
    if (!episodeId) return;

    if (boundary && episodeId === boundary) {
      reachedBoundary = true;
      return;
    }

    inspectedCount += 1;
    if (matchesAutoPlaylistRule_(episode, rule)) {
      candidateIds.push(episodeId);
    }
  });

  return {
    inspectedCount: inspectedCount,
    candidateIds: candidateIds,
    reachedBoundary: reachedBoundary
  };
}

function mergeAutoPlaylistCandidateIds_(existingIds, newIds, maxIds) {
  const limit = Math.max(1, Number(maxIds) || AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_);
  const seen = {};
  const merged = [];

  (Array.isArray(existingIds) ? existingIds : [])
    .concat(Array.isArray(newIds) ? newIds : [])
    .forEach(function(value) {
      const id = String(value || "").trim();
      if (!id || seen[id]) return;
      if (merged.length >= limit) {
        throw new Error(
          "候補IDが安全上限 " + limit + " 件を超えました。reviewして候補を整理してから再開してください。"
        );
      }
      seen[id] = true;
      merged.push(id);
    });

  return merged;
}

function buildAutoPlaylistPageMatchProgress_(state, pageResult) {
  const sourceState = state || {};
  const result = pageResult || {};
  const candidateIds = mergeAutoPlaylistCandidateIds_(
    sourceState.candidateIds || [],
    result.candidateIds || [],
    AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_
  );

  return {
    inspectedCount: Number(sourceState.inspectedCount || 0) + Number(result.inspectedCount || 0),
    candidateIds: candidateIds,
    candidateCount: candidateIds.length,
    reachedBoundary: result.reachedBoundary === true
  };
}
