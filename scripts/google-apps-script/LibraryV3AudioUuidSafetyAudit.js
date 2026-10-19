/**
 * READ ONLY: safety gate for UUID-matched, previously unmatched audio URLs.
 * Isolated copy only. No URL is written, no triggers/properties are changed.
 * Uses the same metadata and state guards as the existing batch writer.
 */
function previewLibraryV3AudioUuidSafety(){
  const started=Date.now(),copyId='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc';
  const show='ニュースの現場から';
  const out={mode:'READ_ONLY_AUDIO_UUID_SAFETY',status:'',show,copySheetId:copyId,
    writes:0,sourceWrites:0,propertyWrites:0,triggerChanges:0,
    spotifyPosts:0,networkProbes:0,counts:{},samples:{}};
  const note=(key,id,row)=>{out.counts[key]=(out.counts[key]||0)+1;
    const a=out.samples[key]||(out.samples[key]=[]);
    if(a.length<15)a.push({id,row});};
  const uuids=v=>[...new Set((String(v||'').match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)||[]).map(s=>s.toLowerCase()))];
  try{
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===show);
    if(feeds.length!==1)throw Error('Expected one official feed');
    libV3CopyPilotId_({copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    const copy=libV3Context_(false,{copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    if(copy.ss.getId()===source.ss.getId()||copy.ss.getId()!==copyId)
      throw Error('Source/copy isolation failed');
    if(source.rows.length!==copy.rows.length)throw Error('Row counts differ');
    const fileId=PropertiesService.getScriptProperties().getProperty('LV3A_DRIVE_SNAPSHOT_FILE_ID');
    if(!fileId)throw Error('RSS staging missing');
    const pack=JSON.parse(Utilities.ungzip(DriveApp.getFileById(fileId).getBlob()).getDataAsString('UTF-8'));
    if(pack.v!==3||pack.feedUrl!==feeds[0].url||!Array.isArray(pack.items))
      throw Error('RSS staging mismatch');
    out.rssItems=pack.items.length;
    out.rssStagingAgeHours=Math.round((Date.now()-pack.createdAt)/360000)/10;
    const formulas=copy.sh.getRange(2,15,copy.rows.length,1).getFormulas();
    const sourceFormulas=source.sh.getRange(2,15,source.rows.length,1).getFormulas();
    const rssGuidCounts=new Map(),rssUuid=new Map(),matched=new Set();
    pack.items.forEach((it,idx)=>{
      if(it.guid)rssGuidCounts.set(it.guid,(rssGuidCounts.get(it.guid)||0)+1);
      for(const u of new Set([...uuids(it.guid),...uuids(it.audio)])){
        const set=rssUuid.get(u)||new Set();set.add(idx);rssUuid.set(u,set);
      }
    });
    for(const it of pack.items){
      if(!it.guid||rssGuidCounts.get(it.guid)!==1)continue;
      const hits=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
      if(hits.length===1&&copy.rows[hits[0]][1]===show&&
         !libV3Text_(copy.rows[hits[0]][14]))matched.add(hits[0]);
    }
    const targets=[],owners=new Map();
    for(let i=0;i<copy.rows.length;i++){
      const r=copy.rows[i];
      if(r[1]!==show||libV3Text_(r[14])||matched.has(i))continue;
      const ids=new Set();
      r.forEach(v=>(String(v||'').match(/https?:\/\/[^\s"'<>]+/gi)||[])
        .forEach(url=>uuids(url).forEach(u=>ids.add(u))));
      targets.push({i,ids:[...ids]});
      for(const u of ids){const set=owners.get(u)||new Set();set.add(i);owners.set(u,set);}
    }
    for(const {i,ids} of targets){
      const sr=source.rows[i],cr=copy.rows[i],id=String(cr[0]),row=i+2;
      note('examined',id,row);
      const strong=new Set();
      for(const u of ids){
        if(owners.get(u).size!==1)continue;
        for(const idx of rssUuid.get(u)||[]){
          if(/^https:\/\//.test(pack.items[idx].audio||''))strong.add(idx);
        }
      }
      if(strong.size!==1){note(strong.size?'multipleCandidates':'noUniqueCandidate',id,row);continue;}
      const it=pack.items[[...strong][0]];
      if(!it.guid||rssGuidCounts.get(it.guid)!==1){
        note('rssGuidNotUnique',id,row);continue;
      }
      if(String(sr[0])!==id||sr[1]!==show||
         (source.index.ids.get(id)||[]).length!==1||
         (copy.index.ids.get(id)||[]).length!==1){
        note('rowIdentityHold',id,row);continue;
      }
      if(source.index.tomb.is.has(id)||copy.index.tomb.is.has(id)||
         source.index.tomb.gs.has(it.guid)||copy.index.tomb.gs.has(it.guid)){
        note('exclusionHold',id,row);continue;
      }
      if(libV3Text_(sr[14])||libV3Text_(cr[14])||
         formulas[i][0]||sourceFormulas[i][0]){
        note('audioOrFormulaHold',id,row);continue;
      }
      if(libV3Hash_(sr.map((v,j)=>j===14?'':v))!==
         libV3Hash_(cr.map((v,j)=>j===14?'':v))){
        note('sourceCopyDiverged',id,row);continue;
      }
      const reasons=[...libV2CpRowReasons_(it,show,sr,source.index.ids,source.index.tomb),
        ...libV2CpRowReasons_(it,show,cr,copy.index.ids,copy.index.tomb)];
      if(reasons.length){
        note('metadataHold',id,row);
        reasons.forEach(reason=>{const k='reason_'+String(reason).slice(0,70);
          out.counts[k]=(out.counts[k]||0)+1;});
        continue;
      }
      const sp=source.index.states.get(id+'|audio'),cp=copy.index.states.get(id+'|audio');
      if([sp,cp].some(p=>p&&(['HOLD','RECHECK_REQUIRED'].includes(p[2])||
          (p[6]&&p[6]!==libV3Hash_(''))))){
        note('stateHold',id,row);continue;
      }
      // Diagnostic only: this is not an approval to write.
      note('passedAllCheckedGuards',id,row);
    }
    out.status='READ_ONLY_COMPLETE';
    out.note='Passing this report does not authorize writes. A later writer must revalidate all guards and avoid races with the scheduled batch.';
    return out;
  }catch(e){out.status='FAILED';out.error=String(e).slice(0,400);return out;}
  finally{out.elapsedMs=Date.now()-started;Logger.log(JSON.stringify(out));}
}
