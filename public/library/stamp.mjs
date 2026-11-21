// 画面に出す「データ更新」と「アプリ版」の1行（#430）。蔵と宇宙で共用。
// generatedAt: 同期でデータを作った時刻（ISO）、newest: 最新回 {date:'YYYY-MM-DD'}、count: 回数、app: 'v2026.11.21' など
const jst = (iso) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return isNaN(d) ? null : d; };
export function stampText({ generatedAt, newest, count, app, compact = false } = {}) {
  const parts = [], d = generatedAt && jst(generatedAt);
  // compact: 宇宙の題字の下など狭い所用。「11/21 更新 · 6,097回 · v11.21.2」（年と時刻、最新回は省く）
  if (compact) {
    if (d) parts.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()} 更新`);
    if (count) parts.push(`${Number(count).toLocaleString('ja-JP')}回`);
    if (app) parts.push(String(app).replace(/^v\d{4}\./, 'v'));
    return parts.join(' · ');
  }
  if (d) parts.push(`データ ${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} 更新`);
  if (newest?.date) parts.push(`最新回 ${Number(newest.date.slice(5, 7))}/${Number(newest.date.slice(8, 10))}`);
  if (count) parts.push(`${Number(count).toLocaleString('ja-JP')}回`);
  if (app) parts.push(app);
  return parts.join(' · ');
}
