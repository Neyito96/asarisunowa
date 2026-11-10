# 日次増分ロボ 実機接続準備（第17号）2026-11-10

PR #288 司令塔レビューの4指摘と第17号5項目への対応。**COPY GAS追加・COPYジャーナル実書込・本番変更は未実施**（下記「承認申請」で一括）。

## 1. EP-ID二重採番の防止（確定）
- **このシステムはEP-IDを採番しない。** `nextEpId` を廃止。COPY/ローカルの新着は GUID(+feedKey)から決定的な仮ID `TMP-<16hex>`（EP-形式ではないため本番IDと混同不能）。同じ入力なら並列・再開・再実行でも同じIDになり、全体最大IDの走査(O(N×新着))も不要。
- 本番EP-IDは、台帳の**READ_ONLY読取結果との突合**(`reconcileEpIds`)でのみ得る。台帳に無い=本番未登録(TMPのまま)。1GUIDに複数EP候補、または既存EP-IDが別GUIDに紐づく場合は `idConflict`(HOLD)で割当てない。
- 既存の本番採番器(READ_ONLY棚卸し): repo内にEP-ID採番コードは**存在しない**。唯一writerは repo外の本番GAS `ALIB_AUTO_tick`（`LibraryPhase8ReadOnlyStatus.js` が同一プロジェクトでのみトリガー列挙可と記載）と推定。**本番GASソースは未確認**のため確定ではなく、COPYでは予約・書込しない前提で設計。repo内で確認できる時間トリガー: `PlaylistAutoThemeReview`(THEME_REVIEW_AUTOMATION)、`AutoUpdateAutomationV1`(AUTO_UPDATE_V1)。司令塔の「既存6トリガー」の一覧は未入手。
- 試験: 仮ID形式、決定性、並列(逆順feed)収束、台帳突合、衝突HOLD、2万件の線形性。

## 2. 単一writerリース/COMMIT（`journal-lease.mjs`）
- 追記専用ジャーナル(P25_STATE同型)上の **fencing token**。取得は同一ownerでも必ず新token、COMMITは token一致・期限内・runId一意・同token二重COMMIT不可・`baseVersion`一致(楽観的並行制御)をロック内で検査。取得/COMMITはGASの `LockService.getScriptLock().tryLock` 内で「読取→検査→追記」を完結(`withLock` 注入)。ロックが破れた最悪ケースでも fencing で旧writerのCOMMITを拒否。
- 回帰試験(10件): 競合、期限切れ、奪取後の旧token拒否、再実行の二重COMMIT、ロック保持中BUSY、解放後の即時取得、未COMMIT失効の検知。パイプラインは**COMMIT成功時のみ永続化**(途中失敗は何も残らない)。
- **未検証**: GAS実機でのLockServiceの原子性・ジャーナルシートへの追記の可視性。モック証明であり、競合未確認をPASS扱いしない。

## 3. RSS解析の堅牢化（`rss-parse.mjs`）
- 正規表現でタグを拾う方式を廃止。実際にXMLをトークン化。名前空間(itunes:/content:)、宣言、コメント、CDATA、エンティティ(名前付き/数値/16進)を処理。DOCTYPE/ENTITY・閉じ忘れ・タグ不一致・過大入力・非feedは**フィード全体を拒否**。
- item単位の厳格隔離(理由つき): GUIDなし/長大/制御文字、pubDate不正・2010年前・1日超の未来、題名なし、同一GUID内容衝突。https以外のURLは空にする。
- **番組identity**: `feedKey`(番組ID/RSS identity) を必須、`expectedShow` 不一致なら全itemを隔離。照合は **(feedKey, guid) 複合**で、別番組の同一GUIDは別エピソード(衝突件数を記録)。
- 試験8件。COPYで実測済みの 2,672 item 規模のfeedを3秒以内に解析。※実フィードXMLそのものの再取得・再調査はしていない(既存の実測=HTTP 200/2,672件を再利用)。

## 4. 番組別頻度と巡回成功の分離
- 全体の「最新から36h」警告を廃止。`recordPatrol`(巡回成功/HTTP/連続失敗/件数)と新着ゼロを区別。異常は: `PATROL_STALE`(36h超成功なし or 連続3失敗, STOP)、`FEED_ITEMS_SHRANK`(前回より件数減, STOP)、`SHOW_OVERDUE`(その番組自身の配信間隔の中央値×2か36hの大きい方を超過、履歴5件未満は判定しない, WARN)。巡回成功+新着ゼロは正常。週刊番組は次回までは誤報しない(試験)。

## 5. Phase26(#287)との連携（`daily-pipeline.mjs`）
巡回(RSS) → 厳格解析 → (feedKey,guid)でingest(仮ID) → 台帳突合(READ_ONLY) → 空欄監査 → 補完キュー(注入resolvers, 429/5xx/予算) → 非破壊適用 → **非公開プレビュー差分**(新着登録そのもの＋補完セル。承認済みは`public_update_candidate`) → run記録 → COMMIT成功時のみ永続化。試験: 3日フロー(同日再巡回で空欄だけ補完・翌日新着ゼロは正常)、COMMIT前クラッシュ、二重COMMIT拒否、巡回失敗/不正XML/別番組、429、TMP→EP-ID引継ぎ。

## 承認申請（COPY実機へ進む段階でまとめて1回）
**操作**: ①COPY GASに `P25DailyReadOnly`(公式Omnyフィード取得+件数・GUID集計のみ、書込なし) を追加 ②COPYジャーナル(COPY Sheetの専用タブ)へ run記録とregistry差分をCOMMIT付きで追記 ③手動実行のみ(トリガー設定なし)。
**安全条件**: COPY isolation検査(scriptId/Sheet ID)を通過 / 本番台帳・本番GAS・Spotify・トリガー・公開サイト・mainに触れない / ログは件数のみ / 追記専用・fencing/COMMIT/runId一意 / 1回の実行で最大1 run・行数上限 / 失敗時は停止し再実行しても重複しない / 本番EP-IDを採番・書込しない / 派生Sheet期限は11/24暫定。
**前提**: 本番ALIB採番器の唯一writer確認(管理人側GASの棚卸し)が未了でも、COPYはTMPのみで進められる。
