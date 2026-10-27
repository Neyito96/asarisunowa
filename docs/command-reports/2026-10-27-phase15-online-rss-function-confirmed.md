# Phase15 Online LibraryOfficialEngine.rss source evidence

2026-10-27 JST, user-pasted full `function rss(feed)`; READ_ONLY inspection, no GAS/Sheets/trigger changes.

- URL allowlist accepts official Omny playlist prefix and Megaphone TASC feeds.
- Calls `UrlFetchApp.fetch(feed.url,{muteHttpExceptions:true})`, requires HTTP 200, parses XML with `XmlService.parse` and requires RSS channel.
- Returns `root.getChildren('item').map(...)` with GUID/title/pubDate/description/link/enclosure audio/itunes duration/itunes image/feedUrl/show. There is no `.slice(0,3)` or item count limit in this function, no explicit retry, pagination, cache or application-level timeout guard. The platform may have implicit limits; no claim that network fetch has infinite time.
- V18 calls E.rss for each of eight configured feeds and only later filters seven days, loads entire ledger/history/V3 and creates a 180-second deadline. Early RSS fetches are outside the deadline. 05:11 earlier log reports outOfWindow 6483, but the 06:15 internal bottleneck remains undetermined.
- User-recalled seven by three specification applies to FAST_RSS_SHADOW_V2 lightweight read-only monitor, not to this V18 rss function.
- Independent rowHash definition and production formal writer still NOT_VERIFIED. Official RSS complete daily diff remains SOURCE_PENDING. Production EP-06632 protected; COPY ID migration prohibited. All non-GitHub writes zero.
