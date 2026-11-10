#!/usr/bin/env node
// 実台帳から司令塔が作った最小CSV(EP-ID/番組名/出演者1/情報区分/日付)を「期待値(oracle)」として、非公開プレビューの出演者を検証する(READ_ONLY)。
// 期待値はCSVの各行から導出し、492/8のような固定値は持たない。対象は CSV に載った EP-ID のみ(なければ MISSING_IN_PREVIEW として報告)。
// 使い方: node scripts/verify-cast-oracle.mjs ORACLE.csv PREVIEW_OUT_DIR [REPORT.json]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {parseCsv} from './build-universe-preview.mjs';
import {castNames,verifyCastConsistency} from '../public/library/cast-sync.mjs';
import {filterEpisodes} from '../lib/library-public.mjs';
export function readOracle(text){
  const [h,...rows]=parseCsv(text).filter(r=>r.length>1);const ix=n=>h.findIndex(c=>c.replace(/^﻿/,'').trim()===n);
  const col={id:ix('EP-ID')>=0?ix('EP-ID'):ix('台帳ID'),show:ix('番組名'),cast:ix('出演者1')>=0?ix('出演者1'):ix('出演者')};
  if(col.id<0||col.show<0||col.cast<0)throw Error('ORACLE_COLUMNS_MISSING: need EP-ID/番組名/出演者1 (got '+h.join('|')+')');
  return rows.filter(r=>/^EP-\d{5,}$/.test(r[col.id])).map(r=>({id:r[col.id],show:r[col.show],names:castNames(r[col.cast])}));
}
/** opts.publishedIds: 公開対象のEP-ID集合(scope.publishedIds=人間の公開判定)。指定時は 台帳全件/公開対象/非公開(重複保留 opts.duplicateHoldIds・その他) に分けて判定。
 * 合格条件は「公開対象」の出演者一致・3系統一致・検索件数一致。非公開行はプレビューに居ても居なくても合否に含めない(公開判定は人間の領分)。件数は固定値でなくCSV+公開判定から算出。 */
export function compareToPreview(oracle,{details,pages,search},opts={}){
  const pub=opts.publishedIds?new Set(opts.publishedIds):null,dupHold=new Set(opts.duplicateHoldIds||[]);
  const by=new Map(details.map(e=>[e.id,e])),missing=[],wrong=[],perPerson={},perPersonAll={},nonPublic={duplicateHold:[],other:[]};
  for(const o of oracle){for(const n of o.names)perPersonAll[n]=(perPersonAll[n]||0)+1;
    if(pub&&!pub.has(o.id)){(dupHold.has(o.id)?nonPublic.duplicateHold:nonPublic.other).push({id:o.id,names:o.names,inPreview:by.has(o.id)});continue;}
    const e=by.get(o.id);if(!e){missing.push(o.id);continue;}
    const got=castNames(e.cast);if(got.length!==o.names.length||got.some((n,i)=>n!==o.names[i]))wrong.push({id:o.id,expected:o.names,got});
    for(const n of o.names)perPerson[n]=(perPerson[n]||0)+1;}
  const cons=verifyCastConsistency({details,pages,search}),shows=[...new Set(oracle.map(o=>o.show))];
  const searchHits=Object.fromEntries(Object.keys(perPerson).map(n=>[n,shows.reduce((s,sh)=>s+filterEpisodes(search,{query:n,show:sh}).length,0)]));
  const publicRows=oracle.length-nonPublic.duplicateHold.length-nonPublic.other.length;
  return {oracleRows:oracle.length,ledgerAll:{rows:oracle.length,perPerson:perPersonAll},public:{rows:publicRows,perPerson},nonPublic,missingInPreview:missing,wrong,expectedPerPerson:perPerson,searchHits,searchMatchesExpected:Object.keys(perPerson).every(n=>perPerson[n]===searchHits[n]),consistency:{episodes:cons.episodes,mismatches:cons.mismatches.length},pass:!missing.length&&!wrong.length&&!cons.mismatches.length&&Object.keys(perPerson).every(n=>perPerson[n]===searchHits[n])};
}
if(process.argv[1]&&process.argv[1].endsWith('verify-cast-oracle.mjs')){
  const [,, oracleCsv,dir,outPath]=process.argv;if(!oracleCsv||!dir)throw Error('Usage: node scripts/verify-cast-oracle.mjs ORACLE.csv PREVIEW_OUT_DIR [REPORT.json] [DUPLICATE_HOLD_IDS.json]');
  const load=async(sub,pick=()=>true)=>{const out=[];for(const f of await readdir(join(dir,sub)))if(pick(f))out.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return out;};
  const rep=compareToPreview(readOracle(await readFile(oracleCsv,'utf8')),{details:await load('details'),pages:await load('pages',f=>f.startsWith('show-')),search:await load('search')},{publishedIds:JSON.parse(await readFile(join(dir,'scope.json'),'utf8')).publishedIds,duplicateHoldIds:process.argv[5]?JSON.parse(await readFile(process.argv[5],'utf8')):[]});
  console.log(JSON.stringify(rep,null,1));if(outPath)await writeFile(outPath,JSON.stringify(rep,null,1));
}
