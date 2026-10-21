import { createHash } from 'node:crypto';
import { sdgsExtractItemId, sdgsOfficialUrl } from './sdgs_official_archive.mjs';
import { blocked, plainDescription } from '../lib/library-public.mjs';
export const normal = v => String(v ?? '').replace(/\\u3000/g,' ').normalize('NFKC').replace(/\s+/g,' ').trim();
export const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function localMinute(value) {
 const s=String(value || ''), m=s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
 if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')} ${String(m[4]||'00').padStart(2,'0')}:${m[5]||'00'}`;
 const time=Date.parse(s);if(!Number.isFinite(time))return '';
 return new Date(time+9*3600000).toISOString().slice(0,16).replace('T',' ');
}
function anchors(r) {
 return [...new Set([String(r[6]||'').toLowerCase(),sdgsExtractItemId(r[9]),String(r[51]||'').toLowerCase(),sdgsExtractItemId(r[52])].filter(Boolean))];
}
const legacyShow = r => ['こどもそうだんしつ','SDGsを話そう'].includes(r[1]);
const urlKey = v => {try{const u=new URL(v);return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}};
const add=(map,key,value)=>{if(key){if(!map.has(key))map.set(key,[]);map.get(key).push(value);}};
export function reconcile(tabs,official,http={},options={}) {
 const headers=tabs['エピソード台帳'][0],rows=tabs['エピソード台帳'].slice(1).filter(r=>r[0]);
 if(headers[0]!=='台帳ID'||headers[51]!=='公式JSON UUID（2026-10-20）')throw Error('Unexpected ledger headers');
 const work=tabs['SDGs1095'].slice(2).filter(r=>r[2]),raw=tabs['SDGs公式JSON_1092件原本'].slice(1).filter(r=>r[0]);
 if(official.length!==(options.expectedRecords??1092)||new Set(official.map(r=>r.id)).size!==official.length)throw Error('Expected 1092 official UUIDs');
 const byAnchor=new Map(),byWorkUuid=new Map(),byOldUrl=new Map(),byId=new Map();
 rows.forEach((r,i)=>{if(byId.has(r[0]))throw Error('Duplicate EP-ID');byId.set(r[0],i);anchors(r).forEach(k=>add(byAnchor,k,i));if(legacyShow(r))add(byOldUrl,urlKey(r[8]),i);});
 work.forEach((r,i)=>{for(const id of new Set([r[18],sdgsExtractItemId(r[21])].filter(Boolean)))add(byWorkUuid,id,{row:i+3,data:r});});
 const excluded=new Set();for(const r of tabs['削除・除外履歴'].slice(1)){if(r[0])excluded.add(r[0]);if(r[1])excluded.add(r[1]);}
 const result={schema:1,mode:'READ_ONLY',sourceRows:rows.length,officialRows:official.length,rawRows:raw.length,workRows:work.length,baseHash:hash(rows),patches:[],records:[],holds:[],newCandidates:[],workIssues:[],sourceIssues:[],counts:{},audioWrites:0,epIdChanges:0,invalidUrls:Object.values(http).filter(x=>x.status>=400).map(x=>x.url)};
 const sourceMap=new Map(raw.map(r=>[r[0],r]));
 for(const item of official){
  const uuid=item.id,officialTitle=String(item.title||'').replace(/\\u3000/g,'　').trim(),title=normal(officialTitle),date=localMinute(item.date),workMatches=byWorkUuid.get(uuid)||[],source=sourceMap.get(uuid);
  const record={uuid,title:officialTitle,date,officialUrl:sdgsOfficialUrl(uuid),embedUrl:item.onsei,sourceJsonUrl:item.sourceJsonUrl,matchMethod:'',id:null,ledgerRow:null,status:'HOLD',reasons:[]};
  if(!/^https:\/\/omny\.fm\/shows\/[^/]+\/[^/]+\/embed$/.test(item.onsei||''))record.reasons.push('INVALID_EMBED_NOT_MP3');
  if(!source||normal(source[1])!==title||localMinute(source[2])!==date||source[4]!==item.onsei)record.reasons.push('RAW_OFFICIAL_SOURCE_DIFFERENCE');
  if(workMatches.length!==1)record.reasons.push('WORK_UUID_NOT_UNIQUE');
  let matches=[...new Set(byAnchor.get(uuid)||[])];
  if(matches.length===1)record.matchMethod='OFFICIAL_UUID';
  if(!matches.length&&workMatches.length===1){const w=workMatches[0].data;matches=[...new Set(byOldUrl.get(urlKey(w[0]))||[])].filter(i=>normal(rows[i][2])===normal(w[2])&&localMinute(rows[i][3])===localMinute(w[1]));if(matches.length===1)record.matchMethod='WORK_UUID_LEGACY_OMNY_TITLE_DATETIME';}
  if(matches.length!==1){
   const near=rows.filter(r=>legacyShow(r)&&localMinute(r[3])===date&&(normal(r[2]).replace(/\s*#\d+\s*$/,'')===title.replace(/\s*#\d+\s*$/,'')||normal(r[2])===title));
   if(!matches.length&&!near.length&&workMatches.length===1&&workMatches[0].data[0]){record.status='NEW_CANDIDATE_V3_REQUIRED';result.newCandidates.push({...record,reasons:['V3_APPEND_AND_ID_RESERVATION_REQUIRED']});}
   else {record.reasons.push(matches.length?'MULTIPLE_LEDGER_MATCHES':near.length?'EXISTING_SAME_DATE_TITLE_DIFFERENT_NUMBER':'NO_STRICT_LEDGER_MATCH');record.candidateIds=near.map(r=>r[0]);result.holds.push(record);}
   result.records.push(record);continue;
  }
  const index=matches[0],row=rows[index];record.id=row[0];record.ledgerRow=index+2;
  if(!legacyShow(row))record.reasons.push('WRONG_SHOW');
  if(localMinute(row[3])!==date)record.reasons.push('PUBLICATION_DATETIME_CONFLICT');
  if(blocked(row[38])||excluded.has(uuid)||excluded.has(row[0]))record.reasons.push('HUMAN_EXCLUDED');
  if(workMatches.length===1&&localMinute(workMatches[0].data[1])!==date)record.reasons.push('WORK_PUBLICATION_CONFLICT');
  if(record.reasons.length){result.holds.push(record);result.records.push(record);continue;}
  const proof=http[record.officialUrl];
  const pageTitle=normal(proof?.title).replace(/[\"'“”‘’]/g,'"'),jsonTitle=title.replace(/[\"'“”‘’]/g,'"');
  if(!proof?.identityVerified||pageTitle.indexOf(jsonTitle)!==0||proof.embed!==item.onsei){record.reasons.push('OFFICIAL_PAGE_NOT_IDENTITY_VERIFIED');result.holds.push(record);result.records.push(record);continue;}
  record.status='MATCHED';
  function patch(column,value,reason){const before=row[column-1]??'';if(String(before)!==String(value))result.patches.push({id:row[0],row:index+2,column,before,after:value,reason,uuid});}
  patch(2,'SDGsを話そう','OFFICIAL_ARCHIVE_PLAYLIST');patch(3,officialTitle,'OFFICIAL_JSON_TITLE');
  patch(10,record.officialUrl,'HTTP_VERIFIED_OFFICIAL_ITEM');patch(17,'公式ページ確認済み','HTTP_200_TITLE_UUID_EMBED_MATCH');
  patch(52,uuid,'OFFICIAL_UUID');patch(53,record.officialUrl,'OFFICIAL_URL_PROVENANCE');patch(54,item.onsei,'EMBED_NOT_MP3');patch(55,item.sourceJsonUrl,'SOURCE_JSON_PROVENANCE');
  // Never replace original or human-cleaned descriptions with a truncated JSON teaser.
  if(!row[21]&&proof.bodyHtml)patch(22,proof.bodyHtml,'OFFICIAL_PAGE_RAW_DESCRIPTION_FILL');
  if(!row[22]&&(row[21]||proof.bodyHtml))patch(23,plainDescription(row[21]||proof.bodyHtml),'V3_MECHANICAL_CLEAN_EMPTY_ONLY');
  record.metadata={uuid,title:officialTitle,publishedAt:date,officialUrl:record.officialUrl,embedUrl:item.onsei,description:item.description||'',body:plainDescription(proof.bodyHtml||''),tags:item.grouping||[],sourceJsonUrl:item.sourceJsonUrl,checkedAt:proof.checkedAt,oldOfficialUrl:row[9]||'',oldOfficialStatus:http[row[9]]?.status??null};
  result.records.push(record);
 }
 const workOfficial=new Set(official.map(r=>r.id));
 work.forEach((r,i)=>{if(!r[18]||!workOfficial.has(r[18]))result.workIssues.push({row:i+3,title:r[2],uuid:r[18]||'',reason:r[18]?'NOT_IN_OFFICIAL_UUID_SET':'MISSING_WORK_UUID',originalUrl:r[0]||''});});
 for(const r of raw)if(!workOfficial.has(r[0]))result.sourceIssues.push({uuid:r[0],reason:'RAW_UUID_NOT_IN_LIVE_JSON'});
 result.archivePending={};
 for(const issue of result.workIssues){
   const workRow=work[issue.row-3], candidates=(byOldUrl.get(urlKey(workRow[0]))||[]).filter(i=>normal(rows[i][2])===normal(workRow[2])&&localMinute(rows[i][3])===localMinute(workRow[1]));
   if(issue.reason==='MISSING_WORK_UUID'&&candidates.length===1){const i=candidates[0],r=rows[i];
    if(!blocked(r[38])&&!excluded.has(r[0])&&!result.records.some(x=>x.status==='MATCHED'&&x.id===r[0])){
     result.archivePending[r[0]]={reason:'公式アーカイブの番号・UUIDとの対応を確認中です。旧情報を保持しています。',workRow:issue.row};
     if(r[1]!=='SDGsを話そう')result.patches.push({id:r[0],row:i+2,column:2,before:r[1],after:'SDGsを話そう',reason:'WORK_ARCHIVE_MEMBERSHIP_ONLY',uuid:''});
    }
   }
 }
 const used=new Map();for(const r of result.records.filter(r=>r.status==='MATCHED')){if(used.has(r.id))throw Error('Multiple official records mapped to one EP-ID');used.set(r.id,r.uuid);}
 result.counts={matched:result.records.filter(r=>r.status==='MATCHED').length,uuidMatched:result.records.filter(r=>r.status==='MATCHED'&&r.matchMethod==='OFFICIAL_UUID').length,legacyMatched:result.records.filter(r=>r.status==='MATCHED'&&r.matchMethod!=='OFFICIAL_UUID').length,updateEpisodes:new Set(result.patches.map(p=>p.id)).size,updateCells:result.patches.length,newCandidates:result.newCandidates.length,holds:result.holds.length,workIssues:result.workIssues.length,classificationOnly:Object.keys(result.archivePending).length,byColumn:Object.fromEntries([...new Set(result.patches.map(p=>p.column))].map(c=>[headers[c-1],result.patches.filter(p=>p.column===c).length]))};
 if(result.patches.some(p=>[1,7,15].includes(p.column)))throw Error('Protected EP-ID/GUID/audio column');
 result.sourceDigest=hash({official,http});
 result.planHash=hash({sourceDigest:result.sourceDigest,baseHash:result.baseHash,patches:result.patches,newCandidates:result.newCandidates,holds:result.holds.map(r=>({uuid:r.uuid,reasons:r.reasons}))});
 return result;
}
export function applyPlanToSnapshot(tabs,plan){
 const source={headers:tabs['エピソード台帳'][0],rows:structuredClone(tabs['エピソード台帳'].slice(1).filter(r=>r[0])),exclusions:tabs['削除・除外履歴'],snapshotDate:'2026-10-21',officialArchive:{},archivePending:plan.archivePending,invalidUrls:plan.invalidUrls};
 if(hash(source.rows)!==plan.baseHash)throw Error('Source changed since READ_ONLY plan');
 const byId=new Map(source.rows.map(r=>[r[0],r]));
 for(const p of plan.patches){const row=byId.get(p.id);if(String(row?.[p.column-1]??'')!==String(p.before))throw Error('Preimage mismatch');row[p.column-1]=p.after;}
 for(const record of plan.records.filter(r=>r.status==='MATCHED'))source.officialArchive[record.id]=record.metadata;
 return source;
}
