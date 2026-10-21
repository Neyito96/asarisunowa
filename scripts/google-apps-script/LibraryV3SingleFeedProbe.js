/**
 * Phase 6: bounded, single-feed diagnostic. No writes or triggers.
 * Add as a separate .gs file in the isolated GAS project.
 * Reports timing per stage so slow RSS vs. slow spreadsheet reads are distinguishable.
 */
function runLibraryV3SingleFeedProbe() {
  const copySheetId = '1EgS5KSn8kiQUM1avaeB09aLy-NWZ0azMYnxX1g_0t_8';
  const start = Date.now();
  const report = {mode:'READ_ONLY_SINGLE_FEED', copySheetId, writes:0, stages:[]};
  const step = (name, fn) => {
    const t = Date.now();
    Logger.log(JSON.stringify({stage:name,status:'START',elapsedMs:t-start}));
    const value = fn();
    report.stages.push({name,ms:Date.now()-t});
    Logger.log(JSON.stringify({stage:name,status:'DONE',stageMs:Date.now()-t,elapsedMs:Date.now()-start}));
    return value;
  };
  try {
    const source = step('SOURCE_SHEET_READ', () => libV3Context_(false));
    const feed = source.feeds.find(f => f.show === 'ニュースの現場から');
    if (!feed) throw Error('Official feed not registered');
    report.show = feed.show;
    report.feedUrl = feed.url;
    report.sourceRows = source.rows.length;
    const baseline = JSON.parse(PropertiesService.getScriptProperties().getProperty('LIB_V3_BASELINE')||'{}');
    if (!baseline.complete || baseline.offset !== source.rows.length) throw Error('Source baseline mismatch');
    if (Date.now()-start > 70000) {report.status='TIME_BUDGET_AFTER_SOURCE';return report;}
    const copy = step('COPY_SHEET_READ', () => libV3Context_(true,{
      copySheetId,feedUrl:feed.url,guid:'00000000-0000-4000-8000-000000000001'
    }));
    report.copyRows = copy.rows.length;
    if (libV3Hash_(source.rows) !== libV3Hash_(copy.rows)) throw Error('Copy diverged from production; no writes');
    if (Date.now()-start > 95000) {report.status='TIME_BUDGET_AFTER_COPY';return report;}
    const metrics={cacheHits:0};
    const snap = step('OFFICIAL_RSS_FETCH_PARSE', () => libV2CpSnapshot_(
      feed.url,false,{},metrics,{prefix:'LV3PILOT_READONLY',chunkSize:22000,parse:t=>libV2CpParse_(t,true)}
    ));
    if(snap.status){report.status=snap.status;return report;}
    report.fetchedItems=snap.items.length;
    const count=new Map();
    snap.items.forEach(it=>count.set(it.guid,(count.get(it.guid)||0)+1));
    const holds={};let selected=null;
    for(const it of snap.items){
      const reasons=[];
      if(!it.guid||count.get(it.guid)!==1)reasons.push('missing_or_duplicate_guid');
      if(!Number.isFinite(Date.parse(it.published))||Date.parse(it.published)>Date.now()+60000)reasons.push('invalid_date');
      if(typeof libV3AutoCleanEvidence_==='function'&&libV3AutoCleanEvidence_(it.description||'').hold)reasons.push('description_review');
      if(!reasons.length){
        const cfg={allowNew:true,newAfter:new Date(Date.parse(it.published)-1).toISOString()};
        reasons.push(...libV3NewDecision_(it,feed,source,cfg,baseline).reasons);
        reasons.push(...libV3NewDecision_(it,feed,copy,cfg,baseline).reasons);
      }
      if(!reasons.length && libV2CpMatches_(it.guid,source.index.guid,source.index.anchor).length)reasons.push('source_identity_exists');
      if(!reasons.length && libV2CpMatches_(it.guid,copy.index.guid,copy.index.anchor).length)reasons.push('copy_identity_exists');
      if(reasons.length){reasons.forEach(k=>holds[k]=(holds[k]||0)+1);continue;}
      selected={guid:it.guid,title:it.title,published:it.published,feedUrl:feed.url};break;
    }
    report.holds=holds;
    report.candidate=selected;
    report.status=selected?'CANDIDATE_FOUND':'NO_ELIGIBLE_CANDIDATE';
    return report;
  }catch(e){report.status='ERROR';report.error=String(e&&e.message||e).slice(0,300);return report;}
  finally{report.totalMs=Date.now()-start;Logger.log(JSON.stringify(report));}
}
