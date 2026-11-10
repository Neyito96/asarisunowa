// PREVIEW ONLY. Builds a candidate library snapshot that adds ledger rows newer than the reviewed publication
// decisions (EP-06592+) as *provisional, unreviewed* entries. Never writes the ledger, public/library/data,
// main or any production system. Usage:
//   node scripts/build-universe-preview.mjs LEDGER.csv OUT_DIR [REPORT.json]
// LEDGER.csv: the 55-column 'エピソード台帳' export (full, or at least the rows to add/refresh). Keep it OUTSIDE the repo.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
import {buildPublicationScope} from '../public/library/publication-scope.mjs';
import {blocked, publicEpisode} from '../lib/library-public.mjs';
import {refreshCastFromLedger} from '../public/library/cast-sync.mjs';

export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const POLICY_EXCLUDED_SHOWS = new Set(['アルキキ', 'AJW', '朝ポキTV']);
const dateOf = v => { const m = String(v || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };

// Pure provisional classification. existing = Map(show|title -> publication) from reviewed decisions+ledger.
// Compact export (22 columns) written by the COPY GAS read-only exporter; expanded back to ledger column positions.
export const COMPACT_COLS = [0, 1, 2, 3, 6, 8, 9, 10, 11, 12, 14, 15, 21, 22, 23, 38, 43, 45, 46, 47, 48, 49];
export function expandCompact(r) { const full = Array(55).fill(''); COMPACT_COLS.forEach((c, i) => { full[c] = r[i] ?? ''; }); return full; }

export function classifyNewRow(row, existingTitles) {
  if (POLICY_EXCLUDED_SHOWS.has(row[1])) return {publication: '対象外', reason: 'POLICY_SHOW'};
  if (blocked(row[38])) return {publication: '対象外', reason: 'HUMAN_EXCLUDED'};
  if (!row[1] || !row[2] || !dateOf(row[3])) return {publication: '保留', reason: 'MISSING_SHOW_TITLE_OR_DATE'};
  if (existingTitles.has(row[1] + '|' + norm(row[2]))) return {publication: '保留', reason: 'SAME_SHOW_TITLE_AS_EXISTING'};
  return {publication: '対象', reason: 'PROVISIONAL_RULE'};
}

export async function buildPreview({ledgerRows, existingDetails, decisionSnapshot, destination, snapshotDate}) {
  const base = decisionSnapshot.decisions, baseIds = new Set(base.map(d => d.id));
  const byId = new Map(ledgerRows.map(r => [r[0], r]));
  const existing0 = existingDetails.map(e => ({...e, links: [...(e.links || [])]}));
  // 出演者: 台帳の確定変更を既存エピソードへ増分反映(台帳のみが真値。推測値では上書きしない。台帳が空なら既存を消さない)
  const cr = refreshCastFromLedger(existing0, byId), existing = cr.episodes;
  const report = {linkRefresh: [], castRefresh: {changed: cr.changes.length, added: cr.changes.filter(c => c.kind === 'CAST_ADDED').length, replaced: cr.changes.filter(c => c.kind === 'CAST_CHANGED').length, keptBlank: cr.keptBlank, ids: cr.changes.map(c => c.id), byShow: cr.changes.reduce((m, c) => (m[c.show] = (m[c.show] || 0) + 1, m), {})}, provisional: {対象: 0, 保留: 0, 対象外: 0}, holds: {}, ids: {}};
  for (const e of existing) { // refresh only: add a ledger Spotify episode URL that the snapshot lacks
    const r = byId.get(e.id); const s = r && String(r[11] || '').trim();
    if (s && /^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]+/.test(s) && !e.links.some(u => /open\.spotify\.com\/episode\//.test(u))) { e.links.push(s); report.linkRefresh.push(e.id); }
  }
  const titles = new Set(); for (const e of existingDetails) titles.add(e.show + '|' + norm(e.title)); // published titles; held/excluded old titles need the full ledger
  const added = [], decisions = [...base], provisionalIds = [];
  for (const r of ledgerRows.filter(r => /^EP-\d{5}$/.test(r[0]) && !baseIds.has(r[0])).sort((a, b) => a[0].localeCompare(b[0]))) {
    const c = classifyNewRow(r, titles); report.provisional[c.publication]++;
    if (c.publication !== '対象') report.holds[c.reason] = (report.holds[c.reason] || 0) + 1;
    report.ids[r[0]] = c.publication + ':' + c.reason;
    decisions.push({id: r[0], show: r[1], comparison: c.publication, publication: c.publication, classification: '暫定(未レビュー)', review: '確認済み', decidedAt: new Date().toISOString()});
    if (c.publication === '対象') { added.push(publicEpisode(r)); provisionalIds.push(r[0]); titles.add(r[1] + '|' + norm(r[2])); }
  }
  const snapshot = {...decisionSnapshot, decisions, source: {...decisionSnapshot.source, rawReadSHA256: createHash('sha256').update(JSON.stringify(decisions)).digest('hex')}};
  const scope = buildPublicationScope(snapshot); scope.version = snapshot.source.rawReadSHA256;
  const episodes = [...existing, ...added.filter(e => e.date)];
  const published = new Set(scope.publishedIds);
  const dropped = episodes.filter(e => !published.has(e.id)); if (dropped.length) throw Error('Episode outside scope ' + dropped[0].id);
  scope.publishedIds = episodes.map(e => e.id).sort(); // dated provisional only
  scope.adopted = scope.publishedIds.length; scope.source = scope.adopted + scope.excluded + scope.held + (added.length - added.filter(e => e.date).length);
  scope.shows = scope.shows.map(s => ({...s, count: episodes.filter(e => e.show === s.name).length}));
  const result = await writePublicLibrarySnapshot({episodes, counts: {source: ledgerRows.length, provisionalUnreviewed: provisionalIds.length}, publicationScope: scope, snapshotDate, destination});
  const mp = join(destination, 'manifest.json'), manifest = JSON.parse(await readFile(mp, 'utf8'));
  manifest.preview = {provisional: true, note: '新着は人手レビュー前の暫定提案を含むプレビュー。公開不可。', provisionalIds};
  await writeFile(mp, JSON.stringify(manifest) + '\n');
  return {result, report: {...report, previousTotal: existingDetails.length, newTotal: episodes.length, provisionalAdded: added.length, provisionalIds}};
}

if (process.argv[1] && process.argv[1].endsWith('build-universe-preview.mjs')) {
  const [csvPath, out, reportPath] = process.argv.slice(2);
  if (!csvPath || !out) throw Error('Usage: node scripts/build-universe-preview.mjs LEDGER.csv OUT_DIR [REPORT.json]');
  const parsed = parseCsv(await readFile(csvPath, 'utf8'));
  const rows = parsed.slice(1).filter(r => /^EP-\d{5}$/.test(r[0])).map(r => parsed[0].length === COMPACT_COLS.length ? expandCompact(r) : r);
  const dir = new URL('../public/library/data/details/', import.meta.url);
  const existing = []; for (const f of await readdir(dir)) existing.push(...JSON.parse(await readFile(new URL(f, dir), 'utf8')));
  const raw = await readFile(new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz', import.meta.url));
  const snapshot = JSON.parse(gunzipSync(raw).toString('utf8'));
  const {result, report} = await buildPreview({ledgerRows: rows, existingDetails: existing, decisionSnapshot: snapshot, destination: out, snapshotDate: new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date())});
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({result, summary: {previousTotal: report.previousTotal, newTotal: report.newTotal, provisional: report.provisional, holds: report.holds, linkRefresh: report.linkRefresh.length, castRefresh: {changed: report.castRefresh.changed, added: report.castRefresh.added, replaced: report.castRefresh.replaced, keptBlank: report.castRefresh.keptBlank, byShow: report.castRefresh.byShow}}}, null, 1));
}
