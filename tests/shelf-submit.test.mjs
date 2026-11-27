// #345 蔵書推薦の受付（GASを使わない検証）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/ShelfSubmit.js', import.meta.url), 'utf8'), ctx);
const S = ctx.module.exports;
test('回番号の形・重複・件数・ハニーポットを確かめ、式として読まれる文字を無害化する', () => {
  const ok = S.shelfValidate_({ ids: 'EP-00001,EP-00002,EP-00001', title: '=通勤', note: 'よかった' });
  assert.equal(ok.ok, true); assert.equal(ok.value.ids.join(','), 'EP-00001,EP-00002'); assert.equal(ok.value.title, "'=通勤");
  assert.equal(S.shelfValidate_({ ids: 'EP-1' }).errors[0], 'BAD_ID');
  assert.equal(S.shelfValidate_({ ids: '' }).errors[0], 'NO_ITEMS');
  assert.equal(S.shelfValidate_({ ids: Array.from({ length: 51 }, (_, i) => 'EP-' + String(i).padStart(5, '0')).join(',') }).errors[0], 'TOO_MANY');
  assert.equal(S.shelfValidate_({ ids: 'EP-00001', hp: 'x' }).errors[0], 'HONEYPOT');
});

test('みんなの蔵書（#463）: 「公開OK」の行だけを出し、ひとこと・管理メモは出さない', () => {
  const row = (id, st, nick, note) => [id, '2026-11-27T06:14:55.922Z', st, 'EP-01228 EP-00697 bad', '2', "'=満州", '説明', note, nick, 'key', '管理メモ', '希望', '', ''];
  const out = S.shelfPublicRows_([row('SH-20261127061455-430', '公開OK', 'マンモス', '管理人あての伝言'), row('SH-20261118013222-808', '承認待ち', '', 'x'), row('bad', '公開OK', '', '')]);
  assert.equal(out.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(out[0])), { id: 'SH-20261127061455-430', date: '2026-11-27', title: '=満州', description: '説明', ids: ['EP-01228', 'EP-00697'], nick: 'マンモス' });
  assert.ok(!JSON.stringify(out).includes('伝言') && !JSON.stringify(out).includes('管理メモ'));
});

test('みんなの蔵書: URL・メール・電話番号らしきものがあれば自動では載せない', () => {
  assert.equal(S.shelfPublicBlocked_({ title: '満州国', description: '2024年1月から半年間の連載', nick: 'マンモス' }), '');
  assert.equal(S.shelfPublicBlocked_({ title: '見て', description: 'https://example.jp', nick: '' }), 'URL');
  assert.equal(S.shelfPublicBlocked_({ title: 'a', description: '090-1234-5678', nick: '' }), 'PHONE');
  assert.equal(S.shelfPublicBlocked_({ title: 'a', description: '', nick: 'me@example.com' }) !== '', true);
  assert.equal(S.shelfValidate_({ ids: 'EP-00001', publish: '1' }).value.publish, true);
  assert.equal(S.shelfPublicRows_([['SH-20261127061455-430', '2026-11-27T00:00:00Z', '公開', 'EP-00001', '1', 't', '', '', '', 'k', '', '', '', '']]).length, 1);
  assert.equal(S.shelfPublicRows_([['SH-20261127061455-430', '2026-11-27T00:00:00Z', '非公開', 'EP-00001', '1', 't', '', '', '', 'k', '', '', '', '']]).length, 0);
});
