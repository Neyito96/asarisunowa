/**
 * Phase 6: explain the 288 rows with no unique RSS identity match.
 * READ ONLY; no triggers, sheet writes, property changes, or network requests.
 * Uses the existing isolated-copy RSS staging file.
 * Results are logged (counts + at most 20 samples per category).
 * Safe to run while the existing backfill timer is active.
 */
function previewLibraryV3AudioUnmatched288(){
  const t=Date.now(),copyId='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc';
  const show='ニュースの現場から';
  const out={mode:'READ_ONLY_AUDIO_UNMATCHED_DIAGNOSIS',status:'',show,
    copySheetId:copyId,writes:0,sourceWrites:0,propertyWrites:0,
    triggerChanges:0,networkProbes:0,spotifyPosts:0,counts:{},samples:{}};
  const add=(key,detail)=>{out.counts[key]=(out.counts[key]||0)+1;
    const arr=out.samples[key]||(out.samples[key]=[]);
    if(arr.length<20)arr.push(detail);};
  try{
    const source=libV3Context_(false);
    const feeds=source.feeds.filter(f=>f.show===show);
    if(feeds.length!==1)throw Error('Expected unique official RSS feed');
    libV3CopyPilotId_({copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    const copy=libV3Context_(false,{copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    if(copy.ss.getId()===source.ss.getId()||copy.ss.getId()!==copyId)
      throw Error('Production/copy isolation failed');
    if(copy.rows.length!==source.rows.length)throw Error('Ledger row counts differ');
    const fileId=PropertiesService.getScriptProperties().getProperty('LV3A_DRIVE_SNAPSHOT_FILE_ID');
    if(!fileId)throw Error('RSS staging missing; wait for existing backfill to prepare it');
    const pack=JSON.parse(Utilities.ungzip(DriveApp.getFileById(fileId).getBlob())
      .getDataAsString('UTF-8'));
    if(pack.v!==3||pack.feedUrl!==feeds[0].url||!Array.isArray(pack.items))
      throw Error('RSS staging mismatch');
    out.rssStagingAgeHours=Math.round((Date.now()-pack.createdAt)/360000)/10;
    out.rssItems=pack.items.length;
    const matchCounts=new Map(), matched=new Map();
    for(const it of pack.items){
      if(!it.guid)continue;
      matchCounts.set(it.guid,(matchCounts.get(it.guid)||0)+1);
    }
    for(const it of pack.items){
      if(!it.guid||matchCounts.get(it.guid)!==1)continue;
      const dst=libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor);
      if(dst.length!==1)continue;
      const i=dst[0],r=copy.rows[i];
      if(r[1]!==show||libV3Text_(r[14]))continue;
      matched.set(i,(matched.get(i)||0)+1);
    }
    const columnCounts={},hosts={};
    for(let i=0;i<copy.rows.length;i++){
      const r=copy.rows[i],sr=source.rows[i],id=String(r[0]||'');
      if(r[1]!==show||libV3Text_(r[14])||matched.has(i))continue;
      const detail={id,row:i+2};
      add('unmatchedTotal',detail);
      if(String(sr[0])!==id||sr[1]!==r[1]){
        add('sourceCopyRowMismatch',detail);continue;
      }
      if((copy.index.ids.get(id)||[]).length!==1){
        add('duplicateOrMissingEpId',detail);continue;
      }
      if(copy.index.tomb.is.has(id)||source.index.tomb.is.has(id)){
        add('excludedId',detail);continue;
      }
      // Survey actual URL-bearing columns rather than assuming column I.
      const linkColumns=[];
      r.forEach((v,j)=>{
        const str=String(v||'');
        if(!/https?:\/\//i.test(str))return;
        const col=String.fromCharCode(65+j);
        linkColumns.push(col);
        columnCounts[col]=(columnCounts[col]||0)+1;
        const matches=str.match(/https?:\/\/[^\s\"'<>]+/gi)||[];
        for(const url of matches.slice(0,3)){
          const host=(url.match(/^https?:\/\/([^\/:?#]+)/i)||[])[1];
          if(host)hosts[host]=(hosts[host]||0)+1;
        }
      });
      if(linkColumns.length){
        add('hasSomeUrlInLedger',{...detail,columns:linkColumns});
      }else{
        add('noUrlInLedger',detail);
      }
      // GUID or anchor could be present in another column. This is a diagnostic
      // only, not an identity decision.
      const embedded=(r.join(' ').match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/ig)||[]);
      if(embedded.length)add('embeddedUuidCandidate',{...detail,count:embedded.length});
      else add('noEmbeddedUuid',detail);
    }
    out.urlColumns=columnCounts;
    out.urlHosts=Object.fromEntries(Object.entries(hosts).sort((a,b)=>b[1]-a[1]).slice(0,15));
    out.status='READ_ONLY_COMPLETE';
    out.note='unmatchedTotal should be compared with earlier 288 (counts can change while backfill runs). Categories overlap; no audio availability verified.';
    return out;
  }catch(e){out.status='FAILED';out.error=String(e).slice(0,400);return out;}
  finally{out.elapsedMs=Date.now()-t;Logger.log(JSON.stringify(out));}
}
