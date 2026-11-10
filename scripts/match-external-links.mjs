// 使い方: node scripts/match-external-links.mjs --prod p1.json,p2.json,... --ext タブ=file.json[,..] [--out 結果.json] [--samples N]
// 入力は Sheets get_values のJSON（{values:[...]}）。READ ONLY。書き込みなし。
import fs from 'node:fs';
import { matchExternalLinks, summarize, TAB_TO_SHOW } from '../public/library/external-link-match.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).values;

export function run({ prodFiles, extFiles }) {
  let prod = [];
  prodFiles.forEach((f, i) => { const v = load(f); prod = prod.concat(i === 0 ? v.slice(1) : v); });
  const ext = {};
  for (const [tab, spec] of Object.entries(extFiles)) { // 1行目=見出し, 2行目=説明。a.json+b.json は続きの範囲を連結
    const parts = spec.split("+"); ext[tab] = parts.flatMap((f, i) => (i === 0 ? load(f).slice(2) : load(f)));
  }
  const results = matchExternalLinks(prod, ext);
  // 同じ台帳行を複数の外部行が確定一致で指す場合は競合に落とす
  const byProd = new Map();
  for (const r of results) if (r.cls === 'CONFIRMED') (byProd.get(r.prodId) || byProd.set(r.prodId, []).get(r.prodId)).push(r);
  for (const list of byProd.values()) if (list.length > 1) for (const r of list) {
    r.cls = 'CONFLICT'; r.reason = `同じ台帳行を外部${list.length}行が指す`; r.spotify = r.spotify === 'FILL' ? 'HOLD_CONFLICT' : r.spotify; r.pocket = r.pocket === 'FILL' ? 'HOLD_CONFLICT' : r.pocket;
  }
  return { prodRows: prod.length, results, summary: summarize(results) };
}

if (process.argv[1].endsWith('match-external-links.mjs')) {
  const prodFiles = arg('--prod').split(',').filter(Boolean);
  const extFiles = Object.fromEntries(arg('--ext').split(',').filter(Boolean).map((p) => p.split('=')));
  const { prodRows, results, summary } = run({ prodFiles, extFiles });
  console.log(JSON.stringify({ prodRows, ...summary }, null, 1));
  const cand = arg('--candidates');
  if (cand) {
    const rows = [];
    for (const r of results) {
      if (r.spotify === 'FILL') rows.push({ epId: r.prodId, column: 'L', field: 'Spotify個別URL', url: r.extSpotify, evidence: r.reason, source: `${r.tab}!${r.row}`, expectEmpty: true });
      if (r.pocket === 'FILL') rows.push({ epId: r.prodId, column: 'AP', field: 'Pocket Casts個別URL', url: r.extPocket, evidence: r.reason, source: `${r.tab}!${r.row}`, expectEmpty: true });
    }
    rows.sort((a, b) => a.epId.localeCompare(b.epId) || a.column.localeCompare(b.column));
    fs.writeFileSync(cand, JSON.stringify({ generatedFor: 'dry-run only / 本番書込は管理人承認後', rule: 'expectEmpty=true の台帳セルが空のときだけ書く（既存値は上書きしない）', count: rows.length, candidates: rows }, null, 1) + '\n');
  }
  const out = arg('--out');
  if (out) fs.writeFileSync(out, JSON.stringify(results));
}
