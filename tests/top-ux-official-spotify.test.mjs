import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = fs.readFileSync('app/community.tsx', 'utf8'), bridge = fs.readFileSync('app/PlaylistEntryModeBridge.tsx', 'utf8'), css = fs.readFileSync('app/desktop-top-nav.css', 'utf8');

test('公式ボタン: ラベルを常時表示し、ツールチップと読み上げ名でリンク先（朝日新聞側の公式ページ）を示す', () => {
  assert.match(src, /function OfficialLink\(/);
  assert.match(src, /<span className="officialBadge" aria-hidden="true">公式<\/span>/);
  assert.match(src, /title=\{`\$\{t\.where\}を別タブで開きます`\}/);
  assert.match(src, /aria-label=\{`\$\{programName\}：\$\{t\.where\}（別タブで開く）`\}/);
  assert.match(css, /\.officialBadge \{/);
});
test('朝公式の見出しは「公式プレイリスト」と言わない（Spotifyのプレイリストと混同しない）', () => {
  assert.doesNotMatch(src, /OFFICIAL PLAYLISTS|公式プレイリストです/);
  assert.doesNotMatch(css, /朝公式プレイリスト/);
});
test('連載・朝リスト: タブに Spotify を出し、棚の説明に Spotify 専用・公式ページではないこと・他サービスへの道を書く', () => {
  assert.match(src, /🐿️朝リスト<span className="tabSub" aria-hidden="true">Spotify<\/span>/);
  assert.match(src, /aria-label="朝リスト（Spotifyのプレイリスト）"/);
  assert.match(bridge, /sub\.textContent = "Spotify"/);
  assert.match(bridge, /"連載（Spotifyのプレイリスト）"/);
  assert.match(src, /className="playlistSpotifyNote" role="note"/);
  assert.match(src, /朝日新聞の公式ページではありません/);
  assert.match(src, /Spotify以外で聴くときは、「朝公式」の番組ページから/);
});
test('タブは tablist の中で role=tab と aria-selected を持つ', () => {
  const tabs = src.slice(src.indexOf('className="wrap viewTabs"'), src.indexOf('{view === "listeners" ? ('));
  assert.equal((tabs.match(/role="tab"/g) || []).length, 6);
  assert.equal((tabs.match(/aria-selected=\{view === /g) || []).length, 6);
  assert.match(bridge, /seriesTab\.setAttribute\("aria-selected"/);
});
test('報談の公式リンクは朝日新聞の番組ページ（pgid）を指す', () => {
  assert.doesNotMatch(src, /official: "https:\/\/omny\.fm\/shows\/asahi\/playlists\/playlist-1"/);
  assert.match(src, /official: "https:\/\/www\.asahi\.com\/special\/podcasts\/\?pgid=9212d823-d670-423a-ab01-ac1000d97d6f"/);
});
