// 第46号 ③: Pody 公開サイトマップの個別EP URL と 音声URL/GUID の対応を検証。READ ONLY・公開ページのみ・UA偽装なし・/api/ には触れない。
import fs from 'node:fs';
import { POLICY } from '../public/library/link-discovery.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  await sleep(1500);
  const res = await fetch(u, { headers: { 'user-agent': POLICY.userAgent, accept: 'text/html,application/xml,*/*;q=0.5' }, signal: AbortSignal.timeout(30000), redirect: 'follow' }).catch((e) => ({ err: String(e).slice(0, 60) }));
  if (res.err) return { code: 0, text: '', err: res.err };
  return { code: res.status, text: await res.text(), final: res.url };
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const uniq = (a) => [...new Set(a)];
const urls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = { index: {}, shows: {} };
const idx = await get('https://pody.jp/sitemap.xml');
out.index = { code: idx.code, children: uniq([...idx.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).length, sampleChildren: uniq([...idx.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).slice(0, 12) };
for (const [show, id] of Object.entries(urls.pody)) {
  const o = {};
  const sm = await get(`https://pody.jp/sitemaps/episodes/${id}.xml`);
  const locs = [...sm.text.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({ loc: (m[1].match(/<loc>([^<]+)/) || [])[1], lastmod: (m[1].match(/<lastmod>([^<]+)/) || [])[1], extra: uniq([...m[1].matchAll(/<([a-z]+:[a-z]+)/g)].map((x) => x[1])) }));
  o.sitemap = { code: sm.code, urls: locs.length, sample: locs.slice(0, 2), tags: uniq(locs.flatMap((l) => l.extra)), lastmodRange: [locs.map((l) => l.lastmod).filter(Boolean).sort()[0], locs.map((l) => l.lastmod).filter(Boolean).sort().at(-1)] };
  const page = await get(`https://pody.jp/player/${id}`);
  const latest = uniq([...page.text.matchAll(new RegExp(`/player/${id}/([A-Za-z0-9]+)`, 'g'))].map((m) => m[1]));
  const audio = uniq([...page.text.matchAll(/https?:[^"'\s<>\\]+\.(?:mp3|m4a)[^"'\s<>\\]*/gi)].map((m) => m[0].replace(/\?.*/, '')));
  o.showPage = { code: page.code, latestEpLinks: latest.length, audioRefs: audio.length, audioGuids: uniq(audio.flatMap((a) => a.match(UUID) || [])).length, sampleAudio: audio.slice(0, 2) };
  // 個別EPページの中身（サイトマップの新旧から最大8件）
  const pick = []; const n = locs.length; for (let k = 0; k < Math.min(8, n); k++) pick.push(locs[Math.floor(k * n / 8)]);
  o.epPages = [];
  for (const p of pick) {
    const r = await get(p.loc);
    const html = r.text;
    const aud = uniq([...html.matchAll(/https?:[^"'\s<>\\]+\.(?:mp3|m4a)[^"'\s<>\\]*/gi)].map((m) => m[0].replace(/\?.*/, '')));
    o.epPages.push({ url: p.loc, code: r.code, bytes: html.length, uuids: uniq(html.match(UUID) || []).length, audio: aud.length, jsonld: /ld\+json/.test(html), title: (html.match(/<title>([^<]*)/) || [])[1]?.slice(0, 60), ogAudio: /og:audio|twitter:player/.test(html), datePub: /datePublished|article:published_time/.test(html), inLatest21: latest.includes((p.loc.match(/\/([A-Za-z0-9]+)$/) || [])[1]) });
  }
  out.shows[show] = o;
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(JSON.stringify({ shows: Object.keys(out.shows).length }));
