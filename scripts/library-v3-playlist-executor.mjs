/** Opt-in TEST playlist adapter. Not loaded by GAS, site, RSS cron or default CLI. */
import {createHash} from 'node:crypto';
// Exact previously authorized test ID; no environment override or production bypass.
export const APPROVED_TEST_PLAYLIST_ID='4FiVIwysKDtLqEXfkfhu2O';
export const planHash=plan=>createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const norm=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const jstDay=x=>{const t=Date.parse(x);return Number.isFinite(t)?new Date(t+9*3600000).toISOString().slice(0,10):null;};
export async function executeLibraryPlaylistPlan({plan,client,journal,lock,approval={},now=()=>Date.now()}={}){
 const history=[],finish=(status,extra={})=>({status,history,...extra});
 if(plan?.action!=='ADD_EXISTING'||plan.playlistId!==APPROVED_TEST_PLAYLIST_ID||approval.explicit!==true||approval.planHash!==planHash(plan)||approval.maxItems!==1||!Array.isArray(plan.ready)||plan.ready.length!==1)return finish('HOLD_NOT_APPROVED');
 if(plan.ready.some(e=>!/^EP-\d+$/.test(e.epId||'')||!e.guid||!e.sourceUrl||e.identityStatus!=='EXACT'||e.selectionStatus!=='REVIEWED'||e.spotifyEvidenceStatus!=='VERIFIED'||e.uri!=='spotify:episode:'+e.spotifyId||e.deleted||e.excluded||e.humanExcluded))return finish('HOLD_EPISODE_PROOF');
 if(journal?.durable!==true||!journal.get||!journal.put||!lock?.acquire||!lock?.release)return finish('HOLD_DURABLE_LOCK_REQUIRED');
 const key='playlist:'+plan.playlistId;if(!await lock.acquire(key))return finish('BUSY');
 try{
  for(const e of plan.ready){
   const k=key+'|'+e.spotifyId,prior=await journal.get(k);
   if(prior&&prior.status!=='RETRY_LATER'){history.push({epId:e.epId,status:prior.status==='ADDED'||prior.status==='OBSERVED'?'ALREADY_HANDLED':'HOLD_PRIOR_ATTEMPT'});continue;}
   if(prior?.retryAt>now()){history.push({epId:e.epId,status:'RETRY_WAIT',retryAt:prior.retryAt});continue;}
   const record=async(status,extra={})=>{const r={epId:e.epId,guid:e.guid,playlistId:plan.playlistId,spotifyId:e.spotifyId,status,at:new Date(now()).toISOString(),...extra};const previous=await journal.get(k);await journal.put(k,{...r,history:[...(previous?.history||[]),r]});history.push(r);};
   let s=await client.stableSnapshot(plan.playlistId);
   if(!s.complete){await record('HOLD_SNAPSHOT',{failure:s.status,evidence:s.evidence});return finish('HOLD_SNAPSHOT',{failure:s.status});}
   if(s.episodeUrls.includes('https://open.spotify.com/episode/'+e.spotifyId)){await record('OBSERVED');continue;}
   const check=await client.episode(e.spotifyId),v=check.body;
   if(check.status!=='OK'){await record('HOLD_EPISODE',{failure:check.status,evidence:check.evidence});return finish('HOLD_EPISODE',{failure:check.status});}
   if(v?.id!==e.spotifyId||v?.show?.id!==e.spotifyShowId||norm(v?.name)!==norm(e.title)||v?.release_date_precision!=='day'||v.release_date!==jstDay(e.publishedAt||e.published)||v.is_playable!==true){await record('HOLD_IDENTITY');continue;}
   const meta=await client.metadata(plan.playlistId);if(meta.status!=='OK'||meta.body?.snapshot_id!==s.snapshotId){await record('HOLD_PLAYLIST_CHANGED',{failure:meta.status});return finish('HOLD_PLAYLIST_CHANGED');}
   // Durable reservation MUST complete before network mutation. Crashes never blindly repost.
   await record('RESERVED',{planHash:planHash(plan),snapshotId:s.snapshotId});
   const posted=await client.addVerifiedItems({playlistId:plan.playlistId,spotifyIds:[e.spotifyId],explicitApproval:true,verifiedSnapshot:true});
   if(posted.status==='RETRY_LATER'){
    const raw=posted.retryAfter,delay=/^\d+$/.test(raw||'')?Number(raw)*1000:Date.parse(raw)-now();
    if(!Number.isFinite(delay)){await record('HOLD_RETRY_AFTER_MISSING');return finish('HOLD_RETRY_AFTER_MISSING');}
    await record('RETRY_LATER',{retryAt:now()+Math.max(1000,delay)});return finish('RETRY_LATER');
   }
   if(posted.status!=='SUBMITTED'){await record('HOLD_POST',{failure:posted.status,evidence:posted.evidence});return finish('HOLD_POST',{failure:posted.status});}
   const readback=await client.stableSnapshot(plan.playlistId);
   if(!readback.complete||!readback.episodeUrls.includes('https://open.spotify.com/episode/'+e.spotifyId)){await record('HOLD_READBACK',{failure:readback.status});return finish('HOLD_READBACK');}
   await record('ADDED',{snapshotId:readback.snapshotId});
  }
  return finish('COMPLETE');
 }finally{await lock.release(key);}
}
/** Creation is separate from adding episodes. No automatic retry after an uncertain POST. */
export async function createLibraryPlaylist({name,operationId,client,journal,lock,approval={}}={}){
 if(approval.explicitCreate!==true||approval.name!==name||!operationId||journal?.durable!==true||!lock)return {status:'HOLD_NOT_APPROVED'};
 const key='create:'+operationId;if(!await lock.acquire('create-playlist'))return {status:'BUSY'};
 try{const prior=await journal.get(key);if(prior)return {status:'HOLD_PRIOR_CREATE',prior};
  await journal.put(key,{status:'RESERVED',name});const result=await client.createPrivatePlaylist({name,explicitApproval:true});
  let status='HOLD_CREATE';if(result.status==='CREATED_REQUIRES_READBACK'){const read=await client.metadata(result.playlistId);if(read.status==='OK'&&read.body?.id===result.playlistId&&read.body.snapshot_id)status='CREATED';}
  await journal.put(key,{status,playlistId:result.playlistId||null,failure:result.status});return {status,playlistId:result.playlistId||null};
 }finally{await lock.release('create-playlist');}
}
