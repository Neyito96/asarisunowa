// 朝日新聞ポッドキャスト公式の「番組・連載ページ」と、トップページのプレイリストの対応表。
// 出どころ: https://www.asahi.com/special/podcasts/ の番組・連載一覧（2026-11-14 取得）。URLは一覧のリンク先そのまま。推測で作らない。
// 対応表にないプレイリストはリンクを出さない（未確認のまま）。キーは Spotify プレイリストID（並び順が変わってもずれない）。
export type OfficialSeries = { pgid: string; name: string; kind: "番組" | "連載"; url: string };
export const OFFICIAL_SERIES: Record<string, OfficialSeries> = {
  "mekuro": { pgid: "mekuro", name: "一緒に新聞をめくろう！", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=mekuro" },
  "ito_okuyama_kanda": { pgid: "ito_okuyama_kanda", name: "伊藤大地・奥山晶二郎・神田大介", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=ito_okuyama_kanda" },
  "chichioya_moyamoya": { pgid: "chichioya_moyamoya", name: "親モヤ", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=chichioya_moyamoya" },
  "obosannikike": { pgid: "obosannikike", name: "お坊さんに聞け", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=obosannikike" },
  "asahishinbunsha_rekishi": { pgid: "asahishinbunsha_rekishi", name: "朝日新聞社の歴史", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=asahishinbunsha_rekishi" },
  "seisakukaigi": { pgid: "seisakukaigi", name: "制作会議", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=seisakukaigi" },
  "gakuyaura": { pgid: "gakuyaura", name: "楽屋裏", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=gakuyaura" },
  "basketball_tsushin": { pgid: "basketball_tsushin", name: "バスクラ", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=basketball_tsushin" },
  "globecast": { pgid: "globecast", name: "GLOBE CAST", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=globecast" },
  "kinoshitakun": { pgid: "kinoshitakun", name: "木下君、あの動画みた？", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=kinoshitakun" },
  "pride_code": { pgid: "pride_code", name: "PRIDE CODE", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=pride_code" },
  "hachigakeshakai": { pgid: "hachigakeshakai", name: "8がけ社会", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=hachigakeshakai" },
  "henshu_mania": { pgid: "henshu_mania", name: "編集マニア", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=henshu_mania" },
  "manabiba_tenseijingo": { pgid: "manabiba_tenseijingo", name: "まなび場天声人語", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=manabiba_tenseijingo" },
  "porirebi": { pgid: "porirebi", name: "ポリレビ", kind: "連載", url: "https://www.asahi.com/special/podcasts/?pgid=porirebi" },
  "684015f9-2396-4ac4-bc1f-ac0f0033d08c": { pgid: "684015f9-2396-4ac4-bc1f-ac0f0033d08c", name: "ニュースの現場から", kind: "番組", url: "https://www.asahi.com/special/podcasts/?pgid=684015f9-2396-4ac4-bc1f-ac0f0033d08c" },
  "91b696fe-c723-4bd1-95ed-b4aa00909997": { pgid: "91b696fe-c723-4bd1-95ed-b4aa00909997", name: "SDGsを話そう アーカイブ", kind: "番組", url: "https://www.asahi.com/special/podcasts/?pgid=91b696fe-c723-4bd1-95ed-b4aa00909997" },
  "07a1de49-67cf-4714-8581-ac1000059302": { pgid: "07a1de49-67cf-4714-8581-ac1000059302", name: "MEDIA TALK", kind: "番組", url: "https://www.asahi.com/special/podcasts/?pgid=07a1de49-67cf-4714-8581-ac1000059302" },
};
// プレイリスト（SpotifyプレイリストID）→ 公式ページ。名称が公式一覧と一致したものだけ。
export const PLAYLIST_OFFICIAL_SERIES: Record<string, string> = {
  "4tY0lHoV8IemMBp4iTnKnl": "mekuro", // 1 一緒に新聞をめくろう！
  "799Fo9to2TK0ahGEJsvcm2": "ito_okuyama_kanda", // 2 IOK 伊藤大地・奥山晶二郎・神田大介
  "2hFyK2sSN33GDr5cilxcdv": "chichioya_moyamoya", // 5 親モヤ
  "": "obosannikike", // 7 お坊さんに聞け
  "1Uyfnkn7uL6NqhXKeY1OqI": "684015f9-2396-4ac4-bc1f-ac0f0033d08c", // 9 ニュースの現場から #1000 で紹介されたエピソード
  "6CIUcOIkcQ9UUXN7HzMOLY": "asahishinbunsha_rekishi", // 11 朝日新聞社の歴史
  "2lA13BSsvyLjq9iPFa6oDo": "ito_okuyama_kanda", // 34 メディアを語る　伊藤大地x奥山晶二郎x神田大介
  "4RFidAb3QbDcysbS060a1b": "seisakukaigi", // 35 朝ポキ制作会議！　皆さんもご参加ください
  "121qJsNELEdzq9LUTmdTdt": "obosannikike", // 36 ウェルビーイングは寺にあり　お坊さんに聞け！
  "1u1qT0BxRZT1OeNM0LDA72": "gakuyaura", // 41 新聞社員の「楽屋裏」
  "4styp7b6VpZThsevXCRDla": "91b696fe-c723-4bd1-95ed-b4aa00909997", // 42 「SDGsを話そう」厳選エピソード
  "6Q0iXwuC9PuLV3cqg11Dmt": "07a1de49-67cf-4714-8581-ac1000059302", // 44 「MEDIA TALK」 2023厳選エピソード
  "0I9wCLs5oFLNIG1aPLQneg": "gakuyaura", // 45 楽屋裏2023　厳選エピソード
  "3axOpfDhMhLEtelwGwvMHb": "basketball_tsushin", // 46 バスケ通信―クラッチタイム（バスクラ）
  "1NdFNZ1kDgFIO1zmjs3zXA": "globecast", // 50 GLOBE CAST
  "0vItsmD8tW7fsv18NkZKzh": "gakuyaura", // 51 #懐メロ（#朝ポキ 楽屋裏）＋おじさんのメロディ
  "6nDhZQG75F1wU62sdcYJMq": "kinoshitakun", // 53 #きのどう「木下君、あの動画みた？」
  "37i9dQZF1DWUB0g2l65cg8": "pride_code", // 54 PRIDE CODE その声が、世界を変える。世界をポジティブに変えていく声を祝福するプレイリスト。
  "https://music.youtube.com/playlist?list=PLW_Nbzh9Y-J8PPlwXSOvfANQz4Xf39BBi": "basketball_tsushin", // 57 バスクラ
  "1cXfuT6GHoqUKuroVTPXwf": "hachigakeshakai", // 59 8がけ社会
  "71mdQ5ANqZda48jBkj0Qmz": "henshu_mania", // 60 編集マニア
  "2HhjxXEnYX8bUsBbFkW5r9": "asahishinbunsha_rekishi", // 61 朝日新聞社の歴史
  "7aKDEfAdCjTxiqiv19Grar": "manabiba_tenseijingo", // 62 まなび場天声人語　見出しづくりにチャレンジ
  "6hNrobOVHmYaQT5C7hPkNa": "porirebi", // 67 ポリレビ
  "PLW_Nbzh9Y-J8PPlwXSOvfANQz4Xf39BBi": "basketball_tsushin", // 57 バスクラ（YouTube Music）
};
// 将来用: 各サービスの個別URL（Apple Podcasts・Amazon Music・Spotify・Pocket Casts・LISTEN・Pody）。確認できたものだけ入れる。表示はこの表を読むだけ。
export type PlatformKey = "apple" | "amazon" | "spotify" | "pocketcasts" | "listen" | "pody";
export const PLATFORM_LABELS: Record<PlatformKey, string> = { apple: "Apple Podcasts", amazon: "Amazon Music", spotify: "Spotify", pocketcasts: "Pocket Casts", listen: "LISTEN", pody: "Pody" };
export const PLAYLIST_PLATFORM_LINKS: Record<string, Partial<Record<PlatformKey, string>>> = {};
export function playlistKey(url: string | null | undefined): string { const u = String(url || ""), m = u.match(/\/playlist\/([A-Za-z0-9]+)/) || u.match(/[?&]list=([A-Za-z0-9_-]+)/); return m ? m[1] : u; }   // Spotify は /playlist/ID、YouTube Music は list=ID
export function officialSeriesForPlaylist(url: string | null | undefined): OfficialSeries | null { const p = PLAYLIST_OFFICIAL_SERIES[playlistKey(url)]; return p ? OFFICIAL_SERIES[p] || null : null; }
export function platformLinksForPlaylist(url: string | null | undefined): { key: PlatformKey; label: string; url: string }[] { const l = PLAYLIST_PLATFORM_LINKS[playlistKey(url)] || {}; return (Object.keys(PLATFORM_LABELS) as PlatformKey[]).filter((k) => /^https:\/\//.test(l[k] || "")).map((k) => ({ key: k, label: PLATFORM_LABELS[k], url: l[k] as string })); }
