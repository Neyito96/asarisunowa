#!/usr/bin/env node
// 使い方: node scripts/eval-taxonomy.mjs DETAILS_DIR [out.json]
// Before = 現行相当の素朴検索（主テーマ名の部分一致を title+概要(定型文込み)全体に実施）
// After  = taxonomy.mjs（同義語・定型文除去・タイトル加重・曖昧はHOLD）
import fs from 'node:fs';import path from 'node:path';
import {THEMES,themeIdsForLabel,classifyText} from '../public/library/taxonomy.mjs';
const dir=process.argv[2];const labels=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/taxonomy-labels.json',import.meta.url))).records;
const eps=new Map();for(const f of fs.readdirSync(dir)) if(f.endsWith('.json')) for(const e of JSON.parse(fs.readFileSync(path.join(dir,f)))) eps.set(e.id,e);
const ev=[];let unmapped=0,missing=0;
for(const l of labels){const ids=themeIdsForLabel(l.label);if(!ids.length){unmapped++;continue;}const e=eps.get(l.id);if(!e){missing++;continue;}ev.push({...l,gold:ids,e});}
function score(pred){let tp=0,fp=0,fn=0,hold=0,top1=0;for(const x of ev){const p=pred(x.e);if(!p.length){hold++;fn+=1;continue;}const ok=p.some(i=>x.gold.includes(i));if(ok){tp++;}else{fp++;fn++;}}
  const n=ev.length;return {n,correct:tp,wrong:fp,held:hold,precision:+(tp/(tp+fp||1)).toFixed(3),coverage:+((tp+fp)/n).toFixed(3),recall:+(tp/n).toFixed(3)};}
const before=score(e=>{const t=(e.title||'')+' '+(e.description||'');return THEMES.filter(th=>t.includes(th.name)).map(th=>th.id);});
const after=score(e=>{const r=classifyText(e);return r.decision==='TAG'?[r.themeId]:[];});
const byOrigin={};for(const o of ['human_approved','legacy_assistant_reviewed','assistant_reviewed']){const sub=ev.filter(x=>x.origin===o);if(!sub.length)continue;let c=0,w=0,h=0;for(const x of sub){const r=classifyText(x.e);if(r.decision!=='TAG')h++;else if(x.gold.includes(r.themeId))c++;else w++;}byOrigin[o]={n:sub.length,correct:c,wrong:w,held:h};}
const res={evaluated:ev.length,unmappedLabels:unmapped,missingInLibrary:missing,before,after,afterByOrigin:byOrigin,note:'正解=旧ラベル(人間承認/復旧/AI)を20主テーマへ別名対応したもの。AI由来ラベルは人間承認ではない'};
console.log(JSON.stringify(res,null,1));if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(res,null,1));
