#!/usr/bin/env node
// 非公開プレビュー出力(OUT_DIR)の出演者を検証する(READ_ONLY)。詳細・番組別一覧・検索索引の整合と、番組内の出演者別件数(実データから集計)を表示。
// 使い方: node scripts/verify-universe-cast.mjs OUT_DIR "番組名" [COUNTS.json]
import {readFile,readdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {verifyCastConsistency,castCountsForShow} from '../public/library/cast-sync.mjs';
import {filterEpisodes} from '../lib/library-public.mjs';
const [,, dir,show,outPath]=process.argv;if(!dir||!show)throw Error('Usage: node scripts/verify-universe-cast.mjs OUT_DIR SHOW [COUNTS.json]');
const load=async(sub,pick=()=>true)=>{const out=[];for(const f of await readdir(join(dir,sub)))if(pick(f))out.push(...JSON.parse(await readFile(join(dir,sub,f),'utf8')));return out;};
const details=await load('details'),pages=await load('pages',f=>f.startsWith('show-')),search=await load('search');
const cons=verifyCastConsistency({details,pages,search}),counts=castCountsForShow(details,show);
const searchCounts=Object.fromEntries(Object.keys(counts).map(n=>[n,filterEpisodes(search,{query:n,show}).length]));
const out={show,episodesInShow:details.filter(e=>e.show===show).length,castCounts:counts,searchCounts,consistency:{episodes:cons.episodes,mismatches:cons.mismatches.length},searchMatchesCast:Object.keys(counts).every(n=>counts[n]===searchCounts[n])};
console.log(JSON.stringify(out,null,1));if(outPath)await writeFile(outPath,JSON.stringify(out,null,1));
