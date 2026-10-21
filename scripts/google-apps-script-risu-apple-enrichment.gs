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
  runBudgetMs: 240000,
  appleIntervalMs: 3100,
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
  const normalizeFeed = PodcastPlatformEvidence.publicUrl;
  const started=Date.now();let lastAppleAt=0,rateLimited=false;
  const memo={};
  const requestApple=url=>{
    if(rateLimited)throw Error('APPLE_HTTP_429');
    if(memo[url])return memo[url];
    const pause=Math.max(0,cfg.appleIntervalMs-(Date.now()-lastAppleAt));
    if(Date.now()-started+pause>=cfg.runBudgetMs)throw Error('RUN_DEFERRED');
    if(pause)Utilities.sleep(pause);
    lastAppleAt=Date.now();
    const res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
    if(res.getResponseCode()===429){rateLimited=true;throw Error('APPLE_HTTP_429');}
    if(res.getResponseCode()!==200)throw Error('APPLE_HTTP_'+res.getResponseCode());
    return memo[url]=JSON.parse(res.getContentText());
  };
  const progress=apply?PropertiesService.getScriptProperties():null;
  const saved=progress?Number(progress.getProperty('RISU_ENRICH_NEXT_ROW')||2)-1:1;
  const startIndex=saved>=1&&saved<data.length?saved:1;
  const order=Array.from({length:Math.max(0,data.length-1)},(_,n)=>1+(startIndex-1+n)%(data.length-1));
  let nextIndex=startIndex;
  const log={mode:apply?'APPLY':'PREVIEW',startedAt:new Date(started).toISOString(),activeRows:0,inspected:0,matched:0,unmatched:0,ambiguous:0,withoutRss:0,requestsFailed:0,deferred:0,excluded:0,writes:0,verifiedCells:[],proposals:[]};
  const lock=LockService.getScriptLock();
  if(apply && !lock.tryLock(10000)) throw Error('同時実行のため中止');
  try {
    for(const i of order){
      const row=data[i], title=String(row[cols.title]||'').trim();
      if(!title) continue;
      const statusIndex=h.indexOf('巡回状態');
      if(statusIndex>=0 && /^(除外|無効|停止|inactive|excluded)$/i.test(String(row[statusIndex]||'').trim())){log.excluded++;continue;}

      log.activeRows++;
      const needs=[cols.rss,cols.apple,cols.genre,cols.art,cols.host,cols.youtube,cols.spotify,cols.amazon,cols.pocketcasts,cols.listen,cols.standfm,cols.pody,cols.website].some(j=>!String(row[j]||'').trim());
      if(!needs) continue;
      log.inspected++;
      const feed=normalizeFeed(row[cols.rss]);
      const source=PodcastPlatformEvidence.classifyPlatformUrl(row[0]);
      if(!feed && !(source.provider==='apple' && source.level==='programme')){log.withoutRss++;continue;}
      if(Date.now()-started>=cfg.runBudgetMs || rateLimited){log.deferred++;continue;}
      const result=resolvePodcastPlatformsByEvidence_(title,String(row[0]||''),String(row[cols.rss]||''),requestApple);
      nextIndex=i===data.length-1?1:i+1;
      const rssLinks=result.resolved;
      const m={collectionViewUrl:rssLinks.apple,primaryGenreName:rssLinks.genre,artworkUrl600:rssLinks.artwork,artistName:rssLinks.host};
      if(result.evidence.state==='DEFERRED'){log.deferred++;continue;}
      if(result.evidence.state==='MATCH')log.matched++;
      else if(result.evidence.state==='FAILED')log.requestsFailed++;
      else if(result.evidence.reason==='MULTIPLE_CANDIDATES')log.ambiguous++;
      else log.unmatched++;
      const candidates=[
        [cols.rss,rssLinks.rss||''],
        [cols.apple,String(m.collectionViewUrl||'')],
        [cols.genre,String(m.primaryGenreName||'')],
        [cols.art,String(m.artworkUrl600||m.artworkUrl100||'')],
        [cols.host,String(m.artistName||'')],
        [cols.youtube,rssLinks.youtube||''],[cols.spotify,rssLinks.spotify||''],
        [cols.amazon,rssLinks.amazon||''],[cols.pocketcasts,rssLinks.pocketcasts||''],
        [cols.listen,rssLinks.listen||''],[cols.standfm,rssLinks.standfm||''],
        [cols.pody,rssLinks.pody||''],[cols.website,rssLinks.website||'']
      ].filter(([j,v])=>v && !/^=/.test(v.trimStart()) && !String(row[j]||'').trim());
      const proposal={row:i+1,title,state:result.evidence.state,reason:result.evidence.reason,fields:candidates.map(([j])=>h[j])};
      log.proposals.push(proposal);
      if(!apply)continue;
      // 書き込み直前に番組・RSS・対象セルを再検証。
      const current=sh.getRange(i+1,1,1,h.length).getValues()[0];
      if(String(current[cols.title]||'').trim()!==title ||
         normalizeFeed(current[cols.rss])!==feed || String(current[0]||'')!==String(row[0]||''))throw Error('ROW_CONFLICT row '+(i+1));
      for(const [j] of candidates){const cell=sh.getRange(i+1,j+1);if(cell.getFormula()||String(cell.getValue()||'').trim())throw Error('CELL_CONFLICT row '+(i+1)+' col '+(j+1));}
      for(const [j,v] of candidates){
        const cell=sh.getRange(i+1,j+1);
        if(cell.getFormula() || String(cell.getValue()||'').trim())throw Error('CELL_CONFLICT row '+(i+1)+' col '+(j+1));
        console.log('RISU_CELL_ATTEMPT '+JSON.stringify({row:i+1,column:j+1}));
        cell.setValue(v);
        if(String(cell.getValue())!==v)throw Error('READBACK_FAILED row '+(i+1)+' col '+(j+1));
        log.writes++;log.verifiedCells.push({row:i+1,column:j+1});

      }
    }
    if(progress)progress.setProperty('RISU_ENRICH_NEXT_ROW',String(nextIndex+1));
    log.nextRow=nextIndex+1;
    log.finishedAt=new Date().toISOString();
    console.log('RISU_APPLE_ENRICH '+JSON.stringify(log));
    return log;
  } catch(error) {log.failedAt=new Date().toISOString();console.log('RISU_ENRICH_FAILED '+JSON.stringify(log));throw error;} finally {if(apply)lock.releaseLock();}
}

/** Daily trigger, dedicated to リス推し. Call only after preview validation. */
function RISU_installDailyEnrichment() {
  const handler='RISU_applyAllPlatforms';
  const all=ScriptApp.getProjectTriggers();
  if(all.some(t=>/^(RISU_applyAppleEnrichment|syncRecommendedPodcastPlatforms|syncAllPodcastPlatforms)$/.test(t.getHandlerFunction())))throw Error('旧巡回と競合します。実トリガーの確認が必要です');
  const existing=all.filter(t=>t.getHandlerFunction()===handler);
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
  return PodcastPlatformEvidence.confirmedProgrammeLinks(readPodcastFeedLinks_(feedUrl)).links;
}
