# Phase15本番最小差分｜Megaphone link空対応（適用前レビュー用）

2026-10-30。対象：本番Phase15AutonomousBundle.gs内の P15_AUTO の newEpisodeDecision と intake。単独の Phase15MegaphoneFix.gs に置くだけでは**本体は変化しない**。本番編集前にファイル内容をバックアップ。**書込は1GUIDだけの既存 trialOneを使う**。既存のトリガーには触れない。

## 差分1 newEpisodeDecision の個別URL判定（既存1行のみ置換）

置換前：
~~~javascript
 if(!/^https:\/\/(?:omny\.fm|www\.omny\.fm)\/shows\/[^/?#]+\/[^/?#]+(?:[?#].*)?$/.test(str(x.link))||/\/playlists\//.test(x.link))return {state:'HOLD',reason:'OFFICIAL_EPISODE_URL_MISSING_OR_UNVERIFIED'};
~~~
置換後：
~~~javascript
 var loc=p15MegaphoneVerifiedLocator(x);
 if(!loc.ok)return {state:'HOLD',reason:loc.reason};
~~~

※ 本番にすでに追加済みのグローバル関数 p15MegaphoneVerifiedLocator を呼ぶ。13テスト合格が確認されたもの。コピー元の別の同名関数と二重定義しない。

## 差分2 新規行に個別URLを入れる処理（I/J2項目のみ）

置換前：
~~~javascript
 row[8]=x.link;row[9]=x.link;
~~~
置換後：
~~~javascript
 var loc=p15MegaphoneVerifiedLocator(x);
 if(!loc.ok)throw Error('LOCATOR_STATE_CHANGED');
 row[8]=loc.mode==='OFFICIAL_PAGE'?loc.url:'';
 row[9]=loc.mode==='OFFICIAL_PAGE'?loc.url:'';
~~~

既存の row[0]-row[7], row[31]等の代入、GUID一意、除外/予約、5万文字制限、POSTWRITE照合は変更しない。I/J空欄は確認済みの仕様として扱い、RSS/出典AS/AG/AYとenclosure音源Oを台帳に残す。後日、公式個別ページが見つかるまでI/Jに推測URLを作らない。

## STOP/本番1件試験
- 必ず直前に READ_ONLY preflight/recovery と P15_INTAKE 予約状態を確認。エラーなら停止。
- 編集後、関数 p15MegaphoneRunSafetyTest で13件再合格、p15AutonomousPreflight の結果を確認。朝の既存自動トリガーの修正・増設は禁止。
- **一件限定**の既存 p15AutonomousTrialOne を用いる。P15_TRIAL_GUID=4ea6480a-ccfd-11f1-b2de-17a1ce8dc9d8、P15_TRIAL_APPROVED=YES はユーザーが直前に明示設定。成功/失敗の後は即NOに戻す。
- P15_INTAKE=VERIFIED、追加数1、次EP-IDと55列、I/J空欄、O音声、AS公式RSS、GUID重複なし、P15_RETRYの旧保留と状態を確認。再実行時 added=0 を確認（その際にもapprovalが必要）。
- 失敗やIDENTITY_CONFLICT等があれば、2件目・本番Tickの手動連続実行はしない。

**重要：** 本資料は本番へ直接自動適用されていません。13件合格は純粋関数テストであり、統合版の動作未検証。登録前に管理人の1件限定操作を要する。
