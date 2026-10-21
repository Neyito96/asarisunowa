// READ_ONLY preview. No Google/Spotify writes and no EP-ID allocation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {editDescription,DESCRIPTION_VERSION} from '../public/library/description-editor.mjs';
import {plainDescription,blocked} from '../lib/library-public.mjs';
const [privateDir,out='docs/audits/2026-10-21-phase11']=process.argv.slice(2);
if(!privateDir)throw Error('Private source directory required');
const read=async f=>JSON.parse(await readFile(privateDir+'/'+f,'utf8'));
const source=await read('source.json'),rss=await read('rss-items.json'),feed=await read('rss-source.json');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const normal=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const timestamp=s=>new Date(Date.parse(s)+9*3600000).toISOString().slice(0,16).replace('T',' ');
const exclusions=new Set((source.exclusions||[]).slice(1).flatMap(r=>[r[0],r[1]]).filter(Boolean));
const rows=source.rows.filter(r=>/^EP-\d{5}$/.test(r[0])&&+r[0].slice(3)>=1443&&+r[0].slice(3)<=1984);
if(rows.length!==542||rows.some(r=>r[1]!=='ニュースの現場から')||new Set(rows.map(r=>r[0])).size!==542)throw Error('Target ID/show mismatch');
const evidencePath=privateDir+'/link-evidence.json';let links={};try{links=JSON.parse(await readFile(evidencePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const plan={mode:'READ_ONLY',range:'EP-01443..EP-01984',sourceDigest:digest(source),rssDigest:digest(rss),feed,patches:[],holds:[],records:[]};
const preview=structuredClone(source);preview.descriptionEdits={};
const archivePlan=JSON.parse(await readFile('docs/audits/2026-10-21-phase9/integration-plan.json','utf8'));
preview.officialArchive={};preview.archivePending=archivePlan.archivePending;preview.invalidUrls=archivePlan.invalidUrls;
for(const r of archivePlan.records.filter(r=>r.status==='MATCHED')){
 if(source.rows.find(x=>x[0]===r.id)?.[9]!==r.metadata.officialUrl)throw Error('Phase 9 provenance changed');
 preview.officialArchive[r.id]=r.metadata;
}
for(const r of rows){
 const row=source.rows.findIndex(x=>x[0]===r[0])+2,guard={id:r[0],guid:r[6],show:r[1],date:r[3],audio:r[14]},reasons=[];
 if(blocked(r[38])||exclusions.has(r[0])||exclusions.has(r[6]))reasons.push('HUMAN_EXCLUDED');
 const anchors=new Set([r[6],...String([r[8],r[9]]).matchAll(/[a-f0-9]{8}-[a-f0-9-]{27}/gi)].filter(Boolean).map(x=>typeof x==='string'?x.toLowerCase():x[0].toLowerCase()));
 const matched=rss.filter(it=>anchors.has(it.guid.toLowerCase()));let it=matched.length===1?matched[0]:null;
 let method='EXISTING_RAW';
 if(!r[21]){
  if(!it||timestamp(it.pubDate)!==String(r[3]).slice(0,16))reasons.push('RSS_ID_OR_DATE_CONFLICT');
  else if(normal(it.title)!==normal(r[2])){
   // Observed official re-label of 13 sumo records; no other title edits accepted.
   if(/^（相撲）/.test(it.title)&&normal(it.title.replace(/^（相撲）/,''))===normal(r[2]))method='GUID_DATE_EXACT_TITLE_WITH_OFFICIAL_SUMO_PREFIX';
   else reasons.push('RSS_TITLE_CONFLICT');
  } else method='GUID_TITLE_DATE_EXACT';
 }
 const raw=String(r[21]||it?.description||'');
 if(r[22]&&plainDescription(r[21]).replace(/\s/g,'')!==String(r[22]).replace(/\s/g,''))reasons.push('EXISTING_NON_MECHANICAL_CLEAN_REVIEW');
 const edit=editDescription(raw,{relatedUrls:String(r[28]||'').split(/\s+/).filter(Boolean),linkEvidence:links});reasons.push(...edit.holds);
 const record={...guard,row,method,rawWasMissing:!r[21],rawHash:digest(raw),sourceUrl:r[21]?(r[32]||r[8]||r[9]):feed.url,fetchedAt:r[21]?null:feed.fetchedAt,snapshotAt:feed.fetchedAt,originalClean:String(r[22]||''),...edit,holds:[...new Set(reasons)]};
 plan.records.push(record);if(reasons.length){plan.holds.push({id:r[0],reasons:record.holds});continue;}
 function patch(column,after,reason){const before=r[column-1]??'';if(String(before)!==String(after))plan.patches.push({id:r[0],row,column,before,after,reason,guard});}
 if(!r[21])patch(22,raw,'VERIFIED_OFFICIAL_RSS_EMPTY_RAW_FILL');
 patch(23,edit.description,'PUBLIC_SECTIONS_KEEP_CONTENT');
 patch(29,edit.relatedArticles.map(a=>a.originalUrl).join(' '),'STRUCTURED_LINKS_KEEP_ORIGINAL_URLS');
 patch(38,DESCRIPTION_VERSION,'VERSIONED_PUBLIC_CLEANING');
 const target=preview.rows[row-2];for(const p of plan.patches.filter(p=>p.id===r[0]))target[p.column-1]=p.after;
 preview.descriptionEdits[r[0]]={...edit,sourceUrl:record.sourceUrl,fetchedAt:record.fetchedAt,snapshotAt:feed.fetchedAt,rawHash:record.rawHash};
}
plan.counts={ids:rows.length,rawMissing:rows.filter(r=>!r[21]).length,cleanMissing:rows.filter(r=>!r[22]).length,existingContactResidue:rows.filter(r=>/@asahi\.com|forms\.gle/.test(r[22]||'')).length,existingRelatedMixed:rows.filter(r=>/【関連記事】/.test(r[22]||'')).length,held:plan.holds.length,ready:rows.length-plan.holds.length,rawFills:plan.patches.filter(p=>p.column===22).length,updateEpisodes:new Set(plan.patches.map(p=>p.id)).size,updateCells:plan.patches.length,relatedArticles:plan.records.reduce((n,r)=>n+r.relatedArticles.length,0)};
plan.planHash=digest({sourceDigest:plan.sourceDigest,rssDigest:plan.rssDigest,patches:plan.patches,records:plan.records});
await mkdir(out,{recursive:true});await writeFile(out+'/description-plan.json',JSON.stringify(plan,null,2)+'\n');
await writeFile(out+'/summary.json',JSON.stringify({mode:plan.mode,planHash:plan.planHash,counts:plan.counts,holds:plan.holds,productionWrites:0},null,2)+'\n');
await writeFile(privateDir+'/preview-source.json',JSON.stringify(preview));
const representative=[...new Set([rows[0][0],...plan.records.filter(r=>r.rawWasMissing).slice(0,3).map(r=>r.id),...plan.records.filter(r=>r.removed.some(x=>x.reason==='EXPLICIT_PROMOTION')).slice(0,5).map(r=>r.id),...Array.from({length:20},(_,i)=>rows[Math.round(i*(rows.length-1)/19)][0])])].slice(0,20);
const comparisons=representative.map(id=>{const r=plan.records.find(r=>r.id===id),raw=source.rows.find(x=>x[0]===id)[21];return {id,title:source.rows.find(x=>x[0]===id)[2],before:raw||'',...r};});
await writeFile(out+'/representative-20.json',JSON.stringify(comparisons,null,2)+'\n');
await writeFile(out+'/representative-20.md',comparisons.map(r=>`## ${r.id} ${r.title}\n\n元の公開概要: ${r.originalClean||'（欠損）'}\n\n清掃後: ${r.description}\n\n関連記事: ${r.relatedArticles.map(a=>a.title+' '+a.url).join(' / ')}\n\n除外理由: ${[...new Set(r.removed.map(x=>x.reason))].join(', ')} / 保留: ${r.holds.join(', ')||'なし'}\n`).join('\n'));
console.log(JSON.stringify({planHash:plan.planHash,counts:plan.counts,holds:plan.holds.slice(0,20)},null,2));
