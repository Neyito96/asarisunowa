# Phase15 自動新着収蔵の最小復旧パッチ（2026-11-01 / 未本番反映）

## 変更対象
本番 `Phase15AutonomousBundle.gs` の `function tick()` **内部のみ**。既存 `intake` / `p15MegaphoneVerifiedLocator` / GUID予約・照合 / トリガーは触れない。

## 変更1: RSS取得に新着用の時間枠を確保
変更前:
```js
var sources=PHASE15_INTEGRATED.fetchSources(s,deadline);result.rss=sources.log.filter(function(x){return x.status==='OK';}).length;
```
変更後:
```js
var sourceStarted=Date.now();
var sourceDeadline=Math.min(deadline-90000,sourceStarted+90000);
var sources=PHASE15_INTEGRATED.fetchSources(s,sourceDeadline);
result.sourceElapsedMs=Date.now()-sourceStarted;
result.rss=sources.log.filter(function(x){return x.status==='OK';}).length;
```
※ fetchSources 内部が渡されたdeadlineを厳密に守らない場合には実時間が超過し得る。さらに取りこぼしを防ぐには fetchSources 本体のソース別の時間計測・取得件数監査が必要。

## 変更2: intakeスキップを OK と誤報させない
変更前:
```js
if(Date.now()<deadline-80000)result.intake=intake(s,sources,Math.min(deadline-80000,Date.now()+60000));
```
変更後:
```js
result.intakeRan=false;
if(Date.now()<deadline-80000){
 result.intakeRan=true;
 result.intake=intake(s,sources,Math.min(deadline-80000,Date.now()+60000));
}else{
 result.intakeSkipReason='SOURCE_FETCH_EXCEEDED_INTAKE_BUDGET';
}
```
変更前:
```js
result.status='OK';
```
変更後:
```js
result.status=result.intakeRan?'OK':'RETRY_NEXT_TICK';
```
注意: if intake が走っても実際に新規0件だった場合は {added:0,...} を返し、原因確認は `intake.decisions` を見る。

## テストケース・受入条件
- 10/31・11/01のログ `intake:0` は関数呼出し前のスキップと判明。再発時は `RETRY_NEXT_TICK` と `intakeSkipReason` を明示。
- 模擬fetchSources 25秒なら intakeRan=true で従来の新着判定へ到達。
- 模擬fetchSources 170秒なら intakeRan=false, status=RETRY_NEXT_TICK。
- 未登録GUID 1件は既存台帳/除外・予約を照合して採番→読み返し→P15_INTAKE VERIFIED。再実行で追加0。
- Megaphone RSS link空で有効な音声GUIDのケースとOmny通常ケースを回帰テスト。
- 本番の実行前に既存tickのバックアップをGitHub/ローカルに保存し、一部行だけ置換。追加トリガー作成禁止。
- 本番で当日回収を目的とした手動tick実行は、COPY検証と書込承認後。実行後 `P15_LAST_RUN` / `P15_INTAKE` / 本番エピソード台帳末尾を照合。
- 書き込み未承認ならコードパッチ準備まで。ここに掲載したコードは未検証・未反映であり、取得上限やネットワーク待ちが守られるか未実測。

## 次に必要な観測
`PHASE15_INTEGRATED.fetchSources` が deadline 引数をどの処理境界で検査するか。取得元一覧8RSSごとの時間/取得件数。接続欠落や遅延で他の番組の候補が捨てられていないか。
