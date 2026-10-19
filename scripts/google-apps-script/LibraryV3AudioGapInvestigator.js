/**
 * Phase 6 — Missing audio URL investigation, READ ONLY.
 * Install in isolated GAS only. No writes, no triggers, no properties.
 * Does not acquire the backfill writer's script lock: safe parallel read.
 * First pass uses existing ledger links and durable official RSS staging.
 * Omny/other network verification is deliberately a later, separately approved step.
 */
function previewLibraryV3AudioGaps(){
  return libV3AudioGapInvestigator_({
    copySheetId:'19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc',
    show:'ニュースの現場から',sampleLimit:25
  });
}
function libV3AudioGapInvestigator_(o){
  const t=Date.now();
  const m={mode:'READ_ONLY_AUDIO_GAP_INVESTIGATION',status:'',show:o.show,
    copySheetId:o.copySheetId,writes:0,sourceWrites:0,propertyWrites:0,
    triggerChanges:0,spotifyPosts:0,networkProbes:0,counts:{},samples:{}};
  const inc=k=>m.counts[k]=(m.counts[k]||0)+1;
  const sample=(k,v)=>{const a=m.samples[k]||(m.samples[k]=[]);
    if(a.length<o.sampleLimit)a.push(v);};
  try{
    if(o.copySheetId!=='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc'||
       o.show!=='ニュースの現場から')throw Error('Isolated copy/show only');
    const source=libV3Context_(false);
    const feeds=source.feeds.filter(f=>f.show===o.show);
    if(feeds.length!==1)throw Error('Feed must be unique');
    const feed=feeds[0];
    libV3CopyPilotId_({copySheetId:o.copySheetId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    const copy=libV3Context_(false,{copySheetId:o.copySheetId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feed.url});
    if(copy.ss.getId()===source.ss.getId()||copy.ss.getId()!==o.copySheetId)
      throw Error('Copy isolation check failed');
    if(copy.rows.length!==source.rows.length)throw Error('Source/copy row counts diverged');
    const formulas=copy.sh.getRange(2,15,copy.rows.length,1).getFormulas();
    // Read ONLY existing staging; do not refresh the feed or mutate properties.
    const fileId=PropertiesService.getScriptProperties()
      .getProperty('LV3A_DRIVE_SNAPSHOT_FILE_ID');
    let rss=null,stagingAgeHours=null;
    if(fileId){
      const pack=JSON.parse(Utilities.ungzip(DriveApp.getFileById(fileId)
        .getBlob()).getDataAsString('UTF-8'));
      if(pack.v===3&&pack.feedUrl===feed.url&&Array.isArray(pack.items)){
        rss=pack.items;
        stagingAgeHours=Math.round((Date.now()-pack.createdAt)/360000)/10;
      }
    }
    const guidCounts=new Map();
    if(rss)rss.forEach(it=>{
      if(!it.guid)return;
      guidCounts.set(it.guid,(guidCounts.get(it.guid)||0)+1);
    });
    m.rssSnapshotAvailable=!!rss;
    m.rssStagingAgeHours=stagingAgeHours;
    // Only the named show; each copy row is examined once.
    for(let i=0;i<copy.rows.length;i++){
      const r=copy.rows[i],sr=source.rows[i],id=String(r[0]||'');
      if(r[1]!==o.show)continue;
      inc('showRows');
      if(libV3Text_(r[14])){inc('copyAudioPresent');continue;}
      inc('copyAudioBlank');
      const row=i+2;
      const detail={id,row};
      if(String(sr[0])!==id||sr[1]!==r[1]){
        inc('sourceCopyIdentityHold');sample('identityHold',detail);continue;
      }
      if(formulas[i][0]){inc('formulaHold');sample('formulaHold',detail);continue;}
      if(source.index.tomb.is.has(id)||copy.index.tomb.is.has(id)){
        inc('excludedHold');sample('excludedHold',detail);continue;
      }
      const anchor=String(r[8]||'');
      // Column I holds a historical Omny episode page in this ledger.
      if(/https:\/\/[^\s]*omny(?:content)?\.com\//i.test(anchor)){
        inc('omnyPageCandidate');sample('omnyPageCandidate',{...detail,linkColumn:'I'});
      }else{
        inc('noOmnyPageCandidate');sample('noOmnyPageCandidate',detail);
      }
      if(!rss)inc('rssSnapshotUnavailable');
    }
    if(rss){
      const classified=new Map();
      for(const it of rss){
        if(!it.guid||guidCounts.get(it.guid)!==1)continue;
        const dst=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
        if(dst.length!==1)continue;
        const i=dst[0],r=copy.rows[i];
        if(r[1]!==o.show||libV3Text_(r[14]))continue;
        const a=classified.get(i)||[];
        a.push(it);
        classified.set(i,a);
      }
      const rssMatchedRows=new Set(classified.keys());
      for(let i=0;i<copy.rows.length;i++){
        const r=copy.rows[i];
        if(r[1]!==o.show||libV3Text_(r[14])||rssMatchedRows.has(i))continue;
        inc('noUniqueRssMatch');
        sample('noUniqueRssMatch',{id:String(r[0]),row:i+2});
      }
      for(const [i,hits] of classified){
        const r=copy.rows[i],id=String(r[0]),detail={id,row:i+2};
        if(hits.length!==1){inc('rssMultipleCandidates');sample('rssMultipleCandidates',detail);continue;}
        const it=hits[0];
        if(!/^https:\/\//.test(it.audio||'')){
          inc('rssMatchedButNoHttpsAudio');sample('rssMatchedButNoHttpsAudio',detail);
        }else{
          inc('rssHasAudioButStillBlank');sample('rssHasAudioButStillBlank',detail);
        }
      }
    }
    m.status='READ_ONLY_COMPLETE';
    m.note='Categories are diagnostic and may overlap; noUniqueRssMatch means no unique RSS GUID/anchor match, not proof audio is unavailable. No Omny link was fetched or played.';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,400);return m;}
  finally{m.elapsedMs=Date.now()-t;Logger.log(JSON.stringify(m));}
}
