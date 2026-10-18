/** Phase 6: inspect the fast Omny API metadata before replacing RSS.
 * READ ONLY. Does not read/write Sheets or Properties and installs no triggers.
 */
function runOmnyFastMetadataProbe() {
  const org='1e3bd144-9b57-451a-93cf-ac0e00e74446';
  const playlist='684015f9-2396-4ac4-bc1f-ac0f0033d08c';
  const base='https://api.omny.fm/orgs/'+org+'/playlists/'+playlist;
  const results=[];
  for (const endpoint of [
    {name:'LEGACY_5',url:base+'/clips?pageSize=5'},
    {name:'V2_5',url:base+'/clips/v2?pageSize=5'}
  ]) {
    const t=Date.now();
    try {
      const response=UrlFetchApp.fetch(endpoint.url,{muteHttpExceptions:true,followRedirects:true});
      const status=response.getResponseCode();
      const record={endpoint:endpoint.name,httpStatus:status,elapsedMs:Date.now()-t};
      if(status!==200){record.status='HTTP_ERROR';results.push(record);Logger.log(JSON.stringify(record));continue;}
      const body=JSON.parse(response.getContentText());
      const clips=body.Clips||body.clips||body.Items||body.items||[];
      record.rootKeys=Object.keys(body).slice(0,25);
      record.count=clips.length;
      record.totalCount=body.TotalCount??body.totalCount??null;
      record.cursorAvailable=Boolean(body.Cursor||body.cursor||body.NextCursor||body.nextCursor);
      record.clips=clips.slice(0,2).map(c=>{
        const id=c.Id||c.id||'';
        const title=c.Title||c.title||'';
        const published=c.PublishedUtc||c.publishedUtc||c.PublishedAt||c.publishedAt||'';
        const description=c.Description||c.description||'';
        const media=c.MediaUrls||c.mediaUrls||{};
        const audio=c.AudioUrl||c.audioUrl||media.AudioUrl||media.audioUrl||'';
        const link=c.PublicUrl||c.publicUrl||c.WebsiteUrl||c.websiteUrl||'';
        return {
          id,title,published,keys:Object.keys(c).slice(0,65),
          descriptionType:typeof description,descriptionLength:String(description).length,
          descriptionPreview:String(description).slice(0,180),
          audioPresent:!!audio,audioHttps:typeof audio==='string'&&audio.startsWith('https://'),
          mediaKeys:Object.keys(media).slice(0,15),linkPresent:!!link,
          imagePresent:!!(c.ImageUrl||c.imageUrl),
          containsSpeakersField:Object.keys(c).filter(k=>/cast|speaker|author|presenter/i.test(k))
        };
      });
      record.status='OK';results.push(record);Logger.log(JSON.stringify(record));
    }catch(e){
      const record={endpoint:endpoint.name,status:'ERROR',error:String(e).slice(0,250),elapsedMs:Date.now()-t};
      results.push(record);Logger.log(JSON.stringify(record));
    }
  }
  const report={mode:'READ_ONLY_FAST_METADATA',writes:0,propertyWrites:0,triggerChanges:0,results};
  Logger.log(JSON.stringify(report));return report;
}
