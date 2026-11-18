// サイト全体の不具合点検（読むだけ）。結果を docs/ops/site-review.json に書く。
import { chromium } from 'playwright';
import fs from 'node:fs';
const BASE = 'https://neyito96.github.io/asarisunowa/';
const R = { at: new Date().toISOString(), pages: [] };
const browser = await chromium.launch();
async function audit(name, url, vp, act) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ja-JP' });
  const p = await ctx.newPage(), rec = { name, url, viewport: vp.width, console: [], pageErrors: [], failed: [], http4xx5xx: [], notes: {} };
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') rec.console.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on('pageerror', (e) => rec.pageErrors.push(String(e).slice(0, 300)));
  p.on('requestfailed', (q) => rec.failed.push(`${q.failure()?.errorText} ${q.url().slice(0, 160)}`));
  p.on('response', (r) => { if (r.status() >= 400) rec.http4xx5xx.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  try {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    if (act) await act(p, rec);
    rec.notes.brokenImages = await p.$$eval('img', (is) => is.filter((i) => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none').map((i) => (i.getAttribute('src') || '').slice(0, 120)).slice(0, 15));
    rec.notes.horizontalOverflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    rec.notes.overflowingEls = await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 2 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map((e) => e.tagName + '.' + String(e.className).slice(0, 40)));
    rec.notes.emptyLinks = await p.$$eval('a', (as) => as.filter((a) => !a.getAttribute('href') || a.getAttribute('href') === '#').map((a) => a.textContent.trim().slice(0, 30)).filter(Boolean).slice(0, 10));
    rec.notes.dupIds = await p.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach((e) => { c[e.id] = (c[e.id] || 0) + 1; }); return Object.entries(c).filter(([, n]) => n > 1).slice(0, 10); });
    rec.notes.textGlitches = await p.evaluate(() => (document.body.innerText.match(/undefined|NaN|\[object Object\]|null年|Invalid Date/g) || []).slice(0, 10));
  } catch (e) { rec.pageErrors.push('点検失敗: ' + String(e).slice(0, 200)); }
  rec.console = [...new Set(rec.console)].slice(0, 20); rec.failed = [...new Set(rec.failed)].slice(0, 20); rec.http4xx5xx = [...new Set(rec.http4xx5xx)].slice(0, 20);
  R.pages.push(rec); await ctx.close();
}
const tab = (t) => async (p, rec) => { await p.waitForSelector('.viewTabs button', { timeout: 30000 }); await p.click(`.viewTabs button[data-tab="${t}"]`); await p.waitForTimeout(7000); rec.notes.cards = await p.evaluate(() => document.querySelectorAll('article, .card, [class*="Card"]').length); rec.notes.textLen = (await p.innerText('main').catch(() => '')).length; };
for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  for (const t of ['official', 'posusume', 'circle', 'podcasts', 'spotify', 'discord']) await audit('トップ:' + t, BASE + '?r=' + Date.now(), vp, tab(t));
  await audit('蔵:初期', BASE + 'library/', vp, async (p, rec) => { await p.waitForTimeout(3000); rec.notes.cards = await p.$$eval('article', (a) => a.length); });
  await audit('蔵:検索', BASE + 'library/', vp, async (p, rec) => {
    for (const q of ['こどもそうだんしつ', '神田大介', 'カガク', 'ｘｙｚｚｚ無い語']) {
      await p.fill('#query', q); await p.press('#query', 'Enter'); await p.waitForTimeout(5000);
      rec.notes['検索:' + q] = { 件数表示: (await p.evaluate(() => (document.body.innerText.match(/\d[\d,]*\s*件/) || [''])[0])), cards: await p.$$eval('article', (a) => a.length) };
    }
    const a = await p.$('article a[href*="spotify"], article a[target]'); rec.notes.cardLinkTarget = a ? await a.getAttribute('target') : 'リンクなし';
  });
  await audit('蔵:詳細', BASE + 'library/?id=EP-06744', vp, async (p, rec) => { await p.waitForTimeout(4000); rec.notes.text = (await p.innerText('body')).slice(0, 300); });
}
await browser.close();
fs.mkdirSync('docs/ops', { recursive: true });
fs.writeFileSync('docs/ops/site-review.json', JSON.stringify(R, null, 1) + '\n');
console.log('done', R.pages.length);
