// 読み取り専用（2026-11-24 管理人指示）: Amazon Music「SDGsを話そう アーカイブ（2021.10-2026.6）」の全回を一度だけ読む。
// 番組ページを下へ送りながら回の行（URL・題名・日付・長さ）を集め、out/amazon-sdgs-archive.json に保存する。台帳・公開データは変えない。
// URL は Amazon のページが返した href だけから作る（推測で組み立てない）。
import fs from 'node:fs';
import { absoluteDate } from './scrape-new.mjs';
const SHOW = '16cb0d1f-42eb-433b-8696-b435641c4723';
async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1280, height: 2000 } });
  const p = await ctx.newPage();
  await p.goto(`https://music.amazon.co.jp/podcasts/${SHOW}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('music-episode-row-item a[href*="/episodes/"]', { timeout: 90000 });
  await p.waitForTimeout(3000);
  const all = new Map(); let idle = 0, rounds = 0;
  while (idle < 12 && rounds < 1500) {
    rounds++;
    const rows = await p.evaluate(() => {
      const DATE = /^(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}-\d{1,2}-\d{4}|\d+(?:日|時間|分)前|昨日|今日)$/;
      const DUR = /^((\d+)\s*(?:hr|時間))?\s*((\d+)\s*(?:min|分))?\s*((\d+)\s*(?:sec|秒))?$/;
      const out = [];
      document.querySelectorAll('music-episode-row-item').forEach((row) => {
        const a = row.querySelector('a[href*="/episodes/"]'); if (!a) return;
        const m = a.getAttribute('href').match(/\/podcasts\/([0-9a-f-]{36})\/episodes\/([0-9a-f-]{36})/); if (!m) return;
        const lines = (row.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
        let i = 0, date = ''; if (DATE.test(lines[0] || '')) { date = lines[0]; i = 1; }
        const title = (a.innerText || '').trim() || lines[i] || '';
        let duration = ''; for (let k = lines.length - 1; k >= 0 && !duration; k--) { const d = lines[k].match(DUR); if (d && (d[2] || d[4] || d[6])) duration = (d[2] ? d[2] + '時間' : '') + (d[4] ? d[4] + '分' : '') + (d[6] ? d[6] + '秒' : ''); }
        out.push({ show: m[1], ep: m[2], title, date, duration });
      });
      return out;
    });
    const before = all.size;
    for (const r of rows) if (r.show === SHOW && r.title && !all.has(r.ep)) all.set(r.ep, r);
    idle = all.size === before ? idle + 1 : 0;
    if (rounds % 20 === 0) console.log('rounds', rounds, 'episodes', all.size);
    await p.evaluate(() => { const rs = document.querySelectorAll('music-episode-row-item'); rs[rs.length - 1]?.scrollIntoView(); window.scrollBy(0, 1500); });
    await p.waitForTimeout(1200);
  }
  await b.close();
  const episodes = [...all.values()].map((r) => ({ url: `https://music.amazon.co.jp/podcasts/${r.show}/episodes/${r.ep}`, title: r.title, date: absoluteDate(r.date), rawDate: r.date, duration: r.duration }));
  fs.mkdirSync('out', { recursive: true });
  fs.writeFileSync('out/amazon-sdgs-archive.json', JSON.stringify({ generatedAt: new Date().toISOString(), show: SHOW, rounds, count: episodes.length, episodes }, null, 1) + '\n');
  console.log('done', episodes.length);
  if (!episodes.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
