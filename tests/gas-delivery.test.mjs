import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../tools/gas-delivery/Delivery.js', import.meta.url), 'utf8'), ctx);
const D = ctx.module.exports;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('配達計画: 本番だけのファイルは残し、本番の appsscript.json は変えない', () => {
  const current = [
    { name: 'appsscript', type: 'JSON', source: '{"a":1}' },
    { name: 'A', type: 'SERVER_JS', source: 'var a = 1;\n' },
    { name: 'B', type: 'SERVER_JS', source: 'var b = 1;' },
    { name: 'OnlyHere', type: 'SERVER_JS', source: 'var x;' },
  ];
  const github = [
    { name: 'appsscript', type: 'JSON', source: '{"a":2}' },
    { name: 'A', type: 'SERVER_JS', source: 'var a = 1;\r\n' },   // 改行の違いだけ → 同じ
    { name: 'B', type: 'SERVER_JS', source: 'var b = 2;' },
    { name: 'New', type: 'SERVER_JS', source: 'var n;' },
  ];
  const p = plain(D.deliveryPlan_(current, github));
  assert.deepEqual(p.added, ['New']);
  assert.deepEqual(p.changed, ['B']);
  assert.equal(p.same, 1);
  assert.deepEqual(p.keptTargetOnly, ['OnlyHere']);
  assert.equal(p.manifestDiffers, true);
  const names = p.files.map((f) => f.name).sort();
  assert.deepEqual(names, ['A', 'B', 'New', 'OnlyHere', 'appsscript']);
  assert.equal(p.files.find((f) => f.name === 'appsscript').source, '{"a":1}');   // 本番の権限設定のまま
  assert.equal(p.files.find((f) => f.name === 'B').source, 'var b = 2;');
});

test('配達用の束: .js と appsscript.json だけを名前順に入れ、.md は入れない', async () => {
  const { buildGasBundle } = await import('../scripts/build-gas-bundle.mjs');
  const b = buildGasBundle(new URL('../scripts/google-apps-script', import.meta.url).pathname, 'abc');
  assert.equal(b.sha, 'abc');
  assert.match(b.digest, /^[0-9a-f]{64}$/);
  assert.ok(b.files.some((f) => f.name === 'appsscript' && f.type === 'JSON'));
  assert.ok(b.files.some((f) => f.name === 'LibraryTheme' && f.type === 'SERVER_JS'));
  assert.ok(!b.files.some((f) => /AGENTS|README/.test(f.name)));
  const names = b.files.map((f) => f.name);
  assert.deepEqual(names, [...names].sort());
});
