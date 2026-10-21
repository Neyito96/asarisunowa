import { cleanDescription } from './library-clean.mjs';
export const normal = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Same exclusion rule as the existing libV2CpBlocked_; unknown states fail closed.
export const blocked = value => !!normal(value) && !['未指定', 'なし', 'false', '0', 'no'].includes(normal(value));
export function safeUrl(value, hosts) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!hosts || hosts.includes(u.hostname)) ? u.href : ''; } catch { return ''; }
}
export function plainDescription(value) {
  return cleanDescription(String(value ?? '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''));
}
export function publicEpisode(row, verified = {}) {
  const urls = [row[8], row[9], row[11], row[12], row[10], row[43]].map(x => safeUrl(x)).filter(Boolean);
  const audioUrl = safeUrl(row[14], ['traffic.omny.fm', 'www.omnycontent.com', 'traffic.megaphone.fm', 'dcs.megaphone.fm', 'pdst.fm']);
  const audio = audioUrl && verified[row[0]]?.url === audioUrl ? audioUrl : '';
  const cast = [...new Set([row[23], ...row.slice(45,50)].filter(Boolean).map(String))].join(' / ');
  const description = plainDescription(row[22] || row[21]);
  const dateMatch = String(row[3] || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{2}):(\d{2}))?/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}T${dateMatch[4] || '00'}:${dateMatch[5] || '00'}:00+09:00` : '';
  return { id: row[0], show: row[1], title: String(row[2] || ''), date, cast, description, descriptionSource: row[22] ? 'clean' : row[21] ? 'raw-rendered' : 'missing', duration: Number(row[15]) || 0, audio, audioAvailable: !!audioUrl, links: [...new Set(urls.length ? urls : audioUrl ? [audioUrl] : [])], related: String(row[28] || '').split(/\s+/).map(x=>safeUrl(x)).filter(Boolean) };
}
export function filterEpisodes(items, { query='', show='', order='newest', from='', to='' } = {}) {
  const terms = normal(query).split(' ').filter(Boolean);
  return items.filter(x => (!show || x.show === show) && (!from || x.date.slice(0,10) >= from) && (!to || x.date.slice(0,10) <= to) && terms.every(t => normal(`${x.title} ${x.cast} ${x.keywords || x.description || ''} ${x.id}`).includes(t))).sort((a,b) => (order === 'oldest' ? 1 : -1) * a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
