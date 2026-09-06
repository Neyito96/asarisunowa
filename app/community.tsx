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
    youtube: false,
  },
  {
    name: "ドーナツ～このポッドキャストはSNSです",
    mark: "NEW",
    schedule:
      "日：日曜版／月：散歩、対話、1on1、👀 別企画?!／木：親モヤ／第一木：スナックよりみ知／隔週金：アラサーかいわい／土：農MUSIC 猟ライフ",
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
      "木下くんあの動画見た？、いちおしウニュ！、読書会、楽屋裏、サステナブルHUBスタジオ、制作会議、天声人語、ニュース4U、記者サロンTALK、編集マニア、朝ポキシネマ、web編集の教科書",
    spotify: "https://open.spotify.com/show/0yhef9ORZkUZs9ZeotdCSY",
    links: [
      ["Spotify", "https://open.spotify.com/show/0yhef9ORZkUZs9ZeotdCSY"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/media-talk-%E3%83%A1%E3%83%87%E3%82%A3%E3%82%A2%E3%83%88%E3%83%BC%E3%82%AF/id1527037575"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/55b49660-b1f3-482d-9b1e-791337153bc2/media-talk-%E3%83%A1%E3%83%87%E3%82%A3%E3%82%A2%E3%83%88%E3%83%BC%E3%82%AF"],
      ["Pocket Casts", "https://pca.st/podcast/e2e4c3f0-c679-0138-e72c-0acc26574db2"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/playlist-2",
    youtube: false,
  },
  {
    name: "ニュースの現場から",
    schedule:
      "月：新聞をめくろう／火：カガク・そなえ／水：World Insight・GLOBE CAST／木：PUERTA／金：ゆるっと経済／土：ポリレビ／日：👀 ニュース大阪目線／不定：ON GOING",
    spotify: "https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC",
    links: [
      ["Spotify", "https://open.spotify.com/show/392h0MYfvMTndEVzf2cOvC"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89/id1526773927"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/7337408b-4752-4a85-8f27-4208a2ca8b1d/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89"],
      ["Pocket Casts", "https://pocketcasts.com/podcast/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%E3%81%AE%E7%8F%BE%E5%A0%B4%E3%81%8B%E3%82%89/ce4f8cb0-c119-0138-e716-0acc26574db2"],
    ],
    official: "https://omny.fm/shows/asahi/playlists/podcast",
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
    youtube: false,
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
    youtube: false,
  },
  {
    name: "朝日新聞アルキキ 最新ニュース",
    detail: "最新ニュースのサマリーを手軽にまとめ聞きできる音声ニュース番組です。",
    spotify: "https://open.spotify.com/show/5nF17xZ9nxBIDKkiqeyvYT",
    links: [
      ["Spotify", "https://open.spotify.com/show/5nF17xZ9nxBIDKkiqeyvYT"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9E%E3%82%A2%E3%83%AB%E3%82%AD%E3%82%AD-%E6%9C%80%E6%96%B0%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9/id1552603743"],
      ["Amazon Music", "https://music.amazon.co.jp/podcasts/e3834140-7cc1-4804-a0c4-9ba9abfa51d2/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9E%E3%82%A2%E3%83%AB%E3%82%AD%E3%82%AD-%E6%9C%80%E6%96%B0%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9"],
    ],
    official: "https://omny.fm/shows/arukiki-ajw",
    youtube: false,
  },
  {
    name: "朝日新聞AJW 英語ニュース",
    detail: "アジアと日本の最新ニュースを英語音声で届けます。",
    spotify: "https://open.spotify.com/show/5UwHBIfMDqWs0EyfPOz50N",
    links: [
      ["Spotify", "https://open.spotify.com/show/5UwHBIfMDqWs0EyfPOz50N"],
      ["Apple Podcasts", "https://podcasts.apple.com/jp/podcast/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9Eajw-%E8%8B%B1%E8%AA%9E%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9-the-asahi-shimbun-asia-japan-watch/id1572249005"],
      ["Amazon Music", "https://music.amazon.com/es-us/podcasts/81edc5ed-5305-4cd3-b392-3a001e6c1086/%E6%9C%9D%E6%97%A5%E6%96%B0%E8%81%9Eajw-%E8%8B%B1%E8%AA%9E%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9%EF%BC%88the-asahi-shimbun-asia-japan-watch%EF%BC%89"],
    ],
    official: "https://www.asahi.com/ajw/",
    youtube: false,
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
  const [view, setView] = useState<"listeners" | "official" | "circle" | "discord">(
      "official",
    ),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<"new" | "number">("new"),
    [listened, setListened] = useState<string[]>([]);
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("asapoki-listened") || "[]");
    const timer = window.setTimeout(() => setListened(saved), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const rows = useMemo(
    () =>
      playlists
        .filter((p) =>
          (p.title + " " + p.maker).toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "new" ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id),
        ),
    [query, sort, playlists],
  );
  function toggleListened(id: string) {
    const next = listened.includes(id)
      ? listened.filter((value) => value !== id)
      : [...listened, id];
    setListened(next);
    localStorage.setItem("asapoki-listened", JSON.stringify(next));
  }
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
            <span>朝リスの輪</span>
          </b>
          <a
            href="https://www.asahi.com/special/podcasts/"
            target="_blank"
            rel="noreferrer"
          >
            公式・全番組 ↗
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
      </div>
      {view === "listeners" ? (
        <>
          <div className="toolbar">
            <div className="wrap tools">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="テーマ・制作者で検索"
                aria-label="検索"
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
            <div className="listHead">
              <div>
                <p className="kicker">LISTENER PICKS</p>
                <h2>朝リスのプレイリスト</h2>
                <p>リスナーが作ったアーカイブ。更新はゆっくりめです。</p>
                <small className="rankingNote">
                  ♡を押すと、この端末で「聴いた」印を残せます。
                </small>
              </div>
              <span>{rows.length}件</span>
            </div>
            <div className="grid">
              {rows.map((p) => {
                const isListened = listened.includes(p.id);
                return (
                  <article className="card" key={p.id}>
                    <div className="cover">
                      {p.url?.includes("open.spotify.com/playlist/") ? (
                        <iframe
                          title={`${p.title} Spotify`}
                          src={
                            p.url
                              .replace(
                                "open.spotify.com/playlist/",
                                "open.spotify.com/embed/playlist/",
                              )
                              .split("?")[0]
                          }
                          loading="lazy"
                          allow="encrypted-media"
                        />
                      ) : (
                        <span>
                          ASAPOKI
                          <br />
                          PLAYLIST
                        </span>
                      )}
                    </div>
                    <div className="cardBody">
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
                          Spotifyで聴く ↗
                        </a>
                      ) : (
                        <span className="listen disabled">リンク準備中</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
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
                        : "報談専用Discord"}{" "}
                      ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="sourceNote">
            画像：公式サイト・各配信サービス／番組リスト：中島さんのDiscord投稿・音声配信をもとに編集
          </p>
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
                <small className="resourceBadge">🏆 レジェンド認定</small>
                <b>朝ポキ検索ツール</b>
                <small className="creatorCredit">
                  制作者：@オンサさん・@あさひあいちさん・@朝リス
                </small>
                <span>出演者や番組、記者も探せるよ ↗</span>
              </a>
              <p className="resourceSectionLabel officialResourceLabel">公式リンク</p>
              <a
                href="https://www.asahi.com/withnews/podcasts/"
                target="_blank"
                rel="noreferrer"
              >
                <small className="resourceBadge newBadge">👀 注目</small>
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
      <footer>
        <div className="wrap">
          <small>
            このページは、朝リスのネジートがAIと試行錯誤しながら制作している非公式リスナーサイトです。お助け歓迎です〜
          </small>
        </div>
      </footer>
    </>
  );
}
