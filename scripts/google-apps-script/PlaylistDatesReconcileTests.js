// Run only in an isolated Apps Script test project; all Spotify and sheet operations are mocked.
function testPlaylistDateReconcileWithMocks_() {
  const originalFetch = getAllSpotifyPlaylistItems_;
  const originalWriter = updatePlaylistLatestDate_;
  const writes = [];
  let fetchCount = 0;
  function check(condition, message) {
    if (!condition) throw new Error(message);
  }
  try {
    getAllSpotifyPlaylistItems_ = function(id, token) {
      check(id === "EXACT123" && token === "MOCK_TOKEN", "unexpected Spotify request");
      fetchCount++;
      return [
        {item: {release_date: "2023-01-26"}},
        {item: {release_date: "2026-09-21"}},
        {item: {release_date: "2026-09-13"}}
      ];
    };
    updatePlaylistLatestDate_ = function(id, date) {
      writes.push({id: id, date: date});
      return true;
    };
    check(reconcilePlaylistLatestDateFromSpotify_("EXACT123", "MOCK_TOKEN") === true,
      "reconciliation should use fetched episodes");
    check(fetchCount === 1, "fetch exactly once");
    check(writes.length === 1 && writes[0].id === "EXACT123" && writes[0].date === "2026-09-21",
      "write only the maximum real episode release date");
    check(reconcilePlaylistLatestDateFromSpotify_("EXACT123", "MOCK_TOKEN", []) === false,
      "empty playlist must preserve existing date");
    check(fetchCount === 1 && writes.length === 1, "provided empty items must not fetch or write");
    let rejected = false;
    try { reconcilePlaylistLatestDateFromSpotify_("INVALID/ID", "MOCK_TOKEN"); }
    catch (error) { rejected = /プレイリストIDが不正/.test(String(error)); }
    check(rejected && fetchCount === 1 && writes.length === 1, "invalid ID must fail before I/O");
    rejected = false;
    try { reconcilePlaylistLatestDateFromSpotify_("EXACT123", ""); }
    catch (error) { rejected = /認証トークン/.test(String(error)); }
    check(rejected && fetchCount === 1 && writes.length === 1, "missing token must fail before I/O");
    rejected = false;
    try { reconcilePlaylistLatestDateFromSpotify_("EXACT123", "MOCK_TOKEN", {}); }
    catch (error) { rejected = /取得結果が不正/.test(String(error)); }
    check(rejected && fetchCount === 1 && writes.length === 1, "invalid response must not write");
    getAllSpotifyPlaylistItems_ = function() { throw new Error("mock Spotify failure"); };
    rejected = false;
    try { reconcilePlaylistLatestDateFromSpotify_("EXACT123", "MOCK_TOKEN"); }
    catch (error) { rejected = /mock Spotify failure/.test(String(error)); }
    check(rejected && writes.length === 1, "Spotify failure must not write");
    Logger.log("PASS: playlist date reconciliation mock tests (9 checks)");
  } finally {
    getAllSpotifyPlaylistItems_ = originalFetch;
    updatePlaylistLatestDate_ = originalWriter;
  }
}
