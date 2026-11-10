// 候補JSONの全セルを、最新データで再検証し、pass/fail と「書込計画」(行番号つき、未実行)を出す。READ ONLY。
// 使い方: node scripts/verify-ext-link-candidates.mjs --prod p1.json,... --ext タブ=file[+file],... --candidates cand.json [--plan out.json]
import fs from 'node:fs';
import { run } from './match-external-links.mjs';
import { PROD_COL, spotifyEpisodeId, pocketEpisodeId, omnySlug, asahiItemId } from '../public/library/external-link-match.mjs';

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8')).values;
const COLS = { L: { idx: PROD_COL.spotify, field: 'spotify', id: spotifyEpisodeId, key: 'spotify' }, AP: { idx: PROD_COL.pocket, field: 'pocket', id: pocketEpisodeId, key: 'pocket' } };

export function verify({ prodFiles, extFiles, candidates }) {
  const { results, prodRows } = run({ prodFiles, extFiles });
  let prod = [];
  prodFiles.forEach((f, i) => { const v = load(f); prod = prod.concat(i === 0 ? v.slice(1) : v); });
  const rowOf = new Map(prod.map((r, i) => [String(r[PROD_COL.id]).trim(), i + 2])); // シート行番号（見出し=1）
  const prodById = new Map(prod.map((r) => [String(r[PROD_COL.id]).trim(), r]));

  // 除外集合: 競合/曖昧に関係する台帳行、および同一番組内で同じitemid/スラッグを持つ台帳行（重複疑い）
  const heldIds = new Set();
  for (const r of results) if (r.cls !== 'CONFIRMED') {
    if (r.prodId) heldIds.add(r.prodId);
    for (const m of r.reason.matchAll(/EP-\d+/g)) heldIds.add(m[0]);
  }
  const grp = (keyf) => { const m = new Map(); for (const r of prod) { const k = keyf(r); if (k) (m.get(k) || m.set(k, []).get(k)).push(r); } return m; };
  const sameShowDup = new Set(); let crossShowGroups = 0;
  for (const keyf of [(r) => asahiItemId(r[PROD_COL.official]), (r) => omnySlug(r[PROD_COL.page])]) {
    for (const g of grp(keyf).values()) if (g.length > 1) {
      const shows = new Set(g.map((r) => r[PROD_COL.show]));
      if (shows.size < g.length) g.forEach((r) => sameShowDup.add(String(r[PROD_COL.id])));
      else crossShowGroups++;
    }
  }
  const crossShow = new Set();
  for (const g of grp((r) => asahiItemId(r[PROD_COL.official])).values()) if (g.length > 1 && new Set(g.map((r) => r[PROD_COL.show])).size > 1) g.forEach((r) => crossShow.add(String(r[PROD_COL.id])));

  const byTarget = new Map(); // prodId+col → results
  for (const r of results) {
    if (r.spotify === 'FILL') byTarget.set(`${r.prodId}|L`, r);
    if (r.pocket === 'FILL') byTarget.set(`${r.prodId}|AP`, r);
  }
  const urlCount = { L: new Map(), AP: new Map() };
  for (const r of prod) { for (const [c, m] of Object.entries(urlCount)) { const id = COLS[c].id(String(r[COLS[c].idx] ?? '')); if (id) m.set(id, (m.get(id) || 0) + 1); } }
  const extUse = new Map();
  for (const r of results) { for (const u of [r.extSpotify, r.extPocket]) if (u) extUse.set(u, (extUse.get(u) || 0) + 1); }

  const checks = [];
  for (const c of candidates) {
    const t = byTarget.get(`${c.epId}|${c.column}`);
    const row = rowOf.get(c.epId);
    const p = prodById.get(c.epId);
    const col = COLS[c.column];
    const ck = {
      strongKey: !!t && /asahiItemId|omnySlug/.test(t.reason),
      stillFillAndSameUrl: !!t && (c.column === 'L' ? t.extSpotify : t.extPocket) === c.url,
      urlIsEpisodeLevel: !!col && !!col.id(c.url),
      prodCellEmptyNow: !!p && !String(p[col.idx] ?? '').trim(),
      rowIdMatches: !!row && !!p,
      notHeldOrConflict: !heldIds.has(c.epId),
      notSameShowDuplicate: !sameShowDup.has(c.epId),
      urlUnusedInColumn: !!col && !(urlCount[c.column].get(col.id(c.url)) > 0),
      extUrlSingleRow: extUse.get(c.url) === 1,
    };
    checks.push({ ...c, row, checks: ck, pass: Object.values(ck).every(Boolean), crossShowGroup: crossShow.has(c.epId), showMismatch: !!t?.showMismatch });
  }
  const names = checks.length ? Object.keys(checks[0].checks) : [];
  const perCheck = Object.fromEntries(names.map((n) => [n, checks.filter((c) => c.checks[n]).length]));
  return { prodRows, extResults: results.length, total: checks.length, passed: checks.filter((c) => c.pass).length, perCheck, crossShowGroupsInProd: crossShowGroups, heldIds: [...heldIds].sort(), checks };
}

if (process.argv[1].endsWith('verify-ext-link-candidates.mjs')) {
  const prodFiles = arg('--prod').split(',').filter(Boolean);
  const extFiles = Object.fromEntries(arg('--ext').split(',').filter(Boolean).map((p) => p.split('=')));
  const cand = JSON.parse(fs.readFileSync(arg('--candidates'), 'utf8')).candidates;
  const v = verify({ prodFiles, extFiles, candidates: cand });
  const { checks, ...summary } = v;
  console.log(JSON.stringify({ ...summary, failed: checks.filter((c) => !c.pass).map((c) => ({ epId: c.epId, column: c.column, checks: c.checks })) }, null, 1));
  const plan = arg('--plan');
  if (plan) {
    // 書込計画: 実行側は「書込直前に A{row}=epId と {col}{row}=空 を再読込し、不一致なら全体停止」する。
    const items = checks.filter((c) => c.pass).map((c) => ({ epId: c.epId, range: `エピソード台帳!${c.column}${c.row}`, idCell: `エピソード台帳!A${c.row}`, value: c.url, expectIdCell: c.epId, expectTargetEmpty: true, evidence: c.evidence, source: c.source }));
    fs.writeFileSync(plan, JSON.stringify({ status: 'NOT_EXECUTED（管理人承認待ち）', sheetId: '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4', protocol: ['各セル書込の直前に idCell と対象セルを再読込', 'expect不一致なら以降すべて停止（部分適用を許容しても、停止位置を監査ログに記録）', '1セルずつ書込→直後に読み戻して値一致を確認', '監査ログ: epId, range, 書込前値(空), 書込後値, 時刻, 根拠'], count: items.length, items }, null, 1) + '\n');
  }
}
