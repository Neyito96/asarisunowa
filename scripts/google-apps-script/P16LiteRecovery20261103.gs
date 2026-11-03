/**
 * Phase 15 emergency new-episode recovery. No trigger. No old-row backfill.
 * 1) P16_RECOVERY_PREVIEW(): zero writes; inspect 7/7 feed coverage and candidates.
 * 2) P16_RECOVERY_WRITE(): only when preview reports all feeds OK.
 * Requires existing P15_AUTO.intake; never edit original V/W.
 */
var P16_RECOVERY_SHEET_ID_ = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
function P16_recoveryFeedList_() {
  var ss=SpreadsheetApp.openById(P16_RECOVERY_SHEET_ID_);
  var sh=ss.getSheetByName('取得元一覧');
  if(!sh) throw Error('P16_SOURCE_SHEET_MISSING');
  var data=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),8).getValues();
  var feeds=data.map(function(r){return {show:String(r[0]||''),url:String(r[7]||'')};})
    .filter(function(x) {
      return !/AJW|アルキキ|YouTube|朝ポキTV|旧SDGs|LISTEN/.test(x.show) &&
        /^https:\/\/(?:www\.omnycontent\.com\/d\/playlist\/|feeds\.megaphone\.fm\/)/.test(x.url);
    });
  if(feeds.length<7 || feeds.length>8) throw Error('P16_FEED_COUNT_UNEXPECTED_'+feeds.length);
  return feeds;
}
// Remove the remaining <item> elements BEFORE DOM parsing; preserve feed
// XML prolog, root namespaces, channel metadata and closing elements.
function P16_clipXml_(xml, maxItems) {
  var starts=[], re=/<item(?:\s[^>]*)?>/gi,m;
  while((m=re.exec(xml))!==null)starts.push(m.index);
  if(starts.length<=maxItems)return {xml:xml,total:starts.length};
  var endRe=/<\/item\s*>/gi,last=null;
  while((m=endRe.exec(xml))!==null)last=m;
  if(!last || last.index<starts[maxItems])throw Error('P16_XML_ITEM_BOUNDARY');
  return {xml:xml.slice(0,starts[maxItems])+xml.slice(last.index+last[0].length),total:starts.length};
}
function P16_recoverySources_(maxItems) {
  var feeds=P16_recoveryFeedList_();
  var reqs=feeds.map(function(f){return {url:f.url,muteHttpExceptions:true,followRedirects:true};});
  var responses=UrlFetchApp.fetchAll(reqs);
  var byGuid={},log=[];
  var itunes=XmlService.getNamespace('itunes','http://www.itunes.com/dtds/podcast-1.0.dtd');
  feeds.forEach(function(f,i) {
    try {
      var response=responses[i], status=response.getResponseCode();
      if(status!==200)throw Error('HTTP_'+status);
      var clipped=P16_clipXml_(response.getContentText('UTF-8'),maxItems);
      var root=XmlService.parse(clipped.xml).getRootElement();
      var channel=root.getChild('channel');
      if(!channel)throw Error('RSS_CHANNEL_MISSING');
      var count=0;
      channel.getChildren('item').forEach(function(it){
        var guid=String(it.getChildText('guid')||'').trim().toLowerCase();
        if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(guid))return;
        var enc=it.getChild('enclosure'),im=it.getChild('image',itunes);
        var dur=it.getChildText('duration',itunes)||'';
        var sec=0,parts=String(dur).split(':').map(Number);
        if(parts.length===3&&parts.every(Number.isFinite))sec=parts[0]*3600+parts[1]*60+parts[2];
        else if(parts.length===2&&parts.every(Number.isFinite))sec=parts[0]*60+parts[1];
        else if(parts.length===1&&Number.isFinite(parts[0]))sec=parts[0];
        var item={
          guid:guid,show:f.show,source:f.url,
          title:it.getChildText('title')||'',published:it.getChildText('pubDate')||'',
          description:it.getChildText('description')||'',link:it.getChildText('link')||'',
          audio:enc&&enc.getAttribute('url')?enc.getAttribute('url').getValue():'',
          image:im&&im.getAttribute('href')?im.getAttribute('href').getValue():'',
          duration:sec
        };
        if(byGuid[guid]){byGuid[guid].collision=true;item.collision=true;}
        else byGuid[guid]=item;
        count++;
      });
      log.push({show:f.show,status:'OK',fetched:clipped.total,inspected:count});
    }catch(e){log.push({show:f.show,status:'ERROR',reason:String(e).slice(0,160)});}
  });
  return {byGuid:byGuid,log:log,unique:Object.keys(byGuid).length,expected:feeds.length};
}
function P16_recoveryInspect_(sources) {
  var ss=SpreadsheetApp.openById(P16_RECOVERY_SHEET_ID_);
  var sh=ss.getSheetByName('エピソード台帳');
  var last=sh.getLastRow();
  var existing=new Set(sh.getRange(2,7,Math.max(1,last-1),1).getDisplayValues()
    .map(function(r){return String(r[0]||'').trim().toLowerCase();}));
  var since=Date.parse(PropertiesService.getScriptProperties().getProperty('P15_INGEST_SINCE')||'');
  var candidates=Object.keys(sources.byGuid).map(function(g){return sources.byGuid[g];})
    .filter(function(x){var t=Date.parse(x.published);return isFinite(t)&&t>=since&&t<=Date.now()&&!existing.has(x.guid);})
    .map(function(x){return {show:x.show,title:x.title,guid:x.guid,published:x.published,officialLink:!!x.link};});
  var ok=sources.log.filter(function(x){return x.status==='OK';}).length;
  return {status:ok===sources.expected?'READY':'PARTIAL',feedsOk:ok,feedsExpected:sources.expected,
    feeds:sources.log,unregistered:candidates.slice(0,30),unregisteredCount:candidates.length,writes:0};
}
function P16_RECOVERY_PREVIEW() {
  var sources=P16_recoverySources_(10);
  var report=P16_recoveryInspect_(sources);
  Logger.log(JSON.stringify(report));
  return report;
}
function P16_RECOVERY_WRITE() {
  // P15_AUTO.intake takes the ScriptLock itself. Never nest another lock here.
  var sources=P16_recoverySources_(10),preview=P16_recoveryInspect_(sources);
  if(preview.status!=='READY')throw Error('P16_FEEDS_PARTIAL_NO_WRITE_'+preview.feedsOk+'/'+preview.feedsExpected);
  if(!preview.unregisteredCount)return {status:'NO_NEW_EPISODES',added:0,feedsOk:preview.feedsOk};
  // Existing production intake owns GUID checks, reservations and EP numbering.
  var ss=SpreadsheetApp.openById(P16_RECOVERY_SHEET_ID_);
  var result=P15_AUTO.intake(ss,sources,Date.now()+160000,{limit:10});
  Logger.log(JSON.stringify({status:'INTAKE_DONE',feedsOk:preview.feedsOk,result:result}));
  return result;
}
