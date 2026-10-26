/** COPY-only genuine official RSS/JSON DRY_RUN for EP-06627..06631.
 * Manually run in COPY GAS. Does not write anything, including script properties.
 */
function phase14BackfillFiveOfficialDryRun(){
 const COPY_ID='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const SCRIPT_ID='1roni6h_C9vKxtP_2I6jGgXKE2KJ1yRRhE3ZD1JsZ6XXRnT5RcndqyfJo';
 if(ScriptApp.getScriptId()!==SCRIPT_ID)throw Error('NOT_COPY_GAS');
 const lock=LockService.getScriptLock();if(!lock.tryLock(2000))return {status:'BUSY',writes:0};
 try{
  const book=SpreadsheetApp.openById(COPY_ID),sh=book.getSheetByName('エピソード台帳');
  if(sh.getSheetId()!==806280644)throw Error('WRONG_SHEET_ID');
  const headers=sh.getRange(1,1,1,55).getValues()[0];
  if(headers[0]!=='台帳ID'||headers[6]!=='外部ID'||headers[54]!=='公式JSON取得元URL')throw Error('SCHEMA_CHANGED');
  const rows=sh.getRange(6628,1,5,55).getValues(),formulas=sh.getRange(6628,1,5,55).getFormulas();
  const rich=sh.getRange(6628,1,5,55).getRichTextValues();
  const validations=sh.getRange(6628,1,5,55).getDataValidations();
  const history=book.getSheetByName('固定ID採番履歴').getDataRange().getValues();
  const states=book.getSheetByName('図書館V3・項目状態').getRange(6628,1,5,3).getValues();
  const feeds=book.getSheetByName('取得元一覧').getRange('A2:H8').getValues();
  const guidRx=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const report={mode:'COPY_OFFICIAL_FIVE_DRY_RUN',sourceChecks:[],plans:[],holds:[],writes:0,propertiesChanged:0,triggersChanged:0};
  for(let n=0;n<5;n++){
   const r=rows[n],id='EP-'+String(6627+n).padStart(5,'0'),guid=String(r[6]||'');
   if(r[0]!==id||!guidRx.test(guid)||states[n][0]!==id){report.holds.push({id,why:'IDENTITY_OR_STATE_ROW_MISMATCH'});continue;}
   const hist=history.filter(h=>h[1]===id&&String(h[0]).toLowerCase()===guid.toLowerCase());
   if(hist.length!==1){report.holds.push({id,why:'HISTORY_NOT_UNIQUE'});continue;}
   const st=JSON.parse(states[n][1]||'{}');
   if(!st.identity||String(st.identity[1]).toLowerCase()!==guid.toLowerCase()){report.holds.push({id,why:'STATE_GUID_MISMATCH'});continue;}
   const source=feeds.find(f=>String(f[0]).trim()===String(r[1]).trim());
   if(!source||!source[7]){report.holds.push({id,why:'OFFICIAL_FEED_NOT_FOUND'});continue;}
   const feedUrl=String(source[7]);
   if(!/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/|feeds\.megaphone\.fm\/TASC)/.test(feedUrl)){report.holds.push({id,why:'FEED_NOT_APPROVED'});continue;}
   let item;
   try{
    const response=UrlFetchApp.fetch(feedUrl,{muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw Error('RSS_HTTP_'+response.getResponseCode());
    const channel=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
    const matches=channel.getChildren('item').filter(x=>String(x.getChildText('guid')).toLowerCase()===guid.toLowerCase());
    if(matches.length!==1)throw Error('RSS_GUID_MATCH_COUNT_'+matches.length);
    item=matches[0];
    if(String(item.getChildText('title')||'').trim()!==String(r[2]||'').trim())throw Error('TITLE_CONFLICT');
   }catch(e){report.holds.push({id,why:String(e)});continue;}
   let json=null,jsonStatus='NOT_APPLICABLE_MEGAPHONE';
   if(feedUrl.includes('omnycontent.com')){
    const url='https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+guid;
    try{
     const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
     jsonStatus='HTTP_'+response.getResponseCode();
     if(response.getResponseCode()===200)json=JSON.parse(response.getContentText());
    }catch(e){jsonStatus='FETCH_ERROR_'+String(e);}
   }
   const itunes=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
   const duration=item.getChildText('duration',itunes)||'';
   const seconds=/^\d+$/.test(duration)?Number(duration):null;
   const expected=[
    {col:10,value:item.getChildText('link')||'',evidence:'RSS.link'},
    {col:14,value:item.getChild('image',itunes)?.getAttribute('href')?.getValue()||'',evidence:'RSS.itunes:image'},
    {col:15,value:item.getChild('enclosure')?.getAttribute('url')?.getValue()||'',evidence:'RSS.enclosure'},
    {col:16,value:seconds,evidence:'RSS.duration'},
    {col:22,value:item.getChildText('description')||'',evidence:'RSS.description'},
    {col:52,value:json?guid:'',evidence:'Omny JSON verified'},
    {col:53,value:json?'https://api.omny.fm/orgs/1e3bd144-9b57-451a-93cf-ac0e00e74446/clips/'+guid:'',evidence:'Omny JSON'}
   ];
   const planned=[];
   for(const e of expected){
    if(e.value===''||e.value===null)continue;
    const index=e.col-1;
    if(r[index]!==''&&r[index]!==null)continue;
    const rt=rich[n][index];
    if(formulas[n][index]||validations[n][index]||(rt&&(rt.getLinkUrl()||rt.getRuns().some(run=>run.getLinkUrl())))){
     report.holds.push({id,col:e.col,why:'STRUCTURE_PROTECTED'});continue;
    }
    planned.push({col:e.col,header:headers[index],source:e.evidence,valueLength:String(e.value).length});
   }
   report.sourceChecks.push({id,guid,feed:feedUrl,officialJson:jsonStatus});
   report.plans.push({id,cells:planned});
  }
  console.log(JSON.stringify(report));return report;
 }finally{lock.releaseLock();}
}
