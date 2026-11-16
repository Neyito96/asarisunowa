import fs from 'node:fs'; import vm from 'node:vm'; import crypto from 'node:crypto';
const D = process.env.TRIAL_DIR || '.'; // 読取JSONの置き場（台帳本文はコミットしない）
const sb={module:{exports:{}}}; vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url),'utf8'),sb); const A=sb.module.exports;
const H=[...A.HEADERS], h=(x)=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const pend=JSON.parse(fs.readFileSync(D+'/pending-row.json'));
// readback (A6557:AH6557, API が末尾空欄を省略するので34列に詰め直して比較)
const rb=JSON.parse(process.argv[2]); const back=H.map((_,i)=>String(rb[i]??'').trim());
const readbackOk=JSON.stringify(back)===JSON.stringify(pend.values.map(v=>String(v).trim()));
const b=JSON.parse(fs.readFileSync(D+'/copyAJ.json')).values.map(r=>[...Array(10)].map((_,c)=>r[c]??''));
const a=JSON.parse(fs.readFileSync(D+'/copyAJ_after.json')).values.map(r=>[...Array(10)].map((_,c)=>r[c]??''));
const existingUnchanged=h(a.slice(0,b.length))===h(b);
const vals=[H,...a.slice(1).map(r=>{const o=H.map(()=> ''); r.forEach((v,c)=>o[c]=v); return o;})];
const COPY='1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
const cfg={environment:'COPY',targetSpreadsheetId:COPY,expectedTargetId:COPY,sheetName:A.SHEET,scope:A.SCOPE,write:true};
let writes=0; const io={open:()=>({id:COPY,name:'【COPY試験】V2収蔵ボット',sheetName:A.SHEET}),readAll:()=>vals,appendRow:()=>{writes++;return 0;},readRow:()=>[]};
const r2=A.ingest(io,cfg,[JSON.parse(fs.readFileSync(D+'/test-item.json'))],{write:true});
const out={rowsBefore:b.length-1,rowsAfter:a.length-1,existingRowsUnchanged_AtoJ:existingUnchanged,readbackOk,rerun:{added:r2.added,counts:r2.counts,appendCalls:writes,existing:r2.decisions[0].existing},publicCountAfter:r2.publicBefore};
fs.writeFileSync(D+'/copy-test-result.json',JSON.stringify(out,null,1)); console.log(JSON.stringify(out));
