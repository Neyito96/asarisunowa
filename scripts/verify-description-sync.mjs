#!/usr/bin/env node
// READ_ONLY: 台帳(圧縮22列CSV or 55列CSV。私的・非コミット)の概要(V/W)と、非公開プレビューの詳細/検索索引を突き合わせる。公開対象(scope.publishedIds)のみ判定。
// 使い方: node scripts/verify-description-sync.mjs LEDGER.csv PREVIEW_DIR [REPORT.json]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {parseCsv,COMPACT_COLS,expandCompact} from './build-universe-preview.mjs';
import {verifyDescriptions} from '../public/library/description-sync.mjs';
const [,,csv,dir,out]=process.argv;if(!csv||!dir)throw Error('Usage: node scripts/verify-description-sync.mjs LEDGER.csv PREVIEW_DIR [REPORT.json]');
const load=async(sub)=>{const o=[];for(const f of await readdir(join(dir,sub)))o.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return o;};
const parsed=parseCsv(await readFile(csv,'utf8')),rows=new Map(parsed.slice(1).filter(r=>/^EP-\d{5}$/.test(r[0])).map(r=>[r[0],parsed[0].length===COMPACT_COLS.length?expandCompact(r):r]));
const scope=JSON.parse(await readFile(join(dir,'scope.json'),'utf8'));
const rep=verifyDescriptions(rows,{details:await load('details'),search:(await load('search'))},{ids:scope.publishedIds});
rep.ledgerRows=rows.size;console.log(JSON.stringify({...rep,cleanNotReflected:rep.cleanNotReflected.slice(0,5),mismatchDetailVsSearch:rep.mismatchDetailVsSearch.slice(0,5)},null,1));if(out)await writeFile(out,JSON.stringify(rep,null,1));
