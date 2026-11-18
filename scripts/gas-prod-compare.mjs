// 本番GASの書き出し（Drive の application/vnd.google-apps.script+json）と
// scripts/google-apps-script/ の中身を1ファイルずつ照合する（読むだけ）。
// 使い方: node scripts/gas-prod-compare.mjs <書き出しJSON>
import fs from 'node:fs';
import crypto from 'node:crypto';
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const project = raw.files ? raw : JSON.parse(Buffer.from(raw.content, 'base64').toString('utf8'));
const ext = { server_js: '.js', html: '.html', json: '.json' };
const dir = new URL('./google-apps-script/', import.meta.url);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
let same = 0; const diffs = []; const names = new Set();
for (const f of project.files) {
  const name = f.name + ext[f.type]; names.add(name);
  const p = new URL(name, dir);
  if (!fs.existsSync(p)) { diffs.push(`本番のみ ${name}`); continue; }
  const local = fs.readFileSync(p, 'utf8');
  if (local === f.source) same++; else diffs.push(`差分 ${name} 本番${sha(f.source)} GitHub${sha(local)}`);
}
for (const n of fs.readdirSync(dir)) if (/\.(js|json|html)$/.test(n) && !names.has(n)) diffs.push(`GitHubのみ ${n}`);
console.log(`一致 ${same}/${project.files.length}`); diffs.forEach((d) => console.log(d));
process.exit(diffs.length ? 1 : 0);
