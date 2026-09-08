"use client";
import { useEffect, useMemo, useState } from "react";
import type { Playlist } from "./data";
type OfficialProgram = {
  name: string;
  mark?: string;
  detail?: string;
  schedule?: string;
  spotify?: string;
  links?: string[][];
  official?: string;
  discord?: string;
  youtube?: boolean;
};
const ASAPOKI_YOUTUBE = "https://www.youtube.com/@asapoki_official";
const ASAPOKI_OFFICIAL = "https://www.asahi.com/special/podcasts/";
// Google Apps Script のウェブアプリURLを設定すると投稿フォームが自動送信になります。
const PLAYLIST_SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxlZCNqGqOEY7j61OgcSGM8_xfGT08f4jjamXtSj2DES9fXl-xwJrvcRGYHnskidjIMug/exec";
const ASARISU_API_URL = PLAYLIST_SUBMIT_ENDPOINT;
const LISTENER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=697105746&single=true&output=csv";
const PODCAST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQHi9LM842wuiTT-N8FzgJXVFyY4W5sZRYEdp4a9OVBTgVBJgPWG52AK6sgH4qBciqB6Q5UAd2-n2bA/pub?gid=1297557590&single=true&output=csv";

type ListenerPodcast = {
  id: string; title: string; maker: string; introduced: string;
  links: { label: string; url: string }[];
  artwork?: string | null;
  comment?: string;
};

const listenerPodcasts: ListenerPodcast[] = [
  { id:"01", title:"どいらじ（映画凡人が集いしラジオ）", maker:"たんたん", introduced:"2026.4.5", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/7zHjRdGtexVH84tlrNjF1J"},
    {label:"Apple",url:"https://podcasts.apple.com/jp/podcast/%E3%81%A9%E3%81%84%E3%82%89%E3%81%98-%E6%98%A0%E7%94%BB%E5%87%A1%E4%BA%BA%E3%81%8C%E9%9B%86%E3%81%84%E3%81%97%E3%83%A9%E3%82%B8%E3%82%AA/id1072323753"}
  ]},
  { id:"02", title:"映画は絶賛に限る", maker:"たんたん", introduced:"2026.4.5", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/5AFLaarpYIp6irqeaiGiOr"},
    {label:"YouTube",url:"https://www.youtube.com/@bri-cul"}
  ]},
  { id:"03", title:"そえたとおもちの美容室トーク", maker:"そえた", introduced:"2026.4.12", links:[
    {label:"Apple",url:"https://podcasts.apple.com/jp/podcast/%E3%81%9D%E3%81%88%E3%81%9F%E3%81%A8%E3%81%8A%E3%82%82%E3%81%A1%E3%81%AE%E7%BE%8E%E5%AE%B9%E5%AE%A4%E3%83%88%E3%83%BC%E3%82%AF/id1836037911"}
  ]},
  { id:"04", title:"僕たちの吹奏楽部を作ろう ～地域が支える新しい部活動のカタチ", maker:"団長平井", introduced:"2026.4.19", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/22FvoWsAxljuf7gzxXHx2I"},
    {label:"YouTube",url:"https://www.youtube.com/playlist?list=PLMZ8i-eYRSt8FUulZ68VynKRbBcXUJLSb"}
  ]},
  { id:"05", title:"つる日和", maker:"ハルちゃん、ミカちゃん", introduced:"2026.4.26", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/4LCiSt59H17vsBJnoLwEoX"},
    {label:"Apple",url:"https://podcasts.apple.com/ca/podcast/%E3%81%A4%E3%82%8B%E6%97%A5%E5%92%8C/id1807427581"}
  ]},
  { id:"06", title:"歴史から学ぶ精神科ラジオ", maker:"かけるマリモ", introduced:"2026.5.10", links:[
    {label:"Spotify",url:"https://x.gd/ifxHV"},
    {label:"Apple",url:"https://x.gd/IgfrM"}
  ]},
  { id:"07", title:"南方政談録", maker:"らっきー", introduced:"2026.5.24", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/3D0CFQSrCLGXD8vBFjnxcd"}
  ]},
  { id:"08", title:"注文の多い出版相談室", maker:"牧野", introduced:"2026.6.14", links:[
    {label:"Spotify",url:"https://x.gd/Jrdk6"},
    {label:"Amazon",url:"https://x.gd/X60o6"}
  ]},
  { id:"09", title:"うんちく聖書ラジオ", maker:"MK", introduced:"2026.6.28", links:[
    {label:"Spotify",url:"https://x.gd/5ubgU"},
    {label:"Apple",url:"https://x.gd/l7McR"}
  ]},
  { id:"10", title:"福祉探偵団", maker:"KELLY", introduced:"2026.7.19", links:[
    {label:"Apple",url:"https://podcasts.apple.com/jp/podcast/id528929649"}
  ]},
  { id:"11", title:"ののラジオ", maker:"「劇団のの」スズキ", introduced:"2026.8.2", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/2FEWfewOOouavDxYCfwDyG"},
    {label:"Apple",url:"https://podcasts.apple.com/jp/podcast/id1347661112"},
    {label:"公式",url:"https://gekidannono.com/"}
  ]},
  { id:"12", title:"ネジネジ低空飛行 — ゆるバイポーラー thinking aloud —", maker:"ネジート", introduced:"2026.8.16", links:[
    {label:"Spotify",url:"https://open.spotify.com/show/0PfcrUCDN6O8JdtscTQo1B"},
    {label:"Apple",url:"https://podcasts.apple.com/jp/podcast/id6802532797"},
    {label:"LISTEN",url:"https://listen.style/p/neyineyi"},
    {label:"stand.fm",url:"https://stand.fm/channels/6273e1e5fd1be6fc466b6131"}
  ]},
];


function loadJsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const functionName = "__asarisunowa_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const callbackPath = "window." + functionName;
    const script = document.createElement("script");
    const globalWindow = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      script.remove();
      delete globalWindow[functionName];
    };
    globalWindow[functionName] = (payload: T) => {
      cleanup();
      resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP load failed"));
    };
    script.src =
      url +
      (url.includes("?") ? "&" : "?") +
      "callback=" +
      encodeURIComponent(callbackPath);
    document.head.appendChild(script);
  });
}

async function discoverPodcastArtwork(title: string, url: string | null): Promise<string | null> {
  const preset = recommendedPodcastArtwork[title];
  if (preset) return preset;

  // Apple Podcasts / iTunes Search API: no API key required and CORS-friendly.
  // Search by the submitted programme title so Spotify/Amazon/YouTube submissions
  // can still acquire the canonical podcast artwork automatically.
  try {
    const endpoint =
      "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=5&country=JP&term=" +
      encodeURIComponent(title);
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json() as {
      results?: Array<{ collectionName?: string; artworkUrl600?: string; artworkUrl100?: string }>;
    };
    const normalize = (value: string) =>
      value.toLowerCase().replace(/[\s　・･\-—–_()（）「」『』]/g, "");
    const wanted = normalize(title);
    const results = Array.isArray(data.results) ? data.results : [];
    const exact = results.find((item) => normalize(String(item.collectionName || "")) === wanted);
    const best = exact ?? results[0];
    return best?.artworkUrl600 ?? best?.artworkUrl100 ?? null;
  } catch {
    return null;
  }
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
const officialArtwork: Record<string, string> = {
  "https://open.spotify.com/show/7euH6hzudIdp61JRSi9E8w":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fbe37e2b90a9796052cdda598",
  "https://open.spotify.com/show/0341I5UOUrJgm7KEvNGInZ":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fff5d81785074ee5566790630",
  "https://open.spotify.com/show/0yhef9ORZkUZs9ZeotdCSY":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fe29ec03cb712107152d7eb0f",
  "https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f691eb2ed78c31f9b1ab7cc35",
  "https://open.spotify.com/show/5Dt1uyQaJpM6hPV8aEMP3R":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f8f8d12c4e8bc804b599d4656",
  "https://open.spotify.com/show/1KExdSsjQnatS4TdseGoC0":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1ffd6d8f02a2455ef9301b89d3",
  "https://open.spotify.com/show/2uG9W6CnsaNi87AfSuGe8r":
    "https://image-cdn-fa.spotifycdn.com/image/ab67656300005f1f6a5b28cd6f20817f2499ca75",
  "https://open.spotify.com/show/5nF17xZ9nxBIDKkiqeyvYT":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1fdac17024f0d28b49d721db9d",
  "https://open.spotify.com/show/5UwHBIfMDqWs0EyfPOz50N":
    "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f72bc24f7f9a0b42fedbe9570",
};
const recommendedPodcastArtwork: Record<string, string> = {
  "AERAのだべらじお": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/0a/a1/64/0aa164cc-07a6-8f76-13bc-f4f0b6e1d514/mza_8598913033247722206.jpg/600x600bb.jpg",
};

const recommendedPodcastLinks: Record<string, [string, string][]> = {
  "AERAのだべらじお": [
    ["Spotify", "https://open.spotify.com/show/3NdPcDtxhkuHCvDTQ1MmwQ"],
    ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/aera%E3%81%AE%E3%81%A0%E3%81%B9%E3%82%89%E3%81%98%E3%81%8A/id1757557634"],
    ["Amazon Music", "https://music.amazon.co.jp/podcasts/4ac9df3c-f5cc-4158-8bf7-94145f096421/aera%E3%81%AE%E3%81%A0%E3%81%B9%E3%82%89%E3%81%98%E3%81%8A"],
    ["YouTube", "https://www.youtube.com/playlist?list=PLyNWE800jSWdcGh-A1o7hGg6hOUMrWVaj"],
  ],
};

type GuideStep = "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8" | "q9" | "q10";
type GuideChoice = { yes: GuideStep | string; no: GuideStep | string };
const guideQuestions: Record<GuideStep, { question: string; choice: GuideChoice }> = {
  q1: { question: "今日は「答え」が欲しい？", choice: { yes: "q2", no: "q5" } },
  q2: { question: "いま起きていることを、まずサッと知りたい？", choice: { yes: "朝日新聞アルキキ 最新ニュース", no: "q3" } },
  q3: { question: "10分くらいでニュースの背景や言葉まで分かりたい？", choice: { yes: "ニュースの学校", no: "q4" } },
  q4: { question: "ひとつの話を、簡単に片付けず最後まで考えたい？", choice: { yes: "ニュースの現場から", no: "報談【HOU-DAN】" } },
  q5: { question: "誰かがちゃんと迷っている話を聴きたい？", choice: { yes: "q6", no: "q8" } },
  q6: { question: "新聞社の人たちが\n「そもそも伝えるって何？」と悩むのを聴きたい？", choice: { yes: "MEDIA TALK", no: "q7" } },
  q7: { question: "知らない人同士が話して\nだんだん何かが生まれる感じが好き？", choice: { yes: "ドーナツ～このポッドキャストはSNSです", no: "報談【HOU-DAN】" } },
  q8: { question: "「なんで？」って言うのが好き？", choice: { yes: "こどもそうだんしつ", no: "q9" } },
  q9: { question: "スポーツを勝った負けただけで終わらせたくない？", choice: { yes: "スポンジ Sports Lounge", no: "q10" } },
  q10: { question: "英語が流れてきても逃げない？", choice: { yes: "朝日新聞AJW 英語ニュース", no: "OMIKUJI" } },
};

const officialPrograms: OfficialProgram[] = [
  {
    name: "スポンジ Sports Lounge",
    mark: "NEW",
    detail:
      "ポキフト、バスクラ、フィギュアスケートストーリー、お相撲ちゃんねる、野球",
    spotify: "https://open.spotify.com/show/7euH6hzudIdp61JRSi9E8w",
    links: [
      ["Spotify", "https://open.spotify.com/show/7euH6hzudIdp61JRSi9E8w"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%82%B9%E3%83%9D%E3%83%B3%E3%82%B8-sports-lounge/id6803013072"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/827f3a0a-e2c9-4913-88cf-329697329ec0/%E3%82%B9%E3%83%9D%E3%83%B3%E3%82%B8-sports-lounge-%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%84%E3%83%A9%E3%82%A6%E3%83%B3%E3%82%B8"],
      ["Pocket Casts", "https://buff.ly/F933Yg0"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/sponge",
    youtube: false,    discord: "https://discord.gg/6zBhm97F9",

  },
  {
    name: "ドーナツ～このポッドキャストはSNSです",
    mark: "NEW",
    schedule:
      "日：日曜版／月：さんぽ、対話、1on1、👀 別企画?!／木：親モヤ／第一木：スナックよりみ知／隔週金：アラサーかいわい／土：農MUSIC 猟ライフ",
    spotify: "https://open.spotify.com/show/0341I5UOUrJgm7KEvNGInZ",
    links: [
      ["Spotify", "https://open.spotify.com/show/0341I5UOUrJgm7KEvNGInZ"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%83%89%E3%83%BC%E3%83%8A%E3%83%84-%E3%81%93%E3%81%AE%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88%E3%81%AFsns%E3%81%A7%E3%81%99/id6798131655"],
      ["Amazon Music", "https://music.amazon.com/podcasts/edb44df6-5b86-4b52-88cf-cb270180b9f4"],
      ["Pocket Casts", "https://pocketcasts.com/podcast/%E3%83%89%E3%83%BC%E3%83%8A%E3%83%84-%E3%81%93%E3%81%AE%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88%E3%81%AFsns%E3%81%A7%E3%81%99/eac35880-7806-013f-17c3-0affc24a29f5"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/donut",
    discord: "https://discord.gg/TU8c9qtzvw",
  },
  {
    name: "MEDIA TALK",
    detail:
      "MEDIA TALK、木下くんあの動画見た？、いちおしウニュ！、読書会、楽屋裏、サステナブルHUBスタジオ、制作会議、天声人語、ニュース4U、記者サロンTALK、編集マニア、朝ポキシネマ、web編集の教科書",
    spotify: "https://open.spotify.com/show/0yhef9ORZkUZs9ZeotdCSY",
    links: [
      ["Spotify", "https://open.spotify.com/show/0yhef9ORZkUZs9ZeotdCSY"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/media-talk-%E3%83%A1%E3%83%87%E3%82%A3%E3%82%A2%E3%83%88%E3%83%BC%E3%82%AF/id1527037575"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/55b49660-b1f3-482d-9b1e-791337153bc2/media-talk-%E3%83%A1%E3%83%87%E3%82%A3%E3%82%A2%E3%83%88%E3%83%BC%E3%82%AF"],
      ["Pocket Casts", "https://pca.st/podcast/e2e4c3f0-c679-0138-e72c-0acc26574db2"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/playlist-2",
    discord: "https://discord.gg/6zBhm97F9",
    youtube: false,
  },
  {
    name: "ニュースの現場から",
    schedule:
      "月：一緒に新聞をめくろう！／火：カガクをひらく（月1～）、そなえトーク（月1程度）／水：World Insight（月2程度）、GLOBE CAST（月2程度）／木：PUERTA（月1程度）／金：ゆるっと経済（月1～）／土：ポリレビ／日：大阪／曜日不定：ON GOING（月数回）",
    spotify: "https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC",
    links: [
      ["Spotify", "https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89/id1526773927"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/7337408b-4752-4a85-8f27-4208a2ca8b1d/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89"],
      ["Pocket Casts", "https://pocketcasts.com/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89/ce4f8cb0-c119-0138-e716-0acc26574db2"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/podcast",    discord: "https://discord.gg/6zBhm97F9",

  },
  {
    name: "報談【HOU-DAN】",
    schedule:
      "月：カロリーオフ／木：報談本編（音声先行、木曜夜～金曜にSpotify動画）",
    spotify: "https://open.spotify.com/show/5Dt1uyQaJpM6hPV8aEMP3R",
    links: [
      ["Spotify", "https://open.spotify.com/show/5Dt1uyQaJpM6hPV8aEMP3R"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%82%92%E6%B7%B1%E3%81%8F%E9%9D%A2%E7%99%BD%E3%81%8F-%E5%A0%B1%E8%AB%87-hou-dan-%E3%83%9B%E3%82%A6%E3%83%80%E3%83%B3/id1822960480"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/297be73b-0c9b-4629-85a9-f51e179a1292/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%82%92%E6%B7%B1%E3%81%8F%E9%9D%A2%E7%99%BD%E3%81%8F-%E5%A0%B1%E8%AB%87-%E3%80%90hou-dan%E3%80%91-%E3%83%9B%E3%82%A6%E3%83%80%E3%83%B3"],
      ["Pocket Casts", "https://pocketcasts.com/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%82%92%E6%B7%B1%E3%81%8F%E9%9D%A2%E7%99%BD%E3%81%8F%E5%A0%B1%E8%AB%87-hou-dan%E3%83%9B%E3%82%A6%E3%83%80%E3%83%B3/e2bb4c60-c679-0138-e72c-0acc26574db2"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/playlist-1",
    discord: "https://discord.gg/d7sAbSRQvq",
  },
  {
    name: "こどもそうだんしつ",
    schedule: "水：本編／金：もっと話そう",
    spotify: "https://open.spotify.com/show/1KExdSsjQnatS4TdseGoC0",
    links: [
      ["Spotify", "https://open.spotify.com/show/1KExdSsjQnatS4TdseGoC0"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%81%93%E3%81%A9%E3%82%82%E3%81%9D%E3%81%86%E3%81%A0%E3%82%93%E3%81%97%E3%81%A4/id1592938106"],
      ["Amazon Music", "https://music.amazon.com/es-us/podcasts/16cb0d1f-42eb-433b-8696-b435641c4723/sdgs%E3%82%92%E8%A9%B1%E3%81%9D%E3%81%86-%E3%82%A2%E3%83%BC%E3%82%AB%E3%82%A4%E3%83%96%EF%BC%882021-10-2026-6%EF%BC%89"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/sdgs",
    youtube: false,    discord: "https://discord.gg/6zBhm97F9",

  },
  {
    name: "ニュースの学校",
    schedule: "平日配信。休日はお休み。",
    spotify: "https://open.spotify.com/show/2uG9W6CnsaNi87AfSuGe8r",
    links: [
      ["Spotify", "https://open.spotify.com/show/2uG9W6CnsaNi87AfSuGe8r"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E5%AD%A6%E6%A0%A1/id1551595534"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/c0bbd7fe-8cfb-4e94-9ec3-7c825aa70217/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E5%AD%A6%E6%A0%A1"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/playlist-3",
    youtube: false,    discord: "https://discord.gg/6zBhm97F9",

  },
  {
    name: "朝日新聞アルキキ 最新ニュース",
    detail: "毎日6時から23時まで、毎時配信",
    spotify: "https://open.spotify.com/show/5nF17xZ9nxBIDKkiqeyvYT",
    links: [
      ["Spotify", "https://open.spotify.com/show/5nF17xZ9nxBIDKkiqeyvYT"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9E%E3%82%A2%E3%83%AB%E3%82%AD%E3%82%AD-%E6%9C%80%E6%96%B0%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9/id1552603743"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/e3834140-7cc1-4804-a0c4-9ba9abfa51d2/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9E%E3%82%A2%E3%83%AB%E3%82%AD%E3%82%AD-%E6%9C%80%E6%96%B0%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9"],
    ],
    official: "https://omny.fm/shows/arukiki-ajw",
    youtube: false,    discord: "https://discord.gg/6zBhm97F9",

  },
  {
    name: "朝日新聞AJW 英語ニュース",
    detail: "毎日2回、8時と18時に配信",
    spotify: "https://open.spotify.com/show/5UwHBIfMDqWs0EyfPOz50N",
    links: [
      ["Spotify", "https://open.spotify.com/show/5UwHBIfMDqWs0EyfPOz50N"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9Eajw-%E8%8B%B1%E8%AA%9E%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9-the-asahi-shimbun-asia-japan-watch/id1572249005"],
      ["Amazon Music", "https://music.amazon.com/es-us/podcasts/81edc5ed-5305-4cd3-b392-3a001e6c1086/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9Eajw-%E8%8B%B1%E8%AA%9E%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%EF%BC%88the-asahi-shimbun-asia-japan-watch%EF%BC%89"],
    ],
    official: "https://www.asahi.com/ajw/",
    youtube: false,    discord: "https://discord.gg/6zBhm97F9",

  },
];
function OfficialArtwork({ url, name }: { url?: string; name: string }) {
  const art = url ? officialArtwork[url] : "";
  return (
    <div className="officialArt">
      {art ? (
        <img src={art} alt={`${name}のSpotifyアートワーク`} />
      ) : (
        <span>◯</span>
      )}
    </div>
  );
}
export default function Community({ playlists }: { playlists: Playlist[] }) {
  const [livePlaylists, setLivePlaylists] = useState<Playlist[]>(playlists);
  const [recommendedPodcasts, setRecommendedPodcasts] = useState<Playlist[]>([]);
  const [liveListenerPodcasts, setLiveListenerPodcasts] = useState<ListenerPodcast[]>(listenerPodcasts);
  const [view, setView] = useState<"listeners" | "official" | "circle" | "discord" | "podcasts" | "listenerPodcasts">(
      "official",
    ),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<"new" | "number">("new"),
    [listenerPodcastSort, setListenerPodcastSort] = useState<"new" | "number">("new"),
    [listened, setListened] = useState<string[]>([]),
    [omikuji, setOmikuji] = useState<Playlist | null>(null),
    [showAllListened, setShowAllListened] = useState(false),
    [guideStep, setGuideStep] = useState<GuideStep>("q1"),
    [guideResult, setGuideResult] = useState<string | null>(null),
    [submitUrl, setSubmitUrl] = useState(""),
    [submitTitle, setSubmitTitle] = useState(""),
    [submitMaker, setSubmitMaker] = useState(""),
    [submitComment, setSubmitComment] = useState(""),
    [submitIntroducedDate, setSubmitIntroducedDate] = useState(""),
    [submitKind, setSubmitKind] = useState<"playlist" | "podcast">("playlist"),
    [submitSecurityAnswer, setSubmitSecurityAnswer] = useState(""),
    [submitWebsite, setSubmitWebsite] = useState(""),
    [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle"),
    [submitMessage, setSubmitMessage] = useState(""),
    [resolveStatus, setResolveStatus] = useState<"idle" | "loading" | "success" | "error">("idle"),
    [resolveMessage, setResolveMessage] = useState(""),
    [resolvedDuplicate, setResolvedDuplicate] = useState(false),
    [resolvedArtwork, setResolvedArtwork] = useState<string | null>(null);
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("asapoki-listened") || "[]");
    const timer = window.setTimeout(() => setListened(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshListenerPlaylists() {
      try {
        const payload = await loadJsonp<{ ok: boolean; items?: Array<{ id?: string; url?: string; title?: string; maker?: string }> }>(
          ASARISU_API_URL + "?type=playlist&_=" + Date.now()
        );
        if (!payload?.ok || !Array.isArray(payload.items)) return;
        const existingByUrl = new Map(
          playlists.filter((item) => item.url).map((item) => [item.url as string, item]),
        );
        const existingByTitle = new Map(
          playlists.map((item) => [item.title.trim(), item]),
        );
        const next = payload.items
          .map((source: { id?: string; url?: string; title?: string; maker?: string }, index: number) => {
            const cleanUrl = String(source.url || "").trim() || null;
            const cleanTitle = String(source.title || "").trim();
            const existing =
              (cleanUrl ? existingByUrl.get(cleanUrl) : undefined) ??
              existingByTitle.get(cleanTitle);
            return {
              id: String(source.id || index + 1),
              title: cleanTitle,
              maker: String(source.maker || "").trim(),
              url: cleanUrl,
              artwork: existing?.artwork ?? null,
            } satisfies Playlist;
          })
          .filter((item: Playlist) => item.title);
        if (!cancelled && next.length) setLivePlaylists(next);
      } catch {
        // API取得失敗時はビルド済みデータをそのまま使う
      }
    }
    refreshListenerPlaylists();
    return () => { cancelled = true; };
  }, []);;
  useEffect(() => {
    let cancelled = false;
    async function refreshRecommendedPodcasts() {
      try {
        const payload = await loadJsonp<{ ok: boolean; items?: Array<{ id?: string; url?: string; title?: string; maker?: string; comment?: string }> }>(
          ASARISU_API_URL + "?type=podcast&_=" + Date.now()
        );
        if (!payload?.ok || !Array.isArray(payload.items)) return;
        const base = payload.items
          .map((source, index) => {
            const title = String(source.title || "").trim();
            return {
              id: String(source.id || index + 1),
              title,
              maker: String(source.maker || "").trim(),
              url: String(source.url || "").trim() || null,
              artwork: recommendedPodcastArtwork[title] ?? null,
              comment: String(source.comment || "").trim(),
            } satisfies Playlist;
          })
          .filter((item) => item.title);

        // Show text immediately, then fill artwork as each lookup completes.
        if (!cancelled) setRecommendedPodcasts(base);
        await Promise.all(
          base.map(async (item) => {
            if (item.artwork) return;
            const artwork = await discoverPodcastArtwork(item.title, item.url);
            if (!artwork || cancelled) return;
            setRecommendedPodcasts((current) =>
              current.map((p) => p.id === item.id ? { ...p, artwork } : p)
            );
          })
        );
      } catch {
        // 読み込み失敗時は現在の表示を維持
      }
    }
    refreshRecommendedPodcasts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refreshListenerPodcasts() {
      try {
        const payload = await loadJsonp<{ ok: boolean; items?: Array<{ id?: string; url?: string; title?: string; maker?: string; introduced?: string; comment?: string }> }>(
          ASARISU_API_URL + "?type=listenerPodcast&_=" + Date.now()
        );
        if (!payload?.ok || !Array.isArray(payload.items)) return;
        const base = payload.items
          .map((source, index) => ({
            id: String(source.id || index + 1).padStart(2, "0"),
            title: String(source.title || "").trim(),
            maker: String(source.maker || "").trim(),
            introduced: String(source.introduced || "").trim(),
            links: source.url ? [{ label: "番組", url: String(source.url) }] : [],
            artwork: null,
            comment: String(source.comment || "").trim(),
          } satisfies ListenerPodcast))
          .filter((item) => item.title);
        if (!cancelled) setLiveListenerPodcasts(base);
        await Promise.all(base.map(async (item) => {
          if (item.artwork) return;
          if (!item.links[0]?.url) return;
          const artwork = await discoverPodcastArtwork(item.title, item.links[0].url);
          if (!artwork || cancelled) return;
          setLiveListenerPodcasts((current) =>
            current.map((p) => p.id === item.id ? { ...p, artwork } : p)
          );
        }));
      } catch {
        // 初期12件を維持
      }
    }
    refreshListenerPodcasts();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(
    () =>
      livePlaylists
        .filter((p) =>
          (p.title + " " + p.maker).toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "new" ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id),
        ),
    [query, sort, livePlaylists],
  );
  function handleSearch(value: string) {
    setQuery(value);
  }
  function jumpToSearchResults() {
    if (!query.trim()) return;
    document.getElementById("playlist-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
  function toggleListened(id: string) {
    const next = listened.includes(id)
      ? listened.filter((value) => value !== id)
      : [...listened, id];
    setListened(next);
    localStorage.setItem("asapoki-listened", JSON.stringify(next));
  }
  const unheard = livePlaylists.filter((p) => p.url && !listened.includes(p.id));
  function drawOmikuji(includeListened = false) {
    const pool = includeListened ? livePlaylists.filter((p) => p.url) : unheard;
    if (!pool.length) {
      setOmikuji(null);
      setShowAllListened(true);
      return;
    }
    setShowAllListened(false);
    setOmikuji(pool[Math.floor(Math.random() * pool.length)]);
  }
  function answerGuide(answer: "yes" | "no") {
    const next = guideQuestions[guideStep].choice[answer];
    if (next === "OMIKUJI") {
      setGuideResult("OMIKUJI");
      return;
    }
    if (next in guideQuestions) {
      setGuideStep(next as GuideStep);
      return;
    }
    setGuideResult(next);
  }
  function resetGuide() {
    setGuideStep("q1");
    setGuideResult(null);
  }
  async function resolvePodcastInput() {
    const url = submitUrl.trim();
    if (!url) {
      setResolveStatus("error");
      setResolveMessage("まず番組URLを入力してください。");
      setResolvedDuplicate(false);
      return;
    }
    setResolveStatus("loading");
    setResolveMessage("番組情報を探しています…");
    setResolvedDuplicate(false);
    setResolvedArtwork(null);
    try {
      const resolveKind = view === "listenerPodcasts" ? "listenerPodcast" : "podcast";
      const payload = await loadJsonp<{
        ok: boolean;
        title?: string;
        artwork?: string;
        provider?: string;
        error?: string;
        duplicate?: boolean;
        duplicateId?: string;
      }>(
        ASARISU_API_URL +
          "?type=resolve&kind=" + encodeURIComponent(resolveKind) +
          "&url=" + encodeURIComponent(url) +
          "&_=" + Date.now()
      );
      if (!payload?.ok || !payload.title) {
        setResolveStatus("error");
        setResolveMessage(payload?.error || "番組タイトルを取得できませんでした。手入力してください。");
        return;
      }
      setSubmitTitle(payload.title);
      setResolvedArtwork(payload.artwork || null);
      if (payload.duplicate) {
        setResolvedDuplicate(true);
        setResolveStatus("error");
        setResolveMessage(
          "⚠️ この番組はすでに" +
          (resolveKind === "listenerPodcast" && payload.duplicateId ? "朝リスPodcast #" + payload.duplicateId + " に" : "") +
          "登録されています。"
        );
        return;
      }
      setResolveStatus("success");
      setResolveMessage((payload.provider ? payload.provider + "から " : "") + "番組名を取得しました。未登録です。");
    } catch {
      setResolveStatus("error");
      setResolveMessage("番組情報を取得できませんでした。手入力してください。");
    }
  }

  async function submitPlaylist(event: React.FormEvent<HTMLFormElement>, forcedKind?: "playlist" | "podcast" | "listenerPodcast") {
    event.preventDefault();
    if (!PLAYLIST_SUBMIT_ENDPOINT) {
      setSubmitStatus("error");
      setSubmitMessage("自動送信の接続準備中です。現在は下の作業台スプレッドシートをご利用ください。");
      return;
    }
    if (submitSecurityAnswer.trim() !== "大介") {
      setSubmitStatus("error");
      setSubmitMessage("合言葉が違います。「神田さんの名は？」をもう一度どうぞ。");
      return;
    }
    setSubmitStatus("sending");
    setSubmitMessage("");
    try {
      const postedKind = forcedKind ?? submitKind;

      await fetch(PLAYLIST_SUBMIT_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          url: submitUrl.trim(),
          title: submitTitle.trim(),
          maker: submitMaker.trim(),
          comment: submitComment.trim(),
          introducedDate: submitIntroducedDate,
          kind: postedKind,
          securityAnswer: submitSecurityAnswer.trim(),
          website: submitWebsite,
        }),
      });
      setSubmitStatus("success");
      setSubmitMessage(
        postedKind === "listenerPodcast"
          ? "朝リスPodcastを送信しました。ありがとうございます！ リストへの反映には少し時間がかかる場合があります。"
          : postedKind === "podcast"
            ? "おすすめPodcastを送信しました。ありがとうございます！ リストへの反映には数分かかる場合があります。"
            : "プレイリストを送信しました。ありがとうございます！ リストへの反映には数分かかる場合があります。"
      );
      setSubmitUrl("");
      setSubmitTitle("");
      setSubmitMaker("");
      setSubmitComment("");
      setSubmitIntroducedDate("");
      setResolvedDuplicate(false);
      setSubmitKind("playlist");
      setSubmitSecurityAnswer("");
      setSubmitWebsite("");
      setResolveStatus("idle");
      setResolveMessage("");
      setResolvedArtwork(null);
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("送信できませんでした。時間をおいてもう一度お試しください。");
    }
  }

  const guideProgram =
    guideResult && guideResult !== "OMIKUJI"
      ? officialPrograms.find((program) => program.name === guideResult) ?? null
      : null;
  return (
    <>
      <header>
        <div className="wrap nav">
          <b className="siteBrand">
            <img
              className="brandMark"
              src="/asarisunowa/asarisunowa-woven-ring-logo-brown-v4.png"
              alt=""
              aria-hidden="true"
            />
            <span>朝リスの輪 or 朝リスの田</span>
          </b>
          <a
            href="https://www.asahi.com/special/podcasts/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="asaMincho">朝</span> 公式・全番組 ↗
          </a>
        </div>
      </header>
      <div className="wrap compactNotice">
        <span>非公式・リスナー制作｜情報は最新・正確でない場合があります</span>
        <button type="button" onClick={() => setView("discord")}>
          ご意見はDiscordへ
        </button>
      </div>
      <div className="wrap viewTabs" role="tablist" aria-label="掲載区分">
        <button
          className={view === "official" ? "on" : ""}
          onClick={() => setView("official")}
        >
          ★ 公式
        </button>
        <button
          className={view === "listeners" ? "on" : ""}
          onClick={() => setView("listeners")}
        >
          ♡ 朝リスト
        </button>
        <button
          className={view === "discord" ? "on" : ""}
          onClick={() => setView("discord")}
        >
          💬 Discord
        </button>
        <button
          className={view === "circle" ? "on" : ""}
          onClick={() => setView("circle")}
        >
          ◯ あれどこ？
        </button>
        <button
          className={view === "listenerPodcasts" ? "on" : ""}
          onClick={() => setView("listenerPodcasts")}
        >
          🎙 朝リスPodcast
        </button>
        <button
          className={view === "podcasts" ? "on" : ""}
          onClick={() => { setSubmitKind("podcast"); setView("podcasts"); }}
        >
          🎧 他おすすめ
        </button>
      </div>
      {view === "listeners" ? (
        <>
          <div className="toolbar">
            <div className="wrap tools">
              <input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                placeholder="テーマ・制作者で検索"
                aria-label="検索"
                autoComplete="off"
                enterKeyHint="search"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    jumpToSearchResults();
                  }
                }}
              />
              <div className="sorts" role="group" aria-label="並べ替え">
                <button
                  className={sort === "new" ? "on" : ""}
                  onClick={() => setSort("new")}
                >
                  新着
                </button>
                <button
                  className={sort === "number" ? "on" : ""}
                  onClick={() => setSort("number")}
                >
                  登録順
                </button>
              </div>
            </div>
          </div>
          <main className="wrap">
            <div className="themeHead">
              <p className="kicker themeKicker">THEME PLAYLISTS</p>
              <h2>テーマ別プレイリスト</h2>
              <div className="countChips" aria-label="プレイリスト視聴状況">
                <span>全{livePlaylists.length}</span>
                <span>未聴{livePlaylists.length - listened.length}</span>
                <span>既聴{listened.length}</span>
              </div>
            </div>
            <section className="omikujiPanel">
              <div className="omikujiLead">
                <div className="omikujiIcon">⛩️</div>
                <div>
                  <h3>プレイリストおみくじ</h3>
                  <p>未聴{unheard.length}本から選びます。</p>
                </div>
              </div>
              <button className="omikujiDraw" type="button" onClick={() => drawOmikuji(false)}>
                おみくじを引く
              </button>
              {showAllListened && (
                <div className="omikujiResult on">
                  <h4>全部聴いてる！🎉</h4>
                  <p>未聴のプレイリストがありません。</p>
                  <button className="omikujiDraw" type="button" onClick={() => drawOmikuji(true)}>
                    既聴も含めてもう一度引く
                  </button>
                </div>
              )}
              {omikuji && (
                <div className="omikujiResult on">
                  <div className="omikujiResultInner">
                    <div className="omikujiArtwork">
                      {omikuji.artwork ? <img src={omikuji.artwork} alt="" /> : <span>ASAPOKI<br />PLAYLIST</span>}
                    </div>
                    <div>
                      <div className="omikujiMeta">
                        <small>PLAYLIST {omikuji.id.padStart(2, "0")}｜本日の一聴</small>
                        {!listened.includes(omikuji.id) && <span>♡ 未聴</span>}
                      </div>
                      <h4>{omikuji.title}</h4>
                      <p>by {omikuji.maker}</p>
                    </div>
                  </div>
                  {omikuji.url && (
                    <a className="omikujiGo" href={omikuji.url} target="_blank" rel="noreferrer">
                      このプレイリストを聴く ↗
                    </a>
                  )}
                </div>
              )}
            </section>
            <div id="playlist-results" className="grid">
              {rows.map((p) => {
                const isListened = listened.includes(p.id);
                return (
                  <article className="card" key={p.id}>
                    <div className="cover">
                  {p.artwork ? (
                    <img
                      src={p.artwork}
                      alt={`${p.title}のアートワーク`}
                      loading="lazy"
                    />
                  ) : (
                    <span>
                      ASAPOKI
                      <br />
                      PLAYLIST
                    </span>
                  )}
                </div>
                    <div className="cardBody listenerCardBody">
                      <small>PLAYLIST {p.id.padStart(2, "0")}</small>
                      <h3>{p.title}</h3>
                      <p>by {p.maker}</p>
                      <div className="actions">
                        <button
                          className={isListened ? "heart liked" : "heart"}
                          onClick={() => toggleListened(p.id)}
                          aria-pressed={isListened}
                        >
                          {isListened ? "♥ 聴いた" : "♡ 未聴"}
                        </button>
                      </div>
                      {p.url ? (
                        <a
                          className="listen"
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.url.includes("music.youtube.com")
                        ? "YouTube Musicで聴く ↗"
                        : "Spotifyで聴く ↗"}
                        </a>
                      ) : (
                        <span className="listen disabled">リンク準備中</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <section className="playlistSubmit" aria-labelledby="playlist-submit-title">
              <div className="playlistSubmitHead">
                <div>
                  <p className="kicker">ADD A PLAYLIST</p>
                  <h3 id="playlist-submit-title">朝リストに追加する</h3>
                  <p>ここは朝ポキ関連プレイリスト専用です。おすすめPodcastは「🎧 おすすめPodcast」からどうぞ。</p>
                </div>
              </div>
              <form onSubmit={(e) => submitPlaylist(e, "playlist")}>
                <label>
                  <span>プレイリストURL</span>
                  <input
                    type="url"
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    placeholder="Spotify / YouTube Music のプレイリストURL"
                    required
                  />
                </label>
                <label>
                  <span>タイトル</span>
                  <input
                    type="text"
                    value={submitTitle}
                    onChange={(e) => setSubmitTitle(e.target.value)}
                    placeholder="プレイリスト名"
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  <span>朝リスネーム</span>
                  <input
                    type="text"
                    value={submitMaker}
                    onChange={(e) => setSubmitMaker(e.target.value)}
                    placeholder="お名前・ハンドルネーム"
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  <span>セキュリティ：神田さんの名は？</span>
                  <input
                    type="text"
                    value={submitSecurityAnswer}
                    onChange={(e) => setSubmitSecurityAnswer(e.target.value)}
                    placeholder="漢字2文字"
                    maxLength={10}
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="submitHoneypot" aria-hidden="true">
                  <span>website</span>
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={submitWebsite}
                    onChange={(e) => setSubmitWebsite(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={submitStatus === "sending"}>
                  {submitStatus === "sending" ? "送信中…" : "投稿する"}
                </button>
                {submitMessage && (
                  <p className={submitStatus === "success" ? "submitNotice success" : "submitNotice error"}>
                    {submitMessage}
                  </p>
                )}
              </form>
           </section>
          </main>
        </>
      ) : view === "official" ? (
        <main className="wrap official">
          <div className="officialHeading">
            <h2 className="officialTitle">OFFICIAL PLAYLISTS</h2>
            <p className="officialIntro">
              朝日新聞ポッドキャストの公式プレイリストです。
            </p>
          </div>
          <section className="officialGuide" aria-labelledby="official-guide-title">
            <div className="officialGuideTop">
              <div>
                <p className="officialGuideKicker">🤔 どれ聴く？</p>
                <h3 id="official-guide-title">朝ポキ案内所</h3>
                <p>YES / NOでたどる、いまの耳に合いそうな公式番組。</p>
              </div>
              {(guideStep !== "q1" || guideResult) && (
                <button type="button" className="officialGuideReset" onClick={resetGuide}>
                  最初から
                </button>
              )}
            </div>

            {!guideResult ? (
              <div className="officialGuideQuestion">
                <small>QUESTION {Number(guideStep.slice(1))}</small>
                <p>
                  {guideQuestions[guideStep].question.split("\n").map((line, index) => (
                    <span key={line + index}>
                      {line}
                      {index < guideQuestions[guideStep].question.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </p>
                <div className="officialGuideButtons" role="group" aria-label="回答">
                  <button type="button" onClick={() => answerGuide("yes")}>YES</button>
                  <button type="button" onClick={() => answerGuide("no")}>NO</button>
                </div>
              </div>
            ) : guideResult === "OMIKUJI" ? (
              <div className="officialGuideResult">
                <div className="officialGuideResultIcon">⛩️</div>
                <div>
                  <small>今日の結論</small>
                  <h4>決められない日もある。</h4>
                  <p>そんな日は、朝リストのおみくじに任せよう。</p>
                  <button type="button" className="officialGuideGo" onClick={() => setView("listeners")}>
                    ⛩️ おみくじへ
                  </button>
                </div>
              </div>
            ) : guideProgram ? (
              <div className="officialGuideResult">
                <OfficialArtwork url={guideProgram.spotify} name={guideProgram.name} />
                <div className="officialGuideResultBody">
                  <small>あなたの今日の一聴</small>
                  <h4>{guideProgram.name}</h4>
                  {guideProgram.detail && <p>{guideProgram.detail}</p>}
                  {guideProgram.schedule && <p>{guideProgram.schedule}</p>}
                  <div className="officialGuideResultLinks">
                    {[
                      ...(guideProgram.links ?? []),
                      ...(guideProgram.youtube === false
                        ? []
                        : [["YouTube", ASAPOKI_YOUTUBE]]),
                      ["公式", guideProgram.official ?? ASAPOKI_OFFICIAL],
                    ].map(([label, url]) => (
                      <a href={url} target="_blank" rel="noreferrer" key={label}>
                        {label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
          <div className="officialGrid">
            {officialPrograms.map((p, index) => (
              <article
                className={`officialCard ${index < 2 ? "featured" : ""}`}
                key={p.name}
              >
                <OfficialArtwork url={p.spotify} name={p.name} />
                <div className="officialBody">
                  {p.mark && <em>{p.mark}</em>}
                  <h3>{p.name}</h3>
                  {p.detail && <p>{p.detail}</p>}
                  {p.schedule && <p className="schedule">{p.schedule}</p>}
                  <div className="serviceLinks">
                      {[
                        ...(p.links ?? []),
                        ...(p.youtube === false
                          ? []
                          : [["YouTube", ASAPOKI_YOUTUBE]]),
                        ["公式", p.official ?? ASAPOKI_OFFICIAL],
                      ].map(([label, url]) => (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          key={label}
                        >
                          {label} ↗
                        </a>
                      ))}
                    </div>
                  {p.discord && (
                    <a
                      className="discordSub"
                      href={p.discord}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.name.startsWith("ドーナツ")
                        ? "ドーナツDiscord"
                        : p.name === "MEDIA TALK"
                          ? "朝ポキのDiscord"
                          : "報談専用Discord"}{" "}
                      ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
       </main>
      ) : view === "listenerPodcasts" ? (
        <main className="wrap recommendedPodcastPage">
          <section className="recommendedPodcasts">
            <div className="themeHead">
              <p className="kicker themeKicker">LISTENER PODCASTS</p>
              <h2>🎙 朝リスさんのPodcast</h2>
              <p>タンタンさん作「朝リスさんのポッドキャスト」をもとに、みんなで更新できるリストへ育てています。</p>
            </div>
            <div className="toolbar listenerPodcastToolbar">
              <div className="tools">
                <div className="sorts" role="group" aria-label="朝リスPodcastの並べ替え">
                  <button className={listenerPodcastSort === "new" ? "on" : ""} onClick={() => setListenerPodcastSort("new")}>新着</button>
                  <button className={listenerPodcastSort === "number" ? "on" : ""} onClick={() => setListenerPodcastSort("number")}>登録順</button>
                </div>
              </div>
            </div>
            <div className="grid podcastGrid">
              {(listenerPodcastSort === "new" ? [...liveListenerPodcasts].reverse() : liveListenerPodcasts).map((p) => (
                <article className="card" key={"listener-podcast-" + p.id}>
                  <div className="cover podcastCover">
                    {p.artwork ? <img src={p.artwork} alt={p.title + "のアートワーク"} loading="lazy" /> : <span>ASARISU<br />PODCAST</span>}
                  </div>
                  <div className="cardBody listenerCardBody">
                    <small>PODCAST {p.id}</small>
                    <h3>{p.title}</h3>
                    <p>by {p.maker}</p>
                    {p.introduced && <p className="podcastComment">紹介配信日 {p.introduced}</p>}
                    {p.comment && <p className="podcastComment">💬 {p.comment}</p>}
                    {p.links.length > 0 ? (
                      <div className="platformLinks">
                        {p.links.map((link) => <a className="listen" key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}
                      </div>
                    ) : <span className="listen disabled">配信先を確認中</span>}
                  </div>
                </article>
              ))}
            </div>

            <section className="playlistSubmit" aria-labelledby="listener-podcast-submit-title">
              <div className="playlistSubmitHead">
                <div>
                  <p className="kicker">ADD A LISTENER PODCAST</p>
                  <h3 id="listener-podcast-submit-title">朝リスさんのPodcastを追加する</h3>
                  <p>ドーナツなどで紹介された朝リスさんのPodcastを追加できます。配信先URLを1つ入れて「番組を探す」を押してください。番組名を自動取得し、既存番組との重複もチェックします。</p>
                </div>
              </div>
              <form onSubmit={(e) => submitPlaylist(e, "listenerPodcast")}>
                <label>
                  <span>番組URL</span>
                  <input
                    type="url"
                    value={submitUrl}
                    onChange={(e) => {
                      setSubmitUrl(e.target.value);
                      setResolveStatus("idle");
                      setResolveMessage("");
                      setResolvedDuplicate(false);
                    }}
                    placeholder="Spotify / Apple / LISTEN / stand.fm など"
                    required
                  />
                  <button className="resolvePodcastButton" type="button" onClick={resolvePodcastInput} disabled={resolveStatus === "loading"}>
                    {resolveStatus === "loading" ? "探索中…" : "🔎 番組を探す"}
                  </button>
                  {resolveMessage && <small className={resolveStatus === "error" ? "resolveMessage error" : "resolveMessage"}>{resolveMessage}</small>}
                </label>
                <label>
                  <span>番組名</span>
                  <input type="text" value={submitTitle} onChange={(e) => setSubmitTitle(e.target.value)} placeholder="自動取得／手入力も可" maxLength={120} required />
                </label>
                <label>
                  <span>朝リスネーム</span>
                  <input type="text" value={submitMaker} onChange={(e) => setSubmitMaker(e.target.value)} placeholder="制作者・出演者名" maxLength={80} required />
                </label>
                <label>
                  <span>ドーナツ紹介日 <small>（任意）</small></span>
                  <input
                    type="date"
                    value={submitIntroducedDate}
                    onChange={(e) => setSubmitIntroducedDate(e.target.value)}
                  />
                  <small>ドーナツで紹介された日が分かる場合に選んでください。</small>
                </label>
                <label>
                  <span>ひとこと <small>（任意）</small></span>
                  <textarea value={submitComment} onChange={(e) => setSubmitComment(e.target.value)} placeholder="番組紹介など" maxLength={140} rows={3} />
                </label>
                <label>
                  <span>セキュリティ：神田さんの名は？</span>
                  <input type="text" value={submitSecurityAnswer} onChange={(e) => setSubmitSecurityAnswer(e.target.value)} placeholder="漢字2文字" maxLength={10} autoComplete="off" required />
                </label>
                <label className="submitHoneypot" aria-hidden="true">
                  <span>website</span>
                  <input type="text" tabIndex={-1} autoComplete="off" value={submitWebsite} onChange={(e) => setSubmitWebsite(e.target.value)} />
                </label>
                <button type="submit" disabled={submitStatus === "sending" || resolvedDuplicate}>{submitStatus === "sending" ? "送信中…" : resolvedDuplicate ? "登録済みです" : "投稿する"}</button>
                {submitMessage && <p className={submitStatus === "success" ? "submitNotice success" : "submitNotice error"}>{submitMessage}</p>}
              </form>
            </section>
          </section>
        </main>
      ) : view === "podcasts" ? (
        <main className="wrap recommendedPodcastPage">
            <section className="recommendedPodcasts" aria-labelledby="recommended-podcasts-title">
              <div className="themeHead">
                <p className="kicker themeKicker">RECOMMENDED PODCASTS</p>
                <h2 id="recommended-podcasts-title">🎧 朝リスのおすすめPodcast</h2>
                <p>朝リスさんが「これも聴いてほしい」と思った番組を持ち寄る棚。</p>
              </div>
              <div className="grid podcastGrid">
                {recommendedPodcasts.map((p) => (
                  <article className="card" key={"podcast-" + p.id}>
                    <div className="cover podcastCover">
                      {p.artwork ? (
                        <img
                          src={p.artwork}
                          alt={`${p.title}のアートワーク`}
                          loading="lazy"
                        />
                      ) : (
                        <span>PODCAST<br />RECOMMEND</span>
                      )}
                    </div>
                    <div className="cardBody listenerCardBody">
                      <small>RECOMMEND {p.id.padStart(2, "0")}</small>
                      <h3>{p.title}</h3>
                      <p>おすすめ：{p.maker}</p>
                      {p.comment && <p className="podcastComment">💬 {p.comment}</p>}
                      {recommendedPodcastLinks[p.title] ? (
                        <div className="platformLinks">
                          {recommendedPodcastLinks[p.title].map(([label, href]) => (
                            <a className="listen" key={label} href={href} target="_blank" rel="noreferrer">{label} ↗</a>
                          ))}
                        </div>
                      ) : p.url ? (
                        <a className="listen" href={p.url} target="_blank" rel="noreferrer">番組を聴く ↗</a>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <section className="playlistSubmit" aria-labelledby="podcast-submit-title">
              <div className="playlistSubmitHead">
                <div>
                  <p className="kicker">RECOMMENDED PODCASTS</p>
                  <h3 id="podcast-submit-title">おすすめPodcastを追加する</h3>
                  <p>朝リスさんの「これも聴いてほしい」を持ち寄る棚です。</p>
                </div>
              </div>
              <form onSubmit={(e) => submitPlaylist(e, "podcast")}>
                <label>
                  <span>番組URL</span>
                  <input
                    type="url"
                    value={submitUrl}
                    onChange={(e) => {
                      setSubmitUrl(e.target.value);
                      setResolveStatus("idle");
                      setResolveMessage("");
                    }}
                    placeholder="Spotify / Apple / LISTEN / stand.fm などの番組URL"
                    required
                  />
                  <button className="resolvePodcastButton" type="button" onClick={resolvePodcastInput} disabled={resolveStatus === "loading"}>
                    {resolveStatus === "loading" ? "探索中…" : "🔎 番組を探す"}
                  </button>
                  {resolveMessage && <small className={resolveStatus === "error" ? "resolveMessage error" : "resolveMessage"}>{resolveMessage}</small>}
                </label>
                <label>
                  <span>番組名</span>
                  <input
                    type="text"
                    value={submitTitle}
                    onChange={(e) => setSubmitTitle(e.target.value)}
                    placeholder="Podcast番組名"
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  <span>朝リスネーム</span>
                  <input
                    type="text"
                    value={submitMaker}
                    onChange={(e) => setSubmitMaker(e.target.value)}
                    placeholder="お名前・ハンドルネーム"
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  <span>ひとこと <small>（任意）</small></span>
                  <textarea
                    value={submitComment}
                    onChange={(e) => setSubmitComment(e.target.value)}
                    placeholder="どんなところがおすすめ？"
                    maxLength={140}
                    rows={3}
                  />
                </label>
                <label>
                  <span>セキュリティ：神田さんの名は？</span>
                  <input
                    type="text"
                    value={submitSecurityAnswer}
                    onChange={(e) => setSubmitSecurityAnswer(e.target.value)}
                    placeholder="漢字2文字"
                    maxLength={10}
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="submitHoneypot" aria-hidden="true">
                  <span>website</span>
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={submitWebsite}
                    onChange={(e) => setSubmitWebsite(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={submitStatus === "sending"}>
                  {submitStatus === "sending" ? "送信中…" : "投稿する"}
                </button>
                {submitMessage && (
                  <p className={submitStatus === "success" ? "submitNotice success" : "submitNotice error"}>
                    {submitMessage}
                  </p>
                )}
              </form>
           </section>
            </section>
        </main>
      ) : view === "circle" ? (
        <main className="wrap circlePage">
          <section className="rings">
            <div>
              <p className="kicker">朝リスの輪</p>
              <h2>あれどこ？</h2>
              <p className="circleIntro">
                朝リスの活動・検索・読み物への入口を、ここにまとめています。
              </p>
            </div>
            <div className="resourceGrid">
              <a
                className="newResource"
                href="https://ja.wikipedia.org/wiki/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9E%E3%83%9D%E3%83%83%E3%83%89%E3%82%AD%E3%83%A3%E3%82%B9%E3%83%88"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge newBadge">NEW</small>
                <b>朝ポキのWikipedia</b>
                <small className="creatorCredit">制作者：@ピノさん</small>
                <span>みんなで編集できます ✌️ ↗</span>
              </a>
              <a className="newResource" href="https://x.gd/6R84T" target="_blank" rel="noreferrer">
                <small className="resourceBadge newBadge">NEW</small>
                <b>日曜版で紹介された朝リスのPodcast</b>
                <small className="creatorCredit">制作者：@タンタンさん</small>
                <span>
                  これまで番組で紹介された朝リスさんのPodcastをまとめて見る ↗
                </span>
              </a>
              <a
                href="https://yoshimotomasahir.github.io/asapoki_vis/speakers2.html?screen=0"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge">🔍 パキッと見つかる</small>
                <b>朝ポキ検索ツール</b>
                <small className="creatorCredit">
                  制作者：@おんささん・@あさひあいちさん・@朝リス
                </small>
                <span>出演者や番組、記者も探せるよ ↗</span>
              </a>
              <p className="resourceSectionLabel officialResourceLabel">公式リンク</p>
              <a
                href="https://www.asahi.com/withnews/podcasts/"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge newBadge withnewsBadge">👀 注目</small>
                <b>ポッドキャストから記事化 格納庫</b>
                <span>withnewsで、音声から生まれた記事を読む ↗</span>
              </a>
              <a
                href="https://www.asahi.com/special/podcasts/"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge officialBadge">公式</small>
                <b>公式・全番組リスト</b>
                <span>朝日新聞ポッドキャスト一覧 ↗</span>
              </a>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSff1cc9SvJFtzbk3btowdGocatM2zEZgj-Drn1e8OKFd7Vezw/viewform"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge officialBadge">公式</small>
                <b>おたよりフォーム</b>
                <span>番組へおたよりを送る ↗</span>
              </a>
              <a
                href="https://www.youtube.com/@asapoki_official"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge officialBadge">公式</small>
                <b>朝ポキTV</b>
                <span>YouTubeで見る ↗</span>
              </a>
            </div>
          </section>
        </main>
      ) : (
        <main className="wrap circlePage">
          <section className="rings discordPage">
            <section className="discordHub" aria-labelledby="discord-title">
              <div className="discordHubHead">
                <span aria-hidden="true">💬</span>
                <div>
                  <p className="kicker">DISCORD LINKS</p>
                  <h3 id="discord-title">話す場所はこちら</h3>
                </div>
              </div>
              <div className="discordLinkGrid">
                <a href="https://discord.gg/6zBhm97F9" target="_blank" rel="noreferrer">
                  <i aria-hidden="true">🌅</i><span><b>朝ポキのDiscord</b><small>総合交流サーバー</small></span>
                </a>
                <a href="https://discord.gg/d7sAbSRQvq" target="_blank" rel="noreferrer">
                  <i aria-hidden="true">🎙️</i><span><b>報談【HOU-DAN】</b><small>報談専用サーバー</small></span>
                </a>
                <a href="https://discord.gg/TU8c9qtzvw" target="_blank" rel="noreferrer">
                  <i aria-hidden="true">🍩</i><span><b>ドーナツ</b><small>ドーナツの話題はこちら</small></span>
                </a>
                <a href="https://discord.gg/BUZ6cmV8Fh" target="_blank" rel="noreferrer">
                  <i aria-hidden="true">📝</i><span><b>朝日新聞 記者サロン</b><small>記者サロン専用Discord</small></span>
                </a>
                <a className="featuredDiscord" href="https://discord.gg/pbTQ6qajb3" target="_blank" rel="noreferrer">
                  <i aria-hidden="true">🛟</i><span><b>👀 朝リス課外活動</b><small>広場／座談会 聞くだけ参加も歓迎</small></span>
                </a>
              </div>
            </section>
          </section>
        </main>
      )}
      <section className="wrap siteHistory" aria-labelledby="site-history-title">
        <h3 id="site-history-title">更新ログ</h3>
        <div className="historyItem">
          <time dateTime="2026-09-08">2026.9.8</time>
          <p>「🎙 朝リスPodcast」ページを追加</p>
          <small>@タンタンさん作「朝リスさんのポッドキャスト」をもとに、共同更新できるリストへ拡張</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-08">2026.9.8</time>
          <p>「🎧 おすすめPodcast」ページを追加</p>
          <small>朝リスおすすめ番組の投稿・一覧表示に対応</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-08">2026.9.8</time>
          <p>投稿フォームから朝リストへの自動掲載に対応</p>
          <small>Spotifyのプレイリスト・番組、YouTube Musicのプレイリストを投稿可能</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-08">2026.9.8</time>
          <p>朝リストに「プレイリスト投稿フォーム」を追加</p>
          <small>プレイリストURL・タイトル・朝リスネームの3項目で投稿受付</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-08">2026.9.8</time>
          <p>「どれ聴く？ 朝ポキ案内所」開設</p>
          <small>💡 @ピノ子さんのアイデアをもとに制作</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-07">2026.9.7</time>
          <p>「プレイリストおみくじ」開設</p>
          <small>💡 @ピノ子さんのアイデアをもとに制作</small>
        </div>
        <div className="historyItem">
          <time dateTime="2026-09-06">2026.9.6</time>
          <p>「朝リスの輪 or 朝リスの田」開設</p>
          <p>日曜版を参考に「ドーナツ」の配信情報を追加・編集</p>
        </div>
        <div className="historyItem">
          <time dateTime="2026-08-23">2026.8.23</time>
          <p>@ナカジマシンヤ（朝ポキ）さんのDiscord投稿を参考に、公式プレイリストの番組情報を整理</p>
        </div>
        <div className="historySources">
          <h4>情報・画像について</h4>
          <p>番組情報は、朝日新聞ポッドキャスト公式情報および各配信プラットフォームの公開情報を参考に編集しています。</p>
          <p>番組画像・アートワークは、番組を識別し配信先をご案内する目的で、公式サイト、Spotify、Apple Podcasts、Amazon Music、YouTube等で公開されている画像を出典元が分かる形で引用しています。</p>
          <p>各番組・画像等の権利は、それぞれの権利者に帰属します。</p>
        </div>
      </section>
      <footer>
        <div className="wrap">
          <small>
            朝リスが制作・運営する非公式リスナーサイトを目指しています。@ネジート
          </small>
        </div>
      </footer>
    </>
  );
}
