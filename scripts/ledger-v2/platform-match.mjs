// P27 配信先URLロボ: 配信先のエピソード一覧と V2・統合台帳の各回を1対1で結ぶ（純関数・Node と GAS 共通）。
// 2026-11-17 司令塔「P27 第2段階実行指令」。設計: docs/design/2026-11-17-platform-url-robot-design.md
// 本人確認の基準（緩めない）:
//   GUID  … 配信先の音声URLに含まれる Omny のクリップID ＝ V2 の公式GUID
//   AUDIO … 配信先の音声URL ＝ V2 の音声URL（計測用の前置き・クエリを除いた同じファイル）
//   META  … 番組が同じ・題名が同じ（全角半角と空白だけ揃える）・配信時刻±60秒・長さ±2秒
//   GUID/AUDIO は「題名が同じ」か「配信時刻が36時間以内」のどちらかも満たすときだけ確定（音声だけ一致して中身が違う事故を防ぐ）。
// 1対1でないもの（同じ配信先の回が複数のV2行に当たる・その逆）は全部保留。既にV2に別のURLがあれば上書きせず「既存URL競合」。
export const PLATFORM_MATCH_VERSION = 'PM-3';

export const nz = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
// 音声ファイルの同一性キー
export function audioKey(url) {
  const u = String(url ?? '').trim(); if (!u) return '';
  const omny = u.match(/\/clips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/([0-9a-f-]{36})\/audio/i); if (omny) return 'omny:' + omny[1].toLowerCase();
  const mp = u.match(/traffic\.megaphone\.fm\/([A-Z]{4}\d{6,})\.mp3/i); if (mp) return 'megaphone:' + mp[1].toUpperCase();
  let s = u.replace(/^https?:\/\//i, '').replace(/[?#].*$/, '');
  for (let i = 0; i < 4; i++) s = s.replace(/^(?:pdst\.fm\/e\/|chrt\.fm\/track\/[^/]+\/|dts\.podtrac\.com\/redirect\.mp3\/|www\.podtrac\.com\/pts\/redirect\.mp3\/|op3\.dev\/e\/|pfx\.vpixl\.com\/[^/]+\/|verifi\.podscribe\.com\/rss\/p\/)/i, '');
  return 'file:' + s.toLowerCase();
}
export const omnyClipId = (url) => { const k = audioKey(url); return k.startsWith('omny:') ? k.slice(5) : ''; };

// Pocket Casts
export const PC_EPISODE_URL = /^https:\/\/pca\.st\/episode\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const pcEpisodeUrl = (uuid) => 'https://pca.st/episode/' + String(uuid).toLowerCase();
export const pcUuidOf = (url) => { const m = String(url ?? '').trim().match(PC_EPISODE_URL); return m ? m[1] : ''; };
// Pocket Casts 公開データ（podcast/full）→ 共通の形
export function pcEpisodesFromJson(json) {
  const p = (json && json.podcast) || {}, eps = p.episodes || [];
  return eps.map((e) => ({ id: String(e.uuid || '').toLowerCase(), title: String(e.title || ''), published: String(e.published || ''), duration: Number(e.duration) || 0, audio: String(e.url || ''), url: e.uuid ? pcEpisodeUrl(e.uuid) : '' })).filter((e) => e.id);
}

const toMs = (s) => { if (s instanceof Date) return s.getTime(); const t = String(s ?? '').trim(); if (!t) return NaN;
  const j = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);   // V2 の「配信日時 JST」
  if (j) return Date.UTC(+j[1], +j[2] - 1, +j[3], +j[4] - 9, +j[5], +(j[6] || 0));
  return Date.parse(t); };

// v2: [{ ep, show, title, published(JST文字列), guid, audio, duration, current }]  eps: [{ id, title, published, duration, audio, url }]
// opts: { urlOf(ep) → 書くURL, isValidUrl(url), idOfUrl(url), service }
export function matchPlatform(v2, eps, opts) {
  const o = opts || {}, urlOf = o.urlOf, idOfUrl = o.idOfUrl || (() => ''), valid = o.isValidUrl || (() => true);
  const byGuid = {}, byAudio = {}, byMeta = {};
  v2.forEach((r, i) => { const g = String(r.guid || '').toLowerCase(); if (g) (byGuid[g] = byGuid[g] || []).push(i); const a = audioKey(r.audio); if (a) (byAudio[a] = byAudio[a] || []).push(i); (byMeta[nz(r.title)] = byMeta[nz(r.title)] || []).push(i); });
  const pairs = []; // { e, i, method }
  eps.forEach((e) => {
    const clip = String(e.guid || '').toLowerCase() || omnyClipId(e.audio), ak = audioKey(e.audio), hit = new Set(), how = {};   // 配信先が公式GUIDを持つ（Pody）ならそれ、無ければ Omny クリップ
    (clip && byGuid[clip] || []).forEach((i) => { hit.add(i); how[i] = 'GUID'; });
    (ak && byAudio[ak] || []).forEach((i) => { hit.add(i); how[i] = how[i] || 'AUDIO'; });
    if (!hit.size) (byMeta[nz(e.title)] || []).forEach((i) => { const r = v2[i], dt = Math.abs(toMs(r.published) - toMs(e.published)), dd = Math.abs((+r.duration || 0) - e.duration); if (dt <= 60000 && r.duration && dd <= 2) { hit.add(i); how[i] = 'META'; } });
    hit.forEach((i) => pairs.push({ e, i, method: how[i] }));
    if (!hit.size) pairs.push({ e, i: -1, method: '' });
  });
  const perRow = {}, perEp = {};
  pairs.forEach((p) => { if (p.i >= 0) { (perRow[p.i] = perRow[p.i] || []).push(p); (perEp[p.e.id] = perEp[p.e.id] || []).push(p); } });
  const epById = {}; eps.forEach((e) => { epById[e.id] = e; });
  const rows = v2.map((r, i) => {
    const cand = perRow[i] || [], curId = idOfUrl(r.current), out = { ep: r.ep, show: r.show, current: r.current || '', currentId: curId };
    if (curId) { const ce = epById[curId]; if (!ce) out.existingCheck = '既存URLのIDが配信先データに無い'; else { const t = Math.abs(toMs(r.published) - toMs(ce.published)); out.existingCheck = (nz(ce.title) === nz(r.title) ? '既存URLの回: 題名一致' : '既存URLの回: 題名違い') + (isFinite(t) ? '・時刻差' + Math.round(t / 360000) / 10 + 'h' : ''); } }
    if (!cand.length) return Object.assign(out, { verdict: r.current ? '既存URLのみ（配信先データに対応なし）' : '不一致（候補なし）', action: 'NONE' });
    if (cand.length > 1 || cand.some((p) => (perEp[p.e.id] || []).length > 1)) return Object.assign(out, { verdict: '重複（1対1にならない）', action: 'HOLD', candidates: cand.map((p) => p.e.id).join(' ') });
    const p = cand[0], e = p.e, dt = Math.abs(toMs(r.published) - toMs(e.published)), titleSame = nz(r.title) === nz(e.title), url = urlOf(e);
    Object.assign(out, { id: e.id, url, method: p.method, titleSame, hoursApart: isFinite(dt) ? Math.round(dt / 360000) / 10 : '', durationDiff: (+r.duration || 0) && e.duration ? Math.abs(+r.duration - e.duration) : '' });
    if (p.method !== 'META' && !titleSame && !(dt <= 36 * 3600000)) return Object.assign(out, { verdict: '保留: 音声は一致・題名と日時が離れている', action: 'HOLD' });
    if (!valid(url) || idOfUrl(url) !== e.id) return Object.assign(out, { verdict: '保留: URLの形が不正', action: 'HOLD' });
    if (r.current && (r.current === url || (curId && curId === e.id))) return Object.assign(out, { verdict: '一致（既存URLと同じ）', action: 'NONE' });   // 同じ回の番号なら、URLの飾り（Apple の題名部分など）が違っても同じ
    if (r.current) return Object.assign(out, { verdict: '既存URL競合（上書きしない）', action: 'HOLD' });
    return Object.assign(out, { verdict: '確定（空欄に書ける）', action: 'WRITE' });
  });
  const used = new Set(); rows.forEach((x) => { if (x.id) used.add(x.id); });
  const unmatchedEps = eps.filter((e) => !(perEp[e.id] || []).length).map((e) => ({ id: e.id, title: e.title, published: e.published }));
  const existingIds = {}; v2.forEach((r) => { const id = idOfUrl(r.current); if (id) existingIds[id] = (existingIds[id] || 0) + 1; });
  const epIds = new Set(eps.map((e) => e.id));
  const summary = { v2Rows: v2.length, platformEpisodes: eps.length, byVerdict: {}, byMethod: {}, platformUnmatched: unmatchedEps.length,
    existingUrlNotInPlatform: Object.keys(existingIds).filter((id) => !epIds.has(id)).length, existingUrlDuplicated: Object.keys(existingIds).filter((id) => existingIds[id] > 1).length };
  rows.forEach((x) => { summary.byVerdict[x.verdict] = (summary.byVerdict[x.verdict] || 0) + 1; if (x.method && x.action !== 'HOLD') summary.byMethod[x.method] = (summary.byMethod[x.method] || 0) + 1; });
  return { rows, unmatchedEps, summary };
}

// Pody（READ_ONLY調査用）: 番組ページに埋め込まれた episodes の各要素（id・guid・audio・pubDateIso・duration・title）を取り出す。
// 推測で組み立てない: id と guid（または audio）がそろった要素だけを返す。回のURLは「/player/<番組ID>/<回ID>」（ページ内のリンクと同じ形）
export function podyEpisodesFromHtml(html, showId) {
  const h = String(html ?? '').replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/');
  const starts = [...h.matchAll(/\{"id":"([A-Za-z0-9]{20})","pubDateIso":"([^"]+)"/g)];
  const seen = {}, out = [];
  starts.forEach((m, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].index : Math.min(h.length, m.index + 8000), seg = h.slice(m.index, end);
    const f = (key) => { const x = seg.match(new RegExp('"' + key + '":"((?:[^"\\\\]|\\\\.)*)"')); return x ? x[1] : ''; };
    const feed = f('feedId'), id = m[1];
    if (seen[id] || (feed && showId && feed !== showId)) return; seen[id] = 1;
    const guid = f('guid').toLowerCase(), audio = f('audio');
    if (!guid && !audio) return;
    out.push({ id, published: m[2], title: f('title'), duration: Number(f('duration')) || 0, guid, audio, url: 'https://pody.jp/player/' + (feed || showId) + '/' + id });
  });
  return out;
}
export const PODY_EPISODE_URL = /^https:\/\/pody\.jp\/player\/([A-Za-z0-9]{20})\/([A-Za-z0-9]{20})$/;
export const podyIdOf = (url) => { const m = String(url ?? '').trim().match(PODY_EPISODE_URL); return m ? m[2] : ''; };

// ===== Amazon Music（PM-2）=====
// 公開ページは中身の無い枠（HTML 約11KB・回のID・題名・構造化データなし）で、GAS では読めない。公式 Web API はクローズドベータ（LWA 認証・事前承認制）。
// そこで「人と同じ画面（Chrome）で見た証拠」を COPY に記録し、照合はこの純関数で機械的に行う。URL の番号は画面のリンクから写したものだけ（推測で作らない）。
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const AMAZON_EPISODE_URL = new RegExp('^https://music\\.amazon\\.co\\.jp/podcasts/(' + UUID + ')/episodes/(' + UUID + ')$');
// 画面のリンク（末尾に題名の飾り文字が付く）→ 飾りを除いた形。番号は変えない
export function amazonCanonical(url) {
  const m = String(url ?? '').trim().match(new RegExp('^https://music\\.amazon\\.co\\.jp/podcasts/(' + UUID + ')/episodes/(' + UUID + ')(?:/[^?#]*)?(?:[?#].*)?$', 'i'));
  return m ? 'https://music.amazon.co.jp/podcasts/' + m[1].toLowerCase() + '/episodes/' + m[2].toLowerCase() : '';
}
export const amazonIdsOf = (url) => { const m = String(url ?? '').match(AMAZON_EPISODE_URL); return m ? { show: m[1], ep: m[2] } : null; };
// 画面の長さ表示 → 秒の範囲。「1時間3分」は分まで（切り捨て表示）、「47分1秒」は秒まで
export function amazonDurationRange(text) {
  const t = String(text ?? '').replace(/^'/, '').trim(), h = t.match(/(\d+)時間/), m = t.match(/(\d+)分/), s = t.match(/(\d+)秒/);
  if (!h && !m && !s) return null;
  const base = (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (s ? +s[1] : 0);
  return s ? { min: base - 2, max: base + 2 } : { min: base, max: base + 59 };
}
// 画面の日付「2024年2月5日」→ その日の UTC 0時（Amazon の日付は配信時刻の UTC の日付と一致した: 2026/10/10 04:00 JST → 10月9日）
export function amazonDayMs(text) { const m = String(text ?? '').match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
// v2: 台帳の行（同じ番組）。ev: { url, show, date, title, duration, ep(調べたEP-ID) }。showId: サイト掲載で確認できた Amazon の番組ID
// 確定（VERIFIED）の条件（緩めない）: 番組IDが一致・題名が同じ（全角半角と空白だけ揃える）でその番組の行がちょうど1つ・日付が配信時刻の±1日以内・長さが表示の範囲内
export function amazonEvidenceMatch(v2, evs, showId) {
  const byTitle = {}; v2.forEach((r) => { (byTitle[nz(r.title)] = byTitle[nz(r.title)] || []).push(r); });
  const usedEp = {}, usedUrl = {}, out = evs.map((ev) => {
    const url = amazonCanonical(ev.url), ids = amazonIdsOf(url), o = { asked: ev.ep || '', url, status: '', reason: '', ep: '' };
    if (!ev.url) return Object.assign(o, { status: 'UNAVAILABLE', reason: '画面で見つからない（' + String(ev.title || '').slice(0, 60) + '）' });
    if (!ids) return Object.assign(o, { status: 'HOLD', reason: 'URLの形が Amazon の回ではない' });
    const cand = byTitle[nz(ev.title)] || [];
    if (!cand.length) return Object.assign(o, { status: 'CANDIDATE', reason: '題名が台帳と一致しない' });
    if (cand.length > 1) return Object.assign(o, { status: 'HOLD', reason: '同じ題名の行が複数', ep: cand.map((r) => r.ep).join(' ') });
    const r = cand[0]; o.ep = r.ep;
    if (!showId || ids.show !== showId) return Object.assign(o, { status: 'CANDIDATE', reason: '番組IDが未確認か一致しない' });
    if (ev.ep && ev.ep !== r.ep) return Object.assign(o, { status: 'HOLD', reason: '調べた回と題名の一致した回が違う' });
    const day = amazonDayMs(ev.date), pub = toMs(r.published), dur = amazonDurationRange(ev.duration);
    const dayOk = isFinite(day) && isFinite(pub) && pub >= day - 86400000 && pub < day + 2 * 86400000;
    const durOk = dur && r.duration && r.duration >= dur.min && r.duration <= dur.max;
    if (!dayOk || !durOk) return Object.assign(o, { status: 'CANDIDATE', reason: '題名は一致・' + (!dayOk ? '日付が離れている' : '長さが合わない') });
    if (r.current && r.current !== url) return Object.assign(o, { status: 'HOLD', reason: '既存URL競合（上書きしない）' });
    return Object.assign(o, { status: r.current === url ? 'VERIFIED_SAME' : 'VERIFIED', reason: '番組ID・題名・日付・長さが一致' });
  });
  // 1対1: 同じURLや同じ行が2回出たら両方保留
  out.forEach((x) => { if (x.url) usedUrl[x.url] = (usedUrl[x.url] || 0) + 1; if (x.ep && /^VERIFIED/.test(x.status)) usedEp[x.ep] = (usedEp[x.ep] || 0) + 1; });
  out.forEach((x) => { if (/^VERIFIED/.test(x.status) && (usedUrl[x.url] > 1 || usedEp[x.ep] > 1)) { x.status = 'HOLD'; x.reason = '重複（1対1にならない）'; } });
  return out;
}

// ===== 7サービス共通の集計（PM-2）=====
// 台帳のセルを形で分ける: 個別の回URL／番組トップのみ／空欄／その他。形が正しいことは「その回で正しい」ことの証明ではない（照合の結果は各サービスの照合表で見る）
export const SERVICE_SHAPES = {
  Spotify: { ep: /^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}$/, show: /^https:\/\/open\.spotify\.com\/show\// },
  Apple: { ep: /^https:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^?]*\/?id\d+\?(?:.*&)?i=\d+/, show: /^https:\/\/podcasts\.apple\.com\// },
  Amazon: { ep: AMAZON_EPISODE_URL, show: /^https:\/\/music\.amazon\.(?:co\.jp|com)\/podcasts\/[0-9a-f-]{36}\/?(?:[^/]*)$/ },
  'Pocket Casts': { ep: PC_EPISODE_URL, show: /^https:\/\/(?:pca\.st|pocketcasts\.com)\/(?:podcast\/|itunes\/|[A-Za-z0-9]+$)/ },
  LISTEN: { ep: /^https:\/\/listen\.style\/p\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/, show: /^https:\/\/listen\.style\/p\/[A-Za-z0-9_-]+\/?$/ },
  Pody: { ep: PODY_EPISODE_URL, show: /^https:\/\/pody\.jp\/player\/[A-Za-z0-9]{20}\/?$/ },
  YouTube: { ep: /^https:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{11}/, show: /^https:\/\/(?:www\.)?youtube\.com\/(?:@|playlist|channel)/ }
};
export function cellShape(service, value) {
  const v = String(value ?? '').trim(), s = SERVICE_SHAPES[service]; if (!v) return 'EMPTY'; if (!s) return 'OTHER';
  return s.ep.test(v) ? 'EPISODE' : s.show.test(v) ? 'SHOW_ONLY' : 'OTHER';
}
// rows: [{ show, values: { Spotify: '...', ... } }] → サービスごと・番組ごとの件数
export function serviceTally(rows) {
  const t = {};
  rows.forEach((r) => Object.keys(SERVICE_SHAPES).forEach((sv) => { const k = cellShape(sv, r.values[sv]); const a = (t[sv] = t[sv] || { total: 0, EPISODE: 0, SHOW_ONLY: 0, EMPTY: 0, OTHER: 0, byShow: {} }); a.total++; a[k]++; const b = (a.byShow[r.show] = a.byShow[r.show] || { total: 0, EPISODE: 0, SHOW_ONLY: 0, EMPTY: 0, OTHER: 0 }); b.total++; b[k]++; }));
  return t;
}

// ===== 新着の7サービス照合（PM-3）=====
// Apple: 公式の iTunes Search API（lookup・認証不要）。回ごとに episodeGuid（＝公式GUID）と trackViewUrl（回のURL）が返る
export const APPLE_EPISODE_URL = /^https:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^?\s]*\/?id\d+\?(?:[^#\s]*&)?i=(\d+)/;
export const appleIdOf = (url) => { const m = String(url ?? '').trim().match(APPLE_EPISODE_URL); return m ? m[1] : ''; };
export function appleEpisodesFromLookup(json) {
  return ((json && json.results) || []).filter((x) => x.wrapperType === 'podcastEpisode' && x.trackId && x.trackViewUrl)
    .map((x) => ({ id: String(x.trackId), title: String(x.trackName || ''), published: String(x.releaseDate || ''), duration: Math.round((Number(x.trackTimeMillis) || 0) / 1000), guid: String(x.episodeGuid || '').toLowerCase(), audio: String(x.episodeUrl || ''), url: String(x.trackViewUrl) }));
}
export const appleShowIdOf = (url) => { const m = String(url ?? '').match(/\/id(\d+)/); return m ? m[1] : ''; };
// LISTEN: 番組ページに載っている公開RSS（rss.listen.style/p/<番組>/rss）。各回の <link> が回のURL、<guid> が元の公式GUID
export const LISTEN_EPISODE_URL = /^https:\/\/listen\.style\/p\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/;
export const listenIdOf = (url) => { const m = String(url ?? '').trim().match(LISTEN_EPISODE_URL); return m ? m[2] : ''; };
export const listenShowIdOf = (url) => { const m = String(url ?? '').trim().match(LISTEN_EPISODE_URL); return m ? m[1] : ''; };
export function listenRssUrlFromHtml(html, showId) {
  const re = new RegExp('https://rss\\.listen\\.style/p/' + String(showId).replace(/[^A-Za-z0-9_-]/g, '') + '/rss'), m = String(html ?? '').match(re);
  return m ? m[0] : '';
}
const unxml = (s) => String(s ?? '').replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
export const durationSec = (s) => { const t = String(s ?? '').trim(); if (/^\d+$/.test(t)) return +t; const p = t.split(':').map(Number); if (p.some(isNaN)) return 0; return p.reduce((a, b) => a * 60 + b, 0); };
// RSS の <item> を共通の形へ。maxItems で新しい方から数を絞れる（新着だけ見るとき）
export function rssEpisodes(xml, maxItems) {
  const parts = String(xml ?? '').split(/<item[\s>]/).slice(1, maxItems ? maxItems + 1 : undefined);
  return parts.map((it) => {
    const tag = (n) => { const m = it.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>')); return m ? unxml(m[1]) : ''; };
    const enc = (it.match(/<enclosure[^>]*\surl="([^"]+)"/) || [])[1] || '';
    const link = tag('link'), id = listenIdOf(link);
    return { id, title: tag('title'), published: tag('pubDate'), duration: durationSec(tag('itunes:duration')), guid: tag('guid').toLowerCase(), audio: unxml(enc), url: link };
  }).filter((e) => e.id);
}
// 新着の対象: 配信日時が now から days 日以内の行
export function recentRows(rows, nowMs, days) {
  const lim = nowMs - days * 86400000;
  return rows.filter((r) => { const t = toMs(r.published); return isFinite(t) && t >= lim && t <= nowMs + 86400000; });
}
