import{readFile,writeFile}from'node:fs/promises';import{resolve,join}from'node:path';
export function verifyPublicSnapshot(expected,actual){
 if(expected.version!==actual.version||expected.total!==actual.total||JSON.stringify(expected.shows.map(s=>[s.name,s.count]))!==JSON.stringify(actual.shows.map(s=>[s.name,s.count])))throw Error('PUBLIC_SNAPSHOT_NOT_MATCHED');
 return {stage:'public_readback',status:'SUCCESS',version:actual.version,verifiedAt:new Date().toISOString()};
}
export async function verifyPublishedEpisodes(manifest,episodes,readJson){
 const cache=new Map(),read=async p=>{if(!cache.has(p))cache.set(p,await readJson(p));return cache.get(p);};
 for(const expected of episodes){
  const bucket=`details/${Math.floor(Number(expected.id.slice(3))/manifest.detailBucketSize)}.json`;
  const actual=(await read(bucket)).find(e=>e.id===expected.id);
  if(!actual||['title','show','date','description'].some(k=>actual[k]!==expected[k])||JSON.stringify(actual.relatedArticles||[])!==JSON.stringify(expected.relatedArticles||[])||JSON.stringify(actual.links)!==JSON.stringify(expected.links))throw Error('PUBLIC_DETAIL_NOT_MATCHED');
  const show=manifest.shows.find(s=>s.name===expected.show);if(!show)throw Error('PUBLIC_SHOW_NOT_MATCHED');
  let found;for(const p of show.search){found=(await read(p)).find(e=>e.id===expected.id);if(found)break;}
  if(!found||found.title!==expected.title||!String(found.keywords).includes(expected.description))throw Error('PUBLIC_SEARCH_NOT_MATCHED');
 }
 return {episodesVerified:episodes.length,readRequests:cache.size};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [manifestPath,reportPath,dataDir,preparationPath]=process.argv.slice(2),expected=JSON.parse(await readFile(manifestPath,'utf8'));let proof;
 const base='https://neyito96.github.io/asarisunowa/library/data/';
 const readJson=async p=>{const r=await fetch(base+p+'?verify='+expected.version,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('PUBLIC_HTTP_'+r.status);return r.json();};
 const episodes=[];
 if(dataDir&&preparationPath){const prepared=JSON.parse(await readFile(preparationPath,'utf8'));for(const id of prepared.newIds||[]){const path=`details/${Math.floor(Number(id.slice(3))/expected.detailBucketSize)}.json`;episodes.push(JSON.parse(await readFile(join(dataDir,path),'utf8')).find(e=>e.id===id));}}
 for(let attempt=0;attempt<6;attempt++){
  try{proof=verifyPublicSnapshot(expected,await readJson('manifest.json'));Object.assign(proof,await verifyPublishedEpisodes(expected,episodes,readJson));break;}catch(e){if(attempt===5){await writeFile(reportPath,JSON.stringify({stage:'public_readback',status:'FAILED',at:new Date().toISOString(),reason:e.message})+'\n');throw e;}await new Promise(r=>setTimeout(r,10000));}
 }
 await writeFile(reportPath,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
