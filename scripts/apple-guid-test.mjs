#!/usr/bin/env node
// Apple GUID照合の READ_ONLY 実API試験（GAS版 gas/apple-guid-test/AppleGuidTest.js の判定コードをそのまま読み込んで使う）。
// シート・台帳へは一切書かない。入力は docs/apple-urlbot/guid-sample30.json（司令塔がV2から抽出した事前期待値）。
// usage: node scripts/apple-guid-test.mjs <sample.json> <n(1-10)> [out.json] [prev5.json]
import fs from 'node:fs'; import vm from 'node:vm';
// リポジトリは "type":"module" のため require できない。GAS配布ファイルを vm でそのまま評価して関数を取り出す
const G = vm.createContext({}); vm.runInContext(fs.readFileSync(new URL('../gas/apple-guid-test/AppleGuidTest.js', import.meta.url), 'utf8'), G);
const [samplePath, nArg, outPath, prevPath] = process.argv.slice(2);
const n = Number(nArg); if (!samplePath || !(n >= 1 && n <= G.AGT_CFG.maxN)) { console.error('usage: <sample.json> <n 1-10> [out.json] [prev5.json]'); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(samplePath, 'utf8')).rows.map((r, i) => ({ rowIndex: i + 2, appleUrl: '', ...r }));
const prev = prevPath ? JSON.parse(fs.readFileSync(prevPath, 'utf8')).results.map((r) => r.epId) : [];
const cache = new Map(); const sab = new Int32Array(new SharedArrayBuffer(4));
const deps = {
  // 同期APIのGASに合わせ、Nodeでは子プロセスなしで同期化できないため fetch は事前に非同期で行う（下の prefetch）
  fetch: (u) => { const r = pre.get(u); if (!r) throw new Error('NOT_PREFETCHED'); if (r.err) throw new Error(r.err); return r; },
  sleep: (ms) => Atomics.wait(sab, 0, 0, Math.min(ms, 50)), cacheGet: (k) => cache.get(k) || null, cachePut: (k, v) => cache.set(k, v)
};
// 事前取得: agtEvaluate_ が照会する番組だけを、間隔1.5秒・429/5xxは5秒後に1回再試行で取得（GAS版と同じ方針）。試行回数を別に数える
const sel = G.agtSelect_(rows, n).picked; const ids = [...new Set(sel.map((r) => r.collectionId))]; const pre = new Map(); const netLog = [];
for (const id of ids) {
  const url = `https://itunes.apple.com/lookup?id=${id}&media=podcast&entity=podcastEpisode&country=${G.AGT_CFG.country}&limit=${G.AGT_CFG.lookupLimit}`;
  for (let a = 0; a < 2; a++) {
    await new Promise((s) => setTimeout(s, a ? 5000 : 1500));
    try { const res = await fetch(url, { signal: AbortSignal.timeout(20000) }); const text = await res.text(); netLog.push({ id, attempt: a + 1, http: res.status, bytes: text.length }); pre.set(url, { code: res.status, text });
      if (!(res.status === 429 || res.status >= 500)) break; } catch (e) { netLog.push({ id, attempt: a + 1, error: String(e.message) }); pre.set(url, { err: String(e.message) }); }
  }
}
const ev = G.agtEvaluate_(rows, n, deps, prev);
const out = { mode: 'READ_ONLY_REAL_API', ranAt: new Date().toISOString(), n, network: { requests: netLog.length, log: netLog }, ...ev };
if (outPath) fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ n, counts: ev.counts, api: ev.api, network: netLog.length, epIds: ev.results.map((r) => `${r.epId}:${r.status}`) }));
