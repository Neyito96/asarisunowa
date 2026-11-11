// 概要原文の「封緘」転送（RSA-OAEP-SHA256 + AES-256-GCM + gzip）。公開リポジトリには公開鍵と暗号文しか出ない。秘密鍵は実行環境の外へ出さない。
// keygen : node sealed-transfer.mjs keygen <秘密鍵の保存先.pem> <公開鍵の保存先.pem>
// seal   : node sealed-transfer.mjs seal <rss-items.json> <guids.json> <public.pem> <out.json>   … 指定GUIDの {guid: descriptionRaw} を暗号化
// open   : node sealed-transfer.mjs open <sealed.json> <private.pem> <out.json>
// post   : node sealed-transfer.mjs post <sealed.json> <pr>   （Actions内。GITHUB_TOKEN 使用）
import fs from 'node:fs'; import crypto from 'node:crypto'; import zlib from 'node:zlib';
const [cmd, ...a] = process.argv.slice(2);
export function seal(obj, publicPem) {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(Buffer.from(JSON.stringify(obj)))), c.final()]);
  return { alg: 'RSA-OAEP-SHA256+A256GCM+gzip', ek: crypto.publicEncrypt({ key: publicPem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, key).toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: body.toString('base64') };
}
export function open(s, privatePem) {
  const key = crypto.privateDecrypt({ key: privatePem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(s.ek, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64')); d.setAuthTag(Buffer.from(s.tag, 'base64'));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(Buffer.from(s.data, 'base64')), d.final()])).toString());
}
if (cmd === 'keygen') {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 4096, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  fs.writeFileSync(a[0], privateKey, { mode: 0o600 }); fs.writeFileSync(a[1], publicKey); console.log('ok');
} else if (cmd === 'seal') {
  const items = JSON.parse(fs.readFileSync(a[0], 'utf8')).items, want = new Set(JSON.parse(fs.readFileSync(a[1], 'utf8')).guids.map((g) => g.toLowerCase()));
  const obj = { fetchedAt: new Date().toISOString(), items: Object.fromEntries(items.filter((x) => want.has(x.guid)).map((x) => [x.guid, { descriptionRaw: x.descriptionRaw || '', sha256: crypto.createHash('sha256').update(x.descriptionRaw || '').digest('hex'), rss: x.rss, show: x.show }])) };
  fs.writeFileSync(a[3], JSON.stringify(seal(obj, fs.readFileSync(a[2], 'utf8')))); console.log('sealed', Object.keys(obj.items).length, 'of', want.size);
} else if (cmd === 'open') {
  fs.writeFileSync(a[2], JSON.stringify(open(JSON.parse(fs.readFileSync(a[0], 'utf8')), fs.readFileSync(a[1], 'utf8')), null, 1)); console.log('opened');
} else if (cmd === 'post') {
  const s = fs.readFileSync(a[0], 'utf8'), size = 60000, parts = []; for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  for (let i = 0; i < parts.length; i++) {
    const body = `v2rss-sealed:${process.env.GITHUB_RUN_ID}:part-${String(i).padStart(2, '0')}-of-${String(parts.length).padStart(2, '0')}\n\`\`\`\n${parts[i]}\n\`\`\``;
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${a[1]}/comments`, { method: 'POST', headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' }, body: JSON.stringify({ body }) });
    if (r.status !== 201) throw new Error('COMMENT_' + r.status);
  }
  console.log('posted', parts.length);
}
