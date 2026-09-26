// Run from repository root: node --test tests/auto-update-recovery.test.cjs
// Pure in-memory mocks: no GAS, Spotify, network, or production writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = [
  path.resolve(process.cwd(), 'scripts/google-apps-script/AutoUpdateAutomationV1.js'),
  path.resolve(__dirname, 'AutoUpdateAutomationV1.js'),
].find(p => fs.existsSync(p));
assert.ok(sourcePath, 'AutoUpdateAutomationV1.js not found');
const source = fs.readFileSync(sourcePath, 'utf8');

function harness(mode) {
  const ep = { id: 'recovery-test-001', uri: 'spotify:episode:recovery-test-001', release_date: '2026-09-20' };
  const rule = { key: 'recovery-test', playlistId: 'recovery-playlist', bootstrapPending: mode === 'bootstrap' };
  const state = { showId: 'show-1', complete: true, candidateIds: [ep.id], candidateCount: 1, pendingBoundaryId: 'head-1' };
  const playlist = new Set();
  const stats = { addCalls: 0, dateCalls: 0, savedStates: 0, deletedStates: 0, savedBoundaries: 0 };
  let date = '2026-09-01';
  let failDateOnce = true;
  let boundary = 'old-head';
  let savedState = state;
  const mocks = {
    getAutoPlaylistShowIds_: () => ['show-1'],
    loadAutoPlaylistScopedState_: () => savedState,
    getAllSpotifyPlaylistItems_: () => [...playlist].map(uri => ({ item: { uri } })),
    mergeAutoPlaylistCandidateIds_: (a, b) => [...new Set([...a, ...b])],
    fetchPlayableAutoUpdateEpisodesV1_: ids => ids.map(id => ({ ...ep, id, uri: 'spotify:episode:' + id })),
    assertAutoPlaylistSheetLinkBeforeWrite_: () => {},
    addAutoPlaylistEpisodesBatch_: (_rule, _token, episodes) => add(episodes),
    addAutoPlaylistEpisodesIndividually_: (_rule, _token, episodes) => add(episodes),
    getLatestReleaseDate_: episodes => episodes.reduce((max, e) => e.release_date > max ? e.release_date : max, ''),
    updateAutoUpdateBootstrapLatestDateIfNewerV1_: (_id, nextDate) => {
      stats.dateCalls++;
      if (failDateOnce) { failDateOnce = false; throw Error('simulated date write failure'); }
      if (nextDate > date) date = nextDate;
    },
    saveAutoPlaylistScopedState_: next => { stats.savedStates++; savedState = next; },
    deleteAutoPlaylistScopedState_: () => { stats.deletedStates++; savedState = null; },
    saveAutoUpdateBoundaryV1_: (_id, _show, id) => { stats.savedBoundaries++; boundary = id; },
    saveAutoUpdateRuntimeRuleV1_: () => {},
    setAutoUpdateRuleSheetStatusV1_: () => {},
    validateAutoPlaylistRule_: () => ({ valid: true }),
    loadAutoUpdateBoundaryV1_: () => boundary,
    fetchAutoUpdateShowFirstPageV1_: () => ({ items: [{ ...ep, id: 'head-1' }, { ...ep, id: ep.id }, { ...ep, id: 'old-head' }] }),
    matchesAutoPlaylistRule_: e => e.id === ep.id,
    pauseAutoUpdateRuleV1_: (_rule, reason) => { throw Error('unexpected pause: ' + reason); },
  };
  function add(episodes) {
    stats.addCalls++;
    for (const e of episodes) {
      assert.equal(playlist.has(e.uri), false, 'duplicate Spotify add');
      playlist.add(e.uri);
    }
    return { addedCount: episodes.length, failedCount: 0, addedEpisodes: episodes };
  }
  const context = vm.createContext({ ...mocks, console, Set, AUTO_PLAYLIST_MAX_PENDING_CANDIDATE_IDS_: 500 });
  vm.runInContext(source, context, { filename: sourcePath });
  // Top-level GAS declarations overwrite injected mocks; replace only external dependencies.
  for (const [name, implementation] of Object.entries(mocks)) context[name] = implementation;
  return { context, rule, playlist, stats, get date() { return date; }, get state() { return savedState; }, get boundary() { return boundary; } };
}

test('bootstrap: date-write failure retains progress; retry avoids duplicate and repairs date', () => {
  const h = harness('bootstrap');
  assert.throws(() => h.context.syncAutoUpdateSeedBootstrapV1_(h.rule, 'fake-token', 50), /simulated date write failure/);
  assert.equal(h.stats.addCalls, 1);
  assert.equal(h.date, '2026-09-01');
  assert.deepEqual(h.state.candidateIds, ['recovery-test-001']);
  assert.equal(h.stats.deletedStates, 0);
  assert.equal(h.stats.savedBoundaries, 0);
  const result = h.context.syncAutoUpdateSeedBootstrapV1_(h.rule, 'fake-token', 50);
  assert.equal(result.complete, true);
  assert.equal(h.stats.addCalls, 1, 'no second Spotify write');
  assert.equal(h.playlist.size, 1);
  assert.equal(h.date, '2026-09-20');
  assert.equal(h.stats.deletedStates, 1);
  assert.equal(h.boundary, 'head-1');
  assert.equal(h.rule.bootstrapPending, false);
});

test('incremental: date-write failure retains boundary; retry avoids duplicate and repairs date', () => {
  const h = harness('incremental');
  assert.throws(() => h.context.syncOneApprovedAutoUpdateRequestV1_(h.rule, 'fake-token'), /simulated date write failure/);
  assert.equal(h.stats.addCalls, 1);
  assert.equal(h.boundary, 'old-head');
  assert.equal(h.date, '2026-09-01');
  const result = h.context.syncOneApprovedAutoUpdateRequestV1_(h.rule, 'fake-token');
  assert.equal(result.ok, true);
  assert.equal(h.stats.addCalls, 1, 'no second Spotify write');
  assert.equal(h.playlist.size, 1);
  assert.equal(h.date, '2026-09-20');
  assert.equal(h.boundary, 'head-1');
});
