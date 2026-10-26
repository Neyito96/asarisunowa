/**
 * Phase14 B1: one-row, one-cell limited backfill (EP-06625 / X6626).
 * Source: V6626 original official RSS description, NOT generated names.
 * preview: read-only; apply: explicitly invoked, re-verifies all conditions.
 * Do not schedule the apply function.
 */
var P14_B1_TARGET={
  scriptId:'1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV',
  spreadsheetId:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
  row:6626,id:'EP-06625',guid:'aca6c2d2-6291-4bd5-801a-b4eb00651c0d'
};
function phase14B1ExtractCast_(html){
  const start=html.indexOf('【出演・スタッフ】');
  if(start<0||html.indexOf('【出演・スタッフ】',start+1)>=0)throw Error('CAST_SECTION_AMBIGUOUS');
  const end=html.indexOf('【おねがい】',start);
  if(end<0||end-start>3000)throw Error('CAST_END_MISSING_OR_TOO_LONG');
  let section=html.slice(start+'【出演・スタッフ】'.length,end);
  section=section.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n')
    .replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
  const lines=section.split('\n').map(x=>x.trim()).filter(Boolean);
  const expected=[
    ['岡純太郎（大阪ネットワーク報道本部）','https://t.asahi.com/wqyu'],
    ['MC　岸上渉','https://bit.ly/3SL3x62'],
    ['MC・音源編集　山根久美子（大阪ネットワーク報道本部）','https://t.asahi.com/wqun']
  ];
  if(lines.length!==3||expected.some((p,i)=>!lines[i].includes(p[0])||!lines[i].includes(p[1])))
    throw Error('CAST_OFFICIAL_TEXT_NOT_EXACT_EXPECTED');
  return lines.join('\n');
}
function phase14B1ReadTarget_(){
  const t=P14_B1_TARGET;
  if(ScriptApp.getScriptId()!==t.scriptId)throw Error('WRONG_SCRIPT');
  const ss=SpreadsheetApp.openById(t.spreadsheetId),sh=ss.getSheetByName('エピソード台帳');
  if(!sh)throw Error('LEDGER_MISSING');
  const r=sh.getRange(t.row,1,1,55).getValues()[0];
  if(r[0]!==t.id||String(r[6]).toLowerCase()!==t.guid)throw Error('ROW_IDENTITY_CHANGED');
  if(!String(r[5]).includes('Omny'))throw Error('PROVIDER_MISMATCH');
  if(!String(r[8]).includes('/oosaka8'))throw Error('OFFICIAL_LINK_MISMATCH');
  const cast=phase14B1ExtractCast_(String(r[21]||''));
  return {sh,cast,current:r[23],id:r[0]};
}
function phase14B1PreviewEP06625(){
  const z=phase14B1ReadTarget_();
  const report={mode:'B1_PREVIEW',id:z.id,target:'X6626',proposed:z.cast,
    action:String(z.current||'').trim()?'SKIP_NONEMPTY':'READY_TO_FILL',writes:0};
  console.log(JSON.stringify(report));return report;
}
function phase14B1ApplyEP06625Once(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('BUSY');
  try{
    const z=phase14B1ReadTarget_(),cell=z.sh.getRange(P14_B1_TARGET.row,24);
    if(!cell.isBlank()) {
      const result={mode:'B1_SINGLE_WRITE',id:z.id,status:'SKIP_NONEMPTY',writes:0};
      console.log(JSON.stringify(result));return result;
    }
    if(cell.getFormula()||cell.getDataValidation()||cell.getRichTextValue()?.getRuns().length>1)
      throw Error('STRUCTURED_TARGET_REFUSED');
    cell.setValue(z.cast);SpreadsheetApp.flush();
    if(cell.getValue()!==z.cast)throw Error('READBACK_MISMATCH');
    const result={mode:'B1_SINGLE_WRITE',id:z.id,target:'X6626',status:'WRITTEN_VERIFIED',writes:1};
    console.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
