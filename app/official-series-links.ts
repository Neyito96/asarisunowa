// トップページの番組カード（ドーナツ・スポンジ・MEDIA TALK・ニュースの現場から など）の中に書いてある連載名を、
// 朝日新聞ポッドキャスト公式の連載ページ（?pgid=...）へのリンクにするための対応表。
// 出どころ: https://www.asahi.com/special/podcasts/ の連載一覧（2026-11-14 取得）。URLは一覧のリンク先そのまま。推測で作らない。
// カードの表記と公式の名前が違うもの（表記揺れ）は、ここに明示した表記だけを結ぶ。表にない連載名は普通の文字のまま。
export type OfficialSeries = { pgid: string; name: string; url: string };
const S = (pgid: string, name: string): OfficialSeries => ({ pgid, name, url: "https://www.asahi.com/special/podcasts/?pgid=" + pgid });
export const OFFICIAL_SERIES: Record<string, OfficialSeries> = {
  mekuro: S("mekuro", "一緒に新聞をめくろう！"),
  kagakuwohiraku: S("kagakuwohiraku", "カガクをヒラク"),
  puerta: S("puerta", "PUERTA"),
  gakuyaura: S("gakuyaura", "楽屋裏"),
  seisakukaigi: S("seisakukaigi", "制作会議"),
  globecast: S("globecast", "GLOBE CAST"),
  chichioya_moyamoya: S("chichioya_moyamoya", "親モヤ"),
  mt: S("mt", "MT"),
  worldInsight: S("worldInsight", "World Insight"),
  yuruttokeizai: S("yuruttokeizai", "ゆるっと経済"),
  porirebi: S("porirebi", "ポリレビ"),
  newsosaka: S("newsosaka", "ニュース大阪目線"),
  ongoing: S("ongoing", "ON GOING！"),
  moshimonisonaetalk: S("moshimonisonaetalk", "もしもに、そなえとーく"),
  hachigakeshakai: S("hachigakeshakai", "8がけ社会"),
  basketball_tsushin: S("basketball_tsushin", "バスクラ"),
  figureskate: S("figureskate", "フィギュアスケートストーリー"),
  osumochannel: S("osumochannel", "お相撲ちゃんねる"),
  asahipodcasts_football: S("asahipodcasts_football", "ポキフト（朝ポキフットボール）"),
  kinoshitakun: S("kinoshitakun", "木下君、あの動画みた？"),
  ichioshi_withnews: S("ichioshi_withnews", "いちおしウニュ！"),
  hub: S("hub", "サステナブルHUBスタジオ"),
  manabiba_tenseijingo: S("manabiba_tenseijingo", "まなび場天声人語"),
  n4u: S("n4u", "ニュース4U"),
  kishasalon: S("kishasalon", "記者サロンTALK"),
  henshu_mania: S("henshu_mania", "編集マニア"),
  cinema: S("cinema", "朝ポキシネマ"),
};
// カードに書いてある表記 → 公式の連載。variant は「公式の名前と表記が違う」印（一覧で確かめられるように）
export const SERIES_DISPLAY_LINKS: Record<string, { pgid: string; variant?: true }> = {
  "一緒に新聞をめくろう！": { pgid: "mekuro" },
  "カガクをひらく": { pgid: "kagakuwohiraku", variant: true },
  "PUERTA": { pgid: "puerta" },
  "楽屋裏": { pgid: "gakuyaura" },
  "制作会議": { pgid: "seisakukaigi" },
  "GLOBE CAST": { pgid: "globecast" },
  "親モヤ": { pgid: "chichioya_moyamoya" },
  "World Insight": { pgid: "worldInsight" },
  "ゆるっと経済": { pgid: "yuruttokeizai" },
  "ポリレビ": { pgid: "porirebi" },
  "ニュース大阪目線": { pgid: "newsosaka" },
  "ON GOING": { pgid: "ongoing", variant: true },
  "そなえトーク": { pgid: "moshimonisonaetalk", variant: true },
  "8がけ社会": { pgid: "hachigakeshakai" },
  "バスクラ": { pgid: "basketball_tsushin" },
  "フィギュアスケートストーリー": { pgid: "figureskate" },
  "お相撲ちゃんねる": { pgid: "osumochannel" },
  "ポキフト": { pgid: "asahipodcasts_football", variant: true },
  "木下くんあの動画見た？": { pgid: "kinoshitakun", variant: true },
  "いちおしウニュ！": { pgid: "ichioshi_withnews" },
  "サステナブルHUBスタジオ": { pgid: "hub" },
  "天声人語": { pgid: "manabiba_tenseijingo", variant: true },
  "ニュース4U": { pgid: "n4u" },
  "記者サロンTALK": { pgid: "kishasalon" },
  "編集マニア": { pgid: "henshu_mania" },
  "朝ポキシネマ": { pgid: "cinema" },
};
export type SeriesSegment = string | { text: string; url: string; name: string };
// 区切り（文頭・文末・、／：（）と空白）に挟まれた表記だけをリンクにする（「MEDIA TALK」の中の「TALK」などの部分一致を防ぐ）
const BOUNDARY = /[、／：（）()\s]/;
const KEYS = Object.keys(SERIES_DISPLAY_LINKS).sort((a, b) => b.length - a.length);
export function seriesLinkSegments(text: string): SeriesSegment[] {
  const out: SeriesSegment[] = []; let buf = "", i = 0;
  while (i < text.length) {
    const atStart = i === 0 || BOUNDARY.test(text[i - 1]);
    const key = atStart ? KEYS.find((k) => text.startsWith(k, i) && (i + k.length === text.length || BOUNDARY.test(text[i + k.length]))) : undefined;
    const series = key ? OFFICIAL_SERIES[SERIES_DISPLAY_LINKS[key].pgid] : undefined;
    if (key && series) { if (buf) out.push(buf); buf = ""; out.push({ text: key, url: series.url, name: series.name }); i += key.length; continue; }
    buf += text[i]; i++;
  }
  if (buf) out.push(buf);
  return out;
}
