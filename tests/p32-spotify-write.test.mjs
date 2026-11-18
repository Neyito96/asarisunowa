// P32（清掃ロボ巡回 SPT）: matches.json の確定分だけを、番組・題名が同じで Spotify 欄が空の行に渡す。Spotify・シートは模擬。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const SRC = fs.readFileSync('gas/summary-cleaner/dist/SummaryCleaner.js', 'utf8');
const U = (c) => 'https://open.spotify.com/episode/' + c.repeat(22);
function run(matches, ledger, props = {}) {
  const box = { console, Date, JSON, Math, String, Number, Object, Array, RegExp, Error };
  vm.createContext(box); vm.runInContext(SRC, box);
  const store = { ...props }, written = [];
  box.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => store[k] ?? null, setProperty: (k, v) => { store[k] = String(v); } }) };
  box.p27WriteEnabled_ = () => true;
  box.p27Get_ = () => ({ code: 200, body: JSON.stringify(matches) });
  box.scOpen_ = () => ({ ss: {} });
  box.p27Ledger_ = () => ({ rows: ledger });
  box.p29Write_ = (col, plans) => { written.push(...plans.map((p) => ({ col, ...p }))); return plans.length ? { status: 'OK', written: plans.length } : { status: 'OK_NO_CHANGE' }; };
  const r = box.p32Spotify_();
  return { r, written, store };
}
const M = (verified, gen = 'G1') => ({ summary: { generatedAt: gen }, verified });
test('確定分のうち、番組・題名が同じで空欄の行だけを書く', () => {
  const { r, written, store } = run(M([
    { ep: 'EP-00001', url: U('A'), show: '報談', title: '題A' },
    { ep: 'EP-00002', url: U('B'), show: '報談', title: '題B' },      // 既に値あり
    { ep: 'EP-00003', url: U('C'), show: '報談', title: '違う題' },    // 題名が台帳と違う
    { ep: 'EP-00004', url: U('D'), show: '報談', title: '題D' },      // 同じURLが別の行に
  ]), [
    { ep: 'EP-00001', show: '報談', title: '題A', current: '' },
    { ep: 'EP-00002', show: '報談', title: '題B', current: U('X') },
    { ep: 'EP-00003', show: '報談', title: '題C', current: '' },
    { ep: 'EP-00004', show: '報談', title: '題D', current: '' },
    { ep: 'EP-00009', show: '報談', title: '別', current: U('D') },
  ]);
  assert.deepEqual(written.map((w) => [w.col, w.ep, w.url]), [['Spotify', 'EP-00001', U('A')]]);
  assert.equal(r.skippedBeforeWrite['既に値あり（上書きしない）'], 1);
  assert.equal(r.skippedBeforeWrite['番組・題名が台帳と違う'], 1);
  assert.equal(r.skippedBeforeWrite['同じURLが別の行にある（誤照合の疑い）'], 1);
  assert.equal(r.finished, false); assert.equal(store.P32_DONE_GEN, 'G1');
});
test('同じ照合結果は二度書かない（JSONが更新されたら再び読む）', () => {
  const first = run(M([{ ep: 'EP-00001', url: U('A'), show: '報談', title: '題A' }]), [{ ep: 'EP-00001', show: '報談', title: '題A', current: '' }], { P32_DONE_GEN: 'G1' });
  assert.equal(first.r.status, 'OK_SAME_JSON'); assert.equal(first.written.length, 0);
  const next = run(M([{ ep: 'EP-00001', url: U('A'), show: '報談', title: '題A' }], 'G2'), [{ ep: 'EP-00001', show: '報談', title: '題A', current: '' }], { P32_DONE_GEN: 'G1' });
  assert.equal(next.written.length, 1);
});
test('巡回は SPT を「今日は完了」にしない', () => {
  assert.match(SRC, /job !== 'NEW' && job !== 'JUDGE' && job !== 'SPT'/);
});
