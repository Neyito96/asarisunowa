// Registration evidence is necessary but never substitutes for publication review.
import {createHash} from 'node:crypto';
import {blocked} from '../lib/library-public.mjs';
import {buildPublicationScope} from '../public/library/publication-scope.mjs';
export const decisionVersion = decisions => createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
export function v3RegisteredRowHash(row) {
 const values=row.slice(0,51).map(v=>v??'');
 const date=String(values[3]).replace(' ','T');
 values[3]=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(date)?date:date+'+09:00').toISOString();
 return createHash('sha256').update(JSON.stringify(values)).digest('base64url');
}
const normal=v=>String(v||'').trim().toLowerCase();
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function clipIds(row){
 const ids=new Set([row[6],row[51]].filter(v=>uuid.test(String(v||''))).map(normal));
 // Omny audio URLs contain organisation, programme, then clip UUID. Only clip identifies an episode.
 for(const value of row){const m=String(value||'').match(/\/clips\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/([a-f0-9-]{36})(?:\/|\?|$)/i);if(m&&uuid.test(m[3]))ids.add(normal(m[3]));}
 return ids;
}
export function admitNewEpisodes(source,base,admissions={schema:1,entries:[]}){
 buildPublicationScope(base);
 if(admissions.schema!==1||!Array.isArray(admissions.entries))throw Error('Invalid admissions');
 if(admissions.entries.length && (admissions.baseDecisionVersion!==decisionVersion(base.decisions)||!Number.isFinite(Date.parse(admissions.newAfter))))throw Error('Admission baseline/cutoff mismatch');
 const baseline=new Set(base.decisions.map(d=>d.id)), rows=new Map(), states=new Map();
 for(const row of source.rows){if(rows.has(row[0]))throw Error('Duplicate ID');rows.set(row[0],row);}
 for(const state of source.v3FieldStates||[]){if(states.has(state[0]))throw Error('Duplicate V3 state ID');states.set(state[0],JSON.parse(state[1]));}
 const candidates=source.rows.filter(r=>!baseline.has(r[0])&&states.get(r[0])?.identity?.[5]==='RSS_registered');
 const excludedIds=new Set((source.exclusions||[]).slice(1).map(r=>r[1]));
 const excludedGuids=new Set((source.exclusions||[]).slice(1).map(r=>normal(r[0])));
 const accepted=[],seen=new Set();
 for(const entry of admissions.entries){
  const row=rows.get(entry.id),identity=states.get(entry.id)?.identity;
  if(baseline.has(entry.id)||seen.has(entry.id))throw Error('Admission changes baseline/duplicates ID: '+entry.id);seen.add(entry.id);
  if(!row||!identity||identity[0]!=='VERIFIED'||identity[5]!=='RSS_registered'||!row[6]||!row[21]||!row[22]||identity[1]!==row[6]||String(identity[2]).replace(/=+$/,'')!==v3RegisteredRowHash(row)||!Number.isFinite(Date.parse(identity[6])))throw Error('Unverified registration: '+entry.id);
  if(entry.guid!==row[6]||entry.rowHash!==v3RegisteredRowHash(row)||entry.registeredAt!==identity[6]||entry.show!==row[1]||entry.review!=='確認済み'||entry.publication!=='対象'||!Number.isFinite(Date.parse(entry.decidedAt))||Date.parse(entry.decidedAt)<Date.parse(identity[6]))throw Error('Admission evidence mismatch: '+entry.id);
  if(Date.parse(identity[6])<Date.parse(admissions.newAfter)||Date.parse(String(row[3]).replace(' ','T')+(/(?:Z|[+-]\d\d:\d\d)$/.test(row[3])?'':'+09:00'))<Date.parse(admissions.newAfter))throw Error('Admission predates cutoff: '+entry.id);
  if(blocked(row[38])||excludedIds.has(row[0])||excludedGuids.has(normal(row[6]))||['アルキキ','AJW'].includes(row[1]))throw Error('Admission is excluded: '+entry.id);
  const clips=clipIds(row);
  if(source.rows.some(other=>other[0]!==row[0]&&(normal(other[6])===normal(row[6])||[...clipIds(other)].some(id=>clips.has(id)))))throw Error('GUID/official UUID collision: '+entry.id);
  accepted.push({...entry,comparison:'保留'});
 }
 const snapshot=structuredClone(base);
 snapshot.decisions.push(...accepted.sort((a,b)=>a.id.localeCompare(b.id)));
 // Retain the original read hash; additive review provenance is separately identified.
 snapshot.admissionProvenance={baseDecisionVersion:decisionVersion(base.decisions),admissionsVersion:decisionVersion(admissions)};
 buildPublicationScope(snapshot);
 return {snapshot,admittedIds:accepted.map(e=>e.id),candidateIds:candidates.map(r=>r[0]),unreviewedIds:source.rows.filter(r=>!baseline.has(r[0])&&!seen.has(r[0])).map(r=>r[0])};
}
