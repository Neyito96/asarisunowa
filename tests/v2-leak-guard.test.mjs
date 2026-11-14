// 第5段階: 公開の場（PRコメント・成果物・ログ）への概要原文の再混入を防ぐ回帰テスト。CI でも実行する。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
import { assertPublishable } from '../scripts/ledger-v2/leak-guard.mjs';
const WF = fs.readFileSync('.github/workflows/v2-rss-readonly.yml', 'utf8');

test('公開してよい形（識別子・URL・短い題名・ハッシュ）は通り、本文・HTML・長文・本文キーは止まる', () => {
  assert.ok(assertPublishable({ feedStatus: [{ show: 'MEDIA TALK', http: 200 }], items: [{ title: '題名', guid: 'g', audioUrl: 'https://x/' + 'a'.repeat(500), descLen: 2440, descSha256: 'abc' }] }));
  assert.throws(() => assertPublishable({ items: [{ descriptionRaw: '本文' }] }), /LEAK_KEY/);
  assert.throws(() => assertPublishable({ items: [{ title: '<p>本文</p>' }] }), /LEAK_HTML/);
  assert.throws(() => assertPublishable({ items: [{ note: 'あ'.repeat(301) }] }), /LEAK_LONG_TEXT/);
  assert.throws(() => assertPublishable({ 概要原文: 'x' }), /LEAK_KEY/);
});

test('投稿スクリプトは投稿前に必ず検査する（本文を落とした上で検査）', () => {
  const s = fs.readFileSync('scripts/ledger-v2/post-rss-dump.mjs', 'utf8');
  assert.match(s, /import \{ assertPublishable \} from '\.\/leak-guard\.mjs'/);
  assert.ok(s.indexOf('assertPublishable(compact)') > 0 && s.indexOf('assertPublishable(compact)') < s.indexOf('fetch('));
  assert.match(s, /descriptionRaw: undefined/);
});

test('ワークフロー: 成果物を保存しない・封緘は明示マーカーのときだけ・作業ファイルは最後に必ず消す・ログに本文を出さない', () => {
  assert.ok(!/upload-artifact/.test(WF), '成果物の保存は禁止');
  assert.match(WF, /if: contains\(github\.event\.head_commit\.message, '\[v2rss-sealed\]'\)/);
  const steps = WF.split('\n      - ');
  assert.match(steps.at(-1), /if: always\(\)\n\s+run: rm -f rss-items\.json sealed\.json/);
  assert.match(WF, /node --test [^\n]*tests\/v2-leak-guard\.test\.mjs/);   // CIでも実行
  const f = fs.readFileSync('scripts/ledger-v2/fetch-official-rss.mjs', 'utf8');
  assert.deepEqual([...f.matchAll(/console\.(log|error|info)\(([^;]*)\)/g)].map((m) => m[2]), ['JSON.stringify(feedStatus)']);   // 標準出力は取得状況だけ
});

test('秘密鍵・本文入りファイルがリポジトリに無い', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(files.filter((f) => /\.pem$/.test(f)), ['scripts/ledger-v2/sealed-transfer.pub.pem']);
  for (const f of files.filter((x) => /^(scripts\/ledger-v2|docs\/release|docs\/operations)\//.test(x) && /\.(json|pem|md|mjs)$/.test(x))) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!/PRIVATE KEY/.test(t), f);
    if (/^docs\/release\//.test(f)) assert.ok(!/descriptionRaw|<p>|概要原文"\s*:\s*"[^"]/.test(t), f);
  }
});
