/** Side-effect-free planner: snapshots only; never calls APIs or writes. */
export function planMigration(productionRows, copyRows, historyRows, options = {}) {
 const assert=(condition,reason)=>{if(!condition)throw Error(reason)};
 assert(productionRows.every(r=>r.id), 'INVALID_PRODUCTION_SNAPSHOT');
 const pids=new Map(), pguids=new Map(), cguids=new Set(), hids=new Set(), hguids=new Set();
 for(const r of productionRows){assert(!pids.has(r.id),'DUPLICATE_PRODUCTION_ID');if(r.guid)assert(!pguids.has(r.guid),'DUPLICATE_PRODUCTION_GUID');pids.set(r.id,r);if(r.guid)pguids.set(r.guid,r)}
 for(const r of historyRows){if(r.id)hids.add(r.id);if(r.guid)hguids.add(r.guid)}
 const allNums=[...pids.keys(),...hids].map(id=>/^EP-(\d+)$/.exec(id)).filter(Boolean).map(m=>Number(m[1]));
 const max=Math.max(0,...allNums);
 if(options.expectedMax!==undefined) assert(max===options.expectedMax,'SNAPSHOT_STALE_OR_RESERVED_ID');
 let n=max;const out=[];
 for(const r of copyRows){
   assert(r.id&&r.guid&&r.title,'INVALID_COPY_ITEM');assert(!cguids.has(r.guid),'DUPLICATE_COPY_GUID');cguids.add(r.guid);
   const present=pguids.get(r.guid);
   if(present){out.push({copy_ep_id:r.id,copy_guid:r.guid,production_existing_id:present.id,proposed_production_id:null,decision:'EXISTING_GUID'});continue}
   if(hguids.has(r.guid)) {out.push({copy_ep_id:r.id,copy_guid:r.guid,production_existing_id:null,proposed_production_id:null,decision:'HOLD_HISTORY_GUID'});continue}
   let candidate;do {candidate='EP-'+String(++n).padStart(5,'0')}while(pids.has(candidate)||hids.has(candidate));
   out.push({copy_ep_id:r.id,copy_guid:r.guid,production_existing_id:null,proposed_production_id:candidate,decision:'PROPOSE_ONLY',title:r.title,source_url:r.source_url||null,published_at:r.published_at||null,review_state:'UNREVIEWED_PRODUCTION'});
 }
 return {mode:'READ_ONLY_PLAN',snapshotMax:max,addCandidates:out.filter(x=>x.decision==='PROPOSE_ONLY').length,existing:out.filter(x=>x.decision==='EXISTING_GUID').length,holds:out.filter(x=>x.decision.startsWith('HOLD')).length,writes:0,items:out};
}
/** Simulated commit gate only; inject a refreshed snapshot before any authorized run. */
export function precommitGate(plan, currentRows, currentHistory) {
 const now=new Set(currentRows.map(r=>r.id)), gids=new Set(currentRows.map(r=>r.guid));
 const histIDs=new Set(currentHistory.map(r=>r.id)), histGUIDs=new Set(currentHistory.map(r=>r.guid));
 return plan.items.map(x=>({
  copy_ep_id:x.copy_ep_id,
  decision:gids.has(x.copy_guid)||histGUIDs.has(x.copy_guid)?'EXISTING_OR_CONFLICT_GUID':
     x.proposed_production_id&&(now.has(x.proposed_production_id)||histIDs.has(x.proposed_production_id))?'STOP_CONCURRENT_ID':
     x.decision==='PROPOSE_ONLY'?'READY_FOR_SEPARATE_APPROVAL':x.decision
 }));
}
/** Recovery specification: no real writes; a durable ledger must guard stage transitions. */
export const recoveryStages=['PREPARED','ROW_WRITTEN','HISTORY_WRITTEN','V3_WRITTEN','VERIFIED'];
