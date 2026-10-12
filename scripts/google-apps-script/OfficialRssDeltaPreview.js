/** RSS -> library dry-run only. Never writes to Sheets, Spotify, or installs triggers. */
function rssPreviewKeys_(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = [raw];
  const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuid) keys.push('uuid:' + uuid[0].toLowerCase());
  const megaphone = raw.match(/(?:traffic\.)?megaphone\.fm\/([A-Za-z0-9_-]+)/i);
  if (megaphone) keys.push('megaphone:' + megaphone[1].toLowerCase());
  try {
    const clean = raw.split(/[?#]/)[0].replace(/\/$/, '').toLowerCase();
    if (/^https?:\/\//i.test(raw)) keys.push('url:' + clean);
  } catch (_) {}
  return Array.from(new Set(keys));
}

/** knownRows: [{externalId,link,enclosureUrl,guid,excluded}] or old string IDs. */
function previewOfficialRssDelta_(feedUrl, knownRows, limit) {
  const url = String(feedUrl || '').trim();
  if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error('HTTPS RSS URL required');
  const max = Math.max(1, Math.min(Number(limit) || 20, 100));
  const index = {};
  (knownRows || []).forEach(function(row, i) {
    const data = typeof row === 'string' ? { externalId: row } : (row || {});
    [data.externalId, data.link, data.enclosureUrl, data.guid].forEach(function(value) {
      rssPreviewKeys_(value).forEach(function(key) {
        if (!index[key]) index[key] = [];
        index[key].push({ index: i, excluded: data.excluded === true });
      });
    });
  });
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true, followRedirects: true,
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' }
  });
  if (response.getResponseCode() !== 200) throw new Error('RSS HTTP ' + response.getResponseCode());
  const root = XmlService.parse(response.getContentText('UTF-8')).getRootElement();
  if (root.getName() !== 'rss') throw new Error('RSS 2.0 feed required');
  const channel = root.getChild('channel');
  if (!channel) throw new Error('RSS channel missing');
  const seen = {};
  const items = channel.getChildren('item').slice(0, max).map(function(item) {
    const field = function(name) { return String(item.getChildText(name) || '').trim(); };
    const enclosure = item.getChild('enclosure');
    const enclosureUrl = enclosure ? String(enclosure.getAttribute('url')?.getValue() || '') : '';
    const guid = field('guid'), link = field('link');
    const keys = Array.from(new Set([guid, link, enclosureUrl].flatMap(rssPreviewKeys_)));
    const matches = {};
    keys.forEach(function(key) { (index[key] || []).forEach(function(m) { matches[m.index] = m; }); });
    const found = Object.values(matches);
    let status = !keys.length ? 'ambiguous' : found.some(function(m) { return m.excluded; }) ? 'excluded'
      : found.length > 1 ? 'ambiguous' : found.length === 1 ? 'matched' : 'new';
    if (keys.some(function(key) { return seen[key]; }) && status === 'new') status = 'ambiguous';
    keys.forEach(function(key) { seen[key] = true; });
    return { guid: guid, link: link, enclosureUrl: enclosureUrl, title: field('title'),
      pubDate: field('pubDate'), status: status };
  });
  const counts = { matched: 0, new: 0, ambiguous: 0, excluded: 0 };
  items.forEach(function(item) { counts[item.status] += 1; });
  return { mode: 'READ_ONLY', feed: url, inspected: items.length, counts: counts, items: items };
}
