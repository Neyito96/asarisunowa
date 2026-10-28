'use strict';
// Phase15 LIVE_21: PREVIEW ONLY. No Sheets/GAS access, allocation, or mutation.
const EXPECTED=[
['ニュースの現場から','93a6a5b8-35f6-447b-abb6-b4ec0061a16e','GLOBEイグ・ノーベル賞'],
['ニュースの現場から','ef74feab-7dc0-41ff-923c-b4e400b0ebe0','天童よしみ歌の道'],
['MEDIA TALK','f8405029-19db-4278-85d3-b4ea00617b16','編集マニア#51'],
['MEDIA TALK','45dbe89c-d322-4c18-864b-b4ea006173e3','編集マニア#50'],
['こどもそうだんしつ','69b1b092-5c09-48c8-9936-b4ec00664d97','タコが体の色を変えられるのはなんで #18'],
['こどもそうだんしつ','b47f4817-6b1f-41b6-8766-b4ec00665a27','タコ墨でお習字'],
['スポンジ','a2cd47a2-b397-4059-98be-b4de0092b380','サッカー#34'],
['ニュースの学校','22a8a3b0-ceb5-11f1-8f27-c362e1f68974','MMX'],
['ニュースの学校','48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb','イスラエル総選挙2026'],
['ドーナツ','e474cda9-28f9-4881-9c4f-b4e8008301cf','ポすすめAIニュースブリーフィング']
];
const norm=x=>String(x||'').trim().toLowerCase();
const normUrl=x=>String(x||'').trim().replace(/\/$/,'');
function preview({candidates,ledger,excluded=[],held=[],reservedIds=[],schemaVerified=false,writerLockVerified=false}){
 if(!Array.isArray(candidates)||candidates.length!==10||!Array.isArray(ledger))throw Error('STOP_INPUT');
 if(!schemaVerified)throw Error('STOP_SCHEMA_UNVERIFIED');
 const keyset=new Set(),output=[];
 for(const c of candidates){
  const guid=norm(c.guid),key=EXPECTED.find(e=>norm(e[1])===guid);
  if(!key||keyset.has(guid)||norm(c.show)!==norm(key[0]))throw Error('STOP_LIVE10_IDENTITY');
  keyset.add(guid);
  const hits=ledger.filter(r=>norm(r.guid)===guid||[r.url,r.officialUrl].some(u=>normUrl(u)&&normUrl(u)===normUrl(c.url))||
    (norm(r.title)&&norm(c.title)&&norm(r.title)===norm(c.title)&&norm(r.show)===norm(c.show)));
  const exclusion=excluded.some(x=>norm(x.guid)===guid||norm(x.title)===norm(c.title)&&norm(x.show)===norm(c.show));
  const hold=held.some(x=>norm(x.guid)===guid||norm(x.title)===norm(c.title)&&norm(x.show)===norm(c.show));
  const missingUrl=!normUrl(c.url),incomplete=!c.pubDate||!c.title||!c.show;
  let decision=hits.length?'STOP_EXISTING_OR_COLLISION':exclusion?'EXCLUDED':hold?'HOLD_POLICY':missingUrl||incomplete?'HOLD_METADATA':'REVIEW_REQUIRED';
  output.push({show:c.show,title:c.title,guid,decision,matchedIds:hits.map(r=>r.id||null),epId:null,missingUrl});
 }
 const ids=ledger.map(r=>r.id).concat(reservedIds).filter(Boolean);
 if(ids.length!==new Set(ids).size)throw Error('STOP_ID_COLLISION');
 if(!ids.includes('EP-06632'))throw Error('STOP_PRODUCTION_ANCHOR_UNVERIFIED');
 return {mode:'PREVIEW_ONLY',writes:0,allocations:0,writerLockVerified,canWrite:false,items:output,
 blockers:['PRODUCTION_WRITE_NOT_AUTHORIZED',...(!writerLockVerified?['WRITER_EXCLUSION_UNVERIFIED']:[])],note:'No EP-ID prediction or reservation. Revalidate all sources atomically before any separately approved writer.'};
}
if(typeof module!=='undefined')module.exports={EXPECTED,preview};
