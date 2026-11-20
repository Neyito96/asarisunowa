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

test('#412 表紙の取得は新しく登録されたリストだけ（保存値があるリストは選ばない）', () => {
  const A = 'A'.repeat(22), B = 'B'.repeat(22), C = 'C'.repeat(22), D = 'D'.repeat(22);
  const stored = { [A]: { artwork: 'a' }, [C]: { artwork: 'c' } };
  assert.deepEqual(M.plmPickNew_([A, B, C, D, D, 'bad'], stored, 4), [B, D]);
  assert.deepEqual(M.plmPickNew_([A, B, D], stored, 1), [B]);
  assert.deepEqual(M.plmPickNew_([A, C], stored, 4), []);
});

test('#412 最終新着日は追加した回の配信日から（新しい時だけ・配信日の形が違うものは無視）', () => {
  assert.equal(M.plmLatestAfterAdd_('2026-11-10', [{ release_date: '2026-11-17' }, { release_date: '2026-11-12' }]), '2026-11-17');
  assert.equal(M.plmLatestAfterAdd_('2026-11-10', [{ date: '2026-11-15' }]), '2026-11-15');   // 蔵から育てるリストは date
  assert.equal(M.plmLatestAfterAdd_('2026-11-20', [{ release_date: '2026-11-17' }]), '');     // 古い回を足しただけなら変えない
  assert.equal(M.plmLatestAfterAdd_('', [{ release_date: '2026' }, {}]), '');
  assert.equal(M.plmLatestAfterAdd_('', [{ release_date: '2026-01-02' }]), '2026-01-02');
});
