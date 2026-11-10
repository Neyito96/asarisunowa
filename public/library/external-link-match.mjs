// 外部共同編集原本（READ ONLY）→ 本番台帳 の個別エピソードURL補完候補を作る純粋関数群。
// 方針: 書き込みなし / 既存の非空URLは上書きしない / 番組名だけ・タイトルだけの一致は確定にしない。
// 入力は配列のみ（Sheets/ネットワークに触れない）。

export const TAB_TO_SHOW = {
  'ニュースの現場から': 'ニュースの現場から',
  'メディアトーク': 'MEDIA TALK',
  'ドーナツ': 'ドーナツ',
  'スポンジ': 'スポンジ',
  'SDGs': 'SDGsを話そう',
  '報談': '報談',
  'ニュースの学校': 'ニュースの学校',
};

// 本番台帳（0始まり列）: A=0 台帳ID, B=1 番組, C=2 タイトル, D=3 配信日時JST, G=6 外部ID,
// I=8 元ページURL, J=9 公式個別URL, L=11 Spotify, AP=41 Pocket Casts
export const PROD_COL = { id: 0, show: 1, title: 2, date: 3, extId: 6, page: 8, official: 9, spotify: 11, pocket: 41 };
// 外部原本（0始まり列）: A=0 Omny URL, B=1 日付(RFC), C=2 タイトル, L=11 Spotify, M=12 朝日公式, N=13 Pocket Casts
export const EXT_COL = { omny: 0, date: 1, title: 2, spotify: 11, asahi: 12, pocket: 13 };

const s = (v) => (v == null ? '' : String(v).trim());

export function omnySlug(url) {
  const m = s(url).match(/^https?:\/\/omny\.fm\/shows\/([^/]+)\/([^/?#\s]+)/i);
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : '';
}
export function asahiItemId(url) {
  const m = s(url).match(/[?&]itemid=([0-9a-f-]{36})/i);
  return m ? m[1].toLowerCase() : '';
}
export function spotifyEpisodeId(url) {
  const m = s(url).match(/^https?:\/\/open\.spotify\.com\/episode\/([A-Za-z0-9]{22})(?:[?#].*)?$/);
  return m ? m[1] : '';
}
export function pocketEpisodeId(url) {
  const m = s(url).match(/^https?:\/\/pca\.st\/episode\/([0-9a-f-]{36})\/?$/i);
  return m ? m[1].toLowerCase() : '';
}
export function normalizeTitle(t) {
  return s(t).normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[\u200b-\u200f\u2028\u2029]/g, "");
}
// "Fri, 18 Aug 2023 19:00:00 +0000" → JST日付 "2023-08-19"
export function extDateJst(v) {
  const d = new Date(s(v));
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}
// "2025/02/24 4:00" → "2025-02-24"
export function prodDate(v) {
  const m = s(v).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

function pushMap(map, key, val) {
  if (!key) return;
  const a = map.get(key);
  if (a) a.push(val); else map.set(key, [val]);
}

// prodRows: 見出しなしの本番台帳行 / extTabs: { タブ名: 見出し・説明行を除いたデータ行 }
export function matchExternalLinks(prodRows, extTabs) {
  const idx = { page: new Map(), item: new Map(), extId: new Map(), td: new Map(), sp: new Map(), pc: new Map() };
  const prod = prodRows.map((r, i) => {
    const p = {
      i, id: s(r[PROD_COL.id]), show: s(r[PROD_COL.show]), title: s(r[PROD_COL.title]),
      date: prodDate(r[PROD_COL.date]), slug: omnySlug(r[PROD_COL.page]),
      item: asahiItemId(r[PROD_COL.official]) || '', guid: s(r[PROD_COL.extId]).toLowerCase(),
      spotify: s(r[PROD_COL.spotify]), pocket: s(r[PROD_COL.pocket]),
    };
    p.spId = spotifyEpisodeId(p.spotify); p.pcId = pocketEpisodeId(p.pocket);
    p.feed = p.slug.split("/")[0] || "";
    p.nt = normalizeTitle(p.title);
    return p;
  });
  for (const p of prod) {
    pushMap(idx.page, p.slug, p); pushMap(idx.item, p.item, p); pushMap(idx.extId, p.guid, p);
    pushMap(idx.td, `${p.show}|${p.date}|${p.nt}`, p);
    pushMap(idx.sp, p.spId, p); pushMap(idx.pc, p.pcId, p);
  }

  const out = [];
  const seenKey = new Map(); // 外部原本内の重複検出
  for (const [tab, rows] of Object.entries(extTabs)) {
    const show = TAB_TO_SHOW[tab];
    rows.forEach((r, k) => {
      const e = {
        tab, row: k + 3, show,
        slug: omnySlug(r[EXT_COL.omny]), item: asahiItemId(r[EXT_COL.asahi]),
        date: extDateJst(r[EXT_COL.date]), nt: normalizeTitle(r[EXT_COL.title]),
        spotify: s(r[EXT_COL.spotify]), pocket: s(r[EXT_COL.pocket]),
      };
      if (!e.slug && !e.item && !e.nt && !e.spotify && !e.pocket) return; // 空行
      e.spotifyId = spotifyEpisodeId(e.spotify); e.pocketId = pocketEpisodeId(e.pocket);
      const dupKey = `${show}|${e.item || e.slug || `${e.date}|${e.nt}`}`; // 番組単位（同じ配信が別番組タブに載るのは正常）
      const prev = seenKey.get(dupKey);
      e.extDuplicateOf = prev || null;
      if (!prev) seenKey.set(dupKey, `${tab}!${e.row}`);

      // 強いキー: 朝日itemid、Omny URL スラッグ、（外部ID=GUID と itemid の一致）
      const strong = new Map();
      const add = (name, list) => (list || []).forEach((p) => {
        const c = strong.get(p.i) || { p, keys: [] }; c.keys.push(name); strong.set(p.i, c);
      });
      add('asahiItemId', idx.item.get(e.item));
      add('asahiItemId=externalId', idx.extId.get(e.item));
      add('omnySlug', idx.page.get(e.slug));
      add('spotifyId', idx.sp.get(e.spotifyId));
      add('pocketId', idx.pc.get(e.pocketId));
      let cands = [...strong.values()];
      // タブは番組名そのものではなく配信フィード単位の箱。同じ番組名の台帳行があればそちらに絞り、無ければ他番組名でも強キー一致を認める（showMismatchを記録）
      const sameShow = cands.filter((c) => c.p.show === show);
      const showMismatch = sameShow.length === 0 && cands.length > 0;
      if (sameShow.length) cands = sameShow;
      let cls; let match = null; let reason = '';
      if (cands.length === 1) {
        const c = cands[0];
        // 日付が両方あり、1日以上ずれる場合は競合として分離（同じキーでも別個体を疑う）
        const dayDiff = e.date && c.p.date ? Math.abs((Date.parse(e.date) - Date.parse(c.p.date)) / 86400e3) : 0;
        if (dayDiff > 1) { cls = 'CONFLICT'; reason = `強キー一致だが日付が${dayDiff}日ずれ`; match = c.p; }
        else if (e.extDuplicateOf) { cls = 'CONFLICT'; reason = `外部原本内で同一キーが重複(${e.extDuplicateOf})`; match = c.p; }
        else { cls = 'CONFIRMED'; match = c.p; reason = c.keys.join('+'); }
      } else if (cands.length > 1) {
        cls = 'CONFLICT'; reason = `強キーが複数の台帳行を指す(${cands.map((c) => c.p.id).join(',')})`;
      } else {
        // 強キー無し。タイトル＋配信日（＋番組）のみで1件に絞れる場合は曖昧（HOLD）
        const t = (idx.td.get(`${show}|${e.date}|${e.nt}`) || []);
        if (t.length === 1) { cls = 'AMBIGUOUS'; match = t[0]; reason = 'タイトル+配信日のみ一致（強キー無し）'; }
        else if (t.length > 1) { cls = 'AMBIGUOUS'; reason = `タイトル+配信日が${t.length}件に一致`; }
        else { cls = 'UNMATCHED'; reason = '台帳に対応行なし'; }
      }
      const rec = { ...pick(e), cls, reason, prodId: match?.id || '', prodShow: match?.show || '', showMismatch: showMismatch && !!match };

      // 補完判定（CONFIRMED のみ補完候補にする。それ以外は理由付きで保留）
      for (const [name, extUrl, extId, prodUrl, valid] of [
        ['spotify', e.spotify, e.spotifyId, match?.spotify, spotifyEpisodeId],
        ['pocket', e.pocket, e.pocketId, match?.pocket, pocketEpisodeId],
      ]) {
        if (!extUrl) { rec[name] = 'NO_EXT_URL'; continue; }
        if (!extId) { rec[name] = 'EXT_URL_INVALID'; continue; }
        if (!match) { rec[name] = 'NO_PROD_ROW'; continue; }
        if (!prodUrl) { rec[name] = cls === 'CONFIRMED' ? 'FILL' : `HOLD_${cls}`; continue; }
        rec[name] = valid(prodUrl) === extId ? 'SAME' : (e.slug.split('/')[0] !== match.feed ? 'URL_CONFLICT_FEED' : 'URL_CONFLICT');
      }
      out.push(rec);
    });
  }
  return out;
}

function pick(e) {
  return {
    tab: e.tab, row: e.row, show: e.show, date: e.date,
    extSpotify: e.spotify, extPocket: e.pocket,
  };
}

export function summarize(results) {
  const total = {};
  const byTab = {};
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const r of results) {
    byTab[r.tab] ??= { rows: 0, CONFIRMED: 0, AMBIGUOUS: 0, CONFLICT: 0, UNMATCHED: 0, spotifyFill: 0, pocketFill: 0, spotifyConflict: 0, pocketConflict: 0 };
    const t = byTab[r.tab];
    t.rows++; t[r.cls]++;
    bump(total, r.cls);
    if (r.spotify === 'FILL') t.spotifyFill++;
    if (r.pocket === 'FILL') t.pocketFill++;
    if (r.spotify.startsWith('URL_CONFLICT')) t.spotifyConflict++;
    if (r.pocket.startsWith('URL_CONFLICT')) t.pocketConflict++;
    if (r.spotify === 'URL_CONFLICT_FEED') t.spotifyFeedVariant = (t.spotifyFeedVariant || 0) + 1;
    if (r.pocket === 'URL_CONFLICT_FEED') t.pocketFeedVariant = (t.pocketFeedVariant || 0) + 1;
  }
  return { rows: results.length, total, byTab };
}
