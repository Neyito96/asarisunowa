// 公開サイトを実際に開いて確認する（読むだけ）。結果は GitHub のアノテーションに出す。
import { chromium } from 'playwright';
const BASE = 'https://neyito96.github.io/asarisunowa/';
const out = [];
const note = (k, v) => { const s = `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`; out.push(s); console.log(`::notice title=${k}::${s.replace(/\n/g, ' ')}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(BASE + '?t=' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.viewTabs button', { timeout: 30000 });
  const tabs = await page.$$eval('.viewTabs button', (bs) => bs.filter((b) => getComputedStyle(b).display !== 'none')
    .map((b) => ({ t: b.textContent.trim(), x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y), tab: b.dataset.tab || '' }))
    .sort((a, b) => a.y - b.y || a.x - b.x).map((b) => b.t));
  note('タブの並び', tabs.join(' → '));
  // ポすすめ
  await page.click('.viewTabs button[data-tab="posusume"]');
  await page.waitForTimeout(6000);
  for (const name of ['井戸の聲', 'ポッドキャスト茶会']) {
    const info = await page.evaluate((name) => {
      const cards = [...document.querySelectorAll('article, .card, li, div')].filter((el) => el.children.length && el.textContent.includes(name) && el.querySelector('img') && el.textContent.length < 3000);
      const card = cards.sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (!card) return null;
      const links = [...card.querySelectorAll('a[href]')].map((a) => a.href);
      return { spotify: links.find((u) => /open\.spotify\.com\/show\//.test(u)) || '', listen: links.find((u) => /listen\.style\/p\//.test(u)) || '', img: (card.querySelector('img') || {}).src || '', dateLine: /紹介配信日/.test(card.textContent), intro: /紹介された回/.test(card.textContent) };
    }, name);
    note('ポすすめ ' + name, info || '見つからない');
  }
  const counts = await page.evaluate(() => ({ 紹介配信日: (document.body.innerText.match(/紹介配信日/g) || []).length, 紹介された回: (document.body.innerText.match(/紹介された回/g) || []).length }));
  note('ポすすめ 日付表示', counts);
  // Spotifyリスト
  await page.click('.viewTabs button[data-tab="spotify"]');
  await page.waitForTimeout(4000);
  const bar = await page.evaluate(() => { const b = document.getElementById('spotify-shelf-bar'); return b ? { text: b.innerText.replace(/\s+/g, ' ').trim(), tabs: b.querySelectorAll('[role=tab]').length } : null; });
  note('Spotifyリスト 切替バー', bar || 'なし');
  const head = await page.evaluate(() => (document.querySelector('.playlistThemeHead') || {}).innerText || '');
  note('Spotifyリスト 見出し', head.replace(/\s+/g, ' ').slice(0, 80));
  // 蔵
  await page.goto(BASE + 'library/?t=' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
  const libSrc = await page.$$eval('script[src]', (s) => s.map((x) => x.getAttribute('src')).filter((x) => /library\.mjs/.test(x)));
  const mjs = await (await page.request.get(BASE + 'library/library.mjs?t=' + Date.now())).text();
  note('蔵 推薦フォームのSpotifyチェック', mjs.includes('Spotifyプレイリストにしてほしい') ? 'あり' : 'なし');
  const scope = await (await page.request.get(BASE + 'library/data/scope.json?t=' + Date.now())).json();
  note('蔵 公開件数', (scope.publishedIds || []).length);
  let amazon = 0, latest = [], spotify = 0, spMiss = [];
  for (const b of [134, 135]) {
    const r = await page.request.get(`${BASE}library/data/details/${b}.json?t=${Date.now()}`);
    if (!r.ok()) continue;
    for (const e of await r.json()) { if ((e.links || []).some((l) => /music\.amazon/.test(l))) { amazon++; latest.push(e.id); } if ((e.links || []).some((l) => /open\.spotify\.com\/episode\//.test(l))) spotify++; else spMiss.push(e.id); }
  }
  note('蔵 EP-06700以降の配信リンク', { Amazonあり: amazon, Spotifyあり: spotify, Spotifyなし: spMiss });
} catch (e) {
  note('エラー', String(e && e.stack || e).slice(0, 400));
  process.exitCode = 1;
} finally { await browser.close(); }
// rerun 1794990607
