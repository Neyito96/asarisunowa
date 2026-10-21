// Bridge over the existing V3 ledger and exporter. No ingest, ID allocation or writes to Google.
import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';import{resolve}from'node:path';
import{editDescription}from'../public/library/description-editor.mjs';
import{blocked}from'../lib/library-public.mjs';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function v3RegisteredRowHash(row){
 const values=row.slice(0,51).map(v=>v??'');
 const date=String(values[3]).replace(' ','T');
 values[3]=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(date)?date:date+'+09:00').toISOString();
 return createHash('sha256').update(JSON.stringify(values)).digest('base64url');
}
export function preparePublication(source,{archivePlan,descriptionPlan,previousIds,checkedAt=new Date().toISOString()}){
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
 const excludedGuids=new Set((result.exclusions||[]).slice(1).map(r=>String(r[0]||'').toLowerCase()));
 const newRows=result.rows.filter(r=>!previousIds.has(r[0])&&!['アルキキ','AJW'].includes(r[1])&&!excludedIds.has(r[0])&&!excludedGuids.has(String(r[6]||'').toLowerCase())&&!blocked(r[38]));
 const states=new Map();for(const state of source.v3FieldStates||[]){if(states.has(state[0]))throw Error('Duplicate V3 state ID');states.set(state[0],JSON.parse(state[1]));}
 const registered=[];
 // Re-render ALL V3-registered rows on every export, not only newly visible IDs.
 // Otherwise a second poll loses structured descriptions, or changes evidence time
 // on every pass and causes an endless stream of publication PRs.
 const managed=result.rows.filter(r=>!result.descriptionEdits[r[0]]&&!['アルキキ','AJW'].includes(r[1])&&!excludedIds.has(r[0])&&!excludedGuids.has(String(r[6]||'').toLowerCase())&&!blocked(r[38])&&(newRows.includes(r)||states.get(r[0])?.identity?.[5]==='RSS_registered'));
 for(const row of managed){
  // V3 supplies identity/EP-ID; here we only render the newly registered content.
  if(!row[6]||!row[21]||!row[22])throw Error('New row lacks V3 identity/raw/clean evidence: '+row[0]);
  const identity=states.get(row[0])?.identity;
  if(!identity||identity[0]!=='VERIFIED'||identity[1]!==row[6]||String(identity[2]).replace(/=+$/,'')!==v3RegisteredRowHash(row)||identity[5]!=='RSS_registered'||!Number.isFinite(Date.parse(identity[6])))throw Error('V3 registration readback not verified: '+row[0]);
  if(result.rows.filter(r=>String(r[6]||'').toLowerCase()===String(row[6]).toLowerCase()).length!==1)throw Error('New GUID collision: '+row[0]);
  registered.push({show:row[1],at:identity[6]});
  const edit=editDescription(row[21]);if(edit.holds.length)throw Error('New description requires review: '+row[0]);
  result.descriptionEdits[row[0]]={...edit,sourceUrl:row[32]||row[44]||row[8]||'',fetchedAt:null,snapshotAt:identity[6],rawHash:digest(String(row[21]))};
 }
 result.operations={mode:'V3_LEDGER_TO_PUBLIC',ledgerReadAt:checkedAt,registrationAt:registered.map(r=>r.at).sort().at(-1)||null,publicationVerifiedAt:null,registrationEvidence:'Only V3 identity VERIFIED/RSS_registered with matching row hash counts as registration; read time is separate.',shows:[...new Set(result.rows.map(r=>r[1]))].filter(s=>!['アルキキ','AJW'].includes(s)).map(show=>({show,ledgerReadAt:checkedAt,lastRssSuccessAt:null,lastRegisteredAt:registered.filter(r=>r.show===show).map(r=>r.at).sort().at(-1)||null,lastPublishedAt:null,lastErrorAt:null,nextRetryAt:null}))};
 return {source:result,report:{status:'PREPARED_NOT_PUBLISHED',checkedAt,newLedgerRowsObserved:newRows.length,newIds:newRows.map(r=>r[0]),managedRendered:managed.length,allocatedIds:0,googleWrites:0,sourceHash:digest(source),registrationAt:result.operations.registrationAt,publicationVerifiedAt:null}};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [input,output,reportPath]=process.argv.slice(2);if(!reportPath)throw Error('Usage: PRIVATE_INPUT PRIVATE_OUTPUT REPORT');
 const repo=resolve(new URL('..',import.meta.url).pathname);if(resolve(output).startsWith(repo+'/'))throw Error('Private source must stay outside repository');
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const previous=await read('public/library/data/manifest.json'),previousIds=new Set();for(const page of previous.pages)for(const e of await read('public/library/data/'+page))previousIds.add(e.id);
 const prepared=preparePublication(await read(input),{archivePlan:await read('docs/audits/2026-10-21-phase9/integration-plan.json'),descriptionPlan:await read('docs/audits/2026-10-21-phase11/description-plan.json'),previousIds});
 await writeFile(output,JSON.stringify(prepared.source));await writeFile(reportPath,JSON.stringify(prepared.report,null,2)+'\n');console.log(JSON.stringify(prepared.report));
}
