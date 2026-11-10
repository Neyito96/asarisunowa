#!/usr/bin/env node
// READ_ONLY: git ref のソースから「接続先の事実」だけを抽出する(Sheet ID / GAS Script ID / デプロイID / トリガー定義 / Script Propertyの**キー名** / 外部ホスト / Actionsのsecret**名**)。
// 値(トークン・キー・secret本文)は一切読まない・出力しない。使い方: node scripts/ops/scan-resources.mjs REF [REF...] > facts.json
import {execFileSync} from 'node:child_process';
const git = (...a) => execFileSync('git', a, {encoding: 'utf8', maxBuffer: 1 << 28});
const ID = /(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{42,62}(?![A-Za-z0-9_-])/g, hex = s => /^[0-9a-f]+$/.test(s);
const kindOf = (line, id) => /script\.google\.com\/(?:home\/)?projects\/|script[ _-]?id|scriptId|SCRIPT_ID/i.test(line) ? 'script' : /spreadsheets\/d\/|spreadsheetId|openById|SHEET_ID|sheetId|copyId|sheet ID|Sheet|シート/i.test(line) ? 'sheet' : /forms\/d\//.test(line) ? 'form' : 'unknown';
export function scan(ref) {
  const files = git('ls-tree', '-r', '--name-only', ref).split('\n').filter(f => /^(scripts|app|lib|worker|tools|\.github|docs)\//.test(f) && /\.(js|gs|mjs|cjs|ts|tsx|yml|yaml|md|json)$/.test(f) && !/package-lock|\.json\.gz|docs\/audits\/2026-10-21-phase9|measurements\.json|write-batches|description-plan|link-checks|integration-plan/.test(f));
  const out = {ref, ids: {}, deployments: {}, triggers: [], propertyKeys: {}, hosts: {}, secrets: {}};
  for (const f of files) { let text; try { text = git('show', `${ref}:${f}`); } catch { continue; } const lines = text.split('\n');
    const gas = /^scripts\/(google-apps-script|copy-gas-proposal)\//.test(f), hasFetch = /UrlFetchApp|fetch\(/.test(text);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(ID)) { const id = m[0]; if (hex(id) || id.length < 44) continue; (out.ids[id] ||= {kinds: {}, files: new Set()}); const k = kindOf(line, id); out.ids[id].kinds[k] = (out.ids[id].kinds[k] || 0) + 1; out.ids[id].files.add(f); }
      for (const m of line.matchAll(/AKfycb[A-Za-z0-9_-]{20,}/g)) (out.deployments[m[0].slice(0, 12) + '…'] ||= new Set()).add(f);
      if (gas && /ScriptApp\.newTrigger\(([^)]*)\)/.test(line)) out.triggers.push({file: f, line: i + 1, handler: line.match(/newTrigger\(([^)]*)\)/)[1].trim(), timing: (line.match(/\.(everyMinutes|everyHours|everyDays|atHour|after|nearMinute)\(([^)]*)\)/g) || []).join('') || null});
      for (const m of line.matchAll(/(?:getProperty|setProperty|deleteProperty)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) (out.propertyKeys[m[1]] ||= new Set()).add(f);
      for (const m of line.matchAll(/secrets\.([A-Z0-9_]+)/g)) (out.secrets[m[1]] ||= new Set()).add(f);
    });
    if (gas && hasFetch) for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-z]{2,})/g)) (out.hosts[m[1]] ||= new Set()).add(f);
  }
  const fin = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v instanceof Set ? [...v].sort() : v && v.files ? {...v, files: [...v.files].sort()} : v]));
  out.ids = fin(out.ids); out.deployments = fin(out.deployments); out.propertyKeys = fin(out.propertyKeys); out.hosts = fin(out.hosts); out.secrets = fin(out.secrets); return out;
}
if (process.argv[1] && process.argv[1].endsWith('scan-resources.mjs')) { const refs = process.argv.slice(2); if (!refs.length) throw Error('Usage: node scripts/ops/scan-resources.mjs REF [REF...]'); console.log(JSON.stringify(refs.map(scan), null, 1)); }
