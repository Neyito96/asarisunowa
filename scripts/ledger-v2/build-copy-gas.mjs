// 独立COPY専用GASの配布物を作る: gas/p25v2-copy/dist/{P25V2CopyIngest.js, appsscript.json}
// 共有コード P25V2IngestAdapter.js（Node試験と同一）＋入口 P25V2CopyMain.js を1ファイルに連結。管理人はこの1ファイルを貼るだけ。
// usage: node scripts/ledger-v2/build-copy-gas.mjs [--check]   --check は再生成結果と保存済みの差分があれば失敗（ずれ防止）
import fs from 'node:fs';
const root = new URL('../../', import.meta.url), rd = (p) => fs.readFileSync(new URL(p, root), 'utf8');
export function buildCopyGas() {
  const adapter = rd('scripts/google-apps-script/P25V2IngestAdapter.js'), main = rd('gas/p25v2-copy/src/P25V2CopyMain.js');
  const head = '// 自動生成ファイル（編集しない）: node scripts/ledger-v2/build-copy-gas.mjs で再生成。元: scripts/google-apps-script/P25V2IngestAdapter.js + gas/p25v2-copy/src/P25V2CopyMain.js\n';
  return { 'P25V2CopyIngest.js': head + adapter.replace(/\n?if \(typeof module !== 'undefined'[^\n]*\n?/, '\n') + '\n' + main, 'appsscript.json': rd('gas/p25v2-copy/appsscript.json') };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = buildCopyGas(), dir = new URL('gas/p25v2-copy/dist/', root), check = process.argv.includes('--check'); let bad = 0;
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, c] of Object.entries(out)) { const p = new URL(n, dir);
    if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== c) { console.error('DIST_STALE ' + n); bad++; } } else fs.writeFileSync(p, c); }
  if (bad) process.exit(1); console.log(check ? 'DIST_UP_TO_DATE' : 'BUILT');
}
