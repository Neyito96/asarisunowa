/**
 * Phase 22 | Apple Podcasts old-episode Search API probe
 * READ_ONLY. No Sheets/GAS properties/trigger changes or persistent writes.
 * Uses official public Lookup, RSS feedUrl, and iTunes Search API only.
 * Pilot: ニュースの現場から (2022/2023/2024: one episode each).
 */
function P22_APPLE_SEARCH_OLD_EPISODE_PROBE() {
  const SHOW = { name: 'ニュースの現場から', id: '1526773927' };
  const YEARS = [2022, 2023, 2024];
  const requestLog = [];
  const lookupUrl = 'https://itunes.apple.com/lookup?id=' + SHOW.id +
    '&entity=podcastEpisode&country=jp&limit=200';

  function get(url, label) {
    const r = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, followRedirects: true,
      headers: { Accept: 'application/json,application/xml,text/xml' }
    });
    requestLog.push({ label: label, http: r.getResponseCode() });
    if (r.getResponseCode() !== 200) throw new Error(label + ' HTTP ' + r.getResponseCode());
    return r.getContentText();
  }
  function norm(s) {
    return String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
  function childText(node, key) {
    const child = node.getChild(key);
    return child ? (child.getText() || '').trim() : '';
  }
  function day(s) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  function safeUrl(ep) {
    const url = String(ep.trackViewUrl || '');
    return /^https:\/\/podcasts\.apple\.com\//.test(url) && /[?&]i=\d+/.test(url)
      ? url : null;
  }
  try {
    const lookup = JSON.parse(get(lookupUrl, 'appleLookup'));
    const podcast = (lookup.results || []).filter(function(x) {
      return x.collectionType === 'Podcast' || x.wrapperType === 'collection';
    })[0] || (lookup.results || [])[0] || {};
    if (!podcast.feedUrl) throw new Error('No official feedUrl from Apple Lookup');
    const recent = (lookup.results || []).filter(function(x) {
      return x.wrapperType === 'podcastEpisode';
    });
    const recentGuids = new Set(recent.map(function(x) {
      return String(x.episodeGuid || '').trim();
    }).filter(Boolean));
    const oldestRecent = recent.map(function(x) { return x.releaseDate || ''; })
      .filter(Boolean).sort()[0] || null;
    const rss = XmlService.parse(get(podcast.feedUrl, 'appleFeedUrlRSS'));
    const channel = rss.getRootElement().getChild('channel');
    if (!channel) throw new Error('No RSS channel');
    const all = channel.getChildren('item').map(function(item) {
      return {
        title: childText(item, 'title'), guid: childText(item, 'guid'),
        published: childText(item, 'pubDate')
      };
    }).filter(function(x) { return x.title && x.guid && !isNaN(Date.parse(x.published)); });
    const selected = YEARS.map(function(y) {
      const c = all.filter(function(x) {
        const d = new Date(x.published);
        return d.getUTCFullYear() === y && x.title.length >= 12 &&
          !recentGuids.has(x.guid) &&
          (!oldestRecent || d.getTime() < Date.parse(oldestRecent));
      }).sort(function(a,b) {
        const mid = Date.UTC(y, 5, 30);
        return Math.abs(Date.parse(a.published)-mid) - Math.abs(Date.parse(b.published)-mid);
      });
      return c.length ? c[0] : null;
    }).filter(Boolean);
    const findings = [];
    selected.forEach(function(target) {
      const term = norm(target.title).slice(0, 90);
      const searchUrl = 'https://itunes.apple.com/search?media=podcast' +
        '&entity=podcastEpisode&country=jp&limit=200&term=' + encodeURIComponent(term);
      const data = JSON.parse(get(searchUrl, 'appleSearch:' + target.guid.slice(0, 28)));
      const episodes = (data.results || []).filter(function(x) {
        return x.wrapperType === 'podcastEpisode';
      });
      const sameShow = episodes.filter(function(x) {
        return String(x.collectionId || '') === SHOW.id;
      });
      const guidExact = sameShow.filter(function(x) {
        return String(x.episodeGuid || '').trim() === target.guid;
      });
      const plausible = sameShow.filter(function(x) {
        return norm(x.trackName) === norm(target.title) &&
          day(x.releaseDate) === day(target.published);
      });
      const verified = guidExact.filter(function(x) { return !!safeUrl(x); });
      findings.push({
        rssYear: new Date(target.published).getUTCFullYear(),
        rssTitle: target.title.slice(0, 130), rssGuid: target.guid,
        rssDateJST: day(target.published), searchTerm: term,
        returnedEpisodes: episodes.length, sameShow: sameShow.length,
        exactGuidMatches: guidExact.length,
        exactTitleAndDayCandidates: plausible.length,
        validatedIndividualUrls: verified.map(function(x) { return safeUrl(x); }).slice(0, 3),
        status: verified.length === 1 ? 'GUID_VERIFIED_URL_FOUND' :
          (verified.length > 1 ? 'AMBIGUOUS_DUPLICATE_GUID' :
            (plausible.length ? 'CANDIDATE_ONLY_NO_GUID_PROOF' : 'NOT_FOUND')),
        candidateExamples: plausible.slice(0, 2).map(function(x) {
          return { trackId: x.trackId || null, episodeGuid: x.episodeGuid || null,
            releaseDate: x.releaseDate || null, url: safeUrl(x) };
        })
      });
    });
    Logger.log(JSON.stringify({ mode: 'READ_ONLY', phase: 'P22_SEARCH_OLD_EPISODE',
      show: SHOW.name, showId: SHOW.id, rssItems: all.length,
      newestLookupOldest: oldestRecent, testedYears: YEARS,
      testedEpisodes: findings.length, verifiedOldUrls: findings.reduce(function(n,x) {
        return n + (x.status === 'GUID_VERIFIED_URL_FOUND' ? 1 : 0);
      }, 0), findings: findings, requests: requestLog, writes: 0 }));
  } catch (e) {
    Logger.log(JSON.stringify({ mode: 'READ_ONLY', phase: 'P22_SEARCH_OLD_EPISODE',
      status: 'FAILED_NO_WRITES', error: String(e).slice(0, 350),
      requests: requestLog, writes: 0 }));
    throw e;
  }
}