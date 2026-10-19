/**
 * V3 audio patrol: preparation stage, intentionally READ ONLY.
 * Does NOT create triggers, set properties, or write sheets.
 * A full Omny RSS fetch can take 1-3 minutes: never schedule every 5 minutes.
 * Run manually after the single-cell copy pilot succeeds.
 */
function previewLibraryV3AudioPatrolReady(){
  const c=libV3Context_(false);
  const shows=['ニュースの現場から','MEDIA TALK','こどもそうだんしつ'];
  const feedStatus=shows.map(show=>({
    show,configuredFeeds:c.feeds.filter(f=>f.show===show).length
  }));
  const out={
    mode:'READ_ONLY_V3_AUDIO_PATROL_PREP',
    status:feedStatus.every(x=>x.configuredFeeds===1)?'CONFIG_READY_NOT_RUNNING':'FEED_CONFIG_HOLD',
    shows:feedStatus,
    strategy:'RSS snapshot -> GUID unique match -> metadata/exclusion checks -> blank-only audio URL',
    suggestedCadence:'daily, not every 5 minutes',
    safeguards:['single running instance lock','skip existing URL','formula guard',
      'source and target identity check','title/date check','exclusion hold',
      'write cap per run','stop on 429/503','checkpoint only after approved design',
      'idempotency','error alert'],
    copyOnly:true,
    writes:0,propertyWrites:0,triggersInstalled:0,spotifyPosts:0,
    autoWriteEnabled:false,
    productionChanges:false
  };
  Logger.log(JSON.stringify(out));return out;
}
/** One full read-only patrol. Intentionally no write, no trigger. */
function previewLibraryV3AudioPatrolOnce(){
  return previewLibraryV3ExistingAudioSafety();
}
