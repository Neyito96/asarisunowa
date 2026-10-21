/**
 * Resume the actual V/W cleaning pilot after W1471, only on the isolated copy.
 * One invocation checks up to 40 rows, fills W from existing V, and attempts
 * to recover V from official Omny clip HTML when V is missing.
 * No production writes, trigger installs, properties, or Spotify changes.
 */
function runLibraryV3ContinueW1471(){
 const COPY='1e4yOcHgyF4Hx2vaN9vtzRZElW3cVAoUnSl1Y8dsd-DQ';
 const SOURCE='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const ss=SpreadsheetApp.openById(COPY), sh=ss.getSheetByName('エピソード台帳');
 if(!sh||COPY===SOURCE)throw Error('Isolated copy only');
 const start=1472,limit=40,end=Math.min(sh.getLastRow(),start+limit-1);
 const rows=sh.getRange(start,1,end-start+1,23).getValues();
 const stats={mode:'ISOLATED_COPY_W1471_CONTINUE',range:'V'+start+':W'+end,filledRaw:0,filledClean:0,alreadyClean:0,held:[],writes:0};
 const clean=s=>String(s||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,href,label)=>label.replace(/<[^>]*>/g,' ').trim()+' '+href).replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],row=start+i,id=String(r[0]||''),title=String(r[2]||''),url=String(r[8]||'');
  if(!/^EP-\d+$/.test(id)){stats.held.push({row,reason:'ID_INVALID'});continue;}
  let raw=String(r[21]||''),w=String(r[22]||'');
  if(w){stats.alreadyClean++;continue;}
  if(!raw){
   if(!/^https:\/\/omny\.fm\/shows\//.test(url)){stats.held.push({row,id,reason:'OFFICIAL_URL_MISSING'});continue;}
   try{
    const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':'Mozilla/5.0'}});
    if(response.getResponseCode()!==200){stats.held.push({row,id,reason:'HTTP_'+response.getResponseCode()});continue;}
    const html=response.getContentText();
    const titleMatch=html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)/i)||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const foundTitle=clean(titleMatch?.[1]||'');
    const simplify=s=>s.replace(/^#\d+\s*/,'').replace(/[\s　「」『』（）()、。，．・!！?？]/g,'');
    if(!foundTitle||!simplify(foundTitle).includes(simplify(title).slice(0,18))){stats.held.push({row,id,reason:'TITLE_MISMATCH'});continue;}
    const desc=html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']+)/i);
    const candidate=desc?.[1]||'';
    if(candidate.length<80){stats.held.push({row,id,reason:'RAW_DESCRIPTION_NOT_EXTRACTED'});continue;}
    raw=candidate;
    sh.getRange(row,22).setValue(raw);stats.filledRaw++;stats.writes++;
   }catch(e){stats.held.push({row,id,reason:'FETCH_FAILED'});continue;}
  }
  const next=clean(raw);
  if(!next){stats.held.push({row,id,reason:'CLEAN_EMPTY'});continue;}
  if(sh.getRange(row,23).getValue()){stats.held.push({row,id,reason:'W_CHANGED'});continue;}
  sh.getRange(row,23).setValue(next);stats.filledClean++;stats.writes++;
 }
 SpreadsheetApp.flush();
 Logger.log(JSON.stringify(stats));return stats;
}
