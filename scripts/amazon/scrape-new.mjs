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
// ページの中の回の行を読む（Playwright の evaluate で動かすので、この関数の中だけで完結させる）。
// 古い画面: music-episode-row-item の行。新しい画面（2026-11〜、#518）: その要素が無いので、
// 回のリンクから親をたどり、先頭の行が日付になっている要素を回の行とみなす。
export function pickRows(doc, origin) {
  const DATE = /^(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}-\d{1,2}-\d{4}|\d+(?:日|時間|分)前|昨日|今日)$/;
  const DUR = /^((\d+)\s*(?:hr|時間))?\s*((\d+)\s*(?:min|分))?\s*((\d+)\s*(?:sec|秒))?$/;
  const linesOf = (el) => String((el && el.innerText) || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const byId = new Map();
  doc.querySelectorAll('a[href*="/episodes/"]').forEach((a) => {
    const href = a.getAttribute('href') || '', m = href.split('?')[0].match(/\/podcasts\/([0-9a-f-]{36})\/episodes\/([0-9a-f-]{36})/); if (!m) return;
    let lines = null;
    const old = a.closest && a.closest('music-episode-row-item');
    if (old) lines = linesOf(old);
    else { let n = a.parentElement; for (let i = 0; i < 10 && n; i++) { const L = linesOf(n); if (DATE.test(L[0] || '')) { lines = L; break; } n = n.parentElement; } }
    if (!lines) return;   // 番組の回の行だけ（おすすめ枠などは除く）
    let i = 0, date = ''; if (DATE.test(lines[0] || '')) { date = lines[0]; i = 1; }
    const title = String(a.innerText || '').trim() || lines[i] || '';
    let duration = ''; for (let k = lines.length - 1; k >= 0 && !duration; k--) { const d = lines[k].match(DUR); if (d && (d[2] || d[4] || d[6])) duration = (d[2] ? d[2] + '時間' : '') + (d[4] ? d[4] + '分' : '') + (d[6] ? d[6] + '秒' : ''); }
    const cur = byId.get(m[2]) || { url: origin + '/podcasts/' + m[1] + '/episodes/' + m[2], title: '', date: '', duration: '' };
    if (title && !DATE.test(title) && (!cur.title || title.length < cur.title.length)) cur.title = title; if (date && !cur.date) cur.date = date; if (duration && !cur.duration) cur.duration = duration;
    byId.set(m[2], cur);
  });
  return [...byId.values()].filter((r) => r.title);
}

async function readShow(ctx, id) {
  const p = await ctx.newPage();
  try {
    for (let attempt = 1; attempt <= 2; attempt++) {   // 描画が遅い朝に備えて1回だけ読み直す
      await p.goto(`https://music.amazon.co.jp/podcasts/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      try { await p.waitForSelector('a[href*="/episodes/"]', { timeout: 45000, state: 'attached' }); } catch (e) { if (attempt === 2) throw e; continue; }
      await p.waitForTimeout(3000);
      const rows = await p.evaluate(`(${pickRows.toString()})(document, location.origin)`);
      if (rows.length || attempt === 2) return rows;
    }
    return [];
  } finally { await p.close(); }
}

async function main() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const b = await chromium.launch(), ctx = await b.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1280, height: 2000 } }), out = { generatedAt: new Date().toISOString(), shows: {} };
  for (const [show, id] of Object.entries(SHOWS)) {
    const rows = await readShow(ctx, id);
    if (!rows.length) throw new Error('NO_EPISODES ' + show);
    out.shows[show] = { id, episodes: rows.filter((r) => r.url.includes(id)).map((r) => ({ ...r, date: absoluteDate(r.date) })) };
    console.log(show, out.shows[show].episodes.length);
  }
  await b.close();
  fs.mkdirSync('docs/amazon', { recursive: true }); fs.writeFileSync('docs/amazon/latest.json', JSON.stringify(out, null, 1) + '\n');
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
