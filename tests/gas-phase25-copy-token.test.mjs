import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const SECRETS = { access: 'AT-SECRET-OLD', refresh: 'RT-SECRET-OLD', newAccess: 'AT-SECRET-NEW', newRefresh: 'RT-SECRET-NEW', clientId: 'CID', clientSecret: 'CSECRET-VALUE' };
const K = n => 'P25_COPY_SPOTIFY_' + n;
const NOW = Date.parse('2026-11-10T00:00:00Z');

function make({ props = {}, scriptId = 'copy-script', tokenReply = null, locked = false } = {}) {
  const store = new Map(Object.entries({ [K('CLIENT_ID')]: SECRETS.clientId, [K('CLIENT_SECRET')]: SECRETS.clientSecret, ...props }));
  const fetches = [], logs = [];
  let lockHeld = locked, locks = 0;
  const ctx = vm.createContext({
    ScriptApp: { getScriptId: () => scriptId },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => { assert.ok(k.startsWith('P25_COPY_SPOTIFY_'), 'only COPY properties may be read: ' + k); return store.has(k) ? store.get(k) : null; },
      setProperty: (k, v) => { assert.ok(k.startsWith('P25_COPY_SPOTIFY_'), 'only COPY properties may be written: ' + k); store.set(k, String(v)); },
      deleteProperty: k => { assert.ok(k.startsWith('P25_COPY_SPOTIFY_')); store.delete(k); } }) },
    LockService: { getUserLock: () => ({ tryLock: () => { if (lockHeld) return false; lockHeld = true; locks++; return true; }, releaseLock: () => { lockHeld = false; } }) },
    Utilities: { base64Encode: s => Buffer.from(s).toString('base64') },
    UrlFetchApp: { fetch: (url, options) => {
      fetches.push({ url, options });
      assert.equal(url, 'https://accounts.spotify.com/api/token', 'token module may only call the token endpoint');
      assert.equal(options.method, 'post');
      const r = typeof tokenReply === 'function' ? tokenReply(fetches.length) : tokenReply;
      return { getResponseCode: () => r.status, getContentText: () => r.body === undefined ? JSON.stringify({}) : (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)), getAllHeaders: () => r.headers || {} };
    } },
    console: { log: (...a) => logs.push(a.join(' ')) },
    Logger: { log: (...a) => logs.push(a.join(' ')) }
  });
  vm.runInContext(fs.readFileSync('scripts/google-apps-script/P25CopyToken.js', 'utf8'), ctx);
  const config = { environment: 'COPY', copyScriptId: 'copy-script' };
  return { ctx, store, fetches, logs, config, locks: () => locks, get: opts => ctx.p25CopyTokGet_(config, { nowMs: NOW, ...opts }), release: () => { lockHeld = false; } };
}
const live = { [K('ACCESS_TOKEN')]: SECRETS.access, [K('REFRESH_TOKEN')]: SECRETS.refresh };
const noSecretsIn = (t, text) => { for (const v of Object.values(SECRETS)) if (['clientId'].includes(v)) continue; for (const [k, v] of Object.entries(SECRETS)) if (k !== 'clientId') assert.ok(!String(text).includes(v), 'secret leaked: ' + k); };

test('callback storage keeps refresh_token and expiry; a missing refresh_token keeps the old one', () => {
  const h = make({ props: { [K('REFRESH_TOKEN')]: 'RT-KEEP', [K('REAUTH_REQUIRED')]: '1', [K('REFRESH_NOT_BEFORE')]: '5' } });
  const r = h.ctx.p25CopyTokStore_(h.config, { access_token: 'AT1', expires_in: 3600 }, NOW);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { stored: true, refreshTokenPresent: true, refreshTokenReplaced: false });
  assert.equal(h.store.get(K('REFRESH_TOKEN')), 'RT-KEEP');
  assert.equal(h.store.get(K('EXPIRES_AT')), String(NOW + 3600000));
  assert.equal(h.store.has(K('REAUTH_REQUIRED')), false);
  assert.equal(h.store.has(K('REFRESH_NOT_BEFORE')), false);
  h.ctx.p25CopyTokStore_(h.config, { access_token: 'AT2', refresh_token: 'RT-NEW', expires_in: 100 }, NOW);
  assert.equal(h.store.get(K('REFRESH_TOKEN')), 'RT-NEW');
  assert.throws(() => h.ctx.p25CopyTokStore_(h.config, { refresh_token: 'x' }, NOW), /COPY_TOKEN_RESPONSE_INVALID/);
});

test('valid token: used as is, no POST, no lock', () => {
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: String(NOW + 3600000) } });
  assert.equal(h.get(), SECRETS.access);
  assert.equal(h.fetches.length, 0);
  assert.equal(h.locks(), 0);
});

test('expired (or inside the 5-minute margin) token is refreshed with grant_type=refresh_token and stored', () => {
  for (const exp of [NOW - 1000, NOW + 200000]) {
    const h = make({ props: { ...live, [K('EXPIRES_AT')]: String(exp) }, tokenReply: { status: 200, body: { access_token: SECRETS.newAccess, expires_in: 3600 } } });
    assert.equal(h.get(), SECRETS.newAccess);
    assert.equal(h.fetches.length, 1);
    const o = h.fetches[0].options;
    assert.equal(o.payload.grant_type, 'refresh_token');
    assert.equal(o.payload.refresh_token, SECRETS.refresh);
    assert.equal(o.headers.Authorization, 'Basic ' + Buffer.from(SECRETS.clientId + ':' + SECRETS.clientSecret).toString('base64'));
    assert.equal(h.store.get(K('REFRESH_TOKEN')), SECRETS.refresh);               // not returned -> kept
    assert.equal(h.store.get(K('ACCESS_TOKEN')), SECRETS.newAccess);
    assert.equal(h.store.get(K('EXPIRES_AT')), String(NOW + 3600000));
    assert.equal(h.locks(), 1);
  }
});

test('a rotated refresh_token replaces the old one; PKCE style (no client secret) sends client_id in the body', () => {
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1', [K('CLIENT_SECRET')]: '' }, tokenReply: { status: 200, body: { access_token: SECRETS.newAccess, refresh_token: SECRETS.newRefresh, expires_in: 3600 } } });
  h.store.delete(K('CLIENT_SECRET'));
  assert.equal(h.get(), SECRETS.newAccess);
  assert.equal(h.store.get(K('REFRESH_TOKEN')), SECRETS.newRefresh);
  assert.equal(h.fetches[0].options.payload.client_id, SECRETS.clientId);
  assert.equal(h.fetches[0].options.headers.Authorization, undefined);
});

test('legacy token without expiry: refreshed when a refresh token exists, used as is when it does not', () => {
  const a = make({ props: { [K('ACCESS_TOKEN')]: 'legacy' } });
  assert.equal(a.get(), 'legacy'); assert.equal(a.fetches.length, 0);
  const b = make({ props: live, tokenReply: { status: 200, body: { access_token: SECRETS.newAccess, expires_in: 3600 } } });
  assert.equal(b.get(), SECRETS.newAccess);
  const c = make({ props: { [K('ACCESS_TOKEN')]: 'old', [K('EXPIRES_AT')]: String(NOW - 5) } });
  assert.throws(() => c.get(), /COPY_REAUTH_REQUIRED/);                           // expired and nothing to refresh with
  assert.equal(c.fetches.length, 0);
  assert.throws(() => make({}).get(), /COPY_TOKEN_REQUIRED/);
});

test('refresh failure 400 (invalid_grant) -> re-auth flag; later calls do NOT hit Spotify again', () => {
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1' }, tokenReply: { status: 400, body: { error: 'invalid_grant', error_description: 'Refresh token revoked ' + SECRETS.refresh } } });
  assert.throws(() => h.get(), e => e.message === 'COPY_REAUTH_REQUIRED' && e.status === 400);
  assert.equal(h.store.get(K('REAUTH_REQUIRED')), '1');
  for (let i = 0; i < 3; i++) assert.throws(() => h.get(), /COPY_REAUTH_REQUIRED/);
  assert.equal(h.fetches.length, 1);
  // a fresh OAuth (callback) clears the flag
  h.ctx.p25CopyTokStore_(h.config, { access_token: 'A', refresh_token: 'R', expires_in: 3600 }, NOW);
  assert.equal(h.get(), 'A');
});

test('429 on refresh: Retry-After backoff, no hammering; recovers after the wait', () => {
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1' }, tokenReply: n => n === 1 ? { status: 429, headers: { 'Retry-After': '120' }, body: {} } : { status: 200, body: { access_token: SECRETS.newAccess, expires_in: 3600 } } });
  assert.throws(() => h.get(), e => e.message === 'COPY_TOKEN_REFRESH_RATE_LIMITED' && e.status === 429 && e.retryAfterSeconds === 120);
  assert.throws(() => h.get({ nowMs: NOW + 60000 }), e => e.message === 'COPY_TOKEN_REFRESH_BACKOFF' && e.retryAfterSeconds === 60);
  assert.equal(h.fetches.length, 1);
  assert.equal(h.get({ nowMs: NOW + 121000 }), SECRETS.newAccess);
  assert.equal(h.fetches.length, 2);
});

test('5xx / garbage reply: short backoff, nothing stored, old tokens kept', () => {
  for (const reply of [{ status: 503, body: {} }, { status: 200, body: 'not json' }, { status: 200, body: {} }]) {
    const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1' }, tokenReply: reply });
    assert.throws(() => h.get(), /COPY_TOKEN_REFRESH_FAILED|COPY_TOKEN_RESPONSE_INVALID/);
    assert.equal(h.store.get(K('ACCESS_TOKEN')), SECRETS.access);
    assert.equal(h.store.get(K('REFRESH_TOKEN')), SECRETS.refresh);
    assert.equal(h.store.get(K('REFRESH_NOT_BEFORE')), String(NOW + 60000));
    assert.throws(() => h.get(), /COPY_TOKEN_REFRESH_BACKOFF/);
    assert.equal(h.fetches.length, 1);
  }
});

test('401 from the API: one forced refresh; a token somebody else already replaced is used without POST', () => {
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: String(NOW + 3600000) }, tokenReply: { status: 200, body: { access_token: SECRETS.newAccess, expires_in: 3600 } } });
  assert.equal(h.get({ rejected: SECRETS.access }), SECRETS.newAccess);
  assert.equal(h.fetches.length, 1);
  const g = make({ props: { ...live, [K('EXPIRES_AT')]: String(NOW + 3600000) } });
  assert.equal(g.get({ rejected: 'STALE-TOKEN' }), SECRETS.access);               // stored token differs from the rejected one
  assert.equal(g.fetches.length, 0);
});

test('concurrent refresh: a busy lock means no POST; if another run refreshed while waiting, no POST either', () => {
  const busy = make({ props: { ...live, [K('EXPIRES_AT')]: '1' }, locked: true });
  assert.throws(() => busy.get(), /COPY_TOKEN_LOCK_BUSY/);
  assert.equal(busy.fetches.length, 0);
  // simulate the double-check after acquiring the lock: the property already holds a fresh token
  const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1' } });
  const realTry = h.ctx.LockService.getUserLock;
  h.ctx.LockService.getUserLock = () => { const l = realTry(); const t = l.tryLock; l.tryLock = ms => { const ok = t(ms); h.store.set(K('ACCESS_TOKEN'), 'FRESH-BY-OTHER'); h.store.set(K('EXPIRES_AT'), String(NOW + 3600000)); return ok; }; return l; };
  assert.equal(h.get(), 'FRESH-BY-OTHER');
  assert.equal(h.fetches.length, 0);
});

test('COPY isolation: production/unknown script or non-COPY config never touches tokens', () => {
  const prod = make({ props: live, scriptId: '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9' });
  prod.config.copyScriptId = '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9';
  assert.throws(() => prod.get(), /COPY_ISOLATION_REQUIRED/);
  assert.throws(() => prod.ctx.p25CopyTokStore_(prod.config, { access_token: 'x' }, NOW), /COPY_ISOLATION_REQUIRED/);
  const other = make({ props: live, scriptId: 'some-other-script' });
  assert.throws(() => other.get(), /COPY_ISOLATION_REQUIRED/);
  const wrongEnv = make({ props: live }); wrongEnv.config.environment = 'PRODUCTION';
  assert.throws(() => wrongEnv.get(), /COPY_ISOLATION_REQUIRED/);
  assert.equal(prod.fetches.length + other.fetches.length + wrongEnv.fetches.length, 0);
});

test('secrets never appear in errors, logs or the status summary', () => {
  const replies = [{ status: 400, body: { error_description: SECRETS.refresh + SECRETS.newAccess } }, { status: 429, headers: { 'Retry-After': '1' }, body: {} }, { status: 500, body: SECRETS.newRefresh }];
  for (const reply of replies) {
    const h = make({ props: { ...live, [K('EXPIRES_AT')]: '1' }, tokenReply: reply });
    let text = '';
    try { h.get(); } catch (e) { text = e.message + JSON.stringify(e); }
    noSecretsIn(null, text + h.logs.join('\n'));
    noSecretsIn(null, JSON.stringify(h.ctx.p25CopyTokStatus_(h.config, NOW)));
  }
  const ok = make({ props: { ...live, [K('EXPIRES_AT')]: String(NOW + 3600000) } });
  const st = JSON.parse(JSON.stringify(ok.ctx.p25CopyTokStatus_(ok.config, NOW)));
  assert.deepEqual(Object.keys(st).sort(), ['accessTokenPresent', 'expiresAt', 'expiresInSeconds', 'reauthRequired', 'refreshBackoffSeconds', 'refreshTokenPresent']);
  assert.equal(st.expiresInSeconds, 3600);
});

test('the token module has no Spotify playlist/API access: its only network call is the token endpoint', () => {
  const src = fs.readFileSync('scripts/google-apps-script/P25CopyToken.js', 'utf8');
  assert.equal((src.match(/UrlFetchApp\.fetch/g) || []).length, 1);
  assert.doesNotMatch(src, /api\.spotify\.com/);
  assert.doesNotMatch(src, /playlists/);
  assert.doesNotMatch(src, /write\s*:\s*true/);
  for (const m of src.matchAll(/(?:getProperty|setProperty|deleteProperty)\(([^)]*)\)/g)) assert.match(m[1], /p25CopyTokKey_|k\b/);   // only via the P25_COPY_SPOTIFY_ key helper
});

// ---- adapter integration: GET 401 -> one refresh -> one retry; POST (playlist add) is never retried ----
const playlist = 'P'.repeat(22), candidate = 'Z'.repeat(22);
function adapterWorld({ apiStatuses }) {
  const store = new Map(Object.entries({ [K('ACCESS_TOKEN')]: 'OLD', [K('REFRESH_TOKEN')]: 'RT', [K('EXPIRES_AT')]: String(Date.now() + 3600000), [K('CLIENT_ID')]: 'cid', [K('CLIENT_SECRET')]: 'cs' }));
  const calls = [], tokenCalls = [];
  const headers = Array(39).fill(''); Object.entries({ 0: '台帳ID', 1: '番組名', 2: 'タイトル', 3: '配信日時', 6: '外部ID', 11: 'Spotify個別URL', 22: '概要清掃済み', 23: '出演者・スタッフ', 38: '人間除外' }).forEach(([i, v]) => headers[i] = v);
  const row = Array(39).fill(''); Object.entries({ 0: 'EP-00001', 1: 'テスト番組', 2: 't', 3: '2026/11/6 4:00', 6: 'g', 11: 'https://open.spotify.com/episode/' + candidate }).forEach(([i, v]) => row[i] = v);
  const sheet = rows => ({ getLastRow: () => rows.length, getLastColumn: () => Math.max(...rows.map(r => r.length)), getRange: (r, c, n, m) => ({ getDisplayValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => String(rows[r + i - 1]?.[c + j - 1] ?? ''))), getValues() { return this.getDisplayValues(); } }) });
  const books = { 'copy-state': { P25_STATE: sheet([['key', 'version', 'part', 'json']]) }, 'copy-requests': {}, 'copy-ledger': { 'エピソード台帳': sheet([headers, row]), '削除・除外履歴': sheet([['GUID', 'EP-ID']]) } };
  let n = 0;
  const ctx = vm.createContext({
    ScriptApp: { getScriptId: () => 'copy-script' }, Utilities: { base64Encode: s => Buffer.from(s).toString('base64'), getUuid: () => 'u' },
    SpreadsheetApp: { openById: k => ({ getSheetByName: name => books[k][name] }), flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => store.get(k) ?? null, setProperty: (k, v) => store.set(k, String(v)), deleteProperty: k => store.delete(k) }) },
    LockService: { getUserLock: () => ({ tryLock: () => true, releaseLock() {} }), getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch: (url, o) => {
      if (url.startsWith('https://accounts.spotify.com')) { tokenCalls.push(o.payload.grant_type); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ access_token: 'NEW', expires_in: 3600 }), getAllHeaders: () => ({}) }; }
      const u = new URL(url); calls.push({ method: o.method, path: u.pathname, auth: o.headers.Authorization });
      const status = apiStatuses[Math.min(n++, apiStatuses.length - 1)];
      return { getResponseCode: () => status, getContentText: () => JSON.stringify({ id: candidate, is_playable: true, name: '[P25-COPY] test' }), getAllHeaders: () => ({}) };
    } }
  });
  for (const f of ['P25LibraryPipeline.js', 'P25CopyToken.js', 'P25CopyAdapter.js']) vm.runInContext(fs.readFileSync('scripts/google-apps-script/' + f, 'utf8'), ctx);
  const config = { environment: 'COPY', copyScriptId: 'copy-script', stateSheetId: 'copy-state', requestSheetId: 'copy-requests', ledgerSheetId: 'copy-ledger', copyPlaylistIds: [playlist] };
  return { ctx, config, calls, tokenCalls, store };
}
const verifyIds = w => JSON.parse(JSON.stringify(w.ctx.P25_VERIFY_IDS_COPY(w.config, ['EP-00001'])));

test('adapter: API 401 on GET -> exactly one refresh and one retry with the new token -> ok', () => {
  const w = adapterWorld({ apiStatuses: [401, 200] });
  const r = verifyIds(w);
  assert.deepEqual(r.ok, ['EP-00001']); assert.equal(r.stopped, null);
  assert.deepEqual(w.tokenCalls, ['refresh_token']);
  assert.deepEqual(w.calls.map(c => c.auth), ['Bearer OLD', 'Bearer NEW']);
  assert.equal(r.apiUsage.tokenRefreshes, 1);
});
test('adapter: 401 again after the refresh is NOT retried further and is reported', () => {
  const w = adapterWorld({ apiStatuses: [401, 401, 401, 401] });
  const r = verifyIds(w);
  assert.equal(r.stopped.reason, 'SPOTIFY_AUTH_REQUIRED');
  assert.equal(w.tokenCalls.length, 1);
  assert.equal(w.calls.length, 2);                                                   // original + one retry, nothing more
  assert.deepEqual(r.notVerifiable, ['EP-00001']);
});
test('adapter: an expired stored token is refreshed BEFORE the first API call (no wasted 401)', () => {
  const w = adapterWorld({ apiStatuses: [200] });
  w.store.set(K('EXPIRES_AT'), String(Date.now() - 1000));
  const r = verifyIds(w);
  assert.deepEqual(r.ok, ['EP-00001']);
  assert.deepEqual(w.calls.map(c => c.auth), ['Bearer NEW']);
  assert.equal(w.tokenCalls.length, 1);
});
test('adapter: refresh failure stops the check with the token reason and never calls the API', () => {
  const w = adapterWorld({ apiStatuses: [200] });
  w.store.set(K('EXPIRES_AT'), '1'); w.store.set(K('REAUTH_REQUIRED'), '1');
  const r = verifyIds(w);
  assert.equal(r.stopped.reason, 'COPY_REAUTH_REQUIRED');
  assert.equal(w.calls.length, 0); assert.equal(w.tokenCalls.length, 0);
});
test('adapter: the playlist POST is never retried or refreshed on 401', () => {
  const w = adapterWorld({ apiStatuses: [200, 401, 200, 200] });                      // 1st: playlist-name GET ok, 2nd: the POST is rejected
  w.config.write = true; w.config.legacyWriterDisabled = true; w.config.maxAdditions = 1;
  const io = w.ctx.p25CopyIo_(w.config);
  assert.throws(() => io.add(playlist, [candidate]), e => e.status === 401);
  assert.equal(w.calls.filter(c => c.method === 'post').length, 1);                   // no second POST
  assert.equal(w.tokenCalls.length, 0);                                                 // and no refresh for a write
});
