// 朝ポキの宇宙｜言葉の星図（アルテキスト計画・試験版）
// データ: ./data/core.json（星・言葉・星雲）と ./data/rel.json（関連する回と根拠）は scripts/uchu/build-uchu.mjs が蔵の公開データから作る。
// 回の本文・出演者・関連記事・再生先は、蔵の公開データ（../library/data/details/）をその場で読む（写しを増やさない）。
// 外部ライブラリなし。Canvas 2D と素の DOM だけ。
import { SHELF_KEY, readShelf, serializeShelf, toggleItem, platformLabel } from '../library/shelf-core.mjs';

const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'class') el.className = v; else el.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
};
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", "Noto Serif CJK JP", serif';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = (msg) => { $('live').textContent = msg; };
const fmtDate = (n) => { const s = String(n); return s.length === 8 ? `${s.slice(0, 4)}.${Number(s.slice(4, 6))}.${Number(s.slice(6))}` : ''; };
const fmtDur = (sec) => (sec ? `${Math.round(sec / 60)}分` : '');

// ---- 状態
let D, REL = null;               // core, rel
let px, py;                      // 今の表示の座標（世界座標）
let mapX, mapY, timeX, timeY, catX, catY, worldX, worldY, japanX, japanY;   // 表示ごとの座標
let mode = 'cat';
const view = { x: 0, y: 0, k: 1 };
let W = 0, H = 0, dpr = 1;
let hi = null;                   // 光らせる回の集合（Set）
let sel = null;                  // {type:'ep'|'word'|'person'|'neb', id}
let hoverEp = -1, labelRects = [];
let grid = new Map();             // 当たり判定用の格子
// 分類の配置: 大分類＝円の領域、小分類＝その中の円、回＝ひまわり配置（新しい回ほど中心）
function packCircles(items, gap) {   // items: [{r}] → x,y を詰めて置く（大きい順・らせん探索）
  const placed = [];
  for (const it of [...items].sort((a, b) => b.r - a.r)) {
    if (!placed.length) { it.x = 0; it.y = 0; placed.push(it); continue; }
    for (let t = 0; ; t += 0.35) { const rad = 4 * t, x = Math.cos(t) * rad, y = Math.sin(t) * rad; if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + it.r + gap)) { it.x = x; it.y = y; placed.push(it); break; } }
  }
  return items;
}
function buildCatLayout() {
  const S = 7, GA = Math.PI * (3 - Math.sqrt(5));
  const groups = Array.from({ length: HOLD + 1 }, (_, m) => ({ m, subs: new Map() }));
  D.eps.forEach((e, i) => { const g = groups[dispMain(i)], si = dispSub(i); (g.subs.get(si) || g.subs.set(si, []).get(si)).push(i); });
  const regions = groups.filter((g) => g.subs.size).map((g) => {
    const subs = [...g.subs].map(([si, ids]) => ({ si, ids: ids.sort((a, b) => D.eps[b][3] - D.eps[a][3]), r: S * Math.sqrt(ids.length) * 1.02 + 6 }));
    packCircles(subs, 6);
    const r = Math.max(...subs.map((q) => Math.hypot(q.x, q.y) + q.r)) + 14;
    return { m: g.m, subs, r, n: subs.reduce((a, q) => a + q.ids.length, 0) };
  });
  // 保留は中央に置かず、分類の外側（右）へ
  const main = regions.filter((rg) => rg.m !== HOLD), hold = regions.find((rg) => rg.m === HOLD);
  packCircles(main, 40);
  if (hold) { const maxX = Math.max(...main.map((rg) => rg.x + rg.r)); hold.x = maxX + hold.r + 120; hold.y = 0; }
  for (const rg of regions) for (const q of rg.subs) {
    q.x += rg.x; q.y += rg.y;
    q.ids.forEach((i, k) => { const rr = S * 0.95 * Math.sqrt(k + 0.5), a = k * GA; catX[i] = q.x + Math.cos(a) * rr; catY[i] = q.y + Math.sin(a) * rr; });
  }
  D._regions = regions;
}
let anim = null, queued = false;
const colors = [];
const canvas = $('sky'), ctx = canvas.getContext('2d');

// ---- 読み込み（2段）: まず core（回・分類）で画面を出し、言葉・地名・関連回は裏で読む。進み具合を棒で示す
const t0 = performance.now();
const MAN = await fetch('./data/manifest.json').then((r) => r.json()).catch(() => ({ sizes: {} }));
const SIZES = MAN.sizes || {}, TOTAL = Object.values(SIZES).reduce((a, b) => a + b, 0) || 1;
const loaded = {};
const mb = (n) => (n / 1048576).toFixed(1) + 'MB';
function showProgress() {
  const got = Object.values(loaded).reduce((a, b) => a + b, 0), pct = Math.min(100, Math.round((got / TOTAL) * 100));
  const coreDone = loaded.core >= (SIZES.core || Infinity) * 0.999;
  const box = $('loading');
  if (box) { const cp = Math.min(100, Math.round(((loaded.core || 0) / (SIZES.core || 1)) * 100)); box.querySelector('.bar i').style.width = cp + '%'; box.querySelector('.pct').textContent = `${cp}%（${mb(loaded.core || 0)} / ${mb(SIZES.core || 0)}）`; }
  const lb = $('loadbar'); if (lb && coreDone) { lb.hidden = pct >= 100; lb.querySelector('i').style.width = pct + '%'; lb.querySelector('span').textContent = `言葉・地図・関連回を読み込み中 ${pct}%（全体 ${mb(got)} / ${mb(TOTAL)}）`; }
}
async function loadJson(name) {
  const res = await fetch(`./data/${name}.json`);
  if (!res.ok) throw new Error(name + ' ' + res.status);
  if (!res.body || !res.body.getReader) { const t = await res.text(); loaded[name] = SIZES[name] || t.length; showProgress(); return JSON.parse(t); }
  const reader = res.body.getReader(), chunks = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; loaded[name] = n; showProgress(); }
  const buf = new Uint8Array(n); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  loaded[name] = SIZES[name] || n; showProgress();
  return JSON.parse(new TextDecoder().decode(buf));
}
D = await loadJson('core');
// 2段目が届くまでの空の入れ物
Object.assign(D, { terms: [], persons: [], places: [], geo: D.eps.map(() => []), clsEv: [], articles: [] });
const tLoad = performance.now() - t0;
const NE = D.eps.length, K = D.comms.length;
for (let c = 0; c < K; c++) colors.push(`hsl(${Math.round((c * 360) / K + 200) % 360} 72% 68%)`);
const colorOf = (c) => (c >= 0 ? colors[c] : '#7c869e');
// 分類（Claude 試作）。承認・旧仮分類の大分類・手がかり語で決まった回だけ分類に置き、推定だけの回は「保留」へ
const HOLD = D.cats.length;
const dispMain = (i) => { const c = D.cls[i]; return c[0] >= 0 && 'apd'.includes(c[3]) ? c[0] : HOLD; };
const dispSub = (i) => (dispMain(i) === HOLD ? -1 : D.cls[i][1]);
const catColor = (m) => (m === HOLD ? '#6f7894' : `hsl(${D.cats[m].hue} 70% 66%)`);
const catName = (m) => (m === HOLD ? '保留（推定のみ）' : D.cats[m].name);
const epColor = (i) => (mode === 'map' ? colorOf(D.eps[i][6]) : catColor(dispMain(i)));
const isGeo = () => mode === 'world' || mode === 'japan';
let termIdxByKey = new Map(), mapTermOrder = [], articleMap = new Map();
const epIdx = new Map(D.eps.map((e, i) => [e[0], i]));
// 地名（世界・日本の地図用）
let PL = [], placeEps = [];
const normUrl = (u) => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, ''); } catch { return ''; } };
// 2段目（言葉・人物・地名・分類の根拠・記事）が届いたら、それを使う仕組みを用意する
function initExtra() {
  termIdxByKey = new Map(D.terms.map((t, j) => [t[0].normalize('NFKC').toLowerCase(), j]));
  mapTermOrder = D.terms.map((t, j) => j).filter((j) => D.terms[j][1] !== null).sort((a, b) => D.terms[b][4].length - D.terms[a][4].length);
  PL = D.places.map(([name, kind, scope, lat, lon, extra]) => ({ name, kind, scope, lat, lon, extra }));
  placeEps = PL.map(() => []); D.geo.forEach((g, i) => g.forEach(([pid]) => placeEps[pid].push(i)));
  articleMap = new Map(D.articles.map(([u, ids]) => [u, ids]));
  buildGeoLayout();
}
// 都道府県を選んだら、その県の市町村・地域の回も含める
const prefIdx = new Map(PL.map((p, k) => [p.name, k]).filter(([, k]) => PL[k].kind === 'pref'));
const prefEps = (k) => { const s = new Set(placeEps[k]); PL.forEach((p, j) => { if (p.kind === 'jp' && p.extra === PL[k].name) placeEps[j].forEach((i) => s.add(i)); }); return [...s]; };
const JAPAN_PT = { lat: 36.2, lon: 138.25 };
buildLayouts();
let EXTRA = false;
const extraReady = loadJson('extra').then((x) => {
  Object.assign(D, x); initExtra(); EXTRA = true;
  if (sel && sel.type === 'ep') renderEp(sel.id);
  fromHash(); draw();
}).catch((e) => { live('言葉・地図のデータを読み込めませんでした'); console.error(e); });
loadJson('rel').then((r) => { REL = r.rel; if (sel && sel.type === 'ep') renderEp(sel.id); }).catch((e) => console.error(e));

// ---- 地図（世界・日本）
// 世界: Equal Earth 図法。日本: メルカトル（日本付近を拡大）。単位はどちらも星図と同じ「世界座標」
function projWorld(lon, lat) {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const l = (lon * Math.PI) / 180, p = (lat * Math.PI) / 180, t = Math.asin(M * Math.sin(p)), t2 = t * t, t6 = t2 * t2 * t2;
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x * 380, -y * 380];
}
function merc(lat) { return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)); }
function projJapan(lon, lat) { return [(lon - 137.5) * 62, -(merc(lat) - merc(36.5)) * (180 / Math.PI) * 62]; }   // 中心 東経137.5度・北緯36.5度
function buildGeoLayout() {
  worldX = new Float32Array(NE).fill(NaN); worldY = new Float32Array(NE).fill(NaN); japanX = new Float32Array(NE).fill(NaN); japanY = new Float32Array(NE).fill(NaN);
  const GA = Math.PI * (3 - Math.sqrt(5)), slotW = new Map(), slotJ = new Map();
  const put = (X, Y, slots, key, pt, proj, i, step) => { const k = slots.get(key) || 0; slots.set(key, k + 1); const [x, y] = proj(pt.lon, pt.lat), r = step * Math.sqrt(k + 0.5), a = k * GA; X[i] = x + Math.cos(a) * r; Y[i] = y + Math.sin(a) * r; };
  // 新しい回ほど地名の中心に来るよう、新しい順に置く
  const order = [...Array(NE).keys()].sort((a, b) => D.eps[b][3] - D.eps[a][3]);
  for (const i of order) {
    const g = D.geo[i]; if (!g.length) continue;
    const w = g.find(([pid]) => PL[pid].scope === 'world'), j = g.find(([pid]) => PL[pid].scope === 'jp');
    if (w) put(worldX, worldY, slotW, w[0], PL[w[0]], projWorld, i, 1.6); else if (j) put(worldX, worldY, slotW, 'JP', JAPAN_PT, projWorld, i, 1.6);
    if (j) put(japanX, japanY, slotJ, j[0], PL[j[0]], projJapan, i, 2.4);
  }
}
const shapes = {};
async function loadShapes(kind) {
  if (shapes[kind]) return shapes[kind];
  const data = await (await fetch(`./data/geo-${kind}.json`)).json(), proj = kind === 'world' ? projWorld : projJapan;
  const feats = data.features.map((f) => { const path = new Path2D(); for (const ring of f.p) { for (let n = 0; n < ring.length; n += 2) { const [x, y] = proj(ring[n], ring[n + 1]); n ? path.lineTo(x, y) : path.moveTo(x, y); } path.closePath(); } return { id: f.id, n: f.n, path }; });
  shapes[kind] = { feats, source: data.source }; return shapes[kind];
}
function buildLayouts() {
  mapX = new Float32Array(NE); mapY = new Float32Array(NE); timeX = new Float32Array(NE); timeY = new Float32Array(NE); catX = new Float32Array(NE); catY = new Float32Array(NE);
  buildCatLayout(); buildGeoLayout();
  // 時間の表示: 横＝配信日、縦＝星雲（星雲は平均の配信日が古い順に上から）
  const days = D.eps.map((e) => { const s = String(e[3]); return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) / 864e5; });
  const dMin = Math.min(...days.filter((d) => d > 0)), dMax = Math.max(...days);
  const mean = new Array(K).fill(0), cnt = new Array(K).fill(0);
  D.eps.forEach((e, i) => { if (e[6] >= 0) { mean[e[6]] += days[i]; cnt[e[6]]++; } });
  const rank = new Array(K); [...Array(K).keys()].sort((a, b) => mean[a] / (cnt[a] || 1) - mean[b] / (cnt[b] || 1)).forEach((c, r) => { rank[c] = r; });
  D._timeRank = rank; D._dMin = dMin; D._dMax = dMax;
  D.eps.forEach((e, i) => {
    mapX[i] = e[4] ?? NaN; mapY[i] = e[5] ?? NaN;
    const band = dispMain(i); let hsh = 0;   // 時間の表示の縦は大分類（20＋保留）
    for (const ch of e[0]) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
    timeX[i] = ((days[i] - dMin) / (dMax - dMin)) * 2400 - 1200; timeY[i] = band * 46 - ((HOLD + 1) * 46) / 2 + ((hsh >>> 0) % 1000) / 1000 * 30 - 15;
  });
  px = catX.slice(); py = catY.slice();
  buildGrid();
}
function buildGrid() {
  grid = new Map();
  for (let i = 0; i < NE; i++) { if (!Number.isFinite(px[i])) continue; const key = Math.floor(px[i] / 24) + ',' + Math.floor(py[i] / 24); (grid.get(key) || grid.set(key, []).get(key)).push(i); }
}

// ---- 表示の変換
const sx = (x) => (x - view.x) * view.k + W / 2, sy = (y) => (y - view.y) * view.k + H / 2;
const wx = (x) => (x - W / 2) / view.k + view.x, wy = (y) => (y - H / 2) / view.k + view.y;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); const r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
}
function fit() {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (let i = 0; i < NE; i++) if (Number.isFinite(px[i])) { a = Math.min(a, px[i]); b = Math.max(b, px[i]); c = Math.min(c, py[i]); d = Math.max(d, py[i]); }
  // 上の見出しと、スマホ縦の下の詳細シートに隠れない範囲に収める
  const top = document.querySelector('.top').offsetHeight + 4, bottom = window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches ? $('panel').offsetHeight : 0;
  const k = Math.min(W / ((b - a) * 1.12 + 60), (H - top - bottom) / ((d - c) * 1.06 + 60));   // 名前の文字がはみ出さない余白
  animateTo((a + b) / 2, (c + d) / 2 - (top - bottom) / 2 / k, k);
}
// スマホでは下の詳細シートに隠れないよう、見える部分の中央へ
function focusAt(x, y, k) { const off = phonePortrait.matches ? ($('panel').offsetHeight / 2) / k : 0; animateTo(x, y + off, k); }
function animateTo(x, y, k, ms = 450) {
  if (reduceMotion || !W) { view.x = x; view.y = y; view.k = k; draw(); return; }
  const from = { ...view }, start = performance.now(); cancelAnimationFrame(anim);
  const step = (t) => { const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3); view.x = from.x + (x - from.x) * e; view.y = from.y + (y - from.y) * e; view.k = from.k * Math.pow(k / from.k, e); draw(); if (p < 1) anim = requestAnimationFrame(step); };
  anim = requestAnimationFrame(step);
}
function draw() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }

// ---- 描画
function render() {
  ctx.clearRect(0, 0, W, H);
  const k = view.k;
  // 星雲の光（星図のとき）
  if (isGeo()) drawLand();
  if (mode === 'cat') drawRegions();
  else if (mode === 'map') {
    for (let c = 0; c < K; c++) {
      const cm = D.comms[c], x = sx(cm.x), y = sy(cm.y), r = cm.r * k * 1.5; if (x < -r || y < -r || x > W + r || y > H + r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, colorOf(c).replace('68%)', '68% / .16)')); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (mode === 'time') drawTimeAxis();
  // 星
  const base = Math.max(1, Math.min(3.2, 0.9 * Math.sqrt(k) + 0.4));
  const dim = hi && hi.size;
  for (let i = 0; i < NE; i++) {
    const x = sx(px[i]), y = sy(py[i]); if (!(x > -4 && y > -4 && x < W + 4 && y < H + 4)) continue;
    const on = !dim || hi.has(i); ctx.globalAlpha = on ? 0.9 : 0.12; ctx.fillStyle = epColor(i);
    ctx.fillRect(x - base / 2, y - base / 2, base, base);
  }
  ctx.globalAlpha = 1;
  if (dim) for (const i of hi) { const x = sx(px[i]), y = sy(py[i]); if (!Number.isFinite(x)) continue; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, base * 0.9 + 0.8, 0, Math.PI * 2); ctx.fill(); }
  // 選んだ回: 関連する回への線
  if (sel && sel.type === 'ep') {
    const i = sel.id, x0 = sx(px[i]), y0 = sy(py[i]);
    if (REL) for (const r of REL[i][0]) { const j = r[0]; if (!Number.isFinite(px[j])) continue; ctx.strokeStyle = r[3] ? '#f3d48fcc' : '#9fb4e0aa'; ctx.lineWidth = 1 + r[1] / 60; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sx(px[j]), sy(py[j])); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx(px[j]), sy(py[j]), 3, 0, Math.PI * 2); ctx.fill(); }
    if (Number.isFinite(x0)) { ctx.strokeStyle = '#f3c969'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0, y0, 9, 0, Math.PI * 2); ctx.stroke(); }
  }
  if (hoverEp >= 0) { const x = sx(px[hoverEp]), y = sy(py[hoverEp]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
  drawLabels();
}
// 陸地と、回の数による塗り（国・都道府県）
function drawLand() {
  const sh = shapes[mode]; if (!sh) return;
  const counts = new Map();
  if (mode === 'world') { PL.forEach((p, k) => { if (p.kind === 'country') counts.set(p.extra, (counts.get(p.extra) || 0) + placeEps[k].length); }); counts.set('JPN', D.geo.filter((g) => g.some(([pid]) => PL[pid].scope === 'jp')).length); }
  else PL.forEach((p, k) => { if (p.kind === 'pref') counts.set(p.name, prefEps(k).length); });
  const max = Math.max(1, ...counts.values());
  ctx.save(); ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * (W / 2 - view.x * view.k), dpr * (H / 2 - view.y * view.k));
  for (const f of sh.feats) {
    const n = counts.get(mode === 'world' ? f.id : f.n) || 0, t = n ? Math.sqrt(n / max) : 0;
    ctx.fillStyle = n ? `rgba(243, 201, 105, ${0.06 + t * 0.32})` : '#101a30'; ctx.fill(f.path);
    ctx.strokeStyle = '#2c3a5c'; ctx.lineWidth = 0.7 / view.k; ctx.stroke(f.path);
  }
  ctx.restore();
  ctx.font = '10px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = '#6f7a96'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(mode === 'world' ? '地図: Natural Earth（パブリックドメイン）を加工' : '出典: 地球地図日本（国土地理院）を加工', 10, H - 10);
}
function drawRegions() {
  for (const rg of D._regions) {
    const x = sx(rg.x), y = sy(rg.y), r = rg.r * view.k; if (x < -r || y < -r || x > W + r || y > H + r) continue;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.15); const col = rg.m === HOLD ? '120 128 150' : null;
    g.addColorStop(0, col ? `rgb(${col} / .10)` : `hsl(${D.cats[rg.m].hue} 70% 60% / .13)`); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill();
    if (view.k > 0.9) { ctx.strokeStyle = rg.m === HOLD ? '#ffffff14' : `hsl(${D.cats[rg.m].hue} 60% 60% / .22)`; ctx.lineWidth = 1; for (const q of rg.subs) { ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), q.r * view.k, 0, Math.PI * 2); ctx.stroke(); } }
  }
}
function drawTimeAxis() {
  ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = '#9aa6c2'; ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 1;
  for (let yr = 2020; yr <= 2027; yr++) {
    const d = Date.UTC(yr, 0, 1) / 864e5, x = sx(((d - D._dMin) / (D._dMax - D._dMin)) * 2400 - 1200); if (x < 0 || x > W) continue;
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x, H); ctx.stroke(); ctx.fillText(String(yr), x + 4, H - 10);
  }
}
function drawLabels() {
  labelRects = []; const k = view.k, occ = new Set(), cell = 22;
  const fam = getComputedStyle(document.body).fontFamily;
  const place = (x, y, w, hgt) => { const keys = []; for (let a = Math.floor((x - w / 2) / cell); a <= Math.floor((x + w / 2) / cell); a++) for (let b = Math.floor((y - hgt / 2) / cell); b <= Math.floor((y + hgt / 2) / cell); b++) keys.push(a + ',' + b); if (keys.some((q) => occ.has(q))) return false; keys.forEach((q) => occ.add(q)); return true; };
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (mode === 'time') {
    ctx.textAlign = 'left'; ctx.font = '600 13px ' + MINCHO;
    for (let m = 0; m <= HOLD; m++) { const y = sy(m * 46 - ((HOLD + 1) * 46) / 2); if (y < 70 || y > H - 20) continue; ctx.fillStyle = catColor(m); ctx.fillText(catName(m), 10, y); }
    return;
  }
  if (isGeo()) {
    const scope = mode === 'world' ? 'world' : 'jp', items = [];
    PL.forEach((p, k) => { if (p.scope !== scope && !(mode === 'world' && false)) return; const n = mode === 'japan' && p.kind === 'pref' ? prefEps(k).length : placeEps[k].length; if (n) items.push([k, n]); });
    if (mode === 'world') items.push(['JP', D.geo.filter((g) => g.some(([pid]) => PL[pid].scope === 'jp')).length]);
    items.sort((a, b) => b[1] - a[1]);
    for (const [k, n] of items) {
      const p = k === 'JP' ? { name: '日本', ...JAPAN_PT } : PL[k], [wx0, wy0] = (mode === 'world' ? projWorld : projJapan)(p.lon, p.lat), x = sx(wx0), y = sy(wy0);
      if (x < -40 || x > W + 40 || y < 50 || y > H + 20) continue;
      const r = 3 + Math.sqrt(n) * 1.5 * Math.min(1.6, Math.sqrt(view.k)), isSel = sel && sel.type === 'place' && sel.id === k;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = isSel ? '#f3c96955' : '#f3c96922'; ctx.fill(); ctx.strokeStyle = isSel ? '#f3c969' : '#f3c96988'; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
      const text = `${p.name} ${n}`; ctx.font = `600 ${n > 50 ? 14 : 12}px ${MINCHO}`; const w = ctx.measureText(text).width + 8;
      if (!place(x, y - r - 9, w, 16) && !isSel) continue;
      ctx.fillStyle = '#000c'; ctx.fillText(text, x + 1, y - r - 8); ctx.fillStyle = isSel ? '#f3c969' : '#f4ead2'; ctx.fillText(text, x, y - r - 9);
      labelRects.push([x - w / 2, y - r - 17, w, 16, 'place', k, -1]); labelRects.push([x - r, y - r, r * 2, r * 2, 'place', k, -1]);
    }
    return;
  }
  if (mode === 'cat') {
    const zoomed = view.k >= 1.1;
    for (const rg of D._regions) {
      const name = catName(rg.m), x = sx(rg.x), y = zoomed ? sy(rg.y - rg.r) - 10 : sy(rg.y);
      ctx.font = `600 ${zoomed ? 18 : 16}px ${MINCHO}`; const w = ctx.measureText(name).width + 10;
      if (x < -w || x > W + w || y < 60 || y > H) continue;
      if (!place(x, y, w, 22)) continue;
      ctx.fillStyle = '#000c'; ctx.fillText(name, x + 1, y + 1); ctx.fillStyle = catColor(rg.m); ctx.fillText(name, x, y); labelRects.push([x - w / 2, y - 11, w, 22, 'cat', rg.m, -1]);
      if (!zoomed) continue;
      for (const q of rg.subs) {
        const sn = q.si >= 0 ? D.cats[rg.m].subs[q.si] : (rg.m === HOLD ? '' : 'その他'); if (!sn) continue;
        const qx = sx(q.x), qy = sy(q.y); ctx.font = `600 13px ${MINCHO}`; const qw = ctx.measureText(sn).width + 8;
        if (qx < 0 || qx > W || qy < 60 || qy > H || !place(qx, qy, qw, 18)) continue;
        ctx.fillStyle = '#000c'; ctx.fillText(sn, qx + 1, qy + 1); ctx.fillStyle = '#eef1f8'; ctx.fillText(sn, qx, qy); labelRects.push([qx - qw / 2, qy - 9, qw, 18, 'cat', rg.m, q.si]);
      }
    }
    return;
  }
  // 選んだ言葉と、その近い言葉は必ず出す
  const must = new Set();
  if (sel && sel.type === 'word') { must.add(sel.id); for (const [y] of D.terms[sel.id][5]) must.add(y); }
  if (k < 0.75 && !must.size) {
    ctx.font = '600 16px ' + MINCHO;
    D.comms.forEach((cm, c) => { const x = sx(cm.x), y = sy(cm.y); const text = cm.name.slice(0, 2).join('・'); const w = ctx.measureText(text).width + 8; if (!place(x, y, w, 18)) return; ctx.fillStyle = '#000a'; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = colorOf(c); ctx.fillText(text, x, y); });
    return;
  }
  if (sel && sel.type === 'word') {
    const j0 = sel.id, x0 = sx(D.terms[j0][1]), y0 = sy(D.terms[j0][2]);
    ctx.strokeStyle = '#f3c96988'; ctx.lineWidth = 1;
    for (const [y] of D.terms[j0][5]) { if (D.terms[y][1] === null) continue; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sx(D.terms[y][1]), sy(D.terms[y][2])); ctx.stroke(); }
  }
  const max = Math.min(220, 40 + Math.round(k * 60));
  let shown = 0;
  const list = [...must, ...mapTermOrder];
  for (const j of list) {
    if (shown >= max && !must.has(j)) break;
    const t = D.terms[j]; if (t[1] === null) continue; const x = sx(t[1]), y = sy(t[2]); if (x < 0 || y < 60 || x > W || y > H) continue;
    const n = t[4].length, size = Math.max(10, Math.min(18, 9 + Math.log2(n) * 1.3)), isSel = sel && sel.type === 'word' && sel.id === j;
    ctx.font = isSel ? `700 ${size + 6}px ${MINCHO}` : `500 ${size}px ${fam}`; const w = ctx.measureText(t[0]).width + 6;
    if (!place(x, y, w, size + 4) && !isSel) continue;   // 選んだ言葉だけは必ず出す。近い言葉は重なれば省く
    ctx.fillStyle = '#000b'; ctx.fillText(t[0], x + 1, y + 1);
    ctx.fillStyle = isSel ? '#f3c969' : must.has(j) ? '#ffe7ad' : colorOf(t[3]).replace('68%)', '82%)');
    ctx.fillText(t[0], x, y); labelRects.push([x - w / 2, y - size / 2, w, size, 'word', j, -1]); shown++;
  }
  drawArticleSatellites();
}
// 言葉から記事へ（#384）: 選んだ言葉のまわりに、その言葉が見出しに入った記事を ◆ で置き、紹介した回の星へ線を引く
function drawArticleSatellites() {
  if (!sel || sel.type !== 'word' || !wordArts || wordArts.j !== sel.id || !wordArts.list.length) return;
  const t = D.terms[sel.id]; if (t[1] === null) return;
  const x0 = sx(t[1]), y0 = sy(t[2]), list = wordArts.list.slice(0, 8), R = Math.min(170, Math.max(120, Math.min(W, H) * 0.18));
  list.forEach((a, n) => {
    const ang = -Math.PI / 2 + (n / list.length) * Math.PI * 2, x = x0 + Math.cos(ang) * R, y = y0 + Math.sin(ang) * R;
    ctx.strokeStyle = '#7fd1c455'; ctx.lineWidth = 1;
    for (const i of a.eps) { if (!Number.isFinite(px[i])) continue; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(sx(px[i]), sy(py[i])); ctx.stroke(); }
    ctx.strokeStyle = '#7fd1c4aa'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    const r = 5 + Math.min(4, a.eps.length);
    ctx.fillStyle = '#7fd1c4'; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    const label = a.title.length > 13 ? a.title.slice(0, 12) + '…' : a.title;
    ctx.font = '500 11px ' + getComputedStyle(document.body).fontFamily; const w = ctx.measureText(label).width;
    ctx.fillStyle = '#0b1020e6'; ctx.fillRect(x - w / 2 - 4, y + r + 1, w + 8, 15); ctx.fillStyle = '#cdeee8'; ctx.fillText(label, x, y + r + 8.5);
    labelRects.push([x - Math.max(w / 2, r), y - r, Math.max(w, r * 2), r * 2 + 16, 'article', n, -1]);
  });
}

// ---- 当たり判定
function hitEp(cx, cy, r = 12) {
  const x = wx(cx), y = wy(cy), rr = r / view.k; let best = -1, bd = Infinity;
  for (let a = Math.floor((x - rr) / 24); a <= Math.floor((x + rr) / 24); a++) for (let b = Math.floor((y - rr) / 24); b <= Math.floor((y + rr) / 24); b++) for (const i of grid.get(a + ',' + b) || []) { const d = Math.hypot(px[i] - x, py[i] - y); if (d < rr && d < bd) { bd = d; best = i; } }
  return best;
}
const hitLabel = (cx, cy) => { for (let n = labelRects.length - 1; n >= 0; n--) { const r = labelRects[n]; if (cx >= r[0] && cx <= r[0] + r[2] && cy >= r[1] - 2 && cy <= r[1] + r[3] + 2) return r; } return null; };

// ---- 操作（マウス・タッチ・キーボード）
const pts = new Map(); let dragMoved = false, pinch0 = null;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); dragMoved = false; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; } canvas.classList.add('dragging'); });
canvas.addEventListener('pointermove', (e) => {
  const p = pts.get(e.pointerId);
  if (!p) { const i = hitEp(e.offsetX, e.offsetY); const lb = i < 0 ? hitLabel(e.offsetX, e.offsetY) : null; if (i !== hoverEp) { hoverEp = i; draw(); } showTip(e.offsetX, e.offsetY, i, lb && lb[4] === 'word' ? lb[5] : -1); canvas.style.cursor = i >= 0 || lb ? 'pointer' : ''; return; }
  if (pts.size === 2 && pinch0) { pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); const [a, b] = [...pts.values()]; view.k = Math.max(0.15, Math.min(40, pinch0.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); dragMoved = true; draw(); return; }
  const dx = e.offsetX - p.x, dy = e.offsetY - p.y; if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
  view.x -= dx / view.k; view.y -= dy / view.k; p.x = e.offsetX; p.y = e.offsetY; draw();
});
const up = (e) => {
  pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; canvas.classList.remove('dragging');
  if (!dragMoved && e.type === 'pointerup') { const lb = hitLabel(e.offsetX, e.offsetY); if (lb) return lb[4] === 'article' ? openWordArticle(wordArts.list[lb[5]]) : lb[4] === 'word' ? select({ type: 'word', id: lb[5] }) : lb[4] === 'place' ? select({ type: 'place', id: lb[5] }) : select({ type: 'cat', id: lb[5], sub: lb[6] }); const i = hitEp(e.offsetX, e.offsetY, e.pointerType === 'touch' ? 20 : 12); if (i >= 0) select({ type: 'ep', id: i }); }
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('pointerleave', () => { $('tip').hidden = true; if (hoverEp >= 0) { hoverEp = -1; draw(); } });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0015), bx = wx(e.offsetX), by = wy(e.offsetY); view.k = Math.max(0.15, Math.min(40, view.k * f)); view.x = bx - (e.offsetX - W / 2) / view.k; view.y = by - (e.offsetY - H / 2) / view.k; draw(); }, { passive: false });
canvas.addEventListener('keydown', (e) => {
  const step = 60 / view.k;
  const act = { ArrowLeft: () => (view.x -= step), ArrowRight: () => (view.x += step), ArrowUp: () => (view.y -= step), ArrowDown: () => (view.y += step), '+': () => (view.k *= 1.3), '=': () => (view.k *= 1.3), '-': () => (view.k /= 1.3),
    Enter: () => { const i = hitEp(W / 2, H / 2, 40); if (i >= 0) select({ type: 'ep', id: i }); } }[e.key];
  if (act) { e.preventDefault(); act(); draw(); }
});
function showTip(x, y, i, j) {
  const tip = $('tip'); if (i < 0 && j < 0) { tip.hidden = true; return; }
  tip.replaceChildren(i >= 0 ? h('div', {}, D.eps[i][1], h('small', {}, `${D.shows[D.eps[i][2]]}・${fmtDate(D.eps[i][3])}`)) : h('div', {}, D.terms[j][0], h('small', {}, `${D.terms[j][4].length}回`)));
  tip.hidden = false; tip.style.left = Math.min(x + 14, W - 300) + 'px'; tip.style.top = y + 14 + 'px';
}
$('zin').onclick = () => animateTo(view.x, view.y, view.k * 1.6, 250);
$('zout').onclick = () => animateTo(view.x, view.y, view.k / 1.6, 250);
$('zfit').onclick = () => fit();
document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
function setMode(m) {
  if (m === mode) return;
  hintsFor(m);
  if ((m === 'world' || m === 'japan') && !EXTRA) { live('地図のデータを読み込み中です。届いたら切り替えます'); extraReady.then(() => setMode(m)); return; }
  if ((m === 'world' || m === 'japan') && !shapes[m]) { loadShapes(m).then(() => { setMode(m); }); return; }
  mode = m; document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  const fx = px.slice(), fy = py.slice(), tx = { map: mapX, cat: catX, time: timeX, world: worldX, japan: japanX }[m], ty = { map: mapY, cat: catY, time: timeY, world: worldY, japan: japanY }[m], start = performance.now(), ms = reduceMotion ? 0 : 700;
  const step = (t) => { const p = ms ? Math.min(1, (t - start) / ms) : 1, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; for (let i = 0; i < NE; i++) { px[i] = fx[i] + (tx[i] - fx[i]) * e; py[i] = fy[i] + (ty[i] - fy[i]) * e; } render(); if (p < 1) requestAnimationFrame(step); else { buildGrid(); fit(); } };
  requestAnimationFrame(step); live({ map: '言葉の星座の表示に切り替えました', cat: '分類の表示に切り替えました', time: '時間の表示に切り替えました。横が配信日、縦が大分類です', world: `世界地図の表示に切り替えました。地名のある${worldX.filter((v) => !Number.isNaN(v)).length}回を置いています`, japan: `日本地図の表示に切り替えました。日本の地名のある${japanX.filter((v) => !Number.isNaN(v)).length}回を置いています` }[m]);
}

// ---- 選択と詳細
function select(s, { fly = true, push = true } = {}) {
  sel = s; hoverEp = -1; openDetail();
  if (s.type === 'ep') { hi = null; renderEp(s.id); if (fly && Number.isFinite(px[s.id])) focusAt(px[s.id], py[s.id], Math.max(view.k, 2.2)); }
  if (s.type === 'word') { hi = new Set(D.terms[s.id][4]); renderWord(s.id); const t = D.terms[s.id]; if (fly && t[1] !== null && mode === 'map') focusAt(t[1], t[2], Math.max(view.k, 1.6)); }
  if (s.type === 'person') { hi = new Set(D.persons[s.id][1]); renderPerson(s.id); }
  if (s.type === 'article') { hi = new Set(s.eps || articleMap.get(s.url) || []); renderArticle(s); }
  if (s.type === 'place') { const ids = s.id === 'JP' ? D.eps.map((e, i) => i).filter((i) => D.geo[i].some(([pid]) => PL[pid].scope === 'jp')) : PL[s.id].kind === 'pref' ? prefEps(s.id) : placeEps[s.id]; hi = new Set(ids); renderPlace(s.id, ids); if (s.id === 'JP' && mode === 'world') { /* 日本は日本地図で */ } else if (fly && isGeo()) { const p = PL[s.id], [x, y] = (mode === 'world' ? projWorld : projJapan)(p.lon, p.lat); if (Number.isFinite(x)) focusAt(x, y, Math.max(view.k, mode === 'world' ? 2.5 : 3)); } }
  if (s.type === 'cat') { hi = new Set(); D.eps.forEach((e, i) => { if (dispMain(i) === s.id && (s.sub == null || s.sub < 0 || dispSub(i) === s.sub)) hi.add(i); }); renderCat(s.id, s.sub); const rg = D._regions.find((r) => r.m === s.id); if (fly && rg && mode === 'cat') { const q = s.sub >= 0 ? rg.subs.find((x) => x.si === s.sub) : null; const tgt = q || rg; focusAt(tgt.x, tgt.y, Math.min(W, H) / (tgt.r * 2.6)); } }
  if (s.type === 'neb') { hi = new Set(); D.eps.forEach((e, i) => { if (e[6] === s.id) hi.add(i); }); renderNebula(s.id); const cm = D.comms[s.id]; if (fly && mode === 'map') focusAt(cm.x, cm.y, Math.min(W, H) / (cm.r * 3.2)); }
  document.querySelectorAll('#nebulae button').forEach((b) => b.setAttribute('aria-pressed', String(s.type === 'neb' && +b.dataset.c === s.id)));
  document.querySelectorAll('#cats button').forEach((b) => b.setAttribute('aria-pressed', String(s.type === 'cat' && +b.dataset.m === s.id && (b.dataset.s == null ? !(s.sub >= 0) : +b.dataset.s === s.sub))));
  if (push && s.type !== 'article') { const hash = s.type === 'ep' ? 'e=' + D.eps[s.id][0] : s.type === 'word' ? 'w=' + encodeURIComponent(D.terms[s.id][0]) : s.type === 'person' ? 'p=' + encodeURIComponent(D.persons[s.id][0]) : s.type === 'cat' ? 'c=' + s.id + (s.sub >= 0 ? '.' + s.sub : '') : s.type === 'place' ? 'pl=' + s.id : 'n=' + s.id; history.replaceState(null, '', '#' + hash); }
  draw();
}
const panel = () => $('detail');
const epButton = (i, extra) => h('button', { type: 'button', class: 'title', onclick: () => select({ type: 'ep', id: i }) }, D.eps[i][1], extra);
function epList(ids, limit = 60) {
  const sorted = [...ids].sort((a, b) => D.eps[b][3] - D.eps[a][3]);
  const ul = h('ul', { class: 'eplist' }, sorted.slice(0, limit).map((i) => h('li', {}, h('button', { type: 'button', onclick: () => select({ type: 'ep', id: i }) }, h('small', {}, fmtDate(D.eps[i][3])), D.eps[i][1]))));
  return [ul, sorted.length > limit ? h('p', { class: 'note' }, `新しい順に${limit}回まで表示（全${sorted.length}回）`) : null];
}
// 時間の変化（四半期ごとの回数）。SVG の各棒に件数の説明をつける
function histogram(ids) {
  const q0 = 2020 * 4, q1 = new Date().getFullYear() * 4 + 3, cnt = new Array(q1 - q0 + 1).fill(0);
  for (const i of ids) { const s = String(D.eps[i][3]); const q = +s.slice(0, 4) * 4 + Math.floor((+s.slice(4, 6) - 1) / 3) - q0; if (q >= 0 && q < cnt.length) cnt[q]++; }
  const max = Math.max(1, ...cnt), bw = 320 / cnt.length, ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 320 90'); svg.setAttribute('class', 'hist'); svg.setAttribute('role', 'img');
  const peak = cnt.indexOf(max); svg.setAttribute('aria-label', `四半期ごとの回数。最も多いのは${Math.floor((peak + q0) / 4)}年第${((peak + q0) % 4) + 1}四半期の${max}回`);
  cnt.forEach((n, q) => { const r = document.createElementNS(ns, 'rect'), hh = (n / max) * 66; r.setAttribute('x', q * bw + 0.5); r.setAttribute('y', 72 - hh); r.setAttribute('width', Math.max(1, bw - 1.5)); r.setAttribute('height', hh); r.setAttribute('fill', n ? '#f3c969' : '#1f2a44'); r.setAttribute('rx', 1); const t = document.createElementNS(ns, 'title'); t.textContent = `${Math.floor((q + q0) / 4)}年 第${((q + q0) % 4) + 1}四半期: ${n}回`; r.append(t); svg.append(r); });
  for (let y = 2020; y * 4 <= q1; y++) { const t = document.createElementNS(ns, 'text'); t.setAttribute('x', (y * 4 - q0) * bw + 1); t.setAttribute('y', 86); t.setAttribute('fill', '#9aa6c2'); t.setAttribute('font-size', '9'); t.textContent = String(y); svg.append(t); }
  return svg;
}
function showMix(ids) { const c = new Map(); for (const i of ids) c.set(D.eps[i][2], (c.get(D.eps[i][2]) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${D.shows[s]} ${n}`).join('・'); }
function renderWord(j) {
  const t = D.terms[j], ids = t[4];
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, '言葉'), h('h3', { class: 'hero' }, t[0]), h('p', { class: 'meta' }, h('span', {}, `${ids.length}回で主な言葉`), t[3] >= 0 ? h('span', {}, `星雲「${D.comms[t[3]].name.slice(0, 2).join('・')}」`) : null),
    h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    t[5].length ? h('div', { class: 'sec' }, h('h4', {}, 'いっしょに語られる言葉'), t[5].map(([y, s]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: y }) }, D.terms[y][0], h('small', {}, `${s}`))), h('p', { class: 'note' }, '数字は「同じ回に出る割合」（0〜100）。意味の近さではなく、共起の強さです。')) : null,
    wordArticlesSection(j),
    h('div', { class: 'sec' }, h('h4', {}, 'この言葉の回'), epList(ids))));
  live(`言葉「${t[0]}」。${ids.length}回が光っています`);
}
// ---- 言葉から記事へ（#384）。索引は言葉を初めて選んだときに読み、記事の見出しは必要な分のファイルだけ読む
let artIndexP = null, wordArts = null; const artShardP = new Map();
const loadArtIndex = () => artIndexP || (artIndexP = fetch('./data/articles/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));
const loadArtShard = (n) => artShardP.get(n) || artShardP.set(n, fetch(`./data/articles/s${n}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => [])).get(n);
async function articlesOfWord(j) {
  const ix = await loadArtIndex(); if (!ix) return null;
  return Promise.all((ix.byTerm[j] || []).map(async (k) => { const row = (await loadArtShard(Math.floor(k / ix.shard)))[k % ix.shard]; return row ? { u: row[0], title: row[1], eps: row[2] } : null; })).then((a) => a.filter(Boolean));
}
// 見出しの中の言葉に印をつける（大文字小文字・全角半角の違いは同じとみなす）
function markTerm(title, term) {
  const t = String(title).normalize('NFKC'), q = String(term).normalize('NFKC').toLowerCase(), low = t.toLowerCase(), out = []; let p = 0;
  if (!q) return [t];
  for (let n = low.indexOf(q); n >= 0; n = low.indexOf(q, n + q.length)) { if (n > p) out.push(t.slice(p, n)); out.push(h('mark', {}, t.slice(n, n + q.length))); p = n + q.length; }
  if (p < t.length) out.push(t.slice(p));
  return out;
}
const openWordArticle = (a) => a && select({ type: 'article', url: a.u, title: a.title, href: 'https://' + a.u, eps: a.eps, fromWord: sel && sel.type === 'word' ? sel.id : null });
function wordArticlesSection(j) {
  const box = h('div', { class: 'sec' }, h('h4', {}, 'この言葉が見出しに入った記事'), h('p', { class: 'note' }, '関連記事の見出しを読み込み中…'));
  articlesOfWord(j).then((list) => {
    if (!sel || sel.type !== 'word' || sel.id !== j) return;
    wordArts = { j, list: list || [] };
    if (!list) { box.lastChild.textContent = '記事の索引を読み込めませんでした。'; return; }
    if (!list.length) { box.lastChild.textContent = 'この言葉が見出しに入った関連記事はありません。'; return; }
    box.replaceChildren(h('h4', {}, 'この言葉が見出しに入った記事'),
      h('ul', { class: 'eplist artlist' }, list.map((a) => h('li', {}, h('button', { type: 'button', onclick: () => openWordArticle(a) }, h('small', {}, `紹介した回 ${a.eps.length}`), markTerm(a.title, D.terms[j][0]))))),
      h('p', { class: 'note' }, `関連記事の見出し（蔵で公開済み）にこの言葉が入っているもの。紹介した回の多い順に${list.length}本まで。${mode === 'map' ? '星図では ◆ で、紹介した回の星と線で結んでいます。' : '「言葉」の表示では ◆ で星図に置かれます。'}`));
    draw();
  });
  return box;
}
function renderPerson(k) {
  const [name, ids] = D.persons[k];
  panel().replaceChildren(h('div', {}, h('p', { class: 'kind' }, '人物（出演者欄から）'), h('h3', { class: 'hero' }, name), h('p', { class: 'meta' }, `${ids.length}回`), h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)), h('div', { class: 'sec' }, h('h4', {}, '出演した回'), epList(ids)),
    h('p', { class: 'note' }, '同じ名前の別の人を区別できていない場合があります。')));
  live(`人物「${name}」。${ids.length}回が光っています`);
}
function renderNebula(c) {
  const cm = D.comms[c], ids = [...hi], words = D.terms.map((t, j) => j).filter((j) => D.terms[j][3] === c && D.terms[j][1] !== null).sort((a, b) => D.terms[b][4].length - D.terms[a][4].length).slice(0, 24);
  panel().replaceChildren(h('div', {}, h('p', { class: 'kind' }, '星雲（自動でまとめた言葉の集まり・仮の名前）'), h('h3', {}, cm.name.join('・')), h('p', { class: 'meta' }, `${cm.n}回`), h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    h('div', { class: 'sec' }, h('h4', {}, 'この星雲の言葉'), words.map((j) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: j }) }, D.terms[j][0], h('small', {}, D.terms[j][4].length)))),
    h('div', { class: 'sec' }, h('h4', {}, '回'), epList(ids, 40))));
  live(`星雲「${cm.name.join('・')}」。${cm.n}回`);
}
const CONF = { 3: ['c3', '人が承認'], 2: ['c2', 'Claude試作・確度 高'], 1: ['c1', 'Claude試作・確度 中'], 0: ['c0', 'Claude試作・確度 低'] };
const FIELD = { t: '題名', m: '旧仮分類の主題', r: '関連記事の見出し', d: '概要欄' };
function catSection(i) {
  const [mi, si, conf, src] = D.cls[i], [ev, old] = D.clsEv[i] || ['', ''], shown = dispMain(i);
  const guess = shown === HOLD && mi >= 0 ? h('p', { class: 'evid' }, `Claudeの推定: ${D.cats[mi].name}（${src === 'l' ? '似た回の言葉から学んだ推定' : '関連する回の分類から'}・要確認）`) : null;
  return h('div', { class: 'sec' }, h('h4', {}, '分類'),
    shown === HOLD ? h('p', {}, h('span', { class: 'badge cl' }, '保留'), h('span', { class: 'note' }, '手がかりが弱いため分類に置いていません')) :
      h('p', {}, h('span', { class: 'badge ' + CONF[conf][0] }, CONF[conf][1]), h('button', { type: 'button', class: 'chip catpath', onclick: () => select({ type: 'cat', id: shown, sub: si }) }, catName(shown) + (si >= 0 ? ' › ' + D.cats[shown].subs[si] : ''))),
    guess,
    ev ? h('p', { class: 'evid' }, '根拠: ', ev.split('|').map((x) => { const [k, f] = x.split(':'); return `「${k}」（${FIELD[f] || f}）`; }).join(' ')) : null,
    src === 'a' ? h('p', { class: 'evid' }, '大分類は人の承認に従っています（小分類は Claude の対応づけ）') : src === 'p' ? h('p', { class: 'evid' }, '大分類は旧仮分類（' + old + '）に従い、手がかり語で確認しています') : null,
    old && src !== 'p' && src !== 'a' ? h('p', { class: 'evid' }, '旧仮分類の主題: ' + old) : null);
}
function renderCat(m, sub) {
  const ids = [...hi], cnt = { 3: 0, 2: 0, 1: 0, 0: 0 }; ids.forEach((i) => { cnt[D.cls[i][2]] = (cnt[D.cls[i][2]] || 0) + 1; });
  const subCounts = m === HOLD ? [] : D.cats[m].subs.map((n, si) => [si, n, ids.length && !(sub >= 0) ? D.eps.reduce((a, e, i) => a + (dispMain(i) === m && dispSub(i) === si ? 1 : 0), 0) : 0]);
  const tot = ids.length || 1, seg = (c, col) => h('span', { style: `width:${(cnt[c] / tot) * 100}%;background:${col}` });
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, sub >= 0 ? '小分類' : m === HOLD ? '保留' : '大分類'),
    h('h3', { class: 'hero' }, sub >= 0 ? D.cats[m].subs[sub] : catName(m)),
    sub >= 0 ? h('p', { class: 'meta' }, h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m }) }, '← ' + catName(m))) : null,
    h('p', { class: 'meta' }, h('span', {}, `${ids.length}回`), m !== HOLD ? h('span', {}, `承認 ${cnt[3]}・高 ${cnt[2]}・中 ${cnt[1]}・低 ${cnt[0]}`) : null),
    m !== HOLD ? h('div', { class: 'bars', 'aria-hidden': 'true' }, seg(3, '#5fbf7a'), seg(2, '#5b8fd6'), seg(1, '#d6b44f'), seg(0, '#c46a72')) : null,
    h('p', { class: 'note' }, m === HOLD ? 'Claude が推定はしたものの、根拠が弱いため分類に置いていない回です。人の確認で振り分ける候補です。' : '分類は Claude の試作（人の承認前）です。確度の低い回は誤りを含みます。'),
    h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    subCounts.length ? h('div', { class: 'sec' }, h('h4', {}, '小分類'), subCounts.filter((x) => x[2]).map(([si, n, c]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m, sub: si }) }, n, h('small', {}, c)))) : null,
    h('div', { class: 'sec' }, h('h4', {}, '回'), epList(ids, 60))));
  live(`${sub >= 0 ? D.cats[m].subs[sub] : catName(m)}。${ids.length}回`);
}
let epTerms = null;   // 回→言葉（場所の「よく出る言葉」用。必要になったら作る）
function topWordsOf(ids, n = 14) {
  if (!epTerms) { epTerms = Array.from({ length: NE }, () => []); D.terms.forEach((t, j) => t[4].forEach((i) => epTerms[i].push(j))); }
  const c = new Map(); ids.forEach((i) => epTerms[i].forEach((j) => c.set(j, (c.get(j) || 0) + 1)));
  // 回数×めずらしさ（どこにでも出る言葉より、その場所らしい言葉を上に）
  return [...c].filter(([, k]) => k >= 2).sort((a, b) => b[1] * Math.log(NE / D.terms[b[0]][4].length) - a[1] * Math.log(NE / D.terms[a[0]][4].length)).slice(0, n);
}
const KIND = { pref: '都道府県', jp: '日本の地名', country: '国・地域' };
function renderPlace(k, ids) {
  const p = k === 'JP' ? { name: '日本（日本の地名がある回）', kind: 'country' } : PL[k];
  const cat = new Map(); ids.forEach((i) => { const m = dispMain(i); if (m < HOLD) cat.set(m, (cat.get(m) || 0) + 1); });
  const co = new Map(); ids.forEach((i) => D.geo[i].forEach(([pid]) => { if (pid !== k && !(PL[k] && PL[k].kind === 'pref' && PL[pid].extra === PL[k].name)) co.set(pid, (co.get(pid) || 0) + 1); }));
  const subPlaces = PL[k] && PL[k].kind === 'pref' ? PL.map((q, j) => [j, q]).filter(([j, q]) => q.kind === 'jp' && q.extra === PL[k].name && placeEps[j].length) : [];
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, KIND[p.kind] || '場所'), h('h3', { class: 'hero' }, p.name), h('p', { class: 'meta' }, h('span', {}, `${ids.length}回`), PL[k] && PL[k].kind === 'jp' ? h('span', {}, PL[k].extra) : null),
    h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    cat.size ? h('div', { class: 'sec' }, h('h4', {}, '分野（Claude試作の分類）'), [...cat].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m, n]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m }) }, h('span', { style: `color:${catColor(m)}` }, '●'), D.cats[m].name, h('small', {}, n)))) : null,
    h('div', { class: 'sec' }, h('h4', {}, 'この場所でよく出る言葉'), topWordsOf(ids).map(([j, n]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: j }) }, D.terms[j][0], h('small', {}, n)))),
    subPlaces.length ? h('div', { class: 'sec' }, h('h4', {}, '県内の地名'), subPlaces.map(([j, q]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'place', id: j }) }, q.name, h('small', {}, placeEps[j].length)))) : null,
    co.size ? h('div', { class: 'sec' }, h('h4', {}, '一緒に語られる場所'), [...co].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([j, n]) => h('button', { type: 'button', class: 'chip', onclick: () => { if (PL[j].scope === 'jp' && mode === 'world') setMode('japan'); if (PL[j].scope === 'world' && mode === 'japan') setMode('world'); select({ type: 'place', id: j }); } }, PL[j].name, h('small', {}, n)))) : null,
    h('div', { class: 'sec' }, h('h4', {}, '回'), epList(ids, 60)),
    h('p', { class: 'note' }, '地名は題名・概要欄・関連記事の見出しなどから辞書で取り出した試作です。人名や比喩と紛れるものは除くようにしていますが、誤りを含みます。')));
  live(`${p.name}。${ids.length}回`);
}
function renderArticle(s) {
  const ids = [...hi];
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, '関連記事'), h('h3', {}, s.title || s.url),
    h('p', { class: 'meta' }, h('span', {}, `${ids.length}回で紹介`), h('a', { href: s.href || 'https://' + s.url, target: '_blank', rel: 'noopener' }, '記事を読む ↗')),
    h('p', { class: 'note' }, showMix(ids)),
    h('div', { class: 'sec' }, h('h4', {}, 'この記事を紹介した回'), epList(ids, 60)),
    h('p', { class: 'note' }, '同じ記事を紹介した回どうしは、星図でも「同じ記事」の根拠でつながっています。'),
    s.fromWord != null ? h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: s.fromWord }) }, `← 言葉「${D.terms[s.fromWord][0]}」へ戻る`) : null,
    h('button', { type: 'button', class: 'chip', onclick: renderArticleList }, '📰 多くの回で紹介された記事の一覧へ')));
  live(`記事「${s.title || ''}」。${ids.length}回で紹介`);
}
// 多くの回で紹介された記事（上位30本）。見出しは蔵のデータからその場で読む
async function renderArticleList() {
  if (!EXTRA) { live('記事のデータを読み込み中です'); await extraReady; }
  const top = D.articles.slice(0, 30), ul = h('ul', { class: 'eplist' });
  panel().replaceChildren(h('div', {}, h('p', { class: 'kind' }, '関連記事'), h('h3', {}, '多くの回で紹介された記事'),
    h('p', { class: 'note' }, `2回以上の回で紹介された記事は ${D.articles.length.toLocaleString()} 本。紹介した回の多い順に30本。`), ul));
  openDetail();
  for (const [u, ids] of top) {
    const li = h('li', {}, h('button', { type: 'button' }, h('small', {}, `${ids.length}回`), '…')); ul.append(li);
    loadDetail(D.eps[ids[0]][0]).then((d) => {
      const a = ((d && d.relatedArticles) || []).find((x) => normUrl(x.url) === u) || {};
      li.replaceChildren(h('button', { type: 'button', onclick: () => select({ type: 'article', url: u, title: a.title, href: a.url }) }, h('small', {}, `${ids.length}回で紹介`), a.title || u));
    });
  }
}
function placeSection(i) {
  const g = D.geo[i]; if (!g.length) return null;
  return h('div', { class: 'sec' }, h('h4', {}, '場所'), g.map(([pid, , f, a]) => h('button', { type: 'button', class: 'chip', title: `「${a}」（${FIELD[f] || f}）`, onclick: () => { setMode(PL[pid].scope === 'jp' ? 'japan' : 'world'); select({ type: 'place', id: pid }); } }, PL[pid].name, h('small', {}, FIELD[f] || ''))));
}
const detailCache = new Map();
async function loadDetail(id) {
  const b = Math.floor(Number(id.slice(3)) / 50);
  if (!detailCache.has(b)) detailCache.set(b, fetch(`../library/data/details/${b}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => []));
  return (await detailCache.get(b)).find((e) => e.id === id) || null;
}
function shelfHas(id) { try { return readShelf(localStorage.getItem(SHELF_KEY)).ids.includes(id); } catch { return false; } }
function shelfToggle(id) { try { const s = toggleItem(readShelf(localStorage.getItem(SHELF_KEY)), id); localStorage.setItem(SHELF_KEY, serializeShelf(s)); return s.ids.includes(id); } catch { return null; } }
async function renderEp(i) {
  const e = D.eps[i], id = e[0];
  const relBox = h('div', { class: 'sec' }, h('h4', {}, '関連する回（根拠つき）'), REL ? relList(i) : h('p', { class: 'note' }, '読み込み中…'));
  const descBox = h('div', {}, h('p', { class: 'note' }, '概要欄を読み込み中…'));
  const shelfBtn = h('button', { type: 'button', class: 'btn' }, shelfHas(id) ? '✓ 蔵書にあります' : '＋ 蔵書に入れる');
  shelfBtn.onclick = () => { const on = shelfToggle(id); if (on === null) { shelfBtn.textContent = 'この端末では保存できません'; return; } shelfBtn.textContent = on ? '✓ 蔵書にあります' : '＋ 蔵書に入れる'; live(on ? '蔵書に入れました' : '蔵書から外しました'); };
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, D.shows[e[2]]),
    h('h3', {}, e[1]),
    h('p', { class: 'meta' }, h('span', {}, fmtDate(e[3])), h('span', {}, fmtDur(e[7]))),
    h('div', { class: 'btns' }, h('a', { class: 'btn primary', href: `../library/?ep=${id}` }, '蔵で詳しく見る'), shelfBtn),
    catSection(i), placeSection(i), descBox, relBox,
    e[6] >= 0 ? h('div', { class: 'sec' }, h('h4', {}, '星雲'), h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'neb', id: e[6] }) }, h('span', { style: `color:${colorOf(e[6])}` }, '●'), D.comms[e[6]].name.slice(0, 2).join('・'))) : h('p', { class: 'note' }, 'この回は共通の言葉が少ないため、星図には置いていません。')));
  live(`回「${e[1]}」`);
  const d = await loadDetail(id); if (!sel || sel.type !== 'ep' || sel.id !== i) return;
  if (!d) { descBox.replaceChildren(h('p', { class: 'note' }, '詳細を読み込めませんでした。蔵で見てください。')); return; }
  const pl = (d.links || []).map((u) => [platformLabel(u) || '', u]).filter(([l]) => l && !/朝日新聞/.test(l));
  const words = (() => { const s = new Set(); D.terms.forEach((t, j) => { if (t[4].includes(i)) s.add(j); }); return [...s].sort((a, b) => D.terms[a][4].length - D.terms[b][4].length).slice(0, 10); })();
  descBox.replaceChildren(
    d.description ? h('p', { class: 'desc' }, d.description) : null,
    d.cast ? h('p', { class: 'meta' }, '出演: ', d.cast) : null,
    pl.length ? h('div', { class: 'sec links' }, h('h4', {}, '聴く'), pl.map(([l, u]) => h('a', { href: u, target: '_blank', rel: 'noopener' }, l + ' ↗'))) : null,
    words.length ? h('div', { class: 'sec' }, h('h4', {}, 'この回の言葉'), words.map((j) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: j }) }, D.terms[j][0]))) : null,
    (d.relatedArticles || []).length ? h('div', { class: 'sec links' }, h('h4', {}, `関連記事（${d.relatedArticles.length}本・朝日新聞デジタル）`),
      h('ul', { class: 'eplist' }, d.relatedArticles.map((a) => { const ids = articleMap.get(normUrl(a.url)) || []; return h('li', {}, h('a', { href: a.url, target: '_blank', rel: 'noopener' }, (a.title || a.url) + ' ↗'), ids.length >= 2 ? h('button', { type: 'button', class: 'chip artcount', onclick: () => select({ type: 'article', url: normUrl(a.url), title: a.title, href: a.url }) }, `この記事を紹介した回 ${ids.length}`) : null); })),
      h('p', { class: 'note' }, '見出しの言葉も星図の言葉に入っています。')) : null);
}
function relList(i) {
  const [out, same] = REL[i];
  if (!out.length && !same) return h('p', { class: 'note' }, '根拠のある関連回は見つかりませんでした。');
  return [h('ul', { class: 'rel' }, out.map(([j, s, ts, a, ps]) => h('li', {}, epButton(j), h('div', { class: 'why' },
    a ? h('span', { class: 'a' }, `同じ記事 ${a}件`) : null, ps.filter((k) => D.persons[k]).map((k) => h('span', { class: 'p' }, `同じ出演者: ${D.persons[k][0]}`)), ts.some((t) => D.terms[t]) ? h('span', {}, '共通の言葉: ' + ts.filter((t) => D.terms[t]).map((t) => D.terms[t][0]).join('・')) : null,
    h('span', {}, `${D.shows[D.eps[j][2]]} ${fmtDate(D.eps[j][3])}`))))),
    same ? h('p', { class: 'note' }, '同じ題名の回（再配信など）: ', same.map((j) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'ep', id: j }) }, fmtDate(D.eps[j][3])))) : null,
    h('p', { class: 'note' }, '根拠は「同じ記事URL」「同じ出演者」「共通の言葉（共起）」の3つだけです。')];
}

// ---- 分類の木（20大分類＋保留）
const catCount = new Array(HOLD + 1).fill(0), subCount = D.cats.map((c) => new Array(c.subs.length).fill(0));
D.eps.forEach((e, i) => { const m = dispMain(i); catCount[m]++; const si = dispSub(i); if (m < HOLD && si >= 0) subCount[m][si]++; });
$('cats').replaceChildren(...[...Array(HOLD + 1).keys()].map((m) => {
  const subs = m < HOLD ? D.cats[m].subs.map((n, si) => [si, n, subCount[m][si]]).filter((x) => x[2]) : [];
  const ul = subs.length ? h('ul', { hidden: true }, subs.map(([si, n, c]) => h('li', {}, h('button', { type: 'button', 'data-m': m, 'data-s': si, onclick: () => select({ type: 'cat', id: m, sub: si }) }, n, h('span', { class: 'cnt' }, c))))) : null;
  const tw = h('span', { class: 'tw', 'aria-hidden': 'true' }, subs.length ? '▸' : '');
  const btn = h('button', { type: 'button', 'data-m': m, 'aria-expanded': subs.length ? 'false' : null, onclick: () => { if (ul) { const open = ul.hidden; ul.hidden = !open; btn.setAttribute('aria-expanded', String(open)); tw.textContent = open ? '▾' : '▸'; } if (mode !== 'cat') setMode('cat'); select({ type: 'cat', id: m }); } }, tw, h('span', { class: 'dot', style: `background:${catColor(m)}` }), catName(m), h('span', { class: 'cnt' }, catCount[m]));
  return h('li', {}, btn, ul);
}));

// ---- 星雲の一覧
$('nebulae').replaceChildren(...D.comms.map((cm, c) => [c, cm]).sort((a, b) => b[1].n - a[1].n).map(([c, cm]) => h('li', {}, h('button', { type: 'button', 'data-c': c, 'aria-pressed': 'false', onclick: () => select({ type: 'neb', id: c }) }, h('span', { class: 'dot', style: `background:${colorOf(c)}` }), cm.name.slice(0, 3).join('・'), h('span', { class: 'cnt' }, cm.n)))));

// ---- 検索（言葉・人物・題名）
const q = $('q'), sug = $('suggest'); let items = [], active = -1;
const norm = (s) => s.normalize('NFKC').toLowerCase();
q.addEventListener('input', () => {
  const s = norm(q.value.trim()); items = [];
  if (s) {
    const words = []; D.terms.forEach((t, j) => { const k = norm(t[0]); if (k.includes(s)) words.push([j, k.startsWith(s) ? 0 : 1, -t[4].length]); });
    words.sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, 6).forEach(([j]) => items.push({ type: 'word', id: j, label: D.terms[j][0], n: D.terms[j][4].length + '回' }));
    D.persons.map((p, k) => [k, p]).filter(([, p]) => norm(p[0]).includes(s)).sort((a, b) => b[1][1].length - a[1][1].length).slice(0, 4).forEach(([k, p]) => items.push({ type: 'person', id: k, label: p[0], n: p[1].length + '回' }));
    const eps = []; for (let i = NE - 1; i >= 0 && eps.length < 6; i--) if (norm(D.eps[i][1]).includes(s)) eps.push(i);
    eps.sort((a, b) => D.eps[b][3] - D.eps[a][3]).forEach((i) => items.push({ type: 'ep', id: i, label: D.eps[i][1], n: fmtDate(D.eps[i][3]) }));
  }
  active = items.length ? 0 : -1; paintSug();
});
const kindLabel = { word: '言葉', person: '人物', ep: '回' };
function paintSug() {
  sug.replaceChildren(...items.map((it, n) => h('li', { role: 'option', id: 'opt' + n, 'aria-selected': String(n === active), onmousedown: (e) => { e.preventDefault(); choose(n); } }, h('span', { class: 'k' }, kindLabel[it.type]), h('span', {}, it.label), h('span', { class: 'n' }, it.n))));
  sug.hidden = !items.length; q.setAttribute('aria-expanded', String(!!items.length)); if (active >= 0) q.setAttribute('aria-activedescendant', 'opt' + active); else q.removeAttribute('aria-activedescendant');
}
function choose(n) { const it = items[n]; if (!it) return; select({ type: it.type, id: it.id }); sug.hidden = true; q.setAttribute('aria-expanded', 'false'); $('panel').focus({ preventScroll: true }); }
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paintSug(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintSug(); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(Math.max(0, active)); }
  else if (e.key === 'Escape') { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); }
});
q.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; q.setAttribute('aria-expanded', 'false'); }, 120));
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
  if (e.key === 'Escape' && document.activeElement !== q) { sel = null; hi = null; history.replaceState(null, '', location.pathname); draw(); }
});
document.addEventListener('click', (e) => { const w = e.target.closest('[data-word]'); if (w) { const j = termIdxByKey.get(norm(w.dataset.word)); if (j !== undefined) select({ type: 'word', id: j }); } });

// ---- スマホの詳細シート（縦: たたむ・半分・全部 / 横: 右の欄をたたむ）
const phonePortrait = matchMedia('(max-width: 760px) and (orientation: portrait)');
const phoneLand = matchMedia('(orientation: landscape) and (max-height: 520px)');
const panelEl = $('panel'), handle = $('sheetHandle'), stageEl = document.querySelector('.stage');
const sheetPx = (st) => ({ peek: 92, half: innerHeight * 0.48, full: innerHeight - 110 }[st]);
function setSheet(st) {
  panelEl.dataset.sheet = st; panelEl.style.height = ''; handle.setAttribute('aria-expanded', String(st !== 'peek')); handle.setAttribute('aria-label', st === 'peek' ? '詳細を広げる' : '詳細をたたむ');
  if (st === 'peek') panelEl.scrollTop = 0;
}
function openDetail() {
  if (phonePortrait.matches && panelEl.dataset.sheet === 'peek') { setSheet('half'); $('toast').hidden = true; }
  if (phoneLand.matches && stageEl.classList.contains('side-closed')) { stageEl.classList.remove('side-closed'); $('sideOpen').hidden = true; }
}
let drag = null;
handle.addEventListener('pointerdown', (e) => { handle.setPointerCapture(e.pointerId); drag = { y: e.clientY, h: panelEl.offsetHeight, moved: false }; panelEl.style.transition = 'none'; });
handle.addEventListener('pointermove', (e) => { if (!drag) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 4) drag.moved = true; panelEl.style.height = Math.max(80, Math.min(innerHeight - 90, drag.h - dy)) + 'px'; });
handle.addEventListener('pointerup', (e) => {
  if (!drag) return; panelEl.style.transition = '';
  if (!drag.moved) setSheet(panelEl.dataset.sheet === 'peek' ? 'half' : 'peek');
  else { const hh = panelEl.offsetHeight; setSheet(['peek', 'half', 'full'].sort((a, b) => Math.abs(sheetPx(a) - hh) - Math.abs(sheetPx(b) - hh))[0]); }
  drag = null;
});
handle.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); setSheet(panelEl.dataset.sheet === 'peek' ? 'half' : 'full'); } if (e.key === 'ArrowDown') { e.preventDefault(); setSheet(panelEl.dataset.sheet === 'full' ? 'half' : 'peek'); } });
$('sheetClose').addEventListener('click', () => { if (phoneLand.matches) { stageEl.classList.add('side-closed'); $('sideOpen').hidden = false; $('sideOpen').focus(); } else setSheet('peek'); });
$('sideOpen').addEventListener('click', () => { stageEl.classList.remove('side-closed'); $('sideOpen').hidden = true; });
phoneLand.addEventListener('change', () => { if (!phoneLand.matches) { stageEl.classList.remove('side-closed'); $('sideOpen').hidden = true; } });
// 案内（1回だけ）: 操作のしかた、地図は横向きがおすすめ
const seen = (k) => { try { return localStorage.getItem('uchu-hint-' + k) === '1'; } catch { return true; } };
const markSeen = (k) => { try { localStorage.setItem('uchu-hint-' + k, '1'); } catch { /* 保存できない端末では毎回出さない */ } };
let toastTimer = null;
function toast(k, text) {
  if (seen(k)) return; markSeen(k);
  $('toastText').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 8000);
}
$('toastClose').addEventListener('click', () => { $('toast').hidden = true; });
function hintsFor(m) {
  if (!(phonePortrait.matches || phoneLand.matches)) return;
  if ((m === 'world' || m === 'japan') && phonePortrait.matches) toast('rotate', '📱↻ 横向きにすると、地図を広く見られます（画面の回転ロックを外してください）');
  else toast('gesture', phoneLand.matches ? '2本指で拡大・縮小、指でなぞって移動できます。右の詳細は × でたためます' : '2本指で拡大・縮小、指でなぞって移動できます。下のつまみを上げると詳細が開きます');
}
// 最初の案内の中の20大分類（スマホでは左の一覧が無いので、ここから選べるように）
$('introCats').replaceChildren(...[...Array(HOLD).keys()].map((m) => h('button', { type: 'button', class: 'chip', onclick: () => { if (mode !== 'cat') setMode('cat'); select({ type: 'cat', id: m }); } }, h('span', { style: `color:${catColor(m)}` }, '●'), D.cats[m].name, h('small', {}, catCount[m]))));

document.getElementById('artList').addEventListener('click', renderArticleList);

// ---- 開始
new ResizeObserver(resize).observe(canvas);
resize(); fit();
$('loading').remove(); showProgress();
function fromHash() {
  const m = location.hash.match(/^#(pl|[ewpnc])=(.+)$/); if (!m) return;
  const v = decodeURIComponent(m[2]);
  if (m[1] === 'e' && epIdx.has(v)) select({ type: 'ep', id: epIdx.get(v) }, { push: false });
  if (m[1] === 'w' && termIdxByKey.has(norm(v))) select({ type: 'word', id: termIdxByKey.get(norm(v)) }, { push: false });
  if (m[1] === 'p') { const k = D.persons.findIndex((p) => p[0] === v); if (k >= 0) select({ type: 'person', id: k }, { push: false }); }
  if (m[1] === 'n' && D.comms[+v]) select({ type: 'neb', id: +v }, { push: false });
  if (m[1] === 'pl') { const id = v === 'JP' ? 'JP' : +v; if (id === 'JP' || PL[id]) select({ type: 'place', id }, { push: false }); }
  if (m[1] === 'c') { const [a, b] = v.split('.').map(Number); if (a >= 0 && a <= HOLD) select({ type: 'cat', id: a, sub: Number.isFinite(b) ? b : -1 }, { push: false }); }
}
fromHash(); addEventListener('hashchange', fromHash);
if (!location.hash) setTimeout(() => hintsFor(mode), 1200);
window.__uchuPerf = { loadMs: Math.round(tLoad), readyMs: Math.round(performance.now() - t0), episodes: NE, terms: D.terms.length };
