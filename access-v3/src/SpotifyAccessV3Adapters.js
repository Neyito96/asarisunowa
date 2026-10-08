// Domain adapter boundary for Spotify Access V3.
// Phase 1 registers only the existing Nordic theme. Unknown playlist domains fail closed.
function sp3NordicAdapter_() {
  return {
    key:'NORDIC',
    getRule:function(){ return sp3NordicRule_(); },
    isOwned:function(rule){ return !!rule && spotifyThemeOwnedV3_(rule.playlistId); },
    getState:function(){ return sp3Prop_('NORDIC',{}); },
    saveState:function(state){ sp3Save_('NORDIC',state); },
    scan:function(rule){
      const pair=themePairV2_(rule,false);
      return {pair:pair,queue:themeRowsByIdV2_(pair.queue,rule),history:themeRowsByIdV2_(pair.history,rule)};
    },
    decision:function(q,h){ return themeDecisionV2_(q&&q.row,h&&h.row); },
    readDecision:function(rule,id){
      const scan=this.scan(rule),q=scan.queue[id],h=scan.history[id];
      return {pair:scan.pair,q:q,h:h,decision:this.decision(q,h)};
    },
    classifyEpisode:function(ep,rule){ return classifyThemeEpisodeV2_(ep,rule); },
    buildRow:function(rule,ep,result){ return themeRowV2_(rule,ep,result); },
    appendQueue:function(scan,row){ return {row:row,index:themeAppendRowV2_(scan.pair.queue,row)}; },
    ensureHistory:function(d){
      if(d.h)return d.h;
      if(!d.q)throw new Error('SP3_CANDIDATE_MISSING');
      const row=d.q.row.slice();
      d.h={row:row,index:themeAppendRowV2_(d.pair.history,row)};
      return d.h;
    },
    patchReceipt:function(d,target,patch){
      const item=target==='history'?d.h:d.q;
      if(item)sp3ReceiptPatch_(target==='history'?d.pair.history:d.pair.queue,item,patch);
    }
  };
}

function sp3AdapterForPlaylist_(playlistId) {
  if(playlistId===SP3_.nordic)return sp3NordicAdapter_();
  if(typeof sp3AdditionalAdapterForPlaylist_==='function'){
    const adapter=sp3AdditionalAdapterForPlaylist_(playlistId);
    if(adapter)return adapter;
  }
  return null;
}
function sp3RequireAdapterForPlaylist_(playlistId) {
  const adapter=sp3AdapterForPlaylist_(playlistId);
  if(!adapter)throw new Error('SP3_DOMAIN_ADAPTER_MISSING:'+String(playlistId||''));
  return adapter;
}
function sp3RequireAdapterForJob_(job) {
  const playlistId=job&&job.payload&&job.payload.playlistId;
  if(!playlistId)throw new Error('SP3_JOB_PLAYLIST_MISSING');
  return sp3RequireAdapterForPlaylist_(playlistId);
}
