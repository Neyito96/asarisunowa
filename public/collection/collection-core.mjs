/** 朝リスの田「エピソード集」コア(純粋関数・IOなし)。プラットフォーム非依存。
 * 原則: 番組URLと個別エピソードURLを混同しない。欠落は欠落として表示し、推測URLを作らない。公式API能力は platforms.json の「確認済み」だけを根拠にする。 */
export const SERVICES = Object.freeze(['spotify', 'apple', 'amazon', 'pocketcasts', 'listen', 'pody', 'youtube']);
export const SERVICE_LABEL = Object.freeze({spotify: 'Spotify', apple: 'Apple Podcasts', amazon: 'Amazon Music', pocketcasts: 'Pocket Casts', listen: 'LISTEN', pody: 'Pody', youtube: 'YouTube', asahi: '朝日新聞(公式)', omny: '配信元(Omny)'});
/** URL → {service, kind:'episode'|'show'|'other'}。個別エピソードと判定できる形だけ episode。 */
export function classifyLink(url) {
  let u; try { u = new URL(url); } catch { return {service: null, kind: 'other'}; } if (u.protocol !== 'https:') return {service: null, kind: 'other'};
  const h = u.hostname.replace(/^www\./, ''), p = u.pathname;
  if (h === 'open.spotify.com') return {service: 'spotify', kind: /^\/episode\/[A-Za-z0-9]{22}\/?$/.test(p) ? 'episode' : 'show'};
  if (h === 'podcasts.apple.com') return {service: 'apple', kind: /^\d+$/.test(u.searchParams.get('i') || '') ? 'episode' : 'show'};
  if (/^music\.amazon\./.test(h)) return {service: 'amazon', kind: /\/podcasts\/[^/]+\/episodes\//.test(p) ? 'episode' : 'show'};
  if (h === 'pca.st') return {service: 'pocketcasts', kind: /^\/episode\//.test(p) ? 'episode' : 'show'};
  if (h === 'play.pocketcasts.com') return {service: 'pocketcasts', kind: /\/episode\//.test(p) ? 'episode' : 'show'};
  if (h === 'listen.style') return {service: 'listen', kind: /^\/p\/[^/]+\/[^/]+\/?$/.test(p) ? 'episode' : 'show'};
  if (/(^|\.)pody\./.test(h)) return {service: 'pody', kind: /episode|\/e\//.test(p) ? 'episode' : 'show'};
  if (h === 'youtube.com' || h === 'm.youtube.com') return {service: 'youtube', kind: p === '/watch' && u.searchParams.get('v') ? 'episode' : 'show'};
  if (h === 'youtu.be') return {service: 'youtube', kind: p.length > 1 ? 'episode' : 'show'};
  if (h === 'asahi.com') return {service: 'asahi', kind: /\/podcasts\/item\//.test(p) && u.searchParams.get('itemid') ? 'episode' : 'other'};
  if (h === 'omny.fm') return {service: 'omny', kind: /^\/shows\/[^/]+\/[^/]+\/?$/.test(p) ? 'episode' : 'show'};
  return {service: null, kind: 'other'};
}
/** エピソードの links から、サービス別の個別EP URLを取り出す。 */
export function serviceLinks(ep) {
  const out = {}, showOnly = {};
  for (const l of ep?.links || []) { const c = classifyLink(l); if (!c.service) continue; if (c.kind === 'episode') out[c.service] ??= l; else showOnly[c.service] ??= l; }
  return {episode: out, showOnly};
}
/** 選択サービスでのリンク解決。status: EXACT(個別EP) / SHOW_ONLY(番組止まり=個別と偽らない) / MISSING。fallback は根拠ある別サービスの個別EP(公式ページ等)。 */
export function resolveLink(ep, service) {
  const {episode, showOnly} = serviceLinks(ep);
  if (episode[service]) return {status: 'EXACT', service, url: episode[service]};
  const fb = ['asahi', 'omny'].find(s => episode[s]);
  return {status: showOnly[service] ? 'SHOW_ONLY' : 'MISSING', service, url: null, showUrl: showOnly[service] || null, fallback: fb ? {service: fb, url: episode[fb]} : null};
}
/** 集計: 各サービスで個別EPリンクがある件数(欠損の見える化)。 */
export function coverage(episodes) {
  const c = Object.fromEntries([...SERVICES, 'asahi', 'omny'].map(s => [s, {exact: 0, showOnly: 0}]));
  for (const e of episodes) { const {episode, showOnly} = serviceLinks(e); for (const s of Object.keys(c)) { if (episode[s]) c[s].exact++; else if (showOnly[s]) c[s].showOnly++; } }
  return {total: episodes.length, byService: c};
}
// ---- コレクション(順序つき・重複なし) ----
export const MAX_ITEMS = 100, EP_ID = /^EP-\d{5}$/;
export const createCollection = (title = '', service = 'spotify') => ({title: String(title).slice(0, 60), service: SERVICES.includes(service) ? service : 'spotify', ids: []});
export function addIds(col, ids) { const set = new Set(col.ids); const next = [...col.ids]; for (const id of ids) if (EP_ID.test(id) && !set.has(id) && next.length < MAX_ITEMS) { set.add(id); next.push(id); } return {...col, ids: next}; }
export const removeId = (col, id) => ({...col, ids: col.ids.filter(x => x !== id)});
export function move(col, id, delta) { const i = col.ids.indexOf(id), j = i + delta; if (i < 0 || j < 0 || j >= col.ids.length) return col; const ids = [...col.ids]; [ids[i], ids[j]] = [ids[j], ids[i]]; return {...col, ids}; }
// ---- 共有URL(ハッシュ。サーバー・DB・認証なし) ----
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export const encodeShare = col => b64(JSON.stringify({v: 1, t: col.title, s: col.service, i: col.ids.map(x => Number(x.slice(3)))}));
export function decodeShare(token) {
  try { const o = JSON.parse(unb64(String(token || ''))); if (o.v !== 1 || !Array.isArray(o.i)) return null;
    return addIds(createCollection(o.t, o.s), o.i.filter(n => Number.isInteger(n) && n >= 0 && n < 1e5).map(n => 'EP-' + String(n).padStart(5, '0'))); } catch { return null; }
}
// ---- 出力(コピー・メール)。ユーザー操作でのみ使う ----
export function toText(col, episodes, {siteUrl = ''} = {}) {
  const by = new Map(episodes.map(e => [e.id, e])), lines = [col.title || '朝リスのエピソード集', `(${SERVICE_LABEL[col.service]}で聴く)`, ''];
  col.ids.forEach((id, i) => { const e = by.get(id); if (!e) { lines.push(`${i + 1}. ${id}(データ未取得)`); return; } const r = resolveLink(e, col.service);
    lines.push(`${i + 1}. ${e.title}(${e.show} ${String(e.date || '').slice(0, 10)})`, r.status === 'EXACT' ? `   ${r.url}` : r.fallback ? `   ※${SERVICE_LABEL[col.service]}の個別リンクは未登録。${SERVICE_LABEL[r.fallback.service]}: ${r.fallback.url}` : `   ※${SERVICE_LABEL[col.service]}の個別リンクは未登録`); });
  if (siteUrl) lines.push('', siteUrl); return lines.join('\n');
}
export const mailtoUrl = (col, episodes, opts) => 'mailto:?subject=' + encodeURIComponent(col.title || '朝リスのエピソード集') + '&body=' + encodeURIComponent(toText(col, episodes, opts).slice(0, 1500));
