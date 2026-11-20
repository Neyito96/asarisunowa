#!/usr/bin/env node
// #395 読み取り専用: 蔵の「SDGsを話そう」各回と、Pocket Casts の
// 「SDGsを話そう アーカイブ（2021.10-2026.6）」の回を、題名＋配信日（±2日）で対応づける。
// 新URLは Pocket Casts API が返した uuid からのみ組み立てる（推測しない）。台帳は変更しない。
import fs from 'node:fs';
import path from 'node:path';

const PODCAST = '6b348970-8060-013f-f21c-0affd341b2cf';
const API = `https://podcast-api.pocketcasts.com/podcast/full/${PODCAST}`;
const DETAILS = 'public/library/data/details';
const OUT = process.argv[2] || 'docs/audits/sdgs-archive/pocketcasts-map.json';

export const nz = (s) => String(s || '').normalize('NFKC')
  .replace(/[#＃]\s*\d+/g, '')
  .replace(/[\s「」『』（）()【】・、。!?！？〜~…"'“”\-—]/g, '');
const jstDay = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;

export function match(kura, pc) {
  const byTitle = new Map();
  for (const p of pc) { const k = nz(p.title); if (!byTitle.has(k)) byTitle.set(k, []); byTitle.get(k).push(p); }
  const matched = [], ambiguous = [], missing = [];
  for (const e of kura) {
    const d = String(e.date).slice(0, 10);
    let c = (byTitle.get(nz(e.title)) || []).filter((p) => dayDiff(jstDay(p.pub), d) <= 2);
    if (c.length > 1 && e.duration) c = c.filter((p) => Math.abs(p.dur - e.duration) <= 5);
    let how = 'title+date';
    if (!c.length && e.duration) {
      const f = pc.filter((p) => jstDay(p.pub) === d && Math.abs(p.dur - e.duration) <= 3);
      if (f.length === 1) { c = f; how = 'date+duration'; }
    }
    if (c.length === 1) {
      const p = c[0];
      matched.push({ id: e.id, date: d, title: e.title, kuraDuration: e.duration || 0,
        pcUuid: p.uuid, pcTitle: p.title, pcDuration: p.dur,
        durationDiff: e.duration ? p.dur - e.duration : null, how,
        newUrl: `https://pca.st/episode/${p.uuid}`,
        oldPcUrls: (e.links || []).filter((u) => /pca\.st|pocketcasts\.com/.test(u)) });
    } else (c.length ? ambiguous : missing).push({ id: e.id, date: d, title: e.title, candidates: c.map((p) => p.uuid) });
  }
  const used = new Map();
  for (const m of matched) used.set(m.pcUuid, (used.get(m.pcUuid) || 0) + 1);
  const duplicates = [...used].filter(([, n]) => n > 1).map(([u]) => u);
  return { matched, ambiguous, missing, duplicates };
}

async function main() {
  const kura = [];
  for (const f of fs.readdirSync(DETAILS).filter((f) => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DETAILS, f), 'utf8'));
    for (const e of Array.isArray(d) ? d : Object.values(d)) if (e && e.show === 'SDGsを話そう') kura.push(e);
  }
  const r = await fetch(API);
  if (!r.ok) throw new Error(`Pocket Casts API ${r.status}`);
  const j = await r.json();
  const pc = (j.podcast?.episodes || []).map((x) => ({ uuid: x.uuid, title: x.title, pub: x.published, dur: x.duration }));
  const res = match(kura, pc);
  const big = res.matched.filter((m) => m.durationDiff != null && Math.abs(m.durationDiff) > 5);
  const summary = { generatedAt: new Date().toISOString(), source: API, kuraEpisodes: kura.length,
    pocketCastsEpisodes: pc.length, matched: res.matched.length, ambiguous: res.ambiguous.length,
    missing: res.missing.length, duplicateTargets: res.duplicates.length,
    matchedByDateDuration: res.matched.filter((m) => m.how !== 'title+date').length,
    durationDiffOver5s: big.map((m) => ({ id: m.id, diff: m.durationDiff })) };
  // 疎通の抜き取り確認（新旧それぞれ最大30件）。403/429 は BLOCKED として扱い、正常とは数えない。
  const probe = async (u) => { try { const x = await fetch(u, { redirect: 'follow' }); return x.status; } catch { return 0; } };
  const pick = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
  const label = (s) => s >= 200 && s < 300 ? 'PASS' : (s === 403 || s === 429 || s === 0 ? 'BLOCKED' : 'FAIL');
  const tally = async (urls) => { const t = { PASS: 0, FAIL: 0, BLOCKED: 0 }; for (const u of urls) t[label(await probe(u))]++; return t; };
  summary.probeNew = await tally(pick(res.matched.map((m) => m.newUrl), 30));
  summary.probeOld = await tally(pick(res.matched.flatMap((m) => m.oldPcUrls.slice(0, 1)), 30));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ summary, ...res }, null, 1) + '\n');
  console.log(JSON.stringify(summary, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
