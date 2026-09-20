/**
 * Read-only, offline episode reconciliation core for serialized and thematic playlists.
 * Inputs must be snapshots supplied by a separate, reviewed read-only adapter.
 * No Spotify, Sheets, GAS Properties, logging, or write calls are made here.
 * A missing episode in a response is UNKNOWN, not proof of deletion or unplayability.
 */
function diagnoseAutoUpdateEpisodeSnapshotV1(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.candidateIds) ||
      !Array.isArray(snapshot.existingIds) || !Array.isArray(snapshot.results)) {
    throw new Error('candidateIds, existingIds and results arrays are required');
  }
  const clean = function(value) { return String(value == null ? '' : value).trim(); };
  const unique = function(values) { return Array.from(new Set(values.map(clean).filter(Boolean))); };
  const candidates = unique(snapshot.candidateIds);
  const existing = new Set(unique(snapshot.existingIds));
  const pending = candidates.filter(function(id) { return !existing.has(id); });
  const limit = snapshot.limit == null ? 50 : Number(snapshot.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('limit must be 1..50');
  // The caller supplies the exact batch chosen by the production algorithm.
  // Never infer chronological order from candidateIds alone.
  if (!Array.isArray(snapshot.batchIds)) throw new Error('explicit batchIds required');
  const batch = unique(snapshot.batchIds);
  if (batch.length > limit || batch.some(function(id) { return pending.indexOf(id) < 0; })) {
    throw new Error('batchIds must be a subset of pending and within limit');
  }
  const status = Number(snapshot.httpStatus);
  if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error('valid httpStatus required');
  const byId = new Map();
  snapshot.results.forEach(function(result) {
    const id = clean(result && result.id);
    if (!id || batch.indexOf(id) < 0 || byId.has(id)) return;
    byId.set(id, result);
  });
  const entries = batch.map(function(id) {
    if (status !== 200) return { id: id, outcome: 'api_error', httpStatus: status };
    const result = byId.get(id);
    if (!result || result.found === false) return { id: id, outcome: 'unresolved' };
    if (result.isPlayable === false) return { id: id, outcome: 'unplayable' };
    if (result.isPlayable === true) return { id: id, outcome: 'playable' };
    return { id: id, outcome: 'unresolved' };
  });
  return {
    dryRun: true, productionWriteAllowed: false,
    candidateCount: candidates.length, existingCandidateCount: candidates.length - pending.length,
    pendingCount: pending.length, inspectedBatchCount: batch.length,
    playableIds: entries.filter(function(e) { return e.outcome === 'playable'; }).map(function(e) { return e.id; }),
    unresolvedIds: entries.filter(function(e) { return e.outcome === 'unresolved'; }).map(function(e) { return e.id; }),
    unplayableIds: entries.filter(function(e) { return e.outcome === 'unplayable'; }).map(function(e) { return e.id; }),
    apiErrorIds: entries.filter(function(e) { return e.outcome === 'api_error'; }).map(function(e) { return e.id; }),
    httpStatus: status,
    safeToResume: status === 200 && entries.every(function(e) { return e.outcome === 'playable'; })
  };
}
if (typeof module !== 'undefined') module.exports = { diagnoseAutoUpdateEpisodeSnapshotV1 };
