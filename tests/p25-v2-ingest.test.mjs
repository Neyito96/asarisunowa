// P25V2IngestAdapter: V2実見出し・保護対象拒否・COPY 1件追記→読み戻し→再実行0・再配信/重複は公開計数外。合成データのみ。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sb = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), sb);
const A = sb.module.exports;
const H = [...A.HEADERS];
const C = (n) => H.indexOf(n);
const G = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function v2(rows) {
  return [H, ...rows.map((o) => { const r = H.map(() => ''); r[C('EP-ID')] = o.ep; r[C('番組')] = o.show || 'MEDIA TALK'; r[C('タイトル')] = o.title || 't' + o.ep; r[C('配信日時 JST')] = '2026/11/10 04:00'; r[C('掲載判定')] = o.judge || '対象'; r[C('代表EP-ID')] = o.rep || o.ep; r[C('公式GUID')] = o.guid || ''; r[C('公式個別URL')] = o.url || ''; r[C('LISTEN')] = o.listen || ''; r[C('概要（清掃済）')] = o.sum || ''; return r; })];
}
const COPY_ID = 'COPY-TEST-ID';
const cfg = (o = {}) => ({ environment: 'COPY', targetSpreadsheetId: COPY_ID, expectedTargetId: COPY_ID, sheetName: A.SHEET, scope: A.SCOPE, write: true, ...o });
const NUMH = ['GUID', '固定ID', '番組', 'タイトル', '状態', '採番日時', '登録完了日時', '台帳行番号', 'エラー・備考'];
function mockIo(values, meta = {}) {
  const st = { values: values.map((r) => [...r]), writes: 0, num: [NUMH, ...(meta.num || [])] };
  const DH = [...A.DETAIL_HEADERS]; st.details = [DH, ...(meta.details || [])];
  return { st, readNumbering: () => st.num.map((r) => [...r]),
    appendNumberingRows: (rows) => { const n = st.num.length + 1; rows.forEach((r) => st.num.push([...r])); return n; },
    markNumberingRows: (list) => list.forEach((m) => { st.num[m.row - 1][4] = m.state; st.num[m.row - 1][6] = m.at; st.num[m.row - 1][7] = m.ledgerRow; }),
    readDetails: () => st.details.map((r) => [...r]), appendDetails: (rows) => { const n = st.details.length + 1; rows.forEach((r) => st.details.push([...r])); return n; },
    open: () => ({ id: meta.id || COPY_ID, name: meta.name || '【COPY試験】V2', sheetName: meta.sheet || A.SHEET }), readAll: () => st.values.map((r) => [...r]),
    appendRows: (rows) => { st.writes++; const n = st.values.length + 1; rows.forEach((r) => st.values.push([...r])); return n; },
    readRows: (n, k) => st.values.slice(n - 1, n - 1 + k).map((r) => [...r]) };
}
const item = (o = {}) => ({ show: 'ニュースの学校', title: o.title || '【COPY試験・合成】新着1件', date: '2026/11/11 04:00', guid: o.guid || G(900), officialUrl: o.url, links: { LISTEN: 'https://listen.style/p/abcd1234/efgh5678' }, ...o.extra });

test('V2実見出し34列と一致しなければ停止（列順は見出し名で解決）', () => {
  assert.equal(A.schema(H).width, 34);
  const rev = [...H].reverse(); assert.equal(A.schema(rev).idx['EP-ID'], 33);
  assert.throws(() => A.schema(H.map((x) => (x === 'LISTEN' ? 'LISTEN URL' : x))), /V2_SCHEMA_MISMATCH/);
  assert.throws(() => A.schema([...H, 'EP-ID']), /V2_SCHEMA_DUPLICATE/);
});

test('保護対象（V1/V2正本/本番/旧GAS）への書込は、IDを正しく申告しても拒否', () => {
  for (const id of A.PROTECTED) {
    assert.throws(() => A.assertCopyTarget(cfg({ targetSpreadsheetId: id, expectedTargetId: id }), { id, name: 'COPY', sheetName: A.SHEET }, true), /PROTECTED_TARGET_REFUSED/);
    assert.throws(() => A.assertCopyTarget(cfg(), { id, name: 'COPY', sheetName: A.SHEET }, true), /PROTECTED_TARGET_REFUSED/);   // 実際に開いたのが保護対象
    const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]), { id });
    assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /PROTECTED_TARGET_REFUSED/);
    assert.equal(io.st.writes, 0);
  }
});

test('書込前検証: 環境/ID二重確認/開いたID/COPY名/シート名/スコープ/書込フラグ', () => {
  const ok = { id: COPY_ID, name: 'x COPY', sheetName: A.SHEET };
  assert.throws(() => A.assertCopyTarget(cfg({ environment: 'PROD' }), ok, true), /COPY_ENV_REQUIRED/);
  assert.throws(() => A.assertCopyTarget(cfg({ expectedTargetId: 'other' }), ok, true), /TARGET_ID_UNCONFIRMED/);
  assert.throws(() => A.assertCopyTarget(cfg(), { ...ok, id: 'other' }, true), /OPENED_ID_MISMATCH/);
  assert.throws(() => A.assertCopyTarget(cfg(), { ...ok, name: '基本台帳 V2' }, true), /TARGET_NAME_NOT_COPY/);
  assert.throws(() => A.assertCopyTarget(cfg(), { ...ok, sheetName: 'エピソード台帳' }, true), /SHEET_NAME_MISMATCH/);
  assert.throws(() => A.assertCopyTarget(cfg({ scope: 'ALL' }), ok, true), /SCOPE_MISMATCH/);
  assert.throws(() => A.assertCopyTarget(cfg({ write: false }), ok, true), /WRITE_FLAG_OFF/);
  assert.equal(A.assertCopyTarget(cfg({ write: false }), ok, false), true);
});

test('READ_ONLY ドライランは書かない', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  const r = A.ingest(io, cfg({ write: false }), [item()], { write: false });
  assert.equal(r.mode, 'READ_ONLY_DRY_RUN'); assert.equal(r.counts.CANDIDATE, 1); assert.equal(io.st.writes, 0);
});

test('COPY 1件追記→読み戻し一致→同入力の再実行で追加0（ALREADY_INGESTED）・既存行は不変', () => {
  const base = v2([{ ep: 'EP-00001', guid: G(1), listen: 'https://listen.style/p/x/y', sum: '既存概要' }, { ep: 'EP-06694', guid: G(2) }]);
  const io = mockIo(base);
  const r1 = A.ingest(io, cfg(), [item(), item({ guid: G(901), title: '二件目' })], { write: true, maxRows: 5 });
  assert.equal(r1.added, 1); assert.equal(r1.readbackOk, true); assert.equal(JSON.stringify(r1.addedEpIds), JSON.stringify(['EP-06695']));
  const added = io.st.values[3];
  assert.equal(added[C('掲載判定')], '未判定'); assert.equal(added[C('LISTEN')], 'https://listen.style/p/abcd1234/efgh5678'); assert.equal(added[C('公式GUID')], G(900));
  assert.equal(JSON.stringify(io.st.values.slice(0, 3)), JSON.stringify(base));          // 既存行・リンク・概要は不変
  assert.equal(r1.publicBefore, 2); assert.equal(r1.publicAfter, 2);                    // 未判定は公開計数に入らない
  const r2 = A.ingest(io, cfg(), [item()], { write: true });
  assert.equal(r2.added, 0); assert.equal(r2.counts.ALREADY_INGESTED, 1); assert.equal(io.st.writes, 1);
});

test('重複はBLOCK・再配信/同題はHOLD、どちらも書かず公開計数外', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', show: 'ニュースの学校', title: '台風の話', guid: G(1), url: 'https://www.asahi.com/special/podcasts/item/?itemid=' + G(1) }]));
  const items = [
    item({ guid: G(1), title: '別題' }),                                         // 同GUID・同番組・題違い → METADATA_CHANGE（記録のみ）
    item({ guid: G(5), url: 'https://www.asahi.com/special/podcasts/item/?itemid=' + G(1) + '&iref=x' }), // 公式URL既存(GUID含む) → BLOCK
    item({ guid: G(6), title: '（再）台風の話' }),                                 // 再配信 → HOLD
    item({ guid: G(7), title: '台風の話' }),                                       // 同番組同題 → HOLD
    item({ guid: G(8), extra: { title: '' } }),                                   // 必須欠落 → BLOCK
    item({ guid: G(9) }), item({ guid: G(9), title: '同GUID二重' }),                // 入力内GUID重複 → 2件目BLOCK
  ];
  const r = A.ingest(io, cfg(), items, { write: true });
  assert.equal(JSON.stringify(r.decisions.map((d) => d.decision)), JSON.stringify(['METADATA_CHANGE', 'BLOCK', 'HOLD', 'HOLD', 'BLOCK', 'CANDIDATE', 'BLOCK']));
  assert.equal(r.added, 1); assert.equal(r.publicAfter, r.publicBefore);
});

test('書込直前に台帳が変わっていたら書かない', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  let calls = 0; const orig = io.readAll; io.readAll = () => { const v = orig(); if (++calls === 2) v.push(H.map(() => 'x')); return v; };
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /LEDGER_CHANGED_SINCE_READ/);
  assert.equal(io.st.writes, 0);
});

test('読み戻し不一致は停止として報告', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  io.readRows = (n, k) => io.st.values.slice(n - 1, n - 1 + k).map((r) => r.map((x, i) => (i === C('タイトル') ? 'changed' : x)));
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /READBACK_MISMATCH/);
});

test('同じ行数でも既存内容が書込直前に変わったら停止する', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  let reads = 0;
  const base = io.readAll;
  io.readAll = () => {
    const values = base();
    if (++reads === 2) values[1][C('タイトル')] = 'other writer changed title';
    return values;
  };
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /LEDGER_CHANGED_SINCE_READ/);
  assert.equal(io.st.writes, 0);
});

const OMNY = `<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>ch</title><itunes:image href="https://img/ch.jpg"/>
<item><title><![CDATA[（GLOBE）災害の話　A&B]]></title><guid isPermaLink="false">9B4489C7-BD25-4460-9085-B4F9000E8C5B</guid><pubDate>Tue, 10 Nov 2026 19:00:00 +0000</pubDate><link>https://omny.fm/shows/asahi/globe1111</link><enclosure url="https://traffic.omny.fm/d/clips/x/audio.mp3?utm_source=Podcast" type="audio/mpeg"/><itunes:duration>01:02:03</itunes:duration><content:encoded><![CDATA[<p>本文<br>二行目</p>]]></content:encoded></item>
<item><title>旧回 &amp; 記号</title><guid>https://example/ep?id=00000000-0000-4000-8000-000000000002</guid><pubDate>Mon, 09 Nov 2026 15:30:00 +0000</pubDate><description>説明&lt;b&gt;</description><itunes:duration>611</itunes:duration></item>
</channel></rss>`;

test('公式RSS解析: 題名(CDATA)・GUID小文字化・JST日時・リンク・音声・秒数・画像(番組既定)・概要原文', () => {
  const it = A.parseRss(OMNY, 'https://www.omnycontent.com/d/playlist/a/b/c/podcast.rss', 'ニュースの現場から');
  assert.equal(it.length, 2);
  assert.equal(it[0].title, '（GLOBE）災害の話　A&B'); assert.equal(it[0].guid, '9b4489c7-bd25-4460-9085-b4f9000e8c5b');
  assert.equal(it[0].date, '2026/11/11 04:00'); assert.equal(it[0].duration, '3723'); assert.equal(it[0].sourceUrl, 'https://omny.fm/shows/asahi/globe1111');
  assert.match(it[0].audioUrl, /audio\.mp3/); assert.equal(it[0].image, 'https://img/ch.jpg'); assert.equal(it[0].descriptionRaw, '<p>本文<br>二行目</p>');
  assert.equal(it[1].title, '旧回 & 記号'); assert.equal(it[1].guid, G(2)); assert.equal(it[1].date, '2026/11/10 00:30'); assert.equal(it[1].descriptionRaw, '説明<b>');
  assert.equal(A.parseRss(OMNY, 'https://feeds.megaphone.fm/X', 's', 1).length, 1);
  assert.throws(() => A.parseRss(OMNY, 'https://evil.example/rss', 's'), /UNVERIFIED_FEED_HOST/);
  assert.throws(() => A.parseRss('<html/>', 'https://feeds.megaphone.fm/X', 's'), /FEED_INVALID/);
});

test('RSS→分類→COPY収蔵: 解析結果がそのまま候補になり、日時形式も検証される', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  const items = A.parseRss(OMNY, 'https://feeds.megaphone.fm/X', 'ニュースの現場から');
  const r = A.ingest(io, cfg(), items, { write: true, now: () => 'T' });
  assert.equal(r.counts.CANDIDATE, 2); assert.equal(r.added, 1);
  const row = io.st.values[2]; assert.equal(row[C('配信日時 JST')], '2026/11/10 00:30'); assert.equal(row[C('再生時間 秒')], '611');   // 古い順に採番
  const bad = A.classify([], [{ show: 's', title: 't', date: 'Tue, 10 Nov 2026', guid: G(3) }]);
  assert.ok(bad[0].reasons.includes('DATE_FORMAT'));
});

test('採番: 採番履歴(正本)に「採番済→登録完了」を記録。台帳・履歴の最大+1', () => {
  const io = mockIo(v2([{ ep: 'EP-06694', guid: G(1) }]), { num: [[G(50), 'EP-06700', 'x', 'y', '登録完了', '', '', '', '']] });
  const r = A.ingest(io, cfg(), [item()], { write: true, now: () => 'NOW' });
  assert.equal(JSON.stringify(r.addedEpIds), JSON.stringify(['EP-06701']));
  const last = io.st.num[io.st.num.length - 1];
  assert.equal(last[0], G(900)); assert.equal(last[1], 'EP-06701'); assert.equal(last[4], '登録完了'); assert.equal(last[7], 3);
});

test('中断復旧: 採番済のまま台帳書込が失敗 → 再実行で同じEP-IDを再利用（番号を飛ばさない・二重採番しない）', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  const ap = io.appendRows; io.appendRows = () => { throw new Error('API_DOWN'); };
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /API_DOWN/);
  assert.equal(io.st.num.length, 2); assert.equal(io.st.num[1][4], '採番済');
  io.appendRows = ap;
  const r = A.ingest(io, cfg(), [item()], { write: true });
  assert.equal(JSON.stringify(r.addedEpIds), JSON.stringify(['EP-00002'])); assert.equal(r.numberingReused, true);
  assert.equal(io.st.num.length, 2); assert.equal(io.st.num[1][4], '登録完了');
});

test('採番の衝突（履歴の番号が台帳で別GUIDに使われている）・履歴の同GUID二重は停止', () => {
  const rows = A.records(v2([{ ep: 'EP-00005', guid: G(5) }])).rows;
  assert.throws(() => A.allocate(rows, [{ guid: G(900), epId: 'EP-00005', row: 2 }], G(900), 0), /NUMBERING_ID_COLLISION/);
  assert.throws(() => A.allocate(rows, [{ guid: G(900), epId: 'EP-00006', row: 2 }, { guid: G(900), epId: 'EP-00007', row: 3 }], G(900), 0), /NUMBERING_GUID_DUPLICATE/);
  assert.throws(() => A.numbering([['GUID', 'ID']]), /NUMBERING_SCHEMA_MISMATCH/);
});

test('同GUIDで題名だけ変わった回は METADATA_CHANGE として記録し書かない', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', show: 'ニュースの学校', title: '旧題', guid: G(900) }]));
  const r = A.ingest(io, cfg(), [item({ title: '新題' })], { write: true });
  assert.equal(r.counts.METADATA_CHANGE, 1); assert.equal(r.added, 0); assert.equal(r.decisions[0].existing, 'EP-00001');
});

test('読み戻し: シートが日時を日付型に変えて「4:00」表示になっても値が同じなら一致（実COPYで発生）', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  io.readRows = (n, k) => io.st.values.slice(n - 1, n - 1 + k).map((r) => r.map((x, i) => (i === C('配信日時 JST') ? '2026/11/11 4:00' : x)));
  const r = A.ingest(io, cfg(), [item()], { write: true });
  assert.equal(r.readbackOk, true);
  io.readRows = (n, k) => io.st.values.slice(n - 1, n - 1 + k).map((r) => r.map((x, i) => (i === C('配信日時 JST') ? '2026/11/11 5:00' : x)));
  assert.throws(() => A.ingest(io, cfg(), [item({ guid: G(901), title: '別' })], { write: true }), /READBACK_MISMATCH/);
});

test('中断復旧: 台帳には入ったが採番履歴が「採番済」のまま → 再実行で「登録完了」に修復し、追加は0', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  const rb = io.readRows; io.readRows = () => [['broken']];
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /READBACK_MISMATCH/);
  assert.equal(io.st.num[1][4], '採番済'); io.readRows = rb;
  const r = A.ingest(io, cfg(), [item()], { write: true, now: () => 'R' });
  assert.equal(r.added, 0); assert.equal(r.counts.ALREADY_INGESTED, 1);
  assert.equal(JSON.stringify(r.numberingRepaired), JSON.stringify(['EP-00002'])); assert.equal(io.st.num[1][4], '登録完了'); assert.equal(io.st.num[1][7], 3);
});

test('小バッチ: 上限は設定(maxRowsCap)と絶対上限10の小さい方。古い順に連番採番し、一括追記→読み戻し→収蔵詳細→登録完了', () => {
  const io = mockIo(v2([{ ep: 'EP-06694', guid: G(1) }]));
  const items = [5, 3, 4, 2].map((n) => item({ guid: G(100 + n), title: 't' + n, extra: { date: `2026/10/1${n} 04:00`, descriptionRaw: n === 2 ? '' : '原文' + n, descLen: n === 2 ? 50 : undefined, descSha256: n === 2 ? 'abc' : undefined } }));
  const r1 = A.ingest(io, cfg(), items, { write: true, maxRows: 99, now: () => 'T', sha256: (x) => 'h' + x.length });
  assert.equal(r1.added, 1);                                                     // maxRowsCap 既定1
  const r2 = A.ingest(io, cfg({ maxRowsCap: 50 }), items, { write: true, maxRows: 99, now: () => 'T', sha256: (x) => 'h' + x.length });
  assert.equal(r2.added, 3); assert.equal(A.HARD_CAP, 10);
  assert.equal(JSON.stringify(io.st.values.slice(2).map((r) => [r[0], r[C('配信日時 JST')]])), JSON.stringify([['EP-06695', '2026/10/12 04:00'], ['EP-06696', '2026/10/13 04:00'], ['EP-06697', '2026/10/14 04:00'], ['EP-06698', '2026/10/15 04:00']]));
  assert.ok(io.st.num.slice(1).every((r) => r[4] === '登録完了'));
  const d = io.st.details.slice(1);
  assert.equal(d.length, 4); assert.equal(d[0][7], '原文未取得（長さ・ハッシュのみ確認）'); assert.equal(d[0][5], 'abc');
  assert.equal(d[1][4], '原文3'); assert.equal(d[1][5], 'h3'); assert.equal(d[1][7], '未清掃');
  const r3 = A.ingest(io, cfg({ maxRowsCap: 50 }), items, { write: true, maxRows: 99 });
  assert.equal(r3.added, 0); assert.equal(r3.counts.ALREADY_INGESTED, 4); assert.equal(io.st.details.length, 5);
});

test('小バッチの途中失敗: 読み戻しが一部不一致 → 一致分だけ登録完了、不一致分は採番済のまま停止。再実行で修復・追加0', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', guid: G(1) }]));
  const items = [1, 2, 3].map((n) => item({ guid: G(200 + n), title: 'b' + n, extra: { date: `2026/10/1${n} 04:00` } }));
  const rb = io.readRows; io.readRows = (n, k) => rb(n, k).map((r, i) => (i === 1 ? r.map((x, j) => (j === C('タイトル') ? 'x' : x)) : r));
  let err; try { A.ingest(io, cfg({ maxRowsCap: 5 }), items, { write: true, maxRows: 5 }); } catch (e) { err = e; }
  assert.match(err.message, /READBACK_MISMATCH EP-00003/); assert.equal(err.result.added, 2);
  assert.equal(JSON.stringify(io.st.num.slice(1).map((r) => r[4])), JSON.stringify(['登録完了', '採番済', '登録完了']));
  io.readRows = rb;
  const r = A.ingest(io, cfg({ maxRowsCap: 5 }), items, { write: true, maxRows: 5 });
  assert.equal(r.added, 0); assert.equal(JSON.stringify(r.numberingRepaired), JSON.stringify(['EP-00003'])); assert.equal(io.st.values.length, 5);
});

test('READ_ONLY でも予定採番(plan)を出す。期限切れ(deadline)なら書かずに PARTIAL_TIME', () => {
  const io = mockIo(v2([{ ep: 'EP-00009', guid: G(1) }]), { num: [[G(77), 'EP-00012', 's', 't', '採番済', '', '', '', '']] });
  const items = [item({ guid: G(77), title: 'reuse' }), item({ guid: G(78), title: 'new', extra: { date: '2026/11/12 04:00' } })];
  const r = A.ingest(io, cfg({ write: false, maxRowsCap: 5 }), items, { write: false, maxRows: 5 });
  assert.equal(JSON.stringify(r.plan.map((p) => [p.epId, p.reused])), JSON.stringify([['EP-00012', true], ['EP-00013', false]]));
  const r2 = A.ingest(io, cfg({ maxRowsCap: 5 }), items, { write: true, maxRows: 5, deadlineMs: 1 });
  assert.equal(r2.status, 'PARTIAL_TIME'); assert.equal(io.st.writes, 0);
});

test('本番混入防止: doGet/doPost が同居するプロジェクト・トリガーがあるプロジェクトでは停止', () => {
  assert.throws(() => A.assertIsolated({ hasDoGet: true }), /NOT_ISOLATED_PROJECT/);
  assert.throws(() => A.assertIsolated({ hasDoPost: true }), /NOT_ISOLATED_PROJECT/);
  assert.throws(() => A.assertIsolated({ triggerCount: 1 }), /TRIGGERS_PRESENT/);
  assert.equal(A.assertIsolated({ triggerCount: 0 }), true);
  // 本番の全GASファイルと同じ空間に読み込むと入口が停止する（コード.js の doGet を検知）
  const g = { module: { exports: {} }, ScriptApp: { getProjectTriggers: () => [] }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) } };
  vm.runInNewContext('function doGet(){}\n' + fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), g);
  assert.throws(() => vm.runInNewContext('P25V2_INGEST_COPY({}, [], false)', g), /NOT_ISOLATED_PROJECT/);
});

test('本番混入防止: .claspignore が COPY専用ファイルを除外し、本番ファイルは除外しない', () => {
  const ig = fs.readFileSync('scripts/google-apps-script/.claspignore', 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const f of ['P25V2IngestAdapter.js', 'LedgerFillRobot.js']) assert.ok(ig.includes(f), f);
  for (const f of fs.readdirSync('scripts/google-apps-script').filter((f) => /\.(js|gs)$/.test(f))) {
    const copyOnly = /P25V2IngestAdapter|LedgerFillRobot/.test(f);
    assert.equal(ig.includes(f), copyOnly, f);
  }
  assert.ok(!fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8').match(/newTrigger|ScriptApp\.newTrigger|deleteTrigger/));
});

test('中断復旧の修復は「採番済」だけ。人が付けた「要確認」などの状態は書き換えない', () => {
  const io = mockIo(v2([{ ep: 'EP-00001', show: 'ニュースの学校', title: 'x', guid: G(900) }]), { num: [[G(900), 'EP-00001', 'ニュースの学校', 'x', '要確認（原文・音声URL未取得）', '', '', '', '']] });
  const r = A.ingest(io, cfg(), [item({ title: 'x' })], { write: true });
  assert.equal(r.numberingRepaired.length, 0); assert.equal(io.st.num[1][4], '要確認（原文・音声URL未取得）');
});

test('COPY専用GASの依存関係: 使うGASサービスは許可済みのものだけ・他ファイルの関数に依存しない・権限雛形と一致', () => {
  const src = fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8');
  const used = new Set([...src.matchAll(/\b(SpreadsheetApp|UrlFetchApp|LockService|ScriptApp|Utilities|DriveApp|GmailApp|PropertiesService|MailApp|CacheService)\./g)].map((m) => m[1]));
  assert.deepEqual([...used].sort(), ['LockService', 'ScriptApp', 'SpreadsheetApp', 'UrlFetchApp', 'Utilities']);
  const defined = new Set([...src.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]));
  const called = [...src.matchAll(/\b(p25v2[A-Za-z0-9_]*|P25V2_[A-Z_]+)\s*\(/g)].map((m) => m[1]);
  assert.deepEqual(called.filter((f) => !defined.has(f)), []);                                     // 本アダプタ以外の関数を呼ばない
  assert.ok(!/\b(p25[A-Z]|P25_RUN|SPREADSHEET_ID)\b/.test(src.replace(/\/\/[^\n]*/g, '').replace(/p25v2/g, '')));   // コメントを除いて検査            // Phase25本体・本番設定に依存しない
  const scopes = JSON.parse(fs.readFileSync('gas/p25v2-copy/appsscript.json', 'utf8')).oauthScopes;
  assert.deepEqual(scopes, ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.scriptapp']);
});

test('GAS模擬の通し試験: 公式RSSを直接取得→1件追記→原文を詳細表に保存→採番登録完了→読み戻し一致→再実行0。トリガー作成なし・ロック解放', async () => {
  const crypto = await import('node:crypto');
  const mkSheet = (name, rows) => { const st = { name, rows: rows.map((r) => [...r]) };
    const w = () => Math.max(...st.rows.map((r) => r.length), 1);
    const rng = (r, c, nr = 1, nc = 1) => ({
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String((st.rows[r - 1 + i] || [])[c - 1 + j] ?? ''))),
      setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => { while (st.rows.length < r + i) st.rows.push([]); st.rows[r - 1 + i][c - 1 + j] = x; })),
      setValue: (x) => { while (st.rows.length < r) st.rows.push([]); st.rows[r - 1][c - 1] = x; }, copyFormatToRange: () => {} });
    return { st, getName: () => name, getLastRow: () => st.rows.length, getLastColumn: () => w(), getRange: rng }; };
  const ledger = mkSheet(A.SHEET, v2([{ ep: 'EP-00010', guid: G(10) }])), num = mkSheet('固定ID採番履歴', [NUMH]), det = mkSheet('V2・収蔵詳細', [[...A.DETAIL_HEADERS]]);
  const sheets = { [A.SHEET]: ledger, '固定ID採番履歴': num, 'V2・収蔵詳細': det };
  let locked = 0, released = 0, fetched = [];
  const rss = `<?xml version="1.0"?><rss><channel><title>ニュースの学校</title><item><title>【合成】GAS通し</title><guid>${G(950)}</guid><pubDate>Tue, 10 Nov 2026 19:00:00 GMT</pubDate><link>https://example.invalid/ep</link><description><![CDATA[<p>合成の概要原文です。</p>]]></description><enclosure url="https://example.invalid/a.mp3" type="audio/mpeg"/></item></channel></rss>`;
  const g = { module: { exports: {} }, Date, JSON, Math,
    SpreadsheetApp: { openById: (id) => { assert.equal(id, COPY_ID); return { getId: () => COPY_ID, getName: () => '【COPY試験】GAS模擬', getSheetByName: (n) => sheets[n] || null }; }, flush() {} },
    UrlFetchApp: { fetch: (u) => { fetched.push(u); return { getResponseCode: () => 200, getContentText: () => rss }; } },
    LockService: { getScriptLock: () => ({ tryLock: () => (locked++, true), releaseLock: () => released++ }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => { throw new Error('TRIGGER_FORBIDDEN'); } },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)) } };
  vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), g);
  g.CFG = cfg({ feeds: [{ show: 'ニュースの学校', url: 'https://feeds.megaphone.fm/TASC5851398719' }], maxRows: 1 });
  const r1 = vm.runInNewContext('P25V2_INGEST_COPY(CFG, null, true)', g);
  assert.deepEqual(fetched, ['https://feeds.megaphone.fm/TASC5851398719']); assert.equal(locked, 1); assert.equal(released, 1);
  assert.equal(ledger.st.rows.length, 3); assert.equal(ledger.st.rows[2][C('公式GUID')], G(950));
  const dh = [...A.DETAIL_HEADERS], raw = det.st.rows[1][dh.indexOf('概要原文')];
  assert.match(raw, /合成の概要原文/); assert.equal(det.st.rows[1][dh.indexOf('概要原文SHA256')], crypto.createHash('sha256').update(raw).digest('hex'));
  assert.equal(num.st.rows[1][4], '登録完了'); assert.equal(r1.feedErrors.length, 0);
  const before = JSON.stringify([ledger.st.rows, num.st.rows, det.st.rows]);
  vm.runInNewContext('P25V2_INGEST_COPY(CFG, null, true)', g);
  assert.equal(JSON.stringify([ledger.st.rows, num.st.rows, det.st.rows]), before);   // 再実行は差分0
  g.UrlFetchApp.fetch = () => ({ getResponseCode: () => 503, getContentText: () => '' });
  const r3 = vm.runInNewContext('P25V2_INGEST_COPY(CFG, null, true)', g);
  assert.equal(r3.feedErrors[0].error, 'FEED_HTTP_503'); assert.equal(JSON.stringify([ledger.st.rows, num.st.rows, det.st.rows]), before);   // 取得失敗は記録して何も書かない
});

// ===== V2作業用（PR #306 新着一括収蔵）=====
const V2W = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
const v2cfg = (o = {}) => cfg({ environment: 'V2_WORKING', targetSpreadsheetId: V2W, expectedTargetId: V2W, v2WorkingApproved: true, ...o });
const v2open = { id: V2W, name: '朝リスの田｜基本台帳 V2 作業用｜2026-11-11', sheetName: A.SHEET };
test('V2作業用: 承認・ID・名前が揃った時だけ書込可。他の保護対象は従来どおり拒否', () => {
  A.assertCopyTarget(v2cfg(), v2open, true);
  assert.throws(() => A.assertCopyTarget(v2cfg({ v2WorkingApproved: false }), v2open, true), /V2_WORKING_NOT_APPROVED/);
  A.assertCopyTarget(v2cfg({ v2WorkingApproved: false }), v2open, false);   // 読取は可
  assert.throws(() => A.assertCopyTarget(v2cfg(), { ...v2open, name: '朝リスの田 V2正本' }, true), /TARGET_NAME_NOT_V2_WORKING/);
  assert.throws(() => A.assertCopyTarget(cfg({ targetSpreadsheetId: V2W, expectedTargetId: V2W }), { ...v2open, name: 'COPY' }, true), /PROTECTED_TARGET_REFUSED/);   // COPY設定ではV2作業用に書けない
  A.PROTECTED.filter((id) => id !== V2W).forEach((id) => assert.throws(() => A.assertCopyTarget(v2cfg({ targetSpreadsheetId: id, expectedTargetId: id }), { ...v2open, id }, true), /PROTECTED_TARGET_REFUSED/));
});
test('採番: COPYと同じGUIDは同番号、他GUIDは予約最大より後ろ、使用済みの予約番号は使わない', () => {
  const rows = A.records(v2([{ ep: 'EP-06700', guid: G(1) }])).rows;
  const rsv = { [G(5)]: 'EP-06721', [G(6)]: 'EP-06700' };
  assert.deepEqual({ ...A.allocate(rows, [], G(5), 6725, rsv) }, { epId: 'EP-06721', reused: false, fromReserve: true });
  assert.equal(A.allocate(rows, [], G(6), 6725, rsv).epId, 'EP-06726');   // EP-06700 は別GUIDで使用済み
  assert.equal(A.allocate(rows, [], G(7), 6725, rsv).epId, 'EP-06726');
  assert.equal(A.allocate(rows, [{ guid: G(9), epId: 'EP-06721', row: 2 }], G(5), 6725, rsv).epId, 'EP-06726');   // 採番履歴で他GUIDに使用済み
});
