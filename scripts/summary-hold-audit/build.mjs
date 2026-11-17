// HoldAudit.gs を作る: 蔵の表示整形（PR #316 の規則そのもの）＋監査本体を1ファイルに（GASに貼る用）
import fs from 'node:fs';
const tidy = fs.readFileSync(new URL('../../public/library/description-tidy.mjs', import.meta.url), 'utf8').replace(/^export /gm, '');
const main = fs.readFileSync(new URL('./HoldAuditMain.js', import.meta.url), 'utf8');
// GAS は全ファイルが同じ名前空間なので、整形の定数（PROMO など）が他ファイルとぶつからないよう関数の中に閉じ込める
const out = '// 生成ファイル（scripts/summary-hold-audit/build.mjs）。直接編集しない\nvar tidyDescription = (function () {\n' + tidy + '\nreturn tidyDescription;\n})();\n' + main;
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/HoldAudit.gs', import.meta.url), out);
console.log('dist/HoldAudit.gs', out.length, 'bytes');
