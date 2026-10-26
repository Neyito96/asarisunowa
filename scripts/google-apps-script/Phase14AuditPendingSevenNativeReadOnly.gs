/** READ_ONLY production native hash audit, no state mutation. */
function phase14AuditPendingSevenNativeReadOnly(){
 const ID='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const book=SpreadsheetApp.openById(ID),tab=book.getSheetByName('エピソード台帳'),st=book.getSheetByName('図書館V3・項目状態'),hist=book.getSheetByName('固定ID採番履歴');
 const ids=['EP-06594','EP-06627','EP-06628','EP-06629','EP-06630','EP-06631','EP-06632'];
 const rows=tab.getRange(6595,1,39,55).getValues(),states=st.getRange(6595,1,39,3).getValues(),history=hist.getDataRange().getValues();
 const out=[];
 for(const id of ids){
  const matching=rows.map((r,i)=>({r,i})).filter(x=>x.r[0]===id);
  if(matching.length!==1){out.push({id,status:'LEDGER_ID_NOT_UNIQUE'});continue;}
  const {r,i}=matching[0],v=JSON.parse(states[i][1]||'{}'),guid=String(r[6]||''),matchingHistory=history.filter(h=>h[1]===id&&String(h[0]).toLowerCase()===guid.toLowerCase());
  const hash=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(r)));
  out.push({id,row:6595+i,guid,hash,identityStatus:v.identity?.[0],storedHash:v.identity?.[2]||'',sameAsStored:!!v.identity?.[2]&&v.identity[2]===hash,historyMatches:matchingHistory.length,
    sourceEvidence:v.registrationEvidence?.[0]||null,verdict:'READ_ONLY_NEEDS_REVIEW'});
 }
 const report={mode:'PENDING_SEVEN_NATIVE_HASH_READ_ONLY',items:out,writes:0,triggerChanges:0,propertiesChanged:0};
 console.log(JSON.stringify(report));return report;
}
