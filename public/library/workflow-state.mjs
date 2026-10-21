// Shared evidence/state helpers for existing V3 Morning + submission adapters.
// Pure functions: no collector, credentials, scheduler or Spotify writer.
import {normal} from './library-core.mjs';
export const stages=['received_at','validated_at','library_matched_at','spotify_updated_at','site_published_at'];
export function statusLabel(record) {
 const latestSuccess=Math.max(...stages.map(k=>Date.parse(record[k])||0));
 if(record.hold_reason||record.failed_at&&(!Number.isFinite(Date.parse(record.failed_at))||Date.parse(record.failed_at)>=latestSuccess))return '要確認';
 if(record.site_published_at)return 'サイト反映済み';
 if(record.spotify_updated_at)return 'Spotify反映済み';
 if(record.validated_at||record.library_matched_at)return '確認中';
 return record.received_at?'受付済み':'下書き';
}
export function advance(record,stage,at,evidence={}) {
 if(!stages.includes(stage)&&stage!=='failed_at')throw Error('Unknown stage');
 if(!Number.isFinite(Date.parse(at)))throw Error('Invalid time');
 if(record[stage]){if(record[stage]!==at)throw Error('Conflicting replay');return {...record};}
 if(stage!=='received_at'&&!record.received_at)throw Error('Receipt required');
 if(stage==='library_matched_at'&&!record.validated_at)throw Error('Validation required');
 if(stage==='spotify_updated_at'&&(!record.library_matched_at||!evidence.apiSuccess||!evidence.membershipReadback))throw Error('Spotify API success and membership readback required');
 if(stage==='site_published_at'&&(!record.validated_at||!evidence.publicReadback||record.kind==='new-episode'&&!record.spotify_updated_at))throw Error('Actual public evidence required');
 const last=Object.entries(record).filter(([k,v])=>(stages.includes(k)||k==='failed_at')&&v).map(([,v])=>Date.parse(v));
 if(last.some(t=>t>Date.parse(at)))throw Error('Time regression');
 return {...record,[stage]:at};
}
export function latencyMetrics(records) {
 const accepted=records.filter(r=>r.received_at),times=accepted.filter(r=>r.site_published_at).map(r=>Date.parse(r.site_published_at)-Date.parse(r.received_at)).filter(t=>Number.isFinite(t)&&t>=0).sort((a,b)=>a-b);
 const n=times.length,median=n?(n%2?times[(n-1)/2]:(times[n/2-1]+times[n/2])/2):null;
 return {received:accepted.length,completed:n,medianMs:median,p90Ms:n?times[Math.ceil(.9*n)-1]:null,failureRate:accepted.length?accepted.filter(r=>r.failed_at).length/accepted.length:null,unmeasured:!n};
}
export function spotifyFailure(code) {return code===401?'AUTH_EXPIRED':code===403?'PERMISSION_DENIED':code===429?'RATE_LIMITED':code>=500?'PROVIDER_UNAVAILABLE':'FETCH_FAILED';}
export function libraryCandidate(episode,rule,humanDecision) {
 if(humanDecision==='除外'||humanDecision==='保留'||episode.excluded)return {eligible:false,reason:'HUMAN_DECISION'};
 if(rule.shows?.length&&!rule.shows.includes(episode.show))return {eligible:false,reason:'SHOW'};
 const text=normal([episode.title,episode.description,episode.cast,...(episode.relatedArticles||[]).map(a=>a.title),...(episode.tags||[])].join(' '));
 const matched=(rule.keywords||[]).filter(k=>text.includes(normal(k)));
 return {eligible:matched.length>0,matched,humanDecision:humanDecision||'未確認',proposalOnly:true,spotifyId:String(episode.spotifyUrl||'').match(/^https:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#]|$)/)?.[1]||null,reason:matched.length?'LIBRARY_EVIDENCE':'NO_EVIDENCE'};
}
