import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {compare,showAliases} from '../tools/onsa/reconcile.mjs';
const [externalPath,ledgerPath,outputPath,provenancePath]=process.argv.slice(2);
if(!externalPath||!ledgerPath||!outputPath||!provenancePath)throw Error('Usage: PRIVATE_ONSA.json PRIVATE_LEDGER.json AUDIT_DIR PRIVATE_PROVENANCE.json');
for(const input of [externalPath,ledgerPath,provenancePath])if(path.resolve(input).startsWith(path.resolve(outputPath)+path.sep))throw Error('Audit output must not contain input files');
const external=JSON.parse(fs.readFileSync(externalPath)),ledger=JSON.parse(fs.readFileSync(ledgerPath));
const result=compare(external,ledger);
fs.mkdirSync(outputPath,{recursive:true});
const csv=(name,columns,rows)=>{
 const value=v=>{const s=Array.isArray(v)||v&&typeof v==='object'?JSON.stringify(v):v==null?'':String(v);return '"'+s.replaceAll('"','""')+'"';};
 const body=[columns.map(value).join(','),...rows.map(x=>columns.map(k=>value(x[k])).join(','))].join('\n')+'\n';
 fs.writeFileSync(path.join(outputPath,name),name.endsWith('.gz')?gzipSync(body,{level:9,mtime:0}):body);
};
const count=(a,key)=>a.reduce((m,x)=>(m[x[key]]=(m[x[key]]||0)+1,m),{});
const sourceGroups=records=>{
 const groups=new Map();for(const x of records){const group=groups.get(x.sourceUrl)||[];group.push({sheet:x.sheet,row:x.row,title:x.title,date:x.publishedAt});groups.set(x.sourceUrl,group);}
 return [...groups].filter(([url,rows])=>url&&rows.length>1).map(([url,rows])=>({url,rows,rowCount:rows.length,shows:[...new Set(rows.map(x=>x.sheet))]}));
};
const duplicates=sourceGroups(external.episodes);
const podcast=external.episodes.filter(x=>x.sheet!=='YouTube'),video=external.episodes.filter(x=>x.sheet==='YouTube');
const ledgerById=new Map(ledger.rows.map(r=>[r[0],r]));
const conflicts=new Map();
for(const x of result.matches.filter(x=>x.reason==='IDENTITY_CONFLICT_OR_MULTIPLE')){
 const key=[...x.candidateIds].sort().join('|'),v=conflicts.get(key)||{epIds:[...x.candidateIds].sort(),sourceRows:[],reason:'SHARED_REFERENCE_MULTIPLE_EP_IDS_NO_MERGE',primaryUrlRelation:new Set(x.candidateIds.map(id=>ledgerById.get(id)[8]||'')).size===1?'SAME_PRIMARY_URL':'DIFFERENT_OR_MISSING_PRIMARY_URL',targetEvidence:x.candidateIds.map(id=>{const r=ledgerById.get(id);return {id,show:r[1],title:r[2],date:r[3],externalId:r[6],sourceUrl:r[8]};})};v.sourceRows.push({sheet:x.sheet,row:x.sourceRow});conflicts.set(key,v);
}
const table=external.sheets.filter(x=>x.role==='episode').map(x=>{
 const isSdgs=x.sheet==='SDGs';const shows=isSdgs?['SDGsを話そう','こどもそうだんしつ']:[showAliases[x.sheet]||x.sheet];
 const libraryRows=ledger.rows.filter(r=>shows.includes(r[1])).length;
 const matched=result.matches.filter(r=>r.sheet===x.sheet);
 const dates=external.episodes.filter(r=>r.sheet===x.sheet).map(r=>r.publishedAt).filter(Boolean).sort();
 return {sheet:x.sheet,copyDataRows:x.records,libraryShows:shows.join(' + '),libraryRows,rawRowDelta:x.records-libraryRows,matchedRows:matched.filter(r=>r.status==='MATCH').length,heldRows:matched.filter(r=>r.status==='HOLD').length,firstDate:dates[0],lastDate:dates.at(-1),definition:'Raw rows, not finalized unique episode population'};
});
const summary={mode:'READ_ONLY',generatedAt:new Date().toISOString(),sources:JSON.parse(fs.readFileSync(provenancePath)),sourceJsonHashes:{copy:createHash('sha256').update(fs.readFileSync(externalPath)).digest('hex'),ledger:createHash('sha256').update(fs.readFileSync(ledgerPath)).digest('hex')},...result.summary,
 population:{copySheets:external.sheetCount,copyAudioRows:podcast.length,copyAudioDistinctSourceUrls:new Set(podcast.map(x=>x.sourceUrl)).size,copyYoutubeRows:video.length,copyYoutubeDistinctUrls:new Set(video.map(x=>x.sourceUrl)).size,copyAudioSharedUrlGroups:duplicates.filter(x=>x.shows.every(s=>s!=='YouTube')).length,copyYoutubeDuplicateGroups:duplicates.filter(x=>x.shows.every(s=>s==='YouTube')).length,ledgerStoredRows:ledger.rows.length,ledgerAudioScopeRows:ledger.rows.filter(r=>!['アルキキ','AJW','朝ポキTV'].includes(r[1])).length,ledgerAlukikiRows:ledger.rows.filter(r=>r[1]==='アルキキ').length,ledgerAjwRows:ledger.rows.filter(r=>r[1]==='AJW').length,ledgerYoutubeRows:ledger.rows.filter(r=>r[1]==='朝ポキTV').length},
 sheets:external.sheets,programmes:table,identityConflictGroups:conflicts.size,identityConflictGroupTypes:count([...conflicts.values()],'primaryUrlRelation'),
 matchingBySheet:Object.fromEntries(external.sheets.filter(x=>x.role==='episode').map(x=>[x.sheet,count(result.matches.filter(r=>r.sheet===x.sheet),'reason')])),
 protectedFields:['EP-ID','GUID','音声URL','人間除外','原文・清掃済み概要'],writes:{sourceWorkbook:0,libraryWorkbook:0,gas:0,spotify:0,pages:0},
 caveats:['Copy sheet counts do not prove the public search tool uses exactly the same population/filter/cache.','Row delta is not an unregistered episode count; shared references and update cutoffs differ.','SDGs tab contains successor episodes: paired only with exact identity and metadata.','Title-only matches never confirmed; date precision differences are held.','Candidate links have not been HTTP checked; community copy is a secondary source.','Nonempty destination values never replaced; conflicting IDs/URLs held.','No raw comments/contributor names/descriptions, speaker directory or private source workbook published.','Shared-reference groups are review evidence, not authorization to merge/delete EP-IDs.']};
fs.writeFileSync(path.join(outputPath,'summary.json'),JSON.stringify(summary,null,2)+'\n');
csv('programme-counts.csv',Object.keys(table[0]),table);
csv('episode-matches.csv.gz',['sheet','sourceRow','sourceTitle','sourceDate','status','reason','epId','libraryShow','libraryTitle','libraryDate','candidateIds','sourceKeys','evidence','metadataTitleEqual','dateDeltaSeconds','showRelation'],result.matches);
csv('url-fill-candidates.csv',['epId','libraryShow','sheet','sourceRow','field','column','currentValue','value','identityReason','linkCheck','sourceAuthority','status','reason','sourceRows'],result.proposals);
csv('url-differences.csv',['epId','libraryShow','sheet','sourceRow','field','column','currentValue','value','identityReason','linkCheck','status','reason'],result.urlReviews.filter(x=>x.status!=='UNCHANGED'));
csv('library-unmatched-review.csv',['epId','show','title','date','status'],result.libraryOnly);
csv('source-shared-urls.csv',['url','rowCount','shows','rows'],duplicates);
csv('identity-conflict-groups.csv',['epIds','sourceRows','reason','primaryUrlRelation','targetEvidence'],[...conflicts.values()]);
csv('external-only-candidates.csv',['sheet','sourceRow','sourceTitle','sourceDate','reason','sourceKeys','evidence'],result.matches.filter(x=>x.reason==='EXTERNAL_ONLY_CANDIDATE'));
console.log(JSON.stringify({summary:result.summary,population:summary.population,conflictGroups:summary.identityConflictGroups},null,2));
