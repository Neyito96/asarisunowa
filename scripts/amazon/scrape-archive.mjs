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
  // 2026-11 の Amazon Music は新しい画面（music-episode-row-item が無い）。回の行は a[href*="/episodes/"] から日付行まで親をたどって読む。
  await p.waitForSelector('a[href*="/episodes/"]', { timeout: 90000, state: 'attached' });
  await p.waitForTimeout(3000);
  const all = new Map(); let idle = 0, rounds = 0;
  while (idle < 15 && rounds < 3000) {
    rounds++;
    const rows = await p.evaluate(() => {
      const DATE = /^(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}-\d{1,2}-\d{4}|\d+(?:日|時間|分)前|昨日|今日)$/;
      const out = [];
      document.querySelectorAll('a[href*="/episodes/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').split('?')[0].match(/\/podcasts\/([0-9a-f-]{36})\/episodes\/([0-9a-f-]{36})/); if (!m) return;
        let n = a, row = null; for (let i = 0; i < 10 && n; i++) { const L = (n.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean); if (DATE.test(L[0] || '')) { row = L; break; } n = n.parentElement; }
        if (!row) return;
        const duration = row.find((x) => /^(?:\d+時間)?(?:\d+分)?(?:\d+秒)?$/.test(x) && /[時分秒]/.test(x)) || '';
        out.push({ show: m[1], ep: m[2], title: (a.innerText || '').trim(), date: row[0], duration });
      });
      // 回の一覧を包む縦スクロール領域（一番高いもの）を下端へ送る
      const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)).sort((x, y) => y.scrollHeight - x.scrollHeight)[0];
      if (sc) sc.scrollTop = sc.scrollHeight; window.scrollTo(0, document.body.scrollHeight);
      return out;
    });
    const before = all.size;
    for (const r of rows) if (r.show === SHOW && r.title && !all.has(r.ep)) all.set(r.ep, r);
    idle = all.size === before ? idle + 1 : 0;
    if (rounds % 20 === 0) console.log('rounds', rounds, 'episodes', all.size);
    await p.waitForTimeout(1000);
  }
  await b.close();
  const episodes = [...all.values()].map((r) => ({ url: `https://music.amazon.co.jp/podcasts/${r.show}/episodes/${r.ep}`, title: r.title, date: absoluteDate(r.date), rawDate: r.date, duration: r.duration }));
  fs.mkdirSync('out', { recursive: true });
  fs.writeFileSync('out/amazon-sdgs-archive.json', JSON.stringify({ generatedAt: new Date().toISOString(), show: SHOW, rounds, count: episodes.length, episodes }, null, 1) + '\n');
  console.log('done', episodes.length);
  if (!episodes.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
