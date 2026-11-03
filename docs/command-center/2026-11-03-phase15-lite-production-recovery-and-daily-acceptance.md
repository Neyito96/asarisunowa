# Phase 15 Lite｜2026-11-03 新着復旧・恒久日次巡回 本番手動試験ログ

**記録日:** 2026-11-03 JST  
**対象:** 「朝ポキ｜本番ロボGAS」、本番「エピソード台帳」  
**課題:** #265  
**開発:** Draft PR #268 / `fix/p15-lite-recovery-20261103`  
**状態:** 新着4件の復旧・本番手動試験合格。**翌朝の時間主導トリガーによる実行は未検証**。  
**注意:** GitHub PRは本番GASへ自動デプロイされていない。本番GASの変更は管理人がUIで行った。

## 1. 障害と復旧

- 2026-11-03 05:05頃：旧 `p15AutonomousTick` の本番実行は `RSS_OK=1`、新着 `added=0` だが `status=OK`。総時間225.327秒。ログに「ニュースの現場から」`items=2665`、`sourceElapsedMs=146143`。
- Drive保存の `Phase15AutonomousBundle.gs` で `fetchSources()` がRSSを直列取得し、`parseFeed()` が全 `item` を展開、旧 `tick()` が一系統以上成功で最終 `OK` とする条件を確認。ただしDriveコピーとライブGASの全コード一致は未実証。
- 復旧用 `P16LiteRecovery20261103.gs` を本番GASに管理人が追加。7公式RSSを `UrlFetchApp.fetchAll` で並列取得し、XML DOM解析前に先頭10 itemへ縮約、既存 `P15_AUTO.intake` を再利用。
- 10:02頃の `P16_RECOVERY_PREVIEW`：`status=READY`, `feedsOk=7`, `feedsExpected=7`, 未収蔵候補4件、書込0。7番組: ニュースの現場から、MEDIA TALK、こどもそうだんしつ、スポンジ、ニュースの学校、ドーナツ、報談。
- 管理人が `P16_RECOVERY_WRITE` を実行し4件収蔵。台帳および `P15_INTAKE` の `VERIFIED` を確認：

| EP-ID | 番組 | エピソード | 配信日(JST) |
| --- | --- | --- | --- |
| EP-06658 | ニュースの学校 | キリスト教国家主義 | 2026-11-02 |
| EP-06659 | ニュースの現場から | （カガク #27）火星の月探査 | 2026-11-03 |
| EP-06660 | MEDIA TALK | （ウニュ #97）体臭の劣等感 | 2026-11-03 |
| EP-06661 | ドーナツ | （ポすすめ）ポッドキャスト茶会 | 2026-11-03 |

- **品質留意:** EP-06658の公式個別URL(I/J列)は空欄。登録 `VERIFIED` とURL品質合格を混同しない。Megaphone系のURL検証は別課題。

## 2. 本番GAS接続・改修箇所

本番プロジェクト：「朝ポキ｜本番ロボGAS」。

1. `P16LiteRecovery20261103.gs` に `P16_DAILY_TICK` を含む最新版を管理人が反映。
2. `Phase15AutonomousBundle.gs` の **711行目**を、管理人が次のように変更して保存。

変更前：
```javascript
function p15AutonomousTick(){return P15_AUTO.tick();}
```

変更後（現在の本番画面で確認）：
```javascript
function p15AutonomousTick(){return P16_DAILY_TICK();}
```

既存の `p15AutonomousTick` 時間主導トリガーを使う。追加トリガーは作成しない。

### P16日次制御の主要部分（実装抜粋）

```javascript
var sources=P16_recoverySources_(10);
var scan=P16_dailyCoverage_(sources,prior);
if(scan.needsMore.length){
  sources=P16_recoverySources_(40);
  scan=P16_dailyCoverage_(sources,prior);
}
if(scan.ok!==sources.expected || scan.needsMore.length){
  report.status='PARTIAL';
  report.error='FEED_OR_HISTORY_GAP';
  return report;
}
report.intake=P15_AUTO.intake(ss,sources,
  Math.min(deadline-20000,Date.now()+100000),{limit:10});
var ingestSince=Date.parse(p.getProperty('P15_INGEST_SINCE')||'');
var eligible=Object.keys(sources.byGuid).filter(function(g){
  var t=Date.parse(sources.byGuid[g].published);
  return Number.isFinite(t)&&t>=ingestSince&&t<=Date.now();
}).length;
var decisions=Array.isArray(report.intake.decisions)?report.intake.decisions:[];
var incomplete=report.intake.added>=10 ||
  report.intake.held>0 || decisions.length<eligible;
if(incomplete){
  report.status='PARTIAL';
  report.error='INTAKE_INCOMPLETE_OR_HELD';
}else{
  report.status='OK';
  p.setProperty('P16_LAST_COMPLETE_SCAN_UTC',
    new Date(started).toISOString());
}
```

**完全なソース（本記録の正本）:** [P16LiteRecovery20261103.gs](../../scripts/google-apps-script/P16LiteRecovery20261103.gs)。上記は抜粋であり、これだけで動作しない。新着差分・GUID・採番・書込の安全ロジックは既存 `P15_AUTO.intake` に委譲している。

### コード開発コミット

- `238564f`：復旧用Lite RSS取得・新着差分処理の初版。
- `b944898`：既存 `intake` のScriptLockとの二重取得を回避。
- `689bdbb`：`P16_DAILY_TICK` と巡回カバレッジ・チェックポイント。
- `19610b0`：回帰テストファイル `tests/p16-lite-daily.test.cjs`。
- `688f26d`：保留・未処理・10件上限到達時に `PARTIAL`、チェックポイント据え置き。

## 3. 11:14 本番手動実行（管理人による）

呼出関数：`p15AutonomousTick()` → `P16_DAILY_TICK()`。

```json
{
  "version": "p16-lite-daily-20261103.1",
  "started": "2026-11-03T02:14:29.081Z",
  "status": "OK",
  "rss": 7,
  "expected": 7,
  "intake": {"added": 0, "addedIds": [], "held": 0,
             "excluded": 0, "registered": 21},
  "media": {"cells": 0},
  "error": "",
  "coverage": {"ok": 7, "needsMore": []},
  "elapsedMs": 15730
}
```

- 開始：11:14:29 JST。処理時間15.730秒、全7系統 `OK`。
- 取得フィード：ニュースの現場から2665件（検査10件）、MEDIA TALK1764件（10件）、こどもそうだんしつ38件（10件）、スポンジ182件（10件）、ニュースの学校499件（10件）、ドーナツ77件（10件）、報談222件（10件）。
- 既存GUID 21件が `REGISTERED / GUID_ALREADY_REGISTERED`、追加0件、保留0件、エラーなし。
- `P15_RUNS` シートに `2026-11-03T02:14:29.081Z / OK / RSS_OK=7` が追記されたことを別途読み取り確認。
- 旧225.327秒との所要時間比較は処理対象が異なるため単純な速度性能比較ではない。

## 4. 受入判定・未完了事項

**合格：**
- 新着4件収蔵済み、最終 `EP-06661`。
- 日次巡回を同一関数名 `p15AutonomousTick` 経由で呼ぶコード接続。
- 本番手動実行で7/7、`status=OK`、既登録21件、追加0・重複0。
- 一部失敗・履歴ギャップ・保留・未処理時の `PARTIAL` 判定をコード実装と模擬ケースで検証。

**翌日以降に実証：**
1. **2026-11-04 05時台**、既存時間主導トリガーからの自動起動、`P15_RUNS` 7/7 と結果を確認（未実証のまま成功と宣言しない）。
2. `PARTIAL` または `HALTED` の日次通知・再試行運用は別途設計。
3. 先頭10件→40件でも期間を覆えない長期停止時は `PARTIAL` で止まる。**40件以降のページング復旧は未実装**。
4. `P16_ENABLE_MEDIA` は別途検証まで無効のまま。既存100行補填・6サービス個別URL補填は日次Lite運転では行わない。恒久的なURL補填は次工程。
5. EP-06658ほかMegaphone由来の公式個別URLを照合し、未取得のまま `VERIFIED` と表示している品質課題を追跡。
6. Draft PR #268 は未マージ。GitHubブランチ上のコード・コミットと管理人が本番へ手動反映した版を区別する。

## 5. 運用上の決定

**「新着はまず確実に収蔵する。そのあとで過去の空欄・配信サービスURLを補填する」**。

作り直し・新規トリガー乱立を避ける。安全な重複排除と本番台帳の原文保護を維持し、成果は実収蔵件数・巡回完走率で評価する。

関連：[Issue #265](https://github.com/Neyito96/asarisunowa/issues/265) / [Draft PR #268](https://github.com/Neyito96/asarisunowa/pull/268)
