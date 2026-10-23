/** READ_ONLY coverage view for current RSS and ledger snapshots.
 * A GUID absent from a ledger snapshot is NOT proof an episode is new.
 * No network, GAS, Sheet, Properties, or write operations.
 */
const SHOWS=['ニュースの学校','ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ドーナツ','報談'];
function auditFeedCoverage({show,rssItems=[],ledgerRows=[],observedAt=null}={}){
 if(!SHOWS.includes(show))return {status:'OUT_OF_SCOPE',writes:0};
 const ledger=new Map(),rssCounts=new Map();
 for(const row of ledgerRows){if(row.show!==show)continue;const guid=String(row.guid||'').trim();if(!guid)continue;if(!ledger.has(guid))ledger.set(guid,[]);ledger.get(guid).push(row);}
 for(const item of rssItems){const guid=String(item.guid||'').trim();if(guid)rssCounts.set(guid,(rssCounts.get(guid)||0)+1);}
 const details=rssItems.map(item=>{
  const guid=String(item.guid||'').trim(),matched=ledger.get(guid)||[],count=rssCounts.get(guid)||0;
  const status=!guid?'HOLD_BLANK_GUID':count>1?'HOLD_RSS_DUPLICATE':matched.length>1?'HOLD_LEDGER_DUPLICATE':matched.length===1?'KNOWN_GUID':'REVIEW_UNMATCHED';
  return {guid,title:String(item.title||''),published:item.published||null,status,epId:status==='KNOWN_GUID'?String(matched[0].epId||''):null};
 });
 const counts={};for(const d of details)counts[d.status]=(counts[d.status]||0)+1;
 return {status:'READ_ONLY_COVERAGE',show,observedAt,feedItems:rssItems.length,ledgerRows:ledgerRows.filter(r=>r.show===show).length,counts,details,writes:0,
  newEntriesConfirmed:0,requiresManualOrSecondaryIdentityReview:(counts.REVIEW_UNMATCHED||0),autoAppend:false};
}
export {SHOWS,auditFeedCoverage};
