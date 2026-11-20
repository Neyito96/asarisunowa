// 画面に出す「データ更新」と「アプリ版」の1行（#430）。蔵と宇宙で共用。
// generatedAt: 同期でデータを作った時刻（ISO）、newest: 最新回 {date:'YYYY-MM-DD'}、count: 回数、app: 'v2026.11.21' など
const jst = (iso) => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return isNaN(d) ? null : d; };
export function stampText({ generatedAt, newest, count, app } = {}) {
  const parts = [], d = generatedAt && jst(generatedAt);
  if (d) parts.push(`データ ${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} 更新`);
  if (newest?.date) parts.push(`最新回 ${Number(newest.date.slice(5, 7))}/${Number(newest.date.slice(8, 10))}`);
  if (count) parts.push(`${Number(count).toLocaleString('ja-JP')}回`);
  if (app) parts.push(app);
  return parts.join(' · ');
}
