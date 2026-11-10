/** 日次パイプライン: 新着検出 → 収蔵(仮ID) → 台帳突合(READ_ONLY) → 空欄監査 → 補完(非破壊) → 非公開プレビュー差分 → 記録 → COMMIT。
 * 通信・永続化は注入(fetch結果xml, resolvers, store, persist)。COMMITが成功した時だけ persist する=途中失敗は何も残らず、再実行しても重複しない。 */
import {parseFeedStrict, XmlError} from './rss-parse.mjs';
import {ingest, reconcileEpIds, recordPatrol, runRecord, isPublishable} from './daily-ingest.mjs';
import {auditRow, proposals, applyProposals} from './gap-audit.mjs';
import {runCycle} from './fill-queue.mjs';
import {acquire, commit, release} from './journal-lease.mjs';
const PLATFORM_COL = {listen: 10, spotify: 11, apple: 12};
const hash = s => { let h = 0x811c9dc5; for (const c of new TextEncoder().encode(s)) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const rowFrom = e => { const r = new Array(55).fill(''); r[0] = e.id; r[1] = e.show; r[2] = e.title; r[3] = e.pubDate; r[6] = e.guid; r[9] = e.link || ''; r[14] = e.audio || ''; r[21] = e.description || ''; return r; };

/** state: {registry, patrol, fill, rows(Map id->row), prevRun}. feeds: [{feedKey, expectedShow, http, xml, error}]. */
export async function runDailyDay({state, feeds, ledgerIndex = new Map(), resolvers = {}, store, owner, runId, nowMs, persist, budget = 200, showStats = () => ({})}) {
  const nowIso = new Date(nowMs).toISOString();
  const lease = acquire(store, owner, nowMs);
  if (!lease.ok) return {status: 'SKIPPED', reason: lease.reason};
  let registry = state.registry, patrol = state.patrol || {}; const items = [], parseErrors = [];
  for (const f of feeds) { // 巡回の成功/失敗と新着ゼロを区別して記録する
    if (f.error || f.http !== 200 || !f.xml) { patrol = recordPatrol(patrol, f.feedKey, {ok: false, http: f.http ?? null, error: f.error || 'FETCH_FAILED'}, nowIso); continue; }
    try {
      const p = parseFeedStrict(f.xml, {feedKey: f.feedKey, expectedShow: f.expectedShow, nowMs});
      patrol = recordPatrol(patrol, f.feedKey, {ok: p.ok, http: 200, itemCount: p.itemCount, error: p.problems.join(',') || null}, nowIso);
      items.push(...p.items); parseErrors.push(...p.quarantined);
    } catch (e) { patrol = recordPatrol(patrol, f.feedKey, {ok: false, http: 200, error: e instanceof XmlError ? e.code : 'PARSE_ERROR'}, nowIso); }
  }
  const ing = ingest(registry, items, {now: nowIso, runId}); registry = ing.registry; ing.result.quarantined.push(...parseErrors);
  registry = reconcileEpIds(registry, ledgerIndex).registry; // 採番せず読取結果で本番EP-IDへ
  // 作業行(既存の補完結果を保持)
  const rows = new Map(state.rows || []);
  for (const e of registry.episodes) if (!rows.has(e.id)) { const old = [...rows.keys()].find(k => rows.get(k)[6] === e.guid); rows.set(e.id, old ? rows.get(old) : rowFrom(e)); } // ID変換(TMP→EP)でも行を引継ぐ
  // 補完
  const tasks = [];
  for (const e of registry.episodes) { const r = rows.get(e.id), pub = Date.parse(e.pubDate); for (const [pl, c] of Object.entries(PLATFORM_COL)) if (!String(r[c]).trim()) tasks.push({key: e.id + '|' + pl, epId: e.id, platform: pl, pubDate: pub, input: {epId: e.id, guid: e.guid, show: e.show, title: e.title, publishedAt: e.pubDate}}); }
  const cyc = await runCycle({tasks, state: state.fill || {}, resolvers, now: nowMs, budget});
  const res = {}; for (const r of cyc.results) (res[r.epId] ||= {})[r.platform] = r;
  let work = rows; const log = [], previewPatch = [];
  for (const e of registry.episodes) {
    const r = work.get(e.id), st = showStats(e.show) || {};
    const au = auditRow(r, {now: nowMs, pubDate: Date.parse(e.pubDate), resolutions: res[e.id] || {}, official: {descRaw: e.description, audio: e.audio, guid: e.guid, pubDate: e.pubDate}, showEpisodeCount: st.n || 0, showCastBlankRate: st.blankRate || 0});
    const ap = applyProposals(work, proposals(e.id, r, au, {checkedAt: nowIso}), {appliedAt: nowIso}); work = ap.rows; log.push(...ap.log);
    if (ap.log.length) previewPatch.push({id: e.id, cols: ap.log.map(l => l.col), visibility: isPublishable(e) ? 'public_update_candidate' : 'private_preview'}); // 未レビューは非公開プレビューのみ
  }
  for (const id of ing.result.addedIds) previewPatch.unshift({id, cols: ['NEW_ARRIVAL'], visibility: 'private_preview'}); // 新着の登録そのものを即、非公開プレビューへ
  // 記録→COMMIT(成功時のみ永続化)
  const run = runRecord({registry, result: ing.result, now: nowIso, runId, prev: state.prevRun, patrol});
  run.fill = {calls: cyc.calls, stopped: cyc.stopped, cellWrites: log.length};
  const payloadHash = hash(JSON.stringify({ids: registry.episodes.map(e => e.id), run: [run.added, run.total]}));
  const c = commit(store, {owner, token: lease.token, runId, baseVersion: lease.baseVersion, payloadHash}, nowMs);
  if (!c.ok) return {status: 'NOT_COMMITTED', reason: c.reason, run};
  const next = {registry, patrol, fill: cyc.state, rows: work, prevRun: run};
  await persist?.(next, {run, previewPatch, log});
  release(store, {owner, token: lease.token});
  return {status: run.status, run, previewPatch, log, state: next, incompletePreviousRun: lease.incompletePreviousRun};
}
