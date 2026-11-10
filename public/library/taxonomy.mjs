// 蔵・宇宙 共通分類辞書（検討案 v0）。asarisu-universe の lab-taxonomy-proposal-20261027
// (PROPOSAL_ONLY, 20主テーマ/103小テーマ, 全件 approved:false) を ID・同義語・親子つきで中央管理する。
// 方針: 単一文字・2文字未満の語では判定しない / 複数テーマに一致したら HOLD / 人間承認(locked)は上書きしない。
export const THEMES = [
  ['politics','政治・行政',['選挙','政党','国会','地方自治','行政政策'],['政治','内閣','首相','政権','与党','野党','国会','選挙','自民党','立憲','議員','閣僚','裏金','知事','市長','総理']],
  ['world','国際・外交',['国際機関','米州','欧州','中国・台湾','中東'],['外交','国際情勢','トランプ','ウクライナ','ロシア','中東','ガザ','台湾','北朝鮮','国連','米国','アメリカ','欧州','関税交渉','首脳会談']],
  ['economy','経済・金融',['物価','金融市場','税制','企業経営','産業政策'],['経済','物価','インフレ','円安','円高','株価','日銀','金利','税金','増税','減税','関税','賃上げ','予算','財政','企業']],
  ['work','仕事・労働',['雇用','働き方','労働法','職場問題','技能'],['労働','雇用','働き方','残業','転職','賃金','過労','パワハラ','非正規','就職']],
  ['society','社会・人権',['差別','移民','生活困窮','社会保障','市民社会'],['人権','差別','移民','外国人','難民','貧困','生活保護','年金','社会保障','ヘイト']],
  ['law','法律・司法',['裁判','刑事事件','法制度','冤罪','犯罪被害'],['裁判','判決','最高裁','検察','警察','逮捕','冤罪','事件','容疑','刑事','法改正','弁護士']],
  ['gender','ジェンダー',['男女平等','性別役割','性の多様性','家族と制度','ハラスメント'],['ジェンダー','男女平等','フェミニズム','性差別','LGBT','同性婚','選択的夫婦別姓','セクハラ','性暴力']],
  ['welfare','福祉・介護',['障害福祉','高齢者福祉','介護','子ども福祉','地域支援'],['福祉','介護','障害者','高齢者','ヤングケアラー','認知症','児童養護','子育て支援']],
  ['health','健康・医療',['医療制度','病気と治療','公衆衛生','心身の健康','再生医療'],['医療','病院','医師','がん','感染症','ワクチン','コロナ','治療','メンタルヘルス','うつ','睡眠','健康']],
  ['science','科学',['宇宙・天文','物理','化学・材料','生命科学','数学'],['科学','宇宙','天文','ロケット','物理','化学','ノーベル賞','研究者','数学','生物学','遺伝子']],
  ['tech','AI・技術',['人工知能','インターネット','情報セキュリティ','ロボット','デジタル政策'],['AI','人工知能','生成AI','ChatGPT','ロボット','サイバー','ランサムウェア','半導体','アプリ','デジタル','SNS']],
  ['environment','環境・気候',['気候変動','脱炭素','エネルギー','環境汚染','資源'],['気候変動','地球温暖化','猛暑','脱炭素','再生可能エネルギー','原発','原子力','核のごみ','プラスチック','環境','エネルギー']],
  ['nature','動物・自然',['野生動物','植物','生態系','動物福祉','自然保護'],['動物','クマ','野生','生き物','昆虫','野鳥','自然','森林','海洋','ペット','愛犬','愛猫']],
  ['disaster','防災',['地震','風水害','避難','災害支援','原子力災害'],['防災','地震','津波','豪雨','台風','洪水','避難','災害','南海トラフ','能登','被災']],
  ['education','教育',['学校教育','大学・研究','教育制度','子どもの学び','部活動'],['教育','学校','大学','受験','先生','教員','いじめ','不登校','部活','給食']],
  ['media','メディア',['新聞・報道','ポッドキャスト','テレビ・映像','SNS','メディア倫理'],['メディア','新聞記事','報道','ポッドキャスト','テレビ','放送','ジャーナリズム','ニュースレター']],
  ['culture','文化・芸術',['文学','美術','音楽','映画・演劇','建築'],['文学','小説','美術','絵画','展覧会','音楽','映画','演劇','漫画','アニメ','建築','芸術','芥川賞','直木賞','落語']],
  ['life','暮らし・生活',['食','住まい','交通・移動','趣味','家族・地域'],['暮らし','食事','料理','レシピ','住まい','家賃','マンション','電車','鉄道','旅行','観光','ゲーム','家族']],
  ['sports','スポーツ',['野球','サッカー','バスケットボール','フィギュアスケート','相撲','陸上競技','パラスポーツ','その他競技'],['スポーツ','野球','サッカー','バスケ','フィギュア','相撲','陸上','マラソン','五輪','オリンピック','パラリンピック','W杯','ワールドカップ','大谷']],
  ['history','歴史・宗教',['日本史','世界史','文化財','宗教','伝統'],['歴史','戦争','戦後','終戦','被爆','原爆','宗教','教会','神社','仏教','文化財','江戸','明治','昭和']],
].map(([id,name,subs,syn],i)=>({id,no:i+1,name,subthemes:subs.map(s=>({id:`${id}.${s}`,name:s})),synonyms:syn}));

// 過去の台帳/承認データで使われた旧ラベル → 20主テーマID（複数可）。旧ラベルは捨てず別名として保持。
export const LEGACY_ALIASES = {
  '政治':['politics'],'国際':['world'],'経済':['economy'],'労働':['work'],'人権・司法':['society','law'],
  '福祉・人権':['welfare','society'],'歴史・文化':['history','culture'],'暮らし':['life'],'交通':['life'],
  '人口・少子化':['society'],'安全保障':['world'],'税制':['economy'],
};
const NAME_TO_ID=new Map(THEMES.map(t=>[t.name,t.id]));
export function themeIdsForLabel(label) {
  const main=String(label||'').split('/')[0].trim();
  if (NAME_TO_ID.has(main)) return [NAME_TO_ID.get(main)];
  return LEGACY_ALIASES[main]||[];
}

// 偽一致ガード: 1文字語は禁止。「日本」「本」のような広い語や、他語の一部としての一致(例:「食」in「食品」以外の誤り)を避けるため
// 英数字語は前後が英数字でないこと、日本語語は2文字以上を要求し、下の否定文脈を除去してから照合する。
const STOP_CONTEXT=/朝日小学生新聞|朝日新聞ポッドキャスト|朝ポキ|番組継続|会員登録|おたよりフォーム|番組検索ツール|番組カレンダー|公式サイト|広告ご検討|アプリで記者と対話|関連記事|購読料|privacy information|omnystudio/g;
function bodyText(title,description) {
  const d=String(description||'').split(/【関連記事】|【出演|【おねがい】|【朝ポキ情報】|▼|★/)[0];
  return (String(title||'')+'\n'+d).replace(/https?:\/\/\S+/g,' ').replace(STOP_CONTEXT,' ');
}
function hit(text,word) {
  if (word.length<2 && !/^[A-Za-z]{2}$/.test(word)) return 0;
  if (/^[A-Za-z0-9]+$/.test(word)) { const m=text.match(new RegExp(`(?<![A-Za-z0-9])${word}(?![A-Za-z0-9])`,'gi')); return m?m.length:0; }
  return text.split(word).length-1;
}
// title一致は概要一致の3倍の重み。上位が同点または2位との差が小さい場合は HOLD。
export function classifyText({title,description}, {minScore=3,margin=1.5}={}) {
  const t=String(title||'').replace(STOP_CONTEXT,' '),b=bodyText('',description);
  const scores=[];
  for (const th of THEMES) {
    let s=0;const ev=[];
    for (const w of [th.name,...th.synonyms,...th.subthemes.map(x=>x.name)]) {
      const a=hit(t,w),c=hit(b,w);
      if (a||c) {s+=a*3+Math.min(c,3);ev.push(w);}
    }
    if (s) scores.push({id:th.id,score:s,evidence:[...new Set(ev)]});
  }
  scores.sort((x,y)=>y.score-x.score);
  if (!scores.length||scores[0].score<minScore) return {decision:'HOLD',reason:'evidence_insufficient',candidates:scores.slice(0,3)};
  if (scores[1]&&scores[0].score<scores[1].score*margin) return {decision:'HOLD',reason:'ambiguous',candidates:scores.slice(0,3)};
  return {decision:'TAG',themeId:scores[0].id,evidence:scores[0].evidence,candidates:scores.slice(0,3)};
}
// 人間承認はロック。自動判定は locked な値を返さない/上書きしない。
export function applyClassification(existing,auto) {
  if (existing&&existing.locked) return existing;
  return {...(existing||{}),...auto,locked:false,status:'provisional_auto'};
}
