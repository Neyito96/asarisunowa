// COPY-only 100-row V -> W cleaning batch. Does not fetch official RSS.
// Set cursor to 2 initially. Next call resumes from saved cursor.
// Requires standalone GAS project; no trigger creation, no production access.
const P15_CLEAN_COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
const P15_CLEAN_PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P15_CLEAN_TAB='P15_BACKFILL_100_COPY_20261028';
const P15_CLEAN_CURSOR='P15_COPY_CLEAN_CURSOR_V1';
function p15CleanText_(html){
 return String(html).replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|li)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\n{3,}/g,'\n\n').trim();
}
function p15CleanCopy100(){
 if(P15_CLEAN_COPY===P15_CLEAN_PROD)throw Error('STOP_PRODUCTION');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('STOP_LOCK');
 try{
  const sh=SpreadsheetApp.openById(P15_CLEAN_COPY).getSheetByName(P15_CLEAN_TAB);
  if(!sh)throw Error('STOP_COPY_TAB_MISSING');
  const props=PropertiesService.getScriptProperties(),start=Math.max(2,Number(props.getProperty(P15_CLEAN_CURSOR))||2),last=Math.min(sh.getLastRow(),start+99);
  if(start>last)return {processed:0,filledCells:0,nextCursor:start};
  const rows=sh.getRange(start,1,last-start+1,6).getValues();let filled=0;
  for(let i=0;i<rows.length;i++){
   const row=rows[i];if(!row[0]||!row[1]||!row[2]||row[3])continue;
   const value=p15CleanText_(row[2]);if(!value)continue;
   const cell=sh.getRange(start+i,4);if(cell.getValue()!=='')continue;
   cell.setValue(value);filled++;
  }
  props.setProperty(P15_CLEAN_CURSOR,String(last+1));
  return {processed:rows.length,filledCells:filled,nextCursor:last+1};
 }finally{lock.releaseLock();}
}
