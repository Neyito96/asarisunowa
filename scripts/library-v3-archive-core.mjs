/** Pure proposal builder; does not access GAS, Sheet, Properties, or network.
 * Not wired into production or a GAS writer. No persistence of any kind.
 * Callers must confirm identity and hash the exact RSS raw text externally.
 * Title from a link is explicit text only. No article relation is inferred.
 */
function textValue(v){return String(v==null?'':v);}
function shaKey(v){return textValue(v).trim();}
function parseRelatedLinks(raw){
 const text=textValue(raw);
 const out=[];const seen=new Set();
 const add=(url,title,source)=>{
  const cleaned=textValue(url).replace(/&amp;/g,'&').replace(/[)\]。、，,;；]+$/g,'');
  if(!/^https?:\/\/[^\s<>]+$/i.test(cleaned))return;
  if(seen.has(cleaned))return;seen.add(cleaned);
  const t=textValue(title).replace(/<[^>]+>/g,'').trim();
  const good=t&&t!==cleaned&&t.length<=180?t:null;
  out.push({url:cleaned,title:good,titleVerified:!!good,source,kind:'LINK_REVIEW',status:'UNVERIFIED'});
 };
 for(const m of text.matchAll(/\[([^\]\n]{1,180})\]\((https?:\/\/[^\s)]+)\)/g))add(m[2],m[1],'markdown');
 for(const m of text.matchAll(/<a\b([^>]*?)href\s*=\s*["'](https?:\/\/[^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi))add(m[2],m[4],'html');
 for(const line of text.split(/\r?\n/)){
  const m=line.match(/^\s*(?:関連記事|関連リンク|参考記事|参考資料)?\s*[：:　 ]?\s*(.{1,160}?)\s*[：:：]\s*(https?:\/\/[^\s<>]+)/);
  if(m){const generic=/^(?:関連記事|関連リンク|参考記事|参考資料)$/u.test(m[1].trim());add(m[2],generic?null:m[1],'labelled_line');}
 }
 for(const m of text.matchAll(/https?:\/\/[^\s<>"'）)\]}]+/g))add(m[0],null,'plain_url');
 return out;
}
function planArchive(input){
 const x=input||{}, epId=shaKey(x.epId),guid=shaKey(x.guid),sourceHash=shaKey(x.sourceHash),sourceUrl=shaKey(x.sourceUrl),raw=textValue(x.raw);
 if(!epId||!guid||!sourceHash||!/^https:\/\//.test(sourceUrl))return {status:'HOLD_IDENTITY_OR_SOURCE',records:[],writes:0};
 if(x.identityConfirmed!==true||x.excluded===true||x.conflict===true)return {status:'HOLD_PROTECTED',records:[],writes:0};
 if(!raw)return {status:'HOLD_EMPTY_RAW',records:[],writes:0};
 const key=[epId,guid,sourceHash].map(encodeURIComponent).join('|');
 if((x.existingVersionKeys||[]).includes(key))return {status:'ALREADY_ARCHIVED',records:[],writes:0};
 const existingRaw=textValue(x.existingRaw);
 const same=existingRaw===raw;
 const record=Object.freeze({key,epId,guid,raw,sourceHash,sourceUrl,observedAt:shaKey(x.observedAt)||null,relation:same?'SAME_AS_LEDGER':'ALTERNATE_VERSION',links:parseRelatedLinks(raw),status:'PROPOSAL_ONLY'});
 return {status:same?'ARCHIVE_SNAPSHOT_CANDIDATE':'ARCHIVE_ALTERNATE_CANDIDATE',records:[record],writes:0,ledgerMutation:false};
}
export {parseRelatedLinks,planArchive};
