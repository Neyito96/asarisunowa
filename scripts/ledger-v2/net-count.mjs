// 正味の公開エピソード数を決める判定（READ_ONLY・純関数）。2026-11-16 司令塔「正味件数確定・差分解消」。
// 入力: V2・統合台帳の行、おんさ比較シート（番組タブ）、V2・SDGs再配信185件照合、SDGs公式JSON 1,092件。
// 出力: EP-IDごとの判定案（対象／対象案／重複案／保留案／保留／対象外）と根拠。台帳・公開サイト・Spotifyへは書かない。
// 原則: 推測で採用しない。採用は「公式ID（GUID/UUID）または題名+配信日」が独立のおんさ表と一致し、V2内で重複がない場合だけ。
//       再配信は元配信を代表にし、題名（または既存の複合照合）と尺の編集差の範囲で同一内容とみなす（それ以外は保留）。
export const NET_VERSION = 'NET-1';
// 2026-11-16 音声チーム回答（docs/operations/2026-11-16-rebroadcast-policy.md）: 元配信を代表に優先。冒頭・末尾の編集差があっても元配信のみ残してよい。
// そこで「題名・概要・尺の複合照合で高確度一致」かつ尺差が編集差の範囲（120秒以内）なら同一内容とする。それより尺が違う回・有力候補・未発見は保留（推測で除外しない）。
export const EDIT_DIFF_MAX_SEC = 120;
const RERUN = /再放送|再配信|（再）|\(再\)|アンコール|再掲/;   // 「振り返る」は話題の言葉にも使われるので標識にしない
const N = (s) => String(s || '').replace(/[\s　「」『』]/g, '').toLowerCase();
const core = (t) => N(String(t || '').replace(/（再[^）]*）|【再[^】]*】|\(再[^)]*\)|再放送です|再放送|再配信/g, ''));
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
export function dayKey(s) {
  const t = String(s || '').trim(); let m = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) return m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0');
  const d = new Date(t); if (isNaN(d)) return '';
  const j = new Date(d.getTime() + 9 * 3600e3); return j.getUTCFullYear() + '/' + String(j.getUTCMonth() + 1).padStart(2, '0') + '/' + String(j.getUTCDate()).padStart(2, '0');   // おんさ表の RFC 日時（UTC）→ JST の日付
}
const ids = (r) => new Set([r.guid, r.uuid].filter(Boolean).map((x) => String(x).toLowerCase()).concat((String(r.officialUrl || '').toLowerCase().match(/itemid=([0-9a-f-]{36})/) || []).slice(1)));
const cand = (r) => new Set((String(r.basis || '').toLowerCase().match(UUID) || []));
const dur = (r) => { const n = parseInt(r.duration, 10); return isNaN(n) ? null : n; };
const absn = (x) => { const n = Math.abs(parseFloat(x)); return isNaN(n) ? null : n; };

// v2Rows: [{ep, show, title, date, judge, rep, guid, uuid, officialUrl, duration, basis, reason}]
// onsaRows: [{show, title, date, item}]（item = Asahi.com URL の itemid）
// rerun185: [{ep, match, origin, diff}]（V2・SDGs再配信185件照合）
// sdgsOfficial: [uuid]（SDGs公式JSON 1,092件）
export function classifyNet({ v2Rows, onsaRows, rerun185 = [], sdgsOfficial = [], identityOverrides = {} }) {
  const byEp = {}; v2Rows.forEach((r) => { byEp[r.ep] = r; });
  const onId = {}, onTd = {}; onsaRows.forEach((x) => { if (x.item) onId[String(x.item).toLowerCase()] = x; (onTd[N(x.title) + '|' + dayKey(x.date)] = onTd[N(x.title) + '|' + dayKey(x.date)] || []).push(x); });
  const idx = {}, tdx = {};
  v2Rows.forEach((r) => { new Set([...ids(r), ...cand(r)]).forEach((i) => { (idx[i] = idx[i] || []).push(r.ep); }); const k = N(r.title) + '|' + dayKey(r.date); (tdx[k] = tdx[k] || []).push(r.ep); });
  const s185 = {}; rerun185.forEach((x) => { s185[x.ep] = x; });
  const inOnsa = (r) => { for (const i of new Set([...ids(r), ...cand(r)])) if (onId[i]) return 'おんさ:ID一致'; return onTd[N(r.title) + '|' + dayKey(r.date)] ? 'おんさ:題名+日付一致' : ''; };
  const others = (r) => { const s = new Set(); new Set([...ids(r), ...cand(r)]).forEach((i) => (idx[i] || []).forEach((e) => s.add(e))); (tdx[N(r.title) + '|' + dayKey(r.date)] || []).forEach((e) => s.add(e)); s.delete(r.ep); return [...s]; };
  const isT = (e) => byEp[e] && byEp[e].judge === '対象';
  const rows = v2Rows.map((r) => {
    let prop = r.judge, rep = r.rep || r.ep, reason = '';
    const o = inOnsa(r), oth = others(r), othT = oth.filter(isT);
    if (identityOverrides[r.ep]) { const ov = identityOverrides[r.ep]; return { ep: r.ep, show: r.show, now: r.judge, prop: ov.prop, rep: ov.rep || r.ep, reason: ov.reason, onsa: o }; }
    if (r.judge === '対象') {
      const dup = (tdx[N(r.title) + '|' + dayKey(r.date)] || []).filter((e) => e !== r.ep && isT(e));
      if (dup.length) {
        const grp = dup.concat([r.ep]).sort(), pref = grp.filter((e) => r.title.indexOf(byEp[e].show) >= 0); rep = (pref.length ? pref : grp)[0];
        if (rep === r.ep) { prop = '対象'; reason = '同題・同日の組の代表（番組名一致を優先）: ' + dup.join(','); } else { prop = '重複案'; reason = '対象同士で題名・配信日が同じ。代表 ' + rep; }
      } else if (s185[r.ep]) {
        const x = s185[r.ep], d = absn(x.diff);
        if (x.match === '高確度一致' && d !== null && d <= EDIT_DIFF_MAX_SEC && isT(x.origin)) { prop = '重複案'; rep = x.origin; reason = 'SDGs再配信185件照合: 高確度一致・尺差' + x.diff + '秒（編集差の範囲）→ 元配信を代表'; }
        else { prop = '保留案'; reason = 'SDGs再配信185件照合: ' + (x.match || '未照合') + '・尺差' + x.diff + '秒（同一内容は未検証）'; }
      } else if (RERUN.test(r.title)) {
        const src = v2Rows.filter((x) => x.ep !== r.ep && isT(x.ep) && core(x.title) === core(r.title));
        const hit = src.find((x) => dur(x) !== null && dur(r) !== null && Math.abs(dur(x) - dur(r)) <= EDIT_DIFF_MAX_SEC);
        if (hit) { prop = '重複案'; rep = hit.ep; reason = '再放送：元配信と題名一致・尺差' + Math.abs(dur(hit) - dur(r)) + '秒（編集差の範囲）'; } else { prop = '保留案'; reason = '再放送の表示あり・元配信と同一の根拠なし'; }
      } else { prop = '対象'; reason = '現判定どおり'; }
    } else if (r.judge === '対象外') {
      if (r.rep && r.rep !== r.ep && isT(r.rep)) reason = '代表が対象（重複として除外を維持）'; else { prop = '保留'; reason = '代表EP-IDが対象でない'; }
    } else {
      if (r.rep && r.rep !== r.ep && isT(r.rep) && core(r.title) === core(byEp[r.rep].title)) { prop = '重複案'; rep = r.rep; reason = '代表EP-ID（対象）と同題'; }
      else if (othT.length) { prop = '重複案'; rep = othT[0]; reason = '同じ公式ID／題名・配信日の対象行あり'; }
      else if (RERUN.test(r.title)) {
        const src = v2Rows.filter((x) => x.ep !== r.ep && isT(x.ep) && core(x.title) === core(r.title));
        const hit = src.find((x) => dur(x) !== null && dur(r) !== null && Math.abs(dur(x) - dur(r)) <= EDIT_DIFF_MAX_SEC);
        if (hit) { prop = '重複案'; rep = hit.ep; reason = '再放送：元配信と題名一致・尺差' + Math.abs(dur(hit) - dur(r)) + '秒（編集差の範囲）'; } else { prop = '保留'; reason = '再放送の表示あり・元配信と同一の根拠なし'; }
      } else if (o && !oth.length) { prop = '対象案'; reason = o + '・V2内で公式ID／題名・配信日の重複なし'; }
      else { prop = '保留'; reason = oth.length ? 'V2内に同じID／題名の行あり（対象ではない）: ' + oth.join(',') : 'おんさ表に無く、公式との対応も未確認'; }
    }
    return { ep: r.ep, show: r.show, now: r.judge, prop, rep, reason, onsa: o };
  });
  // おんさ表にあって V2 に無い回（欠落）
  const v2Ids = new Set(), v2Td = new Set(); v2Rows.forEach((r) => { new Set([...ids(r), ...cand(r)]).forEach((i) => v2Ids.add(i)); v2Td.add(N(r.title) + '|' + dayKey(r.date)); });
  const num = (t) => (String(t || '').normalize('NFKC').match(/#\s*(\d+)/) || [])[1] || '';
  const v2DayNum = new Set(v2Rows.filter((r) => num(r.title)).map((r) => dayKey(r.date) + '|' + num(r.title)));   // 題名の言い回しだけ違う回（同じ配信日・同じ回番号）
  const onsaOnly = onsaRows.filter((x) => !(x.item && v2Ids.has(String(x.item).toLowerCase())) && !v2Td.has(N(x.title) + '|' + dayKey(x.date)) && !(num(x.title) && v2DayNum.has(dayKey(x.date) + '|' + num(x.title))));
  // SDGs公式1,092件との突き合わせ
  const sdgsSet = new Set(sdgsOfficial.map((u) => String(u).toLowerCase()));
  const sdgsMissing = [...sdgsSet].filter((u) => !v2Ids.has(u) && !Object.values(identityOverrides).some((ov) => String(ov.officialUuid || '').toLowerCase() === u));
  const net = rows.filter((x) => x.prop === '対象' || x.prop === '対象案');
  const count = (arr, f) => arr.reduce((a, x) => { const k = f(x); a[k] = (a[k] || 0) + 1; return a; }, {});
  return { version: NET_VERSION, rows, onsaOnly, sdgsMissing, summary: { ledgerRows: v2Rows.length, net: net.length, netByShow: count(net, (x) => x.show), transitions: count(rows, (x) => x.now + '→' + x.prop), props: count(rows, (x) => x.prop), onsaOnly: onsaOnly.length, sdgsOfficial: sdgsSet.size, sdgsMissingInV2: sdgsMissing.length } };
}

// 2026-11-16 照合で根拠が揃った個別の同一性（人が読める根拠つき。自動の基準は緩めない）
export const NET_IDENTITY_OVERRIDES = {
  'EP-06532': { prop: '対象案', officialUuid: 'fbfa9f2d-821c-4c38-96cc-b4aa00974842', reason: 'SDGs公式JSON fbfa9f2d（#1045表記）と題名・配信日時（2026/03/13 04:00）・長さ1467秒が一致し、おんさ表も同じ回を fbfa9f2d に紐付け。旧UUID 95071574 は同じ回の旧公式URL' },
};
