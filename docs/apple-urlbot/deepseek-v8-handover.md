# Apple URLBOT 第8版 — DeepSeek成果保全（2026-11-13）

## 重要
DeepSeek第5〜8版は会話内で生成され、GASにもGitHubにも未配置だった。本ブランチは成果の保全と引き継ぎ用。**実行可能な完全統合コードではない。** GAS実行なし、COPY5件/10件実測なし、MATCH件数不明。V2/V1/Spotify/公開サイトへの変更なし。

## 構成（設計）
UrlBotConst.gs / UrlBotFixedTargets.gs / UrlBotApple.gs / UrlBotBatch.gs / UrlBotGuidTest.gs / UrlBotMenu.gs（6ファイル）。第5〜7版の全文がこのターンに揃っていないため、存在しないコードを補完したふりはしない。

## 仕様
- V2 H列GUID と Apple lookup の episodeGuid を厳密一致
- 既存Apple URLから番組collectionIdを特定、番組が不明・曖昧ならHOLD
- Apple個別EP URLは番組IDと trackId（?i=）を検証
- API 200件上限は HOLD_TRUNCATED（未発見と断定しない）
- COPY固定対象1000件、ログ、状態、途中再開、重複防止
- URLBOT_VERIFIED_ENABLED=false。V2本番への書込禁止
- 第8版の変更: RECOVERYログ照合、attempted通信回数、completed注記、GUIDテスト5/10完全版
- 完了はPENDING一巡を意味し、全件URL取得成功ではない

## 第8版から保全すべき重要なコード断片

### Apple lookup の通信試行カウント
```js
const cached = urlbot_apple_getCache_(cid);
if (cached) {
  if (state) state.agg.cacheHits++;
  return { ok:true, fromCache:true, attempted:false, episodes:cached.episodes, truncated:cached.truncated, show:cached.show };
}
let res;
try { res = UrlFetchApp.fetch(url, {method:'get',muteHttpExceptions:true}); }
catch(e) {
  if(state) state.agg.apiAttempts++;
  return {ok:false,kind:'RETRYABLE',reason:'FETCH_EXCEPTION:'+e.message,attempted:true};
}
if(state) state.agg.apiAttempts++;
```

### 復旧ログ
```js
if (mode === 'BATCH_START') batchStartKeys[runId+'|'+epId] = true;
else if (mode === 'RECOVERY' && status === 'PROCESSING_TO_PENDING') recoveryKeys[epId] = true;
// PROCESSING -> PENDING, return {recovered:n,recoveryLogged:recoveryLogged}
```

### GUIDテストの判定
```js
const byTrack = lr.episodes.find(e => String(e.trackId) === String(r.trackId));
if (!r.trackId) status='GUID_TEST_TRACKID_ABSENT';
else if (!byTrack) status='GUID_TEST_TRACKID_MISSING';
else if (!byTrack.episodeGuid) status='GUID_TEST_API_NULL_GUID';
else if (byTrack.episodeGuid === r.guid) status='GUID_TEST_MATCH';
else status='GUID_TEST_MISMATCH';
```
GUIDテストは番組ごとに1件ずつ巡回、EP-IDと結果を14列ログへ記録。API試行、成功、失敗、キャッシュヒットを区別。

## 統合前に要修正・確認
1. urlbot_recoverProcessing_ は対象シートなし/空の場合は数値0を返し、呼び出し側は {recovered,recoveryLogged} を期待する。戻り値を統一。
2. RECOVERYをEP-IDにつき1回しか記録しないため、複数回の復旧履歴が失われる。
3. GUIDテストはキャッシュヒットも apiSuccess として数える。通信成功と区別する。
4. trackIdのない番組レベルURLがGUIDテスト候補に混入する。
5. 旧10列固定シートは自動移行せず停止。無断リセットしない。
6. 第5〜8版の6ファイル全文を統合し、依存・重複定義・COPY書込先を監査するまで実行しない。

## 次の工程
このブランチに完全統合コードを作成→静的監査→COPY GASに配置→GUID 5件実測→10件実測。1,000件バッチ、VERIFIED有効化、本番書込は別承認。

関連 Issue #280（URL補完）、#283（横断）。
