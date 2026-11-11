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
function mockIo(values, meta = {}) {
  const st = { values: values.map((r) => [...r]), writes: 0 };
  return { st, open: () => ({ id: meta.id || COPY_ID, name: meta.name || '【COPY試験】V2', sheetName: meta.sheet || A.SHEET }), readAll: () => st.values.map((r) => [...r]), appendRow: (row) => { st.writes++; st.values.push([...row]); return st.values.length; }, readRow: (n) => [...st.values[n - 1]] };
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
    item({ guid: G(1), title: '別題' }),                                         // GUID既存・題違い → BLOCK
    item({ guid: G(5), url: 'https://www.asahi.com/special/podcasts/item/?itemid=' + G(1) + '&iref=x' }), // 公式URL既存(GUID含む) → BLOCK
    item({ guid: G(6), title: '（再）台風の話' }),                                 // 再配信 → HOLD
    item({ guid: G(7), title: '台風の話' }),                                       // 同番組同題 → HOLD
    item({ guid: G(8), extra: { title: '' } }),                                   // 必須欠落 → BLOCK
    item({ guid: G(9) }), item({ guid: G(9), title: '同GUID二重' }),                // 入力内GUID重複 → 2件目BLOCK
  ];
  const r = A.ingest(io, cfg(), items, { write: true });
  assert.equal(JSON.stringify(r.decisions.map((d) => d.decision)), JSON.stringify(['BLOCK', 'BLOCK', 'HOLD', 'HOLD', 'BLOCK', 'CANDIDATE', 'BLOCK']));
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
