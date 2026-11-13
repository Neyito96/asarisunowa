// Issue #274: RSS 投稿の番組で RSS が LISTEN 欄に入る不具合・短縮URL・既存値の修復・定期巡回の設置（承認後のみ）
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function load(globals = {}) {
  const ctx = vm.createContext({ console: { log() {} }, ...globals });
  vm.runInContext(fs.readFileSync('scripts/google-apps-script/PodcastPlatformSync.js', 'utf8'), ctx);
  return ctx;
}
const blank = () => ({ spotify: '', apple: '', pocketcasts: '', listen: '', standfm: '', amazon: '', youtube: '', pody: '', website: '', artwork: '', rss: '', genre: '' });
const resp = (code, loc) => ({ getResponseCode: () => code, getHeaders: () => (loc ? { Location: loc } : {}) });

test('ポッドキャスト茶会（RSS投稿）: RSS は RSS 欄だけ・RSS の <link> から LISTEN 番組ページが入る', () => {
  const c = load(), r = blank();
  c.applyKnownPodcastUrl_(r, 'https://rss.listen.style/p/podthakai/rss');
  assert.equal(r.listen, ''); assert.equal(r.rss, 'https://rss.listen.style/p/podthakai/rss'); assert.equal(r.website, '');
  c.applyKnownPodcastUrl_(r, 'https://listen.style/p/podthakai');   // フィードの <link>
  assert.equal(r.listen, 'https://listen.style/p/podthakai');
  for (const u of ['https://anchor.fm/s/a19e5164/podcast/rss', 'https://stand.fm/rss/69df8fe3828ab6b195a8cd0f', 'https://feeds.megaphone.fm/TAC5984069945', 'https://www.omnycontent.com/d/playlist/x/y/z/podcast.rss', 'https://eiga-fun-radio.seesaa.net/index20.rdf', 'https://gekidannono.com/wp/archives/nonoradio/feed/nonoradio/'])
    assert.equal(c.isPodcastFeedUrl_(u), true, u);
  for (const u of ['https://listen.style/p/podthakai', 'https://open.spotify.com/show/7dDe6pPYCdUUDQ2AL40xtE', 'https://stand.fm/channels/69df8fe3828ab6b195a8cd0f'])
    assert.equal(c.isPodcastFeedUrl_(u), false, u);
});

test('Apple 投稿・Spotify 投稿の番組も従来どおり分類（番組URLの ?si= は落とす）', () => {
  const c = load(), r = blank();
  c.applyKnownPodcastUrl_(r, 'https://open.spotify.com/show/3NdPcDtxhkuHCvDTQ1MmwQ?si=390703b62b454254');
  c.applyKnownPodcastUrl_(r, 'https://podcasts.apple.com/jp/podcast/x/id1757557634?uo=4');
  assert.equal(r.spotify, 'https://open.spotify.com/show/3NdPcDtxhkuHCvDTQ1MmwQ'); assert.equal(r.apple, 'https://podcasts.apple.com/jp/podcast/x/id1757557634');
});

test('短縮URLは転送先をたどって確かめてから使う・たどれなければ使わない', () => {
  const hops = { 'https://x.gd/ifxHV': resp(301, 'https://open.spotify.com/show/0dWvU0ZpReAn4Vb7inQu7c?si=1'), 'https://x.gd/dead': resp(404), 'https://x.gd/loop': resp(302, 'https://x.gd/loop') };
  const c = load({ UrlFetchApp: { fetch: (u) => { if (!hops[u]) throw new Error('使用できないアドレス'); return hops[u]; } } });
  assert.equal(c.resolvePodcastShortUrl_('https://x.gd/ifxHV'), 'https://open.spotify.com/show/0dWvU0ZpReAn4Vb7inQu7c?si=1');
  assert.equal(c.resolvePodcastShortUrl_('https://x.gd/dead'), ''); assert.equal(c.resolvePodcastShortUrl_('https://x.gd/loop'), ''); assert.equal(c.resolvePodcastShortUrl_('https://x.gd/err'), '');
  const r = blank(); c.applyKnownPodcastUrl_(r, 'https://x.gd/ifxHV'); assert.equal(r.spotify, 'https://open.spotify.com/show/0dWvU0ZpReAn4Vb7inQu7c');
  const r2 = blank(); c.applyKnownPodcastUrl_(r2, 'https://x.gd/dead'); assert.deepEqual(r2, blank());
});

test('既存値の修復: LISTEN 欄のフィードURLは LISTEN 番組ページが取れた時だけ置換・Spotify 欄の短縮URLは show に解決できた時だけ置換', () => {
  const c = load();
  const ex = { listen: 'https://rss.listen.style/p/podthakai/rss', spotify: 'https://x.gd/ifxHV', rss: 'https://rss.listen.style/p/podthakai/rss' };
  const rep = c.podcastRepairUpdates_(ex, { listen: 'https://listen.style/p/podthakai' }, () => 'https://open.spotify.com/show/0dWvU0ZpReAn4Vb7inQu7c?si=1');
  assert.deepEqual(JSON.parse(JSON.stringify(rep)).map((x) => [x.field, x.column, x.value]), [['LISTEN', 8, 'https://listen.style/p/podthakai'], ['Spotify', 6, 'https://open.spotify.com/show/0dWvU0ZpReAn4Vb7inQu7c']]);
  assert.deepEqual(c.podcastRepairUpdates_({ listen: 'https://rss.listen.style/p/a/rss', spotify: 'https://x.gd/z' }, { listen: '' }, () => 'https://www.youtube.com/@x').length, 0);   // 確かめられない時は直さない
  assert.equal(c.podcastRepairUpdates_({ listen: 'https://listen.style/p/ok', spotify: 'https://open.spotify.com/show/aaaaaaaaaaaaaaaaaaaaaa' }, { listen: 'https://listen.style/p/other' }).length, 0);   // 正しい値は触らない
});

test('定期巡回の設置は承認後だけ・二重に作らない', () => {
  const triggers = [], props = {};
  const builder = { timeBased: () => builder, everyDays: () => builder, atHour: () => builder, nearMinute: () => builder, create: () => { triggers.push({ getHandlerFunction: () => 'syncAllPodcastPlatforms', getEventType: () => 'CLOCK' }); } };
  const c = load({ PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] }) }, ScriptApp: { getProjectTriggers: () => triggers, newTrigger: () => builder, deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1) } });
  assert.equal(c.installPodcastPlatformDailyTrigger().status, 'NOT_APPROVED'); assert.equal(triggers.length, 0);
  props.APPROVE_PODCAST_PLATFORM_DAILY = 'yes';
  assert.equal(c.installPodcastPlatformDailyTrigger().status, 'INSTALLED'); assert.equal(c.installPodcastPlatformDailyTrigger().status, 'ALREADY_INSTALLED'); assert.equal(triggers.length, 1);
  assert.equal(c.removePodcastPlatformDailyTrigger().deleted, 1);
});
