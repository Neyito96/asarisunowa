import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../scripts/google-apps-script/LibraryPlaylist.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(new URL('../scripts/google-apps-script/LibraryTheme.js', import.meta.url), 'utf8'), ctx);
const T = ctx.module.exports;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('テーマ規則: 2026-11-24以降の「増分自動更新」のテーマ別だけ', () => {
  const row = (date, status, memo) => [date, 'https://open.spotify.com/playlist/5JjGlKcagfLyDkg0cLZggK?si=x', '朝鮮・韓国・コリア', 'x', '', '在日コリアン、ウトロ', '', status, memo];
  assert.equal(T.libraryThemeRuleFromRequestRow_(row('2026/11/24 11:15:57', '増分自動更新', '方式: theme / Theme V3自動開始'), []).keywords.join('|'), '在日コリアン|ウトロ');
  assert.equal(T.libraryThemeRuleFromRequestRow_(row('2026/10/05 15:33:08', '増分自動更新', '方式: theme / x'), []), null);          // 以前のテーマ（台湾など）は変えない
  assert.ok(T.libraryThemeRuleFromRequestRow_(row('2026/10/05 15:33:08', '増分自動更新', '方式: theme / x'), ['5JjGlKcagfLyDkg0cLZggK']));   // 足せば対象
  assert.equal(T.libraryThemeRuleFromRequestRow_(row('2026/11/24 11:15:57', '確認待ち', '方式: theme / x'), []), null);
  assert.equal(T.libraryThemeRuleFromRequestRow_(row('2026/11/24 11:15:57', '増分自動更新', '方式: series / x'), []), null);
});

test('蔵の題名・概要でキーワード一致（大文字小文字・全半角を区別しない）', () => {
  const rule = { keywords: ['ウトロ', 'TAIWAN', '本'] };   // 1文字の語は使わない
  const lite = [['EP-1', 0, '2024-01-02T04:00', 'ウトロの話'], ['EP-2', 1, '2023-01-01T04:00', '別の話'], ['EP-3', 0, '2025-01-01T04:00', '本の話']];
  const got = T.libraryThemePick_(rule, ['A', 'B'], lite, { 'EP-2': 'ｔａｉｗａｎ で取材' });
  assert.deepEqual(plain(got.map((p) => p.ep)), ['EP-2', 'EP-1']);
  assert.deepEqual(plain(got[0].matched), ['TAIWAN']);
});

test('計画: 番組・題名がSpotifyと一致する回だけ、タブにない回だけ', () => {
  const rule = { keywords: ['x'] };
  const picked = [
    { ep: 'EP-1', show: '報談', date: '2025-07-15', title: '題A', matched: ['x'] },
    { ep: 'EP-2', show: '報談', date: '2025-07-16', title: '題B', matched: ['x'] },
    { ep: 'EP-3', show: '報談', date: '2025-07-17', title: '題C', matched: ['x'] },
    { ep: 'EP-4', show: 'SDGsを話そう', date: '2026-03-13', title: '題D', matched: ['x'] },
    { ep: 'EP-5', show: '報談', date: '2025-07-18', title: '題E', matched: ['x'] },
    { ep: 'EP-6', show: '報談', date: '2025-07-19', title: '題F', matched: ['x'] },
  ];
  const lookup = { 'EP-1': { spotifyId: 's1' }, 'EP-2': { spotifyId: 's2' }, 'EP-3': { spotifyId: 's3' }, 'EP-4': { spotifyId: 's4' }, 'EP-6': { spotifyId: 's6' } };
  const verified = { s1: { name: '題A', showId: '5Dt1uyQaJpM6hPV8aEMP3R' }, s3: { name: '違う題', showId: '5Dt1uyQaJpM6hPV8aEMP3R' }, s4: { name: '題D', showId: '7vuSolzvNiNwu7UR4lVIwU' } };
  const plan = T.libraryThemePlan_(rule, picked, lookup, verified, { s2: true });
  assert.deepEqual(plain(plan.rows.map((r) => r.ep)), ['EP-1', 'EP-4']);   // SDGsはアーカイブ番組で一致
  assert.equal(plan.already, 1);
  assert.deepEqual(plain(plan.hold.map((h) => h.ep)), ['EP-3']);
  assert.deepEqual(plain(plan.missing), ['EP-5']);
  assert.equal(plan.unverified.length, 1);   // EP-6 は今回は確かめていない
});

test('実データ: 朝鮮・韓国・コリアのキーワードで蔵から22回前後見つかる', () => {
  const d = 'public/library/data/';
  const m = JSON.parse(fs.readFileSync(d + 'manifest.json', 'utf8')).searchIndex;
  const lite = JSON.parse(fs.readFileSync(d + m.lite, 'utf8'));
  const text = {};
  m.text.forEach((p) => JSON.parse(fs.readFileSync(d + p, 'utf8')).forEach((r) => { text[r[0]] = r[1]; }));
  const kw = '在日コリアン、在日朝鮮人、在日韓国人、在日韓国・朝鮮人、在日外国人、朝鮮籍、韓国籍、特別永住者、植民地支配、朝鮮人虐殺、関東大震災、強制連行、徴用工、ウトロ、指紋押捺、民族差別、ヘイトスピーチ、帰還事業、朝鮮学校、朝鮮大学校、韓国学校、民族教育、朝鮮総連、民団、コリアンタウン、生野、鶴橋、新大久保';
  const got = T.libraryThemePick_({ keywords: T.libraryThemeSplitKeywords_(kw) }, m.shows, lite, text);
  assert.ok(got.length >= 15 && got.length <= 40, String(got.length));
});

test('同じ題名は1本だけ（タブにある題名・今回の重複とも）', () => {
  const picked = [
    { ep: 'EP-1', show: '報談', date: '2023-07-28', title: '分割配信　ワンピース #1199', matched: ['x'], strong: true },
    { ep: 'EP-2', show: '報談', date: '2023-08-01', title: '題B', matched: ['x'], strong: true },
    { ep: 'EP-3', show: '報談', date: '2023-08-02', title: '題B', matched: ['x'], strong: true },
  ];
  const lookup = { 'EP-1': { spotifyId: 's1' }, 'EP-2': { spotifyId: 's2' }, 'EP-3': { spotifyId: 's3' } };
  const v = (n) => ({ name: n, showId: '5Dt1uyQaJpM6hPV8aEMP3R' });
  const plan = T.libraryThemePlan_({ keywords: ['x'] }, picked, lookup, { s1: v('分割配信　ワンピース #1199'), s2: v('題B'), s3: v('題B') }, {}, { '分割配信ワンピース#1199': true });
  assert.deepEqual(plain(plan.rows.map((r) => r.ep)), ['EP-2']);
  assert.equal(plan.sameTitle, 2);
});

test('厳しめモード: 概要に1回だけの回は未確認（既定はすべて採用）', () => {
  const lite = [['EP-1', 0, '2024-01-01T04:00', 'ウトロの話'], ['EP-2', 0, '2024-01-02T04:00', '別の話'], ['EP-3', 0, '2024-01-03T04:00', 'また別']];
  const got = T.libraryThemePick_({ keywords: ['ウトロ'] }, ['報談'], lite, { 'EP-2': 'ウトロに行った', 'EP-3': 'ウトロ、そしてウトロ' });
  assert.deepEqual(plain(got.map((p) => [p.ep, p.strong])), [['EP-1', true], ['EP-2', false], ['EP-3', true]]);
  const lookup = { 'EP-1': { spotifyId: 's1' }, 'EP-2': { spotifyId: 's2' }, 'EP-3': { spotifyId: 's3' } };
  const ver = { s1: { name: 'ウトロの話', showId: '5Dt1uyQaJpM6hPV8aEMP3R' }, s2: { name: '別の話', showId: '5Dt1uyQaJpM6hPV8aEMP3R' }, s3: { name: 'また別', showId: '5Dt1uyQaJpM6hPV8aEMP3R' } };
  const def = T.libraryThemePlan_({ keywords: ['ウトロ'] }, got, lookup, ver, {});
  assert.deepEqual(plain(def.rows.map((r) => r.strong)), [true, true, true]);
  const strict = T.libraryThemePlan_({ keywords: ['ウトロ'], strict: true }, got, lookup, ver, {});
  assert.deepEqual(plain(strict.rows.map((r) => r.strong)), [true, false, true]);
});
