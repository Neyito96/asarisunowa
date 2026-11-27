// GAS 軽量版（gas/lite）が元の控えと「同じ中身」であることを確かめる（引っ越し準備・2026-11-27）
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import { build, splitDecls, SRC, OUT, ROOTS } from '../scripts/build-gas-lite.mjs';

// Apps Script の道具（読み込み時に呼ばれても何もしない人形）
function gasStub() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : proxy), apply: () => proxy });
  return proxy;
}
function load(files) {
  const names = ['SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'Utilities', 'ScriptApp', 'LockService', 'CacheService', 'MailApp', 'GmailApp',
    'HtmlService', 'ContentService', 'Session', 'Logger', 'DriveApp', 'CardService', 'OAuth2'];
  const ctx = { console: { log() {}, warn() {}, error() {} } }; for (const n of names) ctx[n] = gasStub();
  vm.createContext(ctx);
  // Apps Script はすべてのファイルを1つの場所に順に読み込む。const/let もファイルをまたいで見えるよう、1本につなげて読む
  const src = files.map(([f, s]) => `// FILE ${f}\n${s}`).join('\n;\n');
  vm.runInContext(src + '\n;globalThis.__names = {};', ctx, { filename: 'gas-all.js' });
  return ctx;
}
const liteFiles = () => fs.readdirSync(OUT).filter((f) => f.endsWith('.js')).sort().map((f) => [f, fs.readFileSync(path.join(OUT, f), 'utf8')]);
const srcFiles = () => fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort().map((f) => [f, fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^if \(typeof module !== 'undefined'\) module\.exports = .*$/gmu, '')]);

test('gas/lite は生成スクリプトの最新の結果（手で直していない）', () => {
  const { out } = build();
  for (const [k, s] of Object.entries(out)) assert.equal(fs.readFileSync(path.join(OUT, k), 'utf8'), s, k);
});

test('残した宣言の本文は、元のファイルの本文と1文字も違わない', () => {
  const { kept } = build();
  for (const d of kept) {
    const orig = splitDecls(d.file, fs.readFileSync(path.join(SRC, d.file), 'utf8')).filter((x) => x.name === d.name).pop();
    assert.equal(d.body, orig.body, d.file + ' ' + d.name);
  }
});

test('軽量版の9ファイルを順に読み込んでもエラーが出ず、入口の関数が全部ある', () => {
  const ctx = load(liteFiles());
  for (const n of ROOTS) assert.equal(vm.runInContext(`typeof ${n}`, ctx), 'function', n);
});

test('残した関数が使う名前は、軽量版の中にすべてある（呼び先の取りこぼしなし）', () => {
  const { kept } = build();
  const all = new Set(); for (const [f, s] of srcFiles()) for (const d of splitDecls(f, s)) all.add(d.name);
  const keptNames = new Set(kept.map((d) => d.name));
  for (const d of kept) for (const id of new Set(d.body.match(/[A-Za-z_$぀-鿿][\w$぀-鿿]*/gu) || [])) if (all.has(id)) assert.ok(keptNames.has(id), d.name + ' → ' + id);
});

test('読み込み直後の定数（ルール・列名・設定）は、元の67ファイルと軽量版で同じ値', () => {
  const a = load(srcFiles()), b = load(liteFiles());
  const { kept } = build();
  const consts = kept.filter((d) => /^(const|let|var)\s/.test(d.body)).map((d) => d.name);
  assert.ok(consts.length > 50, '定数が少なすぎる: ' + consts.length);
  const ser = (ctx, n) => { const v = vm.runInContext(n, ctx); return typeof v === 'function' ? 'fn:' + v.toString() : JSON.stringify(v, (k, x) => (x instanceof RegExp ? String(x) : typeof x === 'function' ? 'fn:' + x.toString() : x)); };
  for (const n of consts) assert.equal(ser(b, n), ser(a, n), n);
});

test('残したすべての関数の中身は、元の67ファイルと軽量版で同じ（後に書かれた方が勝つ規則も含めて）', () => {
  const a = load(srcFiles()), b = load(liteFiles());
  const { kept } = build();
  const fns = kept.filter((d) => /^(async\s+)?function\s/.test(d.body)).map((d) => d.name);
  assert.ok(fns.length > 400, '関数が少なすぎる: ' + fns.length);
  for (const n of [...ROOTS, ...fns]) assert.equal(vm.runInContext(`${n}.toString()`, b), vm.runInContext(`${n}.toString()`, a), n);
});
