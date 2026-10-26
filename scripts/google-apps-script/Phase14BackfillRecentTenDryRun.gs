/**
 * Phase14 / Engine B: latest ten episode backfill candidates.
 * READ ONLY. Does not contact providers or infer missing field values.
 * No writes, triggers, state changes, or new EP IDs.
 *
 * Run in 朝ポキ｜本番ロボGAS after phase14ProductionPreflightReadOnly().
 */
function phase14BackfillRecentTenDryRun(){
  const expectedScript='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV';
  const expectedSheet='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
  if(ScriptApp.getScriptId()!==expectedScript)throw Error('WRONG_GAS_PROJECT');
  const ss=SpreadsheetApp.openById(expectedSheet);
  const sh=ss.getSheetByName('エピソード台帳');
  if(!sh)throw Error('LEDGER_TAB_MISSING');
  const headers=sh.getRange(1,1,1,55).getDisplayValues()[0];
  const required={0:'台帳ID',6:'外部ID',13:'画像URL',15:'再生時間（秒）',21:'概要原文',22:'概要清掃済み',23:'出演者・スタッフ',51:'公式JSON UUID（2026-10-20）'};
  for(const key in required)if(headers[Number(key)]!==required[key])throw Error('SCHEMA_MISMATCH_'+key);
  const last=sh.getLastRow(),count=Math.min(10,last-1);
  if(count<1)throw Error('NO_EPISODES');
  const start=last-count+1;
  const values=sh.getRange(start,1,count,55).getDisplayValues();
  const candidates=[];
  values.forEach((r,i)=>{
    const id=r[0],guid=r[6],provider=/megaphone/i.test(r[5])?'MEGAPHONE':/omny/i.test(r[5])?'OMNY':'OTHER';
    if(!/^EP-\d{5}$/.test(id)||!guid)throw Error('INVALID_IDENTITY_AT_ROW_'+(start+i));
    const gaps=[];
    [[13,'画像URL'],[15,'再生時間'],[21,'概要原文'],[22,'概要清掃済み'],[23,'出演者・スタッフ']].forEach(([col,label])=>{
      if(!String(r[col]||'').trim())gaps.push(label);
    });
    if(provider==='OMNY'&&!String(r[51]||'').trim())gaps.push('Omny公式JSON UUID');
    // Omny JSON fields do not apply to Megaphone.
    candidates.push({row:start+i,epId:id,show:r[1],title:r[2],guid,provider,gaps,needsBackfill:gaps.length>0});
  });
  const report={mode:'PROD_B1_READ_ONLY_DRY_RUN',scriptId:ScriptApp.getScriptId(),
    spreadsheetId:expectedSheet,range:'A'+start+':BC'+last,
    inspected:candidates.length,needsBackfill:candidates.filter(x=>x.needsBackfill).length,
    clean:candidates.filter(x=>!x.needsBackfill).length,candidates,
    externalSourceVerification:'NOT_PERFORMED',status:'DRY_RUN_ONLY',
    writes:0,triggerChanges:0,propertiesChanged:0};
  console.log(JSON.stringify(report));return report;
}
