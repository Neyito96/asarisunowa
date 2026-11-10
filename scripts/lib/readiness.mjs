// 宇宙公開(11/17)前の公開データ点検。純関数・READ_ONLY。
export const EXCLUDED_PUBLIC_SHOWS = ['アルキキ', 'AJW', '朝ポキTV'];
const AD = [/@asahi\.com/i, /forms\.gle/i, /docs\.google\.com\/forms/i, /Learn more about your ad choices/i, /megaphone\.fm\/adchoices/i, /omnystudio\.com\/listener/i, /<\/?[a-z][^>]*>/i];
export function checkPublicSnapshot(episodes, manifest = null) {
  const issues = { duplicateIds: [], excludedShows: [], missingCore: [], adResidue: [], unsafeLinks: [], emptyDescription: [], countMismatch: [] };
  const ids = new Set();
  for (const e of episodes) {
    if (ids.has(e.id)) issues.duplicateIds.push(e.id); ids.add(e.id);
    if (EXCLUDED_PUBLIC_SHOWS.includes(e.show)) issues.excludedShows.push(e.id);
    if (!e.id || !e.show || !e.title || !e.date) issues.missingCore.push(e.id || '(no id)');
    if (!String(e.description || '').trim()) issues.emptyDescription.push(e.id);
    else if (AD.some((re) => re.test(e.description))) issues.adResidue.push(e.id);
    for (const u of [...(e.links || []), ...(e.related || [])]) { try { const x = new URL(u); if (x.protocol !== 'https:' || x.username || x.password) issues.unsafeLinks.push(`${e.id}:${u}`); } catch { issues.unsafeLinks.push(`${e.id}:${u}`); } }
  }
  if (manifest) { if (manifest.total !== episodes.length) issues.countMismatch.push(`manifest.total=${manifest.total} actual=${episodes.length}`); const sum = (manifest.shows || []).reduce((n, s) => n + s.count, 0); if (sum !== manifest.total) issues.countMismatch.push(`showsSum=${sum} total=${manifest.total}`); }
  const counts = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length]));
  // 致命: 重複・除外番組混入・必須欠落・件数不一致・安全でないリンク。広告混入/概要欠損は件数を示して警告(公開判断材料)。
  const fatal = counts.duplicateIds + counts.excludedShows + counts.missingCore + counts.countMismatch + counts.unsafeLinks;
  return { total: episodes.length, counts, fatal, ok: fatal === 0, examples: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.slice(0, 5)])) };
}
