// SC4-15: 既存「概要欄清掃ロボ」プロジェクトに新規 .gs ファイルとして追加。
// 既存コードは変更しない。V2/COPYとも読み取り専用。実行関数: 概要欄_6_安全差分点検
function 概要欄_6_安全差分点検() {
  var c = scOpen_(SC_CONFIG.copyId, SC_CONFIG.copyNameIncludes);
  var result = c.ss.getSheetByName(SC_RESULT_);
  if (!result || result.getLastRow() < 2) throw new Error('清掃・結果がありません');
  var H = {}; SC_HEADERS_.forEach(function (x, i) { H[x] = i; });
  var rows = result.getRange(2, 1, result.getLastRow() - 1, SC_HEADERS_.length).getDisplayValues();
  var byEp = {}; rows.forEach(function (r) { byEp[r[H['EP-ID']]] = r; });
  var plan = scApply_(SC_CONFIG.v2WorkingId, '', SC_CONFIG.v2ApplyLevel,
    'V2作業用', 0, null, scV2NotPassedScope_(), true);
  if (plan.status !== 'DRYRUN') throw new Error('差分取得失敗: ' + plan.status);
  var blocked = { 'EP-04543': '応募告知残存' };
  var urlEpisodes = { 'EP-06726': 1, 'EP-06727': 1, 'EP-06731': 1 };
  var ok = [], hold = [], reasons = {};
  (plan.writes || []).forEach(function (w) {
    var r = byEp[w.ep], why = '';
    if (!r) why = 'RESULT_MISSING';
    else if (blocked[w.ep]) why = blocked[w.ep];
    else if (urlEpisodes[w.ep] && w.col === '出演者') why = '出演者URL要確認';
    else if (w.col === '出演者' && (/https?:/.test(w.newV) || /bit[.]ly|t[.]co/.test(w.newV))) why = '出演者URL混入';
    else if (/UNACCOUNTED_LINE|MANUAL_EDIT_PROTECTED|不合格|要確認/.test(String(r[H['理由']]) + ' ' + r[H['判定']])) why = '品質判定要確認';
    else if (/^[=+]/.test(w.newV)) why = '数式風文字列';
    if (why) { hold.push({ ep: w.ep, col: w.col, reason: why }); reasons[why] = (reasons[why] || 0) + 1; }
    else ok.push({ ep: w.ep, col: w.col });
  });
  var distinct = function (a) { return Object.keys(a.reduce(function (m, w) { m[w.ep] = true; return m; }, {})).length; };
  var output = {
    status: 'READ_ONLY', v2Writes: 0, plannedCells: (plan.writes || []).length,
    safeCandidateCells: ok.length, safeCandidateEpisodes: distinct(ok),
    heldCells: hold.length, heldEpisodes: distinct(hold), holdReasons: reasons,
    holds: hold, sampleSafe: ok.slice(0, 30),
    note: '安全候補は自動承認ではない。既存の概要欄_4はまだ実行しない。収録日補完は別監査。'
  };
  Logger.log(JSON.stringify(output, null, 2));
  return output;
}
