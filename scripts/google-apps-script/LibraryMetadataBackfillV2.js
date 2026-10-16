/** Independent V2 metadata planner. No triggers; no writes. V1 remains unchanged.
 * Design: fetch RSS concurrently, build unique GUID index, strictly verify title,
 * inspect candidate fields and report batches. A separate reviewed writer will follow.
 */
const LIB_V2_SHEET_ID = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4';
function previewLibraryMetadataV2() {
  const start = Date.now();
  const ss = SpreadsheetApp.openById(LIB_V2_SHEET_ID);
  const sh = ss.getSheetByName('エピソード台帳');
  const sources = ss.getSheetByName('取得元一覧');
  if (!sh || !sources) throw Error('Required tabs missing');
  const all = sh.getDataRange().getValues();
  const header = all.shift();
  const required = {0:'台帳ID',2:'タイトル',6:'外部ID',13:'画像URL',14:'音声URL',15:'再生時間（秒）',19:'音源不在の根拠',21:'概要原文'};
  Object.keys(required).forEach(k=>{if(header[+k]!==required[k]) throw Error('Header mismatch: '+k);});
  const feedUrls = [...new Set(sources.getDataRange().getValues().slice(1).map(r=>String(r[7]||'').trim()).filter(u=>/^https:\/\//.test(u)&&!/youtube\.com|youtu\.be/i.test(u)))];
  const normalize = x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const guidKey = x=>{const s=String(x||'').trim();const m=s.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/i);return (m?m[1]:s).toLowerCase();};
  const index = new Map();
  all.forEach((r,i)=>{const k=guidKey(r[6]);if(k){if(!index.has(k))index.set(k,[]);index.get(k).push({row:i+2,data:r});}});
  const requests=feedUrls.map(url=>({url,muteHttpExceptions:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}}));
  const report={mode:'DRY_RUN',scanned:all.length,feeds:feedUrls.length,matched:0,proposedEpisodes:0,proposedCells:0,missingAudioEvidence:0,ambiguous:0,titleMismatch:0,excluded:0,feedErrors:[],byField:{image:0,audio:0,duration:0,description:0,evidence:0},samples:[]};
  // fetchAll runs parallel network requests; malformed feeds are quarantined.
  const responses=UrlFetchApp.fetchAll(requests);
  responses.forEach((response,i)=>{
    const url=feedUrls[i];
    if(response.getResponseCode()!==200){report.feedErrors.push({url,http:response.getResponseCode()});return;}
    let items;
    try{const channel=XmlService.parse(response.getContentText('UTF-8')).getRootElement().getChild('channel');if(!channel)throw Error('No RSS channel');items=channel.getChildren('item');}
    catch(e){report.feedErrors.push({url,error:String(e)});return;}
    items.forEach(item=>{
      const matches=index.get(guidKey(item.getChildText('guid')))||[];
      if(matches.length>1){report.ambiguous++;return;}
      if(matches.length!==1)return;
      const entry=matches[0],r=entry.data;
      if(String(r[38]||'').trim()&&!['未指定','なし','false','0','no'].includes(String(r[38]).trim().toLowerCase())){report.excluded++;return;}
      if(normalize(item.getChildText('title'))!==normalize(r[2])){report.titleMismatch++;return;}
      report.matched++;
      const enclosure=item.getChild('enclosure');
      const audio=enclosure?.getAttribute('url')?.getValue()||'';
      const description=String(item.getChildText('description')||'').trim().replace(/\r\n?|\n/g,'\\n');
      const durationNode=item.getChildren().find(n=>n.getName()==='duration'&&n.getNamespace().getPrefix()==='itunes');
      const d=durationNode?String(durationNode.getText()||'').trim():'';
      const duration=/^\d+$/.test(d)?Number(d):(/^\d+:\d{2}(?::\d{2})?$/.test(d)?d.split(':').map(Number).reduce((a,b)=>a*60+b,0):null);
      const imageNode=item.getChildren().find(n=>n.getName()==='image'&&n.getNamespace().getPrefix()==='itunes');
      const image=imageNode?.getAttribute('href')?.getValue()||'';
      const fields=[];
      [[13,image,'image'],[14,audio,'audio'],[15,duration,'duration'],[21,description,'description']].forEach(([col,val,label])=>{
        if(val!==null&&val!==''&&!String(r[col]||'').trim()){fields.push({column:col+1,field:label});report.byField[label]++;report.proposedCells++;}
      });
      if(!audio&&!String(r[14]||'').trim()){
        report.missingAudioEvidence++;
        const sdgs=/SDGs|こどもそうだんしつ|旧SDGs/i.test(String(r[1]||'')+' '+url);
        if(!sdgs&&!String(r[19]||'').trim()){fields.push({column:20,field:'evidence'});report.byField.evidence++;report.proposedCells++;}
      }
      if(fields.length){report.proposedEpisodes++;if(report.samples.length<25)report.samples.push({id:r[0],row:entry.row,fields});}
    });
  });
  report.elapsedSeconds=Math.round((Date.now()-start)/1000);
  Logger.log(JSON.stringify(report));
  return report;
}
