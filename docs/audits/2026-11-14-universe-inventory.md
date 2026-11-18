# 朝リスの宇宙（asarisu-universe）の分類データの棚卸しと、V2 とつなぐ設計（2026-11-14・Claude Code）

## 調べたもの
- 宇宙リポジトリ `Neyito96/asarisu-universe` の2つのブランチを読むだけで調べました（clone）。
  - `main` の HEAD `d9d0f8f`
  - `work/semantic-normalization-20261026`
- 照合の相手は次の2つです。
  - V2 の写し（11/13 15:11 JST、公開候補6,061件）
  - 旧公開図書館5,848件（main の `public/library/data`）
- 宇宙には何も書いていません。

## 宇宙の index.html が読むもの
- 朝リスの田の公開 JSON（`https://neyito96.github.io/asarisunowa/library/data/`）を `fetch(base+path)` で読み、EP-ID で `library/?ep=` へリンクしています。
- **田の公開データが V2 に切り替われば、宇宙は同じ EP-ID でそのまま追従する構造です。**

## 分類データの所在と件数（実データ）
| ファイル（ブランチ） | 件数 | キー | 状態 |
|---|---:|---|---|
| `data/semantic-recovery/shard-00〜18.json`（main） | 5,358（重複0） | `ep_id` | provisional 5,257・title_only 68・assistant_reviewed 33。主テーマは「大/小」の形式が102件、自由記述が5,256件 |
| `data/semantic-normalized-draft/shard-00〜18.json`（work） | 5,358（同じ EP） | `ep_id` | normalized_main_theme はすべて `provisional_unverified` |
| `data/semantic-normalized-draft/human-approved-109.json`（work） | 109 | `ep_id` | **user_approved・locked**（人が承認） |
| `data/semantic-normalized-draft/legacy-recovered-from-381.json`（work） | 200 | `ep_id` | assistant_reviewed 147・title_only 33・proposed 15・hold 5（人の承認ではない） |
| `data/semantic-normalized-draft/lab-taxonomy-proposal-20261027.json`（work） | 20主テーマ・103小テーマ | ― | `PROPOSAL_ONLY`。承認済みのテーマは0 |
| `data/semantic-normalized-draft/unrecovered-181-evidence-20261027.json`（work） | 181 | `ep_id` | 分類を復元できなかった回の証拠 |
| `ai-inference-unrecovered-batch01〜04`（work） | 181 | `ep_id` | AI_PROPOSED 178・HOLD 3 |
| `art110-*`・`quality-*`（work） | 各7〜110 | `ep_id` | LAB_NOT_APPROVED／PENDING_HUMAN_REVIEW |
| `data/geo-shards/part-0〜3.json`（main） | 952行（952EP） | EP-ID | 地理の試作 |
| `data/semantic-recovery/theme-bridge-pilot.json`（main） | 5,358EP | EP-ID | テーマの橋渡しの試作（ノードとエッジ） |

## 照合の結果
- **キーはすべて EP-ID** です。Spotify エピソードID も GUID も含まれていません。
- EP-ID は田と同じ番号です。分類データにある EP-ID は、全件が V2 にも旧公開5,848件にもあります（V2 に無い EP-ID は0件）。タイトルを持つ101件は、101件とも V2 のタイトルと一致しました。
- 3つの集合は重なっていません。仮の分類 5,358件、人が承認した109件、旧分類から救出した200件で、合計 **5,667件** です。
  - 承認済み109件と仮の分類が同じ EP で食い違う例は0件です（そもそも重なりが無いため）。
- 分類が無い回:
  - 旧公開5,848件のうち **181件**（宇宙の `unrecovered-181` と一致）
  - V2 公開候補6,061件のうち **394件**（＝181件＋V2 で追加された213件）

## V2 とつなぐ設計（提案。今回は作りません）
1. **正本の役割を分けます。**
   - EP の存在と採否は V2 台帳が持ちます。
   - 分類は、V2 の作業用スプレッドシートに作る「V2・分類」シートが持ちます（1EP 1行）。列は次のとおりです: EP-ID／主テーマID／小テーマID／関連テーマ／状態／出典ファイルと blob SHA／分類版／更新日時。
2. **最初の取り込み**:
   - 宇宙の JSON を GAS が GitHub の raw URL から読むだけで取り込み、COPY で予行してから、承認後に V2 へ書きます。
   - 状態はそのまま写します（user_approved・locked／assistant_reviewed／provisional／AI_PROPOSED／HOLD）。
   - **locked と user_approved は、どの処理も上書きしません**。仮の分類と、別の列・別の状態で区別します。
3. **新着**: 日次 D1 で入った EP は、「V2・分類」に `未分類` の行を足すだけにします。自動分類は「提案」止まりで、人が承認するまで公開には出しません（PR #284 の辞書は適合率 約70%で、自動確定には足りません）。
4. **公開への接続**:
   - E1 の公開データに、承認済み（user_approved・locked）の分類だけを `themes` として載せます。
   - 宇宙は、田の公開 JSON から EP-ID で読みます。
   - 仮の分類は、宇宙の試作（ラボ）の表示に限ります。
5. **プレイリストのテーマ**（スプレッドシート `1KSzo…` の「テーマ判定履歴」は Spotify エピソードID がキー）は、別の対応表（EP-ID ↔ Spotify エピソードID）ができるまでつなぎません。
6. 優先順位: PR #306 の GAS 配置・COPY 実測・V2 正本化・空欄補完（P0）の後に行います。UI の開発はしません。

## 司令塔の確定方針（2026-11-14 07:47）
1. 人が承認した109件を最優先で守る。仮の分類5,358件と救出した200件も、削除も上書きもしない。
2. 20主テーマ・103小テーマは、承認されていない提案の辞書として扱う。
3. 「V2・分類」シートは、V2 を正本にした後に COPY で設計・試験する。今は V2 に追加しない。
4. 仮の分類を公開検索で使う可能性は残す。そのため、正式な分類と区別できるデータの形にする（案は下記）。
5. 宇宙の分類 JSON と公開図書館の EP-ID のつながりを保つ。移行のときに既存の分類を失わない。
- 田と宇宙は、EP-ID を共通にする1つのシステムとして設計・監査する。新しい UI の開発、本番への書込、分類の一括自動承認はしない。

### 4 のデータの形（案。未実装）
公開データの1EPに次のように持たせます。`level` で正式と仮を必ず区別します。
```
"themes": [
  { "main": "国際", "sub": "中南米", "level": "approved",    "source": "human-approved-109", "locked": true },
  { "main": "経済", "sub": "",       "level": "provisional", "source": "semantic-recovery/shard-07", "confidence": "medium" }
]
```
- `approved`（user_approved・locked）だけを「正式な分類」として表示・集計します。
- `provisional` は、検索の手がかり（当たった語の候補）にだけ使い、画面では「仮」と明示します。
- `AI_PROPOSED`・`HOLD`・`LAB_NOT_APPROVED` は公開データに載せません。
