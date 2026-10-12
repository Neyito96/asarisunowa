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
