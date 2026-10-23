/** End-to-end READ_ONLY candidate projection for existing and verified-new episodes.
 * Functions supplied by caller are the tested V3 content clean/person extraction routines.
 * Never mutates ledger data, never persists proposals or invokes the V3 writer.
 */
import {planUnifiedEpisode} from './library-v3-unified-planner.mjs';
function previewFullEpisode(input,handlers){
 const i=input||{},h=handlers||{},episode=i.episode||{};
 if(typeof h.clean!=='function'||typeof h.extractPeople!=='function')throw Error('V3 CLEAN_AND_PEOPLE_REQUIRED');
 const route=planUnifiedEpisode(i);
 if(!['PAST','NEW'].includes(route.route)||!['ARCHIVE_SNAPSHOT_CANDIDATE','ARCHIVE_ALTERNATE_CANDIDATE','NEW_EPISODE_CANDIDATE','ALREADY_ARCHIVED'].includes(route.status))
   return {...route,proposal:null};
 const raw=String(episode.descriptionRaw);
 const clean=h.clean(raw,i.show);
 const people=h.extractPeople({description:raw,people:episode.people||[],cast:episode.cast||''});
 if(!clean||typeof clean.text!=='string'||clean.originalPreserved!==true)throw Error('UNSAFE_CLEAN_RESULT');
 if(!people||!Array.isArray(people.speakers)||!Array.isArray(people.people))throw Error('INVALID_CAST_EVIDENCE');
 const oldRaw=i.ledger?String(i.ledger.descriptionRaw??''):null;
 const safeCleanForExisting=!i.ledger||oldRaw===raw||oldRaw==='';
 const existingClean=i.ledger?String(i.ledger.clean??''):'';
 const cleanCandidate=(!clean.hold&&safeCleanForExisting&&existingClean===''&&clean.text!=='')?clean.text:null;
 const rawCandidate=(!i.ledger||oldRaw==='')?raw:null;
 const evidence={people:people.people,speakers:people.speakers,reviews:people.reviews||[],links:route.links||[]};
 return {...route,proposal:{epId:route.epId||null,guid:route.guid,rawCandidate,cleanCandidate,rawFull:raw,cleanFull:clean.text,cleanRule:clean.ruleVersion,removed:clean.removed||[],cleanReview:clean.review||[],
  evidence,sourceHash:i.sourceHash,holdReasons:[...(clean.hold?['CLEAN_REVIEW_REQUIRED']:[]),...(!safeCleanForExisting?['RAW_VERSION_MISMATCH_CLEAN_HELD']:[]),
  ...(existingClean?['EXISTING_W_PROTECTED']:[])],
  existingVProtected:!!oldRaw,existingWProtected:!!existingClean,requiresApproval:true,writes:0}};
}
export {previewFullEpisode};
