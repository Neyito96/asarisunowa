/**
 * Owner-approved: isolated COPY O-column only, up to 25 UUID-safe episodes.
 * Never run in production GAS. Manual once, no trigger. Shares script lock
 * with the existing scheduled backfill. No property changes or RSS fetches.
 */
function runApprovedLibraryV3AudioUuidBatch25(){
  const started=Date.now(),lock=LockService.getScriptLock();
  const copyId='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc';
  const show='ニュースの現場から';
  const pilotIds=['EP-01934','EP-01972','EP-02000'];
  const m={mode:'APPROVED_COPY_ONLY_UUID_BATCH25',status:'',copySheetId:copyId,
    maxWrites:25,writes:0,sourceWrites:0,propertyWrites:0,
    triggerChanges:0,spotifyPosts:0,networkProbes:0,samples:[],skipped:{},pilotVerified:0};
  if(!lock.tryLock(1000)){m.status='BUSY';Logger.log(JSON.stringify(m));return m;}
  const uuids=v=>[...new Set((String(v||'').match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)||[]).map(s=>s.toLowerCase()))];
  try{
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===show);
    if(feeds.length!==1)throw Error('Official feed not unique');
    libV3CopyPilotId_({copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    const copy=libV3Context_(false,{copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    if(source.ss.getId()===copy.ss.getId()||copy.ss.getId()!==copyId)
      throw Error('Production/copy isolation failed');
    if(source.rows.length!==copy.rows.length)throw Error('Row count divergence');
    const fileId=PropertiesService.getScriptProperties().getProperty('LV3A_DRIVE_SNAPSHOT_FILE_ID');
    if(!fileId)throw Error('RSS staging missing');
    const pack=JSON.parse(Utilities.ungzip(DriveApp.getFileById(fileId).getBlob()).getDataAsString('UTF-8'));
    if(pack.v!==3||pack.feedUrl!==feeds[0].url||!Array.isArray(pack.items)||
       !pack.createdAt||Date.now()-pack.createdAt>24*60*60*1000)
      throw Error('RSS staging missing, stale, or mismatched; no write');
    const rssGuidCounts=new Map(),rssUuid=new Map(),matched=new Set();
    pack.items.forEach((it,idx)=>{
      if(it.guid)rssGuidCounts.set(it.guid,(rssGuidCounts.get(it.guid)||0)+1);
      for(const u of new Set([...uuids(it.guid),...uuids(it.audio)])){
        const hits=rssUuid.get(u)||new Set();hits.add(idx);rssUuid.set(u,hits);
      }
    });
    for(const it of pack.items){
      if(!it.guid||rssGuidCounts.get(it.guid)!==1)continue;
      const hits=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
      if(hits.length===1&&copy.rows[hits[0]][1]===show&&
         !libV3Text_(copy.rows[hits[0]][14]))matched.add(hits[0]);
    }
    const unmatched=[],owners=new Map();
    for(let i=0;i<copy.rows.length;i++){
      const r=copy.rows[i];
      if(r[1]!==show||libV3Text_(r[14])||matched.has(i))continue;
      const ids=new Set();
      r.forEach(v=>(String(v||'').match(/https?:\/\/[^\s"'<>]+/gi)||[])
        .forEach(url=>uuids(url).forEach(u=>ids.add(u))));
      unmatched.push({i,ids:[...ids]});
      for(const u of ids){const set=owners.get(u)||new Set();set.add(i);owners.set(u,set);}
    }
    // Verify that the earlier pilot is still present in the COPY and absent in source.
    for(const id of pilotIds){
      const si=source.index.ids.get(id)||[],ci=copy.index.ids.get(id)||[];
      if(si.length!==1||ci.length!==1||si[0]!==ci[0])throw Error('Pilot identity changed: '+id);
      const sr=source.rows[si[0]],cr=copy.rows[ci[0]];
      if(libV3Text_(sr[14])||!/^https:\/\//.test(String(cr[14]||'')))
        throw Error('Pilot readback failed: '+id);
      if(copy.sh.getRange(ci[0]+2,15).getFormula()||
         String(copy.sh.getRange(ci[0]+2,15).getValue())!==String(cr[14]))
        throw Error('Pilot live readback failed: '+id);
      m.pilotVerified++;
    }
    const plans=[],seenRss=new Set();
    for(const entry of unmatched){
      if(Date.now()-started>120000){m.status='TIME_BUDGET';break;}
      const id=String(copy.rows[entry.i][0]);
      try{
      const si=source.index.ids.get(id)||[],ci=copy.index.ids.get(id)||[];
      if(si.length!==1||ci.length!==1||si[0]!==ci[0])throw Error('EP-ID ambiguity: '+id);
      const i=ci[0],sr=source.rows[i],cr=copy.rows[i],row=i+2;
      if(String(sr[0])!==id||String(cr[0])!==id||sr[1]!==show||cr[1]!==show)
        throw Error('EP/show identity mismatch: '+id);
      const candidate=entry;
      if(!candidate)throw Error('No longer unmatched/blank: '+id);
      const strong=new Set();
      for(const u of candidate.ids){
        if(owners.get(u).size!==1)continue;
        for(const idx of rssUuid.get(u)||[]){
          if(/^https:\/\//.test(pack.items[idx].audio||''))strong.add(idx);
        }
      }
      if(strong.size!==1)throw Error('UUID candidate not unique: '+id);
      const idx=[...strong][0],it=pack.items[idx];
      if(seenRss.has(idx))throw Error('RSS item reused by two EP-IDs');
      seenRss.add(idx);
      if(!it.guid||rssGuidCounts.get(it.guid)!==1)
        throw Error('RSS GUID missing/duplicated: '+id);
      if(source.index.tomb.is.has(id)||copy.index.tomb.is.has(id)||
         source.index.tomb.gs.has(it.guid)||copy.index.tomb.gs.has(it.guid))
        throw Error('Exclusion protection: '+id);
      if(libV3Text_(sr[14])||libV3Text_(cr[14]))
        throw Error('Audio already present: '+id);
      if(source.sh.getRange(row,15).getFormula()||
         copy.sh.getRange(row,15).getFormula())throw Error('Formula protected: '+id);
      if(libV3Hash_(sr.map((v,j)=>j===14?'':v))!==
         libV3Hash_(cr.map((v,j)=>j===14?'':v)))
        throw Error('Copy/source divergence: '+id);
      const reasons=[...libV2CpRowReasons_(it,show,sr,source.index.ids,source.index.tomb),
        ...libV2CpRowReasons_(it,show,cr,copy.index.ids,copy.index.tomb)];
      if(reasons.length)throw Error('Metadata hold '+id+': '+[...new Set(reasons)].join('|'));
      const sp=source.index.states.get(id+'|audio'),cp=copy.index.states.get(id+'|audio');
      if([sp,cp].some(p=>p&&(['HOLD','RECHECK_REQUIRED'].includes(p[2])||
         (p[6]&&p[6]!==libV3Hash_('')))))throw Error('State hold: '+id);
      plans.push({id,row,audio:it.audio});
      if(plans.length>=25)break;
      }catch(e){
        const reason=String(e).replace(/^Error:\s*/,'').split(':')[0].slice(0,55);
        m.skipped[reason]=(m.skipped[reason]||0)+1;
      }
    }
    // Recheck each live cell under the same script lock.
    // The existing scheduled batch uses this lock too.
    for(const p of plans){
      if(Date.now()-started>155000){m.status='TIME_BUDGET_PARTIAL';break;}
      const cell=copy.sh.getRange(p.row,15);
      if(cell.getFormula()||libV3Text_(cell.getValue())||
         String(copy.sh.getRange(p.row,1).getValue())!==p.id)
        {m.status='CHANGED_BEFORE_WRITE';break;}
      cell.setValue(p.audio);
      SpreadsheetApp.flush();
      if(String(cell.getValue())!==p.audio)throw Error('Post-write verification failed: '+p.id);
      m.writes++;m.samples.push({id:p.id,row:p.row});
    }
    if(!m.status)m.status=m.writes?'COPY_BATCH25_SAVED':'NO_ELIGIBLE_CANDIDATES';
    return m;
  }catch(e){m.status=m.writes?'PARTIAL_FAILURE':'HOLD_NO_WRITES';
    m.error=String(e).slice(0,450);return m;}
  finally{m.elapsedMs=Date.now()-started;lock.releaseLock();Logger.log(JSON.stringify(m));}
}
