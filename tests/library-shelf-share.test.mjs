import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readShelf, toggleItem, moveItem, setMeta, encodeShare, decodeShare, cardLinks, SHELF_LIMITS } from '../public/library/shelf-core.mjs';

test('旧形式（EP-IDの配列）の棚を読み替える', () => {
  const s = readShelf(JSON.stringify(['EP-00001', 'bad', 'EP-00002', 'EP-00001']));
  assert.deepEqual(s.ids, ['EP-00001', 'EP-00002']);
  assert.equal(s.title, '');
});
test('追加・外す・並べ替え・上限', () => {
  let s = readShelf(null);
  s = toggleItem(s, 'EP-00010'); s = toggleItem(s, 'EP-00020'); s = toggleItem(s, 'EP-00030');
  assert.deepEqual(moveItem(s, 'EP-00030', -1).ids, ['EP-00010', 'EP-00030', 'EP-00020']);
  assert.deepEqual(toggleItem(s, 'EP-00020').ids, ['EP-00010', 'EP-00030']);
  let full = readShelf(null); for (let i = 1; i <= SHELF_LIMITS.items + 5; i++) full = toggleItem(full, 'EP-' + String(i).padStart(5, '0'));
  assert.equal(full.ids.length, SHELF_LIMITS.items);
});
test('共有URLにはEP番号とタイトル・説明だけが入り、往復できる', () => {
  const s = setMeta(toggleItem(toggleItem(readShelf(null), 'EP-06739'), 'EP-00301'), { title: '通勤用', description: '説明' });
  const frag = encodeShare(s);
  assert.match(frag, /^s=1\.[A-Za-z0-9_-]+$/);
  const raw = JSON.parse(Buffer.from(frag.slice(4), 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(raw).sort(), ['d', 'i', 't']);   // 名前・端末ID・検索語などの欄は無い
  const back = decodeShare('#' + frag);
  assert.deepEqual(back.ids, ['EP-06739', 'EP-00301']);
  assert.equal(back.title, '通勤用');
});
test('壊れた・悪意のある共有URLは表示しない', () => {
  assert.equal(decodeShare('#s=1.!!!'), null);
  assert.equal(decodeShare('#q=秘密'), null);
  assert.ok(!encodeShare({ title: '', description: '', ids: [] }));
});
test('共有カードの配信リンクは既知の配信先だけ（音声ファイル直リンク・不明なサイトは出さない）', () => {
  const links = cardLinks(['https://open.spotify.com/episode/x', 'https://example.com/a', 'https://x.example/a.mp3', 'https://open.spotify.com/episode/y', 'https://evil-spotify.com/x', 'http://podcasts.apple.com/x']);
  assert.deepEqual(links.map((l) => l.url), ['https://open.spotify.com/episode/x']);
});
test('蔵のページは検索の言葉を端末に保存しない', () => {
  const src = fs.readFileSync(new URL('../public/library/library.mjs', import.meta.url), 'utf8');
  const sets = [...src.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1].trim());
  assert.deepEqual([...new Set(sets)], ['SHELF_KEY']);
  assert.ok(!/sessionStorage|indexedDB|document\.cookie/.test(src));
});
