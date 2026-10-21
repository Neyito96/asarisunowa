// Preview-only. Does not export or replace the live library snapshot.
import{readFile,writeFile,readdir}from'node:fs/promises';
import{selectSamples,validateSample}from'../experiments/universe-v0.1/model.mjs';
const root=new URL('../public/library/data/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const episodes=[];for(const file of (await readdir(new URL('details/',root))).filter(f=>/^\d+\.json$/.test(f)).sort())episodes.push(...JSON.parse(await readFile(new URL('details/'+file,root),'utf8')));
const sample=validateSample({schema:'universe-strata/0.1',populationStatus:'AUDIT_PENDING',canonicalTotal:null,source:{version:manifest.version,snapshotDate:manifest.snapshotDate,fields:['id','title','show','date'],scope:'Illustrative sample only; not a population decision'},episodes:selectSamples(episodes),people:[],coappearances:[],relatedArticles:[]});
await writeFile(new URL('../experiments/universe-v0.1/sample.json',import.meta.url),JSON.stringify(sample,null,2)+'\n');console.log('Wrote title-evidence preview sample; canonicalTotal=null');
