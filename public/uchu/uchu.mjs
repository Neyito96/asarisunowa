// 朝ポキの宇宙｜言葉の星図（アルテキスト計画・試験版）
// データ: ./data/core.json（星・言葉・星雲）と ./data/rel.json（関連する回と根拠）は scripts/uchu/build-uchu.mjs が蔵の公開データから作る。
// 回の本文・出演者・関連記事・再生先は、蔵の公開データ（../library/data/details/）をその場で読む（写しを増やさない）。
// 外部ライブラリなし。Canvas 2D と素の DOM だけ。
import { SHELF_KEY, readShelf, serializeShelf, toggleItem, listenLinks, liveLinks } from '../library/shelf-core.mjs';
import { consensus, viewpoints, freshTally, topVotes } from '../minna/minna-core.mjs?v=456';
import { tidyDescription, withoutAwardPlea } from '../library/description-tidy.mjs?v=tidy-501-20261125';
import { stampText } from '../library/stamp.mjs';

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
// 分類（20の大分類・Claude試作）は管理人判断で当面は隠す（2026-11-21・#433）。?cls=1 を付けたときだけ出す（磨いてから公開）
const QS = new URLSearchParams(location.search);
const SHOW_CLS = !QS.has('nocls');   // 分類（主分類・副分類）は表示する。?nocls で隠せる
const SHOW_CROSS = QS.has('cross');   // 分類ページの「二つの分野にまたがる回」の一覧は、分かりにくいので当面隠す。?cross で表示
const SHOW_NEB = QS.has('neb');      // 言葉の星座の自動の仮名（例「征平・吉弥・人生」）は名づけ直すまで隠す（#423）。?neb で表示
const FUCHI = !QS.has('hold');       // ふちの星（#468・2026-11-23 本番）: 分類が決まっていない回を「保留」の塊に集めず、推定した分類のまわりに薄く散らす。以前の塊の表示は ?hold
const D3 = QS.has('3d');   // 試作（2026-11-23）: 軽い立体感。星に奥行き（既定=配信日の新しさ、?3d=kaku で分類の確かさ）を付け、マウス・傾き・ゆらぎで手前ほど大きく動かす
const D3_BY = QS.get('3d') === 'kaku' ? 'kaku' : 'new';
let KOKAI = QS.has('kokai') && !QS.has('3d');   // 3D（航海）表示。右下の「3D」ボタンで切り替える（#485）。?kokai なら3Dで始まる
const KOKAI_URL = KOKAI;   // 試作（2026-11-23）: 航海。星は動かさず、自分（視点）がゆっくり漂う。どの回にも意味のない奥行き（平等）を付け、近い星ほど速く流れる
const AIDA = FUCHI && QS.has('aida'); // ふちの星で、二つの分野にまたがる回を分類のあいだに置く版（#466・保留中）。?aida で表示
if (!SHOW_NEB) document.documentElement.classList.add('no-neb');
if (!SHOW_CLS) { document.documentElement.classList.add('no-cls'); document.querySelector('.modes [data-mode="cat"]')?.remove(); document.querySelector('.modes [data-mode="map"]')?.setAttribute('aria-pressed', 'true'); }
const START_MODE = SHOW_CLS ? 'cat' : 'map';
let mode = START_MODE;
const view = { x: 0, y: 0, k: 1 };
let W = 0, H = 0, dpr = 1;
let hi = null;                   // 光らせる回の集合（Set）
let sel = null;                  // {type:'ep'|'word'|'person'|'neb', id}
let hoverEp = -1, labelRects = [];
const INTRO = document.querySelector('#detail .intro');   // 最初の案内（ホームに戻るときに出し直す）
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
// 星と星を結ぶ線は、ゆるくうねる曲線にする（2026-11-24 管理人指示）。曲がり方は2つの星から決まるので、描き直しても揺れない
function wavyTo(ctx, x0, y0, x1, y1, seed) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (!(L > 12)) { ctx.lineTo(x1, y1); return; }
  let h = (seed | 0) ^ 0x9e3779b9; const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const nx = -dy / L, ny = dx / L, amp = Math.min(160, L * 0.3);
  const sw = () => (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.55) * amp;   // 曲がりは必ず目に見える大きさ（向きは2点で決まる）
  const a1 = sw(), a2 = sw(), t1 = 0.25 + rnd() * 0.15, t2 = 0.6 + rnd() * 0.15;
  ctx.bezierCurveTo(x0 + dx * t1 + nx * a1, y0 + dy * t1 + ny * a1, x0 + dx * t2 + nx * a2, y0 + dy * t2 + ny * a2, x1, y1);
}
function buildCatLayout() {
  const S = 7, GA = Math.PI * (3 - Math.sqrt(5));
  const groups = Array.from({ length: HOLD + 1 }, (_, m) => ({ m, subs: new Map() }));
  const edge = Array.from({ length: HOLD }, () => []);   // ふちの星（?fuchi）
  D.eps.forEach((e, i) => { if (isEdge(i)) { edge[lean(i).m].push(i); return; } const g = groups[dispMain(i)], si = dispSub(i); (g.subs.get(si) || g.subs.set(si, []).get(si)).push(i); });
  const regions = groups.filter((g) => g.subs.size).map((g) => {
    const sp = FUCHI && g.m === HOLD ? 2.4 : 1;   // 名付け募集星群は星どうしの間を広げて、星群らしく見せる
    const subs = [...g.subs].map(([si, ids]) => ({ si, sp, ids: ids.sort((a, b) => D.eps[b][3] - D.eps[a][3]), r: S * sp * Math.sqrt(ids.length) * 1.02 + 6 }));
    packCircles(subs, 6);
    const r = Math.max(...subs.map((q) => Math.hypot(q.x, q.y) + q.r)) + 14;
    return { m: g.m, subs, r, n: subs.reduce((a, q) => a + q.ids.length, 0) };
  });
  // 保留は中央に置かず、分類の外側（右）へ
  const main = regions.filter((rg) => rg.m !== HOLD), hold = regions.find((rg) => rg.m === HOLD);
  packCircles(main, FUCHI ? 70 : 40);
  // 名付け募集星群（保留の塊）は、分類の集まりの右斜め上に置いて目立たせる
  // （11/24: 右上の角では離れすぎて画面の端やボタンに重なるので、分類の集まりの円周の右上に寄せる）
  if (hold) {
    const minX = Math.min(...main.map((rg) => rg.x - rg.r)), maxX = Math.max(...main.map((rg) => rg.x + rg.r)), minY = Math.min(...main.map((rg) => rg.y - rg.r)), maxY = Math.max(...main.map((rg) => rg.y + rg.r));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, R = Math.max(...main.map((rg) => Math.hypot(rg.x - cx, rg.y - cy) + rg.r)), a = -Math.PI / 5;
    hold.x = cx + Math.cos(a) * (R + hold.r + 8); hold.y = cy + Math.sin(a) * (R + hold.r + 8);
  }
  for (const rg of regions) for (const q of rg.subs) {
    q.x += rg.x; q.y += rg.y;
    q.ids.forEach((i, k) => { const rr = S * (q.sp || 1) * 0.95 * Math.sqrt(k + 0.5), a = k * GA; catX[i] = q.x + Math.cos(a) * rr; catY[i] = q.y + Math.sin(a) * rr; });
  }
  D._regions = regions; CRX = null;
  if (FUCHI) placeEdges();
}
// ふちの星の置き場所（?fuchi）。推定（または見立て）を軸に、関連する回がどの分類にあるかで「もう一つの分野」と引き寄せの強さを決める。
// 一つの分野に強く寄る回はその外周に、二つにまたがる回は二つの分類のあいだ（強い側寄り）に置く。関連回（REL）が届く前は外周だけ
const edgeInfo = new Map();
function edgeWeights(i) {
  const w = new Map(), add = (m, v) => { if (m >= 0 && m < HOLD) w.set(m, (w.get(m) || 0) + v); };
  const v = (MINNA.votes || {})[D.eps[i][0]];
  if (v && v.n) for (const r of topVotes(v, 4)) add(CAT_BY_NAME.get(r.name) ?? -1, r.count * 1.5);   // みんなの見立ては1票=1.5
  add(D.cls[i][0], 1);                                                                                  // Claude の推定
  if (REL && REL[i]) for (const r of REL[i][0] || []) { const m = dispMain(r[0]); if (m < HOLD) add(m, r[1] / 100); }   // 関連する回の分類
  return [...w].sort((a, b) => b[1] - a[1]);
}
function placeEdges() {
  const R = new Map(D._regions.map((rg) => [rg.m, rg])), GA = Math.PI * (3 - Math.sqrt(5)), slot = new Map();
  for (let i = 0; i < NE; i++) {
    if (!isEdge(i)) continue;
    const ws = edgeWeights(i), [m1, w1] = ws[0] || [lean(i).m, 1], [m2, w2] = ws[1] || [-1, 0], sum = ws.reduce((a, x) => a + x[1], 0) || 1;
    let hsh = 0; for (const ch of D.eps[i][0]) hsh = (hsh * 31 + ch.charCodeAt(0)) | 0;
    const j = ((hsh >>> 0) % 1000) / 1000, a1 = R.get(m1); if (!a1) continue;
    if (!AIDA) {   // 標準: 推定（見立てがあればその1位）の外周に散らす。見立てが集まるほど中心へ少し寄る（11/22 の形）
      const L = lean(i), rg = R.get(L.m); if (!rg) continue; const k = slot.get(L.m) || 0; slot.set(L.m, k + 1);
      const rr = rg.r + 10 + j * 38 - Math.min(L.votes, 3) * 9, a = k * GA + j * 0.6;
      catX[i] = rg.x + Math.cos(a) * rr; catY[i] = rg.y + Math.sin(a) * rr; edgeInfo.set(i, { m1: L.m, m2: -1, t: 0 }); continue;
    }
    const between = m2 >= 0 && w2 >= w1 * 0.35 && R.get(m2);
    edgeInfo.set(i, { m1, m2: between ? m2 : -1, t: between ? w2 / (w1 + w2) : 0, sure: w1 / sum });
    if (between) {   // 二つの分類の縁と縁を結ぶ線の上。強い側に寄せ、線から少し横にずらす
      const a2 = R.get(m2), dx = a2.x - a1.x, dy = a2.y - a1.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const sx0 = a1.x + ux * (a1.r + 6), sy0 = a1.y + uy * (a1.r + 6), ex = a2.x - ux * (a2.r + 6), ey = a2.y - uy * (a2.r + 6);
      const t = Math.min(0.5, w2 / (w1 + w2)) * (0.6 + j * 0.5), off = (j - 0.5) * 46;
      catX[i] = sx0 + (ex - sx0) * t - uy * off; catY[i] = sy0 + (ey - sy0) * t + ux * off;
    } else {         // 一つの分野に寄る回: 外周。手がかりが強いほど縁に近く、弱いほど遠く
      const k = slot.get(m1) || 0; slot.set(m1, k + 1);
      const rr = a1.r + 8 + (1 - Math.min(1, w1 / sum)) * 40 + j * 14, a = k * GA + j * 0.6;
      catX[i] = a1.x + Math.cos(a) * rr; catY[i] = a1.y + Math.sin(a) * rr;
    }
  }
}
// 関連回が届いたら、ふちの星を置き直して動かす
function replaceEdges() {
  if (!AIDA || !D._regions) return;
  const fx = new Map(); for (let i = 0; i < NE; i++) if (isEdge(i)) fx.set(i, [catX[i], catY[i]]);
  placeEdges();
  if (mode !== 'cat') return;
  const start = performance.now(), ms = reduceMotion ? 0 : 900;
  const step = (t) => { const p = ms ? Math.min(1, (t - start) / ms) : 1, e = 1 - Math.pow(1 - p, 3); for (const [i, [x0, y0]] of fx) { px[i] = x0 + (catX[i] - x0) * e; py[i] = y0 + (catY[i] - y0) * e; } render(); if (p < 1) requestAnimationFrame(step); else buildGrid(); };
  requestAnimationFrame(step);
}
let anim = null, queued = false;
// ---- 軽い立体感（?3d）
let Z = null, ORDER = null, ZK = null;   // ZK＝3D（航海）の奥行き。回の番号から決まる意味のない値（どの回も平等）
const tilt = { x: 0, y: 0, tx: 0, ty: 0, last: 0 }, AMP = 24;
const ox = (i) => (D3 && Z ? (Z[i] - 0.5) * tilt.x * AMP : 0), oy = (i) => (D3 && Z ? (Z[i] - 0.5) * tilt.y * AMP : 0);
// 航海: 近い星（Zが大きい）ほど画面の中心から遠くへ広がる＝自分が動くと速く流れる（遠近）
const koOn = () => KOKAI && ZK && mode === 'cat';
// 航海の立体: 星を (x, y, 奥行き) の点として、視点のまわりを回して（横・斜め・真上から）遠近をつけて映す
const cam = { yaw: 0, pitch: 0, hd: 0 }, DEPTH = 700, SPREAD = 1.7;   // SPREAD＝3Dでは星群どうしの間を広げる（星群の中の並びはそのまま）
let CRX = null, CRY = null;   // 各星が属する星群の中心（3Dで間を広げるため）   // hd＝進む向き（地面の上で向きを変える。「中に入る」時に使う）   // 視点までの距離は寄るほど近くなる（引きでは遠近を弱く、星の間では強く）
let PX2 = null, PY2 = null, PS2 = null, PZ2 = null, ORD2 = null;
const turned = () => Math.abs(cam.yaw) + Math.abs(cam.pitch) + Math.abs(cam.hd) > 0.04;
let PJ = null;   // その時の投影の係数
function projSetup() {
  const inside = KOKAI && voyage.inside;
  PJ = { ch: Math.cos(cam.hd), sh: Math.sin(cam.hd), cy: Math.cos(cam.yaw), sy: Math.sin(cam.yaw), cp: Math.cos(cam.pitch), sp: Math.sin(cam.pitch),
    camd: inside ? Math.max(160, 520 / view.k) : Math.max(450, 2200 / view.k), oy: inside ? H * 0.68 : H / 2 };
}
// 1点を映す: 向き（地面の上の回転）→ 横からの回転 → 斜め・真上からの回転 → 遠近。視点の後ろは映さない
function projPt(X, Y, Zw, out) {
  const P = PJ, xh = P.ch * X - P.sh * Y, yh = P.sh * X + P.ch * Y;
  const x1 = P.cy * xh + P.sy * Zw, z1 = -P.sy * xh + P.cy * Zw, y2 = P.cp * yh - P.sp * z1, z2 = P.sp * yh + P.cp * z1;
  const den = P.camd - z2; if (den < P.camd * 0.08) { out[0] = NaN; return out; }
  const f = P.camd / den; out[0] = W / 2 + x1 * view.k * f; out[1] = P.oy + y2 * view.k * f; out[2] = f; out[3] = z2; return out;
}
function projectAll() {
  if (!PX2 || PX2.length !== NE) { PX2 = new Float32Array(NE); PY2 = new Float32Array(NE); PS2 = new Float32Array(NE); PZ2 = new Float32Array(NE); ORD2 = new Uint32Array(NE); }
  projSetup(); const o = [0, 0, 0, 0];
  if (!CRX || CRX.length !== NE) {
    CRX = new Float32Array(NE); CRY = new Float32Array(NE); const R = new Map((D._regions || []).map((rg) => [rg.m, rg]));
    for (let i = 0; i < NE; i++) { const rg = R.get(isEdge(i) ? lean(i).m : dispMain(i)); CRX[i] = rg ? rg.x : px[i]; CRY[i] = rg ? rg.y : py[i]; }
  }
  const S1 = SPREAD - 1;
  for (let i = 0; i < NE; i++) { projPt(px[i] - view.x + S1 * (CRX[i] - view.x), py[i] - view.y + S1 * (CRY[i] - view.y), (ZK[i] - 0.5) * DEPTH, o); PX2[i] = o[0]; PY2[i] = o[1]; PS2[i] = o[0] === o[0] ? o[2] : 0; PZ2[i] = o[0] === o[0] ? o[3] : -1e9; ORD2[i] = i; }
  ORD2.sort((a, b) => PZ2[a] - PZ2[b]);   // 奥から描く
}
// 遠くの星ほど霞む（中に入った時）
const fogOf = (i) => (KOKAI && voyage.inside ? Math.max(0.12, Math.min(1, 1 + PZ2[i] / (PJ.camd * 3))) : 1);
// 星群の名前を空間の中に浮かべる（回した・中に入った時）
function drawLabels3D() {
  // 主分類の看板: 星群の中心から柱を立て、その上に名前と回数（枠なし・影で読みやすく）。奥から描いて手前を上に重ねる
  const o = [0, 0, 0, 0], list = [];
  for (const rg of D._regions || []) { if (rg.m === HOLD) continue; projPt(SPREAD * (rg.x - view.x), SPREAD * (rg.y - view.y), 0, o); if (o[0] !== o[0]) continue; list.push({ rg, x: o[0], y: o[1], f: o[2], z: o[3] }); }
  list.sort((a, b) => a.z - b.z);
  const inside = KOKAI && voyage.inside;
  for (const L of list) {
    const size = Math.max(12, Math.min(32, 15 * L.f)), fog = Math.max(0.25, Math.min(1, 1 + L.z / (PJ.camd * 3))), stem = inside ? Math.max(12, Math.min(80, 40 * L.f)) : 0;
    const name = catName(L.rg.m), cnt = (catCount[L.rg.m] || 0).toLocaleString();
    ctx.font = `700 ${size}px ${MINCHO}`; const tw = ctx.measureText(name).width; const cs = Math.round(size * 0.6); ctx.font = `${cs}px system-ui, sans-serif`; const cw = ctx.measureText(cnt).width;
    const total = tw + size * 0.35 + cw, tx = L.x - total / 2, ty = L.y - stem - size * 0.45;
    if (tx > W + 40 || tx + total < -40 || ty > H + 40 || ty < -40) continue;
    const col = catColor(L.rg.m);
    ctx.globalAlpha = fog;
    if (stem) { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, L.f * 0.9); ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(L.x, L.y - stem); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(L.x, L.y, Math.max(2, 2.6 * L.f), 0, Math.PI * 2); ctx.fill(); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.shadowColor = 'rgba(0, 0, 0, 0.95)'; ctx.shadowBlur = Math.max(4, size * 0.4);
    ctx.font = `700 ${size}px ${MINCHO}`; ctx.fillStyle = col; ctx.fillText(name, tx, ty);
    ctx.font = `${cs}px system-ui, sans-serif`; ctx.fillStyle = '#a9b0cf'; ctx.fillText(cnt, tx + tw + size * 0.35, ty);
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }
  ctx.globalAlpha = 1;
}
const SX = (i) => (koOn() && PX2 ? PX2[i] : sx(px[i]) + ox(i)), SY = (i) => (koOn() && PY2 ? PY2[i] : sy(py[i]) + oy(i));
const colors = [];
const canvas = $('sky'), ctx = canvas.getContext('2d');

// ---- 読み込み（2段）: まず core（回・分類）で画面を出し、言葉・地名・関連回は裏で読む。進み具合を棒で示す
const t0 = performance.now();
const MAN = await fetch('./data/manifest.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ sizes: {} }));
{ const st = document.getElementById('stamp'), info = { generatedAt: MAN.generatedAt, newest: MAN.newest, count: MAN.episodes, app: MAN.apps?.uchu }, t = stampText({ ...info, compact: true }); if (st && t) { st.textContent = t; st.title = stampText(info); st.hidden = false; } }   // データ更新とアプリ版（#430）
// 朝リスみんなで仕分け（../minna/）の票。3人以上・3分の2以上が同じ主分類なら「みんなの分類（候補）」として示す（保留を外すのは管理人の確認後）
const MINNA = await fetch('../minna/votes.json').then((r) => (r.ok ? r.json() : { votes: {} })).catch(() => ({ votes: {} }));
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
const catColor = (m) => (m === HOLD ? (FUCHI ? '#ece6ff' : '#6f7894') : `hsl(${D.cats[m].hue} 70% 66%)`);   // 名付け募集星群は淡い白で瞬かせる
const catName = (m) => (m === HOLD ? (FUCHI ? 'ミミマチ星群（仮）' : '保留（推定のみ）') : D.cats[m].name);
// ふちの星（?fuchi）: 保留の回の寄せ先。みんなの見立てがあればその1位、なければ Claude の推定。どちらもなければ -1
const CAT_BY_NAME = new Map(D.cats.map((c, m) => [c.name, m]));
function lean(i) {
  if (dispMain(i) !== HOLD) return { m: -1, votes: 0 };
  const v = (MINNA.votes || {})[D.eps[i][0]], top = v && v.n ? topVotes(v, 1)[0] : null, vm = top ? CAT_BY_NAME.get(top.name) : undefined;
  if (vm !== undefined) return { m: vm, votes: top.count, by: 'minna' };
  return { m: D.cls[i][0] >= 0 ? D.cls[i][0] : -1, votes: 0, by: 'claude' };
}
const isEdge = (i) => FUCHI && dispMain(i) === HOLD && lean(i).m >= 0;
const epColor = (i) => (mode === 'map' ? colorOf(D.eps[i][6]) : isEdge(i) ? catColor(lean(i).m) : catColor(dispMain(i)));
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
  fromHash('load'); draw();   // 言葉・地名が届いた後の読み直しも、最初の読み込みと同じ扱い（分類なら寄らない）
}).catch((e) => { live('言葉・地図のデータを読み込めませんでした'); console.error(e); });
loadJson('rel').then((r) => { REL = r.rel; replaceEdges(); if (sel && sel.type === 'ep') renderEp(sel.id); }).catch((e) => console.error(e));

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
  // 奥行き（0=奥・1=手前）。新しい回ほど手前、または分類が確かな回ほど手前
  Z = new Float32Array(NE); D.eps.forEach((e, i) => { const c = D.cls[i]; Z[i] = D3_BY === 'kaku' ? (c[3] === 'a' ? 1 : 'apd'.includes(c[3]) && c[0] >= 0 ? 0.25 + c[2] * 0.2 : 0.05) : days[i] > 0 ? (days[i] - dMin) / (dMax - dMin) : 0; });
  ZK = new Float32Array(NE); D.eps.forEach((e, i) => { let hsh = 0; for (const ch of e[0]) hsh = (hsh * 131 + ch.charCodeAt(0)) | 0; ZK[i] = ((hsh >>> 0) % 1000) / 1000; });   // 3D（航海）の奥行き: 意味を持たせない（どの回も平等）
  ORDER = [...Array(NE).keys()].sort((a, b) => Z[a] - Z[b]);   // 奥から描いて、手前の星を上に重ねる
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
  const step = (t) => { const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3); view.x = from.x + (x - from.x) * e; view.y = from.y + (y - from.y) * e; view.k = from.k * Math.pow(k / from.k, e); draw(); if (p < 1) anim = requestAnimationFrame(step); else anim = null; };
  anim = requestAnimationFrame(step);
}
function draw() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }

// ---- 描画
function render() {
  ctx.clearRect(0, 0, W, H);
  const k = view.k;
  // 星雲の光（星図のとき）
  if (isGeo()) drawLand();
  if (koOn()) projectAll();
  if (mode === 'cat' && !(koOn() && turned())) drawRegions();
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
  for (let n = 0; n < NE; n++) {
    const i = koOn() && ORD2 ? ORD2[n] : D3 && ORDER ? ORDER[n] : n;
    const x = SX(i), y = SY(i); if (!(x > -4 && y > -4 && x < W + 4 && y < H + 4)) continue;
    const edgeOn = mode === 'cat' && isEdge(i) && (!dim || (sel && sel.type === 'cat' && lean(i).m === sel.id));
    const on = !dim || hi.has(i), depth = D3 && Z ? 0.5 + 0.5 * Z[i] : koOn() ? Math.min(1, 0.25 + 0.6 * PS2[i]) * fogOf(i) : 1, b = D3 && Z ? base * (0.55 + 0.9 * Z[i]) : koOn() ? base * Math.min(voyage.inside ? 7 : 3, PS2[i] * PS2[i]) : base;
    ctx.fillStyle = epColor(i);
    if (edgeOn) {   // ふちの星: 塵に見えないよう、丸い芯＋やわらかな光の輪で「星」として見せる（決まった星よりは控えめ）
      const r = Math.max(1.3, b * 0.62) * (k > 2 ? Math.min(1.8, 0.8 + k * 0.12) : 1);
      ctx.globalAlpha = 0.16 * depth; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.78 * depth; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const tw = mode === 'cat' && FUCHI && dispMain(i) === HOLD ? 0.45 + 0.55 * Math.sin(performance.now() / 650 + (i % 17) * 0.9) : 1;   // 名付け募集星群はゆっくり瞬く
    ctx.globalAlpha = (on ? 0.9 : 0.12) * depth * tw;
    if (tw !== 1) { const r = Math.max(1.4, b * 0.75); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); continue; }   // 名付け募集星群は丸く少し大きく
    ctx.fillRect(x - b / 2, y - b / 2, b, b);
  }
  ctx.globalAlpha = 1;
  if (dim) for (const i of hi) { const x = SX(i), y = SY(i); if (!Number.isFinite(x)) continue; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, base * 0.9 + 0.8, 0, Math.PI * 2); ctx.fill(); }
  // 選んだ回: 関連する回への線
  if (sel && sel.type === 'ep') {
    const i = sel.id, x0 = SX(i), y0 = SY(i);
    if (REL) for (const r of REL[i][0]) { const j = r[0]; if (!Number.isFinite(px[j])) continue; ctx.strokeStyle = r[3] ? '#f3d48fcc' : '#9fb4e0aa'; ctx.lineWidth = 1 + r[1] / 60; ctx.beginPath(); ctx.moveTo(x0, y0); wavyTo(ctx, x0, y0, SX(j), SY(j), i * 7919 + j); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(SX(j), SY(j), 3, 0, Math.PI * 2); ctx.fill(); }
    if (Number.isFinite(x0)) { ctx.strokeStyle = '#f3c969'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x0, y0, 9, 0, Math.PI * 2); ctx.stroke(); }
  }
  if (hoverEp >= 0) { const x = SX(hoverEp), y = SY(hoverEp); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
  if (!(koOn() && turned())) drawLabels(); else drawLabels3D();
  if (koOn()) drawVoyageHud();
  if (D3 && !phonePortrait.matches) { ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#a9b0cf'; ctx.textAlign = 'left'; ctx.fillText(D3_BY === 'kaku' ? '立体（試作）：手前ほど分類が確か・奥ほどあいまい' : '立体（試作）：手前ほど新しい回・奥ほど古い回', 14, H - 14); }
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
    if (view.k > 0.9 && !FUCHI) { ctx.strokeStyle = rg.m === HOLD ? '#ffffff14' : `hsl(${D.cats[rg.m].hue} 60% 60% / .22)`; ctx.lineWidth = 1; for (const q of rg.subs) { ctx.beginPath(); ctx.arc(sx(q.x), sy(q.y), q.r * view.k, 0, Math.PI * 2); ctx.stroke(); } }
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
    if (SHOW_NEB) D.comms.forEach((cm, c) => { const x = sx(cm.x), y = sy(cm.y); const text = cm.name.slice(0, 2).join('・'); const w = ctx.measureText(text).width + 8; if (!place(x, y, w, 18)) return; ctx.fillStyle = '#000a'; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = colorOf(c); ctx.fillText(text, x, y); });
    return;
  }
  if (sel && sel.type === 'word') {
    const j0 = sel.id, x0 = sx(D.terms[j0][1]), y0 = sy(D.terms[j0][2]);
    ctx.strokeStyle = '#f3c96988'; ctx.lineWidth = 1;
    for (const [y] of D.terms[j0][5]) { if (D.terms[y][1] === null) continue; ctx.beginPath(); ctx.moveTo(x0, y0); wavyTo(ctx, x0, y0, sx(D.terms[y][1]), sy(D.terms[y][2]), j0 * 7919 + y); ctx.stroke(); }
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
    for (const i of a.eps) { if (!Number.isFinite(px[i])) continue; ctx.beginPath(); ctx.moveTo(x, y); wavyTo(ctx, x, y, sx(px[i]), sy(py[i]), n * 7919 + i); ctx.stroke(); }
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
  if (koOn()) { let best = -1, bd = r; for (let i = 0; i < NE; i++) { if (!Number.isFinite(px[i])) continue; const d = Math.hypot(SX(i) - cx, SY(i) - cy); if (d < bd) { bd = d; best = i; } } return best; }
  const x = wx(cx), y = wy(cy), rr = (r + (D3 ? AMP / 2 : 0)) / view.k; let best = -1, bd = Infinity;
  for (let a = Math.floor((x - rr) / 24); a <= Math.floor((x + rr) / 24); a++) for (let b = Math.floor((y - rr) / 24); b <= Math.floor((y + rr) / 24); b++) for (const i of grid.get(a + ',' + b) || []) { const d = Math.hypot(px[i] + ox(i) / view.k - x, py[i] + oy(i) / view.k - y); if (d < r / view.k && d < bd) { bd = d; best = i; } }
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
  if (KOKAI && voyage.inside && pts.size === 1) { cam.hd += dx * 0.006; const fx = -Math.sin(cam.hd), fy = -Math.cos(cam.hd); view.x += fx * (dy * 2.2) / view.k; view.y += fy * (dy * 2.2) / view.k; p.x = e.offsetX; p.y = e.offsetY; draw(); return; }   // 中に入った時: 横になぞると向きを変え、縦になぞると前後に進む
  if (KOKAI && voyage.rot && pts.size === 1) { cam.yaw = Math.max(-1.4, Math.min(1.4, cam.yaw + dx * 0.008)); cam.pitch = Math.max(-1.35, Math.min(1.35, cam.pitch + dy * 0.008)); p.x = e.offsetX; p.y = e.offsetY; draw(); return; }   // 航海の「回す」: 横になぞると横から、縦になぞると斜め・真上から
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
  if (s.type === 'cat') { hi = new Set(); D.eps.forEach((e, i) => { if (dispMain(i) === s.id && !isEdge(i) && (s.sub == null || s.sub < 0 || dispSub(i) === s.sub)) hi.add(i); }); renderCat(s.id, s.sub); const rg = D._regions.find((r) => r.m === s.id); if (fly && rg && mode === 'cat') { const q = s.sub >= 0 ? rg.subs.find((x) => x.si === s.sub) : null; const tgt = q || rg; focusAt(tgt.x, tgt.y, Math.min(W, H) / (tgt.r * 2.6)); } }
  if (s.type === 'fmt') { hi = new Set(); D.fmt.forEach((f, i) => { if (f.some(([k]) => k === s.id)) hi.add(i); }); renderFormat(s.id); }
  if (s.type === 'neb') { hi = new Set(); D.eps.forEach((e, i) => { if (e[6] === s.id) hi.add(i); }); renderNebula(s.id); const cm = D.comms[s.id]; if (fly && mode === 'map') focusAt(cm.x, cm.y, Math.min(W, H) / (cm.r * 3.2)); }
  document.querySelectorAll('#formats button').forEach((b) => b.setAttribute('aria-pressed', String(s.type === 'fmt' && +b.dataset.f === s.id)));
  document.querySelectorAll('#nebulae button').forEach((b) => b.setAttribute('aria-pressed', String(s.type === 'neb' && +b.dataset.c === s.id)));
  document.querySelectorAll('#cats button').forEach((b) => b.setAttribute('aria-pressed', String(s.type === 'cat' && +b.dataset.m === s.id && (b.dataset.s == null ? !(s.sub >= 0) : +b.dataset.s === s.sub))));
  if (push && s.type !== 'article') { const hash = s.type === 'ep' ? 'e=' + D.eps[s.id][0] : s.type === 'word' ? 'w=' + encodeURIComponent(D.terms[s.id][0]) : s.type === 'person' ? 'p=' + encodeURIComponent(D.persons[s.id][0]) : s.type === 'cat' ? 'c=' + s.id + (s.sub >= 0 ? '.' + s.sub : '') : s.type === 'place' ? 'pl=' + s.id : s.type === 'fmt' ? 'f=' + s.id : 'n=' + s.id; history.replaceState(null, '', '#' + hash); }
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
    h('p', { class: 'kind' }, '言葉'), h('h3', { class: 'hero' }, t[0]), h('p', { class: 'meta' }, h('span', {}, `${ids.length}回で主な言葉`), t[3] >= 0 && SHOW_NEB ? h('span', {}, `星雲「${D.comms[t[3]].name.slice(0, 2).join('・')}」`) : null),
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
const FIELD = { t: '題名', m: '旧仮分類の主題', r: '関連記事の見出し', d: '概要欄', o: '蔵の公式タグ' };
const evText = (ev) => ev.split('|').map((x) => { const [k, f] = x.split(':'); return `「${k}」（${FIELD[f] || f}）`; }).join(' ');
const dispMain2 = (i) => (dispMain(i) === HOLD ? -1 : D.cls[i][4] ?? -1);   // 副分類（#390）
// ---- 保留の仕分け（#387 試作）。回答はこの端末（ブラウザ）だけに保存し、どこにも送らない
const SORT_KEY = 'uchu-sort-v1';
function sortLoad() { try { return JSON.parse(localStorage.getItem(SORT_KEY) || '{}'); } catch (e) { return {}; } }
const holdIds = () => D.eps.map((_, i) => i).filter((i) => dispMain(i) === HOLD);
function nextHold() {
  const done = sortLoad(), rest = holdIds().filter((i) => !done[D.eps[i][0]]);
  if (!rest.length) { toast('sort-done-' + Date.now(), '保留の回はすべて仕分け済みです。ありがとうございました'); return; }
  select({ type: 'ep', id: rest[Math.floor(Math.random() * rest.length)] }); openDetail();
}
// この端末で送った直後の集計（みんなで仕分けが保存）。読めない環境では空
const minnaFresh = () => { try { return JSON.parse(localStorage.getItem('minna:fresh') || '{}') || {}; } catch { return {}; } };
function edgeText(i) {
  const e = edgeInfo.get(i), m1 = e ? e.m1 : lean(i).m, src = !AIDA ? (lean(i).by === 'minna' ? 'みんなの見立て' : 'Claude の推定') : lean(i).by === 'minna' ? 'みんなの見立てと関連する回から' : REL ? 'Claude の推定と関連する回から' : 'Claude の推定から';
  if (e && e.m2 >= 0) return `「${D.cats[m1].name}」と「${D.cats[e.m2].name}」のあいだ。${e.t >= 0.42 ? 'ほぼ真ん中' : `「${D.cats[m1].name}」寄り`}（${src}。まだ決まっていません）`;
  return `「${D.cats[m1].name}」のあたり？（${src}。まだ決まっていません）`;
}
function catSection(i) {
  if (!SHOW_CLS) {   // 分類を隠している間は、保留の回にだけ「みんなで仕分ける」入口を出す
    if (dispMain(i) !== HOLD) return null;
    return h('div', { class: 'sec' }, h('p', { class: 'note' }, h('a', { href: '../minna/#ep=' + D.eps[i][0], target: '_blank', rel: 'noopener' }, 'この星はどこへいく？ →')));
  }
  const [mi, si, conf, src, mi2, si2] = D.cls[i], [ev, old, ev2] = D.clsEv[i] || ['', '', ''], shown = dispMain(i);
  const guess = shown === HOLD && mi >= 0 && sortLoad()[D.eps[i][0]] ? h('p', { class: 'evid' }, `Claudeの推定: ${D.cats[mi].name}（${src === 'l' ? '似た回の言葉から学んだ推定' : '関連する回の分類から'}・要確認）`) : null;
  const ep = D.eps[i][0], mv = freshTally((MINNA.votes || {})[ep], minnaFresh()[ep], MINNA.generatedAt), mc = consensus(mv), vp = viewpoints(mv);
  const minnaLink = h('a', { href: '../minna/#ep=' + ep, target: '_blank', rel: 'noopener' }, shown === HOLD ? 'この星はどこへいく？ →' : 'この分類、ちがうかも？ 見立てを送る →');
  const minna = h('div', { class: 'minna-vp' },
    mc ? h('p', { class: 'dual' }, h('span', { class: 'badge mv' }, 'みんなの分類（候補）'), `${mc.name}（${mc.n}人中${mc.count}人）`) : null,
    vp ? h('p', { class: 'dual' }, h('span', { class: 'badge c2b' }, 'みんなの見立て'), vp.rows.map((r) => `${r.name}（${r.count}人）`).join('、') + (vp.unsure ? `、わからない（${vp.unsure}人）` : '')) : null,
    h('p', { class: 'note' }, minnaLink));
  return h('div', { class: 'sec' }, h('h4', {}, '分類'),
    shown === HOLD && isEdge(i) ? h('p', {}, h('span', { class: 'badge cl' }, 'ふちの星'), h('span', { class: 'note' }, edgeText(i))) :
    shown === HOLD ? h('p', {}, h('span', { class: 'badge cl' }, FUCHI ? 'ミミマチ星群（仮）' : '保留'), h('span', { class: 'note' }, '手がかりが弱いため分類に置いていません')) :
      h('p', {}, h('span', { class: 'badge ' + CONF[conf][0] }, CONF[conf][1]), h('button', { type: 'button', class: 'chip catpath', onclick: () => select({ type: 'cat', id: shown, sub: si }) }, catName(shown) + (si >= 0 ? ' › ' + D.cats[shown].subs[si] : ''))),
    minna,
    guess,
    ev ? h('p', { class: 'evid' }, '根拠: ', evText(ev)) : null,
    shown !== HOLD && mi2 >= 0 ? h('p', { class: 'dual' }, h('span', { class: 'badge c2b' }, '副分類'), h('button', { type: 'button', class: 'chip catpath', onclick: () => select({ type: 'cat', id: mi2, sub: si2 }) }, h('span', { style: `color:${catColor(mi2)}` }, '● '), catName(mi2) + (si2 >= 0 ? ' › ' + D.cats[mi2].subs[si2] : ''))) : null,
    shown !== HOLD && mi2 >= 0 && ev2 ? h('p', { class: 'evid' }, '副分類の根拠: ', evText(ev2)) : null,
    shown !== HOLD && mi2 >= 0 ? h('p', { class: 'note' }, `この回は「${D.cats[mi2].name}」の話題にも触れています（星は主分類の側に1つだけ置いています）。`) : null,
    src === 'a' ? h('p', { class: 'evid' }, '大分類は人の承認に従っています（小分類は Claude の対応づけ）') : src === 'p' ? h('p', { class: 'evid' }, '大分類は旧仮分類（' + old + '）に従い、手がかり語で確認しています') : null,
    old && src !== 'p' && src !== 'a' ? h('p', { class: 'evid' }, '旧仮分類の主題: ' + old) : null);
}
function renderCat(m, sub) {
  const ids = [...hi], cnt = { 3: 0, 2: 0, 1: 0, 0: 0 }; ids.forEach((i) => { cnt[D.cls[i][2]] = (cnt[D.cls[i][2]] || 0) + 1; });
  const subCounts = m === HOLD ? [] : D.cats[m].subs.map((n, si) => [si, n, ids.length && !(sub >= 0) ? D.eps.reduce((a, e, i) => a + (dispMain(i) === m && dispSub(i) === si ? 1 : 0), 0) : 0]);
  const tot = ids.length || 1, seg = (c, col) => h('span', { style: `width:${(cnt[c] / tot) * 100}%;background:${col}` });
  panel().replaceChildren(h('div', {},
    h('p', { class: 'narrow-only' }, h('button', { type: 'button', class: 'chip', onclick: renderIndex }, '☰ 分類の一覧')),
    h('p', { class: 'kind' }, sub >= 0 ? '小分類' : m === HOLD ? '保留' : '大分類'),
    h('h3', { class: 'hero' }, sub >= 0 ? D.cats[m].subs[sub] : catName(m)),
    sub >= 0 ? h('p', { class: 'meta' }, h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m }) }, '← ' + catName(m))) : null,
    h('p', { class: 'meta' }, h('span', {}, `${ids.length}回`), m !== HOLD ? h('span', {}, `承認 ${cnt[3]}・高 ${cnt[2]}・中 ${cnt[1]}・低 ${cnt[0]}`) : null),
    FUCHI && m !== HOLD && !(sub >= 0) ? h('p', { class: 'note' }, `まわりに、このあたりかもしれない「ふちの星」が ${D.eps.reduce((a, e, i) => a + (isEdge(i) && lean(i).m === m ? 1 : 0), 0)}回 あります（薄い星・まだ決まっていない回）。`) : null,
    m !== HOLD ? h('div', { class: 'bars', 'aria-hidden': 'true' }, seg(3, '#5fbf7a'), seg(2, '#5b8fd6'), seg(1, '#d6b44f'), seg(0, '#c46a72')) : null,
    h('p', { class: 'note' }, m === HOLD && FUCHI ? 'AI にも推定がつかず、見立てもまだない回です。どの分類のそばにも置いていません。聴いた方の見立てを待っています。' : m === HOLD ? 'AI が推定はしたものの、根拠が弱いため分類に置いていない回です。人の確認で振り分ける候補です。' : '星の並びはAIの試作です。確度の低い回は誤りを含みます。人が動かした星はそのまま残ります。'),
    h('p', { class: 'note' }, showMix(ids)),
    subCounts.length ? h('div', { class: 'sec' }, h('h4', {}, '小分類'), subCounts.filter((x) => x[2]).map(([si, n, c]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m, sub: si }) }, n, h('small', {}, c)))) : null,
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    m !== HOLD && !(sub >= 0) ? crossSection(m) : null,
    h('div', { class: 'sec' }, h('h4', {}, '回'), epList(ids, 60))));
  live(`${sub >= 0 ? D.cats[m].subs[sub] : catName(m)}。${ids.length}回`);
}
// 二つの分野にまたがる回（#390）: この大分類と組になる分野、副分類としてここにも入る回
function crossSection(m) {
  if (!SHOW_CROSS) return null;
  const pair = new Map(), as2 = [];
  D.eps.forEach((e, i) => { const a = dispMain(i), b = dispMain2(i); if (b < 0) return; if (a === m) pair.set(b, (pair.get(b) || 0) + 1); if (b === m) { pair.set(a, (pair.get(a) || 0) + 1); as2.push(i); } });
  if (!pair.size) return null;
  return h('div', { class: 'sec' }, h('h4', {}, '二つの分野にまたがる回'),
    h('p', { class: 'note' }, `${catName(m)}と組になって語られる分野（主分類・副分類のどちらか）。`),
    [...pair].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: k }) }, h('span', { style: `color:${catColor(k)}` }, '●'), `${catName(m)} × ${catName(k)}`, h('small', {}, n))),
    as2.length ? h('details', {}, h('summary', {}, `副分類としてここにも入る回 ${as2.length}回`), epList(as2, 40)) : null);
}
// 形式の軸（#390）
const FMT_NOTE = { s: '番組', t: '題名', d: '概要欄' };
function renderFormat(k) {
  const ids = [...hi], cat = new Map(); ids.forEach((i) => { const m = dispMain(i); if (m < HOLD) cat.set(m, (cat.get(m) || 0) + 1); });
  const words = new Map(); ids.forEach((i) => D.fmt[i].forEach(([f, w]) => { if (f === k) words.set(w, (words.get(w) || 0) + 1); }));
  panel().replaceChildren(h('div', {},
    h('p', { class: 'kind' }, '形式'), h('h3', { class: 'hero' }, D.formats[k]), h('p', { class: 'meta' }, h('span', {}, `${ids.length}回`)),
    h('p', { class: 'note' }, showMix(ids)),
    h('p', { class: 'evid' }, '判定の根拠になった言い回し: ', [...words].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => `「${w}」${n}`).join('　')),
    h('div', { class: 'sec' }, h('h4', {}, '時間の変化'), histogram(ids)),
    cat.size ? h('div', { class: 'sec' }, h('h4', {}, 'この形式で語られた分野'), [...cat].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, n]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m }) }, h('span', { style: `color:${catColor(m)}` }, '●'), D.cats[m].name, h('small', {}, n)))) : null,
    h('div', { class: 'sec' }, h('h4', {}, '回'), epList(ids, 60)),
    h('p', { class: 'note' }, '形式はテーマ（分類）とは別の軸です。保留の回も、形式からたどれます。')));
  live(`形式「${D.formats[k]}」。${ids.length}回`);
}
function fmtSection(i) {
  const f = D.fmt[i]; if (!f || !f.length) return null;
  return h('div', { class: 'sec' }, h('h4', {}, '形式'), f.map(([k, w, c]) => h('button', { type: 'button', class: 'chip', title: `根拠: 「${w}」（${FMT_NOTE[c] || c}）`, onclick: () => select({ type: 'fmt', id: k }) }, D.formats[k])),
    h('p', { class: 'evid' }, '根拠: ', f.map(([, w, c]) => `「${w}」（${FMT_NOTE[c] || c}）`).join(' ')));
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
    h('div', { class: 'btns' }, h('a', { class: 'btn primary', href: `../library/?ep=${id}`, target: '_blank', rel: 'noopener' }, '蔵で詳しく見る ↗'), shelfBtn),
    catSection(i), fmtSection(i), placeSection(i), descBox, relBox,
    e[6] >= 0 ? (SHOW_NEB ? h('div', { class: 'sec' }, h('h4', {}, '星雲'), h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'neb', id: e[6] }) }, h('span', { style: `color:${colorOf(e[6])}` }, '●'), D.comms[e[6]].name.slice(0, 2).join('・'))) : null) : h('p', { class: 'note' }, 'この回は共通の言葉が少ないため、星図には置いていません。')));
  live(`回「${e[1]}」`);
  const d = await loadDetail(id); if (!sel || sel.type !== 'ep' || sel.id !== i) return;
  if (!d) { descBox.replaceChildren(h('p', { class: 'note' }, '詳細を読み込めませんでした。蔵で見てください。')); return; }
  const pl = listenLinks(liveLinks(d, d.links || [])).map((l) => [l.label, l.url]);   // 蔵と同じ並び（朝日新聞 公式 → Spotify → Apple → ほか）。Omny・Megaphone は出さない
  const words = (() => { const s = new Set(); D.terms.forEach((t, j) => { if (t[4].includes(i)) s.add(j); }); return [...s].sort((a, b) => D.terms[a][4].length - D.terms[b][4].length).slice(0, 10); })();
  const tidy = tidyDescription(d.description), useTidy = tidy.status === 'TIDY' || tidy.status === 'AS_IS';   // 蔵と同じ表示整形（告知・定型を外す。保留の回は元の文面）
  const descText = tidy.status === 'PROMO_ONLY' ? '公式の概要欄は番組の告知だけで、この回の内容の説明はありません。' : (useTidy ? tidy.body : withoutAwardPlea(d.description));
  descBox.replaceChildren(...[   // replaceChildren は null を「null」という文字にするので、空のものは外して渡す
    descText ? h('p', { class: 'desc' }, descText) : null,
    d.cast ? h('p', { class: 'meta' }, '出演: ', d.cast) : null,
    pl.length ? h('div', { class: 'sec links' }, h('h4', {}, '聴く'), pl.map(([l, u]) => h('a', { href: u, target: '_blank', rel: 'noopener' }, l + ' ↗'))) : null,
    words.length ? h('div', { class: 'sec' }, h('h4', {}, 'この回の言葉'), words.map((j) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'word', id: j }) }, D.terms[j][0]))) : null,
    (d.relatedArticles || []).length ? h('div', { class: 'sec links' }, h('h4', {}, `関連記事（${d.relatedArticles.length}本・朝日新聞デジタル）`),
      h('ul', { class: 'eplist' }, d.relatedArticles.map((a) => { const ids = articleMap.get(normUrl(a.url)) || []; return h('li', {}, h('a', { href: a.url, target: '_blank', rel: 'noopener' }, (a.title || a.url) + ' ↗'), ids.length >= 2 ? h('button', { type: 'button', class: 'chip artcount', onclick: () => select({ type: 'article', url: normUrl(a.url), title: a.title, href: a.url }) }, `この記事を紹介した回 ${ids.length}`) : null); })),
      h('p', { class: 'note' }, '見出しの言葉も星図の言葉に入っています。')) : null].filter(Boolean));
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
D.eps.forEach((e, i) => { if (isEdge(i)) return; const m = dispMain(i); catCount[m]++; const si = dispSub(i); if (m < HOLD && si >= 0) subCount[m][si]++; });
$('cats').replaceChildren(...[...Array(HOLD + 1).keys()].map((m) => {
  const subs = m < HOLD ? D.cats[m].subs.map((n, si) => [si, n, subCount[m][si]]).filter((x) => x[2]) : [];
  const ul = subs.length ? h('ul', { hidden: true }, subs.map(([si, n, c]) => h('li', {}, h('button', { type: 'button', 'data-m': m, 'data-s': si, onclick: () => select({ type: 'cat', id: m, sub: si }) }, n, h('span', { class: 'cnt' }, c))))) : null;
  const tw = h('span', { class: 'tw', 'aria-hidden': 'true' }, subs.length ? '▸' : '');
  const btn = h('button', { type: 'button', 'data-m': m, 'aria-expanded': subs.length ? 'false' : null, onclick: () => { if (ul) { const open = ul.hidden; ul.hidden = !open; btn.setAttribute('aria-expanded', String(open)); tw.textContent = open ? '▾' : '▸'; } if (mode !== 'cat') setMode('cat'); select({ type: 'cat', id: m }); } }, tw, h('span', { class: 'dot', style: `background:${catColor(m)}` }), catName(m), h('span', { class: 'cnt' }, catCount[m]));
  return h('li', {}, btn, ul);
}));

// ---- 星雲の一覧
$('formats').replaceChildren(...D.formats.map((n, k) => [k, n, D.fmt.reduce((a, f) => a + (f.some(([x]) => x === k) ? 1 : 0), 0)]).sort((a, b) => b[2] - a[2]).map(([k, n, c]) => h('li', {}, h('button', { type: 'button', 'data-f': k, 'aria-pressed': 'false', onclick: () => select({ type: 'fmt', id: k }) }, n, h('span', { class: 'cnt' }, c)))));
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

// ---- 分類の一覧（左の欄が出ない狭い画面用。詳細の欄に出す #441）
// 大分類を押す → 小分類が開き、その分野の回が星図で光る（欄は一覧のまま）。小分類か「くわしく」を選ぶ → その回の一覧へ
const narrowMQ = matchMedia('(max-width: 900px), (orientation: landscape) and (max-height: 520px)');
function lightCat(m) {
  const wasCat = mode === 'cat'; if (!wasCat) setMode('cat');
  hi = new Set(); D.eps.forEach((e, i) => { if (dispMain(i) === m && !isEdge(i)) hi.add(i); }); sel = { type: 'cat', id: m };
  const rg = D._regions.find((x) => x.m === m); if (wasCat && rg) focusAt(rg.x, rg.y, Math.min(W, H) / (rg.r * 2.6));
  draw(); live(`${catName(m)}。${hi.size}回が光っています`);
}
function renderIndex() {
  openDetail();
  const items = [...Array(HOLD + 1).keys()].map((m) => {
    const subs = m < HOLD ? D.cats[m].subs.map((n, si) => [si, n, subCount[m][si]]).filter((x) => x[2]) : [];
    const ul = h('ul', { class: 'idx-subs', hidden: true },
      h('li', {}, h('button', { type: 'button', class: 'chip gold', onclick: () => select({ type: 'cat', id: m }) }, m === HOLD ? '保留の回を見る' : `${catName(m)}をくわしく`, h('small', {}, catCount[m]))),
      subs.map(([si, n, c]) => h('li', {}, h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'cat', id: m, sub: si }) }, n, h('small', {}, c)))));
    const tw = h('span', { class: 'tw', 'aria-hidden': 'true' }, '▸');
    const btn = h('button', { type: 'button', 'aria-expanded': 'false', onclick: () => { const open = ul.hidden; ul.hidden = !open; btn.setAttribute('aria-expanded', String(open)); tw.textContent = open ? '▾' : '▸'; if (open) lightCat(m); } }, tw, h('span', { class: 'dot', style: `background:${catColor(m)}` }), catName(m), h('span', { class: 'cnt' }, catCount[m]));
    return h('li', {}, btn, ul);
  });
  const fmts = D.formats.map((n, k) => [k, n, D.fmt.reduce((a, f) => a + (f.some(([x]) => x === k) ? 1 : 0), 0)]).sort((a, b) => b[2] - a[2]);
  panel().replaceChildren(h('div', { class: 'idx' },
    h('p', { class: 'kind' }, '一覧'), h('h3', { class: 'hero' }, '分類の一覧'),
    h('p', { class: 'note' }, '20の大分類。押すと小分類が開き、その分野の回が星図で光ります。小分類を選ぶと、その回の一覧が出ます。'),
    h('p', { class: 'note' }, '星の並びはAIの試作です。人が動かした星はそのまま残ります。朝リスのみんなで、', h('a', { href: '../minna/', target: '_blank', rel: 'noopener' }, 'この宇宙を描きつづけませんか？')),
    h('ol', { class: 'cats idx-cats' }, items),
    h('div', { class: 'sec' }, h('h4', {}, '形式（回の作り）'), fmts.map(([k, n, c]) => h('button', { type: 'button', class: 'chip', onclick: () => select({ type: 'fmt', id: k }) }, n, h('small', {}, c))))));
  panelEl.scrollTop = 0; live('分類の一覧を開きました');
}
$('listOpen').addEventListener('click', renderIndex);
// 縦のスマホでは上の帯が2〜3段に折り返すので、その高さの下に一覧ボタンと「全体」ボタンを置く
const topH = () => document.documentElement.style.setProperty('--top-h', Math.round(document.querySelector('header.top').getBoundingClientRect().bottom) + 'px');
topH(); addEventListener('resize', topH);
// 狭い画面では「分類」ボタンを押すと一覧も開く
document.querySelector('.modes [data-mode="cat"]')?.addEventListener('click', () => { if (narrowMQ.matches) renderIndex(); });
document.getElementById('artList').addEventListener('click', renderArticleList);
document.getElementById('sortStart').addEventListener('click', nextHold);

// ---- 開始
new ResizeObserver(resize).observe(canvas);
resize(); fit();
$('loading').remove(); showProgress();
function fromHash(e) {
  const first = e === 'load';   // 最初の読み込みでは、分類を選んだ状態でも寄らずに宇宙の全体を見せる（光らせるだけ）
  const m = location.hash.match(/^#(pl|[ewpncf])=(.+)$/); if (!m) return;
  const v = decodeURIComponent(m[2]);
  if (m[1] === 'e' && epIdx.has(v)) select({ type: 'ep', id: epIdx.get(v) }, { push: false });
  if (m[1] === 'w' && termIdxByKey.has(norm(v))) select({ type: 'word', id: termIdxByKey.get(norm(v)) }, { push: false });
  if (m[1] === 'p') { const k = D.persons.findIndex((p) => p[0] === v); if (k >= 0) select({ type: 'person', id: k }, { push: false }); }
  if (m[1] === 'f' && D.formats[+v]) select({ type: 'fmt', id: +v }, { push: false });
  if (m[1] === 'n' && SHOW_NEB && D.comms[+v]) select({ type: 'neb', id: +v }, { push: false });
  if (m[1] === 'pl') { const id = v === 'JP' ? 'JP' : +v; if (id === 'JP' || PL[id]) select({ type: 'place', id }, { push: false }); }
  if (m[1] === 'c' && SHOW_CLS) { const [a, b] = v.split('.').map(Number); if (a >= 0 && a <= HOLD) select({ type: 'cat', id: a, sub: Number.isFinite(b) ? b : -1 }, { push: false, fly: !first }); }
}
fromHash('load'); addEventListener('hashchange', fromHash);
// 左上の「朝ポキの宇宙」で最初の画面へ戻る（選択を外し、案内を出し、最初の表示で全体を映す）
document.getElementById('home').addEventListener('click', (ev) => {
  ev.preventDefault();
  sel = null; hi = null; hoverEp = -1;
  panel().replaceChildren(INTRO);
  document.querySelectorAll('.legend button[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  history.replaceState(null, '', location.pathname + location.search);
  if (mode !== START_MODE) setMode(START_MODE); else { draw(); fit(); }
  live('最初の画面に戻りました');
});
if (!location.hash) setTimeout(() => hintsFor(mode), 1200);
window.__uchuPerf = { loadMs: Math.round(tLoad), readyMs: Math.round(performance.now() - t0), episodes: NE, terms: D.terms.length };

// ふちの星の説明（初めての時だけ。10分出して×で閉じられる）
if (FUCHI && !seen('fuchi-intro')) { toast('fuchi-intro', '分類がまだ決まっていない回は、近そうな分類のまわりに薄い星で散らしています。選ぶと「〇〇のあたり？」と出ます。'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 10 * 60 * 1000); }

// ---- 軽い立体感（?3d）の動き: マウスの位置・スマホの傾き。何も触らない時はゆっくり揺らす
if (D3) {
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; tilt.tx = clamp((e.offsetX / W - 0.5) * 2); tilt.ty = clamp((e.offsetY / H - 0.5) * 2); tilt.last = performance.now(); });
  let gotTilt = false;
  const onTilt = (e) => { if (e.gamma == null) return; gotTilt = true; tilt.tx = clamp(e.gamma / 25); tilt.ty = clamp((e.beta - 40) / 25); tilt.last = performance.now(); };
  addEventListener('deviceorientation', onTilt);
  // 指でなぞっても傾く（傾きが使えない端末・ブラウザでも立体感が分かるように）
  let lastTouch = null;
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') return; if (lastTouch) { tilt.tx = clamp(tilt.tx + (e.offsetX - lastTouch.x) / 60); tilt.ty = clamp(tilt.ty + (e.offsetY - lastTouch.y) / 60); tilt.last = performance.now(); } lastTouch = { x: e.offsetX, y: e.offsetY }; });
  canvas.addEventListener('pointerup', () => { lastTouch = null; }); canvas.addEventListener('pointercancel', () => { lastTouch = null; });
  // スマホ: 「傾きで動かす」ボタン。iPhone はボタンを押した時にだけ傾きの許可を尋ねられる（Chrome・Safari とも）
  if (matchMedia('(pointer: coarse)').matches) {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'tiltBtn'; b.textContent = '📱傾き'; b.setAttribute('aria-label', 'スマホの傾きで星を動かす');
    $('zfit').before(b);
    b.addEventListener('click', async () => {
      try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { toast('tilt-no-' + Date.now(), '傾きの使用が許可されませんでした。指でなぞっても星が動きます。'); return; } } } catch (err) { toast('tilt-err-' + Date.now(), '傾きを使えませんでした。指でなぞっても星が動きます。'); return; }
      b.setAttribute('aria-pressed', 'true'); b.textContent = '📱傾き中';
      setTimeout(() => { if (!gotTilt) toast('tilt-none-' + Date.now(), 'この端末・ブラウザでは傾きが届きませんでした。指でなぞっても星が動きます。'); }, 1500);
    });
  }
  let prev = 0;
  const tick = (t) => {
    if (!document.hidden && t - prev > 33) {   // 30コマ/秒まで
      prev = t;
      if (t - tilt.last > 2500) { tilt.tx = Math.sin(t / 2600) * 0.7; tilt.ty = Math.cos(t / 3700) * 0.4; }
      const dx = tilt.tx - tilt.x, dy = tilt.ty - tilt.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.002) { tilt.x += dx * 0.08; tilt.y += dy * 0.08; render(); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  toast('d3-' + Date.now(), D3_BY === 'kaku' ? '立体のテスト表示：手前ほど分類が確かな回、奥ほどあいまいな回。マウスを動かすか、スマホを傾けてみてください。' : '立体のテスト表示：手前ほど新しい回、奥ほど古い回。マウスを動かすか、スマホを傾けてみてください。');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 10 * 60 * 1000);
}

// ---- 航海（?kokai）: 自分がゆっくり漂う。なぞった向きへ進む。左下に小さな地図と、いちばん近い星群の名前
const voyage = { vx: 0, vy: 0, cruise: 22, last: 0, paused: false, rot: false, inside: false };
function worldBounds() { const R = D._regions || []; let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const rg of R) { a = Math.min(a, rg.x - rg.r); b = Math.max(b, rg.x + rg.r); c = Math.min(c, rg.y - rg.r); d = Math.max(d, rg.y + rg.r); } return { a, b, c, d }; }
function drawVoyageHud() {
  const B = worldBounds(); if (!Number.isFinite(B.a)) return;
  const S = 112, pad = 12, x0 = pad, y0 = (phonePortrait.matches ? H - $('panel').offsetHeight : H) - S - pad - 18;
  const sc = Math.min(S / (B.b - B.a), S / (B.d - B.c)), mx = (x) => x0 + (x - B.a) * sc, my = (y) => y0 + (y - B.c) * sc;
  ctx.globalAlpha = 1; ctx.fillStyle = '#0b1222cc'; ctx.strokeStyle = '#2c345a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - 6, y0 - 6, S + 12, S + 12, 10) : ctx.rect(x0 - 6, y0 - 6, S + 12, S + 12); ctx.fill(); ctx.stroke();
  for (const rg of D._regions) { ctx.fillStyle = rg.m === HOLD ? '#ece6ff' : `hsl(${D.cats[rg.m].hue} 70% 60% / .75)`; ctx.beginPath(); ctx.arc(mx(rg.x), my(rg.y), Math.max(2, rg.r * sc), 0, Math.PI * 2); ctx.fill(); }
  if (voyage.inside) {   // 中に入った時は、いる場所の点と進む向きの矢印
    const fx = -Math.sin(cam.hd), fy = -Math.cos(cam.hd), cx0 = mx(view.x), cy0 = my(view.y);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx0, cy0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + fx * 14, cy0 + fy * 14); ctx.stroke();
  } else { const vw = W / view.k, vh = H / view.k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(mx(view.x - vw / 2), my(view.y - vh / 2), Math.max(3, vw * sc), Math.max(3, vh * sc)); }
  // いちばん近い星群
  let best = null, bd = Infinity; for (const rg of D._regions) { const d = Math.hypot(rg.x - view.x, rg.y - view.y) - rg.r; if (d < bd) { bd = d; best = rg; } }
  if (best) { ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#cfd6f2'; ctx.fillText(bd <= 0 ? `いま：${catName(best.m)}のなか` : `いま：${catName(best.m)}の近く`, x0 - 4, y0 + S + 20); }
}
if (SHOW_CLS) {
  let fitK = 0, lastView = null, prevT = 0;
  // ?kokai で開いた時は、少し寄ったところから旅を始める
  if (KOKAI_URL) setTimeout(() => { fitK = view.k; animateTo(view.x, view.y, view.k * 2.6, 1200); }, 600);
  // 操作ボタン: ⏸止まる／▶進む、🎥回す（なぞると視点が回る）、⟲正面
  const mk = (id, text, label) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = text; b.setAttribute('aria-label', label); $('zfit').before(b); return b; };
  const bDim = mk('dimBtn', '3D', '3Dで見る（宇宙の中に入る）'), bPause = mk('voyPause', '⏸', '止まる'), bIn = mk('voyIn', '🛸', '中に入る'), bRot = mk('voyRot', '🎥', '視点を回す'), bFront = mk('voyFront', '⟲', '正面から見る');
  const voyBtns = [bPause, bIn, bRot, bFront];
  const showVoy = (on) => { voyBtns.forEach((b) => { b.hidden = !on; }); bDim.setAttribute('aria-pressed', String(on)); bDim.title = on ? '2Dに戻る' : '3Dで見る'; };
  showVoy(KOKAI);
  const camTo = (to, ms = 900) => { const fr = { ...cam }, t0 = performance.now(); const st = (t) => { const q = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - q, 3); for (const k of ['yaw', 'pitch', 'hd']) cam[k] = fr[k] + ((to[k] ?? fr[k]) - fr[k]) * e; render(); if (q < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); };
  bIn.addEventListener('click', () => { voyage.inside = !voyage.inside; bIn.setAttribute('aria-pressed', String(voyage.inside)); if (voyage.inside) { voyage.rot = false; bRot.setAttribute('aria-pressed', 'false'); camTo({ yaw: 0, pitch: 1.12 }); setPaused(false); toast('in-' + Date.now(), '中に入りました：前へゆっくり進みます。横になぞると向きを変え、縦になぞると前後に進みます。⟲で外に出て正面に戻ります。'); } else camTo({ yaw: 0, pitch: 0, hd: 0 }); });
  const setPaused = (v) => { voyage.paused = v; bPause.textContent = v ? '▶' : '⏸'; bPause.setAttribute('aria-label', v ? '進む' : '止まる'); bPause.setAttribute('aria-pressed', String(v)); };
  bPause.addEventListener('click', () => setPaused(!voyage.paused));
  bRot.addEventListener('click', () => { voyage.rot = !voyage.rot; if (voyage.rot && voyage.inside) { voyage.inside = false; bIn.setAttribute('aria-pressed', 'false'); } bRot.setAttribute('aria-pressed', String(voyage.rot)); if (voyage.rot) { setPaused(true); toast('rot-' + Date.now(), '視点を回すモード：横になぞると横から、縦になぞると斜め・真上から見られます。もう一度 🎥 で戻ります。'); } });
  bFront.addEventListener('click', () => { voyage.inside = false; bIn.setAttribute('aria-pressed', 'false'); camTo({ yaw: 0, pitch: 0, hd: 0 }, 600); });
  $('zfit').addEventListener('click', () => setPaused(true));   // 「全体」で止まって引きの宇宙へ
  // 2D／3D の切り替え。3D は宇宙の中に入った（🛸）状態から始め、2D は今までの表示に戻す
  bDim.addEventListener('click', () => {
    if (!KOKAI) {
      if (mode !== 'cat') setMode('cat');
      KOKAI = true; showVoy(true); voyage.rot = false; bRot.setAttribute('aria-pressed', 'false'); voyage.inside = true; bIn.setAttribute('aria-pressed', 'true');
      cam.yaw = 0; cam.pitch = 0; cam.hd = 0; camTo({ yaw: 0, pitch: 1.12, hd: 0 }); setPaused(false);
      if (!seen('d3-intro')) { toast('d3-intro', '3Dにしました：宇宙の中をゆっくり進みます。横になぞると向きを変え、縦になぞると前後に進みます。⏸で止まる、🎥で回す、⟲で正面。「3D」をもう一度押すと2Dに戻ります。'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 10 * 60 * 1000); }
    } else {
      KOKAI = false; showVoy(false); voyage.inside = false; voyage.rot = false; bIn.setAttribute('aria-pressed', 'false'); bRot.setAttribute('aria-pressed', 'false'); setPaused(true);
      cam.yaw = 0; cam.pitch = 0; cam.hd = 0; render();
    }
  });
  canvas.addEventListener('pointerdown', () => { voyage.last = performance.now(); lastView = { x: view.x, y: view.y, t: performance.now() }; });
  const tick = (t) => {
    const dt = prevT ? Math.min(0.05, (t - prevT) / 1000) : 0; prevT = t;
    if (KOKAI && !document.hidden && mode === 'cat' && dt) {
      const dragging = canvas.classList.contains('dragging');
      if (dragging && lastView && !voyage.rot && !voyage.inside) {   // なぞった向き＝進む向き（指の動きと逆に景色が流れる）
        const ddx = view.x - lastView.x, ddy = view.y - lastView.y, el = Math.max(0.016, (t - lastView.t) / 1000);
        if (Math.abs(ddx) + Math.abs(ddy) > 0) { voyage.vx = (ddx / el) * view.k; voyage.vy = (ddy / el) * view.k; }
        lastView = { x: view.x, y: view.y, t };
      } else if (!voyage.paused && !anim) {
        let sp = Math.hypot(voyage.vx, voyage.vy);
        if (sp < 1) { voyage.vx = voyage.cruise; voyage.vy = voyage.cruise * 0.35; sp = Math.hypot(voyage.vx, voyage.vy); }   // 最初は右下へゆっくり
        const target = voyage.cruise, f = sp > target ? Math.pow(0.4, dt) : 1;   // 勢いはだんだん巡航の速さに戻る
        voyage.vx *= f; voyage.vy *= f; sp = Math.hypot(voyage.vx, voyage.vy); if (sp < target) { voyage.vx *= target / sp; voyage.vy *= target / sp; }
        // 宇宙の外に出そうになったら、ゆっくり向きを変えて戻る（迷子防止）
        const B = worldBounds(), m = 80;
        if (view.x < B.a - m && voyage.vx < 0) voyage.vx += 60 * dt * 3; if (view.x > B.b + m && voyage.vx > 0) voyage.vx -= 60 * dt * 3;
        if (view.y < B.c - m && voyage.vy < 0) voyage.vy += 60 * dt * 3; if (view.y > B.d + m && voyage.vy > 0) voyage.vy -= 60 * dt * 3;
        if (voyage.inside) { const sp2 = voyage.cruise * 1.0; /* 3Dでは星群の間を広げた分、見かけは速くなるので控えめに */ view.x += (-Math.sin(cam.hd) * sp2 / view.k) * dt; view.y += (-Math.cos(cam.hd) * sp2 / view.k) * dt; }   // 中では向いている方へ進む
        else { view.x += (voyage.vx / view.k) * dt; view.y += (voyage.vy / view.k) * dt; }
        render();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (KOKAI_URL) { toast('kokai-' + Date.now(), '航海のテスト：あなたが宇宙をゆっくり漂っています。なぞるとその向きへ進みます。⏸で止まる、🛸で中に入る、🎥で視点を回す（横から・斜め・真上から）、⟲で正面に戻ります。左下の地図が現在地です。'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 10 * 60 * 1000); }
}

// 名付け募集星群の瞬き: 画面に映っている間だけ、1秒に10回ほど描き直す（電池を使いすぎない）
if (FUCHI) setInterval(() => {
  if (document.hidden || mode !== 'cat' || !D._regions) return;
  const rg = D._regions.find((r) => r.m === HOLD); if (!rg) return;
  const x = sx(rg.x), y = sy(rg.y), r = rg.r * view.k;
  if (x + r < 0 || x - r > W || y + r < 0 || y - r > H) return;
  draw();
}, 100);
