/**
 * Read-only go/no-go preview for the first three UUID-matched episodes.
 * Requires LibraryV3AudioUuidSafetyAudit.gs in the isolated GAS project.
 * Does not create a write function or install a trigger.
 */
function previewLibraryV3AudioUuidThreePilot(){
  const safety=previewLibraryV3AudioUuidSafety();
  const out={mode:'READ_ONLY_UUID_THREE_PILOT',status:'',writes:0,
    sourceWrites:0,propertyWrites:0,triggerChanges:0,spotifyPosts:0,
    networkProbes:0,selected:[]};
  try{
    if(safety.status!=='READ_ONLY_COMPLETE')throw Error('Safety audit failed: '+(safety.error||''));
    if(safety.counts.examined!==288)throw Error('Unexpected candidate count');
    const passed=safety.samples.passedAllCheckedGuards||[];
    if(passed.length<3)throw Error('Fewer than three passing samples');
    const selected=passed.slice(0,3);
    const copyId='19Dv6cgM33NYbrMGLofuVvxM4-WHiuPqxmivZUuwoBqc';
    const show='ニュースの現場から';
    const source=libV3Context_(false),feeds=source.feeds.filter(f=>f.show===show);
    if(feeds.length!==1)throw Error('Official feed not unique');
    libV3CopyPilotId_({copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    const copy=libV3Context_(false,{copySheetId:copyId,
      guid:'ea1b3919-ed31-4b8f-b059-b4c500465fb6',feedUrl:feeds[0].url});
    if(source.ss.getId()===copy.ss.getId()||copy.ss.getId()!==copyId)
      throw Error('Copy isolation failed');
    for(const p of selected){
      const hits=copy.index.ids.get(p.id)||[];
      const shits=source.index.ids.get(p.id)||[];
      if(hits.length!==1||shits.length!==1||hits[0]!==shits[0])
        throw Error('EP identity changed: '+p.id);
      const i=hits[0],row=i+2,sr=source.rows[i],cr=copy.rows[i];
      if(row!==p.row||sr[1]!==show||cr[1]!==show||
         libV3Text_(sr[14])||libV3Text_(cr[14])||
         copy.sh.getRange(row,15).getFormula()||
         source.sh.getRange(row,15).getFormula()||
         libV3Hash_(sr.map((v,j)=>j===14?'':v))!==
           libV3Hash_(cr.map((v,j)=>j===14?'':v)))
        throw Error('Pilot row changed: '+p.id);
      out.selected.push({id:p.id,row,copyAudioBlank:true,sourceAudioBlank:true});
    }
    out.status='PREVIEW_READY';
    out.next='Review the three EP-IDs and authorize a separate, lock-protected copy-only pilot if desired.';
  }catch(e){out.status='HOLD';out.error=String(e).slice(0,400);}
  Logger.log(JSON.stringify(out));return out;
}
