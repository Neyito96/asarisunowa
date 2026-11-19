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
  // core（最初に読む分）と extra（あとで読む分）を合わせて検査
  const core = { ...JSON.parse(fs.readFileSync('public/uchu/data/core.json', 'utf8')), ...JSON.parse(fs.readFileSync('public/uchu/data/extra.json', 'utf8')) };
  assert.ok(core.cls.length === core.eps.length && core.clsEv.length === core.eps.length && core.geo.length === core.eps.length);
  assert.ok(core.articles.every(([u, ids]) => typeof u === 'string' && ids.length >= 2 && ids.every((i) => i < core.eps.length)));
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

test('言葉から記事へ（#384）: 索引の言葉は語彙と一致し、見出しにその言葉が入っている', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../public/uchu/data/', import.meta.url);
  const ix = JSON.parse(fs.readFileSync(new URL('articles/index.json', dir), 'utf8'));
  const extra = JSON.parse(fs.readFileSync(new URL('extra.json', dir), 'utf8'));
  const { extractTerms, termKey } = await import('../scripts/uchu/uchu-core.mjs');
  const shards = new Map(); const row = (k) => { const n = Math.floor(k / ix.shard); if (!shards.has(n)) shards.set(n, JSON.parse(fs.readFileSync(new URL(`articles/s${n}.json`, dir), 'utf8'))); return shards.get(n)[k % ix.shard]; };
  let checked = 0;
  for (const [j, ks] of Object.entries(ix.byTerm).slice(0, 300)) {
    const term = extra.terms[j][0]; assert.ok(ks.length <= 12);
    let prev = Infinity;
    for (const k of ks) {
      const [u, title, eps] = row(k);
      assert.ok(u && !u.startsWith('http') && title && eps.length >= 1, String(k));
      assert.ok(extractTerms(title).map(termKey).includes(termKey(term)), `${term} / ${title}`);
      assert.ok(eps.length <= prev); prev = eps.length; checked++;
    }
  }
  assert.ok(checked > 500);
});

test('概要欄の定型文（番組宣伝・収録日・※注記）は言葉・分類・地名の材料にしない', async () => {
  const { stripBoilerplate } = await import('../scripts/uchu/classify.mjs');
  const d = '長野県のある蔵の奥から古文書がみつかりました。 ※この番組は2022年7月5日に収録しました。前後編の後編です。 ※「ニュースの現場から」「MEDIA TALK」「SDGs シンプルに話そう」「音でよみがえる甲子園」「就活ポッドキャスト」の7番組を配信中です';
  const s = stripBoilerplate(d);
  assert.ok(s.includes('長野県のある蔵'));
  for (const w of ['甲子園', '就活', 'MEDIA', '収録']) assert.ok(!s.includes(w), w);
  assert.equal(stripBoilerplate('★朝日新聞のデジタル版は4人まで使えます。 お盆の思い出を教えて'), ' お盆の思い出を教えて');
});

test('蔵の公式タグは大分類の手がかりにする（番組名・人名のタグは使わない）', async () => {
  const { classify, OFFICIAL_TAGS } = await import('../scripts/uchu/classify.mjs');
  const { TAXONOMY } = await import('../scripts/uchu/taxonomy.mjs');
  for (const n of Object.values(OFFICIAL_TAGS)) assert.ok(TAXONOMY.some((m) => m.name === n), n);
  const r = classify({ title: 'こんにちは', theme: '', articles: [], desc: '', tags: ['SDGs', '杢田光', '動植物'] }, null);
  assert.equal(TAXONOMY[r.mi].name, '動物・自然'); assert.deepEqual(r.ev[0], ['動植物', 'tag']);
  assert.equal(classify({ title: 'こんにちは', theme: '', articles: [], desc: '', tags: ['SDGs', '杢田光'] }, null).mi, -1);
});
