/**
 * 朝ポキ｜本番新着収蔵 SHADOW V1
 * COPY保険継続。READ_ONLY: COPY、本番の台帳を照合し、V4を通して差分を表示。
 * 定期トリガーは未設置。本番への書込み・採番なし。
 */
var P14_SHADOW=Object.freeze({
 PROD:'1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4',
 COPY:'1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY',
 SCRIPT:'1Ywoelv_gnS6oJQz7CDbAn6PZaS4l2lty-XmhHJUdk9-K5PmvwAE79JJV',
 SHEET:'エピソード台帳', SCAN_LAST:150, PREVIEW_MAX:15
});
function phase14ProductionShadowReadOnly(){
 const t=P14_SHADOW;
 if(ScriptApp.getScriptId()!==t.SCRIPT)throw Error('WRONG_SCRIPT');
 if(typeof P14NewEpisodeFormatterV4==='undefined')throw Error('FORMATTER_V4_MISSING');
 const sheets=[t.PROD,t.COPY].map(id=>{
   const ss=SpreadsheetApp.openById(id),s=ss.getSheetByName(t.SHEET);
   if(!s)throw Error('LEDGER_NOT_FOUND');
   const n=s.getLastRow(),start=Math.max(2,n-t.SCAN_LAST+1);
   const rows=n>=2?s.getRange(start,1,n-start+1,55).getDisplayValues():[];
   return {sheet:s,count:n-1,rows};
 });
 const prod=sheets[0],copy=sheets[1],pMap=new Map();
 for(const r of prod.rows)if(r[6])pMap.set(String(r[6]),r);
 const latest=copy.rows.slice(-t.PREVIEW_MAX),out=[];
 for(const r of latest){
   const id=String(r[0]),guid=String(r[6]||'');
   if(!/^EP-\d{5}$/.test(id)||!guid)throw Error('COPY_INVALID_ID_OR_GUID');
   const pr=pMap.get(guid),f=P14NewEpisodeFormatterV4.clean(r[21]),cast=P14NewEpisodeFormatterV4.cast(r[21]);
   const collision=pr&&pr[0]!==id;
   const data={copyId:id,guid,title:r[2],program:r[1],
     prodState:pr?(collision?'GUID_ID_CONFLICT':'ALREADY_IN_PROD'):'NOT_FOUND_IN_PROD_TAIL',
     overview:f.status,cast:cast.status,names:cast.names,
     cleanPreview:f.text.slice(0,500),writes:0};
   out.push(data);console.log(JSON.stringify({mode:'SHADOW_ROW',...data}));
 }
 const result={mode:'SHADOW_SUMMARY',prodCount:prod.count,copyCount:copy.count,
   reviewed:out.length,notInProdTail:out.filter(x=>x.prodState==='NOT_FOUND_IN_PROD_TAIL').map(x=>x.copyId),
   collisions:out.filter(x=>x.prodState==='GUID_ID_CONFLICT').map(x=>x.copyId),
   clean:out.filter(x=>x.overview==='CLEAN_CONFIDENT').length,
   holds:out.filter(x=>x.overview!=='CLEAN_CONFIDENT'||x.cast.status==='NEEDS_REVIEW').map(x=>x.copyId),
   status:'READ_ONLY',writes:0,triggerChanges:0,
   limitation:'Checks last 150 rows only; NOT full ledger GUID uniqueness audit.'};
 console.log(JSON.stringify(result));return result;
}
