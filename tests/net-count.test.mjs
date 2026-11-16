import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyNet, dayKey, EDIT_DIFF_MAX_SEC } from '../scripts/ledger-v2/net-count.mjs';
import { buildV2Library } from '../scripts/ledger-v2/v2-library-core.mjs';

const R = (o) => Object.assign({ show: 'MEDIA TALK', judge: '対象', rep: '', guid: '', uuid: '', officialUrl: '', duration: '1000', basis: '', reason: '' }, o);
test('おんさ表の UTC 日時を JST の日付にする', () => { assert.equal(dayKey('Thu, 12 Mar 2026 19:00:00 +0000'), '2026/03/13'); assert.equal(dayKey('2026/3/13 4:00'), '2026/03/13'); });
test('未判定はおんさ表と一致し重複がなければ対象案、おんさ表に無ければ保留', () => {
  const v2Rows = [R({ ep: 'EP-00001', title: 'A', date: '2026/10/01 04:00', judge: '未判定', guid: 'aaaaaaaa-0000-0000-0000-000000000001' }), R({ ep: 'EP-00002', title: 'B', date: '2026/10/02 04:00', judge: '未判定', guid: 'aaaaaaaa-0000-0000-0000-000000000002' })];
  const r = classifyNet({ v2Rows, onsaRows: [{ show: 'x', title: 'A', date: 'Wed, 30 Sep 2026 19:00:00 +0000', item: 'aaaaaaaa-0000-0000-0000-000000000001' }] });
  assert.equal(r.rows[0].prop, '対象案'); assert.equal(r.rows[1].prop, '保留'); assert.equal(r.summary.net, 1);
});
test('再配信: 高確度一致かつ尺差が編集差の範囲なら元配信を代表に重複、範囲外・有力候補は保留（推測で除外しない）', () => {
  const v2Rows = [R({ ep: 'EP-00010', title: '元', date: '2021/07/14 05:00' }), R({ ep: 'EP-00020', show: 'SDGsを話そう', title: '（再）元', date: '2021/11/04 04:00' }), R({ ep: 'EP-00021', show: 'SDGsを話そう', title: '（再）別', date: '2021/11/05 04:00' }), R({ ep: 'EP-00022', show: 'SDGsを話そう', title: '（再）三', date: '2021/11/06 04:00' })];
  const rerun185 = [{ ep: 'EP-00020', match: '高確度一致', origin: 'EP-00010', diff: String(EDIT_DIFF_MAX_SEC) }, { ep: 'EP-00021', match: '高確度一致', origin: 'EP-00010', diff: '288' }, { ep: 'EP-00022', match: '有力候補', origin: 'EP-00010', diff: '1' }];
  const r = classifyNet({ v2Rows, onsaRows: [], rerun185 });
  assert.deepEqual(r.rows.map((x) => x.prop), ['対象', '重複案', '保留案', '保留案']); assert.equal(r.rows[1].rep, 'EP-00010');
});
test('対象同士の同題・同日は番組名がタイトルに入っている方を代表にする', () => {
  const v2Rows = [R({ ep: 'EP-00132', show: '報談', title: '（告知）新番組「ドーナツ」', date: '2026/08/17 04:00' }), R({ ep: 'EP-00301', show: 'ドーナツ', title: '（告知）新番組「ドーナツ」', date: '2026/08/17 04:00' })];
  const r = classifyNet({ v2Rows, onsaRows: [] });
  assert.equal(r.rows[0].prop, '重複案'); assert.equal(r.rows[0].rep, 'EP-00301'); assert.equal(r.rows[1].prop, '対象');
});
test('公開データ生成: 正味判定の重複案は除外・保留案は保留（原本の行は残る）', () => {
  const H = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', '公式GUID', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', '再生時間 秒', '音声URL'];
  const row = (id, t) => [id, 'SDGsを話そう', t, '2021/11/04 04:00', '対象', id, 'g-' + id, 'https://www.asahi.com/x', '', '', '', '100', ''];
  const ledger = [H, row('EP-00001', '元'), row('EP-00002', '（再）元'), row('EP-00003', '（再）別')];
  const res = buildV2Library({ ledger, previousPublicIds: new Set(['EP-00001', 'EP-00002', 'EP-00003']), decidedAt: '2026-11-16T00:00:00Z', hash: () => 'a'.repeat(64), netDecisions: { 'EP-00002': { prop: '重複案', rep: 'EP-00001', reason: 't' }, 'EP-00003': { prop: '保留案', reason: 't' } } });
  const pub = Object.fromEntries(res.audit.map((a) => [a.id, a.publication]));
  assert.equal(pub['EP-00001'], '対象'); assert.equal(pub['EP-00002'], '除外'); assert.equal(pub['EP-00003'], '保留'); assert.equal(res.audit.length, 3);
});
test('GAS: 正味_4 は当日承認が無ければ予行だけ、書き込み先は COPY と V2 に限る、おんさ表は開くだけ', () => {
  const src = fs.readFileSync('gas/summary-cleaner/src/CleanerMain.js', 'utf8'), b = src.slice(src.indexOf('// ===== 正味件数'));
  assert.match(b, /NOT_APPROVED_TODAY', dryrun: netApply_\(SC_CONFIG\.v2WorkingId, '', 'V2', true\)/); assert.match(b, /NET_TARGET_REFUSED/); assert.match(b, /CHANGED_SINCE_PLAN/);
  const onsaUse = b.split('NET_ONSA_ID_').length - 1; assert.equal(onsaUse, 2);   // 定義と openById の2か所だけ
});
