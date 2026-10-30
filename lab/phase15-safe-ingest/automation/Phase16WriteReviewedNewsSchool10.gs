/**
 * Phase16: bounded write of 10 manually inspected News School records.
 * Prerequisite: p16PreviewNewsSchoolArticles() exists and was reviewed.
 * V remains untouched. Each W/AC pair uses Phase15 audited writeRow.
 * Run once. Never create a time trigger for this function.
 */
function p16WriteVerifiedNewsSchool10() {
  const ids=['EP-00543','EP-00555','EP-00556','EP-00557','EP-00558','EP-00559','EP-00560','EP-00561','EP-00562','EP-00563'];
  const expectedTitles={
    'EP-00543':'いずも型護衛艦',
    'EP-00555':'エトミデート（ゾンビたばこ）',
    'EP-00556':'仮放免',
    'EP-00557':'日本版GPS「みちびき」',
    'EP-00558':'長期金利の上昇',
    'EP-00559':'中立金利',
    'EP-00560':'香淳皇后実録',
    'EP-00561':'公費解体',
    'EP-00562':'アテンション・エコノミー',
    'EP-00563':'衆議院の解散（2026）'
  };
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw Error('WRITER_BUSY');
  try {
    const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
    P15_AUTO.assertOwner(ss);
    const sh=ss.getSheetByName('エピソード台帳');
    // Recompute proposals from current V, never from historical output.
    const preview=p16PreviewNewsSchoolArticles();
    if(!Array.isArray(preview)||preview.length!==10)throw Error('PREVIEW_MISMATCH');
    const output=[];
    for(const id of ids) {
      const proposed=preview.find(x=>x.id===id);
      if(!proposed||proposed.holds.length||!proposed.body.trim()||
          !Array.isArray(proposed.related)||proposed.related.length!==1)
        throw Error('NOT_APPROVED_'+id);
      const article=proposed.related[0];
      if(!article.title||!/https:\/\/www\.asahi\.com\/articles\/[A-Za-z0-9]+\.html(?:\?.*)?$/.test(article.url))
        throw Error('ARTICLE_UNVERIFIED_'+id);
      const rowNo=Number(id.slice(3))+1;
      const row=sh.getRange(rowNo,1,1,55).getValues()[0];
      if(row[0]!==id||row[1]!=='ニュースの学校'||row[2]!==expectedTitles[id]||!row[6])
        throw Error('IDENTITY_MISMATCH_'+id);
      if(String(row[22]||'').trim()||String(row[28]||'').trim())
        throw Error('TARGET_ALREADY_HAS_CONTENT_'+id);
      if(!String(row[21]||'').includes(article.url)||!String(row[21]||'').includes(article.title))
        throw Error('V_CHANGED_'+id);
      const cleaned=proposed.body+'\n\n【関連記事】\n'+article.title+'\n'+article.url;
      // Audit PENDING -> verified for both W and AC, with rechecks.
      const result=PHASE15_INTEGRATED.writeRow(
        ss,sh,rowNo,row,[
          {col:23,value:cleaned,why:'PHASE16_VERIFIED_W_ARTICLE'},
          {col:29,value:article.url,why:'PHASE16_VERIFIED_AC_ARTICLE'}
        ],'PHASE16_NEWS_SCHOOL_REVIEWED');
      if(!result.ok)throw Error('WRITE_NOT_VERIFIED_'+id+'_'+result.why);
      const check=sh.getRange(rowNo,1,1,29).getValues()[0];
      if(check[22]!==cleaned||check[28]!==article.url)throw Error('POSTWRITE_MISMATCH_'+id);
      output.push({id,row:rowNo,w:'VERIFIED',ac:'VERIFIED'});
    }
    console.log(JSON.stringify({mode:'WRITE_10_REVIEWED',done:output.length,cells:output.length*2,results:output}));
    return output;
  } finally {lock.releaseLock();}
}
