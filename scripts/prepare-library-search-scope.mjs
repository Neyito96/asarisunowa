/** Populate an EP-ID keyed decision proposal, reusing PR250 identity semantics.
 * Does not access Sheets or Spotify; never mutates source ledger rows. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
import {identityKeys,titleKey} from '../tools/onsa/reconcile.mjs';import {blocked} from '../lib/library-public.mjs';
const stamp=x=>{const s=String(x||'');return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(s)?s:s+'+09:00');};
const rawText=x=>String(x||'').replace(/<(?:br|\/p|\/div)[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');
const cautious=new Set(['寺下まりか','太田昌彦','佐藤陽','高橋健一郎']);
export function buildSearchScope(source,official,{at=new Date().toISOString()}={}){
 const rows=source.rows.map(r=>[...r,...Array(Math.max(0,55-r.length)).fill('')]);if(new Set(rows.map(r=>r[0])).size!==rows.length)throw Error('DUPLICATE_EP_ID');
 const index=new Map(),feeds=new Map(),records=[],people=[];
 for(const it of official){const keys=identityKeys({guids:[it.guid],urls:[it.link,it.audioUrl]});const x={...it,keys,key:keys.find(k=>k.startsWith('omny_uuid:')||k.startsWith('megaphone:'))||it.feedUrl+'|'+it.guid};for(const k of keys){const list=index.get(k)||[];list.push(x);index.set(k,list);}feeds.set(it.show,it.feedUrl);}
 const excludedIds=new Set(),excludedKeys=new Set();for(const r of (source.exclusions||[]).slice(1)){if(r[1])excludedIds.add(String(r[1]));for(const k of identityKeys({guids:[r[0]],urls:[r[0]]}))excludedKeys.add(k);}
 for(const r of rows){
  const keys=identityKeys({guids:[r[6],r[51]],urls:[r[8],r[9],r[11],r[12],r[14],r[32],r[41],r[43],r[52],r[53]]});
  const candidates=new Map();for(const k of keys)for(const it of index.get(k)||[])candidates.set(it.show+'|'+it.key,it);
  const compatible=[...candidates.values()].filter(it=>it.show===r[1]);
  const matched=compatible.filter(it=>titleKey(it.title)===titleKey(r[2])&&stamp(it.published)===stamp(r[3]));
  let status='確認済み',universe='対象',onsa=r[1]==='ニュースの学校'||r[1]==='こどもそうだんしつ'?'対象外':'対象',classification='通常',reason='公式RSS識別子＋番組＋タイトル＋配信日時一致',representative=r[0];
  const titleMatched=compatible.filter(it=>titleKey(it.title).replace(/\s+/g,'')===titleKey(r[2]).replace(/\s+/g,''));
  let item=matched.length===1?matched[0]:titleMatched.length===1?titleMatched[0]:null;
  const dateEqual=item?stamp(item.published)===stamp(r[3]):false;
  if(item&&!dateEqual){classification='日時差分';reason='公式識別子・番組・タイトル対応、公開日時に差分あり。検索採用と旧日時の照合保留を分離';if(onsa==='対象')onsa='保留';}
  const evidence={keys,officialGuid:item?.guid||'',officialFeed:item?.feedUrl||'',officialLink:item?.link||'',officialPublished:item?.published||'',candidateGuids:compatible.map(i=>i.guid),matchCount:matched.length,titleMatchedCount:titleMatched.length,metadataDateEqual:dateEqual,ledgerPublished:r[3]};
  if(blocked(r[38])||excludedIds.has(r[0])||keys.some(k=>excludedKeys.has(k))){universe=onsa='除外';classification='人間除外';reason='元本/削除・除外履歴の指定を尊重';}
  else if(['アルキキ','AJW','朝ポキTV'].includes(r[1])||r[4]==='動画'){universe=onsa='対象外';classification='対象外番組';reason=r[1]==='朝ポキTV'||r[4]==='動画'?'動画媒体・YouTube由来を比較/宇宙音声検索から除外':'指定された対象外番組（アルキキ/AJW）';}
  else if(!item){universe='保留';if(onsa!=='対象外')onsa='保留';status='要照合';classification='同一性保留';reason=matched.length>1?'公式識別子に複数候補':compatible.length?'公式識別子は対応するがタイトル/配信日時に差分':'公式RSSの識別子との対応未確認（欠落/移管を断定しない）';}
  else {
   const marker=/^（(?:再|ふりかえり|深掘り)）/.test(String(r[2]))||String(r[2]).includes('再放送です');
   const intro=rawText(item.description).split(/【(?:出演|関連|おねがい|お願い|朝ポキ)/)[0].slice(0,2000);
   const replay=/再放送です|(?:この(?:回|番組|エピソード)|過去に配信|以前に配信)[^。\n]{0,70}再(?:配信|放送)|再(?:配信|放送)(?:し(?:て|ま|た)|いたし|です)/.test(intro);
   if(replay){universe=onsa='対象外';classification='再配信';reason='公式RSSのエピソード説明に再配信/再放送の明記';evidence.replayEvidence=intro.match(/[^。\n]*(?:再配信|再放送)[^。\n]*/)?.[0]||'';}
   else if(marker){universe='保留';if(onsa!=='対象外')onsa='保留';status='要照合';classification='再配信候補';reason='再/ふりかえり/深掘り等の標識はあるが同一内容の一次根拠未確定';}
  }
  records.push({epId:r[0],show:r[1],title:r[2],published:r[3],guid:r[6]||r[51]||'',universe,onsa,classification,reason,representative,status,evidence,itemKey:item?.key||'',at,row:r});
  // Only retain pre-existing candidate names supported in an official attributed appearance block.
  const block=item&&rawText(item.description).match(/【(出演[^】]*)】([\s\S]*?)(?=【|$)/);
  const candidateNames=r.slice(45,50).filter(Boolean).flatMap(v=>String(v).split(/[\n/]/)).map(v=>v.split(/[,，（(]/)[0].trim()).filter(Boolean);
  for(const name of [...new Set(candidateNames)]){
   const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),line=block?.[2].split('\n').find(s=>new RegExp('(?:^|[\\s、・])'+escaped+'(?=[\\s（(:、]|$)').test(s));
   const accepted=!!line&&!cautious.has(name)&&!/(?:音源編集|ディレクター|スタッフ|制作のみ)/.test(line);
   people.push({epId:r[0],name,status:accepted?'VERIFIED':'HOLD',reason:accepted?'公式RSS出演区画に既存候補名・役割の根拠あり':cautious.has(name)?'本人同定を別途要確認':!item?'公式エピソード対応未確認':!line?'公式出演区画に当該候補名の根拠なし':'スタッフ役割を出演者へ昇格しない',sourceUrl:item?.feedUrl||'',evidence:line||'',sourceKind:'OFFICIAL_RSS'});
  }
 }
 // Same official episode key AND metadata is duplicate evidence. Never choose by title alone.
 const groups=new Map();for(const r of records){if(!r.itemKey||r.classification==='対象外番組'||r.classification==='人間除外')continue;const k=r.itemKey;const list=groups.get(k)||[];list.push(r);groups.set(k,list);}
 for(const group of groups.values())if(group.length>1){
  group.sort((a,b)=>Number(b.evidence.metadataDateEqual)-Number(a.evidence.metadataDateEqual)||Number(Boolean(b.row[6]))-Number(Boolean(a.row[6]))||Number(Boolean(b.row[14]))-Number(Boolean(a.row[14]))||Number(a.epId.slice(3))-Number(b.epId.slice(3)));
  const rep=group[0];for(const r of group){r.representative=rep.epId;r.evidence.sameOfficialEpisodeEpIds=group.map(x=>x.epId);r.evidence.crossPostedShows=[...new Set(group.map(x=>x.show))];if(r===rep)continue;r.universe=r.onsa='対象外';r.classification='重複';r.status='確認済み';r.reason='同じ公式エピソード識別子に各番組RSSのタイトルで対応。複数番組への掲載/日時差を根拠に残し、既存EP-IDは保持して代表へ参照';}
 }
 const output=records.map(r=>[r.epId,r.show,r.onsa,r.universe,r.classification,r.reason,r.representative,JSON.stringify(r.evidence),r.status,at]);
 const count=key=>Object.fromEntries([...new Set(records.map(r=>r[key]))].map(k=>[k,records.filter(r=>r[key]===k).length]));
 const summary={at,rows:records.length,universe:count('universe'),onsa:count('onsa'),classification:count('classification'),school:countSchool(records),people:{verified:people.filter(p=>p.status==='VERIFIED').length,held:people.filter(p=>p.status==='HOLD').length,cautiousHeld:people.filter(p=>cautious.has(p.name)).length},target5936IsNotForced:true,ledgerWrites:0};
 return {output,summary,people,records:records.map(({row,...r})=>r)};
}
const countSchool=rs=>Object.fromEntries([...new Set(rs.filter(r=>r.show==='ニュースの学校').map(r=>r.universe))].map(k=>[k,rs.filter(r=>r.show==='ニュースの学校'&&r.universe===k).length]));
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [src,rss,dest]=process.argv.slice(2);if(!src||!rss||!dest)throw Error('PRIVATE_LEDGER PRIVATE_OFFICIAL_ITEMS OUT_DIR');fs.mkdirSync(dest,{recursive:true});const result=buildSearchScope(JSON.parse(fs.readFileSync(src)),JSON.parse(fs.readFileSync(rss)));for(const [k,v] of Object.entries(result))fs.writeFileSync(path.join(dest,k+'.json'),JSON.stringify(v,null,k==='summary'?2:0));fs.writeFileSync(path.join(dest,'input-hashes.json'),JSON.stringify({ledger:createHash('sha256').update(fs.readFileSync(src)).digest('hex'),rss:createHash('sha256').update(fs.readFileSync(rss)).digest('hex')},null,2));console.log(JSON.stringify(result.summary));}
