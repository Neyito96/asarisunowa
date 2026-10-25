/**
 * Phase14 COPY shadow audit (READ_ONLY).
 * Install in a monitoring GAS project; no triggers are created automatically.
 * The production ledger owns EP-IDs; COPY never reserves an ID here.
 */
const P14_SHADOW_PROD_ID = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
const P14_SHADOW_COPY_ID = '1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
function phase14ShadowCompareReadOnly(){
  const prod = SpreadsheetApp.openById(P14_SHADOW_PROD_ID);
  const copy = SpreadsheetApp.openById(P14_SHADOW_COPY_ID);
  function scan(book) {
    const sheet=book.getSheetByName('エピソード台帳');
    if(!sheet)throw Error('LEDGER_MISSING');
    const last=sheet.getLastRow();
    const rows=last>1?sheet.getRange(2,1,last-1,7).getDisplayValues():[];
    const byGuid=new Map(), byId=new Map(),duplicates=[];
    rows.forEach((r,i)=>{
      const id=String(r[0]||'').trim(),guid=String(r[6]||'').trim().toLowerCase();
      if(!id||!/^EP-\d{5}$/.test(id)||!guid){duplicates.push({row:i+2,reason:'MISSING_OR_INVALID_IDENTITY'});return;}
      if(byId.has(id))duplicates.push({row:i+2,reason:'DUPLICATE_EP_ID',id});
      if(byGuid.has(guid))duplicates.push({row:i+2,reason:'DUPLICATE_GUID',guid});
      byId.set(id,{guid,title:r[2]||'',row:i+2});
      byGuid.set(guid,{id,title:r[2]||'',row:i+2});
    });
    return {count:rows.length,byGuid,byId,duplicates};
  }
  const a=scan(prod),b=scan(copy),copyOnly=[],prodOnly=[],identityMismatches=[];
  b.byGuid.forEach((item,guid)=>{
    const match=a.byGuid.get(guid);
    if(!match)copyOnly.push({guid,copyId:item.id,title:item.title});
    else if(match.id!==item.id)identityMismatches.push({guid,prodId:match.id,copyId:item.id});
  });
  a.byGuid.forEach((item,guid)=>{if(!b.byGuid.has(guid))prodOnly.push({guid,prodId:item.id,title:item.title});});
  const report={
    mode:'READ_ONLY_SHADOW',checkedAt:new Date().toISOString(),
    production:{count:a.count,lastId:[...a.byId.keys()].slice(-1)[0],duplicates:a.duplicates},
    copy:{count:b.count,lastId:[...b.byId.keys()].slice(-1)[0],duplicates:b.duplicates},
    copyOnly,prodOnly,identityMismatches,
    status:a.duplicates.length||b.duplicates.length||identityMismatches.length?'REVIEW_REQUIRED':'COMPARED',
    writes:0,triggerChanges:0,epIdsAllocated:0
  };
  console.log(JSON.stringify(report));return report;
}
