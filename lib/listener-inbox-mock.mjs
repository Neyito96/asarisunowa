// Local contract test double only. Trusted actor claims must come from a real
// server authentication adapter before this can be used for intake.
import {advance,latencyMetrics,statusLabel} from '../public/library/workflow-state.mjs';
export function createListenerInboxMock(){
 const jobs=new Map();
 return {
  receive(input,actor,at){
   if(!actor?.verified||!actor.id)throw Error('Authenticated actor required');
   if(!['recommend','change-theme'].includes(input.kind)||!/^EP-\d{5}$/.test(input.episodeId)||!input.theme||!String(input.reason||'').trim()||input.reason.length>1000||!/^[A-Za-z0-9_-]{8,80}$/.test(input.key||''))throw Error('Invalid submission');
   const payload={kind:input.kind,episodeId:input.episodeId,theme:String(input.theme).slice(0,80),reason:input.reason.trim()},key=actor.id+':'+input.key;
   const old=jobs.get(key);if(old){if(JSON.stringify(old.payload)!==JSON.stringify(payload))throw Error('Idempotency conflict');return structuredClone(old);}
   const job={...advance({kind:'listener-submission'},'received_at',at),payload,owner:actor.id,storage:'LOCAL_MOCK',externalEffects:0,moderation:'pending'};
   jobs.set(key,job);return structuredClone(job);
  },
  review(key,owner,decision,actor,at,humanDecision=''){
   if(!actor?.verified||!['administrator','editor'].includes(actor.role))throw Error('Moderator role required');
   const job=jobs.get(owner+':'+key);if(!job)throw Error('Not found');
   if(!['accept','exclude','hold'].includes(decision))throw Error('Invalid decision');
   if(['除外','保留'].includes(humanDecision)&&decision==='accept')throw Error('Existing human decision protected');
   const next=advance(job,'validated_at',at);next.moderation=decision;
   if(decision!=='accept')next.hold_reason='MODERATION_'+decision.toUpperCase();
   jobs.set(owner+':'+key,next);return structuredClone(next);
  },
  own(actor){if(!actor?.verified)throw Error('Authenticated actor required');return structuredClone([...jobs.values()].filter(j=>j.owner===actor.id).map(j=>({...j,label:statusLabel(j)})));},
  metrics(){return latencyMetrics([...jobs.values()]);}
 };
}
