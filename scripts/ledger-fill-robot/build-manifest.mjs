// 第49号: 収集/強キー照合の結果から「固定マニフェスト」を生成する(読取専用・書込なし)。
// usage: node build-manifest.mjs <live-snapshot-AK.json> <candidates.json> <out.json> <runId> <issue> [maxCells=1000]
import fs from 'node:fs';
import crypto from 'node:crypto';
const [, , snapF, candF, outF, runId, issue, max] = process.argv;
const N = +max || 1000;
const HOLD = ['EP-00418', 'EP-06591', 'EP-03857', 'EP-06595', 'EP-03858', 'EP-06596', 'EP-03861', 'EP-06597', 'EP-05110', 'EP-05109', 'EP-03157'];
const live = JSON.parse(fs.readFileSync(snapF, 'utf8'));
const cands = JSON.parse(fs.readFileSync(candF, 'utf8')).candidates;
const item = (r) => ((r[9] || '').match(/itemid=([0-9a-f-]{36})/i) || [])[1]?.toLowerCase() || '';
const keyOf = (r) => item(r) || (r[6] || '').toLowerCase();
const prod = live.slice(1), cnt = {}, used = new Set();
for (const r of prod) { const k = keyOf(r); if (k) cnt[k] = (cnt[k] || 0) + 1; if ((r[10] || '').trim()) used.add(r[10].trim()); }
const byEp = new Map(prod.map((r) => [r[0], r]));
const cells = [], seen = new Set(), excl = { nonEmpty: 0, dupGuid: 0, hold: 0, usedUrl: 0, noRow: 0, dupUrl: 0 };
for (const x of cands) {
  const r = byEp.get(x.epId); if (!r) { excl.noRow++; continue; }
  if (HOLD.includes(x.epId)) { excl.hold++; continue; }
  if (cnt[keyOf(r)] > 1) { excl.dupGuid++; continue; }
  if ((r[10] || '').trim()) { excl.nonEmpty++; continue; }
  if (used.has(x.url) || seen.has(x.url)) { excl.usedUrl++; continue; }
  seen.add(x.url);
  cells.push({ epId: x.epId, column: 'K', expectedOld: '', url: x.url, guid: item(r) || keyOf(r), basis: x.basis || 'GUID完全一致+配信日±1日+個別EP URL', show: x.show });
  if (cells.length >= N) break;
}
const manifest = { runId, urlShape: 'listen', holdEpIds: HOLD, approval: { issue, columns: ['K'], maxCells: N, sheet: 'エピソード台帳' }, cells };
const body = JSON.stringify(manifest);
manifest.sha256 = crypto.createHash('sha256').update(body).digest('hex');
fs.writeFileSync(outF, JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ cells: cells.length, excl, sha256: manifest.sha256.slice(0, 12) }));
