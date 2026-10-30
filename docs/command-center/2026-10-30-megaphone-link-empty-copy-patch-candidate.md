# Phase 15｜Megaphone RSS link欠落対応・最小修正候補（COPY限定）

状態：修正設計・試験待ち。**本番GAS・台帳・トリガーへ未反映**。
対象：Issue #265、Phase15AutonomousRuntime.gs／Phase15AutonomousBundle.gs（正本49eb916）。

## 実測
2026-10-30 11:12 JST 読み取り専用GASで公式Megaphone RSS確認：
- ニュースの学校「民主社会主義」4ea6480a-ccfd-11f1-b2de-17a1ce8dc9d8
- ニュースの学校「AI主権」0db36344-8fce-11f1-b526-87dbf0a47201
- 報談「VIVANT、モンゴル火災、福田康夫氏死去　近づかない中国との距離」ca61c8a4-d36d-11f1-ae7a-97b9e64c5d86

3件とも item.link は空。GUID、題名、pubDate、enclosureは存在。取得元一覧のニュースの学校・報談のRSSは feeds.megaphone.fm の正規ホスト。現行 newEpisodeDecision は Omnyの個別ページリンクだけを許可するため、3件ともURL保留。

## 最小修正方針

安全にするため **Megaphone RSSのlink欠落だけ**を追加の収蔵許可例外とする。対応番組を「ニュースの学校」「報談」に固定し、ソースURLを取得元一覧の登録URLと完全一致させ、GUIDのRFC4122形式、題名、日時、公式RSSのenclosureが traffic.megaphone.fm の所定MP3であることをチェック。pdst.fm はユーザー向け再生転送であり、同一性確認だけに使い、個別ページURLにはしない。RSS URL/GUIDは既存の取得元URL欄に保持し、I/J列は空欄のまま「公式個別ページ未取得」を別監査で記録する。

**安全上の追加注意：** 現行PHASE15_INTEGRATED.planは追加列変更を提案するため、空のI/Jをplanが誤って埋めないことをCOPYで検証。既存I/Jの空欄を推測URLで埋めない。新規の監査行に MISSING_OFFICIAL_EPISODE_PAGE の状態を明示する。現行newEpisodeDecisionのエラー保留から検品課題への状態遷移は、P15_RETRYの旧REVIEWを消さず、別途解消記録を残す。

## パッチ候補（差分設計）
newEpisodeDecisionの既存URL判定1行を置換する前に、次の純粋関数を同じスコープ内に追加する。

~~~javascript
function verifiedEpisodeLocator(x) {
  var link = str(x.link).trim();
  var omny = /^https:\/\/(?:omny\.fm|www\.omny\.fm)\/shows\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/.test(link)
    && !/\/playlists\//.test(link);
  if (omny) return {ok:true,mode:'OFFICIAL_PAGE',url:link};
  if (link) return {ok:false,reason:'OFFICIAL_EPISODE_URL_MISSING_OR_UNVERIFIED'};
  var sources = {
    'ニュースの学校':'https://feeds.megaphone.fm/TASC5851398719',
    '報談':'https://feeds.megaphone.fm/TASC9421488254'
  };
  if (!Object.prototype.hasOwnProperty.call(sources, str(x.show))
      || str(x.source)!==sources[str(x.show)]) {
    return {ok:false,reason:'OFFICIAL_EPISODE_URL_MISSING_OR_UNVERIFIED'};
  }
  var audio = str(x.audio).trim();
  // Official Megaphone enclosure may use a trusted short redirect wrapper.
  var trusted = /^https:\/\/pdst\.fm\/e\/traffic\.megaphone\.fm\/TASC[0-9]+\.mp3(?:\?.*)?$/.test(audio)
    || /^https:\/\/traffic\.megaphone\.fm\/TASC[0-9]+\.mp3(?:\?.*)?$/.test(audio);
  if (!trusted) return {ok:false,reason:'MEGAPHONE_ENCLOSURE_UNVERIFIED'};
  return {ok:true,mode:'RSS_ENCLOSURE_ONLY',url:''};
}
~~~

newEpisodeDecisionの既存URL1行を以下へ変更する。

~~~javascript
 var locator=verifiedEpisodeLocator(x);
 if(!locator.ok)return {state:'HOLD',reason:locator.reason};
~~~

intakeの新規行作成後、I/J代入を次のようにする（他の列は変更しない）。

~~~javascript
 var locator=verifiedEpisodeLocator(x);
 row[8]=locator.mode==='OFFICIAL_PAGE'?locator.url:'';
 row[9]=locator.mode==='OFFICIAL_PAGE'?locator.url:'';
~~~

ただし**上記をそのまま本番に貼らない**。この候補はCOPY環境で使い、特に新規行I/J空欄が下流の図書館表示・検索と既存の監査ポリシーに適合するかを受入判定する。ログでRISKS/理由を明示し、必要なら信頼できる別個別URLが確認できるまで保留とする。

## 回帰テスト
1. Omny公式個別URLを持つ現行EPはOFFICIAL_PAGEに合格。番組/プレイリストURLや悪意ある外部URLは不合格。
2. Megaphone2番組の実RSS3件はLINK空＋公式enclosureでRSS_ENCLOSURE_ONLYに合格。リンク空でも音声URL不在・トラッカーだけ・別ホストはHOLD。
3. RSSソースと番組の組合せを入れ替えた偽装をHOLD。タイトル空・GUID不正・除外歴・既存GUID・収録日時衝突も既存newEpisodeDecisionでHOLD/EXCLUDED/REGISTERED維持。
4. COPYで3件追加→再実行追加0。I/Jは空、Oには公式enclosure、AF/AG/AYにRSS出典を保持。V/Wと出演者の抽出・RESIDUE保留も監査する。
5. COPY台帳の変更前後差分は新規3行以外0、旧セル上書き0、P15_INTAKE VERIFIED、pending0、保存カーソル・トリガーには変更なし。

## 次の実装操作
作業者は正本の単一bundle内に関数を正しく統合し、同名関数重複を防ぐ。まずCOPYのスクリプト側でのみ実行し、GitHubにテストコード・結果・before/afterをコミット。本番反映は管理人の別途承認が必要。
