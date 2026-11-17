// #315 概要欄の表示整形（表示のときだけ。公開データ・V2原本は書き換えない）
// 残す: 本編の説明・収録日・「番組内で紹介したポッドキャストは…」・関連記事（タイトル＋URL → 1件ずつリンク）
// 外す: イベント告知・宣伝・会員登録のお願い・SNS/discord 案内・【出演・スタッフ】などの定型
// 判断がつかないときは HOLD（元の概要をそのまま出す）。URLは本文にあるものだけを使い、作らない。
const RELATED_HEAD = /関連|関係記事|おすすめ記事|今回取り上げた|記事】|リンク|参考|連載|そもそも解説|まとめてわかる|解説人語|詳報|特集|社説|エピソード】|ポッドキャスト】|番組】|動画】|写真|コンテンツ|サイト】|アーカイブ|記者サロン/;
const DROP_HEAD = /GOOD LIFEフェア|出演|スタッフ|おねがい|お願い|朝ポキ情報|キャンペーン|イベント|申込|申し込み|締め?切|募集|プレゼント|登録|購読|会員|はじめるなら|月額|円で|スペシャルデー|生配信|夜会|ご案内|おしらせ|お知らせ|ツイッター|Twitter|インスタ|メール|discord|SPONSORED|開催|登壇|公演|配信のお知らせ|リスナーさんへ|語ろう|ご意見|アンケート|公式サイト|ビデオポッドキャスト|Spotify|Apple Podcasts|朝リスの木|会場|ニュースの要点|ニュース4U|よせがき|見逃し|まで配信/;
const KEEP_HEAD = /番組内容|^【内容】|議題|タイムスタンプ|要旨|前編|後編|ネタバレ/;
const PROMO = /申し込み|申込|締め切|〆切|会員登録|キャンペーン|初月無料|無料|アーカイブ配信|discord|フォロー|おたより|プレイリスト|🎧|購読|イベント|お会いしましょう|ご利用いただけます|ログインID|チケット|応募|はこちら|配信中|お待ちしています|ご意見|感想|リクエスト/i;
const STRONG_PROMO = /ad choices|adchoices|megaphone\.fm|お申し込み|会員登録|初月無料|キャンペーン|購読料で配信|ご利用いただけます|新プレイリスト|多彩な番組を配信中|privacy information|Learn more about|omnystudio\.com/i;
const PROMO_URL = /bit\.ly\/(asapoki|4k4ZKwA)|t\.asahi\.com\/(w|asapoki)|discord\.gg|ciy\.digital\.asahi\.com|digital\.asahi\.com\/pr\/|omnystudio\.com|x\.gd\/|youtube\.com\/@asapoki/i;
const URL_ONLY = /^https?:\/\/\S+$/;
const RECORDED = /^※?\s*(\d{4})年(\d{1,2})月(\d{1,2})日に収録(?:しました)?。?$/;
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–' };

const ARTICLE_URL = /^https:\/\/((www\.)?asahi\.com\/|digital\.asahi\.com\/articles|withnews\.jp\/|globe\.asahi\.com\/|book\.asahi\.com\/|dot\.asahi\.com\/|news\.yahoo\.co\.jp\/)/;
const SOCIAL_URL = /twitter\.com|x\.com\/|instagram\.com|buff\.ly|facebook\.com|tiktok\.com|forms\.|note\.com\/asahi/i;
// 「タイトル URL」の並び → 1件ずつ。宣伝・SNS の行は外す。読めない残りがあれば null（HOLD）
function relatedPairs(text) {
  const t = text.replace(/[（(]\s*(https?:\/\/[^\s）)]+)\s*[）)]/g, ' $1 ').replace(/\s*[▽／]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const out = [], re = /(\S.*?)\s*(https?:\/\/[^\s]+)/g; let m, last = 0;
  while ((m = re.exec(t))) {
    const title = m[1].trim(), url = m[2]; last = re.lastIndex;
    if (PROMO_URL.test(url) || SOCIAL_URL.test(url) || PROMO.test(title) || /^(ウェブサイト|朝日新聞ポッドキャスト|公式サイト|番組一覧|過去の回)/.test(title)) continue;
    if (!title || URL_ONLY.test(title) || title.length > 120 || !/^https:/.test(url)) return null;
    out.push({ title, url });
  }
  const rest = t.slice(last).trim();
  return rest && !PROMO.test(rest) && !STRONG_PROMO.test(rest) ? null : out;
}

export function tidyDescription(raw) {
  const text = String(raw || '').replace(/&[a-z#0-9]+;/gi, (x) => ENT[x] ?? x).replace(/[〖［]/g, '【').replace(/[〗］]/g, '】').replace(/([^\s])(https?:\/\/)/g, '$1 $2').replace(/\s+/g, ' ').trim();
  if (!text) return { status: 'EMPTY', reason: '', body: '', recordedAt: '', related: [], removed: [] };
  const parts = text.split(/(?=【[^】]{1,40}】)/), body = [], related = [], removed = [];
  let recordedAt = '', hold = '';
  for (const part of parts) {
    const head = (part.match(/^【[^】]*】/) || [''])[0];
    if (head && DROP_HEAD.test(head) && !KEEP_HEAD.test(head)) { removed.push(part.slice(0, 40)); continue; }
    if (head && RELATED_HEAD.test(head) && !KEEP_HEAD.test(head)) {
      const r = relatedPairs(part.slice(head.length).trim());
      if (!r) hold = hold || (/https:\/\//.test(part) ? '関連記事の形が読めない' : '関連記事にURLがない');
      else related.push(...r);
      continue;
    }
    if (head && !KEEP_HEAD.test(head)) { hold = hold || '知らない見出し'; }
    let promo = false; const chunks = part.slice(head && KEEP_HEAD.test(head) ? head.length : 0).split(' ').filter(Boolean);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i], rec = chunk.match(RECORDED);
      if (rec) { recordedAt = `${rec[1]}年${Number(rec[2])}月${Number(rec[3])}日`; promo = false; continue; }
      if (chunk.startsWith('★')) { promo = true; removed.push(chunk); continue; }
      if (chunk.startsWith('※') && !/紹介した/.test(chunk) && PROMO.test(chunk)) { promo = true; removed.push(chunk); continue; }
      if (URL_ONLY.test(chunk)) {
        if (promo || PROMO_URL.test(chunk)) { removed.push(chunk); continue; }
        const prev = body[body.length - 1] || '';
        if (SOCIAL_URL.test(chunk) || /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) { if (prev && /こちら|フォーム|一覧|フォロー|つぶやき|登録|ご意見|感想|お願いします/.test(prev)) removed.push(body.pop()); removed.push(chunk); if (/^[）)]/.test(chunks[i + 1] || '')) i++; continue; }
        if (ARTICLE_URL.test(chunk) && /^https:/.test(chunk)) {   // 本文中の「記事タイトル URL」→ 関連記事へ（タイトルは直前の文の切れ目まで）
          const title = []; while (body.length && !/[。！？!?]$/.test(body[body.length - 1]) && title.length < 6) title.unshift(body.pop());
          const tt = title.join(' ').replace(/^[〖【]?関連記事[】〗]?\s*/, '').replace(/[（(]$/, '').trim();
          if (tt && tt.length <= 120) { related.push({ title: tt, url: chunk }); if (/^[）)]/.test(chunks[i + 1] || '')) i++; continue; }
          body.push(...title);
        }
        hold = hold || '本文にURLが残る'; body.push(chunk); continue;
      }
      if (STRONG_PROMO.test(chunk)) { removed.push(chunk); promo = true; continue; }
      if ((promo || URL_ONLY.test(chunks[i + 1] || '') && PROMO_URL.test(chunks[i + 1])) && (PROMO.test(chunk) || /^[（(].*[）)]$/.test(chunk))) { removed.push(chunk); promo = true; continue; }
      if (promo && /^(See|Learn|more|about|for|information\.?|privacy|your|ad|choices\.?|Visit)$/i.test(chunk)) { removed.push(chunk); continue; }
      promo = false; body.push(chunk);
    }
  }
  const out = body.join(' ').trim();
  if (!hold && !out && !related.length && !recordedAt) hold = '本文が空になる';
  return { status: hold ? 'HOLD' : removed.length || related.length || recordedAt ? 'TIDY' : 'AS_IS', reason: hold, body: out, recordedAt, related, removed };
}
