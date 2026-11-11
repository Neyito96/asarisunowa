// 概要欄清掃GAS（gas/summary-cleaner）の配布物を作る。Node の清掃・監査モジュールを、そのまま GAS 用の1ファイルに変換する（重複実装しない）。
// 各モジュールは即時関数で包み、import は先に定義したモジュールの戻り値から受け取る。usage: node scripts/ledger-v2/build-cleaner-gas.mjs [--check]
import fs from 'node:fs';
const root = new URL('../../', import.meta.url), rd = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const MODS = [['LibClean', 'public/library/library-clean.mjs'], ['DescEditor', 'public/library/description-editor.mjs'], ['QualityAudit', 'scripts/ledger-v2/summary-quality-audit.mjs'], ['CleanerV4', 'scripts/ledger-v2/summary-cleaner-v4.mjs']];
const byPath = Object.fromEntries(MODS.map(([n, p]) => [p, n]));
function wrap(name, path) {
  let src = rd(path); const exports = [];
  const dir = path.split('/').slice(0, -1).join('/');
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*'([^']+)';?\s*$/gm, (_, names, from) => {
    const parts = (dir + '/' + from).split('/'), out = []; for (const x of parts) { if (x === '..') out.pop(); else if (x !== '.') out.push(x); }
    const mod = byPath[out.join('/')]; if (!mod) throw new Error('UNBUNDLED_IMPORT ' + from + ' in ' + path);
    return 'const {' + names.replace(/\s+as\s+/g, ': ') + '} = ' + mod + ';';
  });
  src = src.replace(/^export\s+\{\s*(\w+)\s+as\s+(\w+)\s*\};?\s*$/gm, (_, a, b) => { exports.push(b + ': ' + a); return ''; });
  src = src.replace(/^export\s+(function|const|let|class)\s+(\w+)/gm, (_, kw, n) => { exports.push(n); return kw + ' ' + n; });
  return 'var ' + name + ' = (function () {\n' + src + '\nreturn { ' + exports.join(', ') + ' };\n})();\n';
}
export function buildCleanerGas() {
  const head = '// 自動生成ファイル（編集しない）: node scripts/ledger-v2/build-cleaner-gas.mjs で再生成。元: ' + MODS.map((m) => m[1]).join(', ') + ' + scripts/google-apps-script/P25V2IngestAdapter.js + gas/summary-cleaner/src/CleanerMain.js\n';
  const adapter = rd('scripts/google-apps-script/P25V2IngestAdapter.js').replace(/\n?if \(typeof module !== 'undefined'[^\n]*\n?/, '\n').replace(/function P25V2_INGEST_COPY\(/g, 'function p25v2IngestCopyNotInCleaner_(');   // 収蔵の入口は清掃GASの実行一覧に出さない   // RSS取得・解析・SHA256・安全確認を再利用
  return { 'SummaryCleaner.js': head + adapter + '\n' + MODS.map(([n, p]) => wrap(n, p)).join('\n') + '\n' + rd('gas/summary-cleaner/src/CleanerMain.js'), 'appsscript.json': rd('gas/summary-cleaner/appsscript.json') };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildCleanerGas(), dir = new URL('gas/summary-cleaner/dist/', root), check = process.argv.includes('--check'); let bad = 0;
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, c] of Object.entries(out)) { const p = new URL(n, dir); if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c) { console.error('DIST_STALE ' + n); bad++; } } else fs.writeFileSync(p, c); }
  if (bad) process.exit(1); console.log(check ? 'DIST_UP_TO_DATE' : 'BUILT');
}
