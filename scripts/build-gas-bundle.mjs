// GAS配達係用の束（#526）: scripts/google-apps-script の .js と appsscript.json を1つのJSONにまとめ、
// GitHub Pages の gas/bundle.json として出す。配達係は GitHub API（回数制限が厳しい）を使わず、これを1回読むだけで済む。
// 使い方: node scripts/build-gas-bundle.mjs <出力先.json>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function buildGasBundle(dir, sha) {
  const files = fs.readdirSync(dir).filter((n) => /\.js$/.test(n) || n === 'appsscript.json').sort().map((n) => ({
    name: n.replace(/\.(js|json)$/, ''),
    type: n === 'appsscript.json' ? 'JSON' : 'SERVER_JS',
    source: fs.readFileSync(path.join(dir, n), 'utf8'),
  }));
  const digest = crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
  return { sha: sha || '', digest, files };
}

if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  const out = process.argv[2];
  if (!out) { console.error('出力先を指定してください'); process.exit(1); }
  const bundle = buildGasBundle('scripts/google-apps-script', process.env.GITHUB_SHA);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(bundle));
  console.log(`gas bundle: ${bundle.files.length} files, digest ${bundle.digest.slice(0, 12)}`);
}
