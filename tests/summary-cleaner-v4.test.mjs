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
  assert.deepEqual(pub, ['S0_進捗', 'S1_点検', 'S2_清掃監査', 'S3A_COPYへ反映_試験10件', 'S3B_COPYへ反映_全件', 'S4_V2作業用へ反映', 'S9_直前の反映を取消', 'S8_診断', 'S7_抜き取り', 'S5A_V2詳細保全_試験10件', 'S5B_V2詳細保全_全件', 'S6A_V2新着_清掃監査', 'S6B_V2新着_反映', 'S10R_非公式S10の書換を取消', 'S4B_V2作業用へ反映_未合格分のみ', 'S9C_COPY反映の取消_20261112', 'P1_人物索引_予行', 'P2_人物索引_COPY作成', 'P0_承認_人物索引V2', 'P3_人物索引_V2作成', 'P9_人物索引_V2を空に戻す', 'C1_出演者_予行', 'C0_承認_出演者修正', 'C2_出演者_反映', 'C9_出演者修正の取消']);
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
  e.g.SC_CONFIG.v2ApplyLevel = 'HUMAN_OK'; assert.equal(e.run('S4_V2作業用へ反映').cellsWritten, 0); assert.equal(JSON.stringify(v2), v2snap);   // 人の確認なし→書かない
  r1[Hh.indexOf('人の確認')] = 'OK'; const w = e.run('S4_V2作業用へ反映'); assert.equal(w.status, 'OK'); assert.equal(v2[1][N], '一の本文です。'); assert.equal(w.detailRows, 1);
  const det = e.books[V2W].sheets['V2・清掃詳細'].st.rows; assert.equal(det[1][0], 'EP-1'); assert.deepEqual(JSON.parse(det[1][2]).map((x) => x.title), ['一の記事見出し']);   // V2側にも見出し＋URLの組を保持
  const u = e.run('S9_直前の反映を取消'); assert.equal(u.undone, 2); assert.equal(v2[1][N], ''); assert.equal(v2[1][P], '');
  assert.equal(det[1][7], '自動検査合格・目視未確認'); assert.equal(det[1][9], '取得');
  e.g.SC_CONFIG.copyId = '1lLgLzgDNkLN_8ok967u9lu9i1S3yRJTMibXFO5-2FG4'; assert.throws(() => e.run('S1_点検'), /PROTECTED_TARGET_REFUSED/);
});

test('配布GAS模擬: S5 は V2作業用の収蔵詳細に原文、清掃詳細に全EPの構造化データを保存（台帳34列・COPYだけの回は触らない・原文は上書きしない・再実行差分0）', () => {
  const e = env(FEED); e.run('S2_清掃監査');
  const v2b = e.books[V2W].sheets, v2snap = JSON.stringify(v2b['V2・統合台帳'].st.rows);
  e.books[COPY].sheets['V2・統合台帳'].st.rows.push(e.books[COPY].sheets['V2・統合台帳'].st.rows[1].map((x, i) => (i === 0 ? 'EP-9' : x)));   // COPYだけにある回
  e.g.SC_CONFIG.copyId = COPY;
  const a = e.run('S5A_V2詳細保全_試験10件'); assert.equal(a.status, 'OK'); assert.equal(a.raw.added, 3); assert.equal(a.raw.addedMissing, 1); assert.equal(a.detail.rows, 3);
  const raw = v2b['V2・収蔵詳細'].st.rows, det = v2b['V2・清掃詳細'].st.rows;
  assert.equal(raw[0].length, 17); assert.deepEqual(raw.slice(1).map((r) => r[0]), ['EP-1', 'EP-2', 'EP-3']);
  assert.equal(raw[1][4], RAWX('一')); assert.equal(raw[1][5], crypto.createHash('sha256').update(RAWX('一'), 'utf8').digest('hex')); assert.equal(raw[3][4], ''); assert.equal(raw[3][7], '原文なし（欠損）');
  assert.deepEqual(det.slice(1).map((r) => [r[0], r[7], r[9]]), [['EP-1', '自動検査合格・目視未確認', '取得'], ['EP-2', '要確認', '取得'], ['EP-3', 'HOLD', '欠損']]);   // 書き換えない回（要確認・HOLD）も残す
  assert.equal(JSON.stringify(v2b['V2・統合台帳'].st.rows), v2snap);   // 台帳は不変
  const snap = JSON.stringify([raw, det]); const b = e.run('S5B_V2詳細保全_全件'); assert.equal(b.status, 'OK_NO_CHANGE'); assert.equal(JSON.stringify([raw, det]), snap);   // 再実行差分0
  raw[1][4] = '人が残した原文'; raw[1][5] = 'abcd';   // 保全済み原文は RSS が変わっても上書きしない
  const c = e.run('S5B_V2詳細保全_全件'); assert.equal(c.raw.rssChangedLogged, 1); assert.equal(raw[1][4], '人が残した原文'); assert.equal(v2b['V2・原文変化履歴'].st.rows.length, 2);
  assert.equal(e.run('S5B_V2詳細保全_全件').raw.rssChangedLogged, 0);   // 同じ変化は二重に記録しない
});

// ---- Issue #308 品質改善（2026-11-12 実機で見つかった型）。合成原文のみ ----
const P = (...ps) => ps.map((x) => '<p>' + x.join('<br>') + '</p>').join(' ');
const STAFF = ['【出演・スタッフ】', '架空太郎（経済部）https://buff.ly/aaa', 'MC　仮名花子', '音源編集　試験次郎'];
const REL = ['【関連記事】', '架空の見出しその一', 'https://www.asahi.com/articles/ASX0001.html?iref=omny'];
const TAIL = ['【朝ポキ情報】', 'おたよりフォーム https://bit.ly/asapoki_otayori'];
test('型1 見出しの後に文が続くキャンペーン告知は本文に残らない（秋トク型）', () => {
  const raw = P(['【秋トクキャンペーン 11月18日まで】架空コースを初めて申し込む方限定！月額100円', 'https://digital.asahi.com/pr/cp/x/?ref=cp', '', '【番組内容】', '架空の園で忘れ物をした子に先生は宝探しを提案しました。', '※2026年9月17日に収録しました'], REL, STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/キャンペーン|月額100円/.test(j.clean.text)); assert.match(j.clean.text, /宝探し/);
  assert.equal(j.clean.related.length, 1); assert.equal(j.clean.related[0].title, '架空の見出しその一');
  assert.ok(!j.findings.some((f) => /OVER_DELETION|UNDER_DELETION/.test(f)), j.reason);
});
test('型2 番組内容の「お便りをいただきました」を宣伝と誤認しない／冒頭の★新番組告知は消す', () => {
  const raw = P(['★新番組「架空そうだんしつ」をはじめます！', 'そこで質問を募集します。', 'ぜひお寄せください。https://t.asahi.com/xxxx'], ['【番組内容】', 'メーカー勤務のリスナーさんから、原料不足に関するお便りをいただきました。政府の説明と食い違う理由をひもときました。', '※2026年6月10日に収録しました。'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.match(j.clean.text, /お便りをいただきました/); assert.ok(!/新番組|募集/.test(j.clean.text));
  assert.notEqual(j.verdict, '不合格', j.reason);
});
test('型3 イベント告知（見出しだけの行）を消しても監査が本文消失と誤判定しない', () => {
  const raw = P(['【祝・1億DL！　5/31（土）イベント】', '記念グッズを大放出。公開収録やクイズも！', '架空一郎、試験二郎に朝ポキメンバーも多数参加。', 'https://ciy.digital.asahi.com/ciy/0000'], ['【番組内容】', '1936年の架空事件について、当時の通信傍受の経緯を解説します。'], ['※2025年4月4日に収録しました。全3回の3本目です'], REL, STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/記念グッズ|架空一郎/.test(j.clean.text)); assert.match(j.clean.text, /通信傍受/);
  assert.ok(!j.findings.some((f) => /OVER_DELETION|LOST_PROPER_NOUN|PARTIAL_DELETION/.test(f)), j.reason);
});
test('型4 ★フォロー告知の氏名行は本文に入れず、出演者に無い人だけ出演者へ保全', () => {
  const raw = P(['★みなさまからの質問、お待ちしています https://bit.ly/asapoki_otayori'], ['【番組内容】', '架空の政策用語の定義について素朴な疑問をぶつけました。'], ['★朝日新聞アプリで2人をフォローしてください！', '架空太郎 https://bit.ly/aaa', '仮名三郎 https://bit.ly/bbb'], ['★Q&Aのご感想をお寄せください！', '次回以降の参考にします。', 'こちらのフォームからお願いします↓↓', 'https://forms.example.com/r/zz'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/架空太郎|仮名三郎|次回以降|フォーム/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /素朴な疑問/);
  const names = j.clean.cast.map((c) => c.name);
  assert.equal(names.filter((n) => n === '架空太郎').length, 1); assert.ok(names.includes('仮名三郎')); assert.ok(names.includes('仮名花子'));
  assert.ok(!j.findings.some((f) => /STAFF_IN_BODY|CAST_CONTAMINATED|OVER_DELETION/.test(f)), j.reason);
});
test('<p> の無い原文では★行だけを消し、後続の本文は消さない（段落が分からないときは保守的に）', () => {
  const j = cleanV4('★番組へのご感想をお寄せください\n本編の大事な説明です。続きもあります。');
  assert.match(j.text, /本編の大事な説明/);
});
test('型5 「過去回は下記から」の案内は本文から外す（同じ行の収録日は残す）', () => {
  const raw = P(['【番組内容】', '架空の首脳会談で伝えられた内容の法律的な立て付けを聞きました。'], ['※2026年4月8日に収録しました。「架空談」の過去回は下記からご確認ください', 'https://www.asahi.com/special/podcasts/?pgid=x'], ['「架空談」の過去回は下記からご確認ください', 'https://www.asahi.com/special/podcasts/?pgid=y'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/過去回/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /2026年4月8日に収録しました/);
  assert.ok(!j.findings.some((f) => /OVER_DELETION/.test(f)), j.reason);
});
test('型6 ★月額100円・読み放題などの購読キャンペーンは本文に残さない／「過去の回はこちら」も外す', () => {
  const raw = P(['★月100円で読み放題★（11/18まで）', '架空コース（月額1,980円）が2カ月間は月額100円！※初回限定', 'https://digital.asahi.com/pr/cp/x/'], ['架空大会の展望を担当記者が解説します。', '※2026年9月18日に収録しました。前後編の後編です。過去の回はこちら（ https://www.asahi.com/special/podcasts/?pgid=z ）。'], STAFF, TAIL);
  const j = judgeEpisode(raw, {});
  assert.ok(!/読み放題|月額|初回限定|過去の回/.test(j.clean.text), j.clean.text); assert.match(j.clean.text, /展望を担当記者/); assert.match(j.clean.text, /収録しました/);
});

test('SC4-8: URL文字は固有名詞に数えず、実際の本文固有名詞は保持検査する', () => {
  const raw = '<p>架空の「重要な名前」を説明します。 https://example.org/UniqueToken</p>';
  const j = judgeEpisode(raw); assert.equal(j.verdict, '自動検査合格・目視未確認');
  assert.match(j.clean.text, /重要な名前/);
});
test('SC4-8: 独立した連絡先・SNSラベルを除去し、報道本文は消さない', () => {
  const raw = P(['フォームの運用を取材しました。'], ['ご意見・ご要望（フォーム） https://forms.gle/example ／メール podcast@asahi.com'], ['https://twitter.com/AsahiPodcast （朝ポキ）']);
  const j = judgeEpisode(raw); assert.equal(j.clean.text, 'フォームの運用を取材しました。'); assert.equal(j.verdict, '自動検査合格・目視未確認'); assert.ok(j.clean.socials.includes('https://twitter.com/AsahiPodcast'));
});
test('SC4-8: 他列の手動値を保護して概要のみ合格。手動概要・実際の消失は合格にしない', () => {
  const raw = P(['本文です。'], ['ご意見・ご要望（フォーム） https://forms.gle/example']);
  const j = judgeEpisode(raw, { summary: '本文です。ご意見・ご要望（フォーム） https://forms.gle/example', cast: '人が訂正した出演者' });
  assert.equal(j.verdict, '自動検査合格・目視未確認'); assert.equal(j.writable.summary, true); assert.equal(j.writable.cast, false); assert.match(j.reason, /MANUAL_EDIT_PROTECTED:cast/);
  assert.equal(judgeEpisode(raw, {summary:'人が訂正した概要',cast:'手動出演者'}).verdict, '要確認');
});
test('SC4-8: 同じ行の複数記事を個別の見出しURLペアとして保全', () => {
  const raw = P(['本編の本文。'], ['【関連記事】第一の記事（ https://www.asahi.com/articles/AS1.html ）▽第二の記事（ https://www.asahi.com/articles/AS2.html ）']);
  const j = judgeEpisode(raw); assert.deepEqual(j.clean.related.map(x=>[x.title,x.url]), [['第一の記事','https://www.asahi.com/articles/AS1.html'],['第二の記事','https://www.asahi.com/articles/AS2.html']]); assert.equal(j.verdict,'自動検査合格・目視未確認');
});
test('SC4-8: 宣伝を本文と区別できなければ要確認のまま止める', () => {
  assert.equal(judgeEpisode(P(['本編です。'],['12月にPODCAST MEETINGを開催します！'])).verdict,'要確認');
});
test('S4列単位: 監査後の手動関連記事を守り、概要を書き、再実行差分0', () => {
  const e=env(FEED);e.run('S2_清掃監査');e.g.SC_CONFIG.v2ApplyLevel='AUTO_PASS';
  const v=e.books[V2W].sheets['V2・統合台帳'].st.rows, n=e.H.indexOf('概要（清掃済）'),p=e.H.indexOf('関連記事URL');v[1][p]='人が追加した記事';
  const w=e.run('S4_V2作業用へ反映');assert.equal(w.cellsWritten,1);assert.equal(v[1][n],'一の本文です。');assert.equal(v[1][p],'人が追加した記事');assert.equal(e.run('S4_V2作業用へ反映').cellsWritten,0);
});
test('S4列単位: ロボ最終履歴一致は更新でき、人の別値は保護。GUID不一致は全列停止', () => {
  for(const mode of ['robot','human','guid']) {
    const e=env(FEED); e.run('S2_清掃監査');e.g.SC_CONFIG.v2ApplyLevel='AUTO_PASS';
    const v=e.books[V2W].sheets['V2・統合台帳'].st.rows, n=e.H.indexOf('概要（清掃済）');
    v[1][n]=mode==='robot'?'前回ロボの概要':'人の概要';
    e.books[COPY].sheets['清掃・反映履歴']=mkSheet([Array.from(e.g.SC_HIST_HEADERS_),['時刻','以前','V2作業用','EP-1','概要（清掃済）','','前回ロボの概要','OK']]);
    if(mode==='guid')v[1][e.H.indexOf('公式GUID')]='ffffffff-0000-4000-8000-000000000001';
    const w=e.run('S4_V2作業用へ反映');assert.equal(w.cellsWritten,mode==='robot'?2:mode==='human'?1:0);
    assert.equal(v[1][n],mode==='robot'?'一の本文です。':'人の概要');assert.equal(e.run('S4_V2作業用へ反映').cellsWritten,0);
  }
});

test('SC4-9: 明示された募集段落だけを除き、次の本文・収録日・出演者・記事を保持', () => {
 const raw=P(['【リアルで新聞をめくろう】','9月23日は「PODCAST MEETING 2024」！','入場無料で申し込めます。','https://ciy.digital.asahi.com/ciy/11014641'],['【番組内容】','今回の本編は選挙報道です。','※2024年8月26日に収録しました。'],STAFF,REL);
 const j=judgeEpisode(raw);assert.equal(j.verdict,'自動検査合格・目視未確認');assert.equal(j.clean.text,'今回の本編は選挙報道です。\n※2024年8月26日に収録しました。');assert.equal(j.clean.cast.length,3);assert.equal(j.clean.related.length,1);
});
test('SC4-9: 告知語だけでは段落削除しない。イベントの取材・振り返りは本文に保持',()=>{
 const body='9月に開催された「PODCAST MEETING 2024」を振り返ります。';const j=judgeEpisode(P([body]));assert.equal(j.clean.text,body);assert.equal(j.verdict,'自動検査合格・目視未確認');
 const ambiguous='【ご案内】\nPODCAST MEETINGを開催します。\n重要な本文。';assert.match(cleanV4(ambiguous).text,/重要な本文/);
});
test('SC4-9: 定型メルマガ・アーカイブ案内だけを除き、報道文は残す',()=>{
 const raw=P(['メールマガジンの購読について取材しました。'],['メールマガジン「朝ポキおたより」が、始まりました。ぜひご登録を。'],['朝ポキ7番組の更新情報・アーカイブはこちら！ https://www.asahi.com/special/podcasts/']);const j=judgeEpisode(raw);assert.equal(j.clean.text,'メールマガジンの購読について取材しました。');assert.equal(j.verdict,'自動検査合格・目視未確認');
});
test('SC4-9: 同一記事URLの重複に見出し欠落を誤報しない。未知URLは保留',()=>{
 const raw=P(['本編です。'],['【関連記事】','第一の見出し','https://www.asahi.com/articles/AS1.html?iref=omny','https://www.asahi.com/articles/AS1.html']);const j=judgeEpisode(raw);assert.equal(j.verdict,'自動検査合格・目視未確認');assert.equal(j.clean.related.length,1);assert.equal(judgeEpisode(raw+'<p>https://www.asahi.com/articles/AS2.html</p>').verdict,'要確認');
});
test('SC4-9: 短い見出し・ゼロ幅文字・自然な閉じ括弧を正確に保全',()=>{
 const j=judgeEpisode(P(['本文。'],['【関連記事】','第1問 https://www.asahi.com/articles/AS1.html','第二の見出し（補足）','\u2060https://www.asahi.com/articles/AS2.html']));assert.equal(j.verdict,'自動検査合格・目視未確認');assert.deepEqual(j.clean.related.map(x=>x.title),['第1問','第二の見出し（補足）']);
});

// ===== SC4-11 / SQA-10 回帰（2026-11-13 V2実データの手動保護1,675件の原因別。本文は合成）=====
import { derivedFromRaw } from '../scripts/ledger-v2/summary-cleaner-v4.mjs';
const RAW11 = '<p>今回は雨の日の過ごし方を話します。</p><p>【出演・スタッフ】<br>山田花子 MC 鈴木一郎</p><p>関連する記事<br>雨の日のコツ <a href="https://www.asahi.com/articles/ASX1.html?iref=omny">www.asahi.com/articles/ASX1.html</a></p><p>メール <a href="mailto:podcast@asahi.com">こちら</a>まで</p><p>イベントは視聴できます&darr;</p>';
test('SC4-11 旧清掃器の付けた節見出しだけの行は自動値（【関連記事】が原文に無くても）', () => {
  assert.equal(derivedFromRaw('今回は雨の日の過ごし方を話します。\n【関連記事】\n雨の日のコツ', RAW11), true);
});
test('SC4-11 URLを消した跡の空かっこ・矢印・mailto: は自動値', () => {
  assert.equal(derivedFromRaw('雨の日のコツ（ ）\nメール mailto:podcast@asahi.com こちらまで\nイベントは視聴できます↓', RAW11), true);
});
test('SC4-11 人が書き足した文は従来どおり保護', () => {
  assert.equal(derivedFromRaw('今回は雨の日の過ごし方を話します。\n傘の選び方も紹介しました。', RAW11), false);
  assert.equal(derivedFromRaw('【おすすめ】傘の選び方', RAW11), false);   // 節名でない見出しの中身は原文照合する
  assert.equal(derivedFromRaw('雨の日のコツ https://example.com/x', RAW11), false);   // 原文に無いURL
});
test('SQA-10 名前付き文字参照（&darr; 等）を清掃後の本文に残さない', () => {
  const c = cleanV4(RAW11); assert.ok(!/&[a-z]+;/i.test(c.text), c.text); assert.ok(c.text.includes('視聴できます↓') || !c.text.includes('視聴できます'));
});
