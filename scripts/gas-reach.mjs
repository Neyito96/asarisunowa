// GAS の「使っているファイル／使っていないファイル」をざっくり仕分ける（読むだけ・#493 引っ越し準備）。
// 入口（Webアプリ・トリガー）から、名前の呼び合いをファイル単位でたどる。名前が1つでも出てくれば「使う」とみなすので、
// 「使っていない」と出たものは、本当にどこからも呼ばれていない（ただし手で押す関数・本番トリガーは別に確認が要る）。
// 使い方: node scripts/gas-reach.mjs [フォルダ] [入口の関数名...]
import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2] || 'scripts/google-apps-script';
const DEFAULT_ROOTS = ['doGet', 'doPost', 'onEdit', 'runAutoUpdateAutomationSoonV1', 'runAutoUpdateAutomationV1',
  'runAutoUpdateBackfillHourlyV1', 'runThemeReviewAutomation', 'syncSatoYoAutoPlaylist'];
const rootNames = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_ROOTS;
const ID = /[A-Za-z_$぀-鿿][\w$぀-鿿]*/gu;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
const src = {}, owner = Object.create(null);
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8'); src[f] = s;
  for (const m of s.matchAll(/^(?:async\s+)?function\s+([^\s(]+)\s*\(|^(?:const|let|var)\s+([^\s=]+)\s*=/gmu)) {
    const n = m[1] || m[2]; (owner[n] ||= new Set()).add(f);
  }
}
const edges = {};
for (const f of files) {
  const out = new Set();
  for (const id of new Set(src[f].match(ID) || [])) for (const o of owner[id] || []) if (o !== f) out.add(o);
  edges[f] = out;
}
const reach = new Set(); const stack = rootNames.flatMap((n) => [...(owner[n] || [])]);
while (stack.length) { const f = stack.pop(); if (reach.has(f)) continue; reach.add(f); stack.push(...edges[f]); }
const lines = (f) => src[f].split('\n').length;
const pub = (f) => [...src[f].matchAll(/^function\s+([A-Za-z぀-鿿][\w぀-鿿]*[^_\s(])\s*\(/gmu)].map((m) => m[1]);
const used = files.filter((f) => reach.has(f)), unused = files.filter((f) => !reach.has(f));
const sum = (a) => a.reduce((t, f) => t + lines(f), 0);
console.log(`入口: ${rootNames.join(', ')}`);
console.log(`使う: ${used.length} ファイル ${sum(used)} 行 / 使っていない: ${unused.length} ファイル ${sum(unused)} 行`);
for (const f of unused) console.log(`- ${f}（${lines(f)}行）手で押す関数: ${pub(f).join(', ') || 'なし'}`);
