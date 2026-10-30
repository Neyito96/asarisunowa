/**
 * Phase16 whole-ledger cell census. READ_ONLY; safe in production GAS.
 * Single sheet read A:AS, no triggers/properties/writes.
 */
function p16AuditCellGapsReadOnly() {
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const sheet=ss.getSheetByName('エピソード台帳');
  const last=sheet.getLastRow();
  const data=sheet.getRange(2,1,last-1,45).getValues(); // A:AS
  const missing={V_W:[],V:[],O:[],P:[],N:[],AS:[],X:[],AC:[],officialPage:[]};
  const platforms={K:0,L:0,M:0,AO:0,AP:0,AQ:0};
  const byShow={};
  for(let i=0;i<data.length;i++){
    const r=data[i],id=String(r[0]||''),show=String(r[1]||''),excluded=String(r[38]||'').trim();
    if(!/^EP-\d{5,6}$/.test(id)||/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(show)||excluded&& !/^(FALSE|false|いいえ|0|未指定)$/.test(excluded))continue;
    if(!byShow[show])byShow[show]={total:0,V_W:0,O:0,P:0,AS:0};
    const s=byShow[show];s.total++;
    const blank=n=>r[n]===null||r[n]===undefined||String(r[n]).trim()==='';
    if(!blank(21)&&blank(22)){missing.V_W.push(id);s.V_W++;}
    if(blank(21))missing.V.push(id);
    if(blank(14)){missing.O.push(id);s.O++;}
    if(blank(15)){missing.P.push(id);s.P++;}
    if(blank(13))missing.N.push(id);
    if(blank(44)){missing.AS.push(id);s.AS++;}
    if(blank(23))missing.X.push(id);
    if(blank(28))missing.AC.push(id);
    if(blank(8)&&blank(9))missing.officialPage.push(id);
    for(const [key,idx] of Object.entries({K:10,L:11,M:12,AO:40,AP:41,AQ:42}))if(!blank(idx))platforms[key]++;
  }
  const counts=Object.fromEntries(Object.entries(missing).map(([k,v])=>[k,v.length]));
  const samples=Object.fromEntries(Object.entries(missing).map(([k,v])=>[k,v.slice(0,12)]));
  const result={mode:'READ_ONLY',scanned:data.length,counts,byShow,platformFilled:platforms,samples,writes:0};
  console.log(JSON.stringify(result));
  return result;
}