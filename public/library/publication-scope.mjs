/** Shared publication membership for library and universe. Never mutates ledger data. */
const validId = id => /^EP-\d{5}$/.test(id || '');
export function buildPublicationScope(snapshot) {
 if(snapshot?.schema!==1 || !Array.isArray(snapshot.decisions) || !/^[a-f0-9]{64}$/.test(snapshot.source?.rawReadSHA256||'')) throw Error('INVALID_PUBLICATION_DECISIONS');
 const ids=new Set(),publishedIds=[],shows=new Map(),counts={source:0,adopted:0,excluded:0,held:0},cross={};let decisionDate='';
 for(const r of snapshot.decisions){
  if(!validId(r.id)||ids.has(r.id)||!r.show||!['対象','対象外','除外','保留'].includes(r.publication)||!['対象','対象外','除外','保留'].includes(r.comparison))throw Error('INVALID_OR_DUPLICATE_SCOPE_ID');
  ids.add(r.id);counts.source++;
  const s=shows.get(r.show)||{name:r.show,total:0,count:0,excluded:0,held:0,comparison:0};shows.set(r.show,s);s.total++;
  if(r.comparison==='対象')s.comparison++;
  const key=r.comparison+'/'+r.publication;cross[key]=(cross[key]||0)+1;
  if(r.publication==='対象'){
   if(r.review!=='確認済み')throw Error('ADOPTED_EPISODE_NOT_REVIEWED');
   if(!Number.isFinite(Date.parse(r.decidedAt)))throw Error('INVALID_DECISION_DATE');
   const date=new Date(Date.parse(r.decidedAt)+9*3600000).toISOString().slice(0,10);if(date>decisionDate)decisionDate=date;
   publishedIds.push(r.id);counts.adopted++;s.count++;
  }else if(r.publication==='保留'){counts.held++;s.held++;}else{counts.excluded++;s.excluded++;}
 }
 if(!publishedIds.length)throw Error('EMPTY_PUBLICATION_SCOPE');
 return {schema:1,policy:'REVIEWED_D_TARGET',version:snapshot.source.rawReadSHA256,decisionDate,...counts,shows:[...shows.values()],comparisonCrossTab:cross,publishedIds:publishedIds.sort()};
}
export function selectPublishedEpisodes(items,scope,{requireComplete=false}={}){
 if(scope?.schema!==1||scope.policy!=='REVIEWED_D_TARGET'||!Array.isArray(scope.publishedIds)||scope.adopted!==scope.publishedIds.length||scope.source!==scope.adopted+scope.excluded+scope.held)throw Error('INVALID_PUBLICATION_SCOPE');
 const allowed=new Set(scope.publishedIds);if(allowed.size!==scope.adopted||scope.publishedIds.some(id=>!validId(id)))throw Error('INVALID_PUBLICATION_SCOPE_IDS');
 const seen=new Set(),result=[];for(const item of items){if(!validId(item.id)||seen.has(item.id))throw Error('DUPLICATE_OR_INVALID_PUBLIC_ID');seen.add(item.id);if(allowed.has(item.id))result.push(item);}
 if(requireComplete){
  if(result.length!==scope.adopted)throw Error('INCOMPLETE_PUBLICATION_SCOPE');
  const shows=new Map();for(const e of result)shows.set(e.show,(shows.get(e.show)||0)+1);
  for(const s of scope.shows)if((shows.get(s.name)||0)!==s.count)throw Error('PUBLICATION_SHOW_COUNT_MISMATCH');
  if([...shows.keys()].some(name=>!scope.shows.some(s=>s.name===name)))throw Error('PUBLICATION_UNKNOWN_SHOW');
 }
 return result;
}
export function publicationLabel(manifest){
 const scope=manifest.publicationScope;
 if(!scope)return `収録 ${manifest.total.toLocaleString()}件 · ${manifest.snapshotDate}更新`;
 if(manifest.total!==scope.adopted||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(scope.decisionDate||''))throw Error('PUBLICATION_MANIFEST_MISMATCH');
 return `掲載対象 ${manifest.total.toLocaleString()}件 · ${scope.decisionDate}掲載判定`;
}
