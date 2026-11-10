#!/usr/bin/env node
// 新着(暫定)の掲載判断用レビュー候補を生成する。出力は原本由来のため**コミットしない**(--out は git 管理外へ)。
// 使い方: node scripts/build-review-candidates.mjs LEDGER.csv PREVIEW_DETAILS_DIR REPORT.json OUT_DIR
// 判断列(管理人記入)は空欄。自動で「掲載承認済み」にはしない。
import fs from 'node:fs';import path from 'node:path';
import {parseCsv,expandCompact} from './build-universe-preview.mjs';
import {classifyText} from '../public/library/taxonomy.mjs';
import {classifyPlaces} from '../public/library/geo-evidence.mjs';
const [,, ledgerPath, detailsDir, reportPath, outDir]=process.argv;
const rows=parseCsv(fs.readFileSync(ledgerPath,'utf8')).slice(1).map(expandCompact);
const led=new Map(rows.map(r=>[r[0],r]));
const det=new Map();for(const f of fs.readdirSync(detailsDir)) for(const e of JSON.parse(fs.readFileSync(path.join(detailsDir,f)))) det.set(e.id,e);
const rep=JSON.parse(fs.readFileSync(reportPath));
const q=s=>`"${String(s??'').replace(/"/g,'""')}"`;
const FOOT=/会員登録をお願い|朝ポキ情報|番組継続|omnystudio\.com/;
function spotifyCause(r){ // 欠落原因の分類(欠落時のみ)
  if(r[11]) return '';
  const day=(r[3]||'').slice(0,10).replace(/\//g,'-').replace(/-(\d)(?!\d)/g,'-0$1');
  const recent=day>='2026-11-06';
  if(recent) return 'A:登録遅延の疑い(2026-11-05までは新着100%登録済み・11-06以降のみ欠落。音声URLあり=配信自体は存在)';
  return 'B:個別欠落(同番組は過去36/38件登録済み。LISTEN有・音声URL無し。Spotify未配信か転記漏れかは未確認)';
}
const out=[['EP-ID','番組','配信日時','タイトル','出演者','Spotify','Spotify欠落原因','規則判定','公式概要の定型文残り','テーマ候補(提案・未承認)','地図候補(PIN/TAG/HOLD)','管理人判断(掲載/保留/除外)'].map(q).join(',')];
let nSp=0;const cause={};
for(const id of rep.provisionalIds){
  const r=led.get(id),e=det.get(id)||{};
  const th=classifyText(e),pl=classifyPlaces(e).map(x=>`${x.decision}:${x.place}`).join(' ');
  const c=spotifyCause(r);if(!r[11])cause[c[0]]=(cause[c[0]]||0)+1;else nSp++;
  out.push([id,r[1],r[3],r[2],e.cast||'',r[11]?'有':'無',c,'暫定対象(PROVISIONAL_RULE)',FOOT.test(e.description||'')?'あり':'なし',th.decision==='TAG'?th.themeId:'HOLD('+th.reason+')',pl,''].map(q).join(','));
}
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'review-candidates-97.csv'),'﻿'+out.join('\n'));
// 保留3件(同一番組+同題)の強ID照合表。重複とは断定しない。
const hold=['EP-06595','EP-06596','EP-06597'],pairs=[];
for(const id of hold){const r=led.get(id),guid=r[6],omny=r[9];
  const m=[...det.values()].find(e=>e.id!==id&&e.show===r[1]&&(e.links||[]).some(l=>guid&&l.includes(guid)));
  pairs.push({held:id,guid,heldDate:r[3],heldDurationSec:r[15],heldOmnyUrl:omny,existing:m?.id,existingDate:m?.date,existingDurationSec:m?.duration,existingOmnyUrl:(m?.links||[]).find(l=>l.startsWith('https://omny.fm/')),
    guidMatch:!!m,dateMatch:!!m&&m.date.slice(0,16).replace('T',' ').replace(/-/g,'/')===String(r[3]).replace(/^(\d{4}\/\d\d\/\d\d) (\d):/,'$1 0$2:'),durationMatch:!!m&&String(m.duration)===String(r[15]),omnyUrlMatch:!!m&&(m.links||[]).includes(omny)});}
fs.writeFileSync(path.join(outDir,'held3-evidence.json'),JSON.stringify(pairs,null,1));
console.log(JSON.stringify({candidates:rep.provisionalIds.length,spotifyOk:nSp,spotifyMissingByCause:cause,held:pairs}));
