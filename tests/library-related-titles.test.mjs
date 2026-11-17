// #308 関連記事の見出し付け（URLは増やさない）と QR コード
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { titledRelated, normArticleUrl } from '../scripts/library-related/apply-related-titles.mjs';
import { qrMatrix, qrSvg } from '../public/library/qr.mjs';
test('URLの正規化で同じ記事に見出しを付ける。見出しが無い記事はURLのまま。URLを足さない', () => {
  const r = titledRelated(['https://www.asahi.com/articles/A1.html?iref=omny', 'https://www.asahi.com/articles/B2.html', 'https://www.asahi.com/articles/A1.html'], [['見出しA', 'https://www.asahi.com/articles/A1.html'], ['関係ない', 'https://www.asahi.com/articles/Z9.html']]);
  assert.deepEqual(r, [{ title: '見出しA', url: 'https://www.asahi.com/articles/A1.html?iref=omny' }, { title: '', url: 'https://www.asahi.com/articles/B2.html' }]);
  assert.equal(normArticleUrl('http://WWW.asahi.com/articles/A1.html/?x=1'), 'https://www.asahi.com/articles/A1.html');
});
test('QRコード: 型番と大きさ・URLが長すぎるときは作らない', () => {
  assert.equal(qrMatrix('https://www.asahi.com/articles/ASV490PH4V49UCVL01MM.html').length, 33);
  assert.equal(qrMatrix('x'.repeat(400)), null);
  assert.match(qrSvg('https://a.jp/'), /^<svg[^>]+viewBox="0 0 29 29"/);
});
test('詳細画面: 見出しがあれば見出しをリンクに、URLも表示、QRはパソコンだけ・押したときに作る', () => {
  const src = fs.readFileSync(new URL('../public/library/library.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes("import { qrSvg } from './qr.mjs'"));
  assert.ok(/related-article/.test(src) && /related-url/.test(src));
  assert.ok(src.includes("'(min-width: 900px) and (pointer: fine)'"));
});
