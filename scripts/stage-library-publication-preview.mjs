/** Rebuild only public files, using the shared writer; source snapshot stays intact. */
import {readFile,readdir} from 'node:fs/promises';import {resolve,join} from 'node:path';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {buildPublicationScope,selectPublishedEpisodes} from '../public/library/publication-scope.mjs';
import {writePublicLibrarySnapshot} from './library-publication-files.mjs';
const [input,destination,decisions=new URL('../docs/audits/2026-10-22-publication-scope/decisions.json.gz',import.meta.url)]=process.argv.slice(2);
if(!input||!destination)throw Error('SOURCE_PUBLIC_DATA SEPARATE_PREVIEW_DEST [DECISIONS]');
const source=resolve(input),target=resolve(destination);
if(source===target||target.startsWith(source+'/')||source.startsWith(target+'/'))throw Error('SEPARATE_PREVIEW_REQUIRED');
const bytes=await readFile(decisions),snapshot=JSON.parse((bytes[0]===31&&bytes[1]===139?gunzipSync(bytes):bytes).toString('utf8'));
const scope=buildPublicationScope(snapshot);scope.version=createHash('sha256').update(JSON.stringify(snapshot.decisions)).digest('hex');
const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
const episodes=[];for(const file of await readdir(join(source,'details')))if(/^\d+\.json$/.test(file))episodes.push(...JSON.parse(await readFile(join(source,'details',file),'utf8')));
if(episodes.length!==manifest.total||manifest.counts.source<scope.source)throw Error('SOURCE_SNAPSHOT_INCOMPLETE');
const selected=selectPublishedEpisodes(episodes,scope,{requireComplete:true});
const counts={source:manifest.counts.source,excluded:0,held:0,scopeExcluded:scope.excluded,scopeHeld:scope.held,unreviewed:manifest.counts.source-scope.source,policyExcluded:0};
console.log(JSON.stringify(await writePublicLibrarySnapshot({episodes:selected,counts,publicationScope:scope,snapshotDate:manifest.snapshotDate,operations:manifest.operations,destination:target}),null,2));
