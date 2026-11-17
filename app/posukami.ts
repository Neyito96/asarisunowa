// ポす神回（#312）: ポすすめカードに付ける「紹介された回」「ポす神回」の表示と投稿の部品（画面に依存しない純関数）
// データは public/posusume/posukami.json（承認・照合済みだけ。生成: scripts/posusume/build-posukami.mjs）

export type PosukamiEpisode = {
  title: string;
  date: string;
  href: string;
  library: boolean;
  epId: string;
  verifiedAt: string;
  program?: string;
  relation?: string;
};
export type PosukamiCard = { podcastId: string; podcastTitle: string; introductions: PosukamiEpisode[]; replies: PosukamiEpisode[]; specials: PosukamiEpisode[] };
export type PosukamiData = { schema: number; generatedAt: string; submitEnabled: boolean; cards: PosukamiCard[] };

// サイトは GitHub Pages の /asarisunowa/ 配下で動くため、先頭が / の絶対パスは使わない（相対パス）
export const POSUKAMI_DATA_URL = "posusume/posukami.json";
// 蔵の個別ページ（/library/?ep=EP-xxxxx）をページからの相対パスにする
export function posukamiHref(href: string): string { return /^\/library\/\?ep=EP-\d{5}$/.test(href) ? href.slice(1) : href; }
export const POSUKAMI_RELATIONS: Array<[string, string]> = [
  ["reply", "ポすすめ返し（ポすすめを受けて、この番組が配信した回）"],
  ["donut_guest", "ドーナツに番組の配信者が出演した回"],
  ["kanda_guest", "この番組に神田さん等がゲスト出演した回"],
  ["other", "その他の交流"],
];

const nz = (s: string) => String(s || "").normalize("NFKC").replace(/[\s​-‍﻿]+/g, "").toLowerCase();

// 読み込んだ JSON を確かめる（形が違えば空として扱い、カードは今まで通り）
export function parsePosukami(raw: unknown): PosukamiData {
  const empty: PosukamiData = { schema: 1, generatedAt: "", submitEnabled: false, cards: [] };
  if (!raw || typeof raw !== "object") return empty;
  const r = raw as Partial<PosukamiData>;
  if (r.schema !== 1 || !Array.isArray(r.cards)) return empty;
  const safe = (e: PosukamiEpisode) => typeof e?.title === "string" && typeof e?.href === "string" && (/^https:\/\//.test(e.href) || /^\/library\/\?ep=EP-\d{5}$/.test(e.href));
  return {
    schema: 1,
    generatedAt: String(r.generatedAt || ""),
    submitEnabled: r.submitEnabled === true,
    cards: r.cards
      .filter((c) => c && typeof c.podcastId === "string" && typeof c.podcastTitle === "string")
      .map((c) => ({ podcastId: c.podcastId, podcastTitle: c.podcastTitle, introductions: (c.introductions || []).filter(safe), replies: (c.replies || []).filter(safe), specials: (c.specials || []).filter(safe) })),
  };
}
// カードとデータを結ぶ: 番組ID と 番組名 の両方が一致したときだけ（並びが変わって ID がずれても、別の番組に付かない）
export function findPosukamiCard(data: PosukamiData, podcast: { id: string; title: string }): PosukamiCard | undefined {
  const id = String(Number(podcast.id));
  return data.cards.find((c) => String(Number(c.podcastId)) === id && nz(c.podcastTitle) === nz(podcast.title));
}
// NEW は「掲載・検証した日」から14日。古い回を新作と誤表示しない
export function isPosukamiNew(verifiedAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(String(verifiedAt || "") + "T00:00:00+09:00");
  return Number.isFinite(t) && now.getTime() - t >= 0 && now.getTime() - t < 14 * 86400000;
}
export function formatPosukamiDate(day: string): string {
  const m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : "";
}
// 回ごとのURLか（番組トップは不可）。画面での事前チェック用（最終判断は受付側）
export function looksLikeEpisodeUrl(raw: string): boolean {
  const s = String(raw || "").trim();
  return /^https:\/\/(open\.spotify\.com\/(intl-[a-z]+\/)?episode\/[A-Za-z0-9]{22}|podcasts\.apple\.com\/.+[?&]i=\d+|listen\.style\/p\/[^/]+\/[^/?#]+|pca\.st\/episode\/[0-9a-f-]{36}|pody\.jp\/player\/[A-Za-z0-9]{20}\/[A-Za-z0-9]{20}|music\.amazon\.[a-z.]+\/podcasts\/[0-9a-f-]{36}\/episodes\/|omny\.fm\/shows\/[^/]+\/[^/?#]+|(www\.)?youtube\.com\/watch\?(.+&)?v=[A-Za-z0-9_-]{11}|youtu\.be\/[A-Za-z0-9_-]{11}|stand\.fm\/episodes\/[A-Za-z0-9]+|www\.asahi\.com\/special\/podcasts\/item\/\?itemid=)/i.test(s);
}
export type PosukamiSubmit = { podcastId: string; podcastTitle: string; url: string; relation: string; title?: string; date?: string; note?: string; website2?: string };
// 受付（JSONP GET）の URL。type=posukamiSubmit は既存の新規番組登録（listenerPodcast）とは別の経路。callback は JSONP の読み込み側が付ける
export function posukamiSubmitUrl(endpoint: string, s: PosukamiSubmit): string {
  const q = new URLSearchParams({ type: "posukamiSubmit", podcastId: String(Number(s.podcastId)), podcastTitle: s.podcastTitle, url: s.url.trim(), relation: s.relation, title: (s.title || "").trim(), date: (s.date || "").trim(), note: (s.note || "").trim(), website2: s.website2 || "" });
  return endpoint + "?" + q.toString();
}
// 受付の返事を画面の文言にする。ok:true と受付ID が無ければ「受け付けた」とは言わない
export function posukamiResultMessage(res: unknown): { ok: boolean; text: string } {
  const r = (res || {}) as { ok?: boolean; receiptId?: string; message?: string; error?: string };
  if (r.ok === true && typeof r.receiptId === "string" && r.receiptId) return { ok: true, text: `受け付けました（受付番号 ${r.receiptId}）。確認・承認のあとにカードへ載ります。` };
  return { ok: false, text: r.message || (r.error ? "受け付けられませんでした（" + r.error + "）" : "送信を確認できませんでした。時間をおいてもう一度お試しください。") };
}
