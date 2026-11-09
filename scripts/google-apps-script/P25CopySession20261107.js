// Isolated session configuration. Never include credentials in this file.
function p25CopySessionConfig20261107_() {
  return {
    environment:"COPY",
    copyScriptId:"16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R",
    stateSheetId:"1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw",
    requestSheetId:"1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw",
    ledgerSheetId:"1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4",
    copyPlaylistIds:[], // Populate only after a NEW dedicated test playlist is verified.
    officialFeedUrls:[], // Unconfigured = SOURCE_UNKNOWN, never a successful source audit.
    // Rule-level auto-add for the COPY test playlist: null = off. Set {since:"YYYY-MM-DD",revision:<from P25_COPY_PREVIEW>,shows:["番組名"]} only after approval.
    autoAdd:null,
    // The dedicated test playlist's NAME must start with this marker (checked before any membership read or add).
    playlistNamePrefix:"[P25-COPY]",
    write:false,legacyWriterDisabled:false,maxAdditions:1,maxPlaylists:1
  };
}
function P25_COPY_PREFLIGHT_20261107() {
  const config=p25CopySessionConfig20261107_();
  const io=p25CopyIo_(config); // READ ONLY: identity + journal header validation
  const result={mode:"COPY_PREFLIGHT",isolation:"PASS",requests:io.readRequests().length,
    playlistConfigured:config.copyPlaylistIds.length===1,feedsConfigured:config.officialFeedUrls.length>0,
    spotifyWrite:false};
  console.log(JSON.stringify(result));return result;
}
function P25_COPY_READ_ONLY_20261107() {
  const config=p25CopySessionConfig20261107_();
  if(config.copyPlaylistIds.length!==1 || !config.officialFeedUrls.length)throw new Error("COPY_SETUP_INCOMPLETE");
  const result=P25_RUN_COPY(config);
  console.log(JSON.stringify(result));return result;
}
function P25_COPY_MOCK_OWNERSHIP_20261107() {
  const result=P25_COPY_OWNERSHIP_SELF_TEST();console.log(JSON.stringify(result));return result;
}
function P25_COPY_LOCK_HOLDER_20261107() {
  const result=P25_COPY_LOCK_PROBE(p25CopySessionConfig20261107_(),10000);console.log(JSON.stringify(result));return result;
}
function P25_COPY_LOCK_CONTENDER_20261107() {
  const result=P25_COPY_LOCK_PROBE(p25CopySessionConfig20261107_(),0);console.log(JSON.stringify(result));return result;
}
// Read-only trials. Edit only the arguments, never the session config's write switch.
function P25_COPY_SEARCH_20261107() {
  const result=P25_SEARCH_COPY(p25CopySessionConfig20261107_(),{type:"series",keywords:"（検索語を入れる）",show:""});
  console.log(JSON.stringify(result));return result;
}
function P25_COPY_VERIFY_IDS_20261107() {
  // Edit only the EP-ID list. One GET /episodes/{id} per episode (the batch endpoint was removed by Spotify).
  const result=P25_VERIFY_IDS_COPY(p25CopySessionConfig20261107_(),["EP-06678"]);
  console.log(JSON.stringify(result));return result;
}
function P25_COPY_PREVIEW_20261107() {
  const config=p25CopySessionConfig20261107_();
  if(config.copyPlaylistIds.length!==1)throw new Error("COPY_SETUP_INCOMPLETE");
  const result=P25_PREVIEW_COPY(config,config.copyPlaylistIds[0]);
  console.log(JSON.stringify(result));return result;
}
// The ONLY COPY write entry: at most one episode into the single [P25-COPY] test playlist.
// Refuses to run unless an administrator has switched the config's write flag on, confirmed the legacy writer is off, and set one playlist.
function P25_COPY_ONE_ADD_20261107() {
  const config=p25CopySessionConfig20261107_();
  if(config.write!==true || config.legacyWriterDisabled!==true || config.maxAdditions!==1 || config.copyPlaylistIds.length!==1)throw new Error("COPY_ONE_ADD_NOT_ARMED");
  const result=P25_RUN_COPY(config);
  console.log(JSON.stringify(result));return result;
}

// Read-only token summary (booleans and times only). Calls Spotify's token endpoint only when the stored token is about to expire.
function P25_COPY_TOKEN_CHECK_20261110() {
  const config=p25CopySessionConfig20261107_();
  p25CopyTokGet_(config);
  const result=p25CopyTokStatus_(config);
  console.log(JSON.stringify(result));return result;
}
