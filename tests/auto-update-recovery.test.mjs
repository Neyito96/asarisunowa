// 旧自動更新の取りこぼし回収: 蔵からの選び方と追加計画（通信なし）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { module: { exports: {} }, getAutoPlaylistShowIds_: (r) => r.showIds };
vm.runInNewContext(fs.readFileSync(new URL('../scripts/google-apps-script/AutoUpdateRecovery.js', import.meta.url), 'utf8'), ctx);
const R = ctx.module.exports;
const S = (c) => c.repeat(22);

test('蔵から: 期間内・ルールの番組の回だけ、古い順', () => {
  const shows = ['ドーナツ', 'MEDIA TALK', '報談'];
  const ids = { 'ドーナツ': 'DON', 'MEDIA TALK': 'MT', '報談': 'HOU' };
  const rows = [['EP-3', 0, '2026-11-09T04:00', 'c'], ['EP-1', 1, '2026-07-01T04:00', 'old'], ['EP-2', 1, '2026-09-01T04:00', 'b'], ['EP-4', 2, '2026-10-01T04:00', 'other']];
  const r = Array.from(R.aurPickLibrary_(rows, shows, ids, ['DON', 'MT'], '2026-08-01'));
  assert.deepEqual(r.map((x) => x.ep), ['EP-2', 'EP-3']);
});

test('計画: 既存・別番組・判定外・再生不可・重複は入れない', () => {
  const rule = { showIds: ['DON'] };
  const ep = (id, show, name, date, extra = {}) => ({ id: S(id), uri: 'spotify:episode:' + S(id), show: { id: show }, name, release_date: date, ...extra });
  const eps = [
    ep('a', 'DON', '（1on1）蚊取り線香　寺下真理加さん', '2026-11-09'),
    ep('b', 'DON', '（1on1）財布　寺下真理加さん', '2026-09-14'),
    ep('c', 'MT', '（1on1）寺下真理加さん 別番組', '2026-10-01'),
    ep('d', 'DON', '別の人の回', '2026-10-02'),
    ep('e', 'DON', '（1on1）寺下真理加さん 再生不可', '2026-10-03', { is_playable: false }),
    ep('a', 'DON', '（1on1）蚊取り線香　寺下真理加さん', '2026-11-09'),
  ];
  const existing = { ['spotify:episode:' + S('b')]: true };
  const plan = Array.from(R.aurPlan_(rule, eps, existing, (e) => /寺下真理加/.test(e.name)));
  assert.deepEqual(plan.map((x) => x.release_date), ['2026-11-09']);
});

test('手がかり語で蔵の回を絞る（語の無いルールがあれば絞らない）', () => {
  const lite = { 'EP-1': ['EP-1', 0, '2026-11-09', '（1on1）蚊取り線香', '寺下真理加（be編集部）'], 'EP-2': ['EP-2', 0, '2026-11-10', '別の回', '神田大介'] };
  const picked = [{ ep: 'EP-1' }, { ep: 'EP-2' }];
  assert.deepEqual(Array.from(R.aurPrefilter_(picked, lite, [{ keywords: ['寺下 真理加'] }])).map((p) => p.ep), ['EP-1']);
  assert.equal(R.aurPrefilter_(picked, lite, [{ keywords: ['寺下真理加'] }, {}]).length, 2);
  assert.deepEqual(Array.from(R.aurRuleTerms_({ matchStrategy: 'sato-yo-safe-confirmed' })), ['佐藤陽']);
});
