/** Phase 6 Megaphone RSS discovery: READ ONLY; no sheets, properties or triggers.
 * First verified discovery: Hou-Dan feed listed by public podcast directory.
 * Add additional exact feed URLs to TARGETS only after verifying their provenance.
 */
function runMegaphoneFeedProbe() {
  const TARGETS=[
    {show:'報談',url:'https://feeds.megaphone.fm/TASC9421488254'}
  ];
  const output={mode:'READ_ONLY_MEGAPHONE_FEED',writes:0,propertyWrites:0,triggerChanges:0,results:[]};
  const ns={itunes:XmlService.getNamespace('itunes','http://www.itunes.com/dtds/podcast-1.0.dtd')};
  const value=(node,name)=>node.getChildText(name)||'';
  const textAny=(node,name)=>{const child=node.getChildren().find(e=>e.getName()===name);return child?child.getText():'';};
  for(const target of TARGETS){
    const start=Date.now(),rec={show:target.show,feedUrl:target.url};
    try{
      const res=UrlFetchApp.fetch(target.url,{method:'get',muteHttpExceptions:true,followRedirects:true,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
      rec.httpStatus=res.getResponseCode();rec.elapsedMs=Date.now()-start;
      if(rec.httpStatus!==200){rec.status='HTTP_ERROR';output.results.push(rec);continue;}
      const body=res.getContentText();
      rec.bodyChars=body.length;
      const doc=XmlService.parse(body);
      const root=doc.getRootElement(),channel=root.getChild('channel');
      if(!channel)throw Error('RSS channel missing');
      rec.channelTitle=value(channel,'title');
      rec.channelLink=value(channel,'link');
      const items=channel.getChildren('item');
      rec.itemCount=items.length;
      rec.samples=items.slice(0,3).map(it=>{
        const enclosure=it.getChild('enclosure');
        const attrs=enclosure?{url:enclosure.getAttribute('url')?.getValue()||'',type:enclosure.getAttribute('type')?.getValue()||''}:{url:'',type:''};
        const description=value(it,'description');
        const contentTags=it.getChildren().filter(e=>/video|content|transcript/i.test(e.getName())).map(e=>({name:e.getName(),namespace:e.getNamespace().getURI()})).slice(0,8);
        return {guid:value(it,'guid'),title:value(it,'title'),pubDate:value(it,'pubDate'),link:value(it,'link'),
          descriptionChars:description.length,descriptionPreview:description.slice(0,120),
          enclosureType:attrs.type,enclosureHost:attrs.url?attrs.url.match(/^https?:\\/\\/([^/]+)/)?.[1]||'':'',
          enclosureHttps:attrs.url.startsWith('https://'),videoOrTranscriptTags:contentTags};
      });
      rec.status='OK';
    }catch(e){rec.status='ERROR';rec.error=String(e).slice(0,300);rec.elapsedMs=Date.now()-start;}
    output.results.push(rec);Logger.log(JSON.stringify(rec));
  }
  Logger.log(JSON.stringify(output));return output;
}
