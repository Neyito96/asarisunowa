// 代表EPでの比較実験（READ ONLY・write:false）。GitHub Actions 上で実行（開発サンドボックスは外部通信が遮断されているため）。
// 使い方: node scripts/probe-link-services.mjs docs/release/2026-11-10-link-probe-sample.json [out.json]
import fs from 'node:fs';
import { appleEpisodesFromLookup, matchApple, tally, POLICY, isEpisodeUrl } from '../public/library/link-discovery.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, { json = false, text = false } = {}) {
  for (let i = 0; i <= POLICY.maxRetries; i++) {
    await sleep(POLICY.minDelayMs);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': POLICY.userAgent, accept: json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(20000) });
      if (POLICY.retryOn.includes(res.status) && i < POLICY.maxRetries) { await sleep(POLICY.backoffMs[i]); continue; }
      const out = { status: res.status, finalUrl: res.url, type: res.headers.get('content-type') || '' };
      if (json && res.ok) out.json = await res.json();
      else if (text && res.ok) out.text = (await res.text()).slice(0, 400000);
      else await res.body?.cancel();
      return out;
    } catch (e) { if (i === POLICY.maxRetries) return { status: 0, error: String(e.message || e).slice(0, 120) }; await sleep(POLICY.backoffMs[i] || 5000); }
  }
}

const sample = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const report = { startedAt: new Date().toISOString(), apple: {}, liveness: [], listen: {}, pody: {}, tally: {} };
const rows = [];

// 1) Apple: 番組IDごとに lookup（上限200件）。episodeGuid が台帳の外部IDと一致するかで強照合。
for (const [show, id] of Object.entries(sample.appleShowIds)) {
  const r = await get(`https://itunes.apple.com/lookup?id=${id}&country=jp&media=podcast&entity=podcastEpisode&limit=200`, { json: true });
  const eps = r.json ? appleEpisodesFromLookup(r.json) : [];
  const picks = sample.samples.filter((s) => s.show === show).map((s) => ({ epId: s.epId, show: s.show, title: s.title, guid: s.guid, known: s.known, date: (s.date || '').replace(/\//g, '-').split(' ')[0].replace(/-(\d)(?=-|$)/g, '-0$1') }));
  const m = matchApple(picks, eps);
  rows.push(...m);
  report.apple[show] = { showId: id, httpStatus: r.status, error: r.error || '', returnedEpisodes: eps.length, prodEpisodes: sample.prodShowCounts[show], urlShapeOk: eps.filter((e) => e.urlOk).length, withGuid: eps.filter((e) => e.guid).length, results: m.map((x) => ({ epId: x.epId, state: x.state, basis: x.basis })) };
}
report.tally = tally(rows);

// 2) 既知URLの実在確認（各サービス最大6件）
const per = {};
for (const s of sample.samples) for (const [svc, url] of Object.entries(s.known)) {
  if (!url) continue;
  per[svc] = (per[svc] || 0) + 1; if (per[svc] > 6) continue;
  const r = await get(url);
  report.liveness.push({ epId: s.epId, service: svc, shapeOk: isEpisodeUrl(svc, url), status: r.status, finalHost: r.finalUrl ? new URL(r.finalUrl).host : '', error: r.error || '' });
}

// 3) LISTEN: 番組ページ（番組コードは台帳既知の4件）
for (const code of ['tvzppbdm', 'pkvcigu2', 'yhap2rfc', 'gqkauao0']) {
  const r = await get(`https://listen.style/p/${code}`, { text: true });
  const links = r.text ? [...new Set([...r.text.matchAll(new RegExp(`/p/${code}/([a-z0-9]+)`, 'gi'))].map((m) => m[1]))] : [];
  report.listen[code] = { status: r.status, episodeLinksFound: links.length, error: r.error || '' };
}

// 4) Pody: 例ページと番組ページ
for (const u of ['https://pody.jp/player/woMdDOpTDIxhqS4HtAsS/jfQTfPODBWbO1PRK0WOS', 'https://pody.jp/player/woMdDOpTDIxhqS4HtAsS']) {
  const r = await get(u, { text: true });
  const title = r.text ? (r.text.match(/<title>([^<]*)<\/title>/) || [])[1] || '' : '';
  const links = r.text ? new Set([...r.text.matchAll(/\/player\/woMdDOpTDIxhqS4HtAsS\/([A-Za-z0-9]+)/g)].map((m) => m[1])).size : 0;
  report.pody[u] = { status: r.status, title: title.slice(0, 80), episodeLinksFound: links, error: r.error || '' };
}
report.finishedAt = new Date().toISOString();
const out = process.argv[3] || 'probe-report.json';
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
