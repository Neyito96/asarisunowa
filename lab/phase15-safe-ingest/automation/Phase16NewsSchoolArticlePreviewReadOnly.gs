/**
 * Phase16 read-only preview for ニュースの学校 related article links.
 * Handles article-title and URL on the same line; never changes V/W/AC.
 */
function p16PreviewNewsSchoolArticles() {
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const sh=ss.getSheetByName('エピソード台帳');
  const ids=['EP-00543','EP-00555','EP-00556','EP-00557','EP-00558','EP-00559','EP-00560','EP-00561','EP-00562','EP-00563'];
  const rows=sh.getRange(2,1,sh.getLastRow()-1,29).getValues();
  const found=new Map(rows.filter(r=>ids.includes(String(r[0]))).map(r=>[String(r[0]),r]));
  function lines(raw) {
    return String(raw||'').replace(/\\r\\n|\\n|\\r|\r\n?/g,'\n')
      .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').split('\n').map(s=>s.trim()).filter(Boolean);
  }
  function parse(raw) {
    const body=[],related=[],held=[];
    for(const line of lines(raw)) {
      if(/^(?:ご意見・感想・リクエスト|ほかにも多彩な番組を配信中|See omnystudio|Learn more about)/i.test(line))continue;
      // Strict official Asahi individual article URL; allow optional query.
      const rx=/(https?:\/\/(?:www\.|digital\.)?asahi\.com\/articles\/[A-Za-z0-9]+(?:\.html)?(?:\?[^\s<>]*)?)/g;
      const matches=[...line.matchAll(rx)];
      if(matches.length===1) {
        const m=matches[0],title=line.slice(0,m.index).trim().replace(/^[・\-\s]+/,'');
        const tail=line.slice(m.index+m[0].length).trim();
        if(title&&tail==='') {related.push({title,url:m[0]});continue;}
        held.push('ARTICLE_LINK_NOT_ISOLATED');
      } else if(matches.length>1)held.push('MULTIPLE_ARTICLE_LINKS_ON_LINE');
      else if(/https?:\/\//.test(line)) {
        if(!/^(?:※|★|☆|https?:\/\/)/.test(line))held.push('UNCLASSIFIED_URL');
        continue;
      }
      body.push(line);
    }
    if(!body.length)held.push('EMPTY_BODY');
    return {body:body.join('\n'),related,holds:[...new Set(held)]};
  }
  const results=ids.map(id=>{
    const row=found.get(id);
    if(!row)return {id,holds:['NOT_FOUND']};
    const value=parse(row[21]);
    if(String(row[22]||'').trim())value.holds.push('W_ALREADY_FILLED');
    if(String(row[28]||'').trim())value.holds.push('AC_ALREADY_FILLED');
    return {id, title:row[2], ...value};
  });
  console.log(JSON.stringify({mode:'READ_ONLY',examined:results.length,results,writes:0},null,2));
  return results;
}
