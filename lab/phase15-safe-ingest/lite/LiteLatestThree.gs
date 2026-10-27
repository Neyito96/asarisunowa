'use strict';
/** Phase15 standalone trial — add-only, read-only. */
function phase15Latest3Scan_(sources, ledgerRows, fetchFeed) {
  var shows=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ','スポンジ','ニュースの学校','ドーナツ','報談'];
  var ledger=new Map(), urls=new Map(), seenAcross=new Set(), results=[];
  ledgerRows.forEach(function(r){
    var g=String(r.guid||'').trim().toLowerCase();
    if(g){if(!ledger.has(g))ledger.set(g,[]);ledger.get(g).push(r);}
    [r.url,r.officialUrl].forEach(function(u){u=String(u||'').trim();if(u){if(!urls.has(u))urls.set(u,[]);urls.get(u).push(r);}});
  });
  shows.forEach(function(show){
    var matched=sources.filter(function(s){return s.show===show;});
    var out={show:show,status:'OK',fetched:null,selected:0,existing:0,unregistered:0,duplicates:0,unknown:0,errors:[],candidates:[]};
    if(matched.length!==1 || !/^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/1e3bd144-9b57-451a-93cf-ac0e00e74446\/|feeds\.megaphone\.fm\/TASC[0-9]+(?:\?|$))/.test(matched[0].url)){
      out.status='SOURCE_PENDING';out.errors.push('SOURCE_INVALID_MISSING_OR_DUPLICATE');results.push(out);return;
    }
    var items;
    try{items=fetchFeed(matched[0]);if(!Array.isArray(items))throw Error('RSS_NOT_ARRAY');out.fetched=items.length;}
    catch(e){out.status='SOURCE_PENDING';out.errors.push('RSS_'+String(e.message||e));results.push(out);return;}
    var valid=[], seenLocal=new Set(), invalid=0, duplicated=0;
    items.forEach(function(item){
      var g=String(item.guid||'').trim().toLowerCase(), ms=Date.parse(String(item.pubDate||''));
      if(!g||!Number.isFinite(ms)){invalid++;return;}
      if(seenLocal.has(g)){duplicated++;return;}
      seenLocal.add(g);valid.push({item:item,ms:ms,guid:g});
    });
    if(invalid||duplicated){out.status='SOURCE_PENDING';out.unknown=invalid;out.duplicates=duplicated;
      if(invalid)out.errors.push('RSS_MISSING_GUID_OR_INVALID_PUBDATE_'+invalid);
      if(duplicated)out.errors.push('RSS_DUPLICATE_GUID_'+duplicated);
      // Ambiguous feed: do not silently promote a candidate as the latest three.
      results.push(out);return;
    }
    valid.sort(function(a,b){return b.ms-a.ms||a.guid.localeCompare(b.guid);});
    valid.slice(0,3).forEach(function(v){
      var item=v.item,g=v.guid,u=String(item.link||'').trim(), matches=ledger.get(g)||[];
      var status='UNREGISTERED_CANDIDATE',ep=null,reason='';
      if(seenAcross.has(g)){status='DUPLICATE';reason='CROSS_FEED_GUID';}
      else if(matches.length>1){status='UNKNOWN';reason='LEDGER_GUID_COLLISION';}
      else if(matches.length===1){status='REGISTERED';ep=matches[0].id||null;}
      else if(u&&urls.has(u)){status='UNKNOWN';reason='URL_IDENTITY_POSSIBLE';}
      seenAcross.add(g);
      if(status==='REGISTERED')out.existing++;
      else if(status==='UNREGISTERED_CANDIDATE')out.unregistered++;
      else if(status==='DUPLICATE')out.duplicates++;
      else {out.unknown++;out.status='SOURCE_PENDING';}
      out.candidates.push({show:show,title:String(item.title||''),pubDate:new Date(v.ms).toISOString(),
        guid:g,officialUrl:u,status:status,existingEpId:ep,reason:reason});
    });
    out.selected=out.candidates.length;results.push(out);
  });
  return {mode:'PHASE15_LITE_LATEST3_READ_ONLY',observedAt:new Date().toISOString(),limitPerShow:3,
    maxItems:21,rows:results,totals:{selected:results.reduce(function(n,r){return n+r.selected;},0),
      registered:results.reduce(function(n,r){return n+r.existing;},0),
      unregisteredCandidates:results.reduce(function(n,r){return n+r.unregistered;},0),
      duplicates:results.reduce(function(n,r){return n+r.duplicates;},0),
      unknown:results.reduce(function(n,r){return n+r.unknown;},0),
      pendingFeeds:results.filter(function(r){return r.status!=='OK';}).length},
    sourceCompleteness:results.some(function(r){return r.status!=='OK';})?'SOURCE_PENDING':'OBSERVED_RSS_ONLY',
    authoritativeMissingTotal:false,productionWrites:0};
}
