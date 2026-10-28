'use strict';
// Phase15 COPY-only GAS entrypoints. Install into a standalone COPY-only project.
// Production ID is denied; no triggers are created.
const P15_COPY_ID='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
const P15_PROD_ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P15_TEST_TAB='P15_WRITER_COPY_TEST_20261028';
function p15CopyRead_(){
 if(P15_COPY_ID===P15_PROD_ID)throw Error('STOP_PRODUCTION');
 return SpreadsheetApp.openById(P15_COPY_ID).getSheetByName(P15_TEST_TAB);
}
function p15CopyDryRun(){
 const sh=p15CopyRead_(),v=sh.getDataRange().getValues(),guids=new Set(),duplicates=[];
 v.slice(1).filter(r=>r[0]==='LEDGER').forEach(r=>{if(guids.has(r[1]))duplicates.push(r[1]);guids.add(r[1])});
 return {existingLedger:guids.size,duplicates,writeCount:0};
}
function p15CopyIngestFixtures(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('STOP_LOCK');
 try{
  const sh=p15CopyRead_(),rows=sh.getDataRange().getValues(),all=new Set(rows.slice(1).map(r=>String(r[1])));
  const fixtures=[['LEDGER','p15-copy-test-20261028-a','TEST-P15-001','模擬新着A','REGISTERED','RUN_AUTO'],['LEDGER','p15-copy-test-20261028-b','TEST-P15-002','模擬新着B','REGISTERED','RUN_AUTO']];
  let inserted=0;
  for(const row of fixtures){if(all.has(row[1]))continue;sh.appendRow(row);all.add(row[1]);inserted++}
  return {inserted,skipped:fixtures.length-inserted};
 }finally{lock.releaseLock()}
}
function p15CopyFaultGate(){
 const rows=p15CopyRead_().getDataRange().getValues();
 if(rows.some(r=>r[0]==='FAULT'&&r[4]==='RESERVED_NOT_APPENDED'))throw Error('STOP_RECONCILE_REQUIRED');
 return {ok:true};
}
