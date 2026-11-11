// 第2段階（後日補完）の接続口。収蔵(第1段階)とは独立に何度でも再実行できる。V2本体34列は「空欄にだけ」書く計画を出し、上書きはしない。
// 既存資産の再利用: URL探索は PR #281 platform-resolver.resolveOne の返り値 {ep_id, platform, url, status, reason, checked_at, evidence, retry_after}
// をそのまま受け取る。書込は PR #299 LedgerFillRobot 互換マニフェスト（keyPolicy EPID+GUID・guidCheck）で行う。清掃・出演者・関連記事の抽出関数は注入する
// （PR #279 base-ledger の buildParticipants / buildRelatedArticles、PR #299 audit-summary-cleaned の検査をそのまま渡せる）。
import { editDescription, DESCRIPTION_VERSION } from '../../public/library/description-editor.mjs';
export const SERVICE_COLUMNS = Object.freeze({ spotify: 'Spotify', apple: 'Apple', amazon: 'Amazon', pocketcasts: 'Pocket Casts', listen: 'LISTEN', pody: 'Pody' });
export const URL_STATE_HEADERS = Object.freeze(['EP-ID', '公式GUID', 'サービス', 'URL', '状態', '理由', '確認日時', '根拠', '再試行予定']);
const s = (v) => String(v ?? '').trim();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export function colLetter(i) { let n = i + 1, o = ''; while (n) { const m = (n - 1) % 26; o = String.fromCharCode(65 + m) + o; n = Math.floor((n - 1) / 26); } return o; }
export function v2Index(values) {
  const h = values[0].map(s), idx = Object.fromEntries(h.map((n, i) => [n, i]));
  for (const n of ['EP-ID', '番組', 'タイトル', '配信日時 JST', '公式GUID', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', ...Object.values(SERVICE_COLUMNS)]) if (idx[n] === undefined) throw new Error('V2_HEADER_MISSING ' + n);
  const rows = values.slice(1).map((r, i) => ({ row: i + 2, epId: s(r[idx['EP-ID']]), r })).filter((x) => x.epId);
  const guid = (x) => (s(x.r[idx['公式GUID']]).match(UUID) || s(x.r[idx['公式個別URL']]).match(UUID) || [''])[0].toLowerCase();
  return { idx, rows, guid };
}
// V2行 → PR #281 resolveOne の入力
export function toResolverInputs(values, { showUrls = {} } = {}) {
  const { idx, rows, guid } = v2Index(values);
  return rows.map((x) => ({ epId: x.epId, guid: guid(x), show: s(x.r[idx['番組']]), title: s(x.r[idx['タイトル']]), publishedAt: s(x.r[idx['配信日時 JST']]),
    existing: Object.fromEntries(Object.entries(SERVICE_COLUMNS).map(([k, c]) => [k, s(x.r[idx[c]])])), showUrls: showUrls[s(x.r[idx['番組']])] || {} }));
}
// PR #281 の記録 → V2・URL状態 行（縦持ち。サービス追加で列は増えない）
const STATE_JA = { VERIFIED: '確認済み', PRESERVED: '既存保全', HOLD: '照合保留', NOT_FOUND: '未発見', ERROR: '要再確認' };
export function toUrlStateRows(records, guidByEp) {
  return records.map((r) => [s(r.ep_id), s(guidByEp[r.ep_id]), s(r.platform), s(r.url), STATE_JA[r.status] || '要再確認', s(r.reason), s(r.checked_at), (r.evidence || []).join(' | '), s(r.retry_after)]);
}
// 確認済み(VERIFIED)だけを、V2の空欄セルに書く計画。既存値があれば一致なら何もしない、違えば HOLD（上書き禁止）。
export function planLinkFills(values, records, { runId = 'v2-links', issue = '306', max = 1000 } = {}) {
  const { idx, rows, guid } = v2Index(values), byEp = new Map(rows.map((x) => [x.epId, x]));
  const cells = [], hold = [], skip = [];
  for (const r of records) {
    const x = byEp.get(r.ep_id), col = SERVICE_COLUMNS[r.platform];
    if (!x || !col) { hold.push({ ep: r.ep_id, platform: r.platform, why: !x ? 'EP_NOT_IN_V2' : 'UNKNOWN_SERVICE' }); continue; }
    if (r.status !== 'VERIFIED') { skip.push({ ep: r.ep_id, platform: r.platform, status: r.status }); continue; }
    const cur = s(x.r[idx[col]]);
    if (cur && cur !== s(r.url)) { hold.push({ ep: r.ep_id, platform: r.platform, why: 'EXISTING_URL_DIFFERS' }); continue; }
    if (cur) { skip.push({ ep: r.ep_id, platform: r.platform, status: 'ALREADY_SAME' }); continue; }
    const g = guid(x); if (!g) { hold.push({ ep: r.ep_id, platform: r.platform, why: 'NO_GUID' }); continue; }
    cells.push({ epId: r.ep_id, guid: g, column: colLetter(idx[col]), header: col, expectedOld: '', url: s(r.url), basis: (r.evidence || []).join(' | ') });
  }
  const manifest = { runId, keyPolicy: 'EPID+GUID', guidCheck: { columns: [colLetter(idx['公式GUID']), colLetter(idx['公式個別URL'])] }, approval: { issue, sheet: 'V2・統合台帳', columns: [...new Set(cells.map((c) => c.column))], maxCells: max }, holdEpIds: [], cells: cells.slice(0, max) };
  return { manifest, hold, skip };
}
// 概要清掃（非破壊）: 収蔵詳細の原文は変えず、清掃結果だけを返す。V2「概要（清掃済）」は空欄のときだけ書く計画。
export function planSummaryCleaning(values, detailValues, cleanFn, version, at) {
  const { idx, rows } = v2Index(values), byEp = new Map(rows.map((x) => [x.epId, x]));
  const h = detailValues[0].map(s), d = Object.fromEntries(h.map((n, i) => [n, i]));
  const detailUpdates = [], ledgerCells = [], hold = [];
  detailValues.slice(1).forEach((r, i) => {
    const ep = s(r[d['EP-ID']]), raw = String(r[d['概要原文']] ?? ''), state = s(r[d['清掃状態']]);
    if (!ep || !raw.trim() || (state !== '未清掃' && s(r[d['清掃版']]) === version)) return;
    let out; try { out = cleanFn(raw); } catch (e) { out = { ok: false, error: true, reason: String(e.message || e) }; }
    const u = { row: i + 2, epId: ep, 清掃状態: out.ok ? '清掃済' : out.error ? '清掃失敗' : '要確認（清掃保留）', 清掃版: version, 清掃日時: at, 清掃結果: out.ok ? `文字数 ${raw.length}→${s(out.text).length}` : s(out.reason) };
    if (d['清掃済み本文'] !== undefined) Object.assign(u, { 清掃済み本文: s(out.text), '関連記事(抽出)': out.related ? JSON.stringify(out.related) : '', '出演者候補(抽出)': (out.staff || []).join(' / '), 抽出保留: (out.holds || []).join(',') });
    detailUpdates.push(u);
    const x = byEp.get(ep);
    if (out.ok && x) { const cur = s(x.r[idx['概要（清掃済）']]); if (!cur) ledgerCells.push({ epId: ep, column: colLetter(idx['概要（清掃済）']), expectedOld: '', value: s(out.text) }); else if (cur !== s(out.text)) hold.push({ ep, why: 'CLEANED_DIFFERS_FROM_EXISTING' }); }
  });
  return { detailUpdates, ledgerCells, hold };
}
// 既存の公開用整形 editDescription（public/library/description-editor.mjs）をそのまま使う清掃関数。原文は変えない。
// 一行化は項目定義「改行はスペース化」に合わせる。保留(holds)があれば ok=false（清掃失敗ではなく要確認）。
// V2追加規則（既存 editDescription の前後に最小限を足す。実データ 26件で見つかった取りこぼしだけ）:
//  前処理: 「〇〇は毎週X曜日に配信します」を文ごと除去（既存規則は文の途中で切れて主語が残るため）
//  後処理: 共通案内・SNS・購読/広告/アプリ案内の行を本文と出演欄から除去、出演欄は【…】や★で始まる案内で打ち切り、
//          本文中の「見出し + asahi.com 記事URL」を関連記事へ移す。人名・役割・事実の文は消さない。
export const CLEAN_VERSION = 'P25V2-' + DESCRIPTION_VERSION + '+v2rules-1';
const PROMO_LINE = /^(?:★|【(?:おねがい|朝ポキ情報|お知らせ)】|ご意見・感想・リクエスト|ほかにも(?:多彩な)?番組を配信中|朝日新聞ポッドキャストは、みなさまからの購読料|番組継続のため|アプリで記者と対話|交流はdiscord|おたよりフォーム|朝ポキTV|メルマガ|広告ご検討の企業様|番組検索ツール|最新情報はX|番組カレンダー|全話あります公式サイト|Learn more about your ad choices|See .*omnystudio)/i;
const ARTICLE = /(https?:\/\/www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html)(?:\?[^\s]*)?/;
export function v2CleanSummary(raw) {
  const pre = String(raw ?? '').replace(/[^。>\s]*?は毎週[月火水木金土日]曜日に配信します。?/g, '');
  const r = editDescription(pre);
  const related = r.relatedArticles.map((a) => ({ title: a.title === a.originalUrl ? '' : a.title, url: a.url }));
  const removed = r.removed.map((x) => x.reason), keep = [];
  for (const para of r.description.split(/\n+/)) {
    const line = para.trim(); if (!line) continue;
    if (PROMO_LINE.test(line)) { removed.push('V2_PROMO_LINE'); continue; }
    const m = line.match(ARTICLE);
    if (m) { let title = line.slice(0, m.index).replace(/[\s【】]+$/g, '').trim(); const url = m[1];
      if (!title && keep.length) title = keep.pop();   // 見出しとURLが別の行（<br>区切り）のとき直前の行を見出しにする
      if (!related.some((x) => x.url === url)) related.push({ title: title.replace(/^【[^】]*】/, '').trim() || '', url });
      const rest = line.slice(m.index + m[0].length).trim(); if (rest && !PROMO_LINE.test(rest)) keep.push(rest); removed.push('V2_INLINE_ARTICLE'); continue; }
    keep.push(line);
  }
  // 本文の末尾に残る案内（同じ段落に連結された場合）も切る
  let text = keep.join(' ').replace(/\s*(?:ご意見・感想・リクエスト|ほかにも(?:多彩な)?番組を配信中|Learn more about your ad choices)[\s\S]*$/i, '').replace(/[ 　]{2,}/g, ' ').trim();
  const staff = []; for (const x of r.staff) { const t = x.trim(); if (!t) continue; if (PROMO_LINE.test(t) || /^【/.test(t)) break; staff.push(t.replace(/\s*https?:\/\/\S+/g, '').trim()); }
  const holds = [...r.holds]; if (!text) holds.push('CONTENT_EMPTY');
  return { ok: holds.length === 0, text, reason: [...new Set(holds)].join(','), holds: [...new Set(holds)], related, staff: staff.filter(Boolean), removed, recording: r.recording };
}
// 出演者・関連記事: 抽出関数を注入。確信度の低いもの（confidence < min）は書かずに HOLD。既存値がある列は書かない。
export function planCastAndRelated(values, detailValues, { extractCast, extractRelated, minConfidence = 0.9 }) {
  const { idx, rows } = v2Index(values), byEp = new Map(rows.map((x) => [x.epId, x]));
  const h = detailValues[0].map(s), d = Object.fromEntries(h.map((n, i) => [n, i])); const cells = [], hold = [];
  for (const r of detailValues.slice(1)) {
    const ep = s(r[d['EP-ID']]), raw = String(r[d['概要原文']] ?? ''), x = byEp.get(ep); if (!x || !raw.trim()) continue;
    for (const [col, fn] of [['出演者', extractCast], ['関連記事URL', extractRelated]]) {
      if (!fn) continue; const out = fn(raw) || {}; if (!out.value) continue;
      if ((out.confidence ?? 0) < minConfidence) { hold.push({ ep, col, why: 'LOW_CONFIDENCE' }); continue; }
      if (s(x.r[idx[col]])) { hold.push({ ep, col, why: 'EXISTING_VALUE' }); continue; }
      cells.push({ epId: ep, column: colLetter(idx[col]), header: col, expectedOld: '', value: s(out.value), basis: s(out.basis) });
    }
  }
  return { cells, hold };
}
// 継続監査: EPごとの未補完一覧（後日の再実行キュー）
export function pendingWork(values, detailValues = [[]], urlStateRows = []) {
  const { idx, rows } = v2Index(values), dh = (detailValues[0] || []).map(s), di = Object.fromEntries(dh.map((n, i) => [n, i]));
  const det = new Map(detailValues.slice(1).map((r) => [s(r[di['EP-ID']]), r]));
  const st = new Map(); for (const r of urlStateRows) { const k = s(r[0]) + '|' + s(r[2]); st.set(k, s(r[4])); }
  return rows.map((x) => {
    const need = [];
    for (const [k, c] of Object.entries(SERVICE_COLUMNS)) if (!s(x.r[idx[c]])) { const v = st.get(x.epId + '|' + k); if (!v || v === '要再確認') need.push('URL:' + k + (v ? '(要再確認)' : '(未探索)')); }
    const d = det.get(x.epId);
    if (!d) need.push('詳細:未作成'); else { if (!String(d[di['概要原文']] ?? '').trim()) need.push('概要原文:' + s(d[di['清掃状態']])); else if (s(d[di['清掃状態']]) === '未清掃') need.push('概要:未清掃'); }
    if (!s(x.r[idx['出演者']])) need.push('出演者'); if (!s(x.r[idx['関連記事URL']])) need.push('関連記事');
    return { epId: x.epId, need };
  }).filter((p) => p.need.length);
}
// 概要原文の後日補完: 収蔵詳細の概要原文が空で、記録済みのSHA256（先頭16桁でも可）・文字数が取得した原文と一致する行だけに入れる。違えば HOLD。
export function planRawBackfill(detailValues, rawByGuid, { via = '公式RSS（封緘転送）', at = '' } = {}) {
  const h = detailValues[0].map(s), d = Object.fromEntries(h.map((n, i) => [n, i])), out = [], hold = [];
  detailValues.slice(1).forEach((r, i) => {
    const ep = s(r[d['EP-ID']]), g = s(r[d['公式GUID']]).toLowerCase(), have = String(r[d['概要原文']] ?? '');
    const x = rawByGuid[g]; if (!ep || !x || have.trim()) return;
    const sha = s(x.sha256), rec = s(r[d['概要原文SHA256']]), len = s(r[d['概要原文文字数']]);
    if (rec && !sha.startsWith(rec)) { hold.push({ ep, why: 'SHA_MISMATCH' }); return; }
    if (len && +len !== String(x.descriptionRaw).length) { hold.push({ ep, why: 'LENGTH_MISMATCH' }); return; }
    out.push({ row: i + 2, epId: ep, 概要原文: String(x.descriptionRaw), 概要原文SHA256: sha, 概要原文文字数: String(String(x.descriptionRaw).length), 清掃状態: '未清掃', 原文取得方法: via, 取得日時: at || s(r[d['取得日時']]) });
  });
  return { updates: out, hold };
}
