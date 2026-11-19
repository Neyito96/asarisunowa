#!/usr/bin/env node
// 朝ポキの宇宙: 地図の形を軽くして public/uchu/data/ に置く（一度だけ回す。入力はリポジトリ外の取得物）
//   node scripts/uchu/build-geo.mjs <world.geo.json> <japan.geojson>
// 世界: johan/world.geo.json（Natural Earth 由来・UNLICENSE＝パブリックドメイン）
// 日本: dataofjapan/land の japan.geojson（出典: 地球地図日本〈国土地理院〉。非営利は出典明記で利用可）
import fs from 'node:fs';
import path from 'node:path';

const [worldPath, japanPath] = process.argv.slice(2);
if (!worldPath || !japanPath) { console.error('usage: build-geo.mjs <world.geo.json> <japan.geojson>'); process.exit(1); }
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../public/uchu/data');

// Douglas-Peucker（度単位）
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let idx = -1, md = 0;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; idx = i; } }
    if (md > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// 閉じた輪は始点と終点が同じなので、始点から最も遠い点で2つに分けて簡略化する
function simplifyRing(r, tol) {
  let far = 0, fd = 0; r.forEach((p, i) => { const d = Math.hypot(p[0] - r[0][0], p[1] - r[0][1]); if (d > fd) { fd = d; far = i; } });
  if (far === 0) return r;
  return simplify(r.slice(0, far + 1), tol).concat(simplify(r.slice(far), tol).slice(1));
}
const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(s / 2); };
const q = (n, d) => Math.round(n * 10 ** d) / 10 ** d;   // 小数 d 桁に丸める
function shrink(geo, tol, minArea, dec) {
  const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
  const out = [];
  for (const poly of polys) { const outer = poly[0]; if (area(outer) < minArea) continue; const s = simplifyRing(outer, tol); if (s.length >= 4) out.push(s.flatMap(([x, y]) => [q(x, dec), q(y, dec)])); }
  return out;
}
const world = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
const w = { source: 'johan/world.geo.json (Natural Earth, public domain)', features: world.features.filter((f) => f.id !== 'ATA').map((f) => ({ id: f.id, n: f.properties.name, p: shrink(f.geometry, 0.15, 0.05, 2) })) };
const japan = JSON.parse(fs.readFileSync(japanPath, 'utf8'));
const j = { source: '地球地図日本（国土地理院）を加工 / dataofjapan/land', features: japan.features.map((f) => ({ id: f.properties.id, n: f.properties.nam_ja, p: shrink(f.geometry, 0.012, 0.0008, 3) })) };
fs.writeFileSync(path.join(OUT, 'geo-world.json'), JSON.stringify(w));
fs.writeFileSync(path.join(OUT, 'geo-japan.json'), JSON.stringify(j));
for (const f of ['geo-world.json', 'geo-japan.json']) console.log(f, Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + 'KB');
