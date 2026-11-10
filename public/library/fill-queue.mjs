/** 補完キュー: 新着最優先 → 期限到来の再試行 → 過去空欄のバックフィル。API予算・429 Retry-After・5xxバックオフ・認可エラーで安全に停止し、
 * state(チェックポイント)から再開できる。探索そのものは resolvers[platform](task) を注入(本番は #281 の resolveOne を接続。ここは通信しない)。 */
const HOUR = 3600e3, DAY = 24 * HOUR;
export class ApiError extends Error { constructor(kind, status, retryAfterSec) { super(kind + ':' + status); this.kind = kind; this.status = status; this.retryAfterSec = retryAfterSec ?? null; } }
export const retryDelayMs = ({status, ageMs, attempts = 0}) => {
  if (status === 'NOT_FOUND' || status === 'HOLD') return ageMs < DAY ? 2 * HOUR : ageMs < 60 * DAY ? DAY : 7 * DAY; // 新着は当日複数回、古いほど間隔を空ける
  return Math.min(24 * HOUR, 5 * 60e3 * 2 ** attempts); // 5xx/一時障害: 指数バックオフ(上限24h)
};
export const tier = (task, now) => (now - task.pubDate < DAY ? 0 : task.retryDue ? 1 : 2);
export function planQueue(tasks, state, now, {backfillLimit = 50} = {}) {
  const due = tasks.filter(t => (state.tasks?.[t.key]?.nextTryAt ?? 0) <= now && state.tasks?.[t.key]?.lastStatus !== 'VERIFIED');
  due.forEach(t => { t.retryDue = !!state.tasks?.[t.key]; });
  due.sort((a, b) => tier(a, now) - tier(b, now) || b.pubDate - a.pubDate || a.key.localeCompare(b.key));
  let back = 0;
  return due.filter(t => tier(t, now) < 2 || back++ < backfillLimit); // バックフィルは1サイクルの上限つき(新着を押し出さない)
}
/** tasks: [{key:'EP-00001|spotify', epId, platform, pubDate(ms), input}] */
export async function runCycle({tasks, state = {}, resolvers, now, budget = 100, backfillLimit = 50}) {
  const st = {cooldown: {...(state.cooldown || {})}, tasks: {...(state.tasks || {})}, consecutive5xx: {...(state.consecutive5xx || {})}};
  const queue = planQueue(tasks, st, now, {backfillLimit}), results = [], skipped = [];
  let calls = 0, stopped = null;
  for (const t of queue) {
    if ((st.cooldown[t.platform] || 0) > now) { skipped.push({key: t.key, reason: 'COOLDOWN'}); continue; } // 同一サービスへ一斉に叩かない
    if (!resolvers[t.platform]) { skipped.push({key: t.key, reason: 'NO_VERIFIED_ROUTE'}); results.push({key: t.key, epId: t.epId, platform: t.platform, status: 'HOLD', reason: 'NO_VERIFIED_ROUTE'}); continue; }
    if (calls >= budget) { stopped = 'BUDGET_EXHAUSTED'; break; }
    calls++;
    const prev = st.tasks[t.key] || {attempts: 0};
    try {
      const r = await resolvers[t.platform](t.input);
      st.consecutive5xx[t.platform] = 0;
      st.tasks[t.key] = {attempts: prev.attempts + 1, lastStatus: r.status, lastCheckedAt: now, nextTryAt: r.status === 'VERIFIED' ? Infinity : now + retryDelayMs({status: r.status, ageMs: now - t.pubDate})};
      results.push({key: t.key, epId: t.epId, platform: t.platform, ...r, checkedAt: now});
    } catch (e) {
      const k = e.kind || 'ERROR';
      if (k === '429') { st.cooldown[t.platform] = now + Math.max(1, e.retryAfterSec ?? 60) * 1000; st.tasks[t.key] = {...prev, lastStatus: 'ERROR:429', nextTryAt: st.cooldown[t.platform]}; results.push({key: t.key, epId: t.epId, platform: t.platform, status: 'ERROR', reason: 'HTTP_429', retryAfterSec: e.retryAfterSec}); }
      else if (k === 'AUTH') { st.cooldown[t.platform] = now + 6 * HOUR; st.tasks[t.key] = {...prev, lastStatus: 'ERROR:AUTH', nextTryAt: st.cooldown[t.platform]}; results.push({key: t.key, epId: t.epId, platform: t.platform, status: 'ERROR', reason: 'AUTH_' + e.status}); }
      else { // 5xx/タイムアウト
        st.consecutive5xx[t.platform] = (st.consecutive5xx[t.platform] || 0) + 1;
        st.tasks[t.key] = {attempts: prev.attempts + 1, lastStatus: 'ERROR:TRANSIENT', nextTryAt: now + retryDelayMs({status: 'ERROR', attempts: prev.attempts})};
        results.push({key: t.key, epId: t.epId, platform: t.platform, status: 'ERROR', reason: 'TRANSIENT_' + (e.status || 'NET')});
        if (st.consecutive5xx[t.platform] >= 3) { st.cooldown[t.platform] = now + HOUR; stopped = stopped || null; } // 3連続で当該サービスを1時間休止
      }
    }
  }
  return {results, skipped, calls, stopped, state: st, remaining: Math.max(0, queue.length - results.length - skipped.length)};
}
