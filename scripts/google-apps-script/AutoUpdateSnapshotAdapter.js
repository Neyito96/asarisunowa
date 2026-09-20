/**
 * Offline adapter for previously exported, non-secret snapshots.
 * No Apps Script globals, network calls, logging, or persistent writes.
 * A caller must explicitly supply the production-selected batchIds: the
 * production bootstrap uses candidateIds.slice(-additionLimit), and may
 * combine multiple scoped states before selecting the batch.
 */
function buildAutoUpdateDiagnosisSnapshotV1(input) {
  if (!input || !Array.isArray(input.states) || !Array.isArray(input.playlistItems) ||
      !Array.isArray(input.batchIds) || !input.spotifyResponse) {
    throw new Error('states, playlistItems, batchIds and spotifyResponse required');
  }
  if (input.states.some(function(s) { return !s || !Array.isArray(s.candidateIds); })) {
    throw new Error('each scoped state must contain candidateIds');
  }
  const unique = function(a) { return Array.from(new Set(a.map(function(v) { return String(v || '').trim(); }).filter(Boolean))); };
  const candidateIds = unique(input.states.reduce(function(a, s) { return a.concat(s.candidateIds); }, []));
  const existingIds = unique(input.playlistItems.map(function(item) {
    const episode = item && (item.item || item.track || item);
    const id = episode && episode.id;
    const uri = episode && episode.uri;
    return id || (typeof uri === 'string' && /^spotify:episode:[A-Za-z0-9]+$/.test(uri) ? uri.split(':')[2] : '');
  }));
  const response = input.spotifyResponse;
  const status = Number(response.httpStatus);
  if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error('valid response httpStatus required');
  if (status === 200 && !Array.isArray(response.episodes)) throw new Error('200 response requires episodes array');
  const results = status === 200 ? response.episodes.filter(Boolean).map(function(ep) {
    return { id: ep.id, found: true, isPlayable: ep.is_playable };
  }) : [];
  return {
    candidateIds: candidateIds, existingIds: existingIds,
    batchIds: unique(input.batchIds), limit: 50,
    httpStatus: status, results: results
  };
}
if (typeof module !== 'undefined') module.exports = { buildAutoUpdateDiagnosisSnapshotV1 };
