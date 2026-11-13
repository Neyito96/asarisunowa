// Apple GUID照合テストGAS（gas/apple-guid-test/AppleGuidTest.js）の模擬試験。配布ファイルそのものをGAS模擬環境で実行する。
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm'; import crypto from 'node:crypto';

const dq = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); // vm越しの配列を比較可能にする
const SRC = fs.readFileSync(new URL('../gas/apple-guid-test/AppleGuidTest.js', import.meta.url), 'utf8');
const COPY = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
const HDR = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', '再生時間 秒', '公式GUID'];
const au = (c, t) => `https://podcasts.apple.com/jp/podcast/x/id${c}${t ? `?i=${t}&uo=4` : ''}`;
const row = (ep, show, url, guid) => { const r = HDR.map(() => ''); r[0] = ep; r[1] = show; r[7] = url; r[18] = guid; return r; };
function ledger() {
  return [HDR,
    row('EP-1', 'A', au(111, 1001), 'g-1'), row('EP-2', 'A', au(111, 1002), 'G-2'), row('EP-3', 'B', au(222, 2001), 'g-3'),
    row('EP-4', 'B', au(222, 2002), 'g-4'), row('EP-5', 'C', au(333, 3001), 'g-5'), row('EP-6', 'D', au(444, 4001), 'g-6'),
    row('EP-7', 'E', au(555, 5001), 'g-7'), row('EP-8', 'E', au(555), 'g-8') /* 番組URLだけ→候補外 */, row('EP-9', 'F', au(666, 6001), '') /* GUID無→候補外 */,
    row('EP-10', 'A', au(111, 1003), 'g-10'), row('EP-11', 'C', au(333, 3002), 'g-11'), row('EP-12', 'D', au(444, 4002), 'g-12')];
}
const ep = (c, t, g, view = true) => ({ wrapperType: 'podcastEpisode', trackId: t, collectionId: c, episodeGuid: g, trackViewUrl: view ? au(c, t) : `https://example.com/${t}.mp3` });
function apiFixture() {
  return {
    111: { code: 200, json: { results: [{ wrapperType: 'track', kind: 'podcast', collectionId: 111 }, ep(111, 1001, 'g-1'), ep(111, 1002, 'g-2'), ep(111, 1003, 'g-10')] } }, // EP-2 は大文字小文字違い→MATCH
    222: { code: 200, json: { results: [ep(222, 2001, 'other'), ep(222, 2002, 'g-4')] } },   // EP-3 MISMATCH
    333: { code: 200, json: { results: [ep(333, 3002, 'g-11')] } },                         // EP-5 NOT_RETRIEVED
    444: { seq: [{ code: 429 }, { code: 429 }] },                                           // 2回とも429→API_ERROR
    555: { code: 200, json: { results: [ep(555, 5001, '')] } }                              // API_NULL_GUID
  };
}
function env({ id = COPY, name = '【COPY試験】V2収蔵ボット', triggers = 0, api = apiFixture(), sheets } = {}) {
  const book = sheets || { 'V2・公開台帳': ledger() }; const calls = []; const writes = []; const cache = new Map(); const seqIx = {};
  const mkSheet = (nm) => ({
    getName: () => nm, getLastRow: () => book[nm].length, getLastColumn: () => (book[nm][0] || []).length,
    getDataRange: () => ({ getValues: () => JSON.parse(JSON.stringify(book[nm])) }),
    getRange: (r, c, nr, nc) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (book[nm][r - 1 + i] || [])[c - 1 + j] ?? '')),
      setValues: (v) => { writes.push({ sheet: nm, row: r, n: v.length }); v.forEach((line, i) => { book[nm][r - 1 + i] = book[nm][r - 1 + i] || []; line.forEach((x, j) => { book[nm][r - 1 + i][c - 1 + j] = x; }); }); }
    })
  });
  const ss = { getId: () => id, getName: () => name, getSheetByName: (n) => (book[n] ? mkSheet(n) : null), insertSheet: (n) => { book[n] = []; writes.push({ sheet: n, insert: true }); return mkSheet(n); } };
  const ctx = {
    Logger: { log: () => {} }, ScriptApp: { getProjectTriggers: () => Array(triggers) },
    SpreadsheetApp: { openById: (x) => { calls.push(['open', x]); return ss; }, flush: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    Utilities: { sleep: () => {}, formatDate: () => '20261113-150000', DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
      computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s).digest()].map((b) => (b > 127 ? b - 256 : b)) },
    UrlFetchApp: { fetch: (u) => { calls.push(['fetch', u]); const cid = u.match(/id=(\d+)/)[1]; const f = api[cid]; if (!f) throw new Error('net');
      const r = f.seq ? f.seq[Math.min((seqIx[cid] = (seqIx[cid] ?? -1) + 1), f.seq.length - 1)] : f; return { getResponseCode: () => r.code, getContentText: () => JSON.stringify(r.json || {}) }; } }
  };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  return { ctx, book, calls, writes, cache };
}

test('選定: 個別URL(?i=)とGUIDの両方がある行だけ・番組を巡回して異なる番組を優先', () => {
  const { ctx } = env(); const rows = ctx.agtRowsFromValues_(ledger()); const s = ctx.agtSelect_(rows, 5);
  dq(s.picked.map((r) => r.epId), ['EP-1', 'EP-3', 'EP-5', 'EP-6', 'EP-7']);
  assert.equal(s.eligible, 10); assert.equal(s.showUrlOnly, 1);
  dq(ctx.agtSelect_(rows, 10).picked.map((r) => r.epId), ['EP-1', 'EP-3', 'EP-5', 'EP-6', 'EP-7', 'EP-2', 'EP-4', 'EP-11', 'EP-12', 'EP-10']);
});
test('見出しが無ければ列位置を推測せず停止', () => {
  const { ctx } = env(); assert.throws(() => ctx.agtRowsFromValues_([['EP-ID', '番組', 'Apple']]), /HEADER_NOT_FOUND 公式GUID/);
});
test('5件: MATCH/MISMATCH/NOT_RETRIEVED/API_ERROR/API_NULL_GUID を区別し、通信試行とキャッシュを分けて数える', () => {
  const e = env(); const out = e.ctx.URLBOT_GUID_5();
  assert.equal(out.status, 'OK');
  dq(out.epIds, ['EP-1:MATCH', 'EP-3:MISMATCH', 'EP-5:NOT_RETRIEVED', 'EP-6:API_ERROR', 'EP-7:API_NULL_GUID']);
  dq(out.counts, { MATCH: 1, MISMATCH: 1, API_NULL_GUID: 1, NOT_RETRIEVED: 1, API_ERROR: 1 });
  dq(out.api, { apiAttempts: 6, apiSuccess: 4, apiFailures: 2, cacheHits: 0 }); // 444は429→再試行1回=2試行
  assert.equal(out.readbackOk, true); assert.equal(out.sourceSheetUnchanged, true); assert.equal(out.logRowsWritten, 5);
});
test('書込はCOPYの新ログシートだけ（台帳本体には書かない）・開くのはCOPYだけ', () => {
  const e = env(); e.ctx.URLBOT_GUID_5();
  assert.ok(e.writes.every((w) => w.sheet === 'URL補完GUIDテスト'));
  dq(e.book['V2・公開台帳'], ledger());
  assert.ok(e.calls.filter((c) => c[0] === 'open').every((c) => c[1] === COPY));
});
test('10件: 2回目はキャッシュを使い通信を増やさない・5件テストとの重複を明記', () => {
  const e = env(); e.ctx.URLBOT_GUID_5(); const fetches5 = e.calls.filter((c) => c[0] === 'fetch').length;
  const out = e.ctx.URLBOT_GUID_10(); const fetches10 = e.calls.filter((c) => c[0] === 'fetch').length - fetches5;
  assert.equal(out.status, 'OK'); assert.equal(out.selection.picked, 10);
  assert.equal(out.api.cacheHits, 4); assert.equal(fetches10, out.api.apiAttempts); assert.equal(out.api.apiAttempts, 4); // 429番組は2行×2試行
  dq(out.overlapWith5, ['EP-1', 'EP-3', 'EP-5', 'EP-6', 'EP-7']);
  assert.equal(e.book['URL補完GUIDテスト'].length, 1 + 5 + 10);
  const r10 = e.book['URL補完GUIDテスト'].slice(6); dq(r10.map((r) => r[15]), ['重複', '重複', '重複', '重複', '重複', '新規', '新規', '新規', '新規', '新規']);
  assert.equal(r10.find((r) => r[4] === 'EP-2')[10], 'MATCH'); // 大文字小文字の違いは同一GUID
});
test('trackViewUrl が個別EPでない／番組IDが違う → MATCHにしない', () => {
  const { ctx } = env(); const row = { trackId: '9', collectionId: '1', guid: 'g' };
  assert.equal(ctx.agtJudge_(row, { ok: true, episodes: ctx.agtCompact_({ results: [ep(1, 9, 'g', false)] }, '1').episodes }).reason, 'TRACKVIEWURL_NOT_EPISODE');
  assert.equal(ctx.agtJudge_(row, { ok: true, episodes: [{ trackId: '9', collectionId: '2', guid: 'g', viewUrlOk: true }] }).reason, 'COLLECTION_ID_DIFFERS');
});
test('200件打切りで見つからない回は「Appleに無い」でなく打切り理由', () => {
  const { ctx } = env(); const many = { results: Array.from({ length: 200 }, (_, i) => ep(1, 100 + i, 'x' + i)) };
  const c = ctx.agtCompact_(many, '1'); assert.equal(c.truncated, true);
  assert.equal(ctx.agtJudge_({ trackId: '5', collectionId: '1', guid: 'g' }, { ok: true, ...c }).reason, 'TRACKID_NOT_IN_LATEST_200');
});
test('安全装置: 保護ID・COPY以外の名前・トリガーあり・開いたID違い・既存ログ見出し違い は書込0で停止', () => {
  for (const [opt, re] of [[{ name: 'V2作業用' }, /TARGET_NAME_NOT_COPY/], [{ triggers: 1 }, /TRIGGERS_PRESENT/], [{ id: 'other' }, /OPENED_ID_MISMATCH/]]) {
    const e = env(opt); assert.throws(() => e.ctx.URLBOT_GUID_5(), re); assert.equal(e.writes.length, 0);
  }
  const e = env({ sheets: { 'V2・公開台帳': ledger(), 'URL補完GUIDテスト': [['旧', '見出し']] } });
  assert.throws(() => e.ctx.URLBOT_GUID_5(), /LOG_HEADER_MISMATCH/); dq(e.book['URL補完GUIDテスト'], [['旧', '見出し']]);
  const p = env(); p.ctx.AGT_CFG.targetSpreadsheetId = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc'; assert.throws(() => p.ctx.URLBOT_GUID_5(), /PROTECTED_TARGET_REFUSED/); assert.equal(p.calls.length, 0);
  const v = env(); v.ctx.AGT_CFG.verifiedEnabled = true; assert.throws(() => v.ctx.URLBOT_GUID_5(), /VERIFIED_ENABLED_REFUSED/);
  const n = env(); assert.throws(() => n.ctx.agtRun_('x', 1000), /N_OUT_OF_RANGE/);
});
test('点検: 書込なし・Apple通信なし・旧固定シートは読むだけ', () => {
  const e = env({ sheets: { 'V2・公開台帳': ledger(), 'URL補完対象_固定': [['seq', 'epId'], [1, 'EP-1']] } });
  const out = e.ctx.URLBOT_GUID_0_CHECK();
  assert.equal(out.status, 'CHECK_OK'); assert.equal(out.eligible, 10); assert.equal(out.legacyFixedSheet.exists, true);
  assert.equal(e.writes.length, 0); assert.equal(e.calls.filter((c) => c[0] === 'fetch').length, 0);
});
test('ファイルに1,000件バッチ・トリガー作成・URL書込の経路が無い', () => {
  assert.doesNotMatch(SRC, /newTrigger|\.create\(\)|deleteTrigger/);
  assert.doesNotMatch(SRC, /maxN:\s*(?!10\b)\d+/);
  assert.match(SRC, /verifiedEnabled: false/);
});
