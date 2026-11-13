// V2統合台帳の総合監査（2026-11-13 司令塔指令）。読むだけの判定ロジック。GAS（清掃ロボ）と Node テストの両方から使う。
// 方針: 推測でURLを作らない。番組トップURLを個別エピソードURLとして数えない。件数一致だけで合格にしない。
import { SDGS_OFFICIAL } from './sdgs-official-1092.mjs';

export const LEDGER_AUDIT_VERSION = 'LA-1';
export const PLATFORM_COLUMNS = ['Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube'];
// 個別エピソードURLの形（番組トップ・検索結果は episode にしない）
const EPISODE_RE = {
  Spotify: /^https:\/\/open\.spotify\.com\/episode\/[A-Za-z0-9]{22}(?:[?#].*)?$/,
  Apple: /^https:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^?#]*\/id\d+\?(?:.*&)?i=\d+/,
  Amazon: /^https:\/\/music\.amazon\.[a-z.]+\/podcasts\/[0-9a-f-]{36}\/episodes\/[0-9a-f-]{36}/i,
  'Pocket Casts': /^https:\/\/pca\.st\/episode\/[0-9a-f-]{36}/i,
  LISTEN: /^https:\/\/listen\.style\/p\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?(?:[?#].*)?$/,
  Pody: /^https:\/\/pody\.jp\/[^?#]*(?:episode|episodes|e)\/[A-Za-z0-9_-]+/i,
  YouTube: /^https:\/\/(?:www\.youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)[A-Za-z0-9_-]{11}/,
};
const SHOW_RE = {
  Spotify: /^https:\/\/open\.spotify\.com\/show\//, Apple: /^https:\/\/podcasts\.apple\.com\/[a-z]{2}\/podcast\/[^?#]*\/id\d+\/?(?:\?(?!(?:.*&)?i=).*)?$/,
  Amazon: /^https:\/\/music\.amazon\.[a-z.]+\/podcasts\/[0-9a-f-]{36}\/?(?:[?#].*)?$/i, 'Pocket Casts': /^https:\/\/pca\.st\/(?:podcast\/)?[A-Za-z0-9_-]+\/?$/,
  LISTEN: /^https:\/\/listen\.style\/p\/[A-Za-z0-9_-]+\/?$/, Pody: /^https:\/\/pody\.jp\//i, YouTube: /^https:\/\/www\.youtube\.com\/(?:@|channel\/|playlist\?)/,
};
// 1セルの判定: EMPTY（未処理・空欄）／EPISODE（個別EPの形）／SHOW_TOP（番組トップ等＝個別EPの代用は不可）／OTHER（形が不明・要確認）
export function classifyPlatformUrl(platform, url) {
  const u = String(url ?? '').trim(); if (!u) return 'EMPTY';
  if (EPISODE_RE[platform] && EPISODE_RE[platform].test(u)) return 'EPISODE';
  if (SHOW_RE[platform] && SHOW_RE[platform].test(u)) return 'SHOW_TOP';
  return 'OTHER';
}

// 公式個別URL: 朝日新聞ポッドキャストの個別ページ（itemid=公式GUID）。台帳の既存値の形を確かめるだけで、ここでは作らない
export const OFFICIAL_ITEM_BASE = 'https://www.asahi.com/special/podcasts/item/?itemid=';
export function officialItemId(url) { const m = String(url ?? '').match(/^https:\/\/www\.asahi\.com\/special\/podcasts\/item\/\?itemid=([0-9a-f-]{36})(?:&.*)?$/i); return m ? m[1].toLowerCase() : ''; }
// 補完の候補（確認前）: 公式個別URLが空で、GUIDがUUIDの形の行だけ。書くのは公式ページを取得して canonical の itemid が一致した後だけ（GAS 側）
export function officialUrlCandidate(row) {
  if (String(row.officialUrl ?? '').trim()) return { status: 'HAS_VALUE' };
  const g = String(row.guid ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(g)) return { status: 'NO_GUID' };
  return { status: 'CANDIDATE', url: OFFICIAL_ITEM_BASE + g, guid: g };
}
// 取得した公式ページが本物か: HTTP 200 かつ canonical（または og:url）の itemid が GUID と一致する時だけ VERIFIED
export function verifyOfficialPage(code, html, guid) {
  if (code === 404 || code === 410) return { status: 'NOT_FOUND', reason: 'HTTP_' + code };
  if (code !== 200) return { status: 'ERROR', reason: 'HTTP_' + code };
  const h = String(html ?? ''), can = (h.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || h.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
  const id = officialItemId(can.replace(/&amp;/g, '&'));
  if (!id) return { status: 'HOLD', reason: 'NO_CANONICAL_ITEMID' };
  if (id !== String(guid).toLowerCase()) return { status: 'HOLD', reason: 'CANONICAL_MISMATCH ' + id };
  return { status: 'VERIFIED', reason: 'CANONICAL_ITEMID_MATCH' };
}

// SDGs 1,092件の採用監査: 公式1件ごとに台帳の行を GUID → 公式個別URLの itemid → 公式JSON UUID の順で探す。タイトルだけでは結び付けない
const num = (t) => { const m = String(t ?? '').match(/#\s*(\d+)\s*$/); return m ? m[1] : ''; };
const day = (d) => { const m = String(d ?? '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : ''; };
const normTitle = (t) => String(t ?? '').normalize('NFKC').replace(/[\s　"“”「」『』]/g, '');
export const SDGS_AUDIT_HEADERS = ['区分', '判定', '理由', '公式UUID', '公式番号', '公式タイトル', '公式配信日', '公式個別URL', 'EP-ID', '台帳行', '台帳番組', '台帳タイトル', '台帳配信日', '掲載判定', '代表EP-ID', '台帳GUID', '台帳公式個別URL', '一致方法', '差異'];
export function auditSdgs(rows, official = SDGS_OFFICIAL, show = 'SDGsを話そう') {
  const byGuid = new Map(), byItem = new Map(), byUuid = new Map(), used = new Set(), out = [];
  const add = (m, k, r) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); };
  rows.forEach((r) => { add(byGuid, String(r.guid || '').toLowerCase(), r); add(byItem, officialItemId(r.officialUrl), r); add(byUuid, String(r.jsonUuid || '').toLowerCase(), r); });
  for (const [uuid, title, date, url] of official) {
    let hit = byGuid.get(uuid), how = 'GUID'; if (!hit) { hit = byItem.get(uuid); how = '公式個別URL'; } if (!hit) { hit = byUuid.get(uuid); how = '公式JSON UUID'; }
    const base = { uuid, no: num(title), title, date, url };
    if (!hit) { out.push(row('公式', '要確認', '台帳に該当行なし（未収蔵か、GUID・URLが未記録）', base, null, '')); continue; }
    if (hit.length > 1) { hit.forEach((h) => used.add(h)); out.push(row('公式', '要確認', '台帳に同じ公式UUIDの行が' + hit.length + '行', base, hit[0], how, hit.map((h) => (h.ep || '(EP-IDなし)') + '@' + h.row).join(' '))); continue; }
    const h = hit[0]; used.add(h);
    const diff = [h.show !== show ? '番組=' + h.show : '', normTitle(h.title) !== normTitle(title) ? 'タイトル' : '', day(h.date) && day(h.date) !== day(date) ? '配信日' : '', h.officialUrl && officialItemId(h.officialUrl) !== uuid ? '公式個別URL' : '', !h.officialUrl ? '公式個別URL空欄' : ''].filter(Boolean).join('・');
    let verdict, why;
    if (!h.ep) { verdict = '要確認'; why = 'EP-IDのない行'; }
    else if (h.judge === '対象' && h.rep === h.ep) { verdict = '採用'; why = '公開対象（代表EP）'; }
    else if (h.judge === '対象') { verdict = '除外'; why = '同一内容の代表は ' + h.rep; }
    else if (h.judge === '対象外') { verdict = '除外'; why = '掲載判定=対象外' + (h.reason ? '（' + h.reason + '）' : ''); }
    else { verdict = '保留'; why = '掲載判定=' + (h.judge || '空') + (h.reason ? '（' + h.reason + '）' : ''); }
    out.push(row('公式', verdict, why, base, h, how, diff));
  }
  rows.filter((r) => r.show === show && !used.has(r)).forEach((h) => out.push(row('台帳のみ', h.judge === '対象' && h.rep === h.ep ? '要確認' : (h.judge === '対象外' ? '除外' : '保留'), '公式1,092件に一致しない' + show + 'の行（旧データ・再配信・未照合）', { uuid: '', no: num(h.title), title: '', date: '', url: '' }, h, '', '')));
  const count = {}; out.forEach((o) => { const k = o[0] + '・' + o[1]; count[k] = (count[k] || 0) + 1; });
  return { rows: out, count, official: official.length };
  function row(kind, verdict, why, b, h, how, diff) { return [kind, verdict, why, b.uuid, b.no, b.title, b.date, b.url, h ? h.ep : '', h ? String(h.row) : '', h ? h.show : '', h ? h.title : '', h ? h.date : '', h ? h.judge : '', h ? h.rep : '', h ? h.guid : '', h ? h.officialUrl : '', how, diff || '']; }
}

// 関連記事索引: 1記事1行。見出しは保全原文の清掃結果をそのまま使い、無ければ「未取得」（作らない）。URL は台帳と原文の両方を残す
export const RELATED_HEADERS = ['EP-ID', '番号', '見出し', 'URL', 'リンク', '出典', '元URL（原文の表記）'];
// 記事URLの照合キー: 追跡用の付け足し（iref・utm_*・「?irefomny」の書き損じ）と # 以降だけ外す。他の ? 付き（rensai の id= など）は別記事として残す
export function articleKey(u) {
  let s = String(u ?? '').trim().replace(/^http:\/\//i, 'https://'), hash = s.indexOf('#'); if (hash >= 0) s = s.slice(0, hash);
  const q = s.indexOf('?'); if (q < 0) return s;
  const keep = s.slice(q + 1).split('&').filter((p) => p && !/^(?:i?ref(?:omny)?(?:=omny|=.*)?|utm_[a-z]+=.*|cid=.*)$/i.test(p));
  return s.slice(0, q) + (keep.length ? '?' + keep.join('&') : '');
}
// 関連記事索引: 1記事1行。見出しは保全原文の清掃結果をそのまま使い、無ければ「未取得」（作らない）。
// 原文の記事と台帳の関連記事URL列の記事は articleKey で同じ記事と見なし1行にまとめる（台帳だけ ?iref=omny が付く等で二重に数えない）。台帳の表記が違う時は元URL欄に残す
export function relatedRows(ep, related, ledgerUrls) {
  const out = [], byKey = new Map();
  (related || []).forEach((r) => { const u = String(r.url || '').trim(); if (!u) return; const k = articleKey(u); if (byKey.has(k)) return; const row = { ep, url: u, title: String(r.title || '').trim() || '未取得', source: '概要原文（公式RSS）', original: [r.originalUrl || u] }; byKey.set(k, row); if (r.originalUrl) byKey.set(articleKey(r.originalUrl), row); out.push(row); });
  String(ledgerUrls || '').split(/[\s\n]+/).filter((u) => /^https?:\/\//.test(u)).forEach((u) => { const k = articleKey(u), hit = byKey.get(k); if (hit) { if (hit.original.indexOf(u) < 0 && hit.url !== u) hit.original.push('台帳: ' + u); return; } const row = { ep, url: u, title: '未取得', source: '統合台帳 関連記事URL（既存値）', original: [u] }; byKey.set(k, row); out.push(row); });
  return out.map((r, i) => [r.ep, String(i + 1), r.title, r.url, hyperlink(r.url, r.title === '未取得' ? r.url : r.title), r.source, r.original.join(' / ')]);
}
// シートに文字として書く時、先頭の「'」は Sheets が「文字列の印」として消してしまう（表示が1文字短くなり毎回差分になる）。先頭が ' なら ' をもう1つ付けて原文どおり表示させる
export function sheetText(s) { const t = String(s ?? ''); return t.charAt(0) === "'" ? "'" + t : t; }
// シートのリンク表示。式の中の " は "" に、長すぎる見出しは切る（式は 50,000 字まで・見出しは表示用）
export function hyperlink(url, label) { const q = (s) => String(s).replace(/"/g, '""'); return '=HYPERLINK("' + q(url) + '","' + q(String(label).slice(0, 200)) + '")'; }

// 番組（B列）別の件数。公開対象は「掲載判定=対象 かつ 代表EP」だけ数える（再配信・重複の二重計上を防ぐ）
export const PLAYLIST_HEADERS = ['番組', '全行', '公開対象（代表EP）', '対象（代表でない）', '対象外', '保留', '未判定', 'その他', 'EP-IDなし', '最初の配信日', '最後の配信日'];
export function playlistCounts(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.show || '(番組なし)'; if (!m.has(k)) m.set(k, { all: 0, pub: 0, dup: 0, out: 0, hold: 0, none: 0, other: 0, noEp: 0, first: '', last: '' }); const c = m.get(k); c.all++;
    if (!r.ep) c.noEp++; else if (r.judge === '対象') { if (r.rep === r.ep) c.pub++; else c.dup++; } else if (r.judge === '対象外') c.out++; else if (r.judge === '保留') c.hold++; else if (r.judge === '未判定' || !r.judge) c.none++; else c.other++;
    const d = day(r.date); if (d) { if (!c.first || d < c.first) c.first = d; if (!c.last || d > c.last) c.last = d; } });
  return [...m].sort((a, b) => b[1].all - a[1].all).map(([k, c]) => [k, c.all, c.pub, c.dup, c.out, c.hold, c.none, c.other, c.noEp, c.first, c.last]);
}
