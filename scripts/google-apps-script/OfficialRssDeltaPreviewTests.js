/** Safe offline checks; no network or writes. */
function testRssPreviewKeys_() {
  function check(condition, label) { if (!condition) throw new Error(label); }
  const clip = '71fc3de6-0be4-4cb3-b916-b4de005fb256';
  const omny = rssPreviewKeys_('https://traffic.omny.fm/d/clips/1e3bd144-9b57-451a-93cf-ac0e00e74446/50382bb4-3af3-4250-8ddc-ac0f0033ceb5/' + clip + '/audio.mp3?utm_source=Podcast');
  check(omny.indexOf('omny-clip:' + clip) !== -1, 'Omny clip identity');
  check(omny.indexOf('omny-clip:1e3bd144-9b57-451a-93cf-ac0e00e74446') === -1, 'Omny account not clip');
  const audio = rssPreviewKeys_('https://pdst.fm/e/traffic.megaphone.fm/TASC3318620564.mp3');
  check(audio.indexOf('megaphone-audio:tasc3318620564') !== -1, 'Megaphone audio identity');
  const feed = rssPreviewKeys_('https://feeds.megaphone.fm/TASC9421488254');
  check(feed.every(function(k) { return k.indexOf('megaphone-audio:') !== 0; }), 'RSS feed not audio');
  return { ok: true, assertions: 4 };
}

function testRssPreviewNormalization_() {
  function check(condition, label) { if (!condition) throw new Error(label); }
  check(rssPreviewTitleKey_('  報談　 テスト  ') === '報談 テスト', 'NFKC and whitespace normalization');
  check(rssPreviewTitleKey_('ABC   DEF') === 'abc def', 'ASCII whitespace normalization');
  check(rssPreviewDateKey_('2026-10-09T04:00:00+09:00') === '2026-10-09', 'JST date');
  check(rssPreviewDateKey_('2026/10/09 04:00') === '2026-10-09', 'Ledger JST display date');
  return { ok: true, assertions: 4 };
}

/** Integration-style fixture with stubbed GAS services. No HTTP or sheet mutation. */
function testRssPreviewMigrationFixture_() {
  const oldFetch = UrlFetchApp.fetch;
  const oldParse = XmlService.parse;
  const oldFormat = Utilities.formatDate;
  function check(ok, message) { if (!ok) throw new Error(message); }
  function element(fields) {
    return {
      getChildText: function(k) { return fields[k] || ''; },
      getChild: function(k) {
        return k === 'enclosure' ? {
          getAttribute: function(a) { return a === 'url' ? { getValue: function() { return fields.audio || ''; } } : null; }
        } : null;
      }
    };
  }
  const samples = [
    { title: '報談　テスト', pubDate: 'Fri, 09 Oct 2026 04:00:00 +0900', guid: 'new-host-1', audio: 'https://traffic.megaphone.fm/TASC00001.mp3' },
    { title: '除外した回', pubDate: 'Fri, 09 Oct 2026 04:00:00 +0900', guid: 'new-host-2', audio: 'https://traffic.megaphone.fm/TASC00002.mp3' },
    { title: '完全な新着', pubDate: 'Fri, 09 Oct 2026 04:00:00 +0900', guid: 'new-host-3', audio: 'https://traffic.megaphone.fm/TASC00003.mp3' }
  ];
  try {
    UrlFetchApp.fetch = function() { return { getResponseCode: function() { return 200; }, getContentText: function() { return '<rss />'; } }; };
    XmlService.parse = function() { return { getRootElement: function() { return {
      getName: function() { return 'rss'; },
      getChild: function(k) { return k === 'channel' ? { getChildren: function() { return samples.map(element); } } : null; }
    }; } }; };
    Utilities.formatDate = function(date) {
      const t = date.getTime() + 9 * 3600000;
      return new Date(t).toISOString().slice(0, 10);
    };
    const result = previewOfficialRssDelta_('https://example.org/feed', [
      { title: '報談 テスト', pubDate: '2026/10/09 04:00', externalId: 'old-omny-id', excluded: false },
      { title: '除外した回', externalId: 'old-removed-id', excluded: true }
    ], 20);
    check(result.inspected === 3, 'fixture inspected');
    check(result.items[0].status === 'ambiguous', 'cross-host title/date held');
    check(result.items[1].status === 'excluded', 'excluded title held');
    check(result.items[2].status === 'new', 'genuine new candidate');
    return { ok: true, assertions: 4, counts: result.counts };
  } finally {
    UrlFetchApp.fetch = oldFetch;
    XmlService.parse = oldParse;
    Utilities.formatDate = oldFormat;
  }
}
