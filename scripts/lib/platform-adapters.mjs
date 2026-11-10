// 実API用アダプタ(注入式 httpJson)。ここでは実ネットワークを呼ばない。実API未検証の社は routes で false。
import { classifyHttp } from './platform-resolver.mjs';
/** httpJson(url) -> { status, headers:{retry-after?}, json } */
async function call(httpJson, url) {
  let r; try { r = await httpJson(url); } catch { throw classifyHttp(0); }
  if (r.status >= 200 && r.status < 300) return r.json;
  throw classifyHttp(r.status, r.headers?.['retry-after'] != null ? Number(r.headers['retry-after']) : null);
}
const showIdFrom = (url, re) => (String(url || '').match(re) || [])[1] || '';

/** Apple: iTunes Lookup (公開API・認証不要)。番組IDの直近エピソード(最大200)を列挙しエピソードURL(?i=)・episodeGuidで照合。古い話は返らない可能性(未検証)。 */
export function appleAdapter(httpJson) {
  return { async candidates(input) {
    const id = showIdFrom(input.showUrls?.apple, /\/id(\d+)/); if (!id) return { candidates: [] };
    const j = await call(httpJson, `https://itunes.apple.com/lookup?id=${id}&entity=podcastEpisode&limit=200&country=JP`);
    return { candidates: (j.results || []).filter((x) => x.wrapperType === 'podcastEpisode' || x.kind === 'podcast-episode').map((x) => ({ url: x.trackViewUrl, title: x.trackName, publishedAt: x.releaseDate, precision: 'time', guid: x.episodeGuid, externalId: String(x.trackId ?? ''), showId: String(x.collectionId ?? id) })) };
  } };
}
/** Spotify: Web API /shows/{id}/episodes を next で全ページ取得(上限pages)。429は Retry-After を保持。要トークン(httpJson側で付与)。 */
export function spotifyAdapter(httpJson, { maxPages = 40 } = {}) {
  return { async candidates(input) {
    const id = showIdFrom(input.showUrls?.spotify, /\/show\/([A-Za-z0-9]+)/); if (!id) return { candidates: [] };
    let url = `https://api.spotify.com/v1/shows/${id}/episodes?market=JP&limit=50`; const out = [];
    for (let p = 0; url && p < maxPages; p++) {
      const j = await call(httpJson, url);
      for (const e of j.items || []) if (e) out.push({ url: e.external_urls?.spotify, title: e.name, publishedAt: e.release_date, precision: e.release_date_precision === 'day' ? 'day' : 'time', externalId: e.id, showId: id });
      url = j.next || null;
    }
    return { candidates: out, truncated: !!url };
  } };
}
/** 実API検証状況。false=fixtureのみ(捏造成功率を出さない)。LISTEN/Amazon/Pocket Casts/Pody は公式/公開の個別EP検索APIを実測できておらず未実装。 */
export const ROUTES = Object.freeze({ spotify: false, apple: false, listen: false, amazon: false, pocketcasts: false, pody: false });
