import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// app/official-series-links.ts を型を外して実行し、カードの文言に当てた結果を返す
const ui = fs.readFileSync('app/community.tsx', 'utf8');
const body = ui.slice(ui.indexOf('const officialPrograms'), ui.indexOf('];', ui.indexOf('const officialPrograms')));
const cards = [...body.matchAll(/name: "([^"]+)"|(detail|schedule):\s*"([^"]+)"/g)].reduce((a, m) => { if (m[1]) a.push({ name: m[1], texts: [] }); else a[a.length - 1].texts.push(m[3]); return a; }, []);
const run = (code) => JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', `import * as M from './app/official-series-links.ts'; ${code}`], { encoding: 'utf8' }));
const R = run(`const cards=${JSON.stringify(cards)}; console.log(JSON.stringify({ series: M.OFFICIAL_SERIES, display: M.SERIES_DISPLAY_LINKS, segs: cards.map((c) => ({ name: c.name, segs: c.texts.map((t) => M.seriesLinkSegments(t)) })) }))`);

test('番組カードの連載名リンク: 対応表のpgidはすべて公式一覧にあり、URLは公式の連載ページだけ', () => {
  for (const [k, v] of Object.entries(R.display)) assert.ok(R.series[v.pgid], k);
  for (const s of Object.values(R.series)) assert.equal(s.url, 'https://www.asahi.com/special/podcasts/?pgid=' + s.pgid);
});
test('番組カードの連載名リンク: 文言は1文字も変わらない・リンクは区切りで挟まれた表記だけ', () => {
  const linked = [];
  R.segs.forEach((c, ci) => c.segs.forEach((segs, ti) => {
    assert.equal(segs.map((s) => (typeof s === 'string' ? s : s.text)).join(''), cards[ci].texts[ti]);
    segs.filter((s) => typeof s !== 'string').forEach((s) => linked.push(s.text));
  }));
  for (const must of ['一緒に新聞をめくろう！', 'カガクをひらく', 'PUERTA', '楽屋裏', '制作会議', 'GLOBE CAST', '親モヤ', 'ON GOING', 'バスクラ']) assert.ok(linked.includes(must), must);
  for (const never of ['MEDIA TALK', 'TMT', '1on1', '球談', '骨格', 'カロリーオフ', '吹奏楽・高校編']) assert.ok(!linked.includes(never), never);
});
test('番組カードの連載名リンク: 既存の表示（NEW・曜日・配信サービスのボタン）はそのまま、別のリンク行は足さない', () => {
  assert.equal((ui.match(/<SeriesText text=/g) || []).length, 5);
  assert.match(ui, />NEW<\/span><SeriesText text="ニュース大阪目線" \/>/);
  assert.match(ui, /className="serviceLinks"/);
  assert.ok(!/朝日公式連載|officialSeriesForPlaylist|playlistOfficialLinks/.test(ui));
});
