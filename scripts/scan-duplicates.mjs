#!/usr/bin/env node
// READ_ONLY: 非公開プレビュー(+任意の追加レコードJSON)から二重収蔵の候補を列挙する。何も変更しない。
// 使い方: node scripts/scan-duplicates.mjs PREVIEW_DIR [EXTRA_RECORDS.json] [REPORT.json]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {findDuplicateCandidates} from '../public/library/duplicate-detect.mjs';
const [,,dir,extra,out]=process.argv;const recs=[];for(const f of await readdir(join(dir,'details')))recs.push(...JSON.parse(await readFile(join(dir,'details',f),'utf8')));
const base=recs.map(e=>({id:e.id,show:e.show,title:e.title,date:e.date,links:e.links,audio:e.audio,hasRawDesc:!!e.description,hasCleanDesc:e.descriptionSource==='clean',decision:'対象'}));
const add=extra?JSON.parse(await readFile(extra,'utf8')).records:[];
const byId=new Map(base.map(x=>[x.id,x]));for(const x of add)byId.set(x.id,{...byId.get(x.id),...x}); // 追加レコード(司令塔報告値)が同一IDを上書き
const all=[...byId.values()];const r=findDuplicateCandidates(all,{decisions:{'EP-06591':'保留'}});const rep={scanned:all.length,counts:r.counts,pairs:r.pairs.map(p=>({a:p.a,b:p.b,show:p.show,verdict:p.verdict,reasons:p.reasons,canonical:p.canonical,duplicateHold:p.duplicateHold,ev:{spotify:p.evidence.spotifyEqual,guid:p.evidence.guidEqual,audio:p.evidence.audioEqual,date:p.evidence.dateEqual,titleDist:p.evidence.titleDistance}}))};
console.log(JSON.stringify({scanned:rep.scanned,counts:rep.counts,sample:rep.pairs.slice(0,12)},null,1));if(out)await writeFile(out,JSON.stringify(rep,null,1));
