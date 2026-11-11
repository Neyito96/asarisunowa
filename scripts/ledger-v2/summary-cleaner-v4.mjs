// 概要欄清掃ロボ V4（Issue #308）。Node と GAS で同じコードを使う（build-cleaner-gas.mjs で GAS 用に1ファイル化）。
// 原則: 原文は変えない。原文だけを基準に、本文・出演者（リンク付き）・関連記事（見出し＋URLのペア）を分ける。
// 迷うもの（見出しなし記事URL・非記事リンク・本文の大幅減少・監査で重大所見）は 要確認。品質確認済は人だけが付ける。
import { descriptionLines, DESCRIPTION_VERSION } from '../../public/library/description-editor.mjs';
import { auditPair, AUDIT_VERSION, cleanUrl } from './summary-quality-audit.mjs';

export const CLEANER_VERSION = 'SC4-1(' + DESCRIPTION_VERSION + ')';
const T = (v) => String(v ?? '').trim();
const NZ = (t) => String(t ?? '').normalize('NFKC').replace(/\s+/g, '');
const URL_RE = /https?:\/\/[^\s<>「」『』（）()"'、]+/g;
const ARTICLE_URL = /^https?:\/\/(?:www\.asahi\.com\/(?:[a-z]+\/)?articles\/|digital\.asahi\.com\/articles\/|withnews\.jp\/article\/|globe\.asahi\.com\/article\/|book\.asahi\.com\/article\/|www\.asahi\.com\/special\/(?!podcasts))/;
const SNS_URL = /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com|instagram\.com|tiktok\.com|facebook\.com|threads\.net|youtube\.com\/@|note\.com|bsky\.app)\//i;
// 見出しの揺れ（全半角・括弧・コロン）。本文系の見出しは「見出しだけ」を落として中身は残す。
const H = (names) => new RegExp('^\\s*(?:【|\\[|［|〔|■|◆|▼|●)?\\s*(?:' + names + ')\\s*(?:】|\\]|］|〕)?\\s*[:：]?\\s*', 'i');
const BODY_HEAD = H('番組内容|番組説明|番組紹介|内容|概要|今回のテーマ|今回の内容|テーマ|あらすじ');
const STAFF_HEAD = H('出演[・／/]?スタッフ|出演者|出演|スタッフ|ゲスト|パーソナリティー?|MC');
const RELATED_HEAD = H('関連記事|関連リンク|関連URL|参考記事|写真まとめ|特集ページ|まとめてわかる');
const DROP_HEAD = H('おねがい|お願い|朝ポキ情報|お知らせ|イベント|告知|募集|プレゼント|お便り募集|おたより募集|SNS');
// 定型の宣伝・広告（行ごと除去）。本編の話題（Xの騒動・イベントの報道）を誤って消さないよう、宣伝の言い回しに限る。
const PROMO = /See .*omnystudio\.com\/listener|Learn more about your ad choices|購読料で配信|会員登録をお願い|^交流はdiscord|^ご意見・感想・リクエスト|おたよりフォーム|^メルマガ|広告ご検討の企業様|^番組検索ツール|^最新情報はX|^番組カレンダー|全話あります公式サイト|アプリで記者と対話|^朝ポキTV|ほかにも(?:多彩な)?番組を配信中|^★?ご感想はこちら|フォローをお願い|フォローしてね|チャンネル登録|^(?:X|Twitter|Instagram|インスタ)(?:\s*[:：]|\s*はこちら|\s*https?:)|配信、テキストでも読めます/i;
const EVENT_PROMO = /(?:募集|応募|申し込み|申込|お申し込み|参加者|チケット|エントリー|アンケート|フォーム|お寄せください|お待ちしています)/;

// 原文を見出しで区切った節に分ける（見出しを境界として扱う。全削除の正規表現にしない）
export function sections(raw) {
  const lines = descriptionLines(String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')), out = []; let cur = { kind: 'body', head: '', lines: [] };
  const start = (kind, head, rest) => { out.push(cur); cur = { kind, head, lines: rest ? [rest] : [] }; };
  for (const l of lines) {
    let m;
    if ((m = l.match(STAFF_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('staff', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(RELATED_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('related', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(DROP_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('drop', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(BODY_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('body', m[0].trim(), l.slice(m[0].length).trim());
    else cur.lines.push(l);
  }
  out.push(cur); return out.filter((s) => s.lines.length || s.head);
}
const urlsOf = (t) => [...String(t).matchAll(URL_RE)].map((m) => m[0].replace(/[.,;、。]+$/, ''));
const stripUrls = (t) => String(t).replace(URL_RE, '').replace(/[ 　]*[／/|｜][ 　]*$/, '').replace(/[ 　]{2,}/g, ' ').trim();
const ROLE = /^(MC[・、,]?音源編集|MC|司会|聞き手|パーソナリティー?|ゲスト|出演|音源編集|編集|制作|構成|ナレーション|プロデューサー|ディレクター)[\s　:：・、]+/;   // 役割の後に区切りがあるときだけ（「ゲスト1さん」等の氏名を削らない）

// 出演者1行 → {role, name, note, links, raw}。氏名の推定はしない（原文の文字列をそのまま分けるだけ）
export function parseCastLine(line) {
  const raw = T(line), links = urlsOf(raw); let text = stripUrls(raw), role = '';
  const m = text.match(ROLE); if (m) { role = m[1]; text = text.slice(m[0].length).trim(); }
  const note = (text.match(/[（(]([^）)]*)[）)]/) || [])[1] || '';
  if (!role && /MC|司会|聞き手|音源編集|ゲスト/.test(note)) role = note;
  const name = text.replace(/[（(][^）)]*[）)]/g, '').trim();
  return { role, name, note, links, raw };
}

export function cleanV4(raw) {
  const src = String(raw ?? '');
  if (!src.trim()) return { ok: false, holds: ['RAW_EMPTY'], text: '', cast: [], related: [], socials: [], removed: [] };
  const secs = sections(src), body = [], cast = [], related = [], removed = [], socials = [], holds = [];
  const pushRel = (title, url) => { const clean = cleanUrl(url); if (related.some((r) => r.url === clean)) return; related.push({ title: T(title).replace(/^【[^】]*】/, '').trim(), url: clean, originalUrl: url, source: '概要原文' }); };
  for (const s of secs) {
    if (s.kind === 'drop') { removed.push({ reason: 'SECTION_' + s.head, lines: s.lines.length }); continue; }
    if (s.kind === 'staff') {
      for (const l of s.lines) { if (PROMO.test(l)) { removed.push({ reason: 'PROMO_IN_STAFF' }); continue; } const c = parseCastLine(l); if (c.name || c.role) cast.push(c); }
      continue;
    }
    for (let i = 0; i < s.lines.length; i++) {
      const l = s.lines[i], us = urlsOf(l), text = stripUrls(l);
      if (PROMO.test(l)) { removed.push({ reason: 'PROMO' }); continue; }
      const art = us.filter((u) => ARTICLE_URL.test(u));
      if (art.length) {   // 見出しと同じ行 or 直前の行（URLだけの行）
        let title = text; if (!T(title) && i > 0 && body.length && body[body.length - 1] === stripUrls(s.lines[i - 1])) title = body.pop();   // 直前の行が見出し
        art.forEach((u) => pushRel(title, u)); if (!T(title)) holds.push('RELATED_URL_WITHOUT_TITLE');
        continue;
      }
      if (s.kind === 'related') {   // 関連節の中の見出し行（次行がURL）は body に一時置き、次の記事URLで回収
        if (us.length && !art.length) { if (EVENT_PROMO.test(l) || us.some((u) => SNS_URL.test(u))) { removed.push({ reason: 'RELATED_PROMO' }); continue; } holds.push('RELATED_NONARTICLE_REVIEW'); removed.push({ reason: 'RELATED_NONARTICLE_HELD' }); continue; }
        const nx = s.lines[i + 1] || ''; if (urlsOf(nx).some((u) => ARTICLE_URL.test(u)) && !stripUrls(nx)) { body.push(text); continue; }
        if (text) { holds.push('RELATED_TEXT_WITHOUT_URL'); body.push(text); } continue;
      }
      if (us.length) {
        if (us.every((u) => SNS_URL.test(u))) { socials.push(...us); removed.push({ reason: 'SNS_LINK' }); if (text && !/^[@＠]?\w+$/.test(text)) body.push(text); continue; }
        if (EVENT_PROMO.test(l)) { removed.push({ reason: 'EVENT_OR_FORM' }); continue; }
        if (!text) { removed.push({ reason: 'URL_ONLY' }); continue; }
        body.push(text); removed.push({ reason: 'URL_STRIPPED_FROM_BODY' }); continue;
      }
      if (text) body.push(text);
    }
  }
  // 閉じていない見出し行（関連節で回収されなかった見出し）が本文末尾に残らないよう、関連節由来の行は本文から外さない＝そのまま（要確認で拾う）
  const text = body.join('\n').replace(/\s*(?:ご意見・感想・リクエスト|ほかにも(?:多彩な)?番組を配信中|Learn more about your ad choices)[\s\S]*$/i, '').replace(/[ 　]{2,}/g, ' ').trim();
  if (!text) holds.push('CONTENT_EMPTY');
  return { ok: !holds.length, holds: [...new Set(holds)], text, cast, related, socials: [...new Set(socials)], removed };
}

// 台帳の書式に合わせる: 出演者=原文の行（リンク付き）を改行区切り、関連記事URL=記事URLを空白区切り
export const castCell = (cast) => cast.map((c) => c.raw.replace(/\s+/g, ' ').trim()).join('\n');
export const relatedCell = (related) => related.map((r) => r.url).join(' ');

// 既存値が「原文から機械的に取り出しただけ」か（＝自動値。更新してよい）。原文に無い文字・URLを含むなら人の手が入った可能性→保護
export function derivedFromRaw(existing, raw) {
  const ex = T(existing); if (!ex) return true;
  const src = descriptionLines(String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, '')).join('\n'), srcN = NZ(stripUrls(src)), srcUrls = new Set(urlsOf(src).map(cleanUrl));
  if (urlsOf(ex).some((u) => !srcUrls.has(cleanUrl(u)))) return false;
  return ex.split(/\n+/).every((l) => { const n = NZ(stripUrls(l)).replace(/^【[^】]*】/, ''); return !n || srcN.includes(n); });
}

// 1件の判定。existing = 台帳の現在値 {summary, cast, related}
export function judgeEpisode(raw, existing = {}, sha256) {
  const c = cleanV4(raw), findings = [];
  if (!String(raw ?? '').trim()) return { verdict: 'HOLD', reason: 'RAW_EMPTY', clean: c, findings: [], compare: '', writable: {}, manual: [] };
  const a = auditPair(raw, { description: c.text, cast: c.cast.map((x) => [x.role, x.name, x.note].join(' ')), related: c.related.map((r) => ({ url: r.url, title: r.title })) });
  findings.push(...a.findings.map((f) => f.type));
  const ex = { summary: T(existing.summary), cast: T(existing.cast), related: T(existing.related) }, nw = { summary: c.text, cast: castCell(c.cast), related: relatedCell(c.related) };
  const same = (k) => NZ(ex[k]) === NZ(nw[k]) || (k === 'related' && ex[k] && NZ(ex[k].split(/\s+/).map(cleanUrl).join(' ')) === NZ(nw[k]));
  const manual = ['summary', 'cast', 'related'].filter((k) => ex[k] && !same(k) && !derivedFromRaw(ex[k], raw));
  const severe = a.verdict === '不合格' || c.holds.includes('CONTENT_EMPTY');
  let verdict = severe ? '不合格' : (c.holds.length || a.verdict === '要確認') ? '要確認' : '自動検査合格・目視未確認';
  const cmp = !ex.summary ? '旧空欄' : same('summary') ? '同一' : '差分あり';
  const writable = {};
  ['summary', 'cast', 'related'].forEach((k) => { writable[k] = !manual.includes(k) && !same(k) && (k === 'summary' ? !!nw.summary : !!nw[k]); });   // 新しい値が空の列は書かない（既存を消さない）
  if (manual.length) { findings.push('MANUAL_EDIT_PROTECTED:' + manual.join('+')); if (verdict === '自動検査合格・目視未確認') verdict = '要確認'; }
  if (ex.cast && !c.cast.length) findings.push('CAST_NOT_IN_RAW');   // 既存の出演者が原文に無い（既定値の疑い）。消さずに記録
  if (verdict === '不合格') ['summary', 'cast', 'related'].forEach((k) => { writable[k] = false; });
  return { verdict, reason: [...new Set([...c.holds, ...findings])].join(','), clean: c, findings, compare: cmp, writable, manual, rawSha: sha256 ? sha256(String(raw)) : '', auditVersion: AUDIT_VERSION };
}
