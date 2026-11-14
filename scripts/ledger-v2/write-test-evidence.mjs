// テスト証拠を書く（第三者が同じコミットで再実行して照合できるように）。usage: node scripts/ledger-v2/write-test-evidence.mjs docs/audits/2026-11-14-public-diff/tests.json
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out = process.argv[2]; if (!out) throw Error('usage: write-test-evidence.mjs OUT.json');
const files = execSync('ls tests/*.test.mjs').toString().trim().split('\n');
const res = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const tap = res.stdout, fails = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]);
const num = (k) => Number((tap.match(new RegExp('^# ' + k + ' (\\d+)', 'm')) || [])[1] || 0);
const dist = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), baseCommit: execSync('git rev-parse HEAD').toString().trim(), workingTreeClean: !execSync('git status --porcelain').toString().trim(), node: process.version,
  tests: num('tests'), pass: num('pass'), fail: num('fail'), failures: fails,
  knownEnvironmentFailures: { 'tests/ui-components.test.mjs': 'この環境に react が無い（ERR_MODULE_NOT_FOUND）。PR #306 は app/ と UI に触れていない' },
  dist: { 'gas/summary-cleaner/dist/SummaryCleaner.js': dist('gas/summary-cleaner/dist/SummaryCleaner.js'), 'gas/p25v2-copy/dist/P25V2CopyIngest.js': dist('gas/p25v2-copy/dist/P25V2CopyIngest.js') },
  cleanerBuildSourceSha256: (readFileSync('gas/summary-cleaner/dist/SummaryCleaner.js', 'utf8').match(/CLEANER_BUILD_SOURCE_SHA256 = '([0-9a-f]+)'/) || [])[1] }, null, 2) + '\n');
console.log('wrote', out);
