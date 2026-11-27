// GAS 軽量版を作る（引っ越し準備・2026-11-27）。
// 本番の控え scripts/google-apps-script/ から、使っている宣言（関数・定数）だけを選び、役目ごとの少ないファイルに並べ直して gas/lite/ に書く。
// ・宣言の本文は1文字も変えない（選ぶ・並べるだけ）。同じ名前が同じファイルに2回あるときは、Apps Script と同じく後ろを残す。
// ・「使っている」= 入口（本番の時計・Webアプリ・手で押す運用の関数）から名前の呼び合いをたどって着くもの。
// ・今の本番には届けない（配達係は scripts/google-apps-script/ だけを届ける）。引っ越し先の新しいプロジェクトに入れる用。
// 使い方: node scripts/build-gas-lite.mjs        → gas/lite/ を作り直す
//         node scripts/build-gas-lite.mjs --check → 作り直した結果が gas/lite/ と同じか確かめる（違えば終了コード1）
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';

export const SRC = 'scripts/google-apps-script';
export const OUT = 'gas/lite';

// 入口: 本番の時計（2026-11-27 マイトリガー画面）＋ Webアプリ ＋ シート編集 ＋ コードが作る1回きりの時計
const TRIGGERS = ['doGet', 'doPost', 'onEdit', 'runAutoUpdateBackfillHourlyV1', 'runAutoUpdateAutomationV1',
  'syncKinoDougaPlaylist', 'syncIsshoShinbunPlaylist', 'syncToyohidePlaylist', 'syncListenerPodcastPlatforms',
  'runAutoUpdateAutomationSoonV1', 'runThemeReviewAutomation'];
// 入口: 人が手で押す運用の関数（スイッチ・時計の設置・認証・承認・復旧）。診断・試験・一回きりの関数は入れない
const MANUAL = ['installAutoUpdateAutomationDailyTriggerV1', 'installAutoUpdateBackfillHourlyTriggerV1', 'installAutoUpdateAutomationTriggersV1',
  'authorizeAutoUpdateAutomationV1', 'stopAutoUpdatePlaylistV1', 'humanDeleteAutoUpdatePlaylistV1', 'resumeAutoUpdatePlaylistV1',
  'sendAutoUpdateNotificationTestMail', 'AUTO_UPDATE_RECOVERY_DRY_RUN', 'AUTO_UPDATE_RECOVERY_WRITE',
  'LIBRARY_PLAYLIST_WRITE_ON', 'LIBRARY_PLAYLIST_WRITE_OFF', 'LIBRARY_PLAYLIST_RUN_NOW', 'LIBRARY_THEME_DRY_RUN',
  'approveSubmittedThemeReviewV1', 'approveSubmittedThemeReviewFromActiveCellV1', 'enableThemeReviewAutomation',
  'enableThemeReviewAutomationFlagOnly', 'disableThemeReviewAutomation',
  'syncAllAutoPlaylists', 'updatePlaylistLatestDates', 'PLAYLIST_LIVE_META_CHECK', 'PLAYLIST_COVER_REFRESH_POSUSUME',
  'PODCAST_PREVIEW_LOG', 'syncRecommendedPodcastPlatforms', 'syncAllPodcastPlatforms', 'resolvePodcastUrl', 'readPodcastSheet',
  'posuIntroMatch', 'posuApprovePlan', 'posuSubmit', 'posuApprove', 'posuIntroReport', 'posuSyncIntros',
  'SHELF_SPOTIFY_RUN_NOW', 'startSpotifyUserAuth', 'SPOTIFY_COOLDOWN_STATUS',
  'setupSpeakerHumanDecisionSheetV1', 'removeOneApprovedSpeakerEpisodeFromSpotifyV1', 'removeApprovedSpeakerEpisodesBatchV1'];
export const ROOTS = [...TRIGGERS, ...MANUAL];

// 役目ごとのまとめ方（元のファイル名 → 軽量版のファイル）。番号の順に読み込まれる
export const GROUPS = [
  ['01_入口とAPI', ['コード.js', 'ApiCommon.js', 'ApiReadHandler.js', 'SheetData.js', 'Bunrui.js', 'HttpFetch.js']],
  ['02_投稿の受付', ['PostInput.js', 'PostValidation.js', 'PostDuplicate.js', 'PostArtwork.js', 'PostSheets.js', 'PostWrite.js', 'PostSave.js', 'ShelfSubmit.js', 'Posukami.js']],
  ['03_Spotify', ['SpotifyCooldown.js', 'SpotifyBudgetV2.js', 'SpotifyAuth.js', 'Spotify.js']],
  ['04_自動更新の受付と通知', ['AutoUpdateRequest.js', 'AutoUpdateNotification.js', 'AutoUpdateAutomationV1.js', 'AutoUpdateRecovery.js']],
  ['05_自動プレイリスト', ['PlaylistAutoRules.js', 'PlaylistAutoRuleValidation.js', 'PlaylistAutoRequestRule.js', 'PlaylistAutoLifecycle.js', 'PlaylistAutoActivation.js',
    'PlaylistAutoScopedState.js', 'PlaylistAutoScopedStateStore.js', 'PlaylistAutoSheetLink.js', 'PlaylistAutoPageMatching.js', 'PlaylistAutoEpisodes.js',
    'PlaylistAutoSpotify.js', 'PlaylistAutoWrite.js', 'PlaylistAuto.js', 'PlaylistAutoDryRun.js', 'PlaylistAutoDryRunOtaAuditV2.js', 'PlaylistAutoV2DryRunEngine.js',
    'PlaylistAutoSatoYoLaunch.js', 'PlaylistAutoSatoYoIndividual.js']],
  ['06_出演者ルール', ['PlaylistAutoSpeakerGuardrail.js', 'PlaylistAutoSpeakerSato.js', 'PlaylistAutoSpeakerSaito.js', 'PlaylistAutoSpeakerTerashita.js', 'SpeakerHumanDecisionSheet.js']],
  ['07_テーマと蔵のプレイリスト', ['PlaylistAutoThemeReview.js', 'ThemeV3SingleSheet.js', 'LibraryTheme.js', 'LibraryPlaylist.js', 'ShelfSpotify.js']],
  ['08_プレイリストの情報', ['PlaylistJstDate.js', 'PlaylistDates.js', 'PlaylistLiveMeta.js', 'PlaylistResolve.js', 'PlaylistSpecial.js', 'Test.js']],
  ['09_ポッドキャストの情報', ['PodcastResolveCommon.js', 'PodcastIdentity.js', 'PodcastUrlResolve.js', 'PodcastApple.js', 'PodcastPody.js', 'PodcastResolve.js',
    'PodcastResolveHandler.js', 'PodcastSubmission.js', 'PodcastPlatformPipeline.js', 'PodcastPlatformSync.js']],
];

const DECL = /^(?:async\s+)?function\s+([^\s(]+)\s*\(|^(?:const|let|var)\s+([^\s=]+)\s*=/u;
const ID = /[A-Za-z_$぀-鿿][\w$぀-鿿]*/gu;
const NODE_EXPORT = /^if \(typeof module !== 'undefined'\) module\.exports = .*$/u;

// ファイルを「宣言の切れ目」で区切る。区切りの前（ファイル冒頭のコメント等）は捨てる。
// 行頭の function/const が関数の途中に書かれていることがある（貼り込みの跡など）ので、
// 切った断片が文として完結しない（構文エラーになる）間は、次の断片とつなげる。名前は先頭の宣言のもの。
export function splitDecls(file, text) {
  const L = text.split('\n'); const starts = [];
  L.forEach((l, i) => { const m = l.match(DECL); if (m) starts.push([i, m[1] || m[2]]); });
  const parses = (code) => { try { new vm.Script(code); return true; } catch (e) { return !(e instanceof SyntaxError) || /already been declared/.test(e.message); } };
  const out = []; let k = 0;
  while (k < starts.length) {
    const [i, name] = starts[k]; let j = k + 1;
    const slice = (to) => L.slice(i, to < starts.length ? starts[to][0] : L.length).filter((l) => !NODE_EXPORT.test(l));
    while (j < starts.length && !parses(slice(j).join('\n'))) j++;
    const lines = slice(j);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    out.push({ file, name, order: i, body: lines.join('\n') });
    k = j;
  }
  return out;
}

export function build(srcDir = SRC) {
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
  const grouped = new Set(GROUPS.flatMap(([, fs_]) => fs_));
  const missing = files.filter((f) => !grouped.has(f)); const extra = [...grouped].filter((f) => !files.includes(f));
  if (missing.length || extra.length) throw new Error('GROUPS と元のファイルが合わない: ' + JSON.stringify({ missing, extra }));
  const all = []; const byName = new Map();
  for (const f of files) for (const d of splitDecls(f, fs.readFileSync(path.join(srcDir, f), 'utf8'))) { all.push(d); if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(d); }
  // 同じ名前の宣言は、同じファイル内なら後ろだけが生きる（Apps Script と同じ）。別ファイルの重複は止める
  const live = new Map();
  for (const [n, ds] of byName) {
    const filesOf = new Set(ds.map((d) => d.file));
    if (filesOf.size > 1) live.set(n, { conflict: ds.map((d) => d.file) }); else live.set(n, ds[ds.length - 1]);
  }
  const reach = new Set(); const stack = ROOTS.filter((n) => live.has(n));
  const missingRoots = ROOTS.filter((n) => !live.has(n));
  while (stack.length) {
    const n = stack.pop(); if (reach.has(n)) continue; const d = live.get(n);
    if (d.conflict) throw new Error('使う名前が別々のファイルで二重に宣言されている: ' + n + ' ' + d.conflict.join(','));
    reach.add(n);
    for (const id of new Set(d.body.match(ID) || [])) if (live.has(id) && !reach.has(id)) stack.push(id);
  }
  const out = {}; const kept = [];
  GROUPS.forEach(([g, srcFiles]) => {
    const parts = [`// ${g}（朝リスの輪 GAS 軽量版・自動生成。直すときは scripts/google-apps-script/ を直して node scripts/build-gas-lite.mjs）`,
      `// もとのファイル: ${srcFiles.join(', ')}`];
    for (const f of srcFiles) {
      const ds = all.filter((d) => d.file === f && reach.has(d.name) && live.get(d.name) === d).sort((a, b) => a.order - b.order);
      if (!ds.length) continue;
      parts.push('', `// ---- ${f} ----`);
      for (const d of ds) { parts.push(d.body); kept.push(d); }
    }
    out[g + '.js'] = parts.join('\n') + '\n';
  });
  out['appsscript.json'] = fs.readFileSync(path.join(srcDir, 'appsscript.json'), 'utf8');
  const lines = (s) => s.split('\n').length;
  const stats = { srcFiles: files.length, srcLines: files.reduce((t, f) => t + lines(fs.readFileSync(path.join(srcDir, f), 'utf8')), 0),
    liteFiles: Object.keys(out).filter((k) => k.endsWith('.js')).length, liteLines: Object.entries(out).filter(([k]) => k.endsWith('.js')).reduce((t, [, s]) => t + lines(s), 0),
    decls: live.size, keptDecls: kept.length, missingRoots };
  return { out, kept, stats };
}

if (process.argv[1] && process.argv[1].endsWith('build-gas-lite.mjs')) {
  const { out, stats } = build();
  if (process.argv.includes('--check')) {
    const diff = Object.entries(out).filter(([k, s]) => !fs.existsSync(path.join(OUT, k)) || fs.readFileSync(path.join(OUT, k), 'utf8') !== s).map(([k]) => k);
    const stale = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((k) => (k.endsWith('.js') || k === 'appsscript.json') && !(k in out)) : [];
    if (diff.length || stale.length) { console.error('gas/lite が古い: ' + [...diff, ...stale].join(', ') + '（node scripts/build-gas-lite.mjs で作り直す）'); process.exit(1); }
    console.log('gas/lite は最新'); process.exit(0);
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const k of fs.readdirSync(OUT)) if (k.endsWith('.js') || k === 'appsscript.json') fs.rmSync(path.join(OUT, k));
  for (const [k, s] of Object.entries(out)) fs.writeFileSync(path.join(OUT, k), s);
  console.log(JSON.stringify(stats));
}
