/** Phase16 focused candidate audit. READ_ONLY / no writes, no triggers. Requires P16_UNIFIED_V4. */
function p16UnifiedV4Next20ReadOnly(){
 const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
 const sh=ss.getSheetByName('エピソード台帳');
 const rows=sh.getRange(2,1,sh.getLastRow()-1,40).getValues();
 const accepted=[],held=[];let skippedExcluded=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],id=String(r[0]||''),show=String(r[1]||'');
  if(!r[21]||String(r[22]||'').trim())continue;
  if(show==='AJW'){skippedExcluded++;continue;}
  if(show!=='ニュースの学校')continue;
  if(!['','未指定','FALSE','false','0','いいえ'].includes(String(r[38]??'').trim()))continue;
  const out=P16_UNIFIED_V4.parse(r[21]);
  if(out.holds.length){if(held.length<15)held.push({id,holds:out.holds});continue;}
  const valid=out.related.length===1&&out.related.every(a=>a.title&&/^https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[^\s]*)?$/.test(a.url)&&String(r[21]).includes(a.title)&&String(r[21]).includes(a.url));
  if(!valid){if(held.length<15)held.push({id,holds:['REVIEW_ARTICLE_COUNT_OR_URL']});continue;}
  accepted.push({id,row:i+2,show,articleCount:out.related.length,wLength:out.w.length,bodyPreview:out.body.slice(0,90),articleUrl:out.related[0].url});
  if(accepted.length>=20)break;
 }
 const result={mode:'READ_ONLY',accepted,held,skippedExcluded,writes:0};
 console.log(JSON.stringify(result));return result;
}