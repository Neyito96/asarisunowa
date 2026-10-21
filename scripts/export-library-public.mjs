import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { blocked, publicEpisode, filterEpisodes } from '../lib/library-public.mjs';
const [sourcePath, destination='public/library/data', verifiedPath] = process.argv.slice(2);
if (!sourcePath) throw Error('Usage: node scripts/export-library-public.mjs PRIVATE_SOURCE.json [DESTINATION] [AUDIO_EVIDENCE.json]');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const verified = verifiedPath ? JSON.parse(await readFile(verifiedPath, 'utf8')) : {};
const required = {0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',14:'音声URL',21:'概要原文',22:'概要清掃済み',38:'人間除外'};
for(const [i,h] of Object.entries(required)) if(source.headers[i] !== h) throw Error(`Header mismatch: ${h}`);
const ids = new Set(), excludedIds = new Set(), excludedGuids = new Set();
for (const r of (source.exclusions || []).slice(1)) { if(r[0]) excludedGuids.add(String(r[0]).toLowerCase()); if(r[1]) excludedIds.add(r[1]); }
const counts = { source: source.rows.length, excluded:0, held:0 };
const episodes=[];
for(const row of source.rows) {
 if(!/^EP-\d{5}$/.test(row[0] || '') || ids.has(row[0])) throw Error('Invalid/duplicate EP-ID');
 ids.add(row[0]);
 if(blocked(row[38]) || excludedIds.has(row[0]) || excludedGuids.has(String(row[6] || '').toLowerCase())) {counts.excluded++;continue;}
 if(!row[1] || !row[2] || !row[3]) {counts.held++;continue;}
 const e=publicEpisode(row,verified); if(!e.date) {counts.held++;continue;} episodes.push(e);
}
if(episodes.length < 6000) throw Error('Unexpected record loss; keep previous public snapshot');
const sorted=filterEpisodes(episodes);
const version=createHash('sha256').update(JSON.stringify(episodes)).digest('hex').slice(0,16);
const root=resolve(destination), stage=root+'.staging';
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
const write=async(path,data)=>{await mkdir(join(stage,path,'..'),{recursive:true});await writeFile(join(stage,path),JSON.stringify(data)+'\n');};
const summary=e=>({id:e.id,show:e.show,title:e.title,date:e.date,cast:e.cast,audio:!!e.audio});
const groups=[...new Set(sorted.map(e=>e.show))];
const shows=[];
const allPages=[];
for(let n=0;n<sorted.length;n+=40) {const file=`pages/all-${n/40}.json`;await write(file,sorted.slice(n,n+40).map(summary));allPages.push(file);}
for(const [i,show] of groups.entries()) {
 const rows=sorted.filter(e=>e.show===show), pages=[];
 for(let n=0;n<rows.length;n+=40) {const file=`pages/show-${i}-${n/40}.json`;await write(file,rows.slice(n,n+40).map(summary));pages.push(file);}
 // Full description belongs only in the on-demand search index, never the initial payload.
 const search=[];
 for(let n=0;n<rows.length;n+=100){const file=`search/show-${i}-${n/100}.json`;await write(file,rows.slice(n,n+100).map(e=>({...summary(e),keywords:e.description})));search.push(file);}
 shows.push({name:show,label:show==='こどもそうだんしつ'?'SDGsを話そう・こどもそうだんしつ':show,count:rows.length,audioPresent:rows.filter(e=>e.audioAvailable).length,playable:rows.filter(e=>e.audio).length,pages,search});
}
// IDs remain stable; bounded 50-record detail bundles avoid thousands of requests/files.
const details={};for(const e of episodes) {const bucket=Math.floor(Number(e.id.slice(3))/50);(details[bucket]??=[]).push(e);}
for(const [bucket,items] of Object.entries(details)) await write(`details/${bucket}.json`,items);
const manifest={schema:1,version,generatedAt:new Date().toISOString(),snapshotDate:source.snapshotDate || new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),total:episodes.length,counts,shows,pages:allPages,detailBucketSize:50};
await write('manifest.json',manifest);
await rm(root,{recursive:true,force:true});await rename(stage,root);
console.log(JSON.stringify({version,total:manifest.total,...counts,shows:shows.map(({name,count,audioPresent,playable})=>({name,count,audioPresent,playable}))},null,2));
