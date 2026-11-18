// 番組の旧名・新名（SDGsを話そう ⇔ こどもそうだんしつ）で、番組名検索に両方の回が出る。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterEpisodes, normal, showSearchText } from '../public/library/library-core.mjs';
const m = JSON.parse(fs.readFileSync('public/library/data/manifest.json', 'utf8'));
const lite = JSON.parse(fs.readFileSync('public/library/data/search/lite.json', 'utf8'));
const shows = m.searchIndex.shows;
// 画面（library.mjs の loadLite / fastFilter）と同じ作り方で題名・出演者・番組名の索引を作る
const rows = lite.map(([id, si, date, title, cast]) => ({ id, show: shows[si], date, title, cast, hay: normal(`${showSearchText(shows[si])} ${title} ${cast} ${id}`) }));
const hit = (q) => rows.filter((x) => normal(q).split(' ').every((t) => x.hay.includes(t)));
const count = (q, show) => hit(q).filter((x) => x.show === show).length;
const total = (show) => rows.filter((x) => x.show === show).length;
test('「こどもそうだんしつ」で旧名 SDGsを話そう の回も全部出る', () => {
  assert.equal(count('こどもそうだんしつ', 'こどもそうだんしつ'), total('こどもそうだんしつ'));
  assert.equal(count('こどもそうだんしつ', 'SDGsを話そう'), total('SDGsを話そう'));
});
test('「SDGsを話そう」でも こどもそうだんしつ の回が出る・他の番組は混ざらない', () => {
  assert.equal(count('SDGsを話そう', 'こどもそうだんしつ'), total('こどもそうだんしつ'));
  assert.equal(hit('こどもそうだんしつ').filter((x) => !['こどもそうだんしつ', 'SDGsを話そう'].includes(x.show)).length <= 5, true);
});
test('索引を使わない検索（filterEpisodes）も同じ', () => {
  const r = filterEpisodes([{ id: 'EP-1', show: 'SDGsを話そう', date: '2026-01-01', title: 't', cast: '' }, { id: 'EP-2', show: '報談', date: '2026-01-01', title: 't', cast: '' }], { query: 'こどもそうだんしつ' });
  assert.deepEqual(r.map((x) => x.id), ['EP-1']);
});
