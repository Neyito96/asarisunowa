// COPY verification adapter. No network writes, scheduler, deployment, or global enable switch.
import {admitNewEpisodes,decisionVersion,v3RegisteredRowHash} from './library-new-admissions.mjs';
import {editDescription,publicationUrl} from '../public/library/description-editor.mjs';
const must=(ok,message)=>{if(!ok)throw Error(message);};
const date=v=>new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(String(v))?v:String(v).replaceAll('/','-').replace(' ','T')+'+09:00').toISOString();
export function enrichOfficialMetadata(raw,previous={}){
 const parsed=editDescription(raw||'');
 const stop=parsed.staff.findIndex(s=>/^【/.test(s));
 const staff=parsed.staff.slice(0,stop<0?undefined:stop).filter(Boolean);
 const recording=String(raw||'').match(/(?:※|この番組は)?\d{4}年\d{1,2}月\d{1,2}日に収録しました。?/g)||[];
 const description=parsed.description.replace(/(?:※|この番組は)?\d{4}年\d{1,2}月\d{1,2}日に収録しました。?/g,'').trim();
 const warnings=[...parsed.holds];
 const people=staff.map(s=>{
  const text=s.replace(/https?:\/\/\S+/g,'').trim();
  const role=text.match(/^(MC(?:・音源編集)?|音源編集|出演|司会)\s+(.+)$/);
  const affiliation=text.match(/^(.+?)（(.+?)）$/);
  return {name:role?role[2]:affiliation?affiliation[1]:text,role:role?role[1]:'未確認',affiliation:affiliation?affiliation[2]:'',evidence:s};
 });
 const urls={};
 for(const m of String(raw||'').matchAll(/https?:\/\/[^\s<>"']+/g)){
  const value=publicationUrl(m[0]);if(!value)continue;const u=new URL(value);
  const platform=u.hostname==='open.spotify.com'&&/^\/episode\/[a-zA-Z0-9]+$/.test(u.pathname)?'spotify':u.hostname==='podcasts.apple.com'&&u.searchParams.has('i')?'apple':u.hostname==='listen.style'&&/^\/p\/[^/]+\/[^/]+/.test(u.pathname)?'listen':null;
  if(platform){if(urls[platform]&&urls[platform]!==value){delete urls[platform];warnings.push('AMBIGUOUS_'+platform);}else if(!warnings.includes('AMBIGUOUS_'+platform))urls[platform]=value;}
 }
 if(Object.keys(urls).length)warnings.push('PLATFORM_IDENTITY_UNCONFIRMED');
 const candidate={description,staff,people,recording:[...new Set([...parsed.recording,...recording])],relatedArticles:parsed.relatedArticles,platformUrls:{},platformUrlCandidates:urls};
 const result=structuredClone(previous);
 for(const [k,v]of Object.entries(candidate)){
  if(k==='platformUrls'){result[k]??={};for(const [platform,url]of Object.entries(v)){if(!result[k][platform])result[k][platform]=url;else if(result[k][platform]!==url)warnings.push('EXISTING_PLATFORM_CONFLICT_'+platform);}continue;}
  if(result[k]===undefined||result[k]===''||(Array.isArray(result[k])&&!result[k].length))result[k]=v;
 }
 return {...result,warnings:[...new Set(warnings)],linkStatus:'NOT_CHECKED',source:'official-rss',humanReview:false};
}
export function prepareOfficialAutomation(source,base,policy,rssEvidence,previousMetadata={}){
 must(typeof policy.id==='string'&&policy.id.length>0,'POLICY_ID_REQUIRED');
 must(policy.mode==='COPY_TEST'&&policy.enabled===true,'COPY_POLICY_REQUIRED');
 must(policy.baseDecisionVersion===decisionVersion(base.decisions),'BASELINE_POLICY_MISMATCH');
 must(Number.isFinite(Date.parse(policy.newAfter))&&Number.isFinite(Date.parse(policy.checkedAt)),'POLICY_TIME_REQUIRED');
 must(Array.isArray(policy.feeds)&&policy.feeds.length>0,'OFFICIAL_FEED_ALLOWLIST_REQUIRED');
 const baseline=new Set(base.decisions.map(r=>r.id));
 must(baseline.size===base.decisions.length&&source.rows.filter(r=>baseline.has(r[0])).length===baseline.size,'FULL_BASELINE_REQUIRED');
 const states=new Map((source.v3FieldStates||[]).map(s=>[s[0],JSON.parse(s[1])]));
 const entries=[],exceptions=[],metadata={};
 for(const row of source.rows.filter(r=>!baseline.has(r[0]))){
  try{
   const feed=policy.feeds.find(f=>f.url===row[44]&&f.show===row[1]);must(feed,'FEED_NOT_ALLOWED');
   const evidence=rssEvidence.filter(e=>e.feedUrl===feed.url&&e.item.guid===row[6]);must(evidence.length===1,'RSS_EVIDENCE_NOT_UNIQUE');
   const it=evidence[0].item;
   must(it.title===row[2]&&date(it.published)===date(row[3])&&it.audio===row[14]&&String(it.description||'')===String(row[21]||''),'RSS_CORE_MISMATCH');
   must(Date.parse(it.published)>Date.parse(policy.newAfter)&&Date.parse(it.published)<=Date.parse(policy.checkedAt),'NOT_FRESH');
   const audio=new URL(it.audio);must(audio.protocol==='https:'&&!audio.username&&!audio.password&&feed.audioHosts.includes(audio.hostname),'AUDIO_SOURCE');
   if(feed.requireClipUuid){const clip=audio.pathname.match(/\/clips\/[^/]+\/[^/]+\/([^/]+)\//)?.[1];must(clip===it.guid,'OFFICIAL_UUID_MISMATCH');}
   const state=states.get(row[0])?.identity;must(state,'NO_REGISTRATION');must(Date.parse(state[6])<=Date.parse(policy.checkedAt),'FUTURE_REGISTRATION');
   const entry={id:row[0],show:row[1],guid:row[6],rowHash:v3RegisteredRowHash(row),registeredAt:state[6],decidedAt:state[6],review:'確認済み',publication:'対象',verificationMethod:'AUTOMATIC_OFFICIAL_RSS_RULE',policyId:policy.id,humanReview:false};
   const admissions={schema:1,baseDecisionVersion:policy.baseDecisionVersion,newAfter:policy.newAfter,entries:[entry]};
   admitNewEpisodes(source,base,admissions); // Existing GUID/UUID, exclusion, state/hash checks.
   entries.push(entry);metadata[row[0]]=enrichOfficialMetadata(row[21],previousMetadata[row[0]]);
  }catch(error){exceptions.push({id:row[0],reason:error.message});}
 }
 const admissions={schema:1,baseDecisionVersion:policy.baseDecisionVersion,newAfter:policy.newAfter,entries};
 const admitted=admitNewEpisodes(source,base,admissions),result=structuredClone(source);
 result.publicationDecisions=admitted.snapshot;result.descriptionEdits={...result.descriptionEdits};
 for(const entry of entries){
  const m=metadata[entry.id];
  if(m.description&&!m.warnings.includes('PUBLIC_RESIDUE'))result.descriptionEdits[entry.id]={description:m.description,version:'V3-official-policy-1',holds:[],staff:m.staff,recording:m.recording,relatedArticles:m.relatedArticles,sourceUrl:source.rows.find(r=>r[0]===entry.id)[44],snapshotAt:entry.registeredAt,rawHash:decisionVersion(source.rows.find(r=>r[0]===entry.id)[21])};
 }
 return {source:result,admissions,metadata,report:{status:'COPY_PREPARED_NOT_PUBLISHED',admittedIds:entries.map(e=>e.id),exceptions,metadataWarnings:Object.entries(metadata).filter(([,m])=>m.warnings.length).map(([id,m])=>({id,warnings:m.warnings})),baselineChanges:0,productionWrites:0}};
}
