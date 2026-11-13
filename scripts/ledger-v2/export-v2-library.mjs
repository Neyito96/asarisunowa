// E1: V2 → 公開図書館データ（2026-11-14）。既存の V1 用 export-library-public.mjs は残し（旧データへの復旧経路）、V2 用はこの変換器を使う。
// 入力: V2・公開台帳 / V2・人物索引 / V2・関連記事索引（任意）の CSV（見出し付き）。出力は既存と同じ公開 JSON 形式（writePublicLibrarySnapshot）。
// 守ること: 掲載判定=対象かつ代表EPだけ／タイトルが（再）の再配信は原回が公開済みなら DUPLICATE、原回が無ければ HOLD（どちらも公開しない・司令塔の判断待ち）
//           人名は人物索引の「原文で確認」だけ／見出し「未取得」の関連記事は URL だけ／音声は確認済みの証拠がある時だけ再生可にする。
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildPublicationScope } from '../../public/library/publication-scope.mjs';
import { plainDescription, safeUrl } from '../../public/library/library-core.mjs';

export function parseCsv(text) {
  const rows = [], s = String(text).replace(/^﻿/, ''); let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}
const objects = (rows) => { const [h, ...b] = rows; return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? '']))); };
const LEDGER_REQUIRED = ['EP-ID', '番組', 'タイトル', '配信日時 JST', '掲載判定', '代表EP-ID', '公式GUID', '公式個別URL', '概要（清掃済）', '出演者', '関連記事URL', '再生時間 秒', '音声URL'];
const LINK_COLUMNS = ['公式個別URL', 'Spotify', 'Apple', 'Amazon', 'Pocket Casts', 'LISTEN', 'Pody', 'YouTube', 'Omny埋込URL'];
const AUDIO_HOSTS = ['traffic.omny.fm', 'www.omnycontent.com', 'traffic.megaphone.fm', 'dcs.megaphone.fm', 'pdst.fm'];
const isRerun = (t) => /^[（(]再[)）]/.test(String(t).trim());
const baseTitle = (t) => String(t).normalize('NFKC').replace(/^[(（]再[)）]\s*/, '').replace(/#\s*\d+\s*$/, '').replace(/[\s　「」『』"“”]/g, '');
const isoDate = (d) => { const m = String(d || '').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${(m[4] || '0').padStart(2, '0')}:${m[5] || '00'}:00+09:00` : ''; };

// previousPublicIds: 現在の公開データの EP-ID 集合（再配信の原回が公開済みかの判定に使う）。verifiedAudio: { EP-ID: { url } }（既存と同じ形）
export function buildV2Library({ ledger, persons = [], related = [], previousPublicIds = new Set(), verifiedAudio = {}, decidedAt }) {
  const L = objects(ledger); LEDGER_REQUIRED.forEach((k) => { if (!(k in (L[0] || {}))) throw Error('V2_LEDGER_COLUMN_MISSING ' + k); });
  const byEp = new Map(), originals = new Map(), seen = new Set();
  for (const r of L) { if (!/^EP-\d{5}$/.test(r['EP-ID'])) throw Error('INVALID_EP_ID ' + r['EP-ID']); if (seen.has(r['EP-ID'])) throw Error('DUPLICATE_EP_ID ' + r['EP-ID']); seen.add(r['EP-ID']); byEp.set(r['EP-ID'], r); if (!isRerun(r['タイトル'])) { const k = r['番組'] + '|' + baseTitle(r['タイトル']); (originals.get(k) || originals.set(k, []).get(k)).push(r['EP-ID']); } }
  const castBy = new Map(); objects(persons).forEach((p) => { if (p['検証状態'] !== '原文で確認') return; (castBy.get(p['EP-ID']) || castBy.set(p['EP-ID'], []).get(p['EP-ID'])).push(p['索引名']); });
  const relBy = new Map(); objects(related).forEach((a) => { (relBy.get(a['EP-ID']) || relBy.set(a['EP-ID'], []).get(a['EP-ID'])).push({ title: a['見出し'] === '未取得' ? '' : a['見出し'], url: a['URL'] }); });
  const decisions = [], episodes = [], audit = [], guidSeen = new Map();
  for (const r of L) {
    const id = r['EP-ID'], show = r['番組'], title = r['タイトル']; let publication = '対象外', classification = '通常', why = '';
    if (r['掲載判定'] === '対象' && r['代表EP-ID'] === id) { publication = '対象'; why = 'V2 掲載判定=対象・代表EP'; }
    else if (r['掲載判定'] === '対象') { publication = '除外'; classification = '同一内容'; why = '代表は ' + r['代表EP-ID']; }
    else if (r['掲載判定'] === '保留' || r['掲載判定'] === '未判定' || !r['掲載判定']) { publication = '保留'; why = 'V2 掲載判定=' + (r['掲載判定'] || '空'); }
    else why = 'V2 掲載判定=' + r['掲載判定'];
    const g = String(r['公式GUID'] || '').toLowerCase();
    if (publication === '対象' && g && guidSeen.has(g)) { publication = '除外'; classification = '重複'; why = '公式GUIDが ' + guidSeen.get(g) + ' と同じ'; }
    if (publication === '対象' && isRerun(title)) { const o = (originals.get(show + '|' + baseTitle(title)) || []).filter((x) => x !== id), pub = o.filter((x) => previousPublicIds.has(x));
      publication = pub.length ? '除外' : '保留'; classification = '再配信'; why = pub.length ? '原回 ' + pub.join(' ') + ' が公開済み（再配信を新規として数えない）' : '原回が台帳に無い再配信（司令塔の判断待ち）'; }
    if (publication === '対象' && g) guidSeen.set(g, id);
    if (publication === '対象' && !isoDate(r['配信日時 JST'])) { publication = '保留'; why = '配信日時なし'; }
    decisions.push({ id, show, comparison: publication === '対象' ? '対象' : publication, publication, classification, review: '確認済み', decidedAt });
    audit.push({ id, show, title, publication, classification, why, previous: previousPublicIds.has(id) ? '公開' : '非公開' });
    if (publication !== '対象') continue;
    const audioUrl = safeUrl(r['音声URL'], AUDIO_HOSTS), rel = relBy.has(id) ? relBy.get(id) : String(r['関連記事URL'] || '').split(/\s+/).filter(Boolean).map((u) => ({ title: '', url: u }));
    const relatedArticles = rel.map((a) => ({ title: a.title, url: safeUrl(a.url) })).filter((a) => a.url);
    episodes.push({ id, show, title, date: isoDate(r['配信日時 JST']), cast: [...new Set(castBy.get(id) || [])].join(' / '), description: plainDescription(r['概要（清掃済）']), descriptionSource: r['概要（清掃済）'] ? 'v2-clean' : 'missing',
      duration: Number(r['再生時間 秒']) || 0, audio: audioUrl && verifiedAudio[id]?.url === audioUrl ? audioUrl : '', audioAvailable: !!audioUrl,
      links: [...new Set(LINK_COLUMNS.map((c) => safeUrl(r[c])).filter(Boolean))], related: relatedArticles.map((a) => a.url), relatedArticles });
  }
  const sha = createHash('sha256').update(JSON.stringify(decisions)).digest('hex');
  const snapshot = { schema: 1, source: { rawReadSHA256: sha, ledger: 'V2・公開台帳', persons: 'V2・人物索引（原文で確認のみ）', related: related.length ? 'V2・関連記事索引' : '統合台帳 関連記事URL' }, decisions };
  const scope = buildPublicationScope(snapshot); scope.version = sha;
  return { episodes, decisions, scope, audit };
}

// 公開中のデータと比べる（EP-ID 単位）。summaries: 公開中の pages/all-*.json の中身
export function compareWithPublic(episodes, previous) {
  const prev = new Map(previous.map((e) => [e.id, e])), next = new Map(episodes.map((e) => [e.id, e])), out = { added: [], removed: [], changed: [], same: 0 };
  for (const [id, e] of next) { const p = prev.get(id); if (!p) { out.added.push(id); continue; } const ch = ['show', 'title', 'date', 'cast'].filter((k) => String(p[k] ?? '') !== String(e[k] ?? '')); if (!!p.audio !== !!e.audio) ch.push('audio'); if (ch.length) out.changed.push({ id, fields: ch }); else out.same++; }
  for (const id of prev.keys()) if (!next.has(id)) out.removed.push(id);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {   // node scripts/ledger-v2/export-v2-library.mjs LEDGER.csv PERSONS.csv [RELATED.csv] [PUBLIC_DATA_DIR] [DEST]
  const [ledgerPath, personsPath, relatedPath, publicDir = 'public/library/data', dest] = process.argv.slice(2);
  const { readdir } = await import('node:fs/promises'); const prev = [];
  for (const f of (await readdir(publicDir + '/pages')).filter((x) => x.startsWith('all-'))) prev.push(...JSON.parse(await readFile(publicDir + '/pages/' + f, 'utf8')));
  const res = buildV2Library({ ledger: parseCsv(await readFile(ledgerPath, 'utf8')), persons: personsPath ? parseCsv(await readFile(personsPath, 'utf8')) : [], related: relatedPath && relatedPath !== '-' ? parseCsv(await readFile(relatedPath, 'utf8')) : [], previousPublicIds: new Set(prev.map((e) => e.id)), decidedAt: new Date().toISOString() });
  const diff = compareWithPublic(res.episodes, prev);
  console.log(JSON.stringify({ adopted: res.scope.adopted, held: res.scope.held, excluded: res.scope.excluded, added: diff.added.length, removed: diff.removed.length, changed: diff.changed.length, same: diff.same }, null, 2));
  if (dest) { const { writePublicLibrarySnapshot } = await import('../library-publication-files.mjs'); console.log(JSON.stringify(await writePublicLibrarySnapshot({ episodes: res.episodes, counts: { source: res.decisions.length }, publicationScope: res.scope, snapshotDate: new Date().toISOString().slice(0, 10), destination: dest }), null, 2)); }
}
