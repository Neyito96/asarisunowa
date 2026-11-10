// Apple lookup（番組ごと最大200件）の episodeGuid / 閲覧URL / 配信日を圧縮ダンプ。READ ONLY。
// 使い方: node scripts/dump-apple-episodes.mjs docs/release/2026-11-10-link-probe-sample.json out.json
import fs from 'node:fs';
import { appleEpisodesFromLookup, POLICY } from '../public/library/link-discovery.mjs';

const sample = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
for (const [show, id] of Object.entries(sample.appleShowIds)) {
  let json = null;
  for (let i = 0; i <= POLICY.maxRetries && !json; i++) {
    await sleep(POLICY.minDelayMs);
    const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=jp&media=podcast&entity=podcastEpisode&limit=200`, { headers: { 'user-agent': POLICY.userAgent }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (res && res.ok) json = await res.json(); else if (res && !POLICY.retryOn.includes(res.status)) break; else await sleep(POLICY.backoffMs[i] || 5000);
  }
  const eps = json ? appleEpisodesFromLookup(json).filter((e) => e.urlOk) : [];
  out[show] = { id, eps: eps.map((e) => [e.guid, e.url, e.date]) };
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log(Object.entries(out).map(([s, v]) => `${s}:${v.eps.length}`).join(' '));
