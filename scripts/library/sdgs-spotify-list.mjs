// #395【読み取り専用】SDGsを話そう アーカイブ（Spotify 番組 7vuSolzvNiNwu7UR4lVIwU）の全回の ID・題名・配信日を、
// ログイン不要の公開ページ（埋め込み＋番組ページ）から集める。Spotify API の認証情報は使わない。台帳・GASには書かない。
// 出力: docs/audits/sdgs-archive/spotify-archive-list.json
import fs from 'node:fs';
import { extractEpisodes, nextDataFromHtml } from '../spotify/scrape-new.mjs';
const SHOW = '7vuSolzvNiNwu7UR4lVIwU', WANT = 1092;
const found = new Map();
const add = (arr) => arr.forEach((e) => { const c = found.get(e.id); if (!c || (!c.date && e.date)) found.set(e.id, { ...c, ...e }); });
try { const html = await (await fetch(`https://open.spotify.com/embed/show/${SHOW}`)).text(); const nd = nextDataFromHtml(html); if (nd) add(extractEpisodes(nd)); } catch (e) { console.error('embed', e.message); }
console.error('embed', found.size);
const { chromium } = await import('playwright');
const browser = await chromium.launch(), ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 2000 } }), p = await ctx.newPage();
p.on('response', async (r) => { try { if (/spotify\.com/.test(r.url()) && /json/.test(r.headers()['content-type'] || '')) add(extractEpisodes(await r.json())); } catch (e) {} });
await p.goto(`https://open.spotify.com/show/${SHOW}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForTimeout(6000);
let last = -1, still = 0;
for (let i = 0; i < 600 && found.size < WANT && still < 25; i++) {
  await p.mouse.wheel(0, 5000);
  await p.evaluate(() => { [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && getComputedStyle(e).overflowY !== 'visible').forEach((e) => { e.scrollTop = e.scrollHeight; }); });
  await p.waitForTimeout(1200);
  if (found.size === last) still++; else { still = 0; last = found.size; }
  if (i % 20 === 0) console.error('scroll', i, found.size);
}
await browser.close();
const list = [...found.values()].map(({ id, title, date, durationMs }) => ({ id, title, date, durationMs }));
fs.mkdirSync('docs/audits/sdgs-archive', { recursive: true });
fs.writeFileSync('docs/audits/sdgs-archive/spotify-archive-list.json', JSON.stringify({ generatedAt: new Date().toISOString(), show: SHOW, want: WANT, got: list.length, withDate: list.filter((x) => x.date).length, list }, null, 1));
console.log(JSON.stringify({ got: list.length, withDate: list.filter((x) => x.date).length }));
