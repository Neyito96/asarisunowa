// Appleダンプ × 本番台帳(M列)の dry-run。READ ONLY。使い方: node scripts/match-apple-dump.mjs apple-dump.json prod1.json,prod2.json,... [out.json]
import fs from 'node:fs';
import { appleTrackId } from '../public/library/link-discovery.mjs';

const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let prod = [];
process.argv[3].split(',').forEach((f, i) => { const v = JSON.parse(fs.readFileSync(f, 'utf8')).values; prod = prod.concat(i === 0 ? v.slice(1) : v); });
const byGuid = new Map();
for (const [show, d] of Object.entries(dump)) for (const [guid, url, date] of d.eps) (byGuid.get(guid) || byGuid.set(guid, []).get(guid)).push({ show, url, date });
const stat = {}; const cands = [];
const bump = (s, k) => { stat[s] ||= { prodRows: 0, appleReturned: dump[s]?.eps.length ?? 0, hasApple: 0, CANDIDATE: 0, SAME: 0, URL_CONFLICT: 0, UNMATCHED: 0, MULTI: 0 }; stat[s][k]++; };
for (const r of prod) {
  const show = r[1]; const guid = String(r[6] || '').toLowerCase(); const known = String(r[12] || '').trim();
  bump(show, 'prodRows'); if (known) bump(show, 'hasApple');
  let hits = byGuid.get(guid) || [];
  const same = hits.filter((h) => h.show === show); // 同じ番組名のApple番組に絞る（同一GUIDが複数番組に載る場合がある）
  if (same.length) hits = same;
  if (!hits.length) { bump(show, 'UNMATCHED'); continue; }
  if (hits.length > 1) { bump(show, 'MULTI'); continue; }
  const h = hits[0];
  if (!known) { bump(show, 'CANDIDATE'); cands.push({ epId: r[0], column: 'M', field: 'Apple個別URL', url: h.url, evidence: 'apple episodeGuid == 台帳外部ID', appleShow: h.show, show, expectEmpty: true }); }
  else if (appleTrackId(known) === appleTrackId(h.url)) bump(show, 'SAME');
  else bump(show, 'URL_CONFLICT');
}
console.log(JSON.stringify(stat, null, 1));
const sum = Object.values(stat).reduce((a, s) => { for (const k of ['CANDIDATE', 'SAME', 'URL_CONFLICT', 'MULTI']) a[k] = (a[k] || 0) + s[k]; return a; }, {});
console.log('合計', sum, 'candidates', cands.length, '番組名不一致', cands.filter((c) => c.appleShow !== c.show).length);
if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify({ policy: 'dry-run / 既存M列は上書きしない / 書込は管理人承認後', count: cands.length, candidates: cands }, null, 1) + '\n');
