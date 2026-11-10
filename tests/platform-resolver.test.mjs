import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { resolveOne, runBot, planFills, nextState, buildReport, normTitle, dateCompatible, retryAfter, CooldownGate, FetchError, classifyHttp } from '../scripts/lib/platform-resolver.mjs';
import { appleAdapter, spotifyAdapter } from '../scripts/lib/platform-adapters.mjs';

const NOW = Date.parse('2026-11-10T00:00:00Z');
const inp = (o = {}) => ({ epId: 'EP-06642', showTitle: 'ポッドキャスト茶会', title: '第5回 お茶の話', publishedAt: '2026-11-08 05:00', guid: 'guid-1', showIds: { spotify: 'S1' }, existing: {}, showUrls: {}, ...o });
const SP = (id) => `https://open.spotify.com/episode/${id}`;
const fxr = (cands) => ({ spotify: { candidates: async () => ({ candidates: cands }) } });
const cand = (o) => ({ url: SP('A1'), title: '第5回 お茶の話', publishedAt: '2026-11-08', precision: 'day', externalId: 'A1', showId: 'S1', ...o });
const run = (i, cands, extra = {}) => resolveOne(i, 'spotify', { fetchers: fxr(cands), now: NOW, ...extra });

test('#274: 番組Spotify URL(/show/)は個別EPとして採用されず、候補に混ざっても除外', async () => {
  const show = 'https://open.spotify.com/show/7dDe6pPYCdUUDQ2AL40xtE';
  const r = await run(inp(), [cand({ url: show, title: '第5回 お茶の話' })]);
  assert.notEqual(r.status, 'VERIFIED'); assert.equal(r.url, ''); assert.equal(r.reason, 'NO_CANDIDATE'); assert.ok(r.evidence.some((e) => /rejected-non-episode/.test(e)));
  const held = await run(inp({ existing: { spotify: show } }), []);
  assert.equal(held.status, 'HOLD'); assert.equal(held.reason, 'NON_EPISODE_URL_IN_EPISODE_CELL'); assert.equal(held.entity_type, 'show');
  const ok = await run(inp(), [cand()]); assert.equal(ok.status, 'VERIFIED'); assert.equal(ok.url, SP('A1'));
});
test('#274: 遅れて現れた個別EP(初回NOT_FOUND→再試行でVERIFIED)', async () => {
  const first = await run(inp(), []); assert.equal(first.status, 'NOT_FOUND'); assert.ok(first.retry_after > NOW);
  const later = await run(inp(), [cand()], { now: first.retry_after + 1 }); assert.equal(later.status, 'VERIFIED');
});
test('既存非空欄は保護(VERIFIED/EXISTING_PROTECTED)、補完提案は空欄のみ・上書きしない', async () => {
  const r = await run(inp({ existing: { spotify: SP('KEEP') } }), [cand()]); assert.equal(r.status, 'PRESERVED'); assert.equal(r.reason, 'PRESERVED_UNVERIFIED'); assert.equal(r.url, SP('KEEP'));
  const v = await run(inp(), [cand()]);
  assert.deepEqual(planFills([v], {}).map((f) => f.url), [SP('A1')]);
  assert.deepEqual(planFills([v], { 'EP-06642|spotify': SP('OLD') }), [], '非空欄は上書き提案しない');
  assert.deepEqual(planFills([r], {}), [], '既存保護は提案対象外');
});
test('強ID(GUID)一致は題名・日付が違っても確定。GUID違い(配信先GUIDが異なる)は題名+日付+番組で確定', async () => {
  const s1 = await run(inp(), [cand({ guid: 'GUID-1', title: '改題されたタイトル', publishedAt: '2026-11-01' })]); assert.equal(s1.status, 'VERIFIED'); assert.equal(s1.reason, 'STRONG_ID');
  const s2 = await run(inp(), [cand({ guid: 'other-guid' })]); assert.equal(s2.reason, 'TITLE_DATE_SHOW');
});
test('同名異話(別日)・日付ずれ・別番組・改題・再配信は誤確定せずHOLD/NOT_FOUND', async () => {
  assert.equal((await run(inp(), [cand({ publishedAt: '2026-06-01' })])).reason, 'TITLE_ONLY_DATE_MISMATCH');
  assert.equal((await run(inp(), [cand({ showId: 'OTHER' })])).status, 'NOT_FOUND');
  const ren = await run(inp(), [cand({ title: '第5回 お茶の話（改題版）' })]); assert.equal(ren.status, 'HOLD'); assert.equal(ren.reason, 'SIMILAR_ONLY_RENAMED_OR_EDITED');
  const re = await run(inp({ title: '（再）第5回 お茶の話' }), [cand({ title: '（再）第5回 お茶の話' })]); assert.equal(re.status, 'HOLD'); assert.equal(re.reason, 'REDISTRIBUTION_RISK_NEEDS_STRONG_ID');
  const two = await run(inp(), [cand(), cand({ url: SP('A2'), externalId: 'A2' })]); assert.equal(two.reason, 'AMBIGUOUS_MULTIPLE_MATCH');
  assert.equal((await run(inp({ title: '第15回' }), [cand({ title: '第16回' })])).status, 'NOT_FOUND', '#15と#16を混同しない');
});
test('タイトルだけでは確定しない(日付不一致)・タイムゾーン許容(UTC↔JST日付跨ぎ)', async () => {
  assert.ok(dateCompatible('2026-11-08 05:00', '2026-11-07', 'day')); assert.ok(!dateCompatible('2026-11-08 05:00', '2026-11-12', 'day'));
  assert.ok(dateCompatible('2026-11-08 05:00', '2026-11-07T20:30:00Z', 'time')); assert.equal(normTitle('（MT）なんでも　話せる'), normTitle('(ＭＴ)なんでも話せる'));
});
test('429: Retry-After尊重・共有クールダウンで同一社の後続EPは呼ばれずERROR(COOLDOWN)・他社は継続', async () => {
  let calls = 0; const gate = new CooldownGate();
  const fetchers = { spotify: { candidates: async () => { calls++; throw new FetchError('RATE_LIMIT', 429, 120); } }, apple: { candidates: async () => ({ candidates: [] }) } };
  const a = await resolveOne(inp(), 'spotify', { fetchers, gate, now: NOW }); const b = await resolveOne(inp({ epId: 'EP-2' }), 'spotify', { fetchers, gate, now: NOW });
  assert.equal(a.reason, 'HTTP_429'); assert.ok(a.retry_after >= NOW + 120e3); assert.equal(b.reason, 'COOLDOWN'); assert.equal(calls, 1);
  assert.equal((await resolveOne(inp(), 'apple', { fetchers, gate, now: NOW })).status, 'NOT_FOUND');
  const after = await resolveOne(inp(), 'spotify', { fetchers: fxr([cand()]), gate, now: a.retry_after + 1 }); assert.equal(after.status, 'VERIFIED');
});
test('404=NOT_FOUND(再探索)、5xx/タイムアウト=ERROR+指数バックオフ、権限系=ERROR(HTTP_403)', async () => {
  const mk = (e) => ({ spotify: { candidates: async () => { throw e; } } });
  assert.equal((await resolveOne(inp(), 'spotify', { fetchers: mk(classifyHttp(404)), now: NOW })).status, 'NOT_FOUND');
  const e1 = await resolveOne(inp(), 'spotify', { fetchers: mk(classifyHttp(503)), now: NOW }); const e2 = await resolveOne(inp(), 'spotify', { fetchers: mk(classifyHttp(0)), now: NOW, attempts: 3 });
  assert.equal(e1.status, 'ERROR'); assert.equal(e1.reason, 'TRANSIENT'); assert.ok(e2.retry_after > e1.retry_after, 'attemptsで伸びる');
  assert.equal((await resolveOne(inp(), 'spotify', { fetchers: mk(classifyHttp(403)), now: NOW })).reason, 'AUTH_403');
  assert.ok(retryAfter({ kind: 'NOT_FOUND', now: NOW, ageDays: 1 }) < retryAfter({ kind: 'NOT_FOUND', now: NOW, ageDays: 400 }));
});
test('経路なし(LISTEN/Amazon/PocketCasts/Pody等)は成功扱いせず ERROR:NO_VERIFIED_ROUTE', async () => {
  const r = await resolveOne(inp(), 'amazon', { fetchers: {}, now: NOW }); assert.equal(r.status, 'ERROR'); assert.equal(r.reason, 'NO_VERIFIED_ROUTE');
});
test('冪等再実行: 同一入力2回で提案重複0、state引継ぎで再試行時刻前はスキップ', async () => {
  const inputs = [inp()]; const f = fxr([cand()]);
  const a = await runBot(inputs, { fetchers: f, now: NOW, platforms: ['spotify'] }); const b = await runBot(inputs, { fetchers: f, now: NOW, platforms: ['spotify'] });
  assert.deepEqual(planFills([...a.records, ...b.records], {}).length, 1);
  const nf = await runBot(inputs, { fetchers: fxr([]), now: NOW, platforms: ['spotify'] }); const st = nextState({}, nf.records);
  const skipped = await runBot(inputs, { fetchers: fxr([cand()]), now: NOW + 1000, state: st, platforms: ['spotify'] }); assert.equal(skipped.records.length, 0);
  const again = await runBot(inputs, { fetchers: fxr([cand()]), now: st['EP-06642|spotify'].retry_after + 1, state: st, platforms: ['spotify'] }); assert.equal(again.records[0].status, 'VERIFIED');
  assert.equal(nextState(st, again.records)['EP-06642|spotify'], undefined, '成功でstate解除');
});
test('新着優先・過去欠損は低負荷バックフィル上限', async () => {
  const inputs = [inp({ epId: 'NEW', publishedAt: '2026-11-09 05:00' }), ...[1, 2, 3].map((n) => inp({ epId: `OLD${n}`, publishedAt: `2025-01-0${n} 05:00` }))];
  const r = await runBot(inputs, { fetchers: fxr([]), now: NOW, platforms: ['spotify'], backfillLimit: 1 });
  assert.deepEqual(r.records.map((x) => x.ep_id), ['NEW', 'OLD3']);
});
test('レポート: API呼出0・補完0を成功扱いにせず警告、未検証経路を明示、前日差', async () => {
  const inputs = [inp()]; const r = await runBot(inputs, { fetchers: {}, now: NOW }); const rep = buildReport(inputs, r, { now: NOW });
  assert.ok(rep.warnings.some((w) => /spotify.*API呼出0/.test(w))); assert.ok(rep.warnings.some((w) => /未検証/.test(w))); assert.equal(rep.platforms.spotify.newlyVerified, 0);
  const r2 = await runBot(inputs, { fetchers: fxr([cand()]), now: NOW, platforms: ['spotify'] }); const rep2 = buildReport(inputs, r2, { previous: rep, now: NOW });
  assert.equal(rep2.platforms.spotify.delta.VERIFIED, 1); assert.equal(rep2.platforms.spotify.newlyVerified, 1);
});
test('Spotifyアダプタ: ページネーション全件、429はRetry-After保持、トークンは注入側のみ', async () => {
  const pages = { 'https://api.spotify.com/v1/shows/S1/episodes?market=JP&limit=50': { next: 'p2', items: [{ id: 'A', name: 'a', release_date: '2026-11-08', release_date_precision: 'day', external_urls: { spotify: SP('A') } }] }, p2: { next: null, items: [{ id: 'B', name: 'b', release_date: '2026-11-07', release_date_precision: 'day', external_urls: { spotify: SP('B') } }] } };
  const ad = spotifyAdapter(async (u) => ({ status: 200, json: pages[u] }));
  const c = await ad.candidates({ showUrls: { spotify: 'https://open.spotify.com/show/S1' } }); assert.deepEqual(c.candidates.map((x) => x.externalId), ['A', 'B']);
  const lim = spotifyAdapter(async () => ({ status: 429, headers: { 'retry-after': '77' } }));
  await assert.rejects(lim.candidates({ showUrls: { spotify: 'https://open.spotify.com/show/S1' } }), (e) => e.kind === 'RATE_LIMIT' && e.retryAfterSec === 77);
  assert.deepEqual((await ad.candidates({ showUrls: {} })).candidates, []);
});
test('Appleアダプタ: 番組IDからエピソード単位(?i=)で照合、番組URLは候補から除外', async () => {
  const ad = appleAdapter(async () => ({ status: 200, json: { results: [{ wrapperType: 'track', kind: 'podcast', collectionViewUrl: 'https://podcasts.apple.com/jp/podcast/x/id99' }, { wrapperType: 'podcastEpisode', trackName: '第5回 お茶の話', releaseDate: '2026-11-07T20:00:00Z', trackViewUrl: 'https://podcasts.apple.com/jp/podcast/x/id99?i=1000', episodeGuid: 'guid-1', trackId: 1000, collectionId: 99 }] } }));
  const i = inp({ showUrls: { apple: 'https://podcasts.apple.com/jp/podcast/x/id99' } });
  const r = await resolveOne(i, 'apple', { fetchers: { apple: ad }, now: NOW }); assert.equal(r.status, 'VERIFIED'); assert.equal(r.reason, 'STRONG_ID'); assert.match(r.url, /\?i=1000/);
});
test('#265: EP-06642〜06644の他列を変更しない(提案は空欄セルのURLのみ、台帳CSV不変、write:false)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-')); const row = (id, extra = {}) => { const r = new Array(55).fill(''); r[0] = id; r[1] = 'ポッドキャスト茶会'; r[2] = `第${id.slice(-1)}回 お茶の話`; r[3] = '2026-11-08 05:00'; r[6] = `g-${id}`; r[21] = '原文'; r[22] = '清掃'; r[45] = '山田'; r[50] = '根拠'; Object.assign(r, extra); return r.join(','); };
  const csvPath = path.join(d, 'l.csv'); fs.writeFileSync(csvPath, ['h', row('EP-06642'), row('EP-06643', { 11: SP('KEEP') }), row('EP-06644')].join('\n') + '\n'); const before = fs.readFileSync(csvPath, 'utf8');
  fs.writeFileSync(path.join(d, 'f.json'), JSON.stringify({ showUrls: { 'ポッドキャスト茶会': { spotify: 'https://open.spotify.com/show/7dDe6pPYCdUUDQ2AL40xtE' } }, candidates: { spotify: { 'EP-06642': { candidates: [{ url: SP('N2'), title: '第2回 お茶の話', publishedAt: '2026-11-08', precision: 'day', externalId: 'N2', showId: '7dDe6pPYCdUUDQ2AL40xtE' }] }, 'EP-06643': { candidates: [{ url: SP('X'), title: '第3回 お茶の話', publishedAt: '2026-11-08', precision: 'day', showId: '7dDe6pPYCdUUDQ2AL40xtE' }] }, 'EP-06644': { error: 429, retryAfter: 90 } } } }));
  const out = path.join(d, 'o'); const cliEnv = { ...process.env, BOT_RESTRICT_PATHS: '' }; execFileSync('node', ['scripts/platform-url-bot.mjs', '--ledger', csvPath, '--fixtures', path.join(d, 'f.json'), '--out', out, '--now', '2026-11-10T00:00:00Z'], { stdio: 'pipe', env: cliEnv });
  assert.equal(fs.readFileSync(csvPath, 'utf8'), before, '入力CSV不変');
  const props = JSON.parse(fs.readFileSync(path.join(out, 'proposals.json'))); assert.deepEqual(props.map((p) => `${p.ep_id}|${p.platform}|${p.url}`), [`EP-06642|spotify|${SP('N2')}`]); assert.ok(props.every((p) => p.write === false));
  const man = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'))); assert.equal(man.write, false); assert.equal(man.readOnly, true);
  const st = JSON.parse(fs.readFileSync(path.join(out, 'state.json'))); assert.ok(st['EP-06644|spotify'].retry_after > Date.parse('2026-11-10T00:00:00Z'));
  const rep = JSON.parse(fs.readFileSync(path.join(out, 'report.json'))); assert.ok(rep.warnings.some((w) => /未検証/.test(w)));
});

import { parseRetryAfter, showIdFromUrl, STATUS } from '../scripts/lib/platform-resolver.mjs';
test('P0-2 Spotify打ち切り: truncated なら題名+日付の唯一一致でもVERIFIEDにせずHOLD(再開カーソル付き)。強IDは可', async () => {
  const f = (guid) => ({ spotify: { candidates: async () => ({ candidates: [cand({ guid })], truncated: true, resumeCursor: 'https://api.spotify.com/v1/shows/S1/episodes?offset=2000' }) } });
  const r = await resolveOne(inp(), 'spotify', { fetchers: f('x'), now: NOW }); assert.equal(r.status, 'HOLD'); assert.equal(r.reason, 'INCOMPLETE_CANDIDATE_SET'); assert.ok(r.evidence.some((e) => /resume-cursor:https/.test(e))); assert.ok(r.retry_after > NOW);
  assert.equal((await resolveOne(inp(), 'spotify', { fetchers: { spotify: { candidates: async () => ({ candidates: [], truncated: true }) } }, now: NOW })).status, 'HOLD', '打切りで0件でもNOT_FOUNDと断定しない');
  assert.equal((await resolveOne(inp(), 'spotify', { fetchers: f('GUID-1'), now: NOW })).reason, 'STRONG_ID');
  const pages = []; const ad = spotifyAdapter(async (u) => { pages.push(u); return { status: 200, json: { next: u + 'N', items: [] } }; }, { maxPages: 3 });
  const c = await ad.candidates({ showUrls: { spotify: 'https://open.spotify.com/show/S1' } }); assert.equal(c.truncated, true); assert.equal(pages.length, 3); assert.ok(c.resumeCursor);
  const resumed = []; await spotifyAdapter(async (u) => (resumed.push(u), { status: 200, json: { items: [] } })).candidates({ showUrls: { spotify: 'https://open.spotify.com/show/S1' }, cursors: { spotify: 'CURSOR' } }); assert.deepEqual(resumed, ['CURSOR']);
});
test('P0-3 既存URLは PRESERVED(形式確認のみ)でVERIFIEDと区別され、VERIFIED件数に入らない', async () => {
  assert.ok(STATUS.includes('PRESERVED'));
  const inputs = [inp({ existing: { spotify: SP('KEEP') } })]; const r = await runBot(inputs, { fetchers: {}, now: NOW, platforms: ['spotify'] });
  const rep = buildReport(inputs, r, { now: NOW }); assert.equal(rep.platforms.spotify.VERIFIED, 0); assert.equal(rep.platforms.spotify.PRESERVED_UNVERIFIED, 1);
});
test('P0-4 番組同一性: 番組IDが片側でも欠けたら題名+日付の一致でVERIFIEDにせずHOLD', async () => {
  assert.equal((await run(inp({ showIds: {} }), [cand()])).reason, 'SHOW_IDENTITY_UNPROVEN');
  assert.equal((await run(inp(), [cand({ showId: '' })])).reason, 'SHOW_IDENTITY_UNPROVEN');
  assert.equal((await run(inp({ showIds: {} }), [cand({ guid: 'GUID-1' })])).reason, 'STRONG_ID', '独立の強い証拠があれば可');
  assert.equal((await run(inp(), [cand()])).status, 'VERIFIED');
  assert.equal(showIdFromUrl('spotify', 'https://open.spotify.com/show/7dDe6p'), '7dDe6p'); assert.equal(showIdFromUrl('apple', 'https://podcasts.apple.com/jp/podcast/x/id99'), '99');
});
test('P0-5 Retry-After(秒/HTTP-date)・runを跨ぐクールダウンstate・401/403(AUTH)と5xx(TRANSIENT)の分離', async () => {
  assert.equal(parseRetryAfter('120', NOW), 120); assert.equal(parseRetryAfter(new Date(NOW + 90e3).toUTCString(), NOW), 90); assert.equal(parseRetryAfter('garbage', NOW), null);
  const lim = spotifyAdapter(async () => ({ status: 429, headers: { 'retry-after': new Date(Date.now() + 300e3).toUTCString() } }));
  await assert.rejects(lim.candidates({ showUrls: { spotify: 'https://open.spotify.com/show/S1' } }), (e) => e.kind === 'RATE_LIMIT' && e.retryAfterSec >= 290 && e.retryAfterSec <= 300);
  let calls = 0; const f = { spotify: { candidates: async () => { calls++; throw new FetchError('RATE_LIMIT', 429, 600); } } };
  const run1 = await runBot([inp()], { fetchers: f, now: NOW, platforms: ['spotify'] }); const st = nextState({}, run1.records, run1.cooldown);
  assert.ok(st.__cooldown.spotify > NOW);
  const run2 = await runBot([inp({ epId: 'EP-9', publishedAt: '2026-11-09 05:00' })], { fetchers: f, now: NOW + 60e3, state: st, platforms: ['spotify'] });
  assert.equal(calls, 1, '別runでもクールダウン中は呼ばない'); assert.equal(run2.records[0].reason, 'COOLDOWN');
  const auth = await resolveOne(inp(), 'spotify', { fetchers: { spotify: { candidates: async () => { throw classifyHttp(401); } } }, now: NOW, gate: new CooldownGate() });
  assert.equal(auth.reason, 'AUTH_401'); assert.ok(auth.evidence.some((e) => /fatal/.test(e))); assert.ok(auth.retry_after - NOW >= 6 * 3600e3);
  const tr = await resolveOne(inp(), 'spotify', { fetchers: { spotify: { candidates: async () => { throw classifyHttp(502); } } }, now: NOW }); assert.equal(tr.reason, 'TRANSIENT'); assert.ok(tr.retry_after - NOW < 3600e3);
  const rep = buildReport([inp()], { records: [auth], apiCalls: { spotify: 1 } }, { now: NOW }); assert.ok(rep.warnings.some((w) => /認証\/権限/.test(w)));
});
test('P0-1 Actions注入対策: runに inputs を展開せず env経由・bash配列、CLIは危険なパス(シェル文字/絶対/..)を拒否', () => {
  const wf = fs.readFileSync('.github/workflows/platform-url-bot-dryrun.yml', 'utf8');
  const runBlocks = wf.split(/\n/).filter((l) => /^\s*(- )?run:/.test(l) || /^\s{10,}\S/.test(l) && !/^\s*(IN_|BOT_)/.test(l));
  assert.ok(!runBlocks.some((l) => /\$\{\{\s*inputs\./.test(l)), 'run行にinputs直接展開なし'); assert.match(wf, /IN_LEDGER: \$\{\{ inputs\.ledger_csv \}\}/); assert.match(wf, /args\+=\(--fixtures "\$IN_FIXTURES"\)/); assert.match(wf, /"\$\{args\[@\]\}"/);
  const bad = ['x.csv"; touch /tmp/pwned #', '$(touch /tmp/pwned).csv', '`id`.csv', 'a b.csv', '../secret.csv', '/etc/passwd', '-rf.csv', 'a.csv\nb', "a'.csv"];
  for (const b of bad) { let code = 0; try { execFileSync('node', ['scripts/platform-url-bot.mjs', '--ledger', b, '--out', 'out'], { stdio: 'pipe', env: { ...process.env, BOT_RESTRICT_PATHS: '1' } }); } catch (e) { code = e.status; } assert.equal(code, 2, b); }
  assert.ok(!fs.existsSync('/tmp/pwned'));
});

test('回帰(continue): retry_after前のEP×社は呼び出されずスキップ、他のEP/社は処理される', async () => {
  let calls = []; const f = { spotify: { candidates: async (i) => { calls.push(i.epId); return { candidates: [] }; } } };
  const st = { 'EP-A|spotify': { attempts: 1, retry_after: NOW + 3600e3 } };
  const r = await runBot([inp({ epId: 'EP-A' }), inp({ epId: 'EP-B' })], { fetchers: f, now: NOW, state: st, platforms: ['spotify'] });
  assert.deepEqual(calls, ['EP-B']); assert.deepEqual(r.records.map((x) => x.ep_id), ['EP-B']);
});
test('再開カーソルの実効性: 打切りHOLDのカーソルがstateに保存され、次回runでアダプタが続きから取得し確定できる', async () => {
  const P1 = 'https://api.spotify.com/v1/shows/S1/episodes?market=JP&limit=50', P2 = 'https://api.spotify.com/v1/shows/S1/episodes?offset=100';
  const pages = { [P1]: { next: P2, items: [{ id: 'X', name: '別の回', release_date: '2026-01-01', release_date_precision: 'day', external_urls: { spotify: SP('X') } }] }, [P2]: { next: null, items: [{ id: 'T', name: '第5回 お茶の話', release_date: '2026-11-08', release_date_precision: 'day', external_urls: { spotify: SP('T') } }] } };
  const fetched = []; const ad = spotifyAdapter(async (u) => (fetched.push(u), { status: 200, json: pages[u] }), { maxPages: 1 });
  const i = inp({ showUrls: { spotify: 'https://open.spotify.com/show/S1' } });
  const r1 = await runBot([i], { fetchers: { spotify: ad }, now: NOW, platforms: ['spotify'] });
  assert.equal(r1.records[0].reason, 'INCOMPLETE_CANDIDATE_SET'); assert.equal(r1.records[0].resume_cursor, P2);
  const st = nextState({}, r1.records, r1.cooldown); assert.equal(st['EP-06642|spotify'].resume_cursor, P2);
  const r2 = await runBot([i], { fetchers: { spotify: ad }, now: st['EP-06642|spotify'].retry_after + 1, state: st, platforms: ['spotify'] });
  assert.equal(fetched.at(-1), P2, '続きのページから取得'); assert.equal(r2.records[0].status, 'VERIFIED'); assert.equal(r2.records[0].url, SP('T'));
});
