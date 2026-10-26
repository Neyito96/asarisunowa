/**
 * Production archive quality audit. READ ONLY. No triggers or writes.
 * Audit ALL rows in bounded batches. Start at row 2. Report progress from start/end.
 * The scan is intentionally conservative: suspicious text is a review candidate,
 * not a licence to overwrite or discard it.
 */
function phase14QualityAuditAllReadOnly() {
  const ssId='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
  const expectedScript='1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV';
  if(ScriptApp.getScriptId()!==expectedScript)throw Error('WRONG_GAS_PROJECT');
  const sh=SpreadsheetApp.openById(ssId).getSheetByName('エピソード台帳');
  if(!sh)throw Error('MISSING_LEDGER');
  const h=sh.getRange(1,1,1,55).getDisplayValues()[0];
  const expected={0:'台帳ID',10:'LISTEN URL',11:'Spotify個別URL',12:'Apple個別URL',21:'概要原文',22:'概要清掃済み',23:'出演者・スタッフ',40:'Amazon個別URL',41:'Pocket Casts個別URL',42:'Pody個別URL',43:'YouTube個別URL',45:'出演者1',49:'出演者5',50:'出演者確認根拠'};
  for(const i in expected)if(h[+i]!==expected[i])throw Error('HEADER_MISMATCH_'+i);
  const last=sh.getLastRow(),batch=250;
  const summary={mode:'PRODUCTION_QUALITY_AUDIT_READ_ONLY',from:'EP-00001',rows:0,issues:{},
    examples:{},lastProcessed:'',writes:0,triggerChanges:0};
  function flag(type,id,row,detail) {
    summary.issues[type]=(summary.issues[type]||0)+1;
    if(!summary.examples[type])summary.examples[type]=[];
    if(summary.examples[type].length<12)summary.examples[type].push({id,row,detail:String(detail||'').slice(0,110)});
  }
  for(let start=2;start<=last;start+=batch) {
    const count=Math.min(batch,last-start+1);
    const rows=sh.getRange(start,1,count,51).getDisplayValues();
    for(let k=0;k<count;k++) {
      const r=rows[k],row=start+k,id=r[0];
      if(!/^EP-\d{5}$/.test(id)){flag('INVALID_EP_ID',id,row,id);continue;}
      summary.rows++;summary.lastProcessed=id;
      const raw=r[21]||'',clean=r[22]||'',cast=r[23]||'';
      const names=r.slice(45,50).map(x=>x.trim()),proof=(r[50]||'').trim();
      if(clean&&/(PODCAST MEETING|スタンダードコース|購読料で配信|イベントへのお申し込み|会員登録をお願いします|番組フォローにご協力)/i.test(clean))
        flag('W_PROMOTION_REMAINS',id,row,clean.slice(0,70));
      if(cast&&/(PODCAST MEETING|スタンダードコース|購読料で配信|朝日新聞アプリで|お便りは|Discordからでも)/i.test(cast))
        flag('X_PROMOTION_REMAINS',id,row,cast.slice(0,70));
      names.forEach((name,j)=>{
        if(!name)return;
        if(/https?:\/\/|\b[a-f0-9]{8}-[a-f0-9]{4}-|\.rss\b|PODCAST MEETING|お願いします|お便り|ディスコード|Discord|キャンペーン|会員登録|購読/i.test(name))
          flag('PERSON_FIELD_CONTAMINATION',id,row,'column '+(46+j)+': '+name);
      });
      if(cast&&!names.some(Boolean))flag('CAST_EXISTS_BUT_NAMES_EMPTY',id,row,cast.slice(0,90));
      if(names.some(Boolean)&&!proof)flag('NAMES_WITHOUT_SOURCE',id,row,names.filter(Boolean).join(' / '));
      if(!clean&&raw)flag('W_EMPTY_WITH_RAW',id,row,'V nonempty');
    }
    console.log(JSON.stringify({mode:'QUALITY_AUDIT_PROGRESS',processed:summary.rows,lastProcessed:summary.lastProcessed,lastRow:start+count-1}));
  }
  summary.status='REVIEW_ONLY';console.log(JSON.stringify(summary));return summary;
}
