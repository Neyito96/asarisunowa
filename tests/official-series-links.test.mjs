import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('app/official-series-links.ts', 'utf8');
const data = fs.readFileSync('app/data.ts', 'utf8');
const series = [...src.matchAll(/^  "([^"]+)": \{ pgid: "([^"]+)", name: "([^"]+)", kind: "(番組|連載)", url: "([^"]+)" \},$/gm)];
const map = [...src.matchAll(/^  "([A-Za-z0-9_-]+)": "([^"]+)", \/\/ (\d+) (.*)$/gm)];

test('公式連載リンク: 対応表のpgidはすべて公式一覧にある・URLは公式トップ配下だけ', () => {
  assert.ok(series.length >= 18);
  const ids = new Set(series.map((m) => m[1]));
  for (const m of series) { assert.equal(m[1], m[2]); assert.match(m[5], /^https:\/\/www\.asahi\.com\/special\/podcasts\/\?pgid=[A-Za-z0-9_\-]+$/); assert.ok(m[5].endsWith('pgid=' + m[1])); }
  for (const m of map) assert.ok(ids.has(m[2]), m[2]);
});
test('公式連載リンク: キーは実在するプレイリストのSpotify ID・未確認の連載は対応表に入れない', () => {
  assert.ok(map.length >= 20);
  for (const m of map) assert.ok(data.includes('/playlist/' + m[1]) || data.includes('list=' + m[1]), m[1]);
  for (const bad of ['funa', 'akiyamanoriko', 'newschat']) assert.ok(!map.some((m) => m[2] === bad), bad);
});
test('公式連載リンク: 将来の6サービスは別の表（空）で、表示は表を読むだけ', () => {
  assert.match(src, /PLAYLIST_PLATFORM_LINKS: Record<string, Partial<Record<PlatformKey, string>>> = \{\};/);
  for (const k of ['apple', 'amazon', 'spotify', 'pocketcasts', 'listen', 'pody']) assert.match(src, new RegExp(k + ': "'));
  const ui = fs.readFileSync('app/community.tsx', 'utf8');
  assert.match(ui, /officialSeriesForPlaylist\(p\.url\)/); assert.match(ui, /className="listen"/);   // 既存の再生ボタンは残る
});
