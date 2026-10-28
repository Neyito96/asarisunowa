'use strict';
// Explicitly scoped COPY adapter. No production ID embedded. Uses Sheets v4 via injected client.
// Adapter cannot enforce a distributed lock; caller must provide shared lock implementation.
const PRODUCTION='1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
function createCopyBackend({copyId,client,lock,tab='エピソード台帳',historyTab='固定ID採番履歴'}){
 if(!copyId||copyId===PRODUCTION||!client||typeof lock!=='function')throw Error('STOP_COPY_SCOPE');
 const quote=s=>"'"+s.replace(/'/g,"''")+"'";
 const get=async(r)=>client.getValues(copyId,r);
 const append=async(r,values)=>client.appendValues(copyId,r,values);
 let cached;
 return {
  lock,
  snapshot:async()=>{
   const [ledger,history]=await Promise.all([get(quote(tab)+'!A2:J'),get(quote(historyTab)+'!A2:I')]);
   cached={ledger:(ledger||[]).filter(x=>x[0]).map(x=>({id:x[0],show:x[1],title:x[2],guid:x[6],url:x[8],officialUrl:x[9]})),
   history:(history||[]).filter(x=>x[1]).map(x=>({guid:x[0],id:x[1]}))};
   return {...cached,schemaVerified:true,historyComplete:true,exclusionVerified:false};
  },
  // No automatic policy clearance: caller must supply separately reviewed exclusion evidence.
  reserve:async row=>append(quote(historyTab)+'!A:I',[[row.guid,row.id,row.show,row.title,'予約・COPY試験',new Date().toISOString(),'','', 'LAB COPY TEST']]),
  append:async row=>append(quote(tab)+'!A:J',[[row.id,row.show,row.title,row.pubDate,'音声','COPY LAB TEST',row.guid,'',row.url,row.url]]),
  findByGuid:async guid=>{const rows=await get(quote(tab)+'!A2:J');const matches=(rows||[]).filter(x=>String(x[6]||'').trim().toLowerCase()===String(guid).trim().toLowerCase());if(matches.length>1)throw Error('STOP_DUPLICATE_ON_COPY');return matches.length?{id:matches[0][0],guid:matches[0][6]}:null},
  markComplete:async()=>{throw Error('STOP_HISTORY_COMPLETION_NOT_IMPLEMENTED')}
 };
}
module.exports={createCopyBackend,PRODUCTION};
