// 公開の場（PRコメント・成果物・ログ）に出す前の本文混入検査。混入の疑いがあれば例外で止める（投稿しない）。
// 許すのは: 識別子・URL・日時・番組名・題名（短い文字列）・数値・ハッシュ。概要原文/本文/HTML/長文は不可。
export const FORBIDDEN_KEYS = /^(descriptionRaw|description|content|contentEncoded|summary|body|text|概要原文|清掃済み本文)$/i;
export function assertPublishable(value, { maxLen = 300, path = '$' } = {}) {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    if (/<\s*(p|br|a|div|span)\b|&nbsp;|&hellip;/i.test(value)) throw new Error('LEAK_HTML ' + path);
    if (!/^https?:\/\/\S+$/.test(value) && value.length > maxLen) throw new Error('LEAK_LONG_TEXT ' + path + ' len=' + value.length);
    return true;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => assertPublishable(v, { maxLen, path: `${path}[${i}]` })); return true; }
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(k) && typeof v === 'string' && v.length) throw new Error('LEAK_KEY ' + path + '.' + k);
    assertPublishable(v, { maxLen, path: `${path}.${k}` });
  }
  return true;
}
