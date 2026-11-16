// P27 配信先URLロボ: 配信先のエピソード一覧と V2・統合台帳の各回を1対1で結ぶ（純関数・Node と GAS 共通）。
// 2026-11-17 司令塔「P27 第2段階実行指令」。設計: docs/design/2026-11-17-platform-url-robot-design.md
// 本人確認の基準（緩めない）:
//   GUID  … 配信先の音声URLに含まれる Omny のクリップID ＝ V2 の公式GUID
//   AUDIO … 配信先の音声URL ＝ V2 の音声URL（計測用の前置き・クエリを除いた同じファイル）
//   META  … 番組が同じ・題名が同じ（全角半角と空白だけ揃える）・配信時刻±60秒・長さ±2秒
//   GUID/AUDIO は「題名が同じ」か「配信時刻が36時間以内」のどちらかも満たすときだけ確定（音声だけ一致して中身が違う事故を防ぐ）。
// 1対1でないもの（同じ配信先の回が複数のV2行に当たる・その逆）は全部保留。既にV2に別のURLがあれば上書きせず「既存URL競合」。
export const PLATFORM_MATCH_VERSION = 'PM-1';

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
    const clip = omnyClipId(e.audio), ak = audioKey(e.audio), hit = new Set(), how = {};
    (clip && byGuid[clip] || []).forEach((i) => { hit.add(i); how[i] = 'GUID'; });
    (ak && byAudio[ak] || []).forEach((i) => { hit.add(i); how[i] = how[i] || 'AUDIO'; });
    if (!hit.size) (byMeta[nz(e.title)] || []).forEach((i) => { const r = v2[i], dt = Math.abs(toMs(r.published) - toMs(e.published)), dd = Math.abs((+r.duration || 0) - e.duration); if (dt <= 60000 && r.duration && dd <= 2) { hit.add(i); how[i] = 'META'; } });
    hit.forEach((i) => pairs.push({ e, i, method: how[i] }));
    if (!hit.size) pairs.push({ e, i: -1, method: '' });
  });
  const perRow = {}, perEp = {};
  pairs.forEach((p) => { if (p.i >= 0) { (perRow[p.i] = perRow[p.i] || []).push(p); (perEp[p.e.id] = perEp[p.e.id] || []).push(p); } });
  const rows = v2.map((r, i) => {
    const cand = perRow[i] || [], curId = idOfUrl(r.current), out = { ep: r.ep, show: r.show, current: r.current || '', currentId: curId };
    if (!cand.length) return Object.assign(out, { verdict: r.current ? '既存URLのみ（配信先データに対応なし）' : '不一致（候補なし）', action: 'NONE' });
    if (cand.length > 1 || cand.some((p) => (perEp[p.e.id] || []).length > 1)) return Object.assign(out, { verdict: '重複（1対1にならない）', action: 'HOLD', candidates: cand.map((p) => p.e.id).join(' ') });
    const p = cand[0], e = p.e, dt = Math.abs(toMs(r.published) - toMs(e.published)), titleSame = nz(r.title) === nz(e.title), url = urlOf(e);
    Object.assign(out, { id: e.id, url, method: p.method, titleSame, hoursApart: isFinite(dt) ? Math.round(dt / 360000) / 10 : '', durationDiff: (+r.duration || 0) && e.duration ? Math.abs(+r.duration - e.duration) : '' });
    if (p.method !== 'META' && !titleSame && !(dt <= 36 * 3600000)) return Object.assign(out, { verdict: '保留: 音声は一致・題名と日時が離れている', action: 'HOLD' });
    if (!valid(url) || idOfUrl(url) !== e.id) return Object.assign(out, { verdict: '保留: URLの形が不正', action: 'HOLD' });
    if (r.current && r.current === url) return Object.assign(out, { verdict: '一致（既存URLと同じ）', action: 'NONE' });
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

// Pody（READ_ONLY調査用）: 番組ページのHTMLから回のID・音声URL・題名の組を取り出す（推測で組み立てない。見つかった組だけ）
export function podyEpisodesFromHtml(html, showId) {
  const h = String(html ?? '').replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/');
  const ids = [...new Set([...h.matchAll(new RegExp('/player/' + showId + '/([A-Za-z0-9]{20})(?![A-Za-z0-9])', 'g'))].map((m) => m[1]))];
  const out = ids.map((id) => {
    const at = h.indexOf(id), win = at >= 0 ? h.slice(Math.max(0, at - 3000), at + 3000) : '';
    const audios = [...new Set((win.match(/https?:\/\/[^"'\s<>]+?\.mp3[^"'\s<>]*/g) || []))];
    return { id, url: 'https://pody.jp/player/' + showId + '/' + id, audioNear: audios.length === 1 ? audios[0] : '', audioCandidates: audios.length };
  });
  return out;
}
