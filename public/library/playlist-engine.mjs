/** Spotifyプレイリスト 共通エンジン(設定表駆動・単一writer・DRY_RUN既定)。純粋ロジック。IOは注入(spotify, store)。
 * 再利用: journal-lease(#290 fencing単一writer)・fill-queue の ApiError と 429/AUTH 共有クールダウン方針。新規の取得ロボは作らない。
 * 厳守: (1)ユーザーがSpotify上で消した曲は戻さない (2)承認前・フォーム投稿だけでは追加しない (3)除外/HOLD/未レビューを尊重 (4)完全なスナップショットが無ければ書かない。 */
import {acquire, commit, release} from './journal-lease.mjs';
import {ApiError} from './fill-queue.mjs';
import {writePermission} from './playlist-config.mjs';

export const SKIP = Object.freeze({IN_PLAYLIST: 'ALREADY_IN_PLAYLIST', TOMBSTONE: 'HUMAN_REMOVED_TOMBSTONE', SUSPECT: 'ABSENT_ONCE_SUSPECT_REMOVED', EXCLUDED: 'EPISODE_EXCLUDED', HOLD: 'EPISODE_HOLD', UNREVIEWED: 'EPISODE_UNREVIEWED', APPROVAL: 'AWAITING_APPROVAL', CAP: 'DEFERRED_BY_CAP'});
const textOf = (ep, rule) => rule.fields.map(f => String(ep?.[f] ?? '')).join('\n');
/** 照合。旧GAS matchesAutoPlaylistRule_ と同じ意味(キーワード any/all・除外語・範囲)。特別照合は strategies[name](ep) を注入。 */
export function matchEpisode(ep, rule, strategies = {}) {
  if (rule.showIds.length && ep.showId && !rule.showIds.includes(ep.showId)) return false;
  if (/^series-code:/.test(rule.strategy)) { // 旧 seriesTitleCode と同じ: タイトルに「コード+数字」(例 #52-12)。内蔵(注入不要)
    const code = rule.strategy.slice(12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !!code && new RegExp(code + '[0-9]+').test(String(ep.name ?? ''));
  }
  if (rule.strategy) return !!strategies[rule.strategy]?.(ep);
  const t = textOf(ep, rule);
  if (rule.excludeKeywords.some(k => t.includes(k))) return false;
  return rule.matchMode === 'all' ? rule.keywords.every(k => t.includes(k)) : rule.keywords.some(k => t.includes(k));
}
/** 共通キュー: RSS/フォーム/回復走査の変更を1本に集約。同じエピソードは1件(重複登録しない)。 */
export const episodeKey = ep => ep.uri || (ep.id ? 'spotify:episode:' + ep.id : ep.guid);
export function enqueue(queue, item) {
  const k = episodeKey(item.episode); if (!k) return {queue, added: false, reason: 'NO_KEY'};
  const cur = queue.items[k];
  if (cur) { // 後から承認されたら承認を引き継ぐ。承認は取り消さない。
    if (item.approved && !cur.approved) cur.approved = true;
    return {queue, added: false, reason: 'DUPLICATE'};
  }
  queue.items[k] = {episode: item.episode, origin: item.origin || 'rss', approved: item.origin === 'form' ? !!item.approved : true, at: item.at};
  return {queue, added: true};
}
export const newQueue = () => ({items: {}});
/** 影響するプレイリストだけ判定する(差分判定)。 */
export function affectedRules(rules, items, strategies) {
  return rules.filter(r => !r.blocked.length && r.enabled && items.some(i => matchEpisode(i.episode, r, strategies)));
}
/** 台帳(ledger): seen=今までプレイリスト上で確認した曲, absent=連続で見つからなかった回数, tombstones=人が消した曲(戻さない)。 */
export const newLedger = () => ({seen: {}, absent: {}, tombstones: {}});
export function reconcile(ledger, uris, now, {complete, confirmAbsent = 2}) {
  const next = {seen: {...ledger.seen}, absent: {...ledger.absent}, tombstones: {...ledger.tombstones}};
  if (!complete) return {ledger: next, newlyRemoved: [], skipped: true}; // 不完全な読取で「消された」と誤判定しない
  const present = new Set(uris), newlyRemoved = [];
  for (const u of present) { next.seen[u] ??= now; delete next.absent[u]; }
  for (const u of Object.keys(next.seen)) {
    if (present.has(u) || next.tombstones[u]) continue;
    next.absent[u] = (next.absent[u] || 0) + 1;
    if (next.absent[u] >= confirmAbsent) { next.tombstones[u] = {reason: 'HUMAN_REMOVED', at: now}; newlyRemoved.push(u); }
  }
  return {ledger: next, newlyRemoved, skipped: false};
}
/** 管理人が明示的に戻す時だけ(自動では絶対に呼ばない)。 */
export function reinstate(ledger, uri) { const n = {seen: {...ledger.seen}, tombstones: {...ledger.tombstones}, absent: {...ledger.absent}}; delete n.tombstones[uri]; delete n.absent[uri]; delete n.seen[uri]; return n; }

/** 1プレイリストの追加計画。副作用なし。registry: uri→{decision:'対象'|'除外'|'保留', review:'reviewed'|'unreviewed'}。 */
export function planRule(rule, {items, playlist, ledger, registry = {}, now, strategies}) {
  if (!playlist?.complete) return {adds: [], skipped: [], ledger, blocked: 'PLAYLIST_SNAPSHOT_INCOMPLETE', newlyRemoved: []};
  const rec = reconcile(ledger, playlist.uris, now, {complete: true});
  const present = new Set(playlist.uris), skipped = [], cands = [];
  const seenKeys = new Set();
  for (const it of items) {
    const ep = it.episode, uri = episodeKey(ep);
    if (!uri || seenKeys.has(uri) || !matchEpisode(ep, rule, strategies)) continue;
    seenKeys.add(uri);
    const reg = registry[uri] || {};
    let why = null;
    if (present.has(uri)) why = SKIP.IN_PLAYLIST;
    else if (rec.ledger.tombstones[uri]) why = SKIP.TOMBSTONE;
    else if (rec.ledger.absent[uri]) why = SKIP.SUSPECT;
    else if (['除外', '対象外'].includes(reg.decision)) why = SKIP.EXCLUDED;
    else if (reg.decision === '保留') why = SKIP.HOLD;
    else if (rule.requireReviewedEpisodes && reg.review !== 'reviewed') why = SKIP.UNREVIEWED;
    else if (it.origin === 'form' && !it.approved) why = SKIP.APPROVAL; // フォーム投稿だけでは承認を飛ばして追加しない
    if (why) skipped.push({uri, reason: why}); else cands.push({uri, id: ep.id, name: ep.name, release_date: ep.release_date, origin: it.origin});
  }
  cands.sort((a, b) => (a.release_date || '') < (b.release_date || '') ? -1 : (a.release_date || '') > (b.release_date || '') ? 1 : String(a.id).localeCompare(String(b.id)));
  const adds = cands.slice(0, rule.maxAdd);
  for (const c of cands.slice(rule.maxAdd)) skipped.push({uri: c.uri, reason: SKIP.CAP});
  return {adds, skipped, ledger: rec.ledger, newlyRemoved: rec.newlyRemoved, blocked: null};
}
/** プレイリスト読取(ページング+再開)。1回の実行でmaxPagesまで。完了(next=null)まで complete=false。 */
export async function readPlaylist(spotify, playlistId, snap = {uris: [], cursor: null}, {maxPages = 5} = {}) {
  let {uris, cursor} = {uris: [...snap.uris], cursor: snap.cursor}, pages = 0, complete = false;
  while (pages < maxPages) {
    const p = await spotify.listPage(playlistId, cursor); pages++;
    uris.push(...p.items); cursor = p.next;
    if (!p.next) { complete = true; break; }
  }
  return {uris: [...new Set(uris)], cursor: complete ? null : cursor, complete};
}
/** 実行本体。state: {ledgers:{key}, snaps:{key}, cooldown:{spotify:ms}, handoff:{key}} を受け取り新stateを返す(永続化は呼び元がCOMMIT後に行う)。 */
export async function runEngine({rules, queue, spotify, state = {}, registry = {}, strategies = {}, store, owner = 'engine', runId, now, globalMode = 'DRY_RUN', maxPages = 5, sweep = false}) {
  const lease = acquire(store, owner, now);
  if (!lease.ok) return {status: 'SKIPPED', reason: lease.reason, results: [], state};
  const st = {ledgers: {...(state.ledgers || {})}, snaps: {...(state.snaps || {})}, cooldown: {...(state.cooldown || {})}, handoff: state.handoff || {}};
  const items = Object.values(queue.items), results = [];
  const targets = sweep ? rules.filter(r => !r.blocked.length && r.enabled) : affectedRules(rules, items, strategies); // 通常は影響リストだけ、sweep=回復走査は全有効リスト
  let stopped = null;
  for (const rule of targets.sort((a, b) => a.key.localeCompare(b.key))) {
    if ((st.cooldown.spotify || 0) > now) { results.push({key: rule.key, status: 'COOLDOWN'}); continue; }
    const perm = writePermission(rule, {globalMode, handoff: st.handoff});
    try {
      const snap = await readPlaylist(spotify, rule.playlistId, st.snaps[rule.key], {maxPages});
      st.snaps[rule.key] = snap.complete ? {uris: [], cursor: null} : snap;
      const plan = planRule(rule, {items, playlist: snap, ledger: st.ledgers[rule.key] || newLedger(), registry, now, strategies});
      st.ledgers[rule.key] = plan.ledger;
      const r = {key: rule.key, status: plan.blocked ? 'WAITING_SNAPSHOT' : 'PLANNED', candidates: plan.adds.map(a => a.uri), skipped: plan.skipped, newlyRemoved: plan.newlyRemoved, writePermission: perm, wrote: 0};
      if (!plan.blocked && plan.adds.length && perm.allowed) {
        await spotify.addItems(rule.playlistId, plan.adds.map(a => a.uri)); // 単一writer: リース保持中のみ
        for (const a of plan.adds) st.ledgers[rule.key].seen[a.uri] = now; // 追加成功分だけ台帳へ
        r.wrote = plan.adds.length; r.status = 'WRITTEN';
      } else if (plan.adds.length) r.status = 'DRY_RUN';
      results.push(r);
    } catch (e) {
      if (e instanceof ApiError && e.kind === '429') { st.cooldown.spotify = now + Math.max(1, e.retryAfterSec ?? 60) * 1000; stopped = 'RATE_LIMITED'; results.push({key: rule.key, status: 'ERROR:429'}); break; } // 全リスト共通クールダウン
      if (e instanceof ApiError && e.kind === 'AUTH') { st.cooldown.spotify = now + 6 * 3600e3; stopped = 'AUTH'; results.push({key: rule.key, status: 'ERROR:AUTH'}); break; }
      results.push({key: rule.key, status: 'ERROR', reason: String(e.message || e)});
    }
  }
  const c = commit(store, {owner, token: lease.token, runId, baseVersion: lease.baseVersion, payloadHash: String(results.length)}, now);
  release(store, {owner, token: lease.token});
  if (!c.ok) return {status: 'COMMIT_REJECTED', reason: c.reason, results, state}; // COMMIT失敗時は状態を確定しない(次回、既存リスト照合で重複しない)
  return {status: stopped ? 'STOPPED:' + stopped : 'OK', results, state: st, version: c.version};
}
/** フォーム投稿の取り込み: 蔵(registry)のGUID/URI/EP-IDと照合。既登録は重複させず不足だけ、新規は収蔵候補。承認は飛ばさない。 */
export function intakeFormPost(post, {byKey, queue, now}) {
  const key = post.uri || post.guid || post.epId, hit = byKey[key] || byKey[post.guid] || byKey[post.epId];
  if (hit) {
    const missing = ['guid', 'spotifyUri', 'show'].filter(f => !hit[f] && post[f === 'spotifyUri' ? 'uri' : f]);
    if (hit.decision === '除外' || hit.decision === '保留') return {kind: 'REGISTERED_RESPECT_STATE', state: hit.decision, missing: []};
    const q = enqueue(queue, {episode: {...post.episode, uri: post.uri || post.episode?.uri}, origin: 'form', approved: false, at: now});
    return {kind: 'ALREADY_REGISTERED', epId: hit.epId, fillOnly: missing, queued: q.added};
  }
  const q = enqueue(queue, {episode: {...post.episode, uri: post.uri || post.episode?.uri}, origin: 'form', approved: false, at: now});
  return {kind: 'NEW_CANDIDATE', queued: q.added, registryCandidate: {guid: post.guid || null, uri: post.uri || null, status: 'provisional', review: 'unreviewed'}};
}
