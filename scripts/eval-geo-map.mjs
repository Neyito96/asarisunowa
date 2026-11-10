#!/usr/bin/env node
// 使い方: node scripts/eval-geo-map.mjs DETAILS_DIR [out.json] [--samples]
// Before = test1024-map の旧規則(地名の正規表現がタイトル+概要先頭1400字のどこかに一致したらピン)
// After  = classifyPlaces の PIN のみ(TAG/HOLDはピンにしない)
import fs from 'node:fs';import path from 'node:path';
import {PLACES,classifyPlaces} from '../public/library/geo-evidence.mjs';
const dir=process.argv[2];const eps=[];
for(const f of fs.readdirSync(dir)) if(f.endsWith('.json')) eps.push(...JSON.parse(fs.readFileSync(path.join(dir,f))));
const OLD={日本:'日本|国内|日本列島',アメリカ:'アメリカ|米国|米政府|ワシントン',中国:'中国|北京|上海',韓国:'韓国|ソウル',台湾:'台湾|台北',ロシア:'ロシア|モスクワ',ウクライナ:'ウクライナ|キーウ',イスラエル:'イスラエル','パレスチナ・ガザ':'パレスチナ|ガザ',キューバ:'キューバ|ハバナ',ブラジル:'ブラジル',イギリス:'イギリス|英国|ロンドン',フランス:'フランス|パリ',ドイツ:'ドイツ|ベルリン',インド:'インド|ニューデリー',イラン:'イラン|テヘラン',北朝鮮:'北朝鮮|平壌',タイ:'タイ|バンコク',ベトナム:'ベトナム',オーストラリア:'オーストラリア',北海道:'北海道|札幌',青森:'青森',宮城:'宮城|仙台',東京:'東京|都内|新宿|渋谷',神奈川:'神奈川|横浜|川崎',長野:'長野|松本|諏訪|上伊那',新潟:'新潟',石川:'石川|金沢|能登',静岡:'静岡',愛知:'愛知|名古屋',京都:'京都',大阪:'大阪',兵庫:'兵庫|神戸',広島:'広島',福岡:'福岡|北九州',沖縄:'沖縄|那覇'};
const oldRe=Object.fromEntries(Object.entries(OLD).map(([k,v])=>[k,new RegExp(v)]));
const before={},after={},tags={},holds={},removed=[],kept=[],added=[];
let beforePins=0,afterPins=0,epsBefore=0,epsAfter=0;
for(const e of eps){
  const text=String(e.title||'')+' '+String(e.description||'').slice(0,1400);
  const b=Object.keys(oldRe).filter(k=>oldRe[k].test(text));
  const cls=classifyPlaces(e),a=cls.filter(x=>x.decision==='PIN').map(x=>x.place);
  for(const x of cls){if(x.decision==='TAG')tags[x.place]=(tags[x.place]||0)+1;if(x.decision==='HOLD')holds[x.place]=(holds[x.place]||0)+1;}
  b.forEach(k=>before[k]=(before[k]||0)+1);a.forEach(k=>after[k]=(after[k]||0)+1);
  beforePins+=b.length;afterPins+=a.length;if(b.length)epsBefore++;if(a.length)epsAfter++;
  for(const k of b) if(!a.includes(k)) removed.push({id:e.id,place:k,title:e.title,reason:cls.find(x=>x.place===k)?.reason||'NO_EVIDENCE_PATTERN'});
  for(const k of a) (b.includes(k)?kept:added).push({id:e.id,place:k,title:e.title,reason:cls.find(x=>x.place===k).reason});
}
const res={episodes:eps.length,before:{pins:beforePins,episodesWithPin:epsBefore},after:{pins:afterPins,episodesWithPin:epsAfter,tag:Object.values(tags).reduce((a,b)=>a+b,0),hold:Object.values(holds).reduce((a,b)=>a+b,0)},
  removedPins:removed.length,keptPins:kept.length,newPins:added.length,perPlace:Object.fromEntries(Object.keys(OLD).map(k=>[k,{before:before[k]||0,after:after[k]||0}])),
  removedByReason:removed.reduce((m,x)=>(m[x.reason]=(m[x.reason]||0)+1,m),{})};
console.log(JSON.stringify(res,null,1));
if(process.argv[3]&&!process.argv[3].startsWith('--'))fs.writeFileSync(process.argv[3],JSON.stringify(res,null,1));
if(process.argv.includes('--samples')){const pick=(a,n)=>a.filter((_,i)=>i%Math.max(1,Math.floor(a.length/n))===0).slice(0,n);
  fs.writeFileSync('/tmp/geo-samples.json',JSON.stringify({removed:pick(removed,40),kept:pick(kept,40),added:pick(added,20)},null,1));}
