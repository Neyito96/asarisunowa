/**
 * リス推し: 全配信先・Apple情報の空欄補完（独立GASモジュール）
 * 手動: RISU_previewAppleEnrichment() -> RISU_applyAppleEnrichment()
 * プレビュー確認後に RISU_installDailyEnrichment() で専用トリガーを登録。
 * Appleの検索結果は RSS feedUrl 完全一致の場合だけ採用。
 * 同名タイトルのみの一致は採用しない。既存値は上書きしない。
 */
const RISU_ENRICH_CONFIG = Object.freeze({
  spreadsheetId: '1KSzoIkOsjUagNBLt3IbKIvgWEmez4f0XISQ-jkUjmwQ',
  sheetName: 'おすすめPodcast',
  maxRows: 100,
  maxResults: 25,
  timeoutMs: 12000
});

function RISU_previewAppleEnrichment() { return RISU_enrichApple_(false); }
function RISU_previewAllPlatforms() { return RISU_enrichApple_(false); }
function RISU_applyAppleEnrichment() { return RISU_enrichApple_(true); }
function RISU_applyAllPlatforms() { return RISU_enrichApple_(true); }

function RISU_enrichApple_(apply) {
  const cfg = RISU_ENRICH_CONFIG;
  const sh = SpreadsheetApp.openById(cfg.spreadsheetId).getSheetByName(cfg.sheetName);
  if (!sh) throw Error('おすすめPodcastシートがありません');
  const data = sh.getDataRange().getValues();
  const h = data[0].map(x => String(x || '').trim());
  const ix = name => { const i=h.indexOf(name); if(i<0) throw Error('列がありません: '+name); return i; };
  const cols = {
    title:ix('番組名'),rss:ix('RSS'),apple:ix('Apple Podcasts'),
    youtube:ix('YouTube'),spotify:ix('Spotify'),amazon:ix('Amazon Music'),
    pocketcasts:ix('Pocket Casts'),listen:ix('LISTEN'),standfm:ix('stand.fm'),
    pody:ix('Pody'),website:ix('番組HP'),
    genre:ix('ジャンル'),art:ix('アートワーク'),host:ix('配信者 / Host')
  };
  const normalizeFeed = value => {
    try {
      const u=new URL(String(value||'').trim());
      return (u.protocol+'//'+u.hostname.toLowerCase()+u.pathname.replace(/\/$/,'')).toLowerCase();
    } catch (_) { return ''; }
  };
  const log={mode:apply?'APPLY':'PREVIEW',inspected:0,matched:0,unmatched:0,ambiguous:0,withoutRss:0,requestsFailed:0,writes:0,proposals:[]};
  const lock=LockService.getScriptLock();
  if(apply && !lock.tryLock(10000)) throw Error('同時実行のため中止');
  try {
    for(let i=1;i<data.length && log.inspected<cfg.maxRows;i++){
      const row=data[i], title=String(row[cols.title]||'').trim();
      if(!title) continue;
      const needs=[cols.apple,cols.genre,cols.art,cols.host,cols.youtube,cols.spotify,cols.amazon,cols.pocketcasts,cols.listen,cols.standfm,cols.pody,cols.website].some(j=>!String(row[j]||'').trim());
      if(!needs) continue;
      log.inspected++;
      const feed=normalizeFeed(row[cols.rss]);
      if(!feed){log.withoutRss++;continue;}
      const rssLinks=RISU_discoverRssPlatformLinks_(String(row[cols.rss]||''));
      let items;
      try{
        const url='https://itunes.apple.com/search?media=podcast&entity=podcast&country=JP&limit='+cfg.maxResults+'&term='+encodeURIComponent(title);
        const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
        if(res.getResponseCode()!==200)throw Error('HTTP '+res.getResponseCode());
        items=JSON.parse(res.getContentText()).results||[];
      }catch(e){log.requestsFailed++;items=[];console.log('RISU_APPLE_ERROR '+JSON.stringify({row:i+1,error:String(e)}));}
      const matches=items.filter(x=>normalizeFeed(x.feedUrl)===feed);
      if(matches.length===0)log.unmatched++;
      if(matches.length>1)log.ambiguous++;
      const m=matches.length===1?matches[0]:{};
      if(matches.length===1)log.matched++;
      const candidates=[
        [cols.apple,String(m.collectionViewUrl||'')],
        [cols.genre,String(m.primaryGenreName||'')],
        [cols.art,String(m.artworkUrl600||m.artworkUrl100||'')],
        [cols.host,String(m.artistName||'')],
        [cols.youtube,rssLinks.youtube||''],[cols.spotify,rssLinks.spotify||''],
        [cols.amazon,rssLinks.amazon||''],[cols.pocketcasts,rssLinks.pocketcasts||''],
        [cols.listen,rssLinks.listen||''],[cols.standfm,rssLinks.standfm||''],
        [cols.pody,rssLinks.pody||''],[cols.website,rssLinks.website||'']
      ].filter(([j,v])=>v && !String(row[j]||'').trim());
      const proposal={row:i+1,title,appleId:m.collectionId,fields:candidates.map(([j])=>h[j])};
      log.proposals.push(proposal);
      if(!apply)continue;
      // 書き込み直前に番組・RSS・対象セルを再検証。
      const current=sh.getRange(i+1,1,1,h.length).getValues()[0];
      if(String(current[cols.title]||'').trim()!==title ||
         normalizeFeed(current[cols.rss])!==feed)continue;
      for(const [j,v] of candidates){
        if(!String(sh.getRange(i+1,j+1).getValue()||'').trim()){
          sh.getRange(i+1,j+1).setValue(v);
          log.writes++;
        }
      }
    }
    console.log('RISU_APPLE_ENRICH '+JSON.stringify(log));
    return log;
  } finally {if(apply)lock.releaseLock();}
}

/** Daily trigger, dedicated to リス推し. Call only after preview validation. */
function RISU_installDailyEnrichment() {
  const handler='RISU_applyAllPlatforms';
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler);
  if(existing.length>1) throw Error('同名トリガーが複数あります。手動確認してください');
  if(!existing.length) ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(4).create();
  const result={mode:'RISU_DAILY_INSTALLED',handler,triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===handler).length};
  console.log(JSON.stringify(result));return result;
}
function RISU_stopDailyEnrichment() {
  const handler='RISU_applyAllPlatforms';
  let deleted=0;
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(t.getHandlerFunction()===handler){ScriptApp.deleteTrigger(t);deleted++;}
  });
  console.log('RISU_DAILY_STOP '+JSON.stringify({deleted}));
}

/**
 * Extract only explicit links in RSS CHANNEL metadata (never episode/item text).
 * No guessed search results or invented show URLs. Conflicting URLs are held.
 * This intentionally leaves platforms blank when the publisher gives no proof.
 */
function RISU_discoverRssPlatformLinks_(feedUrl) {
  const result={};
  try {
    const res=UrlFetchApp.fetch(feedUrl,{muteHttpExceptions:true,followRedirects:true});
    if(res.getResponseCode()!==200)return result;
    const xml=res.getContentText();
    const channel=xml.split(/<item(?:\s|>)/i)[0].slice(0,100000);
    const candidates=[];
    const matches=channel.match(/https?:\/\/[^\s"'<>]+/gi)||[];
    for(const raw of matches) {
      const clean=raw.replace(/&amp;/g,'&').replace(/[),.;]+$/,'');
      try { const u=new URL(clean); if(u.protocol==='https:')candidates.push(u.href); }catch(e){}
    }
    const domains={
      youtube:/(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
      spotify:/(^|\.)open\.spotify\.com$/,
      amazon:/(^|\.)music\.amazon\.[a-z.]+$/,
      pocketcasts:/(^|\.)pca\.st$|(^|\.)pocketcasts\.com$/,
      listen:/(^|\.)listen\.style$/,
      standfm:/(^|\.)stand\.fm$/,
      pody:/(^|\.)pody\.jp$/
    };
    for(const [key,domain] of Object.entries(domains)){
      const found=[...new Set(candidates.filter(url=>{
        const u=new URL(url);
        if(!domain.test(u.hostname))return false;
        if(key==='spotify')return /^\/show\//.test(u.pathname);
        if(key==='youtube')return /^\/(channel|@|playlist)/.test(u.pathname);
        if(key==='amazon')return /\/podcasts\//.test(u.pathname);
        if(key==='listen')return /\/(p|podcast)\//.test(u.pathname);
        if(key==='standfm')return /^\/channels\//.test(u.pathname);
        return true;
      }).map(url=>url.split('?')[0]))];
      if(found.length===1)result[key]=found[0];
    }
    // Do not infer the podcast homepage from episode links.
  } catch(e) { console.log('RISU_RSS_DISCOVERY_ERROR '+String(e)); }
  return result;
}
