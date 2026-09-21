// Run manually in Apps Script test environment. No Spotify or Sheet writes.
function testPlaylistDateSafety_() {
  function assertEquals(actual, expected, label) {
    if (actual !== expected) throw new Error(label + ": expected " + expected + ", got " + actual);
  }
  assertEquals(normalizePlaylistReleaseDate_("2026-09-21"), "2026-09-21", "ISO date");
  assertEquals(normalizePlaylistReleaseDate_("2026-02-30"), "", "invalid calendar date");
  assertEquals(normalizePlaylistReleaseDate_(""), "", "missing date");
  assertEquals(maxPlaylistReleaseDate_("2026-09-21", "2023-01-26"), "2026-09-21", "backfill must not regress");
  assertEquals(maxPlaylistReleaseDate_("2026-09-13", "2026-09-21"), "2026-09-21", "new episode advances");
  assertEquals(maxPlaylistReleaseDate_("2026-09-13", ""), "2026-09-13", "failed fetch preserves date");
  assertEquals(latestPlaylistReleaseDateFromItems_([
    {item:{release_date:"2026-09-13"}},
    {item:{release_date:"2026-09-21"}},
    {item:{release_date:"2023-01-26"}}
  ]), "2026-09-21", "maximum episode date");
  Logger.log("PASS: playlist date safety (7 assertions)");
}
