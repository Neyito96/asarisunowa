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
    Session: { getEffectiveUser: () => ({ getEmail: () => 'operator@example.com' }) },
    ...extra
  });
  for (const f of files) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), context, { filename: f });
  return { context, props, locks };
}

function ledgerValues(rows) {
  const header = Array(39).fill('');
  header[38] = '人間除外';
  Object.entries({ 0: '台帳ID', 1: '番組名', 2: 'タイトル', 3: '配信日時', 6: '外部ID', 11: 'Spotify個別URL', 22: '概要清掃済み', 23: '出演者' })
    .forEach(([i, v]) => header[i] = v);
  return [header, ...rows.map(r => {
    const row = Array(39).fill('');
    if (r.excl !== undefined) row[38] = r.excl;
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
    now: () => Date.parse('2026-11-09T04:00:00Z'), load: k => store.has(k) ? JSON.parse(store.get(k)) : null, save: (k, v) => { log.saves++; store.set(k, JSON.stringify(v)); },
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

test('a removal made while paused is tombstoned after resume (no resurrection)', () => {
  const h = harness({ owner: { generation: 1 }, ledger, members: [ep(3), ep(4)] });
  h.run();                                   // P25 observes ep3, ep4
  const h2 = harness({ owner: { generation: 2 }, ledger, members: [ep(4)] });  // human removed ep3 while PAUSED
  h2.store.set('playlist:' + PL, h.store.get('playlist:' + PL));
  h2.run();
  assert.ok(JSON.parse(h2.store.get('playlist:' + PL)).excluded.includes(ep(3)));
  assert.ok(!h2.log.adds.flat().includes(ep(3)));
});

test('first adoption starts with an empty baseline (legacy-era gaps are not tombstones)', () => {
  const h = harness({ owner: { generation: 1 }, ledger, members: [ep(4)] });
  h.run();
  assert.deepEqual(JSON.parse(h.store.get('playlist:' + PL)).excluded, []);
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
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { since: '2026-11-05', ruleRevision: 'r', exclusionsReviewed: true }), /CONFIRM_REQUIRED/);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05', ruleRevision: 'r' }), /EXCLUSIONS_REVIEW_REQUIRED/);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, ruleRevision: 'r', exclusionsReviewed: true }), /SINCE_REQUIRED/);
  assert.throws(() => context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05', exclusionsReviewed: true }), /RULE_REVISION_REQUIRED/);
  const ok = context.P25_SET_OWNER(PL, 'P25', { confirm: PL, since: '2026-11-05', ruleRevision: 'r', shows: ['番組A'], exclusionsReviewed: true });
  assert.equal(ok.owner, 'P25');
  assert.equal(JSON.parse(props.get('P25_OWNER_' + PL)).autoAdd.since, '2026-11-05');
  assert.equal(JSON.parse(props.get('P25_OWNER_' + PL)).operator, 'operator@example.com');
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

// ---- review follow-up: concurrent writes, emergency stop, manual-deletion carryover ----
const PROD = ['P25Ownership.js', 'P25LibraryPipeline.js', 'P25SpotifyTarget.js', 'P25ProdIo.js'];
const settledOwner = (over = {}) => ({ owner: 'P25', generation: 1, operator: 'operator@example.com', since: '2026-11-01T00:00:00.000Z', ...over });
function prodIo(extra = {}) {
  const fetches = [];
  const loaded = load(PROD, {
    getSpotifyUserAccessToken: () => 'tok',
    isAutoUpdatePlaylistHumanDeletedV1_: () => false,
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, method: o.method }); return { getResponseCode: () => 201, getContentText: () => '{}' }; } },
    ...extra
  });
  loaded.fetches = fetches;
  return loaded;
}

test('every Spotify playlist write outside Phase25 files is behind the ownership gate', () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('P25'));
  for (const f of files) {
    const text = src(f);
    // a function that writes to /playlists/.../items must use the gate or the manual-writer assertion
    const writers = text.split(/\nfunction /).filter(b => /\/items/.test(b) && /method:\s*"(post|put|delete)"/.test(b));
    for (const body of writers) {
      assert.match(body, /p25LegacyGatedFetch_\(|p25AssertLegacyMayWrite_\(/, f + ': ' + body.slice(0, 60));
    }
  }
});

test('emergency stop applied after the owner was read still blocks the POST (nothing is sent)', () => {
  const { context, props, fetches } = prodIo();
  props.set('P25_OWNER_' + PL, JSON.stringify(settledOwner()));
  props.set('P25_PROD_WRITE_ENABLED', '1');
  const io = context.p25ProdIo_({ write: true });
  io.readOwner(PL);
  io.add(PL, [ep(1)]);                       // allowed while the switch is on
  assert.equal(fetches.length, 1);
  context.P25_EMERGENCY_STOP('test');        // stop arrives between read and write
  assert.throws(() => io.add(PL, [ep(2)]), e => e.notSent === true && /P25_WRITE_STOPPED/.test(e.message));
  assert.equal(fetches.length, 1);
});

test('write switch is read fresh inside the gate; absent or other values mean OFF', () => {
  const { context, props, fetches } = prodIo();
  props.set('P25_OWNER_' + PL, JSON.stringify(settledOwner()));
  const io = context.p25ProdIo_({ write: true });
  io.readOwner(PL);
  assert.throws(() => io.add(PL, [ep(1)]), /P25_WRITE_STOPPED/);
  props.set('P25_PROD_WRITE_ENABLED', 'true');
  assert.throws(() => io.add(PL, [ep(1)]), /P25_WRITE_STOPPED/);
  assert.equal(fetches.length, 0);
});

test('emergency stop clears the write switch, stops runs, and release keeps writes OFF', () => {
  const { context, props } = prodIo();
  props.set('P25_PROD_WRITE_ENABLED', '1');
  props.set('P25_OWNER_' + PL, JSON.stringify({ owner: 'P25', generation: 1 }));
  const r = context.P25_EMERGENCY_STOP('x');
  assert.equal(r.stopped, true);
  assert.equal(r.inFlightWriteConfirmedFinished, true);
  assert.equal(props.has('P25_PROD_WRITE_ENABLED'), false);
  assert.equal(context.p25RunProductionSafe_().status, 'EMERGENCY_STOP');
  assert.equal(context.p25ProdIo_({ write: true }).canWrite(PL), false);
  assert.throws(() => context.P25_EMERGENCY_STOP_RELEASE({}), /CONFIRM_REQUIRED/);
  const rel = context.P25_EMERGENCY_STOP_RELEASE({ confirm: 'RELEASE' });
  assert.equal(rel.writeEnabled, false);
  // owner untouched: legacy stays blocked while stopped
  assert.equal(context.p25LegacyBlocked_(PL), true);
});

test('emergency stop reports an in-flight write instead of claiming it finished', () => {
  const { context, locks } = prodIo();
  locks.user = true;                         // a write holds the gate lock
  context.P25_GATE_WAIT_MS_ = 0;
  const r = context.P25_EMERGENCY_STOP('x');
  assert.equal(r.stopped, true);
  assert.equal(r.inFlightWriteConfirmedFinished, false);
});

test('Theme V3 legacy writer is gated for P25-owned playlists', () => {
  const t = src('ThemeV3SingleSheet.js');
  const body = t.slice(t.indexOf('function addThemeV3EpisodesIndividually_'), t.indexOf('function applyThemeV3SpotifyPlan_'));
  assert.match(body, /p25AssertLegacyMayWrite_\(rule\.playlistId\)/);
  assert.match(body, /p25LegacyGatedFetch_\(rule\.playlistId/);
});

test('imported legacy manual deletions are never auto-added and cannot be re-approved', () => {
  const ledgerRows = ledgerValues([{ n: 3, date: '2026/11/6 4:00' }, { n: 4, date: '2026/11/8 4:00' }, { n: 1, date: '2026/10/01 4:00' }]);
  const requestRow = Array(9).fill(''); requestRow[1] = rule.url; requestRow[5] = 'ABC'; requestRow[7] = '増分自動更新'; requestRow[8] = '方式: series / x';
  const { context, props } = prodIo({
    SPREADSHEET_ID: 'req', AUTO_UPDATE_REQUEST_SHEET_NAME: 'req',
    getSheetLoose: () => ({ getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => [requestRow] }) }),
    extractAutoUpdateSpotifyPlaylistId_: u => (String(u).match(/playlist\/([A-Za-z0-9]{22})/) || [])[1] || '',
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === '削除・除外履歴'
      ? ({ getLastRow: () => 1, getLastColumn: () => 2, getRange: () => ({ getDisplayValues: () => [['GUID', 'EP-ID']] }) })
      : ({ getLastRow: () => ledgerRows.length, getRange: () => ({ getDisplayValues: () => ledgerRows }) }) }) }
  });
  assert.throws(() => context.P25_IMPORT_EXCLUSIONS(PL, ['EP-00003'], {}), /CONFIRM_REQUIRED/);
  const r = context.P25_IMPORT_EXCLUSIONS(PL, ['EP-00003', 'https://open.spotify.com/episode/' + ep(1), 'EP-99999'], { confirm: PL });
  assert.deepEqual(Array.from(r.excludedEpisodes).sort(), ['EP-00001', 'EP-00003']);
  assert.equal(r.unknown.length, 1);
  const a = context.P25_APPROVE_EPISODES(PL, ['EP-00001', 'EP-00003', 'EP-00004'], { confirm: PL });
  assert.ok(!a.approved.includes('EP-00003') && !a.approved.includes('EP-00001'));
  assert.ok(a.approved.includes('EP-00004'));
  // the pipeline also ignores them even with policy on
  const state = context.p25ProdStateLoad_('playlist:' + PL);
  const index = context.p25Index_(ledgerRows);
  const plan = context.p25Plan_(index, context.p25Request_(rule), { ...state, autoAdd: { since: '2026-11-05', revision: context.p25Request_(rule).revision, shows: ['番組A'] } }, []);
  assert.ok(!plan.additions.some(x => x.epId === 'EP-00003'));
});

// ---- second review: other execution users, stop mid-run, date boundary ----
test('P25 writes are pinned to the user recorded at the switch (User locks do not span users)', () => {
  const { context, props, fetches } = prodIo({ Session: { getEffectiveUser: () => ({ getEmail: () => 'someone-else@example.com' }) } });
  props.set('P25_OWNER_' + PL, JSON.stringify(settledOwner()));
  props.set('P25_PROD_WRITE_ENABLED', '1');
  const io = context.p25ProdIo_({ write: true });
  io.readOwner(PL);
  assert.throws(() => io.add(PL, [ep(1)]), e => e.notSent === true && /P25_OPERATOR_MISMATCH/.test(e.message));
  assert.equal(fetches.length, 0);
});

test('first P25 write waits out the settle window after an owner switch', () => {
  const { context, props, fetches } = prodIo();
  props.set('P25_PROD_WRITE_ENABLED', '1');
  props.set('P25_OWNER_' + PL, JSON.stringify(settledOwner({ since: new Date().toISOString() })));
  const io = context.p25ProdIo_({ write: true });
  io.readOwner(PL);
  assert.throws(() => io.add(PL, [ep(1)]), e => e.notSent === true && /P25_SETTLING/.test(e.message));
  assert.equal(fetches.length, 0);
});

test('switching to P25 needs a known execution user and no active emergency stop', () => {
  const noUser = prodIo({ Session: { getEffectiveUser: () => ({ getEmail: () => '' }) } });
  const args = { confirm: PL, since: '2026-11-05', ruleRevision: 'r', exclusionsReviewed: true };
  assert.throws(() => noUser.context.P25_SET_OWNER(PL, 'P25', args), /OPERATOR_IDENTITY_UNAVAILABLE/);
  const stopped = prodIo();
  stopped.props.set('P25_EMERGENCY_STOP', '{}');
  assert.throws(() => stopped.context.P25_SET_OWNER(PL, 'P25', args), /EMERGENCY_STOP_ACTIVE/);
  assert.equal(stopped.props.has('P25_OWNER_' + PL), false);
});

test('emergency stop in the middle of a multi-playlist run stops every later write', () => {
  const h = harness({ owner: {}, ledger });
  let stop = false, adds = 0;
  const realAdd = h.io.add;
  h.io.add = (id, ids) => { if (stop) throw Object.assign(new Error('P25_WRITE_STOPPED'), { notSent: true }); adds++; stop = true; realAdd(id, ids); };
  h.run();                                     // first batch goes out, then stop is raised
  h.io.readLedger = () => ledgerValues([...ledger, { n: 9, date: '2026/11/9 4:00' }]);   // a new arrival appears
  h.run();                                     // next run: add refuses, nothing is sent
  assert.equal(adds, 1);
  assert.equal(JSON.parse(h.store.get('playlist:' + PL)).reason, 'WRITE_STOPPED');
});

test('date boundary: zoned timestamps use the Japan day; far-future dates fail closed', () => {
  const { context } = load(['P25LibraryPipeline.js']);
  assert.equal(context.p25Day_('2026-11-05T21:00:00Z'), '2026-11-06');   // 06:00 JST next day
  assert.equal(context.p25Day_('2026-11-05T21:00:00+00:00'), '2026-11-06');
  assert.equal(context.p25Day_('2026-11-06T04:00:00+09:00'), '2026-11-06');
  assert.equal(context.p25Day_('2026/11/6 4:00'), '2026-11-06');
  assert.equal(context.p25Day_('2026年11月6日'), '2026-11-06');
  const h = harness({ owner: {}, ledger: [{ n: 3, date: '2062/11/6 4:00' }, { n: 4, date: '2026/11/9 4:00' }] });
  h.run();
  assert.deepEqual(h.log.adds.flat(), [ep(4)]);                          // today (JST) is fine, 2062 is not
  const skipped = JSON.parse(h.store.get('playlist:' + PL)).plan.skipped;
  assert.ok(skipped.some(x => x.epId === 'EP-00003' && x.reason === 'DATE_FUTURE'));
});

test('episode published on the approval day itself is not auto-added', () => {
  const h = harness({ owner: {}, ledger: [{ n: 3, date: '2026-11-05T14:30:00Z' }] });   // 23:30 JST on 11/05 = since day
  h.run();
  assert.equal(h.log.adds.length, 0);
});

// ---- Phase25 completion: ledger exclusions (AM column / 削除・除外履歴), search, mapping check, new playlist ----
test('ledger 人間除外 (AM column) always wins over approval and auto-add', () => {
  const rows = [{ n: 3, date: '2026/11/6 4:00', excl: '除外' }, { n: 4, date: '2026/11/8 4:00', excl: '未指定' }, { n: 6, date: '2026/11/8 4:00', excl: '' }];
  const h = harness({ owner: {}, ledger: rows });
  h.run();
  assert.deepEqual(h.log.adds.flat(), [ep(4), ep(6)]);
  // an old approval of the excluded episode does not bring it back
  const h2 = harness({ owner: {}, ledger: [{ n: 3, date: '2026/11/6 4:00', excl: 'true' }] });
  const idx = h2.context.p25Index_(ledgerValues([{ n: 3, date: '2026/11/6 4:00', excl: 'true' }]));
  h2.store.set('playlist:' + PL, JSON.stringify({ approvals: { 'EP-00003': { revision: h2.rev, evidence: idx.rows[0].evidence } }, excluded: [], observed: [], pending: [] }));
  h2.run();
  assert.equal(h2.log.adds.length, 0);
});

test('削除・除外履歴 rows (GUID or EP-ID) exclude episodes; a missing column fails closed', () => {
  const h = harness({ owner: {}, ledger: [{ n: 3, date: '2026/11/6 4:00' }, { n: 4, date: '2026/11/8 4:00' }, { n: 6, date: '2026/11/8 4:00' }] });
  h.io.readExclusions = () => [['GUID', 'EP-ID'], ['G3', ''], ['', 'EP-00004']];   // ledger guid is 'g<n>' (case-insensitive)
  h.run();
  assert.deepEqual(h.log.adds.flat(), [ep(6)]);
  const bad = harness({ owner: {}, ledger });
  bad.io.readExclusions = () => [['GUID', 'EP-ID']];
  bad.io.readLedger = () => ledgerValues(ledger).map(r => r.slice(0, 24));   // AM column missing
  assert.throws(() => bad.run(), /LEDGER_SCHEMA_MISMATCH/);
  assert.equal(bad.log.adds.length, 0);
});

test('ledger search reports each match with its status and never touches Spotify', () => {
  const { context } = load(['P25LibraryPipeline.js']);
  const values = ledgerValues([{ n: 1, date: '2026/11/6 4:00' }, { n: 2, date: '2026/11/6 4:00', excl: '除外' }, { n: 3, date: '2026/11/6 4:00', title: '別番組 #3' }]);
  values[3][11] = '';   // EP-00003 has no Spotify URL
  const r = JSON.parse(JSON.stringify(context.p25Search_(context.p25Index_(values, { requireExclusionColumn: true }), { type: 'series', keywords: 'ABC' })));
  assert.deepEqual(r.episodes.map(e => e.epId), ['EP-00001']);
  assert.equal(r.episodes[0].status, 'READY');
  assert.deepEqual(r.humanExcluded, ['EP-00002']);
  assert.throws(() => context.p25Search_(context.p25Index_(values), { type: 'x', keywords: 'a' }), /INVALID_SEARCH/);
});

function ioWithSheets(ledgerRows) {
  return {
    SPREADSHEET_ID: 's', AUTO_UPDATE_REQUEST_SHEET_NAME: 'r',
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === '削除・除外履歴'
      ? ({ getLastRow: () => 1, getLastColumn: () => 2, getRange: () => ({ getDisplayValues: () => [['GUID', 'EP-ID']] }) })
      : ({ getLastRow: () => ledgerRows.length, getRange: () => ({ getDisplayValues: () => ledgerRows }) }) }) }
  };
}

test('P25_VERIFY_EPISODE_IDS flags missing / unplayable Spotify IDs (read-only GET)', () => {
  const rows = ledgerValues([{ n: 1, date: '2026/11/6 4:00' }, { n: 2, date: '2026/11/6 4:00' }, { n: 3, date: '2026/11/6 4:00' }]);
  const calls = [];
  const { context } = prodIo({
    ...ioWithSheets(rows),
    UrlFetchApp: { fetch: (url, o) => { calls.push({ url, method: o.method });
      const ids = new URL(url).searchParams.get('ids').split(',');
      const episodes = ids.map(id => id === ep(2) ? null : { id, is_playable: id !== ep(3) });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ episodes }) }; } }
  });
  const r = JSON.parse(JSON.stringify(context.P25_VERIFY_EPISODE_IDS(['EP-00001', 'EP-00002', 'EP-00003', 'EP-99999'])));
  assert.deepEqual(r, { ok: ['EP-00001'], missing: ['EP-00002'], unplayable: ['EP-00003'], notVerifiable: ['EP-99999'] });
  assert.ok(calls.every(c => c.method === 'get'));
});

test('P25_CREATE_PLAYLIST needs typed confirmation, the write switch and no emergency stop; creates an empty private playlist only', () => {
  const sent = [];
  const mk = () => prodIo({ UrlFetchApp: { fetch: (url, o) => { sent.push({ url, body: JSON.parse(o.payload) });
    return { getResponseCode: () => 201, getContentText: () => JSON.stringify({ id: 'N'.repeat(22) }) }; } } });
  const a = mk();
  assert.throws(() => a.context.P25_CREATE_PLAYLIST({ name: '新着' }, {}), /CONFIRM_REQUIRED/);
  assert.throws(() => a.context.P25_CREATE_PLAYLIST({ name: '新着' }, { confirm: 'CREATE:新着' }), /WRITE_DISABLED/);
  a.props.set('P25_PROD_WRITE_ENABLED', '1');
  a.props.set('P25_EMERGENCY_STOP', '{}');
  assert.throws(() => a.context.P25_CREATE_PLAYLIST({ name: '新着' }, { confirm: 'CREATE:新着' }), /WRITE_DISABLED/);
  assert.equal(sent.length, 0);
  a.props.delete('P25_EMERGENCY_STOP');
  const r = a.context.P25_CREATE_PLAYLIST({ name: '新着', description: 'd' }, { confirm: 'CREATE:新着' });
  assert.equal(r.url, 'https://open.spotify.com/playlist/' + 'N'.repeat(22));
  assert.equal(sent.length, 1);
  assert.ok(sent[0].url.endsWith('/v1/me/playlists'));
  assert.equal(sent[0].body.public, false);
  assert.equal(sent[0].body.uris, undefined);          // no episodes added
  assert.equal(a.props.has('P25_OWNER_' + 'N'.repeat(22)), false);   // no owner change
});
