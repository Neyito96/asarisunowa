// Amazon Music 新着（2026-11-18 管理人指示）: 7番組の番組ページを開き、新しい約20回の回URL・題名・日付・長さを docs/amazon/latest.json に保存する。
// 番組ページはブラウザで描画しないと回が出ないため Playwright を使う。1日1回・7ページだけ（大量巡回はしない）。V2 への書込は GAS（P31）が照合後に行う。
import fs from 'node:fs';
const SHOWS = {
  'ニュースの現場から': '7337408b-4752-4a85-8f27-4208a2ca8b1d', 'ニュースの学校': 'c0bbd7fe-8cfb-4e94-9ec3-7c825aa70217', '報談': '297be73b-0c9b-4629-85a9-f51e179a1292',
  'スポンジ': '827f3a0a-e2c9-4913-88cf-329697329ec0', 'MEDIA TALK': '55b49660-b1f3-482d-9b1e-791337153bc2', 'こどもそうだんしつ': '0af07b90-b96f-4f5a-a4c7-8da6fddc5685', 'ドーナツ': 'edb44df6-5b86-4b52-88cf-cb270180b9f4',
};
// 「1日前」などの相対表示を、Amazon と同じ UTC の日付（YYYY年M月D日）にする
export function absoluteDate(text, now = new Date()) {
  const t = String(text || ''); if (/\d{4}年\d{1,2}月\d{1,2}日/.test(t)) return t.match(/\d{4}年\d{1,2}月\d{1,2}日/)[0];
  const dmy = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if (dmy) return `${+dmy[3]}年${+dmy[2]}月${+dmy[1]}日`;   // 英語表示の DD-MM-YYYY
  let ms = 0; const d = t.match(/(\d+)日前/), h = t.match(/(\d+)時間前/), m = t.match(/(\d+)分前/);
  if (d) ms = +d[1] * 86400000; else if (h) ms = +h[1] * 3600000; else if (m) ms = +m[1] * 60000; else if (/昨日/.test(t)) ms = 86400000; else if (!/今日/.test(t)) return '';
  const x = new Date(now.getTime() - ms); return `${x.getUTCFullYear()}年${x.getUTCMonth() + 1}月${x.getUTCDate()}日`;
}
async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' }), out = { generatedAt: new Date().toISOString(), shows: {} };
  for (const [show, id] of Object.entries(SHOWS)) {
    const p = await ctx.newPage();
    await p.goto(`https://music.amazon.co.jp/podcasts/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('a[href*="/episodes/"]', { timeout: 45000 });
    await p.waitForTimeout(2000);
    const rows = await p.evaluate(() => {
      const DATE = /^(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}-\d{1,2}-\d{4}|\d+(?:日|時間|分)前|昨日|今日)$/;
      const DUR = /^((\d+)\s*(?:hr|時間))?\s*((\d+)\s*(?:min|分))?\s*((\d+)\s*(?:sec|秒))?$/;
      const byId = new Map();
      document.querySelectorAll('a[href*="/episodes/"]').forEach((a) => {
        const href = a.getAttribute('href'), m = href.match(/\/podcasts\/([0-9a-f-]{36})\/episodes\/([0-9a-f-]{36})/); if (!m) return;
        const row = a.closest('music-episode-row-item'); if (!row) return;   // 番組の回の行だけ（おすすめ枠などは除く）
        const lines = (row.innerText || '').split('\n').map((x) => x.trim()).filter(Boolean);
        let i = 0, date = ''; if (DATE.test(lines[0] || '')) { date = lines[0]; i = 1; }
        const title = (a.innerText || '').trim() || lines[i] || '';
        let duration = ''; for (let k = lines.length - 1; k >= 0 && !duration; k--) { const d = lines[k].match(DUR); if (d && (d[2] || d[4] || d[6])) duration = (d[2] ? d[2] + '時間' : '') + (d[4] ? d[4] + '分' : '') + (d[6] ? d[6] + '秒' : ''); }
        const cur = byId.get(m[2]) || { url: new URL(href, location.origin).href, title: '', date: '', duration: '' };
        if (title && !DATE.test(title) && (!cur.title || title.length < cur.title.length)) cur.title = title; if (date && !cur.date) cur.date = date; if (duration && !cur.duration) cur.duration = duration;
        byId.set(m[2], cur);
      });
      return [...byId.values()].filter((r) => r.title);
    });
    if (!rows.length) throw new Error('NO_EPISODES ' + show);
    out.shows[show] = { id, episodes: rows.filter((r) => r.url.includes(id)).map((r) => ({ ...r, date: absoluteDate(r.date) })) };
    console.log(show, out.shows[show].episodes.length);
    await p.close();
  }
  await b.close();
  fs.mkdirSync('docs/amazon', { recursive: true }); fs.writeFileSync('docs/amazon/latest.json', JSON.stringify(out, null, 1) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
