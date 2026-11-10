// COPY GAS専用の入口(提案・未導入)。P26Bundle.gs(生成物)と一緒に COPY の Apps Script へ置く。本番GAS・本番Spreadsheetへは配置禁止。
// 書込先は COPY Sheet の P26_ 専用タブのみ。Spotify・Drive共有・メール・トリガー操作・台帳タブへの書込は含まない(静的検査: tests/copy-gas-bundle.test.mjs)。
// 実行は手動のみ。承認記録(Script Property P26_APPROVAL)が無い/期限切れ/範囲外/回数超過なら STOP。
const P26_COPY_SCRIPT_ID_ = '16qdHt_nojvKK4Qzcww4C7jkg6frpLiYIHXn4CG-_UtILn4qKlmoixT9R';
const P26_COPY_SHEET_ID_ = '1lbfEq3Tdj6QaLGJOWZfez-xNkQ5yRHRILqmP1nLJtQw';
const P26_LEDGER_TAB_ = 'エピソード台帳';
const P26_TABS_ = {journal: 'P26_JOURNAL', registry: 'P26_REGISTRY', feeds: 'P26_FEEDS', config: 'P26_PLAYLIST_CONFIG', snapshot: 'P26_PLAYLIST_SNAPSHOT', candidates: 'P26_PLAYLIST_DRYRUN', report: 'P26_REPORT'};
const P26_LIMITS_ = {maxCommitRunsPerFunction: 1, maxFeeds: 10, maxFeedBytes: 20 * 1024 * 1024, maxRegistryRows: 3000, maxConfigRows: 50, maxCandidateRows: 200, maxJournalRows: 100, maxLedgerRowsRead: 20000, recentDays: 14};
const P26_FEED_HOSTS_ = ['www.omnycontent.com', 'api.omny.fm', 'omny.fm'];

function p26AssertCopyAndApproved_(fnName) {
  if (ScriptApp.getScriptId() !== P26_COPY_SCRIPT_ID_) throw new Error('STOP:NOT_COPY_SCRIPT');
  const ss = SpreadsheetApp.openById(P26_COPY_SHEET_ID_);
  if (ss.getId() !== P26_COPY_SHEET_ID_) throw new Error('STOP:NOT_COPY_SHEET');
  const raw = PropertiesService.getScriptProperties().getProperty('P26_APPROVAL');
  if (!raw) throw new Error('STOP:NO_APPROVAL_RECORD');
  let a; try { a = JSON.parse(raw); } catch (e) { throw new Error('STOP:APPROVAL_UNREADABLE'); }
  if (!a.approvedBy || !a.approvedAt || !a.expiresOn || !Array.isArray(a.scope)) throw new Error('STOP:APPROVAL_INCOMPLETE');
  if (new Date(a.expiresOn + 'T23:59:59+09:00').getTime() < Date.now()) throw new Error('STOP:APPROVAL_EXPIRED');
  if (a.scope.indexOf(fnName) < 0) throw new Error('STOP:OUT_OF_SCOPE');
  return ss;
}
// 承認後にだけ実行する記録関数(承認内容そのものをScript Propertyへ保存するだけ)。
function P26_recordApproval(jsonText) {
  if (ScriptApp.getScriptId() !== P26_COPY_SCRIPT_ID_) throw new Error('STOP:NOT_COPY_SCRIPT');
  const a = JSON.parse(jsonText);
  if (!a.approvedBy || !a.approvedAt || !a.expiresOn || !Array.isArray(a.scope)) throw new Error('STOP:APPROVAL_INCOMPLETE');
  PropertiesService.getScriptProperties().setProperty('P26_APPROVAL', JSON.stringify({approvedBy: a.approvedBy, approvedAt: a.approvedAt, expiresOn: a.expiresOn, scope: a.scope}));
  return {recorded: true, scope: a.scope, expiresOn: a.expiresOn};
}
function p26Tab_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, headers.length).setValues([headers]); }
  return sh;
}
// 追記専用ジャーナル(P26_JOURNAL)。rows()=全行を読み、append=末尾に1行、withLock=ScriptLock(5秒)。原子性はLockService依存(実機未検証)。
function p26SheetStore_(ss) {
  const H = ['seq', 'type', 'owner', 'token', 'expiresAt', 'at', 'runId', 'version', 'payloadHash'];
  const sh = p26Tab_(ss, P26_TABS_.journal, H);
  return {
    rows: function () { const n = sh.getLastRow(); if (n < 2) return []; return sh.getRange(2, 1, n - 1, H.length).getValues().map(function (r) { const o = {}; H.forEach(function (h, i) { if (r[i] !== '') o[h] = r[i]; }); return o; }); },
    append: function (row) {
      if (sh.getLastRow() >= P26_LIMITS_.maxJournalRows) throw new Error('STOP:JOURNAL_ROW_LIMIT');
      sh.appendRow(H.map(function (h) { return row[h] === undefined ? '' : row[h]; }).map(function (v, i) { return i === 0 ? sh.getLastRow() : v; }));
    },
    withLock: function (fn) { const lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return undefined; try { return fn(); } finally { lock.releaseLock(); } }
  };
}
function p26CountCommits_(store, owner) { return store.rows().filter(function (r) { return r.type === 'COMMIT' && r.owner === owner; }).length; }
function p26FetchFeeds_(ss) {
  const sh = ss.getSheetByName(P26_TABS_.feeds); if (!sh || sh.getLastRow() < 2) throw new Error('STOP:NO_FEEDS_CONFIGURED');
  const rows = sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, P26_LIMITS_.maxFeeds), 3).getValues().filter(function (r) { return r[0] && r[1]; });
  return rows.map(function (r) {
    const feedKey = String(r[0]), url = String(r[1]), expectedShow = String(r[2] || '') || null;
    const m = /^https:\/\/([^\/]+)\//.exec(url);
    if (!m || P26_FEED_HOSTS_.indexOf(m[1]) < 0) return {feedKey: feedKey, expectedShow: expectedShow, http: null, error: 'HOST_NOT_ALLOWED'};
    try { const res = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: false}); const body = res.getContentText(); if (body.length > P26_LIMITS_.maxFeedBytes) return {feedKey: feedKey, expectedShow: expectedShow, http: res.getResponseCode(), error: 'FEED_TOO_LARGE'}; return {feedKey: feedKey, expectedShow: expectedShow, http: res.getResponseCode(), xml: body}; }
    catch (e) { return {feedKey: feedKey, expectedShow: expectedShow, http: null, error: 'FETCH_FAILED'}; }
  });
}
function p26LedgerRows_(ss) { // COPYの台帳タブを読むだけ(getValuesのみ)。
  const sh = ss.getSheetByName(P26_LEDGER_TAB_); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, P26_LIMITS_.maxLedgerRowsRead), 55).getValues();
}
function p26LedgerIndex_(rows) { const m = new Map(); rows.forEach(function (r) { const g = String(r[6] || ''), id = String(r[0] || ''); if (g && /^EP-\d{5,}$/.test(id)) { if (!m.has(g)) m.set(g, []); m.get(g).push(id); } }); return m; }
function p26LoadRegistry_(ss) {
  const sh = ss.getSheetByName(P26_TABS_.registry); const episodes = [];
  if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, P26_LIMITS_.maxRegistryRows), 2).getValues().forEach(function (r) { if (r[1]) episodes.push(JSON.parse(r[1])); });
  return {episodes: episodes};
}
function p26SaveRegistry_(ss, registry) { // 公開RSS由来の項目のみ。説明文は保存しない。上限超過は書かずに停止。
  if (registry.episodes.length > P26_LIMITS_.maxRegistryRows) throw new Error('STOP:REGISTRY_ROW_LIMIT');
  const sh = p26Tab_(ss, P26_TABS_.registry, ['idx', 'episodeJson']);
  const body = registry.episodes.map(function (e, i) { const c = {}; Object.keys(e).forEach(function (k) { if (k !== 'description') c[k] = e[k]; }); return [i + 1, JSON.stringify(c)]; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
  if (body.length) sh.getRange(2, 1, body.length, 2).setValues(body);
}
function p26Report_(ss, obj) { const sh = p26Tab_(ss, P26_TABS_.report, ['at', 'function', 'summaryJson']); sh.appendRow([new Date().toISOString(), obj.fn, JSON.stringify(obj.summary)]); }

// ① 公式RSS読取専用 → 厳格解析 → GUID照合 → TMP仮ID(EP-ID非採番) → ジャーナル最大1 run → COMMIT → 読み戻し → 同一runId再実行で追加0
function P25DailyReadOnly() {
  const ss = p26AssertCopyAndApproved_('P25DailyReadOnly');
  const store = p26SheetStore_(ss);
  if (p26CountCommits_(store, 'P25DailyReadOnly') >= P26_LIMITS_.maxCommitRunsPerFunction) throw new Error('STOP:MAX_RUNS_REACHED');
  const feeds = p26FetchFeeds_(ss), ledger = p26LedgerRows_(ss), ledgerIndex = p26LedgerIndex_(ledger);
  const runId = 'P25RO-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss'), state = {registry: p26LoadRegistry_(ss)};
  const nowMs = Date.now(), out = {fn: 'P25DailyReadOnly', summary: {runId: runId, done: false}};
  const persist = function (next) { p26SaveRegistry_(ss, next.registry); };
  const p = M_daily_pipeline.runDailyDay({state: state, feeds: feeds, ledgerIndex: ledgerIndex, resolvers: {}, store: store, owner: 'P25DailyReadOnly', runId: runId, nowMs: nowMs, persist: persist}).then(function (r) {
    const reg = p26LoadRegistry_(ss), journal = store.rows();
    const readbackOk = r.status !== 'NOT_COMMITTED' && journal.some(function (x) { return x.type === 'COMMIT' && x.runId === runId; }) && reg.episodes.length === r.state.registry.episodes.length;
    return M_daily_pipeline.runDailyDay({state: {registry: reg}, feeds: feeds, ledgerIndex: ledgerIndex, resolvers: {}, store: store, owner: 'P25DailyReadOnly', runId: runId, nowMs: Date.now(), persist: function () { throw new Error('STOP:SAME_RUN_MUST_NOT_PERSIST'); }}).then(function (again) {
      const after = p26LoadRegistry_(ss).episodes.length;
      out.summary = {runId: runId, done: true, status: r.status, fetched: r.run.fetched, added: r.run.added, total: r.run.total, quarantined: (r.run.quarantined || []).length, tmpIds: reg.episodes.filter(function (e) { return /^TMP-/.test(e.id); }).length,
        epIdsMinted: 0, readbackOk: readbackOk, sameRunRerun: again.status, sameRunRerunAdded: again.run.added, registryRowsAfterRerun: after, anomalies: r.run.anomalies || []};
      p26Report_(ss, out); return out.summary;
    });
  });
  p.catch(function (e) { out.summary = {runId: runId, done: false, error: String(e && e.message ? e.message : e)}; p26Report_(ss, out); });
  return out.summary;
}

// ② 共通プレイリスト設定表(P26_PLAYLIST_CONFIG)から DRY_RUN 候補を生成。Spotifyへは書かない・読まない。スナップショット(P26_PLAYLIST_SNAPSHOT)が無いリストは「照合結果のみ」。
function P26PlaylistConfigDryRun() {
  const ss = p26AssertCopyAndApproved_('P26PlaylistConfigDryRun');
  const store = p26SheetStore_(ss);
  if (p26CountCommits_(store, 'P26PlaylistConfigDryRun') >= P26_LIMITS_.maxCommitRunsPerFunction) throw new Error('STOP:MAX_RUNS_REACHED');
  const cfgSh = ss.getSheetByName(P26_TABS_.config); if (!cfgSh || cfgSh.getLastRow() < 2) throw new Error('STOP:NO_CONFIG');
  const cfgRows = cfgSh.getRange(1, 1, Math.min(cfgSh.getLastRow(), P26_LIMITS_.maxConfigRows + 1), 17).getValues().map(function (r) { return r.map(String); });
  const parsed = M_playlist_config.parseConfig(cfgRows, {strategies: {}, primaryShowIds: []});
  const snapSh = ss.getSheetByName(P26_TABS_.snapshot), snap = {};
  if (snapSh && snapSh.getLastRow() >= 2) snapSh.getRange(2, 1, snapSh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0] && r[1]) (snap[String(r[0])] = snap[String(r[0])] || []).push(String(r[1])); });
  const cutoff = Date.now() - P26_LIMITS_.recentDays * 86400e3, queue = M_playlist_engine.newQueue();
  p26LedgerRows_(ss).forEach(function (r) {
    const sid = M_playlist_router.spotifyEpisodeId(r[11]), dm = /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?: (\d{1,2}):(\d{2}))?/.exec(String(r[3])), t = Object.prototype.toString.call(r[3]) === '[object Date]' ? r[3].getTime() : dm ? Date.parse(dm[1] + '-' + ('0' + dm[2]).slice(-2) + '-' + ('0' + dm[3]).slice(-2) + 'T' + ('0' + (dm[4] || '0')).slice(-2) + ':' + (dm[5] || '00') + ':00+09:00') : NaN;
    if (!sid || !(t >= cutoff)) return;
    M_playlist_engine.enqueue(queue, {episode: {id: sid, uri: 'spotify:episode:' + sid, name: String(r[2]), description: String(r[21]), html_description: String(r[21]), release_date: new Date(t).toISOString().slice(0, 10)}, origin: 'rss', at: Date.now()}); // showIdは未設定=番組範囲は評価しない(COPYでは照合のみ)
  });
  const spotify = {listPage: function (pl) { if (!snap[pl]) throw new Error('NO_SNAPSHOT'); return Promise.resolve({items: snap[pl], next: null}); }, addItems: function () { throw new Error('NO_SPOTIFY_WRITE_IN_COPY'); }};
  const runId = 'P26PL-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss'), items = Object.keys(queue.items).map(function (k) { return queue.items[k]; });
  const out = {fn: 'P26PlaylistConfigDryRun', summary: {runId: runId, done: false}};
  const p = M_playlist_engine.runEngine({rules: parsed.rules.filter(function (r) { return !r.blocked.length && r.enabled; }), queue: queue, spotify: spotify, state: {}, store: store, owner: 'P26PlaylistConfigDryRun', runId: runId, now: Date.now(), globalMode: 'DRY_RUN', sweep: true}).then(function (r) {
    const rows = [], matched = {};
    parsed.rules.forEach(function (rule) { if (rule.blocked.length || !rule.enabled) return; matched[rule.key] = items.filter(function (i) { return M_playlist_engine.matchEpisode(i.episode, rule, {}); }).length; });
    (r.results || []).forEach(function (x) { (x.candidates || []).forEach(function (u) { rows.push([runId, x.key, u, 'DRY_RUN_CANDIDATE']); }); (x.skipped || []).forEach(function (s) { rows.push([runId, x.key, s.uri, s.reason]); }); if (x.status === 'ERROR') rows.push([runId, x.key, '', x.reason]); });
    const sh = p26Tab_(ss, P26_TABS_.candidates, ['runId', 'ruleKey', 'episodeUri', 'status']); if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
    const cap = rows.slice(0, P26_LIMITS_.maxCandidateRows); if (cap.length) sh.getRange(2, 1, cap.length, 4).setValues(cap);
    out.summary = {runId: runId, done: true, status: r.status, rulesTotal: parsed.rules.length, rulesBlocked: parsed.errors.length, blockedReasons: parsed.errors.map(function (e) { return e.key + ':' + e.reasons.join('+'); }), episodesInWindow: items.length, matchedPerRule: matched,
      candidateRows: cap.length, truncated: rows.length > cap.length, snapshotsAvailable: Object.keys(snap).length, spotifyWrites: 0, note: 'スナップショットの無いリストは照合結果のみ(追加候補の確定にはSpotify読取が必要)'};
    p26Report_(ss, out); return out.summary;
  });
  p.catch(function (e) { out.summary = {runId: runId, done: false, error: String(e && e.message ? e.message : e)}; p26Report_(ss, out); });
  return out.summary;
}
// 実行結果の確認専用(読取のみ)。async完了が実機で想定通りか(マイクロタスク排出)を別実行で確認する。
function P26Verify() {
  const ss = SpreadsheetApp.openById(P26_COPY_SHEET_ID_); if (ScriptApp.getScriptId() !== P26_COPY_SCRIPT_ID_) throw new Error('STOP:NOT_COPY_SCRIPT');
  const j = ss.getSheetByName(P26_TABS_.journal), rep = ss.getSheetByName(P26_TABS_.report), reg = ss.getSheetByName(P26_TABS_.registry);
  return {journalRows: j ? j.getLastRow() - 1 : 0, registryRows: reg ? reg.getLastRow() - 1 : 0, reportRows: rep ? rep.getLastRow() - 1 : 0, lastReport: rep && rep.getLastRow() > 1 ? rep.getRange(rep.getLastRow(), 1, 1, 3).getValues()[0] : null};
}
