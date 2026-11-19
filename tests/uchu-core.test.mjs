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
