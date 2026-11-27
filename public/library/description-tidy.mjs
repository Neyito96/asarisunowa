// #315 概要欄の表示整形（表示のときだけ。公開データ・V2原本は書き換えない）
// 残す: 本編の説明・収録日・「番組内で紹介したポッドキャストは…」・関連記事（タイトル＋URL → 1件ずつリンク）
// 外す: イベント告知・宣伝・会員登録のお願い・SNS/discord 案内・【出演・スタッフ】などの定型
// 判断がつかないときは HOLD（元の概要をそのまま出す）。URLは本文にあるものだけを使い、作らない。
const RELATED_HEAD = /関連|関係記事|おすすめ記事|今回取り上げた|記事】|リンク|参考|連載|そもそも解説|まとめてわかる|解説人語|詳報|特集|社説|エピソード】|ポッドキャスト】|番組】|動画】|写真|コンテンツ|サイト】|アーカイブ|記者サロン/;
const DROP_HEAD = /GOOD LIFEフェア|出演|スタッフ|おねがい|お願い|朝ポキ情報|キャンペーン|イベント|申込|申し込み|締め?切|募集|プレゼント|登録|購読|会員|はじめるなら|月額|円で|スペシャルデー|生配信|夜会|ご案内|おしらせ|お知らせ|ツイッター|Twitter|インスタ|メール|discord|SPONSORED|開催|登壇|公演|配信のお知らせ|リスナーさんへ|語ろう|ご意見|アンケート|公式サイト|ビデオポッドキャスト|Spotify|Apple Podcasts|朝リスの木|会場|ニュースの要点|ニュース4U|よせがき|見逃し|まで配信/;
const KEEP_HEAD = /番組内容|^【内容】|議題|タイムスタンプ|要旨|前編|後編|ネタバレ/;
// #501 第2段（管理人決定 2026-11-25）: 見出しごと本文として残すもの／関連記事として扱うもの／告知として外すもの
const KEEP_WITH_HEAD = /^【(テーマ|u29|速報|HOU-DAN|逮捕|大阪|新聞の発行部数|新聞広告|総売り上げ|新聞のデジタル広告|ふるさとは被災地|科学ホラーミステリー|3\.11\s*特別編\d*)】$/i;
const RELATED_HEAD_501 = /^【(字幕付きの動画はこちら|毎日更新|潜入取材|動画あり|ウェビナー採録|石破首相あいさつ全文|随時更新|更新中|A\s?Scene|ユーミン\s?Artist\s?CHLONICLE|「?人生の贈りもの」?を本人の声で|朝日新聞宇宙部)】$/i;
const DROP_HEAD_501 = /^【(朝日地球会議2025|朝ポキ忘年会[^】]*|Podcast Weekend[^】]*|紹介したシリーズはこちら|独演会のチケットはこちらから|ニュースの学校)】$/;
const PROMO = /お友達登録|友だち登録|LINE公式|申し込み|申込|締め切|〆切|会員登録|キャンペーン|初月無料|無料|アーカイブ配信|discord|フォロー|おたより|プレイリスト|🎧|購読|イベント|お会いしましょう|ご利用いただけます|ログインID|チケット|応募|はこちら|配信中|お待ちしています|ご意見|感想|リクエスト|podcast@asahi\.com/i;
const STRONG_PROMO = /ad choices|adchoices|megaphone\.fm|お申し込み|会員登録|初月無料|キャンペーン|購読料で配信|ご利用いただけます|新プレイリスト|多彩な番組を配信中|privacy information|Learn more about|omnystudio\.com|他にも様々な番組を配信|関連記事も読んでいただけます|テキストでも読めます/i;
const PROMO_URL = /asahi\.com\/special\/n4u\/?$|bit\.ly\/(asapoki|asapki|4k4ZKwA)|t\.asahi\.com\/(w|asapoki)|discord\.gg|ciy\.digital\.asahi\.com|digital\.asahi\.com\/pr\/|omnystudio\.com|x\.gd\/|youtube\.com\/@asapoki/i;
const URL_ONLY = /^https?:\/\/\S+$/;
const RECORDED = /^※?\s*(\d{4})年(\d{1,2})月(\d{1,2})日に収録(?:しました)?。?$/;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&darr;': '↓', '&uarr;': '↑', '&rarr;': '→', '&larr;': '←' };

const ARTICLE_URL = /^https:\/\/((www\.)?asahi\.com\/|digital\.asahi\.com\/articles|withnews\.jp\/|globe\.asahi\.com\/|book\.asahi\.com\/|dot\.asahi\.com\/|news\.yahoo\.co\.jp\/)/;
const SOCIAL_URL = /twitter\.com|x\.com\/|instagram\.com|buff\.ly|facebook\.com|tiktok\.com|forms\.|note\.com\/asahi/i;
// 「タイトル URL」の並び → 1件ずつ。宣伝・SNS の行は外す。読めない残りがあれば null（HOLD）
function relatedPairs(text) {
  const t = text.replace(/[（(]\s*Spotify\s+(https:\/\/\S+?)\s*[／\/]\s*Apple\s*Podcasts\s+https?:\/\/\S+?\s*[）)]/gi, ' $1 ')   // #501「題名（ Spotify URL ／ApplePodcasts URL ）」→ Spotify の1本だけ
    .replace(/[（(]\s*(https?:\/\/[^\s）)]+)\s*[）)]/g, ' $1 ').replace(/\s*[▽／]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [], re = /(\S.*?)\s*(https?:\/\/[^\s]+)/g; let m, last = 0;
  while ((m = re.exec(t))) {
    const title = m[1].replace(/^[）)\s]+/, '').trim(), url = m[2]; last = re.lastIndex;
    if (PROMO_URL.test(url) || SOCIAL_URL.test(url) || PROMO.test(title) || /^(ウェブサイト|朝日新聞ポッドキャスト|公式サイト|番組一覧|過去の回)/.test(title)) continue;
    // 「朝日新聞ポッドキャスト（番組一覧URL）」の定型。その前にURLのない題名が付いていたら、リンクを作れないので保留（#501）
    if (/asahi\.com\/special\/podcasts\/?(\?iref=omny)?$/.test(url)) { if (title.replace(/朝日新聞ポッドキャスト$/, '').trim()) return null; continue; }
    if (!title || URL_ONLY.test(title) || title.length > 120 || !/^https:/.test(url)) return null;
    out.push({ title, url });
  }
  const rest = t.slice(last).replace(/^[。、．.）)\s]+/, '').trim();
  return rest && !PROMO.test(rest) && !STRONG_PROMO.test(rest) ? null : out;
}

// ポッドキャストアワード投票の呼びかけ（2025年11月末〜2026年1月の配信回の冒頭に共通）。番組内容として触れる文は消さない
const STAR_KEEP = /訂正|お詫び|申し訳|ネタバレ|説明を改め/;
// 「祝・1億DL！ 5/31（土）」は節目の記録として残し、続くイベント告知（グッズ・会場・配信の案内・申し込み）だけ外す（管理人判断 2026-11-20）
const MILLION_DL_EVENT = /(祝・1億DL！\s*5\/31（土）)\s*イベント\s.*?(?:こちらから|視聴可能です。|視聴できます)\s*↓?\s*(?:※朝日ID会員の登録（無料）で申し込めます。\s*)?/g;
const AWARD_PLEA = /(?:★★[^★]{1,30}★★\s*)?ポッドキャストアワードに投票してください[！!]\s*(?:https?:\/\/\S*award\S*\s*)?(?:[（(][^）)]{0,40}(?:報談|分散)[^）)]{0,40}[）)]\s*)?/g;

// 整形を保留（HOLD）して元の文面を出すときも、投票の呼びかけだけは外す
export function withoutAwardPlea(raw) {
  // 元の文面を出すときも、&hellip; &darr; などの記号の書き方は元に戻す（2026-11-28・46回）
  const s = String(raw || '').replace(/&[a-z#0-9]+;/gi, (x) => ENT[x] ?? x), flat = s.replace(/\s+/g, ' ');
  AWARD_PLEA.lastIndex = 0;
  if (!AWARD_PLEA.test(flat)) return s;   // 呼びかけがない回は元の文面（改行も）をそのまま
  return flat.replace(AWARD_PLEA, ' ').replace(/\s+/g, ' ').trim();
}

export function tidyDescription(raw) {
  const awardRemoved = [];
  const text0 = String(raw || '').replace(/&[a-z#0-9]+;/gi, (x) => ENT[x] ?? x).replace(/[〖［]/g, '【').replace(/[〗］]/g, '】').replace(/([^\s])(https?:\/\/)/g, '$1 $2').replace(/\s+/g, ' ').replace(AWARD_PLEA, (m) => { awardRemoved.push(m.trim()); return ' '; }).replace(MILLION_DL_EVENT, (m, keep) => { awardRemoved.push(m.slice(keep.length).trim()); return keep + ' '; }).replace(/\s+/g, ' ').trim();
  // #501 古い回の定型：「この番組は2021年7月14日に収録しました。」は収録日へ、「…に配信しました。」は本文の最後へ（関連記事の欄に紛れて保留になっていた）
  let recordedAt = '', aired = '';
  const text = text0.replace(/mailto:\S+/g, ' ').replace(/([。！？])\s*(関連(?:記事)?[：:])/g, '$1 $2 ').replace(/(?:おたより)?フォーム\s*https:\/\/forms\.gle\/\S+|ツイッター\s*https:\/\/twitter\.com\/AsahiPodcast\S*|メール\s*podcast@asahi\.com/g, ' ').replace(/(https?:\/\/[\x21-\x7e]+?)(?=[^\x00-\x7f])/g, '$1 ')
    .replace(/※?\s*(?:なお、)?この番組は(\d{4})年(\d{1,2})月(\d{1,2})日に(収録|配信)しました。/g, (m, y, mo, d, k) => { if (k === '収録') recordedAt = recordedAt || `${y}年${Number(mo)}月${Number(d)}日`; else aired = aired || m.replace(/^なお、/, ''); return ' '; }).replace(/\s+/g, ' ').trim();
  if (!text) return { status: 'EMPTY', reason: '', body: '', recordedAt: '', related: [], removed: [] };
  // 「…続きにある【関連記事】の１つめは」のように文の途中で言葉として出る【…】は見出しにしない（直後が助詞のとき・2026-11-28 EP-06733）
  const parts = text.split(/(?=【[^】]{1,40}】(?![のはをがにでともへや]))/), body = [], related = [], removed = [...awardRemoved];
  let hold = '';
  for (const part of parts) {
    const head = (part.match(/^【[^】]*】/) || [''])[0];
    if (head && (DROP_HEAD_501.test(head) || DROP_HEAD.test(head) && !KEEP_HEAD.test(head) && !KEEP_WITH_HEAD.test(head) && !RELATED_HEAD_501.test(head))) { removed.push(part.slice(0, 40)); continue; }
    const inner = part.slice(head.length).trim();
    // 【特設サイト：…】 https://… のように見出しそのものが題名で、中身がURL1本だけ → 関連記事として1件に
    if (head && !KEEP_HEAD.test(head) && !KEEP_WITH_HEAD.test(head) && !DROP_HEAD.test(head) && URL_ONLY.test(inner) && /^https:/.test(inner) && (ARTICLE_URL.test(inner) || /asahi\.com\/special\//.test(inner)) && !PROMO_URL.test(inner) && !/special\/podcasts/.test(inner) && !/^【(ウェブサイト|公式サイト|番組一覧|過去の回)/.test(head)) {
      related.push({ title: head.slice(1, -1).trim(), url: inner }); continue;
    }
    // 見出しが知らない形でも、中身が宣伝（宣伝用URLだけ＋会員・無料・公開中などの案内）なら告知として外す（#500 EP-05247「遠藤デスクがスマホ撮影のコツを動画で紹介！」）
    if (head && !KEEP_HEAD.test(head) && !KEEP_WITH_HEAD.test(head) && !RELATED_HEAD.test(head) && !RELATED_HEAD_501.test(head)) {
      const urls = inner.match(/https?:\/\/\S+/g) || [];
      if (urls.length && urls.every((u) => PROMO_URL.test(u)) && (PROMO.test(inner) || STRONG_PROMO.test(inner) || /公開中|配信中|会員/.test(inner))) { removed.push(part.slice(0, 40)); continue; }
    }
    if (head && (RELATED_HEAD.test(head) || RELATED_HEAD_501.test(head)) && !KEEP_HEAD.test(head) && !KEEP_WITH_HEAD.test(head)) {
      const r = relatedPairs(part.slice(head.length).trim());
      if (!r) hold = hold || (/https:\/\//.test(part) ? '関連記事の形が読めない' : '関連記事にURLがない');
      else related.push(...r);
      continue;
    }
    if (head && !KEEP_HEAD.test(head) && !KEEP_WITH_HEAD.test(head)) { hold = hold || '知らない見出し'; }
    let promo = false; const chunks = part.slice(head && KEEP_HEAD.test(head) ? head.length : 0).split(' ').filter(Boolean);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i], rec = chunk.match(RECORDED);
      if (/^[／\/]$/.test(chunk) && (!body.length || /^[（(]|[）)]$|^[／\/]$/.test(body[body.length - 1]) || /^[／\/]?$/.test(chunks[i + 1] || ''))) { removed.push(chunk); continue; }   // 定型を外したあとに残る区切りの「／」（#501）
      if (/^[）)]$/.test(chunk) && !/[（(][^）)]*$/.test(body.join(' '))) { removed.push(chunk); promo = false; continue; }   // 宣伝URLを外したあとに残る閉じかっこ（#501）
      if (rec) { recordedAt = `${rec[1]}年${Number(rec[2])}月${Number(rec[3])}日`; promo = false; continue; }
      if (chunk.startsWith('★')) {
        // ★で始まっても、訂正・お詫び・ネタバレ注意・番組名（★the Letter）は中身なので残す（★の飾りだけ外す）
        let j = i, sentence = chunk; while (!/[。！!？?]★*$/.test(chunks[j]) && j + 1 < chunks.length && j - i < 6 && !chunks[j + 1].startsWith('★') && !URL_ONLY.test(chunks[j + 1])) sentence += ' ' + chunks[++j];
        if (STAR_KEEP.test(sentence) || /^★[a-z]+$/.test(chunk)) { const kept = chunk.replace(/★+/g, ' ').trim(); if (kept) body.push(kept); promo = false; continue; }
        promo = true; removed.push(chunk); continue;
      }
      if (/^[＼\\]/.test(chunk) && (PROMO.test(chunk) || /まで[！!]?$/.test(chunk))) { promo = true; removed.push(chunk); continue; }   // 「＼締め切り迫る！4/24（木）まで」型の告知
      if (promo && /^\d{1,2}(時|:\d{2})(から|〜|～)?$/.test(chunk)) { removed.push(chunk); continue; }   // 告知の消し残し（「19時から」など）
      if (chunk.startsWith('※') && !/紹介した/.test(chunk) && PROMO.test(chunk)) { promo = true; removed.push(chunk); continue; }
      if (URL_ONLY.test(chunk)) {
        if (promo || PROMO_URL.test(chunk)) { removed.push(chunk); continue; }
        if (/asahi\.com\/special\/podcasts\/?(\?iref=omny)?$/.test(chunk)) { if (/朝日新聞ポッドキャスト[（(]?$/.test(body[body.length - 1] || '')) removed.push(body.pop()); removed.push(chunk); if (/^[）)]/.test(chunks[i + 1] || '')) { chunks[i + 1] = chunks[i + 1].replace(/^[）)]+\s*/, ''); if (!chunks[i + 1]) i++; } continue; }   // 番組一覧への定型リンク（#501）
        const prev = body[body.length - 1] || '';
        if (SOCIAL_URL.test(chunk) || /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) { if (prev && /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) removed.push(body.pop()); removed.push(chunk); if (/^[）)]/.test(chunks[i + 1] || '')) { chunks[i + 1] = chunks[i + 1].replace(/^[）)]+\s*/, ''); if (!chunks[i + 1]) i++; } continue; }
        if (ARTICLE_URL.test(chunk) && /^https:/.test(chunk)) {   // 本文中の「記事タイトル URL」→ 関連記事へ（タイトルは直前の文の切れ目まで）
          const title = []; while (body.length && !/[。！？!?]$/.test(body[body.length - 1]) && !/。/.test(body[body.length - 1]) && title.length < 6) title.unshift(body.pop());   // 文の途中（「。」を含む）は題名にしない #501
          const tt = title.join(' ').replace(/^[〖【]?関連(?:記事)?[】〗：:]?\s*/, '').replace(/[（(▽]$/, '').replace(/^[）)▽]+/, '').replace(/^[／\/：:\s]+$/, '').trim();
          if (tt && tt.length <= 120) { related.push({ title: tt, url: chunk }); if (/^[）)]/.test(chunks[i + 1] || '')) { chunks[i + 1] = chunks[i + 1].replace(/^[）)]+\s*/, ''); if (!chunks[i + 1]) i++; } continue; }
          if (!tt && (title.length || /関連(?:記事)?[：:]$|^[／\/]$/.test(body[body.length - 1] || '') || related.length)) { related.push({ title: '', url: chunk }); continue; }   // 「関連記事：URL ／ URL」の題名なし。リンクだけ関連記事へ（題名は作らない #501）
          body.push(...title);
        }
        hold = hold || '本文にURLが残る'; body.push(chunk); continue;
      }
      if (/^(朝リスの田|「?朝リス課外活動」?|byネジートさん|byたんたんさん)$/.test(chunk)) { removed.push(chunk); promo = true; continue; }   // ドーナツの定型（朝リスの田 byネジートさん／朝リス課外活動 byたんたんさん）
      if (STRONG_PROMO.test(chunk)) { removed.push(chunk); promo = true; continue; }
      if ((promo || URL_ONLY.test(chunks[i + 1] || '') && PROMO_URL.test(chunks[i + 1])) && (PROMO.test(chunk) || /^[（(].*[）)]$/.test(chunk))) { removed.push(chunk); promo = true; continue; }
      if (promo && /^(See|Learn|more|about|for|information\.?|privacy|your|ad|choices\.?|Visit)$/i.test(chunk)) { removed.push(chunk); continue; }
      promo = false; body.push(chunk);
    }
  }
  const out = [...body, aired].filter(Boolean).join(' ').trim();
  if (!out && !related.length && !recordedAt && removed.length && !hold) return { status: 'PROMO_ONLY', reason: '告知のみ', body: '', recordedAt, related, removed };   // 公式の概要欄が告知・定型だけ（ポすすめ回など）
  if (!hold && !out && !related.length && !recordedAt) hold = '本文が空になる';
  return { status: hold ? 'HOLD' : removed.length || related.length || recordedAt ? 'TIDY' : 'AS_IS', reason: hold, body: out, recordedAt, related, removed };
}

// 表示のときだけの改行（2026-11-27・管理人報告 EP-02595 月刊朝ポキ）。データには改行が無いので、
// 「◆」「■」の見出しの前で改行し、見出しのあとに並ぶ回の一覧は「#1194」などの回番号ごとに改行する。消えたURLの跡「（ 。」は「。」に。
export function descriptionLines(text) {
  const t = String(text || '').replace(/[（(]\s*[）)]?\s*。/g, '。').replace(/。(\s*。)+/g, '。');
  const parts = t.split(/\s*(?=[◆■])/);
  return parts.map((p, i) => (i === 0 && !/^[◆■]/.test(p) ? p : p.replace(/^([◆■][^\s◆■]{1,30}(?:セレクト|エピソード))\s+/, '$1\n').replace(/(#\d+(?:-\d+)?)\s+(?=\S)/g, '$1\n'))).join('\n').trim();
}
