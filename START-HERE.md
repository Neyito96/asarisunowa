# START-HERE — 朝リスの輪を引き継ぐ人が最初に読む1枚

このサイトは、朝日新聞ポッドキャストのリスナー「朝リス」がみんなで育てる非公式のコミュニティサイトです。
この1枚を読めば、**どこに何があって、毎日なにが動いていて、止まったらどうするか**が分かるようにしています。秘密の値（パスワード・トークン）はここには書きません。

---

## 1. まず、いま元気かを見る
**運行状況のページ: https://neyito96.github.io/asarisunowa/status/**
- 全部緑なら、何もしなくて大丈夫です。
- サイトの表示は GitHub Pages に置いた静的なファイルなので、ロボットが止まっても**見られなくなることはありません**。止まるのは「新しい回が載ること」だけです。

## 2. 全体の形
```
公式の配信（Omny・Spotify ほか）
   │ 毎朝 6:41ごろ  Google Apps Script（本番ロボGAS）が新着を取り込む
   ▼
Google スプレッドシート「V2作業用台帳」…… 全回の正本
   │ 毎朝〜毎時  GitHub Actions「Library V2 sync」
   ▼
public/library/data・public/uchu/data（JSON）…… 蔵と宇宙のデータ
   │ main への変更のたびに GitHub Actions「Deploy GitHub Pages」
   ▼
https://neyito96.github.io/asarisunowa/  （田・蔵・宇宙・星読み・FAQ）
```
ほかに:
- **配信先リンク探し**: Amazon・Spotify の新着リンク（GitHub Actions・朝と昼）
- **プレイリスト**: 投稿受付・自動更新・テーマ別（本番GAS「朝リスの輪 プレイリスト投稿受付」）
- **GASのコードの配達**: GitHub の `scripts/google-apps-script/` を、毎時「GAS配達係」が本番GASへ届ける（手で貼らない）
- **星読み**: 投票は本番GASが受け、30分ごとに `public/minna/votes.json` へ集計

## 3. フォルダの地図
| フォルダ | 役目 | 今使っているか |
|---|---|---|
| `app/` | 田（Next.js の画面） | ✅ |
| `public/` | 蔵・宇宙・星読み・FAQ・公開データ（素のHTML/JS） | ✅ |
| `scripts/google-apps-script/` | 本番GASの正本（配達係が自動で届ける） | ✅ |
| `scripts/` のほか | 蔵・宇宙のデータ作り、Amazon・Spotify のリンク探し、点検 | ✅ |
| `gas/` | 本番以外のGAS（清掃ロボ・起動係など。手で貼る） | ✅ |
| `tools/gas-delivery/` | GAS配達係のコード | ✅ |
| `.github/workflows/` | ロボット（GitHub Actions）の設定 | ✅ |
| `tests/` | 自動テスト（変更のたびに走る） | ✅ |
| `docs/` | 監査・設計・手引きの記録 | ✅ 読みもの |
| `sozin/` | 別の試作（写真の見積もり）。サイトに同梱して公開しているだけ | △ 朝リスの輪とは別 |
| `db/` `drizzle/` `worker/` `examples/` `components/` `hooks/` `vendor/` `build/` | 最初に使ったひな形（テンプレート）から来たもの | ⚠ 多くは今のサイトでは使っていない。消す前に、ビルドが通るか確かめる |
| `legacy/` | 古い試作の画面 | ✗ |

## 4. 毎日のこと（ふだんは見るだけ）
1. 朝 8時以降に **運行状況** を開く。「蔵の最新回」が今日なら OK。
2. 赤・黄があれば、下の「止まったとき」へ。
3. 週に1回くらい、GitHub の Issue に新しい声が来ていないか見る。

## 5. 止まったとき
| 症状 | まずやること |
|---|---|
| 今日の回が蔵にない | GitHub の Actions →「Library V2 sync」→「Run workflow」。それでも無いなら、台帳に今日の回があるか見る（無ければ本番ロボGASの 6:41 の取り込みが止まっている） |
| ロボットが「失敗」 | Actions の記録を開いて、赤い行のメッセージを読む。外のサービスの一時的な不調なら、次の回で直ることが多い |
| GitHub が混んで動かない | 「Run workflow」で手動で動かす。根本の対策は GAS の起動係（`gas/standalone/LibrarySyncKicker.gs`、#504） |
| GASのコードが本番に届かない | GAS配達係で `DELIVERY_LAST` を実行して状況を見る。止めたいときはスクリプトプロパティ `DELIVERY_STOP` に理由を書く |
| プレイリストに変な回が入った | Spotify でその回を消すだけ。仕組みが「人が消した」と覚えて、入れ直さない |

## 6. 元に戻す
- **サイト**: GitHub の変更はすべて履歴に残る。PR を「Revert」すれば戻る。
- **本番GAS**: 配達のたびに版（バージョン）が残る。Apps Script の「デプロイを管理」で前の版に戻せる。
- **台帳**: 大きな書き換えの前には必ずバックアップのタブを作っている（docs/audits に記録）。Google スプレッドシートの「変更履歴」からも戻せる。

## 7. 守ること（大事）
- 本番の台帳・Spotify プレイリストを書き換える前に、**何を・どう変えるか・どう戻すか**を書いて、確認してもらう。
- 秘密の値（トークン・パスワード・招待URL）は GitHub に書かない。GAS のスクリプトプロパティに置く。
- 回の題名・概要欄・音声は朝日新聞社など権利者のもの。コードは MIT、朝リスの輪が作ったデータは CC BY 4.0（`LICENSE`・`DATA-LICENSE.md`）。

## 8. もっと知りたいとき
- 続けていくための計画: Issue #493 ／ Google の引っ越し一覧: `docs/sustainability/`
- 第三者レビューと次の一手: Issue #551
- よくある質問: https://neyito96.github.io/asarisunowa/faq/
- 相談: 朝ポキ Discord、または GitHub の Issue
