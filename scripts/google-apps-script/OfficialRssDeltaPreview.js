/** Official RSS -> episode library: read-only preview. No triggers, writes, or Spotify calls. */
function previewOfficialRssDelta_(feedUrl, knownIds, limit) {
  const url = String(feedUrl || '').trim();
  if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error('HTTPS RSS URL required');
  const max = Math.max(1, Math.min(Number(limit) || 20, 100));
  const known = {};
  (knownIds || []).forEach(function(id) { if (id) known[String(id).trim()] = true; });
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true, followRedirects: true,
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
  });
  const status = response.getResponseCode();
  if (status !== 200) throw new Error('RSS fetch failed: HTTP ' + status);
  const xml = XmlService.parse(response.getContentText('UTF-8'));
  const root = xml.getRootElement();
  if (root.getName() !== 'rss') throw new Error('RSS 2.0 feed required');
  const channel = root.getChild('channel');
  if (!channel) throw new Error('RSS channel missing');
  const items = channel.getChildren('item').slice(0, max);
  const records = items.map(function(item) {
    function field(name) { return String(item.getChildText(name) || '').trim(); }
    const guid = field('guid');
    const link = field('link');
    const id = guid || link;
    return { id: id, guid: guid, link: link, title: field('title'),
      pubDate: field('pubDate'), isNew: !!id && !known[id] };
  });
  return { mode: 'READ_ONLY', feed: url, inspected: records.length,
    newCount: records.filter(function(row) { return row.isNew; }).length,
    items: records };
}
