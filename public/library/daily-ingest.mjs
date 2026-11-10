/** 日次増分運用の中核(純粋関数・IOなし・外部APIなし)。
 * 総数は日々増える。5,848/5,945 は特定日のスナップショットであり固定目標ではない。
 * 状態は別々に持つ: custody(収蔵) / review(未レビュー|確認済み) / decision(対象|保留|対象外|除外) / approval(承認) / publication(公開)。
 * 掲載判定が未完了でも収蔵は止めない。人間の状態(review/decision/approval)は取り込みでは変更しない。 */
export const STATES = Object.freeze({review: ['unreviewed', 'reviewed'], decision: ['対象', '保留', '対象外', '除外', null], approval: ['approved', null]});
const EP = /^EP-(\d{5,})$/;
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
/** EP-IDはこのモジュールでは**採番しない**。本番EP-IDの採番権は既存の本番台帳側(repo外の ALIB_AUTO_tick が唯一writerと推定。未確認)にある。
 * COPY/ローカルは GUID から決定的な仮ID `TMP-xxxxxxxxxxxxxxxx` を付ける(EP-形式ではないので本番IDと混同できない)。本番IDは台帳の読取結果との突合(reconcileEpIds)でのみ得る。 */
export const isEpId = id => EP.test(id || '');
export function provisionalId(feedKey, guid) { // FNV-1a 64bit
  let h = 0xcbf29ce484222325n; for (const ch of new TextEncoder().encode(`${feedKey || ''}\u0000${guid}`)) { h ^= BigInt(ch); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; }
  return 'TMP-' + h.toString(16).padStart(16, '0');
}

// RSS解析は rss-parse.mjs(厳格XML解析・複合キー・不正値隔離)。旧の正規表現版は廃止。
const isoOf = d => { const t = Date.parse(d); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };

/** 日次取り込み(冪等)。registry は不変扱いで新しい registry を返す。
 * 照合キーは (feedKey, guid) の複合(別番組が同じGUIDを使っても衝突しない)。feedKey 未設定の旧レコードは同一番組名なら guid で採用。
 * EP-IDは作らない(仮ID TMP-…)。新着はO(N)で処理(全体最大ID走査なし)。 */
export function ingest(registry, feedItems, {now, runId} = {}) {
  const t = now || new Date().toISOString();
  const episodes = registry.episodes.map(e => ({...e}));
  const byKey = new Map(), legacy = new Map();
  for (const e of episodes) { if (e.guid) (e.feedKey ? byKey.set(e.feedKey + '\u0000' + e.guid, e) : legacy.set(e.guid, e)); }
  const idSet = new Set(episodes.map(e => e.id));
  const result = {fetched: feedItems.length, added: 0, updated: 0, unchanged: 0, quarantined: [], duplicatesInFeed: 0, addedIds: [], crossShowGuidCollisions: 0};
  const seen = new Set(), fresh = [], guidShows = new Map();
  for (const e of episodes) if (e.guid) (guidShows.get(e.guid) || guidShows.set(e.guid, new Set()).get(e.guid)).add(e.feedKey || e.show);
  for (const it of feedItems) {
    if (!it.guid) { result.quarantined.push({reason: 'NO_STRONG_ID', title: norm(it.title)}); continue; }
    const key = (it.feedKey || '') + '\u0000' + it.guid;
    if (seen.has(key)) { result.duplicatesInFeed++; continue; }
    seen.add(key);
    let cur = byKey.get(key);
    if (!cur) { const lg = legacy.get(it.guid); if (lg && (!it.show || norm(lg.show) === norm(it.show))) { cur = lg; if (it.feedKey) { lg.feedKey = it.feedKey; byKey.set(key, lg); } } }
    if (cur) {
      let changed = false;
      for (const [k, v] of [['audio', it.audio], ['link', it.link]]) if (v && !cur[k]) { cur[k] = v; changed = true; }
      cur.lastSeenAt = t; cur.absentRuns = 0; changed ? result.updated++ : result.unchanged++;
    } else fresh.push(it);
  }
  fresh.sort((a, b) => (a.pubDate || '').localeCompare(b.pubDate || '') || a.guid.localeCompare(b.guid));
  for (const it of fresh) {
    const id = provisionalId(it.feedKey, it.guid);
    if (idSet.has(id)) { result.quarantined.push({reason: 'PROVISIONAL_ID_COLLISION', title: norm(it.title)}); continue; } // ありえないが黙って上書きしない
    idSet.add(id);
    if ((guidShows.get(it.guid) || new Set()).size && !(guidShows.get(it.guid)).has(it.feedKey || norm(it.show))) result.crossShowGuidCollisions++;
    episodes.push({id, guid: it.guid, feedKey: it.feedKey || '', show: norm(it.show), title: norm(it.title), pubDate: it.pubDate ? new Date(it.pubDate).toISOString() : '', link: it.link, audio: it.audio, spotify: '',
      custody: 'collected', review: 'unreviewed', decision: null, approval: null, publication: 'unpublished', firstSeenAt: t, lastSeenAt: t, absentRuns: 0});
    result.added++; result.addedIds.push(id);
  }
  for (const e of episodes) if (e.guid && e.lastSeenAt !== t && !seen.has((e.feedKey || '') + '\u0000' + e.guid)) e.absentRuns = (e.absentRuns || 0) + 1; // 消えても削除しない
  return {registry: {...registry, episodes}, result, runId};
}

/** 本番台帳(READ_ONLY読取)との突合で仮IDを本番EP-IDへ。**採番はしない**。台帳に無い=本番未登録のまま TMP を維持。
 * ledgerIndex: Map<guid, string[] 台帳のEP-ID群>。1件に定まらない/形式不正は idConflict=HOLD。 */
export function reconcileEpIds(registry, ledgerIndex) {
  const out = {mapped: 0, pending: 0, conflicts: []};
  const episodes = registry.episodes.map(e => ({...e}));
  const used = new Map(episodes.filter(e => isEpId(e.id)).map(e => [e.id, e.guid]));
  for (const e of episodes) {
    if (isEpId(e.id) || !e.guid) continue;
    const ids = ledgerIndex.get(e.guid) || [];
    if (!ids.length) { out.pending++; continue; }
    if (ids.length > 1 || !isEpId(ids[0]) || (used.has(ids[0]) && used.get(ids[0]) !== e.guid)) { e.idConflict = true; out.conflicts.push({tmp: e.id, candidates: ids}); continue; }
    e.tmpId = e.id; e.id = ids[0]; used.set(ids[0], e.guid); delete e.idConflict; out.mapped++;
  }
  return {registry: {...registry, episodes}, result: out};
}

/** 番組別配信頻度(直近の発行間隔の中央値)。履歴5件未満は判定しない。期限=最終配信+max(中央値×2, 36h)。 */
export function showCadence(episodes, nowMs) {
  const by = new Map();
  for (const e of episodes) { const t = Date.parse(e.pubDate); if (e.show && Number.isFinite(t)) (by.get(e.show) || by.set(e.show, []).get(e.show)).push(t); }
  const out = {};
  for (const [show, ts] of by) {
    ts.sort((a, b) => a - b); const recent = ts.slice(-30), gaps = recent.slice(1).map((x, i) => x - recent[i]).filter(g => g > 0);
    const last = ts.at(-1);
    if (gaps.length < 4) { out[show] = {samples: ts.length, lastPubDate: new Date(last).toISOString(), cadence: 'unknown', overdue: false}; continue; }
    const med = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)], dueAt = last + Math.max(med * 2, 36 * 3600e3);
    out[show] = {samples: ts.length, lastPubDate: new Date(last).toISOString(), medianGapHours: +(med / 3600e3).toFixed(1), cadence: med <= 30 * 3600e3 ? 'daily' : med <= 8 * 86400e3 ? 'weekly' : 'irregular', expectedBy: new Date(dueAt).toISOString(), overdue: nowMs > dueAt};
  }
  return out;
}
/** 巡回の成功状態(新着ゼロとは別)。ok=HTTP200かつ解析成功。 */
export function recordPatrol(states, feedKey, {ok, http = null, itemCount = null, error = null}, nowIso) {
  const prev = states[feedKey] || {consecutiveFailures: 0, lastItemCount: null};
  const next = {...prev, lastAttemptAt: nowIso, lastHttp: http, lastError: ok ? null : error, consecutiveFailures: ok ? 0 : prev.consecutiveFailures + 1};
  if (ok) { next.lastOkAt = nowIso; next.shrank = prev.lastItemCount != null && itemCount < prev.lastItemCount; next.lastItemCount = itemCount; }
  return {...states, [feedKey]: next};
}
export function patrolIssues(states, nowMs, {maxAgeHours = 36, maxFailures = 3} = {}) {
  const a = [];
  for (const [k, st] of Object.entries(states)) {
    if (!st.lastOkAt || nowMs - Date.parse(st.lastOkAt) > maxAgeHours * 3600e3 || st.consecutiveFailures >= maxFailures) a.push('PATROL_STALE:' + k);
    if (st.shrank) a.push('FEED_ITEMS_SHRANK:' + k);
  }
  return a;
}

/** 公開対象 = 確認済み かつ 判定=対象 かつ 承認済み。それ以外(未レビュー/保留/対象外/除外)は収蔵に残るが公開しない。 */
export const isPublishable = e => e.review === 'reviewed' && e.decision === '対象' && e.approval === 'approved';
export function summarize(registry) {
  const s = {total: registry.episodes.length, unreviewed: 0, held: 0, excluded: 0, approved: 0, published: 0, latestPubDate: '', missingSpotifyOver24h: 0};
  return {s, fill(now) {
    for (const e of registry.episodes) {
      if (e.review === 'unreviewed') s.unreviewed++;
      if (e.decision === '保留') s.held++;
      if (e.decision === '対象外' || e.decision === '除外') s.excluded++;
      if (e.approval === 'approved') s.approved++;
      if (isPublishable(e)) s.published++;
      if (e.pubDate > s.latestPubDate) s.latestPubDate = e.pubDate;
      if (!e.spotify && e.pubDate && Date.parse(now) - Date.parse(e.pubDate) > 24 * 3600e3) s.missingSpotifyOver24h++;
    }
    return s;
  }};
}
/** 異常検知。固定件数ではなく 前回比・巡回成功・番組別の配信間隔を見る。『新着ゼロ』自体は異常にしない(巡回が成功していれば正常)。 */
export function detect(summary, run, prev, {now, patrol = {}, cadence = {}, maxDropRatio = 0, maxMissingSpotifyRatio = 0.1} = {}) {
  const a = [];
  if (run.fetched === 0) a.push('FEED_EMPTY');
  if (run.quarantined?.length) a.push('QUARANTINED_ITEMS');
  a.push(...patrolIssues(patrol, Date.parse(now)));
  for (const [show, c] of Object.entries(cadence)) if (c.overdue) a.push('SHOW_OVERDUE:' + show); // 巡回成功のうえで番組が自分の周期より遅れている場合のみ
  if (prev) {
    if (summary.total < prev.total) a.push('TOTAL_DECREASED');
    if (summary.published < prev.published * (1 - maxDropRatio)) a.push('PUBLISHED_DECREASED');
    if (prev.latestPubDate && summary.latestPubDate < prev.latestPubDate) a.push('LATEST_PUBDATE_REGRESSED');
  }
  if (summary.total && summary.missingSpotifyOver24h / summary.total > maxMissingSpotifyRatio) a.push('SPOTIFY_LINK_GAP');
  return a;
}
const STOP = x => ['FEED_EMPTY', 'TOTAL_DECREASED', 'PUBLISHED_DECREASED', 'LATEST_PUBDATE_REGRESSED'].includes(x) || /^(PATROL_STALE|FEED_ITEMS_SHRANK):/.test(x);
export function runRecord({registry, result, now, runId, prev, startedAt, patrol = {}}) {
  const sum = summarize(registry), s = sum.fill(now), cadence = showCadence(registry.episodes, Date.parse(now));
  const rec = {runId, startedAt: startedAt || now, finishedAt: now, lastPatrolAt: now, fetched: result.fetched, added: result.added, updated: result.updated, unchanged: result.unchanged,
    quarantined: result.quarantined.length, ...s, shows: cadence};
  rec.anomalies = detect(s, {...result}, prev, {now, patrol, cadence});
  rec.status = rec.anomalies.some(STOP) ? 'STOP' : rec.anomalies.length ? 'WARN' : 'OK';
  return rec;
}
// 単一writerリース/COMMITは journal-lease.mjs(fencing token付き)に移した。
