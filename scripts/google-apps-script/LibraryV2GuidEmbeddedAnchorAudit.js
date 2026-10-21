/**
 * READ ONLY: find GUID-gap episodes with an independent UUID anchor in
 * existing ledger fields (not title/date/Spotify ID alone).
 * Supports Omny clip URLs and exact RSS GUID or omny:clipId UUID.
 * Never writes. Inspect column provenance before enabling any writer.
 */
function previewLibraryV2GuidEmbeddedAnchors() {
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳');
 const values=sh.getDataRange().getValues(),header=values.shift();
 const re=/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/ig;
 const known=new Set(values.map(r=>String(r[6]||'').toLowerCase()).filter(Boolean));
 const byUuid=new Map(),byId=new Map(),counts={guidBlank:0,withAnyUuid:0,withOmnyUrlUuid:0,ambiguous:0,knownCollision:0};
 values.forEach((r,i)=>{
  if(String(r[6]||'').trim())return;
  counts.guidBlank++;
  const evidence=[];
  r.forEach((v,col)=>{
   if(col===6)return;
   const s=String(v||'');
   // Require recognizable Omny-hosted clip link, not arbitrary UUID in description.
   if(!/https?:\/\/(?:traffic\.)?(?:omny\.fm|omnycontent\.com)\//i.test(s))return;
   const matches=s.match(re)||[];
   matches.forEach(uuid=>evidence.push({uuid:uuid.toLowerCase(),column:col+1,header:header[col]}));
  });
  if(evidence.length)counts.withAnyUuid++;
  const unique=[...new Set(evidence.map(x=>x.uuid))];
  if(unique.length!==1){if(unique.length>1)counts.ambiguous++;return;}
  counts.withOmnyUrlUuid++;
  const uuid=unique[0];if(known.has(uuid)){counts.knownCollision++;return;}
  const entry={row:i+2,id:r[0],uuid,evidence:evidence.map(e=>({column:e.column,header:e.header}))};
  if(!byUuid.has(uuid))byUuid.set(uuid,[]);
  byUuid.get(uuid).push(entry);
 });
 const safe=[...byUuid.values()].filter(v=>v.length===1).map(v=>v[0]);
 const result={mode:'READ_ONLY_GUID_EMBEDDED_ANCHOR',counts,uniqueAnchors:safe.length,duplicates:[...byUuid.values()].filter(v=>v.length>1).length,samples:safe.slice(0,20),writes:0,note:'Candidate UUID in existing Omny URL only; requires RSS GUID/clipId confirmation and human exclusion before write'};
 Logger.log(JSON.stringify(result));return result;
}
