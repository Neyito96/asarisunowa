// 概要欄清掃ロボV4の試験。合成した原文（正解を作り方から知っている独立の正解セット）120件で精度を測る。実在の本文は使わない。
// ＋ 配布GAS（gas/summary-cleaner/dist）を GAS 模擬環境で通しで動かす（模擬PASS ≠ 実機確認）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { cleanV4, judgeEpisode, sections, parseCastLine, castCell, relatedCell } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
import { buildCleanerGas } from '../scripts/ledger-v2/build-cleaner-gas.mjs';

// ---- 正解つき合成データの生成（決定的） ----
const HEADS = ['', '【番組内容】', '【番組説明】', '【内容】', '【概要】', '【今回のテーマ】', '［番組内容］', '■番組内容：'];
const REL_HEADS = ['【関連記事】', '【関連リンク】', '[関連記事]', '【まとめてわかる】'];
const STAFF_HEADS = ['【出演・スタッフ】', '【出演者】', '【出演】', '［出演・スタッフ］'];
const PROMOS = ['ご意見・感想・リクエスト https://bit.ly/x1', 'ほかにも多彩な番組を配信中！ http://t.asahi.com/w', 'See omnystudio.com/listener for privacy information.', 'Learn more about your ad choices. Visit megaphone.fm/adchoices', 'X（旧Twitter）はこちら https://x.com/asapoki_x', '番組へのおたよりフォーム https://bit.ly/form1', 'イベント参加者を募集しています https://t.asahi.com/ev'];
function gen(n) {
  const pick = (a, k) => a[(n * 7 + k * 3) % a.length], body = [`合成${n}番の本文です。記者が「話題${n}」を解説します。`];
  if (n % 3 === 0) body.push(`後半はXで話題になった投稿${n}について考えます。`);   // 本編としてのXの話題（消してはいけない）
  if (n % 4 === 0) body.push(`リスナーのおたよりも紹介します（第${n}回）。`);
  const arts = Array.from({ length: n % 4 }, (_, k) => ({ title: `合成記事${n}-${k}の見出し`, url: `https://www.asahi.com/articles/ASZ${String(n).padStart(4, '0')}${k}AAAA.html` }));
  const staff = n % 5 === 4 ? [] : [`合成${n}郎（記者）`, ...(n % 2 ? [`MC 合成${n}子`] : []), ...(n % 6 === 1 ? [`ゲスト${n}さん（作家） https://x.com/guest${n}`] : [])];
  const html = n % 2 === 0;
  const P = (lines) => (html ? '<p>' + lines.join('<br>') + '</p>' : lines.join('\n'));
  const parts = [P([pick(HEADS, 1) + body[0], ...body.slice(1)].filter(Boolean))];
  if (arts.length) parts.push(P([pick(REL_HEADS, 2), ...arts.flatMap((a) => (n % 3 === 1 ? [a.title + ' ' + a.url + '?iref=omny'] : [a.title, a.url + '?iref=omny']))]));
  if (staff.length) parts.push(P([pick(STAFF_HEADS, 3), ...staff]));
  parts.push(P([pick(PROMOS, 4), pick(PROMOS, 5)]));
  if (n % 7 === 0) parts.push(P(['【おねがい】', '番組継続のため、会員登録をお願いします！ http://t.asahi.com/x']));
  return { raw: (html ? '' : '') + parts.join(html ? ' ' : '\n'), body, arts, staff, promos: [pick(PROMOS, 4), pick(PROMOS, 5)] };
}
const CASES = Array.from({ length: 120 }, (_, i) => gen(i + 1));

test('独立の正解セット120件: 本文の取りこぼし0・宣伝の残り0・関連記事は見出し＋URLの組が完全一致・出演者（リンク含む）の取りこぼし0', () => {
  let bodyNeed = 0, bodyHit = 0, promoNeed = 0, promoLeft = 0, artNeed = 0, artExact = 0, artExtra = 0, castNeed = 0, castHit = 0, linkNeed = 0, linkHit = 0;
  for (const c of CASES) {
    const r = cleanV4(c.raw);
    for (const b of c.body) { bodyNeed++; if (r.text.includes(b)) bodyHit++; }
    for (const p of c.promos) { promoNeed++; const core = p.replace(/https?:\/\/\S+/g, '').trim().slice(0, 12); if (core && r.text.includes(core)) promoLeft++; }
    for (const a of c.arts) { artNeed++; if (r.related.some((x) => x.url === a.url && x.title === a.title)) artExact++; }
    artExtra += r.related.filter((x) => !c.arts.some((a) => a.url === x.url)).length;
    for (const s of c.staff) { castNeed++; const nm = s.replace(/https?:\/\/\S+/, '').replace(/[（(].*$/, '').replace(/^MC\s*/, '').trim(); if (r.cast.some((x) => x.name.includes(nm))) castHit++;
      const u = (s.match(/https?:\/\/\S+/) || [])[0]; if (u) { linkNeed++; if (r.cast.some((x) => x.links.includes(u))) linkHit++; } }
    assert.ok(!/https?:|<|&nbsp;|iref=/.test(r.text), 'URL・タグ残り ' + c.raw.slice(0, 40));
  }
  if (process.env.SC4_DEBUG) for (const c of CASES) { const r = cleanV4(c.raw); for (const s of c.staff) { const nm = s.replace(/https?:\/\/\S+/, '').replace(/[（(].*$/, '').replace(/^MC\s*/, '').trim(); if (!r.cast.some((x) => x.name.includes(nm))) console.log('MISS', nm, JSON.stringify(c.raw.slice(-260)), JSON.stringify(r.cast)); } }
  const m = { bodyRecall: bodyHit / bodyNeed, promoLeft, artPairRecall: artExact / artNeed, artExtra, castRecall: castHit / castNeed, castLinkRecall: linkHit / linkNeed, n: CASES.length };
  console.log('SC4 metrics', JSON.stringify(m));
  assert.equal(m.bodyRecall, 1); assert.equal(promoLeft, 0); assert.equal(m.artPairRecall, 1); assert.equal(artExtra, 0); assert.equal(m.castRecall, 1); assert.equal(m.castLinkRecall, 1);
});

test('見出しの揺れ（全半角・括弧・コロン）を境界として扱い、本文系の見出しは中身を残す', () => {
  for (const h of HEADS.filter(Boolean)) { const r = cleanV4(`${h}本文の一行目。\n【出演】\n合成太郎（記者）`); assert.equal(r.text, '本文の一行目。', h); assert.equal(r.cast[0].name, '合成太郎'); }
  assert.deepEqual(sections('前文\n【関連記事】\n見出し\nhttps://www.asahi.com/articles/A.html').map((s) => s.kind), ['body', 'related']);
});

test('出演者: 役割・氏名・所属・リンクを分ける。氏名は推定しない', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parseCastLine('MC・音源編集　山根久美子（大阪ネットワーク報道本部）https://t.asahi.com/wqun'))), { role: 'MC・音源編集', name: '山根久美子', note: '大阪ネットワーク報道本部', links: ['https://t.asahi.com/wqun'], raw: 'MC・音源編集　山根久美子（大阪ネットワーク報道本部）https://t.asahi.com/wqun' });
  assert.equal(parseCastLine('神田大介（MC、音源編集） https://bit.ly/4k4ZKwA').role, 'MC、音源編集');
  const r = cleanV4('本文。\n【出演・スタッフ】\n松本龍三郎（スポーツ部） https://x.com/asahi_b ／ https://buff.ly/l\nMC 堀江麻友');
  assert.deepEqual(r.cast[0].links, ['https://x.com/asahi_b', 'https://buff.ly/l']); assert.equal(castCell(r.cast).split('\n').length, 2);
});

test('本編としてのX・イベントの話題は残す／宣伝のリンク・応募フォームは除く／見出しのない記事URLは要確認', () => {
  const r = cleanV4('Xで炎上した投稿をめぐり、記者が経緯を解説します。\nイベント会場の混乱について取材しました。\n応募フォームはこちら https://forms.gle/abc\nフォローしてね https://x.com/acct');
  assert.ok(r.text.includes('Xで炎上した投稿')); assert.ok(r.text.includes('イベント会場の混乱')); assert.ok(!r.text.includes('応募フォーム')); assert.ok(!r.text.includes('フォロー'));
  const q = cleanV4('本文。\n【関連記事】\nhttps://www.asahi.com/articles/ONLYURL.html'); assert.ok(q.holds.includes('RELATED_URL_WITHOUT_TITLE')); assert.equal(judgeEpisode('本文。\n【関連記事】\nhttps://www.asahi.com/articles/ONLYURL.html', {}).verdict !== '自動検査合格・目視未確認', true);
});

test('既存値の保護: 旧自動清掃と同じ値・空欄だけ書換可。手で直した値は書かず要確認。同一なら書換なし', () => {
  const raw = '<p>本文です。合成の話。</p><p>ほかにも多彩な番組を配信中！ http://t.asahi.com/w</p><p>【出演・スタッフ】<br>合成太郎（記者）</p>';
  const blank = judgeEpisode(raw, {}); assert.ok(blank.writable.summary); assert.equal(blank.compare, '旧空欄');
  assert.equal(judgeEpisode(raw, { summary: '本文です。合成の話。\nほかにも多彩な番組を配信中！ http://t.asahi.com/w' }).writable.summary, true);   // 原文から取り出しただけの旧値（宣伝残り）は更新してよい
  const manual = judgeEpisode(raw, { summary: '人が手で整えた概要。' }); assert.equal(manual.writable.summary, false); assert.equal(manual.verdict, '要確認'); assert.match(manual.reason, /MANUAL_EDIT_PROTECTED/);
  const same = judgeEpisode(raw, { summary: blank.clean.text, cast: castCell(blank.clean.cast) }); assert.equal(same.compare, '同一'); assert.equal(same.writable.summary, false); assert.equal(same.writable.cast, false);
  assert.ok(judgeEpisode(raw, { cast: '神田大介' }).findings.length >= 0);
  assert.equal(judgeEpisode('', {}).verdict, 'HOLD'); assert.equal(relatedCell([{ url: 'a' }, { url: 'b' }]), 'a b');
});

// ---- 配布GASの模擬通し ----
const SRC = fs.readFileSync('gas/summary-cleaner/dist/SummaryCleaner.js', 'utf8'), COPY = '1WTLcaveWG0mr9F0dIjyCL8daxFnpo4q4yADN_bnK1PY', V2W = '1ZAl4QpQ4i5ycyPy1qVNtT-Ke2nsSHhWGFkAH3xedAbc';
function mkSheet(rows) { const st = { rows: rows.map((r) => [...r]) }, get = (r, c) => String((st.rows[r - 1] || [])[c - 1] ?? ''), put = (r, c, x) => { while (st.rows.length < r) st.rows.push([]); st.rows[r - 1][c - 1] = x; };
  const rng = (r, c, nr = 1, nc = 1) => ({ getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => get(r + i, c + j))), getDisplayValue: () => get(r, c), setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => put(r + i, c + j, x))), setValue: (x) => put(r, c, x), setNumberFormat() {} });
  return { st, getLastRow: () => st.rows.length, getLastColumn: () => Math.max(1, ...st.rows.map((r) => r.length)), getRange: rng, setFrozenRows() {}, clear: () => { st.rows = []; } }; }
function env(feedXml) {
  const box = { module: { exports: {} } }; vm.runInNewContext(fs.readFileSync('scripts/google-apps-script/P25V2IngestAdapter.js', 'utf8'), box); const H = [...box.module.exports.HEADERS];
  const row = (ep, g, n) => { const r = H.map(() => ''); r[0] = ep; r[H.indexOf('番組')] = 'ニュースの学校'; r[H.indexOf('公式GUID')] = g; r[H.indexOf('概要（清掃済）')] = n || ''; return r; };
  const G = (i) => 'cccccccc-0000-4000-8000-00000000000' + i;
  const mkBook = (id, name) => ({ id, name, sheets: { 'V2・統合台帳': mkSheet([H, row('EP-1', G(1)), row('EP-2', G(2), '人が直した概要'), row('EP-3', G(3))]) } });
  const books = { [COPY]: mkBook(COPY, '【COPY試験】X'), [V2W]: mkBook(V2W, 'V2作業用') }, props = {}, logs = [];
  const g = { Date, JSON, Math, Logger: { log: (s) => logs.push(s) },
    SpreadsheetApp: { openById: (id) => { const b = books[id]; if (!b) throw new Error('UNEXPECTED_OPEN ' + id); return { getId: () => id, getName: () => b.name, getSheetByName: (n) => b.sheets[n] || null, insertSheet: (n) => (b.sheets[n] = mkSheet([])) }; }, flush() {} },
    UrlFetchApp: { fetch: (u) => ({ getResponseCode: () => 200, getContentText: () => (/TASC5851398719/.test(u) ? feedXml(G) : '<rss><channel></channel></rss>') }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, ScriptApp: { getProjectTriggers: () => [] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    Utilities: { sleep() {}, DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)) } };
  vm.runInNewContext(SRC, g); return { g, books, H, run: (f) => JSON.parse(JSON.stringify(vm.runInNewContext(f + '()', g))) };
}
const RAWX = (t) => `<p>${t}の本文です。</p><p>ほかにも多彩な番組を配信中！ http://t.asahi.com/w</p><p>【関連記事】<br>${t}の記事見出し<br>https://www.asahi.com/articles/AS${t === '一' ? 'X1' : 'X2'}.html?iref=omny</p>`;
const FEED = (G) => `<rss><channel><item><title>A</title><guid>${G(1)}</guid><pubDate>Tue, 10 Nov 2026 19:00:00 GMT</pubDate><description><![CDATA[${RAWX('一')}]]></description></item><item><title>B</title><guid>${G(2)}</guid><pubDate>Tue, 10 Nov 2026 19:00:00 GMT</pubDate><description><![CDATA[${RAWX('二')}]]></description></item></channel></rss>`;

test('配布GAS: 再生成と一致・実行一覧は S0〜S9 だけ・収蔵の入口は出さない・トリガー作成なし', () => {
  assert.equal(SRC, buildCleanerGas()['SummaryCleaner.js']);
  const pub = [...SRC.matchAll(/^function ([^\s(]+)\(/gm)].map((m) => m[1]).filter((n) => /^[A-Z]/.test(n) && !/_$/.test(n));   // モジュール内部（即時関数の中）の関数は実行一覧に出ない
  assert.deepEqual(pub, ['S0_進捗', 'S1_点検', 'S2_清掃監査', 'S3A_COPYへ反映_試験10件', 'S3B_COPYへ反映_全件', 'S4_V2作業用へ反映', 'S9_直前の反映を取消', 'S8_診断']);
  assert.ok(!/newTrigger|DriveApp|MailApp/.test(SRC)); assert.ok(!/function\s+do(Get|Post)\b/.test(SRC));
});

test('配布GAS模擬: 点検→清掃監査（結果シート・進捗）→再実行は差分0→COPY反映（手動値は守る）→V2作業用は人の確認OKだけ→取消で元に戻る', () => {
  const e = env(FEED), copyL = e.books[COPY].sheets['V2・統合台帳'].st.rows, N = e.H.indexOf('概要（清掃済）'), P = e.H.indexOf('関連記事URL');
  assert.equal(e.run('S1_点検').status, 'CHECK_OK');
  const s2 = e.run('S2_清掃監査'); assert.equal(s2.done, true); assert.equal(s2.updated, 3);
  const res = e.books[COPY].sheets['清掃・結果'].st.rows, Hh = res[0];
  const r1 = res.find((r) => r[0] === 'EP-1'), r2 = res.find((r) => r[0] === 'EP-2'), r3 = res.find((r) => r[0] === 'EP-3');
  assert.equal(r1[Hh.indexOf('判定')], '自動検査合格・目視未確認'); assert.equal(r1[Hh.indexOf('新・概要')], '一の本文です。'); assert.deepEqual(JSON.parse(r1[Hh.indexOf('関連記事JSON(見出し+URL)')]).map((x) => [x.title, x.url]), [['一の記事見出し', 'https://www.asahi.com/articles/ASX1.html']]);
  assert.equal(r2[Hh.indexOf('判定')], '要確認'); assert.match(r2[Hh.indexOf('理由')], /MANUAL_EDIT_PROTECTED/); assert.equal(r3[Hh.indexOf('判定')], 'HOLD');
  const snap = JSON.stringify(res); const again = e.run('S2_清掃監査'); assert.equal(again.updated, 0); assert.equal(JSON.stringify(res), snap);   // 再実行で差分0
  copyL[1][N] = '一の本文です。';   // 前回の反映が途中で止まり、書けたのに履歴が無い状態を再現
  const a = e.run('S3A_COPYへ反映_試験10件'); assert.equal(a.status, 'OK'); assert.equal(a.recoveredHistory, 1); assert.equal(e.books[COPY].sheets['清掃・反映履歴'].st.rows.filter((r) => r[7] === 'OK(回収)').length, 1);
  assert.equal(copyL[1][N], '一の本文です。'); assert.equal(copyL[1][P], 'https://www.asahi.com/articles/ASX1.html'); assert.equal(copyL[2][N], '人が直した概要'); assert.equal(copyL[3][N], '');
  assert.equal(e.run('S3B_COPYへ反映_全件').status, 'OK_NO_CHANGE');
  const v2 = e.books[V2W].sheets['V2・統合台帳'].st.rows, v2snap = JSON.stringify(v2);
  assert.equal(e.run('S4_V2作業用へ反映').cellsWritten, 0); assert.equal(JSON.stringify(v2), v2snap);   // 人の確認なし→書かない
  r1[Hh.indexOf('人の確認')] = 'OK'; const w = e.run('S4_V2作業用へ反映'); assert.equal(w.status, 'OK'); assert.equal(v2[1][N], '一の本文です。');
  const u = e.run('S9_直前の反映を取消'); assert.equal(u.undone, 2); assert.equal(v2[1][N], ''); assert.equal(v2[1][P], '');
  e.g.SC_CONFIG.copyId = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'; assert.throws(() => e.run('S1_点検'), /PROTECTED_TARGET_REFUSED/);
});
