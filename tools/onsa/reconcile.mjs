// READ_ONLY comparison, sharing the existing platform URL decisions from PR #249.
import {createHash} from 'node:crypto';
import {publicEpisode,blocked,plainDescription} from '../../lib/library-public.mjs';
import {classifyPlatformUrl,publicUrl} from '../../lib/podcast-platform-evidence.mjs';
export const showAliases={'メディアトーク':'MEDIA TALK','SDGs':'SDGsを話そう','YouTube':'朝ポキTV'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest=value=>createHash('sha256').update(value).digest('hex');
export const titleKey=value=>plainDescription(String(value||'').replace(/\\u(?:3000|0020)/gi,' ')).normalize('NFKC').replace(/\s+/g,' ').trim();
const add=(set,value)=>{if(value)set.add(value);};
export function identityKeys(record){
 const out=new Set();
 for(const id of record.guids||[]){const v=String(id||'').trim();if(uuid.test(v))out.add('omny_uuid:'+v.toLowerCase());else if(/^TASC\d+$/i.test(v))out.add('megaphone:'+v.toUpperCase());}
 for(const raw of [...(record.urls||[]),...(record.guids||[]).filter(x=>publicUrl(x))]){
  if(!publicUrl(raw))continue;
  const u=new URL(raw),host=u.hostname.toLowerCase(),path=u.pathname;
  if(host==='omny.fm'||host==='www.omny.fm'){
   const page=path.replace(/\/embed\/?$/,'').replace(/\/$/,'');
   if(/^\/shows\/[^/]+\/[^/]+$/.test(page))out.add('omny_url:'+page);
   for(const part of page.split('/'))if(uuid.test(part))out.add('omny_uuid:'+part.toLowerCase());
  }
  if(host==='asahi.com'||host==='www.asahi.com'){
   if(path==='/special/podcasts/item/'||path==='/special/podcasts/item'){
    const id=u.searchParams.get('itemid');if(uuid.test(id||''))out.add('omny_uuid:'+id.toLowerCase());
    else if(/^TASC\d+$/i.test(id||''))out.add('megaphone:'+id.toUpperCase());
   }
  }
  if(host==='traffic.megaphone.fm'||host==='pdst.fm'){
   const id=path.match(/\/(TASC\d+)\.mp3$/i)?.[1];if(id)out.add('megaphone:'+id.toUpperCase());
  }
  const p=classifyPlatformUrl(raw);
  if(p.level==='episode'&&p.provider==='spotify'&&p.id)out.add('spotify_episode:'+p.id);
  if(host==='pca.st'&&/^\/episode\/[0-9a-f-]{36}\/?$/i.test(path))out.add('pocket_episode:'+path.split('/')[2].toLowerCase());
  if(p.provider==='youtube'&&p.level==='episode'){
   const id=host==='youtu.be'?path.slice(1):u.searchParams.get('v')||path.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];if(id)out.add('youtube_video:'+id);
  }
  // Exact audio is corroboration only; never copied into protected audio cells.
  if(/\.mp3$/i.test(path))out.add('audio_exact:'+digest(publicUrl(raw)));
 }
 return [...out];
}
function compatibleShow(external,library){
 const show=showAliases[external]||external;
 return show===library||external==='SDGs'&&library==='こどもそうだんしつ';
}
export function compare(external,source){
 if(source.headers[0]!=='台帳ID'||source.headers[38]!=='人間除外')throw Error('Unexpected ledger schema');
 const excludedIds=new Set(),excludedKeys=new Set();
 for(const x of (source.exclusions||[]).slice(1)){if(x[1])excludedIds.add(String(x[1]));for(const key of identityKeys({guids:[x[0]],urls:[x[0]]}))excludedKeys.add(key);}
 const rows=source.rows.map(row=>({row,id:row[0],show:row[1],title:row[2],date:publicEpisode(row).date,keys:identityKeys({guids:[row[6],row[51]],urls:[row[8],row[9],row[11],row[12],row[14],row[32],row[41],row[43],row[52],row[53]]}),excluded:blocked(row[38])||excludedIds.has(row[0])}));
 if(new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Duplicate ledger EP-ID');
 const index=new Map(),metadata=new Map();
 for(const x of rows){for(const key of x.keys){const list=index.get(key)||[];list.push(x);index.set(key,list);}const k=titleKey(x.title)+'|'+Date.parse(x.date);const list=metadata.get(k)||[];list.push(x);metadata.set(k,list);}
 const matches=[],urlReviews=[],proposals=[];
 const matchedIds=new Set(),reviewedIds=new Set();
 for(const x of external.episodes){
  const keys=identityKeys({urls:[x.sourceUrl,x.spotify,x.official,x.pocketcasts]});
  const evidence=keys.filter(k=>index.has(k));
  const candidates=new Map();for(const key of evidence)for(const candidate of index.get(key))candidates.set(candidate.id,candidate);
  const result={sheet:x.sheet,sourceRow:x.row,sourceTitle:x.title,sourceDate:x.publishedAt,status:'HOLD',reason:'NO_IDENTITY_MATCH',epId:'',libraryShow:'',libraryTitle:'',libraryDate:'',candidateIds:[...candidates.keys()],sourceKeys:keys,evidence,metadataTitleEqual:false,dateDeltaSeconds:null,showRelation:''};
  if(keys.some(k=>excludedKeys.has(k))){result.reason='HUMAN_EXCLUDED';}
  else if(candidates.size>1){result.reason='IDENTITY_CONFLICT_OR_MULTIPLE';for(const id of candidates.keys())reviewedIds.add(id);}
  else if(candidates.size===1){
   const target=[...candidates.values()][0];result.epId=target.id;result.libraryShow=target.show;result.libraryTitle=target.title;result.libraryDate=target.date;
   reviewedIds.add(target.id);
   result.metadataTitleEqual=titleKey(x.title)===titleKey(target.title);
   const a=Date.parse(x.publishedAt),b=Date.parse(target.date);
   result.dateDeltaSeconds=Number.isFinite(a)&&Number.isFinite(b)?(a-b)/1000:null;
   result.showRelation=x.sheet==='SDGs'&&target.show==='こどもそうだんしつ'?'SUCCESSOR_IN_SDGS_TAB':compatibleShow(x.sheet,target.show)?'SAME_PROGRAMME':'SHOW_CONFLICT';
   if(target.excluded||target.keys.some(k=>excludedKeys.has(k)))result.reason='HUMAN_EXCLUDED';
   else if(!compatibleShow(x.sheet,target.show))result.reason='SHOW_CONFLICT';
   else if(!result.metadataTitleEqual)result.reason='TITLE_REVIEW';
   else if(result.dateDeltaSeconds!==0)result.reason='DATETIME_REVIEW';
   else {
    result.status='MATCH';result.reason=evidence.some(k=>k.startsWith('omny_uuid:'))?'UUID_AND_METADATA':evidence.some(k=>k.startsWith('megaphone:'))?'MIGRATED_ID_AND_METADATA':'EXACT_EPISODE_LINK_AND_METADATA';matchedIds.add(target.id);
    for(const [field,column,value] of [['Spotify個別URL',11,x.spotify],['公式個別URL',9,x.official],['Pocket Casts個別URL',41,x.pocketcasts]]){
     if(!value)continue;
     const v=validateDestination(field,value),current=String(target.row[column]||'').trim();
     const entry={epId:target.id,libraryShow:target.show,sheet:x.sheet,sourceRow:x.row,field,column:column+1,currentValue:current,value:v.url,identityReason:result.reason,linkCheck:'NOT_HTTP_CHECKED',sourceAuthority:'COMMUNITY_WORKING_COPY',status:'HOLD',reason:v.reason};
     if(!v.ok){urlReviews.push(entry);continue;}
     if(current){if(sameDestination(field,current,v.url)){entry.status='UNCHANGED';entry.reason='ALREADY_PRESENT';}else entry.reason='EXISTING_NONEMPTY_CONFLICT';urlReviews.push(entry);continue;}
     entry.status='CANDIDATE';entry.reason='EXACT_IDENTITY_BLANK_ONLY';proposals.push(entry);
    }
   }
  }else{
   const similar=(metadata.get(titleKey(x.title)+'|'+Date.parse(x.publishedAt))||[]).filter(t=>compatibleShow(x.sheet,t.show));
   if(similar.length){result.reason='METADATA_ONLY_NOT_CONFIRMED';result.candidateIds=similar.map(t=>t.id);for(const t of similar)reviewedIds.add(t.id);}
   else result.reason=x.sheet==='YouTube'?'YOUTUBE_SCOPE_REVIEW':'EXTERNAL_ONLY_CANDIDATE';
  }
  matches.push(result);
 }
 // Multiple source rows must not propose different values for the same cell.
 const byCell=new Map();for(const p of proposals){const key=p.epId+'|'+p.column;const list=byCell.get(key)||[];list.push(p);byCell.set(key,list);}
 const approvedCandidates=[];
 for(const list of byCell.values()){
  const values=new Set(list.map(x=>destinationIdentity(x.field,x.value)));
  if(values.size!==1){for(const p of list){p.status='HOLD';p.reason='SOURCE_CELL_CONFLICT';urlReviews.push(p);}continue;}
  const p=list[0];p.sourceRows=list.map(x=>({sheet:x.sheet,row:x.sourceRow}));approvedCandidates.push(p);
 }
 const libraryOnly=rows.filter(x=>!matchedIds.has(x.id)).map(x=>({epId:x.id,show:x.show,title:x.title,date:x.date,status:x.excluded?'HUMAN_EXCLUDED':['アルキキ','AJW'].includes(x.show)?'LIBRARY_POLICY_SCOPE':x.show==='朝ポキTV'?'YOUTUBE_SCOPE_REVIEW':reviewedIds.has(x.id)?'IDENTITY_OR_METADATA_REVIEW':'NOT_MATCHED_IN_COPY'}));
 const count=(list,key)=>list.reduce((a,x)=>(a[x[key]]=(a[x[key]]||0)+1,a),{});
 return {matches,proposals:approvedCandidates,urlReviews,libraryOnly,summary:{sourceRows:external.episodes.length,ledgerRows:rows.length,statuses:count(matches,'status'),reasons:count(matches,'reason'),matchedUniqueEpIds:matchedIds.size,identityLinkedRows:matches.filter(x=>x.epId).length,identityLinkedUniqueEpIds:new Set(matches.filter(x=>x.epId).map(x=>x.epId)).size,proposedCells:approvedCandidates.length,proposedEpisodes:new Set(approvedCandidates.map(x=>x.epId)).size,proposedFields:count(approvedCandidates,'field'),urlReviewReasons:count(urlReviews,'reason'),libraryUnmatchedReasons:count(libraryOnly,'status'),collidingLedgerKeys:[...index].filter(([k,v])=>v.length>1).length}};
}
export function validateDestination(field,value){
 const raw=publicUrl(value);if(!raw)return {ok:false,url:'',reason:'INVALID_URL'};
 const u=new URL(raw);
 if(u.protocol!=='https:')return {ok:false,url:'',reason:'NON_HTTPS_URL'};
 if([...u.searchParams.keys()].some(k=>/^(token|auth|key|signature|sig|access_token)$/i.test(k)))return {ok:false,url:'',reason:'SENSITIVE_QUERY_HOLD'};
 const p=classifyPlatformUrl(raw);
 const valid=field==='Spotify個別URL'?p.provider==='spotify'&&p.level==='episode':field==='Pocket Casts個別URL'?p.provider==='pocketcasts'&&p.level==='episode':(u.hostname==='www.asahi.com'||u.hostname==='asahi.com')&&/^\/special\/podcasts\/item\/?$/.test(u.pathname)&&uuid.test(u.searchParams.get('itemid')||'');
 // A synthetic Asahi itemid=TASC… is not promoted without endpoint verification.
 return {ok:!!valid,url:raw,reason:valid?'FORMAT_VALID_UNVERIFIED':'WRONG_LEVEL_OR_UNVERIFIED_FORMAT'};
}
function destinationIdentity(field,value){
 const v=validateDestination(field,value);if(!v.ok)return 'UNVERIFIED:'+String(value);
 const keys=identityKeys({urls:[v.url]});return keys.find(k=>k.startsWith(field==='Spotify個別URL'?'spotify_episode:':field==='Pocket Casts個別URL'?'pocket_episode:':'omny_uuid:'))||v.url;
}
function sameDestination(field,a,b){return destinationIdentity(field,a)===destinationIdentity(field,b);}
