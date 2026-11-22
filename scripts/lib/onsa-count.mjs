// おんさ検索サイト(speakers3.js)の計数定義の再現。READ_ONLY・ネットワーク不使用（取得は呼び出し側）。
// 仕様根拠: 司令塔が確認した公開ソース（PR #277 コメント 2026-11-10）。ソース追従は SPEC で一箇所に集約。
export const SPEC = {
  source: "https://github.com/yoshimotomasahir/asapoki_vis/blob/main/speakers3.js",
  categories: ["genba", "media", "sdgs", "houdan", "donuts", "sports"],      // 6番組。ニュースの学校は含めない
  // 朝リスの田の番組名への対応。sports→スポンジ は未検証の前提（EP同一性が取れた項目だけで裏付ける）
  showOf: { genba: "ニュースの現場から", media: "MEDIA TALK", sdgs: "SDGsを話そう", houdan: "報談", donuts: "ドーナツ", sports: "スポンジ" },
  sdgsCutoffJst: "2026-06-30T00:00:00+09:00",       // new Date(2026,5,30) 以降をskip（ブラウザのローカル日付。JST想定）
  // speakers3.js (yoshimotomasahir/asapoki_vis, AGPL-3.0) を読んで確認した画面カウンタの既定条件。コードは複製せず規則だけを独自実装する。
  //  ・counts は actualDuration>0 のみ加算。actualDuration=duration(秒)、題名規則で0になる → duration<=0 も非計数
  //  ・既定フィルタ: 6番組すべて選択 / 長さ 0〜999分 / 月範囲 2020年8月〜閲覧時の当月（ブラウザのローカル月）
  //  ・各エントリは mc[] と speakers[] を持つ前提（無いと readData が例外で打ち切られ、以降の番組が読み込まれない）
  uiDefaults: { monthStart: "2020-08", maxMinutes: 999 },
  verifiedAgainst: "yoshimotomasahir/asapoki_vis speakers3.js 2026-11-10 取得時点のHEAD",
  zeroDurationTitle: [/^（再）/, /^（ふりかえり）/, /^（深掘り）/, /再放送です/],
};
const s = (v) => String(v ?? "").trim();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const SPOTIFY = /open\.spotify\.com\/episode\/([A-Za-z0-9]+)/;

export function validateApi(json) {
  if (!json || typeof json !== "object") return { ok: false, reason: "NOT_OBJECT" };
  const missing = SPEC.categories.filter((c) => !Array.isArray(json[c]));
  if (missing.length) return { ok: false, reason: "SCHEMA_MISSING_" + missing.join(",") };
  for (const c of SPEC.categories) for (const e of json[c]) if (!e || typeof e.title !== "string" || !e.pubDate || !Array.isArray(e.mc) || !Array.isArray(e.speakers)) return { ok: false, reason: "SCHEMA_ENTRY_" + c };   // mc/speakers 欠落は画面側で例外（以降の番組が読めない）
  return { ok: true };
}

// speakers3.js readData() の actualDuration=0 条件
export const actualDurationZero = (title) => SPEC.zeroDurationTitle.some((re) => re.test(s(title)));
export const sdgsSkipped = (pubDate) => Date.parse(pubDate) >= Date.parse(SPEC.sdgsCutoffJst);

const monthIdx = (iso) => { const d = new Date(Date.parse(iso) + 9 * 3600000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// 画面の既定フィルタ（月範囲 2020-08〜閲覧月、長さ 0〜999分）。asOf が不正なら月上限は掛けない。
export function inUiRange(pubDate, duration, asOf) {
  const m = monthIdx(pubDate), lo = 2020 * 12 + 7, hi = Number.isFinite(Date.parse(asOf)) ? monthIdx(asOf) : Infinity;
  return m >= lo && m <= hi && Math.floor(Number(duration) / 60) <= SPEC.uiDefaults.maxMinutes;
}
// API生JSON → 項目列。counted=画面の件数カウンタに加算される（6番組・SDGsカット・再配信等は非計数）。
export function projectApi(json, { asOf, fetchedAt = asOf } = {}) {
  const v = validateApi(json);
  if (!v.ok) return { status: "unavailable", reason: v.reason, asOf, items: [] };
  const items = [];
  for (const c of SPEC.categories) for (const e of json[c]) {
    const skippedSdgs = c === "sdgs" && sdgsSkipped(e.pubDate);
    const zero = actualDurationZero(e.title) || !(Number(e.duration) > 0);               // actualDuration=duration。0/欠損も非計数
    const link = s(e.link), sp = s(e.spotify);
    items.push({
      category: c, show: SPEC.showOf[c], title: s(e.title), publishedAt: s(e.pubDate), link, clipId: s(e.clipId),
      guid: (link.match(UUID) || s(e.clipId).match(UUID) || [""])[0].toLowerCase(),
      spotifyId: (sp.match(SPOTIFY) || [])[1] || "", spotify: sp, clipId: s(e.clipId),
      readData: skippedSdgs ? "skipped_sdgs_cutoff" : "kept", counted: !skippedSdgs && !zero && inUiRange(e.pubDate, e.duration, asOf),
      notCountedReason: skippedSdgs ? "SDGs日付カット" : zero ? "actualDuration=0（再/ふりかえり/深掘り/再放送/duration<=0）" : !inUiRange(e.pubDate, e.duration, asOf) ? "UI既定の月範囲/長さの外" : "",
    });
  }
  const kept = items.filter((i) => i.readData === "kept");
  return {
    status: "ok", asOf, fetchedAt,
    rawArrayCount: items.length,                              // API生配列の全件数
    readDataCount: kept.length,                               // readData後（SDGsカット後）
    uiCounter: items.filter((i) => i.counted).length,         // 画面のカウンタ相当（num_title）
    byCategory: Object.fromEntries(SPEC.categories.map((c) => [c, { raw: items.filter((i) => i.category === c).length, counted: items.filter((i) => i.category === c && i.counted).length }])),
    items,
  };
}

// 台帳EPとの同一性: ①GUID/Omny clip ②Spotify episode ID ③番組+題名+日付(JST日)。強い根拠の順。
const norm = (t) => s(t).normalize("NFKC").toLowerCase().replace(/[\s　"'“”‘’「」『』【】\[\]()（）・,、。.!！?？~〜\-_:：|｜/／]/g, "");
const dayOf = (t) => {
  const v = s(t), m = v.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;     // 時刻帯なしはJSTの暦日
  return Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v) + 9 * 3600000).toISOString().slice(0, 10) : v.slice(0, 10);
};
export function buildLedgerIndex(ledger) {
  const g = new Map(), sp = new Map(), t = new Map();
  for (const r of ledger) {
    const gu = (s(r.guid).match(UUID) || [""])[0].toLowerCase(); if (gu && !g.has(gu)) g.set(gu, r);
    const sid = (s(r.spotifyUrl).match(SPOTIFY) || [])[1]; if (sid && !sp.has(sid)) sp.set(sid, r);
    const k = r.show + "\u0000" + norm(r.title) + "\u0000" + dayOf(r.publishedAt); if (norm(r.title) && !t.has(k)) t.set(k, r);
  }
  const ta = new Map();                                                           // 番組を問わない 題名+日付（番組の所属が台帳とおんさで違う場合の補助）
  for (const r of ledger) { const k = norm(r.title) + "\u0000" + dayOf(r.publishedAt); if (norm(r.title)) ta.set(k, ta.has(k) ? null : r); }   // 複数一致は曖昧なので使わない
  return { g, sp, t, ta };
}
export function matchItem(item, ix) {
  if (item.guid && ix.g.has(item.guid)) return { ep: ix.g.get(item.guid), by: "GUID" };
  if (item.spotifyId && ix.sp.has(item.spotifyId)) return { ep: ix.sp.get(item.spotifyId), by: "SPOTIFY_ID" };
  const k = item.show + "\u0000" + norm(item.title) + "\u0000" + dayOf(item.publishedAt);
  if (ix.t.has(k)) return { ep: ix.t.get(k), by: "TITLE_DATE" };
  const ka = norm(item.title) + "\u0000" + dayOf(item.publishedAt);
  if (ix.ta && ix.ta.get(ka)) return { ep: ix.ta.get(ka), by: "TITLE_DATE_ANY_SHOW" };
  return null;
}

// ---- 共同編集シート書き出し（"## Sheet name: X" + CSV）→ API相当のJSON ----
// おんさAPIは共同編集シートがベース。API本体が取得できない間の再現用（シートの書き出し時点の状態であり、APIの実値ではない）。
export const SHEET_TO_CATEGORY = { "ニュースの現場から": "genba", "メディアトーク": "media", "SDGs": "sdgs", "報談": "houdan", "ドーナツ": "donuts", "スポンジ": "sports" };
export function sheetExportToApiJson(text, parseCsv) {
  const parts = text.replace(/^﻿/, "").split(/^## Sheet name: (.*)$/m);
  const api = Object.fromEntries(SPEC.categories.map((c) => [c, []])); const sheets = {}, extra = {};          // extra: 計数対象外タブ（学校・YouTube）。照合の説明用で件数には入れない
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim(), cat = SHEET_TO_CATEGORY[name];
    if (!cat) {                                                                              // ニュースの学校・YouTube・出演者等は計数対象外
      if (name === "ニュースの学校" || name === "YouTube") for (const r of parseCsv(parts[i + 1].trim()).slice(2)) if (/^https?:/.test(s(r[0])) && s(r[2])) (extra[name] ||= []).push({ link: s(r[0]), pubDate: s(r[1]), title: s(r[2]), spotify: s(r[11]), clipId: s(r[12]) });
      continue;
    }
    const rows = parseCsv(parts[i + 1].trim());
    let n = 0;
    for (const r of rows.slice(2)) {                                                       // 先頭2行はヘッダーと注意書き。行数をEP件数とみなさない
      const link = s(r[0]), date = s(r[1]), title = s(r[2]);
      if (!title || !/^https?:/.test(link) || !Number.isFinite(Date.parse(date.replace(/ -0000$/, " +0000")))) continue;
      api[cat].push({ link, pubDate: new Date(Date.parse(date.replace(/ -0000$/, " +0000"))).toISOString(), title, duration: Number(r[3]) || 0, spotify: s(r[11]), clipId: s(r[12]), pca: s(r[13]), mc: [], speakers: [] }); n++;
    }
    sheets[name] = n;
  }
  return { api, sheets, extra };
}

// 同一linkが複数カテゴリに出る重複エントリ（現場タブは総合フィードで専用番組と重なる）を1件にまとめる。専用番組側を残す。
// 画面(speakers3.js)は重複を除かないため、APIが重複を除いているかは未確認。比較時は両方の件数を出す。
export function dedupeByLink(items) {
  const m = new Map();
  for (const i of items) { const cur = m.get(i.link); if (!cur || (cur.category === "genba" && i.category !== "genba")) m.set(i.link, i); }
  return [...m.values()];
}

// ---- 強い識別子（Omny URL / Spotify episode ID / 朝日公式item ID / GUID） ----
export const strongKeys = ({ link = "", spotify = "", clipId = "", guid = "" } = {}) => {
  const k = [];
  const om = s(link).match(/omny\.fm\/shows\/([^/]+)\/([^/?#]+)/); if (om) k.push(["omny", om[1] + "/" + om[2]]);
  const sp = s(spotify).match(SPOTIFY); if (sp) k.push(["spotify", sp[1]]);
  const as = (s(clipId).match(/itemid=([0-9a-f-]{36})/i) || [])[1]; if (as) k.push(["asahi", as.toLowerCase()]);
  const mg = (s(link) + " " + s(spotify) + " " + s(clipId)).match(/megaphone\.fm\/(?:[^\s"']*\/)?(TASC\d+)/); if (mg) k.push(["megaphone", mg[1]]);   // Megaphone配信(報談・学校)の識別子
  const g = guidOf2(guid) || guidOf2(link); if (g) k.push(["guid", g]);
  return k;
};
const guidOf2 = (v) => ((s(v).match(UUID) || [""])[0]).toLowerCase();
