/**
 * 蔵同期の起動係（#504）— 単体の Google Apps Script。
 *
 * なぜ要るか: GitHub の定時実行（cron）は混雑すると遅れたり飛ばされたりする。
 *   11/21〜24 の朝は、予定の回がほとんど動かなかった（#495）。
 *   一方、V2 台帳への新着の取り込み（P25V2_D1_日次実行）は毎朝 6:41 ごろ GAS で確実に動いている。
 *   そこで、時刻どおりに動く GAS の側から GitHub の「蔵の同期」を起こす。
 *
 * することは1つだけ: GitHub の Library V2 sync（library-v2-sync.yml）を起動する。
 *   台帳・シートには一切さわらない（読みも書きもしない）。同期は変化が無ければ何もしない作りなので、何度起こしても安全。
 *
 * 準備（管理人が一度だけ）:
 *   1. GitHub で「Fine-grained personal access token」を作る
 *      - Repository access: Only select repositories → Neyito96/asarisunowa だけ
 *      - Permissions: Actions = Read and write（ほかは付けない）
 *   2. このファイルを新しい GAS プロジェクトに貼る
 *   3. プロジェクトの設定 → スクリプト プロパティ に GITHUB_TOKEN = （1 のトークン）を入れる
 *      ※トークンはここ以外に書かない・貼らない（GitHub・チャット・シートに出さない）
 *   4. K1_試しに起動 を実行 → 「OK」と出て、GitHub の Actions に Library V2 sync が1件増えれば成功
 *   5. K2_トリガー設置 を実行（毎時1回＋毎朝7時台の1回）
 * 止めるとき: K9_トリガー削除
 */
var KICK_REPO_ = 'Neyito96/asarisunowa';
var KICK_WORKFLOW_ = 'library-v2-sync.yml';

function kickSync_(why) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN が未設定（スクリプト プロパティに入れてください）');
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + KICK_REPO_ + '/actions/workflows/' + KICK_WORKFLOW_ + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var out = { at: new Date().toISOString(), why: why, status: code === 204 ? 'OK' : 'NG', http: code };
  if (code !== 204) out.body = String(res.getContentText()).slice(0, 300);   // トークンは含まれない
  Logger.log(JSON.stringify(out));
  if (code !== 204) throw new Error('GitHub の起動に失敗 HTTP ' + code + '（トークンの期限・権限を確認）');
  return out;
}

function K1_試しに起動() { return kickSync_('手動の試し'); }
function K_定時起動() { return kickSync_('定時'); }   // トリガーから呼ばれる

function K2_トリガー設置() {
  K9_トリガー削除();
  ScriptApp.newTrigger('K_定時起動').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('K_定時起動').timeBased().everyDays(1).atHour(7).nearMinute(0).create();   // 6:41 の新着取り込みのすぐ後
  var n = ScriptApp.getProjectTriggers().length;
  Logger.log('トリガー ' + n + ' 本（毎時1回＋毎朝7時台）');
  return { status: 'INSTALLED', triggers: n };
}

function K9_トリガー削除() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'K_定時起動') { ScriptApp.deleteTrigger(t); n++; } });
  return { status: 'OK', deleted: n };
}
