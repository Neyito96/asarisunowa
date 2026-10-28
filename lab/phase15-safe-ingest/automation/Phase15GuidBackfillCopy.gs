// Phase15: standalone COPY-only metadata backfill, no production writes or triggers.
// Input source: trusted RSS/JSON objects from existing Phase14 fetcher, with guid and provenance.
const P15BF_COPY_ID='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
const P15BF_PROD_ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P15BF_TAB='エピソード台帳';
const P15BF_COLUMNS={imageUrl:14,audioUrl:15,duration:16,descriptionRaw:22,descriptionClean:23,cast:24,castEvidence:51};
function p15GuidBackfillCopy(sourceByGuid, startRow, limit) {
 if(P15BF_COPY_ID===P15BF_PROD_ID)throw Error('STOP_PRODUCTION');
 if(!sourceByGuid||typeof sourceByGuid!=='object')throw Error('STOP_SOURCE');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(10000))throw Error('STOP_LOCK');
 try {
  const sheet=SpreadsheetApp.openById(P15BF_COPY_ID).getSheetByName(P15BF_TAB);
  if(!sheet)throw Error('STOP_SHEET');
  const first=Math.max(2,Number(startRow)||2),count=Math.min(20,Math.max(1,Number(limit)||5));
  const last=Math.min(sheet.getLastRow(),first+count-1);
  if(last<first)return {processed:0,filledCells:0,nextRow:first};
  const values=sheet.getRange(first,1,last-first+1,55).getValues();
  let filled=0,changedRows=0,skipped=0;
  for(let i=0;i<values.length;i++){
   const row=values[i],guid=String(row[6]||'').trim().toLowerCase(),src=sourceByGuid[guid];
   if(!src||String(src.guid||'').trim().toLowerCase()!==guid||!src.officialSourceUrl){skipped++;continue;}
   if(/AJW|アルキキ|YouTube/i.test(String(row[1])+' '+String(row[5]))){skipped++;continue;}
   let rowChanges=0;
   for(const [key,col] of Object.entries(P15BF_COLUMNS)){
    const value=src[key];
    if(value===undefined||value===null||value==='')continue;
    if(row[col-1]!==''&&row[col-1]!==null)continue;
    if(key==='duration'&&(!Number.isInteger(value)||value<=0))continue;
    if((key==='audioUrl'||key==='imageUrl')&&!/^https:\/\//.test(String(value)))continue;
    sheet.getRange(first+i,col).setValue(value);
    rowChanges++;filled++;
   }
   if(rowChanges)changedRows++;
  }
  return {processed:values.length,changedRows,filledCells:filled,skipped,nextRow:last+1};
 }finally{lock.releaseLock();}
}
