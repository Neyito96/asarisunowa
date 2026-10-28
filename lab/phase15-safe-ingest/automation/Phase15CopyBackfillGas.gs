// COPY-only Phase15 backfill. No triggers; never open production sheet.
const P15_BF_COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
const P15_BF_PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P15_BF_TAB='P15_BACKFILL_COPY_20261028';
const P15_BF_SOURCE='https://omny.fm/shows/asahi/playlists';
const P15_BF_DURATIONS={'EP-06634':800,'EP-06635':2270,'EP-06636':2088,'EP-06640':1571};
function p15CopyBackfillDurations(){
 if(P15_BF_COPY===P15_BF_PROD)throw Error('STOP_PRODUCTION');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('STOP_LOCK');
 try{
  const sh=SpreadsheetApp.openById(P15_BF_COPY).getSheetByName(P15_BF_TAB);
  if(!sh)throw Error('STOP_COPY_TAB_MISSING');
  const vals=sh.getDataRange().getValues();let rows=0,cells=0;
  for(let i=1;i<vals.length;i++){
   const r=vals[i],secs=P15_BF_DURATIONS[r[0]];
   if(!secs||!r[3]||!/^https:\/\/omny\.fm\/shows\/asahi\//.test(String(r[4]||'')))continue;
   const updates=[[5,secs],[6,P15_BF_SOURCE],[7,'公式Omny掲載時間から換算／COPY試験']].filter(([col])=>r[col]===''||r[col]===null);
   if(!updates.length)continue;
   for(const [col,val] of updates)sh.getRange(i+1,col+1).setValue(val);
   rows++;cells+=updates.length;
  }
  return {processed:vals.length-1,changedRows:rows,filledCells:cells,existingOverwrites:0};
 }finally{lock.releaseLock()}
}
