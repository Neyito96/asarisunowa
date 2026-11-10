#!/usr/bin/env node
// 非破壊(非公開プレビュー限定): 台帳CSV(私的・非コミット)の清掃済み概要を既存プレビューへ差分反映して OUT へ。概要以外・公開範囲は不変。
// 使い方: node scripts/resync-description-from-ledger.mjs LEDGER.csv SRC_DIR OUT_DIR
import {readFile,mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {parseCsv,COMPACT_COLS,expandCompact} from './build-universe-preview.mjs';
import {refreshDescriptionFromLedger} from '../public/library/description-sync.mjs';
import {loadDetails} from './resync-cast-from-oracle.mjs';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
export async function resyncDescription(csv,src,dest){
  const parsed=parseCsv(await readFile(csv,'utf8')),rows=new Map(parsed.slice(1).filter(r=>/^EP-\d{5}$/.test(r[0])).map(r=>[r[0],parsed[0].length===COMPACT_COLS.length?expandCompact(r):r]));
  const ex=await loadDetails(src),scope=JSON.parse(await readFile(join(src,'scope.json'),'utf8')),man=JSON.parse(await readFile(join(src,'manifest.json'),'utf8'));
  const r=refreshDescriptionFromLedger(ex,rows);await mkdir(dest,{recursive:true});
  await writePublicLibrarySnapshot({episodes:r.episodes,counts:man.counts,publicationScope:scope,snapshotDate:man.snapshotDate,destination:dest});
  const mp=join(dest,'manifest.json'),nm=JSON.parse(await readFile(mp,'utf8'));if(man.preview)nm.preview=man.preview;await writeFile(mp,JSON.stringify(nm)+'\n');
  const by={};for(const c of r.changes)by[c.kind]=(by[c.kind]||0)+1;return {total:ex.length,changed:r.changes.length,byKind:by,keptBlank:r.keptBlank,ledgerRows:rows.size};
}
if(process.argv[1]&&process.argv[1].endsWith('resync-description-from-ledger.mjs')){const [,,c,s,o]=process.argv;console.log(JSON.stringify(await resyncDescription(c,s,o)));}
