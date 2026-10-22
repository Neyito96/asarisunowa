import {writeFile,mkdir,rm,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {join,resolve} from 'node:path';
import {filterEpisodes} from '../lib/library-public.mjs';
import {selectPublishedEpisodes} from '../public/library/publication-scope.mjs';
export async function writePublicLibrarySnapshot({episodes,counts,publicationScope,snapshotDate,operations=null,destination}) {
selectPublishedEpisodes(episodes,publicationScope,{requireComplete:true});
const sorted=filterEpisodes(episodes);
const version=createHash('sha256').update(JSON.stringify({episodes:sorted,scopeVersion:publicationScope.version})).digest('hex').slice(0,16);
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
 for(let n=0;n<rows.length;n+=100){const file=`search/show-${i}-${n/100}.json`;await write(file,rows.slice(n,n+100).map(e=>({...summary(e),keywords:[e.description,...(e.tags||[]),...(e.relatedArticles||[]).map(a=>a.title)].join(' ')})));search.push(file);}
 shows.push({name:show,label:show==='こどもそうだんしつ'&&!groups.includes('SDGsを話そう')?'SDGsを話そう・こどもそうだんしつ':show,count:rows.length,audioPresent:rows.filter(e=>e.audioAvailable).length,playable:rows.filter(e=>e.audio).length,pages,search});
}
// IDs remain stable; bounded 50-record detail bundles avoid thousands of requests/files.
const details={};for(const e of episodes) {const bucket=Math.floor(Number(e.id.slice(3))/50);(details[bucket]??=[]).push(e);}
for(const [bucket,items] of Object.entries(details)) await write(`details/${bucket}.json`,items);
const manifest={schema:1,version,generatedAt:new Date().toISOString(),snapshotDate,total:episodes.length,counts,shows,pages:allPages,detailBucketSize:50,operations};
manifest.publicationScope={policy:publicationScope.policy,version:publicationScope.version,decisionDate:publicationScope.decisionDate,source:publicationScope.source,adopted:publicationScope.adopted,excluded:publicationScope.excluded,held:publicationScope.held,file:'scope.json'};
await write('scope.json', {...publicationScope,libraryVersion:version});
await write('manifest.json',manifest);
// Preserve the last good directory if the final filesystem swap fails.
const previous=root+'.previous';await rm(previous,{recursive:true,force:true});let saved=false;
try{await rename(root,previous);saved=true;}catch(e){if(e.code!=='ENOENT')throw e;}
try{await rename(stage,root);}catch(e){if(saved)await rename(previous,root);throw e;}
await rm(previous,{recursive:true,force:true});
return {version,total:manifest.total,...counts,shows:shows.map(({name,count,audioPresent,playable})=>({name,count,audioPresent,playable}))};
}
