// 蔵を正本に既存 Spotify プレイリスト（ポすすめ）を育てる: 対象回の選び方と追加計画（Spotify・シートは使わない）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/LibraryPlaylist.js', import.meta.url), 'utf8'), ctx);
const L = ctx.module.exports, RULE = L.LIBRARY_PLAYLIST_RULES_[0];
const A = (c) => c.repeat(22);
test('蔵の実データ: ポすすめはドーナツの題名「（ポすすめ）」の回を古い順に選ぶ', () => {
  const m = JSON.parse(fs.readFileSync('public/library/data/manifest.json', 'utf8'));
  const lite = JSON.parse(fs.readFileSync('public/library/data/search/lite.json', 'utf8'));
  const picked = Array.from(L.libraryPlaylistPick_(RULE, m.searchIndex.shows, lite));
  assert.ok(picked.length >= 8);
  assert.ok(picked.every((p) => p.title.includes('ポすすめ')));
  assert.deepEqual(picked.map((p) => p.date), [...picked.map((p) => p.date)].sort());
});
test('他の番組の同じ語は選ばない', () => {
  const r = Array.from(L.libraryPlaylistPick_(RULE, ['ドーナツ', 'MEDIA TALK'], [['EP-1', 1, '2026-01-01', '（ポすすめ）x', ''], ['EP-2', 0, '2026-01-02', '（ポすすめ）y', '']]));
  assert.deepEqual(r.map((x) => x.ep), ['EP-2']);
});
test('追加計画: 重複・Spotify URLなし・番組違い・題名違いを分ける', () => {
  const picked = [{ ep: 'EP-1', title: '（ポすすめ）a', date: '1' }, { ep: 'EP-2', title: '（ポすすめ）b', date: '2' }, { ep: 'EP-3', title: '（ポすすめ）c', date: '3' }, { ep: 'EP-4', title: '（ポすすめ）d', date: '4' }, { ep: 'EP-5', title: '（ポすすめ）e', date: '5' }];
  const lookup = { 'EP-1': { spotifyId: A('A') }, 'EP-2': { spotifyId: A('B') }, 'EP-3': { spotifyId: '' }, 'EP-4': { spotifyId: A('D') }, 'EP-5': { spotifyId: A('E') } };
  const verified = { [A('A')]: { name: '（ポすすめ）a', showId: RULE.showId }, [A('B')]: { name: '（ポすすめ）b', showId: RULE.showId }, [A('D')]: { name: '（ポすすめ）d', showId: 'X'.repeat(22) }, [A('E')]: { name: '別の題', showId: RULE.showId } };
  const plan = L.libraryPlaylistPlan_(RULE, picked, lookup, verified, { ['spotify:episode:' + A('B')]: true });
  assert.deepEqual(Array.from(plan.add, (a) => a.ep), ['EP-1']);
  assert.deepEqual(Array.from(plan.already), ['EP-2']);
  assert.deepEqual(Array.from(plan.missing), ['EP-3']);
  assert.deepEqual(Array.from(plan.hold, (h) => h.ep), ['EP-4', 'EP-5']);
});
test('同じ回が2つの行から来ても1回だけ追加', () => {
  const picked = [{ ep: 'EP-1', title: 't', date: '1' }, { ep: 'EP-9', title: 't', date: '2' }];
  const lookup = { 'EP-1': { spotifyId: A('A') }, 'EP-9': { spotifyId: A('A') } };
  const plan = L.libraryPlaylistPlan_(RULE, picked, lookup, { [A('A')]: { name: 't', showId: RULE.showId } }, {});
  assert.equal(plan.add.length, 1); assert.equal(plan.already.length, 1);
});
