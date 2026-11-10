/** Shared planning entry for past-library enrichment and new RSS episodes.
 * PURE READ_ONLY: no spreadsheet, GAS, Properties, network, or timer operations.
 * Requires caller to attest exact identity status and supply an already parsed RSS item.
 * Does not replace existing V3 ingest/append; it prepares a common proposal envelope.
 */
import {planArchive,parseRelatedLinks} from './library-v3-archive-core.mjs';
const SHOWS=new Set(['ニュースの学校','ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ドーナツ','報談']);
const norm=x=>String(x==null?'':x).trim();
function planUnifiedEpisode({show,episode,ledger=null,identityStatus,sourceHash,observedAt=null,excluded=false,conflict=false,knownKeys=[]}={}){
 const e=episode||{},guid=norm(e.guid),rss=norm(e.rssUrl),raw=String(e.descriptionRaw==null?'':e.descriptionRaw),epId=norm(ledger?.epId);
 if(!SHOWS.has(show))return {status:'OUT_OF_SCOPE',route:'NONE',writes:0};
 if(excluded||conflict||['AMBIGUOUS','EXCLUDED','DELETED'].includes(identityStatus))return {status:'HOLD_PROTECTED',route:'NONE',writes:0};
 if(!guid||!/^https:\/\//.test(rss)||!sourceHash||!raw)return {status:'HOLD_SOURCE_INCOMPLETE',route:'NONE',writes:0};
 if(ledger){
  if(identityStatus!=='EXACT'||!epId)return {status:'HOLD_IDENTITY',route:'PAST',writes:0};
  const archive=planArchive({epId,guid,raw,sourceHash,sourceUrl:rss,observedAt,existingRaw:ledger.descriptionRaw,existingVersionKeys:knownKeys,identityConfirmed:true});
  return {status:archive.status,route:'PAST',epId,guid,archive,links:parseRelatedLinks(raw),writes:0,
   existingRawProtected:true,existingCleanProtected:true};
 }
 // no match is NOT sufficient proof that this is a new episode.
 if(identityStatus!=='VERIFIED_NEW')return {status:'HOLD_UNMATCHED',route:'NEW',writes:0};
 return {status:'NEW_EPISODE_CANDIDATE',route:'NEW',epId:null,guid,
  source:{raw,sourceHash,rssUrl:rss,audioUrl:norm(e.audioUrl),title:norm(e.title),published:norm(e.published),observedAt},
  links:parseRelatedLinks(raw),writes:0,requiresAppendApproval:true};
}
export {planUnifiedEpisode};
