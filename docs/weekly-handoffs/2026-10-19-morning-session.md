# 2026-10-19 朝の1時間｜Issue再点検と実行順（READ ONLY）

## 正本
- [#222](https://github.com/Neyito96/asarisunowa/issues/222) が統括。P0-A 品質／P0-B 収蔵／P1-C サイト／P1-D 統合の4ワークストリームを維持する。
- #223 #224 は過去307件監査（現6,591件の母集団と混同しない）。
- #227 ノーミライ #9 は現行V1の取りこぼし未解決。
- #231 小林友花20出演回のうち2件は出演根拠がRSS原文にあるが、抽出・Spotify URL欠損。
- PR #230 はopen/draft、未マージ。本文に「隔離GAS未反映」とあるのは過去時点の記述。#222最新によれば2026-10-18に2ファイル反映済みで、previewLibraryV3Morning成功。**新着1件の隔離コピー保存は未実施**。

## 今朝の決定
昨夜のOmny Consumer APIとMegaphone報談RSSの取得成功を生かす。ただし今朝の第一歩は新着コードの拡張ではなく、既存6,591件の音源・概要欄・清掃・出演者・GUIDのREAD_ONLY一括棚卸し。既存 `LibraryV3.js` に実装済みの `previewLibraryV3QualityAudit()` を再利用し、新規の重複監査コードを作らない。

## ユーザーがMac/GASで実行する最初の1手
隔離GAS（本番ではない方）を開き、`previewLibraryV3QualityAudit()` を1回実行する。返却オブジェクトまたは実行ログの `READ_ONLY_V3_QUALITY`、`READ_ONLY_V3_QUALITY_SHOW`、`READ_ONLY_V3_OLD_NEWS` を保存・共有する。ログが大きい場合は先に `previewLibraryV3MissingAudit()` だけ実行して、総数と `byShow` を確認する。

### この監査が意味するもの／意味しないもの
- 全件のURL存在／欠損を集計する。HTTPでの音声ファイル到達や実再生はこの関数では検証しない。
- `audio.httpEvidenceCurrent` は保存済み検証状態の件数。値を根拠なく再生可能とみなさない。
- 古いニュースの現場から（2020・2021年）について raw/clean の欠損・相違を抽出する。共通告知文の除去はまだ行わない。
- この関数は Sheets / Properties / triggers / Spotify の変更を行わない。

## 監査結果を受けた次の手順
1. 実測 `missing.byShow` と `audio` と `oldNews` を照合し、音声URL欠損・概要原文欠損のEP-ID群を確定。2020年頃の未清掃を別集計。
2. HTTPの検証対象は存在URLからサンプリング・小バッチ化し、403/404/429/5xxを明示。URL空欄にはOmny/1007/RSSの厳密一致候補を作る。アクセスが成功しても音声再生まで保証したと報告しない。
3. P0-BはOmny API / Megaphone RSSの共通形式とID衝突対策を設計。既存V3 copyPilotで新着1件の候補・GUID・コピーID・planHashをREAD_ONLY表示した後、ユーザーの個別承認を得て隔離コピー保存→再実行0件を確認。
4. 結果を#222へ還元。新Issue乱立、mainマージ、本番GAS/トリガー/Properties/Sheets/Spotify書込をしない。

## 2026-10-18 実測の根拠
- Omny latest5 HTTP 200 約192〜263ms。これはRSS全2,649件約150秒と対象件数が異なる。
- 報談 Megaphone RSS HTTP 200 2,873ms、217 items、最新3件のGUID/概要/音声enclosureを確認。個別RSS link空欄。
- Probe `MegaphoneFeedProbe.js` 構文修正コミット `15657ea`。昨夜のRSS試験はユーザーGASログで成功。

## 注意
この文書は実行計画であり、**2026-10-19の全件監査はユーザーのGAS実測待ち**。成功したと記述しない。
