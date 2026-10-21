/** READ ONLY: Cross-check unmatched copy rows' URL UUIDs against staged official RSS. */
function previewLibraryV3AudioUuidCrosscheck(){
  const started=Date.now(),copyId='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc';
  const show='ニュースの現場から';
  const m={mode:'READ_ONLY_AUDIO_UUID_CROSSCHECK',status:'',show,copySheetId:copyId,
    writes:0,sourceWrites:0,propertyWrites:0,triggerChanges:0,networkProbes:0,
    spotifyPosts:0,counts:{},samples:{}};
  const count=(k,d)=>{m.counts[k]=(m.counts[k]||0)+1;
    const a=m.samples[k]||(m.samples[k]=[]);if(a.length<15)a.push(d);};
  const uuid=v=>[...new Set((String(v||'').match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi)||[]).map(x=>x.toLowerCase()))];
  try{
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===show);
    if(feeds.length!==1)throw Error('Feed config invalid');
    libV3CopyPilotId_({copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    const copy=libV3Context_(false,{copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    if(copy.ss.getId()===source.ss.getId()||copy.ss.getId()!==copyId)
      throw Error('Isolation failed');
    if(copy.rows.length!==source.rows.length)throw Error('Row counts differ');
    const fileId=PropertiesService.getScriptProperties().getProperty('LV3A_DRIVE_SNAPSHOT_FILE_ID');
    if(!fileId)throw Error('RSS staging not found');
    const pack=JSON.parse(Utilities.ungzip(DriveApp.getFileById(fileId).getBlob()).getDataAsString('UTF-8'));
    if(pack.v!==3||pack.feedUrl!==feeds[0].url||!Array.isArray(pack.items))
      throw Error('RSS staging mismatch');
    m.rssItems=pack.items.length;
    const guidCounts=new Map(),rssUuid=new Map(),matched=new Set();
    pack.items.forEach((it,idx)=>{
      if(it.guid)guidCounts.set(it.guid,(guidCounts.get(it.guid)||0)+1);
      for(const u of new Set([...uuid(it.guid),...uuid(it.audio)])){
        const hits=rssUuid.get(u)||new Set();hits.add(idx);rssUuid.set(u,hits);
      }
    });
    for(const it of pack.items){
      if(!it.guid||guidCounts.get(it.guid)!==1)continue;
      const hits=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
      if(hits.length!==1)continue;
      const i=hits[0],r=copy.rows[i];
      if(r[1]===show&&!libV3Text_(r[14]))matched.add(i);
    }
    const rows=[],uuidOwners=new Map();
    for(let i=0;i<copy.rows.length;i++){
      const r=copy.rows[i];
      if(r[1]!==show||libV3Text_(r[14])||matched.has(i))continue;
      const id=String(r[0]),us=new Set();
      r.forEach(v=>(String(v||'').match(/https?:\/\/[^\s"'<>]+/gi)||[])
        .forEach(url=>uuid(url).forEach(u=>us.add(u))));
      rows.push({id,row:i+2,uuids:[...us]});
      for(const u of us){const a=uuidOwners.get(u)||new Set();a.add(id);uuidOwners.set(u,a);}
    }
    for(const r of rows){
      const d={id:r.id,row:r.row};count('unmatchedRows',d);
      if(!r.uuids.length){count('noUrlUuid',d);continue;}
      const unique=r.uuids.filter(u=>uuidOwners.get(u).size===1);
      if(unique.length)count('hasRowUniqueUuid',{...d,count:unique.length});
      if(r.uuids.length>unique.length)count('hasSharedUuid',d);
      const candidates=new Set(),strong=new Set();
      for(const u of r.uuids){
        for(const idx of rssUuid.get(u)||[]){
          candidates.add(idx);
          if(uuidOwners.get(u).size===1&&/^https:\/\//.test(pack.items[idx].audio||''))
            strong.add(idx);
        }
      }
      if(!candidates.size)count('noRssUuidOverlap',d);
      else if(strong.size===1)count('oneUniqueUuidRssCandidate',{...d,rssCandidateCount:candidates.size});
      else if(strong.size>1)count('multipleUniqueUuidRssCandidates',{...d,count:strong.size});
      else count('onlySharedOrNoAudioRssCandidates',{...d,count:candidates.size});
    }
    m.status='READ_ONLY_COMPLETE';
    m.note='UUID overlap is a lead, NOT proof of episode identity. No audio URL is approved for writing by this report.';
    return m;
  }catch(e){m.status='FAILED';m.error=String(e).slice(0,400);return m;}
  finally{m.elapsedMs=Date.now()-started;Logger.log(JSON.stringify(m));}
}
