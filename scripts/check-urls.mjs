// 候補URLの到達性サンプル確認（HTTP応答のみ。再生可能性の確認ではない＝第41号の PAGE_REACHABLE 相当）。READ ONLY。
import fs from 'node:fs';
import { POLICY } from '../public/library/link-discovery.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { urls } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = []; const tally = {};
for (const [epId, url] of urls) {
  await sleep(POLICY.minDelayMs);
  const res = await fetch(url, { headers: { 'user-agent': POLICY.userAgent }, signal: AbortSignal.timeout(20000), redirect: 'follow' }).catch(() => null);
  const code = res ? res.status : 0;
  const html = res && res.ok ? await res.text() : '';
  const state = code === 200 ? 'PAGE_REACHABLE' : `HTTP_${code}`;
  tally[state] = (tally[state] || 0) + 1;
  out.push([epId, code, res ? res.url.replace(/\?.*/, '') === url ? 'same' : 'redirected' : '', html.length]);
}
fs.writeFileSync(process.argv[3], JSON.stringify({ tally, out }));
console.log(JSON.stringify(tally));
