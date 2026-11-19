// 朝ポキの宇宙（アルテキスト計画）: 言葉・人物・記事の取り出し（純関数。Node のテストでも使う）
// 方針: 形態素解析の辞書を入れず、漢字・カタカナ・英字の「続き」を1語として取る（複合語を分解しない）。
//       意味の推測はしない。取り出した語の共起と、同じ記事・同じ出演者という「事実の一致」だけを関係の根拠にする。

// 番組の定型文・案内文に出る語（どの回にも出るので関係の根拠にならない）
export const STOP_TERMS = new Set([
  'ポッドキャスト', '朝日新聞', '朝日新聞社', '朝日新聞ポッドキャスト', '番組', '配信', '収録', '今回', '記者', '取材', '前編', '後編',
  '感想', '投稿', 'フォーム', '登録', '下記', 'サイト', 'お願い', 'ご意見', 'ご要望', 'ツイッター', 'メール', 'ハッシュタグ', '本日', '今日',
  '特集', '公式', '音源編集', '出演', '進行', '司会', 'リンク', '詳細', '記事', '関連記事', '無料', '有料', '会員', '購読', '申し込み', '応募',
  'お便り', 'リスナー', 'エピソード', 'シリーズ', 'ゲスト', 'コーナー', '最新', '毎週', '毎月', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜',
  '午前', '午後', '時点', '情報', '内容', '紹介', '解説', '話題', '世界', '社会', '問題', '関係', '自分', '私', '僕', '皆さん', 'みなさん',
  '一緒', '本当', '実際', '最近', '以前', '現在', '年前', '先日', '直前', '当時', '今年', '昨年', '来年', '方々', '部分', '場合', '理由', '意味', '状況',
  'ニュース', 'モニター', 'アンケート', 'プレゼント', 'キャンペーン', 'チャンネル', 'アプリ', 'ページ', 'プレイリスト', 'フォロー', 'レビュー',
  '必要', '大切', '様々', '一方', '今後', '注目', '意外', '背景', '経験', '大事', '指摘', '意識', '変化', '影響', '存在', '中心', '最後', '初回',
  '発表', '役割', '相手', '現場', '日々', '魅力', '課題', '人気', '時間', '質問', '時代', '疑問', '登場', '企画', '全開', '一般', '多数', '自身',
  '大切さ', '可能性', '気持', '仕組', '取組', '番組内', '放送', '前回', '次回', '同時', '以上', '以下', '全体', '個人', '方法', '結果', '目的', '対象',
  '大丈夫', '彼女', '時間表記', '広告', '説明文', '購読中', '配信予定', '見出', '朝リス', '朝ポキ', '朝ポキメンバー', 'トーク', 'ラジオ', '連載',
  'spotify', 'apple', 'podcasts', 'podcast', 'amazon', 'music', 'youtube', 'omny', 'http', 'https', 'com', 'www', 'asahi', 'jp', 'html', 'mc', 'be',
]);

const TERM_RE = /[0-9]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9Ａ-Ｚａ-ｚ０-９&＆.\-]*[一-龯々〆ヵヶ]*|[一-龯々〆ヵヶ]+(?:[ァ-ヴー]+[一-龯々]*)?|[ァ-ヴー]{2,}(?:[一-龯々]+)?/g;

// 1つの文から候補語（重複あり・出現順）
export function extractTerms(text) {
  const s = String(text || '').normalize('NFKC').replace(/https?:\/\/\S+/g, ' ');
  const out = [];
  for (const m of s.matchAll(TERM_RE)) {
    let t = m[0].replace(/^[.\-]+|[.\-]+$/g, '').replace(/(記者|編集委員|論説委員|特派員|支局長|編集長|解説委員)$/, '');   // 「◯◯記者」は人物名へ
    if (t.length < 2 || t.length > 16) continue;
    if (/^ー+$/.test(t) || /^[0-9.\-]+$/.test(t)) continue;
    if (/^(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]{6,}$/.test(t)) continue;   // 英数字の符号（PA83ET など）
    if (STOP_TERMS.has(t.toLowerCase())) continue;
    if (/^(年|月|日|時|分|毎週|毎月|原則|隔週)/.test(t) || /(曜日|月号|配信|収録|配信中|公開中|限定)$/.test(t)) continue;   // 日付・予定・案内の定型
    if (/\.(com|jp|net|org|fm)$/i.test(t) || /^(下記|上記)/.test(t)) continue;   // URL の切れ端・案内文
    // 動詞・形容詞の語幹（目指す→目指、面白い→面白）: 1〜2字の漢字の直後が送り仮名
    const next = s.charAt(m.index + m[0].length);
    if (/^[一-龯々]{1,2}$/.test(t) && /[いうえかきくけこさしすせそたちつっるれろめみま]/.test(next)) continue;
    out.push(t);
  }
  return out;
}
export const termKey = (t) => String(t).normalize('NFKC').toLowerCase();

// 出演者欄 → 人物名（役割語・所属の括弧は外す）
const ROLE = /^(mc|ｍｃ|音源編集|進行|司会|ゲスト|出演|聞き手|語り|ナレーション|構成|編集|制作|プロデューサー|ディレクター|記者|朗読|ほか|他)$/i;
export function parseCast(cast) {
  const s = String(cast || '').normalize('NFKC').replace(/[（(][^）)]*[）)]/g, ' ');
  const names = new Set();
  for (const raw of s.split(/[\/；;、,・\n]|\s{2,}|\s+と\s+/)) {
    const t = raw.replace(/^(mc|音源編集|進行|司会|聞き手|ゲスト)[、,:：\s]*/i, '').replace(/\s+/g, '').trim();
    if (t.length < 2 || t.length > 10 || ROLE.test(t) || /(編集部|部|局|社|班|グループ|チーム)$/.test(t)) continue;   // 所属・組織は人物にしない
    if (!/^[一-龯々ぁ-んァ-ヴーA-Za-z]+$/.test(t)) continue;
    names.add(t);
  }
  return [...names];
}

// 記事URLの正規化（クエリ・断片を外す）。記事本文や見出しは扱わない
export function normalizeArticleUrl(url) {
  try { const u = new URL(String(url)); if (!/^https?:$/.test(u.protocol)) return ''; return (u.host + u.pathname).replace(/\/+$/, ''); } catch { return ''; }
}

// 再生先の種類（URLのホストだけで判定。URLは作らない）
export function platformOf(url) {
  const h = (() => { try { return new URL(url).host; } catch { return ''; } })();
  if (/spotify\.com$/.test(h)) return 'Spotify';
  if (/podcasts\.apple\.com$/.test(h)) return 'Apple Podcasts';
  if (/music\.amazon\./.test(h)) return 'Amazon Music';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'YouTube';
  if (/pca\.st$/.test(h)) return 'Pocket Casts';
  if (/omny\.fm$/.test(h)) return 'Omny';
  if (/asahi\.com$/.test(h)) return '朝日新聞';
  if (/listen\.style$/.test(h)) return 'LISTEN';
  if (/pody\.jp$/.test(h)) return 'Pody';
  return '';
}
