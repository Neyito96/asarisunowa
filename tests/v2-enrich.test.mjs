// 第2段階 接続口のテスト（合成データ）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import vm from 'node:vm';
import { v2CleanSummary, CLEAN_VERSION, toResolverInputs, toUrlStateRows, planLinkFills, planSummaryCleaning, planCastAndRelated, pendingWork, colLetter } from '../scripts/ledger-v2/v2-enrich.mjs';
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

test('清掃（既存 editDescription を再利用）: 共通案内・SNS・追跡パラメータを除去、本文の固有名詞は保全、関連記事は見出し＋URLで抽出、出演・スタッフは候補として分離、一行化', () => {
  const raw = '防衛費の議論を、記者が解説します。\n※2026年10月9日に収録しました。\n【関連記事】\n防衛費、過去最大に\nhttps://www.asahi.com/articles/ASV1.html?iref=omny\n【出演・スタッフ】\n山田太郎（編集委員）\n朝日新聞ポッドキャスト（ https://www.asahi.com/special/podcasts/?iref=omny ）では他にも様々な番組を配信、テキストでも読めます。';
  const r = v2CleanSummary(raw);
  assert.equal(r.ok, true); assert.ok(r.text.includes('防衛費の議論を、記者が解説します。')); assert.ok(!r.text.includes('\n'));
  assert.ok(!r.text.includes('では他にも') && !r.text.includes('iref'));
  assert.deepEqual(r.related, [{ title: '防衛費、過去最大に', url: 'https://www.asahi.com/articles/ASV1.html' }]);
  assert.deepEqual(r.staff, ['山田太郎（編集委員）']);
  assert.ok(CLEAN_VERSION.startsWith('P25V2-V3-public-sections'));
  const empty = v2CleanSummary('朝日新聞ポッドキャスト（ https://x ）では他にも様々な番組を配信、テキストでも読めます。');
  assert.equal(empty.ok, false); assert.ok(empty.holds.includes('CONTENT_EMPTY'));
});

test('清掃計画: 収蔵詳細の追加列（清掃済み本文・関連記事・出演者候補・抽出保留）を埋め、原文は不変。同じ版の再実行は差分0', () => {
  const det = [DH, ['EP-00001', G(1), 'rss', 'T', '本文です。\n【関連記事】\n見出し\nhttps://www.asahi.com/articles/A.html', 'h', '9', '未清掃', '', '', '', '', '', '', '', '', '公式RSS直接']];
  const r = planSummaryCleaning(V(), det, v2CleanSummary, CLEAN_VERSION, 'NOW');
  assert.equal(r.detailUpdates.length, 1); const u = r.detailUpdates[0];
  assert.equal(u.清掃状態, '清掃済'); assert.equal(u.清掃済み本文, '本文です。'); assert.equal(JSON.parse(u['関連記事(抽出)'])[0].url, 'https://www.asahi.com/articles/A.html'); assert.equal(JSON.parse(u['関連記事(抽出)'])[0].source, '概要原文');
  const done = det.map((x) => [...x]); done[1][7] = '清掃済'; done[1][8] = CLEAN_VERSION;
  assert.equal(planSummaryCleaning(V(), done, v2CleanSummary, CLEAN_VERSION, 'NOW').detailUpdates.length, 0);
  assert.equal(det[1][4].startsWith('本文です。\n'), true);
});

test('V2追加規則（実データで見つかった取りこぼし）: 出演欄は案内で打ち切り・URL除去、学校型の本文内記事は関連記事へ、共通案内・広告文を除去、配信予定文は文ごと除去', () => {
  const omny = '<p>話題の本文です。</p> <p>※2026年10月5日に収録しました。3人のトークは毎週月曜日に配信します</p> <p>【出演・スタッフ】<br>山田太郎（音源編集）&nbsp;<a href="https://bit.ly/x">https://bit.ly/x</a><br>MC 佐藤花子（編集委員）</p> <p>【おねがい】<br>朝日新聞ポッドキャストは、みなさまからの購読料で配信しています。</p> <p>【朝ポキ情報】<br>交流はdiscord https://bit.ly/d</p><p>See <a href="https://omnystudio.com/listener">omnystudio.com/listener</a> for privacy information.</p>';
  const a = v2CleanSummary(omny);
  assert.equal(a.text, '話題の本文です。 ※2026年10月5日に収録しました。');
  assert.deepEqual(a.staff, ['山田太郎（音源編集）', 'MC 佐藤花子（編集委員）']);
  const mega = '<p>ニュースの説明文。</p>\n<p>記事の見出しです<br><a href="https://www.asahi.com/articles/ASV1.html?iref=omny">https://www.asahi.com/articles/ASV1.html?iref=omny</a>&nbsp;</p>\n<p>ご意見・感想・リクエスト <a href="https://bit.ly/q">https://bit.ly/q</a><br>ほかにも多彩な番組を配信中！ <a href="http://t.asahi.com/w">http://t.asahi.com/w</a></p><p>Learn more about your ad choices. Visit <a href="https://megaphone.fm/adchoices">megaphone.fm/adchoices</a></p>';
  const b = v2CleanSummary(mega);
  assert.equal(b.text, 'ニュースの説明文。');
  assert.deepEqual(b.related, [{ title: '記事の見出しです', url: 'https://www.asahi.com/articles/ASV1.html' }]);
  assert.equal(b.ok, true); assert.ok(CLEAN_VERSION.endsWith('+v2rules-2'));
});

test('原文の後日補完: 記録済みSHA256(先頭一致)・文字数が一致する空欄行だけ。違えば HOLD、既に原文がある行は触らない（再実行差分0）', async () => {
  const { planRawBackfill } = await import('../scripts/ledger-v2/v2-enrich.mjs');
  const crypto = await import('node:crypto'); const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const t1 = '本文A', t2 = '本文B';
  const det = [DH, ['EP-1', 'g1', '', '', '', sha(t1).slice(0, 16), String(t1.length), '原文未取得（長さ・ハッシュのみ確認）', '', '', '', '', '', '', '', '', ''],
    ['EP-2', 'g2', '', '', '', 'ffffffffffffffff', '3', '', '', '', '', '', '', '', '', '', ''], ['EP-3', 'g3', '', '', '既にある', '', '', '未清掃', '', '', '', '', '', '', '', '', '']];
  const raw = { g1: { descriptionRaw: t1, sha256: sha(t1) }, g2: { descriptionRaw: t2, sha256: sha(t2) }, g3: { descriptionRaw: 'x', sha256: sha('x') } };
  const r = planRawBackfill(det, raw, { at: 'T' });
  assert.deepEqual(r.updates.map((u) => [u.epId, u.概要原文, u.概要原文SHA256 === sha(t1), u.清掃状態]), [['EP-1', '本文A', true, '未清掃']]);
  assert.deepEqual(r.hold, [{ ep: 'EP-2', why: 'SHA_MISMATCH' }]);
  const det2 = det.map((x) => [...x]); det2[1][4] = t1; assert.equal(planRawBackfill(det2, raw).updates.length, 0);
});

test('出演者候補は出典と「候補（未確定）」付きのJSON。同一視しない（同名でも別要素のまま）', () => {
  const det = [DH, ['EP-00001', G(1), '', '', '<p>本文。</p><p>【出演・スタッフ】<br>山田太郎（記者）<br>山田太郎（MC）</p>', 'h', '1', '未清掃', '', '', '', '', '', '', '', '', '']];
  const u = planSummaryCleaning(V(), det, v2CleanSummary, CLEAN_VERSION, 'T').detailUpdates[0];
  const c = JSON.parse(u['出演者候補(抽出)']);
  assert.deepEqual(c.map((x) => x.text), ['山田太郎（記者）', '山田太郎（MC）']);
  assert.ok(c.every((x) => x.source === '概要原文【出演・スタッフ】' && x.confidence === '候補（未確定）'));
});

test('概要（清掃済）への投影: 清掃済・原文ハッシュ一致・GUID一致・空欄だけ。既存値は保護、再実行は0', async () => {
  const { planSummaryProjection } = await import('../scripts/ledger-v2/v2-enrich.mjs');
  const crypto = await import('node:crypto'); const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const vals = V(); vals[2][C('概要（清掃済）')] = '人の文';
  const det = [DH, ['EP-00001', G(1), '', '', '原文1', sha('原文1'), '3', '清掃済', 'v', '', '', '', '清掃1', '', '', '', ''],
    ['EP-00002', G(2), '', '', '原文2', sha('原文2'), '3', '清掃済', 'v', '', '', '', '清掃2', '', '', '', ''],
    ['EP-00003', G(3), '', '', '原文3', 'bad', '3', '清掃済', 'v', '', '', '', '清掃3', '', '', '', ''],
    ['EP-00001', G(9), '', '', '原文9', sha('原文9'), '3', '清掃済', 'v', '', '', '', '清掃9', '', '', '', '']];
  const r = planSummaryProjection(vals, det, sha);
  assert.deepEqual(r.cells.map((c) => [c.epId, c.column, c.value]), [['EP-00001', 'N', '清掃1']]);
  assert.deepEqual(r.hold.map((h) => h.why).sort(), ['EXISTING_VALUE_PROTECTED', 'GUID_MISMATCH', 'RAW_HASH_UNVERIFIED']);
  vals[1][C('概要（清掃済）')] = '清掃1'; assert.equal(planSummaryProjection(vals, det, sha).cells.length, 0);
});

test('遡及照合カーソル: 予算内で古い方へ進む・失敗時は進めない・完了は止まる・同じ状態からの再計画は同じ', async () => {
  const { nextScanWindows, advanceScanState } = await import('../scripts/ledger-v2/v2-enrich.mjs');
  const feeds = [{ show: 'A', url: 'u1' }, { show: 'B', url: 'u2' }, { show: 'C', url: 'u3' }];
  const p1 = nextScanWindows({}, feeds, { budgetItems: 100, windowSize: 40 });
  assert.deepEqual(p1.plan.map((p) => [p.show, p.offset, p.limit]), [['A', 40, 40], ['B', 40, 40], ['C', 40, 20]]);
  assert.deepEqual(nextScanWindows({}, feeds, { budgetItems: 100, windowSize: 40 }).plan, p1.plan);
  const s2 = advanceScanState(p1.state, [{ show: 'A', offset: 40, taken: 40, total: 90, ok: true, at: 't' }, { show: 'B', offset: 40, ok: false, error: 'HTTP_503', at: 't' }, { show: 'C', offset: 40, taken: 20, total: 60, ok: true, at: 't' }]);
  assert.equal(s2.A.offset, 80); assert.equal(s2.B.offset, 40); assert.equal(s2.C.done, true);
  const p2 = nextScanWindows(s2, feeds, { budgetItems: 100, windowSize: 40 });
  assert.deepEqual(p2.plan.map((p) => [p.show, p.offset, p.limit]), [['A', 80, 10], ['B', 40, 40]]);
});

test('完全性指標: 収蔵総数・公開・判定別・原文保全・清掃・投影・サービス別・採番の未完了', async () => {
  const { integrityMetrics } = await import('../scripts/ledger-v2/v2-enrich.mjs');
  const vals = V(); vals[1][C('掲載判定')] = '対象'; vals[1][C('代表EP-ID')] = 'EP-00001'; vals[1][C('LISTEN')] = 'https://listen.style/p/a/b';
  const det = [DH, ['EP-00001', G(1), '', '', '原文', 'h', '2', '清掃済', '', '', '', '', '', '', '', '', ''], ['EP-00002', G(2), '', '', '', 'h', '2', '原文未取得', '', '', '', '', '', '', '', '', '']];
  const m = integrityMetrics(vals, det, [['EP-00001', G(1), 'listen', 'u', '確認済み']], [['GUID', '固定ID', '', '', '状態', '', '登録完了日時'], ['g', 'EP-00001', '', '', '登録完了', '', 'T1'], ['g2', 'EP-00002', '', '', '採番済', '', '']]);
  assert.equal(m.total, 3); assert.equal(m.published, 1); assert.equal(m.details.rawStored, 1); assert.equal(m.details.hashOnly, 1); assert.equal(m.details.cleaned, 1);
  assert.equal(m.services.listen.filled, 1); assert.equal(m.services.listen.verifiedInStateTable, 1); assert.deepEqual(m.numbering.pending, ['EP-00002']); assert.equal(m.numbering.lastCompletedAt, 'T1');
});
