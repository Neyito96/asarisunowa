// 概要欄の実機照合（READ_ONLY）。V2 の「概要原文」と「概要（清掃済）・出演者・関連記事URL」を EP-ID ごとに突き合わせる。
// 清掃器の判定（清掃・結果の合否）は使わない。原文から独立に「残すべきもの」「消すべきもの」を拾い、実際の台帳の値と比べる。
// 出力は EP-ID・原因コード・件数だけ（本文は出さない）。2026-11-16 司令塔「統合実機検証指令」1。
import { paraLines, cleanUrl } from './summary-quality-audit.mjs';

export const VERIFY_VERSION = 'SV-1';
const Z2H = (s) => String(s || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const NORM = (s) => Z2H(s).replace(/\s+/g, '').replace(/[「」『』（）()【】・、。,.!！?？:：\-—―〜~"'“”]/g, '');
const grams = (s) => { const g = new Set(); for (let i = 0; i + 2 <= s.length; i++) g.add(s.slice(i, i + 2)); return g; };
export function cov(line, text) {
  const a = NORM(line), b = NORM(text); if (!a) return 1; if (b.includes(a)) return 1;
  const g = grams(a), h = grams(b); if (!g.size) return 0; let n = 0; for (const x of g) if (h.has(x)) n++; return n / g.size;
}
const URL_G = /https?:\/\/(?:(?!https?:\/\/)[A-Za-z0-9\-._~:/?#\[\]@!$&*+,;=%])+/g;   // SC4-17: URLはASCIIの文字だけ。日本語や次のURLが続けて書かれていても、そこで切る（EP-01176・EP-00365）
const urlKey = (u) => cleanUrl(String(u).replace(/[.,;、。]+$/, '')).replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
export const SHORT_URL = /(?:bit\.ly|buff\.ly|t\.asahi\.com|t\.co\/|ow\.ly|amzn\.to|lnkd\.in|tinyurl\.com|is\.gd|goo\.gl)\b/i;
const ARTICLE = /(?:asahi\.com\/(?:articles|sp\/articles|and\/article|edu\/article)|withnews\.jp\/article\/|globe\.asahi\.com\/article|book\.asahi\.com|smbiz\.asahi\.com\/article|dot\.asahi\.com|aera\.co\.jp)/i;
// 消し忘れ（宣伝・勧誘・応募・定型）。本文の「リスナーさんのおたより」のような話題そのものは対象外になるよう、勧誘の動詞と組で見る
export const PROMO = [
  // SV-1 追加（SC4-17・2026-11-16）: 原文で確認した定型の告知行（申込条件・定員・抽選・購読案内・番組共通の締めの文・リスナー作のリンク紹介）
  ['NOTICE_FIXED', /初めてお申し込みの方限定|宅配でご購読中|先着\d+人で[、,]?定員に達した|抽選結果の発表は|対象は新規に購読された方|当日の模様はポッドキャストとして配信|^・?しめきりは\d|申し込み不要です|フォームへのリンクは|^[（(](?:ご登録フォーム|お申し?込み)[）)]$|\s[（(](?:ご登録フォーム|お申し?込み)[）)]$|朝日新聞ポッドキャスト(?:\s*[（(][^）)]*[）)])?\s*では[、,]?\s*他にも様々な番組を配信|https?:\/\/\S+\s*by\S{1,15}さん$|^(?:朝日新聞)?アプリで.{1,15}をフォロー|^[↓⬇]{3,}\s*$/],
  ['FOLLOW', /(?:番組|ポッドキャスト|チャンネル)[をのも]?フォロー|フォロー(?:を?お願い|して(?:ね|ください|いただ)|ボタン)|チャンネル登録(?!者)/],
  ['APPLY', /(?:視聴|参加|観覧)?申し?込み(?:は|方法|受付|締め?切|フォーム|はこちら)|応募(?:は|方法|フォーム|受付|締め?切|はこちら)|締め?切りました|締め?切りです|ご参加いただけます/],
  ['MEMBER', /有料会員(?:の方|限定|登録)|会員登録(?:は|を|して)|読み放題|初回限定|月額\d/],
  ['LETTER', /(?:お便り|おたより|ご意見|ご感想|質問|メッセージ)(?:は|を)?(?:こちら|募集|お寄せ|お待ち|送って|受け付け)/],
  ['FORM', /forms\.gle|docs\.google\.com\/forms|フォームから/],
  ['TEXT_VER', /テキストでも読めます|記事でも読めます/],
  ['RATE', /(?:評価|レビュー)(?:を|して|お願い)|ポッドキャストアワード|投票(?:を|お願い|して)/],
  ['NEWSLETTER', /メルマガ|ニュースレター(?:の|に|を)?(?:登録|購読)/],
  ['EVENT', /開催します|生配信イベント|後日の配信はしません|見逃し配信|リアルとオンライン|イベントを開催|主催[！!]|購読料で配信|運営の参考|有料会員と紙面購読者のみ|一部のみ配信|朝日ID会員の登録/],
  ['NOTICE', /最新情報は|テロップ付きは|メールマガジン「|アーカイブはこちら|オススメ番組|募集します|募集中です|ご協力お願い|よせがき|ご参加ください|ご登録を[。！!]?$|これまでの[^。]{0,20}はこちら/],
  ['CONTACT', /ご意見・ご要望|mailto:|podcast@asahi\.com/],
  ['BOILERPLATE', /omnystudio\.com\/listener|ad ?choices|megaphone\.fm|for privacy information/i],
  ['CAMPAIGN', /キャンペーン(?:中|実施|は)|プレゼント(?:キャンペーン|します|企画)|グッズ(?:を)?(?:Get|ゲット|プレゼント)|STEPで/i],
];
const CHAPTER = /[(（]\d{1,2}:\d{2}(?::\d{2})?[)）]\s*$/;
const CAST_LINE = /^(?:出演|ＭＣ|MC|音源編集|ゲスト|パーソナリティ|構成|ナビゲーター|進行|聞き手)(?:[\s:：・／/]|$)|（(?:音源編集|MC|ＭＣ)）/;
const RECORD = [/(\d{1,2})月(\d{1,2})日[^。\n]{0,15}収録(?:しました|しています|です|されました|した|。|\s*$|）|\))/m, /収録(?:日)?[:：は]\s*(?:\d{4}年)?(\d{1,2})月(\d{1,2})日/];
const RELATED_HEAD = /^【?\s*(?:関連記事|関連する記事|記事はこちら|参考記事)/;
const STOP_HEAD = /^【(?!\s*(?:関連記事|関連する記事|参考記事))|^(?:出演|ＭＣ|MC|音源編集|★|☆|＜|<)/;
const BODY_END = /^(?:出演|ＭＣ|MC|音源編集|ゲスト|パーソナリティ)(?:[\s:：・／/]|$)|^【\s*(?:出演|スタッフ|関連)|^〖/;   // ここから先は本文ではない
const BODY_SKIP = /^【|^(?:★|☆|＊|▼|▽|■|●|◆|＜|<)|^https?:/;   // 見出し・記号付きの告知行は本文として数えない（その先の本文は数える）

export function rawFacts(raw) {
  const { lines } = paraLines(raw), txt = lines.map((l) => l.text);
  const plain = Z2H(txt.join('\n'));
  let record = ''; for (const re of RECORD) { const m = plain.match(re); if (m) { record = `${Number(m[1])}月${Number(m[2])}日`; break; } }
  const relUrls = [], relTitles = []; let inRel = false;
  txt.forEach((t) => {
    if (RELATED_HEAD.test(t)) { inRel = true; const rest = t.replace(RELATED_HEAD, '').replace(/^[】\s]+/, ''); if (rest && !/^https?:/.test(rest)) relTitles.push(rest.replace(URL_G, '').trim()); (rest.match(URL_G) || []).forEach((u) => { if (ARTICLE.test(u)) relUrls.push(u); }); return; }
    if (!inRel) return;
    if (STOP_HEAD.test(t)) { inRel = false; return; }
    const us = t.match(URL_G) || []; us.forEach((u) => { if (ARTICLE.test(u)) relUrls.push(u); });
    const title = t.replace(URL_G, '').replace(/^[▽▼・\-－＞>→]\s*/, '').trim();
    if (title.length >= 6 && !PROMO.some(([, re]) => re.test(title))) relTitles.push(title);
  });
  const body = [];   // 最初の見出し・出演・告知までの文（収録日の行は別に見る）
  // 本文の候補＝原文全体のうち、関連記事・出演の節と★告知の段落を除いた15字以上の文（宣伝・収録日の文は除く）。
  // 告知文を本文と取り違えることがあるので、照合は「本文候補の文字数のうち何割が清掃後に無いか」で見る
  let sect = 'body', starPara = -1;
  txt.forEach((t, i) => { const p = lines[i].p;
    if (i > 0 && p !== lines[i - 1].p && sect !== 'body') sect = 'body';   // 段落が変われば節を閉じる
    if (RELATED_HEAD.test(t)) { sect = 'rel'; return; }
    if (BODY_END.test(t)) { sect = 'staff'; return; }
    if (/^[★☆＼]/.test(t)) { starPara = p; return; }
    if (/^【[^】]*】\s*$/.test(t) && !/番組内容|番組説明|内容|概要|テーマ|あらすじ/.test(t)) { sect = 'notice'; return; }   // 本文以外の見出し（【リアルで新聞をめくろう】等）はその段落の終わりまで
    if (sect !== 'body' || p === starPara || BODY_SKIP.test(t)) return;
    const s = t.replace(URL_G, '').trim(); if (s.length >= 15 && !PROMO.some(([, re]) => re.test(s)) && !/収録/.test(s)) body.push(s); });
  return { record, relUrls: [...new Set(relUrls.map(urlKey))], relTitles: [...new Set(relTitles)].filter((x) => x.length >= 6), body, lineCount: txt.length };
}

// 1話を照合。issues: {code, sev: 'FAIL'|'HOLD'|'INFO'}
export function verifyEpisode(raw, cell = {}) {
  const S = String(cell.summary || ''), C = String(cell.cast || ''), P = String(cell.related || ''), issues = [], add = (code, sev, n) => issues.push({ code, sev, n: n || 1 });
  if (!String(raw || '').trim()) { add('NO_RAW', 'HOLD'); return { verdict: '保留', issues }; }
  const f = rawFacts(raw), Sz = Z2H(S);
  if (!S.trim()) { if (f.body.length) add('SUMMARY_EMPTY', 'FAIL'); }
  else {
    if (f.record && !Sz.includes(f.record)) add('RECORD_DATE_MISSING', 'FAIL');
    const have = new Set([...(S + ' ' + P).matchAll(URL_G)].map((m) => urlKey(m[0])));
    const lostU = f.relUrls.filter((u) => !have.has(u)); if (lostU.length) add('RELATED_URL_MISSING', 'FAIL', lostU.length);
    const RT = (cell.relTitles || []).join('\n');
    const lostT = f.relTitles.filter((t) => cov(t, S) < 0.8 && cov(t, RT) < 0.8); if (lostT.length) add('RELATED_TITLE_MISSING', 'HOLD', lostT.length);
    const bc = f.body.map((b) => cov(b, S)), tot = f.body.reduce((a, b) => a + b.length, 0) || 1;
    const lost = f.body.reduce((a, b, i) => a + (bc[i] < 0.5 ? b.length : 0), 0), part = bc.filter((c) => c < 0.8).length;
    if (lost / tot >= 0.9) add('BODY_MISSING', 'FAIL', bc.filter((c) => c < 0.5).length);   // 本文がほぼ丸ごと無い
    else if (lost / tot >= 0.5) add('BODY_MOSTLY_MISSING', 'HOLD', bc.filter((c) => c < 0.5).length);   // 半分以上無い（冒頭が告知文の回が多い）→ 目視
    else if (part) add('BODY_PARTIAL', 'INFO', part);   // 文の一部が無い（多くは本文中の告知文）。合否には使わない
    const sl = S.split(/\n/).filter((l) => !CHAPTER.test(l.trim()));   // 章立て（◆…(12:34)）は本文
    PROMO.forEach(([k, re]) => { const n = sl.filter((l) => re.test(l)).length; if (n) add('PROMO_LEFT_' + k, 'FAIL', n); });
    const st = sl.filter((l) => /^[★☆＼]/.test(l.trim())).length; if (st) add('STAR_NOTICE_LEFT', 'FAIL', st);   // ★☆で始まる告知行
    const cl = sl.filter((l) => CAST_LINE.test(l.trim())).length; if (cl) add('CAST_IN_SUMMARY', 'FAIL', cl);
    if (SHORT_URL.test(S)) add('SHORT_URL_IN_SUMMARY', 'FAIL');
    if (/[（(]\s*[)）]/.test(S)) add('EMPTY_LINK_RESIDUE', 'FAIL');   // 「はこちら（ ）」のようにURLだけ抜けた跡
  }
  if (SHORT_URL.test(C)) add('SHORT_URL_IN_CAST', 'INFO');
  const castBad = C.split(/\n|\s\/\s/).filter((l) => { const t = l.replace(URL_G, '').trim(); return /[。！!？?]\s*$/.test(t) && t.length > 15 || t.length > 80; }).length;
  if (castBad) add('CAST_CONTAMINATED', 'FAIL', castBad);   // 出演者欄に文章（呼びかけ・本文）が入っている
  const verdict = issues.some((i) => i.sev === 'FAIL') ? '不合格' : issues.some((i) => i.sev === 'HOLD') ? '保留' : '合格';
  return { verdict, issues, facts: { record: !!f.record, relUrls: f.relUrls.length, relTitles: f.relTitles.length, body: f.body.length } };
}

// 原文の1行が告知・宣伝・定型文か（清掃器の行計上で「規則に基づき除外」と数えるために使う）
export const isPromoLine = (t) => { const s = String(t || ''); return PROMO.some(([, re]) => re.test(s)) || /^[★☆＼]/.test(s.trim()); };
