// Diagnostic over a V3 input snapshot, not a second ingest/ID engine.
import{readFile,writeFile}from'node:fs/promises';import{blocked}from'../lib/library-public.mjs';
const [privateDir,out='docs/audits/2026-10-21-phase11/rss-delta.json']=process.argv.slice(2);
const source=JSON.parse(await readFile(privateDir+'/source.json','utf8')),items=JSON.parse(await readFile(privateDir+'/rss-items.json','utf8')),feed=JSON.parse(await readFile(privateDir+'/rss-source.json','utf8'));
const anchors=r=>[r[6],...[...String(r[8]+' '+r[9]).matchAll(/[a-f0-9]{8}-[a-f0-9-]{27}/gi)].map(m=>m[0])].filter(Boolean).map(s=>String(s).toLowerCase());
const known=new Map();for(const r of source.rows)for(const g of anchors(r)){const list=known.get(g)||[];if(!list.includes(r[0]))list.push(r[0]);known.set(g,list);}
const excluded=new Set((source.exclusions||[]).slice(1).map(r=>String(r[0]||'').toLowerCase()));
const baselineDate=source.rows.filter(r=>r[1]==='ニュースの現場から').map(r=>String(r[3]).slice(0,10)).sort().at(-1);
const repeated=new Set(items.filter((x,i)=>items.findIndex(y=>y.guid===x.guid)!==i).map(x=>x.guid));const result={mode:'READ_ONLY_EXISTING_V3_INPUT_DIAGNOSTIC',feed,existing:0,excluded:0,held:[],newCandidates:[],writes:0,assignedIds:0};
for(const item of items){const ids=known.get(item.guid.toLowerCase())||[];if(excluded.has(item.guid.toLowerCase())){result.excluded++;continue;}if(repeated.has(item.guid)||ids.length>1){result.held.push({guid:item.guid,reason:'DUPLICATE_IDENTITY',ids});continue;}if(ids.length){result.existing++;continue;}const day=new Date(Date.parse(item.pubDate)+9*3600000).toISOString().slice(0,10);if(day<=baselineDate){result.held.push({guid:item.guid,title:item.title,reason:'HISTORICAL_UNANCHORED_BEFORE_BASELINE',id:null});continue;}result.newCandidates.push({guid:item.guid,title:item.title,publishedAt:item.pubDate,id:null,status:'V3_CUTOVER_BASELINE_APPROVAL_REQUIRED'});}
await writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({existing:result.existing,excluded:result.excluded,held:result.held.length,newCandidates:result.newCandidates.length,assignedIds:0,writes:0}));
