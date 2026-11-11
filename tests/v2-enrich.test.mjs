// 第2段階 接続口のテスト（合成データ）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm';
import { toResolverInputs, toUrlStateRows, planLinkFills, planSummaryCleaning, planCastAndRelated, pendingWork, colLetter } from '../scripts/ledger-v2/v2-enrich.mjs';
const sb = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), sb);
const H = [...sb.module.exports.HEADERS], DH = [...sb.module.exports.DETAIL_HEADERS], C = (n) => H.indexOf(n);
const G = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (ep, o = {}) => { const r = H.map(() => ''); r[C('EP-ID')] = ep; r[C('番組')] = 'MEDIA TALK'; r[C('タイトル')] = 't'; r[C('配信日時 JST')] = '2026/10/12 04:00'; r[C('公式GUID')] = o.guid ?? G(+ep.slice(3)); for (const [k, v] of Object.entries(o.cells || {})) r[C(k)] = v; return r; };
const V = () => [H, row('EP-00001'), row('EP-00002', { cells: { Spotify: 'https://open.spotify.com/episode/OLD', 出演者: '既存' } }), row('EP-00003', { guid: '' })];
const rec = (ep, platform, status, url = '') => ({ ep_id: ep, platform, status, url, reason: status === 'VERIFIED' ? 'STRONG_ID' : 'X', checked_at: '2026-11-11T00:00:00Z', evidence: ['guid-or-external-id-match'], retry_after: null });

test('列文字は見出し位置から計算（34列: LISTEN=V, 公式GUID=H）', () => { assert.equal(colLetter(C('LISTEN')), 'V'); assert.equal(colLetter(C('公式GUID')), 'H'); assert.equal(colLetter(27), 'AB'); });

test('PR #281 resolveOne の入力を V2 から作る（既存6サービスURL・GUID・題・日時）', () => {
  const ins = toResolverInputs(V(), { showUrls: { 'MEDIA TALK': { apple: 'https://podcasts.apple.com/jp/podcast/x/id1' } } });
  assert.equal(ins.length, 3); assert.equal(ins[0].guid, G(1)); assert.equal(ins[1].existing.spotify, 'https://open.spotify.com/episode/OLD'); assert.equal(ins[0].showUrls.apple.includes('id1'), true);
  assert.deepEqual(Object.keys(ins[0].existing).sort(), ['amazon', 'apple', 'listen', 'pocketcasts', 'pody', 'spotify']);
});

test('URL補完: VERIFIED かつ空欄だけ書く計画（LedgerFillRobot互換）。既存と違えば HOLD、未発見/保留は書かず状態だけ記録', () => {
  const recs = [rec('EP-00001', 'listen', 'VERIFIED', 'https://listen.style/p/a/b'), rec('EP-00002', 'spotify', 'VERIFIED', 'https://open.spotify.com/episode/NEW'),
    rec('EP-00002', 'apple', 'NOT_FOUND'), rec('EP-00003', 'pody', 'VERIFIED', 'https://pody.jp/x'), rec('EP-09999', 'listen', 'VERIFIED', 'u'), rec('EP-00001', 'amazon', 'HOLD')];
  const { manifest, hold, skip } = planLinkFills(V(), recs);
  assert.equal(manifest.cells.length, 1); assert.equal(manifest.cells[0].column, 'V'); assert.equal(manifest.cells[0].guid, G(1));
  assert.equal(manifest.keyPolicy, 'EPID+GUID'); assert.deepEqual(manifest.guidCheck.columns, ['H', 'J']);
  assert.deepEqual(hold.map((h) => h.why).sort(), ['EP_NOT_IN_V2', 'EXISTING_URL_DIFFERS', 'NO_GUID']);
  assert.deepEqual(skip.map((x) => x.status).sort(), ['HOLD', 'NOT_FOUND']);
  const st = toUrlStateRows(recs.slice(2, 3), { 'EP-00002': G(2) });
  assert.deepEqual(st[0].slice(0, 5), ['EP-00002', G(2), 'apple', '', '未発見']);
});

test('概要清掃は非破壊: 原文は変えず、清掃結果を別列へ。V2「概要（清掃済）」は空欄のときだけ、違えば HOLD。失敗は記録', () => {
  const det = [DH, ['EP-00001', G(1), 'rss', 'T', '原文\nA', 'h', '4', '未清掃', '', '', '', ''], ['EP-00002', G(2), 'rss', 'T', '原文B', 'h', '3', '未清掃', '', '', '', ''], ['EP-00003', G(3), 'rss', 'T', 'boom', 'h', '4', '未清掃', '', '', '', '']];
  const vals = V(); vals[2][C('概要（清掃済）')] = '人が整えた文';
  const clean = (raw) => { if (raw === 'boom') throw new Error('RULE_ERROR'); return { ok: true, text: raw.replace(/\n/g, ' ') }; };
  const r = planSummaryCleaning(vals, det, clean, 'clean-v1', 'NOW');
  assert.equal(r.ledgerCells.length, 1); assert.equal(r.ledgerCells[0].value, '原文 A'); assert.equal(r.ledgerCells[0].column, colLetter(C('概要（清掃済）')));
  assert.deepEqual(r.hold, [{ ep: 'EP-00002', why: 'CLEANED_DIFFERS_FROM_EXISTING' }]);
  assert.deepEqual(r.detailUpdates.map((u) => u.清掃状態), ['清掃済', '清掃済', '清掃失敗']);
  assert.equal(det[1][4], '原文\nA');                                                       // 原文は不変
  const again = planSummaryCleaning(vals, [DH, ['EP-00001', G(1), '', '', '原文', '', '', '清掃済', 'clean-v1', '', '', '']], clean, 'clean-v1', 'NOW');
  assert.equal(again.detailUpdates.length, 0);                                               // 同じ版は再実行しない（版を上げれば再清掃）
});

test('出演者・関連記事: 確信度が低いもの・既存値がある列は書かない（HOLD）', () => {
  const det = [DH, ['EP-00001', G(1), '', '', '出演: 山田', '', '', '未清掃', '', '', '', ''], ['EP-00002', G(2), '', '', '出演: 佐藤', '', '', '未清掃', '', '', '', '']];
  const r = planCastAndRelated(V(), det, { extractCast: (t) => ({ value: t.replace('出演: ', ''), confidence: t.includes('山田') ? 0.95 : 0.95, basis: '概要原文' }), extractRelated: () => ({ value: 'https://www.asahi.com/articles/X.html', confidence: 0.5 }) });
  assert.deepEqual(r.cells.map((c) => [c.epId, c.header, c.value]), [['EP-00001', '出演者', '山田']]);
  assert.deepEqual(r.hold.map((h) => h.why).sort(), ['EXISTING_VALUE', 'LOW_CONFIDENCE', 'LOW_CONFIDENCE']);
});

test('継続監査: EPごとの未補完一覧（URL未探索/要再確認・原文未取得・未清掃・出演者・関連記事）', () => {
  const det = [DH, ['EP-00001', G(1), '', '', '', 'abc', '120', '原文未取得（長さ・ハッシュのみ確認）', '', '', '', '']];
  const st = [['EP-00001', G(1), 'listen', '', '未発見', '', '', '', ''], ['EP-00001', G(1), 'apple', '', '要再確認', '', '', '', '']];
  const p = pendingWork(V(), det, st);
  const e1 = p.find((x) => x.epId === 'EP-00001').need;
  assert.ok(!e1.includes('URL:listen(未探索)') && e1.includes('URL:apple(要再確認)') && e1.includes('URL:spotify(未探索)'));
  assert.ok(e1.includes('概要原文:原文未取得（長さ・ハッシュのみ確認）'));
  assert.ok(p.find((x) => x.epId === 'EP-00002').need.includes('詳細:未作成'));
  assert.ok(!p.find((x) => x.epId === 'EP-00002').need.includes('出演者'));
});

test('封緘転送: 公開鍵で暗号化→秘密鍵でのみ復号。暗号文に本文が現れない・改ざんは検出', async () => {
  const crypto = await import('node:crypto');
  const { seal, open } = await import('../scripts/ledger-v2/sealed-transfer.mjs');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const obj = { items: { g1: { descriptionRaw: '本文テキスト【関連記事】https://www.asahi.com/articles/X.html' } } };
  const s = seal(obj, publicKey);
  assert.ok(!JSON.stringify(s).includes('本文') && !JSON.stringify(s).includes('asahi'));
  assert.deepEqual(open(s, privateKey), obj);
  const t = { ...s, data: Buffer.from(Buffer.from(s.data, 'base64').map((b, i) => (i === 3 ? b ^ 1 : b))).toString('base64') };
  assert.throws(() => open(t, privateKey));
  assert.ok(fs.readFileSync('scripts/ledger-v2/sealed-transfer.pub.pem', 'utf8').includes('PUBLIC KEY'));
  assert.ok(!fs.readFileSync('.github/workflows/v2-rss-readonly.yml', 'utf8').includes('path: rss-items.json'));   // 本文入りファイルを成果物に出さない
});
