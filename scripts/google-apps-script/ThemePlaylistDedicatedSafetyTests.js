// Mock-only tests. No SpreadsheetApp, Spotify, triggers, or production writes.
// Run explicitly in the GAS test environment after deploying the code to a test project.
function testThemePlaylistPendingRowsSafety_() {
  const rule = { key: 'theme-a' };
  function row(key, id, decision, added) {
    const result = Array(12).fill('');
    result[0] = key;
    result[1] = id;
    result[8] = decision;
    result[10] = added || '';
    return result;
  }
  const rows = [
    row('theme-b', 'foreign', '手動採用'),
    row('theme-a', 'excluded', '採用'),
    row('theme-a', 'excluded', '手動除外'),
    row('theme-a', 'pending', '要確認'),
    row('theme-a', 'added', '自動採用', '2026-09-21'),
    row('theme-a', 'added', '手動採用'),
    row('theme-a', 'approved', '採用'),
    row('theme-a', 'approved', '手動採用'),
    row('theme-a', 'later-approved', '除外'),
    row('theme-a', 'later-approved', '手動採用')
  ];
  const sheet = {};
  const originalRead = readThemeReviewRows_;
  try {
    readThemeReviewRows_ = function(actualSheet) {
      if (actualSheet !== sheet) throw new Error('Unexpected sheet');
      return rows;
    };
    const pending = getThemePlaylistPendingRows_(rule, sheet);
    const ids = pending.map(function(item) { return item.row[1]; });
    if (ids.join() !== 'approved,later-approved') {
      throw new Error('Latest decision must win; added history, manual exclusion, pending and foreign rows must be skipped: ' + ids.join());
    }
    if (pending[0].rowNumber !== 9 || pending[1].rowNumber !== 11) {
      throw new Error('Latest row numbers must be retained for status writes');
    }
    return { passed: 2, productionWrites: 0 };
  } finally {
    readThemeReviewRows_ = originalRead;
  }
}
