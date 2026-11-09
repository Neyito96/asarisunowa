import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const dir = 'scripts/google-apps-script/';
const PL = 'P'.repeat(22);
const ep = n => String(n).padStart(22, '0');

function load(files, extra = {}) {
  const props = new Map();
  const locks = { script: false, user: false };
  const mkLock = name => ({
    tryLock: () => { if (locks[name]) return false; locks[name] = true; return true; },
    releaseLock: () => { locks[name] = false; }
  });
  let serial = 0;
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props.has(k) ? props.get(k) : null,
      setProperty: (k, v) => props.set(k, String(v)),
      deleteProperty: k => props.delete(k),
      getProperties: () => Object.fromEntries(props)
    }) },
    LockService: { getScriptLock: () => mkLock('script'), getUserLock: () => mkLock('user') },
    Utilities: { getUuid: () => 'v' + (++serial) },
    ...extra
  });
  for (const f of files) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), context, { filename: f });
  return { context, props, locks };
}

function ledgerValues(rows) {
  const header = Array(24).fill('');
  Object.entries({ 0: '台帳ID', 1: '番組名', 2: 'タイトル', 3: '配信日時', 6: '外部ID', 11: 'Spotify個別URL', 22: '概要清掃済み', 23: '出演者' })
    .forEach(([i, v]) => header[i] = v);
  return [header, ...rows.map(r => {
    const row = Array(24).fill('');
    row[0] = 'EP-' + String(r.n).padStart(5, '0'); row[1] = r.show || '番組A'; row[2] = r.title || 'ABC #' + r.n;
    row[3] = r.date; row[6] = 'g' + r.n; row[11] = 'https://open.spotify.com/episode/' + ep(r.n);
    return row;
  })];
}

const rule = { url: 'https://open.spotify.com/playlist/' + PL, updateType: 'series', keywords: 'ABC' };

function harness({ owner, ledger, members = [], stopped = false, approvals = {}, write = true }) {
  const { context } = load(['P25LibraryPipeline.js']);
  const store = new Map(); const log = { adds: [], saves: 0 };
  const rev = context.p25Request_(rule).revision;
  const record = owner === null ? null : { owner: 'P25', generation: 1, autoAdd: { since: '2026-11-05', revision: rev, shows: ['番組A'] }, ...owner };
  let current = [...members];
  const io = {
    now: () => 1000, load: k => store.has(k) ? JSON.parse(store.get(k)) : null, save: (k, v) => { log.saves++; store.set(k, JSON.stringify(v)); },
    withLock: fn => fn(), readLedger: () => ledgerValues(ledger), readRequests: () => [rule], readSources: () => ({ complete: false }),
    readOwner: () => record, isStopped: () => stopped, canWrite: () => true,
    readMembership: () => [...current],
    add: (id, ids) => { log.adds.push(ids); current.push(...ids); },
    readPublished: () => ({ visible: false, verified: false })
  };
  if (Object.keys(approvals).length) {
    store.set('playlist:' + PL, JSON.stringify({ receipt: 'ACCEPTED', spotify: 'PENDING', publication: 'PENDING', approvals: Object.fromEntries(Object.entries(approvals).map(([k, v]) => [k, v === 'valid' ? 'VALID' : v])), excluded: [], observed: [], pending: [] }));
  }
  return { context, io, log, store, rev, run: () => context.p25Run_(io, { write }) };
}

const ledger = [
  { n: 1, date: '2026/10/01 4:00' },            // old
  { n: 2, date: '2026/11/05 4:00' },            // same day as `since`
  { n: 3, date: '2026/11/6 4:00' },             // new
  { n: 4, date: '2026/11/8 4:00' },             // new
  { n: 5, date: '2026/11/7 4:00', show: '番組B' } // other show, new
];

test('auto-add adds only new episodes of the approved show, oldest first', () => {
  const h = harness({ owner: {}, ledger });
  const r = h.run();
  assert.equal(r.results[0].spotify, 'VERIFIED');
  assert.deepEqual(h.log.adds.flat(), [ep(3), ep(4)]);
});

test('same-day, older and other-show episodes are skipped without blocking', () => {
  const h = harness({ owner: {}, ledger });
  h.run();
  const state = JSON.parse(h.store.get('playlist:' + PL));
  const reasons = Object.fromEntries(state.plan.skipped.map(s => [s.epId, s.reason]));
  assert.equal(reasons['EP-00001'], 'NOT_NEW');
  assert.equal(reasons['EP-00002'], 'NOT_NEW');
  assert.equal(state.spotify, 'VERIFIED');
});

test('without a rule-level policy nothing is added automatically (REVIEW_REQUIRED)', () => {
  const h = harness({ owner: { autoAdd: null }, ledger });
  const r = h.run();
  assert.equal(h.log.adds.length, 0);
  assert.equal(r.results[0].spotify, 'HOLD');
});

test('policy bound to another rule revision is ignored', () => {
  const h = harness({ owner: { autoAdd: { since: '2026-11-05', revision: 'old', shows: ['番組A'] } }, ledger });
  h.run();
  assert.equal(h.log.adds.length, 0);
});

test('unparseable ledger date fails closed', () => {
  const h = harness({ owner: {}, ledger: [{ n: 3, date: 'つい最近' }] });
  h.run();
  assert.equal(h.log.adds.length, 0);
});

test('manually deleted episode is never added back', () => {
  const h = harness({ owner: {}, ledger, members: [ep(3)] });
  h.run();                       // baseline: observes ep3, adds ep4
  const sawIds = h.log.adds.flat();
  assert.deepEqual(sawIds, [ep(4)]);
  // human removes ep3 from Spotify
  h.io.readMembership = () => [ep(4)];
  h.log.adds.length = 0;
  h.run();
  assert.equal(h.log.adds.length, 0);
  assert.ok(JSON.parse(h.store.get('playlist:' + PL)).excluded.includes(ep(3)));
});

test('non-P25 owner and stopped playlists never write', () => {
  for (const owner of ['LEGACY', 'PAUSED']) {
    const h = harness({ owner: { owner }, ledger });
    const r = h.run();
    assert.equal(r.results[0].skipped, 'NOT_P25_OWNED');
    assert.equal(h.log.adds.length, 0);
  }
  const h = harness({ owner: {}, ledger, stopped: true });
  h.run();
  assert.equal(h.log.adds.length, 0);
});

test('a new ownership generation does not turn earlier changes into tombstones', () => {
  const h = harness({ owner: { generation: 1 }, ledger, members: [ep(3), ep(4)] });
  h.run();
  const h2 = harness({ owner: { generation: 2 }, ledger, members: [ep(4)] });
  h2.store.set('playlist:' + PL, h.store.get('playlist:' + PL));
  h2.run();
  assert.ok(!JSON.parse(h2.store.get('playlist:' + PL)).excluded.includes(ep(3)));
});

test('approved past episode is added even though it is not new', () => {
  const h = harness({ owner: {}, ledger: [{ n: 1, date: '2026/10/01 4:00' }] });
  const index = h.context.p25Index_(ledgerValues([{ n: 1, date: '2026/10/01 4:00' }]));
  h.store.set('playlist:' + PL, JSON.stringify({ approvals: { 'EP-00001': { revision: h.rev, evidence: index.rows[0].evidence } }, excluded: [], observed: [], pending: [] }));
  h.run();
  assert.deepEqual(h.log.adds.flat(), [ep(1)]);
});

test('gate refusal before sending clears pending (no false WRITE_OUTCOME_UNKNOWN)', () => {
  const h = harness({ owner: {}, ledger });
  h.io.add = () => { throw Object.assign(new Error('P25_OWNER_CHANGED'), { notSent: true }); };
  const r = h.run();
  const state = JSON.parse(h.store.get('playlist:' + PL));
  assert.equal(r.results[0].reason, 'OWNER_CHANGED');
  assert.deepEqual(state.pending, []);
});

test('uncertain POST still holds and is not resent', () => {
  const h = harness({ owner: {}, ledger });
  h.io.add = () => { throw new Error('timeout'); };
  h.run();
  let adds = 0; h.io.add = () => { adds++; };
  const r = h.run();
  assert.equal(adds, 0);
  assert.equal(r.results[0].reason, 'WRITE_OUTCOME_UNKNOWN');
});

// ---- ownership gate / legacy double-write protection ----
test('legacy gated fetch sends only for LEGACY owner and throws notSent otherwise', () => {
  const { context, props } = load(['P25Ownership.js']);
  let sent = 0;
  assert.equal(context.p25LegacyGatedFetch_(PL, () => { sent++; return 'ok'; }), 'ok');
  props.set('P25_OWNER_' + PL, JSON.stringify({ owner: 'P25', generation: 1 }));
  assert.throws(() => context.p25LegacyGatedFetch_(PL, () => { sent++; }), e => e.notSent === true && /P25_OWNED/.test(e.message));
  props.set('P25_OWNER_' + PL, '{broken');
  assert.throws(() => context.p25LegacyGatedFetch_(PL, () => { sent++; }), /P25_OWNED/);
  assert.equal(sent, 1);
});

test('owner switch cannot happen while a gated write is in flight', () => {
  const { context, props } = load(['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js']);
  let result;
  context.p25LegacyGatedFetch_(PL, () => {
    // a switch attempted from inside the write must be refused by the lock
    context.P25_GATE_WAIT_MS_ = 0;
    assert.throws(() => context.P25_SET_OWNER(PL, 'PAUSED', { confirm: PL }), /RUN_IN_PROGRESS|P25_GATE_BUSY/);
    result = 'done';
  });
  assert.equal(result, 'done');
  assert.equal(props.has('P25_OWNER_' + PL), false);
});

test('P25_SET_OWNER requires confirmation, since, revision and allowed transitions', () => {
  const { context, props } = load(['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js']);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { since: '2026-11-05', ruleRevision: 'r' }), /CONFIRM_REQUIRED/);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, ruleRevision: 'r' }), /SINCE_REQUIRED/);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05' }), /RULE_REVISION_REQUIRED/);
  const ok = context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05', ruleRevision: 'r', shows: ['番組A'] });
  assert.equal(ok.owner, 'P25');
  assert.equal(JSON.parse(props.get('P25_OWNER_' + PL)).autoAdd.since, '2026-11-05');
  assert.throws(() => context.P25_SET_OWNER(PL, 'LEGACY', { confirm: PL }), /TRANSITION_NOT_ALLOWED/);
  context.P25_SET_OWNER(PL, 'PAUSED', { confirm: PL });
  assert.throws(() => context.P25_SET_OWNER(PL, 'LEGACY', { confirm: PL }), /BOUNDARY_REFRESH_REQUIRED/);
  assert.equal(context.P25_SET_OWNER(PL, 'LEGACY', { confirm: PL, acknowledgeLegacyBoundaryRefresh: true }).owner, 'LEGACY');
  assert.equal(JSON.parse(props.get('P25_OWNER_' + PL)).generation, 3);
});

test('manual stop pauses a P25-owned playlist; LEGACY playlists are untouched', () => {
  const { context, props } = load(['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js']);
  assert.deepEqual(JSON.parse(JSON.stringify(context.p25OwnerPause_(PL, 'x'))), { paused: false, owner: 'LEGACY' });
  props.set('P25_OWNER_' + PL, JSON.stringify({ owner: 'P25', generation: 4 }));
  assert.equal(context.p25OwnerPause_(PL, 'x').paused, true);
  assert.equal(JSON.parse(props.get('P25_OWNER_' + PL)).owner, 'PAUSED');
});

test('production state round-trips in chunks and keeps a committed version', () => {
  const { context, props } = load(['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js']);
  const state = { observed: Array.from({ length: 900 }, (_, i) => ep(i)), plan: { candidates: [1, 2], additions: [], holds: [], existing: [], skipped: [] } };
  context.p25ProdStateSave_('playlist:' + PL, state);
  context.p25ProdStateSave_('playlist:' + PL, state);
  const back = JSON.parse(JSON.stringify(context.p25ProdStateLoad_('playlist:' + PL)));
  assert.equal(back.observed.length, 900);
  assert.equal(back.plan.candidateCount, 2);
  for (const v of props.values()) assert.ok(v.length <= 9000);
});

test('p25RunProductionSafe_ is a no-op without P25-owned playlists and never throws', () => {
  const { context } = load(['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js']);
  assert.equal(context.p25RunProductionSafe_().skipped, 'NO_P25_PLAYLISTS');
});

// ---- source-level wiring of the legacy writers ----
const src = f => fs.readFileSync(dir + f, 'utf8');
test('every legacy Spotify /items POST goes through the ownership gate', () => {
  const s = src('PlaylistAutoWrite.js');
  const posts = s.match(/method:\s*"post"/g) || [];
  const gated = s.match(/p25LegacyGatedFetch_\(/g) || [];
  assert.ok(posts.length >= 2);
  assert.equal(gated.length, posts.length);
});

test('legacy entrypoints skip P25-owned playlists and daily/hourly triggers run P25', () => {
  assert.match(src('PlaylistAuto.js'), /p25LegacyBlocked_\(rule\.playlistId\)/);
  assert.match(src('PlaylistAutoPolirebiAudit.js'), /p25AssertLegacyMayWrite_/);
  assert.match(src('PlaylistAutoOtaRebuild.js'), /p25AssertLegacyMayWrite_/);
  const v1 = src('AutoUpdateAutomationV1.js');
  assert.equal((v1.match(/p25RunProductionSafe_\(\)/g) || []).length, 2);
  assert.match(v1, /p25OwnerPause_\(id/);
  assert.match(v1, /p25OwnerOf_\(playlistId\)/);
});
