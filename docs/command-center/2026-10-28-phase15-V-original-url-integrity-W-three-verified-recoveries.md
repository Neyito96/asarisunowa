# Phase15｜司令塔報告：V原文URL完全性・EP-00001〜00030
日付 2026-10-28。指令 ed6a9d4b803e3b49c78ebbacaef61e4330472de3。
実行対象：本番台帳 1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4、エピソード台帳 EP-00001〜00030／台帳2〜31行。
## 成果：W列の公式URL復旧実書込
- **W5 EP-00004：関連記事3タイトル・3URL**。公式 Omny https://omny.fm/shows/asahi/worldinsight5?in_playlist=podcast とタイトル・説明を照合。
- **W11 EP-00010：関連記事3タイトル・3URL**。公式 Omny https://omny.fm/shows/asahi/ongoing1001?in_playlist=podcast と照合。ACには1 URLだけだったが公式は3 URL。
- **W12 EP-00011：関連記事3タイトル・3URL**。公式 Omny https://omny.fm/shows/asahi/8gake21 と照合。ACには1 URLだけだったが公式は3 URL。
- 以上 **本番W品質修正3セル、公式根拠に基づく記事URL追加9本、V列こちらからの変更0**。修正後にEP-ID・GUID・V・Wを再読込、変更3件すべて一致。更新前後の値・AC列のバックアップ：docs/command-center/evidence/2026-10-28-official-omny-W5-W11-W12-linked-recovery-before-after.json（commit 9c0dda6）。
## 公式ページでの7件照合
EP-00004 上記、EP-00006 https://omny.fm/shows/asahi/mekuro201、EP-00007 https://omny.fm/shows/asahi/oosaka5、EP-00008 https://omny.fm/shows/asahi/polirebi13?in_playlist=podcast、EP-00009 https://omny.fm/shows/asahi/yurukei20?in_playlist=podcast、EP-00010 上記、EP-00011 上記。
公式Webページのタイトルと説明テキスト・関連記事URLは確認。**RSS XML / JSON のGUID付き原本バイト列、HTML記述そのものは未取得。** したがって「元のRSS/JSONのV保存時に脱落した」との因果はまだ断定できない。
EP-00006〜EP-00009：Vの関連記事はタイトルだけ・URLなし。公式公開ページでは各3/3/5/3 URLを確認。WとACのURLは記事ID部分が公式ページと一致。VへのURL補記はしていない。
EP-00023：Vは元からHTMLと関連記事URLを保持し、出演者欄の後に関連記事がある。URL分離の一般ルールを適用すると破壊する事例。
## いつから欠落していたか
2026-10-17（V3段階B開始前）、2026-10-21（Phase11更新前）、2026-10-23（Phase14 COPY）、2026-10-25（移行前）のバックアップ台帳を参照。重点8件 EP-00004〜00011 のVはこれら各時点で**同一長のURL無しテキスト**（EP-00004 370字、EP-00006 332字、EP-00007 528字、EP-00008 411字、EP-00009 304字、EP-00010 364字、EP-00011 548字）。ACには記事URLが保存されていた。**少なくとも10/17以前**からURL無しVと別列URLが併存。初回収蔵時から欠落していたか、10/17以前の変換処理で欠落したかは、当時のRSS/JSON取得ログ・初期V書込コードと原本がないため未確定。
補足：本日の調査中に**EP-00004 Vの長さが370→568字に変化**した。こちらはVに一切書き込んでいない。現Vには元テキストに関連記事URLをLFで挿入した混在形式があり、原文HTMLの忠実保存ではない可能性がある。他の並列書込との競合を疑い、同じ箇所へのV操作を停止。変更主体は未確認。完全復元ではなく provenance=要検証として扱う。
## 30件の一覧・計数
docs/command-center/evidence/2026-10-28-ep00001-00030-V-W-AC-url-integrity-matrix.json（commit 7ff0933）。行2〜31のEP-ID/GUID、V/W/ACのURL本数、確認できた公式Omnyページを記録。後半時点でV URLゼロ22件、AC URLあり28件、V URLゼロかつAC URLあり20件。ただしEP-00004のVが並列変更された後の値であり、履歴比較とは別集計。
## 解析対象コードの所見と未確定点
scripts/prepare-news-descriptions.mjs は本番EP-01443〜01984に限るPhase11のREAD_ONLYプレビューであり、今回のEP-00001〜00030の欠落原因と断定してはいけない。public/library/description-editor.mjs は関連記事URLをAC相当のrelatedUrlsから別索引へ抽出する機能を持つが、V書込時の原本URL切落しを証明するものではない。取得元でのRSS GUID対応・HTML原文バイト列、初期採録コード/ログの追跡が次の必須ステップ。
## 保護と次工程
- Vの新規変更・強制追記は**0**。公式Omny公開ページの文字列を後付けしたものをRSS/JSON原本と偽ってVに保存しない。
- Wは公式公開説明でタイトルとURLが対で記載されたもののみ更新。関連記事追加9件に対する本番再読込実施。
- 713行目以降の大量補填は停止継続。V原本復元はGUID一致の公式RSS/JSON原本取得・完全保存・バックアップ比較後に行う。並列作業がある場合はVの競合書込を統制する。
- 時間トリガー新設なし。
