import { readFile } from 'node:fs/promises';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
import { gunzipSync } from 'node:zlib';
import { buildPublicationScope, selectPublishedEpisodes } from '../public/library/publication-scope.mjs';
import { createHash } from 'node:crypto';
import { blocked, publicEpisode } from '../lib/library-public.mjs';
const [sourcePath, destination='public/library/data', verifiedPath, decisionsPath=new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz',import.meta.url)] = process.argv.slice(2);
if (!sourcePath) throw Error('Usage: node scripts/export-library-public.mjs PRIVATE_SOURCE.json [DESTINATION] [AUDIO_EVIDENCE.json] [PUBLICATION_DECISIONS.json[.gz]]');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const verified = verifiedPath ? JSON.parse(await readFile(verifiedPath, 'utf8')) : {};
const decisionBytes=await readFile(decisionsPath);
const decisionSnapshot=source.publicationDecisions || JSON.parse((decisionBytes[0]===31&&decisionBytes[1]===139?gunzipSync(decisionBytes):decisionBytes).toString('utf8'));
const publicationScope=buildPublicationScope(decisionSnapshot);
publicationScope.version=createHash('sha256').update(JSON.stringify(decisionSnapshot.decisions)).digest('hex');
const decisionById=new Map(decisionSnapshot.decisions.map(r=>[r.id,r]));
const required = {0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',14:'音声URL',21:'概要原文',22:'概要清掃済み',38:'人間除外'};
for(const [i,h] of Object.entries(required)) if(source.headers[i] !== h) throw Error(`Header mismatch: ${h}`);
const ids = new Set(), excludedIds = new Set(), excludedGuids = new Set();
for (const r of (source.exclusions || []).slice(1)) { if(r[0]) excludedGuids.add(String(r[0]).toLowerCase()); if(r[1]) excludedIds.add(r[1]); }
const counts = { source: source.rows.length, excluded:0, held:0, scopeExcluded:0, scopeHeld:0, unreviewed:0 };
counts.policyExcluded=0;
const episodes=[];
for(const row of source.rows) {
 if(!/^EP-\d{5}$/.test(row[0] || '') || ids.has(row[0])) throw Error('Invalid/duplicate EP-ID');
 ids.add(row[0]);
 const decision=decisionById.get(row[0]);
 if(!decision){counts.unreviewed++;continue;}
 if(decision.show!==row[1])throw Error('Publication programme mismatch '+row[0]);
 if(decision.publication!=='対象'){if(decision.publication==='保留')counts.scopeHeld++;else counts.scopeExcluded++;continue;}
 if(['アルキキ','AJW'].includes(row[1])){counts.policyExcluded++;continue;}
 if(blocked(row[38]) || excludedIds.has(row[0]) || excludedGuids.has(String(row[6] || '').toLowerCase())) {counts.excluded++;continue;}
 if(!row[1] || !row[2] || !row[3]) {counts.held++;continue;}
 const e=publicEpisode(row,verified);
 const archive=source.officialArchive?.[e.id];
 if(archive){
   e.description=archive.body || e.description;e.descriptionSource=archive.body?'official-page':e.descriptionSource;
   e.archive={uuid:archive.uuid,sourceJsonUrl:archive.sourceJsonUrl,checkedAt:archive.checkedAt,previousOfficialUrl:archive.oldOfficialUrl,previousOfficialStatus:archive.oldOfficialStatus};
   e.tags=archive.tags || [];
   // Embed links stay external links. Never assign one to audio or construct an MP3.
   e.links=[...new Set([archive.officialUrl,archive.embedUrl,...[row[11],row[12],row[10]].filter(Boolean)])];
 }
 e.links=e.links.filter(url=>!(source.invalidUrls||[]).includes(url));
 if(source.archivePending?.[e.id])e.archiveWarning=source.archivePending[e.id].reason;
 const edited=source.descriptionEdits?.[e.id];
 if(edited){
   if(edited.holds?.length||!edited.description)throw Error('Unreviewed description '+e.id);
   e.description=edited.description;e.descriptionSource=edited.version;
   e.relatedArticles=edited.relatedArticles;e.related=edited.relatedArticles.map(a=>a.url);
   e.staffDetails=edited.staff;e.recording=edited.recording;
   e.descriptionEvidence={sourceUrl:edited.sourceUrl,fetchedAt:edited.fetchedAt,snapshotAt:edited.snapshotAt,rawHash:edited.rawHash};
 }
 if(!e.date) {counts.held++;continue;} episodes.push(e);
}
if(decisionSnapshot.decisions.some(r=>!ids.has(r.id)))throw Error('Publication decision refers to missing ledger ID');
selectPublishedEpisodes(episodes,publicationScope,{requireComplete:true});
const result=await writePublicLibrarySnapshot({episodes,counts,publicationScope,snapshotDate:source.snapshotDate || new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),operations:source.operations||null,destination});
console.log(JSON.stringify(result,null,2));
