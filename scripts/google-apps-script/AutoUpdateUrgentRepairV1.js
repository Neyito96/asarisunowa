function runAutoUpdateUrgentRepairV1() {
  const fixed =
    syncDailyManagedAutoPlaylistsV1_();

  let speakerLatest = {
    skipped: true,
    reason: "handler-missing"
  };

  if (
    typeof syncBootstrapSpeakerLatestFastLaneV1_ ===
    "function"
  ) {
    speakerLatest =
      syncBootstrapSpeakerLatestFastLaneV1_();
  }

  const result = {
    fixed: fixed,
    speakerLatest:
      speakerLatest,
    historicalBackfillRun:
      false
  };

  Logger.log(
    JSON.stringify({
      urgentAutoUpdateRepair:
        result
    })
  );

  return result;
}