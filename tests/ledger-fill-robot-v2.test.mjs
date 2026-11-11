// 第50号: マニフェスト v2（EP-ID+GUID キー）と、重複・行移動に対するロボットの安全性テスト。台帳本文は使わない（合成データのみ）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildManifest } from '../scripts/ledger-fill-robot/build-manifest-v2.mjs';

const sandbox = { module: { exports: {} }, console };
vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/LedgerFillRobot.js', 'utf8'), sandbox);
const R = sandbox.module.exports;

const G = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = (n) => `https://listen.style/p/abcd1234/${String(n).padStart(8, '0').replace(/[0-9]/g, (d) => 'abcdefghij'[d])}`;
const EP = (n) => 'EP-' + String(n).padStart(5, '0');
const HDR = ['台帳ID', '番組名', 'タイトル', '配信日時（JST）', '媒体', '取得元', '外部ID', '所属ID', '元ページURL', '公式個別URL', 'LISTEN URL'];
// 台帳行（A..K）。guidは J列 itemid に入れる
function row(n, o = {}) {
  const r = [EP(n), o.show || 'MEDIA TALK', 't', o.date || '2026/1/10 04:00', '', '', o.g || '', '', '', o.j === undefined ? `https://www.asahi.com/special/podcasts/item/?itemid=${G(o.guidN || n)}` : o.j, o.k || ''];
  return r;
}
function fixture(spec) {
  const ledger = [HDR], judge = [['掲載判定', '除外・保留理由']], scope = [['EP-ID', '番組名', '', '', '判定区分', '', '代表EP-ID']];
  const items = [];
  spec.forEach((o) => {
    const n = o.n; ledger.push(row(n, o)); judge.push([o.bd || '対象', '']);
    scope.push([EP(n), o.show || 'MEDIA TALK', '対象', '対象', o.se || '通常', '', o.rep || EP(n)]);
    if (!o.noRss) items.push([o.rssGuid || G(o.guidN || n), o.rssUrl || U(n), o.rssDate || 'Fri, 09 Jan 2026 19:00:00 +0000']);
  });
  const sdgs = [['omny', '', '', '', '', '', '', '', '', '', '', '', 'Asahi.com URL', '', '', '', '', '', '公式JSON UUID【新規・赤字】']];
  return { ledger, judge, scope, sdgs, rss: { listen: { 'MEDIA TALK': { all: items } } }, runId: 't', max: 1000, hold: ['EP-00099'] };
}
const ids = (m) => m.cells.map((c) => c.epId);

test('v2生成: 有効EP(対象)のみ・既存K非空は上書きしない・対象外/保留/未判定/HOLDを除外', () => {
  const f = fixture([{ n: 1 }, { n: 2, k: 'https://listen.style/p/abcd1234/zzzzzzzz' }, { n: 3, bd: '対象外' }, { n: 4, bd: '保留' }, { n: 5, bd: '未判定' }, { n: 99 }, { n: 6, se: '再配信' }]);
  const { batches, report } = buildManifest(f);
  assert.deepEqual(ids(batches[0]), [EP(1)]);
  assert.equal(report.excluded.K_NON_EMPTY_KEEP, 1);
  assert.equal(report.excluded['NOT_ELIGIBLE_対象外'], 1);
  assert.equal(report.excluded['NOT_ELIGIBLE_保留'], 1);
  assert.equal(report.excluded['NOT_ELIGIBLE_未判定'], 1);
  assert.equal(report.excluded.HOLD_LIST, 1);
  assert.equal(report.excluded.SCOPE_NOT_NORMAL, 1);
});

test('v2生成: 重複GUID行は厳格版から除外し、他行が全て非対象ならレビュー一覧にだけ載せる', () => {
  const f = fixture([{ n: 1 }, { n: 2, guidN: 1, bd: '対象外', show: 'ニュースの現場から', noRss: true }, { n: 3 }, { n: 4, guidN: 3, noRss: true }]);
  const { batches, report, review } = buildManifest(f);
  assert.equal(batches.length, 0);
  assert.equal(report.excluded.GUID_DUP_IN_LEDGER, 3);              // EP1(相手は対象外)・EP3とEP4(互いに対象)
  assert.deepEqual(review.map((x) => x.epId), [EP(1)]);              // 相手も「対象」の EP3 はレビューにも載せない
});

test('v2生成: RSS番組不一致・日付±1日超・既使用URL・RSS内GUID重複・URL形状不正・GUID無しを除外', () => {
  const f = fixture([
    { n: 1, rssDate: 'Mon, 12 Jan 2026 19:00:00 +0000' },               // JST 1/13 vs 台帳 1/10 → 3日差
    { n: 2, rssUrl: U(9) }, { n: 9, k: U(9), noRss: true },             // URL既にK使用
    { n: 3, rssUrl: 'https://listen.style/p/abcd1234' },                // 形状不正
    { n: 4, j: '', g: '' , noRss: true },                               // GUID無し
    { n: 5 }, { n: 6 },
  ]);
  f.rss.listen['MEDIA TALK'].all.push([G(6), U(66), 'Fri, 09 Jan 2026 19:00:00 +0000']);   // RSS内 GUID 重複
  f.rss.listen['ニュースの現場から'] = { all: [[G(5), U(5), 'Fri, 09 Jan 2026 19:00:00 +0000']] };
  f.rss.listen['MEDIA TALK'].all = f.rss.listen['MEDIA TALK'].all.filter((x) => x[0] !== G(5));  // EP5 は別番組RSSにだけある
  const { batches, report } = buildManifest(f);
  assert.equal(batches.length, 0);
  for (const k of ['DATE_OVER_1DAY', 'URL_ALREADY_IN_K', 'BAD_URL_SHAPE', 'NO_GUID', 'SHOW_MISMATCH', 'RSS_GUID_DUP']) assert.equal(report.excluded[k], 1, k);
});

test('v2生成: SDGs行は SDGs1095 正本で照合し補填対象外、SDGs1095 と GUID が衝突する他番組行は HOLD', () => {
  const f = fixture([{ n: 1, show: 'SDGsを話そう', noRss: true }, { n: 2 }]);
  f.sdgs.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', G(1)], ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', G(2)]);
  const { batches, report } = buildManifest(f);
  assert.equal(batches.length, 0);
  assert.equal(report.excluded.SDGS_NO_LISTEN_FEED, 1);
  assert.equal(report.excluded.GUID_IN_SDGS1095, 1);
  assert.equal(report.sdgsCheck.inSdgs1095, 1);
});

test('v2生成: 行番号を出力しない・同じ入力なら同じsha256（固定マニフェスト）・バッチ分割', () => {
  const spec = Array.from({ length: 25 }, (_, i) => ({ n: i + 1 }));
  const a = buildManifest({ ...fixture(spec), max: 10 }), b = buildManifest({ ...fixture(spec), max: 10 });
  assert.deepEqual(a.batches.map((m) => m.cells.length), [10, 10, 5]);
  assert.deepEqual(a.batches.map((m) => m.sha256), b.batches.map((m) => m.sha256));
  assert.ok(a.batches.every((m) => m.cells.every((c) => !('row' in c) && c.guid && c.epId)));
  assert.equal(a.batches[0].keyPolicy, 'EPID+GUID');
  assert.equal(R.validateManifest(a.batches[0]).length, 0);   // vm内の配列なので長さで比較
});

test('v2生成: 台帳V2で列順が変わったら見出し確認で停止（誤った列を読まない）', () => {
  const f = fixture([{ n: 1 }]);
  f.ledger[0] = [...f.ledger[0]]; f.ledger[0][10] = 'Spotify個別URL';
  assert.throws(() => buildManifest(f), /HEADER_MISMATCH/);
});

// ---- ロボット側（行移動・重複） ----
function mkLive(rows) {           // rows: [{ep, guid, k}]
  const A = ['台帳ID'], G_ = ['外部ID'], J = ['公式個別URL'], K = ['LISTEN'];
  rows.forEach((r) => { A.push(r.ep); G_.push(''); J.push(r.guid ? `https://x/?itemid=${r.guid}` : ''); K.push(r.k || ''); });
  return { A, G: G_, J, K };
}
function mkAdapter(sheet) {
  const st = { writes: 0, props: {}, locked: false };
  return {
    st,
    readColumn: (c) => [...sheet[c]],
    writeCells(cells) { st.writes++; cells.forEach((u) => { sheet[u.col][u.row - 1] = u.value; }); },
    lock: { tryLock() { if (st.locked) return false; st.locked = true; return true; }, release() { st.locked = false; } },
    props: { get: (k) => st.props[k] ?? null, set: (k, v) => { st.props[k] = v; } },
    sleep() {}, nowMs: () => Date.now(), random: () => 0.5,
  };
}
const v2m = (ns) => ({ runId: 'v2', urlShape: 'listen', keyPolicy: 'EPID+GUID', guidCheck: { columns: ['G', 'J'] }, holdEpIds: [], approval: { issue: '283', columns: ['K'], maxCells: 1000, sheet: 'エピソード台帳' }, cells: ns.map((n) => ({ epId: EP(n), guid: G(n), column: 'K', expectedOld: '', url: U(n) })) });
const toTable = (sh) => sh.A.map((a, i) => [a, '', '', '', '', '', sh.G[i], '', '', sh.J[i], sh.K[i]]);

test('行移動: マニフェスト生成後に行が挿入・並べ替えされても、EP-IDで再解決して正しい行へ書く', () => {
  const sheet = mkLive([{ ep: EP(1), guid: G(1) }, { ep: EP(2), guid: G(2) }, { ep: EP(3), guid: G(3) }]);
  // 生成後に新着2行が先頭に挿入され、EP3とEP1の順序も入れ替わった
  const moved = mkLive([{ ep: EP(10), guid: G(10) }, { ep: EP(11), guid: G(11) }, { ep: EP(3), guid: G(3) }, { ep: EP(2), guid: G(2) }, { ep: EP(1), guid: G(1) }]);
  const pre = toTable(moved).map((r) => [...r]);
  const res = R.run(v2m([1, 2, 3]), mkAdapter(moved), 'WRITE');
  assert.equal(res.status, 'COMPLETE');
  assert.equal(res.counts.written, 3);
  assert.equal(moved.K[5], U(1)); assert.equal(moved.K[3], U(3)); assert.equal(moved.K[4], U(2));
  assert.equal(moved.K[1], ''); assert.equal(moved.K[2], '');
  const audit = R.auditDiffByEp(pre, toTable(moved), v2m([1, 2, 3]));
  assert.equal(audit.unexpected, 0); assert.equal(audit.changed, 3);
  void sheet;
});

test('行移動: EP-IDの行のGUIDが違う（取り違え・行ずれ）なら書かない', () => {
  const sh = mkLive([{ ep: EP(1), guid: G(7) }, { ep: EP(2), guid: G(2) }]);
  const res = R.run(v2m([1, 2]), mkAdapter(sh), 'WRITE');
  assert.equal(res.counts.written, 1);
  assert.equal(JSON.stringify(res.skips.map((x) => x.s)), JSON.stringify(['SKIP_GUID_MISMATCH']));
  assert.equal(sh.K[1], '');
});

test('重複: 行移動後に同じEP-IDが2行になったら書かない（SKIP_EPID）', () => {
  const sh = mkLive([{ ep: EP(1), guid: G(1) }, { ep: EP(1), guid: G(1) }, { ep: EP(2), guid: G(2) }]);
  const res = R.run(v2m([1, 2]), mkAdapter(sh), 'WRITE');
  assert.equal(res.counts.written, 1);
  assert.equal(res.skips[0].why, 'EPID_MULTI');
  assert.equal(sh.K[1], ''); assert.equal(sh.K[2], '');
});

test('EP-ID基準監査: 行移動は誤検知せず、他セル変更・行の消失を検出', () => {
  const before = toTable(mkLive([{ ep: EP(1), guid: G(1) }, { ep: EP(2), guid: G(2) }]));
  const after = toTable(mkLive([{ ep: EP(2), guid: G(2) }, { ep: EP(1), guid: G(1), k: U(1) }]));
  assert.equal(R.auditDiffByEp(before, after, v2m([1])).unexpected, 0);
  after[1][2] = 'changed';                                               // EP2 のC列が変わった
  const bad = R.auditDiffByEp(before, after.slice(0, 2), v2m([1]));       // EP1 行が消えた
  assert.ok(bad.unexpectedCells.includes(EP(1) + ':MISSING_AFTER'));
  assert.ok(bad.unexpectedCells.includes(EP(2) + ':2'));
});

test('v2検証: keyPolicy=EPID+GUID なのに guidCheck 無し / GUID形式不正 は拒否', () => {
  const m = v2m([1]); delete m.guidCheck; m.cells[0].guid = 'abc';
  const e = R.validateManifest(m);
  assert.ok(e.includes('NO_GUID_CHECK_COLUMNS')); assert.ok(e.some((x) => x.startsWith('BAD_GUID')));
});

test('GAS入口のハッシュ照合: digestInput の sha256 が生成時の sha256 と一致（整形保存・再読込後も）', async () => {
  const crypto = await import('node:crypto');
  const { batches } = buildManifest({ ...fixture([{ n: 1 }, { n: 2 }]), spreadsheetId: 'COPY-ID' });
  const reread = JSON.parse(JSON.stringify(batches[0], null, 1));
  const h = crypto.createHash('sha256').update(R.digestInput(reread), 'utf8').digest('hex');
  assert.equal(h, batches[0].sha256);
  assert.equal(batches[0].approval.spreadsheetId, 'COPY-ID');
});
