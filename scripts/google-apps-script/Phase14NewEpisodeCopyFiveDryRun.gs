/**
 * COPY newest five episodes: dry-run of production formatter.
 * No new IDs, writes, triggers, or changes. Run in production GAS.
 * REPORT ONLY: unmapped new formats are expected NEEDS_REVIEW.
 */
function phase14NewEpisodeCopyFiveDryRun(){
 const expected='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV';
 if(ScriptApp.getScriptId()!==expected)throw Error('WRONG_SCRIPT');
 if(typeof P14NewEpisodeFormatter==='undefined')throw Error('FORMATTER_NOT_LOADED');
 const ss=SpreadsheetApp.openById('1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY');
 const sh=ss.getSheetByName('エピソード台帳');
 if(!sh)throw Error('COPY_LEDGER_NOT_FOUND');
 const data=sh.getRange(6628,1,5,55).getDisplayValues();
 const ids=['EP-06627','EP-06628','EP-06629','EP-06630','EP-06631'];
 const expectedGuids=['08e40b40-d56b-4f22-be57-b4dc00603b13','24fc4a82-ceb4-11f1-8144-abc7c06c50b6','b0a84ffa-cebd-11f1-a5ab-17a6f304129c','df9ffb68-6f44-45b1-9331-b4e2007caa71','f8906ca4-3861-4eb8-83b8-b4eb008e0422'];
 const rows=data.map((r,i)=>{
  if(r[0]!==ids[i]||r[6]!==expectedGuids[i])throw Error('COPY_IDENTITY_CHANGED '+i);
  const v=r[21]||'',f=P14NewEpisodeFormatter.format(v);
  const oldW=r[22]||'',oldNames=r.slice(45,50).filter(Boolean);
  const out={epId:r[0],program:r[1],title:r[2],
    overview:f.overview.status,method:f.overview.method,
    cleanedPreview:f.fields.W.slice(0,1200),
    cast:f.cast.status,names:f.cast.people,
    currentNames:oldNames,sourceX:r[23].slice(0,400),
    existingWPromotion:/PODCAST MEETING|スタンダードコース|discord|ad choices|番組フォロー/i.test(oldW),
    wouldNeedReview:!f.readyForAutoWrite,writes:0};
  console.log(JSON.stringify({mode:'NEW_COPY_EPISODE_PREVIEW',...out}));
  return out;
 });
 const result={mode:'COPY_FIVE_DRY_RUN',inspected:rows.length,
   overviewConfident:rows.filter(r=>r.overview==='CLEAN_CONFIDENT').length,
   castConfident:rows.filter(r=>r.cast==='CAST_CONFIDENT').length,
   held:rows.filter(r=>r.wouldNeedReview).map(r=>r.epId),
   status:'READ_ONLY',writes:0,triggerChanges:0};
 console.log(JSON.stringify(result));return result;
}
