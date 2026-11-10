// マルチプラットフォーム個別EP URL探索ロボットの共通部（純粋関数。ネットワークに触れない）。
// 状態: discovered → validated → candidate → (承認後) written。HOLD / CONFLICT / NOT_FOUND は理由付きで別扱い。
// 禁止: 番組トップURL・検索結果URL・音声(mp3)URLを個別EPリンクとして登録しない。既存の非空値は上書きしない。

export const SERVICES = {
  spotify: { column: 'L', label: 'Spotify', re: /^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/ },
  apple: { column: 'M', label: 'Apple Podcasts', re: /^https:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^/?#]*\/id\d+\?i=\d+(?:&[A-Za-z]+=[^&#]*)*$/ },
  amazon: { column: 'AO', label: 'Amazon Music', re: /^https:\/\/music\.amazon\.[a-z.]+\/podcasts\/[0-9a-f-]{36}\/episodes\/[0-9a-f-]{36}(?:[/?#].*)?$/i },
  pocket: { column: 'AP', label: 'Pocket Casts', re: /^https:\/\/pca\.st\/episode\/[0-9a-f-]{36}$/i },
  listen: { column: 'K', label: 'LISTEN', re: /^https:\/\/listen\.style\/p\/[a-z0-9]+\/[a-z0-9]+$/i },
  pody: { column: 'AQ', label: 'Pody', re: /^https:\/\/pody\.jp\/player\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/ },
};

export function isEpisodeUrl(service, url) {
  const s = SERVICES[service];
  return !!s && s.re.test(String(url || '').trim());
}
export function rejectReason(service, url) {
  const u = String(url || '').trim();
  if (!u) return 'EMPTY';
  if (/\.(mp3|m4a|aac)(\?|$)/i.test(u)) return 'AUDIO_FILE_URL';
  if (/[?&](q|term|search)=/i.test(u) || /\/search\b/i.test(u)) return 'SEARCH_RESULT_URL';
  if (!isEpisodeUrl(service, u)) return 'NOT_EPISODE_URL_SHAPE';
  return '';
}

export const appleTrackId = (u) => ((String(u || '').match(/[?&]i=(\d+)/) || [])[1] || '');
const norm = (t) => String(t || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const day = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10); };

// Apple iTunes lookup(entity=podcastEpisode) の results → 正規化。trackViewUrl（閲覧ページ）だけを採り、episodeUrl（音声）は採らない。
export function appleEpisodesFromLookup(json) {
  const out = [];
  for (const r of (json && json.results) || []) {
    if (r.wrapperType !== 'podcastEpisode' && r.kind !== 'podcast-episode') continue;
    const url = String(r.trackViewUrl || '').trim();
    out.push({
      guid: String(r.episodeGuid || '').toLowerCase(),
      title: r.trackName || '', date: day(r.releaseDate), showName: r.collectionName || '',
      url, urlOk: isEpisodeUrl('apple', url), audioIgnored: !!r.episodeUrl,
    });
  }
  return out;
}

// prod: [{epId, show, title, date(YYYY-MM-DD JST), guid, known:{apple,...}}]
// 強キー: episodeGuid == 台帳の外部ID（GUID）。タイトル+配信日のみは HOLD。
export function matchApple(prod, appleEpisodes) {
  const byGuid = new Map();
  for (const a of appleEpisodes) if (a.guid) (byGuid.get(a.guid) || byGuid.set(a.guid, []).get(a.guid)).push(a);
  const byTD = new Map();
  for (const a of appleEpisodes) (byTD.get(`${a.date}|${norm(a.title)}`) || byTD.set(`${a.date}|${norm(a.title)}`, []).get(`${a.date}|${norm(a.title)}`)).push(a);
  return prod.map((p) => {
    const g = byGuid.get(String(p.guid || '').toLowerCase()) || [];
    let state; let hit = null; let basis = '';
    if (g.length === 1) { hit = g[0]; basis = 'episodeGuid'; }
    else if (g.length > 1) { state = 'CONFLICT'; basis = 'episodeGuid複数'; }
    else {
      const t = byTD.get(`${p.date}|${norm(p.title)}`) || [];
      if (t.length === 1) { hit = t[0]; state = 'HOLD'; basis = 'タイトル+配信日のみ'; }
      else state = 'NOT_FOUND';
    }
    if (hit && !state) {
      if (!hit.urlOk) state = 'REJECTED';
      else if (p.known && p.known.apple) state = appleTrackId(p.known.apple) === appleTrackId(hit.url) ? 'SAME' : 'URL_CONFLICT';
      else state = 'CANDIDATE';
    }
    return { epId: p.epId, service: 'apple', state, basis, url: hit && hit.urlOk ? hit.url : '' };
  });
}

// サービス別の取得成功率・HOLD・失敗理由の集計
export function tally(rows) {
  const t = {};
  for (const r of rows) {
    const s = (t[r.service] ||= { total: 0 });
    s.total++; s[r.state] = (s[r.state] || 0) + 1;
  }
  return t;
}

// 探索のポリシー（実装側が守る）
export const POLICY = {
  minDelayMs: 1000, maxRetries: 3, backoffMs: [2000, 8000, 30000],
  retryOn: [429, 500, 502, 503, 504], cacheHours: 24, reprobeAfterDays: { NOT_FOUND: 7, HOLD: 7, CANDIDATE: 30 },
  userAgent: 'asarisunowa-link-probe/0.1 (read-only; contact: repo Neyito96/asarisunowa)',
};
