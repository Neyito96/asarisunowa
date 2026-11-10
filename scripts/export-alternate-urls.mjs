// 台帳に既存URLがあり、外部原本が別URLを持つ場合の「代替候補」記録を出力する。READ ONLY・台帳へは書かない。
// 使い方: node scripts/export-alternate-urls.mjs --prod p1.json,... --ext タブ=file[+file],... --out alt.json
import fs from 'node:fs';
import { run } from './match-external-links.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
export function alternates(results) {
  const out = [];
  for (const r of results) {
    for (const [col, st, url] of [['L', r.spotify, r.extSpotify], ['AP', r.pocket, r.extPocket]]) {
      if (!st.startsWith('URL_CONFLICT')) continue;
      out.push({ epId: r.prodId, column: col, status: 'KEEP_EXISTING_ALT_RECORDED', kind: st === 'URL_CONFLICT_FEED' ? '別Omnyフィード' : '同一フィード不一致', altUrl: url, source: `${r.tab}!${r.row}`, evidence: r.reason });
    }
  }
  return out;
}
if (process.argv[1].endsWith('export-alternate-urls.mjs')) {
  const prodFiles = arg('--prod').split(',').filter(Boolean);
  const extFiles = Object.fromEntries(arg('--ext').split(',').filter(Boolean).map((p) => p.split('=')));
  const { results } = run({ prodFiles, extFiles });
  const items = alternates(results);
  const byKind = {};
  for (const o of items) byKind[`${o.kind}|${o.column}`] = (byKind[`${o.kind}|${o.column}`] || 0) + 1;
  fs.writeFileSync(arg('--out'), JSON.stringify({ policy: '既存URLを維持。外部原本の別URLは代替候補として記録するだけで、台帳への書込・併記列の増設はしない', count: items.length, byKind, items }) + '\n');
  console.log(items.length, byKind);
}
