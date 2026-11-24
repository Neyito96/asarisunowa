// 朝リスの輪 GAS配達係（2026-11-24・Issue #526）
// GitHub の main にある scripts/google-apps-script/ を、本番GAS「朝リスの輪 プレイリスト投稿受付」へ自動で届ける。
// ・本番とは別のプロジェクトとして置く（本番の権限設定 appsscript.json は変えない）。
// ・本番にだけあるファイルは消さずに残す。本番の appsscript.json は自動では変えない（変わっていたら報告だけ）。
// ・届けた後、投稿受付の窓口（ウェブアプリ）を新しい版に更新する（URLは変わらない）。
// ・毎時の時計で GitHub の新しい変更を見つけたら届ける。止めたい時は Script Property DELIVERY_STOP に理由を書く。
// 使い方（最初の1回だけ）: DELIVERY_DRY_RUN → 結果を確認 → DELIVERY_APPLY_NOW → DELIVERY_INSTALL_HOURLY

var DELIVERY_TARGET_SCRIPT_ID = '1HpZNp96TQ7S1ilmfyItKI2IxYgdk8ufCsWXSVNEaGkh7_uQRXkr6k1I9';
var DELIVERY_WEBAPP_DEPLOYMENT_ID = 'AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug';
var DELIVERY_REPO = 'Neyito96/asarisunowa';
var DELIVERY_DIR = 'scripts/google-apps-script';
var DELIVERY_BRANCH = 'main';
var DELIVERY_API = 'https://script.googleapis.com/v1/projects/';

function deliveryFetch_(url, options) {
  var res = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options || {}));
  var code = res.getResponseCode(), text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' ' + url.replace(/\?.*/, '') + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : {};
}
function deliveryGoogle_(method, path, body) {
  return deliveryFetch_(DELIVERY_API + path, {
    method: method, contentType: 'application/json', payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
}
function deliveryGithubHeadSha_() {
  var c = deliveryFetch_('https://api.github.com/repos/' + DELIVERY_REPO + '/commits?path=' + encodeURIComponent(DELIVERY_DIR) + '&sha=' + DELIVERY_BRANCH + '&per_page=1',
    { headers: { Accept: 'application/vnd.github+json' } });
  return c && c[0] && c[0].sha || '';
}
// GitHub の .js と appsscript.json を { name, type, source } に（.md などは届けない）
function deliveryGithubFiles_(sha) {
  var list = deliveryFetch_('https://api.github.com/repos/' + DELIVERY_REPO + '/contents/' + DELIVERY_DIR + '?ref=' + sha, { headers: { Accept: 'application/vnd.github+json' } });
  return list.filter(function (f) { return f.type === 'file' && (/\.js$/.test(f.name) || f.name === 'appsscript.json'); }).map(function (f) {
    var raw = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + DELIVERY_REPO + '/' + sha + '/' + DELIVERY_DIR + '/' + encodeURIComponent(f.name), { muteHttpExceptions: true });
    if (raw.getResponseCode() !== 200) throw new Error('GitHubからファイルを取れません: ' + f.name);
    return { name: f.name.replace(/\.(js|json)$/, ''), type: f.name === 'appsscript.json' ? 'JSON' : 'SERVER_JS', source: raw.getContentText() };
  });
}
function deliveryNorm_(s) { return String(s || '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, ''); }

// 純粋: 届ける中身と差分。本番だけのファイルは残し、本番の appsscript.json はそのまま使う
function deliveryPlan_(current, github) {
  var cur = {}, gh = {}, out = { added: [], changed: [], same: 0, keptTargetOnly: [], manifestDiffers: false, files: [] };
  current.forEach(function (f) { cur[f.name] = f; });
  github.forEach(function (f) { gh[f.name] = f; });
  github.forEach(function (f) {
    var c = cur[f.name];
    if (f.type === 'JSON') { out.manifestDiffers = !c || deliveryNorm_(c.source) !== deliveryNorm_(f.source); return; }
    if (!c) out.added.push(f.name); else if (deliveryNorm_(c.source) !== deliveryNorm_(f.source)) out.changed.push(f.name); else out.same += 1;
    out.files.push({ name: f.name, type: f.type, source: f.source });
  });
  current.forEach(function (c) {
    if (c.type === 'JSON') { out.files.push({ name: c.name, type: c.type, source: c.source }); return; }   // 本番の権限設定はそのまま
    if (!gh[c.name]) { out.keptTargetOnly.push(c.name); out.files.push({ name: c.name, type: c.type, source: c.source }); }
  });
  return out;
}

function deliveryPrepare_() {
  var sha = deliveryGithubHeadSha_();
  if (!sha) throw new Error('GitHubの最新版を確認できません');
  var current = deliveryGoogle_('get', DELIVERY_TARGET_SCRIPT_ID + '/content').files || [];
  var plan = deliveryPlan_(current, deliveryGithubFiles_(sha));
  plan.sha = sha;
  return plan;
}
function deliverySummary_(plan) {
  return { sha: plan.sha.slice(0, 7), added: plan.added, changed: plan.changed, same: plan.same, keptTargetOnly: plan.keptTargetOnly, manifestDiffers: plan.manifestDiffers };
}

function deliveryApply_(plan, why) {
  if (!plan.added.length && !plan.changed.length) return { status: 'NO_CHANGE', summary: deliverySummary_(plan) };
  deliveryGoogle_('put', DELIVERY_TARGET_SCRIPT_ID + '/content', { files: plan.files });
  var version = deliveryGoogle_('post', DELIVERY_TARGET_SCRIPT_ID + '/versions', { description: 'GitHub ' + plan.sha.slice(0, 7) + ' ' + why });
  deliveryGoogle_('put', DELIVERY_TARGET_SCRIPT_ID + '/deployments/' + DELIVERY_WEBAPP_DEPLOYMENT_ID, {
    deploymentConfig: { scriptId: DELIVERY_TARGET_SCRIPT_ID, versionNumber: version.versionNumber, manifestFileName: 'appsscript', description: 'GitHub ' + plan.sha.slice(0, 7) }
  });
  var P = PropertiesService.getScriptProperties();
  P.setProperty('DELIVERY_LAST_SHA', plan.sha);
  var log = { at: new Date().toISOString(), why: why, version: version.versionNumber, summary: deliverySummary_(plan) };
  P.setProperty('DELIVERY_LAST_LOG', JSON.stringify(log).slice(0, 8000));
  return { status: 'DELIVERED', log: log };
}

// 最初に押す: 何が変わるかを見るだけ（本番は変えない）
function DELIVERY_DRY_RUN() { var s = deliverySummary_(deliveryPrepare_()); Logger.log(JSON.stringify(s, null, 1)); return s; }
// 確認後に1回押す: 届ける
function DELIVERY_APPLY_NOW() { var r = deliveryApply_(deliveryPrepare_(), '手動'); Logger.log(JSON.stringify(r, null, 1)); return r; }
// 毎時の時計（DELIVERY_INSTALL_HOURLY で設置）
function deliveryHourly() {
  var P = PropertiesService.getScriptProperties();
  if (P.getProperty('DELIVERY_STOP')) return { status: 'STOPPED', reason: P.getProperty('DELIVERY_STOP') };
  var sha;
  try { sha = deliveryGithubHeadSha_(); } catch (e) {
    if (/HTTP (403|429)/.test(String(e))) return { status: 'GITHUB_BUSY_RETRY_NEXT_HOUR' };   // GitHub の回数制限。次の時間に
    throw e;
  }
  if (!sha || sha === P.getProperty('DELIVERY_LAST_SHA')) return { status: 'UP_TO_DATE' };
  var r = deliveryApply_(deliveryPrepare_(), '自動');
  if (r.status === 'NO_CHANGE') P.setProperty('DELIVERY_LAST_SHA', sha);
  Logger.log(JSON.stringify(r));
  return r;
}
function DELIVERY_INSTALL_HOURLY() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'deliveryHourly') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('deliveryHourly').timeBased().everyHours(1).create();
  Logger.log('毎時の配達を設置しました');
}
function DELIVERY_LAST() { var s = PropertiesService.getScriptProperties().getProperty('DELIVERY_LAST_LOG'); Logger.log(s || 'まだ届けていません'); return s; }

if (typeof module !== 'undefined') module.exports = { deliveryPlan_: deliveryPlan_, deliveryNorm_: deliveryNorm_ };
