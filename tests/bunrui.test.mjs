import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/Bunrui.js', import.meta.url), 'utf8'), c);
const B = c.module.exports;
const ok = { ep: 'EP-06145', main: '仕事・労働', sub: '科学', device: 'abcdefgh1234', listened: '一部聞いた' };

test('受付: 正しい投稿は通す。主分類「わからない」なら副分類は保存しない', () => {
  assert.equal(B.bunruiValidate_(ok).ok, true);
  const u = B.bunruiValidate_({ ...ok, main: 'わからない', sub: '科学' });
  assert.equal(u.ok, true); assert.equal(u.row.sub, '');
});
test('受付: 形が違う・いたずらは止める', () => {
  const e = (p) => JSON.parse(JSON.stringify(B.bunruiValidate_({ ...ok, ...p }).errors));
  assert.deepEqual(e({ ep: 'EP-1' }), ['EP']);
  assert.deepEqual(e({ main: '料理' }), ['MAIN']);
  assert.deepEqual(e({ sub: '仕事・労働' }), ['SUB']);          // 主と同じ
  assert.deepEqual(e({ note: 'あ'.repeat(301) }), ['NOTE']);
  assert.deepEqual(e({ hp: 'x' }), ['BOT']);
  assert.deepEqual(e({ device: 'x' }), ['DEVICE']);
  assert.deepEqual(e({ note: '見て https://discord.gg/abc' }), ['LINK']);
});
test('集計: 同じ端末・同じ回は最後の1件だけ。除外行は数えない', () => {
  const row = (ep, main, sub, dev, state = '') => ['id', 't', ep, main, sub, '', '', '', '', dev, state, ''];
  const t = B.bunruiTally_([
    row('EP-1', '科学', '', 'd1'), row('EP-1', '教育', '科学', 'd1'),   // d1 は気が変わった → 教育
    row('EP-1', '教育', '', 'd2'), row('EP-1', 'わからない', '', 'd3'), row('EP-1', '政治・行政', '', 'd4', '除外'),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(t['EP-1'])), { n: 3, main: { '教育': 2 }, sub: { '科学': 1 }, unsure: 1 });
});
test('分類の名前は宇宙と同じ20種', () => {
  const D = JSON.parse(fs.readFileSync(new URL('../public/uchu/data/core.json', import.meta.url), 'utf8'));
  assert.deepEqual([...B.BUNRUI_CATS_], D.cats.map((x) => x.name));
});
