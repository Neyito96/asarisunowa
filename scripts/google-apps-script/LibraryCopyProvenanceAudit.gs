/** Phase14 copy-only evidence review for EP-06593. No writes.
 * Confirmed 2026-10-24 11:52 JST: AC has 3 linked article URLs,
 * hash matches when D is normalized yyyy/MM/dd HH:mm:ss.
 * AF original retrieval time was not logged: do NOT backdate it.
 */
function inspectCopyEp06593ProvenanceReadOnly() {
 const id='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const ss=SpreadsheetApp.openById(id);
 const sh=ss.getSheetByName('エピソード台帳');
 const state=ss.getSheetByName('図書館V3・項目状態');
 const history=ss.getSheetByName('固定ID採番履歴');
 if(!sh||!state||!history)throw Error('COPY_SHEET_MISSING');
 const target='EP-06593',guid='13a056a0-27b2-4079-a9e5-b4e5006200d0';
 const rows=sh.getDataRange().getValues();
 const positions=rows.map((r,i)=>r[0]===target?i+1:null).filter(Boolean);
 if(positions.length!==1)throw Error('EP_ID_COUNT_'+positions.length);
 const index=positions[0],row=rows[index-1];
 if(row[6]!==guid)throw Error('GUID_MISMATCH');
 const s=state.getDataRange().getValues().filter(r=>r[0]===target);
 const h=history.getDataRange().getValues().filter(r=>r[1]===target);
 if(s.length!==1||h.length!==1||h[0][0]!==guid)throw Error('EVIDENCE_MISMATCH');
 const proof=JSON.parse(s[0][1]),normalized=row.slice();
 if(!(normalized[3] instanceof Date))throw Error('DATE_NOT_DATE');
 normalized[3]=Utilities.formatDate(normalized[3],'Asia/Tokyo','yyyy/MM/dd HH:mm:ss');
 const hashMatches=LibraryOfficialEngine.rowHash(normalized)===proof.identity?.[2];
 const ac=sh.getRange(index,29).getRichTextValue();
 const linked=(ac?ac.getRuns():[]).filter(r=>!!r.getLinkUrl());
 const cols=[];
 for(let c=32;c<=40;c++)cols.push({column:c,header:rows[0][c-1],filled:row[c-1]!==''&&row[c-1]!==null,preview:String(row[c-1]||'').slice(0,120)});
 const report={mode:'COPY_READ_ONLY',ep:target,row:index,hashMatches,linkedArticles:linked.length,
  historyMatches:true,columns:cols,
  recommendation:{
   AF:'Unknown original acquisition timestamp; do not fabricate',
   AG:'Keep existing feed URL',
   AH:'Only fill if official source explicitly supplies update time',
   AI:'May record NEW verification time, clearly identified as such',
   AJ:'May record verified method RSS plus Omny JSON',
   AK:'Leave blank unless licensing proven',
   AL:'Do not guess column meaning or cleanup state',
   AM:'Keep 未指定',
   AN:'Use only for documented hold or audit note'
  },writes:0,triggerChanges:0};
 console.log('EP06593_PROVENANCE '+JSON.stringify(report));return report;
}
