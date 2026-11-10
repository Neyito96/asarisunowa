// Bridge over the existing V3 ledger and exporter. No ingest, ID allocation or writes to Google.
import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import{resolve}from'node:path';
import{editDescription}from'../public/library/description-editor.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
import {gunzipSync} from 'node:zlib';
import {admitNewEpisodes} from './library-new-admissions.mjs';
export {v3RegisteredRowHash} from './library-new-admissions.mjs';
export function preparePublication(source,{archivePlan,descriptionPlan,baseDecisions,admissions,checkedAt=new Date().toISOString()}){
 const result=structuredClone(source),rows=new Map();for(const r of result.rows){if(rows.has(r[0]))throw Error('Duplicate ID');rows.set(r[0],r);}
 const excludedIds=new Set((result.exclusions||[]).slice(1).map(r=>r[1]));
 // Carry previously reviewed metadata only while the corresponding live ledger cells agree.
 result.officialArchive={};result.archivePending=archivePlan.archivePending;result.invalidUrls=archivePlan.invalidUrls;
 for(const record of archivePlan.records.filter(r=>r.status==='MATCHED')){
  const row=rows.get(record.id);if(!row){if(excludedIds.has(record.id))continue;throw Error('Reviewed archive ID disappeared: '+record.id);}
  if(row[9]!==record.metadata.officialUrl)throw Error('Archive provenance changed: '+record.id);
  result.officialArchive[record.id]=record.metadata;
 }
 result.descriptionEdits={};
 for(const record of descriptionPlan.records){
  const row=rows.get(record.id);if(!row){if(excludedIds.has(record.id))continue;throw Error('Reviewed description ID disappeared: '+record.id);}
  const conflicts=[['guid',String(row[6]||'')!==String(record.guid||'')],['show',row[1]!==record.show],['raw',digest(String(row[21]||''))!==record.rawHash],['clean',row[22]!==record.description]].filter(([,bad])=>bad).map(([field])=>field);
  if(conflicts.length)throw Error('Reviewed description changed: '+record.id+' ('+conflicts.join(',')+')');
  result.descriptionEdits[record.id]={...record};
 }
 const admission=admitNewEpisodes(source,baseDecisions,admissions);
 result.publicationDecisions=admission.snapshot;
 const states=new Map((source.v3FieldStates||[]).map(s=>[s[0],JSON.parse(s[1])]));
 const registered=[];
 // Persistently approved new rows are rendered identically on every export.
 const managed=result.rows.filter(r=>admission.admittedIds.includes(r[0]));
 for(const row of managed){
  const identity=states.get(row[0]).identity;
  registered.push({show:row[1],at:identity[6]});
  const edit=editDescription(row[21]);if(edit.holds.length)throw Error('New description requires review: '+row[0]);
  result.descriptionEdits[row[0]]={...edit,sourceUrl:row[32]||row[44]||row[8]||'',fetchedAt:null,snapshotAt:identity[6],rawHash:digest(String(row[21]))};
 }
 result.operations={mode:'V3_LEDGER_TO_PUBLIC',ledgerReadAt:checkedAt,registrationAt:registered.map(r=>r.at).sort().at(-1)||null,publicationVerifiedAt:null,registrationEvidence:'Only V3 identity VERIFIED/RSS_registered with matching row hash counts as registration; read time is separate.',shows:[...new Set(result.rows.map(r=>r[1]))].filter(s=>!['アルキキ','AJW'].includes(s)).map(show=>({show,ledgerReadAt:checkedAt,lastRssSuccessAt:null,lastRegisteredAt:registered.filter(r=>r.show===show).map(r=>r.at).sort().at(-1)||null,lastPublishedAt:null,lastErrorAt:null,nextRetryAt:null}))};
 return {source:result,report:{status:'PREPARED_NOT_PUBLISHED',checkedAt,registeredCandidates:admission.candidateIds.length,candidateIds:admission.candidateIds,admittedIds:admission.admittedIds,unreviewedIds:admission.unreviewedIds,managedRendered:managed.length,allocatedIds:0,googleWrites:0,sourceHash:digest(source),registrationAt:result.operations.registrationAt,publicationVerifiedAt:null}};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [input,output,reportPath,admissionsPath]=process.argv.slice(2);if(!reportPath)throw Error('Usage: PRIVATE_INPUT PRIVATE_OUTPUT REPORT [REVIEWED_ADMISSIONS.json]');
 const repo=resolve(new URL('..',import.meta.url).pathname);if(resolve(output).startsWith(repo+'/'))throw Error('Private source must stay outside repository');
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const baseDecisions=JSON.parse(gunzipSync(await readFile(new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz',import.meta.url))));
 const admissions=admissionsPath?await read(admissionsPath):{schema:1,entries:[]};
 const prepared=preparePublication(await read(input),{archivePlan:await read('docs/audits/2026-10-21-phase9/integration-plan.json'),descriptionPlan:await read('docs/audits/2026-10-21-phase11/description-plan.json'),baseDecisions,admissions});
 await writeFile(output,JSON.stringify(prepared.source));await writeFile(reportPath,JSON.stringify(prepared.report,null,2)+'\n');console.log(JSON.stringify(prepared.report));
}
