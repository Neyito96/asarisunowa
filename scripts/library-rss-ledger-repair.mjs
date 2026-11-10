// Pure, bounded native Sheets repair planner. The caller must re-read identities before applying.
import {createHash} from 'node:crypto';
import {enrichOfficialMetadata} from './library-official-automation.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('base64');
const webhash=v=>hash(v).replaceAll('+','-').replaceAll('/','_');
export function planRssLedgerRepair({cells,item,clip,id,checkedAt,apiUrl,urlChecks={},sheetId,rowIndex,promoteDraft=false}){
 const existingId=cells[0]?.userEnteredValue?.stringValue, exclusion=cells[38]?.userEnteredValue?.stringValue;
 if(exclusion&&!['未指定','なし','false','0','no'].includes(exclusion)&&!(promoteDraft&&!existingId&&String(cells[39]?.userEnteredValue?.stringValue).includes('仮登録・EP-ID未採番')))throw Error('Existing exclusion/hold protected');
 if(cells[0]?.userEnteredValue?.stringValue&&cells[0].userEnteredValue.stringValue!==id)throw Error('Different existing ID');
 if(cells[6]?.userEnteredValue?.stringValue&&cells[6].userEnteredValue.stringValue!==item.guid)throw Error('Different GUID');
 if(clip.Id!==item.guid||clip.Title!==item.title||Date.parse(clip.PublishedUtc)!==Date.parse(item.pubDate)||clip.PublishedUrl!==item.link)throw Error('RSS / official JSON identity conflict');
 if(!/^EP-\d{5}$/.test(id)||!/^https:\/\//.test(item.audio)||!item.description)throw Error('Required RSS data missing');
 const clipId=new URL(item.audio).pathname.match(/\/clips\/[^/]+\/[^/]+\/([^/]+)\//)?.[1];if(clipId!==item.guid)throw Error('Audio UUID mismatch');
 const duration=String(item.duration).split(':').reduce((n,v)=>n*60+Number(v),0);if(!Number.isFinite(duration)||duration<=0)throw Error('Invalid duration');
 const meta=enrichOfficialMetadata(item.description),r=Array.from({length:55},(_,i)=>cells[i]?.userEnteredValue?.stringValue??cells[i]?.userEnteredValue?.numberValue??'');
 const jst=t=>new Date(Date.parse(t)+9*3600000).toISOString().slice(0,19).replace('T',' ').replaceAll('-','/');
 Object.assign(r,{0:id,2:item.title,3:jst(item.pubDate),4:'音声',5:'朝日新聞ポッドキャスト公式RSS（Omny Studio）',6:item.guid,8:item.link,9:item.link,13:item.image,14:item.audio,15:duration,
  16:urlChecks.page?.status===200?'HTTP 200確認':'未確認',17:urlChecks.audio?.status===206||urlChecks.audio?.status===200?'公式音声URL・HTTP応答確認':'公式RSS記載あり',18:'未確認（未再生）',19:'',20:'公式RSS原文保存済み',21:item.description,22:meta.description,23:meta.staff.join('\n'),24:clip.HasPublishedTranscript===false?'公式Omny文字起こし未公開':'未確認',27:item.language||'',28:meta.relatedArticles.map(a=>a.url).join('\n'),31:jst(checkedAt),32:item.feedUrl,33:jst(clip.ModifiedAtUtc),34:jst(checkedAt),35:'公式RSSとOmny JSONをGUID・タイトル・公開日時・個別URLで照合。音声HTTP応答確認は実再生検証ではない。',37:'V3-official-policy-1',38:'未指定',39:'公式RSS照合済み。配信先個別URL・利用許諾・音声実再生は未確認。公開判定とプレイリスト反映は別工程。',44:item.feedUrl,50:'公式RSS【出演・スタッフ】。氏名・所属・明示役割はX列に全件保持（5名を超えても省略しない）。',51:clip.Id,52:clip.PublishedUrl,53:clip.EmbedUrl,54:apiUrl});
 for(let i=0;i<5;i++)r[45+i]=meta.people[i]?.name||'';
 const requests=[],changed=[];
 for(let col=0;col<55;col++){
  const old=cells[col]?.userEnteredValue;if(old?.formulaValue)throw Error('Formula protected '+col);
  const value={...(typeof r[col]==='number'?{numberValue:r[col]}:{stringValue:r[col]})};
  if(JSON.stringify(old||{stringValue:''})===JSON.stringify(value)&&col!==28)continue;
  const cell={userEnteredValue:value};let fields='userEnteredValue';
  if(col===28){let n=0;cell.textFormatRuns=meta.relatedArticles.map(a=>{const run={startIndex:n,format:{link:{uri:a.url}}};n+=a.url.length+1;return run;});fields+=',textFormatRuns';}
  if(col===23){cell.note=JSON.stringify({schema:1,people:meta.people,sourceUrl:item.feedUrl,rawDescriptionColumn:'V',overflowPolicy:'all staff retained in X; first five names in AT:AX'},null,2);fields+=',note';}
  if(col===15){cell.note='RSS itunes:duration='+item.duration+' seconds; official JSON DurationSeconds='+clip.DurationSeconds;fields+=',note';}
  if(col===21){cell.note='Official RSS description, unabridged. SHA256='+createHash('sha256').update(item.description).digest('hex');fields+=',note';}
  requests.push({updateCells:{range:{sheetId,startRowIndex:rowIndex,endRowIndex:rowIndex+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[cell]}],fields}});changed.push(col);
 }
 const canonical=r.slice(0,51);canonical[3]=new Date(item.pubDate).toISOString();
 const identity=['VERIFIED',item.guid,webhash(canonical),'',webhash(id),'RSS_registered',checkedAt,item.guid];
 return {requests,row:r,changed,metadata:meta,state:{identity,registrationEvidence:['VERIFIED',item.guid,webhash(canonical),'','','official_rss_plus_json',checkedAt,JSON.stringify({pubDate:item.pubDate,source:item.feedUrl,officialJson:apiUrl,rawDescriptionSHA256:createHash('sha256').update(item.description).digest('hex')})]}};
}

/** Subsequent blank-only fill: keep immutable registration evidence, refresh row verification atomically. */
export function planVerifiedPlatformFill({row,state,evidence,platform,sheetId,rowIndex,stateSheetId,stateRowIndex,checkedAt}){
 const columns={apple:12,listen:10,spotify:11,pocket:41,pody:42},hosts={apple:'podcasts.apple.com',listen:'listen.style',spotify:'open.spotify.com',pocket:'pca.st',pody:'pody.fm'};
 if(!(platform in columns)||!evidence||evidence.episodeGuid!==row[6])throw Error('Platform identity unverified');
 const url=new URL(evidence.url);if(url.protocol!=='https:'||url.hostname!==hosts[platform]||url.username||url.password)throw Error('Platform URL rejected');
 if(platform==='apple'&&!url.searchParams.has('i'))throw Error('Apple programme URL is not an episode');
 if(platform==='spotify'&&!/^\/episode\/[a-zA-Z0-9]{22}$/.test(url.pathname))throw Error('Spotify programme URL is not an episode');
 const col=columns[platform];if(row[col]){if(row[col]===evidence.url)return {requests:[],row,state};throw Error('Existing platform value protected');}
 const canonical=r=>{const a=r.slice(0,51).map(v=>v??'');a[3]=new Date(String(a[3]).replaceAll('/','-').replace(' ','T')+(/(?:Z|[+-]\d\d:\d\d)$/.test(a[3])?'':'+09:00')).toISOString();return a;};
 if(webhash(canonical(row)).replace(/=+$/,'')!==String(state.identity?.[2]).replace(/=+$/,''))throw Error('Concurrent row change');
 const after=row.slice();after[col]=evidence.url;const next=structuredClone(state);next.identity[2]=webhash(canonical(after));
 next[platform]=['VERIFIED',row[6],webhash(canonical(row)),webhash(evidence),webhash(evidence.url),'exact_platform_identity',checkedAt,JSON.stringify(evidence)];
 const requests=[{updateCells:{range:{sheetId,startRowIndex:rowIndex,endRowIndex:rowIndex+1,startColumnIndex:col,endColumnIndex:col+1},rows:[{values:[{userEnteredValue:{stringValue:evidence.url},note:JSON.stringify(evidence)}]}],fields:'userEnteredValue,note'}},{updateCells:{range:{sheetId:stateSheetId,startRowIndex:stateRowIndex,endRowIndex:stateRowIndex+1,startColumnIndex:1,endColumnIndex:3},rows:[{values:[{userEnteredValue:{stringValue:JSON.stringify(next)}},{userEnteredValue:{stringValue:checkedAt}}]}],fields:'userEnteredValue'}}];
 return {requests,row:after,state:next};
}
