#!/usr/bin/env node
// 読み取り専用: 蔵の配信先URLの空き（Apple・LISTEN・Pody）について、各サービスに回が「在るのか」を確かめる。
// 台帳・GAS・公開データは変えない。結果は docs/audits/platform-gaps/ に JSON で残す。
// モード:
//   probe      … 番組ごとの Apple 番組情報・フィード件数、空いている回の抜き取り検索、LISTEN/Pody の番組の有無
//   apple-map  … 指定番組の空いている回を iTunes Search で全件検索し、題名＋配信日で 1対1 に対応した回だけを対応表にする
// URL は各サービスの API・ページが返した値だけを使う（推測で組み立てない）。
import fs from 'node:fs';
import path from 'node:path';

const DETAILS = 'public/library/data/details';
const OUTDIR = 'docs/audits/platform-gaps';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nz = (s) => String(s || '').normalize('NFKC')
  .replace(/[#＃]\s*[\d-]+/g, '')
  .replace(/[\s「」『』（）()【】〈〉＜＞<>・、。,.!?！？〜~…"'“”‘’\-—―:：]/g, '');
const jstDay = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
const UA = { 'user-agent': 'asarisunowa-audit/1.0 (+https://github.com/Neyito96/asarisunowa)' };

async function get(url, as = 'json') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow' });
      if (r.status === 403 || r.status === 429) { await sleep(20000 * (i + 1)); continue; }
      if (!r.ok) return { status: r.status };
      return { status: r.status, body: as === 'json' ? await r.json() : await r.text() };
    } catch (e) { await sleep(3000); }
  }
  return { status: 0 };
}

export function loadKura() {
  const out = [];
  for (const f of fs.readdirSync(DETAILS).filter((f) => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DETAILS, f), 'utf8'));
    for (const e of Array.isArray(d) ? d : Object.values(d)) if (e && e.id) out.push(e);
  }
  return out;
}
const has = (e, re) => (e.links || []).some((u) => re.test(u));
const APPLE = /podcasts\.apple\.com\/.*[?&]i=\d+/;
const appleShowOf = (u) => (String(u).match(/podcasts\.apple\.com\/.*\/id(\d+)/) || [])[1] || '';
const guidOf = (e) => ((e.links || []).map((u) => (u.match(/itemid=([0-9a-f-]{36})/i) || [])[1]).find(Boolean) || '').toLowerCase();

export function appleShowIds(kura) {
  const by = {};
  for (const e of kura) for (const u of e.links || []) { const id = appleShowOf(u); if (id) { by[e.show] = by[e.show] || {}; by[e.show][id] = (by[e.show][id] || 0) + 1; } }
  const out = {};
  for (const [s, m] of Object.entries(by)) out[s] = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
  if (!out['SDGsを話そう'] && out['こどもそうだんしつ']) out['SDGsを話そう'] = out['こどもそうだんしつ'];   // SDGs の過去回は こどもそうだんしつ のフィードにある（GAS P29_FEED_SHARE_ と同じ扱い）
  return out;
}

// RSS の item を {title, pub, guid, dur} にする（依存なしの簡易パーサ）
export function rssItems(xml) {
  const items = [];
  for (const m of String(xml).matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const x = m[0], t = (re) => { const k = x.match(re); return k ? k[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : ''; };
    const d = t(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/);
    const dur = /:/.test(d) ? d.split(':').reduce((a, b) => a * 60 + Number(b), 0) : Number(d) || 0;
    items.push({ title: t(/<title>([\s\S]*?)<\/title>/), pub: new Date(t(/<pubDate>([\s\S]*?)<\/pubDate>/)).toISOString?.() || '', guid: t(/<guid[^>]*>([\s\S]*?)<\/guid>/).toLowerCase(), dur });
  }
  return items;
}

// 題名＋配信日（±2日）で 1対1。複数あれば長さ（±5秒）で絞る。それでも複数なら保留。
export function matchByTitleDate(kura, cands, pubOf = (c) => c.pub) {
  const byTitle = new Map();
  for (const c of cands) { const k = nz(c.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(c); }
  const matched = [], ambiguous = [], missing = [];
  for (const e of kura) {
    const d = String(e.date).slice(0, 10);
    let c = (byTitle.get(nz(e.title)) || []).filter((x) => dayDiff(jstDay(pubOf(x)), d) <= 2);
    if (c.length > 1 && e.duration) c = c.filter((x) => x.dur && Math.abs(x.dur - e.duration) <= 5);
    if (c.length === 1) matched.push({ e, c: c[0] }); else (c.length ? ambiguous : missing).push({ id: e.id, title: e.title, date: d, n: c.length });
  }
  const used = new Map(); for (const m of matched) { const k = m.c.key || m.c.guid || m.c.title + m.c.pub; used.set(k, (used.get(k) || 0) + 1); }
  const dup = new Set([...used].filter(([, n]) => n > 1).map(([k]) => k));
  return { matched: matched.filter((m) => !dup.has(m.c.key || m.c.guid || m.c.title + m.c.pub)), ambiguous, missing, duplicates: dup.size };
}

async function itunesSearch(term, collectionId) {
  const q = String(term).replace(/[#＃]\s*[\d-]+\s*$/, '').slice(0, 80);
  const r = await get(`https://itunes.apple.com/search?entity=podcastEpisode&country=JP&limit=50&term=${encodeURIComponent(q)}`);
  if (r.status !== 200) return { status: r.status, hits: [] };
  return { status: 200, hits: (r.body.results || []).filter((x) => String(x.collectionId) === String(collectionId)).map((x) => ({ key: String(x.trackId), title: x.trackName, pub: x.releaseDate, dur: Math.round((x.trackTimeMillis || 0) / 1000), guid: String(x.episodeGuid || '').toLowerCase(), url: x.trackViewUrl })) };
}

async function probe() {
  const kura = loadKura(), ids = appleShowIds(kura), shows = [...new Set(kura.map((e) => e.show))], out = { generatedAt: new Date().toISOString(), apple: {}, listen: {}, pody: {} };
  for (const s of shows) {
    const id = ids[s]; const eps = kura.filter((e) => e.show === s), gap = eps.filter((e) => !has(e, APPLE));
    const o = out.apple[s] = { showId: id || null, kura: eps.length, gap: gap.length };
    if (!id || !gap.length) continue;
    const lk = await get(`https://itunes.apple.com/lookup?id=${id}`); await sleep(3100);
    const meta = lk.body?.results?.[0] || {}; o.collectionName = meta.collectionName; o.trackCount = meta.trackCount; o.feedUrl = meta.feedUrl;
    if (meta.feedUrl) {
      const f = await get(meta.feedUrl, 'text');
      if (f.status === 200) { const items = rssItems(f.body); const m = matchByTitleDate(gap, items); o.feed = { items: items.length, gapFoundInFeed: m.matched.length, gapByGuid: gap.filter((e) => guidOf(e) && items.some((i) => i.guid === guidOf(e))).length }; }
      else o.feed = { status: f.status };
    }
    const sample = gap.filter((_, i) => i % Math.max(1, Math.floor(gap.length / 12)) === 0).slice(0, 12), res = [];
    for (const e of sample) {
      const r = await itunesSearch(e.title, id); await sleep(3100);
      const tm = r.hits.filter((h) => nz(h.title) === nz(e.title) && dayDiff(jstDay(h.pub), String(e.date).slice(0, 10)) <= 2);
      res.push({ id: e.id, http: r.status, sameShowHits: r.hits.length, titleDate: tm.length, guidSame: !!guidOf(e) && r.hits.some((h) => h.guid === guidOf(e)) });
    }
    o.sample = res; o.sampleSummary = { n: res.length, found: res.filter((x) => x.titleDate === 1).length, guidSame: res.filter((x) => x.guidSame).length };
  }
  // LISTEN: SDGs の番組があるか（検索ページ）・こどもそうだんしつ のRSS件数
  for (const q of ['SDGsを話そう', 'SDGs 朝日新聞']) {
    const r = await get(`https://listen.style/search?q=${encodeURIComponent(q)}`, 'text'); await sleep(1500);
    out.listen[q] = r.status === 200 ? [...new Set([...r.body.matchAll(/href="\/p\/([a-z0-9]+)"[^>]*>([\s\S]{0,120}?)</g)].map((m) => m[1] + ' ' + m[2].replace(/<[^>]+>/g, '').trim()))].slice(0, 15) : { status: r.status };
  }
  // Pody: SDGs の番組があるか
  for (const q of ['SDGsを話そう']) {
    const r = await get(`https://pody.jp/search?q=${encodeURIComponent(q)}`, 'text'); await sleep(1500);
    out.pody[q] = r.status === 200 ? [...new Set([...r.body.matchAll(/\/player\/([A-Za-z0-9]{20})(?!\/)/g)].map((m) => m[1]))].slice(0, 15) : { status: r.status };
    out.pody[q + ' (text)'] = r.status === 200 ? (r.body.match(/SDGs[^<]{0,60}/g) || []).slice(0, 10) : null;
  }
  return out;
}

async function appleMap(show) {
  const kura = loadKura(), ids = appleShowIds(kura), id = ids[show];
  if (!id) throw new Error('Apple 番組ID が分からない: ' + show);
  const gap = kura.filter((e) => e.show === show && !has(e, APPLE)), found = new Map(), stat = { asked: 0, http: {} };
  for (const e of gap) {
    const r = await itunesSearch(e.title, id); stat.asked++; stat.http[r.status] = (stat.http[r.status] || 0) + 1;
    for (const h of r.hits) found.set(h.key, h);
    await sleep(3100);
  }
  const cands = [...found.values()].filter((h) => /^https:\/\/podcasts\.apple\.com\/.+[?&]i=\d+/.test(h.url || ''));
  const m = matchByTitleDate(gap, cands);
  const matched = m.matched.map(({ e, c }) => ({ id: e.id, date: String(e.date).slice(0, 10), title: e.title, appleTitle: c.title, applePub: c.pub, durationDiff: e.duration && c.dur ? c.dur - e.duration : null, guidSame: !!guidOf(e) && c.guid === guidOf(e), url: c.url.replace(/&uo=\d+$/, '') }));
  return { summary: { generatedAt: new Date().toISOString(), show, appleShowId: id, gap: gap.length, searched: stat.asked, http: stat.http, candidates: cands.length, matched: matched.length, guidSame: matched.filter((x) => x.guidSame).length, ambiguous: m.ambiguous.length, missing: m.missing.length, duplicatesDropped: m.duplicates, durationDiffOver5s: matched.filter((x) => x.durationDiff != null && Math.abs(x.durationDiff) > 5).map((x) => ({ id: x.id, diff: x.durationDiff })) }, matched, ambiguous: m.ambiguous, missing: m.missing };
}

// SDGsを話そう の過去回が、各サービスで別の番組として置かれていないかを探す（番組名で検索）
async function findShow() {
  const out = { generatedAt: new Date().toISOString(), apple: [], pocketcasts: null };
  for (const term of ['SDGsを話そう', 'SDGsを話そう アーカイブ', '朝日新聞 SDGs']) {
    const r = await get(`https://itunes.apple.com/search?entity=podcast&country=JP&limit=25&term=${encodeURIComponent(term)}`); await sleep(3100);
    for (const x of r.body?.results || []) if (/SDGs/i.test(x.collectionName || '')) out.apple.push({ term, id: x.collectionId, name: x.collectionName, artist: x.artistName, count: x.trackCount, feedUrl: x.feedUrl, url: x.collectionViewUrl });
  }
  const pc = await get('https://podcast-api.pocketcasts.com/podcast/full/6b348970-8060-013f-f21c-0affd341b2cf');
  out.pocketcasts = pc.body ? { title: pc.body.podcast?.title, url: pc.body.podcast?.url, author: pc.body.podcast?.author, episodes: (pc.body.podcast?.episodes || []).length } : { status: pc.status };
  // Apple で見つかった SDGs 番組のフィードと 蔵 の SDGs 回の対応
  const kura = loadKura().filter((e) => e.show === 'SDGsを話そう');
  for (const a of out.apple) {
    if (!a.feedUrl || a.checked) continue; a.checked = true;
    const f = await get(a.feedUrl, 'text'); if (f.status !== 200) { a.feed = { status: f.status }; continue; }
    const items = rssItems(f.body); const m = matchByTitleDate(kura, items); a.feed = { items: items.length, kuraMatched: m.matched.length, ambiguous: m.ambiguous.length, missing: m.missing.length };
  }
  return out;
}

async function main() {
  const [mode = 'probe', arg] = process.argv.slice(2);
  fs.mkdirSync(OUTDIR, { recursive: true });
  if (mode === 'probe') { const o = await probe(); fs.writeFileSync(path.join(OUTDIR, 'probe.json'), JSON.stringify(o, null, 1) + '\n'); console.log(JSON.stringify(o, null, 1).slice(0, 6000)); }
  else if (mode === 'find-show') { const o = await findShow(); fs.writeFileSync(path.join(OUTDIR, 'find-show.json'), JSON.stringify(o, null, 1) + '\n'); console.log(JSON.stringify(o, null, 1).slice(0, 4000)); }
  else if (mode === 'apple-map' && arg.includes(',')) { for (const s of arg.split(',')) { const o = await appleMap(s); fs.writeFileSync(path.join(OUTDIR, `apple-map-${s}.json`), JSON.stringify(o, null, 1) + '\n'); console.log(JSON.stringify(o.summary, null, 1)); } }
  else if (mode === 'apple-map') { const o = await appleMap(arg); const f = path.join(OUTDIR, `apple-map-${arg}.json`); fs.writeFileSync(f, JSON.stringify(o, null, 1) + '\n'); console.log(JSON.stringify(o.summary, null, 1)); }
  else throw new Error('mode: probe | apple-map <番組>');
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
