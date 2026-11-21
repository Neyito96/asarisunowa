// COPY-only ownership experiment. Does not replace/install production handlers.
// io must use ONE shared lock/store for every route in the same project.
function p25CopyRouteOwner_(route) {
  if (route === "P25_RUN_COPY") return "P25";
  if (["runAutoUpdateAutomationV1", "runAutoUpdateBackfillHourlyV1",
    "syncKinoDougaPlaylist", "syncIsshoShinbunPlaylist", "syncToyohidePlaylist",
    "runThemeV3Automation", "manual"].indexOf(route) >= 0) return "LEGACY";
  throw new Error("UNKNOWN_COPY_ROUTE");
}

// Real GAS lock probe, COPY-only. Invoke from TWO independent executions to test
// contention. No Spotify, property, sheet, or trigger mutations. The caller must
// provide the same isolated config used by P25_RUN_COPY. Logs/results contain no token.
function P25_COPY_LOCK_PROBE(config, holdMs) {
  if (!Number.isInteger(holdMs) || holdMs < 0 || holdMs > 10000) throw new Error("INVALID_HOLD_MS");
  const io = p25CopyIo_(config); // validates Script ID + COPY sheet schema
  return io.withLock(function() {
    const startedAt = Date.now();
    if (holdMs) Utilities.sleep(holdMs);
    return {mode:"COPY_GAS_LOCK_PROBE",status:"ACQUIRED",startedAt:startedAt,endedAt:Date.now()};
  });
}
function p25CopyOwnershipDispatch_(io, route, playlistId, work) {
  if (io.environment !== "COPY" || !io.allowed(playlistId)) throw new Error("COPY_TARGET_REQUIRED");
  const expected = p25CopyRouteOwner_(route);
  return io.withLock(function() {
    const owner = io.readOwner(playlistId);
    if (!owner || owner.owner !== expected || !Number.isSafeInteger(owner.generation) || owner.generation < 1)
      return {status:"HOLD", reason:"OWNER_MISMATCH"};
    const generation = owner.generation;
    let active = true;
    // Do not expose a raw writer to work. Recheck ownership before EACH mutation.
    const guardedWrite = function(payload) {
      if (!active) throw new Error("LOCK_SCOPE_ENDED");
      const current = io.readOwner(playlistId);
      if (!current || current.owner !== expected || current.generation !== generation)
        throw new Error("OWNER_CHANGED");
      return io.write(playlistId, payload);
    };
    try { return work(guardedWrite); } finally { active = false; }
  });
}

// Runs offline in Node OR manually in a COPY GAS editor. No Google/Spotify I/O.
// The lock is simulated: this is NOT proof of real GAS concurrency or legacy coverage.
function P25_COPY_OWNERSHIP_SELF_TEST() {
  const id = "COPY_FIXTURE_ONLY", records = {}, writes = [];
  let locked = false, checks = 0;
  const io = {
    environment:"COPY", allowed:function(p){return p===id;},
    readOwner:function(p){return records[p];},
    withLock:function(fn){if(locked)return {status:"BUSY"};locked=true;try{return fn();}finally{locked=false;}},
    write:function(p,v){writes.push([p,v]);}
  };
  function check(ok){if(!ok)throw new Error("OWNERSHIP_SELF_TEST_FAILED_"+checks);checks++;}
  function dispatch(route, fn){return p25CopyOwnershipDispatch_(io,route,id,fn||function(w){w("fixture");return {status:"DONE"};});}
  const legacy=["runAutoUpdateAutomationV1","runAutoUpdateBackfillHourlyV1","syncKinoDougaPlaylist","syncIsshoShinbunPlaylist","syncToyohidePlaylist","runThemeV3Automation","manual"];
  records[id]={owner:"P25",generation:1};
  legacy.forEach(function(route){check(dispatch(route).status==="HOLD");});
  check(writes.length===0);
  dispatch("P25_RUN_COPY",function(w){check(dispatch(legacy[0]).status==="BUSY");w("one");});
  check(writes.length===1);
  records[id]={owner:"PAUSED",generation:2};
  legacy.concat(["P25_RUN_COPY"]).forEach(function(route){check(dispatch(route).status==="HOLD");});
  records[id]={owner:"LEGACY",generation:3};
  check(dispatch("P25_RUN_COPY").status==="HOLD");
  legacy.forEach(function(route){check(dispatch(route).status==="DONE");});
  let escaped, caught=false;
  dispatch(legacy[0],function(w){escaped=w;});
  try{escaped("late");}catch(e){caught=e.message==="LOCK_SCOPE_ENDED";}check(caught);
  caught=false;
  try{dispatch(legacy[0],function(w){records[id]={owner:"LEGACY",generation:4};w("stale");});}
  catch(e){caught=e.message==="OWNER_CHANGED";}check(caught);
  check(!locked);
  delete records[id];check(dispatch(legacy[0]).status==="HOLD");
  return {mode:"MOCK_NO_EXTERNAL_IO",checks:checks,writesSimulated:writes.length};
}
