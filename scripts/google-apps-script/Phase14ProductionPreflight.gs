/**
 * Phase14 production preflight. READ ONLY.
 * Deploy to a dedicated production Apps Script project.
 * This does not install triggers, modify Properties, or write to Sheets.
 */
const P14_PROD_LEDGER_ID = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P14_COPY_LEDGER_ID = '1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
function phase14ProductionPreflightReadOnly(){
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(1000)) return {status:'BUSY',writes:0};
  try {
    const ss=SpreadsheetApp.openById(P14_PROD_LEDGER_ID);
    const sheet=ss.getSheetByName('エピソード台帳');
    const states=ss.getSheetByName('図書館V3・項目状態');
    const history=ss.getSheetByName('固定ID採番履歴');
    if(!sheet||!states||!history) throw Error('REQUIRED_SHEETS_MISSING');
    const headers=sheet.getRange(1,1,1,55).getDisplayValues()[0];
    if(headers.length!==55||headers[0]!=='台帳ID'||headers[6]!=='外部ID')
      throw Error('LEDGER_HEADER_MISMATCH');
    const n=sheet.getLastRow();
    const data=sheet.getRange(2,1,n-1,7).getDisplayValues();
    const historyData=history.getRange(2,1,Math.max(1,history.getLastRow()-1),2).getDisplayValues();
    const historyMap=new Map();
    for(const h of historyData) if(h[1]) {
      if(historyMap.has(h[1])) throw Error('DUPLICATE_HISTORY_EP_ID '+h[1]);
      historyMap.set(h[1],h[0]);
    }
    const recent=data.filter(r=>/^EP-0(65|66)/.test(r[0])&&Number(r[0].slice(3))>=6593);
    const guidMismatch=recent.filter(r=>historyMap.has(r[0])&&historyMap.get(r[0])!==r[6]).map(r=>r[0]);
    const missingHistory=recent.filter(r=>!historyMap.has(r[0])).map(r=>r[0]);
    const stateIds=states.getRange(2,1,Math.max(1,states.getLastRow()-1),1).getDisplayValues().map(r=>r[0]);
    const missingStates=recent.filter(r=>!stateIds.includes(r[0])).map(r=>r[0]);
    const report={
      mode:'PRODUCTION_READ_ONLY',scriptId:ScriptApp.getScriptId(),
      ledgerId:P14_PROD_LEDGER_ID,total:data.length,
      lastId:data[data.length-1]?.[0],
      reviewed:recent.length,missingHistory,guidMismatch,missingStates,
      triggerHandlers:ScriptApp.getProjectTriggers().map(t=>t.getHandlerFunction()),
      status:missingHistory.length||guidMismatch.length||missingStates.length?'BLOCKED':'READY_FOR_NEXT_REVIEW',
      writes:0,triggerChanges:0,propertyWrites:0
    };
    console.log(JSON.stringify(report));return report;
  } finally {lock.releaseLock();}
}
