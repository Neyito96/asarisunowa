// 蔵書 → Spotify 追加の計画（Spotify・シートに触れない検証）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/ShelfSpotify.js', import.meta.url), 'utf8'), ctx);
const S = ctx.module.exports;
const A = 'A'.repeat(22), B = 'B'.repeat(22);
test('プレイリストURLとエピソードIDは実在の形だけを読む', () => {
  assert.equal(S.shelfPlaylistId_('https://open.spotify.com/playlist/' + A + '?si=x'), A);
  assert.equal(S.shelfPlaylistId_('https://open.spotify.com/show/' + A), '');
  assert.equal(S.shelfSpotifyEpisodeId_(['https://omny.fm/x', 'https://open.spotify.com/episode/' + B]), B);
  assert.equal(S.shelfSpotifyEpisodeId_(['https://open.spotify.com/episode/short']), '');
});
test('蔵のバケットから引き、並び順を保って既存・Spotifyなしを分ける', () => {
  const urls = [];
  const lookup = S.shelfLibraryLookup_(['EP-00051', 'EP-00002', 'EP-00003'], (u) => { urls.push(u); return u.endsWith('/1.json') ? [{ id: 'EP-00051', title: 't51', links: ['https://open.spotify.com/episode/' + A] }] : [{ id: 'EP-00002', title: 't2', links: ['https://open.spotify.com/episode/' + B] }, { id: 'EP-00003', links: [] }]; });
  assert.equal(urls.length, 2);
  const plan = S.shelfSpotifyPlan_(['EP-00051', 'EP-00002', 'EP-00003', 'EP-09999'], lookup, { ['spotify:episode:' + B]: true });
  assert.deepEqual(Array.from(plan.add, (x) => x.ep), ['EP-00051']);
  assert.equal(plan.already, 1);
  assert.deepEqual(Array.from(plan.missing), ['EP-00003', 'EP-09999']);
});
