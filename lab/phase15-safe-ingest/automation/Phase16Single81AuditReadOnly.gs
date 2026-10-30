/** Phase16 81 single-link candidates; compact read-only gate. Requires P16_NEWS_V5. */
function p16CheckSingle81ReadOnly(){
 const sh=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4').getSheetByName('エピソード台帳');
 const ids=["EP-00748","EP-00767","EP-00768","EP-00769","EP-00770","EP-00771","EP-00772","EP-00773","EP-00775","EP-00777","EP-00778","EP-00779","EP-00780","EP-00783","EP-00784","EP-00785","EP-00788","EP-00790","EP-00791","EP-00794","EP-00796","EP-00797","EP-00799","EP-00800","EP-00801","EP-00803","EP-00804","EP-00805","EP-00807","EP-00810","EP-00811","EP-00813","EP-00814","EP-00816","EP-00817","EP-00818","EP-00819","EP-00820","EP-00821","EP-00822","EP-00823","EP-00824","EP-00826","EP-00827","EP-00828","EP-00829","EP-00830","EP-00831","EP-00832","EP-00833","EP-00834","EP-00835","EP-00836","EP-00837","EP-00838","EP-00840","EP-00842","EP-00845","EP-00846","EP-00848","EP-00849","EP-00850","EP-00851","EP-00852","EP-00855","EP-00856","EP-00857","EP-00858","EP-00859","EP-00860","EP-00861","EP-00862","EP-00863","EP-00864","EP-00865","EP-00866","EP-00867","EP-00868","EP-00869","EP-00870","EP-00871"];
 const checks=ids.map(id=>{
  const rn=Number(id.slice(3))+1,row=sh.getRange(rn,1,1,55).getValues()[0];
  const flags=[],raw=String(row[21]||''),w=String(row[22]||''),am=String(row[38]??'').trim();
  if(row[0]!==id||row[1]!=='ニュースの学校')flags.push('IDENTITY');
  if(!raw||w)flags.push('SOURCE_OR_W');
  if(!['','未指定','FALSE','false','0','いいえ'].includes(am))flags.push('EXCLUDED');
  const out=P16_NEWS_V5.parse(raw);
  if(out.holds.length)flags.push(...out.holds);
  if(out.articles.length!==1)flags.push('ARTICLE_COUNT');
  const urls=[...raw.replace(/&nbsp;|&#160;/gi,' ').matchAll(/https:\/\/(?:www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html|globe\.asahi\.com\/article\/\d+)(?:\?[A-Za-z0-9_=&%-]+)?/g)].map(x=>x[0]);
  if(urls.length!==1||out.articles.length!==1||out.articles[0].url!==urls[0]||!raw.includes(out.articles[0].title))flags.push('ARTICLE_PAIR');
  if(row[28]&&out.articles[0]&&String(row[28])!==out.articles[0].url)flags.push('AC_CONFLICT');
  if(out.w&&out.w.includes('【関連記事】')===false)flags.push('FORMAT');
  return {id,flags,wlen:out.w?out.w.length:0,needAC:!row[28]};
 });
 const pass=checks.filter(x=>x.flags.length===0),held=checks.filter(x=>x.flags.length>0);
 const result={mode:'READ_ONLY_SINGLE81',total:checks.length,passed:pass.length,held:held.length,passedIds:pass.map(x=>x.id),heldItems:held,writes:0};
 console.log(JSON.stringify(result));return result;
}