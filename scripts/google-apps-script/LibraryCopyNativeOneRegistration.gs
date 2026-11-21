/**
 * Phase 14 copy-only, single-item registration using SpreadsheetApp.
 * No Sheets REST API, no triggers, no properties, no production writes.
 * IMPORTANT: SpreadsheetApp writes are NOT atomic across tabs. On partial failure,
 * STOP and inspect the three tabs manually; this function refuses automatic repair.
 */
function registerOldestSpongeCopyNativeOne(){
 'use strict';
 const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
 const PROD='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
 const GUID='13a056a0-27b2-4079-a9e5-b4e5006200d0';
 const SHOW='スポンジ';
 if(COPY===PROD)throw Error('PRODUCTION_FORBIDDEN');
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))throw Error('BUSY');
 try{
  const ss=SpreadsheetApp.openById(COPY);
  if(ss.getId()!==COPY)throw Error('COPY_ID_CONFLICT');
  const names=['取得元一覧','エピソード台帳','固定ID採番履歴','図書館V3・項目状態','削除・除外履歴','図書館・宇宙 検索対象判定'];
  const tabs={};
  names.forEach(name=>{tabs[name]=ss.getSheetByName(name);if(!tabs[name])throw Error('TAB_MISSING_'+name);});
  const source=tabs['取得元一覧'].getRange(2,1,7,8).getValues().filter(r=>String(r[0]).trim()===SHOW);
  if(source.length!==1)throw Error('SOURCE_AMBIGUOUS');
  const url=String(source[0][7]||'').trim();
  if(!/^https:\/\/www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\//.test(url))throw Error('NOT_OFFICIAL_OMNY');
  const E=LibraryOfficialEngine;
  const items=E.rss({show:SHOW,url}).filter(x=>x.guid===GUID);
  if(items.length!==1)throw Error('RSS_GUID_COUNT_'+items.length);
  const item=items[0],evidence=E.official(item);
  item.platformEvidence=E.platforms(item,{show:SHOW,url});
  const material=E.material(item,evidence.clip,evidence.url);
  if(material.warnings&&material.warnings.length)throw Error('PARSER_HOLD_'+JSON.stringify(material.warnings));
  const ledger=tabs['エピソード台帳'],history=tabs['固定ID採番履歴'],states=tabs['図書館V3・項目状態'];
  const rows=ledger.getDataRange().getValues(),head=rows.shift();
  if(head[0]!=='台帳ID'||head[21]!=='概要原文'||head.length<55)throw Error('LEDGER_SCHEMA_CONFLICT');
  const hr=history.getDataRange().getValues().slice(1);
  const sr=states.getDataRange().getValues().slice(1);
  const ex=tabs['削除・除外履歴'].getDataRange().getValues().slice(1);
  const dec=tabs['図書館・宇宙 検索対象判定'].getDataRange().getValues().slice(1);
  const lower=v=>String(v==null?'':v).trim().toLowerCase();
  const hasGuid=r=>E.identityTokens(r).includes(GUID)||r.some(v=>lower(v)===GUID);
  const ledgerHits=rows.filter(r=>hasGuid(r));
  const historyHits=hr.filter(r=>lower(r[0])===GUID);
  const stateHits=sr.filter(r=>{if(!r[1])return false;const s=JSON.parse(r[1]);return lower(s.identity?.[1])===GUID;});
  if(ledgerHits.length||historyHits.length||stateHits.length){
   if(ledgerHits.length===1&&historyHits.length===1&&stateHits.length===1&&
      ledgerHits[0][0]===historyHits[0][1]&&ledgerHits[0][0]===stateHits[0][0]){
    const result={status:'ALREADY_REGISTERED',id:ledgerHits[0][0],guid:GUID,writes:0};
    console.log('COPY_NATIVE_ONE_RESULT '+JSON.stringify(result));return result;
   }
   throw Error('PARTIAL_OR_CONFLICTING_REGISTRATION_MANUAL_REVIEW');
  }
  if(ex.some(r=>r.some(v=>lower(v)===GUID))||dec.some(r=>r.some(v=>lower(v)===GUID)))
   throw Error('GUID_RESERVED_OR_EXCLUDED');
  const ids=rows.map(r=>String(r[0]||''));
  if(ids.some(x=>!/^EP-\d{5}$/.test(x))||new Set(ids).size!==ids.length)throw Error('LEDGER_IDS_INVALID');
  if(rows.some(r=>lower(r[14])===lower(item.audio)||(lower(r[2])===lower(item.title)&&
     String(r[3])===new Date(Date.parse(item.pubDate)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' '))))
   throw Error('POSSIBLE_REISSUE');
  const reserved=[...ids,...hr.map(r=>r[1]),...ex.map(r=>r[1]),...dec.map(r=>r[0])]
   .filter(x=>/^EP-\d{5}$/.test(String(x)));
  const id='EP-'+String(Math.max(0,...reserved.map(x=>Number(String(x).slice(3))))+1).padStart(5,'0');
  if(id.length!==8)throw Error('ID_EXHAUSTED');
  const row=Array(55).fill('');
  Object.entries(material.values).forEach(([col,value])=>row[Number(col)]=value);
  Object.assign(row,{0:id,1:SHOW,2:item.title,
   3:new Date(Date.parse(item.pubDate)+32400000).toISOString().slice(0,19).replace(/-/g,'/').replace('T',' '),
   4:'音声',5:'朝日新聞ポッドキャスト公式RSS（Omny Studio）',
   6:GUID,8:item.link,18:'未確認（未再生）',38:'未指定'});
  const now=new Date().toISOString();
  const proof=E.rowHash(row);
  const state={identity:['VERIFIED',GUID,proof,'','','RSS_registered',now,GUID],
   registrationEvidence:['VERIFIED',GUID,proof,'','','official_rss_plus_json',now,
    JSON.stringify({source:url,json:evidence.url,pubDate:item.pubDate,mode:'COPY_NATIVE_ONE'})]};
  // Append only into a genuinely blank next row, never overwrite existing cells.
  const lr=ledger.getLastRow()+1,hi=history.getLastRow()+1,si=states.getLastRow()+1;
  for(const [sh,index,width]of [[ledger,lr,55],[history,hi,6],[states,si,3]]){
   if(index<=sh.getMaxRows()&&sh.getRange(index,1,1,width).getValues()[0].some(v=>v!==''))throw Error('DESTINATION_NOT_BLANK_'+sh.getName());
   if(index>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),index-sh.getMaxRows());
  }
  // LAST pre-write check: no concurrent rows appeared while fetching metadata.
  if(ledger.getLastRow()+1!==lr||history.getLastRow()+1!==hi||states.getLastRow()+1!==si)
   throw Error('ROW_COUNT_CHANGED');
  let phase='NOT_STARTED';
  try{
   phase='LEDGER';
   ledger.getRange(lr,1,1,55).setValues([row]);
   if(row[28])ledger.getRange(lr,29).setNote('公式記事URL（RSS解析）');
   ledger.getRange(lr,22).setNote(JSON.stringify({source:url,guid:GUID,raw:true,copyTest:true}));
   SpreadsheetApp.flush();
   phase='HISTORY';
   history.getRange(hi,1,1,6).setValues([[GUID,id,SHOW,item.title,'登録完了',now]]);
   SpreadsheetApp.flush();
   phase='STATE';
   states.getRange(si,1,1,3).setValues([[id,JSON.stringify(state),now]]);
   SpreadsheetApp.flush();
  }catch(e){
   console.log('COPY_NATIVE_PARTIAL_FAILURE '+JSON.stringify({phase,id,guid:GUID,error:String(e)}));
   throw Error('PARTIAL_WRITE_STOP_AND_INSPECT_'+phase+'_'+String(e));
  }
  const result={status:'COPY_NATIVE_ONE_REGISTERED',id,guid:GUID,title:item.title,
   filledColumnsOneBased:row.map((v,i)=>v!==''?i+1:null).filter(v=>v!==null),
   ledgerRow:lr,historyRow:hi,stateRow:si,productionWrites:0,triggerChanges:0};
  const ok=ledger.getRange(lr,1,1,7).getValues()[0][6]===GUID&&
   history.getRange(hi,1,1,2).getValues()[0][1]===id&&
   states.getRange(si,1).getValue()===id;
  if(!ok)throw Error('READBACK_MISMATCH_MANUAL_REVIEW');
  console.log('COPY_NATIVE_ONE_RESULT '+JSON.stringify(result));
  return result;
 }finally{lock.releaseLock();}
}
