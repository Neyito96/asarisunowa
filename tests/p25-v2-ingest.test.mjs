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
  return { st, readNumbering: () => st.num.map((r) => [...r]), appendNumbering: (row) => { st.num.push([...row]); return st.num.length; }, markNumbering: (n, state, at, lr) => { st.num[n - 1][4] = state; st.num[n - 1][6] = at; st.num[n - 1][7] = lr; }, open: () => ({ id: meta.id || COPY_ID, name: meta.name || '【COPY試験】V2', sheetName: meta.sheet || A.SHEET }), readAll: () => st.values.map((r) => [...r]), appendRow: (row) => { st.writes++; st.values.push([...row]); return st.values.length; }, readRow: (n) => [...st.values[n - 1]] };
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
  io.readRow = (n) => io.st.values[n - 1].map((x, i) => (i === C('タイトル') ? 'changed' : x));
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
  const row = io.st.values[2]; assert.equal(row[C('配信日時 JST')], '2026/11/11 04:00'); assert.equal(row[C('再生時間 秒')], '3723'); assert.equal(row[C('音声URL')].includes('audio.mp3'), true);
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
  const ap = io.appendRow; io.appendRow = () => { throw new Error('API_DOWN'); };
  assert.throws(() => A.ingest(io, cfg(), [item()], { write: true }), /API_DOWN/);
  assert.equal(io.st.num.length, 2); assert.equal(io.st.num[1][4], '採番済');
  io.appendRow = ap;
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
