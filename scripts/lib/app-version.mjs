// 画面（アプリ）の版を「日付版」で返す: そのフォルダのコード（data/ と .json を除く）を最後に変えたコミットの日付（日本時間）。
// 同じ日に2回以上変えていれば後ろに回数を付ける（v2026.11.21 → v2026.11.21.2）。手で上げる定数は作らない（上げ忘れ防止・#430）。
// git の履歴が浅い（actions/checkout の既定）と正しく数えられないので、同期ワークフローは fetch-depth: 0 で取得する。
import { execFileSync } from 'node:child_process';

export function versionFromDates(dates) {
  const list = (dates || []).filter(Boolean);
  if (!list.length) return '';
  const d = list[0], n = list.filter((x) => x === d).length;
  return 'v' + d.replace(/-/g, '.') + (n > 1 ? '.' + n : '');
}

export function appVersion(dir, run) {
  const exec = run || ((args) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Tokyo' }, stdio: ['ignore', 'pipe', 'ignore'] }));
  try {
    const out = exec(['log', '--format=%cd', '--date=format-local:%Y-%m-%d', '--', dir, `:(exclude)${dir}/data`, `:(exclude,glob)${dir}/**/*.json`]);   // データ（.json）の自動コミットは版に数えない
    return versionFromDates(String(out).trim().split('\n'));
  } catch { return ''; }
}
