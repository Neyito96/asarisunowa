import test from 'node:test';
import assert from 'node:assert/strict';
import { planSync, nextDecisions, platformLinks, LIMITS } from '../scripts/library-sync-v2.mjs';

const row = (id, extra = {}) => ({ 'EP-ID': id, 番組: 'A', タイトル: 't' + id, '配信日時 JST': '2026-11-16 05:00', 掲載判定: '対象', Spotify: 'https://open.spotify.com/episode/' + id, ...extra });
const pub = (id, links = []) => [id, { id, show: 'A', title: 'old' + id, date: '2026-01-01', links }];

test('既存の公開内容は書き換えず、新着だけ足す。前回保留・対象外の回は出さない', () => {
  const old = new Map([pub('EP-00001')]);
  const plan = planSync({ old, decisions: [{ id: 'EP-00003', publication: '保留' }], v2: [row('EP-00001'), row('EP-00002'), row('EP-00003')] });
  assert.ok(plan.ok);
  assert.equal(plan.keep[0].title, 'oldEP-00001');
  assert.deepEqual(plan.add.map((e) => e.id), ['EP-00002']);
  assert.deepEqual(plan.protectedIds, ['EP-00003']);
});
test('台帳から大量に消えたら止まる', () => {
  const old = new Map(Array.from({ length: LIMITS.maxRemovals + 5 }, (_, i) => pub('EP-' + String(i + 1).padStart(5, '0'))));
  const plan = planSync({ old, decisions: [], v2: [] });
  assert.equal(plan.ok, false);
});
test('重複EP-ID・対象以外の行・番組名の変化で止まる', () => {
  assert.equal(planSync({ old: new Map(), decisions: [], v2: [row('EP-00001'), row('EP-00001')] }).ok, false);
  assert.equal(planSync({ old: new Map(), decisions: [], v2: [row('EP-00001', { 掲載判定: '保留' })] }).ok, false);
  assert.equal(planSync({ old: new Map([pub('EP-00001')]), decisions: [], v2: [row('EP-00001', { 番組: 'B' })] }).ok, false);
});
test('2回目は変化なし（同じ台帳なら同じ結果）', () => {
  const p1 = planSync({ old: new Map(), decisions: [], v2: [row('EP-00002')] });
  const old = new Map(p1.add.map((e) => [e.id, e]));
  const p2 = planSync({ old, decisions: nextDecisions({ source: { rawReadSHA256: 'x' }, decisions: [] }, p1, 'h', 'now').decisions, v2: [row('EP-00002')] });
  assert.equal(p2.add.length, 0); assert.equal(p2.linkAdded.length, 0); assert.equal(p2.removed.length, 0);
});
test('配信リンクは台帳にある実URLだけ（推測で作らない）', () => {
  const links = platformLinks(row('EP-00009', { Apple: 'javascript:alert(1)', 公式個別URL: '' }));
  assert.deepEqual(links, ['https://open.spotify.com/episode/EP-00009']);
});
test('前回「同一性保留」でV2が解決済みの回だけ回収する。再配信・対象外は戻さない', () => {
  const ds = [{ id: 'EP-00011', publication: '保留', classification: '同一性保留' }, { id: 'EP-00012', publication: '保留', classification: '再配信候補' }, { id: 'EP-00013', publication: '対象外', classification: '再配信' }, { id: 'EP-00014', publication: '保留', classification: '同一性保留' }];
  const plan = planSync({ old: new Map(), decisions: ds, v2: [row('EP-00011'), row('EP-00012'), row('EP-00013'), row('EP-00014')], resolved: ['EP-00011', 'EP-00012', 'EP-00013'] });
  assert.deepEqual(plan.add.map((e) => e.id), ['EP-00011']);
  assert.deepEqual(plan.protectedIds.sort(), ['EP-00012', 'EP-00013', 'EP-00014']);
  const next = nextDecisions({ source: { rawReadSHA256: 'x' }, decisions: ds }, plan, 'h', 'now');
  assert.equal(next.decisions.find((d) => d.id === 'EP-00011').publication, '対象');
  assert.equal(next.decisions.find((d) => d.id === 'EP-00012').publication, '保留');
});
test('#333 概要の同期: V2清掃済みで置き換え。空・タイトル不一致・手動修正・HOLDは保護。ほかの項目は変えない。2回目は変化なし', async () => {
  const { planDescription } = await import('../scripts/library-sync-v2.mjs');
  const good = '新しい概要です。今回は台北の地下街を歩きました。若者があふれていました。';
  const e = { id: 'EP-00001', show: 'A', title: 'tEP-00001', description: '古い概要 ★イベント告知 https://bit.ly/x', links: ['https://open.spotify.com/episode/EP-00001'], relatedArticles: [{ title: 'T', url: 'https://www.asahi.com/articles/X.html' }], cast: '神田大介', duration: 100 };
  assert.equal(planDescription(e, row('EP-00001', { '概要（清掃済）': good }), new Set()).action, 'update');
  assert.equal(planDescription(e, row('EP-00001', { '概要（清掃済）': '短い' }), new Set()).reason, 'V2概要が空・短い');
  assert.equal(planDescription(e, row('EP-00001', { 'タイトル': '別の題', '概要（清掃済）': good }), new Set()).reason, 'タイトル不一致');
  assert.equal(planDescription(e, row('EP-00001', { '概要（清掃済）': good }), new Set(['EP-00001'])).reason, '手動修正（承認済み）');
  assert.equal(planDescription(e, row('EP-00001', { '概要（清掃済）': good + ' 【未知の見出し】 なにか' }), new Set()).reason, 'V2概要が表示整形でHOLD');
  const old = new Map([['EP-00001', e]]);
  const p1 = planSync({ old, decisions: [], v2: [row('EP-00001', { '概要（清掃済）': good })] });
  assert.equal(p1.descUpdates.length, 1);
  const k = p1.keep[0]; assert.equal(k.description, good); assert.equal(k.descriptionSource, 'V2-clean');
  for (const f of ['relatedArticles', 'cast', 'duration', 'title', 'show']) assert.deepEqual(k[f], e[f], f);
  const p2 = planSync({ old: new Map([['EP-00001', k]]), decisions: [], v2: [row('EP-00001', { '概要（清掃済）': good })] });
  assert.equal(p2.descUpdates.length, 0); assert.equal(p2.descSame, 1);
});

test('出演者: 完全一致の重複だけを外し、名前と順序は保つ（2回くり返し）', async () => {
  const { dedupeCast } = await import('../scripts/library-sync-v2.mjs');
  assert.equal(dedupeCast('A,部 / B / C / A,部 / B / C'), 'A,部 / B / C');
  assert.equal(dedupeCast('A / A,部'), 'A / A,部');   // 所属つきは別物として残す（推測で統合しない）
  assert.equal(dedupeCast(''), '');
});

test('出演者: 蔵が空の回だけ V2 の出演者で補い、既存の値は書き換えない', async () => {
  const mk = (id, cast) => ({ id, show: 'ニュースの学校', title: 't' + id, date: '2026-01-01', cast, description: '', links: [] });
  const old = new Map([['EP-00001', mk('EP-00001', '')], ['EP-00002', mk('EP-00002', '杢田光')]]);
  const v2 = ['EP-00001', 'EP-00002'].map((id) => ({ 'EP-ID': id, '番組': 'ニュースの学校', 'タイトル': 't' + id, '配信日時 JST': '2026-01-01', '掲載判定': '対象', '出演者': '神田大介' }));
  const p = planSync({ old, decisions: [], v2, syncDescriptions: false });
  assert.deepEqual(p.castFilled, ['EP-00001']);
  assert.equal(p.keep.find((e) => e.id === 'EP-00001').cast, '神田大介');
  assert.equal(p.keep.find((e) => e.id === 'EP-00002').cast, '杢田光');
});

test('出演者: V2も空なら管理人判断（manualCast）で補う。既存値は上書きしない', () => {
  const mk = (id, cast) => ({ id, show: 'ニュースの学校', title: 't' + id, date: '2026-01-01', cast, description: '', links: [] });
  const old = new Map([['EP-00001', mk('EP-00001', '')], ['EP-00002', mk('EP-00002', '杢田光')]]);
  const v2 = ['EP-00001', 'EP-00002'].map((id) => ({ 'EP-ID': id, '番組': 'ニュースの学校', 'タイトル': 't' + id, '配信日時 JST': '2026-01-01', '掲載判定': '対象', '出演者': '' }));
  const p = planSync({ old, decisions: [], v2, syncDescriptions: false, manualCast: new Map([['EP-00001', '神田大介'], ['EP-00002', '神田大介']]) });
  assert.equal(p.keep.find((e) => e.id === 'EP-00001').cast, '神田大介');
  assert.equal(p.keep.find((e) => e.id === 'EP-00002').cast, '杢田光');
});

test('蔵の検索: 番組名・タイトル・出演者・概要・関連記事の見出し（keywords）を対象にする', async () => {
  const { filterEpisodes } = await import('../public/library/library-core.mjs');
  const items = [{ id: 'EP-1', show: 'こどもそうだんしつ', title: 'なぜ空は青い', cast: 'A', keywords: '関連の見出し', description: '本文', date: '2026-01-01' }];
  for (const q of ['こどもそうだんしつ', '空は青い', 'A', '関連の見出し', '本文']) assert.equal(filterEpisodes(items, { query: q }).length, 1, q);
});
