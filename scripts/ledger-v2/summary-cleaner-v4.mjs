// 概要欄清掃ロボ V4（Issue #308）。Node と GAS で同じコードを使う（build-cleaner-gas.mjs で GAS 用に1ファイル化）。
// 原則: 原文は変えない。原文だけを基準に、本文・出演者（リンク付き）・関連記事（見出し＋URLのペア）を分ける。
// 迷うもの（見出しなし記事URL・非記事リンク・本文の大幅減少・監査で重大所見）は 要確認。品質確認済は人だけが付ける。
import { descriptionLines, DESCRIPTION_VERSION } from '../../public/library/description-editor.mjs';
import { auditPair, AUDIT_VERSION, cleanUrl, paraLines, STAR_NOTICE, INLINE_NOTICE_HEAD, decodeNamedEntities } from './summary-quality-audit.mjs';

export const CLEANER_VERSION = 'SC4-12(' + DESCRIPTION_VERSION + ')';   // SC4-10 は所在不明の版（2026-11-12）と衝突させないため欠番
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
const PROMO = /読み放題|スタンダードコース|初回限定|初月無料|月額\s*[\d０-９,，]+円|See .*omnystudio\.com\/listener|Learn more about your ad choices|購読料で配信|会員登録をお願い|^交流はdiscord|^ご意見・感想・リクエスト|おたよりフォーム|^メルマガ|広告ご検討の企業様|^番組検索ツール|^最新情報はX|^番組カレンダー|全話あります公式サイト|アプリで記者と対話|^朝ポキTV|ほかにも(?:多彩な)?番組を配信中|^★?ご感想はこちら|フォローをお願い|フォローしてね|チャンネル登録|^(?:X|Twitter|Instagram|インスタ)(?:\s*[:：]|\s*はこちら|\s*https?:)|配信、テキストでも読めます|フォロー[、,]?\s*お願い|をフォロー|お便りは(?:こちら|下記|フォーム)|お便りを(?:お待ち|お寄せ|募集|送って|どうぞ)|discord|ディスコード|お待ちしています|申し込みはこちら|申込はこちら|^[★☆※]\s*(?:お便り|おたより|ご感想|ご意見)/i;
// 原文で確認した独立した案内行だけ。本文中のフォーム・キャンペーン報道には適用しない。
const CONTACT_LINE = /^(?:ご意見・ご要望|フォーム|ツイッター|メール).*?(?:forms\.gle|twitter\.com|podcast@asahi)/i;
const EXTRA_PROMO = /^(?:ご登録フォーム\s+https?:|https?:\/\/que\.digital\.asahi\.com\/question\/11008783\s+（ご登録フォーム）)|^(?:有料会員、)?始めるなら今[、。].*朝日新聞デジタル.*キャンペーン|^[３3]STEPで朝リスちゃんグッズGet！/;
const SOCIAL_LABEL_LINE = /^(?:https?:\/\/(?:twitter\.com|x\.com)\/[^\s（）()]+\s*[（(][^）)]+[）)]\s*)+$/i;
const NEWSLETTER_LINE = /^(?:・\s*)?(?:メールマガジン)?「朝ポキおたより」(?:が|に|、).*?(?:ご登録|始まり|始まります)/;
const ARCHIVE_LINE = /^(?:過去回は、「連載」→「伊藤・奥山・神田」からお聞きいただけます。)?朝ポキ7番組の更新情報・アーカイブはこちら！$/;
const INVITE_2022 = /^(?:【(?:ご案内|締め切り迫る)】)?9月23日に 朝ポキ 初の対面イベント「PODCAST MEETING 2022」を開催！皆さんと会いたいです！$/;
const EVENT_PROMO = /(?:募集|応募|申し込み|申込|お申し込み|参加者|チケット|エントリー|アンケート|フォーム|お寄せください|お待ちしています)/;

const PROMO_START = /^(?:【ご案内】|【リアルで新聞をめくろう】|[★☆]\s*「?PODCAST MEETING|[★☆]\s*お得なキャンペーン)/;
// 配信サービス名（人名ではない）。出演者に入れない（SC4-12, Issue #309 EP-06723）。URLは告知リンクとして保全する
export const PLATFORM_NAME = /^(?:Spotify|Apple(?:\s*Podcasts?)?|Pocket\s*Casts|Amazon(?:\s*Music)?|Amazon\s*music|YouTube(?:\s*Music)?|LISTEN|Pody|Google\s*Podcasts|Voicy|stand\.fm|X|Twitter|Instagram|note|TikTok|Podcast|ポッドキャスト|アプリ|公式サイト)$/i;
// 原文を見出しで区切った節に分ける（見出しを境界として扱う。全削除の正規表現にしない）
export function sections(raw) {
  const pl = paraLines(raw), out = []; let cur = { kind: 'body', head: '', lines: [] }, notice = -1;
  const paras = new Map(); pl.lines.forEach(({text,p}) => paras.set(p, (paras.get(p) || '') + '\n' + text));
  const promoParas = new Set([...paras].filter(([p,t]) => pl.hasParas && /(?:^|\n)(?:【ご案内】|【リアルで新聞をめくろう】|[★☆]「PODCAST MEETING)/.test(t) && /PODCAST MEETING/.test(t) && /申し込|申込|応募|参加|開催|対象はデジタル版有料会員/.test(t) && /https?:\/\/(?:ciy\.digital\.asahi\.com\/ciy\/|que\.digital\.asahi\.com\/question\/|forms\.gle\/|t\.asahi\.com\/wr7n)/.test(t)).map(([p])=>p));
  let promoP = -1;
  const start = (kind, head, rest) => { out.push(cur); cur = { kind, head, lines: rest ? [rest] : [] }; };
  for (const { text: l, p } of pl.lines) {
    let m;
    if (promoParas.has(p) && (promoP === p || PROMO_START.test(l))) { if (promoP !== p) { start('notice', 'PODCAST_MEETING_INVITATION', ''); promoP = p; } cur.lines.push(l); continue; }   // SC4-12: 段落の途中から始まる告知は、その行から（同じ段落の前にある出演・スタッフ等を巻き込まない）
    if (promoP >= 0) { start('body', '', ''); promoP = -1; }
    if (notice >= 0 && (p !== notice || /^[【★☆※]/.test(l))) { notice = -1; if (cur.kind === 'notice') start('body', '', ''); }   // ★告知は段落の終わりまで
    if (pl.hasParas && STAR_NOTICE.test(l)) { start('notice', '★告知', l); notice = p; }
    else if (pl.hasParas && INLINE_NOTICE_HEAD.test(l) && !/^【[^】]+】\s*$/.test(l)) { start('notice', (l.match(INLINE_NOTICE_HEAD) || [''])[0], l); notice = p; }
    else if ((m = l.match(STAFF_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('staff', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(RELATED_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('related', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(DROP_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('drop', m[0].trim(), l.slice(m[0].length).trim());
    else if ((m = l.match(BODY_HEAD)) && /^\s*(?:【|\[|［|〔|■|◆|▼|●)/.test(l)) start('body', m[0].trim(), l.slice(m[0].length).trim());
    else if (/^\s*【[^】]{1,40}】\s*$/.test(l)) start(/関連|参考|記事|リンク|アーカイブ/.test(l) ? 'related' : /参加|イベント|フェス|募集|お知らせ|告知|プレゼント|チケット|会員|キャンペーン|SNS|フォロー/.test(l) ? 'drop' : 'body', l.trim(), '');   // 名前の決まっていない見出しだけの行も境界にする
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
  const secs = sections(src), follow = [], body = [], cast = [], related = [], removed = [], socials = [], holds = [], notes = [];
  const pushRel = (title, url, kind) => { const clean = cleanUrl(url), old = related.find((r) => r.url === clean); if (old) { if (!old.title && T(title)) old.title = T(title); return; } related.push({ title: T(title).replace(/\s*[（(]\s*[）)]\s*$/, '').replace(/\s*[（(]\s*$/, '').trim(), url: clean, originalUrl: url, kind: kind || 'article', source: '概要原文' }); };
  for (const s of secs) {
    if (s.kind === 'related') s.lines = s.lines.flatMap((l) => l.includes('▽') && urlsOf(l).filter((u) => ARTICLE_URL.test(u)).length > 1 ? l.split('▽').filter(Boolean) : [l]);
    if (s.kind === 'drop') { removed.push({ reason: 'SECTION_' + s.head, lines: s.lines.length }); continue; }
    if (s.kind === 'notice') {   // ★告知・見出し付き告知: 本文に入れない。「氏名＋URL」の行（アプリでフォロー等）は出演者に無ければ出演者へ保全
      removed.push({ reason: 'NOTICE', lines: s.lines.length });
      (s.head === 'PODCAST_MEETING_INVITATION' ? [] : s.lines.slice(1)).forEach((l) => { const c = parseCastLine(l); if (!PROMO.test(l) && !CONTACT_LINE.test(l) && c.name && c.links.length && c.name.length <= 20 && !/[。！？!?、]/.test(c.name)) follow.push({ ...c, note: c.note || '告知欄で紹介' }); });
      continue;
    }
    if (s.kind === 'staff') {
      for (const l of s.lines) { if (PROMO.test(l) || CONTACT_LINE.test(l) || EXTRA_PROMO.test(l) || NEWSLETTER_LINE.test(l) || ARCHIVE_LINE.test(stripUrls(l)) || INVITE_2022.test(l) || (src.includes('対面イベント「PODCAST MEETING 2022」を開催') && /^※応募締切は9月4日です。$/.test(l))) { removed.push({ reason: 'PROMO_IN_STAFF' }); continue; } const c = parseCastLine(l); if (c.name || c.role) cast.push(c); }
      continue;
    }
    for (let i = 0; i < s.lines.length; i++) {
      const l = s.lines[i], us = urlsOf(l), text = stripUrls(l);
      if (SOCIAL_LABEL_LINE.test(l)) { socials.push(...us); removed.push({ reason: 'SOCIAL_LABEL' }); continue; }
      if (PROMO.test(l) || CONTACT_LINE.test(l) || EXTRA_PROMO.test(l) || NEWSLETTER_LINE.test(l) || ARCHIVE_LINE.test(stripUrls(l)) || INVITE_2022.test(l) || (src.includes('対面イベント「PODCAST MEETING 2022」を開催') && /^※応募締切は9月4日です。$/.test(l))) { removed.push({ reason: 'PROMO' }); continue; }
      const art = us.filter((u) => ARTICLE_URL.test(u));
      if (art.length) {   // 見出しと同じ行 or 直前の行（URLだけの行）
        let title = text; if (!T(title) && i > 0 && body.length && body[body.length - 1] === stripUrls(s.lines[i - 1])) title = body.pop();   // 直前の行が見出し
        art.forEach((u) => pushRel(title, u)); if (!T(title) && art.some((u) => !related.find((r) => r.url === cleanUrl(u) && r.title))) holds.push('RELATED_URL_WITHOUT_TITLE');
        continue;
      }
      if (s.kind === 'related') {   // 関連節の中の見出し行（次行がURL）は body に一時置き、次の記事URLで回収
        if (us.length && !art.length) {
          if (EVENT_PROMO.test(l) || us.some((u) => SNS_URL.test(u))) { removed.push({ reason: 'RELATED_PROMO' }); continue; }
          let title = text; if (!T(title) && i > 0 && body.length && body[body.length - 1] === stripUrls(s.lines[i - 1])) title = body.pop();
          if (T(title)) { us.forEach((u) => pushRel(title, u, 'link')); continue; }   // 見出しつきの非記事リンク（動画・特集・短縮URL等）は種類 link として組で保存
          holds.push('RELATED_NONARTICLE_REVIEW'); removed.push({ reason: 'RELATED_NONARTICLE_HELD' }); continue; }
        const nx = s.lines[i + 1] || ''; if (urlsOf(nx).length && !stripUrls(nx)) { body.push(text); continue; }   // 次の行がURLだけ→見出しとして一時置き
        if (text) notes.push(text); continue;   // 関連節の説明文は本文に混ぜず、関連記事JSONに note として保存
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
  // SC4-12 予備: 原文に【出演…】見出しがあるのに節として取れなかった時（段落の区切り方で見出し行が消える型 EP-02520 等）、原文の文字だけから出演者行を拾う
  if (!cast.length && !secs.some((x) => x.kind === 'staff')) {
    const plain = src.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
    const L = plain.split('\n').map((x) => x.replace(/[\u200B\u2060\uFEFF]/g, '').trim()), h = L.findIndex((x) => /^【[^】]*(?:出演|スタッフ)[^】]*】$/.test(x));
    if (h >= 0) for (let i = h + 1; i < L.length && i <= h + 12; i++) { const l = L[i]; if (!l) { if (cast.length) break; continue; } if (/^[【★☆※]/.test(l) || PROMO.test(l)) break;
      const c = parseCastLine(l); if (!c.name || c.name.length > 24 || /[。！？!?]/.test(c.name) || PLATFORM_NAME.test(c.name)) break;
      if (!cast.some((x) => NZ(x.name) === NZ(c.name))) cast.push(c); }
    if (cast.length) { const gone = new Set(cast.map((c) => NZ(stripUrls(c.raw)))); for (let i = notes.length - 1; i >= 0; i--) if (gone.has(NZ(notes[i]))) notes.splice(i, 1); for (let i = body.length - 1; i >= 0; i--) if (gone.has(NZ(body[i]))) body.splice(i, 1); }
  }
  // 閉じていない見出し行（関連節で回収されなかった見出し）が本文末尾に残らないよう、関連節由来の行は本文から外さない＝そのまま（要確認で拾う）
  const text = body.join('\n').replace(/(?:※\s*)?(?:「[^」]{1,20}」の)?過去(?:の)?回は(?:下記|こちら)(?:から)?[^。\n]*[。．]?/g, '').split('\n').filter((x) => T(x)).join('\n').replace(/\s*(?:ご意見・感想・リクエスト|ほかにも(?:多彩な)?番組を配信中|Learn more about your ad choices)[\s\S]*$/i, '').replace(/[ 　]{2,}/g, ' ').trim();
  if (!text) holds.push('CONTENT_EMPTY');
  follow.forEach((c) => { if (PLATFORM_NAME.test(T(c.name))) { socials.push(...c.links); removed.push({ reason: 'PLATFORM_LINK' }); return; } if (!cast.some((x) => NZ(x.name) === NZ(c.name))) cast.push(c); });
  for (let i = cast.length - 1; i >= 0; i--) if (PLATFORM_NAME.test(T(cast[i].name))) { socials.push(...cast[i].links); removed.push({ reason: 'PLATFORM_LINK' }); cast.splice(i, 1); }
  notes.forEach((n) => related.push({ title: n, url: '', kind: 'note', source: '概要原文' }));
  return { ok: !holds.length, holds: [...new Set(holds)].filter((h) => h !== 'RELATED_URL_WITHOUT_TITLE' || related.some((r) => r.kind === 'article' && !r.title)), text, cast, related, socials: [...new Set(socials)], removed };
}

// 台帳の書式に合わせる: 出演者=原文の行（リンク付き）を改行区切り、関連記事URL=記事URLを空白区切り
export const castCell = (cast) => cast.map((c) => c.raw.replace(/\s+/g, ' ').trim()).join('\n');
export const relatedCell = (related) => related.filter((r) => (r.kind || 'article') === 'article' && r.url).map((r) => r.url).join(' ');

// 既存値が「原文から機械的に取り出しただけ」か（＝自動値。更新してよい）。原文に無い文字・URLを含むなら人の手が入った可能性→保護
// SC4-11: 旧清掃器の出力の痕跡を自動値として認める（2026-11-13 V2実データ1,675件の分析）。
//   ①旧清掃器が足した節見出しだけの行（【関連記事】〖出演・スタッフ〗等）②URLを消した跡の空かっこ「（ ）」・矢印（↓→▽）・「mailto:」
//   ③リンクの表示文字・href の値（原文のタグの中にある文字）④名前付き文字参照（&darr; 等）。
//   原文に無い文・URLが1つでもあれば従来どおり保護（人が書き足した文は自動値にならない）。
const SECTION_WORD = /^(?:関連記事|関連リンク|出演|出演者|出演・スタッフ|出演スタッフ|スタッフ|ゲスト|MC|音源編集|ご意見・ご感想|ご意見ご感想)$/;
const URL_ANY = /(?:https?:\/\/|mailto:|www\.)[^\s<>"'）)」』】]+|\b[a-z0-9.-]+\.(?:com|co\.jp|jp|fm|me|net|org|st|style)(?:\/[^\s<>"'）)」』】]*)?/gi;
const PD = (t) => NZ(decodeNamedEntities(t)).replace(/[、。，．・「」『』（）()【】〖〗\[\]！？!?…:：;；"'“”‘’〜~ー—–\-,／/|｜↓→▽▼▶►➡＞>＜<※★☆■□◆◇●○♪]/g, '');
function rawSource(raw) {
  const plain = String(raw ?? '').replace(/<!\[CDATA\[|\]\]>/g, ''), hrefs = [...plain.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  return [descriptionLines(plain).join('\n'), plain.replace(/<[^>]*>/g, '\n'), hrefs.join('\n')].join('\n');
}
const urlKey = (u) => cleanUrl(String(u).replace(/[.,;、。]+$/, ''));
function firstNotDerived(existing, raw) {
  const ex = T(existing); if (!ex) return null;
  const src = rawSource(raw), srcUrls = new Set(urlsOf(src).map(urlKey));
  const u = urlsOf(ex).find((x) => !srcUrls.has(urlKey(x))); if (u) return { type: 'URL_NOT_IN_RAW', sample: u.slice(0, 80), rawUrls: [...srcUrls].slice(0, 3).map((x) => x.slice(0, 60)) };
  const srcP = PD(src.replace(URL_ANY, ' '));
  const frags = ex.replace(URL_ANY, '\n').replace(/[（(]\s*[)）]/g, '\n').replace(/[↓→▽▼▶►➡]+/g, '\n')
    .replace(/[【〖]([^】〗]{1,20})[】〗]/g, (m, h) => (SECTION_WORD.test(h.trim()) ? '\n' : '\n' + h + '\n')).split(/[\n。！？／/|｜,、]+/);
  const l = frags.find((x) => { const n = PD(x); return n.length >= 2 && !srcP.includes(n); });
  return l ? { type: 'TEXT_NOT_IN_RAW', sample: l.trim().slice(0, 80) } : null;
}
export function derivedFromRaw(existing, raw) { return !firstNotDerived(existing, raw); }
// 診断用: 自動値とみなせなかった最初の理由（短く切る）
export function explainDerived(existing, raw) { return firstNotDerived(existing, raw); }

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
  // 概要自体が原文由来で品質合格なら、他列の手動値を保持したまま概要を反映できる。概要の手動値は常に要確認。
  if (manual.length) { findings.push('MANUAL_EDIT_PROTECTED:' + manual.join('+')); if (verdict === '自動検査合格・目視未確認' && (manual.includes('summary') || !writable.summary)) verdict = '要確認'; }
  if (ex.cast && !c.cast.length) findings.push('CAST_NOT_IN_RAW');   // 既存の出演者が原文に無い（既定値の疑い）。消さずに記録
  if (verdict === '不合格') ['summary', 'cast', 'related'].forEach((k) => { writable[k] = false; });
  return { verdict, reason: [...new Set([...c.holds, ...findings])].join(','), clean: c, findings, compare: cmp, writable, manual, rawSha: sha256 ? sha256(String(raw)) : '', auditVersion: AUDIT_VERSION };
}
