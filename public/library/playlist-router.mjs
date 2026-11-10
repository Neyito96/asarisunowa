/** 共通ルーター: 日次パイプライン(収蔵・補完)の結果 → 中央差分キュー → プレイリスト共通エンジン。収蔵・補完・候補生成・更新を一つの流れにする。純粋ロジック。
 * Spotify個別URLが未取得の新着は「AWAITING_SPOTIFY_URL」で待機(Spotify未公開とは断定しない。取得できた回の巡回で自動的に候補化)。
 * 蔵の人間状態(除外/保留/未レビュー)はそのままエンジンへ渡し、ここでは変更しない。 */
import {enqueue, newQueue} from './playlist-engine.mjs';
export const spotifyEpisodeId = url => (/open\.spotify\.com\/(?:intl-[a-z]+\/)?episode\/([A-Za-z0-9]{22})/.exec(String(url || '')) || [])[1] || null;
/** daily: runDailyDay の結果(state.registry, state.rows)。showIdByName: 番組名→Spotify show id(設定)。 */
const nk = v => String(v ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); // 番組名の表記ゆれ(？/?, 全角半角)は厳格RSS解析でも正規化されるため、照合側も同じ正規化
export function routeFromDaily({daily, queue = newQueue(), showIdByName = {}, now, onlyIds = null}) {
  const pending = [], routed = [], registryStates = {}, noShowId = [];
  const rows = daily.state.rows, byName = Object.fromEntries(Object.entries(showIdByName).map(([k, v]) => [nk(k), v]));
  for (const e of daily.state.registry.episodes) {
    if (onlyIds && !onlyIds.has(e.id)) continue;
    const row = rows.get(e.id), sid = spotifyEpisodeId(row?.[11]);
    if (!sid) { pending.push({id: e.id, reason: 'AWAITING_SPOTIFY_URL'}); continue; }
    const showId = byName[nk(e.show)];
    if (!showId) { noShowId.push({id: e.id, show: e.show}); continue; } // 番組IDが分からない=対象番組の範囲判定ができない→候補にしない
    const uri = 'spotify:episode:' + sid;
    registryStates[uri] = {decision: e.decision, review: e.review};
    const q = enqueue(queue, {episode: {id: sid, uri, name: e.title, description: row[21], html_description: row[21], release_date: String(e.pubDate).slice(0, 10), showId}, origin: 'rss', at: now});
    routed.push({id: e.id, uri, queued: q.added});
  }
  return {queue, pending, routed, noShowId, registryStates};
}
