/**
 * Phase 14 — explicit ONE-ITEM COPY registration, Omny only.
 * Call manually after read-only queue review. Never installs triggers or touches production.
 * Uses existing parser, material mapping, integrity checks and atomic Sheets REST batch.
 */
function registerOldestSpongeCopyOne(){
 'use strict';
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const GUID='13a056a0-27b2-4079-a9e5-b4e5006200d0';
 const SHOW='スポンジ';
 const E=LibraryOfficialEngine,lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))throw Error('COPY_LOCK_BUSY');
 try{
  if(COPY===PROD)throw Error('PRODUCTION_FORBIDDEN');
  const ss=SpreadsheetApp.openById(COPY);
  if(ss.getId()!==COPY)throw Error('COPY_ID_CONFLICT');
  const source=ss.getSheetByName('取得元一覧');
  if(!source)throw Error('COPY_SOURCE_MISSING');
  const sourceRows=source.getRange(2,1,7,8).getValues();
  const feedRow=sourceRows.filter(r=>String(r[0]).trim()===SHOW);
  if(feedRow.length!==1)throw Error('SHOW_SOURCE_AMBIGUOUS');
  const url=String(feedRow[0][7]||'').trim();
  if(!/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//.test(url))throw Error('NOT_OFFICIAL_OMNY');
  const matches=E.rss({show:SHOW,url}).filter(x=>x.guid===GUID);
  if(matches.length!==1)throw Error('RSS_GUID_NOT_UNIQUE');
  const item=matches[0],evidence=E.official(item);
  item.platformEvidence=E.platforms(item,{show:SHOW,url});
  const material=E.material(item,evidence.clip,evidence.url);
  if(material.warnings?.length)throw Error('PARSER_WARNINGS_'+JSON.stringify(material.warnings));
  const c={sheetId:COPY,allowNew:true,newAfter:'2026-10-16T00:00:00+09:00'};
  let ctx=E.context(c);
  const guid=GUID.toLowerCase();
  if(ctx.rows.some(r=>E.identityTokens(r).includes(guid))||
     ctx.history.some(r=>String(r[0]).toLowerCase()===guid)){
    const found=ctx.rows.filter(r=>E.identityTokens(r).includes(guid)).map(r=>r[0]);
    const result={status:'ALREADY_REGISTERED',guid:GUID,ids:found,writes:0};
    console.log('COPY_ONE_RESULT '+JSON.stringify(result));return result;
  }
  const states=ctx.states.map(r=>{
   if(!r[1])return ['',r[0]];
   const identity=JSON.parse(r[1]).identity;
   return [identity?.[1]||'',r[0]];
  });
  const decision=E.newDecision(item,ctx.rows,ctx.history.concat(states),
    ctx.excluded,ctx.decisions,c,{complete:true},'0');
  // Do not skip older unregistered Omny items or Megaphone items.
  // Fixed queue first position was confirmed in the 2026-10-24 11:25 read-only audit.
  const row=Array(55).fill('');
  Object.entries(material.values).forEach(([k,v])=>row[Number(k)]=v);
  Object.assign(row,{0:decision,1:SHOW,2:item.title,
   3:new Date(Date.parse(item.pubDate)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' '),
   4:'音声',5:'朝日新聞ポッドキャスト公式RSS（Omny Studio）',
   6:GUID,8:item.link,18:'未確認（未再生）',38:'未指定'});
  const now=new Date().toISOString();
  const proof=E.rowHash(row);
  const state={identity:['VERIFIED',GUID,proof,'','','RSS_registered',now,GUID],
   registrationEvidence:['VERIFIED',GUID,proof,'','','official_rss_plus_json',now,
    JSON.stringify({source:url,json:evidence.url,pubDate:item.pubDate,mode:'COPY_ONE'})]};
  // Re-read immediately before write; refuse if any ledger or identity store changed.
  const again=E.context(c);
  if(JSON.stringify(again.rows)!==JSON.stringify(ctx.rows)||
     JSON.stringify(again.history)!==JSON.stringify(ctx.history)||
     JSON.stringify(again.states)!==JSON.stringify(ctx.states)||
     JSON.stringify(again.excluded)!==JSON.stringify(ctx.excluded)||
     JSON.stringify(again.decisions)!==JSON.stringify(ctx.decisions))
    throw Error('CONCURRENT_COPY_CHANGE_RETRY_PREFLIGHT');
  ctx=again;
  const ledger=ctx.tabs['エピソード台帳'],history=ctx.tabs['固定ID採番履歴'],
    stateTab=ctx.tabs['図書館V3・項目状態'];
  if(!ledger||!history||!stateTab)throw Error('TARGET_TABS_MISSING');
  const lr=ctx.rows.length+1,hr=ctx.history.length+1,sr=ctx.stateLength;
  const requests=[];
  [[ledger,lr],[history,hr],[stateTab,sr]].forEach(([tab,index])=>{
   if(index>=tab.gridProperties.rowCount)requests.push({appendDimension:{
    sheetId:tab.sheetId,dimension:'ROWS',length:index-tab.gridProperties.rowCount+1}});
  });
  for(const pasteType of ['PASTE_FORMAT','PASTE_DATA_VALIDATION'])
   requests.push({copyPaste:{source:{sheetId:ledger.sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:55},
    destination:{sheetId:ledger.sheetId,startRowIndex:lr,endRowIndex:lr+1,startColumnIndex:0,endColumnIndex:55},pasteType}});
  row.forEach((v,col)=>{
   const cell=E.cell(v);
   if(col===28&&v)cell.textFormatRuns=E.articleLinkRuns(material.links);
   if(col===21)cell.note=JSON.stringify({source:url,guid:GUID,raw:true,copyTest:true});
   requests.push(E.update(ledger.sheetId,lr,col,cell));
  });
  [GUID,decision,SHOW,item.title,'登録完了',now].forEach((v,col)=>
   requests.push(E.update(history.sheetId,hr,col,E.cell(v))));
  [decision,JSON.stringify(state),now].forEach((v,col)=>
   requests.push(E.update(stateTab.sheetId,sr,col,E.cell(v))));
  E.api(c,':batchUpdate',{requests});
  const after=E.context(c);
  if(after.rows.filter(r=>r[0]===decision&&r[6]===GUID).length!==1||
     after.history.filter(r=>r[0]===GUID&&r[1]===decision).length!==1||
     after.states.filter(r=>r[0]===decision).length!==1)
   throw Error('COPY_WRITE_READBACK_FAILED');
  const filled=row.map((v,i)=>v!==''?i+1:null).filter(x=>x!==null);
  const result={status:'COPY_ONE_REGISTERED',id:decision,guid:GUID,
   title:item.title,filledColumnsOneBased:filled,filledCount:filled.length,
   writes:1,productionWrites:0,triggerChanges:0};
  console.log('COPY_ONE_RESULT '+JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}
