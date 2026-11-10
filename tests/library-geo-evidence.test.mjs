import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPlaces, pinnedPlaces} from '../public/library/geo-evidence.mjs';
const d = (title, description = '') => Object.fromEntries(classifyPlaces({title, description}).map(x => [x.place, x.decision]));
test('a bare 日本 mention never creates a pin (the old mis-pin)', () => {
  assert.equal(d('今週のニュース', 'この1週間に起きた日本と世界の気になるニュースを解説します。').日本, 'TAG');
  assert.deepEqual(pinnedPlaces({title: '今週のニュース', description: '日本人研究者の業績にも注目。日本語で配信します。'}), []);
});
test('nationality, language and relation uses are tags, not pins', () => {
  assert.equal(d('日本人が出演した話題作').日本, undefined); // 日本人/日本語 are not place mentions at all
  assert.equal(d('日本と中国の関係を考える').日本, 'TAG');
  assert.equal(d('日本と中国の関係を考える').中国, 'TAG');
});
test('a domestic event named in the title can be pinned', () => {
  assert.equal(d('日本各地で開催された収穫祭').日本, 'PIN');
});
test('title evidence pins a foreign place; ambiguous short names are held or not matched inside words', () => {
  assert.equal(d('キューバ取材報告').キューバ, 'PIN');
  assert.equal(d('タイトルの付け方とスタイル').タイ, undefined);
  assert.equal(d('旅の記録', 'タイは暑かった。').タイ, 'HOLD');
  assert.equal(d('パリの街角').フランス, 'PIN');
  assert.equal(d('パリティ入門').フランス, undefined);
});
test('body-only mention is a tag; repeated located cues in the body pin', () => {
  assert.equal(d('ある回', 'ジャカルタについて少し触れます。').ジャカルタ, 'TAG');
  assert.equal(d('ある回', 'ジャカルタで取材しました。ジャカルタの現地で開催された会議です。').ジャカルタ, 'PIN');
});
test('インドネシア does not trigger インド', () => {
  assert.equal(d('インドネシアの選挙').インド, undefined);
});
