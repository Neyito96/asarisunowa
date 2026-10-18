/** READ ONLY. Inspect 2020-21 old-news raw/clean drift without overwriting either. */
function previewLibraryV3OldNewsDiffAudit(){
 const c=libV3Context_(false), limit=25, counts={}, samples={}, candidates=[];
 const norm=s=>String(s==null?'':s).replace(/\s+/g,' ').trim();
 const links=s=>(String(s||'').match(/https?:\/\/[^\s<>"']+/g)||[]).map(x=>x.replace(/[),.;]+$/,''));
 const tag=s=>/<\/?[a-z][^>]*>/i.test(String(s||''));
 const key=s=>norm(s).replace(/[\s\u3000\u00a0]/g,'').replace(/[「」『』。、,.・：:！!？?（）()［］\[\]～〜―ー－-]/g,'');
 for(const r of c.rows){
  if(r[1]!=='ニュースの現場から'||!/^202[01]-/.test(libV2CpDate_(r[3])))continue;
  const raw=String(r[21]||''),clean=String(r[22]||''), expected=libV3Clean_(raw);
  let reason;
  if(!norm(raw))reason='RAW_MISSING';
  else if(!norm(clean))reason='CLEAN_MISSING';
  else if(expected===clean)reason='MECHANICAL_EQUAL';
  else if(key(expected)===key(clean))reason='PUNCTUATION_OR_SPACING_ONLY';
  else if(links(expected).join('|')!==links(clean).join('|'))reason='URL_DIFFERENCE_REVIEW';
  else if(tag(raw))reason='HTML_RENDER_OR_CONTENT_REVIEW';
  else if(clean.length<expected.length*.75)reason='POSSIBLE_SUMMARY_OR_TRUNCATION_REVIEW';
  else if(clean.length>expected.length*1.25)reason='POSSIBLE_ADDITION_REVIEW';
  else reason='CONTENT_DIFFERENCE_REVIEW';
  counts[reason]=(counts[reason]||0)+1;
  if(!samples[reason])samples[reason]=[];
  if(samples[reason].length<limit)samples[reason].push({id:String(r[0]),date:libV2CpDate_(r[3]),expectedLength:expected.length,savedLength:clean.length});
  if(reason!=='MECHANICAL_EQUAL')candidates.push({id:String(r[0]),reason});
 }
 const result={mode:'READ_ONLY_V3_OLD_NEWS_DIFF',rows:Object.values(counts).reduce((a,b)=>a+b,0),counts,samples,candidateCount:candidates.length,writes:0,apiCalls:0,rawAndCleanUnchanged:true};
 Logger.log(JSON.stringify({mode:result.mode,rows:result.rows,counts,candidateCount:result.candidateCount,writes:0,apiCalls:0}));
 Object.keys(samples).sort().forEach(reason=>Logger.log(JSON.stringify({mode:'READ_ONLY_V3_OLD_NEWS_DIFF_SAMPLES',reason,rows:samples[reason]})));
 return result;
}
