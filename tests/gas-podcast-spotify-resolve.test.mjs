import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const dir = 'scripts/google-apps-script/';
const ID19 = '7dDe6pPYCdUUDQ2AL40xtE';
const idOf = n => String(n).padStart(22, 'a');
const show = (id, name, publisher = '') => ({ id, name, publisher });

// deps.fetch is scripted: each call consumes the next reply; replies can be functions of the URL.
function world(replies = [], extra = {}) {
  const calls = [], sleeps = [];
  let n = 0;
  const deps = {
    token: () => extra.token === undefined ? 'TOKEN' : extra.token,
    fetch: (url, token) => {
      calls.push(url);
      assert.equal(token, 'TOKEN');
      const r = replies[Math.min(n++, replies.length - 1)];
      const reply = typeof r === 'function' ? r(url) : r;
      if (reply instanceof Error) throw reply;
      return { status: reply.status ?? 200, body: JSON.stringify(reply.body ?? {}), headers: reply.headers || {} };
    },
    sleep: ms => sleeps.push(ms)
  };
  const ctx = vm.createContext({ console: { log() {} }, ...extra.globals });
  vm.runInContext(fs.readFileSync(dir + 'PodcastSpotifyResolve.js', 'utf8'), ctx);
  return { ctx, deps, calls, sleeps };
}
const search = items => ({ body: { shows: { items } } });
const plain = o => JSON.parse(JSON.stringify(o));
const find = (w, title, maker = '', opts) => plain(w.ctx.podSpFindShow_(title, maker, w.deps, opts));

test('full-width title on Spotify matches a plain sheet title', () => {
  const w = world([search([show(ID19, 'ＰＯＤ　Ｃｈａ‐ｋａｉ！')])]);
  assert.equal(find(w, 'pod cha-kai').status, 'MATCH');
});
test('NFKC normalization equalizes width, case and punctuation', () => {
  const { ctx } = world();
  const n = v => ctx.podSpNormalize_(v);
  assert.equal(n('ＰＯＤ　Ｃｈａ‐ｋａｉ！'), n('pod cha-kai'));
  assert.equal(n('ポッドキャスト茶会'), n('ﾎﾟｯﾄﾞｷｬｽﾄ茶会'));                      // half-width katakana
  assert.equal(n('ポッドキャスト・茶会'), n('ポッドキャスト 茶会'));
  assert.notEqual(n('ポッドキャスト茶会'), n('ポッドキャスト茶話会'));              // different words stay different
  assert.equal(n('コーヒー'), 'コーヒー');                                         // the long-vowel mark is kept
});

test('exact (normalized) single match -> MATCH with a /show/ URL', () => {
  const w = world([search([show(idOf(1), 'ほかの番組'), show(ID19, 'ポッドキャスト茶会', 'someone')])]);
  const r = find(w, 'ポッドキャスト茶会');
  assert.equal(r.status, 'MATCH'); assert.equal(r.url, 'https://open.spotify.com/show/' + ID19); assert.equal(r.calls, 1);
  assert.match(w.calls[0], /type=show&market=JP&limit=10&offset=0/);
});

test('search variants: a spaced sheet title is retried without spaces and then matches exactly', () => {
  const w = world([search([]), search([show(ID19, 'ポッドキャスト茶会')])]);
  const r = find(w, 'ポッドキャスト 茶会');
  assert.equal(r.status, 'MATCH'); assert.equal(r.calls, 2);
  assert.match(decodeURIComponent(w.calls[1]), /q=ポッドキャスト茶会&/);
});
test('variants list: original, NFKC, without brackets, first/last segment, without spaces', () => {
  const { ctx } = world();
  const v = plain(ctx.podSpTitleVariants_('【公式】ポッドキャスト茶会 | 雑談部'));
  assert.ok(v.includes('【公式】ポッドキャスト茶会 | 雑談部'));
  assert.ok(v.some(x => x.includes('ポッドキャスト茶会') && !x.includes('公式') && x.includes('雑談部')));
  assert.ok(v.includes('ポッドキャスト茶会'));
  assert.ok(v.length <= 5);
});

test('similar-but-different candidates are never confirmed: TITLE_MISMATCH with the candidates listed', () => {
  const w = world([search([show(idOf(1), 'ポッドキャスト茶話会'), show(idOf(2), 'ポッドキャスト茶会 extra')])]);
  const r = find(w, 'ポッドキャスト茶会');
  assert.equal(r.status, 'TITLE_MISMATCH'); assert.equal(r.url, '');
  assert.equal(r.candidates.length, 2);
});
test('two exact-name shows: publisher decides only when exactly one matches, otherwise AMBIGUOUS (no auto-confirm)', () => {
  const two = [show(idOf(1), '茶会', 'A社'), show(idOf(2), '茶会', 'B社')];
  assert.equal(find(world([search(two)]), '茶会', 'B社').id, idOf(2));
  assert.equal(find(world([search(two)]), '茶会', 'C社').status, 'AMBIGUOUS');
  assert.equal(find(world([search(two)]), '茶会', '').status, 'AMBIGUOUS');
  assert.equal(find(world([search([show(idOf(1), '茶会', 'A'), show(idOf(2), '茶会', 'A')])]), '茶会', 'A').status, 'AMBIGUOUS');
});
test('no results at all -> NO_RESULTS (not a silent null)', () => {
  assert.equal(find(world([search([])]), 'ポッドキャスト茶会').status, 'NO_RESULTS');
  assert.equal(find(world([search([])]), '').status, 'NO_RESULTS');
});
test('admin alias table lets a known different Spotify name match, and only that name', () => {
  const w = world([search([show(ID19, 'Podcast Chakai')])]);
  vm.runInContext(`PODSP_TITLE_ALIASES_[podSpNormalize_('ポッドキャスト茶会')] = ['Podcast Chakai'];`, w.ctx);
  assert.equal(find(w, 'ポッドキャスト茶会').status, 'MATCH');
  assert.equal(find(world([search([show(ID19, 'Podcast Chakai 2')])]), 'ポッドキャスト茶会').status, 'TITLE_MISMATCH');
});

test('second page is read when the first page is full and has no match', () => {
  const full = Array.from({ length: 10 }, (_, i) => show(idOf(i + 10), 'x' + i));
  const w = world([search(full), search([show(ID19, 'ポッドキャスト茶会')])]);
  const r = find(w, 'ポッドキャスト茶会');
  assert.equal(r.status, 'MATCH'); assert.equal(r.calls, 2);
  assert.match(w.calls[1], /offset=10/);
});
test('call budget: stops with what was found, never loops', () => {
  const full = Array.from({ length: 10 }, (_, i) => show(idOf(i + 10), 'y' + i));
  const w = world([search(full)]);
  const r = find(w, '【公式】ポッドキャスト茶会 | 雑談部', '', { maxCalls: 2 });
  assert.equal(w.calls.length, 2); assert.equal(r.status, 'TITLE_MISMATCH'); assert.equal(r.partial, 'BUDGET');
});

test('failure reasons are classified: 401/403 AUTH, 429 RATE_LIMIT, 5xx HTTP_ERROR, network NETWORK, no token AUTH', () => {
  assert.equal(find(world([{ status: 401 }]), 'x茶会').status, 'AUTH');
  assert.equal(find(world([{ status: 403 }]), 'x茶会').status, 'AUTH');
  assert.equal(find(world([{ status: 404 }]), 'x茶会').status, 'HTTP_ERROR');
  assert.equal(find(world([{ status: 500 }, { status: 500 }]), 'x茶会').status, 'HTTP_ERROR');
  assert.equal(find(world([new Error('dns'), new Error('dns')]), 'x茶会').status, 'NETWORK');
  const noToken = world([], { token: '' });
  assert.equal(find(noToken, 'x茶会').status, 'AUTH'); assert.equal(noToken.calls.length, 0);
});
test('429: long Retry-After is HELD without retry; short Retry-After retries once; 5xx retries once', () => {
  const long = world([{ status: 429, headers: { 'Retry-After': '120' } }]);
  const r = find(long, 'x茶会');
  assert.equal(r.status, 'RATE_LIMIT'); assert.equal(r.retryAfterSeconds, 120);
  assert.equal(long.calls.length, 1); assert.deepEqual(long.sleeps, []);
  const short = world([{ status: 429, headers: { 'Retry-After': '3' } }, search([show(ID19, 'ポッドキャスト茶会')])]);
  assert.equal(find(short, 'ポッドキャスト茶会').status, 'MATCH');
  assert.deepEqual(short.sleeps, [3000]);
  const again = world([{ status: 429, headers: { 'Retry-After': '3' } }, { status: 429, headers: { 'Retry-After': '3' } }]);
  assert.equal(find(again, 'x茶会').status, 'RATE_LIMIT'); assert.equal(again.calls.length, 1 + 1);   // one retry only, then held
  const flaky = world([{ status: 503 }, search([show(ID19, 'ポッドキャスト茶会')])]);
  assert.equal(find(flaky, 'ポッドキャスト茶会').status, 'MATCH');
});

test('official link has priority: a known Spotify link is never searched or replaced', () => {
  const w = world([search([show(ID19, 'ポッドキャスト茶会')])]);
  const resolved = { spotify: 'https://open.spotify.com/show/' + idOf(9) };
  const out = plain(w.ctx.podSpCompleteResolved_(resolved, 'ポッドキャスト茶会', '', w.deps));
  assert.equal(out.spotify, 'https://open.spotify.com/show/' + idOf(9)); assert.equal(out.spotifyStatus, 'KNOWN_LINK'); assert.equal(w.calls.length, 0);
  const none = plain(w.ctx.podSpCompleteResolved_({ spotify: '' }, 'ポッドキャスト茶会', '', w.deps));
  assert.equal(none.spotify, 'https://open.spotify.com/show/' + ID19); assert.equal(none.spotifyStatus, 'MATCH');
  const held = world([{ status: 429, headers: { 'Retry-After': '99' } }]);
  const h = plain(held.ctx.podSpCompleteResolved_({ spotify: '' }, 'x茶会', '', held.deps));
  assert.equal(h.spotify, ''); assert.equal(h.spotifyStatus, 'RATE_LIMIT'); assert.match(h.spotifyDetail, /retryAfterSeconds":99/);
});

// ---- identity check / audit / one-cell fill ----
const IDENT = (name, publisher = 'p') => ({ body: { id: ID19, name, publisher } });
test('identity: show URL vs episode URL vs malformed; MATCH / TITLE_MISMATCH / alias confirmed by the admin', () => {
  const v = (w, url, opts) => plain(w.ctx.podSpVerifyShowIdentity_('ポッドキャスト茶会', '', url, opts, w.deps));
  const url = 'https://open.spotify.com/show/' + ID19;
  assert.equal(v(world([IDENT('ポッドキャスト茶会')]), url).identity, 'MATCH');
  assert.equal(v(world([IDENT('ポッドキャスト茶会')]), url + '?si=abc').identity, 'MATCH');
  assert.equal(v(world([IDENT('まったく別の番組')]), url).identity, 'TITLE_MISMATCH');
  assert.equal(v(world([IDENT('Podcast Chakai')]), url, { acceptAlias: 'Podcast Chakai' }).identity, 'MATCH_ALIAS');
  assert.equal(v(world([IDENT('Podcast Chakai')]), url, { acceptAlias: 'Other' }).identity, 'TITLE_MISMATCH');
  const ep = world([IDENT('x')]);
  assert.equal(v(ep, 'https://open.spotify.com/episode/' + ID19).identity, 'EPISODE_URL_NOT_SHOW'); assert.equal(ep.calls.length, 0);
  assert.equal(v(ep, 'https://example.com/show/' + ID19).identity, 'NOT_A_SHOW_URL');
  assert.equal(v(world([{ status: 404 }]), url).identity, 'HTTP_ERROR');
  assert.equal(v(world([{ status: 429, headers: { 'Retry-After': '50' } }]), url).identity, 'RATE_LIMIT');
});

function sheetWorld(rows) {
  const writes = [];
  const sheet = { getLastRow: () => rows.length + 1,
    getRange: (r, c, n, m) => ({ getDisplayValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + m)), getDisplayValue: () => rows[r - 2][c - 1] ?? '', setValue: v => { writes.push({ r, c, v }); rows[r - 2][c - 1] = v; } }) };
  const globals = { SPREADSHEET_ID: 'sid', PODCAST_SHEET_NAME: 'おすすめPodcast', getSheetLoose: () => sheet,
    SpreadsheetApp: { openById: () => ({}) }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) } };
  return { writes, globals };
}
const row = (o = {}) => { const r = Array(18).fill(''); r[0] = o.source ?? 'https://listen.style/p/podthakai'; r[1] = o.title ?? 'ポッドキャスト茶会'; r[6] = o.maker ?? ''; r[9] = o.spotify ?? ''; r[13] = o.listen ?? ''; return r; };

test('audit: counts LISTEN rows with an empty Spotify cell, no network without lookup, never writes', () => {
  const rows = [row(), row({ title: 'B', spotify: 'https://open.spotify.com/show/' + idOf(1) }), row({ title: 'C', source: 'https://example.com/x' }), row({ title: 'D', source: '', listen: 'https://listen.style/p/d' }), row({ title: '' })];
  const s = sheetWorld(rows); const w = world([], { globals: s.globals });
  const r = plain(w.ctx.auditRecommendedPodcastSpotifyGaps({ deps: w.deps }));
  assert.equal(r.total, 4); assert.equal(r.withListen, 3); assert.equal(r.missingSpotify, 2);
  assert.deepEqual(r.rows.map(x => x.row), [2, 5]);
  assert.equal(w.calls.length, 0); assert.equal(s.writes.length, 0);
});
test('audit with lookup: classifies a limited number of rows, stops on RATE_LIMIT, still no writes', () => {
  const rows = [row({ title: 'A茶会' }), row({ title: 'B茶会' }), row({ title: 'C茶会' })];
  const s = sheetWorld(rows);
  const w = world([search([show(idOf(1), 'A茶会')]), { status: 429, headers: { 'Retry-After': '99' } }, search([])], { globals: s.globals });
  const r = plain(w.ctx.auditRecommendedPodcastSpotifyGaps({ lookup: true, maxLookups: 5, deps: w.deps }));
  assert.equal(r.rows[0].status, 'MATCH'); assert.equal(r.rows[0].proposedUrl, 'https://open.spotify.com/show/' + idOf(1));
  assert.equal(r.rows[1].status, 'RATE_LIMIT'); assert.equal(r.rows[2].status, undefined);
  assert.deepEqual(r.byStatus, { MATCH: 1, RATE_LIMIT: 1 });
  assert.equal(s.writes.length, 0);
});

test('PODCAST 19 fill: dry run by default; apply needs confirmed identity + confirmShowId; blank cell only; one cell', () => {
  const url = 'https://open.spotify.com/show/' + ID19;
  const mk = (cell, replies) => { const s = sheetWorld([row({ spotify: cell }), row({ title: '別' })]); const w = world(replies, { globals: s.globals }); return { s, w }; };
  const run = (m, o) => plain(m.w.ctx.fillRecommendedPodcastSpotifyOne({ title: 'ポッドキャスト茶会', showUrl: url, deps: m.w.deps, ...o }));
  let m = mk('', [IDENT('ポッドキャスト茶会')]);
  let r = run(m); assert.equal(r.ok, true); assert.equal(r.dryRun, true); assert.equal(r.value, url); assert.equal(m.s.writes.length, 0);
  m = mk('', [IDENT('ポッドキャスト茶会')]);
  r = run(m, { apply: true }); assert.equal(r.reason, 'CONFIRM_SHOW_ID_REQUIRED'); assert.equal(m.s.writes.length, 0);
  m = mk('', [IDENT('ポッドキャスト茶会')]);
  r = run(m, { apply: true, confirmShowId: idOf(5) }); assert.equal(r.reason, 'CONFIRM_SHOW_ID_REQUIRED'); assert.equal(m.s.writes.length, 0);
  m = mk('', [IDENT('ポッドキャスト茶会')]);
  r = run(m, { apply: true, confirmShowId: ID19 });
  assert.equal(r.applied, true); assert.deepEqual(m.s.writes, [{ r: 2, c: 10, v: url }]);
  m = mk('', [IDENT('全然ちがう番組')]);
  r = run(m, { apply: true, confirmShowId: ID19 }); assert.equal(r.reason, 'IDENTITY_NOT_CONFIRMED'); assert.equal(m.s.writes.length, 0);
  m = mk('https://open.spotify.com/show/' + idOf(2), [IDENT('ポッドキャスト茶会')]);
  r = run(m, { apply: true, confirmShowId: ID19 }); assert.equal(r.reason, 'ALREADY_FILLED_NOT_OVERWRITTEN'); assert.equal(m.s.writes.length, 0); assert.equal(m.w.calls.length, 0);
  m = mk('', [IDENT('ポッドキャスト茶会')]);
  assert.equal(plain(m.w.ctx.fillRecommendedPodcastSpotifyOne({ title: '存在しない', showUrl: url, deps: m.w.deps })).reason, 'ROW_NOT_FOUND');
});

// ---- wiring in the existing files ----
test('PodcastPlatformSync: Spotify search runs AFTER the official links; failures are reported; Spotify.js wrapper is classified', () => {
  const sync = fs.readFileSync(dir + 'PodcastPlatformSync.js', 'utf8');
  assert.match(sync, /function resolveListenerPodcastPlatforms_\([^)]*\) \{\s*const resolved = resolveListenerPodcastPlatformsBase_\([^)]*\);\s*return podSpCompleteResolved_\(resolved, title, maker\);/);
  const base = sync.slice(sync.indexOf('function resolveListenerPodcastPlatformsBase_'), sync.indexOf('function findExactApplePodcast_'));
  assert.doesNotMatch(base, /findSpotifyShowByTitle_|podSpFindShow_/);
  assert.match(sync, /spotifyUnresolved: spotifyUnresolved/);
  assert.match(sync, /queuePodcastCellUpdate_\(updates, rowNumber, 10, row\[9\], resolved\.spotify\)/);   // still fills blank cells only
  const sp = fs.readFileSync(dir + 'Spotify.js', 'utf8');
  assert.match(sp, /const found = podSpFindShow_\(title, ""\);\s*if \(found\.status !== "MATCH"\)/);
  assert.doesNotMatch(sp.slice(sp.indexOf('function findSpotifyShowByTitle_'), sp.indexOf('function fetchSpotifyEpisodeFromWebApi')), /limit=10"[^;]*normalizeTitle/);
});
test('Spotify.js findSpotifyShowByTitle_ returns a URL only for MATCH and null (logged) otherwise', () => {
  const ctx = vm.createContext({ console: { log() {} }, getSpotifyAccessToken: () => 'TOKEN', Utilities: { sleep() {} },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ shows: { items: [{ id: ID19, name: 'ポッドキャスト茶会', publisher: 'p' }] } }), getAllHeaders: () => ({}) }) } });
  vm.runInContext(fs.readFileSync(dir + 'PodcastSpotifyResolve.js', 'utf8'), ctx);
  const spotify = fs.readFileSync(dir + 'Spotify.js', 'utf8');
  vm.runInContext(spotify.slice(spotify.indexOf('function findSpotifyShowByTitle_'), spotify.indexOf('function fetchSpotifyEpisodeFromWebApi')), ctx);
  assert.equal(ctx.findSpotifyShowByTitle_('ポッドキャスト茶会'), 'https://open.spotify.com/show/' + ID19);
  assert.equal(ctx.findSpotifyShowByTitle_('別の番組'), null);
});
test('the module has no unintended writes and no global-name collisions', () => {
  const src = fs.readFileSync(dir + 'PodcastSpotifyResolve.js', 'utf8');
  assert.equal((src.match(/\.setValue\(/g) || []).length, 1);                 // only the gated one-cell fill
  assert.doesNotMatch(src, /method\s*:\s*["'](post|put|delete)/i);
  const names = [...src.matchAll(/^(?:function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const others = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'PodcastSpotifyResolve.js').map(f => fs.readFileSync(dir + f, 'utf8')).join('\n');
  for (const n of names) assert.equal(new RegExp('^(?:function|const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b', 'm').test(others), false, 'collision: ' + n);
});

// ---- J column -> API -> site link (Issue #274 reproduction chain) ----
test('chain: a Spotify show URL in column J is served as source.spotify by the podcast API and rendered as a Spotify link', () => {
  const text = fs.readFileSync(dir + 'SheetData.js', 'utf8');
  const start = text.indexOf('function readPodcastSheet'); assert.ok(start >= 0);
  const ctx = vm.createContext({});
  vm.runInContext(text.slice(start, text.indexOf('\nfunction ', start + 10) > 0 ? text.indexOf('\nfunction ', start + 10) : undefined), ctx);
  const r = Array(18).fill(''); r[0] = 'https://listen.style/p/podthakai'; r[1] = 'ポッドキャスト茶会'; r[9] = 'https://open.spotify.com/show/' + ID19; r[13] = 'https://listen.style/p/podthakai';
  const sheet = { getLastRow: () => 2, getRange: () => ({ getDisplayValues: () => [r] }) };
  const api = plain(ctx.readPodcastSheet(sheet));
  assert.equal(api.items[0].spotify, 'https://open.spotify.com/show/' + ID19);       // column J = index 9
  assert.equal(api.items[0].listen, 'https://listen.style/p/podthakai');
  const site = fs.readFileSync('app/community.tsx', 'utf8');
  assert.match(site, /\["Spotify", source\.spotify\]/);                                // Spotify link comes only from source.spotify
  assert.match(site, /type=podcast&_=" \+ Date\.now\(\)/);                             // API call is cache-busted
  assert.doesNotMatch(site.replace(/function isRecommendedPodcastSnapshotFresh[\s\S]*?\n}\n/, ''), /isRecommendedPodcastSnapshotFresh\(/);   // a fresh local snapshot never suppresses the API refresh
  const sync = fs.readFileSync(dir + 'PodcastPlatformSync.js', 'utf8');
  assert.match(sync, /queuePodcastCellUpdate_\(updates, rowNumber, 10, row\[9\], resolved\.spotify\)/);   // the sync fills column J (10)
});

test('editor entry points are read-only: no apply flag anywhere, DRYRUN never writes', () => {
  const src = fs.readFileSync(dir + 'PodcastSpotifyResolve.js', 'utf8');
  const entry = src.slice(src.indexOf('// ---------------------------------------------------------------- editor entry points'));
  assert.doesNotMatch(entry, /apply\s*:\s*true|confirmShowId/);
  const s = sheetWorld([row()]); const w = world([IDENT('ポッドキャスト茶会')], { globals: s.globals });
  w.ctx.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ id: ID19, name: 'ポッドキャスト茶会', publisher: 'p' }), getAllHeaders: () => ({}) }) };
  vm.runInContext('var getSpotifyAccessToken = function(){ return "TOKEN"; }; var Utilities = { sleep: function(){} };', w.ctx);
  const r = plain(w.ctx.DRYRUN_PODCAST19_SPOTIFY_FILL());
  assert.equal(r.dryRun, true); assert.equal(r.identity, 'MATCH'); assert.equal(s.writes.length, 0);
});
