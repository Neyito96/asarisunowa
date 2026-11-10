/** 日次品質ダッシュボード(純粋関数)。固定件数を合格条件にしない。分母は常に「その日の収蔵件数」。 */
const pct = (a, b) => (b ? +(100 * a / b).toFixed(1) : null);
const q = (arr, p) => { if (!arr.length) return null; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
/** episodes: [{id, pubDate(ms), collectedAt(ms), filledAt(ms|null), previewAt(ms|null), review, decision, approval, audit:[{key,tier,status,reason,kind?}]}] */
export function buildDashboard({episodes, runs = [], now, staleHours = 36, platforms = ['officialPage', 'listen', 'spotify', 'apple', 'amazon', 'pocketcasts', 'pody']}) {
  // 分母は N/A を縮めない: 必須列の全セル(未測定を除く)。明示根拠つき N/A は件数を別掲し、除外した率は参考値として併記する。
  let reqTotal = 0, reqFilled = 0, reqNA = 0, unmeasured = 0; const reasons = {}, columns = {};
  for (const e of episodes) for (const a of e.audit) {
    const col = columns[a.key] ||= {key: a.key, label: a.label, tier: a.tier, cells: 0, FILLED: 0, FILLABLE_FROM_OFFICIAL: 0, NOT_YET_PUBLISHED: 0, NOT_APPLICABLE: 0, HOLD: 0, UNMEASURED: 0, needsReview: 0};
    col.cells++; col[a.status] = (col[a.status] || 0) + 1; if (a.needsReview) col.needsReview++;
    if (a.status === 'UNMEASURED') { unmeasured++; continue; }
    if (a.tier === 'required') { reqTotal++; if (a.status === 'FILLED') reqFilled++; if (a.status === 'NOT_APPLICABLE') reqNA++; }
    if (a.status !== 'FILLED') { const k = a.status + ':' + a.reason; reasons[k] = (reasons[k] || 0) + 1; }
  }
  for (const c of Object.values(columns)) {
    const measured = c.cells - c.UNMEASURED;
    c.measured = measured > 0; c.coverage = c.measured ? 'measured' : '未測定';
    c.fillRate = measured ? pct(c.FILLED, measured) : null; // 未測定列は率を出さない
  }
  const platform = {};
  for (const p of platforms) {
    const cells = episodes.map(e => e.audit.find(a => a.key === p)).filter(Boolean);
    const m = cells.filter(a => a.status !== 'UNMEASURED'), found = m.filter(a => a.status === 'FILLED').length;
    // 取得済み/未発見・HOLD/サービス未提供(明示N/A)/探索未対応/取得待ち/未測定 を分けて数える
    platform[p] = {measured: m.length, unmeasured: cells.length - m.length, found, rate: pct(found, m.length),
      notProvided: m.filter(a => a.status === 'NOT_APPLICABLE').length, notImplemented: m.filter(a => a.reason === 'NO_VERIFIED_ROUTE').length,
      waiting: m.filter(a => a.status === 'NOT_YET_PUBLISHED').length, hold: m.filter(a => a.status === 'HOLD' && a.reason !== 'NO_VERIFIED_ROUTE').length};
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
    fillRateRequired: {filled: reqFilled, total: reqTotal, percent: pct(reqFilled, reqTotal), basis: '必須列のうち測定済みセル全件(N/Aも分母に含む)', notApplicableExplicit: reqNA, percentExcludingExplicitNA: pct(reqFilled, reqTotal - reqNA)},
    unmeasuredCells: unmeasured, columns: Object.values(columns), scopeNote: '率は「監査対象にした列」のみ。未測定列(入力に無い列)は率を出さず、全55列の充足率は主張しない。',
    notFilledReasons: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1])),
    platformDiscovery: platform,
    latencyHours: {pubToCollected: {p50: q(toCollect, .5), max: q(toCollect, 1)}, pubToFilled: {p50: q(toFill, .5), max: q(toFill, 1)}, pubToPreview: {p50: q(toPreview, .5), max: q(toPreview, 1)}},
    states: {unreviewed: episodes.filter(e => e.review === 'unreviewed').length, hold: episodes.filter(e => e.decision === '保留').length, excluded: episodes.filter(e => ['対象外', '除外'].includes(e.decision)).length,
      approvedPublished: episodes.filter(e => e.review === 'reviewed' && e.decision === '対象' && e.approval === 'approved').length},
    lastSuccessfulPatrol: lastOk ? new Date(lastOk).toISOString() : null, anomalies,
  };
}
