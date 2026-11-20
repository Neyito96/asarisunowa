import test from 'node:test';
import assert from 'node:assert/strict';
import { stripCastUrls } from '../scripts/library/clean-cast-urls.mjs';

test('#309 出演者欄の URL だけを外し、人名・所属は残す', () => {
  assert.equal(stripCastUrls('神田大介 / 太田匡彦,文化くらし報道部,http://twitter.com/abc / 西田有里,さいたま総局員'), '神田大介 / 太田匡彦,文化くらし報道部 / 西田有里,さいたま総局員');
  assert.equal(stripCastUrls('堀江昌史,元朝日新聞記者,https://twitter.com/x'), '堀江昌史,元朝日新聞記者');
  assert.equal(stripCastUrls('潮智史 https://x.com/u'), '潮智史');
  assert.equal(stripCastUrls('神田大介'), '神田大介');
  assert.equal(stripCastUrls(''), '');
});

import { castFromRules } from '../scripts/library-sync-v2.mjs';
test('#309 番組ごとの規則: ニュースの学校で V2 の出演者が空の回だけに使う', () => {
  const rules = [{ show: 'ニュースの学校', cast: '神田大介' }];
  const v2 = [
    { 'EP-ID': 'EP-1', '番組': 'ニュースの学校', '出演者': '' },
    { 'EP-ID': 'EP-2', '番組': 'ニュースの学校', '出演者': '杢田光' },
    { 'EP-ID': 'EP-3', '番組': '報談', '出演者': '' },
    { 'EP-ID': 'EP-4', '番組': 'ニュースの学校', '出演者': 'https://example.com' },   // URL だけ＝名前なし
  ];
  assert.deepEqual([...castFromRules(v2, rules)], [['EP-1', '神田大介'], ['EP-4', '神田大介']]);
  assert.deepEqual([...castFromRules(v2, [])], []);
});
