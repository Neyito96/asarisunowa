// 第36号: LISTEN / Pody / Amazon Music の「個別EPを強キー(GUID等)で台帳に結べるか」を測る。READ ONLY・公開ページのみ。
// 出力は圧縮ダンプ(JSON)。台帳との照合はローカルで行う（台帳本文はActionsに渡さない）。
// 使い方: node scripts/probe-listen-pody-amazon.mjs docs/release/2026-11-10-show-level-urls.json out.json
import fs from 'node:fs';
import { POLICY } from '../public/library/link-discovery.mjs';
const urls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u) {
  for (let i = 0; i <= 2; i++) {
    await sleep(POLICY.minDelayMs + 500);
    const res = await fetch(u, { headers: { 'user-agent': POLICY.userAgent, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5' }, signal: AbortSignal.timeout(20000), redirect: 'follow' }).catch((e) => ({ err: String(e).slice(0, 80) }));
    if (res.err) { await sleep(POLICY.backoffMs[i]); continue; }
    if (res.ok) return { code: res.status, text: await res.text(), final: res.url };
    if (![429, 500, 502, 503, 504].includes(res.status)) return { code: res.status, text: '', final: res.url };
    await sleep(POLICY.backoffMs[i]);
  }
  return { code: -1, text: '', final: u };
}
const tag = (s, name) => { const m = s.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };
const out = { listen: {}, pody: {}, amazon: {} };

// LISTEN: RSS（rss.listen.style）と番組ページ
for (const [show, code] of Object.entries(urls.listen)) {
  const rss = await get(`https://rss.listen.style/p/${code}/rss`);
  const items = [...rss.text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const rec = { rssCode: rss.code, items: items.length, sample: items.slice(0, 3).map((x) => [tag(x, 'guid').slice(0, 60), tag(x, 'link').slice(0, 80), tag(x, 'pubDate'), (x.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1]?.replace(/\?.*/, '').slice(0, 100)]), all: items.map((x) => [tag(x, 'guid'), tag(x, 'link'), tag(x, 'pubDate')]) };
  const page = await get(`https://listen.style/p/${code}`);
  rec.pageCode = page.code; rec.pageEpLinks = new Set([...page.text.matchAll(new RegExp(`/p/${code}/([a-z0-9]+)`, 'g'))].map((m) => m[1])).size;
  rec.pageNext = /page=|次へ|もっと見る|load more/i.test(page.text);
  out.listen[show] = rec;
}
// Pody: 番組ページ → 個別EPリンク → 1件のページ構造
for (const [show, id] of Object.entries(urls.pody)) {
  const page = await get(`https://pody.jp/player/${id}`);
  const links = [...new Set([...page.text.matchAll(new RegExp(`/player/${id}/([A-Za-z0-9]+)`, 'g'))].map((m) => m[1]))];
  const rec = { pageCode: page.code, epLinks: links.length, next: /page=|もっと見る|load more/i.test(page.text) };
  if (links[0]) {
    const ep = await get(`https://pody.jp/player/${id}/${links[0]}`);
    rec.ep = { code: ep.code, ogTitle: (ep.text.match(/property="og:title" content="([^"]*)"/) || [])[1]?.slice(0, 80), ldjson: /application\/ld\+json/.test(ep.text), datePublished: (ep.text.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1] || '', audio: (ep.text.match(/https?:[^"'\s]+\.(mp3|m4a)[^"'\s]*/i) || [])[0]?.replace(/\?.*/, '').slice(0, 120) || '' };
  }
  out.pody[show] = rec;
}
// Amazon Music: 番組ページの到達性とEPリンク
for (const [show, u] of Object.entries(urls.amazon)) {
  const page = await get(u);
  const eps = new Set([...page.text.matchAll(/\/podcasts\/[0-9a-f-]{36}\/episodes\/([0-9a-f-]{36})/gi)].map((m) => m[1]));
  out.amazon[show] = { code: page.code, bytes: page.text.length, epLinks: eps.size, jsonld: /application\/ld\+json/.test(page.text), robotsBlock: /captcha|robot check/i.test(page.text), sampleEp: [...eps][0] || '' };
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
const brief = { listen: Object.fromEntries(Object.entries(out.listen).map(([k, v]) => [k, `rss${v.rssCode}:${v.items} page${v.pageCode}:${v.pageEpLinks}`])), pody: Object.fromEntries(Object.entries(out.pody).map(([k, v]) => [k, `${v.pageCode}:${v.epLinks}`])), amazon: Object.fromEntries(Object.entries(out.amazon).map(([k, v]) => [k, `${v.code}:${v.epLinks}`])) };
console.log(JSON.stringify(brief));
