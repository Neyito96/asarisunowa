/**
 * Issue #231 — shared playlist subscription lifecycle.
 * Pure transition planner. No spreadsheet, Spotify, GAS or GitHub writes.
 *
 * User-facing commands:
 * /自動登録復帰 : HUMAN_DELETED -> RESTORE_PENDING (never silently ENABLED)
 * /自動登録停止 : ENABLED -> STOPPED
 * /自動登録確認 : RESTORE_PENDING -> ENABLED only after explicit checks
 *
 * "人間削除" on a subscription is distinct from human-removed episode IDs.
 * Neither transition clears exclusionHistory, manualRemovals or tombstones.
 */
const COMMANDS=Object.freeze({
 '/自動登録復帰':'RESTORE_REQUEST',
 '/自動登録停止':'STOP_REQUEST',
 '/自動登録確認':'RESTORE_CONFIRM'
});
function planSubscriptionCommand({command,subscription,checks={}}={}){
 const action=COMMANDS[String(command||'').trim()];
 if(!action)return {status:'HOLD_UNKNOWN_COMMAND',writes:0};
 if(!subscription||typeof subscription!=='object')return {status:'HOLD_NO_SUBSCRIPTION',writes:0};
 const playlistId=String(subscription.playlistId||'');
 if(!/^[A-Za-z0-9]{22}$/.test(playlistId))return {status:'HOLD_INVALID_PLAYLIST',writes:0};
 const oldStatus=String(subscription.status||'');
 const original={...subscription};
 const keep={exclusionHistory:original.exclusionHistory,manualRemovals:original.manualRemovals,tombstones:original.tombstones};
 let nextStatus,reason;
 if(action==='RESTORE_REQUEST'){
  if(!['人間削除','HUMAN_DELETED','STOPPED','取消'].includes(oldStatus))
   return {status:'HOLD_NOT_STOPPED',playlistId,writes:0};
  nextStatus='復帰申請中';reason='CHECK_AUTH_AND_HISTORY';
 }else if(action==='STOP_REQUEST'){
  if(!['増分自動更新','ENABLED','復帰申請中'].includes(oldStatus))
   return {status:'HOLD_NOT_ACTIVE',playlistId,writes:0};
  nextStatus='停止';reason='STOP_NEW_ADDITIONS';
 }else{
  if(oldStatus!=='復帰申請中')return {status:'HOLD_NOT_PENDING',playlistId,writes:0};
  const required=['explicitOwnerApproval','spotifyPermissionVerified','playlistSnapshotVerified','manualRemovalHistoryPreserved','episodeIdentityVerified'];
  const missing=required.filter(k=>checks[k]!==true);
  if(missing.length)return {status:'HOLD_CHECKS_INCOMPLETE',playlistId,missing,writes:0};
  nextStatus='増分自動更新';reason='READY_FOR_SEPARATE_WRITE_APPROVAL';
 }
 const next={...original,status:nextStatus,...keep};
 return {status:'READ_ONLY_TRANSITION_PROPOSAL',command,playlistId,previousStatus:oldStatus,
  proposedStatus:nextStatus,reason,proposedRecord:next,writes:0,
  spotifyWrites:0,spreadsheetWrites:0,siteWrites:0,triggerChanges:0};
}
export {planSubscriptionCommand};
