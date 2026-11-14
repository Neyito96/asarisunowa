// COPY試験の再現用（第PR306）。A: COPYとV2の一致確認＋アダプタで1行計画 → MCP/GASで書込 → B: 読み戻し・不変・再実行0の確認
import fs from 'node:fs'; import vm from 'node:vm'; import crypto from 'node:crypto';
const D = process.env.TRIAL_DIR || '.'; // 読取JSONの置き場（台帳本文はコミットしない）
const sb={module:{exports:{}}}; vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url),'utf8'),sb); const A=sb.module.exports;
const H=[...A.HEADERS];
const cp=JSON.parse(fs.readFileSync(D+'/copyAJ.json')).values, t=JSON.parse(fs.readFileSync(D+'/tougou.json')).values, ij=JSON.parse(fs.readFileSync(D+'/tougouIJ.json')).values;
// COPY内容 = V2作業用（A:J）か
const h=(x)=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16);
const orig=t.map((r,i)=>[...Array(8)].map((_,c)=>r[c]??'').concat([(ij[i]||[])[0]??'',(ij[i]||[])[1]??'']));
const copy=cp.map(r=>[...Array(10)].map((_,c)=>r[c]??''));
console.log('rows copy/orig',copy.length,orig.length,'hash',h(copy),h(orig),'same',h(copy)===h(orig));
const vals=[H,...copy.slice(1).map(r=>{const o=H.map(()=> ''); r.forEach((v,c)=>o[c]=v); return o;})];
const item=JSON.parse(fs.readFileSync(D+'/test-item.json'));
const COPY='1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY';
const cfg={environment:'COPY',targetSpreadsheetId:COPY,expectedTargetId:COPY,sheetName:A.SHEET,scope:A.SCOPE,write:true};
const meta={id:COPY,name:'【COPY試験】V2収蔵ボット P25V2 1件試験 2026-11-11（本番ではない）',sheetName:A.SHEET};
let rec=null;
const io={open:()=>meta,readAll:()=>vals.map(r=>[...r]),appendRow:(row)=>{rec=row;return vals.length+1;},readRow:()=>rec};
const r=A.ingest(io,cfg,[item],{write:true});
fs.writeFileSync(D+'/pending-row.json',JSON.stringify({row:r.writtenRow,values:rec}));
console.log(JSON.stringify({added:r.added,ep:r.addedEpIds,row:r.writtenRow,counts:r.counts,publicBefore:r.publicBefore,publicAfter:r.publicAfter,nonEmpty:rec.map((v,i)=>v?H[i]:null).filter(Boolean)}));
