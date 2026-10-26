/**
 * New-ingest V -> W cleaning, regression test on EP-06625.
 * Preview does not write. Apply edits W6626 only; V is never changed.
 * This is a guarded regression pilot, NOT general-purpose processing.
 */
const P14_VW_PILOT = Object.freeze({
  scriptId:'1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV',
  ledgerId:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
  row:6626,id:'EP-06625',guid:'aca6c2d2-6291-4bd5-801a-b4eb00651c0d'
});
function phase14VWExtractBody_(html) {
  const begin='【番組内容】',end='【関連記事】';
  const b=html.indexOf(begin),e=html.indexOf(end,b+begin.length);
  if(b<0||e<=b||html.indexOf(begin,b+1)>=0)throw Error('BODY_SECTION_UNSAFE');
  let section=html.slice(b+begin.length,e);
  section=section.replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<\/p>/gi,'\n').replace(/<[^>]*>/g,'')
    .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .split('\n').map(x=>x.trim()).filter(Boolean).join('\n\n');
  if(section.length<90||section.length>1200||
     !section.includes('大阪・関西万博の閉幕から1年')||
     !section.includes('※2026年10月21日に収録しました。')||
     /PODCAST MEETING|スタンダードコース|会員登録をお願いします/.test(section))
    throw Error('EXTRACTED_BODY_FAILED_QUALITY_GUARD');
  return section;
}
function phase14VWRead_(){
  const t=P14_VW_PILOT;
  if(ScriptApp.getScriptId()!==t.scriptId)throw Error('WRONG_SCRIPT');
  const sh=SpreadsheetApp.openById(t.ledgerId).getSheetByName('エピソード台帳');
  if(!sh)throw Error('SHEET_NOT_FOUND');
  const h=sh.getRange(1,22,1,2).getDisplayValues()[0];
  if(h[0]!=='概要原文'||h[1]!=='概要清掃済み')throw Error('HEADER_CHANGED');
  const r=sh.getRange(t.row,1,1,23).getValues()[0];
  if(r[0]!==t.id||r[6]!==t.guid)throw Error('IDENTITY_CHANGED');
  const body=phase14VWExtractBody_(String(r[21]||''));
  return {sh,body,old:String(r[22]||'')};
}
function phase14VWPreviewEP06625(){
  const z=phase14VWRead_();
  const action=z.old===z.body?'ALREADY_CLEAN':
    (/PODCAST MEETING|スタンダードコース|購読料で配信/.test(z.old)&&z.old.includes('大阪・関西万博の閉幕から1年'))?'READY_TO_REPLACE_PROMOTION':'REVIEW_REQUIRED';
  const result={mode:'VW_PREVIEW',id:P14_VW_PILOT.id,source:'V6626',target:'W6626',
    action,beforeLength:z.old.length,afterLength:z.body.length,cleaned:z.body,writes:0};
  console.log(JSON.stringify(result));return result;
}
function phase14VWApplyEP06625Once(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('BUSY');
  try {
    const z=phase14VWRead_(),cell=z.sh.getRange(P14_VW_PILOT.row,23);
    if(z.old===z.body){
      const r={status:'ALREADY_CLEAN',writes:0};console.log(JSON.stringify(r));return r;
    }
    if(!/PODCAST MEETING|スタンダードコース|購読料で配信/.test(z.old)||
       !z.old.includes('大阪・関西万博の閉幕から1年')||
       cell.getFormula()||cell.getDataValidation())
       throw Error('REVIEW_REQUIRED_NO_WRITE');
    cell.setValue(z.body);SpreadsheetApp.flush();
    if(cell.getValue()!==z.body)throw Error('READBACK_MISMATCH');
    const result={status:'CLEANED_VERIFIED',id:P14_VW_PILOT.id,target:'W6626',writes:1};
    console.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
