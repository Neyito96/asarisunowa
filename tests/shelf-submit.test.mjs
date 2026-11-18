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
