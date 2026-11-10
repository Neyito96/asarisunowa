// 第39号: Apple公開Search API（term=題名）で「Lookup200件の窓の外」の個別EP URLをどれだけ根拠付きで得られるか測る。READ ONLY。
// 合格条件: 同一collectionId かつ episodeGuid == 台帳J列itemid(=公式RSS GUID) の完全一致 かつ trackViewUrl がエピソードURL形式。
// 題名/日付だけの一致は TITLE_ONLY（HOLD・本番候補に数えない）。台帳・Sheetsには触れない。
// 使い方: node scripts/probe-apple-search.mjs docs/release/2026-11-10-apple-search-sample30.json out.json
import fs from 'node:fs';
import { isEpisodeUrl, appleTrackId, POLICY } from '../public/library/link-discovery.mjs';

const sample = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nfkc = (t) => String(t || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const normT = (t) => nfkc(t).toLowerCase().replace(/\s+/g, '');
const stats = { calls: 0, http: {}, rateLimited: 0, retries: 0 };
const PACE_MS = 3000; // Searchは lookup より厳しい可能性があるため控えめ

export function queryVariants(title) {
  const full = nfkc(title);
  const noNo = full.replace(/\s*[#＃]\s*\d+\s*$/, '').trim();            // 末尾の #番号 を外す（検索専用。照合根拠には番号を残す）
  const short = noNo.slice(0, 30);
  return [...new Set([full, noNo, short].filter(Boolean))];
}

async function search(term) {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcastEpisode&country=jp&limit=200&term=${encodeURIComponent(term)}`;
  for (let i = 0; i <= POLICY.maxRetries; i++) {
    await sleep(PACE_MS);
    stats.calls++;
    const res = await fetch(url, { headers: { 'user-agent': POLICY.userAgent }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    const code = res ? res.status : 0;
    stats.http[code] = (stats.http[code] || 0) + 1;
    if (res && res.ok) return { code, json: await res.json() };
    if (code === 429) stats.rateLimited++;
    if (res && !POLICY.retryOn.includes(code)) return { code, json: null };
    stats.retries++;
    await sleep(POLICY.backoffMs[i] || 5000);
  }
  return { code: -1, json: null };
}

const results = [];
let consecutiveFail = 0;
const t0 = Date.now();
for (const it of sample.items) {
  const showId = sample.appleShowIds[it.show];
  const r = { epId: it.epId, show: it.show, year: it.date.slice(0, 4), state: 'NOT_FOUND', queries: 0, returned: 0, urls: [], note: '' };
  const t1 = Date.now();
  let titleOnly = null;
  for (const term of queryVariants(it.title)) {
    const { code, json } = await search(term);
    r.queries++;
    if (!json) { r.state = code === 429 || code === -1 ? 'RATE_LIMITED' : 'API_ERROR'; r.note = `HTTP ${code}`; consecutiveFail++; break; }
    consecutiveFail = 0;
    const eps = (json.results || []).filter((e) => e.wrapperType === 'podcastEpisode' || e.kind === 'podcast-episode');
    r.returned = Math.max(r.returned, eps.length);
    const sameShow = eps.filter((e) => String(e.collectionId) === showId);
    const guidHits = sameShow.filter((e) => String(e.episodeGuid || '').toLowerCase() === it.itemid);
    const urls = [...new Set(guidHits.map((e) => String(e.trackViewUrl || '').trim()).filter((u) => isEpisodeUrl('apple', u)))];
    if (urls.length === 1 && new Set(urls.map(appleTrackId)).size === 1) { r.state = 'CONFIRMED'; r.urls = urls.map((u) => u.replace(/&uo=\d+/, '')); r.matchedBy = 'episodeGuid+collectionId'; break; }
    if (urls.length > 1) { r.state = 'MULTI'; r.urls = urls; break; }
    if (!titleOnly) {
      const t = sameShow.filter((e) => normT(e.trackName) === normT(it.title));
      if (t.length === 1) titleOnly = t[0];
    }
    if (consecutiveFail >= 3) break;
  }
  if (r.state === 'NOT_FOUND' && titleOnly) { r.state = 'TITLE_ONLY'; r.note = '題名のみ一致（GUID無し/不一致）→HOLD'; }
  r.ms = Date.now() - t1;
  results.push(r);
  if (consecutiveFail >= 3) { r.note += ' 連続失敗3回で停止'; break; }
}
const tally = (key) => { const o = {}; for (const r of results) { const k = key(r); o[k] ||= { n: 0 }; o[k].n++; o[k][r.state] = (o[k][r.state] || 0) + 1; } return o; };
const report = {
  note: '第39号 Apple Search 層化試験（READ ONLY）', total: results.length,
  byState: results.reduce((o, r) => ((o[r.state] = (o[r.state] || 0) + 1), o), {}),
  byShow: tally((r) => r.show), byYear: tally((r) => r.year),
  apiCalls: stats.calls, http: stats.http, rateLimited: stats.rateLimited, retries: stats.retries,
  elapsedSec: Math.round((Date.now() - t0) / 1000), paceMs: PACE_MS,
  items: results,
};
fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 1));
console.log(JSON.stringify({ total: report.total, byState: report.byState, apiCalls: report.apiCalls, http: report.http, elapsedSec: report.elapsedSec }));
