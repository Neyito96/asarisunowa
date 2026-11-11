// rss-items.json を PR コメントへ分割投稿（成果物ストレージに届かない環境向け。lpa-dump と同じ方式）。概要原文は長さとSHA256のみ。
import fs from 'node:fs'; import crypto from 'node:crypto';
const [file = 'rss-items.json', pr = '306'] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const compact = { fetchedAt: d.fetchedAt, feedStatus: d.feedStatus, items: d.items.map((x) => ({ ...x, descriptionRaw: undefined, descLen: (x.descriptionRaw || '').length, descSha256: crypto.createHash('sha256').update(x.descriptionRaw || '').digest('hex').slice(0, 16) })) };
const s = JSON.stringify(compact), size = 60000, parts = [];
for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
const run = process.env.GITHUB_RUN_ID || 'local';
for (let i = 0; i < parts.length; i++) {
  const body = `v2rss-dump:${run}:part-${String(i).padStart(2, '0')}-of-${String(parts.length).padStart(2, '0')}\n\`\`\`\n${parts[i]}\n\`\`\``;
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${pr}/comments`, { method: 'POST', headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ body }) });
  if (r.status !== 201) throw new Error('COMMENT_' + r.status);
}
console.log('posted', parts.length);
