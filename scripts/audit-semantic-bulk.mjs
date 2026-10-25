#!/usr/bin/env node
// Run from repository root: node scripts/audit-semantic-bulk.mjs
import fs from 'node:fs';
import path from 'node:path';
const root='docs/semantic-classification/bulk-20261023';
const output='docs/semantic-classification/bulk-20261023/audit-generated.json';
const files=fs.readdirSync(root).filter(x=>/^batch-.*\.json$/.test(x)).sort();
const records=[], invalid=[];
for(const file of files){
 let data;try{data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))}catch(e){invalid.push({file,error:String(e)});continue}
 const rows=Array.isArray(data)?data:Array.isArray(data.records)?data.records:Array.isArray(data.episodes)?data.episodes:null;
 if(!rows){invalid.push({file,error:'no-record-array'});continue}
 for(const [index,r] of rows.entries()){
  const id=r.ep_id||r.id, theme=r.main_theme||r.primary;
  if(!/^EP-\d{5}$/.test(id||'')||!theme){invalid.push({file,index,id,error:'invalid record'});continue}
  records.push({...r,ep_id:id,main_theme:theme,source_file:file});
 }
}
const byId=new Map();for(const r of records){const a=byId.get(r.ep_id)||[];a.push(r);byId.set(r.ep_id,a)}
const duplicates=[...byId].filter(([id,a])=>a.length>1).map(([id,a])=>({id,files:a.map(r=>r.source_file)}));
const counts={};const review={};for(const r of records){counts[r.status||'unspecified']=(counts[r.status||'unspecified']||0)+1;review[r.review_basis||'unspecified']=(review[r.review_basis||'unspecified']||0)+1}
const audit={schema:'semantic-bulk-audit-v1',scope:'branch work/semantic-classification-bulk-20261023',files:files.length,rawRecords:records.length,uniqueIds:byId.size,duplicates,invalid,statusCounts:counts,reviewBasisCounts:review,warning:'All provisional and title_based records remain provisional. This is an audit, not approval or a production publication.'};
fs.writeFileSync(output,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({...audit,duplicates:duplicates.length,invalid:invalid.length},null,2));
if(invalid.length)process.exitCode=1;
