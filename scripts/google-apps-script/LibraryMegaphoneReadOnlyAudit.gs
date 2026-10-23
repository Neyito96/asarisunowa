/** Phase 14 Megaphone inspection only. No sheet, property or trigger writes.
 * Add as a separate GAS file; never call the existing Omny-only writer.
 */
function inspectMegaphoneAlternativesReadOnly() {
  const COPY='1IhnYURLqhM8i3ACrkNbDujplXRtyI41rR19qGnwZlMY';
  const ss=SpreadsheetApp.openById(COPY);
  const sh=ss.getSheetByName('取得元一覧');
  if (!sh) throw Error('SOURCE_LIST_MISSING');
  const feeds=sh.getRange(2,1,7,8).getValues()
    .map(r=>({show:String(r[0]||''),url:String(r[7]||'')}))
    .filter(f=>/^https:\/\/feeds\.megaphone\.fm\/TASC[A-Za-z0-9]+$/.test(f.url));
  if (feeds.length!==2) throw Error('EXPECTED_TWO_MEGAPHONE_FEEDS');
  const nsItunes=XmlService.getNamespace('http://www.itunes.com/dtds/podcast-1.0.dtd');
  const nsAtom=XmlService.getNamespace('http://www.w3.org/2005/Atom');
  const since=Date.now()-7*86400000,records=[];
  for (const feed of feeds) {
    const response=UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true});
    if(response.getResponseCode()!==200)throw Error(feed.show+':HTTP_'+response.getResponseCode());
    const channel=XmlService.parse(response.getContentText()).getRootElement().getChild('channel');
    if(!channel)throw Error('CHANNEL_MISSING');
    const channelLink=String(channel.getChildText('link')||'').trim();
    for(const item of channel.getChildren('item')){
      const pubDate=String(item.getChildText('pubDate')||'');
      const ms=Date.parse(pubDate);
      if(!Number.isFinite(ms)||ms<since||ms>Date.now())continue;
      const directLink=String(item.getChildText('link')||'').trim();
      const guid=String(item.getChildText('guid')||'').trim();
      const audio=String(item.getChild('enclosure')?.getAttribute('url')?.getValue()||'').trim();
      const atomLinks=item.getChildren('link',nsAtom).map(x=>({
        rel:x.getAttribute('rel')?.getValue()||'',
        href:x.getAttribute('href')?.getValue()||''
      }));
      const itunesEpisode=String(item.getChildText('episode',nsItunes)||'');
      const itemFields=item.getChildren().map(x=>x.getName()).filter((v,i,a)=>a.indexOf(v)===i);
      const report={
        show:feed.show,title:item.getChildText('title')||'',guid,
        published:new Date(ms).toISOString(),
        audioPresent:!!audio,
        directLink:directLink||null,
        channelLink:channelLink||null,
        atomLinks,
        itunesEpisode:itunesEpisode||null,
        itemFields,
        result:directLink?'DIRECT_LINK_PRESENT':'NO_EPISODE_LINK_IN_RSS'
      };
      records.push(report);
      console.log('MEGAPHONE_ITEM '+JSON.stringify(report));
    }
  }
  const summary={mode:'COPY_READ_ONLY',feeds:feeds.length,items:records.length,
    directLinks:records.filter(x=>x.directLink).length,
    noEpisodeLinks:records.filter(x=>!x.directLink).length,
    audioPresent:records.filter(x=>x.audioPresent).length,
    writes:0,triggerChanges:0};
  console.log('MEGAPHONE_SUMMARY '+JSON.stringify(summary));
  return summary;
}
