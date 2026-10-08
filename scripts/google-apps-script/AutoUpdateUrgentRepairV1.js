// Emergency catch-up entry point for auto playlists.
// Intended for one explicit admin run after deploying the repair.
// It does NOT run historical bootstrap. It only:
// 1) syncs recent fixed-rule episodes and reconciles their latest dates;
// 2) syncs recent confirmed speaker episodes for runtime rules still bootstrapping.

function runAutoUpdateUrgentRepairV1() {
  const fixed = syncDailyManagedAutoPlaylistsV1_();

  let speakerLatest = { skipped: true, reason: "handler-missing" };
  if (typeof syncBootstrapSpeakerLatestFastLaneV1_ === "function") {
    speakerLatest = syncBootstrapSpeakerLatestFastLaneV1_();
  }

  const result = {
    fixed: fixed,
    speakerLatest: speakerLatest,
    historicalBackfillRun: false
  };

  Logger.log(JSON.stringify({ urgentAutoUpdateRepair: result }));
  return result;
}
