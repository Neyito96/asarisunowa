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
// itemid は UUID（Omny 配信）だけでなく、Megaphone 配信の回（ニュースの学校など）は配信ホスト固有ID（例 TASC4073670976）になる
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normId = (id) => (UUID_RE.test(String(id)) ? String(id).toLowerCase() : String(id));
export function officialItemId(url) { const m = String(url ?? '').match(/^https:\/\/www\.asahi\.com\/special\/podcasts\/item\/\?itemid=([A-Za-z0-9-]{6,64})(?:&.*)?$/i); return m ? normId(m[1]) : ''; }
// 音声URLから配信ホスト固有IDを取る（Megaphone: traffic.megaphone.fm/TASC4073670976.mp3。pdst.fm などの計測用前置きも許す）
export function hostIdFromAudio(url) { const m = String(url ?? '').match(/megaphone\.fm\/([A-Z]{2,10}\d{6,})\.mp3/); return m ? m[1] : ''; }
// 公式個別ページの候補（確認前）。優先順: おんさ共有台帳の Asahi.com URL（他人の記録なので必ずこちらでも確かめる）→ Megaphone の配信ホストID → UUID 形式の GUID。
// Megaphone の回は GUID が UUID でも GUID を itemid に使わない（公式ページは配信ホストIDで引くため）。key は照合に使う itemid
export function officialUrlCandidate(row) {
  if (String(row.officialUrl ?? '').trim()) return { status: 'HAS_VALUE' };
  const onsaId = officialItemId(row.onsaAsahiUrl), host = hostIdFromAudio(row.audioUrl), g = String(row.guid ?? '').trim();
  if (onsaId) return { status: 'CANDIDATE', url: OFFICIAL_ITEM_BASE + onsaId, key: onsaId, guid: onsaId, kind: 'おんさ記録のURL' };
  if (host) return { status: 'CANDIDATE', url: OFFICIAL_ITEM_BASE + host, key: host, guid: host, kind: 'Megaphone配信ID' };
  if (UUID_RE.test(g)) return { status: 'CANDIDATE', url: OFFICIAL_ITEM_BASE + g.toLowerCase(), key: g.toLowerCase(), guid: g.toLowerCase(), kind: '公式GUID' };
  return { status: 'NO_GUID' };
}
const pageText = (h) => String(h ?? '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const flat = (t) => String(t ?? '').normalize('NFKC').replace(/[\s　「」『』"“”'’（）()【】\[\]・、。,.!！?？:：/／#＃-]/g, '').toLowerCase();
// 取得した公式ページが本物か: HTTP 200・canonical（または og:url）の itemid が期待するIDと一致・（タイトルを渡した時は）ページにそのタイトルがある、の全部を満たす時だけ VERIFIED
// 公式ページの照合: ID（canonical の itemid）・タイトル・番組・配信日の4つ。渡された条件は全部そろった時だけ VERIFIED。
// 番組はページ内（パンくず）に番組名があること、配信日はページの日付（YYYY/MM/DD）が台帳の日付と±1日以内（JST と配信基準日のずれ）
// 公式サイトで別番組の下に載る回がある（その番組の配信枠で流れた回）。2026-11-14 に公式ページのパンくずで確認した組だけを書く。
// 例: スポンジ・旧報談・一部ドーナツ → 「ニュースの現場から」(pgid 684015f9)。新しい報談は「報談 【HOU-DAN】」、ドーナツは「ドーナツ ～…」で本来名と前方一致
export const SHOW_SITE_PARENTS = { 'スポンジ': ['ニュースの現場から'], '報談': ['ニュースの現場から'], 'ドーナツ': ['ニュースの現場から'] };
const dayUtc = (d) => { const m = String(d ?? '').match(/(20\d\d)\D(\d{1,2})\D(\d{1,2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
export function verifyOfficialPage(code, html, expectedId, title, opts = {}) {
  if (code === 404 || code === 410) return { status: 'NOT_FOUND', reason: 'HTTP_' + code };
  if (code !== 200) return { status: 'ERROR', reason: 'HTTP_' + code };
  const h = String(html ?? ''), can = (h.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || h.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i) || [])[1] || '';
  const id = officialItemId(can.replace(/&amp;/g, '&'));
  if (!id) return { status: 'HOLD', reason: 'NO_CANONICAL_ITEMID' };
  if (id !== normId(expectedId)) return { status: 'HOLD', reason: 'CANONICAL_MISMATCH ' + id };
  const ok = ['ID'], txt = flat(pageText(h)), rawFlat = flat(h);
  if (title) { const want = flat(title).replace(/^再/, '').slice(0, 24); if (want.length >= 4 && txt.indexOf(want) < 0) return { status: 'HOLD', reason: 'TITLE_NOT_ON_PAGE' }; ok.push('TITLE'); }
  if ('show' in opts) {
    const sh = flat(opts.show); if (!sh) return { status: 'HOLD', reason: 'NO_SHOW_TO_MATCH' };
    const prog = (h.match(/"position"\s*:\s*4\s*,\s*"name"\s*:\s*"([^"]+)"/) || [])[1] || '';
    if (prog) {
      if (flat(prog).indexOf(sh) === 0) ok.push('SHOW');
      else if ((SHOW_SITE_PARENTS[opts.show] || []).indexOf(prog) >= 0) ok.push('SHOW(親番組:' + prog + ')');
      else return { status: 'HOLD', reason: 'SHOW_MISMATCH ' + prog };
    } else if (rawFlat.indexOf(sh) >= 0) ok.push('SHOW'); else return { status: 'HOLD', reason: 'SHOW_NOT_ON_PAGE' };
  }
  if ('date' in opts) {
    const want = dayUtc(opts.date); if (isNaN(want)) return { status: 'HOLD', reason: 'NO_DATE_TO_MATCH' };
    const page = (h.match(/20\d\d\/\d{1,2}\/\d{1,2}/g) || []).map(dayUtc);
    if (!page.length) return { status: 'HOLD', reason: 'NO_DATE_ON_PAGE' };
    if (!page.some((t) => Math.abs(t - want) <= 86400000)) return { status: 'HOLD', reason: 'DATE_MISMATCH ' + new Date(page[0]).toISOString().slice(0, 10) };
    ok.push('DATE');
  }
  const via = ok.find((x) => /^SHOW\(/.test(x)), keys = ok.map((x) => (/^SHOW\(/.test(x) ? 'SHOW' : x));
  return { status: 'VERIFIED', reason: (keys.length === 1 ? 'CANONICAL_ITEMID_MATCH' : keys.length === 2 && keys[1] === 'TITLE' ? 'CANONICAL_ITEMID_AND_TITLE_MATCH' : keys.join('_') + '_MATCH') + (via ? ' ' + via.slice(4) : '') };
}

// ---------- おんさ共有台帳との照合（読むだけ）。Omny URL・Asahi.com の itemid・Spotify エピソードID のどれかが一致した時だけ同じ回と見なす（タイトルだけでは結び付けない） ----------
const omnyKey = (u) => { const m = String(u ?? '').match(/omny\.fm\/shows\/([^/?#]+)\/([^/?#]+)/i); return m ? (m[1] + '/' + m[2]).toLowerCase() : ''; };
const spotifyKey = (u) => { const m = String(u ?? '').match(/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})/); return m ? m[1] : ''; };
export const ONSA_MATCH_HEADERS = ['EP-ID', '区分', '一致方法', 'おんさシート', 'おんさ行', 'おんさタイトル', 'おんさ日付', 'おんさ秒', 'おんさ Asahi.com URL', 'V2タイトル', '差異', 'メモ'];
// onsa: [{sheet,row,omny,date,title,seconds,spotify,asahi}]、v2: laRead_ の行（omny=旧元ページURL, spotify=Spotify列, officialUrl, guid, audioUrl）
export function onsaMatch(v2, onsa) {
  const idx = { omny: new Map(), asahi: new Map(), spotify: new Map() }, used = new Set(), out = [], count = {};
  onsa.forEach((o, i) => { const k1 = omnyKey(o.omny), k2 = officialItemId(o.asahi), k3 = spotifyKey(o.spotify); if (k1) idx.omny.set(k1, i); if (k2) idx.asahi.set(k2, i); if (k3) idx.spotify.set(k3, i); });
  const add = (row, kind) => { count[kind] = (count[kind] || 0) + 1; out.push(row); };
  v2.filter((r) => r.ep).forEach((r) => {
    const ids = [['旧元ページURL(Omny)', idx.omny.get(omnyKey(r.sourceUrl))], ['公式itemid', idx.asahi.get(officialItemId(r.officialUrl)) ?? idx.asahi.get(normId(r.guid)) ?? idx.asahi.get(hostIdFromAudio(r.audioUrl))], ['Spotify', idx.spotify.get(spotifyKey(r.spotify))]].filter((x) => x[1] !== undefined);
    if (!ids.length) { add([r.ep, 'おんさに無い', '', '', '', '', '', '', '', r.title, '', 'おんさの収録範囲外（YouTube・ニュースの学校の扱いなど）か未記録の可能性。これだけで除外しない'], 'おんさに無い'); return; }
    const hits = [...new Set(ids.map((x) => x[1]))]; if (hits.length > 1) { add([r.ep, '識別子が別々のおんさ行を指す', ids.map((x) => x[0]).join('・'), '', '', '', '', '', '', r.title, '', 'おんさ行 ' + hits.map((h) => onsa[h].sheet + ':' + onsa[h].row).join(' / ')], '識別子矛盾'); return; }
    const o = onsa[hits[0]]; used.add(hits[0]); const diff = [flat(o.title) !== flat(r.title) ? 'タイトル' : '', o.seconds && r.seconds && Math.abs(Number(o.seconds) - Number(r.seconds)) > 2 ? '再生時間' : ''].filter(Boolean).join('・');
    add([r.ep, diff ? '一致（差異あり）' : '一致', ids.map((x) => x[0]).join('・'), o.sheet, String(o.row), o.title, o.date, o.seconds, o.asahi, r.title, diff, ''], diff ? '一致（差異あり）' : '一致');
  });
  onsa.forEach((o, i) => { if (!used.has(i) && (omnyKey(o.omny) || officialItemId(o.asahi) || spotifyKey(o.spotify))) add(['', 'おんさにあり台帳に無い', '', o.sheet, String(o.row), o.title, o.date, o.seconds, o.asahi, '', '', '未収蔵の可能性（エピソードの不存在ではない）。公式ページ・音声で確かめる'], 'おんさにあり台帳に無い'); });
  return { rows: out, count };
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

// ---------- 全台帳の差分監査（L2）。旧公開図書館・V2・旧本番台帳を EP-ID と GUID で突き合わせる（読むだけ） ----------
export const isRerunTitle = (t) => /^[（(]再[)）]/.test(String(t ?? '').trim());
export const rerunBaseTitle = (t) => String(t ?? '').normalize('NFKC').replace(/^[(（]再[)）]\s*/, '').replace(/#\s*\d+\s*$/, '').replace(/[\s　「」『』"“”]/g, '');
const normT = (t) => String(t ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const ymd = (d) => { const m = String(d ?? '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : ''; };
export const LEDGER_DIFF_HEADERS = ['EP-ID', '区分', '採否案', '根拠', '番組', 'タイトル（V2）', '配信日（V2）', 'V2掲載判定', 'V2代表EP', 'GUID（V2）', '旧公開', '旧公開タイトル', '旧公開配信日', '旧本番台帳', '旧本番タイトル', '旧本番配信日', '旧本番GUID', '重複・原回EP-ID', '差異'];
// oldPub: [{id,show,title,date}]、v2: laRead_ の行、v1: [{id,show,title,date,guid,excluded}]、since: 新着を別枠で数える日付（YYYY-MM-DD）
export function ledgerDiff({ oldPub = [], v2 = [], v1 = [], since = '2026-11-13' }) {
  const O = new Map(oldPub.map((e) => [e.id, e])), V = new Map(v2.filter((r) => r.ep).map((r) => [r.ep, r])), P = new Map(v1.filter((r) => r.id).map((r) => [r.id, r]));
  const pub = (r) => r && r.judge === '対象' && r.rep === r.ep, orig = new Map(), byGuid = new Map();
  for (const r of V.values()) { if (!isRerunTitle(r.title)) { const k = r.show + '|' + rerunBaseTitle(r.title); (orig.get(k) || orig.set(k, []).get(k)).push(r.ep); } const g = String(r.guid || '').toLowerCase(); if (g) (byGuid.get(g) || byGuid.set(g, []).get(g)).push(r.ep); }
  const v1Guid = new Map(); for (const r of P.values()) { const g = String(r.guid || '').toLowerCase(); if (g) (v1Guid.get(g) || v1Guid.set(g, []).get(g)).push(r.id); }
  const rows = [], count = {}, add = (ep, kind, verdict, why, extra = {}) => { const r = V.get(ep) || {}, o = O.get(ep), p = P.get(ep); count[kind + '｜' + verdict] = (count[kind + '｜' + verdict] || 0) + 1;
    rows.push([ep, kind, verdict, why, r.show || (o && o.show) || (p && p.show) || '', r.title || '', r.date || '', r.judge || '', r.rep || '', r.guid || '', o ? '公開' : '', o ? o.title : '', o ? ymd(o.date) : '', p ? (p.excluded ? '人間除外' : 'あり') : '', p ? p.title : '', p ? ymd(p.date) : '', p ? p.guid : '', extra.dup || '', extra.diff || '']); };
  const ids = new Set([...O.keys(), ...V.keys(), ...P.keys()]);
  for (const ep of [...ids].sort()) {
    const r = V.get(ep), o = O.get(ep), p = P.get(ep), g = String(r && r.guid || '').toLowerCase();
    const diff = [o && r && normT(o.title) !== normT(r.title) ? 'タイトル(旧公開)' : '', o && r && ymd(o.date) && ymd(r.date) && ymd(o.date) !== ymd(r.date) ? '配信日(旧公開)' : '', p && r && normT(p.title) !== normT(r.title) ? 'タイトル(旧本番)' : '', p && r && ymd(p.date) && ymd(r.date) && ymd(p.date) !== ymd(r.date) ? '配信日(旧本番)' : '', p && r && p.guid && g && String(p.guid).toLowerCase() !== g ? 'GUID(旧本番)' : ''].filter(Boolean).join('・');
    const sameGuid = g ? (byGuid.get(g) || []).filter((x) => x !== ep) : [], v1Other = g ? (v1Guid.get(g) || []).filter((x) => x !== ep) : [];
    if (sameGuid.length || v1Other.length) add(ep, '同じGUIDが別EP-ID', 'DUPLICATE', '公式GUIDが同じ', { dup: [...sameGuid, ...v1Other].join(' '), diff });
    if (o && !r) { add(ep, '旧公開にありV2にない', 'ERROR', 'V2台帳にEP-IDがない', { diff }); continue; }
    if (o && r && !pub(r)) { add(ep, '旧公開にありV2で非公開', r.rep && r.rep !== ep ? 'DUPLICATE' : r.judge === '対象外' ? 'EXCLUDE' : 'HOLD', 'V2 掲載判定=' + r.judge + (r.rep && r.rep !== ep ? '・代表=' + r.rep : ''), { dup: r.rep !== ep ? r.rep : '', diff }); continue; }
    if (o && r) { if (diff) add(ep, '両方にあり表記・日付が違う', 'HOLD', '台帳ごとに値が違う', { diff }); continue; }
    if (r && pub(r)) {
      if (isRerunTitle(r.title)) { const os = (orig.get(r.show + '|' + rerunBaseTitle(r.title)) || []).filter((x) => x !== ep), opub = os.filter((x) => O.has(x));
        add(ep, 'V2にあり旧公開にない・再配信', opub.length ? 'DUPLICATE候補' : 'HOLD', opub.length ? '原回 ' + opub.join(' ') + ' が公開済み（タイトル一致のみ。GUID・音源で確定させる）' : '原回が台帳に無い再配信（一括採用・一括削除しない）', { dup: os.join(' '), diff }); continue; }
      add(ep, ymd(r.date) >= since ? 'V2にあり旧公開にない・' + since + '以降の新着' : 'V2にあり旧公開にない・新規', 'HOLD', '公式ページ・音声の確認待ち（L3）', { diff }); }
    if (p && !r) add(ep, '旧本番台帳にありV2にない', p.excluded ? 'EXCLUDE' : 'ERROR', p.excluded ? '旧本番で人間除外' : 'V2台帳にEP-IDがない');
    else if (r && !p && pub(r)) count['（参考）V2公開候補で旧本番台帳にない'] = (count['（参考）V2公開候補で旧本番台帳にない'] || 0) + 1;
  }
  const n = { oldPublic: O.size, v2Public: [...V.values()].filter(pub).length, both: [...O.keys()].filter((e) => pub(V.get(e))).length };
  n.added = n.v2Public - n.both; n.oldOnly = n.oldPublic - n.both;
  const addedKinds = rows.filter((x) => /^V2にあり旧公開にない/.test(x[1])).length;
  const equation = { '旧公開 = 両方 + 旧公開だけ': n.oldPublic === n.both + n.oldOnly, 'V2公開候補 = 両方 + 追加': n.v2Public === n.both + n.added, '追加 = 分類済みの追加行': n.added === addedKinds };
  return { rows, count, n, equation };
}
