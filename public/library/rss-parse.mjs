/** 厳格なRSS解析(外部依存なし・通信なし)。XMLを実際にトークン化して木を作る(正規表現でタグを拾わない)。
 * 対応: XML宣言/コメント/CDATA/名前空間付きタグ(itunes:, content:)/エンティティ(&amp; &lt; &gt; &quot; &apos; &#N; &#xH;)。
 * 拒否: DOCTYPE/ENTITY宣言(外部実体・entity展開攻撃)、閉じ忘れ・不一致タグ、過大な入力。不正itemは落とさず隔離(理由つき)。 */
const MAX_BYTES = 20 * 1024 * 1024;
const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const decode = s => s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isInteger(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e] ?? m; // 未知の名前付き実体は展開しない(原文保持)
});
export class XmlError extends Error { constructor(code) { super(code); this.code = code; } }
export function parseXml(xml) {
  const src = String(xml ?? '');
  if (src.length > MAX_BYTES) throw new XmlError('XML_TOO_LARGE');
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) throw new XmlError('DTD_FORBIDDEN');
  const root = {name: '#root', children: [], attrs: {}, text: ''}, stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m, last = 0;
  while ((m = re.exec(src))) {
    if (m.index !== last) throw new XmlError('XML_MALFORMED'); // 正規表現がスキップした不正断片
    last = re.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { if (top.name !== m[2]) throw new XmlError('XML_TAG_MISMATCH'); stack.pop(); }
    else if (m[3]) {
      const attrs = {};
      for (const a of (m[4] || '').matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? '');
      const el = {name: m[3], attrs, children: [], text: ''};
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  if (last !== src.length) throw new XmlError('XML_MALFORMED');
  if (stack.length !== 1) throw new XmlError('XML_UNCLOSED');
  const rootEl = root.children.find(c => c.name === 'rss' || c.name === 'feed');
  if (!rootEl) throw new XmlError('NOT_A_FEED');
  return rootEl;
}
const child = (el, name) => el.children.find(c => c.name === name);
const text = (el, name) => (child(el, name)?.text ?? '').trim();
const httpsUrl = u => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' ? x.href : ''; } catch { return ''; } };

/** 日時検証: RFC2822/ISO。未来(>1日)・2010年より前・解釈不能は無効。 */
export function validPubDate(s, nowMs = Date.now()) {
  const t = Date.parse(String(s || '').trim());
  if (!Number.isFinite(t) || t < Date.UTC(2010, 0, 1) || t > nowMs + 86400e3) return '';
  return new Date(t).toISOString();
}
/** feed: {feedKey, expectedShow?}。feedKey = 公式RSSの番組identity(番組ID or 正規化したRSS URL)。
 * 戻り値 items には feedKey を付与。GUID照合は (feedKey, guid) の複合キー(他番組との衝突に強い)。 */
export function parseFeedStrict(xml, {feedKey, expectedShow = null, nowMs = Date.now()} = {}) {
  if (!feedKey) throw new XmlError('FEED_KEY_REQUIRED');
  const rss = parseXml(xml), channel = child(rss, 'channel');
  if (!channel) throw new XmlError('NO_CHANNEL');
  const show = text(channel, 'title'), problems = [], quarantined = [], items = [], seen = new Map();
  if (expectedShow && show !== expectedShow) problems.push('SHOW_IDENTITY_MISMATCH'); // 番組IDが違うフィードは丸ごと信用しない
  for (const it of channel.children.filter(c => c.name === 'item')) {
    const g = child(it, 'guid'), guid = (g?.text || '').trim(), title = text(it, 'title');
    const q = reason => quarantined.push({reason, guid, title});
    if (problems.includes('SHOW_IDENTITY_MISMATCH')) { q('SHOW_IDENTITY_MISMATCH'); continue; }
    if (!guid) { q('NO_STRONG_ID'); continue; }
    if (guid.length > 300 || /[\u0000-\u001f]/.test(guid)) { q('BAD_GUID'); continue; }
    const pubDate = validPubDate(text(it, 'pubDate'), nowMs);
    if (!pubDate) { q('BAD_PUBDATE'); continue; }
    if (!title) { q('NO_TITLE'); continue; }
    const enc = child(it, 'enclosure'), audio = httpsUrl(enc?.attrs?.url), link = httpsUrl(text(it, 'link'));
    const rec = {feedKey, guid, show, title, pubDate, audio, link, description: child(it, 'description')?.text?.trim() || child(it, 'content:encoded')?.text?.trim() || '', duration: text(it, 'itunes:duration')};
    if (seen.has(guid)) { // 同一feed内の重複: 内容が同じなら畳む、違えば衝突として隔離
      const p = seen.get(guid); if (p.title !== title || p.pubDate !== pubDate) { q('DUPLICATE_GUID_CONFLICT'); } continue;
    }
    seen.set(guid, rec); items.push(rec);
  }
  return {ok: !problems.length, show, feedKey, itemCount: items.length + quarantined.length, items, quarantined, problems};
}
