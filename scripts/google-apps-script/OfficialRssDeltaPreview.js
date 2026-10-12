/** Read-only RSS preview. No trigger, Spotify call or sheet mutation. */
function rssPreviewKeys_(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const keys = [raw];
  const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const exactUuid = new RegExp('^' + uuidPattern + '$', 'i');
  if (exactUuid.test(raw)) keys.push('omny-clip:' + raw.toLowerCase());
  const clip = raw.match(new RegExp('/d/clips/' + uuidPattern + '/' + uuidPattern + '/(' + uuidPattern + ')(?:/|$)', 'i'));
  if (clip) keys.push('omny-clip:' + clip[1].toLowerCase());
  const megaphone = raw.match(/(?:traffic\.)?megaphone\.fm\/([A-Za-z0-9_-]+)\.mp3(?:[?#]|$)/i);
  if (megaphone) keys.push('megaphone-audio:' + megaphone[1].toLowerCase());
  if (/^https?:\/\//i.test(raw)) {
    keys.push('url:' + raw.split(/[?#]/)[0].replace(/\/$/, '').toLowerCase());
  }
  return Array.from(new Set(keys));
}

/** knownRows: [{externalId,link,enclosureUrl,guid,excluded}] or string IDs. */
function rssPreviewTitleKey_(title) {
  return String(title || '').normalize('NFKC').toLowerCase().split(/\s+/).join(' ').trim();
}
function rssPreviewDateKey_(value) {
  // Sheet display strings already represent JST wall time; avoid parsing them as UTC.
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T]|$)/);
    if (match && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) {
      return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}
function previewOfficialRssDelta_(feedUrl, knownRows, limit) {
  const url = String(feedUrl || '').trim();
  if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error('HTTPS RSS URL required');
  const max = Math.max(1, Math.min(Number(limit) || 20, 100));
  const index = {};
  const titleDateIndex = {};
  (knownRows || []).forEach(function(row, i) {
    const data = typeof row === 'string' ? { externalId: row } : (row || {});
    const titleDate = rssPreviewTitleKey_(data.title) + '|' + rssPreviewDateKey_(data.pubDate);
    if (rssPreviewTitleKey_(data.title) && rssPreviewDateKey_(data.pubDate)) {
      titleDateIndex[titleDate] = true;
    }
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
    const attribute = enclosure && enclosure.getAttribute('url');
    const enclosureUrl = attribute ? String(attribute.getValue() || '') : '';
    const guid = field('guid'), link = field('link');
    const keys = Array.from(new Set([guid, link, enclosureUrl].flatMap(rssPreviewKeys_)));
    const matches = {};
    keys.forEach(function(key) { (index[key] || []).forEach(function(m) { matches[m.index] = m; }); });
    const found = Object.values(matches);
    const excludedByTitle = (knownRows || []).some(function(row) {
      if (!row || typeof row === 'string' || row.excluded !== true) return false;
      return rssPreviewTitleKey_(row.title) &&
        rssPreviewTitleKey_(row.title) === rssPreviewTitleKey_(field('title'));
    });
    let status = !keys.length ? 'ambiguous' : (found.some(function(m) { return m.excluded; }) || excludedByTitle) ? 'excluded'
      : found.length > 1 ? 'ambiguous' : found.length === 1 ? 'matched' : 'new';
    // A host migration can change GUID and enclosure: title/date is a review hint, not an automatic match.
    const titleDate = rssPreviewTitleKey_(field('title')) + '|' + rssPreviewDateKey_(field('pubDate'));
    if (status === 'new' && titleDateIndex[titleDate]) status = 'ambiguous';
    if (keys.some(function(key) { return seen[key]; }) && status === 'new') status = 'ambiguous';
    keys.forEach(function(key) { seen[key] = true; });
    return { guid: guid, link: link, enclosureUrl: enclosureUrl, title: field('title'),
      pubDate: field('pubDate'), status: status };
  });
  const counts = { matched: 0, new: 0, ambiguous: 0, excluded: 0 };
  items.forEach(function(item) { counts[item.status] += 1; });
  return { mode: 'READ_ONLY', feed: url, inspected: items.length, counts: counts, items: items };
}
