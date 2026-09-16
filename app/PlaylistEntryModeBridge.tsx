"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PlaylistCombinedAutoForm from "./PlaylistCombinedAutoForm";
import PlaylistEntryModeSelector, { type PlaylistEntryMode } from "./PlaylistEntryMode";

type PlaylistShelf = "series" | "other";

const SERIES_PLAYLIST_TITLES = new Set([
  "一緒に新聞をめくろう！",
  "編集マニア",
  "8がけ社会",
  "朝日新聞社の歴史",
  "バスケ通信―クラッチタイム（バスクラ）",
  "#きのどう「木下君、あの動画みた？」",
  "GLOBE CAST",
  "新聞社員の「楽屋裏」",
  "アラサー会",
  "親モヤ",
].map(normalizeShelfTitle));

function normalizeShelfTitle(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\s　]+/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function isSeriesPlaylistTitle(title: string) {
  return SERIES_PLAYLIST_TITLES.has(normalizeShelfTitle(title));
}

function scrollPlaylistEntryIntoView() {
  const section = document.getElementById("playlist-entry-mode-host");
  if (!section) return;

  const controlsBottom = document.querySelector<HTMLElement>(".sorts")?.getBoundingClientRect().bottom ?? 0;
  const top = window.scrollY + section.getBoundingClientRect().top - controlsBottom - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

export default function PlaylistEntryModeBridge() {
  const [mode, setMode] = useState<PlaylistEntryMode>("register");
  const [shelf, setShelf] = useState<PlaylistShelf>("other");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [sortHost, setSortHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let currentHost: HTMLElement | null = null;
    let currentSortHost: HTMLElement | null = null;

    const mountWhenReady = () => {
      const registerSection = document.querySelector<HTMLElement>(
        "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
      );
      const autoSection = document.getElementById("auto-update-request");
      if (!registerSection || !autoSection) {
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let mount = document.getElementById("playlist-entry-mode-host") as HTMLElement | null;
      if (!mount) {
        mount = document.createElement("section");
        mount.id = "playlist-entry-mode-host";
        mount.className = "playlistSubmit";
        mount.setAttribute("aria-label", "プレイリストを登録・自動更新する");
        registerSection.parentElement?.insertBefore(mount, registerSection);
      }

      if (currentHost !== mount) {
        currentHost = mount;
        setHost(mount);
      }

      const nextSortHost = document.querySelector<HTMLElement>(".sorts");
      if (nextSortHost && currentSortHost !== nextSortHost) {
        currentSortHost = nextSortHost;
        setSortHost(nextSortHost);
      }

      const legacyManagerButton = document.querySelector<HTMLButtonElement>(".playlistOwnerJump");
      if (legacyManagerButton) legacyManagerButton.hidden = true;
    };

    mountWhenReady();
    const observer = new MutationObserver(mountWhenReady);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleManagerJump = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest(".playlistOwnerJump")) {
        setMode("register");
        window.setTimeout(scrollPlaylistEntryIntoView, 0);
      }
    };
    document.addEventListener("click", handleManagerJump);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleManagerJump);
      const registerSection = document.querySelector<HTMLElement>(
        "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
      );
      const autoSection = document.getElementById("auto-update-request");
      const legacyManagerButton = document.querySelector<HTMLButtonElement>(".playlistOwnerJump");
      if (registerSection) registerSection.hidden = false;
      if (autoSection) autoSection.hidden = false;
      if (legacyManagerButton) legacyManagerButton.hidden = false;
      currentHost?.remove();
    };
  }, []);

  useEffect(() => {
    let scheduled = false;

    const syncShelfUi = () => {
      scheduled = false;
      const tabs = document.querySelector<HTMLElement>(".viewTabs");
      if (!tabs) return;

      const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>("button"));
      const otherTab =
        buttons.find((button) => button.dataset.playlistShelfTab === "other") ??
        buttons.find((button) => button.textContent?.includes("朝リスト"));
      if (!otherTab) return;

      otherTab.dataset.playlistShelfTab = "other";
      if (otherTab.textContent?.trim() !== "🐿️朝リスト") {
        otherTab.textContent = "🐿️朝リスト";
      }
      otherTab.onclick = () => setShelf("other");

      let seriesTab = tabs.querySelector<HTMLButtonElement>("button[data-playlist-shelf-tab='series']");
      if (!seriesTab) {
        seriesTab = document.createElement("button");
        seriesTab.type = "button";
        seriesTab.dataset.playlistShelfTab = "series";
        seriesTab.textContent = "連載";
        tabs.insertBefore(seriesTab, otherTab);
      }
      seriesTab.onclick = () => {
        otherTab.click();
        setShelf("series");
      };

      const playlistGrid = document.getElementById("playlist-results");
      const listenersActive = Boolean(playlistGrid);
      seriesTab.classList.toggle("on", listenersActive && shelf === "series");
      if (listenersActive && shelf === "series") {
        otherTab.classList.remove("on");
      } else if (listenersActive && shelf === "other") {
        otherTab.classList.add("on");
      }

      if (!playlistGrid) return;

      const cards = Array.from(playlistGrid.querySelectorAll<HTMLElement>("article.card"));
      cards.forEach((card) => {
        const title = card.querySelector("h3")?.textContent?.trim() ?? "";
        const isSeries = isSeriesPlaylistTitle(title);
        card.hidden = shelf === "series" ? !isSeries : isSeries;
      });

      const visibleCards = cards.filter((card) => !card.hidden);
      const listenedCount = visibleCards.filter((card) => card.querySelector(".heart.liked")).length;
      const countSpans = Array.from(document.querySelectorAll<HTMLElement>(".playlistThemeHead .countChips span"));
      if (countSpans[0]) countSpans[0].textContent = `全${visibleCards.length}`;
      if (countSpans[1]) countSpans[1].textContent = `未聴${Math.max(0, visibleCards.length - listenedCount)}`;
      if (countSpans[2]) countSpans[2].textContent = `既聴${listenedCount}`;

      const themeHead = document.querySelector<HTMLElement>(".playlistThemeHead");
      const kicker = themeHead?.querySelector<HTMLElement>(".themeKicker");
      const heading = themeHead?.querySelector<HTMLElement>("h2");
      if (kicker) kicker.textContent = shelf === "series" ? "SERIES PLAYLISTS" : "OTHER PLAYLISTS";
      if (heading) heading.textContent = shelf === "series" ? "朝リスト（連載）" : "朝リスト（その他）";

      const omikuji = document.querySelector<HTMLElement>(".omikujiPanel");
      if (omikuji) omikuji.hidden = shelf === "series";

      const makerLabel = Array.from(
        document.querySelectorAll<HTMLElement>(
          "main .playlistSubmit[aria-labelledby='playlist-submit-title'] form label > span",
        ),
      ).find((element) => ["朝リスネーム", "プレイリスト制作者名"].includes(element.textContent?.trim() ?? ""));
      if (makerLabel) {
        makerLabel.textContent = "プレイリスト制作者";
        const makerInput = makerLabel.parentElement?.querySelector<HTMLInputElement>("input");
        if (makerInput) makerInput.placeholder = "朝リスネーム または 朝日新聞ポッドキャスト";
      }

      const autoMakerLabel = Array.from(
        document.querySelectorAll<HTMLElement>("#auto-update-request .autoUpdateForm label > span"),
      ).find((element) => element.textContent?.trim() === "あなたの朝リスネーム");
      if (autoMakerLabel) {
        autoMakerLabel.textContent = "プレイリスト制作者";
        const autoMakerInput = autoMakerLabel.parentElement?.querySelector<HTMLInputElement>("input");
        if (autoMakerInput) autoMakerInput.placeholder = "朝リスネーム または 朝日新聞ポッドキャスト";
      }
    };

    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(syncShelfUi);
    };

    syncShelfUi();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", scheduleSync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleSync);
      document
        .querySelector<HTMLButtonElement>("button[data-playlist-shelf-tab='series']")
        ?.remove();
      const otherTab = document.querySelector<HTMLButtonElement>("button[data-playlist-shelf-tab='other']");
      if (otherTab) {
        otherTab.textContent = "🐿️朝リスト";
        delete otherTab.dataset.playlistShelfTab;
        otherTab.onclick = null;
      }
      document.querySelectorAll<HTMLElement>("#playlist-results article.card").forEach((card) => {
        card.hidden = false;
      });
      const omikuji = document.querySelector<HTMLElement>(".omikujiPanel");
      if (omikuji) omikuji.hidden = false;
    };
  }, [shelf]);

  useEffect(() => {
    if (!host?.isConnected) return;

    const registerSection = document.querySelector<HTMLElement>(
      "main .playlistSubmit[aria-labelledby='playlist-submit-title']",
    );
    const autoSection = document.getElementById("auto-update-request");
    if (!registerSection || !autoSection) return;

    if (mode === "register") {
      registerSection.hidden = false;
      autoSection.hidden = true;
      return;
    }

    if (mode === "registerAndAuto") {
      registerSection.hidden = true;
      autoSection.hidden = true;
      return;
    }

    registerSection.hidden = true;
    autoSection.hidden = false;
    const toggle = autoSection.querySelector<HTMLButtonElement>(".autoUpdateToggle");
    const form = autoSection.querySelector<HTMLFormElement>(".autoUpdateForm");
    if (!form && toggle) toggle.click();
  }, [mode, host]);

  const jumpToManagerForm = () => {
    setMode("autoExisting");
    window.setTimeout(scrollPlaylistEntryIntoView, 0);
  };

  return (
    <>
      {host?.isConnected
        ? createPortal(
            <div>
              <div className="playlistSubmitHead">
                <div>
                  <p className="kicker">GROW YOUR PLAYLIST</p>
                  <h3>🌱 リストを育てる！</h3>
                  <p>
                    朝日新聞ポッドキャストのエピソードを、シリーズ・出演者・テーマなど、自分の好きな切り口でまとめたプレイリストを登録できます。Spotifyなら、条件に合う新しい回を探して自動で追加することもできます。
                  </p>
                  <PlaylistEntryModeSelector
                    value={mode}
                    onChange={setMode}
                    disabledModes={["registerAndAuto", "autoExisting"]}
                  />
                </div>
              </div>
              {mode === "registerAndAuto" && <PlaylistCombinedAutoForm />}
            </div>,
            host,
          )
        : null}
      {sortHost?.isConnected
        ? createPortal(
            <button
              type="button"
              className="playlistManagerSortButton"
              onClick={jumpToManagerForm}
              aria-label="リストを育てるメニューへ"
              title="プレイリストを登録・自動更新"
              style={{ marginLeft: "auto", borderColor: "#cc4b78", color: "#0b5874", fontWeight: 800 }}
            >
              🌱 リストを育てる！
            </button>,
            sortHost,
          )
        : null}
    </>
  );
}
