import{readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';
export function verifyPublicSnapshot(expected,actual){
 if(expected.version!==actual.version||expected.total!==actual.total||JSON.stringify(expected.shows.map(s=>[s.name,s.count]))!==JSON.stringify(actual.shows.map(s=>[s.name,s.count])))throw Error('PUBLIC_SNAPSHOT_NOT_MATCHED');
 return {stage:'public_readback',status:'SUCCESS',version:actual.version,verifiedAt:new Date().toISOString()};
}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){
 const [manifestPath,reportPath]=process.argv.slice(2),expected=JSON.parse(await readFile(manifestPath,'utf8'));let proof;
 for(let attempt=0;attempt<6;attempt++){
  try{const r=await fetch('https://neyito96.github.io/asarisunowa/library/data/manifest.json?verify='+expected.version,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);proof=verifyPublicSnapshot(expected,await r.json());break;}catch(e){if(attempt===5)throw e;await new Promise(r=>setTimeout(r,10000));}
 }
 await writeFile(reportPath,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
