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
