// 朝ポキの宇宙（アルテキスト計画）: 言葉・人物・記事の取り出しと、事前計算データの整合
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractTerms, parseCast, normalizeArticleUrl, platformOf } from '../scripts/uchu/uchu-core.mjs';

test('複合語を分解せずに取る', () => {
  const t = extractTerms('止まらないサイバー攻撃　高次脳機能障害と新型コロナウイルス、ChatGPTとAI規制');
  for (const w of ['サイバー攻撃', '高次脳機能障害', '新型コロナウイルス', 'ChatGPT', 'AI規制']) assert.ok(t.includes(w), w);
});

test('定型文・日付・URLの切れ端・動詞の語幹は取らない', () => {
  const t = extractTerms('ご意見・ご要望は下記サイトへ。毎週月曜日配信。2026年10月30日に収録 asahi.com 目指す 面白い PA83ET');
  for (const w of ['ご意見', '下記サイト', '毎週月曜日', 'asahi.com', '目指', '面白', 'PA83ET', '日収録']) assert.ok(!t.includes(w), w);
});

test('「◯◯記者」は語にせず人物名へ回す（語として残るのは名前だけ）', () => {
  assert.deepEqual(extractTerms('寺下真理加記者が向かった'), ['寺下真理加']);
});

test('出演者欄から人物名（役割・所属は外す）', () => {
  assert.deepEqual(parseCast('寺下真理加（be編集部） / MC、音源編集　神田大介'), ['寺下真理加', '神田大介']);
  assert.deepEqual(parseCast('真田嶺（社会部） / MC・音源編集 堀江麻友'), ['真田嶺', '堀江麻友']);
  assert.deepEqual(parseCast('be編集部 / 進行'), []);
});

test('記事URLはクエリを外して同じ記事を見分ける。URLは作らない', () => {
  assert.equal(normalizeArticleUrl('https://www.asahi.com/articles/ASS414FXCS39ULFA006.html?iref=pc'), 'www.asahi.com/articles/ASS414FXCS39ULFA006.html');
  assert.equal(normalizeArticleUrl('javascript:alert(1)'), '');
  assert.equal(platformOf('https://open.spotify.com/episode/61mmSDXAR1r2szHHIdRf6s'), 'Spotify');
  assert.equal(platformOf('https://example.com/x'), '');
});

test('事前計算データ: 番号の参照がすべて範囲内', { skip: !fs.existsSync('public/uchu/data/core.json') }, () => {
  const core = JSON.parse(fs.readFileSync('public/uchu/data/core.json', 'utf8'));
  const { rel } = JSON.parse(fs.readFileSync('public/uchu/data/rel.json', 'utf8'));
  const NE = core.eps.length, NT = core.terms.length, NP = core.persons.length, K = core.comms.length;
  assert.equal(rel.length, NE);
  assert.ok(core.eps.every((e) => /^EP-\d{5}$/.test(e[0]) && e[6] >= -1 && e[6] < K));
  assert.ok(core.terms.every((t) => t[4].every((i) => i >= 0 && i < NE) && t[5].every(([j]) => j >= 0 && j < NT)));
  assert.ok(core.persons.every((p) => p[1].every((i) => i >= 0 && i < NE)));
  assert.ok(rel.every(([out, same], i) => out.every(([j, , ts, , ps]) => j !== i && j < NE && ts.every((t) => t < NT) && ps.every((k) => k < NP)) && (!same || same.every((j) => j < NE))));
});

test('分類（Claude試作）: 手がかり語で決め、根拠の語と欄を残す。1文字の手がかり語は無い', async () => {
  const { classify, legacyMainIndex } = await import('../scripts/uchu/classify.mjs');
  const { TAXONOMY } = await import('../scripts/uchu/taxonomy.mjs');
  for (const m of TAXONOMY) for (const [, words] of m.subs) for (const w of words) assert.ok(w.normalize('NFKC').length >= 2, w);
  const r = classify({ title: '大谷翔平のメジャーリーグ、ドジャースで本塁打', theme: '', articles: [], desc: '' }, null);
  assert.equal(TAXONOMY[r.mi].name, 'スポーツ'); assert.equal(TAXONOMY[r.mi].subs[r.si][0], '野球'); assert.ok(r.ev.some(([k, f]) => k === '大谷' && f === 'title'));
  // 「日本」で文学・美術に入った10/25事故の再発防止: 日本代表のサッカーはスポーツ
  assert.equal(TAXONOMY[classify({ title: 'サッカー日本代表、W杯へ', theme: '', articles: [], desc: '' }, null).mi].name, 'スポーツ');
  // 人の承認は動かさない
  const a = classify({ title: '大谷翔平のメジャーリーグ', theme: '', articles: [], desc: '' }, ['暮らし/趣味', 'user_approved']);
  assert.equal(TAXONOMY[a.mi].name, '暮らし・生活'); assert.equal(a.conf, 3);
  // 手がかりが無ければ未分類（無理に入れない）
  assert.equal(classify({ title: 'こんにちは', theme: '', articles: [], desc: '' }, null).mi, -1);
  assert.equal(legacyMainIndex('人権・司法/事件'), TAXONOMY.findIndex((m) => m.name === '法律・司法'));
});

test('地名: 人名・別の意味と紛れるものは除き、根拠の欄を残す', async () => {
  const { findPlaces, placesOfEpisode, PLACES } = await import('../scripts/uchu/geo.mjs');
  const names = (t) => findPlaces(t).map(([id]) => PLACES[id].name);
  assert.deepEqual(names('石川佳純が卓球'), []);
  assert.deepEqual(names('宮崎駿監督の新作'), []);
  assert.deepEqual(names('福島さんの話'), []);
  assert.deepEqual(names('中国地方の山村'), []);
  assert.deepEqual(names('インドネシアとインド'), ['インドネシア', 'インド']);
  assert.deepEqual(names('東京都知事選'), ['東京都']);
  assert.deepEqual(names('能登半島地震から1年'), ['能登']);
  assert.deepEqual(names('福島第一原発の処理水'), ['福島第一原発']);
  const g = placesOfEpisode({ title: '沖縄の基地', theme: '', articles: [], desc: 'ウクライナの話も' });
  assert.equal(PLACES[g[0][0]].name, '沖縄県'); assert.equal(g[0][2], 'title');
  for (const p of PLACES) assert.ok(p.name.length >= 2 && Number.isFinite(p.lat) && Number.isFinite(p.lon), p.name);
});
