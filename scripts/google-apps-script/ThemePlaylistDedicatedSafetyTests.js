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
    row('theme-a', 'excluded', '手動除外'),
    row('theme-a', 'pending', '要確認'),
    row('theme-a', 'added', '自動採用', '2026-09-21'),
    row('theme-a', 'approved', '手動採用'),
    row('theme-a', 'approved', '手動採用')
  ];
  const sheet = {};
  const originalRead = readThemeReviewRows_;
  try {
    readThemeReviewRows_ = function(actualSheet) {
      if (actualSheet !== sheet) throw new Error('Unexpected sheet');
      return rows;
    };
    const pending = getThemePlaylistPendingRows_(rule, sheet);
    if (pending.length !== 1 || pending[0].row[1] !== 'approved' || pending[0].rowNumber !== 6) {
      throw new Error('Only one unadded, approved, same-rule episode should be selected');
    }
    return { passed: 1, productionWrites: 0 };
  } finally {
    readThemeReviewRows_ = originalRead;
  }
}
