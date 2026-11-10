# 新着100件（EP-06592〜06691）の増分判定と掲載件数の再計算（READ_ONLY）

## 確定済みの前提（司令塔の実測 2026-11-10、再実測しない）
原本 6,691 EP-ID／旧判定タブ 6,591／差分 EP-06592〜06691 の100件／旧EP-ID消失0／原本重複0／承認済み掲載基準 5,848（2026-10-22）／旧比較対象 5,219。約5,936は旧試算で確定値ではない。

## 方針
- 10/22凍結基準（`docs/audits/2026-10-22-publication-scope/decisions.json.gz`）は変更しない。新着だけを同じ基準で判定する。
- 宇宙掲載（publication）とおんさ比較（comparison）は別々に判定。ニュースの学校は宇宙候補として保護し比較は対象外。こどもそうだんしつは掲載採用・比較外。
- 未確認（GUID/題名/日時の欠落、未知番組、同題同日で別ID、再配信語）は**保留**。無条件で公開対象にしない。GUID一致の重複は対象外（重複）。
- 「アンコールの舞台」は再配信ではない（EP04305の誤除外防止）。
- 台帳整合（旧IDの消失・重複・不正ID）が崩れていれば判定せず停止する。物理削除・再採番はしない。

## 実行（書き出しCSV/JSONだけを読む。本番シート・GAS・ネットワークに触れない）
```sh
node scripts/ledger-increment-judge.mjs --ledger ledger-export.csv --as-of 2026-11-10T10:00:00+09:00 --out docs/audits/2026-11-10-increment
# おんさ比較差分（外部実測側の一覧 [{show,guid?,title?}] がある場合）
node scripts/ledger-increment-judge.mjs --ledger ledger-export.csv --onsa onsa-items.json
```
出力: `increment-manifest.json`（EP-ID・番組・題名・配信日時・GUID・掲載/比較判定・分類・理由・根拠）、`publication-recount.json`（基準5,848／新規掲載可／新規保留・除外／基準からの移動／最新掲載可能数を分離）、`onsa-diff.json`。

## おんさ比較（司令塔の3資料実査を反映）
- 計数定義は `scripts/lib/onsa-count.mjs` の `SPEC` に集約（出典: `speakers3.js`、司令塔が確認した内容）。6番組（genba/media/sdgs/houdan/donuts/sports）のみ、ニュースの学校は含めない。SDGsは 2026-06-30 以降を除外（JST想定・要検証）。`（再）`/`（ふりかえり）`/`（深掘り）`始まり、`再放送です`を含む題名は actualDuration=0 として**画面カウンタに数えない**。
- 出力は「API生配列件数」「readData後」「画面カウンタ相当」を別々に持つ。5,512は画面カウンタの値であり、生配列件数ではない。
- `--onsa` は生API JSONを直接受け付け、schema不一致・取得不能は `unavailable`（過去値は再利用しない）。
- EP同一性は GUID/Omny clip → Spotify episode ID → 番組+題名+JST日付 の順。差分は EP単位で「新着 / 再配信 / 旧SDGs / 日時差分 / 番組構成 / 未解明」に分類し、逆方向（旧比較対象なのにおんさ側に無い＝不足）と同一EPへの多重対応（重複）も出す。基準日時が違うので差を収蔵漏れと断定しない。
- 未検証の前提: `sports` を「スポンジ」に対応付けている点。EP同一性が取れた項目で裏付けるまで確定扱いにしない。
- Issue #275 の監視は `scripts/onsa-count-watch.mjs` + `.github/workflows/onsa-count-watch.yml`（6時間毎・手動、最小権限、Secrets不要、変化/失敗/監視空白をIssueへ記録）。同じ計数定義を使う。

## 本番台帳の実見出し対応（PR #277 指摘）
`台帳ID` / `番組名` / `タイトル` / `配信日時（JST）` / `外部ID` を認識（別名も維持）。実見出しのfixture（`tests/fixtures/increment/ledger-real-headers.csv`）でCLI読み取りと判定をテスト。Spotify列の実見出しは未確認のため別名候補のみ。

## 現時点の状況（正直な記載）
- Driveコネクタ経由で取得できたのは台帳のダッシュボードと補助タブ（P15_INTAKE等）のみで、「エピソード台帳」主タブの新100行（番組・題名・配信日時）は読めていない。補助タブから新着EPのうち約51件のGUIDは確認できたが、番組・題名・日時が無いため判定manifestの根拠にはしていない。
- おんさAPIはこの環境から取得できず、`speakers3.js` も許可リスト外で取得できない。計数定義は司令塔の確認内容に基づく。
- よって**新100件の個別判定・最新の宇宙掲載適格数・293件の要因別件数はまだ確定していない**（数値は出していない）。実行に必要な入力は ①台帳主タブのCSV ②おんさAPIの生JSON（取得時刻つき）の2つで、プログラムは入力が揃えば1回で全成果物を出す。
