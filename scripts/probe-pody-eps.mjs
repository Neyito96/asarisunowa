// 第48号 ②: Pody 個別EPページ(サイトマップ由来)から音声URL/GUID/公開日/タイトルを取り出せるか標本検証。READ ONLY・公開ページのみ・/api/には触れない。
import fs from 'node:fs';
import { POLICY } from '../public/library/link-discovery.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  await sleep(1500);
  const res = await fetch(u, { headers: { 'user-agent': POLICY.userAgent, accept: 'text/html,application/xml,*/*;q=0.5' }, signal: AbortSignal.timeout(30000), redirect: 'follow' }).catch((e) => ({ err: String(e).slice(0, 60) }));
  if (res.err) return { code: 0, text: '', err: res.err };
  return { code: res.status, text: await res.text() };
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const uniq = (a) => [...new Set(a)];
const urls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const per = +process.argv[4] || 30;
const out = {};
for (const [show, id] of Object.entries(urls.pody)) {
  const sm = await get(`https://pody.jp/sitemaps/episodes/${id}.xml`);
  const locs = [...sm.text.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({ loc: (m[1].match(/<loc>([^<]+)/) || [])[1], lastmod: (m[1].match(/<lastmod>([^<]+)/) || [])[1] }));
  const n = locs.length; const rows = [];
  for (let k = 0; k < Math.min(per, n); k++) {
    const p = locs[Math.floor((k + 0.5) * n / Math.min(per, n))];
    const r = await get(p.loc); const h = r.text;
    const aud = uniq([...h.matchAll(/https?:[^"'\s<>\\]+\.(?:mp3|m4a)[^"'\s<>\\]*/gi)].map((m) => m[0].replace(/\?.*/, '')));
    const ld = [...h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let name, date, ldAudio;
    for (const t of ld) { try { const j = JSON.parse(t); const a = Array.isArray(j) ? j : [j]; for (const o of a) { name ??= o.name || o.headline; date ??= o.datePublished || o.uploadDate; ldAudio ??= o.contentUrl || o.audio?.contentUrl || o.associatedMedia?.contentUrl; } } catch {} }
    rows.push({ url: p.loc, code: r.code, lastmod: p.lastmod, audio: aud.slice(0, 3), audioGuids: uniq(aud.flatMap((a) => a.match(UUID) || [])), allUuids: uniq(h.match(UUID) || []).slice(0, 6), ldName: name?.slice(0, 80), ldDate: date, ldAudio: ldAudio?.replace(/\?.*/, ''), title: (h.match(/<title>([^<]*)/) || [])[1]?.slice(0, 80) });
  }
  out[show] = { sitemapUrls: n, rows };
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(JSON.stringify({ shows: Object.keys(out).length }));
