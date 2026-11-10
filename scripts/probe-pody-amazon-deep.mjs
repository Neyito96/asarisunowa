// 第44号 B: Pody / Amazon Music の「個別EP URLとGUID/公式IDを結べる経路」を探す。READ ONLY・公開ページが返す内容のみ。
// 認証回避・UA偽装・bot対策回避はしない。公開HTML/JS内にある参照（RSS/JSON-LD/内部APIのURL）を列挙するだけ。
import fs from 'node:fs';
import { POLICY } from '../public/library/link-discovery.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(u, accept = 'text/html,*/*;q=0.5') {
  await sleep(1500);
  const res = await fetch(u, { headers: { 'user-agent': POLICY.userAgent, accept }, signal: AbortSignal.timeout(25000), redirect: 'follow' }).catch((e) => ({ err: String(e).slice(0, 60) }));
  if (res.err) return { code: 0, text: '', ctype: '', final: u, err: res.err };
  return { code: res.status, text: await res.text(), ctype: res.headers.get('content-type') || '', final: res.url };
}
const uniq = (a) => [...new Set(a)];
function scan(html, base) {
  const meta = {};
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)="([^"]+)"[^>]+content="([^"]*)"/g)) if (/^(og:|twitter:|description|robots)/.test(m[1])) meta[m[1]] = m[2].slice(0, 100);
  return {
    bytes: html.length, title: (html.match(/<title>([^<]*)/) || [])[1]?.slice(0, 80), meta,
    scripts: uniq([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], base).href)).slice(0, 12),
    jsonld: /application\/ld\+json/.test(html), nextData: /__NEXT_DATA__/.test(html), nuxt: /__NUXT__/.test(html), initialState: /__INITIAL_STATE__|window\.__/.test(html),
    rssLinks: uniq([...html.matchAll(/https?:[^"'\s<>]+(?:rss|feed|\.xml)[^"'\s<>]*/gi)].map((m) => m[0])).slice(0, 8),
    audioRefs: uniq([...html.matchAll(/https?:[^"'\s<>]+\.(?:mp3|m4a)[^"'\s<>]*/gi)].map((m) => m[0].replace(/\?.*/, ''))).slice(0, 5),
    apiHints: uniq([...html.matchAll(/["'](\/api\/[^"'\s]{2,80}|https?:\/\/[^"'\s]*api[^"'\s]{2,80})["']/gi)].map((m) => m[1])).slice(0, 10),
  };
}
async function jsApiHints(scripts, origin) {
  const hints = [];
  for (const s of scripts.filter((x) => x.startsWith(origin)).slice(0, 6)) {
    const r = await get(s, '*/*');
    for (const m of r.text.matchAll(/["'`](\/api\/[A-Za-z0-9_\/\-\.\{\}\$]{2,80}|https?:\/\/[A-Za-z0-9.\-]*(?:api|graphql)[A-Za-z0-9.\-]*\/[A-Za-z0-9_\/\-\.]{0,60})["'`]/g)) hints.push(m[1]);
  }
  return uniq(hints).slice(0, 25);
}
const urls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = { pody: {}, amazon: {} };
{ // Pody: 1番組の番組ページ→EPページ。構造・API参照・音声参照
  const id = urls.pody['ニュースの現場から'];
  const show = await get(`https://pody.jp/player/${id}`);
  const eps = uniq([...show.text.matchAll(new RegExp(`/player/${id}/([A-Za-z0-9]+)`, 'g'))].map((m) => m[1]));
  const sc = scan(show.text, show.final);
  out.pody.show = { code: show.code, ctype: show.ctype, ...sc, epLinks: eps.length, jsApi: await jsApiHints(sc.scripts, 'https://pody.jp') };
  if (eps[0]) { const ep = await get(`https://pody.jp/player/${id}/${eps[0]}`); out.pody.ep = { code: ep.code, ...scan(ep.text, ep.final) }; }
  for (const p of ['/robots.txt', '/sitemap.xml']) { const r = await get(`https://pody.jp${p}`); out.pody[p] = { code: r.code, head: r.text.slice(0, 400).replace(/\s+/g, ' ') }; }
}
{ // Amazon Music: 番組ページの殻の中身（EP一覧が取れない理由）
  const u = urls.amazon['ニュースの現場から'];
  const show = await get(u);
  const sc = scan(show.text, show.final);
  out.amazon.show = { code: show.code, ctype: show.ctype, ...sc, jsApi: await jsApiHints(sc.scripts, new URL(show.final).origin), epRegex: (show.text.match(/\/episodes\/[0-9a-f-]{36}/gi) || []).length, body: show.text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) };
  for (const p of ['/robots.txt']) { const r = await get(`https://music.amazon.co.jp${p}`); out.amazon[p] = { code: r.code, head: r.text.slice(0, 600).replace(/\s+/g, ' ') }; }
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(JSON.stringify({ podyShow: out.pody.show?.code, podyApi: out.pody.show?.jsApi?.length, amazon: out.amazon.show?.code }));
