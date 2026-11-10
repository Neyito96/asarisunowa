/** 日次増分運用の中核(純粋関数・IOなし・外部APIなし)。
 * 総数は日々増える。5,848/5,945 は特定日のスナップショットであり固定目標ではない。
 * 状態は別々に持つ: custody(収蔵) / review(未レビュー|確認済み) / decision(対象|保留|対象外|除外) / approval(承認) / publication(公開)。
 * 掲載判定が未完了でも収蔵は止めない。人間の状態(review/decision/approval)は取り込みでは変更しない。 */
export const STATES = Object.freeze({review: ['unreviewed', 'reviewed'], decision: ['対象', '保留', '対象外', '除外', null], approval: ['approved', null]});
const EP = /^EP-(\d{5,})$/;
const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const epNum = id => Number(EP.exec(id)?.[1] || 0);
export const nextEpId = ids => 'EP-' + String(Math.max(0, ...[...ids].map(epNum)) + 1).padStart(5, '0'); // 追記専用。再採番しない

/** 公式RSSの <item> を最小限に解釈(ネットワークなし)。guid が無い item は strongId 無しとして返す。 */
export function parseFeed(xml) {
  const text = (blk, tag) => { const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(blk); return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''; };
  const channelTitle = text(xml.split('<item')[0], 'title');
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map(m => ({
    guid: text(m[0], 'guid'), title: text(m[0], 'title'), pubDate: text(m[0], 'pubDate'), link: text(m[0], 'link'),
    audio: (/<enclosure[^>]*url="([^"]+)"/.exec(m[0]) || [])[1] || '', show: channelTitle,
  }));
}
const isoOf = d => { const t = Date.parse(d); return Number.isFinite(t) ? new Date(t).toISOString() : ''; };

/** 日次取り込み(冪等)。registry = {episodes:[{id,guid,...states}], runs:[]} は不変として扱い、新しい registry を返す。 */
export function ingest(registry, feedItems, {now, runId, expectedHost = null} = {}) {
  const t = now || new Date().toISOString();
  const episodes = registry.episodes.map(e => ({...e}));
  const byGuid = new Map(episodes.filter(e => e.guid).map(e => [e.guid, e]));
  const result = {fetched: feedItems.length, added: 0, updated: 0, unchanged: 0, quarantined: [], duplicatesInFeed: 0, addedIds: []};
  const seenInFeed = new Set(), fresh = [];
  for (const it of feedItems) {
    if (!it.guid) { result.quarantined.push({reason: 'NO_STRONG_ID', title: norm(it.title)}); continue; } // 落とさず隔離として記録
    if (seenInFeed.has(it.guid)) { result.duplicatesInFeed++; continue; }
    seenInFeed.add(it.guid);
    const cur = byGuid.get(it.guid);
    if (cur) { // 既存: 識別情報の補完のみ。人間状態は不変。
      let changed = false;
      for (const [k, v] of [['audio', it.audio], ['link', it.link]]) if (v && !cur[k]) { cur[k] = v; changed = true; }
      cur.lastSeenAt = t; cur.absentRuns = 0; changed ? result.updated++ : result.unchanged++;
    } else fresh.push(it);
  }
  fresh.sort((a, b) => (isoOf(a.pubDate) || '').localeCompare(isoOf(b.pubDate) || '') || a.guid.localeCompare(b.guid)); // 決定的なID付与順
  for (const it of fresh) {
    const id = nextEpId(episodes.map(e => e.id));
    episodes.push({id, guid: it.guid, show: norm(it.show), title: norm(it.title), pubDate: isoOf(it.pubDate), link: it.link, audio: it.audio, spotify: '',
      custody: 'collected', review: 'unreviewed', decision: null, approval: null, publication: 'unpublished', firstSeenAt: t, lastSeenAt: t, absentRuns: 0});
    result.added++; result.addedIds.push(id);
  }
  for (const e of episodes) if (e.guid && !seenInFeed.has(e.guid) && e.lastSeenAt !== t) e.absentRuns = (e.absentRuns || 0) + 1; // 消えても削除しない
  return {registry: {...registry, episodes}, result, runId};
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
/** 異常検知。prev = 前回の run 記録。固定件数ではなく「前回比」「鮮度」「リンク」を見る。 */
export function detect(summary, run, prev, {now, staleHours = 36, maxDropRatio = 0, maxMissingSpotifyRatio = 0.1} = {}) {
  const a = [];
  if (run.fetched === 0) a.push('FEED_EMPTY');
  if (run.quarantined?.length) a.push('QUARANTINED_ITEMS');
  if (summary.latestPubDate && Date.parse(now) - Date.parse(summary.latestPubDate) > staleHours * 3600e3) a.push('STALE_LATEST_EPISODE');
  if (prev) {
    if (summary.total < prev.total) a.push('TOTAL_DECREASED');
    if (summary.published < prev.published * (1 - maxDropRatio)) a.push('PUBLISHED_DECREASED'); // 公開件数の減少は許さない(人間が取り下げた時のみ別記録)
    if (prev.latestPubDate && summary.latestPubDate < prev.latestPubDate) a.push('LATEST_PUBDATE_REGRESSED');
  }
  if (summary.total && summary.missingSpotifyOver24h / summary.total > maxMissingSpotifyRatio) a.push('SPOTIFY_LINK_GAP');
  return a;
}
export function runRecord({registry, result, now, runId, prev, startedAt}) {
  const sum = summarize(registry), s = sum.fill(now);
  const rec = {runId, startedAt: startedAt || now, finishedAt: now, lastPatrolAt: now, fetched: result.fetched, added: result.added, updated: result.updated, unchanged: result.unchanged,
    quarantined: result.quarantined.length, ...s};
  rec.anomalies = detect(s, {...result}, prev, {now});
  rec.status = rec.anomalies.some(x => ['FEED_EMPTY', 'TOTAL_DECREASED', 'PUBLISHED_DECREASED', 'LATEST_PUBDATE_REGRESSED'].includes(x)) ? 'STOP' : rec.anomalies.length ? 'WARN' : 'OK';
  return rec;
}

/** 単一writer用リース。失効後は別実行が引き継げる(障害からの再開)。古い runId の書込は拒否される。 */
export function acquireLease(lease, owner, nowMs, ttlMs = 15 * 60e3) {
  if (lease && lease.owner !== owner && lease.expiresAt > nowMs) return {ok: false, reason: 'HELD_BY_OTHER', lease};
  return {ok: true, lease: {owner, expiresAt: nowMs + ttlMs, token: (lease?.token || 0) + 1}};
}
export const mayCommit = (lease, owner, token, nowMs) => !!lease && lease.owner === owner && lease.token === token && lease.expiresAt > nowMs;
