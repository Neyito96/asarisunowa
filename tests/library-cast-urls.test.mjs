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
