// Run manually in Apps Script test environment. No Spotify or Sheet writes.
function testPlaylistDateSafety_() {
  function assertEquals(actual, expected, label) {
    if (actual !== expected) throw new Error(label + ": expected " + expected + ", got " + actual);
  }
  assertEquals(normalizePlaylistReleaseDate_("2026-09-21"), "2026-09-21", "ISO date");
  assertEquals(normalizePlaylistReleaseDate_("2026/09/13"), "2026-09-13", "sheet slash date");
  assertEquals(normalizePlaylistReleaseDate_("2026/9/3"), "2026-09-03", "sheet non-padded slash date");
  assertEquals(normalizePlaylistReleaseDate_("2026-02-30"), "", "invalid calendar date");
  assertEquals(normalizePlaylistReleaseDate_("2026/02/30"), "", "invalid slash calendar date");
  assertEquals(normalizePlaylistReleaseDate_(""), "", "missing date");
  assertEquals(normalizePlaylistReleaseDate_("2026-09-21garbage"), "", "reject trailing garbage");
  assertEquals(maxPlaylistReleaseDate_("2026-09-21", "2023-01-26"), "2026-09-21", "backfill must not regress");
  assertEquals(maxPlaylistReleaseDate_("2026/09/21", "2023-01-26"), "2026-09-21", "localized existing date must not regress");
  assertEquals(maxPlaylistReleaseDate_("2026-09-13", "2026-09-21"), "2026-09-21", "new episode advances");
  assertEquals(maxPlaylistReleaseDate_("2026-09-13", ""), "2026-09-13", "failed fetch preserves date");
  assertEquals(latestPlaylistReleaseDateFromItems_([
    {item:{release_date:"2026-09-13"}},
    {item:{release_date:"2026-09-21"}},
    {item:{release_date:"2023-01-26"}}
  ]), "2026-09-21", "maximum episode date");
  assertEquals(latestPlaylistReleaseDateFromItems_([]), "", "empty playlist has no invented date");
  assertEquals(latestPlaylistReleaseDateFromItems_([{item:null}, {}, {item:{release_date:"invalid"}}]), "", "missing and invalid episode dates");
  assertEquals(maxPlaylistReleaseDate_("2026-09-21", "2026-02-30"), "2026-09-21", "invalid candidate preserves date");
  Logger.log("PASS: playlist date safety (15 assertions)");
}
