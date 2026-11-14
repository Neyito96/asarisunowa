import test from 'node:test';
import assert from 'node:assert/strict';
import { buildV2Library, compareWithPublic, parseCsv } from '../scripts/ledger-v2/export-v2-library.mjs';
import { filterEpisodes } from '../public/library/library-core.mjs';

const H = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', '公式GUID', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', '再生時間 秒', '音声URL', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube', 'Omny埋込URL'];
const row = (o) => H.map((h) => o[h] ?? '');
const ledger = [H,
  row({ 'EP-ID': 'EP-00001', 番組: 'A', タイトル: '原回の話 #4', '配信日時 JST': '2026/10/10 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00001', 公式GUID: 'g1', '概要（清掃済）': '本文です', '再生時間 秒': '600', 音声URL: 'https://traffic.omny.fm/x.mp3', Spotify: 'https://open.spotify.com/episode/1234567890123456789012', 関連記事URL: 'https://www.asahi.com/a.html' }),
  row({ 'EP-ID': 'EP-00002', 番組: 'A', タイトル: '（再）原回の話 #4', '配信日時 JST': '2026/11/10 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00002', 公式GUID: 'g2' }),
  row({ 'EP-ID': 'EP-00003', 番組: 'A', タイトル: '（再）原回が無い話 #9', '配信日時 JST': '2026/11/11 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00003', 公式GUID: 'g3' }),
  row({ 'EP-ID': 'EP-00004', 番組: 'A', タイトル: '同じGUID', '配信日時 JST': '2026/11/12 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00004', 公式GUID: 'G1' }),
  row({ 'EP-ID': 'EP-00005', 番組: 'B', タイトル: '新着', '配信日時 JST': '2026/11/13 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00005', 公式GUID: 'g5', 公式個別URL: 'https://www.asahi.com/special/podcasts/item/?itemid=g5' }),
  row({ 'EP-ID': 'EP-00006', 番組: 'B', タイトル: '保留の回', '配信日時 JST': '2026/11/13 04:00', 掲載判定: '保留', '代表EP-ID': 'EP-00006' }),
  row({ 'EP-ID': 'EP-00007', 番組: 'B', タイトル: '同一内容の別EP', '配信日時 JST': '2026/11/13 04:00', 掲載判定: '対象', '代表EP-ID': 'EP-00005' })];
const persons = [['EP-ID', '索引名', '表記原文', '肩書き・注記', 'リンク', '出典', '検証状態', '索引版'], ['EP-00001', '神田大介', '', '', '', '', '原文で確認', 'PI-4'], ['EP-00001', '未検証太郎', '', '', '', '', '原文に出典なし・未検証', 'PI-4']];
const related = [['EP-ID', '番号', '見出し', 'URL', 'リンク', '出典', '元URL（原文の表記）'], ['EP-00001', '1', '記事の見出し', 'https://www.asahi.com/a.html', '', '', ''], ['EP-00005', '1', '未取得', 'https://www.asahi.com/b.html', '', '', '']];

test('E1: 対象かつ代表EPだけ公開・再配信は原回公開済みなら除外、原回なしは保留・同じGUIDは除外・人名は原文で確認だけ・見出し未取得はURLだけ・音声は確認済み証拠がある時だけ', () => {
  assert.deepEqual(buildV2Library({ ledger, persons, related, previousPublicIds: new Set(['EP-00001']), decidedAt: '2026-11-14T00:00:00Z' }).episodes.map((e) => e.id), ['EP-00001']);   // 未確認の新規は自動公開しない
  const r = buildV2Library({ ledger, persons, related, previousPublicIds: new Set(['EP-00001']), newEpisodeAllowList: new Set(['EP-00005']), verifiedAudio: { 'EP-00001': { url: 'https://traffic.omny.fm/x.mp3' } }, decidedAt: '2026-11-14T00:00:00Z' });
  assert.deepEqual(r.episodes.map((e) => e.id), ['EP-00001', 'EP-00005']);
  const why = Object.fromEntries(r.audit.map((a) => [a.id, a.publication + '/' + a.classification]));
  assert.deepEqual(why, { 'EP-00001': '対象/通常', 'EP-00002': '除外/再配信', 'EP-00003': '保留/再配信', 'EP-00004': '除外/重複', 'EP-00005': '対象/通常', 'EP-00006': '保留/通常', 'EP-00007': '除外/同一内容' });
  const e1 = r.episodes[0]; assert.equal(e1.cast, '神田大介'); assert.equal(e1.audio, 'https://traffic.omny.fm/x.mp3'); assert.deepEqual(e1.relatedArticles, [{ title: '記事の見出し', url: 'https://www.asahi.com/a.html' }]); assert.equal(e1.date, '2026-10-10T04:00:00+09:00');
  assert.deepEqual(r.episodes[1].relatedArticles, [{ title: '', url: 'https://www.asahi.com/b.html' }]); assert.equal(r.episodes[1].audio, ''); assert.equal(r.episodes[1].audioAvailable, false); assert.equal(e1.audioAvailable, true);
  assert.equal(r.scope.adopted, 2); assert.equal(r.scope.held, 2); assert.equal(r.scope.excluded, 3);
  const d = compareWithPublic(r.episodes, [{ id: 'EP-00001', show: 'A', title: '原回の話 #4', date: '2026-10-10T04:00:00+09:00', cast: '', audio: true }, { id: 'EP-09999', show: 'A', title: 'x', date: '', cast: '', audio: false }]);
  assert.deepEqual(d.added, ['EP-00005']); assert.deepEqual(d.removed, ['EP-09999']); assert.deepEqual(d.changed, [{ id: 'EP-00001', fields: ['cast'] }]);
});

test('E1: 必須列が無い・EP-ID重複は止まる／CSVは引用符と改行を扱う', () => {
  assert.throws(() => buildV2Library({ ledger: [['EP-ID'], ['EP-00001']], decidedAt: '2026-11-14T00:00:00Z' }), /V2_LEDGER_COLUMN_MISSING/);
  assert.throws(() => buildV2Library({ ledger: [H, ledger[1], ledger[1]], decidedAt: '2026-11-14T00:00:00Z' }), /DUPLICATE_EP_ID/);
  assert.deepEqual(parseCsv('a,b\n"x,1","改\n行""q"""\n'), [['a', 'b'], ['x,1', '改\n行"q"']]);
});

test('#302: keywords があっても概要欄（description）も検索対象になる', () => {
  const items = [{ id: 'EP-00001', show: 'A', title: 't', cast: '', keywords: '別の語', description: '概要だけにある語', date: '2026-01-01' }];
  assert.equal(filterEpisodes(items, { query: '概要だけにある語' }).length, 1); assert.equal(filterEpisodes(items, { query: '別の語' }).length, 1);
});
