// Spotify 新着（2026-11-18 管理人指示・#337 後続）: 7番組の Spotify 番組の「埋め込みページ」を読み、新しい回の
// エピソードURL・題名・配信日・長さを docs/spotify/latest.json に保存する。Spotify API の認証情報は使わない。
// 埋め込みページはサーバー側で回の一覧（__NEXT_DATA__）を返すので、ブラウザ描画は不要。1日2回・7ページだけ。
// V2 への書込はしない（清掃ロボGASの巡回が題名・日付で照合し、確定した回の空欄にだけ書く）。
import fs from 'node:fs';
export const SHOWS = {
  'ニュースの現場から': '392h0MYfvMTndEVzf2cOvC', 'ニュースの学校': '2uG9W6CnsaNi87AfSuGe8r', '報談': '5Dt1uyQaJpM6hPV8aEMP3R',
  'スポンジ': '7euH6hzudIdp61JRSi9E8w', 'MEDIA TALK': '0yhef9ORZkUZs9ZeotdCSY', 'こどもそうだんしつ': '1KExdSsjQnatS4TdseGoC0', 'ドーナツ': '0341I5UOUrJgm7KEvNGInZ',
};
// __NEXT_DATA__ の中から「エピソードの形」をしたものを全部拾う（構造が変わっても拾えるように再帰で探す）
export function extractEpisodes(nextData) {
  const out = new Map();
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const uri = typeof x.uri === 'string' ? x.uri : '';
    const m = uri.match(/^spotify:episode:([A-Za-z0-9]{22})$/);
    if (m) {
      const title = String(x.title || x.name || '').trim();
      const rd = x.releaseDate && (x.releaseDate.isoString || x.releaseDate) || x.release_date || '';
      const dv = x.duration && typeof x.duration === 'object' ? x.duration.totalMilliseconds : (x.duration || x.duration_ms || 0), dur = Number(dv || 0);
      const cur = out.get(m[1]) || {};
      out.set(m[1], { id: m[1], url: 'https://open.spotify.com/episode/' + m[1], title: cur.title || title, date: cur.date || String(rd || '').slice(0, 10), durationMs: cur.durationMs || (Number.isFinite(dur) ? dur : 0) });
    }
    Object.values(x).forEach(walk);
  };
  walk(nextData);
  return [...out.values()].filter((e) => e.title);
}
export function nextDataFromHtml(html) {
  const m = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}
// 番組ページ（ログイン不要）をブラウザで開き、画面が裏で受け取る回一覧のJSONから拾う。下へ送って過去回も読む。
async function fromShowPage(ctx, id, want) {
  const p = await ctx.newPage(), found = new Map();
  p.on('response', async (r) => {
    try {
      if (!/spotify\.com/.test(r.url()) || !/json/.test(r.headers()['content-type'] || '')) return;
      extractEpisodes(await r.json()).forEach((e) => { if (!found.has(e.id)) found.set(e.id, e); });
    } catch (e) {}
  });
  await p.goto(`https://open.spotify.com/show/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(5000);
  for (let i = 0; i < 25 && found.size < want; i++) {
    await p.mouse.wheel(0, 4000);
    await p.evaluate(() => { const m = document.querySelector('main') || document.scrollingElement; [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && getComputedStyle(e).overflowY !== 'visible').forEach((e) => { e.scrollTop = e.scrollHeight; }); if (m) m.scrollTop = m.scrollHeight; });
    await p.waitForTimeout(1500);
  }
  // 画面上のリンクからも拾う（JSONが取れなかった回の保険。題名はリンク文字）
  const dom = await p.$$eval('a[href*="/episode/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), title: (a.innerText || a.getAttribute('aria-label') || '').trim() })));
  for (const d of dom) { const m = String(d.href).match(/\/episode\/([A-Za-z0-9]{22})/); if (m && d.title && !found.has(m[1])) found.set(m[1], { id: m[1], url: 'https://open.spotify.com/episode/' + m[1], title: d.title, date: '', durationMs: 0, from: 'dom' }); }
  await p.close();
  return [...found.values()];
}
async function main() {
  const out = { generatedAt: new Date().toISOString(), source: 'open.spotify.com（埋め込み＋番組ページ）', shows: {} };
  const problems = [];
  let ctx = null, browser = null;
  try {
    const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch(); ctx = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  } catch (e) { console.log('::warning::Playwright が使えないため埋め込みページだけ読みます'); }
  for (const [show, id] of Object.entries(SHOWS)) {
    const res = await fetch(`https://open.spotify.com/embed/show/${id}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; asarisunowa-library/1.0)', 'accept-language': 'ja-JP' } });
    const nd = res.ok ? nextDataFromHtml(await res.text()) : null;
    const byId = new Map((nd ? extractEpisodes(nd) : []).map((e) => [e.id, e]));
    if (ctx) for (const e of await fromShowPage(ctx, id, 60)) { const c = byId.get(e.id); byId.set(e.id, c ? { ...e, ...c, date: c.date || e.date, durationMs: c.durationMs || e.durationMs } : e); }
    const eps = [...byId.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    out.shows[show] = { showId: id, count: eps.length, episodes: eps };
    console.log(`${show}: 回数 ${eps.length}（日付あり ${eps.filter((e) => e.date).length}） 最新 ${eps[0] ? eps[0].date + ' ' + eps[0].title.slice(0, 30) : '-'} 最古 ${eps.length ? eps[eps.length - 1].date : '-'}`);
    if (!eps.length) problems.push(show);
  }
  if (browser) await browser.close();
  if (Object.values(out.shows).every((s) => !s.count)) throw new Error('全番組で回が取れませんでした');
  fs.mkdirSync('docs/spotify', { recursive: true });
  fs.writeFileSync('docs/spotify/latest.json', JSON.stringify(out, null, 1) + '\n');
  if (problems.length) console.log('::warning::回が取れなかった番組: ' + problems.join(' / '));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
