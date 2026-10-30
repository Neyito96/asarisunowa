/**
 * Phase16 unattended W-gap patrol. READ_ONLY. Batches 200 rows / 15 min.
 * Automatically stops after a complete pass. No production writes, no changes
 * to P15 tick/triggers. Results persist in Script Properties.
 */
function p16ContinuousPatrolTick() {
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(1000)){console.log('P16_BUSY');return;}
 try {
  const p=PropertiesService.getScriptProperties();
  const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
  const sh=ss.getSheetByName('エピソード台帳');
  const last=sh.getLastRow();
  let start=Math.max(2,Number(p.getProperty('P16_W_CURSOR')||2));
  if(start>last){p16StopContinuousPatrol();console.log('P16_COMPLETE');return;}
  const count=Math.min(200,last-start+1), rows=sh.getRange(start,1,count,39).getValues();
  const buckets={cleanCandidate:[],articleReview:[],parserHold:[],empty:[]};
  for(const r of rows) {
    const id=String(r[0]||''),show=String(r[1]||''),v=String(r[21]||''),w=String(r[22]||''),excluded=String(r[38]||'').trim();
    if(!/^EP-\d{5,6}$/.test(id)||!v.trim()||w.trim())continue;
    if(/^(AJW|アルキキ|YouTube|朝ポキTV)$/.test(show))continue;
    if(excluded&&!/^(FALSE|false|0|いいえ|未指定)$/.test(excluded))continue;
    const q=PHASE15_INTEGRATED.clean(v);
    if(q.holds.length)buckets.parserHold.push(id);
    else if(!q.text.trim())buckets.empty.push(id);
    else if(/https?:\/\//i.test(v))buckets.articleReview.push(id);
    else buckets.cleanCandidate.push(id);
  }
  const result={mode:'READ_ONLY',start,end:start+count-1,next:start+count,
    counts:Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,v.length])),
    examples:Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,v.slice(0,4)])),writes:0};
  p.setProperty('P16_W_CURSOR',String(result.next));
  p.setProperty('P16_W_LAST',JSON.stringify(result));
  console.log(JSON.stringify(result));
  if(result.next>last)p16StopContinuousPatrol();
 }finally{lock.releaseLock();}
}
function p16StartContinuousPatrol() {
 const p=PropertiesService.getScriptProperties();
 if(!p.getProperty('P16_W_CURSOR'))p.setProperty('P16_W_CURSOR','2');
 const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='p16ContinuousPatrolTick');
 if(existing.length>1)throw Error('P16_DUPLICATE_TRIGGERS');
 if(!existing.length)ScriptApp.newTrigger('p16ContinuousPatrolTick').timeBased().everyMinutes(15).create();
 p16ContinuousPatrolTick();
 console.log('P16_ACTIVE_READ_ONLY');
}
function p16StopContinuousPatrol() {
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='p16ContinuousPatrolTick').forEach(t=>ScriptApp.deleteTrigger(t));
 console.log('P16_STOPPED');
}
