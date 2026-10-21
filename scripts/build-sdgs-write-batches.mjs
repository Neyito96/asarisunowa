import { readFile, writeFile } from 'node:fs/promises';
const path=process.argv[2]||'docs/audits/2026-10-21-phase9/integration-plan.json';
const plan=JSON.parse(await readFile(path,'utf8'));
if(plan.mode!=='READ_ONLY'||plan.audioWrites||plan.epIdChanges||plan.newCandidates.length)throw Error('Only guarded existing-cell plan supported; new rows must use V3');
const allowed=new Set([2,3,10,17,22,23,52,53,54,55]);
for(const p of plan.patches)if(!allowed.has(p.column))throw Error('Protected column');
function groups(patches,reverse=false){
 const sorted=[...patches].sort((a,b)=>a.column-b.column||a.row-b.row),list=[];
 for(const p of sorted){let g=list.at(-1);if(!g||g.column!==p.column||g.endRow!==p.row-1||g.cells.length>=50){g={column:p.column,startRow:p.row-1,endRow:p.row-1,cells:[]};list.push(g);}g.cells.push(p);g.endRow=p.row;}
 return list.map(g=>({guard:g.cells.map(p=>({id:p.id,row:p.row,column:p.column,expected:reverse?p.after:p.before})),request:{updateCells:{range:{sheetId:806280644,startRowIndex:g.startRow,endRowIndex:g.endRow,startColumnIndex:g.column-1,endColumnIndex:g.column},rows:g.cells.map(p=>({values:[{userEnteredValue:{stringValue:String(reverse?p.before:p.after)}}]})),fields:'userEnteredValue'}}}));
}
function batches(groups){const all=[];let batch=[],cells=0;for(const group of groups){if(batch.length&&(batch.length>=20||cells+group.guard.length>500)){all.push(batch);batch=[];cells=0;}batch.push(group);cells+=group.guard.length;}if(batch.length)all.push(batch);return all;}
const output={mode:'PREPARED_NOT_EXECUTED',spreadsheetId:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',planHash:plan.planHash,baseHash:plan.baseHash,requiresUserApproval:true,guards:['same planHash','same EP-ID at each row','live preimage/formula/validation check before each batch','readback after each batch','no full-row or O-column writes','do not continue on conflict'],batches:batches(groups(plan.patches)),rollback:batches(groups(plan.patches,true))};
await writeFile(path.replace('integration-plan.json','write-batches.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({cells:plan.patches.length,batches:output.batches.length,requests:output.batches.flat().length,rollbackBatches:output.rollback.length}));
