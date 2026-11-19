#!/usr/bin/env node
// 朝ポキの宇宙（アルテキスト計画）: 蔵の公開データから「言葉の地図」を事前計算する。
//   node scripts/uchu/build-uchu.mjs
// 入力: public/library/data/details/*.json（蔵の正本の公開写し。読むだけ）
// 出力: public/uchu/data/core.json（星・言葉・星雲） / public/uchu/data/rel.json（関連する回と、その根拠）
// 関係の根拠は3種類だけ: 共通の言葉（統計的な共起）・同じ記事URL・同じ出演者。AI による意味の推測はしない。
import fs from 'node:fs';
import path from 'node:path';
import { extractTerms, termKey, parseCast, normalizeArticleUrl } from './uchu-core.mjs';
import { TAXONOMY } from './taxonomy.mjs';
import { PLACES, placesOfEpisode } from './geo.mjs';
import { classify, fillFromNeighbors, trainNB, predictNB, stripBoilerplate } from './classify.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SRC = path.join(ROOT, 'public/library/data');
const OUT = path.join(ROOT, 'public/uchu/data');
const t0 = Date.now();

// 決定的な乱数（同じ入力なら毎回同じ地図）
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// ---- 1. 読み込み
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const files = fs.readdirSync(path.join(SRC, 'details')).filter((f) => /^\d+\.json$/.test(f));
let eps = [];
for (const f of files) eps.push(...JSON.parse(fs.readFileSync(path.join(SRC, 'details', f), 'utf8')));
eps = eps.filter((e) => /^EP-\d{5}$/.test(e.id)).sort((a, b) => a.id.localeCompare(b.id));
const N = eps.length;
const showNames = manifest.shows.map((s) => s.name);
for (const e of eps) if (!showNames.includes(e.show)) showNames.push(e.show);

// ---- 2. 語・人物・記事を取り出す
const surface = new Map(); // key -> Map(surface -> count)
const titleDf = new Map();
const df = new Map(), personDf = new Map(), articleEps = new Map();
const docs = eps.map((e, i) => {
  const tf = new Map();
  const add = (t, w) => { const k = termKey(t); tf.set(k, (tf.get(k) || 0) + w); const m = surface.get(k) || new Map(); m.set(t, (m.get(t) || 0) + 1); surface.set(k, m); };
  const tt = extractTerms(e.title); tt.forEach((t) => add(t, 3)); new Set(tt.map(termKey)).forEach((k) => titleDf.set(k, (titleDf.get(k) || 0) + 1));
  extractTerms(stripBoilerplate(e.description)).forEach((t) => add(t, 1));   // 定型文（番組宣伝・収録日など）は数えない
  // 関連記事の見出しからも言葉を取る（題名・概要欄と同じく「在るテキスト」として）
  (e.relatedArticles || []).forEach((a) => a && a.title && extractTerms(a.title).forEach((t) => add(t, 1)));
  const persons = parseCast(e.cast);
  const arts = new Set([...(e.related || []), ...((e.relatedArticles || []).map((a) => a && a.url))].map(normalizeArticleUrl).filter(Boolean));
  for (const k of tf.keys()) df.set(k, (df.get(k) || 0) + 1);
  for (const p of persons) personDf.set(p, (personDf.get(p) || 0) + 1);
  for (const a of arts) { const l = articleEps.get(a) || []; l.push(i); articleEps.set(a, l); }
  return { tf, persons, arts: [...arts] };
});

// ---- 3. 語彙: 3回以上・全体の5%以下に出る語（どこにでも出る語は根拠にならない）。人物名は人物として別に扱う
const personSet = new Set([...personDf].filter(([, n]) => n >= 2).map(([p]) => termKey(p)));
const vocab = [...df].filter(([k, n]) => n >= 3 && n <= N * 0.05 && !personSet.has(k)).sort((a, b) => b[1] - a[1]).map(([k]) => k);
const vIndex = new Map(vocab.map((k, i) => [k, i]));
const label = (k) => [...surface.get(k)].sort((a, b) => b[1] - a[1])[0][0];
const idf = vocab.map((k) => Math.log(N / df.get(k)));

// 回ごとの重み（tf-idf）上位12語、長さ1に正規化
const vecs = docs.map((d) => {
  const v = [];
  for (const [k, tf] of d.tf) { const j = vIndex.get(k); if (j !== undefined) v.push([j, (1 + Math.log(tf)) * idf[j]]); }
  v.sort((a, b) => b[1] - a[1]); const top = v.slice(0, 12); const n = Math.hypot(...top.map((x) => x[1])) || 1;
  return top.map(([j, w]) => [j, w / n]);
});
const postings = vocab.map(() => []);
vecs.forEach((v, i) => v.forEach(([j]) => postings[j].push(i)));

// ---- 4. 地図に載せる語（上位語に5回以上）と、語どうしの近さ（共起の cosine）
const MAP_MIN = 5;
const mapTerms = vocab.map((_, j) => j).filter((j) => postings[j].length >= MAP_MIN);
const isMap = new Set(mapTerms);
const cooc = new Map();
for (const v of vecs) {
  const js = v.map((x) => x[0]).filter((j) => isMap.has(j));
  for (let a = 0; a < js.length; a++) for (let b = a + 1; b < js.length; b++) {
    const [x, y] = js[a] < js[b] ? [js[a], js[b]] : [js[b], js[a]]; const key = x * 100000 + y; cooc.set(key, (cooc.get(key) || 0) + 1);
  }
}
const nbr = new Map(mapTerms.map((j) => [j, []]));
for (const [key, c] of cooc) {
  if (c < 2) continue; const x = Math.floor(key / 100000), y = key % 100000;
  const s = c / Math.sqrt(postings[x].length * postings[y].length);
  nbr.get(x).push([y, s, c]); nbr.get(y).push([x, s, c]);
}
for (const l of nbr.values()) { l.sort((a, b) => b[1] - a[1]); l.splice(10); }

// ---- 5. 星雲（語のまとまり）: 重み付きラベル伝播。決定的な順序
const lab = new Map(mapTerms.map((j) => [j, j]));
const order = [...mapTerms].sort((a, b) => postings[b].length - postings[a].length);
for (let it = 0; it < 30; it++) {
  let changed = 0;
  for (const j of order) {
    const score = new Map();
    for (const [y, s] of nbr.get(j)) score.set(lab.get(y), (score.get(lab.get(y)) || 0) + s);
    if (!score.size) continue;
    const best = [...score].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    if (best !== lab.get(j)) { lab.set(j, best); changed++; }
  }
  if (!changed) break;
}
const groups = new Map();
for (const j of mapTerms) { const l = lab.get(j); (groups.get(l) || groups.set(l, []).get(l)).push(j); }
const big = [...groups.values()].filter((g) => g.length >= 6).sort((a, b) => b.reduce((s, j) => s + postings[j].length, 0) - a.reduce((s, j) => s + postings[j].length, 0)).slice(0, 32);
const comm = new Map(); big.forEach((g, c) => g.forEach((j) => comm.set(j, c)));
// 小さなまとまりの語は、一番強くつながる大きな星雲へ。つながりが無ければ星雲なし（-1）
for (let pass = 0; pass < 3; pass++) for (const j of mapTerms) {
  if (comm.has(j)) continue; const n = nbr.get(j).find(([y]) => comm.has(y)); if (n) comm.set(j, comm.get(n[0]));
}
const K = big.length;
const commTerms = Array.from({ length: K }, () => []);
for (const j of mapTerms) if (comm.has(j)) commTerms[comm.get(j)].push(j);
commTerms.forEach((l) => l.sort((a, b) => postings[b].length - postings[a].length));

// 回の星雲: 上位語の重みが最も集まる星雲
const epComm = vecs.map((v) => { const s = new Array(K).fill(0); v.forEach(([j, w]) => { if (comm.has(j)) s[comm.get(j)] += w; }); let b = -1, bv = 0.12; s.forEach((x, c) => { if (x > bv) { bv = x; b = c; } }); return b; });
const commSize = new Array(K).fill(0); epComm.forEach((c) => { if (c >= 0) commSize[c]++; });

// ---- 6. 配置。星雲どうしを力学配置 → 語を星雲内で力学配置 → 回は上位語の重心
const R = rng(20261119);
const cw = Array.from({ length: K }, () => new Array(K).fill(0));
for (const [key, c] of cooc) { const x = Math.floor(key / 100000), y = key % 100000; if (comm.has(x) && comm.has(y) && comm.get(x) !== comm.get(y)) { cw[comm.get(x)][comm.get(y)] += c; cw[comm.get(y)][comm.get(x)] += c; } }
const cr = commSize.map((n) => 40 + 9 * Math.sqrt(n));
const cp = Array.from({ length: K }, (_, c) => { const a = (c / K) * Math.PI * 2; return [Math.cos(a) * 600, Math.sin(a) * 600]; });
const maxW = Math.max(1, ...cw.flat());
for (let it = 0; it < 800; it++) {
  const f = cp.map(() => [0, 0]), temp = 30 * (1 - it / 800) + 1;
  for (let a = 0; a < K; a++) for (let b = a + 1; b < K; b++) {
    const dx = cp[a][0] - cp[b][0], dy = cp[a][1] - cp[b][1], d = Math.hypot(dx, dy) || 1, minD = cr[a] + cr[b] + 30;
    let force = (minD * minD) / d - (cw[a][b] / maxW) * d * 0.9 - d * 0.004;
    if (d < minD) force += (minD - d) * 2;
    f[a][0] += (dx / d) * force; f[a][1] += (dy / d) * force; f[b][0] -= (dx / d) * force; f[b][1] -= (dy / d) * force;
  }
  cp.forEach((p, c) => { const m = Math.hypot(...f[c]) || 1, s = Math.min(m, temp); p[0] += (f[c][0] / m) * s; p[1] += (f[c][1] / m) * s; });
}
const tp = new Map();
for (let c = 0; c < K; c++) {
  const ts = commTerms[c], r = cr[c];
  ts.forEach((j, i) => { const a = R() * Math.PI * 2, d = r * Math.sqrt((i + 0.5) / ts.length) * 0.9; tp.set(j, [cp[c][0] + Math.cos(a) * d, cp[c][1] + Math.sin(a) * d]); });
  const inC = new Set(ts);
  for (let it = 0; it < 120; it++) {
    const f = new Map(ts.map((j) => [j, [0, 0]])), k = r / Math.sqrt(ts.length + 1);
    for (let a = 0; a < ts.length; a++) for (let b = a + 1; b < ts.length; b++) {
      const pa = tp.get(ts[a]), pb = tp.get(ts[b]); const dx = pa[0] - pb[0], dy = pa[1] - pb[1], d = Math.hypot(dx, dy) || 0.1, rep = (k * k) / d;
      f.get(ts[a])[0] += (dx / d) * rep; f.get(ts[a])[1] += (dy / d) * rep; f.get(ts[b])[0] -= (dx / d) * rep; f.get(ts[b])[1] -= (dy / d) * rep;
    }
    for (const j of ts) for (const [y, s] of nbr.get(j)) if (inC.has(y)) {
      const pa = tp.get(j), pb = tp.get(y); const dx = pa[0] - pb[0], dy = pa[1] - pb[1], d = Math.hypot(dx, dy) || 0.1, att = (d * d / k) * s;
      f.get(j)[0] -= (dx / d) * att; f.get(j)[1] -= (dy / d) * att;
    }
    const temp = (r / 10) * (1 - it / 120) + 0.5;
    for (const j of ts) {
      const p = tp.get(j), fv = f.get(j), m = Math.hypot(...fv) || 1, s = Math.min(m, temp); p[0] += (fv[0] / m) * s; p[1] += (fv[1] / m) * s;
      const dx = p[0] - cp[c][0], dy = p[1] - cp[c][1], d = Math.hypot(dx, dy); if (d > r) { p[0] = cp[c][0] + (dx / d) * r; p[1] = cp[c][1] + (dy / d) * r; }
    }
  }
}
// 回: 地図の語（上位5語）の重み付き重心＋小さなゆらぎ。地図の語が無い回は「配置なし」（無理に置かない）
const epXY = vecs.map((v, i) => {
  const use = v.filter(([j]) => tp.has(j)).slice(0, 5); if (!use.length) return null;
  let x = 0, y = 0, w = 0; use.forEach(([j, wt]) => { const p = tp.get(j); x += p[0] * wt; y += p[1] * wt; w += wt; });
  const h = hash(eps[i].id), a = (h % 3600) / 3600 * Math.PI * 2, d = 4 + (h >>> 12) % 10;
  // 自分の星雲の中心へ少し寄せる（星雲を見分けやすくする。語の重心は保つ）
  let gx = x / w, gy = y / w; const c = epComm[i];
  if (c >= 0) { gx = gx * 0.55 + cp[c][0] * 0.45; gy = gy * 0.55 + cp[c][1] * 0.45; }
  return [gx + Math.cos(a) * d, gy + Math.sin(a) * d];
});

// ---- 7. 関連する回（根拠つき）: 共通の言葉＋同じ記事＋同じ出演者。同じ題名（再配信）は推薦から外して別に示す
const persons = [...personDf].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([p]) => p);
const pIndex = new Map(persons.map((p, i) => [p, i]));
const personEps = persons.map(() => []);
docs.forEach((d, i) => d.persons.forEach((p) => { const k = pIndex.get(p); if (k !== undefined) personEps[k].push(i); }));
const normTitle = (t) => String(t || '').normalize('NFKC').replace(/[\s【】「」『』（）()\[\]#＃・、。！？!?:：ー\-]/g, '').replace(/^(再|再配信)/, '');
const titleKey = eps.map((e) => normTitle(e.title));
const vecMap = vecs.map((v) => new Map(v));
const rel = eps.map((e, i) => {
  const sc = new Map(), why = new Map();
  const R_ = (o) => why.get(o) || why.set(o, { t: [], a: 0, p: [] }).get(o);
  for (const [j, w] of vecs[i]) {
    if (postings[j].length > 400) continue;
    for (const o of postings[j]) if (o !== i) { const ww = w * vecMap[o].get(j); sc.set(o, (sc.get(o) || 0) + ww); R_(o).t.push([j, ww]); }
  }
  for (const a of docs[i].arts) { const l = articleEps.get(a); if (l.length > 30) continue; for (const o of l) if (o !== i) { sc.set(o, (sc.get(o) || 0) + 0.6); R_(o).a++; } }
  for (const p of docs[i].persons) { const k = pIndex.get(p); if (k === undefined || personEps[k].length > 150) continue; for (const o of personEps[k]) if (o !== i) { sc.set(o, (sc.get(o) || 0) + 0.25); R_(o).p.push(k); } }
  const same = [], out = [];
  for (const [o, s] of [...sc].sort((a, b) => b[1] - a[1])) {
    if (titleKey[o] && titleKey[o] === titleKey[i]) { same.push(o); continue; }
    if (s < 0.15 || out.length >= 5) continue;
    const r = why.get(o); r.t.sort((a, b) => b[1] - a[1]);
    out.push([o, Math.round(s * 100), r.t.slice(0, 3).map((x) => x[0]), r.a, [...new Set(r.p)].slice(0, 2)]);
  }
  return same.length ? [out, same.slice(0, 5)] : [out];
});

// ---- 7b. 20大分類・小分類（Claude 試作）。旧分類の写し scripts/uchu/data/legacy-themes.json を手がかりに使う（参照のみ）
const legacy = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/uchu/data/legacy-themes.json'), 'utf8')).themes;
const inputOf = (e) => ({ title: e.title, theme: (legacy[e.id] || [''])[0], articles: (e.relatedArticles || []).map((a) => a && a.title).filter(Boolean), desc: e.description });
let cls = eps.map((e) => classify(inputOf(e), legacy[e.id]));
// 手がかり語で決まらない・確度が低い回は、高い確度の回から学んだ結びつきで補う（src=l、確度は低）
const bag = (e) => { const m = new Map(); const add = (a, w) => a.forEach((t) => { const k = termKey(t); m.set(k, (m.get(k) || 0) + w); }); add(extractTerms(e.title), 3); add(extractTerms((legacy[e.id] || [''])[0]), 2); add(extractTerms(stripBoilerplate(e.description)), 1); (e.relatedArticles || []).forEach((a) => a && add(extractTerms(a.title), 1)); return m; };
const bags = eps.map(bag);
const nbModel = trainNB(cls.map((c, i) => [c, i]).filter(([c]) => c.conf >= 2 && c.src !== 'a').map(([c, i]) => [bags[i], c.mi]), TAXONOMY.length);
cls = cls.map((c, i) => {
  if (c.conf >= 1) return c;
  const p = predictNB(nbModel, bags[i]);
  if (c.mi < 0 && p.margin >= 0.8) return { ...c, mi: p.c, si: -1, conf: 0, src: 'l', ev: [] };
  if (c.mi >= 0 && p.c !== c.mi && p.margin >= 0.95) return { ...c, mi: p.c, si: -1, conf: 0, src: 'l', ev: [] };
  return c;
});
cls = fillFromNeighbors(cls, rel);
// 検証: 人が承認した回で、旧分類を見ない判定（手がかり語だけ）が承認と一致するか
const approvedIdx = eps.map((e, i) => (legacy[e.id] && legacy[e.id][1] === 'user_approved' ? i : -1)).filter((i) => i >= 0);
let agree = 0, decided = 0;
for (const i of approvedIdx) { const blind = classify({ ...inputOf(eps[i]), theme: '' }, null); if (blind.mi >= 0) { decided++; if (blind.mi === cls[i].mi) agree++; } }
const clsStats = { approved: approvedIdx.length, blindDecided: decided, blindAgree: agree, byConf: {}, bySrc: {}, byMain: {} };
cls.forEach((c) => { clsStats.byConf[c.conf] = (clsStats.byConf[c.conf] || 0) + 1; clsStats.bySrc[c.src || '-'] = (clsStats.bySrc[c.src || '-'] || 0) + 1; const n = c.mi >= 0 ? TAXONOMY[c.mi].name : '未分類'; clsStats.byMain[n] = (clsStats.byMain[n] || 0) + 1; });
const FIELD_CODE = { title: 't', theme: 'm', article: 'r', desc: 'd' };
// ---- 7c. 地名（世界・日本の地図用）。題名・旧仮分類の主題文・関連記事の見出し・概要欄（案内文を除く）から
const geo = eps.map((e) => placesOfEpisode({ ...inputOf(e), desc: stripBoilerplate(e.description) }));
const geoStats = { any: geo.filter((g) => g.length).length, jp: geo.filter((g) => g.some(([id]) => PLACES[id].scope === 'jp')).length, world: geo.filter((g) => g.some(([id]) => PLACES[id].scope === 'world')).length };
const placeCount = new Map(); geo.forEach((g) => g.forEach(([id]) => placeCount.set(id, (placeCount.get(id) || 0) + 1)));
geoStats.top = [...placeCount].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, n]) => PLACES[id].name + n);

// ---- 8. 書き出し（数値は丸めて軽く）
const r1 = (x) => Math.round(x * 10) / 10;
const ymd = (d) => Number(String(d || '').slice(0, 10).replace(/-/g, '')) || 0;
const termOut = vocab.map((k, j) => {
  const p = tp.get(j);
  return [label(k), p ? r1(p[0]) : null, p ? r1(p[1]) : null, comm.has(j) ? comm.get(j) : -1, postings[j], isMap.has(j) ? nbr.get(j).slice(0, 8).map(([y, s]) => [y, Math.round(s * 100)]) : []];
});
// 星雲の名前: 題名によく出る語を優先（概要欄だけの一般語より、話題を表しやすい）
const nameScore = (j) => postings[j].length * ((titleDf.get(vocab[j]) || 0) / df.get(vocab[j]) + 0.15);
const core = {
  v: 1, generatedAt: new Date().toISOString(), libraryVersion: manifest.version, method: 'term-cooccurrence-v1',
  shows: showNames,
  comms: commTerms.map((ts, c) => ({ name: [...ts].sort((a, b) => nameScore(b) - nameScore(a)).slice(0, 3).map((j) => label(vocab[j])), x: r1(cp[c][0]), y: r1(cp[c][1]), r: r1(cr[c]), n: commSize[c] })),
  eps: eps.map((e, i) => [e.id, e.title, showNames.indexOf(e.show), ymd(e.date), epXY[i] ? r1(epXY[i][0]) : null, epXY[i] ? r1(epXY[i][1]) : null, epComm[i], e.duration || 0]),
  terms: termOut,
  persons: persons.map((p, k) => [p, personEps[k]]),
  cats: TAXONOMY.map((m) => ({ name: m.name, hue: m.hue, subs: m.subs.map(([n]) => n) })),
  cls: cls.map((c) => [c.mi, c.si, c.conf, c.src]),
  clsEv: cls.map((c, i) => [c.ev.map(([k, f]) => k + ':' + FIELD_CODE[f]).join('|'), (legacy[eps[i].id] || [''])[0]]),
  clsStats,
  places: PLACES.map((p) => [p.name, p.kind, p.scope, p.lat, p.lon, p.pref || p.iso || '']),
  geo: geo.map((g) => g.map(([id, sc, f, a]) => [id, sc, FIELD_CODE[f], a])),
  geoStats,
};
fs.mkdirSync(OUT, { recursive: true });
// 2段で読ませる: core（最初に見せる分。回・分類・星雲）→ extra（言葉・人物・地名・分類の根拠）と rel（関連回）は裏で
const FIRST = ['v', 'generatedAt', 'libraryVersion', 'method', 'shows', 'comms', 'eps', 'cats', 'cls', 'clsStats', 'geoStats'];
const first = Object.fromEntries(FIRST.map((k) => [k, core[k]]));
const extra = Object.fromEntries(Object.keys(core).filter((k) => !FIRST.includes(k)).map((k) => [k, core[k]]));
// 2回以上の回で紹介された記事（URL と回の番号だけ。見出しは蔵のデータからその場で読む）
const articles = [...articleEps].filter(([, l]) => l.length >= 2 && l.length <= 60).sort((a, b) => b[1].length - a[1].length).map(([u, l]) => [u, [...new Set(l)]]);
extra.articles = articles;
fs.writeFileSync(path.join(OUT, 'core.json'), JSON.stringify(first));
fs.writeFileSync(path.join(OUT, 'extra.json'), JSON.stringify(extra));
fs.writeFileSync(path.join(OUT, 'rel.json'), JSON.stringify({ v: 1, libraryVersion: manifest.version, rel }));
// 言葉から記事へ（#384）: 関連記事の見出しの索引。見出しは蔵で公開済みのもの。記事本文は扱わない。言葉を選んだときだけ読む
const artIdx = new Map();
eps.forEach((e, i) => (e.relatedArticles || []).forEach((a) => {
  const u = normalizeArticleUrl(a && a.url); if (!u) return;
  const r = artIdx.get(u) || artIdx.set(u, { url: a.url, title: '', eps: new Set() }).get(u);
  if (!r.title && a.title) r.title = String(a.title).trim(); r.eps.add(i);
}));
// 紹介した回の多い記事を先頭に並べ、32個の小さなファイルに分ける（選んだ言葉に必要な分だけ読む）
const arts = [...artIdx].filter(([, r]) => r.title).map(([u, r]) => ({ u, title: r.title, eps: [...r.eps] })).sort((a, b) => b.eps.length - a.eps.length || a.u.localeCompare(b.u));
const byTerm = {};
arts.forEach((a, k) => new Set(extractTerms(a.title).map(termKey)).forEach((key) => { const j = vIndex.get(key); if (j !== undefined) (byTerm[j] || (byTerm[j] = [])).push(k); }));
for (const j of Object.keys(byTerm)) byTerm[j] = byTerm[j].slice(0, 12);   // 先頭ほど紹介が多い（並べ替え済み）
const ART_SHARD = Math.ceil(arts.length / 32);
const ADIR = path.join(OUT, 'articles'); fs.rmSync(ADIR, { recursive: true, force: true }); fs.mkdirSync(ADIR, { recursive: true });
fs.writeFileSync(path.join(ADIR, 'index.json'), JSON.stringify({ v: 1, libraryVersion: manifest.version, note: '関連記事の見出しの索引（蔵で公開済みの見出し）。本文は含まない。URL は https:// + u', count: arts.length, shard: ART_SHARD, byTerm }));
for (let n = 0; n * ART_SHARD < arts.length; n++) fs.writeFileSync(path.join(ADIR, `s${n}.json`), JSON.stringify(arts.slice(n * ART_SHARD, (n + 1) * ART_SHARD).map((a) => [a.u, a.title, a.eps])));
// 読み込みの進み具合を正しく出すための、ファイルの大きさ（圧縮前）
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ libraryVersion: manifest.version, sizes: Object.fromEntries(['core', 'extra', 'rel'].map((f) => [f, fs.statSync(path.join(OUT, f + '.json')).size])) }));
const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + 'KB';
console.log(JSON.stringify({ episodes: N, vocab: vocab.length, mapTerms: mapTerms.length, nebulae: K, placed: epXY.filter(Boolean).length, persons: persons.length,
  withRel: rel.filter((r) => r[0].length).length, clsStats, geoStats, core: size('core.json'), extra: size('extra.json'), articlesIndex: size('articles/index.json'), articleShard: size('articles/s0.json'), rel: size('rel.json'), articles: articles.length, sec: (Date.now() - t0) / 1000,
  nebulaNames: core.comms.map((c) => c.name.join('・') + ' ' + c.n) }, null, 1));
