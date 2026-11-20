// 投稿された Spotify リストの表紙・最終新着を Spotify から直接読む部分と、作業台 J/K 列からの自動育成規則（純粋関数のみ。通信なし）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const load = (f) => { const c = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/' + f, import.meta.url), 'utf8'), c); return c.module.exports; };
const M = load('PlaylistLiveMeta.js');
const L = load('LibraryPlaylist.js');
const ID = 'A'.repeat(22);

test('最終新着: 入っている回の中で一番新しい配信日', () => {
  const items = [
    { item: { release_date: '2026-10-01' } },
    { item: { release_date: '2026-11-17' } },
    { track: { release_date: '2026-09-30' } },
    { item: null },
  ];
  assert.equal(M.plmLatestFromItems_(items), '2026-11-17');
  assert.equal(M.plmLatestFromItems_([]), '');
});

test('表紙: 一番大きい画像（作成者の画像でも Spotify の自動画像でも、今 Spotify にあるもの）', () => {
  assert.equal(M.plmArtwork_([{ url: 's', width: 60 }, { url: 'l', width: 640 }, { url: 'm', width: 300 }]), 'l');
  assert.equal(M.plmArtwork_([{ url: 'x', width: null }]), 'x');
  assert.equal(M.plmArtwork_([]), '');
});

test('作業台 J(番組)・K(題名の語) から自動育成の規則を作る', () => {
  const r = L.libraryPlaylistRuleFromRow_([`https://open.spotify.com/playlist/${ID}?si=1`, '親モヤ', '', '', '', '', '', '', '連載', 'スポンジ', '（親モヤ）']);
  assert.equal(r.playlistId, ID);
  assert.equal(r.show, 'スポンジ');
  assert.equal(r.titleIncludes, '（親モヤ）');
  assert.ok(r.showId);
});

test('番組が不明・語が短い・URLが違う行は規則にしない', () => {
  const base = [`https://open.spotify.com/playlist/${ID}`, 't', '', '', '', '', '', '', ''];
  assert.equal(L.libraryPlaylistRuleFromRow_([...base, '知らない番組', '（親モヤ）']), null);
  assert.equal(L.libraryPlaylistRuleFromRow_([...base, 'スポンジ', 'a']), null);
  assert.equal(L.libraryPlaylistRuleFromRow_(['https://example.com/x', 't', '', '', '', '', '', '', '', 'スポンジ', '（親モヤ）']), null);
});

test('埋め込みページから回のIDを並び順で取る（曲・壊れたHTMLは無視）', () => {
  const E = (id) => ({ uri: 'spotify:episode:' + id });
  const data = { props: { pageProps: { state: { data: { entity: { trackList: [E('B'.repeat(22)), { uri: 'spotify:track:' + 'C'.repeat(22) }, E('D'.repeat(22))] } } } } } };
  const html = '<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify(data) + '</script></html>';
  assert.deepEqual(Array.from(M.plmEmbedEpisodeIds_(html)), ['B'.repeat(22), 'D'.repeat(22)]);
  assert.deepEqual(Array.from(M.plmEmbedEpisodeIds_('<html></html>')), []);
});

test('#412 取り直すリストの選び方: 未取得→古い順、20時間以内のものは選ばない、上限件数まで', () => {
  const now = Date.parse('2026-11-21T06:00:00Z'), h = 3600e3;
  const A = 'A'.repeat(22), B = 'B'.repeat(22), C = 'C'.repeat(22), D = 'D'.repeat(22);
  const stored = { [A]: { at: new Date(now - 30 * h).toISOString() }, [B]: { at: new Date(now - 2 * h).toISOString() }, [C]: { at: new Date(now - 21 * h).toISOString() } };
  assert.deepEqual(M.plmPickStale_([A, B, C, D, D, 'bad'], stored, now, 2, 20 * h), [D, A]);
  assert.deepEqual(M.plmPickStale_([A, B, C, D], stored, now, 10, 20 * h), [D, A, C]);
  assert.deepEqual(M.plmPickStale_([B], stored, now, 10, 20 * h), []);
});
