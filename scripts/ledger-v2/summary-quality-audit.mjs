// 概要清掃の品質監査（READ_ONLY）。比較基準は公式RSSの概要原文だけ。既存の清掃文・新しい清掃案は「検査対象」であって正解ではない。
// 監査側の行分類は清掃器とは独立に、保守的に作る（迷う行は AMBIGUOUS として採点しない＝消し過ぎ・残し過ぎのどちらにも数えない）。
// 出力は件数・分類・EP-ID・行番号・文字数だけ。本文は出さない（leak-guard を通す前提）。
import { descriptionLines } from '../../public/library/description-editor.mjs';
// 追跡パラメータ（utm_*・iref・ref・fbclid・gclid・si）だけを外す。URL クラスを使わない（GAS には無い）。それ以外の部分は変えない
export function cleanUrl(u) {
  const s = String(u || ''), h = s.indexOf('#'), base = h >= 0 ? s.slice(0, h) : s, hash = h >= 0 ? s.slice(h) : '', q = base.indexOf('?');
  if (q < 0) return s;
  const keep = base.slice(q + 1).split('&').filter((kv) => kv && !/^(utm_[^=]*|iref|ref|fbclid|gclid|si)(=|$)/i.test(kv));
  return base.slice(0, q) + (keep.length ? '?' + keep.join('&') : '') + hash;
}
const publicationUrl = cleanUrl;

export const AUDIT_VERSION = 'SQA-1';
// 清掃状態（処理済みと品質確認済みを分離）。品質確認済は人の目視確認と記録があるときだけ付く。自動検査の合格は「自動検査合格・目視未確認」。
export const QUALITY_STATES = Object.freeze(['未処理', '自動処理済・未検証', '自動検査合格・目視未確認', '品質確認済', '要確認', '不合格']);
export const QUALITY_LOG_HEADERS = Object.freeze(['EP-ID', '公式GUID', '概要原文SHA256', '検査対象', '清掃版', '監査版', '判定', '誤り分類', '検証方法', '検証者', '検証日時', '理由']);

const N = (t) => String(t ?? '').normalize('NFKC').replace(/https?:\/\/\S+/g, '').replace(/[\s　、。，．・「」『』（）()【】\[\]！？!?…:：;；"'“”‘’〜~ー—–-]/g, '').toLowerCase();
const URL_RE = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
const ARTICLE_RE = /^https?:\/\/(?:www\.asahi\.com\/(?:articles|[a-z]+\/articles)\/|digital\.asahi\.com\/articles\/|withnews\.jp\/article\/|globe\.asahi\.com\/article\/|book\.asahi\.com\/article\/|www\.asahi\.com\/special\/(?!podcasts))/;
// 消してよいと監査側が確信できる定型だけ。迷うものは入れない。
const DROP_LINE = /^See .*omnystudio\.com\/listener|Learn more about your ad choices|会員登録をお願い|購読料で配信|交流はdiscord|^ご意見・感想・リクエスト|おたよりフォーム|^メルマガ|広告ご検討の企業様|^番組検索ツール|^最新情報はX|^番組カレンダー|全話あります公式サイト|アプリで記者と対話|^朝ポキTV|ほかにも(?:多彩な)?番組を配信中|^★?ご感想はこちら/;
const DROP_SECTION = /^【(?:おねがい|朝ポキ情報|お知らせ|イベント)/;
const STAFF_SECTION = /^【(?:出演[・／/]スタッフ|出演者|スタッフ|出演)】/;
const RELATED_SECTION = /^【(?:関連記事|関連リンク|写真まとめ|特集ページ|まとめてわかる)/;
const AMBIG_LINE = /^[★※▼■◆]|募集|お寄せください|応募|申し込み|配信します|収録しました|プレゼント|イベント|フォロー/;

// 原文を行に分け、監査側の期待（KEEP/DROP/STAFF/RELATED/AMBIGUOUS）を付ける。
export function classifyRawLines(raw) {
  const out = []; let section = 'body';
  descriptionLines(String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')).forEach((text, i) => {
    const urlOnly = /^\s*(?:https?:\/\/\S+\s*)+$/.test(text);
    if (DROP_SECTION.test(text)) section = 'drop'; else if (STAFF_SECTION.test(text)) section = 'staff'; else if (RELATED_SECTION.test(text)) section = 'related';
    const headerOnly = /^【[^】]+】\s*$/.test(text);
    let expect;
    if (DROP_LINE.test(text)) expect = 'DROP';
    else if (section === 'drop') expect = 'DROP';
    else if (section === 'staff') expect = 'STAFF';
    else if (section === 'related' || (/https?:/.test(text) && [...text.matchAll(URL_RE)].some((m) => ARTICLE_RE.test(m[0])))) expect = 'RELATED';
    else if (urlOnly || headerOnly) expect = 'DROP';
    else if (AMBIG_LINE.test(text)) expect = 'AMBIGUOUS';
    else expect = 'KEEP';
    out.push({ i, text, len: text.length, expect, section });
  });
  return out;
}
const grams = (t, k = 3) => { const s = new Set(); for (let i = 0; i + k <= t.length; i++) s.add(t.slice(i, i + k)); return s; };
// 行が清掃文に残っている割合（0..1）。完全一致でなくても、3文字片の重なりで測る。
export function coverage(line, cleaned) {
  const a = N(line), b = N(cleaned); if (!a) return 1; if (b.includes(a)) return 1;
  const g = grams(a), h = grams(b); if (!g.size) return b.includes(a) ? 1 : 0;
  let hit = 0; for (const x of g) if (h.has(x)) hit++; return hit / g.size;
}
const PROPER = /「[^」]{2,30}」|[ァ-ヴー]{3,}|[A-Za-z][A-Za-z0-9&.\-]{2,}|#\d+/g;
const CAST_BAD = /https?:|会員登録|discord|おたより|フォーム|@|購読|配信中|メルマガ|ご意見/i;
export function articleUrls(text) { return [...String(text || '').matchAll(URL_RE)].map((m) => m[0].replace(/[.,;]+$/, '')).filter((u) => ARTICLE_RE.test(u)).map((u) => publicationUrl(u) || u); }

// 1件の監査。candidate = { description, cast(文字列 or 配列), related(URL配列 or {url,title}配列) }
export function auditPair(raw, candidate, { minKeepCoverage = 0.85, partialFloor = 0.3 } = {}) {
  const findings = [], lines = classifyRawLines(raw), desc = String(candidate?.description ?? ''), add = (type, extra = {}) => findings.push({ type, ...extra });
  if (!String(raw || '').trim()) return { verdict: 'HOLD', findings: [{ type: 'RAW_EMPTY' }], stats: {} };
  const keep = lines.filter((l) => l.expect === 'KEEP');
  if (keep.length && !desc.trim()) add('EMPTY_OUTPUT');
  for (const l of keep) {
    const c = coverage(l.text, desc);
    if (c < partialFloor) add('OVER_DELETION', { line: l.i, len: l.len }); else if (c < minKeepCoverage) add('PARTIAL_DELETION', { line: l.i, len: l.len, coverage: +c.toFixed(2) });
    else for (const m of l.text.matchAll(PROPER)) if (!N(desc).includes(N(m[0])) && N(m[0])) { add('LOST_PROPER_NOUN', { line: l.i, len: m[0].length }); break; }
  }
  for (const l of lines.filter((x) => x.expect === 'DROP' && N(x.text).length >= 6)) if (coverage(l.text, desc) >= 0.9) add('UNDER_DELETION', { line: l.i, len: l.len });
  for (const l of lines.filter((x) => x.expect === 'STAFF' && !STAFF_SECTION.test(x.text))) if (coverage(l.text, desc) >= 0.9) add('STAFF_IN_BODY', { line: l.i, len: l.len });
  if (/<\/?[a-z][^>]*>|<!\[CDATA\[|\]\]>|&(?:nbsp|amp|lt|gt|hellip|quot|#\d+);/i.test(desc)) add('HTML_RESIDUE');
  if (/https?:\/\//.test(desc)) add('URL_IN_BODY');
  if (/[?&](?:iref|utm_[a-z]+)=/.test(desc)) add('TRACKING_PARAM');
  // 関連記事: 原文の記事URLが清掃後（本文か関連記事欄）に残っているか。見出しの結合違いも見る。
  const rel = (candidate?.related || []).map((r) => (typeof r === 'string' ? { url: r } : r)), relUrls = new Set(rel.map((r) => publicationUrl(r.url) || r.url));
  const rawLines = lines.map((l) => l.text);
  for (const l of lines) for (const u of articleUrls(l.text)) {
    if (!relUrls.has(u)) { add('LOST_ARTICLE_URL', { line: l.i }); continue; }
    const r = rel.find((x) => (publicationUrl(x.url) || x.url) === u);
    if (r?.title && r.title !== r.url) {
      const same = l.text.replace(URL_RE, '').trim(), prev = l.i > 0 ? rawLines[l.i - 1] : '';
      const head = N(same).length >= 4 ? same : prev.replace(URL_RE, '').trim();
      if (head && coverage(r.title, head) < 0.8 && coverage(head, r.title) < 0.8) add('ARTICLE_TITLE_MISMATCH', { line: l.i });
    }
  }
  // 出演者: 原文【出演・スタッフ】の各行の名前部分が出演者欄にあるか。出演者欄に宣伝や連絡先が混ざっていないか。
  const castArr = Array.isArray(candidate?.cast) ? candidate.cast.map((x) => (typeof x === 'string' ? x : x.text || '')) : String(candidate?.cast || '').split(/\n|、|,|／/).filter(Boolean);
  const castAll = castArr.join(' ');
  if (candidate?.cast !== undefined) {
    for (const l of lines.filter((x) => x.expect === 'STAFF' && !STAFF_SECTION.test(x.text))) {
      const name = l.text.replace(URL_RE, '').replace(/[（(][^）)]*[）)]/g, '').replace(/^(?:MC|司会|音源編集|出演|ゲスト|聞き手|パーソナリティー?)[\s　:：]*/, '').trim();
      if (N(name).length >= 2 && !N(castAll).includes(N(name))) add('CAST_MISSING', { line: l.i });
    }
    if (castArr.some((c) => CAST_BAD.test(c))) add('CAST_CONTAMINATED');
  }
  const keepParas = keep.length, descParas = desc.split(/\n+/).filter(Boolean).length;
  if (keepParas >= 3 && descParas === 1) add('LINEBREAK_LOST');
  if (rel.some((r) => !ARTICLE_RE.test(r.url) && (CAST_BAD.test(r.title || '') || !r.title))) add('RELATED_CONTAMINATED');
  const ambiguous = lines.filter((l) => l.expect === 'AMBIGUOUS').length;
  const severe = findings.some((f) => /OVER_DELETION|EMPTY_OUTPUT|LOST_ARTICLE_URL|CAST_CONTAMINATED|STAFF_IN_BODY|HTML_RESIDUE|RELATED_CONTAMINATED/.test(f.type));
  const verdict = severe ? '不合格' : findings.length ? '要確認' : '自動検査合格・目視未確認';
  return { verdict, findings, stats: { rawLen: String(raw).length, outLen: desc.length, keepLines: keepParas, ambiguousLines: ambiguous, deletedRatio: +(1 - desc.length / Math.max(1, keep.reduce((a, l) => a + l.len, 0))).toFixed(2) } };
}

// 層化（番組・ホスト・長さ・新着/過去）
export function stratum(item) {
  const host = /megaphone/.test(item.rss || item.audioUrl || '') ? 'Megaphone' : /omny/.test(item.rss || item.audioUrl || '') ? 'Omny' : 'その他';
  const L = Number(item.descLen || String(item.descriptionRaw || '').length), len = L < 300 ? '短' : L < 1500 ? '中' : '長';
  const d = String(item.date || '').replace(/\//g, '-'), age = d >= '2026-10-01' ? '新着' : '過去';
  return { show: item.show || '', host, len, age };
}
// 公開データ（既存の清掃済み）と RSS item を照合する鍵: Omny は音声URL内のクリップID、Megaphone は TASC 番号。
export function joinKey(audio) { const s = String(audio || ''); return (s.match(/\/clips\/[^/]+\/[^/]+\/([0-9a-f-]{36})\//i) || s.match(/(TASC\d+)\.mp3/) || [])[1] || ''; }
export function parseListField(v) { if (Array.isArray(v)) return v; return [...String(v || '').matchAll(URL_RE)].map((m) => m[0].replace(/['",\]]+$/, '')); }

// 全体集計。pairs: [{ epId, item(RSS, descriptionRaw付き), candidates: { existing, v2 } }]
export function summarize(pairs, { samplePerType = 5 } = {}) {
  const out = { auditVersion: AUDIT_VERSION, pairs: pairs.length, byCandidate: {} };
  for (const pair of pairs) for (const [name, res] of Object.entries(pair.results)) {
    const b = (out.byCandidate[name] ||= { audited: 0, verdict: {}, findingTypes: {}, itemsWithType: {}, samples: {}, strata: {} });
    b.audited++; b.verdict[res.verdict] = (b.verdict[res.verdict] || 0) + 1;
    const st = stratum(pair.item), sk = [st.host, st.len, st.age].join('/'), sh = (b.strata[st.show] ||= { audited: 0, fail: 0, review: 0 }), sx = (b.strata[sk] ||= { audited: 0, fail: 0, review: 0 });
    for (const s of [sh, sx]) { s.audited++; if (res.verdict === '不合格') s.fail++; if (res.verdict === '要確認') s.review++; }
    const types = new Set(res.findings.map((f) => f.type));
    for (const f of res.findings) b.findingTypes[f.type] = (b.findingTypes[f.type] || 0) + 1;
    for (const t of types) { b.itemsWithType[t] = (b.itemsWithType[t] || 0) + 1; const s = (b.samples[t] ||= []); if (s.length < samplePerType) s.push(pair.epId); }
  }
  return out;
}
// 人の目視確認用の層化サンプル（EP-IDのみ）。各層から最大 k 件、決定的に選ぶ。
export function stratifiedSample(pairs, k = 2) {
  const by = new Map(); for (const p of pairs) { const s = stratum(p.item), key = [s.show, s.host, s.len, s.age].join('/'); if (!by.has(key)) by.set(key, []); by.get(key).push(p.epId); }
  return [...by.entries()].sort().map(([key, ids]) => ({ stratum: key, epIds: ids.sort().slice(0, k) }));
}
