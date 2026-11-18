// 公式RSSを読取専用で取得し、P25V2IngestAdapter の解析器（GASと同一コード）で item 化する。台帳には触れない。
// usage: node fetch-official-rss.mjs [limitPerFeed=40] [out=rss-items.json]
import fs from 'node:fs'; import vm from 'node:vm';
const sb = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(new URL('../google-apps-script/P25V2IngestAdapter.js', import.meta.url), 'utf8'), sb);
const A = sb.module.exports;
const [limit = '40', out = 'rss-items.json'] = process.argv.slice(2);
const { feeds } = JSON.parse(fs.readFileSync(new URL('./v2-feeds.json', import.meta.url), 'utf8'));
const items = [], feedStatus = [];
for (const f of feeds) {
  try {
    const r = await fetch(f.url, { headers: { 'user-agent': 'asarisunowa-v2-ingest/1.0 (+https://github.com/Neyito96/asarisunowa)' } });
    if (r.status !== 200) throw new Error('FEED_HTTP_' + r.status);
    const xml = await r.text(), all = A.parseRss(xml, f.url, f.show);
    const part = all.slice(0, +limit);
    items.push(...part);
    feedStatus.push({ show: f.show, http: 200, itemsInFeed: all.length, taken: part.length, newest: part[0]?.date || '', noTitle: part.filter((x) => !x.title).length, noGuid: part.filter((x) => !x.guid).length });
  } catch (e) { feedStatus.push({ show: f.show, error: String(e.message || e) }); }
  await new Promise((ok) => setTimeout(ok, 1500));
}
fs.writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), feedStatus, items }, null, 1));
console.log(JSON.stringify(feedStatus));
