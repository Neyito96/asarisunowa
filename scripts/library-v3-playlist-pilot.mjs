/** Exact one-episode approval runner. No OAuth setup, refresh or token logging. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {makeSpotifyPlaylistClient} from './library-v3-spotify-playlist-client.mjs';
import {executeLibraryPlaylistPlan,planHash,APPROVED_TEST_PLAYLIST_ID as PID} from './library-v3-playlist-executor.mjs';
import {openPlaylistJournal} from './library-v3-playlist-journal.mjs';
export const PILOT_HASH='e147bc8ee91e390960baa3f74acb28b81f27c0c118777bd1d3af8ed4f441f2fe';
const SID='6opJ4Ig4s7CTY9fRqGEHd2',NAME='リス田｜自動更新テスト',URI='spotify:episode:'+SID;
/** Provider supplies the existing user token in memory, never via chat or argv.
 * grantedScopes must be actual recorded token grants, not requested OAuth scopes. */
export async function runPilot({plan,auth,fetchImpl=globalThis.fetch,journal,execute=false,persist=async()=>{},now=()=>new Date().toISOString()}={}){
 const report={startedAt:now(),epId:'EP-00004',uri:URI,playlistId:PID,playlistName:NAME,planHash:PILOT_HASH,status:'NOT_EXECUTED',beforeCount:null,afterCount:null,readback:null,replayAdded:null,postAttempts:0,confirmedAdded:null,forbidden:null,api:[]};
 const save=async()=>persist(structuredClone(report));
 const end=async status=>{report.status=status;report.finishedAt=now();await save();return report;};
 if(planHash(plan)!==PILOT_HASH||plan?.ready?.[0]?.epId!=='EP-00004'||plan.ready[0].uri!==URI)return end('HOLD_PLAN_CHANGED');
 if(!auth?.accessToken)return end('AUTH_ROUTE_UNAVAILABLE');
 let halted=false;
 const guarded=async(url,options={})=>{
  if(halted)throw Error('STOPPED');
  const u=new URL(url),method=options.method||'GET';
  const allowed=u.origin==='https://api.spotify.com'&&(
   method==='GET'&&[ '/v1/me','/v1/playlists/'+PID,'/v1/playlists/'+PID+'/items','/v1/episodes/'+SID].includes(u.pathname)||
   method==='POST'&&u.pathname==='/v1/playlists/'+PID+'/items'&&execute&&report.postAttempts===0&&options.body===JSON.stringify({uris:[URI]}));
  if(!allowed){halted=true;throw Error('REQUEST_OUTSIDE_APPROVAL');}
  const event={at:now(),method,endpoint:u.pathname,query:u.search,httpStatus:null};
  if(method==='POST')report.postAttempts++;
  report.api.push(event);await save(); // No network mutation if the receipt cannot persist.
  let r;try{r=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{halted=true;event.failure=method==='POST'?'POST_UNCERTAIN':'NETWORK_ERROR';await save();throw Error('TRANSPORT_STOP');}
  event.httpStatus=r.status;report.forbidden=report.forbidden===true||r.status===403;
  if(!r.ok)halted=true;await save();return r;
 };
 const get=async path=>{const r=await guarded('https://api.spotify.com/v1'+path,{headers:{Authorization:'Bearer '+auth.accessToken}});if(!r.ok)return null;return r.json();};
 const stopped=()=>report.forbidden?'STOP_403':report.api.at(-1)?.httpStatus===401?'STOP_401':report.api.at(-1)?.httpStatus===429?'STOP_429':'HOLD_API';
 try{
  const me=await get('/me');if(!me)return end(stopped());
  const playlist=await get('/playlists/'+PID+'?fields=id,name,owner(id),public,collaborative,snapshot_id');if(!playlist)return end(stopped());
  report.ownerVerified=!!me.id&&playlist.owner?.id===me.id;
  report.scopeVerified=Array.isArray(auth.grantedScopes)&&auth.grantedScopes.includes('playlist-read-private')&&auth.grantedScopes.includes(playlist.public?'playlist-modify-public':'playlist-modify-private');
  if(playlist.id!==PID||playlist.name!==NAME||typeof playlist.public!=='boolean'||!report.ownerVerified)return end('HOLD_TARGET_OR_OWNER');
  const client=makeSpotifyPlaylistClient({accessToken:auth.accessToken,fetchImpl:guarded});
  const before=await client.stableSnapshot(PID);if(!before.complete)return end(halted?stopped():'HOLD_BEFORE_SNAPSHOT');
  report.beforeCount=before.total;report.beforeSnapshot=before.snapshotId;report.alreadyPresent=before.episodeUrls.includes('https://open.spotify.com/episode/'+SID);await save();
  if(!execute)return end('PREFLIGHT_ONLY');
  if(!report.scopeVerified)return end('HOLD_GRANTED_SCOPES_UNKNOWN');
  const args={plan,client,journal,lock:journal,approval:{explicit:true,planHash:PILOT_HASH,maxItems:1}};
  report.first=await executeLibraryPlaylistPlan(args);await save();
  if(halted)return end(stopped());
  if(!['ADDED','OBSERVED','ALREADY_HANDLED'].includes(report.first.history.at(-1)?.status))return end('HOLD_EXECUTOR');
  const after=await client.stableSnapshot(PID);if(!after.complete)return end(halted?stopped():'HOLD_READBACK');
  report.afterCount=after.total;report.afterSnapshot=after.snapshotId;report.readback=after.episodeUrls.includes('https://open.spotify.com/episode/'+SID);
  if(!report.readback||after.total!==before.total+(report.postAttempts===1?1:0))return end('HOLD_READBACK_OR_COUNT');
  report.confirmedAdded=report.postAttempts===1?1:0;await save();
  const posts=report.postAttempts;
  report.replay=await executeLibraryPlaylistPlan(args);
  report.replayAdded=report.postAttempts-posts;await save();
  const final=await client.stableSnapshot(PID);if(!final.complete)return end(halted?stopped():'HOLD_REPLAY_READBACK');
  report.replayReadback=final.episodeUrls.includes('https://open.spotify.com/episode/'+SID);
  if(report.replay.history.at(-1)?.status!=='ALREADY_HANDLED'||report.replayAdded!==0||!report.replayReadback||final.total!==after.total)return end('HOLD_REPLAY');
  return end('VERIFIED');
 }catch{return end(report.forbidden?'STOP_403':'HOLD_EXCEPTION_NO_RETRY');}
}
async function main(){
 const mode=process.argv[2];if(!['--preflight','--execute-approved'].includes(mode)||process.argv.length>4)throw Error('Use --preflight|--execute-approved [absolute-existing-auth-provider.mjs]');
 const provider=process.argv[3];if(provider&&!provider.startsWith('/'))throw Error('AUTH_PROVIDER_MUST_BE_ABSOLUTE');
 const out=resolve(process.env.HOME,'asarisunowa-spotify-pilot-EP-00004');await mkdir(out,{recursive:true,mode:0o700});
 const plan=JSON.parse(await readFile(new URL('../docs/audits/2026-10-22-spotify-pilot/plan.json',import.meta.url)));
 let auth=null;
 if(provider){try{const mod=await import(pathToFileURL(provider).href);auth=await mod.getExistingSpotifyAuth();}catch{console.error('Existing authentication provider unavailable; no Spotify request sent.');}}
 const journal=await openPlaylistJournal(join(out,'journal'));
 const receipt=join(out,'result-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
 const report=await runPilot({plan,auth,journal,execute:mode==='--execute-approved',persist:r=>writeFile(receipt,JSON.stringify(r,null,2)+'\n',{mode:0o600})});
 console.log(JSON.stringify(report,null,2));if(report.status!=='VERIFIED'&&report.status!=='PREFLIGHT_ONLY')process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Local pilot preparation failed; do not retry a potentially submitted POST. Preserve journal.');process.exitCode=2;});
