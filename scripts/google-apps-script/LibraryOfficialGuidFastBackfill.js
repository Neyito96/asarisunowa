/**
 * V2 FAST ARCHIVE: existing official Asahi episode URL -> GUID.
 * Safely restores missing GUIDs without relying on title/date alone.
 * Does NOT fetch Spotify or change existing URLs, titles, EP IDs, exclusions.
 * Uses one bulk ledger read, bounded 80-cell write batches and existing history.
 * Deploy to the same GAS project as V2; run writeLibraryOfficialGuidPilot10 once,
 * then writeLibraryOfficialGuidBatch80 after inspecting the pilot.
 */
function writeLibraryOfficialGuidPilot10(){return writeLibraryOfficialGuidBatch_(10);}
function writeLibraryOfficialGuidBatch80(){return writeLibraryOfficialGuidBatch_(80);}
function previewLibraryOfficialGuidFast(){return writeLibraryOfficialGuidBatch_(0);}
function writeLibraryOfficialGuidBatch_(limit){
  if(![0,10,80].includes(limit))throw Error('Unsupported batch limit');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))throw Error('Another library writer running');
  try{
    const started=Date.now();
    const ss=SpreadsheetApp.openById('1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4');
    const sh=ss.getSheetByName('エピソード台帳'),history=ss.getSheetByName('自動補完・実行履歴');
    if(!sh||!history)throw Error('Required sheets missing');
    const data=sh.getDataRange().getValues(),headers=data.shift();
    const required={0:'台帳ID',6:'外部ID',9:'公式個別URL',11:'Spotify個別URL',38:'人間除外'};
    Object.keys(required).forEach(k=>{if(headers[+k]!==required[k])throw Error('Ledger header mismatch at '+(+k+1));});
    const expected=['実行日時','状態','対象EP数','書込セル数','保留件数','更新EP-ID','開始フィード','次フィード','処理秒数','備考'];
    if(expected.some((v,i)=>history.getRange(1,i+1).getValue()!==v))throw Error('History header mismatch');
    const guid=s=>{const m=String(s||'').trim().match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return m?m[1].toLowerCase():'';};
    const excluded=s=>{const v=String(s||'').trim().toLowerCase();return v!==''&&!['未指定','なし','false','0','no'].includes(v);};
    const known=new Map(),official=new Map();
    data.forEach((r,i)=>{
      const g=guid(r[6]);if(g){if(!known.has(g))known.set(g,[]);known.get(g).push(i+2);}
      const u=String(r[9]||'').trim(),m=u.match(/^https:\/\/www\.asahi\.com\/special\/podcasts\/item\/\?itemid=([0-9a-f-]{36})(?:&.*)?$/i);
      if(m){const x=guid(m[1]);if(x){if(!official.has(x))official.set(x,[]);official.get(x).push(i+2);}}
    });
    const plan=[],holds={excluded:0,duplicate:0,mismatch:0,missingOfficial:0,existingGuid:0};
    data.forEach((r,i)=>{
      if(!/^EP-\d+$/.test(String(r[0]||'')))return;
      if(String(r[6]||'').trim()){holds.existingGuid++;return;}
      if(excluded(r[38])){holds.excluded++;return;}
      const u=String(r[9]||'').trim();
      const m=u.match(/^https:\/\/www\.asahi\.com\/special\/podcasts\/item\/\?itemid=([0-9a-f-]{36})(?:&.*)?$/i);
      if(!m){holds.missingOfficial++;return;}
      const g=guid(m[1]);
      if(!g){holds.mismatch++;return;}
      if(known.has(g)||!official.has(g)||official.get(g).length!==1){holds.duplicate++;return;}
      plan.push({row:i+2,id:String(r[0]),guid:g,official:u,spotify:String(r[11]||'')});
    });
    const selected=plan.slice(0,limit),writes=[];
    if(limit>0){
      const check=sh.getDataRange().getValues();
      for(const p of selected){
        const r=check[p.row-1];
        if(String(r[0])!==p.id||String(r[6]||'').trim()||String(r[9]||'').trim()!==p.official||excluded(r[38]))throw Error('Protected row changed: '+p.id);
        writes.push(p);
      }
      // Recheck all selected GUIDs for uniqueness against live data.
      const liveGuid=check.slice(1).map(r=>guid(r[6])).filter(Boolean);
      const occupied=new Set(liveGuid);
      if(writes.some(p=>occupied.has(p.guid)))throw Error('GUID already occupied; stop');
      for(const p of writes)sh.getRange(p.row,7).setValue(p.guid);
      SpreadsheetApp.flush();
      for(const p of writes)if(guid(sh.getRange(p.row,7).getValue())!==p.guid)throw Error('Verification failed '+p.id);
      history.appendRow([
        Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyyy/MM/dd HH:mm:ss'),
        'V2_GUID_SUCCESS',writes.length,writes.length,holds.excluded+holds.duplicate+holds.mismatch,
        writes.map(x=>x.id).join(', '),'OFFICIAL_URL','—',Math.round((Date.now()-started)/1000),
        'V2 official URL itemid GUID restore; empty G only; batch='+limit+'; preview candidates='+plan.length
      ]);
    }
    const result={mode:limit?'V2_GUID_WRITE':'V2_GUID_PREVIEW',candidateCount:plan.length,selected:writes.length,holds,firstCandidates:plan.slice(0,15).map(x=>({id:x.id,row:x.row,guid:x.guid,spotifyPresent:!!x.spotify})),writes:writes.length,history:limit?'APPENDED':'UNCHANGED',elapsedSeconds:Math.round((Date.now()-started)/1000)};
    Logger.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
