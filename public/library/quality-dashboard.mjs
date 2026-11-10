/** 日次品質ダッシュボード(純粋関数)。固定件数を合格条件にしない。分母は常に「その日の収蔵件数」。 */
const pct = (a, b) => (b ? +(100 * a / b).toFixed(1) : null);
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
/** episodes: [{id, pubDate(ms), collectedAt(ms), filledAt(ms|null), previewAt(ms|null), review, decision, approval, audit:[{key,tier,status,reason,kind?}]}] */
export function buildDashboard({episodes, runs = [], now, staleHours = 36, platforms = ['officialPage', 'listen', 'spotify', 'apple', 'amazon', 'pocketcasts', 'pody']}) {
  const req = e => e.audit.filter(a => a.tier === 'required' && a.status !== 'NOT_APPLICABLE');
  let reqTotal = 0, reqFilled = 0; const reasons = {};
  for (const e of episodes) for (const a of e.audit) {
    if (a.tier === 'required' && a.status !== 'NOT_APPLICABLE') { reqTotal++; if (a.status === 'FILLED') reqFilled++; }
    if (a.status !== 'FILLED') { const k = a.status + ':' + a.reason; reasons[k] = (reasons[k] || 0) + 1; }
  }
  const platform = {};
  for (const p of platforms) {
    const cells = episodes.map(e => e.audit.find(a => a.key === p)).filter(Boolean).filter(a => a.status !== 'NOT_APPLICABLE');
    platform[p] = {eligible: cells.length, found: cells.filter(a => a.status === 'FILLED').length, rate: pct(cells.filter(a => a.status === 'FILLED').length, cells.length)};
  }
  const hrs = (a, b) => (a != null && b != null ? +((a - b) / 3600e3).toFixed(2) : null);
  const toCollect = episodes.map(e => hrs(e.collectedAt, e.pubDate)).filter(x => x != null);
  const toFill = episodes.map(e => hrs(e.filledAt, e.pubDate)).filter(x => x != null);
  const toPreview = episodes.map(e => hrs(e.previewAt, e.pubDate)).filter(x => x != null);
  const lastOk = runs.filter(r => r.status === 'OK' || r.status === 'WARN').map(r => Date.parse(r.finishedAt)).sort((a, b) => b - a)[0] ?? null;
  const latest = Math.max(0, ...episodes.map(e => e.pubDate));
  const anomalies = [];
  if (lastOk == null || now - lastOk > staleHours * 3600e3) anomalies.push('PATROL_STALE');
  if (latest && now - latest > staleHours * 3600e3) anomalies.push('NO_NEW_EPISODE_OVER_THRESHOLD');
  if (runs.at(-1)?.status === 'STOP') anomalies.push('LAST_RUN_STOPPED');
  return {
    asOf: new Date(now).toISOString(), collected: episodes.length,
    fillRateRequired: {filled: reqFilled, total: reqTotal, percent: pct(reqFilled, reqTotal)},
    notFilledReasons: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1])),
    platformDiscovery: platform,
    latencyHours: {pubToCollected: {p50: q(toCollect, .5), max: q(toCollect, 1)}, pubToFilled: {p50: q(toFill, .5), max: q(toFill, 1)}, pubToPreview: {p50: q(toPreview, .5), max: q(toPreview, 1)}},
    states: {unreviewed: episodes.filter(e => e.review === 'unreviewed').length, hold: episodes.filter(e => e.decision === '保留').length, excluded: episodes.filter(e => ['対象外', '除外'].includes(e.decision)).length,
      approvedPublished: episodes.filter(e => e.review === 'reviewed' && e.decision === '対象' && e.approval === 'approved').length},
    lastSuccessfulPatrol: lastOk ? new Date(lastOk).toISOString() : null, anomalies,
  };
}
