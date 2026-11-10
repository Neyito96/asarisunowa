#!/usr/bin/env node
// 「ニュースの学校」MC例外の発見を助ける候補一覧(READ_ONLY)。固定MC(番組レベル)を一律補完するためではなく、例外回を探す手がかり。
// 入力: プレビュー詳細JSON群。出力: 件数JSON(コミット可)と、エピソードID+理由のCSV(非コミット・管理人確認用)。氏名の自動補完は一切しない。
// 使い方: node scripts/build-news-school-mc-candidates.mjs DETAILS_DIR COUNTS.json [PRIVATE_CANDIDATES.csv] [SHOW=ニュースの学校]
import fs from 'node:fs';import path from 'node:path';
const [,, dir,outJson,outCsv,show='ニュースの学校']=process.argv;
const det=[];for(const f of fs.readdirSync(dir))det.push(...JSON.parse(fs.readFileSync(path.join(dir,f))));
const eps=det.filter(e=>e.show===show).sort((a,b)=>a.date<b.date?-1:1);
const PERSON=/[\p{Script=Han}\p{Script=Katakana}]{2,8}(?:さん|氏|教授|記者|アナウンサー|委員|先生|ゲスト)/gu;
const NOT=/^(?:リスナー|みな|皆|読者|視聴者|お客|お母|お父|生徒|子ども|ママ|パパ)/;
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const durs=eps.map(e=>Number(e.duration)).filter(x=>x>0),m=med(durs),mad=med(durs.map(x=>Math.abs(x-m)))||1;
const GUEST=/ゲスト|対談|インタビュー|特別編|スペシャル|生放送|公開収録|イベント/;
const rows=[],cnt={episodes:eps.length,withOfficialMcMention:0,PERSON_MENTION_IN_DESCRIPTION:0,GUEST_OR_SPECIAL_WORDS:0,DURATION_OUTLIER:0,flaggedAny:0};
for(const e of eps){const why=[];const d=String(e.description||'');
  if(/(?:MC|ＭＣ|司会|ナビゲーター)(?![\p{Script=Latin}])/u.test(d.replace(/日銀|FRB|[A-Z]{2,}\）?/g,'')))cnt.withOfficialMcMention++;
  const names=(d.match(PERSON)||[]).filter(x=>!NOT.test(x));if(names.length){why.push('PERSON_MENTION_IN_DESCRIPTION');cnt.PERSON_MENTION_IN_DESCRIPTION++;}
  if(GUEST.test(e.title+d)){why.push('GUEST_OR_SPECIAL_WORDS');cnt.GUEST_OR_SPECIAL_WORDS++;}
  const du=Number(e.duration);if(du>0&&Math.abs(du-m)/(1.4826*mad)>3){why.push('DURATION_OUTLIER');cnt.DURATION_OUTLIER++;}
  if(why.length){cnt.flaggedAny++;rows.push([e.id,e.date.slice(0,10),why.join('+'),names.slice(0,3).join('/')]);}}
const out={show,...cnt,medianDurationSec:m,note:'氏名・MCは補完しない。公式概要にMCの記載がある回は上記件数のみ。候補は「例外回を探す手がかり」であり例外の断定ではない。',
  official:{fixedHostConfirmedByOfficialSource:false,status:'ADMIN_STATEMENT_UNVERIFIED',autoFill:'NONE'}};
console.log(JSON.stringify(out,null,1));fs.writeFileSync(outJson,JSON.stringify(out,null,1));
if(outCsv)fs.writeFileSync(outCsv,'台帳ID,配信日,理由,概要中の人物語(先頭3)\n'+rows.map(r=>r.join(',')).join('\n')+'\n');
