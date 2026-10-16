/**
 * READ ONLY: strict Omny clip UUID -> RSS GUID reconciliation.
 * Only UUIDs from /clips/<org>/<show>/<clip>/ or /episode/<clip>
 * in ledger I (元ページURL) / AG (取得元URL) are considered.
 * Verify RSS GUID, show, normalized title, JST date, one-to-one mapping,
 * no existing GUID, and no deletion/exclusion history.
 */
function previewLibraryV2OmnyClipGuidVerified() {
 const ss=SpreadsheetApp.openById(LIB_V2_SHEET_ID),sh=ss.getSheetByName('エピソード台帳'),src=ss.getSheetByName('取得元一覧'),ex=ss.getSheetByName('削除・除外履歴');
 if(!sh||!src||!ex)throw Error('Missing required tab');
 const data=sh.getDataRange().getValues(),headers=data.shift();
 const req={0:'台帳ID',1:'番組名',2:'タイトル',3:'配信日時（JST）',6:'外部ID',8:'元ページURL',32:'取得元URL',38:'人間除外'};
 Object.keys(req).forEach(k=>{if(headers[+k]!==req[k])throw Error('Header mismatch '+k);});
 const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const uuid=x=>{const m=String(x||'').match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i);return m?m[0].toLowerCase():'';};
 const date=x=>{if(x instanceof Date&&!isNaN(x.getTime()))return Utilities.formatDate(x,'Asia/Tokyo','yyyy-MM-dd');const m=String(x||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';};
 const blocked=x=>{const s=norm(x).toLowerCase();return !!s&&!['未指定','なし','false','0','no'].includes(s);};
 const clip=x=>{const s=String(x||'');if(!/https?:\/\/(?:traffic\.)?(?:omny\.fm|omnycontent\.com)\//i.test(s))return '';const m=s.match(/\/clips\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/([0-9a-f-]{36})(?:\/|\?|#|$)/i)||s.match(/\/episode\/([0-9a-f-]{36})(?:\/|\?|#|$)/i)||s.match(/\/shows\/[^/?#]+\/([0-9a-f-]{36})(?:\/|\?|#|$)/i);return m?uuid(m[1]):'';};
 const known=new Set(),byClip=new Map(),candidateRows=[];
 data.forEach((r,i)=>{if(uuid(r[6]))known.add(uuid(r[6]));if(String(r[6]||'').trim()||blocked(r[38]))return;const a=clip(r[8]),b=clip(r[32]);if(a&&b&&a!==b)return;const c=a||b;if(!c)return;const p={id:String(r[0]),row:i+2,show:norm(r[1]),title:norm(r[2]),date:date(r[3]),clip:c};candidateRows.push(p);if(!byClip.has(c))byClip.set(c,[]);byClip.get(c).push(p);});
 const deletedGuids=new Set(),deletedIds=new Set();ex.getDataRange().getValues().slice(1).forEach(r=>{const g=uuid(r[0]);if(g)deletedGuids.add(g);if(String(r[1]||'').trim())deletedIds.add(String(r[1]).trim());});
 const feeds=new Map();src.getDataRange().getValues().slice(1).forEach(r=>{const u=String(r[7]||'').trim();if(/^https:\/\//.test(u)&&!/youtube\.com|youtu\.be/i.test(u)){if(feeds.has(u)&&feeds.get(u)!==norm(r[0]))throw Error('Conflicting show label');feeds.set(u,norm(r[0]));}});
 const urls=[...feeds.keys()],responses=UrlFetchApp.fetchAll(urls.map(url=>({url,muteHttpExceptions:true}))),rss=new Map();
 responses.forEach((res,i)=>{if(res.getResponseCode()!==200)throw Error('RSS HTTP '+res.getResponseCode()+' '+urls[i]);const ch=XmlService.parse(res.getContentText('UTF-8')).getRootElement().getChild('channel');if(!ch)throw Error('No RSS channel');ch.getChildren('item').forEach(item=>{const g=uuid(item.getChildText('guid'));if(!g)return;const d=new Date(String(item.getChildText('pubDate')||''));if(isNaN(d.getTime()))return;const p={guid:g,show:feeds.get(urls[i]),title:norm(item.getChildText('title')),date:Utilities.formatDate(d,'Asia/Tokyo','yyyy-MM-dd')};if(!rss.has(g))rss.set(g,[]);rss.get(g).push(p);});});
 const eligible=[],holds={duplicateLedgerClip:0,notInRss:0,rssConflict:0,metadataMismatch:0,knownGuid:0,humanDeleted:0};
 for(const [g,entries] of byClip){if(entries.length!==1){holds.duplicateLedgerClip++;continue;}const p=entries[0],hits=rss.get(g)||[];if(!hits.length){holds.notInRss++;continue;}if(hits.some(x=>x.show!==hits[0].show||x.title!==hits[0].title||x.date!==hits[0].date)){holds.rssConflict++;continue;}if(p.show!==hits[0].show||p.title!==hits[0].title||p.date!==hits[0].date){holds.metadataMismatch++;continue;}if(known.has(g)){holds.knownGuid++;continue;}if(deletedGuids.has(g)||deletedIds.has(p.id)){holds.humanDeleted++;continue;}eligible.push({id:p.id,row:p.row,guid:g});}
 eligible.sort((a,b)=>a.row-b.row);
 const result={mode:'READ_ONLY_OMNY_CLIP_RSS_GUID_VERIFIED',candidateRows:candidateRows.length,eligible:eligible.length,holds,feeds:urls.length,samples:eligible.slice(0,20),writes:0};
 Logger.log(JSON.stringify(result));return result;
}
