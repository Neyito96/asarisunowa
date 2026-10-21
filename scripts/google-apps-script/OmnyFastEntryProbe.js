/** 朝リスの田 Phase 6: Omny軽量入口の独立診断。読み取り専用、書込・トリガーなし。 */
function runOmnyFastEntryProbe() {
  const org = '1e3bd144-9b57-451a-93cf-ac0e00e74446';
  const playlist = '684015f9-2396-4ac4-bc1f-ac0f0033d08c';
  const rss = 'https://www.omnycontent.com/d/playlist/' + org + '/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/' + playlist + '/podcast.rss';
  const api = 'https://api.omny.fm/orgs/' + org + '/playlists/' + playlist;
  const targets = [
    {name:'CONSUMER_V2_5',url:api+'/clips/v2?pageSize=5'},
    {name:'CONSUMER_LEGACY_5',url:api+'/clips?pageSize=5'},
    {name:'RSS_HEAD',url:rss,head:true}
  ];
  const out = {mode:'READ_ONLY_OMNY_ENTRY_PROBE',writes:0,results:[]};
  for (const target of targets) {
    const t = Date.now();
    try {
      const resp = UrlFetchApp.fetch(target.url, {
        method:target.head?'head':'get',muteHttpExceptions:true,
        followRedirects:true,validateHttpsCertificates:true
      });
      const status=resp.getResponseCode(),h=resp.getAllHeaders();
      const rec={name:target.name,status,ms:Date.now()-t,
        etag:h.ETag||h.Etag||h.etag||'',
        lastModified:h['Last-Modified']||h['last-modified']||'',
        contentLength:h['Content-Length']||h['content-length']||'',
        contentType:h['Content-Type']||h['content-type']||''};
      if (!target.head && status===200) {
        try {
          const body=JSON.parse(resp.getContentText());
          const clips=body.Clips||body.clips||[];
          rec.clips=clips.length;
          rec.totalCount=body.TotalCount??body.totalCount??null;
          rec.hasCursor=Boolean(body.Cursor||body.cursor);
          rec.sample=clips.slice(0,2).map(c=>({id:c.Id||c.id,title:c.Title||c.title,
            published:c.PublishedUtc||c.publishedUtc||'',audio:!!(c.AudioUrl||c.audioUrl||c.MediaUrls?.AudioUrl)}));
        } catch(e) {rec.parseError=String(e).slice(0,120);}
      }
      out.results.push(rec);Logger.log(JSON.stringify(rec));
    } catch(e) {
      const rec={name:target.name,error:String(e).slice(0,250),ms:Date.now()-t};
      out.results.push(rec);Logger.log(JSON.stringify(rec));
    }
  }
  Logger.log(JSON.stringify(out));return out;
}
