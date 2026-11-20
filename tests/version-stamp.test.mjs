// #430 データ更新とアプリ版の表示
import test from 'node:test';
import assert from 'node:assert/strict';
import { versionFromDates, appVersion } from '../scripts/lib/app-version.mjs';
import { stampText } from '../public/library/stamp.mjs';

test('アプリ版は最後にコードを変えた日。同じ日に複数回なら回数を付ける', () => {
  assert.equal(versionFromDates(['2026-11-21']), 'v2026.11.21');
  assert.equal(versionFromDates(['2026-11-21', '2026-11-21', '2026-11-20']), 'v2026.11.21.2');
  assert.equal(versionFromDates([]), '');
});
test('git が使えないときは空（表示しない）', () => {
  assert.equal(appVersion('public/uchu', () => { throw new Error('no git'); }), '');
});
test('表示の1行：日本時間・最新回・回数・版', () => {
  assert.equal(stampText({ generatedAt: '2026-11-20T22:48:53Z', newest: { date: '2026-11-21' }, count: 6097, app: 'v2026.11.21' }), 'データ 11/21 07:48 更新 · 最新回 11/21 · 6,097回 · v2026.11.21');
  assert.equal(stampText({}), '');
});
