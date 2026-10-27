'use strict';
// Phase15 LAB-only preview: NO GAS, Sheets, remote IO, write adapter or reservation.
const GUIDS=[
 ['ニュースの現場から','GLOBEイグ・ノーベル賞','93a6a5b8-35f6-447b-abb6-b4ec0061a16e'],
 ['ニュースの現場から','天童よしみ歌の道','ef74feab-7dc0-41ff-923c-b4e400b0ebe0'],
 ['MEDIA TALK','編集マニア#51','f8405029-19db-4278-85d3-b4ea00617b16'],
 ['MEDIA TALK','編集マニア#50','45dbe89c-d322-4c18-864b-b4ea006173e3'],
 ['こどもそうだんしつ','タコが体の色を変えられるのはなんで #18','69b1b092-5c09-48c8-9936-b4ec00664d97'],
 ['こどもそうだんしつ','タコ墨でお習字','b47f4817-6b1f-41b6-8766-b4ec00665a27'],
 ['スポンジ','サッカー#34','a2cd47a2-b397-4059-98be-b4de0092b380'],
 ['ニュースの学校','MMX','22a8a3b0-ceb5-11f1-8f27-c362e1f68974'],
 ['ニュースの学校','イスラエル総選挙2026','48792904-ceb3-11f1-a2e6-7b1c2bd6e6eb'],
 ['ドーナツ','ポすすめAIニュースブリーフィング','e474cda9-28f9-4881-9c4f-b4e8008301cf']
];
const norm=x=>String(x||'').trim().toLowerCase();
function prepareLive10({ledger=[],history=[],exclusions=[],holds=[],urlByGuid={},sourceVerified=false,writerExclusive=false,snapshotVerified=false}={}){
 const original=GUIDS.map(([show,title,guid])=>({show,title,guid}));
 const used=new Set(),warnings=[],idOwners=new Map(),lookup=new Map(),urlLookup=new Map();
 for(const x of ledger){const id=norm(x.id),guid=norm(x.guid);if(id){if(idOwners.has(id)&&idOwners.get(id)!==guid)warnings.push('LEDGER_ID_CONFLICT');idOwners.set(id,guid)}if(guid){if(!lookup.has(guid))lookup.set(guid,[]);lookup.get(guid).push(x)}
  for(const u of [x.url,x.officialUrl])if(u){if(!urlLookup.has(norm(u)))urlLookup.set(norm(u),[]);urlLookup.get(norm(u)).push(x);}
 }
 const hist=new Map();for(const h of history){const g=norm(h.guid);if(!hist.has(g))hist.set(g,[]);hist.get(g).push(h);if(h.id&&idOwners.has(norm(h.id))&&idOwners.get(norm(h.id))!==g)warnings.push('HISTORY_ID_CONFLICT')}
 const excluded=new Set(exclusions.map(x=>norm(x.guid||x))),held=new Set(holds.map(x=>norm(x.guid||x)));
 const results=original.map(x=>{const g=norm(x.guid), matches=lookup.get(g)||[], hs=hist.get(g)||[], urls=urlLookup.get(norm(urlByGuid[g]))||[];let status='PENDING_EVIDENCE',reason='OFFICIAL_SOURCE_AND_FULL_EXCLUSION_REVIEW_REQUIRED';
  if(used.has(g)){status='STOP';reason='DUPLICATE_CANDIDATE_GUID';}else if(matches.length>1||hs.length>1){status='STOP';reason='DUPLICATE_EXISTING_IDENTITY';}
  else if(matches.length||hs.length){status='EXISTING_OR_RESERVED';reason='LEDGER_OR_HISTORY_MATCH';}
  else if(excluded.has(g)){status='EXCLUDED';reason='EXCLUSION_HISTORY';}
  else if(held.has(g)){status='HOLD';reason='HOLD_HISTORY';}
  else if(urls.length){status='HOLD';reason='URL_IDENTITY_SUSPECT';}
  else if(x.show==='ニュースの学校'&&!urlByGuid[g]){status='HOLD';reason='OFFICIAL_ITEM_LINK_MISSING';}
  used.add(g);
  return {...x,status,reason,proposedEpId:null,officialUrl:urlByGuid[g]||null};});
 const max=Math.max(0,...ledger.concat(history).map(x=>Number(String(x.id||'').match(/^EP-(\d+)$/)?.[1]||0)));
 const go=sourceVerified&&writerExclusive&&snapshotVerified&&!warnings.length&&results.every(x=>x.status==='READY');
 return {mode:'DRY_RUN_ONLY',writeEnabled:false,productionGo:go,sourceVerified,writerExclusive,snapshotVerified,
 maxExistingEpId:max,possibleNextIdForDiscussion:max+1,allocationCommitted:false,warnings,rows:results};
}
if(typeof module!=='undefined'&&module.exports)module.exports={GUIDS,prepareLive10};
