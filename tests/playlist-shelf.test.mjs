// Spotifyリストの掲載先（連載／朝リスト）: 投稿で受け取り作業台I列へ、公開APIで shelf として返す。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const G = 'scripts/google-apps-script/';
const box = {}; vm.createContext(box);
for (const f of ['PostInput.js', 'PostWrite.js', 'SheetData.js']) vm.runInContext(fs.readFileSync(G + f, 'utf8'), box);
test('掲載先の値をそろえる', () => {
  assert.equal(box.normalizePlaylistShelf_('series'), '連載');
  assert.equal(box.normalizePlaylistShelf_('連載・シリーズ'), '連載');
  assert.equal(box.normalizePlaylistShelf_('list'), '朝リスト');
  assert.equal(box.normalizePlaylistShelf_('なにか'), '');
  assert.equal(box.playlistShelfKey_('連載'), 'series');
  assert.equal(box.playlistShelfKey_('朝リスト'), 'list');
  assert.equal(box.playlistShelfKey_(''), '');
});
test('投稿の読み取りで shelf を受け取る', () => {
  const r = box.parsePostInput_({ postData: { contents: JSON.stringify({ kind: 'playlist', url: 'u', title: 't', shelf: 'series' }) } });
  assert.equal(r.shelf, '連載');
});
function sheet() { const cells = {}; return { cells, getLastRow: () => 10, getRange: (r, c, h, w) => ({ setValues: (v) => v[0].forEach((x, k) => { cells[`${r},${c + k}`] = x; }), setValue: (x) => { cells[`${r},${c}`] = x; } }) }; }
test('プレイリスト投稿は I列に掲載先を書く（未指定なら書かない）', () => {
  const s1 = sheet(); box.appendPostRow_(s1, 'playlist', 'u', 't', 'm', '', '', '', '', '', 'inv', 'series');
  assert.equal(s1.cells['11,9'], '連載'); assert.equal(s1.cells['11,4'], 'inv');
  const s2 = sheet(); box.appendPostRow_(s2, 'playlist', 'u', 't', 'm', '', '', '', '', '', 'inv');
  assert.equal(s2.cells['11,9'], undefined);
});
test('公開APIは G列（掲載先）を shelf として返し、無い行は空', () => {
  box.readAutoManagedPlaylistIdMap_ = () => ({}); box.playlistIdForPublicRead_ = () => '';
  const rows = [['url1', 'ポすすめ', 'ネジート', '', '', 'AUTO', '連載'], ['url2', '北欧', 'x', '', '', 'AUTO', '']];
  const sh = { getLastRow: () => 3, getLastColumn: () => 7, getParent: () => ({}), getRange: (r, c, h, w) => ({ getDisplayValues: () => rows.map((x) => x.slice(0, w)) }) };
  const out = box.readPlaylistSheet(sh);
  assert.deepEqual(out.items.map((x) => x.shelf), ['series', '']);
  const sh5 = { ...sh, getLastColumn: () => 6 };   // 列がまだ無いシートでも動く
  assert.deepEqual(box.readPlaylistSheet(sh5).items.map((x) => x.shelf), ['', '']);
});
