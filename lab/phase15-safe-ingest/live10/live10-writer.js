'use strict';
// LAB mock/COPY adapter only. No production endpoint or automatic deployment.
const norm=x=>String(x||'').trim().toLowerCase();
function prepare(s,items){
 if(!s.schemaVerified||!s.exclusionVerified||!s.historyComplete)throw Error('STOP_PREFLIGHT');
 if(!Array.isArray(items)||items.length<1||items.length>8)throw Error('STOP_COUNT');
 const records=[...s.ledger,...s.history,...(s.reservations||[])],owners=new Map();
 for(const r of records)if(r.id){if(owners.has(r.id)&&owners.get(r.id)!==norm(r.guid))throw Error('STOP_ID_COLLISION');owners.set(r.id,norm(r.guid))}
 if(!owners.has('EP-06632'))throw Error('STOP_ANCHOR');
 const nums=[...owners.keys()].map(x=>/^EP-\d{5}$/.test(x)?Number(x.slice(3)):null).filter(Number.isFinite);
 if(!nums.length)throw Error('STOP_HISTORY');const max=Math.max(...nums);if(max+items.length>99999)throw Error('STOP_CAPACITY');
 const seen=new Set();
 for(const c of items){
  if(!c.guid||!c.show||!c.title||!c.pubDate||!/^https:\/\//.test(c.url||''))throw Error('STOP_METADATA');
  if(seen.has(norm(c.guid)))throw Error('STOP_BATCH_DUPLICATE');seen.add(norm(c.guid));
  if(records.some(r=>norm(r.guid)===norm(c.guid)||(r.url&&r.url===c.url)||(r.officialUrl&&r.officialUrl===c.url)||(norm(r.title)===norm(c.title)&&norm(r.show)===norm(c.show))))throw Error('STOP_DUPLICATE');
  if([...(s.excluded||[]),...(s.held||[])].some(r=>norm(r.guid)===norm(c.guid)))throw Error('STOP_POLICY');
 }
 return {mode:'PREVIEW',writes:0,rows:items.map((c,i)=>({...c,id:'EP-'+String(max+i+1).padStart(5,'0')}))};
}
// Backend must implement a single cross-writer lock and durable reservation journal.
// Failure after reserve requires operator reconciliation; do not blindly rerun.
async function ingest(backend,items,{approved=false}={}){
 if(!approved)throw Error('STOP_NOT_APPROVED');
 return backend.lock(async()=>{
  const plan=prepare(await backend.snapshot(),items),done=[];
  for(const row of plan.rows){
   if(await backend.findByGuid(row.guid))throw Error('STOP_RACE');
   await backend.reserve(row);
   try{await backend.append(row);const found=await backend.findByGuid(row.guid);
    if(!found||found.id!==row.id)throw Error('STOP_VERIFY');
    await backend.markComplete(row);done.push(row.id);
   }catch(e){throw Error('STOP_RECONCILE_REQUIRED:'+e.message)}
  }
  return {inserted:done.length,ids:done};
 });
}
if(typeof module!=='undefined')module.exports={prepare,ingest};
